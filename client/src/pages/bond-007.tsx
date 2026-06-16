import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Info, Zap, Cpu, MonitorPlay } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_007_IDS = [
  "game_007firstlight",
  "CodShaderCacheClear",
  "CodPagefileOptimize",
  "CodDisableHAGS",
  "Cod1650LowLatency",
  "NvidiaD3DOptimize",
  "NvidiaPCIeGen3Force",
  "Cod3500PowerPlan",
  "Cod3500CoreUnpark",
  "CodMemPriority",
  "CodFramePacing",
  "CodTdrDelay",
  "CodMMCSS",
];

const BOND007_RECOMMENDED = [
  "game_007firstlight",
  "CodShaderCacheClear",
  "CodPagefileOptimize",
  "CodDisableHAGS",
  "CodMemPriority",
  "CodMMCSS",
  "Cod3500PowerPlan",
  "Cod3500CoreUnpark",
];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  pack:    ["game_007firstlight"],
  shaders: ["CodShaderCacheClear", "CodPagefileOptimize", "CodDisableHAGS", "CodTdrDelay"],
  nvidia:  ["Cod1650LowLatency", "NvidiaD3DOptimize", "NvidiaPCIeGen3Force"],
  cpu:     ["Cod3500PowerPlan", "Cod3500CoreUnpark", "CodMMCSS", "CodMemPriority", "CodFramePacing"],
};

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

