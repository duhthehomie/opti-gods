import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { V2TweakSection } from "@/components/v2-tweak-section";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Settings2, AlertTriangle, CheckCircle2, Info, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageGuide } from "@/components/page-guide";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const ALL_REGISTRY_IDS = [
  "Win32PrioritySeparation","DisableHungAppDetection","SetTimerResolution","SetResponsiveness",
  "GameModeTweaks","EnableMSIMode","DisableCoreParking","DisableDynamicTick",
  "NetworkThrottling","InputLagTCP","DisableNagle","SetDNSPriority","DisableNDU",
  "OptimizeTCP","EnableTCPAutoTuning","DisablePowerThrottling","DisableIPv6",
  "OptimizeRAMUsage","DisableMemoryCompression","DisablePrefetch","MemDisableKernelPaging",
  "DisablePagefileEncryption","ClearPagefileOnShutdown","MemDisableHeapTermination",
  "RegistryNTFSOptimize","RegistryIOPageLock","RegistryDPCLatency","RegistryLargePageHeap",
  "DisableXboxGameBar","DisableGameDVR","EnableHAGS","DisablePointerPrecision",
  "DisableAnimations","DisableTelemetry","DisableWindowsError","DisableFastStartup",
  "SysVisualBestPerf","SysHibernateOff","SysHypervisorOff",
  "SetHighPerformancePlan","DisableUSBSuspend","DisableCoreParking","DisablePowerThrottlingAdv",
  "DisableDefender","DisableAutoUpdate",
  "NetDNSCloudflare","NetDNSGoogle","NetDisableQoS","NetInterruptModeration","NetRSSQueues","NetAdapterPowerSave","NetTCPChimneyOffload",
  "Win11DisableVBS","Win11DisableHVCI","Win11ParkingCoreOverride","Win11ProcessorIdleMin",
  "ProcNUMAAware","ProcAffinityFPS","ProcMMCSSGaming","ProcGPUSchedulerHigh",
  "IntelOldGenPowerOpt",
  "DisableSearchIndexer","DisableAutoMaintenance",
  "ToolDPCLatencyCheck","CodDisableTelemetry","CodTdrDelay","CodMMCSS","CodQoSPolicy",
];
const REGISTRY_RECOMMENDED_IDS = [
  "Win32PrioritySeparation","SetTimerResolution","SetResponsiveness","GameModeTweaks","EnableMSIMode","DisableCoreParking",
  "NetworkThrottling","InputLagTCP","DisableNagle","SetDNSPriority",
  "OptimizeRAMUsage",
  "DisableXboxGameBar","DisableGameDVR","EnableHAGS",
  "SysVisualBestPerf","SysHibernateOff",
  "SetHighPerformancePlan",
  "NetDNSCloudflare","NetDisableQoS","NetInterruptModeration","ProcMMCSSGaming","ProcGPUSchedulerHigh",
];

type Impact = "HIGH" | "MED" | "LOW";

interface TweakDef {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  recommended?: boolean;
  warning?: string;
}

interface SectionProps {
  heading: string;
  tweaks: TweakDef[];
  tweakState: Record<string, boolean>;
  onSet: (id: string, val: boolean) => void;
  showRecommended?: boolean;
  smartRecIds?: Set<string>;
}

