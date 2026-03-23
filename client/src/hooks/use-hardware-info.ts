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
  });

  useEffect(() => {
    // CPU — navigator.hardwareConcurrency is the real logical thread count
    const cpuCores = navigator.hardwareConcurrency || 0;
    const physicalCores = cpuCores > 0 ? Math.max(1, Math.ceil(cpuCores / 2)) : 0;
    const cpuLabel = cpuCores > 0
      ? `${cpuCores} Threads (${physicalCores} cores)`
      : "Unknown";

    // RAM — navigator.deviceMemory is privacy-capped by browsers at 8 GB max,
    // rounded to buckets (0.25 / 0.5 / 1 / 2 / 4 / 8). Actual RAM is always
    // >= the reported value. We display it as a lower bound.
    const rawRamGB: number = (navigator as any).deviceMemory || 0;
    let ramGB = rawRamGB;
    let ramLabel = "Unknown";
    let ramNote = "Browser API unavailable";

    if (rawRamGB > 0) {
      if (rawRamGB >= 8) {
        // At the cap — real RAM is very likely 16, 32 or 64 GB
        ramLabel = "8+ GB";
        ramNote = "≥8 GB detected (actual may be 16/32/64 GB)";
        ramGB = 8;
      } else {
        ramLabel = `≥${rawRamGB} GB`;
        ramNote = `Browser reports ≥${rawRamGB} GB (privacy limited)`;
      }
    }

    // Resolution — exact from screen object
    const resolution = `${screen.width}×${screen.height}`;

    // GPU — WebGL WEBGL_debug_renderer_info gives the real GPU name
    // Chrome on Windows: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)"
    // Firefox:           "GeForce RTX 3080/PCIe/SSE2"
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
          const rawRenderer: string = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
          const rawVendor: string = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "";
          gpuVendor = rawVendor;

          // ANGLE format: "ANGLE (Vendor, Renderer Name Direct3D... , api)"
          const angleMatch = rawRenderer.match(/ANGLE\s*\(\s*([^,]+),\s*(.+?)(?:\s+Direct3D|\s+OpenGL|\s+Vulkan|,\s*D3D|$)/i);
          if (angleMatch) {
            gpuName = angleMatch[2]
              .replace(/\s*Direct3D\d+.*$/gi, "")
              .replace(/\s*OpenGL\s*\d.*$/gi, "")
              .replace(/\s*Vulkan.*$/gi, "")
              .replace(/\s*\(0x[0-9a-f]+\)/gi, "")
              .trim();
            if (!gpuVendor) gpuVendor = angleMatch[1].trim();
          } else if (rawRenderer) {
            // Firefox / direct format
            gpuName = rawRenderer
              .replace(/\/PCIe\/.*$/gi, "")
              .replace(/\/SSE\d*/gi, "")
              .replace(/\s*Direct3D\d+.*$/gi, "")
              .replace(/\s*OpenGL\s*\d.*$/gi, "")
              .replace(/\s*Vulkan.*$/gi, "")
              .trim();
          }

          if (!gpuName) gpuName = "Unknown GPU";
        }
      }
    } catch {}

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
    });
  }, []);

  return info;
}
