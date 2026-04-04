import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import {
  MessageCircle, ExternalLink, HelpCircle, Ticket, AtSign,
  Shield, Zap, ChevronRight, AlertTriangle, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISCORD_INVITE = "https://discord.gg/optigods";

const FAQ_ITEMS = [
  {
    q: "Is it safe to run these scripts?",
    a: "Yes — every tweak is a documented Windows registry or service change. They are fully reversible. We include descriptions and impact ratings so you know exactly what you're enabling. Avoid the 'RISKY' section unless you understand what it does.",
  },
  {
    q: "Do I need Pro to use the app?",
    a: "The free version includes all optimization toggles and script generation. Pro unlocks preset saving, the full script download, and priority support.",
  },
  {
    q: "My PC crashed after running a script — what do I do?",
    a: "Boot into Safe Mode (hold Shift and click Restart → Troubleshoot → Advanced → Startup Settings → Enable Safe Mode). Then open a PowerShell as Admin and run: Set-MpPreference -DisableRealtimeMonitoring $false to re-enable Defender if you toggled it. Join the Discord for step-by-step help.",
  },
  {
    q: "The script says 'not recognized' or fails to run",
    a: "Use the .bat download from the script dialog — just double-click it and click Yes on the UAC popup. It handles everything automatically. If you're using the .ps1 file and Windows blocks it: right-click it → Properties → check Unblock → OK, then double-click to run.",
  },
  {
    q: "Can I reverse the tweaks?",
    a: "Most registry tweaks can be undone by restoring the original value. The safest method is System Restore — create a restore point before running any script. Go to: Control Panel → System → System Protection → Create.",
  },
  {
    q: "I don't see my game in Game Detection",
    a: "The app checks common install paths. If your game is installed to a custom location, the detection will say [SKIP] — but the script still runs. Join the Discord and request your game to be added.",
  },
];

const STEPS = [
  {
    icon: ExternalLink,
    title: "Join the Discord",
    desc: "Click the button below to get an instant invite to the Opti Gods support server.",
  },
  {
    icon: Ticket,
    title: "Open a Ticket",
    desc: "In the server, go to the #open-ticket channel and click the button to create a private support thread.",
  },
  {
    icon: AtSign,
    title: "Tag @leaq",
    desc: "Describe your issue and ping @leaq in your ticket. Include your PC specs and what tweaks you ran.",
  },
];

export default function Help() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-3xl pb-10">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <HelpCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Help & Support</h1>
            <p className="text-zinc-500 text-sm">Get assistance, report issues, or request features on Discord</p>
          </div>
        </motion.div>

        {/* Discord CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 overflow-hidden"
        >
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="p-3 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 shrink-0">
              <MessageCircle className="w-8 h-8 text-[#5865F2]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white font-display">Opti Gods Support Discord</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Join the official server to get help from <span className="text-white font-semibold">@leaq</span> and the support team. Open a ticket, report bugs, or request new tweaks.
              </p>
              <p className="text-[11px] text-zinc-600 font-mono mt-1">{DISCORD_INVITE}</p>
            </div>
            <Button
              data-testid="button-join-discord"
              onClick={() => window.open(DISCORD_INVITE, "_blank", "noopener,noreferrer")}
              className="shrink-0 bg-[#5865F2] hover:bg-[#4752c4] text-white border-0 font-bold gap-2 shadow-lg shadow-[#5865F2]/20"
            >
              <MessageCircle className="w-4 h-4" />
              Join Discord
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Button>
          </div>
        </motion.div>

        {/* How to get help */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold uppercase tracking-wider">How to Get Support</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((step, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <step.icon className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="text-sm font-bold text-white">{step.title}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed pl-9">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Safety notice */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-400">Before Applying Any Tweaks — Create a Restore Point</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Go to <span className="text-white font-mono text-[11px]">Control Panel → System → System Protection → Create</span> before running any script. This lets you undo all changes instantly if something goes wrong. You can also use <span className="text-white font-mono text-[11px]">rstrui.exe</span> from Run (Win+R) to open System Restore at any time.
            </p>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/5 bg-zinc-900/60 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold uppercase tracking-wider">Frequently Asked Questions</span>
          </div>
          <div className="divide-y divide-white/5">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="px-5 py-4 space-y-1.5">
                <div className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-white">{item.q}</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed pl-5">{item.a}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* What to include in ticket */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-white/5 bg-zinc-900/60 p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold uppercase tracking-wider">What to Include in Your Ticket</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "Your CPU, GPU, and RAM amount",
              "Windows version (Win10 or Win11)",
              "Which tweaks or presets you applied",
              "The exact error message (screenshot if possible)",
              "Whether you have an SSD or HDD",
              "Any antivirus or security software running",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/60 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Button
              data-testid="button-discord-cta-bottom"
              variant="outline"
              onClick={() => window.open(DISCORD_INVITE, "_blank", "noopener,noreferrer")}
              className="w-full border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/10 hover:text-[#5865F2] gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Open a Ticket on Discord
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-zinc-600">
          Opti Gods is built and maintained by <span className="text-zinc-400">leaq</span>. Response time is typically within a few hours.
        </p>

      </div>
    </AppLayout>
  );
}
