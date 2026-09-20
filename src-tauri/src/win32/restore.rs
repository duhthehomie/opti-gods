// System Restore Point creator + lister + restorer.
//
// `SRSetRestorePointW` is exported by SrClient.dll. The `windows` crate
// surfaces it under Win32::System::Restore. Listing existing checkpoints
// uses the SystemRestore WMI namespace (`root\default`). Replay uses
// rstrui.exe which is the only supported user-facing path on modern Windows.

use crate::commands::restore::RestorePoint;
use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::mem::size_of;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use windows::core::{w, PCSTR};
use windows::Win32::Foundation::{FreeLibrary, LocalFree, BOOL, HLOCAL, RPC_E_TOO_LATE};
use windows::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows::Win32::Security::{MakeAbsoluteSD, ACL, PSECURITY_DESCRIPTOR, PSID};
use windows::Win32::System::Com::{
    CoInitializeEx, CoInitializeSecurity, CoUninitialize, COINIT_MULTITHREADED, EOAC_NONE,
    RPC_C_AUTHN_LEVEL_DEFAULT, RPC_C_IMP_LEVEL_IMPERSONATE,
};
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
use windows::Win32::System::Restore::{
    BEGIN_SYSTEM_CHANGE, END_SYSTEM_CHANGE, MODIFY_SETTINGS, RESTOREPOINTINFOW, STATEMGRSTATUS,
};
use wmi::{COMLibrary, WMIConnection};

