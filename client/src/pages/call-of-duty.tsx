import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, Info, Zap, Cpu, MonitorPlay } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_COD_IDS = [
  "CodHighPriority", "CodGameMode", "CodDisableXboxCapture", "CodBattlenetOptimize",
  "CodGPUPriority", "CodDirectXQueue",
  "CodShaderCacheClear", "CodPagefileOptimize", "CodDisableHAGS",
  "CodDefenderExclusion", "CodVRAMShaderBudget",
  "CodNetworkBuffer", "CodDisableLSO", "CodTCPOptimize",
  "Cod1650LowLatency", "Cod1650DisableAnsel",
  "Cod3500PowerPlan", "Cod3500CoreUnpark",
];

const COD_RECOMMENDED = [
  "CodHighPriority", "CodGameMode", "CodGPUPriority",
  "CodShaderCacheClear", "CodPagefileOptimize", "CodDisableHAGS",
  "CodDefenderExclusion", "CodNetworkBuffer",
  "CodDisableLSO", "Cod1650LowLatency", "Cod3500PowerPlan", "Cod3500CoreUnpark",
];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps:     ["CodHighPriority", "CodGameMode", "CodGPUPriority", "CodDirectXQueue"],
  texture: ["CodShaderCacheClear", "CodPagefileOptimize", "CodDisableHAGS", "CodDefenderExclusion", "CodVRAMShaderBudget"],
  network: ["CodNetworkBuffer", "CodDisableLSO"],
  nvidia:  ["Cod1650LowLatency"],
  cpu:     ["Cod3500PowerPlan", "Cod3500CoreUnpark"],
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

