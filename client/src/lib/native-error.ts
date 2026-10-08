/** Tauri rejects Rust errors as strings, not necessarily JavaScript Errors. */
export function getNativeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    for (const key of ["message", "error", "detail"]) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return fallback;
}
