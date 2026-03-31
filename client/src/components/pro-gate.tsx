import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Zap, X, Loader2, MessageCircle, CreditCard, ShieldCheck, Copy, Check, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useProStatus, setProStatus, setProSession } from "@/lib/pro-status";

const CASHAPP_TAG = import.meta.env.VITE_CASHAPP_TAG as string | undefined;
const PAYPAL_LINK = import.meta.env.VITE_PAYPAL_LINK as string | undefined;
const LEGACY_LINK = import.meta.env.VITE_PRO_PAYMENT_LINK as string | undefined;

const CRYPTO_ADDRESS = import.meta.env.VITE_CRYPTO_ADDRESS as string | undefined;
const COINBASE_LINK = import.meta.env.VITE_COINBASE_LINK as string | undefined;
const GUMROAD_LINK = import.meta.env.VITE_GUMROAD_LINK as string | undefined;
const DISCORD_LINK = "https://discord.gg/C8WrQknN9k";

function ProPaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cryptoCopied, setCryptoCopied] = useState(false);
  const [withSession, setWithSession] = useState(false);

  const { data: pricing } = useQuery<{ price: number; isWeekendDeal: boolean }>({
    queryKey: ["/api/pricing"],
    staleTime: 60_000,
  });

  const basePrice = pricing?.price ?? 25;
  const isWeekend = pricing?.isWeekendDeal ?? false;
  const price = withSession ? basePrice + 20 : basePrice;

  const handleVerify = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pro/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        if (data.sessionToken) {
          setProSession(data.sessionToken);
        } else {
          setProStatus(true);
        }
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
          setCode("");
        }, 1400);
      } else {
        setError(
          DISCORD_LINK
            ? `Invalid code. If you already paid, DM us on Discord — we'll fix it instantly.`
            : "Invalid code. If you already paid, contact support to get your code registered."
        );
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCrypto = async () => {
    if (!CRYPTO_ADDRESS) return;
    try {
      await navigator.clipboard.writeText(CRYPTO_ADDRESS);
      setCryptoCopied(true);
      setTimeout(() => setCryptoCopied(false), 2500);
    } catch {}
  };

  const hasPaymentOptions =
    CASHAPP_TAG || PAYPAL_LINK || GUMROAD_LINK || LEGACY_LINK || CRYPTO_ADDRESS || COINBASE_LINK;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] border-0 bg-[#080808] p-0 overflow-hidden shadow-2xl shadow-black/80">
        <DialogTitle className="sr-only">Opti Gods Pro Access</DialogTitle>
        <DialogDescription className="sr-only">Unlock Pro features with an access code</DialogDescription>

        {/* Weekend deal top banner */}
        {isWeekend && (
          <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-4 py-2.5 flex items-center justify-center gap-2">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.04)_8px,rgba(255,255,255,0.04)_16px)]" />
            <Flame className="w-4 h-4 text-white shrink-0 relative z-10" />
            <span className="text-white text-xs font-black uppercase tracking-widest relative z-10">
              Weekend Deal — $10 OFF Today Only
            </span>
            <Flame className="w-4 h-4 text-white shrink-0 relative z-10" />
          </div>
        )}

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-start justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-black uppercase tracking-widest">
              <Zap className="w-3 h-3" />
              One-Time Lifetime Access
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tier selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setWithSession(false)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                !withSession
                  ? "bg-red-600/15 border-red-500/50 shadow-[0_0_12px_-4px_rgba(239,68,68,0.3)]"
                  : "bg-zinc-900/60 border-zinc-700/50 hover:border-zinc-600"
              )}
            >
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-2xl font-black text-white">${basePrice}</span>
                {isWeekend && <span className="text-sm font-bold text-zinc-600 line-through">$25</span>}
              </div>
              <p className="text-[11px] font-bold text-white mb-0.5">Pro Only</p>
              <p className="text-[10px] text-zinc-500">App + all tweaks</p>
            </button>

            <button
              onClick={() => setWithSession(true)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all relative overflow-hidden",
                withSession
                  ? "bg-red-600/15 border-red-500/50 shadow-[0_0_12px_-4px_rgba(239,68,68,0.3)]"
                  : "bg-zinc-900/60 border-zinc-700/50 hover:border-zinc-600"
              )}
            >
              <div className="absolute top-2 right-2">
                <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">POPULAR</span>
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-2xl font-black text-white">${basePrice + 20}</span>
              </div>
              <p className="text-[11px] font-bold text-white mb-0.5">Pro + Session</p>
              <p className="text-[10px] text-zinc-500">App + live Parsec opti</p>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">

          {/* Feature list */}
          <div className="rounded-xl bg-zinc-900/80 border border-white/8 p-4 space-y-2.5">
            {[
              { icon: "⚡", text: "396+ registry, GPU, network & game-specific tweaks", bold: true },
              { icon: "🎮", text: "FiveM, Fortnite, CS2, Valorant, Apex + 10 more game packs" },
              { icon: "📄", text: "Your custom PowerShell script — download in seconds" },
              { icon: "🔁", text: "14 games auto-detected · preset save/load" },
              { icon: "✅", text: "Lifetime access — pay once, never pay again", bold: true },
              { icon: "📧", text: "Code in your inbox within 5 minutes of payment" },
              ...(withSession ? [
                { icon: "🖥️", text: "Live Parsec session — leaqy logs in & optimizes your PC directly", bold: true, highlight: true },
                { icon: "🎯", text: "Best for users who want everything done for them — no setup needed", highlight: true },
              ] : []),
            ].map((f: { icon: string; text: string; bold?: boolean; highlight?: boolean }, i) => (
              <div key={i} className={cn("flex items-start gap-2.5 text-xs", f.highlight && "bg-red-500/5 border border-red-500/15 rounded-lg p-2 -mx-1")}>
                <span className="text-sm shrink-0 leading-none mt-0.5">{f.icon}</span>
                <span className={cn("leading-relaxed", f.bold ? "text-white font-semibold" : "text-zinc-400")}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          {/* Trust signal */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="text-[11px] text-emerald-300 font-semibold leading-snug">
              {withSession
                ? <>Pay ${basePrice + 20} below → DM on Discord with proof → <span className="text-emerald-200">session booked within 24h</span></>
                : <>Code delivered automatically within <span className="text-emerald-200">5 minutes or less</span> — just pay below, then request it</>
              }
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 justify-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-white font-bold text-base">Pro Access Granted</p>
              <p className="text-xs text-zinc-500">All features are now unlocked.</p>
            </div>
          ) : (
            <div className="space-y-3">

              {hasPaymentOptions && (
                <div className="space-y-2">
                  {CASHAPP_TAG && (
                    <a
                      href={`https://cash.app/${CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-pay-cashapp"
                      className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-[#00D64F]/10 border border-[#00D64F]/30 hover:bg-[#00D64F]/20 hover:border-[#00D64F]/50 text-white text-sm font-black tracking-wide transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 40 40" fill="currentColor" className="text-[#00D64F]">
                        <path d="M20 0C8.954 0 0 8.954 0 20s8.954 20 20 20 20-8.954 20-20S31.046 0 20 0zm3.09 29.2c-.38 1.43-1.65 2.43-3.09 2.43-1.44 0-2.71-1-3.09-2.43L15.7 27H13a1 1 0 0 1 0-2h2.23l-1.03-3.89a1 1 0 0 1 .72-1.22 1 1 0 0 1 1.22.72L17.3 25h5.4l1.16-4.39a1 1 0 0 1 1.22-.72 1 1 0 0 1 .72 1.22L24.77 25H27a1 1 0 0 1 0 2h-2.7l-1.21 2.2zM27 17H13a1 1 0 0 1 0-2h2.7l1.21-2.2c.38-1.43 1.65-2.43 3.09-2.43 1.44 0 2.71 1 3.09 2.43L24.3 15H27a1 1 0 0 1 0 2z"/>
                      </svg>
                      Pay ${price} with CashApp {CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}
                    </a>
                  )}

                  {PAYPAL_LINK && (
                    <a
                      href={PAYPAL_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-pay-paypal"
                      className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-[#003087]/20 border border-[#009CDE]/30 hover:bg-[#003087]/30 hover:border-[#009CDE]/50 text-white text-sm font-black tracking-wide transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#009CDE]">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                      </svg>
                      Pay ${price} with PayPal
                    </a>
                  )}

                  {GUMROAD_LINK && (
                    <div className="space-y-2">
                      <a
                        data-testid="button-pay-gumroad"
                        href={GUMROAD_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 border border-red-500 text-white text-sm font-black tracking-wide transition-all shadow-lg shadow-red-900/30"
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay by Card — Visa / Mastercard / Amex
                      </a>
                      <div className="rounded-xl border border-amber-500/25 bg-amber-950/30 overflow-hidden">
                        <div className="px-3 py-2.5 flex gap-2.5 items-start">
                          <span className="text-amber-400 text-sm shrink-0">⚠</span>
                          <div>
                            <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider mb-0.5">Gift Card Declined?</p>
                            <p className="text-[10px] text-amber-200/70 leading-relaxed">
                              Prepaid/gift cards are blocked by Gumroad. Use <strong className="text-white">PayPal</strong> or <strong className="text-white">CashApp</strong> instead — they work every time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {COINBASE_LINK && (
                    <a
                      href={COINBASE_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-pay-crypto-coinbase"
                      className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:border-orange-500/50 text-white text-sm font-black tracking-wide transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm0-11.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z"/>
                      </svg>
                      Pay with Crypto (BTC / ETH / USDC)
                    </a>
                  )}

                  {CRYPTO_ADDRESS && !COINBASE_LINK && (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400 shrink-0">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm0-11.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z"/>
                        </svg>
                        <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Crypto (BTC / ETH / USDC)</span>
                      </div>
                      <div className="px-3 py-2.5 flex items-center gap-2">
                        <code className="flex-1 text-[10px] text-zinc-400 font-mono truncate">{CRYPTO_ADDRESS}</code>
                        <button
                          data-testid="button-copy-crypto"
                          onClick={handleCopyCrypto}
                          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-300 font-bold transition-colors"
                        >
                          {cryptoCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {cryptoCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p className="px-3 pb-2 text-[10px] text-zinc-600">Send exact amount (${price}). DM on Discord after payment.</p>
                    </div>
                  )}

                  {!CASHAPP_TAG && !PAYPAL_LINK && !GUMROAD_LINK && LEGACY_LINK && (
                    <a
                      href={LEGACY_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-purchase-pro"
                      className="block w-full text-center py-3 rounded-xl bg-red-600 hover:bg-red-500 border border-red-500 text-white text-sm font-black tracking-wide transition-all"
                    >
                      Unlock Pro — ${price} →
                    </a>
                  )}
                </div>
              )}

              {/* Step 2 — after paying, get your code */}
              {hasPaymentOptions && (
                <a
                  href="/get-code"
                  className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-gradient-to-r from-red-950/60 to-zinc-900/80 border border-red-500/30 hover:border-red-500/50 transition-all group"
                >
                  <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white mb-0.5">After paying → Get Your Code</p>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Tap here to submit your email — your code arrives in your inbox within 5 minutes.
                    </p>
                    <p className="text-[10px] text-red-400 font-bold mt-1 group-hover:text-red-300 transition-colors">
                      optigods.replit.app/get-code →
                    </p>
                  </div>
                </a>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">already have a code?</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Code input */}
              <div className="flex gap-2">
                <input
                  data-testid="input-pro-code"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-red-500/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none font-mono transition-colors"
                />
                <Button
                  data-testid="button-verify-code"
                  onClick={handleVerify}
                  disabled={loading || !code.trim()}
                  className="bg-red-600 hover:bg-red-500 text-white border border-red-500/30 shrink-0 transition-all font-bold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
                </Button>
              </div>
              {error && (
                <p className="text-xs text-red-400">
                  {error}{" "}
                  {DISCORD_LINK && error.includes("Discord") && (
                    <a
                      href={DISCORD_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-red-300 hover:text-white transition-colors"
                    >
                      Join Discord →
                    </a>
                  )}
                </p>
              )}


              {/* Discord help link */}
              <div className="flex items-center justify-center pt-1">
                <a
                  href={DISCORD_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3 h-3" />
                  Questions? Ask in Discord
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProGateProps {
  children: ReactNode;
  className?: string;
}

export function ProGate({ children, className }: ProGateProps) {
  const isPro = useProStatus();
  const [open, setOpen] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      <div className={cn("relative", className)} onClick={() => setOpen(true)}>
        <div className="pointer-events-none opacity-50">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-red-500/30 text-red-400 text-xs font-bold">
            <Lock className="w-3 h-3" /> PRO
          </div>
        </div>
      </div>
      <ProPaymentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ProUnlockButton({ children, className }: { children: ReactNode; className?: string }) {
  const isPro = useProStatus();
  const [open, setOpen] = useState(false);

  if (isPro) return null;

  return (
    <>
      <div
        data-testid="trigger-pro-unlock"
        className={cn("cursor-pointer", className)}
        onClick={() => setOpen(true)}
      >
        {children}
      </div>
      <ProPaymentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
