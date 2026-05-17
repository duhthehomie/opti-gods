// Shared application state managed by Tauri (`app.manage(AppState::default())`).
// Holds the ProBalance worker's run/stop flag plus the Discord token cache.

use parking_lot::Mutex;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

#[derive(Default)]
pub struct AppState {
    /// When true, the ProBalance background loop applies priority overrides.
    /// Toggled by `commands::process_lasso::{start_pro_balance, stop_pro_balance}`.
    pub pro_balance_active: AtomicBool,
    /// In-memory mirror of the keyring-cached Discord access token. Kept so
    /// hot paths (entitlement re-checks) don't hit the OS credential store.
    pub discord_token: Mutex<Option<DiscordSession>>,
}

#[derive(Clone, Debug)]
pub struct DiscordSession {
    pub access_token: String,
    pub user_id: String,
    pub username: String,
    pub expires_at_unix: i64,
}

pub type SharedState = Arc<AppState>;
