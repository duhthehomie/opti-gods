import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Button } from "@/components/ui/button";
import { Blocks, AlertTriangle, Info, FileCode, Zap } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_ROBLOX_IDS = [
  "RobloxFPSUnlock", "RobloxDisablePostFX", "RobloxReduceLightUpdates", "RobloxDisableSSAO",
  "RobloxHighPriority", "RobloxDisableThrottling", "RobloxGameMode",
  "RobloxNetworkBuffer", "RobloxNagleOff",
];
const ROBLOX_RECOMMENDED = ["RobloxFPSUnlock", "RobloxHighPriority", "RobloxDisableThrottling", "RobloxDisablePostFX", "RobloxDisableSSAO"];

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps: ["RobloxFPSUnlock", "RobloxDisablePostFX"],
  cpu: ["RobloxHighPriority", "RobloxDisableThrottling"],
};

const FFLAGS_PREVIEW = `// ClientAppSettings.json — written to:
// %LocalAppData%\\Roblox\\Versions\\<version>\\ClientSettings\\

{
  "DFIntTaskSchedulerTargetFps": 9999,
  "FFlagDisablePostFx": true,
  "FIntRenderLocalLightUpdatesMax": 8,
  "FIntRenderLocalLightUpdatesMin": 6
}`;

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

export default function RobloxPage() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <AppLayout>
      <div className="space-y-6 w-full pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Blocks className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Roblox Optimizer</h1>
            <p className="text-zinc-500 text-sm">FFlag patching, FPS unlock, CPU priority, and post-FX removal for Roblox</p>
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
              <h3 className="text-white font-bold text-sm mb-1">FFlags Patcher — ClientAppSettings.json</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Roblox exposes internal feature flags via
                <span className="font-mono text-zinc-300 mx-1">ClientAppSettings.json</span>
                inside each version folder under
                <span className="font-mono text-zinc-300 mx-1">%LocalAppData%\Roblox\Versions\</span>.
                The script iterates all installed versions, creates the
                <span className="font-mono text-zinc-300 mx-1">ClientSettings</span> folder if needed,
                and merges your selected flags — preserving any existing custom flags you've set manually.
              </p>
            </div>
          </div>
          <div className="bg-black/60 rounded-lg border border-zinc-800 p-3 overflow-x-auto">
            <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{FFLAGS_PREVIEW}</pre>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-zinc-500" />
            Roblox may reset FFlags after a client update. Re-run the script after Roblox updates itself. Run as Admin.
          </p>
        </motion.div>

        <PageGuide pageName="Roblox Optimizer" />

        <TabSmartBar
          tweakIds={ALL_ROBLOX_IDS}
          recommendedIds={ROBLOX_RECOMMENDED}
          label="Roblox"
          context="Tweaks write to Roblox FFlags (ClientAppSettings.json) and Windows registry for RobloxPlayerBeta.exe. No game file modifications — safe for all Roblox games."
          tips={[
            "FPS Unlock via FFlags is the safest method — no third-party injector, just a JSON flag that Roblox reads natively.",
            "Roblox re-downloads its client on updates, which may reset FFlags. Keep the script to re-apply quickly.",
            "DisablePostFX removes bloom and depth of field — significant FPS gain on integrated graphics and older GPUs.",
          ]}
        />

        <div className="space-y-8">

          <section>
            <SectionHeader title="FPS & Rendering" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} />
            <div className="space-y-3">
              {[
                { id: "RobloxFPSUnlock", title: "Unlock FPS via FFlags (9999 target)", desc: "Writes DFIntTaskSchedulerTargetFps=9999 to ClientAppSettings.json — bypasses Roblox's 60fps cap without external tools.", badge: "MUST HAVE", impact: "HIGH" as const },
                { id: "RobloxDisablePostFX", title: "Disable Post-Processing Effects", desc: "Sets FFlagDisablePostFx=true in FFlags — removes bloom, depth of field, and color grading for cleaner visuals and better performance.", impact: "MED" as const },
                { id: "RobloxReduceLightUpdates", title: "Reduce Local Light Update Frequency", desc: "Lowers FIntRenderLocalLightUpdatesMax/Min in FFlags — reduces how often dynamic lights are recomputed, freeing GPU time.", impact: "MED" as const },
                { id: "RobloxDisableSSAO", title: "Disable Ambient Occlusion & Sky Overhead", desc: "Sets FFlagRenderNoLowFiSky=true and disables expensive light attenuation in FFlags — removes ambient occlusion shadow computation and sky rendering overhead. Measurable GPU savings on mid-range hardware.", badge: "RECOMMENDED", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="CPU & Process Priority" sectionKey="cpu" tweaks={tweaks} setTweak={setTweak} />
            <div className="space-y-3">
              {[
                { id: "RobloxHighPriority", title: "Set Roblox to Above Normal CPU + High I/O Priority", desc: "Registers RobloxPlayerBeta.exe in IFEO with CpuPriorityClass=3 and IoPriority=3 — persistent across reboots.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "RobloxDisableThrottling", title: "Disable Power Throttling for Roblox", desc: "Disables Windows power throttling for Roblox — ensures sustained CPU clock speeds during gameplay.", impact: "HIGH" as const },
                { id: "RobloxGameMode", title: "Enable Windows Game Mode", desc: "Enables Game Mode so Windows deprioritizes background tasks while Roblox is running.", impact: "MED" as const },
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
                { id: "RobloxNetworkBuffer", title: "Increase Network Socket Buffers", desc: "Increases AFD send/receive buffers to 256KB — reduces packet loss and lag spikes on Roblox servers.", impact: "MED" as const },
                { id: "RobloxNagleOff", title: "Disable Nagle Algorithm", desc: "Sets TcpNoDelay=1 and TcpAckFrequency=1 — forces immediate packet sends, reducing ping variance during fast-paced Roblox game modes.", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "No Injector Needed", body: "DFIntTaskSchedulerTargetFps is an official Roblox FFlag — no third-party FPS unlocker app required. The flag is read natively by Roblox on startup." },
              { title: "After Updates", body: "Roblox auto-updates its client and may reset FFlags. Re-run the script after Roblox updates. The script handles all version folders automatically." },
              { title: "Byfron Note", body: "All tweaks are OS-level (registry + JSON flags). Roblox's Hyperion anti-cheat monitors game memory injection — these changes are undetected." },
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
