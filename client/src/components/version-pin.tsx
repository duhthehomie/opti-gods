import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { isNative } from "@/lib/tauri-bridge";
import { useInstalledVersion } from "@/hooks/use-installed-version";

export function VersionPin() {
  return isNative() ? <NativeVersionPin /> : null;
}

function NativeVersionPin() {
  const { data } = useVersionInfo();
  const { version: current } = useInstalledVersion();
  if (!current) return null;
  const latest = data?.latestVersion ?? current;
  const updateAvailable = compareVersions(latest, current) > 0;

  return (
    <div
      data-testid="text-version-pin"
      className="fixed bottom-2 right-3 z-30 select-none pointer-events-none"
    >
      <span
        className={cn(
          "text-[10px] font-mono tracking-wider",
          updateAvailable ? "text-red-400" : "text-red-500/50"
        )}
      >
        V5
        {updateAvailable && (
          <span className="ml-1.5 text-red-400/80">· update available</span>
        )}
      </span>
    </div>
  );
}
