import { useEffect, useState } from "react";
import { Cpu, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  cancelRestartToBios,
  firmwareRestartInfo,
  isNative,
  restartToBios,
  type FirmwareRestartInfo,
} from "@/lib/tauri-bridge";

const COUNTDOWN_SECONDS = 10;

/**
 * Restarts Windows straight into BIOS/UEFI setup (Advanced startup → UEFI
 * Firmware Settings in one click). Works on any UEFI PC; Legacy BIOS PCs get
 * the manual key instructions instead.
 */
export function RestartToBiosButton({ className }: { className?: string }) {
  const native = isNative();
  const { toast } = useToast();
  const [info, setInfo] = useState<FirmwareRestartInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!native) return;
    firmwareRestartInfo()
      .then(setInfo)
      .catch(error => setInfoError(error instanceof Error ? error.message : String(error)));
  }, [native]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const start = async () => {
    setBusy(true);
    try {
      await restartToBios();
      setSecondsLeft(COUNTDOWN_SECONDS);
    } catch (error) {
      toast({ title: "Could not restart into BIOS", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    try {
      await cancelRestartToBios();
      setSecondsLeft(null);
      toast({ title: "Restart cancelled", description: "Your PC will not restart." });
    } catch (error) {
      toast({ title: "Could not cancel the restart", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  if (!native) {
    return (
      <p className={className ?? "text-xs text-zinc-500"} data-testid="text-bios-restart-web">
        Restarting into BIOS works in the Opti Gods Windows app. Without it: restart and tap Delete (MSI, ASUS, Gigabyte, ASRock) or F2 while the logo shows.
      </p>
    );
  }

  const legacy = info && !info.supported;

  return (
    <div className={className}>
      {secondsLeft !== null ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="status-bios-restart-pending">
          <span className="text-sm font-bold text-red-300">
            {secondsLeft > 0 ? `Restarting into BIOS in ${secondsLeft}s…` : "Restarting now…"}
          </span>
          {secondsLeft > 0 && (
            <Button variant="outline" size="sm" onClick={cancel} className="border-white/15 text-white" data-testid="button-cancel-bios-restart">
              <X className="w-4 h-4 mr-1" /> Cancel restart
            </Button>
          )}
        </div>
      ) : (
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={busy || !!legacy || (!info && !infoError)}
          className="bg-red-600 hover:bg-red-500 text-white"
          data-testid="button-restart-to-bios"
        >
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cpu className="w-4 h-4 mr-2" />}
          Restart into BIOS
        </Button>
      )}
      {legacy && (
        <p className="mt-2 text-xs text-zinc-400" data-testid="text-bios-legacy">
          This PC uses Legacy BIOS, so Windows can't restart into it directly. Restart and tap Delete (or F2) while the logo shows.
        </p>
      )}
      {infoError && <p className="mt-2 text-xs text-red-300">{infoError}</p>}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Restart into BIOS?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Save your work first. Windows closes every open app and restarts straight into BIOS setup after a {COUNTDOWN_SECONDS} second countdown. You can cancel during the countdown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bios-restart-keep">Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => void start()} className="bg-red-600 hover:bg-red-500" data-testid="button-bios-restart-confirm">
              Restart into BIOS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
