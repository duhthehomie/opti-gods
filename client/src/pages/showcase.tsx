import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { Zap, Trophy, TrendingUp, Star, Cpu, Monitor, Wifi, HardDrive } from "lucide-react";
import { ProUnlockButton } from "@/components/pro-gate";

const RESULTS = [
  {
    game: "FiveM Roleplay",
    before: "48 FPS",
    after: "120+ FPS",
    hw: "i7-10700 / GTX 1650 Super",
    badge: "🏆 FiveM RP",
    color: "border-red-500/30",
    glow: "from-red-600/10",
    stat: "2.5× improvement",
    statColor: "text-red-400",
  },
  {
    game: "Fortnite Freebuild",
    before: "120 FPS (capped menus)",
    after: "300+ FPS",
    hw: "GTX 1650 Super",
    badge: "⚡ Fortnite",
    color: "border-blue-500/30",
    glow: "from-blue-600/10",
    stat: "2.5× multiplier",
    statColor: "text-blue-400",
  },
  {
    game: "FiveM TMFRZ",
    before: "187 FPS (capped)",
    after: "250+ FPS",
    hw: "GTX 1650 Super / 16GB RAM",
    badge: "🎯 FiveM PvP",
    color: "border-orange-500/30",
    glow: "from-orange-600/10",
    stat: "Uncapped headroom",
    statColor: "text-orange-400",
  },
  {
    game: "Fortnite Creative",
    before: "60 FPS",
    after: "300+ FPS",
    hw: "Integrated Graphics",
    badge: "💻 Integrated GPU",
    color: "border-green-500/30",
    glow: "from-green-600/10",
    stat: "5× improvement",
    statColor: "text-green-400",
  },
  {
    game: "Fortnite Battle Bus",
    before: "120 FPS (capped)",
    after: "250-400 FPS",
    hw: "1650 Super / High-end",
    badge: "🚀 Max Frames",
    color: "border-purple-500/30",
    glow: "from-purple-600/10",
    stat: "No cap limiting",
    statColor: "text-purple-400",
  },
  {
    game: "Multi-app Stability",
    before: "Crashes/Stutters",
    after: "Smooth + Stable",
    hw: "All systems",
    badge: "🔧 Reliability",
    color: "border-zinc-500/30",
    glow: "from-zinc-600/10",
    stat: "Discord + gaming sync",
    statColor: "text-zinc-300",
  },
];

const STATS = [
  { icon: Zap, value: "432+", label: "Optimization Tweaks", color: "text-red-400" },
  { icon: TrendingUp, value: "8×", label: "Average FPS Multiplier", color: "text-green-400" },
  { icon: Cpu, value: "100%", label: "Hardware Utilized", color: "text-blue-400" },
  { icon: Monitor, value: "<5min", label: "Setup Time", color: "text-yellow-400" },
  { icon: Wifi, value: "-30%", label: "Network Latency Reduction", color: "text-cyan-400" },
  { icon: HardDrive, value: "0", label: "Bloat Left Behind", color: "text-purple-400" },
];

export default function Showcase() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-0">

        <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-red-950/20 to-transparent px-6 py-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">Real Results</span>
              <Trophy className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              This Is What Opti Gods Does
            </h1>
            <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-5">
              Unedited numbers. Real hardware. Real FPS. No fakery — just what happens when your PC is actually optimized.
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-red-400" /> 432+ tweaks</span>
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Measurable FPS gains</span>
              <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> Lifetime Pro access</span>
            </div>
          </motion.div>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-3 xl:grid-cols-6 border-b border-white/5">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex flex-col items-center justify-center gap-1 py-5 px-2 border-r border-white/5 last:border-r-0 text-center"
            >
              <s.icon className={`w-4 h-4 ${s.color} mb-0.5`} />
              <span className={`text-xl font-black ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-zinc-600 leading-tight">{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Results grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {RESULTS.map((r, i) => (
            <motion.div
              key={r.game}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className={`rounded-xl border ${r.color} bg-gradient-to-br ${r.glow} to-zinc-900/60 p-5 flex flex-col gap-3`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold bg-black/50 border border-white/10 px-2 py-0.5 rounded-full text-white">{r.badge}</span>
                <span className={`text-[10px] font-black ${r.statColor}`}>{r.stat}</span>
              </div>
              <h3 className="text-sm font-black text-white">{r.game}</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg bg-zinc-900/80 border border-white/5 px-3 py-2 text-center">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Before</div>
                  <div className="text-base font-black text-zinc-400">{r.before}</div>
                </div>
                <Zap className="w-4 h-4 text-red-500 shrink-0" />
                <div className="flex-1 rounded-lg bg-red-950/40 border border-red-500/20 px-3 py-2 text-center">
                  <div className="text-[9px] text-red-500/70 uppercase tracking-wider mb-0.5">After</div>
                  <div className="text-base font-black text-white">{r.after}</div>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600">{r.hw}</p>
            </motion.div>
          ))}
        </div>

        <div className="mx-6 mb-8 p-6 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-950/20 to-zinc-900/40 text-center">
          <h2 className="text-xl font-black text-white mb-1">Want These Results on Your PC?</h2>
          <p className="text-sm text-zinc-400 mb-4">One-time $25. Lifetime access. Your hardware, fully unleashed.</p>
          <ProUnlockButton>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors">
              <Zap className="w-4 h-4" />
              Get Opti Gods Pro — $25 Lifetime
            </div>
          </ProUnlockButton>
        </div>
      </div>
    </AppLayout>
  );
}
