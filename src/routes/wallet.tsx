import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet as WalletIcon, DollarSign, ArrowDown } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [{ title: "Wallet — Pesatask" }],
  }),
  component: WalletPage,
});

const weekly = [
  { day: "Mon", value: 0 },
  { day: "Tue", value: 0 },
  { day: "Wed", value: 0 },
  { day: "Thu", value: 200 },
  { day: "Fri", value: 1000 },
  { day: "Sat", value: 200 },
  { day: "Sun", value: 0 },
];

function WalletPage() {
  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-4">
          <WalletIcon className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold">Wallet</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Current Balance</h2>
          </div>
          <p className="mt-3 text-center text-2xl font-bold text-primary">
            KES 1,000
          </p>
          <Button variant="hero" size="lg" className="mt-4 w-full">
            <ArrowDown className="mr-2 h-4 w-4" />
            Withdraw Funds
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Weekly Financial Overview</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="walletFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.17 148)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.62 0.17 148)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "oklch(0.6 0.22 27)" }} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} ticks={[0, 250, 500, 750, 1000]} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="oklch(0.5 0.15 145)"
                  strokeWidth={2}
                  fill="url(#walletFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <p className="text-center text-sm text-muted-foreground">No transactions yet.</p>
      </main>

      <BottomNav />
    </div>
  );
}
