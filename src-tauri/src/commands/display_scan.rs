use super::MonitorInfo;
use serde::Deserialize;
use wmi::{COMLibrary, WMIConnection};

#[repr(C)]
struct Device {
    size: u32, name: [u16; 32], description: [u16; 128],
    flags: u32, id: [u16; 128], key: [u16; 128],
}
#[link(name = "user32")]
extern "system" {
    fn EnumDisplayDevicesW(device: *const u16, index: u32, output: *mut Device, flags: u32) -> i32;
    fn EnumDisplaySettingsW(device: *const u16, index: u32, mode: *mut std::ffi::c_void) -> i32;
}

fn text(units: &[u16]) -> String {
    String::from_utf16_lossy(&units[..units.iter().position(|u| *u == 0).unwrap_or(units.len())]).trim().to_string()
}
fn device() -> Device {
    let mut result: Device = unsafe { std::mem::zeroed() };
    result.size = std::mem::size_of::<Device>() as u32;
    result
}
// DEVMODEW has a 220-byte layout. dmSize is at offset 68; desktop width,
// height and frequency are DWORDs at 172, 176, 184. No unions are dereferenced.
fn mode() -> [u32; 55] {
    let mut result = [0; 55];
    result[17] = 220;
    result
}
fn rates(name: &[u16]) -> (Option<u32>, Option<u32>) {
    let mut current = mode();
    if unsafe { EnumDisplaySettingsW(name.as_ptr(), u32::MAX, current.as_mut_ptr().cast()) } == 0 {
        return (None, None);
    }
    let current_hz = (current[46] > 1).then_some(current[46]);
    let mut maximum = current_hz;
    for index in 0..4096 {
        let mut candidate = mode();
        if unsafe { EnumDisplaySettingsW(name.as_ptr(), index, candidate.as_mut_ptr().cast()) } == 0 { break; }
        if candidate[43] == current[43] && candidate[44] == current[44] && candidate[46] > 1 {
            maximum = Some(maximum.unwrap_or(0).max(candidate[46]));
        }
    }
    (current_hz, maximum)
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct MonitorId {
    instance_name: String,
    user_friendly_name: Option<Vec<u16>>,
    active: bool,
}
fn friendly_names() -> Vec<(String, String)> {
    let result = (|| -> Result<Vec<MonitorId>, String> {
        let com = COMLibrary::new().map_err(|e| e.to_string())?;
        let connection = WMIConnection::with_namespace_path("ROOT\\WMI", com).map_err(|e| e.to_string())?;
        connection.raw_query("SELECT InstanceName, UserFriendlyName, Active FROM WmiMonitorID")
            .map_err(|e| e.to_string())
    })();
    match result {
        Ok(names) => names.into_iter().filter(|m| m.active).filter_map(|m| {
            let name = text(&m.user_friendly_name?);
            (!name.is_empty()).then_some((m.instance_name.to_ascii_uppercase(), name))
        }).collect(),
        Err(error) => {
            eprintln!("[display-scan] EDID names unavailable; using Windows display names: {error}");
            Vec::new()
        }
    }
}

pub(super) fn monitors() -> Vec<MonitorInfo> {
    let names = friendly_names();
    let mut monitors = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for adapter_index in 0..64 {
        let mut adapter = device();
        if unsafe { EnumDisplayDevicesW(std::ptr::null(), adapter_index, &mut adapter, 0) } == 0 { break; }
        if adapter.flags & 1 == 0 || adapter.flags & 8 != 0 { continue; }
        let (current_hz, max_hz) = rates(&adapter.name);
        for monitor_index in 0..64 {
            let mut monitor = device();
            if unsafe { EnumDisplayDevicesW(adapter.name.as_ptr(), monitor_index, &mut monitor, 0) } == 0 { break; }
            if monitor.flags & 1 == 0 { continue; }
            let id = text(&monitor.id).to_ascii_uppercase().replacen("MONITOR\\", "DISPLAY\\", 1);
            let identity = if id.is_empty() { text(&monitor.name) } else { id.clone() };
            if !seen.insert(identity) { continue; }
            let model = id.split('\\').take(2).collect::<Vec<_>>().join("\\");
            let name = names.iter().find(|(instance, _)| instance.starts_with(&format!("{model}\\")) && !model.is_empty())
                .map(|(_, name)| name.clone()).unwrap_or_else(|| text(&monitor.description));
            monitors.push(MonitorInfo {
                name: if name.is_empty() { text(&monitor.name) } else { name },
                current_hz, max_hz,
            });
        }
    }
    monitors
}

#[cfg(test)]
mod tests {
    #[test]
    fn win32_buffers_match_windows_layout() {
        assert_eq!(std::mem::size_of::<super::Device>(), 840);
        assert_eq!(std::mem::size_of_val(&super::mode()), 220);
        assert_eq!(super::mode()[17], 220);
    }
}
