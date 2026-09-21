import type { HardwareInfo } from "@/hooks/use-hardware-info";
import type { OsInfo } from "@/hooks/use-os-detection";
import { TWEAK_REGISTRY } from "@/lib/tweak-registry";

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
  categories: { performance: number; latency: number; internet: number; stability: number };
}

// Tweak IDs that are primarily about reducing latency/input delay (not raw FPS)
const LATENCY_TWEAK_IDS = new Set([
  "DisableNagle","InputLagTCP","SetDNSPriority","DisableNDU","RegistryDPCLatency",
  "DisableDynamicTick","SetTimerResolution","IGpu_SetTimerResolution","Lap_TimerResolution",
  "FiveMMMCSSAudio","ProcMMCSSGaming","Lap_MMCSS_Games",
  "NvidiaLowLatency","NvidiaOptimizeLatency","NvidiaPreRenderedFrames","NvidiaReflexEnable",
  "NvidiaCUDAPriority","AmdOptimizeLatency","AmdAntiLag","AmdAntiLagPlus",
  "EnableMSIMode","EnableMSIMode_Safe","FiveMDisableLSO","FiveMEnableRSS",
  "FiveMRenderingBoost","FiveMDisableMPO","FiveM1650LowLatencyMode",
  "FiveM1060DisableHAGS","FiveM1650DisableHAGS",
]);

function classifyTweak(id: string, category: string): "performance" | "latency" | "internet" | "stability" {
  if (LATENCY_TWEAK_IDS.has(id) || /Latency|InputLag|DPC|MMCSS|Reflex|TimerRes|LowLatency|AntiLag/i.test(id)) return "latency";
  if (category === "service" || category === "debloat" || category === "privacy" || category === "startup") return "stability";
  if (category === "network") return "internet";
  return "performance";
}

