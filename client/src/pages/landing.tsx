import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api-base";
import { APP_VERSION } from "@/generated/version";
import { motion } from "framer-motion";
import {
  Download, Zap, Cpu, Shield, Sparkles, Bot, MonitorCog,
  Check, Star, ExternalLink, CreditCard, ArrowRight, RotateCcw,
  Gamepad2, SlidersHorizontal, ChevronRight,
} from "lucide-react";
import { SiDiscord, SiCashapp, SiPaypal } from "react-icons/si";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { OptiGodsWordmark } from "@/components/branding/opti-gods-wordmark";
import { ProUnlockButton } from "@/components/pro-gate";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";

const DISCORD_INVITE = "https://discord.gg/optigods";
const CASHAPP_TAG = (import.meta.env.VITE_CASHAPP_TAG as string | undefined) || "$my1ik";
const PAYPAL_LINK = (import.meta.env.VITE_PAYPAL_LINK as string | undefined) || "https://paypal.me/accountslg";
const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === "true";

const FEATURES = [
  {
    icon: Cpu,
    title: "Hardware-Aware — Every Rig",
    desc: `${TOTAL_TWEAKS_LABEL} tweaks matched to your exact GPU, CPU, and RAM. NVIDIA, AMD, Intel iGPU, AMD Vega — Alienware, CyberPowerPC, Dell, Lenovo, HP, ASUS, iBUYPOWER — any Windows PC covered.`,
  },
  {
    icon: Zap,
    title: "Proven FPS Gains",
    desc: "100+ FPS on Fortnite for laptop users. 120+ on FiveM. 300+ on Valorant. Game packs for every major title — not promises, verified results.",
  },
  {
    icon: Bot,
    title: "Opti Gods AI",
    desc: "Chat with an AI optimizer that builds personalized presets and explains every tweak in plain English. If a tweak isn't right for your rig, it tells you.",
  },
];

const REVIEWS = [
  { name: "ProkPvP", handle: "FiveM TMFRZ", text: "Went from 187 FPS capped to 250+. leaq actually knows what he's doing.", stars: 5 },
  { name: "Nyxion", handle: "Fortnite Comp", text: "300 FPS on a GTX 1650 Super. Verified. I screen-recorded it. Insane.", stars: 5 },
  { name: "rxqer", handle: "FiveM RP", text: "10/10 — best $25 I've spent on my PC. Smoother than a fresh Windows install.", stars: 5 },
  { name: "shaa", handle: "Valorant Radiant", text: "Latency dropped from 18ms to 4ms after the network pack. Aim feels different.", stars: 5 },
  { name: "kqzy", handle: "FiveM Hub Owner", text: "Ran it on 6 of our staff PCs. Zero crashes. Big FPS gain on every single one.", stars: 5 },
  { name: "ainq", handle: "Apex Predator", text: "Tweaks are real. AI assistant is the cherry on top — built me a Streamer Mode preset in 30 sec.", stars: 5 },
  { name: "mythz", handle: "Call of Duty Ranked", text: "Smooth as butter. The DPC latency tweak alone is worth the price.", stars: 5 },
  { name: "velcz", handle: "Dell G15 Laptop", text: "Was getting 60 FPS on Fortnite on my Dell laptop. Now sitting at 165+ consistently. Didn't think it was possible.", stars: 5 },
  { name: "drxpz", handle: "Lenovo Legion FiveM", text: "Laptop went from 80 FPS to 200 on FiveM. The iGPU tab is real — leaq is the only one covering this.", stars: 5 },
  { name: "trvpx", handle: "Valorant Gold → Plat", text: "Went from 180 FPS to 300+ on my budget build. The network and registry packs together are insane.", stars: 5 },
];

