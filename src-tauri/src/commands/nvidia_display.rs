// NVAPI layouts/IDs follow NVIDIA's public nvapi.h and nvapi_interface.h.
// Never manufacture an OpenGL affinity string: select a value advertised by the driver.
pub(super) fn select_gpu_value(values: &[String], name: &str, physical_gpu_count: usize) -> Result<String, String> {
    let candidates: Vec<&String> = values.iter().filter(|v| {
        !v.trim().is_empty() && !["auto", "autoselect"].contains(&v.trim().to_ascii_lowercase().as_str())
    }).collect();
    let normalized_name = name.trim().to_ascii_lowercase();
    let matching: Vec<&String> = candidates.iter().copied()
        .filter(|v| !normalized_name.is_empty() && v.to_ascii_lowercase().contains(&normalized_name))
        .collect();
    if matching.len() == 1 { return Ok(matching[0].to_string()); }
    if matching.is_empty() && candidates.len() == 1 && physical_gpu_count == 1 {
        return Ok(candidates[0].to_string());
    }
    Err(format!("The NVIDIA driver did not advertise an unambiguous explicit OpenGL GPU value for {name}. No settings were changed. Select that GPU in NVIDIA Control Panel and export the global profile for diagnosis; automatic selection was not substituted."))
}

pub(super) fn vibrance_success(count: usize) -> String {
    format!("Digital Vibrance applied (to {count} {}) at 85%", if count == 1 { "monitor" } else { "monitors" })
}

#[cfg(windows)]
pub(super) mod runtime {
    use super::super::NvApiLibrary;
    use std::ffi::c_void;
    type Handle = *mut c_void;
    type EnumPhysical = unsafe extern "C" fn(*mut Handle, *mut u32) -> i32;
    type EnumDisplay = unsafe extern "C" fn(u32, *mut Handle) -> i32;
    type DisplayGpus = unsafe extern "C" fn(Handle, *mut Handle, *mut u32) -> i32;
    type Connected = unsafe extern "C" fn(Handle, *mut DisplayId, *mut u32, u32) -> i32;
    type GpuOutput = unsafe extern "C" fn(u32, *mut Handle, *mut u32) -> i32;
    type FullName = unsafe extern "C" fn(Handle, *mut u8) -> i32;
    type EnumValues = unsafe extern "C" fn(u32, *mut u32, *mut c_void) -> i32;

    #[repr(C)]
    struct DisplayDevice {
        size: u32,
        name: [u16; 32],
        description: [u16; 128],
        flags: u32,
        id: [u16; 128],
        key: [u16; 128],
    }
    #[link(name = "user32")]
    extern "system" {
        fn EnumDisplayDevicesW(device: *const u16, index: u32, result: *mut DisplayDevice, flags: u32) -> i32;
    }

    fn require_all_active_adapters_nvidia() -> Result<(), String> {
        let mut active_count = 0;
        for index in 0..64 {
            let mut device: DisplayDevice = unsafe { std::mem::zeroed() };
            device.size = std::mem::size_of::<DisplayDevice>() as u32;
            if unsafe { EnumDisplayDevicesW(std::ptr::null(), index, &mut device, 0) } == 0 { break; }
            if device.flags & 1 == 0 || device.flags & 8 != 0 { continue; } // attached desktop; exclude mirror driver
            active_count += 1;
            let decode = |units: &[u16]| {
                String::from_utf16_lossy(&units[..units.iter().position(|u| *u == 0).unwrap_or(units.len())])
            };
            let id = decode(&device.id).to_ascii_uppercase();
            let description = decode(&device.description);
            if !id.contains("VEN_10DE") {
                return Err(format!("An active display is driven by {description}, not NVIDIA. NVIDIA Digital Vibrance cannot control that monitor. No settings were changed; connect every monitor to NVIDIA-controlled outputs before applying the all-monitor preset."));
            }
        }
        if active_count == 0 { return Err("Windows reported no active desktop displays. No settings were changed.".into()); }
        Ok(())
    }

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct DisplayId { version: u32, connector_type: u32, display_id: u32, flags: u32 }

    #[derive(Clone)]
    pub(crate) struct Target {
        pub display_id: u32,
        pub output_id: u32,
        pub gpu: usize,
        pub handle: usize,
    }

