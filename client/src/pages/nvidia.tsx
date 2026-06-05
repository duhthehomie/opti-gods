import { useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { V2TweakSection } from "@/components/v2-tweak-section";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useToast } from "@/hooks/use-toast";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { MonitorPlay, Check, Cpu, Layers, Radio, AlertTriangle, ShieldAlert, CheckCircle2, X, Thermometer } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const ALL_NVIDIA_IDS = ["NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaOptimizeLatency","NvidiaMaxPerfMode","NvidiaShaderCache","NvidiaDisableOverlay","NvidiaLowLatency","NvidiaThreadedOpt","NvidiaForceVSyncOff","NvidiaPowerMizer","EnableHAGS","EnableMSIMode","NvidiaAnisoFiltering","NvidiaTripleBufferOff","NvidiaReflexEnable","NvidiaGSyncOptimize","NvidiaOpenGLOpt","NvidiaVRAMMax","NvShaderDiskCache","NvTextureFilterPerf","NvFXAADriverOff","NvidiaCUDAPriority","NvidiaShaderCacheUnlimited","NvidiaFrameBufferOpt","NvidiaDisableAnsel","NvidiaDisableContainerLS","NvidiaDisableShadowPlay","NvTextureFilterHighPerf","NvLowLatencyUltra","NvThreadedOptOn","NvPowerMgmtMax","NvFrameLimitOff","NvFrameLimit30","NvFrameLimit60","NvFrameLimit120","NvFrameLimit144","NvFrameLimit240","NvFrameLimitCustom","EnableMSIMode_Safe"];

// V2.2 — driver-class tweaks that survive game restarts but are wiped on driver
// reinstall. The "Reapply driver tweaks" button re-emits ONLY these as a focused
// PS1 so the user doesn't have to re-download a full preset after a driver update.
const NVIDIA_DRIVER_REAPPLY_TWEAKS = [
  { id: "NvTextureFilterHighPerf", title: "Texture Filtering Quality = High Performance", desc: "Writes PS_TexFilterQuality=0 and aniso optimization flags directly to the NVIDIA GPU class registry — equivalent to setting Texture Filtering Quality to 'High Performance' in NVCP, but persists driver-side. Recovers ~3-5% texture fill rate.", badge: "RECOMMENDED", impact: "MED" as const },
  { id: "NvLowLatencyUltra",       title: "Low Latency Mode = Ultra",                       desc: "Sets RmLowLatencyMode=2 (Ultra) and FlipQueueSize=1 — equivalent to NVCP 'Low Latency Mode: Ultra'. Reduces render-queue depth to 1 frame for the lowest possible input-to-photon latency.", badge: "RECOMMENDED", impact: "HIGH" as const },
  { id: "NvThreadedOptOn",         title: "Threaded Optimization = ON (Global)",            desc: "Sets OGL_ThreadControl=1 and D3D_ThreadControl=1 — forces driver to offload OpenGL/D3D work to a dedicated thread. Default is 'Auto' which the driver sometimes guesses wrong on — forcing ON is correct for ~95% of modern titles.", badge: "RECOMMENDED", impact: "MED" as const },
  { id: "NvPowerMgmtMax",          title: "Power Management Mode = Prefer Max Performance", desc: "Locks PowerMizer to P0 state (PerfLevelSrc=0x2222) so the GPU never drops to lower power states between frames. Eliminates the ~1-2 frame stutter that happens when the GPU upclocks during a transition.", badge: "RECOMMENDED", impact: "HIGH" as const },
  { id: "NvFrameLimitOff",         title: "Frame Rate Limit = OFF (uncapped)",              desc: "Disables the driver-level frame-rate cap. Use this when you want max FPS with no driver limit (game engine / G-Sync handles tearing). Only pick ONE frame-limit option per session.", badge: "OFF",     impact: "LOW" as const },
  { id: "NvFrameLimit30",          title: "Frame Rate Limit = 30 FPS",                      desc: "Driver-level FPS cap at 30 — battery / handheld / cinematic profile. Use on laptops to dramatically extend battery life.", badge: "30",     impact: "MED" as const },
  { id: "NvFrameLimit60",          title: "Frame Rate Limit = 60 FPS",                      desc: "Driver-level FPS cap at 60. Best for 60Hz monitors — eliminates screen tearing without the input-lag cost of V-Sync.", badge: "60Hz",  impact: "MED" as const },
  { id: "NvFrameLimit120",         title: "Frame Rate Limit = 120 FPS",                     desc: "Driver-level FPS cap at 120. Best for 120Hz displays (PS5-class monitors, OLED TVs in HDMI 2.1 mode).", badge: "120Hz", impact: "MED" as const },
  { id: "NvFrameLimit144",         title: "Frame Rate Limit = 144 FPS",                     desc: "Driver-level FPS cap at 144. Best for 144Hz monitors — the sweet spot for high-refresh gaming.", badge: "144Hz", impact: "MED" as const },
  { id: "NvFrameLimit240",         title: "Frame Rate Limit = 240 FPS",                     desc: "Driver-level FPS cap at 240. Best for 240Hz competitive monitors.", badge: "240Hz", impact: "MED" as const },
  { id: "NvFrameLimitCustom",      title: "Frame Rate Limit = Custom (PS1 prompts you)",    desc: "When the PS1 runs, it prompts you to enter any integer FPS cap from 10–1000 (e.g. 165 for 165Hz, 360 for 360Hz). Validated by the script — invalid input is skipped safely.", badge: "CUSTOM",  impact: "MED" as const },
  { id: "EnableMSIMode_Safe",      title: "Safe MSI Mode (multi-device, BSOD-safe)",        desc: "V2.2 replacement for the V1 EnableMSIMode toggle that BSOD'd users on next boot. Enables Message Signaled Interrupts on GPU + active NICs + NVMe controllers, while explicitly WIPING the dangerous DevicePolicy/DevicePriority/AssignmentSetOverride keys. Skips GPU on hybrid iGPU+dGPU systems.", badge: "V2.2 SAFE", impact: "HIGH" as const },
];

