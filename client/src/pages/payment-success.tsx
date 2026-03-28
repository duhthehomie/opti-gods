import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Zap, Loader2, XCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setProStatus, setProSession } from "@/lib/pro-status";

const DISCORD_LINK = "https://discord.gg/C8WrQknN9k";

type Status = "verifying" | "success" | "error";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("verifying");
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/verify-payment?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();

        if (data.paid) {
          if (data.sessionToken) setProSession(data.sessionToken);
          setProStatus(true);
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          setLocation("/");
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, setLocation]);

  return (
    <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-red-500" />
          <span className="text-xl font-display font-bold tracking-widest uppercase text-white">
            Opti Gods <span className="text-red-500">PRO</span>
          </span>
        </div>

        {/* Verifying state */}
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold mb-2">Verifying Payment</h1>
              <p className="text-zinc-400 text-sm">Confirming your purchase with Stripe...</p>
            </div>
          </div>
        )}

        {/* Success state */}
        {status === "success" && (
          <div className="space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-red-400" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-display font-bold mb-3">You're In.</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Payment confirmed. Your Pro access is active — all 329+ tweaks and every game pack are unlocked.
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-left space-y-2">
              {[
                { text: "Download your personalized .PS1 script", color: "text-red-500" },
                { text: "329+ system, network, GPU, and memory tweaks", color: "text-red-500" },
                { text: "FiveM, Fortnite, CS2, Valorant, Apex packs", color: "text-red-500" },
                { text: "Lifetime access — never expires", color: "text-red-500" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                  {item.text}
                </div>
              ))}
            </div>

            {/* Discord manual optimization callout */}
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/40 overflow-hidden text-left">
              <div className="flex items-center gap-2 px-4 pt-4 pb-1">
                <MessageCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <p className="text-sm font-black text-indigo-300 uppercase tracking-wider">
                  Claim Your Free Manual Optimization
                </p>
              </div>
              <div className="px-4 pb-4">
                <p className="text-xs text-indigo-200/60 leading-relaxed mb-3">
                  Open a ticket in the{" "}
                  <a href={DISCORD_LINK} target="_blank" rel="noopener noreferrer" className="underline text-indigo-300 hover:text-white font-semibold">Discord</a>
                  {" "}— leaq will remote into your PC via Parsec and manually optimize your exact setup.
                </p>
                <ol className="space-y-1.5 mb-3">
                  {[
                    <>Open a ticket in the Discord server</>,
                    <>Download <a href="https://parsec.app" target="_blank" rel="noopener noreferrer" className="underline text-indigo-300 hover:text-white font-semibold">Parsec</a> → click <strong className="text-white">Download Parsec</strong> → choose <strong className="text-white">Per User</strong> (top right)</>,
                    <>Create a Parsec account and add friend: <strong className="text-white">leaqy#18445432</strong></>,
                    <>DM leaq to check the queue — he'll remote in and tune your PC for max FPS</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-indigo-200/60">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] mt-0.5">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
                  <span className="text-indigo-400 text-xs shrink-0">💡</span>
                  <p className="text-xs text-indigo-200/60 leading-relaxed">
                    <strong className="text-indigo-300">Speed tip:</strong> Post screenshots of your CPU, GPU, and RAM from Task Manager (Performance tab) in your ticket — leaq can start immediately without needing to scan your specs first.
                  </p>
                </div>
                <a
                  href={DISCORD_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-discord-session"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white underline transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  Join Discord → Open a Ticket
                </a>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                data-testid="button-go-to-dashboard"
                onClick={() => setLocation("/")}
                className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-500/30 font-display font-bold py-3"
              >
                <Zap className="w-4 h-4 mr-2" />
                Open Dashboard
              </Button>
              <p className="text-xs text-zinc-600">
                Redirecting automatically in {countdown}s...
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-zinc-500" />
            </div>

            <div>
              <h1 className="text-2xl font-display font-bold mb-2">Payment Not Found</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                We couldn't verify your payment. If you completed a payment, it may still be processing.
                Try again in a moment or contact support with your payment confirmation.
              </p>
            </div>

            <div className="grid gap-2">
              <Button
                data-testid="button-retry-verify"
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30"
              >
                Try Again
              </Button>
              <Button
                data-testid="button-back-to-dashboard"
                onClick={() => setLocation("/")}
                variant="outline"
                className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
