import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { Settings2, AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALL_REGISTRY_IDS = [
  "Win32PrioritySeparation","DisableHungAppDetection","SetTimerResolution","SetResponsiveness",
  "GameModeTweaks","EnableMSIMode","DisableCoreParking","DisableDynamicTick",
  "NetworkThrottling","InputLagTCP","DisableNagle","SetDNSPriority","DisableNDU",
  "OptimizeTCP","EnableTCPAutoTuning","DisablePowerThrottling","DisableIPv6",
  "OptimizeRAMUsage","DisableMemoryCompression","DisablePrefetch","EnableLargeSystemCache",
  "DisablePagefileEncryption","ClearPagefileOnShutdown","MemDisableHeapTermination",
  "DisableXboxGameBar","DisableGameDVR","EnableHAGS","DisablePointerPrecision",
  "DisableAnimations","DisableTelemetry","DisableWindowsError","DisableFastStartup",
  "SetHighPerformancePlan","DisableUSBSuspend","DisableCoreParking","DisablePowerThrottlingAdv",
  "DisableDefender","DisableAutoUpdate",
];
const REGISTRY_RECOMMENDED_IDS = [
  "Win32PrioritySeparation","SetTimerResolution","SetResponsiveness","GameModeTweaks","EnableMSIMode","DisableCoreParking",
  "NetworkThrottling","InputLagTCP","DisableNagle","SetDNSPriority",
  "OptimizeRAMUsage","DisableMemoryCompression",
  "DisableXboxGameBar","DisableGameDVR","EnableHAGS","DisablePointerPrecision",
  "SetHighPerformancePlan",
];

type Impact = "HIGH" | "MED" | "LOW";

interface TweakDef {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  recommended?: boolean;
}

interface SectionProps {
  heading: string;
  tweaks: TweakDef[];
  tweakState: Record<string, boolean>;
  onSet: (id: string, val: boolean) => void;
  showRecommended?: boolean;
}

function Section({ heading, tweaks, tweakState, onSet, showRecommended = true }: SectionProps) {
  const recommended = tweaks.filter((t) => t.recommended).map((t) => t.id);

  const handleEnableRecommended = () => {
    recommended.forEach((id) => onSet(id, true));
  };

  const allRecommendedOn = recommended.length > 0 && recommended.every((id) => tweakState[id]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">{heading}</h2>
        {showRecommended && recommended.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEnableRecommended}
            disabled={allRecommendedOn}
            data-testid={`button-enable-recommended-${heading.replace(/\s+/g, '-').toLowerCase()}`}
            className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {allRecommendedOn ? "Recommended ON" : `Enable Recommended (${recommended.length})`}
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {tweaks.map((item, i) => (
          <TweakRow
            key={item.id}
            id={item.id}
            title={item.title}
            description={item.desc}
            badge={item.badge}
            impact={item.impact}
            checked={tweakState[item.id] || false}
            onCheckedChange={(v) => onSet(item.id, v)}
            delay={i + 1}
          />
        ))}
      </div>
    </section>
  );
}

export default function Registry() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const osInfo = useOsDetection();

  const CPU_TWEAKS: TweakDef[] = [
    { id: "Win32PrioritySeparation", title: "Win32PrioritySeparation = 26 (Hex 1A)", desc: "Sets CPU quantum slices to short, variable — maximizes foreground app/game priority over background tasks.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableHungAppDetection", title: "Disable Hung App Detection Delay", desc: "Removes the 5-second wait for unresponsive app dialogs — kills hung processes instantly.", impact: "LOW" },
    { id: "SetTimerResolution", title: "Set System Timer to 0.5ms", desc: "Forces Windows timer interrupt to high-resolution — better CPU scheduling precision for games.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "SetResponsiveness", title: "Set System Responsiveness = 10", desc: "Sets SystemResponsiveness=10 — balances game priority with system stability. 0 can cause audio/UI stutters; 10 is the sweet spot for gaming.", badge: "RECOMMENDED", impact: "MED", recommended: true },
    { id: "GameModeTweaks", title: "Game Mode Scheduler: High Priority", desc: "Sets Games task profile: Scheduling Category=High, SFIO=High, GPU Priority=8, CPU Priority=6, MaxPreRenderedFrames=1 — Windows treats your game as top-priority process.", badge: "NEW", impact: "HIGH", recommended: true },
    { id: "EnableMSIMode", title: "Enable MSI Mode for GPU", desc: "Forces Message Signaled Interrupts on the GPU — eliminates interrupt sharing latency with other PCI-e devices.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "DisableCoreParking", title: "Disable CPU Core Parking (Advanced)", desc: "Forces all CPU cores active via PowerSettings registry path + powercfg — removes 1–3ms wake latency on parked cores.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableDynamicTick", title: "Disable Dynamic Tick (bcdedit)", desc: "Forces constant timer interrupt — reduces scheduler jitter at the cost of ~0.5% idle power.", impact: "MED" },
  ];

  const NETWORK_TWEAKS: TweakDef[] = [
    { id: "NetworkThrottling", title: "Disable Network Throttling Index (FFFFFFFF)", desc: "Sets NetworkThrottlingIndex=FFFFFFFF — removes Windows' artificial 10-packet-per-100ms limit. Critical for high-tick servers.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "InputLagTCP", title: "Reduce Input Lag via TCP (ACK Frequency + NoDelay)", desc: "Sets TcpAckFrequency=1, TCPNoDelay=1, EnablePMTUBHDetect=0 — eliminates ACK batching delay for lower ping response.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableNagle", title: "Disable Nagle's Algorithm", desc: "Forces immediate packet sends — reduces ping variability (jitter) in real-time games.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "SetDNSPriority", title: "Optimize DNS Resolver Priority", desc: "Sets DNS cache TTL=86400 and disables negative caching — faster hostname resolution on game server connects.", impact: "MED", recommended: true },
    { id: "DisableNDU", title: "Disable NDU (Network Diagnostics Usage)", desc: "Disables ndis.sys usage tracking service — eliminates the periodic I/O spikes it causes during gameplay.", impact: "MED" },
    { id: "OptimizeTCP", title: "Optimize TCP/IP Stack", desc: "Tunes autotuninglevel, DCA, and netDMA for lower-latency packet processing.", impact: "MED" },
    { id: "EnableTCPAutoTuning", title: "Enable TCP Auto-Tuning (Normal)", desc: "Allows Windows to dynamically adjust TCP receive window for maximum bandwidth.", impact: "LOW" },
    { id: "DisablePowerThrottling", title: "Disable Network Power Throttling", desc: "Stops NIC from throttling throughput to save power — ensures full bandwidth at all times.", impact: "MED" },
    { id: "DisableIPv6", title: "Disable IPv6 on All Adapters", desc: "Removes IPv6 binding from all network adapters — reduces routing overhead if your ISP/router is IPv4 only.", impact: "LOW" },
  ];

  const MEMORY_TWEAKS: TweakDef[] = [
    { id: "OptimizeRAMUsage", title: "Flush RAM Standby List (Aggressive Trim)", desc: "Frees cached standby memory more frequently to give games priority access to physical RAM.", impact: "MED", badge: "RECOMMENDED", recommended: true },
    { id: "DisableMemoryCompression", title: "Disable Memory Compression", desc: "Stops CPU-heavy RAM compression — beneficial on 16GB+ systems.", badge: "16GB+ RAM", impact: "MED", recommended: true },
    { id: "DisablePrefetch", title: "Disable Superfetch / Prefetch", desc: "Reduces background disk usage — recommended for NVMe/SSD. Harmful on HDDs.", impact: "MED" },
    { id: "EnableLargeSystemCache", title: "Enable Large System Cache", desc: "Forces kernel to use large memory pages for file caching — better disk I/O throughput.", impact: "LOW" },
    { id: "DisablePagefileEncryption", title: "Disable Pagefile Encryption", desc: "Removes AES-128 encryption overhead on pagefile.sys reads/writes.", impact: "LOW" },
    { id: "ClearPagefileOnShutdown", title: "Clear Pagefile on Shutdown", desc: "Wipes pagefile when PC shuts down — minor privacy and fragmentation benefit.", impact: "LOW" },
    { id: "MemDisableHeapTermination", title: "Tune Heap Decommit Threshold", desc: "Sets HeapDeCommitFreeBlockThreshold=0x40000 — reduces memory fragmentation in long game sessions.", impact: "LOW" },
  ];

  const VISUAL_TWEAKS: TweakDef[] = [
    { id: "DisableXboxGameBar", title: "Disable Xbox Game Bar (Registry + Uninstall)", desc: "Prevents Game Bar from injecting into game processes and removes the overlay entirely.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "DisableGameDVR", title: "Disable GameDVR Background Recording", desc: "Stops Windows from recording game footage in background — frees GPU encoder bandwidth.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "EnableHAGS", title: "Enable HAGS (Hardware Accelerated GPU Scheduling)", desc: "Offloads GPU memory scheduling to dedicated VRAM controller — lower frame-time variance.", badge: "RTX 2000+ / RX 6000+", impact: "HIGH", recommended: true },
    { id: "DisablePointerPrecision", title: "Disable Enhance Pointer Precision (Mouse Accel)", desc: "Turns off mouse acceleration entirely — critical for raw input and consistent aim.", badge: "MUST HAVE", impact: "HIGH", recommended: true },
    { id: "DisableAnimations", title: "Disable All UI Animations", desc: "Turns off window open/close animations, menu fades, and taskbar transitions — snappier UI.", impact: "MED" },
    { id: "DisableTelemetry", title: "Disable Telemetry via Registry", desc: "Sets AllowTelemetry=0 — complements the DiagTrack service disable.", impact: "MED" },
    { id: "DisableFastStartup", title: "Disable Fast Startup (Hibernate Boot)", desc: "Forces a full cold boot instead of resuming from hibernate — fixes driver issues and state corruption.", impact: "MED", recommended: true },
    { id: "DisableWindowsError", title: "Disable Windows Error Reporting (WER)", desc: "Stops WER from freezing a crashed process for minutes while collecting a memory dump.", impact: "MED" },
  ];

  const POWER_TWEAKS: TweakDef[] = [
    { id: "SetHighPerformancePlan", title: "Force Ultimate Performance Power Plan", desc: "Unlocks the hidden Ultimate Performance plan and sets it active — eliminates all power-saving throttling.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableCoreParking", title: "Disable CPU Core Parking", desc: "Forces all CPU cores active — removes 1–3ms wake latency on parked cores.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableUSBSuspend", title: "Disable USB Selective Suspend", desc: "Prevents Windows from sleeping USB ports — eliminates controller and headset input stutter.", impact: "MED", recommended: true },
    { id: "DisablePowerThrottlingAdv", title: "Disable Power Throttling (Advanced Registry Path)", desc: "Targets the specific PowerSettings GUID path and disables power throttling at the driver level.", badge: "NEW", impact: "MED" },
    { id: "DisableDynamicTick", title: "Disable Dynamic Tick (bcdedit)", desc: "Forces constant timer interrupt — reduces scheduler jitter at the cost of ~0.5% idle power.", impact: "MED" },
  ];

  const RISKY_TWEAKS: TweakDef[] = [
    { id: "DisableAutoUpdate", title: "Disable Windows Update Service", desc: "Stops the wuauserv service permanently. Re-enable manually to get security patches. Prevents forced reboots mid-game.", badge: "RISKY", impact: "MED" },
    { id: "DisableDefender", title: "Disable Windows Defender Real-Time Protection", desc: "Disables real-time scanning. Can free 5–15% CPU during heavy I/O loads. Only do this if you have an alternative AV.", badge: "RISKY", impact: "MED" },
  ];

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

        {/* Impact legend */}
        <div className="flex items-center gap-4 px-1 mb-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Impact:</span>
          {[
            { label: "HIGH", dot: "bg-red-500", text: "text-red-400" },
            { label: "MED", dot: "bg-amber-400", text: "text-amber-400" },
            { label: "LOW", dot: "bg-zinc-500", text: "text-zinc-500" },
          ].map((item) => (
            <span key={item.label} className={`inline-flex items-center gap-1 text-[10px] font-bold ${item.text}`}>
              <span className={`w-2 h-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-zinc-600 italic">Click "Enable Recommended" on any section to apply curated safe picks</span>
        </div>

        <TabSmartBar
          tweakIds={ALL_REGISTRY_IDS}
          recommendedIds={REGISTRY_RECOMMENDED_IDS}
          label="Registry"
          context="These tweaks modify Windows registry keys that control CPU scheduling, network stack behavior, GPU scheduling, and power plan. All changes are reversible — download the script and run it as Administrator."
          tips={[
            "Win32PrioritySeparation + Timer Resolution are the two most impactful tweaks for gaming.",
            "NetworkThrottling + Nagle's Algorithm disable gives the biggest raw ping improvement.",
            "Disable XboxGameBar and GameDVR — both inject into game processes even when 'off' in settings.",
          ]}
        />

        <div className="space-y-8">
          <Section heading="CPU Scheduling & Timer" tweaks={CPU_TWEAKS} tweakState={tweaks} onSet={setTweak} />
          <Section heading="Network & Latency" tweaks={NETWORK_TWEAKS} tweakState={tweaks} onSet={setTweak} />

          {/* Memory section with RAM-aware safety note */}
          <div className="space-y-3">
            <Section heading="Memory Management" tweaks={MEMORY_TWEAKS} tweakState={tweaks} onSet={setTweak} />
            {!hw.loading && hw.ramGB <= 4 && hw.ramGB > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/25 bg-amber-500/5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <span className="text-amber-400 font-semibold">Low RAM detected (≤4 GB).</span>{" "}
                  Skip <span className="text-white font-medium">Disable Memory Compression</span> — on systems with 4 GB or less, Windows memory compression actively frees physical RAM for games. Disabling it will make your system run out of RAM faster.
                </p>
              </div>
            )}
          </div>

          {/* Visual section with GPU-aware HAGS note */}
          <div className="space-y-3">
            <Section heading="Visual Effects & Gaming" tweaks={VISUAL_TWEAKS} tweakState={tweaks} onSet={setTweak} />
            {!hw.loading && hw.isIntel && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900/60">
                <ShieldAlert className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <span className="text-zinc-200 font-semibold">Intel GPU detected.</span>{" "}
                  <span className="text-white font-medium">HAGS</span> (Hardware Accelerated GPU Scheduling) has mixed results on Intel integrated graphics — it's designed primarily for discrete NVIDIA RTX 2000+ and AMD RX 6000+ GPUs. Skip this tweak if you're on Intel UHD/Iris graphics.
                </p>
              </div>
            )}
            {!hw.loading && osInfo.isWindows11 === false && !osInfo.loading && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <span className="text-blue-400 font-semibold">Windows 10 detected.</span>{" "}
                  HAGS requires Win10 build 2004 (May 2020 Update) or newer. If your build is older than 19041, skip the HAGS toggle.
                </p>
              </div>
            )}
          </div>

          <Section heading="Power Plan & BIOS Interface" tweaks={POWER_TWEAKS} tweakState={tweaks} onSet={setTweak} />

          <section>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 mb-4">
              <AlertTriangle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-500">Advanced / Risky — Use with Caution</h3>
                <p className="text-xs text-zinc-400">The tweaks below have real performance benefits but carry risk. Read descriptions carefully.</p>
              </div>
            </div>
            <div className="space-y-3">
              {RISKY_TWEAKS.map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  badge={item.badge}
                  impact={item.impact}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={(v) => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
