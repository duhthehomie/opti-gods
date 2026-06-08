import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isNative,
  scanTaskManager,
  killApp,
  disableStartupApp,
} from "@/lib/tauri-bridge";
import {
  Monitor, Loader2, Download, X, CheckCircle2,
  Globe, Gamepad2, MessageCircle, Cloud, Cpu, Music2,
  AlertTriangle, Zap, WifiOff, RotateCcw,
} from "lucide-react";

interface AppEntry {
  id: string;
  name: string;
  processName: string;
  startupKey?: string;
  description: string;
  impact: "HIGH" | "MED" | "LOW";
  recommended?: boolean;
  warning?: string;
}

interface AppCategory {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  apps: AppEntry[];
}

type ActionStatus = "idle" | "pending" | "done" | "error";

interface AppState {
  killStatus: ActionStatus;
  startupStatus: ActionStatus;
  killMsg?: string;
  startupMsg?: string;
}

const CATEGORIES: AppCategory[] = [
  {
    label: "Browsers",
    icon: Globe,
    color: "text-blue-400",
    apps: [
      { id: "tm_chrome", name: "Google Chrome", processName: "chrome.exe", startupKey: "Google Chrome", description: "Runs background render processes and GPU compositor even when minimised — 150-400MB RAM constantly consumed.", impact: "HIGH", recommended: true },
      { id: "tm_edge", name: "Microsoft Edge", processName: "msedge.exe", startupKey: "MicrosoftEdge", description: "Edge Startup Boost keeps processes running 24/7 even when the browser is closed. Heavy GPU + RAM user.", impact: "HIGH", recommended: true },
      { id: "tm_firefox", name: "Firefox", processName: "firefox.exe", description: "Multiple content processes per tab. Safe to kill before gaming.", impact: "MED" },
      { id: "tm_brave", name: "Brave Browser", processName: "brave.exe", startupKey: "Brave", description: "Brave background service and updater stay active. Safe to kill.", impact: "MED" },
    ],
  },
  {
    label: "Game Launchers",
    icon: Gamepad2,
    color: "text-orange-400",
    apps: [
      { id: "tm_steam", name: "Steam", processName: "steam.exe", startupKey: "Steam", description: "Steam client, web helper, and crash handler use 200-350MB RAM idle. Kill before gaming on another launcher.", impact: "MED" },
      { id: "tm_epic", name: "Epic Games Launcher", processName: "EpicGamesLauncher.exe", startupKey: "EpicGamesLauncher", description: "Epic launcher + EOS overlay helper run in background even when idle. Safe to kill if launching from shortcut.", impact: "MED", recommended: true },
      { id: "tm_battlenet", name: "Battle.net", processName: "Battle.net.exe", startupKey: "Battle.net", description: "Battle.net Agent and background services use CPU even when not updating. Kill before COD / OW sessions.", impact: "HIGH", recommended: true },
      { id: "tm_ea", name: "EA App / Origin", processName: "EADesktop.exe", startupKey: "EADesktop", description: "EA App background helper and telemetry service run constantly. Kill before Apex / BF sessions.", impact: "MED", recommended: true },
      { id: "tm_ubisoft", name: "Ubisoft Connect", processName: "upc.exe", startupKey: "Ubisoft Connect", description: "Ubisoft Connect game service and updater stay active when closed. Kill before other games.", impact: "LOW" },
      { id: "tm_rockstar", name: "Rockstar Launcher", processName: "PlayGTAV.exe", startupKey: "Rockstar Games Launcher", description: "Rockstar Services + Web Helper. Only needed when playing GTA V / RDR2 actively.", impact: "LOW" },
    ],
  },
  {
    label: "Communication",
    icon: MessageCircle,
    color: "text-indigo-400",
    apps: [
      { id: "tm_discord", name: "Discord", processName: "Discord.exe", startupKey: "Discord", description: "Overlay, video codec pre-loader, and crash handler run 3+ processes. Kill if not in voice during gaming.", impact: "MED", warning: "Keep open if you use Discord voice during gaming." },
      { id: "tm_teams", name: "Microsoft Teams", processName: "Teams.exe", startupKey: "Teams", description: "Teams is infamous for running 4-8 processes at idle, using 300-500MB RAM. Kill before any gaming session.", impact: "HIGH", recommended: true },
      { id: "tm_slack", name: "Slack", processName: "slack.exe", startupKey: "com.squirrel.slack.slack", description: "Electron-based app with GPU compositor and renderer processes. 200-400MB RAM at idle.", impact: "MED", recommended: true },
      { id: "tm_zoom", name: "Zoom", processName: "Zoom.exe", startupKey: "Zoom", description: "Zoom background helper and crash monitor run even when not in a call.", impact: "LOW", recommended: true },
      { id: "tm_teamviewer", name: "TeamViewer", processName: "TeamViewer.exe", startupKey: "TeamViewer", description: "TeamViewer runs a background service that maintains a remote access connection. Not needed during gaming.", impact: "LOW", recommended: true },
    ],
  },
  {
    label: "Cloud & Sync",
    icon: Cloud,
    color: "text-cyan-400",
    apps: [
      { id: "tm_onedrive", name: "OneDrive", processName: "OneDrive.exe", startupKey: "OneDrive", description: "File sync generates constant disk I/O that competes with game asset streaming. Kill before gaming.", impact: "HIGH", recommended: true },
      { id: "tm_dropbox", name: "Dropbox", processName: "Dropbox.exe", startupKey: "Dropbox", description: "Dropbox background sync causes disk I/O spikes. Kill before long gaming sessions.", impact: "MED", recommended: true },
      { id: "tm_gdrive", name: "Google Drive", processName: "googledrivefs.exe", startupKey: "GoogleDriveFS", description: "Google Drive File Stream does continuous cloud sync in background.", impact: "MED", recommended: true },
      { id: "tm_icloud", name: "iCloud", processName: "iCloudDrive.exe", startupKey: "iCloud", description: "iCloud Drive sync and Photo Library indexing in background. Useless during gaming.", impact: "LOW", recommended: true },
    ],
  },
  {
    label: "GPU Tools",
    icon: Cpu,
    color: "text-green-400",
    apps: [
      { id: "tm_gfe", name: "GeForce Experience", processName: "NVIDIA Share.exe", startupKey: "NvBackend", description: "ShadowPlay + NVIDIA Share overlay. Kills ShadowPlay encoder that uses 50-150MB VRAM. NV driver itself stays running.", impact: "MED", recommended: true },
      { id: "tm_radeon", name: "Radeon Software (Adrenalin)", processName: "RadeonSoftware.exe", startupKey: "AMD Radeon Software", description: "Radeon Overlay + ReLive recorder background processes. Safe to kill — driver stays active.", impact: "MED" },
      { id: "tm_msiab", name: "MSI Afterburner", processName: "MSIAfterburner.exe", startupKey: "MSI Afterburner", description: "OC + fan profiles still apply after kill. Kill if not monitoring temps during gameplay.", impact: "LOW", warning: "If using custom fan curve or OC, keep running." },
      { id: "tm_rivatuner", name: "RivaTuner / RTSS", processName: "RTSS.exe", startupKey: "RTSS", description: "Frame limiter overlay. FPS cap is still applied via driver after process kill.", impact: "LOW", warning: "Kill only if not using the FPS overlay." },
    ],
  },
  {
    label: "Background Bloat",
    icon: Music2,
    color: "text-red-400",
    apps: [
      { id: "tm_spotify", name: "Spotify", processName: "Spotify.exe", startupKey: "Spotify", description: "Spotify runs 4-6 Chromium-based helper processes at all times. 200-450MB RAM. Kill before competitive sessions.", impact: "HIGH", recommended: true },
      { id: "tm_itunes", name: "iTunes / Apple Music", processName: "iTunes.exe", startupKey: "iTunes", description: "iTunes Helper + AppleMobileDeviceService run even when iTunes is closed.", impact: "LOW", recommended: true },
      { id: "tm_adobecc", name: "Adobe Creative Cloud", processName: "Creative Cloud.exe", startupKey: "AdobeGCInvoker-1.0", description: "CC Desktop + Genuine Checker service + updater worker = 3 processes, 150MB RAM minimum.", impact: "MED", recommended: true },
      { id: "tm_malwarebytes", name: "Malwarebytes", processName: "MBAMService.exe", description: "Real-time scanning causes I/O overhead during game loads. Pause protection before playing.", impact: "MED", warning: "Do not disable permanently — real-time protection matters." },
    ],
  },
];

