import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import Welcome from "@/pages/welcome";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

// Paths that must remain reachable without a Discord session
// (Stripe redirects to these, and they have their own internal handling.)
const PUBLIC_PATHS = new Set<string>([
  "/payment/success",
  "/payment/cancel",
]);

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Stripe and other "callback-style" paths always render
  if (PUBLIC_PATHS.has(location)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div
        data-testid="status-auth-loading"
        className="fixed inset-0 z-50 bg-[#050505] text-white flex items-center justify-center"
      >
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-red-400" />
          <span>Loading Opti Gods…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Welcome />;
  }

  return <>{children}</>;
}
