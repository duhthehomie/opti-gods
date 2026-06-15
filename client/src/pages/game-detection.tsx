import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useOptimizationStore } from "@/store/use-optimization-store";
import {
  Shield, Terminal, CheckCircle, XCircle, Info,
  Gamepad, Download, RefreshCw, Search, AlertCircle, Copy,
  Play, Zap, FolderOpen, MonitorCheck, CircleDashed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isNative, scanTaskManager } from "@/lib/tauri-bridge";

interface GameEntry {
  id: string;
  name: string;
  publisher: string;
  accentBorder: string;
  coverUrl?: string;
  coverGradient?: string;
  coverPosition?: string;
  detectPaths: string[];
  processName: string;
  tweaks: string[];
}

const GAMES: GameEntry[] = [
  {
    id: "game_valorant",
    name: "Valorant",
    publisher: "Riot Games",
    accentBorder: "border-l-red-500",
    coverUrl: "/game-covers/valorant.png",
    coverGradient: "from-red-900 via-red-800 to-zinc-900",
    detectPaths: ["%LocalAppData%\\VALORANT", "C:\\Riot Games\\VALORANT"],
    processName: "VALORANT-Win64-Shipping.exe",
    tweaks: ["Above Normal CPU priority (IFEO persistent)", "High I/O priority for asset streaming", "Disable Riot Vanguard telemetry service"],
  },
  {
    id: "game_cs2",
    name: "Call of Duty",
    publisher: "Activision",
    accentBorder: "border-l-orange-600",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1938090/header.jpg",
    detectPaths: [
      "Call of Duty\\cod.exe",
      "Call of Duty Modern Warfare 2\\cod.exe",
      "Call of Duty Modern Warfare III\\cod.exe",
      "steamapps\\common\\Call of Duty Modern Warfare 2\\cod.exe",
    ],
    processName: "cod.exe",
    tweaks: ["Above Normal CPU priority (IFEO persistent)", "Disable TCP timestamps for lower RTT", "Set socket send/receive buffers to 256KB"],
  },
  {
    id: "game_apex",
    name: "Apex Legends",
    publisher: "Respawn / EA",
    accentBorder: "border-l-red-700",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg",
    coverGradient: "from-orange-950 via-red-900 to-zinc-900",
    detectPaths: ["C:\\Program Files\\EA Games\\Apex Legends\\r5apex.exe", "C:\\Program Files\\Origin Games\\Apex Legends\\r5apex.exe", "D:\\Origin Games\\Apex Legends\\r5apex.exe"],
    processName: "r5apex.exe",
    tweaks: ["Above Normal CPU priority (IFEO persistent)", "Disable EA/Origin overlay service (EABackgroundService)", "High I/O priority for asset streaming", "Set GPU Priority 8 for consistent frame delivery"],
  },
  {
    id: "game_warzone",
    name: "Call of Duty: Warzone",
    publisher: "Activision",
    accentBorder: "border-l-zinc-400",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1962663/header.jpg",
    coverGradient: "from-zinc-900 via-slate-800 to-zinc-950",
    detectPaths: ["C:\\Program Files (x86)\\Call of Duty", "C:\\Program Files\\Battle.net Apps\\Call of Duty"],
    processName: "cod.exe",
    tweaks: ["Above Normal CPU priority", "Disable Battle.net overlay agent", "Increase network socket buffer for BR servers"],
  },
  {
    id: "game_lol",
    name: "League of Legends",
    publisher: "Riot Games",
    accentBorder: "border-l-amber-600",
    coverUrl: "/game-covers/lol.png",
    coverGradient: "from-amber-950 via-yellow-900 to-zinc-900",
    detectPaths: ["C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe"],
    processName: "League of Legends.exe",
    tweaks: ["Above Normal CPU priority", "High I/O for champion asset loading", "Disable Riot background update agent at launch"],
  },
  {
    id: "game_overwatch",
    name: "Overwatch 2",
    publisher: "Blizzard",
    accentBorder: "border-l-orange-500",
    coverUrl: "/game-covers/overwatch.png",
    coverGradient: "from-orange-900 via-orange-800 to-zinc-900",
    detectPaths: ["C:\\Program Files (x86)\\Overwatch\\_retail_\\Overwatch.exe", "C:\\Program Files\\Overwatch\\_retail_\\Overwatch.exe"],
    processName: "Overwatch.exe",
    tweaks: ["Above Normal CPU priority", "Disable Blizzard agent background service", "Network buffer tuning for 64-tick servers"],
  },
  {
    id: "game_siege",
    name: "Rainbow Six Siege",
    publisher: "Ubisoft",
    accentBorder: "border-l-zinc-500",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/359550/header.jpg",
    detectPaths: ["C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege"],
    processName: "RainbowSix.exe",
    tweaks: ["Above Normal CPU priority + all physical cores", "Disable Ubisoft Connect telemetry", "High I/O priority for map streaming"],
  },
  {
    id: "game_rust",
    name: "Rust",
    publisher: "Facepunch Studios",
    accentBorder: "border-l-red-800",
    coverUrl: "/game-covers/rust.png",
    detectPaths: ["Steam\\steamapps\\common\\Rust\\RustClient.exe"],
    processName: "RustClient.exe",
    tweaks: ["Above Normal CPU priority", "Expand streaming pool size in registry", "Disable background application throttling"],
  },
  {
    id: "game_minecraft",
    name: "Minecraft (Java)",
    publisher: "Mojang / Microsoft",
    accentBorder: "border-l-zinc-600",
    coverUrl: "/game-covers/minecraft.png",
    coverGradient: "from-green-950 via-emerald-900 to-zinc-900",
    detectPaths: ["%AppData%\\.minecraft\\launcher_profiles.json"],
    processName: "javaw.exe",
    tweaks: ["Add .minecraft to Defender exclusions (scan skip)", "Set javaw.exe to Above Normal priority", "Disable Windows Update delivery optimization bandwidth cap"],
  },
  {
    id: "game_roblox",
    name: "Roblox",
    publisher: "Roblox Corporation",
    accentBorder: "border-l-red-400",
    coverUrl: "/game-covers/roblox.png",
    coverGradient: "from-red-950 via-red-900 to-zinc-900",
    detectPaths: ["%LocalAppData%\\Roblox\\Versions"],
    processName: "RobloxPlayerBeta.exe",
    tweaks: ["Above Normal CPU priority for Roblox player", "Disable Roblox background crash reporter", "Set I/O priority to High"],
  },
  {
    id: "game_tarkov",
    name: "Escape from Tarkov",
    publisher: "Battlestate Games",
    accentBorder: "border-l-stone-500",
    coverUrl: "/game-covers/tarkov.png",
    coverGradient: "from-stone-900 via-neutral-800 to-zinc-900",
    detectPaths: ["C:\\Battlestate Games\\EFT\\EscapeFromTarkov.exe", "C:\\Games\\EFT\\EscapeFromTarkov.exe"],
    processName: "EscapeFromTarkov.exe",
    tweaks: ["High CPU priority (EFT is extremely CPU-heavy)", "Disable Windows Game DVR for EFT", "Expand socket buffer for server desync reduction"],
  },
  {
    id: "game_pubg",
    name: "PUBG: Battlegrounds",
    publisher: "Krafton",
    accentBorder: "border-l-amber-700",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/578080/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe"],
    processName: "TslGame.exe",
    tweaks: ["Above Normal CPU priority", "Unreal Engine streaming pool expansion", "Disable PUBG telemetry background tasks"],
  },
  {
    id: "game_dbd",
    name: "Dead by Daylight",
    publisher: "Behaviour Interactive",
    accentBorder: "border-l-red-900",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/381210/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\Dead by Daylight\\DeadByDaylight\\Binaries\\Win64\\DeadByDaylight-Win64-Shipping.exe"],
    processName: "DeadByDaylight-Win64-Shipping.exe",
    tweaks: ["Above Normal CPU priority", "Disable background shader compilation worker throttling", "I/O priority boost for asset loading"],
  },
  {
    id: "game_dota2",
    name: "Dota 2",
    publisher: "Valve",
    accentBorder: "border-l-zinc-400",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\dota 2 beta\\game\\bin\\win64\\dota2.exe"],
    processName: "dota2.exe",
    tweaks: ["Above Normal CPU priority", "Disable Steam friend presence during gaming (CPU)", "Optimize network tick for South Asian servers"],
  },
  {
    id: "game_warframe",
    name: "Warframe",
    publisher: "Digital Extremes",
    accentBorder: "border-l-blue-600",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/230410/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\Warframe", "%LOCALAPPDATA%\\Warframe"],
    processName: "Warframe.x64.exe",
    tweaks: ["Above Normal CPU priority (IFEO persistent)", "High I/O priority for Warframe asset streaming", "Disable background shader recompile throttling"],
  },
  {
    id: "game_forza",
    name: "Forza Horizon 5",
    publisher: "Playground Games / Xbox",
    accentBorder: "border-l-orange-400",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1551360/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\ForzaHorizon5", "%ProgramFiles%\\WindowsApps"],
    processName: "ForzaHorizon5.exe",
    tweaks: ["Above Normal CPU priority (IFEO)", "High I/O priority for open-world streaming", "Disable Xbox Game Bar interference"],
  },
  {
    id: "game_readyornot",
    name: "Ready or Not",
    publisher: "VOID Interactive",
    accentBorder: "border-l-zinc-600",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1144200/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\Ready Or Not", "D:\\SteamLibrary\\steamapps\\common\\Ready Or Not"],
    processName: "ReadyOrNot.exe",
    tweaks: ["Above Normal CPU priority (Unreal Engine 4)", "High I/O priority for level streaming", "Disable background shader worker throttle"],
  },
  {
    id: "game_phasmo",
    name: "Phasmophobia",
    publisher: "Kinetic Games",
    accentBorder: "border-l-violet-700",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/739630/header.jpg",
    detectPaths: ["Steam\\steamapps\\common\\Phasmophobia"],
    processName: "Phasmophobia.exe",
    tweaks: ["Above Normal CPU priority (Unity engine)", "High I/O priority for audio/level assets", "Reduce lobby load time via cache hints"],
  },
  {
    id: "game_battlefield",
    name: "Battlefield 2042",
    publisher: "DICE / EA",
    accentBorder: "border-l-amber-500",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1517290/header.jpg",
    detectPaths: ["C:\\Program Files\\EA Games\\Battlefield 2042", "Origin Games\\Battlefield 2042", "Steam\\steamapps\\common\\Battlefield 2042", "D:\\SteamLibrary\\steamapps\\common\\Battlefield 2042"],
    processName: "BF2042.exe",
    tweaks: ["Above Normal CPU priority (Frostbite engine)", "High I/O priority for large map streaming", "Disable EA Anti-Cheat telemetry service"],
  },
  {
    id: "game_gta5",
    name: "Grand Theft Auto V",
    publisher: "Rockstar Games",
    accentBorder: "border-l-green-600",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg",
    coverGradient: "from-green-950 via-green-900 to-zinc-900",
    detectPaths: [
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grand Theft Auto V\\GTA5.exe",
      "D:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V\\GTA5.exe",
      "E:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V\\GTA5.exe",
      "C:\\Program Files\\Rockstar Games\\Grand Theft Auto V\\GTA5.exe",
      "D:\\Rockstar Games\\Grand Theft Auto V\\GTA5.exe",
    ],
    processName: "GTA5.exe",
    tweaks: [
      "Above Normal CPU priority (IFEO persistent) + High I/O",
      "Add GTA V folder to Defender exclusions (eliminates stutter from real-time scanning)",
      "GPU Priority 8 for consistent frame delivery",
      "Disable Rockstar Game Services telemetry (SocialClubHelper)",
    ],
  },
  {
    id: "game_fivem",
    name: "FiveM",
    publisher: "Cfx.re / Rockstar",
    accentBorder: "border-l-red-600",
    coverUrl: "/game-covers/fivem.png",
    coverGradient: "from-zinc-900 via-zinc-800 to-zinc-950",
    detectPaths: [
      "%LocalAppData%\\FiveM\\FiveM.exe",
      "%LocalAppData%\\FiveM\\FiveM.app\\FiveM.exe",
    ],
    processName: "FiveM.exe",
    tweaks: [
      "Full PerfOptions stack on FiveM.exe + all FiveM_bXXXX_GTAProcess builds",
      "Add FiveM.app to Defender exclusions (biggest single cause of FiveM stutter)",
      "DNS set to Cloudflare 1.1.1.1 for faster server resolution",
      "SystemResponsiveness=10 — 90% CPU budget to game (Discord/audio safe)",
      "512KB send/receive network buffer — reduces packet batching lag",
    ],
  },
  {
    id: "game_rocketleague",
    name: "Rocket League",
    publisher: "Psyonix / Epic Games",
    accentBorder: "border-l-blue-500",
    coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/252950/header.jpg",
    coverGradient: "from-blue-950 via-blue-900 to-zinc-900",
    detectPaths: [
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\rocketleague\\Binaries\\Win64\\RocketLeague.exe",
      "D:\\SteamLibrary\\steamapps\\common\\rocketleague\\Binaries\\Win64\\RocketLeague.exe",
      "C:\\Program Files\\Epic Games\\rocketleague\\Binaries\\Win64\\RocketLeague.exe",
      "D:\\Epic Games\\rocketleague\\Binaries\\Win64\\RocketLeague.exe",
    ],
    processName: "RocketLeague.exe",
    tweaks: [
      "Above Normal CPU priority (IFEO persistent) + High I/O",
      "Disable Epic Games overlay service for lower frame variance",
      "Network buffer tuning for competitive 120Hz tick servers",
      "GPU Priority 8 — critical for smooth 120/144fps physics",
    ],
  },
  {
    id: "game_arcraiders",
    name: "ARC Raiders",
    publisher: "Embark Studios",
    accentBorder: "border-l-orange-400",
    coverUrl: "/game-covers/arc-raiders.png",
    coverPosition: "center center",
    coverGradient: "from-orange-950 via-zinc-900 to-black",
    detectPaths: [
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\ARC Raiders",
      "D:\\SteamLibrary\\steamapps\\common\\ARC Raiders",
      "E:\\SteamLibrary\\steamapps\\common\\ARC Raiders",
      "F:\\SteamLibrary\\steamapps\\common\\ARC Raiders",
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Arc Raiders",
      "D:\\SteamLibrary\\steamapps\\common\\Arc Raiders",
      "C:\\Games\\ARC Raiders",
      "D:\\Games\\ARC Raiders",
    ],
    processName: "ARC-Win64-Shipping.exe",
    tweaks: [
      "Process priority locked: CpuPriorityClass=AboveNormal, IO=High, GpuPriority=8, EnergyThrottling=OFF, ForegroundBoost=ON — applied via IFEO to both ARC-Win64-Shipping.exe and ARCLauncher.exe for persistence across every relaunch",
      "UE5 Engine.ini tuning: motion blur off, SSR off, Lumen GI disabled, Lumen reflections off, virtual shadow maps off, volumetric fog off, ray tracing off — extraction shooter FPS gains of 15–30% on mid-range GPUs",
      "Streaming pool expanded to 2048MB (r.Streaming.PoolSize=2048) — prevents texture pop-in and asset stream hitches during raid zone transitions and large open-world traversal",
      "Raw mouse input enforced — bEnableMouseSmoothing=False, bViewAccelerationEnabled=False via Engine.ini — critical for precise aim during PvP encounters and ARC drone tracking",
      "TDR timeout extended to 8s (TdrDelay=8, TdrDdiDelay=8) — prevents GPU timeout crash during UE5 shader pre-compilation on first launch or new area load",
      "MMCSS Games task fully tuned: Priority=6, GPU Priority=8, Scheduling Category=High, SFIO Priority=High, SystemResponsiveness=10 — game thread gets maximum CPU slice over all background tasks",
      "Windows Defender exclusion written for the full install directory — eliminates mid-raid .pak file scan stutters during hot-load asset streaming in extraction zones",
      "Windows Game Mode + Game Config registry keys registered for ARC-Win64-Shipping.exe — ensures Windows scheduler treats the process as a foreground high-priority game at all times",
      "Network buffers expanded to 512KB (AFD DefaultReceiveWindow/DefaultSendWindow) — reduces packet batching lag during high-player-density extraction zone PvP and ARC squad synchronisation",
      "NVIDIA DXCache and GLCache shader folders added to Defender exclusions — stops shader-compile micro-stutters on first encounter with new enemy types, environments, and visual effects mid-raid",
    ],
  },
  {
    id: "game_007firstlight",
    name: "007: First Light",
    publisher: "IO Interactive",
    accentBorder: "border-l-yellow-500",
    coverUrl: "/game-covers/007-first-light.jpg",
    coverPosition: "center top",
    coverGradient: "from-yellow-950 via-zinc-900 to-black",
    detectPaths: [
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\007 First Light",
      "D:\\SteamLibrary\\steamapps\\common\\007 First Light",
      "E:\\SteamLibrary\\steamapps\\common\\007 First Light",
      "F:\\SteamLibrary\\steamapps\\common\\007 First Light",
      "C:\\Program Files\\IO Interactive\\007 First Light",
      "D:\\Games\\007 First Light",
    ],
    processName: "007FirstLight-Win64-Shipping.exe",
    tweaks: [
      "Process priority: CPU=AboveNormal, IO=High, GPU Priority=8, EnergyThrottlingEnabled=0, ForegroundBoostPolicy=1 — persistent via IFEO across every relaunch",
      "UE5 Engine.ini tuning: motion blur off, chromatic aberration off, SSR disabled, Lumen GI quality=1 + SDFs off, shadow res capped at 512, streaming pool expanded to 1536MB for open-world asset streaming",
      "Raw mouse input enforced — bEnableMouseSmoothing=False, bViewAccelerationEnabled=False, bEnableVSync=False via Engine.ini (smooth aim at all FPS targets)",
      "TDR timeout extended to 8s (HKLM TdrDelay=8) — prevents GPU timeout crashes during UE5 shader pre-compilation on first launch / first scene load",
      "MMCSS Games task: Priority=6, GPU Priority=8, Scheduling Category=High, Background Only=False, SystemResponsiveness=10 — game thread gets maximum CPU slice over background processes",
      "Windows Defender exclusion written for the full install folder — eliminates mid-match .pak scan stutters during hot-reload asset streaming",
      "Windows Game Mode + Game Config reg keys registered — ensures scheduler treats 007FirstLight-Win64-Shipping.exe as a foreground high-priority game process",
      "Network send/receive buffers: 512KB (AFD) for low-latency online co-op lobby traffic and mission host P2P synchronisation",
      "NVIDIA shader cache pre-warming path added to Defender exclusions (LocalAppData DXCache + GLCache) — stops shader-compile stutters on first encounter with new shaders mid-mission",
      "CPU core unparking enforced + dynamic tick disabled — ensures all physical cores are available for UE5 worker thread pool during physics-heavy sequences",
    ],
  },
  {
    id: "game_fortnite",
    name: "Fortnite",
    publisher: "Epic Games",
    accentBorder: "border-l-blue-400",
    coverUrl: "/game-covers/fortnite-new.png",
    coverGradient: "from-blue-900 via-indigo-900 to-zinc-900",
    detectPaths: [
      "C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe",
      "D:\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe",
      "E:\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe",
    ],
    processName: "FortniteClient-Win64-Shipping.exe",
    tweaks: [
      "Above Normal CPU priority (Unreal Engine 5, IFEO persistent)",
      "High I/O priority for Battle Royale asset streaming",
      "GPU Priority 8 for frame delivery consistency (critical at 144+ fps)",
      "Defender exclusion for Fortnite folder (eliminates pak-scan stutters on drop)",
      "512KB network buffer — reduces packet batching lag on drop-phase servers",
    ],
  },
  {
    id: "game_marvelrivals",
    name: "Marvel Rivals",
    publisher: "NetEase Games",
    accentBorder: "border-l-red-500",
    coverUrl: "/game-covers/marvel-rivals.png",
    coverGradient: "from-blue-950 via-purple-900 to-zinc-900",
    detectPaths: [
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Marvel Rivals",
      "D:\\SteamLibrary\\steamapps\\common\\Marvel Rivals",
      "E:\\SteamLibrary\\steamapps\\common\\Marvel Rivals",
    ],
    processName: "MarvelRivals-Win64-Shipping.exe",
    tweaks: [
      "Above Normal CPU priority (Unreal Engine 5, IFEO persistent)",
      "High I/O priority for hero ability asset streaming",
      "GPU Priority 8 for consistent team-fight frame delivery",
      "Disable NetEase telemetry background tasks",
      "Network buffer tuning for 60-tick competitive servers",
    ],
  },
];

