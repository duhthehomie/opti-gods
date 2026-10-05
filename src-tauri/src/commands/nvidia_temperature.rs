// Read-only NVIDIA thermal API fallback for systems without nvidia-smi.
#[cfg(windows)]
fn read_nvidia_temperature() -> Option<f32> {
    use std::ffi::c_void;
    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct Sensor { controller: i32, minimum: i32, maximum: i32, current: i32, target: i32 }
    #[repr(C)]
    struct Thermal { version: u32, count: u32, sensors: [Sensor; 3] }
    unsafe {
        let library = libloading::Library::new("nvapi64.dll").or_else(|_| libloading::Library::new("nvapi.dll")).ok()?;
        let query = library.get::<unsafe extern "C" fn(u32) -> *const c_void>(b"nvapi_QueryInterface\0").ok()?;
        let init = query(0x0150E828);
        let enumerate = query(0xE5AC921F);
        let thermal = query(0xE3640A56);
        if init.is_null() || enumerate.is_null() || thermal.is_null() { return None; }
        let init: unsafe extern "C" fn() -> i32 = std::mem::transmute(init);
        let enumerate: unsafe extern "C" fn(*mut *mut c_void, *mut u32) -> i32 = std::mem::transmute(enumerate);
        let thermal: unsafe extern "C" fn(*mut c_void, u32, *mut Thermal) -> i32 = std::mem::transmute(thermal);
        if init() != 0 { return None; }
        let mut handles = [std::ptr::null_mut(); 64];
        let mut count = 0u32;
        if enumerate(handles.as_mut_ptr(), &mut count) != 0 { return None; }
        for handle in handles.iter().take((count as usize).min(64)) {
            let mut data = Thermal {
                version: std::mem::size_of::<Thermal>() as u32 | (2 << 16),
                count: 0, sensors: [Sensor::default(); 3],
            };
            if thermal(*handle, 0, &mut data) == 0 {
                for sensor in data.sensors.iter().take((data.count as usize).min(3)) {
                    if sensor.target == 1 && sensor.current > 5 && sensor.current < 130 {
                        return Some(sensor.current as f32);
                    }
                }
            }
        }
        None
    }
}
