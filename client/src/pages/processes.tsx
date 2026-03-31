import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { TweakRow } from "@/components/tweak-row";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useToast } from "@/hooks/use-toast";
import { PageGuide } from "@/components/page-guide";
import {
  Server, Zap, CheckCircle2, AlertTriangle, ShieldAlert, ScanSearch, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Impact = "HIGH" | "MED" | "LOW";

interface ServiceTweak {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  impact?: Impact;
  recommended?: boolean;
  warning?: string;
}

const TELEMETRY_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_DiagTrack",
    title: "DiagTrack — Connected User Experiences & Telemetry",
    desc: "Sends usage data and diagnostics to Microsoft continuously in the background. Setting to Manual stops it from auto-starting at boot.",
    badge: "RECOMMENDED",
    impact: "HIGH",
    recommended: true,
  },
  {
    id: "ProcSvc_WerSvc",
    title: "WerSvc — Windows Error Reporting",
    desc: "Uploads crash dumps and error reports to Microsoft. Safe to set Manual — no impact on system stability.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_DPS",
    title: "DPS — Diagnostics Policy Service",
    desc: "Runs background hardware and network diagnostics. Not needed for gaming — consumes CPU cycles in the background.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_DusmSvc",
    title: "DusmSvc — Data Usage Monitoring",
    desc: "Tracks per-app network data usage for metered connections. Useless on unlimited home internet connections.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_DoSvc",
    title: "DoSvc — Delivery Optimization",
    desc: "Downloads Windows Updates and app packages using P2P. Uses background bandwidth. Manual stops it when not updating.",
    impact: "MED",
    recommended: true,
  },
];

const XBOX_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_XblAuth",
    title: "XblAuthManager — Xbox Live Auth Manager",
    desc: "Handles Xbox Live authentication tokens. If you don't use Xbox Live / Game Pass, this can safely be set to Manual.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_XblGame",
    title: "XblGameSave — Xbox Live Game Save",
    desc: "Syncs game saves to Xbox Live cloud. Safe to set Manual if you don't use Xbox cloud saves.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_XboxNet",
    title: "XboxNetApiSvc — Xbox Live Networking Service",
    desc: "Handles Xbox Live party chat and multiplayer matchmaking APIs. Set to Manual if not using Xbox apps.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_XboxGip",
    title: "XboxGipSvc — Xbox Accessory Management",
    desc: "Manages Xbox controller firmware and accessories. Set to Manual — starts on demand when controller is connected.",
    impact: "LOW",
  },
];

const NETWORK_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_SSDP",
    title: "SSDPSRV + UPnP — Device Discovery",
    desc: "SSDP Discovery and UPnP Device Host — used for auto-discovering network printers, TVs, and smart devices. Useless on pure gaming PCs.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_FDServices",
    title: "FDResPub + fdPHost — Function Discovery",
    desc: "Publishes your PC to the local network for device discovery (printers, media servers). Safe to disable on standalone gaming PCs.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_Lltdsvc",
    title: "lltdsvc — Link Layer Topology Discovery",
    desc: "Used to build network topology maps (the network map in older Windows versions). Completely useless for gaming.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_SharedAccess",
    title: "SharedAccess — Internet Connection Sharing",
    desc: "Enables sharing your internet connection with other devices. If you're not using your PC as a hotspot/router, this is useless.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_WinRM",
    title: "WinRM — Windows Remote Management",
    desc: "Allows remote management of your PC over the network. Unnecessary and a mild security risk on home PCs.",
    impact: "LOW",
    recommended: true,
  },
];

const HARDWARE_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_WbioSrvc",
    title: "WbioSrvc — Windows Biometric Service",
    desc: "Manages fingerprint readers and Windows Hello face recognition. Safe to set Manual if you use a PIN or password to log in.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_TabletInput",
    title: "TabletInputService — Tablet Input Service",
    desc: "Touch keyboard and handwriting recognition. Not needed on desktop gaming PCs without a touchscreen.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_BthServ",
    title: "bthserv — Bluetooth Support Service",
    desc: "Bluetooth stack service. Set to Manual if you don't use Bluetooth devices — it will start on-demand when needed.",
    impact: "LOW",
    warning: "Only set Manual if you don't use a Bluetooth headset, controller, or mouse.",
  },
];

