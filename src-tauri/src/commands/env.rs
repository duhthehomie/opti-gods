// Tiny "what environment am I in?" probe used by the React bridge to flip
// between native invoke() and the legacy PowerShell download flow.

use serde::Serialize;

#[derive(Serialize)]
pub struct EnvInfo {
    pub native: bool,
    pub platform: &'static str,
    pub app_version: &'static str,
    pub is_admin: bool,
}

#[tauri::command]
pub fn env_info() -> EnvInfo {
    EnvInfo {
        native: true,
        platform: std::env::consts::OS,
        app_version: env!("CARGO_PKG_VERSION"),
        is_admin: is_elevated(),
    }
}

#[cfg(windows)]
fn is_elevated() -> bool {
    // We requested requireAdministrator in app.manifest, so if the process is
    // running at all on a UAC-protected system it's elevated. We still
    // double-check via the access token integrity level just to be safe.
    crate::win32::elevation::is_elevated().unwrap_or(false)
}

#[cfg(not(windows))]
fn is_elevated() -> bool {
    false
}
