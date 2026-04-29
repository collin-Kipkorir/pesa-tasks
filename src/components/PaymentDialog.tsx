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

type Status =
  | "idle"
  | "sending"
  | "pending"
  | "in_progress"
  | "success"
  | "failed";

const STAGES: { key: Exclude<Status, "idle" | "failed">; label: string; icon: React.ElementType }[] = [
  { key: "sending", label: "Sending STK", icon: Send },
  { key: "pending", label: "Waiting", icon: Clock },
  { key: "in_progress", label: "Confirming", icon: ShieldCheck },
  { key: "success", label: "Done", icon: CheckCircle2 },
];

function stageIndex(status: Status): number {
  const index = STAGES.findIndex((stage) => stage.key === status);
  return index === -1 ? -1 : index;
}

function mapRtdbStatus(status: PaymentStatus): Status {
  switch (status) {
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

function messageFor(status: PaymentStatus): string {
  switch (status) {
    case "PENDING":
      return "Waiting for payment...";
    case "QUEUED":
      return "Check your phone and enter M-PESA PIN.";
    case "PROCESSING":
      return "Waiting for M-PESA confirmation.";
    case "SUCCESS":
      return "M-PESA payment confirmed.";
    case "FAILED":
      return "Payment failed.";
    case "CANCELLED":
      return "You cancelled the M-PESA prompt.";
    default:
      return "";
  }
}

export function PaymentDialog({ open, onOpenChange, purpose, amount }: Props) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [errorHint, setErrorHint] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [reference, setReference] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const unsubRef = useRef<null | (() => void)>(null);
  const failsafeRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
  const handledRef = useRef(false);
  const statusRetryRef = useRef(0);

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
    statusRetryRef.current = 0;
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
      statusRetryRef.current = 0;
    }

    return () => cleanup();
  }, [open, user?.phone]);

  const purposeLabel = purpose === "activation" ? "Account Activation" : "VIP Unlock";
  const isLocked = status === "sending" || status === "pending" || status === "in_progress";

  async function handleRecord(record: PaymentRecord) {
    if (handledRef.current) return;

    const uiStatus = mapRtdbStatus(record.status);

    if (uiStatus === "pending" || uiStatus === "in_progress") {
      setStatus(uiStatus);
      setMessage(messageFor(record.status));
      setErrorHint("");
      return;
    }

    if (uiStatus === "success") {
      handledRef.current = true;
      cleanup();

      if (user) {
        if (purpose === "activation") await markActivated(user.phone);
        else await markVip(user.phone);
      }

      setStatus("success");
      setMessage(
        record.MpesaReceiptNumber
          ? `Payment confirmed - Receipt ${record.MpesaReceiptNumber}`
          : "M-PESA payment confirmed.",
      );
      setErrorHint("");
      window.setTimeout(() => onOpenChange(false), 2000);
      return;
    }

    handledRef.current = true;
    cleanup();
    setStatus("failed");

    const desc = (record.resultDesc || "").toLowerCase();
    if (record.status === "CANCELLED" || desc.includes("cancel")) {
      setMessage("You cancelled the M-PESA prompt.");
      setErrorHint("Tap Try Again and approve the prompt with your M-PESA PIN.");
    } else if (desc.includes("insufficient") || desc.includes("balance")) {
      setMessage("Insufficient M-PESA balance.");
      setErrorHint("Top up your M-PESA, then try again.");
    } else if (desc.includes("timeout") || desc.includes("expire")) {
      setMessage("The STK prompt timed out.");
      setErrorHint("Make sure your phone is on and unlocked, then retry.");
    } else if (desc.includes("wrong") || desc.includes("pin")) {
      setMessage("Incorrect M-PESA PIN.");
      setErrorHint("Try again and enter the correct PIN.");
    } else {
      setMessage(record.resultDesc || "Payment was not completed on M-PESA.");
      setErrorHint("Check your phone and try again.");
    }
  }

  function scheduleFailsafeStatusCheck(pid: string, refStr: string) {
    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 12000;
    const RETRY_DELAY_MS = 5000;

    const runCheck = async () => {
      if (handledRef.current) return;

      statusRetryRef.current += 1;

      try {
        const search = new URLSearchParams({ paymentId: pid });
        if (refStr) search.set("reference", refStr);

        const response = await fetch(`/api/status?${search.toString()}`);
        const data = (await response.json()) as {
          status?: string;
          message?: string;
          MpesaReceiptNumber?: string;
          CheckoutRequestID?: string;
        };
        const nextStatus = (data.status || "").toUpperCase() as PaymentStatus;

        if (nextStatus === "SUCCESS" || nextStatus === "FAILED" || nextStatus === "CANCELLED") {
          await handleRecord({
            paymentId: pid,
            phone: user?.phone || "",
            payerPhone: "",
            amount,
            purpose,
            status: nextStatus,
            reference: refStr,
            CheckoutRequestID: data.CheckoutRequestID,
            MpesaReceiptNumber: data.MpesaReceiptNumber,
            resultDesc: data.message,
            createdAt: Date.now(),
          });
          return;
        }

        if (["PENDING", "QUEUED", "PROCESSING"].includes(nextStatus)) {
          const mapped = nextStatus as PaymentStatus;
          setStatus(mapRtdbStatus(mapped));
          setMessage(messageFor(mapped));
        }
      } catch {
        // Ignore transient failures and continue to the limited retry loop.
      }

      if (statusRetryRef.current < MAX_RETRIES && !handledRef.current) {
        failsafeRef.current = window.setTimeout(runCheck, RETRY_DELAY_MS);
        return;
      }

      if (!handledRef.current) {
        cleanup();
        setStatus("failed");
        setMessage("We could not confirm the payment in time.");
        setErrorHint("If M-PESA deducted funds, use the reference below for support.");
      }
    };

    failsafeRef.current = window.setTimeout(runCheck, INITIAL_DELAY_MS);
  }

  function startTicker() {
    setElapsed(0);
    tickerRef.current = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
  }

  const startPayment = async () => {
    if (!user) return;

    const normalized = normalizePhone(phone);
    if (!isValidKePhone(normalized)) {
      setErrorHint("");
      setMessage("Enter a valid Kenyan phone number in 07... or 2547... format.");
      return;
    }

    setStatus("sending");
    setMessage("Sending STK push to your phone...");
    setErrorHint("");
    handledRef.current = false;
    statusRetryRef.current = 0;

    try {
      const response = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          phone: normalized,
          purpose,
          userPhone: user.phone,
          customerName: user.name,
        }),
      });

      let data: any = null;
      let rawText = "";

      try {
        data = await response.json();
      } catch (jsonError) {
        rawText = (await response.text().catch(() => "")).slice(0, 2000);
        console.error("/api/pay returned non-JSON response:", rawText, jsonError);
      }

      if (!response.ok) {
        const errorMessage =
          (data && (data.error || data.message)) || rawText || `Server responded ${response.status}`;
        setStatus("failed");
        setMessage(errorMessage);
        setErrorHint("Check the phone number and your network, then try again.");
        return;
      }

      if (!data || !data.success || !data.paymentId) {
        const errorMessage =
          (data && (data.error || data.message)) || rawText || "Failed to send STK push.";
        setStatus("failed");
        setMessage(errorMessage);
        setErrorHint("Check the phone number and your network, then try again.");
        return;
      }

      setPaymentId(data.paymentId);
      setReference(data.reference || "");
      setStatus("pending");
      setMessage("Waiting for payment...");
      startTicker();

      unsubRef.current = subscribePayment(data.paymentId, (record) => {
        if (record) void handleRecord(record);
      });

      scheduleFailsafeStatusCheck(data.paymentId, data.reference || "");
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Network error.");
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
    <Dialog open={open} onOpenChange={(nextOpen) => (isLocked ? null : onOpenChange(nextOpen))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[image:var(--gradient-cta)] text-primary-foreground shadow-[var(--shadow-cta)]">
            <Smartphone className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-xl">{purposeLabel}</DialogTitle>
          <DialogDescription className="text-center">
            Pay <span className="font-semibold text-foreground">KES {amount}</span> via M-PESA STK Push
          </DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground">M-PESA Phone Number</label>
            <Input
              value={phone}
              onChange={(event) => setPhone(normalizePhone(event.target.value))}
              placeholder="254712345678"
              type="tel"
              inputMode="tel"
              maxLength={12}
            />
            {message && <p className="text-xs text-destructive">{message}</p>}
            <Button variant="hero" size="lg" className="w-full" onClick={startPayment}>
              Pay Now
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Check your phone and enter M-PESA PIN to complete payment.
            </p>
          </div>
        )}

        {isLocked && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-1">
              {STAGES.map((stage, index) => {
                const Icon = stage.icon;
                const reached = index <= currentStage;
                const active = index === currentStage;

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
                    {index < STAGES.length - 1 && <div className="hidden" />}
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
                Do not close this window. Confirmation updates automatically.
              </p>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-10 w-10 animate-in zoom-in text-primary" />
            </div>
            <p className="text-base font-semibold">Payment Successful</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            {reference && (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="font-mono">Reference: {reference}</span>
                <button
                  className="text-xs text-primary underline"
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(reference);
                    } catch {
                      // no-op
                    }
                  }}
                >
                  Copy
                </button>
              </div>
            )}
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
            {reference && (
              <div className="mt-2 text-[12px] text-muted-foreground">
                <div className="font-mono">Reference: {reference}</div>
                <button
                  className="mt-1 text-xs text-primary underline"
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(reference);
                    } catch {
                      // no-op
                    }
                  }}
                >
                  Copy reference
                </button>
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

        {paymentId && status !== "idle" && (
          <p className="text-center text-[10px] text-muted-foreground">Payment ID: {paymentId}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