function Section({ heading, tweaks, tweakState, onSet, showRecommended = true, smartRecIds }: SectionProps) {
  const recommended = tweaks
    .filter((t) => smartRecIds ? smartRecIds.has(t.id) : t.recommended)
    .map((t) => t.id);

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
      <div className="space-y-5">
        {tweaks.map((item, i) => (
          <TweakRow
            key={item.id}
            id={item.id}
            title={item.title}
            description={item.desc}
            badge={item.badge}
            impact={item.impact}
            warning={item.warning}
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
  const smartRecs = computeSmartRecs(hw, osInfo);

  const CPU_TWEAKS: TweakDef[] = [
    { id: "Win32PrioritySeparation", title: "Win32PrioritySeparation = 26 (Hex 1A)", desc: "Sets CPU quantum slices to short, variable — maximizes foreground app/game priority over background tasks.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableHungAppDetection", title: "Disable Hung App Detection Delay", desc: "Removes the 5-second wait for unresponsive app dialogs — kills hung processes instantly.", impact: "LOW" },
    { id: "SetTimerResolution", title: "Set System Timer to 0.5ms", desc: "Forces Windows timer interrupt to high-resolution — better CPU scheduling precision for games.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "SetResponsiveness", title: "Set System Responsiveness (Hardware-Optimized)", desc: "Adjusts SystemResponsiveness based on your CPU/GPU — balances game priority with stability. 0 = audio/Discord breaks; 10 = stable baseline; 26 = balanced sweet spot; 38 = high-power friendly. Will auto-detect your best value.", badge: "RECOMMENDED", impact: "MED", recommended: true },
    { id: "GameModeTweaks", title: "Game Mode Scheduler: High Priority", desc: "Sets Games task profile: Scheduling Category=High, SFIO=High, GPU Priority=8, CPU Priority=6, MaxPreRenderedFrames=1 — Windows treats your game as top-priority process.", badge: "NEW", impact: "HIGH", recommended: true },
    { id: "EnableMSIMode", title: "Enable MSI Mode for GPU", desc: "Forces Message Signaled Interrupts on the GPU — eliminates interrupt sharing latency with other PCI-e devices.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "DisableCoreParking", title: "Disable CPU Core Parking (Advanced)", desc: "Forces all CPU cores active via PowerSettings registry path + powercfg — removes 1–3ms wake latency on parked cores.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableDynamicTick", title: "Disable Dynamic Tick (bcdedit)", desc: "Forces constant timer interrupt — reduces scheduler jitter at the cost of ~0.5% idle power.", impact: "MED" },
    { id: "DisableSearchIndexer", title: "Disable Windows Search Indexer", desc: "Stops the WSearch service so SearchIndexer.exe cannot spike disk I/O and CPU during gaming. Re-enable via Services.msc if you need Windows Search. Safe — doesn't remove the service, just stops it.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableAutoMaintenance", title: "Disable Automatic Maintenance", desc: "Sets MaintenanceDisabled=1 in the Windows schedule — prevents Defender scans, disk cleanup, and maintenance tasks from launching mid-session. Re-enable via Control Panel > Security and Maintenance if needed.", impact: "MED" },
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
    { id: "DisableMemoryCompression", title: "Disable Memory Compression", desc: "Stops CPU-heavy RAM compression — only safe on 32GB+ systems. On 16GB or less, disabling compression can cause games to page to disk, leading to stutters and freezes.", badge: "32GB+ RAM", impact: "MED", recommended: false, warning: "Memory compression is critical on 16 GB or less. Disabling it on low-RAM systems causes disk paging and severe stutters. Only enable this if your PC has 32 GB or more RAM." },
    { id: "DisablePrefetch", title: "Disable Superfetch / Prefetch", desc: "Reduces background disk usage — recommended for NVMe/SSD. Harmful on HDDs.", impact: "MED", warning: "On systems with a traditional hard drive (HDD), disabling Prefetch significantly slows down app and game launch times. Only enable this if your OS and games are installed on an SSD or NVMe drive." },
    { id: "MemDisableKernelPaging", title: "Disable Kernel Paging (Disable Paging Executive)", desc: "Keeps core OS code in RAM instead of being paged to disk — reduces micro-stutter from kernel page faults.", impact: "LOW", warning: "Requires at least 8 GB RAM. On low-memory systems this can cause instability. Only enable on 8 GB+ systems with a pagefile present." },
    { id: "EnableLargeSystemCache", title: "Enable Large System Cache (File I/O Boost)", desc: "Tells Windows to use all available RAM for the system file cache instead of the working-set trimmer — dramatically speeds up large file reads/writes. Ideal for 32 GB+ workstations, streamers, and video editors.", impact: "MED", badge: "NOT FOR GAMING", warning: "⚠ DO NOT enable this if you play games (especially FiveM / GTA). LargeSystemCache=1 is a Windows Server setting that aggressively trims game process working sets, causing crash 0xDEED in FiveM and random CTDs in other games. Only use this on non-gaming workstations with 32 GB+ RAM dedicated to file I/O workloads." },
    { id: "DisablePagefileEncryption", title: "Disable Pagefile Encryption", desc: "Removes AES-128 encryption overhead on pagefile.sys reads/writes.", impact: "LOW" },
    { id: "ClearPagefileOnShutdown", title: "Clear Pagefile on Shutdown", desc: "Wipes pagefile when PC shuts down — minor privacy and fragmentation benefit.", impact: "LOW", warning: "Clearing the pagefile on every shutdown adds 10–60 seconds to your shutdown time depending on pagefile size. This is a minor privacy benefit with a real-time cost. It also requires a pagefile to be present — if you disabled virtual memory, this has no effect." },
    { id: "MemDisableHeapTermination", title: "Tune Heap Decommit Threshold", desc: "Sets HeapDeCommitFreeBlockThreshold=0x40000 — reduces memory fragmentation in long game sessions.", impact: "LOW" },
  ];

  const VISUAL_TWEAKS: TweakDef[] = [
    { id: "DisableXboxGameBar", title: "Disable Xbox Game Bar (Registry + Uninstall)", desc: "Prevents Game Bar from injecting into game processes and removes the overlay entirely.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "DisableGameDVR", title: "Disable GameDVR Background Recording", desc: "Stops Windows from recording game footage in background — frees GPU encoder bandwidth.", impact: "HIGH", badge: "RECOMMENDED", recommended: true },
    { id: "EnableHAGS", title: "Enable HAGS (Hardware Accelerated GPU Scheduling)", desc: "Offloads GPU memory scheduling to dedicated VRAM controller — lower frame-time variance.", badge: "RTX 2000+ / RX 6000+", impact: "HIGH", recommended: true },
    { id: "DisablePointerPrecision", title: "Disable Enhance Pointer Precision (Mouse Accel)", desc: "Turns off mouse acceleration entirely for raw input and consistent aim. ⚠️ Some users prefer smooth mouse acceleration in games like FiveM — test before enabling. Use if you want 1:1 mouse-to-screen movement (competitive aim). Skip if you prefer smooth camera tracking.", impact: "HIGH" },
    { id: "SysVisualBestPerf", title: "Set Visual Effects to Best Performance", desc: "Sets Windows visual FX to 'Best Performance' — disables all compositor animations, transparency, thumbnail previews. Frees GPU VRAM and CPU cycles that DWM was consuming. Sets UserPreferencesMask and VisualFXSetting=2.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "SysHibernateOff", title: "Disable Hibernation (Reclaim hiberfil.sys)", desc: "Runs powercfg /h off and removes hiberfil.sys. Reclaims disk space equal to your installed RAM (8–32GB). Fixes Fast Startup issues caused by corrupted hibernate images. Incompatible with Fast Startup — disable that first.", badge: "RECOMMENDED", impact: "MED", recommended: true },
    { id: "SysHypervisorOff", title: "Disable Hyper-V Hypervisor (Recover 3–8% CPU)", desc: "Sets bcdedit hypervisorlaunchtype=off and disables VBS (Virtualization-Based Security). If you don't use WSL2, Docker, or Android emulators, the Hyper-V hypervisor runs silently and taxes every system call with a VM exit overhead. Disabling it frees 3–8% CPU for games. Requires reboot.", badge: "ADVANCED", impact: "HIGH", warning: "This disables Hyper-V and Virtualization-Based Security. If you use WSL2, Docker, or Android emulators, do not enable this — they will stop working until you re-enable it via bcdedit /set hypervisorlaunchtype auto and a reboot." },
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
    ...(hw.isIntelCore && hw.cpuGeneration >= 4 && hw.cpuGeneration <= 8 ? [
      { id: "IntelOldGenPowerOpt", title: "Intel 4th–8th Gen: Disable CPU Frequency Scaling + Power Throttle", desc: "Activates High Performance plan and locks CPU Min/Max processor state to 100%. Also disables Windows Power Throttling — on older Intel CPUs (Haswell through Coffee Lake) with no speed-shift hardware, this prevents the 50–150ms frequency ramp-up delay that causes frame-time spikes when shooting starts. Pair with Disable Core Parking for maximum effect.", badge: "Intel 4th–8th Gen", impact: "HIGH" as const, recommended: true },
    ] : []),
  ];

  const KERNEL_TWEAKS: TweakDef[] = [
    { id: "RegistryNTFSOptimize", title: "NTFS: Disable Last Access Timestamp + 8.3 Filenames", desc: "Disables NtfsDisableLastAccessUpdate (removes per-read disk write), NtfsDisable8dot3NameCreation (no legacy short filenames), and sets MftZoneReservation=2 (12.5% MFT reserve). Reduces disk I/O by ~5-10% during game asset streaming — especially noticeable in GTA V's streaming zones.", badge: "NTFS", impact: "MED" },
    { id: "RegistryIOPageLock", title: "Raise IOPageLockLimit for 16GB/32GB RAM Systems", desc: "Sets IOPageLockLimit based on total RAM — 2GB for 32GB systems, 1GB for 16GB. Allows the kernel to lock more physical pages for DMA/I/O operations. Reduces streaming stutter and improves asset throughput in open-world games. Safe on systems with 16GB+.", badge: "MEMORY", impact: "MED", warning: "Only beneficial on systems with 16 GB+ RAM. On 8 GB or less, raising IOPageLockLimit can starve user-space processes of physical pages." },
    { id: "RegistryDPCLatency", title: "Reduce DPC Latency: AHCI Link Power Off + TSC Clock + No Dynamic Tick", desc: "Disables AHCI link power management (eliminates DPC spikes from storage sleep states), switches boot clock to TSC (lower overhead than HPET), sets TSC sync=enhanced, and disables dynamic tick. Targets DPC latency spikes from 100-500µs down to under 50µs during GTA V streaming.", badge: "KERNEL", impact: "HIGH" },
    { id: "RegistryLargePageHeap", title: "Set Accurate CPU Cache Hints + Disable Superfetch", desc: "Writes SecondLevelDataCache=512KB and ThirdLevelDataCache=16384KB (matching Ryzen 5 3500 L2/L3). Enables Prefetcher mode 3 (App+Boot) and disables Superfetch. Windows uses cache size hints for heap allocation alignment — accurate values reduce cache line conflicts in memory-intensive game threads.", badge: "MEMORY", impact: "LOW" },
  ];

  const ADVANCED_NETWORK_TWEAKS: TweakDef[] = [
    { id: "NetDNSCloudflare", title: "Set DNS to Cloudflare (1.1.1.1)", desc: "Sets primary DNS to 1.1.1.1 and secondary to 1.0.0.1 — faster DNS resolution, lower latency on first-connect to game servers.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "NetDNSGoogle", title: "Set DNS to Google (8.8.8.8)", desc: "Sets primary DNS to 8.8.8.8, secondary to 8.8.4.4 — reliable alternative DNS with global anycast coverage.", impact: "MED" },
    { id: "NetDisableQoS", title: "Disable QoS Packet Scheduler", desc: "Removes the QoS Packet Scheduler protocol binding from adapters — eliminates the 20% bandwidth reservation Windows applies by default.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "NetInterruptModeration", title: "Disable Interrupt Moderation", desc: "Disables NIC interrupt coalescing — each packet triggers an immediate CPU interrupt instead of batching. Reduces ping by 0.5–2ms at the cost of slightly higher CPU usage.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "NetRSSQueues", title: "Maximize RSS Queues", desc: "Sets Receive Side Scaling queue count to maximum — distributes network interrupt processing across all CPU cores.", impact: "MED" },
    { id: "NetAdapterPowerSave", title: "Disable Network Adapter Power Saving", desc: "Prevents the NIC from entering low-power sleep states — eliminates 50–200ms wake latency when packets arrive after idle.", impact: "MED" },
    { id: "NetTCPChimneyOffload", title: "Disable TCP Chimney Offload", desc: "Forces TCP processing back to the OS stack instead of NIC firmware — more consistent latency on modern NICs.", impact: "LOW" },
  ];

  const WIN11_GAMING_TWEAKS: TweakDef[] = [
    { id: "Win11DisableVBS", title: "Disable VBS (Virtualization-Based Security)", desc: "Disables VBS via registry and bcdedit — recovers 5–10% CPU overhead from hypervisor-enforced code integrity checks. Safe to disable on personal gaming PCs.", badge: "WIN11", impact: "HIGH", warning: "Disabling VBS removes memory integrity protection. Only safe on personal gaming PCs — not recommended for enterprise or shared systems." },
    { id: "Win11DisableHVCI", title: "Disable HVCI (Memory Integrity)", desc: "Turns off Hypervisor-Enforced Code Integrity — eliminates kernel-mode validation overhead on every driver call. 3–8% FPS improvement in CPU-bound titles.", badge: "WIN11", impact: "HIGH", warning: "Disabling HVCI allows unsigned or vulnerable kernel drivers to load. Only disable on a personal gaming-only PC." },
    { id: "Win11ParkingCoreOverride", title: "Core Parking Override (MinCores=100%)", desc: "Forces all processor cores to remain unparked via hidden power plan setting — eliminates core wake latency during sudden frame spikes.", badge: "WIN11", impact: "MED" },
    { id: "Win11ProcessorIdleMin", title: "Minimum Processor Idle State (C0 Only)", desc: "Restricts CPU to C0 idle state only — prevents deep C-state transitions that add 2–5ms wake latency during game threads.", badge: "WIN11", impact: "MED" },
  ];

  const PROCESS_TWEAKS: TweakDef[] = [
    { id: "ProcNUMAAware", title: "Enable NUMA-Aware Scheduling", desc: "Hints Windows scheduler to keep game threads on the same NUMA node — reduces cross-node memory latency on multi-CCX Ryzen CPUs.", badge: "RYZEN", impact: "MED" },
    { id: "ProcAffinityFPS", title: "Set Game Affinity to Physical Cores Only", desc: "Configures IFEO to assign game processes to physical cores only (skip hyperthreaded/SMT cores) — reduces context-switch overhead in CPU-bound games.", badge: "SMT", impact: "MED" },
    { id: "ProcMMCSSGaming", title: "MMCSS Gaming Profile: Maximum Priority", desc: "Sets MMCSS (Multimedia Class Scheduler) gaming profile to SchedulingCategory=High, Priority=8, BackgroundOnly=False — Windows reserves CPU time for game threads over all other applications.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "ProcGPUSchedulerHigh", title: "GPU Scheduler Priority: High", desc: "Sets GPU scheduling priority to 8 (High) for game processes via IFEO PerfOptions — ensures GPU work queue is serviced before background compute.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
  ];

  const RISKY_TWEAKS: TweakDef[] = [
    { id: "DisableAutoUpdate", title: "Disable Windows Update Service", desc: "Stops the wuauserv service permanently. Re-enable manually to get security patches. Prevents forced reboots mid-game.", badge: "RISKY", impact: "MED", warning: "This stops Windows from receiving security updates. Your system will not automatically receive patches for newly discovered vulnerabilities. Only enable this if you manually check for updates regularly, or if forced reboots mid-game are a critical issue for you." },
    { id: "DisableDefender", title: "Disable Windows Defender Real-Time Protection", desc: "Disables real-time scanning. Can free 5–15% CPU during heavy I/O loads. Only do this if you have an alternative AV.", badge: "RISKY", impact: "MED", warning: "This removes your real-time antivirus protection. Your PC will no longer actively block malware, ransomware, or malicious downloads. Only enable this if you have a third-party antivirus (such as Malwarebytes, ESET, or Bitdefender) installed and active." },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 w-full pb-10">
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

        <PageGuide pageName="Registry Tweaks" />

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

        {/* Hardware-optimized recommendation banner */}
        {!hw.loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3"
          >
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed space-y-1">
              <p className="text-amber-400 font-semibold">Hardware-Optimized Settings Detected</p>
              <p className="text-zinc-300">
                {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
              </p>
              <p className="text-zinc-500 text-[11px] mt-2">
                💡 Tweak irrelevance: GPU-specific tweaks skip automatically if you don't have that GPU; memory tweaks check your RAM; hardware-specific profiles only show if matched. Just enable "Recommended" for a safe starting point tailored to your PC.
              </p>
            </div>
          </motion.div>
        )}

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

        <div className="space-y-10">
          <Section heading="CPU Scheduling & Timer" tweaks={CPU_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />
          <Section heading="Network & Latency" tweaks={NETWORK_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />

          {/* Memory section with RAM-aware safety note */}
          <div className="space-y-5">
            <Section heading="Memory Management" tweaks={MEMORY_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />
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
          <div className="space-y-5">
            <Section heading="Visual Effects & Gaming" tweaks={VISUAL_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />
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

          <Section heading="Power Plan & BIOS Interface" tweaks={POWER_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />

          <Section heading="Advanced Kernel Tweaks (NTFS / DPC / Memory)" tweaks={KERNEL_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />

          <Section heading="Advanced Network (DNS / QoS / RSS)" tweaks={ADVANCED_NETWORK_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />

          <Section heading="Windows 11 Gaming (VBS / HVCI / Core Parking)" tweaks={WIN11_GAMING_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />

          <Section heading="Process Scheduling (MMCSS / GPU / Affinity)" tweaks={PROCESS_TWEAKS} tweakState={tweaks} onSet={setTweak} smartRecIds={smartRecs.ids} />

          <section>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 mb-4">
              <AlertTriangle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-500">Advanced / Risky — Use with Caution</h3>
                <p className="text-xs text-zinc-400">The tweaks below have real performance benefits but carry risk. Read descriptions carefully.</p>
              </div>
            </div>
            <div className="space-y-5">
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

          <V2TweakSection
            heading="Network — Advanced Tuning"
            accent="blue"
            testIdSuffix="net-advanced"
            ids={["NetDNSCloudflare","NetDNSGoogle","NetDNSQuad9","NetMTUAutotune","NetTCPAutotuneAggressive","NetRSSTuning","NetDisableLargeSendOffload"]}
          />

          <V2TweakSection
            heading="Security Tradeoffs"
            accent="amber"
            testIdSuffix="security-tradeoffs"
            description="These weaken Windows hardening to claw back FPS. On the desktop (Tauri) build, they're gated automatically when a known-incompatible anti-cheat is detected. On the web build, gating depends on which AC-diagnostic toggles you've enabled below."
            ids={["SecDetectVBSStatus","Win11DisableVBS","SecDisableMemoryIntegrity","SecDisableCredentialGuard","SecDisableMitigationsForGames"]}
          />

          <V2TweakSection
            heading="Anti-Cheat Awareness (Diagnostics)"
            accent="purple"
            testIdSuffix="ac-diagnostics"
            description="Web build: these toggles are manual self-reports — flip the ones that match what you actually have installed, and other risky tweaks auto-disable to keep you ban-safe. Desktop (Tauri) build: real anti-cheat services are detected automatically via the kernel bridge. Coverage today: Vanguard blocks 5 kernel-level tweaks (VBS, HVCI, Credential Guard, Memory Integrity, kernel paging). EAC additionally blocks kernel paging. BattlEye and FACEIT detection is wired but no tweaks in V2 trip their gates yet — entries will be added as community reports come in."
            ids={["ACDetectVanguard","ACDetectEAC","ACDetectBattlEyeFACEIT"]}
          />

          <V2TweakSection
            heading="Input & Mouse Polling"
            accent="emerald"
            testIdSuffix="input-polling"
            ids={["InputUSBPollingCheck","InputRawAccelBanner","InputMousePollHzVerify"]}
          />

          <V2TweakSection
            heading="AMD Zen 5 (Ryzen 9000-Series)"
            accent="red"
            testIdSuffix="zen5"
            description="Curve Optimizer guidance, V-Cache pinning, and AGESA C-state policy for Ryzen 9000 / 9000X3D."
            ids={["Zen5CurveOptimizer","Zen5PBOScalarLock","Zen5SMTSchedulerHint","Zen5AGESACStatePolicy","Zen5X3DCachePin"]}
          />

          <V2TweakSection
            heading="Intel Arrow Lake / Lunar Lake (Core Ultra 200)"
            accent="blue"
            testIdSuffix="arrow-lake"
            description="APO opt-in, Thread Director hints, and E-core park policy for Core Ultra 200-series."
            ids={["ArrowAPOOptIn","ArrowThreadDirectorHint","ArrowEcoreParkPolicy","ArrowLunarLakePowerPlan","ArrowITDTelemetryOff"]}
          />
        </div>
      </div>
    </AppLayout>
  );
}
