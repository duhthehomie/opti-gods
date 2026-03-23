import { useState } from "react";
import { Lock, Zap, X, Loader2, CheckCircle2, MessageCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getProStatus, setProStatus } from "@/lib/pro-status";

const CASHAPP_TAG = import.meta.env.VITE_CASHAPP_TAG as string | undefined;
const PAYPAL_LINK = import.meta.env.VITE_PAYPAL_LINK as string | undefined;
const LEGACY_LINK = import.meta.env.VITE_PRO_PAYMENT_LINK as string | undefined;
const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === "true";

interface ProGateProps {
  children: React.ReactNode;
  className?: string;
}

export function ProGate({ children, className }: ProGateProps) {
  const isPro = getProStatus();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (isPro) return <>{children}</>;

  const handleStripeCheckout = async () => {
    setStripeLoading(true);
    setError("");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start checkout. Try another payment method.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setStripeLoading(false);
    }
  };

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
        setProStatus(true);
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1200);
      } else {
        setError("Invalid code. Pay via CashApp or PayPal below, then DM for your code.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasPaymentOptions = CASHAPP_TAG || PAYPAL_LINK || STRIPE_ENABLED || LEGACY_LINK;

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md border-red-500/20 bg-[#080808] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Opti Gods Pro Access</DialogTitle>
          <DialogDescription className="sr-only">Unlock Pro features with an access code</DialogDescription>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-500" />
              <span className="font-display font-bold text-white text-lg">Opti Gods PRO</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* What you get */}
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
              <h3 className="text-white font-bold text-sm">What you get:</h3>
              {[
                "Download your personalized PowerShell optimization script",
                "130+ registry, network, memory, GPU, and game-specific tweaks",
                "FiveM, Fortnite, CS2, Valorant, Apex and 10+ game packs",
                "Lifetime access — one-time payment",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="w-3 h-3 text-red-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            {success ? (
              <div className="flex items-center gap-2 justify-center py-6 text-red-400 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                Access Granted! Reloading...
              </div>
            ) : (
              <div className="space-y-3">

                {/* Code entry */}
                <p className="text-xs text-zinc-400 font-medium">Have an access code?</p>
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
                    className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shrink-0 transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
                  </Button>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}

                {hasPaymentOptions && (
                  <>
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">no code? pay below</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* Payment buttons */}
                    <div className="grid gap-2">
                      {CASHAPP_TAG && (
                        <a
                          href={`https://cash.app/${CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-pay-cashapp"
                          className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-[#00D632]/10 border border-[#00D632]/30 hover:border-[#00D632]/60 hover:bg-[#00D632]/15 text-[#00D632] text-sm font-bold transition-all"
                        >
                          <svg width="16" height="16" viewBox="0 0 40 40" fill="currentColor">
                            <path d="M20 0C8.954 0 0 8.954 0 20s8.954 20 20 20 20-8.954 20-20S31.046 0 20 0zm3.09 29.2c-.38 1.43-1.65 2.43-3.09 2.43-1.44 0-2.71-1-3.09-2.43L15.7 27H13a1 1 0 0 1 0-2h2.23l-1.03-3.89a1 1 0 0 1 .72-1.22 1 1 0 0 1 1.22.72L17.3 25h5.4l1.16-4.39a1 1 0 0 1 1.22-.72 1 1 0 0 1 .72 1.22L24.77 25H27a1 1 0 0 1 0 2h-2.7l-1.21 2.2zM27 17H13a1 1 0 0 1 0-2h2.7l1.21-2.2c.38-1.43 1.65-2.43 3.09-2.43 1.44 0 2.71 1 3.09 2.43L24.3 15H27a1 1 0 0 1 0 2z"/>
                          </svg>
                          Pay with CashApp {CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}
                        </a>
                      )}

                      {PAYPAL_LINK && (
                        <a
                          href={PAYPAL_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-pay-paypal"
                          className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-[#003087]/15 border border-[#003087]/40 hover:border-[#0070E0]/60 hover:bg-[#003087]/25 text-[#009CDE] text-sm font-bold transition-all"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                          </svg>
                          Pay with PayPal
                        </a>
                      )}

                      {STRIPE_ENABLED && (
                        <button
                          data-testid="button-pay-stripe"
                          onClick={handleStripeCheckout}
                          disabled={stripeLoading}
                          className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {stripeLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CreditCard className="w-4 h-4" />}
                          {stripeLoading ? "Redirecting..." : "Pay with Card"}
                        </button>
                      )}

                      {!CASHAPP_TAG && !PAYPAL_LINK && !STRIPE_ENABLED && LEGACY_LINK && (
                        <a
                          href={LEGACY_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-purchase-pro"
                          className="block w-full text-center py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-red-500/40 text-zinc-300 hover:text-white text-sm font-medium transition-all"
                        >
                          Purchase Access →
                        </a>
                      )}
                    </div>

                    {/* After-payment instruction */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <MessageCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        After payment, send your username and payment screenshot — you'll receive your access code within minutes.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
