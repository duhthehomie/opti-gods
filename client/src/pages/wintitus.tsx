import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Shield, Lock, Wrench, Eye, Cpu, Globe, Settings2, Trash2,
  AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Sparkles, Zap,
} from "lucide-react";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useToast } from "@/hooks/use-toast";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

interface TweakEntry {
  key: string;
  label: string;
  desc: string;
  recommended?: boolean;
  warning?: string;
}

interface SectionDef {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  border: string;
  bg: string;
  tweaks: TweakEntry[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "essential",
    label: "Essential Tweaks",
    icon: Shield,
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    tweaks: [
      { key: "WinTitusConsumerFeatures", label: "Disable Consumer Features", desc: "Stops Windows from silently installing sponsored apps and showing suggestions in Start Menu.", recommended: true },
      { key: "WinTitusHibernation", label: "Disable Hibernation", desc: "Removes hiberfil.sys — frees several GBs of drive space and speeds up shutdown.", recommended: true },
      { key: "WinTitusPosh7Telemetry", label: "Disable PowerShell 7 Telemetry", desc: "Opts out of PowerShell 7 and .NET CLI telemetry collection.", recommended: true },
      { key: "WinTitusWPBT", label: "Disable WPBT Execution", desc: "Prevents Windows Platform Binary Table from running OEM-injected code at boot.", recommended: true },
      { key: "WinTitusDiskCleanup", label: "Run Disk Cleanup", desc: "Queues Temp Files, Recycle Bin, Thumbnail Cache, and WER files for deletion.", recommended: true },
      { key: "WinTitusServicesManual", label: "Set Services to Manual", desc: "Sets 19 non-essential Windows services to manual — they only run when actually needed.", recommended: true },
      { key: "PrivacyActivityHistory", label: "Disable Activity History", desc: "Stops Windows from recording your app usage, browsing, and files for Timeline.", recommended: true },
      { key: "PrivacyLocationTracking", label: "Disable Location Tracking", desc: "Denies apps location access at the system consent level.", recommended: true },
      { key: "PrivacyTelemetry", label: "Disable Telemetry", desc: "Sets telemetry to 0 — minimum data sent to Microsoft.", recommended: true },
    ],
  },
  {
    id: "advanced",
    label: "Advanced Tweaks",
    icon: Wrench,
    color: "text-orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    tweaks: [
      { key: "WinTitusAdobeBlock", label: "Adobe Network Block", desc: "Blocks Adobe activation servers in the hosts file — stops Creative Cloud from phoning home.", recommended: true },
      { key: "WinTitusRazerBlock", label: "Block Razer Driver Auto-Install", desc: "Stops Windows Update from silently injecting Razer drivers when hardware is connected." },
      { key: "WinTitusBgApps", label: "Disable Background Apps", desc: "Globally prevents all UWP apps from running in the background.", recommended: true },
      { key: "WinTitusFullscreenOpt", label: "Disable Fullscreen Optimizations", desc: "Prevents Windows from intercepting fullscreen apps. Use borderless window instead.", recommended: true },
      { key: "Win11Copilot", label: "Disable Microsoft Copilot", desc: "Removes Copilot button from taskbar and disables Copilot policy." },
      { key: "WinTitusNotifTray", label: "Disable Notification Tray / Calendar", desc: "Hides Action Center and disables toast notifications." },
      { key: "WinTitusStorageSense", label: "Disable Storage Sense", desc: "Stops Windows from auto-deleting files without your explicit permission." },
      { key: "WinTitusTeredo", label: "Disable Teredo", desc: "Disables Teredo IPv6 tunneling — reduces network overhead on native IPv4 connections." },
      { key: "WinTitusEdgeDebloat", label: "Edge Debloat", desc: "Disables Edge background sync, shopping assistant, Rewards, and promotional tabs." },
      { key: "WinTitusIPv4Prefer", label: "Prefer IPv4 over IPv6", desc: "Sets DisabledComponents=0x20 — IPv4 wins routing decisions, IPv6 still available.", recommended: true },
      { key: "DebloatOneDrive", label: "Remove OneDrive", desc: "Runs the OneDrive uninstaller and removes it from startup." },
      {
        key: "WinTitusEdgeRemove", label: "Remove Microsoft Edge",
        desc: "Force-uninstalls Edge via its own installer. Install Brave first!",
        warning: "Install Brave (brave.com) BEFORE removing Edge — you need a browser to do anything after this.",
      },
      {
        key: "WinTitusXboxComponents", label: "Remove Xbox & Gaming Components",
        desc: "Removes Xbox app, Gaming Services, and Game Overlay packages.",
        warning: "Skip this if you use Xbox Game Pass, Xbox app, or any Xbox-linked service.",
      },
    ],
  },
  {
    id: "display",
    label: "Display & Explorer",
    icon: Eye,
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    tweaks: [
      { key: "WinTitusClassicMenu", label: "Classic Right-Click Menu (Win11)", desc: "Restores the full context menu in Windows 11 — no more clicking 'Show more options'.", recommended: true },
      { key: "WinTitusDisplayPerf", label: "Set Display for Best Performance", desc: "Strips all visual effects — disables shadows, animations, and fades in Explorer.", recommended: true },
      { key: "WinTitusShowExtensions", label: "Show File Extensions", desc: "Makes .exe, .bat, .ps1 visible in Explorer — important for security." },
      { key: "WinTitusShowHidden", label: "Show Hidden Files", desc: "Reveals hidden system files and folders in Explorer." },
    ],
  },
  {
    id: "privacy",
    label: "OO ShutUp10++ Privacy",
    icon: Lock,
    color: "text-violet-400",
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
    tweaks: [
      {
        key: "OOShutupPrivacy",
        label: "Apply OO ShutUp10++ Recommended Settings",
        desc: "Applies the 12 recommended registry changes from OO ShutUp10++ — covers telemetry, activity feed, advertising ID, location access, and app background permissions.",
        recommended: true,
      },
    ],
  },
];

