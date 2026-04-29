import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }

    function onAppInstalled() {
      setDeferredPrompt(null);
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled as any);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled as any);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  async function handleInstall() {
    try {
      // show the native prompt
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // hide UI regardless of choice
      setVisible(false);
      setDeferredPrompt(null);
      // optionally track choice
      console.log("PWA install choice:", choice);
    } catch (err) {
      console.error("Install prompt failed", err);
      setVisible(false);
      setDeferredPrompt(null);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-lg bg-white/95 px-4 py-2 shadow-md border">
        <div className="flex items-center gap-3">
          <div className="text-lg">📱</div>
          <div className="flex-1 text-sm">Install Pesa Tasks for quick access</div>
          <button
            onClick={handleInstall}
            className="ml-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Install
          </button>
          <button
            onClick={() => {
              setVisible(false);
            }}
            className="ml-2 text-xs text-muted-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
