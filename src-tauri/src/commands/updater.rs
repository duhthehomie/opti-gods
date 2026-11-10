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
