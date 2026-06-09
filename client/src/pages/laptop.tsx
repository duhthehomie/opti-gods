import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Laptop, Cpu, Zap, Wifi, Battery, Thermometer, Monitor, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

type Impact = "HIGH" | "MED" | "LOW";
interface TweakDef {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  warning?: string;
  amdOnly?: boolean;
  nvidiaOnly?: boolean;
  intelOnly?: boolean;
  recommended?: boolean;
}

const POWER_TWEAKS: TweakDef[] = [
  {
    id: "Lap_UltimatePerformance",
    title: "Ultimate Performance Power Plan",
    desc: "Installs and activates the hidden Ultimate Performance power plan (powercfg -duplicatescheme). Eliminates all power-saving states on AC — CPU stays at max clock, no park, no scaling. The single biggest performance unlock on any laptop.",
    badge: "CRITICAL",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_DisableCoreParking",
    title: "Disable CPU Core Parking",
    desc: "Sets CpuConcurrencyHeartbeatInterval to 0 and CORE_PARKING_MIN_CORES_POLICY to 100. Stops Windows from parking CPU cores mid-game — all cores stay awake at all times on AC.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_DisableThrottleStates",
    title: "Disable Throttle States (AC Only)",
    desc: "Writes ThrottleStatesDisabled=1 to the active power scheme. Prevents Windows from reducing CPU clock speeds during load spikes. Critical for laptops that thermally throttle and cause stutters during gaming.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_MaxProcessorStateAC",
    title: "Max Processor State 100% (AC)",
    desc: "Forces ProcessorThrottleMaximum to 100 on AC. Combined with Ultimate Performance, ensures the CPU is never artificially capped below its boost limit while plugged in.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_DisableTurboOnBattery",
    title: "Processor 99% Cap on Battery",
    desc: "Sets ProcessorThrottleMaximum to 99 on DC (battery). Disables Turbo Boost on battery — counter-intuitively this gives smoother FPS on battery because turbo causes thermal throttle which drops performance far below base. Consistent 99% > unstable 100% + crashes.",
    badge: "SMART",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_DisableAdaptiveBrightness",
    title: "Disable Adaptive Display Brightness",
    desc: "Turns off Windows adaptive brightness and ambient light sensors. Prevents the screen dimming mid-game which causes visual distraction and forces the GPU to re-render color profiles.",
    impact: "LOW",
  },
  {
    id: "Lap_DisableHibernate",
    title: "Disable Hibernate & Fast Startup",
    desc: "powercfg /h off + DisableFastShutdown=1. Hibernate writes RAM to disk on every shutdown which wears SSDs and causes slow POST times. Fast Startup can cause system state corruption that appears as random performance degradation.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
];

const AMD_LAPTOP_TWEAKS: TweakDef[] = [
  {
    id: "Lap_AMD_DisableULPS",
    title: "Disable ULPS — AMD Radeon iGPU/dGPU",
    desc: "Writes EnableULPS=0 across all AMD driver subkeys. Ultra Low Power State causes your Radeon GPU to fully clock-down between frames, then ramp up — creating the signature AMD stutter. Disabling ULPS keeps the GPU at operational clocks constantly.",
    badge: "CRITICAL",
    impact: "HIGH",
    amdOnly: true,
    recommended: true,
  },
  {
    id: "Lap_AMD_DisableVariBright",
    title: "Disable Vari-Bright (AMD Adaptive Display)",
    desc: "Sets ACEEnabled=0 and VariBrightEnable=0 in the AMD driver key. Vari-Bright throttles GPU clocks to dim your display — removing it eliminates a whole class of clock drops that masquerade as thermal throttle.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    amdOnly: true,
    recommended: true,
  },
  {
    id: "Lap_AMD_DisableDeepSleep",
    title: "Disable AMD GPU Deep Sleep",
    desc: "Sets PP_SclkDeepSleepDisable=1 in the Radeon performance key. Deep sleep parks GPU shader arrays between frames. On laptops with shared memory bandwidth this means every new frame has to wake sleeping compute clusters, adding 5-20ms frame delay.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    amdOnly: true,
    recommended: true,
  },
  {
    id: "Lap_AMD_DisableDynamicVoltage",
    title: "Disable AMD Dynamic Voltage Control",
    desc: "Writes PP_GFX_ACG_DSM_MASK=0 and DalTMDSBypassControl=0. Dynamic voltage control causes micro-stutters as the GPU scales voltage up/down. Laptops are especially sensitive because the thermal envelope is tighter — voltage spiking causes brief throttle events.",
    impact: "MED",
    amdOnly: true,
  },
  {
    id: "Lap_AMD_ForcePerformance",
    title: "Force AMD Performance Power State",
    desc: "Sets PP_ForceState=1 in the Radeon PM key. Forces the GPU to stay in its highest performance power state on AC rather than letting the driver decide. Eliminates the 'ramp up delay' AMD GPUs have when going from idle to load.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    amdOnly: true,
    recommended: true,
  },
];

const NVIDIA_LAPTOP_TWEAKS: TweakDef[] = [
  {
    id: "Lap_NVIDIA_MaxPerformance",
    title: "NVIDIA Max Performance Mode (Registry)",
    desc: "Writes PowerMizerEnable=0 and PerfLevelSrc=0x2222 to the NVIDIA GPU registry key. Overrides PowerMizer to stay at max performance state rather than downclocking between frames. Works even on Max-Q variants to push them past their default TGP limits.",
    badge: "CRITICAL",
    impact: "HIGH",
    nvidiaOnly: true,
    recommended: true,
  },
  {
    id: "Lap_NVIDIA_DisableVsync",
    title: "Force VSync Off — NVIDIA",
    desc: "Sets VRSyncEnable=0 in the NVIDIA profile registry key. VSync locks your framerate to your monitor refresh rate and adds 1-2 frames of input lag. Disabling via registry ensures it stays off even if software resets it.",
    impact: "MED",
    nvidiaOnly: true,
    recommended: true,
  },
  {
    id: "Lap_NVIDIA_LowLatency",
    title: "NVIDIA Ultra Low Latency Mode",
    desc: "Writes NvCplLowLatencyMode=1 to the NVIDIA profile. NVIDIA's 'Reflex' equivalent via registry — submits only one frame to the render queue instead of buffering. Reduces total input-to-pixel latency by 20-33% compared to default.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    nvidiaOnly: true,
    recommended: true,
  },
  {
    id: "Lap_NVIDIA_ThreadedOpt",
    title: "NVIDIA Threaded Optimization On",
    desc: "Sets NvCplThreadedOptimization=1. Allows the NVIDIA driver to spread CPU-side driver work across multiple threads. On laptop CPUs with fewer cores this prevents the driver thread from becoming a bottleneck at high FPS.",
    impact: "MED",
    nvidiaOnly: true,
  },
  {
    id: "Lap_NVIDIA_DisableMaxQThrottle",
    title: "Reduce Max-Q TGP Throttle (Registry)",
    desc: "Adjusts D3PCLatency and RM_SET_CLOCK_THROTTLE_REASON_THERMAL in the NVIDIA display key. Max-Q laptops have aggressive power limits that throttle the GPU below its physical capability. This loosens the software-enforced limit, letting the GPU reach its true performance.",
    badge: "MAX PERFORMANCE",
    impact: "HIGH",
    nvidiaOnly: true,
  },
];

const INTEL_LAPTOP_TWEAKS: TweakDef[] = [
  {
    id: "Lap_Intel_DisableTurboLimits",
    title: "Override Intel PL1/PL2 Power Limits",
    desc: "Sets TurboBoostPowerMax and TurboBoostShortPowerMax to maximum via powercfg. Intel laptops throttle the CPU after 28-56 seconds of full load by dropping from PL2 (boost TDP) to PL1 (sustained TDP). Removing this limit lets the CPU hold boost clocks indefinitely.",
    badge: "CRITICAL",
    impact: "HIGH",
    intelOnly: true,
    recommended: true,
  },
  {
    id: "Lap_Intel_DisableSpeedShift",
    title: "Disable Intel Speed Shift Latency",
    desc: "Sets SpeedShift minimum performance to 100% in the active power plan. Speed Shift lets the CPU clock drop to minimum between frames — eliminating this floor keeps the CPU ready to execute game logic instantly.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    intelOnly: true,
    recommended: true,
  },
  {
    id: "Lap_Intel_DisableECores",
    title: "Deprioritize E-Cores for Gaming (12th Gen+)",
    desc: "Sets preferred affinity mask to prefer P-cores for foreground applications on Intel 12th gen+ hybrid architecture. Games built for single-threaded performance degrade when scheduled to E-cores. This forces the game process to P-cores without disabling E-cores entirely.",
    impact: "MED",
    intelOnly: true,
  },
];

const NETWORK_TWEAKS: TweakDef[] = [
  {
    id: "Lap_Net_DisableNagle",
    title: "Disable Nagle's Algorithm (TcpNoDelay)",
    desc: "Sets TcpAckFrequency=1 and TCPNoDelay=1. Nagle's algorithm batches small packets to reduce bandwidth overhead — at the cost of 40-200ms of artificial latency per packet. Disabling it is the #1 network tweak for competitive gaming and FiveM.",
    badge: "CRITICAL",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_Net_DisableThrottle",
    title: "Disable Network Throttling Index",
    desc: "Sets NetworkThrottlingIndex=0xFFFFFFFF and SystemResponsivenessIndex=0 in MMCSS. Windows throttles network packets during multimedia tasks. This removes that throttle and gives game traffic full system priority.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_Net_DisableAutoTuning",
    title: "Fix TCP Auto-Tuning (Normal)",
    desc: "netsh int tcp set global autotuninglevel=normal. Locks TCP auto-tuning to 'normal' mode instead of letting Windows randomly adjust it. Prevents the random bandwidth drops that appear as ping spikes mid-game.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_Net_OptimizeDNS",
    title: "DNS Cache Optimization",
    desc: "Sets MaxCacheTtl=86400 and MaxNegativeCacheTtl=0 in the DNS cache key. Forces DNS results to be cached for 24 hours and disables negative caching. Eliminates DNS lookup delays on repeated connections to game servers.",
    impact: "MED",
  },
  {
    id: "Lap_Net_DisableUSBSelSuspend",
    title: "Disable USB Selective Suspend",
    desc: "Disables selective suspend for all USB controllers via power scheme. USB Selective Suspend puts your USB ports (including wired peripherals) into a sleep state to save power. On laptops this causes mouse/keyboard stutter and controller disconnect during gaming.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_Net_WiFiPerfMode",
    title: "Wi-Fi Adapter Performance Mode",
    desc: "Sets the wireless adapter to Max Performance via power management policy. By default Windows allows the Wi-Fi adapter to throttle its power to save battery — this causes the ping spikes that make online gaming feel inconsistent on laptops over Wi-Fi.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_USBPowerSave",
    title: "Force Disable USB Suspend — Power Scheme + Registry",
    desc: "Dual-path USB fix: disables selective suspend via both the active power scheme AND writes DisableSelectiveSuspend=1 to the USB services registry key. The power scheme alone can revert on some laptops — the registry key makes it permanent regardless of power plan. Eliminates mouse/keyboard drops that the softer fix misses.",
    badge: "DEEP FIX",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_WifiPerfMode",
    title: "Disable Wi-Fi Power Save — Driver Registry (Deep)",
    desc: "Writes PowerSaveMode=0 and PnPCapabilities=24 directly to the Wi-Fi adapter's driver class registry key. Unlike the netsh power management command, this registry path survives driver reinstalls and persists after power plan changes. Disabling Wi-Fi power save at the driver level removes the ~50-200ms latency spikes on budget Wi-Fi cards.",
    badge: "DEEP FIX",
    impact: "HIGH",
    recommended: true,
  },
];

const LATENCY_TWEAKS: TweakDef[] = [
  {
    id: "Lap_TimerResolution",
    title: "Set System Timer to 0.5ms",
    desc: "Sets the Windows multimedia timer to its minimum resolution (0.5ms) using NtSetTimerResolution. The default timer fires every 15.6ms — meaning thread wake-ups, game loops, and audio callbacks are delayed up to 15ms unnecessarily. At 0.5ms your game loop wakes on time every frame.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_DisablePowerThrottling",
    title: "Disable Windows Power Throttling",
    desc: "Sets PowerThrottlingOff=1 in the registry and EcoQoSLevel=0. Windows 10/11 background power throttling can misclassify your game process and reduce its CPU allocation. Disabling it ensures the OS never throttles your game thread.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "Lap_DisableXboxGameBar",
    title: "Disable Xbox Game Bar & DVR",
    desc: "Sets AppCaptureEnabled=0 and GameDVR_Enabled=0. Game Bar intercepts GPU present calls, injecting 2-5ms of latency per frame. On laptops with integrated graphics this is especially significant — the iGPU cannot afford the overhead.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_DisableFullscreenOpt",
    title: "Disable Fullscreen Optimizations",
    desc: "Sets DisableFullscreenOptimizations=1 globally. Windows FSO replaces true exclusive fullscreen with a borderless overlay — adding DWM latency. True exclusive fullscreen gives the game direct hardware access with no compositor in the path.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_MMCSS_Games",
    title: "Boost MMCSS Game Task Priority",
    desc: "Sets Games scheduling priority in MMCSS to 6 (Guaranteed), GPU priority to 8, and SFIO to 8. MMCSS is the multimedia scheduler — setting game processes to Guaranteed class ensures they preempt other threads without being preempted.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_DisableMPO",
    title: "Disable Multi-Plane Overlay (MPO)",
    desc: "Sets DisableMPO=1 in the DirectX graphics key. MPO causes black screens, flickering, and stutter on many AMD and Intel laptop GPUs when mixed with third-party software (Discord, OBS, overlays). Disabling it is a safety net for all laptop GPUs.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "Lap_VisualPerformance",
    title: "Adjust for Best Performance (Visual Effects)",
    desc: "Sets VisualFXSetting=2 in SystemProfile. Disables animations, shadows, and visual chrome that consume GPU compute and VRAM on integrated and entry-level discrete GPUs. On laptops with iGPUs and low VRAM (1-4GB) this frees 100-300MB of VRAM for the game.",
    impact: "MED",
  },
  {
    id: "Lap_DisableHAGS",
    title: "Disable Hardware-Accelerated GPU Scheduling",
    desc: "Sets HwSchMode=1 (disabled) in the graphics drivers key. HAGS is beneficial on desktop RTX 30/40 but causes stutter and latency on laptop GPUs (especially GTX 16xx and older Radeons). Disabling it removes DWM scheduling latency on affected hardware.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
];

const ALL_LAPTOP_IDS = [
  ...POWER_TWEAKS.map(t => t.id),
  ...AMD_LAPTOP_TWEAKS.map(t => t.id),
  ...NVIDIA_LAPTOP_TWEAKS.map(t => t.id),
  ...INTEL_LAPTOP_TWEAKS.map(t => t.id),
  ...NETWORK_TWEAKS.map(t => t.id),
  ...LATENCY_TWEAKS.map(t => t.id),
];

const ALL_RECOMMENDED = [
  ...POWER_TWEAKS.filter(t => t.recommended).map(t => t.id),
  ...AMD_LAPTOP_TWEAKS.filter(t => t.recommended).map(t => t.id),
  ...NVIDIA_LAPTOP_TWEAKS.filter(t => t.recommended).map(t => t.id),
  ...INTEL_LAPTOP_TWEAKS.filter(t => t.recommended).map(t => t.id),
  ...NETWORK_TWEAKS.filter(t => t.recommended).map(t => t.id),
  ...LATENCY_TWEAKS.filter(t => t.recommended).map(t => t.id),
];

function Section({
  icon: Icon,
  title,
  subtitle,
  tweaks,
  gpuFilter,
  recommended,
  color = "text-red-400",
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  tweaks: TweakDef[];
  gpuFilter?: { isNvidia: boolean; isAMD: boolean; isIntel: boolean } | null;
  recommended?: string[];
  color?: string;
}) {
  const { tweaks: store, toggleTweak, setTweak } = useOptimizationStore();
  const { toast } = useToast();

  const visible = tweaks.filter(t => {
    if (!gpuFilter) return true;
    if (t.amdOnly && !gpuFilter.isAMD) return false;
    if (t.nvidiaOnly && !gpuFilter.isNvidia) return false;
    if (t.intelOnly && !gpuFilter.isIntel) return false;
    return true;
  });

  if (visible.length === 0) return null;

  const recIds = (recommended ?? []).filter(id => visible.some(t => t.id === id));
  const enabled = recIds.filter(id => store[id as keyof typeof store]);

  function enableRec() {
    recIds.forEach(id => setTweak(id as any, true));
    toast({ title: `✓ ${recIds.length} recommended tweaks enabled` });
  }

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Icon className={cn("w-4 h-4", color)} />
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-[10px] text-zinc-500">{subtitle}</p>
          </div>
        </div>
        {recIds.length > 0 && (
          <button
            onClick={enableRec}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors",
              enabled.length === recIds.length
                ? "border-green-500/30 text-green-400 bg-green-500/5"
                : "border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10"
            )}
          >
            <Check className="w-2.5 h-2.5" />
            {enabled.length === recIds.length ? "All Recommended On" : `Enable Recommended (${recIds.length})`}
          </button>
        )}
      </div>
      <div className="divide-y divide-white/[0.03]">
        {visible.map(t => (
          <TweakRow
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.desc}
            badge={t.badge}
            impact={t.impact}
            warning={t.warning}
            checked={!!store[t.id as keyof typeof store]}
            onCheckedChange={() => toggleTweak(t.id as any)}
          />
        ))}
      </div>
    </div>
  );
}

