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
//   * Music: Spotify, SoundCloud and Chromium browsers are checked for audio
//     that is actually playing (CPU use of their audio process). A playing
//     app's audio process keeps Normal priority and full speed; everything
//     else in the background gets Below Normal, Windows efficiency mode
//     (EcoQoS) and low memory priority, so Windows trims their memory before
//     the game's.
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
    /// Music/audio sources seen while a game runs (Spotify, SoundCloud, browsers).
    #[serde(default)]
    pub music: Vec<GamingModeMusic>,
    /// Background processes currently in Windows efficiency mode (EcoQoS).
    #[serde(default)]
    pub efficiency_mode: u32,
    /// Every background app seen while a game runs and what was done to it.
    #[serde(default)]
    pub apps: Vec<GamingModeBackgroundApp>,
    /// Discord is in a voice call (from the app's microphone check). None: unknown
    /// (Opti Gods closed or Discord not running).
    #[serde(default)]
    pub discord_call: Option<bool>,
    pub errors: Vec<GamingModeError>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GamingModeBackgroundApp {
    pub app: String,
    pub processes: u32,
    /// Lowered to Below Normal by Gaming Mode.
    pub lowered: u32,
    /// In Windows efficiency mode (set by Gaming Mode).
    pub efficiency: u32,
    /// Already below Normal (set by the app itself), left alone.
    pub already_low: u32,
    /// Browsers: open tabs, counted from their tab (renderer) processes.
    #[serde(default)]
    pub tabs: u32,
    /// Why the app is not slowed, when it is protected.
    pub note: String,
}

/// Music state the Opti Gods app reads from Windows media controls and hands
/// to the agent (the agent runs as SYSTEM and cannot see media sessions).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct MediaHint {
    pub written_ms: u64,
    /// Lowercase exe → playing.
    pub apps: std::collections::BTreeMap<String, bool>,
    /// Discord is using the microphone (voice call).
    #[serde(default)]
    pub discord_call: Option<bool>,
    /// Twitch/Kick/YouTube open in a visible browser window.
    #[serde(default)]
    pub videos: Vec<crate::commands::stream_watch::VideoWatch>,
    /// OBS Studio or Streamlabs is live. Shown only; OBS is never changed.
    #[serde(default)]
    pub live: Option<crate::commands::stream_watch::LiveStream>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct GamingModeMusic {
    pub app: String,
    /// "playing", "paused" or "unknown" (Windows would not show its processes).
    pub state: String,
    pub processes: u32,
    /// "media_controls" (instant, from Windows) or "audio_activity" (CPU-based).
    #[serde(default)]
    pub source: String,
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
    "rockstarservice.exe", "soundcloud.exe",
];

/// Chromium browsers: their audio plays through one utility process whose
/// command line names the audio service, so playback can be detected.
#[cfg(windows)]
const CHROMIUM_BROWSERS: &[&str] = &["chrome.exe", "msedge.exe", "brave.exe", "opera.exe", "vivaldi.exe"];

/// Desktop music apps.
#[cfg(windows)]
const MUSIC_APPS: &[&str] = &["spotify.exe", "soundcloud.exe"];

/// Background apps put in Windows efficiency mode while a game runs and they
/// are not playing audio. Launchers are excluded: they host game overlays.
#[cfg(windows)]
const EFFICIENCY_EXES: &[&str] = &[
    "chrome.exe", "msedge.exe", "brave.exe", "opera.exe", "vivaldi.exe", "spotify.exe", "soundcloud.exe",
    "onedrive.exe", "teams.exe", "ms-teams.exe", "slack.exe",
];

/// Discord builds. Never slowed; raised to Above Normal during voice calls.
#[cfg(windows)]
const DISCORD_EXES: &[&str] = &["discord.exe", "discordptb.exe", "discordcanary.exe"];

/// Lowercase exe name, with Microsoft Store builds mapped to the known name
/// (the Store SoundCloud app does not run as plain SoundCloud.exe).
#[cfg(windows)]
fn canonical_exe(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    if lower.contains("soundcloud") { "soundcloud.exe".into() } else { lower }
}

