// Included by performance.rs. Admin live monitor: keeps FPS, temperatures and
// CPU/GPU/RAM load live while a game has focus, without running PowerShell
// every second.
//
// Every second, cheap native reads (Windows CPU/RAM counters, the NVIDIA
// driver, the sensor helper and PresentMon) refresh the display. The full
// PowerShell sample (game identity, FiveM server/menu state, process lists)
// runs on its own thread only every 30 s, or immediately when the game
// process changes, e.g. FiveM restarting its game process to join a server.
// Read-only: no priorities, no injection, no tweaks.

static LIVE_MONITOR_ACTIVE: AtomicBool = AtomicBool::new(false);

const LIVE_INTERVAL_MS: u64 = 1000;
const FULL_SAMPLE_WITH_GAME_MS: u64 = 30_000;
const FULL_SAMPLE_WITHOUT_GAME_MS: u64 = 15_000;

struct LiveMonitor {
    stop: std::sync::Arc<AtomicBool>,
}

static LIVE_MONITOR: parking_lot::Mutex<Option<LiveMonitor>> = parking_lot::const_mutex(None);
static LIVE_LATEST: parking_lot::Mutex<Option<LivePerformance>> = parking_lot::const_mutex(None);

/// Supported game executables, matching the rules in performance_sample.ps1.
/// Used only to notice the game process changing between full samples.
#[cfg(windows)]
fn is_known_game_exe(lower: &str) -> bool {
    (lower.starts_with("fivem_") && lower.ends_with("_gtaprocess.exe"))
        || lower == "fivem_gtaprocess.exe"
        || matches!(
            lower,
            "gta5.exe" | "gta5_enhanced.exe" | "fortniteclient-win64-shipping.exe" | "valorant-win64-shipping.exe"
                | "cs2.exe" | "robloxplayerbeta.exe" | "r5apex.exe" | "r5apex_dx12.exe" | "overwatch.exe"
                | "rustclient.exe" | "escapefromtarkov.exe" | "league of legends.exe" | "minecraft.windows.exe"
                | "silenthilltownfall-win64-shipping.exe" | "townfall-win64-shipping.exe" | "shtownfall.exe"
        )
}

#[cfg(windows)]
struct CpuTimes { idle: u64, total: u64 }

#[cfg(windows)]
fn read_cpu_times() -> Option<CpuTimes> {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::Threading::GetSystemTimes;
    let (mut idle, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default());
    unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)).ok()?; }
    let value = |t: FILETIME| ((t.dwHighDateTime as u64) << 32) | t.dwLowDateTime as u64;
    // Kernel time includes idle time.
    Some(CpuTimes { idle: value(idle), total: value(kernel) + value(user) })
}

#[cfg(windows)]
fn read_memory() -> Option<(f32, f32, f32)> {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    let mut status = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
    unsafe { GlobalMemoryStatusEx(&mut status).ok()?; }
    if status.ullTotalPhys == 0 { return None; }
    let gib = 1024.0 * 1024.0 * 1024.0;
    let total = status.ullTotalPhys as f64;
    let free = status.ullAvailPhys as f64;
    let used_pct = ((1.0 - free / total) * 1000.0).round() / 10.0;
    Some(((total / gib) as f32, (free / gib) as f32, used_pct as f32))
}

/// NVIDIA graphics-engine utilization from the driver (same source as GPU-Z).
#[cfg(windows)]
fn read_nvidia_load() -> Option<f32> {
    use std::ffi::c_void;
    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct Domain { present: u32, percentage: u32 }
    #[repr(C)]
    struct Pstates { version: u32, flags: u32, domains: [Domain; 8] }
    let api = super::misc::NvApiLibrary::try_load()?;
    let enumerate: unsafe extern "C" fn(*mut *mut c_void, *mut u32) -> i32 =
        unsafe { std::mem::transmute(api.resolve(0xE5AC921F, "GPU enumeration").ok()?) };
    let pstates: unsafe extern "C" fn(*mut c_void, *mut Pstates) -> i32 =
        unsafe { std::mem::transmute(api.resolve(0x60DED2ED, "GPU utilization").ok()?) };
    let mut handles = [std::ptr::null_mut(); 64];
    let mut count = 0;
    if unsafe { enumerate(handles.as_mut_ptr(), &mut count) } != 0 || count > 64 { return None; }
    for handle in handles.iter().take(count as usize) {
        if handle.is_null() { continue; }
        let mut data = Pstates { version: std::mem::size_of::<Pstates>() as u32 | (1 << 16), flags: 0, domains: [Domain::default(); 8] };
        if unsafe { pstates(*handle, &mut data) } == 0 && data.domains[0].present & 1 == 1 && data.domains[0].percentage <= 100 {
            return Some(data.domains[0].percentage as f32);
        }
    }
    None
}