/// SRSetRestorePointW requires COM security to be initialized before it is
/// called. The System Restore service calls back into this process as
/// NetworkService, LocalService, and LocalSystem, so a null/default descriptor
/// is not sufficient: Windows rejects the callback with ERROR_ACCESS_DENIED.
///
/// This SDDL is the descriptor Microsoft uses in its System Restore sample.
/// It grants only COM execute + local execute to the service identities and
/// the Administrators group. Windows returns RPC_E_TOO_LATE when another
/// component already initialized process COM security; that is safe to accept
/// because the process already has a policy.
fn ensure_com_security() -> Result<()> {
    static INITIALIZATION_ERROR: OnceLock<Option<String>> = OnceLock::new();
    let error = INITIALIZATION_ERROR.get_or_init(|| {
        // A Tauri/WebView thread can already be STA. Use a fresh thread so
        // CoInitializeEx cannot silently return RPC_E_CHANGED_MODE and leave
        // the process with an unverified COM apartment/security policy.
        let worker = thread::Builder::new()
            .name("optigods-com-security".into())
            .spawn(|| unsafe {
                // Microsoft initializes COM before CoInitializeSecurity in its
                // SRSetRestorePoint sample. Do this before WMI gets a chance to
                // initialize the apartment with a default security policy.
                let com_result = CoInitializeEx(None, COINIT_MULTITHREADED);
                if !com_result.is_ok() {
                    return Some(format!(
                        "CoInitializeEx failed (HRESULT {:#x})",
                        com_result.0
                    ));
                }

                let mut security_descriptor = PSECURITY_DESCRIPTOR::default();
                // 0x3 = COM_RIGHTS_EXECUTE | COM_RIGHTS_EXECUTE_LOCAL.
                // System Restore calls back as LocalSystem, NetworkService,
                // LocalService, or an administrator while opening the point.
                let descriptor =
                    w!("O:BAG:BAD:(A;;0x3;;;LS)(A;;0x3;;;NS)(A;;0x3;;;PS)(A;;0x3;;;SY)(A;;0x3;;;BA)");
                if let Err(error) = ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    descriptor,
                    SDDL_REVISION_1,
                    &mut security_descriptor,
                    None,
                ) {
                    CoUninitialize();
                    return Some(format!(
                        "ConvertStringSecurityDescriptorToSecurityDescriptorW failed (HRESULT {:#x})",
                        error.code().0
                    ));
                }

                // ConvertStringSecurityDescriptorToSecurityDescriptorW returns
                // a self-relative descriptor. CoInitializeSecurity requires an
                // absolute descriptor; passing the converted pointer directly
                // produces HRESULT_FROM_WIN32(ERROR_BAD_DESCRIPTOR_FORMAT)
                // (0x80070551), even when System Protection is enabled.
                let mut absolute_size = 0u32;
                let mut dacl_size = 0u32;
                let mut sacl_size = 0u32;
                let mut owner_size = 0u32;
                let mut primary_group_size = 0u32;
                let _ = MakeAbsoluteSD(
                    security_descriptor,
                    PSECURITY_DESCRIPTOR::default(),
                    &mut absolute_size,
                    None,
                    &mut dacl_size,
                    None,
                    &mut sacl_size,
                    PSID::default(),
                    &mut owner_size,
                    PSID::default(),
                    &mut primary_group_size,
                );
                if absolute_size == 0 {
                    let _ = LocalFree(HLOCAL(security_descriptor.0));
                    CoUninitialize();
                    return Some("MakeAbsoluteSD did not return a descriptor size".into());
                }

                let words = |bytes: u32| {
                    (bytes as usize).div_ceil(size_of::<usize>())
                };
                let mut absolute_buffer = vec![0usize; words(absolute_size)];
                let mut dacl_buffer = vec![0usize; words(dacl_size)];
                let mut sacl_buffer = vec![0usize; words(sacl_size)];
                let mut owner_buffer = vec![0usize; words(owner_size)];
                let mut primary_group_buffer = vec![0usize; words(primary_group_size)];
                let absolute_descriptor =
                    PSECURITY_DESCRIPTOR(absolute_buffer.as_mut_ptr().cast());
                let dacl = (dacl_size > 0)
                    .then(|| dacl_buffer.as_mut_ptr().cast::<ACL>());
                let sacl = (sacl_size > 0)
                    .then(|| sacl_buffer.as_mut_ptr().cast::<ACL>());
                let owner = if owner_size > 0 {
                    PSID(owner_buffer.as_mut_ptr().cast())
                } else {
                    PSID::default()
                };
                let primary_group = if primary_group_size > 0 {
                    PSID(primary_group_buffer.as_mut_ptr().cast())
                } else {
                    PSID::default()
                };
                if let Err(error) = MakeAbsoluteSD(
                    security_descriptor,
                    absolute_descriptor,
                    &mut absolute_size,
                    dacl,
                    &mut dacl_size,
                    sacl,
                    &mut sacl_size,
                    owner,
                    &mut owner_size,
                    primary_group,
                    &mut primary_group_size,
                ) {
                    let _ = LocalFree(HLOCAL(security_descriptor.0));
                    CoUninitialize();
                    return Some(format!(
                        "MakeAbsoluteSD failed (HRESULT {:#x})",
                        error.code().0
                    ));
                }

                let result = CoInitializeSecurity(
                    absolute_descriptor,
                    -1,
                    None,
                    None,
                    RPC_C_AUTHN_LEVEL_DEFAULT,
                    RPC_C_IMP_LEVEL_IMPERSONATE,
                    None,
                    EOAC_NONE,
                    None,
                );
                // The descriptor is copied by COM during CoInitializeSecurity.
                let _ = LocalFree(HLOCAL(security_descriptor.0));
                CoUninitialize();

                match result {
                    Ok(()) => None,
                    // Do not treat an unknown pre-existing policy as safe:
                    // it may be exactly the default ACL that caused 0x5.
                    Err(error) if error.code() == RPC_E_TOO_LATE => Some(
                        "CoInitializeSecurity was already called with an unverified policy (RPC_E_TOO_LATE)"
                            .into(),
                    ),
                    Err(error) => Some(format!(
                        "CoInitializeSecurity failed (HRESULT {:#x})",
                        error.code().0
                    )),
                }
            })
            .map_err(|error| format!("COM security thread failed to start: {error}"));
        match worker {
            Ok(worker) => match worker.join() {
                Ok(error) => error,
                Err(_) => Some("COM security thread panicked".into()),
            },
            Err(error) => Some(error),
        }
    });
    if let Some(error) = error {
        return Err(anyhow!(error));
    }
    Ok(())
}

/// Must run before any WMI or WebView code can initialize COM security.
pub fn initialize_com_security() -> Result<()> {
    ensure_com_security()
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

    let module =
        unsafe { LoadLibraryW(w!("SrClient.dll")) }.context("LoadLibraryW(SrClient.dll)")?;
    let procedure = match unsafe { GetProcAddress(module, PCSTR(b"SRSetRestorePointW\0".as_ptr())) }
    {
        Some(procedure) => procedure,
        None => {
            unsafe {
                let _ = FreeLibrary(module);
            }
            return Err(anyhow!("GetProcAddress(SRSetRestorePointW) failed"));
        }
    };
    let function: SrSetRestorePointW = unsafe { std::mem::transmute(procedure) };
    let result = unsafe { function(restore_point, status) };
    unsafe {
        let _ = FreeLibrary(module);
    }
    Ok(result)
}

