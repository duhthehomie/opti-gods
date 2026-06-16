import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Button } from "@/components/ui/button";
import { Swords, AlertTriangle, Info, FileCode, Zap, MonitorPlay, Cpu } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_RUST_IDS = [
  "RustFPSUncap", "RustDisableVSync",
  "RustHighPriority", "RustDisableThrottling", "RustGameMode",
  "RustLowShadows", "RustDisableBloom", "RustDisableMotionBlur",
  "RustWaterOff", "RustGrassShadowOff", "RustOcclusionOff", "RustDisableAniso",
  "RustNetworkBuffer", "RustNagleOff",
];

const RUST_RECOMMENDED = [
  "RustFPSUncap", "RustHighPriority", "RustDisableThrottling",
  "RustDisableVSync", "RustLowShadows", "RustDisableMotionBlur", "RustOcclusionOff",
];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps:      ["RustFPSUncap", "RustDisableVSync"],
  cpu:      ["RustHighPriority", "RustDisableThrottling", "RustGameMode"],
  graphics: ["RustLowShadows", "RustDisableMotionBlur", "RustWaterOff", "RustGrassShadowOff", "RustOcclusionOff", "RustDisableAniso", "RustDisableBloom"],
  network:  ["RustNagleOff", "RustNetworkBuffer"],
};

const CFG_PREVIEW = `# Rust client.cfg — written to %AppData%\\Rust\\cfg\\client.cfg
fps.limit -1
vsync.enabled false
graphics.shadowdistance 50
graphics.bloom 0
graphics.motionblur 0
graphics.water 0
grass.shadowcast 0
occlusion.base 0
graphics.aniso 0`;

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

