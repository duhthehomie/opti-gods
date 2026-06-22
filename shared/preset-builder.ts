// Single shared preset-selection function for AI generators (Aether admin chat,
// Opti Gods user chat, admin Preset Generator tab). Replaces ad-hoc preset
// construction so every path produces hardware-filtered, expert-gated output.
//
// Why centralised: V1 had three different preset code paths and they drifted —
// the user chat kept emitting `EnableMSIMode` / `SetTimerResolution` /
// `DisableIPv6` long after the V2.1 stability surgery removed them from the
// auto-CORE set (those three caused BSODs / FiveM crashes / boot hangs).
// `buildSafePreset` enforces V2.1 rules in one place.

export type PresetGpuVendor = "nvidia" | "amd" | "intel" | "unknown";
export type PresetOsVersion = "win11" | "win10" | "unknown";
export type PresetGoal = "balanced" | "fps" | "latency" | "stability";

export interface PresetHardware {
  gpuVendor: PresetGpuVendor;
  gpuName?: string;          // e.g. "RTX 3070", "RX 6700 XT"
  cpuBrand?: "intel" | "amd" | "unknown";
  cpuLabel?: string;         // e.g. "Ryzen 5 5600X"
  cpuCores?: number;         // logical thread count
  cpuGeneration?: number;    // Intel gen / Ryzen series digit
  ramGB?: number;
  osVersion?: PresetOsVersion;
  isLaptop?: boolean;
  hasDiscreteGpu?: boolean;  // when true, iGPU tweaks are excluded
}

export interface SafePreset {
  /** Human-readable profile, e.g. "RTX FPS Build". */
  profile: string;
  /** Goal used to seed the preset. */
  goal: PresetGoal;
  /** One-line summary of detected hardware for prompts/UI. */
  hardwareSummary: string;
  /** Tweak IDs auto-included for the user — safe + recommended only. */
  core: string[];
  /** Tweak IDs flagged expert/dangerous — REQUIRE explicit opt-in to apply. */
  expert: string[];
  /** Tweak IDs the AI/admin asked for but were blocked (forbidden or hardware-mismatched). */
  blocked: { id: string; reason: string }[];
  /** Hardware/goal reasoning strings for UI / model explanation. */
  reasons: string[];
}

/**
 * The three tweaks the V2.1 stability surgery removed from auto-CORE.
 * They are still legal tweaks, but the AI/admin generators must NEVER include
 * them in `core` — only in `expert` and only when explicitly opted in.
 *
 * - EnableMSIMode: V1 BSOD `SYSTEM_THREAD_EXCEPTION_NOT_HANDLED`
 *   (use the safer `EnableMSIMode_Safe` from the V2.2 driver-reapply set).
 * - DisableIPv6: V1 FiveM `productId != ProductID::INVALID` crash; also breaks
 *   Discord voice / Xbox party chat / Rockstar entitlement.
 * - SetTimerResolution: V1 boot hang on Ryzen APUs / Intel chipsets
 *   (use `DisableDynamicTick` instead — that's already in CORE).
 */
export const FORBIDDEN_AUTO_TWEAKS = [
  "EnableMSIMode",
  "DisableIPv6",
  "SetTimerResolution",
] as const;

/**
 * Tweaks that need user understanding before applying. The AI generators must
 * NEVER auto-include these; they belong in `expert` only.
 *
 * Sourced from `safety: "expert"` entries in `client/src/lib/tweak-registry.ts`
 * plus the three FORBIDDEN_AUTO_TWEAKS above (which carry the strongest "do
 * not auto-include" semantics post-V2.1).
 */
export const EXPERT_TWEAK_IDS: ReadonlySet<string> = new Set<string>([
  ...FORBIDDEN_AUTO_TWEAKS,
  "DisableMemoryCompression",
  "MemDisableCompression",
  "DisablePagefileEncryption",
  "DisableDefender",
  "SysHypervisorOff",
  "Win11DisableVBS",
  "Win11DisableHVCI",
  "Lap_Intel_DisableECores",
]);

/**
 * GPU vendor → tweak ID prefix allow/deny rules. Tweaks with these prefixes
 * are gated to matching GPUs to prevent the AI from including AMD tweaks on
 * an NVIDIA box (or vice versa).
 */
const NVIDIA_PREFIXES = ["Nvidia", "Nv", "NvShader", "NvTexture", "NvFXAA", "FiveM1060", "FiveM1650", "FiveMDisableNvidia", "FiveMDisablePhysX", "FiveMFixNvidiaOverlay", "FiveMGPUPriorityStack"];
const AMD_DGPU_PREFIXES = ["Amd"];
const AMD_IGPU_PREFIXES = ["IGpu_Amd", "IGpu_Vega"];
const INTEL_IGPU_PREFIXES = ["IGpu_Intel"];
const GENERIC_IGPU_PREFIXES = ["IGpu_"]; // matched after the vendor-specific iGPU prefixes

function startsWithAny(id: string, prefixes: readonly string[]): boolean {
  for (const p of prefixes) if (id.startsWith(p)) return true;
  return false;
}

/**
 * Whether `id` is compatible with the provided hardware. Universal tweaks
 * (Win32PrioritySeparation, NetDNSCloudflare, etc.) are not gated by GPU
 * vendor — only the vendor-prefixed families are.
 */
