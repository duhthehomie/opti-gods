import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { BRAND } from "@/components/branding/assets";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] text-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src={BRAND.redPng}
          alt="Opti Gods"
          className="w-40 h-40 mx-auto object-contain drop-shadow-[0_0_40px_rgba(239,68,68,0.45)]"
          data-testid="img-404-logo"
        />
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-400">Error 404</p>
          <h1 className="text-3xl font-display font-black text-white">Page not found</h1>
          <p className="text-sm text-zinc-500">
            That route doesn't exist. Head back to the dashboard and keep optimizing.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Link href="/">
            <Button data-testid="button-404-home" className="bg-red-600 hover:bg-red-500 text-white font-bold">
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
      </div>
    </div>
  );
}
