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
  type ProcessInfo,
  type StartupEntry,
} from "@/lib/tauri-bridge";
import {
  Monitor, Loader2, Download, X, CheckCircle2,
  Globe, Gamepad2, MessageCircle, Cloud, Cpu, Music2,
  AlertTriangle, Zap, WifiOff, RotateCcw, Power,
  ChevronDown, ChevronUp, List, Keyboard, Mic, Mouse,
  Info, Shield, Lock,
} from "lucide-react";

// ── Peripheral software detection ──────────────────────────────────────────
type PeripheralType = "keyboard" | "mouse" | "mic" | "audio";
interface PeripheralInfo { label: string; type: PeripheralType }

const PERIPHERAL_PROCESSES: Record<string, PeripheralInfo> = {
  "lghub.exe":              { label: "Logitech G HUB",        type: "keyboard" },
  "lghub_updater.exe":      { label: "Logitech G HUB Updater",type: "keyboard" },
  "logioptions.exe":        { label: "Logitech Options",       type: "keyboard" },
  "logioptions+.exe":       { label: "Logitech Options+",      type: "keyboard" },
  "logitune.exe":           { label: "Logi Tune",              type: "keyboard" },
  "logituneagent.exe":      { label: "Logi Tune Agent",        type: "keyboard" },
  "logituneupdater.exe":    { label: "Logi Tune Updater",      type: "keyboard" },
  "logi_notify.exe":        { label: "Logitech Notification",  type: "keyboard" },
  "logioverlay.exe":        { label: "Logitech Overlay",       type: "keyboard" },
  "icue.exe":               { label: "Corsair iCUE",           type: "keyboard" },
  "icue4.exe":              { label: "Corsair iCUE 4",         type: "keyboard" },
  "rzsynapse.exe":          { label: "Razer Synapse",          type: "keyboard" },
  "razercentral.exe":       { label: "Razer Central",          type: "keyboard" },
  "steelseriesgg.exe":      { label: "SteelSeries GG",         type: "keyboard" },
  "ngenuity.exe":           { label: "HyperX NGenuity",        type: "keyboard" },
  "armourysw.exe":          { label: "ASUS Armoury Crate",     type: "keyboard" },
  "signalrgb.exe":          { label: "SignalRGB",               type: "keyboard" },
  "openrgb.exe":            { label: "OpenRGB",                type: "keyboard" },
  "voicemeeter.exe":        { label: "VoiceMeeter",            type: "mic" },
  "voicemeeter8x64.exe":    { label: "VoiceMeeter Potato",     type: "mic" },
  "voicemeeterbanana.exe":  { label: "VoiceMeeter Banana",     type: "mic" },
  "nahimicservice.exe":     { label: "Nahimic Audio",          type: "audio" },
  "nahimicsvc32.exe":       { label: "Nahimic Audio",          type: "audio" },
  "soundblade.exe":         { label: "SteelSeries SoundBlade", type: "audio" },
  "equalizer apo.exe":      { label: "Equalizer APO",          type: "audio" },
  "peace.exe":              { label: "Peace EQ",               type: "audio" },
};

function PeripheralIcon({ type, className }: { type: PeripheralType; className?: string }) {
  if (type === "keyboard") return <Keyboard className={className} />;
  if (type === "mouse")    return <Mouse    className={className} />;
  return <Mic className={className} />;
}

// ── App categories ──────────────────────────────────────────────────────────
interface AppEntry {
  id: string; name: string; processName: string;
  startupKey?: string; description: string;
  impact: "HIGH" | "MED" | "LOW";
  recommended?: boolean; warning?: string;
  /** Extra helper/watchdog process names to also kill so the app can't self-relaunch */
  relatedProcesses?: string[];
}
interface AppCategory {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  apps: AppEntry[];
}
type ActionStatus = "idle" | "pending" | "done" | "error";
interface AppState { killStatus: ActionStatus; startupStatus: ActionStatus; killMsg?: string; }

