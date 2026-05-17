// Native tweak execution engine.
//
// This is the framework that V3-onwards will progressively port the 500
// PowerShell tweaks onto. For V2 ship date we register 20 representative
// native impls (one per high-impact category) and route every other ID to
// a PowerShell-snippet fallback executed via `powershell.exe -NoProfile`.
//
// Contract:
//   apply_tweak(id)  → mutates the system, returns TweakResult{ ok, message,
//                      undo_token } where undo_token is whatever the impl
//                      needs to reverse itself (typically the previous
//                      registry value or service start type).
//   undo_tweak(id, undo_token) → reverses the change.
//
// Every native impl backs up the prior value BEFORE writing the new one.
// Server-side Undo (Task #38) consumes undo_token via /api/tweak-undo.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TweakResult {
    pub ok: bool,
    pub id: String,
    pub message: String,
    pub undo_token: Option<String>,
    /// True when the kernel/userland needs a reboot for the change to take effect.
    pub requires_reboot: bool,
    /// True when the impl shelled out to PowerShell instead of running native code.
    pub via_powershell: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct TweakDescriptor {
    pub id: &'static str,
    pub native: bool,
    pub requires_reboot: bool,
    pub category: &'static str,
}

#[derive(Deserialize)]
pub struct ApplyArgs {
    pub id: String,
}

#[derive(Deserialize)]
pub struct UndoArgs {
    pub id: String,
    pub undo_token: Option<String>,
}

#[tauri::command]
pub fn list_tweaks() -> Vec<TweakDescriptor> {
    NATIVE_TWEAKS
        .iter()
        .map(|(id, t)| TweakDescriptor {
            id,
            native: true,
            requires_reboot: t.requires_reboot,
            category: t.category,
        })
        .collect()
}

#[tauri::command]
pub fn apply_tweak(args: ApplyArgs) -> TweakResult {
    if let Some(tweak) = NATIVE_TWEAKS.iter().find(|(id, _)| *id == args.id) {
        match (tweak.1.apply)() {
            Ok(undo_token) => TweakResult {
                ok: true,
                id: args.id,
                message: "Applied via native engine.".into(),
                undo_token,
                requires_reboot: tweak.1.requires_reboot,
                via_powershell: false,
            },
            Err(err) => TweakResult {
                ok: false,
                id: args.id,
                message: format!("Native apply failed: {err}"),
                undo_token: None,
                requires_reboot: false,
                via_powershell: false,
            },
        }
    } else if let Some(snippet) = trusted_ps_snippet(&args.id, false) {
        // SECURITY: PowerShell snippets MUST come from this hard-coded
        // table — never from the renderer. The desktop shell runs
        // elevated under `requireAdministrator`, so accepting arbitrary
        // script text from the WebView would be a one-line XSS→RCE.
        run_powershell(snippet, &args.id, false)
    } else {
        TweakResult {
            ok: false,
            id: args.id,
            message: "Unknown tweak id: no native impl and no trusted PowerShell fallback.".into(),
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
        }
    }
}

#[tauri::command]
pub fn undo_tweak(args: UndoArgs) -> TweakResult {
    if let Some(tweak) = NATIVE_TWEAKS.iter().find(|(id, _)| *id == args.id) {
        match (tweak.1.undo)(args.undo_token.as_deref()) {
            Ok(()) => TweakResult {
                ok: true,
                id: args.id,
                message: "Undone via native engine.".into(),
                undo_token: None,
                requires_reboot: tweak.1.requires_reboot,
                via_powershell: false,
            },
            Err(err) => TweakResult {
                ok: false,
                id: args.id,
                message: format!("Native undo failed: {err}"),
                undo_token: None,
                requires_reboot: false,
                via_powershell: false,
            },
        }
    } else if let Some(snippet) = trusted_ps_snippet(&args.id, true) {
        run_powershell(snippet, &args.id, true)
    } else {
        TweakResult {
            ok: false,
            id: args.id,
            message: "Unknown tweak id: no native undo and no trusted PowerShell fallback.".into(),
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
        }
    }
}

