import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Debloat() {
  const { tweaks, setTweak, setAllTweaks } = useOptimizationStore();

  const debloatKeys = [
    "DebloatCortana","DebloatOneDrive","DebloatXboxApp","DebloatXboxGameBar","DebloatXboxIdentity",
    "DebloatBing","DebloatWeather","DebloatNews","DebloatMaps","DebloatSolitaire","DebloatMixedReality",
    "DebloatSkype","DebloatZune","DebloatOfficeHub","DebloatFeedback","DebloatGetHelp","DebloatGrooveMusic",
    "DebloatMSPaint3D","DebloatWindowsCamera","DebloatYourPhone",
    "ServiceDiagTrack","ServiceWSearch","ServiceSysMain","ServiceRemoteReg","ServiceWMPNetworkSvc",
    "PrivacyTelemetry","PrivacyActivityHistory","PrivacyLocationTracking","PrivacyAdvertisingID","PrivacyDiagFeedback",
  ];

  const handleNukeAll = () => {
    const nuked: Record<string, boolean> = { ...useOptimizationStore.getState().tweaks };
    debloatKeys.forEach(k => nuked[k] = true);
    setAllTweaks(nuked);
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
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Windows 10 Debloat</h1>
            <p className="text-zinc-500 text-sm">Remove Microsoft bloatware, telemetry, and unnecessary services</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 mb-6"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-zinc-300">
              These tweaks <strong className="text-white">remove AppX packages</strong> and disable services permanently. A restore point is recommended.
            </p>
          </div>
          <Button
            data-testid="button-nuke-all"
            onClick={handleNukeAll}
            className="ml-4 shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border border-red-500/30 px-4"
          >
            ENABLE ALL
          </Button>
        </motion.div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Microsoft UWP Bloatware</h2>
            <div className="space-y-3">
              {[
                { id: "DebloatCortana", title: "Remove Cortana", desc: "Uninstalls Cortana assistant package — saves ~200MB RAM at idle." },
                { id: "DebloatOneDrive", title: "Remove OneDrive", desc: "Unlinks and uninstalls OneDrive. Files stay intact unless synced-only." },
                { id: "DebloatXboxApp", title: "Remove Xbox App", desc: "Removes the Xbox companion app (separate from Game Bar/GameDVR)." },
                { id: "DebloatXboxGameBar", title: "Remove Xbox Game Bar", desc: "Uninstalls the Game Bar overlay from memory entirely." },
                { id: "DebloatXboxIdentity", title: "Remove Xbox Identity Provider", desc: "Stops Xbox authentication background service from running." },
                { id: "DebloatBing", title: "Remove Bing Search in Start", desc: "Disables online Bing results in the Start Menu search bar." },
                { id: "DebloatWeather", title: "Remove MSN Weather", desc: "Removes the MSN Weather app from your Start Menu and taskbar." },
                { id: "DebloatNews", title: "Remove Microsoft News", desc: "Uninstalls News app and disables related background fetch." },
                { id: "DebloatMaps", title: "Remove Windows Maps", desc: "Removes the Maps app and stops location sync services." },
                { id: "DebloatSolitaire", title: "Remove Solitaire Collection", desc: "Removes Solitaire + its auto-update background tasks." },
                { id: "DebloatMixedReality", title: "Remove Mixed Reality Portal", desc: "Removes the Mixed Reality / VR portal app entirely." },
                { id: "DebloatSkype", title: "Remove Skype (Built-in)", desc: "Removes the pre-installed Skype app from Windows." },
                { id: "DebloatZune", title: "Remove Groove Music / Zune", desc: "Removes legacy Groove Music (Zune) player." },
                { id: "DebloatOfficeHub", title: "Remove Office Hub", desc: "Removes the Office Hub / My Office UWP stub app." },
                { id: "DebloatFeedback", title: "Remove Feedback Hub", desc: "Removes the Feedback Hub app that sends data to Microsoft." },
                { id: "DebloatGetHelp", title: "Remove Get Help", desc: "Removes the Get Help / Contact Support app." },
                { id: "DebloatGrooveMusic", title: "Remove Movies & TV", desc: "Removes the Movies & TV app (Groove Video)." },
                { id: "DebloatMSPaint3D", title: "Remove Paint 3D", desc: "Removes Paint 3D while keeping classic MS Paint." },
                { id: "DebloatWindowsCamera", title: "Remove Windows Camera", desc: "Removes the default Camera UWP app." },
                { id: "DebloatYourPhone", title: "Remove Your Phone / Link to Windows", desc: "Removes the phone linking app and its background agent." },
              ].map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={(v) => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Background Services</h2>
            <div className="space-y-3">
              {[
                { id: "ServiceDiagTrack", title: "Disable DiagTrack (Telemetry)", desc: "Stops the Connected User Experiences and Telemetry service from sending data." },
                { id: "ServiceWSearch", title: "Disable Windows Search Indexer", desc: "Stops the WSearch service from consuming CPU/disk during indexing." },
                { id: "ServiceSysMain", title: "Disable SysMain (Superfetch)", desc: "Disables SysMain service — beneficial for NVMe/SSD users." },
                { id: "ServiceRemoteReg", title: "Disable Remote Registry", desc: "Prevents remote modification of registry — security and performance win." },
                { id: "ServiceWMPNetworkSvc", title: "Disable WMP Network Sharing", desc: "Stops Windows Media Player network sharing service." },
              ].map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={(v) => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-4 px-1">Privacy & Tracking</h2>
            <div className="space-y-3">
              {[
                { id: "PrivacyTelemetry", title: "Disable All Telemetry", desc: "Sets telemetry level to 0 (Security) — blocks all non-essential diagnostic uploads." },
                { id: "PrivacyActivityHistory", title: "Disable Activity History", desc: "Stops Windows from recording app usage history for Timeline." },
                { id: "PrivacyLocationTracking", title: "Disable Location Tracking", desc: "Disables the location platform so apps cannot request GPS data." },
                { id: "PrivacyAdvertisingID", title: "Disable Advertising ID", desc: "Clears and disables the per-user advertising tracking ID." },
                { id: "PrivacyDiagFeedback", title: "Disable Diagnostic Feedback", desc: "Prevents Windows from sending error reports and feedback data." },
              ].map((item, i) => (
                <TweakRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.desc}
                  checked={tweaks[item.id] || false}
                  onCheckedChange={(v) => setTweak(item.id, v)}
                  delay={i + 1}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
