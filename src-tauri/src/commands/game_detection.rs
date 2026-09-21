//! Trusted installed-game discovery.
//!
//! The renderer cannot supply paths or executable names. This module owns the
//! supported-game catalog and only inspects Windows storefront metadata,
//! uninstall records, and fixed launcher/user directories.

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Serialize, Debug, Clone)]
pub struct InstalledGame {
    pub id: String,
    pub executable: String,
    pub install_path: String,
    pub source: String,
    pub running: bool,
}

struct GameSpec {
    id: &'static str,
    executables: &'static [&'static str],
    names: &'static [&'static str],
    known_paths: &'static [&'static str],
}

const GAMES: &[GameSpec] = &[
    GameSpec { id: "game_valorant", executables: &["VALORANT-Win64-Shipping.exe"], names: &["valorant"], known_paths: &["%LOCALAPPDATA%\\VALORANT", "C:\\Riot Games\\VALORANT"] },
    GameSpec { id: "game_cod", executables: &["cod.exe", "BlackOps6.exe", "ModernWarfare.exe"], names: &["call of duty", "modern warfare", "black ops"], known_paths: &[] },
    GameSpec { id: "game_warzone", executables: &["cod.exe", "warzone.exe"], names: &["call of duty", "warzone"], known_paths: &[] },
    GameSpec { id: "game_apex", executables: &["r5apex.exe", "r5apex_dx12.exe"], names: &["apex legends"], known_paths: &[] },
    GameSpec { id: "game_lol", executables: &["League of Legends.exe", "LeagueClient.exe"], names: &["league of legends"], known_paths: &["C:\\Riot Games\\League of Legends"] },
    GameSpec { id: "game_overwatch", executables: &["Overwatch.exe"], names: &["overwatch"], known_paths: &[] },
    GameSpec { id: "game_siege", executables: &["RainbowSix.exe", "RainbowSix_Vulkan.exe"], names: &["rainbow six siege", "tom clancy's rainbow six"], known_paths: &[] },
    GameSpec { id: "game_rust", executables: &["RustClient.exe"], names: &["rust"], known_paths: &[] },
    GameSpec { id: "game_minecraft", executables: &["MinecraftLauncher.exe", "Minecraft.exe"], names: &["minecraft"], known_paths: &["%APPDATA%\\.minecraft", "%PROGRAMFILES(X86)%\\Minecraft Launcher"] },
    GameSpec { id: "game_roblox", executables: &["RobloxPlayerBeta.exe", "Roblox.exe"], names: &["roblox"], known_paths: &["%LOCALAPPDATA%\\Roblox"] },
    GameSpec { id: "game_tarkov", executables: &["EscapeFromTarkov.exe"], names: &["escape from tarkov"], known_paths: &["C:\\Battlestate Games\\EFT", "C:\\Games\\EFT"] },
    GameSpec { id: "game_pubg", executables: &["TslGame.exe"], names: &["pubg", "battlegrounds"], known_paths: &[] },
    GameSpec { id: "game_dbd", executables: &["DeadByDaylight-Win64-Shipping.exe"], names: &["dead by daylight"], known_paths: &[] },
    GameSpec { id: "game_dota2", executables: &["dota2.exe"], names: &["dota 2"], known_paths: &[] },
    GameSpec { id: "game_warframe", executables: &["Warframe.x64.exe"], names: &["warframe"], known_paths: &["%LOCALAPPDATA%\\Warframe"] },
    GameSpec { id: "game_forza", executables: &["ForzaHorizon5.exe"], names: &["forza horizon 5"], known_paths: &[] },
    GameSpec { id: "game_readyornot", executables: &["ReadyOrNot.exe", "ReadyOrNot-Win64-Shipping.exe"], names: &["ready or not"], known_paths: &[] },
    GameSpec { id: "game_phasmo", executables: &["Phasmophobia.exe"], names: &["phasmophobia"], known_paths: &[] },
    GameSpec { id: "game_battlefield", executables: &["BF2042.exe"], names: &["battlefield 2042"], known_paths: &[] },
    GameSpec { id: "game_gta5", executables: &["GTA5.exe", "PlayGTAV.exe"], names: &["grand theft auto v", "gta v"], known_paths: &[] },
    GameSpec { id: "game_fivem", executables: &["FiveM.exe"], names: &["fivem"], known_paths: &["%LOCALAPPDATA%\\FiveM"] },
    GameSpec { id: "game_rocketleague", executables: &["RocketLeague.exe"], names: &["rocket league"], known_paths: &[] },
    GameSpec { id: "game_arcraiders", executables: &["ARC-Win64-Shipping.exe", "ARC.exe"], names: &["arc raiders"], known_paths: &[] },
    GameSpec { id: "game_007firstlight", executables: &["007FirstLight.exe", "007FirstLight-Win64-Shipping.exe"], names: &["007 first light"], known_paths: &[] },
    GameSpec { id: "game_fortnite", executables: &["FortniteClient-Win64-Shipping.exe"], names: &["fortnite"], known_paths: &[] },
    GameSpec { id: "game_marvelrivals", executables: &["MarvelRivals-Win64-Shipping.exe"], names: &["marvel rivals"], known_paths: &[] },
];

