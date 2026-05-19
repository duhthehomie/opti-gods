import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { setProStatus } from "@/lib/pro-status";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { OnboardingModal } from "@/components/onboarding-modal";
import { AuthGate } from "@/components/auth-gate";
import { UpdateModal } from "@/components/update-modal";
import { VersionPin } from "@/components/version-pin";
import NotFound from "@/pages/not-found";
import { BootSplash } from "@/components/branding/boot-splash";
import { ProCelebration } from "@/components/branding/pro-celebration";
import { bootstrapNative } from "@/lib/native-bootstrap";
import { isNative } from "@/lib/tauri-bridge";
import { NATIVE_TOKEN_KEY } from "@/lib/queryClient";

import Landing from "@/pages/landing";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Admin from "@/pages/admin";
import GetCode from "@/pages/get-code";
import Showcase from "@/pages/showcase";
import OptiGodsAI from "@/pages/opti-gods-ai";

function VisitTracker() {
  useEffect(() => {
    const SESSION_KEY = "optigods_visit_tracked";
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const referrer = document.referrer || undefined;
    fetch(apiUrl("/api/track-visit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer }),
    }).catch(() => {});
  }, []);
  return null;
}

function FriendUnlockHandler() {
  const { toast } = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("friend");
    if (!token) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("friend");
    window.history.replaceState({}, "", url.toString());

    fetch(apiUrl("/api/pro/friend"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid && data.sessionToken) {
          setProStatus(true, data.sessionToken);
          window.location.reload();
        } else {
          toast({
            title: "Link already used",
            description: "This friend link has already been redeemed. Each link can only be used once.",
            variant: "destructive",
          });
        }
      })
      .catch(() => {});
  }, []);

  return null;
}

function Router() {
  // Note: legacy optimizer paths (/dashboard, /tweaks, /tools, /system-scan,
  // /pro, /registry, /fivem, etc.) are 302'd server-side in server/routes.ts
  // — they never reach the SPA, so we don't list them here.
  //
  // Native shell: "/" sends straight to the AI/tweaks workspace — the
  // marketing landing page (with its ".exe download" CTA) is web-only.
  const HomeComponent = isNative() ? OptiGodsAI : Landing;
  return (
    <Switch>
      {/* V2 landing — public on web, AI workspace in native */}
      <Route path="/" component={HomeComponent} />

      {/* Standalone routes preserved */}
      <Route path="/ai" component={OptiGodsAI} />
      <Route path="/admin" component={Admin} />
      <Route path="/showcase" component={Showcase} />
      <Route path="/get-code" component={GetCode} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />

      <Route component={NotFound} />
    </Switch>
  );
}

// Reads ?nativeToken= from the URL after Discord OAuth redirects back to the
// Tauri app. Stores the token in localStorage so every subsequent API call
// can send it as X-Native-Auth and bypass the SameSite=Lax cookie restriction.
function NativeTokenHandler() {
  useEffect(() => {
    if (!isNative()) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("nativeToken");
    if (!token) return;
    try { localStorage.setItem(NATIVE_TOKEN_KEY, token); } catch { /* ignore */ }
    // Clean the token from the URL so it isn't bookmarked or logged
    const clean = new URL(window.location.href);
    clean.searchParams.delete("nativeToken");
    window.history.replaceState({}, "", clean.toString());
    // Invalidate /api/me so it immediately re-fetches with the new token
    queryClient.invalidateQueries({ queryKey: ["/api/me"] });
  }, []);
  return null;
}

function NativeBootstrap() {
  // Fire-and-forget on mount. In the browser this no-ops; in the Tauri
  // shell it loads envInfo(), starts ProBalance, and closes the splash
  // window once React has flushed.
  useEffect(() => {
    bootstrapNative().catch((err) => console.warn("[native] bootstrap", err));
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BootSplash />
        <ProCelebration />
        <NativeTokenHandler />
        <NativeBootstrap />
        <VisitTracker />
        <FriendUnlockHandler />
        <AuthGate>
          <OnboardingModal />
          <Toaster />
          <Router />
          <UpdateModal />
          <VersionPin />
        </AuthGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