const CATEGORIES: AppCategory[] = [
  {
    label: "Browsers", icon: Globe, color: "text-blue-400",
    apps: [
      { id: "tm_chrome",  name: "Google Chrome",  processName: "chrome.exe",  startupKey: "Google Chrome", description: "Background render + GPU compositor. 150-400MB RAM even when minimised.", impact: "HIGH", recommended: true, relatedProcesses: ["GoogleCrashHandler.exe", "GoogleCrashHandler64.exe", "chrome_crashpad_handler.exe"] },
      { id: "tm_edge",    name: "Microsoft Edge", processName: "msedge.exe",  startupKey: "MicrosoftEdge", description: "Edge Startup Boost keeps processes alive 24/7 even when the browser is closed.", impact: "HIGH", recommended: true, relatedProcesses: ["msedgewebview2.exe", "MicrosoftEdgeUpdate.exe"] },
      { id: "tm_firefox", name: "Firefox",        processName: "firefox.exe", description: "Multiple content processes per tab. Safe to kill before gaming.", impact: "MED", relatedProcesses: ["plugin-container.exe"] },
      { id: "tm_brave",   name: "Brave Browser",  processName: "brave.exe",   startupKey: "Brave", description: "Background service and updater stay active. Safe to kill.", impact: "MED", relatedProcesses: ["brave_crashpad_handler.exe"] },
    ],
  },
  {
    label: "Game Launchers", icon: Gamepad2, color: "text-orange-400",
    apps: [
      { id: "tm_steam",     name: "Steam",               processName: "steam.exe",             startupKey: "Steam",                  description: "Steam client + web helper + crash handler. 200-350MB RAM idle.", impact: "MED", relatedProcesses: ["steamwebhelper.exe", "SteamService.exe", "GameOverlayUI.exe"] },
      { id: "tm_epic",      name: "Epic Games Launcher", processName: "EpicGamesLauncher.exe", startupKey: "EpicGamesLauncher",       description: "Epic launcher + EOS overlay run in background even when idle.", impact: "MED", recommended: true, relatedProcesses: ["EpicWebHelper.exe", "EpicOnlineServicesInstaller.exe", "EOSUserManager.exe"] },
      { id: "tm_battlenet", name: "Battle.net",          processName: "Battle.net.exe",        startupKey: "Battle.net",             description: "Battle.net Agent uses CPU even when not updating. Kill before COD/OW.", impact: "HIGH", recommended: true, relatedProcesses: ["Agent.exe", "Battle.net Helper.exe"] },
      { id: "tm_ea",        name: "EA App / Origin",     processName: "EADesktop.exe",         startupKey: "EADesktop",              description: "EA App telemetry runs constantly. Kill before Apex/BF.", impact: "MED", recommended: true, relatedProcesses: ["EABackgroundService.exe", "EALocalHostSvc.exe", "OriginWebHelperService.exe"] },
      { id: "tm_ubisoft",   name: "Ubisoft Connect",     processName: "upc.exe",               startupKey: "Ubisoft Connect",        description: "Game service + updater stays active when closed.", impact: "LOW", relatedProcesses: ["UbisoftGameLauncher.exe", "UplayWebCore.exe"] },
      { id: "tm_rockstar",  name: "Rockstar Launcher",   processName: "PlayGTAV.exe",          startupKey: "Rockstar Games Launcher",description: "Rockstar Services + Web Helper. Only needed for GTA V / RDR2.", impact: "LOW", relatedProcesses: ["RockstarService.exe", "Rockstar Games Launcher.exe"] },
    ],
  },
  {
    label: "Communication", icon: MessageCircle, color: "text-indigo-400",
    apps: [
      { id: "tm_discord",     name: "Discord",           processName: "Discord.exe",    startupKey: "Discord",                   description: "Overlay, video codec pre-loader, and crash handler run 3+ processes.", impact: "MED", warning: "Keep open if you use Discord voice during gaming.", relatedProcesses: ["DiscordCrashHandler.exe", "DiscordHelper.exe", "DiscordPTB.exe", "DiscordCanary.exe"] },
      { id: "tm_teams",       name: "Microsoft Teams",   processName: "Teams.exe",      startupKey: "Teams",                     description: "Teams runs 4-8 processes at idle, 300-500MB RAM. Kill before gaming.", impact: "HIGH", recommended: true, relatedProcesses: ["ms-teams.exe", "TeamsMeetingAddin.exe"] },
      { id: "tm_slack",       name: "Slack",             processName: "slack.exe",      startupKey: "com.squirrel.slack.slack",  description: "Electron app with GPU compositor. 200-400MB RAM at idle.", impact: "MED", recommended: true, relatedProcesses: ["slack-helper.exe"] },
      { id: "tm_zoom",        name: "Zoom",              processName: "Zoom.exe",       startupKey: "Zoom",                      description: "Background helper and crash monitor run even when not in a call.", impact: "LOW", recommended: true, relatedProcesses: ["ZoomNotus.exe", "Zoom_launcher.exe"] },
      { id: "tm_teamviewer",  name: "TeamViewer",        processName: "TeamViewer.exe", startupKey: "TeamViewer",                description: "Maintains a remote access connection. Not needed during gaming.", impact: "LOW", recommended: true, relatedProcesses: ["TeamViewer_Service.exe"] },
    ],
  },
  {
    label: "Cloud & Sync", icon: Cloud, color: "text-cyan-400",
    apps: [
      { id: "tm_onedrive", name: "OneDrive",    processName: "OneDrive.exe",     startupKey: "OneDrive",     description: "File sync generates constant disk I/O competing with game asset streaming.", impact: "HIGH", recommended: true, relatedProcesses: ["OneDriveStandaloneUpdater.exe", "Microsoft.SharePoint.exe"] },
      { id: "tm_dropbox",  name: "Dropbox",     processName: "Dropbox.exe",      startupKey: "Dropbox",      description: "Background sync causes disk I/O spikes during gaming.", impact: "MED", recommended: true, relatedProcesses: ["DropboxUpdate.exe"] },
      { id: "tm_gdrive",   name: "Google Drive",processName: "googledrivefs.exe", startupKey: "GoogleDriveFS",description: "Continuous cloud sync in background.", impact: "MED", recommended: true, relatedProcesses: ["GoogleDriveFS.exe"] },
      { id: "tm_icloud",   name: "iCloud",      processName: "iCloudDrive.exe",  startupKey: "iCloud",       description: "Drive sync + Photo Library indexing in background.", impact: "LOW", recommended: true, relatedProcesses: ["iCloud.exe", "iCloudPhotos.exe", "AppleMobileDeviceService.exe"] },
    ],
  },
  {
    label: "GPU Tools", icon: Cpu, color: "text-green-400",
    apps: [
      { id: "tm_gfe",       name: "GeForce Experience",       processName: "NVIDIA Share.exe",  startupKey: "NvBackend",           description: "ShadowPlay + NVIDIA Share overlay. Uses 50-150MB VRAM. Driver itself stays running.", impact: "MED", recommended: true },
      { id: "tm_radeon",    name: "Radeon Software (Adrenalin)",processName: "RadeonSoftware.exe",startupKey: "AMD Radeon Software",  description: "Radeon Overlay + ReLive recorder. Safe to kill — driver stays active.", impact: "MED" },
      { id: "tm_msiab",     name: "MSI Afterburner",          processName: "MSIAfterburner.exe",startupKey: "MSI Afterburner",     description: "OC + fan profiles still apply after kill if not monitoring.", impact: "LOW", warning: "Keep running if you use a custom fan curve or OC." },
      { id: "tm_rivatuner", name: "RivaTuner / RTSS",         processName: "RTSS.exe",          startupKey: "RTSS",                description: "Frame limiter overlay. FPS cap still applied via driver after kill.", impact: "LOW", warning: "Kill only if not using the FPS overlay." },
    ],
  },
  {
    label: "Background Bloat", icon: Music2, color: "text-red-400",
    apps: [
      { id: "tm_spotify",      name: "Spotify",             processName: "Spotify.exe",       startupKey: "Spotify",             description: "4-6 Chromium-based helper processes at all times. 200-450MB RAM.", impact: "HIGH", recommended: true, relatedProcesses: ["SpotifyWebHelper.exe", "SpotifyCrashService.exe"] },
      { id: "tm_itunes",       name: "iTunes / Apple Music", processName: "iTunes.exe",        startupKey: "iTunes",              description: "iTunes Helper + AppleMobileDeviceService run even when iTunes is closed.", impact: "LOW", recommended: true, relatedProcesses: ["iTunesHelper.exe", "AppleMobileDeviceService.exe", "ApplePushService.exe"] },
      { id: "tm_adobecc",      name: "Adobe Creative Cloud", processName: "Creative Cloud.exe",startupKey: "AdobeGCInvoker-1.0", description: "CC Desktop + Genuine Checker + updater = 3 processes, 150MB RAM min.", impact: "MED", recommended: true, relatedProcesses: ["AdobeUpdateService.exe", "AGMService.exe", "AGSService.exe", "AdobeIPCBroker.exe"] },
      { id: "tm_malwarebytes", name: "Malwarebytes",         processName: "MBAMService.exe",   description: "Real-time scanning causes I/O overhead during game loads.", impact: "MED", warning: "Do not disable permanently — real-time protection matters." },
    ],
  },
];

