// System Restore Point creator / restorer.
//
// Wraps `SRSetRestorePointW` (Win32, sysrestore.dll via the `windows` crate)
// so the React side can auto-create a checkpoint before any batch apply.
// Restore replay uses `WMI Win32_ShadowCopy` enumeration + the standard
// `rstrui.exe /OFFLINE` flow.

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct RestorePoint {
    pub sequence_number: i64,
    pub label: String,
    pub created_at: String,
}

/// The renderer-facing result of the launch safety check.  This is deliberately
/// a successful IPC response even when Windows cannot create a point: callers
/// need the exact recovery state rather than an opaque invoke rejection.
#[derive(Serialize, Clone, Debug)]
pub struct StartupRestoreResult {
    pub ok: bool,
    pub status: String,
    pub repair_attempted: bool,
    pub restore_point: Option<RestorePoint>,
    pub message: String,
    pub recovery: String,
}

/// Native mutation commands use this guard as a second line of defence
/// behind the renderer launch gate. Renderer state is never trusted here.
#[cfg(windows)]
pub fn require_verified_checkpoint() -> Result<(), String> {
    crate::win32::restore::ensure_session_checkpoint("Opti Gods Restore")
        .map(|_| ())
        .map_err(|error| format!("restore checkpoint required before mutation: {error:#}"))
}

#[tauri::command]
pub async fn create_restore_point(label: String) -> Result<RestorePoint, String> {
    #[cfg(windows)]
    {
        // Never claim a recoverable change unless Windows confirms that System
        // Restore is available first.
        crate::win32::restore::ensure_session_checkpoint(&label)
            .map_err(|e| format!("create_restore_point: {e:#}"))
    }
    #[cfg(not(windows))]
    {
        let _ = label;
        Err("create_restore_point is Windows-only.".into())
    }
}

#[tauri::command]
pub async fn list_restore_points() -> Result<Vec<RestorePoint>, String> {
    #[cfg(windows)]
    {
        crate::win32::restore::list().map_err(|e| format!("list_restore_points: {e:#}"))
    }
    #[cfg(not(windows))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn restore_to_point(sequence_number: i64) -> Result<(), String> {
    #[cfg(windows)]
    {
        crate::win32::restore::restore(sequence_number)
            .map_err(|e| format!("restore_to_point: {e:#}"))
    }
    #[cfg(not(windows))]
    {
        let _ = sequence_number;
        Err("restore_to_point is Windows-only.".into())
    }
}

/// Called once on app startup — creates the next numbered
/// "Opti Gods Restore N" checkpoint and verifies it through WMI.
///
/// Failures are returned as structured data so the renderer can block actions
/// and give the user an actionable recovery message.  The native apply command
/// remains the final safety backstop regardless of this result.
#[tauri::command]
pub async fn startup_restore_checkpoint() -> Result<StartupRestoreResult, String> {
    #[cfg(windows)]
    {
        // Do not attempt to change Windows policy automatically. The native
        // create-and-verify call is the only safe prerequisite for mutations.
        match crate::win32::restore::ensure_session_checkpoint("Opti Gods Restore") {
            Ok(rp) => {
                log::info!(
                    "[restore] startup checkpoint created — seq={} label={}",
                    rp.sequence_number,
                    rp.label
                );
                Ok(StartupRestoreResult {
                    ok: true,
                    status: "verified".into(),
                    repair_attempted: false,
                    restore_point: Some(rp),
                    message:
                        "System Protection is ready and the launch restore point was verified."
                            .into(),
                    recovery: "No action needed.".into(),
                })
            }
            Err(e) => {
                let detail = format!("{e:#}");
                log::error!("[restore] startup checkpoint failed: {detail}");
                let lower = detail.to_ascii_lowercase();
                let status = if lower.contains("enable") || lower.contains("policy") {
                    "protection_unavailable"
                } else if lower.contains("wmi") || lower.contains("visible") {
                    "verification_failed"
                } else {
                    "creation_failed"
                };
                Ok(StartupRestoreResult {
                    ok: false,
                    status: status.into(),
                    repair_attempted: false,
                    restore_point: None,
                    message: format!("System Protection could not be verified: {detail}"),
                    recovery: "Open System Protection for C: in Windows, enable it, then press Retry. If Windows still denies the request, launch Opti Gods with Run as administrator. No tweak was allowed to run.".into(),
                })
            }
        }
    }
    #[cfg(not(windows))]
    {
        Ok(StartupRestoreResult {
            ok: false,
            status: "unsupported".into(),
            repair_attempted: false,
            restore_point: None,
            message: "System Restore points are available only in the Windows desktop app.".into(),
            recovery: "Open Opti Gods on Windows to enable native tweaks safely.".into(),
        })
    }
}