function isHardwareCompatible(id: string, hw: PresetHardware): { ok: boolean; reason?: string } {
  const isNvidiaTweak = startsWithAny(id, NVIDIA_PREFIXES);
  const isAmdDgpuTweak = startsWithAny(id, AMD_DGPU_PREFIXES) && !startsWithAny(id, AMD_IGPU_PREFIXES);
  const isAmdIgpuTweak = startsWithAny(id, AMD_IGPU_PREFIXES);
  const isIntelIgpuTweak = startsWithAny(id, INTEL_IGPU_PREFIXES);
  const isGenericIgpuTweak = startsWithAny(id, GENERIC_IGPU_PREFIXES) && !isAmdIgpuTweak && !isIntelIgpuTweak;

  if (isNvidiaTweak && hw.gpuVendor !== "nvidia") {
    return { ok: false, reason: `NVIDIA tweak skipped — detected GPU vendor is ${hw.gpuVendor}` };
  }
  if (isAmdDgpuTweak && hw.gpuVendor !== "amd") {
    return { ok: false, reason: `AMD GPU tweak skipped — detected GPU vendor is ${hw.gpuVendor}` };
  }
  // iGPU tweaks: skip when a discrete GPU is present, regardless of vendor match
  if ((isAmdIgpuTweak || isIntelIgpuTweak || isGenericIgpuTweak) && hw.hasDiscreteGpu) {
    return { ok: false, reason: "iGPU tweak skipped — discrete GPU is present" };
  }
  if (isAmdIgpuTweak && hw.gpuVendor !== "amd") {
    // AMD iGPU tweaks (Vega/APU) only on AMD systems
    return { ok: false, reason: `AMD iGPU tweak skipped — vendor is ${hw.gpuVendor}` };
  }
  if (isIntelIgpuTweak && hw.gpuVendor !== "intel") {
    return { ok: false, reason: `Intel iGPU tweak skipped — vendor is ${hw.gpuVendor}` };
  }
  // Laptop-gated tweaks (Lap_*) only on laptops
  if (id.startsWith("Lap_") && !hw.isLaptop) {
    return { ok: false, reason: "Laptop tweak skipped — desktop detected" };
  }
  // Win11-gated tweaks
  if (id.startsWith("Win11") && hw.osVersion === "win10") {
    return { ok: false, reason: "Win11-only tweak skipped — Windows 10 detected" };
  }
  return { ok: true };
}

/**
 * Universal core: every Windows gaming PC benefits.
 */
const UNIVERSAL_CORE: string[] = [
  "Win32PrioritySeparation", "SetResponsiveness", "GameModeTweaks",
  "DisableHungAppDetection", "NetworkThrottling", "DisableNagle",
  "InputLagTCP", "SetDNSPriority", "DisableNDU", "EnableTCPAutoTuning",
  "OptimizeTCP", "DisablePowerThrottling", "DisablePowerThrottlingAdv",
  "DisableXboxGameBar", "DisableGameDVR", "DisableAnimations",
  "SysVisualBestPerf", "SysHibernateOff", "DisableFastStartup",
  "DisableWindowsError", "SetHighPerformancePlan", "DisableUSBSuspend",
  "DisableCoreParking", "DisableDynamicTick", "OptimizeRAMUsage",
  "DisablePrefetch", "MemTrimStandbyList", "MemTrimOnMinimize",
  "NetDNSCloudflare", "NetDisableQoS", "NetInterruptModeration",
  "NetRSSQueues", "NetAdapterPowerSave", "ProcMMCSSGaming",
  "ProcGPUSchedulerHigh", "PrivacyTelemetry", "PrivacyAdvertisingID",
  "DisablePointerPrecision", "DisableAutoUpdate",
];

/** Extra network tweaks — safe for any gaming PC */
const NET_EXTRA: string[] = [
  "NetMTUAutotune", "NetTCPAutotuneAggressive", "NetRSSTuning",
  "NetDisableLargeSendOffload", "NetTCPChimneyOffload",
  "ProcNUMAAware", "ProcAffinityFPS",
];

/** Extra memory tweaks — safe for any gaming PC */
const MEMORY_EXTRA: string[] = [
  "MemFixedPagefile", "MemSystemCacheBoost", "MemSetWorkingSetSize",
  "MemDisableHeapTermination", "MemGPUOptimize", "EnableLargeSystemCache",
  "MemGPUSchedulerTweak", "MemDisableKernelPaging", "MemDisableSuperfetch",
  "MemLargePageSupport",
];

/** Registry / system tuning — safe for any gaming PC */
const REGISTRY_SYSTEM: string[] = [
  "RegistryNTFSOptimize", "RegistryIOPageLock", "RegistryDPCLatency",
  "RegistryLargePageHeap",
];

/** Privacy extras beyond telemetry/ad-ID */
const PRIVACY_EXTRA: string[] = [
  "PrivacyActivityHistory", "PrivacyLocationTracking", "PrivacyDiagFeedback",
];

/** Windows debloat — safe app + UWP removal */
const DEBLOAT_TWEAKS: string[] = [
  "DebloatCortana", "DebloatOneDrive", "DebloatXboxApp", "DebloatXboxGameBar",
  "DebloatXboxIdentity", "DebloatBing", "DebloatWeather", "DebloatNews",
  "DebloatMaps", "DebloatSolitaire", "DebloatMixedReality", "DebloatSkype",
  "DebloatZune", "DebloatGrooveMusic", "DebloatOfficeHub", "DebloatFeedback",
  "DebloatGetHelp", "DebloatMSPaint3D", "DebloatWindowsCamera",
  "DebloatYourPhone", "DebloatClipchamp", "DebloatPowerAutomate",
  "DebloatQuickAssist", "DebloatTeamsConsumer", "DebloatAlarmsAndClock",
];

/** Service optimizations — clearly non-essential services */
const SERVICE_SAFE: string[] = [
  "ServiceDiagTrack", "ServiceWMPNetworkSvc", "ServiceFax",
  "ServiceRetailDemo", "ServiceMapsBroker", "ServiceTrkWks",
  "ServiceLltdsvc", "ServiceAeLookupSvc", "ServiceWbioSrvc",
  "ServiceFDHost", "ServiceDusmSvc", "ServicePcaSvc",
  "ServiceDPS", "ServiceSysMain", "ServiceRemoteReg",
  "ServiceTabletInput", "ServiceWerSvc", "ServiceWSearch",
  "ServicePrintSpooler",
];

/** Startup app tweaks — disable launchers from auto-starting */
const STARTUP_TWEAKS: string[] = [
  "su_ea_app", "su_epic", "su_ubisoft", "su_battlenet",
  "su_razer", "su_chrome", "su_firefox", "su_edge_startup", "su_obs",
  "su_steam", "su_discord", "su_nvidia", "su_amdradeon", "su_onedrive",
  "su_spotify", "su_teams", "su_zoom", "su_skype", "su_logitech",
  "su_corsair", "su_msiab", "su_rtss", "su_ccleaner", "su_realtek",
];

/** Discord While Gaming — reduce Discord's CPU/GPU overhead while in-game */
const DISCORD_TWEAKS: string[] = [
  "DiscordDisableRichPresence", "DiscordDisableGifAutoplay",
  "DiscordMinimizeBgLoad", "DiscordSuppressNotifications",
  "DiscordDisableSpellcheck", "DiscordClearCache",
  "DiscordDisableAnimations", "DiscordDisableClips",
  "DiscordDisableCrashHandler", "DiscordDisableHWAccel",
  "DiscordDisableOverlay", "DiscordDisableStreaming",
  "DiscordDisableUpdateCheck", "DiscordDisableVAD",
  "DiscordLowerVoiceQuality", "DiscordLowPriority",
  "DiscordOptimizeCodec", "DiscordReduceGPUPriority",
];

