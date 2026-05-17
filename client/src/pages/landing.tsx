import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Download, Zap, Cpu, Shield, Sparkles, Bot,
  Check, Star, ExternalLink, CreditCard,
} from "lucide-react";
import { SiDiscord, SiCashapp, SiPaypal } from "react-icons/si";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { OptiGodsWordmark } from "@/components/branding/opti-gods-wordmark";
import { ProUnlockButton } from "@/components/pro-gate";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { useIsMobile } from "@/hooks/use-mobile";
import Showcase from "@/pages/showcase";

const DISCORD_INVITE = "https://discord.gg/optigods";
const CASHAPP_TAG = (import.meta.env.VITE_CASHAPP_TAG as string | undefined) || "$my1ik";
const PAYPAL_LINK = (import.meta.env.VITE_PAYPAL_LINK as string | undefined) || "https://paypal.me/accountslg";
const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === "true";

const FEATURES = [
  {
    icon: Cpu,
    title: "Hardware-Aware Tweaks",
    desc: `${TOTAL_TWEAKS_LABEL} optimizations matched to your exact GPU, CPU, and RAM. NVIDIA, AMD, Intel — all covered.`,
  },
  {
    icon: Zap,
    title: "Game-Pack Ready",
    desc: "FiveM, Fortnite, CS2, Valorant, Apex, Warzone packs that boost FPS and shred input latency.",
  },
  {
    icon: Bot,
    title: "Opti Gods AI",
    desc: "Chat with an AI optimizer that builds personalized presets and explains every tweak in plain English.",
  },
];

const REVIEWS = [
  { name: "ProkPvP", handle: "FiveM TMFRZ", text: "Went from 187 FPS capped to 250+. leaq actually knows what he's doing.", stars: 5 },
  { name: "Nyxion", handle: "Fortnite Comp", text: "300 FPS on a GTX 1650 Super. Verified. I screen-recorded it. Insane.", stars: 5 },
  { name: "rxqer", handle: "FiveM RP", text: "10/10 — best $25 I've spent on my PC. Smoother than a fresh Windows install.", stars: 5 },
  { name: "shaa", handle: "Valorant Radiant", text: "Latency dropped from 18ms to 4ms after the network pack. Aim feels different.", stars: 5 },
  { name: "kqzy", handle: "FiveM Hub Owner", text: "Ran it on 6 of our staff PCs. Zero crashes. Big FPS gain on every single one.", stars: 5 },
  { name: "ainq", handle: "Apex Predator", text: "Tweaks are real. AI assistant is the cherry on top — built me a Streamer Mode preset in 30 sec.", stars: 5 },
  { name: "mythz", handle: "CS2 Faceit lvl 10", text: "Smooth as butter. The DPC latency tweak alone is worth the price.", stars: 5 },
];

