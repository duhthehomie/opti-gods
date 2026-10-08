// Miscellaneous utility commands for the Opti Gods desktop shell.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

#[path = "nvidia_display.rs"]
mod nvidia_display;

const MSI_UTILITY_SHA256: &str = "695800afad96f858a3f291b7df21c16649528f13d39b63fb7c233e5676c8df6f";
const PROFILE_INSPECTOR_SHA256: &str = "1ebd8129b3c564bf226291fb3344819fd59668066f0c5e03334a69a04a62859e";
const PROFILE_REFERENCE_SHA256: &str = "0ea7b055aee5c543047243d2dd7abdd1b8c6d96f5d2b7bb5fe17be8130e005ef";
const PROFILE_CONFIG_SHA256: &str = "051099983b896673909e01a1f631b6652abb88da95c9f06f3efef4be033091fa";
const PROFILE_PRESET_SHA256: &str = "6b4992926dc2ee0182816ba758ce52a836b55f38857dbe04cc3afc61da480cbc";
const BASE_PROD: &str = "https://optigods.com";
const MSI_TWEAK_ID: &str = "OpenMsiUtilityPro";
const PRESET_TWEAK_ID: &str = "ImportNvidiaPresetPro";
static NVIDIA_PRESET_IMPORT_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
pub struct ProToolArgs {
    pub ticket: String,
    pub native_auth: String,
}

#[derive(Deserialize)]
pub struct ScriptTweakArgs {
    pub id: String,
    pub native_auth: Option<String>,
    pub pro_session: Option<String>,
    pub device_id: Option<String>,
}

fn verify_sha256(path: &std::path::Path, expected: &str) -> Result<(), String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Read bundled tool failed: {e}"))?;
    let digest = format!("{:x}", Sha256::digest(&bytes));
    if digest != expected {
        return Err(format!("Bundled tool hash mismatch; expected {expected}, got {digest}."));
    }
    Ok(())
}

fn verify_nvidia_bundle(dir: &std::path::Path) -> Result<(), String> {
    verify_sha256(&dir.join("nvidiaProfileInspector.exe"), PROFILE_INSPECTOR_SHA256)?;
    verify_sha256(&dir.join("nvidiaProfileInspector.exe.config"), PROFILE_CONFIG_SHA256)?;
    verify_sha256(&dir.join("Reference.xml"), PROFILE_REFERENCE_SHA256)?;
    verify_sha256(&dir.join("OptiGods-Global-utf8.nip"), PROFILE_PRESET_SHA256)?;
    Ok(())
}



fn nip_tag_value<'a>(section: &'a str, tag: &str) -> Option<&'a str> {
    let opening = format!("<{tag}>");
    let closing = format!("</{tag}>");
    let start = section.find(&opening)? + opening.len();
    let relative_end = section[start..].find(&closing)?;
    Some(section[start..start + relative_end].trim())
}

fn nip_numeric_value(raw: &str) -> Result<u64, String> {
    let value = raw.trim();
    if let Some(hex) = value.strip_prefix("0x").or_else(|| value.strip_prefix("0X")) {
        u64::from_str_radix(hex, 16).map_err(|error| format!("invalid NVIDIA profile value {value}: {error}"))
    } else {
        value.parse::<u64>().map_err(|error| format!("invalid NVIDIA profile value {value}: {error}"))
    }
}

#[derive(Debug, PartialEq, Eq)]
enum NipValue {
    Numeric(u64),
    Text { kind: String, value: String },
}

impl std::fmt::Display for NipValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Numeric(value) => write!(f, "{value}"),
            Self::Text { kind, value } => write!(f, "{kind}({value})"),
        }
    }
}

fn xml_escape(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
        .replace('"', "&quot;").replace('\'', "&apos;")
}

fn xml_unescape(value: &str) -> String {
    value.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
        .replace("&apos;", "'").replace("&amp;", "&")
}

fn preset_with_explicit_gpu(xml: &str, value: &str) -> Result<String, String> {
    if parse_global_nip_settings(xml)?.len() != 14 || value.trim().is_empty()
        || value.eq_ignore_ascii_case("autoselect") {
        return Err("Explicit NVIDIA GPU selection was not resolved; no settings were changed.".into());
    }
    let setting = format!(
        "<ProfileSetting><SettingNameInfo>OpenGL rendering GPU</SettingNameInfo><SettingID>550564838</SettingID><SettingValue>{}</SettingValue><ValueType>String</ValueType></ProfileSetting></Settings>",
        xml_escape(value),
    );
    let expanded = xml.replacen("</Settings>", &setting, 1);
    if parse_global_nip_settings(&expanded)?.len() != 15 {
        return Err("The complete NVIDIA preset must contain 15 settings.".into());
    }
    Ok(expanded)
}

fn parse_global_nip_settings(xml: &str) -> Result<std::collections::HashMap<u32, NipValue>, String> {
    for profile_chunk in xml.split("<Profile>").skip(1) {
        let profile = profile_chunk.split("</Profile>").next().unwrap_or(profile_chunk);
        if nip_tag_value(profile, "ProfileName") != Some("_GLOBAL_DRIVER_PROFILE") {
            continue;
        }
        let mut settings = std::collections::HashMap::new();
        for setting_chunk in profile.split("<ProfileSetting>").skip(1) {
            let setting = setting_chunk.split("</ProfileSetting>").next().unwrap_or(setting_chunk);
            let (Some(id_text), Some(value_text)) = (nip_tag_value(setting, "SettingID"), nip_tag_value(setting, "SettingValue")) else {
                continue;
            };
            let id = id_text.parse::<u32>().map_err(|error| format!("invalid NVIDIA setting ID {id_text}: {error}"))?;
            let kind = nip_tag_value(setting, "ValueType").unwrap_or("Dword");
            let value = if matches!(kind, "String" | "AnsiString" | "Binary") {
                NipValue::Text { kind: kind.into(), value: xml_unescape(value_text) }
            } else {
                NipValue::Numeric(nip_numeric_value(value_text)?)
            };
            if settings.insert(id, value).is_some() {
                return Err(format!("NVIDIA export contains duplicate global setting ID {id}."));
            }
        }
        return Ok(settings);
    }
    Err("NVIDIA export did not contain the global driver profile.".into())
}

fn global_profile_backup_xml(xml: &str) -> Option<String> {
    for chunk in xml.split("<Profile>").skip(1) {
        let profile = chunk.split("</Profile>").next()?;
        if nip_tag_value(profile, "ProfileName") == Some("_GLOBAL_DRIVER_PROFILE") {
            return Some(format!("<?xml version=\"1.0\" encoding=\"utf-8\"?><ArrayOfProfile><Profile>{profile}</Profile></ArrayOfProfile>"));
        }
    }
    None
}

fn verify_global_nip_settings(expected_xml: &str, exported_xml: &str) -> Result<usize, String> {
    let expected = parse_global_nip_settings(expected_xml)?;
    let exported = parse_global_nip_settings(exported_xml)?;
    let mut ids: Vec<u32> = expected.keys().copied().collect();
    ids.sort_unstable();
    let mut mismatches = Vec::new();
    for id in ids {
        let expected_value = &expected[&id];
        match exported.get(&id) {
            Some(actual_value) if actual_value == expected_value => {}
            Some(actual_value) => mismatches.push(format!("{id} was {actual_value}, expected {expected_value}")),
            None => mismatches.push(format!("{id} was missing")),
        }
    }
    let mut unexpected_ids: Vec<u32> = exported.keys().copied().filter(|id| !expected.contains_key(id)).collect();
    unexpected_ids.sort_unstable();
    if !unexpected_ids.is_empty() {
        mismatches.push(format!("unexpected customized global setting IDs: {}", unexpected_ids.iter().take(8).map(u32::to_string).collect::<Vec<_>>().join(", ")));
    }
    if !mismatches.is_empty() {
        return Err(format!("global-profile readback mismatch: {}", mismatches.into_iter().take(4).collect::<Vec<_>>().join("; ")));
    }
    Ok(expected.len())
}

#[cfg(test)]
mod nvidia_profile_readback_tests {
    use super::{global_profile_backup_xml, verify_global_nip_settings, preset_with_explicit_gpu, parse_global_nip_settings, NipValue};

    const EXPECTED: &str = r#"<ArrayOfProfile><Profile><ProfileName>_GLOBAL_DRIVER_PROFILE</ProfileName><Settings><ProfileSetting><SettingID>1</SettingID><SettingValue>10</SettingValue></ProfileSetting><ProfileSetting><SettingID>2</SettingID><SettingValue>0</SettingValue></ProfileSetting></Settings></Profile></ArrayOfProfile>"#;

