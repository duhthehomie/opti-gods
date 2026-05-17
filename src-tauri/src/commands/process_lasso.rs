// Process Lasso replacement.
//
// A background Tokio task enumerates processes every POLL_INTERVAL_MS and:
//   * When a whitelisted game .exe is running, lowers the priority of every
//     non-whitelisted user-mode process to BELOW_NORMAL (the original
//     ProBalance behaviour).
//   * Boosts the game process to HIGH priority + applies the configured
//     affinity / IO priority overrides.
//
// The whitelist is hard-coded for V2 — V3 will pipe it in from the React app
// via a `set_game_whitelist` command so users can edit it without rebuilding.

use crate::state::AppState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::time::sleep;

const POLL_INTERVAL_MS: u64 = 2500;

#[derive(Serialize, Clone, Debug)]
pub struct ProBalanceStatus {
    pub active: bool,
    pub current_game: Option<String>,
    pub processes_throttled: u32,
}

// Hard-coded subset of the React app's GAME_WHITELIST (kept short for V2
// since the bridge can repush the full list on launch).
const GAME_EXES: &[&str] = &[
    "VALORANT-Win64-Shipping.exe",
    "cs2.exe",
    "csgo.exe",
    "r5apex.exe",
    "r5apex_dx12.exe",
    "ModernWarfare.exe",
    "BlackOps6.exe",
    "warzone.exe",
    "RainbowSix.exe",
    "RainbowSix_Vulkan.exe",
    "Overwatch.exe",
    "FortniteClient-Win64-Shipping.exe",
    "EscapeFromTarkov.exe",
    "TslGame.exe",
    "BattleBit.exe",
    "FinalsClient-Win64-Shipping.exe",
    "Marvel-Win64-Shipping.exe",
    "FiveM_GTAProcess.exe",
    "FiveM.exe",
    "GTA5.exe",
    "GTA5_Enhanced.exe",
];

#[tauri::command]
pub fn start_pro_balance(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.pro_balance_active.store(true, Ordering::SeqCst);
    log::info!("[process_lasso] ProBalance ENABLED");
    Ok(())
}

#[tauri::command]
pub fn stop_pro_balance(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.pro_balance_active.store(false, Ordering::SeqCst);
    log::info!("[process_lasso] ProBalance DISABLED");
    Ok(())
}

#[tauri::command]
pub fn pro_balance_status(app: AppHandle) -> ProBalanceStatus {
    #[cfg(windows)]
    {
        let state = app.state::<AppState>();
        let active = state.pro_balance_active.load(Ordering::SeqCst);
        let current_game = crate::win32::processes::find_running(GAME_EXES);
        ProBalanceStatus {
            active,
            current_game,
            processes_throttled: 0,
        }
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        ProBalanceStatus {
            active: false,
            current_game: None,
            processes_throttled: 0,
        }
    }
}

/// Background loop owned by lib.rs::run() — runs for the lifetime of the
/// process. Only does anything when `pro_balance_active == true` AND a
/// whitelisted game .exe is currently running.
pub async fn run_forever(app: AppHandle) -> anyhow::Result<()> {
    loop {
        sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
        let state = app.state::<AppState>();
        if !state.pro_balance_active.load(Ordering::SeqCst) {
            continue;
        }
        #[cfg(windows)]
        {
            if let Some(game) = crate::win32::processes::find_running(GAME_EXES) {
                if let Err(err) = crate::win32::processes::apply_pro_balance(&game, GAME_EXES) {
                    log::warn!("[process_lasso] apply_pro_balance({game}) failed: {err:#}");
                }
            }
        }
    }
}
