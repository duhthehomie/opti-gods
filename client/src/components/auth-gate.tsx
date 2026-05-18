import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import Welcome from "@/pages/welcome";
import { useLocation } from "wouter";
import { BRAND, prefersReducedMotion } from "@/components/branding/assets";

// Paths that must remain reachable without a Discord session.
// V2: landing page and marketing/payment surfaces are public — only the
// optimizer, AI chat, admin, and code-redeem flows require auth.
const PUBLIC_PATHS = new Set<string>([
  "/",
  "/ai",
  "/showcase",
  "/payment/success",
  "/payment/cancel",
  "/admin",
]);

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Public landing/marketing/callback paths always render
  if (PUBLIC_PATHS.has(location)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div
        data-testid="status-auth-loading"
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        {prefersReducedMotion() ? (
          <img src={BRAND.redPng} alt="Opti Gods" className="w-[80vw] h-[80vh] object-contain drop-shadow-[0_0_80px_rgba(239,68,68,0.7)]" />
        ) : (
          <video
            src={BRAND.spinRed}
            autoPlay
            muted
            playsInline
            preload="metadata"
            className="w-[80vw] h-[80vh] object-contain drop-shadow-[0_0_80px_rgba(239,68,68,0.7)]"
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