#[cfg(windows)]
fn expand_env_path(value: &str) -> PathBuf {
    let mut expanded = value.to_string();
    for key in ["LOCALAPPDATA", "APPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMDATA"] {
        if let Ok(v) = std::env::var(key) {
            expanded = expanded.replace(&format!("%{key}%"), &v);
        }
    }
    PathBuf::from(expanded)
}

#[cfg(windows)]
fn find_executable(root: &Path, names: &[&str], max_depth: usize) -> Option<PathBuf> {
    if !root.exists() { return None; }
    if root.is_file() {
        let file = root.file_name()?.to_string_lossy();
        return names.iter().any(|n| file.eq_ignore_ascii_case(n)).then(|| root.to_path_buf());
    }
    let wanted: HashSet<String> = names.iter().map(|n| n.to_lowercase()).collect();
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if path.file_name().map(|n| wanted.contains(&n.to_string_lossy().to_lowercase())).unwrap_or(false) {
                    return Some(path);
                }
            } else if depth < max_depth {
                stack.push((path, depth + 1));
            }
        }
    }
    None
}

#[cfg(windows)]
fn steam_libraries() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;
    let mut roots = Vec::new();
    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ) {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") { roots.push(PathBuf::from(path)); }
    }
    if roots.is_empty() { roots.push(expand_env_path(r"%PROGRAMFILES(X86)%\Steam")); }
    let mut all = roots.clone();
    for root in roots {
        let Ok(text) = std::fs::read_to_string(root.join("steamapps").join("libraryfolders.vdf")) else { continue };
        for line in text.lines() {
            if !line.to_lowercase().contains("\"path\"") { continue; }
            let quoted: Vec<&str> = line.split('"').collect();
            if quoted.len() >= 4 { all.push(PathBuf::from(quoted[3].replace("\\\\", "\\"))); }
        }
    }
    all.sort();
    all.dedup();
    all
}

#[cfg(windows)]
fn candidates_from_steam() -> Vec<(String, PathBuf, String)> {
    let mut found = Vec::new();
    for root in steam_libraries() {
        let steamapps = root.join("steamapps");
        let Ok(entries) = std::fs::read_dir(&steamapps) else { continue };
        for entry in entries.flatten() {
            let file = entry.file_name().to_string_lossy().to_string();
            if !file.starts_with("appmanifest_") || !file.ends_with(".acf") { continue; }
            let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
            let mut name = String::new();
            let mut install_dir = String::new();
            for line in text.lines() {
                let parts: Vec<&str> = line.split('"').collect();
                if parts.len() < 4 { continue; }
                match parts[1].to_lowercase().as_str() {
                    "name" => name = parts[3].to_string(),
                    "installdir" => install_dir = parts[3].to_string(),
                    _ => {}
                }
            }
            if !install_dir.is_empty() {
                found.push((name, steamapps.join("common").join(install_dir), "Steam".into()));
            }
        }
    }
    found
}

