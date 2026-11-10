// Gaming Mode (admin test build).
//
// A small background agent that keeps running after Opti Gods is closed:
//   * The app copies its own .exe to %ProgramData%\OptiGods\GamingMode and
//     registers a SYSTEM scheduled task (at boot, no time limit) that starts
//     that copy with `--gaming-mode-agent`. Running a copy means app updates
//     never fight a locked .exe.
//   * The agent never opens a window or the WebView. Every 2 s it lists
//     processes with native APIs (no PowerShell), finds the running game,
//     raises it to HIGH priority (verified by reading it back), turns off
//     Windows power throttling for it, and lowers a fixed list of known
//     background apps from Normal to Below Normal while a game is running.
//   * Realtime is never used: it starves input, audio and driver threads and
//     causes exactly the freezes Gaming Mode exists to prevent.
//   * Discord and OBS are never lowered so calls and streams stay clean.
//   * When Gaming Mode is turned off (the `enabled` flag file disappears) the
//     agent restores everything it changed, writes a final status and exits.
//
// The app reads `status.json` to show what the agent is doing and surfaces
// every failure as a real error.

use serde::{Deserialize, Serialize};

pub const AGENT_FLAG: &str = "--gaming-mode-agent";
#[cfg(windows)]
const TASK_NAME: &str = r"\OptiGods\Gaming Mode";
#[cfg(windows)]
const AGENT_EXE: &str = "OptiGodsGamingMode.exe";
#[cfg(windows)]
const HEARTBEAT_FRESH_MS: u64 = 7_000;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GamingModeGame {
    pub name: String,
    pub pid: u32,
    pub priority: String,
    pub priority_verified: bool,
    pub power_throttling_off: bool,
    pub detected_by: String,
    pub boosted_at_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GamingModeError {
    pub at_ms: u64,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GamingModeStatus {
    /// Set by the app: the on/off flag file exists.
    #[serde(default)]
    pub enabled: bool,
    /// Set by the app: the agent wrote a heartbeat in the last few seconds.
    #[serde(default)]
    pub agent_running: bool,
    pub agent_pid: u32,
    pub agent_version: String,
    pub started_at_ms: u64,
    pub heartbeat_ms: u64,
    /// "scanning" (no game), "boosting" (game found), "stopped".
    pub state: String,
    pub scans: u64,
    pub processes_scanned: u32,
    pub games: Vec<GamingModeGame>,
    pub lowered: Vec<String>,
    pub errors: Vec<GamingModeError>,
}

/// True when this process was started by the scheduled task.
pub fn agent_requested() -> bool {
    std::env::args().any(|arg| arg == AGENT_FLAG)
}

/// Agent entry point; never returns until Gaming Mode is turned off.
pub fn run_agent() {
    #[cfg(windows)]
    agent::run();
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Process names (lowercase) that are games. Mirrors the shared game library;
/// FiveM's game is the versioned FiveM_*GTAProcess.exe, handled separately.
#[cfg(windows)]
const GAME_EXES: &[&str] = &[
    "007firstlight.exe", "arc-win64-shipping.exe", "bf2042.exe", "cod.exe", "cs2.exe",
    "deadbydaylight-win64-shipping.exe", "dota2.exe", "escapefromtarkov.exe",
    "fortniteclient-win64-shipping.exe", "forzahorizon5.exe", "gta5.exe", "gta5_enhanced.exe",
    "league of legends.exe", "marvelrivals-win64-shipping.exe", "marvel-win64-shipping.exe",
    "overwatch.exe", "phasmophobia.exe", "r5apex.exe", "r5apex_dx12.exe", "rainbowsix.exe",
    "rainbowsix_vulkan.exe", "readyornot.exe", "robloxplayerbeta.exe", "rocketleague.exe",
    "rustclient.exe", "tslgame.exe", "valorant-win64-shipping.exe", "warframe.x64.exe",
    "modernwarfare.exe", "blackops6.exe", "warzone.exe", "finalsclient-win64-shipping.exe",
    "battlebit.exe", "minecraft.windows.exe",
];

/// Known background apps lowered to Below Normal while a game runs.
/// Discord, OBS and audio/driver software are deliberately not here.
#[cfg(windows)]
const BACKGROUND_EXES: &[&str] = &[
    "chrome.exe", "msedge.exe", "brave.exe", "firefox.exe", "opera.exe", "vivaldi.exe",
    "spotify.exe", "steam.exe", "steamwebhelper.exe", "epicgameslauncher.exe",
    "epicwebhelper.exe", "battle.net.exe", "eadesktop.exe", "origin.exe", "ubisoftconnect.exe",
    "upc.exe", "galaxyclient.exe", "onedrive.exe", "teams.exe", "ms-teams.exe", "slack.exe",
    "rockstarservice.exe",
];

/// Install folders that only contain games (lowercase, backslashes).
#[cfg(windows)]
const GAME_LIBRARY_MARKERS: &[&str] = &[
    r"\steamapps\common\", r"\epic games\", r"\riot games\", r"\ea games\", r"\origin games\",
    r"\ubisoft game launcher\games\", r"\gog galaxy\games\", r"\xboxgames\",
];

/// Executables inside game folders that are not the game itself.
#[cfg(windows)]
const NON_GAME_PARTS: &[&str] = &[
    "launcher", "crash", "report", "helper", "service", "anticheat", "battleye", "unins",
    "setup", "redist", "updater", "overlay", "bootstrap", "install", "prereq", "wallpaper",
    "cefprocess", "dxsetup", "server",
];

#[cfg(windows)]
pub(crate) fn classify_game(name_lower: &str, path_lower: Option<&str>) -> Option<&'static str> {
    if name_lower.starts_with("fivem_") && name_lower.ends_with("gtaprocess.exe") {
        return Some("FiveM game process");
    }
    if GAME_EXES.contains(&name_lower) {
        return Some("game list");
    }
    let path = path_lower?;
    if GAME_LIBRARY_MARKERS.iter().any(|marker| path.contains(marker))
        && !NON_GAME_PARTS.iter().any(|part| name_lower.contains(part))
        && !name_lower.starts_with("fivem")
    {
        return Some("game library folder");
    }
    None
}

#[cfg(windows)]
fn data_dir() -> std::path::PathBuf {
    let base = std::env::var_os("ProgramData").unwrap_or_else(|| "C:\\ProgramData".into());
    std::path::PathBuf::from(base).join("OptiGods").join("GamingMode")
}

// ─── Native process helpers (shared by agent and app fallback) ────────────────

#[cfg(windows)]
mod native {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        GetPriorityClass, OpenProcess, QueryFullProcessImageNameW, SetPriorityClass, SetProcessInformation,
        TerminateProcess, ProcessPowerThrottling, PROCESS_CREATION_FLAGS, PROCESS_NAME_WIN32,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        PROCESS_POWER_THROTTLING_STATE, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION,
        PROCESS_TERMINATE,
    };

    pub const NORMAL: u32 = 0x20;
    pub const BELOW_NORMAL: u32 = 0x4000;
    pub const HIGH: u32 = 0x80;

    pub fn priority_name(class: u32) -> &'static str {
        match class {
            0x40 => "Idle",
            0x4000 => "Below Normal",
            0x20 => "Normal",
            0x8000 => "Above Normal",
            0x80 => "High",
            0x100 => "Realtime",
            _ => "Unknown",
        }
    }

    pub struct Process {
        pub pid: u32,
        pub name: String,
    }

    pub fn list() -> Result<Vec<Process>, String> {
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
                .map_err(|e| format!("Windows process list unavailable: {e}"))?;
            let mut entry = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
            let mut out = Vec::new();
            if Process32FirstW(snap, &mut entry).is_ok() {
                loop {
                    let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                    out.push(Process { pid: entry.th32ProcessID, name: String::from_utf16_lossy(&entry.szExeFile[..len]) });
                    if Process32NextW(snap, &mut entry).is_err() { break; }
                }
            }
            let _ = CloseHandle(snap);
            Ok(out)
        }
    }

    struct Handle(HANDLE);
    impl Drop for Handle {
        fn drop(&mut self) { unsafe { let _ = CloseHandle(self.0); } }
    }

    fn open(pid: u32, set: bool) -> Result<Handle, String> {
        let access = if set { PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_INFORMATION } else { PROCESS_QUERY_LIMITED_INFORMATION };
        unsafe { OpenProcess(access, false, pid).map(Handle).map_err(|e| e.message().to_string()) }
    }

    pub fn image_path(pid: u32) -> Option<String> {
        let handle = open(pid, false).ok()?;
        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        unsafe {
            QueryFullProcessImageNameW(handle.0, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size).ok()?;
        }
        Some(String::from_utf16_lossy(&buffer[..size as usize]))
    }

    pub fn get_priority(pid: u32) -> Result<u32, String> {
        let handle = open(pid, false)?;
        let class = unsafe { GetPriorityClass(handle.0) };
        if class == 0 { Err("Windows did not return the priority".into()) } else { Ok(class) }
    }

    /// Sets the class and reads it back; Ok only when Windows reports the new class.
    pub fn set_priority(pid: u32, class: u32) -> Result<(), String> {
        let handle = open(pid, true)?;
        unsafe {
            SetPriorityClass(handle.0, PROCESS_CREATION_FLAGS(class)).map_err(|e| e.message().to_string())?;
            let actual = GetPriorityClass(handle.0);
            if actual != class {
                return Err(format!("Windows kept it at {}", priority_name(actual)));
            }
        }
        Ok(())
    }

    /// Opts the process out of EcoQoS / power throttling (full CPU speed).
    pub fn disable_power_throttling(pid: u32) -> Result<(), String> {
        let handle = open(pid, true)?;
        let state = PROCESS_POWER_THROTTLING_STATE {
            Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
            ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
            StateMask: 0,
        };
        unsafe {
            SetProcessInformation(
                handle.0,
                ProcessPowerThrottling,
                &state as *const _ as *const core::ffi::c_void,
                std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
            ).map_err(|e| e.message().to_string())
        }
    }

    pub fn terminate(pid: u32) -> Result<(), String> {
        unsafe {
            let handle = OpenProcess(PROCESS_TERMINATE, false, pid).map_err(|e| e.message().to_string())?;
            let handle = Handle(handle);
            TerminateProcess(handle.0, 0).map_err(|e| e.message().to_string())
        }
    }
}

