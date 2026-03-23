import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Trash2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOsDetection } from "@/hooks/use-os-detection";
import { cn } from "@/lib/utils";

const ALL_DEBLOAT_IDS = [
  "DebloatCortana","DebloatOneDrive","DebloatXboxApp","DebloatXboxGameBar","DebloatXboxIdentity",
  "DebloatBing","DebloatWeather","DebloatNews","DebloatMaps","DebloatSolitaire","DebloatMixedReality",
  "DebloatSkype","DebloatZune","DebloatGrooveMusic","DebloatOfficeHub","DebloatFeedback",
  "DebloatGetHelp","DebloatMSPaint3D","DebloatWindowsCamera","DebloatYourPhone","DebloatClipchamp",
  "DebloatPowerAutomate","DebloatQuickAssist","DebloatTeamsConsumer","DebloatAlarmsAndClock",
  "ServiceDiagTrack","ServiceWSearch","ServiceSysMain","ServiceRemoteReg","ServiceWMPNetworkSvc",
  "ServiceFax","ServiceRetailDemo","ServiceTabletInput","ServiceMapsBroker",
  "PrivacyTelemetry","PrivacyActivityHistory","PrivacyLocationTracking","PrivacyAdvertisingID","PrivacyDiagFeedback",
  "Win11TeamsChat","Win11Widgets","Win11Copilot","Win11StartRecommended","Win11AdsInStart",
  "Win11EdgeSidebar","Win11ChatIcon","Win11OneDriveBackup","Win11BingSearch","Win11Snap",
];
const DEBLOAT_RECOMMENDED_IDS = [
  "DebloatCortana","DebloatOneDrive","DebloatXboxGameBar","DebloatBing","DebloatTeamsConsumer",
  "ServiceDiagTrack","ServiceSysMain","ServiceRemoteReg","ServiceFax","ServiceRetailDemo",
  "PrivacyTelemetry","PrivacyActivityHistory","PrivacyAdvertisingID",
  "Win11Copilot","Win11AdsInStart","Win11BingSearch","Win11ChatIcon","Win11Widgets",
];

type InstallLikelihood = "preinstalled" | "likely" | "optional";

