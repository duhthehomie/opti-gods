import type { HardwareInfo } from "@/hooks/use-hardware-info";
import type { OsInfo } from "@/hooks/use-os-detection";

export interface SmartRecs {
  ids: Set<string>;
  profile: string;
  profileColor: string;
  reasons: string[];
  gpuLabel: string;
  ramLabel: string;
  cpuLabel: string;
  osLabel: string;
  ready: boolean;
}

export function computeSmartRecs(hw: HardwareInfo, os: OsInfo): SmartRecs {
  const ids = new Set<string>();
  const reasons: string[] = [];
  const ready = !hw.loading && !os.loading;

  // ===== CORE — every Windows gaming PC benefits from these =====
  const CORE = [
    // Scheduler / responsiveness
    "Win32PrioritySeparation","SetTimerResolution","SetResponsiveness","GameModeTweaks",
    "DisableHungAppDetection","EnableMSIMode",
    // Network
    "NetworkThrottling","DisableNagle","InputLagTCP","SetDNSPriority","DisableNDU","OptimizeTCP",
    "EnableTCPAutoTuning","DisableIPv6",
    // Power / throttling
    "DisablePowerThrottling","DisablePowerThrottlingAdv",
    // Visual / gaming
    "DisableXboxGameBar","DisableGameDVR","DisablePointerPrecision","DisableAnimations",
    "SysVisualBestPerf","SysHypervisorOff",
    // Privacy / bloat
    "DisableTelemetry","DisableFastStartup","DisableWindowsError","DisableAutoUpdate",
    // Power plan
    "SetHighPerformancePlan","DisableUSBSuspend",
    // Memory — core safe tweaks
    "OptimizeRAMUsage","DisablePagefileEncryption","DisablePrefetch",
    "MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
    "MemDisableKernelPaging","MemGPUOptimize","MemGPUSchedulerTweak",
    "MemSetWorkingSetSize","MemDisableHeapTermination","MemSystemCacheBoost",
    "EnableLargeSystemCache","MemLargePageSupport",
    // Services
    "ServiceDiagTrack","ServiceSysMain","ServiceFax","ServiceRemoteReg","ServiceRetailDemo",
    "ServiceDPS","ServiceDusmSvc","ServiceLltdsvc","ServiceMapsBroker","ServicePcaSvc",
    "ServiceTrkWks","ServiceWbioSrvc","ServiceWerSvc","ServiceWMPNetworkSvc",
    "ServiceFDHost","ServicePrintSpooler","ServiceWSearch","ServiceTabletInput",
    "ServiceAeLookupSvc",
    // Privacy
    "PrivacyTelemetry","PrivacyAdvertisingID","PrivacyLocationTracking",
    "PrivacyActivityHistory","PrivacyDiagFeedback",
    // Process Lasso tweaks (safe for all PCs)
    "ProcessLassoProBalance","ProcessLassoSmartTrim","ProcessLassoRestrain",
    "ProcessLassoInstanceBalancer","ProcessTrimWorkingSet",
    "ProcessAutoKillHung","ProcessDisableWindowsErrorReporting",
    // FiveM — universal game pack
    "FiveMHighPriority","FiveMCacheClear","FiveMNetworkBuffer","FiveMQueueFix",
    "FiveMFullPerfStack","FiveMGTAProcessPerfOptions","FiveMGameModeAdd",
    "FiveMReduceNPCDensity","FiveMCommandLineTweaks","FiveMDisableLSO","FiveMEnableRSS",
    "FiveMRenderingBoost","FiveMGPUPriorityStack","FiveMDisableMPO",
    "FiveMReduceShadowQuality","FiveMStreamDistance","FiveMDisableVSync",
    "FiveMMMCSSAudio","FiveMCommandlineMax","FiveMIOPriority",
    "FiveMCitizenDisableMedia","FiveMDisableDWM","FiveMDisableFullscreen",
    "FiveMDisableP2P","FiveMDNSOverride","FiveMSteamChildOff","FiveMSteamOverlayOff",
    "FiveMStreamPool","FiveMWorkingSet","FiveMExtendedMemory","FiveMAffinityMask",
    "FiveMDisableMemCompression","FiveMMenuFpsUncap",
    // Registry — safe kernel tweaks every gaming PC benefits from
    "RegistryNTFSOptimize","RegistryIOPageLock","RegistryDPCLatency","RegistryLargePageHeap",
    "ClearPagefileOnShutdown",
    // WinUtil
    "WinTitusBgApps","WinTitusFullscreenOpt","WinTitusTeredo","WinTitusIPv4Prefer",
    "WinTitusNotifTray","OOShutupPrivacy","WinTitusConsumerFeatures",
    "WinTitusEdgeDebloat","WinTitusXboxComponents",
    // Fortnite — universal
    "FortniteHighPriority","FortniteDisableThrottling","FortniteDisableVSync",
    "FortniteUncapLobbyFPS","FortniteUncapGameFPS","FortniteDisableMotionBlur",
    "FortniteNetworkBuffer","FortniteInputLatency","FortniteGameMode",
    "FortniteDisableLumen","FortniteDisableRecording","FortniteEngineStreaming",
    "FortniteLowShadows","FortniteAffinityPhysical","FortniteForceDirectX12",
    // Discord
    "DiscordDisableHWAccel","DiscordDisableAnimations","DiscordClearCache",
    "DiscordReduceGPUPriority","DiscordDisableClips","DiscordDisableCrashHandler",
    "DiscordDisableOverlay","DiscordDisableStreaming","DiscordDisableUpdateCheck",
    "DiscordDisableVAD","DiscordLowerVoiceQuality","DiscordLowPriority",
    "DiscordOptimizeCodec",
    // Hibernate / pagefile
    "SysHibernateOff",
    // Startup apps — disable non-essential startup programs (safe, user can re-enable)
    "su_discord","su_steam","su_epic","su_ea_app","su_ubisoft","su_battlenet",
    "su_onedrive","su_spotify","su_skype","su_teams","su_zoom","su_chrome",
    "su_firefox","su_edge_startup","su_obs","su_rtss","su_msiab",
    "su_nvidia","su_amdradeon","su_logitech","su_razer","su_corsair",
    "su_realtek","su_ccleaner",
    // Processes/Services reduction — all safe to disable for gaming
    "ProcSvc_AJRouter","ProcSvc_AppReadiness","ProcSvc_BITS","ProcSvc_BthServ",
    "ProcSvc_cbdhsvc","ProcSvc_CDPSvc","ProcSvc_DiagTrack","ProcSvc_dmwappushsvc",
    "ProcSvc_DoSvc","ProcSvc_DPS","ProcSvc_DusmSvc","ProcSvc_EapHost",
    "ProcSvc_Fax","ProcSvc_FDServices","ProcSvc_icssvc","ProcSvc_lfsvc",
    "ProcSvc_Lltdsvc","ProcSvc_MapsBroker","ProcSvc_OneSyncSvc","ProcSvc_p2pimsvc",
    "ProcSvc_PcaSvc","ProcSvc_PhoneSvc","ProcSvc_PrintNotify","ProcSvc_PushToInstall",
    "ProcSvc_RemoteReg","ProcSvc_RetailDemo","ProcSvc_SCardSvr","ProcSvc_seclogon",
    "ProcSvc_SharedAccess","ProcSvc_SharedRealitySvc","ProcSvc_SSDP","ProcSvc_SysMain",
    "ProcSvc_TabletInput","ProcSvc_TrkWks","ProcSvc_W32Time","ProcSvc_WbioSrvc",
    "ProcSvc_WerSvc","ProcSvc_WFDSConMgr","ProcSvc_WinRM","ProcSvc_WMPNet",
    "ProcSvc_WpnService","ProcSvc_WSearch","ProcSvc_XblAuth","ProcSvc_XblGame",
    "ProcSvc_XboxGip","ProcSvc_XboxNet",
    // Debloat — universal
    "DebloatCortana","DebloatOneDrive","DebloatXboxApp","DebloatXboxGameBar",
    "DebloatBing","DebloatSkype","DebloatTeamsConsumer","DebloatFeedback",
    "DebloatGetHelp","DebloatOfficeHub","DebloatAlarmsAndClock","DebloatClipchamp",
    "DebloatGrooveMusic","DebloatMaps","DebloatMSPaint3D","DebloatNews",
    "DebloatPowerAutomate","DebloatQuickAssist","DebloatWindowsCamera","DebloatZune",
  ];
  CORE.forEach(id => ids.add(id));
  reasons.push("Core performance tweaks (safe for every PC)");

  // ===== CPU THREADS =====
  const cores = hw.cpuCores || 0;
  if (cores >= 16) {
    ["DisableCoreParking","DisableDynamicTick",
     "ProcessLassoAffinityGaming"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — full core unparking + scheduler precision`);
  } else if (cores >= 12) {
    ["DisableCoreParking","DisableDynamicTick",
     "ProcessLassoAffinityGaming"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — aggressive core parking + scheduler disabled`);
  } else if (cores >= 8) {
    ["DisableCoreParking","DisableDynamicTick"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — core parking disabled, MSI mode enabled`);
  } else if (cores >= 4) {
    ["DisableCoreParking"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — core parking disabled`);
  } else {
    ["DisableCoreParking"].forEach(id => ids.add(id));
    if (cores > 0) reasons.push(`${cores}-thread CPU — safe core optimization`);
    else reasons.push("CPU threads unknown — applying safe defaults");
  }

  // ===== CPU BRAND =====
  if (hw.isRyzen) {
    ["FiveMGTAProcessPerfOptions","FiveMAffinityMask"].forEach(id => ids.add(id));
    if (hw.cpuGeneration >= 5) {
      reasons.push(`AMD Ryzen ${hw.cpuGeneration}000-series — Zen 3+ power plan tweaks applied`);
    } else if (hw.cpuGeneration >= 3) {
      ["FiveM3500CoreAffinity","FiveM3500PerfPlan","FiveM5600CoreAffinity","FiveM5600PowerPlan"].forEach(id => ids.add(id));
      if (hw.cpuLabel && /3500/i.test(hw.cpuLabel)) {
        reasons.push(`AMD Ryzen 5 3500 detected — core affinity 0x3F + Boost locked 100%`);
      } else if (hw.cpuLabel && /5600/i.test(hw.cpuLabel)) {
        reasons.push(`AMD Ryzen 5600 detected — Zen 3 core affinity + power plan tweaks`);
      } else {
        reasons.push(`AMD Ryzen ${hw.cpuGeneration}000-series (Zen 2/3) — core + scheduler + power plan tweaks`);
      }
    } else {
      reasons.push(`AMD Ryzen CPU — performance tweaks applied`);
    }
  } else if (hw.isIntelCore) {
    if (hw.cpuGeneration >= 12) {
      ["FiveMAffinityMask","ProcessLassoAffinityGaming"].forEach(id => ids.add(id));
      reasons.push(`Intel ${hw.cpuGeneration}th gen (has E-cores) — P-core affinity for gaming`);
    } else {
      reasons.push(`Intel Core ${hw.cpuGeneration}th gen — core optimization applied`);
    }
  }

  // ===== GPU =====
  if (hw.isNvidia) {
    [
      "EnableHAGS","NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaLowLatency",
      "NvidiaOptimizeLatency","NvidiaPowerMizer","NvidiaReflexEnable","NvidiaTripleBufferOff",
      "NvidiaDisableOverlay","NvidiaForceVSyncOff","NvidiaShaderCache","NvidiaMaxPerfMode",
      "NvidiaAnisoFiltering","NvidiaOpenGLOpt","NvidiaThreadedOpt","NvidiaVRAMMax",
      "NvidiaGSyncOptimize",
      "FiveMDisableNvidiaTelemetry","FiveMDisablePhysX","FiveMMenuFpsUncap","FiveMFixNvidiaOverlay",
    ].forEach(id => ids.add(id));

    if (hw.nvidiaIsLowEnd) {
      ["NvShaderDiskCache","NvTextureFilterPerf","NvFXAADriverOff"].forEach(id => ids.add(id));
      if (hw.gpuName && /1650/i.test(hw.gpuName)) {
        ["FiveM1650DisableHAGS","FiveM1650VRAMBudget","FiveM1650DisableAnsel","FiveM1650LowLatencyMode"].forEach(id => ids.add(id));
        reasons.push(`GTX 1650 SUPER — HAGS off, 4GB VRAM unlocked, Ansel removed, Low Latency Ultra`);
      } else if (hw.gpuName && /1060/i.test(hw.gpuName)) {
        ["FiveM1060VRAMFlag","FiveM1060DisableHAGS","FiveM1060AnselDisable"].forEach(id => ids.add(id));
        reasons.push(`GTX 1060 — 6GB VRAM unlocked, HAGS off, Ansel removed`);
      } else {
        reasons.push(`Low-end NVIDIA (GTX/Pascal/Turing) — shader cache maximized, texture filter optimized`);
      }
    } else if (hw.nvidiaIsRTX) {
      reasons.push(`NVIDIA RTX GPU (${hw.gpuName}) — full RTX optimization suite + DPC latency reduction`);
    } else {
      ["NvShaderDiskCache","NvFXAADriverOff"].forEach(id => ids.add(id));
      reasons.push(`NVIDIA GPU (${hw.gpuName}) — NVIDIA optimization suite enabled`);
    }
  } else if (hw.isAmdGpu) {
    [
      "EnableHAGS","AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency",
      "AmdMaxClockState","AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag",
      "AmdDisableTelemetry","AmdDisableCrashDefender","AmdShaderCache","AmdDisableVSR",
      "AmdDisableVariBright","AmdSmartAccessMemory","AmdAntiLagPlus","AmdTDRTweak",
      "AmdDisableStartupApps","AmdDisableFreeSyncCompetitive","AmdFluidMotionFrames",
      "AmdImageSharpening",
    ].forEach(id => ids.add(id));
    reasons.push(`AMD discrete GPU (${hw.gpuName}) — full AMD RX optimization suite`);
  } else if (hw.isAMD || hw.isAmdApu) {
    [
      "IGpu_DisableULPS","IGpu_DisableDeepSleep","IGpu_DisableVariBright","IGpu_ForcePerformancePower",
      "IGpu_AmdAntiLag","IGpu_SharedMemoryHint","IGpu_DisableMPO","IGpu_AmdTdrLevel",
      "IGpu_DisableTransparency","IGpu_DisableAnimations","IGpu_DisableXboxGameBar",
      "IGpu_DisableFullscreenOpt","IGpu_UltimatePerformancePlan","IGpu_MaxProcessorState",
      "IGpu_DisableCoreParking","IGpu_GameModeOn","IGpu_SetTimerResolution",
      "IGpu_NetworkThrottling","IGpu_DisableSysMain","IGpu_DisableHAGSForIGpu",
    ].forEach(id => ids.add(id));
    reasons.push(`AMD iGPU/APU (${hw.gpuName}) — Vega/APU tweaks, HAGS disabled`);
  } else if (hw.isIntel) {
    [
      "IGpu_Intel_MaxFreq","IGpu_Intel_DisableFreqScaling",
      "IGpu_Intel_TDR","IGpu_Intel_PanelFitter","IGpu_Intel_QSVOff",
      "IGpu_ForcePerformancePower","IGpu_DisableTransparency","IGpu_DisableAnimations",
      "IGpu_DisableXboxGameBar","IGpu_DisableFullscreenOpt","IGpu_UltimatePerformancePlan",
      "IGpu_MaxProcessorState","IGpu_DisableCoreParking","IGpu_GameModeOn",
      "IGpu_SetTimerResolution","IGpu_NetworkThrottling","IGpu_DisableSysMain",
      "IGpu_DisableHAGSForIGpu","IGpu_DisableMPO",
    ].forEach(id => ids.add(id));
    reasons.push(`Intel iGPU (${hw.gpuName}) — Intel driver TDR fix, Panel Fitter off, HAGS disabled`);
  } else {
    ids.add("EnableHAGS");
    reasons.push("GPU unknown — safe defaults applied");
  }

  // ===== RAM =====
  const ram = hw.ramGB || 0;
  if (ram >= 32) {
    [
      "DisableMemoryCompression","MemDisableCompression","FiveMDisableMemCompression",
      "DisablePrefetch","MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
      "MemDisableKernelPaging","MemGPUOptimize","FiveMExtendedMemory","FiveMWorkingSet",
      "MemDisableGPUPagefile","MemClearPagefileShutdown","MemMovePagefileFast",
      "MemFixedPagefile",
    ].forEach(id => ids.add(id));
    reasons.push("32GB+ RAM — memory compression safe to disable, aggressive memory tweaks enabled");
  } else if (ram >= 8) {
    [
      "DisablePrefetch","MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
      "MemDisableKernelPaging","MemGPUOptimize","FiveMExtendedMemory","FiveMWorkingSet",
      "MemClearPagefileShutdown",
    ].forEach(id => ids.add(id));
    reasons.push(`${ram}GB RAM — memory tweaks applied, compression kept ON (requires 32GB+ to disable safely)`);
  } else if (ram >= 4) {
    ["DisablePrefetch","MemTrimStandbyList","MemTrimOnMinimize","MemDisableKernelPaging"].forEach(id => ids.add(id));
    reasons.push(`${ram}GB RAM — safe memory tweaks`);
  } else if (ram > 0) {
    ["MemTrimOnMinimize","MemSystemCacheBoost"].forEach(id => ids.add(id));
    reasons.push(`Low RAM (${ram}GB) — minimal memory tweaks`);
  } else {
    ["DisablePrefetch","MemTrimStandbyList","MemDisableKernelPaging"].forEach(id => ids.add(id));
    reasons.push("RAM unknown — safe memory defaults applied");
  }

  // ===== LAPTOP =====
  if (hw.isLaptop) {
    [
      "Lap_UltimatePerformance","Lap_DisableCoreParking","Lap_DisableThrottleStates",
      "Lap_MaxProcessorStateAC","Lap_DisableAdaptiveBrightness",
      "Lap_Net_DisableNagle","Lap_Net_DisableThrottle","Lap_Net_DisableAutoTuning",
      "Lap_Net_DisableUSBSelSuspend","Lap_Net_WiFiPerfMode","Lap_Net_OptimizeDNS",
      "Lap_USBPowerSave","Lap_WifiPerfMode",
      "Lap_TimerResolution","Lap_DisablePowerThrottling","Lap_DisableXboxGameBar",
      "Lap_DisableFullscreenOpt","Lap_MMCSS_Games","Lap_DisableMPO","Lap_VisualPerformance",
      "Lap_DisableHAGS","Lap_DisableHibernate","Lap_DisableTurboOnBattery",
    ].forEach(id => ids.add(id));
    if (hw.isNvidia) {
      ["Lap_NVIDIA_MaxPerformance","Lap_NVIDIA_DisableVsync","Lap_NVIDIA_LowLatency",
       "Lap_NVIDIA_ThreadedOpt","Lap_NVIDIA_DisableMaxQThrottle"].forEach(id => ids.add(id));
    } else if (hw.isAMD || hw.isAmdApu) {
      ["Lap_AMD_DisableULPS","Lap_AMD_DisableVariBright","Lap_AMD_DisableDeepSleep",
       "Lap_AMD_DisableDynamicVoltage","Lap_AMD_ForcePerformance"].forEach(id => ids.add(id));
    } else if (hw.isIntel) {
      ["Lap_Intel_DisableTurboLimits","Lap_Intel_DisableSpeedShift",
       "Lap_Intel_DisableECores"].forEach(id => ids.add(id));
    }
    reasons.push("Laptop detected — full laptop power + Wi-Fi + USB optimization suite");
  }

  // ===== OS =====
  if (os.isWindows11) {
    [
      "Win11TeamsChat","Win11Widgets","Win11Copilot","Win11BingSearch","Win11AdsInStart",
      "Win11EdgeSidebar","Win11OneDriveBackup","Win11StartRecommended","Win11ChatIcon",
      "Win11Snap","Win11NotepadAI","Win11AutoHDR","Win11DeviceEncryption","Win11TPMAlert",
      "DebloatCortana","DebloatOneDrive","DebloatXboxApp","DebloatXboxGameBar",
      "DebloatBing","DebloatXboxIdentity","DebloatMixedReality","DebloatSolitaire",
      "PrivacyActivityHistory","PrivacyDiagFeedback",
      "ServiceRemoteReg","ServiceFax","ServiceRetailDemo",
      "WinTitusConsumerFeatures","WinTitusEdgeDebloat","WinTitusXboxComponents",
      "WinTitusHibernation","WinTitusDiskCleanup","WinTitusServicesManual",
    ].forEach(id => ids.add(id));
    reasons.push("Windows 11 — Win11 debloat, privacy, and service tweaks included");
  } else if (os.isWindows10) {
    [
      "DebloatCortana","DebloatOneDrive","DebloatXboxApp","DebloatXboxGameBar",
      "DebloatXboxIdentity","DebloatBing","DebloatWeather","DebloatNews","DebloatMaps",
      "DebloatSolitaire","DebloatMixedReality","DebloatSkype","DebloatFeedback",
      "DebloatGetHelp","DebloatOfficeHub","DebloatYourPhone","DebloatTeamsConsumer",
      "ServiceWSearch","ServiceRemoteReg","ServiceFax","ServiceRetailDemo","ServiceTabletInput",
      "PrivacyActivityHistory","PrivacyDiagFeedback","PrivacyAdvertisingID",
      "WinTitusConsumerFeatures","WinTitusHibernation","WinTitusDiskCleanup",
      "WinTitusServicesManual","WinTitusBgApps","WinTitusTeredo",
    ].forEach(id => ids.add(id));
    reasons.push("Windows 10 — Win10 debloat and service tweaks included");
  } else if (!os.isWindows && !os.loading) {
    reasons.push("Non-Windows OS — limited tweaks available");
  }

  // ===== PROFILE NAME =====
  let profile = "Standard Gaming";
  let profileColor = "text-zinc-400";

  if (!hw.loading && !os.loading) {
    const cores = hw.cpuCores || 0;
    const ram = hw.ramGB || 0;
    const highEnd = cores >= 12 && ram >= 8;
    const midRange = cores >= 8 && ram >= 8;

    if (hw.isLaptop && hw.isNvidia && hw.nvidiaIsRTX) {
      profile = "Gaming Laptop (RTX)"; profileColor = "text-green-400";
    } else if (hw.isLaptop && hw.isNvidia) {
      profile = "Gaming Laptop (GTX)"; profileColor = "text-amber-400";
    } else if (hw.isLaptop && hw.isAmdGpu) {
      profile = "Gaming Laptop (AMD GPU)"; profileColor = "text-red-400";
    } else if (hw.isLaptop) {
      profile = "Laptop"; profileColor = "text-zinc-400";
    } else if (hw.isNvidia && hw.nvidiaIsRTX && highEnd) {
      profile = "High-End RTX Rig"; profileColor = "text-green-400";
    } else if (hw.isNvidia && hw.nvidiaIsRTX) {
      profile = "NVIDIA RTX Gaming"; profileColor = "text-green-400";
    } else if (hw.isNvidia && hw.nvidiaIsLowEnd) {
      profile = "GTX Budget Gaming"; profileColor = "text-amber-400";
    } else if (hw.isNvidia) {
      profile = "NVIDIA Gaming PC"; profileColor = "text-green-400";
    } else if (hw.isAmdGpu && highEnd) {
      profile = "High-End AMD Rig"; profileColor = "text-red-400";
    } else if (hw.isAmdGpu) {
      profile = "AMD Gaming PC"; profileColor = "text-red-400";
    } else if (hw.isAmdApu) {
      profile = "AMD APU / Vega iGPU"; profileColor = "text-orange-400";
    } else if (hw.isIntel) {
      profile = "Intel Integrated Graphics"; profileColor = "text-blue-400";
    } else if (hw.isAMD) {
      profile = "AMD PC"; profileColor = "text-red-400";
    } else if (highEnd) {
      profile = "High-End Gaming Rig"; profileColor = "text-amber-400";
    } else if (midRange) {
      profile = "Performance Gaming"; profileColor = "text-amber-400";
    } else {
      profile = "Standard Gaming PC"; profileColor = "text-zinc-400";
    }
  } else {
    profile = "Detecting...";
    profileColor = "text-zinc-600";
  }

  const gpuLabel = hw.loading ? "Detecting..." : (hw.isNvidia || hw.isAMD || hw.isIntel) ? hw.gpuName : "Unknown GPU";
  const ramLabel = hw.loading ? "Detecting..." : (hw.ramGB >= 8 ? "16GB+" : hw.ramGB > 0 ? `${hw.ramGB}GB+` : "Unknown");
  const cpuLabel = hw.loading ? "Detecting..." : hw.cpuCores > 0 ? hw.cpuLabel : "Unknown";
  const osLabel  = os.loading ? "Detecting..." : os.displayName || os.os;

  return { ids, profile, profileColor, reasons, gpuLabel, ramLabel, cpuLabel, osLabel, ready };
}
