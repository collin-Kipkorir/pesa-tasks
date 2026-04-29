import { useEffect, useMemo, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isAppInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(() => isAppInstalled());
  const reopenTimerRef = useRef<number | null>(null);

  const canShowPrompt = useMemo(
    () => !installed && visible && deferredPrompt !== null,
    [deferredPrompt, installed, visible],
  );

  function clearReopenTimer() {
    if (reopenTimerRef.current) {
      window.clearTimeout(reopenTimerRef.current);
      reopenTimerRef.current = null;
    }
  }

  function scheduleReopen() {
    clearReopenTimer();
    if (installed || !deferredPrompt) return;
    reopenTimerRef.current = window.setTimeout(() => {
      if (!isAppInstalled() && deferredPrompt) {
        setVisible(true);
      }
    }, 5000);
  }

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      if (isAppInstalled()) {
        setInstalled(true);
        setVisible(false);
        setDeferredPrompt(null);
        return;
      }
      setDeferredPrompt(promptEvent);
      setVisible(true);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
      setVisible(false);
      clearReopenTimer();
    }

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        onAppInstalled();
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    if (isAppInstalled()) {
      setInstalled(true);
      setVisible(false);
    }

    return () => {
      clearReopenTimer();
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;

    clearReopenTimer();
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        return;
      }

      setVisible(false);
      scheduleReopen();
    } catch (error) {
      console.error("Install prompt failed", error);
      setVisible(false);
      scheduleReopen();
    }
  }

  function handleDismiss() {
    setVisible(false);
    scheduleReopen();
  }

  if (!canShowPrompt) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-4">
      <div className="max-w-xs rounded-xl border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="text-lg">P</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Install Pesa Tasks</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the app to your device for faster access to surveys and payments.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs font-medium text-muted-foreground"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
