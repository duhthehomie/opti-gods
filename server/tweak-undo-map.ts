// ============================================================================
// Per-tweak Undo Map (Task #39)
// ============================================================================
// Explicit reversal PowerShell commands for each known tweak ID. The
// /api/script/undo endpoint looks up commands here first. Tweaks NOT in this
// map fall through to a "use Restore Last Working State" PS1 (the endpoint
// does NOT run a broad category-restore block, since that would over-revert).
//
// Every entry should reverse ONLY the registry/service change of that one
// tweak, never a category or sibling tweak.
// ============================================================================

export interface UndoEntry {
  /** Human-readable description shown in the PS1 header. */
  label: string;
  /** PowerShell statements (no leading Write-Host header). */
  commands: string[];
}

const OK = (msg: string) => `Write-Host "[OK] ${msg.replace(/"/g, '`"')}" -ForegroundColor Green`;

export const TWEAK_UNDO_MAP: Record<string, UndoEntry> = {
  // ── Registry: CPU scheduling ──────────────────────────────────────────────
  Win32PrioritySeparation: {
    label: "Win32PrioritySeparation → Windows default (2)",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name 'Win32PrioritySeparation' -Value 2 -Type DWord -Force`,
      OK("Win32PrioritySeparation reset to 2"),
    ],
  },
  DisableHungAppDetection: {
    label: "Hung-app detection restored",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '5000' -Force`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '20000' -Force`,
      OK("Hung-app detection timeouts restored"),
    ],
  },
  SetTimerResolution: {
    label: "Timer resolution boot flags cleared",
    commands: [
      `bcdedit /deletevalue useplatformtick 2>$null`,
      `bcdedit /deletevalue disabledynamictick 2>$null`,
      OK("Boot timer flags cleared (reboot to apply)"),
    ],
  },
  SetResponsiveness: {
    label: "SystemResponsiveness → 20 (default)",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 20 -Type DWord -Force`,
      OK("SystemResponsiveness reset to 20"),
    ],
  },
  EnableMSIMode: {
    label: "GPU MSI mode → Windows default (line-based interrupts)",
    commands: [
      `$gpu = Get-PnpDevice -Class Display | Select-Object -First 1; If ($gpu) { $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($gpu.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"; If (Test-Path $path) { Set-ItemProperty $path 'MSISupported' 0 -EA SilentlyContinue } }`,
      OK("MSI mode disabled for primary GPU"),
    ],
  },
  GameModeTweaks: {
    label: "MMCSS Games scheduler block → defaults",
    commands: [
      `$k='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'; If (Test-Path $k) { Set-ItemProperty $k 'Scheduling Category' 'Medium' -Type String -Force; Set-ItemProperty $k 'SFIO Priority' 'Normal' -Type String -Force; Set-ItemProperty $k 'GPU Priority' 2 -Type DWord -Force; Set-ItemProperty $k 'Priority' 2 -Type DWord -Force }`,
      OK("Games scheduler reset to Medium/Normal/2/2"),
    ],
  },

  // ── Registry: Network ─────────────────────────────────────────────────────
  NetworkThrottling: {
    label: "NetworkThrottlingIndex → 10 (default)",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 10 -Type DWord -Force`,
      OK("NetworkThrottlingIndex reset to 10"),
    ],
  },
  DisableNagle: {
    label: "Nagle algorithm re-enabled",
    commands: [
      `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces'; Get-ChildItem $p | ForEach-Object { Remove-ItemProperty $_.PSPath 'TcpAckFrequency' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'TCPNoDelay' -EA SilentlyContinue }`,
      OK("TcpAckFrequency / TCPNoDelay cleared on every NIC"),
    ],
  },
  OptimizeTCP: {
    label: "TCP global parameters → defaults",
    commands: [
      `netsh int tcp set global autotuninglevel=normal | Out-Null`,
      `netsh int tcp set global rss=default | Out-Null`,
      `netsh int tcp set global chimney=automatic | Out-Null`,
      OK("netsh int tcp globals reset"),
    ],
  },
  EnableTCPAutoTuning: {
    label: "TCP autotuning → normal",
    commands: [
      `netsh int tcp set global autotuninglevel=normal | Out-Null`,
      OK("Autotuning level set to normal"),
    ],
  },
  DisablePowerThrottling: {
    label: "Power throttling re-enabled",
    commands: [
      `Remove-Item -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling' -Recurse -Force -EA SilentlyContinue`,
      OK("PowerThrottling key removed (Windows defaults take over)"),
    ],
  },
  DisableNDU: {
    label: "Ndu service restored",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Ndu' -Name 'Start' -Value 2 -Type DWord -Force`,
      OK("Ndu set back to Automatic (2)"),
    ],
  },
  DisableIPv6: {
    label: "IPv6 stack re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters' -Name 'DisabledComponents' -Value 0 -Type DWord -Force`,
      OK("IPv6 DisabledComponents → 0 (fully enabled)"),
    ],
  },
  SetDNSPriority: {
    label: "DNS priority entries removed",
    commands: [
      `$p='HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters'; foreach ($n in 'LocalPriority','HostsPriority','DnsPriority','NetbtPriority') { Remove-ItemProperty $p $n -EA SilentlyContinue }`,
      OK("DNS priority overrides removed"),
    ],
  },
  NetMTUAutotune: {
    label: "MTU autotune entries cleared",
    commands: [
      `Get-NetAdapter -Physical | ForEach-Object { netsh interface ipv4 set subinterface "$($_.Name)" mtu=1500 store=persistent 2>$null | Out-Null }`,
      OK("MTU reset to 1500 on physical NICs"),
    ],
  },
  NetDNSCloudflare: { label: "DNS → DHCP (auto)", commands: [`Get-NetAdapter -Physical | Set-DnsClientServerAddress -ResetServerAddresses`, OK("DNS reset to DHCP")] },
  NetDNSGoogle:     { label: "DNS → DHCP (auto)", commands: [`Get-NetAdapter -Physical | Set-DnsClientServerAddress -ResetServerAddresses`, OK("DNS reset to DHCP")] },
  NetDNSQuad9:      { label: "DNS → DHCP (auto)", commands: [`Get-NetAdapter -Physical | Set-DnsClientServerAddress -ResetServerAddresses`, OK("DNS reset to DHCP")] },
  NetDisableQoS: {
    label: "QoS Packet Scheduler restored",
    commands: [
      `Remove-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched' -Recurse -Force -EA SilentlyContinue`,
      OK("QoS policy key removed (defaults restored)"),
    ],
  },
  NetDisableLargeSendOffload: {
    label: "Large Send Offload re-enabled per-NIC",
    commands: [
      `Get-NetAdapterAdvancedProperty -DisplayName 'Large Send Offload*' -EA SilentlyContinue | ForEach-Object { Reset-NetAdapterAdvancedProperty -Name $_.Name -DisplayName $_.DisplayName }`,
      OK("LSO settings reset to NIC defaults"),
    ],
  },

  // ── Registry: Memory ──────────────────────────────────────────────────────
  DisablePrefetch: {
    label: "Prefetcher re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' -Name 'EnablePrefetcher' -Value 3 -Type DWord -Force`,
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' -Name 'EnableSuperfetch' -Value 3 -Type DWord -Force`,
      OK("Prefetcher + Superfetch → 3 (Windows default)"),
    ],
  },
  ClearPagefileOnShutdown: {
    label: "ClearPageFileAtShutdown → 0",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 0 -Type DWord -Force`,
      OK("Pagefile no longer cleared at shutdown"),
    ],
  },
  MemClearPagefileShutdown: {
    label: "ClearPageFileAtShutdown → 0",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 0 -Type DWord -Force`,
      OK("Pagefile no longer cleared at shutdown"),
    ],
  },
  DisableMemoryCompression: {
    label: "Memory compression re-enabled",
    commands: [
      `Enable-MMAgent -MemoryCompression -EA SilentlyContinue`,
      OK("Memory compression enabled"),
    ],
  },
  MemDisableCompression: {
    label: "Memory compression re-enabled",
    commands: [
      `Enable-MMAgent -MemoryCompression -EA SilentlyContinue`,
      OK("Memory compression enabled"),
    ],
  },
  MemDisableSuperfetch: {
    label: "SysMain (Superfetch) → Automatic",
    commands: [
      `Set-Service -Name SysMain -StartupType Automatic -EA SilentlyContinue; Start-Service SysMain -EA SilentlyContinue`,
      OK("SysMain restored"),
    ],
  },
  EnableLargeSystemCache: {
    label: "LargeSystemCache → 0 (workstation default)",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name 'LargeSystemCache' -Value 0 -Type DWord -Force`,
      OK("LargeSystemCache reset"),
    ],
  },

  // ── Registry: Visual / Gaming shell ───────────────────────────────────────
  DisableAnimations: {
    label: "Visual animations restored",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '1' -Type String -Force`,
      `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Value 0 -Type DWord -Force`,
      OK("Window animations restored"),
    ],
  },
  DisableTelemetry: {
    label: "DiagTrack / telemetry service restored",
    commands: [
      `Set-Service -Name DiagTrack -StartupType Automatic -EA SilentlyContinue; Start-Service DiagTrack -EA SilentlyContinue`,
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 3 -Type DWord -EA SilentlyContinue`,
      OK("DiagTrack + AllowTelemetry restored"),
    ],
  },
  DisableXboxGameBar: {
    label: "Xbox Game Bar re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name 'UseNexusForGameBarEnabled' -Value 1 -Type DWord -Force`,
      `Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_Enabled' -Value 1 -Type DWord -Force`,
      OK("Game Bar + GameDVR re-enabled"),
    ],
  },
  DisableGameDVR: {
    label: "GameDVR re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name 'GameDVR_Enabled' -Value 1 -Type DWord -Force`,
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR' -Name 'AllowGameDVR' -Value 1 -Type DWord -EA SilentlyContinue`,
      OK("GameDVR enabled"),
    ],
  },
  EnableHAGS: {
    label: "Hardware-accelerated GPU scheduling → off (Windows default)",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force`,
      OK("HAGS disabled (reboot required)"),
    ],
  },
  DisablePointerPrecision: {
    label: "Enhance Pointer Precision restored",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value '1' -Type String -Force`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value '6' -Type String -Force`,
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value '10' -Type String -Force`,
      OK("Enhance Pointer Precision re-enabled"),
    ],
  },
  DisableFastStartup: {
    label: "Fast startup re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -Value 1 -Type DWord -Force`,
      OK("Fast startup enabled"),
    ],
  },
  DisableWindowsError: {
    label: "Windows Error Reporting restored",
    commands: [
      `Set-Service -Name WerSvc -StartupType Manual -EA SilentlyContinue`,
      `Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Name 'Disabled' -Value 0 -Type DWord -EA SilentlyContinue`,
      OK("WER restored"),
    ],
  },
  DisableAutoUpdate: {
    label: "Windows Update service restored",
    commands: [
      `Set-Service -Name wuauserv -StartupType Manual -EA SilentlyContinue`,
      `Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'NoAutoUpdate' -EA SilentlyContinue`,
      OK("Windows Update restored to default"),
    ],
  },
  DisableDefender: {
    label: "Windows Defender re-enabled",
    commands: [
      `Set-MpPreference -DisableRealtimeMonitoring $false -EA SilentlyContinue`,
      `Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender' -Name 'DisableAntiSpyware' -EA SilentlyContinue`,
      OK("Defender real-time protection ON (reboot if it doesn't activate)"),
    ],
  },

  // ── Registry: Power ───────────────────────────────────────────────────────
  SetHighPerformancePlan: {
    label: "Power plan → Balanced",
    commands: [
      `powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e | Out-Null`,
      OK("Switched to Balanced power plan"),
    ],
  },
  DisableUSBSuspend: {
    label: "USB selective suspend re-enabled",
    commands: [
      `powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1 | Out-Null`,
      `powercfg /setactive SCHEME_CURRENT | Out-Null`,
      OK("USB selective suspend ON"),
    ],
  },
  DisableCoreParking: {
    label: "Core parking → Windows default",
    commands: [
      `powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 10 | Out-Null`,
      `powercfg /setactive SCHEME_CURRENT | Out-Null`,
      OK("Core parking minimum cores reset to 10%"),
    ],
  },
  DisableDynamicTick: {
    label: "Dynamic tick → on (default)",
    commands: [
      `bcdedit /deletevalue disabledynamictick 2>$null`,
      OK("Dynamic tick restored (reboot to apply)"),
    ],
  },

  // ── Debloat / privacy ─────────────────────────────────────────────────────
  PrivacyTelemetry: {
    label: "Telemetry policies removed",
    commands: [
      `Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -EA SilentlyContinue`,
      OK("AllowTelemetry policy removed"),
    ],
  },
  PrivacyAdvertisingID: {
    label: "Advertising ID re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Name 'Enabled' -Value 1 -Type DWord -Force`,
      OK("Advertising ID re-enabled"),
    ],
  },

  // ── NVIDIA ────────────────────────────────────────────────────────────────
  NvidiaDisableTelemetry: {
    label: "NVIDIA Telemetry services restored",
    commands: [
      `Set-Service -Name 'NvTelemetryContainer' -StartupType Automatic -EA SilentlyContinue`,
      `Start-Service 'NvTelemetryContainer' -EA SilentlyContinue`,
      OK("NVIDIA telemetry container restored"),
    ],
  },
  NvShaderDiskCache: {
    label: "NVIDIA shader cache → driver default",
    commands: [
      `Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak' -Name 'OGL_MaxFramesAllowed' -EA SilentlyContinue`,
      OK("NVIDIA shader cache custom keys removed"),
    ],
  },

  // ── AMD ───────────────────────────────────────────────────────────────────
  AmdDisableULPS: {
    label: "AMD ULPS re-enabled",
    commands: [
      `Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' -EA SilentlyContinue | ForEach-Object { Set-ItemProperty $_.PSPath 'EnableUlps' 1 -Type DWord -EA SilentlyContinue }`,
      OK("ULPS re-enabled on AMD GPUs"),
    ],
  },

  // ── V2.2 NVIDIA driver-class undos ────────────────────────────────────────
  NvTextureFilterHighPerf: {
    label: "NVIDIA Texture Filtering → driver default",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $names=@('PS_TexFilterAnisoOptOn','PS_TexFilterLODBiasAllow','PS_TexFilterNoNeg','PS_TexFilterQuality'); Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { $p=$_.PSPath; foreach ($n in $names) { Remove-ItemProperty -Path $p -Name $n -EA SilentlyContinue } }`,
      OK("NVIDIA texture filtering keys removed (driver default restored)"),
    ],
  },
  NvLowLatencyUltra: {
    label: "NVIDIA Low Latency Mode → driver default",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Remove-ItemProperty $_.PSPath 'RmLowLatencyMode' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'FlipQueueSize' -EA SilentlyContinue }`,
      OK("Low Latency Mode reset"),
    ],
  },
  NvThreadedOptOn: {
    label: "NVIDIA Threaded Optimization → driver default",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Remove-ItemProperty $_.PSPath 'OGL_ThreadControl' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'D3D_ThreadControl' -EA SilentlyContinue }`,
      OK("Threaded Optimization reset"),
    ],
  },
  NvPowerMgmtMax: {
    label: "NVIDIA Power Management → adaptive (default)",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $names=@('PowerMizerEnable','PerfLevelSrc','PowerMizerLevel','PowerMizerLevelAC'); Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { $p=$_.PSPath; foreach ($n in $names) { Remove-ItemProperty -Path $p -Name $n -EA SilentlyContinue } }`,
      OK("PowerMizer keys removed (adaptive restored)"),
    ],
  },
  NvFrameLimit60:  { label: "NVIDIA frame rate cap removed", commands: [`$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | ForEach-Object { Remove-ItemProperty $_.PSPath 'FrameRateLimit' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'FrameRateLimitEnable' -EA SilentlyContinue }`, OK("Frame rate cap cleared")] },
  NvFrameLimit144: { label: "NVIDIA frame rate cap removed", commands: [`$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | ForEach-Object { Remove-ItemProperty $_.PSPath 'FrameRateLimit' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'FrameRateLimitEnable' -EA SilentlyContinue }`, OK("Frame rate cap cleared")] },
  NvFrameLimit240: { label: "NVIDIA frame rate cap removed", commands: [`$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | ForEach-Object { Remove-ItemProperty $_.PSPath 'FrameRateLimit' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'FrameRateLimitEnable' -EA SilentlyContinue }`, OK("Frame rate cap cleared")] },

  // ── V2.2 AMD driver-class undos ───────────────────────────────────────────
  AmdTextureFilterPerf: {
    label: "AMD Texture Filtering → driver default",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; $names=@('CatalystAI','TFQ','TextureOpt'); Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { $p=$_.PSPath; foreach ($n in $names) { Remove-ItemProperty -Path $p -Name $n -EA SilentlyContinue } }`,
      OK("AMD texture filtering keys removed"),
    ],
  },
  AmdSurfaceFormatOpt: {
    label: "AMD Surface Format Optimization → off",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Remove-ItemProperty $_.PSPath 'EnableSurfaceFormatReplacements' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'KMD_EnableSFR' -EA SilentlyContinue }`,
      OK("Surface Format Optimization keys removed"),
    ],
  },
  AmdTessOverride16x: {
    label: "AMD Tessellation → application controlled",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Remove-ItemProperty $_.PSPath 'TessellationMode' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'MaxTessellation' -EA SilentlyContinue }`,
      OK("Tessellation override removed"),
    ],
  },
  AmdRadeonBoostOff: {
    label: "AMD Radeon Boost → driver default",
    commands: [
      `$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Remove-ItemProperty $_.PSPath 'KMD_RadeonBoostEnabled' -EA SilentlyContinue }`,
      `Remove-ItemProperty -Path 'HKCU:\\SOFTWARE\\AMD\\CN' -Name 'EnableBoost' -EA SilentlyContinue`,
      OK("Radeon Boost override removed"),
    ],
  },
  AmdFRTC60:  { label: "AMD FRTC removed", commands: [`$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | ForEach-Object { Remove-ItemProperty $_.PSPath 'KMD_FRTCEnabled' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'KMD_FRTCMaxFPS' -EA SilentlyContinue }`, OK("FRTC keys cleared")] },
  AmdFRTC144: { label: "AMD FRTC removed", commands: [`$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | ForEach-Object { Remove-ItemProperty $_.PSPath 'KMD_FRTCEnabled' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'KMD_FRTCMaxFPS' -EA SilentlyContinue }`, OK("FRTC keys cleared")] },
  AmdFRTC240: { label: "AMD FRTC removed", commands: [`$c='HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $c -EA SilentlyContinue | ForEach-Object { Remove-ItemProperty $_.PSPath 'KMD_FRTCEnabled' -EA SilentlyContinue; Remove-ItemProperty $_.PSPath 'KMD_FRTCMaxFPS' -EA SilentlyContinue }`, OK("FRTC keys cleared")] },

  EnableMSIMode_Safe: {
    label: "Safe MSI mode → disabled on all targeted devices (GPU + NIC + NVMe)",
    commands: [
      `Get-PnpDevice -EA SilentlyContinue | Where-Object { $_.Class -in @('Display','Net','SCSIAdapter') -and $_.Status -eq 'OK' } | ForEach-Object { $msi = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($_.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"; If (Test-Path $msi) { Set-ItemProperty $msi 'MSISupported' 0 -Type DWord -EA SilentlyContinue }; $aff = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($_.InstanceId)\\Device Parameters\\Interrupt Management\\Affinity Policy"; If (Test-Path $aff) { Remove-ItemProperty $aff 'DevicePolicy' -EA SilentlyContinue; Remove-ItemProperty $aff 'DevicePriority' -EA SilentlyContinue; Remove-ItemProperty $aff 'AssignmentSetOverride' -EA SilentlyContinue } }`,
      OK("MSI disabled on GPU + NICs + NVMe; Affinity Policy keys wiped (reboot required)"),
    ],
  },

  // ── Process Lasso family ──────────────────────────────────────────────────
  ProcessLassoProBalance: {
    label: "Per-process priority overrides cleared (Image File Execution Options)",
    commands: [
      `Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options' -EA SilentlyContinue | Where-Object { Test-Path "$($_.PSPath)\\PerfOptions" } | ForEach-Object { Remove-Item "$($_.PSPath)\\PerfOptions" -Recurse -Force -EA SilentlyContinue }`,
      OK("All PerfOptions priority overrides removed"),
    ],
  },
  ProcessAutoKillHung: {
    label: "Auto-kill timeout restored",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'AutoEndTasks' -Value '0' -Type String -Force`,
      OK("AutoEndTasks restored to 0 (manual prompt)"),
    ],
  },

  // ── Win11 debloat (most-toggled ones) ─────────────────────────────────────
  Win11Widgets: {
    label: "Win11 Widgets re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarDa' -Value 1 -Type DWord -Force`,
      OK("Taskbar Widgets icon ON"),
    ],
  },
  Win11Copilot: {
    label: "Copilot re-enabled",
    commands: [
      `Remove-ItemProperty -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -EA SilentlyContinue`,
      OK("Copilot policy removed"),
    ],
  },
  Win11TeamsChat: {
    label: "Teams chat icon re-enabled",
    commands: [
      `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarMn' -Value 1 -Type DWord -Force`,
      OK("Taskbar Teams chat icon ON"),
    ],
  },
};

export function getTweakUndoEntry(id: string): UndoEntry | null {
  return TWEAK_UNDO_MAP[id] ?? null;
}
