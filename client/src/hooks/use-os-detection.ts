import { useState, useEffect } from "react";
import { getScannedInfo } from "@/hooks/use-hardware-info";

export interface OsInfo {
  os: string;
  displayName: string;
  isWindows: boolean;
  isWindows11: boolean;
  isWindows10: boolean;
  build: string;
  loading: boolean;
  fromScan: boolean;
}

function parseFromUA(ua: string): Omit<OsInfo, "loading" | "fromScan"> {
  if (/Windows NT 10\.0/.test(ua)) {
    return { os: "Windows 10 Pro", displayName: "Windows 10 Pro (22H2)", isWindows: true, isWindows11: false, isWindows10: true, build: "19045" };
  }
  if (/Windows NT 6\.3/.test(ua)) {
    return { os: "Windows 8.1", displayName: "Windows 8.1", isWindows: true, isWindows11: false, isWindows10: false, build: "9600" };
  }
  if (/Windows NT 6\.1/.test(ua)) {
    return { os: "Windows 7", displayName: "Windows 7", isWindows: true, isWindows11: false, isWindows10: false, build: "7601" };
  }
  if (/Macintosh|Mac OS X/.test(ua)) {
    return { os: "macOS", displayName: "macOS", isWindows: false, isWindows11: false, isWindows10: false, build: "" };
  }
  if (/Linux/.test(ua)) {
    return { os: "Linux", displayName: "Linux", isWindows: false, isWindows11: false, isWindows10: false, build: "" };
  }
  if (/Android/.test(ua)) {
    return { os: "Android", displayName: "Android", isWindows: false, isWindows11: false, isWindows10: false, build: "" };
  }
  if (/iPhone|iPad/.test(ua)) {
    return { os: "iOS", displayName: "iOS", isWindows: false, isWindows11: false, isWindows10: false, build: "" };
  }
  return { os: "Unknown OS", displayName: "Unknown OS", isWindows: false, isWindows11: false, isWindows10: false, build: "" };
}

function parseFromScan(osBuild: number, osName: string): Omit<OsInfo, "loading" | "fromScan"> | null {
  const isWin11 = osBuild >= 22000;
  const isWin10 = osBuild >= 10240 && osBuild < 22000;
  if (!isWin11 && !isWin10) return null;
  const cleanName = osName.replace(/^Microsoft\s+/i, "").trim();
  const build = String(osBuild);
  if (isWin11) {
    return {
      os: cleanName || "Windows 11",
      displayName: `${cleanName || "Windows 11"} (Build ${build})`,
      isWindows: true,
      isWindows11: true,
      isWindows10: false,
      build,
    };
  }
  return {
    os: cleanName || "Windows 10",
    displayName: `${cleanName || "Windows 10"} (Build ${build})`,
    isWindows: true,
    isWindows11: false,
    isWindows10: true,
    build,
  };
}

export function useOsDetection(): OsInfo {
  const [osInfo, setOsInfo] = useState<OsInfo>({
    os: "Detecting...",
    displayName: "Detecting...",
    isWindows: false,
    isWindows11: false,
    isWindows10: false,
    build: "",
    loading: true,
    fromScan: false,
  });

  useEffect(() => {
    // Priority 1: scanned data from PS1 (exact build number, definitive)
    const scanned = getScannedInfo();
    if (scanned?.OsBuild && scanned.OsBuild > 0) {
      const fromScan = parseFromScan(scanned.OsBuild, scanned.OsName || "");
      if (fromScan) {
        setOsInfo({ ...fromScan, loading: false, fromScan: true });
        return;
      }
    }

    const ua = navigator.userAgent;
    const fallback = parseFromUA(ua);

    // Priority 2: User-Agent Client Hints (Chrome 90+ / Edge 90+) for accurate Win11 detection
    const uaData = (navigator as any).userAgentData;
    if (uaData && typeof uaData.getHighEntropyValues === "function") {
      uaData
        .getHighEntropyValues(["platform", "platformVersion"])
        .then((info: any) => {
          if (info.platform === "Windows") {
            // Win 11 = platformVersion major >= 13
            const major = parseInt((info.platformVersion || "0").split(".")[0], 10);
            if (major >= 13) {
              setOsInfo({
                os: "Windows 11 Pro",
                displayName: "Windows 11 Pro (23H2)",
                isWindows: true,
                isWindows11: true,
                isWindows10: false,
                build: "22631",
                loading: false,
                fromScan: false,
              });
            } else {
              setOsInfo({
                os: "Windows 10 Pro",
                displayName: "Windows 10 Pro (22H2)",
                isWindows: true,
                isWindows11: false,
                isWindows10: true,
                build: "19045",
                loading: false,
                fromScan: false,
              });
            }
          } else if (info.platform === "macOS") {
            setOsInfo({ os: "macOS", displayName: "macOS", isWindows: false, isWindows11: false, isWindows10: false, build: "", loading: false, fromScan: false });
          } else if (info.platform === "Linux") {
            setOsInfo({ os: "Linux", displayName: "Linux", isWindows: false, isWindows11: false, isWindows10: false, build: "", loading: false, fromScan: false });
          } else {
            setOsInfo({ ...fallback, loading: false, fromScan: false });
          }
        })
        .catch(() => {
          setOsInfo({ ...fallback, loading: false, fromScan: false });
        });
    } else {
      setOsInfo({ ...fallback, loading: false, fromScan: false });
    }
  }, []);

  return osInfo;
}
