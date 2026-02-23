import { ReactNode, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { Zap, Loader2 } from "lucide-react";
import { useOptimizationStore } from "@/store/use-optimization-store";
import { useGenerateScript } from "@/hooks/use-script";
import { ScriptDialog } from "../script-dialog";
import { useToast } from "@/hooks/use-toast";

export function AppLayout({ children }: { children: ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState<string | null>(null);
  
  const { tweaks, nvidiaPreset } = useOptimizationStore();
  const generateScript = useGenerateScript();
  const { toast } = useToast();

  const handleApply = () => {
    generateScript.mutate({ tweaks, nvidiaPreset }, {
      onSuccess: (data) => {
        setCommand(data.command);
        setDialogOpen(true);
      },
      onError: (error) => {
        toast({
          title: "Error Generating Script",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#020202] text-white overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative z-10 overflow-hidden">
          
          {/* Top Header */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-zinc-400 hover:text-white" />
              <div className="h-4 w-px bg-white/10 hidden md:block"></div>
              <span className="text-xs font-mono text-zinc-500 hidden md:block">SYSTEM: WIN_11 | STATUS: UNOPTIMIZED</span>
            </div>
            
            <Button 
              onClick={handleApply}
              disabled={generateScript.isPending}
              className="bg-red-600 hover:bg-red-500 text-white border border-red-400/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)] transition-all duration-300 px-6 font-display tracking-wide"
            >
              {generateScript.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              APPLY OPTIMIZATIONS
            </Button>
          </header>
          
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 relative">
            {/* Subtle red background glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none z-[-1]"></div>
            
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
