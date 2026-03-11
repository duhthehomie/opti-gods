import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Registry from "@/pages/registry";
import Fivem from "@/pages/fivem";
import Nvidia from "@/pages/nvidia";
import ProcessLasso from "@/pages/process-lasso";
import StartupApps from "@/pages/startup-apps";
import Debloat from "@/pages/debloat";
import Memory from "@/pages/memory";

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
