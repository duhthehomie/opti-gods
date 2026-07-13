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

/// Read a text file from an absolute path on disk.
/// Used by the HW Monitor drop zone: Tauri intercepts OS file drops and
/// delivers a file path; the frontend then calls this to get the content.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read_text_file({path}): {e}"))
}

/// Read the FiveM CitizenFX.log (tail 400 lines) to detect the current/last
/// connected server. Returns empty string if FiveM is not installed or log
/// is missing. Used by the dashboard to auto-add and auto-mark active servers.
#[tauri::command]
pub fn read_fivem_log() -> String {
    #[cfg(windows)]
    {
        let localappdata = match std::env::var("LOCALAPPDATA") {
            Ok(v) => v,
            Err(_) => return String::new(),
        };
        let log_path = format!(r"{}\FiveM\FiveM.app\logs\CitizenFX.log", localappdata);
        match std::fs::read_to_string(&log_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let start = lines.len().saturating_sub(400);
                lines[start..].join("\n")
            }
            Err(_) => String::new(),
        }
    }
    #[cfg(not(windows))]
    {
        String::new()
    }
}
