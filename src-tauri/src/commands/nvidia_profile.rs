// Global-only DRS transactions. No Profile Inspector GUI/export process and no
// application-profile mutations. Layout and entry points follow NVIDIA nvapi.h.
use super::{NipValue, NvApiLibrary, NVIDIA_PRESET_IMPORT_CANCELLED};
use std::collections::HashMap;
use std::ffi::c_void;
use std::sync::atomic::Ordering;
type Handle = *mut c_void;
type SessionFn = unsafe extern "C" fn(Handle) -> i32;
type ProfileFn = unsafe extern "C" fn(Handle, Handle) -> i32;
type ProfileLookup = unsafe extern "C" fn(Handle, *mut Handle) -> i32;
type SetSetting = unsafe extern "C" fn(Handle, Handle, *mut Setting) -> i32;
type GetSetting = unsafe extern "C" fn(Handle, Handle, u32, *mut Setting) -> i32;
type EnumSettings = unsafe extern "C" fn(Handle, Handle, u32, *mut u32, *mut Setting) -> i32;

// NVDRS_SETTING_V1: pack(4), UnicodeString[2048], two 4100-byte
// unions (binary length + 4096 bytes). Keep binary/ANSI backups byte-exact.
#[repr(C)]
#[derive(Clone)]
pub(super) struct Setting {
    version: u32,
    name: [u16; 2048],
    id: u32,
    kind: u32,
    location: u32,
    current_predefined: u32,
    predefined_valid: u32,
    predefined: [u32; 1025],
    current: [u32; 1025],
}

impl Setting {
    fn empty() -> Self {
        let mut value: Self = unsafe { std::mem::zeroed() };
        value.version = std::mem::size_of::<Self>() as u32 | (1 << 16);
        value
    }

    fn encode(id: u32, value: &NipValue) -> Result<Self, String> {
        let mut setting = Self::empty();
        setting.id = id;
        match value {
            NipValue::Numeric(value) => {
                setting.kind = 0; // NVDRS_DWORD_TYPE
                setting.current[0] = u32::try_from(*value)
                    .map_err(|_| format!("NVIDIA setting {id} exceeds DWORD range."))?;
            }
            NipValue::Text { kind, value } if kind == "String" => {
                setting.kind = 3; // NVDRS_WSTRING_TYPE
                let units: Vec<u16> = value.encode_utf16().collect();
                if units.len() >= 2048 || units.contains(&0) {
                    return Err(format!("NVIDIA setting {id} contains an invalid GPU string."));
                }
                for (index, unit) in units.iter().enumerate() {
                    setting.current[index / 2] |= u32::from(*unit) << ((index % 2) * 16);
                }
            }
            _ => return Err(format!("Unsupported requested NVIDIA setting type for {id}.")),
        }
        Ok(setting)
    }

    fn same_value(&self, other: &Self) -> bool {
        if self.id != other.id || self.kind != other.kind { return false; }
        match self.kind {
            0 => self.current[0] == other.current[0],
            3 => {
                let text = |value: &Self| value.current.iter().flat_map(|v| [*v as u16, (*v >> 16) as u16])
                    .take(2048).take_while(|u| *u != 0).collect::<Vec<_>>();
                text(self) == text(other)
            }
            _ => self.current == other.current,
        }
    }
}

struct Session {
    handle: Handle,
    profile: Handle,
    load: SessionFn,
    save: SessionFn,
    destroy: SessionFn,
    lookup: ProfileLookup,
    reset: ProfileFn,
    set: SetSetting,
    get: GetSetting,
    enumerate: EnumSettings,
    // Last field: library/session lock outlives all function pointers and Drop.
    _api: NvApiLibrary,
}

fn check(status: i32, phase: &str) -> Result<(), String> {
    if status == 0 { Ok(()) } else { Err(format!("NVIDIA {phase} failed (NVAPI status {status}).")) }
}

