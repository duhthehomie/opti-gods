import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { useToast } from "@/hooks/use-toast";
import {
  MemoryStick, AlertTriangle, CheckCircle2, Cpu,
  Zap, ChevronRight, Info, Lock, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageGuide } from "@/components/page-guide";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

type Impact = "HIGH" | "MED" | "LOW";

interface Tweak {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  recommended?: boolean;
  minRamGB?: number;
  maxRamGB?: number;
  warnBelow?: number;
}

const RAM_OPTIONS = [4, 8, 16, 32, 64] as const;
type RamGB = typeof RAM_OPTIONS[number];

interface RamProfile {
  label: string;
  color: string;
  desc: string;
  recommendations: string[];
  applyTweaks: Record<string, boolean>;
}

function getRamProfile(ram: number): RamProfile {
  if (ram <= 4) return {
    label: "Low RAM Mode",
    color: "text-amber-400",
    desc: "4GB — Conservative profile. Pagefile is essential; keep memory compression and Superfetch enabled.",
    recommendations: [
      "Keep pagefile enabled (mandatory)",
      "Keep Superfetch/SysMain ON — helps your slow-memory system",
      "Disable kernel paging (safe at any RAM level)",
      "Keep memory compression ON — frees more effective RAM",
    ],
    applyTweaks: {
      MemFixedPagefile: true,
      MemClearPagefileShutdown: false,
      MemDisablePagefile: false,
      MemDisableCompression: false,
      MemDisableSuperfetch: false,
      MemDisableKernelPaging: true,
      MemTrimStandbyList: false,
      MemSystemCacheBoost: true,
      MemTrimOnMinimize: true,
      MemSetWorkingSetSize: true,
      MemGPUOptimize: true,
      MemGPUSchedulerTweak: true,
    },
  };

  if (ram <= 8) return {
    label: "Budget Profile",
    color: "text-amber-400",
    desc: "8GB — Moderate profile. Pagefile still important; light optimizations only.",
    recommendations: [
      "Keep pagefile enabled, set it to a fixed size",
      "Keep Superfetch/SysMain ON (helps reduce cold-start times)",
      "Trim working set on minimize (frees RAM for active game)",
      "Keep memory compression ON — beneficial under 16GB",
    ],
    applyTweaks: {
      MemFixedPagefile: true,
      MemMovePagefileFast: true,
      MemClearPagefileShutdown: true,
      MemDisablePagefile: false,
      MemDisableCompression: false,
      MemDisableSuperfetch: false,
      MemDisableKernelPaging: true,
      MemTrimStandbyList: true,
      MemSystemCacheBoost: true,
      MemTrimOnMinimize: true,
      MemSetWorkingSetSize: true,
      MemGPUOptimize: true,
      MemGPUSchedulerTweak: true,
    },
  };

  if (ram <= 16) return {
    label: "Standard Gaming Profile",
    color: "text-green-400",
    desc: "16GB — Optimal for most games. Disable compression, fixed pagefile, disable Superfetch.",
    recommendations: [
      "Disable memory compression — CPU overhead no longer justified",
      "Set fixed pagefile (prevents mid-game resizing stutter)",
      "Disable Superfetch — NVMe/SSD loads are already instant",
      "Keep kernel in RAM at all times",
      "Aggressive standby list trimming for max free RAM",
    ],
    applyTweaks: {
      MemFixedPagefile: true,
      MemMovePagefileFast: true,
      MemClearPagefileShutdown: true,
      MemDisablePagefile: false,
      MemDisableCompression: true,
      MemDisableSuperfetch: true,
      MemDisableKernelPaging: true,
      MemTrimStandbyList: true,
      MemSystemCacheBoost: true,
      MemTrimOnMinimize: true,
      MemLargePageSupport: true,
      MemSetWorkingSetSize: true,
      MemGPUOptimize: true,
      MemGPUSchedulerTweak: true,
    },
  };

  if (ram <= 32) return {
    label: "High-RAM Gaming Profile",
    color: "text-red-400",
    desc: "32GB — Aggressive profile. Fixed small pagefile kept for driver/crash-dump stability. Disable all compression.",
    recommendations: [
      "Keep a small fixed pagefile (drivers + crash dumps still need it — disabling causes boot errors)",
      "Disable all memory compression (zero CPU overhead for paging)",
      "Disable Superfetch entirely",
      "Force all frequently-used data to stay in RAM",
      "Enable large page support for DX12/Vulkan titles",
    ],
    applyTweaks: {
      MemFixedPagefile: true,
      MemMovePagefileFast: false,
      MemClearPagefileShutdown: false,
      MemDisablePagefile: false,
      MemDisableCompression: true,
      MemDisableSuperfetch: true,
      MemDisableKernelPaging: true,
      MemTrimStandbyList: true,
      MemSystemCacheBoost: false,
      MemTrimOnMinimize: true,
      MemLargePageSupport: true,
      MemSetWorkingSetSize: true,
      MemDisableHeapTermination: true,
      MemGPUOptimize: true,
      MemDisableGPUPagefile: true,
      MemGPUSchedulerTweak: true,
    },
  };

  return {
    label: "Enthusiast Profile",
    color: "text-red-400",
    desc: "64GB+ — Maximum aggression. Tiny fixed pagefile kept for driver stability. Squeeze every last frame.",
    recommendations: [
      "Keep a minimal fixed pagefile (Windows kernel still requires it for crash dumps)",
      "Disable all compression and caching overhead",
      "Pre-allocate max working set sizes for all processes",
      "Force GPU to use dedicated VRAM only",
      "Enable all large page and DMA optimizations",
    ],
    applyTweaks: {
      MemFixedPagefile: true,
      MemMovePagefileFast: false,
      MemClearPagefileShutdown: false,
      MemDisablePagefile: false,
      MemDisableCompression: true,
      MemDisableSuperfetch: true,
      MemDisableKernelPaging: true,
      MemTrimStandbyList: true,
      MemSystemCacheBoost: false,
      MemTrimOnMinimize: false,
      MemLargePageSupport: true,
      MemSetWorkingSetSize: true,
      MemDisableHeapTermination: true,
      MemGPUOptimize: true,
      MemDisableGPUPagefile: true,
      MemGPUSchedulerTweak: true,
    },
  };
}