// ─── Agent (runs as SYSTEM from the scheduled task) ───────────────────────────

#[cfg(windows)]
mod agent {
    use super::*;
    use std::collections::{HashMap, HashSet};
    use std::os::windows::fs::OpenOptionsExt;

    const TICK: std::time::Duration = std::time::Duration::from_secs(2);
    const MAX_ERRORS: usize = 12;

    struct Boosted { name: String, original: u32, game: GamingModeGame }

    struct Agent {
        status: GamingModeStatus,
        paths: HashMap<u32, Option<String>>,
        boosted: HashMap<u32, Boosted>,
        lowered: HashMap<u32, String>,
        reported: HashSet<String>,
    }

    impl Agent {
        fn error(&mut self, key: String, message: String) {
            // Report each distinct failure once per process so the log stays readable.
            if !self.reported.insert(key) { return; }
            log::warn!("[gaming_mode] {message}");
            self.status.errors.push(GamingModeError { at_ms: now_ms(), message });
            let excess = self.status.errors.len().saturating_sub(MAX_ERRORS);
            self.status.errors.drain(..excess);
        }

        fn tick(&mut self) {
            let processes = match native::list() {
                Ok(list) => list,
                Err(message) => { self.error("list".into(), message); return; }
            };
            let alive: HashSet<u32> = processes.iter().map(|p| p.pid).collect();
            self.paths.retain(|pid, _| alive.contains(pid));
            self.boosted.retain(|pid, _| alive.contains(pid));
            self.lowered.retain(|pid, _| alive.contains(pid));
            self.reported.retain(|key| key.split(':').nth(1).and_then(|p| p.parse().ok()).map_or(true, |pid: u32| alive.contains(&pid)));

            let own = std::process::id();
            let mut games = Vec::new();
            for process in &processes {
                if process.pid < 8 || process.pid == own { continue; }
                let lower = process.name.to_ascii_lowercase();
                let path = if GAME_EXES.contains(&lower.as_str()) || lower.starts_with("fivem_") {
                    None
                } else {
                    self.paths.entry(process.pid).or_insert_with(|| native::image_path(process.pid).map(|p| p.to_ascii_lowercase())).clone()
                };
                if let Some(how) = classify_game(&lower, path.as_deref()) {
                    games.push((process.pid, process.name.clone(), how));
                }
            }

            for (pid, name, how) in &games {
                self.boost(*pid, name, how);
            }
            if games.is_empty() {
                self.restore_background();
            } else {
                for process in &processes {
                    let lower = process.name.to_ascii_lowercase();
                    if BACKGROUND_EXES.contains(&lower.as_str()) && !self.lowered.contains_key(&process.pid) {
                        self.lower(process.pid, &process.name);
                    }
                }
            }

            self.status.scans += 1;
            self.status.processes_scanned = processes.len() as u32;
            self.status.state = if games.is_empty() { "scanning".into() } else { "boosting".into() };
            self.status.games = self.boosted.values().map(|b| b.game.clone()).collect();
            let mut lowered: Vec<String> = self.lowered.values().cloned().collect();
            lowered.sort();
            self.status.lowered = lowered;
        }

