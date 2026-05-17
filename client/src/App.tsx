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

import Dashboard from "@/pages/dashboard";
import Registry from "@/pages/registry";
import Fivem from "@/pages/fivem";
import Nvidia from "@/pages/nvidia";
import Amd from "@/pages/amd";
import ProcessLasso from "@/pages/process-lasso";
import ProcessesPage from "@/pages/processes";
import StartupApps from "@/pages/startup-apps";
import Debloat from "@/pages/debloat";
import Memory from "@/pages/memory";
import Fortnite from "@/pages/fortnite";
import GameDetection from "@/pages/game-detection";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Admin from "@/pages/admin";
import Help from "@/pages/help";
import Fixes from "@/pages/fixes";
import WinTitus from "@/pages/wintitus";
import CustomOS from "@/pages/custom-os";
import Updates from "@/pages/updates";
import DiscordPage from "@/pages/discord";
import IntegratedGraphics from "@/pages/integrated-graphics";
import GetCode from "@/pages/get-code";
import Showcase from "@/pages/showcase";
import LaptopPage from "@/pages/laptop";
import BoostPage from "@/pages/boost";
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
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/registry" component={Registry} />
      <Route path="/fivem" component={Fivem} />
      <Route path="/nvidia" component={Nvidia} />
      <Route path="/amd" component={Amd} />
      <Route path="/process-lasso" component={ProcessLasso} />
      <Route path="/startup" component={StartupApps} />
      <Route path="/debloat" component={Debloat} />
      <Route path="/memory" component={Memory} />
      <Route path="/fortnite" component={Fortnite} />
      <Route path="/game-detection" component={GameDetection} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      <Route path="/admin" component={Admin} />
      <Route path="/fixes" component={Fixes} />
      <Route path="/wintitus" component={WinTitus} />
      <Route path="/custom-os" component={CustomOS} />
      <Route path="/updates" component={Updates} />
      <Route path="/discord" component={DiscordPage} />
      <Route path="/integrated-graphics" component={IntegratedGraphics} />
      <Route path="/laptop" component={LaptopPage} />
      <Route path="/showcase" component={Showcase} />
      <Route path="/help" component={Help} />
      <Route path="/get-code" component={GetCode} />
      <Route path="/boost" component={BoostPage} />
      <Route path="/processes" component={ProcessesPage} />
      <Route path="/ai" component={OptiGodsAI} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
