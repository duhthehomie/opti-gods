// System Restore Point creator + lister + restorer.
//
// `SRSetRestorePointW` is exported by SrClient.dll. The `windows` crate
// surfaces it under Win32::System::Restore. Listing existing checkpoints
// uses the SystemRestore WMI namespace (`root\default`). Replay uses
// rstrui.exe which is the only supported user-facing path on modern Windows.

use crate::commands::restore::RestorePoint;
use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use wmi::{COMLibrary, WMIConnection};
use windows::Win32::System::Restore::{
    SRSetRestorePointW, BEGIN_NESTED_SYSTEM_CHANGE, END_NESTED_SYSTEM_CHANGE, MODIFY_SETTINGS,
    RESTOREPOINTINFOW, STATEMGRSTATUS,
};

pub fn create(label: &str) -> Result<RestorePoint> {
    // SRSetRestorePointW expects a 64-char description in a fixed-size buffer.
    let mut desc = [0u16; 256];
    for (i, c) in label.encode_utf16().take(63).enumerate() {
        desc[i] = c;
    }
    // Phase 1 — BEGIN_NESTED_SYSTEM_CHANGE opens the checkpoint and gives us
    // the sequence number we need to finalise it.
    let mut begin_info = RESTOREPOINTINFOW {
        dwEventType: BEGIN_NESTED_SYSTEM_CHANGE,
        dwRestorePtType: MODIFY_SETTINGS,
        llSequenceNumber: 0,
        szDescription: desc,
    };
    let mut begin_status = STATEMGRSTATUS::default();
    let ok = unsafe { SRSetRestorePointW(&mut begin_info, &mut begin_status) };
    if !ok.as_bool() {
        let status_code = begin_status.nStatus.0;
        let seq = begin_status.llSequenceNumber;
        return Err(anyhow!(
            "SRSetRestorePointW(BEGIN) failed (status={:#x}, seq={})",
            status_code,
            seq
        ));
    }

    // Phase 2 — END_NESTED_SYSTEM_CHANGE finalises the checkpoint Windows
    // opened in phase 1. Without this the restore point is never committed
    // and won't appear in `rstrui.exe` / `vssadmin list shadows`.
    let mut end_info = RESTOREPOINTINFOW {
        dwEventType: END_NESTED_SYSTEM_CHANGE,
        dwRestorePtType: MODIFY_SETTINGS,
        llSequenceNumber: begin_status.llSequenceNumber,
        szDescription: desc,
    };
    let mut end_status = STATEMGRSTATUS::default();
    let ok = unsafe { SRSetRestorePointW(&mut end_info, &mut end_status) };
    if !ok.as_bool() {
        let status_code = end_status.nStatus.0;
        let seq = end_status.llSequenceNumber;
        return Err(anyhow!(
            "SRSetRestorePointW(END) failed (status={:#x}, seq={})",
            status_code,
            seq
        ));
    }

    let point = RestorePoint {
        sequence_number: begin_status.llSequenceNumber,
        label: label.to_string(),
        created_at: chrono_iso_now(),
    };

    // SRSetRestorePointW can return success before a broken System Restore
    // setup is visible to recovery tools. Require WMI to see the exact
    // sequence before we allow any tweak mutation.
    for _ in 0..3 {
        if list()
            .map(|points| {
                points
                    .iter()
                    .any(|candidate| candidate.sequence_number == point.sequence_number)
            })
            .unwrap_or(false)
        {
            return Ok(point);
        }
        thread::sleep(Duration::from_millis(300));
    }
    Err(anyhow!(
        "Windows created checkpoint #{} but it was not visible in System Restore",
        point.sequence_number
    ))
}

static SESSION_CHECKPOINT: OnceLock<Mutex<Option<RestorePoint>>> = OnceLock::new();

/// Guarantees that this desktop-app process has created and WMI-verified a
/// restore point. Renderer state cannot bypass this guard.
pub fn ensure_session_checkpoint(label: &str) -> Result<RestorePoint> {
    let state = SESSION_CHECKPOINT.get_or_init(|| Mutex::new(None));
    let mut checkpoint = state
        .lock()
        .map_err(|_| anyhow!("restore checkpoint lock was poisoned"))?;
    if let Some(existing) = checkpoint.clone() {
        return Ok(existing);
    }
    ensure_enabled()?;
    let created = create(label)?;
    *checkpoint = Some(created.clone());
    Ok(created)
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct SystemRestoreRow {
    sequence_number: Option<u32>,
    description: Option<String>,
    creation_time: Option<String>,
}

pub fn list() -> Result<Vec<RestorePoint>> {
    let com = COMLibrary::new().context("COM init")?;
    // System restore lives in root\default, not root\cimv2.
    let wmi = WMIConnection::with_namespace_path("root\\default", com)
        .context("WMI connect (root\\default)")?;
    let rows: Vec<SystemRestoreRow> = wmi
        .raw_query("SELECT SequenceNumber, Description, CreationTime FROM SystemRestore")
        .context("query SystemRestore")?;
    Ok(rows
        .into_iter()
        .map(|r| RestorePoint {
            sequence_number: r.sequence_number.unwrap_or(0) as i64,
            label: r.description.unwrap_or_default(),
            created_at: r.creation_time.unwrap_or_default(),
        })
        .collect())
}

pub fn restore(sequence_number: i64) -> Result<()> {
    // The only supported way to replay a restore point as a regular admin
    // process is to hand off to rstrui.exe with /OFFLINE; it shows the
    // standard System Restore wizard pre-selected to the chosen checkpoint.
    let arg = format!("/OFFLINE:C:\\=ACTIVE&id={sequence_number}");
    Command::new("rstrui.exe")
        .arg(arg)
        .spawn()
        .context("launch rstrui.exe")?;
    Ok(())
}

/// Ensure System Restore is enabled on the C: drive.
/// Requires admin rights (Opti Gods app.manifest already requests them).
pub fn ensure_enabled() -> anyhow::Result<()> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    // 1. Clear the policy key that disables System Restore
    //    HKLM\SOFTWARE\Policies\Microsoft\Windows NT\SystemRestore DisableSR = 0
    let policy = Command::new("reg")
        .args([
            "add",
            r"HKLM\SOFTWARE\Policies\Microsoft\Windows NT\SystemRestore",
            "/v", "DisableSR",
            "/t", "REG_DWORD",
            "/d", "0",
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .context("launch reg.exe to enable System Restore policy")?;
    if !policy.status.success() {
        return Err(anyhow!(
            "Windows rejected the System Restore policy change: {}",
            String::from_utf8_lossy(&policy.stderr).trim()
        ));
    }

    // 2. Enable System Restore on C:\ and fail if PowerShell rejects it.
    let enabled = Command::new("powershell")
        .args([
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
            "$ErrorActionPreference='Stop'; Enable-ComputerRestore -Drive 'C:\\'",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .context("launch PowerShell to enable System Restore")?;
    if !enabled.status.success() {
        let detail = String::from_utf8_lossy(&enabled.stderr);
        return Err(anyhow!(
            "System Restore could not be enabled on C:\\: {}",
            detail.trim()
        ));
    }

    Ok(())
}

fn chrono_iso_now() -> String {
    // Tiny ISO-8601 timestamp without pulling in `chrono`.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}