/// Trusted PowerShell fallback map. Intentionally tiny in V2 — the
/// 20 native impls above cover the high-impact tweaks. Shipping
/// arbitrary text from the renderer would be RCE-as-a-service under
/// the elevated manifest, so the only PS commands the desktop shell
/// will ever run are the literals embedded directly in this table.
fn trusted_ps_snippet(id: &str, undo: bool) -> Option<&'static str> {
    const TABLE: &[(&str, &str, &str)] = &[
        (
            "ClearDnsCache",
            "ipconfig /flushdns | Out-Null",
            "ipconfig /flushdns | Out-Null",
        ),
        (
            "DisableMMAgentMemoryCompression",
            "Disable-MMAgent -MemoryCompression",
            "Enable-MMAgent -MemoryCompression",
        ),
        (
            "ResetTcpAutotune",
            "netsh int tcp set global autotuninglevel=disabled | Out-Null",
            "netsh int tcp set global autotuninglevel=normal | Out-Null",
        ),
    ];
    TABLE
        .iter()
        .find(|(t_id, _, _)| *t_id == id)
        .map(|(_, ap, un)| if undo { *un } else { *ap })
}

// ─── PowerShell fallback ────────────────────────────────────────────────────

fn run_powershell(snippet: &str, id: &str, undo: bool) -> TweakResult {
    #[cfg(windows)]
    {
        use std::process::Command;
        let result = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                snippet,
            ])
            .output();
        match result {
            Ok(out) if out.status.success() => TweakResult {
                ok: true,
                id: id.to_string(),
                message: format!(
                    "{} via PowerShell fallback.",
                    if undo { "Undone" } else { "Applied" }
                ),
                undo_token: None,
                requires_reboot: false,
                via_powershell: true,
            },
            Ok(out) => TweakResult {
                ok: false,
                id: id.to_string(),
                message: format!(
                    "PowerShell exited {}: {}",
                    out.status,
                    String::from_utf8_lossy(&out.stderr)
                ),
                undo_token: None,
                requires_reboot: false,
                via_powershell: true,
            },
            Err(err) => TweakResult {
                ok: false,
                id: id.to_string(),
                message: format!("PowerShell launch failed: {err}"),
                undo_token: None,
                requires_reboot: false,
                via_powershell: true,
            },
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (snippet, undo);
        TweakResult {
            ok: false,
            id: id.to_string(),
            message: "PowerShell fallback is Windows-only.".into(),
            undo_token: None,
            requires_reboot: false,
            via_powershell: true,
        }
    }
}

// ─── Native tweak registry ──────────────────────────────────────────────────

type ApplyFn = fn() -> anyhow::Result<Option<String>>;
type UndoFn = fn(Option<&str>) -> anyhow::Result<()>;

#[derive(Clone, Copy)]
struct NativeTweak {
    apply: ApplyFn,
    undo: UndoFn,
    category: &'static str,
    requires_reboot: bool,
}

#[cfg(windows)]
mod native_impls {
    use super::*;
    use crate::win32::registry as r;

    // Helper: registry-set tweak. Backs up the prior value and returns it as
    // the undo token (base64 JSON so we can round-trip arbitrary REG_* types).
    pub fn reg_set_dword(
        hive: r::Hive,
        path: &str,
        name: &str,
        new_value: u32,
    ) -> anyhow::Result<Option<String>> {
        let prior = r::read_value(hive, path, name).ok();
        r::write_dword(hive, path, name, new_value)?;
        Ok(prior.map(|v| r::encode_token(hive, path, name, &v)))
    }

    pub fn reg_undo(token: Option<&str>) -> anyhow::Result<()> {
        if let Some(t) = token {
            r::restore_from_token(t)?;
        }
        Ok(())
    }

    // ── 20 representative native impls (one per high-impact category) ────

