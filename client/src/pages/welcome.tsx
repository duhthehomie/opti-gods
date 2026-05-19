import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, X, Loader2, ShieldCheck, ChevronLeft, Eye, Ticket, AlertTriangle } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { loginWithDiscord, useAuth, useVersionInfo } from "@/hooks/use-auth";
import { isNative, discordLogin } from "@/lib/tauri-bridge";
import { apiUrl } from "@/lib/api-base";
import { setProSession, setProStatus } from "@/lib/pro-status";
import { getNativeAuthHeaders, NATIVE_TOKEN_KEY, queryClient } from "@/lib/queryClient";

export const GUEST_MODE_KEY = "og_guest_mode";

type View = "main" | "code";

export default function Welcome() {
  const { isLoading } = useAuth();
  const version = useVersionInfo();
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [view, setView] = useState<View>("main");
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Code-redemption state (used in "code" view)
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [discordSaved, setDiscordSaved] = useState(false);

  // Task #65 — while welcome is visible in the .exe, poll /api/me every 5 s.
  // If the user already has a session (e.g. signed in via the website), skip
  // the loopback flow and go straight to the dashboard.
  useEffect(() => {
    if (!isNative()) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl("/api/me"), {
          credentials: "include",
          headers: getNativeAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json() as { isAuthenticated?: boolean };
          if (data?.isAuthenticated) {
            clearInterval(interval);
            window.location.href = "/tweaks";
          }
        }
      } catch {
        // network error — keep polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Read ?login=error&reason= from URL once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "error") {
      const reason = params.get("reason") || "unknown";
      const labels: Record<string, string> = {
        missing_code: "Discord didn't return an authorization code. Please try again.",
        state_mismatch: "Login session expired. Please try again.",
        token_exchange: "Could not complete sign-in with Discord. Please try again.",
        no_token: "Discord didn't issue an access token. Please try again.",
        user_fetch: "Could not read your Discord profile. Please try again.",
        server: "Server error during sign-in. Please try again.",
      };
      setLoginError(labels[reason] || "Sign-in failed. Please try again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("login");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleLogin = async () => {
    setSigningIn(true);
    setLoginError(null);
    if (isNative()) {
      try {
        // Fetch the Discord client ID from the server (not shipped in the binary).
        const cfgRes = await fetch(apiUrl("/api/auth/discord/config"));
        if (!cfgRes.ok) throw new Error("Discord not configured on server");
        const { clientId } = await cfgRes.json() as { clientId: string };
        // Opens system browser for OAuth — the Tauri WebView stays on this page.
        // Rust loopback on 127.0.0.1 picks up the ?code=... redirect, exchanges
        // it with the server, and returns the nativeToken here.
        const session = await discordLogin(clientId);
        // Store the nativeToken so all subsequent API calls are authenticated.
        try { localStorage.setItem(NATIVE_TOKEN_KEY, session.native_token); } catch { /* ignore */ }
        // Refresh auth state so any gate that checks /api/me re-queries.
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
        window.location.href = "/tweaks";
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setLoginError(`Sign-in failed: ${msg.replace(/^Error:\s*/i, "")}`);
        setSigningIn(false);
      }
      return;
    }
    loginWithDiscord();
  };

  const handleGuestMode = () => {
    try { localStorage.setItem(GUEST_MODE_KEY, "1"); } catch { /* ignore */ }
    window.location.href = "/tweaks";
  };

  const handleCodeVerify = async () => {
    if (!code.trim()) return;
    setCodeLoading(true);
    setCodeError("");
    try {
      const res = await fetch(apiUrl("/api/pro/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
        body: JSON.stringify({ code: code.trim() }),
        credentials: "include",
      });
      const raw = await res.text();
      let data: { valid?: boolean; sessionToken?: string; error?: string; discordSaved?: boolean } = {};
      try { data = JSON.parse(raw); } catch { /* non-JSON */ }

      if (res.status === 429) {
        setCodeError("Too many attempts — wait a minute and try again.");
      } else if (res.status === 403) {
        setCodeError(data.error || "Your IP is blocked from redeeming codes. Contact support.");
      } else if (data.valid) {
        if (data.sessionToken) {
          setProSession(data.sessionToken);
        } else {
          setProStatus(true);
        }
        setDiscordSaved(data.discordSaved ?? false);
        setCodeSuccess(true);
        // Set guest mode so auth gate lets them through, then navigate.
        // Only auto-redirect immediately if Discord was linked (permanent Pro).
        // If not linked, give the user time to click "Link Discord" first.
        try { localStorage.setItem(GUEST_MODE_KEY, "1"); } catch { /* ignore */ }
        const delay = (data.discordSaved ?? false) ? 1800 : 6000;
        redirectTimer.current = setTimeout(() => { window.location.href = "/tweaks"; }, delay);
      } else {
        setCodeError("Invalid code. If you already paid, DM leaq on Discord and it'll be fixed instantly.");
      }
    } catch {
      setCodeError("Couldn't reach the server. Check your internet and try again.");
    } finally {
      setCodeLoading(false);
    }
  };

  const displayVersion = version.data?.currentVersion ?? "2.00";

  return (
    <div
      data-testid="page-welcome"
      className="fixed inset-0 z-50 bg-[#050505] text-white overflow-hidden font-sans"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 top-1/4 w-[640px] h-[640px] rounded-full bg-red-600/10 blur-[140px]" />
        <div className="absolute left-1/4 bottom-0 w-[480px] h-[480px] rounded-full bg-red-900/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-transparent to-black/80" />
      </div>

      {/* Cosmetic title bar buttons */}
      <div className="absolute top-0 right-0 flex items-center h-9 z-20">
        <button
          type="button"
          data-testid="button-cosmetic-minimize"
          aria-label="Minimize"
          className="w-11 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          data-testid="button-cosmetic-close"
          aria-label="Close"
          className="w-11 h-9 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* "WELCOME TO:" pill */}
          <div className="flex justify-center mb-5">
            <span
              data-testid="text-welcome-pill"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-[10px] font-bold tracking-[0.3em] uppercase text-red-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Welcome to:
            </span>
          </div>

          {/* Title */}
          <h1
            data-testid="text-welcome-title"
            className="text-center text-3xl md:text-4xl font-display font-black tracking-tight leading-tight"
          >
            Opti Gods <span className="text-red-500">Tweaking Utility</span>
          </h1>
          <p className="text-center text-xs text-zinc-500 mt-2 tracking-wider uppercase">
            {view === "code" ? "Enter your premium code below" : "Sign in or redeem your code to access the dashboard"}
          </p>

          {/* Auth card */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
            <AnimatePresence mode="wait">

              {/* ─── MAIN VIEW ─── */}
              {view === "main" && (
                <motion.div
                  key="main"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22 }}
                  className="p-6 space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 font-bold">
                      Log in
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </div>

                  {loginError && (
                    <div
                      data-testid="text-login-error"
                      className="text-[11px] px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-300"
                    >
                      {loginError}
                    </div>
                  )}

                  {(signingIn || isLoading) ? (
                    <div
                      data-testid="status-establishing-session"
                      className="flex items-center justify-center gap-3 py-4 text-zinc-400 text-sm"
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      <span>Establishing secure session…</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLogin}
                      data-testid="button-login-discord"
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white text-sm font-bold tracking-wide shadow-lg shadow-[#5865F2]/20 transition-colors"
                    >
                      <SiDiscord className="w-5 h-5" />
                      Log in with Discord
                    </button>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/6" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-700 font-bold">or</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>

                  {/* Redeem code button */}
                  <button
                    type="button"
                    data-testid="button-redeem-code"
                    onClick={() => { setView("code"); setCodeError(""); setCode(""); }}
                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-red-500/40 bg-red-500/8 hover:bg-red-500/15 hover:border-red-500/60 text-white text-sm font-bold tracking-wide transition-all"
                  >
                    <Ticket className="w-4 h-4 text-red-400" />
                    Redeem your Premium Code
                  </button>

                  {/* Guest / browse without sign-in */}
                  <button
                    type="button"
                    data-testid="button-guest-browse"
                    onClick={handleGuestMode}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 text-xs font-semibold tracking-wide transition-colors hover:bg-white/4"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Browse tweaks without signing in
                  </button>

                  <div className="pt-1 flex items-start gap-2 text-[10px] text-zinc-600 leading-relaxed">
                    <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-500/70 mt-0.5" />
                    <span>
                      Discord OAuth · we only read your username and avatar.
                      <br />
                      No messages, servers, or other data is accessed.
                    </span>
                  </div>
                </motion.div>
              )}

              {/* ─── CODE REDEMPTION VIEW ─── */}
              {view === "code" && (
                <motion.div
                  key="code"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.22 }}
                  className="p-6"
                >
                  {codeSuccess ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <ShieldCheck className="w-7 h-7 text-emerald-400" />
                      </div>
                      <p className="text-white font-bold text-base">Pro Access Granted!</p>
                      {discordSaved ? (
                        <p className="text-xs text-emerald-400 font-semibold">
                          ✓ Saved permanently to your Discord account
                        </p>
                      ) : (
                        <div className="w-full space-y-3 mt-1">
                          <div className="rounded-xl border border-amber-500/40 bg-amber-500/8 p-3 text-left">
                            <p className="text-[11px] font-bold text-amber-300 mb-1">⚠ Your access is browser-only right now</p>
                            <p className="text-[11px] text-zinc-400 leading-snug">
                              If you clear your browser, switch devices, or reinstall the app, your code will be dead and you'll need leaq to manually revive it.{" "}
                              <span className="text-amber-300 font-semibold">Link Discord to make it permanent on any device — no revival, ever.</span>
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (redirectTimer.current) clearTimeout(redirectTimer.current);
                              handleLogin();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-bold tracking-wide transition-colors shadow-lg shadow-[#5865F2]/20"
                          >
                            <SiDiscord className="w-4 h-4" />
                            Link Discord — save permanently
                          </button>
                          <button
                            type="button"
                            onClick={() => { window.location.href = "/tweaks"; }}
                            className="w-full text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
                          >
                            Skip — enter dashboard without linking →
                          </button>
                        </div>
                      )}
                      <p className="text-[11px] text-zinc-600 mt-1">Entering dashboard…</p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid="button-code-back"
                        onClick={() => { setView("main"); setCodeError(""); setCode(""); }}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 font-semibold mb-5 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Back
                      </button>

                      <p className="text-sm font-black text-white mb-1">Enter your Premium Code</p>
                      <p className="text-[11px] text-zinc-500 mb-5 leading-snug">
                        Purchased a code? Enter it below. If you haven't bought yet,{" "}
                        <button
                          type="button"
                          onClick={() => setView("main")}
                          className="text-red-400 hover:text-red-300 underline transition-colors"
                        >
                          go back
                        </button>
                        {" "}to see payment options.
                      </p>

                      <div className="flex gap-2 mb-3">
                        <input
                          data-testid="input-welcome-code"
                          type="text"
                          placeholder="XXXX-XXXX-XXXX"
                          value={code}
                          autoFocus
                          onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && handleCodeVerify()}
                          className="flex-1 bg-zinc-900/80 border border-zinc-700 focus:border-red-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none font-mono transition-colors"
                        />
                        <button
                          type="button"
                          data-testid="button-welcome-verify-code"
                          onClick={handleCodeVerify}
                          disabled={codeLoading || !code.trim()}
                          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shrink-0"
                        >
                          {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
                        </button>
                      </div>

                      {codeError && (
                        <p className="text-xs text-red-400 mb-3 leading-snug">{codeError}</p>
                      )}

                      {/* Revival risk warning */}
                      <div className="rounded-xl border border-amber-500/35 bg-amber-500/6 p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-amber-300 leading-snug">
                              Log in with Discord first — or your access may go dead
                            </p>
                            <p className="text-[11px] text-zinc-400 leading-snug">
                              Without Discord, your Pro access is saved <span className="text-white font-semibold">only in this session</span>. Clear your browser, switch devices, or reinstall the app and your code becomes dead — leaq will need to manually revive it for you.
                            </p>
                            <p className="text-[11px] text-zinc-400 leading-snug">
                              <span className="text-emerald-400 font-semibold">Discord login = permanent access on any device, no revival, no risk.</span>
                            </p>
                            <button
                              type="button"
                              onClick={handleLogin}
                              className="flex items-center gap-1.5 text-[11px] text-[#5865F2] hover:text-blue-300 font-bold transition-colors pt-0.5"
                            >
                              <SiDiscord className="w-3.5 h-3.5" />
                              Log in with Discord first (recommended) →
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Also allow guest browse from code view */}
                      <button
                        type="button"
                        data-testid="button-code-guest-browse"
                        onClick={handleGuestMode}
                        className="w-full flex items-center justify-center gap-2 py-2 text-zinc-600 hover:text-zinc-400 text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Just browse tweaks instead →
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-[10px] text-zinc-700 mt-6 tracking-wider uppercase">
            by leaq · all rights reserved
          </p>
        </motion.div>
      </div>

      {/* Version pin */}
      <div className="absolute bottom-3 right-4 z-20 text-[10px] font-mono text-zinc-700 select-none">
        v{displayVersion}
      </div>
    </div>
  );
}
