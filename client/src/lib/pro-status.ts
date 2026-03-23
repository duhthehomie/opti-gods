import { useState, useEffect } from "react";

const PRO_KEY = "optigods_pro_v1";
const PRO_EVENT = "optigods_pro_changed";

export function getProStatus(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PRO_KEY) === "true";
}

export function setProStatus(value: boolean): void {
  if (value) {
    localStorage.setItem(PRO_KEY, "true");
  } else {
    localStorage.removeItem(PRO_KEY);
  }
  window.dispatchEvent(new Event(PRO_EVENT));
}

export function useProStatus(): boolean {
  const [isPro, setIsPro] = useState(getProStatus);

  useEffect(() => {
    const update = () => setIsPro(getProStatus());
    window.addEventListener(PRO_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PRO_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return isPro;
}
