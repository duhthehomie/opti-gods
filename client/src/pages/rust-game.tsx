import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Button } from "@/components/ui/button";
import { Swords, AlertTriangle, Info, FileCode, Zap } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_RUST_IDS = [
  "RustFPSUncap", "RustDisableVSync",
  "RustHighPriority", "RustDisableThrottling", "RustGameMode",
  "RustLowShadows", "RustDisableBloom", "RustDisableMotionBlur", "RustWaterOff", "RustGrassShadowOff",
  "RustOcclusionOff", "RustDisableAniso",
  "RustNetworkBuffer", "RustNagleOff",
];
const RUST_RECOMMENDED = ["RustFPSUncap", "RustHighPriority", "RustDisableThrottling", "RustDisableVSync", "RustLowShadows", "RustDisableMotionBlur", "RustOcclusionOff"];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps: ["RustFPSUncap", "RustDisableVSync"],
  cpu: ["RustHighPriority", "RustDisableThrottling"],
  graphics: ["RustLowShadows", "RustDisableMotionBlur"],
};

const CFG_PREVIEW = `# Rust client.cfg — written to %AppData%\\Rust\\cfg\\client.cfg
fps.limit -1
vsync.enabled false
graphics.shadowdistance 50
graphics.bloom 0
graphics.motionblur 0
graphics.water 0
grass.shadowcast 0`;

function SectionHeader({ title, sectionKey, tweaks, setTweak }: {
  title: string; sectionKey: string;
  tweaks: Record<string, boolean>; setTweak: (id: string, v: boolean) => void;
}) {
  const ids = SECTION_RECOMMENDED[sectionKey] || [];
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
      >
        <Zap className="w-3 h-3" />
        {allOn ? "Recommended ON" : `Enable Recommended (${ids.length})`}
      </Button>
    </div>
  );
}

