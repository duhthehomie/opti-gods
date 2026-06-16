import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { Cpu, Pin, Download, ChevronDown, ChevronUp, CheckCircle2, Zap, AlertCircle, Shield, Gamepad2 } from "lucide-react";
import { GAME_WHITELIST, GAME_WHITELIST_COUNT } from "@/lib/game-whitelist";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Persist per-game whitelist toggles in localStorage so the user's choices
// survive page reloads + show up in the generated PS1.
const WHITELIST_STORAGE_KEY = "optiGods.gameWhitelistEnabled.v1";

function loadWhitelistState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(WHITELIST_STORAGE_KEY);
    if (!raw) return Object.fromEntries(GAME_WHITELIST.map(g => [g.exe, true]));
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    // Ensure every known game has an entry (default new ones to ON)
    for (const g of GAME_WHITELIST) if (!(g.exe in parsed)) parsed[g.exe] = true;
    return parsed;
  } catch {
    return Object.fromEntries(GAME_WHITELIST.map(g => [g.exe, true]));
  }
}

function GameWhitelistSection() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => loadWhitelistState());

  useEffect(() => {
    try { localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(enabled)); } catch {}
  }, [enabled]);

  const filtered = query
    ? GAME_WHITELIST.filter(g =>
        g.title.toLowerCase().includes(query.toLowerCase()) ||
        g.exe.toLowerCase().includes(query.toLowerCase()))
    : GAME_WHITELIST;
  const byGenre: Record<string, typeof GAME_WHITELIST> = {};
  for (const g of filtered) (byGenre[g.genre] ||= []).push(g);

  const enabledCount = useMemo(
    () => GAME_WHITELIST.reduce((n, g) => n + (enabled[g.exe] ? 1 : 0), 0),
    [enabled]
  );
  const allOn = enabledCount === GAME_WHITELIST.length;
  const allOff = enabledCount === 0;

  const setAll = (value: boolean) => {
    setEnabled(Object.fromEntries(GAME_WHITELIST.map(g => [g.exe, value])));
    toast({
      title: value ? "Whitelist: all games enabled" : "Whitelist: all games disabled",
      description: value
        ? `${GAME_WHITELIST_COUNT} game executables will be auto-pinned to High priority.`
        : "No games will be auto-pinned. Use this to start a custom whitelist.",
    });
  };

  const toggleOne = (exe: string) => {
    setEnabled(prev => ({ ...prev, [exe]: !prev[exe] }));
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 px-1">
        <Gamepad2 className="w-4 h-4 text-red-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">
          Auto-ProBalance Game Whitelist
        </h2>
        <span
          className="text-[10px] text-zinc-500 font-mono"
          data-testid="text-whitelist-count"
        >
          ({enabledCount}/{GAME_WHITELIST_COUNT} enabled)
        </span>
        <div className="flex-1 h-px bg-white/5 ml-2" />
        <button
          data-testid="button-toggle-game-whitelist"
          onClick={() => setOpen(v => !v)}
          className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all"
        >
          {open ? <ChevronUp className="w-3 h-3 inline mr-1" /> : <ChevronDown className="w-3 h-3 inline mr-1" />}
          {open ? "Hide" : "Show"}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3 px-1">
        These {GAME_WHITELIST_COUNT}+ game executables are auto-pinned to High CPU priority and exempted from ProBalance throttling whenever they run. Toggle individual games — or use the master switch — to control which ones get included in your generated PowerShell script.
      </p>

      {/* Master toggle — always visible */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl border border-red-500/25 bg-gradient-to-r from-red-500/10 to-black/40"
        data-testid="game-whitelist-master"
      >
        <Switch
          checked={allOn}
          onCheckedChange={(v) => setAll(!!v)}
          data-testid="switch-whitelist-master"
          aria-label="Toggle every game in whitelist"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white">
            Master toggle{" "}
            <span className="font-mono text-[10px] text-zinc-500">
              ({allOn ? "all on" : allOff ? "all off" : "mixed"})
            </span>
          </p>
          <p className="text-[10px] text-zinc-500">
            Flip every game in the whitelist on or off at once.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAll(false)}
          disabled={allOff}
          data-testid="button-whitelist-clear"
          className="h-7 text-[10px] border-white/10 text-zinc-300"
        >
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAll(true)}
          disabled={allOn}
          data-testid="button-whitelist-select-all"
          className="h-7 text-[10px] border-red-500/30 text-red-300 hover:bg-red-500/10"
        >
          Select all
        </Button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <input
              data-testid="input-search-game-whitelist"
              type="text"
              placeholder="Filter by game name or .exe..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40"
            />
            <div className="space-y-4">
              {Object.entries(byGenre).map(([genre, games]) => (
                <div key={genre}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{genre}</span>
                    <span className="text-[10px] text-zinc-700 font-mono">
                      ({games.filter(g => enabled[g.exe]).length}/{games.length})
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {games.map(g => {
                      const on = !!enabled[g.exe];
                      return (
                        <label
                          key={g.exe}
                          data-testid={`game-whitelist-${g.exe}`}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border bg-black/30 hover:bg-black/50 transition-colors cursor-pointer",
                            on ? "border-red-500/25" : "border-white/5 opacity-60"
                          )}
                        >
                          <Switch
                            checked={on}
                            onCheckedChange={() => toggleOne(g.exe)}
                            data-testid={`switch-whitelist-${g.exe}`}
                            aria-label={`Toggle ${g.title}`}
                            className="scale-75 shrink-0 origin-left"
                          />
                          {on
                            ? <CheckCircle2 className="w-3 h-3 text-emerald-500/70 shrink-0" />
                            : <CheckCircle2 className="w-3 h-3 text-zinc-700 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-200 truncate">{g.title}</p>
                            <p className="text-[10px] font-mono text-zinc-600 truncate">{g.exe}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-6">No games match "{query}".</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const FIVEM_PROCESSES = [
  { name: "FiveM_b3323_GTAProcess.exe", role: "GTA5 game process (FiveM)", priority: "High", io: "High", gpu: "High", pinned: true, critical: true },
  { name: "GTA5.exe",                   role: "Grand Theft Auto V",          priority: "High", io: "High", gpu: "High", pinned: true, critical: true },
  { name: "FiveM.exe",                  role: "FiveM launcher & host",       priority: "High", io: "High", gpu: "High", pinned: true, critical: true },
  { name: "FiveMApp.exe",               role: "FiveM UI app process",        priority: "High", io: "High", gpu: "Normal", pinned: true, critical: false },
  { name: "FXServer.exe",               role: "FiveM dedicated server",      priority: "High", io: "High", gpu: "Normal", pinned: false, critical: false },
  { name: "ROSLauncher.exe",            role: "Rockstar Games Launcher",     priority: "AboveNormal", io: "Normal", gpu: "Normal", pinned: false, critical: false },
  { name: "RockstarService.exe",        role: "Rockstar background service", priority: "Normal", io: "Normal", gpu: "Normal", pinned: false, critical: false },
];

const BACKGROUND_THROTTLE = [
  { name: "Discord.exe",         action: "Throttle to BelowNormal" },
  { name: "chrome.exe",          action: "Throttle to BelowNormal" },
  { name: "SearchIndexer.exe",   action: "Drop to Low" },
  { name: "SysMain.exe",         action: "Drop to Low" },
  { name: "WmiPrvSE.exe",        action: "Drop to Low" },
  { name: "OneDrive.exe",        action: "Drop to BelowNormal" },
  { name: "MsMpEng.exe",         action: "Throttle during game" },
];

function generateFiveMPriorityScript(): string {
  const ps1 = `# ============================================================
# Opti Gods — FiveM Priority Booster
# Run ONCE as Administrator — all changes write to registry
# and persist across every reboot. No re-run needed.
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — FiveM Priority Booster"

Write-Host ""
Write-Host " OPTI GODS - FiveM Priority Booster" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host " Run once — all changes persist in registry permanently." -ForegroundColor DarkCyan
Write-Host ""

# ─── [1/3] IFEO PerfOptions: FiveM/GTA always launch at High CPU + IO priority ───
Write-Host " [1/3] Writing permanent CPU + IO priority via IFEO..." -ForegroundColor Cyan
Write-Host "        FiveM auto-launches at High priority after this — no re-run needed." -ForegroundColor DarkGray
\$ifeoBase = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options"
\$targets = @("FiveM_b3323_GTAProcess","FiveM_GTAProcess","GTA5","FiveM","FiveMApp","FXServer","ROSLauncher")
foreach (\$exe in \$targets) {
    \$k = "\$ifeoBase\\\$exe.exe\\PerfOptions"
    try {
        New-Item -Path \$k -Force -EA Stop | Out-Null
        Set-ItemProperty -Path \$k -Name "CpuPriorityClass" -Value 3 -Type DWord -Force
        Set-ItemProperty -Path \$k -Name "IoPriority"       -Value 3 -Type DWord -Force
        Write-Host "   [OK] \$exe.exe -> High CPU + High IO (IFEO — persists across reboots)" -ForegroundColor Green
    } catch {
        Write-Host "   [SKIP] \$exe.exe could not be written (access denied?)" -ForegroundColor Yellow
    }
}

# ─── [2/3] MMCSS Games: GPU + CPU + Scheduling priority ───
Write-Host ""
Write-Host " [2/3] Setting GPU + Scheduling priority via MMCSS..." -ForegroundColor Cyan
\$gamesKey = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
if (-not (Test-Path \$gamesKey)) { New-Item -Path \$gamesKey -Force | Out-Null }
Set-ItemProperty -Path \$gamesKey -Name "GPU Priority"        -Value 8      -Type DWord  -Force
Set-ItemProperty -Path \$gamesKey -Name "Priority"            -Value 6      -Type DWord  -Force
Set-ItemProperty -Path \$gamesKey -Name "Scheduling Category" -Value "High" -Type String -Force
Set-ItemProperty -Path \$gamesKey -Name "SFIO Priority"       -Value "High" -Type String -Force
Write-Host "   [OK] MMCSS Games -> GPU=8, CPU=6, Scheduling=High (persistent)" -ForegroundColor Green

# ─── [3/3] Win32PrioritySeparation: Gaming-optimal CPU scheduler ───
Write-Host ""
Write-Host " [3/3] Applying gaming-optimal CPU scheduler settings..." -ForegroundColor Cyan
Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 26 -Type DWord -Force
Write-Host "   [OK] Win32PrioritySeparation = 26 (short quanta, max foreground boost, persistent)" -ForegroundColor Green

Write-Host ""
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host " Done! All tweaks saved to registry." -ForegroundColor Green
Write-Host " FiveM will automatically launch at maximum priority." -ForegroundColor Green
Write-Host " You do NOT need to run this again." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
`;

  const bat = `@echo off
title Opti Gods — FiveM Priority Booster
echo.
echo  Setting up FiveM Priority Booster...
echo.

:: Write embedded PowerShell script to temp
set "PS_TEMP=%TEMP%\\optigods_fivem_priority.ps1"
powershell -Command "Set-Content -Path '%PS_TEMP%' -Value (Get-Content -Raw -Encoding UTF8 '%~f0' | Select-String -Pattern '(?s)#PSSTART(.*)#PSEND' | ForEach-Object { \$_.Matches[0].Groups[1].Value })" 2>nul

:: Fallback: write directly via echo (more reliable)
(
${ps1.split('\n').map(l => `echo ${l.replace(/[&<>|^]/g, '^$&')}`).join('\n')}
) > "%PS_TEMP%"

:: Elevate and run
powershell -ExecutionPolicy Bypass -NoProfile -File "%PS_TEMP%"
del "%PS_TEMP%" 2>nul
exit /b 0
`;
  return bat;
}

function downloadScript(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ProcessLasso() {
  const { tweaks, setTweak } = useOptimizationStore();
  const { toast } = useToast();
  const hw = useHardwareInfo();
  const [pinned, setPinned] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FIVEM_PROCESSES.map(p => [p.name, p.pinned]))
  );
  const [showBg, setShowBg] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handlePin = (name: string) => {
    setPinned(prev => ({ ...prev, [name]: !prev[name] }));
    toast({ title: `Priority ${pinned[name] ? "unpinned" : "pinned"}`, description: `${name} will ${pinned[name] ? "no longer be forced to" : "always run at"} High priority.` });
  };

  const handleDownloadScript = async () => {
    setDownloading(true);
    try {
      const ps1Content = `# Opti Gods — FiveM Priority Booster
# Run ONCE as Administrator — all changes write to registry
# and persist across every reboot. No re-run needed.

$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods - FiveM Priority Booster"

Write-Host ""
Write-Host " OPTI GODS - FiveM Priority Booster" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host " Run once — all changes persist in registry permanently." -ForegroundColor DarkCyan
Write-Host ""

# [1/3] IFEO PerfOptions — FiveM/GTA always launch at High CPU + IO priority
Write-Host " [1/3] Writing permanent CPU + IO priority via IFEO..." -ForegroundColor Cyan
Write-Host "        FiveM auto-launches at High priority — no re-run needed." -ForegroundColor DarkGray
$ifeoBase = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options"
$targets = @("FiveM_b3323_GTAProcess","FiveM_GTAProcess","GTA5","FiveM","FiveMApp","FXServer","ROSLauncher")
foreach ($exe in $targets) {
    $k = "$ifeoBase\\$exe.exe\\PerfOptions"
    try {
        New-Item -Path $k -Force -EA Stop | Out-Null
        Set-ItemProperty -Path $k -Name "CpuPriorityClass" -Value 3 -Type DWord -Force
        Set-ItemProperty -Path $k -Name "IoPriority"       -Value 3 -Type DWord -Force
        Write-Host "   [OK] $exe.exe -> High CPU + High IO (IFEO — persists across reboots)" -ForegroundColor Green
    } catch {
        Write-Host "   [SKIP] $exe.exe - could not write IFEO (access denied?)" -ForegroundColor Yellow
    }
}

# [2/3] MMCSS Games — GPU + Scheduling priority
Write-Host ""
Write-Host " [2/3] Setting GPU + Scheduling priority via MMCSS..." -ForegroundColor Cyan
$gamesKey = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
if (-not (Test-Path $gamesKey)) { New-Item -Path $gamesKey -Force | Out-Null }
Set-ItemProperty -Path $gamesKey -Name "GPU Priority"        -Value 8      -Type DWord  -Force
Set-ItemProperty -Path $gamesKey -Name "Priority"            -Value 6      -Type DWord  -Force
Set-ItemProperty -Path $gamesKey -Name "Scheduling Category" -Value "High" -Type String -Force
Set-ItemProperty -Path $gamesKey -Name "SFIO Priority"       -Value "High" -Type String -Force
Write-Host "   [OK] MMCSS Games -> GPU=8, CPU=6, Scheduling=High (persistent)" -ForegroundColor Green

# [3/3] Win32PrioritySeparation — Gaming-optimal CPU scheduler
Write-Host ""
Write-Host " [3/3] Applying gaming-optimal CPU scheduler settings..." -ForegroundColor Cyan
Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 26 -Type DWord -Force
Write-Host "   [OK] Win32PrioritySeparation = 26 (short quanta, max foreground boost, persistent)" -ForegroundColor Green

Write-Host ""
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host " Done! All tweaks saved to registry." -ForegroundColor Green
Write-Host " FiveM will automatically launch at maximum priority." -ForegroundColor Green
Write-Host " You do NOT need to run this again." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"`;

      const bat = `@echo off
title Opti Gods - FiveM Priority Booster

:: ── Self-elevate to Administrator if not already ──────────────────
net session >nul 2>&1
if %errorLevel% == 0 goto :ISADMIN
echo  Requesting Administrator privileges...
powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b 0

:ISADMIN
cd /d "%~dp0"
set "TMPPS=%TEMP%\\optigods_fivem_%RANDOM%.ps1"

:: Extract embedded PS1 block and run it
powershell -Command "$c=[System.IO.File]::ReadAllText('%~f0'); $s=$c.IndexOf('#PS1START')+9; $e=$c.IndexOf('#PS1END'); [System.IO.File]::WriteAllText('%TMPPS%', $c.Substring($s,$e-$s).Trim())" 2>nul
if exist "%TMPPS%" (
  powershell -ExecutionPolicy Bypass -NoProfile -File "%TMPPS%"
  del "%TMPPS%" 2>nul
  exit /b 0
)

:: Fallback: inline execution if extraction failed
powershell -ExecutionPolicy Bypass -NoProfile -Command "& {
$ErrorActionPreference = 'SilentlyContinue'
$targets = @('FiveM_b3323_GTAProcess','FiveM_GTAProcess','GTA5','FiveM','FiveMApp','FXServer')
foreach($p in $targets){$x=Get-Process $p -EA SilentlyContinue;if($x){try{$x.PriorityClass='High'}catch{}}}
$k='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
if(!(Test-Path $k)){New-Item $k -Force|Out-Null}
Set-ItemProperty $k 'GPU Priority' 8 -Type DWord -Force
Set-ItemProperty $k 'Priority' 6 -Type DWord -Force
Set-ItemProperty $k 'Scheduling Category' 'High' -Type String -Force
Set-ItemProperty $k 'SFIO Priority' 'High' -Type String -Force
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' Win32PrioritySeparation 26 -Type DWord -Force
Write-Host '' ; Write-Host ' Done! FiveM priority set to maximum.' -ForegroundColor Red ; Write-Host ''
Read-Host 'Press Enter to exit'
}"
exit /b 0

REM #PS1START
${ps1Content}
REM #PS1END`;

      downloadScript(bat, "OptiGods_FiveM_Priority_Booster.bat");
      toast({ title: "Script downloaded!", description: "Run OptiGods_FiveM_Priority_Booster.bat as Administrator once — all tweaks write to registry and persist automatically." });
    } finally {
      setDownloading(false);
    }
  };

  const probalanceTweaks = [
    { id: "ProcessLassoProBalance",        title: "Enable ProBalance (CPU Throttling)",               desc: "Automatically lowers the priority of processes that hog CPU while the foreground app is running.", impact: "HIGH" as const, recommended: true },
    { id: "ProcessLassoSmartTrim",         title: "Enable SmartTrim (RAM)",                           desc: "Trims working set of background processes to free physical memory for your game.", impact: "HIGH" as const, recommended: true },
    { id: "ProcessLassoRestrain",          title: "Restrain Background Apps After 5s Idle",           desc: "Drops background process CPU priority 5 seconds after they stop receiving input.", impact: "MED" as const, recommended: true },
    { id: "ProcessLassoAffinityGaming",    title: "Auto-Affinity: Gaming Mode",                       desc: "Moves background tasks to a subset of cores so your game gets dedicated CPU access.", impact: "HIGH" as const, recommended: true },
    { id: "ProcessLassoInstanceBalancer",  title: "CPU Scheduler: Short Quantum + Max Foreground Boost (Win32PrioritySeparation=26)", desc: "Sets Win32PrioritySeparation=26 — short time quanta, variable mode, maximum foreground boost. Gaming-optimal Windows scheduler mode.", impact: "MED" as const },
  ];

  const memTweaks = [
    { id: "ProcessTrimWorkingSet",             title: "Trim Working Set on Minimize",      desc: "Reduces a process's RAM footprint when it is minimized — frees memory for active apps.", impact: "MED" as const, recommended: true },
    { id: "ProcessDisableWindowsErrorReporting", title: "Disable Windows Error Reporting", desc: "Stops WER from freezing a crashed process for minutes while collecting a dump.", impact: "LOW" as const },
    { id: "ProcessAutoKillHung",               title: "Auto-Kill Hung Processes (15s)",    desc: "Automatically terminates unresponsive processes after 15 seconds instead of waiting.", impact: "MED" as const, recommended: true },
  ];

  const probalanceRecIds = probalanceTweaks.filter(t => t.recommended).map(t => t.id);
  const memRecIds = memTweaks.filter(t => t.recommended).map(t => t.id);
  const probalanceAllOn = probalanceRecIds.every(id => tweaks[id]);
  const memAllOn = memRecIds.every(id => tweaks[id]);

  return (
    <AppLayout>
      <div className="space-y-6 w-full pb-10">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Cpu className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Process Lasso Config</h1>
            <p className="text-zinc-500 text-sm">CPU affinity, priority pinning, and process management</p>
          </div>
        </motion.div>

        {/* ─── FiveM Priority Script Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/5 to-black/40 p-5 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shrink-0 mt-0.5">
              <Zap className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">FiveM Priority Booster Script</h2>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 uppercase tracking-widest">RECOMMENDED</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Writes <span className="text-red-400 font-semibold">IFEO PerfOptions</span> registry keys so FiveM & GTA processes <span className="text-red-400 font-semibold">always launch at High CPU + IO priority</span> automatically. Also sets <span className="text-red-400 font-semibold">GPU Priority 8</span> via MMCSS. Run once as Administrator — no re-run needed.
              </p>
            </div>
          </div>

          {/* Process grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FIVEM_PROCESSES.map((proc) => (
              <div key={proc.name} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border",
                proc.critical
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-white/2 border-white/5"
              )}>
                <button
                  data-testid={`button-pin-${proc.name}`}
                  onClick={() => handlePin(proc.name)}
                  className={cn(
                    "p-1 rounded-lg transition-all shrink-0",
                    pinned[proc.name]
                      ? "text-red-500 bg-red-500/10"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                  title={pinned[proc.name] ? "Unpin" : "Pin to High priority"}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-zinc-200 truncate">{proc.name}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{proc.role}</p>
                </div>
                <div className="shrink-0 space-y-0.5 text-right">
                  <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", proc.priority === "High" ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-500")}>
                    CPU {proc.priority}
                  </div>
                  <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", proc.gpu === "High" ? "bg-orange-500/10 text-orange-400" : "bg-zinc-800 text-zinc-500")}>
                    GPU {proc.gpu}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/15">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <p className="text-[10px] text-green-300">All tweaks write to the registry permanently. FiveM will auto-launch at High priority on every boot — <strong>no need to re-run</strong>.</p>
          </div>

          <div className="flex gap-3">
            <Button
              data-testid="button-download-fivem-priority"
              onClick={handleDownloadScript}
              disabled={downloading}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold border border-red-500/30 gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Generating..." : "Download FiveM Priority Script (.bat)"}
            </Button>
          </div>
        </motion.div>

        {/* ─── Background Throttle Info ─── */}
        <div>
          <button
            data-testid="button-show-bg-throttle"
            onClick={() => setShowBg(v => !v)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
          >
            {showBg ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showBg ? "Hide" : "Show"} background processes that get throttled ({BACKGROUND_THROTTLE.length})
          </button>
          <AnimatePresence>
            {showBg && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {BACKGROUND_THROTTLE.map((proc) => (
                    <div key={proc.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 bg-black/30">
                      <Shield className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-zinc-400 truncate">{proc.name}</p>
                        <p className="text-[10px] text-zinc-600">{proc.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Auto-ProBalance Game Whitelist (V2) ─── */}
        <GameWhitelistSection />

        {/* ─── ProBalance Rules ─── */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">ProBalance Rules</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            <Button
              variant="ghost" size="sm"
              onClick={() => probalanceRecIds.forEach(id => setTweak(id, true))}
              disabled={probalanceAllOn}
              data-testid="button-enable-recommended-probalance"
              className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {probalanceAllOn ? "Recommended ON" : "Enable Recommended"}
            </Button>
          </div>
          <div className="space-y-4">
            {probalanceTweaks.map((item, i) => (
              <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                impact={item.impact} badge={item.recommended ? "RECOMMENDED" : undefined}
                checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
            ))}
          </div>
        </section>

        {/* ─── Memory Optimization ─── */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">Memory Optimization</h2>
            <div className="flex-1 h-px bg-white/5 ml-2" />
            <Button
              variant="ghost" size="sm"
              onClick={() => memRecIds.forEach(id => setTweak(id, true))}
              disabled={memAllOn}
              data-testid="button-enable-recommended-mem-opt"
              className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {memAllOn ? "Recommended ON" : "Enable Recommended"}
            </Button>
          </div>
          <div className="space-y-4">
            {memTweaks.map((item, i) => (
              <TweakRow key={item.id} id={item.id} title={item.title} description={item.desc}
                impact={item.impact} badge={item.recommended ? "RECOMMENDED" : undefined}
                checked={tweaks[item.id] || false} onCheckedChange={(v) => setTweak(item.id, v)} delay={i + 1} />
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
