//! Streaming and video-watching detection for Gaming Mode. Read-only.
//!
//! - Watching and listening: every tab of every browser window is read through
//!   Windows UI Automation (the tab strip only, never page content). Chromium
//!   browsers mark tabs that play sound, so a Twitch stream in one tab and
//!   SoundCloud in another are both seen, each marked tabbed in or out. When
//!   the tab strip cannot be read, the window title (showing tab) is used.
//!   The quality picked in the player cannot be read from outside the browser.
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
    /// Channel name (Twitch/Kick) or video title (YouTube), from the tab title.
    pub channel: String,
    /// The tab is the one showing in its browser window ("tabbed in").
    #[serde(default)]
    pub active: bool,
    /// The browser marks the tab as playing sound (Chromium browsers only).
    #[serde(default)]
    pub audible: bool,
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

/// Drops a leading notification count such as "(3) ".
fn strip_count(text: &str) -> &str {
    if let Some(rest) = text.strip_prefix('(') {
        if let Some(close) = rest.find(')') {
            let inside = &rest[..close];
            if !inside.is_empty() && inside.chars().all(|c| c.is_ascii_digit() || c == '+') {
                return rest[close + 1..].trim_start();
            }
        }
    }
    text
}

/// Site and channel from a browser window title, e.g. "xQc - Twitch - Brave".
pub(crate) fn classify_title(title: &str) -> Option<(&'static str, String)> {
    let clean = |s: &str| strip_count(s.trim().trim_matches(['-', '|', '—', '·']).trim()).to_string();
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

/// What the tab's accessible name says about its sound. Chromium browsers
/// (Chrome, Edge, Brave, Opera, Vivaldi) append these to the tab title.
const TAB_STATE_SUFFIXES: &[&str] = &[
    " - Audio playing", " - Audio muted", " - Picture-in-picture playing",
    " - Camera or microphone recording", " - Camera recording", " - Microphone recording",
    " - Network error", " - Crashed", " - Pinned",
];

/// Tab title without the browser's state suffixes, and whether it plays sound.
pub(crate) fn split_tab_name(name: &str) -> (String, bool) {
    let audible = name.contains(" - Audio playing") || name.contains(" - Picture-in-picture playing");
    let cut = TAB_STATE_SUFFIXES.iter().filter_map(|suffix| name.find(suffix)).min().unwrap_or(name.len());
    (name[..cut].trim().to_string(), audible)
}

/// Music site named in a tab title, when the site puts its name there.
pub(crate) fn music_site(title: &str) -> &'static str {
    let lower = title.to_ascii_lowercase();
    if lower.contains("youtube music") { "YouTube Music" }
    else if lower.contains("soundcloud") { "SoundCloud" }
    else if lower.contains("spotify") { "Spotify" }
    else if lower.contains("apple music") { "Apple Music" }
    else if lower.contains("deezer") { "Deezer" }
    else if lower.contains("tidal") { "TIDAL" }
    else if lower.contains("pandora") { "Pandora" }
    else if lower.contains("audiomack") { "Audiomack" }
    else if lower.contains("bandcamp") { "Bandcamp" }
    else { "" }
}

/// Track name from a music tab title, without the site's own words.
fn music_title(title: &str) -> String {
    let mut out = title.trim().trim_start_matches(['▶', '►', '❚', '\u{fe0e}', ' ']).to_string();
    for marker in [" | Listen online for free on SoundCloud", " | Free Listening on SoundCloud", " - YouTube Music", " | Spotify", " - Spotify", " on Apple Music"] {
        if let Some(index) = out.find(marker) { out.truncate(index); }
    }
    out.trim().to_string()
}

/// One browser tab playing music (SoundCloud, Spotify web, YouTube Music…).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct MusicTab {
    /// "SoundCloud", "Spotify", … or "" when the tab title does not name the site.
    pub site: String,
    /// Lowercase browser exe, e.g. brave.exe.
    pub exe: String,
    /// Track as the tab shows it, e.g. "song by artist".
    pub title: String,
    /// The tab is the one showing in its browser window ("tabbed in").
    pub active: bool,
}

/// Streams/videos and music found in browser tabs.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct BrowserMedia {
    pub videos: Vec<VideoWatch>,
    pub music: Vec<MusicTab>,
}

