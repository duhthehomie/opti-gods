//! Streaming and video-watching detection for Gaming Mode. Read-only.
//!
//! - Watching: Twitch, Kick or YouTube open in a browser window on any monitor,
//!   read from window titles. Only the visible tab of each browser window has
//!   a title, so a stream in a background tab is not seen. The quality picked
//!   in the player cannot be read from outside the browser.
//! - Live: OBS Studio writes "==== Streaming Start" / "==== Streaming Stop" to
//!   its own log, and the RTMP URL it connects to. Streamlabs runs the same
//!   engine; its log is read the same way when present. Nothing in OBS or
//!   Streamlabs is changed: no settings, no priority, no files written.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct VideoWatch {
    /// "Twitch" | "Kick" | "YouTube"
    pub site: String,
    /// Lowercase browser exe, e.g. brave.exe.
    pub exe: String,
    /// Channel name (Twitch/Kick) or video title (YouTube), from the window title.
    pub channel: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct LiveStream {
    /// "OBS Studio" | "Streamlabs"
    pub app: String,
    /// "Twitch" | "Kick" | "YouTube" | "" when the stream URL is not recognised.
    pub platform: String,
}

/// Position of `marker` when it is followed by the end or a non-letter
/// (so " - Kick" does not match " - Kickstarter").
fn find_marker(title: &str, marker: &str) -> Option<usize> {
    let mut start = 0;
    while let Some(found) = title[start..].find(marker) {
        let index = start + found;
        let after = title[index + marker.len()..].chars().next();
        if after.map_or(true, |c| !c.is_alphanumeric()) { return Some(index); }
        start = index + marker.len();
    }
    None
}

/// Site and channel from a browser window title, e.g. "xQc - Twitch - Brave".
pub(crate) fn classify_title(title: &str) -> Option<(&'static str, String)> {
    let clean = |s: &str| s.trim().trim_matches(['-', '|', '—', '·']).trim().to_string();
    if let Some(index) = find_marker(title, " - Twitch") {
        let channel = clean(&title[..index]);
        return (!channel.is_empty()).then_some(("Twitch", channel));
    }
    for marker in [" Stream - Watch Live on Kick", " | Kick", " - Kick", " — Kick", " on Kick"] {
        if let Some(index) = find_marker(title, marker) {
            let channel = clean(&title[..index]);
            return (!channel.is_empty()).then_some(("Kick", channel));
        }
    }
    if let Some(index) = find_marker(title, " - YouTube") {
        // YouTube Music is music, handled by Now Playing.
        if title[index..].starts_with(" - YouTube Music") { return None; }
        let video = clean(&title[..index]);
        // The home page and search have no video title.
        return (!video.is_empty() && video != "YouTube").then_some(("YouTube", video));
    }
    None
}

/// Platform from the RTMP URL OBS logs when it connects.
pub(crate) fn platform_from_url(url: &str) -> &'static str {
    let lower = url.to_ascii_lowercase();
    // Kick ingests through Amazon IVS on its own host; Twitch uses the same network.
    if lower.contains("kick") || lower.contains("fa723fc1b171") { "Kick" }
    else if lower.contains("twitch") || lower.contains("live-video.net") { "Twitch" }
    else if lower.contains("youtube") { "YouTube" }
    else { "" }
}

#[cfg(windows)]
const VIDEO_BROWSERS: &[&str] = &["chrome.exe", "msedge.exe", "brave.exe", "opera.exe", "vivaldi.exe", "firefox.exe"];

/// Visible, non-minimised browser windows showing Twitch, Kick or YouTube.
#[cfg(windows)]
pub fn browser_videos() -> Vec<VideoWatch> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    };

    unsafe extern "system" fn collect(window: HWND, data: LPARAM) -> BOOL {
        let list = &mut *(data.0 as *mut Vec<(HWND, String)>);
        if IsWindowVisible(window).as_bool() && !IsIconic(window).as_bool() {
            let mut buffer = [0u16; 512];
            let len = GetWindowTextW(window, &mut buffer);
            if len > 0 {
                list.push((window, String::from_utf16_lossy(&buffer[..len as usize])));
            }
        }
        BOOL(1)
    }

    let mut windows_found: Vec<(HWND, String)> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut windows_found as *mut _ as isize));
    }
    let mut exe_by_pid: std::collections::HashMap<u32, String> = std::collections::HashMap::new();
    let mut out: Vec<VideoWatch> = Vec::new();
    for (window, title) in windows_found {
        let Some((site, channel)) = classify_title(&title) else { continue };
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(window, Some(&mut pid)) };
        if pid == 0 { continue; }
        let exe = exe_by_pid.entry(pid).or_insert_with(|| {
            crate::commands::gaming_mode::native::image_path(pid)
                .and_then(|path| path.rsplit(['\\', '/']).next().map(|s| s.to_ascii_lowercase()))
                .unwrap_or_default()
        }).clone();
        if !VIDEO_BROWSERS.contains(&exe.as_str()) { continue; }
        out.push(VideoWatch { site: site.into(), exe, channel });
    }
    out.sort();
    out.dedup();
    out
}

#[cfg(not(windows))]
pub fn browser_videos() -> Vec<VideoWatch> { Vec::new() }

/// Follows one app's newest log file and remembers whether it is streaming.
#[derive(Default)]
struct LogFollower {
    path: Option<std::path::PathBuf>,
    offset: u64,
    live: bool,
    platform: String,
    partial: String,
}

impl LogFollower {
    fn newest_log(dir: &std::path::Path) -> Option<std::path::PathBuf> {
        std::fs::read_dir(dir).ok()?
            .flatten()
            .filter(|entry| entry.path().extension().is_some_and(|ext| ext.eq_ignore_ascii_case("txt")))
            .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
            .max_by_key(|(modified, _)| *modified)
            .map(|(_, path)| path)
    }

