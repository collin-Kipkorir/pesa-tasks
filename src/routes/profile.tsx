import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — Pesatask" }],
  }),
  component: ProfilePage,
});

const profile = {
  phone: "+254712345678",
  email: "Test@gmail.com",
  balance: "KES 1000",
  status: "Inactive",
  vip: "No",
};

const bonuses = [{ amount: "KES 1000", source: "Digital Pay Jobs KE", date: "Apr 2026" }];

function ProfilePage() {
  const [amount, setAmount] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <dl className="space-y-2 text-sm">
            <Row label="Phone:" value={profile.phone} />
            <Row label="Email:" value={profile.email} />
            <Row label="Balance:" value={profile.balance} />
            <Row label="Status:" value={profile.status} />
            <Row label="VIP:" value={profile.vip} />
          </dl>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Withdraw Funds</h2>
          <Input
            type="number"
            placeholder="Amount (KES)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-4"
          />
          <Button variant="hero" size="lg" className="mt-4 w-full">
            Withdraw
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Withdrawal History</h2>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No withdrawals yet.
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Bonuses</h2>
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-3 bg-muted/60 px-4 py-2 text-xs font-semibold">
              <span>Amount</span>
              <span className="text-center">Source</span>
              <span className="text-right">Date</span>
            </div>
            {bonuses.map((b, i) => (
              <div key={i} className="grid grid-cols-3 px-4 py-3 text-sm">
                <span>{b.amount}</span>
                <span className="text-center">{b.source}</span>
                <span className="text-right">{b.date}</span>
              </div>
            ))}
          </div>
        </section>

        <Button
          variant="hero"
          size="lg"
          className="w-full"
          onClick={() => navigate({ to: "/login" })}
        >
          Log Out
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