export default function Bond007() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);

  const gpuLabel = hw.gpuName && hw.gpuName !== "Detecting..." ? hw.gpuName : "Your GPU";
  const isNvidiaUser = hw.isNvidia;
  const isLowVramNvidia = hw.nvidiaIsLowEnd;
  const isAmdCpu = hw.cpuBrand === "amd";
  const cpuLabel = isAmdCpu ? "AMD Ryzen" : hw.cpuBrand === "intel" ? "Intel Core" : "Your CPU";

  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-white">
        <div className="w-full px-4 py-8 pb-32">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-600/40 flex items-center justify-center">
                <Shield className="w-5 h-5 text-zinc-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">007: First Light</h1>
                <p className="text-xs text-zinc-500">IO Interactive · Unreal Engine 5 · Priority, Engine.ini, shader cache, NVIDIA</p>
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
                    <span className="flex items-center gap-1 text-[11px] bg-zinc-800 border border-white/10 text-zinc-300 rounded px-2 py-0.5 font-bold">
                      <Cpu className="w-3 h-3" /> {cpuLabel}
                    </span>
                    <span className="text-[11px] bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 rounded px-2 py-0.5 font-bold">UE5</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {isLowVramNvidia
                      ? <>007: First Light runs on UE5 — Lumen, Virtual Shadow Maps, and Volumetric Fog are heavy on your <span className="text-white font-semibold">{gpuLabel}</span>. The Full Pack below patches Engine.ini to disable these and set a 2GB streaming pool, giving you significantly more headroom on 4GB VRAM.</>
                      : <>007: First Light's UE5 engine has several default settings that tank performance on mid-range rigs. The Full Pack auto-detects your install, patches Engine.ini, sets process priority, and tunes the system scheduler — one toggle covers everything.</>
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Issue cards */}
            {isLowVramNvidia && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { e: "🌫️", label: "Lumen kills FPS", fix: "Engine.ini → DGI=OFF, Reflections=OFF" },
                  { e: "🕯️", label: "Shadow stutter", fix: "Virtual Shadow Maps → disabled" },
                  { e: "💾", label: "4GB VRAM overflow", fix: "Streaming pool → 2GB cap" },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2.5">
                    <p className="text-sm mb-0.5">{item.e} <span className="text-white font-bold text-xs">{item.label}</span></p>
                    <p className="text-[10px] text-zinc-500">{item.fix}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Smart bar */}
          <TabSmartBar
            tweakIds={ALL_007_IDS}
            recommendedIds={BOND007_RECOMMENDED}
            label="007: First Light"
            context="Tweaks patch UE5 Engine.ini (motion blur, Lumen, virtual shadows, volumetric fog, RT off, 2GB streaming pool), set IFEO process priority for all known exe names, add Defender exclusion, tune MMCSS, extend TDR timeout, and set 512KB network buffers. Run the .bat as Administrator. Launch the game once before running if Engine.ini paths haven't been created yet."
            tips={[
              "Run the Full Pack first — it auto-detects your install path across Steam/Epic/EA and patches Engine.ini in one shot.",
              "If the game hasn't been launched yet, Engine.ini won't exist — run the pack after your first launch.",
              "GTX 1650 Super users: disable HAGS and enable Low Latency Mode for the biggest consistency gains.",
              "The TDR delay fix prevents GPU timeouts during UE5 shader compilation on first-load areas.",
            ]}
          />

          <PageGuide pageName="007: First Light Optimizer" />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-12 mt-6">

            {/* Full Performance Pack */}
            <section>
              <SectionHeader title="🎯 Full Performance Pack" sectionKey="pack" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="mb-3 flex items-start gap-2 bg-zinc-800/30 border border-zinc-700/30 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-400">
                  Auto-detects your 007: First Light install. Patches <span className="text-zinc-200 font-semibold">Engine.ini</span> to disable Lumen, Virtual Shadow Maps, Volumetric Fog, Ray Tracing, and cap the streaming pool to 2GB. Also sets <span className="text-zinc-200 font-semibold">process priority</span>, Defender exclusion, MMCSS, TDR delay, and 512KB network buffers in one script.
                </p>
              </div>
              <div className="space-y-5">
                <TweakRow
                  id="game_007firstlight"
                  title="007: First Light — Full Optimization Pack"
                  description={`Detects install at all common Steam/Epic/EA paths. Applies all at once:\n\n• IFEO process priority (Above Normal / High based on CPU cores), IO=High, GPU=8, energy throttle OFF, foreground boost ON — for all known exe names (007FirstLight.exe, 007FirstLight-Win64-Shipping.exe, ProjectBond.exe)\n• Windows Defender exclusion on the install folder (faster load times, no mid-game scan hitches)\n• Game Mode enabled + Xbox DVR disabled\n• MMCSS: Priority=6, GPU=8, High scheduling category, SystemResponsiveness=10\n• TDR delay extended to 8s — prevents GPU timeout crash during UE5 shader compilation on new areas\n• Network buffers: AFD 512KB send/receive\n• Engine.ini patches: Lumen OFF, Virtual Shadow Maps OFF, Volumetric Fog OFF, Ray Tracing OFF, Motion Blur OFF, Lens Flare OFF, SSR quality=1, Shadow max res=1024, Streaming pool=2048MB, TAA mode, mouse smoothing OFF\n\n⚠️ Launch 007: First Light at least once before running — UE5 creates the config folder on first boot.`}
                  badge="FULL PACK"
                  impact="HIGH"
                  checked={tweaks["game_007firstlight"] || false}
                  onCheckedChange={v => setTweak("game_007firstlight", v)}
                  delay={1}
                />
              </div>
            </section>

            {/* Shader & VRAM */}
            <section>
              <SectionHeader title="🖼️ Shader Cache & VRAM" sectionKey="shaders" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              {isLowVramNvidia && (
                <div className="mb-3 flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400">
                    <span className="text-red-300 font-semibold">Apply these.</span>{" "}
                    Your {gpuLabel} has 4GB VRAM. UE5 games aggressively stream textures — a stale or oversized shader cache wastes headroom and causes hitches on new area loads.
                  </p>
                </div>
              )}
              <div className="space-y-5">
                {([
                  {
                    id: "CodShaderCacheClear",
                    title: "Clear GPU Shader Cache + DXCache",
                    desc: "Deletes stale NVIDIA DXCache, GLCache, D3DSCache, and AMD DxcCache folders. UE5 games like 007: First Light keep growing shader caches that eat into VRAM headroom and slow first-load of new areas. Forces a clean recompile on next launch (brief first-area stutter, then smooth).",
                    badge: "FIX STUTTERS",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodPagefileOptimize",
                    title: "Set Pagefile to 16–32GB (Texture Overflow Buffer)",
                    desc: isLowVramNvidia
                      ? `UE5 streaming pools overflow to system RAM when VRAM fills. Your ${gpuLabel} has 4GB — even with the streaming pool capped at 2GB, mid-level texture spikes can overflow. A 16GB+ pagefile prevents the hard stutter when this happens.`
                      : "UE5 games stream textures aggressively. When VRAM fills during streaming, Windows uses pagefile as the overflow buffer. A minimum 16GB pagefile ensures stable texture streaming without hard stutters.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDisableHAGS",
                    title: "Disable Hardware-Accelerated GPU Scheduling (HAGS)",
                    desc: isLowVramNvidia
                      ? `HAGS adds frame-time variance on GTX 10xx/16xx (Pascal/Turing) GPUs like your ${gpuLabel} in UE5 titles. NVIDIA only recommends HAGS for RTX 2000+ on Windows 11. Disabling it is the #1 1% low fix for GTX-class cards in 007. Reboot required.`
                      : "HAGS can cause frame-time spikes in UE5 games on some GPU configurations. Disabling it makes the GPU scheduler more predictable. Reboot required.",
                    badge: isLowVramNvidia ? "GTX FIX" : undefined,
                    impact: isLowVramNvidia ? "HIGH" as const : "MED" as const,
                  },
                  {
                    id: "CodTdrDelay",
                    title: "Extend TDR Timeout to 8 Seconds (UE5 Shader Compile Fix)",
                    desc: "Sets TdrDelay=8 and TdrDdiDelay=8 in the graphics driver registry. UE5 games compile new shaders on-the-fly when entering areas — on mid-range GPUs this can briefly exceed Windows' default 2s GPU response timeout, causing a device reset or hard crash. Extending to 8s prevents this during shader-heavy load spikes in 007.",
                    badge: "UE5 FIX",
                    impact: "HIGH" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* NVIDIA GPU — shown to NVIDIA users */}
            {isNvidiaUser && (
              <section>
                <SectionHeader title="🟢 NVIDIA GPU" sectionKey="nvidia" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
                <span className="text-[10px] text-zinc-600 font-mono -mt-2 mb-4 block px-1">{gpuLabel}</span>
                <div className="space-y-5">
                  {([
                    {
                      id: "Cod1650LowLatency",
                      title: `NVIDIA Low Latency Mode — Ultra (${gpuLabel})`,
                      desc: isLowVramNvidia
                        ? `Sets NVIDIA's low latency mode to Ultra in the driver registry — reduces the pre-rendered frame queue from 3 to 1. On your ${gpuLabel} in UE5 titles, this shaves 10-20ms off GPU-side input lag and reduces VRAM pressure from queued frames.`
                        : `Sets NVIDIA's low latency mode to Ultra — reduces the GPU pre-render queue to 1 frame. Lowers input lag and frame-time variance in 007. Works on all NVIDIA GPUs.`,
                      badge: "NVIDIA",
                      impact: "HIGH" as const,
                    },
                    {
                      id: "NvidiaD3DOptimize",
                      title: "NVIDIA DirectX: Kill Debug Layers + Async Shader Compile",
                      desc: isLowVramNvidia
                        ? `Disables D3D11/D3D12 debug/validation layers and enables async shader compilation. UE5 games like 007 compile shaders on-the-fly — async compile prevents the hard freeze-stutter mid-level. On your ${gpuLabel}, this is one of the most noticeable quality-of-life fixes.`
                        : "Disables D3D11/12 validation layers and enables async shader compilation. UE5 games compile shaders during gameplay — without async, each new shader causes a hard 50–200ms freeze. This fix makes UE5 level transitions smooth.",
                      badge: "RECOMMENDED",
                      impact: "HIGH" as const,
                    },
                    {
                      id: "NvidiaPCIeGen3Force",
                      title: `PCIe Gen3 Link Lock + GPU Preemption (${gpuLabel})`,
                      desc: `Writes PCIELinkSpeedOverride=2 to your GPU's class key — prevents the driver from falling back to PCIe 2.0 x8 during power transitions, which halves memory bandwidth and causes frame spikes under UE5's streaming workloads. Also enables GPU preemption for smoother DPC scheduling.`,
                      badge: "GTX 1650",
                      impact: "MED" as const,
                    },
                  ]).map((item, i) => (
                    <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                      badge={item.badge} impact={item.impact}
                      checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* CPU & System */}
            <section>
              <SectionHeader title="⚙️ CPU & System Scheduler" sectionKey="cpu" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-5">
                {([
                  {
                    id: "Cod3500PowerPlan",
                    title: isAmdCpu ? "Switch to High Performance Power Plan (AMD Ryzen)" : "Switch to High Performance Power Plan",
                    desc: isAmdCpu
                      ? "Ryzen 5 3500 defaults to Balanced plan — this throttles clock speed and core response time. High Performance locks the multiplier at max boost, eliminating the 10-30ms clock recovery delay when UE5 suddenly demands a CPU burst for streaming or physics. Single biggest CPU fix for UE5 games on Ryzen."
                      : "High Performance plan eliminates Windows' power-state recovery delay — the CPU stays at max clock. Reduces UE5 streaming hitches caused by clock ramp-up latency on any CPU.",
                    badge: isAmdCpu ? "RYZEN FIX" : "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "Cod3500CoreUnpark",
                    title: "Unpark All CPU Cores (Min Processor State 100%)",
                    desc: "Forces all cores to stay active — eliminates the 5-15ms latency Windows introduces when waking a parked core. In UE5 games like 007: First Light, sudden CPU core demand (streaming, physics, AI) hits parked cores, causing micro-stutters that aren't visible in average FPS but ruin feel. Universal benefit.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodMMCSS",
                    title: "MMCSS Gaming Profile — GPU Priority 8, High Scheduling",
                    desc: "Sets MMCSS Tasks\\Games: Priority=6, GPU Priority=8, Scheduling Category=High, SFIO Priority=High. Also sets SystemResponsiveness=10 (reserves 10% CPU time for multimedia/game threads). Ensures 007's render and audio threads get OS priority over background tasks.",
                    badge: "RECOMMENDED",
                    impact: "MED" as const,
                  },
                  {
                    id: "CodMemPriority",
                    title: "Force Game EXE to Memory Priority 5 (Working Set Boost)",
                    desc: "Sets the memory priority for game executables to 5 via IFEO — tells Windows to keep the game's working set in physical RAM rather than paging it to disk. Reduces the RAM→VRAM stutter caused by UE5's texture streaming when combined with the pagefile fix.",
                    impact: "MED" as const,
                  },
                  {
                    id: "CodFramePacing",
                    title: "Enable DWM Frame Pacing + Flip Discard Override",
                    desc: "Enables Windows' composited flip presentation for DX12 (007 defaults to DX12) — reduces frame-time variance by synchronizing Desktop Window Manager's flip queue with the game's submit rate. Tightens frame delivery consistency especially at high framerates above 144fps.",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
