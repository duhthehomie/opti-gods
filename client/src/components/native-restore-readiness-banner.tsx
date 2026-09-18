import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNative } from "@/lib/tauri-bridge";
import { retryNativeBootstrap } from "@/lib/native-bootstrap";
import {
  getNativeRestoreReadiness,
  subscribeNativeRestoreReadiness,
} from "@/lib/native-readiness";

export function NativeRestoreReadinessBanner() {
  const readiness = useSyncExternalStore(
    subscribeNativeRestoreReadiness,
    getNativeRestoreReadiness,
    () => null,
  );
  const [retrying, setRetrying] = useState(false);

  if (!isNative() || !readiness || readiness.ok) return null;
  const checking = readiness.status === "checking";

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retryNativeBootstrap();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      data-testid="native-restore-readiness-banner"
      className={`fixed inset-x-0 top-0 z-[100] border-b bg-zinc-950/95 px-4 py-3 shadow-2xl backdrop-blur ${checking ? "border-amber-500/40" : "border-red-500/40"}`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <AlertTriangle className={`h-5 w-5 shrink-0 ${checking ? "text-amber-400" : "text-red-400"}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${checking ? "text-amber-200" : "text-red-200"}`}>
            {checking ? "Preparing native safety checkpoint…" : "Native tweaks are paused"}
          </p>
          <p className="text-xs text-zinc-300">
            {readiness.message} {readiness.recovery}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={retry}
          disabled={retrying || checking}
          data-testid="button-retry-restore-readiness"
        >
          {retrying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
          {retrying ? "Checking…" : "Retry"}
        </Button>
      </div>
    </div>
  );
}