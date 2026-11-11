import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-base";
import { getNativeSessionHeaders } from "@/lib/queryClient";
import { isNative } from "@/lib/tauri-bridge";
import { useAuth } from "@/hooks/use-auth";

/**
 * Gaming Mode early access in AI Optimize. The server decides: the admin key
 * or one of the invited Discord accounts. Fails closed on any error.
 */
export function useGamingModeAccess(): boolean {
  const native = isNative();
  const { isAuthenticated, user } = useAuth();
  const { data } = useQuery<{ allowed: boolean }>({
    queryKey: ["/api/gaming-mode/access", user?.discordId ?? null],
    enabled: native && isAuthenticated,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/gaming-mode/access"), { headers: getNativeSessionHeaders() });
      if (!res.ok) return { allowed: false };
      const body = await res.json() as { allowed?: unknown };
      return { allowed: body.allowed === true };
    },
  });
  return native && isAuthenticated && data?.allowed === true;
}
