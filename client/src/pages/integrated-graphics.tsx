import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { Monitor, Cpu, Zap, Check, Info, AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";

const ALL_IGPU_IDS = [
  "IGpu_DisableULPS","IGpu_DisableDeepSleep","IGpu_DisableVariBright","IGpu_ForcePerformancePower",
  "IGpu_AmdAntiLag","IGpu_SharedMemoryHint","IGpu_AmdDisableHDCP","IGpu_AmdVegaAudioOff",
  "IGpu_DisableMPO","IGpu_AmdTdrLevel",
  "IGpu_DisableTransparency","IGpu_DisableAnimations","IGpu_DisableHDR","IGpu_DisableNightLight",
  "IGpu_DisableXboxGameBar","IGpu_DisableFullscreenOpt",
  "IGpu_UltimatePerformancePlan","IGpu_MaxProcessorState","IGpu_DisableCoreParking",
  "IGpu_GameModeOn","IGpu_SetTimerResolution","IGpu_NetworkThrottling",
  "IGpu_DisableSysMain","IGpu_CloseBrowserGPU","IGpu_DisableDWMColorSpace",
  "IGpu_DisableHAGSForIGpu",
  "IGpu_Intel_MaxFreq","IGpu_Intel_DisableFreqScaling",
  "IGpu_Intel_TDR","IGpu_Intel_PanelFitter","IGpu_Intel_QSVOff",
];

const AMD_RECOMMENDED = [
  "IGpu_DisableULPS","IGpu_DisableDeepSleep","IGpu_DisableVariBright","IGpu_ForcePerformancePower",
  "IGpu_AmdAntiLag","IGpu_DisableMPO","IGpu_AmdTdrLevel",
  "IGpu_AmdDisableHDCP","IGpu_AmdVegaAudioOff",
  "IGpu_DisableTransparency","IGpu_DisableAnimations",
  "IGpu_UltimatePerformancePlan","IGpu_MaxProcessorState","IGpu_DisableCoreParking",
  "IGpu_GameModeOn","IGpu_DisableHAGSForIGpu","IGpu_NetworkThrottling",
  "IGpu_DisableSysMain","IGpu_DisableXboxGameBar","IGpu_SetTimerResolution",
];

const INTEL_RECOMMENDED = [
  "IGpu_Intel_MaxFreq","IGpu_Intel_DisableFreqScaling","IGpu_Intel_TDR",
  "IGpu_Intel_PanelFitter","IGpu_Intel_QSVOff","IGpu_DisableTransparency",
  "IGpu_DisableAnimations","IGpu_UltimatePerformancePlan","IGpu_MaxProcessorState",
  "IGpu_DisableCoreParking","IGpu_GameModeOn","IGpu_NetworkThrottling",
  "IGpu_DisableSysMain","IGpu_DisableXboxGameBar","IGpu_SetTimerResolution",
  "IGpu_DisableHAGSForIGpu","IGpu_DisableMPO",
];

type Impact = "HIGH" | "MED" | "LOW";
interface TweakDef {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  warning?: string;
  amdOnly?: boolean;
  intelOnly?: boolean;
}

const AMD_DRIVER_TWEAKS: TweakDef[] = [
  {
    id: "IGpu_DisableULPS",
    title: "Disable ULPS (Ultra Low Power State)",
    desc: "The #1 iGPU tweak. Prevents the Vega 8 from entering ultra-low power sleep between frames — eliminates the clock-up delay that causes micro-stutters. Same principle as the discrete GPU ULPS fix, applied directly to the integrated GPU driver key.",
    badge: "CRITICAL",
    impact: "HIGH",
    amdOnly: true,
  },
  {
    id: "IGpu_DisableDeepSleep",
    title: "Disable AMD iGPU Deep Sleep & Thermal Throttle",
    desc: "Writes PP_SclkDeepSleepDisable=1 and PP_ThermalAutoThrottlingEnable=0 to the Vega driver key. Deep sleep causes the iGPU to park its shader array between frames on lightly-loaded scenes — disabling it keeps shader clusters active for instant response. Thermal throttle removal lets the Ryzen die run at sustained boost.",
    badge: "CRITICAL",
    impact: "HIGH",
    amdOnly: true,
  },
  {
    id: "IGpu_DisableVariBright",
    title: "Disable Vari-Bright (AMD Adaptive Brightness)",
    desc: "AMD Vari-Bright dynamically adjusts backlight and GPU clocks to dim the display for 'power savings'. On Vega 8 this causes clock drops mid-frame. Disabling ACEEnabled + VariBrightEnable in the driver key stops the GPU from throttling itself to reduce screen brightness.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    amdOnly: true,
  },
  {
    id: "IGpu_ForcePerformancePower",
    title: "Force Performance Power Profile",
    desc: "Sets PP_PowerProfile=2 (Performance) in the GPU driver key — removes the driver's default tendency to drop Vega 8 clocks for efficiency. Also disables compute preemption which causes latency spikes when the OS interrupts your game's GPU workload.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_AmdAntiLag",
    title: "Enable AMD Anti-Lag for iGPU",
    desc: "Anti-Lag reduces the CPU-GPU pipeline latency by pacing CPU frame submissions to match the GPU render rate. On iGPU systems this is especially impactful since the CPU and GPU share the same silicon die — proper pacing prevents CPU frames from queuing up and increasing input latency.",
    badge: "RECOMMENDED",
    impact: "MED",
    amdOnly: true,
  },
  {
    id: "IGpu_SharedMemoryHint",
    title: "AMD VRAM Large Page Allocation Hint",
    desc: "Writes KMD_EnableInternalLargePage=2 to the Vega driver key, telling the kernel memory manager to allocate larger contiguous memory pages for the iGPU frame buffer. On a system with 8GB or 16GB shared memory, this reduces memory fragmentation and gives the Vega 8 more stable frame buffer access.",
    badge: "ADVANCED",
    impact: "MED",
    amdOnly: true,
  },
  {
    id: "IGpu_AmdDisableHDCP",
    title: "Disable HDCP on Vega 8 Display Output",
    desc: "HDCP (High-bandwidth Digital Content Protection) runs a continuous DRM handshake on your display output. On Vega 8 this is a real per-frame GPU overhead — every frame push through the display pipeline triggers an HDCP check. Disabling DisableHDCP=1 + HdcpSupport=0 in the AMD driver key removes this overhead entirely. Only affects content protection — no impact on gaming or app performance.",
    badge: "RECOMMENDED",
    impact: "MED",
    amdOnly: true,
  },
  {
    id: "IGpu_AmdVegaAudioOff",
    title: "Power-Gate AMD Vega HDMI Audio Co-Processor",
    desc: "The Ryzen 2200G die includes a dedicated HDMI/DP audio block that runs as a separate PCI device. Even when you're not using HDMI audio, this co-processor sits powered up and competes for the same power envelope as the Vega 8 GPU shaders. Disabling its power management + stopping the AtiHDAudioService gives the GPU's shaders more of the APU's shared TDP budget — noticeably improves sustained Vega 8 clocks.",
    badge: "RECOMMENDED",
    impact: "MED",
    amdOnly: true,
    warning: "If you use HDMI/DisplayPort audio output, re-enable this after gaming. Affects HDMI/DP audio only — your motherboard's 3.5mm audio jack is unaffected.",
  },
];

const INTEL_DRIVER_TWEAKS: TweakDef[] = [
  {
    id: "IGpu_Intel_MaxFreq",
    title: "Disable Intel Overlay DS Render + Adaptive VSync",
    desc: "Disables Intel's overlay downsampling renderer and adaptive vsync at the driver level. The overlay DS render is a legacy feature that adds latency on Intel UHD 620/630/750 chips. Adaptive vsync can cause stutter when framerate drops below refresh rate.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    intelOnly: true,
  },
  {
    id: "IGpu_Intel_DisableFreqScaling",
    title: "Disable Intel RC6 Power State (Frequency Scaling)",
    desc: "Sets RC6Enable=0 and DisablePowerWell=1 in the Intel GPU driver key. RC6 is Intel's GPU power state that scales frequency down during idle — this causes the same 'ramp up' latency you see on AMD ULPS. Disabling keeps Intel UHD at max sustained frequency.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    intelOnly: true,
  },
  {
    id: "IGpu_Intel_TDR",
    title: "Extend Intel TDR Timeout (Prevent GPU Reset Crashes)",
    desc: "The default GPU Timeout Detection and Recovery (TDR) delay is 2 seconds — Intel iGPUs can legitimately pause longer during shader compilation in games like Fortnite and Minecraft. Windows triggers a false 'GPU crash' and resets the driver. Extending TdrDelay to 8s and TdrDdiDelay to 8s prevents these resets without disabling crash protection.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    intelOnly: true,
  },
  {
    id: "IGpu_Intel_PanelFitter",
    title: "Disable Intel Panel Fitter (Remove Display Latency Layer)",
    desc: "Intel Panel Fitter is a hardware display scaler that adds a post-processing step to every frame rendered. On Intel UHD 620/630/770/Iris Xe, disabling PanelFitterControl and DitherEnable removes this per-frame processing overhead — noticeably reduces display latency. Only run at your monitor's native resolution for best results.",
    badge: "RECOMMENDED",
    impact: "MED",
    intelOnly: true,
  },
  {
    id: "IGpu_Intel_QSVOff",
    title: "Free iGPU Compute from Intel Quick Sync Reservation",
    desc: "Intel Quick Sync Video reserves a portion of the iGPU's EU (execution unit) budget for hardware video encoding even when you're not encoding anything. Disabling GuC submission and HuC firmware reserve releases these compute units back to your game. Critical on Intel UHD 620 (24 EUs total) — even 2-4 freed EUs is a measurable gain.",
    badge: "ADVANCED",
    impact: "MED",
    intelOnly: true,
  },
];

const SYSTEM_TWEAKS: TweakDef[] = [
  {
    id: "IGpu_DisableMPO",
    title: "Disable Multi-Plane Overlay (MPO)",
    desc: "MPO is a Windows DWM feature that causes screen flickering, black screens, and tearing on many AMD integrated and discrete GPUs. Writing OverlayTestMode=5 to HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm disables MPO — this is a well-known fix that significantly improves display stability on Vega 8 systems.",
    badge: "CRITICAL",
    impact: "HIGH",
  },
  {
    id: "IGpu_AmdTdrLevel",
    title: "Extend GPU TDR Timeout (Vega 8 Crash Prevention)",
    desc: "TDR (Timeout Detection and Recovery) is Windows' watchdog that kills your GPU driver if it stops responding for more than 2 seconds. Vega 8 can legitimately pause for longer than 2s during shader compilation or heavy compute in games like Fortnite — triggering a false 'Video Scheduler Internal Error' BSOD. Extending TdrDelay to 60s and TdrDdiDelay to 60s prevents these crashes without disabling crash detection entirely.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
  {
    id: "IGpu_UltimatePerformancePlan",
    title: "Ultimate Performance Power Plan",
    desc: "Activates the hidden 'Ultimate Performance' power plan. For iGPU users this is critical — the Ultimate plan removes CPU park states, disables CPU frequency scaling under load, and forces maximum AMD boost clocks on the Ryzen die. The iGPU frequency is directly tied to the CPU power plan.",
    badge: "CRITICAL",
    impact: "HIGH",
  },
  {
    id: "IGpu_MaxProcessorState",
    title: "Force 100% CPU Max / 5% Min Processor State",
    desc: "Sets the power plan's CPU min to 5% and max to 100%. The 5% minimum prevents Windows from scaling below desktop clock while idle (saving power), while the 100% max removes any power-based frequency cap. On Ryzen 2200G the iGPU clocks scale directly with the CPU power budget.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableCoreParking",
    title: "Disable CPU Core Parking",
    desc: "Forces all 4 Ryzen 2200G cores to stay active. On iGPU systems, parked cores affect both CPU performance AND iGPU compute — the Vega 8's shader array shares scheduling resources with the CPU cores on the same die. Unparking all cores maximizes available compute bandwidth.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableSysMain",
    title: "Disable SysMain (Superfetch)",
    desc: "SysMain pre-loads frequently-used application data into RAM to speed up launches. On systems with 8GB total RAM where the iGPU steals 512MB–2GB as VRAM, SysMain competes for the remaining RAM. Disabling it frees memory directly for the iGPU frame buffer and game assets.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableHAGSForIGpu",
    title: "Disable HAGS for iGPU",
    desc: "Hardware Accelerated GPU Scheduling (HAGS) is designed for discrete NVIDIA RTX 2000+ and AMD RX 6000+ GPUs. On integrated graphics (Vega 8, UHD 620/750) it introduces scheduling overhead and can INCREASE input latency. This disables HwSchMode — the opposite of what discrete GPU users should do.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    warning: "This disables HAGS which is correct for iGPU. If you also have a discrete GPU, check if disabling HAGS affects it too.",
  },
  {
    id: "IGpu_GameModeOn",
    title: "Enable Windows Game Mode",
    desc: "Windows Game Mode tells the OS to prioritize the foreground game for both CPU and GPU resources. On iGPU systems where CPU and GPU share power budget, this is especially effective — it reduces background process interference and improves frame consistency.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
  {
    id: "IGpu_SetTimerResolution",
    title: "Set Platform Tick (Timer Resolution)",
    desc: "Enables platform clock ticks for tighter frame timing. On iGPU systems where CPU and GPU render in the same silicon, precise timer resolution reduces scheduling jitter — the GPU doesn't have to wait through a sloppy timer tick to start the next frame.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
  {
    id: "IGpu_NetworkThrottling",
    title: "Disable Network Throttling Index",
    desc: "Removes Windows' artificial cap on network interrupt processing. On iGPU systems the CPU handles all GPU tasks AND network — enabling this removes a CPU interrupt bottleneck that can cause micro-stutters during online gaming.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
];

const VISUAL_TWEAKS: TweakDef[] = [
  {
    id: "IGpu_DisableTransparency",
    title: "Disable Transparency Effects",
    desc: "Windows transparency effects (Start menu blur, taskbar blur, context menus) require the iGPU compositor to render gaussian blur passes continuously. On Vega 8 with limited VRAM bandwidth, this directly competes with your game's frame rendering. Disabling saves measurable GPU bandwidth.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableAnimations",
    title: "Disable All Desktop Animations",
    desc: "Minimizes the full Windows visual effects suite — window animations, fade transitions, taskbar effects. Each animation is a GPU draw call from the DWM compositor. On integrated graphics every iGPU draw call saved is a frame for your game.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableXboxGameBar",
    title: "Disable Xbox Game Bar + Game DVR",
    desc: "Game Bar and DVR maintain a rolling GPU buffer for instant replay capture. On iGPU systems this buffer consumes VRAM and requires continuous GPU encoding — on Vega 8 with 512MB–2GB shared VRAM, this is a significant overhead tax. Disabling frees the GPU encoder entirely.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableFullscreenOpt",
    title: "Disable Fullscreen Optimizations",
    desc: "Fullscreen Optimizations forces games into 'borderless fullscreen' mode even when they request exclusive fullscreen. On iGPU, exclusive fullscreen gives the game direct GPU control and eliminates DWM compositor overhead. This is a major win for iGPU gaming performance.",
    badge: "RECOMMENDED",
    impact: "HIGH",
  },
  {
    id: "IGpu_DisableHDR",
    title: "Disable HDR for Playback",
    desc: "HDR processing requires the iGPU to handle tone mapping and color space conversion on every frame. This uses both GPU shader time and memory bandwidth. Disabling HDR for playback lets the iGPU skip tone mapping entirely — significant on Vega 8 which has limited shader throughput.",
    badge: "RECOMMENDED",
    impact: "MED",
  },
  {
    id: "IGpu_DisableNightLight",
    title: "Disable Night Light (Color Filter)",
    desc: "Windows Night Light applies a color temperature filter using a GPU shader pass on every frame. On iGPU this adds a consistent shader overhead — small but measurable on Vega 8. Disabling removes this color correction GPU cost.",
    badge: "LOW RISK",
    impact: "LOW",
  },
  {
    id: "IGpu_DisableDWMColorSpace",
    title: "Reduce DWM Color Processing Overhead",
    desc: "Adjusts the Desktop Window Manager's DPI scaling version hint to minimize per-frame color processing. Reduces compositor overhead on iGPU systems where the DWM shares the same GPU resources as your game.",
    badge: "ADVANCED",
    impact: "LOW",
  },
];

const ADVANCED_TWEAKS: TweakDef[] = [
  {
    id: "IGpu_CloseBrowserGPU",
    title: "Close Hardware-Accelerated Browsers Before Gaming",
    desc: "Chrome, Edge, and Firefox all use hardware-accelerated GPU rendering — meaning they are actively using your iGPU's VRAM and shader array even when minimized. This tweak kills running browser processes to free iGPU resources. Run this before your gaming session, reopen browsers after.",
    badge: "SESSION BOOST",
    impact: "HIGH",
    warning: "This closes Chrome, Edge, and Firefox immediately. Save your tabs first. They will need to be reopened after gaming.",
  },
];

function SectionHeader({ title, icon: Icon, desc, onApplyAll, count }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  onApplyAll?: () => void;
  count?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Icon className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5 max-w-lg">{desc}</p>
        </div>
      </div>
      {onApplyAll && (
        <Button size="sm" variant="outline"
          className="shrink-0 text-[10px] h-7 px-3 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          onClick={onApplyAll}>
          <Check className="w-3 h-3 mr-1" />
          Enable Recommended
          {count !== undefined && <span className="ml-1 text-purple-300">({count})</span>}
        </Button>
      )}
    </div>
  );
}

export default function IntegratedGraphics() {
  const { tweaks, setTweak, setAllTweaks } = useOptimizationStore();
  const hw = useHardwareInfo();
  const { toast } = useToast();
  const osInfo = useOsDetection();

  // Read the new hw.gpus list so hybrid laptops (Intel iGPU + NVIDIA dGPU,
  // or AMD APU + NVIDIA dGPU) correctly surface the iGPU here — even when
  // hw.gpuName resolves to the primary discrete card.
  const intelIGpuEntry = hw?.gpus?.find((g) => g.vendor === "intel" && g.isIntegrated);
  const amdApuEntry = hw?.gpus?.find((g) => g.vendor === "amd" && g.isIntegrated);
  const isIntelIGpu = !!intelIGpuEntry;
  const isAmdIGpu = !!amdApuEntry;
  const hasBothIGpus = isIntelIGpu && isAmdIGpu; // rare but possible (e.g. Ryzen APU + Intel Arc as iGPU passthrough)
  const isAnyIGpu = isAmdIGpu || isIntelIGpu || (!hw?.isNvidia && !hw?.isAmd);

  const enabledCount = ALL_IGPU_IDS.filter(id => tweaks[id]).length;

  function applyRecommended(ids: string[]) {
    ids.forEach(id => setTweak(id, true));
    toast({
      title: `${ids.length} tweaks enabled`,
      description: "Recommended integrated graphics optimizations applied. Generate your script to apply.",
    });
  }

  function applyAmdRecommended() {
    applyRecommended(AMD_RECOMMENDED);
  }

  function applyIntelRecommended() {
    applyRecommended(INTEL_RECOMMENDED);
  }

  function applyAll() {
    const all = isIntelIGpu
      ? INTEL_RECOMMENDED
      : AMD_RECOMMENDED;
    applyRecommended(all);
  }

  function applySection(ids: string[]) {
    ids.forEach(id => setTweak(id, true));
    toast({ title: `${ids.length} tweaks enabled`, description: "Generate your script to apply." });
  }

  const detectedGPU = hw?.gpuName || "Detecting...";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 w-full">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Monitor className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-white tracking-tight">Integrated Graphics</h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 border border-purple-500/25 text-purple-300 uppercase tracking-widest">
                  AMD Vega + Intel UHD
                </span>
              </div>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed max-w-2xl">
                Ungatekeeping every hidden optimization for AMD Ryzen APU (Vega 8 / Vega 11) and Intel UHD / Iris integrated graphics. These tweaks are specifically engineered for shared CPU+GPU silicon — the secret sauce for maximizing FPS without sacrificing stability.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Detection Banner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {hw?.gpuName ? (
            <div className={cn(
              "rounded-xl border p-4 flex items-start gap-3",
              hasBothIGpus
                ? "bg-gradient-to-r from-purple-950/30 to-blue-950/30 border-purple-500/20"
                : isAmdIGpu
                ? "bg-purple-950/30 border-purple-500/20"
                : isIntelIGpu
                ? "bg-blue-950/30 border-blue-500/20"
                : "bg-zinc-900/60 border-white/5"
            )} data-testid="banner-igpu-detected">
              <CheckCircle2 className={cn("w-4 h-4 mt-0.5", hasBothIGpus ? "text-purple-300" : isAmdIGpu ? "text-purple-400" : isIntelIGpu ? "text-blue-400" : "text-zinc-500")} />
              <div>
                <p className="text-sm font-bold text-white">
                  {hasBothIGpus
                    ? "Intel + AMD iGPUs Detected"
                    : isAmdIGpu
                    ? "AMD iGPU Detected"
                    : isIntelIGpu
                    ? "Intel iGPU Detected"
                    : "GPU Detected"}
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    {hasBothIGpus
                      ? `${intelIGpuEntry?.name} + ${amdApuEntry?.name}`
                      : isAmdIGpu
                      ? amdApuEntry?.name
                      : isIntelIGpu
                      ? intelIGpuEntry?.name
                      : detectedGPU}
                  </span>
                  {hw?.isHybridGpu && !hasBothIGpus && (
                    <span className="ml-2 text-[10px] font-normal text-zinc-500 uppercase tracking-wider">(hybrid — discrete GPU also present)</span>
                  )}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {hasBothIGpus
                    ? "Both AMD Vega and Intel UHD/Iris integrated graphics are present — both sets of tweaks apply to your system."
                    : isAmdIGpu
                    ? "AMD Ryzen APU detected — AMD-specific tweaks are highlighted. All AMD Vega tweaks apply to your system."
                    : isIntelIGpu
                    ? "Intel integrated GPU detected — Intel UHD/Iris tweaks apply to your system."
                    : "Enable the tweaks that match your GPU type. AMD tweaks are for Ryzen APUs (Vega 8/11/Vega GFX), Intel tweaks are for UHD/Iris graphics."}
                </p>
                <div className="flex gap-2 mt-3">
                  {(isAmdIGpu || (!isIntelIGpu && !isAmdIGpu)) && (
                    <Button size="sm"
                      className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={applyAmdRecommended}>
                      <Zap className="w-3 h-3 mr-1" />
                      Apply AMD Recommended ({AMD_RECOMMENDED.length})
                    </Button>
                  )}
                  {(isIntelIGpu || (!isAmdIGpu && !isIntelIGpu)) && (
                    <Button size="sm"
                      className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={applyIntelRecommended}>
                      <Zap className="w-3 h-3 mr-1" />
                      Apply Intel Recommended ({INTEL_RECOMMENDED.length})
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-zinc-300">Detecting your GPU...</p>
                <p className="text-xs text-zinc-500 mt-0.5">GPU info loads from your system scan. If it takes long, reload and run the system scan from the dashboard.</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Smart Bar */}
        <TabSmartBar
          tweakIds={ALL_IGPU_IDS}
          recommendedIds={isIntelIGpu ? INTEL_RECOMMENDED : AMD_RECOMMENDED}
          label="Integrated Graphics"
          context={isAmdIGpu ? "AMD Vega 8 / Ryzen APU" : isIntelIGpu ? "Intel UHD / Iris" : "iGPU"}
          impactLabel="iGPU Optimization Score"
          applyLabel="Apply iGPU Recommended"
        />

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tweaks Enabled", value: enabledCount, total: ALL_IGPU_IDS.length, color: "text-purple-400" },
            { label: "iGPU Type", value: isAmdIGpu ? "AMD Vega" : isIntelIGpu ? "Intel UHD" : "iGPU", color: "text-white" },
            { label: "Sections", value: "5", color: "text-purple-300" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-white/5 bg-zinc-900/40 p-3 text-center">
              <p className={cn("text-xl font-black", stat.color)}>
                {stat.value}{stat.total ? <span className="text-sm text-zinc-600">/{stat.total}</span> : ""}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Section 1: AMD Driver-Level Tweaks */}
        {(!isIntelIGpu || isAmdIGpu) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl border border-purple-500/15 bg-gradient-to-br from-purple-950/20 via-black to-zinc-900/40 p-5">
            <SectionHeader
              title="AMD Driver-Level Tweaks"
              icon={Layers}
              desc="Secret registry keys inside the AMD GPU driver class — these are the tweaks AMD's engineers left accessible but never documented for consumers. Targeting the Vega 8 / Vega 11 driver subkey directly."
              onApplyAll={() => applySection(AMD_DRIVER_TWEAKS.map(t => t.id))}
              count={AMD_DRIVER_TWEAKS.length}
            />
            <div className="space-y-1">
              {AMD_DRIVER_TWEAKS.map(tweak => (
                <TweakRow
                  key={tweak.id}
                  id={tweak.id}
                  title={tweak.title + (tweak.amdOnly ? " [AMD Only]" : "")}
                  description={tweak.desc}
                  badge={tweak.badge}
                  impact={tweak.impact}
                  checked={!!tweaks[tweak.id]}
                  onCheckedChange={(v) => setTweak(tweak.id, v)}
                  warning={tweak.warning}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Section 2: Intel Driver Tweaks */}
        {(!isAmdIGpu || isIntelIGpu) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl border border-blue-500/15 bg-gradient-to-br from-blue-950/20 via-black to-zinc-900/40 p-5">
            <SectionHeader
              title="Intel Driver-Level Tweaks"
              icon={Layers}
              desc="Registry keys inside the Intel GPU driver class. These disable Intel UHD / Iris frequency scaling and overlay renderer — the Intel equivalents of AMD's ULPS fix."
              onApplyAll={() => applySection(INTEL_DRIVER_TWEAKS.map(t => t.id))}
              count={INTEL_DRIVER_TWEAKS.length}
            />
            <div className="space-y-1">
              {INTEL_DRIVER_TWEAKS.map(tweak => (
                <TweakRow
                  key={tweak.id}
                  id={tweak.id}
                  title={tweak.title + (tweak.intelOnly ? " [Intel Only]" : "")}
                  description={tweak.desc}
                  badge={tweak.badge}
                  impact={tweak.impact}
                  checked={!!tweaks[tweak.id]}
                  onCheckedChange={(v) => setTweak(tweak.id, v)}
                  warning={tweak.warning}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Section 3: System & Power */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
          <SectionHeader
            title="System, CPU & Power Plan"
            icon={Cpu}
            desc="These tweaks target the power plan, CPU scheduling, and Windows services that directly affect iGPU performance. On iGPU systems, your CPU power budget IS your GPU power budget — these settings matter more than on discrete GPU systems."
            onApplyAll={() => applySection(SYSTEM_TWEAKS.map(t => t.id))}
            count={SYSTEM_TWEAKS.length}
          />
          <div className="space-y-1">
            {SYSTEM_TWEAKS.map(tweak => (
              <TweakRow
                key={tweak.id}
                id={tweak.id}
                title={tweak.title}
                description={tweak.desc}
                badge={tweak.badge}
                impact={tweak.impact}
                checked={!!tweaks[tweak.id]}
                onCheckedChange={(v) => setTweak(tweak.id, v)}
                warning={tweak.warning}
              />
            ))}
          </div>
        </motion.div>

        {/* Section 4: Visual & Compositor */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
          <SectionHeader
            title="Visual Effects & DWM Compositor"
            icon={Monitor}
            desc="Every visual effect on Windows runs through the Desktop Window Manager, which uses your iGPU. On Vega 8 / Intel UHD with limited VRAM bandwidth, reducing compositor workload is a direct FPS gain — not just a cosmetic change."
            onApplyAll={() => applySection(VISUAL_TWEAKS.map(t => t.id))}
            count={VISUAL_TWEAKS.length}
          />
          <div className="space-y-1">
            {VISUAL_TWEAKS.map(tweak => (
              <TweakRow
                key={tweak.id}
                id={tweak.id}
                title={tweak.title}
                description={tweak.desc}
                badge={tweak.badge}
                impact={tweak.impact}
                checked={!!tweaks[tweak.id]}
                onCheckedChange={(v) => setTweak(tweak.id, v)}
                warning={tweak.warning}
              />
            ))}
          </div>
        </motion.div>

        {/* Section 5: Advanced / Session */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-950/20 via-black to-zinc-900/40 p-5">
          <SectionHeader
            title="Advanced & Session Boosts"
            icon={Zap}
            desc="Aggressive tweaks that provide significant one-time gains before a gaming session. Some close background apps or make system-level changes — read each description carefully."
          />
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300/80">These tweaks are safe but make noticeable system changes. Read each description before enabling.</p>
          </div>
          <div className="space-y-1">
            {ADVANCED_TWEAKS.map(tweak => (
              <TweakRow
                key={tweak.id}
                id={tweak.id}
                title={tweak.title}
                description={tweak.desc}
                badge={tweak.badge}
                impact={tweak.impact}
                checked={!!tweaks[tweak.id]}
                onCheckedChange={(v) => setTweak(tweak.id, v)}
                warning={tweak.warning}
              />
            ))}
          </div>
        </motion.div>

        {/* #1 Resolution Tip — prominent callout */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="relative rounded-xl overflow-hidden border border-purple-500/30 bg-gradient-to-r from-purple-950/30 via-black to-zinc-900/40">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            <div className="p-4 flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Biggest Single FPS Gain</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-[9px] font-bold text-purple-300 uppercase">Do This First</span>
                </div>
                <p className="text-sm font-black text-white leading-snug">Set your in-game resolution to <span className="text-purple-400">1280×720</span></p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Integrated GPUs share system RAM as VRAM — they have a fraction of the bandwidth of a dedicated card. Dropping from 1080p to 720p cuts the number of pixels your iGPU has to push by <span className="text-white font-semibold">more than half</span>, which translates directly into higher, more stable framerates. Most games still look perfectly playable at 720p on a laptop or small monitor screen.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                  <span className="px-2 py-1 rounded-lg bg-zinc-900/80 border border-white/5 text-zinc-400">Right-click Desktop → Display Settings → change your resolution</span>
                  <span className="px-2 py-1 rounded-lg bg-zinc-900/80 border border-white/5 text-zinc-400">Or set it per-game in the in-game graphics menu</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tips */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="rounded-xl border border-white/5 bg-zinc-900/30 p-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">iGPU Gaming Tips</p>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { tip: "Set in-game FPS cap to 5–10 below max stable", reason: "Prevents GPU from pegging 100% which causes thermal throttle" },
                { tip: "In-game graphics: set shadows to Low or Off", reason: "Shadow rendering is extremely VRAM/bandwidth intensive on iGPU" },
                { tip: "Try 1280×720 first — upgrade to 900p if it looks too rough", reason: "720p is the sweet spot: biggest FPS gain, still playable on most screens" },
                { tip: "Close RGB software (iCUE, Armoury Crate, etc.)", reason: "RGB controller software uses GPU resources for color rendering" },
                { tip: "Set RAM to XMP/EXPO in BIOS", reason: "iGPU bandwidth is directly tied to RAM speed — DDR4-3200+ is a major win" },
                { tip: "Increase iGPU VRAM allocation in BIOS", reason: "Most BIOS menus let you assign 1–2GB dedicated — look under Advanced/APU" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/50">
                  <Check className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">{item.tip}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <PageGuide pageName="Integrated Graphics" />
      </div>
    </AppLayout>
  );
}