const LEGACY_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_Fax",
    title: "Fax — Windows Fax Service",
    desc: "Enables sending and receiving faxes. No gaming PC in 2025 needs this running.",
    impact: "LOW",
    badge: "RECOMMENDED",
    recommended: true,
  },
  {
    id: "ProcSvc_MapsBroker",
    title: "MapsBroker — Downloaded Maps Manager",
    desc: "Keeps offline maps updated. Useless if you don't use the Windows Maps app.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_lfsvc",
    title: "lfsvc — Geolocation Service",
    desc: "Provides location data to apps. Set Manual unless you use Windows apps that need your GPS location.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_PhoneSvc",
    title: "PhoneSvc — Phone Service",
    desc: "Manages VoIP and phone calls from Windows. Useless on standard gaming PCs.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_RetailDemo",
    title: "RetailDemo — Retail Demo Service",
    desc: "Microsoft's store demo mode service. Absolutely no purpose on a personal PC.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_WMPNet",
    title: "WMPNetworkSvc — Windows Media Player Network",
    desc: "Shares Windows Media Player libraries over the network. Useless if you don't use WMP for media sharing.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_TrkWks",
    title: "TrkWks — Distributed Link Tracking Client",
    desc: "Tracks NTFS shortcuts between drives on a network. Completely useless on standalone home PCs.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_W32Time",
    title: "W32Time — Windows Time",
    desc: "Syncs your system clock with internet time servers. Safe to set Manual — clock still syncs on-demand when you open date/time settings.",
    impact: "LOW",
  },
];

const BACKGROUND_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_BITS",
    title: "BITS — Background Intelligent Transfer",
    desc: "Used by Windows Update and other apps to download files in the background using spare bandwidth. Setting Manual stops it when idle.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_WSearch",
    title: "WSearch — Windows Search (Indexing)",
    desc: "Indexes your files for fast Start Menu search. Constant disk I/O. Set Manual if you use Everything or rarely use Windows search.",
    impact: "HIGH",
    recommended: true,
    badge: "HIGH IMPACT",
  },
  {
    id: "ProcSvc_SysMain",
    title: "SysMain — Superfetch / Prefetch",
    desc: "Pre-loads frequently used apps into RAM. Useful on HDDs, wasteful on NVMe/SSD systems. Set Manual if you have SSD + 16GB+ RAM.",
    impact: "HIGH",
    recommended: true,
    badge: "16GB+ SSD",
  },
  {
    id: "ProcSvc_RemoteReg",
    title: "RemoteRegistry — Remote Registry",
    desc: "Allows remote editing of this PC's registry over the network. Security risk — no home user needs this.",
    badge: "SECURITY",
    impact: "LOW",
    recommended: true,
  },
];

const CLOUD_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_OneSyncSvc",
    title: "OneSyncSvc — Cloud Sync Platform",
    desc: "Syncs your Microsoft account mail, contacts, calendar, and settings from the cloud at boot. Gaming PCs don't need this running constantly in the background.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_CDPSvc",
    title: "CDPSvc — Connected Devices Platform",
    desc: "Pairs your PC with your phone and tablet for cross-device notifications. Spawns multiple worker processes. Safe to set Manual on standalone gaming PCs.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_WpnService",
    title: "WpnService — Windows Push Notifications",
    desc: "Maintains push notification connections for UWP apps (Store apps). Spawns WpnUserService worker threads. Set Manual to stop constant cloud polling.",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_cbdhsvc",
    title: "cbdhsvc — Clipboard User Service",
    desc: "Powers Win+V clipboard history that syncs clipboard across devices. If you never use clipboard history, this runs for nothing.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_dmwappushsvc",
    title: "dmwappushsvc — WAP Push / MDM Router",
    desc: "Routes WAP push messages for enterprise Mobile Device Management. Home gaming PCs have absolutely zero use for this service.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_PushToInstall",
    title: "PushToInstall — Windows Store Remote Install",
    desc: "Lets you push-install apps to your PC from the Microsoft Store app on your phone. Completely unnecessary daemon on gaming PCs.",
    impact: "LOW",
    recommended: true,
  },
];

const IOT_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_AJRouter",
    title: "AJRouter — AllJoyn Router (IoT)",
    desc: "Implements the AllJoyn smart home IoT protocol for connected devices. Gaming PCs have zero use for IoT routing — this is pure wasted overhead.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_SharedRealitySvc",
    title: "SharedRealitySvc — Mixed Reality Compositor",
    desc: "Windows HoloLens and Mixed Reality runtime service. Runs spatial data processing in the background. Irrelevant on all standard gaming PCs.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_icssvc",
    title: "icssvc — Windows Mobile Hotspot",
    desc: "Manages internet sharing from your PC to other devices via Wi-Fi hotspot. If your PC isn't a hotspot, this process runs for nothing.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_WFDSConMgr",
    title: "WFDSConMgrSvc — Wi-Fi Direct Services",
    desc: "Manages Miracast and Wi-Fi Direct wireless display connections. Useless on desktop gaming rigs not connected to wireless displays.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_p2pimsvc",
    title: "p2pimsvc + PNRPsvc — Peer-to-Peer Networking",
    desc: "Legacy Windows peer-to-peer discovery and name resolution protocols. Not used by any modern game or app. Both services stopped together.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
];