impl Session {
    fn open() -> Result<Self, String> {
        let api = NvApiLibrary::load()?;
        let create: unsafe extern "C" fn(*mut Handle) -> i32 =
            unsafe { std::mem::transmute(api.resolve(0x0694d52e, "DRS create")?) };
        let mut session = Self {
            handle: std::ptr::null_mut(), profile: std::ptr::null_mut(),
            load: unsafe { std::mem::transmute(api.resolve(0x375dbd6b, "DRS load")?) },
            save: unsafe { std::mem::transmute(api.resolve(0xfcbc7e14, "DRS save")?) },
            destroy: unsafe { std::mem::transmute(api.resolve(0xdad9cff8, "DRS destroy")?) },
            lookup: unsafe { std::mem::transmute(api.resolve(0x617bff9f, "DRS current global profile")?) },
            reset: unsafe { std::mem::transmute(api.resolve(0xfa5f6134, "DRS global reset")?) },
            set: unsafe { std::mem::transmute(api.resolve(0x577dd202, "DRS setting write")?) },
            get: unsafe { std::mem::transmute(api.resolve(0x73bf8338, "DRS setting read")?) },
            enumerate: unsafe { std::mem::transmute(api.resolve(0xae3039da, "DRS settings enumeration")?) },
            _api: api,
        };
        check(unsafe { create(&mut session.handle) }, "session creation")?;
        if session.handle.is_null() { return Err("NVIDIA returned an empty DRS session.".into()); }
        session.reload()?;
        Ok(session)
    }

    fn reload(&mut self) -> Result<(), String> {
        check(unsafe { (self.load)(self.handle) }, "persisted profile reload")?;
        self.profile = std::ptr::null_mut();
        check(unsafe { (self.lookup)(self.handle, &mut self.profile) }, "global profile lookup")?;
        if self.profile.is_null() { return Err("NVIDIA returned an empty global profile.".into()); }
        Ok(())
    }

    fn customized(&self) -> Result<Vec<Setting>, String> {
        let mut result = Vec::new();
        let mut index = 0;
        loop {
            let mut settings: Vec<Setting> = (0..32).map(|_| Setting::empty()).collect();
            let mut count = settings.len() as u32;
            let status = unsafe { (self.enumerate)(self.handle, self.profile, index, &mut count, settings.as_mut_ptr()) };
            if status == -7 { break; }
            check(status, "global backup enumeration")?;
            if count > 32 { return Err("NVIDIA returned an invalid backup size.".into()); }
            if count == 0 { break; }
            result.extend(settings.into_iter().take(count as usize)
                .filter(|s| s.location == 0 && s.current_predefined == 0));
            index += count;
            if index > 8192 { return Err("NVIDIA global profile enumeration exceeded its safety limit.".into()); }
        }
        Ok(result)
    }

    fn write(&self, settings: &[Setting], allow_cancel: bool) -> Result<(), String> {
        check(unsafe { (self.reset)(self.handle, self.profile) }, "global reset to defaults")?;
        for setting in settings {
            if allow_cancel && NVIDIA_PRESET_IMPORT_CANCELLED.load(Ordering::SeqCst) {
                return Err("NVIDIA preset was stopped before saving settings.".into());
            }
            let mut setting = setting.clone();
            check(unsafe { (self.set)(self.handle, self.profile, &mut setting) },
                &format!("global setting {} write", setting.id))?;
        }
        if allow_cancel && NVIDIA_PRESET_IMPORT_CANCELLED.load(Ordering::SeqCst) {
            return Err("NVIDIA preset was stopped before saving settings.".into());
        }
        check(unsafe { (self.save)(self.handle) }, "global settings save")
    }

    fn verify(&mut self, settings: &[Setting]) -> Result<(), String> {
        self.reload()?; // Never verify only the unsaved session values.
        for expected in settings {
            let mut actual = Setting::empty();
            check(unsafe { (self.get)(self.handle, self.profile, expected.id, &mut actual) },
                &format!("persisted setting {} readback", expected.id))?;
            if !expected.same_value(&actual) {
                return Err(format!("NVIDIA persisted global setting {} did not match its requested value.", expected.id));
            }
        }
        let expected_ids: std::collections::HashSet<u32> = settings.iter().map(|s| s.id).collect();
        if self.customized()?.iter().any(|s| !expected_ids.contains(&s.id)) {
            return Err("NVIDIA global readback retained an unexpected customized setting.".into());
        }
        Ok(())
    }

