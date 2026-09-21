// Miscellaneous utility commands for the Opti Gods desktop shell.
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

const MSI_UTILITY_SHA256: &str = "695800afad96f858a3f291b7df21c16649528f13d39b63fb7c233e5676c8df6f";
const PROFILE_INSPECTOR_SHA256: &str = "1ebd8129b3c564bf226291fb3344819fd59668066f0c5e03334a69a04a62859e";
const PROFILE_REFERENCE_SHA256: &str = "0ea7b055aee5c543047243d2dd7abdd1b8c6d96f5d2b7bb5fe17be8130e005ef";
const PROFILE_CONFIG_SHA256: &str = "051099983b896673909e01a1f631b6652abb88da95c9f06f3efef4be033091fa";
const PROFILE_PRESET_SHA256: &str = "495a88042d441c91c1aaa7ce79c69ef2e18e27aaaf02c49da7fed39917289f85";
const BASE_PROD: &str = "https://optigods.com";
const MSI_TWEAK_ID: &str = "OpenMsiUtilityPro";
const PRESET_TWEAK_ID: &str = "ImportNvidiaPresetPro";

#[derive(Deserialize)]
pub struct ProToolArgs {
    pub ticket: String,
    pub native_auth: String,
}

fn verify_sha256(path: &std::path::Path, expected: &str) -> Result<(), String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Read bundled tool failed: {e}"))?;
    let digest = format!("{:x}", Sha256::digest(&bytes));
    if digest != expected {
        return Err(format!("Bundled tool hash mismatch; expected {expected}, got {digest}."));
    }
    Ok(())
}

fn verify_nvidia_bundle(dir: &std::path::Path) -> Result<(), String> {
    verify_sha256(&dir.join("nvidiaProfileInspector.exe"), PROFILE_INSPECTOR_SHA256)?;
    verify_sha256(&dir.join("nvidiaProfileInspector.exe.config"), PROFILE_CONFIG_SHA256)?;
    verify_sha256(&dir.join("Reference.xml"), PROFILE_REFERENCE_SHA256)?;
    verify_sha256(&dir.join("OptiGods-Global.nip"), PROFILE_PRESET_SHA256)?;
    Ok(())
}

async fn consume_pro_ticket(args: &ProToolArgs, id: &str) -> Result<(String, String), String> {
    let base = if cfg!(debug_assertions) { "http://127.0.0.1:5000" } else { BASE_PROD };
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Authorization client failed: {e}"))?;
    let mut request = client.post(format!("{base}/api/performance-allowance/native-ticket/consume"));
    request = if let Some(device_id) = args.native_auth.strip_prefix("device:") {
        request.header("X-Device-ID", device_id)
    } else if let Some(pro_session) = args.native_auth.strip_prefix("pro:") {
        request.header("X-Pro-Session", pro_session)
    } else {
        request.header("X-Native-Auth", &args.native_auth)
    };
    let response = request
        .json(&serde_json::json!({ "ticket": args.ticket, "tweakId": id }))
        .send()
        .await
        .map_err(|_| "Pro authorization ticket could not be verified.".to_string())?;
    if !response.status().is_success() {
        let detail = response.text().await.unwrap_or_default();
        return Err(serde_json::from_str::<serde_json::Value>(&detail)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_owned))
            .unwrap_or_else(|| "Pro authorization ticket was rejected or expired.".to_string()));
    }
    let body: serde_json::Value = response.json().await.map_err(|_| "Invalid authorization response.".to_string())?;
    let secret = body.get("resultSecret").and_then(|v| v.as_str()).ok_or_else(|| "Authorization response omitted result secret.".to_string())?;
    Ok((base.to_string(), secret.to_string()))
}

async fn finalize_pro_ticket(base: &str, args: &ProToolArgs, secret: &str, id: &str, success: bool, message: &str) {
    let client = reqwest::Client::new();
    let mut request = client.post(format!("{base}/api/performance-allowance/native-ticket/result"));
    request = if let Some(device_id) = args.native_auth.strip_prefix("device:") {
        request.header("X-Device-ID", device_id)
    } else if let Some(pro_session) = args.native_auth.strip_prefix("pro:") {
        request.header("X-Pro-Session", pro_session)
    } else {
        request.header("X-Native-Auth", &args.native_auth)
    };
    let _ = request
        .json(&serde_json::json!({
            "ticket": args.ticket,
            "resultSecret": secret,
            "success": success,
            "tweakId": id,
            "message": message,
        }))
        .send()
        .await;
}

