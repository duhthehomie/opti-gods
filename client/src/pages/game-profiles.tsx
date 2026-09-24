import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Gamepad2, RefreshCw, Search, Shield, Sparkles, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { detectInstalledGames, isNative, type NativeInstalledGame } from "@/lib/tauri-bridge";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { TWEAK_REGISTRY, type TweakCategory } from "@/lib/tweak-registry";
import { applyTweakBatch } from "@/lib/native-tweak-runner";

type GameProfile = {
  id: string;
  title: string;
  publisher: string;
  cover: string;
  gradient: string;
  category?: TweakCategory;
  recommendationIds?: readonly string[];
  description: string;
};

/*
 * This is deliberately a data-only library. It is the same installed-game
 * allowlist used by the desktop detector, but it does not show a game until
 * the native detector confirms that it exists on this PC.
 */
const GAME_LIBRARY: GameProfile[] = [
  { id: "game_fivem", title: "FiveM / GTA V", publisher: "Cfx.re / Rockstar Games", cover: "/game-covers/fivem.png", gradient: "from-red-950 via-zinc-900 to-black", category: "fivem", description: "Priority, cache, streaming, network buffers, server tools, and GTA process tuning." },
  { id: "game_fortnite", title: "Fortnite", publisher: "Epic Games", cover: "/game-covers/fortnite-new.png", gradient: "from-blue-950 via-indigo-900 to-black", category: "fortnite", description: "DX12, shader precompile, input latency, frame pacing, and hardware-aware graphics tuning." },
  { id: "game_cod", title: "Call of Duty", publisher: "Activision", cover: "https://cdn.akamai.steamstatic.com/steam/apps/1938090/header.jpg", gradient: "from-orange-950 via-zinc-900 to-black", category: "cod", description: "VRAM, texture streaming, HAGS, networking, CPU scheduling, and shader-cache fixes." },
  { id: "game_warzone", title: "Call of Duty: Warzone", publisher: "Activision", cover: "https://cdn.akamai.steamstatic.com/steam/apps/1962663/header.jpg", gradient: "from-orange-950 via-zinc-900 to-black", category: "cod", description: "Warzone-specific frame pacing, streaming, input, network, and GPU tuning." },
  { id: "game_007firstlight", title: "007: First Light", publisher: "IO Interactive", cover: "/game-covers/007-first-light.jpg", gradient: "from-yellow-950 via-zinc-900 to-black", description: "UE5 Engine.ini tuning, Lumen controls, process priority, and shader-cache preparation." },
  { id: "game_rust", title: "Rust", publisher: "Facepunch Studios", cover: "/game-covers/rust.png", gradient: "from-amber-950 via-zinc-900 to-black", category: "rust", description: "Client configuration, CPU priority, frame cap, shadows, networking, and launch tuning." },
  { id: "game_roblox", title: "Roblox", publisher: "Roblox Corporation", cover: "/game-covers/roblox.png", gradient: "from-red-950 via-zinc-900 to-black", category: "roblox", description: "FFlags, frame-rate controls, process priority, post-processing, and rendering settings." },
  { id: "game_valorant", title: "VALORANT", publisher: "Riot Games", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1270540/header.jpg", gradient: "from-red-950 via-zinc-900 to-black", description: "Competitive frame pacing, input latency, process priority, and network tuning." },
  {
    id: "game_silenthilltownfall",
    title: "Silent Hill: Townfall",
    publisher: "Konami / Screen Burn",
    cover: "/game-covers/silent-hill-townfall.jpg",
    gradient: "from-slate-950 via-zinc-900 to-black",
    recommendationIds: [
      "TownfallProcessPriority", "TownfallIOPriority", "TownfallGPUPriority",
      "TownfallCpuBoost", "TownfallEnergyThrottlingOff", "TownfallGameMode",
      "TownfallMMCSS", "TownfallGameDVR", "TownfallMotionBlurOff",
      "TownfallChromaticAberrationOff", "TownfallLensFlareOff",
      "TownfallDepthOfFieldOff", "TownfallShaderPipelineCache",
      "TownfallAsyncLoading", "TownfallTextureStreaming",
    ],
    description: "A focused UE5 horror-game pack: process priority, shader/streaming stability, frame pacing, and low-overhead Windows settings.",
  },
  { id: "game_apex", title: "Apex Legends", publisher: "Electronic Arts", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg", gradient: "from-orange-950 via-zinc-900 to-black", description: "Input, frame pacing, CPU priority, and network tuning for competitive play." },
  { id: "game_siege", title: "Rainbow Six Siege", publisher: "Ubisoft", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/359550/header.jpg", gradient: "from-blue-950 via-zinc-900 to-black", description: "Low-latency process, input, GPU, and network tuning." },
  { id: "game_overwatch", title: "Overwatch", publisher: "Blizzard Entertainment", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/2357570/header.jpg", gradient: "from-orange-950 via-blue-900 to-black", description: "Competitive frame pacing, process priority, input, and network tuning." },
  { id: "game_minecraft", title: "Minecraft", publisher: "Mojang Studios", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1672970/header.jpg", gradient: "from-green-950 via-zinc-900 to-black", description: "Java/Bedrock process priority, memory, frame pacing, and input tuning." },
  { id: "game_cs2", title: "Counter-Strike 2", publisher: "Valve", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg", gradient: "from-orange-950 via-zinc-900 to-black", description: "Frame pacing, input latency, CPU scheduling, and network tuning." },
  { id: "game_arcraiders", title: "ARC Raiders", publisher: "Embark Studios", cover: "/game-covers/arc-raiders.png", gradient: "from-orange-950 via-zinc-900 to-black", description: "UE5 streaming, shader compilation, process priority, and frame pacing." },
  { id: "game_marvelrivals", title: "Marvel Rivals", publisher: "NetEase Games", cover: "/game-covers/marvel-rivals.png", gradient: "from-purple-950 via-blue-900 to-black", description: "UE5 asset streaming, process priority, input, and network tuning." },
  { id: "game_rocketleague", title: "Rocket League", publisher: "Psyonix / Epic Games", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/252950/header.jpg", gradient: "from-blue-950 via-zinc-900 to-black", description: "Competitive frame pacing, input latency, and network tuning." },
  { id: "game_gta5", title: "Grand Theft Auto V", publisher: "Rockstar Games", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg", gradient: "from-green-950 via-zinc-900 to-black", description: "GTA V process, streaming, frame pacing, and network tuning." },
  { id: "game_eldenring", title: "Elden Ring", publisher: "FromSoftware", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg", gradient: "from-amber-950 via-zinc-900 to-black", description: "Frame pacing, process priority, and shader-stutter reduction." },
  { id: "game_tarkov", title: "Escape from Tarkov", publisher: "Battlestate Games", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/2215430/header.jpg", gradient: "from-stone-950 via-zinc-900 to-black", description: "Streaming, CPU priority, memory, and frame pacing tuning." },
  { id: "game_pubg", title: "PUBG: Battlegrounds", publisher: "Krafton", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/578080/header.jpg", gradient: "from-amber-950 via-zinc-900 to-black", description: "Competitive input, process, frame pacing, and network tuning." },
  { id: "game_dbd", title: "Dead by Daylight", publisher: "Behaviour Interactive", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/381210/header.jpg", gradient: "from-red-950 via-zinc-900 to-black", description: "Unreal Engine process priority, asset streaming, and frame pacing." },
  { id: "game_dota2", title: "Dota 2", publisher: "Valve", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg", gradient: "from-red-950 via-zinc-900 to-black", description: "CPU scheduling, input, frame pacing, and network tuning." },
  { id: "game_warframe", title: "Warframe", publisher: "Digital Extremes", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/230410/header.jpg", gradient: "from-blue-950 via-zinc-900 to-black", description: "Asset streaming, process priority, and frame pacing tuning." },
  { id: "game_forza", title: "Forza Horizon 5", publisher: "Xbox Game Studios", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1551360/header.jpg", gradient: "from-cyan-950 via-zinc-900 to-black", description: "Streaming, CPU priority, shader cache, and frame pacing tuning." },
  { id: "game_readyornot", title: "Ready or Not", publisher: "VOID Interactive", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1144200/header.jpg", gradient: "from-slate-950 via-zinc-900 to-black", description: "UE5 process, streaming, frame pacing, and input tuning." },
  { id: "game_phasmo", title: "Phasmophobia", publisher: "Kinetic Games", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/739630/header.jpg", gradient: "from-indigo-950 via-zinc-900 to-black", description: "Unity process priority and frame pacing tuning." },
  { id: "game_battlefield", title: "Battlefield", publisher: "Electronic Arts", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/1517290/header.jpg", gradient: "from-green-950 via-zinc-900 to-black", description: "CPU scheduling, streaming, input, and network tuning." },
  { id: "game_lol", title: "League of Legends", publisher: "Riot Games", cover: "https://cdn.cloudflare.steamstatic.com/steam/apps/20590/header.jpg", gradient: "from-blue-950 via-zinc-900 to-black", description: "Low-latency process, input, and network tuning." },
  { id: "game_discord", title: "Discord While Gaming", publisher: "Discord", cover: "https://cdn.simpleicons.org/discord/5865F2", gradient: "from-indigo-950 via-zinc-900 to-black", description: "Reduce background GPU, media, notification, and process overhead during games." },
  { id: "game_spotify", title: "Spotify While Gaming", publisher: "Spotify", cover: "https://cdn.simpleicons.org/spotify/1DB954", gradient: "from-green-950 via-zinc-900 to-black", description: "Reduce GPU, CPU, startup, and bandwidth overhead while keeping music available." },
];

// These are the common hardware and Windows optimizations that can be used
// alongside any game. GPU-specific rows are included here and then filtered by
// getTweakCompatibility, so AMD users do not get NVIDIA rows and vice versa.
const SHARED_PROFILE_CATEGORIES: TweakCategory[] = [
  "registry", "network", "memory", "processes", "process-lasso", "nvidia", "amd", "intgpu",
];

function compatibleTweakCount(profile: GameProfile): number {
  if (profile.recommendationIds) {
    return profile.recommendationIds.filter((id) => {
      const tweak = TWEAK_REGISTRY.find((candidate) => candidate.id === id);
      return Boolean(tweak && tweak.safety !== "expert" && getTweakCompatibility(id).ok);
    }).length;
  }
  const allowed = new Set<TweakCategory>(SHARED_PROFILE_CATEGORIES);
  if (profile.category) allowed.add(profile.category);
  return TWEAK_REGISTRY.filter((tweak) =>
    allowed.has(tweak.category) && tweak.safety !== "expert" && getTweakCompatibility(tweak.id).ok
  ).length;
}

function GameCard({
  profile,
  installation,
  enabled,
  count,
  onToggle,
}: {
  profile: GameProfile;
  installation?: NativeInstalledGame;
  enabled: boolean;
  count: number;
  onToggle: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(profile.cover) && !imageFailed;
  return (
    <article className={`group relative w-[248px] min-w-[248px] overflow-hidden rounded-2xl border bg-[#080d0f] transition-colors ${enabled ? "border-red-500/60" : "border-white/[0.08] hover:border-red-500/35"}`}>
      <div className={`relative h-[142px] overflow-hidden bg-gradient-to-br ${profile.gradient}`}>
        {showImage && <img src={profile.cover} alt="" onError={() => setImageFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080d0f] via-black/15 to-transparent" />
        {installation?.running && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">Running</span>}
        <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-bold text-zinc-300">{count} compatible</span>
        <div className="absolute bottom-3 left-3 right-3">
          <h2 className="truncate text-sm font-black text-white">{profile.title}</h2>
          <p className="truncate text-[10px] text-zinc-500">{profile.publisher}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="min-h-9 text-[11px] leading-relaxed text-zinc-500">{profile.description}</p>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
           <span className="text-[10px] uppercase tracking-wider text-zinc-600">
             {count} {profile.recommendationIds ? "recommended FPS/stability tweaks" : "full hardware-compatible tweaks"}
           </span>
          <button
            type="button"
            aria-label={`${enabled ? "Deselect" : "Select"} ${profile.title}`}
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${enabled ? "bg-red-600" : "bg-zinc-700"}`}
          >
            <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function GameProfiles() {
  const native = useMemo(() => isNative(), []);
  const { tweaks, appliedAt, setTweak } = useOptimizationStore();
  const { toast } = useToast();
  const [installations, setInstallations] = useState<Record<string, NativeInstalledGame>>({});
  const [hasScanned, setHasScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDetection = useCallback(async () => {
    if (!native) {
      toast({ title: "Open Opti Gods for Windows", description: "Only the desktop app can inspect local installs, including standalone and non-store copies.", variant: "destructive" });
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const found = await detectInstalledGames();
      setInstallations(Object.fromEntries(found.map((game) => [game.id, game])));
      setHasScanned(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Installed-game detection failed.");
    } finally {
      setScanning(false);
    }
  }, [native, toast]);

  const visibleGames = hasScanned
    ? GAME_LIBRARY.filter((profile) => installations[profile.id])
    : GAME_LIBRARY;
  const selectedGames = visibleGames.filter((profile) => tweaks[profile.id]);
  // Recalculate after a hardware scan event or native detection refresh. The
  // compatibility helper reads the current scan snapshot from localStorage.
  const countById = new Map(GAME_LIBRARY.map((profile) => [profile.id, compatibleTweakCount(profile)]));
  const loopGames = [...visibleGames, ...visibleGames];

  async function applySelected() {
    if (!selectedGames.length) {
      toast({ title: "Select a game first", description: "Toggle the installed games you want to optimize.", variant: "destructive" });
      return;
    }
    try {
      const result = await applyTweakBatch(selectedGames.map((profile) => profile.id));
      toast({ title: native ? `${result.appliedIds.length} game profiles applied` : "Game profiles selected", description: native ? "The desktop app confirmed the selected game optimizations." : "Run the generated script on Windows to apply them." });
    } catch (cause) {
      toast({ title: "Could not apply game profiles", description: cause instanceof Error ? cause.message : "The action failed.", variant: "destructive" });
    }
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">
              <Gamepad2 className="h-3.5 w-3.5" /> Game Profiles
            </div>
            <h1 className="mt-2 font-display text-3xl font-black text-white">Optimize the games on this PC.</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">One installed-game library for every supported title. No separate profile pages and no store ownership required.</p>
          </div>
          <Button onClick={runDetection} disabled={scanning} className="gap-2 bg-red-600 font-bold text-white hover:bg-red-700">
            {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {scanning ? "Detecting…" : "Detect my games"}
          </Button>
        </header>

        <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-bold text-white">
                  {hasScanned ? `Desktop app found ${Object.keys(installations).length} games on your PC` : "Desktop app has not scanned this PC yet"}
                </p>
                <p className="text-xs text-zinc-400">Only showing games that are actually installed. Toggle the ones you want to optimize.</p>
              </div>
            </div>
            {hasScanned && <Button onClick={runDetection} disabled={scanning} variant="outline" size="sm" className="gap-1.5 border-zinc-700 text-xs text-zinc-300"><RefreshCw className="h-3 w-3" /> Re-scan</Button>}
          </div>
          {!native && <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">Open the Windows desktop app to detect Steam, Epic, standalone, cracked, and other local installs without uploading paths.</p>}
          {error && <p className="mt-3 text-xs text-red-300">Installed-game detection could not finish: {error}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d0f]/80 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">Installed game library</h2>
              <p className="mt-1 text-[11px] text-zinc-600">{hasScanned ? `${visibleGames.length} detected games` : `${GAME_LIBRARY.length} supported profiles · run detection to filter this list`}</p>
            </div>
            <Sparkles className="h-4 w-4 text-red-400" />
          </div>
          {hasScanned && visibleGames.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Gamepad2 className="h-8 w-8 text-zinc-700" />
              <p className="text-sm font-bold text-zinc-300">No supported installed games found</p>
              <p className="max-w-sm text-xs text-zinc-600">Detection checks local install evidence, not whether the game came from an official store.</p>
            </div>
          ) : (
            <div className="overflow-hidden" aria-label="Auto-scrolling installed game library">
              <motion.div
                className="og-game-library-track flex w-max gap-4 py-1"
                initial={{ x: 0 }}
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: Math.max(34, visibleGames.length * 3), repeat: Infinity, ease: "linear" }}
              >
                {loopGames.map((profile, index) => (
                  <GameCard
                    key={`${profile.id}-${index}`}
                    profile={profile}
                    installation={installations[profile.id]}
                    enabled={Boolean(tweaks[profile.id] || appliedAt[profile.id])}
                    count={countById.get(profile.id) ?? 0}
                    onToggle={() => setTweak(profile.id, !tweaks[profile.id])}
                  />
                ))}
              </motion.div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-zinc-900/60 p-4">
          <p className="flex items-center gap-2 text-xs text-zinc-400"><CheckCircle2 className="h-4 w-4 text-red-400" /><span className="font-bold text-white">{selectedGames.length}</span> game profiles selected</p>
          <Button onClick={applySelected} className="gap-2 bg-red-600 text-xs font-bold text-white hover:bg-red-700"><Zap className="h-3.5 w-3.5" /> Optimize selected</Button>
        </div>
      </div>
    </AppLayout>
  );
}