const ENTERPRISE_SERVICES: ServiceTweak[] = [
  {
    id: "ProcSvc_EapHost",
    title: "EapHost — Extensible Authentication Protocol",
    desc: "Enterprise WPA2-Enterprise and RADIUS 802.1X authentication. Home Wi-Fi uses WPA2-Personal — this service is never needed on home gaming PCs.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_seclogon",
    title: "seclogon — Secondary Logon",
    desc: "Allows running programs as a different user (Run As). Rarely used by home gamers. Starts on-demand if ever needed — safe to set Manual.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_SCardSvr",
    title: "SCardSvr + ScDeviceEnum — Smart Card Services",
    desc: "Enterprise smart card reader hardware stack. No home gaming PC uses smart cards. Both services stopped and set to Manual together.",
    badge: "RECOMMENDED",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_AppReadiness",
    title: "AppReadiness — App Readiness at Login",
    desc: "Prepares UWP apps during user login on first boot. Wasteful on already-configured gaming PCs — adds latency to every login with no benefit.",
    impact: "LOW",
    recommended: true,
  },
  {
    id: "ProcSvc_PcaSvc",
    title: "PcaSvc — Program Compatibility Assistant",
    desc: "Monitors every app launch for compatibility issues with old Windows versions. Checks every crash, every new install. Pure CPU overhead on modern software.",
    badge: "RECOMMENDED",
    impact: "MED",
    recommended: true,
  },
  {
    id: "ProcSvc_PrintNotify",
    title: "PrintNotify — Printer Extension Notifications",
    desc: "Handles printer status pop-ups and extension UIs. Useless if you don't have an active printer attached. Starts on-demand if a printer is connected.",
    impact: "LOW",
    recommended: true,
  },
];

const ALL_TWEAKS = [
  ...TELEMETRY_SERVICES,
  ...XBOX_SERVICES,
  ...NETWORK_SERVICES,
  ...HARDWARE_SERVICES,
  ...LEGACY_SERVICES,
  ...BACKGROUND_SERVICES,
  ...CLOUD_SERVICES,
  ...IOT_SERVICES,
  ...ENTERPRISE_SERVICES,
];

const APPLY_ALL_ID = "ProcSvc_ApplyAll";

