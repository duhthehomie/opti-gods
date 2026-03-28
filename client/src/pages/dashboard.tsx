import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShieldAlert, Zap, Cpu, HardDrive, Monitor, Save, Trash2,
  FolderOpen, Plus, CheckCircle2, Download, Terminal, RotateCcw, ChevronRight,
  MemoryStick, Wifi, Settings2, Gamepad2, Crosshair, Power, Search, Lock, Rocket, Flame, Shield, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useHardwareInfo, type ScannedSysInfo } from "@/hooks/use-hardware-info";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { cn } from "@/lib/utils";
import { useProStatus } from "@/lib/pro-status";
import { ProUnlockButton } from "@/components/pro-gate";
import { ScanImport } from "@/components/scan-import";
import { FpsEstimate } from "@/components/fps-estimate";
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
  { icon: Search, title: "Game Detection", desc: "Auto-detect 19 games and apply per-game optimization packs" },
  { icon: Trash2, title: "Win10/11 Debloat", desc: "Remove bloatware, telemetry, and unnecessary background services" },
];

// Quick Boost Presets
const SAFE_TWEAKS = [
  "Win32PrioritySeparation","SetTimerResolution","SetResponsiveness","GameModeTweaks",
  "NetworkThrottling","DisableNagle","InputLagTCP","SetDNSPriority",
  "SetHighPerformancePlan","DisableXboxGameBar","DisableGameDVR",
  "DisablePointerPrecision","DisableCoreParking","EnableHAGS","DisableFastStartup",
];
const MAX_FPS_TWEAKS = [
  ...SAFE_TWEAKS,
  "DisableDynamicTick","EnableMSIMode","DisablePowerThrottlingAdv","DisableUSBSuspend",
  "DisableAnimations","DisableNDU","DisablePowerThrottling","MemDisableCompression",
  "OptimizeRAMUsage","ServiceDiagTrack","ServiceWSearch","PrivacyTelemetry",
];
const COMPETITIVE_TWEAKS = [
  ...MAX_FPS_TWEAKS,
  "ProcessLassoAffinityGaming","ProcessLassoProBalance","ProcessAutoKillHung",
  "game_valorant","game_cs2","game_apex","game_warzone","game_siege","game_lol",
  "FortniteHighPriority","FortniteDisableVSync","FortniteDisableMotionBlur",
  "FortniteInputLatency","FortniteUncapGameFPS","FiveMHighPriority","FiveMNetworkBuffer",
];
const STREAMER_TWEAKS = [
  "Win32PrioritySeparation","SetResponsiveness","SetTimerResolution",
  "NetworkThrottling","DisableNagle","SetHighPerformancePlan",
  "DisablePointerPrecision","DisableCoreParking","EnableHAGS","SetDNSPriority",
];

const QUICK_BOOST_PRESETS = [
  {
    id: "safe",
    icon: Shield,
    title: "Safe Boost",
    desc: "Recommended tweaks only — safe for any PC, no uninstalls, no service stops.",
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
    desc: "Aggressive CPU, network, and memory tweaks for the highest possible framerate.",
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
    desc: "All Max FPS tweaks + per-game priority packs for Valorant, CS2, Apex, Warzone, and more.",
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
    desc: "Performance boost without killing Game Bar or DVR — keeps OBS and stream capture working.",
    color: "text-violet-400",
    border: "border-violet-500/25 hover:border-violet-500/50",
    glow: "shadow-[inset_0_0_20px_-8px_rgba(139,92,246,0.1)]",
    activeBg: "bg-violet-500/5",
    tweaks: STREAMER_TWEAKS,
  },
];

// Global recommended tweaks — safe for every PC, biggest impact
const ALL_RECOMMENDED_TWEAKS = [
  // Core system responsiveness
  "Win32PrioritySeparation", "SetTimerResolution", "SetResponsiveness", "GameModeTweaks",
  "DisablePointerPrecision", "EnableHAGS",
  // Network
  "NetworkThrottling", "OptimizeTCP", "DisableNagle", "InputLagTCP", "SetDNSPriority",
  // Power
  "SetHighPerformancePlan", "DisableCoreParking", "DisableDynamicTick",
  // Visual / Game
  "DisableXboxGameBar", "DisableGameDVR", "DisableAnimations",
  // Memory
  "MemDisableCompression", "OptimizeRAMUsage",
  // Services (safe)
  "ServiceDiagTrack", "ServiceSysMain",
  // Privacy
  "PrivacyTelemetry", "PrivacyAdvertisingID",
  // FiveM
  "FiveMHighPriority", "FiveMCacheClear", "FiveMNetworkBuffer", "FiveMQueueFix",
  "FiveMFullPerfStack", "FiveMGTAProcessPerfOptions",
];