export function computeSmartRecs(hw: HardwareInfo, os: OsInfo): SmartRecs {
  const ids = new Set<string>();
  const reasons: string[] = [];
  const ready = !hw.loading && !os.loading;

  // ===== CORE — every Windows gaming PC benefits from these =====
  const CORE = [
    // Scheduler / responsiveness / timer precision
    "Win32PrioritySeparation",   // sets foreground app CPU quantum — single biggest scheduler FPS tweak
    "SetResponsiveness","GameModeTweaks",
    "DisableHungAppDetection",
    // SetTimerResolution + EnableMSIMode + DisableIPv6 are NOT in CORE anymore (V2 stability pass).
    // They caused SYSTEM_THREAD_EXCEPTION_NOT_HANDLED BSOD + FiveM productId::INVALID assertion in V1.
    // Now they are opt-in only via their tab — generator no longer auto-applies them on every PC.
    // Network
    "NetworkThrottling",         // NetworkThrottlingIndex=0xffffffff — disables multimedia net throttle
    "DisableNagle","InputLagTCP","SetDNSPriority","DisableNDU",
    "EnableTCPAutoTuning","OptimizeTCP",
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
    "MemLargePageSupport",
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
    "ProcessLassoSmartTrim","ProcessLassoRestrain","ProcessTrimWorkingSet",
    "ProcessAutoKillHung","ProcessDisableWindowsErrorReporting",
    "ProcessLassoInstanceBalancer","ProcessLassoProBalance",
    // Registry — DPC latency optimization (reduces audio/input stutter on all systems)
    "RegistryDPCLatency",
    // FiveM — universal game pack
    "FiveMCacheClear","FiveMNetworkBuffer","FiveMQueueFix","FiveMHighPriority","FiveMFixProductId",
    "FiveMFullPerfStack","FiveMGTAProcessPerfOptions","FiveMGameModeAdd",
    "FiveMReduceNPCDensity","FiveMCommandLineTweaks","FiveMDisableLSO","FiveMEnableRSS",
    "FiveMRenderingBoost","FiveMDisableMPO",
    "FiveMReduceShadowQuality","FiveMStreamDistance","FiveMDisableVSync",
    "FiveMMMCSSAudio","FiveMCommandlineMax","FiveMIOPriority",
    "FiveMCitizenDisableMedia","FiveMDisableDWM","FiveMDisableFullscreen",
    "FiveMDisableP2P","FiveMDNSOverride","FiveMSteamChildOff","FiveMSteamOverlayOff",
    "FiveMStreamPool","FiveMWorkingSet","FiveMExtendedMemory","FiveMAffinityMask",
    "FiveMDisableMemCompression",
    // Registry — safe kernel tweaks every gaming PC benefits from
    "RegistryNTFSOptimize","RegistryIOPageLock","RegistryLargePageHeap",
    // Scheduler precision — reduces frame time variance on all CPUs
    "DisableDynamicTick",
    // Advanced Network — safe for all PCs
    "NetDNSCloudflare","NetDisableQoS","NetInterruptModeration","NetRSSQueues","NetAdapterPowerSave","NetTCPChimneyOffload",
    // NOTE: NetDNSGoogle is intentionally EXCLUDED — it is a manual alternative to NetDNSCloudflare.
    // Only one DNS provider should be applied; Cloudflare is recommended by default for lower latency.
    // Process Scheduling — safe for all gaming PCs
    "ProcMMCSSGaming","ProcGPUSchedulerHigh",
    // WinUtil
    "WinTitusBgApps","WinTitusFullscreenOpt","WinTitusTeredo","WinTitusIPv4Prefer",
    "WinTitusNotifTray","OOShutupPrivacy","WinTitusConsumerFeatures",
    "WinTitusEdgeDebloat","WinTitusXboxComponents",
    "WinTitusDisplayPerf","WinTitusEdgeRemove","WinTitusPosh7Telemetry",
    "WinTitusShowExtensions","WinTitusShowHidden","WinTitusStorageSense","WinTitusWPBT",
    "WinTitusClassicMenu","WinTitusAdobeBlock","WinTitusRazerBlock",
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
    // Spotify — run in background without stealing FPS (safe universally — no-ops if Spotify not installed)
    "SpotifyLowPriority","SpotifyDisableGPU","SpotifyDisableAutoUpdate","SpotifyLimitBandwidth",
    // COD / Warzone — IFEO + shader cache + DirectX (safe no-ops if COD not installed)
    "CodGPUPriority","CodDefenderExclusion","CodDirectXQueue","CodVRAMShaderBudget",
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
    // AmdCpuPowerPinMax pins CPU min/max performance state to 100% for all Ryzen desktops
    // = Precision Boost 2 operates without Windows frequency floor drops
    ["FiveMGTAProcessPerfOptions","FiveMAffinityMask","AmdCpuPowerPinMax",
     "AmdCpuCapabilities","AmdCpuCoalescingOff","AmdCpuCStatePolicy","AmdCpuSchedulerHint",
     "ProcNUMAAware","ProcAffinityFPS",
    ].forEach(id => ids.add(id));
    if (hw.cpuGeneration >= 5) {
      reasons.push(`AMD Ryzen ${hw.cpuGeneration}000-series — Zen 3+ power plan + Precision Boost 2 pinned to 100%`);
    } else if (hw.cpuGeneration >= 3) {
      ["FiveM3500CoreAffinity","FiveM3500PerfPlan","FiveM5600CoreAffinity","FiveM5600PowerPlan"].forEach(id => ids.add(id));
      if (hw.cpuLabel && /3500/i.test(hw.cpuLabel)) {
        reasons.push(`AMD Ryzen 5 3500 detected — core affinity 0x3F + Boost pinned 100%`);
      } else if (hw.cpuLabel && /5600/i.test(hw.cpuLabel)) {
        reasons.push(`AMD Ryzen 5600 detected — Zen 3 core affinity + power plan + Boost pinned 100%`);
      } else {
        reasons.push(`AMD Ryzen ${hw.cpuGeneration}000-series — core + scheduler + Precision Boost 2 pinned 100%`);
      }
    } else {
      reasons.push(`AMD Ryzen CPU — performance tweaks + Precision Boost pinned to 100%`);
    }
  } else if (hw.isIntelCore) {
    if (hw.cpuGeneration >= 12) {
      ["FiveMAffinityMask","ProcessLassoAffinityGaming","FiveMIntel14PcoreAffinity","FiveMIntel14PowerPlan"].forEach(id => ids.add(id));
      reasons.push(`Intel ${hw.cpuGeneration}th gen (has E-cores) — P-core affinity for gaming, Ultra Performance plan`);
    } else if (hw.cpuGeneration >= 6 && hw.cpuGeneration < 12) {
      // 6th–11th gen Intel desktop (Skylake / Kaby Lake / Coffee Lake / Comet Lake / Rocket Lake)
      // No E-cores — max all cores, aggressive C-state suppression, full turbo
      ["DisableCoreParking","DisableDynamicTick","Win32PrioritySeparation",
       "SetHighPerformancePlan","DisablePowerThrottling","DisablePowerThrottlingAdv",
       "ProcMMCSSGaming","ProcGPUSchedulerHigh",
      ].forEach(id => ids.add(id));
      if (hw.cpuGeneration === 6) {
        // i5-6600K / i7-6700: Skylake — no E-cores, all cores equal, push them hard
        reasons.push(`Intel ${hw.cpuGeneration}th gen Skylake (i5-6600K / i7-6700) — all cores maximised, C-states suppressed, Turbo pinned to 100%`);
      } else {
        reasons.push(`Intel ${hw.cpuGeneration}th gen — core parking disabled, full performance state applied`);
      }
    } else {
      reasons.push(`Intel Core ${hw.cpuGeneration}th gen — core optimization applied`);
    }
  }

  // ===== GPU =====
  // Hybrid-aware: each vendor branch runs in parallel and is gated by the
  // corresponding flag (instead of an else-if chain). A laptop with Intel
  // iGPU + NVIDIA dGPU now gets BOTH bundles applied so the user is covered
  // whether the game runs on the iGPU or the dGPU.
  if (hw.isNvidia) {
    [
      "NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaLowLatency",
      "NvidiaOptimizeLatency","NvidiaPowerMizer","NvidiaReflexEnable","NvidiaTripleBufferOff",
      "NvidiaDisableOverlay","NvidiaForceVSyncOff","NvidiaShaderCache","NvidiaMaxPerfMode",
      "NvidiaAnisoFiltering","NvidiaOpenGLOpt","NvidiaThreadedOpt","NvidiaVRAMMax",
      "NvidiaGSyncOptimize","NvidiaDisableHDMIAudio","NvidiaGpuBgOptimize",
      "FiveMDisableNvidiaTelemetry","FiveMDisablePhysX","FiveMFixNvidiaOverlay",
      "FiveMGPUPriorityStack",
      // New NVIDIA tweaks
      "NvidiaCUDAPriority","NvidiaShaderCacheUnlimited","NvidiaFrameBufferOpt","NvidiaDisableAnsel","NvidiaDisableShadowPlay",
      // NOTE: NvidiaDisableContainerLS is intentionally EXCLUDED from auto-recommendations.
      // Stopping NVDisplay.ContainerLocalSystem causes NVIDIA Overlay 0x80000003 crash for many users.
      // It is exposed in the UI as a manual opt-in tweak with an explicit warning.
    ].forEach(id => ids.add(id));

    if (hw.nvidiaIsLowEnd) {
      // HAGS HURTS GTX 10xx/16xx — do NOT enable it for these cards
      ["NvShaderDiskCache","NvTextureFilterPerf","NvFXAADriverOff"].forEach(id => ids.add(id));
      if (hw.gpuName && /1650/i.test(hw.gpuName)) {
        ["FiveM1650DisableHAGS","FiveM1650VRAMBudget","FiveM1650DisableAnsel","FiveM1650LowLatencyMode"].forEach(id => ids.add(id));
        reasons.push(`GTX 1650 SUPER — HAGS disabled (Pascal/Turing = micro-stutters with HAGS), 4GB VRAM unlocked, Ansel removed, Low Latency Ultra`);
      } else if (hw.gpuName && /1060/i.test(hw.gpuName)) {
        ["FiveM1060VRAMFlag","FiveM1060DisableHAGS","FiveM1060AnselDisable"].forEach(id => ids.add(id));
        reasons.push(`GTX 1060 — HAGS disabled (Pascal = micro-stutters with HAGS), 6GB VRAM unlocked, Ansel removed`);
      } else {
        reasons.push(`Low-end NVIDIA (GTX/Pascal/Turing) — HAGS disabled, shader cache maximized, texture filter optimized`);
      }
    } else if (hw.nvidiaIsRTX) {
      // HAGS only benefits RTX 2000+ on Windows 11 — safe to enable
      ids.add("EnableHAGS");
      ids.add("NvidiaRTXVideoOff");
      // RTX 5000 series (Ada Lovelace successor) — specific VRAM/HAGS/LL tweaks
      if (hw.gpuName && /506[0-9]|507[0-9]|508[0-9]|509[0-9]|50[7-9][0-9]/i.test(hw.gpuName)) {
        ["FiveM5060VRAMBudget","FiveM5060EnableHAGS","FiveM5060LowLatency"].forEach(id => ids.add(id));
        reasons.push(`RTX 5000 series (${hw.gpuName}) — VRAM budget maximised, HAGS enabled, Low Latency Ultra`);
      } else {
        reasons.push(`NVIDIA RTX GPU (${hw.gpuName}) — HAGS enabled (RTX 2000+), full RTX optimization suite + DPC latency reduction`);
      }
    } else {
      // Mid-range GTX (non-Pascal/Turing low-end, non-RTX) — enable HAGS conservatively
      ids.add("EnableHAGS");
      ["NvShaderDiskCache","NvFXAADriverOff"].forEach(id => ids.add(id));
      reasons.push(`NVIDIA GPU (${hw.gpuName}) — NVIDIA optimization suite enabled`);
    }
  }
  if (hw.isAmdGpu) {
    [
      "EnableHAGS","AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency",
      "AmdMaxClockState","AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag",
      "AmdDisableTelemetry","AmdDisableCrashDefender","AmdShaderCache","AmdDisableVSR",
      "AmdDisableVariBright","AmdSmartAccessMemory","AmdAntiLagPlus","AmdTDRTweak",
      "AmdDisableStartupApps","AmdDisableFreeSyncCompetitive","AmdFluidMotionFrames",
      "AmdImageSharpening","AmdDisableHDMIAudio","AmdDisableReLive",
    ].forEach(id => ids.add(id));

    // New AMD tweaks — gate by GPU generation
    const amdDiscreteName = hw.gpus.find(g => g.vendor === "amd" && !g.isIntegrated)?.name || hw.gpuName;
    const isRX6000Plus = amdDiscreteName && /RX\s*(6[0-9]{3}|7[0-9]{3}|8[0-9]{3}|9[0-9]{3})/i.test(amdDiscreteName);
    if (isRX6000Plus) {
      ["AmdResizableBAR","AmdRadeonBoost","AmdEnhancedSync"].forEach(id => ids.add(id));
    } else {
      ["AmdRadeonBoost","AmdEnhancedSync"].forEach(id => ids.add(id));
    }
    reasons.push(`AMD discrete GPU (${amdDiscreteName}) — full AMD RX optimization suite`);
  }
  if (hw.isAmdApu) {
    const apuName = hw.gpus.find(g => g.vendor === "amd" && g.isIntegrated)?.name || hw.gpuName;
    [
      "IGpu_DisableULPS","IGpu_DisableDeepSleep","IGpu_DisableVariBright","IGpu_ForcePerformancePower",
      "IGpu_AmdAntiLag","IGpu_SharedMemoryHint","IGpu_DisableMPO","IGpu_AmdTdrLevel",
      "IGpu_DisableTransparency","IGpu_DisableAnimations","IGpu_DisableXboxGameBar",
      "IGpu_DisableFullscreenOpt","IGpu_UltimatePerformancePlan","IGpu_MaxProcessorState",
      "IGpu_DisableCoreParking","IGpu_GameModeOn","IGpu_SetTimerResolution",
      "IGpu_NetworkThrottling","IGpu_DisableSysMain","IGpu_DisableHAGSForIGpu",
      "IGpu_AmdDisableHDCP","IGpu_AmdVegaAudioOff",
      "IGpu_CloseBrowserGPU","IGpu_DisableDWMColorSpace","IGpu_DisableHDR","IGpu_DisableNightLight",
    ].forEach(id => ids.add(id));
    reasons.push(`AMD iGPU/APU (${apuName}) — Vega/APU tweaks, HAGS disabled`);
  }
  if (hw.isIntel) {
    // Only apply the Intel iGPU bundle when an Intel iGPU is actually present
    // (an Arc dGPU would also set isIntel but those tweaks would be wrong for it).
    const intelIntegrated = hw.gpus.find(g => g.vendor === "intel" && g.isIntegrated);
    if (intelIntegrated || hw.gpus.length === 0) {
      [
        "IGpu_Intel_MaxFreq","IGpu_Intel_DisableFreqScaling",
        "IGpu_Intel_TDR","IGpu_Intel_PanelFitter","IGpu_Intel_QSVOff",
        "IGpu_ForcePerformancePower","IGpu_DisableTransparency","IGpu_DisableAnimations",
        "IGpu_DisableXboxGameBar","IGpu_DisableFullscreenOpt","IGpu_UltimatePerformancePlan",
        "IGpu_MaxProcessorState","IGpu_DisableCoreParking","IGpu_GameModeOn",
        "IGpu_SetTimerResolution","IGpu_NetworkThrottling","IGpu_DisableSysMain",
        "IGpu_DisableHAGSForIGpu","IGpu_DisableMPO",
        "IGpu_CloseBrowserGPU","IGpu_DisableDWMColorSpace","IGpu_DisableHDR","IGpu_DisableNightLight",
      ].forEach(id => ids.add(id));
      const intelName = intelIntegrated?.name || hw.gpuName;
      reasons.push(`Intel iGPU (${intelName}) — Intel driver TDR fix, Panel Fitter off, HAGS disabled${hw.isHybridGpu ? " (hybrid — applied alongside discrete GPU tweaks)" : ""}`);
    }
  }
  if (!hw.isNvidia && !hw.isAmdGpu && !hw.isAmdApu && !hw.isIntel) {
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
      "MemDisableGPUPagefile","MemMovePagefileFast","MemFixedPagefile",
    ].forEach(id => ids.add(id));
    reasons.push("32GB+ RAM — memory compression disabled, fixed pagefile (prevents runtime resize stutters), aggressive tweaks enabled");
  } else if (ram >= 8) {
    [
      "DisablePrefetch","MemDisableSuperfetch","MemTrimStandbyList","MemTrimOnMinimize",
      "MemDisableKernelPaging","MemGPUOptimize","FiveMExtendedMemory","FiveMWorkingSet",
      // Fixed pagefile for 8-31GB: prevents Windows from resizing the pagefile mid-game (causes stutters)
      // MemFixedPagefile calculates 25% min / 100% max of actual RAM at runtime — safe for all configs
      "MemFixedPagefile",
    ].forEach(id => ids.add(id));
    reasons.push(`${ram}GB RAM — fixed pagefile (prevents mid-game resize stutters), compression kept ON (requires 32GB+ to disable safely)`);
  } else if (ram >= 4) {
    [
      "DisablePrefetch","MemTrimStandbyList","MemTrimOnMinimize","MemDisableKernelPaging",
      // Fixed pagefile for 4-7GB: critical — low RAM means pagefile is actively used; fixed size prevents fragmentation
      "MemFixedPagefile",
    ].forEach(id => ids.add(id));
    reasons.push(`${ram}GB RAM — fixed pagefile applied (low RAM systems need stable swap space for crash prevention)`);
  } else if (ram > 0) {
    ["MemTrimOnMinimize","MemSystemCacheBoost","MemFixedPagefile"].forEach(id => ids.add(id));
    reasons.push(`Low RAM (${ram}GB) — fixed pagefile + minimal memory tweaks`);
  } else {
    ["DisablePrefetch","MemTrimStandbyList","MemDisableKernelPaging","MemFixedPagefile"].forEach(id => ids.add(id));
    reasons.push("RAM unknown — fixed pagefile + safe memory defaults applied");
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
    // Parallel branches — a hybrid laptop (Intel iGPU + NVIDIA dGPU) gets BOTH
    // vendor packs so the right tweaks apply whichever GPU each game uses.
    if (hw.isNvidia) {
      ["Lap_NVIDIA_MaxPerformance","Lap_NVIDIA_DisableVsync","Lap_NVIDIA_LowLatency",
       "Lap_NVIDIA_ThreadedOpt","Lap_NVIDIA_DisableMaxQThrottle"].forEach(id => ids.add(id));
    }
    if (hw.isAmd) {
      ["Lap_AMD_DisableULPS","Lap_AMD_DisableVariBright","Lap_AMD_DisableDeepSleep",
       "Lap_AMD_DisableDynamicVoltage","Lap_AMD_ForcePerformance"].forEach(id => ids.add(id));
    }
    if (hw.isIntel) {
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
      // Win11 gaming-specific tweaks
      "Win11DisableVBS","Win11DisableHVCI","Win11ParkingCoreOverride","Win11ProcessorIdleMin",
    ].forEach(id => ids.add(id));
    reasons.push("Windows 11 — Win11 debloat, VBS/HVCI disable, privacy, and service tweaks included");
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

  // ===== CATCH-ALL: every remaining safe/aggressive registry tweak =====
  // After hardware branches run, sweep TWEAK_REGISTRY and add anything not already
  // included that passes the vendor/OS filter. This ensures the recommendation
  // covers all 500+ tweaks — not just the ~320 in the curated hardcoded lists.
  const CATCH_ALL_EXCLUDED = new Set([
    "EnableMSIMode",          // V2.1: BSOD risk — use EnableMSIMode_Safe instead
    "DisableIPv6",            // V2.1: breaks FiveM/Rockstar/Xbox — use WinTitusIPv4Prefer
    "NvidiaDisableContainerLS", // known crash: NVIDIA Overlay 0x80000003 on many systems
  ]);
  for (const tweak of TWEAK_REGISTRY) {
    if (ids.has(tweak.id)) continue;
    if (tweak.safety === "expert") continue;
    if (CATCH_ALL_EXCLUDED.has(tweak.id)) continue;
    if (tweak.category === "game-detection") continue; // requires actual game scan
    // Vendor / hardware gating — same rules as the manual branches above
    if (tweak.category === "nvidia" && !hw.isNvidia) continue;
    if (tweak.category === "amd"    && !hw.isAmdGpu) continue;
    if (tweak.category === "intgpu" && !hw.isAmdApu && !hw.hasIntegratedGpu) continue;
    if (tweak.category === "laptop" && !hw.isLaptop) continue;
    ids.add(tweak.id);
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

  // ===== CATEGORY BREAKDOWN =====
  const categories = { performance: 0, latency: 0, internet: 0, stability: 0 };
  Array.from(ids).forEach(id => {
    const tweak = TWEAK_REGISTRY.find(t => t.id === id);
    const cat = tweak?.category ?? "registry";
    categories[classifyTweak(id, cat)]++;
  });

  return { ids, profile, profileColor, reasons, gpuLabel, ramLabel, cpuLabel, osLabel, ready, categories };
}
