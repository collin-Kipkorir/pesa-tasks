import { createFileRoute } from "@tanstack/react-router";
import { rtdbGet, rtdbUpdate } from "@/lib/rtdb-server";

const STATUS_URL = "https://backend.payhero.co.ke/api/v2/transaction-status";

type PaymentDoc = {
  status?: string;
  reference?: string;
  CheckoutRequestID?: string;
  externalReference?: string;
};

export const Route = createFileRoute("/api/payhero/status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const paymentId = url.searchParams.get("paymentId");
        const refParam = url.searchParams.get("reference");

        let pid = paymentId || "";
        let doc: PaymentDoc | null = null;

        if (pid) {
          doc = await rtdbGet<PaymentDoc>(`payments/${pid}`);
        } else if (refParam) {
          const found = await rtdbGet<string>(`paymentRefs/${refParam}`);
          if (found) {
            pid = found;
            doc = await rtdbGet<PaymentDoc>(`payments/${pid}`);
          }
        }

        // Terminal statuses short-circuit straight from RTDB.
        if (doc?.status === "SUCCESS" || doc?.status === "FAILED" || doc?.status === "CANCELLED") {
          return Response.json({ status: doc.status });
        }

        // Otherwise fall back to PayHero transaction-status (callback failsafe).
        const reference = doc?.reference || refParam;
        if (!reference) {
          return Response.json({ status: doc?.status || "PENDING" });
        }

        try {
          const auth = process.env.PAYHERO_AUTH_TOKEN;
          const res = await fetch(
            `${STATUS_URL}?reference=${encodeURIComponent(reference)}`,
            { headers: auth ? { Authorization: auth } : {} },
          );
          const data = (await res.json()) as {
            status?: string;
            ResultCode?: number;
            MpesaReceiptNumber?: string;
            mpesa_receipt_number?: string;
            ResultDesc?: string;
          };

          const s = (data.status || "").toUpperCase();
          const receipt = data.MpesaReceiptNumber || data.mpesa_receipt_number;
          const desc = (data.ResultDesc || "").toLowerCase();
          const isSuccess = data.ResultCode === 0 || (s === "SUCCESS" && Boolean(receipt));
          const isCancelled =
            s === "CANCELLED" || data.ResultCode === 1032 || desc.includes("cancel");
          const isFailed =
            !isSuccess &&
            !isCancelled &&
            (s === "FAILED" ||
              (typeof data.ResultCode === "number" && data.ResultCode !== 0 && !receipt));
          const isProcessing =
            !isSuccess &&
            !isFailed &&
            !isCancelled &&
            (s === "PROCESSING" || s === "QUEUED" || desc.includes("processing"));

          let mapped: "PENDING" | "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" =
            (doc?.status as typeof mapped) || "PENDING";
          if (isSuccess) mapped = "SUCCESS";
          else if (isCancelled) mapped = "CANCELLED";
          else if (isFailed) mapped = "FAILED";
          else if (isProcessing) mapped = "PROCESSING";

          // Persist any meaningful change so the realtime listener fires.
          if (pid && mapped !== doc?.status) {
            await rtdbUpdate(`payments/${pid}`, {
              status: mapped,
              ...(receipt ? { MpesaReceiptNumber: receipt } : {}),
              ...(data.ResultDesc ? { resultDesc: data.ResultDesc } : {}),
              updatedAt: Date.now(),
            });
          }

          return Response.json({ status: mapped, message: data.ResultDesc });
        } catch (e) {
          return Response.json({
            status: "PENDING",
            message: e instanceof Error ? e.message : "Could not fetch status",
          });
        }
      },
    },
  },
} as never);
