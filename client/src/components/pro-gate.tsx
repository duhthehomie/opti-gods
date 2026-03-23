import { useState } from "react";
import { Lock, Zap, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PRO_KEY = "optigods_pro_v1";

export function getProStatus(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PRO_KEY) === "true";
}

interface ProGateProps {
  children: React.ReactNode;
  className?: string;
}

export function ProGate({ children, className }: ProGateProps) {
  const isPro = getProStatus();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (isPro) return <>{children}</>;

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
        localStorage.setItem(PRO_KEY, "true");
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1200);
      } else {
        setError("Invalid code. Purchase access to receive a valid code.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

          <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-500" />
              <span className="font-display font-bold text-white text-lg">Opti Gods PRO</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
              <h3 className="text-white font-bold text-sm">What you get with PRO:</h3>
              {[
                "Download your personalized PowerShell optimization script",
                "130+ registry, network, memory, GPU, and game-specific tweaks",
                "FiveM, Fortnite, CS2, Valorant, Apex and 10+ game packs",
                "Lifetime access — one-time purchase",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="w-3 h-3 text-red-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {success ? (
                <div className="flex items-center gap-2 justify-center py-4 text-red-400 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  Access Granted! Reloading...
                </div>
              ) : (
                <>
                  <p className="text-xs text-zinc-400">Enter your access code:</p>
                  <div className="flex gap-2">
                    <input
                      data-testid="input-pro-code"
                      type="text"
                      placeholder="XXXX-XXXX-XXXX"
                      value={code}
                      onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                      className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-red-500/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none font-mono"
                    />
                    <Button
                      data-testid="button-verify-code"
                      onClick={handleVerify}
                      disabled={loading || !code.trim()}
                      className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shrink-0"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
                    </Button>
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-zinc-600">no code?</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <a
                    href={import.meta.env.VITE_PRO_PAYMENT_LINK || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-purchase-pro"
                    className="block w-full text-center py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-red-500/40 text-zinc-300 hover:text-white text-sm font-medium transition-all"
                  >
                    Purchase Access →
                  </a>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
