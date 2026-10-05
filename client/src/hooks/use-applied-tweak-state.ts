import { useQuery } from "@tanstack/react-query";
import { getAppliedTweakState } from "@/lib/applied-tweak-state";
import { isNative } from "@/lib/tauri-bridge";
import { useEffect } from "react";
import { readNativeTweakRun } from "@/lib/native-tweak-runner";
import { queryClient } from "@/lib/queryClient";

export const APPLIED_STATE_QUERY_KEY = ["native-applied-tweak-state"] as const;

/** Shared readback for all section controls, cards and tweak rows. */
export function useAppliedTweakState(poll = false) {
  useEffect(() => {
    if (!isNative() || !poll) return;
    const refresh = () => {
      const run = readNativeTweakRun();
      if (run && ["completed", "failed", "stopped"].includes(run.status)) {
        void queryClient.invalidateQueries({ queryKey: APPLIED_STATE_QUERY_KEY });
      }
    };
    window.addEventListener("optigods:native-run-state", refresh);
    return () => window.removeEventListener("optigods:native-run-state", refresh);
  }, [poll]);
  return useQuery({
    queryKey: APPLIED_STATE_QUERY_KEY,
    queryFn: getAppliedTweakState,
    enabled: isNative() && poll,
    staleTime: 10_000,
    refetchInterval: poll ? 15_000 : false,
    refetchOnWindowFocus: poll,
    retry: false,
  });
}
