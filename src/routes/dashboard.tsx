import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Smartphone,
  Menu,
  Wallet,
  AlertTriangle,
  Crown,
  Zap,
  Wifi,
  Lightbulb,
  Lock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { RequireAuth } from "@/components/RequireAuth";
import { WelcomeBonusDialog } from "@/components/WelcomeBonusDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { useAuth } from "@/lib/auth";
import { useSurveys } from "@/lib/use-surveys";
import { ACTIVATION_FEE, VIP_FEE, DAILY_FREE_LIMIT, DAILY_VIP_LIMIT } from "@/lib/firebase";
import type { Survey } from "@/lib/surveys-seed";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pesatask Paid Surveys" }] }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

const ICON_MAP = {
  smartphone: Smartphone,
  zap: Zap,
  wifi: Wifi,
  lightbulb: Lightbulb,
} as const;

const fakePayouts = [
  { name: "Daniel Kiptoo", amount: 12077 },
  { name: "Mary Wanjiku", amount: 8450 },
  { name: "James Otieno", amount: 15230 },
  { name: "Aisha Mohamed", amount: 6890 },
  { name: "Peter Kamau", amount: 22100 },
];

function LivePayoutTicker() {
  const [idx, setIdx] = useState(0);
  // simple rotating ticker
  if (typeof window !== "undefined") {
    setTimeout(() => setIdx((i) => (i + 1) % fakePayouts.length), 3000);
  }
  const p = fakePayouts[idx];
  return (
    <div
      key={idx}
      className="rounded-lg px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm animate-in fade-in slide-in-from-right-2"
      style={{ background: "var(--gradient-cta)" }}
    >
      🎉 <span className="font-bold">{p.name}</span> got{" "}
      <span className="font-bold">KES {p.amount.toLocaleString()}</span> 💸 to M-Pesa
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { surveys, loading } = useSurveys();
  const navigate = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);

  const completed = (user?.completed || {}) as Record<string, { date?: number }>;

  // Count today's completions per category
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

  const startTask = (s: Survey) => {
    if (s.category === "vip" && !user?.vip) {
      setUnlockOpen(true);
      return;
    }
    if (dailyLimitHit) {
      toast.error(
        user?.vip
          ? `Daily limit reached: ${DAILY_VIP_LIMIT} surveys per day. Come back tomorrow!`
          : `Free users can complete ${DAILY_FREE_LIMIT} surveys per day. Unlock VIP for ${DAILY_VIP_LIMIT}/day.`,
      );
      return;
    }
    navigate({ to: "/task/$id", params: { id: s.id } });
  };

  const handleWithdraw = () => {
    if (!user?.activated) {
      setActivateOpen(true);
      return;
    }
    navigate({ to: "/profile" });
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-1.5 hover:bg-muted" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold leading-tight">Pesatask Paid Surveys</h1>
              <p className="text-[11px] text-muted-foreground">Earn instantly via M-Pesa</p>
            </div>
          </div>
          <Link
            to="/wallet"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Wallet"
          >
            <Wallet className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {/* Always-visible Live Payouts ticker */}
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              Live Payouts
            </div>
            <div className="flex-1 min-w-[180px]">
              <LivePayoutTicker />
            </div>
          </div>
        </div>

        {!user?.activated && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Your account needs activation to withdraw earnings</span>
            </div>
            <Button
              variant="hero"
              size="sm"
              className="ml-auto"
              onClick={() => setActivateOpen(true)}
            >
              Activate Now
            </Button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm text-muted-foreground">Your Balance</p>
            <p className="mt-1 text-3xl font-bold">KES {(user?.balance || 0).toLocaleString()}</p>
          </div>
          <Button variant="hero" size="lg" onClick={handleWithdraw}>
            Withdraw
          </Button>
        </div>

        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Earn Real Money</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete surveys & quizzes to earn up to KES 3,350 per task
            </p>
          </div>
          <div className="shrink-0 rounded-full border bg-card px-3 py-1 text-[11px] font-semibold">
            <span className={dailyLimitHit ? "text-destructive" : "text-foreground"}>
              {todayCount}/{dailyLimit}
            </span>
            <span className="ml-1 text-muted-foreground">today</span>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading surveys...</p>}
          {surveys.map((t) => {
            const Icon = ICON_MAP[t.icon] || Smartphone;
            const isVip = t.category === "vip";
            const isVipLocked = isVip && !user?.vip;
            const isCompleted = !!completed[t.id];
            return (
              <article
                key={t.id}
                className={
                  isVip
                    ? "relative overflow-hidden rounded-2xl border border-[color:var(--vip-gold)]/40 shadow-[var(--shadow-vip)]"
                    : "overflow-hidden rounded-2xl border bg-card shadow-sm"
                }
                style={isVip ? { background: "var(--gradient-vip-premium)" } : undefined}
              >
                {isVip && (
                  <>
                    {/* Subtle gold shimmer overlay */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-30"
                      style={{
                        background:
                          "radial-gradient(80% 60% at 100% 0%, color-mix(in oklab, var(--vip-gold) 35%, transparent), transparent 60%)",
                      }}
                    />
                    {/* Gold top border */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-[2px]"
                      style={{ background: "var(--gradient-vip-gold)" }}
                    />
                  </>
                )}

                <header
                  className={`relative flex items-center gap-3 px-5 py-4 ${
                    isVip ? "text-white" : "text-primary-foreground"
                  }`}
                  style={
                    isVip ? undefined : { background: "var(--gradient-cta)" }
                  }
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isVip ? "" : "bg-white/20"
                    }`}
                    style={
                      isVip
                        ? { background: "var(--gradient-vip-gold)", boxShadow: "0 4px 12px -2px color-mix(in oklab, var(--vip-gold) 50%, transparent)" }
                        : undefined
                    }
                  >
                    <Icon className={`h-5 w-5 ${isVip ? "text-[color:var(--vip-bg-2)]" : ""}`} />
                  </div>
                  <h3 className="flex-1 text-base font-semibold">{t.title}</h3>
                  {isVip && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--vip-bg-2)]"
                      style={{ background: "var(--gradient-vip-gold)" }}
                    >
                      <Crown className="h-3 w-3" /> VIP
                    </span>
                  )}
                </header>

                <div className={`relative p-5 ${isVip ? "" : ""}`}>
                  <p className={`text-sm ${isVip ? "text-white/80" : "text-muted-foreground"}`}>
                    {t.description}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Stat label="Reward" value={`KES ${t.reward}`} premium={isVip} />
                    <Stat label="Duration" value={t.duration} premium={isVip} />
                    <Stat label="Questions" value={String(t.questions.length)} premium={isVip} />
                  </div>
                  {isCompleted ? (
                    <div className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold ${
                      isVip ? "bg-white/10 text-white/80" : "bg-muted text-muted-foreground"
                    }`}>
                      <CheckCircle2 className={`h-4 w-4 ${isVip ? "text-[color:var(--vip-gold)]" : "text-primary"}`} /> Completed
                    </div>
                  ) : isVipLocked ? (
                    <button
                      onClick={() => setUnlockOpen(true)}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-bold text-[color:var(--vip-bg-2)] shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--vip-gold)_60%,transparent)] transition-all hover:brightness-110"
                      style={{ background: "var(--gradient-vip-gold)" }}
                    >
                      <Lock className="h-4 w-4" />
                      Unlock with VIP
                    </button>
                  ) : isVip ? (
                    <button
                      onClick={() => startTask(t)}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-bold text-[color:var(--vip-bg-2)] shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--vip-gold)_60%,transparent)] transition-all hover:brightness-110"
                      style={{ background: "var(--gradient-vip-gold)" }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Start Premium Task
                    </button>
                  ) : (
                    <Button
                      variant="hero"
                      size="lg"
                      className="mt-4 w-full"
                      onClick={() => startTask(t)}
                    >
                      Start Task
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <PaymentDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        purpose="activation"
        amount={ACTIVATION_FEE}
      />
      <PaymentDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        purpose="vip"
        amount={VIP_FEE}
      />

      <WelcomeBonusDialog />
      <BottomNav />
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
