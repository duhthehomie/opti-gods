import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import Welcome from "@/pages/welcome";
import { GUEST_MODE_KEY } from "@/pages/welcome";
import { useLocation } from "wouter";
import { BRAND, prefersReducedMotion } from "@/components/branding/assets";
import { isNative } from "@/lib/tauri-bridge";

// Paths that must remain reachable without a Discord session.
// V2: landing page and marketing/payment surfaces are public — only the
// optimizer, AI chat, admin, and code-redeem flows require auth.
// Native shell: "/" is NOT public — desktop users must sign in with
// Discord on first open before they see anything.
const PUBLIC_PATHS_WEB = new Set<string>([
  "/",
  "/ai",
  "/showcase",
  "/payment/success",
  "/payment/cancel",
  "/admin",
  "/game-detection",
]);
const PUBLIC_PATHS_NATIVE = new Set<string>([
  "/payment/success",
  "/payment/cancel",
  "/admin",
  "/game-detection",
]);

function isGuestMode(): boolean {
  try { return localStorage.getItem(GUEST_MODE_KEY) === "1"; } catch { return false; }
}

// In the native shell the auth check hits the remote server over the
// internet. If that round-trip stalls (offline, slow network, cold server)
// isLoading stays true forever → pure black screen.
// We cap the loading phase at 4 s: after that, treat as unauthenticated
// and show the Discord login page immediately.
const NATIVE_AUTH_TIMEOUT_MS = 4_000;

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const publicPaths = isNative() ? PUBLIC_PATHS_NATIVE : PUBLIC_PATHS_WEB;

  // Start a timeout whenever we enter a loading state in the native shell.
  // The timeout is cleared if loading finishes before it fires.
  useEffect(() => {
    if (!isNative() || !isLoading) return;
    const t = window.setTimeout(() => setAuthTimedOut(true), NATIVE_AUTH_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  // Reset timed-out flag once loading actually completes
  useEffect(() => {
    if (!isLoading) setAuthTimedOut(false);
  }, [isLoading]);

  // Public landing/marketing/callback paths always render
  if (publicPaths.has(location)) {
    return <>{children}</>;
  }

  // Guest mode — user explicitly chose to browse without Discord sign-in.
  // Pro features are still gated by the ProGate component; this just allows
  // the optimizer pages to render without a Discord session.
  if (isGuestMode()) {
    return <>{children}</>;
  }

  // Show loading spinner only while genuinely loading AND not yet timed out
  if (isLoading && !authTimedOut) {
    return (
      <div
        data-testid="status-auth-loading"
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        {prefersReducedMotion() ? (
          <img src={BRAND.redPng} alt="Opti Gods" className="w-44 h-44 object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.55)]" />
        ) : (
          <video
            src={BRAND.spinRed}
            autoPlay
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Welcome />;
  }

  return <>{children}</>;
}
