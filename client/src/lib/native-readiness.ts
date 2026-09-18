import type { NativeStartupRestoreResult } from "@/lib/tauri-bridge";

const STORAGE_KEY = "optigods-native-restore-readiness";
let current: NativeStartupRestoreResult | null = null;
const listeners = new Set<() => void>();

function readStored(): NativeStartupRestoreResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as NativeStartupRestoreResult : null;
  } catch {
    return null;
  }
}

export function getNativeRestoreReadiness(): NativeStartupRestoreResult | null {
  return current ?? (current = readStored());
}

export function setNativeRestoreReadiness(value: NativeStartupRestoreResult | null): void {
  current = value;
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* persistence is best effort; Rust remains authoritative */ }
  listeners.forEach((listener) => listener());
}

export function subscribeNativeRestoreReadiness(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}