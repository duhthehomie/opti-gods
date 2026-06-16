import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Button } from "@/components/ui/button";
import { Blocks, AlertTriangle, Info, FileCode, Zap, MonitorPlay, Cpu } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_ROBLOX_IDS = [
  "RobloxFPSUnlock", "RobloxDisablePostFX", "RobloxReduceLightUpdates", "RobloxDisableSSAO",
  "RobloxHighPriority", "RobloxDisableThrottling", "RobloxGameMode",
  "RobloxNetworkBuffer", "RobloxNagleOff",
];
const ROBLOX_RECOMMENDED = [
  "RobloxFPSUnlock", "RobloxHighPriority", "RobloxDisableThrottling",
  "RobloxDisablePostFX", "RobloxDisableSSAO",
];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps:     ["RobloxFPSUnlock", "RobloxDisablePostFX", "RobloxDisableSSAO", "RobloxReduceLightUpdates"],
  cpu:     ["RobloxHighPriority", "RobloxDisableThrottling", "RobloxGameMode"],
  network: ["RobloxNetworkBuffer", "RobloxNagleOff"],
};

const FFLAGS_PREVIEW = `// ClientAppSettings.json — written to:
// %LocalAppData%\\Roblox\\Versions\\<version>\\ClientSettings\\

{
  "DFIntTaskSchedulerTargetFps": 9999,
  "FFlagDisablePostFx": true,
  "FIntRenderLocalLightUpdatesMax": 8,
  "FIntRenderLocalLightUpdatesMin": 6,
  "FFlagRenderNoLowFiSky": true
}`;

function SectionHeader({ title, sectionKey, tweaks, setTweak, smartRecIds }: {
  title: string; sectionKey: string;
  tweaks: Record<string, boolean>; setTweak: (id: string, v: boolean) => void;
  smartRecIds?: Set<string>;
}) {
  const base = SECTION_RECOMMENDED[sectionKey] || [];
  const ids = smartRecIds ? base.filter(id => smartRecIds.has(id)) : base;
  const allOn = ids.length > 0 && ids.every(id => tweaks[id]);
  if (ids.length === 0) {
    return <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">{title}</h2>;
  }
  return (
    <div className="flex items-center justify-between mb-4 px-1">
      <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">{title}</h2>
      <Button
        size="sm"
        variant={allOn ? "default" : "outline"}
        onClick={() => ids.forEach(id => setTweak(id, true))}
        className={cn(
          "h-6 px-2.5 text-[10px] font-bold uppercase tracking-wide gap-1.5",
          allOn
            ? "bg-red-600 hover:bg-red-700 text-white border-0"
            : "border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 bg-transparent"
        )}
        data-testid={`apply-all-${sectionKey}`}
      >
        <Zap className="w-3 h-3" />
        {allOn ? "Applied" : "Apply All"}
      </Button>
    </div>
  );
}

