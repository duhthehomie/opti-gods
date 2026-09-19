import { apiUrl } from "@/lib/api-base";
import { getNativeAuthHeaders, PRO_SESSION_KEY } from "@/lib/queryClient";
import { isNative } from "@/lib/tauri-bridge";
import { scanAndUploadValidatedHardware } from "@/lib/hardware-scan-sync";

type PresetAuthorization = {
  pro: boolean;
  authorizedIds: string[];
  activeIds?: string[];
  remaining: number | null;
};

async function requestHardwarePreset(): Promise<{ response: Response; body: any }> {
  const response = await fetch(apiUrl("/api/performance-allowance/authorize"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
    credentials: "include",
    body: JSON.stringify({
      mode: "best",
      preview: true,
      sessionToken: localStorage.getItem(PRO_SESSION_KEY) ?? undefined,
      idempotencyKey: crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, ""),
    }),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

export async function authorizeHardwarePreset(): Promise<PresetAuthorization> {
  let result = await requestHardwarePreset();
  const scanCanBeRepaired = ["OG-SCAN-001", "OG-SCAN-002", "OG-SCAN-003"].includes(result.body?.code);
  if (!result.response.ok && scanCanBeRepaired && isNative()) {
    await scanAndUploadValidatedHardware();
    result = await requestHardwarePreset();
  }
  if (!result.response.ok || !Array.isArray(result.body?.authorizedIds)) {
    throw new Error(`${result.body?.code || `OG-HTTP-${result.response.status}`} · ${result.body?.error || "A validated hardware scan is required."}`);
  }
  return result.body as PresetAuthorization;
}
