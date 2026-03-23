import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { ProGate } from "@/components/pro-gate";
import { Button } from "@/components/ui/button";
import {
  Download, Shield, AlertTriangle, CheckCircle2, ExternalLink,
  HardDrive, Zap, Globe, Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OS_OPTIONS = [
  {
    name: "ReviOS",
    subtitle: "Privacy-first minimal Windows",
    logo: "🔒",
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    badge: "Most Popular",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    desc: "A custom debloated Windows build focused on privacy and gaming performance. Removes telemetry, advertising, and bloatware at the ISO level. Officially supports AME Wizard for automated installation.",
    perks: [
      "Removes tracking at the image level — not just registry tweaks",
      "Supports AME Wizard (.apbx playbook) for automated setup",
      "Regular updates tracking Windows cumulative patches",
      "Discord community with dedicated support",
    ],
    link: "https://reviOS.com",
    playbook: "https://ameliorated.io",
    warning: "ReviOS is a community project and is not affiliated with Microsoft. Research it before installing on your main system.",
  },
  {
    name: "AtlasOS",
    subtitle: "FPS-focused debloated Windows",
    logo: "⚡",
    color: "text-yellow-400",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/5",
    badge: "FPS Focused",
    badgeColor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    desc: "Built specifically for gamers. Strips everything Windows doesn't need for gaming and aggressively tunes scheduling, interrupts, and memory management at the kernel level.",
    perks: [
      "Aggressive kernel-level gaming optimizations",
      "Documented and open-source configuration",
      "Custom AME Wizard playbook for one-click setup",
      "Active GitHub and Discord support",
    ],
    link: "https://atlasos.net",
    playbook: "https://ameliorated.io",
    warning: "AtlasOS disables Windows Update by design. You must manually apply security patches.",
  },
];

const HOW_TO_STEPS = [
  {
    step: "1",
    title: "Download AME Wizard",
    desc: "AME Wizard is the tool that applies custom OS playbooks. Download it from ameliorated.io",
    link: "https://ameliorated.io",
    linkLabel: "ameliorated.io →",
  },
  {
    step: "2",
    title: "Get a fresh Windows ISO",
    desc: "Download the official Windows 10 or 11 ISO from Microsoft. Clean installs work best.",
    link: "https://www.microsoft.com/software-download/windows11",
    linkLabel: "microsoft.com →",
  },
  {
    step: "3",
    title: "Install Windows clean",
    desc: "Install Windows on your drive first — don't log into a Microsoft account during setup.",
  },
  {
    step: "4",
    title: "Download your playbook",
    desc: "Get the .apbx playbook file for ReviOS or AtlasOS from their official sites.",
  },
  {
    step: "5",
    title: "Run AME Wizard + Playbook",
    desc: "Open AME Wizard, drag your .apbx file in, and let it run. It handles everything automatically.",
  },
  {
    step: "6",
    title: "Opti Gods after setup",
    desc: "Once your custom OS is installed, run Opti Gods on top for the final gaming optimizations.",
  },
];

export default function CustomOS() {
  const { toast } = useToast();

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener noreferrer");
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
            <HardDrive className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold">Custom OS</h1>
              <span className="text-[10px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/25 px-2 py-1 rounded uppercase tracking-wider">
                Pro Feature
              </span>
            </div>
            <p className="text-zinc-500 text-sm mt-1">
              Take optimization further with a custom Windows build — debloated at the ISO level using AME Wizard playbooks.
            </p>
          </div>
        </motion.div>

        <ProGate>
          <div className="space-y-6">

            {/* Warning banner */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-start gap-3 px-4 py-4 rounded-xl border border-amber-500/25 bg-amber-500/5"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-300">This is advanced — for experienced users</p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Custom OS builds replace your Windows installation. <strong className="text-white">Back up all your data first.</strong>{" "}
                  These are community projects — not official Microsoft products. Use on a secondary drive or test machine first.
                </p>
              </div>
            </motion.div>

            {/* OS Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OS_OPTIONS.map((os, i) => (
                <motion.div
                  key={os.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className={`rounded-xl border ${os.border} ${os.bg} p-5 space-y-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{os.logo}</span>
                        <div>
                          <p className="text-base font-bold text-white">{os.name}</p>
                          <p className={`text-xs font-medium ${os.color}`}>{os.subtitle}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wider ${os.badgeColor}`}>
                      {os.badge}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{os.desc}</p>

                  <div className="space-y-1.5">
                    {os.perks.map((perk, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-zinc-400">{perk}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300 leading-snug">{os.warning}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      data-testid={`button-visit-${os.name.toLowerCase()}`}
                      onClick={() => openLink(os.link)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold"
                    >
                      <Globe className="w-3 h-3 mr-1.5" />
                      Visit {os.name}
                    </Button>
                    <Button
                      size="sm"
                      data-testid={`button-amewizard-${os.name.toLowerCase()}`}
                      onClick={() => openLink(os.playbook)}
                      variant="outline"
                      className="flex-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 text-xs font-semibold"
                    >
                      <Download className="w-3 h-3 mr-1.5" />
                      AME Wizard
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* How to install */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-4"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 px-1">How to install a custom OS</h2>
              <div className="space-y-2">
                {HOW_TO_STEPS.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/5">
                    <span className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {s.step}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{s.desc}</p>
                      {s.link && (
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 mt-1 transition-colors"
                        >
                          {s.linkLabel}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AME Wizard note */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                <p className="text-sm font-bold text-white">About AME Wizard & .apbx files</p>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                AME Wizard reads <strong className="text-zinc-300">.apbx playbook files</strong> — think of them as scripts that automate everything:
                removing Windows bloat, applying privacy settings, disabling telemetry, and configuring the system for performance.
                ReviOS and AtlasOS each provide their own playbook. Download AME Wizard from{" "}
                <a
                  href="https://ameliorated.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  ameliorated.io
                </a>
                .
              </p>
              <Button
                data-testid="button-download-amewizard"
                onClick={() => openLink("https://ameliorated.io")}
                className="bg-violet-600 hover:bg-violet-700 text-white border border-violet-500/40 font-bold text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Download AME Wizard
              </Button>
            </motion.div>

          </div>
        </ProGate>

      </div>
    </AppLayout>
  );
}
