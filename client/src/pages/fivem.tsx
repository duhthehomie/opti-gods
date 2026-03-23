import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Gamepad2, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALL_FIVEM_IDS = [
  "FiveMHighPriority","FiveMDisablePhysX","FiveMAffinityMask","FiveMIOPriority","FiveMWorkingSet",
  "FiveMCacheClear","FiveMExtendedMemory","FiveMStreamDistance","FiveMStreamPool","FiveMDisableNvidiaTelemetry",
  "FiveMDisableVSync","FiveMNetworkBuffer","FiveMDisableFullscreen","FiveMDisableDWM",
  "FiveMDNSOverride","FiveMDisableP2P","FiveMQueueFix",
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
  ];

  const WINDOWS_TWEAKS: Tweak[] = [
    { id: "FiveMDisableVSync", title: "Force Disable VSync in Config", desc: "Forces in-game VSync off via config — removes 60fps frame cap on higher refresh monitors.", impact: "HIGH" },
    { id: "FiveMNetworkBuffer", title: "Increase Socket Receive Buffer (512KB)", desc: "Bumps socket send/receive buffers to 512KB — handles high player count server traffic without packet loss.", impact: "HIGH", recommended: true },
    { id: "FiveMDisableFullscreen", title: "Use Windowed Borderless Mode", desc: "Forces borderless windowed mode via CitizenFX.ini — eliminates exclusive fullscreen delays on Alt+Tab.", impact: "LOW" },
    { id: "FiveMDisableDWM", title: "Raise GTA5.exe to High Priority (DWM-Aware)", desc: "Sets GTA5.exe CPU+IO to High priority mode to minimize DWM compositor interference during gameplay.", impact: "MED" },
  ];

  const CFX_TWEAKS: Tweak[] = [
    { id: "FiveMDNSOverride", title: "Override CFX DNS to Cloudflare 1.1.1.1", desc: "Points active adapter DNS to 1.1.1.1/1.0.0.1 — faster cfx.re resolution and lower DNS lookup latency.", impact: "MED" },
    { id: "FiveMDisableP2P", title: "Allow Direct P2P Connections", desc: "Enables direct peer connections for lower server ping. Disable on untrusted public servers.", impact: "LOW" },
    { id: "FiveMQueueFix", title: "Max Game CPU Priority (SystemResponsiveness=0)", desc: "Sets SystemResponsiveness=0 — allocates maximum CPU time to the foreground game process.", impact: "HIGH", recommended: true },
  ];

  const PERF_OPTIONS_TWEAKS: Tweak[] = [
    { id: "FiveMFullPerfStack", title: "Full fivem.exe PerfOptions Stack", desc: "Applies the complete IFEO PerfOptions block to FiveM.exe: AboveNormal CPU(3), CpuPriorityBoost, DisableEnergyThrottling, EnableBoost, ForceForegroundBoost, IoPriority=High, PagePriority=5, rendering preemption disabled, HW acceleration on, power throttle off, unlimited GPU performance.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGTAProcessPerfOptions", title: "GTA Process PerfOptions (All Build Versions)", desc: "Applies AboveNormal CPU(3) + IO=High + EnergyThrottle=Off + FGBoost=On + PagePriority=5 to FiveM_bXXXX_GTAProcess.exe. Uses wildcard matching — covers all installed build numbers automatically.", badge: "RECOMMENDED", impact: "HIGH", recommended: true },
    { id: "FiveMGameModeAdd", title: "Add FiveM + GTA5 to Windows Game Mode", desc: "Enables Auto Game Mode and whitelists GTA5.exe and FiveM.exe in the Windows Game Mode process registry — ensures Windows grants them priority scheduling automatically.", impact: "MED" },
    { id: "FiveMRenderingBoost", title: "Disable Rendering Preemption (FiveM + GTA5)", desc: "Sets DisableRenderingContextPreemption=1, DisableRenderingPreemption=1, EnableHWAcceleration=1, GpuIdle=0 on both FiveM.exe and GTA5.exe — eliminates GPU preemption micro-stutters during scene transitions.", impact: "HIGH" },
    { id: "FiveMGPUPriorityStack", title: "GPU Priority Stack (GpuPriorityClass=8 + HAGS)", desc: "Sets GpuPriorityClass=8, GPU Priority=8, GpuMaxPerformance=256, GpuThrottling=0 on FiveM.exe and applies GPU Priority=8, MaximumPreRenderedFrames=1 to the system Games multimedia profile.", badge: "NVIDIA/AMD", impact: "HIGH" },
  ];

  function renderSection(heading: string, items: Tweak[]) {
    const recommended = items.filter(t => t.recommended).map(t => t.id);
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
