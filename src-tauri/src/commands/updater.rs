// Tauri updater commands.
//
// check_for_update  — lightweight check, returns UpdateInfo (version + notes).
//                     Used by the React modal to decide whether to show the
//                     update prompt.
//
// perform_update    — downloads AND installs the update via Tauri's plugin,
//                     emitting `update-progress` events so the React modal can
//                     show a real progress bar.  The NSIS installer runs in
//                     "passive" mode (tauri.conf.json → installMode) which
//                     means no user interaction — just a brief system progress
//                     bar, then the new version launches automatically.

use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

// ─── shared types ────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub notes: Option<String>,
    pub error: Option<String>,
    /// The release carries a valid-looking updater signature, so the app can
    /// download and install it itself. False: the installer must be run by hand.
    pub auto_install: bool,
}

const RELEASES_API: &str = "https://api.github.com/repos/duhthehomie/opti-gods/releases?per_page=15";

fn parse_version(tag: &str) -> Option<(u64, u64, u64)> {
    let mut parts = tag.trim_start_matches(['v', 'V']).split('.').map(|p| p.parse::<u64>().ok());
    Some((parts.next()??, parts.next()??, parts.next()??))
}

/// latest.json of the newest published release. Builds are published as
/// prereleases, which GitHub's "latest" link skips, so look at the list.
async fn newest_manifest_url() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("OptiGods-Updater/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let releases: Vec<serde_json::Value> = client
        .get(RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send().await.map_err(|e| format!("GitHub releases could not be read: {e}"))?
        .error_for_status().map_err(|e| format!("GitHub releases could not be read: {e}"))?
        .json().await.map_err(|e| format!("GitHub releases were not readable: {e}"))?;
    releases
        .iter()
        .filter(|r| !r["draft"].as_bool().unwrap_or(false))
        .filter_map(|r| {
            let version = parse_version(r["tag_name"].as_str()?)?;
            let url = r["assets"].as_array()?.iter()
                .find(|a| a["name"].as_str() == Some("latest.json"))?["browser_download_url"]
                .as_str()?.to_string();
            Some((version, url))
        })
        .max_by_key(|(version, _)| *version)
        .map(|(_, url)| url)
        .ok_or_else(|| "No published release has an update manifest yet.".to_string())
}

async fn build_updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    let url = newest_manifest_url().await?;
    let url = tauri::Url::parse(&url).map_err(|e| format!("Bad update manifest address: {e}"))?;
    app.updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
    downloaded: u64,
    total: Option<u64>,
    /// 0-100, capped at 99 during download (100 = installer launched)
    percent: u8,
    /// true when the installer is running (download finished, NSIS in progress)
    installing: bool,
}

// ─── commands ─────────────────────────────────────────────────────────────────

/// Lightweight version check.  Does NOT download anything.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> UpdateInfo {
    let current_version = app.package_info().version.to_string();
    let failed = |current_version: String, error: String| UpdateInfo {
        available: false, current_version, latest_version: None, notes: None, error: Some(error), auto_install: false,
    };
    let updater = match build_updater(&app).await {
        Ok(updater) => updater,
        Err(error) => return failed(current_version, error),
    };
    match updater.check().await {
        Ok(Some(update)) => UpdateInfo {
            available: true,
            current_version,
            latest_version: Some(update.version.clone()),
            notes: update.body.clone(),
            error: None,
            auto_install: !update.signature.trim().is_empty(),
        },
        Ok(None) => UpdateInfo {
            available: false, current_version, latest_version: None, notes: None, error: None, auto_install: false,
        },
        Err(err) => failed(current_version, err.to_string()),
    }
}

