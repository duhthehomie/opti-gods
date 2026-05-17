import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Cpu, MemoryStick, HardDrive, ChevronDown, ChevronUp, Zap, AlertCircle, CheckCircle2, ScanLine, Layers } from "lucide-react";
import type { GpuEntry, GpuVendor, GpuTier } from "@/hooks/use-hardware-info";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface HardwareDetectionBannerProps {
  compact?: boolean;
}

export function HardwareDetectionBanner({ compact = false }: HardwareDetectionBannerProps) {
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const recs = computeSmartRecs(hw, os);
  const [expanded, setExpanded] = useState(false);

  const isFullyDetected = hw.scanned || (hw.isNvidia || hw.isAmd || hw.isIntel);
  const gpuKnown = hw.gpuName && hw.gpuName !== "Unknown GPU" && hw.gpuName !== "Detecting...";

  const vendorBadgeCls: Record<GpuVendor, string> = {
    nvidia: "bg-green-500/15 border-green-500/25 text-green-400",
    amd: "bg-red-500/15 border-red-500/25 text-red-400",
    intel: "bg-blue-500/15 border-blue-500/25 text-blue-400",
    unknown: "bg-zinc-700/30 border-zinc-700 text-zinc-400",
  };
  const vendorBadgeLabel: Record<GpuVendor, string> = {
    nvidia: "NVIDIA",
    amd: "AMD",
    intel: "INTEL",
    unknown: "GPU",
  };
  const tierLabel: Record<GpuTier, string> = {
    low: "Low",
    mid: "Mid",
    high: "High",
    pro: "Pro",
    unknown: "?",
  };

  const primaryGpu: GpuEntry | undefined =
    hw.gpus.find((g) => !g.isIntegrated) ?? hw.gpus[0];
  const primaryBadge = primaryGpu
    ? { label: vendorBadgeLabel[primaryGpu.vendor], cls: vendorBadgeCls[primaryGpu.vendor] }
    : null;

  const statusColor = hw.loading
    ? "border-zinc-800"
    : !gpuKnown
    ? "border-amber-500/30"
    : hw.scanned
    ? "border-green-500/30"
    : "border-red-500/20";

  const statusDot = hw.loading
    ? "bg-zinc-600 animate-pulse"
    : !gpuKnown
    ? "bg-amber-500 animate-pulse"
    : hw.scanned
    ? "bg-green-500"
    : "bg-red-500";

  const statusText = hw.loading
    ? "Scanning system..."
    : !gpuKnown
    ? "GPU not detected — scan recommended"
    : hw.scanned
    ? "Full hardware scan complete"
    : "Partial detection — run scan for max accuracy";

  if (compact) {
    return (
      <div className={cn("rounded-xl border bg-black/50 px-4 py-3 flex items-center gap-3", statusColor)}>
        <div className={cn("w-2 h-2 rounded-full shrink-0", statusDot)} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">System Detection</p>
          <p className="text-xs text-zinc-300 font-mono truncate">
            {gpuKnown ? hw.gpuName : "GPU unknown"} · {hw.cpuCores > 0 ? `${hw.cpuCores}T` : "CPU?"} · {hw.ramGB > 0 ? `${hw.ramLabel} RAM` : "RAM?"} · {os.displayName}
          </p>
        </div>
        {hw.scanned && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 uppercase shrink-0">Scanned</span>
        )}
        {!gpuKnown && (
          <Link href="/" className="text-[9px] font-bold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 whitespace-nowrap hover:bg-amber-500/20 transition-colors">
            Run Scan →
          </Link>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border bg-black/60 overflow-hidden", statusColor)}
    >
      {/* Main bar */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusDot)} />

        {/* Status label */}
        <div className="shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Hardware Detection</p>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            hw.loading ? "text-zinc-500" : !gpuKnown ? "text-amber-400" : hw.scanned ? "text-green-400" : "text-red-400"
          )}>
            {statusText}
          </p>
        </div>

        <div className="w-px h-8 bg-white/5 shrink-0" />

        {/* Specs row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1 min-w-0">
          {/* GPU */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Monitor className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            {gpuKnown ? (
              <span className="text-xs text-zinc-200 font-medium truncate">{hw.gpuName}</span>
            ) : (
              <span className="text-xs text-zinc-600 italic">GPU unknown</span>
            )}
            {primaryBadge && (
              <span className={cn("shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider", primaryBadge.cls)}>
                {primaryBadge.label}
              </span>
            )}
            {hw.isHybridGpu && (
              <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider bg-amber-500/15 border-amber-500/30 text-amber-300 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />
                Hybrid
              </span>
            )}
          </div>

          {/* CPU */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="text-xs text-zinc-300 font-medium">
              {hw.cpuCores > 0 ? hw.cpuLabel : <span className="text-zinc-600 italic">CPU unknown</span>}
            </span>
          </div>

          {/* RAM */}
          <div className="flex items-center gap-1.5">
            <MemoryStick className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            {hw.ramGB > 0 ? (
              <span className="text-xs text-zinc-300 font-medium">
                {hw.ramLabel} RAM
                {!hw.scanned && <span className="text-zinc-600 text-[9px] italic ml-1">(approx)</span>}
              </span>
            ) : (
              <span className="text-xs text-zinc-600 italic">RAM unknown</span>
            )}
          </div>

          {/* OS */}
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="text-xs text-zinc-300 font-medium">{os.loading ? "Detecting OS..." : os.displayName}</span>
          </div>
        </div>

        {/* Right side: recs count + expand */}
        <div className="flex items-center gap-3 shrink-0">
          {!hw.loading && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
              <Zap className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-bold text-red-400">{recs.ids.size} tweaks matched</span>
            </div>
          )}
          {!gpuKnown && !hw.loading && (
            <Link href="/">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wide cursor-pointer hover:bg-amber-500/20 transition-colors">
                <ScanLine className="w-3 h-3" />
                Run Scan
              </span>
            </Link>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-5 py-4 space-y-3">
              {/* Detected GPU list — hybrid laptops show every classified entry */}
              {hw.gpus.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Detected hardware:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hw.gpus.map((g, i) => (
                      <div
                        key={`${g.name}-${i}`}
                        data-testid={`gpu-entry-${i}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-950/60 border border-white/5"
                      >
                        <Monitor className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-[11px] text-zinc-200 font-medium flex-1 min-w-0 truncate">
                          {g.name}
                        </span>
                        <span className={cn(
                          "shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider",
                          vendorBadgeCls[g.vendor]
                        )}>
                          {vendorBadgeLabel[g.vendor]}
                        </span>
                        <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded border bg-zinc-900 border-zinc-800 text-zinc-400 uppercase tracking-wider">
                          {g.isIntegrated ? "iGPU" : "dGPU"} · {tierLabel[g.tier]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hybrid badge */}
              {hw.isHybridGpu && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] text-amber-300">Hybrid GPU setup detected — tweaks for both your integrated and discrete GPU will be included so you're covered whether the game runs on the iGPU or the dGPU.</p>
                </div>
              )}

              {/* Laptop badge */}
              {hw.isLaptop && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] text-amber-300">Laptop detected — battery-optimized tweaks will be applied. Laptop Optimizer tab is recommended.</p>
                </div>
              )}

              {/* Reasons */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Why these tweaks were selected:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {recs.reasons.slice(0, 8).map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-red-400/60 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-zinc-400 leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Incompatible note */}
              {(hw.isNvidia || hw.isAmd || hw.isIntel) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <p className="text-[10px] text-zinc-400">
                    Tweaks are gated per vendor so they only apply to GPUs you actually have.
                    {hw.isHybridGpu
                      ? " Your hybrid setup gets both iGPU and discrete GPU optimizations."
                      : ` Optimizations target your ${[hw.isNvidia && "NVIDIA", hw.isAmd && "AMD", hw.isIntel && "Intel"].filter(Boolean).join(" / ")} hardware.`}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
