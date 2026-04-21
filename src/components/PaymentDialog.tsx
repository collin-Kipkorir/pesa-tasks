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
  const [reference, setReference] = useState<string>("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(user?.phone || "");
      setStatus("idle");
      setMessage("");
      setReference("");
    }
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [open, user?.phone]);

  const purposeLabel = purpose === "activation" ? "Account Activation" : "VIP Unlock";

  const startPayment = async () => {
    if (!user) return;
    const normalized = normalizePhone(phone);
    if (!isValidKePhone(normalized)) {
      setMessage("Enter a valid Kenyan phone number.");
      return;
    }
    setStatus("sending");
    setMessage("Sending STK push to your phone...");
    try {
      const res = await fetch("/api/payhero/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          phone: normalized,
          purpose,
          userPhone: user.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus("failed");
        setMessage(data.error || "Failed to send STK push.");
        return;
      }
      setReference(data.reference);
      setStatus("waiting");
      setMessage("Check your phone and enter your M-Pesa PIN to complete payment.");
      // Poll status every 4s, up to ~2 minutes
      let attempts = 0;
      pollRef.current = window.setInterval(async () => {
        attempts += 1;
        try {
          const sres = await fetch(`/api/payhero/status?reference=${encodeURIComponent(data.reference)}`);
          const sdata = await sres.json();
          if (sdata.status === "SUCCESS") {
            window.clearInterval(pollRef.current!);
            if (purpose === "activation") await markActivated(user.phone);
            else await markVip(user.phone);
            setStatus("success");
            setMessage("Payment confirmed!");
            setTimeout(() => onOpenChange(false), 1800);
          } else if (sdata.status === "FAILED" || sdata.status === "CANCELLED") {
            window.clearInterval(pollRef.current!);
            setStatus("failed");
            setMessage(sdata.message || "Payment was not completed.");
          }
        } catch {
          // ignore transient errors
        }
        if (attempts > 30) {
          window.clearInterval(pollRef.current!);
          setStatus("failed");
          setMessage("Payment timed out. Please try again.");
        }
      }, 4000);
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
            {reference && (
              <p className="text-[11px] text-muted-foreground">Ref: {reference}</p>
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
