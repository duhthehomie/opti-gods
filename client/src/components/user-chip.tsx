import { useAuth, useLogout } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";

export function UserChip() {
  const { user } = useAuth();
  const logout = useLogout();

  if (!user) return null;
  const display = user.globalName || user.username;
  const initial = (display || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="button-user-chip"
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-colors"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={display}
              className="w-7 h-7 rounded-full object-cover"
              data-testid="img-user-avatar"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center text-[11px] font-bold text-white">
              {initial}
            </div>
          )}
          <span
            data-testid="text-user-name"
            className="text-xs font-semibold text-zinc-200 max-w-[120px] truncate hidden sm:inline"
          >
            {display}
          </span>
          <ChevronDown className="w-3 h-3 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-zinc-950 border-white/10 text-zinc-200"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{display}</p>
            <p className="text-[10px] text-zinc-500 truncate">@{user.username}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        <DropdownMenuItem
          data-testid="button-logout"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          {logout.isPending ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
