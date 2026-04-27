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
import {
  Loader2,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isValidKePhone, normalizePhone } from "@/lib/phone";
import { markActivated, markVip } from "@/lib/userdb";
import {
  subscribePayment,
  type PaymentRecord,
  type PaymentStatus,
} from "@/lib/payments-db";
import { cn } from "@/lib/utils";

type Purpose = "activation" | "vip";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purpose: Purpose;
  amount: number;
}

// UI status state (richer than the DB enum so we can show staged progress)
type Status =
  | "idle"
  | "sending" // calling /api/payhero/initiate
  | "pending" // STK queued, waiting for user to see prompt
  | "in_progress" // user has the prompt / entering PIN
  | "success"
  | "failed";

const STAGES: { key: Exclude<Status, "idle" | "failed">; label: string; icon: React.ElementType }[] = [
  { key: "sending", label: "Sending STK", icon: Send },
  { key: "pending", label: "Awaiting prompt", icon: Clock },
  { key: "in_progress", label: "Confirming", icon: ShieldCheck },
  { key: "success", label: "Done", icon: CheckCircle2 },
];

function stageIndex(s: Status): number {
  const i = STAGES.findIndex((x) => x.key === s);
  return i === -1 ? -1 : i;
}

// Single source of truth: RTDB PaymentStatus → UI Status.
// PENDING        → "pending"      (record created, STK not yet acknowledged)
// QUEUED         → "in_progress"  (STK push delivered, prompt on phone)
// PROCESSING     → "in_progress"  (user entering PIN / awaiting M-Pesa)
// SUCCESS        → "success"
// FAILED|CANCEL  → "failed"
function mapRtdbStatus(s: PaymentStatus): Status {
  switch (s) {
    case "PENDING":
      return "pending";
    case "QUEUED":
    case "PROCESSING":
      return "in_progress";
    case "SUCCESS":
      return "success";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    default:
      return "pending";
  }
}

function messageFor(s: PaymentStatus): string {
  switch (s) {
    case "PENDING":
      return "Sending STK push to your phone…";
    case "QUEUED":
      return "STK push delivered. Check your phone for the M-Pesa prompt.";
    case "PROCESSING":
      return "Enter your M-Pesa PIN to authorize the payment.";
    case "SUCCESS":
      return "M-Pesa payment confirmed!";
    case "FAILED":
      return "Payment failed.";
    case "CANCELLED":
      return "You cancelled the M-Pesa prompt.";
    default:
      return "";
  }
}