#[tauri::command]
pub async fn open_msi_utility(app: tauri::AppHandle, args: ProToolArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        let (base, secret) = consume_pro_ticket(&args, MSI_TWEAK_ID).await?;
        let result = (|| {
            let path = app.path().resource_dir().map_err(|e| format!("Resource directory unavailable: {e}"))?
                .join("resources").join("msi-utility").join("MSI_util_v3.exe");
            verify_sha256(&path, MSI_UTILITY_SHA256)?;
            let resource_dir = path.parent().and_then(|p| p.parent()).ok_or_else(|| "Bundled resource directory unavailable.".to_string())?;
            verify_nvidia_bundle(&resource_dir.join("nvidia-profile-inspector"))?;
            std::process::Command::new(&path).spawn().map_err(|e| format!("Could not launch MSI Utility v3: {e}"))?;
            Ok::<String, String>("MSI Utility v3 launched. Select only the active NVIDIA display adapter, check MSI, choose High, then press Apply. Windows resets this after a driver update.".into())
        })();
        match &result {
            Ok(message) => finalize_pro_ticket(&base, &args, &secret, MSI_TWEAK_ID, true, message).await,
            Err(error) => finalize_pro_ticket(&base, &args, &secret, MSI_TWEAK_ID, false, error).await,
        }
        result
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("MSI Utility v3 is available only in the Windows Pro app.".into())
    }
}

#[tauri::command]
pub async fn import_nvidia_preset(app: tauri::AppHandle, args: ProToolArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        let (base, secret) = consume_pro_ticket(&args, PRESET_TWEAK_ID).await?;
        let result = async {
            crate::commands::restore::require_verified_checkpoint()?;
            let dir = app.path().resource_dir().map_err(|e| format!("Resource directory unavailable: {e}"))?;
            let inspector_dir = dir.join("resources").join("nvidia-profile-inspector");
            let inspector = inspector_dir.join("nvidiaProfileInspector.exe");
            let preset = inspector_dir.join("OptiGods-Global.nip");
            verify_nvidia_bundle(&inspector_dir)?;
            let status = tokio::process::Command::new(&inspector)
                .arg("-silentImport").arg(&preset).current_dir(&inspector_dir).status().await
                .map_err(|e| format!("Could not launch NVIDIA Profile Inspector: {e}"))?;
            if !status.success() { return Err(format!("NVIDIA Profile Inspector exited with {status}. No preset success was claimed.")); }
            Ok::<String, String>("Verified performance preset import completed (Profile Inspector exited successfully). Twelve mapped global settings were submitted; dynamic display/GPU choices, shader-cache defaults, and VRSS were omitted. The driver does not expose safe readback.".into())
        }.await;
        match &result {
            Ok(message) => finalize_pro_ticket(&base, &args, &secret, PRESET_TWEAK_ID, true, message).await,
            Err(error) => finalize_pro_ticket(&base, &args, &secret, PRESET_TWEAK_ID, false, error).await,
        }
        result
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("NVIDIA Profile Inspector is available only in the Windows Pro app.".into())
    }
}

/// Opens the user's Downloads folder in Windows Explorer.
/// Safe: no user-supplied paths — always opens the well-known shell folder.
#[tauri::command]
pub fn open_downloads() {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer.exe")
            .arg("shell:Downloads")
            .spawn();
    }
}

#[derive(Deserialize)]
pub struct DiagnosticLogArgs {
    pub filename: String,
    pub content: String,
}

/// Persist the native runner diagnostic log in the real Windows Downloads
/// folder. Browser Blob downloads are not reliable inside WebView2, so the
/// desktop shell owns this write and opens Explorer with the file selected.
#[tauri::command]
pub fn save_diagnostic_log(app: AppHandle, args: DiagnosticLogArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        let filename = std::path::Path::new(&args.filename)
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| {
                name.starts_with("OptiGods-V5-Tweak-Run-")
                    && name.ends_with(".txt")
                    && !name.contains("..")
            })
            .ok_or_else(|| "Invalid diagnostic log filename.".to_string())?;
        let downloads = app
            .path()
            .download_dir()
            .map_err(|error| format!("Windows Downloads folder is unavailable: {error}"))?;
        std::fs::create_dir_all(&downloads)
            .map_err(|error| format!("Could not create the Downloads folder: {error}"))?;
        let path = downloads.join(filename);
        std::fs::write(&path, args.content.as_bytes())
            .map_err(|error| format!("Could not save the diagnostic log: {error}"))?;
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(|error| format!("Diagnostic log was saved, but Explorer could not open it: {error}"))?;
        Ok(path.to_string_lossy().into_owned())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("Diagnostic log saving is available in the Windows app.".to_string())
    }
}

