import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Gamepad2, Info } from "lucide-react";

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
            <p className="text-zinc-500 text-sm">Targeted tweaks for GTA V, FiveM, and RedM — process, network, and config</p>
          </div>
        </motion.div>

        <div className="space-y-8">

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">FiveM / GTA V Process</h2>
            <div className="space-y-3">
              {[
                { id: "FiveMHighPriority", title: "Force GTA5.exe to High CPU Priority (Persistent)", desc: "Injects IFEO registry keys so Windows always schedules GTA5.exe at High CPU priority — survives restarts.", badge: "RECOMMENDED" },
                { id: "FiveMDisablePhysX", title: "Disable NVIDIA PhysX GPU Acceleration", desc: "Forces CPU PhysX — reduces VRAM contention on servers with heavy particle effects." },
                { id: "FiveMAffinityMask", title: "Pin GTA5.exe to Physical Cores Only", desc: "Removes hyperthreaded siblings from the affinity mask — reduces L1/L2 cache thrashing on Intel HT CPUs." },
                { id: "FiveMIOPriority", title: "Set FiveM I/O Priority to High", desc: "Forces streaming disk reads to High I/O priority — faster asset loading on crowded servers." },
                { id: "FiveMWorkingSet", title: "Increase GTA5.exe Working Set Limit (4GB)", desc: "Raises the per-process memory ceiling for GTA5.exe to 4GB — reduces streaming model crashes on high-res texture packs." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">FiveM Client Optimizations</h2>
            <div className="space-y-3">
              {[
                { id: "FiveMCacheClear", title: "Auto-Clear FiveM Cache on Startup", desc: "Deletes stale server cache — fixes crashes, texture loss, and connection issues on reboot.", badge: "RECOMMENDED" },
                { id: "FiveMExtendedMemory", title: "Enable Extended Memory Allocator (FiveM)", desc: "Patches FiveM to use an extended heap allocator — reducing streaming model crashes on busy servers." },
                { id: "FiveMStreamDistance", title: "Optimize Stream Distance", desc: "Sets optimal streaming distance for city servers — reduces LOD pop-in and frame stutters." },
                { id: "FiveMStreamPool", title: "Set CitizenFX Stream Pool to 128", desc: "Updates CitizenFX.ini StreamPool setting to 128 — improves streaming stability on high-asset servers." },
                { id: "FiveMDisableNvidiaTelemetry", title: "Disable NVIDIA Telemetry Service", desc: "Stops NvTelemetryContainer service — eliminates the background GPU perf overhead it causes.", badge: "NVIDIA ONLY" },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Windows Settings for GTA V</h2>
            <div className="space-y-3">
              {[
                { id: "FiveMDisableFullscreen", title: "Use Windowed Borderless Mode", desc: "Borderless runs through DWM — eliminates exclusive fullscreen delays on Alt+Tab." },
                { id: "FiveMDisableDWM", title: "Disable DWM Frame Time Budgeting", desc: "Removes DWM frame time budgeting so GTA does not lose GPU time to the compositor." },
                { id: "FiveMDisableVSync", title: "Force Disable VSync in Config", desc: "Forces in-game VSync off via config — removes 60fps frame cap on higher refresh monitors." },
                { id: "FiveMNetworkBuffer", title: "Increase Socket Receive Buffer (256KB)", desc: "Bumps socket receive buffer to 256KB to handle high player count server traffic without packet loss." },
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
                { id: "FiveMDNSOverride", title: "Override CFX DNS to Cloudflare 1.1.1.1", desc: "Points cfx.re resolution to 1.1.1.1 for faster server lookups and lower DNS latency." },
                { id: "FiveMDisableP2P", title: "Allow Direct P2P Connections", desc: "Enables direct peer connections for lower server ping. Disable on untrusted public servers." },
                { id: "FiveMQueueFix", title: "Queue Timeout Extension (30s → 90s)", desc: "Extends queue timeout to 90 seconds — prevents false disconnects on busy servers." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Stutters with High Priority?", body: "If you experience micro-stutters with High Priority enabled, your CPU may be saturated. Disable it and use 'Pin to Physical Cores' instead for stable frametimes." },
              { title: "Cache Clearing", body: "Clearing FiveM cache fixes most crash/texture issues. Re-downloading server assets on first join is expected — it rebuilds the cache." },
            ].map((c, i) => (
              <motion.div key={c.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}
                className="p-5 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-red-400" />
                  <h3 className="text-red-400 font-medium text-sm">{c.title}</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{c.body}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