    #[test]
    fn compares_values_from_global_profile_and_normalizes_hex() {
        let exported = r#"<ArrayOfProfile><Profile><ProfileName>_GLOBAL_DRIVER_PROFILE</ProfileName><Settings><ProfileSetting><SettingID>1</SettingID><SettingValue>0xA</SettingValue></ProfileSetting><ProfileSetting><SettingID>2</SettingID><SettingValue>0</SettingValue></ProfileSetting></Settings></Profile><Profile><ProfileName>GameProfile</ProfileName><Settings><ProfileSetting><SettingID>1</SettingID><SettingValue>99</SettingValue></ProfileSetting></Settings></Profile></ArrayOfProfile>"#;
        assert_eq!(verify_global_nip_settings(EXPECTED, exported).unwrap(), 2);
    }

    #[test]
    fn rejects_unlisted_global_customizations_after_driver_default_reset() {
        let exported = r#"<ArrayOfProfile><Profile><ProfileName>_GLOBAL_DRIVER_PROFILE</ProfileName><Settings><ProfileSetting><SettingID>1</SettingID><SettingValue>10</SettingValue></ProfileSetting><ProfileSetting><SettingID>2</SettingID><SettingValue>0</SettingValue></ProfileSetting><ProfileSetting><SettingID>3</SettingID><SettingValue>99</SettingValue></ProfileSetting></Settings></Profile></ArrayOfProfile>"#;
        assert!(verify_global_nip_settings(EXPECTED, exported).unwrap_err().contains("unexpected customized global setting IDs: 3"));
    }

    #[test]
    fn rejects_values_that_did_not_persist() {
        let exported = r#"<ArrayOfProfile><Profile><ProfileName>_GLOBAL_DRIVER_PROFILE</ProfileName><Settings><ProfileSetting><SettingID>1</SettingID><SettingValue>10</SettingValue></ProfileSetting><ProfileSetting><SettingID>2</SettingID><SettingValue>1</SettingValue></ProfileSetting></Settings></Profile></ArrayOfProfile>"#;
        assert!(verify_global_nip_settings(EXPECTED, exported).unwrap_err().contains("2 was 1, expected 0"));
    }

    #[test]
    fn rollback_snapshot_excludes_application_profiles() {
        let source = format!("{EXPECTED}<Profile><ProfileName>GameProfile</ProfileName></Profile>");
        let backup = global_profile_backup_xml(&source).unwrap();
        assert!(!backup.contains("GameProfile"));
        assert_eq!(verify_global_nip_settings(EXPECTED, &backup).unwrap(), 2);
    }

    #[test]
    fn complete_preset_includes_refresh_fixed_refresh_and_explicit_gpu() {
        let static_xml = include_str!("../../resources/nvidia-profile-inspector/OptiGods-Global-utf8.nip");
        let complete = preset_with_explicit_gpu(static_xml, "driver-GPU<&>value").unwrap();
        let settings = parse_global_nip_settings(&complete).unwrap();
        assert_eq!(settings.len(), 15);
        assert_eq!(settings[&0x0064b541], NipValue::Numeric(1));
        assert_eq!(settings[&0x10a879cf], NipValue::Numeric(4));
        assert_eq!(settings[&0x20d0f3e6], NipValue::Text { kind: "String".into(), value: "driver-GPU<&>value".into() });
        assert_eq!(verify_global_nip_settings(&complete, &complete).unwrap(), 15);
        assert!(preset_with_explicit_gpu(static_xml, "autoselect").is_err());
    }

    #[test]
    fn verifies_gpu_string_and_rejects_different_affinity() {
        let expected = "<Profile><ProfileName>_GLOBAL_DRIVER_PROFILE</ProfileName><Settings><ProfileSetting><SettingID>550564838</SettingID><SettingValue>driver-GPU-A</SettingValue><ValueType>String</ValueType></ProfileSetting></Settings></Profile>";
        assert_eq!(verify_global_nip_settings(expected, expected).unwrap(), 1);
        assert!(verify_global_nip_settings(expected, &expected.replace("driver-GPU-A", "autoselect")).is_err());
    }
}

#[cfg(windows)]
async fn export_customized_nvidia_profile(inspector_dir: &std::path::Path) -> Result<String, String> {
    export_customized_nvidia_profile_with_cancel(inspector_dir, true).await
}

#[cfg(windows)]
async fn export_customized_nvidia_profile_with_cancel(inspector_dir: &std::path::Path, allow_cancel: bool) -> Result<String, String> {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let scratch = std::env::temp_dir().join(format!("OptiGods-Nvidia-Readback-{}-{nonce}", std::process::id()));
    std::fs::create_dir(&scratch).map_err(|error| format!("Could not create NVIDIA readback workspace: {error}"))?;
    let result = async {
        for name in ["nvidiaProfileInspector.exe", "nvidiaProfileInspector.exe.config", "Reference.xml"] {
            std::fs::copy(inspector_dir.join(name), scratch.join(name))
                .map_err(|error| format!("Could not stage NVIDIA Profile Inspector for readback: {error}"))?;
        }
        let executable = scratch.join("nvidiaProfileInspector.exe");
        let mut child = tokio::process::Command::new(&executable)
            .arg("-exportCustomized")
            .current_dir(&scratch)
            .kill_on_drop(true)
            .spawn()
            .map_err(|error| format!("Could not start NVIDIA profile readback: {error}"))?;
        let started = std::time::Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => {}
                Err(error) => {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(format!("Could not check NVIDIA profile readback: {error}"));
                }
            }
            if allow_cancel && NVIDIA_PRESET_IMPORT_CANCELLED.load(Ordering::SeqCst) {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("NVIDIA profile readback was cancelled.".into());
            }
            if started.elapsed() >= std::time::Duration::from_secs(20) {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("NVIDIA Profile Inspector did not export the customized profile within 20 seconds.".into());
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        };
        if !status.success() {
            return Err(format!("NVIDIA Profile Inspector export exited with {status}."));
        }
        let mut candidates = Vec::new();
        let entries = std::fs::read_dir(&scratch).map_err(|error| format!("Could not read NVIDIA export workspace: {error}"))?;
        for entry in entries {
            let entry = entry.map_err(|error| format!("Could not inspect NVIDIA export workspace: {error}"))?;
            let path = entry.path();
            if path.extension().and_then(std::ffi::OsStr::to_str).is_some_and(|extension| extension.eq_ignore_ascii_case("nip")) {
                candidates.push(path);
            }
        }
        candidates.sort_by_key(|path| std::fs::metadata(path).and_then(|metadata| metadata.modified()).ok());
        let exported = candidates.pop().ok_or_else(|| "NVIDIA Profile Inspector exited successfully but wrote no customized .nip export.".to_string())?;
        std::fs::read_to_string(exported).map_err(|error| format!("Could not read NVIDIA customized-profile export: {error}"))
    }.await;
    let _ = std::fs::remove_dir_all(&scratch);
    result
}

#[cfg(windows)]
async fn restore_nvidia_global_profile_backup(inspector_dir: &std::path::Path, backup_xml: &str) -> Result<(), String> {
    reset_global_nvidia_profile_to_driver_defaults()?;
    let Some(global_backup) = global_profile_backup_xml(backup_xml) else {
        let exported = export_customized_nvidia_profile_with_cancel(inspector_dir, false).await?;
        if let Some(global) = global_profile_backup_xml(&exported) {
            if !parse_global_nip_settings(&global)?.is_empty() {
                return Err("Global NVIDIA rollback left unexpected customized settings.".into());
            }
        }
        return Ok(());
    };
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let backup_path = std::env::temp_dir().join(format!("OptiGods-Nvidia-Rollback-{}-{nonce}.nip", std::process::id()));
    std::fs::write(&backup_path, &global_backup).map_err(|error| format!("Could not stage the saved NVIDIA profile for rollback: {error}"))?;
    let result = async {
        let executable = inspector_dir.join("nvidiaProfileInspector.exe");
        let mut child = tokio::process::Command::new(&executable)
            .arg("-silentImport")
            .arg(&backup_path)
            .current_dir(inspector_dir)
            .kill_on_drop(true)
            .spawn()
            .map_err(|error| format!("Could not start NVIDIA profile rollback: {error}"))?;
        let started = std::time::Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => {}
                Err(error) => {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    return Err(format!("Could not check NVIDIA profile rollback: {error}"));
                }
            }
            if started.elapsed() >= std::time::Duration::from_secs(60) {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err("NVIDIA profile rollback exceeded 60 seconds.".into());
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        };
        if !status.success() { return Err(format!("NVIDIA profile rollback import exited with {status}.")); }
        let exported = export_customized_nvidia_profile_with_cancel(inspector_dir, false).await?;
        verify_global_nip_settings(&global_backup, &exported)?;
        Ok(())
    }.await;
    let _ = std::fs::remove_file(&backup_path);
    result
}

fn dvc_level_for_percent(min_level: u32, max_level: u32, percent: u32) -> Result<u32, String> {
    if min_level > max_level || percent > 100 || min_level == max_level {
        return Err("NVIDIA display reported an invalid Digital Vibrance range.".into());
    }
    let span = u64::from(max_level - min_level);
    let offset = (span * u64::from(percent) + 50) / 100;
    Ok((u64::from(min_level) + offset) as u32)
}