// How to use steps
const HOW_TO_STEPS = [
  {
    icon: Terminal,
    title: "Browse & Toggle",
    desc: "Hit 'Smart Recommendations' on the Home tab — it auto-selects 329+ tweaks matched to your exact GPU, CPU, and RAM. Or open any tab (Registry, FiveM, NVIDIA, etc.) and flip toggles manually. Red = will be applied.",
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
  "329+ registry, network, memory, and GPU tweaks",
  "FiveM, Fortnite, CS2, Valorant, and Apex packs",
  "Download your personalized .PS1 script",
  "Game auto-detection for 14 titles",
  "Preset save/load for quick re-apply",
  "Lifetime access — pay once, no subscription",
];

export default function Dashboard() {
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
  const smartRecs = computeSmartRecs(hw, osInfo);
  const isPro = useProStatus();
  const { tweaks, nvidiaPreset, setAllTweaks } = useOptimizationStore();
  const { data: savedPresets = [] } = useQuery<any[]>({
    queryKey: [api.presets.list.path],
  });
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
  const qc = useQueryClient();
  const { toast } = useToast();
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleScanned = useCallback((_info: ScannedSysInfo) => {
    window.location.reload();
  }, []);
  const handleScanCleared = useCallback(() => {
    window.location.reload();
  }, []);

  const createPreset = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(api.presets.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config: { tweaks, nvidiaPreset }, isDefault: false }),
      });
      if (!res.ok) throw new Error("Failed to save preset");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.presets.list.path] });
      setPresetName("");
      setSaving(false);
      toast({ title: "Preset saved!", description: `"${presetName}" has been saved.` });
    },
    onError: () => toast({ title: "Error", description: "Could not save preset.", variant: "destructive" }),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.presets.list.path] });
      toast({ title: "Preset deleted" });
    },
  });

  const loadPreset = (preset: any) => {
    setAllTweaks({ ...tweaks, ...preset.config.tweaks });
    toast({ title: `Loaded: ${preset.name}`, description: "Tweak states have been applied." });
  };

  const [activeBoost, setActiveBoost] = useState<string | null>(null);
  const [recommendedApplied, setRecommendedApplied] = useState(false);

  const applyAllRecommended = () => {
    const next = { ...tweaks };
    let applied = 0;
    const recIds = hw.loading ? ALL_RECOMMENDED_TWEAKS : Array.from(smartRecs.ids);
    recIds.forEach((key) => {
      if (key in next) { next[key] = true; applied++; }
    });
    setAllTweaks(next);
    setRecommendedApplied(true);
    toast({
      title: "Smart Recommended Tweaks Applied!",
      description: `${applied} tweaks enabled for your hardware. Click GET MY SCRIPT (top right) to get your script.`,
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
  const totalTweaks = Object.keys(tweaks).length;
  const optLevel = enabledCount === 0 ? "None" : enabledCount < 10 ? "Low" : enabledCount < 25 ? "Medium" : "High";
  const optColor = enabledCount === 0 ? "text-zinc-500" : enabledCount < 10 ? "text-zinc-300" : enabledCount < 25 ? "text-zinc-100" : "text-red-400";

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
              329+ tweaks. One script. Zero compromise.
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
                  <span className="text-xs font-bold text-red-400">{smartRecs.ids.size} tweaks recommended</span>
                </div>
                <HardwareScanZone
                  onScanned={handleScanned}
                  onCleared={handleScanCleared}
                  isScanned={hw.scanned}
                />
              </div>
            </div>
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
              <span className="text-xs font-bold text-white">{enabledCount} <span className="text-zinc-600 font-normal">/ 281 total</span></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { label: "Registry",  keys: (k: string) => !["FiveM","Fortnite","Nvidia","game_","ProcessLasso","ProcessAuto","ProcessTrim","Discord","Mem","Service","Privacy","su_","Debloat","Remove","Amd","IntGpu"].some(p => k.startsWith(p)), total: 120 },
                { label: "FiveM",     keys: (k: string) => k.startsWith("FiveM"), total: 28 },
                { label: "Fortnite",  keys: (k: string) => k.startsWith("Fortnite"), total: 18 },
                { label: "Memory",    keys: (k: string) => k.startsWith("Mem") || k.startsWith("mem"), total: 20 },
                { label: "Games",     keys: (k: string) => k.startsWith("game_"), total: 19 },
                { label: "Services",  keys: (k: string) => k.startsWith("Service"), total: 15 },
                { label: "Privacy",   keys: (k: string) => k.startsWith("Privacy"), total: 12 },
                { label: "Process",   keys: (k: string) => k.startsWith("Process"), total: 14 },
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
              {recommendedApplied ? "All Recommended Tweaks Are Enabled" : "Apply All Recommended Tweaks in One Click"}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {recommendedApplied
                ? "Click GET MY SCRIPT (top right) to download your personalized script. Restart your PC after running it."
                : `${hw.loading ? ALL_RECOMMENDED_TWEAKS.length : smartRecs.ids.size} hand-picked tweaks matched to your hardware — covers CPU priority, network, memory, power, and GPU. No uninstalls, no risks.`}
            </p>
          </div>

          <div className="relative z-10 shrink-0 flex flex-col items-center gap-2">
            {recommendedApplied ? (
              <div
                data-testid="badge-recommended-applied"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                {hw.loading ? ALL_RECOMMENDED_TWEAKS.length : smartRecs.ids.size} Tweaks Enabled
              </div>
            ) : (
              <Button
                data-testid="button-apply-all-recommended"
                onClick={applyAllRecommended}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold px-8 py-3 text-base rounded-xl border border-red-500/50 shadow-[0_0_24px_-4px_rgba(220,38,38,0.6)] transition-all hover:shadow-[0_0_32px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Apply All Recommended ({hw.loading ? ALL_RECOMMENDED_TWEAKS.length : smartRecs.ids.size})
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
            onClick={() => { const a = document.createElement('a'); a.href = '/api/scan/script'; a.download = 'OptiGods-ScanSystem.ps1'; a.click(); }}
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

        {/* FPS Estimate Panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
        >
          <FpsEstimate />
        </motion.div>

        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="p-6 rounded-2xl bg-black/40 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <FolderOpen className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Preset Management</h2>
            <span className="ml-auto text-xs text-zinc-600">{savedPresets.length} saved</span>
          </div>

          <div className="flex gap-3 mb-6">
            <AnimatePresence>
              {saving && (
                <motion.input
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  data-testid="input-preset-name"
                  type="text"
                  placeholder="Preset name (e.g. FiveM Night Session)..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && presetName.trim()) createPreset.mutate(presetName.trim()); }}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
                  autoFocus
                />
              )}
            </AnimatePresence>
            {saving ? (
              <div className="flex gap-2 shrink-0">
                <Button
                  data-testid="button-save-confirm"
                  size="sm"
                  disabled={!presetName.trim() || createPreset.isPending}
                  onClick={() => createPreset.mutate(presetName.trim())}
                  className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  data-testid="button-save-cancel"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setSaving(false); setPresetName(""); }}
                  className="text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-new-preset"
                onClick={() => setSaving(true)}
                variant="outline"
                size="sm"
                className="border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white gap-2"
              >
                <Plus className="w-3 h-3" />
                Save Current Config as Preset
              </Button>
            )}
          </div>

          {savedPresets.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
              No presets saved yet. Configure your tweaks across the tabs, then save here for quick reload.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {savedPresets.map((preset: any) => (
                <motion.div
                  key={preset.id}
                  data-testid={`card-preset-${preset.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-white text-sm truncate">{preset.name}</h3>
                    <button
                      data-testid={`button-delete-preset-${preset.id}`}
                      onClick={() => deletePreset.mutate(preset.id)}
                      className="text-zinc-700 hover:text-red-500 transition-colors ml-2 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 mb-3">
                    {Object.values(preset.config?.tweaks || {}).filter(Boolean).length} tweaks enabled
                  </p>
                  <Button
                    data-testid={`button-load-preset-${preset.id}`}
                    size="sm"
                    onClick={() => loadPreset(preset)}
                    className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 text-xs"
                  >
                    Load Preset
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
