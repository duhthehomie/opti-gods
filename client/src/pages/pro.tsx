import { AppLayout } from "@/components/layout/app-layout";
import { ProUnlockButton } from "@/components/pro-gate";
import { useProStatus } from "@/lib/pro-status";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles, ShieldCheck, Zap, MessageSquare, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptiGodsWordmark } from "@/components/branding/opti-gods-wordmark";
import { TOTAL_TWEAK_COUNT } from "@/lib/tweak-registry";

const PERKS = [
  { icon: Zap, title: "Full PowerShell Script Generator", desc: "Download personalized .ps1 with all your selected tweaks" },
  { icon: ShieldCheck, title: "Every Tweak Unlocked", desc: `Access all ${TOTAL_TWEAK_COUNT}+ optimization toggles, no gates` },
  { icon: Sparkles, title: "Opti Gods AI — Unlimited", desc: "Unlimited prompts, image analysis, smart preset gen" },
  { icon: MessageSquare, title: "Priority Discord Support", desc: "Direct access to the Pro channel" },
  { icon: Crown, title: "Lifetime Updates", desc: "One payment, every future tweak forever" },
];

export default function ProPage() {
  const isPro = useProStatus();

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Hero */}
        <div className="relative rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 via-zinc-950 to-black p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Opti Gods Pro</span>
            </div>
            <div className="mb-5">
              <OptiGodsWordmark variant="inline" />
            </div>
            <h1 className="text-4xl font-display font-black text-white">
              Unlock Every Tweak.{" "}
              <span className="text-red-500">Forever.</span>
            </h1>
            <p className="text-zinc-400 mt-3 max-w-xl">
              One payment. Lifetime access to every optimization, every future update, and unlimited AI assistance.
            </p>

            <div className="mt-6 flex items-center gap-4 flex-wrap">
              {isPro ? (
                <div data-testid="status-pro-active" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-300">Pro Active — Thank you</span>
                </div>
              ) : (
                <>
                  <ProUnlockButton>
                    <Button
                      data-testid="button-unlock-pro"
                      className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-6 text-base shadow-[0_0_30px_-5px_rgba(239,68,68,0.6)] pointer-events-none"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Unlock Pro — $15
                    </Button>
                  </ProUnlockButton>
                  <span className="text-xs text-zinc-500">CashApp · PayPal · Card · Access Code</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Perks */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-red-500/70 mb-4">What you get</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {PERKS.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.title} data-testid={`perk-${p.title.replace(/\s+/g, "-").toLowerCase()}`} className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-zinc-950/40 hover:border-red-500/20 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{p.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Payment options */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-red-500/70 mb-4">Payment options</h2>
          <div className="rounded-xl border border-white/5 bg-zinc-950/40 divide-y divide-white/5">
            {[
              { label: "CashApp", value: import.meta.env.VITE_CASHAPP_TAG || "$my1ik" },
              { label: "PayPal", value: import.meta.env.VITE_PAYPAL_LINK || "paypal.me/accountslg" },
              { label: "Card (Stripe)", value: import.meta.env.VITE_STRIPE_ENABLED === "true" ? "Click Unlock Pro above" : "Not available" },
              { label: "Access Code", value: "Click Unlock Pro and enter your code" },
            ].map(p => (
              <div key={p.label} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-zinc-400 font-semibold">{p.label}</span>
                <span className="text-white font-mono text-xs">{p.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