const PAGEFILE_TWEAKS: Tweak[] = [
  {
    id: "MemFixedPagefile",
    title: "Set Fixed Pagefile Size (25%–100% RAM)",
    desc: "Sets a stable min/max pagefile size (25%–100% of your RAM) — prevents Windows from dynamically resizing it mid-game which causes disk stutter. Boots reliably every time.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "MemMovePagefileFast",
    title: "Move Pagefile to Fastest Drive",
    desc: "Detects your fastest drive (NVMe/SSD) and moves the pagefile there — so swap reads are as fast as possible if they occur.",
    impact: "MED",
  },
  {
    id: "MemDisablePagefile",
    title: "Disable Pagefile Completely",
    desc: "Fully disables the pagefile. WARNING: Even at 32GB+ some drivers and crash dumps require a pagefile — disabling can cause a temporary paging file error on next boot and brief black screen. Use Fixed Pagefile instead.",
    badge: "DANGER",
    impact: "HIGH",
    minRamGB: 32,
  },
  {
    id: "MemClearPagefileShutdown",
    title: "Clear Pagefile on Shutdown",
    desc: "Wipes the pagefile when Windows shuts down — prevents stale data and marginal privacy benefit.",
    impact: "LOW",
  },
];

const COMPRESSION_TWEAKS: Tweak[] = [
  {
    id: "MemDisableCompression",
    title: "Disable Memory Compression",
    desc: "Stops Windows from compressing memory pages in RAM. Recommended for 16GB+ — removes CPU overhead from compression.",
    badge: "16GB+ RAM",
    impact: "HIGH",
    warnBelow: 16,
  },
  {
    id: "MemDisableSuperfetch",
    title: "Disable Superfetch / SysMain",
    desc: "Stops Windows pre-loading apps into RAM. Beneficial on SSD/NVMe where cold loads are already fast.",
    impact: "MED",
    warnBelow: 8,
  },
  {
    id: "MemTrimStandbyList",
    title: "Aggressive Standby List Trimming",
    desc: "Forces Windows to release standby (cached) memory more aggressively to keep more RAM free for games.",
    impact: "MED",
  },
  {
    id: "MemDisableKernelPaging",
    title: "Keep Kernel in RAM (Disable Paging)",
    desc: "Forces the Windows kernel to always stay in RAM, never get paged to disk — reduces latency spikes.",
    impact: "HIGH",
  },
  {
    id: "MemSystemCacheBoost",
    title: "Optimize System File Cache",
    desc: "Adjusts the ratio between system file cache and application RAM usage in favor of running apps.",
    impact: "LOW",
  },
];

const WORKINGSET_TWEAKS: Tweak[] = [
  {
    id: "MemTrimOnMinimize",
    title: "Trim Working Set on Window Minimize",
    desc: "Reduces the private RAM footprint of any app the moment it is minimized — frees memory for the active game.",
    impact: "MED",
  },
  {
    id: "MemLargePageSupport",
    title: "Enable Large Page Support",
    desc: "Enables 2MB page granularity for apps that request it (DX12/Vulkan games) — reduces TLB misses on high-VRAM workloads.",
    impact: "MED",
  },
  {
    id: "MemSetWorkingSetSize",
    title: "Increase Max Working Set Size",
    desc: "Raises the per-process working set ceiling — prevents Windows from unnecessarily trimming game memory mid-session.",
    impact: "MED",
  },
  {
    id: "MemDisableHeapTermination",
    title: "Disable Heap Termination on Corruption",
    desc: "Prevents minor heap issues from instantly crashing a game process — allows more graceful recovery.",
    impact: "LOW",
  },
];

