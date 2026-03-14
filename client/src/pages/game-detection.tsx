import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Shield, Terminal, CheckCircle, XCircle, Info, Gamepad } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GameEntry {
  id: string;
  name: string;
  publisher: string;
  accentBorder: string;
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
    detectPaths: ["%LocalAppData%\\VALORANT", "C:\\Riot Games\\VALORANT"],
    processName: "VALORANT-Win64-Shipping.exe",
    tweaks: ["Above Normal CPU priority (IFEO persistent)", "High I/O priority for asset streaming", "Disable Riot Vanguard telemetry service"],
  },
  {
    id: "game_cs2",
    name: "Counter-Strike 2",
    publisher: "Valve",
    accentBorder: "border-l-orange-600",
    detectPaths: ["Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe"],
    processName: "cs2.exe",
    tweaks: ["Above Normal CPU priority (IFEO persistent)", "Disable TCP timestamps for lower RTT", "Set socket send/receive buffers to 256KB"],
  },
  {
    id: "game_apex",
    name: "Apex Legends",
    publisher: "Respawn / EA",
    accentBorder: "border-l-red-700",
    detectPaths: ["C:\\Program Files\\EA Games\\Apex Legends\\r5apex.exe", "C:\\Program Files\\Origin Games\\Apex Legends\\r5apex.exe"],
    processName: "r5apex.exe",
    tweaks: ["Above Normal CPU priority", "Disable EA/Origin in-game overlay service", "Set process I/O to High priority"],
  },
  {
    id: "game_warzone",
    name: "Call of Duty: Warzone",
    publisher: "Activision",
    accentBorder: "border-l-zinc-400",
    detectPaths: ["C:\\Program Files (x86)\\Call of Duty", "C:\\Program Files\\Battle.net Apps\\Call of Duty"],
    processName: "cod.exe",
    tweaks: ["Above Normal CPU priority", "Disable Battle.net overlay agent", "Increase network socket buffer for BR servers"],
  },
  {
    id: "game_lol",
    name: "League of Legends",
    publisher: "Riot Games",
    accentBorder: "border-l-amber-600",
    detectPaths: ["C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe"],
    processName: "League of Legends.exe",
    tweaks: ["Above Normal CPU priority", "High I/O for champion asset loading", "Disable Riot background update agent at launch"],
  },
  {
    id: "game_overwatch",
    name: "Overwatch 2",
    publisher: "Blizzard",
    accentBorder: "border-l-orange-500",
    detectPaths: ["C:\\Program Files (x86)\\Overwatch\\_retail_\\Overwatch.exe", "C:\\Program Files\\Overwatch\\_retail_\\Overwatch.exe"],
    processName: "Overwatch.exe",
    tweaks: ["Above Normal CPU priority", "Disable Blizzard agent background service", "Network buffer tuning for 64-tick servers"],
  },
  {
    id: "game_siege",
    name: "Rainbow Six Siege",
    publisher: "Ubisoft",
    accentBorder: "border-l-zinc-500",
    detectPaths: ["C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games\\Tom Clancy's Rainbow Six Siege"],
    processName: "RainbowSix.exe",
    tweaks: ["Above Normal CPU priority + all physical cores", "Disable Ubisoft Connect telemetry", "High I/O priority for map streaming"],
  },
  {
    id: "game_rust",
    name: "Rust",
    publisher: "Facepunch Studios",
    accentBorder: "border-l-red-800",
    detectPaths: ["Steam\\steamapps\\common\\Rust\\RustClient.exe"],
    processName: "RustClient.exe",
    tweaks: ["Above Normal CPU priority", "Expand streaming pool size in registry", "Disable background application throttling"],
  },
  {
    id: "game_minecraft",
    name: "Minecraft (Java)",
    publisher: "Mojang / Microsoft",
    accentBorder: "border-l-zinc-600",
    detectPaths: ["%AppData%\\.minecraft\\launcher_profiles.json"],
    processName: "javaw.exe",
    tweaks: ["Add .minecraft to Defender exclusions (scan skip)", "Set javaw.exe to Above Normal priority", "Disable Windows Update delivery optimization bandwidth cap"],
  },
  {
    id: "game_roblox",
    name: "Roblox",
    publisher: "Roblox Corporation",
    accentBorder: "border-l-red-400",
    detectPaths: ["%LocalAppData%\\Roblox\\Versions"],
    processName: "RobloxPlayerBeta.exe",
    tweaks: ["Above Normal CPU priority for Roblox player", "Disable Roblox background crash reporter", "Set I/O priority to High"],
  },
  {
    id: "game_tarkov",
    name: "Escape from Tarkov",
    publisher: "Battlestate Games",
    accentBorder: "border-l-stone-500",
    detectPaths: ["C:\\Battlestate Games\\EFT\\EscapeFromTarkov.exe", "C:\\Games\\EFT\\EscapeFromTarkov.exe"],
    processName: "EscapeFromTarkov.exe",
    tweaks: ["High CPU priority (EFT is extremely CPU-heavy)", "Disable Windows Game DVR for EFT", "Expand socket buffer for server desync reduction"],
  },
  {
    id: "game_pubg",
    name: "PUBG: Battlegrounds",
    publisher: "Krafton",
    accentBorder: "border-l-amber-700",
    detectPaths: ["Steam\\steamapps\\common\\PUBG\\TslGame\\Binaries\\Win64\\TslGame.exe"],
    processName: "TslGame.exe",
    tweaks: ["Above Normal CPU priority", "Unreal Engine streaming pool expansion", "Disable PUBG telemetry background tasks"],
  },
  {
    id: "game_dbd",
    name: "Dead by Daylight",
    publisher: "Behaviour Interactive",
    accentBorder: "border-l-red-900",
    detectPaths: ["Steam\\steamapps\\common\\Dead by Daylight\\DeadByDaylight\\Binaries\\Win64\\DeadByDaylight-Win64-Shipping.exe"],
    processName: "DeadByDaylight-Win64-Shipping.exe",
    tweaks: ["Above Normal CPU priority", "Disable background shader compilation worker throttling", "I/O priority boost for asset loading"],
  },
  {
    id: "game_dota2",
    name: "Dota 2",
    publisher: "Valve",
    accentBorder: "border-l-zinc-400",
    detectPaths: ["Steam\\steamapps\\common\\dota 2 beta\\game\\bin\\win64\\dota2.exe"],
    processName: "dota2.exe",
    tweaks: ["Above Normal CPU priority", "Disable Steam friend presence during gaming (CPU)", "Optimize network tick for South Asian servers"],
  },
];

