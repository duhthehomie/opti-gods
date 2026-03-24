import { useState } from "react";
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
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { cn } from "@/lib/utils";
import { useProStatus } from "@/lib/pro-status";
import { ProUnlockButton } from "@/components/pro-gate";
import { ScanImport } from "@/components/scan-import";
import { FpsEstimate } from "@/components/fps-estimate";

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
    desc: "Open any tab in the sidebar (Registry, FiveM, Fortnite, etc.) and flip the toggles for every optimization you want. Red = will be applied.",
  },
  {
    icon: Download,
    title: "Download Your Script",
    desc: "Click DOWNLOAD .PS1 in the top bar. This generates a personalized PowerShell script containing only the tweaks you enabled — nothing else.",
  },
  {
    icon: ShieldAlert,
    title: "Run as Administrator",
    desc: "Open your Downloads folder, right-click OptiGods-by-leaq.ps1, and choose Run with PowerShell. Click Yes on the Administrator prompt.",
  },
  {
    icon: RotateCcw,
    title: "Restart & Done",
    desc: "After the script finishes, restart your PC. All changes take effect on the next boot. Create a Windows Restore Point first as a precaution.",
  },
];

// Pro pricing bullet points
const PRO_BULLETS = [
  "220+ registry, network, memory, and GPU tweaks",
  "FiveM, Fortnite, CS2, Valorant, and Apex packs",
  "Download your personalized .PS1 script",
  "Game auto-detection for 14 titles",
  "Preset save/load for quick re-apply",
  "Lifetime access — pay once, no subscription",
];

export default function Dashboard() {
  const osInfo = useOsDetection();
  const hw = useHardwareInfo();
  const isPro = useProStatus();
  const { tweaks, nvidiaPreset, setAllTweaks } = useOptimizationStore();
  const { data: savedPresets = [] } = useQuery<any[]>({
    queryKey: [api.presets.list.path],
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);

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
    ALL_RECOMMENDED_TWEAKS.forEach((key) => {
      if (key in next) { next[key] = true; applied++; }
    });
    setAllTweaks(next);
    setRecommendedApplied(true);
    toast({
      title: "All Recommended Tweaks Applied!",
      description: `${applied} tweaks enabled. Now click DOWNLOAD .PS1 in the top bar to get your script.`,
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
              {osInfo.loading ? "DETECTING SYSTEM..." : `SYSTEM DETECTED — ${osInfo.displayName}`}
            </div>

            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-3 leading-none tracking-tight">
              OPTI GODS <span className="text-red-500">by leaq</span>
            </h1>
            <p className="text-base md:text-lg text-zinc-400 mb-8 leading-relaxed font-medium">
              220+ tweaks. One script. Zero compromise.
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
                    Unlock Pro — $25 Lifetime
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


        {/* ─── HOW IT WORKS — 3-STEP STRIP (moved to top) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
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
                ? "Click DOWNLOAD .PS1 in the top bar to get your personalized script. Restart your PC after running it."
                : `${ALL_RECOMMENDED_TWEAKS.length} hand-picked tweaks — safe for every PC. Covers CPU priority, network, memory, power, FiveM, and more. No uninstalls, no risks.`}
            </p>
          </div>

          <div className="relative z-10 shrink-0 flex flex-col items-center gap-2">
            {recommendedApplied ? (
              <div
                data-testid="badge-recommended-applied"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                {ALL_RECOMMENDED_TWEAKS.length} Tweaks Enabled
              </div>
            ) : (
              <Button
                data-testid="button-apply-all-recommended"
                onClick={applyAllRecommended}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold px-8 py-3 text-base rounded-xl border border-red-500/50 shadow-[0_0_24px_-4px_rgba(220,38,38,0.6)] transition-all hover:shadow-[0_0_32px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Apply All Recommended ({ALL_RECOMMENDED_TWEAKS.length})
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
                    <div className="inline-block text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-sm mb-3">
                      One-Time Lifetime Access
                    </div>
                    <h2 className="text-3xl font-display font-bold text-white leading-none">$25</h2>
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
                    Unlock Pro — $25
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
