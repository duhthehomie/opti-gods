import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Zap, X, Loader2, MessageCircle, CreditCard, ShieldCheck, Copy, Check, Flame, Ticket } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { TOTAL_TWEAKS_LABEL } from "@/lib/tweak-count";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useProStatus, setProStatus, setProSession } from "@/lib/pro-status";
import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { loginWithDiscord, useAuth } from "@/hooks/use-auth";

const CASHAPP_TAG = import.meta.env.VITE_CASHAPP_TAG as string | undefined;
const PAYPAL_LINK = import.meta.env.VITE_PAYPAL_LINK as string | undefined;
const LEGACY_LINK = import.meta.env.VITE_PRO_PAYMENT_LINK as string | undefined;

const CRYPTO_ADDRESS = import.meta.env.VITE_CRYPTO_ADDRESS as string | undefined;
const COINBASE_LINK = import.meta.env.VITE_COINBASE_LINK as string | undefined;
const DISCORD_LINK = "https://discord.gg/optigods";
const SUPPORT_TICKET_TEXT = encodeURIComponent("I want to buy the $25 manual with card. Please tell me if I can get it now or if I should wait. I’m in the info → ✉️・support ticket channel.");

export function ProPaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { isAuthenticated } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [discordSaved, setDiscordSaved] = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [cryptoCopied, setCryptoCopied] = useState(false);
  const withSession = false;
  const [stripeLoading, setStripeLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountValidating, setDiscountValidating] = useState(false);
  const [discountData, setDiscountData] = useState<{ percentOff: number; discountedPrice: number; code: string } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [manualDiscountInput, setManualDiscountInput] = useState("");
  const [manualDiscountValidating, setManualDiscountValidating] = useState(false);
  const [manualDiscountData, setManualDiscountData] = useState<{ percentOff: number; discountedPrice: number; code: string } | null>(null);
  const [manualDiscountError, setManualDiscountError] = useState("");

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
    setAlreadyUsed(false);
    try {
      const res = await fetch(apiUrl("/api/pro/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ code: code.trim() }),
        credentials: "include",
      });
      // Read body once, parse defensively — a rate-limit or IP-ban response
      // is still JSON, but we want a clear message instead of a generic
      // "connection error" if parsing fails.
      const raw = await res.text();
      let data: { valid?: boolean; sessionToken?: string; error?: string; discordSaved?: boolean; reason?: string } = {};
      try { data = JSON.parse(raw); } catch { /* non-JSON body */ }
      if (res.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else if (res.status === 403) {
        setError(data.error || "Your IP is blocked from redeeming codes. Contact support.");
      } else if (data.valid) {
        if (data.sessionToken) {
          setProSession(data.sessionToken);
        } else {
          setProStatus(true);
        }
        setDiscordSaved(data.discordSaved ?? false);
        setSuccess(true);
        // Only auto-close if Discord is already linked — otherwise we hold
        // the dialog open so the user sees the "link Discord NOW" warning.
        if (data.discordSaved) {
          setTimeout(() => {
            onOpenChange(false);
            setSuccess(false);
            setCode("");
          }, 1400);
        }
      } else if (data.reason === "already_used") {
        // Code was already redeemed — show the Discord restore path instead of
        // a generic error. Existing buyers recover access via Discord login.
        setAlreadyUsed(true);
      } else {
        setError(
          DISCORD_LINK
            ? `Invalid code. If you already paid, DM us on Discord — we'll fix it instantly.`
            : "Invalid code. If you already paid, contact support to get your code registered."
        );
      }
    } catch (err) {
      // Real network failure (DNS, CORS, offline). The Tauri shell has no
      // backend of its own, so this most often means the production API
      // host is unreachable.
      console.error("[pro/verify] network error", err);
      setError("Couldn't reach the Opti Gods server. Check your internet and try again.");
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

  const handleApplyDiscount = async () => {
    if (!discountInput.trim()) return;
    setDiscountValidating(true);
    setDiscountError("");
    setDiscountData(null);
    try {
      const res = await fetch(apiUrl("/api/discount/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setDiscountData(data);
      } else {
        setDiscountError(data.error || "Invalid discount code.");
      }
    } catch {
      setDiscountError("Connection error. Please try again.");
    } finally {
      setDiscountValidating(false);
    }
  };

  const handleApplyManualDiscount = async () => {
    if (!manualDiscountInput.trim()) return;
    setManualDiscountValidating(true);
    setManualDiscountError("");
    setManualDiscountData(null);
    try {
      const res = await fetch(apiUrl("/api/discount/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: manualDiscountInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setManualDiscountData(data);
      } else {
        setManualDiscountError(data.error || "Invalid discount code.");
      }
    } catch {
      setManualDiscountError("Connection error. Please try again.");
    } finally {
      setManualDiscountValidating(false);
    }
  };

  const handleStripeCheckout = async (tier: "pro" | "manual" = "pro") => {
    if (tier === "manual") setManualLoading(true); else setStripeLoading(true);
    const activeDiscount = tier === "pro" ? discountData : manualDiscountData;
    try {
      const res = await fetch(apiUrl("/api/create-checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, ...(activeDiscount ? { discountCode: activeDiscount.code } : {}) }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Failed to create checkout session. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      if (tier === "manual") setManualLoading(false); else setStripeLoading(false);
    }
  };

  const handleSupportTicket = () => {
    window.open(
      `${DISCORD_LINK}/channels/@me`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const hasPaymentOptions =
    CASHAPP_TAG || PAYPAL_LINK || LEGACY_LINK || CRYPTO_ADDRESS || COINBASE_LINK || true;

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

          {/* Price display */}
          <div className="rounded-xl border border-red-500/30 bg-red-600/10 p-3 text-left">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl font-black text-white">${basePrice}</span>
              {isWeekend && <span className="text-sm font-bold text-zinc-600 line-through">$25</span>}
              <span className="text-xs text-zinc-500 font-medium">one-time</span>
            </div>
            <p className="text-[11px] font-bold text-white mb-0.5">Pro Access — Lifetime</p>
            <p className="text-[10px] text-zinc-500">All {TOTAL_TWEAKS_LABEL} tweaks · custom script · lifetime access</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">

          {/* Feature list */}
          <div className="rounded-xl bg-zinc-900/80 border border-white/8 p-4 space-y-2.5">
            {[
              { icon: "⚡", text: `${TOTAL_TWEAKS_LABEL} registry, GPU, network & game-specific tweaks`, bold: true },
              { icon: "🎮", text: "FiveM, Fortnite, CS2, Valorant, Apex + 10 more game packs" },
              { icon: "📄", text: "Your custom PowerShell script — download in seconds" },
              { icon: "🔁", text: "14 games auto-detected · preset save/load" },
              { icon: "✅", text: "Lifetime access — pay once, never pay again", bold: true },
              { icon: "📧", text: "Code in your inbox within 5 minutes of payment" },
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
              <>Code delivered automatically within <span className="text-emerald-200">5 minutes or less</span> — just pay below, then request it</>
            
            </p>
          </div>

          {/* Code policy notice — shown to every buyer before they pay */}
          <div data-testid="text-code-policy" className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest font-bold text-red-400">Code Policy — read before buying</p>
            <p className="text-[11px] text-zinc-300 leading-snug">
              Card buyers: you'll enter your <strong className="text-white">email</strong> at checkout — your code is sent there automatically.
            </p>
            <p className="text-[11px] text-zinc-300 leading-snug">
              If your code ever stops working, message <strong className="text-white">leaq</strong> on Discord and it'll be revived instantly.
            </p>
            <p className="text-[11px] text-zinc-300 leading-snug">
              <strong className="text-red-300">Sharing your code with anyone else = permanent ban.</strong> You'll have to buy a brand-new code to get back in. One code = one person.
            </p>
          </div>

          {success ? (
            discordSaved ? (
              /* Discord already linked — quick green confirmation, dialog auto-closes */
              <div className="flex flex-col items-center gap-3 justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-white font-bold text-base">Pro Access Granted!</p>
                <p className="text-xs text-emerald-400 font-semibold">
                  ✓ Saved permanently to your Discord account
                </p>
              </div>
            ) : (
              /* No Discord linked — hold dialog open with a hard warning */
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-3 pt-2 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-white font-bold text-base">Pro Access Granted!</p>
                </div>

                {/* Hard warning — code is now permanently dead */}
                <div data-testid="panel-link-discord-warning" className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-lg">⚠️</span>
                    <p className="text-sm font-black text-red-300 uppercase tracking-wide">Action required</p>
                  </div>
                  <p className="text-[12px] text-white font-semibold leading-snug">
                    Your code is now <span className="text-red-300">permanently consumed</span>. It cannot be entered again by you or anyone else.
                  </p>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    Link your Discord account <strong className="text-white">right now</strong> so your Pro access is saved to your account. If you skip this and lose your session, your code is gone — you'll need to contact leaq to manually restore access.
                  </p>
                  <button
                    data-testid="button-link-discord-now"
                    onClick={() => loginWithDiscord()}
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-black tracking-wide transition-all"
                  >
                    <SiDiscord className="w-4 h-4" />
                    Link Discord Now — Save My Pro Access
                  </button>
                  <button
                    data-testid="button-skip-discord-warning"
                    onClick={() => {
                      onOpenChange(false);
                      setSuccess(false);
                      setCode("");
                    }}
                    className="w-full text-center text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
                  >
                    I understand — skip for now (risky)
                  </button>
                </div>
              </div>
            )
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

                  <button
                    data-testid="button-pay-stripe"
                    onClick={() => handleStripeCheckout("pro")}
                    disabled={stripeLoading || manualLoading}
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed border border-red-500 text-white text-sm font-black tracking-wide transition-all shadow-lg shadow-red-900/30"
                  >
                    {stripeLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Stripe...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay ${price} with Card — Stripe
                      </>
                    )}
                  </button>

                  {/* $25 Manual Opti — paid directly via Stripe (done-for-you service) */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                    {manualDiscountData ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="text-[11px] text-green-400 font-bold flex-1">
                          {manualDiscountData.percentOff}% discount applied — <span className="text-white">${manualDiscountData.discountedPrice} total</span>
                        </span>
                        <button
                          onClick={() => { setManualDiscountData(null); setManualDiscountInput(""); setManualDiscountError(""); }}
                          className="text-zinc-600 hover:text-zinc-400 text-[10px] font-bold transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-0">
                        <input
                          data-testid="input-manual-discount-code"
                          type="text"
                          placeholder="Discount code (optional)"
                          value={manualDiscountInput}
                          onChange={e => { setManualDiscountInput(e.target.value.toUpperCase()); setManualDiscountError(""); }}
                          onKeyDown={e => e.key === "Enter" && handleApplyManualDiscount()}
                          className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                        />
                        <button
                          data-testid="button-apply-manual-discount"
                          onClick={handleApplyManualDiscount}
                          disabled={manualDiscountValidating || !manualDiscountInput.trim()}
                          className="px-3 py-2 text-[11px] font-bold text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors shrink-0"
                        >
                          {manualDiscountValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                        </button>
                      </div>
                    )}
                    {manualDiscountError && (
                      <p className="px-3 pb-2 text-[10px] text-red-400 font-medium">{manualDiscountError}</p>
                    )}
                  </div>

                  <button
                    data-testid="button-pay-stripe-manual"
                    onClick={() => handleStripeCheckout("manual")}
                    disabled={stripeLoading || manualLoading}
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed border border-red-500/40 hover:border-red-500/70 text-white text-sm font-black tracking-wide transition-all"
                  >
                    {manualLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading Stripe...
                      </>
                    ) : manualDiscountData ? (
                      <>
                        <CreditCard className="w-4 h-4 text-red-400" />
                        Pay ${manualDiscountData.discountedPrice} — Manual Opti (Done-For-You)
                        <span className="ml-1 text-[10px] font-bold bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full border border-green-500/30">
                          {manualDiscountData.percentOff}% OFF
                        </span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-red-400" />
                        Pay $25 — Manual Opti (Done-For-You)
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-500 text-center -mt-1 px-2 leading-snug">
                    leaq personally optimizes your PC. After paying, open a Discord ticket to schedule.
                  </p>

                  <a
                    href={`https://discord.com/channels/@me?text=${SUPPORT_TICKET_TEXT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-manual-card-support"
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/50 text-white text-sm font-black tracking-wide transition-all"
                  >
                    <Ticket className="w-4 h-4 text-[#5865F2]" />
                    Manual Opti — Discord Ticket (other payment)
                  </a>

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

                  {!CASHAPP_TAG && !PAYPAL_LINK && LEGACY_LINK && (
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
                      optigods.com/get-code →
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
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); setAlreadyUsed(false); }}
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

              {/* Already-used code — show Discord restore path, not a generic error */}
              {alreadyUsed && (
                <div data-testid="panel-already-used" className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-amber-300">Code already redeemed</p>
                  <p className="text-[11px] text-zinc-300 leading-snug">
                    This code belongs to an existing customer. If that's you, log in with Discord to instantly restore your Pro access — your account is already tied to your Discord.
                  </p>
                  <button
                    data-testid="button-discord-restore-pro"
                    onClick={() => loginWithDiscord()}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/40 hover:bg-[#5865F2]/25 hover:border-[#5865F2]/60 text-white text-xs font-black tracking-wide transition-all"
                  >
                    <SiDiscord className="w-3.5 h-3.5 text-[#5865F2]" />
                    Log in with Discord to restore Pro
                  </button>
                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Redeemed without Discord? Message <strong className="text-zinc-400">leaq</strong> on Discord — he'll reset your code so you can re-enter it.
                  </p>
                </div>
              )}

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
                  data-testid="link-discord-support"
                  className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3 h-3" />
                  Questions? Ask in Discord support
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
