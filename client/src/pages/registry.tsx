import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Settings2 } from "lucide-react";

export default function Registry() {
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
            <Settings2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Registry Tweaks</h1>
            <p className="text-zinc-500 text-sm">Safe registry modifications for system performance</p>
          </div>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Network & CPU</h2>
            <div className="space-y-3">
              <TweakRow 
                id="Win32PrioritySeparation"
                title="Win32PrioritySeparation"
                description="Optimizes CPU scheduling for foreground applications and games."
                checked={tweaks.Win32PrioritySeparation}
                onCheckedChange={(v) => setTweak("Win32PrioritySeparation", v)}
                delay={1}
              />
              <TweakRow 
                id="NetworkThrottling"
                title="Disable Network Throttling"
                description="Removes Windows artificial limits on network packet processing."
                checked={tweaks.NetworkThrottling}
                onCheckedChange={(v) => setTweak("NetworkThrottling", v)}
                delay={2}
              />
              <TweakRow 
                id="OptimizeTCP"
                title="Optimize TCP/IP settings"
                description="Tunes TCP parameters to lower ping and reduce packet loss."
                checked={tweaks.OptimizeTCP}
                onCheckedChange={(v) => setTweak("OptimizeTCP", v)}
                delay={3}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">System Debloat</h2>
            <div className="space-y-3">
              <TweakRow 
                id="DisableTelemetry"
                title="Disable Windows Telemetry"
                description="Stops Windows from sending background diagnostic data to Microsoft."
                checked={tweaks.DisableTelemetry}
                onCheckedChange={(v) => setTweak("DisableTelemetry", v)}
                delay={4}
              />
              <TweakRow 
                id="DisablePrefetch"
                title="Disable Superfetch/Prefetch"
                description="Reduces disk usage on modern SSDs/NVMe drives."
                checked={tweaks.DisablePrefetch}
                onCheckedChange={(v) => setTweak("DisablePrefetch", v)}
                delay={5}
              />
              <TweakRow 
                id="DisableXboxGameBar"
                title="Disable Xbox Game Bar"
                description="Prevents the Game Bar overlay from consuming resources."
                checked={tweaks.DisableXboxGameBar}
                onCheckedChange={(v) => setTweak("DisableXboxGameBar", v)}
                delay={6}
              />
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
