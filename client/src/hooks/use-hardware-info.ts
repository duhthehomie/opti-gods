import { useState, useEffect } from "react";

export type GpuVendor = "nvidia" | "amd" | "intel" | "unknown";
export type GpuTier = "low" | "mid" | "high" | "pro" | "unknown";

export interface GpuEntry {
  /** Canonical vendor — "amd" includes both discrete Radeon and Vega APUs. */
  vendor: GpuVendor;
  /** Cleaned-up model name as it should appear to the user. */
  name: string;
  /** Rough generational tier for UX hints. */
  tier: GpuTier;
  /** True for iGPU / APU / mobile-integrated parts. */
  isIntegrated: boolean;
}

export interface HardwareInfo {
  cpuCores: number;           // logical processors (threads)
  cpuPhysicalCores: number;   // physical cores (threads / 2 when scanned data unavailable)
  cpuLabel: string;
  ramGB: number;
  ramLabel: string;
  ramNote: string;
  gpuName: string;
  gpuVendor: string;
  /** Full classified GPU list — hybrid laptops will have multiple entries. */
  gpus: GpuEntry[];
  /** True if ANY classified GPU is the given vendor (hybrid-aware). */
  isNvidia: boolean;
  isAMD: boolean;             // legacy flag, kept for back-compat
  isAmd: boolean;             // task spec alias (lowercase d)
  isIntel: boolean;
  // GPU tier / generation
  nvidiaIsLowEnd: boolean;    // GTX 10xx/16xx (Pascal/Turing) — limited VRAM
  nvidiaIsRTX: boolean;       // RTX 20xx/30xx/40xx/50xx
  isAmdGpu: boolean;          // AMD discrete GPU (RX 5xx / 6xx / 7xx series)
  isAmdApu: boolean;          // AMD APU / Vega iGPU
  // Hybrid / topology
  hasDiscreteGpu: boolean;    // any non-integrated GPU detected
  hasIntegratedGpu: boolean;  // any integrated GPU detected
  isHybridGpu: boolean;       // both an iGPU and a discrete GPU present
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

/**
 * Split a raw GPU string (from a scan PS1, DXDiag dump, or WebGL renderer)
 * into individual GPU names. Hybrid laptops typically come through as
 * "Intel(R) UHD Graphics 630; NVIDIA GeForce RTX 3060 Laptop GPU" or split
 * over newlines.
 */
function splitGpuList(raw: string): string[] {
  if (!raw) return [];
  // Primary separators: newline, semicolon, pipe, " | ", " / " (uncommon)
  const parts = raw
    .split(/[\r\n;|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  // Detect a "Vendor X then another Vendor" run-on (no separator) and split it.
  const out: string[] = [];
  for (const part of parts) {
    const splits = part.split(
      /\s+(?=(?:NVIDIA|GeForce|Quadro|AMD|Radeon|Intel|Iris|UHD|HD\s+Graphics|Arc\b)\b)/gi
    );
    for (const s of splits) {
      const cleaned = s.replace(/^[\s,]+|[\s,]+$/g, "");
      if (cleaned) out.push(cleaned);
    }
  }
  // De-dupe by case-insensitive name
  const seen = new Set<string>();
  return out.filter((n) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Classify a single GPU model name into vendor + rough tier. */
export function classifyGpu(rawName: string): GpuEntry {
  const name = rawName.trim();
  const n = name.toLowerCase();

  // ---------- Vendor ----------
  let vendor: GpuVendor = "unknown";
  if (/nvidia|geforce|\bgtx\b|\brtx\b|\bquadro\b|\btesla\b|\bmx\d|\btitan\b/.test(n)) {
    vendor = "nvidia";
  } else if (/\bamd\b|radeon|\brx\s*\d|vega|\brdna\b|\bfirepro\b|\binstinct\b|\bryzen.*graphics\b/.test(n)) {
    vendor = "amd";
  } else if (/\bintel\b|\buhd\b|\biris\b|\barc\b|\bhd graphics\b|\bxe graphics\b/.test(n)) {
    vendor = "intel";
  }

  // ---------- Integrated? ----------
  let isIntegrated = false;
  if (vendor === "intel") {
    isIntegrated = !/\barc\s+a?\d{3,}|arc\s+(a|b)\d|\barc\s+pro\b/.test(n); // Arc dGPU is the only Intel discrete family
  } else if (vendor === "amd") {
    isIntegrated = /vega\s*[368]\b|vega\s*11\b|radeon\s+graphics(?!\s+pro)|radeon\s+\d+m?\s+graphics|ryzen.*graphics|\bapu\b|integrated/.test(n);
  } else if (vendor === "nvidia") {
    isIntegrated = false; // NVIDIA has no iGPUs (Tegra is out of scope)
  }

  // ---------- Tier ----------
  let tier: GpuTier = "unknown";
  if (vendor === "nvidia") {
    if (/\bquadro\b|\btesla\b|\brtx\s*a\d{4}|\bh100\b|\ba100\b|\bl40\b/.test(n)) {
      tier = "pro";
    } else if (/\brtx\s*(30[6-9]\d|3080|3090|40[6-9]\d|4080|4090|50[6-9]\d|5080|5090)\b/.test(n) ||
               /\b(3080|3090|4080|4090|5080|5090)\b/.test(n)) {
      tier = "high";
    } else if (/\brtx\s*(20[6-8]\d|2080|2090)\b/.test(n) ||
               /\b(2060|2070|2080|3060|3070|4060|4070|5060|5070)\b/.test(n) ||
               /\bgtx\s*16[56]\d\b/.test(n)) {
      tier = "mid";
    } else if (/\bgtx\s*(10[3-8]\d|9[5-8]\d)\b/.test(n) ||
               /\b(1030|1050|1060|1070|1080|960|970|980)\b/.test(n) ||
               /\bmx\s*\d+\b/.test(n)) {
      tier = "low";
    } else if (/\bgtx\b|\brtx\b|geforce/.test(n)) {
      tier = "mid";
    }
  } else if (vendor === "amd") {
    if (/\bfirepro\b|\binstinct\b|\bradeon\s+pro\b|\bw[567]\d{3}\b/.test(n)) {
      tier = "pro";
    } else if (/\brx\s*(9[0-9]{3}|7[89]\d{2}|7900|7800|6900|6800|6750|6700)\b/.test(n) ||
               /\bvii\b|\bradeon\s+vii\b/.test(n)) {
      tier = "high";
    } else if (/\brx\s*(76\d{2}|75\d{2}|74\d{2}|66\d{2}|65\d{2}|5[567]\d{2}|5500)\b/.test(n)) {
      tier = "mid";
    } else if (/\brx\s*([45]\d{2}|6[34]\d{2}|550)\b/.test(n) ||
               /\bvega\s*(56|64)\b/.test(n)) {
      tier = "low";
    } else if (isIntegrated) {
      tier = "low";
    } else if (/\brx\b|radeon/.test(n)) {
      tier = "mid";
    }
  } else if (vendor === "intel") {
    if (/\barc\s+(a7|a5|a3|b5|b3)\d{2}|arc\s+pro/.test(n)) {
      tier = "mid";
    } else if (/iris\s+xe|iris\s+plus|\bxe graphics\b/.test(n)) {
      tier = "low";
    } else if (/\buhd\b|\bhd graphics\b/.test(n)) {
      tier = "low";
    }
  }

  return { vendor, name: name || "Unknown GPU", tier, isIntegrated };
}

/** Detect NVIDIA GPU generation from model name (kept for back-compat). */
function detectNvidiaGen(gpuName: string): { nvidiaIsLowEnd: boolean; nvidiaIsRTX: boolean } {
  const n = gpuName.toLowerCase();
  const nvidiaIsRTX = /rtx\s*\d/.test(n) || /\b(2060|2070|2080|3060|3070|3080|3090|4060|4070|4080|4090|5060|5070|5080|5090)\b/.test(n);
  const nvidiaIsLowEnd = /gtx\s*\d/.test(n) || /\b(1030|1050|1060|1650|1660|1070|1080|980|970|960)\b/.test(n);
  return { nvidiaIsLowEnd: nvidiaIsLowEnd && !nvidiaIsRTX, nvidiaIsRTX };
}

/** Detect CPU brand and generation from scanned CPU name. */
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

  let cpuGeneration = 0;
  if (isRyzen) {
    const ryzenMatch = n.match(/ryzen\s*\d+\s+(\d)(\d{3})/);
    if (ryzenMatch) cpuGeneration = parseInt(ryzenMatch[1]);
  }
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
    cpuPhysicalCores: 0,
    cpuLabel: "Detecting...",
    ramGB: 0,
    ramLabel: "Detecting...",
    ramNote: "",
    gpuName: "Detecting...",
    gpuVendor: "",
    gpus: [],
    isNvidia: false,
    isAMD: false,
    isAmd: false,
    isIntel: false,
    nvidiaIsLowEnd: false,
    nvidiaIsRTX: false,
    isAmdGpu: false,
    isAmdApu: false,
    hasDiscreteGpu: false,
    hasIntegratedGpu: false,
    isHybridGpu: false,
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

    const resolution = `${screen.width}×${screen.height}`;

    // ---------- GPU classification (multi-GPU aware) ----------
    const rawScanned = scanned?.GPU?.trim() || "";
    const webgl = !rawScanned ? detectGPUViaWebGL() : { gpuName: "", gpuVendor: "" };
    const rawCombined = [rawScanned, webgl.gpuName].filter(Boolean).join("\n");

    const candidateNames = splitGpuList(rawCombined);
    const gpus: GpuEntry[] = candidateNames
      .map(classifyGpu)
      // Drop unknown-vendor entries that don't look like a real GPU at all
      .filter((g) => g.vendor !== "unknown" || /graphics|gpu|display/i.test(g.name));

    // If the scan + WebGL produced nothing, fall back to a single Unknown entry.
    if (gpus.length === 0) {
      const fallback = rawScanned || webgl.gpuName;
      if (fallback) gpus.push(classifyGpu(fallback));
    }

    // Primary GPU label: prefer the first discrete entry, else the first.
    const primary = gpus.find((g) => !g.isIntegrated) ?? gpus[0];
    const gpuName = primary?.name || "Unknown GPU";
    const gpuVendor = webgl.gpuVendor || primary?.vendor || "";

    const isNvidia = gpus.some((g) => g.vendor === "nvidia");
    const amdGpus = gpus.filter((g) => g.vendor === "amd");
    const isAmd = amdGpus.length > 0;
    const isIntel = gpus.some((g) => g.vendor === "intel");
    const isAmdGpu = amdGpus.some((g) => !g.isIntegrated);
    const isAmdApu = amdGpus.some((g) => g.isIntegrated);

    const hasDiscreteGpu = gpus.some((g) => !g.isIntegrated && g.vendor !== "unknown");
    const hasIntegratedGpu = gpus.some((g) => g.isIntegrated);
    const isHybridGpu = hasDiscreteGpu && hasIntegratedGpu;

    // Back-compat NVIDIA gen flags (look at all NVIDIA entries combined)
    const nvidiaName = gpus.filter((g) => g.vendor === "nvidia").map((g) => g.name).join(" ") || gpuName;
    const { nvidiaIsLowEnd, nvidiaIsRTX } = detectNvidiaGen(nvidiaName);

    // Laptop detection — Battery API (async)
    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (battery && (battery.level < 1.0 || !battery.charging || battery.dischargingTime !== Infinity)) {
          setInfo((prev) => ({ ...prev, isLaptop: true }));
        }
      }).catch(() => {});
    }
    // Hybrid GPU is a near-certain laptop signal too (Intel iGPU + NVIDIA dGPU).
    const isLaptop = isHybridGpu && hasIntegratedGpu && (isNvidia || isAmdGpu);

    setInfo({
      cpuCores,
      cpuPhysicalCores: physicalCores,
      cpuLabel,
      ramGB,
      ramLabel,
      ramNote,
      gpuName,
      gpuVendor,
      gpus,
      isNvidia,
      isAMD: isAmd,
      isAmd,
      isIntel,
      nvidiaIsLowEnd,
      nvidiaIsRTX,
      isAmdGpu,
      isAmdApu,
      hasDiscreteGpu,
      hasIntegratedGpu,
      isHybridGpu,
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