    fn restore(&mut self, backup: &[Setting]) -> Result<(), String> {
        self.reload()?;
        self.write(backup, false)?;
        self.verify(backup)?;
        let restored = self.customized()?;
        if restored.len() != backup.len() {
            return Err("NVIDIA rollback did not restore the exact original customized profile.".into());
        }
        Ok(())
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        if !self.handle.is_null() { let _ = unsafe { (self.destroy)(self.handle) }; }
    }
}

pub(super) fn apply(expected: &HashMap<u32, NipValue>, report: &impl Fn(&str)) -> Result<Vec<Setting>, String> {
    if expected.len() != 15 { return Err("The NVIDIA preset must contain exactly 15 settings.".into()); }
    let mut settings = expected.iter().map(|(id, value)| Setting::encode(*id, value))
        .collect::<Result<Vec<_>, _>>()?;
    settings.sort_by_key(|s| s.id);
    report("Backing up the NVIDIA global profile directly from the driver");
    let mut session = Session::open()?;
    let backup = session.customized()?;
    if NVIDIA_PRESET_IMPORT_CANCELLED.load(Ordering::SeqCst) {
        return Err("NVIDIA preset was stopped before changing settings.".into());
    }
    report("Applying all 15 NVIDIA global settings");
    let result = session.write(&settings, true).and_then(|_| {
        report("Reloading and verifying all 15 persisted NVIDIA settings");
        session.verify(&settings)
    }).and_then(|_| {
        if NVIDIA_PRESET_IMPORT_CANCELLED.load(Ordering::SeqCst) {
            Err("NVIDIA preset was stopped by the user.".into())
        } else { Ok(()) }
    });
    if let Err(error) = result {
        report("Restoring and verifying the original NVIDIA global profile");
        let note = match session.restore(&backup) {
            Ok(()) => " Original NVIDIA global settings were restored.".into(),
            Err(rollback) => format!(" WARNING: NVIDIA global rollback was incomplete: {rollback}."),
        };
        return Err(format!("{error} No preset success was recorded.{note} Digital Vibrance was not changed."));
    }
    Ok(backup)
}

pub(super) fn restore(backup: &[Setting]) -> Result<(), String> {
    Session::open()?.restore(backup)
}

pub(super) fn verify(expected: &HashMap<u32, NipValue>) -> Result<(), String> {
    if expected.len() != 15 { return Err("The NVIDIA preset must contain exactly 15 settings.".into()); }
    let settings = expected.iter().map(|(id, value)| Setting::encode(*id, value))
        .collect::<Result<Vec<_>, _>>()?;
    Session::open()?.verify(&settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn layout_matches_nvidia_v1_pack4() {
        assert_eq!(std::mem::size_of::<Setting>(), 12320);
        assert_eq!(std::mem::align_of::<Setting>(), 4);
        assert_eq!(Setting::empty().version, 12320 | (1 << 16));
    }
    #[test]
    fn typed_readback_does_not_accept_an_unchanged_or_wrong_typed_value() {
        let expected = Setting::encode(1, &NipValue::Numeric(2)).unwrap();
        assert!(expected.same_value(&expected));
        let mut actual = expected.clone();
        actual.current[0] = 3;
        assert!(!expected.same_value(&actual));
        actual.current[0] = 2;
        actual.kind = 3;
        assert!(!expected.same_value(&actual));
        assert!(Setting::encode(1, &NipValue::Numeric(u64::MAX)).is_err());
    }
    #[test]
    fn exact_unicode_gpu_is_required() {
        let gpu = Setting::encode(550564838, &NipValue::Text { kind: "String".into(), value: "NVIDIA GeForce GTX 1650 SUPER".into() }).unwrap();
        let auto = Setting::encode(550564838, &NipValue::Text { kind: "String".into(), value: "autoselect".into() }).unwrap();
        assert_eq!(gpu.kind, 3);
        assert!(gpu.same_value(&gpu));
        assert!(!gpu.same_value(&auto));
    }
}