const ALL_APPS = CATEGORIES.flatMap(c => c.apps);
const KNOWN_PROCESS_NAMES_LOWER = new Set(ALL_APPS.map(a => a.processName.toLowerCase()));

const impactColor = (impact: "HIGH" | "MED" | "LOW") =>
  impact === "HIGH" ? "text-red-400 border-red-500/30 bg-red-500/10"
  : impact === "MED" ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
  : "text-zinc-400 border-zinc-700 bg-zinc-800/50";

const PROCESS_PAGE_SIZE = 50;

// ── Known background bloat processes (update agents, telemetry, crash reporters) ──
const DEBLOAT_BG_PROCESSES = new Set([
  "googleupdate.exe", "googleupdatebroker.exe", "googlecrashhandler.exe", "googlecrashhandler64.exe",
  "adobearm.exe", "agmservice.exe", "agsservice.exe", "adobeipcbroker.exe", "adobeupdateservice.exe",
  "microsoftedgeupdate.exe",
  "steamwebhelper.exe", "gameoverlayu.exe", "steamservice.exe",
  "epicwebhelper.exe", "epicgamesservices.exe",
  "rockstarservice.exe",
  "compattelrunner.exe", "musnotification.exe", "wuapihost.exe",
  "nvspcaps64.exe", "nvsphelper64.exe", "nvcontainer.exe", "nvsync.exe", "nv_hostengine.exe",
  "discordcrashhandler.exe", "discordptb.exe", "discordcanary.exe",
  "yourphone.exe", "phoneexperiencehost.exe", "cortana.exe",
  "officeclicktorun.exe", "sdxhelper.exe",
  "mbamtray.exe", "mbamupdateui.exe",
  "spotifywebhelper.exe",
  "dropboxupdate.exe", "onedriveupdater.exe",
  "zoomnotus.exe", "zoom_launcher.exe",
  "teams.exe", "ms-teams.exe", "teamsupdatedaemon.exe",
  "searchfilterhost.exe", "searchprotocolhost.exe",
]);

// ── HKLM startup entries that are genuine Windows system entries (never offer script) ──
const WINDOWS_PROTECTED_STARTUP_NAMES = new Set([
  "securityhealth", "windows defender", "windowsdefender", "mrt", "mscares",
  "microsoftsecurityappbroker", "windowssecuritynotification", "windowsdefendernotificationiconsettings",
  // ctfmon = CTF (Collaborative Translation Framework) language bar — disabling it
  // entirely breaks text input for ALL languages/IMEs system-wide. Never safe to remove.
  "ctfmon",
]);

// ── HKLM entries that are third-party software safe to disable directly (no BAT needed) ──
const HKLM_SAFE_DISABLE_NAMES = new Set([
  "logitune", "logi tune",
  "vanguard", "riot vanguard", "vgc", "vgk",
]);