export default function RustGame() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <AppLayout>
      <div className="space-y-6 w-full pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <img src="/rust-logo.png" alt="Rust" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-display font-bold">Rust Optimizer</h1>
            <p className="text-zinc-500 text-sm">client.cfg patching, FPS uncap, CPU priority, and graphics tweaks for Rust (Steam)</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-red-500/30 bg-red-500/5 p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <FileCode className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-white font-bold text-sm mb-1">client.cfg Patcher</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Rust reads console variables from
                <span className="font-mono text-zinc-300 mx-1">%AppData%\Rust\cfg\client.cfg</span>
                on every launch. The selected tweaks below write directly to this file — removing any existing line first, then appending the correct value. The cfg folder is created automatically if it doesn't exist yet.
              </p>
            </div>
          </div>
          <div className="bg-black/60 rounded-lg border border-zinc-800 p-3 overflow-x-auto">
            <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{CFG_PREVIEW}</pre>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-zinc-500" />
            Run the downloaded .ps1 as Admin. Restart Rust after applying for changes to take effect.
          </p>
        </motion.div>

        <PageGuide pageName="Rust Optimizer" />

        <TabSmartBar
          tweakIds={ALL_RUST_IDS}
          recommendedIds={RUST_RECOMMENDED}
          label="Rust"
          context="Tweaks patch Rust's client.cfg and Windows registry for the RustClient.exe process. Safe for EAC — no game file modifications, only config and OS-level changes."
          tips={[
            "fps.limit -1 and vsync.enabled false are the two biggest single wins — Rust has a default cap that tanks competitive play.",
            "Reducing shadow distance to 50 gives a large FPS boost in open-world areas with minimal visual impact.",
            "graphics.water 0 is especially effective on mid-range GPUs — water reflections are expensive in Rust.",
          ]}
        />

        <div className="space-y-8">

          <section>
            <SectionHeader title="FPS & Frame Timing" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} />
            <div className="space-y-3">
              {[
                { id: "RustFPSUncap", title: "Uncap FPS (fps.limit -1)", desc: "Writes fps.limit -1 to client.cfg — removes the default FPS cap for maximum frames.", badge: "MUST HAVE", impact: "HIGH" as const },
                { id: "RustDisableVSync", title: "Disable VSync", desc: "Sets vsync.enabled false in client.cfg — removes GPU sync delay and the input latency VSync adds.", impact: "HIGH" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="CPU & Process Priority" sectionKey="cpu" tweaks={tweaks} setTweak={setTweak} />
            <div className="space-y-3">
              {[
                { id: "RustHighPriority", title: "Set Rust to Above Normal CPU + High I/O Priority", desc: "Registers RustClient.exe in IFEO with CpuPriorityClass=3 and IoPriority=3 — persistent across reboots.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "RustDisableThrottling", title: "Disable Power Throttling for Rust", desc: "Disables Windows power throttling for RustClient.exe — ensures sustained clock speeds during raids and high-action moments.", impact: "HIGH" as const },
                { id: "RustGameMode", title: "Enable Windows Game Mode", desc: "Enables Windows Game Mode — Windows deprioritizes background tasks while Rust is running.", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="Graphics Config (client.cfg)" sectionKey="graphics" tweaks={tweaks} setTweak={setTweak} />
            <div className="space-y-3">
              {[
                { id: "RustLowShadows", title: "Reduce Shadow Draw Distance", desc: "Sets graphics.shadowdistance 50 in client.cfg — major GPU savings with minimal visibility impact in PvP.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "RustDisableMotionBlur", title: "Disable Motion Blur", desc: "Sets graphics.motionblur 0 in client.cfg — removes motion blur for a cleaner image during fast movement.", badge: "RECOMMENDED", impact: "MED" as const },
                { id: "RustDisableBloom", title: "Disable Bloom", desc: "Sets graphics.bloom 0 in client.cfg — removes bloom glow effect, frees GPU bandwidth.", impact: "MED" as const },
                { id: "RustWaterOff", title: "Disable Water Reflections", desc: "Sets graphics.water 0 in client.cfg — disables expensive water reflection rendering.", impact: "MED" as const },
                { id: "RustGrassShadowOff", title: "Disable Grass Shadow Casting", desc: "Sets grass.shadowcast 0 in client.cfg — grass stops casting dynamic shadows, significant FPS gain in open areas.", impact: "MED" as const },
                { id: "RustOcclusionOff", title: "Disable Occlusion Culling", desc: "Sets occlusion.base 0 in client.cfg — removes per-frame CPU overhead from occlusion checks. Rust's occlusion pass can spike on complex outdoor scenes with many players. Visible geometry is rendered directly.", badge: "RECOMMENDED", impact: "MED" as const },
                { id: "RustDisableAniso", title: "Disable Anisotropic Filtering", desc: "Sets graphics.aniso 0 in client.cfg — removes anisotropic texture filtering, freeing GPU texture sampling budget. Minimal visual impact at normal PvP viewing distances.", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Network</h2>
            <div className="space-y-3">
              {[
                { id: "RustNetworkBuffer", title: "Increase Network Socket Buffers", desc: "Sets AFD send/receive buffers to 256KB — reduces packet loss and network hiccups on Rust servers.", impact: "MED" as const },
                { id: "RustNagleOff", title: "Disable Nagle Algorithm", desc: "Sets TcpNoDelay=1 and TcpAckFrequency=1 — forces immediate TCP packet sends instead of batching. Reduces ping variance during raids and PvP engagements.", badge: "RECOMMENDED", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Steam Launch Options", body: '-force-d3d11 is no longer recommended — Rust on Unity 2020+ runs DX11 by default. Use -high for process priority boost from Steam (optional alongside IFEO).' },
              { title: "EAC Safe", body: "All tweaks are Windows-level registry + config file changes. EasyAntiCheat only monitors game memory — client.cfg and IFEO entries are undetected." },
              { title: "After Driver Update", body: "IFEO priority changes persist permanently. client.cfg settings persist across game updates. Re-run the script after a full Windows reinstall." },
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

        </div>
      </div>
    </AppLayout>
  );
}