/// Sorts one browser tab into a stream/video, music, or nothing.
/// Video sites count when the tab is showing or plays sound; any other tab
/// counts as music only while the browser marks it as playing sound.
pub(crate) fn classify_tab(name: &str, exe: &str, selected: bool, sound_known: bool, out: &mut BrowserMedia) {
    let (title, audible) = split_tab_name(name);
    if title.is_empty() { return; }
    if let Some((site, channel)) = classify_title(&title) {
        if selected || audible {
            out.videos.push(VideoWatch { site: site.into(), exe: exe.into(), channel, active: selected, audible });
        }
        return;
    }
    if sound_known && audible {
        let track = music_title(&title);
        if !track.is_empty() {
            out.music.push(MusicTab { site: music_site(&title).into(), exe: exe.into(), title: track, active: selected });
        }
    }
}

#[cfg(windows)]
mod tab_reader {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED};
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomation2, IUIAutomationElement, IUIAutomationSelectionItemPattern,
        IUIAutomationTreeWalker, UIA_DocumentControlTypeId, UIA_SelectionItemPatternId, UIA_TabControlTypeId,
        UIA_TabItemControlTypeId,
    };
    use windows::core::Interface;

    /// Most elements visited per window, so a page-heavy window stays cheap.
    const MAX_NODES: usize = 400;

    pub struct TabReader {
        automation: IUIAutomation,
        walker: IUIAutomationTreeWalker,
    }

    impl TabReader {
        pub fn new() -> Option<Self> {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                let automation: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok()?;
                // A hung browser must not stall the reader for long.
                if let Ok(automation2) = automation.cast::<IUIAutomation2>() {
                    let _ = automation2.SetConnectionTimeout(1500);
                    let _ = automation2.SetTransactionTimeout(1500);
                }
                let walker = automation.ControlViewWalker().ok()?;
                Some(Self { automation, walker })
            }
        }

        /// (accessible name, selected) for each tab in the window's tab strip.
        /// None when no tab strip was found. Web pages are never walked.
        pub fn tabs(&self, window: HWND) -> Option<Vec<(String, bool)>> {
            unsafe {
                let root = self.automation.ElementFromHandle(window).ok()?;
                let mut visited = 0usize;
                let strip = self.find_tab_strip(&root, 0, &mut visited)?;
                let mut out = Vec::new();
                self.collect_tabs(&strip, 0, &mut out);
                (!out.is_empty()).then_some(out)
            }
        }

        unsafe fn children(&self, element: &IUIAutomationElement) -> Vec<IUIAutomationElement> {
            let mut out = Vec::new();
            let mut next = self.walker.GetFirstChildElement(element).ok();
            while let Some(child) = next {
                next = self.walker.GetNextSiblingElement(&child).ok();
                out.push(child);
                if out.len() > 200 { break; }
            }
            out
        }

        unsafe fn find_tab_strip(&self, element: &IUIAutomationElement, depth: usize, visited: &mut usize) -> Option<IUIAutomationElement> {
            if depth > 12 || *visited >= MAX_NODES { return None; }
            *visited += 1;
            let kind = element.CurrentControlType().ok()?;
            if kind == UIA_DocumentControlTypeId { return None; }
            if kind == UIA_TabControlTypeId {
                let has_tabs = self.children(element).iter().any(|child| {
                    child.CurrentControlType().map(|k| k == UIA_TabItemControlTypeId).unwrap_or(false)
                        || self.children(child).iter().any(|inner| inner.CurrentControlType().map(|k| k == UIA_TabItemControlTypeId).unwrap_or(false))
                });
                if has_tabs { return Some(element.clone()); }
            }
            for child in self.children(element) {
                if let Some(found) = self.find_tab_strip(&child, depth + 1, visited) { return Some(found); }
            }
            None
        }

        /// Tabs can sit directly in the strip or inside tab groups.
        unsafe fn collect_tabs(&self, element: &IUIAutomationElement, depth: usize, out: &mut Vec<(String, bool)>) {
            if depth > 3 || out.len() > 200 { return; }
            for child in self.children(element) {
                let kind = child.CurrentControlType().unwrap_or_default();
                if kind == UIA_TabItemControlTypeId {
                    let name = child.CurrentName().map(|n| n.to_string()).unwrap_or_default();
                    let selected = child
                        .GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(UIA_SelectionItemPatternId)
                        .and_then(|pattern| pattern.CurrentIsSelected())
                        .map(|b| b.as_bool())
                        .unwrap_or(false);
                    if !name.is_empty() { out.push((name, selected)); }
                } else if kind != UIA_DocumentControlTypeId {
                    self.collect_tabs(&child, depth + 1, out);
                }
            }
        }
    }
}

