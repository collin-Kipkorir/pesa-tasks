import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClipboardList, Smartphone, Star, Wallet } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Pesatask" }],
  }),
  component: Dashboard,
});

const tasks = [
  {
    icon: ClipboardList,
    title: "Quick consumer survey",
    reward: 50,
    time: "3 min",
  },
  { icon: Star, title: "Rate the Boda app", reward: 30, time: "2 min" },
  { icon: Smartphone, title: "Try a new banking offer", reward: 120, time: "5 min" },
  { icon: ClipboardList, title: "Mobile usage poll", reward: 40, time: "2 min" },
];

function Dashboard() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-bold text-primary-deep">
            Pesatask
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Log out
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Balance card */}
        <div
          className="rounded-2xl p-6 text-primary-foreground shadow-[var(--shadow-cta)]"
          style={{ background: "var(--gradient-cta)" }}
        >
          <p className="text-sm opacity-90">Available balance</p>
          <p className="mt-1 text-4xl font-bold">KES 240</p>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" className="gap-2">
              <Wallet className="h-4 w-4" />
              Withdraw to M-Pesa
            </Button>
          </div>
        </div>

        <h2 className="mt-8 text-lg font-semibold">Available tasks</h2>
        <div className="mt-3 space-y-3">
          {tasks.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-primary">+KES {t.reward}</span>
                <Button size="sm" variant="hero">
                  Start
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
