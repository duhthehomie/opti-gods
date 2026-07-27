import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { Zap, Trophy, TrendingUp, Star, Cpu, Monitor, Wifi, HardDrive, CheckCircle, ExternalLink, Copy, CreditCard, Laptop } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { BRAND } from "@/components/branding/assets";
import { cn } from "@/lib/utils";

const CASHAPP_TAG = import.meta.env.VITE_CASHAPP_TAG || "$my1ik";
const PAYPAL_LINK = import.meta.env.VITE_PAYPAL_LINK || "paypal.me/accountslg";

const RESULTS = [
  {
    game: "FiveM Roleplay",
    before: "48 FPS",
    after: "120+ FPS",
    hw: "i7-10700 / GTX 1650 Super",
    badge: "🏆 FiveM RP",
    accent: "#ef4444",
    glow: "rgba(239,68,68,0.25)",
    border: "rgba(239,68,68,0.4)",
    stat: "2.5× improvement",
  },
  {
    game: "Fortnite Freebuild",
    before: "120 FPS",
    after: "300+ FPS",
    hw: "GTX 1650 Super",
    badge: "⚡ Fortnite",
    accent: "#3b82f6",
    glow: "rgba(59,130,246,0.25)",
    border: "rgba(59,130,246,0.4)",
    stat: "2.5× multiplier",
  },
  {
    game: "FiveM TMFRZ",
    before: "187 FPS",
    after: "250+ FPS",
    hw: "GTX 1650 Super / 16GB",
    badge: "🎯 FiveM PvP",
    accent: "#f97316",
    glow: "rgba(249,115,22,0.25)",
    border: "rgba(249,115,22,0.4)",
    stat: "Uncapped headroom",
  },
  {
    game: "Fortnite Creative",
    before: "60 FPS",
    after: "300+ FPS",
    hw: "Integrated Graphics",
    badge: "💻 iGPU",
    accent: "#22c55e",
    glow: "rgba(34,197,94,0.25)",
    border: "rgba(34,197,94,0.4)",
    stat: "5× improvement",
  },
  {
    game: "Fortnite Battle Bus",
    before: "120 FPS",
    after: "250–400 FPS",
    hw: "High-end rig",
    badge: "🚀 Max Frames",
    accent: "#a855f7",
    glow: "rgba(168,85,247,0.25)",
    border: "rgba(168,85,247,0.4)",
    stat: "No cap limiting",
  },
  {
    game: "Multi-app Stability",
    before: "Crashes",
    after: "Smooth + Stable",
    hw: "All systems",
    badge: "🔧 Reliability",
    accent: "#eab308",
    glow: "rgba(234,179,8,0.25)",
    border: "rgba(234,179,8,0.4)",
    stat: "Discord + gaming",
  },
];

const STATS = [
  { icon: Zap,        value: TOTAL_TWEAKS_LABEL, label: "Tweaks",      color: "#ef4444" },
  { icon: TrendingUp, value: "8×",               label: "Avg FPS Boost",color: "#22c55e" },
  { icon: Cpu,        value: "100%",             label: "Hardware Used",color: "#3b82f6" },
  { icon: Star,       value: "5★",               label: "Reviews",      color: "#eab308" },
  { icon: Wifi,       value: "−30%",             label: "Latency",      color: "#06b6d4" },
  { icon: HardDrive,  value: "0",                label: "Bloat Left",   color: "#a855f7" },
];

const STEPS = [
  { n: "01", title: "Pay $20 — CashApp or PayPal", desc: "One-time payment. Lifetime access. Use the buttons below." },
  { n: "02", title: "DM leaq on Discord with proof", desc: "Screenshot your receipt and send it to leaq in the Discord server." },
  { n: "03", title: "Open optigods.com on your PC", desc: "You MUST be on a Windows computer or laptop — not mobile — to download." },
  { n: "04", title: "Enter your key & unlock Pro", desc: "Paste your access code in the app — all tweaks unlocked instantly." },
];

function ShowcaseStripeCard() {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(20,0,0,0.6)", border: "1px solid rgba(239,68,68,0.25)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>Card</span>
        <span className="text-xs font-black" style={{ color: "#f87171" }}>Stripe — instant</span>
      </div>
      <button
        data-testid="button-stripe-showcase"
        onClick={() => window.open("https://buy.stripe.com/5kQdRacgM48Yb4Y4WD14400", "_blank")}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold transition-all"
        style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)", boxShadow: "0 0 16px rgba(220,38,38,0.35)" }}
      >
        <CreditCard className="w-3.5 h-3.5" />
        Pay with Card — $20
      </button>
    </div>
  );
}

