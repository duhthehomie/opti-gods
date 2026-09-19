import { apiUrl } from "@/lib/api-base";
import { isNative } from "@/lib/tauri-bridge";
import { APP_VERSION } from "@/generated/version";

type ErrorKind = "crash" | "other";

let installed = false;
const reportedFingerprints = new Set<string>();

function sessionId(): string {
  try {
    const key = "optigods-error-session";
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return "ephemeral";
  }
}

function scrub(value: unknown, max = 1200): string {
  return String(value || "Unknown client error")
    .replace(/Bearer\s+[A-Za-z0-9._-]{12,}/gi, "Bearer [REDACTED]")
    .replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/https?:\/\/[^\s]+/gi, "[URL]")
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function fingerprint(message: string, stack?: string): string {
  return `${message}|${(stack || "").slice(0, 240)}`;
}

export function reportClientError(
  error: unknown,
  kind: ErrorKind = "crash",
  context?: string,
): string {
  const source = error instanceof Error ? error : new Error(String(error));
  const message = scrub(context ? `${context}: ${source.message}` : source.message);
  const stack = scrub(source.stack, 1600);
  const key = fingerprint(message, stack);
  const supportCode = `OG-UI-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  if (reportedFingerprints.has(key)) return supportCode;
  reportedFingerprints.add(key);

  const systemInfo = {
    supportCode,
    version: APP_VERSION,
    native: isNative(),
    path: window.location.pathname,
    online: navigator.onLine,
    userAgent: navigator.userAgent.slice(0, 240),
    stack,
  };
  void fetch(apiUrl("/api/reports"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: kind,
      description: `${supportCode} · ${message}`,
      systemInfo,
      sessionId: sessionId(),
    }),
    keepalive: true,
  }).catch(() => {});
  console.error(`[${supportCode}] ${message}`, source);
  return supportCode;
}

export function installGlobalErrorReporting(): () => void {
  if (installed) return () => {};
  installed = true;
  const onError = (event: ErrorEvent) => {
    reportClientError(event.error || event.message, "crash", "window error");
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, "crash", "unhandled promise rejection");
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}