export default function RustGame() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);

  const gpuLabel = hw.gpuName && hw.gpuName !== "Detecting..." ? hw.gpuName : "Your GPU";
  const isNvidiaUser = hw.isNvidia;
  const isLowVramNvidia = hw.nvidiaIsLowEnd;
  const isAmdGpu = hw.isAmdGpu;
  const isAmdCpu = hw.cpuBrand === "amd";
  const cpuLabel = isAmdCpu ? "AMD Ryzen" : hw.cpuBrand === "intel" ? "Intel Core" : "Your CPU";

  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-white">
        <div className="w-full px-4 py-8 pb-32">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <Swords className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Rust</h1>
                <p className="text-xs text-zinc-500">client.cfg patching · FPS uncap · CPU priority · GPU graphics tweaks</p>
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
                    <span className="flex items-center gap-1 text-[11px] bg-zinc-800 border border-white/10 text-zinc-300 rounded px-2 py-0.5 font-bold">
                      <Cpu className="w-3 h-3" /> {cpuLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {isLowVramNvidia
                      ? <>Your <span className="text-white font-semibold">{gpuLabel}</span> has 4–6GB VRAM. Rust is a Unity-based open-world game — water reflections, shadow rendering, and grass shadows are the heaviest GPU draws. <span className="text-orange-300 font-semibold">Water off and shadow distance reduction</span> are your highest-impact tweaks on limited VRAM.</>
                      : isAmdGpu
                      ? <>Rust on your <span className="text-white font-semibold">{gpuLabel}</span> benefits most from client.cfg shadow and water tweaks combined with the CPU priority stack. Rust's Unity renderer is CPU-bottlenecked in raids — the priority tweaks directly improve raid performance.</>
                      : <>All client.cfg and CPU tweaks apply regardless of GPU. The FPS uncap and shadow distance reduction are the biggest universal wins — Rust ships with conservative defaults that tank competitive performance.</>
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Hardware-specific issue cards */}
            {isLowVramNvidia && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { e: "🌊", label: "Water reflections expensive", fix: "graphics.water 0 — biggest VRAM saver" },
                  { e: "🌑", label: "Shadows fill VRAM", fix: "shadowdistance 50 — keep near, drop far" },
                  { e: "🌿", label: "Grass shadows = silent killer", fix: "grass.shadowcast 0 — outdoor FPS fix" },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2.5">
                    <p className="text-sm mb-0.5">{item.e} <span className="text-white font-bold text-xs">{item.label}</span></p>
                    <p className="text-[10px] text-zinc-500">{item.fix}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* client.cfg preview */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <FileCode className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-bold text-sm mb-1">client.cfg Patcher</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Rust reads console variables from{" "}
                  <span className="font-mono text-zinc-300">%AppData%\Rust\cfg\client.cfg</span> on every launch.
                  Selected tweaks write directly to this file — removing any existing line first, then appending the correct value.
                  The cfg folder is created automatically if it doesn't exist yet.
                </p>
              </div>
            </div>
            <div className="bg-black/60 rounded-lg border border-zinc-800 p-3 overflow-x-auto">
              <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{CFG_PREVIEW}</pre>
            </div>
            <p className="text-[11px] text-zinc-600 mt-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-zinc-500" />
              Run the downloaded .ps1 as Admin. Restart Rust after applying for changes to take effect.
            </p>
          </motion.div>

          {/* Smart bar */}
          <TabSmartBar
            tweakIds={ALL_RUST_IDS}
            recommendedIds={RUST_RECOMMENDED}
            label="Rust"
            context="Tweaks patch Rust's client.cfg and Windows registry for RustClient.exe. Safe for EAC — no game file modifications, only config and OS-level changes."
            tips={[
              isLowVramNvidia
                ? `Your ${gpuLabel} has limited VRAM — water off and shadow distance 50 are your biggest per-tweak FPS gains. Apply those before anything else.`
                : "fps.limit -1 and vsync.enabled false are the two biggest single wins — Rust has a default cap that tanks competitive play.",
              "Reducing shadow distance to 50 gives a large FPS boost in open-world areas with minimal visual impact.",
              isAmdCpu
                ? `${cpuLabel} benefits most from the High Priority IFEO tweak — Rust's Unity engine is CPU-bound in raid scenarios and raids are where you need every frame.`
                : "RustHighPriority via IFEO persists across reboots — more reliable than Steam's -high launch option.",
              "graphics.water 0 is especially effective on mid-range GPUs — water reflections are expensive in Rust's Unity renderer.",
            ]}
          />

          <PageGuide pageName="Rust Optimizer" />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-12 mt-6">

            {/* FPS & Frame Timing */}
            <section>
              <SectionHeader title="⚡ FPS & Frame Timing" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-5">
                {([
                  {
                    id: "RustFPSUncap",
                    title: "Uncap FPS (fps.limit -1)",
                    desc: "Writes fps.limit -1 to client.cfg — removes Rust's default FPS cap and lets your GPU output its maximum possible frames. Rust ships with a conservative cap that limits competitive performance. This is the highest single-toggle gain available.\n\nOn your hardware, unlocking FPS means your monitor's full refresh rate (144Hz, 165Hz, etc.) can be reached — VSync and the cap together were the main bottleneck.",
                    badge: "MUST HAVE",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RustDisableVSync",
                    title: "Disable VSync (vsync.enabled false)",
                    desc: "Sets vsync.enabled false in client.cfg — removes GPU sync delay and the 16–33ms input latency VSync introduces by waiting for a monitor refresh boundary before presenting a frame.\n\nIn Rust PvP, VSync input lag is the difference between your crosshair being on the target or half a frame behind during recoil. Always disable for competitive play unless you're using G-Sync or FreeSync.",
                    impact: "HIGH" as const,
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
              <SectionHeader title="🖥️ CPU & Process Priority" sectionKey="cpu" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              <div className="space-y-5">
                {([
                  {
                    id: "RustHighPriority",
                    title: `Set Rust to Above Normal CPU + High I/O Priority (${cpuLabel})`,
                    desc: isAmdCpu
                      ? `Registers RustClient.exe in IFEO with CpuPriorityClass=3 (Above Normal) and IoPriority=3 (High) — persistent across every reboot. On ${cpuLabel}, Rust's Unity engine is CPU-bound in raid scenarios with many players and structures. Above Normal priority ensures Rust threads are scheduled before all background apps during peak raid moments.`
                      : "Registers RustClient.exe in IFEO with CpuPriorityClass=3 and IoPriority=3 — persistent across every reboot. Ensures Windows always schedules Rust threads above background apps. More reliable than Steam's -high launch option, which only applies when Steam launches the game.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RustDisableThrottling",
                    title: "Disable Power Throttling for Rust",
                    desc: isAmdCpu
                      ? `Disables Windows Efficiency Mode / power throttling for RustClient.exe. On ${cpuLabel}, Windows can throttle Rust's thread power allocation. This forces full clock speed for Rust threads at all times — especially important during raids when CPU demand spikes suddenly.`
                      : "Disables Windows power throttling for RustClient.exe — ensures sustained clock speeds during raids and high-action moments. Prevents Windows from quietly reducing power to Rust threads between frames.",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RustGameMode",
                    title: "Enable Windows Game Mode + Disable Xbox DVR",
                    desc: "Enables Windows Game Mode so Windows deprioritizes background tasks while Rust is running. Disables Xbox Game DVR background capture hooks that add DirectX frame latency.\n\n⚠️ STREAMERS: Game Mode deprioritizes OBS/Streamlabs as a background task — this causes dropped stream frames. Skip this or manually set OBS to Above Normal priority.",
                    impact: "MED" as const,
                  },
                ]).map((item, i) => (
                  <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                    badge={item.badge} impact={item.impact}
                    checked={tweaks[item.id] || false} onCheckedChange={v => setTweak(item.id, v)} delay={i + 1} />
                ))}
              </div>
            </section>

            {/* Graphics Config */}
            <section>
              <SectionHeader title="🎨 Graphics Config (client.cfg)" sectionKey="graphics" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
              {isLowVramNvidia && (
                <div className="mb-3 flex items-start gap-2 bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400">
                    <span className="text-orange-300 font-semibold">Limited VRAM detected ({gpuLabel}).</span>{" "}
                    Water reflections and shadow rendering are the biggest VRAM consumers in Rust. Apply Water Off and Shadow Distance first for the biggest per-tweak gains.
                  </p>
                </div>
              )}
              <div className="space-y-5">
                {([
                  {
                    id: "RustLowShadows",
                    title: "Reduce Shadow Draw Distance to 50",
                    desc: isLowVramNvidia
                      ? `Sets graphics.shadowdistance 50 in client.cfg — major GPU savings with minimal visibility impact in PvP. On your ${gpuLabel}, shadow maps for distant objects consume VRAM that Rust could use for texture streaming. Reducing to 50 keeps close shadows (combat range) while dropping far shadows (irrelevant for PvP).`
                      : "Sets graphics.shadowdistance 50 in client.cfg — shadows still render at PvP ranges but distant outdoor shadows are culled. Large FPS gain in open fields and forests where distant shadow volumes are the GPU bottleneck.",
                    badge: "RECOMMENDED",
                    impact: "HIGH" as const,
                  },
                  {
                    id: "RustDisableMotionBlur",
                    title: "Disable Motion Blur",
                    desc: "Sets graphics.motionblur 0 in client.cfg — removes the motion blur pass entirely. Motion blur in Rust adds a full-screen post-process pass every frame and makes fast movement visually noisy during PvP. Disabling gives a cleaner image and frees a GPU pass.",
                    badge: "RECOMMENDED",
                    impact: "MED" as const,
                  },
                  {
                    id: "RustWaterOff",
                    title: "Disable Water Reflections",
                    desc: isLowVramNvidia
                      ? `Sets graphics.water 0 in client.cfg — disables expensive water reflection rendering. On your ${gpuLabel}, water reflections require a full secondary render pass with a separate reflection map. This is one of the highest single-tweak GPU gains in Rust, especially near rivers, lakes, and the coast.`
                      : "Sets graphics.water 0 in client.cfg — disables water reflections, which require a full secondary render pass. Significant GPU savings near water areas. Water surfaces still render without the reflection layer.",
                    badge: isLowVramNvidia ? "VRAM FIX" : undefined,
                    impact: isLowVramNvidia ? "HIGH" as const : "MED" as const,
                  },
                  {
                    id: "RustGrassShadowOff",
                    title: "Disable Grass Shadow Casting",
                    desc: isLowVramNvidia
                      ? `Sets grass.shadowcast 0 in client.cfg — grass stops casting dynamic shadows. On your ${gpuLabel}, Rust's procedural grass shadow system generates shadow volumes for every grass instance in range, creating a CPU+GPU spike in open outdoor areas. Disabling it is especially impactful during night raids on outdoor bases.`
                      : "Sets grass.shadowcast 0 in client.cfg — removes per-grass-instance dynamic shadow casting. Significant FPS gain in open outdoor areas and grassy fields where many grass shadows are computed simultaneously.",
                    impact: isLowVramNvidia ? "HIGH" as const : "MED" as const,
                  },
                  {
                    id: "RustOcclusionOff",
                    title: "Disable Occlusion Culling CPU Pass",
                    desc: "Sets occlusion.base 0 in client.cfg — removes Rust's per-frame CPU occlusion check pass. In complex outdoor scenes with many players and structures, occlusion culling can add 3–8ms of CPU overhead per frame. Disabling it lets the GPU render visible geometry directly without waiting for the CPU culling result.",
                    badge: "RECOMMENDED",
                    impact: "MED" as const,
                  },
                  {
                    id: "RustDisableBloom",
                    title: "Disable Bloom",
                    desc: "Sets graphics.bloom 0 in client.cfg — removes Rust's bloom glow effect. Bloom runs a multi-pass Gaussian blur on the HDR buffer every frame. Removing it frees GPU bandwidth and eliminates the visual glow that can obscure targets near bright light sources.",
                    impact: "MED" as const,
                  },
                  {
                    id: "RustDisableAniso",
                    title: "Disable Anisotropic Filtering",
                    desc: "Sets graphics.aniso 0 in client.cfg — removes anisotropic texture filtering. At normal PvP distances in Rust, the difference between AF 16x and AF 0 is invisible. Disabling it frees texture sampling bandwidth, especially at high resolutions or on GPUs with limited memory bandwidth.",
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
                    id: "RustNagleOff",
                    title: "Disable Nagle Algorithm (Immediate Packet Send)",
                    desc: "Sets TcpNoDelay=1 and TcpAckFrequency=1 — forces immediate TCP packet sends instead of batching segments. Reduces ping variance during raids and PvP. Nagle's algorithm adds up to 200ms of buffering on slow connections — disabling it tightens Rust's server tick alignment on any connection.",
                    badge: "RECOMMENDED",
                    impact: "MED" as const,
                  },
                  {
                    id: "RustNetworkBuffer",
                    title: "Increase Network Socket Buffers to 256KB",
                    desc: "Sets AFD receive and send buffers to 256KB — handles burst traffic from Rust servers during large raids (many players, structures, explosions) without packet loss or rubberbanding. Direct improvement during online-heavy scenarios like zerg raids.",
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
                  title: "Steam Launch Options",
                  body: "-force-d3d11 is no longer recommended — Rust on Unity 2020+ runs DX11 by default. Use -high for an additional process priority boost from Steam (optional alongside IFEO, which is more persistent).",
                },
                {
                  title: "EAC Safe",
                  body: "All tweaks are Windows-level registry + config file changes. EasyAntiCheat only monitors game memory — client.cfg and IFEO entries are completely undetected by EAC.",
                },
                {
                  title: "After Driver Updates",
                  body: "IFEO priority changes persist permanently through driver updates and Windows updates. client.cfg settings persist across Rust game updates. Re-run only after a full Windows reinstall.",
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
