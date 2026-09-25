import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@/lib/api-base";
import { createRestorePoint, detectAppliedTweaks, getNativeAuthToken, importNvidiaPreset, isNative } from "@/lib/tauri-bridge";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShieldAlert, Zap, Cpu, HardDrive, Monitor, Trash2,
  CheckCircle2, Download, Terminal, RotateCcw, RefreshCw, ChevronRight,
  MemoryStick, Wifi, Settings2, Gamepad2, Crosshair, Power, Search, Lock, Rocket, Flame, Shield, Radio, ScanLine,
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
import { useProStatus, useProStatusLoading } from "@/lib/pro-status";
import { useAuth, loginWithDiscord } from "@/hooks/use-auth";
import { ProUnlockButton } from "@/components/pro-gate";
import { TOTAL_TWEAKS, TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { TWEAK_REGISTRY } from "@/lib/tweak-registry";
import { ScanImport } from "@/components/scan-import";
import { HardwareScanZone } from "@/components/hardware-scan";
import { PerformanceAllowanceCard } from "@/components/performance-allowance-card";
import {
  applyTweakBatch,
  queueTweakBatch,
  readNativeTweakRun,
  subscribeNativeTweakRun,
  type NativeTweakRunState,
} from "@/lib/native-tweak-runner";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { authorizeHardwarePreset } from "@/lib/hardware-preset";
import { playOptimizationActionSound } from "@/lib/action-sound";
import { DEBLOAT_TWEAK_IDS, GAME_DETECT_PACK_IDS } from "@shared/preset-builder";
import { BEST_15_IDS_KEY, getNativeAuthHeaders, getPersistentDeviceId, PRO_SESSION_KEY } from "@/lib/queryClient";
import { NATIVE_RESTORE_CREATED_KEY } from "@/lib/native-readiness";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function readBest15Ids(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BEST_15_IDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

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

const GAME_PACK_LABELS: Record<string, string> = {
  game_valorant: "VALORANT",
  game_cod: "Call of Duty",
  game_apex: "Apex Legends",
  game_warzone: "Warzone",
  game_lol: "League of Legends",
  game_overwatch: "Overwatch",
  game_siege: "Rainbow Six Siege",
  game_rust: "Rust",
  game_minecraft: "Minecraft",
  game_roblox: "Roblox",
  game_tarkov: "Escape from Tarkov",
  game_pubg: "PUBG",
  game_dbd: "Dead by Daylight",
  game_dota2: "Dota 2",
  game_warframe: "Warframe",
  game_forza: "Forza",
  game_readyornot: "Ready or Not",
  game_phasmo: "Phasmophobia",
  game_battlefield: "Battlefield",
  game_gta5: "GTA V",
  game_fivem: "FiveM",
  game_rocketleague: "Rocket League",
  game_arcraiders: "ARC Raiders",
  game_marvelrivals: "Marvel Rivals",
  game_007firstlight: "007: First Light",
  game_fortnite: "Fortnite",
};

// Quick Boost Presets — V5.2.34. Max FPS uses the same hardware-aware action
// as Full Optimize; the other cards remain focused preset selections.

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
// Everything Safe plus power-throttle removal, full service list, COD/FiveM/Fortnite packs, startup cleanup.
const MAX_FPS_TWEAKS = [
  ...SAFE_TWEAKS,
  // Power throttle removal
  "DisablePowerThrottling", "DisablePowerThrottlingAdv",
  // Hardware interrupts
  "DisableUSBSuspend",
  // Network full stack
  "OptimizeTCP", "EnableTCPAutoTuning",
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
  "DisablePrefetch", "MemFixedPagefile",
  // FiveM full pack (no-op if not installed)
  "FiveMHighPriority", "FiveMFullPerfStack", "FiveMGTAProcessPerfOptions", "FiveMRenderingBoost",
  "FiveMGPUPriorityStack", "FiveMDisableMPO", "FiveMReduceNPCDensity", "FiveMCommandLineTweaks",
  "FiveMDisableLSO", "FiveMEnableRSS", "FiveMCacheClear", "FiveMNetworkBuffer",
  "FiveMDisableNvidiaTelemetry", "FiveMGameModeAdd",
  // Registry deep tuning
  "RegistryNTFSOptimize", "RegistryIOPageLock",
  // COD full pack (no-op if not installed)
   "CodDirectXQueue", "CodHighPriority", "CodMMCSS",
  "CodTCPOptimize", "CodNetworkBuffer", "CodRawInput", "CodDisableXboxCapture",
  "CodDisableLSO", "CodDisableTelemetry", "CodQoSPolicy",
   "CodTdrDelay", "CodFramePacing", "CodPagefileOptimize", "CodMemPriority",
  // Spotify full pack
  "SpotifyDisableAutoUpdate", "SpotifyLimitBandwidth",
  // Fortnite FPS pack (no-op if not installed)
  "FortniteHighPriority", "FortniteUncapGameFPS", "FortniteUncapLobbyFPS",
  "FortniteDisableMotionBlur", "FortniteLowShadows", "FortniteDisableRecording",
  "FortniteNetworkBuffer", "FortniteDisableThrottling",
  // Startup app cleanup — removes background launch, apps still open normally
  "su_discord", "su_spotify", "su_skype", "su_teams",
  "su_ccleaner", "su_battlenet", "su_epic", "su_chrome", "su_razer",
  "su_amdradeon", "su_rtss", "su_logitech",
  // Maximum-performance hardware and process layer — no competitive preset
  // should be stronger than the primary Max FPS choice.
  "EnableMSIMode_Safe",
  "NvidiaMaxPerfMode", "NvidiaPreRenderedFrames",
  "NvidiaShaderCache", "NvidiaOptimizeLatency",
  "AmdDisableULPS", "AmdDisableChill", "AmdDisablePowerEfficiency",
  "AmdMaxClockState", "AmdDisableTelemetry", "AmdDisableCrashDefender",
  "AmdOptimizeLatency", "AmdShaderCache", "AmdTextureFilterPerf",
  "AmdSurfaceFormatOpt", "AmdTessOverride16x", "AmdRadeonBoostOff",
  "AmdD3DOptimize", "AmdPCIeOptimize",
  "ProcessLassoAffinityGaming", "ProcessLassoProBalance", "ProcessAutoKillHung",
  "ProcessLassoInstanceBalancer",
  "FortniteDisableVSync", "FortniteInputLatency", "FortniteDisableSSR",
  "FortniteRawInput", "FortniteDisableLumen", "FortniteAffinityPhysical",
  "DiscordLowPriority", "DiscordOptimizeCodec", "DiscordReduceGPUPriority",
  "DiscordDisableVAD", "DiscordDisableClips", "DiscordDisableUpdateCheck",
  "DiscordDisableCrashHandler", "DiscordDisableAnimations",
];

// ── Competitive Shooter ────────────────────────────────────────────────────
// Everything Max FPS + full GPU vendor packs (NVIDIA + AMD), Process Lasso, complete Discord tuning.
const COMPETITIVE_TWEAKS = [
  ...MAX_FPS_TWEAKS,
  // MSI interrupt mode — safe version (no BSOD risk, filters GPU + NVMe + NIC)
  "EnableMSIMode_Safe",
  // NVIDIA performance pack — no-op on AMD/Intel systems
  "NvidiaMaxPerfMode", "NvidiaPreRenderedFrames",
  "NvidiaShaderCache", "NvidiaOptimizeLatency",
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
];

// ── Streamer Mode ──────────────────────────────────────────────────────────
// Goal: game performance + stable OBS encode + smooth Discord + low-noise desktop.
// Deliberately OMITS DisableXboxGameBar / DisableGameDVR — some capture setups need them.
const STREAMER_TWEAKS = [
  // CPU scheduling — balanced between game priority and encoder threads
  "Win32PrioritySeparation", "SetResponsiveness", "GameModeTweaks",
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
    tag: "NO RISK",
    desc: "Pure registry tweaks — CPU scheduling, power plan, privacy, memory, and game packs. Zero service stops. Safe for any PC.",
    color: "text-white",
    border: "border-white/30 hover:border-white/60",
    glow: "shadow-[0_0_28px_-6px_rgba(255,255,255,0.25)]",
    activeBg: "bg-white/[0.06]",
    accentBar: "bg-gradient-to-r from-white to-zinc-300",
    iconBg: "bg-white/10 border border-white/20",
    tagBg: "bg-white/10 border-white/25 text-white",
    tweaks: SAFE_TWEAKS,
  },
  {
    id: "maxfps",
    icon: Flame,
    title: "Max FPS Gaming",
    tag: "RECOMMENDED",
    desc: "Runs the same hardware-aware Full Optimize flow, including the compatible Windows, game, GPU, memory, and performance recommendations for this PC.",
    color: "text-red-400",
    border: "border-red-500/30 hover:border-red-500/60",
    glow: "shadow-[0_0_28px_-6px_rgba(239,68,68,0.3)]",
    activeBg: "bg-red-950/30",
    accentBar: "bg-gradient-to-r from-red-600 to-red-400",
    iconBg: "bg-red-500/10 border border-red-500/20",
    tagBg: "bg-red-500/10 border-red-500/25 text-red-400",
    tweaks: MAX_FPS_TWEAKS,
  },
  {
    id: "competitive",
    icon: Crosshair,
    title: "Competitive Shooter",
    tag: "GPU TUNED",
    desc: "Max FPS + full NVIDIA & AMD driver packs, MSI interrupt mode, Process Lasso engine, Discord footprint crush.",
    color: "text-emerald-400",
    border: "border-emerald-500/30 hover:border-emerald-500/60",
    glow: "shadow-[0_0_28px_-6px_rgba(52,211,153,0.25)]",
    activeBg: "bg-emerald-950/30",
    accentBar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    iconBg: "bg-emerald-500/10 border border-emerald-500/20",
    tagBg: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    tweaks: COMPETITIVE_TWEAKS,
  },
  {
    id: "streamer",
    icon: Radio,
    title: "Streamer Mode",
    tag: "OBS STABLE",
    desc: "Game perf balanced with stable OBS encoder threads — no stutter drops. Full Discord + Spotify yield. Boot cleanup.",
    color: "text-blue-400",
    border: "border-blue-500/30 hover:border-blue-500/60",
    glow: "shadow-[0_0_28px_-6px_rgba(59,130,246,0.3)]",
    activeBg: "bg-blue-950/30",
    accentBar: "bg-gradient-to-r from-blue-600 to-blue-400",
    iconBg: "bg-blue-500/10 border border-blue-500/20",
    tagBg: "bg-blue-500/10 border-blue-500/25 text-blue-400",
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
    desc: "Use the Enable controls in Tweaks. Supported desktop actions apply instantly and are tracked automatically.",
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
  const native = isNative();
  const { isAuthenticated } = useAuth();
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
  const smartRecs = computeSmartRecs(hw, osInfo);
  const hasProEntitlement = useProStatus();
  const isPro = isAuthenticated && hasProEntitlement;
  const proStatusLoading = useProStatusLoading();
  const { tweaks, appliedAt, setAllTweaks } = useOptimizationStore();
  const [detectedNativeTweaks, setDetectedNativeTweaks] = useState<Record<string, boolean>>({});
  const [nativeDetectionReady, setNativeDetectionReady] = useState(!native);
  const [lastNativeRun, setLastNativeRun] = useState<NativeTweakRunState | null>(() => native ? readNativeTweakRun() : null);
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

  const downloadRestorePointBat = async () => {
    const res = await fetch(apiUrl("/api/script/create-restore-point"));
    if (!res.ok) throw new Error("Server error generating BAT");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OptiGods-CreateRestorePoint.bat";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const [creatingRestore, setCreatingRestore] = useState(false);
  const handleRestorePoint = async () => {
    setCreatingRestore(true);
    try {
      if (native) {
        let nativeOk = false;
        let nativeErr = "";
        try {
          const result = await createRestorePoint("OptiGods V4 — Before Optimization");
          if (result) {
            toast({ title: "Restore point created", description: `Checkpoint #${result.sequence_number} saved — review or undo applied changes anytime from Applied Tweaks.` });
            nativeOk = true;
          }
        } catch (e: unknown) {
          nativeErr = e instanceof Error ? e.message : String(e);
        }
        if (!nativeOk) {
          toast({
            title: "Restore point failed",
            description: nativeErr
              ? nativeErr.replace("create_restore_point: ", "").slice(0, 160)
              : "Could not create restore point. Check that System Restore is enabled and the app is running as administrator.",
            variant: "destructive",
          });
        }
      } else {
        await downloadRestorePointBat();
        toast({ title: "Restore point script downloaded", description: "Run OptiGods-CreateRestorePoint.bat as admin before optimizing." });
      }
    } catch {
      toast({ title: "Error", description: "Could not create restore point.", variant: "destructive" });
    } finally {
      setCreatingRestore(false);
    }
  };

  const [activeBoost, setActiveBoost] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [confirmFullOptimize, setConfirmFullOptimize] = useState(false);
  const [selectedFullOptimizeGames, setSelectedFullOptimizeGames] = useState<string[]>([]);
  const [selectedFullOptimizeDebloat, setSelectedFullOptimizeDebloat] = useState<string[]>([]);
  const [refreshingScore, setRefreshingScore] = useState(false);
  const [confirmQuickBoost, setConfirmQuickBoost] = useState<typeof QUICK_BOOST_PRESETS[number] | null>(null);

  const applySupportedNvidiaPreset = async () => {
    if (!native) return null;
    const discreteNvidiaGpus = hw.gpus.filter(gpu => gpu.vendor === "nvidia" && !gpu.isIntegrated);
    if (discreteNvidiaGpus.length !== 1 || hw.isHybridGpu) return null;
    if (!sessionStorage.getItem(NATIVE_RESTORE_CREATED_KEY)) {
      const restorePoint = await createRestorePoint("Before Opti Gods NVIDIA preset");
      if (!restorePoint?.sequence_number) {
        throw new Error("Windows did not confirm a restore point before the NVIDIA preset.");
      }
      sessionStorage.setItem(NATIVE_RESTORE_CREATED_KEY, String(restorePoint.sequence_number));
    }
    const nativeAuth = await getNativeAuthToken();
    const proSession = localStorage.getItem(PRO_SESSION_KEY);
    const deviceId = getPersistentDeviceId();
    const auth = nativeAuth || (proSession ? `pro:${proSession}` : null) || (deviceId ? `device:${deviceId}` : null);
    if (!auth) throw new Error("Windows device authorization is unavailable.");
    const response = await fetch(apiUrl("/api/performance-allowance/native-ticket"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
      body: JSON.stringify({ tweakId: "ImportNvidiaPresetPro", sessionToken: proSession ?? undefined }),
    });
    const body = await response.json().catch(() => ({})) as { ticket?: string; error?: string };
    if (!response.ok || typeof body.ticket !== "string") {
      throw new Error(body.error || "The supported NVIDIA preset was not authorized.");
    }
    return importNvidiaPreset(body.ticket, auth);
  };

  const refreshDetectedState = useCallback(async () => {
    if (!native) return;
    setRefreshingScore(true);
    try {
      setDetectedNativeTweaks(await detectAppliedTweaks());
      setNativeDetectionReady(true);
    } catch {
      // Never use local browser timestamps as proof that Windows changed.
      setNativeDetectionReady(true);
    } finally {
      setRefreshingScore(false);
    }
  }, [native]);

  useEffect(() => {
    void refreshDetectedState();
    if (!native) return;
    const interval = window.setInterval(() => { void refreshDetectedState(); }, 15_000);
    return () => window.clearInterval(interval);
  }, [native, refreshDetectedState]);

  useEffect(() => {
    if (!native) return;
    const syncRun = (state: NativeTweakRunState | null) => {
      setLastNativeRun(state);
      if (state && ["completed", "failed", "stopped"].includes(state.status)) {
        void detectAppliedTweaks().then(setDetectedNativeTweaks).catch(() => {});
      }
    };
    syncRun(readNativeTweakRun());
    return subscribeNativeTweakRun(syncRun);
  }, [native]);

  const executeFullOptimize = async () => {
    if (bulkApplying) return;
    if (!isAuthenticated && !native) {
      loginWithDiscord("/dashboard");
      return;
    }
    if (!isPro) {
      document.querySelector('[data-testid="performance-allowance-card"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.dispatchEvent(new Event("optigods:enable-best-free"));
      return;
    }
    setBulkApplying(true);
    try {
      const body = await authorizeHardwarePreset(selectedFullOptimizeGames);
      const ids = Array.isArray(body.authorizedIds) ? body.authorizedIds.filter((id): id is string => typeof id === "string") : [];
      const unknownIds = ids.filter(id => !TWEAK_REGISTRY.some(tweak => tweak.id === id));
      const recognizedIds = ids.filter(id => !unknownIds.includes(id));
      if (recognizedIds.length === 0) {
        throw new Error("The server returned no tweaks recognized by this app. Refresh the Windows app and run the hardware scan again.");
      }
      const compatibleIds = recognizedIds.filter(id => getTweakCompatibility(id).ok);
      const blockedIds = recognizedIds.filter(id => !getTweakCompatibility(id).ok);
      if (unknownIds.length > 0) {
        toast({
          title: "Skipped outdated preset entries",
          description: `${unknownIds.length} unsupported preset entr${unknownIds.length === 1 ? "y was" : "ies were"} skipped. The recognized tweaks will continue.`,
          variant: "destructive",
        });
      }
      if (compatibleIds.length === 0) {
        toast({
          title: "No compatible tweaks to run",
          description: "The saved hardware scan does not support any tweak in this preset. Run a fresh scan before Full Optimize.",
          variant: "destructive",
        });
        return;
      }
      if (native) {
        if (hw.gpus.some(gpu => gpu.vendor === "nvidia" && !gpu.isIntegrated)) {
          try {
            const presetMessage = await applySupportedNvidiaPreset();
            if (presetMessage) {
              toast({ title: "Supported NVIDIA preset applied", description: presetMessage, variant: "success" });
            }
          } catch (error) {
            toast({
              title: "NVIDIA preset failed",
              description: error instanceof Error ? error.message : "The NVIDIA preset was not confirmed by Windows.",
              variant: "destructive",
            });
          }
        }
        const nativeState = await detectAppliedTweaks();
        const pendingIds = compatibleIds.filter(id => !nativeState[id]);
        if (pendingIds.length === 0) {
          toast({ title: "Full Optimize is already confirmed", description: `Every compatible preset tweak is already confirmed on this Windows session.${blockedIds.length ? ` ${blockedIds.length} hardware-mismatched tweak${blockedIds.length === 1 ? "" : "s"} were left out.` : ""}`, variant: "destructive" });
          return;
        }
        queueTweakBatch(pendingIds);
        window.location.assign("/applied-tweaks?run=1");
        return;
      } else {
        const pendingIds = compatibleIds.filter(id => !activeIdsForDisplay.has(id));
        if (pendingIds.length === 0) {
          toast({ title: "All matched tweaks are already selected", description: "Your browser selection already contains every compatible tweak in this hardware preset.", variant: "destructive" });
          return;
        }
        const result = await applyTweakBatch(pendingIds);
        toast({
          title: "Select Pro preset for script",
          description: `${result.selectedIds.length} missing compatible tweaks selected in the browser${blockedIds.length ? `; ${blockedIds.length} hardware-mismatched tweak${blockedIds.length === 1 ? "" : "s"} left out` : ""}. Open the Windows app or download the script to apply them; Windows results cannot be confirmed here.`,
        });
      }
    } catch (error) {
      toast({
        title: "Could not build your hardware preset",
        description: error instanceof Error ? error.message : "A saved system scan is required.",
        variant: "destructive",
      });
    } finally {
      setBulkApplying(false);
    }
  };

  const applyAllRecommended = () => {
    if (bulkApplying || (native && (!nativeDetectionReady || recommendedApplied)) || proStatusLoading) return;
    if (!isPro) {
      // ProUnlockButton owns the paywall for guests and free users. Do not
      // silently redirect or consume the 15-tweak allowance from this CTA.
      return;
    }
    if (native) {
      const missingIds = scoreIds.filter(id => !activeIdsForDisplay.has(id));
      if (!missingIds.length) return;
      playOptimizationActionSound();
      queueTweakBatch(missingIds);
      window.location.assign("/applied-tweaks?run=1");
      return;
    }
    playOptimizationActionSound();
    setConfirmFullOptimize(true);
  };

  const executeQuickBoost = async (preset: typeof QUICK_BOOST_PRESETS[number]) => {
    if (bulkApplying) return;
    if (!isPro) {
      void applyAllRecommended();
      return;
    }
    setBulkApplying(true);
    try {
       const known = preset.tweaks.filter(id => TWEAK_REGISTRY.some(tweak => tweak.id === id));
       const unknown = preset.tweaks.filter(id => !TWEAK_REGISTRY.some(tweak => tweak.id === id));
       if (unknown.length > 0) {
         toast({
           title: "Skipped outdated preset entries",
           description: `${unknown.length} preset entr${unknown.length === 1 ? "y was" : "ies were"} not recognized by this app. The compatible entries will continue.`,
           variant: "destructive",
         });
       }
       if (known.length === 0) {
         throw new Error("This preset has no tweaks recognized by the current app. Refresh the Windows app and try again.");
       }
       const compatible = known.filter(id => getTweakCompatibility(id).ok);
       const blocked = known.filter(id => !getTweakCompatibility(id).ok);
        const nativeState = native ? await detectAppliedTweaks() : {};
        const pending = native ? compatible.filter(id => !nativeState[id]) : compatible;
       if (pending.length === 0) {
         toast({ title: `${preset.title} is already confirmed`, description: "Every compatible tweak in this preset is already confirmed on this Windows session.", variant: "destructive" });
         return;
       }
       const result = await applyTweakBatch(pending);
      setActiveBoost(preset.id);
      toast({
        title: native ? `${preset.title}: ${result.appliedIds.length} applied` : `${preset.title} selected`,
        description: native
           ? `${result.appliedIds.length} of ${pending.length} pending Windows changes confirmed${result.failures.length ? ` · ${result.failures.length} failed` : ""}${blocked.length ? ` · ${blocked.length} incompatible skipped` : ""}.`
          : `${result.selectedIds.length} compatible tweaks selected. Download and run the .bat to apply them.`,
        variant: native
          ? (result.failures.length || blocked.length ? "destructive" : "success")
          : undefined,
      });
    } catch (error) {
      toast({
        title: `${preset.title} could not start`,
        description: error instanceof Error ? error.message : "The preset was not run.",
        variant: "destructive",
      });
    } finally {
      setBulkApplying(false);
    }
  };

  const applyQuickBoost = (preset: typeof QUICK_BOOST_PRESETS[number]) => {
    if (bulkApplying) return;
    // Max FPS Gaming is intentionally the same hardware-aware operation as
    // the Full Optimize CTA. Keep one execution path so authorization,
    // compatibility checks, and native result handling cannot drift.
    if (preset.id === "maxfps") {
      applyAllRecommended();
      return;
    }
    if (!isPro) {
      void applyAllRecommended();
      return;
    }
    setConfirmQuickBoost(preset);
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
  const latestRunIsTerminal = native
    && Boolean(lastNativeRun)
    && lastNativeRun!.items.length > 0
    && ["completed", "failed", "stopped"].includes(lastNativeRun!.status);
  // Browser toggles are intent only. Native score/results come from Windows
  // plus the runner's confirmed-success ledger. The detector covers only a
  // small read-only subset, so it cannot be the sole source after a large run.
  const registryIds = new Set(TWEAK_REGISTRY.map(tweak => tweak.id));
  const matchedRecommendedIds = Array.from(smartRecs.ids).filter(id => {
    const tweak = TWEAK_REGISTRY.find(candidate => candidate.id === id);
    return Boolean(tweak) && tweak?.safety !== "expert" && getTweakCompatibility(id).ok;
  });
  const confirmedIds = native
    ? new Set([
      ...Object.keys(detectedNativeTweaks).filter(id => detectedNativeTweaks[id] && registryIds.has(id)),
      ...Object.keys(appliedAt).filter(id => registryIds.has(id)),
    ])
    : new Set<string>();
  const liveRunActive = native
    && Boolean(lastNativeRun)
    && ["running", "stopping"].includes(lastNativeRun!.status);
  if (liveRunActive) {
    lastNativeRun!.items
      .filter(item => item.status === "applied" && registryIds.has(item.id))
      .forEach(item => confirmedIds.add(item.id));
  }
  if (native && lastNativeRun) {
    lastNativeRun.items
      .filter(item => item.status === "applied" && registryIds.has(item.id))
      .forEach(item => confirmedIds.add(item.id));
  }
  // Native category totals must come from the live Windows detector, not the
  // browser intent store. The latter is persistent, but it is not proof that
  // a registry/service change still exists on this PC.
  const allActiveIdsForDisplay = native
    ? confirmedIds
    : new Set(Object.entries(tweaks).filter(([, enabled]) => enabled).map(([id]) => id));
  const savedBest15Ids = readBest15Ids();
  const freeAllowedIds = matchedRecommendedIds
    .filter(id => savedBest15Ids.length === 0 || savedBest15Ids.includes(id))
    .slice(0, 15);
  const activeIdsForDisplay = isPro
    ? allActiveIdsForDisplay
    : new Set(freeAllowedIds.filter(id => allActiveIdsForDisplay.has(id)));
  const latestLargeRunIds = latestRunIsTerminal && lastNativeRun
    ? Array.from(new Set(lastNativeRun.items
      .map(item => item.id)
      .filter(id => matchedRecommendedIds.includes(id))))
    : [];
  // A full native run is much larger than a retry or quick preset. Use its
  // exact set for the score and CTA so 373 applied / 10 failed stays visible.
  const scoreIds = latestLargeRunIds.length >= 100
    ? latestLargeRunIds
    : matchedRecommendedIds.length > 0 ? matchedRecommendedIds : achievableIds;
  const activeTweakCount = activeIdsForDisplay.size;
  const missingRecommendedCount = scoreIds.filter(id => !activeIdsForDisplay.has(id)).length;
  const recommendedActionLabel = missingRecommendedCount === 0
    ? "Review recommended tweaks"
    : `Apply ${missingRecommendedCount} missing tweaks`;
  const freeUnavailableCount = Math.max(0, matchedRecommendedIds.length - 15);
  const recApplied = native
    ? scoreIds.filter(id => activeIdsForDisplay.has(id)).length
    : scoreIds.filter(id => (tweaks as Record<string, boolean>)[id]).length;
  const rawScorePercent = scoreIds.length > 0 ? Math.round((recApplied / scoreIds.length) * 100) : 0;
  const fullOptimizeSucceeded = native
    && isPro
    && latestRunIsTerminal
    && lastNativeRun!.status === "completed"
    && lastNativeRun!.items.length > 0
    && lastNativeRun!.items.every(item => item.status === "applied")
    && scoreIds.every(id => activeIdsForDisplay.has(id));
  const recommendedApplied = fullOptimizeSucceeded;
  // 100% is reserved for a failure-free Pro full optimization. Detection can
  // still show the exact partial score, but a partial/Free run must stop at 99.
  const displayScore = rawScorePercent === 100 && !fullOptimizeSucceeded ? 99 : rawScorePercent;
  const tierLabel = native
    ? (displayScore === 100 ? "100% CONFIRMED" : displayScore >= 90 ? "GOD TIER" : displayScore >= 70 ? "ELITE" : displayScore >= 46 ? "DECENT" : displayScore > 0 ? "PARTIALLY OPTIMIZED" : "UNOPTIMIZED")
    : (displayScore === 100 ? "100% SELECTED" : displayScore >= 90 ? "PREVIEW — NOT APPLIED" : displayScore >= 70 ? "PREVIEW — NOT APPLIED" : displayScore >= 46 ? "DECENT PREVIEW" : displayScore > 0 ? "PARTIALLY OPTIMIZED" : "UNOPTIMIZED");
  const tierColor = displayScore > 0 ? "text-red-400" : "text-zinc-500";

  const boostScoreButton = (
    <Button
      data-testid="button-boost-score"
      onClick={applyAllRecommended}
      className={cn(
        "font-bold text-sm px-6 transition-all",
        displayScore >= 90
          ? "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30"
          : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_-4px_rgba(220,38,38,0.4)]",
      )}
    >
      <Zap className="w-4 h-4 mr-1.5" />
      {displayScore === 0 ? "Get Started" : "Boost My Score"}
    </Button>
  );

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
              {TOTAL_TWEAKS_LABEL} tweaks. Zero compromise.
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

               {!isPro && <PerformanceAllowanceCard embedded />}

              {isPro ? (
                <Button
                  data-testid="button-full-optimize"
                  onClick={applyAllRecommended}
                  disabled={(native && (!nativeDetectionReady || recommendedApplied)) || bulkApplying || proStatusLoading}
                  className={cn(
                    "font-display font-bold px-7 py-2.5 text-sm tracking-wide transition-all",
                    recommendedApplied
                      ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default"
                      : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border border-red-500/40 shadow-[0_0_24px_-4px_rgba(220,38,38,0.6)] hover:shadow-[0_0_32px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
                  )}
                >
                  {recommendedApplied ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Optimized</>
                  ) : native && !nativeDetectionReady ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Checking Windows state…</>
                  ) : (
                    <><Rocket className="w-4 h-4 mr-2" />{bulkApplying ? "Applying…" : proStatusLoading ? "Checking Access…" : recommendedActionLabel}</>
                  )}
                </Button>
              ) : (
                <ProUnlockButton>
                <Button
                    data-testid="button-best15-login"
                  disabled={native && !nativeDetectionReady}
                    className="bg-red-600 hover:bg-red-500 text-white font-display font-bold px-7 py-2.5 text-sm tracking-wide"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                  {native && !nativeDetectionReady ? "Checking Windows state…" : recommendedActionLabel}
                  </Button>
                </ProUnlockButton>
              )}

              <Button
                data-testid="button-restore-point"
                variant="outline"
                onClick={handleRestorePoint}
                disabled={creatingRestore}
                className="border-white/10 hover:bg-white/5 hover:text-white text-zinc-400 font-medium text-sm"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                {creatingRestore ? "Creating…" : "Create Restore Point First"}
              </Button>
            </div>
          </div>
        </motion.div>

        <AlertDialog open={confirmFullOptimize} onOpenChange={setConfirmFullOptimize}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Choose games and apps for Full Optimize</AlertDialogTitle>
              <AlertDialogDescription>
                Choose the games you play and the Windows apps you want removed. Shared hardware and
                Windows optimizations always run; unchecked game and debloat packs are skipped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {selectedFullOptimizeGames.length
                    ? `${selectedFullOptimizeGames.length} game${selectedFullOptimizeGames.length === 1 ? "" : "s"} selected`
                    : "No game packs selected"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFullOptimizeGames([...GAME_DETECT_PACK_IDS])}
                    className="text-[10px] font-bold uppercase tracking-wider text-red-300 hover:text-red-200"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFullOptimizeGames([])}
                    className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 sm:grid-cols-2">
                {GAME_DETECT_PACK_IDS.map(id => {
                  const checked = selectedFullOptimizeGames.includes(id);
                  return (
                    <label
                      key={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                        checked
                          ? "border-red-500/35 bg-red-500/10 text-red-100"
                          : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[.03]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedFullOptimizeGames(current =>
                          current.includes(id) ? current.filter(item => item !== id) : [...current, id],
                        )}
                        className="h-3.5 w-3.5 accent-red-600"
                      />
                      <span>{GAME_PACK_LABELS[id] ?? id.replace(/^game_/, "")}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {selectedFullOptimizeDebloat.length
                    ? `${selectedFullOptimizeDebloat.length} app${selectedFullOptimizeDebloat.length === 1 ? "" : "s"} selected for debloat`
                    : "No debloat apps selected"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFullOptimizeDebloat([...DEBLOAT_TWEAK_IDS])}
                    className="text-[10px] font-bold uppercase tracking-wider text-red-300 hover:text-red-200"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFullOptimizeDebloat([])}
                    className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 sm:grid-cols-2">
                {DEBLOAT_TWEAK_IDS.map(id => {
                  const checked = selectedFullOptimizeDebloat.includes(id);
                  const label = TWEAK_REGISTRY.find(tweak => tweak.id === id)?.title ?? id.replace(/^Debloat/, "");
                  return (
                    <label
                      key={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                        checked
                          ? "border-red-500/35 bg-red-500/10 text-red-100"
                          : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[.03]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedFullOptimizeDebloat(current =>
                          current.includes(id) ? current.filter(item => item !== id) : [...current, id],
                        )}
                        className="h-3.5 w-3.5 accent-red-600"
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Leave games and apps unchecked to run only hardware and Windows-wide optimizations.
                A restore point is required before native changes begin.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkApplying}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={bulkApplying}
                onClick={() => {
                  setConfirmFullOptimize(false);
                  void executeFullOptimize();
                }}
              >
                Confirm Full Optimize
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── QUICK BOOST PRESETS ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Quick Boost Presets</h2>
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">{isPro ? (native ? "confirmed Windows run — restore point first" : "select for script — Windows results require the app") : "Pro presets · free accounts get the best 15"}</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5 px-1">
            {isPro
              ? native
                ? "Pick a preset, confirm the warning, and review every compatible Windows result in Applied Tweaks. Script-only choices remain available for the downloadable .bat."
                : "Select a preset for your downloadable script. Browser mode cannot confirm Windows changes."
              : "Quick Boost presets require a linked Pro Discord account. Free accounts can enable the best 15 tweaks for their saved system scan."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_BOOST_PRESETS.map((preset, i) => {
              const isActive = activeBoost === preset.id;
              return (
                <motion.button
                  key={preset.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.05 }}
                  onClick={() => applyQuickBoost(preset)}
                  disabled={bulkApplying}
                  data-testid={`button-quick-boost-${preset.id}`}
                  className={cn(
                    "relative text-left rounded-xl border overflow-hidden transition-all duration-300 group",
                    isActive
                      ? `${preset.activeBg} ${preset.border} ${preset.glow}`
                      : `bg-black/50 ${preset.border}`
                  )}
                >
                  <div className={cn("h-[3px] w-full", preset.accentBar)} />
                  <div className="p-4">
                    {isActive && (
                      <span className="absolute top-3 right-3">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </span>
                    )}
                    <div className={cn("inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 transition-transform group-hover:scale-110", preset.iconBg)}>
                      <preset.icon className={cn("w-5 h-5", preset.color)} />
                    </div>
                    <div className={cn("inline-flex items-center mb-2 ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border align-middle", preset.tagBg)}>
                      {preset.tag}
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5 leading-tight">{preset.title}</h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">{preset.desc}</p>
                    <div className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", preset.tagBg)}>
                      <Zap className="w-2.5 h-2.5" />
                      {preset.id === "maxfps" ? "Full Optimize" : `${preset.tweaks.length} tweaks`}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <AlertDialog open={Boolean(confirmQuickBoost)} onOpenChange={open => { if (!open && !bulkApplying) setConfirmQuickBoost(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{native ? `Run ${confirmQuickBoost?.title}?` : `Select ${confirmQuickBoost?.title} for your script?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {native
                  ? "This Pro preset will run its compatible Windows tweaks after creating or verifying a restore point. Review every queued, applied, and failed result in Applied Tweaks. Incompatible choices are reported, not silently skipped."
                  : "Browser mode cannot change Windows or verify results. This selects the compatible Pro preset for your downloadable script; run that script as Administrator on Windows to apply it."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkApplying}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={bulkApplying || !confirmQuickBoost}
                onClick={() => {
                  const preset = confirmQuickBoost;
                  setConfirmQuickBoost(null);
                  if (preset) void executeQuickBoost(preset);
                }}
              >
                {native ? "Confirm Quick Boost" : "Select Preset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── OPTIMIZATION SCORE ─── */}
        {smartRecs.ids.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            data-testid="card-optimization-score"
            className={cn(
              "relative rounded-2xl border overflow-hidden",
              displayScore >= 90
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
                    stroke={displayScore >= 70 ? "#ef4444" : displayScore >= 46 ? "#f97316" : "#52525b"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(displayScore / 100) * 251.3} 251.3`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-display font-black text-white leading-none">{displayScore}%</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">score</span>
                </div>
                {displayScore >= 90 && (
                  <div className="absolute inset-0 rounded-full blur-[24px] bg-red-500/20 pointer-events-none" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5">
                  <span className={cn("text-sm font-black uppercase tracking-[0.2em]", tierColor)}>
                    {tierLabel}
                  </span>
                  {displayScore === 100 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 font-black uppercase tracking-wide">✓ {native ? "100% Confirmed" : "100% Selected"}</span>
                  )}
                  {native && displayScore >= 90 && displayScore < 100 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-black uppercase tracking-wide">🔥 Maxed</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mb-3">
                  <span className={displayScore === 100 ? "text-amber-400 font-bold" : "text-zinc-400"}>
                    <span className="text-white font-bold">{recApplied}</span>
                    <span className="text-zinc-600"> of </span>
                    <span className="text-white font-bold">{scoreIds.length}</span>
                     {" "}{native ? "compatible tweaks confirmed" : "compatible tweaks selected"} ·{" "}
                    <span className="text-zinc-500">
                      {native ? "Windows results are confirmed in Applied Tweaks." : "Windows changes are not verified in the browser."}
                    </span>
                  </span>
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden max-w-xs flex-1">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        displayScore === 100 ? "bg-gradient-to-r from-red-500 via-red-400 to-orange-400" : displayScore >= 70 ? "bg-gradient-to-r from-red-600 to-red-400" : displayScore >= 46 ? "bg-orange-500" : "bg-zinc-600"
                      )}
                      style={{ width: `${displayScore}%` }}
                    />
                  </div>
                  <button
                    data-testid="button-refresh-score"
                    onClick={() => { void refreshDetectedState(); }}
                    disabled={!native || refreshingScore}
                    className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-red-400 transition-colors shrink-0 border border-zinc-800 hover:border-red-500/30 px-2 py-1 rounded-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3 h-3", refreshingScore && "animate-spin")} />
                    {refreshingScore ? "Detecting…" : "Detect applied tweaks"}
                  </button>
                </div>
              </div>

              {/* CTA */}
              <div className="shrink-0">
                {displayScore < 100 ? (
                  <div className="flex flex-col gap-2">
                    {isPro ? boostScoreButton : <ProUnlockButton>{boostScoreButton}</ProUnlockButton>}
                  </div>
                ) : native ? (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    State tracked
                  </div>
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
                    <span className="text-[9px] text-zinc-600 font-medium">Selection complete — Windows execution is not verified here</span>
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
        {activeTweakCount > 0 && (
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
              <span className="text-xs font-bold text-white">{activeTweakCount} <span className="text-zinc-600 font-normal">/ {totalTweaks} tweaks</span></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from(new Set(TWEAK_REGISTRY.map(tweak => tweak.category)))
                .map(category => {
                  const categoryTweaks = TWEAK_REGISTRY.filter(tweak => tweak.category === category);
                  const active = categoryTweaks.filter(tweak => activeIdsForDisplay.has(tweak.id)).length;
                  const label = category.replace(/(^|-)(\w)/g, (_, separator, letter) => `${separator ? " " : ""}${letter.toUpperCase()}`);
                  return { label, total: categoryTweaks.length, active };
                })
                .filter(group => group.active > 0)
                .sort((a, b) => b.active - a.active)
                .map(({ label, active, total }) => {
                const pct = Math.round((active / total) * 100);
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
              })}
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
                {recommendedApplied ? (native ? "Tweaks Enabled" : "Tweaks Applied — Ready to Download") : native && !nativeDetectionReady ? "Checking Windows state" : "New Here? Start Here"}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white mb-1 leading-tight">
                {recommendedApplied ? "Compatible Tweaks Applied" : native && !nativeDetectionReady ? "Reading confirmed Windows changes…" : isPro ? recommendedActionLabel : `${matchedRecommendedIds.length} tweaks match your hardware`}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {recommendedApplied
                ? native
                  ? "Your enabled and detected tweaks are tracked here automatically. Use individual controls to change them."
                  : "Click GET MY SCRIPT (top right) to download your personalized script. Restart your PC after running it."
                : native
                  ? `Review the recommended controls and enable the ones you want. Supported actions apply directly inside Opti Gods.`
                  : isPro
                    ? (missingRecommendedCount === 0
                      ? "All compatible tweaks are accounted for. Review the controls below if you want to change them."
                      : `${missingRecommendedCount} compatible tweaks are not confirmed yet. Apply only what is missing from this PC.`)
                    : `${freeUnavailableCount} additional matched tweaks are unavailable on Free. Unlock Pro to apply the full hardware-matched set.`}
            </p>
          </div>

          <div className="relative z-10 shrink-0 flex flex-col items-center gap-2">
            {recommendedApplied ? (
              <div
                data-testid="badge-recommended-applied"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                {native ? activeTweakCount : enabledCount} Tweaks Enabled
              </div>
            ) : isPro ? (
              <Button
                data-testid="button-apply-all-recommended"
                onClick={applyAllRecommended}
                disabled={bulkApplying || (native && !nativeDetectionReady)}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold px-8 py-3 text-base rounded-xl border border-red-500/50 shadow-[0_0_24px_-4px_rgba(220,38,38,0.6)] transition-all hover:shadow-[0_0_32px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
              >
                <Rocket className="w-5 h-5 mr-2" />
                {bulkApplying ? "Applying…" : native && !nativeDetectionReady ? "Checking Windows state…" : recommendedActionLabel}
              </Button>
            ) : (
              <ProUnlockButton>
                <Button
                  data-testid="button-best15-login-banner"
                  disabled={bulkApplying}
                  className="bg-red-600 hover:bg-red-500 text-white font-display font-bold px-8 py-3 text-base rounded-xl"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  {native && !nativeDetectionReady ? "Checking Windows state…" : recommendedActionLabel}
                </Button>
              </ProUnlockButton>
            )}
            <span className="text-[10px] text-zinc-600 text-center">
              {recommendedApplied ? "You can still customize any tweak below" : "Safe for all PCs · Reversible · No data deleted"}
            </span>
          </div>
        </motion.div>


        {!isPro && (
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
        )}

        
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
              <div className="relative z-10 mt-4 flex items-center gap-2 text-[11px] text-zinc-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Download your script anytime — all tweaks, your rig, applied instantly.
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

      </div>
    </AppLayout>
  );
}
