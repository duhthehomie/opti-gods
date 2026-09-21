// Splash window controller. The React bundle calls finish_splash() once the
// dashboard mounts and queries have settled — Rust then closes the splash
// window and reveals the (initially hidden) main window.

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn finish_splash(app: AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}