export default function ProcessesPage() {
  const { tweaks, setTweak, setAllTweaks } = useOptimizationStore();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);

  const handleSmartScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/processes/smart-scan');
      const ps1 = await res.text();
      const blob = new Blob([ps1], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "optigods-smart-scan.ps1";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Smart Scan script downloaded",
        description: "Run optigods-smart-scan.ps1 as Administrator — it scans 47+ services and shows your process count before and after.",
      });
    } catch {
      toast({ title: "Error", description: "Failed to download scan script", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const activeCount = ALL_TWEAKS.filter(t => tweaks[t.id]).length;
  const recommendedIds = ALL_TWEAKS.filter(t => t.recommended).map(t => t.id);
  const allRecommendedOn = recommendedIds.length > 0 && recommendedIds.every(id => tweaks[id]);

  function handleEnableRecommended() {
    const updates: Record<string, boolean> = {};
    recommendedIds.forEach(id => { updates[id] = true; });
    updates[APPLY_ALL_ID] = true;
    setAllTweaks({ ...tweaks, ...updates });
    toast({
      title: "Recommended services set to Manual",
      description: `${recommendedIds.length} non-essential services will be stopped at next boot`,
    });
  }

  function renderSection(title: string, items: ServiceTweak[], color: string = "text-red-500") {
    const sectionActive = items.filter(t => tweaks[t.id]).length;
    const sectionRec = items.filter(t => t.recommended && !tweaks[t.id]);

    return (
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-3">
            <h2 className={cn("text-sm font-bold uppercase tracking-wider", color)}>{title}</h2>
            {sectionActive > 0 && (
              <span className="text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded">
                {sectionActive}/{items.length} active
              </span>
            )}
          </div>
          {sectionRec.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const updates: Record<string, boolean> = {};
                sectionRec.forEach(t => { updates[t.id] = true; });
                setAllTweaks({ ...tweaks, ...updates });
              }}
              data-testid={`button-enable-recommended-${title.replace(/\s+/g, '-').toLowerCase()}`}
              className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 h-auto rounded-md transition-all"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Enable Rec ({sectionRec.length})
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.id}>
              {item.warning && (
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-500">{item.warning}</span>
                </div>
              )}
              <TweakRow
                id={item.id}
                title={item.title}
                description={item.desc}
                badge={item.badge}
                impact={item.impact}
                checked={tweaks[item.id] || false}
                onCheckedChange={(v) => setTweak(item.id, v)}
                delay={i + 1}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10 text-white">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Server className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Processes Reduction</h1>
            <p className="text-zinc-500 text-sm">Set non-essential Windows services to Manual — fewer background processes, more resources for games</p>
          </div>
        </motion.div>

        <PageGuide pageName="Processes Reduction" />

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 flex items-start gap-3"
        >
          <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
            <p className="text-blue-300 font-semibold">Manual vs Disabled — what's the difference?</p>
            <p>
              <strong className="text-white">Manual</strong> — Service won't auto-start at boot, but Windows can still start it on-demand if an app needs it. Safer and reversible.
            </p>
            <p>
              <strong className="text-white">Disabled</strong> — Service is completely blocked. This page only uses Manual for maximum safety and compatibility.
            </p>
          </div>
        </motion.div>

        {/* One-click apply all recommended */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-red-500/20 bg-zinc-900/60 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Zap className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Apply All Recommended</p>
                <p className="text-xs text-zinc-500">
                  Sets {recommendedIds.length} non-essential services to Manual in one click —
                  safe for all gaming PCs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <span className="text-xs text-red-400 font-bold">{activeCount} selected</span>
              )}
              <Button
                data-testid="button-apply-all-services-manual"
                onClick={handleEnableRecommended}
                disabled={allRecommendedOn}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 text-xs font-bold gap-1.5 disabled:opacity-50"
                size="sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {allRecommendedOn ? "All Applied" : "Apply All Recommended"}
              </Button>
            </div>
          </div>

          {/* One-click bulk toggle */}
          <div className="border-t border-white/5 px-5 py-3">
            <TweakRow
              id={APPLY_ALL_ID}
              title="Bulk: Set ALL listed services to Manual (47+ service groups)"
              description="Runs a single PowerShell command that sets all 47+ service groups on this page to Manual startup in one shot. Handles per-user service instances (cbdhsvc, WpnUserService, etc.) automatically. Equivalent to enabling every toggle above."
              badge="BULK"
              impact="HIGH"
              checked={tweaks[APPLY_ALL_ID] || false}
              onCheckedChange={(v) => setTweak(APPLY_ALL_ID, v)}
              delay={0}
            />
          </div>
        </motion.div>

        {/* Smart Scan Card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-xl border border-cyan-500/20 bg-zinc-900/60 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <ScanSearch className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Smart Process Scan</p>
                <p className="text-xs text-zinc-500">
                  Downloads a PS1 script that scans all 47+ services, shows your process count before and after, and auto-applies every safe optimization
                </p>
              </div>
            </div>
            <Button
              data-testid="button-smart-scan-download"
              onClick={handleSmartScan}
              disabled={scanning}
              className="bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-500/30 text-xs font-bold gap-1.5 disabled:opacity-50 shrink-0"
              size="sm"
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
              {scanning ? "Generating…" : "Download Smart Scan .ps1"}
            </Button>
          </div>
          <div className="border-t border-white/5 px-5 py-2.5 bg-zinc-950/40">
            <p className="text-[11px] text-zinc-500">
              Run as <span className="text-white font-semibold">Administrator</span> in PowerShell.
              The script prints <span className="text-green-400">[OK]</span> for already-optimal services and <span className="text-green-400">[SET]</span> for ones it changes.
              Restart PC after for full effect.
            </p>
          </div>
        </motion.div>

        {/* Individual service sections */}
        <div className="space-y-8">
          {renderSection("Telemetry & Diagnostics", TELEMETRY_SERVICES)}
          {renderSection("Xbox & Gaming Services", XBOX_SERVICES, "text-green-500")}
          {renderSection("Network Discovery Services", NETWORK_SERVICES, "text-blue-500")}
          {renderSection("Hardware & Input Services", HARDWARE_SERVICES, "text-purple-500")}
          {renderSection("Legacy & Unused Services", LEGACY_SERVICES, "text-amber-500")}
          {renderSection("Background Update Services", BACKGROUND_SERVICES, "text-orange-500")}
          {renderSection("Cloud & Notification Services", CLOUD_SERVICES, "text-cyan-500")}
          {renderSection("IoT, Remote & Legacy Network", IOT_SERVICES, "text-violet-400")}
          {renderSection("Enterprise & System Misc", ENTERPRISE_SERVICES, "text-rose-400")}
        </div>

      </div>
    </AppLayout>
  );
}
