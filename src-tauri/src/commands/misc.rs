// Miscellaneous utility commands for the Opti Gods desktop shell.

/// Opens the user's Downloads folder in Windows Explorer.
/// Safe: no user-supplied paths — always opens the well-known shell folder.
#[tauri::command]
pub fn open_downloads() {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer.exe")
            .arg("shell:Downloads")
            .spawn();
    }
}
