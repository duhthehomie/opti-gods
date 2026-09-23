import { Switch, Route, useLocation } from "wouter";
import { getNativeAuthHeaders, queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Component, type ErrorInfo, type ReactNode, useEffect, lazy, Suspense } from "react";
import { setProStatus } from "@/lib/pro-status";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { AuthGate } from "@/components/auth-gate";
import { UpdateModal } from "@/components/update-modal";
import { VersionPin } from "@/components/version-pin";
import NotFound from "@/pages/not-found";
import { BootSplash } from "@/components/branding/boot-splash";
import { AuthTransitionOverlay } from "@/components/branding/auth-transition-overlay";
import { ProCelebration } from "@/components/branding/pro-celebration";
import { bootstrapNative } from "@/lib/native-bootstrap";
import { isNative, discordCachedToken } from "@/lib/tauri-bridge";
import { showLoginSuccess } from "@/lib/auth-feedback";
import { NATIVE_TOKEN_KEY } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { NativeRestoreReadinessBanner } from "@/components/native-restore-readiness-banner";
import { installGlobalErrorReporting, reportClientError } from "@/lib/client-error-reporter";
import { APP_VERSION } from "@/generated/version";

const PUBLIC_SITE_ORIGIN = "https://optigods.com";
const ROUTE_SEO: Record<string, { title: string; description: string; index: boolean }> = {
  "/": {
    title: `Opti Gods V${APP_VERSION} — Windows Gaming PC Optimizer by leaq`,
    description: `Opti Gods V${APP_VERSION} by leaq: 608+ hardware-aware Windows 10/11 tweaks, game packs, green presets, and transparent scripts.`,
    index: true,
  },
  "/showcase": {
    title: `Opti Gods V${APP_VERSION} Showcase — Gaming PC Optimization by leaq`,
    description: "See Opti Gods V5 in action with transparent Windows tweaks, game optimization packs, and real product previews.",
    index: true,
  },
  "/updates": {
    title: `Opti Gods V${APP_VERSION} Updates — V5 Changelog`,
    description: `Follow the Opti Gods V${APP_VERSION} changelog for Windows optimizer improvements, game packs, native app updates, and fixes.`,
    index: true,
  },
  "/pro": {
    title: `Opti Gods V${APP_VERSION} Pro — Lifetime Windows Gaming Optimization`,
    description: "Unlock hardware-aware Windows tweaks, game packs, AI tools, presets, and transparent script generation with lifetime Pro access.",
    index: true,
  },
  "/game-profiles": {
    title: `Opti Gods V${APP_VERSION} Game Profiles — FiveM, Fortnite, CoD, Rust & Roblox`,
    description: "Explore Opti Gods V5 game-specific Windows optimization profiles for FiveM, Fortnite, Call of Duty, Rust, Roblox, and more.",
    index: true,
  },
  "/game-profiles/fivem": {
    title: `FiveM FPS Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Hardware-aware FiveM and GTA V Windows optimization tools, transparent tweaks, and game-specific recommendations.",
    index: true,
  },
  "/game-profiles/fortnite": {
    title: `Fortnite FPS Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Hardware-aware Fortnite Windows optimization tools for FPS, latency, input, GPU, and memory settings.",
    index: true,
  },
  "/game-profiles/call-of-duty": {
    title: `Call of Duty Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Windows optimization tools for Call of Duty and Warzone with transparent network, input, memory, and performance tweaks.",
    index: true,
  },
  "/game-profiles/rust": {
    title: `Rust FPS Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Hardware-aware Rust game optimization tools for Windows gaming performance and transparent script generation.",
    index: true,
  },
  "/game-profiles/roblox": {
    title: `Roblox Performance Optimization V${APP_VERSION} — Opti Gods by leaq`,
    description: "Windows performance recommendations for Roblox with hardware-aware tweaks and transparent optimization scripts.",
    index: true,
  },
};

function RouteSeo() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location.split("?")[0] || "/";
    const seo = ROUTE_SEO[path] ?? {
      title: `Opti Gods V${APP_VERSION} — Windows Gaming PC Optimizer by leaq`,
      description: `Opti Gods V${APP_VERSION}: hardware-aware Windows gaming optimization with transparent tweaks and game-specific tools.`,
      index: false,
    };
    const canonical = `${PUBLIC_SITE_ORIGIN}${path === "/" ? "/" : path}`;
    document.title = seo.title;

    const setMeta = (attribute: "name" | "property", key: string, value: string) => {
      const selector = `meta[${attribute}="${key}"]`;
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = value;
    };
    setMeta("name", "description", seo.description);
    setMeta("name", "robots", seo.index ? "index, follow" : "noindex, nofollow");
    setMeta("property", "og:title", seo.title);
    setMeta("property", "og:description", seo.description);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:title", seo.title);
    setMeta("name", "twitter:description", seo.description);
    setMeta("name", "twitter:url", canonical);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [location]);

  return null;
}

// Always eager — these are the first screens the user sees
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";