    fn physical_gpus(api: &NvApiLibrary) -> Result<Vec<Handle>, String> {
        let function: EnumPhysical = unsafe { std::mem::transmute(api.resolve(0xe5ac921f, "physical GPU enumeration")?) };
        let mut handles = [std::ptr::null_mut(); 64];
        let mut count = 0;
        let status = unsafe { function(handles.as_mut_ptr(), &mut count) };
        if status != 0 || count == 0 || count > 64 {
            return Err(format!("NVIDIA physical GPU enumeration failed (status {status}, count {count})."));
        }
        Ok(handles[..count as usize].to_vec())
    }

    pub(crate) fn active_targets(api: &NvApiLibrary) -> Result<Vec<Target>, String> {
        require_all_active_adapters_nvidia()?;
        let enum_display: EnumDisplay = unsafe { std::mem::transmute(api.resolve(0x9abdd40d, "display enumeration")?) };
        let display_gpus: DisplayGpus = unsafe { std::mem::transmute(api.resolve(0x34ef9506, "display GPU mapping")?) };
        let connected: Connected = unsafe { std::mem::transmute(api.resolve(0x0078dba2, "connected display IDs")?) };
        let gpu_output: GpuOutput = unsafe { std::mem::transmute(api.resolve(0x112ba1a5, "display output mapping")?) };
        let mut handles_by_gpu = std::collections::HashMap::new();
        for index in 0..64 {
            let mut display = std::ptr::null_mut();
            let status = unsafe { enum_display(index, &mut display) };
            if status == -7 { break; }
            if status != 0 || display.is_null() { return Err(format!("NVIDIA display enumeration failed (status {status}).")); }
            let mut gpus = [std::ptr::null_mut(); 64];
            let mut count = 0;
            let status = unsafe { display_gpus(display, gpus.as_mut_ptr(), &mut count) };
            if status != 0 || count == 0 || count > 64 { return Err(format!("Could not map NVIDIA display to its GPU (status {status}).")); }
            for gpu in &gpus[..count as usize] { handles_by_gpu.entry(*gpu as usize).or_insert(display as usize); }
        }
        let mut result = Vec::new();
        let mut seen_displays = std::collections::HashSet::new();
        let mut seen_outputs = std::collections::HashSet::new();
        for gpu in physical_gpus(api)? {
            let mut count = 0;
            let status = unsafe { connected(gpu, std::ptr::null_mut(), &mut count, 0) };
            if status != 0 || count > 256 { return Err(format!("Could not enumerate connected NVIDIA monitors (status {status}).")); }
            if count == 0 { continue; }
            // NVIDIA's NV_GPU_DISPLAYIDS_VER2 uses structure version 3, not 2.
            let version = std::mem::size_of::<DisplayId>() as u32 | (3 << 16);
            let capacity = count;
            let mut displays = vec![DisplayId { version, ..Default::default() }; count as usize];
            let status = unsafe { connected(gpu, displays.as_mut_ptr(), &mut count, 0) };
            if status != 0 || count > capacity { return Err(format!("NVIDIA monitor topology changed during enumeration (status {status}).")); }
            for display in &displays[..count as usize] {
                if display.flags & (1 << 2) == 0 { continue; } // isActive: ignore disconnected/inactive outputs.
                if !seen_displays.insert(display.display_id) { continue; }
                let mut mapped_gpu = std::ptr::null_mut();
                let mut output_id = 0;
                let status = unsafe { gpu_output(display.display_id, &mut mapped_gpu, &mut output_id) };
                if status != 0 || mapped_gpu != gpu || output_id == 0 {
                    return Err(format!("Active monitor {} has no independently addressable NVIDIA output (status {status}). No display was changed.", display.display_id));
                }
                if !seen_outputs.insert((gpu as usize, output_id)) {
                    return Err("Multiple active NVIDIA monitors share an output that this driver cannot control independently (MST/clone topology). No display was changed.".into());
                }
                let handle = *handles_by_gpu.get(&(gpu as usize))
                    .ok_or_else(|| format!("Active NVIDIA monitor {} has no Digital Vibrance display handle. No display was changed.", display.display_id))?;
                result.push(Target { display_id: display.display_id, output_id, gpu: gpu as usize, handle });
            }
        }
        if result.is_empty() { return Err("No active NVIDIA-controlled monitor was found. No display was changed.".into()); }
        Ok(result)
    }

