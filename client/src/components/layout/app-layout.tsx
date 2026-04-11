import { ReactNode, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { Loader2, Download, X } from "lucide-react";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useGenerateScript } from "@/hooks/use-script";
import { ScriptDialog } from "../script-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";
import { ProGate } from "@/components/pro-gate";
import { HardwareDetectionBanner } from "@/components/hardware-detection-banner";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState<string | null>(null);

  const { tweaks, nvidiaPreset, reset } = useOptimizationStore();
  const generateScript = useGenerateScript();
  const { toast } = useToast();
  const osInfo = useOsDetection();

  const handleApply = () => {
    generateScript.mutate({ tweaks, nvidiaPreset }, {
      onSuccess: (data) => {
        setCommand(data.command);
        setDialogOpen(true);
      },
      onError: (error) => {
        toast({ title: "Error Generating Script", description: error.message, variant: "destructive" });
      }
    });
  };

  const osLabel = osInfo.loading ? "Detecting..." : osInfo.os;
  const enabledCount = Object.values(tweaks).filter(Boolean).length;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#020202] text-white overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative z-10 overflow-hidden">

          {/* Top Header */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-zinc-400 hover:text-white" />
              <div className="h-4 w-px bg-white/10 hidden md:block" />
              <span className="text-xs font-mono text-zinc-500 hidden md:block">
                {osLabel} |{" "}
                {enabledCount > 0 ? (
                  <span className="text-red-400 font-semibold">{enabledCount} tweaks selected</span>
                ) : (
                  <span className="text-zinc-600">no tweaks selected yet</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Unselect All — only shown when tweaks are selected */}
              {enabledCount > 0 && (
                <Button
                  data-testid="button-clear-all-tweaks"
                  variant="ghost"
                  size="sm"
                  onClick={() => reset()}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 transition-all duration-200 font-mono text-xs px-3"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Unselect All
                </Button>
              )}
              {/* Single clear download CTA */}
              <ProGate>
                <Button
                  data-testid="button-apply-optimizations"
                  onClick={handleApply}
                  disabled={generateScript.isPending}
                  className={cn(
                    "font-display tracking-wide px-6 border transition-all duration-300",
                    enabledCount > 0
                      ? "bg-red-600 hover:bg-red-500 text-white border-red-400/50 shadow-[0_0_20px_-3px_rgba(239,68,68,0.5)]"
                      : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}
                >
                  {generateScript.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {enabledCount > 0 ? `GET MY SCRIPT (${enabledCount})` : "GET MY SCRIPT"}
                </Button>
              </ProGate>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none z-[-1]" />
            <div className="max-w-5xl mx-auto w-full h-full space-y-6">
              <HardwareDetectionBanner compact />
              {children}
            </div>
          </main>
        </div>
      </div>

      <ScriptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        command={command}
      />
    </SidebarProvider>
  );
}