/** Process extras — working set trim, error reporting, hung process kill */
const PROCESS_EXTRA: string[] = [
  "ProcessTrimWorkingSet", "ProcessDisableWindowsErrorReporting",
  "ProcessAutoKillHung",
];

/** CPU game priority tweaks — IFEO-based for common launchers */
const CPU_GAME_IFEO: string[] = [
  "CpuFortniteIFEO", "CpuCodIFEO", "CpuGenericGameIFEO",
  "CpuBoostModeAggressive", "CpuIdleMin100",
];

/** FiveM tweaks safe for any GPU/CPU */
const FIVEM_UNIVERSAL: string[] = [
  "FiveMCacheClear", "FiveMHighPriority", "FiveMExtendedMemory",
  "FiveMNetworkBuffer", "FiveMDisableVSync", "FiveMStreamDistance",
  "FiveMDisableFullscreen", "FiveMDisableDWM", "FiveMAffinityMask",
  "FiveMIOPriority", "FiveMDisableP2P", "FiveMDNSOverride",
  "FiveMQueueFix", "FiveMWorkingSet", "FiveMStreamPool",
  "FiveMMenuFpsUncap", "FiveMDisableLSO", "FiveMEnableRSS",
  "FiveMReduceNPCDensity", "FiveMReduceShadowQuality",
  "FiveMCommandLineTweaks", "FiveMFullPerfStack",
  "FiveMGTAProcessPerfOptions", "FiveMGameModeAdd",
  "FiveMRenderingBoost", "FiveMCitizenDisableMedia",
  "FiveMSteamChildOff", "FiveMCommandlineMax",
  "FiveMSteamOverlayOff", "FiveMMMCSSAudio", "FiveMDisableMPO",
  "FiveMFixProductId",
];

/** FiveM Ryzen CPU affinity tweaks — AMD only */
const FIVEM_RYZEN_AFFINITY: string[] = [
  "FiveM3500CoreAffinity", "FiveM3500PerfPlan",
  "FiveM5600CoreAffinity", "FiveM5600PowerPlan",
];

/** FiveM Intel 12th–14th gen hybrid CPU tweaks (P-core affinity + Ultra perf plan) */
const FIVEM_INTEL_12_14: string[] = [
  "FiveMIntel14PcoreAffinity", "FiveMIntel14PowerPlan",
];

/** FiveM tweaks that require NVIDIA */
const FIVEM_NVIDIA: string[] = [
  "FiveMDisablePhysX", "FiveMDisableNvidiaTelemetry",
  "FiveMFixNvidiaOverlay", "FiveMGPUPriorityStack",
];

/** Fortnite performance pack */
const FORTNITE_TWEAKS: string[] = [
  "FortniteHighPriority", "FortniteUncapLobbyFPS", "FortniteUncapGameFPS",
  "FortniteDisableVSync", "FortniteEngineStreaming", "FortniteDisableMotionBlur",
  "FortniteNetworkBuffer", "FortniteLowShadows", "FortniteDisableLumen",
  "FortniteForceDirectX12", "FortniteDisableRecording", "FortniteAffinityPhysical",
  "FortniteInputLatency", "FortniteGameMode", "FortniteDisableThrottling",
];

/** Rust performance pack */
const RUST_TWEAKS: string[] = [
  "RustHighPriority", "RustDisableThrottling", "RustGameMode",
  "RustFPSUncap", "RustDisableVSync", "RustLowShadows",
  "RustDisableBloom", "RustDisableMotionBlur", "RustWaterOff",
  "RustGrassShadowOff", "RustNetworkBuffer", "RustOcclusionOff",
];

/** Roblox performance pack */
const ROBLOX_TWEAKS: string[] = [
  "RobloxHighPriority", "RobloxDisableThrottling", "RobloxGameMode",
  "RobloxFPSUnlock", "RobloxDisablePostFX", "RobloxReduceLightUpdates",
  "RobloxNetworkBuffer", "RobloxDisableSSAO", "RobloxNagleOff",
];

/** Game detection packs — auto-detect install path and apply targeted tweaks */
const GAME_DETECT_PACKS: string[] = [
  "game_valorant", "game_cod", "game_apex", "game_warzone",
  "game_lol", "game_overwatch", "game_siege", "game_rust",
  "game_minecraft", "game_roblox", "game_tarkov", "game_dbd",
  "game_dota2", "game_warframe", "game_forza", "game_readyornot",
  "game_phasmo", "game_battlefield", "game_gta5", "game_fivem",
  "game_rocketleague", "game_arcraiders", "game_marvelrivals",
  "game_007firstlight", "game_fortnite", "game_pubg",
];

/** Universal system tweaks not in the core arrays */
const SYSTEM_EXTRA: string[] = [
  "DisableAutoMaintenance", "DisableCTFMonTracking",
  "DisableSearchIndexer", "DisableTelemetry",
  "OOShutupPrivacy", "EnableMSIMode_Safe",
  "ToolDPCLatencyCheck",
];

/** Anti-cheat / overlay detection scans (read-only, safe) */
const AC_DETECT: string[] = [
  "ACDetectVanguard", "ACDetectEAC", "ACDetectBattlEyeFACEIT",
  "SecDetectVBSStatus",
];

/** Input quality checks (USB polling, raw accel) */
const INPUT_DETECT: string[] = [
  "InputUSBPollingCheck", "InputRawAccelBanner", "InputMousePollHzVerify",
];

/** Spotify while gaming — reduce background resource usage */
const SPOTIFY_TWEAKS: string[] = [
  "SpotifyDisableAutoUpdate", "SpotifyDisableGPU",
  "SpotifyLimitBandwidth", "SpotifyLowPriority",
];

/** Process Lasso extras */
const PROCESS_LASSO: string[] = [
  "ProcessLassoProBalance", "ProcessLassoSmartTrim",
  "ProcessLassoRestrain", "ProcessLassoAffinityGaming",
  "ProcessLassoInstanceBalancer",
];

