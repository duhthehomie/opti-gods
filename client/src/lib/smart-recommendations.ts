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
    "DisableHungAppDetection",
    // Network
    "NetworkThrottling","DisableNagle","InputLagTCP","SetDNSPriority","DisableNDU","OptimizeTCP",
    // Power / throttling
    "DisablePowerThrottling",
    // Visual / gaming
    "DisableXboxGameBar","DisableGameDVR","DisablePointerPrecision","DisableAnimations",
    "SysVisualBestPerf",
    // Privacy / bloat
    "DisableTelemetry","DisableFastStartup","DisableWindowsError",
    // Power plan
    "SetHighPerformancePlan","DisableUSBSuspend",
    // Memory
    "OptimizeRAMUsage","DisablePagefileEncryption",
    // Services
    "ServiceDiagTrack","ServiceSysMain",
    // Privacy
    "PrivacyTelemetry","PrivacyAdvertisingID","PrivacyLocationTracking",
    // FiveM (universal game pack)
    "FiveMHighPriority","FiveMCacheClear","FiveMNetworkBuffer","FiveMQueueFix",
    "FiveMFullPerfStack","FiveMGTAProcessPerfOptions","FiveMGameModeAdd",
    "FiveMReduceNPCDensity","FiveMCommandLineTweaks","FiveMDisableLSO","FiveMEnableRSS",
    // WinUtil
    "WinTitusBgApps","WinTitusFullscreenOpt","WinTitusTeredo","WinTitusIPv4Prefer",
    "WinTitusNotifTray","OOShutupPrivacy",
    // Fortnite (universal)
    "FortniteHighPriority","FortniteDisableThrottling","FortniteDisableVSync",
    "FortniteUncapLobbyFPS","FortniteUncapGameFPS","FortniteDisableMotionBlur",
    "FortniteNetworkBuffer","FortniteInputLatency","FortniteGameMode",
    // Discord
    "DiscordDisableHWAccel","DiscordDisableAnimations","DiscordClearCache",
    "DiscordReduceGPUPriority",
    // Hibernate off is safe for desktops and laptops (reclaims RAM worth of disk)
    "SysHibernateOff",
  ];
  CORE.forEach(id => ids.add(id));
  reasons.push("Core performance tweaks (safe for every PC)");

  // ===== CPU THREADS =====
  const cores = hw.cpuCores || 0;
  if (cores >= 16) {
    ["DisableCoreParking","EnableMSIMode","DisableDynamicTick","DisablePowerThrottlingAdv",
     "FiveMAffinityMask","ProcessLassoAffinityGaming","ProcessLassoProBalance"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — full core unparking + scheduler precision`);
  } else if (cores >= 12) {
    ["DisableCoreParking","EnableMSIMode","DisableDynamicTick","DisablePowerThrottlingAdv",
     "FiveMAffinityMask","ProcessLassoAffinityGaming"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — aggressive core parking + scheduler disabled`);
  } else if (cores >= 8) {
    ["DisableCoreParking","EnableMSIMode","DisableDynamicTick","FiveMAffinityMask"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — core parking disabled, MSI mode enabled`);
  } else if (cores >= 4) {
    ["DisableCoreParking","EnableMSIMode"].forEach(id => ids.add(id));
    reasons.push(`${cores}-thread CPU — core parking disabled`);
  } else {
    ["DisableCoreParking"].forEach(id => ids.add(id));
    if (cores > 0) reasons.push(`${cores}-thread CPU — safe core optimization`);
    else reasons.push("CPU threads unknown — applying safe defaults");
  }

  // ===== CPU BRAND — Ryzen vs Intel Core specific =====
  if (hw.isRyzen) {
    // Ryzen benefits from precision boost-friendly memory settings and MMCSS
    [
      "FiveMGTAProcessPerfOptions","FiveMAffinityMask",
    ].forEach(id => ids.add(id));
    if (hw.cpuGeneration >= 5) {
      // Ryzen 5000+ (Zen 3+) — very fast, mainly needs power plan to be unlimited
      reasons.push(`AMD Ryzen ${hw.cpuGeneration}000-series — Zen 3+ power plan tweaks applied`);
    } else if (hw.cpuGeneration >= 3) {
      // Ryzen 3000 (Zen 2) — benefits from BCLK stability + scheduler
      reasons.push(`AMD Ryzen ${hw.cpuGeneration}000-series (Zen 2) — core parking + scheduler priority tweaks`);
    } else {
      reasons.push(`AMD Ryzen CPU — performance tweaks applied`);
    }
  } else if (hw.isIntelCore) {
    if (hw.cpuGeneration >= 12) {
      // 12th gen+ has E-cores — affinity masking to P-cores helps gaming
      ["FiveMAffinityMask","ProcessLassoAffinityGaming","ProcessLassoProBalance"].forEach(id => ids.add(id));
      reasons.push(`Intel ${hw.cpuGeneration}th gen (has E-cores) — P-core affinity for gaming`);
    } else {
      reasons.push(`Intel Core ${hw.cpuGeneration}th gen — core optimization applied`);
    }
  }

  // ===== GPU =====
  if (hw.isNvidia) {
    // Universal NVIDIA tweaks
    [
      "EnableHAGS","NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaLowLatency",
      "NvidiaOptimizeLatency","NvidiaPowerMizer","NvidiaReflexEnable","NvidiaTripleBufferOff",
      "NvidiaDisableOverlay","NvidiaForceVSyncOff","NvidiaShaderCache","NvidiaMaxPerfMode",
      "FiveMDisableNvidiaTelemetry","FiveMDisablePhysX","FiveMMenuFpsUncap","FiveMReduceShadowQuality",
      "FortniteAffinityPhysical","FortniteForceDirectX12",
    ].forEach(id => ids.add(id));

    if (hw.nvidiaIsLowEnd) {
      // GTX 10xx (Pascal) / GTX 16xx (Turing) — limited VRAM, need shader cache + texture perf
      ["NvShaderDiskCache","NvTextureFilterPerf","NvFXAADriverOff"].forEach(id => ids.add(id));
      reasons.push(`Low-end NVIDIA (GTX/Pascal/Turing) — shader cache maximized, texture filter optimized for limited VRAM`);
    } else if (hw.nvidiaIsRTX) {
      // RTX series — can skip the aggressive texture filter (has more VRAM)
      reasons.push(`NVIDIA RTX GPU (${hw.gpuName}) — full RTX optimization suite`);
    } else {
      // Unknown NVIDIA — apply low-end tweaks as safe default
      ["NvShaderDiskCache","NvFXAADriverOff"].forEach(id => ids.add(id));
      reasons.push(`NVIDIA GPU (${hw.gpuName}) — NVIDIA optimization suite enabled`);
    }
  } else if (hw.isAmdGpu) {
    // AMD discrete GPU (RX series)
    [
      "EnableHAGS","AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency",
      "AmdMaxClockState","AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag",
      "AmdDisableTelemetry","AmdDisableCrashDefender","AmdShaderCache","AmdDisableVSR",
      "AmdDisableVariBright","AmdSmartAccessMemory","AmdAntiLagPlus","AmdTDRTweak",
      "AmdDisableStartupApps",
    ].forEach(id => ids.add(id));
    reasons.push(`AMD discrete GPU (${hw.gpuName}) — full AMD RX optimization suite`);
  } else if (hw.isAMD || hw.isAmdApu) {
    // AMD APU / Vega integrated
    [
      "IGpu_DisableULPS","IGpu_DisableDeepSleep","IGpu_DisableVariBright","IGpu_ForcePerformancePower",
      "IGpu_AmdAntiLag","IGpu_SharedMemoryHint","IGpu_DisableMPO","IGpu_AmdTdrLevel",
      "IGpu_DisableTransparency","IGpu_DisableAnimations","IGpu_DisableXboxGameBar",
      "IGpu_DisableFullscreenOpt","IGpu_UltimatePerformancePlan","IGpu_MaxProcessorState",
      "IGpu_DisableCoreParking","IGpu_GameModeOn","IGpu_SetTimerResolution",
      "IGpu_NetworkThrottling","IGpu_DisableSysMain","IGpu_DisableHAGSForIGpu",
    ].forEach(id => ids.add(id));
    reasons.push(`AMD iGPU/APU (${hw.gpuName}) — Vega/APU tweaks, HAGS disabled (hurts iGPU)`);
  } else if (hw.isIntel) {
    // Intel iGPU — full suite including new tweaks
    [
      "IGpu_Intel_MaxFreq","IGpu_Intel_DisableFreqScaling",
      "IGpu_Intel_TDR","IGpu_Intel_PanelFitter","IGpu_Intel_QSVOff",
      "IGpu_ForcePerformancePower","IGpu_DisableTransparency","IGpu_DisableAnimations",
      "IGpu_DisableXboxGameBar","IGpu_DisableFullscreenOpt","IGpu_UltimatePerformancePlan",
      "IGpu_MaxProcessorState","IGpu_DisableCoreParking","IGpu_GameModeOn",
      "IGpu_SetTimerResolution","IGpu_NetworkThrottling","IGpu_DisableSysMain",
      "IGpu_DisableHAGSForIGpu","IGpu_DisableMPO",
    ].forEach(id => ids.add(id));
    reasons.push(`Intel iGPU (${hw.gpuName}) — Intel driver TDR fix, Panel Fitter off, Quick Sync freed, HAGS disabled`);
  } else {
    // Unknown GPU — safe fallback
    ids.add("EnableHAGS");
    reasons.push("GPU unknown — safe defaults applied (HAGS included)");
  }

  // ===== RAM =====
  const ram = hw.ramGB || 0;
  if (ram >= 32) {
    [
      "DisableMemoryCompression","MemDisableCompression","FiveMDisableMemCompression",
      "DisablePrefetch","MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
      "MemDisableKernelPaging","MemGPUOptimize","FiveMExtendedMemory","FiveMWorkingSet",
    ].forEach(id => ids.add(id));
    reasons.push("32GB+ RAM — memory compression safe to disable, aggressive memory tweaks enabled");
  } else if (ram >= 8) {
    [
      "DisablePrefetch","MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
      "MemDisableKernelPaging","MemGPUOptimize","FiveMExtendedMemory","FiveMWorkingSet",
    ].forEach(id => ids.add(id));
    reasons.push(`${ram}GB RAM — memory tweaks applied, compression kept ON (requires 32GB+ to disable safely)`);
  } else if (ram >= 4) {
    [
      "DisablePrefetch","MemTrimStandbyList","MemTrimOnMinimize","MemDisableKernelPaging",
    ].forEach(id => ids.add(id));
    reasons.push(`${ram}GB+ RAM — memory tweaks applied, compression kept ON`);
  } else if (ram > 0) {
    ["MemTrimOnMinimize","MemSystemCacheBoost"].forEach(id => ids.add(id));
    reasons.push(`Low RAM (${ram}GB) — minimal memory tweaks, compression preserved`);
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
      "Lap_Net_DisableUSBSelSuspend","Lap_Net_WiFiPerfMode",
      "Lap_USBPowerSave","Lap_WifiPerfMode",
      "Lap_TimerResolution","Lap_DisablePowerThrottling","Lap_DisableXboxGameBar",
      "Lap_DisableFullscreenOpt","Lap_MMCSS_Games","Lap_DisableMPO","Lap_VisualPerformance",
      "Lap_DisableHAGS",
    ].forEach(id => ids.add(id));
    // Laptop GPU-specific
    if (hw.isNvidia) {
      ["Lap_NVIDIA_MaxPerformance","Lap_NVIDIA_DisableVsync","Lap_NVIDIA_LowLatency",
       "Lap_NVIDIA_ThreadedOpt","Lap_NVIDIA_DisableMaxQThrottle"].forEach(id => ids.add(id));
    } else if (hw.isAMD || hw.isAmdApu) {
      ["Lap_AMD_DisableULPS","Lap_AMD_DisableVariBright","Lap_AMD_DisableDeepSleep",
       "Lap_AMD_DisableDynamicVoltage","Lap_AMD_ForcePerformance"].forEach(id => ids.add(id));
    } else if (hw.isIntel) {
      ["Lap_Intel_DisableTurboLimits","Lap_Intel_DisableSpeedShift"].forEach(id => ids.add(id));
    }
    reasons.push("Laptop detected (battery present) — full laptop power + Wi-Fi + USB optimization suite");
  }

  // ===== OS =====
  if (os.isWindows11) {
    [
      "Win11TeamsChat","Win11Widgets","Win11Copilot","Win11BingSearch","Win11AdsInStart",
      "Win11EdgeSidebar","Win11OneDriveBackup","Win11StartRecommended","Win11ChatIcon",
      "Win11Snap","Win11NotepadAI","Win11AutoHDR",
      "DebloatCortana","DebloatOneDrive","DebloatXboxApp","DebloatXboxGameBar",
      "DebloatBing","PrivacyActivityHistory","PrivacyDiagFeedback",
      "ServiceRemoteReg","ServiceFax","ServiceRetailDemo",
      "WinTitusConsumerFeatures","WinTitusEdgeDebloat","WinTitusXboxComponents",
    ].forEach(id => ids.add(id));
    reasons.push("Windows 11 detected — Win11 debloat and privacy tweaks included");
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
    reasons.push("Windows 10 detected — Win10 debloat and service tweaks included");
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
