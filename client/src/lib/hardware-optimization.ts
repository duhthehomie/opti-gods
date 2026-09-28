import type { HardwareInfo } from "@/hooks/use-hardware-info";

/**
 * Select one of the two preferred gaming scheduler values using the detected
 * logical processor count. Keep the threshold aligned with the native and
 * generated-script implementations.
 *
 * Win32PrioritySeparation is a bit field: 0x1A is decimal 26, while 0x26 is
 * decimal 38. Unknown/low thread counts use the conservative 0x1A value.
 */
export function getOptimalWin32PrioritySeparation(hw: Pick<HardwareInfo, "cpuCores">): number {
  return hw.cpuCores >= 12 ? 0x26 : 0x1a;
}

export function getWin32PrioritySeparationExplanation(hw: Pick<HardwareInfo, "cpuCores">): string {
  const logicalProcessors = Number.isFinite(hw.cpuCores) ? hw.cpuCores : 0;
  const value = logicalProcessors >= 12 ? 0x26 : 0x1a;
  const hex = value.toString(16).toUpperCase().padStart(2, "0");
  const tier = logicalProcessors >= 12
    ? "12 or more logical processors"
    : "fewer than 12 logical processors";
  return `Hardware-matched recommendation: 0x${hex} (${value} decimal) for ${tier}. Automatic selection uses 0x1A or 0x26; 0x28 and 0x40 are not selected automatically.`;
}

/**
 * Use one stable value across hardware profiles. The server, native desktop
 * path, and every Pro preset apply SystemResponsiveness=10.
 */
export function getOptimalSystemResponsiveness(_hw: HardwareInfo): number {
  return 10;
}

/**
 * Get a human-readable recommendation explanation.
 */
export function getSystemResponsivenessExplanation(hw: HardwareInfo, _value: number): string {
  const phys = hw.cpuPhysicalCores || Math.ceil(hw.cpuCores / 2);
  const cpuDesc =
    phys >= 12
      ? `${phys} physical cores (high-end)`
      : phys >= 6
        ? `${phys} physical cores (mid-range)`
        : `${phys} physical cores (resource-constrained)`;
  const gpuDesc = hw.nvidiaIsRTX
    ? "RTX (high-end)"
    : hw.isAmdGpu
      ? "AMD discrete (high-end)"
      : hw.nvidiaIsLowEnd
        ? "GTX 10xx/16xx (low-end)"
        : hw.isAmdApu
          ? "APU/iGPU (low-end)"
          : "Unknown";

  return `System: ${gpuDesc} GPU, ${cpuDesc} CPU • Universal recommendation: 0x0A (10d) — keeps 10% available to audio and background apps while prioritizing games.`;
}

/**
 * Determine if a tweak applies to this hardware.
 * Returns null if the tweak doesn't apply, or a reason string if it does.
 */
export function getTweakRelevance(
  tweakId: string,
  hw: HardwareInfo
): { applies: boolean; reason?: string } {
  // GPU-specific tweaks
  if (tweakId.includes("NVIDIA") || tweakId.includes("Nvidia")) {
    return { applies: hw.isNvidia, reason: hw.isNvidia ? undefined : "GPU-specific: NVIDIA GPU not detected" };
  }
  if (tweakId.includes("AMD") || tweakId.includes("Amd")) {
    return { applies: hw.isAMD, reason: hw.isAMD ? undefined : "GPU-specific: AMD GPU not detected" };
  }
  if (tweakId.includes("1060")) {
    return { applies: hw.nvidiaIsLowEnd && hw.gpuName.includes("1060"), reason: hw.gpuName.includes("1060") ? undefined : "Hardware-specific: GTX 1060 not detected" };
  }
  if (tweakId.includes("5600")) {
    return { applies: hw.isRyzen && hw.cpuGeneration === 5, reason: hw.isRyzen && hw.cpuGeneration === 5 ? undefined : "CPU-specific: Ryzen 5 5600 not detected" };
  }

  // Memory-specific tweaks
  if (tweakId.includes("DisableMemoryCompression")) {
    // Only recommend disabling compression at 32GB+ — at 16GB heavy RAM users
    // (like gaming PCs at 80%+ utilisation) will see disk paging without it.
    return { applies: hw.ramGB >= 32, reason: hw.ramGB >= 32 ? undefined : `RAM-specific: Only recommended at 32GB+ (you have ${hw.ramGB}GB — keep compression ON to avoid disk paging)` };
  }
  if (tweakId.includes("DisablePrefetch")) {
    return { applies: true, reason: "Best on SSD/NVMe (you can still apply on HDD, but may slow load times)" };
  }

  // Laptop-specific
  if (tweakId.startsWith("Lap_")) {
    return { applies: hw.isLaptop, reason: hw.isLaptop ? undefined : "Laptop-specific: Desktop detected" };
  }

  // Everything else applies
  return { applies: true };
}
