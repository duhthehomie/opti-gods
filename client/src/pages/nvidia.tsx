import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { MonitorPlay, Check, Cpu, Layers, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PRESETS = [
  {
    id: "Performance",
    title: "Maximum Performance",
    description: "Sacrifices visual quality for the highest possible framerates and lowest latency. Ideal for competitive shooters.",
    features: ["Texture Filtering: High Perf", "Power Management: Max", "Low Latency Mode: Ultra", "Shader Cache: On", "Triple Buffering: Off"],
  },
  {
    id: "Balanced",
    title: "Balanced",
    description: "The default Opti Gods recommendation. Keeps games looking good while removing unnecessary driver overhead.",
    features: ["Texture Filtering: Quality", "Power Management: Optimal", "Low Latency Mode: On", "Anisotropic Filtering: x8"],
  },
  {
    id: "Quality",
    title: "High Quality",
    description: "For single-player games where visual fidelity is more important than raw frames.",
    features: ["Texture Filtering: High Quality", "Power Management: Adaptive", "Anisotropic Filtering: x16", "DLSS: Quality Mode"],
  },
];

const NVIDIA_TWEAKS = [
  {
    id: "NvidiaDisableTelemetry",
    title: "Disable NVIDIA Telemetry Services",
    desc: "Stops NvTelemetryContainer and NvDisplayContainerLS — eliminates NVIDIA's background data collection and the CPU spikes it causes during gameplay.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaPreRenderedFrames",
    title: "Limit Pre-Rendered Frames to 1",
    desc: "Sets MaximumPreRenderedFrames=1 in the Games system profile — GPU renders and immediately presents frames, reducing render queue depth and input lag by 1–3 frames.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaOptimizeLatency",
    title: "NVIDIA Latency Stack Optimization",
    desc: "Enables HAGS + sets Games profile to High scheduling category, SFIO High, GPU Priority 8 — complete low-latency GPU pipeline setup in one toggle.",
    badge: "NEW",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaMaxPerfMode",
    title: "Max Performance Mode (Registry Hint)",
    desc: "Applies GraphicsDrivers registry hints to bias the driver toward maximum clock speeds over power saving — reduces GPU boost latency on first frame.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaShaderCache",
    title: "Enable GPU Shader Pre-Caching",
    desc: "Forces shader pre-compilation caching via DirectX registry and NGXCore — eliminates shader compilation stutters the first time you enter a new area or game.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaDisableOverlay",
    title: "Disable NVIDIA Overlay & Container",
    desc: "Suppresses nvcontainer.exe overlay injection and disables GeForce Experience opt-in — removes the in-game overlay overhead from game processes.",
    impact: "MED" as const,
  },
  {
    id: "EnableHAGS",
    title: "Enable HAGS (Hardware Accelerated GPU Scheduling)",
    desc: "Offloads GPU VRAM scheduling to dedicated hardware controller — reduces frame-time variance, especially at high FPS. Requires RTX 2000+ or RX 6000+.",
    badge: "RTX 2000+ / RX 6000+",
    impact: "HIGH" as const,
  },
  {
    id: "EnableMSIMode",
    title: "Enable MSI Mode for GPU (Interrupt Mode)",
    desc: "Forces GPU interrupts to use Message Signaled Interrupts instead of line-based — eliminates interrupt sharing with other PCIe devices, reduces DPC latency.",
    impact: "HIGH" as const,
  },
];

function NvidiaBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      {text}
    </span>
  );
}

export default function Nvidia() {
  const { tweaks, setTweak, nvidiaPreset, setNvidiaPreset } = useOptimizationStore();

  const enableAllNvidia = () => {
    ["NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaOptimizeLatency","EnableHAGS","EnableMSIMode","NvidiaShaderCache"].forEach(
      (k) => setTweak(k, true)
    );
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
            <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
              <MonitorPlay className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">NVIDIA Optimizer</h1>
              <p className="text-zinc-500 text-sm">Real registry tweaks + NVCP profile selection for NVIDIA GPUs</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={enableAllNvidia}
            data-testid="button-enable-all-nvidia"
            className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-xs font-bold uppercase tracking-wide"
          >
            Enable All Recommended
          </Button>
        </motion.div>

        {/* Registry Tweaks Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Cpu className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">NVIDIA Registry Tweaks</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
              {["HIGH","MED"].map((l, i) => (
                <span key={l} className={cn("flex items-center gap-1", i === 0 ? "text-red-400" : "text-amber-400")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", i === 0 ? "bg-red-500" : "bg-amber-400")} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {NVIDIA_TWEAKS.map((item, i) => (
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

        {/* NVCP Profile Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Layers className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">NVCP Profile — Script Preset</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
          </div>
          <p className="text-xs text-zinc-500 px-1 mb-4">The selected profile is baked into your downloaded .ps1 script as registry instructions. These instruct the NVIDIA driver how to behave globally.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRESETS.map((preset, index) => {
              const isSelected = nvidiaPreset === preset.id;
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setNvidiaPreset(preset.id)}
                  data-testid={`card-nvidia-preset-${preset.id.toLowerCase()}`}
                  className={cn(
                    "relative p-6 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col h-full",
                    isSelected
                      ? "bg-red-500/10 border-red-500 shadow-[0_0_20px_-6px_rgba(239,68,68,0.4)]"
                      : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 text-red-500">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                  <h3 className={cn("text-xl font-bold font-display mb-3", isSelected ? "text-white" : "text-zinc-300")}>
                    {preset.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6 leading-relaxed flex-grow">
                    {preset.description}
                  </p>
                  <ul className="space-y-2 mt-auto pt-4 border-t border-white/5">
                    {preset.features.map(feat => (
                      <li key={feat} className="text-xs text-zinc-400 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-red-500/50" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Info panel */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <Radio className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-white font-semibold">AMD GPU?</span> The HAGS toggle (above) works for RX 6000+ series. All other tweaks on this page are NVIDIA-specific. AMD users should use the Registry tab for system-wide performance tweaks.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
