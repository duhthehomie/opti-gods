// Included by performance.rs. Admin diagnostics only: explicit start/stop,
// read-only sampling, no process priority changes, no injection, no tweaks.
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

/// While an explicit recording runs, sensors keep reading even when the game,
/// not Opti Gods, has focus. Cleared as soon as the recording stops.
static DIAGNOSTIC_ACTIVE: AtomicBool = AtomicBool::new(false);
/// Latest detected game PID, used by the cheap FPS readout between samples.
static LAST_GAME_PID: AtomicU32 = AtomicU32::new(0);

const RECORDING_INTERVAL_MS: u64 = 2000;
const RECORDING_MAX_SAMPLES: usize = 10_800; // six hours at one sample per two seconds
const RECORDING_MAX_ERRORS: usize = 200;

#[derive(Serialize, Clone, Debug, Default)]
pub struct FpsCaptureStatus {
    pub active: bool,
    pub source: Option<String>,
    pub error: Option<String>,
    pub started_at_ms: Option<u64>,
    pub game_pid: Option<u32>,
    pub fps: Option<f64>,
    pub frame_time_ms: Option<f64>,
    pub fps_status: String,
    /// Frames PresentMon reported for any app since capture started; separates
    /// "PresentMon sees nothing" from "the game is not presenting".
    pub frames_seen: u64,
    pub frame_column_missing: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct RecordingStatus {
    pub active: bool,
    pub phase: Option<String>,
    pub started_at_ms: Option<u64>,
    pub sample_count: usize,
    pub error_count: usize,
    pub interval_ms: u64,
    pub latest: Option<LivePerformance>,
    pub latest_error: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct RecordingResult {
    pub phase: String,
    pub started_at_ms: u64,
    pub ended_at_ms: u64,
    pub interval_ms: u64,
    pub samples: Vec<LivePerformance>,
    pub errors: Vec<RecordingError>,
    pub truncated: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct RecordingError {
    pub at_ms: u64,
    pub message: String,
}

struct RecordingSession {
    phase: String,
    started_at_ms: u64,
    stop: std::sync::Arc<AtomicBool>,
    samples: std::sync::Arc<parking_lot::Mutex<Vec<LivePerformance>>>,
    errors: std::sync::Arc<parking_lot::Mutex<Vec<RecordingError>>>,
    truncated: std::sync::Arc<AtomicBool>,
    worker: Option<std::thread::JoinHandle<()>>,
}

static RECORDING: parking_lot::Mutex<Option<RecordingSession>> = parking_lot::const_mutex(None);

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn diagnostics_keep_sensors() -> bool {
    DIAGNOSTIC_ACTIVE.load(Ordering::SeqCst)
}

/// Normalise a parsed sample: split text lists, stamp time, record the PID.
fn finish_sample(performance: &mut LivePerformance) {
    if performance.game_processes.is_empty() {
        if let Some(text) = performance.game_processes_text.as_deref() {
            performance.game_processes = text.lines().map(str::trim).filter(|v| !v.is_empty()).map(String::from).collect();
        }
    }
    if performance.sampled_at_ms.is_none() {
        performance.sampled_at_ms = Some(now_ms());
    }
    LAST_GAME_PID.store(performance.game_pid.filter(|_| performance.game_running).unwrap_or(0), Ordering::SeqCst);
    attach_fps(performance);
}

fn attach_fps(performance: &mut LivePerformance) {
    let status = fps_snapshot(performance.game_pid.filter(|_| performance.game_running));
    performance.fps = status.fps;
    performance.frame_time_ms = status.frame_time_ms;
    performance.fps_source = status.source;
    performance.fps_status = Some(status.fps_status);
}

// ─── FPS capture (PresentMon, official Intel release, pinned by hash) ─────────

#[cfg(windows)]
const PRESENTMON_URL: &str = "https://github.com/GameTechDev/PresentMon/releases/download/v2.3.0/PresentMon-2.3.0-x64.exe";
#[cfg(windows)]
const PRESENTMON_SHA256: &str = "690533cf5c2591ef571a3037aa4c205c8e75860ef3f56927bf3a98acf7198485";
#[cfg(windows)]
const PRESENTMON_SIZE: usize = 409_480;
#[cfg(windows)]
const PRESENTMON_SESSION: &str = "OptiGodsFrameCapture";
const FPS_SOURCE: &str = "PresentMon 2.3.0 presented frames, 2-second window";

#[cfg(windows)]
struct FpsCapture {
    child: std::process::Child,
    window: std::sync::Arc<parking_lot::Mutex<crate::commands::frame_metrics::FrameWindow>>,
    stderr_tail: std::sync::Arc<parking_lot::Mutex<String>>,
    started_at_ms: u64,
    executable: std::path::PathBuf,
}

#[cfg(windows)]
static FPS_CAPTURE: parking_lot::Mutex<Option<FpsCapture>> = parking_lot::const_mutex(None);
#[cfg(windows)]
static FPS_STARTING: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
static FPS_LAST_ERROR: parking_lot::Mutex<Option<String>> = parking_lot::const_mutex(None);

#[cfg(windows)]
fn presentmon_hash_ok(bytes: &[u8]) -> bool {
    use sha2::{Digest, Sha256};
    bytes.len() == PRESENTMON_SIZE && format!("{:x}", Sha256::digest(bytes)) == PRESENTMON_SHA256
}

#[cfg(windows)]
async fn ensure_presentmon(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("App data folder unavailable: {e}"))?
        .join("tools");
    let path = dir.join("PresentMon-2.3.0-x64.exe");
    if std::fs::read(&path).map(|b| presentmon_hash_ok(&b)).unwrap_or(false) {
        return Ok(path);
    }
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create the tools folder: {e}"))?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("OptiGods")
        .build()
        .map_err(|e| format!("HTTP client unavailable: {e}"))?;
    let response = client
        .get(PRESENTMON_URL)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("PresentMon download failed: {e}"))?;
    let bytes = response.bytes().await.map_err(|e| format!("PresentMon download failed: {e}"))?;
    if !presentmon_hash_ok(&bytes) {
        return Err("Downloaded PresentMon did not match the pinned official SHA-256; it was not run.".into());
    }
    let partial = dir.join("PresentMon-2.3.0-x64.exe.partial");
    std::fs::write(&partial, &bytes).map_err(|e| format!("Could not save PresentMon: {e}"))?;
    std::fs::rename(&partial, &path).map_err(|e| format!("Could not save PresentMon: {e}"))?;
    Ok(path)
}

#[cfg(windows)]
fn stop_fps_capture_inner() {
    let capture = FPS_CAPTURE.lock().take();
    if let Some(mut capture) = capture {
        let _ = capture.child.kill();
        let _ = capture.child.wait();
        // Kill leaves the named ETW session open; ask PresentMon to close it.
        let _ = Command::new(&capture.executable)
            .args(["--terminate_existing_session", "--session_name", PRESENTMON_SESSION])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x0800_0000)
            .spawn();
    }
}

