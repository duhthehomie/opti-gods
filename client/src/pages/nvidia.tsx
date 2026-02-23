import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { MonitorPlay, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  {
    id: "Performance",
    title: "Maximum Performance",
    description: "Sacrifices visual quality for the highest possible framerates and lowest latency. Ideal for competitive shooters.",
    features: ["Texture Filtering: High Perf", "Power Management: Max", "Low Latency Mode: Ultra"]
  },
  {
    id: "Balanced",
    title: "Balanced",
    description: "The default Opti Gods recommendation. Keeps games looking good while removing unnecessary driver overhead.",
    features: ["Texture Filtering: Quality", "Power Management: Optimal", "Low Latency Mode: On"]
  },
  {
    id: "Quality",
    title: "High Quality",
    description: "For single-player games where visual fidelity is more important than raw frames.",
    features: ["Texture Filtering: High Quality", "Power Management: Adaptive", "Anisotropic Filtering: x16"]
  }
];

export default function Nvidia() {
  const { nvidiaPreset, setNvidiaPreset } = useOptimizationStore();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl pb-10">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <MonitorPlay className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">NVIDIA Profile Inspector</h1>
            <p className="text-zinc-500 text-sm">Inject pre-configured NVIDIA Control Panel profiles</p>
          </div>
        </motion.div>

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
                className={cn(
                  "relative p-6 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col h-full",
                  isSelected 
                    ? "bg-red-500/10 border-red-500 box-glow" 
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
                      <span className="w-1 h-1 rounded-full bg-red-500/50"></span>
                      {feat}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