    /// Reads only the new part of the log since the last call.
    fn update(&mut self, dir: &std::path::Path) {
        use std::io::{Read, Seek, SeekFrom};
        let Some(newest) = Self::newest_log(dir) else { return };
        if self.path.as_ref() != Some(&newest) {
            *self = LogFollower { path: Some(newest.clone()), ..Default::default() };
        }
        let Ok(mut file) = std::fs::File::open(&newest) else { return };
        let Ok(len) = file.metadata().map(|m| m.len()) else { return };
        if len < self.offset { *self = LogFollower { path: Some(newest.clone()), ..Default::default() }; }
        if len == self.offset { return; }
        // Cap one read; the rest is read on the next tick.
        let want = (len - self.offset).min(8 * 1024 * 1024);
        if file.seek(SeekFrom::Start(self.offset)).is_err() { return; }
        let mut bytes = vec![0u8; want as usize];
        let Ok(read) = file.read(&mut bytes) else { return };
        bytes.truncate(read);
        self.offset += read as u64;
        let text = format!("{}{}", std::mem::take(&mut self.partial), String::from_utf8_lossy(&bytes));
        let mut lines: Vec<&str> = text.split('\n').collect();
        // Keep an unfinished last line for the next read.
        let tail = lines.pop().unwrap_or("").to_string();
        for line in lines {
            if line.contains("==== Streaming Start") {
                self.live = true;
            } else if line.contains("==== Streaming Stop") {
                self.live = false;
            } else if line.contains("Connecting to RTMP URL") {
                if let Some(url) = line.split("Connecting to RTMP URL").nth(1) {
                    self.platform = platform_from_url(url.trim()).into();
                }
            }
        }
        self.partial = tail;
    }
}

/// Live-stream detector. Call `poll` every few seconds.
#[derive(Default)]
pub struct LiveDetector {
    obs: LogFollower,
    streamlabs: LogFollower,
}

impl LiveDetector {
    #[cfg(windows)]
    pub fn poll(&mut self) -> Option<LiveStream> {
        let processes = crate::commands::gaming_mode::native::list().ok()?;
        let names: Vec<String> = processes.iter().map(|p| p.name.to_ascii_lowercase()).collect();
        let streamlabs_running = names.iter().any(|n| n.starts_with("streamlabs"));
        let obs_running = names.iter().any(|n| n == "obs64.exe" || n == "obs32.exe");
        let appdata = std::env::var_os("APPDATA").map(std::path::PathBuf::from)?;

        if streamlabs_running {
            self.streamlabs.update(&appdata.join(r"slobs-client\node-obs\logs"));
            if self.streamlabs.live {
                return Some(LiveStream { app: "Streamlabs".into(), platform: self.streamlabs.platform.clone() });
            }
        }
        // Streamlabs runs its own obs64.exe; only treat it as OBS Studio when
        // OBS Studio's log says it is streaming.
        if obs_running {
            self.obs.update(&appdata.join(r"obs-studio\logs"));
            if self.obs.live {
                return Some(LiveStream { app: "OBS Studio".into(), platform: self.obs.platform.clone() });
            }
        } else {
            // OBS closed (or crashed) without a stop line: not live.
            self.obs.live = false;
        }
        if !streamlabs_running { self.streamlabs.live = false; }
        None
    }

    #[cfg(not(windows))]
    pub fn poll(&mut self) -> Option<LiveStream> { None }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_sites_from_titles() {
        assert_eq!(classify_title("xQc - Twitch - Brave"), Some(("Twitch", "xQc".into())));
        assert_eq!(classify_title("Twitch - Brave"), None);
        assert_eq!(classify_title("adin | Kick - Google Chrome"), Some(("Kick", "adin".into())));
        assert_eq!(classify_title("Some video - YouTube - Brave"), Some(("YouTube", "Some video".into())));
        assert_eq!(classify_title("YouTube - Brave"), None);
        assert_eq!(classify_title("Song - YouTube Music - Brave"), None);
        assert_eq!(classify_title("Inbox - Gmail"), None);
        assert_eq!(classify_title("Project - Kickstarter - Brave"), None);
        assert_eq!(classify_title("xqc Stream - Watch Live on Kick - Brave"), Some(("Kick", "xqc".into())));
    }

    #[test]
    fn reads_platform_from_url() {
        assert_eq!(platform_from_url("rtmps://fa723fc1b171.global-contribute.live-video.net/app/"), "Kick");
        assert_eq!(platform_from_url("rtmp://ingest.global-contribute.live-video.net/app"), "Twitch");
        assert_eq!(platform_from_url("rtmp://a.rtmp.youtube.com/live2"), "YouTube");
    }

    #[test]
    fn follows_streaming_start_and_stop() {
        let dir = std::env::temp_dir().join(format!("og-obs-log-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let log = dir.join("2026-11-10 10-00-00.txt");
        std::fs::write(&log, "a\n[rtmp stream: 'adv_stream'] Connecting to RTMP URL rtmp://ingest.global-contribute.live-video.net/app\n==== Streaming Start ====\n").unwrap();
        let mut follower = LogFollower::default();
        follower.update(&dir);
        assert!(follower.live);
        assert_eq!(follower.platform, "Twitch");
        std::fs::write(&log, "a\n[rtmp stream: 'adv_stream'] Connecting to RTMP URL rtmp://ingest.global-contribute.live-video.net/app\n==== Streaming Start ====\n==== Streaming Stop ====\n").unwrap();
        follower.update(&dir);
        assert!(!follower.live);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
