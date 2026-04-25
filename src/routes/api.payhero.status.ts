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

        // If RTDB already has a terminal status, return it.
        if (doc?.status && doc.status !== "PENDING") {
          return Response.json({ status: doc.status });
        }

        // Otherwise fall back to PayHero transaction-status (callback failsafe).
        const reference = doc?.reference || refParam;
        if (!reference) {
          return Response.json({ status: "PENDING" });
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
          const isSuccess = data.ResultCode === 0 || (s === "SUCCESS" && Boolean(receipt));
          const isFailed = s === "FAILED" || s === "CANCELLED" ||
            (typeof data.ResultCode === "number" && data.ResultCode !== 0 && !receipt);

          let mapped: "PENDING" | "SUCCESS" | "FAILED" = "PENDING";
          if (isSuccess) mapped = "SUCCESS";
          else if (isFailed) mapped = "FAILED";

          // If we have a paymentId and a terminal status, persist it so realtime listener fires.
          if (pid && mapped !== "PENDING") {
            await rtdbUpdate(`payments/${pid}`, {
              status: mapped,
              MpesaReceiptNumber: receipt || "",
              resultDesc: data.ResultDesc || "",
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
