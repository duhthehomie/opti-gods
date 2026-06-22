import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Gamepad2, Info, CheckCircle2, Download, Package, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageGuide } from "@/components/page-guide";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const ALL_FIVEM_IDS = [
  "FiveMHighPriority","FiveMDisablePhysX","FiveMAffinityMask","FiveMIOPriority","FiveMWorkingSet",
  "FiveMCacheClear","FiveMExtendedMemory","FiveMStreamDistance","FiveMStreamPool","FiveMDisableNvidiaTelemetry","FiveMMenuFpsUncap",
  "FiveMDisableVSync","FiveMNetworkBuffer","FiveMDisableFullscreen","FiveMDisableDWM","FiveMDisableMemCompression","FiveMDisableLSO",
  "FiveMDNSOverride","FiveMDisableP2P","FiveMQueueFix","FiveMEnableRSS",
  "FiveMReduceNPCDensity","FiveMReduceShadowQuality","FiveMCommandLineTweaks",
  "FiveMFullPerfStack","FiveMGTAProcessPerfOptions","FiveMGameModeAdd","FiveMRenderingBoost","FiveMGPUPriorityStack",
  "FiveM1060VRAMFlag","FiveM1060DisableHAGS","FiveM1060AnselDisable","FiveM5600CoreAffinity","FiveM5600PowerPlan",
  "FiveMCitizenDisableMedia","FiveMSteamChildOff","FiveMCommandlineMax","FiveMSteamOverlayOff","FiveMMMCSSAudio",
  "FiveMFixProductId","FiveMFixNvidiaOverlay","FiveMDisableMPO",
  "FiveM1650DisableHAGS","FiveM1650VRAMBudget","FiveM1650DisableAnsel","FiveM1650LowLatencyMode","FiveM1650HAGSOffPack",
  "FiveM3500CoreAffinity","FiveM3500PerfPlan",
  "FiveM2060VRAMBudget","FiveMi5CoreAffinity",
  "FiveMIntel14PcoreAffinity","FiveMIntel14PowerPlan",
  "FiveM5060VRAMBudget","FiveM5060EnableHAGS","FiveM5060LowLatency",
];

type Impact = "HIGH" | "MED" | "LOW";

interface Tweak {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  recommended?: boolean;
}