const FAQS = [
  {
    q: "What does Opti Gods actually do?",
    a: `Opti Gods is a Windows 10/11 desktop app with ${TOTAL_TWEAKS_LABEL} hardware-aware optimizations across registry, network, GPU (NVIDIA/AMD/Intel), memory, power, and per-game packs (FiveM, Fortnite, CS2, Valorant, Apex, Warzone). You pick what to apply, hit "Full Optimize", and the app does the rest — boosting FPS and shredding input latency.`,
  },
  {
    q: "Is this safe for my PC?",
    a: "Yes. Every tweak is reversible and Opti Gods always prompts you to create a Windows Restore Point first. Nothing is hidden — you can preview the exact PowerShell commands before they run, and undo any individual tweak from the dashboard.",
  },
  {
    q: "Why does Windows SmartScreen show a warning when I run the installer?",
    a: "Brand-new installers always trigger SmartScreen until they build up enough downloads with Microsoft's reputation system — even after they're code-signed. Click \"More info\" → \"Run anyway\". The installer is signed and the hash matches what's published in our Discord #releases channel.",
  },
  {
    q: "Does it work on Windows 11?",
    a: "Yes — Opti Gods supports Windows 10 and Windows 11 (22H2, 23H2, 24H2). The optimizer auto-detects your OS and applies version-specific tweaks.",
  },
  {
    q: "Is this a one-time purchase?",
    a: "Yes. $15 one-time gets you lifetime Pro access — all current and future tweaks, presets, AI assistant, and updates. No subscription, ever.",
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
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "coming-soon">("idle");

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/download/latest", {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json" },
      });
      // If server returns JSON (no installer), show "coming soon"
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        if (data?.status === "coming_soon") {
          setState("coming-soon");
          setBusy(false);
          return;
        }
      }
      // Otherwise just navigate — server will 302 to the installer URL
      window.location.href = "/api/download/latest";
      setState("ok");
    } catch {
      setState("coming-soon");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        data-testid="button-download-windows"
        onClick={onClick}
        disabled={busy}
        className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-display font-black text-base md:text-lg px-8 md:px-10 py-6 md:py-7 rounded-xl border border-red-400/40 shadow-[0_0_40px_-4px_rgba(220,38,38,0.6)] hover:shadow-[0_0_60px_-4px_rgba(220,38,38,0.8)] hover:scale-[1.02] transition-all"
      >
        <Download className="w-5 h-5 md:w-6 md:h-6 mr-3" />
        Download for Windows
      </Button>
      <p className="text-[11px] text-zinc-500">
        Windows 10 / 11 · 64-bit · ~25 MB
      </p>
      {state === "coming-soon" && (
        <p
          data-testid="text-coming-soon"
          className="text-xs text-amber-400 mt-1"
        >
          Installer is being signed — drop into the Discord for early access.
        </p>
      )}
    </div>
  );
}

