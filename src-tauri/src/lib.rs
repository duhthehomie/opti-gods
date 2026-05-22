// Opti Gods desktop — Tauri 2.x entrypoint.

mod commands;
mod state;

#[cfg(windows)]
mod win32;

use tauri::Manager;

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state::AppState::default())
        .setup(|_app| {
            Ok(())
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
            commands::misc::open_downloads,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Opti Gods");
}
