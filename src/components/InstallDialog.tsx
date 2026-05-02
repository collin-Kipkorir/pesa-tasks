import { useEffect, useState } from "react";

export default function InstallDialog() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    function onAppInstalled() {
      setInstalled(true);
      setVisible(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled as any);
    // if already installed (standalone)
    const isInstalled = typeof window !== "undefined" && (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
    if (isInstalled) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled as any);
    };
  }, []);

  if (installed || !visible) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        setInstalled(true);
        setVisible(false);
      } else {
        setVisible(false);
      }
    } catch (err) {
      console.error("install prompt failed", err);
      setVisible(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-lg">
        <div className="text-lg">📲</div>
        <div className="text-sm">Install Pesa Tasks for a better experience</div>
        <button onClick={handleInstall} className="ml-3 rounded bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">Install</button>
      </div>
    </div>
  );
}
