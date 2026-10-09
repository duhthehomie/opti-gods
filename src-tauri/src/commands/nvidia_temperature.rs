// Standard NVIDIA temperature telemetry. No nvidia-smi installation is required.
fn valid_gpu_temperature(value: i32) -> bool { value > 5 && value < 130 }

#[cfg(windows)]
fn read_nvidia_temperature() -> Option<f32> {
    use std::ffi::c_void;
    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct Sensor { controller: i32, minimum: i32, maximum: i32, current: i32, target: i32 }
    #[repr(C)]
    struct Thermal { version: u32, count: u32, sensors: [Sensor; 3] }
    // Reuse the System32-only loader and balanced NVAPI initialize/unload.
    // A preset operation owns the driver session. Telemetry must not block it
    // or unload NVAPI underneath it; the sensor helper is an independent fallback.
    let api = super::misc::NvApiLibrary::try_load()?;
    let enumerate: unsafe extern "C" fn(*mut *mut c_void, *mut u32) -> i32 =
        unsafe { std::mem::transmute(api.resolve(0xE5AC921F, "GPU thermal enumeration").ok()?) };
    let thermal: unsafe extern "C" fn(*mut c_void, u32, *mut Thermal) -> i32 =
        unsafe { std::mem::transmute(api.resolve(0xE3640A56, "GPU thermal sensor").ok()?) };
    let mut handles = [std::ptr::null_mut(); 64];
    let mut count = 0;
    if unsafe { enumerate(handles.as_mut_ptr(), &mut count) } != 0 || count > 64 { return None; }
    for handle in handles.iter().take(count as usize) {
        if handle.is_null() { continue; }
        for version in [2, 1] {
            for selector in [15, 0] { // NVAPI_THERMAL_TARGET_ALL, then legacy GPU sensor.
                let mut data = Thermal {
                    version: std::mem::size_of::<Thermal>() as u32 | (version << 16),
                    count: 0, sensors: [Sensor::default(); 3],
                };
                if unsafe { thermal(*handle, selector, &mut data) } == 0 && data.count <= 3 {
                    for sensor in data.sensors.iter().take(data.count as usize) {
                        if sensor.target == 1 && valid_gpu_temperature(sensor.current) {
                            return Some(sensor.current as f32);
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod nvidia_temperature_tests {
    #[test]
    fn rejects_absent_and_invalid_temperatures() {
        assert!(super::valid_gpu_temperature(61));
        assert!(!super::valid_gpu_temperature(0));
        assert!(!super::valid_gpu_temperature(-1));
        assert!(!super::valid_gpu_temperature(130));
    }
}
