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

  const completed = (user?.completed || {}) as Record<string, unknown>;
  const startTask = (s: Survey) => {
    if (s.category === "vip" && !user?.vip) {
      setUnlockOpen(true);
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

        <div className="mt-8">
          <h2 className="text-2xl font-bold">Earn Real Money</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete surveys & quizzes to earn up to KES 3,350 per task
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading surveys...</p>}
          {surveys.map((t) => {
            const Icon = ICON_MAP[t.icon] || Smartphone;
            const isVipLocked = t.category === "vip" && !user?.vip;
            const isCompleted = !!completed[t.id];
            return (
              <article key={t.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <header
                  className="flex items-center gap-3 px-5 py-4 text-primary-foreground"
                  style={{ background: "var(--gradient-cta)" }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="flex-1 text-base font-semibold">{t.title}</h3>
                  {t.category === "vip" && (
                    <Crown
                      className="h-5 w-5 shrink-0 text-yellow-300 drop-shadow"
                      aria-label="VIP locked"
                    />
                  )}
                </header>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Stat label="Reward" value={`KES ${t.reward}`} />
                    <Stat label="Duration" value={t.duration} />
                    <Stat label="Questions" value={String(t.questions.length)} />
                  </div>
                  {isCompleted ? (
                    <div className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-muted text-sm font-semibold text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Completed
                    </div>
                  ) : isVipLocked ? (
                    <button
                      onClick={() => setUnlockOpen(true)}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[image:var(--gradient-vip)] text-base font-semibold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:brightness-110"
                    >
                      <Lock className="h-4 w-4" />
                      Unlock with VIP
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
