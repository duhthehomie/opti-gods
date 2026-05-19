import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TabSmartBar } from "@/components/tab-smart-bar";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Power, AlertTriangle, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STARTUP_SAVINGS: Record<string, number> = {
  su_discord: 3.2, su_spotify: 2.8, su_steam: 2.1, su_onedrive: 3.5,
  su_teams: 4.1, su_skype: 1.8, su_zoom: 2.2, su_rtss: 0.4,
  su_msiab: 0.3, su_nvidia: 1.9, su_ccleaner: 0.9, su_realtek: 0.5,
  su_logitech: 1.1, su_corsair: 1.2, su_amdradeon: 1.7,
  su_ea_app: 2.4, su_epic: 2.0, su_ubisoft: 1.6, su_battlenet: 1.8,
  su_razer: 1.3, su_chrome: 1.1, su_firefox: 0.9, su_edge_startup: 1.4, su_obs: 0.6,
};

const ALL_STARTUP_IDS = Object.keys(STARTUP_SAVINGS);
const RECOMMENDED_DISABLE_IDS = [
  "su_discord","su_spotify","su_onedrive","su_teams","su_skype","su_zoom","su_ccleaner","su_amdradeon",
  "su_ea_app","su_epic","su_ubisoft","su_battlenet","su_razer","su_chrome","su_firefox","su_edge_startup",
];

const ALL_STARTUP_APPS = [
  { id: "su_discord", name: "Discord", path: "AppData\\Local\\Discord\\Update.exe", impact: "High", essential: false },
  { id: "su_spotify", name: "Spotify", path: "AppData\\Roaming\\Spotify\\Spotify.exe", impact: "High", essential: false },
  { id: "su_steam", name: "Steam", path: "Program Files (x86)\\Steam\\steam.exe", impact: "Medium", essential: false },
  { id: "su_onedrive", name: "OneDrive", path: "Windows\\SysWOW64\\OneDriveSetup.exe", impact: "High", essential: false },
  { id: "su_teams", name: "Microsoft Teams", path: "AppData\\Local\\Microsoft\\Teams\\Update.exe", impact: "High", essential: false },
  { id: "su_skype", name: "Skype", path: "Program Files\\WindowsApps\\Microsoft.SkypeApp\\Skype.exe", impact: "Medium", essential: false },
  { id: "su_zoom", name: "Zoom", path: "AppData\\Roaming\\Zoom\\bin\\Zoom.exe", impact: "Medium", essential: false },
  { id: "su_rtss", name: "RivaTuner Statistics Server", path: "Program Files (x86)\\RivaTuner Statistics Server\\RTSS.exe", impact: "Low", essential: true },
  { id: "su_msiab", name: "MSI Afterburner", path: "Program Files (x86)\\MSI Afterburner\\MSIAfterburner.exe", impact: "Low", essential: true },
  { id: "su_nvidia", name: "NVIDIA GeForce Experience", path: "Program Files\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe", impact: "Medium", essential: false },
  { id: "su_ccleaner", name: "CCleaner", path: "Program Files\\CCleaner\\CCleaner64.exe", impact: "Low", essential: false },
  { id: "su_realtek", name: "Realtek HD Audio Manager", path: "Windows\\System32\\RtkNGUI64.exe", impact: "Low", essential: false },
  { id: "su_logitech", name: "Logitech G HUB", path: "Program Files\\LGHUB\\lghub.exe", impact: "Medium", essential: true },
  { id: "su_corsair", name: "Corsair iCUE", path: "Program Files (x86)\\Corsair\\CORSAIR iCUE 4 Software\\iCUE.exe", impact: "Medium", essential: false },
  { id: "su_amdradeon", name: "AMD Radeon Software", path: "Program Files\\AMD\\CNext\\CNext\\RadeonSoftware.exe", impact: "Medium", essential: false },
  // Game launchers
  { id: "su_ea_app", name: "EA App", path: "Program Files\\Electronic Arts\\EA Desktop\\EA Desktop\\EADesktop.exe", impact: "High", essential: false },
  { id: "su_epic", name: "Epic Games Launcher", path: "Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe", impact: "High", essential: false },
  { id: "su_ubisoft", name: "Ubisoft Connect", path: "Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\UbisoftConnect.exe", impact: "Medium", essential: false },
  { id: "su_battlenet", name: "Battle.net", path: "Program Files (x86)\\Battle.net\\Battle.net.exe", impact: "Medium", essential: false },
  // Peripheral / hardware
  { id: "su_razer", name: "Razer Synapse", path: "Program Files (x86)\\Razer\\Synapse3\\WPFUI\\Framework\\RzSynapse.exe", impact: "Medium", essential: false },
  // Browsers (startup boost waste)
  { id: "su_chrome", name: "Google Chrome (Startup Boost)", path: "Program Files\\Google\\Chrome\\Application\\chrome.exe --no-startup-window", impact: "Medium", essential: false },
  { id: "su_firefox", name: "Mozilla Firefox (Background Agent)", path: "Program Files\\Mozilla Firefox\\firefox.exe -background-task", impact: "Low", essential: false },
  { id: "su_edge_startup", name: "Microsoft Edge (Startup Boost)", path: "Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe --no-startup-window", impact: "Medium", essential: false },
  // Streaming
  { id: "su_obs", name: "OBS Studio", path: "Program Files\\obs-studio\\bin\\64bit\\obs64.exe", impact: "Low", essential: false },
];

const IMPACT_COLOR: Record<string, string> = {
  High: "text-red-400 bg-red-500/10 border-red-500/30",
  Medium: "text-zinc-300 bg-zinc-500/10 border-zinc-600/30",
  Low: "text-zinc-500 bg-zinc-700/10 border-zinc-700/30",
};

