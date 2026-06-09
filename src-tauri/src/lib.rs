// Opti Gods desktop — Tauri 2.x entrypoint.

mod commands;
mod state;

#[cfg(windows)]
mod win32;

use tauri::{Manager, WindowEvent};

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
            let handle_safety = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                if let Some(w) = handle_safety.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            });

            #[cfg(windows)]
            {
                // Auto-create a System Restore checkpoint on every app launch.
                // If System Restore is disabled (some debloat scripts turn it off),
                // ensure_enabled() re-enables it before creating the point.
                // This checkpoint is what "Restore Last Working State" rolls back to.
                tauri::async_runtime::spawn(async move {
                    // Wait for the UI to be visible before the potentially-slow SR call
                    tokio::time::sleep(std::time::Duration::from_secs(8)).await;
                    match commands::restore::startup_restore_checkpoint().await {
                        Ok(Some(rp)) => log::info!(
                            "[startup] restore point #{} ready — 'Restore Last Working State' is armed",
                            rp.sequence_number
                        ),
                        Ok(None) => log::warn!(
                            "[startup] restore point skipped — System Restore may be unavailable on this machine"
                        ),
                        Err(e) => log::error!("[startup] restore point error: {e}"),
                    }
                });
            }

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
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {}
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
            commands::restore::startup_restore_checkpoint,
            commands::process_lasso::start_pro_balance,
            commands::process_lasso::stop_pro_balance,
            commands::process_lasso::pro_balance_status,
            commands::discord::discord_login,
            commands::discord::discord_logout,
            commands::discord::discord_cached_token,
            commands::updater::check_for_update,
            commands::updater::perform_update,
            commands::env::env_info,
            commands::misc::open_downloads,
            commands::task_manager::scan_task_manager,
            commands::task_manager::kill_app,
            commands::task_manager::disable_startup_app,
            commands::task_manager::get_startup_value,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Opti Gods");
}
