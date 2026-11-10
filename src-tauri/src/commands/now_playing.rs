// Now playing: what Windows media controls report (the same source as the
// volume flyout and lock screen): app, title, artist, play/pause state and
// cover art. Spotify, SoundCloud, YouTube and other browser players publish
// here. Read-only; nothing is controlled.
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
    /// data: URL of the cover art, when the player provides one.
    pub cover: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct NowPlaying {
    pub sessions: Vec<NowPlayingSession>,
    pub updated_ms: u64,
    pub error: Option<String>,
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
            out.push(NowPlayingSession { app, exe: exe.map(str::to_string), title, artist, album, status: status.into(), cover });
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
        let mut last_hint: Option<BTreeMap<String, bool>> = None;
        let mut last_hint_at = std::time::Instant::now();
        loop {
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
            if error.is_none() && (last_hint.as_ref() != Some(&hint) || last_hint_at.elapsed() >= std::time::Duration::from_secs(2)) {
                crate::commands::gaming_mode::write_media_hint(hint.clone());
                last_hint = Some(hint);
                last_hint_at = std::time::Instant::now();
            }
            *STATE.lock() = Some(NowPlaying { sessions, updated_ms: now_ms(), error });
            std::thread::sleep(POLL);
        }
    }
}