#[cfg(test)]
mod digital_vibrance_tests {
    use super::dvc_level_for_percent;

    #[test]
    fn maps_85_percent_to_the_reported_driver_range() {
        assert_eq!(dvc_level_for_percent(0, 100, 85).unwrap(), 85);
        assert_eq!(dvc_level_for_percent(0, 60, 85).unwrap(), 51);
        assert_eq!(dvc_level_for_percent(0, 63, 85).unwrap(), 54);
        assert_eq!(dvc_level_for_percent(10, 110, 85).unwrap(), 95);
    }

    #[test]
    fn rejects_invalid_driver_ranges() {
        assert!(dvc_level_for_percent(10, 10, 85).is_err());
        assert!(dvc_level_for_percent(20, 10, 85).is_err());
        assert!(dvc_level_for_percent(0, 100, 101).is_err());
    }
}

#[cfg(windows)]
type NvApiQueryInterfaceFn = unsafe extern "C" fn(u32) -> *mut std::ffi::c_void;
#[cfg(windows)]
type NvApiStatusFn = unsafe extern "C" fn() -> i32;
#[cfg(windows)]
type NvApiEnumDisplayHandleFn = unsafe extern "C" fn(u32, *mut *mut std::ffi::c_void) -> i32;
#[cfg(windows)]
type NvApiGetDvcInfoFn = unsafe extern "C" fn(*mut std::ffi::c_void, u32, *mut NvDisplayDvcInfo) -> i32;
#[cfg(windows)]
type NvApiSetDvcLevelFn = unsafe extern "C" fn(*mut std::ffi::c_void, u32, u32) -> i32;
#[cfg(windows)]
type NvApiDrsCreateSessionFn = unsafe extern "C" fn(*mut *mut std::ffi::c_void) -> i32;
#[cfg(windows)]
type NvApiDrsSessionFn = unsafe extern "C" fn(*mut std::ffi::c_void) -> i32;
#[cfg(windows)]
type NvApiDrsGetBaseProfileFn = unsafe extern "C" fn(*mut std::ffi::c_void, *mut *mut std::ffi::c_void) -> i32;
#[cfg(windows)]
type NvApiDrsProfileFn = unsafe extern "C" fn(*mut std::ffi::c_void, *mut std::ffi::c_void) -> i32;

#[cfg(windows)]
#[repr(C)]
struct NvDisplayDvcInfo {
    version: u32,
    current_level: u32,
    min_level: u32,
    max_level: u32,
}

#[cfg(windows)]
struct NvApiLibrary {
    module: *mut std::ffi::c_void,
    query: NvApiQueryInterfaceFn,
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn LoadLibraryExW(name: *const u16, file: *mut std::ffi::c_void, flags: u32) -> *mut std::ffi::c_void;
    fn GetProcAddress(module: *mut std::ffi::c_void, name: *const u8) -> *mut std::ffi::c_void;
    fn FreeLibrary(module: *mut std::ffi::c_void) -> i32;
}

#[cfg(windows)]
impl NvApiLibrary {
    fn load() -> Result<Self, String> {
        let dll_name = if cfg!(target_pointer_width = "64") { "nvapi64.dll" } else { "nvapi.dll" };
        let wide_name: Vec<u16> = dll_name.encode_utf16().chain(std::iter::once(0)).collect();
        let module = unsafe { LoadLibraryExW(wide_name.as_ptr(), std::ptr::null_mut(), 0x0000_0800) };
        if module.is_null() {
            return Err("NVIDIA driver API is unavailable. Verify that the NVIDIA display driver is installed.".into());
        }
        let export = unsafe { GetProcAddress(module, b"nvapi_QueryInterface\0".as_ptr()) };
        if export.is_null() {
            unsafe { FreeLibrary(module); }
            return Err("NVIDIA driver API is missing nvapi_QueryInterface.".into());
        }
        let query: NvApiQueryInterfaceFn = unsafe { std::mem::transmute(export) };
        let initialize_ptr = unsafe { query(0x0150_E828) };
        if initialize_ptr.is_null() {
            unsafe { FreeLibrary(module); }
            return Err("NVIDIA driver API initialization entry point is unavailable.".into());
        }
        let initialize: NvApiStatusFn = unsafe { std::mem::transmute(initialize_ptr) };
        let status = unsafe { initialize() };
        if status != 0 {
            unsafe { FreeLibrary(module); }
            return Err(format!("NVIDIA driver API initialization failed (status {status})."));
        }
        Ok(Self { module, query })
    }

    fn resolve(&self, id: u32, name: &str) -> Result<*mut std::ffi::c_void, String> {
        let function = unsafe { (self.query)(id) };
        if function.is_null() {
            return Err(format!("NVIDIA driver API function {name} is unavailable."));
        }
        Ok(function)
    }
}

#[cfg(windows)]
impl Drop for NvApiLibrary {
    fn drop(&mut self) {
        unsafe {
            let unload_ptr = (self.query)(0xD22B_DD7E);
            if !unload_ptr.is_null() {
                let unload: NvApiStatusFn = std::mem::transmute(unload_ptr);
                let _ = unload();
            }
            if !self.module.is_null() {
                let _ = FreeLibrary(self.module);
            }
        }
    }
}

#[cfg(windows)]
fn reset_global_nvidia_profile_to_driver_defaults() -> Result<(), String> {
    let api = NvApiLibrary::load()?;
    let create_ptr = api.resolve(0x0694_D52E, "DRS session creation")?;
    let destroy_ptr = api.resolve(0xDAD9_CFF8, "DRS session cleanup")?;
    let load_ptr = api.resolve(0x375D_BD6B, "DRS settings load")?;
    let get_base_ptr = api.resolve(0xDA84_66A0, "global NVIDIA profile lookup")?;
    let restore_ptr = api.resolve(0xFA5F_6134, "global NVIDIA profile reset")?;
    let save_ptr = api.resolve(0xFCBC_7E14, "DRS settings save")?;
    let create_session: NvApiDrsCreateSessionFn = unsafe { std::mem::transmute(create_ptr) };
    let destroy_session: NvApiDrsSessionFn = unsafe { std::mem::transmute(destroy_ptr) };
    let load_settings: NvApiDrsSessionFn = unsafe { std::mem::transmute(load_ptr) };
    let get_base_profile: NvApiDrsGetBaseProfileFn = unsafe { std::mem::transmute(get_base_ptr) };
    let restore_profile: NvApiDrsProfileFn = unsafe { std::mem::transmute(restore_ptr) };
    let save_settings: NvApiDrsSessionFn = unsafe { std::mem::transmute(save_ptr) };

    let mut session = std::ptr::null_mut();
    let create_status = unsafe { create_session(&mut session) };
    if create_status != 0 || session.is_null() {
        if !session.is_null() { let _ = unsafe { destroy_session(session) }; }
        return Err(format!("Could not create an NVIDIA DRS session (NVAPI status {create_status})."));
    }
    let result = (|| {
        let load_status = unsafe { load_settings(session) };
        if load_status != 0 { return Err(format!("Could not load NVIDIA driver profiles (NVAPI status {load_status}).")); }
        let mut profile = std::ptr::null_mut();
        let profile_status = unsafe { get_base_profile(session, &mut profile) };
        if profile_status != 0 || profile.is_null() {
            return Err(format!("Could not locate the NVIDIA global driver profile (NVAPI status {profile_status})."));
        }
        let reset_status = unsafe { restore_profile(session, profile) };
        if reset_status != 0 { return Err(format!("Could not reset unlisted NVIDIA global settings to driver defaults (NVAPI status {reset_status}).")); }
        let save_status = unsafe { save_settings(session) };
        if save_status != 0 { return Err(format!("Could not save NVIDIA global driver defaults (NVAPI status {save_status}).")); }
        Ok(())
    })();
    let destroy_status = unsafe { destroy_session(session) };
    match result {
        Err(error) => Err(error),
        Ok(()) if destroy_status == 0 => Ok(()),
        Ok(()) => Err(format!("NVIDIA DRS session cleanup failed (NVAPI status {destroy_status}).")),
    }
}

#[cfg(windows)]
#[derive(Clone)]
struct NvidiaDvcPreviousValue {
    display_index: u32,
    display_id: u32,
    output_id: u32,
    level: u32,
}

#[cfg(windows)]
struct NvidiaDvcApplySummary {
    supported_display_count: usize,
    unsupported_display_count: usize,
    previous_values: Vec<NvidiaDvcPreviousValue>,
    verified_levels: Vec<(u32, u32, u32, u32)>,
}

#[cfg(windows)]
struct NvidiaDvcDisplay {
    display_index: u32,
    display_id: u32,
    output_id: u32,
    handle: *mut std::ffi::c_void,
    current_level: u32,
    target_level: u32,
}

