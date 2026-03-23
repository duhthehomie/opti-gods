import { useMemo } from "react";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Cpu, Zap, Wifi, MemoryStick, Monitor, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const CPU_TWEAKS = [
  "Win32PrioritySeparation", "SetTimerResolution", "SetResponsiveness",
  "GameModeTweaks", "EnableMSIMode", "DisableCoreParking", "DisableDynamicTick",
];
const POWER_TWEAKS = [
  "SetHighPerformancePlan", "DisableUSBSuspend", "DisablePowerThrottlingAdv",
  "DisablePowerThrottling", "DisableDynamicTick",
];
const GPU_TWEAKS = [
  "EnableHAGS", "DisableXboxGameBar", "DisableGameDVR",
  "NvidiaOptimizeLatency", "NvidiaPreRenderedFrames", "NvidiaDisableTelemetry",
  "AmdOptimizeLatency", "AmdDisableULPS", "AmdMaxClockState", "AmdShaderCache",
];
const MEMORY_TWEAKS = [
  "DisableMemoryCompression", "DisablePrefetch", "OptimizeRAMUsage",
  "MemDisableHeapTermination", "MemDisableSuperfetch",
];
const NETWORK_TWEAKS = [
  "NetworkThrottling", "InputLagTCP", "DisableNagle", "SetDNSPriority",
  "OptimizeTCP", "DisableNDU", "FiveMDNSOverride", "FiveMNetworkBuffer", "EnableTCPAutoTuning",
];
const PROCESS_TWEAKS = [
  "ProcessLassoProBalance", "ProcessLassoAffinityGaming",
  "ProcessAutoKillHung", "ProcessTrimWorkingSet",
];
const SERVICE_TWEAKS = [
  "ServiceDiagTrack", "ServiceWSearch", "ServiceSysMain",
  "DebloatCortana", "DebloatOneDrive",
];

function groupRatio(tweaks: Record<string, boolean>, group: string[]): number {
  const present = group.filter(k => k in tweaks);
  if (!present.length) return 0;
  const on = present.filter(k => tweaks[k]);
  return on.length / present.length;
}

interface Metrics {
  fpsPct: number;
  fpsPctLo: number;
  latencyMs: number;
  inputLagMs: number;
  totalScore: number;
  breakdown: { label: string; icon: React.ElementType; color: string; pct: number; max: number }[];
}

function computeMetrics(
  tweaks: Record<string, boolean>,
  cpuCores: number,
  ramGB: number,
  isNvidia: boolean,
  isAMD: boolean,
  isIntel: boolean
): Metrics {
  const cpuRatio = groupRatio(tweaks, CPU_TWEAKS);
  const powerRatio = groupRatio(tweaks, POWER_TWEAKS);
  const gpuRatio = groupRatio(tweaks, GPU_TWEAKS);
  const memRatio = groupRatio(tweaks, MEMORY_TWEAKS);
  const netRatio = groupRatio(tweaks, NETWORK_TWEAKS);
  const procRatio = groupRatio(tweaks, PROCESS_TWEAKS);
  const svcRatio = groupRatio(tweaks, SERVICE_TWEAKS);

  const cpuMult = cpuCores <= 4 ? 1.55 : cpuCores <= 8 ? 1.25 : cpuCores >= 12 ? 0.85 : 1.0;
  const memMult = ramGB <= 4 ? 1.65 : ramGB <= 8 ? 1.3 : 0.8;
  const gpuMult = isNvidia ? 1.22 : isAMD ? 1.1 : isIntel ? 0.65 : 1.0;
  const powerMult = isIntel ? 1.28 : 1.0;

  const maxCpu = 20, maxPow = 18, maxGpu = 14, maxMem = 8, maxProc = 5, maxSvc = 4;
  const maxNet = 35, maxNetInput = 10;

  const cpuFps = cpuRatio * maxCpu * cpuMult;
  const powFps = powerRatio * maxPow * powerMult;
  const gpuFps = gpuRatio * maxGpu * gpuMult;
  const memFps = memRatio * maxMem * memMult;
  const procFps = procRatio * maxProc;
  const svcFps = svcRatio * maxSvc;

  const rawFps = cpuFps + powFps + gpuFps + memFps + procFps + svcFps;
  const fpsPct = Math.min(Math.round(rawFps * 10) / 10, 45);
  const fpsPctLo = Math.max(0, Math.round(fpsPct * 0.4 * 10) / 10);

  const netLat = netRatio * maxNet;
  const cpuLat = cpuRatio * 8 * cpuMult;
  const gpuLat = gpuRatio * 12 * gpuMult;
  const powLat = powerRatio * 5;
  const latencyMs = Math.round(Math.min(netLat + cpuLat + gpuLat + powLat, 60));

  const inputLagMs = Math.round(
    Math.min((gpuRatio * 12 * gpuMult) + (cpuRatio * 8 * cpuMult) + (netRatio * maxNetInput) + (powerRatio * 5), 30)
  );

  const anyEnabled = cpuRatio + powerRatio + gpuRatio + memRatio + netRatio + procRatio + svcRatio > 0;
  const totalScore = anyEnabled ? Math.min(Math.round(fpsPct / 45 * 100), 100) : 0;

  const breakdown = [
    {
      label: "CPU Scheduling",
      icon: Cpu,
      color: "text-red-400",
      pct: Math.round(cpuRatio * 100),
      max: Math.round(maxCpu * cpuMult),
    },
    {
      label: "Power & Throttle",
      icon: Zap,
      color: "text-amber-400",
      pct: Math.round(powerRatio * 100),
      max: Math.round(maxPow * powerMult),
    },
    {
      label: "GPU / Display",
      icon: Monitor,
      color: "text-violet-400",
      pct: Math.round(gpuRatio * 100),
      max: Math.round(maxGpu * gpuMult),
    },
    {
      label: "Memory",
      icon: MemoryStick,
      color: "text-blue-400",
      pct: Math.round(memRatio * 100),
      max: Math.round(maxMem * memMult),
    },
    {
      label: "Network / Ping",
      icon: Wifi,
      color: "text-emerald-400",
      pct: Math.round(netRatio * 100),
      max: maxNet,
    },
  ];

  return { fpsPct, fpsPctLo, latencyMs, inputLagMs, totalScore, breakdown };
}

