// Thin Tauri-updater wrapper. The actual update endpoint is configured in
// tauri.conf.json (plugins.updater.endpoints) and points at the GitHub
// Releases JSON manifest. This command lets the React UI surface the
// "Check for updates" button.

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize, Clone, Debug)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub notes: Option<String>,
    pub error: Option<String>,
}

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
