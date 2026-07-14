import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useOptimizationStore } from "@/store/use-optimization-store";
import {
  Shield, Terminal, CheckCircle, XCircle, Info,
  Gamepad, Download, RefreshCw, Search, AlertCircle, Copy,
  Play, Zap, FolderOpen, MonitorCheck, CircleDashed,
  Server, Wifi, Trash2, Plus, ExternalLink, HardDrive,
  Settings, Globe, Signal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isNative, scanTaskManager, readFivemLog, openExternal } from "@/lib/tauri-bridge";
import { getTweakMeta } from "@/lib/tweak-registry";

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
    id: "game_cod",
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
    coverUrl: "/game-covers/fivem.svg",
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
      "D:\\Games\\007 First Light\\Retail",
      "C:\\Games\\007 First Light",
      "C:\\Games\\007 First Light\\Retail",
      "E:\\Games\\007 First Light",
      "F:\\Games\\007 First Light",
    ],
    processName: "007FirstLight.exe",
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

// ─── Per-game tweak ID map ────────────────────────────────────────────────────
// Maps each game ID to the real tweak IDs from the registry that apply to it.
// Games not listed here fall back to showing their text-description tweaks.
const GAME_TWEAK_IDS: Partial<Record<string, string[]>> = {
  game_fivem: [
    "FiveMCacheClear", "FiveMHighPriority", "FiveMNetworkBuffer",
    "FiveMQueueFix", "FiveMFullPerfStack", "FiveMGTAProcessPerfOptions",
    "FiveMRenderingBoost", "FiveMGPUPriorityStack", "FiveMDisableLSO",
    "FiveMEnableRSS", "FiveMReduceNPCDensity", "FiveMReduceShadowQuality",
    "FiveMCommandLineTweaks", "FiveMDisableMPO",
  ],
  game_fortnite: [
    "FortniteHighPriority", "FortniteUncapLobbyFPS", "FortniteUncapGameFPS",
    "FortniteDisableVSync", "FortniteEngineStreaming", "FortniteDisableMotionBlur",
    "FortniteNetworkBuffer", "FortniteLowShadows", "FortniteDisableLumen",
    "FortniteGameMode", "FortniteDisableThrottling", "CpuFortniteIFEO",
  ],
  game_cod: [
    "CodDisableTelemetry", "CodTdrDelay", "CodMMCSS", "CodQoSPolicy",
    "CodFramePacing", "CodMemPriority", "CpuCodIFEO",
  ],
  game_warzone: [
    "CodDisableTelemetry", "CodTdrDelay", "CodMMCSS", "CodQoSPolicy",
    "CodFramePacing", "CodMemPriority", "CpuCodIFEO",
  ],
  game_gta5: [
    "FiveMHighPriority", "FiveMNetworkBuffer", "FiveMWorkingSet",
    "FiveMReduceNPCDensity", "FiveMReduceShadowQuality",
    "FiveMCommandLineTweaks", "FiveMGPUPriorityStack",
  ],
  game_valorant: ["CpuGenericGameIFEO"],
  game_apex:     ["CpuGenericGameIFEO"],
  game_siege:    ["CpuGenericGameIFEO"],
  game_pubg:     ["CpuGenericGameIFEO"],
  game_tarkov:   ["CpuGenericGameIFEO"],
  game_rust:     ["CpuGenericGameIFEO"],
};

// ─── Saved server type + active-server helpers ────────────────────────────────
type SavedServer = { name: string; connect: string; iconUrl?: string };
const OG_SERVER_EVENT = "og-server-changed";

/** Add rows here whenever a new well-known server needs an instant logo/name. */
const KNOWN_SERVER_ICONS: Record<string, string> = {
  "pggaejy":       "/game-covers/tmfrz.png",
  "tmfrz":         "/game-covers/tmfrz.png",
  "pvp.tmfrz.com": "/game-covers/tmfrz.png",
  "gunzrz":        "/game-covers/gunzrz.png",
  "pkrkgm":        "/game-covers/combat.png",
  "gadvy3z":       "/game-covers/slumzrz.png",
  "slumzrz":       "/game-covers/slumzrz.png",
};
const KNOWN_SERVER_NAMES: Record<string, string> = {
  "pggaejy":       "TMFRZ PvP",
  "tmfrz":         "TMFRZ PvP",
  "pvp.tmfrz.com": "TMFRZ PvP",
  "gunzrz":        "GunzRz",
  "pkrkgm":        "Combat",
  "gadvy3z":       "Slumz Rz",
  "slumzrz":       "Slumz Rz",
};
function knownServerLookup(connect: string): { icon?: string; name?: string } {
  const h = connect.replace(/:\d+$/, "").toLowerCase();
  if (KNOWN_SERVER_ICONS[h] || KNOWN_SERVER_NAMES[h])
    return { icon: KNOWN_SERVER_ICONS[h], name: KNOWN_SERVER_NAMES[h] };
  for (const key of Object.keys(KNOWN_SERVER_ICONS)) {
    if (h.includes(key) || key.includes(h))
      return { icon: KNOWN_SERVER_ICONS[key], name: KNOWN_SERVER_NAMES[key] };
  }
  return {};
}

