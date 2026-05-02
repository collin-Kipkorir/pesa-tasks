import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Smartphone, Wallet, AlertTriangle, Crown, Zap, Wifi, Lightbulb, Lock, CheckCircle2, Sparkles,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { RequireAuth } from "@/components/RequireAuth";
import { WelcomeBonusDialog } from "@/components/WelcomeBonusDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { useAuth } from "@/lib/auth";
import { useSurveys } from "@/lib/use-surveys";
import { ACTIVATION_FEE, VIP_FEE, DAILY_FREE_LIMIT, DAILY_VIP_LIMIT } from "@/lib/firebase";
import type { Survey } from "@/lib/surveys-seed";
import { useMemo } from "react";
import { toast } from "sonner";

const DUMMY_NAMES = [
  "Mary Wanjiku","John Mwangi","Daniel Kiptoo","James Otieno","Aisha Mohamed","Peter Kamau","Esther Njoki","Samuel Kiplagat","Grace Njeri","Michael Ouma","Alice Wanjiru","David Mutua","Susan Achieng","Paul Kiprono","Ruth Wambui","Kevin Mworia","Lilian Chebet","Mark Kipkorir","Faith Onyango","Benjamin Kibet","Rose Atieno","Victor Mwaura","Joan Njeri","Stephen Korir","Linda Kibet","Tom Omoding","Cynthia Wairimu","Eric Ndegwa","Nancy Chepkemoi","Peter Njenga",
];

function generateDummyPayouts(count = 30) {
  // produce up to `count` unique payouts by sampling DUMMY_NAMES without replacement
  const names = [...DUMMY_NAMES];
  // shuffle names
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  const take = Math.min(count, names.length);
  const arr: Array<{ name: string; amount: number }> = [];
  for (let i = 0; i < take; i++) {
    const name = names[i];
    const amount = Math.floor(5000 + Math.random() * 20000);
    arr.push({ name, amount });
  }
  return arr;
}

const ICON_MAP = { smartphone: Smartphone, zap: Zap, wifi: Wifi, lightbulb: Lightbulb } as const;

const fakePayouts = [
  { name: "Daniel Kiptoo", amount: 12077 },
  { name: "Mary Wanjiku", amount: 8450 },
  { name: "James Otieno", amount: 15230 },
  { name: "Aisha Mohamed", amount: 6890 },
  { name: "Peter Kamau", amount: 22100 },
];

import { useEffect, useRef } from "react";