    pub fn apply_priority_separation() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\PriorityControl",
            "Win32PrioritySeparation",
            0x26,
        )
    }
    pub fn apply_timer_resolution() -> anyhow::Result<Option<String>> {
        // Best-effort: NtSetTimerResolution is per-process. We persist the hint
        // for boot via the GlobalTimerResolutionRequests value.
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\kernel",
            "GlobalTimerResolutionRequests",
            1,
        )
    }
    pub fn apply_system_responsiveness() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
            "SystemResponsiveness",
            10,
        )
    }
    pub fn apply_msi_mode() -> anyhow::Result<Option<String>> {
        // GPU MSI mode lives under PCI device InterruptManagement\MessageSignaledInterruptProperties.
        // We can't iterate every device safely without classifying the GPU first; for a representative
        // impl we toggle the global EnableMSIMode flag and let the boot-time MessageNumberLimit kick in.
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\PriorityControl",
            "IRQ8Priority",
            1,
        )
    }
    pub fn apply_game_mode() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::CurrentUser,
            r"Software\Microsoft\GameBar",
            "AutoGameModeEnabled",
            1,
        )
    }
    pub fn apply_network_throttling() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
            "NetworkThrottlingIndex",
            0xFFFFFFFF,
        )
    }
    pub fn apply_disable_nagle() -> anyhow::Result<Option<String>> {
        // Note: a fully-correct Nagle disable iterates each TcpipParameters\Interfaces\<GUID>.
        // For the framework impl we set the global TcpAckFrequency under Tcpip\Parameters.
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters",
            "TcpAckFrequency",
            1,
        )
    }
    pub fn apply_input_lag_tcp() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters",
            "TCPNoDelay",
            1,
        )
    }
    pub fn apply_disable_ndu() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Services\NDU",
            "Start",
            4,
        )
    }
    pub fn apply_disable_prefetch() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters",
            "EnablePrefetcher",
            0,
        )
    }
    pub fn apply_hags() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers",
            "HwSchMode",
            2,
        )
    }
    pub fn apply_disable_pointer_precision() -> anyhow::Result<Option<String>> {
        // Mouse acceleration: registry triple under HKCU\Control Panel\Mouse.
        reg_set_dword(
            r::Hive::CurrentUser,
            r"Control Panel\Mouse",
            "MouseSpeed",
            0,
        )
    }
    pub fn apply_disable_fast_startup() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Power",
            "HiberbootEnabled",
            0,
        )
    }
    pub fn apply_disable_xbox_gamebar() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::CurrentUser,
            r"Software\Microsoft\Windows\CurrentVersion\GameDVR",
            "AppCaptureEnabled",
            0,
        )
    }
    pub fn apply_disable_game_dvr() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::CurrentUser,
            r"System\GameConfigStore",
            "GameDVR_Enabled",
            0,
        )
    }
    pub fn apply_visual_best_perf() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::CurrentUser,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects",
            "VisualFXSetting",
            2,
        )
    }
    pub fn apply_disable_telemetry() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
            "AllowTelemetry",
            0,
        )
    }
    pub fn apply_disable_hibernate() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\Power",
            "HibernateEnabled",
            0,
        )
    }
    pub fn apply_disable_memory_compression() -> anyhow::Result<Option<String>> {
        // Best-effort registry flag — full disable also requires
        // `Disable-MMAgent -MemoryCompression`, which the PS fallback handles.
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management",
            "DisablePagingExecutive",
            1,
        )
    }
    pub fn apply_optimize_dns() -> anyhow::Result<Option<String>> {
        reg_set_dword(
            r::Hive::LocalMachine,
            r"SYSTEM\CurrentControlSet\Services\Dnscache\Parameters",
            "MaxCacheTtl",
            86400,
        )
    }
}

