use serde::{Deserialize, Serialize};
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
pub struct LivePerformance {
    pub live: bool,
    pub cpu_load_pct: Option<f32>,
    pub gpu_load_pct: Option<f32>,
    pub ram_total_gb: Option<f32>,
    pub ram_free_gb: Option<f32>,
    pub ram_used_pct: Option<f32>,
    pub cpu_temp_c: Option<f32>,
    pub gpu_temp_c: Option<f32>,
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
}

#[derive(Deserialize)]
pub struct PerformanceRecordingArgs {
    pub filename: String,
    pub content: String,
}

#[tauri::command]
pub fn read_live_performance() -> Result<LivePerformance, String> {
    #[cfg(windows)]
    {
        let script = r#"
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{ live = $false }
$cpu = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 0.25 -MaxSamples 1).CounterSamples[0].CookedValue
if ($null -ne $cpu) { $out.cpu_load_pct = [math]::Round([double]$cpu, 1) }
$os = Get-CimInstance Win32_OperatingSystem
if ($os) {
  $total = [double]$os.TotalVisibleMemorySize / 1MB
  $free = [double]$os.FreePhysicalMemory / 1MB
  $out.ram_total_gb = [math]::Round($total, 1)
  $out.ram_free_gb = [math]::Round($free, 1)
  $out.ram_used_pct = [math]::Round((1 - ($free / $total)) * 100, 1)
}

$gpu = $null
$nvidia = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
if ($nvidia) {
  $line = (& $nvidia.Source --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
  if ($line -match '^\s*(\d+)\s*,\s*(\d+)\s*$') {
    $out.gpu_load_pct = [double]$matches[1]
    $out.gpu_temp_c = [double]$matches[2]
  }
}
if ($null -eq $out.gpu_temp_c) {
  foreach ($namespace in @('root/LibreHardwareMonitor', 'root/OpenHardwareMonitor')) {
    $sensors = @(Get-CimInstance -Namespace $namespace -ClassName Sensor -ErrorAction SilentlyContinue |
      Where-Object { $_.SensorType -eq 'Temperature' -and $_.Name -match 'GPU Core|GPU Hot Spot|GPU Temperature|GPU' -and $_.Name -notmatch 'CPU' })
    if ($sensors) {
      $value = ($sensors | Measure-Object -Property Value -Maximum).Maximum
      if ($value -gt 5 -and $value -lt 130) { $out.gpu_temp_c = [double][math]::Round($value, 1); break }
    }
  }
}
if ($null -eq $out.gpu_load_pct) {
  $samples = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 0.25 -MaxSamples 1).CounterSamples
  if ($samples) {
    $sum = ($samples | Measure-Object -Property CookedValue -Sum).Sum
    if ($null -ne $sum) { $out.gpu_load_pct = [math]::Min(100, [math]::Round([double]$sum, 1)) }
  }
}

# CPU package temperature. ACPI is available on some systems; Ryzen boards
# commonly expose the real package sensor through OpenHardwareMonitor or
# LibreHardwareMonitor instead.
$cpuTemp = $null
$zones = @(Get-CimInstance -Namespace 'root/wmi' -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue)
if ($zones) {
  $values = @($zones | ForEach-Object { [math]::Round(([double]$_.CurrentTemperature / 10) - 273.15, 1) } | Where-Object { $_ -gt 5 -and $_ -lt 120 })
  if ($values) { $cpuTemp = ($values | Measure-Object -Maximum).Maximum }
}
if ($null -eq $cpuTemp) {
  foreach ($namespace in @('root/LibreHardwareMonitor', 'root/OpenHardwareMonitor')) {
    $sensors = @(Get-CimInstance -Namespace $namespace -ClassName Sensor -ErrorAction SilentlyContinue |
      Where-Object { $_.SensorType -eq 'Temperature' -and $_.Name -match 'CPU Package|CPU Core|Tctl|Tdie|CPU CCD' })
    if ($sensors) {
      $value = ($sensors | Measure-Object -Property Value -Maximum).Maximum
      if ($value -gt 5 -and $value -lt 120) { $cpuTemp = [math]::Round([double]$value, 1); break }
    }
  }
}
if ($null -ne $cpuTemp) { $out.cpu_temp_c = [double]$cpuTemp }

# Match Task Manager's total-process view without exporting every process name.
$processes = @(Get-Process -ErrorAction SilentlyContinue)
$taskRows = @(tasklist.exe /FO CSV /NH 2>$null | Where-Object { $_ -match '^"' })
if ($taskRows.Count -gt 0) {
  $out.running_processes_count = [int]$taskRows.Count
} else {
  $out.running_processes_count = [int]$processes.Count
}
$out.visible_apps_count = [int]@($processes | Where-Object {
  $_.MainWindowHandle -ne 0 -and -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle)
}).Count
$out.process_names_text = (@($processes | ForEach-Object {
  "$($_.ProcessName).exe"
} | Sort-Object -Unique) -join "`n"
$out.visible_app_names_text = (@($processes | Where-Object {
  $_.MainWindowHandle -ne 0 -and -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle)
} | ForEach-Object {
  "$($_.ProcessName).exe"
} | Sort-Object -Unique) -join "`n"

$fivemProcesses = @($processes | Where-Object {
  $_.ProcessName -match '^FiveM($|_)'
})
$gameProcesses = @($processes | Where-Object {
  $_.ProcessName -match '^(FiveM(_b\d+)?_GTAProcess|FiveM_GTAProcess|GTA5)$'
})
$out.fivem_running = $fivemProcesses.Count -gt 0
$out.game_processes = @($gameProcesses | ForEach-Object { "$($_.ProcessName).exe" } | Sort-Object -Unique)

# Prefer FiveM when it is present, then identify other supported games by
# process image. This is a process-level signal, not a claim that a window is
# focused.
$knownGames = @(
  [pscustomobject]@{ id = 'fivem'; label = 'FiveM'; pattern = '^FiveM(_b\d+)?_GTAProcess$' },
  [pscustomobject]@{ id = 'gta5'; label = 'Grand Theft Auto V'; pattern = '^GTA5$' },
  [pscustomobject]@{ id = 'fortnite'; label = 'Fortnite'; pattern = '^FortniteClient' },
  [pscustomobject]@{ id = 'valorant'; label = 'VALORANT'; pattern = '^(VALORANT|VALORANT-Win64-Shipping)$' },
  [pscustomobject]@{ id = 'cs2'; label = 'Counter-Strike 2'; pattern = '^(cs2|csgo)$' },
  [pscustomobject]@{ id = 'roblox'; label = 'Roblox'; pattern = '^RobloxPlayerBeta$' },
  [pscustomobject]@{ id = 'apex'; label = 'Apex Legends'; pattern = '^r5apex$' },
  [pscustomobject]@{ id = 'overwatch'; label = 'Overwatch'; pattern = '^Overwatch$' },
  [pscustomobject]@{ id = 'rust'; label = 'Rust'; pattern = '^RustClient$' },
  [pscustomobject]@{ id = 'tarkov'; label = 'Escape from Tarkov'; pattern = '^EscapeFromTarkov$' },
  [pscustomobject]@{ id = 'league'; label = 'League of Legends'; pattern = '^(LeagueClient|League of Legends)$' },
  [pscustomobject]@{ id = 'minecraft'; label = 'Minecraft'; pattern = '^(java|MinecraftLauncher)$' }
)
$activeGame = $null
foreach ($rule in $knownGames) {
  $match = @($processes | Where-Object { $_.ProcessName -match $rule.pattern } | Select-Object -First 1)
  if ($match.Count -gt 0) {
    $activeGame = [pscustomobject]@{
      id = $rule.id
      label = $rule.label
      process = "$($match[0].ProcessName).exe"
    }
    break
  }
}
$out.game_running = $null -ne $activeGame
if ($activeGame) {
  $out.game_id = $activeGame.id
  $out.game_label = $activeGame.label
  $out.game_process = $activeGame.process
}

# FiveM's local log exposes the last connection target. Only report it while
# the actual game process is present so a stale previous session is not called
# the current RP server.
if ($out.fivem_running -and $out.game_running) {
  $logPath = Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app\logs\CitizenFX.log'
  if (Test-Path -LiteralPath $logPath) {
    $line = Get-Content -LiteralPath $logPath -Tail 400 -ErrorAction SilentlyContinue |
      Select-String -Pattern 'Connecting to\s+(?:cfx\.re/join/)?([^\s,;]+)' |
      Select-Object -Last 1
    if ($line -and $line.Matches.Count -gt 0) {
      $out.server_target = $line.Matches[0].Groups[1].Value
    }
  }
}
$out.live = $true
$out | ConvertTo-Json -Compress
"#;

        let output = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                script,
            ])
            .creation_flags(0x0800_0000)
            .output()
            .map_err(|error| format!("live performance command failed: {error}"))?;
        if !output.status.success() {
            return Err("Windows did not return live performance data.".into());
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let json = text
            .lines()
            .rev()
            .find(|line| line.trim_start().starts_with('{'))
            .ok_or_else(|| "Windows returned no live performance payload.".to_string())?;
        serde_json::from_str(json)
            .map_err(|error| format!("invalid live performance payload: {error}"))
    }
    #[cfg(not(windows))]
    {
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
                name.starts_with("OptiGods-Performance-Recording-")
                    && name.ends_with(".json")
                    && !name.contains("..")
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
