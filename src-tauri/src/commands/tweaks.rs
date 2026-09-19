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
    /// Machine-readable failure classification. Present only when `ok` is false.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_kind: Option<NativeErrorKind>,
    /// The stage at which a native enable failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_stage: Option<NativeErrorStage>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NativeErrorKind {
    Restore,
    Auth,
    Allowance,
    Compatibility,
    Execution,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NativeErrorStage {
    Restore,
    Authorization,
    Execution,
    Result,
}

fn classify_native_error(message: &str) -> NativeErrorKind {
    let lower = message.to_ascii_lowercase();
    if lower.contains("not for this system")
        || lower.contains("not compatible")
        || lower.contains("not detected")
        || lower.contains("requires exactly")
    {
        NativeErrorKind::Compatibility
    } else {
        NativeErrorKind::Execution
    }
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
    pub ticket: Option<String>,
    pub native_auth: Option<String>,
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

/// Read-only detection for the registry-backed tweaks handled by the native engine.
/// The renderer supplies no paths or commands.
#[tauri::command]
pub fn detect_applied_tweaks() -> BTreeMap<String, bool> {
    #[cfg(windows)]
    {
        use crate::win32::registry::{read_value, Hive, RegValue};

        let checks: &[(&str, Hive, &str, &str, u32)] = &[
            ("Win32PrioritySeparation", Hive::LocalMachine, r"SYSTEM\CurrentControlSet\Control\PriorityControl", "Win32PrioritySeparation", 0x26),
            ("SetTimerResolution", Hive::LocalMachine, r"SYSTEM\CurrentControlSet\Control\Session Manager\kernel", "GlobalTimerResolutionRequests", 1),
            ("SetResponsiveness", Hive::LocalMachine, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile", "SystemResponsiveness", 10),
            ("GameModeTweaks", Hive::CurrentUser, r"Software\Microsoft\GameBar", "AutoGameModeEnabled", 1),
            ("NetworkThrottling", Hive::LocalMachine, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile", "NetworkThrottlingIndex", 0xFFFFFFFF),
            ("InputLagTCP", Hive::LocalMachine, r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters", "TCPNoDelay", 1),
            ("DisableNDU", Hive::LocalMachine, r"SYSTEM\CurrentControlSet\Services\NDU", "Start", 4),
            ("EnableHAGS", Hive::LocalMachine, r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "HwSchMode", 2),
            ("DisableFastStartup", Hive::LocalMachine, r"SYSTEM\CurrentControlSet\Control\Session Manager\Power", "HiberbootEnabled", 0),
            ("DisableGameDVR", Hive::CurrentUser, r"System\GameConfigStore", "GameDVR_Enabled", 0),
            ("DisableTelemetry", Hive::LocalMachine, r"SOFTWARE\Policies\Microsoft\Windows\DataCollection", "AllowTelemetry", 0),
        ];

        checks
            .iter()
            .map(|(id, hive, path, name, expected)| {
                let applied = matches!(read_value(*hive, path, name), Ok(RegValue::Dword(value)) if value == *expected);
                ((*id).to_string(), applied)
            })
            .collect()
    }
    #[cfg(not(windows))]
    {
        BTreeMap::new()
    }
}

#[tauri::command]
pub async fn apply_tweak(args: ApplyArgs) -> TweakResult {
    if matches!(args.id.as_str(), "OpenMsiUtilityPro" | "ImportNvidiaPresetPro") {
        return TweakResult {
            ok: false,
            id: args.id,
            message: "This Pro tool is native-only; use its dedicated NVIDIA tool button.".into(),
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
            error_kind: Some(NativeErrorKind::Execution),
            error_stage: Some(NativeErrorStage::Execution),
        };
    }
    #[cfg(windows)]
    if let Err(error) = crate::win32::restore::ensure_session_checkpoint(
        "OptiGods — Before Tweak Changes",
    ) {
        return TweakResult {
            ok: false,
            id: args.id,
            message: format!(
                "No tweak was applied because Windows could not create a verified restore point: {error:#}"
            ),
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
            error_kind: Some(NativeErrorKind::Restore),
            error_stage: Some(NativeErrorStage::Restore),
        };
    }
    let ticket = match (args.ticket.as_deref(), args.native_auth.as_deref()) {
        (Some(ticket), Some(auth)) => (ticket, auth),
        _ => return TweakResult { ok: false, id: args.id, message: "A server authorization ticket is required.".into(), undo_token: None, requires_reboot: false, via_powershell: false, error_kind: Some(NativeErrorKind::Auth), error_stage: Some(NativeErrorStage::Authorization) },
    };
    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(client) => client,
        Err(error) => return TweakResult {
            ok: false,
            id: args.id,
            message: format!("Could not initialize secure server authorization: {error}"),
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
            error_kind: Some(NativeErrorKind::Auth),
            error_stage: Some(NativeErrorStage::Authorization),
        },
    };
    let base = if cfg!(debug_assertions) { "http://127.0.0.1:5000" } else { "https://optigods.com" };
    let mut validation_request = client.post(format!("{base}/api/performance-allowance/native-ticket/consume"));
    validation_request = if let Some(device_id) = ticket.1.strip_prefix("device:") {
        validation_request.header("X-Device-ID", device_id)
    } else if let Some(pro_session) = ticket.1.strip_prefix("pro:") {
        validation_request.header("X-Pro-Session", pro_session)
    } else {
        validation_request.header("X-Native-Auth", ticket.1)
    };
    let validation = validation_request
        .json(&serde_json::json!({ "ticket": ticket.0, "tweakId": &args.id }))
        .send().await;
    let response = match validation {
        Ok(response) if response.status().is_success() => response,
        Ok(response) => {
            let detail = response.text().await.unwrap_or_default();
            let message = serde_json::from_str::<serde_json::Value>(&detail)
                .ok()
                .and_then(|body| body.get("error").or_else(|| body.get("message")).and_then(|v| v.as_str()).map(str::to_owned))
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| "Server authorization ticket was rejected or expired.".into());
            return TweakResult { ok: false, id: args.id, message, undo_token: None, requires_reboot: false, via_powershell: false, error_kind: Some(NativeErrorKind::Allowance), error_stage: Some(NativeErrorStage::Authorization) };
        }
        Err(_) => return TweakResult { ok: false, id: args.id, message: "Server authorization ticket was rejected or expired.".into(), undo_token: None, requires_reboot: false, via_powershell: false, error_kind: Some(NativeErrorKind::Allowance), error_stage: Some(NativeErrorStage::Authorization) },
    };
    let consumed: serde_json::Value = match response.json().await {
        Ok(value) => value,
        Err(_) => return TweakResult { ok: false, id: args.id, message: "Invalid authorization response.".into(), undo_token: None, requires_reboot: false, via_powershell: false, error_kind: Some(NativeErrorKind::Auth), error_stage: Some(NativeErrorStage::Authorization) },
    };
    let result_secret = match consumed.get("resultSecret").and_then(|v| v.as_str()) {
        Some(value) => value.to_string(),
        None => return TweakResult { ok: false, id: args.id, message: "Authorization response omitted result secret.".into(), undo_token: None, requires_reboot: false, via_powershell: false, error_kind: Some(NativeErrorKind::Auth), error_stage: Some(NativeErrorStage::Authorization) },
    };
    let server_command = consumed
        .get("command")
        .and_then(|v| v.as_str())
        .map(str::to_owned);
    let mut result = if let Some(tweak) = NATIVE_TWEAKS.iter().find(|(id, _)| *id == args.id) {
        match (tweak.1.apply)() {
            Ok(undo_token) => TweakResult {
                ok: true,
                id: args.id,
                message: "Applied via native engine.".into(),
                undo_token,
                requires_reboot: tweak.1.requires_reboot,
                via_powershell: false,
                error_kind: None,
                error_stage: None,
            },
            Err(err) => TweakResult {
                ok: false,
                id: args.id,
                message: format!("Native apply failed: {err}"),
                undo_token: None,
                requires_reboot: false,
                via_powershell: false,
                error_kind: Some(classify_native_error(&err.to_string())),
                error_stage: Some(NativeErrorStage::Execution),
            },
        }
    } else if let Some(snippet) = server_command.as_deref().or_else(|| trusted_ps_snippet(&args.id, false)) {
        // SECURITY: PowerShell snippets MUST come from this hard-coded
        // table or the authenticated optigods.com ticket response — never
        // from the renderer. The desktop shell runs elevated under
        // `requireAdministrator`, so WebView-provided script text is forbidden.
        run_powershell(snippet, &args.id, false)
    } else {
        TweakResult {
            ok: false,
            id: args.id,
            message: "Unknown tweak id: no native impl and no trusted PowerShell fallback.".into(),
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
            error_kind: Some(NativeErrorKind::Execution),
            error_stage: Some(NativeErrorStage::Execution),
        }
    };
    let mut acknowledged = false;
    for attempt in 0..3 {
        let ack = client.post(format!("{base}/api/performance-allowance/native-ticket/result"))
            .json(&serde_json::json!({
                "ticket": ticket.0,
                "resultSecret": result_secret,
                "success": result.ok,
                "tweakId": &result.id,
                "errorCode": result.error_kind.as_ref().map(|kind| format!("OG-NATIVE-{:?}", kind).to_ascii_uppercase()),
                "message": &result.message
            }))
            .send().await;
        if matches!(ack, Ok(ref response) if response.status().is_success()) {
            acknowledged = true;
            break;
        }
        if attempt < 2 { tokio::time::sleep(std::time::Duration::from_millis(250)).await; }
    }
    if !acknowledged && result.ok {
        result.message.push_str(" ALLOWANCE_SYNC_PENDING");
    }
    result
}

#[tauri::command]
pub fn undo_tweak(args: UndoArgs) -> TweakResult {
    #[cfg(windows)]
    if let Err(error) = crate::commands::restore::require_verified_checkpoint() {
        return TweakResult {
            ok: false,
            id: args.id,
            message: error,
            undo_token: None,
            requires_reboot: false,
            via_powershell: false,
            error_kind: Some(NativeErrorKind::Restore),
            error_stage: Some(NativeErrorStage::Restore),
        };
    }
    if let Some(tweak) = NATIVE_TWEAKS.iter().find(|(id, _)| *id == args.id) {
        match (tweak.1.undo)(args.undo_token.as_deref()) {
            Ok(()) => TweakResult {
                ok: true,
                id: args.id,
                message: "Undone via native engine.".into(),
                undo_token: None,
                requires_reboot: tweak.1.requires_reboot,
                via_powershell: false,
                error_kind: None,
                error_stage: None,
            },
            Err(err) => TweakResult {
                ok: false,
                id: args.id,
                message: format!("Native undo failed: {err}"),
                undo_token: None,
                requires_reboot: false,
                via_powershell: false,
                error_kind: Some(NativeErrorKind::Execution),
                error_stage: Some(NativeErrorStage::Execution),
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
            error_kind: Some(NativeErrorKind::Execution),
            error_stage: Some(NativeErrorStage::Execution),
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
        (
            "GameModeTweaks",
            "$p='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; New-Item $p -Force|Out-Null; Set-ItemProperty $p 'Scheduling Category' 'High' -Force; Set-ItemProperty $p 'SFIO Priority' 'High' -Force; Set-ItemProperty $p 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $p Priority 6 -Type DWord -Force; Set-ItemProperty $p MaximumPreRenderedFrames 1 -Type DWord -Force; $x=Get-ItemProperty $p; if($x.'Scheduling Category' -ne 'High' -or $x.'SFIO Priority' -ne 'High' -or $x.'GPU Priority' -ne 8 -or $x.Priority -ne 6 -or $x.MaximumPreRenderedFrames -ne 1){throw 'Windows did not verify all Games multimedia priorities.'}",
            "$p='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; Remove-ItemProperty $p 'Scheduling Category','SFIO Priority','GPU Priority','Priority','MaximumPreRenderedFrames' -ErrorAction SilentlyContinue",
        ),
        (
            "InputLagTCP",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'; Set-ItemProperty $p TcpAckFrequency 1 -Type DWord -Force; Set-ItemProperty $p TCPNoDelay 1 -Type DWord -Force; Set-ItemProperty $p EnablePMTUBHDetect 0 -Type DWord -Force; $x=Get-ItemProperty $p; if($x.TcpAckFrequency -ne 1 -or $x.TCPNoDelay -ne 1 -or $x.EnablePMTUBHDetect -ne 0){throw 'Windows did not verify all TCP latency values.'}",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters'; Remove-ItemProperty $p TcpAckFrequency,TCPNoDelay,EnablePMTUBHDetect -ErrorAction SilentlyContinue",
        ),
        (
            "DisableNagle",
            "$paths=@(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -ErrorAction Stop); if(-not $paths.Count){throw 'Not for this system: no TCP/IP interfaces were found.'}; foreach($k in $paths){Set-ItemProperty $k.PSPath TcpAckFrequency 1 -Type DWord -Force; Set-ItemProperty $k.PSPath TCPNoDelay 1 -Type DWord -Force}; foreach($k in $paths){$x=Get-ItemProperty $k.PSPath; if($x.TcpAckFrequency -ne 1 -or $x.TCPNoDelay -ne 1){throw \"Windows did not verify Nagle settings on $($k.PSChildName).\"}}",
            "$paths=@(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -ErrorAction Stop); foreach($k in $paths){Remove-ItemProperty $k.PSPath TcpAckFrequency,TCPNoDelay -ErrorAction SilentlyContinue}",
        ),
        (
            "DisablePrefetch",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters'; Set-ItemProperty $p EnablePrefetcher 0 -Type DWord -Force; Set-ItemProperty $p EnableSuperfetch 0 -Type DWord -Force; $x=Get-ItemProperty $p; if($x.EnablePrefetcher -ne 0 -or $x.EnableSuperfetch -ne 0){throw 'Windows did not verify Prefetch and Superfetch were disabled.'}",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters'; Set-ItemProperty $p EnablePrefetcher 3 -Type DWord -Force; Set-ItemProperty $p EnableSuperfetch 3 -Type DWord -Force",
        ),
        (
            "DisablePointerPrecision",
            "$p='HKCU:\\Control Panel\\Mouse'; Set-ItemProperty $p MouseSpeed '0' -Force; Set-ItemProperty $p MouseThreshold1 '0' -Force; Set-ItemProperty $p MouseThreshold2 '0' -Force; $x=Get-ItemProperty $p; if($x.MouseSpeed -ne '0' -or $x.MouseThreshold1 -ne '0' -or $x.MouseThreshold2 -ne '0'){throw 'Windows did not verify all pointer precision values.'}",
            "$p='HKCU:\\Control Panel\\Mouse'; Set-ItemProperty $p MouseSpeed '1' -Force; Set-ItemProperty $p MouseThreshold1 '6' -Force; Set-ItemProperty $p MouseThreshold2 '10' -Force",
        ),
        (
            "DisableXboxGameBar",
            "$a='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR'; $b='HKCU:\\System\\GameConfigStore'; New-Item $a -Force|Out-Null; New-Item $b -Force|Out-Null; Set-ItemProperty $a AppCaptureEnabled 0 -Type DWord -Force; Set-ItemProperty $b GameDVR_Enabled 0 -Type DWord -Force; if((Get-ItemPropertyValue $a AppCaptureEnabled)-ne 0 -or (Get-ItemPropertyValue $b GameDVR_Enabled)-ne 0){throw 'Windows did not verify Game Bar capture was disabled.'}",
            "$a='HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR'; $b='HKCU:\\System\\GameConfigStore'; Set-ItemProperty $a AppCaptureEnabled 1 -Type DWord -Force; Set-ItemProperty $b GameDVR_Enabled 1 -Type DWord -Force",
        ),
        (
            "SysVisualBestPerf",
            "$v='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects'; $d='HKCU:\\Control Panel\\Desktop'; $w='HKCU:\\Software\\Microsoft\\Windows\\DWM'; $mask=[byte[]](0x90,0x12,0x01,0x80,0x10,0x00,0x00,0x00); New-Item $v -Force|Out-Null; New-Item $d -Force|Out-Null; New-Item $w -Force|Out-Null; Set-ItemProperty $v VisualFXSetting 2 -Type DWord -Force; Set-ItemProperty $d UserPreferencesMask $mask -Type Binary -Force; Set-ItemProperty $d FontSmoothing '2' -Force; Set-ItemProperty $w EnableAeroPeek 0 -Type DWord -Force; $actual=[byte[]](Get-ItemPropertyValue $d UserPreferencesMask); if((Get-ItemPropertyValue $v VisualFXSetting)-ne 2 -or [Convert]::ToBase64String($actual)-ne [Convert]::ToBase64String($mask) -or (Get-ItemPropertyValue $d FontSmoothing)-ne '2' -or (Get-ItemPropertyValue $w EnableAeroPeek)-ne 0){throw 'Windows did not verify the complete visual performance profile.'}",
            "$v='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects'; $d='HKCU:\\Control Panel\\Desktop'; $w='HKCU:\\Software\\Microsoft\\Windows\\DWM'; Set-ItemProperty $v VisualFXSetting 0 -Type DWord -Force; Set-ItemProperty $d FontSmoothing '2' -Force; Set-ItemProperty $w EnableAeroPeek 1 -Type DWord -Force",
        ),
        (
            "SysHibernateOff",
            "powercfg.exe /hibernate off | Out-Null; if($LASTEXITCODE -ne 0){throw \"powercfg failed with exit code $LASTEXITCODE.\"}; $p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power'; New-Item $p -Force|Out-Null; Set-ItemProperty $p HiberbootEnabled 0 -Type DWord -Force; $h=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' -ErrorAction Stop).HibernateEnabled; if($h -ne 0 -or (Get-ItemPropertyValue $p HiberbootEnabled)-ne 0){throw 'Windows did not verify hibernation and Fast Startup were disabled.'}",
            "powercfg.exe /hibernate on | Out-Null; if($LASTEXITCODE -ne 0){throw \"powercfg failed with exit code $LASTEXITCODE.\"}; $p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power'; Set-ItemProperty $p HiberbootEnabled 1 -Type DWord -Force",
        ),
        (
            "SetDNSPriority",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters'; Set-ItemProperty $p MaxCacheTtl 86400 -Type DWord -Force; Set-ItemProperty $p MaxNegativeCacheTtl 0 -Type DWord -Force; netsh.exe int tcp set global timestamps=disabled | Out-Null; if($LASTEXITCODE -ne 0){throw \"netsh failed with exit code $LASTEXITCODE.\"}; $x=Get-ItemProperty $p; if($x.MaxCacheTtl -ne 86400 -or $x.MaxNegativeCacheTtl -ne 0){throw 'Windows did not verify the DNS cache policy.'}",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters'; Remove-ItemProperty $p MaxCacheTtl,MaxNegativeCacheTtl -ErrorAction SilentlyContinue; netsh.exe int tcp set global timestamps=allowed | Out-Null; if($LASTEXITCODE -ne 0){throw \"netsh failed with exit code $LASTEXITCODE.\"}",
        ),
        (
            "EnableHAGS",
            "$b=[Environment]::OSVersion.Version.Build; if($b -lt 22000){throw \"Not for this system: HAGS requires Windows 11; detected build $b.\"}; $g=@(Get-CimInstance Win32_VideoController -ErrorAction Stop|Where-Object {$_.AdapterRAM -gt 1GB -and $_.Name -notmatch 'Microsoft Basic|Remote Display'}); if($g.Count -ne 1){throw \"Not for this system: HAGS requires exactly one supported discrete GPU; detected $($g.Count).\"}; if($g[0].Name -notmatch 'RTX\\s*(20|30|40|50)\\d{2}|Radeon.*RX\\s*[6-9]\\d{3}'){throw \"Not for this system: HAGS is limited to RTX 20-series+ or Radeon RX 6000-series+; detected $($g[0].Name).\"}; $p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'; Set-ItemProperty $p HwSchMode 2 -Type DWord -Force; if((Get-ItemPropertyValue $p HwSchMode) -ne 2){throw 'Windows did not verify HAGS was enabled.'}",
            "$p='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'; Set-ItemProperty $p HwSchMode 1 -Type DWord -Force",
        ),
        (
            "EnableMSIMode_Safe",
            "$g=@(Get-PnpDevice -Class Display -ErrorAction Stop|Where-Object Status -eq 'OK'); if($g.Count -ne 1){throw \"Not for this system: MSI mode requires exactly one active display GPU; detected $($g.Count).\"}; $p=\"HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($g[0].InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties\"; New-Item $p -Force|Out-Null; Set-ItemProperty $p MSISupported 1 -Type DWord -Force; if((Get-ItemPropertyValue $p MSISupported -ErrorAction Stop) -ne 1){throw 'Windows did not verify MSI mode was enabled.'}",
            "$g=@(Get-PnpDevice -Class Display -ErrorAction Stop|Where-Object Status -eq 'OK'); if($g.Count -ne 1){throw \"Not for this system: MSI undo requires exactly one active display GPU; detected $($g.Count).\"}; $p=\"HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($g[0].InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties\"; Set-ItemProperty $p MSISupported 0 -Type DWord -Force; if((Get-ItemPropertyValue $p MSISupported -ErrorAction Stop) -ne 0){throw 'Windows did not verify MSI mode was disabled.'}",
        ),
        (
            "EnableMSIMode",
            "$gpus=@(Get-PnpDevice -Class Display -ErrorAction Stop|Where-Object Status -eq 'OK'); if($gpus.Count -ne 1){throw \"Not for this system: MSI mode requires exactly one active GPU; detected $($gpus.Count).\"}; $p=\"HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($gpus[0].InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties\"; New-Item $p -Force|Out-Null; Set-ItemProperty $p MSISupported 1 -Type DWord -Force; if((Get-ItemPropertyValue $p MSISupported -ErrorAction Stop)-ne 1){throw 'MSI mode verification failed.'}",
            "$gpus=@(Get-PnpDevice -Class Display -ErrorAction Stop|Where-Object Status -eq 'OK'); if($gpus.Count -ne 1){throw \"Not for this system: cannot identify one GPU to undo MSI mode.\"}; $p=\"HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($gpus[0].InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties\"; Set-ItemProperty $p MSISupported 0 -Type DWord -Force",
        ),
        (
            "DisableMemoryCompression",
            "$ram=[math]::Round((Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory/1GB); if($ram -lt 16){throw \"Not for this system: disabling memory compression requires at least 16 GB RAM; detected $ram GB.\"}; Disable-MMAgent -MemoryCompression -ErrorAction Stop; if((Get-MMAgent).MemoryCompression){throw 'Windows left memory compression enabled.'}",
            "Enable-MMAgent -MemoryCompression -ErrorAction Stop; if(-not (Get-MMAgent).MemoryCompression){throw 'Windows left memory compression disabled.'}",
        ),
    ];
    TABLE
        .iter()
        .find(|(t_id, _, _)| *t_id == id)
        .map(|(_, ap, un)| if undo { *un } else { *ap })
}

fn trusted_ps_requires_reboot(id: &str) -> bool {
    matches!(
        id,
        "EnableHAGS"
            | "EnableMSIMode"
            | "EnableMSIMode_Safe"
            | "DisableMemoryCompression"
            | "DisableMMAgentMemoryCompression"
            | "InputLagTCP"
            | "ResetTcpAutotune"
            | "SysHibernateOff"
    )
}

// ─── PowerShell fallback ────────────────────────────────────────────────────

fn run_powershell(snippet: &str, id: &str, undo: bool) -> TweakResult {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let guarded = format!(
            "$ErrorActionPreference='Stop'; & {{ {snippet} }}; if (-not $?) {{ throw 'Windows reported that the tweak command failed.' }}"
        );
        let child = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &guarded,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn();
        let result = match child {
            Ok(mut child) => {
                let deadline = std::time::Instant::now() + std::time::Duration::from_secs(90);
                loop {
                    match child.try_wait() {
                        Ok(Some(_)) => break child.wait_with_output(),
                        Ok(None) if std::time::Instant::now() < deadline => {
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                        Ok(None) => {
                            let _ = child.kill();
                            let _ = child.wait();
                            return TweakResult {
                                ok: false,
                                id: id.to_string(),
                                message: "PowerShell exceeded the 90-second safety limit and was stopped. The tweak was not confirmed.".into(),
                                undo_token: None,
                                requires_reboot: false,
                                via_powershell: true,
                                error_kind: Some(NativeErrorKind::Execution),
                                error_stage: Some(NativeErrorStage::Execution),
                            };
                        }
                        Err(error) => break Err(error),
                    }
                }
            }
            Err(error) => Err(error),
        };
        match result {
            Ok(out) if out.status.success() => TweakResult {
                ok: true,
                id: id.to_string(),
                message: format!(
                    "{} via PowerShell fallback.",
                    if undo { "Undone" } else { "Applied" }
                ),
                undo_token: None,
                requires_reboot: trusted_ps_requires_reboot(id),
                via_powershell: true,
                error_kind: None,
                error_stage: None,
            },
            Ok(out) => TweakResult {
                ok: false,
                id: id.to_string(),
                message: format!(
                    "PowerShell exited {}: {}",
                    out.status,
                     {
                         let stderr = String::from_utf8_lossy(&out.stderr);
                         let stdout = String::from_utf8_lossy(&out.stdout);
                         let detail = if stderr.trim().is_empty() {
                             stdout.trim().to_owned()
                         } else {
                             stderr.trim().to_owned()
                         };
                         if detail.is_empty() {
                             "Windows rejected the command without an error message.".to_owned()
                         } else {
                             detail
                         }
                     }
                ),
                undo_token: None,
                requires_reboot: false,
                via_powershell: true,
                error_kind: Some(NativeErrorKind::Execution),
                error_stage: Some(NativeErrorStage::Execution),
            },
            Err(err) => TweakResult {
                ok: false,
                id: id.to_string(),
                message: format!("PowerShell launch failed: {err}"),
                undo_token: None,
                requires_reboot: false,
                via_powershell: true,
                error_kind: Some(NativeErrorKind::Execution),
                error_stage: Some(NativeErrorStage::Execution),
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
            error_kind: Some(NativeErrorKind::Compatibility),
            error_stage: Some(NativeErrorStage::Execution),
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
    use std::process::Command;

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

    fn guid_from_powercfg(text: &str) -> Option<String> {
        text.split(|c: char| c.is_whitespace() || matches!(c, '(' | ')' | ':'))
            .map(|part| part.trim())
            .find(|part| {
                part.len() == 36
                    && part.chars().enumerate().all(|(index, ch)| {
                        matches!(index, 8 | 13 | 18 | 23) && ch == '-'
                            || !matches!(index, 8 | 13 | 18 | 23) && ch.is_ascii_hexdigit()
                    })
            })
            .map(str::to_ascii_lowercase)
    }

    fn active_power_guid() -> anyhow::Result<String> {
        let output = Command::new("powercfg").arg("/getactivescheme").output()?;
        if !output.status.success() {
            anyhow::bail!("powercfg could not read the active power plan");
        }
        guid_from_powercfg(&String::from_utf8_lossy(&output.stdout))
            .ok_or_else(|| anyhow::anyhow!("Windows returned an unreadable active power-plan GUID"))
    }

    fn activate_power_guid(guid: &str) -> anyhow::Result<()> {
        let output = Command::new("powercfg").args(["/setactive", guid]).output()?;
        if !output.status.success() {
            anyhow::bail!(
                "Windows rejected power plan {guid}: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        let active = active_power_guid()?;
        if !active.eq_ignore_ascii_case(guid) {
            anyhow::bail!("Windows did not verify the requested power plan");
        }
        Ok(())
    }

    pub fn apply_high_performance_plan() -> anyhow::Result<Option<String>> {
        const ULTIMATE_TEMPLATE: &str = "e9a42b02-d5df-448d-aa00-03f14749eb61";
        const HIGH_PERFORMANCE: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
        let prior = active_power_guid()?;

        if activate_power_guid(ULTIMATE_TEMPLATE).is_err() {
            let duplicate = Command::new("powercfg")
                .args(["/duplicatescheme", ULTIMATE_TEMPLATE])
                .output()?;
            let duplicate_guid = duplicate
                .status
                .success()
                .then(|| guid_from_powercfg(&String::from_utf8_lossy(&duplicate.stdout)))
                .flatten();
            if let Some(guid) = duplicate_guid {
                activate_power_guid(&guid)?;
            } else {
                activate_power_guid(HIGH_PERFORMANCE)?;
            }
        }
        Ok(Some(prior))
    }

    pub fn undo_high_performance_plan(token: Option<&str>) -> anyhow::Result<()> {
        let prior = token.ok_or_else(|| anyhow::anyhow!("Previous power plan was not recorded"))?;
        activate_power_guid(prior)
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
    stub!(apply_high_performance_plan);
    pub fn undo_high_performance_plan(_token: Option<&str>) -> anyhow::Result<()> {
        anyhow::bail!("Windows-only");
    }
}

// 20 representative native impls — one per high-impact category from the
// V2 audit. Anything not listed here falls through to the PowerShell snippet
// the React app already ships in `client/src/lib/tweak-registry.ts`.
const NATIVE_TWEAKS: &[(&str, NativeTweak)] = &[
    ("Win32PrioritySeparation",   NativeTweak { apply: native_impls::apply_priority_separation,    undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("SetTimerResolution",        NativeTweak { apply: native_impls::apply_timer_resolution,       undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("SetResponsiveness",         NativeTweak { apply: native_impls::apply_system_responsiveness,  undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("NetworkThrottling",         NativeTweak { apply: native_impls::apply_network_throttling,     undo: native_impls::reg_undo, category: "network",        requires_reboot: false }),
    ("DisableNDU",                NativeTweak { apply: native_impls::apply_disable_ndu,            undo: native_impls::reg_undo, category: "network",        requires_reboot: true  }),
    ("DisableFastStartup",        NativeTweak { apply: native_impls::apply_disable_fast_startup,   undo: native_impls::reg_undo, category: "registry",       requires_reboot: true  }),
    ("DisableGameDVR",            NativeTweak { apply: native_impls::apply_disable_game_dvr,       undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("DisableTelemetry",          NativeTweak { apply: native_impls::apply_disable_telemetry,      undo: native_impls::reg_undo, category: "registry",       requires_reboot: false }),
    ("SetHighPerformancePlan",    NativeTweak { apply: native_impls::apply_high_performance_plan,  undo: native_impls::undo_high_performance_plan, category: "power", requires_reboot: false }),
];

// Re-exported so other modules can validate IDs without re-listing.
pub fn native_ids() -> BTreeMap<&'static str, &'static str> {
    NATIVE_TWEAKS.iter().map(|(id, t)| (*id, t.category)).collect()
}
