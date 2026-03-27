import { useState, useEffect } from "react";

export interface HardwareInfo {
  cpuCores: number;
  cpuLabel: string;
  ramGB: number;
  ramLabel: string;
  ramNote: string;
  gpuName: string;
  gpuVendor: string;
  isNvidia: boolean;
  isAMD: boolean;
  isIntel: boolean;
  resolution: string;
  loading: boolean;
  scanned: boolean;
}

export interface ScannedSysInfo {
  GPU?: string;
  CPU?: string;
  Cores?: number;
  Threads?: number;
  RAM_GB?: number;
}

const SCAN_KEY = "optigods-sysinfo";

export function getScannedInfo(): ScannedSysInfo | null {
  try {
    const raw = localStorage.getItem(SCAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScannedSysInfo;
  } catch {
    return null;
  }
}

export function saveScannedInfo(info: ScannedSysInfo) {
  localStorage.setItem(SCAN_KEY, JSON.stringify(info));
}

export function clearScannedInfo() {
  localStorage.removeItem(SCAN_KEY);
}

function detectGPUViaWebGL(): { gpuName: string; gpuVendor: string } {
  let gpuName = "";
  let gpuVendor = "";

  try {
    const canvas = document.createElement("canvas");
    // Try webgl2 first, then webgl
    const gl = (
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    ) as WebGLRenderingContext | null;

    if (!gl) return { gpuName: "", gpuVendor: "" };

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    let rawRenderer = "";
    let rawVendor = "";

    if (ext) {
      rawRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
      rawVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "";
    } else {
      // Fallback: plain RENDERER — less detailed but better than "Unknown"
      rawRenderer = gl.getParameter(gl.RENDERER) || "";
      rawVendor = gl.getParameter(gl.VENDOR) || "";
    }

    gpuVendor = rawVendor;

    if (rawRenderer) {
      // ANGLE format: "ANGLE (Vendor, Renderer Name Direct3D11 vs_5_0 ps_5_0, D3D11)"
      const angleMatch = rawRenderer.match(
        /ANGLE\s*\(\s*([^,]+),\s*(.+?)(?:\s+Direct3D|\s+OpenGL|\s+Vulkan|,\s*D3D|$)/i
      );
      if (angleMatch) {
        gpuName = angleMatch[2]
          .replace(/\s*Direct3D\d+.*$/gi, "")
          .replace(/\s*OpenGL\s*\d.*$/gi, "")
          .replace(/\s*Vulkan.*$/gi, "")
          .replace(/\s*\(0x[0-9a-f]+\)/gi, "")
          .trim();
        if (!gpuVendor) gpuVendor = angleMatch[1].trim();
      } else {
        // Firefox / Mesa / plain format
        gpuName = rawRenderer
          .replace(/\/PCIe\/.*$/gi, "")
          .replace(/\/SSE\d*/gi, "")
          .replace(/\s*Direct3D\d+.*$/gi, "")
          .replace(/\s*OpenGL\s*\d.*$/gi, "")
          .replace(/\s*Vulkan.*$/gi, "")
          .replace(/\s*\(0x[0-9a-f]+\)/gi, "")
          .trim();
      }
    }
  } catch {}

  return { gpuName: gpuName || "", gpuVendor };
}

export function useHardwareInfo(): HardwareInfo {
  const [info, setInfo] = useState<HardwareInfo>({
    cpuCores: 0,
    cpuLabel: "Detecting...",
    ramGB: 0,
    ramLabel: "Detecting...",
    ramNote: "",
    gpuName: "Detecting...",
    gpuVendor: "",
    isNvidia: false,
    isAMD: false,
    isIntel: false,
    resolution: "",
    loading: true,
    scanned: false,
  });

  useEffect(() => {
    const scanned = getScannedInfo();

    // CPU — navigator.hardwareConcurrency is the real logical thread count
    const nativeCores = navigator.hardwareConcurrency || 0;
    const scannedThreads = scanned?.Threads ?? 0;
    const scannedCores = scanned?.Cores ?? 0;

    const cpuCores = scannedThreads || nativeCores;
    const physicalCores = scannedCores || (cpuCores > 0 ? Math.max(1, Math.ceil(cpuCores / 2)) : 0);
    const cpuLabel = scanned?.CPU
      ? `${scanned.CPU.trim()} (${cpuCores}T / ${physicalCores}C)`
      : cpuCores > 0
      ? `${cpuCores} Threads (${physicalCores} cores)`
      : "Unknown";

    // RAM
    const rawRamGB: number = (navigator as any).deviceMemory || 0;
    let ramGB = rawRamGB;
    let ramLabel = "Unknown";
    let ramNote = "Browser API unavailable";

    if (scanned?.RAM_GB && scanned.RAM_GB > 0) {
      ramGB = scanned.RAM_GB;
      ramLabel = `${scanned.RAM_GB} GB`;
      ramNote = "Detected via hardware scan";
    } else if (rawRamGB > 0) {
      if (rawRamGB >= 8) {
        ramLabel = "8+ GB";
        ramNote = "≥8 GB detected (actual may be 16/32/64 GB — run hardware scan for exact value)";
        ramGB = 8;
      } else {
        ramLabel = `≥${rawRamGB} GB`;
        ramNote = `Browser reports ≥${rawRamGB} GB (run hardware scan for exact value)`;
      }
    }

    // Resolution — use CSS logical pixels (matches what Windows Display Settings shows)
    // Physical pixel multiplication causes inflated values on high-DPI/scaled displays
    const resolution = `${screen.width}×${screen.height}`;

    // GPU — prioritize PS1 scan result
    let gpuName = scanned?.GPU?.trim() || "";
    let gpuVendor = "";

    if (!gpuName) {
      const webglResult = detectGPUViaWebGL();
      gpuName = webglResult.gpuName;
      gpuVendor = webglResult.gpuVendor;
    }

    if (!gpuName) gpuName = "Unknown GPU";

    const n = gpuName.toLowerCase();
    const v = gpuVendor.toLowerCase();
    const isNvidia = n.includes("nvidia") || n.includes("geforce") || n.includes("quadro") || v.includes("nvidia");
    const isAMD = n.includes("amd") || n.includes("radeon") || n.includes("rx ") || v.includes("amd");
    const isIntel = n.includes("intel") || n.includes("uhd") || n.includes("iris") || v.includes("intel");

    setInfo({
      cpuCores,
      cpuLabel,
      ramGB,
      ramLabel,
      ramNote,
      gpuName,
      gpuVendor,
      isNvidia,
      isAMD,
      isIntel,
      resolution,
      loading: false,
      scanned: !!scanned,
    });
  }, []);

  return info;
}
