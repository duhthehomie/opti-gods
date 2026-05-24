import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, Info, Zap } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_COD_IDS = [
  "CodHighPriority", "CodGameMode", "CodDisableXboxCapture", "CodBattlenetOptimize",
  "CodShaderCacheClear", "CodPagefileOptimize", "CodDisableHAGS",
  "CodNetworkBuffer", "CodDisableLSO", "CodTCPOptimize",
  "Cod1650LowLatency", "Cod1650DisableAnsel",
  "Cod3500PowerPlan", "Cod3500CoreUnpark",
];

const COD_RECOMMENDED = [
  "CodHighPriority", "CodGameMode", "CodShaderCacheClear",
  "CodPagefileOptimize", "CodDisableHAGS", "CodNetworkBuffer",
  "CodDisableLSO", "Cod1650LowLatency", "Cod3500PowerPlan", "Cod3500CoreUnpark",
];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps:     ["CodHighPriority", "CodGameMode", "CodDisableXboxCapture"],
  texture: ["CodShaderCacheClear", "CodPagefileOptimize", "CodDisableHAGS"],
  network: ["CodNetworkBuffer", "CodDisableLSO"],
  gpu1650: ["Cod1650LowLatency"],
  cpu3500: ["Cod3500PowerPlan", "Cod3500CoreUnpark"],
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
                <p className="text-xs text-zinc-500">BO6 / Warzone — textures, VRAM, HAGS, network</p>
              </div>
            </div>

            {/* Rig callout */}
            <div className="mt-4 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-orange-300 mb-1">Tuned for GTX 1650 Super + Ryzen 5 3500 + 32GB</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Your setup's main bottleneck in BO6 is the 4GB VRAM on the 1650 Super.
                    When VRAM fills mid-game, textures page to system RAM causing blurry
                    buildings, invisible players, and the parachute glitch on landing.
                    The tweaks below target exactly this. Apply the <span className="text-orange-300 font-semibold">MUST HAVE</span> ones first.
                  </p>
                </div>
              </div>
            </div>

            {/* Issue cards */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { e: "🖼️", label: "Blurry textures", fix: "Shader cache clear + pagefile" },
                { e: "👥", label: "Battle bus pop-in", fix: "Network buffer + pagefile" },
                { e: "🪂", label: "Glider/parachute glitch", fix: "HAGS disable + network" },
              ].map(item => (
                <div key={item.label} className="bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2.5">
                  <p className="text-sm mb-0.5">{item.e} <span className="text-white font-bold text-xs">{item.label}</span></p>
                  <p className="text-[10px] text-zinc-500">{item.fix}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Smart bar */}
          <TabSmartBar
            tweakIds={ALL_COD_IDS}
            recommendedIds={COD_RECOMMENDED}
            label="Call of Duty BO6 / Warzone"
            context="Tweaks modify Windows registry, pagefile, NVIDIA driver keys, and AMD power plan for cod.exe. Run the .bat as Administrator. BO6 will recompile shaders on first launch after clearing the cache — this is normal (takes 2-3 min), then textures load correctly every game."
            tips={[
              "Clear the shader cache first — stale BO6 cache is the #1 cause of blurry textures and character pop-in.",
              "Set the pagefile to 16GB+ — when your 1650 Super's 4GB VRAM fills, BO6 overflows to pagefile. Too small = invisible players.",
              "Disable HAGS (Hardware-Accelerated GPU Scheduling) — GTX 1650/16xx cards stutter badly with HAGS in BO6/Warzone.",
            ]}
          />

          <PageGuide pageName="Call of Duty Optimizer" />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-10 mt-6">

            {/* FPS & Process Priority */}
            <section>
              <SectionHeader title="⚡ FPS & Process Priority" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-3">
                {([
                  {
                    id: "CodHighPriority",
                    title: "Force cod.exe to High CPU + IO Priority (Persistent)",
                    desc: "Registers cod.exe in IFEO with High CPU priority, IO priority 3, page priority 5, energy throttle off, and foreground boost — survives every reboot. The single biggest FPS consistency fix for Warzone.",
                    badge: "MUST HAVE",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodGameMode",
                    title: "Enable Windows Game Mode + Disable Xbox DVR",
                    desc: "Enables Windows Game Mode so Windows deprioritizes background tasks while COD is running. Disables Xbox DVR background capture hooks that eat into DirectX frame delivery.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDisableXboxCapture",
                    title: "Disable Xbox Game DVR Capture Hooks",
                    desc: "Removes the Xbox background capture thread that hooks into every DirectX process. In BO6 this overlay thread competes with the game's render queue and adds 2-8ms of frame latency.",
                    impact: "MED" as const,
                  },
                  {
                    id: "CodBattlenetOptimize",
                    title: "Stop Battle.net Background Agents During Gameplay",
                    desc: "Kills Battle.net background update and scanning agents while you play. These processes use 50-150MB RAM and periodic CPU bursts that cause micro-stutter in BO6.",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Texture & Streaming Fix */}
            <section>
              <SectionHeader title="🖼️ Texture & Streaming Fix" sectionKey="texture" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="mb-3 flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-400">
                  <span className="text-red-300 font-semibold">Apply these first.</span>{" "}
                  Blurry textures, invisible players in the battle bus, and the parachute glitch on landing are all VRAM overflow symptoms on a 4GB card.
                </p>
              </div>
              <div className="space-y-3">
                {([
                  {
                    id: "CodShaderCacheClear",
                    title: "Clear Shader Cache + GPU Driver Cache",
                    desc: "Deletes stale BO6 shader cache, Battle.net cache, NVIDIA DXCache, and D3DSCache. Corrupted or oversized caches cause the blurry texture bug and slow character model loading in the battle bus. BO6 recompiles cleanly on next launch (2-3 min first-game stutter, then fixed).",
                    badge: "FIX TEXTURES",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodPagefileOptimize",
                    title: "Set Pagefile to 16–32GB (Fixes 4GB VRAM Overflow)",
                    desc: "GTX 1650 Super has 4GB VRAM. BO6 mid-game regularly exceeds 4GB for textures and shadow maps. When VRAM fills, Windows streams overflow textures via pagefile. Undersized pagefile = blurry buildings, invisible players, and the glider redeploy glitch on landing.",
                    badge: "FIXES BLURRY TEXTURES",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDisableHAGS",
                    title: "Disable Hardware-Accelerated GPU Scheduling (HAGS)",
                    desc: "HAGS causes frame-time variance and texture streaming stalls on GTX 16xx (Turing) GPUs in BO6/Warzone. NVIDIA only recommends HAGS on RTX 2000+ with Win11. On a GTX 1650 Super this is the #1 stutter source. Reboot required.",
                    badge: "GTX 1650 SUPER FIX",
                    impact: "HIGH" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Network & Stability */}
            <section>
              <SectionHeader title="📡 Network & Stability" sectionKey="network" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-3">
                {([
                  {
                    id: "CodNetworkBuffer",
                    title: "Increase Network Socket Buffers to 512KB",
                    desc: "Sets AFD receive and send buffers to 512KB — handles burst traffic from Warzone's BR server model (100 players dropping simultaneously) without packet loss. Directly helps character and loot not loading on drop.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "CodDisableLSO",
                    title: "Disable Large Send Offload (LSO)",
                    desc: "LSO batches TCP segments into large chunks, introducing 5-30ms timing spikes. In Warzone these spikes map to the hit-reg and desync windows where you die behind cover. Disabling makes per-packet timing consistent.",
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

            {/* GTX 1650 Super */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1 h-4 rounded bg-green-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-green-400">🟢 GTX 1650 Super</h2>
                <span className="text-[10px] text-zinc-600 ml-1">GPU-specific</span>
              </div>
              <div className="space-y-3">
                {([
                  {
                    id: "Cod1650LowLatency",
                    title: "Enable NVIDIA Low Latency Mode (GTX 1650 Super)",
                    desc: "Sets NVIDIA's low latency mode in the driver registry — reduces the pre-rendered frame queue from 3 to 1. On the GTX 1650 Super in BO6, this shaves 10-20ms off GPU-side input lag in gunfights.",
                    badge: "GTX 1650 SUPER",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "Cod1650DisableAnsel",
                    title: "Disable NVIDIA Ansel Screenshot Overlay",
                    desc: "Ansel reserves a small VRAM buffer at all times for its screenshot capture system, even when never used. On a 4GB VRAM card, every megabyte reclaimed helps BO6's texture streaming. Also removes the Alt+F2 overlay hook.",
                    badge: "GTX 1650 SUPER",
                    impact: "LOW" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Ryzen 5 3500 */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1 h-4 rounded bg-red-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">🔴 Ryzen 5 3500</h2>
                <span className="text-[10px] text-zinc-600 ml-1">CPU-specific</span>
              </div>
              <div className="space-y-3">
                {([
                  {
                    id: "Cod3500PowerPlan",
                    title: "Activate AMD Ryzen Balanced Power Plan",
                    desc: "Windows default Balanced plan throttles Ryzen boost clocks mid-game to save power. The AMD Ryzen Balanced plan preserves correct boost behavior — your Ryzen 5 3500 needs this to sustain its 4.1GHz max boost clock during BO6's CPU-intensive BR phases.",
                    badge: "RYZEN 5 3500",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "Cod3500CoreUnpark",
                    title: "Unpark All 6 Ryzen 3500 Cores",
                    desc: "Core parking puts idle CPU cores to sleep to save power. When BO6 bursts onto a parked core, Windows takes 5-15ms to wake it — a direct cause of micro-stutter during gunfights. Ryzen 5 3500 has 6 cores with no SMT (hyperthreading), so every core must stay awake.",
                    badge: "RYZEN 5 3500",
                    impact: "HIGH" as const,
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
