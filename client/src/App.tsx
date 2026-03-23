import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Registry from "@/pages/registry";
import Fivem from "@/pages/fivem";
import Nvidia from "@/pages/nvidia";
import ProcessLasso from "@/pages/process-lasso";
import StartupApps from "@/pages/startup-apps";
import Debloat from "@/pages/debloat";
import Memory from "@/pages/memory";
import Fortnite from "@/pages/fortnite";
import GameDetection from "@/pages/game-detection";

const PRO_KEY = "optigods_pro_v1";

function FriendUnlockHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlockParam = params.get("unlock");
    const freeKey = import.meta.env.VITE_FREE_KEY;

    if (unlockParam && freeKey && unlockParam === freeKey) {
      localStorage.setItem(PRO_KEY, "true");
      const url = new URL(window.location.href);
      url.searchParams.delete("unlock");
      window.history.replaceState({}, "", url.toString());
    }
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
      <Route path="/process-lasso" component={ProcessLasso} />
      <Route path="/startup" component={StartupApps} />
      <Route path="/debloat" component={Debloat} />
      <Route path="/memory" component={Memory} />
      <Route path="/fortnite" component={Fortnite} />
      <Route path="/game-detection" component={GameDetection} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FriendUnlockHandler />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
