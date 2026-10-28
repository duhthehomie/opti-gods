import { useEffect, useState } from "react";
import { APP_VERSION } from "@/generated/version";
import { getInstalledAppVersion, isNative } from "@/lib/tauri-bridge";

/** The running binary's version, not the website's compiled frontend version. */
export function useInstalledVersion() {
  const [version, setVersion] = useState<string | null>(() => isNative() ? null : APP_VERSION);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    let mounted = true;
    getInstalledAppVersion().then(value => {
      if (mounted) setVersion(value);
    }).catch(() => {
      if (mounted) setError("Could not read the installed app version. Reopen Opti Gods and try again.");
    });
    return () => { mounted = false; };
  }, []);
  return { version, error };
}
