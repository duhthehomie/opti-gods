import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import {
  Zap, Trash2, Wifi, MemoryStick, Gamepad2, MessageSquare,
  Globe, HardDrive, Shield, RefreshCw, ChevronRight, Clock,
  Terminal, X, TrendingUp, CheckCircle2, AlertCircle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const LAST_RUN_KEY = "optigods-boost-last-run";

interface BoostAction {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  ps1: string;
  recommendedIfDays?: number;
}

const BOOST_ACTIONS: BoostAction[] = [
  {
    id: "clear-temp",
    title: "Clear Temp Files",
    desc: "Deletes %TEMP% and C:\\Windows\\Temp folders. Frees disk space and removes junk that slows down reads. Safe to run anytime — Windows recreates these on demand.",
    icon: Trash2,
    category: "System",
    ps1: `Remove-Item "$env:TEMP\\*" -Recurse -Force -EA SilentlyContinue; Remove-Item "C:\\Windows\\Temp\\*" -Recurse -Force -EA SilentlyContinue; Write-Host "[OK] Temp files cleared" -ForegroundColor Green`,
    recommendedIfDays: 7,
  },
  {
    id: "flush-dns",
    title: "Flush DNS Cache",
    desc: "Clears Windows DNS resolver cache. Fixes 'server not found' errors, reduces ping to game servers after IP changes, and removes stale routing entries.",
    icon: Wifi,
    category: "Network",
    ps1: `ipconfig /flushdns; Write-Host "[OK] DNS cache flushed — stale routing entries cleared" -ForegroundColor Green`,
    recommendedIfDays: 3,
  },
  {
    id: "ram-trim",
    title: "Trim RAM (Empty Standby List)",
    desc: "Forces Windows to release cached/standby RAM pages back to available pool. Useful right before launching GTA V or FiveM — gives the game the maximum available memory.",
    icon: MemoryStick,
    category: "Memory",
    ps1: `$bytes = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(4); if ($bytes) { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($bytes) }; Start-Process Rundll32.exe -ArgumentList "advapi32.dll,ProcessIdleTasks" -Wait -EA SilentlyContinue; Write-Host "[OK] RAM standby list trimmed — released cached pages back to available pool" -ForegroundColor Green`,
    recommendedIfDays: 1,
  },
  {
    id: "fivem-cache",
    title: "Clear FiveM Cache",
    desc: "Removes cached server assets from FiveM.app\\cache. Fixes texture loss, crash-on-join, and 'Failed to load streaming file' errors. You'll re-download server assets on first join.",
    icon: Gamepad2,
    category: "Gaming",
    ps1: `Remove-Item -Path "$env:LocalAppData\\FiveM\\FiveM.app\\cache\\*" -Recurse -Force -EA SilentlyContinue; Write-Host "[OK] FiveM cache cleared — server assets will re-download on next join (expected behavior)" -ForegroundColor Green`,
    recommendedIfDays: 14,
  },
  {
    id: "discord-cache",
    title: "Clear Discord Cache",
    desc: "Deletes Discord's AppData cache folders. Fixes Discord lag, blurry images, and high memory usage. Discord rebuilds its cache automatically after restart.",
    icon: MessageSquare,
    category: "Apps",
    ps1: `$paths = @("$env:APPDATA\\discord\\Cache","$env:APPDATA\\discord\\Code Cache","$env:APPDATA\\discord\\GPUCache","$env:LOCALAPPDATA\\Discord\\Cache"); $paths | ForEach-Object { Remove-Item "$_\\*" -Recurse -Force -EA SilentlyContinue; Write-Host "[OK] Cleared $_" -ForegroundColor Green }; Write-Host "[Discord] Cache cleared — restart Discord after running this" -ForegroundColor Cyan`,
    recommendedIfDays: 14,
  },
  {
    id: "browser-cache",
    title: "Clear Browser Cache",
    desc: "Clears Chrome and Edge cache folders. Speeds up browsing by forcing fresh asset downloads. Fixes broken pages and high disk usage from browser caching.",
    icon: Globe,
    category: "Apps",
    ps1: `$chrome = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache"; $edge = "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"; $firefox = "$env:APPDATA\\Mozilla\\Firefox\\Profiles"; if (Test-Path $chrome) { Remove-Item "$chrome\\*" -Recurse -Force -EA SilentlyContinue; Write-Host "[OK] Chrome cache cleared" -ForegroundColor Green }; if (Test-Path $edge) { Remove-Item "$edge\\*" -Recurse -Force -EA SilentlyContinue; Write-Host "[OK] Edge cache cleared" -ForegroundColor Green }; if (Test-Path $firefox) { Get-ChildItem $firefox -Filter "cache2" -Recurse -EA SilentlyContinue | Remove-Item -Recurse -Force -EA SilentlyContinue; Write-Host "[OK] Firefox cache cleared" -ForegroundColor Green }`,
    recommendedIfDays: 21,
  },
  {
    id: "prefetch",
    title: "Clear Prefetch Files",
    desc: "Removes Windows prefetch cache. Useful after major changes or uninstalls — stale prefetch entries cause 100-200ms delays on first launch of recently-removed apps.",
    icon: HardDrive,
    category: "System",
    ps1: `Remove-Item "C:\\Windows\\Prefetch\\*" -Force -EA SilentlyContinue; Write-Host "[OK] Prefetch cleared — Windows will rebuild entries on next launch cycle" -ForegroundColor Green`,
    recommendedIfDays: 30,
  },
  {
    id: "event-logs",
    title: "Clear Event Logs",
    desc: "Clears Windows Event Log files. Large event logs cause background I/O and slow the Event Log service. On heavily-used systems this frees 200MB+ and reduces background disk reads.",
    icon: Shield,
    category: "System",
    ps1: `Get-EventLog -List -EA SilentlyContinue | ForEach-Object { try { Clear-EventLog $_.Log -EA SilentlyContinue; Write-Host "[OK] Cleared log: $($_.Log)" -ForegroundColor Green } catch {} }`,
    recommendedIfDays: 30,
  },
  {
    id: "nvme-trim",
    title: "Optimize / TRIM NVMe SSD",
    desc: "Sends TRIM command to your SSD. Keeps NVMe write speeds consistent over time. Windows does this automatically weekly — run manually if you notice slower write speeds.",
    icon: HardDrive,
    category: "Storage",
    ps1: `Optimize-Volume -DriveLetter C -ReTrim -Verbose -EA SilentlyContinue; Write-Host "[OK] TRIM sent to C: drive — SSD block mapping refreshed" -ForegroundColor Green`,
    recommendedIfDays: 30,
  },
  {
    id: "winsock-reset",
    title: "Reset Winsock / TCP Stack",
    desc: "Resets the Windows networking stack. Fixes persistent high ping, TCP errors, and 'unable to connect' issues that survive normal fixes. Requires reboot to take effect.",
    icon: Wifi,
    category: "Network",
    ps1: `netsh winsock reset; netsh int ip reset; Write-Host "[OK] Winsock + TCP/IP stack reset — REBOOT required for changes to take effect" -ForegroundColor Yellow`,
    recommendedIfDays: 60,
  },
  {
    id: "disable-telemetry-services",
    title: "Disable Telemetry Services",
    desc: "Disables DiagTrack (Connected User Experience and Telemetry), dmwappushservice, and other telemetry services. Frees RAM and reduces background network activity. This is what ReviOS disables by default.",
    icon: Shield,
    category: "System",
    ps1: `$services = @("DiagTrack","dmwappushservice","WerSvc","waaSMedicSvc"); foreach ($svc in $services) { try { Stop-Service -Name $svc -Force -EA SilentlyContinue; Set-Service -Name $svc -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Disabled: $svc" -ForegroundColor Green } catch {} }`,
    recommendedIfDays: 90,
  },
  {
    id: "disable-windows-update-service",
    title: "Disable Windows Update Service",
    desc: "Stops the Windows Update service. Prevents unwanted auto-restarts during gaming. You can re-enable anytime. ReviOS + WinTitus both disable this by default.",
    icon: RefreshCw,
    category: "System",
    ps1: `Stop-Service -Name wuauserv -Force -EA SilentlyContinue; Set-Service -Name wuauserv -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Windows Update service disabled — you can manually check for updates when ready" -ForegroundColor Green`,
    recommendedIfDays: 90,
  },
  {
    id: "disable-indexing-service",
    title: "Disable Windows Search Indexing",
    desc: "Stops the Windows Search indexing service (WSearch). Reduces CPU usage, disk I/O, and RAM consumption. File search will be slower but standard Explorer search still works.",
    icon: HardDrive,
    category: "System",
    ps1: `Stop-Service -Name WSearch -Force -EA SilentlyContinue; Set-Service -Name WSearch -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Windows Search indexing disabled — search will be slower but you'll save ~500MB RAM and reduce background I/O" -ForegroundColor Green`,
    recommendedIfDays: 90,
  },
  {
    id: "disable-superfetch",
    title: "Disable Superfetch (Sysmain)",
    desc: "Stops the Superfetch service. Reduces disk I/O and cache memory usage. Modern SSDs make prefetch obsolete — Windows already loads apps fast enough.",
    icon: TrendingUp,
    category: "System",
    ps1: `Stop-Service -Name SysMain -Force -EA SilentlyContinue; Set-Service -Name SysMain -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Superfetch disabled — RAM and SSD I/O freed up" -ForegroundColor Green`,
    recommendedIfDays: 90,
  },
  {
    id: "disable-xbox-services",
    title: "Disable Xbox Live Services",
    desc: "Disables XblAuthManager, XblGameSave, XboxGipSvc, XboxNetApiSvc and Game DVR. These run in the background constantly for Xbox features nobody uses on a gaming PC. Also disables the Windows Game Bar overlay that causes FPS drops.",
    icon: Gamepad2,
    category: "System",
    ps1: `$xboxSvcs = @("XblAuthManager","XblGameSave","XboxGipSvc","XboxNetApiSvc","BcastDVRUserService","GameDVR"); foreach ($svc in $xboxSvcs) { Stop-Service -Name $svc -Force -EA SilentlyContinue; Set-Service -Name $svc -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Disabled: $svc" -ForegroundColor Green }; Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\PolicyManager\\default\\ApplicationManagement\\AllowGameDVR' -Name 'value' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Xbox Game DVR + Game Bar disabled" -ForegroundColor Green`,
    recommendedIfDays: 90,
  },
  {
    id: "disable-bits-diagnostics",
    title: "Disable BITS + Diagnostic Services",
    desc: "Stops Background Intelligent Transfer Service (BITS) which Windows Update uses for background downloads, plus Diagnostic Policy Service (DPS) and Program Compatibility Assistant. ReviOS disables these — saves ~50MB RAM and eliminates background CPU spikes.",
    icon: Shield,
    category: "System",
    ps1: `$svcs = @("BITS","DPS","PcaSvc","WMPNetworkSvc","Fax","TrkWks","wisvc","lltdsvc","MapsBroker"); foreach ($svc in $svcs) { Stop-Service -Name $svc -Force -EA SilentlyContinue; Set-Service -Name $svc -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Disabled: $svc" -ForegroundColor Green }; Write-Host "[OK] Background download and diagnostic services disabled" -ForegroundColor Cyan`,
    recommendedIfDays: 90,
  },
  {
    id: "disable-remote-registry-print",
    title: "Disable Remote Registry + Print Spooler",
    desc: "Disables Remote Registry (security risk + background overhead) and Print Spooler (safe if you have no printer). Also disables Windows Error Reporting service if it's still running. These are standard on hardened ReviOS/WinTitus installs.",
    icon: Terminal,
    category: "System",
    ps1: `$svcs = @("RemoteRegistry","Spooler","WerSvc","stisvc","WbioSrvc","lfsvc"); foreach ($svc in $svcs) { Stop-Service -Name $svc -Force -EA SilentlyContinue; Set-Service -Name $svc -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Disabled: $svc" -ForegroundColor Green }; Write-Host "[OK] Remote Registry, Print Spooler, Error Reporting + misc disabled" -ForegroundColor Cyan`,
    recommendedIfDays: 90,
  },
];

type Status = "optimized" | "degrading" | "needs-attention" | "never";

function getStatus(lastRun: number | null, days: number): Status {
  if (!lastRun) return "never";
  const age = (Date.now() - lastRun) / (1000 * 60 * 60 * 24);
  if (age < days * 0.5) return "optimized";
  if (age < days) return "degrading";
  return "needs-attention";
}

function daysAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const STATUS_CONFIG = {
  optimized: { dot: "bg-emerald-500", label: "Optimized", text: "text-emerald-400" },
  degrading: { dot: "bg-amber-500 animate-pulse", label: "Degrading", text: "text-amber-400" },
  "needs-attention": { dot: "bg-red-500 animate-pulse", label: "Needs Attention", text: "text-red-400" },
  never: { dot: "bg-zinc-600", label: "Never Run", text: "text-zinc-500" },
};

function getPS1(actions: BoostAction[]): string {
  return [
    `# Opti Gods Quick Boost`,
    "Set-ExecutionPolicy Bypass -Scope Process -Force",
    "",
    ...actions.map(a => `# ${a.title}\n${a.ps1}\n`),
    'Write-Host "" -ForegroundColor White',
    'Write-Host "=== Quick Boost complete! ===" -ForegroundColor Cyan',
  ].join("\n");
}

export default function BoostPage() {
  const hw = useHardwareInfo();

  const [lastRun, setLastRun] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(BOOST_ACTIONS[0].id);
  const [downloaded, setDownloaded] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_RUN_KEY);
      if (raw) setLastRun(JSON.parse(raw));
    } catch {}
  }, []);

  function markRun(id: string) {
    const next = { ...lastRun, [id]: Date.now() };
    setLastRun(next);
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify(next));
  }

  function downloadSingle(action: BoostAction) {
    const ps1 = [
      `# Opti Gods Quick Boost — ${action.title}`,
      "Set-ExecutionPolicy Bypass -Scope Process -Force",
      "",
      action.ps1,
      "",
      'Write-Host "Done! Press any key to exit." -ForegroundColor Cyan',
      "pause",
    ].join("\n");
    const blob = new Blob([ps1], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `optigods-boost-${action.id}.ps1`;
    a.click();
    URL.revokeObjectURL(url);
    markRun(action.id);
    setDownloaded(prev => [...prev, action.id]);
    setTimeout(() => setDownloaded(prev => prev.filter(x => x !== action.id)), 3000);
  }

  function downloadAll() {
    const needsAttn = BOOST_ACTIONS.filter(a => {
      const s = getStatus(lastRun[a.id] ?? null, a.recommendedIfDays ?? 14);
      return s === "never" || s === "needs-attention" || s === "degrading";
    });
    const actions = needsAttn.length > 0 ? needsAttn : BOOST_ACTIONS;
    const blob = new Blob([getPS1(actions)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optigods-quick-boost.ps1";
    a.click();
    URL.revokeObjectURL(url);
    actions.forEach(a => markRun(a.id));
  }

  const recommended = BOOST_ACTIONS.filter(a => {
    const s = getStatus(lastRun[a.id] ?? null, a.recommendedIfDays ?? 14);
    return s === "never" || s === "needs-attention";
  }).slice(0, 2);

  const selectedAction = BOOST_ACTIONS.find(a => a.id === selected);

  const needsCount = BOOST_ACTIONS.filter(a => {
    const s = getStatus(lastRun[a.id] ?? null, a.recommendedIfDays ?? 14);
    return s === "never" || s === "needs-attention" || s === "degrading";
  }).length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl pb-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
              <Zap className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Quick Boost</h1>
              <p className="text-zinc-500 text-sm">Routine maintenance — one click, instant PS1 command</p>
            </div>
          </div>
          <Button
            onClick={downloadAll}
            data-testid="button-boost-all"
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider shrink-0"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {needsCount > 0 ? `Boost ${needsCount} Items` : "Run All Boosts"}
          </Button>
        </motion.div>

        {/* Hardware-optimized settings */}
        {!hw.loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 flex items-start gap-3"
          >
            <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed space-y-1">
              <p className="text-red-400 font-semibold">Hardware-Optimized Boost Settings</p>
              <p className="text-zinc-300">
                {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
              </p>
            </div>
          </motion.div>
        )}

        {/* Recommended cards */}
        {recommended.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Recommended For You</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommended.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => setSelected(action.id)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                      selected === action.id
                        ? "bg-red-500/10 border-red-500/40"
                        : "bg-zinc-900/60 border-white/5 hover:border-red-500/25 hover:bg-zinc-900"
                    )}
                  >
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0">
                      <Icon className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Recommended</p>
                      <p className="text-sm font-bold text-white truncate">{action.title}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Main layout: list + detail */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Action list */}
          <div className="lg:col-span-2 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Boost Your System</p>
            {BOOST_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              const ts = lastRun[action.id] ?? null;
              const status = getStatus(ts, action.recommendedIfDays ?? 14);
              const cfg = STATUS_CONFIG[status];
              const isSelected = selected === action.id;
              const isDone = downloaded.includes(action.id);

              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.03 }}
                  onClick={() => setSelected(action.id)}
                  data-testid={`button-boost-${action.id}`}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all group",
                    isSelected
                      ? "bg-red-500/8 border-red-500/30"
                      : "bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/70"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg border shrink-0 transition-colors",
                    isSelected ? "bg-red-500/15 border-red-500/25" : "bg-zinc-800/60 border-white/5"
                  )}>
                    <Icon className={cn("w-4 h-4 transition-colors", isSelected ? "text-red-400" : "text-zinc-400")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ts && <span className="text-[9px] text-zinc-600">Last ran: {daysAgo(ts)}</span>}
                      {!ts && <span className="text-[9px] text-zinc-600">Never run</span>}
                    </div>
                    <p className={cn("text-sm font-semibold truncate transition-colors", isSelected ? "text-white" : "text-zinc-300")}>
                      {action.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isDone ? (
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Downloaded</span>
                    ) : (
                      <span className={cn("text-[9px] font-bold uppercase tracking-wide", cfg.text)}>{cfg.label}</span>
                    )}
                    <div className={cn("w-2 h-2 rounded-full shrink-0", isDone ? "bg-emerald-500" : cfg.dot)} />
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            {selectedAction && (
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="sticky top-4 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Action Detail</p>
                  <div className="rounded-xl border border-white/8 bg-zinc-900/60 overflow-hidden">
                    {/* Detail header */}
                    <div className="px-4 py-3.5 border-b border-white/5">
                      <div className="flex items-center gap-2.5 mb-2">
                        <selectedAction.icon className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{selectedAction.category}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug">{selectedAction.title}</h3>
                    </div>

                    {/* Description */}
                    <div className="px-4 py-3.5 border-b border-white/5">
                      <p className="text-xs text-zinc-400 leading-relaxed">{selectedAction.desc}</p>
                    </div>

                    {/* Last run */}
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      <span className="text-[11px] text-zinc-500">
                        {lastRun[selectedAction.id]
                          ? `Last run: ${daysAgo(lastRun[selectedAction.id])}`
                          : "Never run on this browser"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="px-4 py-3 border-b border-white/5">
                      {(() => {
                        const s = getStatus(lastRun[selectedAction.id] ?? null, selectedAction.recommendedIfDays ?? 14);
                        const cfg = STATUS_CONFIG[s];
                        return (
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                            <span className={cn("text-[11px] font-bold uppercase tracking-wider", cfg.text)}>{cfg.label}</span>
                            {selectedAction.recommendedIfDays && (
                              <span className="text-[10px] text-zinc-600 ml-auto">Recommended every {selectedAction.recommendedIfDays}d</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Recommendation info */}
                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="flex items-start gap-2">
                        <Info className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-zinc-600 leading-relaxed">
                          Downloads a PS1 file — right-click and run with PowerShell, it requests admin automatically.
                        </p>
                      </div>
                    </div>

                    {/* Run button */}
                    <div className="px-4 py-3.5">
                      <Button
                        onClick={() => downloadSingle(selectedAction)}
                        data-testid={`button-run-${selectedAction.id}`}
                        className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider"
                      >
                        {downloaded.includes(selectedAction.id) ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                            Downloaded!
                          </>
                        ) : (
                          <>
                            <Terminal className="w-3.5 h-3.5 mr-1.5" />
                            Download Script
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Hardware context */}
                  {hw.scanned && (
                    <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Your System</p>
                      <div className="space-y-1">
                        {hw.gpuName !== "Unknown GPU" && (
                          <p className="text-[11px] text-zinc-400 truncate">
                            <span className="text-zinc-600">GPU:</span> {hw.gpuName}
                          </p>
                        )}
                        {hw.cpuLabel && (
                          <p className="text-[11px] text-zinc-400 truncate">
                            <span className="text-zinc-600">CPU:</span> {hw.cpuLabel.split("(")[0].trim()}
                          </p>
                        )}
                        {hw.ramGB > 0 && (
                          <p className="text-[11px] text-zinc-400">
                            <span className="text-zinc-600">RAM:</span> {hw.ramLabel}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Summary strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { icon: CheckCircle2, label: "Optimized", count: BOOST_ACTIONS.filter(a => getStatus(lastRun[a.id] ?? null, a.recommendedIfDays ?? 14) === "optimized").length, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/15" },
            { icon: TrendingUp, label: "Degrading", count: BOOST_ACTIONS.filter(a => getStatus(lastRun[a.id] ?? null, a.recommendedIfDays ?? 14) === "degrading").length, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/15" },
            { icon: AlertCircle, label: "Needs Attention", count: BOOST_ACTIONS.filter(a => ["never","needs-attention"].includes(getStatus(lastRun[a.id] ?? null, a.recommendedIfDays ?? 14))).length, color: "text-red-400", bg: "bg-red-500/5 border-red-500/15" },
          ].map(({ icon: Icon, label, count, color, bg }) => (
            <div key={label} className={cn("rounded-xl border p-4 flex items-center gap-3", bg)}>
              <Icon className={cn("w-4 h-4 shrink-0", color)} />
              <div>
                <p className={cn("text-lg font-black leading-none", color)}>{count}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wide">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </AppLayout>
  );
}