#[cfg(windows)]
fn app_label(exe: &str) -> &'static str {
    match exe {
        "spotify.exe" => "Spotify app",
        "soundcloud.exe" => "SoundCloud app",
        "chrome.exe" => "Chrome",
        "msedge.exe" => "Edge",
        "brave.exe" => "Brave",
        "opera.exe" => "Opera",
        "vivaldi.exe" => "Vivaldi",
        "firefox.exe" => "Firefox",
        "discord.exe" | "discordptb.exe" | "discordcanary.exe" => "Discord",
        "obs64.exe" | "obs32.exe" => "OBS",
        "streamlabs obs.exe" | "streamlabs desktop.exe" => "Streamlabs",
        "steam.exe" | "steamwebhelper.exe" => "Steam",
        "epicgameslauncher.exe" | "epicwebhelper.exe" => "Epic Games",
        "battle.net.exe" => "Battle.net",
        "eadesktop.exe" | "origin.exe" => "EA app",
        "ubisoftconnect.exe" | "upc.exe" => "Ubisoft Connect",
        "galaxyclient.exe" => "GOG Galaxy",
        "onedrive.exe" => "OneDrive",
        "teams.exe" | "ms-teams.exe" => "Teams",
        "slack.exe" => "Slack",
        "rockstarservice.exe" => "Rockstar",
        _ => "App",
    }
}

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
pub(crate) fn data_dir() -> std::path::PathBuf {
    let base = std::env::var_os("ProgramData").unwrap_or_else(|| "C:\\ProgramData".into());
    std::path::PathBuf::from(base).join("OptiGods").join("GamingMode")
}

// ─── Native process helpers (shared by agent and app fallback) ────────────────