function GameCard({ game }: { game: GameEntry }) {
  const { tweaks, setTweak } = useOptimizationStore();
  const enabled = tweaks[game.id] || false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-l-4 p-5 transition-all duration-200",
        game.accentBorder,
        enabled
          ? "bg-red-500/5 border-red-500/20 border-l-4 shadow-[inset_0_0_20px_-10px_rgba(239,68,68,0.12)]"
          : "bg-black/40 border-white/5 hover:border-white/10 hover:bg-black/60"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={cn("font-bold text-sm", enabled ? "text-white" : "text-zinc-200")}>{game.name}</h3>
            {enabled && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                INCLUDED
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500">{game.publisher}</p>
        </div>
        <button
          data-testid={`toggle-game-${game.id}`}
          onClick={() => setTweak(game.id, !enabled)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none",
            enabled ? "bg-red-600" : "bg-zinc-700"
          )}
        >
          <span className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )} />
        </button>
      </div>

      {/* Detection paths */}
      <div className="mb-3 space-y-1">
        {game.detectPaths.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Terminal className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
            <span className="text-[10px] font-mono text-zinc-600 truncate">{p}</span>
          </div>
        ))}
      </div>

      {/* Tweaks list */}
      <div className="space-y-1.5">
        {game.tweaks.map((tweak, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle className={cn("w-3 h-3 shrink-0 mt-0.5", enabled ? "text-red-500" : "text-zinc-600")} />
            <span className="text-[11px] text-zinc-500 leading-snug">{tweak}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function GameDetection() {
  const { tweaks, setAllTweaks } = useOptimizationStore();

  const enabledGames = GAMES.filter(g => tweaks[g.id]);
  const disabledGames = GAMES.filter(g => !tweaks[g.id]);

  const handleEnableAll = () => {
    const next = { ...useOptimizationStore.getState().tweaks };
    GAMES.forEach(g => { next[g.id] = true; });
    setAllTweaks(next);
  };

  const handleDisableAll = () => {
    const next = { ...useOptimizationStore.getState().tweaks };
    GAMES.forEach(g => { next[g.id] = false; });
    setAllTweaks(next);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Gamepad className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Game Detection & Auto-Optimize</h1>
            <p className="text-zinc-500 text-sm">Enable packs for any game — the script detects what's installed on your PC and applies only relevant tweaks</p>
          </div>
        </motion.div>

        {/* How detection works */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-white font-bold text-sm">How Game Detection Works</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Browsers cannot read your file system — and they shouldn't.
                Instead, when you click <span className="text-white font-medium">APPLY</span> and run the downloaded PowerShell script
                as Administrator, it checks your actual drive for each game's installation path. If it finds the game, it applies the
                optimization pack. If it doesn't find it, it prints <span className="font-mono text-zinc-300">[SKIP]</span> and moves on.
                This means the same script works correctly on <span className="text-white font-medium">everyone's PC</span> regardless
                of where they installed their games.
              </p>
              <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Detects install paths</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Steam library aware</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Anti-cheat safe (no injection)</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-red-400" /> Skips missing games</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-zinc-500" />
            <p className="text-sm text-zinc-300">
              <span className="text-white font-bold">{enabledGames.length}</span> game{enabledGames.length !== 1 ? "s" : ""} selected
              — <span className="text-zinc-500">{disabledGames.length} not included</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-disable-all-games" onClick={handleDisableAll} variant="outline" size="sm"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5 text-xs">
              Deselect All
            </Button>
            <Button data-testid="button-enable-all-games" onClick={handleEnableAll} size="sm"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30">
              Enable All Games
            </Button>
          </div>
        </motion.div>

        {/* Games — included */}
        {enabledGames.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">
              Included in Script ({enabledGames.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enabledGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        {/* Games — all / not included */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">
            {enabledGames.length > 0 ? `Not Included (${disabledGames.length})` : `All Games (${GAMES.length})`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(enabledGames.length > 0 ? disabledGames : GAMES).map((game, i) => (
              <motion.div key={game.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <GameCard game={game} />
              </motion.div>
            ))}
          </div>
        </section>

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
