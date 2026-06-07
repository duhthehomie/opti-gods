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
import { isNative, discordCachedToken } from "@/lib/tauri-bridge";
import { NATIVE_TOKEN_KEY } from "@/lib/queryClient";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Admin from "@/pages/admin";
import GetCode from "@/pages/get-code";
import Showcase from "@/pages/showcase";
import OptiGodsAI from "@/pages/opti-gods-ai";
import TweaksPage from "@/pages/tweaks";
import ToolsFixesPage from "@/pages/tools-fixes";
import SystemScanPage from "@/pages/system-scan";
import ProPage from "@/pages/pro";
import { GUEST_MODE_KEY } from "@/pages/welcome";
import AccountPage from "@/pages/account";
import GameDetectionPage from "@/pages/game-detection";
import ProcessesPage from "@/pages/processes";
import HelpPage from "@/pages/help";
import TaskManagerPage from "@/pages/task-manager";

function SmartHome() {
  const isGuest = (() => { try { return localStorage.getItem(GUEST_MODE_KEY) === "1"; } catch { return false; } })();
  if (isGuest) return <Dashboard />;
  return <Landing />;
}

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
  // Native shell → Dashboard (the real home). Web → SmartHome (Landing for
  // unauthenticated visitors, Dashboard when logged-in or in guest mode).
  const HomeComponent = isNative() ? Dashboard : SmartHome;
  return (
    <Switch>
      <Route path="/" component={HomeComponent} />
      <Route path="/dashboard" component={Dashboard} />

      <Route path="/tweaks" component={TweaksPage} />
      <Route path="/tools" component={ToolsFixesPage} />
      <Route path="/system-scan" component={SystemScanPage} />
      <Route path="/pro" component={ProPage} />

      <Route path="/ai" component={OptiGodsAI} />
      <Route path="/account" component={AccountPage} />
      <Route path="/admin" component={Admin} />
      <Route path="/showcase" component={Showcase} />
      <Route path="/get-code" component={GetCode} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      <Route path="/game-detection" component={GameDetectionPage} />
      <Route path="/processes" component={ProcessesPage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/task-manager" component={TaskManagerPage} />

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

// On every cold-start inside the Tauri shell, restore the Discord session
// from the OS keyring so the user stays signed-in without re-authorising.
function NativeCachedTokenHandler() {
  useEffect(() => {
    if (!isNative()) return;
    discordCachedToken()
      .then((session) => {
        if (!session?.native_token) return;
        try { localStorage.setItem(NATIVE_TOKEN_KEY, session.native_token); } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      })
      .catch(() => { /* keyring unavailable — user will need to log in */ });
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
        <NativeCachedTokenHandler />
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
