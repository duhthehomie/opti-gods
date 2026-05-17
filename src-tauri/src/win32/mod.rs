// Win32 + WMI helpers. Everything in this module is gated behind
// `#[cfg(windows)]` at the call sites in `commands::*`, so on non-Windows
// builds (the Linux CI container that builds the React bundle) these
// modules simply don't compile.

pub mod elevation;
pub mod processes;
pub mod registry;
pub mod restore;
pub mod wmi_scan;