function TweakRow({ tweak, enabled, onToggle }: { tweak: TweakEntry; enabled: boolean; onToggle: () => void }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all duration-150 cursor-pointer",
        enabled ? "bg-red-500/8 border-red-500/20" : "bg-black/30 border-white/5 hover:border-white/10"
      )}
      onClick={onToggle}
    >
      <button
        data-testid={`toggle-wt-${tweak.key}`}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
          enabled ? "bg-red-500 border-red-500" : "border-zinc-700"
        )}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white leading-snug">{tweak.label}</p>
          {tweak.recommended && (
            <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Recommended
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{tweak.desc}</p>
        {tweak.warning && (
          <div className="flex items-start gap-1.5 mt-1.5 px-2 py-1.5 rounded bg-amber-500/8 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300 leading-snug">{tweak.warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ section }: { section: SectionDef }) {
  const { tweaks, setTweak } = useOptimizationStore();
  const [collapsed, setCollapsed] = useState(false);
  const { toast } = useToast();

  const sectionKeys = section.tweaks.map((t) => t.key);
  const enabledCount = sectionKeys.filter((k) => tweaks[k]).length;

  const enableRecommended = () => {
    const recommended = section.tweaks.filter((t) => t.recommended);
    recommended.forEach((t) => setTweak(t.key, true));
    toast({ title: `${recommended.length} recommended tweaks enabled`, description: section.label });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border", section.border, collapsed ? "bg-black/30" : section.bg)}
    >
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setCollapsed((v) => !v)}>
        <section.icon className={cn("w-4 h-4 shrink-0", section.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{section.label}</p>
            {enabledCount > 0 && (
              <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">{enabledCount} on</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          data-testid={`btn-enable-recommended-${section.id}`}
          className="text-[11px] h-7 px-2.5 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/10 shrink-0 font-semibold"
          onClick={(e) => { e.stopPropagation(); enableRecommended(); }}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Enable Recommended
        </Button>
        {collapsed ? <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" /> : <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" />}
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-white/5 pt-3">
          {section.tweaks.map((tweak) => (
            <TweakRow
              key={tweak.key}
              tweak={tweak}
              enabled={!!tweaks[tweak.key]}
              onToggle={() => setTweak(tweak.key, !tweaks[tweak.key])}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function WinTitus() {
  const { tweaks, setTweak } = useOptimizationStore();
  const { toast } = useToast();
  const hw = useHardwareInfo();

  const allKeys = SECTIONS.flatMap((s) => s.tweaks.map((t) => t.key));
  const enabledTotal = allKeys.filter((k) => tweaks[k]).length;

  const enableAll = () => {
    SECTIONS.flatMap((s) => s.tweaks.filter((t) => t.recommended)).forEach((t) => setTweak(t.key, true));
    const count = SECTIONS.flatMap((s) => s.tweaks.filter((t) => t.recommended)).length;
    toast({ title: `${count} recommended tweaks enabled`, description: "Review your selections, then download your script from the top bar." });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl pb-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 mb-8"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5 shrink-0">
            <Wrench className="w-6 h-6 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold">WinUtil + OO ShutUp10++</h1>
              <span className="text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/25 px-2 py-1 rounded uppercase tracking-wider">
                ChrisTitus Inspired
              </span>
            </div>
            <p className="text-zinc-500 text-sm mt-1">
              All tweaks from ChrisTitus WinUtil (Essential + Advanced tabs) and OO ShutUp10++ recommended settings — translated into PowerShell registry commands.
            </p>
          </div>
        </motion.div>

        {/* Hardware-optimized settings */}
        {!hw.loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5 flex items-start gap-3"
          >
            <Zap className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed space-y-1">
              <p className="text-orange-400 font-semibold">Hardware-Optimized Settings</p>
              <p className="text-zinc-300">
                {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
              </p>
            </div>
          </motion.div>
        )}

        {/* One-click recommended */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between flex-wrap gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-bold text-white">Apply All Recommended</p>
            </div>
            <p className="text-xs text-zinc-500">
              Enables every tweak marked <span className="text-emerald-400 font-semibold">Recommended</span> across all sections — the same choices ChrisTitus applies by default.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {enabledTotal > 0 && (
              <span className="text-xs text-zinc-500">{enabledTotal} tweaks active</span>
            )}
            <Button
              data-testid="button-enable-all-wintitus"
              onClick={enableAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/40 font-bold text-sm"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Enable All Recommended
            </Button>
          </div>
        </motion.div>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-300">Read the warnings</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Some tweaks (Edge removal, Xbox components) have specific warnings attached. Read them before enabling. Always create a <strong className="text-zinc-300">System Restore Point</strong> first.
            </p>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((section, i) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
            >
              <Section section={section} />
            </motion.div>
          ))}
        </div>

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl border border-white/5 bg-zinc-900/40 space-y-2"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">What this does vs running WinUtil</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "Same registry changes ChrisTitus applies",
              "OO ShutUp10++ recommended privacy rules",
              "No need to run irm | iex scripts",
              "All tweaks tracked in your Opti Gods profile",
              "Combined with your other optimizations in one script",
              "Safe — no unknown code downloaded from the internet",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <p className="text-[11px] text-zinc-400">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
}
