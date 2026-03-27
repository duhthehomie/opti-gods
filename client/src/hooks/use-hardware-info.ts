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
  // GPU tier / generation
  nvidiaIsLowEnd: boolean;    // GTX 10xx/16xx (Pascal/Turing) — limited VRAM
  nvidiaIsRTX: boolean;       // RTX 20xx/30xx/40xx
  isAmdGpu: boolean;          // AMD discrete GPU (RX 5xx / 6xx / 7xx series)
  isAmdApu: boolean;          // AMD APU / Vega iGPU
  // CPU brand
  cpuBrand: "amd" | "intel" | "unknown";
  isRyzen: boolean;           // AMD Ryzen (any gen)
  isIntelCore: boolean;       // Intel Core ix
  cpuGeneration: number;      // best-effort gen (0 = unknown)
  // System type
  isLaptop: boolean;          // detected via battery API
  // Other
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
      rawRenderer = gl.getParameter(gl.RENDERER) || "";
      rawVendor = gl.getParameter(gl.VENDOR) || "";
    }

    gpuVendor = rawVendor;

    if (rawRenderer) {
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

/** Detect NVIDIA GPU generation from model name */
function detectNvidiaGen(gpuName: string): { nvidiaIsLowEnd: boolean; nvidiaIsRTX: boolean } {
  const n = gpuName.toLowerCase();
  // RTX series = high end with hardware ray tracing
  const nvidiaIsRTX = /rtx\s*\d/.test(n) || /\b(2060|2070|2080|3060|3070|3080|3090|4060|4070|4080|4090)\b/.test(n);
  // GTX series = low end (Pascal GTX 10xx, Turing GTX 16xx)
  const nvidiaIsLowEnd = /gtx\s*\d/.test(n) || /\b(1030|1050|1060|1650|1660|1070|1080|980|970|960)\b/.test(n);
  return { nvidiaIsLowEnd: nvidiaIsLowEnd && !nvidiaIsRTX, nvidiaIsRTX };
}

/** Detect CPU brand and generation from scanned CPU name */
function detectCpuInfo(cpuName: string): {
  cpuBrand: "amd" | "intel" | "unknown";
  isRyzen: boolean;
  isIntelCore: boolean;
  cpuGeneration: number;
} {
  const n = cpuName.toLowerCase();
  const isRyzen = /ryzen/.test(n);
  const isIntelCore = /intel.*core|core.*i[3579]/.test(n);
  const isAMDCpu = isRyzen || /amd/.test(n);
  const isIntelCpu = isIntelCore || /intel/.test(n);
  const cpuBrand: "amd" | "intel" | "unknown" = isAMDCpu ? "amd" : isIntelCpu ? "intel" : "unknown";

  // Try to extract CPU generation
  let cpuGeneration = 0;
  // Ryzen 3 / 5 / 7 / 9 XXXX — first digit(s) of 4-digit number = gen
  // Ryzen 5 3500 → gen 3, Ryzen 5 5600X → gen 5, Ryzen 7 7800X3D → gen 7
  if (isRyzen) {
    const ryzenMatch = n.match(/ryzen\s*\d+\s+(\d)(\d{3})/);
    if (ryzenMatch) cpuGeneration = parseInt(ryzenMatch[1]);
  }
  // Intel: Core i5-12600K → 12th gen (first 1-2 digits of model number)
  if (isIntelCore) {
    const intelMatch = n.match(/i[3579]-(\d{4,5})/);
    if (intelMatch) {
      const model = intelMatch[1];
      cpuGeneration = model.length === 5 ? parseInt(model.substring(0, 2)) : parseInt(model.substring(0, 1));
    }
  }

  return { cpuBrand, isRyzen, isIntelCore, cpuGeneration };
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
    nvidiaIsLowEnd: false,
    nvidiaIsRTX: false,
    isAmdGpu: false,
    isAmdApu: false,
    cpuBrand: "unknown",
    isRyzen: false,
    isIntelCore: false,
    cpuGeneration: 0,
    isLaptop: false,
    resolution: "",
    loading: true,
    scanned: false,
  });

  useEffect(() => {
    const scanned = getScannedInfo();

    // CPU
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

    // CPU brand detection
    const cpuInfo = detectCpuInfo(scanned?.CPU || "");

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

    // Resolution
    const resolution = `${screen.width}×${screen.height}`;

    // GPU
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
    const isNvidia = n.includes("nvidia") || n.includes("geforce") || n.includes("quadro") || n.includes("gtx") || n.includes("rtx") || v.includes("nvidia");
    const isAMD = n.includes("amd") || n.includes("radeon") || n.includes("rx ") || v.includes("amd");
    const isIntel = n.includes("intel") || n.includes("uhd") || n.includes("iris") || v.includes("intel");

    // GPU detail classification
    const { nvidiaIsLowEnd, nvidiaIsRTX } = detectNvidiaGen(gpuName);
    // AMD discrete = RX series / dedicated GPU (not integrated vega)
    const isAmdGpu = isAMD && (/\brx\s*\d|radeon\s*(rx|vii|pro)|r[579]\s*\d{3}/i.test(gpuName));
    // AMD APU / iGPU = Vega 8, Radeon Graphics (integrated), etc.
    const isAmdApu = isAMD && !isAmdGpu && /vega|radeon graphics|apu|integrated/i.test(gpuName);

    // Laptop detection — Battery API
    let isLaptop = false;
    if ("getBattery" in navigator) {
      // Fire and forget — sets isLaptop asynchronously; component re-renders
      (navigator as any).getBattery().then((battery: any) => {
        if (battery && (battery.level < 1.0 || !battery.charging || battery.dischargingTime !== Infinity)) {
          setInfo(prev => ({ ...prev, isLaptop: true }));
        }
      }).catch(() => {});
    }

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
      nvidiaIsLowEnd,
      nvidiaIsRTX,
      isAmdGpu,
      isAmdApu,
      cpuBrand: cpuInfo.cpuBrand,
      isRyzen: cpuInfo.isRyzen,
      isIntelCore: cpuInfo.isIntelCore,
      cpuGeneration: cpuInfo.cpuGeneration,
      isLaptop,
      resolution,
      loading: false,
      scanned: !!scanned,
    });
  }, []);

  return info;
}