const LikelihoodBadge = ({ status }: { status: InstallLikelihood }) => {
  const config = {
    preinstalled: { dot: "bg-red-500", label: "PRE-INSTALLED", text: "text-red-400 border-red-500/30 bg-red-500/10" },
    likely: { dot: "bg-zinc-400", label: "USUALLY PRESENT", text: "text-zinc-400 border-zinc-600/30 bg-zinc-800/30" },
    optional: { dot: "bg-zinc-600", label: "OPTIONAL", text: "text-zinc-500 border-zinc-700/30 bg-zinc-900/30" },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide shrink-0", config.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  );
};

interface DebloatItem {
  id: string;
  title: string;
  desc: string;
  status: InstallLikelihood;
}

const WIN10_APPS: DebloatItem[] = [
  { id: "DebloatCortana", title: "Remove Cortana", desc: "Uninstalls Cortana assistant — saves ~200MB RAM at idle.", status: "preinstalled" },
  { id: "DebloatOneDrive", title: "Remove OneDrive", desc: "Unlinks and uninstalls OneDrive. Local files stay intact.", status: "preinstalled" },
  { id: "DebloatXboxApp", title: "Remove Xbox App", desc: "Removes the Xbox companion app (separate from Game Bar).", status: "preinstalled" },
  { id: "DebloatXboxGameBar", title: "Remove Xbox Game Bar", desc: "Uninstalls the Game Bar overlay from memory entirely.", status: "preinstalled" },
  { id: "DebloatXboxIdentity", title: "Remove Xbox Identity Provider", desc: "Stops Xbox authentication background service.", status: "preinstalled" },
  { id: "DebloatBing", title: "Disable Bing Search in Start", desc: "Disables online Bing results in Start Menu search bar.", status: "preinstalled" },
  { id: "DebloatWeather", title: "Remove MSN Weather", desc: "Removes MSN Weather app and news feed integration.", status: "preinstalled" },
  { id: "DebloatNews", title: "Remove Microsoft News", desc: "Uninstalls News app and disables background fetch.", status: "preinstalled" },
  { id: "DebloatMaps", title: "Remove Windows Maps", desc: "Removes Maps app and stops location sync services.", status: "preinstalled" },
  { id: "DebloatSolitaire", title: "Remove Solitaire Collection", desc: "Removes Solitaire + auto-update background tasks.", status: "preinstalled" },
  { id: "DebloatMixedReality", title: "Remove Mixed Reality Portal", desc: "Removes VR/MR portal app — useless on non-VR systems.", status: "likely" },
  { id: "DebloatSkype", title: "Remove Skype (Built-in)", desc: "Removes the pre-installed Skype app (not desktop version).", status: "preinstalled" },
  { id: "DebloatZune", title: "Remove Groove Music", desc: "Removes legacy Groove Music (Zune) player.", status: "preinstalled" },
  { id: "DebloatGrooveMusic", title: "Remove Movies & TV", desc: "Removes the Movies & TV streaming app.", status: "preinstalled" },
  { id: "DebloatOfficeHub", title: "Remove Office Hub", desc: "Removes the Office Hub UWP stub app.", status: "preinstalled" },
  { id: "DebloatFeedback", title: "Remove Feedback Hub", desc: "Removes Feedback Hub — sends your data to Microsoft.", status: "preinstalled" },
  { id: "DebloatGetHelp", title: "Remove Get Help", desc: "Removes the Get Help / Contact Support app.", status: "preinstalled" },
  { id: "DebloatMSPaint3D", title: "Remove Paint 3D", desc: "Removes Paint 3D while keeping classic MS Paint.", status: "preinstalled" },
  { id: "DebloatWindowsCamera", title: "Remove Windows Camera", desc: "Removes the default Camera UWP app.", status: "preinstalled" },
  { id: "DebloatYourPhone", title: "Remove Your Phone / Link to Windows", desc: "Removes phone linking app and its background agent.", status: "preinstalled" },
  { id: "DebloatClipchamp", title: "Remove Clipchamp Video Editor", desc: "Removes Microsoft's bundled video editor app.", status: "likely" },
  { id: "DebloatPowerAutomate", title: "Remove Power Automate", desc: "Removes the automation tool pre-installed on Win10/11.", status: "likely" },
  { id: "DebloatQuickAssist", title: "Remove Quick Assist", desc: "Removes remote desktop support app — security benefit.", status: "preinstalled" },
  { id: "DebloatTeamsConsumer", title: "Remove Teams (Consumer)", desc: "Removes Microsoft Teams consumer app (not work version).", status: "likely" },
  { id: "DebloatAlarmsAndClock", title: "Remove Alarms & Clock", desc: "Removes the Alarms & Clock UWP app.", status: "preinstalled" },
];

const SERVICES: DebloatItem[] = [
  { id: "ServiceDiagTrack", title: "Disable DiagTrack (Telemetry Service)", desc: "Stops Connected User Experiences and Telemetry — blocks all data uploads.", status: "preinstalled" },
  { id: "ServiceWSearch", title: "Disable Windows Search Indexer", desc: "Stops WSearch from consuming CPU/disk during background indexing.", status: "preinstalled" },
  { id: "ServiceSysMain", title: "Disable SysMain (Superfetch)", desc: "Disables Superfetch — beneficial for NVMe/SSD users.", status: "preinstalled" },
  { id: "ServiceRemoteReg", title: "Disable Remote Registry", desc: "Prevents remote modification of registry — security win.", status: "likely" },
  { id: "ServiceWMPNetworkSvc", title: "Disable WMP Network Sharing", desc: "Stops Windows Media Player network sharing service.", status: "preinstalled" },
  { id: "ServiceFax", title: "Disable Fax Service", desc: "Disables the Fax service — no one uses this in 2025.", status: "preinstalled" },
  { id: "ServiceRetailDemo", title: "Disable Retail Demo Service", desc: "Removes the demo mode service pre-installed on all Windows.", status: "preinstalled" },
  { id: "ServiceTabletInput", title: "Disable Tablet Input Panel Service", desc: "Disables tablet/touchscreen input service on desktop PCs.", status: "preinstalled" },
  { id: "ServiceMapsBroker", title: "Disable Maps Broker Service", desc: "Stops Maps data download service running in background.", status: "preinstalled" },
];

const PRIVACY: DebloatItem[] = [
  { id: "PrivacyTelemetry", title: "Disable All Telemetry (Level 0)", desc: "Sets telemetry to 0 (Security) — blocks all diagnostic uploads.", status: "preinstalled" },
  { id: "PrivacyActivityHistory", title: "Disable Activity History / Timeline", desc: "Stops Windows recording app usage history for Timeline.", status: "preinstalled" },
  { id: "PrivacyLocationTracking", title: "Disable Location Tracking", desc: "Disables the location platform — apps cannot request GPS data.", status: "preinstalled" },
  { id: "PrivacyAdvertisingID", title: "Disable Advertising ID", desc: "Clears and disables the per-user ad tracking identifier.", status: "preinstalled" },
  { id: "PrivacyDiagFeedback", title: "Disable Diagnostic Feedback Prompts", desc: "Prevents Windows from sending error reports and feedback.", status: "preinstalled" },
];

const WIN11_ITEMS: DebloatItem[] = [
  { id: "Win11TeamsChat", title: "Remove Teams Chat (Taskbar)", desc: "Removes the Teams Chat button from the Win11 taskbar — saves 50–80MB RAM.", status: "preinstalled" },
  { id: "Win11Widgets", title: "Remove Widgets Panel", desc: "Uninstalls the Widgets (news/weather) panel from the taskbar.", status: "preinstalled" },
  { id: "Win11Copilot", title: "Disable Copilot AI Sidebar", desc: "Removes the Windows Copilot AI button and disables its background service.", status: "preinstalled" },
  { id: "Win11StartRecommended", title: "Remove Start Menu Recommendations", desc: "Disables 'Recommended' file suggestions in the Win11 Start Menu.", status: "preinstalled" },
  { id: "Win11AdsInStart", title: "Remove Ads from Start Menu", desc: "Disables Microsoft app suggestions and ads shown in the Start Menu.", status: "preinstalled" },
  { id: "Win11EdgeSidebar", title: "Disable Edge Sidebar & Shopping Suggestions", desc: "Removes Edge's built-in AI sidebar and shopping recommendation service.", status: "preinstalled" },
  { id: "Win11ChatIcon", title: "Remove Chat Icon from Taskbar", desc: "Removes the Chat/Teams icon from the taskbar notification area.", status: "preinstalled" },
  { id: "Win11OneDriveBackup", title: "Disable OneDrive Backup Nagging", desc: "Stops the OneDrive 'Back up your folders' pop-up that appears on every login.", status: "preinstalled" },
  { id: "Win11BingSearch", title: "Disable Bing AI in Search", desc: "Removes Bing search integration from Start/Search — makes local search only.", status: "preinstalled" },
  { id: "Win11NotepadAI", title: "Disable Notepad AI Features", desc: "Disables AI Rewrite and auto-suggest in Windows 11 Notepad.", status: "likely" },
  { id: "Win11Snap", title: "Disable Snap Layout Suggestions", desc: "Removes snap layout hover tooltips and suggestions — keeps snapping, removes nag.", status: "preinstalled" },
  { id: "Win11TPMAlert", title: "Disable TPM / Security Health Alerts", desc: "Stops security health notification center from generating TPM/Secure Boot alerts.", status: "preinstalled" },
  { id: "Win11DeviceEncryption", title: "Disable Auto BitLocker Encryption", desc: "Prevents Windows from auto-encrypting drives on consumer SKUs — avoids recovery key surprises.", status: "likely" },
  { id: "Win11AutoHDR", title: "Disable Auto HDR (Gaming)", desc: "Turns off Auto HDR which can cause washed-out colors in some games.", status: "likely" },
];

export default function Debloat() {
  const { tweaks, setTweak, setAllTweaks } = useOptimizationStore();
  const osInfo = useOsDetection();
  const isWin11 = osInfo.isWindows11;

  const allWin10Keys = [...WIN10_APPS, ...SERVICES, ...PRIVACY].map(i => i.id);
  const allWin11Keys = WIN11_ITEMS.map(i => i.id);

  const handleNukeAll = () => {
    const nuked: Record<string, boolean> = { ...useOptimizationStore.getState().tweaks };
    allWin10Keys.forEach(k => nuked[k] = true);
    setAllTweaks(nuked);
  };

  const handleNukeWin11 = () => {
    const nuked: Record<string, boolean> = { ...useOptimizationStore.getState().tweaks };
    allWin11Keys.forEach(k => nuked[k] = true);
    setAllTweaks(nuked);
  };

  const DebloatSection = ({ title, items }: { title: string; items: DebloatItem[] }) => (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">{title}</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className={cn(
              "flex flex-row items-center justify-between rounded-lg border p-4 transition-all duration-200 group",
              tweaks[item.id]
                ? "bg-red-500/5 border-red-500/25"
                : "bg-black/40 border-white/5 hover:border-white/10 hover:bg-black/60"
            )}
          >
            <div className="flex-1 min-w-0 mr-4 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-sm font-medium", tweaks[item.id] ? "text-white" : "text-zinc-300")}>
                  {item.title}
                </span>
                <LikelihoodBadge status={item.status} />
                {tweaks[item.id] && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">ON</span>
                )}
              </div>
              <p className="text-xs text-zinc-500">{item.desc}</p>
            </div>
            <button
              data-testid={`toggle-debloat-${item.id}`}
              onClick={() => setTweak(item.id, !tweaks[item.id])}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none",
                tweaks[item.id] ? "bg-red-600" : "bg-zinc-700"
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                tweaks[item.id] ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Windows Debloat</h1>
            <p className="text-zinc-500 text-sm">Remove bloatware, telemetry, and unnecessary services — Win10 & Win11</p>
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-zinc-900/60 border border-white/5 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Pre-installed on all Windows PCs</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-400" /> Usually present on most PCs</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Optional / edition-specific</span>
        </motion.div>

        <TabSmartBar
          tweakIds={ALL_DEBLOAT_IDS}
          recommendedIds={DEBLOAT_RECOMMENDED_IDS}
          label="Debloat"
          context="Debloat removes UWP apps and disables background services via PowerShell. Apps are uninstalled only for the current user — no system files are touched. All services can be re-enabled from Services.msc."
          tips={[
            "DiagTrack (Telemetry) is the #1 privacy fix — it constantly uploads usage data to Microsoft servers.",
            "Win11: Disable Copilot, Widgets, and Bing Search for the biggest UI and RAM improvement.",
            "SysMain (Superfetch) is fine to disable if you have an NVMe/SSD — it only helps on HDDs.",
          ]}
        />

        {/* Warning + Enable All */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-zinc-500 shrink-0" />
            <p className="text-sm text-zinc-300">
              Removes <strong className="text-white">AppX packages</strong> and disables services permanently. A <strong className="text-white">restore point is recommended</strong> first.
            </p>
          </div>
          <Button data-testid="button-nuke-all" onClick={handleNukeAll}
            className="ml-4 shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 px-4">
            ENABLE ALL (WIN10)
          </Button>
        </motion.div>

        
        <div className="space-y-8">
          <DebloatSection title="Microsoft UWP Bloatware" items={WIN10_APPS} />
          <DebloatSection title="Background Services" items={SERVICES} />
          <DebloatSection title="Privacy & Tracking" items={PRIVACY} />
        </div>

        
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-zinc-900 rounded-lg border border-white/5">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-bold">Windows 11 Smart Debloat</h2>
                  {!osInfo.loading && (
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold border",
                      isWin11
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    )}>
                      {isWin11 ? "DETECTED ON YOUR PC" : "NOT DETECTED"}
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-sm mt-0.5">Taskbar Copilot, Widgets, Teams Chat, Start Menu ads, and more Win11-specific bloat</p>
              </div>
            </div>
            <Button data-testid="button-nuke-win11" onClick={handleNukeWin11}
              variant="outline"
              className="shrink-0 border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-400 text-xs font-bold px-4">
              ENABLE ALL (WIN11)
            </Button>
          </div>

          {!isWin11 && !osInfo.loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-400">
                Your system was detected as <span className="text-white font-medium">{osInfo.os}</span>. 
                These tweaks are designed for Windows 11 — they will still be included in the script if enabled, 
                but some may not apply on Win10.
              </p>
            </motion.div>
          )}

          <DebloatSection title="Windows 11 Bloatware & UI Junk" items={WIN11_ITEMS} />
        </div>
      </div>
    </AppLayout>
  );
}
