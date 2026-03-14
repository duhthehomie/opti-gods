import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Crosshair, AlertTriangle, Info, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

const FPS_CAP_SCRIPT = `# --- FORTNITE FPS UNCAP (Run as Admin) ---
$configPath = "$env:LOCALAPPDATA\\FortniteGame\\Saved\\Config\\WindowsClient\\GameUserSettings.ini"

if (!(Test-Path $configPath)) {
  Write-Host "[ERROR] GameUserSettings.ini not found. Launch Fortnite at least once first." -ForegroundColor Red
  exit
}

# Check & remove read-only
$wasReadOnly = (Get-Item $configPath).IsReadOnly
if ($wasReadOnly) {
  Set-ItemProperty $configPath -Name IsReadOnly -Value $false
  Write-Host "[INFO] Removed read-only flag from GameUserSettings.ini" -ForegroundColor Yellow
}

# Uncap FPS
(Get-Content $configPath) -replace 'FrameRateLimit=\\d+\\.?\\d*', 'FrameRateLimit=0.000000' | Set-Content $configPath -Encoding UTF8
Write-Host "[OK] Lobby + Menu FPS limit removed (FrameRateLimit=0.000000)" -ForegroundColor Green

# Also patch [/Script/FortniteGame.FortGameUserSettings]
$content = Get-Content $configPath -Raw
if ($content -notmatch 'bShowFPS') {
  Add-Content $configPath ([Environment]::NewLine + "bShowFPS=False")
}
Write-Host "[OK] FPS display toggle preserved" -ForegroundColor Green
Write-Host ""
Write-Host "Restart Fortnite for changes to take effect." -ForegroundColor Cyan`;

export default function Fortnite() {
  const { tweaks, setTweak } = useOptimizationStore();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Crosshair className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Fortnite Optimizer</h1>
            <p className="text-zinc-500 text-sm">Deep performance tweaks, FPS uncap, and config patching for competitive play</p>
          </div>
        </motion.div>

        {/* FPS Uncap Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-red-500/30 bg-red-500/5 p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <FileCode className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-white font-bold text-sm mb-1">FPS Uncap — GameUserSettings.ini Patcher</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Fortnite hard-caps FPS at 120 in menus by default. The script below finds your
                <span className="font-mono text-zinc-300 mx-1">GameUserSettings.ini</span>, 
                detects if it's read-only, removes the flag automatically, and sets
                <span className="font-mono text-zinc-300 mx-1">FrameRateLimit=0.000000</span>
                to completely uncap the limit. Included in the Download Script when toggled ON.
              </p>
            </div>
          </div>
          <div className="bg-black/60 rounded-lg border border-zinc-800 p-3 overflow-x-auto">
            <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{FPS_CAP_SCRIPT}</pre>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
            Run as Administrator. Launch Fortnite once before running so the config file exists.
          </p>
        </motion.div>

        <div className="space-y-8">

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">FPS & Frame Timing</h2>
            <div className="space-y-3">
              {[
                { id: "FortniteUncapLobbyFPS", title: "Uncap Lobby & Menu FPS (GameUserSettings.ini)", desc: "Patches GameUserSettings.ini to set FrameRateLimit=0.000000 — removes the 120fps menu cap. Handles read-only files automatically.", badge: "MUST HAVE" },
                { id: "FortniteUncapGameFPS", title: "Uncap In-Game FPS via Engine.ini", desc: "Adds t.MaxFPS=0 to Engine.ini — overrides any engine-level frame cap during gameplay.", badge: "RECOMMENDED" },
                { id: "FortniteDisableVSync", title: "Force VSync Off", desc: "Disables VSync in Engine.ini — removes GPU sync overhead and the added frame latency." },
                { id: "FortniteGameMode", title: "Enable Windows Game Mode for Fortnite", desc: "Enables GPU priority mode in Windows Game Mode registry for Fortnite process." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">CPU & Process Priority</h2>
            <div className="space-y-3">
              {[
                { id: "FortniteHighPriority", title: "Set Fortnite to Above Normal CPU Priority", desc: "Registers FortniteClient-Win64-Shipping.exe in IFEO with CpuPriorityClass=6 (Above Normal) — persistent across reboots.", badge: "RECOMMENDED" },
                { id: "FortniteAffinityPhysical", title: "Pin Fortnite to Physical Cores Only", desc: "Removes hyperthreaded virtual cores from Fortnite's affinity mask — reduces cache thrashing on Intel HT CPUs." },
                { id: "FortniteDisableThrottling", title: "Disable CPU Throttling for Fortnite", desc: "Disables power throttling via registry for Fortnite's process — ensures sustained clock speeds." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Engine.ini Config Patches</h2>
            <div className="space-y-3">
              {[
                { id: "FortniteEngineStreaming", title: "Optimize Streaming Pool & Asset Loading", desc: "Sets r.Streaming.PoolSize=2048 and enables async bulk data loading — reduces texture pop-in and asset streaming hitches." },
                { id: "FortniteDisableMotionBlur", title: "Disable Motion Blur & Lens Flare", desc: "Adds r.MotionBlurQuality=0 and r.LensFlareQuality=0 to Engine.ini — removes blur and gains back ~3–5% GPU performance." },
                { id: "FortniteLowShadows", title: "Force Minimal Shadow Quality", desc: "Sets r.Shadow.MaxResolution=512 and r.ShadowQuality=0 in Engine.ini — significant GPU savings, especially at high resolutions." },
                { id: "FortniteDisableLumen", title: "Disable Lumen Global Illumination", desc: "Forces r.DynamicGlobalIlluminationMethod=0 — disables Lumen GI for a significant FPS boost on mid-range GPUs." },
                { id: "FortniteDisableRecording", title: "Disable Background Video Recording", desc: "Disables Fortnite's built-in replay/recording via Engine.ini — frees GPU encoder bandwidth." },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Graphics API</h2>
            <div className="space-y-3">
              {[
                { id: "FortniteForceDirectX12", title: "Force DirectX 12 Mode", desc: "Adds -dx12 to Fortnite's launch config — DX12 enables better multi-core CPU utilization and async compute. Recommended for RTX cards.", badge: "RTX USERS" },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Network & Input</h2>
            <div className="space-y-3">
              {[
                { id: "FortniteNetworkBuffer", title: "Increase Epic Games Network Buffers", desc: "Bumps socket send/receive buffers to 256KB for Epic server connections — reduces packet loss on congested connections." },
                { id: "FortniteInputLatency", title: "Minimize Input Latency (Raw Input Buffer)", desc: "Disables raw input buffering via Engine.ini (r.RawInput.EnableRawInput=0 workaround) — lowers mouse latency on high-Hz polling mice.", badge: "HIGH-HZ MICE" },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Optimal Settings", body: "720p or 1080p + Epic shadows OFF + Temporal AA. DX12 if on RTX 3000+. Performance mode for sub-60fps systems." },
              { title: "Read-Only Files", body: "Epic sometimes marks config files read-only after updates. The scripts handle this automatically — no manual fixing needed." },
              { title: "Anti-Cheat Note", body: "All tweaks are Windows-level registry/config changes. Nothing injects into the game or modifies game files. EAC safe." },
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
