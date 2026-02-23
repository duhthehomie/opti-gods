import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Gamepad2 } from "lucide-react";

export default function Fivem() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Gamepad2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">FiveM Optimizer</h1>
            <p className="text-zinc-500 text-sm">Targeted tweaks for GTA V and FiveM servers</p>
          </div>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Game Specific</h2>
            <div className="space-y-3">
              <TweakRow 
                id="FiveMCacheClear"
                title="Auto-Clear Cache on Startup"
                description="Deletes old server cache to fix crashes and texture loss automatically."
                checked={tweaks.FiveMCacheClear}
                onCheckedChange={(v) => setTweak("FiveMCacheClear", v)}
                delay={1}
              />
              <TweakRow 
                id="FiveMHighPriority"
                title="Force High Priority"
                description="Injects registry keys to ensure GTA5.exe and FiveM run at High CPU priority."
                checked={tweaks.FiveMHighPriority}
                onCheckedChange={(v) => setTweak("FiveMHighPriority", v)}
                delay={2}
              />
            </div>
          </section>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="p-6 rounded-lg bg-red-500/5 border border-red-500/20"
          >
            <h3 className="text-red-400 font-medium mb-2">Note on FiveM Optimizations</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              These settings modify how Windows handles the executable. If you experience stutters with High Priority enabled, your CPU might be maxing out. Disable it if issues occur.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
