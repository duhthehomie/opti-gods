// WMI-driven hardware scan. Returns the typed payload that the existing
// server endpoint /api/hardware/scan already validates.

use crate::commands::hardware::HardwareScan;
use anyhow::{Context, Result};
use serde::Deserialize;
use std::os::windows::process::CommandExt;
use std::process::Command;
use wmi::{COMLibrary, WMIConnection};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32Processor {
    name: Option<String>,
    number_of_cores: Option<u32>,
    number_of_logical_processors: Option<u32>,
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
    configured_clock_speed: Option<u32>,
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
struct Win32ComputerSystem {
    manufacturer: Option<String>,
    model: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32OperatingSystem {
    caption: Option<String>,
    build_number: Option<String>,
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

// Used to detect ACPI-registered fans (e.g. "ACPI Fan" in Device Manager).
// Many OEM boards (HP, Dell, Lenovo) expose case fans here even when
// Win32_Fan only sees the CPU fan header.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32PnPFan {
    name: Option<String>,
}

// MSAcpi_ThermalZoneTemperature lives in root\wmi, not root\cimv2.
// Temperature is in tenths of Kelvin — convert with: (value / 10.0) - 273.15
#[derive(Deserialize, Debug)]
struct MsAcpiThermalZone {
    #[serde(rename = "CurrentTemperature")]
    current_temperature: Option<u32>,
}

/// Win32_VideoController.AdapterRAM is a 32-bit number, so Windows reports
/// 4 GB for every card with more memory (an RTX 5060 shows 4 GB). The driver
/// stores the real size as a 64-bit value in the display class registry key,
/// and NVIDIA's own tool reports it exactly, so read those instead.
fn real_vram_bytes(gpu_name: &str, wmi_adapter_ram: Option<u64>) -> Option<u64> {
    use winreg::enums::*;
    use winreg::RegKey;

    let from_registry = (|| -> Option<u64> {
        let class = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}")
            .ok()?;
        let mut best: Option<u64> = None;
        for name in class.enum_keys().flatten() {
            if name.len() != 4 || !name.chars().all(|c| c.is_ascii_digit()) { continue; }
            let Ok(key) = class.open_subkey(&name) else { continue };
            let desc: String = key.get_value("DriverDesc").unwrap_or_default();
            if !desc.eq_ignore_ascii_case(gpu_name) { continue; }
            let bytes = key.get_value::<u64, _>("HardwareInformation.qwMemorySize").ok().or_else(|| {
                // Some drivers store it as 8 raw bytes instead of a QWORD.
                let raw = key.get_raw_value("HardwareInformation.qwMemorySize").ok()?;
                (raw.bytes.len() == 8).then(|| u64::from_le_bytes(raw.bytes.clone().try_into().unwrap()))
            });
            if let Some(b) = bytes.filter(|b| *b > 0) {
                best = Some(best.map_or(b, |old| old.max(b)));
            }
        }
        best
    })();
    if from_registry.is_some() { return from_registry; }

    if gpu_name.to_ascii_lowercase().contains("nvidia") {
        let mb = Command::new("nvidia-smi.exe")
            .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
            .creation_flags(0x0800_0000)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|text| {
                let wanted = gpu_name.to_ascii_lowercase();
                text.lines().find_map(|line| {
                    let (name, mem) = line.rsplit_once(',')?;
                    let name = name.trim().to_ascii_lowercase();
                    (wanted.contains(&name) || name.contains(&wanted)).then(|| mem.trim().parse::<u64>().ok()).flatten()
                })
            });
        if let Some(mb) = mb.filter(|m| *m > 0) { return Some(mb * 1024 * 1024); }
    }
    wmi_adapter_ram
}