/** WinTitus/CTT quality-of-life tweaks */
const WINTITUS_TWEAKS: string[] = [
  "WinTitusBgApps", "WinTitusConsumerFeatures", "WinTitusDiskCleanup",
  "WinTitusDisplayPerf", "WinTitusEdgeDebloat", "WinTitusFullscreenOpt",
  "WinTitusHibernation", "WinTitusIPv4Prefer", "WinTitusNotifTray",
  "WinTitusPosh7Telemetry", "WinTitusServicesManual",
  "WinTitusShowExtensions", "WinTitusShowHidden", "WinTitusStorageSense",
  "WinTitusTeredo", "WinTitusWPBT", "WinTitusXboxComponents",
  "WinTitusAdobeBlock", "WinTitusClassicMenu", "WinTitusEdgeRemove",
  "WinTitusRazerBlock",
];

/** Extra network DNS options */
const NET_DNS_EXTRA: string[] = [
  "NetDNSGoogle", "NetDNSQuad9",
];

/** ProcSvc_ service batch tweaks */
const PROCSVC_TWEAKS: string[] = [
  "ProcSvc_DiagTrack", "ProcSvc_WerSvc", "ProcSvc_DPS", "ProcSvc_DusmSvc",
  "ProcSvc_DoSvc", "ProcSvc_XblAuth", "ProcSvc_XblGame",
  "ProcSvc_XboxNet", "ProcSvc_XboxGip", "ProcSvc_SSDP",
  "ProcSvc_FDServices", "ProcSvc_Lltdsvc", "ProcSvc_WbioSrvc",
  "ProcSvc_TabletInput", "ProcSvc_BthServ", "ProcSvc_Fax",
  "ProcSvc_MapsBroker", "ProcSvc_lfsvc", "ProcSvc_PhoneSvc",
  "ProcSvc_RetailDemo", "ProcSvc_WMPNet", "ProcSvc_TrkWks",
  "ProcSvc_W32Time", "ProcSvc_BITS", "ProcSvc_WSearch",
  "ProcSvc_SysMain", "ProcSvc_RemoteReg", "ProcSvc_OneSyncSvc",
  "ProcSvc_CDPSvc", "ProcSvc_WpnService", "ProcSvc_cbdhsvc",
  "ProcSvc_dmwappushsvc", "ProcSvc_PushToInstall", "ProcSvc_AJRouter",
  "ProcSvc_SharedRealitySvc", "ProcSvc_icssvc", "ProcSvc_WFDSConMgr",
  "ProcSvc_p2pimsvc", "ProcSvc_EapHost", "ProcSvc_seclogon",
  "ProcSvc_SCardSvr", "ProcSvc_AppReadiness", "ProcSvc_PcaSvc",
  "ProcSvc_PrintNotify", "ProcSvc_SharedAccess", "ProcSvc_WinRM",
  "ProcSvc_ApplyAll",
];

/** Extra COD tweaks */
const COD_EXTRA_UNIVERSAL: string[] = [
  "CodDirectXQueue", "CodDisableXboxCapture", "CodGPUPriority",
  "CodRawInput", "CodVRAMShaderBudget",
];

/** Fortnite extra tweaks */
const FORTNITE_EXTRA: string[] = [
  "FortniteDisableSSR", "FortniteRawInput",
];

/** Rust extra tweaks */
const RUST_EXTRA: string[] = [
  "RustDisableAniso", "RustNagleOff",
];

/** AMD GPU driver reapply tweaks (FRTC, texture filter, surface format, tess) */
const AMD_DRIVER_REAPPLY: string[] = [
  "AmdTextureFilterPerf", "AmdSurfaceFormatOpt", "AmdTessOverride16x",
  "AmdRadeonBoostOff", "AmdFRTC60", "AmdFRTC144", "AmdFRTC240",
];

/** RX 9000 (RDNA 4) specific AMD tweaks */
const AMD_RX9000: string[] = [
  "RX9000RDNA4AFMF2", "RX9000HyprRX", "RX9000AntiLag2NextGen",
  "RX9000PowerSlider", "RX9000Adrenalin2025TelemetryOff", "RX9000SAMVerify",
];

/** AMD iGPU extra tweaks */
const AMD_IGPU_EXTRA: string[] = [
  "IGpu_CloseBrowserGPU", "IGpu_DisableAnimations",
  "IGpu_DisableDWMColorSpace", "IGpu_DisableFullscreenOpt",
  "IGpu_DisableHDR", "IGpu_DisableNightLight", "IGpu_DisableSysMain",
  "IGpu_DisableTransparency", "IGpu_DisableXboxGameBar",
  "IGpu_SetTimerResolution", "IGpu_DisableSysMain",
];

/** Intel Arrow Lake / lunar lake CPU extras */
const INTEL_ARROW_TWEAKS: string[] = [
  "ArrowAPOOptIn", "ArrowThreadDirectorHint", "ArrowEcoreParkPolicy",
  "ArrowLunarLakePowerPlan", "ArrowITDTelemetryOff",
  "IntelOldGenPowerOpt",
];

/** Intel laptop CPU tweaks */
const LAPTOP_INTEL: string[] = [
  "Lap_Intel_DisableTurboLimits", "Lap_Intel_DisableSpeedShift",
  "Lap_Net_DisableAutoTuning", "Lap_TimerResolution",
  "Lap_DisableHAGS",
];

/** Zen 5 CPU specific tweaks */
const ZEN5_TWEAKS: string[] = [
  "Zen5CurveOptimizer", "Zen5PBOScalarLock",
  "Zen5SMTSchedulerHint", "Zen5AGESACStatePolicy", "Zen5X3DCachePin",
];

/** NVIDIA frame limit / driver reapply options (all variants) */
const NVIDIA_FRAME_LIMITS: string[] = [
  "NvFrameLimit30", "NvFrameLimit60", "NvFrameLimit120",
  "NvFrameLimit144", "NvFrameLimit240", "NvFrameLimitCustom",
];

/** RTX 50 extra driver tweaks + FiveM RTX 5060 targeted pack */
const NVIDIA_RTX50_EXTRA: string[] = [
  "RTX50BlackwellDriverOpt", "RTX50ComputeSm120",
  "FiveM5060VRAMBudget", "FiveM5060EnableHAGS", "FiveM5060LowLatency",
];