export default function Fivem() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);
  const [dlMushyFace, setDlMushyFace] = useState(false);

  async function downloadMushyFix() {
    setDlMushyFace(true);
    try {
      const res = await fetch('/api/mushy-face-fix-script');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'OptiGods-MushyFace-Fix.bat';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setDlMushyFace(false), 2500);
    }
  }

  const fivemRecommended = [
    "FiveMHighPriority","FiveMCacheClear","FiveMNetworkBuffer","FiveMQueueFix","FiveMFullPerfStack","FiveMGTAProcessPerfOptions",
    ...(hw.isRyzen && hw.cpuGeneration === 5 && hw.cpuLabel.toLowerCase().includes("5600") ? ["FiveM5600CoreAffinity","FiveM5600PowerPlan"] : []),
    ...(hw.isRyzen && hw.cpuGeneration === 3 && hw.cpuLabel.toLowerCase().includes("3500") ? ["FiveM3500CoreAffinity","FiveM3500PerfPlan"] : []),
    ...(hw.isIntelCore && hw.cpuGeneration === 4 ? ["FiveMi5CoreAffinity"] : []),
    ...(hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1060") ? ["FiveM1060VRAMFlag","FiveM1060DisableHAGS"] : []),
    ...(hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1650") ? ["FiveM1650VRAMBudget","FiveM1650DisableHAGS","FiveM1650LowLatencyMode"] : []),
    ...(hw.gpuName.toLowerCase().includes("2060") ? ["FiveM2060VRAMBudget"] : []),
    ...(hw.isIntelCore && hw.cpuGeneration >= 12 ? ["FiveMIntel14PcoreAffinity","FiveMIntel14PowerPlan"] : []),
    ...(hw.nvidiaIsRTX && hw.gpuName.toLowerCase().includes("5060") ? ["FiveM5060VRAMBudget","FiveM5060EnableHAGS","FiveM5060LowLatency"] : []),
  ];

  const PROCESS_TWEAKS: Tweak[] = [
    { id: "FiveMHighPriority", title: "Force GTA5.exe to High CPU Priority (Persistent)", desc: "Injects IFEO registry keys so Windows always schedules GTA5.exe at High CPU priority — survives restarts.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMDisablePhysX", title: "Disable NVIDIA PhysX GPU Acceleration", desc: "Forces CPU PhysX — reduces VRAM contention on servers with heavy particle effects.", impact: "LOW" },
    { id: "FiveMAffinityMask", title: "Pin GTA5.exe + FiveM.exe to Above Normal Priority", desc: "Sets Above Normal CPU priority for both GTA5.exe and FiveM.exe via IFEO — consistent scheduler priority across both processes.", impact: "MED" },
    { id: "FiveMIOPriority", title: "Set FiveM I/O Priority to High", desc: "Forces streaming disk reads to High I/O priority — faster asset loading on crowded servers.", impact: "MED" },
    { id: "FiveMWorkingSet", title: "Increase GTA5.exe Working Set Limit (4GB)", desc: "Raises the per-process memory ceiling for GTA5.exe to 4GB — reduces streaming model crashes on high-res texture packs.", impact: "MED" },
    ...(hw.isRyzen && hw.cpuGeneration === 5 && hw.cpuLabel.toLowerCase().includes("5600") ? [
      { id: "FiveM5600CoreAffinity", title: "Pin GTA5 + FiveM to Physical Cores Only", desc: "Sets CPU affinity for GTA5.exe and FiveM.exe to physical cores only — skips SMT sibling threads. On Zen 3, GTA V's threading model causes frame-time spikes under SMT load. Forcing it onto the real cores gives tighter, more consistent frametimes.", badge: "CPU AFFINITY", impact: "HIGH" as const },
      { id: "FiveM5600PowerPlan", title: "Apply Optimized CPU Power Plan for Your Processor", desc: "Activates the AMD Ryzen High Performance power plan — removes the governor ramp-up delay that causes clock speed to drop between frames. Keeps boost clocks on for the full GTA V session.", badge: "POWER PLAN", impact: "MED" as const },
    ] : []),
    ...(hw.isRyzen && hw.cpuGeneration === 3 && hw.cpuLabel.toLowerCase().includes("3500") ? [
      { id: "FiveM3500CoreAffinity", title: "Pin GTA5 + FiveM to All Physical Cores (0x3F)", desc: "Sets CPU affinity mask 0x3F for GTA5.exe and FiveM.exe — covers all physical cores. Applied via IFEO so it persists across restarts. Tighter frametimes under CPU load on dense FiveM servers.", badge: "CPU AFFINITY", impact: "HIGH" as const },
      { id: "FiveM3500PerfPlan", title: "Lock CPU to Max Boost (100% Min/Max State)", desc: "Activates High Performance plan and forces Min=100%, Max=100%, BoostMode=Aggressive. Removes the clock ramp-up delay that causes frame-time spikes between shots on 6-core CPUs.", badge: "POWER PLAN", impact: "MED" as const },
    ] : []),
    ...(hw.isIntelCore && hw.cpuGeneration === 4 ? [
      { id: "FiveMi5CoreAffinity", title: "Pin GTA5 + FiveM to All Physical Cores (0xF)", desc: "Sets CPU affinity mask 0xF for GTA5.exe and FiveM.exe — covers all 4 physical cores. Applied via IFEO (CpuPriorityClass=High, IO=High, FgBoost=On, EnergyThrottle=Off). Prevents any background process from stealing a core mid-gunfight.", badge: "CPU AFFINITY", impact: "HIGH" as const },
    ] : []),
    ...(hw.isIntelCore && hw.cpuGeneration >= 12 ? [
      { id: "FiveMIntel14PcoreAffinity", title: `Pin GTA5 + FiveM to P-Cores Only — Skip E-Cores (Intel ${hw.cpuGeneration}th Gen)`, desc: `Intel ${hw.cpuGeneration}th gen has both Performance-cores (fast, HT-enabled) and Efficiency-cores (slower background cores). GTA V's render + physics threads run best on P-cores — pinning to mask 0xFFF (threads 0-11, the 6 P-cores × 2 HT threads) tells Windows to never schedule GTA5.exe or FiveM.exe on an E-core. Eliminates the frametime variance caused by the game landing on a slower E-core thread between frames. Applied persistently via IFEO so it survives restarts.`, badge: "P-CORE AFFINITY", impact: "HIGH" as const },
      { id: "FiveMIntel14PowerPlan", title: `Ultra Performance Power Plan — Intel ${hw.cpuGeneration}th Gen`, desc: `Activates Ultra Performance plan (falls back to High Performance) and pins CPU Min/Max state to 100% with Aggressive boost. Also sets HeteroPolicy=1 so Intel Thread Director aggressively prefers P-cores for all foreground threads. Prevents the 12th/13th/14th gen governor from dropping P-core clocks between frames — the main cause of irregular frametimes on hybrid-core Intel CPUs during GTA V.`, badge: "POWER PLAN", impact: "MED" as const },
    ] : []),
  ];

  const CLIENT_TWEAKS: Tweak[] = [
    { id: "FiveMCacheClear", title: "Auto-Clear FiveM Cache on Startup", desc: "Deletes stale server cache — fixes crashes, texture loss, and connection issues on reboot.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMExtendedMemory", title: "Enable Extended Memory Allocator (FiveM)", desc: "Patches FiveM.exe to Above Normal CPU priority — reducing streaming model crashes on busy servers.", impact: "MED" },
    { id: "FiveMStreamDistance", title: "Cap Streaming Distance (500 units)", desc: "Sets StreamingDistance=500 in CitizenFX.ini — reduces LOD pop-in and micro-stutter on city servers.", impact: "MED" },
    { id: "FiveMStreamPool", title: "Set CitizenFX Stream Pool to 128", desc: "Updates CitizenFX.ini StreamPool setting to 128 — improves streaming stability on high-asset servers.", impact: "MED" },
    { id: "FiveMDisableNvidiaTelemetry", title: "Disable NVIDIA Telemetry Service", desc: "Stops NvTelemetryContainer service — eliminates the background GPU perf overhead it causes.", badge: "NVIDIA ONLY", impact: "MED" },
    { id: "FiveMMenuFpsUncap", title: "Uncap FiveM Menu FPS (legacy — pre-v31050 only)", desc: "Writes nui_maxFramerate 9999 to fivem.cfg and patches your FiveM shortcut with +set fps_max 0. NOTE: FiveM v31050+ (beta/release 2026) locked the nui_maxFramerate convar in production mode — this tweak is no longer effective on current builds. Still applied for in-game fps_max and NVIDIA OpenGL GDI layer on older installs.", badge: "ALL GPUs", impact: "LOW", recommended: false },
  ];

  const WINDOWS_TWEAKS: Tweak[] = [
    { id: "FiveMDisableVSync", title: "Force Disable VSync in Config", desc: "Forces in-game VSync off via config — removes 60fps frame cap on higher refresh monitors.", impact: "HIGH" },
    { id: "FiveMNetworkBuffer", title: "Increase Socket Receive Buffer (512KB)", desc: "Bumps socket send/receive buffers to 512KB — handles high player count server traffic without packet loss.", impact: "HIGH", recommended: true },
    { id: "FiveMDisableFullscreen", title: "Use Windowed Borderless Mode", desc: "Forces borderless windowed mode via CitizenFX.ini — eliminates exclusive fullscreen delays on Alt+Tab.", impact: "LOW" },
    { id: "FiveMDisableDWM", title: "Raise GTA5.exe to High Priority (DWM-Aware)", desc: "Sets GTA5.exe CPU+IO to High priority mode to minimize DWM compositor interference during gameplay.", impact: "MED" },
    { id: "FiveMDisableMemCompression", title: "Disable Windows Memory Compression", desc: "Stops Windows from compressing RAM pages in the background. With 32GB+ RAM this is pure overhead — disabling it frees CPU cycles that GTA V's streaming engine can use instead. Huge help on 6-core CPUs.", badge: "32GB+ RAM", impact: "HIGH", recommended: false },
    { id: "FiveMDisableLSO", title: "Disable Large Send Offload (LSO) — Remove Latency Spikes", desc: "Disables LSO on all active network adapters. LSO batches TCP segments which causes unpredictable 5-30ms spikes on busy FiveM servers. Disabling it makes per-packet latency tighter and more consistent.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
  ];

  const CFX_TWEAKS: Tweak[] = [
    { id: "FiveMDNSOverride", title: "Override CFX DNS to Cloudflare 1.1.1.1", desc: "Points active adapter DNS to 1.1.1.1/1.0.0.1 — faster cfx.re resolution and lower DNS lookup latency.", impact: "MED" },
    { id: "FiveMDisableP2P", title: "Allow Direct P2P Connections", desc: "Enables direct peer connections for lower server ping. Disable on untrusted public servers.", impact: "LOW" },
    { id: "FiveMQueueFix", title: "Game CPU Priority Boost (SystemResponsiveness=10)", desc: "Sets SystemResponsiveness=10 — gives 90% of CPU scheduling to the foreground game while keeping 10% for background apps like Discord and audio. (Previous value of 0 was starving Discord threads causing random crashes — fixed.)", impact: "HIGH", recommended: true },
    { id: "FiveMEnableRSS", title: "Enable RSS — Spread Packet Processing Across CPU Cores", desc: "Enables Receive Side Scaling on all active network adapters and pins the RSS base to CPU core 1 (away from core 0 which handles hardware interrupts). Distributes incoming packet processing across multiple cores — critical on 6-core CPUs in populated FiveM servers.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
  ];

  const GTA_ENGINE_TWEAKS: Tweak[] = [
    { id: "FiveMReduceNPCDensity", title: "Reduce GTA V NPC + Vehicle Density to 15%", desc: "Writes PedDensity=0.15 and TrafficDensity=0.15 to GTA V settings.xml. NPCs are the single biggest CPU cost in populated areas — a server with 32 players + full NPC density will tank a 6-core CPU. This is the highest-impact tweak for pistol FFA and crowded servers.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMReduceShadowQuality", title: "Reduce GTA V Shadow Quality to Minimum", desc: "Sets shadow quality, distance, and softness to 0 in GTA V settings.xml. Shadows are extremely CPU+GPU expensive in GTA V — running minimum quality can gain 15-30 FPS on GTX 1650-class hardware with zero gameplay impact.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMCommandLineTweaks", title: "Optimize GTA V commandline.txt Launch Flags", desc: "Creates/updates GTA V commandline.txt with 4 safe flags: -nomemrestrict (removes VRAM asset ceiling so your GPU uses its full memory budget), -norestrictions (removes engine-level asset limits), -noBlockOnLostFocus (game keeps running when alt-tabbing), -novblank (removes VSync frame lock). Does NOT force -dx11 — letting GTA V choose its own API gives better performance than overriding it.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    ...(hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1060") ? [
      { id: "FiveM1060VRAMFlag", title: "Unlock Full GPU VRAM Budget for GTA V", desc: "Appends -availablevidmem 6144 to GTA V commandline.txt — some GPU setups under-report available VRAM, silently capping texture streaming below what your card can handle. Forces GTA V to use the full budget, improving texture quality and reducing streaming hitches.", badge: "COMMANDLINE", impact: "HIGH" as const },
    ] : []),
    ...(hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1650") ? [
      { id: "FiveM1650VRAMBudget", title: "Unlock Full GPU VRAM Budget for GTA V", desc: "Appends -availablevidmem 4096 -percentvidmem 100 to GTA V commandline.txt. Forces GTA V to use your full VRAM — improves texture quality and reduces hitches on high-asset FiveM servers.", badge: "COMMANDLINE", impact: "HIGH" as const },
    ] : []),
    ...(hw.gpuName.toLowerCase().includes("2060") ? [
      { id: "FiveM2060VRAMBudget", title: "Unlock Full GPU VRAM Budget for GTA V", desc: "Appends -availablevidmem 6144 -percentvidmem 100 to GTA V commandline.txt. Stops GTA V from under-reporting VRAM on some Turing GPU setups — eliminates texture pop-in on high-asset FiveM servers.", badge: "COMMANDLINE", impact: "HIGH" as const },
    ] : []),
    ...(hw.nvidiaIsRTX && hw.gpuName.toLowerCase().includes("5060") ? [
      { id: "FiveM5060VRAMBudget", title: "Unlock Full 8GB VRAM Budget for GTA V (RTX 5060)", desc: "Appends -availablevidmem 8192 -percentvidmem 100 to GTA V commandline.txt. Forces GTA V to use the full 8GB GDDR7 VRAM — eliminates the VRAM under-reporting that causes texture pop-in and hitching on high-asset FiveM servers. Blackwell architecture VRAM management is more aggressive than Turing/Ampere; telling the engine the full budget upfront prevents mid-session texture unloads.", badge: "COMMANDLINE", impact: "HIGH" as const },
    ] : []),
  ];

  const PERF_OPTIONS_TWEAKS: Tweak[] = [
    { id: "FiveMFullPerfStack", title: "Full fivem.exe PerfOptions Stack", desc: "Applies the complete IFEO PerfOptions block to FiveM.exe: AboveNormal CPU(3), CpuPriorityBoost, DisableEnergyThrottling, EnableBoost, ForceForegroundBoost, IoPriority=High, PagePriority=5, rendering preemption disabled, HW acceleration on, power throttle off, unlimited GPU performance.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGTAProcessPerfOptions", title: "GTA Process PerfOptions (All Build Versions)", desc: "Applies AboveNormal CPU(3) + IO=High + EnergyThrottle=Off + FGBoost=On + PagePriority=5 to FiveM_bXXXX_GTAProcess.exe. Uses wildcard matching — covers all installed build numbers automatically.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGameModeAdd", title: "Add FiveM + GTA5 to Windows Game Mode", desc: "Enables Auto Game Mode and whitelists GTA5.exe and FiveM.exe in the Windows Game Mode process registry — ensures Windows grants them priority scheduling automatically.", impact: "MED" },
    { id: "FiveMRenderingBoost", title: "Disable Rendering Preemption (FiveM + GTA5)", desc: "Sets DisableRenderingContextPreemption=1, DisableRenderingPreemption=1, EnableHWAcceleration=1, GpuIdle=0 on both FiveM.exe and GTA5.exe — eliminates GPU preemption micro-stutters during scene transitions.", impact: "HIGH" },
    { id: "FiveMGPUPriorityStack", title: "GPU Priority Stack (GpuPriorityClass=8 + HAGS)", desc: "Sets GpuPriorityClass=8, GPU Priority=8, GpuMaxPerformance=256, GpuThrottling=0 on FiveM.exe and applies GPU Priority=8, MaximumPreRenderedFrames=1 to the system Games multimedia profile.", badge: "NVIDIA/AMD", impact: "HIGH" },
    ...(hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1060") ? [
      { id: "FiveM1060DisableHAGS", title: "Disable Hardware-Accelerated GPU Scheduling", desc: "HAGS adds frame-time variance on older Pascal-gen cards — these GPUs predate HAGS and the scheduler overhead costs more than it saves. Disabling it reduces micro-stutters on populated FiveM servers.", badge: "GPU DRIVER", impact: "HIGH" as const },
      { id: "FiveM1060AnselDisable", title: "Disable NVIDIA Ansel Screenshot Hook", desc: "Stops NVIDIA Ansel from injecting into GTA V every frame — on older cards this overhead is measurable. Disabling it frees a consistent amount of GPU time per frame.", badge: "GPU DRIVER", impact: "MED" as const },
    ] : []),
    ...(hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1650") ? [
      { id: "FiveM1650DisableHAGS", title: "Disable Hardware-Accelerated GPU Scheduling", desc: "HAGS was designed for RTX 2000+ and RX 6000+ — on Turing 16xx cards it adds frame-time variance instead of reducing it. Turning it off is the correct call for GTX 1650 Super. Apply all three companion tweaks below for full stability: Low Latency Ultra + HAGS OFF Pack + DPC fixes. Reboot required.", badge: "GPU DRIVER", impact: "HIGH" as const },
      { id: "FiveM1650DisableAnsel", title: "Disable NVIDIA Ansel Frame Hook", desc: "Sets AnselEnable=0 in NVIDIA registry. Ansel injects into every render frame — disabling removes hook overhead and keeps the display container stable.", badge: "GPU DRIVER", impact: "MED" as const },
      { id: "FiveM1650LowLatencyMode", title: "Low Latency Mode = Ultra (Driver-Level)", desc: "Sets RmLowLatencyMode=2 (Ultra), FlipQueueSize=1, PowerMizer P0 in both the GPU class registry and global NVTweak. Equivalent to NVCP Ultra but applied at the driver level so it survives NVCP resets. Critical companion to HAGS OFF — without it the render queue can back up and cause the 160→60 FPS drop pattern.", badge: "GPU DRIVER", impact: "HIGH" as const },
      { id: "FiveM1650HAGSOffPack", title: "HAGS OFF Stability Pack — DXGI + Frame Pipeline", desc: "Applies three fixes that HAGS OFF requires to work cleanly: (1) DXGI AllowTearing=1 + MaxFrameLatency=1 — enables immediate present without HAGS so frames don't queue up and dump all at once causing the 60 FPS cliff. (2) RenderThrottlingOff=1 + GpuIdleEnabled=0 + PowerSavingVsyncOn=0 on all GTA5/FiveM process IFEO keys — prevents the driver from throttling render submission between heavy frames. (3) MMCSS Games PreRenderedFrames=1 — keeps the system multimedia profile aligned with the driver setting.", badge: "HAGS OFF", impact: "HIGH" as const },
    ] : []),
    ...(hw.nvidiaIsRTX && hw.gpuName.toLowerCase().includes("5060") ? [
      { id: "FiveM5060EnableHAGS", title: "Enable Hardware-Accelerated GPU Scheduling (RTX 5060 — Correct ON)", desc: "Sets HwSchMode=2 (enabled) in the graphics drivers registry. Unlike older Pascal/Turing cards where HAGS hurt frametimes, Blackwell (RTX 5000-series) is architecturally optimized for HAGS — the GPU manages its own DMA work queue without CPU intervention. Reboot required after applying.", badge: "HAGS ON", impact: "HIGH" as const },
      { id: "FiveM5060LowLatency", title: "Low Latency Mode = Ultra + Flip Queue = 1 (RTX 5060)", desc: "Sets RmLowLatencyMode=2 (Ultra) and FlipQueueSize=1 both per-adapter and globally in NVTweak. Equivalent to NVCP Low Latency = Ultra but survives NVCP resets. On GDDR7 RTX 5060, pairing Low Latency Ultra with HAGS ON gives the tightest possible frame-to-display pipeline — the GPU pre-renders exactly 1 frame ahead, eliminating input lag from queued frames.", badge: "GPU DRIVER", impact: "HIGH" as const },
    ] : []),
  ];

  const CRASH_FIX_TWEAKS: Tweak[] = [
    { id: "FiveMFixProductId", title: "Fix: CfxState.h Crash — productId != ProductID::INVALID", desc: "Fixes the 'Assertion failure: productId != ProductID::INVALID (CfxState.h:88)' crash. Root cause: IFEO MitigationOptions or a stale Debugger key on Rockstar/FiveM executables corrupts FiveM's hardware product ID read at startup. This fix clears MitigationOptions + Debugger from IFEO for RockstarGamesLauncher.exe, PlayGTAV.exe, SocialClubHelper.exe, GTA5.exe and FiveM.exe, purges the CfxState priv cache, and re-enables Rockstar Service if it was disabled. Reboot and relaunch FiveM normally after applying.", impact: "HIGH", badge: "CFXSTATE FIX" },
    { id: "FiveMFixNvidiaOverlay", title: "Fix: NVIDIA Overlay.exe 0x80000003 Crash", desc: "Root cause: stopping NVDisplay.ContainerLocalSystem while NVIDIA Overlay.exe is running orphans the overlay process — it throws a 0x80000003 breakpoint exception and crashes FiveM. This fix kills crashed overlay processes, restores the container service if disabled, then blocks the overlay from relaunching via registry. Run this if you see 'NVIDIA Overlay.exe — Application Error — A breakpoint has been reached (0x80000003)'. Reboot once after applying.", impact: "HIGH", badge: "CRASH FIX" },
    { id: "FiveMDisableMPO", title: "Fix: Black Screen at FiveM Server Load-In (Disable MPO)", desc: "Disables Multi-Plane Overlay (MPO) by setting OverlayTestMode=5 in the DWM registry key. MPO causes Windows DWM to conflict with Discord and Steam overlays during the FiveM server transition phase — producing a full black screen. This is the #1 cause of 'black screen when connecting to a server'. Reboot required after applying.", impact: "HIGH", badge: "BLACK SCREEN FIX" },
  ];


  const FIVEM_CLIENT_TWEAKS: Tweak[] = [
    { id: "FiveMCitizenDisableMedia", title: "CitizenFX.ini: Disable In-Game Media Player (GTA Radio)", desc: "Writes disable_media_player=1 to CitizenFX.ini. Kills the NUI Chromium audio thread that streams GTA radio. On 6-core CPUs, this thread competes directly with the render thread — disabling it frees ~2-4% CPU during city driving on high-density FiveM servers.", badge: "CITIZENFX", impact: "MED" },
    { id: "FiveMSteamChildOff", title: "CitizenFX.ini: Disable Steam Child Process Spawner", desc: "Writes steam_child_spawner_disabled=1 to CitizenFX.ini. Prevents FiveM from spawning a child Steam process to validate the session at every server join. Eliminates the IPC handshake delay (~200-400ms) and reduces spawn overhead on first server join.", badge: "CITIZENFX", impact: "MED" },
    { id: "FiveMCommandlineMax", title: "GTA V commandline.txt: Full Unlock (-norestrictions, -nomemrestrict)", desc: "Writes a complete optimized commandline.txt: -norestrictions (removes memory limits), -nomemrestrict (removes VRAM ceiling), -noBlockScripts (allows all FiveM server scripts), -percentvidmem 100 (full VRAM), -nointrovideos/-noIntroCutscene (skip intro). All flags verified safe for FiveM RP and RZ servers.", badge: "COMMANDLINE", impact: "HIGH" },
    { id: "FiveMSteamOverlayOff", title: "Disable Steam Overlay for FiveM", desc: "Sets EnableGameOverlay=0 in Steam registry. Steam overlay hooks every render frame — on GTX 1650 SUPER this adds 0.3-0.8ms of GPU hook overhead per frame. Re-enable in Steam Settings > In-Game if you need overlay features.", badge: "STEAM", impact: "MED" },
    { id: "FiveMMMCSSAudio", title: "MMCSS: Demote Audio Threads, Give Game 100% Scheduler", desc: "Sets SystemResponsiveness=0 (game thread gets 100% of CPU scheduler time) and demotes Audio/Pro Audio MMCSS categories to Medium priority. Discord and Windows audio still work but the game thread is never preempted by audio tasks. Improves frametimes in audio-heavy FiveM scenarios.", badge: "MMCSS", impact: "MED" },
  ];

  function renderSection(heading: string, items: Tweak[]) {
    const recommended = items.filter(t => smartRecs.ids.has(t.id)).map(t => t.id);
    const allRecommendedOn = recommended.length > 0 && recommended.every(id => tweaks[id]);
    return (
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">{heading}</h2>
          {recommended.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recommended.forEach(id => setTweak(id, true))}
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
          {items.map((item, i) => (
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
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 w-full pb-10">
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

        <PageGuide pageName="FiveM Optimizer" />

        {/* Opti Gods Graphics Pack Download */}
        <a
          href="/fivem-graphics"
          className="flex items-center gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0">
            <Package className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Opti Gods Graphics Packs + ReShade Presets</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Blue sky timecycle pack, custom builder, ReShade presets — download directly. Free.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 shrink-0 group-hover:text-red-300 transition-colors">
            <Download className="w-3.5 h-3.5" />
            <span>Open Graphics Hub</span>
          </div>
        </a>

        {/* Mushy Face / Blurry Arms Fix */}
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Visual Fix</span>
            </div>
            <p className="text-sm font-bold text-white leading-tight">Fix Mushy / Blurry Face &amp; Arm Textures</p>
            <p className="text-xs text-zinc-500 mt-0.5">Patches GPU driver · wipes FiveM cache · auto-sets GTA texture quality · scans for conflicting mods</p>
          </div>
          <button
            data-testid="button-download-mushy-face-fix-fivem"
            onClick={downloadMushyFix}
            disabled={dlMushyFace}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-60 border border-orange-500/40 text-white text-xs font-bold transition-colors"
          >
            {dlMushyFace ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Download className="w-4 h-4" />}
            {dlMushyFace ? "Downloaded!" : "Download Fix"}
          </button>
        </div>

        {/* Hardware-optimized recommendation banner */}
        {!hw.loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 flex items-start gap-3"
          >
            <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed space-y-1">
              <p className="text-red-400 font-semibold">Hardware-Optimized FiveM Settings</p>
              <p className="text-zinc-300">
                {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
              </p>
              <p className="text-zinc-500 text-[11px] mt-2">
                💡 Recommended: Start with "Recommended" button below. Hardware-specific tweaks (GTX 1060 section, Ryzen 5600 profile) only show if detected. Network Buffer + Cache Clear are universally safe.
              </p>
            </div>
          </motion.div>
        )}

        <TabSmartBar
          tweakIds={ALL_FIVEM_IDS}
          recommendedIds={fivemRecommended}
          label="FiveM"
          context="These tweaks are applied via PowerShell and target GTA V and FiveM process scheduling, network buffers, and CitizenFX config. Download the script and double-click to run — it requests admin automatically."
          tips={[
            "Start with Recommended — High Priority + Cache Clear are the biggest wins.",
            "Network Buffer tweak reduces packet loss on high-population RP servers.",
            "Clearing cache resets streaming data — expect a slightly longer first join.",
          ]}
        />

        <div className="space-y-10">
          {renderSection("FiveM / GTA V Process", PROCESS_TWEAKS)}
          {renderSection("FiveM Client Optimizations", CLIENT_TWEAKS)}
          {renderSection("GTA V Engine, Graphics & Launch Flags", GTA_ENGINE_TWEAKS)}
          {renderSection("Windows Settings for GTA V", WINDOWS_TWEAKS)}
          {renderSection("CFX / Server Connectivity", CFX_TWEAKS)}
          {renderSection("Advanced PerfOptions — IFEO Registry Stack", PERF_OPTIONS_TWEAKS)}

          {/* Crash Fixes */}
          <section>
            <div className="flex items-center gap-3 mb-4 px-1">
              <div className="flex-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Crash Fixes</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Targeted fixes for known NVIDIA / FiveM crash patterns — run after applying tweaks if you experience these errors</p>
              </div>
            </div>
            <div className="space-y-5">
              {CRASH_FIX_TWEAKS.map((item, i) => (
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

          {/* FiveM Client Config — CitizenFX.ini, commandline.txt, Steam overlay */}
          {renderSection("FiveM Client Config Tweaks", FIVEM_CLIENT_TWEAKS)}

          {/* HAGS OFF DPC callout — shown for GTX 1650 Super users */}
          {hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1650") && (
            <motion.a
              href="/tools-fixes#dpc-latency"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-300 group-hover:text-amber-200 transition-colors">Gun aiming in the air? FPS spike on kills? → DPC Latency Fixes</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Random aim input spikes and the 160→60 FPS cliff during action are caused by <span className="text-white font-medium">DPC latency bursts</span> — GPU interrupts and Ryzen C-state ACPI wake events dumping buffered inputs all at once.
                  Apply the <span className="text-amber-300 font-medium">NVIDIA DPC Fix</span> (MSI mode) and <span className="text-amber-300 font-medium">Ryzen C-State Fix</span> in the DPC Latency tab — these are separate downloadable scripts, not toggles.
                </p>
                <p className="text-[11px] text-amber-500/70 mt-2 font-medium">Click to open Tools & Fixes → DPC Latency tab →</p>
              </div>
            </motion.a>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Stutters with High Priority?", body: "If you experience micro-stutters with High Priority enabled, your CPU may be saturated. Disable it and use 'Pin to Physical Cores' instead for stable frametimes." },
              { title: "Cache Clearing", body: "Clearing FiveM cache fixes most crash/texture issues. Re-downloading server assets on first join is expected — it rebuilds the cache." },
              { title: "HAGS OFF on GTX 1650 Super — Full Stack", body: "HAGS OFF alone isn't enough. You need all four companion tweaks: Disable HAGS → Low Latency Ultra → HAGS OFF Stability Pack → NVIDIA + Ryzen DPC fixes in the DPC Latency tab. All four together eliminate the 160→60 drop and aim input spikes." },
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
