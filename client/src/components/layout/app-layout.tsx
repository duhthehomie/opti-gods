import { ReactNode, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, Download } from "lucide-react";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useGenerateScript } from "@/hooks/use-script";
import { ScriptDialog } from "../script-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOsDetection } from "@/hooks/use-os-detection";

export function AppLayout({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { tweaks, nvidiaPreset } = useOptimizationStore();
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

  const handleDownload = async () => {
    const enabledCount = Object.values(tweaks).filter(Boolean).length;
    if (enabledCount === 0) {
      toast({ title: "No tweaks selected", description: "Enable at least one optimization before downloading.", variant: "destructive" });
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch("/api/script/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweaks, nvidiaPreset }),
      });

      if (!res.ok) throw new Error("Failed to generate script");

      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OptiGods-by-leaq.ps1";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: `Downloaded OptiGods-by-leaq.ps1 (${enabledCount} tweaks)`,
        description: "Right-click the file → Run with PowerShell as Administrator.",
      });
    } catch (e) {
      toast({ title: "Download failed", description: String(e), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const osLabel = osInfo.loading ? "DETECTING..." : osInfo.os.toUpperCase().replace(/ /g, "_");

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
                SYSTEM: {osLabel} | STATUS: UNOPTIMIZED
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Direct Download Button */}
              <Button
                data-testid="button-download-script"
                onClick={handleDownload}
                disabled={downloading}
                variant="outline"
                className="border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 font-display tracking-wide px-4 hidden sm:flex"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                DOWNLOAD .PS1
              </Button>

              {/* PowerShell Command Button */}
              <Button
                data-testid="button-apply-optimizations"
                onClick={handleApply}
                disabled={generateScript.isPending}
                className="bg-red-600 hover:bg-red-500 text-white border border-red-400/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] transition-all duration-300 px-6 font-display tracking-wide"
              >
                {generateScript.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                APPLY
              </Button>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none z-[-1]" />
            <div className="max-w-5xl mx-auto w-full h-full">
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