const NVIDIA_CORE: string[] = [
  "NvidiaDisableTelemetry", "NvidiaPreRenderedFrames", "NvidiaLowLatency",
  "NvidiaPowerMizer", "NvidiaReflexEnable", "NvidiaTripleBufferOff",
  "NvidiaDisableOverlay", "NvidiaForceVSyncOff", "NvidiaShaderCache",
  "NvidiaMaxPerfMode", "NvidiaAnisoFiltering", "NvidiaThreadedOpt",
  "NvidiaOptimizeLatency", "NvidiaGSyncOptimize", "NvidiaOpenGLOpt",
  "NvidiaVRAMMax", "NvidiaDisableAnsel", "NvidiaDisableContainerLS",
  "NvidiaDisableShadowPlay", "NvidiaShaderCacheUnlimited",
  "NvidiaFrameBufferOpt", "NvidiaGpuBgOptimize", "NvidiaCUDAPriority",
  "NvidiaDisableHDMIAudio",
  "NvLowLatencyUltra", "NvTextureFilterHighPerf", "NvThreadedOptOn",
  "NvPowerMgmtMax", "NvFrameLimitOff",
  "NvidiaD3DOptimize", "NvidiaPCIeGen3Force", "NvidiaInterruptAffinity",
];
const NVIDIA_RTX_EXTRA: string[] = [
  "EnableHAGS", "NvidiaRTXVideoOff",
  "RTX50DLSS4FrameGen", "RTX50Reflex2", "RTX50PowerModeLock",
  "RTX50ShaderCacheBump", "RTX50NVCPSettings", "RTX50NvidiaAppTelemetryOff",
];
const NVIDIA_GTX_EXTRA: string[] = [
  "NvShaderDiskCache", "NvTextureFilterPerf", "NvFXAADriverOff",
  "FiveM1650DisableHAGS", "FiveM1650VRAMBudget",
  "FiveM1650DisableAnsel", "FiveM1650LowLatencyMode",
  "FiveM1060VRAMFlag", "FiveM1060DisableHAGS", "FiveM1060AnselDisable",
];

const AMD_DGPU_CORE: string[] = [
  "EnableHAGS", "AmdDisableULPS", "AmdDisableChill", "AmdDisablePowerEfficiency",
  "AmdMaxClockState", "AmdForcePerformancePowerPlan", "AmdOptimizeLatency",
  "AmdDisableTelemetry", "AmdShaderCache",
  "AmdDisableVSR", "AmdDisableCrashDefender", "AmdDisableFreeSyncCompetitive",
  "AmdDisableVariBright", "AmdImageSharpening", "AmdAntiLag",
  "AmdDisableStartupApps", "AmdTDRTweak", "AmdSmartAccessMemory",
  "AmdAntiLagPlus", "AmdFluidMotionFrames", "AmdResizableBAR",
  "AmdRadeonBoost", "AmdEnhancedSync", "AmdDisableHDMIAudio",
  "AmdDisableReLive", "AmdD3DOptimize", "AmdPCIeOptimize",
  "AmdCpuCoalescingOff", "AmdCpuPowerPinMax", "AmdCpuCStatePolicy",
  "AmdCpuCapabilities", "AmdCpuSchedulerHint",
];

const AMD_IGPU_CORE: string[] = [
  "IGpu_DisableULPS", "IGpu_DisableDeepSleep", "IGpu_DisableVariBright",
  "IGpu_ForcePerformancePower", "IGpu_AmdAntiLag", "IGpu_SharedMemoryHint",
  "IGpu_DisableMPO", "IGpu_AmdTdrLevel", "IGpu_UltimatePerformancePlan",
  "IGpu_MaxProcessorState", "IGpu_DisableCoreParking", "IGpu_GameModeOn",
  "IGpu_NetworkThrottling", "IGpu_DisableHAGSForIGpu",
  "IGpu_AmdDisableHDCP", "IGpu_AmdVegaAudioOff",
];

const INTEL_IGPU_CORE: string[] = [
  "IGpu_Intel_MaxFreq", "IGpu_Intel_DisableFreqScaling", "IGpu_Intel_TDR",
  "IGpu_Intel_PanelFitter", "IGpu_Intel_QSVOff",
  "IGpu_ForcePerformancePower", "IGpu_UltimatePerformancePlan",
  "IGpu_DisableHAGSForIGpu",
];

const LAPTOP_CORE: string[] = [
  "Lap_UltimatePerformance", "Lap_DisableCoreParking", "Lap_DisableThrottleStates",
  "Lap_MaxProcessorStateAC", "Lap_USBPowerSave", "Lap_WifiPerfMode",
  "Lap_DisablePowerThrottling", "Lap_MMCSS_Games", "Lap_DisableHibernate",
  "Lap_DisableTurboOnBattery", "Lap_DisableAdaptiveBrightness",
  "Lap_Net_DisableNagle", "Lap_Net_DisableThrottle", "Lap_Net_OptimizeDNS",
  "Lap_Net_DisableUSBSelSuspend", "Lap_Net_WiFiPerfMode",
  "Lap_DisableXboxGameBar", "Lap_DisableFullscreenOpt",
  "Lap_DisableMPO", "Lap_VisualPerformance",
];

/** Laptop tweaks specific to AMD GPU laptops */
const LAPTOP_AMD: string[] = [
  "Lap_AMD_DisableULPS", "Lap_AMD_DisableVariBright",
  "Lap_AMD_DisableDeepSleep", "Lap_AMD_DisableDynamicVoltage",
  "Lap_AMD_ForcePerformance",
];

/** Laptop tweaks specific to NVIDIA GPU laptops */
const LAPTOP_NVIDIA: string[] = [
  "Lap_NVIDIA_MaxPerformance", "Lap_NVIDIA_DisableVsync",
  "Lap_NVIDIA_LowLatency", "Lap_NVIDIA_ThreadedOpt",
  "Lap_NVIDIA_DisableMaxQThrottle",
];

const WIN11_CORE: string[] = [
  "Win11TeamsChat", "Win11Widgets", "Win11Copilot", "Win11BingSearch",
  "Win11AdsInStart", "Win11OneDriveBackup", "Win11StartRecommended",
  "Win11EdgeSidebar", "Win11ChatIcon", "Win11NotepadAI",
  "Win11Snap", "Win11TPMAlert",
  "Win11ParkingCoreOverride", "Win11ProcessorIdleMin",
];

