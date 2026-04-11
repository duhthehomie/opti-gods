import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { Cpu, Pin, Download, ChevronDown, ChevronUp, CheckCircle2, Zap, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
# Opti Gods — FiveM Process Priority Booster
# Sets CPU + GPU + IO priority for all FiveM/GTA processes
# Run as Administrator each time before launching FiveM
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — FiveM Priority Booster"

Write-Host ""
Write-Host " OPTI GODS - FiveM Priority Booster" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""

# ─── CPU Priority: Set High for all FiveM/GTA processes ───
$targets = @(
    "FiveM_b3323_GTAProcess",
    "FiveM_GTAProcess",
    "GTA5",
    "FiveM",
    "FiveMApp",
    "FXServer",
    "ROSLauncher"
)

Write-Host " [1/3] Setting CPU Priority to HIGH..." -ForegroundColor Cyan
foreach (\$proc in \$targets) {
    \$ps = Get-Process -Name \$proc -ErrorAction SilentlyContinue
    if (\$ps) {
        try {
            \$ps.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High
            Write-Host "   [OK] \$proc -> HIGH CPU priority" -ForegroundColor Green
        } catch {
            Write-Host "   [SKIP] \$proc not running or access denied" -ForegroundColor Yellow
        }
    }
}

# ─── GPU + Scheduling Priority via MMCSS Games Registry ───
Write-Host ""
Write-Host " [2/3] Boosting GPU + Scheduling Priority..." -ForegroundColor Cyan

\$gamesKey = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
if (Test-Path \$gamesKey) {
    Set-ItemProperty -Path \$gamesKey -Name "GPU Priority"         -Value 8      -Type DWord  -Force
    Set-ItemProperty -Path \$gamesKey -Name "Priority"             -Value 6      -Type DWord  -Force
    Set-ItemProperty -Path \$gamesKey -Name "Scheduling Category"  -Value "High" -Type String -Force
    Set-ItemProperty -Path \$gamesKey -Name "SFIO Priority"        -Value "High" -Type String -Force
    Write-Host "   [OK] MMCSS Games -> GPU Priority 8, CPU Priority 6, IO High" -ForegroundColor Green
} else {
    Write-Host "   [WARN] MMCSS Games key not found — creating it..." -ForegroundColor Yellow
    New-Item -Path \$gamesKey -Force | Out-Null
    Set-ItemProperty -Path \$gamesKey -Name "GPU Priority"         -Value 8      -Type DWord  -Force
    Set-ItemProperty -Path \$gamesKey -Name "Priority"             -Value 6      -Type DWord  -Force
    Set-ItemProperty -Path \$gamesKey -Name "Scheduling Category"  -Value "High" -Type String -Force
    Set-ItemProperty -Path \$gamesKey -Name "SFIO Priority"        -Value "High" -Type String -Force
    Write-Host "   [OK] MMCSS Games key created and configured" -ForegroundColor Green
}

# ─── IO Priority: Drop background processes ───
Write-Host ""
Write-Host " [3/3] Throttling background processes..." -ForegroundColor Cyan
\$bgTargets = @("Discord","chrome","SearchIndexer","SysMain","OneDrive","WmiPrvSE","MsMpEng")
foreach (\$proc in \$bgTargets) {
    \$ps = Get-Process -Name \$proc -ErrorAction SilentlyContinue
    if (\$ps) {
        try {
            \$ps.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
            Write-Host "   [OK] \$proc -> BelowNormal (frees CPU for GTA)" -ForegroundColor DarkGreen
        } catch {}
    }
}

# ─── Win32PrioritySeparation: Gaming Optimal ───
Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 26 -Type DWord -Force
Write-Host ""
Write-Host "   [OK] Win32PrioritySeparation = 26 (short quanta, max foreground boost)" -ForegroundColor Green

Write-Host ""
Write-Host " Done! All FiveM processes are now running at maximum priority." -ForegroundColor Red
Write-Host " Tip: Re-run this script if you restart FiveM." -ForegroundColor DarkCyan
Write-Host ""
Pause
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
      const ps1Content = `# Opti Gods — FiveM Process Priority Booster
# Sets CPU High, GPU Priority 8, IO High for all FiveM/GTA processes
# Run as Administrator before launching FiveM

$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods — FiveM Priority Booster"

Write-Host "OPTI GODS - FiveM Priority Booster" -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor DarkRed
Write-Host ""

$targets = @("FiveM_b3323_GTAProcess","FiveM_GTAProcess","GTA5","FiveM","FiveMApp","FXServer","ROSLauncher")

Write-Host "[1/3] Setting CPU Priority to HIGH..." -ForegroundColor Cyan
foreach ($proc in $targets) {
    $ps = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($ps) {
        try {
            $ps.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High
            Write-Host "   [OK] $proc -> HIGH CPU priority" -ForegroundColor Green
        } catch {
            Write-Host "   [SKIP] $proc - access denied or not running" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "[2/3] Setting GPU Priority to 8 (max)..." -ForegroundColor Cyan
$gamesKey = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"
if (-not (Test-Path $gamesKey)) { New-Item -Path $gamesKey -Force | Out-Null }
Set-ItemProperty -Path $gamesKey -Name "GPU Priority"        -Value 8      -Type DWord  -Force
Set-ItemProperty -Path $gamesKey -Name "Priority"            -Value 6      -Type DWord  -Force
Set-ItemProperty -Path $gamesKey -Name "Scheduling Category" -Value "High" -Type String -Force
Set-ItemProperty -Path $gamesKey -Name "SFIO Priority"       -Value "High" -Type String -Force
Write-Host "   [OK] MMCSS Games -> GPU=8, CPU=6, IO=High, Scheduling=High" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Throttling background processes..." -ForegroundColor Cyan
$bg = @("Discord","chrome","SearchIndexer","SysMain","OneDrive","WmiPrvSE","MsMpEng")
foreach ($proc in $bg) {
    $ps = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($ps) {
        try { $ps.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal; Write-Host "   [OK] $proc -> BelowNormal" -ForegroundColor DarkGreen } catch {}
    }
}

Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 26 -Type DWord -Force
Write-Host "   [OK] Win32PrioritySeparation = 26 (gaming optimal)" -ForegroundColor Green

Write-Host ""
Write-Host "Done! Re-run this script each time you launch FiveM." -ForegroundColor Red
Pause`;

      const bat = `@echo off
title Opti Gods - FiveM Priority Booster
cd /d "%~dp0"
set "TMPPS=%TEMP%\\optigods_fivem_%RANDOM%.ps1"
powershell -Command "$c=[System.IO.File]::ReadAllText('%~f0'); $s=$c.IndexOf('#PS1START')+9; $e=$c.IndexOf('#PS1END'); [System.IO.File]::WriteAllText('%TMPPS%', $c.Substring($s,$e-$s))" 2>nul || goto :FALLBACK
powershell -ExecutionPolicy Bypass -NoProfile -NonInteractive -WindowStyle Normal -File "%TMPPS%"
del "%TMPPS%" 2>nul
exit /b 0

:FALLBACK
powershell -ExecutionPolicy Bypass -NoProfile -Command "& {
$targets = @('FiveM_b3323_GTAProcess','FiveM_GTAProcess','GTA5','FiveM','FiveMApp','FXServer')
foreach($p in $targets){$x=Get-Process $p -EA SilentlyContinue;if($x){try{$x.PriorityClass='High'}catch{}}}
$k='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
if(!(Test-Path $k)){New-Item $k -Force|Out-Null}
Set-ItemProperty $k 'GPU Priority' 8 -Type DWord -Force
Set-ItemProperty $k 'Priority' 6 -Type DWord -Force
Set-ItemProperty $k 'Scheduling Category' 'High' -Type String -Force
Set-ItemProperty $k 'SFIO Priority' 'High' -Type String -Force
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' Win32PrioritySeparation 26 -Type DWord -Force
Write-Host 'Done! FiveM priority set to maximum.' -ForegroundColor Red
Pause
}"
exit /b 0

REM #PS1START
${ps1Content}
REM #PS1END`;

      downloadScript(bat, "OptiGods_FiveM_Priority_Booster.bat");
      toast({ title: "Script downloaded!", description: "Run OptiGods_FiveM_Priority_Booster.bat as Administrator before launching FiveM." });
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
      <div className="space-y-6 max-w-4xl pb-10">
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
                Sets <span className="text-red-400 font-semibold">High CPU priority</span>, <span className="text-red-400 font-semibold">GPU Priority 8</span> (max), and <span className="text-red-400 font-semibold">High IO priority</span> for all FiveM & GTA processes. Run as Administrator before launching FiveM for maximum frames.
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

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-[10px] text-amber-300">This script only sets priorities for <strong>currently running</strong> processes. Re-run it each time you launch FiveM for consistent results.</p>
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
          <div className="space-y-3">
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
          <div className="space-y-3">
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
