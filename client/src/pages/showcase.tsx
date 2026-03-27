import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { Play, Zap, Trophy, TrendingUp, Star } from "lucide-react";
import { ProUnlockButton } from "@/components/pro-gate";

const CLIPS = [
  {
    src: "/videos/clip1-fivem-400fps.mp4",
    label: "FiveM Roleplay — 400 FPS",
    game: "FiveM",
    desc: "400 FPS in a heavy roleplay server. This is what Opti Gods unlocks on hardware everyone said couldn't do it.",
    stat: "400 FPS",
    color: "from-red-600/20 to-transparent",
    border: "border-red-500/30",
    badge: "🏆 FiveM RP",
  },
  {
    src: "/videos/clip2-fortnite-freebuild.mp4",
    label: "Fortnite Freebuild — GTX 1650 Super",
    game: "Fortnite",
    desc: "Buttery smooth freebuild clips on a GTX 1650 Super after optimization. Mid-range GPU, top-tier performance.",
    stat: "1650 Super",
    color: "from-blue-600/20 to-transparent",
    border: "border-blue-500/30",
    badge: "⚡ Fortnite",
  },
  {
    src: "/videos/clip3-fivem-redzone.mp4",
    label: "FiveM TMFRZ — 3 Kills, 1650 Super",
    game: "FiveM",
    desc: "3-kill clip in the TMFRZ redzone on a GTX 1650 Super with optimized frames. Consistent, no stutters.",
    stat: "TMFRZ Redzone",
    color: "from-orange-600/20 to-transparent",
    border: "border-orange-500/30",
    badge: "🎯 FiveM PvP",
  },
  {
    src: "/videos/clip4-tmfrz-maxfps.mp4",
    label: "TMFRZ — Max Frames Unlocked",
    game: "FiveM",
    desc: "Maximum possible frames in TMFRZ server after a full Opti Gods optimization pass. Hardware pushed to its actual ceiling.",
    stat: "Max FPS",
    color: "from-green-600/20 to-transparent",
    border: "border-green-500/30",
    badge: "🚀 Max Performance",
  },
];

export default function Showcase() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-0">

        {/* Hero */}
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
              Unedited clips. Real hardware. Real FPS. No fakery — just what happens when your PC is actually optimized.
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-red-400" /> 318+ tweaks</span>
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Measurable FPS gains</span>
              <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> Lifetime Pro access</span>
            </div>
          </motion.div>
        </div>

        {/* Video Grid */}
        <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {CLIPS.map((clip, i) => (
            <motion.div
              key={clip.src}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className={`rounded-xl overflow-hidden border ${clip.border} bg-zinc-900/60 flex flex-col`}
            >
              {/* Video */}
              <div className="relative bg-black aspect-video w-full group">
                <video
                  src={clip.src}
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain"
                  playsInline
                >
                  Your browser does not support video playback.
                </video>
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/80 text-white border border-white/10">
                    {clip.badge}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className={`p-4 bg-gradient-to-b ${clip.color}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white leading-tight">{clip.label}</h3>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-black text-red-400 border border-red-500/20">
                    {clip.stat}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{clip.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
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
