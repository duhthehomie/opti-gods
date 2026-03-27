import { ReactNode, useState } from "react";
import { Lock, Zap, X, Loader2, CheckCircle2, MessageCircle, CreditCard, ShieldCheck, Mail, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
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
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailMethod, setEmailMethod] = useState<"cashapp" | "paypal" | "crypto">("cashapp");
  const [emailRef, setEmailRef] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleEmailSubmit = async () => {
    if (!emailAddr || !emailRef) return;
    setEmailLoading(true);
    setEmailError("");
    try {
      const res = await fetch("/api/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddr, paymentMethod: emailMethod, paymentRef: emailRef }),
      });
      if (res.ok) {
        setEmailDone(true);
      } else {
        const d = await res.json();
        setEmailError(d.error || "Failed to submit. Check your email address.");
      }
    } catch {
      setEmailError("Connection error. Please try again.");
    } finally {
      setEmailLoading(false);
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
        setError("Invalid code. Pay via CashApp or PayPal below, then DM for your code.");
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

  const hasPaymentOptions = CASHAPP_TAG || PAYPAL_LINK || GUMROAD_LINK || LEGACY_LINK || CRYPTO_ADDRESS || COINBASE_LINK;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-red-500/20 bg-[#080808] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Opti Gods Pro Access</DialogTitle>
        <DialogDescription className="sr-only">Unlock Pro features with an access code</DialogDescription>

        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" />
            <span className="font-display font-bold text-white text-lg">Opti Gods PRO</span>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
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
            <div className="flex flex-col items-center gap-3 justify-center py-8">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-white font-bold text-base">Pro Access Granted</p>
              <p className="text-xs text-zinc-500">All features are now unlocked.</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <p className="text-[11px] text-emerald-400 font-medium">Code delivers to your email within <strong>5 minutes or less</strong> after payment</p>
                  </div>

                  <div className="grid gap-2">
                    {CASHAPP_TAG && (
                      <a
                        href={`https://cash.app/${CASHAPP_TAG.startsWith("$") ? CASHAPP_TAG : "$" + CASHAPP_TAG}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="link-pay-cashapp"
                        className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-red-500/50 hover:bg-zinc-700 text-zinc-100 text-sm font-bold transition-all"
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
                        className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-red-500/50 hover:bg-zinc-700 text-zinc-100 text-sm font-bold transition-all"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                        </svg>
                        Pay with PayPal
                      </a>
                    )}

                    {/* Crypto — Coinbase Commerce link */}
                    {COINBASE_LINK && (
                      <a
                        href={COINBASE_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="link-pay-crypto-coinbase"
                        className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-orange-500/50 hover:bg-zinc-700 text-zinc-100 text-sm font-bold transition-all"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm0-11.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z"/>
                        </svg>
                        Pay with Crypto (BTC / ETH / USDC)
                      </a>
                    )}

                    {/* Crypto — raw wallet address copy */}
                    {CRYPTO_ADDRESS && !COINBASE_LINK && (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400 shrink-0">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm0-11.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z"/>
                          </svg>
                          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Pay with Crypto (BTC / ETH / USDC)</span>
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
                        <p className="px-3 pb-2 text-[10px] text-zinc-600">Send exact amount ($25). DM on Discord after payment.</p>
                      </div>
                    )}

                    {GUMROAD_LINK && (
                      <div className="space-y-2">
                        <a
                          data-testid="button-pay-gumroad"
                          href={GUMROAD_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-red-500/50 hover:bg-zinc-700 text-zinc-100 text-sm font-bold transition-all"
                        >
                          <CreditCard className="w-4 h-4" />
                          Pay with Card (Gumroad)
                        </a>
                        {/* Gumroad gift card warning — prominent banner */}
                        <div className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-zinc-950 overflow-hidden">
                          <div className="h-0.5 w-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
                          <div className="px-3.5 py-3 flex gap-2.5 items-start">
                            <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠</span>
                            <div>
                              <p className="text-[11px] font-black text-amber-300 uppercase tracking-wider mb-1">Gift Card Declined?</p>
                              <p className="text-[10px] text-amber-200/80 leading-relaxed">
                                Visa gift cards & prepaid cards are blocked by Gumroad's processor — this is Gumroad's restriction, not ours. If you see <span className="italic">"card does not support this type of purchase"</span>, use <span className="font-bold text-white">PayPal</span> or <span className="font-bold text-white">CashApp</span> above instead. Regular debit/credit cards work fine on Gumroad.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!CASHAPP_TAG && !PAYPAL_LINK && !GUMROAD_LINK && LEGACY_LINK && (
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

                  {!GUMROAD_LINK && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <MessageCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        After payment, use the <strong className="text-zinc-400">"Get code via email"</strong> form below — your code arrives in <strong className="text-zinc-300">5 minutes or less</strong>.
                      </p>
                    </div>
                  )}
                  {GUMROAD_LINK && (CASHAPP_TAG || PAYPAL_LINK) && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <MessageCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Card payment: fill the email form below after checkout — code arrives in <strong className="text-zinc-300">5 min or less</strong>. CashApp/PayPal: same — pay first, then request your code.
                      </p>
                    </div>
                  )}
                  {GUMROAD_LINK && !CASHAPP_TAG && !PAYPAL_LINK && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <MessageCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        After paying via Gumroad, use the <strong className="text-zinc-400">"Get code via email"</strong> form below — your code arrives in <strong className="text-zinc-300">5 minutes or less</strong>.
                      </p>
                    </div>
                  )}

                  {/* Email code request */}
                  <div className="border border-white/5 rounded-lg overflow-hidden">
                    <button
                      data-testid="button-email-code-toggle"
                      onClick={() => setEmailOpen(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Get code delivered to your email instead</span>
                      </div>
                      {emailOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {emailOpen && (
                      <div className="px-3 pb-3 space-y-2.5 border-t border-white/5 pt-3">
                        {emailDone ? (
                          <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-emerald-300">Request submitted!</p>
                              <p className="text-[10px] text-emerald-700 mt-0.5">
                                Check your inbox at <strong>{emailAddr}</strong> — your code arrives in 5 minutes or less.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-[10px] text-zinc-600">
                              Pay first, then fill this out. We'll email your access code after verifying payment.
                            </p>
                            <input
                              data-testid="input-email-addr"
                              type="email"
                              placeholder="your@email.com"
                              value={emailAddr}
                              onChange={e => setEmailAddr(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors"
                            />
                            <div className="flex gap-2">
                              <select
                                data-testid="select-email-method"
                                value={emailMethod}
                                onChange={e => setEmailMethod(e.target.value as "cashapp" | "paypal" | "crypto")}
                                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:outline-none"
                              >
                                <option value="cashapp">CashApp</option>
                                <option value="paypal">PayPal</option>
                                <option value="crypto">Crypto</option>
                              </select>
                              <input
                                data-testid="input-payment-ref"
                                type="text"
                                placeholder={
                                  emailMethod === "cashapp" ? "Your $cashtag or TX ID"
                                  : emailMethod === "crypto" ? "TX hash / wallet address used"
                                  : "PayPal TX ID or email"
                                }
                                value={emailRef}
                                onChange={e => setEmailRef(e.target.value)}
                                className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors"
                              />
                            </div>
                            {emailError && <p className="text-[10px] text-red-400">{emailError}</p>}
                            <button
                              data-testid="button-submit-email-request"
                              onClick={handleEmailSubmit}
                              disabled={emailLoading || !emailAddr || !emailRef}
                              className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {emailLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                              {emailLoading ? "Submitting..." : "Submit Email Request"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
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
