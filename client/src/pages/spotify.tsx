import { motion } from "framer-motion";
import { Music, Monitor, RefreshCw, Info, AlertTriangle } from "lucide-react";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";

export default function SpotifyPage() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <div className="space-y-6 px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Music className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Spotify While Gaming</h2>
          <p className="text-[11px] text-zinc-500">Stop Spotify from eating FPS while you game with music on</p>
        </div>
      </div>

      {/* Why Spotify hurts FPS */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-300">Why Spotify tanks FPS</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Spotify uses a <span className="text-white font-semibold">Chromium-based UI</span> that grabs the GPU compositor by default, consuming VRAM and GPU cycles on 4-8GB cards.
            It also runs at <span className="text-white font-semibold">Normal CPU priority</span> — same as your game — meaning it competes directly for thread time during frame bursts.
            The tweaks below solve both without closing Spotify.
          </p>
        </div>
      </div>

      {/* CPU Priority Section */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">⚡ CPU Priority</h2>
        <div className="space-y-4">
          <TweakRow
            id="SpotifyLowPriority"
            title="Set Spotify to Below Normal CPU Priority"
            description="Registers Spotify.exe in Windows IFEO (Image File Execution Options) with Below Normal CPU priority + Low I/O priority. Persists across every reboot — Spotify stays open for music but won't compete with your game's threads for frame time. This is the single biggest Spotify FPS fix."
            badge="FPS SAVER"
            impact="HIGH"
            checked={tweaks["SpotifyLowPriority"] || false}
            onCheckedChange={v => setTweak("SpotifyLowPriority", v)}
            delay={0}
          />
        </div>
      </section>

      {/* GPU Section */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-1 h-4 rounded bg-emerald-500" />
          <Monitor className="w-3.5 h-3.5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">GPU & VRAM</h2>
        </div>
        <div className="space-y-4">
          <TweakRow
            id="SpotifyDisableGPU"
            title="Disable Spotify Hardware GPU Acceleration"
            description="Spotify's Chromium UI uses hardware GPU acceleration by default — it hooks into your GPU's compositor layer, wasting VRAM and creating DPC interrupt overhead. On 4-6GB VRAM cards (GTX 1060, 1650, RX 580) this directly reduces the VRAM budget available to your game. Writes hardware_acceleration=false to Spotify's prefs file. Restart Spotify once to apply."
            badge="GPU FIX"
            impact="HIGH"
            checked={tweaks["SpotifyDisableGPU"] || false}
            onCheckedChange={v => setTweak("SpotifyDisableGPU", v)}
            delay={1}
          />
        </div>
      </section>

      {/* Background Processes Section */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-1 h-4 rounded bg-zinc-500" />
          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Background Activity</h2>
        </div>
        <div className="space-y-4">
          <TweakRow
            id="SpotifyDisableAutoUpdate"
            title="Disable Spotify Auto-Update During Gaming"
            description="Spotify downloads and installs updates in the background using scheduled tasks — causing CPU and disk spikes mid-game at random intervals. Disables the Spotify Update scheduled task and sets autoupdate=false in prefs so updates only happen when you manually open Spotify."
            badge="FPS SAVER"
            impact="MED"
            checked={tweaks["SpotifyDisableAutoUpdate"] || false}
            onCheckedChange={v => setTweak("SpotifyDisableAutoUpdate", v)}
            delay={2}
          />
          <TweakRow
            id="SpotifyLimitBandwidth"
            title="Limit Spotify Background Bandwidth"
            description="Spotify prefetches HQ tracks and podcast data in the background, creating disk and network spikes during gaming sessions. Disables HQ background downloads and podcast prefetch in prefs — music still streams normally, but Spotify stops hogging disk and network while you're in game."
            badge="NETWORK"
            impact="MED"
            checked={tweaks["SpotifyLimitBandwidth"] || false}
            onCheckedChange={v => setTweak("SpotifyLimitBandwidth", v)}
            delay={3}
          />
        </div>
      </section>

      {/* Tip */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/8 bg-zinc-950/40">
        <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-zinc-400">Also useful</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Go to <span className="text-zinc-300 font-semibold">Startup Apps</span> tab → disable Spotify from auto-starting with Windows.
            If you use Spotify in the browser instead, those tweaks don't apply — use your browser's task manager to pin the priority instead.
          </p>
        </div>
      </div>
    </div>
  );
}
