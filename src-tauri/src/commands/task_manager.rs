// Native task-manager commands for the Opti Gods desktop shell.
//
// scan_task_manager   — returns which known apps are running and in startup.
// kill_app            — terminates a process by image name (allowlisted).
// disable_startup_app — removes a startup entry from HKCU Run (allowlisted).
// get_startup_value   — reads current startup value (for undo).
//
// All write operations validate against a compile-time allowlist so the UI
// cannot be abused to kill or disable arbitrary system processes.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ── Allowlisted process names that kill_app may terminate ──────────────────
const ALLOWED_PROCESS_NAMES: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
    "steam.exe",
    "EpicGamesLauncher.exe",
    "Battle.net.exe",
    "EADesktop.exe",
    "upc.exe",
    "PlayGTAV.exe",
    "Discord.exe",
    "Teams.exe",
    "slack.exe",
    "Zoom.exe",
    "TeamViewer.exe",
    "OneDrive.exe",
    "Dropbox.exe",
    "googledrivefs.exe",
    "iCloudDrive.exe",
    "NVIDIA Share.exe",
    "RadeonSoftware.exe",
    "MSIAfterburner.exe",
    "RTSS.exe",
    "Spotify.exe",
    "iTunes.exe",
    "Creative Cloud.exe",
    "MBAMService.exe",
];

// ── Allowlisted startup registry key names ─────────────────────────────────
const ALLOWED_STARTUP_KEYS: &[&str] = &[
    "Google Chrome",
    "MicrosoftEdge",
    "Brave",
    "Steam",
    "EpicGamesLauncher",
    "Battle.net",
    "EADesktop",
    "Ubisoft Connect",
    "Rockstar Games Launcher",
    "Discord",
    "Teams",
    "com.squirrel.slack.slack",
    "Zoom",
    "TeamViewer",
    "OneDrive",
    "Dropbox",
    "GoogleDriveFS",
    "iCloud",
    "NvBackend",
    "AMD Radeon Software",
    "MSI Afterburner",
    "RTSS",
    "Spotify",
    "iTunes",
    "AdobeGCInvoker-1.0",
];

const RUN_KEY_HKCU: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_KEY_HKLM: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

// ─── Arg / return structs ───────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ScanArgs {
    /// app_id → process image name  e.g. {"tm_chrome": "chrome.exe"}
    pub process_map: HashMap<String, String>,
    /// app_id → startup registry key name  e.g. {"tm_chrome": "Google Chrome"}
    pub startup_map: HashMap<String, String>,
}

#[derive(Serialize, Debug)]
pub struct ScanResult {
    /// App IDs whose process is currently running
    pub running: Vec<String>,
    /// App IDs whose startup key exists in HKCU/HKLM Run
    pub in_startup: Vec<String>,
}

#[derive(Deserialize)]
pub struct KillArgs {
    pub process_name: String,
}

#[derive(Deserialize)]
pub struct StartupArgs {
    pub startup_key: String,
}

#[derive(Serialize)]
pub struct ActionResult {
    pub ok: bool,
    pub message: String,
}

// ─── Internal helpers (Windows-only) ────────────────────────────────────────

#[cfg(windows)]
fn running_process_names_lower() -> HashSet<String> {
    // tasklist /FO CSV /NH: one quoted CSV line per process.
    // First field (quoted) is the image name.
    let out = std::process::Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output();
    match out {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout);
            text.lines()
                .filter_map(|line| {
                    let s = line.trim_start_matches('"');
                    let end = s.find('"')?;
                    Some(s[..end].to_lowercase())
                })
                .collect()
        }
        Err(_) => HashSet::new(),
    }
}

#[cfg(windows)]
fn existing_startup_keys_lower() -> HashSet<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    let mut keys = HashSet::new();

    if let Ok(k) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY_HKCU, KEY_READ)
    {
        for name in k.enum_values().filter_map(|r| r.ok()).map(|(n, _)| n) {
            keys.insert(name.to_lowercase());
        }
    }
    if let Ok(k) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(RUN_KEY_HKLM, KEY_READ)
    {
        for name in k.enum_values().filter_map(|r| r.ok()).map(|(n, _)| n) {
            keys.insert(name.to_lowercase());
        }
    }
    keys
}

// ─── Tauri commands ─────────────────────────────────────────────────────────