#[cfg(windows)]
fn live_monitor_loop(app: AppHandle, stop: std::sync::Arc<AtomicBool>) {
    use std::collections::HashSet;
    use std::time::{Duration, Instant};

    let full: std::sync::Arc<parking_lot::Mutex<Option<LivePerformance>>> = std::sync::Arc::new(parking_lot::Mutex::new(None));
    let full_running = std::sync::Arc::new(AtomicBool::new(false));
    let mut full_started: Option<Instant> = None;
    let mut previous_games: Vec<u32> = Vec::new();
    let mut previous_cpu = read_cpu_times();

    while !stop.load(Ordering::SeqCst) {
        let tick = Instant::now();
        let processes = crate::commands::gaming_mode::native::list().unwrap_or_default();
        let alive: HashSet<u32> = processes.iter().map(|p| p.pid).collect();
        let mut games: Vec<(u32, String)> = processes.iter()
            .filter(|p| is_known_game_exe(&p.name.to_ascii_lowercase()))
            .map(|p| (p.pid, p.name.clone()))
            .collect();
        games.sort_by_key(|(pid, _)| *pid);
        let game_pids: Vec<u32> = games.iter().map(|(pid, _)| *pid).collect();

        // While a recording runs, its own full samples are current; reuse them.
        let recording_latest = RECORDING.lock().as_ref().and_then(|session| session.samples.lock().last().cloned());
        let snapshot = recording_latest.clone().or_else(|| full.lock().clone());
        let snapshot_pid = snapshot.as_ref().filter(|s| s.game_running).and_then(|s| s.game_pid);
        let has_game = snapshot_pid.is_some() || !game_pids.is_empty();
        let interval = if has_game { FULL_SAMPLE_WITH_GAME_MS } else { FULL_SAMPLE_WITHOUT_GAME_MS };
        let due = full_started.map_or(true, |at| at.elapsed() >= Duration::from_millis(interval))
            || game_pids != previous_games
            || snapshot_pid.map_or(false, |pid| !alive.contains(&pid));
        if recording_latest.is_none() && due && !full_running.swap(true, Ordering::SeqCst) {
            full_started = Some(Instant::now());
            let (app, full, running) = (app.clone(), full.clone(), full_running.clone());
            let _ = std::thread::Builder::new().name("optigods-live-full".into()).spawn(move || {
                if let Ok(sample) = collect_live_performance_blocking(app) {
                    *full.lock() = Some(sample);
                }
                running.store(false, Ordering::SeqCst);
            });
        }
        previous_games = game_pids.clone();

        let mut sample = snapshot.unwrap_or_default();
        // The full sample's game process ended (FiveM restarts it to join a
        // server): follow the new one now instead of waiting for the next full sample.
        if let Some(pid) = snapshot_pid {
            if !alive.contains(&pid) {
                if let Some((new_pid, name)) = games.first() {
                    sample.game_pid = Some(*new_pid);
                    sample.game_process = Some(name.clone());
                } else {
                    sample.game_running = false;
                    sample.game_pid = None;
                    sample.game_id = None;
                    sample.game_label = None;
                    sample.game_process = None;
                    sample.game_processes.clear();
                    sample.fivem_session_state = None;
                    sample.server_target = None;
                    sample.server_title = None;
                    sample.server_evidence = None;
                    sample.game_window_title = None;
                }
            }
        }

        let current_cpu = read_cpu_times();
        if let (Some(before), Some(now)) = (previous_cpu.as_ref(), current_cpu.as_ref()) {
            let total = now.total.saturating_sub(before.total);
            let idle = now.idle.saturating_sub(before.idle);
            if total > 0 {
                sample.cpu_load_pct = Some(((1.0 - idle as f64 / total as f64).clamp(0.0, 1.0) * 1000.0).round() as f32 / 10.0);
            }
        }
        previous_cpu = current_cpu;
        if let Some((total, free, used_pct)) = read_memory() {
            sample.ram_total_gb = Some(total);
            sample.ram_free_gb = Some(free);
            sample.ram_used_pct = Some(used_pct);
        }
        if let Some(load) = read_nvidia_load() { sample.gpu_load_pct = Some(load); }
        let sensors = read_bundled_sensors(&app);
        if sensors.cpu_temp_c.is_some() { sample.cpu_temp_c = sensors.cpu_temp_c; }
        sample.cpu_sensor_status = Some(sensors.status);
        sample.cpu_sensor_name = sensors.cpu_sensor_name;
        if let Some(gpu) = sensors.gpu_temp_c.or_else(read_nvidia_temperature) { sample.gpu_temp_c = Some(gpu); }
        if !processes.is_empty() { sample.running_processes_count = Some(processes.len() as u32); }
        sample.live = true;
        sample.sampled_at_ms = Some(now_ms());
        LAST_GAME_PID.store(sample.game_pid.filter(|_| sample.game_running).unwrap_or(0), Ordering::SeqCst);
        attach_fps(&mut sample);
        *LIVE_LATEST.lock() = Some(sample);

        let deadline = tick + Duration::from_millis(LIVE_INTERVAL_MS);
        while !stop.load(Ordering::SeqCst) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}

/// Start the live monitor (idempotent). Runs until stopped or the window closes.
#[tauri::command]
pub fn start_live_monitor(app: AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut guard = LIVE_MONITOR.lock();
        if guard.is_some() { return Ok(()); }
        LIVE_MONITOR_ACTIVE.store(true, Ordering::SeqCst);
        let stop = std::sync::Arc::new(AtomicBool::new(false));
        let worker_stop = stop.clone();
        std::thread::Builder::new()
            .name("optigods-live-monitor".into())
            .spawn(move || live_monitor_loop(app, worker_stop))
            .map_err(|e| {
                LIVE_MONITOR_ACTIVE.store(false, Ordering::SeqCst);
                format!("Could not start the live monitor: {e}")
            })?;
        *guard = Some(LiveMonitor { stop });
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("The live monitor is available in the Windows app.".into())
    }
}

#[tauri::command]
pub fn stop_live_monitor() {
    stop_live_monitor_inner();
}

fn stop_live_monitor_inner() {
    if let Some(monitor) = LIVE_MONITOR.lock().take() {
        monitor.stop.store(true, Ordering::SeqCst);
    }
    LIVE_MONITOR_ACTIVE.store(false, Ordering::SeqCst);
    *LIVE_LATEST.lock() = None;
}

/// Latest live reading; cheap (no Windows queries), safe to poll every second.
#[tauri::command]
pub fn read_live_monitor() -> Option<LivePerformance> {
    LIVE_LATEST.lock().clone()
}