async function downloadDriverReapply(tab: 'nvidia' | 'amd', tweakIds: string[]) {
  const res = await fetch(apiUrl('/api/script/driver-reapply'), {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getNativeAuthHeaders() },
    body: JSON.stringify({ tab, tweakIds }),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OptiGods-Reapply-${tab.toUpperCase()}.bat`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
const NVIDIA_RECOMMENDED_IDS = ["NvidiaDisableTelemetry","NvidiaPreRenderedFrames","NvidiaOptimizeLatency","NvidiaLowLatency","NvidiaPowerMizer","EnableHAGS","NvidiaReflexEnable","NvidiaTripleBufferOff","NvidiaAnisoFiltering","NvShaderDiskCache","NvTextureFilterPerf","NvFXAADriverOff","NvidiaCUDAPriority","NvidiaShaderCacheUnlimited","NvidiaFrameBufferOpt"];

const PRESETS = [
  {
    id: "Performance",
    title: "Maximum Performance",
    description: "Sacrifices visual quality for the highest possible framerates and lowest latency. Ideal for competitive shooters.",
    features: ["Texture Filtering: High Perf", "Power Management: Max", "Low Latency Mode: On", "Shader Cache: Unlimited", "Triple Buffering: Off"],
  },
  {
    id: "Balanced",
    title: "Balanced",
    description: "The default Opti Gods recommendation. Keeps games looking good while removing unnecessary driver overhead.",
    features: ["Texture Filtering: Quality", "Power Management: Optimal", "Low Latency Mode: On", "Shader Cache: Unlimited", "Anisotropic Filtering: x8"],
  },
  {
    id: "Quality",
    title: "High Quality",
    description: "For single-player games where visual fidelity is more important than raw frames.",
    features: ["Texture Filtering: High Quality", "Power Management: Adaptive", "Anisotropic Filtering: x16", "DLSS: Quality Mode"],
  },
];

const NVIDIA_TWEAKS = [
  {
    id: "NvidiaDisableTelemetry",
    title: "Disable NVIDIA Telemetry Services",
    desc: "Stops NvTelemetryContainer and NvDisplayContainerLS — eliminates NVIDIA's background data collection and the CPU spikes it causes during gameplay.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaPreRenderedFrames",
    title: "Limit Pre-Rendered Frames to 1",
    desc: "Sets MaximumPreRenderedFrames=1 in the Games system profile — GPU renders and immediately presents frames, reducing render queue depth and input lag by 1–3 frames.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaOptimizeLatency",
    title: "NVIDIA Latency Stack Optimization",
    desc: "Enables HAGS + sets Games profile to High scheduling category, SFIO High, GPU Priority 8 — complete low-latency GPU pipeline setup in one toggle.",
    badge: "NEW",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaMaxPerfMode",
    title: "Max Performance Mode (Registry Hint)",
    desc: "Applies GraphicsDrivers registry hints to bias the driver toward maximum clock speeds over power saving — reduces GPU boost latency on first frame.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaShaderCache",
    title: "Enable GPU Shader Pre-Caching",
    desc: "Forces shader pre-compilation caching via DirectX registry and NGXCore — eliminates shader compilation stutters the first time you enter a new area or game.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaDisableOverlay",
    title: "Disable NVIDIA Overlay & Container",
    desc: "Suppresses nvcontainer.exe overlay injection and disables GeForce Experience opt-in — removes the in-game overlay overhead from game processes.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaLowLatency",
    title: "Low Latency Mode (Pipeline Minimizer)",
    desc: "Sets GPU priority to 8, Scheduling Category to High, SFIO High, and PreRendered frames to 1 — mirrors NVCP 'Ultra Low Latency' mode via registry. Stacks with Pre-Rendered Frames toggle.",
    badge: "NEW",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaThreadedOpt",
    title: "Threaded Optimization Override",
    desc: "Enables NVIDIA Threaded Optimization via NvTweak registry and DirectX DCA — allows the driver to use multiple CPU threads for draw call submission, improving CPU-bound game performance.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaForceVSyncOff",
    title: "Force VSync Off (Registry Hint)",
    desc: "Clears VSync and triple buffering override keys in the GraphicsDrivers registry and writes VSync=0 to NVIDIA NVTweak policy — removes any forced-on VSync that causes input lag.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaPowerMizer",
    title: "PowerMizer: Prefer Maximum Performance",
    desc: "Scans NVIDIA GPU class keys (000x) and sets PowerMizerLevel=1, PowerMizerLevelAC=1, PerfLevelSrc=0x2222 — forces GPU to run at max clock speeds instead of boosting on demand.",
    badge: "RTX / GTX",
    impact: "HIGH" as const,
  },
  {
    id: "EnableHAGS",
    title: "Enable HAGS (Hardware Accelerated GPU Scheduling)",
    desc: "Offloads GPU VRAM scheduling to dedicated hardware controller — reduces frame-time variance, especially at high FPS. Requires RTX 2000+ or RX 6000+.",
    badge: "RTX 2000+ / RX 6000+",
    impact: "HIGH" as const,
  },
  {
    id: "EnableMSIMode",
    title: "Enable MSI Mode for GPU (Interrupt Mode)",
    desc: "Forces GPU interrupts to use Message Signaled Interrupts instead of line-based — eliminates interrupt sharing with other PCIe devices, reduces DPC latency.",
    impact: "HIGH" as const,
  },
];

const NVIDIA_LOW_END_TWEAKS = [
  {
    id: "NvShaderDiskCache",
    title: "Maximize GPU Shader Disk Cache (GTX 1060/1650/Any NVIDIA)",
    desc: "Sets the NVIDIA shader disk cache to unlimited size via DirectX registry + NvTweak + GPU class key. GTX 1060 and 1650 series stutter heavily the first time entering a new area because Pascal/Turing must compile shaders on-the-fly without a large cache. Enabling this eliminates that stutter — shaders are compiled once and stored permanently.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvTextureFilterPerf",
    title: "Texture Filter Quality = High Performance (VRAM Saver)",
    desc: "Forces texture filtering quality to 'High Performance' mode via NvTweak + GPU class registry. The default 'Quality' setting uses anisotropic filtering on every texture fetch — on GTX 1060 3GB/6GB and GTX 1650 4GB this burns 5-8% more VRAM and costs real FPS. High Performance gives near-identical visual quality with measurably higher frame rates.",
    badge: "GTX 1060 / 1650",
    impact: "HIGH" as const,
  },
  {
    id: "NvFXAADriverOff",
    title: "Disable NVIDIA Driver-Level FXAA Injection",
    desc: "Prevents the NVIDIA driver from injecting FXAA (Fast Approximate Anti-Aliasing) into games without your permission. NVIDIA's driver-level FXAA blurs your image and adds GPU workload — on low VRAM cards this is pure overhead with no benefit. Disabling it via NvTweak + GPU class key restores sharp rendering. Use in-game AA settings instead.",
    badge: "PERFORMANCE",
    impact: "MED" as const,
  },
];

const NVIDIA_ADVANCED_TWEAKS = [
  {
    id: "NvidiaAnisoFiltering",
    title: "Force 16x Anisotropic Filtering (Driver Registry)",
    desc: "Writes AnisotropicDegree=16 directly to the NVIDIA GPU class registry key — forces 16x AF on all games regardless of in-game settings, with near-zero performance cost on modern GPUs.",
    badge: "RECOMMENDED",
    impact: "MED" as const,
  },
  {
    id: "NvidiaTripleBufferOff",
    title: "Disable Triple Buffering",
    desc: "Removes TripleBufferingOverride and sets NVTweak TripleBuffering=0 — reduces the render queue to a double-buffer, lowering frame latency at the cost of very minor smoothness.",
    badge: "RECOMMENDED",
    impact: "MED" as const,
  },
  {
    id: "NvidiaReflexEnable",
    title: "NVIDIA Reflex Registry Hint",
    desc: "Writes Reflex Enable=1 and BoostEnabled=1 to the NVIDIA Reflex key. Pair with the in-game NVIDIA Reflex setting — this registry hint ensures the driver honors the Reflex pipeline, minimizing render queue depth.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaGSyncOptimize",
    title: "G-Sync / VRR Optimized Path",
    desc: "Sets GSyncEnabled=1, VSyncEnabled=0 in NvTweak and clears DisableBlockWrite — configures the NVIDIA driver for clean VRR passthrough. Use when you have a G-Sync or FreeSync monitor with NVIDIA.",
    badge: "G-Sync",
    impact: "MED" as const,
  },
  {
    id: "NvidiaOpenGLOpt",
    title: "OpenGL Threaded Optimization + Frame Queue",
    desc: "Sets OpenGLThreadedOptimizations=1 and OGLFrameMaxAhead=1 in NvTweak — allows the NVIDIA driver to use multiple CPU threads for OpenGL draw submission and caps the render-ahead to 1 frame.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaVRAMMax",
    title: "Remove VRAM Allocation Limit",
    desc: "Clears DedicatedSegmentSize (removes any VRAM cap) and sets VRAMUsage=1 — allows the driver to allocate full VRAM dynamically without hitting artificial soft caps.",
    impact: "LOW" as const,
  },
];

const NVIDIA_NEW_TWEAKS = [
  {
    id: "NvidiaCUDAPriority",
    title: "CUDA GPU Priority: High",
    desc: "Sets CUDA scheduling priority to 0x02 (High) in the driver registry — ensures CUDA compute tasks from games and AI frame generation get GPU time ahead of background compute workloads.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaShaderCacheUnlimited",
    title: "Unlimited Shader Cache Size",
    desc: "Removes the 4GB default shader cache limit by setting ShaderCacheSize=0xFFFFFFFF — prevents shader recompilation in large open-world games like GTA V, Cyberpunk, and Hogwarts Legacy.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaFrameBufferOpt",
    title: "Frame Buffer Optimization (Pre-Rendered=1)",
    desc: "Sets MaxFramesAllowed=1 in the driver frame buffer — caps the render-ahead queue to 1 frame for minimum input-to-display latency. Best paired with NVIDIA Reflex.",
    badge: "RECOMMENDED",
    impact: "HIGH" as const,
  },
  {
    id: "NvidiaDisableAnsel",
    title: "Disable NVIDIA Ansel",
    desc: "Removes the Ansel photo-mode hook from game processes — eliminates the DLL injection overhead and Alt+F2 hotkey conflict in every game.",
    impact: "MED" as const,
  },
  {
    id: "NvidiaDisableContainerLS",
    title: "Disable NvDisplay.Container (LocalSystem)",
    desc: "Stops the heavy NvDisplay.ContainerLocalSystem service that handles telemetry, overlay prep, and container management. Frees 50–150MB RAM and reduces background CPU usage. WARNING: Do NOT stop this service if you use NVIDIA Overlay (Alt+Z) — it causes crash 0x80000003.",
    badge: "ADVANCED",
    impact: "MED" as const,
    warning: "Stopping NvDisplay.ContainerLocalSystem breaks NVIDIA Overlay (Alt+Z / ShadowPlay). Only disable if you never use GeForce Experience overlay features.",
  },
  {
    id: "NvidiaDisableShadowPlay",
    title: "Disable ShadowPlay / Instant Replay",
    desc: "Disables ShadowPlay background recording via registry — frees 200–400MB VRAM and 3–5% GPU encoder bandwidth that ShadowPlay reserves for instant replay.",
    impact: "MED" as const,
  },
];

function NvidiaBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      {text}
    </span>
  );
}

export default function Nvidia() {
  const { tweaks, setTweak, nvidiaPreset, setNvidiaPreset } = useOptimizationStore();
  const { toast } = useToast();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);
  const [dismissedWarning, setDismissedWarning] = useState(false);

  const nvidiaSmartIds = ALL_NVIDIA_IDS.filter(id => smartRecs.ids.has(id));

  const enableAllNvidia = () => {
    nvidiaSmartIds.forEach((k) => setTweak(k, true));
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
              <MonitorPlay className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">NVIDIA Optimizer</h1>
              <p className="text-zinc-500 text-sm">Real registry tweaks + NVCP profile selection for NVIDIA GPUs</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={enableAllNvidia}
            data-testid="button-enable-all-nvidia"
            className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-xs font-bold uppercase tracking-wide"
          >
            Enable All Recommended
          </Button>
        </motion.div>

        <PageGuide pageName="NVIDIA Optimizer" />

        {/* GPU compatibility banner — hybrid-aware: read hw.gpus instead of single-winner flags. */}
        {!hw.loading && (() => {
          const nvidiaGpu = hw.gpus.find((g) => g.vendor === "nvidia");
          const amdDiscrete = hw.gpus.find((g) => g.vendor === "amd" && !g.isIntegrated);
          const intelOrIGpu = hw.gpus.find((g) => g.vendor === "intel" || g.isIntegrated);
          // Show "wrong tab" only when the user genuinely owns no NVIDIA card.
          const showWrongTab = !nvidiaGpu && (amdDiscrete || intelOrIGpu);
          const warnAsAmd = !!amdDiscrete; // AMD discrete trumps Intel/iGPU in the warning style
          const otherName = (amdDiscrete?.name || intelOrIGpu?.name || hw.gpuName);
          return nvidiaGpu ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/20 bg-green-500/5"
              data-testid="banner-nvidia-detected"
            >
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-xs text-zinc-300">
                <span className="text-green-400 font-semibold">NVIDIA GPU detected</span>
                {nvidiaGpu.name && nvidiaGpu.name !== "Unknown GPU" && <span className="text-zinc-500"> — {nvidiaGpu.name}</span>}
                {hw.isHybridGpu && <span className="text-zinc-500"> (hybrid laptop — iGPU also present)</span>}
                . All tweaks on this page apply to your system.
              </p>
            </motion.div>
          ) : !dismissedWarning && showWrongTab ? (
            <AnimatePresence>
              <motion.div
                key="mismatch-banner"
                initial={{ opacity: 0, scale: 0.97, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -4 }}
                className={cn(
                  "relative rounded-2xl overflow-hidden border-2 shadow-2xl",
                  warnAsAmd
                    ? "border-red-500/60 bg-gradient-to-br from-red-950/50 via-zinc-950 to-zinc-900/50 shadow-red-950/30"
                    : "border-zinc-500/50 bg-gradient-to-br from-zinc-900/70 via-zinc-950 to-zinc-900/50"
                )}
                data-testid="banner-nvidia-wrong-tab"
              >
                {/* Top accent bar */}
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1.5",
                  warnAsAmd
                    ? "bg-gradient-to-r from-red-700 via-red-400 to-red-700"
                    : "bg-gradient-to-r from-zinc-600 via-zinc-400 to-zinc-600"
                )} />
                {/* Glow overlay */}
                <div className={cn(
                  "absolute inset-0 pointer-events-none",
                  warnAsAmd ? "bg-gradient-to-br from-red-600/8 to-transparent" : "bg-gradient-to-br from-zinc-500/5 to-transparent"
                )} />
                <div className="relative p-6 md:p-7">
                  {/* Dismiss button */}
                  <button
                    onClick={() => setDismissedWarning(true)}
                    data-testid="button-dismiss-mismatch"
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                    title="Dismiss warning"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex gap-5 items-start">
                    {/* Big icon */}
                    <div className={cn(
                      "shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center border shadow-lg",
                      warnAsAmd
                        ? "bg-red-500/15 border-red-500/40 shadow-red-900/30"
                        : "bg-zinc-700/30 border-zinc-600/40 shadow-zinc-900/30"
                    )}>
                      {warnAsAmd
                        ? <AlertTriangle className="w-8 h-8 text-red-400" />
                        : <ShieldAlert className="w-8 h-8 text-zinc-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-2",
                        warnAsAmd ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30"
                      )}>
                        ⚠ WRONG TAB
                      </div>
                      <h2 className={cn(
                        "text-xl font-black mb-2 leading-tight",
                        warnAsAmd ? "text-red-300" : "text-zinc-200"
                      )}>
                        {warnAsAmd ? "AMD GPU Detected — These Tweaks Won't Work" : "Integrated GPU Only — Use the Right Tab"}
                      </h2>
                      <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                        {warnAsAmd ? (
                          <>
                            <span className="text-white font-bold">{otherName && otherName !== "Unknown GPU" ? otherName : "Your GPU"}</span> is AMD.
                            {" "}NVIDIA registry tweaks write to{" "}
                            <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded font-mono text-zinc-400">4d36e968</code> GPU class keys under the <span className="text-red-300 font-semibold">NVIDIA driver section</span> — on your system those keys don't exist.{" "}
                            <span className="text-red-400 font-bold">Every tweak on this page will silently fail.</span> HAGS and MSI Mode are GPU-agnostic — those two work.
                          </>
                        ) : (
                          <>
                            <span className="text-white font-bold">{otherName && otherName !== "Unknown GPU" ? otherName : "Your GPU"}</span> is integrated graphics only — no NVIDIA card was detected.
                            {" "}NVIDIA driver tweaks write to NVIDIA-specific registry paths — none of those apply to Intel UHD/Iris. Go to the{" "}
                            <span className="text-white font-bold">Integrated Graphics</span> tab — it has Intel-specific TDR, Panel Fitter, Quick Sync, and power state tweaks built for your GPU.
                          </>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={warnAsAmd ? "/amd" : "/integrated-graphics"}
                          className={cn(
                            "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all shadow-lg",
                            warnAsAmd
                              ? "bg-red-600 hover:bg-red-500 text-white shadow-red-900/40"
                              : "bg-zinc-700 hover:bg-zinc-600 text-white shadow-zinc-900/40"
                          )}
                        >
                          → Go to {warnAsAmd ? "AMD Optimizer" : "Integrated GPU Tab"}
                        </a>
                        <button
                          onClick={() => setDismissedWarning(true)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm font-bold transition-all"
                        >
                          Stay here anyway
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null;
        })()}

        <TabSmartBar
          tweakIds={ALL_NVIDIA_IDS}
          recommendedIds={NVIDIA_RECOMMENDED_IDS}
          label="NVIDIA"
          context="These tweaks modify NVIDIA driver registry keys and GPU interrupt modes. They persist across driver updates. HAGS and MSI Mode require a reboot to take effect."
          tips={[
            "Start with Disable Telemetry + Pre-Rendered Frames — both are safe on any NVIDIA GPU.",
            "HAGS (Hardware Accelerated GPU Scheduling) is a big win on RTX 2000+ series cards.",
            "MSI Mode reduces DPC latency — especially noticeable in CPU-bound games.",
          ]}
        />

        {/* V2.2 Reapplicable Driver Tweaks — placed at top so users can re-run them in one click after a driver update. */}
        <section data-testid="section-nvidia-driver-reapply">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Layers className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Reapplicable Driver Tweaks (V2.2)</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const selected = NVIDIA_DRIVER_REAPPLY_TWEAKS.filter(t => tweaks[t.id]).map(t => t.id);
              return (
                <Button
                  variant="ghost" size="sm"
                  data-testid="button-reapply-nvidia-driver"
                  disabled={selected.length === 0}
                  onClick={async () => {
                    try { await downloadDriverReapply('nvidia', selected); toast({ title: "Reapply script downloaded", description: `${selected.length} NVIDIA driver tweak(s) ready to run.` }); }
                    catch (e) { console.error(e); toast({ title: "Reapply failed", description: "Pro session may have expired — re-enter your code.", variant: "destructive" }); }
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {selected.length === 0 ? "Select tweaks first" : `Reapply driver tweaks (${selected.length})`}
                </Button>
              );
            })()}
          </div>
          <p className="text-xs text-zinc-600 px-1 mb-4">These tweaks write to the NVIDIA <code className="text-red-400">Global\NVTweak</code> profile hive. They survive game restarts but are wiped on driver reinstall — click <span className="text-red-400 font-semibold">Reapply driver tweaks</span> after every driver update to re-write only these keys (no full preset rerun needed).</p>
          <div className="space-y-3">
            {NVIDIA_DRIVER_REAPPLY_TWEAKS.map((item, i) => (
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

        {/* Registry Tweaks Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Cpu className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">NVIDIA Registry Tweaks</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const recIds = NVIDIA_TWEAKS.filter(t => t.badge === "RECOMMENDED").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => recIds.forEach(id => setTweak(id, true))}
                  disabled={allOn}
                  data-testid="button-enable-recommended-nvidia-registry"
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ml-1"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                </Button>
              );
            })()}
          </div>
          <div className="space-y-3">
            {NVIDIA_TWEAKS.map((item, i) => (
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

        {/* Advanced Registry Tweaks Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Layers className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Advanced Driver Registry</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const recIds = NVIDIA_ADVANCED_TWEAKS.filter(t => t.badge === "RECOMMENDED").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => recIds.forEach(id => setTweak(id, true))}
                  disabled={allOn}
                  data-testid="button-enable-recommended-nvidia-advanced"
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                </Button>
              );
            })()}
          </div>
          <p className="text-xs text-zinc-600 px-1 mb-4">Direct writes to the NVIDIA GPU class key and NvTweak hive — these go deeper than NVCP and persist across driver reinstalls.</p>
          <div className="space-y-3">
            {NVIDIA_ADVANCED_TWEAKS.map((item, i) => (
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

        {/* New NVIDIA Optimizations */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Layers className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-500">CUDA / Shader / Frame Buffer</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const recIds = NVIDIA_NEW_TWEAKS.filter(t => t.badge === "RECOMMENDED").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => recIds.forEach(id => setTweak(id, true))}
                  disabled={allOn}
                  data-testid="button-enable-recommended-nvidia-new"
                  className="text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Recommended ON" : `Enable Recommended (${recIds.length})`}
                </Button>
              );
            })()}
          </div>
          <p className="text-xs text-zinc-600 px-1 mb-4">CUDA priority, unlimited shader cache, frame buffer caps, and service cleanup — deeper driver-level tuning for maximum FPS.</p>
          <div className="space-y-3">
            {NVIDIA_NEW_TWEAKS.map((item, i) => (
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
                warning={item.warning}
              />
            ))}
          </div>
        </section>

        {/* GTX 1060 / Low-End NVIDIA Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Cpu className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-500">GTX 1060 / Low-End NVIDIA (Pascal/Turing)</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            {(() => {
              const recIds = NVIDIA_LOW_END_TWEAKS.filter(t => t.badge === "RECOMMENDED" || t.badge === "GTX 1060 / 1650").map(t => t.id);
              const allOn = recIds.length > 0 && recIds.every(id => tweaks[id]);
              return (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => recIds.forEach(id => setTweak(id, true))}
                  disabled={allOn}
                  data-testid="button-enable-recommended-nvidia-lowend"
                  className="text-[10px] font-bold uppercase tracking-wider text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {allOn ? "Applied" : `Apply for GTX 1060/1650 (${recIds.length})`}
                </Button>
              );
            })()}
          </div>
          <p className="text-xs text-zinc-600 px-1 mb-4">Deep driver tweaks targeting GTX 10xx/16xx Pascal and Turing VRAM and shader limitations. These go beyond NVCP and persist across driver reinstalls via the GPU class registry key.</p>
          <div className="space-y-3">
            {NVIDIA_LOW_END_TWEAKS.map((item, i) => (
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

        {/* NVCP Profile Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Layers className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">NVCP Profile — Script Preset</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
          </div>
          <p className="text-xs text-zinc-500 px-1 mb-4">The selected profile is baked into your downloaded .ps1 script as registry instructions. These instruct the NVIDIA driver how to behave globally.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRESETS.map((preset, index) => {
              const isSelected = nvidiaPreset === preset.id;
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setNvidiaPreset(preset.id)}
                  data-testid={`card-nvidia-preset-${preset.id.toLowerCase()}`}
                  className={cn(
                    "relative p-6 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col h-full",
                    isSelected
                      ? "bg-red-500/10 border-red-500 shadow-[0_0_20px_-6px_rgba(239,68,68,0.4)]"
                      : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 text-red-500">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                  <h3 className={cn("text-xl font-bold font-display mb-3", isSelected ? "text-white" : "text-zinc-300")}>
                    {preset.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6 leading-relaxed flex-grow">
                    {preset.description}
                  </p>
                  <ul className="space-y-2 mt-auto pt-4 border-t border-white/5">
                    {preset.features.map(feat => (
                      <li key={feat} className="text-xs text-zinc-400 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-red-500/50" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* GPU Thermal Management */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Thermometer className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-400">GPU Thermal Management</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
          </div>
          <p className="text-xs text-zinc-500 px-1 mb-4">
            Optional tweaks that reduce GPU die temperature by disabling hardware components that run on the GPU even when unused.
            HDMI audio codecs, RTX video enhancement, and background container processes all consume GPU power and generate heat — disabling them recovers 1–3°C and a few watts for gaming headroom.
          </p>
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-orange-500/5 border border-orange-500/15">
            <Thermometer className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <span className="text-orange-400 font-semibold">GTX 1650 SUPER owners:</span> Running at 72°C at 28% load? The HDMI audio disable below is your highest-impact fix — it eliminates a constant die-level power draw on your card's small 100W cooler. Expected result: 2–4°C reduction at idle/light load.
              {" "}<span className="text-zinc-500">RTX 2070 SUPER owners:</span> HDMI audio + background container flush are both effective on your 215W card.
            </p>
          </div>
          <div className="space-y-3">
            <TweakRow
              id="NvidiaDisableHDMIAudio"
              title="Disable NVIDIA HDMI Audio Device"
              description="The NVIDIA HDMI audio codec runs directly on the GPU die and draws power even when no audio is routed through it. Disabling the PnP device in Device Manager saves 5–10W and lowers GPU temperature by 1–3°C. Only affects HDMI audio — your Realtek/USB audio is completely unaffected."
              badge="THERMAL"
              impact="MED"
              checked={tweaks["NvidiaDisableHDMIAudio"] || false}
              onCheckedChange={(v) => setTweak("NvidiaDisableHDMIAudio", v)}
              delay={1}
            />
            <TweakRow
              id="NvidiaRTXVideoOff"
              title="Disable RTX Video Super Resolution + RTX HDR"
              description="RTX Video Super Resolution and RTX HDR use tensor cores to upscale and color-grade video in real time, keeping tensor cores active 24/7 during video playback. Applies to RTX 30 and 40 series — RTX 20 series (e.g. RTX 2070 SUPER) has partial support depending on driver. GTX 16 series (e.g. GTX 1650 SUPER) has no tensor cores — registry writes are harmless but have no effect. For RTX 30/40 users: disabling saves real GPU heat and power during video."
              badge="RTX 30/40"
              impact="MED"
              checked={tweaks["NvidiaRTXVideoOff"] || false}
              onCheckedChange={(v) => setTweak("NvidiaRTXVideoOff", v)}
              delay={2}
            />
            <TweakRow
              id="NvidiaGpuBgOptimize"
              title="Flush NVIDIA Background GPU Container Processes"
              description="The NVIDIA container stack (nvcontainer, NVDisplay.Container.exe) occasionally idles with elevated GPU context. This tweak writes a VRR optimization preference and flushes the container processes, reducing background dGPU load for desktop and productivity tasks. NvDisplayContainerLS is intentionally not killed — stopping it breaks NVIDIA Overlay in FiveM."
              badge="OPTIONAL"
              impact="LOW"
              checked={tweaks["NvidiaGpuBgOptimize"] || false}
              onCheckedChange={(v) => setTweak("NvidiaGpuBgOptimize", v)}
              delay={3}
            />
          </div>
        </section>

        <V2TweakSection
          heading="RTX 50-Series / Blackwell"
          accent="purple"
          testIdSuffix="rtx50"
          description="DLSS 4 multi-frame-gen, Reflex 2, sm_120 compute, and Blackwell-specific power & shader-cache tuning. Safe to leave off on older RTX cards."
          ids={["RTX50DLSS4FrameGen","RTX50Reflex2","RTX50PowerModeLock","RTX50ShaderCacheBump","RTX50BlackwellDriverOpt","RTX50ComputeSm120","RTX50NVCPSettings","RTX50NvidiaAppTelemetryOff"]}
        />

        {/* Info panel */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <Radio className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-white font-semibold">AMD GPU?</span> The HAGS toggle (above) works for RX 6000+ series. All other tweaks on this page are NVIDIA-specific. AMD users should use the Registry tab for system-wide performance tweaks.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
