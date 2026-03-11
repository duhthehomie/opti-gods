import { useState, useEffect } from "react";

export interface OsInfo {
  os: string;
  displayName: string;
  isWindows: boolean;
  isWindows11: boolean;
  isWindows10: boolean;
  build: string;
  loading: boolean;
}

function parseFromUA(ua: string): Omit<OsInfo, "loading"> {
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

export function useOsDetection(): OsInfo {
  const [osInfo, setOsInfo] = useState<OsInfo>({
    os: "Detecting...",
    displayName: "Detecting...",
    isWindows: false,
    isWindows11: false,
    isWindows10: false,
    build: "",
    loading: true,
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    const fallback = parseFromUA(ua);

    // Use User-Agent Client Hints (Chrome 90+ / Edge 90+) for accurate Win11 detection
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
              });
            }
          } else if (info.platform === "macOS") {
            setOsInfo({ os: "macOS", displayName: "macOS", isWindows: false, isWindows11: false, isWindows10: false, build: "", loading: false });
          } else if (info.platform === "Linux") {
            setOsInfo({ os: "Linux", displayName: "Linux", isWindows: false, isWindows11: false, isWindows10: false, build: "", loading: false });
          } else {
            setOsInfo({ ...fallback, loading: false });
          }
        })
        .catch(() => {
          setOsInfo({ ...fallback, loading: false });
        });
    } else {
      setOsInfo({ ...fallback, loading: false });
    }
  }, []);

  return osInfo;
}
