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

#[tauri::command]
pub async fn create_restore_point(label: String) -> Result<RestorePoint, String> {
    #[cfg(windows)]
    {
        crate::win32::restore::create(&label).map_err(|e| format!("create_restore_point: {e:#}"))
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
