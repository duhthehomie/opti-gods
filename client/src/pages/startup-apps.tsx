import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Power, AlertTriangle } from "lucide-react";

export default function StartupApps() {
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
            <Power className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Startup Applications</h1>
            <p className="text-zinc-500 text-sm">Disable unnecessary apps from launching on boot</p>
          </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 mb-6"
          >
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-zinc-300">
              Red toggle (ON) means the app is <strong className="text-white">DISABLED</strong> from starting. Gray (OFF) means it will start normally.
            </p>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Common Heavy Hitters</h2>
            <div className="space-y-3">
              <TweakRow 
                id="StartupDiscord"
                title="Disable Discord Autostart"
                description="Prevents Discord from launching in the background on boot."
                checked={tweaks.StartupDiscord}
                onCheckedChange={(v) => setTweak("StartupDiscord", v)}
                delay={1}
              />
              <TweakRow 
                id="StartupSpotify"
                title="Disable Spotify Autostart"
                description="Stops Spotify Web Helper from consuming memory on startup."
                checked={tweaks.StartupSpotify}
                onCheckedChange={(v) => setTweak("StartupSpotify", v)}
                delay={2}
              />
              <TweakRow 
                id="StartupSteam"
                title="Disable Steam Autostart"
                description="Prevents Steam from checking for updates immediately on boot."
                checked={tweaks.StartupSteam}
                onCheckedChange={(v) => setTweak("StartupSteam", v)}
                delay={3}
              />
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
