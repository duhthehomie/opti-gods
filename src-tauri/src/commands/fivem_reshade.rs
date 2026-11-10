//! One-click Opti Gods ReShade for FiveM.
//!
//! FiveM only loads ReShade from `FiveM.app\plugins` (as dxgi.dll, without
//! add-on support). Everything installed is embedded in this app at build time:
//! ReShade 6.8.0 (BSD-3, crosire), SweetFX DPX / Technicolor2 / LumaSharpen
//! (MIT, CeeJay.dk) and the Opti Gods overlay. Nothing is downloaded.
//!
//! Install and remove refuse while FiveM is open. A ReShade the user already
//! had is moved to a backup and put back on remove. Only files listed in our
//! manifest are ever deleted.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const RESHADE_VERSION: &str = "6.8.0";
const MANIFEST: &str = "optigods-reshade.json";
const PRESET: &str = "OptiGods-FiveM.ini";
const SHADER_DIR: &str = "reshade-shaders";

macro_rules! asset {
    ($path:literal) => {
        ($path, include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/resources/fivem-reshade/", $path)) as &[u8])
    };
}

/// (path inside the bundle, bytes). Shaders/Textures go under reshade-shaders\.
const ASSETS: &[(&str, &[u8])] = &[
    asset!("Shaders/DPX.fx"),
    asset!("Shaders/Technicolor2.fx"),
    asset!("Shaders/LumaSharpen.fx"),
    asset!("Shaders/ReShade.fxh"),
    asset!("Shaders/ReShadeUI.fxh"),
    asset!("Shaders/OptiGodsOverlay.fx"),
    asset!("Textures/OptiGodsLogoTransparent.png"),
    asset!("Textures/OptiGodsFreeTweaks.png"),
];
const RESHADE_DLL: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/resources/fivem-reshade/ReShade64.dll"));
const LICENSE_RESHADE: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/resources/fivem-reshade/LICENSE-ReShade.txt"));
const LICENSE_SWEETFX: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/resources/fivem-reshade/LICENSE-SweetFX.txt"));

/// Files ReShade itself uses that another install could already own.
const RESHADE_OWNED: &[&str] = &["dxgi.dll", "ReShade.ini"];

#[derive(Deserialize, Debug, Clone)]
pub struct FivemReshadeOptions {
    /// Opti Gods logo in the corner.
    pub show_logo: bool,
    /// "optigods.com · Enable Best 15 Tweaks" banner.
    pub show_ad: bool,
    /// "bottom-center" | "top-center" | "bottom-left" | "bottom-right"
    pub ad_position: String,
}

#[derive(Serialize, Deserialize, Default, Debug)]
struct Manifest {
    version: String,
    installed_ms: u128,
    /// Files we wrote, relative to plugins.
    files: Vec<String>,
    /// Backup folder (relative to plugins) holding the user's previous ReShade, if any.
    backup: Option<String>,
}

#[derive(Serialize, Debug, Default)]
pub struct FivemReshadeStatus {
    pub fivem_found: bool,
    pub plugins_dir: String,
    pub installed: bool,
    pub version: String,
    /// A ReShade (or other dxgi.dll) that Opti Gods did not install.
    pub other_reshade: bool,
    pub fivem_running: bool,
}

fn fivem_app_dir() -> Result<PathBuf, String> {
    let local = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA is unavailable.".to_string())?;
    let base = PathBuf::from(local).join("FiveM");
    [base.join("FiveM.app"), base.join("FiveM Application Data")]
        .into_iter()
        .find(|path| path.is_dir())
        .ok_or_else(|| "FiveM was not found on this PC. Install FiveM and launch it once, then try again.".to_string())
}

#[cfg(windows)]
fn fivem_running() -> Result<bool, String> {
    let processes = crate::commands::gaming_mode::native::list()?;
    Ok(processes.iter().any(|p| {
        let name = p.name.to_ascii_lowercase();
        name == "fivem.exe" || name.starts_with("fivem_")
    }))
}

#[cfg(not(windows))]
fn fivem_running() -> Result<bool, String> { Ok(false) }

fn read_manifest(plugins: &Path) -> Option<Manifest> {
    let text = std::fs::read_to_string(plugins.join(MANIFEST)).ok()?;
    serde_json::from_str(&text).ok()
}

/// Rejects anything that is not a plain relative path inside plugins.
fn safe_relative(path: &str) -> bool {
    !path.is_empty()
        && !path.contains("..")
        && !path.contains(':')
        && !path.starts_with(['\\', '/'])
}

pub(crate) fn preset_text(options: &FivemReshadeOptions) -> String {
    let (ad_x, ad_y) = match options.ad_position.as_str() {
        "top-center" => (0.5, 0.08),
        "bottom-left" => (0.0, 0.92),
        "bottom-right" => (1.0, 0.92),
        _ => (0.5, 0.92),
    };
    // Keep the logo away from the banner.
    let (logo_x, logo_y) = if options.ad_position == "bottom-right" { (0.90, 0.10) } else { (0.88, 0.88) };
    let flag = |on: bool| if on { "1" } else { "0" };
    let techniques = "DPX@DPX.fx,Technicolor2@Technicolor2.fx,LumaSharpen@LumaSharpen.fx,OptiGodsOverlay@OptiGodsOverlay.fx";
    format!(
        "Techniques={techniques}\r\nTechniqueSorting={techniques}\r\n\r\n\
[DPX.fx]\r\nRGB_Curve=8.000000,5.000000,3.000000\r\nRGB_C=0.360000,0.360000,0.340000\r\nSaturation=2.900000\r\nStrength=0.220000\r\n\r\n\
[Technicolor2.fx]\r\nColorStrength=0.220000,0.220000,0.220000\r\nBrightness=1.000000\r\nSaturation=0.900000\r\nStrength=0.380000\r\n\r\n\
[LumaSharpen.fx]\r\nsharp_strength=0.700000\r\nsharp_clamp=0.035000\r\npattern=1\r\noffset_bias=1.000000\r\nshow_sharpen=0\r\n\r\n\
[OptiGodsOverlay.fx]\r\nbShowLogo={}\r\nbShowAd={}\r\nfAdPosition={ad_x:.6},{ad_y:.6}\r\nfPosX={logo_x:.6}\r\nfPosY={logo_y:.6}\r\n",
        flag(options.show_logo),
        flag(options.show_ad),
    )
}

fn reshade_ini(plugins: &Path) -> String {
    let shaders = plugins.join(SHADER_DIR);
    format!(
        "[GENERAL]\r\nEffectSearchPaths={}\\Shaders\\**\r\nTextureSearchPaths={}\\Textures\\**\r\nPresetPath={}\r\nPerformanceMode=0\r\n\r\n\
[INPUT]\r\nKeyOverlay=36,0,0,0\r\n\r\n[OVERLAY]\r\nTutorialProgress=4\r\n",
        shaders.display(),
        shaders.display(),
        plugins.join(PRESET).display(),
    )
}

fn write_file(plugins: &Path, relative: &str, bytes: &[u8], written: &mut Vec<String>) -> Result<(), String> {
    let path = plugins.join(relative);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
    }
    std::fs::write(&path, bytes).map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    written.push(relative.to_string());
    Ok(())
}

