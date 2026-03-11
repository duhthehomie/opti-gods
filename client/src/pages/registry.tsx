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
            <p className="text-zinc-500 text-sm">Deep registry modifications for maximum system and gaming performance</p>
          </div>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">CPU Scheduling & Priority</h2>
            <div className="space-y-3">
              {[
                { id: "Win32PrioritySeparation", title: "Win32PrioritySeparation = 26 (Hex 1A)", desc: "Sets CPU quantum slices to short, variable — maximizes foreground app/game priority." },
                { id: "DisableHungAppDetection", title: "Disable Hung App Detection", desc: "Removes the 5-second wait for unresponsive app dialogs." },
                { id: "EnableLargeSystemCache", title: "Enable Large System Cache", desc: "Forces kernel to use large memory pages for file caching — better throughput." },
                { id: "DisablePagefileEncryption", title: "Disable Pagefile Encryption", desc: "Removes encryption overhead on pagefile.sys reads/writes." },
                { id: "SetTimerResolution", title: "Set Timer Resolution (0.5ms)", desc: "Forces Windows timer to 0.5ms for better scheduling responsiveness." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Network & Latency</h2>
            <div className="space-y-3">
              {[
                { id: "NetworkThrottling", title: "Disable Network Throttling", desc: "Removes Windows artificial limits on network packet processing per 100ms window." },
                { id: "OptimizeTCP", title: "Optimize TCP/IP Stack", desc: "Tunes TCPAckFrequency, TCPNoDelay, and socket buffer sizes for lower ping." },
                { id: "DisableNagle", title: "Disable Nagle's Algorithm", desc: "Forces immediate packet sends — reduces ping variability in online games." },
                { id: "EnableTCPAutoTuning", title: "Enable TCP Auto-Tuning (Normal)", desc: "Allows Windows to dynamically adjust TCP receive window for bandwidth." },
                { id: "DisablePowerThrottling", title: "Disable Network Adapter Power Saving", desc: "Stops the NIC from throttling throughput to save power." },
                { id: "SetDNSPriority", title: "Optimize DNS Cache Priority", desc: "Sets DNS resolver to High priority for faster hostname resolution." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Memory Management</h2>
            <div className="space-y-3">
              {[
                { id: "DisablePrefetch", title: "Disable Superfetch / Prefetch", desc: "Reduces background disk usage — recommended for NVMe/SSD drives." },
                { id: "ClearPagefileOnShutdown", title: "Clear Pagefile on Shutdown", desc: "Wipes pagefile when PC shuts down — minor privacy and fragmentation benefit." },
                { id: "DisableMemoryCompression", title: "Disable Memory Compression", desc: "Stops CPU-heavy RAM compression — beneficial on 32GB+ systems." },
                { id: "OptimizeRAMUsage", title: "Trim Standby List Aggressively", desc: "Frees cached memory more frequently to give games priority access." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Visual Effects & Responsiveness</h2>
            <div className="space-y-3">
              {[
                { id: "DisableAnimations", title: "Disable All UI Animations", desc: "Turns off window open/close animations, menu fade, and taskbar transitions." },
                { id: "DisableTelemetry", title: "Disable Windows Telemetry Registry", desc: "Sets AllowTelemetry=0 in the registry — complements the service disable." },
                { id: "DisableXboxGameBar", title: "Disable Xbox Game Bar (Registry)", desc: "Prevents Game Bar overlay from injecting into game processes." },
                { id: "DisableGameDVR", title: "Disable GameDVR Background Recording", desc: "Stops Windows from recording game footage in the background (frees GPU encoder)." },
                { id: "EnableHAGS", title: "Enable HAGS (Hardware Accelerated GPU Scheduling)", desc: "Offloads GPU scheduling to dedicated VRAM controller — lower GPU latency." },
                { id: "DisablePointerPrecision", title: "Disable Enhance Pointer Precision", desc: "Turns off mouse acceleration — critical for raw input / consistent aim." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Power Plan & BIOS Interface</h2>
            <div className="space-y-3">
              {[
                { id: "SetHighPerformancePlan", title: "Force Ultimate Performance Power Plan", desc: "Unlocks the hidden Ultimate Performance power plan and sets it active." },
                { id: "DisableUSBSuspend", title: "Disable USB Selective Suspend", desc: "Prevents Windows from sleeping USB ports — eliminates input stutter." },
                { id: "DisableCoreParking", title: "Disable CPU Core Parking", desc: "Forces all cores to stay active — removes wake-up latency spikes." },
                { id: "DisableDynamicTick", title: "Disable Dynamic Tick", desc: "Forces constant timer interrupt — reduces scheduling jitter during gaming." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