function LivePayoutTicker() {
  const [items, setItems] = useState<Array<{ name: string; amount: number }>>(fakePayouts);
  const [dummy] = useState(() => generateDummyPayouts(30));
  useEffect(() => setItems(dummy), [dummy]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % Math.max(1, items.length)), 3000);
    return () => clearInterval(t);
  }, [items]);

  const p = items[idx] || dummy[0] || fakePayouts[0];
  // no per-tick floating toast: ticker text itself is sufficient

  return (
    <div key={idx} className="rounded-lg px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm animate-in fade-in slide-in-from-right-2" style={{ background: "var(--gradient-cta)" }}>
      🎉 <span className="font-bold">{p.name}</span> got <span className="font-bold">KES {p.amount.toLocaleString()}</span> 💸 to M-Pesa
    </div>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const { surveys, loading } = useSurveys();
  const navigate = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);

  const completed = (user?.completed || {}) as Record<string, { date?: number }>;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dayStart = startOfDay.getTime();
  let freeToday = 0;
  let vipToday = 0;
  for (const s of surveys) {
    const c = completed[s.id];
    if (!c?.date || c.date < dayStart) continue;
    if (s.category === "vip") vipToday += 1;
    else freeToday += 1;
  }
  const dailyLimit = user?.vip ? DAILY_VIP_LIMIT : DAILY_FREE_LIMIT;
  const todayCount = user?.vip ? vipToday + freeToday : freeToday;
  const dailyLimitHit = todayCount >= dailyLimit;

  // shuffle surveys on each page load and place completed surveys at the end
  const shuffledSurveys = useMemo(() => {
    const arr = [...surveys];
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // stable partition: incomplete first, completed at the end
    const incomplete: Survey[] = [];
    const completedList: Survey[] = [];
    for (const s of arr) {
      if (completed[s.id]) completedList.push(s);
      else incomplete.push(s);
    }
    return [...incomplete, ...completedList];
  }, [surveys, completed]);

  const startTask = (s: Survey) => {
    if (s.category === "vip" && !user?.vip) { setUnlockOpen(true); return; }
    if (dailyLimitHit) {
      toast.error(user?.vip ? `Daily limit reached: ${DAILY_VIP_LIMIT} surveys per day. Come back tomorrow!` : `Free users can complete ${DAILY_FREE_LIMIT} surveys per day. Unlock VIP for ${DAILY_VIP_LIMIT}/day.`);
      return;
    }
    navigate(`/task/${s.id}`);
  };

  const handleWithdraw = () => {
    if (!user?.activated) { setActivateOpen(true); return; }
    navigate("/profile");
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-bold leading-tight">Pesa Task Paid Surveys</h1>
              <p className="text-[11px] text-muted-foreground">Earn instantly via M-Pesa</p>
            </div>
          </div>
          <Link to="/wallet" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Wallet">
            <Wallet className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              Live Payouts
            </div>
            <div className="flex-1 min-w-[180px]"><LivePayoutTicker /></div>
          </div>
        </div>

        {!user?.activated && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Your account needs activation to withdraw earnings</span>
            </div>
            <Button variant="hero" size="sm" className="ml-auto" onClick={() => setActivateOpen(true)}>Activate Now</Button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm text-muted-foreground">Your Balance</p>
            <p className="mt-1 text-3xl font-bold">KES {(user?.balance || 0).toLocaleString()}</p>
          </div>
          <Button variant="hero" size="lg" onClick={handleWithdraw}>Withdraw</Button>
        </div>

        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Earn Real Money</h2>
            <p className="mt-1 text-sm text-muted-foreground">Complete surveys & quizzes to earn up to KES 3,350 per task</p>
          </div>
          <div className="shrink-0 rounded-full border bg-card px-3 py-1 text-[11px] font-semibold">
            <span className={dailyLimitHit ? "text-destructive" : "text-foreground"}>{todayCount}/{dailyLimit}</span>
            <span className="ml-1 text-muted-foreground">today</span>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading surveys...</p>}
          {shuffledSurveys.map((t) => {
            const Icon = ICON_MAP[t.icon] || Smartphone;
            const isVip = t.category === "vip";
            const isVipLocked = isVip && !user?.vip;
            const isCompleted = !!completed[t.id];
            return (
              <article key={t.id} className={isVip ? "relative overflow-hidden rounded-2xl border border-[color:var(--vip-gold)]/40 shadow-[var(--shadow-vip)]" : "overflow-hidden rounded-2xl border bg-card shadow-sm"} style={isVip ? { background: "var(--gradient-vip-premium)" } : undefined}>
                {isVip && (
                  <>
                    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(80% 60% at 100% 0%, color-mix(in oklab, var(--vip-gold) 35%, transparent), transparent 60%)" }} />
                    <div aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "var(--gradient-vip-gold)" }} />
                  </>
                )}
                <header className={`relative flex items-center gap-3 px-5 py-4 ${isVip ? "text-white" : "text-primary-foreground"}`} style={isVip ? undefined : { background: "var(--gradient-cta)" }}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isVip ? "" : "bg-white/20"}`} style={isVip ? { background: "var(--gradient-vip-gold)", boxShadow: "0 4px 12px -2px color-mix(in oklab, var(--vip-gold) 50%, transparent)" } : undefined}>
                    <Icon className={`h-5 w-5 ${isVip ? "text-[color:var(--vip-bg-2)]" : ""}`} />
                  </div>
                  <h3 className="flex-1 text-base font-semibold">{t.title}</h3>
                  {isVip && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--vip-bg-2)]" style={{ background: "var(--gradient-vip-gold)" }}>
                      <Crown className="h-3 w-3" /> VIP
                    </span>
                  )}
                </header>

                <div className="relative p-5">
                  <p className={`text-sm ${isVip ? "text-white/80" : "text-muted-foreground"}`}>{t.description}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Stat label="Reward" value={`KES ${t.reward}`} premium={isVip} />
                    <Stat label="Duration" value={t.duration} premium={isVip} />
                    <Stat label="Questions" value={String(t.questions.length)} premium={isVip} />
                  </div>
                  {isCompleted ? (
                    <div className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold ${isVip ? "bg-white/10 text-white/80" : "bg-muted text-muted-foreground"}`}>
                      <CheckCircle2 className={`h-4 w-4 ${isVip ? "text-[color:var(--vip-gold)]" : "text-primary"}`} /> Completed
                    </div>
                  ) : isVipLocked ? (
                    <button onClick={() => setUnlockOpen(true)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-bold text-[color:var(--vip-bg-2)] shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--vip-gold)_60%,transparent)] transition-all hover:brightness-110" style={{ background: "var(--gradient-vip-gold)" }}>
                      <Lock className="h-4 w-4" />Unlock with VIP
                    </button>
                  ) : isVip ? (
                    <button onClick={() => startTask(t)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-bold text-[color:var(--vip-bg-2)] shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--vip-gold)_60%,transparent)] transition-all hover:brightness-110" style={{ background: "var(--gradient-vip-gold)" }}>
                      <Sparkles className="h-4 w-4" />Start Premium Task
                    </button>
                  ) : (
                    <Button variant="hero" size="lg" className="mt-4 w-full" onClick={() => startTask(t)}>Start Task</Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <PaymentDialog open={activateOpen} onOpenChange={setActivateOpen} purpose="activation" amount={ACTIVATION_FEE} />
      <PaymentDialog open={unlockOpen} onOpenChange={setUnlockOpen} purpose="vip" amount={VIP_FEE} />
      <DashboardInstallDialog />
      <WelcomeBonusDialog />
      <BottomNav />
    </div>
  );
}