#[cfg(windows)]
fn candidates_from_epic() -> Vec<(String, PathBuf, String)> {
    let mut found = Vec::new();
    let manifests = expand_env_path(r"%PROGRAMDATA%\Epic\EpicGamesLauncher\Data\Manifests");
    let Ok(entries) = std::fs::read_dir(manifests) else { return found };
    for entry in entries.flatten() {
        let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { continue };
        let Some(path) = json.get("InstallLocation").and_then(|v| v.as_str()) else { continue };
        let name = json.get("DisplayName").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        found.push((name, PathBuf::from(path), "Epic Games".into()));
    }
    found
}

#[cfg(windows)]
fn candidates_from_uninstall_registry() -> Vec<(String, PathBuf, String)> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY};
    use winreg::RegKey;
    let mut found = Vec::new();
    for (hive, view) in [(HKEY_CURRENT_USER, KEY_READ), (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY), (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY)] {
        let Ok(root) = RegKey::predef(hive).open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Uninstall", view) else { continue };
        for key_name in root.enum_keys().flatten() {
            let Ok(key) = root.open_subkey_with_flags(&key_name, KEY_READ) else { continue };
            let name: String = key.get_value("DisplayName").unwrap_or_default();
            let mut path: String = key.get_value("InstallLocation").unwrap_or_default();
            if path.is_empty() {
                path = key.get_value::<String, _>("DisplayIcon").unwrap_or_default().trim_matches('"').split(',').next().unwrap_or_default().to_string();
            }
            if !name.is_empty() && !path.is_empty() { found.push((name, PathBuf::from(path), "Windows registry".into())); }
        }
    }
    found
}

#[cfg(windows)]
fn running_processes() -> HashSet<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let Ok(output) = std::process::Command::new("tasklist").args(["/FO", "CSV", "/NH"]).creation_flags(CREATE_NO_WINDOW).output() else { return HashSet::new() };
    String::from_utf8_lossy(&output.stdout).lines().filter_map(|line| line.trim_start_matches('"').split('"').next()).map(|n| n.to_lowercase()).collect()
}

#[cfg(windows)]
fn match_candidate(spec: &GameSpec, display_name: &str, root: &Path) -> Option<PathBuf> {
    let lower = display_name.to_lowercase();
    if !spec.names.iter().any(|name| lower.contains(name)) { return None; }
    find_executable(root, spec.executables, 7)
}

#[tauri::command]
pub fn detect_installed_games() -> Vec<InstalledGame> {
    #[cfg(windows)]
    {
        let running = running_processes();
        let mut matches: HashMap<&str, InstalledGame> = HashMap::new();
        let mut candidates = candidates_from_steam();
        candidates.extend(candidates_from_epic());
        candidates.extend(candidates_from_uninstall_registry());

        for spec in GAMES {
            for (display_name, root, source) in &candidates {
                if let Some(exe) = match_candidate(spec, display_name, root) {
                    let exe_name = exe.file_name().unwrap_or_default().to_string_lossy().to_string();
                    matches.entry(spec.id).or_insert(InstalledGame {
                        id: spec.id.into(),
                        executable: exe_name.clone(),
                        install_path: exe.to_string_lossy().to_string(),
                        source: source.clone(),
                        running: running.contains(&exe_name.to_lowercase()),
                    });
                    break;
                }
            }
            if matches.contains_key(spec.id) { continue; }
            for raw_path in spec.known_paths {
                let root = expand_env_path(raw_path);
                if let Some(exe) = find_executable(&root, spec.executables, 7) {
                    let exe_name = exe.file_name().unwrap_or_default().to_string_lossy().to_string();
                    matches.insert(spec.id, InstalledGame {
                        id: spec.id.into(),
                        executable: exe_name.clone(),
                        install_path: exe.to_string_lossy().to_string(),
                        source: "Known install location".into(),
                        running: running.contains(&exe_name.to_lowercase()),
                    });
                    break;
                }
            }
        }
        let mut result: Vec<_> = matches.into_values().collect();
        result.sort_by(|a, b| a.id.cmp(&b.id));
        result
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}
