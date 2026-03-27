import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Loader2, CheckCircle2, Zap, ArrowLeft, MessageCircle } from "lucide-react";

const DISCORD_LINK = "https://discord.gg/C8WrQknN9k";

export default function GetCode() {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"cashapp" | "paypal" | "gumroad">("gumroad");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !ref) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, paymentMethod: method, paymentRef: ref }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const d = await res.json();
        setError(d.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-6">

        {/* Back */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Opti Gods
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Opti Gods Pro</span>
          </div>
          <h1 className="text-2xl font-black text-white leading-tight mb-1">Get Your Access Code</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Already paid? Fill this out and your code lands in your inbox within <strong className="text-zinc-300">5 minutes or less.</strong>
          </p>
        </div>

        {done ? (
          /* Success state */
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-black text-emerald-300 mb-1">Request Submitted!</p>
              <p className="text-sm text-emerald-700 leading-relaxed">
                Check <strong className="text-emerald-500">{email}</strong> — your code is on its way. Usually arrives in under 5 minutes.
              </p>
            </div>
            <div className="pt-2 border-t border-emerald-500/10">
              <p className="text-[11px] text-zinc-600">
                Code not there after 10 min?{" "}
                <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                  Open a ticket on Discord
                </a>{" "}
                and leaq will sort it out.
              </p>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="rounded-2xl border border-white/8 bg-zinc-900/50 p-5 space-y-4">

            {/* Step indicator */}
            <div className="flex items-center gap-3 pb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center justify-center">✓</span>
                <span className="text-xs text-zinc-500">Paid</span>
              </div>
              <div className="flex-1 h-px bg-white/5" />
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black flex items-center justify-center">2</span>
                <span className="text-xs text-white font-semibold">Request code</span>
              </div>
              <div className="flex-1 h-px bg-white/5" />
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-600 text-[10px] font-black flex items-center justify-center">3</span>
                <span className="text-xs text-zinc-600">Unlock</span>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Your Email</label>
              <input
                data-testid="input-getcode-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-zinc-600">We'll send your access code here</p>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">How Did You Pay?</label>
              <div className="grid grid-cols-3 gap-2">
                {(["gumroad", "cashapp", "paypal"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                      method === m
                        ? "bg-red-600 border-red-500 text-white"
                        : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {m === "gumroad" ? "Card" : m === "cashapp" ? "CashApp" : "PayPal"}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment reference */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                {method === "gumroad" ? "Order ID or Email Used at Checkout"
                  : method === "cashapp" ? "Your $Cashtag or Transaction ID"
                  : "PayPal Transaction ID or Email"}
              </label>
              <input
                data-testid="input-getcode-ref"
                type="text"
                placeholder={
                  method === "gumroad" ? "e.g. hCUm0SBwEQ... or your email"
                    : method === "cashapp" ? "e.g. $my1ik or TX ID"
                    : "e.g. PayPal TX ID"
                }
                value={ref}
                onChange={e => setRef(e.target.value)}
                className="w-full bg-black border border-zinc-700 focus:border-red-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono"
              />
              {method === "gumroad" && (
                <p className="text-[10px] text-zinc-600">
                  Find your Order ID in the Gumroad confirmation email — it starts with a long string of letters/numbers
                </p>
              )}
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              data-testid="button-getcode-submit"
              onClick={handleSubmit}
              disabled={loading || !email || !ref}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-wide transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                : <><Mail className="w-4 h-4" /> Send My Code</>
              }
            </button>
          </div>
        )}

        {/* Discord help */}
        <div className="flex items-center justify-center">
          <a
            href={DISCORD_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            Need help? Join the Discord
          </a>
        </div>
      </div>
    </div>
  );
}