export default function RobloxPage() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);

  const gpuLabel = hw.gpuName && hw.gpuName !== "Detecting..." ? hw.gpuName : "Your GPU";
  const isNvidiaUser = hw.isNvidia;
  const isLowVramNvidia = hw.nvidiaIsLowEnd;
  const isAmdGpu = hw.isAmdGpu;
  const isAmdCpu = hw.cpuBrand === "amd";
  const isIntegrated = hw.isAmdApu || hw.isIntel;
  const cpuLabel = isAmdCpu ? "AMD Ryzen" : hw.cpuBrand === "intel" ? "Intel Core" : "Your CPU";

  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-white">
        <div className="w-full px-4 py-8 pb-32">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Blocks className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Roblox</h1>
                <p className="text-xs text-zinc-500">FFlag patching · FPS unlock · CPU priority · post-FX removal</p>
              </div>
            </div>

            {/* Hardware-aware callout */}
            <div className="mt-4 bg-zinc-900/60 border border-white/5 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isNvidiaUser && (
                      <span className="flex items-center gap-1 text-[11px] bg-green-500/10 border border-green-500/25 text-green-400 rounded px-2 py-0.5 font-bold">
                        <MonitorPlay className="w-3 h-3" /> {gpuLabel}
                      </span>
                    )}
                    {isAmdGpu && !isNvidiaUser && (
                      <span className="flex items-center gap-1 text-[11px] bg-red-500/10 border border-red-500/25 text-red-400 rounded px-2 py-0.5 font-bold">
                        <MonitorPlay className="w-3 h-3" /> {gpuLabel}
                      </span>
                    )}
                    {isIntegrated && (
                      <span className="flex items-center gap-1 text-[11px] bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded px-2 py-0.5 font-bold">
                        <MonitorPlay className="w-3 h-3" /> {gpuLabel} (iGPU)
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] bg-zinc-800 border border-white/10 text-zinc-300 rounded px-2 py-0.5 font-bold">
                      <Cpu className="w-3 h-3" /> {cpuLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {isIntegrated
                      ? <>Your <span className="text-white font-semibold">{gpuLabel}</span> shares RAM with the CPU — Roblox's post-processing effects (bloom, SSAO, depth of field) are especially expensive on shared-memory GPUs. <span className="text-amber-300 font-semibold">Disable Post-FX and SSAO first</span> — these are your highest-impact tweaks and won't require a reboot.</>
                      : isLowVramNvidia
                      ? <>Your <span className="text-white font-semibold">{gpuLabel}</span> has 4–6GB VRAM. Roblox's shader cache and post-FX stack can eat into that headroom on GPU-heavy Roblox experiences. Disabling post-FX and SSAO frees GPU budget for higher FPS and cleaner frame times.</>
                      : <>All FFlag tweaks apply to any GPU — FPS unlock and post-FX removal are universal wins. CPU priority and network buffer tweaks apply regardless of your hardware.</>
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Hardware-specific issue cards */}
            {isIntegrated && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { e: "🎆", label: "Bloom eats GPU time", fix: "FFlagDisablePostFx=true" },
                  { e: "🌑", label: "SSAO kills 1% lows", fix: "FFlagRenderNoLowFiSky + SSAO off" },
                  { e: "⏱️", label: "60fps cap by default", fix: "DFIntTaskSchedulerTargetFps=9999" },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2.5">
                    <p className="text-sm mb-0.5">{item.e} <span className="text-white font-bold text-xs">{item.label}</span></p>
                    <p className="text-[10px] text-zinc-500">{item.fix}</p>
                  </div>
                ))}
              </div>
            )}
            {isLowVramNvidia && !isIntegrated && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { e: "🎆", label: "Post-FX wastes VRAM", fix: "Disable bloom + depth of field" },
                  { e: "⏱️", label: "Default 60fps cap", fix: "FFlag → 9999 uncap" },
                  { e: "💡", label: "Dynamic lights expensive", fix: "Light updates → max 8" },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2.5">
                    <p className="text-sm mb-0.5">{item.e} <span className="text-white font-bold text-xs">{item.label}</span></p>
                    <p className="text-[10px] text-zinc-500">{item.fix}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* FFlags preview card */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <FileCode className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-bold text-sm mb-1">FFlags Patcher — ClientAppSettings.json</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Roblox reads internal feature flags from{" "}
                  <span className="font-mono text-zinc-300">ClientAppSettings.json</span> inside each version folder under{" "}
                  <span className="font-mono text-zinc-300">%LocalAppData%\Roblox\Versions\</span>.
                  The script iterates all installed versions, creates the <span className="font-mono text-zinc-300">ClientSettings</span> folder if needed,
                  and merges your selected flags — preserving any existing custom flags.
                </p>
              </div>
            </div>
            <div className="bg-black/60 rounded-lg border border-zinc-800 p-3 overflow-x-auto">
              <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{FFLAGS_PREVIEW}</pre>
            </div>
            <p className="text-[11px] text-zinc-600 mt-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-zinc-500" />
              Roblox may reset FFlags after a client update — re-run the script after Roblox auto-updates.
            </p>
          </motion.div>

          {/* Smart bar */}
          <TabSmartBar
            tweakIds={ALL_ROBLOX_IDS}
            recommendedIds={ROBLOX_RECOMMENDED}
            label="Roblox"
            context="Tweaks write to Roblox FFlags (ClientAppSettings.json) and Windows registry for RobloxPlayerBeta.exe. No game file modifications — safe for Hyperion anti-cheat. FPS unlock uses an official Roblox FFlag, not a third-party injector."
            tips={[
              isIntegrated
                ? `Your iGPU shares RAM — DisablePostFX and DisableSSAO are your highest-impact tweaks. Apply those before anything else.`
                : isLowVramNvidia
                ? `Your ${gpuLabel} benefits most from post-FX off and FPS uncap. Post-processing uses VRAM that Roblox could use for textures.`
                : "FPS Unlock via FFlags is the safest method — no third-party injector, just a JSON flag Roblox reads natively.",
              "DisablePostFX removes bloom and depth of field — significant FPS gain on integrated graphics and older GPUs.",
              "Roblox re-downloads its client on updates, which may reset FFlags. Keep the script to re-apply in seconds.",
              "RobloxHighPriority via IFEO is persistent — survives every reboot without any launcher config.",
            ]}
          />

          <PageGuide pageName="Roblox Optimizer" />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-12 mt-6">

            {/* FPS & Rendering */}
            <section>
              <SectionHeader title="🎮 FPS & Rendering" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              {isIntegrated && (
                <div className="mb-3 flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400">
                    <span className="text-amber-300 font-semibold">iGPU detected.</span>{" "}
                    Post-FX and SSAO are the highest-priority tweaks for your {gpuLabel} — they consume a disproportionate share of iGPU compute. Apply these first.
                  </p>
                </div>
              )}
              <div className="space-y-5">
                {([
                  {
                    id: "RobloxFPSUnlock",
                    title: "Unlock FPS via FFlags (9999 target — no cap)",
                    desc: "Writes DFIntTaskSchedulerTargetFps=9999 to ClientAppSettings.json — bypasses Roblox's default 60fps cap without any external tool or injector. Uses an official Roblox FFlag that Roblox reads natively at startup. Safe for Hyperion.\n\nOn your hardware, this is the highest single-toggle FPS gain — Roblox's task scheduler was artificially limiting your GPU from delivering its full output.",
                    badge: "MUST HAVE",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RobloxDisablePostFX",
                    title: "Disable Post-Processing Effects (Bloom, Depth of Field, Color Grade)",
                    desc: isIntegrated
                      ? `Sets FFlagDisablePostFx=true — removes bloom, depth of field, and color grading. On your ${gpuLabel} (shared memory), post-FX runs a full-screen compute pass every frame that competes with your game's render budget. This is the single biggest iGPU FPS improvement in Roblox.`
                      : isLowVramNvidia
                      ? `Sets FFlagDisablePostFx=true — removes bloom, depth of field, and color grading. Your ${gpuLabel} has limited VRAM and post-FX runs an extra compute pass that eats into your GPU's frame budget. Disabling it frees headroom for higher sustained FPS in GPU-heavy Roblox experiences.`
                      : "Sets FFlagDisablePostFx=true — removes bloom, depth of field, and color grading. Eliminates an extra GPU compute pass every frame. Significant FPS gain on mid-range GPUs; noticeable smoothness improvement on any hardware.",
                    badge: isIntegrated ? "IGPU PRIORITY" : "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RobloxReduceLightUpdates",
                    title: "Reduce Dynamic Light Update Frequency",
                    desc: isIntegrated
                      ? `Lowers FIntRenderLocalLightUpdatesMax/Min to 8/6 — limits how often dynamic lights are recalculated. On your ${gpuLabel}, dynamic light updates run on the same shared compute budget as rendering — reducing them directly frees GPU time for more frames.`
                      : "Lowers FIntRenderLocalLightUpdatesMax/Min in FFlags — reduces how often dynamic lights are recomputed each frame. In GPU-heavy Roblox experiences with many light sources this frees meaningful GPU compute time.",
                    impact: "MED" as const,
                  },
                  {
                    id: "RobloxDisableSSAO",
                    title: "Disable Ambient Occlusion (SSAO) + Sky Overhead",
                    desc: isIntegrated
                      ? `Sets FFlagRenderNoLowFiSky=true — removes ambient occlusion shadow computation and sky rendering overhead. SSAO runs a multi-pass screen-space depth test every frame. On your ${gpuLabel} with shared memory bandwidth, this tweak alone can improve 1% lows by 15-25%.`
                      : isLowVramNvidia
                      ? `Disables ambient occlusion shadow computation and sky rendering. On your ${gpuLabel}, SSAO's screen-space depth passes consume meaningful VRAM bandwidth. Disabling it tightens 1% lows and reduces frame-time variance in complex scenes.`
                      : "Sets FFlagRenderNoLowFiSky=true — removes ambient occlusion shadow computation and sky rendering overhead. Measurable GPU savings on any mid-range hardware with a visible impact on 1% low frame times.",
                    badge: isIntegrated ? "IGPU PRIORITY" : "RECOMMENDED",
                    impact: isIntegrated ? "HIGH" as const : "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* CPU & Process Priority */}
            <section>
              <SectionHeader title="⚡ CPU & Process Priority" sectionKey="cpu" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-5">
                {([
                  {
                    id: "RobloxHighPriority",
                    title: "Set Roblox to Above Normal CPU + High I/O Priority (Persistent)",
                    desc: isAmdCpu
                      ? `Registers RobloxPlayerBeta.exe in IFEO with CpuPriorityClass=3 (Above Normal) and IoPriority=3 (High) — persistent across every reboot. On your ${cpuLabel}, Roblox competes with the Windows scheduler at Normal priority by default. Above Normal ensures your Roblox thread gets scheduled before all background apps during Roblox gaming sessions.`
                      : "Registers RobloxPlayerBeta.exe in IFEO with CpuPriorityClass=3 and IoPriority=3 — persistent across reboots. Ensures Windows always schedules Roblox threads before background apps. The most consistent CPU priority fix — survives every reboot and app update.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RobloxDisableThrottling",
                    title: "Disable Power Throttling for Roblox",
                    desc: isAmdCpu
                      ? `Disables Windows Efficiency Mode / power throttling for RobloxPlayerBeta.exe. On ${cpuLabel} systems, Windows can throttle Roblox's thread power allocation when it detects low-priority background workloads. This forces full clock speed for Roblox threads at all times.`
                      : "Disables Windows power throttling for RobloxPlayerBeta.exe — ensures sustained CPU clock speeds during fast-paced Roblox game modes. Prevents Windows from quietly reducing power to Roblox threads to save energy.",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RobloxGameMode",
                    title: "Enable Windows Game Mode + Disable Xbox DVR",
                    desc: "Enables Windows Game Mode so Windows deprioritizes all background tasks while Roblox is running. Disables Xbox Game DVR background capture hooks that add DirectX frame latency.\n\n⚠️ STREAMERS: Game Mode deprioritizes OBS/Streamlabs as a background task. If you stream, skip this tweak or manually set OBS to Above Normal priority.",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Network */}
            <section>
              <SectionHeader title="📡 Network" sectionKey="network" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-5">
                {([
                  {
                    id: "RobloxNetworkBuffer",
                    title: "Increase Network Socket Buffers to 256KB",
                    desc: "Sets AFD receive and send buffers to 256KB — handles burst traffic from Roblox servers during player-dense events without packet loss. Helps with rubberbanding and player pop-in on busy Roblox game servers.",
                    impact: "MED" as const,
                  },
                  {
                    id: "RobloxNagleOff",
                    title: "Disable Nagle Algorithm (Immediate Packet Send)",
                    desc: "Sets TcpNoDelay=1 and TcpAckFrequency=1 — forces immediate TCP packet sends instead of batching. Reduces ping variance and input lag in fast-paced Roblox PvP modes (Bedwars, Blox Fruits PvP, BIG Games). Universal benefit on any internet connection.",
                    badge: "RECOMMENDED",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: "No Injector Needed",
                  body: "DFIntTaskSchedulerTargetFps is an official Roblox FFlag — no third-party FPS unlocker app required. The flag is read natively by Roblox on startup and is safe under Hyperion anti-cheat.",
                },
                {
                  title: "After Roblox Updates",
                  body: "Roblox auto-updates its client and may reset FFlags. Re-run the script after Roblox updates. The script handles all version folders automatically in one pass.",
                },
                {
                  title: "Hyperion Safe",
                  body: "All tweaks are OS-level (registry + JSON flags). Roblox's Hyperion anti-cheat monitors game memory injection — registry and ClientAppSettings.json changes are undetected.",
                },
              ].map((c, i) => (
                <motion.div key={c.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                  className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">{c.title}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{c.body}</p>
                </motion.div>
              ))}
            </div>

          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