fn fps_snapshot(game_pid: Option<u32>) -> FpsCaptureStatus {
    #[cfg(windows)]
    {
        let mut guard = FPS_CAPTURE.lock();
        let Some(capture) = guard.as_mut() else {
            return FpsCaptureStatus {
                error: FPS_LAST_ERROR.lock().clone(),
                fps_status: "capture_off".into(),
                game_pid,
                ..Default::default()
            };
        };
        if let Ok(Some(exit)) = capture.child.try_wait() {
            let tail = capture.stderr_tail.lock().trim().to_string();
            let message = format!(
                "FPS capture stopped ({exit}){}",
                if tail.is_empty() { String::new() } else { format!(": {tail}") }
            );
            *FPS_LAST_ERROR.lock() = Some(message.clone());
            *guard = None;
            return FpsCaptureStatus { error: Some(message), fps_status: "capture_stopped".into(), game_pid, ..Default::default() };
        }
        let (frames_seen, frame_column_missing) = {
            let window = capture.window.lock();
            (window.frames_seen(), window.frame_column_missing())
        };
        let mut status = FpsCaptureStatus {
            frames_seen,
            frame_column_missing,
            active: true,
            source: Some(FPS_SOURCE.into()),
            started_at_ms: Some(capture.started_at_ms),
            game_pid,
            ..Default::default()
        };
        match game_pid {
            None => status.fps_status = "no_game".into(),
            Some(pid) => match capture.window.lock().reading(pid) {
                Some((fps, ms)) => {
                    status.fps = Some((fps * 10.0).round() / 10.0);
                    status.frame_time_ms = Some((ms * 100.0).round() / 100.0);
                    status.fps_status = "measured".into();
                }
                // Minimised, loading, or not presenting: unavailable, never zero.
                None => status.fps_status = "no_recent_frames".into(),
            },
        }
        status
    }
    #[cfg(not(windows))]
    {
        FpsCaptureStatus { fps_status: "windows_only".into(), game_pid, ..Default::default() }
    }
}