export default function LaptopPage() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const osInfo = useOsDetection();
  const smartRecs = computeSmartRecs(hw, osInfo);
  const { toast } = useToast();

  const enableAll = () => {
    ALL_RECOMMENDED.forEach(id => setTweak(id as any, true));
    toast({ title: `✓ ${ALL_RECOMMENDED.length} recommended tweaks enabled for your laptop` });
  };

  const enabledCount = ALL_LAPTOP_IDS.filter(id => tweaks[id as keyof typeof tweaks]).length;

  const gpuFilter = hw.loading ? null : { isNvidia: hw.isNvidia, isAMD: hw.isAMD, isIntel: hw.isIntel };

  const hasAMD = hw.isAMD;
  const hasNVIDIA = hw.isNvidia;
  const hasIntel = hw.isIntel && !hw.isAMD && !hw.isNvidia;

  return (
    <AppLayout>
      <div className="flex flex-col gap-0">
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-5 bg-gradient-to-r from-zinc-900/80 to-transparent">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <Laptop className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">Laptop Optimizer</h1>
                <p className="text-xs text-zinc-500">Full laptop optimization — thermal, GPU, network, latency</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">{enabledCount}/{ALL_LAPTOP_IDS.length} enabled</span>
              <button
                onClick={enableAll}
                disabled={hw.gpuName === "Detecting..." || hw.loading}
                title={hw.gpuName === "Detecting..." ? "Run Instant Scan first" : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Zap className="w-3 h-3" />
                Enable All Recommended
              </button>
            </div>
          </div>

          {/* Hardware-optimized settings */}
          {!hw.loading && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3"
            >
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed space-y-1">
                <p className="text-amber-400 font-semibold">Hardware-Optimized Laptop Settings</p>
                <p className="text-zinc-300">
                  {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
                </p>
              </div>
            </motion.div>
          )}

          {/* Detection Banner */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
              hasAMD ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
            )}>
              <div className={cn("w-2 h-2 rounded-full", hasAMD ? "bg-red-400" : "bg-zinc-700")} />
              AMD Radeon — {hasAMD ? `Detected: ${hw.gpuName}` : "Not Detected"}
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
              hasNVIDIA ? "border-green-500/30 bg-green-500/5 text-green-300" : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
            )}>
              <div className={cn("w-2 h-2 rounded-full", hasNVIDIA ? "bg-green-400" : "bg-zinc-700")} />
              NVIDIA — {hasNVIDIA ? `Detected: ${hw.gpuName}` : "Not Detected"}
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
              "border-zinc-800 bg-zinc-900/40 text-zinc-400"
            )}>
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              CPU — {hw.loading ? "Detecting..." : hw.cpuLabel || "Unknown"}
            </div>
          </div>

          {hw.scanned && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-400">
              <Check className="w-3 h-3" />
              Scan data loaded — GPU-specific tweaks filtered for your hardware
            </div>
          )}
          {!hw.scanned && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500">
              <AlertTriangle className="w-3 h-3" />
              Run the scan tool for hardware-specific filtering. All tweaks shown until then.
            </div>
          )}
        </div>

        {/* Tweak Sections */}
        <div className="p-4 flex flex-col gap-4">
          <Section
            icon={Battery}
            title="Power Plan & Thermal"
            subtitle="The most impactful laptop tweaks — eliminate throttle, maximize AC performance"
            tweaks={POWER_TWEAKS}
            gpuFilter={gpuFilter}
            recommended={ALL_RECOMMENDED}
            color="text-yellow-400"
          />

          {(hasAMD || !hw.scanned) && (
            <Section
              icon={Zap}
              title="AMD Radeon Laptop — GPU Tweaks"
              subtitle="Vega, RDNA1/2/3 iGPU and dGPU — ULPS, VariBright, deep sleep elimination"
              tweaks={AMD_LAPTOP_TWEAKS}
              gpuFilter={null}
              recommended={ALL_RECOMMENDED}
              color="text-red-400"
            />
          )}

          {(hasNVIDIA || !hw.scanned) && (
            <Section
              icon={Monitor}
              title="NVIDIA Laptop — Max-Q / Max-P"
              subtitle="GTX 16xx, RTX 20/30/40 laptop — override TGP limits, low latency, PowerMizer"
              tweaks={NVIDIA_LAPTOP_TWEAKS}
              gpuFilter={null}
              recommended={ALL_RECOMMENDED}
              color="text-green-400"
            />
          )}

          {(hasIntel || !hw.scanned) && (
            <Section
              icon={Cpu}
              title="Intel CPU / Arc — Power Limits"
              subtitle="12th–14th gen Alder/Raptor/Meteor Lake — PL1/PL2 removal, E-core affinity"
              tweaks={INTEL_LAPTOP_TWEAKS}
              gpuFilter={null}
              recommended={ALL_RECOMMENDED}
              color="text-blue-400"
            />
          )}

          <Section
            icon={Wifi}
            title="Network & Wi-Fi"
            subtitle="Nagle off, USB suspend off, Wi-Fi performance mode — eliminate ping spikes on laptop Wi-Fi"
            tweaks={NETWORK_TWEAKS}
            gpuFilter={gpuFilter}
            recommended={ALL_RECOMMENDED}
            color="text-cyan-400"
          />

          <Section
            icon={Thermometer}
            title="Latency & Input Response"
            subtitle="Timer resolution, MMCSS, MPO, Game Bar, fullscreen — eliminate every latency layer between input and frame"
            tweaks={LATENCY_TWEAKS}
            gpuFilter={gpuFilter}
            recommended={ALL_RECOMMENDED}
            color="text-orange-400"
          />
        </div>
      </div>
    </AppLayout>
  );
}