    pub(crate) fn explicit_gpu_value(api: &NvApiLibrary, targets: &[Target]) -> Result<(String, String), String> {
        let active: std::collections::HashSet<usize> = targets.iter().map(|t| t.gpu).collect();
        if active.len() != 1 {
            return Err("More than one active NVIDIA GPU was found; explicit OpenGL GPU selection is ambiguous. No settings were changed.".into());
        }
        let gpu = *active.iter().next().unwrap() as Handle;
        let get_name: FullName = unsafe { std::mem::transmute(api.resolve(0xceee8e9f, "GPU name")?) };
        let mut bytes = [0u8; 64];
        let status = unsafe { get_name(gpu, bytes.as_mut_ptr()) };
        if status != 0 { return Err(format!("Could not read the active NVIDIA GPU name (status {status}).")); }
        let end = bytes.iter().position(|b| *b == 0).unwrap_or(bytes.len());
        let name = String::from_utf8_lossy(&bytes[..end]).into_owned();
        let enum_values: EnumValues = unsafe { std::mem::transmute(api.resolve(0x2ec39f90, "available OpenGL GPU values")?) };
        // NVDRS_SETTING_VALUES is pack(4): 12-byte header and 101 unions of
        // NVDRS_BINARY_SETTING (4-byte length + 4096 bytes), including the default.
        const UNION_BYTES: usize = 4100;
        const BUFFER_BYTES: usize = 12 + 101 * UNION_BYTES;
        let mut aligned = vec![0u32; BUFFER_BYTES / 4];
        aligned[0] = BUFFER_BYTES as u32 | (1 << 16);
        let mut count = 100;
        let status = unsafe { enum_values(0x20d0f3e6, &mut count, aligned.as_mut_ptr().cast()) };
        if status != 0 || count > 100 || aligned[1] > count || aligned[2] != 3 {
            return Err(format!("The NVIDIA driver cannot enumerate explicit OpenGL GPU choices (status {status}). No settings were changed; automatic selection was not substituted."));
        }
        let data = unsafe { std::slice::from_raw_parts(aligned.as_ptr().cast::<u8>(), BUFFER_BYTES) };
        let mut values = Vec::new();
        for index in 0..aligned[1] as usize {
            let start = 12 + UNION_BYTES + index * UNION_BYTES;
            let units: Vec<u16> = data[start..start + 4096].chunks_exact(2)
                .map(|b| u16::from_le_bytes([b[0], b[1]])).take_while(|u| *u != 0).collect();
            let value = String::from_utf16(&units).map_err(|_| "Driver returned an invalid OpenGL GPU choice.".to_string())?;
            if !values.contains(&value) { values.push(value); }
        }
        let value = super::select_gpu_value(&values, &name, physical_gpus(api)?.len())?;
        Ok((name, value))
    }

    #[cfg(test)]
    mod tests {
        #[test]
        fn public_display_id_layout_is_16_bytes() {
            assert_eq!(std::mem::size_of::<super::DisplayId>(), 16);
            assert_eq!(std::mem::size_of::<super::DisplayDevice>(), 840);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn selects_only_driver_advertised_explicit_gpu() {
        let options = vec!["autoselect".into(), "NVIDIA GeForce GTX 1650 SUPER".into()];
        assert_eq!(select_gpu_value(&options, "NVIDIA GeForce GTX 1650 SUPER", 1).unwrap(), options[1]);
        assert!(select_gpu_value(&["autoselect".into()], "GTX 1650 SUPER", 1).is_err());
        assert!(select_gpu_value(&["GPU-A".into(), "GPU-B".into()], "GTX 1650 SUPER", 2).is_err());
        assert_eq!(select_gpu_value(&["autoselect".into(), "driver-device-id".into()], "GTX 1650 SUPER", 1).unwrap(), "driver-device-id");
    }
    #[test]
    fn success_message_uses_verified_monitor_count() {
        assert_eq!(vibrance_success(1), "Digital Vibrance applied (to 1 monitor) at 85%");
        assert_eq!(vibrance_success(2), "Digital Vibrance applied (to 2 monitors) at 85%");
    }
}
