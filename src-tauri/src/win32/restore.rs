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

    Ok(RestorePoint {
        sequence_number: begin_status.llSequenceNumber,
        label: label.to_string(),
        created_at: chrono_iso_now(),
    })
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