function DashboardInstallDialog() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [lastDismissed, setLastDismissed] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem("pwa-install-last-dismissed");
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });
  const [accepted, setAccepted] = useState(false);
  const reShowTimer = useRef<number | null>(null);
  const initialTimer = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onAppInstalled() {
      setAccepted(true);
      setVisible(false);
      try { localStorage.removeItem("pwa-install-last-dismissed"); } catch {}
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled as any);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled as any);
    };
  }, []);

  const isInstalled = typeof window !== "undefined" && (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

  // Start the initial 10s countdown on first interaction (only if not installed/accepted)
  useEffect(() => {
    if (accepted || isInstalled) return;

    function startCountdown() {
      if (startedRef.current) return;
      startedRef.current = true;
      // don't start if a dismissal timer exists and hasn't elapsed
      if (lastDismissed && Date.now() - lastDismissed < 20000) return;
      initialTimer.current = window.setTimeout(() => setVisible(true), 10000);
    }

    function onInteraction() {
      startCountdown();
    }

    window.addEventListener("click", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction, { passive: true });
    window.addEventListener("touchstart", onInteraction, { passive: true });

    return () => {
      window.removeEventListener("click", onInteraction as any);
      window.removeEventListener("keydown", onInteraction as any);
      window.removeEventListener("touchstart", onInteraction as any);
      if (initialTimer.current) window.clearTimeout(initialTimer.current);
    };
  }, [accepted, isInstalled, lastDismissed]);

  // If there's a lastDismissed timestamp, schedule re-show after 20s
  useEffect(() => {
    if (accepted || isInstalled) return;
    if (!lastDismissed) return;
    const elapsed = Date.now() - lastDismissed;
    const remaining = Math.max(0, 20000 - elapsed);
    if (reShowTimer.current) window.clearTimeout(reShowTimer.current);
    reShowTimer.current = window.setTimeout(() => {
      setVisible(true);
    }, remaining);
    return () => { if (reShowTimer.current) window.clearTimeout(reShowTimer.current); };
  }, [lastDismissed, accepted, isInstalled]);

  if (accepted || isInstalled || !visible) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          setAccepted(true);
          try { localStorage.removeItem("pwa-install-last-dismissed"); } catch {}
        }
        console.log("Install choice", choice);
      } catch (err) {
        console.error("Install prompt error", err);
      }
    } else {
      // iOS fallback: show small friendly instructions
      alert("To install Pesa Tasks on iPhone: open this site in Safari, then tap Share → 'Add to Home Screen'.");
    }
    setVisible(false);
  }

  function handleClose() {
    setVisible(false);
    const ts = Date.now();
    setLastDismissed(ts);
    try { localStorage.setItem("pwa-install-last-dismissed", String(ts)); } catch {}
    // schedule re-show after 20s (handled by effect watching lastDismissed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📲</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">Install Pesa Tasks?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Install the app for faster access, offline-like experience and instant launches.</p>
            <div className="mt-4 flex gap-3">
              <button onClick={handleInstall} className="inline-flex items-center rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Install</button>
              <button onClick={handleClose} className="inline-flex items-center rounded px-3 py-2 text-sm text-muted-foreground">Maybe later</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, premium = false }: { label: string; value: string; premium?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${premium ? "bg-white/10 text-white" : "bg-muted/60"}`}>
      <p className={`text-[11px] ${premium ? "text-white/60" : "text-muted-foreground"}`}>{label}</p>
      <p className={`text-sm font-bold ${premium ? "text-[color:var(--vip-gold)]" : ""}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  return <RequireAuth><DashboardInner /></RequireAuth>;
}