/// Repair the common NVIDIA Control Panel launch failure without claiming
/// success unless the installed executable actually starts.
#[tauri::command]
pub fn repair_nvidia_control_panel() -> Result<String, String> {
    #[cfg(windows)]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$serviceNames = @('NVDisplay.ContainerLocalSystem','NVDisplay.ContainerLS','NvContainerLocalSystem')
foreach ($name in $serviceNames) {
  $service = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($service) {
    if ($service.StartType -eq 'Disabled') { Set-Service -InputObject $service -StartupType Automatic -ErrorAction SilentlyContinue }
    if ($service.Status -ne 'Running') { Start-Service -InputObject $service -ErrorAction SilentlyContinue }
  }
}
$candidates = @(
  (Join-Path $env:ProgramFiles 'NVIDIA Corporation\Control Panel Client\nvcplui.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'NVIDIA Corporation\Control Panel Client\nvcplui.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$exe = $candidates | Select-Object -First 1
if (-not $exe) {
  $package = Get-AppxPackage -Name 'NVIDIACorp.NVIDIAControlPanel' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($package) {
    $candidate = Join-Path $package.InstallLocation 'nvcplui.exe'
    if (Test-Path -LiteralPath $candidate) { $exe = $candidate }
  }
}
if (-not $exe) { throw 'NVIDIA Control Panel executable was not found. Reinstall NVIDIA Control Panel from the Microsoft Store or reinstall the NVIDIA driver with Control Panel selected.' }
$process = Start-Process -FilePath $exe -PassThru
Start-Sleep -Milliseconds 700
if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) -and -not (Get-Process -Name 'nvcplui' -ErrorAction SilentlyContinue)) {
  throw 'NVIDIA Control Panel was found but exited immediately. Reinstall the NVIDIA driver/Control Panel package.'
}
Write-Output "NVIDIA Control Panel started from $exe"
"#;
        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .output()
            .map_err(|error| format!("Could not run the NVIDIA Control Panel repair: {error}"))?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                "NVIDIA Control Panel repair failed.".to_string()
            } else {
                detail
            });
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
    #[cfg(not(windows))]
    {
        Err("NVIDIA Control Panel repair is available in the Windows app.".to_string())
    }
}
/// Opens FiveM Application Data directly in Explorer.
/// Safe: the path is derived only from LOCALAPPDATA; the renderer supplies no path.
#[tauri::command]
pub fn open_fivem_folder() -> Result<(), String> {
    #[cfg(windows)]
    {
        let local = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA is unavailable".to_string())?;
        let candidates = [
            std::path::PathBuf::from(&local).join("FiveM").join("FiveM Application Data"),
            std::path::PathBuf::from(&local).join("FiveM").join("FiveM.app"),
        ];
        let path = candidates.iter().find(|p| p.exists())
            .ok_or_else(|| "FiveM Application Data was not found. Launch FiveM once, then try again.".to_string())?;
        std::process::Command::new("explorer.exe")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Could not open FiveM folder: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("FiveM folders are only available on Windows.".to_string())
    }
}

/// Read a text file from an absolute path on disk.
/// Used by the HW Monitor drop zone: Tauri intercepts OS file drops and
/// delivers a file path; the frontend then calls this to get the content.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read_text_file({path}): {e}"))
}

/// Read the FiveM CitizenFX.log (tail 400 lines) to detect the current/last
/// connected server. Returns empty string if FiveM is not installed or log
/// is missing. Used by the dashboard to auto-add and auto-mark active servers.
#[tauri::command]
pub fn read_fivem_log() -> String {
    #[cfg(windows)]
    {
        let localappdata = match std::env::var("LOCALAPPDATA") {
            Ok(v) => v,
            Err(_) => return String::new(),
        };
        let log_path = format!(r"{}\FiveM\FiveM.app\logs\CitizenFX.log", localappdata);
        match std::fs::read_to_string(&log_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let start = lines.len().saturating_sub(400);
                lines[start..].join("\n")
            }
            Err(_) => String::new(),
        }
    }
    #[cfg(not(windows))]
    {
        String::new()
    }
}