#[cfg(windows)]
const NVAPI_END_ENUMERATION: i32 = -7;
#[cfg(windows)]
const NVAPI_NOT_SUPPORTED: i32 = -104;

#[cfg(windows)]
fn dvc_info_version() -> u32 {
    (std::mem::size_of::<NvDisplayDvcInfo>() as u32) | (1 << 16)
}

#[cfg(windows)]
fn rollback_dvc_with_handles(
    set_dvc: NvApiSetDvcLevelFn,
    get_dvc: NvApiGetDvcInfoFn,
    changes: &[(u32, *mut std::ffi::c_void, u32, u32)],
) -> Vec<String> {
    let mut failures = Vec::new();
    for (display_index, handle, output_id, previous_level) in changes.iter().rev() {
        let set_status = unsafe { set_dvc(*handle, *output_id, *previous_level) };
        if set_status != 0 {
            failures.push(format!("display {} set status {}", display_index + 1, set_status));
            continue;
        }
        let mut info = NvDisplayDvcInfo { version: dvc_info_version(), current_level: 0, min_level: 0, max_level: 0 };
        let get_status = unsafe { get_dvc(*handle, *output_id, &mut info) };
        if get_status != 0 || info.current_level != *previous_level {
            failures.push(format!("display {} readback status {}", display_index + 1, get_status));
        }
    }
    failures
}

#[cfg(windows)]
fn set_nvidia_digital_vibrance_85(expected_display_ids: &[u32]) -> Result<NvidiaDvcApplySummary, String> {
    let api = NvApiLibrary::load()?;
    let get_ptr = api.resolve(0x4085_DE45, "Digital Vibrance read")?;
    let set_ptr = api.resolve(0x1724_09B4, "Digital Vibrance write")?;
    let get_dvc: NvApiGetDvcInfoFn = unsafe { std::mem::transmute(get_ptr) };
    let set_dvc: NvApiSetDvcLevelFn = unsafe { std::mem::transmute(set_ptr) };

    let mut displays = Vec::new();
    let targets = nvidia_display::runtime::active_targets(&api)?;
    let actual_ids: std::collections::HashSet<u32> = targets.iter().map(|t| t.display_id).collect();
    let expected_ids: std::collections::HashSet<u32> = expected_display_ids.iter().copied().collect();
    if actual_ids != expected_ids { return Err("Active NVIDIA monitors changed during preset preparation. No display was changed; retry after the display topology is stable.".into()); }
    for (index, target) in targets.iter().enumerate() {
        let display_index = index as u32;
        let handle = target.handle as *mut std::ffi::c_void;
        let output_id = target.output_id;
        let mut info = NvDisplayDvcInfo { version: dvc_info_version(), current_level: 0, min_level: 0, max_level: 0 };
        let get_status = unsafe { get_dvc(handle, output_id, &mut info) };
        if get_status == NVAPI_NOT_SUPPORTED {
            return Err(format!("Active NVIDIA monitor {} does not support Digital Vibrance control. No monitors were changed; success requires every active NVIDIA monitor.", target.display_id));
        }
        if get_status != 0 {
            return Err(format!("Could not read Digital Vibrance on NVIDIA display {} (NVAPI status {get_status}). No display was changed.", display_index + 1));
        }
        let target_level = dvc_level_for_percent(info.min_level, info.max_level, 85)?;
        if info.current_level < info.min_level || info.current_level > info.max_level {
            return Err(format!("NVIDIA display {} returned an out-of-range Digital Vibrance value. No display was changed.", display_index + 1));
        }
        displays.push(NvidiaDvcDisplay { display_index, display_id: target.display_id, output_id, handle, current_level: info.current_level, target_level });
    }
    if displays.is_empty() {
        return Err("No active NVIDIA display supports Digital Vibrance control. No NVIDIA profile was imported.".into());
    }

    let mut rollback_targets: Vec<(u32, *mut std::ffi::c_void, u32, u32)> = Vec::with_capacity(displays.len());
    let mut verified_levels = Vec::with_capacity(displays.len());
    for display in &displays {
        rollback_targets.push((display.display_index, display.handle, display.output_id, display.current_level));
        if display.current_level != display.target_level {
            let set_status = unsafe { set_dvc(display.handle, display.output_id, display.target_level) };
            if set_status != 0 {
                let rollback = rollback_dvc_with_handles(set_dvc, get_dvc, &rollback_targets);
                let suffix = if rollback.is_empty() { " Previous values were restored.".to_string() } else { format!(" Rollback was incomplete: {}.", rollback.join(", ")) };
                return Err(format!("Could not set Digital Vibrance to 85% on NVIDIA display {} (NVAPI status {set_status}).{suffix}", display.display_index + 1));
            }
        }
        let mut verify = NvDisplayDvcInfo { version: dvc_info_version(), current_level: 0, min_level: 0, max_level: 0 };
        let verify_status = unsafe { get_dvc(display.handle, display.output_id, &mut verify) };
        let verified_target = dvc_level_for_percent(verify.min_level, verify.max_level, 85).ok();
        if verify_status != 0 || verify.current_level != display.target_level || verified_target != Some(display.target_level) {
            let rollback = rollback_dvc_with_handles(set_dvc, get_dvc, &rollback_targets);
            let suffix = if rollback.is_empty() { " Previous values were restored.".to_string() } else { format!(" Rollback was incomplete: {}.", rollback.join(", ")) };
            return Err(format!("Digital Vibrance 85% readback failed on NVIDIA display {} (reported level {} in range {}-{}, NVAPI status {verify_status}).{suffix}", display.display_index + 1, verify.current_level, verify.min_level, verify.max_level));
        }
        verified_levels.push((display.display_index, verify.current_level, verify.min_level, verify.max_level));
    }

    Ok(NvidiaDvcApplySummary {
        supported_display_count: displays.len(),
        unsupported_display_count: 0,
        previous_values: displays.iter().map(|display| NvidiaDvcPreviousValue { display_index: display.display_index, display_id: display.display_id, output_id: display.output_id, level: display.current_level }).collect(),
        verified_levels,
    })
}

#[cfg(windows)]
fn restore_nvidia_digital_vibrance(previous_values: &[NvidiaDvcPreviousValue]) -> Result<(), String> {
    let api = NvApiLibrary::load()?;
    let get_ptr = api.resolve(0x4085_DE45, "Digital Vibrance read")?;
    let set_ptr = api.resolve(0x1724_09B4, "Digital Vibrance restore")?;
    let get_dvc: NvApiGetDvcInfoFn = unsafe { std::mem::transmute(get_ptr) };
    let set_dvc: NvApiSetDvcLevelFn = unsafe { std::mem::transmute(set_ptr) };
    let mut failures = Vec::new();

    let targets = nvidia_display::runtime::active_targets(&api)?;
    for previous in previous_values {
        let Some(target) = targets.iter().find(|t| t.display_id == previous.display_id && t.output_id == previous.output_id) else {
            failures.push(format!("display {} could not be found", previous.display_index + 1));
            continue;
        };
        let handle = target.handle as *mut std::ffi::c_void;
        let set_status = unsafe { set_dvc(handle, previous.output_id, previous.level) };
        let mut verify = NvDisplayDvcInfo { version: dvc_info_version(), current_level: 0, min_level: 0, max_level: 0 };
        let get_status = unsafe { get_dvc(handle, previous.output_id, &mut verify) };
        if set_status != 0 || get_status != 0 || verify.current_level != previous.level {
            failures.push(format!("display {} restore status {set_status}, readback status {get_status}", previous.display_index + 1));
        }
    }
    if failures.is_empty() { Ok(()) } else { Err(failures.join(", ")) }
}

async fn consume_pro_ticket(args: &ProToolArgs, id: &str) -> Result<(String, String), String> {
    let base = if cfg!(debug_assertions) { "http://127.0.0.1:5000" } else { BASE_PROD };
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Authorization client failed: {e}"))?;
    let mut request = client.post(format!("{base}/api/performance-allowance/native-ticket/consume"));
    request = if let Some(device_id) = args.native_auth.strip_prefix("device:") {
        request.header("X-Device-ID", device_id)
    } else if let Some(pro_session) = args.native_auth.strip_prefix("pro:") {
        request.header("X-Pro-Session", pro_session)
    } else {
        request.header("X-Native-Auth", &args.native_auth)
    };
    let response = request
        .json(&serde_json::json!({ "ticket": args.ticket, "tweakId": id }))
        .send()
        .await
        .map_err(|_| "Pro authorization ticket could not be verified.".to_string())?;
    if !response.status().is_success() {
        let detail = response.text().await.unwrap_or_default();
        return Err(serde_json::from_str::<serde_json::Value>(&detail)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_owned))
            .unwrap_or_else(|| "Pro authorization ticket was rejected or expired.".to_string()));
    }
    let body: serde_json::Value = response.json().await.map_err(|_| "Invalid authorization response.".to_string())?;
    let secret = body.get("resultSecret").and_then(|v| v.as_str()).ok_or_else(|| "Authorization response omitted result secret.".to_string())?;
    Ok((base.to_string(), secret.to_string()))
}