interface DetectedStartupApp {
  name: string;
  path: string;
  type: string;
}

export default function StartupApps() {
  const { toast } = useToast();
  const { tweaks, setTweak, setAllTweaks } = useOptimizationStore();
  const [detectedApps, setDetectedApps] = useState<DetectedStartupApp[]>([]);
  const [scanning, setScanning] = useState(false);

  // Fetch and display actual startup apps scan script
  const handleScanStartupApps = async () => {
    setScanning(true);
    try {
      const response = await fetch(apiUrl('/api/startup/scan'), { headers: getNativeAuthHeaders() });
      const ps1Script = await response.text();
      
      // Download the scan script for user to run
      const blob = new Blob([ps1Script], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scan-startup-apps.ps1";
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Scan script downloaded",
        description: "Run scan-startup-apps.ps1 in PowerShell to detect all startup apps. Output will be JSON you can paste back here."
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to download scan script" });
    } finally {
      setScanning(false);
    }
  };

  const disabledCount = ALL_STARTUP_APPS.filter(a => tweaks[a.id]).length;
  const savedSeconds = ALL_STARTUP_IDS
    .filter(id => tweaks[id])
    .reduce((sum, id) => sum + (STARTUP_SAVINGS[id] || 0), 0);

  const handleDisableAll = () => {
    const next: Record<string, boolean> = { ...useOptimizationStore.getState().tweaks };
    ALL_STARTUP_APPS.forEach(a => {
      if (!a.essential) next[a.id] = true;
    });
    setAllTweaks(next);
    toast({ title: "Disabled all non-essential apps", description: "Essential apps (MSI Afterburner, RTSS, etc.) were kept." });
  };

  const handleEnableAll = () => {
    const next: Record<string, boolean> = { ...useOptimizationStore.getState().tweaks };
    ALL_STARTUP_APPS.forEach(a => { next[a.id] = false; });
    setAllTweaks(next);
    toast({ title: "Enabled all startup apps" });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Power className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Startup Applications</h1>
            <p className="text-zinc-500 text-sm">Disable unnecessary apps from launching on boot — cuts boot time and idle RAM</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 flex items-start gap-3 justify-between"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-400 mb-1">Scan for All Startup Apps</p>
            <p className="text-xs text-zinc-400">Run a PowerShell scan to detect ALL startup apps currently on your system — including ones not in this list.</p>
          </div>
          <Button
            onClick={handleScanStartupApps}
            disabled={scanning}
            variant="outline"
            size="sm"
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 shrink-0 whitespace-nowrap"
            data-testid="button-scan-startup"
          >
            {scanning ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Scanning...
              </>
            ) : (
              "Download Scan Script"
            )}
          </Button>
        </motion.div>

        <TabSmartBar
          tweakIds={ALL_STARTUP_IDS}
          recommendedIds={RECOMMENDED_DISABLE_IDS}
          label="Startup Apps"
          applyLabel={`Disable ${RECOMMENDED_DISABLE_IDS.filter(id => !tweaks[id]).length} Recommended`}
          context="Disabling startup apps prevents them from launching automatically with Windows. Your data and settings are preserved — you can still open apps manually. Essential peripheral apps (Afterburner, RTSS, Logitech) are protected."
          tips={[
            "Microsoft Teams and OneDrive are the biggest offenders — each adds 3–4 seconds to boot time.",
            "Discord, Spotify, and Zoom all start hidden in the tray and use RAM even if you never open them.",
            "MSI Afterburner and RTSS are marked ESSENTIAL — keep them if you use GPU monitoring or frame caps.",
          ]}
        />

        {savedSeconds > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-green-500/5 border border-green-500/15"
          >
            <Clock className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-400">
                ~{savedSeconds.toFixed(1)}s faster boot
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Estimated time saved per startup with {disabledCount} app{disabledCount !== 1 ? "s" : ""} disabled
              </p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/80 border border-zinc-800"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-zinc-500 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300 font-medium">
                {disabledCount} app{disabledCount !== 1 ? "s" : ""} currently disabled from startup
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">Red toggle = DISABLED on boot. Gray = will autostart normally.</p>
            </div>
          </div>
          <div className="flex gap-2 ml-4 shrink-0">
            <Button
              data-testid="button-enable-all"
              onClick={handleEnableAll}
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-white/5 text-xs"
            >
              Enable All
            </Button>
            <Button
              data-testid="button-disable-all"
              onClick={handleDisableAll}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Disable Non-Essential
            </Button>
          </div>
        </motion.div>

        <div className="space-y-2">
          {ALL_STARTUP_APPS.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              data-testid={`row-startup-${app.id}`}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
                tweaks[app.id]
                  ? "bg-black/50 border-red-500/20"
                  : "bg-black/40 border-white/5 hover:border-white/10"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-medium text-sm", tweaks[app.id] ? "text-zinc-400 line-through" : "text-white")}>
                    {app.name}
                  </h3>
                  {app.essential && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
                      ESSENTIAL
                    </span>
                  )}
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border", IMPACT_COLOR[app.impact])}>
                    {app.impact.toUpperCase()} IMPACT
                  </span>
                </div>
                <p className="text-xs text-zinc-600 font-mono truncate">
                  {app.path.startsWith("AppData\\Local\\") ? `%LocalAppData%\\${app.path.slice("AppData\\Local\\".length)}` : app.path.startsWith("AppData\\Roaming\\") ? `%AppData%\\${app.path.slice("AppData\\Roaming\\".length)}` : `C:\\${app.path}`}
                </p>
              </div>

              <button
                data-testid={`toggle-startup-${app.id}`}
                onClick={() => setTweak(app.id, !tweaks[app.id])}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none",
                  tweaks[app.id] ? "bg-red-600" : "bg-zinc-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                    tweaks[app.id] ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
