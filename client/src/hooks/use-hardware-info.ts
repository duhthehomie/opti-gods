import { useState, useEffect } from "react";

export interface HardwareInfo {
  cpuCores: number;
  cpuLabel: string;
  ramGB: number;
  ramLabel: string;
  gpuName: string;
  gpuVendor: string;
  isNvidia: boolean;
  isAMD: boolean;
  isIntel: boolean;
  resolution: string;
  loading: boolean;
}

export function useHardwareInfo(): HardwareInfo {
  const [info, setInfo] = useState<HardwareInfo>({
    cpuCores: 0,
    cpuLabel: "Detecting...",
    ramGB: 0,
    ramLabel: "Detecting...",
    gpuName: "Detecting...",
    gpuVendor: "",
    isNvidia: false,
    isAMD: false,
    isIntel: false,
    resolution: "",
    loading: true,
  });

  useEffect(() => {
    // CPU — navigator.hardwareConcurrency is real logical core count
    const cpuCores = navigator.hardwareConcurrency || 0;
    const cpuLabel = cpuCores > 0
      ? `${cpuCores} Threads (est. ${Math.max(1, Math.floor(cpuCores / 2))} physical)`
      : "Unknown";

    // RAM — navigator.deviceMemory is approximate (0.25/0.5/1/2/4/8 GB buckets)
    const ramGB = (navigator as any).deviceMemory || 0;
    const ramLabel = ramGB > 0 ? `~${ramGB} GB` : "Unknown";

    // Resolution — exact
    const resolution = `${screen.width}×${screen.height}`;

    // GPU — WebGL WEBGL_debug_renderer_info gives the real GPU name
    let gpuName = "Unknown GPU";
    let gpuVendor = "";
    try {
      const canvas = document.createElement("canvas");
      const gl = (
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      ) as WebGLRenderingContext | null;
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          gpuName = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "Unknown GPU";
          gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "";
          // Clean up verbose driver strings
          gpuName = gpuName
            .replace(/\s*\/?\s*ANGLE\s*\(.*?\)/gi, "")
            .replace(/\s*Direct3D\d+.*$/gi, "")
            .replace(/\s*OpenGL.*$/gi, "")
            .trim();
        }
      }
    } catch {}

    const n = gpuName.toLowerCase();
    const v = gpuVendor.toLowerCase();
    const isNvidia = n.includes("nvidia") || v.includes("nvidia");
    const isAMD = n.includes("amd") || n.includes("radeon") || v.includes("amd");
    const isIntel = n.includes("intel") || v.includes("intel");

    setInfo({
      cpuCores,
      cpuLabel,
      ramGB,
      ramLabel,
      gpuName,
      gpuVendor,
      isNvidia,
      isAMD,
      isIntel,
      resolution,
      loading: false,
    });
  }, []);

  return info;
}