/// Download (first use, user-confirmed in the UI) and start frame capture.
#[tauri::command]
pub async fn start_fps_capture(app: AppHandle) -> Result<FpsCaptureStatus, String> {
    #[cfg(windows)]
    {
        if FPS_CAPTURE.lock().is_some() {
            return Ok(fps_snapshot(current_game_pid()));
        }
        if FPS_STARTING.swap(true, Ordering::SeqCst) {
            return Err("FPS capture is already starting.".into());
        }
        let result = start_fps_capture_windows(&app).await;
        FPS_STARTING.store(false, Ordering::SeqCst);
        result
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("FPS capture is available in the Windows app.".into())
    }
}

#[cfg(windows)]
async fn start_fps_capture_windows(app: &AppHandle) -> Result<FpsCaptureStatus, String> {
    {
        use std::io::{BufRead, BufReader, Read};
        let executable = ensure_presentmon(app).await?;
        // Re-verify immediately before launch.
        let bytes = std::fs::read(&executable).map_err(|e| format!("PresentMon unreadable: {e}"))?;
        if !presentmon_hash_ok(&bytes) {
            return Err("PresentMon on disk no longer matches the pinned SHA-256; it was not run.".into());
        }
        let mut child = Command::new(&executable)
            .args([
                "--output_stdout",
                "--no_console_stats",
                "--v1_metrics",
                "--stop_existing_session",
                "--session_name",
                PRESENTMON_SESSION,
            ])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| format!("Could not start PresentMon: {e}"))?;
        let window = std::sync::Arc::new(parking_lot::Mutex::new(crate::commands::frame_metrics::FrameWindow::default()));
        let stderr_tail = std::sync::Arc::new(parking_lot::Mutex::new(String::new()));
        if let Some(stdout) = child.stdout.take() {
            let window = window.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines() {
                    let Ok(line) = line else { break };
                    window.lock().ingest(&line);
                }
            });
        }
        if let Some(mut stderr) = child.stderr.take() {
            let tail = stderr_tail.clone();
            std::thread::spawn(move || {
                let mut buffer = [0u8; 1024];
                while let Ok(n) = stderr.read(&mut buffer) {
                    if n == 0 { break; }
                    let mut text = tail.lock();
                    text.push_str(&String::from_utf8_lossy(&buffer[..n]));
                    if text.len() > 2048 {
                        let cut = text.len() - 2048;
                        let cut = (cut..text.len()).find(|i| text.is_char_boundary(*i)).unwrap_or(0);
                        text.drain(..cut);
                    }
                }
            });
        }
        *FPS_LAST_ERROR.lock() = None;
        *FPS_CAPTURE.lock() = Some(FpsCapture {
            child,
            window,
            stderr_tail,
            started_at_ms: now_ms(),
            executable,
        });
        Ok(fps_snapshot(current_game_pid()))
    }
}

#[tauri::command]
pub fn stop_fps_capture() -> Result<(), String> {
    #[cfg(windows)]
    {
        stop_fps_capture_inner();
        *FPS_LAST_ERROR.lock() = None;
    }
    Ok(())
}

/// Cheap readout (no PowerShell) for a live FPS display between samples.
#[tauri::command]
pub fn read_fps_capture() -> FpsCaptureStatus {
    fps_snapshot(current_game_pid())
}

fn current_game_pid() -> Option<u32> {
    match LAST_GAME_PID.load(Ordering::SeqCst) {
        0 => None,
        pid => Some(pid),
    }
}

// ─── Native recording session (keeps sampling while a game is fullscreen) ─────