const VRAM_TWEAKS: Tweak[] = [
  {
    id: "MemGPUOptimize",
    title: "Optimize GPU Virtual Address Space",
    desc: "Increases GPU virtual address space allocation — reduces VRAM fragmentation in DX12/Vulkan titles.",
    impact: "MED",
  },
  {
    id: "MemDisableGPUPagefile",
    title: "Disable GPU Paging to System RAM",
    desc: "Prevents Windows from offloading VRAM overflow to system RAM via the GPU pagefile when possible.",
    impact: "MED",
  },
  {
    id: "MemGPUSchedulerTweak",
    title: "GPU Memory Scheduler: Low Latency",
    desc: "Sets the GPU memory scheduler to prefer lower latency over higher throughput — reduces frame time spikes.",
    impact: "HIGH",
  },
];

export default function Memory() {
  const { tweaks, setTweak, setAllTweaks, systemRamGB, setSystemRamGB } = useOptimizationStore();
  const hw = useHardwareInfo();
  const osInfo = useOsDetection();
  const smartRecs = computeSmartRecs(hw, osInfo);
  const { toast } = useToast();

  const [detectedRam, setDetectedRam] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const [applyLog, setApplyLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    // navigator.deviceMemory is capped at 8 and bucketed (1/2/4/8) for browser privacy.
    // It CANNOT reliably detect 16/32/64 GB — we display it as a lower bound only
    // and do NOT auto-select a RAM profile because the value is almost always wrong.
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (nav.deviceMemory) {
      setDetectedRam(nav.deviceMemory);
    }
  }, []);

  const ram = systemRamGB;
  const profile = ram ? getRamProfile(ram) : null;

  function handleApplyProfile() {
    if (!profile || !ram) return;
    const before = { ...tweaks };
    const newTweaks = { ...tweaks, ...profile.applyTweaks };
    setAllTweaks(newTweaks);

    const log: string[] = [];
    for (const [key, val] of Object.entries(profile.applyTweaks)) {
      if (before[key] !== val) {
        log.push(`${val ? "✓ Enabled" : "✗ Disabled"} ${key.replace(/^Mem/, "")}`);
      }
    }
    setApplyLog(log);
    setApplied(true);
    setShowLog(true);
    toast({
      title: `${profile.label} applied`,
      description: `${log.length} tweak${log.length !== 1 ? "s" : ""} changed for ${ram}GB RAM`,
    });
  }

  function isTweakLocked(tweak: Tweak): { locked: boolean; reason: string } {
    if (!ram) return { locked: false, reason: "" };
    if (tweak.minRamGB && ram < tweak.minRamGB) {
      return { locked: true, reason: `Requires ${tweak.minRamGB}GB+ RAM (you have ${ram}GB)` };
    }
    if (tweak.warnBelow && ram < tweak.warnBelow) {
      return { locked: false, reason: `Not recommended below ${tweak.warnBelow}GB RAM` };
    }
    return { locked: false, reason: "" };
  }

  function getActiveCount(items: Tweak[]) {
    return items.filter(t => tweaks[t.id]).length;
  }

  function renderSection(heading: string, items: Tweak[]) {
    const active = getActiveCount(items);
    const recommended = items.filter(t => t.recommended && !isTweakLocked(t).locked).map(t => t.id);
    const allRecommendedOn = recommended.length > 0 && recommended.every(id => tweaks[id]);
    return (
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">{heading}</h2>
            {active > 0 && (
              <span className="text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded">
                {active}/{items.length} active
              </span>
            )}
          </div>
          {recommended.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recommended.forEach(id => setTweak(id, true))}
              disabled={allRecommendedOn}
              data-testid={`button-enable-recommended-${heading.replace(/\s+/g, '-').toLowerCase()}`}
              className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {allRecommendedOn ? "Recommended ON" : `Enable Recommended (${recommended.length})`}
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {items.map((item, i) => {
            const { locked, reason } = isTweakLocked(item);
            return (
              <div key={item.id} className={cn(locked && "opacity-40 pointer-events-none")}>
                {reason && !locked && ram && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] text-amber-500">{reason}</span>
                  </div>
                )}
                {locked && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <Lock className="w-3 h-3 text-zinc-600" />
                    <span className="text-[10px] text-zinc-600">{reason}</span>
                  </div>
                )}
                <TweakRow
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  badge={item.badge}
                  impact={item.impact}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={(v) => !locked && setTweak(item.id, v)}
                  delay={i + 1}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <MemoryStick className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Memory Optimizer</h1>
            <p className="text-zinc-500 text-sm">Intelligent pagefile, compression, and RAM profile tuning</p>
          </div>
        </motion.div>

        <PageGuide pageName="Memory Optimizer" />

        {/* Hardware-optimized settings */}
        {!hw.loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 flex items-start gap-3"
          >
            <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed space-y-1">
              <p className="text-red-400 font-semibold">Hardware-Optimized Memory Settings</p>
              <p className="text-zinc-300">
                {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
              </p>
            </div>
          </motion.div>
        )}

        {/* RAM Detection Panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <Cpu className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">RAM Detection</span>
            {detectedRam && (
              <span className="ml-auto text-[10px] text-zinc-500 font-mono">
                Browser API reports ≥{detectedRam}GB (privacy limited — select your actual RAM below)
              </span>
            )}
          </div>

          <div className="p-4 space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Select your installed RAM below. Opti Gods will automatically recommend the right set of tweaks and lock out settings that could cause instability at your memory level.
            </p>

            {/* RAM picker */}
            <div className="flex flex-wrap gap-2">
              {RAM_OPTIONS.map(gb => (
                <button
                  key={gb}
                  data-testid={`button-ram-${gb}`}
                  onClick={() => { setSystemRamGB(gb); setApplied(false); setShowLog(false); }}
                  className={cn(
                    "px-4 py-2.5 rounded-lg text-sm font-bold transition-all border",
                    ram === gb
                      ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-zinc-600 hover:text-white"
                  )}
                >
                  {gb}GB
                </button>
              ))}
            </div>

            {/* Profile display */}
            {profile && ram && (
              <motion.div
                key={ram}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-black/40 border border-white/5 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-red-500" />
                      <span className={cn("text-sm font-bold", profile.color)}>{profile.label}</span>
                    </div>
                    <p className="text-xs text-zinc-500">{profile.desc}</p>
                  </div>
                  <Button
                    data-testid="button-apply-ram-profile"
                    onClick={handleApplyProfile}
                    className="shrink-0 bg-red-600 hover:bg-red-700 text-white border border-red-500/30 text-xs font-bold gap-1.5"
                    size="sm"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Apply for {ram}GB
                  </Button>
                </div>

                {/* What will be applied */}
                <div className="space-y-1.5">
                  {profile.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-zinc-400">{r}</span>
                    </div>
                  ))}
                </div>

                {/* Apply log */}
                <AnimatePresence>
                  {applied && showLog && applyLog.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-3 border-t border-white/5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[11px] font-bold text-green-400 uppercase tracking-wide">
                          {applyLog.length} changes applied
                        </span>
                        <button
                          onClick={() => setShowLog(false)}
                          className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400"
                        >
                          dismiss
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {applyLog.map((entry, i) => (
                          <span key={i} className={cn(
                            "text-[10px] font-mono",
                            entry.startsWith("✓") ? "text-green-500" : "text-zinc-500"
                          )}>
                            {entry}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {applied && applyLog.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 pt-2 border-t border-white/5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[11px] text-green-400">Already optimized for {ram}GB — no changes needed.</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {!ram && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <Info className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-500/80">Select your RAM above to unlock smart recommendations.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Warning banner for low-RAM users */}
        {ram && ram <= 8 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-400/90">
              With <strong>{ram}GB RAM</strong>, some aggressive tweaks like disabling compression or the pagefile are locked to protect your system from crashes. Apply the {ram}GB profile above for the safest boost.
            </p>
          </motion.div>
        )}

        {/* Active tweak summary */}
        {ram && (() => {
          const allTweaks = [...PAGEFILE_TWEAKS, ...COMPRESSION_TWEAKS, ...WORKINGSET_TWEAKS, ...VRAM_TWEAKS];
          const activeCount = allTweaks.filter(t => tweaks[t.id]).length;
          if (activeCount === 0) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15"
            >
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">
                <strong>{activeCount}</strong> memory tweak{activeCount !== 1 ? "s" : ""} active —
                these will be included in your PowerShell optimization script.
              </p>
            </motion.div>
          );
        })()}

        {/* Tweak sections */}
        <div className="space-y-8">
          {renderSection("Pagefile & Virtual Memory", PAGEFILE_TWEAKS)}
          {renderSection("RAM Compression & Caching", COMPRESSION_TWEAKS)}
          {renderSection("Working Set & Process Memory", WORKINGSET_TWEAKS)}
          {renderSection("VRAM & GPU Memory", VRAM_TWEAKS)}
        </div>
      </div>
    </AppLayout>
  );
}