        fn boost(&mut self, pid: u32, name: &str, how: &str) {
            let current = match native::get_priority(pid) {
                Ok(class) => class,
                Err(message) => { self.error(format!("read:{pid}"), format!("Could not read {name} priority: {message}")); return; }
            };
            if !self.boosted.contains_key(&pid) {
                let throttling = native::disable_power_throttling(pid);
                if let Err(message) = &throttling {
                    self.error(format!("power:{pid}"), format!("Could not turn off power saving for {name}: {message}"));
                }
                self.boosted.insert(pid, Boosted {
                    name: name.to_string(),
                    original: current,
                    game: GamingModeGame {
                        name: name.to_string(), pid, priority: native::priority_name(current).into(),
                        priority_verified: false, power_throttling_off: throttling.is_ok(),
                        detected_by: how.to_string(), boosted_at_ms: now_ms(),
                    },
                });
            }
            // Re-apply every tick: some games or launchers reset their own priority.
            let result = if current == native::HIGH { Ok(()) } else { native::set_priority(pid, native::HIGH) };
            match result {
                Ok(()) => {
                    if let Some(entry) = self.boosted.get_mut(&pid) {
                        entry.game.priority = "High".into();
                        entry.game.priority_verified = true;
                    }
                }
                Err(message) => {
                    if let Some(entry) = self.boosted.get_mut(&pid) {
                        entry.game.priority = native::priority_name(current).into();
                        entry.game.priority_verified = false;
                    }
                    self.error(format!("boost:{pid}"), format!("Windows refused to set {name} to High priority: {message}"));
                }
            }
        }