export function PaymentDialog({ open, onOpenChange, purpose, amount }: Props) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [errorHint, setErrorHint] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const unsubRef = useRef<null | (() => void)>(null);
  const failsafeRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
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
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  useEffect(() => {
    if (open) {
      setPhone(user?.phone || "");
      setStatus("idle");
      setMessage("");
      setErrorHint("");
      setPaymentId("");
      setReference("");
      setElapsed(0);
      handledRef.current = false;
    }
    return () => cleanup();
  }, [open, user?.phone]);

  const purposeLabel = purpose === "activation" ? "Account Activation" : "VIP Unlock";
  const isLocked = status === "sending" || status === "pending" || status === "in_progress";

  // Single handler driven entirely by the RTDB record. Maps every PaymentStatus
  // value into the corresponding UI stage — no client-side timers required.
  async function handleRecord(rec: PaymentRecord) {
    if (handledRef.current) return;

    const uiStatus = mapRtdbStatus(rec.status);

    // Non-terminal: just sync stage + message and keep listening.
    if (uiStatus === "pending" || uiStatus === "in_progress") {
      setStatus(uiStatus);
      setMessage(messageFor(rec.status));
      setErrorHint("");
      return;
    }

    // Terminal: success
    if (uiStatus === "success") {
      handledRef.current = true;
      cleanup();
      if (user) {
        if (purpose === "activation") await markActivated(user.phone);
        else await markVip(user.phone);
      }
      setStatus("success");
      setMessage(
        rec.MpesaReceiptNumber
          ? `Payment confirmed • Receipt ${rec.MpesaReceiptNumber}`
          : "M-Pesa payment confirmed!",
      );
      setErrorHint("");
      setTimeout(() => onOpenChange(false), 2000);
      return;
    }

    // Terminal: failed / cancelled — derive a friendlier message.
    handledRef.current = true;
    cleanup();
    setStatus("failed");
    const desc = (rec.resultDesc || "").toLowerCase();
    if (rec.status === "CANCELLED" || desc.includes("cancel")) {
      setMessage("You cancelled the M-Pesa prompt.");
      setErrorHint("Tap Try Again and approve the prompt with your M-Pesa PIN.");
    } else if (desc.includes("insufficient") || desc.includes("balance")) {
      setMessage("Insufficient M-Pesa balance.");
      setErrorHint("Top up your M-Pesa, then try again.");
    } else if (desc.includes("timeout") || desc.includes("expire")) {
      setMessage("The STK prompt timed out.");
      setErrorHint("Make sure your phone is on and unlocked, then retry.");
    } else if (desc.includes("wrong") || desc.includes("pin")) {
      setMessage("Incorrect M-Pesa PIN.");
      setErrorHint("Try again and enter the correct PIN.");
    } else {
      setMessage(rec.resultDesc || "Payment was not completed on M-Pesa.");
      setErrorHint("Check your phone and try again.");
    }
  }

  // Failsafe: poll status if no realtime update within 12s
  function startFailsafe(pid: string, ref: string) {
    let attempts = 0;
    const tick = async () => {
      if (handledRef.current) return;
      attempts += 1;
      try {
        const qs = new URLSearchParams({ paymentId: pid });
        if (ref) qs.set("reference", ref);
        const res = await fetch(`/api/payhero/status?${qs.toString()}`);
        const data = (await res.json()) as { status: string; message?: string };
        if (data.status === "SUCCESS" || data.status === "FAILED" || data.status === "CANCELLED") {
          return;
        }
      } catch {
        // ignore
      }
      if (attempts < 30 && !handledRef.current) {
        failsafeRef.current = window.setTimeout(tick, 5000);
      } else if (!handledRef.current) {
        cleanup();
        setStatus("failed");
        setMessage("Payment confirmation timed out.");
        setErrorHint(
          "If your M-Pesa was charged, contact support with the reference below.",
        );
      }
    };
    failsafeRef.current = window.setTimeout(tick, 12000);
  }

  function startTicker() {
    setElapsed(0);
    tickerRef.current = window.setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }

  const startPayment = async () => {
    if (!user) return;
    const normalized = normalizePhone(phone);
    if (!isValidKePhone(normalized)) {
      setErrorHint("");
      setMessage("Enter a valid Kenyan phone number (07.. or 2547..).");
      return;
    }
    setStatus("sending");
    setMessage("Sending STK push to your phone…");
    setErrorHint("");
    handledRef.current = false;
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
      const data = (await res.json()) as {
        success: boolean;
        paymentId?: string;
        reference?: string;
        error?: string;
      };
      if (!res.ok || !data.success || !data.paymentId) {
        setStatus("failed");
        setMessage(data.error || "Failed to send STK push.");
        setErrorHint("Check the phone number and your network, then try again.");
        return;
      }
      setPaymentId(data.paymentId);
      setReference(data.reference || "");
      setStatus("pending");
      setMessage("STK push sent. Check your phone for the M-Pesa prompt.");
      startTicker();

      // Realtime updates from RTDB drive every UI stage transition.
      // The server writes PENDING → QUEUED → (PROCESSING) → SUCCESS/FAILED/CANCELLED,
      // and `mapRtdbStatus` translates each value into the matching UI stage.
      unsubRef.current = subscribePayment(data.paymentId, (rec) => {
        if (rec) void handleRecord(rec);
      });

      // Failsafe in case the callback never fires.
      startFailsafe(data.paymentId, data.reference || "");
    } catch (e) {
      setStatus("failed");
      setMessage(e instanceof Error ? e.message : "Network error.");
      setErrorHint("Check your internet connection and retry.");
    }
  };

  const cancel = () => {
    cleanup();
    setStatus("idle");
    setMessage("");
    setErrorHint("");
  };

  const currentStage = stageIndex(status);

  return (
    <Dialog open={open} onOpenChange={(o) => (isLocked ? null : onOpenChange(o))}>
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
            <p className="text-[11px] text-center text-muted-foreground">
              You'll receive an M-Pesa prompt on your phone. Approve it to complete payment.
            </p>
          </div>
        )}

        {isLocked && (
          <div className="space-y-4 py-2">
            {/* Stage progress bar */}
            <div className="flex items-center justify-between gap-1">
              {STAGES.map((stage, i) => {
                const Icon = stage.icon;
                const reached = i <= currentStage;
                const active = i === currentStage;
                return (
                  <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                        reached
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground",
                        active && "ring-2 ring-primary/30",
                      )}
                    >
                      {active ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] text-center leading-tight",
                        reached ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {stage.label}
                    </span>
                    {i < STAGES.length - 1 && (
                      <div className="hidden" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-center">
              <p className="text-sm font-medium">{message}</p>
              <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {elapsed}s elapsed
                </span>
              </div>
            </div>

            {status === "in_progress" && (
              <p className="text-center text-[11px] text-muted-foreground">
                Don't close this window — confirmation arrives automatically.
              </p>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-10 w-10 text-primary animate-in zoom-in" />
            </div>
            <p className="text-base font-semibold">Payment Successful</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}

        {status === "failed" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-base font-semibold">Payment Failed</p>
            <p className="text-sm">{message}</p>
            {errorHint && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-left text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{errorHint}</span>
              </div>
            )}
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="hero" className="flex-1" onClick={cancel}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
