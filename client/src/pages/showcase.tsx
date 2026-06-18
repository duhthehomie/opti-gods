import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { Zap, Trophy, TrendingUp, Star, Cpu, Monitor, Wifi, HardDrive, AlertTriangle, CheckCircle, ExternalLink, Copy, CreditCard } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-base";

const CASHAPP_TAG = import.meta.env.VITE_CASHAPP_TAG || "$my1ik";
const PAYPAL_LINK = import.meta.env.VITE_PAYPAL_LINK || "paypal.me/accountslg";
const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === "true";

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
    before: "120 FPS (capped)",
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
    after: "250–400 FPS",
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
  { icon: Zap, value: TOTAL_TWEAKS_LABEL, label: "Optimization Tweaks", color: "text-red-400" },
  { icon: TrendingUp, value: "8×", label: "Avg FPS Multiplier", color: "text-green-400" },
  { icon: Cpu, value: "100%", label: "Hardware Utilized", color: "text-blue-400" },
  { icon: Star, value: "5★", label: "Verified Reviews", color: "text-yellow-400" },
  { icon: Wifi, value: "−30%", label: "Network Latency", color: "text-cyan-400" },
  { icon: HardDrive, value: "0", label: "Bloat Left Behind", color: "text-purple-400" },
];

const STEPS = [
  {
    n: "01",
    title: "Pay $20 — CashApp or PayPal",
    desc: "One-time payment. Lifetime access. Use the buttons below.",
  },
  {
    n: "02",
    title: "DM leaq on Discord with proof",
    desc: "Screenshot your payment receipt and send it to leaq in the Opti Gods Discord.",
  },
  {
    n: "03",
    title: "Download Opti Gods on your PC",
    desc: "Open optigods.com on your Windows PC and grab the .exe installer.",
  },
  {
    n: "04",
    title: "Enter your key & unlock Pro",
    desc: "Paste your access code in the app — all 580+ tweaks unlocked instantly.",
  },
];

function ShowcaseStripeCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/create-checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Couldn't start checkout. Try again.");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/8 bg-zinc-900/70 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Card</span>
        <span className="text-xs font-black text-rose-400">Stripe — instant</span>
      </div>
      <button
        data-testid="button-stripe-showcase"
        onClick={handlePay}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-bold transition-colors"
      >
        <CreditCard className="w-3.5 h-3.5" />
        {loading ? "Loading…" : "Pay with Card"}
      </button>
      {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export default function Showcase() {
  const [copied, setCopied] = useState<"cashapp" | "paypal" | null>(null);

  const copy = (text: string, which: "cashapp" | "paypal") => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-0 min-h-screen">

        {/* ── PC product warning ──────────────────────────────────── */}
        <div className="bg-amber-500/12 border-b border-amber-500/25 px-4 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300 leading-relaxed">
            <span className="font-black">This is a Windows PC app.</span>{" "}
            Pay here on mobile → DM leaq on Discord with your receipt → get your key to use on PC.
          </p>
        </div>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-red-950/20 to-transparent px-6 py-9 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">Real Results</span>
              <Trophy className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">This Is What Opti Gods Does</h1>
            <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-5">
              Unedited numbers. Real hardware. Real FPS. No fakery — just what happens when your PC is actually optimized.
            </p>
            <div className="flex items-center justify-center gap-5 text-xs text-zinc-500 flex-wrap">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-red-400" /> {TOTAL_TWEAKS_LABEL} tweaks</span>
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Measurable FPS gains</span>
              <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> Lifetime Pro access</span>
            </div>
          </motion.div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 xl:grid-cols-6 border-b border-white/5">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex flex-col items-center justify-center gap-1 py-5 px-2 border-r border-white/5 last:border-r-0 text-center"
            >
              <s.icon className={cn("w-4 h-4 mb-0.5", s.color)} />
              <span className={cn("text-xl font-black", s.color)}>{s.value}</span>
              <span className="text-[10px] text-zinc-600 leading-tight">{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Get Pro — mobile purchase flow ─────────────────────── */}
        <div className="px-5 py-7 border-b border-white/5 bg-red-950/10">
          <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-1 text-center">Get Pro — $20 Lifetime</p>
          <h2 className="text-xl font-black text-white text-center mb-1">Want These Results?</h2>
          <p className="text-xs text-zinc-400 text-center mb-6 leading-relaxed">
            Pay below → DM leaq on Discord with proof → receive your key within minutes
          </p>

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-3">
                <span className="text-[10px] font-black text-red-500 font-mono mt-0.5 w-5 shrink-0">{s.n}</span>
                <div>
                  <p className="text-xs font-bold text-white leading-snug">{s.title}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Payment buttons */}
          <div className="space-y-3">
            {/* CashApp */}
            <div className="rounded-xl border border-white/8 bg-zinc-900/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">CashApp</span>
                <span className="text-xs font-black text-emerald-400">{CASHAPP_TAG}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://cash.app/${CASHAPP_TAG.replace("$", "%24")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-cashapp-pay"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Pay {CASHAPP_TAG}
                </a>
                <button
                  data-testid="button-copy-cashapp"
                  onClick={() => copy(CASHAPP_TAG, "cashapp")}
                  className="px-3 rounded-lg border border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                >
                  {copied === "cashapp" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* PayPal */}
            <div className="rounded-xl border border-white/8 bg-zinc-900/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">PayPal</span>
                <span className="text-xs font-black text-blue-400">{PAYPAL_LINK}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://${PAYPAL_LINK}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-paypal-pay"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Pay via PayPal
                </a>
                <button
                  data-testid="button-copy-paypal"
                  onClick={() => copy(`https://${PAYPAL_LINK}`, "paypal")}
                  className="px-3 rounded-lg border border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                >
                  {copied === "paypal" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Stripe — shown when VITE_STRIPE_ENABLED=true */}
            {STRIPE_ENABLED && <ShowcaseStripeCard />}
          </div>

          {/* Discord CTA */}
          <div className="mt-4 rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-4">
            <p className="text-xs text-indigo-300 font-bold mb-1">After payment — join Discord to get your key</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
              Send leaq your payment receipt in the Opti Gods Discord server. Keys are delivered manually — usually within minutes.
            </p>
            <a
              href="https://discord.gg/optigods"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-discord-join"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors w-full"
            >
              <SiDiscord className="w-4 h-4" />
              Join the Opti Gods Discord
            </a>
          </div>
        </div>

        {/* ── Results grid ───────────────────────────────────────── */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 border-b border-white/5">
          {RESULTS.map((r, i) => (
            <motion.div
              key={r.game}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className={cn("rounded-xl border bg-gradient-to-br to-zinc-900/60 p-5 flex flex-col gap-3", r.color, r.glow)}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold bg-black/50 border border-white/10 px-2 py-0.5 rounded-full text-white">{r.badge}</span>
                <span className={cn("text-[10px] font-black", r.statColor)}>{r.stat}</span>
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

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="px-5 py-5 text-center space-y-3">
          <p className="text-[11px] text-zinc-500">
            Questions? Join the server — leaq answers personally.
          </p>
          <a
            href="https://discord.gg/optigods"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-discord-footer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            <SiDiscord className="w-3.5 h-3.5" />
            discord.gg/optigods
          </a>
          <div>
            <a
              href="/admin"
              data-testid="link-admin-showcase"
              className="text-[10px] text-zinc-800 hover:text-zinc-600 transition-colors font-mono tracking-wider"
            >
              admin
            </a>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