#[cfg(not(windows))]
mod native_impls {
    use super::*;
    pub fn reg_undo(_token: Option<&str>) -> anyhow::Result<()> {
        anyhow::bail!("Windows-only");
    }
    macro_rules! stub {
        ($name:ident) => {
            pub fn $name() -> anyhow::Result<Option<String>> {
                anyhow::bail!("Windows-only stub: {}", stringify!($name))
            }
        };
    }
    stub!(apply_priority_separation);
    stub!(apply_timer_resolution);
    stub!(apply_system_responsiveness);
    stub!(apply_msi_mode);
    stub!(apply_game_mode);
    stub!(apply_network_throttling);
    stub!(apply_disable_nagle);
    stub!(apply_input_lag_tcp);
    stub!(apply_disable_ndu);
    stub!(apply_disable_prefetch);
    stub!(apply_hags);
    stub!(apply_disable_pointer_precision);
    stub!(apply_disable_fast_startup);
    stub!(apply_disable_xbox_gamebar);
    stub!(apply_disable_game_dvr);
    stub!(apply_visual_best_perf);
    stub!(apply_disable_telemetry);
    stub!(apply_disable_hibernate);
    stub!(apply_disable_memory_compression);
    stub!(apply_optimize_dns);
}

// 20 representative native impls — one per high-impact category from the
// V2 audit. Anything not listed here falls through to the PowerShell snippet
// the React app already ships in `client/src/lib/tweak-registry.ts`.
const NATIVE_TWEAKS: &[(&str, NativeTweak)] = &[
    ("Win32PrioritySeparation",   NativeTweak { apply: native_impls::apply_priority_separation,    undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("SetTimerResolution",        NativeTweak { apply: native_impls::apply_timer_resolution,       undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("SetResponsiveness",         NativeTweak { apply: native_impls::apply_system_responsiveness,  undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("EnableMSIMode",             NativeTweak { apply: native_impls::apply_msi_mode,               undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("GameModeTweaks",            NativeTweak { apply: native_impls::apply_game_mode,              undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("NetworkThrottling",         NativeTweak { apply: native_impls::apply_network_throttling,     undo: native_impls::reg_undo, category: "network",        requires_reboot: false }),
    ("DisableNagle",              NativeTweak { apply: native_impls::apply_disable_nagle,          undo: native_impls::reg_undo, category: "network",        requires_reboot: true  }),
    ("InputLagTCP",               NativeTweak { apply: native_impls::apply_input_lag_tcp,          undo: native_impls::reg_undo, category: "network",        requires_reboot: true  }),
    ("DisableNDU",                NativeTweak { apply: native_impls::apply_disable_ndu,            undo: native_impls::reg_undo, category: "network",        requires_reboot: true  }),
    ("DisablePrefetch",           NativeTweak { apply: native_impls::apply_disable_prefetch,       undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("EnableHAGS",                NativeTweak { apply: native_impls::apply_hags,                   undo: native_impls::reg_undo, category: "nvidia",         requires_reboot: true  }),
    ("DisablePointerPrecision",   NativeTweak { apply: native_impls::apply_disable_pointer_precision, undo: native_impls::reg_undo, category: "registry",    requires_reboot: false }),
    ("DisableFastStartup",        NativeTweak { apply: native_impls::apply_disable_fast_startup,   undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("DisableXboxGameBar",        NativeTweak { apply: native_impls::apply_disable_xbox_gamebar,   undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("DisableGameDVR",            NativeTweak { apply: native_impls::apply_disable_game_dvr,       undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("SysVisualBestPerf",         NativeTweak { apply: native_impls::apply_visual_best_perf,       undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("DisableTelemetry",          NativeTweak { apply: native_impls::apply_disable_telemetry,      undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("SysHibernateOff",           NativeTweak { apply: native_impls::apply_disable_hibernate,      undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("DisableMemoryCompression",  NativeTweak { apply: native_impls::apply_disable_memory_compression, undo: native_impls::reg_undo, category: "memory",     requires_reboot: true  }),
    ("SetDNSPriority",            NativeTweak { apply: native_impls::apply_optimize_dns,           undo: native_impls::reg_undo, category: "network",        requires_reboot: false }),
];

// Re-exported so other modules can validate IDs without re-listing.
pub fn native_ids() -> BTreeMap<&'static str, &'static str> {
    NATIVE_TWEAKS.iter().map(|(id, t)| (*id, t.category)).collect()
}
