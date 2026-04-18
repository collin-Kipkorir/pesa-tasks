import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Pesatask Paid Surveys" }],
  }),
  component: Dashboard,
});

type Task = {
  title: string;
  description: string;
  reward: number;
  duration: string;
  questions: number;
  icon: typeof Smartphone;
  locked?: boolean;
};

const tasks: Task[] = [
  {
    title: "Safaricom Services Quiz Part 1",
    description: "Survey your experience with Safaricom M-Pesa, airtime, and data bundles.",
    reward: 100,
    duration: "5 mins",
    questions: 15,
    icon: Smartphone,
  },
  {
    title: "Safaricom Services Quiz Part 2",
    description: "Continue rating Safaricom data, Fuliza and Hustler Fund experience.",
    reward: 150,
    duration: "6 mins",
    questions: 18,
    icon: Smartphone,
  },
  {
    title: "Mobile Banking Habits",
    description: "Tell us how you use mobile banking apps in Kenya.",
    reward: 200,
    duration: "8 mins",
    questions: 20,
    icon: Smartphone,
  },
  {
    title: "Electricity Connection Quiz",
    description: "Survey on rural electrification and KPLC new connections.",
    reward: 75,
    duration: "10 mins",
    questions: 9,
    icon: Zap,
    locked: true,
  },
  {
    title: "Internet & Data Survey",
    description: "Feedback on fiber internet, bundles, and providers.",
    reward: 100,
    duration: "14 mins",
    questions: 10,
    icon: Wifi,
    locked: true,
  },
  {
    title: "Women Empowerment Quiz",
    description: "Share your views on gender equality and women in business.",
    reward: 120,
    duration: "12 mins",
    questions: 11,
    icon: Lightbulb,
    locked: true,
  },
];

const payouts = [
  { name: "Daniel Kiptoo", amount: 12077 },
  { name: "Mary Wanjiku", amount: 8450 },
  { name: "James Otieno", amount: 15230 },
  { name: "Aisha Mohamed", amount: 6890 },
  { name: "Peter Kamau", amount: 22100 },
];

function LivePayoutTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % payouts.length), 3000);
    return () => clearInterval(t);
  }, []);
  const p = payouts[idx];
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
  const [unlockTask, setUnlockTask] = useState<Task | null>(null);

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
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
            to="/"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Wallet"
          >
            <Wallet className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {/* Activation banner with live payouts */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Your account needs activation to withdraw earnings</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                Live Payouts
              </div>
              <LivePayoutTicker />
              <Button variant="hero" size="sm">
                Activate Now
              </Button>
            </div>
          </div>
        </div>

        {/* Balance card */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm text-muted-foreground">Your Balance</p>
            <p className="mt-1 text-3xl font-bold">KES 1,000</p>
          </div>
          <Button variant="hero" size="lg">
            Withdraw
          </Button>
        </div>

        {/* Earn section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold">Earn Real Money</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete surveys & quizzes to earn up to KES 3,350 per task
          </p>
        </div>

        {/* Task cards */}
        <div className="mt-4 space-y-4">
          {tasks.map((t, i) => {
            const Icon = t.icon;
            return (
              <article
                key={i}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm"
              >
                <header
                  className="flex items-center gap-3 px-5 py-4 text-primary-foreground"
                  style={{ background: "var(--gradient-cta)" }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="flex-1 text-base font-semibold">{t.title}</h3>
                  {t.locked && (
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
                    <Stat label="Questions" value={String(t.questions)} />
                  </div>
                  {t.locked ? (
                    <button
                      onClick={() => setUnlockTask(t)}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[image:var(--gradient-vip)] text-base font-semibold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:brightness-110"
                    >
                      <Lock className="h-4 w-4" />
                      Unlock with VIP
                    </button>
                  ) : (
                    <Button variant="hero" size="lg" className="mt-4 w-full">
                      Start Task
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* VIP Unlock Dialog */}
      <Dialog open={!!unlockTask} onOpenChange={(o) => !o && setUnlockTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[image:var(--gradient-vip)] text-primary-foreground shadow-[var(--shadow-cta)]">
              <Crown className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center text-xl">Unlock VIP Surveys</DialogTitle>
            <DialogDescription className="text-center">
              Activate VIP to access <span className="font-semibold text-foreground">{unlockTask?.title}</span> and all premium high-paying surveys.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border bg-muted/40 p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Unlock all premium surveys instantly
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Earn up to KES 3,350 per task
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Instant M-Pesa withdrawals, no waiting
              </li>
            </ul>
            <div className="mt-4 flex items-end justify-between rounded-lg bg-card p-3">
              <div>
                <p className="text-xs text-muted-foreground">One-time activation</p>
                <p className="text-2xl font-bold">KES 250</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                Lifetime VIP
              </span>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[image:var(--gradient-vip)] text-base font-semibold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:brightness-110"
              onClick={() => setUnlockTask(null)}
            >
              <Lock className="h-4 w-4" />
              Pay KES 250 with M-Pesa
            </button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setUnlockTask(null)}
            >
              Maybe later
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