export function FpsEstimate() {
  const hw = useHardwareInfo();
  const tweaks = useOptimizationStore(s => s.tweaks);

  const m = useMemo(() => computeMetrics(
    tweaks,
    hw.cpuCores || 8,
    hw.ramGB || 8,
    hw.isNvidia,
    hw.isAMD,
    hw.isIntel,
  ), [tweaks, hw.cpuCores, hw.ramGB, hw.isNvidia, hw.isAMD, hw.isIntel]);

  const noTweaks = m.totalScore === 0;
  const gaugeColor = m.totalScore >= 60 ? "from-red-600 to-red-400"
    : m.totalScore >= 30 ? "from-amber-600 to-amber-400"
    : "from-zinc-700 to-zinc-500";

  return (
    <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Performance Estimate
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Info className="w-3 h-3" />
          <span>Based on your hardware + enabled tweaks</span>
        </div>
      </div>

      {/* Hardware detected row */}
      {!hw.loading && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "GPU", value: hw.gpuName !== "Unknown GPU" ? hw.gpuName : "Unknown" },
            { label: "CPU", value: hw.cpuLabel },
            { label: "RAM", value: hw.ramLabel },
            { label: "Res", value: hw.resolution },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
              <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[160px]">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "FPS Improvement",
            value: noTweaks ? "—" : `+${m.fpsPctLo}–${m.fpsPct}%`,
            sub: noTweaks ? "Enable tweaks to estimate" : "vs. stock Windows",
            color: noTweaks ? "text-zinc-600" : "text-red-400",
          },
          {
            label: "Ping Reduction",
            value: noTweaks ? "—" : `−${m.latencyMs} ms`,
            sub: noTweaks ? "Network tweaks off" : "avg latency saved",
            color: noTweaks ? "text-zinc-600" : "text-emerald-400",
          },
          {
            label: "Input Lag",
            value: noTweaks ? "—" : `−${m.inputLagMs} ms`,
            sub: noTweaks ? "GPU / CPU tweaks off" : "frame latency saved",
            color: noTweaks ? "text-zinc-600" : "text-violet-400",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
            <p className={cn("text-xl font-bold font-mono", color)}>{value}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Gauge bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-zinc-500 font-mono">Overall Optimization Score</span>
          <span className={cn("text-xs font-bold font-mono", m.totalScore >= 60 ? "text-red-400" : m.totalScore >= 30 ? "text-amber-400" : "text-zinc-600")}>
            {m.totalScore}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", gaugeColor)}
            initial={{ width: 0 }}
            animate={{ width: `${m.totalScore}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Per-category breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {m.breakdown.map(({ label, icon: Icon, color, pct, max }) => (
          <div key={label} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Icon className={cn("w-3 h-3 shrink-0", color)} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 truncate">{label}</span>
            </div>
            <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full bg-current", color)}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-zinc-600">{pct}% tweaks on</span>
              <span className={cn("text-[9px] font-mono font-bold", pct > 0 ? color : "text-zinc-700")}>
                ≤+{max}{label === "Network / Ping" ? "ms" : "%"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-700 leading-relaxed border-t border-white/5 pt-4">
        ⚠ Estimates are calculated from your detected hardware ({hw.gpuName}, {hw.cpuCores} threads, ≥{hw.ramGB} GB RAM) and active tweaks.
        Actual gains vary by game, resolution, and workload. This tool is trying to be as accurate as possible — results are not guaranteed.
      </p>
    </div>
  );
}
