import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Wouter-based redirect. Preserves the current query string by default
 * so legacy routes like `/game-detection?games=...` keep their params after
 * being remapped to a new IA destination. Uses replace navigation so the
 * Back button skips over the deprecated route.
 */
export function Redirect({ to, preserveSearch = true }: { to: string; preserveSearch?: boolean }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const search = preserveSearch && typeof window !== "undefined" ? window.location.search : "";
    let target = to;
    if (search) {
      const [path, hash = ""] = to.split("#");
      target = path + search + (hash ? `#${hash}` : "");
    }
    setLocation(target, { replace: true });
  }, [to, preserveSearch, setLocation]);
  return null;
}