/** COD / Warzone tweaks — universal (no GPU prefix); safe to include for any gaming PC */
const COD_UNIVERSAL: string[] = [
  "CodHighPriority", "CodGameMode", "CodShaderCacheClear",
  "CodPagefileOptimize", "CodDisableHAGS", "CodNetworkBuffer",
  "CodDisableLSO", "CodTCPOptimize", "CodBattlenetOptimize",
  "CodDisableTelemetry", "CodTdrDelay", "CodMMCSS",
  "CodQoSPolicy", "CodFramePacing", "CodMemPriority",
];
/** COD tweaks that only apply on NVIDIA hardware */
const COD_NVIDIA: string[] = ["Cod1650LowLatency", "Cod1650DisableAnsel"];
/** COD tweaks that only apply on AMD CPU builds */
const COD_AMD_CPU: string[] = ["Cod3500PowerPlan", "Cod3500CoreUnpark"];

/** Hardware-summary string for prompts/UI. */
export function summarizeHardware(hw: PresetHardware): string {
  const gpu = hw.gpuName || (hw.gpuVendor === "unknown" ? "Unknown GPU" : `${hw.gpuVendor.toUpperCase()} GPU`);
  const cpu = hw.cpuLabel || (hw.cpuBrand && hw.cpuBrand !== "unknown" ? `${hw.cpuBrand.toUpperCase()} CPU` : "Unknown CPU");
  const cores = hw.cpuCores ? `${hw.cpuCores}T` : "?T";
  const ram = hw.ramGB ? `${hw.ramGB}GB RAM` : "? RAM";
  const os = hw.osVersion === "win11" ? "Win11" : hw.osVersion === "win10" ? "Win10" : "Win?";
  const form = hw.isLaptop ? "Laptop" : "Desktop";
  return `${gpu} • ${cpu} (${cores}) • ${ram} • ${os} • ${form}`;
}

function profileFor(hw: PresetHardware): string {
  if (hw.isLaptop && hw.gpuVendor === "nvidia") return "NVIDIA Gaming Laptop";
  if (hw.isLaptop && hw.gpuVendor === "amd") return "AMD Gaming Laptop";
  if (hw.isLaptop) return "Gaming Laptop";
  if (hw.gpuVendor === "nvidia") {
    const isRtx = !!hw.gpuName && /rtx|\b(20|30|40|50)\d{2}\b/i.test(hw.gpuName);
    return isRtx ? "NVIDIA RTX Build" : "NVIDIA GTX Build";
  }
  if (hw.gpuVendor === "amd") return "AMD Radeon Build";
  if (hw.gpuVendor === "intel") return "Intel iGPU Build";
  return "Generic Gaming PC";
}

/**
 * The single canonical preset-selection function. All AI/admin generators
 * MUST go through this — never construct preset arrays inline.
 *
 * @param hw       Detected hardware (use `unknown` vendors when uncertain;
 *                 the function will skip vendor-specific tweaks).
 * @param goal     Optimisation goal (currently advisory — drives `profile`
 *                 and reason strings; future versions may bias selection).
 * @param optInFlags Tweak IDs the user/admin has explicitly approved for
 *                   expert/forbidden treatment. IDs not in this list that
 *                   fall into `EXPERT_TWEAK_IDS` are moved to `expert` and
 *                   are NOT included in `core`. Forbidden tweaks
 *                   (`FORBIDDEN_AUTO_TWEAKS`) require the EXACT id in
 *                   `optInFlags` or they're recorded under `blocked`.
 */
