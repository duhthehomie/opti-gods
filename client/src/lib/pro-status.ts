const PRO_KEY = "optigods_pro_v1";

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
}
