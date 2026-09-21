use serde::{Deserialize, Serialize};
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

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
if ($null -eq $out.gpu_load_pct) {
  $samples = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -SampleInterval 0.25 -MaxSamples 1).CounterSamples
  if ($samples) {
    $sum = ($samples | Measure-Object -Property CookedValue -Sum).Sum
    if ($null -ne $sum) { $out.gpu_load_pct = [math]::Min(100, [math]::Round([double]$sum, 1)) }
  }
}
$out.live = $true
$out | ConvertTo-Json -Compress
"#;

        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
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
        serde_json::from_str(json).map_err(|error| format!("invalid live performance payload: {error}"))
    }
    #[cfg(not(windows))]
    {
        Err("Live performance telemetry is Windows-only.".into())
    }
}