import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { setProStatus } from "@/lib/pro-status";
import { useToast } from "@/hooks/use-toast";
import { OnboardingModal } from "@/components/onboarding-modal";
import { AuthGate } from "@/components/auth-gate";
import { UpdateModal } from "@/components/update-modal";
import { VersionPin } from "@/components/version-pin";
import NotFound from "@/pages/not-found";
import { BootSplash } from "@/components/branding/boot-splash";
import { ProCelebration } from "@/components/branding/pro-celebration";

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
    fetch("/api/track-visit", {
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

    fetch("/api/pro/friend", {
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
  return (
    <Switch>
      {/* V2 landing — public */}
      <Route path="/" component={Landing} />

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BootSplash />
        <ProCelebration />
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
