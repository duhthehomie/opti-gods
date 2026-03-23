import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Bell, Tag, Clock, Megaphone, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Announcement = {
  id: number;
  title: string;
  body: string;
  tag: string | null;
  createdAt: string;
};

const TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  update: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  hotfix: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  new: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  announcement: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
};

function TagBadge({ tag }: { tag: string }) {
  const s = TAG_STYLES[tag.toLowerCase()] ?? TAG_STYLES.update;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", s.bg, s.text, s.border)}>
      <Tag className="w-2.5 h-2.5" />
      {tag}
    </span>
  );
}

function AnnouncementCard({ ann, index }: { ann: Announcement; index: number }) {
  const date = new Date(ann.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      data-testid={`card-announcement-${ann.id}`}
      className="rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:border-white/10 hover:bg-white/[0.03] transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-red-500/10 shrink-0 mt-0.5">
          <Megaphone className="w-4 h-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-bold text-white text-sm leading-snug">{ann.title}</h3>
            {ann.tag && <TagBadge tag={ann.tag} />}
          </div>
          <div className="flex items-center gap-1 text-zinc-600 text-[10px]">
            <Clock className="w-3 h-3" />
            <span>{formatted}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap pl-11">{ann.body}</p>
    </motion.div>
  );
}

export default function Updates() {
  const { data: announcements = [], isLoading, isError } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="p-3 bg-zinc-900 rounded-lg border border-white/5">
            <Bell className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Live Updates</h1>
            <p className="text-zinc-500 text-sm">Latest announcements, patches, and tweaks from the Opti Gods team</p>
          </div>
        </motion.div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading announcements...</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Failed to load announcements. Try refreshing the page.
          </div>
        )}

        {!isLoading && !isError && announcements.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Bell className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">No announcements yet.</p>
            <p className="text-zinc-700 text-xs mt-1">Check back soon for updates, hotfixes, and new tweaks.</p>
          </motion.div>
        )}

        {!isLoading && announcements.length > 0 && (
          <div className="space-y-3">
            {announcements.map((ann, i) => (
              <AnnouncementCard key={ann.id} ann={ann} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
