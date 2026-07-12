import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { BRAND } from "@/components/branding/assets";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(239,68,68,0.07) 0%, transparent 70%)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-red-600/8 rounded-full blur-[180px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-10 px-4">
        <div className="relative">
          <video
            src={BRAND.spinRed}
            autoPlay
            muted
            loop
            playsInline
            data-testid="video-404-logo"
            className="w-56 h-56 object-contain drop-shadow-[0_0_80px_rgba(239,68,68,0.55)]"
          />
          <div className="absolute inset-0 bg-red-600/10 rounded-full blur-[60px]" />
        </div>

        <div className="text-center space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.5em] text-red-400" data-testid="text-404-label">
            Error 404
          </p>
          <h1 className="text-5xl font-display font-black text-white tracking-tight" data-testid="heading-404">
            Page not found
          </h1>
          <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
            That route doesn&apos;t exist. Head back to the dashboard and keep optimizing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              data-testid="button-404-home"
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 shadow-[0_0_20px_-4px_rgba(239,68,68,0.5)]"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Button
            data-testid="button-404-back"
            variant="outline"
            onClick={() => window.history.back()}
            className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <p className="text-[10px] text-zinc-700 font-mono">OPTI GODS — V4</p>
      </div>
    </div>
  );
}
