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
import { Redirect } from "@/components/redirect";

import Home from "@/pages/home";
import SystemScan from "@/pages/system-scan";
import Tweaks from "@/pages/tweaks";
import ToolsFixes from "@/pages/tools-fixes";
import Pro from "@/pages/pro";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import Admin from "@/pages/admin";
import Updates from "@/pages/updates";
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
  return (
    <Switch>
      {/* V2: 5-tab IA */}
      <Route path="/" component={Home} />
      <Route path="/system-scan" component={SystemScan} />
      <Route path="/tweaks" component={Tweaks} />
      <Route path="/tools" component={ToolsFixes} />
      <Route path="/pro" component={Pro} />

      {/* Redirects from legacy optimizer routes into Tweaks accordion anchors */}
      <Route path="/registry">{() => <Redirect to="/tweaks#registry" />}</Route>
      <Route path="/fivem">{() => <Redirect to="/tweaks#fivem" />}</Route>
      <Route path="/fortnite">{() => <Redirect to="/tweaks#fortnite" />}</Route>
      <Route path="/nvidia">{() => <Redirect to="/tweaks#nvidia" />}</Route>
      <Route path="/amd">{() => <Redirect to="/tweaks#amd" />}</Route>
      <Route path="/integrated-graphics">{() => <Redirect to="/tweaks#intgpu" />}</Route>
      <Route path="/laptop">{() => <Redirect to="/tweaks#laptop" />}</Route>
      <Route path="/discord">{() => <Redirect to="/tweaks#discord" />}</Route>
      <Route path="/memory">{() => <Redirect to="/tweaks#memory" />}</Route>
      <Route path="/startup">{() => <Redirect to="/tweaks#startup" />}</Route>
      <Route path="/debloat">{() => <Redirect to="/tweaks#debloat" />}</Route>
      <Route path="/process-lasso">{() => <Redirect to="/tweaks#process-lasso" />}</Route>
      <Route path="/processes">{() => <Redirect to="/tweaks#processes" />}</Route>
      <Route path="/wintitus">{() => <Redirect to="/tweaks#wintitus" />}</Route>
      <Route path="/boost">{() => <Redirect to="/tweaks" />}</Route>

      {/* Redirects into Tools & Fixes tabs */}
      <Route path="/fixes">{() => <Redirect to="/tools#fixes" />}</Route>
      <Route path="/game-detection">{() => <Redirect to="/tools#game-detection" />}</Route>
      <Route path="/custom-os">{() => <Redirect to="/tools#custom-os" />}</Route>
      <Route path="/help">{() => <Redirect to="/tools#help" />}</Route>

      {/* Standalone routes preserved */}
      <Route path="/ai" component={OptiGodsAI} />
      <Route path="/updates" component={Updates} />
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