async fn finalize_pro_ticket(base: &str, args: &ProToolArgs, secret: &str, id: &str, success: bool, message: &str) {
    let client = reqwest::Client::new();
    let mut request = client.post(format!("{base}/api/performance-allowance/native-ticket/result"));
    request = if let Some(device_id) = args.native_auth.strip_prefix("device:") {
        request.header("X-Device-ID", device_id)
    } else if let Some(pro_session) = args.native_auth.strip_prefix("pro:") {
        request.header("X-Pro-Session", pro_session)
    } else {
        request.header("X-Native-Auth", &args.native_auth)
    };
    let _ = request
        .json(&serde_json::json!({
            "ticket": args.ticket,
            "resultSecret": secret,
            "success": success,
            "tweakId": id,
            "message": message,
        }))
        .send()
        .await;
}

#[tauri::command]
pub async fn open_msi_utility(app: tauri::AppHandle, args: ProToolArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        let (base, secret) = consume_pro_ticket(&args, MSI_TWEAK_ID).await?;
        let result = (|| {
            let path = app.path().resource_dir().map_err(|e| format!("Resource directory unavailable: {e}"))?
                .join("resources").join("msi-utility").join("MSI_util_v3.exe");
            verify_sha256(&path, MSI_UTILITY_SHA256)?;
            std::process::Command::new(&path).spawn().map_err(|e| format!("Could not launch MSI Utility v3: {e}"))?;
            Ok::<String, String>("MSI Utility v3 launched. Select only the active NVIDIA display adapter, check MSI, choose High, then press Apply. Windows resets this after a driver update.".into())
        })();
        match &result {
            Ok(message) => finalize_pro_ticket(&base, &args, &secret, MSI_TWEAK_ID, true, message).await,
            Err(error) => finalize_pro_ticket(&base, &args, &secret, MSI_TWEAK_ID, false, error).await,
        }
        result
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("MSI Utility v3 is available only in the Windows Pro app.".into())
    }
}

#[tauri::command]
pub fn reset_nvidia_preset_import_cancel() {
    NVIDIA_PRESET_IMPORT_CANCELLED.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn cancel_nvidia_preset_import() {
    NVIDIA_PRESET_IMPORT_CANCELLED.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn import_nvidia_preset(app: tauri::AppHandle, args: ProToolArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        let (base, secret) = consume_pro_ticket(&args, PRESET_TWEAK_ID).await?;
        let mut result = async {
            crate::commands::restore::require_verified_checkpoint()?;
            let dir = app.path().resource_dir().map_err(|e| format!("Resource directory unavailable: {e}"))?;
            let inspector_dir = dir.join("resources").join("nvidia-profile-inspector");
            let inspector = inspector_dir.join("nvidiaProfileInspector.exe");
            let preset = inspector_dir.join("OptiGods-Global-utf8.nip");
            verify_nvidia_bundle(&inspector_dir)?;
            let static_expected = std::fs::read_to_string(&preset)
                .map_err(|error| format!("Could not read the verified NVIDIA preset: {error}"))?;
            let (gpu_name, gpu_value, active_display_ids) = {
                let api = NvApiLibrary::load()?;
                let targets = nvidia_display::runtime::active_targets(&api)?;
                let (name, value) = nvidia_display::runtime::explicit_gpu_value(&api, &targets)?;
                (name, value, targets.iter().map(|t| t.display_id).collect::<Vec<_>>())
            };
            let expected = preset_with_explicit_gpu(&static_expected, &gpu_value)?;
            let runtime_path = inspector_dir.join(format!("OptiGods-runtime-{}.nip", std::process::id()));
            std::fs::write(&runtime_path, &expected).map_err(|error| format!("Could not prepare the complete NVIDIA preset: {error}"))?;
            struct RuntimePreset(std::path::PathBuf);
            impl Drop for RuntimePreset { fn drop(&mut self) { let _ = std::fs::remove_file(&self.0); } }
            let runtime_preset = RuntimePreset(runtime_path);
            let original_profile = export_customized_nvidia_profile(&inspector_dir).await?;
            let dvc = set_nvidia_digital_vibrance_85(&active_display_ids)?;
            let mut reset_attempted = false;
            let profile_result: Result<usize, String> = async {
                reset_attempted = true;
                reset_global_nvidia_profile_to_driver_defaults()?;
                let mut child = tokio::process::Command::new(&inspector)
                    .arg("-silentImport")
                    .arg(&runtime_preset.0)
                    .current_dir(&inspector_dir)
                    .kill_on_drop(true)
                    .spawn()
                    .map_err(|error| format!("Could not launch NVIDIA Profile Inspector: {error}"))?;
                let started = tokio::time::Instant::now();
                let status = loop {
                    match child.try_wait() {
                        Ok(Some(status)) => break status,
                        Ok(None) => {}
                        Err(error) => {
                            let _ = child.kill().await;
                            let _ = child.wait().await;
                            return Err(format!("Could not check NVIDIA Profile Inspector: {error}"));
                        }
                    }
                    if NVIDIA_PRESET_IMPORT_CANCELLED.load(Ordering::SeqCst) {
                        let _ = child.kill().await;
                        let _ = child.wait().await;
                        return Err("NVIDIA preset import was stopped by the user.".into());
                    }
                    if started.elapsed() >= std::time::Duration::from_secs(45) {
                        let _ = child.kill().await;
                        let _ = child.wait().await;
                        return Err("NVIDIA Profile Inspector did not finish within 45 seconds; the import was stopped.".into());
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                };
                if !status.success() {
                    return Err(format!("NVIDIA Profile Inspector exited with {status}."));
                }
                let exported = export_customized_nvidia_profile(&inspector_dir).await?;
                verify_global_nip_settings(&expected, &exported)
            }.await;
            let verified_setting_count = match profile_result {
                Ok(count) if count == 15 => count,
                Ok(count) => {
                    let profile_note = if reset_attempted {
                        match restore_nvidia_global_profile_backup(&inspector_dir, &original_profile).await {
                            Ok(()) => " Original global NVIDIA settings were restored.".to_string(),
                            Err(error) => format!(" WARNING: NVIDIA profile rollback was incomplete: {error}."),
                        }
                    } else { String::new() };
                    let dvc_note = match restore_nvidia_digital_vibrance(&dvc.previous_values) {
                        Ok(()) => " Previous Digital Vibrance values were restored.".to_string(),
                        Err(error) => format!(" WARNING: Digital Vibrance rollback was incomplete: {error}."),
                    };
                    return Err(format!("Expected 12 NVIDIA global settings, but verified {count}; no preset success was recorded.{profile_note}{dvc_note}"));
                }
                Err(error) => {
                    let profile_note = if reset_attempted {
                        match restore_nvidia_global_profile_backup(&inspector_dir, &original_profile).await {
                            Ok(()) => " Original global NVIDIA settings were restored.".to_string(),
                            Err(rollback_error) => format!(" WARNING: NVIDIA profile rollback was incomplete: {rollback_error}."),
                        }
                    } else { String::new() };
                    let dvc_note = match restore_nvidia_digital_vibrance(&dvc.previous_values) {
                        Ok(()) => " Previous Digital Vibrance values were restored.".to_string(),
                        Err(rollback_error) => format!(" WARNING: Digital Vibrance rollback was incomplete: {rollback_error}."),
                    };
                    return Err(format!("{error} No preset success was recorded.{profile_note}{dvc_note}"));
                }
            };
            let unsupported_note = if dvc.unsupported_display_count > 0 {
                format!(" {} NVIDIA display(s) do not support Digital Vibrance and were left unchanged.", dvc.unsupported_display_count)
            } else {
                String::new()
            };
            let dvc_readback = dvc.verified_levels.iter()
                .map(|(index, level, min, max)| format!("display {} raw level {} (range {}-{})", index + 1, level, min, max))
                .collect::<Vec<_>>()
                .join(", ");
            let vibrance_message = nvidia_display::vibrance_success(dvc.supported_display_count);
            Ok::<String, String>(format!(
                "{vibrance_message}. Verified {verified_setting_count}/15 global settings: Highest available refresh rate, Fixed Refresh, and explicit OpenGL GPU {gpu_name}, plus the original 12 settings. Per-monitor readback: [{dvc_readback}].{unsupported_note} Unlisted global settings were reset to NVIDIA defaults. PhysX processor selection is a separate control and was not changed by this profile.",
            ))
        }.await;
        if let Ok(message) = &mut result {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0);
            if timestamp > 0 {
                if let Err(error) = crate::win32::registry::write_qword(
                    crate::win32::registry::Hive::CurrentUser,
                    r"Software\OptiGods\AppliedTweaks",
                    "NvidiaControlPanelSettings",
                    timestamp,
                ) {
                    eprintln!("[applied-history] Could not save NVIDIA preset submission history: {error:#}");
                    message.push_str(" The submission succeeded, but its local history marker could not be saved.");
                }
            }
        }
        match &result {
            Ok(message) => finalize_pro_ticket(&base, &args, &secret, PRESET_TWEAK_ID, true, message).await,
            Err(error) => finalize_pro_ticket(&base, &args, &secret, PRESET_TWEAK_ID, false, error).await,
        }
        result
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("NVIDIA Profile Inspector is available only in the Windows Pro app.".into())
    }
}

#[cfg(windows)]
async fn fetch_trusted_tweak_script(args: &ScriptTweakArgs) -> Result<String, String> {
    if args.id.is_empty()
        || args.id.len() > 64
        || !args.id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    {
        return Err("Invalid script-only tweak ID.".into());
    }
    let base = if cfg!(debug_assertions) { "http://127.0.0.1:5000" } else { BASE_PROD };
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("Trusted script client failed: {error}"))?;
    let mut request = client.post(format!("{base}/api/script/native-tweak"));
    for (name, value) in [
        ("X-Native-Auth", args.native_auth.as_deref()),
        ("X-Pro-Session", args.pro_session.as_deref()),
        ("X-Device-ID", args.device_id.as_deref()),
    ] {
        if let Some(value) = value.filter(|value| !value.is_empty() && value.len() <= 8192) {
            request = request.header(name, value);
        }
    }
    let response = request
        .json(&serde_json::json!({ "id": args.id.as_str() }))
        .send()
        .await
        .map_err(|_| "Opti Gods could not retrieve the trusted PowerShell script.".to_string())?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        let message = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|value| value.get("message").or_else(|| value.get("error"))?.as_str().map(str::to_owned))
            .unwrap_or_else(|| format!("Script request was rejected (HTTP {status})."));
        return Err(message);
    }
    let value: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "The trusted script response was not valid JSON.".to_string())?;
    let script = value.get("script").and_then(|script| script.as_str())
        .ok_or_else(|| "The server did not provide a trusted PowerShell script.".to_string())?;
    if script.len() > 1_000_000
        || !script.contains("__OG_RESULT:APPLIED")
        || !script.contains("__OG_RESULT:SKIPPED")
    {
        return Err("The server returned an incomplete or oversized PowerShell script.".into());
    }
    Ok(script.to_string())
}