// ─── Now Playing Panel ────────────────────────────────────────────────────────

function NowPlayingPanel() {
  const { tweaks, setTweak } = useOptimizationStore();
  const native = useMemo(() => isNative(), []);

  const [runningGame, setRunningGame] = useState<GameEntry | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customFound, setCustomFound] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processMap = useMemo(
    () => Object.fromEntries(GAMES.map(g => [g.id, g.processName])),
    []
  );

  const doScan = useCallback(async (silent = false) => {
    if (!native) return;
    if (!silent) setScanning(true);
    try {
      const result = await scanTaskManager(processMap, {});
      // Pick first running game (or null)
      const found = result.running.length > 0
        ? GAMES.find(g => g.id === result.running[0]) ?? null
        : null;
      setRunningGame(prev => {
        // Reset img error when game changes
        if (prev?.id !== found?.id) setImgErr(false);
        return found;
      });
      setLastScan(new Date());
      // Custom process name search across all_processes
      if (customInput.trim()) {
        const needle = customInput.trim().toLowerCase();
        const hit = result.all_processes.find(p => p.name.toLowerCase().includes(needle));
        setCustomFound(hit ? hit.name : null);
      } else {
        setCustomFound(null);
      }
    } catch {
      // non-native or permission denied — silently ignore
    } finally {
      if (!silent) setScanning(false);
    }
  }, [native, processMap, customInput]);

  // Poll every 5 s in native mode
  useEffect(() => {
    if (!native) return;
    doScan(true);
    pollRef.current = setInterval(() => doScan(true), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [native, doScan]);

  const enabled = runningGame ? (tweaks[runningGame.id] ?? false) : false;
  const showCover = runningGame?.coverUrl && !imgErr;

  // ── Non-native web fallback ────────────────────────────────────────────────
  if (!native) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/8 bg-zinc-900/60 p-4 flex items-center gap-4"
      >
        <div className="p-2.5 bg-zinc-800 rounded-lg border border-white/5 shrink-0">
          <MonitorCheck className="w-5 h-5 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-300">Live Game Detection</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Launch the <span className="text-white font-medium">OptiGods.exe</span> desktop app to detect which game is currently running and see missing optimizations in real time.
          </p>
        </div>
      </motion.div>
    );
  }

  // ── No game running ────────────────────────────────────────────────────────
  if (!runningGame && !customFound) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/8 bg-zinc-900/60 overflow-hidden"
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <CircleDashed className="w-4 h-4 text-zinc-600" />
            <span className="text-sm font-bold text-zinc-400">Now Playing</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono uppercase tracking-wide">
              No game detected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="button-refresh-nowplaying"
              size="sm"
              variant="outline"
              onClick={() => doScan(false)}
              disabled={scanning}
              className="h-7 px-2.5 border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={cn("w-3 h-3", scanning && "animate-spin")} />
              {scanning ? "Scanning…" : "Refresh"}
            </Button>
            <Button
              data-testid="button-add-game-path"
              size="sm"
              variant="outline"
              onClick={() => setShowCustom(v => !v)}
              className="h-7 px-2.5 border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1.5"
            >
              <FolderOpen className="w-3 h-3" />
              Add Game Path
            </Button>
          </div>
        </div>

        {/* Custom path input */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 bg-zinc-900/80 border-b border-white/5 flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  data-testid="input-custom-game-process"
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="Enter process name or path (e.g. cs2.exe, MyGame.exe)"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => doScan(false)}
                  disabled={scanning || !customInput.trim()}
                  className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 shrink-0"
                >
                  Detect
                </Button>
              </div>
              {customFound === null && customInput.trim() && !scanning && lastScan && (
                <div className="px-4 py-2 text-[11px] text-zinc-500 bg-zinc-900/40 border-b border-white/5">
                  <span className="text-red-400 font-medium">Not found</span> — "{customInput}" is not in the running process list. Make sure the game is open and try again.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle state body */}
        <div className="px-4 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0">
            <Gamepad className="w-6 h-6 text-zinc-600" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">Open a game to see live optimization suggestions here.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Scans every 5 seconds — {lastScan ? `last checked ${lastScan.toLocaleTimeString()}` : "starting scan…"}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Custom match (process not in GAMES list) ───────────────────────────────
  if (customFound && !runningGame) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-sm font-bold text-yellow-300">Now Playing</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-mono uppercase tracking-wide">
              Custom Game
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => doScan(false)}
            disabled={scanning}
            className="h-7 px-2.5 border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={cn("w-3 h-3", scanning && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-yellow-500/20 flex items-center justify-center shrink-0">
            <Play className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">{customFound}</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">Running — not in the supported games list</p>
            <p className="text-xs text-zinc-500 mt-1">
              General Windows optimizations from your script still apply. A future update may add full support for this game.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Game detected ──────────────────────────────────────────────────────────
  const missingTweaks = enabled ? [] : runningGame!.tweaks;

  return (
    <motion.div
      key={runningGame!.id}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        enabled
          ? "border-red-500/40 shadow-[0_0_24px_-6px_rgba(239,68,68,0.3)]"
          : "border-yellow-500/30 shadow-[0_0_20px_-6px_rgba(234,179,8,0.2)]"
      )}
    >
      {/* Cover strip + info row */}
      <div className="flex items-stretch gap-0 min-h-[100px]">
        {/* Cover thumbnail */}
        <div className="relative w-[140px] shrink-0 overflow-hidden">
          {showCover ? (
            <img
              src={runningGame!.coverUrl}
              alt={runningGame!.name}
              onError={() => setImgErr(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={cn(
              "w-full h-full bg-gradient-to-br",
              runningGame!.coverGradient ?? "from-zinc-900 to-zinc-800"
            )} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-950/90" />
        </div>

        {/* Info */}
        <div className="flex-1 px-4 py-3 bg-zinc-950 flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide bg-red-600 text-white">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  NOW PLAYING
                </span>
                {enabled && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                    Optimized
                  </span>
                )}
              </div>
              <h3 className="text-base font-display font-bold text-white leading-tight">{runningGame!.name}</h3>
              <p className="text-[11px] text-zinc-500">{runningGame!.publisher}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                data-testid="button-refresh-nowplaying"
                size="sm"
                variant="outline"
                onClick={() => doScan(false)}
                disabled={scanning}
                className="h-7 px-2.5 border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={cn("w-3 h-3", scanning && "animate-spin")} />
              </Button>
              {!enabled && (
                <Button
                  data-testid="button-enable-running-game"
                  size="sm"
                  onClick={() => setTweak(runningGame!.id, true)}
                  className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 flex items-center gap-1.5"
                >
                  <Zap className="w-3 h-3" />
                  Enable Optimizations
                </Button>
              )}
              {enabled && (
                <Button
                  data-testid="button-disable-running-game"
                  size="sm"
                  variant="outline"
                  onClick={() => setTweak(runningGame!.id, false)}
                  className="h-7 px-3 border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Tweak status */}
          {enabled ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400 font-medium">
                All {runningGame!.tweaks.length} optimizations active — included in your next script download
              </span>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-yellow-400/80 font-medium mb-1.5">
                {missingTweaks.length} optimization{missingTweaks.length !== 1 ? "s" : ""} not yet enabled:
              </p>
              <div className="flex flex-col gap-1">
                {missingTweaks.slice(0, 3).map((t, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <XCircle className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-zinc-400 leading-snug">{t}</span>
                  </div>
                ))}
                {missingTweaks.length > 3 && (
                  <p className="text-[10px] text-zinc-600 pl-4">
                    +{missingTweaks.length - 3} more — click Enable to apply all
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom path footer (always accessible) */}
      <div
        className="px-4 py-2 bg-zinc-900/60 border-t border-white/5 flex items-center gap-3 cursor-pointer hover:bg-zinc-900 transition-colors"
        onClick={() => setShowCustom(v => !v)}
      >
        <FolderOpen className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Game not showing? Add a custom process path
        </span>
      </div>
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-zinc-900/80 border-t border-white/5 flex items-center gap-3">
              <input
                data-testid="input-custom-game-process"
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="Enter process name (e.g. MyGame.exe)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 font-mono"
              />
              <Button
                size="sm"
                onClick={() => doScan(false)}
                disabled={scanning || !customInput.trim()}
                className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 shrink-0"
              >
                Detect
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Game Card ────────────────────────────────────────────────────────────────

function GameCard({ game }: { game: GameEntry }) {
  const { tweaks, setTweak } = useOptimizationStore();
  const enabled = tweaks[game.id] || false;
  const [imgErr, setImgErr] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const showImg = game.coverUrl && !imgErr;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-xl overflow-hidden border transition-all duration-200 group",
        enabled
          ? "border-red-500/50 shadow-[0_0_16px_-4px_rgba(239,68,68,0.35)]"
          : "border-white/8 hover:border-white/15"
      )}
    >
      {/* Cover art area */}
      <div
        className={cn(
          "relative w-full overflow-hidden cursor-pointer",
          "h-[120px]",
          !showImg && `bg-gradient-to-br ${game.coverGradient || "from-zinc-900 to-zinc-800"}`
        )}
        onClick={() => setExpanded(e => !e)}
      >
        {showImg && (
          <img
            src={game.coverUrl}
            alt={game.name}
            onError={() => setImgErr(true)}
            style={game.coverPosition ? { objectPosition: game.coverPosition } : undefined}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {!showImg && (
          <div className="absolute inset-0 flex items-end p-3">
            <span className="text-sm font-black text-white/60 uppercase tracking-widest leading-tight drop-shadow">
              {game.name}
            </span>
          </div>
        )}
        {/* Dark overlay + enabled badge */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {enabled && (
          <div className="absolute top-2 left-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white uppercase tracking-wide shadow">
              INCLUDED
            </span>
          </div>
        )}
        {/* Toggle button */}
        <div className="absolute top-2 right-2">
          <button
            data-testid={`toggle-game-${game.id}`}
            onClick={(e) => { e.stopPropagation(); setTweak(game.id, !enabled); }}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 shadow-lg",
              enabled ? "bg-red-600" : "bg-zinc-700/80 backdrop-blur-sm"
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow ring-0 transition-transform duration-200",
              enabled ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>
        {/* Game name at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
          <p className="text-xs font-bold text-white leading-tight truncate drop-shadow">{game.name}</p>
          <p className="text-[10px] text-zinc-400 truncate">{game.publisher}</p>
        </div>
      </div>

      {/* Tweak list — shown on expand */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="bg-zinc-900/80 border-t border-white/5 px-3 py-2.5 space-y-1.5"
        >
          {game.tweaks.map((tweak, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle className={cn("w-3 h-3 shrink-0 mt-0.5", enabled ? "text-red-400" : "text-zinc-600")} />
              <span className="text-[10px] text-zinc-400 leading-snug">{tweak}</span>
            </div>
          ))}
          <div className="pt-1 flex flex-wrap gap-1">
            {game.detectPaths.map((p, i) => (
              <span key={i} className="text-[9px] font-mono text-zinc-700 truncate max-w-full">{p}</span>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function downloadScannerScript() {
  window.location.href = "/api/detect-games-script";
}

export default function GameDetection() {
  const { tweaks, setAllTweaks } = useOptimizationStore();

  // Read detected game IDs + hardware params from URL (set by the scanner PS1 script)
  const [detectedIds, setDetectedIds] = useState<Set<string> | null>(null);
  const [isFiltered, setIsFiltered] = useState(false);
  const [hwFromUrl, setHwFromUrl] = useState<{ gpu?: string; cpu?: string; ram?: string; vendor?: string; os?: string; laptop?: string } | null>(null);
  const [adminLinkCopied, setAdminLinkCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gamesParam = params.get("games");
    if (gamesParam && gamesParam.trim()) {
      const ids = new Set(gamesParam.split(",").map(id => id.trim()).filter(Boolean));
      if (ids.size > 0) {
        setDetectedIds(ids);
        setIsFiltered(true);
      }
    }
    // Hardware params added by scanner v1.1+
    const gpu = params.get("gpu");
    const cpu = params.get("cpu");
    const ram = params.get("ram");
    const vendor = params.get("vendor");
    const os = params.get("os");
    const laptop = params.get("laptop");
    if (gpu || cpu) {
      setHwFromUrl({ gpu: gpu ?? undefined, cpu: cpu ?? undefined, ram: ram ?? undefined, vendor: vendor ?? undefined, os: os ?? undefined, laptop: laptop ?? undefined });
    }
  }, []);

  function copyAdminPresetLink() {
    if (!hwFromUrl) return;
    const p = new URLSearchParams();
    p.set("tab", "preset");
    if (hwFromUrl.gpu) p.set("gpu", hwFromUrl.gpu);
    if (hwFromUrl.cpu) p.set("cpu", hwFromUrl.cpu);
    if (hwFromUrl.ram) p.set("ram", hwFromUrl.ram);
    if (hwFromUrl.vendor) p.set("vendor", hwFromUrl.vendor);
    if (hwFromUrl.os) p.set("os", hwFromUrl.os);
    if (hwFromUrl.laptop) p.set("laptop", hwFromUrl.laptop);
    const link = `${window.location.origin}/admin?${p.toString()}`;
    navigator.clipboard.writeText(link).then(() => {
      setAdminLinkCopied(true);
      setTimeout(() => setAdminLinkCopied(false), 2000);
    }).catch(() => {
      prompt("Copy this admin preset link:", link);
    });
  }

  // Which games to show: filtered list if detection ran, otherwise all
  const visibleGames = isFiltered && detectedIds
    ? GAMES.filter(g => detectedIds.has(g.id))
    : GAMES;

  const enabledGames = visibleGames.filter(g => tweaks[g.id]);
  const disabledGames = visibleGames.filter(g => !tweaks[g.id]);

  const handleEnableAll = () => {
    const next = { ...useOptimizationStore.getState().tweaks };
    visibleGames.forEach(g => { next[g.id] = true; });
    setAllTweaks(next);
  };

  const handleDisableAll = () => {
    const next = { ...useOptimizationStore.getState().tweaks };
    visibleGames.forEach(g => { next[g.id] = false; });
    setAllTweaks(next);
  };

  const handleShowAll = () => {
    setIsFiltered(false);
    setDetectedIds(null);
    // Clean URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.delete("games");
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Gamepad className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Game Detection & Auto-Optimize</h1>
            <p className="text-zinc-500 text-sm">
              {isFiltered && detectedIds
                ? `${detectedIds.size} game${detectedIds.size !== 1 ? "s" : ""} detected on your PC`
                : "Scan your PC to see only games you have installed"}
            </p>
          </div>
        </motion.div>

        {/* Now Playing Panel — always shown at top */}
        <NowPlayingPanel />

        {/* Detection banner — shown when no scan has been run yet */}
        {!isFiltered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-900/5 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 bg-red-500/15 rounded-lg shrink-0">
                  <Search className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm mb-1">Detect Your Installed Games</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                    Download the free scanner script (less than 2KB). Run it as Administrator — it checks your
                    drives for each game's install path and opens this page showing <span className="text-white font-medium">only the games you have</span>.
                    No data is sent anywhere. The script runs locally and opens your browser automatically.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Checks Steam libraries</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Reads %LocalAppData%</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> No internet calls</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Opens browser automatically</span>
                  </div>
                </div>
              </div>
              <Button
                data-testid="button-download-scanner"
                onClick={downloadScannerScript}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 font-bold shrink-0 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Scanner
              </Button>
            </div>
          </motion.div>
        )}

        {/* Post-scan banner — shown after scanner ran and detected games */}
        {isFiltered && detectedIds && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm text-white font-bold">
                    Scanner found {detectedIds.size} game{detectedIds.size !== 1 ? "s" : ""} on your PC
                  </p>
                  <p className="text-xs text-zinc-400">Only showing games that are actually installed. Toggle the ones you want to optimize.</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  data-testid="button-rescan-games"
                  onClick={downloadScannerScript}
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-scan
                </Button>
                <Button
                  data-testid="button-show-all-games"
                  onClick={handleShowAll}
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs"
                >
                  Show All Games
                </Button>
              </div>
            </div>
            {/* Hardware profile (only shown if scanner detected hardware) */}
            {hwFromUrl && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-400">
                  {hwFromUrl.gpu && (
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-500">GPU</span>
                      <span className="text-zinc-200 font-medium">{hwFromUrl.gpu}</span>
                    </span>
                  )}
                  {hwFromUrl.cpu && (
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-500">CPU</span>
                      <span className="text-zinc-200 font-medium">{hwFromUrl.cpu}</span>
                    </span>
                  )}
                  {hwFromUrl.ram && (
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-500">RAM</span>
                      <span className="text-zinc-200 font-medium">{hwFromUrl.ram}GB</span>
                    </span>
                  )}
                  {hwFromUrl.os && (
                    <span className="text-zinc-500 uppercase">{hwFromUrl.os}</span>
                  )}
                </div>
                <Button
                  data-testid="button-copy-admin-preset-link"
                  size="sm"
                  variant="outline"
                  onClick={copyAdminPresetLink}
                  className="border-zinc-700 text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/40 text-[11px] flex items-center gap-1.5 h-7 px-2.5"
                >
                  {adminLinkCopied ? (
                    <><CheckCircle className="w-3 h-3 text-emerald-400" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copy Admin Preset Link</>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* How it works info box (shown when NOT filtered, compact version) */}
        {!isFiltered && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.07 }}
            className="rounded-xl border border-white/5 bg-zinc-900/50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                Showing all {GAMES.length} supported games. Run the scanner above to filter to only your installed games,
                or manually toggle whichever games you want to include in your script below.
                The PowerShell script always uses <span className="font-mono text-zinc-400">Test-Path</span> at runtime to skip games not found on your PC.
              </p>
            </div>
          </motion.div>
        )}

        {/* Action bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-zinc-500" />
            <p className="text-sm text-zinc-300">
              <span className="text-white font-bold">{enabledGames.length}</span> game{enabledGames.length !== 1 ? "s" : ""} selected
              {isFiltered
                ? <span className="text-zinc-500"> — out of {visibleGames.length} detected</span>
                : <span className="text-zinc-500"> — {disabledGames.length} not included</span>
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-disable-all-games" onClick={handleDisableAll} variant="outline" size="sm"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs">
              Deselect All
            </Button>
            <Button data-testid="button-enable-all-games" onClick={handleEnableAll} size="sm"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30">
              {isFiltered ? "Enable Detected" : "Enable All Games"}
            </Button>
          </div>
        </motion.div>

        {/* No games detected edge case */}
        {isFiltered && visibleGames.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="p-4 bg-zinc-900 rounded-full border border-zinc-800">
              <Gamepad className="w-8 h-8 text-zinc-600" />
            </div>
            <div>
              <p className="text-white font-bold mb-1">No supported games found</p>
              <p className="text-sm text-zinc-500 max-w-sm">
                The scanner didn't find any of the 14 supported games on your PC.
                You can still enable any game pack manually below.
              </p>
            </div>
            <Button
              onClick={handleShowAll}
              className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30"
            >
              Show All Games Manually
            </Button>
          </motion.div>
        )}

        {/* Games — included/enabled */}
        {enabledGames.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">
              Included in Script ({enabledGames.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {enabledGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        {/* Games — not included */}
        {disabledGames.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">
              {enabledGames.length > 0
                ? `Not Included (${disabledGames.length})`
                : isFiltered
                  ? `Detected on Your PC (${disabledGames.length})`
                  : `All Games (${GAMES.length})`
              }
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {disabledGames.map((game, i) => (
                <motion.div key={game.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <GameCard game={game} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Footer note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex items-start gap-3 p-4 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <XCircle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            All game optimizations use Windows IFEO (Image File Execution Options) registry keys and system-level tweaks.
            No DLL injection, no cheat signatures, no in-process modifications.
            Safe for EAC, BattlEye, FACEIT, Vanguard, VAC, and all other anti-cheat systems.
            Your PC, your script, your performance.
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
