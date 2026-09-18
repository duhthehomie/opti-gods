import { apiUrl } from "@/lib/api-base";
import { saveScannedInfo, type ScannedSysInfo } from "@/hooks/use-hardware-info";
import { getNativeAuthHeaders } from "@/lib/queryClient";
import { scanHardware, type NativeHardwareScan } from "@/lib/tauri-bridge";

export function nativeScanToScannedInfo(data: NativeHardwareScan): ScannedSysInfo {
  return {
    GPU: data.gpu || undefined,
    CPU: data.cpu || undefined,
    Cores: data.cpu_cores ?? undefined,
    Threads: data.cpu_threads ?? undefined,
    RAM_GB: data.ram_gb ?? undefined,
    RAM_MHz: data.ram_mhz ?? undefined,
    VRAM_MB: data.vram_mb ?? undefined,
    Motherboard: data.motherboard ?? undefined,
    Chassis: data.chassis ?? undefined,
    CoolingType: data.cooling_type ?? undefined,
    RefreshHz: data.refresh_hz ?? undefined,
    NicVendor: data.nic_vendor ?? undefined,
    Anticheats: data.anticheats,
    SystemModel: data.system_model ?? undefined,
    OsName: data.os_name ?? undefined,
    OsBuild: data.os_build ?? undefined,
    IsLaptop: data.is_laptop ?? undefined,
  };
}

export async function uploadValidatedHardwareScan(data: NativeHardwareScan): Promise<string> {
  if (!data.cpu?.trim() || !data.gpu?.trim() || !data.ram_gb || data.ram_gb < 1) {
    throw new Error("OG-SCAN-003 · Windows returned an incomplete hardware scan.");
  }
  const response = await fetch(apiUrl("/api/hardware/scan"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getNativeAuthHeaders() },
    credentials: "include",
    body: JSON.stringify({
      cpu: data.cpu,
      gpu: data.gpu,
      vramMb: data.vram_mb ?? undefined,
      ramGb: data.ram_gb,
      ramMhz: data.ram_mhz ?? undefined,
      motherboard: data.motherboard ?? undefined,
      chassis: data.chassis ?? undefined,
      coolingType: data.cooling_type ?? undefined,
      refreshHz: data.refresh_hz ?? undefined,
      nicVendor: data.nic_vendor ?? undefined,
      anticheats: data.anticheats ?? [],
      cpuCores: data.cpu_cores ?? undefined,
      cpuThreads: data.cpu_threads ?? undefined,
      osName: data.os_name ?? undefined,
      osBuild: data.os_build ?? undefined,
      systemModel: data.system_model ?? undefined,
      isLaptop: data.is_laptop ?? undefined,
      sessionToken: localStorage.getItem("optigods_session_v2") ?? undefined,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.rigHash !== "string") {
    throw new Error(`${body.code || `OG-HTTP-${response.status}`} · ${body.error || "The server could not validate this hardware scan."}`);
  }
  saveScannedInfo(nativeScanToScannedInfo(data));
  return body.rigHash;
}

export async function scanAndUploadValidatedHardware(): Promise<NativeHardwareScan> {
  const data = await scanHardware();
  if (!data) throw new Error("Native hardware scan returned no data.");
  await uploadValidatedHardwareScan(data);
  return data;
}
