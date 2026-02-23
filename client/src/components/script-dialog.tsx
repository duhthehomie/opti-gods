import { useState } from "react";
import { Copy, Terminal, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string | null;
}

export function ScriptDialog({ open, onOpenChange, command }: ScriptDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (command) {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border-red-500/20 bg-black/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-display text-white">
            <Terminal className="w-6 h-6 text-red-500" />
            Optimizations Ready
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Copy the command below and paste it into an Administrator PowerShell window to apply your custom Opti Gods configuration.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/30 to-black/0 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center justify-between p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-sm text-zinc-300 overflow-x-auto">
              <code>{command || "Generating..."}</code>
              <Button
                size="icon"
                variant="ghost"
                className="ml-4 shrink-0 hover:text-red-500 hover:bg-red-500/10"
                onClick={handleCopy}
                disabled={!command}
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-800 hover:bg-zinc-800 text-white">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
