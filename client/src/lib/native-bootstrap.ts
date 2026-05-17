// Boot-time integration of the React app with the Tauri native shell.
//
// Called once from App.tsx — when running inside the desktop binary this:
//   1. Asks Rust for envInfo() so we can show the admin / non-admin banner.
//   2. Starts the ProBalance background loop (Process Lasso replacement).
//   3. Closes the splash window and reveals the main window.
//
// In the browser every call no-ops via the bridge's isNative() guard.

import {
  envInfo,
  finishSplash,
  startProBalance,
  isNative,
  type NativeEnvInfo,
} from "@/lib/tauri-bridge";

export interface NativeBootResult {
  native: boolean;
  env: NativeEnvInfo | null;
}

let _bootPromise: Promise<NativeBootResult> | null = null;

export function bootstrapNative(): Promise<NativeBootResult> {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    if (!isNative()) {
      return { native: false, env: null };
    }
    let env: NativeEnvInfo | null = null;
    try {
      env = await envInfo();
    } catch (err) {
      console.warn("[native] envInfo failed", err);
    }
    // Kick off ProBalance — Rust's worker is already polling; this just
    // flips the AtomicBool that gates the priority overrides.
    try {
      await startProBalance();
    } catch (err) {
      console.warn("[native] startProBalance failed", err);
    }
    // Hand control to the main window. Wait a tick so React has flushed.
    await new Promise((r) => setTimeout(r, 250));
    try {
      await finishSplash();
    } catch (err) {
      console.warn("[native] finishSplash failed", err);
    }
    return { native: true, env };
  })();
  return _bootPromise;
}
