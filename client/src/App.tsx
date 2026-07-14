import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { setProStatus } from "@/lib/pro-status";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { AuthGate } from "@/components/auth-gate";
import { UpdateModal } from "@/components/update-modal";
import { VersionPin } from "@/components/version-pin";
import NotFound from "@/pages/not-found";
import { BootSplash } from "@/components/branding/boot-splash";
import { ProCelebration } from "@/components/branding/pro-celebration";
import { bootstrapNative } from "@/lib/native-bootstrap";
import { isNative, discordCachedToken, onFileDrop, readTauriTextFile } from "@/lib/tauri-bridge";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { NATIVE_TOKEN_KEY } from "@/lib/queryClient";

// Always eager — these are the first screens the user sees
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";

// Lazy — only loaded when first navigated to; keeps initial parse budget low
const Admin          = lazy(() => import("@/pages/admin"));
const TweaksPage     = lazy(() => import("@/pages/tweaks"));
const ToolsFixesPage = lazy(() => import("@/pages/tools-fixes"));
const SystemScanPage = lazy(() => import("@/pages/system-scan"));
const ProPage        = lazy(() => import("@/pages/pro"));
const OptiGodsAI     = lazy(() => import("@/pages/opti-gods-ai"));
const AccountPage    = lazy(() => import("@/pages/account"));
const Showcase       = lazy(() => import("@/pages/showcase"));
const GetCode        = lazy(() => import("@/pages/get-code"));
const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const PaymentCancel  = lazy(() => import("@/pages/payment-cancel"));
const GameDetectionPage = lazy(() => import("@/pages/game-detection"));
const ProcessesPage  = lazy(() => import("@/pages/processes"));
const HelpPage       = lazy(() => import("@/pages/help"));
const TaskManagerPage    = lazy(() => import("@/pages/task-manager"));
const FivemGraphicsPage  = lazy(() => import("@/pages/fivem-graphics"));

import { GUEST_MODE_KEY } from "@/pages/welcome";

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

const PENDING_FRIEND_KEY = "optigods_pending_friend";

function FriendUnlockHandler() {
  const { toast } = useToast();
  useEffect(() => {
    // Pull token from URL param OR a pending token saved before Discord login
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("friend");
    const pendingToken = (() => { try { return sessionStorage.getItem(PENDING_FRIEND_KEY); } catch { return null; } })();
    const token = urlToken ?? pendingToken;
    if (!token) return;

    // Clean the URL so refresh doesn't re-trigger
    if (urlToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("friend");
      window.history.replaceState({}, "", url.toString());
    }

    fetch(apiUrl("/api/pro/friend"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid && data.sessionToken) {
          try { sessionStorage.removeItem(PENDING_FRIEND_KEY); } catch {}
          setProStatus(true, data.sessionToken);
          window.location.reload();
        } else if (data.error === "discord_required") {
          // Save the token so it auto-redeems after the user signs in with Discord
          try { sessionStorage.setItem(PENDING_FRIEND_KEY, token); } catch {}
          toast({
            title: "Discord sign-in required",
            description: "Connect your Discord account first — your friend link will unlock automatically after you sign in.",
            variant: "destructive",
          });
        } else {
          try { sessionStorage.removeItem(PENDING_FRIEND_KEY); } catch {}
          toast({
            title: "Link already used",
            description: "This friend link has already been redeemed. Each link can only be used once.",
            variant: "destructive",
          });
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function Router() {
  const HomeComponent = isNative() ? Dashboard : SmartHome;
  return (
    <Suspense fallback={null}>
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
        <Route path="/fivem-graphics" component={FivemGraphicsPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function NativeTokenHandler() {
  useEffect(() => {
    if (!isNative()) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("nativeToken");
    if (!token) return;
    try { localStorage.setItem(NATIVE_TOKEN_KEY, token); } catch { /* ignore */ }
    const clean = new URL(window.location.href);
    clean.searchParams.delete("nativeToken");
    window.history.replaceState({}, "", clean.toString());
    queryClient.invalidateQueries({ queryKey: ["/api/me"] });
  }, []);
  return null;
}

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
  useEffect(() => {
    bootstrapNative().catch((err) => console.warn("[native] bootstrap", err));
  }, []);
  return null;
}

function TauriFileDropHandler() {
  const { toast } = useToast();
  useEffect(() => {
    if (!isNative()) return;
    let cleanup: (() => Promise<void>) | null = null;
    onFileDrop(async (paths) => {
      const jsonPath = paths.find(p => p.toLowerCase().endsWith(".json"));
      if (!jsonPath) return;
      try {
        const text = await readTauriTextFile(jsonPath);
        let detected: Record<string, boolean> | null = null;
        let rawParsed: unknown = null;
        try {
          rawParsed = JSON.parse(text.trim());
        } catch {}
        if (rawParsed && typeof rawParsed === "object") {
          const obj = rawParsed as Record<string, unknown>;
          // Skip HW-monitor temp files (has gpu_temp_c / cpu_temp_c)
          if ("gpu_temp_c" in obj || "cpu_temp_c" in obj) return;
          // Skip hardware sysinfo files (has GPU + CPU + RAM_GB but no boolean tweaks)
          if ("GPU" in obj && "CPU" in obj && "RAM_GB" in obj) return;
          detected = obj as Record<string, boolean>;
        }
        if (!detected) {
          try {
            const match = text.match(/OPTIGODS_STATE:([A-Za-z0-9+/=]+)/);
            const b64 = match ? match[1] : text.trim();
            detected = JSON.parse(atob(b64));
          } catch {}
        }
        if (!detected) {
          toast({ title: "Couldn't read file", description: "Drop OptiGods-DetectedTweaks.json from the detect script.", variant: "destructive" });
          return;
        }
        const store = useOptimizationStore.getState();
        const next = { ...store.tweaks };
        let count = 0;
        for (const [key, val] of Object.entries(detected)) {
          if (key in next && typeof val === "boolean") { next[key] = val; if (val) count++; }
        }
        store.setAllTweaks(next);
        window.dispatchEvent(new CustomEvent("optigods:tweaks-imported", { detail: { count } }));
        toast({ title: "PC state loaded", description: `${count} optimizations detected as already applied.` });
      } catch (err) {
        toast({ title: "File read failed", description: String(err), variant: "destructive" });
      }
    }).then(u => { cleanup = u; });
    return () => { cleanup?.(); };
  }, [toast]);
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
        <TauriFileDropHandler />
        <VisitTracker />
        <FriendUnlockHandler />
        <AuthGate>
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