fn status_inner() -> Result<FivemReshadeStatus, String> {
    let fivem_running = fivem_running()?;
    let app = match fivem_app_dir() {
        Ok(app) => app,
        Err(_) => return Ok(FivemReshadeStatus { fivem_running, ..Default::default() }),
    };
    let plugins = app.join("plugins");
    let manifest = read_manifest(&plugins);
    let dll = plugins.join("dxgi.dll").is_file();
    Ok(FivemReshadeStatus {
        fivem_found: true,
        plugins_dir: plugins.display().to_string(),
        installed: manifest.is_some() && dll,
        version: manifest.as_ref().map(|m| m.version.clone()).unwrap_or_default(),
        other_reshade: manifest.is_none() && dll,
        fivem_running,
    })
}

fn remove_inner(plugins: &Path, manifest: &Manifest) -> Result<(), String> {
    for relative in &manifest.files {
        if !safe_relative(relative) { continue; }
        let path = plugins.join(relative);
        if path.is_file() {
            std::fs::remove_file(&path).map_err(|e| format!("Could not remove {}: {e}", path.display()))?;
        }
    }
    // Remove now-empty folders we created (deepest first).
    for dir in [format!("{SHADER_DIR}\\Shaders"), format!("{SHADER_DIR}\\Textures"), SHADER_DIR.to_string()] {
        let _ = std::fs::remove_dir(plugins.join(dir));
    }
    if let Some(backup) = manifest.backup.as_deref().filter(|b| safe_relative(b)) {
        let backup_dir = plugins.join(backup);
        for name in RESHADE_OWNED {
            let saved = backup_dir.join(name);
            if saved.is_file() {
                std::fs::rename(&saved, plugins.join(name))
                    .map_err(|e| format!("Could not restore your previous {name}: {e}"))?;
            }
        }
        let _ = std::fs::remove_dir(&backup_dir);
    }
    std::fs::remove_file(plugins.join(MANIFEST)).map_err(|e| format!("Could not remove the Opti Gods ReShade record: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn fivem_reshade_status() -> Result<FivemReshadeStatus, String> {
    status_inner()
}

#[tauri::command]
pub fn fivem_reshade_install(options: FivemReshadeOptions) -> Result<FivemReshadeStatus, String> {
    if !cfg!(windows) { return Err("ReShade for FiveM installs from the Windows app.".into()); }
    if fivem_running()? {
        return Err("Close FiveM first. ReShade can only be installed while FiveM is closed.".into());
    }
    let plugins = fivem_app_dir()?.join("plugins");
    std::fs::create_dir_all(&plugins).map_err(|e| format!("Could not create {}: {e}", plugins.display()))?;

    // Reinstall: remove our previous files first (keeps the user's backup).
    let mut backup = None;
    if let Some(previous) = read_manifest(&plugins) {
        backup = previous.backup.clone();
        let keep_backup = Manifest { backup: None, ..previous };
        remove_inner(&plugins, &keep_backup)?;
    }

    // Someone else's ReShade: move it aside so it can be put back on remove.
    let existing: Vec<&str> = RESHADE_OWNED.iter().copied().filter(|n| plugins.join(n).is_file()).collect();
    if !existing.is_empty() {
        let millis = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
        let folder = backup.clone().unwrap_or_else(|| format!("optigods-reshade-backup-{millis}"));
        let dir = plugins.join(&folder);
        std::fs::create_dir_all(&dir).map_err(|e| format!("Could not back up your current ReShade: {e}"))?;
        for name in existing {
            let target = dir.join(name);
            if target.exists() { std::fs::remove_file(plugins.join(name)).map_err(|e| format!("Could not replace {name}: {e}"))?; continue; }
            std::fs::rename(plugins.join(name), &target).map_err(|e| format!("Could not back up your current {name}: {e}"))?;
        }
        backup = Some(folder);
    }

    let mut written = Vec::new();
    let result = (|| -> Result<(), String> {
        for (path, bytes) in ASSETS {
            write_file(&plugins, &format!("{SHADER_DIR}\\{}", path.replace('/', "\\")), bytes, &mut written)?;
        }
        write_file(&plugins, "ReShade.LICENSE.txt", LICENSE_RESHADE, &mut written)?;
        write_file(&plugins, &format!("{SHADER_DIR}\\SweetFX.LICENSE.txt"), LICENSE_SWEETFX, &mut written)?;
        write_file(&plugins, PRESET, preset_text(&options).as_bytes(), &mut written)?;
        write_file(&plugins, "ReShade.ini", reshade_ini(&plugins).as_bytes(), &mut written)?;
        // The DLL last: FiveM only loads ReShade once everything it needs is in place.
        write_file(&plugins, "dxgi.dll", RESHADE_DLL, &mut written)?;
        Ok(())
    })();

    let manifest = Manifest {
        version: RESHADE_VERSION.into(),
        installed_ms: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0),
        files: written,
        backup,
    };
    let manifest_text = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    std::fs::write(plugins.join(MANIFEST), manifest_text).map_err(|e| format!("Could not save the Opti Gods ReShade record: {e}"))?;

    if let Err(error) = result {
        // Undo the partial install and put the user's ReShade back.
        let undo = remove_inner(&plugins, &manifest);
        return Err(match undo {
            Ok(()) => format!("{error} Nothing was changed."),
            Err(undo_error) => format!("{error} Undo also failed: {undo_error}"),
        });
    }

    let status = status_inner()?;
    if !status.installed {
        return Err("ReShade files were written but could not be found afterwards.".into());
    }
    Ok(status)
}

#[tauri::command]
pub fn fivem_reshade_remove() -> Result<FivemReshadeStatus, String> {
    if fivem_running()? {
        return Err("Close FiveM first. ReShade can only be removed while FiveM is closed.".into());
    }
    let plugins = fivem_app_dir()?.join("plugins");
    let manifest = read_manifest(&plugins).ok_or_else(|| "The Opti Gods ReShade is not installed.".to_string())?;
    remove_inner(&plugins, &manifest)?;
    status_inner()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preset_turns_overlay_parts_on_and_off() {
        let text = preset_text(&FivemReshadeOptions { show_logo: false, show_ad: true, ad_position: "top-center".into() });
        assert!(text.contains("bShowLogo=0"));
        assert!(text.contains("bShowAd=1"));
        assert!(text.contains("fAdPosition=0.500000,0.080000"));
        assert!(!text.contains("Crosshair"));
    }

    #[test]
    fn rejects_paths_outside_plugins() {
        assert!(!safe_relative("..\\dxgi.dll"));
        assert!(!safe_relative("C:\\Windows\\x.dll"));
        assert!(safe_relative("reshade-shaders\\Shaders\\DPX.fx"));
    }
}
