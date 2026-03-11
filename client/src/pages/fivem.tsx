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
            <p className="text-zinc-500 text-sm">Targeted tweaks for GTA V, FiveM, and RedM servers</p>
          </div>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">FiveM / GTA V Specific</h2>
            <div className="space-y-3">
              {[
                { id: "FiveMCacheClear", title: "Auto-Clear Cache on Startup", desc: "Deletes stale server cache at boot — fixes crashes, texture loss, and connection issues." },
                { id: "FiveMHighPriority", title: "Force GTA5.exe to High Priority", desc: "Injects registry keys so Windows always schedules GTA5.exe at High CPU priority." },
                { id: "FiveMDisablePhysX", title: "Disable NVIDIA PhysX for FiveM", desc: "Forces CPU PhysX — reduces VRAM contention on servers with heavy effects." },
                { id: "FiveMExtendedMemory", title: "Enable Extended Memory Allocator", desc: "Patches FiveM to use an extended heap allocator, reducing streaming model crashes." },
                { id: "FiveMNetworkBuffer", title: "Increase Network Buffer Size", desc: "Bumps socket receive buffer to 256KB to handle high player count server traffic." },
                { id: "FiveMDisableVSync", title: "Force Disable VSync", desc: "Forces in-game VSync off via config — removes 60fps frame cap on higher refresh monitors." },
                { id: "FiveMStreamDistance", title: "Optimize Stream Distance", desc: "Sets optimal streaming distance for city servers — reduces LOD pop-in and stutters." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Windows Settings for GTA V</h2>
            <div className="space-y-3">
              {[
                { id: "FiveMDisableFullscreen", title: "Use Windowed Borderless Mode", desc: "Borderless runs through Desktop Window Manager — eliminates exclusive fullscreen delays on Alt+Tab." },
                { id: "FiveMDisableDWM", title: "Disable Desktop Window Manager Throttling", desc: "Removes DWM frame time budgeting so GTA does not lose GPU time to the compositor." },
                { id: "FiveMAffinityMask", title: "Pin GTA5.exe to Physical Cores Only", desc: "Removes hyperthreaded siblings from the affinity mask — reduces L1/L2 cache thrashing." },
                { id: "FiveMIOPriority", title: "Set FiveM I/O Priority to High", desc: "Forces streaming disk reads to High I/O priority — faster asset loading." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">CFX / Server Connectivity</h2>
            <div className="space-y-3">
              {[
                { id: "FiveMDisableP2P", title: "Disable P2P Leak Prevention", desc: "Allows direct peer connections for lower server ping (disable on untrusted servers)." },
                { id: "FiveMDNSOverride", title: "Override CFX DNS Resolver", desc: "Points cfx.re resolution to Cloudflare 1.1.1.1 for faster server lookups." },
                { id: "FiveMQueueFix", title: "Queue Timeout Extension", desc: "Extends queue timeout from 30s to 90s — prevents false disconnects on busy servers." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="p-6 rounded-lg bg-red-500/5 border border-red-500/20"
          >
            <h3 className="text-red-400 font-medium mb-2">About FiveM Priority Tweaks</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              If you experience micro-stutters with High Priority enabled, your CPU may be saturated. Disable "Force GTA5.exe to High Priority" and use "Pin to Physical Cores" instead for a more stable frametimes.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
