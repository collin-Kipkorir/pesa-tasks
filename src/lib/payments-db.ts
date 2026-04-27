import { ref, onValue, off, get } from "firebase/database";
import { db } from "./firebase";

export type PaymentStatus =
  | "PENDING" // record created, STK not yet acknowledged
  | "QUEUED" // PayHero accepted the STK push, prompt is on user's phone
  | "PROCESSING" // user is interacting with prompt (entered PIN, awaiting M-Pesa)
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type PaymentRecord = {
  paymentId: string;
  phone: string; // user account phone (07...)
  payerPhone: string; // M-Pesa phone used (254...)
  amount: number;
  purpose: "activation" | "vip";
  status: PaymentStatus;
  reference?: string;
  CheckoutRequestID?: string;
  externalReference?: string;
  MpesaReceiptNumber?: string;
  resultDesc?: string;
  createdAt: number;
  updatedAt?: number;
};

/** Subscribe to a payment node and get realtime status updates. */
export function subscribePayment(
  paymentId: string,
  cb: (rec: PaymentRecord | null) => void,
): () => void {
  const r = ref(db, `payments/${paymentId}`);
  const handler = onValue(r, (snap) => cb(snap.val() as PaymentRecord | null));
  return () => {
    off(r, "value", handler as never);
  };
}

export async function getPayment(paymentId: string): Promise<PaymentRecord | null> {
  const snap = await get(ref(db, `payments/${paymentId}`));
  return (snap.val() as PaymentRecord | null) || null;
}