const FAQS = [
  {
    q: "What does Opti Gods actually do?",
    a: `Opti Gods is a Windows 10/11 desktop app with ${TOTAL_TWEAKS_LABEL} hardware-aware optimizations across registry, network, GPU (NVIDIA/AMD/Intel iGPU/AMD Vega), memory, power, and per-game packs (FiveM, Fortnite, Call of Duty, Valorant, Apex, Warzone). You pick what to apply, hit "Full Optimize", and the app generates a custom PowerShell script — boosting FPS and shredding input latency. Proven results: 100+ FPS gains on Fortnite for laptop users, 120+ on FiveM, 300+ on Valorant.`,
  },
  {
    q: "How much FPS can I actually gain?",
    a: "Real results from the community: 100+ FPS gains on Fortnite (including laptops with integrated graphics), 120+ FPS gains on FiveM, and up to 300+ FPS on Valorant. Results depend on your hardware — the optimizer detects your exact rig and only applies tweaks that help it. Laptop users running Intel or AMD integrated graphics typically see the largest percentage gains because those configs are the most under-optimized out of the box.",
  },
  {
    q: "Does Opti Gods work on any PC — Alienware, CyberPowerPC, Dell, Lenovo?",
    a: "Yes — any Windows PC. Opti Gods works on custom desktops, Alienware, CyberPowerPC, iBUYPOWER, MSI, Dell, Lenovo, HP, ASUS, Acer, and any other OEM build. It has a dedicated Laptop tab, Intel iGPU tab, and AMD iGPU (Vega) tab. WMI-based hardware detection automatically skips tweaks that don't apply to your rig — nothing unsafe is ever applied.",
  },
  {
    q: "Is this safe for my PC?",
    a: "Yes. Every tweak is reversible and Opti Gods always prompts you to create a Windows Restore Point first. Nothing is hidden — you can preview the exact PowerShell commands before they run, and undo any individual tweak from the dashboard. Tweaks marked as 'expert-only' are separated and never auto-applied.",
  },
  {
    q: "Why does Windows SmartScreen show a warning when I run the installer?",
    a: "Brand-new installers always trigger SmartScreen until they build up enough downloads with Microsoft's reputation system — even after they're code-signed. Click \"More info\" → \"Run anyway\". The installer is signed and the hash matches what's published in our Discord #releases channel.",
  },
  {
    q: "Does it work on Windows 11?",
    a: "Yes — Opti Gods fully supports Windows 10 and Windows 11 (22H2, 23H2, 24H2). The optimizer auto-detects your OS version and applies the correct version-specific tweaks for each.",
  },
  {
    q: "Is this a one-time purchase?",
    a: "Yes. $20 one-time gets you lifetime Pro access — all current and future tweaks, presets, AI assistant, and updates. No subscription, ever.",
  },
  {
    q: "What's the refund policy?",
    a: "If Opti Gods doesn't deliver real, measurable FPS gains on your PC within 7 days, message leaq directly in Discord for a full refund. We'd rather give your money back than have an unhappy customer.",
  },
  {
    q: "How do I get support?",
    a: "Join the Discord (discord.gg/optigods) for instant help from leaq and the community. Verified reviews, dedicated tickets channel, and most issues resolved within hours.",
  },
  {
    q: "Do I need to be technical?",
    a: "No. Hit \"Full Optimize\", review the suggested tweaks, click apply, and reboot. The built-in AI assistant walks you through anything confusing — and you can ask it questions before you even buy, right here on the website.",
  },
];

function MovedBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("moved") === "1") {
      setShow(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("moved");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  if (!show) return null;
  return (
    <div
      data-testid="banner-moved"
      className="bg-red-500/10 border-b border-red-500/30 text-red-200 text-sm py-2.5 px-4 text-center"
    >
      <span className="font-bold">Opti Gods is now a desktop app.</span>{" "}
      Download the Windows installer below — same optimizer, faster and offline.
    </div>
  );
}

function StarsRow({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-red-500 text-red-500" />
      ))}
    </div>
  );
}

