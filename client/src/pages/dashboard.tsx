import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/api-base";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShieldAlert, Zap, Cpu, HardDrive, Monitor, Trash2,
  CheckCircle2, Download, Terminal, RotateCcw, ChevronRight,
  MemoryStick, Wifi, Settings2, Gamepad2, Crosshair, Power, Search, Lock, Rocket, Flame, Shield, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useHardwareInfo, type ScannedSysInfo } from "@/hooks/use-hardware-info";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { cn } from "@/lib/utils";
import { useProStatus } from "@/lib/pro-status";
import { ProUnlockButton } from "@/components/pro-gate";
import { TOTAL_TWEAKS, TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { TWEAK_REGISTRY } from "@/lib/tweak-registry";
import { ScanImport } from "@/components/scan-import";
import { HardwareScanZone } from "@/components/hardware-scan";

// Feature categories
const FEATURES = [
  { icon: Settings2, title: "Registry Tweaks", desc: "Deep Windows registry optimizations for latency and responsiveness" },
  { icon: Wifi, title: "Network Stack", desc: "TCP/IP tuning, nagle disable, DNS and connection optimizations" },
  { icon: Monitor, title: "GPU / NVIDIA", desc: "HAGS, MSI interrupt mode, driver tweaks, and shader cache control" },
  { icon: MemoryStick, title: "Memory Optimizer", desc: "RAM priority pinning, pagefile control, and heap management" },
  { icon: Power, title: "Power Plan", desc: "Processor performance states, C-states, and idle inhibit" },
  { icon: Gamepad2, title: "FiveM Optimizer", desc: "GTA V and FiveM-specific process tweaks for max FPS" },
  { icon: Crosshair, title: "Fortnite Pack", desc: "Epic Games launcher, Fortnite CPU affinity and priority tweaks" },
  { icon: Search, title: "Game Detection", desc: "Auto-detect 27 games and apply per-game optimization packs" },
  { icon: Trash2, title: "Win10/11 Debloat", desc: "Remove bloatware, telemetry, and unnecessary background services" },
];

// Quick Boost Presets — V3.2 (massively expanded — Safe ~44, Max FPS ~133, Competitive ~175, Streamer ~74)

// ── Safe Boost ─────────────────────────────────────────────────────────────
// No service stops, no uninstalls — pure registry + power plan + privacy tweaks.
const SAFE_TWEAKS = [
  // CPU scheduling & responsiveness
  "Win32PrioritySeparation", "SetResponsiveness", "GameModeTweaks",
  // Network baseline
  "NetworkThrottling", "DisableNagle", "InputLagTCP", "SetDNSPriority",
  // Power & hardware
  "SetHighPerformancePlan", "DisableCoreParking", "EnableHAGS",
  // Input
  "DisablePointerPrecision",
  // Windows cleanup — zero risk
  "DisableXboxGameBar", "DisableGameDVR", "DisableFastStartup",
  "DisableWindowsError", "DisableHungAppDetection", "SysVisualBestPerf",
  "DisableAutoMaintenance", "SysHibernateOff",
  // Memory
  "OptimizeRAMUsage", "DisableNDU", "MemGPUOptimize", "MemGPUSchedulerTweak",
  // Privacy — no functional change
  "PrivacyTelemetry", "PrivacyActivityHistory", "PrivacyAdvertisingID",
  "PrivacyLocationTracking", "ServiceDiagTrack",
  // WinTitus — safe visual / background registry tweaks
  "WinTitusConsumerFeatures", "WinTitusBgApps", "WinTitusDisplayPerf",
  "WinTitusShowExtensions", "WinTitusIPv4Prefer",
  // Spotify — no-op if not installed
  "SpotifyLowPriority", "SpotifyDisableGPU",
  // COD — no-op if not installed
  "CodGPUPriority", "CodDefenderExclusion", "CodGameMode",
  // Fortnite — no-op if not installed
  "FortniteGameMode",
  // Startup cleanup — removes background auto-launch only; apps still open normally
  "su_onedrive", "su_edge_startup", "su_zoom",
];

// ── Max FPS Gaming ─────────────────────────────────────────────────────────
// Everything Safe plus aggressive timer, full service list, COD/FiveM/Fortnite packs, startup cleanup.
const MAX_FPS_TWEAKS = [
  ...SAFE_TWEAKS,
  // Aggressive timer & power throttle removal
  "SetTimerResolution", "DisableDynamicTick",
  "DisablePowerThrottling", "DisablePowerThrottlingAdv",
  // Hardware interrupts
  "DisableUSBSuspend",
  // Network full stack
  "OptimizeTCP", "EnableTCPAutoTuning", "DisableIPv6",
  // Visual & search overhead
  "DisableAnimations", "ServiceWSearch", "DisableSearchIndexer",
  // Windows background services — individually safe, collectively frees significant CPU/RAM
  "ServiceSysMain", "ServiceRemoteReg", "ServiceWMPNetworkSvc", "ServiceFax",
  "ServiceRetailDemo", "ServiceTabletInput", "ServiceMapsBroker", "ServiceWerSvc",
  "ServiceDPS", "ServiceDusmSvc", "ServiceTrkWks", "ServiceLltdsvc",
  "ServiceFDHost", "ServiceWbioSrvc", "ServicePcaSvc", "ServiceAeLookupSvc",
  // WinTitus batch service pass + telemetry opt-outs
  "WinTitusServicesManual", "WinTitusPosh7Telemetry", "WinTitusShowHidden",
  "WinTitusWPBT", "WinTitusRazerBlock",
  // Memory deep tuning
  "DisablePagefileEncryption", "DisablePrefetch", "MemFixedPagefile",
  // FiveM full pack (no-op if not installed)
  "FiveMHighPriority", "FiveMFullPerfStack", "FiveMGTAProcessPerfOptions", "FiveMRenderingBoost",
  "FiveMGPUPriorityStack", "FiveMDisableMPO", "FiveMReduceNPCDensity", "FiveMCommandLineTweaks",
  "FiveMDisableLSO", "FiveMEnableRSS", "FiveMCacheClear", "FiveMNetworkBuffer",
  "FiveMDisableNvidiaTelemetry", "FiveMGameModeAdd",
  // Registry deep tuning
  "RegistryNTFSOptimize", "RegistryIOPageLock",
  // COD full pack (no-op if not installed)
  "CodDirectXQueue", "CodVRAMShaderBudget", "CodHighPriority", "CodMMCSS",
  "CodTCPOptimize", "CodNetworkBuffer", "CodRawInput", "CodDisableXboxCapture",
  "CodDisableLSO", "CodDisableTelemetry", "CodQoSPolicy",
  "CodTdrDelay", "CodFramePacing", "CodPagefileOptimize", "CodShaderCacheClear",
  "CodDisableHAGS", "CodBattlenetOptimize", "CodMemPriority",
  // Spotify full pack
  "SpotifyDisableAutoUpdate", "SpotifyLimitBandwidth",
  // Fortnite FPS pack (no-op if not installed)
  "FortniteHighPriority", "FortniteUncapGameFPS", "FortniteUncapLobbyFPS",
  "FortniteDisableMotionBlur", "FortniteLowShadows", "FortniteDisableRecording",
  "FortniteNetworkBuffer", "FortniteDisableThrottling",
  // Startup app cleanup — removes background launch, apps still open normally
  "su_discord", "su_spotify", "su_skype", "su_teams", "su_nvidia",
  "su_ccleaner", "su_battlenet", "su_epic", "su_chrome", "su_razer",
  "su_amdradeon", "su_rtss", "su_logitech",
];

// ── Competitive Shooter ────────────────────────────────────────────────────
// Everything Max FPS + full GPU vendor packs (NVIDIA + AMD), Process Lasso, complete Discord tuning.
const COMPETITIVE_TWEAKS = [
  ...MAX_FPS_TWEAKS,
  // MSI interrupt mode — safe version (no BSOD risk, filters GPU + NVMe + NIC)
  "EnableMSIMode_Safe",
  // NVIDIA performance pack — no-op on AMD/Intel systems
  "NvidiaDisableTelemetry", "NvidiaMaxPerfMode", "NvidiaPreRenderedFrames",
  "NvidiaShaderCache", "NvidiaOptimizeLatency", "NvidiaDisableOverlay",
  "NvidiaDisableAnsel", "NvidiaDisableShadowPlay",
  // AMD performance pack — no-op on NVIDIA/Intel systems
  "AmdDisableULPS", "AmdDisableChill", "AmdDisablePowerEfficiency",
  "AmdMaxClockState", "AmdDisableTelemetry", "AmdDisableCrashDefender",
  "AmdOptimizeLatency", "AmdShaderCache", "AmdTextureFilterPerf",
  "AmdSurfaceFormatOpt", "AmdTessOverride16x", "AmdRadeonBoostOff",
  "AmdD3DOptimize", "AmdPCIeOptimize",
  // Process management
  "ProcessLassoAffinityGaming", "ProcessLassoProBalance", "ProcessAutoKillHung",
  "ProcessLassoInstanceBalancer",
  // Fortnite competitive extras
  "FortniteDisableVSync", "FortniteInputLatency", "FortniteDisableSSR",
  "FortniteRawInput", "FortniteDisableLumen", "FortniteAffinityPhysical",
  // Discord — full competitive footprint reduction
  "DiscordLowPriority", "DiscordOptimizeCodec", "DiscordReduceGPUPriority",
  "DiscordDisableVAD", "DiscordDisableClips", "DiscordDisableUpdateCheck",
  "DiscordDisableCrashHandler", "DiscordDisableAnimations",
  // Memory — safe on 16 GB+ systems; script auto-warns on low-RAM rigs
  "DisableMemoryCompression",
];

// ── Streamer Mode ──────────────────────────────────────────────────────────
// Goal: game performance + stable OBS encode + smooth Discord + low-noise desktop.
// Deliberately OMITS DisableXboxGameBar / DisableGameDVR — some capture setups need them.
const STREAMER_TWEAKS = [
  // CPU scheduling — balanced between game priority and encoder threads
  "Win32PrioritySeparation", "SetResponsiveness", "SetTimerResolution", "GameModeTweaks",
  // Power — sustained high clocks for both game + encoder (no throttling)
  "SetHighPerformancePlan", "DisableCoreParking",
  "DisablePowerThrottling", "DisablePowerThrottlingAdv",
  // HAGS — better GPU scheduling for game + OBS simultaneous workload
  "EnableHAGS",
  // Input
  "DisablePointerPrecision",
  // Network — stability & low jitter (not raw speed) for stream upload
  "NetworkThrottling", "DisableNagle", "InputLagTCP", "SetDNSPriority", "OptimizeTCP",
  // Memory — game + OBS + browser tabs + Discord all need headroom
  "OptimizeRAMUsage", "DisableNDU", "MemGPUOptimize", "MemFixedPagefile",
  // Kill background noise that steals encoder CPU time
  "ServiceDiagTrack", "PrivacyTelemetry", "PrivacyActivityHistory", "PrivacyAdvertisingID",
  "DisableWindowsError", "DisableHungAppDetection", "DisableAutoMaintenance", "SysHibernateOff",
  // WinTitus — background apps, display perf, consumer features
  "WinTitusConsumerFeatures", "WinTitusBgApps", "WinTitusDisplayPerf",
  "WinTitusPosh7Telemetry", "WinTitusIPv4Prefer", "WinTitusShowExtensions",
  // Light service pass — frees background CPU without touching streaming-critical services
  "ServiceFax", "ServiceRetailDemo", "ServiceTabletInput",
  "ServiceMapsBroker", "ServiceWbioSrvc", "ServicePcaSvc",
  // USB suspend causes stutter-freeze on USB headsets / capture cards mid-stream
  "DisableUSBSuspend",
  // Disk I/O — OBS writes large VOD files continuously; NTFS optimisation helps
  "RegistryNTFSOptimize",
  // Desktop
  "SysVisualBestPerf", "DisableFastStartup",
  // Discord — full footprint reduction for streamers
  "DiscordOptimizeCodec", "DiscordDisableAnimations", "DiscordReduceGPUPriority",
  "DiscordDisableHWAccel", "DiscordClearCache", "DiscordDisableVAD",
  "DiscordLowPriority", "DiscordDisableClips", "DiscordDisableUpdateCheck",
  "DiscordDisableCrashHandler", "DiscordDisableStreaming",
  // Spotify — keep music playing but yield CPU/I/O to game + encoder
  "SpotifyLowPriority", "SpotifyDisableGPU", "SpotifyLimitBandwidth", "SpotifyDisableAutoUpdate",
  // Startup cleanup — frees RAM at boot for OBS + game
  "su_discord", "su_onedrive", "su_edge_startup", "su_zoom", "su_teams", "su_chrome",
  // Game mode / COD no-op packs
  "CodGameMode", "CodDefenderExclusion",
  // Process priority
  "ProcessLassoProBalance", "ProcessAutoKillHung",
  // Xbox / search overhead removed (OBS capture works without Game Bar on most setups)
  "DisableSearchIndexer",
];

const QUICK_BOOST_PRESETS = [
  {
    id: "safe",
    icon: Shield,
    title: "Safe Boost",
    desc: "Pure registry tweaks — CPU scheduling, power plan, privacy, memory, and game packs. Safe for any PC.",
    color: "text-emerald-400",
    border: "border-emerald-500/25 hover:border-emerald-500/50",
    glow: "shadow-[inset_0_0_20px_-8px_rgba(52,211,153,0.1)]",
    activeBg: "bg-emerald-500/5",
    tweaks: SAFE_TWEAKS,
  },
  {
    id: "maxfps",
    icon: Flame,
    title: "Max FPS Gaming",
    desc: "Aggressive timer, full service list, all COD/FiveM/Fortnite packs, startup cleanup, and deep memory tuning.",
    color: "text-red-400",
    border: "border-red-500/25 hover:border-red-500/50",
    glow: "shadow-[inset_0_0_20px_-8px_rgba(239,68,68,0.1)]",
    activeBg: "bg-red-500/5",
    tweaks: MAX_FPS_TWEAKS,
  },
  {
    id: "competitive",
    icon: Crosshair,
    title: "Competitive Shooter",
    desc: "All Max FPS tweaks + full NVIDIA & AMD driver packs, MSI mode, Process Lasso, and complete Discord tuning.",
    color: "text-orange-400",
    border: "border-orange-500/25 hover:border-orange-500/50",
    glow: "shadow-[inset_0_0_20px_-8px_rgba(249,115,22,0.1)]",
    activeBg: "bg-orange-500/5",
    tweaks: COMPETITIVE_TWEAKS,
  },
  {
    id: "streamer",
    icon: Radio,
    title: "Streamer Mode",
    desc: "Game perf + stable OBS encode + full Discord + Spotify deprioritised. Startup cleanup included.",
    color: "text-violet-400",
    border: "border-violet-500/25 hover:border-violet-500/50",
    glow: "shadow-[inset_0_0_20px_-8px_rgba(139,92,246,0.1)]",
    activeBg: "bg-violet-500/5",
    tweaks: STREAMER_TWEAKS,
  },
];


// How to use steps
const HOW_TO_STEPS = [
  {
    icon: Terminal,
    title: "Browse & Toggle",
    desc: `Hit 'Enable All Tweaks' on the Home tab — it enables every tweak in the app. Or open any tab (Registry, FiveM, NVIDIA, etc.) and flip toggles manually. Red = will be applied.`,
  },
  {
    icon: Download,
    title: "Get Your Script",
    desc: "Click GET MY SCRIPT in the top right. Builds a personalized PowerShell script with only your enabled tweaks — nothing extra, nothing missing.",
  },
  {
    icon: ShieldAlert,
    title: "Click Yes on the Prompt",
    desc: "Open your Downloads folder and double-click OptiGods-by-leaq.bat. A Windows security prompt will appear — click Yes. The script runs automatically and applies every tweak.",
  },
  {
    icon: RotateCcw,
    title: "Restart & Done",
    desc: "Restart your PC after the script finishes. All registry and system changes take effect on the next boot. Create a Windows Restore Point first as a safety net.",
  },
];

// Pro pricing bullet points
const PRO_BULLETS = [
  `${TOTAL_TWEAKS_LABEL} registry, network, memory, and GPU tweaks`,
  "FiveM, Fortnite, Call of Duty, Valorant, and Apex packs",
  "Download your personalized .bat script (double-click to run)",
  "Game auto-detection for 14 titles",
  "Preset save/load for quick re-apply",
  "Lifetime access — pay once, no subscription",
];

export default function Dashboard() {
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
  const smartRecs = computeSmartRecs(hw, osInfo);
  const isPro = useProStatus();
  const { tweaks, setAllTweaks } = useOptimizationStore();
  const { data: pricingData } = useQuery<{ price: number; isWeekendDeal: boolean }>({
    queryKey: ["/api/pricing"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: serverStats } = useQuery<{ cpu: number; gpu: number; memory: number; os: string }>({
    queryKey: [api.system.stats.path],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
  const proPrice = pricingData?.price ?? 25;
  const isWeekendDeal = pricingData?.isWeekendDeal ?? false;
  const { toast } = useToast();

  const handleScanned = useCallback((_info: ScannedSysInfo) => {
    window.location.reload();
  }, []);
  const handleScanCleared = useCallback(() => {
    window.location.reload();
  }, []);

  const [activeBoost, setActiveBoost] = useState<string | null>(null);
  const [recommendedApplied, setRecommendedApplied] = useState(false);

  const applyAllRecommended = () => {
    // Enable all safe + aggressive tweaks. Expert tweaks (DisableDefender, DisableVBS,
    // SysHypervisorOff, DisablePagefile, etc.) are NEVER auto-enabled — they require
    // deliberate opt-in on their own tab. Hardware filtering at script generation time
    // means incompatible tweaks (wrong GPU vendor, wrong OS, laptop-only) won't appear
    // in the downloaded .bat even if toggled on.
    const expertIds = new Set(
      TWEAK_REGISTRY.filter(t => t.safety === "expert").map(t => t.id)
    );
    const next = { ...tweaks };
    let applied = 0;
    Object.keys(next).forEach(key => {
      if (!expertIds.has(key)) { (next as any)[key] = true; applied++; }
    });
    setAllTweaks(next);
    setRecommendedApplied(true);
    toast({
      title: "All Safe Tweaks Enabled!",
      description: `${applied} tweaks enabled (expert tweaks excluded — opt-in on their tabs). Hardware filtering runs at script generation.`,
    });
  };

  const applyQuickBoost = (preset: typeof QUICK_BOOST_PRESETS[number]) => {
    const next = { ...tweaks };
    preset.tweaks.forEach((key) => { if (key in next) next[key] = true; });
    setAllTweaks(next);
    setActiveBoost(preset.id);
    toast({
      title: `${preset.title} Applied`,
      description: `${preset.tweaks.filter(k => k in tweaks).length} tweaks enabled. Download your script to apply them.`,
    });
  };

  const enabledCount = Object.values(tweaks).filter(Boolean).length;
  const totalTweaks = TOTAL_TWEAKS;
  const optLevel = enabledCount === 0 ? "None" : enabledCount < 10 ? "Low" : enabledCount < 25 ? "Medium" : "High";
  const optColor = enabledCount === 0 ? "text-zinc-500" : enabledCount < 10 ? "text-zinc-300" : enabledCount < 25 ? "text-zinc-100" : "text-red-400";
  // Expert tweaks are intentionally excluded from auto-enable (require manual opt-in).
  // Any tweak not present as a key in the store can't be toggled either.
  // Filter both out of the score denominator so 100% is always achievable.
  const _expertIdSet = new Set(TWEAK_REGISTRY.filter(t => t.safety === "expert").map(t => t.id));
  const achievableIds = Array.from(smartRecs.ids).filter(id => !_expertIdSet.has(id) && id in tweaks);
  const recApplied = achievableIds.filter(id => (tweaks as Record<string, boolean>)[id]).length;
  const scorePercent = achievableIds.length > 0 ? Math.round((recApplied / achievableIds.length) * 100) : 0;
  const tierLabel = scorePercent === 100 ? "100% OPTIMIZED" : scorePercent >= 90 ? "GOD TIER" : scorePercent >= 70 ? "ELITE" : scorePercent >= 46 ? "DECENT" : scorePercent >= 21 ? "GETTING THERE" : "UNOPTIMIZED";
  const tierColor = scorePercent === 100 ? "text-red-400" : scorePercent >= 70 ? "text-red-400" : scorePercent >= 46 ? "text-orange-400" : "text-zinc-500";

  return (
    <AppLayout>
      <div className="space-y-8 pb-10">

        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/5 border-l-4 border-l-red-500 p-8 md:p-12"
        >
          <div className="absolute right-0 top-0 w-2/3 h-full bg-gradient-to-l from-red-500/8 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-2xl">
            {/* OS badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-6">
              <span className={cn("w-2 h-2 rounded-full bg-red-500", osInfo.loading ? "animate-pulse" : "")} />
              {osInfo.loading
                ? (serverStats?.os ? `SYSTEM DETECTED — ${serverStats.os}` : "DETECTING SYSTEM...")
                : `SYSTEM DETECTED — ${osInfo.displayName}`}
            </div>

            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-3 leading-none tracking-tight">
              OPTI GODS <span className="text-red-500">by leaq</span>
            </h1>
            <p className="text-base md:text-lg text-zinc-400 mb-8 leading-relaxed font-medium">
              {TOTAL_TWEAKS_LABEL} tweaks. One script. Zero compromise.
            </p>

            <div className="flex flex-wrap gap-3">
              {isPro ? (
                <div
                  data-testid="badge-pro-active"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Pro Access Active — All Features Unlocked
                </div>
              ) : (
                <ProUnlockButton>
                  <Button
                    data-testid="button-hero-unlock-pro"
                    className="bg-red-600 hover:bg-red-700 text-white border border-red-500/40 shadow-[0_0_20px_-4px_rgba(220,38,38,0.5)] font-display font-bold px-7 py-2.5 text-sm tracking-wide transition-all"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Unlock Pro — ${proPrice} Lifetime
                  </Button>
                </ProUnlockButton>
              )}

              <Button
                data-testid="button-full-optimize"
                onClick={applyAllRecommended}
                disabled={recommendedApplied}
                className={cn(
                  "font-display font-bold px-7 py-2.5 text-sm tracking-wide transition-all",
                  recommendedApplied
                    ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default"
                    : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border border-red-500/40 shadow-[0_0_24px_-4px_rgba(220,38,38,0.6)] hover:shadow-[0_0_32px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
                )}
              >
                {recommendedApplied ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Optimized</>
                ) : (
                  <><Rocket className="w-4 h-4 mr-2" />Full Optimize</>
                )}
              </Button>

              <Button
                data-testid="button-restore-point"
                variant="outline"
                className="border-white/10 hover:bg-white/5 hover:text-white text-zinc-400 font-medium text-sm"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Create Restore Point First
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ─── OPTIMIZATION SCORE ─── */}
        {smartRecs.ids.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            data-testid="card-optimization-score"
            className={cn(
              "relative rounded-2xl border overflow-hidden",
              scorePercent >= 90
                ? "border-red-500/40 bg-gradient-to-br from-red-950/40 via-black to-black shadow-[0_0_60px_-20px_rgba(220,38,38,0.4)]"
                : "border-white/5 bg-black/50"
            )}
          >
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
              {/* SVG Ring */}
              <div className="relative shrink-0">
                <svg width="110" height="110" viewBox="0 0 100 100" className="rotate-[-90deg]">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#18181b" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={scorePercent >= 70 ? "#ef4444" : scorePercent >= 46 ? "#f97316" : "#52525b"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(scorePercent / 100) * 251.3} 251.3`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-display font-black text-white leading-none">{scorePercent}%</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">score</span>
                </div>
                {scorePercent >= 90 && (
                  <div className="absolute inset-0 rounded-full blur-[24px] bg-red-500/20 pointer-events-none" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5">
                  <span className={cn("text-sm font-black uppercase tracking-[0.2em]", tierColor)}>
                    {tierLabel}
                  </span>
                  {scorePercent === 100 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 font-black uppercase tracking-wide">🏆 100% Optimized</span>
                  )}
                  {scorePercent >= 90 && scorePercent < 100 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-black uppercase tracking-wide">🔥 Maxed</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mb-3">
                  {scorePercent === 100 ? (
                    <span className="text-red-400 font-bold">All recommended tweaks enabled — max performance unlocked!</span>
                  ) : (
                    <>
                      <span className="text-white font-bold">{recApplied}</span>
                      <span className="text-zinc-600"> of </span>
                      <span className="text-white font-bold">{achievableIds.length}</span>
                      {" "}tweaks selected — <span className="text-zinc-600">run the detect scan to verify what&apos;s actually in your registry</span>
                    </>
                  )}
                </p>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden max-w-xs mx-auto md:mx-0">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      scorePercent === 100 ? "bg-gradient-to-r from-red-500 via-red-400 to-orange-400" : scorePercent >= 70 ? "bg-gradient-to-r from-red-600 to-red-400" : scorePercent >= 46 ? "bg-orange-500" : "bg-zinc-600"
                    )}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>

              {/* CTA */}
              <div className="shrink-0">
                {scorePercent < 100 ? (
                  <Button
                    data-testid="button-boost-score"
                    onClick={applyAllRecommended}
                    className={cn(
                      "font-bold text-sm px-6 transition-all",
                      scorePercent >= 90
                        ? "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30"
                        : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_-4px_rgba(220,38,38,0.4)]"
                    )}
                  >
                    <Zap className="w-4 h-4 mr-1.5" />
                    {scorePercent === 0 ? "Get Started" : "Boost My Score"}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      data-testid="button-100pct-get-script"
                      onClick={() => window.dispatchEvent(new CustomEvent("optigods:open-script"))}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-black text-sm shadow-[0_0_20px_-4px_rgba(220,38,38,0.3)] hover:bg-red-500/25 hover:border-red-500/50 hover:scale-[1.03] transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Get My Script
                    </button>
                    <span className="text-[9px] text-zinc-600 font-medium">100% optimized — click to download</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── SYSTEM PROFILE CARD ─── */}
        {!hw.loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            data-testid="card-system-profile"
            className="rounded-xl border border-zinc-800 bg-black/50 px-5 py-4 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">System Profile</span>
                {hw.scanned && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-bold uppercase tracking-wide">Scanned</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  {hw.gpuName && hw.gpuName !== "Unknown GPU" ? (
                    <>
                      <span className="text-xs text-zinc-300 font-medium">{hw.gpuName}</span>
                      {hw.isNvidia && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-bold">NVIDIA</span>}
                      {hw.isAMD && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold">AMD</span>}
                      {hw.isIntel && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">INTEL</span>}
                    </>
                  ) : (
                    <span className="text-xs text-zinc-600 font-medium italic">GPU unknown — run scan below</span>
                  )}
                </div>
                {hw.cpuCores > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-300 font-medium">{hw.cpuLabel}</span>
                  </div>
                )}
                {hw.ramGB > 0 && (
                  <div className="flex items-center gap-1.5">
                    <MemoryStick className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-300 font-medium">{hw.ramLabel} RAM</span>
                    {!hw.scanned && <span className="text-[9px] text-zinc-600 italic">(approx)</span>}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-300 font-medium">{osInfo.displayName}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
                  <Zap className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-bold text-red-400">{totalTweaks} tweaks available</span>
                </div>
                {hw.scanned && (
                  <HardwareScanZone
                    onScanned={handleScanned}
                    onCleared={handleScanCleared}
                    isScanned={hw.scanned}
                  />
                )}
              </div>
            </div>
            {/* Hardware scan — full-width below specs row so the expanded panel never overflows */}
            {!hw.scanned && (
              <HardwareScanZone
                onScanned={handleScanned}
                onCleared={handleScanCleared}
                isScanned={hw.scanned}
              />
            )}
          </motion.div>
        )}

        {/* ─── SYSTEM SCAN PROMPT (replaces fake live monitor) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-xl border border-white/5 bg-black/50 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-black/30">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">System Snapshot</span>
            <span className="ml-auto text-[10px] text-zinc-600 font-mono">run hardware scan for live stats</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
            {/* CPU */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">CPU</span>
              </div>
              <p data-testid="stat-cpu-label" className="text-sm font-semibold text-white leading-snug">
                {hw.loading ? "Detecting..." : hw.cpuLabel}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {hw.scanned ? "via hardware scan" : "via browser API — run scan for full detail"}
              </p>
            </div>
            {/* GPU */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Monitor className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">GPU</span>
              </div>
              <p data-testid="stat-gpu-label" className="text-sm font-semibold text-white leading-snug">
                {hw.loading ? "Detecting..." : hw.gpuName}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {hw.isNvidia && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 font-bold">NVIDIA</span>}
                {hw.isAMD && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-bold">AMD</span>}
                {hw.isIntel && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold">INTEL</span>}
                <span className="text-[9px] text-zinc-700">{hw.scanned ? "scan confirmed" : "via WebGL"}</span>
              </div>
            </div>
            {/* RAM + Resolution */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MemoryStick className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">RAM / Resolution</span>
              </div>
              <p data-testid="stat-ram-label" className="text-sm font-semibold text-white">
                {hw.loading ? "Detecting..." : hw.ramLabel}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{hw.ramNote}</p>
              {hw.resolution && (
                <p className="text-[10px] text-zinc-600 mt-1.5 font-mono">
                  {hw.resolution} <span className="text-zinc-700">display</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ─── TWEAK CATEGORY BREAKDOWN ─── */}
        {enabledCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            className="rounded-xl border border-white/5 bg-black/50 px-5 py-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Tweaks by Category</span>
              </div>
              <span className="text-xs font-bold text-white">{enabledCount} <span className="text-zinc-600 font-normal">/ {totalTweaks} tweaks</span></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { label: "FiveM",     keys: (k: string) => k.startsWith("FiveM"),    total: TWEAK_REGISTRY.filter(t => t.id.startsWith("FiveM")).length },
                { label: "Fortnite",  keys: (k: string) => k.startsWith("Fortnite"), total: TWEAK_REGISTRY.filter(t => t.id.startsWith("Fortnite")).length },
                { label: "Memory",    keys: (k: string) => k.startsWith("Mem") || k.startsWith("mem"), total: TWEAK_REGISTRY.filter(t => t.id.startsWith("Mem") || t.id.startsWith("mem")).length },
                { label: "Games",     keys: (k: string) => k.startsWith("game_"),    total: TWEAK_REGISTRY.filter(t => t.id.startsWith("game_")).length },
                { label: "Services",  keys: (k: string) => k.startsWith("Service"),  total: TWEAK_REGISTRY.filter(t => t.id.startsWith("Service")).length },
                { label: "Privacy",   keys: (k: string) => k.startsWith("Privacy"),  total: TWEAK_REGISTRY.filter(t => t.id.startsWith("Privacy")).length },
                { label: "Process",   keys: (k: string) => k.startsWith("Process"),  total: TWEAK_REGISTRY.filter(t => t.id.startsWith("Process")).length },
                { label: "Registry",  keys: (k: string) => !["FiveM","Fortnite","game_","Process","Mem","mem","Service","Privacy"].some(p => k.startsWith(p)), total: TWEAK_REGISTRY.filter(t => !["FiveM","Fortnite","game_","Process","Mem","mem","Service","Privacy"].some(p => t.id.startsWith(p))).length },
              ].map(({ label, keys, total }) => {
                const active = Object.entries(tweaks).filter(([k, v]) => v && keys(k)).length;
                const pct = Math.round((active / total) * 100);
                if (active === 0) return null;
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-400">{label}</span>
                      <span className="text-[10px] font-bold text-white">{active}<span className="text-zinc-700">/{total}</span></span>
                    </div>
                    <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </motion.div>
        )}

        {/* ─── HOW IT WORKS — 3-STEP STRIP (moved to top) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-2"
        >
          {HOW_TO_STEPS.map((step, i) => (
            <div key={i} className="relative flex items-start gap-3 p-4 rounded-xl bg-black/50 border border-white/5 hover:border-red-500/20 transition-colors group">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
                  <span className="text-base font-black text-red-400 font-display leading-none">{i + 1}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <step.icon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide">{step.title}</h3>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
              {i < HOW_TO_STEPS.length - 1 && (
                <ChevronRight className="hidden md:block absolute -right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-700 z-10" />
              )}
            </div>
          ))}
        </motion.div>

        {/* ─── ONE-CLICK RECOMMENDED BANNER ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={cn(
            "relative rounded-2xl overflow-hidden border p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 transition-all",
            recommendedApplied
              ? "bg-emerald-950/30 border-emerald-500/30"
              : "bg-black/70 border-red-500/30 shadow-[0_0_40px_-10px_rgba(220,38,38,0.25)]"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className={cn("w-5 h-5 shrink-0", recommendedApplied ? "text-emerald-400" : "text-red-400")} />
              <span className={cn("text-xs font-bold uppercase tracking-widest", recommendedApplied ? "text-emerald-400" : "text-red-400")}>
                {recommendedApplied ? "Tweaks Applied — Ready to Download" : "New Here? Start Here"}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white mb-1 leading-tight">
              {recommendedApplied ? "All Tweaks Enabled" : "Enable All Tweaks in One Click"}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {recommendedApplied
                ? "Click GET MY SCRIPT (top right) to download your personalized script. Restart your PC after running it."
                : `All ${totalTweaks} tweaks enabled — hardware filtering runs at script generation so only compatible tweaks land in your .bat. No uninstalls, no risks.`}
            </p>
          </div>

          <div className="relative z-10 shrink-0 flex flex-col items-center gap-2">
            {recommendedApplied ? (
              <div
                data-testid="badge-recommended-applied"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                {enabledCount} Tweaks Enabled
              </div>
            ) : (
              <Button
                data-testid="button-apply-all-recommended"
                onClick={applyAllRecommended}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold px-8 py-3 text-base rounded-xl border border-red-500/50 shadow-[0_0_24px_-4px_rgba(220,38,38,0.6)] transition-all hover:shadow-[0_0_32px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Enable All {totalTweaks} Tweaks
              </Button>
            )}
            <span className="text-[10px] text-zinc-600 text-center">
              {recommendedApplied ? "You can still customize any tweak below" : "Safe for all PCs · Reversible · No data deleted"}
            </span>
          </div>
        </motion.div>


        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">What's Included</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18 + i * 0.04 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/15 hover:bg-red-500/3 transition-all group"
              >
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0 group-hover:bg-red-500/15 transition-colors">
                  <feat.icon className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{feat.title}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Pricing / Pro-active card */}
          {isPro ? (
            <div
              data-testid="badge-pricing-pro-active"
              className="lg:col-span-2 relative rounded-2xl bg-black/60 border border-red-500/25 overflow-hidden p-7 flex flex-col justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-5">
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 shrink-0">
                  <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-sm mb-2">
                    <CheckCircle2 className="w-3 h-3" /> Pro Access Active
                  </div>
                  <h2 className="text-2xl font-display font-bold text-white leading-none mb-1">All Features Unlocked</h2>
                  <p className="text-sm text-zinc-400">Lifetime access — configure your tweaks and download your script.</p>
                </div>
              </div>
              <div className="relative z-10 mt-5 grid grid-cols-2 gap-2">
                {PRO_BULLETS.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="text-xs text-zinc-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 relative rounded-2xl bg-black/60 border border-red-500/20 overflow-hidden p-7">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-red-500/5 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="inline-block text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-sm">
                        One-Time Lifetime Access
                      </div>
                      {isWeekendDeal && (
                        <div className="inline-block text-[10px] font-bold uppercase tracking-widest bg-amber-500 text-black px-2 py-0.5 rounded-sm animate-pulse">
                          Weekend Deal
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-3xl font-display font-bold text-white leading-none">${proPrice}</h2>
                      {isWeekendDeal && (
                        <span className="text-lg text-zinc-500 line-through font-display">$25</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">No subscription. No expiry.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <Zap className="w-6 h-6 text-red-500" />
                  </div>
                </div>
                <div className="space-y-2 mb-7">
                  {PRO_BULLETS.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="text-sm text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>
                <ProUnlockButton className="w-full">
                  <Button
                    data-testid="button-pricing-unlock-pro"
                    className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-500/40 shadow-[0_0_20px_-4px_rgba(220,38,38,0.4)] font-display font-bold py-3 text-sm tracking-wide transition-all"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Unlock Pro — ${proPrice}
                  </Button>
                </ProUnlockButton>
              </div>
            </div>
          )}

          {/* Tweaks counter */}
          <div className="flex flex-col gap-3">
            {[
              {
                label: "Tweaks Enabled",
                value: String(enabledCount),
                sub: `of ${totalTweaks} available`,
                color: optColor,
              },
              {
                label: "Optimization Level",
                value: optLevel,
                sub: enabledCount === 0 ? "Enable tweaks to begin" : `${enabledCount} active`,
                color: optColor,
              },
              {
                label: "Resolution",
                value: hw.loading ? "..." : hw.resolution || "Unknown",
                sub: "detected",
                color: "text-white",
              },
              {
                label: "GPU Vendor",
                value: hw.loading ? "..." : hw.isNvidia ? "NVIDIA" : hw.isAMD ? "AMD" : hw.isIntel ? "Intel" : "Unknown",
                sub: hw.isNvidia ? "HAGS + MSI Mode available" : hw.isAMD ? "HAGS (RX 6000+)" : "Check GPU settings",
                color: "text-white",
              },
            ].map((c, i) => (
              <div key={c.label} className="flex-1 p-4 rounded-xl bg-black/40 border border-white/5">
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">{c.label}</p>
                <p className={cn("text-xl font-bold font-display", c.color)}>{c.value}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* System Status Bar */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="flex items-center divide-x divide-white/5 rounded-xl bg-black/40 border border-white/5 overflow-hidden"
        >
          {[
            { label: "OS", value: osInfo.loading ? "Detecting…" : osInfo.os, title: osInfo.loading ? "" : osInfo.displayName, icon: <HardDrive className="w-3.5 h-3.5 text-zinc-500" />, testid: "card-stat-0" },
            { label: "CPU", value: hw.loading ? "…" : hw.cpuCores > 0 ? `${hw.cpuCores} Threads` : "Unknown", title: hw.cpuLabel, icon: <Cpu className="w-3.5 h-3.5 text-red-500" />, testid: "card-stat-1" },
            { label: "RAM", value: hw.loading ? "…" : hw.ramLabel, title: hw.ramNote, icon: <MemoryStick className="w-3.5 h-3.5 text-zinc-500" />, testid: "card-stat-2" },
            { label: "GPU", value: hw.loading ? "…" : hw.gpuName.length > 26 ? hw.gpuName.slice(0, 26) + "…" : hw.gpuName || "Unknown", title: hw.gpuName, icon: <Monitor className="w-3.5 h-3.5 text-zinc-500" />, testid: "card-stat-3" },
          ].map((stat) => (
            <div key={stat.label} data-testid={stat.testid} className="flex-1 flex items-center gap-2 px-4 py-3 min-w-0">
              {stat.icon}
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider shrink-0">{stat.label}</span>
              <span className="text-xs font-semibold text-zinc-200 truncate" title={stat.title || stat.value}>{stat.value}</span>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ScanImport />
        </motion.div>

        {/* System Health Report */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-900 border border-white/5 group-hover:border-red-500/20 transition-colors">
              <Radio className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">System Health Report</p>
              <p className="text-[11px] text-zinc-500">Download a read-only PS1 that scans 25+ registry keys — shows your optimization score and exactly which tweaks are already applied.</p>
            </div>
          </div>
          <Button
            data-testid="button-download-health-report"
            size="sm"
            onClick={() => { const a = document.createElement('a'); a.href = apiUrl('/api/scan/script'); a.download = 'OptiGods-ScanSystem.bat'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
            variant="outline"
            className="shrink-0 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 gap-1.5 font-bold uppercase tracking-wide"
          >
            <Download className="w-3.5 h-3.5" />
            Download Scan
          </Button>
        </motion.div>

        {/* Quick Boost Presets */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Quick Boost Presets</h2>
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">one click — all tweaks enabled instantly</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5 px-1">Pick a preset to instantly enable a curated set of tweaks, then download your script.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_BOOST_PRESETS.map((preset, i) => {
              const isActive = activeBoost === preset.id;
              return (
                <motion.button
                  key={preset.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  onClick={() => applyQuickBoost(preset)}
                  data-testid={`button-quick-boost-${preset.id}`}
                  className={cn(
                    "relative text-left p-4 rounded-xl border transition-all duration-300 group",
                    isActive
                      ? `${preset.activeBg} ${preset.border} ${preset.glow}`
                      : `bg-black/40 ${preset.border}`
                  )}
                >
                  {isActive && (
                    <span className="absolute top-2 right-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                  )}
                  <preset.icon className={cn("w-5 h-5 mb-3 transition-transform group-hover:scale-110", preset.color)} />
                  <h3 className="text-sm font-bold text-white mb-1">{preset.title}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">{preset.desc}</p>
                  <div className={cn("text-[10px] font-bold uppercase tracking-wider", preset.color)}>
                    {preset.tweaks.length} tweaks →
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>


        
      </div>
    </AppLayout>
  );
}
