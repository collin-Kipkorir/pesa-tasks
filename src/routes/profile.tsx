import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { RequireAuth } from "@/components/RequireAuth";
import { PaymentDialog } from "@/components/PaymentDialog";
import { useAuth } from "@/lib/auth";
import { recordWithdrawal } from "@/lib/userdb";
import { ACTIVATION_FEE } from "@/lib/firebase";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Pesatask" }] }),
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});

function ProfilePage() {
  const { user, logout, isAdmin } = useAuth();
  const [amount, setAmount] = useState("");
  const [activateOpen, setActivateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const rewards = Object.values((user.rewards as Record<string, { amount: number; source: string; date: number; type: string }>) || {});
  const bonuses = rewards.filter((r) => r.type === "bonus");
  const withdrawals = Object.values((user.withdrawals as Record<string, { amount: number; date: number; status: string }>) || {})
    .sort((a, b) => b.date - a.date);

  const handleWithdraw = async () => {
    if (!user.activated) {
      setActivateOpen(true);
      return;
    }
    const amt = Number(amount);
    if (!amt || amt < 50) {
      toast.error("Enter at least KES 50.");
      return;
    }
    if (amt > user.balance) {
      toast.error("Insufficient balance.");
      return;
    }
    setSubmitting(true);
    try {
      await recordWithdrawal(user.phone, amt);
      toast.success(`Withdrawal request for KES ${amt} submitted.`);
      setAmount("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <dl className="space-y-2 text-sm">
            <Row label="Name:" value={user.name} />
            <Row label="Phone:" value={"+254" + user.phone.slice(1)} />
            <Row label="Email:" value={user.email || "—"} />
            <Row label="Balance:" value={`KES ${(user.balance || 0).toLocaleString()}`} />
            <Row label="Status:" value={user.activated ? "Active" : "Inactive"} />
            <Row label="VIP:" value={user.vip ? "Yes" : "No"} />
          </dl>
          {isAdmin && (
            <Link
              to="/admin"
              className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
            >
              → Admin Panel
            </Link>
          )}
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
          <Button
            variant="hero"
            size="lg"
            className="mt-4 w-full"
            onClick={handleWithdraw}
            disabled={submitting}
          >
            {submitting ? "Processing..." : "Withdraw"}
          </Button>
          {!user.activated && (
            <p className="mt-2 text-xs text-amber-700">
              Account not activated. KES {ACTIVATION_FEE} one-time fee required.
            </p>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Withdrawal History</h2>
          {withdrawals.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No withdrawals yet.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {withdrawals.map((w, i) => (
                <div key={i} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <span>{new Date(w.date).toLocaleDateString()}</span>
                  <span className="font-semibold">KES {w.amount.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-bold">Bonuses</h2>
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-3 bg-muted/60 px-4 py-2 text-xs font-semibold">
              <span>Amount</span>
              <span className="text-center">Source</span>
              <span className="text-right">Date</span>
            </div>
            {bonuses.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-muted-foreground">No bonuses.</p>
            ) : (
              bonuses.map((b, i) => (
                <div key={i} className="grid grid-cols-3 px-4 py-3 text-sm">
                  <span>KES {b.amount.toLocaleString()}</span>
                  <span className="text-center">{b.source}</span>
                  <span className="text-right">
                    {new Date(b.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <Button
          variant="hero"
          size="lg"
          className="w-full"
          onClick={() => {
            logout();
            navigate({ to: "/login" });
          }}
        >
          Log Out
        </Button>
      </main>

      <PaymentDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        purpose="activation"
        amount={ACTIVATION_FEE}
      />

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