function ReviewsCarousel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % REVIEWS.length), 5000);
    return () => clearInterval(t);
  }, []);
  // show 3 cards on desktop, sliding window
  const visible = [0, 1, 2].map((o) => REVIEWS[(idx + o) % REVIEWS.length]);
  return (
    <div className="grid md:grid-cols-3 gap-4" data-testid="carousel-reviews">
      {visible.map((r, i) => (
        <motion.div
          key={`${idx}-${i}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="rounded-xl border border-white/5 bg-zinc-950/60 p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{r.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{r.handle}</p>
            </div>
            <StarsRow n={r.stars} />
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">"{r.text}"</p>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 flex items-center gap-1 mt-auto">
            <Check className="w-3 h-3" /> Verified review
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function DownloadButton() {
  const onClick = () => {
    const a = document.createElement("a");
    a.href = apiUrl("/api/download/latest");
    a.download = `OptiGods-Setup-${APP_VERSION}.exe`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        data-testid="button-download-windows"
        onClick={onClick}
        className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-display font-black text-base md:text-lg px-8 md:px-10 py-6 md:py-7 rounded-xl border border-red-400/40 shadow-[0_0_40px_-4px_rgba(220,38,38,0.6)] hover:shadow-[0_0_60px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02] transition-all"
      >
        <Download className="w-5 h-5 md:w-6 md:h-6 mr-3" />
        Download for Windows
      </Button>
      <p className="text-[11px] text-zinc-500" data-testid="text-download-version">
        Windows 10 / 11 · 64-bit · v{APP_VERSION} · ~139 MB
      </p>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative w-full" data-testid="landing-product-preview">
      <div className="absolute -inset-8 rounded-[3rem] bg-red-600/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b0d11] shadow-[0_30px_100px_-30px_rgba(239,68,68,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/40 bg-red-500/10">
              <span className="font-display text-[10px] font-black text-red-400">OG</span>
            </div>
            <div>
              <p className="font-display text-[11px] font-black uppercase tracking-[0.18em] text-white">Opti Gods</p>
              <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-zinc-600">Performance control</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300 sm:inline-flex">
              Scan complete
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          </div>
        </div>

        <div className="grid grid-cols-[104px_1fr] md:grid-cols-[144px_1fr]">
          <aside className="border-r border-white/10 bg-black/20 p-2.5 md:p-3">
            <div className="mb-3 px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-600">Workspace</div>
            {[
              { icon: MonitorCog, label: "Overview", active: true },
              { icon: SlidersHorizontal, label: "Tweaks" },
              { icon: Gamepad2, label: "Game packs" },
              { icon: Bot, label: "AI assistant" },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold transition-colors md:px-3 md:text-[11px] ${
                  active
                    ? "border border-red-500/30 bg-red-500/10 text-white"
                    : "text-zinc-500"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-red-400" : "text-zinc-600"}`} />
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
            <div className="mt-8 hidden border-t border-white/10 pt-3 sm:block">
              <p className="px-2 text-[9px] font-semibold text-zinc-500">Detected system</p>
              <p className="mt-1 px-2 text-[9px] leading-relaxed text-zinc-700">Windows 11 · NVIDIA GPU · 32 GB RAM</p>
            </div>
          </aside>

          <div className="min-w-0 p-3 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">System scan</p>
                <h3 className="mt-1 font-display text-lg font-black tracking-tight text-white md:text-2xl">Ready to optimize.</h3>
                <p className="mt-1 text-[10px] text-zinc-500 md:text-xs">Recommendations matched to your exact hardware.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-2">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-300">Restore point ready</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { value: TOTAL_TWEAKS_LABEL, label: "matched tweaks", color: "text-red-400" },
                { value: "15+", label: "game profiles", color: "text-amber-300" },
                { value: "1-click", label: "custom script", color: "text-emerald-300" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-black/20 p-2.5 md:p-3">
                  <p className={`font-display text-sm font-black md:text-xl ${stat.color}`}>{stat.value}</p>
                  <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-600 md:text-[9px]">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-white md:text-xs">Performance overview</p>
                  <p className="mt-1 text-[8px] text-zinc-600 md:text-[9px]">Preview your system before applying changes</p>
                </div>
                <span className="rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-red-300">Live scan</span>
              </div>
              <div className="mt-4 h-24 w-full overflow-hidden rounded-lg border border-white/5 bg-[#08090b] p-2 md:h-32">
                <svg viewBox="0 0 480 120" className="h-full w-full" preserveAspectRatio="none" aria-label="Performance trend preview">
                  <path d="M0 92 L48 76 L82 82 L126 56 L166 68 L204 42 L244 58 L282 32 L318 48 L360 20 L405 36 L480 10" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="3" />
                  <path d="M0 103 L48 96 L82 100 L126 86 L166 92 L204 78 L244 84 L282 70 L318 76 L360 62 L405 68 L480 54" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                  <path d="M0 114 H480 M0 80 H480 M0 46 H480" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                </svg>
              </div>
              <div className="mt-3 flex items-center justify-between text-[8px] text-zinc-600 md:text-[9px]">
                <span>Stock profile</span>
                <span className="flex items-center gap-1.5 text-red-300"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Optimized profile</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[9px] font-bold text-zinc-200 md:text-[10px]">Ready for your next session</span>
              </div>
              <span className="flex items-center gap-1 text-[9px] font-bold text-red-300">Review tweaks <ChevronRight className="h-3 w-3" /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingDesktop() {
  return (
    <div
      data-testid="page-landing"
      className="relative min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-40 top-0 h-[720px] w-[720px] rounded-full bg-red-600/10 blur-[160px]" />
        <div className="absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-red-900/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <MovedBanner />

      <header className="relative z-10 border-b border-white/[0.07]">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 md:px-10 xl:px-16">
          <Link href="/" className="shrink-0" data-testid="link-nav-brand">
            <OptiGodsWordmark variant="inline" className="rounded-xl border-red-500/30 px-3 py-2 md:px-4 md:py-2.5" />
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 md:flex">
          <a
            href="#features"
            className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            data-testid="link-nav-features"
          >
            Features
          </a>
          <a
            href="#reviews"
            className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            data-testid="link-nav-reviews"
          >
            Reviews
          </a>
          <a
            href="#faq"
            className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            data-testid="link-nav-faq"
          >
            FAQ
          </a>
          <Link
            href="/ai"
            className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            data-testid="link-nav-ai"
          >
            AI assistant
          </Link>
          </nav>
          <div className="flex items-center gap-2">
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/15 px-3 py-2 text-xs font-bold text-[#c0c5ff] transition-colors hover:bg-[#5865F2]/25 sm:inline-flex"
            data-testid="link-nav-discord"
          >
            <SiDiscord className="w-3.5 h-3.5" /> Discord
          </a>
          <a
            href="#download"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2.5 text-xs font-black text-white shadow-[0_0_24px_-8px_rgba(239,68,68,0.9)] transition-all hover:bg-red-500 hover:shadow-[0_0_32px_-8px_rgba(239,68,68,1)]"
            data-testid="link-nav-download"
          >
            Download free <Download className="h-3.5 w-3.5" />
          </a>
          </div>
        </div>
      </header>

      <section className="relative z-10 w-full px-5 pb-16 pt-12 md:px-10 md:pb-24 md:pt-20 xl:px-16">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="min-w-0"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-red-300 md:text-[10px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
              Hardware-aware performance control
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl md:text-7xl">
              Your PC has more
              <span className="block text-red-500">performance in it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg">
              Opti Gods scans your Windows PC, matches recommendations to your exact hardware, and gives you control over the tweaks that matter for gaming.
            </p>
            <div id="download" className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <DownloadButton />
              <Link
                href="/showcase"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm font-bold text-zinc-200 transition-colors hover:border-red-500/30 hover:bg-red-500/5"
                data-testid="link-hero-results"
              >
                See real results <ArrowRight className="h-4 w-4 text-red-400" />
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-2 gap-x-5 gap-y-3 border-t border-white/10 pt-6 text-[11px] text-zinc-500 sm:grid-cols-4">
              <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Reversible</span>
              <span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 text-amber-300" /> Restore point</span>
              <span className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-blue-300" /> Any Windows PC</span>
              <span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-red-400" /> One-click scripts</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 18, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
            className="min-w-0"
          >
            <ProductPreview />
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 w-full border-y border-white/[0.07] bg-black/20 px-5 py-8 md:px-10 xl:px-16">
        <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: TOTAL_TWEAKS_LABEL, label: "hardware-aware tweaks", color: "text-red-400" },
            { value: "15+", label: "game-specific packs", color: "text-amber-300" },
            { value: "Windows 10/11", label: "desktop + laptop support", color: "text-blue-300" },
            { value: "$20", label: "lifetime Pro access", color: "text-emerald-300" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 border-white/10 sm:border-r sm:px-4 first:sm:pl-0 last:border-0">
              <span className={`font-display text-xl font-black md:text-2xl ${stat.color}`}>{stat.value}</span>
              <span className="max-w-[120px] text-[10px] uppercase leading-relaxed tracking-[0.12em] text-zinc-600">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="relative z-10 w-full px-5 py-20 md:px-10 md:py-24 xl:px-16">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">One tool. Your whole rig.</span>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-black tracking-tight text-white md:text-5xl">
              Stop guessing. Start optimizing with context.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
            No random tweak packs. Opti Gods checks your system first so you can review what applies before anything changes.
          </p>
        </div>
        <div className="grid w-full gap-4 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              data-testid={`card-feature-${i}`}
              className="group rounded-2xl border border-white/10 bg-[#0a0b0f]/80 p-6 transition-all hover:-translate-y-1 hover:border-red-500/30 hover:bg-red-950/10 md:p-7"
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
                  <f.icon className="h-5 w-5 text-red-400" />
                </div>
                <span className="font-mono text-[10px] text-zinc-700">0{i + 1}</span>
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.desc}</p>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-red-300 opacity-0 transition-opacity group-hover:opacity-100">
                Explore the workflow <ArrowRight className="h-3 w-3" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 w-full px-5 py-16 md:px-10 md:py-20 xl:px-16">
        <div className="grid w-full items-center gap-10 rounded-[1.5rem] border border-red-500/20 bg-gradient-to-br from-red-950/25 via-[#0b0b0f] to-black p-6 md:p-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">A cleaner workflow</span>
            <h2 className="mt-3 font-display text-3xl font-black tracking-tight text-white md:text-4xl">From scan to session in four moves.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
              The app keeps the process visible: detect your rig, review the recommendations, generate your script, then play with a record of what changed.
            </p>
            <Link href="/ai" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-red-300 transition-colors hover:text-white" data-testid="link-workflow-ai">
              Ask Opti Gods AI about your rig <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { n: "01", title: "Detect", desc: "CPU, GPU, RAM, OS, laptop status, and game context." },
              { n: "02", title: "Review", desc: "See what is recommended and why it fits your system." },
              { n: "03", title: "Generate", desc: "Create a custom PowerShell script with one click." },
              { n: "04", title: "Optimize", desc: "Apply, reboot when needed, and undo individual changes." },
            ].map((step) => (
              <div key={step.n} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-red-400">{step.n}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-700" />
                </div>
                <h3 className="mt-5 font-display text-lg font-black text-white">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="reviews" className="relative z-10 w-full px-5 py-16 md:px-10 md:py-20 xl:px-16">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Community proof</span>
            <h2 className="mt-2 font-display text-3xl font-black text-white md:text-4xl">Real PCs. Real feedback.</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-500">See the full review conversation, troubleshooting help, and preset drops inside Discord.</p>
        </div>
        <div className="flex justify-center">
          <a
            href="https://discord.gg/optigods"
            target="_blank"
            rel="noreferrer"
            data-testid="link-reviews-discord"
            className="inline-flex items-center gap-2 rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/20 px-6 py-3 text-sm font-bold text-[#a5adff] transition-colors hover:bg-[#5865F2]/30"
          >
            <SiDiscord className="w-4 h-4" /> See verified reviews in Discord
          </a>
        </div>
        <div className="mt-8">
          <ReviewsCarousel />
        </div>
      </section>

      <section id="pricing" className="relative z-10 w-full px-5 py-16 md:px-10 md:py-20 xl:px-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid w-full gap-10 rounded-[1.5rem] border border-red-500/30 bg-gradient-to-br from-red-950/30 to-zinc-950/80 p-6 md:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Pro access</span>
            <h2 className="mt-3 max-w-lg font-display text-3xl font-black tracking-tight text-white md:text-5xl">Go deeper when you’re ready.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
              Start with the free download. Upgrade once for lifetime access to the full tweak library, AI presets, and future updates.
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-6xl font-black text-white">$20</span>
              <span className="text-sm text-zinc-500">one-time · lifetime</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5 md:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                `${TOTAL_TWEAKS_LABEL} tweaks across 15+ tabs`,
                "FiveM, Fortnite, Call of Duty, Valorant packs",
                "Opti Gods AI assistant",
                "Game auto-detection",
                "Preset save / load",
                "Lifetime updates",
              ].map((b) => (
                <div key={b} className="flex items-start gap-2 text-xs text-zinc-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-2">
            <ProUnlockButton>
              <Button
                data-testid="button-unlock-pro-landing"
                className="w-full rounded-lg bg-red-600 py-5 text-sm font-bold tracking-wide text-white hover:bg-red-500"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Unlock Pro — $20 Lifetime
              </Button>
            </ProUnlockButton>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`https://cash.app/${CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}`}
                target="_blank"
                rel="noreferrer"
                data-testid="link-pay-cashapp"
                className="flex items-center justify-center gap-2 rounded-lg border border-[#00D632]/30 bg-[#00D632]/10 py-3 text-xs font-bold text-[#00D632] transition-colors hover:bg-[#00D632]/20"
              >
                <SiCashapp className="w-4 h-4" /> CashApp
              </a>
              <a
                href={PAYPAL_LINK}
                target="_blank"
                rel="noreferrer"
                data-testid="link-pay-paypal"
                className="flex items-center justify-center gap-2 rounded-lg border border-[#003087]/40 bg-[#003087]/10 py-3 text-xs font-bold text-[#5b8def] transition-colors hover:bg-[#003087]/20"
              >
                <SiPaypal className="w-4 h-4" /> PayPal
              </a>
            </div>

            <a
              href="https://buy.stripe.com/5kQdRacgM48Yb4Y4WD14400"
              target="_blank"
              rel="noreferrer"
              data-testid="link-landing-stripe"
              className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-600/10 py-3 text-xs font-bold text-red-400 transition-colors hover:bg-red-600/20"
            >
              <CreditCard className="w-4 h-4" /> Pay with Card — Stripe
            </a>
          </div>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 w-full px-5 py-12 md:px-10 xl:px-16">
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noreferrer"
          data-testid="link-discord-cta"
          className="group block w-full rounded-2xl border border-[#5865F2]/30 bg-gradient-to-r from-[#5865F2]/15 to-[#5865F2]/5 p-6 transition-colors hover:border-[#5865F2]/60 md:p-8"
        >
          <div className="flex items-center gap-5 flex-wrap">
            <div className="w-14 h-14 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center shrink-0">
              <SiDiscord className="w-7 h-7 text-[#a5adff]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-display font-black text-white">
                1,000+ rigs optimized — desktops, laptops, OEM builds
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                Live support from leaq, laptop &amp; iGPU advice, free preset drops, and verified review channel.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs transition-colors">
              Join Discord <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </a>
      </section>

      <section id="faq" className="relative z-10 w-full px-5 py-16 md:px-10 md:py-20 xl:px-16">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">FAQ</span>
          <h2 className="text-2xl md:text-3xl font-display font-black text-white mt-2">
            Common questions
          </h2>
        </div>
        <div className="grid w-full gap-x-12 lg:grid-cols-2">
          <Accordion type="single" collapsible className="w-full" data-testid="accordion-faq">
            {FAQS.slice(0, 5).map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="border-white/10">
                <AccordionTrigger data-testid={`faq-trigger-${i}`} className="text-left text-white hover:text-red-400 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-zinc-400 leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible className="w-full" data-testid="accordion-faq-secondary">
            {FAQS.slice(5).map((f, i) => (
              <AccordionItem key={f.q} value={`faq-secondary-${i}`} className="border-white/10">
                <AccordionTrigger className="text-left text-white hover:text-red-400 hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-zinc-400 leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 mt-10">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-zinc-500 md:px-10 xl:px-16">
          <div className="flex items-center gap-3">
            <span className="font-display font-black text-white">OPTI GODS</span>
            <span className="text-zinc-700">·</span>
            <span>by leaq · all rights reserved</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
              data-testid="link-footer-discord"
            >
              <SiDiscord className="w-3.5 h-3.5" /> Discord
            </a>
            <Link
              href="/ai"
              className="hover:text-white transition-colors flex items-center gap-1.5"
              data-testid="link-footer-ai"
            >
              <Bot className="w-3.5 h-3.5" /> AI Assistant
            </Link>
            <a href="#faq" className="hover:text-white transition-colors" data-testid="link-footer-faq">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Landing() {
  return <LandingDesktop />;
}