#[cfg(windows)]
pub(crate) mod native {
    use windows::core::PWSTR;
    use windows::Wdk::System::Threading::{NtQueryInformationProcess, ProcessCommandLineInformation};
    use windows::Win32::Foundation::{CloseHandle, FILETIME, HANDLE, UNICODE_STRING};
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        GetPriorityClass, GetProcessTimes, OpenProcess, QueryFullProcessImageNameW, SetPriorityClass, SetProcessInformation,
        ProcessMemoryPriority, MEMORY_PRIORITY_INFORMATION, MEMORY_PRIORITY_LOW, MEMORY_PRIORITY_NORMAL,
        TerminateProcess, ProcessPowerThrottling, PROCESS_CREATION_FLAGS, PROCESS_NAME_WIN32,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        PROCESS_POWER_THROTTLING_STATE, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION,
        PROCESS_TERMINATE,
    };

    pub const NORMAL: u32 = 0x20;
    pub const BELOW_NORMAL: u32 = 0x4000;
    pub const HIGH: u32 = 0x80;
    pub const ABOVE_NORMAL: u32 = 0x8000;

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

    /// Lets the SYSTEM agent adjust sandboxed browser processes (Chromium
    /// renderers deny PROCESS_SET_INFORMATION in their own access list).
    /// SYSTEM holds this privilege; it only needs to be switched on.
    pub fn enable_debug_privilege() -> Result<(), String> {
        use windows::Win32::Foundation::{GetLastError, ERROR_NOT_ALL_ASSIGNED, LUID};
        use windows::Win32::Security::{
            AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
            TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
        };
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
        unsafe {
            let mut token = HANDLE::default();
            OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &mut token)
                .map_err(|e| format!("could not open the agent's token: {}", e.message()))?;
            let token = Handle(token);
            let mut luid = LUID::default();
            LookupPrivilegeValueW(None, windows::core::w!("SeDebugPrivilege"), &mut luid)
                .map_err(|e| format!("could not look up the debug privilege: {}", e.message()))?;
            let privileges = TOKEN_PRIVILEGES {
                PrivilegeCount: 1,
                Privileges: [LUID_AND_ATTRIBUTES { Luid: luid, Attributes: SE_PRIVILEGE_ENABLED }],
            };
            AdjustTokenPrivileges(token.0, false, Some(&privileges), 0, None, None)
                .map_err(|e| format!("could not enable the debug privilege: {}", e.message()))?;
            if GetLastError() == ERROR_NOT_ALL_ASSIGNED {
                return Err("Windows did not grant the debug privilege to the Gaming Mode agent".into());
            }
        }
        Ok(())
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

    #[derive(Clone, Copy, PartialEq, Eq, Debug)]
    pub enum Throttle {
        /// Full CPU speed: Windows may not put it in efficiency mode.
        Off,
        /// Efficiency mode (EcoQoS): lower clocks / efficient scheduling.
        On,
        /// Hand the decision back to Windows.
        Default,
    }

    pub fn set_power_throttling(pid: u32, mode: Throttle) -> Result<(), String> {
        let handle = open(pid, true)?;
        let (control, state) = match mode {
            Throttle::Off => (PROCESS_POWER_THROTTLING_EXECUTION_SPEED, 0),
            Throttle::On => (PROCESS_POWER_THROTTLING_EXECUTION_SPEED, PROCESS_POWER_THROTTLING_EXECUTION_SPEED),
            Throttle::Default => (0, 0),
        };
        let state = PROCESS_POWER_THROTTLING_STATE {
            Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
            ControlMask: control,
            StateMask: state,
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

    /// Opts the process out of EcoQoS / power throttling (full CPU speed).
    pub fn disable_power_throttling(pid: u32) -> Result<(), String> {
        set_power_throttling(pid, Throttle::Off)
    }

    /// Low memory priority: Windows trims these pages before the game's.
    pub fn set_memory_priority(pid: u32, low: bool) -> Result<(), String> {
        let handle = open(pid, true)?;
        let info = MEMORY_PRIORITY_INFORMATION { MemoryPriority: if low { MEMORY_PRIORITY_LOW } else { MEMORY_PRIORITY_NORMAL } };
        unsafe {
            SetProcessInformation(
                handle.0,
                ProcessMemoryPriority,
                &info as *const _ as *const core::ffi::c_void,
                std::mem::size_of::<MEMORY_PRIORITY_INFORMATION>() as u32,
            ).map_err(|e| e.message().to_string())
        }
    }

    /// Total CPU time (kernel + user) in 100 ns units.
    pub fn cpu_time(pid: u32) -> Option<u64> {
        let handle = open(pid, false).ok()?;
        let (mut created, mut exited, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default(), FILETIME::default());
        unsafe { GetProcessTimes(handle.0, &mut created, &mut exited, &mut kernel, &mut user).ok()?; }
        let value = |t: FILETIME| ((t.dwHighDateTime as u64) << 32) | t.dwLowDateTime as u64;
        Some(value(kernel) + value(user))
    }

    pub fn command_line(pid: u32) -> Option<String> {
        let handle = open(pid, false).ok()?;
        let mut needed = 0u32;
        unsafe {
            let _ = NtQueryInformationProcess(handle.0, ProcessCommandLineInformation, std::ptr::null_mut(), 0, &mut needed);
        }
        if needed == 0 || needed > 131_072 { return None; }
        let mut buffer = vec![0u64; (needed as usize + 7) / 8];
        let status = unsafe {
            NtQueryInformationProcess(
                handle.0,
                ProcessCommandLineInformation,
                buffer.as_mut_ptr() as *mut core::ffi::c_void,
                (buffer.len() * 8) as u32,
                &mut needed,
            )
        };
        if status.0 < 0 { return None; }
        let text = unsafe { &*(buffer.as_ptr() as *const UNICODE_STRING) };
        if text.Buffer.is_null() { return None; }
        let units = unsafe { std::slice::from_raw_parts(text.Buffer.0, (text.Length / 2) as usize) };
        Some(String::from_utf16_lossy(units))
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
    use std::time::Instant;

    const TICK: std::time::Duration = std::time::Duration::from_secs(2);
    const MAX_ERRORS: usize = 12;
    /// Share of one CPU core the browser audio service uses while sound plays.
    const AUDIO_SERVICE_ACTIVE: f64 = 0.0015;
    /// Share of one core a music app without a separate audio process uses while playing.
    const MUSIC_APP_ACTIVE: f64 = 0.004;
    /// Ticks music stays protected after it goes quiet (track changes, buffering).
    const MUSIC_HOLD_TICKS: u8 = 3;

    struct Boosted { name: String, original: u32, game: GamingModeGame }

    /// What Gaming Mode changed on one background process, so it can undo exactly that.
    struct Background {
        name: String,
        lowered: bool,
        throttle: Option<native::Throttle>,
        memory_low: bool,
        /// The app had already set itself below Normal; left alone.
        already_low: bool,
    }

    struct Agent {
        status: GamingModeStatus,
        paths: HashMap<u32, Option<String>>,
        command_lines: HashMap<u32, Option<String>>,
        cpu: HashMap<u32, (u64, Instant)>,
        boosted: HashMap<u32, Boosted>,
        background: HashMap<u32, Background>,
        music_hold: HashMap<String, u8>,
        reported: HashSet<String>,
        /// Discord processes raised to Above Normal for a voice call.
        discord_raised: HashSet<u32>,
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

        /// CPU use since the previous tick as a share of one core.
        fn cpu_rate(&mut self, pid: u32, now: Instant) -> Option<f64> {
            let total = native::cpu_time(pid)?;
            let (previous, at) = self.cpu.insert(pid, (total, now))?;
            let seconds = now.duration_since(at).as_secs_f64();
            if seconds <= 0.0 { return None; }
            Some(total.saturating_sub(previous) as f64 / 10_000_000.0 / seconds)
        }

        fn tick(&mut self) {
            let processes = match native::list() {
                Ok(list) => list,
                Err(message) => { self.error("list".into(), message); return; }
            };
            let alive: HashSet<u32> = processes.iter().map(|p| p.pid).collect();
            self.paths.retain(|pid, _| alive.contains(pid));
            self.command_lines.retain(|pid, _| alive.contains(pid));
            self.cpu.retain(|pid, _| alive.contains(pid));
            self.boosted.retain(|pid, _| alive.contains(pid));
            self.background.retain(|pid, _| alive.contains(pid));
            self.discord_raised.retain(|pid| alive.contains(pid));
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
                self.music_hold.clear();
                self.status.music.clear();
                self.status.apps.clear();
            } else {
                self.optimize_background(&processes);
            }

            self.status.scans += 1;
            self.status.processes_scanned = processes.len() as u32;
            self.status.state = if games.is_empty() { "scanning".into() } else { "boosting".into() };
            self.status.games = self.boosted.values().map(|b| b.game.clone()).collect();
            let mut lowered: Vec<String> = self.background.values().filter(|b| b.lowered).map(|b| b.name.clone()).collect();
            lowered.sort();
            self.status.lowered = lowered;
            self.status.efficiency_mode = self.background.values().filter(|b| b.throttle == Some(native::Throttle::On)).count() as u32;
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

        /// While a game runs: find music that is actually playing and keep its
        /// audio path at full speed; lower and slow everything else.
        fn optimize_background(&mut self, processes: &[native::Process]) {
            let now = Instant::now();
            let mut audio_pids: HashSet<u32> = HashSet::new();
            let mut audio_rate: HashMap<String, f64> = HashMap::new();
            let mut total_rate: HashMap<String, f64> = HashMap::new();
            let mut readable: HashSet<String> = HashSet::new();
            let mut counts: HashMap<String, u32> = HashMap::new();
            let mut targets: Vec<(u32, String, String)> = Vec::new();

            for process in processes {
                let exe = canonical_exe(&process.name);
                if !BACKGROUND_EXES.contains(&exe.as_str()) { continue; }
                targets.push((process.pid, process.name.clone(), exe.clone()));
                let audio_capable = CHROMIUM_BROWSERS.contains(&exe.as_str()) || MUSIC_APPS.contains(&exe.as_str());
                if !audio_capable { continue; }
                *counts.entry(exe.clone()).or_default() += 1;
                let rate = self.cpu_rate(process.pid, now).unwrap_or(0.0);
                *total_rate.entry(exe.clone()).or_default() += rate;
                let command = self.command_lines.entry(process.pid).or_insert_with(|| native::command_line(process.pid)).clone();
                if let Some(command) = command {
                    readable.insert(exe.clone());
                    if command.contains("audio.mojom.AudioService") {
                        audio_pids.insert(process.pid);
                        *audio_rate.entry(exe.clone()).or_default() += rate;
                    }
                }
            }

            // Decide which apps are playing. Windows media controls (passed on
            // by the Opti Gods app) are exact and instant; without them, audio
            // activity is used, held briefly so track changes don't flap it.
            let hint = read_media_hint();
            let mut playing: HashSet<String> = HashSet::new();
            let mut unknown: HashSet<String> = HashSet::new();
            let mut music = Vec::new();
            for (exe, count) in &counts {
                if let Some(&is_playing) = hint.as_ref().and_then(|h| h.apps.get(exe)) {
                    self.music_hold.insert(exe.clone(), if is_playing { MUSIC_HOLD_TICKS } else { 0 });
                    if is_playing { playing.insert(exe.clone()); }
                    music.push(GamingModeMusic {
                        app: app_label(exe).into(), state: if is_playing { "playing" } else { "paused" }.into(),
                        processes: *count, source: "media_controls".into(),
                    });
                    continue;
                }
                let active = if let Some(rate) = audio_rate.get(exe) {
                    *rate >= AUDIO_SERVICE_ACTIVE
                } else if MUSIC_APPS.contains(&exe.as_str()) {
                    total_rate.get(exe).copied().unwrap_or(0.0) >= MUSIC_APP_ACTIVE
                } else {
                    false
                };
                let hold = self.music_hold.entry(exe.clone()).or_insert(0);
                *hold = if active { MUSIC_HOLD_TICKS } else { hold.saturating_sub(1) };
                let state = if !readable.contains(exe) && CHROMIUM_BROWSERS.contains(&exe.as_str()) {
                    // Can't see the audio process: never slow it down.
                    unknown.insert(exe.clone());
                    "unknown"
                } else if *hold > 0 {
                    playing.insert(exe.clone());
                    "playing"
                } else {
                    "paused"
                };
                music.push(GamingModeMusic { app: app_label(exe).into(), state: state.into(), processes: *count, source: "audio_activity".into() });
            }
            music.sort_by(|a, b| a.app.cmp(&b.app));
            self.status.music = music;

            // Browsers showing Twitch, Kick or YouTube in a visible window (any
            // monitor) are not slowed at all: the video decoder, GPU process and
            // tab renderer all keep full speed so the stream does not stutter or
            // drop quality, while the game stays at High.
            let mut watching: HashMap<String, String> = HashMap::new();
            for video in hint.as_ref().map(|h| h.videos.as_slice()).unwrap_or(&[]) {
                let label = if video.channel.is_empty() || video.site == "YouTube" { video.site.clone() } else { format!("{} ({})", video.site, video.channel) };
                watching.entry(video.exe.clone())
                    .and_modify(|current| if !current.contains(&label) { current.push_str(", "); current.push_str(&label); })
                    .or_insert(label);
            }
            for (pid, name, exe) in targets {
                let is_watching = watching.contains_key(&exe);
                let protected = is_watching || playing.contains(&exe) || unknown.contains(&exe) || exe == "firefox.exe";
                let audio_process = audio_pids.contains(&pid);
                // The audio process of a playing app keeps Normal priority. Other
                // processes can drop: Chromium audio threads run time-critical,
                // which a lower process class does not change.
                let want_lower = !(is_watching || (playing.contains(&exe) && audio_process));
                let want_throttle = if protected {
                    Some(native::Throttle::Off)
                } else if EFFICIENCY_EXES.contains(&exe.as_str()) {
                    Some(native::Throttle::On)
                } else {
                    None
                };
                let want_memory_low = !protected;
                self.apply_background(pid, &name, want_lower, want_throttle, want_memory_low, audio_process && protected);
            }

            // What the panel shows: every background app seen and what was done.
            let mut apps: std::collections::BTreeMap<&'static str, GamingModeBackgroundApp> = std::collections::BTreeMap::new();
            let discord_call = hint.as_ref().and_then(|h| h.discord_call);
            let discord_running = processes.iter().any(|p| DISCORD_EXES.contains(&p.name.to_ascii_lowercase().as_str()));
            self.status.discord_call = if discord_running { discord_call } else { None };
            self.adjust_discord(processes, discord_running && discord_call == Some(true));
            let live_note = match hint.as_ref().and_then(|h| h.live.as_ref()) {
                Some(live) if !live.platform.is_empty() => format!("LIVE on {} · never changed · stream left exactly as you set it", live.platform),
                Some(_) => "LIVE · never changed · stream left exactly as you set it".to_string(),
                None => "never slowed · streams stay clean".to_string(),
            };
            for process in processes {
                let exe = canonical_exe(&process.name);
                let label = app_label(&exe);
                let protected_note = match exe.as_str() {
                    "discord.exe" | "discordptb.exe" | "discordcanary.exe" => Some(match discord_call {
                        Some(true) => "in a voice call · raised to Above Normal so voice stays clear",
                        Some(false) => "not in a call · never slowed",
                        None => "never slowed · voice calls stay clean",
                    }),
                    "obs64.exe" | "obs32.exe" | "streamlabs obs.exe" | "streamlabs desktop.exe" => Some(live_note.as_str()),
                    _ => None,
                };
                if protected_note.is_none() && !BACKGROUND_EXES.contains(&exe.as_str()) { continue; }
                let entry = apps.entry(label).or_insert_with(|| GamingModeBackgroundApp { app: label.into(), ..Default::default() });
                entry.processes += 1;
                if let Some(note) = protected_note { entry.note = note.into(); continue; }
                if CHROMIUM_BROWSERS.contains(&exe.as_str()) {
                    let command = self.command_lines.entry(process.pid).or_insert_with(|| native::command_line(process.pid)).clone();
                    if command.is_some_and(|c| c.contains("--type=renderer") && !c.contains("--extension-process")) {
                        entry.tabs += 1;
                    }
                }
                if let Some(background) = self.background.get(&process.pid) {
                    if background.lowered { entry.lowered += 1; }
                    if background.throttle == Some(native::Throttle::On) { entry.efficiency += 1; }
                    if background.already_low { entry.already_low += 1; }
                }
                if let Some(sites) = watching.get(&exe) {
                    entry.note = format!("watching {sites} · video kept at full speed");
                } else if exe == "firefox.exe" {
                    entry.note = "not slowed · its audio can't be checked".into();
                } else if playing.contains(&exe) {
                    entry.note = "music playing · audio kept at full speed".into();
                } else if unknown.contains(&exe) {
                    entry.note = "can't check audio · not slowed".into();
                }
            }
            self.status.apps = apps.into_values().collect();
        }

        /// During a voice call Discord gets Above Normal and no power saving,
        /// so voice never stutters while the game runs at High. Undone when the
        /// call ends. Only changes Discord processes that are at Normal.
        fn adjust_discord(&mut self, processes: &[native::Process], in_call: bool) {
            if !in_call {
                self.restore_discord();
                return;
            }
            for process in processes {
                if !DISCORD_EXES.contains(&process.name.to_ascii_lowercase().as_str()) || self.discord_raised.contains(&process.pid) { continue; }
                match native::get_priority(process.pid) {
                    Ok(native::NORMAL) => match native::set_priority(process.pid, native::ABOVE_NORMAL) {
                        Ok(()) => {
                            let _ = native::set_power_throttling(process.pid, native::Throttle::Off);
                            self.discord_raised.insert(process.pid);
                        }
                        Err(message) => self.error(format!("discord:{}", process.pid), format!("Could not raise Discord for your call: {message}")),
                    },
                    _ => {}
                }
            }
        }

        fn restore_discord(&mut self) {
            for pid in std::mem::take(&mut self.discord_raised) {
                if native::get_priority(pid) == Ok(native::ABOVE_NORMAL) {
                    if let Err(message) = native::set_priority(pid, native::NORMAL) {
                        self.error(format!("discord-restore:{pid}"), format!("Could not return Discord to Normal: {message}"));
                    }
                }
                let _ = native::set_power_throttling(pid, native::Throttle::Default);
            }
        }

        fn apply_background(&mut self, pid: u32, name: &str, want_lower: bool, want_throttle: Option<native::Throttle>, want_memory_low: bool, refresh_throttle: bool) {
            let entry = self.background.entry(pid).or_insert_with(|| Background { name: name.to_string(), lowered: false, throttle: None, memory_low: false, already_low: false });
            let (lowered, throttle, memory_low) = (entry.lowered, entry.throttle, entry.memory_low);
            let mut errors = Vec::new();

            let mut new_lowered = lowered;
            let mut already_low = false;
            if want_lower && !lowered {
                // Only lower apps still at Normal; never touch something the user set.
                match native::get_priority(pid) {
                    Ok(native::NORMAL) => match native::set_priority(pid, native::BELOW_NORMAL) {
                        Ok(()) => new_lowered = true,
                        Err(message) => errors.push((format!("lower:{pid}"), format!("Could not lower {name}: {message}"))),
                    },
                    Ok(class) => already_low = matches!(class, native::BELOW_NORMAL | 0x40),
                    Err(_) => {}
                }
            } else if !want_lower && lowered {
                if native::get_priority(pid) == Ok(native::BELOW_NORMAL) {
                    if let Err(message) = native::set_priority(pid, native::NORMAL) {
                        errors.push((format!("restore:{pid}"), format!("Could not restore {name} for music: {message}")));
                    }
                }
                new_lowered = false;
            }

            let mut new_throttle = throttle;
            // Browsers switch their own processes into efficiency mode, so the
            // playing audio process is re-asserted every tick.
            if want_throttle != throttle || refresh_throttle {
                let mode = want_throttle.unwrap_or(native::Throttle::Default);
                match native::set_power_throttling(pid, mode) {
                    Ok(()) => new_throttle = want_throttle,
                    Err(message) => errors.push((format!("eco:{pid}"), format!("Could not change efficiency mode for {name}: {message}"))),
                }
            }

            let mut new_memory_low = memory_low;
            if want_memory_low != memory_low {
                match native::set_memory_priority(pid, want_memory_low) {
                    Ok(()) => new_memory_low = want_memory_low,
                    Err(message) => errors.push((format!("memory:{pid}"), format!("Could not change memory priority for {name}: {message}"))),
                }
            }

            if let Some(entry) = self.background.get_mut(&pid) {
                entry.already_low = already_low;
                entry.lowered = new_lowered;
                entry.throttle = new_throttle;
                entry.memory_low = new_memory_low;
            }
            for (key, message) in errors { self.error(key, message); }
        }

        fn restore_background(&mut self) {
            self.restore_discord();
            self.status.discord_call = None;
            for (pid, background) in std::mem::take(&mut self.background) {
                if background.lowered && native::get_priority(pid) == Ok(native::BELOW_NORMAL) {
                    if let Err(message) = native::set_priority(pid, native::NORMAL) {
                        self.error(format!("restore:{pid}"), format!("Could not restore {}: {message}", background.name));
                    }
                }
                if background.throttle.is_some() {
                    let _ = native::set_power_throttling(pid, native::Throttle::Default);
                }
                if background.memory_low {
                    let _ = native::set_memory_priority(pid, false);
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
        let privilege = native::enable_debug_privilege();
        let mut agent = Agent {
            status: GamingModeStatus {
                agent_pid: std::process::id(),
                agent_version: env!("CARGO_PKG_VERSION").into(),
                started_at_ms: now_ms(),
                state: "scanning".into(),
                ..Default::default()
            },
            paths: HashMap::new(),
            command_lines: HashMap::new(),
            cpu: HashMap::new(),
            boosted: HashMap::new(),
            background: HashMap::new(),
            music_hold: HashMap::new(),
            reported: HashSet::new(),
            discord_raised: HashSet::new(),
        };
        if let Err(message) = privilege {
            agent.error("privilege".into(), format!("Some browser processes may not be adjustable: {message}"));
        }
        let mut last_hint_apps = read_media_hint().map(|h| (h.apps, h.discord_call));
        loop {
            if !dir.join("enabled").exists() {
                agent.restore_all();
                agent.status.state = "stopped".into();
                agent.status.games.clear();
                agent.status.lowered.clear();
                agent.status.music.clear();
                agent.status.efficiency_mode = 0;
                agent.status.apps.clear();
                agent.write_status();
                return;
            }
            agent.tick();
            agent.write_status();
            // Wake early when music is paused or resumed so the browser or
            // music app is adjusted right away instead of on the next scan.
            let slept = Instant::now();
            while slept.elapsed() < TICK {
                std::thread::sleep(std::time::Duration::from_millis(250));
                let apps = read_media_hint().map(|h| (h.apps, h.discord_call));
                if apps != last_hint_apps {
                    last_hint_apps = apps;
                    break;
                }
            }
        }
    }
}

/// Fresh media hint from the Opti Gods app, or None when the app is closed.
#[cfg(windows)]
fn read_media_hint() -> Option<MediaHint> {
    let bytes = std::fs::read(data_dir().join("media.json")).ok()?;
    let hint: MediaHint = serde_json::from_slice(&bytes).ok()?;
    (now_ms().saturating_sub(hint.written_ms) <= 5_000).then_some(hint)
}

/// Called by the app's media watcher. Only writes while Gaming Mode's folder exists.
#[cfg(windows)]
pub(crate) fn write_media_hint(
    apps: std::collections::BTreeMap<String, bool>,
    discord_call: Option<bool>,
    videos: Vec<crate::commands::stream_watch::VideoWatch>,
    live: Option<crate::commands::stream_watch::LiveStream>,
) {
    let dir = data_dir();
    if !dir.join("enabled").exists() { return; }
    let hint = MediaHint { written_ms: now_ms(), apps, discord_call, videos, live };
    if let Ok(json) = serde_json::to_vec(&hint) {
        let tmp = dir.join("media.json.tmp");
        if std::fs::write(&tmp, json).is_ok() {
            let _ = std::fs::rename(&tmp, dir.join("media.json"));
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
        if BACKGROUND_EXES.contains(&lower.as_str()) {
            if current == Ok(native::BELOW_NORMAL) {
                let _ = native::set_priority(process.pid, native::NORMAL);
            }
            let _ = native::set_power_throttling(process.pid, native::Throttle::Default);
            let _ = native::set_memory_priority(process.pid, false);
        } else if DISCORD_EXES.contains(&lower.as_str()) && current == Ok(native::ABOVE_NORMAL) {
            let _ = native::set_priority(process.pid, native::NORMAL);
            let _ = native::set_power_throttling(process.pid, native::Throttle::Default);
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

/// Set once per app session after trying to replace an agent left by an older version.
#[cfg(windows)]
static AGENT_REFRESHED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[cfg(windows)]
static AGENT_REFRESH_ERROR: parking_lot::Mutex<Option<String>> = parking_lot::const_mutex(None);

#[tauri::command]
pub async fn gaming_mode_status() -> GamingModeStatus {
    // Instant music state for the agent while the app is open.
    crate::commands::now_playing::ensure_started();
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(|| {
            let mut status = read_status();
            // The agent is a copy of the app made when Gaming Mode was turned
            // on. After an app update, replace it so new Gaming Mode features
            // actually run.
            let outdated = status.enabled && !status.agent_version.is_empty() && status.agent_version != env!("CARGO_PKG_VERSION");
            if outdated && !AGENT_REFRESHED.swap(true, std::sync::atomic::Ordering::SeqCst) {
                match install_and_start_agent() {
                    Ok(fresh) => status = fresh,
                    Err(message) => *AGENT_REFRESH_ERROR.lock() = Some(format!("Could not update the Gaming Mode background service to v{}: {message}", env!("CARGO_PKG_VERSION"))),
                }
            }
            if let Some(message) = AGENT_REFRESH_ERROR.lock().clone() {
                status.errors.push(GamingModeError { at_ms: now_ms(), message });
            }
            status
        }).await.unwrap_or_default()
    }
    #[cfg(not(windows))]
    { GamingModeStatus::default() }
}

/// The app whose window is in front (what the user is tabbed into).
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct ForegroundApp {
    pub pid: u32,
    /// File name such as FiveM_b3258_GTAProcess.exe; empty when Windows hides it.
    pub exe: String,
}

#[tauri::command]
pub async fn foreground_app() -> Result<ForegroundApp, String> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
        let window = unsafe { GetForegroundWindow() };
        if window.0.is_null() {
            // Happens briefly while Windows switches windows or the lock screen is up.
            return Ok(ForegroundApp::default());
        }
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(window, Some(&mut pid)) };
        if pid == 0 {
            return Err("Windows did not report which app is in front.".into());
        }
        let exe = native::image_path(pid)
            .and_then(|path| path.rsplit(['\\', '/']).next().map(str::to_string))
            .unwrap_or_default();
        Ok(ForegroundApp { pid, exe })
    }
    #[cfg(not(windows))]
    { Err("Tab detection requires the Windows app.".into()) }
}

#[tauri::command]
pub async fn enable_gaming_mode() -> Result<GamingModeStatus, String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(install_and_start_agent).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    { Err("Gaming Mode requires the Windows app.".into()) }
}

/// Copies this .exe as the agent, registers the SYSTEM startup task and starts it.
#[cfg(windows)]
fn install_and_start_agent() -> Result<GamingModeStatus, String> {
    {
        {
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
        }
    }
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