        fn lower(&mut self, pid: u32, name: &str) {
            // Only lower apps still at Normal; never touch something the user set.
            match native::get_priority(pid) {
                Ok(native::NORMAL) => match native::set_priority(pid, native::BELOW_NORMAL) {
                    Ok(()) => { self.lowered.insert(pid, name.to_string()); }
                    Err(message) => self.error(format!("lower:{pid}"), format!("Could not lower {name}: {message}")),
                },
                _ => {}
            }
        }

        fn restore_background(&mut self) {
            for (pid, name) in std::mem::take(&mut self.lowered) {
                if native::get_priority(pid) == Ok(native::BELOW_NORMAL) {
                    if let Err(message) = native::set_priority(pid, native::NORMAL) {
                        self.error(format!("restore:{pid}"), format!("Could not restore {name}: {message}"));
                    }
                }
            }
        }

        fn restore_all(&mut self) {
            self.restore_background();
            for (pid, boosted) in std::mem::take(&mut self.boosted) {
                if native::get_priority(pid) == Ok(native::HIGH) && boosted.original != native::HIGH {
                    let original = if boosted.original == 0 { native::NORMAL } else { boosted.original };
                    if let Err(message) = native::set_priority(pid, original) {
                        self.error(format!("restore:{pid}"), format!("Could not restore {}: {message}", boosted.name));
                    }
                }
            }
        }

        fn write_status(&mut self) {
            self.status.heartbeat_ms = now_ms();
            let dir = data_dir();
            let tmp = dir.join("status.json.tmp");
            if let Ok(json) = serde_json::to_vec_pretty(&self.status) {
                if std::fs::write(&tmp, json).is_ok() {
                    let _ = std::fs::rename(&tmp, dir.join("status.json"));
                }
            }
        }
    }

