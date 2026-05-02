import { useEffect, useRef, useState } from "react";

async function track(event, meta = {}) {
  try {
    await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, meta }) });
  } catch (err) {
    // ignore
  }
}

export default function InstallDialog() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const startedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      // will show based on interaction + delay
    }
    function onAppInstalled() {
      setInstalled(true);
      setVisible(false);
      track("install", { outcome: "appinstalled" });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled as any);
    const isInstalled = typeof window !== "undefined" && (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    if (isInstalled) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled as any);
    };
  }, []);

  // show after user interacts and 10s delay
  useEffect(() => {
    function start() {
      if (startedRef.current) return;
      startedRef.current = true;
      timerRef.current = window.setTimeout(() => {
        // only show if browser fired beforeinstallprompt or it's iOS fallback
        if (deferredPrompt) {
          setVisible(true);
          track("impression", { source: "deferredPrompt" });
        } else {
          // for iOS, show subtle CTA
          setVisible(true);
          track("impression", { source: "fallback" });
        }
      }, 10000);
    }
    function onInteraction() { start(); }
    window.addEventListener("click", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction, { passive: true });
    window.addEventListener("touchstart", onInteraction, { passive: true });
    return () => {
      window.removeEventListener("click", onInteraction as any);
      window.removeEventListener("keydown", onInteraction as any);
      window.removeEventListener("touchstart", onInteraction as any);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [deferredPrompt]);

  if (installed || !visible) return null;

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  async function handleInstall() {
    track("accept", { platform: isIOS ? "ios" : "other" });
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          setInstalled(true);
          setVisible(false);
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }
    // iOS: open small instructions in a non-blocking way by toggling visible state briefly
    // We'll keep the CTA text short and simple
    alert("Open in Safari → Share → Add to Home Screen to install.");
  }

  function handleDismiss() {
    setVisible(false);
    track("dismiss", {});
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-white shadow-lg">
        <div className="text-lg">📲</div>
        <div className="text-sm font-semibold">Install Pesa Tasks</div>
        <button onClick={handleInstall} className="ml-3 rounded bg-white/10 px-3 py-1 text-sm font-semibold text-white">Install</button>
        <button onClick={handleDismiss} className="ml-2 text-sm opacity-90">×</button>
      </div>
    </div>
  );
}
