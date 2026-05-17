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
  "FiveM1650DisableHAGS","FiveM1650VRAMBudget","FiveM1650DisableAnsel","FiveM1650LowLatencyMode",
  "FiveM3500CoreAffinity","FiveM3500PerfPlan",
];
const FIVEM_RECOMMENDED = ["FiveMHighPriority","FiveMCacheClear","FiveMNetworkBuffer","FiveMQueueFix","FiveMFullPerfStack","FiveMGTAProcessPerfOptions"];

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

  const PROCESS_TWEAKS: Tweak[] = [
    { id: "FiveMHighPriority", title: "Force GTA5.exe to High CPU Priority (Persistent)", desc: "Injects IFEO registry keys so Windows always schedules GTA5.exe at High CPU priority — survives restarts.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMDisablePhysX", title: "Disable NVIDIA PhysX GPU Acceleration", desc: "Forces CPU PhysX — reduces VRAM contention on servers with heavy particle effects.", impact: "LOW" },
    { id: "FiveMAffinityMask", title: "Pin GTA5.exe + FiveM.exe to Above Normal Priority", desc: "Sets Above Normal CPU priority for both GTA5.exe and FiveM.exe via IFEO — consistent scheduler priority across both processes.", impact: "MED" },
    { id: "FiveMIOPriority", title: "Set FiveM I/O Priority to High", desc: "Forces streaming disk reads to High I/O priority — faster asset loading on crowded servers.", impact: "MED" },
    { id: "FiveMWorkingSet", title: "Increase GTA5.exe Working Set Limit (4GB)", desc: "Raises the per-process memory ceiling for GTA5.exe to 4GB — reduces streaming model crashes on high-res texture packs.", impact: "MED" },
  ];

  const CLIENT_TWEAKS: Tweak[] = [
    { id: "FiveMCacheClear", title: "Auto-Clear FiveM Cache on Startup", desc: "Deletes stale server cache — fixes crashes, texture loss, and connection issues on reboot.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMExtendedMemory", title: "Enable Extended Memory Allocator (FiveM)", desc: "Patches FiveM.exe to Above Normal CPU priority — reducing streaming model crashes on busy servers.", impact: "MED" },
    { id: "FiveMStreamDistance", title: "Cap Streaming Distance (500 units)", desc: "Sets StreamingDistance=500 in CitizenFX.ini — reduces LOD pop-in and micro-stutter on city servers.", impact: "MED" },
    { id: "FiveMStreamPool", title: "Set CitizenFX Stream Pool to 128", desc: "Updates CitizenFX.ini StreamPool setting to 128 — improves streaming stability on high-asset servers.", impact: "MED" },
    { id: "FiveMDisableNvidiaTelemetry", title: "Disable NVIDIA Telemetry Service", desc: "Stops NvTelemetryContainer service — eliminates the background GPU perf overhead it causes.", badge: "NVIDIA ONLY", impact: "MED" },
    { id: "FiveMMenuFpsUncap", title: "Uncap FiveM Menu FPS (NVIDIA OpenGL GDI: Prefer Performance)", desc: "Sets NVIDIA OpenGL GDI Compatibility to Prefer Performance via GPU class registry — removes the monitor-refresh-rate FPS cap applied to FiveM menus by default. Without this, NVIDIA caps GDI-rendered UI to your monitor Hz (e.g. 165fps). With it, menu FPS runs uncapped (250+).", badge: "NVIDIA ONLY", impact: "HIGH", recommended: true },
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
  ];

  const PERF_OPTIONS_TWEAKS: Tweak[] = [
    { id: "FiveMFullPerfStack", title: "Full fivem.exe PerfOptions Stack", desc: "Applies the complete IFEO PerfOptions block to FiveM.exe: AboveNormal CPU(3), CpuPriorityBoost, DisableEnergyThrottling, EnableBoost, ForceForegroundBoost, IoPriority=High, PagePriority=5, rendering preemption disabled, HW acceleration on, power throttle off, unlimited GPU performance.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGTAProcessPerfOptions", title: "GTA Process PerfOptions (All Build Versions)", desc: "Applies AboveNormal CPU(3) + IO=High + EnergyThrottle=Off + FGBoost=On + PagePriority=5 to FiveM_bXXXX_GTAProcess.exe. Uses wildcard matching — covers all installed build numbers automatically.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGameModeAdd", title: "Add FiveM + GTA5 to Windows Game Mode", desc: "Enables Auto Game Mode and whitelists GTA5.exe and FiveM.exe in the Windows Game Mode process registry — ensures Windows grants them priority scheduling automatically.", impact: "MED" },
    { id: "FiveMRenderingBoost", title: "Disable Rendering Preemption (FiveM + GTA5)", desc: "Sets DisableRenderingContextPreemption=1, DisableRenderingPreemption=1, EnableHWAcceleration=1, GpuIdle=0 on both FiveM.exe and GTA5.exe — eliminates GPU preemption micro-stutters during scene transitions.", impact: "HIGH" },
    { id: "FiveMGPUPriorityStack", title: "GPU Priority Stack (GpuPriorityClass=8 + HAGS)", desc: "Sets GpuPriorityClass=8, GPU Priority=8, GpuMaxPerformance=256, GpuThrottling=0 on FiveM.exe and applies GPU Priority=8, MaximumPreRenderedFrames=1 to the system Games multimedia profile.", badge: "NVIDIA/AMD", impact: "HIGH" },
  ];

  const CRASH_FIX_TWEAKS: Tweak[] = [
    { id: "FiveMFixProductId", title: "Fix: CfxState.h Crash — productId != ProductID::INVALID", desc: "Fixes the 'Assertion failure: productId != ProductID::INVALID (CfxState.h:88)' crash. Root cause: IFEO MitigationOptions or a stale Debugger key on Rockstar/FiveM executables corrupts FiveM's hardware product ID read at startup. This fix clears MitigationOptions + Debugger from IFEO for RockstarGamesLauncher.exe, PlayGTAV.exe, SocialClubHelper.exe, GTA5.exe and FiveM.exe, purges the CfxState priv cache, and re-enables Rockstar Service if it was disabled. Reboot and relaunch FiveM normally after applying.", impact: "HIGH", badge: "CFXSTATE FIX" },
    { id: "FiveMFixNvidiaOverlay", title: "Fix: NVIDIA Overlay.exe 0x80000003 Crash", desc: "Root cause: stopping NVDisplay.ContainerLocalSystem while NVIDIA Overlay.exe is running orphans the overlay process — it throws a 0x80000003 breakpoint exception and crashes FiveM. This fix kills crashed overlay processes, restores the container service if disabled, then blocks the overlay from relaunching via registry. Run this if you see 'NVIDIA Overlay.exe — Application Error — A breakpoint has been reached (0x80000003)'. Reboot once after applying.", impact: "HIGH", badge: "CRASH FIX" },
    { id: "FiveMDisableMPO", title: "Fix: Black Screen at FiveM Server Load-In (Disable MPO)", desc: "Disables Multi-Plane Overlay (MPO) by setting OverlayTestMode=5 in the DWM registry key. MPO causes Windows DWM to conflict with Discord and Steam overlays during the FiveM server transition phase — producing a full black screen. This is the #1 cause of 'black screen when connecting to a server'. Reboot required after applying.", impact: "HIGH", badge: "BLACK SCREEN FIX" },
  ];

  const GTX1650_TWEAKS: Tweak[] = [
    { id: "FiveM1650DisableHAGS", title: "GTX 1650 SUPER: Disable HAGS (Reduce Frame-Time Variance)", desc: "Disables Hardware-Accelerated GPU Scheduling on GTX 16xx (Turing) cards. HAGS was built for RTX 2000+ and RX 6000+ — on GTX 1650 SUPER it adds more frame-time variance than it removes. Turning it off is measurable in crowded FiveM servers. Reboot required.", badge: "GTX 1650 SUPER", impact: "HIGH" },
    { id: "FiveM1650VRAMBudget", title: "GTX 1650 SUPER: Force Full 4GB VRAM Budget in GTA V", desc: "Appends -availablevidmem 4096 -percentvidmem 100 to GTA V commandline.txt. Some 4GB Turing setups report VRAM below actual, capping texture streaming. This forces GTA V to use the full 4GB — improves texture quality and reduces VRAM-related hitches on high-asset FiveM servers.", badge: "GTX 1650 SUPER", impact: "HIGH" },
    { id: "FiveM1650DisableAnsel", title: "GTX 1650 SUPER: Disable NVIDIA Ansel Frame Hook", desc: "Sets AnselEnable=0 and OptInOrOutPreference=0 in NVIDIA registry. Ansel injects into every render frame on all NVIDIA GPUs including GTX 1650 SUPER. Disabling it removes measurable hook overhead — keeps the display container alive to avoid 0x80000003 overlay crashes.", badge: "GTX 1650 SUPER", impact: "MED" },
    { id: "FiveM1650LowLatencyMode", title: "GTX 1650 SUPER: NVIDIA Low Latency Ultra (Driver-Level)", desc: "Forces FlipQueueSize=1, PerfLevelSrc=max, PowerMizerLevel=1 directly in the GPU class registry key. Bypasses NVCP and locks the driver to max-performance, ultra-low-latency mode for the full session. Reduces input lag by 1-3 frames vs default NVIDIA driver behavior.", badge: "GTX 1650 SUPER", impact: "HIGH" },
  ];

  const RYZEN3500_TWEAKS: Tweak[] = [
    { id: "FiveM3500CoreAffinity", title: "Ryzen 5 3500: Pin GTA5 + FiveM to All 6 Physical Cores (0x3F)", desc: "Sets CPU affinity mask 0x3F (all 6 cores) for GTA5.exe and FiveM.exe. The Ryzen 5 3500 has no SMT — 0x3F is ALL physical cores. Also applies via IFEO so it persists on next launch: CpuPriorityClass=High, IO=High, FgBoost=On, EnergyThrottle=Off. Tighter frametimes under CPU load on dense servers.", badge: "RYZEN 5 3500", impact: "HIGH" },
    { id: "FiveM3500PerfPlan", title: "Ryzen 5 3500: Lock to High Performance Plan (Boost 100%)", desc: "Activates the High Performance plan and forces Min=100%, Max=100%, BoostMode=Aggressive, BoostPolicy=100%, CpuMinCores=100%. Precision Boost 2 on Zen 2 can drop clocks aggressively between frames. Locking to 100% removes the ramp-up delay and keeps all 6 cores at max boost for the full FiveM session.", badge: "RYZEN 5 3500", impact: "MED" },
  ];

  const GTX1060_TWEAKS: Tweak[] = [
    { id: "FiveM1060VRAMFlag", title: "GTX 1060 6GB: Force GTA V to Use Full 6GB VRAM", desc: "Appends -availablevidmem 6144 to GTA V commandline.txt — forces the engine to recognize and use the full 6GB VRAM budget. Some Pascal GPU setups incorrectly report available VRAM as lower, limiting texture streaming. This patch fixes it.", badge: "GTX 1060", impact: "HIGH" },
    { id: "FiveM1060DisableHAGS", title: "GTX 1060: Disable Hardware-Accelerated GPU Scheduling (HAGS)", desc: "HAGS causes additional frame-time variance on Pascal-gen GPUs (GTX 1060, 1080, 1080 Ti). These cards were designed before HAGS existed and the scheduler overhead costs more than it saves. Disabling it reduces micro-stutters on populated FiveM servers.", badge: "GTX 1060", impact: "HIGH" },
    { id: "FiveM1060AnselDisable", title: "GTX 1060: Disable NVIDIA Ansel Screenshot Hook", desc: "Stops NVIDIA Ansel (NVContainerLocalSystem) from injecting into GTA V. Ansel hooks every frame on NVIDIA GPUs including GTX 1060 — on older cards this is measurable overhead. Disabling it frees a small but consistent amount of GPU time.", badge: "GTX 1060", impact: "MED" },
  ];

  const RYZEN5600_TWEAKS: Tweak[] = [
    { id: "FiveM5600CoreAffinity", title: "Ryzen 5 5600: Pin GTA5 + FiveM to Physical Cores (0,2,4,6,8,10)", desc: "Sets CPU affinity for GTA5.exe and FiveM.exe to physical cores only — avoiding the SMT (hyperthreaded) sibling cores. On Zen 3 (Ryzen 5 5600), GTA V's threading model interacts poorly with SMT under load, causing frame-time spikes. This forces it onto the 6 real cores for tighter frametimes.", badge: "RYZEN 5 5600", impact: "HIGH" },
    { id: "FiveM5600PowerPlan", title: "Ryzen 5 5600: Apply AMD Ryzen High Performance Power Plan", desc: "Activates the AMD Ryzen High Performance power plan (GUID: fc5a4062). Zen 3 CPUs have aggressive frequency scaling that can cause latency spikes in GTA V. The Ryzen-tuned plan sets minimum processor state to 99% and removes the governor ramp-up delay — keeps boost clocks on for the full GTA V session.", badge: "RYZEN 5 5600", impact: "MED" },
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
        <div className="space-y-3">
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

        <PageGuide pageName="FiveM Optimizer" />

        {/* Opti Gods Graphics Pack Download */}
        <a
          href="/downloads/optigods-graphics-pack.zip"
          download="optigods-graphics-pack.zip"
          className="flex items-center gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0">
            <Package className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Opti Gods Smooth Graphics Pack</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              FiveM resource (timecycle) + ReShade preset — clean bright visuals, built for light-game players. Free.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 shrink-0 group-hover:text-red-300 transition-colors">
            <Download className="w-3.5 h-3.5" />
            <span>Free Download</span>
          </div>
        </a>

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
          recommendedIds={FIVEM_RECOMMENDED}
          label="FiveM"
          context="These tweaks are applied via PowerShell and target GTA V and FiveM process scheduling, network buffers, and CitizenFX config. Download the script and double-click to run — it requests admin automatically."
          tips={[
            "Start with Recommended — High Priority + Cache Clear are the biggest wins.",
            "Network Buffer tweak reduces packet loss on high-population RP servers.",
            "Clearing cache resets streaming data — expect a slightly longer first join.",
          ]}
        />

        <div className="space-y-8">
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
            <div className="space-y-3">
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

          {/* GTX 1060 Tweaks — only show if GPU is specifically GTX 1060 */}
          {hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1060") && (
            <section>
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="flex-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">GTX 1060 Tweaks</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Targeted for GTX 1060 6GB (Pascal) — HAGS off, VRAM budget unlock, Ansel hook removal</p>
                </div>
              </div>
              <div className="space-y-3">
                {GTX1060_TWEAKS.map((item, i) => (
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
          )}

          {/* Ryzen 5 5600 Tweaks — only show if CPU is specifically Ryzen 5 5600 (gen 5) */}
          {hw.isRyzen && hw.cpuGeneration === 5 && hw.cpuLabel.toLowerCase().includes("5600") && (
            <section>
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="flex-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Ryzen 5 5600 Tweaks</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Targeted for Ryzen 5 5600 (Zen 3, 6C SMT) — core affinity to physical cores, Ryzen power plan</p>
                </div>
              </div>
              <div className="space-y-3">
                {RYZEN5600_TWEAKS.map((item, i) => (
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
          )}

          {/* GTX 1650 SUPER Tweaks — only show if GPU is specifically GTX 1650 */}
          {hw.nvidiaIsLowEnd && hw.gpuName.toLowerCase().includes("1650") && (
            <section>
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="flex-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">GTX 1650 SUPER Tweaks</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Targeted for GTX 1650 SUPER (Turing/TU116) — HAGS off, VRAM budget unlock, Ansel hook removal, Low Latency Ultra driver mode</p>
                </div>
              </div>
              <div className="space-y-3">
                {GTX1650_TWEAKS.map((item, i) => (
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
          )}

          {/* Ryzen 5 3500 Tweaks — only show if CPU is specifically Ryzen 5 3500 (gen 3) */}
          {hw.isRyzen && hw.cpuGeneration === 3 && hw.cpuLabel.toLowerCase().includes("3500") && (
            <section>
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="flex-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Ryzen 5 3500 Tweaks</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Targeted for Ryzen 5 3500 (Zen 2, 6C no SMT) — core affinity, High Performance plan with boost locked to 100%</p>
                </div>
              </div>
              <div className="space-y-3">
                {RYZEN3500_TWEAKS.map((item, i) => (
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
          )}

          {/* FiveM Client Config — CitizenFX.ini, commandline.txt, Steam overlay */}
          {renderSection("FiveM Client Config Tweaks", FIVEM_CLIENT_TWEAKS)}

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
