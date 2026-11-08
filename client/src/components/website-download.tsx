import { Download } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useVersionInfo } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/api-base";

/** Public installer access, not the installed app's update or purchase flow. */
export default function WebsiteDownload() {
  const { data, isError } = useVersionInfo();

  return (
    <AppLayout>
      <section className="w-full space-y-5 rounded-2xl border border-red-500/20 bg-zinc-950 p-6" data-testid="website-download">
        <h1 className="text-2xl font-bold">Download Opti Gods</h1>
        <p className="text-sm text-zinc-400">
          Get the latest Windows installer. Free download · Includes 15 free tweaks.
        </p>
        <p className="text-xs text-zinc-500" role="status">
          {isError
            ? "Release details are unavailable. The download link will check for the latest installer."
            : data
              ? `Latest GitHub release: v${data.latestVersion}`
              : "Checking the latest GitHub release…"}
        </p>
        <a
          href={apiUrl("/api/download/latest")}
          data-testid="button-download-windows"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500"
        >
          <Download className="h-4 w-4" />
          Download for Windows
        </a>
        <p className="text-xs text-zinc-500">Windows 10 / 11. On your phone? Open this page on your Windows PC to install.</p>
      </section>
    </AppLayout>
  );
}