export function buildSafePreset(
  hw: PresetHardware,
  goal: PresetGoal = "balanced",
  optInFlags: readonly string[] = [],
): SafePreset {
  const optIn = new Set(optInFlags);
  const blocked: { id: string; reason: string }[] = [];
  const reasons: string[] = [];

  // 1. Collect candidates by hardware
  const candidates = new Set<string>(UNIVERSAL_CORE);

  // Universal category packs — safe for any Windows gaming PC
  NET_EXTRA.forEach(id => candidates.add(id));
  NET_DNS_EXTRA.forEach(id => candidates.add(id));
  MEMORY_EXTRA.forEach(id => candidates.add(id));
  REGISTRY_SYSTEM.forEach(id => candidates.add(id));
  PRIVACY_EXTRA.forEach(id => candidates.add(id));
  DEBLOAT_TWEAKS.forEach(id => candidates.add(id));
  SERVICE_SAFE.forEach(id => candidates.add(id));
  PROCSVC_TWEAKS.forEach(id => candidates.add(id));
  STARTUP_TWEAKS.forEach(id => candidates.add(id));
  DISCORD_TWEAKS.forEach(id => candidates.add(id));
  SPOTIFY_TWEAKS.forEach(id => candidates.add(id));
  PROCESS_EXTRA.forEach(id => candidates.add(id));
  PROCESS_LASSO.forEach(id => candidates.add(id));
  CPU_GAME_IFEO.forEach(id => candidates.add(id));
  SYSTEM_EXTRA.forEach(id => candidates.add(id));
  AC_DETECT.forEach(id => candidates.add(id));
  INPUT_DETECT.forEach(id => candidates.add(id));
  WINTITUS_TWEAKS.forEach(id => candidates.add(id));
  FIVEM_UNIVERSAL.forEach(id => candidates.add(id));
  FORTNITE_TWEAKS.forEach(id => candidates.add(id));
  FORTNITE_EXTRA.forEach(id => candidates.add(id));
  RUST_TWEAKS.forEach(id => candidates.add(id));
  RUST_EXTRA.forEach(id => candidates.add(id));
  ROBLOX_TWEAKS.forEach(id => candidates.add(id));
  GAME_DETECT_PACKS.forEach(id => candidates.add(id));
  COD_EXTRA_UNIVERSAL.forEach(id => candidates.add(id));

  reasons.push(`${candidates.size} universal tweaks (core, memory, network, debloat, FiveM, Fortnite, Rust, Roblox, COD, game-detect, Discord, Spotify, services, ProcSvc, startup, WinTitus, input)`);

  if (hw.gpuVendor === "nvidia") {
    NVIDIA_CORE.forEach(id => candidates.add(id));
    FIVEM_NVIDIA.forEach(id => candidates.add(id));
    NVIDIA_FRAME_LIMITS.forEach(id => candidates.add(id));
    const isRtx = !!hw.gpuName && /rtx|\b(20|30|40|50)\d{2}\b/i.test(hw.gpuName);
    const isRtx50 = !!hw.gpuName && /rtx\s*50\d{2}|blackwell/i.test(hw.gpuName);
    if (isRtx) {
      NVIDIA_RTX_EXTRA.forEach(id => candidates.add(id));
      if (isRtx50) {
        NVIDIA_RTX50_EXTRA.forEach(id => candidates.add(id));
        reasons.push(`NVIDIA RTX 50 (Blackwell) detected (${hw.gpuName ?? "RTX 50"}) — HAGS, full RTX stack, Blackwell driver extras, DLSS4`);
      } else {
        reasons.push(`NVIDIA RTX detected (${hw.gpuName ?? "RTX"}) — HAGS enabled, full RTX stack, RTX video off`);
      }
    } else {
      NVIDIA_GTX_EXTRA.forEach(id => candidates.add(id));
      reasons.push(`NVIDIA GTX-class detected (${hw.gpuName ?? "GTX"}) — HAGS skipped (causes stutters on Pascal/Turing), GTX shader/texture/FiveM GTX extras`);
    }
    if (hw.isLaptop) {
      LAPTOP_NVIDIA.forEach(id => candidates.add(id));
      reasons.push("NVIDIA laptop detected — Max-Q throttle fix, low-latency, threaded opt, vsync off");
    }
  } else if (hw.gpuVendor === "amd" && hw.hasDiscreteGpu !== false) {
    // AMD discrete Radeon — desktop OR laptop
    AMD_DGPU_CORE.forEach(id => candidates.add(id));
    AMD_DRIVER_REAPPLY.forEach(id => candidates.add(id));
    const isRx9000 = !!hw.gpuName && /rx\s*9\d{3}/i.test(hw.gpuName);
    if (isRx9000) {
      AMD_RX9000.forEach(id => candidates.add(id));
      reasons.push(`AMD RX 9000 (RDNA 4) detected (${hw.gpuName}) — Hypr-RX, AFMF2, Anti-Lag 2, SAM verify, power slider`);
    }
    reasons.push(`AMD discrete GPU detected (${hw.gpuName ?? "Radeon"})${hw.isLaptop ? " on laptop" : ""} — full Radeon suite + driver reapply (FRTC, texture filter, surface format, tess) + Anti-Lag`);
    if (hw.isLaptop) {
      LAPTOP_AMD.forEach(id => candidates.add(id));
      reasons.push("AMD laptop detected — ULPS/VariBright/DeepSleep/DynamicVoltage disabled, forced performance");
    }
  } else if (hw.gpuVendor === "amd") {
    AMD_IGPU_CORE.forEach(id => candidates.add(id));
    AMD_IGPU_EXTRA.forEach(id => candidates.add(id));
    reasons.push(`AMD APU/iGPU detected (${hw.gpuName ?? "Vega"}) — Vega/APU tweaks, HAGS disabled, HDCP off, audio co-proc gated, browser GPU close, transparency off`);
  } else if (hw.gpuVendor === "intel") {
    INTEL_IGPU_CORE.forEach(id => candidates.add(id));
    INTEL_ARROW_TWEAKS.forEach(id => candidates.add(id));
    reasons.push(`Intel iGPU detected (${hw.gpuName ?? "Intel"}) — Intel driver TDR fix, Panel Fitter off, Arrow Lake / Lunar Lake extras`);
    if (hw.isLaptop) {
      LAPTOP_INTEL.forEach(id => candidates.add(id));
      reasons.push("Intel laptop detected — speed shift / turbo limits / timer / HAGS tweaks");
    }
  } else {
    reasons.push("GPU vendor unknown — vendor-specific tweaks skipped, safe defaults only");
  }

  // AMD CPU — Ryzen FiveM affinity tweaks (3500/5600 core-count specific)
  if (hw.cpuBrand === "amd") {
    FIVEM_RYZEN_AFFINITY.forEach(id => candidates.add(id));
    reasons.push("AMD Ryzen CPU — FiveM Ryzen core affinity + performance plan tweaks added");
  }

  // Intel 12th–14th gen hybrid CPU — P-core affinity + Ultra Performance plan for FiveM
  if (hw.cpuBrand === "intel" && hw.cpuGeneration && hw.cpuGeneration >= 12) {
    FIVEM_INTEL_12_14.forEach(id => candidates.add(id));
    reasons.push(`Intel ${hw.cpuGeneration}th gen hybrid CPU detected — FiveM P-core affinity + Ultra Performance plan added`);
  }

  // Zen 5 CPU extras — Ryzen 9000 series only (e.g. 9600X, 9700X, 9950X)
  // Do NOT match "Ryzen 5 3500" — require explicit 9xxx model number after tier digit
  if (hw.cpuBrand === "amd" && !!hw.cpuLabel && /ryzen\s+[579]\s+9[0-9]{3}[a-z]*\b/i.test(hw.cpuLabel)) {
    ZEN5_TWEAKS.forEach(id => candidates.add(id));
    reasons.push(`Zen 5 CPU detected (${hw.cpuLabel}) — Curve Optimizer, PBO scalar lock, SMT scheduler hint, AGESA C-State, X3D cache pin`);
  }

  if (hw.isLaptop) {
    LAPTOP_CORE.forEach(id => candidates.add(id));
    reasons.push("Laptop detected — power/Wi-Fi/USB/throttle/MPO/adaptive brightness laptop suite included");
  }
  if (hw.osVersion === "win11") {
    WIN11_CORE.forEach(id => candidates.add(id));
    reasons.push("Windows 11 detected — Win11 debloat + Edge sidebar + Snap + TPM alert + parking override + NotepadAI off");
  }

  // COD / Warzone game pack — always included
  COD_UNIVERSAL.forEach(id => candidates.add(id));
  if (hw.gpuVendor === "nvidia") COD_NVIDIA.forEach(id => candidates.add(id));
  if (hw.cpuBrand === "amd") COD_AMD_CPU.forEach(id => candidates.add(id));
  reasons.push("COD/Warzone pack: priority, network, shader cache, Battle.net agent kill, pagefile, TDR delay, MMCSS, QoS, frame pacing, GPU priority, raw input, VRAM shader budget");

  // 2. Goal-driven nudges (advisory: tighten or relax)
  if (goal === "stability") {
    // Stability mode: drop the more aggressive scheduler tweaks
    candidates.delete("DisableDynamicTick");
    candidates.delete("DisablePowerThrottlingAdv");
    reasons.push("Goal=stability — aggressive scheduler tweaks dropped");
  }
  if (goal === "latency") {
    reasons.push("Goal=latency — network + scheduler core retained, no extra additions");
  }

  // 3. Apply opt-in expert tweaks (verify hardware compat first)
  //    SAFETY: optInFlags can ONLY contain known EXPERT or FORBIDDEN IDs.
  //    Arbitrary IDs (typos, model hallucinations, malicious payloads) are
  //    rejected — they must never reach `core`.
  const FORBIDDEN_LIST = FORBIDDEN_AUTO_TWEAKS as readonly string[];
  for (const optedId of Array.from(optIn)) {
    const isExpert = EXPERT_TWEAK_IDS.has(optedId);
    const isForbidden = FORBIDDEN_LIST.includes(optedId);
    if (!isExpert && !isForbidden) {
      blocked.push({
        id: optedId,
        reason: "unknown opt-in flag — only expert or forbidden tweak IDs may be opted in",
      });
      continue;
    }
    const compat = isHardwareCompatible(optedId, hw);
    if (!compat.ok) {
      blocked.push({ id: optedId, reason: compat.reason ?? "hardware-incompatible" });
      continue;
    }
    candidates.add(optedId);
  }

  // 3b. Seed expert[] with hardware-compatible EXPERT tweaks that the user
  //     has NOT opted in yet — these render as red toggle suggestions in the
  //     "Advanced — Opt-in Required" UI section so the user can flip them.
  //     Forbidden trio is intentionally NOT seeded here (they only ever
  //     appear via explicit opt-in; non-opted ones live in `blocked`).
  for (const eid of Array.from(EXPERT_TWEAK_IDS)) {
    if (candidates.has(eid)) continue; // already going through partition
    if (FORBIDDEN_LIST.includes(eid)) continue; // forbidden surfaced via blocked
    const compat = isHardwareCompatible(eid, hw);
    if (!compat.ok) continue; // silently skip hw-incompatible expert suggestions
    candidates.add(eid); // partition step will route them to expert[]
  }

  // 4. Always surface forbidden trio in `blocked` when not opted in, so the
  // UI/admin can SEE that they were deliberately withheld (not silently absent).
  // Spec contract: "refuse to include EnableMSIMode/DisableIPv6/SetTimerResolution
  // without explicit opt-in" — visibility of the refusal matters.
  for (const fid of FORBIDDEN_AUTO_TWEAKS) {
    if (!optIn.has(fid) && !candidates.has(fid)) {
      blocked.push({
        id: fid,
        reason: `forbidden auto-include (V2.1 stability rule: caused ${
          fid === "EnableMSIMode" ? "SYSTEM_THREAD_EXCEPTION_NOT_HANDLED BSOD"
          : fid === "DisableIPv6" ? "FiveM/Discord/Xbox party crashes"
          : "boot hang on Ryzen APUs / Intel chipsets"
        }) — pass "${fid}" in optInFlags to apply`,
      });
    }
  }

  // 5. Partition into core vs expert, filter hardware-incompatible, record blocked
  const core: string[] = [];
  const expert: string[] = [];
  for (const id of Array.from(candidates)) {
    // Hardware filter
    const compat = isHardwareCompatible(id, hw);
    if (!compat.ok) {
      blocked.push({ id, reason: compat.reason ?? "hardware-incompatible" });
      continue;
    }
    // Forbidden tweaks — require EXACT id in optIn to escape blocked
    if ((FORBIDDEN_AUTO_TWEAKS as readonly string[]).includes(id)) {
      if (optIn.has(id)) {
        expert.push(id); // even on opt-in, surface as expert (red section)
      } else {
        blocked.push({
          id,
          reason: `forbidden auto-include (V2.1 stability rule) — pass "${id}" in optInFlags to apply`,
        });
      }
      continue;
    }
    // Expert tweaks — require opt-in to escape expert section
    if (EXPERT_TWEAK_IDS.has(id)) {
      if (optIn.has(id)) {
        expert.push(id); // opted in but still rendered in expert section
      } else {
        expert.push(id); // surfaced as opt-in suggestion (NOT in core)
      }
      continue;
    }
    core.push(id);
  }

  // Deduplicate expert (in case a tweak appears twice via opt-in + candidates)
  const uniqExpert = Array.from(new Set(expert));

  return {
    profile: profileFor(hw),
    goal,
    hardwareSummary: summarizeHardware(hw),
    core: core.sort(),
    expert: uniqExpert.sort(),
    blocked,
    reasons,
  };
}

