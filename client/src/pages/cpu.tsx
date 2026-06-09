import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { Cpu, CheckCircle2, AlertTriangle, Zap, Shield, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

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
  icon?: React.ComponentType<{ className?: string }>;
  tweaks: TweakDef[];
  tweakState: Record<string, boolean>;
  onSet: (id: string, val: boolean) => void;
  accentColor?: "red" | "amber" | "blue" | "emerald";
}

function Section({ heading, icon: Icon, tweaks, tweakState, onSet, accentColor = "red" }: SectionProps) {
  const recommended = tweaks.filter(t => t.recommended).map(t => t.id);
  const allOn = recommended.length > 0 && recommended.every(id => tweakState[id]);

  const colorMap = {
    red:     { label: "text-red-500",    btn: "text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 hover:border-red-500/40" },
    amber:   { label: "text-amber-400",  btn: "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40" },
    blue:    { label: "text-blue-400",   btn: "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40" },
    emerald: { label: "text-emerald-400",btn: "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40" },
  };
  const c = colorMap[accentColor];

  return (
    <section>
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className={cn("text-sm font-bold uppercase tracking-wider flex items-center gap-2", c.label)}>
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {heading}
        </h2>
        {recommended.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => recommended.forEach(id => onSet(id, true))} disabled={allOn}
            data-testid={`button-enable-recommended-${heading.replace(/\s+/g, "-").toLowerCase()}`}
            className={cn("text-[10px] font-bold uppercase tracking-wider border px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed", c.btn)}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {allOn ? "Recommended ON" : `Enable Recommended (${recommended.length})`}
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
            onCheckedChange={v => onSet(item.id, v)}
            delay={i + 1}
          />
        ))}
      </div>
    </section>
  );
}