export default function TaskManagerPage() {
  const { toast } = useToast();
  const native = isNative();

  // ── Web-only ───────────────────────────────────────────────────────────────
  const [killSet, setKillSet] = useState<Set<string>>(new Set());
  const [startupSet, setStartupSet] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // ── Native ─────────────────────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [inStartupIds, setInStartupIds] = useState<Set<string>>(new Set());
  const [appStates, setAppStates] = useState<Record<string, AppState>>({});
  const [allProcesses, setAllProcesses] = useState<ProcessInfo[]>([]);
  const [allStartupEntries, setAllStartupEntries] = useState<StartupEntry[]>([]);

  // ── Background process kill state ──────────────────────────────────────────
  const [bgKillStates, setBgKillStates] = useState<Record<string, "idle" | "pending" | "done" | "error">>({});

  // ── Closed tasks (killed bg processes this session) ────────────────────────
  const [closedBgProcesses, setClosedBgProcesses] = useState<{ name: string; pid?: number }[]>([]);
  const [relaunchStates, setRelaunchStates] = useState<Record<string, "idle" | "pending">>({});

  // ── Startup disable state (for non-curated entries) ────────────────────────
  const [startupDisableStates, setStartupDisableStates] = useState<Record<string, "idle" | "pending" | "done" | "error">>({});

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showAllProcesses, setShowAllProcesses] = useState(false);
  const [activeSection, setActiveSection] = useState<"running" | "startup">("running");

  const setAppState = (id: string, patch: Partial<AppState>) =>
    setAppStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } as AppState }));

  // ── Scan ───────────────────────────────────────────────────────────────────
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
      const newRunningIds = new Set(result.running);
      setRunningIds(newRunningIds);
      setInStartupIds(new Set(result.in_startup));
      setAllProcesses(result.all_processes ?? []);
      setAllStartupEntries(result.all_startup_entries ?? []);

      // Reset kill state for any app that is running again after rescan
      setAppStates(prev => {
        const next = { ...prev };
        for (const id of newRunningIds) {
          if (next[id]?.killStatus === "done") {
            next[id] = { ...next[id], killStatus: "idle" };
          }
        }
        return next;
      });
      // Reset bg kill states for processes that are running again
      setBgKillStates(prev => {
        const next = { ...prev };
        for (const proc of result.all_processes ?? []) {
          if (next[proc.name.toLowerCase()] === "done") {
            next[proc.name.toLowerCase()] = "idle";
          }
        }
        return next;
      });

      setScanned(true);
    } catch (err) {
      console.error("[task-manager] scan failed", err);
      toast({ title: "Scan failed", description: "Could not read running processes.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }, [toast]);

  useEffect(() => { if (native) runScan(); }, [native, runScan]);

  // ── Known app kill (main + all related helper/watchdog processes) ──────────
  const handleKill = async (app: AppEntry) => {
    setAppState(app.id, { killStatus: "pending" });
    try {
      // Kill main process first
      const res = await killApp(app.processName);
      // Kill all related helpers regardless of main result — best-effort, fire and forget
      if (app.relatedProcesses?.length) {
        await Promise.allSettled(app.relatedProcesses.map(p => killApp(p)));
      }
      if (res.ok) {
        setAppState(app.id, { killStatus: "done" });
        setRunningIds(prev => { const n = new Set(prev); n.delete(app.id); return n; });
      } else {
        setAppState(app.id, { killStatus: "error", killMsg: res.message });
      }
    } catch (err) {
      setAppState(app.id, { killStatus: "error", killMsg: String(err) });
    }
  };

  // ── Background process kill ────────────────────────────────────────────────
  const handleKillBgProcess = async (processName: string) => {
    const key = processName.toLowerCase();
    const procInfo = allProcesses.find(p => p.name.toLowerCase() === key);
    setBgKillStates(prev => ({ ...prev, [key]: "pending" }));
    try {
      const res = await killApp(processName);
      if (res.ok) {
        setBgKillStates(prev => ({ ...prev, [key]: "done" }));
        setAllProcesses(prev => prev.filter(p => p.name.toLowerCase() !== key));
        setClosedBgProcesses(prev => {
          if (prev.some(p => p.name.toLowerCase() === key)) return prev;
          return [...prev, { name: processName, pid: procInfo?.pid }];
        });
      } else {
        setBgKillStates(prev => ({ ...prev, [key]: "error" }));
        const isElevated = res.message.toLowerCase().includes("elevated") ||
                           res.message.toLowerCase().includes("access") ||
                           res.message.toLowerCase().includes("administrator");
        toast({
          title: isElevated ? "Protected process" : "Cannot kill",
          description: isElevated
            ? `${processName} is running with elevated privileges. Relaunch Opti Gods as Administrator to force-kill it.`
            : res.message,
          variant: isElevated ? "default" : "destructive",
        });
      }
    } catch {
      setBgKillStates(prev => ({ ...prev, [key]: "error" }));
    }
  };

  // ── Relaunch a previously-killed bg process ────────────────────────────────
  const handleRelaunchProcess = async (processName: string) => {
    const key = processName.toLowerCase();
    setRelaunchStates(prev => ({ ...prev, [key]: "pending" }));
    try {
      const res = await fetch(apiUrl("/api/task-manager/relaunch"), {
        method: "POST", headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ processName }),
      });
      if (!res.ok) throw new Error("server error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Relaunch_${processName.replace(/\.exe$/i,"")}.bat`; a.click();
      URL.revokeObjectURL(url);
      setClosedBgProcesses(prev => prev.filter(p => p.name.toLowerCase() !== key));
      toast({ title: "Script downloaded", description: `Run to relaunch ${processName}.` });
    } catch {
      toast({ title: "Error", description: "Failed to generate relaunch script.", variant: "destructive" });
    } finally {
      setRelaunchStates(prev => ({ ...prev, [key]: "idle" }));
    }
  };

  // ── Disable HKLM startup entry via StartupApproved script ─────────────────
  const handleDisableHklmStartup = async (entryName: string) => {
    try {
      const r = await fetch(apiUrl("/api/task-manager/disable-hklm-startup"), {
        method: "POST", headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ entryName }),
      });
      if (!r.ok) throw new Error("server error");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `OptiGods_Disable_${entryName.replace(/\s+/g,"_")}.bat`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Script downloaded", description: `Run as Administrator to disable "${entryName}" from startup.` });
    } catch {
      toast({ title: "Error", description: "Failed to generate disable script.", variant: "destructive" });
    }
  };

  // ── Known app startup-off ──────────────────────────────────────────────────
  const handleStartupOff = async (app: AppEntry) => {
    if (!app.startupKey) return;
    setAppState(app.id, { startupStatus: "pending" });
    try {
      const res = await disableStartupApp(app.startupKey);
      if (res.ok) {
        setAppState(app.id, { startupStatus: "done" });
        setInStartupIds(prev => { const n = new Set(prev); n.delete(app.id); return n; });
        setAllStartupEntries(prev => prev.filter(e => e.name.toLowerCase() !== app.startupKey!.toLowerCase()));
      } else {
        setAppState(app.id, { startupStatus: "error" });
      }
    } catch (err) {
      setAppState(app.id, { startupStatus: "error" });
    }
  };

  // ── Generic startup entry disable ─────────────────────────────────────────
  const handleDisableStartupEntry = async (entry: StartupEntry) => {
    // Route to known-app handler if we have one
    const match = ALL_APPS.find(a => a.startupKey?.toLowerCase() === entry.name.toLowerCase());
    if (match) { handleStartupOff(match); return; }

    const key = entry.name;
    setStartupDisableStates(prev => ({ ...prev, [key]: "pending" }));
    try {
      const res = await disableStartupApp(key);
      if (res.ok) {
        setStartupDisableStates(prev => ({ ...prev, [key]: "done" }));
        setAllStartupEntries(prev => prev.filter(e => e.name !== key));
      } else {
        setStartupDisableStates(prev => ({ ...prev, [key]: "error" }));
        toast({ title: "Cannot disable", description: res.message, variant: "destructive" });
      }
    } catch {
      setStartupDisableStates(prev => ({ ...prev, [key]: "error" }));
    }
  };

  // ── Web handlers ───────────────────────────────────────────────────────────
  const toggleKill = (id: string) => setKillSet(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleStartup = (id: string) => setStartupSet(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSelectRecommended = () => {
    const recKill = new Set(ALL_APPS.filter(a => a.recommended).map(a => a.id));
    const recStartup = new Set(ALL_APPS.filter(a => a.recommended && a.startupKey).map(a => a.id));
    setKillSet(recKill); setStartupSet(recStartup);
    toast({ title: "Recommended selected", description: `${recKill.size} apps to kill, ${recStartup.size} startup entries to disable` });
  };
  const handleClearAll = () => { setKillSet(new Set()); setStartupSet(new Set()); };

  const handleDownload = async () => {
    if (killSet.size === 0 && startupSet.size === 0) {
      toast({ title: "Nothing selected", variant: "destructive" }); return;
    }
    setDownloading(true);
    try {
      const kill = Array.from(killSet).map(id => ALL_APPS.find(a => a.id === id)?.processName).filter(Boolean) as string[];
      const startup = Array.from(startupSet).map(id => ALL_APPS.find(a => a.id === id)?.startupKey).filter(Boolean) as string[];
      const res = await fetch(apiUrl("/api/task-manager/kill-script"), {
        method: "POST", headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ kill, startup }),
      });
      if (!res.ok) throw new Error("server error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "OptiGods_TaskManager.bat"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Script downloaded" });
    } catch { toast({ title: "Error", description: "Failed to generate script.", variant: "destructive" }); }
    finally { setDownloading(false); }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const killedCount = Object.values(appStates).filter(s => s?.killStatus === "done").length
    + Object.values(bgKillStates).filter(s => s === "done").length;
  const startupRemovedCount = Object.values(appStates).filter(s => s?.startupStatus === "done").length
    + Object.values(startupDisableStates).filter(s => s === "done").length;

  const runningKnownApps = ALL_APPS.filter(a => runningIds.has(a.id));
  const peripheralProcesses = allProcesses.filter(p =>
    !KNOWN_PROCESS_NAMES_LOWER.has(p.name.toLowerCase()) &&
    PERIPHERAL_PROCESSES[p.name.toLowerCase()]
  );
  const peripheralKeysRunning = new Set(peripheralProcesses.map(p => p.name.toLowerCase()));
  const bgProcesses = allProcesses.filter(p =>
    !KNOWN_PROCESS_NAMES_LOWER.has(p.name.toLowerCase()) &&
    !peripheralKeysRunning.has(p.name.toLowerCase())
  );
  const displayedProcesses = showAllProcesses ? bgProcesses : bgProcesses.slice(0, PROCESS_PAGE_SIZE);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-5 pb-10 text-white">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Monitor className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Background App Manager</h1>
            <p className="text-zinc-500 text-sm">
              {native ? "Live view of running processes and startup apps — kill or disable with one click"
                      : "Select apps to kill before gaming and remove from startup"}
            </p>
          </div>
        </motion.div>

        {/* ── NOTICE (top, native only) ──────────────────────────────────── */}
        {native && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
            className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-blue-300 font-semibold mb-0.5">Re-enable startup apps any time</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Press <span className="text-white font-mono">Win + R</span>, type <span className="text-white font-mono">shell:startup</span> for the startup folder.
                Or open <span className="text-white font-mono">Task Manager → Startup apps</span> → right-click → Enable to restore any entry.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── NATIVE: Stats + Rescan ─────────────────────────────────────── */}
        {native && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
            className="rounded-xl border border-red-500/20 bg-zinc-900/60 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-5 flex-wrap">
                <div className="text-center">
                  <p className="text-xl font-display font-black text-red-400">
                    {scanning ? <Loader2 className="w-5 h-5 animate-spin text-red-400" /> : allProcesses.length || runningIds.size}
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">background</p>
                  <p className="text-[9px] text-zinc-700">sys excluded</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-orange-400">{scanning ? "…" : runningKnownApps.length}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">known apps</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-amber-400">{scanning ? "…" : allStartupEntries.length}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">startup entries</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-emerald-400">{killedCount + startupRemovedCount}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">actions done</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={runScan} disabled={scanning}
                data-testid="button-task-manager-rescan"
                className="border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs gap-1.5">
                {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                {scanning ? "Scanning…" : "Re-scan"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── WEB: Control bar ──────────────────────────────────────────── */}
        {!native && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-xl border border-red-500/20 bg-zinc-900/60 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-display font-black text-red-400">{killSet.size}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">to kill</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl font-display font-black text-amber-400">{startupSet.size}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">startup off</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(killSet.size > 0 || startupSet.size > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearAll} data-testid="button-task-manager-clear"
                    className="text-zinc-500 hover:text-zinc-300 hover:bg-white/5 text-xs gap-1.5">
                    <X className="w-3 h-3" /> Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleSelectRecommended} data-testid="button-task-manager-recommended"
                  className="border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Select Recommended
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={downloading || (killSet.size === 0 && startupSet.size === 0)}
                  data-testid="button-task-manager-download"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5 disabled:opacity-40">
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {downloading ? "Generating…" : "Download Kill Script"}
                </Button>
              </div>
            </div>
            <div className="border-t border-white/5 px-5 py-3">
              <p className="text-[11px] text-amber-300/80 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                Tick the apps you actually have installed — the script skips anything not running.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── NATIVE: Section tabs ──────────────────────────────────────── */}
        {native && scanned && (
          <div className="flex gap-2">
            <button onClick={() => setActiveSection("running")} data-testid="tab-running"
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all",
                activeSection === "running"
                  ? "bg-red-600/20 border-red-500/40 text-red-400"
                  : "bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700")}>
              <Monitor className="w-4 h-4" />
              Running Processes
              <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{allProcesses.length || runningIds.size}</span>
            </button>
            <button onClick={() => setActiveSection("startup")} data-testid="tab-startup"
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all",
                activeSection === "startup"
                  ? "bg-amber-600/20 border-amber-500/40 text-amber-400"
                  : "bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700")}>
              <Power className="w-4 h-4" />
              Startup Apps
              <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{allStartupEntries.length}</span>
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            RUNNING PROCESSES section
        ════════════════════════════════════════════════════════════════ */}
        {(!native || !scanned || activeSection === "running") && (
          <>
            {/* All clean message */}
            {native && scanned && runningKnownApps.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-400">None of your tracked apps are running — already clean for gaming.</p>
              </motion.div>
            )}

            {/* Known app categories */}
            {CATEGORIES.map((cat, catIdx) => {
              const CatIcon = cat.icon;
              const visibleApps = native ? cat.apps.filter(a => runningIds.has(a.id)) : cat.apps;
              if (native && visibleApps.length === 0) return null;

              return (
                <motion.section key={cat.label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + catIdx * 0.03 }}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <CatIcon className={cn("w-4 h-4", cat.color)} />
                    <h2 className={cn("text-sm font-bold uppercase tracking-wider", cat.color)}>{cat.label}</h2>
                    {native && <span className="text-[10px] text-zinc-600">{visibleApps.length} running</span>}
                    {!native && (killSet.size > 0 || startupSet.size > 0) && (() => {
                      const kc = cat.apps.filter(a => killSet.has(a.id)).length;
                      const sc = cat.apps.filter(a => startupSet.has(a.id)).length;
                      return (kc > 0 || sc > 0) ? (
                        <span className="text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded">
                          {kc > 0 && `${kc} kill`}{kc > 0 && sc > 0 && " · "}{sc > 0 && `${sc} startup`}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  <div className="space-y-2.5">
                    {visibleApps.map((app) => {
                      const aState = appStates[app.id];
                      const isRunning = runningIds.has(app.id);
                      const isInStartup = inStartupIds.has(app.id);
                      const killPending  = aState?.killStatus === "pending";
                      const killDone     = aState?.killStatus === "done";
                      const killErr      = aState?.killStatus === "error";
                      const startupPending = aState?.startupStatus === "pending";
                      const startupDone    = aState?.startupStatus === "done";
                      const iColor = impactColor(app.impact);

                      return (
                        <div key={app.id} data-testid={`card-task-manager-${app.id}`}
                          className={cn("rounded-xl border bg-zinc-900/60 overflow-hidden transition-all",
                            native && isRunning ? "border-red-500/30" : "border-white/5",
                            native && killDone ? "border-emerald-500/20" : "",
                            !native && (killSet.has(app.id) || startupSet.has(app.id)) ? "border-red-500/20" : "")}>
                          {app.warning && (
                            <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="text-[10px] text-amber-400">{app.warning}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-3 px-4 py-3">
                            <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-black font-display", iColor)}>
                              {app.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-semibold text-white">{app.name}</span>
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", iColor)}>{app.impact}</span>
                                {app.recommended && !native && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">REC</span>}
                                {native && isRunning && !killDone && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-red-400 bg-red-500/10 border-red-500/30 animate-pulse">RUNNING</span>}
                                {native && isInStartup && !startupDone && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-amber-400 bg-amber-500/10 border-amber-500/30">IN STARTUP</span>}
                                {native && killDone && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">✓ KILLED</span>}
                                {native && startupDone && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">✓ STARTUP OFF</span>}
                                {native && killErr && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-red-400 bg-red-500/5 border-red-500/20">KILL FAILED</span>}
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-relaxed">{app.description}</p>
                              <p className="text-[10px] text-zinc-600 mt-1 font-mono">{app.processName}</p>
                              {native && killErr && aState?.killMsg && <p className="text-[10px] text-red-400 mt-1">{aState.killMsg}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {native ? (
                                <>
                                  <button data-testid={`button-kill-${app.id}`} onClick={() => handleKill(app)}
                                    disabled={killPending || killDone}
                                    className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1",
                                      killDone ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                      : killErr  ? "bg-red-900/30 border-red-500/30 text-red-400 hover:bg-red-900/50"
                                      : isRunning ? "bg-red-600 border-red-500 text-white hover:bg-red-700 shadow-sm shadow-red-600/30"
                                      : "bg-transparent border-zinc-700 text-zinc-500 hover:border-red-500/40 hover:text-red-400")}>
                                    {killPending ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Killing…</>
                                    : killDone   ? "✓ Killed"
                                    : killErr    ? <><RotateCcw className="w-2.5 h-2.5" /> Retry</>
                                    : isRunning  ? <><Zap className="w-2.5 h-2.5" /> Kill Now</>
                                    : "Kill"}
                                  </button>
                                  {app.startupKey && (
                                    <button data-testid={`button-startup-${app.id}`} onClick={() => handleStartupOff(app)}
                                      disabled={startupPending || startupDone}
                                      className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap flex items-center gap-1",
                                        startupDone ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                        : isInStartup ? "bg-amber-600/80 border-amber-500 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20"
                                        : "bg-transparent border-zinc-700 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400")}>
                                      {startupPending ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Removing…</>
                                      : startupDone   ? "✓ Startup Off"
                                      : isInStartup   ? <><WifiOff className="w-2.5 h-2.5" /> Remove Startup</>
                                      : "Startup Off"}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button data-testid={`button-kill-${app.id}`} onClick={() => toggleKill(app.id)}
                                    className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                                      killSet.has(app.id) ? "bg-red-600 border-red-500 text-white shadow-sm shadow-red-600/30"
                                      : "bg-transparent border-zinc-700 text-zinc-500 hover:border-red-500/40 hover:text-red-400")}>
                                    {killSet.has(app.id) ? "✓ Kill" : "Kill"}
                                  </button>
                                  {app.startupKey && (
                                    <button data-testid={`button-startup-${app.id}`} onClick={() => toggleStartup(app.id)}
                                      className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap",
                                        startupSet.has(app.id) ? "bg-amber-600/80 border-amber-500 text-white shadow-sm shadow-amber-600/20"
                                        : "bg-transparent border-zinc-700 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400")}>
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

            {/* ── NATIVE: Peripheral Software section ────────────────────── */}
            {native && scanned && peripheralProcesses.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Keyboard className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">Peripheral Software</h2>
                  <span className="text-[10px] text-zinc-600">{peripheralProcesses.length} running</span>
                </div>

                <div className="mb-3 rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-2 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Keyboard, mouse, and audio software detected. These are safe to kill while gaming —{" "}
                    <span className="text-blue-300 font-semibold">your hardware keeps working</span>, only the overlay/RGB/updater closes.
                    Re-open the app to get them back.
                  </p>
                </div>

                <div className="rounded-xl border border-blue-500/15 bg-zinc-900/60 overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {peripheralProcesses.map((proc) => {
                      const key = proc.name.toLowerCase();
                      const info = PERIPHERAL_PROCESSES[key];
                      const killState = bgKillStates[key] ?? "idle";
                      const isKillPending = killState === "pending";
                      const isKillDone = killState === "done";
                      return (
                        <div key={proc.name} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-6 h-6 rounded border bg-blue-500/10 border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                              <PeripheralIcon type={info.type} className="w-3 h-3" />
                            </div>
                            <div className="min-w-0">
                              <span className={cn("text-sm font-mono truncate block", isKillDone ? "text-zinc-600 line-through" : "text-zinc-300")}>
                                {proc.name}
                              </span>
                              <span className="text-[10px] text-blue-400">{info.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            {proc.instances > 1 && (
                              <span className="text-[10px] text-zinc-600 font-mono">×{proc.instances}</span>
                            )}
                            <span className="text-[10px] text-zinc-700 font-mono hidden sm:block">PID {proc.pid}</span>
                            {proc.can_kill ? (
                              <button
                                data-testid={`button-kill-peripheral-${key}`}
                                onClick={() => handleKillBgProcess(proc.name)}
                                disabled={isKillPending || isKillDone}
                                className={cn(
                                  "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1 whitespace-nowrap",
                                  isKillDone
                                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                    : isKillPending
                                    ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-wait"
                                    : "bg-emerald-600/80 border-emerald-500/60 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-600/20"
                                )}
                              >
                                {isKillPending ? <Loader2 className="w-2 h-2 animate-spin" />
                                : isKillDone   ? "✓ Killed"
                                : <><Zap className="w-2 h-2" /> Safe to Kill</>}
                              </button>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-1 whitespace-nowrap">
                                <Lock className="w-2.5 h-2.5" /> Don't Kill
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            )}

            {/* ── NATIVE: All background processes with Kill buttons ──────── */}
            {native && scanned && bgProcesses.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <List className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">All Background Processes</h2>
                  <span className="text-[10px] text-zinc-600">{bgProcesses.length} processes</span>
                </div>

                {/* Info banner */}
                <div className="mb-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    These are all non-Windows processes running on your PC. <span className="text-emerald-400 font-semibold">Safe to close</span> — critical Windows processes and peripheral software are already filtered into their own sections above.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {displayedProcesses.map((proc) => {
                      const key = proc.name.toLowerCase();
                      const peripheral = PERIPHERAL_PROCESSES[key];
                      const isDebloat = DEBLOAT_BG_PROCESSES.has(key);
                      const killState = bgKillStates[key] ?? "idle";
                      const isKillPending = killState === "pending";
                      const isKillDone = killState === "done";

                      return (
                        <div key={proc.name} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Icon */}
                            <div className={cn(
                              "w-6 h-6 rounded border flex items-center justify-center shrink-0",
                              peripheral
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                : isDebloat
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : "bg-zinc-800 border-white/5 text-zinc-500"
                            )}>
                              {peripheral
                                ? <PeripheralIcon type={peripheral.type} className="w-3 h-3" />
                                : <span className="text-[9px] font-black">{proc.name.substring(0, 2).toUpperCase()}</span>
                              }
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={cn("text-sm font-mono truncate", isKillDone ? "text-zinc-600 line-through" : "text-zinc-300")}>
                                  {proc.name}
                                </span>
                                {isDebloat && !isKillDone && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 uppercase tracking-wider shrink-0">
                                    DEBLOAT
                                  </span>
                                )}
                              </div>
                              {peripheral && (
                                <span className="text-[10px] text-blue-400">{peripheral.label}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            {proc.instances > 1 && (
                              <span className="text-[10px] text-zinc-600 font-mono">×{proc.instances}</span>
                            )}
                            <span className="text-[10px] text-zinc-700 font-mono hidden sm:block">PID {proc.pid}</span>
                            {proc.can_kill ? (
                              <button
                                data-testid={`button-kill-bg-${key}`}
                                onClick={() => handleKillBgProcess(proc.name)}
                                disabled={isKillPending || isKillDone}
                                className={cn(
                                  "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1 whitespace-nowrap",
                                  isKillDone
                                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                    : isKillPending
                                    ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-wait"
                                    : "bg-emerald-600/80 border-emerald-500/60 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-600/20"
                                )}
                              >
                                {isKillPending ? <Loader2 className="w-2 h-2 animate-spin" />
                                : isKillDone   ? "✓ Killed"
                                : <><Zap className="w-2 h-2" /> Safe to Kill</>}
                              </button>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-1 whitespace-nowrap">
                                <Lock className="w-2.5 h-2.5" /> Don't Kill
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {bgProcesses.length > PROCESS_PAGE_SIZE && (
                    <button
                      onClick={() => setShowAllProcesses(v => !v)}
                      className="w-full flex items-center justify-center gap-2 py-3 border-t border-white/5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                    >
                      {showAllProcesses
                        ? <><ChevronUp className="w-3 h-3" /> Show less</>
                        : <><ChevronDown className="w-3 h-3" /> Show all {bgProcesses.length} processes</>}
                    </button>
                  )}
                </div>
              </motion.section>
            )}

            {/* ── NATIVE: Closed Tasks — killed this session ─────────────── */}
            {native && scanned && closedBgProcesses.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <RotateCcw className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Closed Tasks</h2>
                  <span className="text-[10px] text-zinc-600">{closedBgProcesses.length} killed this session</span>
                </div>

                <div className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden divide-y divide-white/5">
                  {closedBgProcesses.map(proc => {
                    const key = proc.name.toLowerCase();
                    const isPending = relaunchStates[key] === "pending";
                    return (
                      <div key={proc.name} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded border bg-zinc-800/60 border-white/5 flex items-center justify-center shrink-0 text-zinc-600">
                            <X className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-mono text-zinc-600 line-through truncate">{proc.name}</span>
                        </div>
                        <button
                          data-testid={`button-relaunch-${key}`}
                          onClick={() => handleRelaunchProcess(proc.name)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1 whitespace-nowrap bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="w-2 h-2 animate-spin" /> : <RotateCcw className="w-2 h-2" />}
                          Bring Back
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STARTUP APPS section
        ════════════════════════════════════════════════════════════════ */}
        {native && scanned && activeSection === "startup" && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>

            {allStartupEntries.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-zinc-900/60 px-5 py-8 text-center">
                <Power className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No startup entries detected.</p>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="mb-3 rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 flex flex-wrap items-center gap-4 text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500/60" />
                    <span>HKCU — user-level, safe to disable</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500/60" />
                    <span>HKLM — system-level, read-only for safety</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {allStartupEntries.map((entry) => {
                    const matchedApp = ALL_APPS.find(a => a.startupKey?.toLowerCase() === entry.name.toLowerCase());
                    const aState = matchedApp ? appStates[matchedApp.id] : undefined;
                    const directState = startupDisableStates[entry.name] ?? "idle";
                    const isDisablePending = (aState?.startupStatus === "pending") || directState === "pending";
                    const isDisableDone    = (aState?.startupStatus === "done")    || directState === "done";

                    return (
                      <div key={`${entry.location}-${entry.name}`}
                        data-testid={`card-startup-${entry.name.replace(/\s+/g, "-").toLowerCase()}`}
                        className={cn("rounded-xl border bg-zinc-900/60 transition-all",
                          isDisableDone ? "border-emerald-500/20" : "border-white/5 hover:border-white/10")}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 text-[11px] font-black font-display",
                            entry.can_disable ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-zinc-500 bg-zinc-800 border-zinc-700/50")}>
                            {entry.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-semibold text-white">{entry.name}</span>
                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                entry.location === "HKCU"
                                  ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                                  : "text-purple-400 bg-purple-500/10 border-purple-500/30")}>
                                {entry.location}
                              </span>
                              {isDisableDone && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/30">✓ REMOVED</span>}
                            </div>
                            <p className="text-[10px] text-zinc-600 font-mono truncate">{entry.command}</p>
                          </div>
                          <div className="shrink-0 ml-2">
                            {(entry.can_disable || HKLM_SAFE_DISABLE_NAMES.has(entry.name.toLowerCase())) ? (
                              <button
                                data-testid={`button-disable-startup-${entry.name.replace(/\s+/g, "-").toLowerCase()}`}
                                onClick={() => handleDisableStartupEntry(entry)}
                                disabled={isDisablePending || isDisableDone}
                                className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap flex items-center gap-1",
                                  isDisableDone ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                                  : "bg-amber-600/80 border-amber-500 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20")}>
                                {isDisablePending ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Removing…</>
                                : isDisableDone   ? "✓ Removed"
                                : <><WifiOff className="w-2.5 h-2.5" /> Disable</>}
                              </button>
                            ) : entry.location === "HKLM" && !WINDOWS_PROTECTED_STARTUP_NAMES.has(entry.name.toLowerCase()) ? (
                              <button
                                data-testid={`button-hklm-script-${entry.name.replace(/\s+/g, "-").toLowerCase()}`}
                                onClick={() => handleDisableHklmStartup(entry.name)}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap flex items-center gap-1 bg-zinc-800/80 border-zinc-600 text-zinc-300 hover:border-amber-500/60 hover:text-amber-300"
                                title="Downloads a BAT script — run as Administrator to disable this system-level startup entry">
                                <Download className="w-2.5 h-2.5" /> Script
                              </button>
                            ) : (
                              <span className="text-[9px] text-zinc-600 px-2 py-1.5 rounded border border-zinc-800 flex items-center gap-1 whitespace-nowrap">
                                <Lock className="w-2.5 h-2.5" />
                                Protected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.section>
        )}

      </div>
    </AppLayout>
  );
}