export default function Showcase() {
  const [copied, setCopied] = useState<"cashapp" | "paypal" | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const copy = (text: string, which: "cashapp" | "paypal") => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ background: "#080808", minHeight: "100vh" }}>

        {/* ── HERO ───────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden px-5 pt-10 pb-8 text-center"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(200,20,20,0.18) 0%, transparent 70%)" }}
        >
          {/* Grid lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(255,30,30,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,30,30,0.05) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          {/* Spinning logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 mb-5 flex justify-center"
          >
            {videoFailed ? (
              <div style={{ position: "relative", width: 96, height: 96 }}>
                <div style={{
                  width: 96, height: 96, borderRadius: "50%",
                  border: "3px solid rgba(255,80,20,0.18)",
                  borderTopColor: "#ff5010",
                  animation: "og-hero-spin 1.2s linear infinite",
                  boxShadow: "0 0 36px rgba(255,80,20,0.6), inset 0 0 14px rgba(255,80,20,0.25)",
                }} />
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 900, color: "#ff6020", letterSpacing: "0.05em",
                }}>OG</div>
                <style>{`@keyframes og-hero-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <video
                src={BRAND.spinWhiteGold}
                autoPlay
                muted
                playsInline
                loop
                onError={() => setVideoFailed(true)}
                style={{
                  width: 104, height: 104, objectFit: "contain",
                  filter: "drop-shadow(0 0 22px rgba(255,160,30,0.65))",
                }}
              />
            )}
          </motion.div>

          {/* Neon title box — matches reference screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="relative z-10 inline-block mb-4"
          >
            {/* outer glow halo */}
            <div style={{
              position: "absolute", inset: -8, borderRadius: 18,
              background: "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(220,60,0,0.22) 0%, transparent 70%)",
              filter: "blur(8px)",
              pointerEvents: "none",
            }} />
            <div
              className="inline-block rounded-xl px-8 py-4"
              style={{
                border: "1.5px solid rgba(230,80,20,0.7)",
                boxShadow: "0 0 40px rgba(200,50,0,0.4), 0 0 80px rgba(200,50,0,0.15), inset 0 0 28px rgba(200,50,0,0.08)",
                background: "rgba(10,3,0,0.6)",
              }}
            >
              <h1
                className="text-4xl font-black tracking-[0.18em] leading-none"
                style={{
                  background: "linear-gradient(90deg, #ffb340 0%, #ff7a20 30%, #ff4040 65%, #ff2060 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 8px rgba(255,100,20,0.5))",
                }}
              >
                OPTI GODS
              </h1>
              <p className="text-[11px] tracking-[0.55em] mt-2 uppercase font-bold text-center" style={{ color: "rgba(255,255,255,0.55)", textShadow: "0 0 8px rgba(255,255,255,0.2)" }}>
                by leaq
              </p>
            </div>
          </motion.div>

          {/* Tags row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative z-10 flex items-center justify-center flex-wrap gap-1 mb-5"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ff5020" }} />
            <span className="text-[10px] font-mono tracking-widest" style={{ color: "rgba(255,180,100,0.5)" }}>
              {TOTAL_TWEAKS_LABEL} TWEAKS · DESKTOPS · LAPTOPS · DELL · LENOVO · ASUS · HP · V4
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="relative z-10">
            <h2 className="text-[1.65rem] font-black text-white leading-snug mb-2">
              The <span className="text-white">#1 Windows PC</span>
              <br />
              <span className="text-white">optimizer</span>{" "}
              <span style={{ color: "#ff4d20", textShadow: "0 0 20px rgba(255,77,32,0.5)" }}>that actually</span>
              <br />
              <span style={{ color: "#ff4d20", textShadow: "0 0 20px rgba(255,77,32,0.5)" }}>works.</span>
            </h2>
            <p className="text-sm leading-relaxed max-w-[320px] mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
              <span className="font-black text-white">100+ FPS on Fortnite. 120+ on FiveM. 300+ on Valorant.</span>{" "}
              Desktops, Laptops, Dell, Lenovo, HP, ASUS — every rig covered. Built by leaq, verified by thousands.
            </p>
          </motion.div>
        </div>

        {/* ── DESKTOP-ONLY NOTICE ─────────────────────────────────── */}
        <div className="px-4 py-3">
          <div
            className="rounded-xl px-4 py-3.5 flex items-start gap-3"
            style={{
              background: "rgba(30,15,0,0.8)",
              border: "1px solid rgba(251,146,60,0.5)",
              boxShadow: "0 0 20px rgba(251,146,60,0.12)",
            }}
          >
            <Monitor className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#fb923c" }} />
            <div>
              <p className="text-xs font-black uppercase tracking-wide mb-0.5" style={{ color: "#fdba74" }}>
                ⚠️ Computer / Laptop Only
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Opti Gods can{" "}
                <strong className="text-white">ONLY be downloaded and run on a Windows computer or laptop</strong>.
                The app is not available on mobile devices. Pay here on mobile → DM leaq on Discord → install on your PC.
              </p>
            </div>
          </div>
        </div>

        {/* ── STATS GRID ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 mx-4 rounded-xl overflow-hidden mb-1" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-col items-center justify-center gap-1 py-4 px-1 text-center"
              style={{
                background: `linear-gradient(160deg, rgba(10,10,10,0.98) 0%, rgba(5,5,5,1) 100%)`,
                boxShadow: `inset 0 0 24px ${s.color}11`,
                borderRight: i % 3 !== 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color, filter: `drop-shadow(0 0 4px ${s.color})` }} />
              <span className="text-lg font-black" style={{ color: s.color, textShadow: `0 0 16px ${s.color}99, 0 0 32px ${s.color}44` }}>
                {s.value}
              </span>
              <span className="text-[9px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>
                {s.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* ── GET PRO ─────────────────────────────────────────────── */}
        <div
          className="mx-4 my-4 rounded-xl px-4 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, rgba(30,0,0,0.9) 0%, rgba(10,0,0,0.95) 100%)",
            border: "1px solid rgba(220,38,38,0.3)",
            boxShadow: "0 0 30px rgba(220,38,38,0.1)",
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: "#fbbf24" }} />
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#ef4444" }}>
              Get Pro — $20 Lifetime
            </p>
            <Trophy className="w-4 h-4" style={{ color: "#fbbf24" }} />
          </div>
          <h3 className="text-xl font-black text-white text-center mb-1">Want These Results?</h3>
          <p className="text-[11px] text-center mb-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            Pay below → DM leaq on Discord with proof → receive your key within minutes
          </p>

          {/* Steps */}
          <div className="space-y-2.5 mb-5">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-3 px-1">
                <span
                  className="text-[10px] font-black font-mono mt-0.5 w-5 shrink-0"
                  style={{ color: "#ef4444" }}
                >
                  {s.n}
                </span>
                <div>
                  <p className="text-xs font-bold text-white leading-snug">{s.title}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Payment buttons */}
          <div className="space-y-3">
            {/* CashApp */}
            <div className="rounded-xl p-4" style={{ background: "rgba(0,20,5,0.7)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
                  CashApp
                </span>
                <span className="text-xs font-black" style={{ color: "#4ade80" }}>{CASHAPP_TAG}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://cash.app/${CASHAPP_TAG.replace("$", "%24")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-cashapp-pay"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold transition-all"
                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 0 14px rgba(34,197,94,0.3)" }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Pay {CASHAPP_TAG}
                </a>
                <button
                  data-testid="button-copy-cashapp"
                  onClick={() => copy(CASHAPP_TAG, "cashapp")}
                  className="px-3 rounded-lg transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                >
                  {copied === "cashapp" ? <CheckCircle className="w-4 h-4" style={{ color: "#4ade80" }} /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* PayPal */}
            <div className="rounded-xl p-4" style={{ background: "rgba(0,5,20,0.7)", border: "1px solid rgba(59,130,246,0.25)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
                  PayPal
                </span>
                <span className="text-xs font-black" style={{ color: "#60a5fa" }}>{PAYPAL_LINK}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://${PAYPAL_LINK}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-paypal-pay"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold transition-all"
                  style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 0 14px rgba(59,130,246,0.3)" }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Pay via PayPal
                </a>
                <button
                  data-testid="button-copy-paypal"
                  onClick={() => copy(`https://${PAYPAL_LINK}`, "paypal")}
                  className="px-3 rounded-lg transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                >
                  {copied === "paypal" ? <CheckCircle className="w-4 h-4" style={{ color: "#60a5fa" }} /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <ShowcaseStripeCard />
          </div>

          {/* Discord CTA */}
          <div
            className="mt-4 rounded-xl p-4"
            style={{ background: "rgba(5,5,30,0.8)", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 0 18px rgba(99,102,241,0.1)" }}
          >
            <p className="text-xs font-black mb-0.5" style={{ color: "#a5b4fc" }}>
              After payment — join Discord to get your key
            </p>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Send leaq your payment receipt in the Opti Gods Discord. Keys delivered within minutes.
            </p>
            <a
              href="https://discord.gg/optigods"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-discord-join"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold w-full transition-all"
              style={{ background: "linear-gradient(135deg, #4f46e5, #3730a3)", boxShadow: "0 0 14px rgba(99,102,241,0.35)" }}
            >
              <SiDiscord className="w-4 h-4" />
              Join the Opti Gods Discord
            </a>
          </div>
        </div>

        {/* ── FPS RESULTS ─────────────────────────────────────────── */}
        <div className="px-4 pb-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px" style={{ background: "rgba(239,68,68,0.2)" }} />
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(239,68,68,0.7)" }}>
              Real Results
            </p>
            <div className="flex-1 h-px" style={{ background: "rgba(239,68,68,0.2)" }} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {RESULTS.map((r, i) => (
              <motion.div
                key={r.game}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl p-4"
                style={{
                  background: `linear-gradient(135deg, rgba(10,10,10,0.95) 0%, rgba(5,5,5,1) 100%)`,
                  border: `1px solid ${r.border}`,
                  boxShadow: `0 0 20px ${r.glow}`,
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  >
                    {r.badge}
                  </span>
                  <span className="text-[10px] font-black" style={{ color: r.accent }}>
                    {r.stat}
                  </span>
                </div>
                <h3 className="text-sm font-black text-white mb-2.5">{r.game}</h3>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 rounded-lg px-3 py-2 text-center"
                    style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Before</div>
                    <div className="text-base font-black" style={{ color: "rgba(255,255,255,0.5)" }}>{r.before}</div>
                  </div>
                  <Zap className="w-4 h-4 shrink-0" style={{ color: r.accent, filter: `drop-shadow(0 0 6px ${r.accent})` }} />
                  <div
                    className="flex-1 rounded-lg px-3 py-2 text-center"
                    style={{ background: `rgba(${r.accent.replace('#','').match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',')},0.12)`, border: `1px solid ${r.border}` }}
                  >
                    <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: r.accent, opacity: 0.7 }}>After</div>
                    <div className="text-base font-black text-white">{r.after}</div>
                  </div>
                </div>
                <p className="text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>{r.hw}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── FEATURES STRIP ──────────────────────────────────────── */}
        <div className="px-4 py-5">
          <div
            className="rounded-xl px-4 py-4"
            style={{ background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] uppercase tracking-widest font-bold mb-3 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              What's Included
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["⚡", "580+ Registry Tweaks"],
                ["🎮", "FiveM / Fortnite / CoD"],
                ["🖥️", "NVIDIA + AMD GPU Tuning"],
                ["🌐", "Network Latency Fix"],
                ["💾", "RAM & Memory Optimizer"],
                ["🔒", "Stable, No BSODs"],
                ["🚀", "Startup Speed Boost"],
                ["🛡️", "Pro Key — Lifetime"],
              ].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-[11px] text-white font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        <div className="px-4 pb-6 text-center space-y-3">
          <div
            className="h-px mx-8"
            style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.3), transparent)" }}
          />
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            Questions? leaq answers personally in the Discord.
          </p>
          <a
            href="https://discord.gg/optigods"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-discord-footer"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: "#818cf8" }}
          >
            <SiDiscord className="w-3.5 h-3.5" />
            discord.gg/optigods
          </a>
          <div>
            <a
              href="/admin"
              data-testid="link-admin-showcase"
              className="text-[10px] font-mono tracking-wider transition-colors"
              style={{ color: "rgba(255,255,255,0.08)" }}
            >
              admin
            </a>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