function LandingDesktop() {
  return (
    <div
      data-testid="page-landing"
      className="min-h-screen bg-[#050505] text-white font-sans relative overflow-x-hidden"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 top-0 w-[720px] h-[720px] rounded-full bg-red-600/10 blur-[160px]" />
        <div className="absolute right-0 top-1/3 w-[520px] h-[520px] rounded-full bg-red-900/10 blur-[120px]" />
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

      {/* Top nav */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OptiGodsWordmark variant="inline" />
        </div>
        <nav className="flex items-center gap-2 md:gap-4 text-sm">
          <a
            href="#features"
            className="hidden md:inline text-zinc-400 hover:text-white transition-colors px-3 py-2"
            data-testid="link-nav-features"
          >
            Features
          </a>
          <a
            href="#reviews"
            className="hidden md:inline text-zinc-400 hover:text-white transition-colors px-3 py-2"
            data-testid="link-nav-reviews"
          >
            Reviews
          </a>
          <a
            href="#faq"
            className="hidden md:inline text-zinc-400 hover:text-white transition-colors px-3 py-2"
            data-testid="link-nav-faq"
          >
            FAQ
          </a>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1.5 text-violet-300 hover:text-white transition-colors px-3 py-2 rounded-md border border-violet-500/20 hover:border-violet-500/40 text-xs font-bold"
            data-testid="link-nav-ai"
          >
            <Bot className="w-3.5 h-3.5" /> AI
          </Link>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#a5adff] hover:bg-[#5865F2]/30 text-xs font-bold transition-colors"
            data-testid="link-nav-discord"
          >
            <SiDiscord className="w-3.5 h-3.5" /> Discord
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-20 pb-16 md:pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
          <OptiGodsWordmark variant="hero" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[10px] font-bold tracking-[0.3em] uppercase text-red-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {TOTAL_TWEAKS_LABEL} tweaks · v2 just dropped
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight leading-[1.05] mb-5 max-w-3xl mx-auto">
            The Windows PC optimizer{" "}
            <span className="text-red-500">that actually works.</span>
          </h1>
          <p className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Hardware-aware tweaks for FiveM, Fortnite, CS2, Valorant and every
            major title. Built by leaq — verified PC optimizer with a 200+ member
            Discord community.
          </p>

          <DownloadButton />

          <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Reversible
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-red-400" /> Lifetime $15
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-yellow-400" /> 5-star verified reviews
            </span>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Why Opti Gods</span>
          <h2 className="text-2xl md:text-3xl font-display font-black text-white mt-2">
            One installer. Every tweak you need.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              data-testid={`card-feature-${i}`}
              className="rounded-xl border border-white/5 bg-zinc-950/60 p-6 hover:border-red-500/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Verified Reviews</span>
          <h2 className="text-2xl md:text-3xl font-display font-black text-white mt-2">
            Real PCs. Real FPS gains.
          </h2>
        </div>
        <ReviewsCarousel />
      </section>

      {/* Pricing / Payments */}
      <section id="pricing" className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-950/30 to-zinc-950/80 p-8 md:p-10"
        >
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Pro Access</span>
            <div className="flex items-baseline justify-center gap-1 mt-3">
              <span className="text-5xl md:text-6xl font-display font-black text-white">$15</span>
              <span className="text-sm text-zinc-500 ml-1">one-time · lifetime</span>
            </div>
            <p className="text-sm text-zinc-400 mt-3 max-w-md mx-auto">
              Unlock every tweak, game pack, AI preset, and future update — pay once.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-8 max-w-md mx-auto">
            {[
              `${TOTAL_TWEAKS_LABEL} tweaks across 15+ tabs`,
              "FiveM, Fortnite, CS2, Valorant packs",
              "Opti Gods AI assistant",
              "Game auto-detection",
              "Preset save / load",
              "Lifetime updates",
            ].map((b) => (
              <div key={b} className="flex items-start gap-2 text-xs text-zinc-300">
                <Check className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <ProUnlockButton>
              <Button
                data-testid="button-unlock-pro-landing"
                className="w-full bg-red-600 hover:bg-red-500 text-white font-display font-bold py-5 text-sm tracking-wide rounded-lg"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Unlock Pro — $15 Lifetime
              </Button>
            </ProUnlockButton>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`https://cash.app/${CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}`}
                target="_blank"
                rel="noreferrer"
                data-testid="link-pay-cashapp"
                className="flex items-center justify-center gap-2 py-3 rounded-lg bg-[#00D632]/10 border border-[#00D632]/30 hover:bg-[#00D632]/20 text-[#00D632] text-xs font-bold transition-colors"
              >
                <SiCashapp className="w-4 h-4" /> CashApp
              </a>
              <a
                href={PAYPAL_LINK}
                target="_blank"
                rel="noreferrer"
                data-testid="link-pay-paypal"
                className="flex items-center justify-center gap-2 py-3 rounded-lg bg-[#003087]/10 border border-[#003087]/40 hover:bg-[#003087]/20 text-[#5b8def] text-xs font-bold transition-colors"
              >
                <SiPaypal className="w-4 h-4" /> PayPal
              </a>
            </div>

            {STRIPE_ENABLED && (
              <p className="text-[11px] text-zinc-500 text-center pt-2 flex items-center justify-center gap-1.5">
                <CreditCard className="w-3 h-3" />
                Card payments processed by Stripe via the Unlock button above.
              </p>
            )}
          </div>
        </motion.div>
      </section>

      {/* Discord CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noreferrer"
          data-testid="link-discord-cta"
          className="block rounded-2xl border border-[#5865F2]/30 bg-gradient-to-r from-[#5865F2]/15 to-[#5865F2]/5 p-6 md:p-8 hover:border-[#5865F2]/60 transition-colors group"
        >
          <div className="flex items-center gap-5 flex-wrap">
            <div className="w-14 h-14 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center shrink-0">
              <SiDiscord className="w-7 h-7 text-[#a5adff]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-display font-black text-white">
                Join 200+ optimized PCs in Discord
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                Live support from leaq, build advice, free preset drops, and verified review channel.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs transition-colors">
              Join Discord <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </a>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">FAQ</span>
          <h2 className="text-2xl md:text-3xl font-display font-black text-white mt-2">
            Common questions
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full" data-testid="accordion-faq">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`faq-${i}`}
              className="border-white/5"
            >
              <AccordionTrigger
                data-testid={`faq-trigger-${i}`}
                className="text-left text-white hover:text-red-400 hover:no-underline"
              >
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-zinc-400 leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
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
  const isMobile = useIsMobile();
  // Mobile keeps the existing showcase marketing page
  if (isMobile) return <Showcase />;
  return <LandingDesktop />;
}