/// Download and silently install the update.
///
/// Emits `update-progress` events while downloading so the React modal can
/// drive a real progress bar.  After the download completes it emits a final
/// event with `installing: true`, then the NSIS passive installer takes over.
/// The old process is replaced by the new version automatically.
///
/// Returns Err if:
///   - the updater plugin is not available
///   - no update is found (caller should guard with check_for_update first)
///   - the download or install fails (React falls back to browser download)
#[tauri::command]
pub async fn perform_update(app: AppHandle) -> Result<(), String> {
    let updater = build_updater(&app).await?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    let update = match update {
        Some(u) => u,
        None => return Err("no_update".to_string()),
    };
    // Never install an unsigned build; the signature is verified against the
    // public key built into this app before the installer runs.
    if update.signature.trim().is_empty() {
        return Err(format!("v{} is not signed for automatic install. Download the installer from the Update Center instead.", update.version));
    }

    let app_progress = app.clone();
    let app_finish = app.clone();
    let downloaded = Arc::new(AtomicU64::new(0));
    let dl_clone = downloaded.clone();

    update
        .download_and_install(
            // Called for each downloaded chunk.
            move |chunk_length, content_length| {
                // fetch_add returns the old value — add chunk to get current total.
                let cur = dl_clone.fetch_add(chunk_length as u64, Ordering::Relaxed)
                    + chunk_length as u64;
                let percent = content_length
                    .map(|t| ((cur as f64 / t as f64) * 100.0).min(99.0) as u8)
                    .unwrap_or(50_u8);
                let _ = app_progress.emit(
                    "update-progress",
                    DownloadProgress {
                        downloaded: cur,
                        total: content_length,
                        percent,
                        installing: false,
                    },
                );
            },
            // Called once when the download is complete, before the installer runs.
            move || {
                let _ = app_finish.emit(
                    "update-progress",
                    DownloadProgress {
                        downloaded: 0,
                        total: None,
                        percent: 100,
                        installing: true,
                    },
                );
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── installer download (works for unsigned releases) ─────────────────────────

#[derive(Serialize, Clone)]
struct InstallerProgress {
    downloaded: u64,
    total: u64,
    percent: u8,
}

#[derive(Serialize, Clone)]
pub struct InstallerDownload {
    pub version: String,
    pub path: String,
}

/// Downloads the newest release's installer into Downloads, checks its size and
/// SHA-256 against that release's latest.json, then opens the installer.
/// Opti Gods closes a moment later so the installer can replace its files.
#[tauri::command]
pub async fn download_and_run_installer(app: AppHandle) -> Result<InstallerDownload, String> {
    use sha2::{Digest, Sha256};
    use tauri::Manager;
    use tokio::io::AsyncWriteExt;

    let client = reqwest::Client::builder()
        .user_agent(concat!("OptiGods-Updater/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let manifest_url = newest_manifest_url().await?;
    let manifest_text = client.get(&manifest_url).send().await
        .and_then(|r| r.error_for_status()).map_err(|e| format!("Update manifest could not be downloaded: {e}"))?
        .text().await.map_err(|e| format!("Update manifest could not be read: {e}"))?;
    let manifest: serde_json::Value = serde_json::from_str(manifest_text.trim_start_matches('\u{feff}'))
        .map_err(|e| format!("Update manifest is not valid: {e}"))?;
    let version = manifest["version"].as_str().ok_or("Update manifest has no version.")?.to_string();
    let current = app.package_info().version.to_string();
    if parse_version(&version) <= parse_version(&current) {
        return Err(format!("You already have the newest version (v{current})."));
    }
    let url = manifest["platforms"]["windows-x86_64"]["url"].as_str().ok_or("Update manifest has no installer link.")?.to_string();
    let expected_sha = manifest["sha256"].as_str().ok_or("Update manifest has no installer checksum.")?.to_ascii_lowercase();
    let expected_size = manifest["size"].as_u64().ok_or("Update manifest has no installer size.")?;

    let downloads = app.path().download_dir().map_err(|e| format!("Downloads folder not found: {e}"))?;
    let final_path = downloads.join(format!("OptiGods-Setup-{version}.exe"));
    let part_path = downloads.join(format!("OptiGods-Setup-{version}.exe.part"));

    let mut response = client.get(&url).send().await
        .and_then(|r| r.error_for_status()).map_err(|e| format!("Installer download failed: {e}"))?;
    let mut file = tokio::fs::File::create(&part_path).await.map_err(|e| format!("Could not save the installer: {e}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut last_percent = u8::MAX;
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Installer download was interrupted: {e}"))? {
        hasher.update(&chunk);
        file.write_all(&chunk).await.map_err(|e| format!("Could not save the installer: {e}"))?;
        downloaded += chunk.len() as u64;
        let percent = ((downloaded as f64 / expected_size.max(1) as f64) * 100.0).min(100.0) as u8;
        if percent != last_percent {
            last_percent = percent;
            let _ = app.emit("installer-download-progress", InstallerProgress { downloaded, total: expected_size, percent });
        }
    }
    file.flush().await.map_err(|e| format!("Could not save the installer: {e}"))?;
    drop(file);
    let actual_sha = format!("{:x}", hasher.finalize());
    if downloaded != expected_size || actual_sha != expected_sha {
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(format!("The downloaded installer did not match the release (size {downloaded} of {expected_size}). Nothing was installed; try again."));
    }
    let _ = tokio::fs::remove_file(&final_path).await;
    tokio::fs::rename(&part_path, &final_path).await.map_err(|e| format!("Could not save the installer: {e}"))?;

    std::process::Command::new(&final_path)
        .spawn()
        .map_err(|e| format!("The installer was downloaded to {} but could not be opened: {e}", final_path.display()))?;

    // Give the window time to show the success message, then close so the
    // installer can replace Opti Gods' files without asking to kill it.
    let app_exit = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(3500)).await;
        app_exit.exit(0);
    });

    Ok(InstallerDownload { version, path: final_path.display().to_string() })
}
