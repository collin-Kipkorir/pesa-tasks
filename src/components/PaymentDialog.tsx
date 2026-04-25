import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isValidKePhone, normalizePhone } from "@/lib/phone";
import { markActivated, markVip } from "@/lib/userdb";
import { subscribePayment, type PaymentRecord } from "@/lib/payments-db";

type Purpose = "activation" | "vip";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purpose: Purpose;
  amount: number;
}

type Status = "idle" | "sending" | "waiting" | "success" | "failed";

export function PaymentDialog({ open, onOpenChange, purpose, amount }: Props) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const unsubRef = useRef<null | (() => void)>(null);
  const failsafeRef = useRef<number | null>(null);
  const handledRef = useRef(false);

  function cleanup() {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (failsafeRef.current) {
      window.clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
  }

  useEffect(() => {
    if (open) {
      setPhone(user?.phone || "");
      setStatus("idle");
      setMessage("");
      setPaymentId("");
      setReference("");
      handledRef.current = false;
    }
    return () => cleanup();
  }, [open, user?.phone]);

  const purposeLabel = purpose === "activation" ? "Account Activation" : "VIP Unlock";

  async function handleTerminal(rec: PaymentRecord) {
    if (handledRef.current) return;
    if (rec.status === "SUCCESS") {
      handledRef.current = true;
      cleanup();
      // Only unlock after confirmed M-Pesa success.
      if (user) {
        if (purpose === "activation") await markActivated(user.phone);
        else await markVip(user.phone);
      }
      setStatus("success");
      setMessage(
        rec.MpesaReceiptNumber
          ? `Payment confirmed (${rec.MpesaReceiptNumber})`
          : "M-Pesa payment confirmed!",
      );
      setTimeout(() => onOpenChange(false), 1800);
    } else if (rec.status === "FAILED" || rec.status === "CANCELLED") {
      handledRef.current = true;
      cleanup();
      setStatus("failed");
      setMessage(rec.resultDesc || "Payment was not completed on M-Pesa.");
    }
  }

  // Failsafe: if no realtime callback updates within 12s, poll status API
  function startFailsafe(pid: string, ref: string) {
    let attempts = 0;
    const tick = async () => {
      if (handledRef.current) return;
      attempts += 1;
      try {
  const qs = new URLSearchParams({ paymentId: pid });
  if (ref) qs.set("reference", ref);
  const res = await fetch(`/api/status?${qs.toString()}`);
        const data = (await res.json()) as { status: string; message?: string };
        if (data.status === "SUCCESS" || data.status === "FAILED" || data.status === "CANCELLED") {
          // The status route persists terminal state to RTDB, so the realtime
          // listener will fire handleTerminal. Nothing else to do.
          return;
        }
      } catch {
        // ignore
      }
      if (attempts < 30 && !handledRef.current) {
        failsafeRef.current = window.setTimeout(tick, 5000);
      } else if (!handledRef.current) {
        setStatus("failed");
        setMessage("Payment confirmation timed out. If you completed it, retry in a moment.");
      }
    };
    failsafeRef.current = window.setTimeout(tick, 12000);
  }

  const startPayment = async () => {
    if (!user) return;
    const normalized = normalizePhone(phone);
    if (!isValidKePhone(normalized)) {
      setMessage("Enter a valid Kenyan phone number.");
      return;
    }
    setStatus("sending");
    setMessage("Sending STK push to your phone...");
    handledRef.current = false;
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          phone: normalized,
          purpose,
          userPhone: user.phone,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        paymentId?: string;
        reference?: string;
        error?: string;
      };
      if (!res.ok || !data.success || !data.paymentId) {
        setStatus("failed");
        setMessage(data.error || "Failed to send STK push.");
        return;
      }
      setPaymentId(data.paymentId);
      setReference(data.reference || "");
      setStatus("waiting");
      setMessage("Check your phone and enter your M-Pesa PIN to authorize the payment.");

      // Realtime: subscribe to the payment node — UI updates instantly on callback.
      unsubRef.current = subscribePayment(data.paymentId, (rec) => {
        if (rec) void handleTerminal(rec);
      });

      // Failsafe in case the callback never fires.
      startFailsafe(data.paymentId, data.reference || "");
    } catch (e) {
      setStatus("failed");
      setMessage(e instanceof Error ? e.message : "Network error.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (status === "waiting" ? null : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[image:var(--gradient-cta)] text-primary-foreground shadow-[var(--shadow-cta)]">
            <Smartphone className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-xl">{purposeLabel}</DialogTitle>
          <DialogDescription className="text-center">
            Pay <span className="font-semibold text-foreground">KES {amount}</span> via M-Pesa STK Push
          </DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground">M-Pesa Phone Number</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712345678"
              type="tel"
              inputMode="tel"
              maxLength={13}
            />
            {message && <p className="text-xs text-destructive">{message}</p>}
            <Button variant="hero" size="lg" className="w-full" onClick={startPayment}>
              Pay KES {amount} with M-Pesa
            </Button>
          </div>
        )}

        {(status === "sending" || status === "waiting") && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">{message}</p>
            {(paymentId || reference) && (
              <p className="text-[11px] text-muted-foreground">
                Ref: {reference || paymentId}
              </p>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary animate-in zoom-in" />
            <p className="text-sm font-semibold">{message}</p>
          </div>
        )}

        {status === "failed" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm">{message}</p>
            <Button variant="outline" onClick={() => setStatus("idle")}>
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
