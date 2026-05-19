// Tauri ↔ React bridge.
//
// The exact same React bundle ships as both the public web app and the
// native Opti Gods installer. We avoid forking the codebase by routing every
// "OS-level" action (apply tweak, scan hardware, Discord OAuth, restore
// point, etc.) through this module. When running inside Tauri we call into
// Rust via invoke(); when running in the browser we fall back to the
// existing flows (download .ps1, fetch /api/auth/discord/…).
//
// Detection uses the global `__TAURI_INTERNALS__` that Tauri 2 injects on
// boot. We deliberately do NOT statically import @tauri-apps/api so that
// `npm run build` for the web bundle doesn't try to resolve it.

export interface NativeTweakResult {
  ok: boolean;
  id: string;
  message: string;
  undo_token: string | null;
  requires_reboot: boolean;
  via_powershell: boolean;
}

export interface NativeHardwareScan {
  cpu: string;
  gpu: string;
  vram_mb: number | null;
  ram_gb: number | null;
  ram_mhz: number | null;
  motherboard: string | null;
  chassis: string | null;
  cooling_type: string | null;
  refresh_hz: number | null;
  nic_vendor: string | null;
  anticheats: string[];
}

export interface NativeRestorePoint {
  sequence_number: number;
  label: string;
  created_at: string;
}

export interface NativeDiscordSession {
  user_id: string;
  username: string;
  expires_at_unix: number;
}

export interface NativeEnvInfo {
  native: boolean;
  platform: string;
  app_version: string;
  is_admin: boolean;
}

// ─── environment detection ──────────────────────────────────────────────────

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri 2 exposes __TAURI_INTERNALS__; Tauri 1 exposed __TAURI__.
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isNative()) {
    throw new Error(`Tauri invoke('${cmd}') called outside the native shell.`);
  }
  // Tauri 2 injects __TAURI_INTERNALS__.invoke directly on window — using it
  // avoids needing @tauri-apps/api as an npm dependency in the web bundle.
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: <R>(c: string, a?: unknown) => Promise<R> };
  };
  const internals = w.__TAURI_INTERNALS__;
  if (!internals?.invoke) {
    throw new Error("Tauri internals not available — is this the native shell?");
  }
  return internals.invoke<T>(cmd, args);
}

// ─── splash / boot ──────────────────────────────────────────────────────────

export async function finishSplash(): Promise<void> {
  if (!isNative()) return;
  try { await invoke<void>("finish_splash"); } catch { /* noop */ }
}

/**
 * Show the main window.
 *
 * The window starts with visible:false in tauri.conf.json so that the
 * WebView2 initialisation freeze (which blocks the Win32 message pump for
 * 2-5 s on some machines) happens invisibly.  We call this as the very
 * first thing in native-bootstrap.ts — by the time JS executes, WebView2
 * is already fully initialised and the window appears instantly responsive.
 */
export async function showMainWindow(): Promise<void> {
  if (!isNative()) return;
  // Use the custom `finish_splash` Rust command — it's registered directly in
  // the invoke_handler so there's no plugin namespace uncertainty. It calls
  // window.show() + set_focus() straight from Rust and is guaranteed to work.
  try {
    await invoke<void>("finish_splash");
  } catch (err) {
    console.warn("[native] showMainWindow via finish_splash failed", err);
  }
}

export async function envInfo(): Promise<NativeEnvInfo> {
  if (!isNative()) {
    return { native: false, platform: "web", app_version: "web", is_admin: false };
  }
  return invoke<NativeEnvInfo>("env_info");
}

// ─── tweak engine ───────────────────────────────────────────────────────────

// SECURITY: The renderer can no longer pass a PowerShell snippet — the
// trusted ID→script map lives entirely in Rust (`trusted_ps_snippet`).
// Anything not in the native registry or that map returns an explicit
// "unknown tweak id" error.
export async function applyTweak(id: string): Promise<NativeTweakResult> {
  if (!isNative()) {
    return webFallbackTweak(id, "apply");
  }
  return invoke<NativeTweakResult>("apply_tweak", { args: { id } });
}

export async function undoTweak(
  id: string,
  undoToken?: string | null,
): Promise<NativeTweakResult> {
  if (!isNative()) {
    return webFallbackTweak(id, "undo");
  }
  return invoke<NativeTweakResult>("undo_tweak", {
    args: { id, undo_token: undoToken ?? null },
  });
}

// On the web, "apply" really means "queue the tweak into the PowerShell
// script the user will download" — the existing flow on the dashboard
// already handles that, so this stub just confirms the queue add.
function webFallbackTweak(id: string, kind: "apply" | "undo"): NativeTweakResult {
  return {
    ok: true,
    id,
    message: `Queued ${kind} for the next .ps1 download (web mode).`,
    undo_token: null,
    requires_reboot: false,
    via_powershell: true,
  };
}

// ─── hardware scan ──────────────────────────────────────────────────────────

export async function scanHardware(): Promise<NativeHardwareScan | null> {
  if (!isNative()) return null;
  return invoke<NativeHardwareScan>("scan_hardware");
}

// ─── system restore ─────────────────────────────────────────────────────────

export async function createRestorePoint(label: string): Promise<NativeRestorePoint | null> {
  if (!isNative()) return null;
  return invoke<NativeRestorePoint>("create_restore_point", { label });
}

export async function listRestorePoints(): Promise<NativeRestorePoint[]> {
  if (!isNative()) return [];
  return invoke<NativeRestorePoint[]>("list_restore_points");
}

export async function restoreToPoint(sequenceNumber: number): Promise<void> {
  if (!isNative()) return;
  // Rust command param is `sequence_number` — pass snake_case explicitly.
  await invoke<void>("restore_to_point", { sequence_number: sequenceNumber });
}

// ─── process lasso ──────────────────────────────────────────────────────────

export async function startProBalance(): Promise<void> {
  if (!isNative()) return;
  await invoke<void>("start_pro_balance");
}

export async function stopProBalance(): Promise<void> {
  if (!isNative()) return;
  await invoke<void>("stop_pro_balance");
}

export interface ProBalanceStatus {
  active: boolean;
  current_game: string | null;
  processes_throttled: number;
}

export async function proBalanceStatus(): Promise<ProBalanceStatus> {
  if (!isNative()) {
    return { active: false, current_game: null, processes_throttled: 0 };
  }
  return invoke<ProBalanceStatus>("pro_balance_status");
}

// ─── Discord OAuth ──────────────────────────────────────────────────────────

export async function discordLogin(clientId: string): Promise<NativeDiscordSession> {
  if (!isNative()) {
    // Web flow — let the existing /api/auth/discord page handle it.
    window.location.href = "/api/auth/discord/start";
    return new Promise(() => { /* navigation */ });
  }
  // Rust command param is `client_id` — pass snake_case explicitly.
  // Note: exchange endpoint is pinned in Rust (commands::discord::EXCHANGE_URL)
  // so a compromised renderer can't redirect the OAuth code to an attacker host.
  return invoke<NativeDiscordSession>("discord_login", { client_id: clientId });
}

export async function discordLogout(): Promise<void> {
  if (!isNative()) {
    window.location.href = "/api/auth/discord/logout";
    return;
  }
  await invoke<void>("discord_logout");
}

export async function discordCachedToken(): Promise<NativeDiscordSession | null> {
  if (!isNative()) return null;
  return invoke<NativeDiscordSession | null>("discord_cached_token");
}

// ─── updater ────────────────────────────────────────────────────────────────

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string | null;
  notes: string | null;
  error: string | null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isNative()) return null;
  return invoke<UpdateInfo>("check_for_update");
}
