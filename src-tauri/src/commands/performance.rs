use serde::{Deserialize, Serialize};
include!("nvidia_temperature.rs");
include!("cpu_sensors.rs");
include!("diagnostic_capture.rs");
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RunningProcess {
    pub name: String,
    pub visible: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct LivePerformance {
    pub live: bool,
    pub cpu_load_pct: Option<f32>,
    pub gpu_load_pct: Option<f32>,
    pub ram_total_gb: Option<f32>,
    pub ram_free_gb: Option<f32>,
    pub ram_used_pct: Option<f32>,
    pub cpu_temp_c: Option<f32>,
    pub gpu_temp_c: Option<f32>,
    pub board_temp_c: Option<f32>,
    pub cpu_sensor_status: Option<String>,
    pub cpu_sensor_name: Option<String>,
    /// Task Manager-style total process count. Individual process names are
    /// intentionally not exported by the performance recorder.
    pub running_processes_count: Option<u32>,
    /// Number of user-facing processes with a top-level window.
    pub visible_apps_count: Option<u32>,
    /// True when any FiveM process is present, including the launcher.
    pub fivem_running: bool,
    /// True only when a supported game process is present, not just a launcher.
    pub game_running: bool,
    /// Stable Opti Gods identifier for the active game process.
    pub game_id: Option<String>,
    /// User-facing game name for the admin recorder menu.
    pub game_label: Option<String>,
    /// Process image that caused the active-game match.
    pub game_process: Option<String>,
    /// The detected game process image names, kept small and useful for
    /// diagnosing launcher-vs-game confusion.
    pub game_processes: Vec<String>,
    /// The latest connection target exposed by CitizenFX.log while the game is running.
    pub server_target: Option<String>,
    /// Newline-separated process image names observed in this sample.
    /// Kept as text so PowerShell always serializes an unambiguous JSON string,
    /// including when exactly one process is present.
    pub process_names_text: Option<String>,
    /// Newline-separated visible application image names observed in this sample.
    pub visible_app_names_text: Option<String>,
    /// Newline-separated game image names (PowerShell 5.1-safe form of game_processes).
    pub game_processes_text: Option<String>,
    pub game_pid: Option<u32>,
    /// "server" or "main_menu", derived only from current-session CitizenFX log events.
    pub fivem_session_state: Option<String>,
    pub server_evidence: Option<String>,
    /// Partial failures inside the sampler; never hidden behind a zero value.
    pub telemetry_error: Option<String>,
    pub sampled_at_ms: Option<u64>,
    pub os_caption: Option<String>,
    pub os_version: Option<String>,
    pub os_build: Option<String>,
    /// Presented FPS from explicit PresentMon capture; None when not measured.
    pub fps: Option<f64>,
    pub frame_time_ms: Option<f64>,
    pub fps_status: Option<String>,
    pub fps_source: Option<String>,
    /// known_game | library_path | gpu_usage — how the game was identified.
    pub game_detection: Option<String>,
    pub game_window_title: Option<String>,
    /// Server hostname from FiveM's window title (owner-configured, may be generic).
    pub server_title: Option<String>,
    /// Small PNG of the game's own .exe icon, only for games outside the library.
    pub game_icon_png_base64: Option<String>,
}

#[derive(Deserialize)]
pub struct PerformanceRecordingArgs {
    pub filename: String,
    pub content: String,
}

#[tauri::command]
pub async fn read_live_performance(app: AppHandle, temperatures_only: Option<bool>) -> Result<LivePerformance, String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        if temperatures_only.unwrap_or(false) {
            let sensors = read_bundled_sensors(&app);
            let gpu = sensors.gpu_temp_c.or_else(read_nvidia_temperature);
            return Ok(LivePerformance {
                live: sensors.cpu_temp_c.is_some() || gpu.is_some(),
                cpu_temp_c: sensors.cpu_temp_c,
                gpu_temp_c: gpu,
                cpu_sensor_status: Some(sensors.status),
                cpu_sensor_name: sensors.cpu_sensor_name,
                sampled_at_ms: Some(now_ms()),
                ..LivePerformance::default()
            });
        }
        #[cfg(not(windows))]
        let _ = temperatures_only;
        collect_live_performance_blocking(app)
    })
        .await
        .map_err(|error| format!("live performance worker failed: {error}"))?
}

