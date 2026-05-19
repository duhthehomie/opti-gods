import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Minus, X, Loader2, ShieldCheck } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { loginWithDiscord, useAuth, useVersionInfo } from "@/hooks/use-auth";
import { isNative } from "@/lib/tauri-bridge";
import { apiBase } from "@/lib/api-base";

export default function Welcome() {
  const { isLoading } = useAuth();
  const version = useVersionInfo();
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("login");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleLogin = () => {
    setSigningIn(true);
    setLoginError(null);
    if (isNative()) {
      // In the desktop app we can't use relative URLs — they resolve to
      // tauri.localhost which has no server. Navigate the webview to the
      // production OAuth endpoint with ?native=1 so the server returns a
      // bearer token instead of a same-origin cookie after auth completes.
      window.location.href =
        `${apiBase()}/api/auth/discord/login?native=1`;
      return;
    }
    // Preserve the route the user originally requested so they land back on it
    // after the Discord round-trip. loginWithDiscord defaults to current path
    // when no argument is provided.
    loginWithDiscord();
  };

  const displayVersion = version.data?.currentVersion ?? "2.00";

  return (
    <div
      data-testid="page-welcome"
      className="fixed inset-0 z-50 bg-[#050505] text-white overflow-hidden font-sans"
    >
      {/* Ambient background — left-side faint red glow + subtle vignette */}
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

      {/* Cosmetic title bar buttons (top-right) — purely visual */}
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
            Sign in to access the dashboard
          </p>

          {/* Auth card */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 shadow-2xl shadow-black/80">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 font-bold">
                Log in
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {loginError && (
              <div
                data-testid="text-login-error"
                className="mb-3 text-[11px] px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-300"
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

            <div className="mt-5 flex items-center gap-2 text-[10px] text-zinc-600 leading-relaxed">
              <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-500/70" />
              <span>
                Discord OAuth · we only read your username and avatar.
                <br />
                No messages, servers, or other data is accessed.
              </span>
            </div>
          </div>

          <p className="text-center text-[10px] text-zinc-700 mt-6 tracking-wider uppercase">
            by leaq · all rights reserved
          </p>
        </motion.div>
      </div>

      {/* v2.00 pin (bottom-right) */}
      <div className="absolute bottom-3 right-4 z-20 text-[10px] font-mono text-zinc-700 select-none">
        v{displayVersion}
      </div>
    </div>
  );
}