#[cfg(windows)]
async fn read_script_output<R>(
    stream: R,
    app: AppHandle,
    id: String,
    channel: &'static str,
) -> Vec<String>
where
    R: tokio::io::AsyncRead + Unpin,
{
    use tokio::io::AsyncBufReadExt;
    let mut reader = tokio::io::BufReader::new(stream);
    let mut bytes = Vec::new();
    let mut lines = Vec::new();
    loop {
        bytes.clear();
        match reader.read_until(b'\n', &mut bytes).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&bytes).trim().to_string();
                if line.is_empty() {
                    continue;
                }
                let visible: String = line.chars().take(400).collect();
                let _ = app.emit(
                    "optigods:script-tweak-progress",
                    serde_json::json!({ "id": id.as_str(), "message": visible, "stream": channel }),
                );
                if lines.len() == 100 {
                    lines.remove(0);
                }
                lines.push(line);
            }
        }
    }
    lines
}

#[tauri::command]
pub async fn run_script_tweak(app: AppHandle, args: ScriptTweakArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::io::Write;
        use std::os::windows::process::CommandExt;
        use std::process::Stdio;
        use tokio::process::Command;

        let script = fetch_trusted_tweak_script(&args).await?;
        crate::commands::restore::require_verified_checkpoint()?;

        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!(
            "OptiGods-Script-{}-{nonce}.ps1",
            std::process::id(),
        ));
        let mut bytes = b"\xEF\xBB\xBF".to_vec();
        bytes.extend_from_slice(script.as_bytes());
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|error| format!("Could not prepare the trusted script: {error}"))?;
        if let Err(error) = file.write_all(&bytes) {
            let _ = std::fs::remove_file(&path);
            return Err(format!("Could not write the trusted script: {error}"));
        }
        drop(file);

        let mut child = match Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
            .arg(&path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x0800_0000)
            .kill_on_drop(true)
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                let _ = std::fs::remove_file(&path);
                return Err(format!("Could not start the Windows script runner: {error}"));
            }
        };
        let stdout = child.stdout.take().ok_or_else(|| "PowerShell output was unavailable.".to_string())?;
        let stderr = child.stderr.take().ok_or_else(|| "PowerShell error output was unavailable.".to_string())?;
        let stdout_task = tauri::async_runtime::spawn(read_script_output(
            stdout, app.clone(), args.id.clone(), "stdout",
        ));
        let stderr_task = tauri::async_runtime::spawn(read_script_output(
            stderr, app.clone(), args.id.clone(), "stderr",
        ));

        let wait_result = tokio::time::timeout(std::time::Duration::from_secs(180), child.wait()).await;
        let status = match wait_result {
            Ok(Ok(status)) => Some(status),
            Ok(Err(error)) => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                let _ = std::fs::remove_file(&path);
                let _ = stdout_task.await;
                let _ = stderr_task.await;
                return Err(format!("Could not read the PowerShell result: {error}"));
            }
            Err(_) => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                None
            }
        };
        let stdout_lines = stdout_task.await.unwrap_or_default();
        let stderr_lines = stderr_task.await.unwrap_or_default();
        let _ = std::fs::remove_file(&path);

        if stdout_lines.iter().any(|line| line.contains("__OG_RESULT:SKIPPED")) {
            return Err("Skipped: Windows reported that this tweak does not apply to this PC. No success was recorded.".into());
        }
        let applied_marker = stdout_lines.iter().any(|line| line.contains("__OG_RESULT:APPLIED"));
        if status.as_ref().map(|value| value.success()).unwrap_or(false) && applied_marker {
            return Ok(format!(
                "PowerShell completed successfully. Restart Windows for the change to take effect."
            ));
        }
        let details = stderr_lines.iter().chain(stdout_lines.iter())
            .filter(|line| !line.contains("__OG_RESULT:"))
            .rev()
            .take(3)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join(" ");
        if status.is_none() {
            return Err(format!("The script exceeded the 3-minute limit and was stopped. No success was recorded. {details}"));
        }
        Err(if details.is_empty() {
            "PowerShell did not report a confirmed success. The tweak was not marked applied.".into()
        } else {
            format!("PowerShell did not confirm success: {details}")
        })
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("Script-only tweaks can run only in the Opti Gods Windows app.".into())
    }
}

/// Opens the user's Downloads folder in Windows Explorer.
/// Safe: no user-supplied paths — always opens the well-known shell folder.
#[tauri::command]
pub fn open_downloads() {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer.exe")
            .arg("shell:Downloads")
            .spawn();
    }
}

#[derive(Deserialize)]
pub struct DiagnosticLogArgs {
    pub filename: String,
    pub content: String,
}

/// Persist the native runner diagnostic log in the real Windows Downloads
/// folder. Browser Blob downloads are not reliable inside WebView2, so the
/// desktop shell owns this write and opens Explorer with the file selected.
#[tauri::command]
pub fn save_diagnostic_log(app: AppHandle, args: DiagnosticLogArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        let filename = std::path::Path::new(&args.filename)
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| {
                name.starts_with("OptiGods-V5-Tweak-Run-")
                    && name.ends_with(".txt")
                    && !name.contains("..")
            })
            .ok_or_else(|| "Invalid diagnostic log filename.".to_string())?;
        let downloads = app
            .path()
            .download_dir()
            .map_err(|error| format!("Windows Downloads folder is unavailable: {error}"))?;
        std::fs::create_dir_all(&downloads)
            .map_err(|error| format!("Could not create the Downloads folder: {error}"))?;
        let path = downloads.join(filename);
        std::fs::write(&path, args.content.as_bytes())
            .map_err(|error| format!("Could not save the diagnostic log: {error}"))?;
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(|error| format!("Diagnostic log was saved, but Explorer could not open it: {error}"))?;
        Ok(path.to_string_lossy().into_owned())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("Diagnostic log saving is available in the Windows app.".to_string())
    }
}

