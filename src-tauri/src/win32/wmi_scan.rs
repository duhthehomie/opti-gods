// WMI-driven hardware scan. Returns the typed payload that the existing
// server endpoint /api/hardware/scan already validates.

use crate::commands::hardware::HardwareScan;
use anyhow::{Context, Result};
use serde::Deserialize;
use wmi::{COMLibrary, WMIConnection};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32Processor {
    name: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32VideoController {
    name: Option<String>,
    adapter_ram: Option<u64>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32PhysicalMemory {
    capacity: Option<u64>,
    speed: Option<u32>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32BaseBoard {
    manufacturer: Option<String>,
    product: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32SystemEnclosure {
    chassis_types: Option<Vec<u16>>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32NetworkAdapter {
    manufacturer: Option<String>,
    physical_adapter: Option<bool>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32Fan {
    name: Option<String>,
}

// MSAcpi_ThermalZoneTemperature lives in root\wmi, not root\cimv2.
// Temperature is in tenths of Kelvin — convert with: (value / 10.0) - 273.15
#[derive(Deserialize, Debug)]
struct MsAcpiThermalZone {
    #[serde(rename = "CurrentTemperature")]
    current_temperature: Option<u32>,
}

pub fn scan() -> Result<HardwareScan> {
    let com = COMLibrary::new().context("COM init")?;
    let wmi = WMIConnection::new(com).context("WMI connect")?;

    let cpus: Vec<Win32Processor> = wmi
        .raw_query("SELECT Name FROM Win32_Processor")
        .context("query Win32_Processor")?;
    let gpus: Vec<Win32VideoController> = wmi
        .raw_query("SELECT Name, AdapterRAM FROM Win32_VideoController")
        .context("query Win32_VideoController")?;
    let memory: Vec<Win32PhysicalMemory> = wmi
        .raw_query("SELECT Capacity, Speed FROM Win32_PhysicalMemory")
        .context("query Win32_PhysicalMemory")?;
    let boards: Vec<Win32BaseBoard> = wmi
        .raw_query("SELECT Manufacturer, Product FROM Win32_BaseBoard")
        .context("query Win32_BaseBoard")?;
    let chassis: Vec<Win32SystemEnclosure> = wmi
        .raw_query("SELECT ChassisTypes FROM Win32_SystemEnclosure")
        .context("query Win32_SystemEnclosure")?;
    let nics: Vec<Win32NetworkAdapter> = wmi
        .raw_query("SELECT Manufacturer, PhysicalAdapter FROM Win32_NetworkAdapter")
        .context("query Win32_NetworkAdapter")?;

    // Fan count — Win32_Fan is optional; many consumer boards don't expose fans
    // via WMI even when fans are present, so we treat 0 results as "unknown".
    let fans: Vec<Win32Fan> = wmi
        .raw_query("SELECT Name FROM Win32_Fan")
        .unwrap_or_default();
    let fan_count: Option<u32> = if fans.is_empty() {
        None
    } else {
        Some(fans.len() as u32)
    };

    // Pick the "main" GPU heuristically: largest VRAM that isn't a virtual / RDP adapter.
    let main_gpu = gpus
        .iter()
        .filter(|g| {
            g.name
                .as_deref()
                .map(|n| !n.contains("Virtual") && !n.contains("Remote"))
                .unwrap_or(true)
        })
        .max_by_key(|g| g.adapter_ram.unwrap_or(0));

    let cpu = cpus
        .first()
        .and_then(|c| c.name.clone())
        .unwrap_or_else(|| "Unknown CPU".into());
    let gpu = main_gpu
        .and_then(|g| g.name.clone())
        .unwrap_or_else(|| "Unknown GPU".into());
    let vram_mb = main_gpu
        .and_then(|g| g.adapter_ram)
        .map(|bytes| (bytes / (1024 * 1024)) as u64);

    let total_capacity: u64 = memory.iter().map(|m| m.capacity.unwrap_or(0)).sum();
    let ram_gb = if total_capacity > 0 {
        Some((total_capacity / (1024 * 1024 * 1024)) as u32)
    } else {
        None
    };
    let ram_mhz = memory.iter().filter_map(|m| m.speed).max();

    let motherboard = boards.first().map(|b| {
        format!(
            "{} {}",
            b.manufacturer.clone().unwrap_or_default(),
            b.product.clone().unwrap_or_default()
        )
        .trim()
        .to_string()
    });

    // ChassisTypes per WMI docs: 3 desktop, 4 low-profile desktop, 8/9/10 laptop/notebook, 11 hand-held, 14 sub-notebook…
    let chassis_label = chassis.first().and_then(|c| {
        c.chassis_types.as_ref().and_then(|v| v.first()).map(|t| {
            match *t {
                8 | 9 | 10 | 14 | 11 => "laptop".to_string(),
                3 | 4 | 6 | 7 => "desktop".to_string(),
                15 | 16 => "tower".to_string(),
                17 | 23 => "server".to_string(),
                _ => format!("chassis-{}", t),
            }
        })
    });

    // Cooling label: prefer real fan count, then chassis-derived fallback.
    let cooling_type = match (chassis_label.as_deref(), fan_count) {
        (_, Some(n)) if n > 0 => Some(format!("{} fan{}", n, if n == 1 { "" } else { "s" })),
        (Some("laptop"), _) => Some("stock".to_string()),
        _ => Some("air".to_string()),
    };

    let nic_vendor = nics
        .iter()
        .filter(|n| n.physical_adapter.unwrap_or(false))
        .find_map(|n| n.manufacturer.clone());

    // CPU temperature via MSAcpi_ThermalZoneTemperature (root\wmi namespace).
    // This is the same source Windows Task Manager and most monitoring tools use.
    // Wrap in a closure so any failure returns None gracefully.
    let cpu_temp_c: Option<f32> = (|| -> Option<f32> {
        let com2 = COMLibrary::new().ok()?;
        let wmi_root = WMIConnection::with_namespace_path("ROOT\\WMI", com2).ok()?;
        let zones: Vec<MsAcpiThermalZone> = wmi_root
            .raw_query("SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature")
            .ok()?;
        // Convert tenths of Kelvin → Celsius, filter implausible values
        let mut temps: Vec<f32> = zones
            .iter()
            .filter_map(|z| z.current_temperature)
            .filter(|&t| t > 2731) // > 0 °C
            .map(|t| (t as f32 / 10.0) - 273.15)
            .filter(|&c| c > 0.0 && c < 115.0)
            .collect();
        if temps.is_empty() {
            return None;
        }
        // Return the highest thermal zone (most likely CPU package)
        temps.sort_by(|a, b| a.partial_cmp(b).unwrap());
        temps.last().copied()
    })();

    Ok(HardwareScan {
        cpu,
        gpu,
        vram_mb,
        ram_gb,
        ram_mhz,
        motherboard,
        chassis: chassis_label,
        cooling_type,
        fan_count,
        cpu_temp_c,
        refresh_hz: None,
        nic_vendor,
        anticheats: Vec::new(),
    })
}