const ALL_APPS = CATEGORIES.flatMap(c => c.apps);

export default function TaskManagerPage() {
  const { toast } = useToast();
  const native = isNative();

  // ── Web-only state (script download flow) ──────────────────────────────
  const [killSet, setKillSet] = useState<Set<string>>(new Set());
  const [startupSet, setStartupSet] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // ── Native state ───────────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [inStartupIds, setInStartupIds] = useState<Set<string>>(new Set());
  const [appStates, setAppStates] = useState<Record<string, AppState>>({});

  const setAppState = (id: string, patch: Partial<AppState>) => {
    setAppStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } as AppState }));
  };

  // ── Auto-scan on mount (native only) ──────────────────────────────────
  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const processMap: Record<string, string> = {};
      const startupMap: Record<string, string> = {};
      for (const app of ALL_APPS) {
        processMap[app.id] = app.processName;
        if (app.startupKey) startupMap[app.id] = app.startupKey;
      }
      const result = await scanTaskManager(processMap, startupMap);
      setRunningIds(new Set(result.running));
      setInStartupIds(new Set(result.in_startup));
      setScanned(true);
    } catch (err) {
      console.error("[task-manager] scan failed", err);
      toast({ title: "Scan failed", description: "Could not read running processes.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }, [toast]);

  useEffect(() => {
    if (native) runScan();
  }, [native, runScan]);

  // ── Native kill handler ────────────────────────────────────────────────
  const handleKill = async (app: AppEntry) => {
    setAppState(app.id, { killStatus: "pending", killMsg: undefined });
    try {
      const res = await killApp(app.processName);
      if (res.ok) {
        setAppState(app.id, { killStatus: "done", killMsg: res.message });
        setRunningIds(prev => { const n = new Set(prev); n.delete(app.id); return n; });
      } else {
        setAppState(app.id, { killStatus: "error", killMsg: res.message });
      }
    } catch (err) {
      setAppState(app.id, { killStatus: "error", killMsg: String(err) });
    }
  };

  // ── Native startup-disable handler ────────────────────────────────────
  const handleStartupOff = async (app: AppEntry) => {
    if (!app.startupKey) return;
    setAppState(app.id, { startupStatus: "pending", startupMsg: undefined });
    try {
      const res = await disableStartupApp(app.startupKey);
      if (res.ok) {
        setAppState(app.id, { startupStatus: "done", startupMsg: res.message });
        setInStartupIds(prev => { const n = new Set(prev); n.delete(app.id); return n; });
      } else {
        setAppState(app.id, { startupStatus: "error", startupMsg: res.message });
      }
    } catch (err) {
      setAppState(app.id, { startupStatus: "error", startupMsg: String(err) });
    }
  };

  // ── Web: toggle handlers ───────────────────────────────────────────────
  const toggleKill = (id: string) => setKillSet(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleStartup = (id: string) => setStartupSet(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSelectRecommended = () => {
    const recKill = new Set(ALL_APPS.filter(a => a.recommended).map(a => a.id));
    const recStartup = new Set(ALL_APPS.filter(a => a.recommended && a.startupKey).map(a => a.id));
    setKillSet(recKill);
    setStartupSet(recStartup);
    toast({ title: "Recommended selected", description: `${recKill.size} apps to kill, ${recStartup.size} startup entries to disable` });
  };

  const handleClearAll = () => { setKillSet(new Set()); setStartupSet(new Set()); };

  const handleDownload = async () => {
    if (killSet.size === 0 && startupSet.size === 0) {
      toast({ title: "Nothing selected", description: "Select at least one app to kill or remove from startup.", variant: "destructive" });
      return;
    }
    setDownloading(true);
    try {
      const kill = Array.from(killSet).map(id => ALL_APPS.find(a => a.id === id)?.processName).filter(Boolean) as string[];
      const startup = Array.from(startupSet).map(id => ALL_APPS.find(a => a.id === id)?.startupKey).filter(Boolean) as string[];
      const res = await fetch(apiUrl("/api/task-manager/kill-script"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ kill, startup }),
      });
      if (!res.ok) throw new Error("server error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "OptiGods_TaskManager.bat"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Script downloaded", description: `Double-click the .bat to kill ${kill.length} app(s) and disable ${startup.length} startup entr${startup.length === 1 ? "y" : "ies"}.` });
    } catch {
      toast({ title: "Error", description: "Failed to generate script.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // ── Stats for native mode ──────────────────────────────────────────────
  const killedCount = Object.values(appStates).filter(s => s?.killStatus === "done").length;
  const startupRemovedCount = Object.values(appStates).filter(s => s?.startupStatus === "done").length;

  // ── Stats for web mode ─────────────────────────────────────────────────
  const killCount = killSet.size;
  const startupCount = startupSet.size;

  return (
    <AppLayout>
      <div className="space-y-6 pb-10 text-white">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Monitor className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Background App Manager</h1>
            <p className="text-zinc-500 text-sm">
              {native
                ? "Live view of running processes and startup apps on your PC — kill or disable with one click"
                : "Select apps to kill before gaming and remove from startup — frees RAM and CPU"}
            </p>
          </div>
        </motion.div>

        {/* ── NATIVE: live scan banner ─────────────────────────────────── */}
        {native && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
            className="rounded-xl border border-red-500/20 bg-zinc-900/60 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-display font-black text-red-400">
                    {scanning ? <Loader2 className="w-5 h-5 animate-spin text-red-400" /> : runningIds.size}
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">running now</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-amber-400">
                    {scanning ? "…" : inStartupIds.size}
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">in startup</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-emerald-400">{killedCount + startupRemovedCount}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">actions done</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={runScan}
                disabled={scanning}
                data-testid="button-task-manager-rescan"
                className="border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs gap-1.5"
              >
                {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                {scanning ? "Scanning…" : "Re-scan"}
              </Button>
            </div>
            {scanned && runningIds.size === 0 && (
              <div className="border-t border-white/5 px-5 py-2.5">
                <p className="text-[11px] text-emerald-400">✓ None of the tracked apps are currently running — your PC is already clean for gaming.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── WEB: control bar ─────────────────────────────────────────── */}
        {!native && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl border border-red-500/20 bg-zinc-900/60 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-display font-black text-red-400">{killCount}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">to kill</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-amber-400">{startupCount}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">startup off</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(killCount > 0 || startupCount > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearAll} data-testid="button-task-manager-clear"
                    className="text-zinc-500 hover:text-zinc-300 hover:bg-white/5 text-xs gap-1.5">
                    <X className="w-3 h-3" /> Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleSelectRecommended} data-testid="button-task-manager-recommended"
                  className="border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Select Recommended
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={downloading || (killCount === 0 && startupCount === 0)}
                  data-testid="button-task-manager-download"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5 disabled:opacity-40">
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {downloading ? "Generating…" : "Download Kill Script"}
                </Button>
              </div>
            </div>
            <div className="border-t border-white/5 px-5 py-3">
              <p className="text-[11px] text-amber-300/80 leading-relaxed flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                This is a checklist — tick the apps you actually have installed. The script skips anything that isn&apos;t running.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── App categories ───────────────────────────────────────────── */}
        {CATEGORIES.map((cat, catIdx) => {
          const CatIcon = cat.icon;
          const visibleApps = native
            ? cat.apps
            : cat.apps;

          return (
            <motion.section
              key={cat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + catIdx * 0.04 }}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <CatIcon className={cn("w-4 h-4", cat.color)} />
                <h2 className={cn("text-sm font-bold uppercase tracking-wider", cat.color)}>{cat.label}</h2>
                {native && (
                  <span className="text-[10px] text-zinc-600">
                    {cat.apps.filter(a => runningIds.has(a.id)).length > 0
                      ? `${cat.apps.filter(a => runningIds.has(a.id)).length} running`
                      : ""}
                  </span>
                )}
                {!native && (killSet.size > 0 || startupSet.size > 0) && (
                  (() => {
                    const kc = cat.apps.filter(a => killSet.has(a.id)).length;
                    const sc = cat.apps.filter(a => startupSet.has(a.id)).length;
                    return (kc > 0 || sc > 0) ? (
                      <span className="text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded">
                        {kc > 0 && `${kc} kill`}{kc > 0 && sc > 0 && " · "}{sc > 0 && `${sc} startup`}
                      </span>
                    ) : null;
                  })()
                )}
              </div>

              <div className="space-y-2.5">
                {visibleApps.map((app) => {
                  const aState = appStates[app.id];
                  const isRunning = runningIds.has(app.id);
                  const isInStartup = inStartupIds.has(app.id);
                  const killPending = aState?.killStatus === "pending";
                  const killDone = aState?.killStatus === "done";
                  const killErr = aState?.killStatus === "error";
                  const startupPending = aState?.startupStatus === "pending";
                  const startupDone = aState?.startupStatus === "done";
                  const impactColor = app.impact === "HIGH"
                    ? "text-red-400 border-red-500/30 bg-red-500/10"
                    : app.impact === "MED"
                    ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                    : "text-zinc-400 border-zinc-700 bg-zinc-800/50";

                  return (
                    <div
                      key={app.id}
                      data-testid={`card-task-manager-${app.id}`}
                      className={cn(
                        "rounded-xl border bg-zinc-900/60 overflow-hidden transition-all",
                        native && isRunning ? "border-red-500/30" : "border-white/5",
                        native && killDone ? "border-emerald-500/20" : "",
                        !native && (killSet.has(app.id) || startupSet.has(app.id)) ? "border-red-500/20" : "",
                      )}
                    >
                      {app.warning && (
                        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="text-[10px] text-amber-400">{app.warning}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-3 px-4 py-3">
                        {/* Icon */}
                        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-black font-display", impactColor)}>
                          {app.name.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-semibold text-white">{app.name}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", impactColor)}>
                              {app.impact}
                            </span>
                            {app.recommended && !native && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">REC</span>
                            )}
                            {/* Native live badges */}
                            {native && isRunning && !killDone && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-red-400 bg-red-500/10 border-red-500/30 animate-pulse">
                                RUNNING
                              </span>
                            )}
                            {native && isInStartup && !startupDone && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-amber-400 bg-amber-500/10 border-amber-500/30">
                                IN STARTUP
                              </span>
                            )}
                            {native && killDone && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                                ✓ KILLED
                              </span>
                            )}
                            {native && startupDone && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                                ✓ STARTUP OFF
                              </span>
                            )}
                            {native && killErr && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-red-400 bg-red-500/5 border-red-500/20">
                                KILL FAILED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">{app.description}</p>
                          <p className="text-[10px] text-zinc-600 mt-1 font-mono">{app.processName}</p>
                          {/* Error message */}
                          {native && killErr && aState?.killMsg && (
                            <p className="text-[10px] text-red-400 mt-1">{aState.killMsg}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {native ? (
                            <>
                              {/* Native Kill button */}
                              <button
                                data-testid={`button-kill-${app.id}`}
                                onClick={() => handleKill(app)}
                                disabled={killPending || killDone}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1",
                                  killDone
                                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                    : killErr
                                    ? "bg-red-900/30 border-red-500/30 text-red-400 hover:bg-red-900/50"
                                    : isRunning
                                    ? "bg-red-600 border-red-500 text-white hover:bg-red-700 shadow-sm shadow-red-600/30"
                                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-red-500/40 hover:text-red-400"
                                )}
                              >
                                {killPending
                                  ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Killing…</>
                                  : killDone
                                  ? "✓ Killed"
                                  : killErr
                                  ? <><RotateCcw className="w-2.5 h-2.5" /> Retry</>
                                  : isRunning
                                  ? <><Zap className="w-2.5 h-2.5" /> Kill Now</>
                                  : "Kill"
                                }
                              </button>
                              {/* Native Startup Off button */}
                              {app.startupKey && (
                                <button
                                  data-testid={`button-startup-${app.id}`}
                                  onClick={() => handleStartupOff(app)}
                                  disabled={startupPending || startupDone}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap flex items-center gap-1",
                                    startupDone
                                      ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                      : isInStartup
                                      ? "bg-amber-600/80 border-amber-500 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20"
                                      : "bg-transparent border-zinc-700 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400"
                                  )}
                                >
                                  {startupPending
                                    ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Removing…</>
                                    : startupDone
                                    ? "✓ Startup Off"
                                    : isInStartup
                                    ? <><WifiOff className="w-2.5 h-2.5" /> Remove Startup</>
                                    : "Startup Off"
                                  }
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Web kill checkbox */}
                              <button
                                data-testid={`button-kill-${app.id}`}
                                onClick={() => toggleKill(app.id)}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                                  killSet.has(app.id)
                                    ? "bg-red-600 border-red-500 text-white shadow-sm shadow-red-600/30"
                                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-red-500/40 hover:text-red-400"
                                )}
                              >
                                {killSet.has(app.id) ? "✓ Kill" : "Kill"}
                              </button>
                              {app.startupKey && (
                                <button
                                  data-testid={`button-startup-${app.id}`}
                                  onClick={() => toggleStartup(app.id)}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap",
                                    startupSet.has(app.id)
                                      ? "bg-amber-600/80 border-amber-500 text-white shadow-sm shadow-amber-600/20"
                                      : "bg-transparent border-zinc-700 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400"
                                  )}
                                >
                                  {startupSet.has(app.id) ? "✓ Startup Off" : "Startup Off"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          );
        })}

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3"
        >
          {native ? (
            <>
              <p className="text-[11px] text-blue-300 font-semibold mb-1">Re-enable startup apps any time</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Press <span className="text-white font-mono">Win + R</span>, type <span className="text-white font-mono">shell:startup</span> for the startup folder.
                Registry startup entries: <span className="text-white font-mono">Task Manager → Startup apps</span> → right-click → Enable.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-blue-300 font-semibold mb-1">How to reverse startup changes</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Press <span className="text-white font-mono">Win + R</span>, type <span className="text-white font-mono">shell:startup</span> to check the startup folder.
                For registry startup: open <span className="text-white font-mono">Task Manager → Startup apps</span> and re-enable any entry there.
              </p>
            </>
          )}
        </motion.div>

      </div>
    </AppLayout>
  );
}
