import { motion } from "framer-motion";
import { Music, Monitor, RefreshCw, Info, AlertTriangle, MonitorPlay, Cpu } from "lucide-react";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";

export default function SpotifyPage() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();

  const gpuLabel = hw.gpuName && hw.gpuName !== "Detecting..." ? hw.gpuName : null;
  const isLowVram = hw.nvidiaIsLowEnd;
  const isIgpu = hw.isAmdApu || hw.isIntel;
  const isAmdCpu = hw.cpuBrand === "amd";
  const cpuLabel = isAmdCpu ? "AMD Ryzen" : hw.cpuBrand === "intel" ? "Intel Core" : "Your CPU";
  const detected = !hw.loading && gpuLabel;

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

      {/* Hardware-aware callout — shown once detection completes */}
      {detected && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/5 bg-zinc-900/60 p-4"
        >
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {hw.isNvidia && (
                  <span className="flex items-center gap-1 text-[11px] bg-green-500/10 border border-green-500/25 text-green-400 rounded px-2 py-0.5 font-bold">
                    <MonitorPlay className="w-3 h-3" /> {gpuLabel}
                  </span>
                )}
                {hw.isAmdGpu && !hw.isNvidia && (
                  <span className="flex items-center gap-1 text-[11px] bg-red-500/10 border border-red-500/25 text-red-400 rounded px-2 py-0.5 font-bold">
                    <MonitorPlay className="w-3 h-3" /> {gpuLabel}
                  </span>
                )}
                {isIgpu && (
                  <span className="flex items-center gap-1 text-[11px] bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded px-2 py-0.5 font-bold">
                    <MonitorPlay className="w-3 h-3" /> {gpuLabel} (iGPU)
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] bg-zinc-800 border border-white/10 text-zinc-300 rounded px-2 py-0.5 font-bold">
                  <Cpu className="w-3 h-3" /> {cpuLabel}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {isIgpu
                  ? <>Your <span className="text-white font-semibold">{gpuLabel}</span> shares memory with the CPU. Spotify's GPU compositor directly competes on the same shared memory bus — significantly more costly than on a discrete GPU. <span className="text-amber-300 font-semibold">Disabling GPU acceleration</span> is your highest-priority tweak and will free shared memory bandwidth your game needs.</>
                  : isLowVram
                  ? <>Your <span className="text-white font-semibold">{gpuLabel}</span> has 4–6GB VRAM. Spotify's Chromium GPU compositor hooks into the same VRAM pool as your game — on limited-VRAM cards this directly reduces the rendering budget available for FPS. <span className="text-red-300 font-semibold">Disable GPU Acceleration first.</span></>
                  : <>Your <span className="text-white font-semibold">{gpuLabel}</span> detected. Spotify's compositor and CPU priority tweaks apply to your hardware — the GPU acceleration disable frees compositor overhead and the CPU de-priority ensures your game threads are always scheduled first.</>
                }
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Why Spotify hurts FPS */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-300">Why Spotify tanks FPS</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Spotify uses a <span className="text-white font-semibold">Chromium-based UI</span> that grabs the GPU compositor by default, consuming VRAM and GPU cycles{isLowVram || isIgpu ? <span className="text-amber-300 font-semibold"> — especially costly on your {isIgpu ? "shared-memory" : "limited-VRAM"} setup</span> : " on 4–8GB cards"}.
            It also runs at <span className="text-white font-semibold">Normal CPU priority</span> — same as your game — meaning it competes directly for {isAmdCpu ? <>thread time on your <span className="text-white font-semibold">{cpuLabel}</span></> : "thread time"} during frame bursts.
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
            title={`Set Spotify to Below Normal CPU Priority${isAmdCpu ? ` (${cpuLabel})` : ""}`}
            description={
              isAmdCpu
                ? `Registers Spotify.exe in Windows IFEO with Below Normal CPU priority + Low I/O priority. Persists across every reboot. On ${cpuLabel}, Spotify competes with your game on the same physical cores — frame-time spikes occur when Spotify's audio decode thread runs at equal priority. This fix ensures Spotify audio threads never steal scheduler time from your game.`
                : "Registers Spotify.exe in Windows IFEO with Below Normal CPU priority + Low I/O priority. Persists across every reboot — Spotify stays open for music but won't compete with your game's threads for frame time. This is the single biggest Spotify FPS fix."
            }
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
            description={
              isIgpu
                ? `Spotify's Chromium UI uses GPU hardware acceleration by default — on your ${gpuLabel || "iGPU"} (shared memory), this compositor runs on the same memory bus as your game. Every frame Spotify renders competes for shared bandwidth. Writes hardware_acceleration=false to Spotify's prefs file. Restart Spotify once to apply — largest single-tweak FPS gain on shared-memory setups.`
                : isLowVram
                ? `Spotify's Chromium UI hooks into your ${gpuLabel || "GPU"}'s compositor layer, consuming VRAM and creating DPC interrupt overhead. On your ${gpuLabel}, this directly reduces the VRAM budget available to your game. Writes hardware_acceleration=false to Spotify's prefs file. Restart Spotify once to apply.`
                : "Spotify's Chromium UI uses hardware GPU acceleration by default — it hooks into your GPU's compositor layer, wasting VRAM and creating DPC interrupt overhead. Writes hardware_acceleration=false to Spotify's prefs file. Restart Spotify once to apply."
            }
            badge={isIgpu ? "IGPU PRIORITY" : isLowVram ? "VRAM FIX" : "GPU FIX"}
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
