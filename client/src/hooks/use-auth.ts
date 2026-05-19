import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export type AuthUser = {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

export type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

export function useAuth(): AuthState {
  // placeholderData ensures isLoading is never true on first render.
  // The UI shows "not authenticated" immediately and updates silently
  // once the real /api/me response arrives. This eliminates any
  // black loading-screen phase in both web and native builds.
  const { data, isLoading } = useQuery<{ user: AuthUser | null }>({
    queryKey: ["/api/me"],
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    placeholderData: { user: null },
  });
  const user = data?.user ?? null;
  return { user, isLoading, isAuthenticated: !!user };
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      // 1. Tell the server to destroy the session cookie.
      await apiRequest("POST", "/api/logout").catch(() => {});
      // 2. In native mode, also clear the OS keyring and localStorage token
      //    so the cached-session handler doesn't restore the old session.
      try {
        const { isNative, discordLogout } = await import("@/lib/tauri-bridge");
        if (isNative()) {
          await discordLogout().catch(() => {});
          localStorage.removeItem("optigods_native_auth_token"); // NATIVE_TOKEN_KEY
          localStorage.removeItem("og_guest_mode"); // GUEST_MODE_KEY
        }
      } catch {
        // Browser build — tauri-bridge just no-ops anyway
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/me"], { user: null });
      queryClient.invalidateQueries({ queryKey: ["/api/pro/status"] });
      window.location.href = "/";
    },
  });
}

export function loginWithDiscord(returnTo?: string): void {
  const path = returnTo && returnTo.startsWith("/") ? returnTo : window.location.pathname + window.location.search;
  const url = `/api/auth/discord/login?returnTo=${encodeURIComponent(path)}`;
  window.location.href = url;
}

// ── Version + auto-update info ───────────────────────────────────────────────
export type VersionInfo = {
  currentVersion: string;
  latestVersion: string;
  updaterCmdUrl: string | null;
  updatePageUrl: string | null;
};

export function useVersionInfo() {
  return useQuery<VersionInfo>({
    queryKey: ["/api/version"],
    staleTime: 5 * 60_000,
  });
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(n => parseInt(n, 10) || 0);
  const pb = b.split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}