/// One scan of every browser window and its tabs.
#[cfg(windows)]
fn scan_browsers(reader: Option<&tab_reader::TabReader>) -> BrowserMedia {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    };

    unsafe extern "system" fn collect(window: HWND, data: LPARAM) -> BOOL {
        let list = &mut *(data.0 as *mut Vec<(HWND, String)>);
        if IsWindowVisible(window).as_bool() {
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
    let mut out = BrowserMedia::default();
    for (window, title) in windows_found {
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(window, Some(&mut pid)) };
        if pid == 0 { continue; }
        let exe = exe_by_pid.entry(pid).or_insert_with(|| {
            crate::commands::gaming_mode::native::image_path(pid)
                .and_then(|path| path.rsplit(['\\', '/']).next().map(|s| s.to_ascii_lowercase()))
                .unwrap_or_default()
        }).clone();
        if !VIDEO_BROWSERS.contains(&exe.as_str()) { continue; }
        let minimized = unsafe { IsIconic(window).as_bool() };
        // Chromium browsers say which tab plays sound; Firefox does not.
        let sound_known = exe != "firefox.exe";
        match reader.and_then(|reader| reader.tabs(window)) {
            Some(tabs) => {
                for (name, selected) in tabs {
                    classify_tab(&name, &exe, selected && !minimized, sound_known, &mut out);
                }
            }
            None => {
                // No tab strip readable: the window title is the showing tab.
                if minimized { continue; }
                if let Some((site, channel)) = classify_title(&title) {
                    out.videos.push(VideoWatch { site: site.into(), exe: exe.clone(), channel, active: true, audible: false });
                }
            }
        }
    }
    out.videos.sort();
    out.videos.dedup();
    out.music.sort();
    out.music.dedup();
    out
}

#[cfg(windows)]
static BROWSER_MEDIA: parking_lot::Mutex<Option<BrowserMedia>> = parking_lot::const_mutex(None);
#[cfg(windows)]
static BROWSER_SCAN_STARTED: std::sync::Once = std::sync::Once::new();

/// Twitch, Kick and YouTube tabs plus music tabs in every browser window,
/// including tabs you are not looking at. Scanned on its own thread so a slow
/// browser never delays the media controls.
#[cfg(windows)]
pub fn browser_media() -> BrowserMedia {
    BROWSER_SCAN_STARTED.call_once(|| {
        let _ = std::thread::Builder::new().name("og-browser-tabs".into()).spawn(|| {
            let reader = tab_reader::TabReader::new();
            loop {
                let media = scan_browsers(reader.as_ref());
                *BROWSER_MEDIA.lock() = Some(media);
                std::thread::sleep(std::time::Duration::from_millis(1200));
            }
        });
    });
    BROWSER_MEDIA.lock().clone().unwrap_or_default()
}

#[cfg(not(windows))]
pub fn browser_media() -> BrowserMedia { BrowserMedia::default() }

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
        assert_eq!(classify_title("(3) MuTeX - Twitch"), Some(("Twitch", "MuTeX".into())));
        assert_eq!(classify_title("(12) Some video - YouTube"), Some(("YouTube", "Some video".into())));
    }

    #[test]
    fn reads_every_tab() {
        let mut media = BrowserMedia::default();
        classify_tab("(3) MuTeX - Twitch - Audio playing", "brave.exe", false, true, &mut media);
        classify_tab("rave hoe in da cut by bleood - Audio playing", "brave.exe", true, true, &mut media);
        classify_tab("Inbox - Gmail", "brave.exe", false, true, &mut media);
        classify_tab("Paused video - YouTube", "brave.exe", false, true, &mut media);
        assert_eq!(media.videos, vec![VideoWatch { site: "Twitch".into(), exe: "brave.exe".into(), channel: "MuTeX".into(), active: false, audible: true }]);
        assert_eq!(media.music, vec![MusicTab { site: "".into(), exe: "brave.exe".into(), title: "rave hoe in da cut by bleood".into(), active: true }]);
        let mut firefox = BrowserMedia::default();
        classify_tab("Song", "firefox.exe", true, false, &mut firefox);
        classify_tab("xQc - Twitch", "firefox.exe", true, false, &mut firefox);
        assert!(firefox.music.is_empty());
        assert_eq!(firefox.videos.len(), 1);
        assert_eq!(split_tab_name("Track | Listen online for free on SoundCloud - Audio playing"), ("Track | Listen online for free on SoundCloud".into(), true));
        assert_eq!(music_site("Track | Listen online for free on SoundCloud"), "SoundCloud");
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