#[tauri::command]
pub fn start_performance_capture(app: AppHandle, phase: String) -> Result<RecordingStatus, String> {
    if phase != "before" && phase != "after" {
        return Err("Recording phase must be before or after.".into());
    }
    let mut guard = RECORDING.lock();
    if let Some(session) = guard.as_ref() {
        return Err(format!("A {} recording is already running.", session.phase));
    }
    DIAGNOSTIC_ACTIVE.store(true, Ordering::SeqCst);
    let stop = std::sync::Arc::new(AtomicBool::new(false));
    let samples = std::sync::Arc::new(parking_lot::Mutex::new(Vec::<LivePerformance>::new()));
    let errors = std::sync::Arc::new(parking_lot::Mutex::new(Vec::new()));
    let truncated = std::sync::Arc::new(AtomicBool::new(false));
    let worker = {
        let (stop, samples, errors, truncated) = (stop.clone(), samples.clone(), errors.clone(), truncated.clone());
        std::thread::Builder::new()
            .name("optigods-recorder".into())
            .spawn(move || {
                while !stop.load(Ordering::SeqCst) {
                    let started = std::time::Instant::now();
                    match collect_live_performance_blocking(app.clone()) {
                        Ok(sample) => {
                            let mut rows = samples.lock();
                            // Keep only the newest icon in memory; it is identical per game.
                            if let Some(previous) = rows.last_mut() { previous.game_icon_png_base64 = None; }
                            if rows.len() < RECORDING_MAX_SAMPLES { rows.push(sample); } else { truncated.store(true, Ordering::SeqCst); }
                        }
                        Err(message) => {
                            let mut rows = errors.lock();
                            if rows.len() < RECORDING_MAX_ERRORS { rows.push(RecordingError { at_ms: now_ms(), message }); }
                        }
                    }
                    let deadline = started + std::time::Duration::from_millis(RECORDING_INTERVAL_MS);
                    while !stop.load(Ordering::SeqCst) && std::time::Instant::now() < deadline {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                }
            })
            .map_err(|e| {
                DIAGNOSTIC_ACTIVE.store(false, Ordering::SeqCst);
                format!("Could not start the recorder: {e}")
            })?
    };
    *guard = Some(RecordingSession {
        phase,
        started_at_ms: now_ms(),
        stop,
        samples,
        errors,
        truncated,
        worker: Some(worker),
    });
    drop(guard);
    Ok(performance_capture_status())
}

#[tauri::command]
pub fn performance_capture_status() -> RecordingStatus {
    let guard = RECORDING.lock();
    let Some(session) = guard.as_ref() else {
        return RecordingStatus { interval_ms: RECORDING_INTERVAL_MS, ..Default::default() };
    };
    let samples = session.samples.lock();
    let errors = session.errors.lock();
    RecordingStatus {
        active: true,
        phase: Some(session.phase.clone()),
        started_at_ms: Some(session.started_at_ms),
        sample_count: samples.len(),
        error_count: errors.len(),
        interval_ms: RECORDING_INTERVAL_MS,
        latest: samples.last().cloned(),
        latest_error: errors.last().map(|e| e.message.clone()),
    }
}

#[tauri::command]
pub async fn stop_performance_capture() -> Result<RecordingResult, String> {
    tokio::task::spawn_blocking(|| {
        let session = RECORDING.lock().take().ok_or_else(|| "No recording is running.".to_string())?;
        let RecordingSession { phase, started_at_ms, stop, samples, errors, truncated, worker } = session;
        stop.store(true, Ordering::SeqCst);
        // The worker finishes its current sample (bounded by one PowerShell run).
        if let Some(worker) = worker { let _ = worker.join(); }
        DIAGNOSTIC_ACTIVE.store(false, Ordering::SeqCst);
        let samples = std::mem::take(&mut *samples.lock());
        let errors = std::mem::take(&mut *errors.lock());
        Ok(RecordingResult {
            phase,
            started_at_ms,
            ended_at_ms: now_ms(),
            interval_ms: RECORDING_INTERVAL_MS,
            samples,
            errors,
            truncated: truncated.load(Ordering::SeqCst),
        })
    })
    .await
    .map_err(|e| format!("Recorder stop failed: {e}"))?
}

/// Called when the main window is destroyed: never leave capture running.
pub fn shutdown_diagnostics() {
    if let Some(session) = RECORDING.lock().take() {
        session.stop.store(true, Ordering::SeqCst);
    }
    DIAGNOSTIC_ACTIVE.store(false, Ordering::SeqCst);
    #[cfg(windows)]
    stop_fps_capture_inner();
}