export default function CallOfDuty() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);

  // Hardware-aware labels — fall back gracefully if not yet detected
  const gpuLabel = hw.gpuName && hw.gpuName !== "Detecting..." ? hw.gpuName : "Your GPU";
  const isNvidiaUser = hw.isNvidia;
  const isLowVramNvidia = hw.nvidiaIsLowEnd; // GTX 10xx/16xx — 4–6 GB VRAM
  const isAmdCpu = hw.cpuBrand === "amd";
  const isIntelCpu = hw.cpuBrand === "intel";
  const cpuLabel = isAmdCpu ? "AMD Ryzen" : isIntelCpu ? "Intel Core" : "Your CPU";

  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 pb-32">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Call of Duty</h1>
                <p className="text-xs text-zinc-500">BO6 / Warzone — textures, VRAM, HAGS, network, CPU boost</p>
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
                    {hw.isAmd && !isNvidiaUser && (
                      <span className="flex items-center gap-1 text-[11px] bg-red-500/10 border border-red-500/25 text-red-400 rounded px-2 py-0.5 font-bold">
                        <MonitorPlay className="w-3 h-3" /> {gpuLabel}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] bg-zinc-800 border border-white/10 text-zinc-300 rounded px-2 py-0.5 font-bold">
                      <Cpu className="w-3 h-3" /> {cpuLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {isLowVramNvidia
                      ? <>Your <span className="text-white font-semibold">{gpuLabel}</span> has limited VRAM (4–6GB). BO6 frequently overflows this mid-game — causing blurry textures, invisible players, and the parachute pop-in glitch. The Texture Fix section below is your most important fix.</>
                      : isNvidiaUser
                      ? <>All universal tweaks apply to your <span className="text-white font-semibold">{gpuLabel}</span>. HAGS, pagefile, process priority, and network optimizations all improve BO6/Warzone performance on any NVIDIA card.</>
                      : hw.isAmd && !isNvidiaUser
                      ? <>Universal tweaks (process priority, shader cache, network buffers) all apply to your rig. For AMD GPU-specific tweaks, check the AMD Radeon tab.</>
                      : <>Universal tweaks apply to any gaming PC. Enable what you need and download the script.</>
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Issue cards — shown for low-VRAM NVIDIA, otherwise show generic cards */}
            {isLowVramNvidia && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { e: "🖼️", label: "Blurry textures", fix: "Shader cache clear + pagefile" },
                  { e: "👥", label: "Battle bus pop-in", fix: "Network buffer + pagefile" },
                  { e: "🪂", label: "Parachute / glider glitch", fix: "HAGS disable + network" },
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
            tweakIds={ALL_COD_IDS}
            recommendedIds={COD_RECOMMENDED}
            label="Call of Duty BO6 / Warzone"
            context="Tweaks modify Windows registry, pagefile, NVIDIA driver keys, and power plan for cod.exe. Run the .bat as Administrator. BO6 recompiles shaders on first launch after clearing cache — normal 2-3 min stutter pass, then textures load correctly every game."
            tips={[
              "Clear the shader cache first — stale BO6 cache is the #1 cause of blurry textures and character pop-in on any GPU.",
              "Disable HAGS if you're on a GTX 10xx/16xx card — it causes frame-time spikes with BO6's renderer.",
              "The pagefile fix matters most if you have ≤6GB VRAM — when VRAM fills, BO6 overflows textures to system RAM via pagefile.",
              "Network buffer + LSO off are universal wins for Warzone BR server model regardless of your hardware.",
            ]}
          />

          <PageGuide pageName="Call of Duty Optimizer" />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-10 mt-6">

            {/* FPS & Process Priority — UNIVERSAL */}
            <section>
              <SectionHeader title="⚡ FPS & Process Priority" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-3">
                {([
                  {
                    id: "CodHighPriority",
                    title: "Force cod.exe to High CPU + IO Priority (Persistent)",
                    desc: "Registers cod.exe in IFEO with High CPU priority, IO priority 3, page priority 5, energy throttle off, and foreground boost — survives every reboot. Works on any CPU. The single biggest FPS consistency fix for Warzone on any rig.\n\n⚠️ STREAMERS: High CPU priority starves OBS/Streamlabs of encoding time → choppy stream. If you stream, set OBS process priority to 'Above Normal' in OBS → Settings → Advanced, or skip this tweak.",
                    badge: "MUST HAVE",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodGameMode",
                    title: "Enable Windows Game Mode + Disable Xbox DVR",
                    desc: "Enables Windows Game Mode so Windows deprioritizes background tasks while COD is running. Disables Xbox DVR background capture hooks that eat into DirectX frame delivery. Universal benefit on any hardware.\n\n⚠️ STREAMERS: Game Mode deprioritizes OBS/Streamlabs as a 'background task' — this directly causes dropped frames and choppy stream. Disable this tweak if you stream.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDisableXboxCapture",
                    title: "Disable Xbox Game DVR Capture Hooks",
                    desc: "Removes the Xbox background capture thread that hooks into every DirectX process. In BO6 this overlay thread competes with the game's render queue and adds 2-8ms of frame latency on every GPU.",
                    impact: "MED" as const,
                  },
                  {
                    id: "CodBattlenetOptimize",
                    title: "Stop Battle.net Background Agents During Gameplay",
                    desc: "Kills Battle.net background update and scanning agents while you play. These processes use 50-150MB RAM and periodic CPU bursts that cause micro-stutter in BO6 on any system.",
                    impact: "MED" as const,
                  },
                  {
                    id: "CodGPUPriority",
                    title: "GPU Render Queue Priority 8 (IFEO — All COD Executables)",
                    desc: "Sets GPUPriority=8 for cod.exe, ModernWarfare.exe, ModernWarfareII.exe, and ModernWarfareIII.exe via IFEO — gives COD the highest possible slot in the Windows WDDM GPU scheduler. Reduces render-submit latency in BO6 gunfights and eliminates frame-submission stalls on mid-range GPUs. Works on any NVIDIA or AMD card.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDirectXQueue",
                    title: "DirectX MaxFrameLatency=1 + Flip Model Override",
                    desc: "Sets D3D MaxFrameLatency to 1 via registry and enables flip model presentation — reduces the GPU-side pre-render queue by 1 frame. Tightens frame delivery consistency in BO6 and reduces the input-to-display pipeline by 4-15ms on any GPU. No driver update needed.",
                    badge: "DX FIX",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Texture & Streaming Fix — UNIVERSAL (most important for low-VRAM) */}
            <section>
              <SectionHeader title="🖼️ Texture & Streaming Fix" sectionKey="texture" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              {isLowVramNvidia && (
                <div className="mb-3 flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400">
                    <span className="text-red-300 font-semibold">Apply these first.</span>{" "}
                    Blurry textures, invisible players in the battle bus, and parachute pop-in on landing are all VRAM overflow symptoms — your {gpuLabel} has limited VRAM that BO6 fills quickly.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {([
                  {
                    id: "CodShaderCacheClear",
                    title: "Clear Shader Cache + GPU Driver Cache",
                    desc: "Deletes stale BO6 shader cache, Battle.net cache, NVIDIA/AMD DXCache, and D3DSCache. Corrupted or oversized caches cause the blurry texture bug and slow character model loading in the battle bus on any GPU. BO6 recompiles cleanly on next launch (2-3 min first-game stutter, then fixed permanently).",
                    badge: "FIX TEXTURES",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodPagefileOptimize",
                    title: "Set Pagefile to 16–32GB (VRAM Overflow Fix)",
                    desc: isLowVramNvidia
                      ? `Your ${gpuLabel} has limited VRAM. BO6 mid-game regularly exceeds it for textures and shadow maps. When VRAM fills, Windows streams overflow to system RAM via pagefile. Undersized pagefile = blurry buildings, invisible players, and the glider redeploy glitch on landing.`
                      : "BO6 is one of the most VRAM-hungry games at high settings. When GPU VRAM fills, Windows streams overflow textures via pagefile. A minimum 16GB pagefile ensures stable texture streaming even during peak Warzone BR phases.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDefenderExclusion",
                    title: "Add COD Install Folder to Defender Exclusions",
                    desc: "Windows Defender scans COD's .pak and .ff asset files on every load — adding 2-8 seconds to load screens and causing disk read spikes mid-game that stutter textures. This exclusion stops real-time scanning on the COD folder without disabling Defender globally. Checks all common install paths (C/D/E drives, Battle.net, Steam).",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodVRAMShaderBudget",
                    title: "Clear COD Shader Cache + All DXCache Folders",
                    desc: "Clears NVIDIA DXCache, NVIDIA GLCache, D3DSCache (Windows-wide), AMD DxcCache, and the Warzone-specific Battle.net cache. Stale or oversized shader caches waste VRAM headroom — COD keeps old shader data in VRAM reducing the budget for actual texture streaming. Forces a clean shader recompile on next launch (2-3 min first-game stutter, then clean every time).",
                    badge: "VRAM FIX",
                    impact: "MED" as const,
                  },
                  {
                    id: "CodDisableHAGS",
                    title: "Disable Hardware-Accelerated GPU Scheduling (HAGS)",
                    desc: isLowVramNvidia
                      ? `HAGS causes frame-time variance and texture streaming stalls on GTX 10xx/16xx (Pascal/Turing) GPUs like your ${gpuLabel} in BO6/Warzone. NVIDIA only recommends HAGS on RTX 2000+ with Win11. This is the #1 stutter fix for GTX-class cards. Reboot required.`
                      : hw.nvidiaIsRTX
                      ? "HAGS is generally fine on RTX 2000+ cards. If you're experiencing frame-time spikes in BO6, try disabling it — some RTX users report improved consistency. Reboot required."
                      : "HAGS can cause frame-time variance in BO6/Warzone on some GPU configurations. Disabling it makes the GPU scheduler more predictable. Reboot required.",
                    badge: isLowVramNvidia ? "GTX FIX" : undefined,
                    impact: isLowVramNvidia ? "HIGH" as const : "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Network & Stability — UNIVERSAL */}
            <section>
              <SectionHeader title="📡 Network & Stability" sectionKey="network" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-3">
                {([
                  {
                    id: "CodNetworkBuffer",
                    title: "Increase Network Socket Buffers to 512KB",
                    desc: "Sets AFD receive and send buffers to 512KB — handles the burst traffic from Warzone's BR server model (100 players dropping simultaneously) without packet loss. Directly helps character and loot not loading during drop on any internet connection.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDisableLSO",
                    title: "Disable Large Send Offload (LSO)",
                    desc: "LSO batches TCP segments into large chunks, introducing 5-30ms timing spikes. In Warzone these spikes map to hit-reg and desync windows where you die behind cover. Disabling makes per-packet timing consistent on any network adapter.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodTCPOptimize",
                    title: "TCP No-Delay + Immediate ACK + No Timestamps",
                    desc: "Disables Nagle's algorithm (TCPNoDelay=1), forces immediate packet ACKs (TcpAckFrequency=1), and removes TCP timestamps. Tightens COD's server tick alignment by 1-5ms — noticeable in gunfights where first-bullet advantage matters.",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* NVIDIA GPU section — shown to all NVIDIA users */}
            {isNvidiaUser && (
              <section>
                <div className="flex items-center gap-2 mb-4 px-1">
                  <div className="w-1 h-4 rounded bg-green-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-green-400">🟢 NVIDIA GPU</h2>
                  <span className="text-[10px] text-zinc-500 ml-1 font-mono">{gpuLabel}</span>
                </div>
                <div className="space-y-3">
                  {([
                    {
                      id: "Cod1650LowLatency",
                      title: `Enable NVIDIA Low Latency Mode (${gpuLabel})`,
                      desc: isLowVramNvidia
                        ? `Sets NVIDIA's low latency mode in the driver registry — reduces the pre-rendered frame queue from 3 to 1. On your ${gpuLabel} in BO6, this shaves 10-20ms off GPU-side input lag and reduces VRAM pressure from queued frames.`
                        : `Sets NVIDIA's low latency mode in the driver registry — reduces the pre-rendered frame queue from 3 to 1. Lowers GPU-side input lag in BO6 gunfights. Works on all NVIDIA GPUs.`,
                      badge: "NVIDIA",
                      impact: "HIGH" as const,
                    },
                    {
                      id: "Cod1650DisableAnsel",
                      title: "Disable NVIDIA Ansel Screenshot Overlay",
                      desc: isLowVramNvidia
                        ? `Ansel reserves a small VRAM buffer at all times for its screenshot capture system, even when never used. On your ${gpuLabel} with limited VRAM, every megabyte reclaimed helps BO6's texture streaming. Also removes the Alt+F2 overlay hook.`
                        : "Ansel reserves a VRAM buffer at all times for its screenshot capture system. Disabling it frees that buffer and removes the Alt+F2 overlay hook from every DirectX game process.",
                      badge: "NVIDIA",
                      impact: isLowVramNvidia ? "MED" as const : "LOW" as const,
                    },
                  ]).map((item, i) => (
                    <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                      badge={item.badge} impact={item.impact}
                      checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* CPU section — AMD gets power plan + core unpark; Intel gets core unpark only */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className={cn("w-1 h-4 rounded", isAmdCpu ? "bg-red-500" : "bg-blue-500")} />
                <h2 className={cn("text-sm font-bold uppercase tracking-wider", isAmdCpu ? "text-red-400" : "text-blue-400")}>
                  {isAmdCpu ? "🔴" : "🔵"} {cpuLabel}
                </h2>
                <span className="text-[10px] text-zinc-600 ml-1">CPU-specific</span>
              </div>
              <div className="space-y-3">
                {isAmdCpu && (
                  <TweakRow
                    id="Cod3500PowerPlan"
                    title="Activate AMD Ryzen Balanced Power Plan"
                    description="Windows default Balanced plan throttles Ryzen boost clocks mid-game to save power. The AMD Ryzen Balanced plan preserves correct boost behavior — your Ryzen CPU needs this to sustain max boost clock during BO6's CPU-intensive BR phases. The script detects and activates whichever AMD Ryzen plan is on your system."
                    badge="AMD RYZEN"
                    impact="HIGH"
                    checked={tweaks["Cod3500PowerPlan"] || false}
                    onCheckedChange={v => setTweak("Cod3500PowerPlan", v)}
                    delay={1}
                  />
                )}
                <TweakRow
                  id="Cod3500CoreUnpark"
                  title={isAmdCpu ? "Unpark All Ryzen Cores" : isIntelCpu ? "Unpark All Intel Cores" : "Unpark All CPU Cores"}
                  description="Core parking puts idle CPU cores to sleep to save power. When BO6 bursts onto a parked core, Windows takes 5-15ms to wake it — a direct cause of micro-stutter during gunfights. Unparking all cores keeps them ready for BO6's unpredictable threading bursts. Works on AMD and Intel."
                  badge={isAmdCpu ? "AMD RYZEN" : isIntelCpu ? "INTEL" : undefined}
                  impact="HIGH"
                  checked={tweaks["Cod3500CoreUnpark"] || false}
                  onCheckedChange={v => setTweak("Cod3500CoreUnpark", v)}
                  delay={isAmdCpu ? 2 : 1}
                />
              </div>
            </section>

            {/* AMD GPU note — if no NVIDIA detected */}
            {!isNvidiaUser && hw.isAmd && (
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
                <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-300 mb-1">AMD GPU detected — more tweaks available</p>
                  <p className="text-[11px] text-zinc-400">
                    For AMD Radeon-specific COD tweaks (anti-lag, shader cache, texture filtering), visit the{" "}
                    <span className="text-red-400 font-semibold">AMD Radeon</span> tab.
                    The universal tweaks above (priority, network, pagefile, shader cache clear) all apply to your AMD GPU.
                  </p>
                </div>
              </div>
            )}

          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
