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
    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => UpdateInfo {
                available: true,
                current_version,
                latest_version: Some(update.version.clone()),
                notes: update.body.clone(),
                error: None,
            },
            Ok(None) => UpdateInfo {
                available: false,
                current_version,
                latest_version: None,
                notes: None,
                error: None,
            },
            Err(err) => UpdateInfo {
                available: false,
                current_version,
                latest_version: None,
                notes: None,
                error: Some(format!("{err}")),
            },
        },
        Err(err) => UpdateInfo {
            available: false,
            current_version,
            latest_version: None,
            notes: None,
            error: Some(format!("{err}")),
        },
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
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    let update = match update {
        Some(u) => u,
        None => return Err("no_update".to_string()),
    };

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