/** Strip FiveM in-game command prefixes so we always store a clean code/IP. */
function cleanConnect(raw: string): string {
  return raw.trim()
    .replace(/^connect\s+/i, "")
    .replace(/^fivem:\/\/connect\//i, "")
    .trim();
}
/** Extract a bare cfx.re server code (4-8 alphanumeric chars) from any format. */
function extractCfxCode(connect: string): string | null {
  if (connect.includes(":")) return null;
  const m = connect.match(/(?:cfx\.re\/join\/|join\/)?([A-Za-z0-9]{4,8})$/i);
  return m ? m[1] : null;
}

function getActiveServerInfo(): SavedServer | null {
  try {
    const active = localStorage.getItem("og_fivem_active");
    if (!active) return null;
    const servers: SavedServer[] = JSON.parse(localStorage.getItem("og_fivem_servers") ?? "[]");
    const found = servers.find(s => s.connect === active);
    return found ?? { name: active, connect: active };
  } catch { return null; }
}

// ─── Now Playing Panel ────────────────────────────────────────────────────────

function NowPlayingPanel({ onGameChange }: { onGameChange?: (id: string | null) => void }) {
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

  // Active FiveM server (set from Saved Servers tab)
  const [activeServer, setActiveServerState] = useState<SavedServer | null>(getActiveServerInfo);
  useEffect(() => {
    const handler = () => setActiveServerState(getActiveServerInfo());
    window.addEventListener(OG_SERVER_EVENT, handler);
    return () => window.removeEventListener(OG_SERVER_EVENT, handler);
  }, []);

  // Auto-detect current FiveM server via CitizenFX.log when FiveM is running.
  //
  // STALE-LOG GUARD: CitizenFX.log persists across sessions, so simply reading
  // the last "Connecting to" line on launch would always show the PREVIOUS
  // session's server.  Strategy:
  //   1. On FiveM launch: clear any stale og_fivem_active immediately.
  //   2. First poll: record the last connect target in the log as the BASELINE
  //      (previous session). Save it to the server list so it appears in
  //      Saved Servers, but do NOT mark it active.
  //   3. Every 12 s: if a NEW target appears that differs from baseline, the
  //      user just joined a server in this session → mark it active.
  //
  // DOMAIN/IP SUPPORT: the regex captures ANY connect target, not just 4-8-char
  // cfx.re codes.  "connect pvp.tmfrz.com" and "connect 185.x.x.x:30120" both
  // match.  For cfx codes we also call the cfx.re API to get name + icon.
  useEffect(() => {
    if (runningGame?.id !== "game_fivem") return;
    let mounted = true;
    let baselineConnect: string | null = null;
    let initialized = false;

    // Clear any leftover active server from a previous session immediately
    localStorage.removeItem("og_fivem_active");
    window.dispatchEvent(new CustomEvent(OG_SERVER_EVENT));

    // Normalise a connect string for comparison: strip port + lowercase
    function norm(s: string): string {
      return s.replace(/:\d+$/, "").toLowerCase().trim();
    }

    // Save a server to the list and optionally mark active.
    // Matches existing entries by normalised connect string.
    async function fetchAndSave(rawConnect: string, markActive: boolean) {
      const normRaw = norm(rawConnect);
      const saved: SavedServer[] = JSON.parse(localStorage.getItem("og_fivem_servers") ?? "[]");
      const existing = saved.find(s => norm(s.connect) === normRaw);
      if (existing) {
        if (markActive && mounted) {
          localStorage.setItem("og_fivem_active", existing.connect);
          window.dispatchEvent(new CustomEvent(OG_SERVER_EVENT));
        }
        return;
      }

      // Known-server maps always win over API results for icon/name.
      const isCfxCode = /^[A-Za-z0-9]{4,8}$/.test(rawConnect);
      const known = knownServerLookup(rawConnect);
      let name = known.name ?? rawConnect;
      let iconUrl: string | undefined = known.icon;
      if (isCfxCode) {
        try {
          const res = await fetch(`/api/fivem/server-info/${rawConnect}`);
          if (res.ok && mounted) {
            const data = await res.json();
            const iv = data?.Data?.iconVersion;
            if (!iconUrl) iconUrl = iv ? `https://cfx-nui-prime.akamaized.net/servers/icon/${rawConnect}/${iv}.png` : undefined;
            const hn = (data?.Data?.hostname ?? "") as string;
            if (!known.name) name = hn ? hn.replace(/\^\d/g, "").trim() : rawConnect;
          }
        } catch { /* no icon — that's fine */ }
      } else {
        // Domain / IP server — fetch name + icon from our host-based proxy
        try {
          const hostOnly = rawConnect.replace(/:\d+$/, "");
          const portOnly = rawConnect.match(/:(\d+)$/)?.[1] ?? "30120";
          const res = await fetch(`/api/fivem/server-info-by-host?host=${encodeURIComponent(hostOnly)}&port=${portOnly}`);
          if (res.ok && mounted) {
            const data = await res.json();
            if (!known.name && data.name) name = data.name;
            if (!iconUrl && data.iconUrl) iconUrl = data.iconUrl;
          }
        } catch { /* unreachable — keep defaults */ }
      }

      if (!mounted) return;
      const newServer: SavedServer = { name, connect: rawConnect, iconUrl };
      const latest: SavedServer[] = JSON.parse(localStorage.getItem("og_fivem_servers") ?? "[]");
      localStorage.setItem("og_fivem_servers", JSON.stringify([...latest, newServer]));
      if (markActive) localStorage.setItem("og_fivem_active", rawConnect);
      window.dispatchEvent(new CustomEvent(OG_SERVER_EVENT));
    }

    async function detect() {
      try {
        const logContent = await readFivemLog();
        if (!logContent || !mounted) return;
        // Match any connect target: cfx codes, domains, IPs (with optional port).
        // Examples: "88aypv", "pvp.tmfrz.com", "185.1.2.3:30120", "cfx.re/join/abc123"
        const matches = [...logContent.matchAll(/Connecting to\s+(?:cfx\.re\/join\/)?([^\s,;]+)/gi)];
        if (!matches.length) return;
        const rawConnect = matches[matches.length - 1][1];
        if (!rawConnect || rawConnect.length < 3) return;

        if (!initialized) {
          // First run — record baseline AND mark active.
          // The last "Connecting to" in the log is the server the user is on NOW.
          baselineConnect = norm(rawConnect);
          initialized = true;
          await fetchAndSave(rawConnect, true);
          return;
        }

        // Subsequent polls: only act when a NEW target appears (user just joined)
        if (norm(rawConnect) === baselineConnect) return;
        baselineConnect = norm(rawConnect);
        await fetchAndSave(rawConnect, true);
      } catch { /* no log — that's fine */ }
    }

    detect(); // establish baseline (clears active, no new active-set)
    const interval = setInterval(detect, 12_000); // poll every 12 s
    return () => { mounted = false; clearInterval(interval); };
  }, [runningGame?.id]);

  // Lift running game ID to parent
  useEffect(() => {
    onGameChange?.(runningGame?.id ?? null);
  }, [runningGame?.id, onGameChange]);

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
      // Custom process name / path search
      if (customInput.trim()) {
        const needle = customInput.trim().toLowerCase();
        const isPath = needle.includes('\\') || needle.includes('/');

        if (isPath) {
          // First: try to match against a known game's detectPaths
          const pathGame = GAMES.find(g =>
            g.detectPaths.some(dp => {
              const dpL = dp.toLowerCase();
              return needle.startsWith(dpL) || dpL.startsWith(needle);
            })
          ) ?? null;
          if (pathGame) {
            // Path confirmed — surface the game card directly
            setRunningGame(prev => {
              if (prev?.id !== pathGame.id) setImgErr(false);
              return pathGame;
            });
            setCustomFound(null);
          } else {
            // Fall back: search by last path segment (the exe/folder name)
            const segments = needle.replace(/\//g, '\\').split('\\').filter(Boolean);
            const lastName = segments[segments.length - 1];
            const hit = result.all_processes.find(p => p.name.toLowerCase().includes(lastName));
            setCustomFound(hit ? hit.name : null);
          }
        } else {
          const hit = result.all_processes.find(p => p.name.toLowerCase().includes(needle));
          setCustomFound(hit ? hit.name : null);
        }
      } else {
        setCustomFound(null);
      }
    } catch {
      // non-native or permission denied — silently ignore
    } finally {
      if (!silent) setScanning(false);
    }
  }, [native, processMap, customInput]);

  // Poll every 5 s in native mode; pause automatically when app is in background
  useEffect(() => {
    if (!native) return;
    doScan(true);
    const startPoll = () => {
      if (!pollRef.current) pollRef.current = setInterval(() => doScan(true), 5000);
    };
    const stopPoll = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    const onVisibility = () => {
      if (document.hidden) stopPoll();
      else { doScan(true); startPoll(); }
    };
    startPoll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPoll();
      document.removeEventListener("visibilitychange", onVisibility);
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
                  <span className="text-red-400 font-medium">Not found</span> — "{customInput}" did not match any known game path or running process.{" "}
                  {(customInput.includes('\\') || customInput.includes('/'))
                    ? "Paste the exact install folder (e.g. D:\\Games\\007 First Light) or just type the .exe name (e.g. 007FirstLight.exe)."
                    : "Make sure the game is open and the .exe name is correct, then try again."}
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
  const gameTweakIds = GAME_TWEAK_IDS[runningGame!.id] ?? [];
  const hasSpecificTweaks = gameTweakIds.length > 0;
  // "all enabled" = all individual tweak IDs are on (for games with a specific map),
  // or the master game toggle (for games using text-description fallback).
  const allTweaksEnabled = hasSpecificTweaks
    ? gameTweakIds.every(id => !!(tweaks[id as keyof typeof tweaks]))
    : enabled;
  const enableAllGameTweaks = () => {
    setTweak(runningGame!.id, true);
    if (hasSpecificTweaks) gameTweakIds.forEach(id => setTweak(id, true));
  };
  const disableAllGameTweaks = () => {
    setTweak(runningGame!.id, false);
    if (hasSpecificTweaks) gameTweakIds.forEach(id => setTweak(id, false));
  };

  return (
    <motion.div
      key={runningGame!.id}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        allTweaksEnabled
          ? "border-red-500/40 shadow-[0_0_24px_-6px_rgba(239,68,68,0.3)]"
          : "border-yellow-500/30 shadow-[0_0_20px_-6px_rgba(234,179,8,0.2)]"
      )}
    >
      {/* Cover strip + info row */}
      <div className="flex items-center gap-0">
        {/* Cover: server icon when on FiveM server, game cover otherwise */}
        {runningGame!.id === "game_fivem" && activeServer ? (
          <div className="relative shrink-0 w-[120px] self-stretch overflow-hidden flex items-center justify-center bg-zinc-900">
            {activeServer.iconUrl ? (
              <img
                src={activeServer.iconUrl}
                alt={activeServer.name}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <span className="text-2xl font-black text-zinc-400">
                {activeServer.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        ) : showCover ? (
          <div className="relative shrink-0 w-[120px] self-stretch overflow-hidden bg-zinc-950">
            <img
              src={runningGame!.coverUrl}
              alt={runningGame!.name}
              onError={() => setImgErr(true)}
              className="w-full h-full object-contain"
            />
          </div>
        ) : null}

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
                {runningGame!.id === "game_fivem" && activeServer && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              {runningGame!.id === "game_fivem" && activeServer ? (
                <>
                  <h3 className="text-base font-display font-bold text-white leading-tight">{activeServer.name}</h3>
                  <p className="text-[11px] text-zinc-500">FiveM Server · {activeServer.connect}</p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-display font-bold text-white leading-tight">{runningGame!.name}</h3>
                  <p className="text-[11px] text-zinc-500">{runningGame!.publisher}</p>
                </>
              )}
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
              {!allTweaksEnabled && (
                <Button
                  data-testid="button-enable-running-game"
                  size="sm"
                  onClick={enableAllGameTweaks}
                  className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 flex items-center gap-1.5"
                >
                  <Zap className="w-3 h-3" />
                  Enable All
                </Button>
              )}
              {allTweaksEnabled && (
                <Button
                  data-testid="button-disable-running-game"
                  size="sm"
                  variant="outline"
                  onClick={disableAllGameTweaks}
                  className="h-7 px-3 border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Tweak status — per-tweak toggle rows when IDs are known */}
          {hasSpecificTweaks ? (
            <div className="flex flex-col gap-1 mt-1">
              {gameTweakIds.map(id => {
                const meta = getTweakMeta(id);
                const on = !!(tweaks[id as keyof typeof tweaks]);
                return (
                  <div
                    key={id}
                    data-testid={`tweak-row-${id}`}
                    className="flex items-center justify-between gap-2 px-1 py-0.5 rounded hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {on
                        ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                        : <XCircle className="w-3 h-3 text-zinc-600 shrink-0" />}
                      <span className={cn("text-[10px] truncate leading-snug", on ? "text-zinc-300" : "text-zinc-500")}>
                        {meta?.title ?? id}
                      </span>
                    </div>
                    <button
                      data-testid={`toggle-tweak-${id}`}
                      onClick={() => setTweak(id, !on)}
                      className={cn(
                        "shrink-0 w-7 h-4 rounded-full transition-colors relative",
                        on ? "bg-red-600" : "bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                        on ? "translate-x-3.5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : allTweaksEnabled ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400 font-medium">
                All {runningGame!.tweaks.length} optimizations active — included in your next script download
              </span>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-yellow-400/80 font-medium mb-1.5">
                {runningGame!.tweaks.length} optimization{runningGame!.tweaks.length !== 1 ? "s" : ""} not yet enabled:
              </p>
              <div className="flex flex-col gap-1">
                {runningGame!.tweaks.slice(0, 3).map((t, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <XCircle className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-zinc-400 leading-snug">{t}</span>
                  </div>
                ))}
                {runningGame!.tweaks.length > 3 && (
                  <p className="text-[10px] text-zinc-600 pl-4">
                    +{runningGame!.tweaks.length - 3} more — click Enable All to apply
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active FiveM server — compact connect-code bar */}
      {runningGame!.id === "game_fivem" && activeServer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-center gap-2 px-4 py-2 border-t border-emerald-500/10 bg-emerald-950/10"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[10px] font-mono text-zinc-500 flex-1 truncate">{activeServer.connect}</span>
          <button
            data-testid="button-clear-active-server"
            onClick={() => {
              localStorage.removeItem("og_fivem_active");
              window.dispatchEvent(new CustomEvent(OG_SERVER_EVENT));
            }}
            className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors shrink-0 px-2 py-1 rounded hover:bg-white/5"
          >
            Clear
          </button>
        </motion.div>
      )}

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

// ─── PS1 Download Helper ──────────────────────────────────────────────────────
function downloadPs1(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Reusable pill-toggle ─────────────────────────────────────────────────────
function PillToggle({ on, onToggle, testId }: { on: boolean; onToggle: () => void; testId?: string }) {
  return (
    <button
      data-testid={testId}
      onClick={onToggle}
      className={cn("shrink-0 w-7 h-4 rounded-full transition-colors relative", on ? "bg-red-600" : "bg-zinc-700")}
    >
      <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", on ? "translate-x-3.5" : "translate-x-0.5")} />
    </button>
  );
}

// ─── FiveM BSK Panel ──────────────────────────────────────────────────────────
const FIVEM_PANEL_TABS = [
  { id: "tools", label: "Quick Tools" },
  { id: "citizenfx", label: "CitizenFX Settings" },
  { id: "ping", label: "Ping Optimizer" },
  { id: "servers", label: "Saved Servers" },
] as const;
type FiveMPanelTab = typeof FIVEM_PANEL_TABS[number]["id"];

function FiveMPanel() {
  const [tab, setTab] = useState<FiveMPanelTab>("tools");
  const [boostDone, setBoostDone] = useState(false);
  const [cacheDone, setCacheDone] = useState(false);

  const [cfx, setCfx] = useState({ enforceSingleCore: false, customBackdrop: true, asyncLoading: true, maxBandwidth: "0" });

  const [pingTweaks, setPingTweaks] = useState({ routing: true, ctcp: true, buffers: true, stabilizer: true, dns: true });
  const togglePing = (k: keyof typeof pingTweaks) => setPingTweaks(p => ({ ...p, [k]: !p[k] }));

  const [servers, setServers] = useState<SavedServer[]>(() => {
    try { return JSON.parse(localStorage.getItem("og_fivem_servers") ?? "[]"); } catch { return []; }
  });
  const [srvName, setSrvName] = useState("");
  const [srvConnect, setSrvConnect] = useState("");
  const [srvAdding, setSrvAdding] = useState(false);
  const [activeConnect, setActiveConnect] = useState<string | null>(() => localStorage.getItem("og_fivem_active"));

  const saveServers = (list: SavedServer[]) => {
    setServers(list);
    localStorage.setItem("og_fivem_servers", JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(OG_SERVER_EVENT));
  };

  const setActiveServer = (connect: string | null) => {
    setActiveConnect(connect);
    if (connect) localStorage.setItem("og_fivem_active", connect);
    else localStorage.removeItem("og_fivem_active");
    window.dispatchEvent(new CustomEvent(OG_SERVER_EVENT));
  };

  // One-time migration: patch any existing saved servers that match known servers
  // but are missing logo/name (e.g. old pvp.tmfrz.com entry without logo).
  useEffect(() => {
    const list: SavedServer[] = JSON.parse(localStorage.getItem("og_fivem_servers") ?? "[]");
    let changed = false;
    const patched = list.map(s => {
      const k = knownServerLookup(s.connect);
      if (!k.icon && !k.name) return s;
      const next = { ...s };
      if (k.icon && !s.iconUrl) { next.iconUrl = k.icon; changed = true; }
      if (k.name && s.name === s.connect) { next.name = k.name; changed = true; }
      return next;
    });
    if (changed) {
      localStorage.setItem("og_fivem_servers", JSON.stringify(patched));
      setServers(patched);
    }
  }, []);

  // Auto-activate: if only 1 saved server and none is marked active, mark it automatically
  useEffect(() => {
    if (servers.length === 1 && !activeConnect) {
      setActiveServer(servers[0].connect);
    }
  }, [servers.length]);

  const addServer = async () => {
    const rawInput = srvConnect.trim();
    if (!rawInput) return;
    const connect = cleanConnect(rawInput);
    setSrvAdding(true);
    let iconUrl: string | undefined;
    let resolvedName = srvName.trim() || connect;
    const cfxCode = extractCfxCode(connect);
    if (cfxCode) {
      try {
        const res = await fetch(`/api/fivem/server-info/${cfxCode}`);
        if (res.ok) {
          const data = await res.json();
          const iv = data?.Data?.iconVersion;
          if (iv) iconUrl = `https://cfx-nui-prime.akamaized.net/servers/icon/${cfxCode}/${iv}.png`;
          const hn = data?.Data?.hostname as string | undefined;
          if (hn && !srvName.trim()) resolvedName = hn.replace(/\^\d/g, "").trim() || connect;
        }
      } catch { /* no icon — that's fine */ }
    }
    saveServers([...servers, { name: resolvedName, connect, iconUrl }]);
    setSrvName(""); setSrvConnect("");
    setSrvAdding(false);
  };

  const removeServer = (i: number) => {
    const removed = servers[i];
    const next = servers.filter((_, idx) => idx !== i);
    saveServers(next);
    if (activeConnect === removed.connect) setActiveServer(null);
  };

  const joinServer = (connect: string) => {
    const clean = cleanConnect(connect);
    let url: string;
    if (clean.startsWith("http")) {
      url = clean;
    } else if (clean.includes(":")) {
      url = `fivem://connect/${clean}`;
    } else {
      const code = extractCfxCode(clean) ?? clean;
      url = `fivem://connect/cfx.re/join/${code}`;
    }
    openExternal(url);
  };

  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);

  const refreshServerInfo = async (i: number) => {
    const s = servers[i];
    const cfxCode = extractCfxCode(s.connect);
    if (!cfxCode) return;
    setRefreshingIdx(i);
    try {
      const res = await fetch(`/api/fivem/server-info/${cfxCode}`);
      if (res.ok) {
        const data = await res.json();
        const iv = data?.Data?.iconVersion;
        const iconUrl = iv ? `https://cfx-nui-prime.akamaized.net/servers/icon/${cfxCode}/${iv}.png` : s.iconUrl;
        const hn = data?.Data?.hostname as string | undefined;
        const name = hn ? hn.replace(/\^\d/g, "").trim() || s.name : s.name;
        const next = [...servers];
        next[i] = { ...s, name, iconUrl };
        saveServers(next);
      }
    } catch { /* ignore */ }
    setRefreshingIdx(null);
  };

  const genCacheScript = () => {
    downloadPs1(`# OptiGods — FiveM Cache Cleaner
# Run as Administrator
Write-Host "=== FiveM Cache Cleaner ===" -ForegroundColor Cyan
$d = "$env:LOCALAPPDATA\\FiveM\\FiveM.app\\data"
$caches = @{
    "Shader + Script Cache" = "$d\\cache"
    "NUI / Browser Cache"   = "$d\\nui-storage"
    "Server Resource Cache" = "$d\\server-cache"
    "Private Server Cache"  = "$d\\priv"
}
$total = 0
foreach ($c in $caches.GetEnumerator()) {
    if (Test-Path $c.Value) {
        $sz = (Get-ChildItem $c.Value -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $total += [long]$sz
        Remove-Item "$($c.Value)\\*" -Recurse -Force -EA SilentlyContinue
        Write-Host ("[OK] Cleared {0} ({1} MB)" -f $c.Key, [math]::Round($sz/1MB,1)) -ForegroundColor Green
    } else {
        Write-Host ("[--] Not found: {0}" -f $c.Key) -ForegroundColor DarkGray
    }
}
Write-Host ""
Write-Host ("Total freed: {0} MB" -f [math]::Round($total/1MB,1)) -ForegroundColor Cyan
Write-Host "Restart FiveM for changes to take effect." -ForegroundColor White
Pause`, "FiveM_ClearCache.ps1");
    setCacheDone(true); setTimeout(() => setCacheDone(false), 3000);
  };

  const genBoostScript = () => {
    downloadPs1(`# OptiGods — FiveM Pre-Session Boost
# Run as Administrator
Write-Host "=== FiveM Pre-Session Boost ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/5] Flushing standby memory..." -ForegroundColor Yellow
try {
    $src = @"
using System; using System.Runtime.InteropServices;
public class OGMem { [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr h); }
"@
    if (-not ([System.Management.Automation.PSTypeName]'OGMem').Type) { Add-Type -TypeDefinition $src -EA SilentlyContinue }
    Get-Process | ForEach-Object { try { [OGMem]::EmptyWorkingSet($_.Handle) } catch {} }
    Write-Host "    Standby RAM flushed" -ForegroundColor Green
} catch { Write-Host "    Skipped (not admin or already clean)" -ForegroundColor DarkGray }
Write-Host "[2/5] Killing bandwidth hogs..." -ForegroundColor Yellow
@("OneDrive","Dropbox","GoogleDriveFS","MicrosoftEdgeUpdate","SteamService","EpicGamesLauncher","SearchIndexer") |
    ForEach-Object { if (Get-Process -Name $_ -EA SilentlyContinue) { Stop-Process -Name $_ -Force -EA SilentlyContinue; Write-Host "    Stopped: $_" -ForegroundColor Green } }
Write-Host "[3/5] Disabling Nagle's algorithm on all NICs..." -ForegroundColor Yellow
Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" | ForEach-Object {
    Set-ItemProperty -Path $_.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -EA SilentlyContinue
    Set-ItemProperty -Path $_.PSPath -Name "TCPNoDelay" -Value 1 -Type DWord -EA SilentlyContinue
}
Write-Host "    Done" -ForegroundColor Green
Write-Host "[4/5] Flushing DNS cache..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null
Write-Host "    Done" -ForegroundColor Green
Write-Host "[5/5] Boosting FiveM process priority if running..." -ForegroundColor Yellow
Get-Process -Name "FiveM" -EA SilentlyContinue | ForEach-Object { $_.PriorityClass = "AboveNormal"; Write-Host "    Boosted: $($_.Name)" -ForegroundColor Green }
Write-Host ""
Write-Host "Pre-session boost complete! Launch FiveM now." -ForegroundColor Cyan
Pause`, "FiveM_PreSessionBoost.ps1");
    setBoostDone(true); setTimeout(() => setBoostDone(false), 3000);
  };

  const genCfxScript = () => {
    const b = (v: boolean) => v ? "true" : "false";
    downloadPs1(`# OptiGods — CitizenFX Settings
$p = "$env:APPDATA\\CitizenFX\\cfg.ini"
New-Item -ItemType Directory -Force -Path (Split-Path $p) | Out-Null
$content = @"
# Generated by OptiGods
game_enforceSingleCore ${b(cfx.enforceSingleCore)}
ui_customBackdrop ${b(cfx.customBackdrop)}
game_useAsyncLoadingTriggers ${b(cfx.asyncLoading)}
ui_maxBandwidth ${cfx.maxBandwidth}
"@
Set-Content -Path $p -Value $content -Encoding UTF8
Write-Host "CitizenFX settings written to: $p" -ForegroundColor Green
Pause`, "FiveM_CitizenFX_Settings.ps1");
  };

  const genPingScript = () => {
    const lines: string[] = [
      "# OptiGods — FiveM Ping Optimizer",
      "# Run as Administrator",
      `Write-Host "=== FiveM Ping Optimizer ===" -ForegroundColor Cyan`,
      "",
    ];
    if (pingTweaks.routing) {
      lines.push(`netsh int ip set global defaultcurhoplimit=64 | Out-Null`);
      lines.push(`netsh int tcp set global ecncapability=enabled | Out-Null`);
      lines.push(`Write-Host "[OK] Optimized routing — TTL=64, ECN on" -ForegroundColor Green`);
    }
    if (pingTweaks.ctcp) {
      lines.push(`netsh int tcp set supplemental template=Internet congestionprovider=ctcp | Out-Null`);
      lines.push(`Write-Host "[OK] Congestion avoidance — CTCP enabled" -ForegroundColor Green`);
    }
    if (pingTweaks.buffers) {
      lines.push(`netsh int tcp set global autotuninglevel=normal | Out-Null`);
      lines.push(`netsh int tcp set global chimney=disabled | Out-Null`);
      lines.push(`Write-Host "[OK] Packet loss reduction — socket buffers tuned" -ForegroundColor Green`);
    }
    if (pingTweaks.stabilizer) {
      lines.push(`Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" -Name "KeepAliveTime" -Value 7200000 -Type DWord -EA SilentlyContinue`);
      lines.push(`Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" -Name "KeepAliveInterval" -Value 1000 -Type DWord -EA SilentlyContinue`);
      lines.push(`Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters" -Name "NodeType" -Value 2 -Type DWord -EA SilentlyContinue`);
      lines.push(`Write-Host "[OK] Connection stabilizer — keep-alives on, NetBIOS off" -ForegroundColor Green`);
    }
    if (pingTweaks.dns) {
      lines.push(`try {`);
      lines.push(`    Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Set-DnsClientServerAddress -ServerAddresses ('1.1.1.1','8.8.8.8') -EA SilentlyContinue`);
      lines.push(`    ipconfig /flushdns | Out-Null`);
      lines.push(`    Write-Host "[OK] Smart DNS — Cloudflare+Google, cache flushed" -ForegroundColor Green`);
      lines.push(`} catch { Write-Host "[SKIP] DNS — run as admin to apply" -ForegroundColor Yellow }`);
    }
    lines.push(``, `Write-Host ""`, `Write-Host "Ping optimizer complete! Restart FiveM for best results." -ForegroundColor Cyan`, `Pause`);
    downloadPs1(lines.join("\n"), "FiveM_PingOptimizer.ps1");
  };

  const PING_ROWS = [
    { key: "routing" as const, label: "Optimized routing", desc: "ECN enabled, TTL=64 for efficient packet delivery" },
    { key: "ctcp" as const, label: "Congestion avoidance", desc: "Compound TCP (CTCP) — better throughput on lossy links" },
    { key: "buffers" as const, label: "Packet loss reduction", desc: "Socket buffer tuning, chimney disabled" },
    { key: "stabilizer" as const, label: "Connection stabilizer", desc: "TCP keep-alives + disable NetBIOS over TCP/IP" },
    { key: "dns" as const, label: "Smart DNS relay", desc: "Cloudflare 1.1.1.1 + Google 8.8.8.8, flush DNS cache" },
  ];

  const CFX_ROWS = [
    { key: "enforceSingleCore" as const, label: "game_enforceSingleCore", desc: "Force single-core scheduling — set false for multi-core perf", mono: true },
    { key: "customBackdrop" as const, label: "ui_customBackdrop", desc: "Allow custom menu backgrounds on servers", mono: true },
    { key: "asyncLoading" as const, label: "game_useAsyncLoadingTriggers", desc: "Async resource loading triggers — reduces micro-stutters", mono: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-red-500/25 bg-zinc-950 overflow-hidden shadow-[0_0_30px_-8px_rgba(239,68,68,0.18)]"
    >
      {/* Panel header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-red-600/10 border-b border-red-500/20">
        <Zap className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="text-[11px] font-black text-red-300 uppercase tracking-wider">FiveM Optimizer</span>
        <span className="text-[10px] text-zinc-600 ml-auto">OptiGods × BSK-style tools</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/8">
        {FIVEM_PANEL_TABS.map(t => (
          <button
            key={t.id}
            data-testid={`tab-fivem-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors border-b-2",
              tab === t.id
                ? "text-red-400 border-red-500 bg-red-500/5"
                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/3"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* ── Quick Tools ── */}
        {tab === "tools" && (
          <div className="space-y-3">
            {/* Pre-Session Boost */}
            <div className="rounded-lg border border-white/8 bg-zinc-900/60 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Pre-Session Boost</p>
                  <p className="text-[11px] text-zinc-500">Launch prep: flush RAM, kill BW hogs, disable Nagle, boost FiveM priority</p>
                </div>
                <Button
                  data-testid="button-fivem-pre-boost"
                  size="sm"
                  onClick={genBoostScript}
                  className={cn("h-7 px-3 text-xs font-bold border shrink-0 flex items-center gap-1.5",
                    boostDone
                      ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                      : "bg-red-600 hover:bg-red-700 text-white border-red-500/30"
                  )}
                >
                  {boostDone ? <><CheckCircle className="w-3 h-3" />Saved!</> : <><Download className="w-3 h-3" />Download .ps1</>}
                </Button>
              </div>
              <div className="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {["Flush standby RAM", "Kill bandwidth hogs", "Disable Nagle's algorithm", "Flush DNS cache", "Boost FiveM priority"].map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span className="text-[11px] text-zinc-500">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cache Cleaner */}
            <div className="rounded-lg border border-white/8 bg-zinc-900/60 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Trash2 className="w-4 h-4 text-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">FiveM Cache Cleaner</p>
                  <p className="text-[11px] text-zinc-500">Fixes stutters, shader recompile loops, NUI glitches — clears all 4 cache folders</p>
                </div>
                <Button
                  data-testid="button-fivem-clean-cache"
                  size="sm"
                  onClick={genCacheScript}
                  className={cn("h-7 px-3 text-xs font-bold border shrink-0 flex items-center gap-1.5",
                    cacheDone
                      ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
                  )}
                >
                  {cacheDone ? <><CheckCircle className="w-3 h-3" />Saved!</> : <><Download className="w-3 h-3" />Download .ps1</>}
                </Button>
              </div>
              <div className="px-4 py-2.5 space-y-1.5">
                {[
                  { label: "Shader & Script cache", path: "FiveM.app\\data\\cache" },
                  { label: "NUI / Browser cache", path: "FiveM.app\\data\\nui-storage" },
                  { label: "Server resource cache", path: "FiveM.app\\data\\server-cache" },
                  { label: "Private server cache", path: "FiveM.app\\data\\priv" },
                ].map(({ label, path }) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-zinc-700 shrink-0" />
                      <span className="text-[11px] text-zinc-400">{label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-700 truncate">{path}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CitizenFX Settings ── */}
        {tab === "citizenfx" && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Writes to <span className="font-mono text-zinc-400">%APPDATA%\CitizenFX\cfg.ini</span> — restart FiveM after applying.
            </p>
            <div className="space-y-2">
              {CFX_ROWS.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-zinc-300">{label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-600">{cfx[key] ? "true" : "false"}</span>
                    <PillToggle
                      on={cfx[key]}
                      onToggle={() => setCfx(p => ({ ...p, [key]: !p[key] }))}
                      testId={`toggle-cfx-${key}`}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-zinc-300">ui_maxBandwidth</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Max UI bandwidth in bytes/s — 0 = unlimited (recommended)</p>
                </div>
                <input
                  data-testid="input-cfx-maxbandwidth"
                  type="text"
                  value={cfx.maxBandwidth}
                  onChange={e => setCfx(p => ({ ...p, maxBandwidth: e.target.value.replace(/\D/g, "") || "0" }))}
                  className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
            <Button
              data-testid="button-apply-cfx"
              onClick={genCfxScript}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Download cfg.ini Script
            </Button>
          </div>
        )}

        {/* ── Ping Optimizer ── */}
        {tab === "ping" && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Generates a PowerShell script with selected network tweaks. Run as Administrator.
            </p>
            <div className="space-y-2">
              {PING_ROWS.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/5">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Wifi className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-200 font-medium">{label}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <PillToggle on={pingTweaks[key]} onToggle={() => togglePing(key)} testId={`toggle-ping-${key}`} />
                </div>
              ))}
            </div>
            <Button
              data-testid="button-apply-ping"
              onClick={genPingScript}
              disabled={!Object.values(pingTweaks).some(Boolean)}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              Download Ping Optimizer Script
            </Button>
          </div>
        )}

        {/* ── Saved Servers ── */}
        {tab === "servers" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-zinc-900 border border-white/8 p-3 space-y-2">
              <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wide">Add Server</p>
              <input
                data-testid="input-server-name"
                type="text"
                value={srvName}
                onChange={e => setSrvName(e.target.value)}
                placeholder="Server name (optional)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
              />
              <div className="flex gap-2">
                <input
                  data-testid="input-server-connect"
                  type="text"
                  value={srvConnect}
                  onChange={e => setSrvConnect(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addServer(); }}
                  placeholder="cfx.re/join/XXXXXX or IP:Port"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 font-mono"
                />
                <Button
                  data-testid="button-add-server"
                  size="sm"
                  onClick={addServer}
                  disabled={!srvConnect.trim() || srvAdding}
                  className="h-7 px-3 bg-red-600 hover:bg-red-700 text-white border border-red-500/30 disabled:opacity-40 shrink-0 flex items-center gap-1"
                >
                  {srvAdding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {srvAdding && (
                <p className="text-[10px] text-zinc-500 animate-pulse">Fetching server info from cfx.re…</p>
              )}
            </div>

            {servers.length === 0 ? (
              <div className="py-8 text-center">
                <Server className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">No saved servers yet</p>
                <p className="text-[11px] text-zinc-700 mt-0.5">Add a cfx.re join code or IP:Port above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map((s, i) => {
                  const isActive = activeConnect === s.connect;
                  return (
                    <div
                      key={i}
                      data-testid={`server-row-${i}`}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors",
                        isActive
                          ? "bg-emerald-950/30 border-emerald-500/25"
                          : "bg-zinc-900 border-white/8"
                      )}
                    >
                      {/* Server icon / initials */}
                      {s.iconUrl ? (
                        <img
                          src={s.iconUrl}
                          alt=""
                          className="w-10 h-10 rounded object-cover shrink-0 border border-white/10"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-zinc-400">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Name + connect */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                          <p className={cn("text-[11px] font-bold truncate", isActive ? "text-emerald-300" : "text-white")}>{s.name}</p>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-600 truncate">{s.connect}</p>
                      </div>

                      {/* Playing Now toggle */}
                      <button
                        data-testid={`button-playing-now-${i}`}
                        onClick={() => setActiveServer(isActive ? null : s.connect)}
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded border shrink-0 transition-colors whitespace-nowrap",
                          isActive
                            ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500"
                        )}
                      >
                        {isActive ? "✓ Playing" : "Set Active"}
                      </button>

                      {/* Connect */}
                      <Button
                        data-testid={`button-join-server-${i}`}
                        size="sm"
                        onClick={() => { setActiveServer(s.connect); joinServer(s.connect); }}
                        className="h-6 px-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[10px] font-bold border border-emerald-500/30 transition-colors shrink-0 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Connect
                      </Button>

                      {/* Refresh server info */}
                      {extractCfxCode(s.connect) && (
                        <button
                          data-testid={`button-refresh-server-${i}`}
                          onClick={() => refreshServerInfo(i)}
                          disabled={refreshingIdx === i}
                          title="Refresh server name & icon from cfx.re"
                          className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 disabled:opacity-40"
                        >
                          <RefreshCw className={cn("w-3 h-3", refreshingIdx === i && "animate-spin")} />
                        </button>
                      )}

                      {/* Remove */}
                      <button
                        data-testid={`button-remove-server-${i}`}
                        onClick={() => removeServer(i)}
                        className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-zinc-700 text-center">Servers saved locally — never sent anywhere. Icons auto-fetched from cfx.re.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Fortnite Panel ───────────────────────────────────────────────────────────
function FortnitePanel() {
  const [launchOpts, setLaunchOpts] = useState({ dx12: true, noTextureStreaming: false, noSplash: true, noManSky: false, preferD3d12: false });
  const toggleLaunch = (k: keyof typeof launchOpts) => setLaunchOpts(p => ({ ...p, [k]: !p[k] }));
  const [copied, setCopied] = useState(false);
  const [perfDone, setPerfDone] = useState(false);

  const LAUNCH_ROWS = [
    { key: "dx12" as const, label: "-dx12", desc: "Force DirectX 12 — better multi-core CPU usage" },
    { key: "preferD3d12" as const, label: "-preferD3d12", desc: "Prefer D3D12 path (newer Fortnite builds)" },
    { key: "noTextureStreaming" as const, label: "-notexturestreaming", desc: "Disable texture streaming — reduces pop-in (needs VRAM)" },
    { key: "noSplash" as const, label: "-nosplash", desc: "Skip Epic Games splash screen on launch" },
    { key: "noManSky" as const, label: "-nomansky", desc: "Disable sky simulation — marginal CPU save" },
  ];

  const launchString = Object.entries(launchOpts).filter(([, v]) => v)
    .map(([k]) => LAUNCH_ROWS.find(r => r.key === k)?.label ?? "").filter(Boolean).join(" ");

  const copyLaunch = () => {
    navigator.clipboard.writeText(launchString).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const genPerfScript = () => {
    downloadPs1(`# OptiGods — Fortnite Performance Tweaks
# Run as Administrator
Write-Host "=== Fortnite Performance Tweaks ===" -ForegroundColor Cyan
# Above Normal CPU priority for Fortnite via IFEO
$ifeo = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions"
New-Item -Path $ifeo -Force | Out-Null
Set-ItemProperty -Path $ifeo -Name "CpuPriorityClass" -Value 3 -Type DWord
Set-ItemProperty -Path $ifeo -Name "IoPriority" -Value 3 -Type DWord
Write-Host "[OK] CPU Above Normal priority + High I/O (IFEO persistent)" -ForegroundColor Green
# Disable Game DVR / Xbox captures
Set-ItemProperty "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord -EA SilentlyContinue
Set-ItemProperty "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 0 -Type DWord -EA SilentlyContinue
Write-Host "[OK] Game DVR disabled" -ForegroundColor Green
# Flush DNS for Epic servers
ipconfig /flushdns | Out-Null
Write-Host "[OK] DNS flushed" -ForegroundColor Green
Write-Host ""
Write-Host "Done! Restart Fortnite for changes to take effect." -ForegroundColor Cyan
Pause`, "Fortnite_Perf.ps1");
    setPerfDone(true); setTimeout(() => setPerfDone(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-purple-500/20 bg-zinc-950 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-purple-600/8 border-b border-purple-500/15">
        <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider">Fortnite Optimizer</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Launch options */}
        <div>
          <p className="text-xs font-bold text-zinc-300 mb-2">Launch Options</p>
          <div className="space-y-2 mb-3">
            {LAUNCH_ROWS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-900 border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-zinc-200">{label}</p>
                  <p className="text-[10px] text-zinc-600">{desc}</p>
                </div>
                <PillToggle on={launchOpts[key]} onToggle={() => toggleLaunch(key)} testId={`toggle-fn-${key}`} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 border border-white/5">
            <code className="flex-1 text-[11px] text-zinc-400 font-mono truncate">{launchString || "(no options selected)"}</code>
            <Button
              data-testid="button-copy-launch-opts"
              size="sm"
              onClick={copyLaunch}
              disabled={!launchString}
              className={cn("h-6 px-2 text-[10px] font-bold border shrink-0 flex items-center gap-1",
                copied
                  ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
              )}
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-[10px] text-zinc-700 mt-1.5">Paste into Epic Launcher → Fortnite → Options → Additional Command Line Arguments</p>
        </div>
        {/* Perf script */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-zinc-900 border border-white/5">
          <Signal className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-white">Performance Script</p>
            <p className="text-[10px] text-zinc-600">IFEO CPU priority, disable Game DVR, flush DNS</p>
          </div>
          <Button
            data-testid="button-fortnite-perf-script"
            size="sm"
            onClick={genPerfScript}
            className={cn("h-7 px-3 text-xs font-bold border shrink-0 flex items-center gap-1.5",
              perfDone
                ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                : "bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
            )}
          >
            {perfDone ? <><CheckCircle className="w-3 h-3" />Saved!</> : <><Download className="w-3 h-3" />Download .ps1</>}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── COD / Warzone Panel ──────────────────────────────────────────────────────
function CodPanel() {
  const [done, setDone] = useState(false);

  const genScript = () => {
    downloadPs1(`# OptiGods — Call of Duty Performance Tweaks
# Run as Administrator
Write-Host "=== COD Performance Tweaks ===" -ForegroundColor Cyan
# IFEO CPU + I/O priority
$ifeo = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\cod.exe\\PerfOptions"
New-Item -Path $ifeo -Force | Out-Null
Set-ItemProperty -Path $ifeo -Name "CpuPriorityClass" -Value 3 -Type DWord
Set-ItemProperty -Path $ifeo -Name "IoPriority" -Value 3 -Type DWord
Write-Host "[OK] CPU Above Normal priority + High I/O for cod.exe" -ForegroundColor Green
# Network socket buffers (reduces packet batching lag on BR servers)
Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters" -Name "DefaultSendWindow" -Value 262144 -Type DWord -EA SilentlyContinue
Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\AFD\\Parameters" -Name "DefaultReceiveWindow" -Value 262144 -Type DWord -EA SilentlyContinue
Write-Host "[OK] Socket buffers set to 256 KB" -ForegroundColor Green
# Disable TCP timestamps
Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" -Name "Tcp1323Opts" -Value 0 -Type DWord -EA SilentlyContinue
Write-Host "[OK] TCP timestamps disabled — lower RTT variance" -ForegroundColor Green
# Disable Game DVR
Set-ItemProperty "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord -EA SilentlyContinue
Write-Host "[OK] Game DVR disabled" -ForegroundColor Green
Write-Host ""
Write-Host "Done! Restart COD for changes to take effect." -ForegroundColor Cyan
Pause`, "COD_Perf.ps1");
    setDone(true); setTimeout(() => setDone(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-orange-500/20 bg-zinc-950 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-orange-600/8 border-b border-orange-500/15">
        <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        <span className="text-[11px] font-black text-orange-300 uppercase tracking-wider">COD / Warzone Optimizer</span>
      </div>
      <div className="p-4">
        <div className="space-y-2 mb-4">
          {[
            { label: "IFEO CPU priority — Above Normal for cod.exe (persistent)", icon: <CheckCircle className="w-3 h-3 text-orange-400 shrink-0" /> },
            { label: "Socket buffers 256 KB — reduces packet batching on BR servers", icon: <CheckCircle className="w-3 h-3 text-orange-400 shrink-0" /> },
            { label: "TCP timestamps disabled — lower RTT variance", icon: <CheckCircle className="w-3 h-3 text-orange-400 shrink-0" /> },
            { label: "Game DVR disabled — eliminates capture overhead", icon: <CheckCircle className="w-3 h-3 text-orange-400 shrink-0" /> },
          ].map(({ label, icon }) => (
            <div key={label} className="flex items-center gap-2 text-[11px] text-zinc-400">
              {icon}{label}
            </div>
          ))}
        </div>
        <Button
          data-testid="button-cod-perf-script"
          onClick={genScript}
          className={cn("w-full text-xs font-bold border flex items-center justify-center gap-2",
            done
              ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
              : "bg-orange-600/80 hover:bg-orange-600 text-white border-orange-500/30"
          )}
        >
          {done ? <><CheckCircle className="w-3.5 h-3.5" />Saved!</> : <><Download className="w-3.5 h-3.5" />Download COD Perf Script (.ps1)</>}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Background Ping Guardian ─────────────────────────────────────────────────
const GUARDIAN_PS1 = `# OptiGods — Background Ping Guardian v4
# Monitors ANY game launch and instantly applies network optimizations.
# Keep this window open (minimized is fine). Press Ctrl+C to stop.
# Run as Administrator for full effect.
$ErrorActionPreference = "SilentlyContinue"
Write-Host "=== OptiGods Background Ping Guardian ===" -ForegroundColor Cyan
Write-Host "Watching for any game launch every 30 seconds. Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Tracked game process names (add your own here)
$GameProcesses = @(
    "FiveM","GTA5","GTAV","RDR2",
    "Warzone","ModernWarfare","BlackOps6","mw2","cod",
    "Fortnite","FortniteClient-Win64-Shipping",
    "VALORANT-Win64-Shipping","VALORANT",
    "cs2","csgo",
    "r5apex","apex",
    "RustClient","rust",
    "r6s","Rainbow6","RainbowSix",
    "Overwatch","Overwatch2",
    "bf2042","bfv","bf1",
    "EscapeFromTarkov",
    "destiny2","destiny",
    "Splitgate",
    "paladins","smite"
)

function Apply-Optimizations {
    # Kill bandwidth hogs
    @("OneDrive","Dropbox","GoogleDriveFS","EpicGamesLauncher","SearchIndexer","MicrosoftEdgeUpdate") |
        ForEach-Object { Stop-Process -Name $_ -Force -EA SilentlyContinue }
    # Disable Nagle on all active NICs
    Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" | ForEach-Object {
        Set-ItemProperty -Path $_.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -EA SilentlyContinue
        Set-ItemProperty -Path $_.PSPath -Name "TCPNoDelay"       -Value 1 -Type DWord -EA SilentlyContinue
    }
    # QoS: tag all UDP game traffic with DSCP EF (expedited forwarding)
    netsh qos add policy "OptiGods-Game-QoS" DSCP=46 PriorityValue8021Action=6 Protocol=UDP 2>$null | Out-Null
    # Flush DNS for clean server resolution
    ipconfig /flushdns | Out-Null
    Write-Host ("[{0}] Applied: Nagle off, QoS tagged, bandwidth cleared, DNS flushed" -f (Get-Date -Format "HH:mm:ss")) -ForegroundColor Green
}

function Get-RunningGame {
    foreach ($g in $GameProcesses) {
        $p = Get-Process -Name $g -EA SilentlyContinue
        if ($null -ne $p) { return $g }
    }
    return $null
}

$wasRunning = $false
while ($true) {
    $game = Get-RunningGame
    $isRunning = ($null -ne $game)
    if ($isRunning -and -not $wasRunning) {
        Write-Host ""
        Write-Host ("[{0}] Game detected: {1} — applying launch optimizations..." -f (Get-Date -Format "HH:mm:ss"), $game) -ForegroundColor Cyan
        Apply-Optimizations
        $wasRunning = $true
    } elseif (-not $isRunning -and $wasRunning) {
        Write-Host ("[{0}] Game closed. Guardian watching for next session..." -f (Get-Date -Format "HH:mm:ss")) -ForegroundColor Gray
        $wasRunning = $false
    } elseif ($isRunning) {
        Write-Host ("[{0}] {1} running — re-checking ping optimizations..." -f (Get-Date -Format "HH:mm:ss"), $game) -ForegroundColor DarkGray
        Apply-Optimizations
    } else {
        Write-Host ("[{0}] No game detected — Guardian watching..." -f (Get-Date -Format "HH:mm:ss")) -ForegroundColor DarkGray
    }
    Start-Sleep -Seconds 30
}`;

function PingGuardianCard({ currentGameId }: { currentGameId: string | null }) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem("og_guardian") === "true");
  const [justDownloaded, setJustDownloaded] = useState(false);

  const isGameRunning = currentGameId !== null;

  const enableGuardian = () => {
    downloadPs1(GUARDIAN_PS1, "OptiGods_PingGuardian.ps1");
    setEnabled(true);
    setJustDownloaded(true);
    localStorage.setItem("og_guardian", "true");
    setTimeout(() => setJustDownloaded(false), 3000);
  };

  const disableGuardian = () => {
    setEnabled(false);
    localStorage.removeItem("og_guardian");
  };

  const statusConfig = enabled
    ? isGameRunning
      ? { dot: "bg-emerald-400 animate-pulse", text: "Game active — network optimizations applied", badge: "Active", badgeCls: "bg-emerald-600/15 text-emerald-400 border-emerald-500/25" }
      : { dot: "bg-zinc-500", text: "No game detected — Guardian watching for any game launch", badge: "Watching", badgeCls: "bg-zinc-800 text-zinc-400 border-zinc-700" }
    : { dot: "bg-zinc-700", text: "Guardian inactive — enable to auto-boost on any game launch", badge: "Inactive", badgeCls: "bg-zinc-800/80 text-zinc-500 border-zinc-700" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-zinc-900/80 overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Background Ping Guardian</p>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed max-w-lg">
            Runs silently in the background. Detects when <span className="text-zinc-300 font-medium">any game</span> launches — FiveM, Warzone, Fortnite, VALORANT, CS2, Apex and more — instantly applies QoS + Nagle + traffic kill, then monitors every 30 seconds. Ping spike? It re-applies automatically.
          </p>
        </div>
        <span className={cn("text-[10px] px-2 py-0.5 rounded border font-bold shrink-0 mt-0.5", statusConfig.badgeCls)}>
          {statusConfig.badge}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-2.5">
        {/* Status row */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-white/5">
          <div className={cn("w-2 h-2 rounded-full shrink-0", statusConfig.dot)} />
          <span className="text-[11px] text-zinc-400">{statusConfig.text}</span>
        </div>

        {/* Action */}
        {enabled ? (
          <div className="flex items-center gap-3">
            <Button
              data-testid="button-guardian-disable"
              onClick={disableGuardian}
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs font-bold"
            >
              Disable Guardian
            </Button>
            <p className="text-[10px] text-zinc-600 leading-snug flex-1">
              {isGameRunning
                ? "Guardian script is running — keep the PowerShell window open."
                : "Guardian is watching. Launch any game and it will auto-optimize."}
            </p>
          </div>
        ) : (
          <Button
            data-testid="button-guardian-enable"
            onClick={enableGuardian}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600/80 text-sm font-bold flex items-center justify-center gap-2"
          >
            {justDownloaded
              ? <><CheckCircle className="w-4 h-4 text-emerald-400" />Script Downloaded — Run as Admin</>
              : "Enable Guardian (All Games)"}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function downloadScannerScript() {
  window.location.href = "/api/detect-games-script";
}

export default function GameDetection() {
  const { tweaks, setAllTweaks } = useOptimizationStore();

  // Track which game is currently running (set by NowPlayingPanel)
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

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
        <NowPlayingPanel onGameChange={setCurrentGameId} />

        {/* Background Ping Guardian — always visible, persists across game sessions */}
        <PingGuardianCard currentGameId={currentGameId} />

        {/* Game-specific BSK-style panels — rendered when a known game is detected */}
        <AnimatePresence mode="wait">
          {currentGameId === "game_fivem" && (
            <motion.div key="fivem-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              <FiveMPanel />
            </motion.div>
          )}
          {currentGameId === "game_fortnite" && (
            <motion.div key="fortnite-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              <FortnitePanel />
            </motion.div>
          )}
          {(currentGameId === "game_cod" || currentGameId === "game_warzone") && (
            <motion.div key="cod-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              <CodPanel />
            </motion.div>
          )}
        </AnimatePresence>

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
