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
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Active Processes (High Impact)</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">System Idle Process</h3>
                  <p className="text-xs text-zinc-500">Essential for system stability</p>
                </div>
                <div className="text-xs font-mono text-zinc-400">0.1% CPU</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between border-l-2 border-l-red-500">
                <div>
                  <h3 className="text-white font-medium">FiveM.exe</h3>
                  <p className="text-xs text-zinc-500">Priority: High (Pinned)</p>
                </div>
                <div className="text-xs font-mono text-red-400">12.4% CPU</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Discord.exe</h3>
                  <p className="text-xs text-zinc-500">Priority: Normal</p>
                </div>
                <div className="text-xs font-mono text-zinc-400">1.2% CPU</div>
              </div>
            </div>
            <div className="mt-6">
              <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6">
                Kill Non-Essential Background Tasks
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
