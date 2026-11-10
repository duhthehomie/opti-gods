// Now playing: what Windows media controls report (the same source as the
// volume flyout and lock screen): app, title, artist, play/pause state and
// cover art. Spotify, SoundCloud, YouTube and other browser players publish
// here. Play/pause and skip are sent only when the user presses a button.
// When a player gives no cover (the Microsoft Store SoundCloud app), the cover
// is looked up in public music catalogs by artist and title.
//
// A background thread checks every 400 ms so pause/resume shows immediately,
// and passes the play/pause state to the Gaming Mode agent (which runs as
// SYSTEM and cannot see media sessions itself).

use serde::Serialize;

#[derive(Serialize, Clone, Debug, Default)]
pub struct NowPlayingSession {
    /// Friendly app name ("Brave", "Spotify app", …).
    pub app: String,
    /// Lowercase exe when the app is recognised.
    pub exe: Option<String>,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// "playing" | "paused" | "stopped" | "changing" | "opened" | "closed"
    pub status: String,
    /// data: URL of the cover art, or an https catalog cover when the player has none.
    pub cover: Option<String>,
    /// Windows media session id, used for play/pause and skip.
    pub source_id: String,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct NowPlaying {
    pub sessions: Vec<NowPlayingSession>,
    pub updated_ms: u64,
    pub error: Option<String>,
    /// Discord is using the microphone (in a voice call). None: could not be read.
    pub discord_call: Option<bool>,
}

/// Catalog covers by "artist\u{1}title": None while looking up or not found.
static ONLINE_COVERS: parking_lot::Mutex<Option<std::collections::HashMap<String, Option<String>>>> = parking_lot::const_mutex(None);

fn words(text: &str) -> String {
    text.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect()
}

/// Same artist (either name contains the other) and same title start.
fn catalog_match(artist: &str, title: &str, found_artist: &str, found_title: &str) -> bool {
    let (a, fa) = (words(artist), words(found_artist));
    let (t, ft) = (words(title), words(found_title));
    !a.is_empty() && !t.is_empty() && (fa.contains(&a) || a.contains(&fa)) && (ft.starts_with(&t) || t.starts_with(&ft))
}

async fn lookup_cover(artist: String, title: String) -> Option<String> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("OptiGods/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(8))
        .build().ok()?;
    let term = format!("{artist} {title}");
    if let Ok(response) = client.get("https://itunes.apple.com/search")
        .query(&[("term", term.as_str()), ("entity", "song"), ("limit", "10")]).send().await {
        if let Ok(body) = response.json::<serde_json::Value>().await {
            for item in body["results"].as_array().into_iter().flatten() {
                if catalog_match(&artist, &title, item["artistName"].as_str().unwrap_or(""), item["trackName"].as_str().unwrap_or("")) {
                    if let Some(url) = item["artworkUrl100"].as_str() {
                        return Some(url.replace("100x100bb", "300x300bb"));
                    }
                }
            }
        }
    }
    if let Ok(response) = client.get("https://api.deezer.com/search").query(&[("q", term.as_str())]).send().await {
        if let Ok(body) = response.json::<serde_json::Value>().await {
            for item in body["data"].as_array().into_iter().flatten() {
                if catalog_match(&artist, &title, item["artist"]["name"].as_str().unwrap_or(""), item["title"].as_str().unwrap_or("")) {
                    if let Some(url) = item["album"]["cover_medium"].as_str() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Cached catalog cover; starts one lookup per track in the background.
fn online_cover(artist: &str, title: &str) -> Option<String> {
    if artist.trim().is_empty() || title.trim().is_empty() { return None; }
    let key = format!("{artist}\u{1}{title}");
    let mut guard = ONLINE_COVERS.lock();
    let map = guard.get_or_insert_with(Default::default);
    if let Some(found) = map.get(&key) { return found.clone(); }
    if map.len() > 64 { map.clear(); }
    map.insert(key.clone(), None);
    let (artist, title) = (artist.to_string(), title.to_string());
    tauri::async_runtime::spawn(async move {
        if let Some(url) = lookup_cover(artist, title).await {
            ONLINE_COVERS.lock().get_or_insert_with(Default::default).insert(key, Some(url));
        }
    });
    None
}

/// Discord is in a voice call when Windows shows it using the microphone
/// right now (privacy "recently used" record with no stop time).
#[cfg(windows)]
fn discord_in_call() -> Option<bool> {
    use winreg::{enums::{HKEY_CURRENT_USER, KEY_READ}, RegKey};
    let root = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(
        r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged", KEY_READ).ok()?;
    let mut active = false;
    for name in root.enum_keys().flatten() {
        if !name.to_ascii_lowercase().contains("discord") { continue; }
        let Ok(key) = root.open_subkey_with_flags(&name, KEY_READ) else { continue };
        let start: u64 = key.get_value("LastUsedTimeStart").unwrap_or(0);
        let stop: u64 = key.get_value("LastUsedTimeStop").unwrap_or(1);
        if start > 0 && stop == 0 { active = true; }
    }
    Some(active)
}

#[cfg(not(windows))]
fn discord_in_call() -> Option<bool> { None }

/// Play/pause, next or previous on one media session.
#[tauri::command]
pub async fn media_control(source_id: String, action: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager as Manager;
            use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
            let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
            let manager = Manager::RequestAsync().and_then(|op| op.get())
                .map_err(|e| format!("Windows media controls are unavailable: {}", e.message()))?;
            let sessions = manager.GetSessions().map_err(|e| e.message().to_string())?;
            let session = sessions.into_iter()
                .find(|s| s.SourceAppUserModelId().map(|id| id.to_string() == source_id).unwrap_or(false))
                .ok_or("That player is no longer open.")?;
            let sent = match action.as_str() {
                "toggle" => session.TryTogglePlayPauseAsync(),
                "next" => session.TrySkipNextAsync(),
                "previous" => session.TrySkipPreviousAsync(),
                other => return Err(format!("Unknown media action: {other}")),
            }.and_then(|op| op.get()).map_err(|e| format!("Windows did not send the command: {}", e.message()))?;
            if sent { Ok(()) } else { Err("The player ignored the command (it may not support it).".into()) }
        }).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    { let _ = (source_id, action); Err("Media controls require the Windows app.".into()) }
}

static STATE: parking_lot::Mutex<Option<NowPlaying>> = parking_lot::const_mutex(None);
static STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Media-session app id → (exe, label). Browsers register under their own name.
fn identify(app_id: &str) -> (Option<&'static str>, String) {
    let lower = app_id.to_ascii_lowercase();
    let known: &[(&str, &str, &str)] = &[
        ("brave", "brave.exe", "Brave"),
        ("msedge", "msedge.exe", "Edge"),
        ("microsoftedge", "msedge.exe", "Edge"),
        ("opera", "opera.exe", "Opera"),
        ("vivaldi", "vivaldi.exe", "Vivaldi"),
        ("chrome", "chrome.exe", "Chrome"),
        ("spotify", "spotify.exe", "Spotify app"),
        ("soundcloud", "soundcloud.exe", "SoundCloud app"),
        ("firefox", "firefox.exe", "Firefox"),
    ];
    for (needle, exe, label) in known {
        if lower.contains(needle) {
            return (Some(exe), (*label).to_string());
        }
    }
    let label = app_id.rsplit(['\\', '!']).next().unwrap_or(app_id).trim_end_matches(".exe").to_string();
    (None, if label.is_empty() { "Media app".into() } else { label })
}

/// Start the watcher once; later calls do nothing.
pub fn ensure_started() {
    if STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) { return; }
    #[cfg(windows)]
    {
        let spawned = std::thread::Builder::new().name("optigods-now-playing".into()).spawn(watcher::run);
        if let Err(error) = spawned {
            STARTED.store(false, std::sync::atomic::Ordering::SeqCst);
            *STATE.lock() = Some(NowPlaying { error: Some(format!("Could not start the media reader: {error}")), updated_ms: now_ms(), ..Default::default() });
        }
    }
}

#[tauri::command]
pub fn read_now_playing() -> NowPlaying {
    ensure_started();
    STATE.lock().clone().unwrap_or_default()
}

#[cfg(windows)]
mod watcher {
    use super::*;
    use std::collections::{BTreeMap, HashMap};
    use windows::core::Interface;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Storage::Streams::{DataReader, IInputStream};

    const POLL: std::time::Duration = std::time::Duration::from_millis(400);
    const MAX_COVER_BYTES: u64 = 1_500_000;

    fn status_name(status: Status) -> &'static str {
        match status {
            Status::Playing => "playing",
            Status::Paused => "paused",
            Status::Stopped => "stopped",
            Status::Changing => "changing",
            Status::Opened => "opened",
            _ => "closed",
        }
    }

    fn read_cover(session: &Session) -> Option<String> {
        let properties = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
        let thumbnail = properties.Thumbnail().ok()?;
        let stream = thumbnail.OpenReadAsync().ok()?.get().ok()?;
        let size = stream.Size().ok()?;
        if size == 0 || size > MAX_COVER_BYTES { return None; }
        let content_type = stream.ContentType().map(|t| t.to_string()).unwrap_or_default();
        let input: IInputStream = stream.cast().ok()?;
        let reader = DataReader::CreateDataReader(&input).ok()?;
        let loaded = reader.LoadAsync(size as u32).ok()?.get().ok()?;
        let mut bytes = vec![0u8; loaded as usize];
        reader.ReadBytes(&mut bytes).ok()?;
        let mime = if content_type.starts_with("image/") {
            content_type
        } else if bytes.starts_with(&[0xFF, 0xD8]) {
            "image/jpeg".into()
        } else {
            "image/png".into()
        };
        use base64::Engine;
        Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
    }

    fn read(manager: &Manager, covers: &mut HashMap<String, Option<String>>) -> windows::core::Result<Vec<NowPlayingSession>> {
        let mut out = Vec::new();
        for session in manager.GetSessions()? {
            let app_id = session.SourceAppUserModelId().map(|s| s.to_string()).unwrap_or_default();
            let (exe, app) = identify(&app_id);
            let status = session.GetPlaybackInfo().and_then(|info| info.PlaybackStatus()).map(status_name).unwrap_or("closed");
            let (title, artist, album) = match session.TryGetMediaPropertiesAsync().and_then(|op| op.get()) {
                Ok(p) => (
                    p.Title().map(|s| s.to_string()).unwrap_or_default(),
                    p.Artist().map(|s| s.to_string()).unwrap_or_default(),
                    p.AlbumTitle().map(|s| s.to_string()).unwrap_or_default(),
                ),
                Err(_) => Default::default(),
            };
            // Cover art only changes with the track: read it once per track.
            let key = format!("{app_id}\u{1}{title}\u{1}{artist}");
            let cover = match covers.get(&key) {
                Some(cover) => cover.clone(),
                None => {
                    let cover = read_cover(&session);
                    if covers.len() > 24 { covers.clear(); }
                    covers.insert(key, cover.clone());
                    cover
                }
            };
            let cover = cover.or_else(|| online_cover(&artist, &title));
            out.push(NowPlayingSession { app, exe: exe.map(str::to_string), title, artist, album, status: status.into(), cover, source_id: app_id });
        }
        // Playing first, so the panel shows what is audible.
        out.sort_by_key(|s| if s.status == "playing" { 0 } else { 1 });
        Ok(out)
    }

    pub fn run() {
        use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let manager = loop {
            match Manager::RequestAsync().and_then(|op| op.get()) {
                Ok(manager) => break manager,
                Err(error) => {
                    *STATE.lock() = Some(NowPlaying {
                        error: Some(format!("Windows media controls are unavailable: {}", error.message())),
                        updated_ms: now_ms(),
                        ..Default::default()
                    });
                    std::thread::sleep(std::time::Duration::from_secs(5));
                }
            }
        };
        let mut covers: HashMap<String, Option<String>> = HashMap::new();
        let mut last_hint: Option<(BTreeMap<String, bool>, Option<bool>)> = None;
        let mut last_hint_at = std::time::Instant::now();
        let mut discord_call = None;
        let mut loops: u32 = 0;
        loop {
            // The microphone record is cheap but not needed every 400 ms.
            if loops % 2 == 0 { discord_call = discord_in_call(); }
            loops = loops.wrapping_add(1);
            let (sessions, error) = match read(&manager, &mut covers) {
                Ok(sessions) => (sessions, None),
                Err(error) => (Vec::new(), Some(format!("Could not read Windows media controls: {}", error.message()))),
            };
            let mut hint: BTreeMap<String, bool> = BTreeMap::new();
            for session in &sessions {
                if let Some(exe) = &session.exe {
                    *hint.entry(exe.clone()).or_insert(false) |= session.status == "playing";
                }
            }
            // Pass on changes at once; refresh every 2 s so the agent knows the app is still open.
            let next = (hint, discord_call);
            if error.is_none() && (last_hint.as_ref() != Some(&next) || last_hint_at.elapsed() >= std::time::Duration::from_secs(2)) {
                crate::commands::gaming_mode::write_media_hint(next.0.clone(), next.1);
                last_hint = Some(next);
                last_hint_at = std::time::Instant::now();
            }
            *STATE.lock() = Some(NowPlaying { sessions, updated_ms: now_ms(), error, discord_call });
            std::thread::sleep(POLL);
        }
    }
}
