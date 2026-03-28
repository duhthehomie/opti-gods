import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { computeSmartRecs } from "@/lib/smart-recommendations";
import { Button } from "@/components/ui/button";
import { Crosshair, AlertTriangle, Info, FileCode, Zap } from "lucide-react";
import { PageGuide } from "@/components/page-guide";
import { cn } from "@/lib/utils";

const ALL_FORTNITE_IDS = [
  "FortniteUncapLobbyFPS","FortniteUncapGameFPS","FortniteDisableVSync","FortniteGameMode",
  "FortniteHighPriority","FortniteAffinityPhysical","FortniteDisableThrottling",
  "FortniteEngineStreaming","FortniteDisableMotionBlur","FortniteLowShadows","FortniteDisableLumen",
  "FortniteForceDirectX12","FortniteDisableRecording","FortniteNetworkBuffer","FortniteInputLatency",
];
const FORTNITE_RECOMMENDED = ["FortniteUncapLobbyFPS","FortniteHighPriority","FortniteDisableThrottling","FortniteDisableVSync"];

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

const SECTION_RECOMMENDED: Record<string, string[]> = {
  fps: ["FortniteUncapLobbyFPS", "FortniteUncapGameFPS", "FortniteDisableVSync"],
  cpu: ["FortniteHighPriority", "FortniteDisableThrottling"],
  engine: ["FortniteDisableMotionBlur", "FortniteLowShadows"],
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
      >
        <Zap className="w-3 h-3" />
        {allOn ? "Recommended ON" : `Enable Recommended (${ids.length})`}
      </Button>
    </div>
  );
}

export default function Fortnite() {
  const { tweaks, setTweak } = useOptimizationStore();
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const smartRecs = computeSmartRecs(hw, os);

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
            <AlertTriangle className="w-3 h-3 text-zinc-500" />
            Double-click to run — admin is requested automatically. Launch Fortnite once first so the config file exists.
          </p>
        </motion.div>

        <PageGuide pageName="Fortnite Optimizer" />

        <TabSmartBar
          tweakIds={ALL_FORTNITE_IDS}
          recommendedIds={FORTNITE_RECOMMENDED}
          label="Fortnite"
          context="Tweaks patch Engine.ini, GameUserSettings.ini, and Windows registry for Fortnite process. The script runs as Administrator and backs up config files before modifying them."
          tips={[
            "Uncap Lobby FPS is the biggest single win — Fortnite's 120fps menu cap causes stutters when transitioning into matches.",
            "Force disable VSync — any VSync in Fortnite adds 1–2 frames of input latency.",
            "Physical core affinity helps on Intel Hyper-Threading CPUs where cache thrashing is common.",
          ]}
        />

        <div className="space-y-8">

          <section>
            <SectionHeader title="FPS & Frame Timing" sectionKey="fps" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
            <div className="space-y-3">
              {[
                { id: "FortniteUncapLobbyFPS", title: "Uncap Lobby & Menu FPS (GameUserSettings.ini)", desc: "Patches GameUserSettings.ini to set FrameRateLimit=0.000000 — removes the 120fps menu cap. Handles read-only files automatically.", badge: "MUST HAVE", impact: "HIGH" as const },
                { id: "FortniteUncapGameFPS", title: "Uncap In-Game FPS via Engine.ini", desc: "Adds t.MaxFPS=0 to Engine.ini — overrides any engine-level frame cap during gameplay.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "FortniteDisableVSync", title: "Force VSync Off", desc: "Disables VSync in Engine.ini — removes GPU sync overhead and the added frame latency.", impact: "HIGH" as const },
                { id: "FortniteGameMode", title: "Enable Windows Game Mode for Fortnite", desc: "Enables GPU priority mode in Windows Game Mode registry for Fortnite process.", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="CPU & Process Priority" sectionKey="cpu" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
            <div className="space-y-3">
              {[
                { id: "FortniteHighPriority", title: "Set Fortnite to Above Normal CPU Priority", desc: "Registers FortniteClient-Win64-Shipping.exe in IFEO with CpuPriorityClass=6 (Above Normal) — persistent across reboots.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "FortniteAffinityPhysical", title: "Pin Fortnite to Physical Cores Only", desc: "Removes hyperthreaded virtual cores from Fortnite's affinity mask — reduces cache thrashing on Intel HT CPUs.", impact: "MED" as const },
                { id: "FortniteDisableThrottling", title: "Disable CPU Throttling for Fortnite", desc: "Disables power throttling via registry for Fortnite's process — ensures sustained clock speeds.", impact: "HIGH" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="Engine.ini Config Patches" sectionKey="engine" tweaks={tweaks} setTweak={setTweak} smartRecIds={smartRecs.ids} />
            <div className="space-y-3">
              {[
                { id: "FortniteEngineStreaming", title: "Optimize Streaming Pool & Asset Loading", desc: "Sets r.Streaming.PoolSize=2048 and enables async bulk data loading — reduces texture pop-in and asset streaming hitches.", impact: "MED" as const },
                { id: "FortniteDisableMotionBlur", title: "Disable Motion Blur & Lens Flare", desc: "Adds r.MotionBlurQuality=0 and r.LensFlareQuality=0 to Engine.ini — removes blur and gains back ~3–5% GPU performance.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "FortniteLowShadows", title: "Force Minimal Shadow Quality", desc: "Sets r.Shadow.MaxResolution=512 and r.ShadowQuality=0 in Engine.ini — significant GPU savings, especially at high resolutions.", badge: "RECOMMENDED", impact: "HIGH" as const },
                { id: "FortniteDisableLumen", title: "Disable Lumen Global Illumination", desc: "Forces r.DynamicGlobalIlluminationMethod=0 — disables Lumen GI for a significant FPS boost on mid-range GPUs.", impact: "HIGH" as const },
                { id: "FortniteDisableRecording", title: "Disable Background Video Recording", desc: "Disables Fortnite's built-in replay/recording via Engine.ini — frees GPU encoder bandwidth.", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={(item as any).badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Graphics API</h2>
            <div className="space-y-3">
              {[
                { id: "FortniteForceDirectX12", title: "Force DirectX 12 Mode", desc: "Adds -dx12 to Fortnite's launch config — DX12 enables better multi-core CPU utilization and async compute. Recommended for RTX cards.", badge: "RTX USERS", impact: "MED" as const },
              ].map((item, i) => (
                <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                  badge={item.badge} impact={item.impact} checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
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
