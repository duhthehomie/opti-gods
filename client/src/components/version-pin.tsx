import { useVersionInfo, compareVersions } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function VersionPin() {
  const { data } = useVersionInfo();
  const current = data?.currentVersion ?? "2.00";
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
          updateAvailable ? "text-red-400" : "text-zinc-700"
        )}
      >
        v{current}
        {updateAvailable && (
          <span className="ml-1.5 text-red-400/80">· update available</span>
        )}
      </span>
    </div>
  );
}