pub fn scan() -> Result<HardwareScan> {
    crate::win32::restore::initialize_com_security()?;
    let com = COMLibrary::new().context("COM init")?;
    let wmi = WMIConnection::new(com).context("WMI connect")?;

    let cpus: Vec<Win32Processor> = wmi
        .raw_query("SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor")
        .context("query Win32_Processor")?;
    let gpus: Vec<Win32VideoController> = wmi
        .raw_query("SELECT Name, AdapterRAM FROM Win32_VideoController")
        .context("query Win32_VideoController")?;
    let memory: Vec<Win32PhysicalMemory> = wmi
        .raw_query("SELECT Capacity, Speed, ConfiguredClockSpeed FROM Win32_PhysicalMemory")
        .context("query Win32_PhysicalMemory")?;
    let boards: Vec<Win32BaseBoard> = wmi
        .raw_query("SELECT Manufacturer, Product FROM Win32_BaseBoard")
        .context("query Win32_BaseBoard")?;
    let chassis: Vec<Win32SystemEnclosure> = wmi
        .raw_query("SELECT ChassisTypes FROM Win32_SystemEnclosure")
        .context("query Win32_SystemEnclosure")?;
    let computers: Vec<Win32ComputerSystem> = wmi
        .raw_query("SELECT Manufacturer, Model FROM Win32_ComputerSystem")
        .unwrap_or_default();
    let operating_systems: Vec<Win32OperatingSystem> = wmi
        .raw_query("SELECT Caption, BuildNumber FROM Win32_OperatingSystem")
        .unwrap_or_default();
    let nics: Vec<Win32NetworkAdapter> = wmi
        .raw_query("SELECT Manufacturer, PhysicalAdapter FROM Win32_NetworkAdapter")
        .context("query Win32_NetworkAdapter")?;

    // Fan count — three independent WMI sources, take the highest:
    //
    // 1. Win32_Fan — traditional; only CPU fan on most consumer desktop boards.
    // 2. Win32_PnPEntity WHERE PNPClass='Fan' — ACPI fans (OEM/laptop).
    // 3. Win32_PnPEntity WHERE Name LIKE '%Fan%' — catches boards that register
    //    fan headers under descriptions like "ACPI Fan", "System Fan", etc.
    //    Filtered to exclude non-fan matches (mouse, microphone, etc.).
    let fans: Vec<Win32Fan> = wmi
        .raw_query("SELECT Name FROM Win32_Fan")
        .unwrap_or_default();
    let wmi_fan_count = fans.len() as u32;

    let pnp_fans: Vec<Win32PnPFan> = wmi
        .raw_query("SELECT Name FROM Win32_PnPEntity WHERE PNPClass = 'Fan'")
        .unwrap_or_default();
    let pnp_fan_count = pnp_fans.len() as u32;

    // Third pass: Name LIKE '%Fan%' filtered to plausible fan device names
    let pnp_named_fans: Vec<Win32PnPFan> = wmi
        .raw_query("SELECT Name FROM Win32_PnPEntity WHERE Name LIKE '%Fan%' OR Description LIKE '%Fan%'")
        .unwrap_or_default();
    let named_fan_count = pnp_named_fans
        .iter()
        .filter(|f| {
            let n = f.name.as_deref().unwrap_or("").to_lowercase();
            // Only count entries that look like real fans; skip "Fancy", "Fanatic", etc.
            (n.contains("fan") || n.contains("cooling"))
                && !n.contains("fancy")
                && !n.contains("fanatic")
                && !n.contains("fantasy")
                && !n.contains("fanfare")
        })
        .count() as u32;

    // Use the highest count any motherboard/ACPI source reports. These WMI
    // sources overlap heavily, so summing them would double-count one fan.
    let best_count = wmi_fan_count.max(pnp_fan_count).max(named_fan_count);

    // Pick the "main" GPU heuristically: largest VRAM that isn't a virtual / RDP adapter.
    let main_gpu = gpus
        .iter()
        .filter(|g| {
            g.name
                .as_deref()
                .map(|n| !n.contains("Virtual") && !n.contains("Remote"))
                .unwrap_or(true)
        })
        .max_by_key(|g| g.name.as_deref().and_then(|n| real_vram_bytes(n, g.adapter_ram)).unwrap_or(0));

    // NVIDIA exposes one controllable cooling source through nvidia-smi even
    // when motherboard WMI only reports the CPU/chassis fan. Count that source
    // separately so a GPU fan plus one board fan is not displayed as one.
    let nvidia_fan_visible = Command::new("nvidia-smi.exe")
        .args(["--query-gpu=fan.speed", "--format=csv,noheader,nounits"])
        .creation_flags(0x0800_0000)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|output| output.lines().any(|line| line.trim().parse::<u32>().is_ok()))
        .unwrap_or(false);
    let detected_fan_sources = best_count + u32::from(nvidia_fan_visible);
    let fan_count: Option<u32> = (detected_fan_sources > 0).then_some(detected_fan_sources);

    let cpu = cpus
        .first()
        .and_then(|c| c.name.clone())
        .unwrap_or_else(|| "Unknown CPU".into());
    let gpu = main_gpu
        .and_then(|g| g.name.clone())
        .unwrap_or_else(|| "Unknown GPU".into());
    let vram_mb = main_gpu
        .and_then(|g| real_vram_bytes(g.name.as_deref().unwrap_or(""), g.adapter_ram))
        .map(|bytes| bytes / (1024 * 1024));

    let total_capacity: u64 = memory.iter().map(|m| m.capacity.unwrap_or(0)).sum();
    let ram_gb = if total_capacity > 0 {
        Some((total_capacity / (1024 * 1024 * 1024)) as u32)
    } else {
        None
    };
    let ram_mhz = memory.iter().map(|m| {
        m.speed.unwrap_or(0).max(m.configured_clock_speed.unwrap_or(0))
    }).filter(|&v| v > 0).max();

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

    // netsh reports the actual connected Wi-Fi network. Adapter Manufacturer
    // often says "Microsoft", which is not useful to the user.
    let wifi = Command::new("netsh.exe")
        .args(["wlan", "show", "interfaces"])
        .creation_flags(0x0800_0000)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok());
    let network_ssid = wifi.as_deref().and_then(|output| {
        output.lines().find_map(|line| {
            let (key, value) = line.split_once(':')?;
            (key.trim().eq_ignore_ascii_case("SSID") && !key.trim().eq_ignore_ascii_case("BSSID"))
                .then(|| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
    });
    let channel = wifi.as_deref().and_then(|output| {
        output.lines().find_map(|line| {
            let (key, value) = line.split_once(':')?;
            key.trim().eq_ignore_ascii_case("Channel")
                .then(|| value.trim().parse::<u32>().ok())
                .flatten()
        })
    });
    let network_band = channel.map(|channel| {
        if channel <= 14 { "2.4 GHz" }
        else if channel >= 181 { "6 GHz" }
        else { "5 GHz" }
        .to_string()
    });

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
        network_ssid,
        network_band,
        anticheats: Vec::new(),
        system_model: computers.first().and_then(|c| {
            let manufacturer = c.manufacturer.as_deref().unwrap_or("").trim();
            let model = c.model.as_deref().unwrap_or("").trim();
            let value = if model.is_empty() {
                manufacturer.to_string()
            } else if manufacturer.is_empty()
                || model.eq_ignore_ascii_case(manufacturer)
                || model.to_ascii_lowercase().starts_with(&format!("{} ", manufacturer.to_ascii_lowercase()))
            {
                model.to_string()
            } else {
                format!("{manufacturer} {model}")
            };
            (!value.is_empty()).then_some(value)
        }),
        os_name: operating_systems.first().and_then(|o| o.caption.clone()),
        os_build: operating_systems.first().and_then(|o| o.build_number.as_deref()?.parse().ok()),
        cpu_cores: cpus.first().and_then(|c| c.number_of_cores),
        cpu_threads: cpus.first().and_then(|c| c.number_of_logical_processors),
        is_laptop: chassis.first().and_then(|c| c.chassis_types.as_ref()).map(|types| {
            types.iter().any(|t| matches!(t, 8 | 9 | 10 | 14))
        }),
    })
}
