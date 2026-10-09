// Hardware collection is always off the WebView/UI thread.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct HardwareScan {
    pub cpu: String,
    pub gpu: String,
    pub vram_mb: Option<u64>,
    pub ram_gb: Option<u32>,
    pub ram_mhz: Option<u32>,
    pub motherboard: Option<String>,
    pub chassis: Option<String>,
    pub cooling_type: Option<String>,
    pub fan_count: Option<u32>,
    pub cpu_temp_c: Option<f32>,
    pub refresh_hz: Option<u32>,
    pub nic_vendor: Option<String>,
    pub network_ssid: Option<String>,
    pub network_band: Option<String>,
    pub anticheats: Vec<String>,
    pub system_model: Option<String>,
    pub os_name: Option<String>,
    pub os_build: Option<u32>,
    pub cpu_cores: Option<u32>,
    pub cpu_threads: Option<u32>,
    pub is_laptop: Option<bool>,
}

#[derive(Serialize, Clone, Debug)]
pub struct MonitorInfo {
    pub name: String,
    pub current_hz: Option<u32>,
    pub max_hz: Option<u32>,
}

#[derive(Serialize)]
pub struct HardwareScanResult {
    #[serde(flatten)]
    pub hardware: HardwareScan,
    pub monitors: Vec<MonitorInfo>,
}

#[cfg(windows)]
#[path = "display_scan.rs"]
mod display_scan;

#[tauri::command]
pub async fn scan_hardware() -> Result<HardwareScanResult, String> {
    #[cfg(windows)]
    {
        tokio::task::spawn_blocking(|| {
            let mut hardware = crate::win32::wmi_scan::scan()
                .map_err(|error| format!("WMI scan failed: {error:#}"))?;
            let monitors = display_scan::monitors();
            hardware.refresh_hz = monitors.iter().filter_map(|m| m.max_hz).max();
            // Thermal zones are not CPU-package sensors. Live CPU data comes
            // only from the continuous signed-driver hardware sensor helper.
            hardware.cpu_temp_c = None;
            Ok(HardwareScanResult { hardware, monitors })
        }).await.map_err(|error| format!("Hardware scan worker failed: {error}"))?
    }
    #[cfg(not(windows))]
    { Err("scan_hardware is Windows-only.".into()) }
}
