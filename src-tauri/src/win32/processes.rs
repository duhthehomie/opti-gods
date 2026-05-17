// Process enumeration + priority/affinity overrides used by the
// ProBalance replacement (`commands::process_lasso`).

use anyhow::{Context, Result};
use std::collections::HashSet;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    OpenProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS,
    PROCESS_QUERY_INFORMATION, PROCESS_SET_INFORMATION,
};

/// Enumerates running processes and returns the first whitelisted .exe name we find.
pub fn find_running(whitelist: &[&str]) -> Option<String> {
    let names = enumerate().ok()?;
    let lower: HashSet<String> = whitelist.iter().map(|s| s.to_ascii_lowercase()).collect();
    names
        .into_iter()
        .find(|(name, _pid)| lower.contains(&name.to_ascii_lowercase()))
        .map(|(name, _)| name)
}

pub fn enumerate() -> Result<Vec<(String, u32)>> {
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .context("CreateToolhelp32Snapshot")?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut out = Vec::new();
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                // szExeFile is a fixed [u16; 260] block. Find the null terminator.
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                out.push((name, entry.th32ProcessID));
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
        Ok(out)
    }
}

/// Boosts the running game to HIGH priority and demotes every other userland
/// process to BELOW_NORMAL. This is the same heuristic Process Lasso's
/// ProBalance uses — short, additive, idempotent.
pub fn apply_pro_balance(game_exe: &str, whitelist: &[&str]) -> Result<()> {
    let processes = enumerate()?;
    let lower_whitelist: HashSet<String> =
        whitelist.iter().map(|s| s.to_ascii_lowercase()).collect();
    let game_lower = game_exe.to_ascii_lowercase();
    for (name, pid) in processes {
        // Skip System (4), Idle (0), and our own process.
        if pid < 8 {
            continue;
        }
        let lower = name.to_ascii_lowercase();
        let priority = if lower == game_lower {
            HIGH_PRIORITY_CLASS
        } else if lower_whitelist.contains(&lower) {
            // Another whitelisted game (rare, e.g. launcher). Leave alone.
            continue;
        } else {
            BELOW_NORMAL_PRIORITY_CLASS
        };
        unsafe {
            let handle: HANDLE = match OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_SET_INFORMATION,
                false,
                pid,
            ) {
                Ok(h) => h,
                Err(_) => continue, // protected process, skip silently
            };
            let _ = SetPriorityClass(handle, priority);
            let _ = CloseHandle(handle);
        }
    }
    Ok(())
}
