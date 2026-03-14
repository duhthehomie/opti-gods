import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Settings2, AlertTriangle } from "lucide-react";

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
            <p className="text-zinc-500 text-sm">Deep Windows registry modifications for maximum system and gaming performance</p>
          </div>
        </motion.div>

        <div className="space-y-8">

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">CPU Scheduling & Timer</h2>
            <div className="space-y-3">
              {[
                { id: "Win32PrioritySeparation", title: "Win32PrioritySeparation = 26 (Hex 1A)", desc: "Sets CPU quantum slices to short, variable — maximizes foreground app/game priority over background tasks.", badge: "RECOMMENDED" },
                { id: "DisableHungAppDetection", title: "Disable Hung App Detection Delay", desc: "Removes the 5-second wait for unresponsive app dialogs — kills hung processes instantly." },
                { id: "SetTimerResolution", title: "Set System Timer to 0.5ms", desc: "Forces Windows timer interrupt to high-resolution — better CPU scheduling precision for games." },
                { id: "SetResponsiveness", title: "Set Multimedia System Responsiveness to 0", desc: "Sets SystemResponsiveness=0 — gives games 100% of multimedia class scheduler priority instead of sharing 20% with background services.", badge: "RECOMMENDED" },
                { id: "EnableMSIMode", title: "Enable MSI Mode for GPU", desc: "Forces Message Signaled Interrupts on the GPU — eliminates interrupt sharing latency with other PCI-e devices." },
                { id: "DisableCoreParking", title: "Disable CPU Core Parking", desc: "Forces all cores to stay active — removes the 1–3ms wake-up latency spike when a parked core is needed." },
                { id: "DisableDynamicTick", title: "Disable Dynamic Tick (bcdedit)", desc: "Forces constant timer interrupt — reduces scheduler jitter at the cost of ~0.5% idle power." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Network & Latency</h2>
            <div className="space-y-3">
              {[
                { id: "NetworkThrottling", title: "Disable Network Throttling Index", desc: "Removes Windows' 10-packet-per-100ms limit on network processing — critical for high-tick servers.", badge: "RECOMMENDED" },
                { id: "OptimizeTCP", title: "Optimize TCP/IP Stack", desc: "Tunes autotuninglevel, DCA, and netDMA for lower-latency packet processing." },
                { id: "DisableNagle", title: "Disable Nagle's Algorithm", desc: "Forces immediate packet sends — reduces ping variability (jitter) in real-time games.", badge: "RECOMMENDED" },
                { id: "EnableTCPAutoTuning", title: "Enable TCP Auto-Tuning (Normal)", desc: "Allows Windows to dynamically adjust TCP receive window for maximum bandwidth." },
                { id: "DisablePowerThrottling", title: "Disable Network Power Throttling", desc: "Stops NIC from throttling throughput to save power — ensures full bandwidth at all times." },
                { id: "SetDNSPriority", title: "Optimize DNS Resolver Priority", desc: "Sets DNS client thread to High priority — faster hostname resolution on game server connects." },
                { id: "DisableNDU", title: "Disable NDU (Network Diagnostics Usage)", desc: "Disables ndis.sys usage tracking service — eliminates the periodic I/O spikes it causes during gameplay." },
                { id: "DisableIPv6", title: "Disable IPv6 on All Adapters", desc: "Removes IPv6 binding from all network adapters — reduces routing overhead if your ISP/router is IPv4 only." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Memory Management</h2>
            <div className="space-y-3">
              {[
                { id: "EnableLargeSystemCache", title: "Enable Large System Cache", desc: "Forces kernel to use large memory pages for file caching — better disk I/O throughput." },
                { id: "DisablePagefileEncryption", title: "Disable Pagefile Encryption", desc: "Removes AES-128 encryption overhead on pagefile.sys reads/writes." },
                { id: "DisablePrefetch", title: "Disable Superfetch / Prefetch", desc: "Reduces background disk usage — recommended for NVMe/SSD. Harmful on HDDs." },
                { id: "ClearPagefileOnShutdown", title: "Clear Pagefile on Shutdown", desc: "Wipes pagefile when PC shuts down — minor privacy and fragmentation benefit." },
                { id: "DisableMemoryCompression", title: "Disable Memory Compression", desc: "Stops CPU-heavy RAM compression — beneficial on 16GB+ systems.", badge: "16GB+ RAM" },
                { id: "OptimizeRAMUsage", title: "Trim Standby List Aggressively", desc: "Frees cached memory more frequently to give games priority access to physical RAM." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Visual Effects & Gaming</h2>
            <div className="space-y-3">
              {[
                { id: "DisableAnimations", title: "Disable All UI Animations", desc: "Turns off window open/close animations, menu fades, and taskbar transitions — snappier UI." },
                { id: "DisableTelemetry", title: "Disable Telemetry via Registry", desc: "Sets AllowTelemetry=0 — complements the DiagTrack service disable." },
                { id: "DisableXboxGameBar", title: "Disable Xbox Game Bar (Registry + Uninstall)", desc: "Prevents Game Bar from injecting into game processes and removes the overlay entirely." },
                { id: "DisableGameDVR", title: "Disable GameDVR Background Recording", desc: "Stops Windows from recording game footage in background — frees GPU encoder bandwidth." },
                { id: "EnableHAGS", title: "Enable HAGS (Hardware Accelerated GPU Scheduling)", desc: "Offloads GPU memory scheduling to dedicated VRAM controller — lower frame-time variance.", badge: "RTX 2000+ / RX 6000+" },
                { id: "DisablePointerPrecision", title: "Disable Enhance Pointer Precision (Mouse Accel)", desc: "Turns off mouse acceleration entirely — critical for raw input and consistent aim.", badge: "MUST HAVE" },
                { id: "DisableFastStartup", title: "Disable Fast Startup (Hibernate Boot)", desc: "Forces a full cold boot instead of resuming from hibernate — fixes driver issues and state corruption." },
                { id: "DisableWindowsError", title: "Disable Windows Error Reporting (WER)", desc: "Stops WER from freezing a crashed process for minutes while collecting a memory dump." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Power Plan & BIOS Interface</h2>
            <div className="space-y-3">
              {[
                { id: "SetHighPerformancePlan", title: "Force Ultimate Performance Power Plan", desc: "Unlocks the hidden Ultimate Performance plan and sets it active — eliminates all power-saving throttling.", badge: "RECOMMENDED" },
                { id: "DisableUSBSuspend", title: "Disable USB Selective Suspend", desc: "Prevents Windows from sleeping USB ports — eliminates controller and headset input stutter." },
                { id: "DisablePowerThrottling", title: "Disable CPU Power Throttling", desc: "Disables the Windows power throttling policy that reduces background CPU clocks." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-500">Advanced / Risky — Use with Caution</h3>
                <p className="text-xs text-zinc-400">The tweaks below have real performance benefits but carry risk. Read descriptions carefully.</p>
              </div>
            </div>
            <div className="space-y-3 mt-4">
              {[
                { id: "DisableAutoUpdate", title: "Disable Windows Update Service", desc: "Stops the wuauserv service permanently. Re-enable manually to get security patches. Prevents forced reboots mid-game.", badge: "RISKY" },
                { id: "DisableDefender", title: "Disable Windows Defender Real-Time Protection", desc: "Disables real-time scanning. Can free 5–15% CPU during heavy I/O loads. Only do this if you have an alternative AV.", badge: "RISKY" },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}