/// Scan the system and return which known apps are currently running and which
/// are registered in the Windows startup registry.
#[tauri::command]
pub fn scan_task_manager(args: ScanArgs) -> ScanResult {
    #[cfg(windows)]
    {
        let running_now = running_process_names_lower();
        let startup_now = existing_startup_keys_lower();

        let running = args
            .process_map
            .iter()
            .filter(|(_, proc)| running_now.contains(&proc.to_lowercase()))
            .map(|(id, _)| id.clone())
            .collect();

        let in_startup = args
            .startup_map
            .iter()
            .filter(|(_, key)| startup_now.contains(&key.to_lowercase()))
            .map(|(id, _)| id.clone())
            .collect();

        ScanResult { running, in_startup }
    }
    #[cfg(not(windows))]
    {
        let _ = args;
        ScanResult {
            running: vec![],
            in_startup: vec![],
        }
    }
}

/// Forcibly terminate a process by image name.
/// The name must be in ALLOWED_PROCESS_NAMES.
#[tauri::command]
pub fn kill_app(args: KillArgs) -> ActionResult {
    let name = args.process_name.trim().to_string();

    if !ALLOWED_PROCESS_NAMES
        .iter()
        .any(|&a| a.eq_ignore_ascii_case(&name))
    {
        return ActionResult {
            ok: false,
            message: format!("'{}' is not in the kill allowlist.", name),
        };
    }

    #[cfg(windows)]
    {
        let out = std::process::Command::new("taskkill")
            .args(["/F", "/IM", &name])
            .output();

        match out {
            Ok(o) if o.status.success() => ActionResult {
                ok: true,
                message: format!("{} terminated.", name),
            },
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr).to_lowercase();
                let stdout = String::from_utf8_lossy(&o.stdout).to_lowercase();
                let combined = format!("{stderr}{stdout}");
                // "not found" / "no tasks" means the process wasn't running — treat as success.
                if combined.contains("not found")
                    || combined.contains("no tasks")
                    || combined.contains("not running")
                {
                    ActionResult {
                        ok: true,
                        message: format!("{} was not running.", name),
                    }
                } else {
                    ActionResult {
                        ok: false,
                        message: String::from_utf8_lossy(&o.stderr).trim().to_string(),
                    }
                }
            }
            Err(e) => ActionResult {
                ok: false,
                message: e.to_string(),
            },
        }
    }
    #[cfg(not(windows))]
    {
        ActionResult {
            ok: false,
            message: "kill_app is Windows-only.".into(),
        }
    }
}

/// Remove a startup registry entry from HKCU Run.
/// The key name must be in ALLOWED_STARTUP_KEYS.
#[tauri::command]
pub fn disable_startup_app(args: StartupArgs) -> ActionResult {
    let key = args.startup_key.trim().to_string();

    if !ALLOWED_STARTUP_KEYS
        .iter()
        .any(|&a| a.eq_ignore_ascii_case(&key))
    {
        return ActionResult {
            ok: false,
            message: format!("'{}' is not in the startup allowlist.", key),
        };
    }

    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
        use winreg::RegKey;

        match RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN_KEY_HKCU, KEY_READ | KEY_SET_VALUE)
        {
            Ok(run_key) => {
                let existing: Result<String, _> = run_key.get_value(&key);
                if existing.is_err() {
                    return ActionResult {
                        ok: true,
                        message: format!("'{}' was not in startup.", key),
                    };
                }
                match run_key.delete_value(&key) {
                    Ok(_) => ActionResult {
                        ok: true,
                        message: format!("'{}' removed from startup.", key),
                    },
                    Err(e) => ActionResult {
                        ok: false,
                        message: e.to_string(),
                    },
                }
            }
            Err(e) => ActionResult {
                ok: false,
                message: e.to_string(),
            },
        }
    }
    #[cfg(not(windows))]
    {
        ActionResult {
            ok: false,
            message: "disable_startup_app is Windows-only.".into(),
        }
    }
}

/// Read the current value of a HKCU Run entry (used for undo).
#[tauri::command]
pub fn get_startup_value(args: StartupArgs) -> Option<String> {
    let key = args.startup_key.trim().to_string();

    if !ALLOWED_STARTUP_KEYS
        .iter()
        .any(|&a| a.eq_ignore_ascii_case(&key))
    {
        return None;
    }

    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
        use winreg::RegKey;

        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN_KEY_HKCU, KEY_READ)
            .ok()
            .and_then(|k| k.get_value::<String, _>(&key).ok())
    }
    #[cfg(not(windows))]
    {
        None
    }
}
