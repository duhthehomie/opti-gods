import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Gamepad2, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageGuide } from "@/components/page-guide";

const ALL_FIVEM_IDS = [
  "FiveMHighPriority","FiveMDisablePhysX","FiveMAffinityMask","FiveMIOPriority","FiveMWorkingSet",
  "FiveMCacheClear","FiveMExtendedMemory","FiveMStreamDistance","FiveMStreamPool","FiveMDisableNvidiaTelemetry","FiveMMenuFpsUncap",
  "FiveMDisableVSync","FiveMNetworkBuffer","FiveMDisableFullscreen","FiveMDisableDWM","FiveMDisableMemCompression","FiveMDisableLSO",
  "FiveMDNSOverride","FiveMDisableP2P","FiveMQueueFix","FiveMEnableRSS",
  "FiveMReduceNPCDensity","FiveMReduceShadowQuality","FiveMCommandLineTweaks",
  "FiveMFullPerfStack","FiveMGTAProcessPerfOptions","FiveMGameModeAdd","FiveMRenderingBoost","FiveMGPUPriorityStack",
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
    { id: "FiveMDisableMemCompression", title: "Disable Windows Memory Compression", desc: "Stops Windows from compressing RAM pages in the background. With 16GB+ RAM this is pure overhead — disabling it frees CPU cycles that GTA V's streaming engine can use instead. Huge help on 6-core CPUs.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMDisableLSO", title: "Disable Large Send Offload (LSO) — Remove Latency Spikes", desc: "Disables LSO on all active network adapters. LSO batches TCP segments which causes unpredictable 5-30ms spikes on busy FiveM servers. Disabling it makes per-packet latency tighter and more consistent.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
  ];

  const CFX_TWEAKS: Tweak[] = [
    { id: "FiveMDNSOverride", title: "Override CFX DNS to Cloudflare 1.1.1.1", desc: "Points active adapter DNS to 1.1.1.1/1.0.0.1 — faster cfx.re resolution and lower DNS lookup latency.", impact: "MED" },
    { id: "FiveMDisableP2P", title: "Allow Direct P2P Connections", desc: "Enables direct peer connections for lower server ping. Disable on untrusted public servers.", impact: "LOW" },
    { id: "FiveMQueueFix", title: "Max Game CPU Priority (SystemResponsiveness=0)", desc: "Sets SystemResponsiveness=0 — allocates maximum CPU time to the foreground game process.", impact: "HIGH", recommended: true },
    { id: "FiveMEnableRSS", title: "Enable RSS — Spread Packet Processing Across CPU Cores", desc: "Enables Receive Side Scaling on all active network adapters and pins the RSS base to CPU core 1 (away from core 0 which handles hardware interrupts). Distributes incoming packet processing across multiple cores — critical on 6-core CPUs in populated FiveM servers.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
  ];

  const GTA_ENGINE_TWEAKS: Tweak[] = [
    { id: "FiveMReduceNPCDensity", title: "Reduce GTA V NPC + Vehicle Density to 15%", desc: "Writes PedDensity=0.15 and TrafficDensity=0.15 to GTA V settings.xml. NPCs are the single biggest CPU cost in populated areas — a server with 32 players + full NPC density will tank a 6-core CPU. This is the highest-impact tweak for pistol FFA and crowded servers.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMReduceShadowQuality", title: "Reduce GTA V Shadow Quality to Minimum", desc: "Sets shadow quality, distance, and softness to 0 in GTA V settings.xml. Shadows are extremely CPU+GPU expensive in GTA V — running minimum quality can gain 15-30 FPS on GTX 1650-class hardware with zero gameplay impact.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMCommandLineTweaks", title: "Optimize GTA V commandline.txt Launch Flags", desc: "Creates/updates GTA V commandline.txt with: -dx11 (stable on GTX 1650), -nomemrestrict (no VRAM ceiling), -norestrictions (removes asset limits), -noBlockOnLostFocus (no pause on alt-tab), -novblank (VSync frame lock off), -noprecisefp (faster FP math). Loaded by GTA V at every launch.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
  ];

  const PERF_OPTIONS_TWEAKS: Tweak[] = [
    { id: "FiveMFullPerfStack", title: "Full fivem.exe PerfOptions Stack", desc: "Applies the complete IFEO PerfOptions block to FiveM.exe: AboveNormal CPU(3), CpuPriorityBoost, DisableEnergyThrottling, EnableBoost, ForceForegroundBoost, IoPriority=High, PagePriority=5, rendering preemption disabled, HW acceleration on, power throttle off, unlimited GPU performance.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGTAProcessPerfOptions", title: "GTA Process PerfOptions (All Build Versions)", desc: "Applies AboveNormal CPU(3) + IO=High + EnergyThrottle=Off + FGBoost=On + PagePriority=5 to FiveM_bXXXX_GTAProcess.exe. Uses wildcard matching — covers all installed build numbers automatically.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGameModeAdd", title: "Add FiveM + GTA5 to Windows Game Mode", desc: "Enables Auto Game Mode and whitelists GTA5.exe and FiveM.exe in the Windows Game Mode process registry — ensures Windows grants them priority scheduling automatically.", impact: "MED" },
    { id: "FiveMRenderingBoost", title: "Disable Rendering Preemption (FiveM + GTA5)", desc: "Sets DisableRenderingContextPreemption=1, DisableRenderingPreemption=1, EnableHWAcceleration=1, GpuIdle=0 on both FiveM.exe and GTA5.exe — eliminates GPU preemption micro-stutters during scene transitions.", impact: "HIGH" },
    { id: "FiveMGPUPriorityStack", title: "GPU Priority Stack (GpuPriorityClass=8 + HAGS)", desc: "Sets GpuPriorityClass=8, GPU Priority=8, GpuMaxPerformance=256, GpuThrottling=0 on FiveM.exe and applies GPU Priority=8, MaximumPreRenderedFrames=1 to the system Games multimedia profile.", badge: "NVIDIA/AMD", impact: "HIGH" },
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

        <TabSmartBar
          tweakIds={ALL_FIVEM_IDS}
          recommendedIds={FIVEM_RECOMMENDED}
          label="FiveM"
          context="These tweaks are applied via PowerShell and target GTA V and FiveM process scheduling, network buffers, and CitizenFX config. Run as Administrator after downloading the script."
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