/// Repair the common NVIDIA Control Panel launch failure without claiming
/// success unless the installed executable actually starts.
#[tauri::command]
pub fn is_nvidia_control_panel_installed() -> Result<bool, String> {
    #[cfg(windows)]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$candidates = @()
foreach ($root in @($env:ProgramFiles, [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'))) {
  if ($root) {
    $candidate = Join-Path $root 'NVIDIA Corporation\Control Panel Client\nvcplui.exe'
    if (Test-Path -LiteralPath $candidate) { $candidates += $candidate }
  }
}
$exe = $candidates | Select-Object -First 1
if (-not $exe) {
  $package = @(Get-AppxPackage -Name '*NVIDIAControlPanel*' -ErrorAction SilentlyContinue; Get-AppxPackage -AllUsers -Name '*NVIDIAControlPanel*' -ErrorAction SilentlyContinue) | Select-Object -First 1
  if ($package) {
    $candidate = Join-Path $package.InstallLocation 'nvcplui.exe'
    if (Test-Path -LiteralPath $candidate) { $exe = $candidate }
  }
}
if ($exe -or $package) { 'true' } else { 'false' }
"#;
        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .output()
            .map_err(|error| format!("Could not check NVIDIA Control Panel installation: {error}"))?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                "Could not check NVIDIA Control Panel installation.".to_string()
            } else {
                detail
            });
        }
        match String::from_utf8_lossy(&output.stdout).trim().to_ascii_lowercase().as_str() {
            "true" => Ok(true),
            "false" => Ok(false),
            _ => Err("Windows returned an invalid NVIDIA Control Panel installation status.".into()),
        }
    }
    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn repair_nvidia_control_panel() -> Result<String, String> {
    #[cfg(windows)]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$serviceNames = @('NVDisplay.ContainerLocalSystem','NVDisplay.ContainerLS','NvContainerLocalSystem')
foreach ($name in $serviceNames) {
  $service = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($service) {
    if ($service.StartType -eq 'Disabled') { Set-Service -InputObject $service -StartupType Automatic -ErrorAction SilentlyContinue }
    if ($service.Status -ne 'Running') { Start-Service -InputObject $service -ErrorAction SilentlyContinue }
  }
}
$candidates = @(
  (Join-Path $env:ProgramFiles 'NVIDIA Corporation\Control Panel Client\nvcplui.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'NVIDIA Corporation\Control Panel Client\nvcplui.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$exe = $candidates | Select-Object -First 1
if (-not $exe) {
  $package = Get-AppxPackage -Name 'NVIDIACorp.NVIDIAControlPanel' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($package) {
    $candidate = Join-Path $package.InstallLocation 'nvcplui.exe'
    if (Test-Path -LiteralPath $candidate) { $exe = $candidate }
  }
}
if (-not $exe) { throw 'NVIDIA Control Panel executable was not found. Reinstall NVIDIA Control Panel from the Microsoft Store or reinstall the NVIDIA driver with Control Panel selected.' }
$existing = Get-Process -Name 'nvcplui' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  Write-Output 'NVIDIA Control Panel is already running.'
  return
}
$process = Start-Process -FilePath $exe -PassThru -ErrorAction Stop
$deadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $deadline) {
  $running = Get-Process -Name 'nvcplui' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($running) {
    Write-Output "NVIDIA Control Panel started from $exe"
    return
  }
  $process.Refresh()
  if ($process.HasExited) {
    if ($process.ExitCode -eq 0) {
      Write-Output "NVIDIA Control Panel launch submitted from $exe; the launcher exited cleanly."
      return
    }
    throw "NVIDIA Control Panel launcher exited with code $($process.ExitCode). Reinstall the NVIDIA driver/Control Panel package."
  }
  Start-Sleep -Milliseconds 250
}
$process.Refresh()
if (-not $process.HasExited) {
  Write-Output "NVIDIA Control Panel started from $exe"
  return
}
throw 'NVIDIA Control Panel was not observed after launch. Reinstall the NVIDIA driver/Control Panel package.'
"#;
        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .output()
            .map_err(|error| format!("Could not run the NVIDIA Control Panel repair: {error}"))?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                "NVIDIA Control Panel repair failed.".to_string()
            } else {
                detail
            });
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
    #[cfg(not(windows))]
    {
        Err("NVIDIA Control Panel repair is available in the Windows app.".to_string())
    }
}
/// Opens FiveM Application Data directly in Explorer.
/// Safe: the path is derived only from LOCALAPPDATA; the renderer supplies no path.
#[tauri::command]
pub fn open_fivem_folder() -> Result<(), String> {
    #[cfg(windows)]
    {
        let local = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA is unavailable".to_string())?;
        let candidates = [
            std::path::PathBuf::from(&local).join("FiveM").join("FiveM Application Data"),
            std::path::PathBuf::from(&local).join("FiveM").join("FiveM.app"),
        ];
        let path = candidates.iter().find(|p| p.exists())
            .ok_or_else(|| "FiveM Application Data was not found. Launch FiveM once, then try again.".to_string())?;
        std::process::Command::new("explorer.exe")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Could not open FiveM folder: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("FiveM folders are only available on Windows.".to_string())
    }
}

#[derive(Deserialize)]
pub struct SaveFivemPackZipArgs {
    pub pack_name: String,
    pub zip_bytes: Vec<u8>,
}

fn fivem_pack_zip_slug(name: &str) -> String {
    let mut slug = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            if slug.len() < 48 {
                slug.push(ch.to_ascii_lowercase());
            }
        } else if !slug.is_empty() && !slug.ends_with('-') && slug.len() < 48 {
            slug.push('-');
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() { "graphics-pack".to_string() } else { slug }
}

/// Save the generated ZIP in the user's Downloads folder before any game files are installed.
#[tauri::command]
pub fn save_fivem_pack_zip(app: AppHandle, args: SaveFivemPackZipArgs) -> Result<String, String> {
    #[cfg(windows)]
    {
        const MAX_ZIP_BYTES: usize = 25 * 1024 * 1024;
        let has_zip_signature = args.zip_bytes.starts_with(b"PK\x03\x04")
            || args.zip_bytes.starts_with(b"PK\x05\x06")
            || args.zip_bytes.starts_with(b"PK\x07\x08");
        if args.zip_bytes.len() < 4 || args.zip_bytes.len() > MAX_ZIP_BYTES || !has_zip_signature {
            return Err("The generated FiveM ZIP is empty, invalid, or too large to save. No game files were changed.".to_string());
        }
        let downloads = app.path().download_dir()
            .map_err(|e| format!("Could not locate the Windows Downloads folder: {e}"))?;
        std::fs::create_dir_all(&downloads)
            .map_err(|e| format!("Could not prepare the Downloads folder: {e}"))?;
        let slug = fivem_pack_zip_slug(&args.pack_name);
        let stem = format!("optigods-fivem-{slug}");
        for suffix in 1..=1000 {
            let file_name = if suffix == 1 {
                format!("{stem}.zip")
            } else {
                format!("{stem}-{suffix}.zip")
            };
            let path = downloads.join(&file_name);
            let mut file = match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
                Ok(file) => file,
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(format!("Could not save the FiveM ZIP to Downloads: {error}")),
            };
            let write_result = std::io::Write::write_all(&mut file, &args.zip_bytes)
                .and_then(|_| file.sync_all());
            if let Err(error) = write_result {
                drop(file);
                let _ = std::fs::remove_file(&path);
                return Err(format!("Could not finish saving the FiveM ZIP to Downloads: {error}"));
            }
            return Ok(file_name);
        }
        Err("Could not find an unused filename for the FiveM ZIP in Downloads.".to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, args);
        Err("Saving FiveM graphics ZIPs to Downloads is available only in the Windows app.".to_string())
    }
}

const FIVEM_PACK_PATHS: [&str; 2] = [
    "citizen/platform/data/tune/timecycle_mods_1.xml",
    "citizen/common/data/weather.xml",
];

#[derive(Deserialize)]
pub struct FivemPackFile {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct InstallFivemPackArgs {
    pub pack_name: String,
    pub files: Vec<FivemPackFile>,
}

#[derive(Serialize, Deserialize)]
struct FivemBackupEntry {
    path: String,
    existed: bool,
}

#[derive(Serialize, Deserialize)]
struct FivemBackupManifest {
    install_id: String,
    pack_name: String,
    files: Vec<FivemBackupEntry>,
}

#[derive(Serialize)]
pub struct FivemPackResult {
    pub ok: bool,
    pub install_id: String,
    pub message: String,
    pub installed_files: Vec<String>,
}

fn fivem_data_dir() -> Result<std::path::PathBuf, String> {
    let local = std::env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA is unavailable.".to_string())?;
    let candidates = [
        std::path::PathBuf::from(&local).join("FiveM").join("FiveM Application Data"),
        std::path::PathBuf::from(&local).join("FiveM").join("FiveM.app"),
    ];
    candidates.into_iter().find(|path| path.is_dir())
        .ok_or_else(|| "FiveM Application Data was not found. Launch FiveM once, then try again.".to_string())
}

fn validate_pack_file(file: &FivemPackFile) -> Result<(), String> {
    if !FIVEM_PACK_PATHS.contains(&file.path.as_str()) {
        return Err(format!("Pack contains a path that Opti Gods will not install: {}", file.path));
    }
    if file.content.is_empty() || file.content.len() > 2_000_000 {
        return Err(format!("{} is empty or exceeds the 2 MB safety limit.", file.path));
    }
    if file.content.contains('\0') || file.content.contains("NaN") || file.content.contains("Infinity") {
        return Err(format!("{} contains invalid content.", file.path));
    }
    let valid_xml = if file.path.ends_with("timecycle_mods_1.xml") {
        file.content.starts_with("<?xml")
            && file.content.contains("<timecycle_mods_file>")
            && file.content.contains("</timecycle_mods_file>")
    } else {
        file.content.starts_with("<?xml")
            && file.content.contains("<CWeatherTypeList>")
            && file.content.contains("</CWeatherTypeList>")
    };
    if !valid_xml {
        return Err(format!("{} failed XML validation.", file.path));
    }
    Ok(())
}

#[cfg(test)]
mod fivem_pack_validation_tests {
    use super::{validate_pack_file, FivemPackFile, FIVEM_PACK_PATHS};

