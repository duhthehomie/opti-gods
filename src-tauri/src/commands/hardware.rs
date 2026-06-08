// Hardware scan — pulls CPU/GPU/RAM/motherboard/chassis info via WMI and
// returns the typed payload the server already understands
// (see `hardwareScanPayloadSchema` in shared/schema.ts).

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
    pub anticheats: Vec<String>,
}

#[tauri::command]
pub async fn scan_hardware() -> Result<HardwareScan, String> {
    #[cfg(windows)]
    {
        crate::win32::wmi_scan::scan().map_err(|e| format!("WMI scan failed: {e:#}"))
    }
    #[cfg(not(windows))]
    {
        Err("scan_hardware is Windows-only.".into())
    }
}
