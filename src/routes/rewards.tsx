import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/rewards")({
  head: () => ({ meta: [{ title: "Rewards — Pesatask" }] }),
  component: () => (
    <RequireAuth>
      <RewardsPage />
    </RequireAuth>
  ),
});

type RewardEntry = { amount: number; source: string; date: number; type: string };

function RewardsPage() {
  const { user } = useAuth();
  const rewards = Object.values((user?.rewards as Record<string, RewardEntry>) || {})
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.date - a.date);

  const today = new Date();
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dayKey = d.toISOString().slice(0, 10);
    const value = rewards
      .filter((r) => new Date(r.date).toISOString().slice(0, 10) === dayKey)
      .reduce((sum, r) => sum + r.amount, 0);
    return { day: d.toLocaleDateString("en-US", { weekday: "short" }), value };
  });

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Weekly Financial Overview</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="rewardsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.17 148)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.62 0.17 148)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "oklch(0.6 0.22 27)" }} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="oklch(0.5 0.15 145)"
                  strokeWidth={2}
                  fill="url(#rewardsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-center text-base font-bold">Rewards & Transactions</h2>
          <p className="mt-1 text-center text-muted-foreground">
            Total earned: KES {rewards.reduce((s, r) => s + r.amount, 0).toLocaleString()}
          </p>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-3 bg-muted/60 px-4 py-2 text-xs font-semibold">
              <span>Date</span>
              <span className="text-center">Description</span>
              <span className="text-right">Amount</span>
            </div>
            {rewards.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No rewards yet.</p>
            ) : (
              rewards.map((r, i) => (
                <div key={i} className="grid grid-cols-3 items-center px-4 py-3 text-sm">
                  <span>{new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  <span className="text-center">{r.source}</span>
                  <span className="text-right font-semibold text-primary">
                    +KES {r.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