/**
 * Translate a `HardwareRig` row (from the hardware_rigs table) into the
 * `PresetHardware` shape buildSafePreset expects. Used by Aether's
 * "generate preset for rig N" command.
 */
export function hardwareFromRig(rig: {
  cpu: string;
  gpu: string;
  ramGb: number | null;
  chassis: string | null;
  refreshHz: number | null;
}): PresetHardware {
  const gpuLower = rig.gpu.toLowerCase();
  let gpuVendor: PresetGpuVendor = "unknown";
  if (/nvidia|geforce|rtx|gtx/.test(gpuLower)) gpuVendor = "nvidia";
  else if (/radeon|\brx\b|vega|amd/.test(gpuLower)) gpuVendor = "amd";
  else if (/intel|uhd|iris|arc/.test(gpuLower)) gpuVendor = "intel";

  const cpuLower = rig.cpu.toLowerCase();
  let cpuBrand: "intel" | "amd" | "unknown" = "unknown";
  if (cpuLower.includes("intel") || /\bi[3579]-/.test(cpuLower) || cpuLower.includes("core ultra")) cpuBrand = "intel";
  else if (cpuLower.includes("ryzen") || cpuLower.includes("amd") || cpuLower.includes("threadripper")) cpuBrand = "amd";

  const isLaptop = !!rig.chassis && /laptop|notebook|portable/i.test(rig.chassis);
  // Heuristic: if GPU mentions RTX/RX-discrete it's a dGPU even on a laptop.
  const hasDiscreteGpu = gpuVendor === "nvidia"
    || (gpuVendor === "amd" && /\brx\s*\d{3,4}/i.test(rig.gpu));

  return {
    gpuVendor,
    gpuName: rig.gpu,
    cpuBrand,
    cpuLabel: rig.cpu,
    ramGB: rig.ramGb ?? undefined,
    osVersion: "unknown", // hardware_rigs doesn't track OS — caller may override
    isLaptop,
    hasDiscreteGpu,
  };
}
