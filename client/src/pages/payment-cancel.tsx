import { useEffect } from "react";
import { useLocation } from "wouter";

export default function PaymentCancel() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => setLocation("/"), 100);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return null;
}
