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
use windows::Win32::Foundation::{BOOL, RPC_E_TOO_LATE};
use windows::Win32::System::Com::{
    CoInitializeSecurity, EOAC_NONE, RPC_C_AUTHN_LEVEL_DEFAULT, RPC_C_IMP_LEVEL_IMPERSONATE,
};
use windows::Win32::System::Restore::{
    BEGIN_SYSTEM_CHANGE, END_SYSTEM_CHANGE, MODIFY_SETTINGS, RESTOREPOINTINFOW, STATEMGRSTATUS,
};
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
use windows::core::{w, PCSTR};
use wmi::{COMLibrary, WMIConnection};

/// SRSetRestorePointW requires COM security to be initialized before it is
/// called. WMI may initialize COM on a worker thread, but that does not
/// satisfy the System Restore callback requirement. Windows returns
/// RPC_E_TOO_LATE when another component already initialized process COM
/// security; that is safe to accept because the process already has a policy.
fn ensure_com_security() -> Result<()> {
    static INITIALIZATION_ERROR: OnceLock<Option<String>> = OnceLock::new();
    let error = INITIALIZATION_ERROR.get_or_init(|| unsafe {
        match CoInitializeSecurity(
            None,
            -1,
            None,
            None,
            RPC_C_AUTHN_LEVEL_DEFAULT,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_NONE,
            None,
        ) {
            Ok(()) => None,
            Err(error) if error.code() == RPC_E_TOO_LATE => None,
            Err(error) => Some(format!(
                "CoInitializeSecurity failed (HRESULT {:#x})",
                error.code().0
            )),
        }
    });
    if let Some(error) = error {
        return Err(anyhow!(error));
    }
    Ok(())
}

/// Microsoft documents SrClient.dll as the runtime provider for
/// SRSetRestorePointW and recommends resolving it dynamically. Do that
/// explicitly instead of relying on the generated import library metadata.
fn set_restore_point(
    restore_point: &RESTOREPOINTINFOW,
    status: &mut STATEMGRSTATUS,
) -> Result<BOOL> {
    type SrSetRestorePointW =
        unsafe extern "system" fn(*const RESTOREPOINTINFOW, *mut STATEMGRSTATUS) -> BOOL;

    let module = unsafe { LoadLibraryW(w!("SrClient.dll")) }
        .context("LoadLibraryW(SrClient.dll)")?;
    let procedure = unsafe { GetProcAddress(module, PCSTR(b"SRSetRestorePointW\0".as_ptr())) }
        .ok_or_else(|| anyhow!("GetProcAddress(SRSetRestorePointW) failed"))?;
    let function: SrSetRestorePointW = unsafe { std::mem::transmute(procedure) };
    Ok(unsafe { function(restore_point, status) })
}

pub fn create(label: &str) -> Result<RestorePoint> {
    ensure_com_security()?;
    // SRSetRestorePointW expects a 64-char description in a fixed-size buffer.
    let mut desc = [0u16; 256];
    for (i, c) in label.encode_utf16().take(63).enumerate() {
        desc[i] = c;
    }
    // Phase 1 — BEGIN_SYSTEM_CHANGE opens the checkpoint and gives us
    // the sequence number we need to finalise it.
    let mut begin_info = RESTOREPOINTINFOW {
        dwEventType: BEGIN_SYSTEM_CHANGE,
        dwRestorePtType: MODIFY_SETTINGS,
        llSequenceNumber: 0,
        szDescription: desc,
    };
    let mut begin_status = STATEMGRSTATUS::default();
    let ok = set_restore_point(&begin_info, &mut begin_status)?;
    if !ok.as_bool() {
        let status_code = begin_status.nStatus.0;
        let seq = begin_status.llSequenceNumber;
        return Err(anyhow!(
            "SRSetRestorePointW(BEGIN) failed (status={:#x}, seq={})",
            status_code,
            seq
        ));
    }

    // Phase 2 — END_SYSTEM_CHANGE finalises the checkpoint Windows
    // opened in phase 1. Without this the restore point is never committed
    // and won't appear in `rstrui.exe` / `vssadmin list shadows`.
    let mut end_info = RESTOREPOINTINFOW {
        dwEventType: END_SYSTEM_CHANGE,
        dwRestorePtType: MODIFY_SETTINGS,
        llSequenceNumber: begin_status.llSequenceNumber,
        szDescription: desc,
    };
    let mut end_status = STATEMGRSTATUS::default();
    let ok = set_restore_point(&end_info, &mut end_status)?;
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
    // WMI often trails SRSetRestorePointW by several seconds on Windows 10.
    for _ in 0..20 {
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
        thread::sleep(Duration::from_millis(500));
    }
    Err(anyhow!(
        "Windows created checkpoint #{} but it was not visible in System Restore",
        point.sequence_number
    ))
}

static SESSION_CHECKPOINT: OnceLock<Mutex<Option<RestorePoint>>> = OnceLock::new();

/// Guarantees that this desktop-app process has created and WMI-verified a
/// restore point. Renderer state cannot bypass this guard.
pub fn ensure_session_checkpoint(_requested_label: &str) -> Result<RestorePoint> {
    let state = SESSION_CHECKPOINT.get_or_init(|| Mutex::new(None));
    let mut checkpoint = state
        .lock()
        .map_err(|_| anyhow!("restore checkpoint lock was poisoned"))?;
    if let Some(existing) = checkpoint.clone() {
        return Ok(existing);
    }
    // Keep the actual create-and-WMI-verify operation in the native backstop.
    // A renderer event/session flag must never be enough to authorize a
    // mutation. Do not call Enable-ComputerRestore here: Windows can reject
    // that repair command even when the supported restore-point API itself is
    // usable, and the repair attempt used to block every launch.
    let next_number = list()
        .unwrap_or_default()
        .iter()
        .filter_map(|point| {
            point
                .label
                .strip_prefix("Opti Gods Restore ")
                .and_then(|value| value.trim().parse::<u32>().ok())
        })
        .max()
        .unwrap_or(0)
        .saturating_add(1);
    let created = create(&format!("Opti Gods Restore {next_number}"))?;
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

fn chrono_iso_now() -> String {
    // Tiny ISO-8601 timestamp without pulling in `chrono`.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}