    #[test]
    fn accepts_the_timecycle_root_generated_by_graphics_studio() {
        let file = FivemPackFile {
            path: FIVEM_PACK_PATHS[0].to_string(),
            content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><timecycle_mods_file></timecycle_mods_file>".to_string(),
        };
        assert!(validate_pack_file(&file).is_ok());
    }

    #[test]
    fn rejects_a_different_timecycle_root() {
        let file = FivemPackFile {
            path: FIVEM_PACK_PATHS[0].to_string(),
            content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><CTimeCycleModifierList></CTimeCycleModifierList>".to_string(),
        };
        assert!(validate_pack_file(&file).is_err());
    }
}

fn restore_fivem_manifest(
    root: &std::path::Path,
    backup_dir: &std::path::Path,
    manifest: &FivemBackupManifest,
) -> Result<(), String> {
    let mut failures = Vec::new();
    for entry in manifest.files.iter().rev() {
        let destination = root.join(&entry.path);
        let result = if entry.existed {
            let backup = backup_dir.join("files").join(&entry.path);
            if let Some(parent) = destination.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not recreate {}: {error}", parent.display()))?;
            }
            std::fs::copy(&backup, &destination).map(|_| ())
        } else if destination.exists() {
            std::fs::remove_file(&destination)
        } else {
            Ok(())
        };
        if let Err(error) = result {
            failures.push(format!("{}: {error}", entry.path));
        }
    }
    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!("Rollback could not restore every file: {}", failures.join("; ")))
    }
}

#[tauri::command]
pub fn install_fivem_pack(args: InstallFivemPackArgs) -> Result<FivemPackResult, String> {
    #[cfg(windows)]
    {
        if args.files.len() != FIVEM_PACK_PATHS.len() {
            return Err("The generated pack is incomplete or contains extra files.".to_string());
        }
        for expected in FIVEM_PACK_PATHS {
            if args.files.iter().filter(|file| file.path == expected).count() != 1 {
                return Err(format!("The generated pack must contain exactly one {expected}."));
            }
        }
        for file in &args.files {
            validate_pack_file(file)?;
        }

        let root = fivem_data_dir()?;
        let install_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "System clock is invalid.".to_string())?
            .as_millis()
            .to_string();
        let backups_root = root.join(".optigods-backups");
        let backup_dir = backups_root.join(&install_id);
        std::fs::create_dir_all(backup_dir.join("files"))
            .map_err(|error| format!("Could not create the rollback backup: {error}"))?;

        let manifest = FivemBackupManifest {
            install_id: install_id.clone(),
            pack_name: args.pack_name.chars().take(100).collect(),
            files: args.files.iter().map(|file| FivemBackupEntry {
                path: file.path.clone(),
                existed: root.join(&file.path).is_file(),
            }).collect(),
        };

        for entry in &manifest.files {
            if entry.existed {
                let source = root.join(&entry.path);
                let backup = backup_dir.join("files").join(&entry.path);
                if let Some(parent) = backup.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|error| format!("Could not prepare backup for {}: {error}", entry.path))?;
                }
                std::fs::copy(&source, &backup)
                    .map_err(|error| format!("Could not back up {}. Nothing was installed: {error}", entry.path))?;
            }
        }
        let manifest_bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|error| format!("Could not create rollback manifest: {error}"))?;
        std::fs::write(backup_dir.join("manifest.json"), manifest_bytes)
            .map_err(|error| format!("Could not save rollback manifest: {error}"))?;

        let mut installed = Vec::new();
        for file in &args.files {
            let destination = root.join(&file.path);
            let result = (|| {
                let parent = destination.parent()
                    .ok_or_else(|| format!("Invalid destination for {}.", file.path))?;
                std::fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
                let temporary = destination.with_extension("optigods-installing");
                std::fs::write(&temporary, file.content.as_bytes())
                    .map_err(|error| format!("Could not write {}: {error}", file.path))?;
                if destination.exists() {
                    std::fs::remove_file(&destination)
                        .map_err(|error| format!("Could not replace {}: {error}", file.path))?;
                }
                std::fs::rename(&temporary, &destination)
                    .map_err(|error| format!("Could not finish copying {}: {error}", file.path))?;
                let written = std::fs::read(&destination)
                    .map_err(|error| format!("Could not verify {}: {error}", file.path))?;
                if Sha256::digest(&written) != Sha256::digest(file.content.as_bytes()) {
                    return Err(format!("Verification failed after copying {}.", file.path));
                }
                Ok(())
            })();
            if let Err(error) = result {
                let rollback = restore_fivem_manifest(&root, &backup_dir, &manifest);
                return Err(match rollback {
                    Ok(()) => format!("{error} The partial install was rolled back."),
                    Err(rollback_error) => format!("{error} {rollback_error}"),
                });
            }
            installed.push(file.path.clone());
        }

        if let Err(error) = std::fs::write(backups_root.join("latest"), install_id.as_bytes()) {
            let rollback = restore_fivem_manifest(&root, &backup_dir, &manifest);
            return Err(match rollback {
                Ok(()) => format!(
                    "The rollback index could not be saved, so the installation was safely reversed: {error}"
                ),
                Err(rollback_error) => format!(
                    "The rollback index could not be saved: {error}. {rollback_error}"
                ),
            });
        }
        Ok(FivemPackResult {
            ok: true,
            install_id,
            message: format!("Installed and verified {} files. Existing files were backed up for one-click rollback.", installed.len()),
            installed_files: installed,
        })
    }
    #[cfg(not(windows))]
    {
        let _ = args;
        Err("FiveM pack installation is available only in the Windows app.".to_string())
    }
}

#[tauri::command]
pub fn uninstall_fivem_pack() -> Result<FivemPackResult, String> {
    #[cfg(windows)]
    {
        let root = fivem_data_dir()?;
        let backups_root = root.join(".optigods-backups");
        let install_id = std::fs::read_to_string(backups_root.join("latest"))
            .map_err(|_| "No Opti Gods graphics pack rollback was found.".to_string())?;
        let install_id = install_id.trim().to_string();
        if install_id.is_empty() || !install_id.chars().all(|c| c.is_ascii_digit()) {
            return Err("The rollback index is invalid.".to_string());
        }
        let backup_dir = backups_root.join(&install_id);
        let manifest: FivemBackupManifest = serde_json::from_slice(
            &std::fs::read(backup_dir.join("manifest.json"))
                .map_err(|error| format!("Could not read rollback manifest: {error}"))?
        ).map_err(|error| format!("Rollback manifest is invalid: {error}"))?;
        if manifest.install_id != install_id {
            return Err("Rollback manifest does not match the selected installation.".to_string());
        }
        restore_fivem_manifest(&root, &backup_dir, &manifest)?;
        std::fs::remove_file(backups_root.join("latest"))
            .map_err(|error| format!("Files were restored, but rollback status could not be cleared: {error}"))?;
        Ok(FivemPackResult {
            ok: true,
            install_id,
            message: format!("Removed {} and restored every file from its backup.", manifest.pack_name),
            installed_files: manifest.files.into_iter().map(|entry| entry.path).collect(),
        })
    }
    #[cfg(not(windows))]
    {
        Err("FiveM pack rollback is available only in the Windows app.".to_string())
    }
}

/// Read a text file from an absolute path on disk.
/// Used by the HW Monitor drop zone: Tauri intercepts OS file drops and
/// delivers a file path; the frontend then calls this to get the content.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read_text_file({path}): {e}"))
}

/// Read the FiveM CitizenFX.log (tail 400 lines) to detect the current/last
/// connected server. Returns empty string if FiveM is not installed or log
/// is missing. Used by the dashboard to auto-add and auto-mark active servers.
#[tauri::command]
pub fn read_fivem_log() -> String {
    #[cfg(windows)]
    {
        let localappdata = match std::env::var("LOCALAPPDATA") {
            Ok(v) => v,
            Err(_) => return String::new(),
        };
        let log_path = format!(r"{}\FiveM\FiveM.app\logs\CitizenFX.log", localappdata);
        match std::fs::read_to_string(&log_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let start = lines.len().saturating_sub(400);
                lines[start..].join("\n")
            }
            Err(_) => String::new(),
        }
    }
    #[cfg(not(windows))]
    {
        String::new()
    }
}
