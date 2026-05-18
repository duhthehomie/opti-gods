// Opti Gods desktop — Tauri 2.x entrypoint.

mod commands;
mod state;

#[cfg(windows)]
mod win32;

use tauri::{Manager, WindowEvent};
use tauri::webview::PageLoadEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info,tauri=warn"),
    )
    .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state::AppState::default())
        .setup(|app| {
            // The main window starts hidden (visible:false in tauri.conf.json).
            // WebView2 blocks the Win32 message pump for several seconds while
            // it initialises — keeping the window invisible means the user
            // never sees "Not Responding".
            //
            // on_page_load (below) shows the window the instant JS is ready.
            // This safety timer shows it after 8 s regardless, so a broken
            // page-load event can never leave the app permanently invisible.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(8)).await;
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            });

            // ProBalance background loop — self-throttles when no game runs.
            #[cfg(windows)]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = commands::process_lasso::run_forever(handle).await {
                        log::error!("[process_lasso] worker exited: {err:#}");
                    }
                });
            }
            Ok(())
        })
        .on_page_load(|window, payload| {
            // Fire when the React bundle finishes loading — WebView2 is fully
            // initialised at this point, so showing the window here means it
            // appears immediately responsive with no "Not Responding" title bar.
            if payload.event() == PageLoadEvent::Finished {
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    // No splash window exists anymore — nothing extra to close.
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::splash::finish_splash,
            commands::tweaks::apply_tweak,
            commands::tweaks::undo_tweak,
            commands::tweaks::list_tweaks,
            commands::hardware::scan_hardware,
            commands::restore::create_restore_point,
            commands::restore::restore_to_point,
            commands::restore::list_restore_points,
            commands::process_lasso::start_pro_balance,
            commands::process_lasso::stop_pro_balance,
            commands::process_lasso::pro_balance_status,
            commands::discord::discord_login,
            commands::discord::discord_logout,
            commands::discord::discord_cached_token,
            commands::updater::check_for_update,
            commands::env::env_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Opti Gods");
}
