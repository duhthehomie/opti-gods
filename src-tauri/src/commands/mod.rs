// Tauri command surface — every #[tauri::command] the React app can call.
// Each module is self-contained and returns serde-serialisable results.

pub mod discord;
pub mod env;
pub mod game_detection;
pub mod hardware;
pub mod performance;
pub mod actions;
pub mod misc;
pub mod process_lasso;
pub mod power;
pub mod restore;
pub mod splash;
pub mod task_manager;
pub mod tweaks;
pub mod updater;

#[cfg(windows)]
pub(crate) fn windows_powershell_executable() -> std::path::PathBuf {
    let windows_dir = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    let system_directory = if std::env::var_os("PROCESSOR_ARCHITEW6432").is_some() {
        "Sysnative"
    } else {
        "System32"
    };
    std::path::PathBuf::from(windows_dir)
        .join(system_directory)
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe")
}