fn collect_live_performance_blocking(app: AppHandle) -> Result<LivePerformance, String> {
    #[cfg(windows)]
    {
        let script = include_str!("performance_sample.ps1");

        // Start the continuous reader before slow WMI calls. Never reopen the
        // hardware library for every UI poll.
        let _ = read_bundled_sensors(&app);
        // Query NVAPI independently so a Windows counter/WMI failure cannot hide a valid GPU sensor.
        let temperature_sample = |reason: String| {
            let sensors = read_bundled_sensors(&app);
            let gpu = sensors.gpu_temp_c.or_else(read_nvidia_temperature);
            let mut sample = LivePerformance {
                live: gpu.is_some() || sensors.cpu_temp_c.is_some(),
                gpu_temp_c: gpu,
                cpu_temp_c: sensors.cpu_temp_c,
                cpu_sensor_status: Some(sensors.status),
                cpu_sensor_name: sensors.cpu_sensor_name,
                // Explicit: CPU/GPU load, RAM and game detection were NOT read.
                telemetry_error: Some(reason),
                ..LivePerformance::default()
            };
            finish_sample(&mut sample);
            sample
        };
        // -EncodedCommand avoids command-line quote mangling of the script.
        let encoded = {
            use base64::Engine;
            let utf16: Vec<u8> = script.encode_utf16().flat_map(|unit| unit.to_le_bytes()).collect();
            base64::engine::general_purpose::STANDARD.encode(utf16)
        };
        let output = match Command::new(crate::commands::windows_powershell_executable())
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-EncodedCommand",
                encoded.as_str(),
            ])
            .creation_flags(0x0800_0000)
            .output() {
                Ok(output) => output,
                Err(error) => return Ok(temperature_sample(format!("Windows telemetry could not start: {error}"))),
            };
        let text = String::from_utf8_lossy(&output.stdout);
        let stderr_summary = || {
            let err = String::from_utf8_lossy(&output.stderr);
            let line = err.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("").chars().take(300).collect::<String>();
            if line.is_empty() { String::new() } else { format!(": {line}") }
        };
        let json = match text
            .lines()
            .rev()
            .find(|line| line.trim_start().starts_with('{')) {
                Some(json) => json,
                None => return Ok(temperature_sample(format!(
                    "Windows telemetry returned no data (exit {}){}", output.status, stderr_summary()
                ))),
            };
        let mut performance: LivePerformance = match serde_json::from_str(json) {
            Ok(performance) => performance,
            Err(error) => return Ok(temperature_sample(format!("Windows telemetry could not be parsed: {error}"))),
        };
        // Sample again after WMI/counters: do not present a pre-query sample as
        // current after a slow Windows provider. Prefer the continuously updated
        // reader; direct driver calls are a fresh fallback, never a WMI snapshot.
        let sensors = read_bundled_sensors(&app);
        if sensors.cpu_temp_c.is_some() { performance.cpu_temp_c = sensors.cpu_temp_c; }
        performance.cpu_sensor_status = Some(sensors.status);
        performance.cpu_sensor_name = sensors.cpu_sensor_name;
        if let Some(current) = sensors.gpu_temp_c.or_else(read_nvidia_temperature) {
            performance.gpu_temp_c = Some(current);
        } else {
            // WMI providers can expose a cached value. Do not retain one when
            // neither the continuous reader nor a fresh driver query succeeds.
            performance.gpu_temp_c = None;
        }
        performance.live |= performance.cpu_temp_c.is_some() || performance.gpu_temp_c.is_some();
        finish_sample(&mut performance);
        Ok(performance)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Live performance telemetry is Windows-only.".into())
    }
}

/// Save the locally captured performance evidence in Downloads and reveal it
/// in Explorer. The recorder never uploads this content from the native app.
#[tauri::command]
pub fn save_performance_recording(
    app: AppHandle,
    args: PerformanceRecordingArgs,
) -> Result<String, String> {
    #[cfg(windows)]
    {
        let filename = std::path::Path::new(&args.filename)
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| {
                (name.starts_with("OptiGods-Performance-Recording-")
                    && name.ends_with(".json")
                    && !name.contains(".."))
                    // Monitor scripts: WebView downloads do not save inside the app.
                    || *name == "OptiGods-Live-Monitor.bat"
                    || *name == "OptiGods-HW-Monitor.bat"
            })
            .ok_or_else(|| "Invalid performance recording filename.".to_string())?;
        let downloads = app
            .path()
            .download_dir()
            .map_err(|error| format!("Windows Downloads folder is unavailable: {error}"))?;
        std::fs::create_dir_all(&downloads)
            .map_err(|error| format!("Could not create the Downloads folder: {error}"))?;
        let path = downloads.join(filename);
        std::fs::write(&path, args.content.as_bytes())
            .map_err(|error| format!("Could not save the performance recording: {error}"))?;
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(|error| {
                format!("Performance recording was saved, but Explorer could not open it: {error}")
            })?;
        Ok(path.to_string_lossy().into_owned())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("Performance recording saving is available in the Windows app.".to_string())
    }
}
