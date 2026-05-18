import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import Welcome from "@/pages/welcome";
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
]);
const PUBLIC_PATHS_NATIVE = new Set<string>([
  "/payment/success",
  "/payment/cancel",
  "/admin",
]);

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const publicPaths = isNative() ? PUBLIC_PATHS_NATIVE : PUBLIC_PATHS_WEB;

  // Public landing/marketing/callback paths always render
  if (publicPaths.has(location)) {
    return <>{children}</>;
  }

  if (isLoading) {
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
