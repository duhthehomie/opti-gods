// Included by performance.rs. The helper uses the official LHM library; no
// renderer-provided executable paths, arguments, scripts or URLs are accepted.
#[derive(serde::Deserialize, Clone, Default)]
struct CpuSensorSample {
    cpu_temp_c: Option<f32>,
    gpu_temp_c: Option<f32>,
    cpu_sensor_name: Option<String>,
    status: String,
}

#[cfg(windows)]
static SENSOR_RESTART_REQUESTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(windows)]
fn read_bundled_sensors(app: &tauri::AppHandle) -> CpuSensorSample {
    use std::io::{BufRead, BufReader};
    use std::sync::{Arc, Mutex, OnceLock};
    use std::time::{Duration, Instant};
    struct Reader {
        child: Option<std::process::Child>,
        latest: Arc<Mutex<Option<(Instant, CpuSensorSample)>>>,
        attempted: Option<Instant>,
    }
    static READER: OnceLock<Mutex<Reader>> = OnceLock::new();
    let mut reader = READER.get_or_init(|| Mutex::new(Reader {
        child: None, latest: Arc::new(Mutex::new(None)), attempted: None,
    })).lock().unwrap_or_else(|e| e.into_inner());
    if SENSOR_RESTART_REQUESTED.swap(false, std::sync::atomic::Ordering::SeqCst) {
        if let Some(mut child) = reader.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        reader.latest = Arc::new(Mutex::new(None));
        reader.attempted = None;
    }
    let running = reader.child.as_mut().map(|c| matches!(c.try_wait(), Ok(None))).unwrap_or(false);
    if !running && reader.attempted.map(|t| t.elapsed() > Duration::from_secs(10)).unwrap_or(true) {
        reader.attempted = Some(Instant::now());
        let spawn = (|| -> Result<std::process::Child, String> {
            let directory = app.path().resource_dir().map_err(|e| e.to_string())?.join("resources/cpu-sensors");
            let executable = directory.join("OptiGods.Sensors.exe");
            verify_sensor_file(&executable, include_str!("../../resources/cpu-sensors/helper.sha256"))?;
            let mut child = Command::new(executable)
                .args(["--parent-pid", &std::process::id().to_string()])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::null())
                .creation_flags(0x0800_0000)
                .spawn().map_err(|e| format!("Sensor reader could not start: {e}"))?;
            let stdout = child.stdout.take().ok_or("Sensor output unavailable")?;
            let latest = reader.latest.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines() {
                    let Ok(line) = line else { break };
                    if line.len() > 2048 { continue; }
                    if let Ok(sample) = serde_json::from_str::<CpuSensorSample>(&line) {
                        *latest.lock().unwrap_or_else(|e| e.into_inner()) = Some((Instant::now(), sample));
                    }
                }
            });
            Ok(child)
        })();
        match spawn {
            Ok(child) => reader.child = Some(child),
            Err(error) => return CpuSensorSample { status: error, ..Default::default() },
        }
    }
    let latest = reader.latest.lock().unwrap_or_else(|e| e.into_inner());
    match latest.as_ref() {
        Some((received, sample)) if received.elapsed() < Duration::from_secs(4) => sample.clone(),
        _ => CpuSensorSample { status: "warming_up_or_unavailable".into(), ..Default::default() },
    }
}

#[cfg(windows)]
fn verify_sensor_file(path: &std::path::Path, expected: &str) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    let bytes = std::fs::read(path).map_err(|e| format!("Bundled sensor resource unavailable: {e}"))?;
    if format!("{:x}", Sha256::digest(&bytes)) != expected.trim() {
        return Err("Bundled sensor resource failed its integrity check.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn prepare_cpu_monitoring(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(windows)]
    {
        // Fetch from the official distributor only after the user confirms.
        // Do not redistribute the kernel-driver binary inside our installer.
        let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(60))
            .build().map_err(|e| e.to_string())?;
        let mut response = client.get("https://github.com/namazso/PawnIO.Setup/releases/download/2.2.0/PawnIO_setup.exe")
            .send().await.map_err(|e| format!("Official driver download failed: {e}"))?
            .error_for_status().map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            if bytes.len() + chunk.len() > 5_000_000 {
                return Err("The official sensor setup download exceeded the expected size.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        use sha2::{Digest, Sha256};
        if format!("{:x}", Sha256::digest(&bytes)) != "1f519a22e47187f70a1379a48ca604981c4fcf694f4e65b734aaa74a9fba3032" {
            return Err("Official sensor setup download failed its pinned integrity check.".into());
        }
        let directory = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("sensor-setup");
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?.as_nanos();
        let path = directory.join(format!("PawnIO-{}-{nonce}.exe", std::process::id()));
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new().create_new(true).write(true).open(&path)
            .map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        drop(file);
        tokio::task::spawn_blocking(move || {
            verify_sensor_file(&path, "1f519a22e47187f70a1379a48ca604981c4fcf694f4e65b734aaa74a9fba3032")?;
            // Verify Windows trust too. This launches the visible OFFICIAL setup,
            // never silent installation or the unrestricted unsigned edition.
            let command = r#"$s=Get-AuthenticodeSignature -LiteralPath $env:OPTI_SENSOR_SETUP; if($s.Status -ne 'Valid'){throw 'The official sensor-driver installer signature is not trusted by Windows.'}; $p=Start-Process -FilePath $env:OPTI_SENSOR_SETUP -PassThru -Wait; if($p.ExitCode -notin @(0,3010)){throw "Sensor setup was cancelled or failed (exit $($p.ExitCode))."}"#;
            let output = Command::new(crate::commands::windows_powershell_executable())
                .args(["-NoProfile", "-NonInteractive", "-Command", command])
                .env("OPTI_SENSOR_SETUP", &path)
                .creation_flags(0x0800_0000)
                .output().map_err(|e| e.to_string())?;
            let _ = std::fs::remove_file(&path);
            if !output.status.success() {
                return Err(format!("CPU sensor setup did not complete: {}", String::from_utf8_lossy(&output.stderr)));
            }
            SENSOR_RESTART_REQUESTED.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok("Sensor setup completed. CPU monitoring will retry automatically; restart Windows only if the installer requests it.".into())
        }).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    { let _ = app; Err("CPU sensor setup requires the Windows app.".into()) }
}
