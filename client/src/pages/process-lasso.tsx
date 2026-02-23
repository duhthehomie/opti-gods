import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Cpu } from "lucide-react";

export default function ProcessLasso() {
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
            <Cpu className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Process Lasso Config</h1>
            <p className="text-zinc-500 text-sm">Automated CPU affinity and process management</p>
          </div>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Bitsum Core Features</h2>
            <div className="space-y-3">
              <TweakRow 
                id="ProcessLassoProBalance"
                title="Enable ProBalance"
                description="Intelligently adjusts priorities of background processes to keep your system responsive."
                checked={tweaks.ProcessLassoProBalance}
                onCheckedChange={(v) => setTweak("ProcessLassoProBalance", v)}
                delay={1}
              />
              <TweakRow 
                id="ProcessLassoSmartTrim"
                title="Enable SmartTrim"
                description="Aggressively frees memory from background apps when RAM usage exceeds 80%."
                checked={tweaks.ProcessLassoSmartTrim}
                onCheckedChange={(v) => setTweak("ProcessLassoSmartTrim", v)}
                delay={2}
              />
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
