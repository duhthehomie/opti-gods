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
    "Win32PrioritySeparation","SetTimerResolution","SetResponsiveness","GameModeTweaks",
    "DisableHungAppDetection",
    "NetworkThrottling","DisableNagle","InputLagTCP","SetDNSPriority","DisableNDU","OptimizeTCP",
    "DisablePowerThrottling",
    "DisableXboxGameBar","DisableGameDVR","DisablePointerPrecision","DisableAnimations",
    "DisableTelemetry","DisableFastStartup","DisableWindowsError",
    "SetHighPerformancePlan","DisableUSBSuspend",
    "OptimizeRAMUsage","DisablePagefileEncryption",
    "ServiceDiagTrack","ServiceSysMain",
    "PrivacyTelemetry","PrivacyAdvertisingID","PrivacyLocationTracking",
    "FiveMHighPriority","FiveMCacheClear","FiveMNetworkBuffer","FiveMQueueFix",
    "FiveMFullPerfStack","FiveMGTAProcessPerfOptions","FiveMGameModeAdd",
    "WinTitusBgApps","WinTitusFullscreenOpt","WinTitusTeredo","WinTitusIPv4Prefer",
    "WinTitusNotifTray","OOShutupPrivacy",
    "FortniteHighPriority","FortniteDisableThrottling","FortniteDisableVSync",
    "FortniteUncapLobbyFPS","FortniteUncapGameFPS","FortniteDisableMotionBlur",
    "FortniteNetworkBuffer","FortniteInputLatency","FortniteGameMode",
    "DiscordDisableHWAccel","DiscordDisableAnimations","DiscordClearCache",
    "DiscordReduceGPUPriority",
  ];
  CORE.forEach(id => ids.add(id));
  reasons.push("Core performance tweaks (safe for every PC)");

  // ===== CPU THREADS =====
  const cores = hw.cpuCores || 0;
  if (cores >= 12) {
    ["DisableCoreParking","EnableMSIMode","DisableDynamicTick","DisablePowerThrottlingAdv",
     "FiveMAffinityMask","ProcessLassoAffinityGaming","ProcessLassoProBalance"].forEach(id => ids.add(id));
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

  // ===== GPU =====
  if (hw.isNvidia) {
    [
      "EnableHAGS","NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaLowLatency",
      "NvidiaOptimizeLatency","NvidiaPowerMizer","NvidiaReflexEnable","NvidiaTripleBufferOff",
      "NvidiaDisableOverlay","NvidiaForceVSyncOff","NvidiaShaderCache","NvidiaMaxPerfMode",
      "FiveMDisableNvidiaTelemetry","FiveMDisablePhysX","FiveMMenuFpsUncap",
      "FortniteAffinityPhysical","FortniteForceDirectX12",
    ].forEach(id => ids.add(id));
    reasons.push(`NVIDIA GPU (${hw.gpuName}) — full NVIDIA optimization suite enabled`);
  } else if (hw.isAMD) {
    [
      "EnableHAGS","AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency",
      "AmdMaxClockState","AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag",
      "AmdDisableTelemetry","AmdDisableCrashDefender","AmdShaderCache","AmdDisableVSR",
      "AmdDisableVariBright","AmdSmartAccessMemory","AmdAntiLagPlus","AmdTDRTweak",
      "AmdDisableStartupApps",
    ].forEach(id => ids.add(id));
    reasons.push(`AMD GPU (${hw.gpuName}) — full AMD optimization suite enabled`);
  } else if (hw.isIntel) {
    // Intel iGPU — skip HAGS (unreliable), skip NVIDIA/AMD suites
    reasons.push(`Intel GPU (${hw.gpuName}) — iGPU detected, HAGS skipped`);
  } else {
    // Unknown GPU — safe fallback includes HAGS
    ids.add("EnableHAGS");
    reasons.push("GPU unknown — safe defaults applied (HAGS included)");
  }

  // ===== RAM =====
  const ram = hw.ramGB || 0;
  if (ram >= 8) {
    // Browser cap is 8 GB — real system has 16GB+ (almost certainly)
    [
      "DisableMemoryCompression","MemDisableCompression","DisablePrefetch",
      "MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
      "MemDisableKernelPaging","MemGPUOptimize","FiveMExtendedMemory","FiveMWorkingSet",
    ].forEach(id => ids.add(id));
    reasons.push("16GB+ RAM detected — memory compression disabled, aggressive memory tweaks enabled");
  } else if (ram >= 4) {
    [
      "DisablePrefetch","MemTrimStandbyList","MemTrimOnMinimize","MemDisableKernelPaging",
    ].forEach(id => ids.add(id));
    reasons.push(`${ram}GB+ RAM — memory tweaks applied, compression kept ON`);
  } else if (ram > 0) {
    // Low RAM — keep compression, minimal tweaks
    ["MemTrimOnMinimize","MemSystemCacheBoost"].forEach(id => ids.add(id));
    reasons.push(`Low RAM (${ram}GB) — minimal memory tweaks, compression preserved`);
  } else {
    // Unknown — safe subset
    ["DisablePrefetch","MemTrimStandbyList","MemDisableKernelPaging"].forEach(id => ids.add(id));
    reasons.push("RAM unknown — safe memory defaults applied");
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
    // Not Windows — clear everything, still give useful subset
    reasons.push("Non-Windows OS — limited tweaks available");
  }

  // ===== PROFILE NAME =====
  let profile = "Standard Gaming";
  let profileColor = "text-zinc-400";

  if (!hw.loading && !os.loading) {
    const highEnd = cores >= 12 && ram >= 8;
    if (hw.isNvidia && highEnd) { profile = "High-End NVIDIA Rig"; profileColor = "text-green-400"; }
    else if (hw.isNvidia && cores >= 8) { profile = "NVIDIA Gaming"; profileColor = "text-green-400"; }
    else if (hw.isNvidia) { profile = "NVIDIA Gaming PC"; profileColor = "text-green-400"; }
    else if (hw.isAMD && highEnd) { profile = "High-End AMD Rig"; profileColor = "text-red-400"; }
    else if (hw.isAMD) { profile = "AMD Gaming PC"; profileColor = "text-red-400"; }
    else if (hw.isIntel) { profile = "Intel Integrated"; profileColor = "text-blue-400"; }
    else if (highEnd) { profile = "High-End Gaming Rig"; profileColor = "text-amber-400"; }
    else if (cores >= 8 && ram >= 8) { profile = "Performance Gaming"; profileColor = "text-amber-400"; }
    else { profile = "Standard Gaming PC"; profileColor = "text-zinc-400"; }
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
