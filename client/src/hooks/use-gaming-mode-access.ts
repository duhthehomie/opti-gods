import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-base";
import { getNativeSessionHeaders } from "@/lib/queryClient";
import { disableGamingMode, gamingModeStatus, isNative } from "@/lib/tauri-bridge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type AccessAnswer = { allowed: boolean; confirmedByServer: boolean };

/**
 * Gaming Mode early access in AI Optimize. The server decides: the admin key
 * or an account unlocked in the admin panel. Fails closed on any error.
 * Re-checked every few seconds so an unlock or removal shows up right away.
 * When the server confirms access was removed, Gaming Mode is switched off
 * so its background agent doesn't keep running without a visible switch.
 */
export function useGamingModeAccess(): boolean {
  const native = isNative();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const { data } = useQuery<AccessAnswer>({
    queryKey: ["/api/gaming-mode/access", user?.discordId ?? null],
    enabled: native && isAuthenticated,
    staleTime: 0,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/gaming-mode/access"), { headers: getNativeSessionHeaders() });
      if (!res.ok) return { allowed: false, confirmedByServer: false };
      const body = await res.json() as { allowed?: unknown };
      return { allowed: body.allowed === true, confirmedByServer: true };
    },
  });
  const allowed = native && isAuthenticated && data?.allowed === true;

  const wasAllowedRef = useRef(false);
  useEffect(() => {
    if (allowed) { wasAllowedRef.current = true; return; }
    if (!wasAllowedRef.current || !data?.confirmedByServer) return;
    wasAllowedRef.current = false;
    void (async () => {
      try {
        const status = await gamingModeStatus();
        if (!status?.enabled) return;
        await disableGamingMode();
        toast({ title: "Gaming Mode turned off", description: "Gaming Mode access was removed from this account, so it was switched off and priorities were restored." });
      } catch (error) {
        toast({ title: "Gaming Mode could not be turned off", description: String(error), variant: "destructive" });
      }
    })();
  }, [allowed, data?.confirmedByServer, toast]);

  return allowed;
}
