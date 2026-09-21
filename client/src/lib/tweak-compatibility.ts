import { useSyncExternalStore } from "react";
import { getScannedInfo } from "@/hooks/use-hardware-info";
import { isHardwareCompatible, nvidiaGtxLabel, type PresetHardware } from "@shared/preset-builder";

const CHANGE_EVENT = "optigods:hardware-scan-changed";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function snapshot(): string {
  return localStorage.getItem("optigods-sysinfo") || "";
}

function hardwareFromScan(): PresetHardware | null {
  const scan = getScannedInfo();
  if (!scan?.GPU || !scan.CPU) return null;
  const gpu = scan.GPU.toLowerCase();
  const cpu = scan.CPU.toLowerCase();
  const gpuVendor = /nvidia|geforce|rtx|gtx/.test(gpu) ? "nvidia"
    : /amd|radeon|\brx\b|vega/.test(gpu) ? "amd"
      : /intel|uhd|iris|arc/.test(gpu) ? "intel" : "unknown";
  const cpuBrand = /amd|ryzen|threadripper/.test(cpu) ? "amd"
    : /intel|\bi[3579]-|core ultra/.test(cpu) ? "intel" : "unknown";
  const isLaptop = scan.IsLaptop ?? /laptop|notebook|portable/i.test(scan.Chassis || scan.SystemModel || "");
  const osVersion = (scan.OsBuild ?? 0) >= 22000 || /windows\s*11/i.test(scan.OsName || "") ? "win11"
    : (scan.OsBuild ?? 0) >= 10240 || /windows\s*10/i.test(scan.OsName || "") ? "win10" : "unknown";
  const hasDiscreteGpu = gpuVendor === "nvidia" || (gpuVendor === "amd" && /\brx\s*\d{3,4}/i.test(scan.GPU));
  return {
    gpuVendor,
    gpuName: scan.GPU,
    cpuBrand,
    cpuLabel: scan.CPU,
    cpuCores: scan.Cores ?? scan.Threads,
    ramGB: scan.RAM_GB,
    osVersion,
    isLaptop,
    hasDiscreteGpu,
  };
}

export function getHardwareAwareTweakTitle(id: string, title: string): string {
  if (id !== "FiveM1060DisableHAGS" && id !== "FiveM1060AnselDisable") return title;
  const hardware = hardwareFromScan();
  if (!hardware) return title;
  return title.replace("GTX 1060 + GTX 1650", `GTX 1060 + ${nvidiaGtxLabel(hardware)}`);
}

export function getTweakCompatibility(id: string): { ok: boolean; reason?: string } {
  const hardware = hardwareFromScan();
  if (hardware) return isHardwareCompatible(id, hardware);
  const needsScan = id === "EnableHAGS"
    || id.startsWith("Lap_")
    || id.startsWith("Win11")
    || /^(AmdCpu|Zen5|Arrow|FiveM3500|FiveM5600|FiveMIntel14)/.test(id)
    || /^(Nvidia|Nv|Amd|IGpu_)/.test(id)
    || /^(FiveM1060|FiveM1650|FiveMDisableNvidia|FiveMDisablePhysX|FiveMFixNvidiaOverlay|FiveMGPUPriorityStack)/.test(id);
  return needsScan
    ? { ok: false, reason: "Run the hardware scan before enabling this hardware-specific tweak." }
    : { ok: true };
}

export function useTweakCompatibility(id: string): { ok: boolean; reason?: string } {
  useSyncExternalStore(subscribe, snapshot, () => "");
  return getTweakCompatibility(id);
}