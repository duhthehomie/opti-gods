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
    // Chrome on Windows returns: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)"
    // Firefox returns: "GeForce RTX 3080/PCIe/SSE2"
    // We parse both formats correctly.
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
          const angleMatch = rawRenderer.match(/ANGLE\s*\(\s*([^,]+),\s*([^,]+(?:,\s*[^,)]+)*)/i);
          if (angleMatch) {
            // angleMatch[2] contains the renderer (may include Direct3D/OpenGL suffix)
            const innerRenderer = angleMatch[2]
              .replace(/\s*Direct3D\d+.*$/gi, "")
              .replace(/\s*OpenGL\s*\d.*$/gi, "")
              .replace(/\s*\(0x[0-9a-f]+\)/gi, "")  // remove hex device IDs
              .trim();
            gpuName = innerRenderer || angleMatch[1].trim();
            if (!gpuVendor) gpuVendor = angleMatch[1].trim();
          } else if (rawRenderer) {
            // Firefox / direct format
            gpuName = rawRenderer
              .replace(/\/PCIe\/.*$/gi, "")
              .replace(/\/SSE\d*/gi, "")
              .replace(/\s*Direct3D\d+.*$/gi, "")
              .replace(/\s*OpenGL\s*\d.*$/gi, "")
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
