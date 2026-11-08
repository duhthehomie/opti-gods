import { useLocation } from "wouter";
import { WebsiteAppPreview } from "@/components/marketing/website-app-preview";

/** Browser app routes never mount Windows pages, stores, or apply hooks. */
export default function WebsiteWorkspacePreview() {
  const [location, navigate] = useLocation();
  const path = location === "/system-scan" ? "/ai-optimize"
    : location === "/game-detection" ? "/game-profiles"
    : location === "/fivem-graphics" ? "/graphics-studio"
    : location === "/help" ? "/support" : location;
  return (
    <div className="min-h-screen w-full bg-[#040708] p-2 text-white sm:p-4">
      <a href="/" className="mb-3 inline-block text-xs text-zinc-400 hover:text-white">Opti Gods website</a>
      <WebsiteAppPreview path={path} onNavigate={navigate} workspace />
    </div>
  );
}