// Lazy — only loaded when first navigated to; keeps initial parse budget low
const Admin          = lazy(() => import("@/pages/admin"));
const TweaksPage     = lazy(() => import("@/pages/tweaks"));
const ToolsFixesPage = lazy(() => import("@/pages/tools-fixes"));
const SystemScanPage = lazy(() => import("@/pages/system-scan"));
const AppliedTweaksPage = lazy(() => import("@/pages/applied-tweaks"));
const PowerPlansPage = lazy(() => import("@/pages/power-plans"));
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
const GameProfilesPage   = lazy(() => import("@/pages/game-profiles"));
const UpdatesPage        = lazy(() => import("@/pages/updates"));
const FivemPage          = lazy(() => import("@/pages/fivem"));
const FortnitePage       = lazy(() => import("@/pages/fortnite"));
const CallOfDutyPage     = lazy(() => import("@/pages/call-of-duty"));
const Bond007Page        = lazy(() => import("@/pages/bond-007"));
const RustGamePage       = lazy(() => import("@/pages/rust-game"));
const RobloxPage         = lazy(() => import("@/pages/roblox"));
const DiscordPage        = lazy(() => import("@/pages/discord"));
const SpotifyPage        = lazy(() => import("@/pages/spotify"));

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
    <>
      <RouteSeo />
      <Suspense fallback={null}>
        <Switch>
        <Route path="/" component={HomeComponent} />
        <Route path="/dashboard" component={Dashboard} />

        <Route path="/tweaks" component={TweaksPage} />
        <Route path="/tools" component={ToolsFixesPage} />
        <Route path="/system-scan" component={SystemScanPage} />
        <Route path="/ai-optimize" component={SystemScanPage} />
        <Route path="/applied-tweaks" component={AppliedTweaksPage} />
        <Route path="/power-plans" component={PowerPlansPage} />
        <Route path="/pro" component={ProPage} />

        <Route path="/ai" component={OptiGodsAI} />
        <Route path="/account" component={AccountPage} />
        <Route path="/admin" component={Admin} />
        <Route path="/showcase" component={Showcase} />
        <Route path="/get-code" component={GetCode} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/cancel" component={PaymentCancel} />
        <Route path="/game-detection" component={GameDetectionPage} />
        <Route path="/game-profiles" component={GameProfilesPage} />
        <Route path="/game-profiles/fivem" component={FivemPage} />
        <Route path="/game-profiles/fortnite" component={FortnitePage} />
        <Route path="/game-profiles/call-of-duty" component={CallOfDutyPage} />
        <Route path="/game-profiles/007-first-light" component={Bond007Page} />
        <Route path="/game-profiles/rust" component={RustGamePage} />
        <Route path="/game-profiles/roblox" component={RobloxPage} />
        <Route path="/game-profiles/discord" component={DiscordPage} />
        <Route path="/game-profiles/spotify" component={SpotifyPage} />
        <Route path="/processes" component={ProcessesPage} />
        <Route path="/help" component={HelpPage} />
        <Route path="/support" component={HelpPage} />
        <Route path="/updates" component={UpdatesPage} />
        <Route path="/task-manager" component={TaskManagerPage} />
        <Route path="/fivem-graphics" component={FivemGraphicsPage} />
        <Route path="/graphics-studio" component={FivemGraphicsPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
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
    showLoginSuccess("Discord");
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

function SessionHeartbeat() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    const ping = () => {
      void fetch(apiUrl("/api/session/heartbeat"), {
        method: "POST",
        credentials: "include",
        headers: getNativeAuthHeaders(),
      }).catch(() => {});
    };
    ping();
    const interval = window.setInterval(ping, 20_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated]);
  return null;
}

class ClientErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; supportCode: string | null }> {
  state = { error: null, supportCode: null } as { error: Error | null; supportCode: string | null };

  componentDidCatch(error: Error, info: ErrorInfo) {
    const supportCode = reportClientError(
      new Error(`${error.message}\n${info.componentStack || ""}`),
      "crash",
      "React render error",
    );
    this.setState({ error, supportCode });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="min-h-screen bg-black px-6 py-20 text-zinc-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-zinc-950 p-8 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">Opti Gods error reader</p>
          <h1 className="mt-3 text-2xl font-black">This screen failed safely</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            No Windows tweak was marked successful. Reload the app and retry. The error was recorded for diagnosis.
          </p>
          <p className="mt-5 rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-xs text-amber-300">
            Support code: {this.state.supportCode || "OG-UI-UNKNOWN"}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-500"
          >
            Reload Opti Gods
          </button>
        </div>
      </main>
    );
  }
}

function App() {
  useEffect(() => installGlobalErrorReporting(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthTransitionOverlay />
        <BootSplash />
        <ProCelebration />
        <NativeTokenHandler />
        <NativeCachedTokenHandler />
        <NativeBootstrap />
        <SessionHeartbeat />
        <VisitTracker />
        <FriendUnlockHandler />
        <Toaster />
        <NativeRestoreReadinessBanner />
        <ClientErrorBoundary>
          {/* Must run before AuthGate so old/unsigned desktop builds can still
              reach the mandatory update flow and install the newest release. */}
          <UpdateModal />
          <AuthGate>
            <Router />
            <VersionPin />
          </AuthGate>
        </ClientErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
