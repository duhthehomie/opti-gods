// Boot-time integration of the React app with the Tauri native shell.
//
// Called once from App.tsx on mount. In the browser this is a no-op.
// In the desktop binary it:
//   1. Asks Rust for envInfo() so we can show the admin / non-admin banner.
//   2. Starts the ProBalance background loop.
//
// Window visibility is handled entirely in Rust (lib.rs on_page_load).
// JS does NOT call any show/hide window commands.
//
// Every Rust call is wrapped in withTimeout() — a hung IPC command can
// never freeze the UI. The app is fully usable without any of these calls.

import {
  envInfo,
  startProBalance,
  showMainWindow,
  scanHardware,
  startupRestoreCheckpoint,
  isNative,
  type NativeEnvInfo,
  type NativeStartupRestoreResult,
} from "@/lib/tauri-bridge";
import { getScannedInfo, saveScannedInfo } from "@/hooks/use-hardware-info";
import { nativeScanToScannedInfo, uploadValidatedHardwareScan } from "@/lib/hardware-scan-sync";
import { NATIVE_RESTORE_CREATED_KEY, setNativeRestoreReadiness } from "@/lib/native-readiness";

export interface NativeBootResult {
  native: boolean;
  env: NativeEnvInfo | null;
}

/** Race a promise against a timeout. Resolves with null on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[native] ${label} timed out after ${ms}ms — continuing`);
        resolve(null);
      }, ms),
    ),
  ]);
}

let _bootPromise: Promise<NativeBootResult> | null = null;

export function bootstrapNative(): Promise<NativeBootResult> {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    if (!isNative()) {
      return { native: false, env: null };
    }
    // Step 1 — Show the window FIRST, before any other work.
    // The window starts with visible:false so WebView2 initialises hidden
    // (avoiding the Win32 "Not Responding" freeze the user would otherwise
    // see). By the time JS executes, WebView2 is fully ready, so calling
    // showMainWindow() here makes the window appear instantly responsive.
    try {
      await withTimeout(showMainWindow(), 3_000, "showMainWindow");
    } catch (err) {
      console.warn("[native] showMainWindow failed", err);
    }

    // Create the safety checkpoint after the window is visible. This runs in
    // the background so a Windows restore/API problem never makes launch look
    // broken. Native mutation remains blocked by the Rust backstop until this
    // same checkpoint is verified.
    const checking: NativeStartupRestoreResult = {
      ok: false,
      status: "checking",
      repair_attempted: false,
      restore_point: null,
      message: "Preparing the Windows safety checkpoint…",
      recovery: "You can browse and scan while this finishes.",
    };
    setNativeRestoreReadiness(checking);
    const restoreCheck = startupRestoreCheckpoint()
      .then((result) => {
        setNativeRestoreReadiness(result);
        if (result.ok && result.restore_point?.sequence_number) {
          try {
            sessionStorage.setItem(
              NATIVE_RESTORE_CREATED_KEY,
              String(result.restore_point.sequence_number),
            );
          } catch {
            // Rust remains the authoritative safety backstop if storage is unavailable.
          }
        }
        return result;
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : "The safety checkpoint could not be checked.";
        const result: NativeStartupRestoreResult = {
          ok: false,
          status: "creation_failed",
          repair_attempted: false,
          restore_point: null,
          message: `System Protection could not be verified: ${detail}`,
          recovery: "Native tweaks are paused. Press Retry after checking System Protection for drive C:.",
        };
        setNativeRestoreReadiness(result);
        return result;
      });

    // Step 2 — gather environment information (non-blocking).
    let env: NativeEnvInfo | null = null;
    try {
      env = await withTimeout(envInfo(), 5_000, "envInfo");
    } catch (err) {
      console.warn("[native] envInfo failed", err);
    }

    const restoreResult = await withTimeout(restoreCheck, 95_000, "startupRestoreCheckpoint");
    if (restoreResult?.ok) {
      try {
        await withTimeout(startProBalance(), 5_000, "startProBalance");
      } catch (err) {
        console.warn("[native] startProBalance failed", err);
      }
    } else {
      console.warn("[native] ProBalance held until the safety checkpoint is verified");
    }

    // Step 3 — refresh the full hardware profile silently on every desktop
    // launch. The optimizer needs the current GPU/CPU/RAM/chassis data before
    // it chooses a game preset; stale localStorage must never be the source of
    // truth after a hardware swap or driver upgrade.
    try {
      const hw = await withTimeout(scanHardware(), 15_000, "autoScan");
      if (hw) {
        saveScannedInfo(nativeScanToScannedInfo(hw));
        // Upload is best-effort here: the local profile must work before login,
        // while an existing native session lets the admin see this PC
        // immediately without requiring a second manual scan button.
        void uploadValidatedHardwareScan(hw).catch(error => {
          console.info("[native] Hardware upload deferred until sign-in:", error);
        });
        console.info("[native] Full auto-scan complete — hardware profile refreshed");
      }
    } catch (err) {
      // Keep an existing profile if Windows WMI is temporarily busy. The next
      // explicit scan/optimization action retries through the validated path.
      console.warn("[native] Auto-scan failed (non-fatal):", err, {
        cachedProfile: Boolean(getScannedInfo()),
      });
    }

    return { native: true, env };
  })();
  return _bootPromise;
}

/** Clear the cached boot promise so the visible Retry action can re-check Windows. */
export function retryNativeBootstrap(): Promise<NativeBootResult> {
  _bootPromise = null;
  return bootstrapNative();
}