    pub fn run() {
        let dir = data_dir();
        let _ = std::fs::create_dir_all(&dir);
        // One agent at a time: hold an exclusive handle on the lock file.
        let _lock = match std::fs::OpenOptions::new().create(true).write(true).share_mode(0).open(dir.join("agent.lock")) {
            Ok(file) => file,
            Err(_) => return,
        };
        let mut agent = Agent {
            status: GamingModeStatus {
                agent_pid: std::process::id(),
                agent_version: env!("CARGO_PKG_VERSION").into(),
                started_at_ms: now_ms(),
                state: "scanning".into(),
                ..Default::default()
            },
            paths: HashMap::new(),
            boosted: HashMap::new(),
            lowered: HashMap::new(),
            reported: HashSet::new(),
        };
        loop {
            if !dir.join("enabled").exists() {
                agent.restore_all();
                agent.status.state = "stopped".into();
                agent.status.games.clear();
                agent.status.lowered.clear();
                agent.write_status();
                return;
            }
            agent.tick();
            agent.write_status();
            std::thread::sleep(TICK);
        }
    }
}

// ─── App-side commands (admin panel) ──────────────────────────────────────────

#[cfg(windows)]
fn run_hidden(program: &str, args: &[&str]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new(program)
        .args(args)
        .creation_flags(0x0800_0000)
        .output()
        .map_err(|e| format!("Could not run {program}: {e}"))?;
    let text = format!("{}{}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr)).trim().to_string();
    if output.status.success() { Ok(text) } else { Err(if text.is_empty() { format!("{program} failed ({})", output.status) } else { text }) }
}

#[cfg(windows)]
fn read_status() -> GamingModeStatus {
    let dir = data_dir();
    let mut status: GamingModeStatus = std::fs::read(dir.join("status.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    status.enabled = dir.join("enabled").exists();
    status.agent_running = status.state != "stopped"
        && status.heartbeat_ms > 0
        && now_ms().saturating_sub(status.heartbeat_ms) < HEARTBEAT_FRESH_MS;
    status
}

#[cfg(windows)]
fn agent_pids() -> Vec<u32> {
    native::list()
        .map(|list| list.into_iter().filter(|p| p.name.eq_ignore_ascii_case(AGENT_EXE)).map(|p| p.pid).collect())
        .unwrap_or_default()
}

/// Stops any running agent without restoring (used before replacing the .exe).
#[cfg(windows)]
fn kill_agents() {
    let _ = run_hidden("schtasks.exe", &["/End", "/TN", TASK_NAME]);
    for pid in agent_pids() {
        let _ = native::terminate(pid);
    }
    for _ in 0..20 {
        if agent_pids().is_empty() { break; }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

/// App-side restore when the agent could not do it itself.
#[cfg(windows)]
fn fallback_restore() {
    let Ok(list) = native::list() else { return };
    for process in list {
        let lower = process.name.to_ascii_lowercase();
        let current = native::get_priority(process.pid);
        if BACKGROUND_EXES.contains(&lower.as_str()) && current == Ok(native::BELOW_NORMAL) {
            let _ = native::set_priority(process.pid, native::NORMAL);
        } else if classify_game(&lower, None).is_some() && current == Ok(native::HIGH) {
            let _ = native::set_priority(process.pid, native::NORMAL);
        }
    }
}

#[cfg(windows)]
fn task_xml(agent: &std::path::Path) -> String {
    let command = agent.display().to_string().replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    format!(r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Opti Gods Gaming Mode: keeps the running game at High priority. Turn it off in Opti Gods.</Description></RegistrationInfo>
  <Triggers><BootTrigger><Enabled>true</Enabled></BootTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>4</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author"><Exec><Command>"{command}"</Command><Arguments>{AGENT_FLAG}</Arguments></Exec></Actions>
</Task>
"#)
}

#[tauri::command]
pub async fn gaming_mode_status() -> GamingModeStatus {
    #[cfg(windows)]
    { tokio::task::spawn_blocking(read_status).await.unwrap_or_default() }
    #[cfg(not(windows))]
    { GamingModeStatus::default() }
}

#[tauri::command]
pub async fn enable_gaming_mode() -> Result<GamingModeStatus, String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(|| -> Result<GamingModeStatus, String> {
            if !crate::win32::elevation::is_elevated().unwrap_or(false) {
                return Err("Opti Gods is not running as administrator, so Windows will not let it create the Gaming Mode task.".into());
            }
            let dir = data_dir();
            std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
            // SYSTEM runs this folder's .exe: only SYSTEM and Administrators may write to it.
            let dir_text = dir.display().to_string();
            run_hidden("icacls.exe", &[&dir_text, "/inheritance:r", "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F", "*S-1-5-32-545:(OI)(CI)RX"])
                .map_err(|e| format!("Could not lock the Gaming Mode folder: {e}"))?;

            kill_agents();
            let source = std::env::current_exe().map_err(|e| format!("Could not find the Opti Gods .exe: {e}"))?;
            let agent = dir.join(AGENT_EXE);
            let mut copied = Err(String::new());
            for _ in 0..5 {
                copied = std::fs::copy(&source, &agent).map(|_| ()).map_err(|e| e.to_string());
                if copied.is_ok() { break; }
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
            copied.map_err(|e| format!("Could not copy the Gaming Mode agent to {}: {e}", agent.display()))?;
            let _ = std::fs::remove_file(dir.join("status.json"));
            std::fs::write(dir.join("enabled"), b"on").map_err(|e| format!("Could not save the Gaming Mode switch: {e}"))?;

            let xml_path = dir.join("task.xml");
            let mut bytes = vec![0xFF, 0xFE];
            for unit in task_xml(&agent).encode_utf16() { bytes.extend_from_slice(&unit.to_le_bytes()); }
            std::fs::write(&xml_path, bytes).map_err(|e| format!("Could not write the task definition: {e}"))?;
            let xml_text = xml_path.display().to_string();
            let created = run_hidden("schtasks.exe", &["/Create", "/TN", TASK_NAME, "/XML", &xml_text, "/F"]);
            let _ = std::fs::remove_file(&xml_path);
            if let Err(message) = created {
                let _ = std::fs::remove_file(dir.join("enabled"));
                return Err(format!("Windows Task Scheduler refused the Gaming Mode task: {message}"));
            }
            run_hidden("schtasks.exe", &["/Run", "/TN", TASK_NAME])
                .map_err(|e| format!("The Gaming Mode task was created but Windows did not start it: {e}"))?;

            for _ in 0..40 {
                std::thread::sleep(std::time::Duration::from_millis(250));
                let status = read_status();
                if status.agent_running && status.scans > 0 {
                    return Ok(status);
                }
            }
            Err(format!(
                "The Gaming Mode agent did not report back within 10 seconds. Task: {TASK_NAME}. Agent: {}. Agent processes running: {}.",
                agent.display(),
                agent_pids().len()
            ))
        }).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    { Err("Gaming Mode requires the Windows app.".into()) }
}

#[tauri::command]
pub async fn disable_gaming_mode() -> Result<GamingModeStatus, String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(|| -> Result<GamingModeStatus, String> {
            let dir = data_dir();
            let flag = dir.join("enabled");
            if flag.exists() {
                std::fs::remove_file(&flag).map_err(|e| format!("Could not turn off the Gaming Mode switch: {e}"))?;
            }
            // The agent restores priorities and exits within one tick.
            let mut stopped_cleanly = false;
            for _ in 0..30 {
                if agent_pids().is_empty() { stopped_cleanly = true; break; }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            if !stopped_cleanly {
                kill_agents();
                fallback_restore();
            }
            let delete = run_hidden("schtasks.exe", &["/Delete", "/TN", TASK_NAME, "/F"]);
            let status = read_status();
            if let Err(message) = delete {
                let still_there = run_hidden("schtasks.exe", &["/Query", "/TN", TASK_NAME]).is_ok();
                if still_there {
                    return Err(format!("Gaming Mode stopped, but Windows did not remove its startup task: {message}"));
                }
            }
            if !agent_pids().is_empty() {
                return Err("Gaming Mode is still running after being turned off. Restart Windows to stop it.".into());
            }
            Ok(status)
        }).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    { Err("Gaming Mode requires the Windows app.".into()) }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn classifies_games_and_skips_helpers() {
        assert!(classify_game("fivem_b3258_gtaprocess.exe", None).is_some());
        assert!(classify_game("fivem.exe", None).is_none());
        assert!(classify_game("fivem_chromebrowser.exe", None).is_none());
        assert!(classify_game("cs2.exe", None).is_some());
        assert!(classify_game("game.exe", Some(r"d:\steamlibrary\steamapps\common\game\game.exe")).is_some());
        assert!(classify_game("unitycrashhandler64.exe", Some(r"d:\steamlibrary\steamapps\common\game\unitycrashhandler64.exe")).is_none());
        assert!(classify_game("wallpaper64.exe", Some(r"c:\steam\steamapps\common\wallpaper_engine\wallpaper64.exe")).is_none());
        assert!(classify_game("chrome.exe", Some(r"c:\program files\google\chrome\application\chrome.exe")).is_none());
    }
}
