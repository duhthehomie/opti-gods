import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useHardwareInfo } from "@/hooks/use-hardware-info";
import { useOsDetection } from "@/hooks/use-os-detection";
import { useProStatus } from "@/lib/pro-status";
import { getAppliedTweakState } from "@/lib/applied-tweak-state";
import { getMissingRecommendationIds } from "@/lib/missing-recommendations";
import { computeSmartRecs, getEligibleSmartRecommendationIds } from "@/lib/smart-recommendations";
import { canRunNvidiaPreset } from "@/lib/nvidia-preset-eligibility";
import { getTweakCompatibility } from "@/lib/tweak-compatibility";
import { applyTweakBatch, NVIDIA_PRESET_ACTION_ID, readNativeTweakRun } from "@/lib/native-tweak-runner";
import { useOptimizationStore } from "@/store/use-optimization-store";
import type { NativeGamingModeStatus } from "@/lib/tauri-bridge";

/**
 * Call of Duty set used by Gaming Mode. CodMMCSS is left out on purpose: the
 * universal Games profile owns those values. CodDisableTelemetry is left out
 * because it force-closes Battle.net helper processes while the game runs.
 */
export const GAMING_MODE_COD_TWEAK_IDS = [
  "CpuCodIFEO", "CodMemPriority", "CodGPUPriority", "CodDirectXQueue", "CodFramePacing",
  "CodTdrDelay", "CodQoSPolicy", "CodDefenderExclusion", "EnableNvidiaMSIPro", NVIDIA_PRESET_ACTION_ID,
] as const;

const COD_EXE = /^(cod\d*(-cod)?|blackops\w*|modernwarfare\w*|mwiii|warzone)\.exe$/i;
export const isCodGame = (exeName: string) => COD_EXE.test(exeName);

const HANDLED_KEY = "optigods_gaming_mode_cod_pid";

export type CodTweakState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "needs_scan" }
  | { kind: "needs_pro" }
  | { kind: "up_to_date"; total: number }
  | { kind: "applying"; count: number }
  | { kind: "error"; message: string };

/**
 * When Gaming Mode is on and Call of Duty is running, check the COD set plus
 * this PC's hardware-matched recommendations and send anything missing to the
 * normal tweak runner (which shows "Tweak run complete"). Runs once per COD
 * launch so returning to the page does not start a second run.
 */
export function useGamingModeCodTweaks(status: NativeGamingModeStatus | null, enabled: boolean): CodTweakState {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const hasPro = useProStatus();
  const isPro = isAuthenticated && hasPro;
  const hw = useHardwareInfo();
  const os = useOsDetection();
  const { tweaks } = useOptimizationStore();
  const [state, setState] = useState<CodTweakState>({ kind: "idle" });
  const busyRef = useRef(false);

  const codGame = enabled && status?.enabled && status.agent_running
    ? status.games.find(game => isCodGame(game.name)) ?? null
    : null;
  const codPid = codGame?.pid ?? null;
  const hardwareReady = !hw.loading && !os.loading;

  useEffect(() => {
    if (codPid == null) {
      if (!busyRef.current) setState({ kind: "idle" });
      return;
    }
    if (!hardwareReady || busyRef.current) return;
    if (!hw.scanned) { setState({ kind: "needs_scan" }); return; }
    if (!isPro) { setState({ kind: "needs_pro" }); return; }
    let handled: string | null = null;
    try { handled = sessionStorage.getItem(HANDLED_KEY); } catch { /* storage unavailable */ }

    busyRef.current = true;
    setState({ kind: "checking" });
    void (async () => {
      try {
        const smartRecs = computeSmartRecs(hw, os);
        const nvidiaPresetEligible = canRunNvidiaPreset({
          native: true,
          pro: isPro,
          hardwareScanned: hw.scanned,
          dedicatedNvidiaGpuCount: hw.gpus.filter(gpu => gpu.vendor === "nvidia" && !gpu.isIntegrated).length,
        });
        const eligible = getEligibleSmartRecommendationIds(
          [...GAMING_MODE_COD_TWEAK_IDS, ...Array.from(smartRecs.ids)],
          id => id === NVIDIA_PRESET_ACTION_ID ? nvidiaPresetEligible : getTweakCompatibility(id).ok,
        );
        const appliedState = await getAppliedTweakState();
        const lastRun = readNativeTweakRun();
        const missing = getMissingRecommendationIds(eligible, {
          native: true,
          stateReady: true,
          appliedState,
          selectedState: tweaks,
          runStatus: lastRun?.status,
          runItems: lastRun?.items,
        });
        if (!missing.length) {
          setState({ kind: "up_to_date", total: eligible.length });
          return;
        }
        if (handled === String(codPid)) {
          // Already sent this COD session; show what is still outstanding.
          setState({ kind: "error", message: `${missing.length} tweaks still not confirmed after the last run. Open Applied Tweaks to see why.` });
          return;
        }
        try { sessionStorage.setItem(HANDLED_KEY, String(codPid)); } catch { /* storage unavailable */ }
        setState({ kind: "applying", count: missing.length });
        toast({
          title: "Call of Duty detected",
          description: `Applying ${missing.length} missing tweaks for Call of Duty and your PC. Registry changes apply next time COD starts; MSI priority needs a restart.`,
        });
        await applyTweakBatch(missing);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({ kind: "error", message });
        toast({ title: "Could not apply Call of Duty tweaks", description: message, variant: "destructive" });
      } finally {
        busyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codPid, hardwareReady, hw.scanned, isPro]);

  return state;
}
