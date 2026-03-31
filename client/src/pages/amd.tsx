import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { Cpu, Layers, Zap, Check, Info, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const ALL_AMD_IDS = [
  "AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency","AmdMaxClockState",
  "AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag","AmdTDRTweak",
  "AmdDisableTelemetry","AmdDisableCrashDefender","AmdDisableStartupApps",
  "AmdShaderCache","AmdImageSharpening","AmdDisableFreeSyncCompetitive",
  "AmdDisableVariBright","AmdDisableVSR","EnableHAGS",
  "AmdSmartAccessMemory","AmdAntiLagPlus","AmdFluidMotionFrames",
];

const AMD_RECOMMENDED_IDS = [
  "AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency","AmdMaxClockState",
  "AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag",
  "AmdDisableTelemetry","AmdDisableCrashDefender","AmdShaderCache","EnableHAGS",
  "AmdSmartAccessMemory","AmdAntiLagPlus",
];

type Impact = "HIGH" | "MED" | "LOW";

interface TweakDef {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
}

const PERFORMANCE_TWEAKS: TweakDef[] = [
  {
    id: "AmdDisableULPS",
    title: "Disable ULPS (Ultra Low Power State)",
    desc: "The #1 AMD tweak. Prevents GPU from downclocking between frames — eliminates the 1–3ms GPU clock-up delay that causes stutters.",
    badge: "CRITICAL",
    impact: "HIGH",
  },
  {
    id: "AmdDisableChill",
    title: "Disable Radeon Chill",
    desc: "Radeon Chill throttles FPS when your mouse isn't moving. Disabling it ensures your GPU always renders at maximum rate.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "AmdDisablePowerEfficiency",
    title: "Disable Power Efficiency Mode",
    desc: "Sets PP_PowerProfile=2 (Performance) in the AMD GPU driver registry — removes the driver's tendency to drop clocks for efficiency.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "AmdMaxClockState",
    title: "Force Highest DPM Performance Table",
    desc: "Sets PP_DpmForceHighestDpmTable=1 — locks the GPU to its highest DPM (Dynamic Power Management) performance state, removing boost delay.",
    impact: "HIGH",
  },
  {
    id: "AmdForcePerformancePowerPlan",
    title: "Disable GPU Power Gating",
    desc: "Disables DisableDrmdmaPowerGating, DisableGmcPowerGating, and DisablePowerGating — prevents the GPU from sleeping power domains between frames.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "AmdOptimizeLatency",
    title: "Optimize Latency Stack (HAGS + Scheduler)",
    desc: "Enables HAGS + sets Games system profile to High scheduling, GPU Priority=8, MaximumPreRenderedFrames=1 — complete low-latency GPU pipeline.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "AmdAntiLag",
    title: "Enable AMD Anti-Lag",
    desc: "Enables Anti-Lag via the Radeon Software registry — reduces render queue depth for lower click-to-pixel latency. RX 5000+ series.",
    badge: "RX 5000+",
    impact: "HIGH",
  },
  {
    id: "AmdTDRTweak",
    title: "Increase TDR Timeout (Crash Prevention)",
    desc: "Sets TdrLevel=3 and TdrDelay=60s — prevents false 'GPU not responding' resets during heavy load spikes in demanding games.",
    impact: "MED",
  },
];

const DRIVER_TWEAKS: TweakDef[] = [
  {
    id: "AmdDisableTelemetry",
    title: "Disable AMD Telemetry Services",
    desc: "Stops AMD External Events Utility, amdfendrsr, AmdCVSDiagService, and disables AMD's scheduled crash reporting tasks.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "AmdDisableCrashDefender",
    title: "Disable AMD Crash Defender",
    desc: "Kills AmdCVSDiagService and AMDRSServ — the Crash Defender background monitor causes CPU spikes during game load screens.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
  {
    id: "AmdDisableStartupApps",
    title: "Remove Radeon Software from Startup",
    desc: "Removes RadeonSoftware from autostart — saves ~350MB RAM and 2s boot time. Relaunch manually for driver updates.",
    impact: "MED",
  },
  {
    id: "AmdShaderCache",
    title: "Enable AMD Shader Pre-Caching",
    desc: "Forces KMD_EnableShaderCache=1 in the AMD driver and enables DirectX shader cache — eliminates the initial stutter when loading new game areas.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
];

const VISUAL_TWEAKS: TweakDef[] = [
  {
    id: "AmdImageSharpening",
    title: "Enable Radeon Image Sharpening (RIS)",
    desc: "Turns on Image Sharpening at 80% strength — sharpens game visuals on compressed/upscaled frames with near-zero GPU cost. Works in all games.",
    impact: "LOW",
  },
  {
    id: "AmdDisableFreeSyncCompetitive",
    title: "Disable FreeSync for Competitive Play",
    desc: "Disables VRR/FreeSync via DalFreeSyncActive=0 — at high FPS (144+) FreeSync adds overhead. Disable it for consistent frame pacing.",
    impact: "MED",
  },
  {
    id: "AmdDisableVariBright",
    title: "Disable Vari-Bright",
    desc: "Prevents Radeon's auto-brightness feature from adjusting display brightness mid-game — eliminates the distracting brightness flicker.",
    impact: "LOW",
  },
  {
    id: "AmdDisableVSR",
    title: "Disable Virtual Super Resolution",
    desc: "Removes VSR upscaling from the driver pipeline — reduces driver overhead when you're already running native resolution.",
    impact: "LOW",
  },
  {
    id: "EnableHAGS",
    title: "Enable HAGS (Hardware Accelerated GPU Scheduling)",
    desc: "Offloads VRAM scheduling to dedicated hardware on the GPU — reduces frame-time variance. Required for AMD's AFMF/FSR3 Frame Generation.",
    badge: "RX 6000+",
    impact: "HIGH",
  },
];

const NEXTGEN_TWEAKS: TweakDef[] = [
  {
    id: "AmdSmartAccessMemory",
    title: "Enable Smart Access Memory (Resizable BAR)",
    desc: "Sets KMD_EnableResizableBar=1 and KMD_EnableSmartAccessMemory=1 in the AMD driver registry — allows CPU to access the full VRAM directly. Requires Resizable BAR enabled in BIOS. Improves DX12/Vulkan performance by 5–15%.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "AmdAntiLagPlus",
    title: "Enable Anti-Lag+ (RX 7000 Series)",
    desc: "Enables Anti-Lag and Anti-Lag+ via HKCU\\SOFTWARE\\AMD\\CN — Anti-Lag works on RX 5000+, Anti-Lag+ requires RX 7000 series and driver 23.11.1+. Reduces click-to-pixel latency by up to 50% in supported games.",
    badge: "RX 7000+",
    impact: "HIGH",
  },
  {
    id: "AmdFluidMotionFrames",
    title: "AMD Fluid Motion Frames (AFMF) Hint",
    desc: "Sets KMD_EnableFrameGeneration=1 in the AMD KMD driver registry — enables the driver-level frame generation hint. Requires RX 7000 series, driver 23.11.1+, and activation in Radeon Software Global Graphics.",
    badge: "RX 7000+",
    impact: "MED",
  },
];

const AMD_PRESETS = [
  {
    id: "competitive",
    title: "Competitive FPS",
    desc: "All latency + driver tweaks. Zero visual overhead. Built for CS2, Valorant, R6, and Apex on AMD.",
    features: ["ULPS Disabled", "Anti-Lag On", "Max DPM Clock State", "No FreeSync", "No Chill"],
    tweaks: ["AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency","AmdMaxClockState","AmdForcePerformancePowerPlan","AmdOptimizeLatency","AmdAntiLag","AmdDisableTelemetry","AmdDisableCrashDefender","AmdDisableFreeSyncCompetitive","AmdShaderCache","EnableHAGS"],
  },
  {
    id: "balanced",
    title: "Balanced Gaming",
    desc: "Best all-around profile. Max performance gains without disabling helpful features like FreeSync.",
    features: ["ULPS Disabled", "Anti-Lag On", "HAGS On", "Shader Cache", "Telemetry Off"],
    tweaks: ["AmdDisableULPS","AmdDisableChill","AmdDisablePowerEfficiency","AmdOptimizeLatency","AmdAntiLag","AmdDisableTelemetry","AmdDisableCrashDefender","AmdShaderCache","EnableHAGS"],
  },
  {
    id: "safe",
    title: "Safe Boost",
    desc: "Conservative picks only — no driver-level power state changes. Safe for stock AMD systems.",
    features: ["ULPS Disabled", "Telemetry Off", "Shader Cache", "HAGS On", "Chill Disabled"],
    tweaks: ["AmdDisableULPS","AmdDisableChill","AmdDisableTelemetry","AmdShaderCache","EnableHAGS"],
  },
];

export default function Amd() {
  const { tweaks, setTweak, setAllTweaks } = useOptimizationStore();
  const { toast } = useToast();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);

  const amdSmartIds = ALL_AMD_IDS.filter(id => smartRecs.ids.has(id));

  const applyPreset = (preset: typeof AMD_PRESETS[number]) => {
    const next = { ...tweaks };
    preset.tweaks.forEach((k) => { if (k in next) next[k] = true; });
    setAllTweaks(next);
    toast({
      title: `${preset.title} Applied`,
      description: `${preset.tweaks.length} AMD tweaks enabled — download your script to apply.`,
    });
  };

  const enableAllRecommended = () => {
    amdSmartIds.forEach((k) => setTweak(k, true));
    toast({ title: "AMD Recommended Applied", description: `${amdSmartIds.length} key tweaks enabled for your system.` });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-zinc-900 border border-white/5">
              <Cpu className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">AMD Optimizer</h1>
              <p className="text-zinc-500 text-sm">Real AMD driver registry tweaks for FPS, latency, and stability</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={enableAllRecommended}
            data-testid="button-enable-all-amd"
            className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-xs font-bold uppercase tracking-wide"
          >
            Enable All Recommended
          </Button>
        </motion.div>

        {/* GPU compatibility banner */}
        {!hw.loading && (
          hw.isAMD ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/20 bg-green-500/5"
            >
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-xs text-zinc-300">
                <span className="text-green-400 font-semibold">AMD GPU detected</span>
                {hw.gpuName !== "Unknown GPU" && <span className="text-zinc-500"> — {hw.gpuName}</span>}
                . All tweaks on this page apply to your system.
              </p>
            </motion.div>
          ) : hw.isNvidia ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-xl overflow-hidden border-2 border-red-500/50 bg-gradient-to-r from-red-950/40 via-zinc-950 to-zinc-900/40"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600" />
              <div className="p-5 flex gap-4 items-start">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-red-400 mb-1">WRONG TAB — NVIDIA GPU Detected</p>
                  <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                    <span className="text-white font-semibold">{hw.gpuName !== "Unknown GPU" ? hw.gpuName : "Your GPU"}</span> is NVIDIA. The tweaks on this page write to AMD Radeon driver registry keys — <span className="text-red-400 font-semibold">they will have zero effect on your system</span> and waste your time.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href="/nvidia" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-all">
                      → Go to NVIDIA Optimizer
                    </a>
                    <span className="inline-flex items-center px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs">This page = AMD only</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : hw.isIntel ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-xl overflow-hidden border-2 border-zinc-600/50 bg-gradient-to-r from-zinc-900/60 via-zinc-950 to-zinc-900/40"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-600" />
              <div className="p-5 flex gap-4 items-start">
                <div className="shrink-0 w-14 h-14 rounded-xl bg-zinc-700/30 border border-zinc-600/30 flex items-center justify-center">
                  <ShieldAlert className="w-7 h-7 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-zinc-300 mb-1">WRONG TAB — Intel GPU Detected</p>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                    <span className="text-white font-semibold">{hw.gpuName !== "Unknown GPU" ? hw.gpuName : "Your GPU"}</span> is Intel. AMD driver tweaks will not apply to Intel integrated graphics. Use the <span className="text-white font-semibold">Integrated GPU</span> tab which has Intel-specific optimizations.
                  </p>
                  <a href="/integrated-graphics" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-sm transition-all">
                    → Go to Integrated GPU Tab
                  </a>
                </div>
              </div>
            </motion.div>
          ) : null
        )}

        <PageGuide pageName="AMD Optimizer" />

        <TabSmartBar
          tweakIds={ALL_AMD_IDS}
          recommendedIds={AMD_RECOMMENDED_IDS}
          label="AMD"
          context="These tweaks target AMD Radeon driver registry keys under {4d36e968-e325-11ce-bfc1-08002be10318} — the GPU device class. They apply to RX 400 series and newer. HAGS requires RX 6000+. All changes are reversible via Device Manager > Rollback or by re-running the script with restore values."
          tips={[
            "ULPS Disable is the single most impactful AMD tweak — do this first.",
            "Chill + Power Efficiency off eliminates the two biggest sources of AMD frame-rate inconsistency.",
            "Anti-Lag works best on RX 5000+ at 1080p/1440p — pairs well with HAGS on RX 6000+.",
          ]}
        />

        {/* AMD-specific badge note */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            <span className="text-amber-400 font-semibold">AMD GPU Required.</span> These tweaks target the Radeon driver class registry path and will have no effect on NVIDIA or Intel hardware. NVIDIA users should use the{" "}
            <span className="text-white font-medium">NVIDIA Presets</span> tab instead.
          </p>
        </div>

        {/* Presets */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Zap className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Quick Presets</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AMD_PRESETS.map((preset, index) => {
              const allOn = preset.tweaks.every((k) => tweaks[k]);
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => applyPreset(preset)}
                  data-testid={`card-amd-preset-${preset.id}`}
                  className={cn(
                    "relative p-5 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col",
                    allOn
                      ? "bg-red-500/10 border-red-500 shadow-[0_0_20px_-6px_rgba(239,68,68,0.35)]"
                      : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60"
                  )}
                >
                  {allOn && (
                    <div className="absolute top-4 right-4 text-red-500">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <h3 className={cn("text-lg font-bold font-display mb-2", allOn ? "text-white" : "text-zinc-300")}>
                    {preset.title}
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4 leading-relaxed flex-grow">{preset.desc}</p>
                  <ul className="space-y-1.5 pt-3 border-t border-white/5">
                    {preset.features.map((f) => (
                      <li key={f} className="text-[11px] text-zinc-400 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-red-500/60 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Performance Tweaks */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Cpu className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Performance & Latency</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const recIds = PERFORMANCE_TWEAKS.filter(t => t.badge === "RECOMMENDED" || t.badge === "CRITICAL").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return (
                <Button variant="ghost" size="sm" onClick={() => recIds.forEach(id => setTweak(id, true))} disabled={allOn}
                  data-testid="button-enable-recommended-amd-performance"
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                </Button>
              );
            })()}
          </div>
          <div className="space-y-3">
            {PERFORMANCE_TWEAKS.map((item, i) => (
              <TweakRow
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.desc}
                badge={item.badge}
                impact={item.impact}
                checked={tweaks[item.id] || false}
                onCheckedChange={(v) => setTweak(item.id, v)}
                delay={i + 1}
              />
            ))}
          </div>
        </section>

        {/* Driver & Background */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Layers className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Driver & Background Services</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const recIds = DRIVER_TWEAKS.filter(t => t.badge === "RECOMMENDED").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return (
                <Button variant="ghost" size="sm" onClick={() => recIds.forEach(id => setTweak(id, true))} disabled={allOn}
                  data-testid="button-enable-recommended-amd-driver"
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                </Button>
              );
            })()}
          </div>
          <div className="space-y-3">
            {DRIVER_TWEAKS.map((item, i) => (
              <TweakRow
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.desc}
                badge={item.badge}
                impact={item.impact}
                checked={tweaks[item.id] || false}
                onCheckedChange={(v) => setTweak(item.id, v)}
                delay={i + 1}
              />
            ))}
          </div>
        </section>

        {/* Visual & Display */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Zap className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Visual & Display</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
          </div>
          <div className="space-y-3">
            {VISUAL_TWEAKS.map((item, i) => (
              <TweakRow
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.desc}
                badge={item.badge}
                impact={item.impact}
                checked={tweaks[item.id] || false}
                onCheckedChange={(v) => setTweak(item.id, v)}
                delay={i + 1}
              />
            ))}
          </div>
        </section>

        {/* Next-Gen Features */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Zap className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Next-Gen AMD Features</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider mr-2">RDNA 3 / RX 7000</span>
            {(() => {
              const recIds = NEXTGEN_TWEAKS.filter(t => t.badge === "RECOMMENDED").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return recIds.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => recIds.forEach(id => setTweak(id, true))} disabled={allOn}
                  data-testid="button-enable-recommended-amd-nextgen"
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                </Button>
              ) : null;
            })()}
          </div>
          <p className="text-xs text-zinc-600 px-1 mb-4">Driver-level registry hints for Smart Access Memory, Anti-Lag+, and Fluid Motion Frames. Requires compatible hardware and driver version.</p>
          <div className="space-y-3">
            {NEXTGEN_TWEAKS.map((item, i) => (
              <TweakRow
                key={item.id}
                id={item.id}
                title={item.title}
                description={item.desc}
                badge={item.badge}
                impact={item.impact}
                checked={tweaks[item.id] || false}
                onCheckedChange={(v) => setTweak(item.id, v)}
                delay={i + 1}
              />
            ))}
          </div>
        </section>

        {/* Info panel */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-white font-semibold">NVIDIA GPU?</span> The HAGS toggle above works for both brands (RTX 2000+ and RX 6000+). All other tweaks on this page are AMD-specific registry keys under the GPU device class — they will silently skip on non-AMD hardware.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
