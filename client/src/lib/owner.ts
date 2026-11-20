import { useAuth } from "@/hooks/use-auth";

/** Discord usernames of the Opti Gods owner. Owner-only tabs show for these accounts. */
const OWNER_USERNAMES = new Set(["my1ik"]);

function hasAdminSession(): boolean {
  try { return !!sessionStorage.getItem("optigods_admin_session"); } catch { return false; }
}

/**
 * True for the owner's Discord account (as confirmed by the server, not the
 * cached desktop identity) or while the admin key is unlocked this session.
 */
export function useIsOwner(): boolean {
  const { confirmedUsername } = useAuth();
  if (confirmedUsername && OWNER_USERNAMES.has(confirmedUsername.toLowerCase())) return true;
  return hasAdminSession();
}