export default function CpuPage() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const isWin11 = os.os === "Windows 11";

  const SCHEDULER_TWEAKS: TweakDef[] = [
    { id: "Win32PrioritySeparation", title: "Win32PrioritySeparation = 26 (Short Variable)", desc: "Sets CPU time-slice quanta to short+variable — the foreground game gets far more CPU attention than background apps. Single most impactful CPU scheduler tweak.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "SetTimerResolution",      title: "Disable Dynamic Tick (0.5ms Timer Precision)", desc: "Runs bcdedit /set disabledynamictick yes — forces the Windows clock to tick constantly at high resolution. Better frame-time consistency and input precision.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "SetResponsiveness",       title: "SystemResponsiveness = 10 (Game-Optimal)", desc: "90% of CPU scheduling goes to the foreground game, 10% kept for background (audio, Discord). 0 breaks audio; 10 is the sweet spot for gaming.", badge: "RECOMMENDED", impact: "MED", recommended: true },
    { id: "GameModeTweaks",          title: "MMCSS Games: High Category, GPU Priority 8", desc: "Writes MMCSS\\Tasks\\Games keys: SchedulingCategory=High, SFIO=High, GPU Priority=8, CPU Priority=6. Windows will always prefer your game over every other process for CPU+GPU time.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "ProcMMCSSGaming",         title: "MMCSS Gaming Profile: Maximum Priority", desc: "Sets the MMCSS Gaming profile's Scheduling Category to High and Background Only to False — Windows reserves dedicated CPU slices for any process that joins the Games task.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "ProcGPUSchedulerHigh",    title: "GPU Scheduler Priority = 8 (High) for Game Exes", desc: "Sets GpuPriority=8 via IFEO PerfOptions for GTA5, FiveM, Valorant, CS2, Fortnite, Apex — GPU work queue is serviced before anything else.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableHungAppDetection", title: "Disable Hung App Detection Delay (5s → instant)", desc: "Removes the 5-second freeze while Windows waits to decide if an app is hung. Crashed processes are killed immediately.", impact: "LOW" },
    { id: "DisableSearchIndexer",    title: "Disable Windows Search Indexer", desc: "Stops the WSearch service. SearchIndexer.exe won't spike disk I/O and CPU during gaming. Re-enable via Services.msc if you need Start Menu search.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableAutoMaintenance",  title: "Disable Automatic Maintenance (No mid-game scans)", desc: "Sets MaintenanceDisabled=1 — prevents Defender scans, disk cleanup, and other scheduled tasks from running mid-session.", impact: "MED" },
  ];

  const POWER_TWEAKS: TweakDef[] = [
    { id: "SetHighPerformancePlan",      title: "Activate Ultimate Performance Power Plan", desc: "Unlocks and applies the hidden Ultimate Performance plan (powercfg -duplicatescheme). Eliminates ALL power-saving frequency scaling — CPU runs at full speed 100% of the time.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "DisableCoreParking",          title: "Disable CPU Core Parking", desc: "Forces all cores to stay active via PowerSettings registry path and powercfg. Parked cores take 1–3ms to wake — this eliminates that latency spike when your game suddenly needs all cores.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "CpuBoostModeAggressive",      title: "Processor Performance Boost Mode = Aggressive", desc: "Sets the Processor Performance Boost Mode powercfg GUID to 2 (Aggressive). CPU ramps to maximum boost frequency instantly on any load spike — eliminates the frequency-ramp delay that causes frame drops at the start of firefights.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "CpuIdleMin100",               title: "Minimum Processor State = 100% (No C-States)", desc: "Forces CPU minimum state to 100% via powercfg — prevents the processor from ever downclocking. On Ryzen 5 3500 this eliminates the 1–2ms frequency wake-up latency. Pairs with Ultimate Performance plan.", impact: "MED" },
    { id: "DisableDynamicTick",          title: "Disable Dynamic Tick (bcdedit)", desc: "Forces constant timer interrupt regardless of idle — reduces scheduler jitter at the cost of ~0.5% idle power. Complements SetTimerResolution.", impact: "MED" },
    { id: "DisablePowerThrottlingAdv",   title: "Disable Power Throttling (Advanced Registry Path)", desc: "Sets PowerThrottlingOff=1 via the specific GUID key path in PowerSettings — disables CPU power throttling at the driver level, not just the policy level.", badge: "NEW", impact: "MED" },
    { id: "DisableUSBSuspend",           title: "Disable USB Selective Suspend", desc: "Prevents Windows from sleeping USB ports mid-session. Eliminates controller input stutter and headset audio glitches caused by USB port power transitions.", impact: "MED", recommended: true },
    { id: "Win11ParkingCoreOverride",    title: "Core Parking Override: MinCores = 100% (Win 11)", desc: "Sets CPMINCORES to 100% via powercfg on Windows 11 — a separate Win11-only power plane that also controls core parking above the registry path.", badge: "WIN11", impact: "MED" },
    { id: "Win11ProcessorIdleMin",       title: "Processor Idle: C0 Only (No Deep Sleep, Win 11)", desc: "Sets IDLEDISABLE=1 and PROCIDLEMIN=100 via powercfg — restricts the CPU to C0 idle state on Win11. Prevents C6/C7 transitions that add 2–5ms wake latency during frame bursts.", badge: "WIN11", impact: "MED" },
  ];

  const GAME_IFEO_TWEAKS: TweakDef[] = [
    { id: "FiveMFullPerfStack",    title: "FiveM / GTA V — Full IFEO Priority Stack", desc: "Applies CpuPriorityClass=3 (AboveNormal), CpuPriorityBoost, DisableEnergyThrottling, ForceForegroundBoost, IoPriority=2, PagePriority=5 to all 13 known FiveM+GTA5 executable variants. Also writes MMCSS Games keys.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "CpuFortniteIFEO",       title: "Fortnite — AboveNormal CPU + IO Priority (IFEO)", desc: "Writes IFEO PerfOptions for FortniteClient-Win64-Shipping.exe, FortniteLauncher.exe, and EpicGamesLauncher.exe: CpuPriorityClass=3, CpuPriorityBoost, ForceForegroundBoost, IoPriority=2, GpuPriority=8.", badge: "FORTNITE", impact: "HIGH", recommended: true },
    { id: "CpuCodIFEO",            title: "Call of Duty — AboveNormal CPU + IO Priority (IFEO)", desc: "Writes IFEO PerfOptions for cod.exe, BlackOpsColdWar.exe, ModernWarfare.exe, MW2, MW3, Warzone.exe, MWIII.exe: AboveNormal CPU priority, boost on, energy throttle off, IoPriority=2.", badge: "COD", impact: "HIGH", recommended: true },
    { id: "CpuGenericGameIFEO",    title: "CS2, Valorant, Apex, Tarkov, PUBG, Rust — IFEO Boost", desc: "Writes AboveNormal IFEO priority for cs2.exe, valorant.exe, r5apex.exe, EscapeFromTarkov.exe, pubg.exe, RustClient.exe, RainbowSix.exe and more — ensures Windows schedules these games above all background apps.", badge: "MULTI-GAME", impact: "HIGH", recommended: true },
    { id: "ProcNUMAAware",         title: "NUMA-Aware Scheduling for Game Processes", desc: "Sets NUMAAware=1 via IFEO for GTA5, FiveM, Valorant, CS2, Fortnite. On Ryzen multi-CCX CPUs this keeps game threads on the same core cluster — reduces cross-CCX latency by 10–40ns per cache miss.", badge: "RYZEN", impact: "MED" },
    { id: "ProcAffinityFPS",       title: "Pin Games to Physical Cores Only (No SMT Pairs)", desc: "Calculates a physical-cores-only affinity mask and applies it to game exes via IFEO + live process update. Reduces context-switch overhead on SMT/HyperThreading CPUs in CPU-bound games.", badge: "SMT", impact: "MED" },
  ];

  const VIRTUALIZATION_TWEAKS: TweakDef[] = [
    { id: "SysHypervisorOff", title: "Disable Hyper-V Hypervisor (Recover 3–8% CPU Overhead)", desc: "Sets bcdedit hypervisorlaunchtype=off + disables VBS registry key. Every Windows system call incurs a hypervisor VM-exit if Hyper-V is running — disabling it frees 3–8% CPU for games. Requires reboot.", badge: "ADVANCED", impact: "HIGH", warning: "This disables Hyper-V, VBS, and WSL2. If you use WSL2, Docker Desktop, or Android emulators they will stop working. Re-enable with: bcdedit /set hypervisorlaunchtype auto" },
    ...(isWin11 ? [
      { id: "Win11DisableVBS", title: "Disable VBS (Virtualization-Based Security) — Win 11", desc: "Disables VBS via registry + bcdedit on Windows 11. VBS wraps the kernel in a hypervisor and validates every driver call — costs 5–10% CPU throughput. Disable on personal gaming PCs with no virtualization needs.", badge: "WIN11", impact: "HIGH", warning: "Removing VBS eliminates memory integrity protection. Only safe on personal gaming PCs — do NOT disable on enterprise or multi-user systems." } as TweakDef,
      { id: "Win11DisableHVCI", title: "Disable HVCI (Memory Integrity) — Win 11", desc: "Turns off Hypervisor-Enforced Code Integrity. HVCI validates kernel-mode code on every driver call — 3–8% FPS improvement in CPU-bound titles. Requires reboot.", badge: "WIN11", impact: "HIGH", warning: "Disabling HVCI allows unsigned or vulnerable kernel drivers to load. Only disable on a dedicated personal gaming PC." } as TweakDef,
    ] : []),
  ];

  const EXPERT_TWEAKS: TweakDef[] = [
    { id: "CpuDisableSpectreMitigation", title: "Disable Spectre/Meltdown Mitigations (Expert Only)", desc: "Sets FeatureSettingsOverride=3 and FeatureSettingsOverrideMask=3 — disables Spectre v1/v2 and Meltdown kernel mitigations. Can recover 2–8% CPU latency in instruction-heavy workloads like open-world streaming. ONLY safe on offline or isolated gaming PCs.", badge: "EXPERT", impact: "HIGH", warning: "⚠ EXPERT ONLY: Disabling Spectre/Meltdown mitigations exposes the CPU to kernel memory disclosure attacks. Only enable on a fully offline gaming rig or if you accept the security tradeoff. Do NOT enable on any PC used for banking, email, or web browsing." },
  ];

  const intelTweaks: TweakDef[] = hw.isIntelCore && (hw.cpuGeneration ?? 0) >= 4 && (hw.cpuGeneration ?? 0) <= 8 ? [
    { id: "IntelOldGenPowerOpt", title: "Intel 4th–8th Gen: Lock Frequency + Disable Throttle", desc: "Activates High Performance plan, locks CPU min/max processor state to 100%, disables Windows Power Throttling. On Haswell–Coffee Lake CPUs (no speed-shift hardware), prevents the 50–150ms frequency ramp delay that causes frame-time spikes when a firefight starts.", badge: "Intel 4th–8th Gen", impact: "HIGH" },
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-8 w-full pb-10">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Cpu className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">CPU Tweaks</h1>
            <p className="text-zinc-500 text-sm">Scheduler, power plan, process priority, and game-specific CPU optimizations</p>
          </div>
        </motion.div>

        <PageGuide pageName="CPU Tweaks" />

        {/* Impact legend */}
        <div className="flex items-center gap-4 px-1 mb-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Impact:</span>
          <span className="flex items-center gap-1 text-[10px] text-red-400"><Zap className="w-3 h-3" />HIGH</span>
          <span className="flex items-center gap-1 text-[10px] text-amber-400"><Zap className="w-3 h-3" />MED</span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-500"><Zap className="w-3 h-3" />LOW</span>
        </div>

        {/* Ryzen callout */}
        {hw.isAmd && !hw.isIntelCore && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center gap-3">
            <Cpu className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[11px] text-zinc-300">
              <span className="font-bold text-red-400">AMD Ryzen detected.</span>{" "}
              NUMA-Aware Scheduling and the Aggressive Boost Mode tweak have the biggest impact on multi-CCX Ryzen CPUs (3500, 3600, 5600X, 7600X). Enable those first.
            </p>
          </motion.div>
        )}

        <Section heading="Scheduler & Priority" icon={Zap} tweaks={SCHEDULER_TWEAKS} tweakState={tweaks} onSet={setTweak} accentColor="red" />
        <div className="border-t border-white/5 pt-8" />
        <Section heading="Power Plan & Core Management" icon={Cpu} tweaks={POWER_TWEAKS} tweakState={tweaks} onSet={setTweak} accentColor="amber" />
        <div className="border-t border-white/5 pt-8" />
        <Section heading="Game Process Priority (IFEO)" icon={Gamepad2} tweaks={GAME_IFEO_TWEAKS} tweakState={tweaks} onSet={setTweak} accentColor="emerald" />
        <div className="border-t border-white/5 pt-8" />
        <Section heading="Virtualization & Security Overhead" icon={Shield} tweaks={VIRTUALIZATION_TWEAKS} tweakState={tweaks} onSet={setTweak} accentColor="blue" />

        {intelTweaks.length > 0 && (
          <>
            <div className="border-t border-white/5 pt-8" />
            <Section heading="Intel CPU Specific" icon={Cpu} tweaks={intelTweaks} tweakState={tweaks} onSet={setTweak} accentColor="blue" />
          </>
        )}

        {/* Expert section */}
        <div className="border-t border-white/5 pt-8" />
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-200/70">
            <span className="font-bold text-amber-400">Expert Zone.</span>{" "}
            The tweaks below carry real security or stability tradeoffs. Read the warning on each before enabling.
          </p>
        </div>
        <Section heading="Expert — Security Mitigations" icon={AlertTriangle} tweaks={EXPERT_TWEAKS} tweakState={tweaks} onSet={setTweak} accentColor="amber" />
      </div>
    </AppLayout>
  );
}