/// Windows exposes the same supported restore-point operation through the
/// built-in PowerShell cmdlet. Some Windows installations reject the direct
/// SRSetRestorePointW call with ERROR_ACCESS_DENIED even when System
/// Protection is enabled. Use the cmdlet only as a narrow fallback, and still
/// require WMI to verify the exact point before allowing any mutation.
fn create_via_powershell(label: &str) -> Result<RestorePoint> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$label = $env:OPTIGODS_RESTORE_LABEL
Checkpoint-Computer -Description $label -RestorePointType MODIFY_SETTINGS
$point = Get-ComputerRestorePoint |
    Where-Object { $_.Description -eq $label } |
    Sort-Object SequenceNumber -Descending |
    Select-Object -First 1
if (-not $point) {
    throw "Checkpoint-Computer completed without a matching restore point"
}
[Console]::Out.WriteLine([int64]$point.SequenceNumber)
"#;
    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ])
        .env("OPTIGODS_RESTORE_LABEL", label)
        .output()
        .context("launching PowerShell Checkpoint-Computer fallback")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let detail = stderr.trim();
        let detail = if detail.is_empty() {
            stdout.trim()
        } else {
            detail
        };
        return Err(anyhow!(
            "Checkpoint-Computer failed with exit code {}{}",
            output.status.code().unwrap_or(-1),
            if detail.is_empty() {
                String::new()
            } else {
                format!(": {detail}")
            }
        ));
    }
    let sequence_number = stdout
        .lines()
        .rev()
        .find_map(|line| line.trim().parse::<i64>().ok())
        .filter(|sequence| *sequence > 0)
        .ok_or_else(|| anyhow!("Checkpoint-Computer returned no restore-point sequence"))?;
    let point = RestorePoint {
        sequence_number,
        label: label.to_string(),
        created_at: chrono_iso_now(),
    };
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
        "PowerShell created checkpoint #{} but WMI could not verify it",
        point.sequence_number
    ))
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
    if !ok.as_bool() || begin_status.nStatus.0 != 0 || begin_status.llSequenceNumber <= 0 {
        let status_code = begin_status.nStatus.0;
        let seq = begin_status.llSequenceNumber;
        if status_code == 5 {
            return create_via_powershell(label).map_err(|fallback| {
                anyhow!(
                    "SRSetRestorePointW(BEGIN) failed (status={:#x}, seq={}); PowerShell fallback failed: {fallback:#}",
                    status_code,
                    seq
                )
            });
        }
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
    if !ok.as_bool()
        || end_status.nStatus.0 != 0
        || end_status.llSequenceNumber != begin_status.llSequenceNumber
    {
        let status_code = end_status.nStatus.0;
        let seq = end_status.llSequenceNumber;
        return Err(anyhow!(
            "SRSetRestorePointW(END) failed (status={:#x}, seq={})",
            status_code,
            seq
        ));
    }

    let point = RestorePoint {
        sequence_number: end_status.llSequenceNumber,
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
pub fn ensure_session_checkpoint(requested_label: &str) -> Result<RestorePoint> {
    // This must happen before list() initializes WMI/COM. If WMI initializes
    // first, CoInitializeSecurity returns RPC_E_TOO_LATE and the System
    // Restore service cannot call back into this process.
    ensure_com_security()?;
    let state = SESSION_CHECKPOINT.get_or_init(|| Mutex::new(None));
    let mut checkpoint = state
        .lock()
        .map_err(|_| anyhow!("restore checkpoint lock was poisoned"))?;
    if let Some(existing) = checkpoint.clone() {
        let still_present = list()?
            .iter()
            .any(|candidate| candidate.sequence_number == existing.sequence_number);
        if still_present {
            return Ok(existing);
        }
        *checkpoint = None;
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
    let requested_label = requested_label.trim();
    let label = if requested_label.is_empty() || requested_label == "Opti Gods Restore" {
        format!("Opti Gods Restore {next_number}")
    } else {
        requested_label.to_string()
    };
    let created = create(&label)?;
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
    // Keep the WMI listing path from being the first COM user in the process.
    ensure_com_security()?;
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
    let arg = format!("/OFFLINE:C:\\Windows=ACTIVE&id={sequence_number}");
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
