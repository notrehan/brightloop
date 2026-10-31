"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export function ToastMessage({ message, type = "success" }: { message?: string; type?: "success" | "error" }) {
  const [visible, setVisible] = useState(Boolean(message));
  const dismiss = () => {
    setVisible(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(dismiss, 2800);
    return () => window.clearTimeout(timer);
  }, [message]);
  if (!message || !visible) return null;
  const Icon = type === "success" ? CheckCircle2 : XCircle;
  return <div className={`toast-message ${type}`} role={type === "error" ? "alert" : "status"} aria-live="polite"><Icon size={19}/><span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={dismiss}><X size={15}/></button></div>;
}
