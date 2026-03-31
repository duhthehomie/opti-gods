import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { ProGate } from "@/components/pro-gate";
import { Button } from "@/components/ui/button";
import {
  Download, Shield, CheckCircle2, ExternalLink,
  HardDrive, Zap, Lock, Cpu, MemoryStick, Wifi,
  MonitorPlay, Flame, Trash2, Settings2, Star,
  ChevronRight, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { getOptimalSystemResponsiveness, getSystemResponsivenessExplanation } from "@/lib/hardware-optimization";

const FEATURE_PILLARS = [
  {
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "100% Safe",
    body: "Uses AME Wizard playbook — the same trusted tool behind Atlas and Revi. Runs on an existing Windows install, not a modified ISO. Every change is documented and reversible.",
  },
  {
    icon: Zap,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    title: "Maximum FPS",
    body: "Game-specific IFEO PerfOptions pre-applied for GTA5, FiveM, Fortnite, CS2, Valorant, Apex. GPU scheduling tuned. Scheduler hardened at the multimedia profile level.",
  },
  {
    icon: Lock,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    title: "Zero Telemetry",
    body: "All Microsoft data collection services stopped and set to disabled. DiagTrack, CEIP, CompatTelRunner, and 30+ tracking mechanisms removed at the registry level.",
  },
  {
    icon: Cpu,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    title: "Kernel Tuned",
    body: "Win32PrioritySeparation set for foreground boost. Timer resolution locked to 0.5ms. CPU parking disabled. DPC latency minimized. Interrupt affinity set for gaming workloads.",
  },
];

const WHATS_REMOVED = [
  { item: "Microsoft OneDrive", safe: true },
  { item: "Cortana / Bing Search", safe: true },
  { item: "Xbox App + Xbox Game Bar", safe: true },
  { item: "Microsoft Teams (consumer)", safe: true },
  { item: "Windows Feedback Hub", safe: true },
  { item: "DiagTrack (Connected User Experiences)", safe: true },
  { item: "CEIP telemetry tasks (30+ scheduled tasks)", safe: true },
  { item: "Mixed Reality Portal", safe: true },
  { item: "Skype (consumer)", safe: true },
  { item: "Groove Music / Zune", safe: true },
  { item: "Maps + News + Weather apps", safe: true },
  { item: "Microsoft Solitaire Collection", safe: true },
  { item: "Office Hub / Get Office", safe: true },
  { item: "Paint 3D", safe: true },
  { item: "Your Phone (Phone Link)", safe: true },
  { item: "Clipchamp", safe: true },
  { item: "Power Automate Desktop", safe: true },
  { item: "Quick Assist", safe: true },
  { item: "Windows Hello (biometrics — optional)", safe: true },
  { item: "Widgets + Feed (Win11)", safe: true },
  { item: "Copilot sidebar (Win11)", safe: true },
  { item: "Chat icon (Win11)", safe: true },
];

const WHATS_KEPT = [
  "Windows Defender (core AV protection intact)",
  "Windows Update (security patches only mode)",
  "DirectX, Vulkan, OpenGL runtime libraries",
  "NVIDIA / AMD display driver infrastructure",
  "Audio services (Windows Audio Endpoint Builder)",
  "Network services (DHCP, DNS, TCP/IP stack)",
  "USB device support",
  ".NET Framework (4.8) + Visual C++ runtimes",
  "Windows Installer service",
  "Task Scheduler (for legitimate apps)",
];

const SERVICES_DISABLED = [
  "DiagTrack — Connected User Experiences",
  "WSearch — Windows Search indexer",
  "SysMain — Superfetch",
  "RemoteRegistry — remote access",
  "WMPNetworkSvc — Media sharing",
  "Fax — fax service",
  "RetailDemo — demo mode",
  "MapsBroker — offline maps",
  "TabletInputService — tablet PC",
  "PhoneSvc — phone companion",
  "XblGameSave — Xbox save sync",
  "XblAuthManager — Xbox auth",
  "XboxGipSvc — Xbox accessories",
  "WbioSrvc — biometrics (optional)",
  "WerSvc — Windows Error Reporting",
  "WpcMonSvc — Parental Controls",
  "StorSvc — Storage sense",
  "InstallService — Microsoft Store installer",
  "wlidsvc — Microsoft account sign-in",
  "NGCCtnrSvc — Windows Hello",
  "NgcSvc — Windows Hello",
  "EFS — Encrypting File System",
  "icssvc — Mobile Hotspot",
  "lfsvc — Geolocation",
  "SensrSvc — Sensor monitoring",
  "CscService — Offline files",
  "MSiSCSI — iSCSI initiator",
  "TrkWks — Distributed link tracking",
  "IKEEXT — IKE/AuthIP IPsec keying",
  "PolicyAgent — IPsec policy agent",
  "SCPolicySvc — Smart card policies",
];

const GAMING_STACK = [
  { label: "fivem.exe", values: "CpuPriorityClass=3, CpuPriorityBoost, DisableEnergyThrottling, ForceForegroundBoost, IoPriority=3, PagePriority=5, RenderThrottlingOff, PowerThrottlingOff, GpuIdleEnabled=0" },
  { label: "FiveM_b*_GTAProcess.exe", values: "Version-agnostic wildcard targeting. CpuPriorityClass=3, IoPriority=3, EnergyThrottle=Off, FGBoost=On, PagePriority=5" },
  { label: "GTA5.exe", values: "CpuPriorityClass=3, IoPriority=3, DisableRenderingContextPreemption=1, DisableRenderingPreemption=1" },
  { label: "FortniteClient-Win64-Shipping.exe", values: "CpuPriorityClass=3, CpuPriorityBoost, DisableEnergyThrottling, ForceForegroundBoost, IoPriority=3, PagePriority=5" },
  { label: "cs2.exe / VALORANT / r5apex.exe", values: "CpuPriorityClass=3, IoPriority=3 per-process IFEO keys" },
  { label: "Games Multimedia Profile", values: "GPU Priority=8, MaximumPreRenderedFrames=1, Scheduling Category=High, SFIO Priority=High" },
];

const COMPARE_ROWS = [
  { feature: "Safe to use on main PC", opti: true, revi: true },
  { feature: "Game-specific PerfOptions (FiveM/Fortnite/CS2)", opti: true, revi: false },
  { feature: "NVIDIA + AMD specific tuning", opti: true, revi: false },
  { feature: "FiveM build-agnostic GTA process targeting", opti: true, revi: false },
  { feature: "Telemetry completely removed", opti: true, revi: true },
  { feature: "Windows Update (security patches kept)", opti: true, revi: true },
  { feature: "Kernel scheduler hardened", opti: true, revi: true },
  { feature: "Network stack optimized (TCP, DNS, buffers)", opti: true, revi: false },
  { feature: "30+ bloat services disabled", opti: true, revi: true },
  { feature: "SystemResponsiveness=0 (max CPU for games)", opti: true, revi: false },
  { feature: "GPU scheduling tuned (HAGS + priority stack)", opti: true, revi: false },
  { feature: "CpuPriorityClass safe value (3) enforced", opti: true, revi: false },
];

const INSTALL_STEPS = [
  {
    n: "01",
    title: "Download AME Wizard",
    desc: "AME Wizard is the open-source tool that applies the playbook to your Windows install safely.",
    link: "https://ameliorated.io",
    label: "ameliorated.io →",
    accent: "violet",
  },
  {
    n: "02",
    title: "Install Windows 10 or 11 clean",
    desc: "Download the official Microsoft ISO and do a fresh install. Skip the Microsoft account during setup — use 'Domain join instead' to create a local account.",
    link: "https://www.microsoft.com/software-download/windows11",
    label: "Download Windows 11 ISO →",
    accent: "blue",
  },
  {
    n: "03",
    title: "Download the Opti Gods OS Playbook (.apbx)",
    desc: "Download your exclusive Opti Gods OS playbook — the .apbx file that transforms your Windows install into Opti Gods OS.",
    action: true,
    accent: "red",
  },
  {
    n: "04",
    title: "Run AME Wizard with the Playbook",
    desc: "Open AME Wizard, drag your Opti Gods OS .apbx file into it. AME Wizard will verify, then walk you through the automated setup. Takes 5–15 minutes.",
    accent: "orange",
  },
  {
    n: "05",
    title: "On first boot — run Opti Gods Dashboard",
    desc: "After the playbook finishes and you reboot, open Opti Gods Dashboard and apply your game-specific tweaks on top. This is where the magic completes.",
    accent: "emerald",
  },
];

const accentMap: Record<string, string> = {
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  red: "bg-red-500/10 border-red-500/20 text-red-400",
  orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
};

function CheckIcon({ val }: { val: boolean }) {
  return val
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
    : <span className="block w-4 h-0.5 bg-zinc-700 mx-auto rounded-full" />;
}

export default function CustomOS() {
  const { toast } = useToast();
  const hw = useHardwareInfo();

  const downloadPlaybook = () => {
    const link = document.createElement("a");
    link.href = "/OptiGodsOS.apbx";
    link.download = "OptiGodsOS-by-leaq.apbx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Downloading Opti Gods OS .apbx",
      description: "Open AME Wizard, drag this file in, and follow the prompts to apply the playbook.",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl pb-12">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden border border-red-500/20 bg-gradient-to-br from-red-950/30 via-zinc-950 to-black p-8"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(220,38,38,0.12),_transparent_60%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <HardDrive className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-display font-bold text-white tracking-tight">
                    Opti Gods <span className="text-red-500">OS</span>
                  </h1>
                  <span className="text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-1 rounded uppercase tracking-wider">
                    by leaq
                  </span>
                  <span className="text-[10px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/25 px-2 py-1 rounded uppercase tracking-wider">
                    Pro Exclusive
                  </span>
                </div>
                <p className="text-zinc-400 text-sm mt-1">Windows 10 &amp; 11 — stripped to the bone. Built for dominance.</p>
              </div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
              Opti Gods OS is a custom AME Wizard playbook that transforms your Windows 10/11 install into the
              fastest, cleanest, most gaming-focused environment possible — without touching a single important
              system component. Safe. Reversible. Designed by leaq.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Windows 10 Build 1903+
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Windows 11 All Versions
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Safe on Primary Drive
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Reversible
              </div>
            </div>
          </div>
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
              <p className="text-red-400 font-semibold">Hardware-Optimized OS Settings</p>
              <p className="text-zinc-300">
                {getSystemResponsivenessExplanation(hw, getOptimalSystemResponsiveness(hw))}
              </p>
            </div>
          </motion.div>
        )}

        {/* SmartScreen notice + OS Picks — visible to all */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          {/* SmartScreen warning */}
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/25 bg-amber-950/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-300 mb-0.5">Opti Gods OS — SmartScreen Notice</p>
              <p className="text-[11px] text-amber-200/60 leading-relaxed">
                Windows SmartScreen and some browsers flag the .apbx download as unrecognized because it's a new file without enough download history yet — this is a common false positive for all new AME playbooks. Google confirmed this is likely a false positive. Until it builds reputation, we recommend using <strong className="text-white">ReviOS</strong> below, which is the closest thing to what Opti Gods OS is built toward.
              </p>
            </div>
          </div>

          {/* Best OS Picks */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1">Our OS Picks — Best Gaming Windows Right Now</h2>
            <p className="text-xs text-zinc-500 px-1">These are the best custom Windows OS options on the market. ReviOS is the closest to what Opti Gods OS is designed to be.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* ReviOS — top pick */}
              <div className="relative rounded-xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-950/20 to-zinc-950 p-4 overflow-hidden">
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded uppercase tracking-wider">
                    ⭐ Top Pick
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <HardDrive className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">ReviOS</p>
                    <p className="text-[10px] text-blue-400 font-medium">Closest to Opti Gods OS vision</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                  Debloated Windows 10/11 via AME Wizard. Removes telemetry, Cortana, unnecessary services. Keeps Windows Defender. Excellent for FiveM, Fortnite, and competitive titles. The OS Opti Gods OS draws the most inspiration from.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {["Runs on AME Wizard", "Windows Defender kept", "Zero telemetry", "FiveM optimized", "Low latency"].map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/15 font-medium">{t}</span>
                  ))}
                </div>
                <a
                  href="https://reviproject.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-revios"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-white transition-colors underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Get ReviOS at reviproject.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <Zap className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                <strong className="text-zinc-300">Pro tip:</strong> Run either OS + the Opti Gods tweaks from this app on top — that combination gives you the maximum possible performance boost. The app's tweaks are designed to complement any clean or custom Windows install.
              </p>
            </div>
          </div>
        </motion.div>

        <ProGate>
          <div className="space-y-8">

            {/* Feature pillars */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {FEATURE_PILLARS.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className={`p-5 rounded-xl border ${p.border} ${p.bg} flex gap-4`}
                >
                  <div className={`p-2 rounded-lg ${p.bg} border ${p.border} h-fit shrink-0`}>
                    <p.icon className={`w-5 h-5 ${p.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">{p.title}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{p.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Comparison Table */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1">How we stack up</h2>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="grid grid-cols-4 bg-zinc-900/80 border-b border-white/5">
                  <div className="py-2.5 px-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider col-span-2">Feature</div>
                  <div className="py-2.5 px-1 text-center">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Opti Gods</p>
                  </div>
                  <div className="py-2.5 px-1 text-center">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">ReviOS</p>
                  </div>
                </div>
                {COMPARE_ROWS.map((row, i) => (
                  <div key={i} className={`grid grid-cols-4 border-b border-white/4 ${i % 2 === 0 ? "bg-zinc-950/40" : "bg-transparent"}`}>
                    <div className="py-2.5 px-3 col-span-2 flex items-center">
                      <span className="text-xs text-zinc-300">{row.feature}</span>
                    </div>
                    <div className="py-2.5 px-1 flex items-center justify-center">
                      <CheckIcon val={row.opti} />
                    </div>
                    <div className="py-2.5 px-1 flex items-center justify-center">
                      <CheckIcon val={row.revi} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Gaming stack */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1">Game-Specific IFEO PerfOptions Stack</h2>
              <p className="text-xs text-zinc-500 px-1">Pre-baked into the playbook. No other custom OS does this.</p>
              <div className="space-y-2">
                {GAMING_STACK.map((g, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-zinc-900/60 border border-white/5">
                    <div className="flex items-center gap-2 shrink-0">
                      <Cpu className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-xs font-mono font-bold text-red-300 whitespace-nowrap">{g.label}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0 hidden sm:block self-center" />
                    <span className="text-[11px] text-zinc-500 leading-snug">{g.values}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* What's removed + kept — two columns */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Removed */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> What gets removed
                </h2>
                <div className="rounded-xl border border-red-500/10 bg-red-500/3 p-4 space-y-1.5">
                  {WHATS_REMOVED.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <EyeOff className="w-3 h-3 text-red-400/70 shrink-0" />
                      <span className="text-[11px] text-zinc-400">{w.item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kept */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-500 px-1 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> What we keep (always)
                </h2>
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/3 p-4 space-y-1.5">
                  {WHATS_KEPT.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-zinc-400">{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Services disabled */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="space-y-3"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" /> Services disabled (30+)
              </h2>
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SERVICES_DISABLED.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[10px] text-red-400/60 font-mono shrink-0 mt-0.5">■</span>
                      <span className="text-[11px] text-zinc-500">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Install steps */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="space-y-3"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1">How to install Opti Gods OS</h2>
              <div className="space-y-2">
                {INSTALL_STEPS.map((s, i) => {
                  const cls = accentMap[s.accent];
                  return (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900/50 border border-white/5">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 font-display font-bold text-sm ${cls}`}>
                        {s.n}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{s.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{s.desc}</p>
                        {s.link && (
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`link-install-${i}`}
                            className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-violet-400 hover:text-violet-300 transition-colors font-medium"
                          >
                            {s.label}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {s.action && (
                          <Button
                            size="sm"
                            data-testid="button-download-playbook-step"
                            onClick={downloadPlaybook}
                            className="mt-2 bg-red-600 hover:bg-red-700 text-white border border-red-500/40 font-bold text-xs h-7 px-3"
                          >
                            <Download className="w-3 h-3 mr-1.5" />
                            Download Opti Gods OS .apbx
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Safety assurance */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-bold text-white">Safety Guarantee</p>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Opti Gods OS is built on the AME Wizard framework — the same open-source, community-audited tool
                that powers ReviOS. Every modification applied by the playbook is{" "}
                <span className="text-white font-medium">documented, reversible, and tested</span> on both
                Windows 10 and Windows 11. We do not modify system files or replace system executables.
                All changes happen through official Windows APIs: Group Policy, Services, Registry, and Task Scheduler.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Eye, label: "Open Playbook", desc: "Every action in the .apbx is readable — no hidden steps." },
                  { icon: Shield, label: "Keeps Defender", desc: "Windows Defender AV protection remains fully active." },
                  { icon: Zap, label: "Update Safe", desc: "Security patches still apply. Only optional updates are paused." },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <item.icon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-white">{item.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AME Wizard Setup */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.33 }}
              className="space-y-3"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 px-1">1. Download AME Wizard & Playbooks (No Ads)</h2>
              <p className="text-xs text-zinc-500 px-1">Get the official AME Wizard and choose your playbook — all without ads or bloat for a clean install</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://ameliorated.io", "_blank", "noopener noreferrer")}
                  className="text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-1"
                >
                  <Download className="w-3 h-3" />
                  AME Wizard (No Ads)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://github.com/Ameliorated-LLC/trusted-uninstaller/releases", "_blank", "noopener noreferrer")}
                  className="text-xs border-zinc-700 text-zinc-400 hover:bg-zinc-800 gap-1"
                >
                  <Download className="w-3 h-3" />
                  GitHub (Latest)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://reviproject.com/downloads", "_blank", "noopener noreferrer")}
                  className="text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-1"
                >
                  <Download className="w-3 h-3" />
                  ReviOS Playbook (No Ads)
                </Button>
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="relative rounded-xl border border-red-500/25 bg-gradient-to-br from-red-950/20 via-zinc-950 to-black p-6 text-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.08),_transparent_70%)]" />
              <div className="relative z-10">
                <Star className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <h3 className="text-xl font-display font-bold text-white mb-2">2. Apply Opti Gods OS</h3>
                <p className="text-zinc-400 text-sm mb-5 max-w-md mx-auto">
                  Download your exclusive .apbx playbook. Open AME Wizard → select your playbook → apply → restart.
                  Your Windows install will transform into the fastest gaming OS you've ever used.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    data-testid="button-download-optigods-os"
                    onClick={downloadPlaybook}
                    className="bg-red-600 hover:bg-red-700 text-white border border-red-500/40 font-bold text-sm px-6"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Opti Gods OS .apbx
                  </Button>
                  <Button
                    data-testid="button-discord-os"
                    variant="outline"
                    onClick={() => window.open("https://discord.gg/C8WrQknN9k", "_blank", "noopener noreferrer")}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white font-semibold text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Questions? Join Discord
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* AME Wizard note */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-700/30 bg-zinc-900/30"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                <span className="text-amber-300 font-semibold">Backup your data before applying any OS playbook.</span>{" "}
                While Opti Gods OS is designed to be safe and non-destructive, a clean Windows install is always the
                best foundation. AME Wizard will pause and ask for confirmation before making any changes.
              </p>
            </motion.div>

          </div>
        </ProGate>
      </div>
    </AppLayout>
  );
}
