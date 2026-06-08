// Tauri command surface — every #[tauri::command] the React app can call.
// Each module is self-contained and returns serde-serialisable results.

pub mod discord;
pub mod env;
pub mod hardware;
pub mod misc;
pub mod process_lasso;
pub mod restore;
pub mod splash;
pub mod task_manager;
pub mod tweaks;
pub mod updater;
