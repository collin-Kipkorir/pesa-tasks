import { createFileRoute } from "@tanstack/react-router";
import { rtdbGet, rtdbUpdate } from "@/lib/rtdb-server";

export const Route = createFileRoute("/api/payhero/callback")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const pidFromQuery = url.searchParams.get("pid");

          const body = (await request.json().catch(() => ({}))) as {
            response?: {
              ResultCode?: number;
              Status?: string;
              ResultDesc?: string;
              ExternalReference?: string;
              CheckoutRequestID?: string;
              MpesaReceiptNumber?: string;
            };
            status?: boolean;
          };

          const r = body.response;
          if (!r) return Response.json({ ok: true });

          // Resolve which payment this callback belongs to.
          let paymentId = pidFromQuery || "";
          if (!paymentId) {
            const tryKeys = [r.CheckoutRequestID, r.ExternalReference].filter(Boolean) as string[];
            for (const k of tryKeys) {
              const found = await rtdbGet<string>(`paymentRefs/${k}`);
              if (found) {
                paymentId = found;
                break;
              }
            }
          }
          if (!paymentId) return Response.json({ ok: true });

          // Strict success: ResultCode 0 OR explicit M-Pesa receipt number.
          const isSuccess = r.ResultCode === 0 || Boolean(r.MpesaReceiptNumber);
          const desc = (r.ResultDesc || "").toLowerCase();
          const isCancelled =
            r.ResultCode === 1032 ||
            desc.includes("cancel") ||
            desc.includes("request cancelled by user");
          const isFailed =
            !isSuccess &&
            ((typeof r.ResultCode === "number" && r.ResultCode !== 0) || r.Status === "Failed");
          // Intermediate signal: PayHero sometimes posts a "processing" / queued
          // update before the terminal callback. Promote the UI to PROCESSING.
          const isProcessing =
            !isSuccess &&
            !isFailed &&
            !isCancelled &&
            (r.Status === "Processing" ||
              r.Status === "Queued" ||
              desc.includes("processing") ||
              desc.includes("pin"));

          let status: "SUCCESS" | "FAILED" | "CANCELLED" | "PROCESSING" | null = null;
          if (isSuccess) status = "SUCCESS";
          else if (isCancelled) status = "CANCELLED";
          else if (isFailed) status = "FAILED";
          else if (isProcessing) status = "PROCESSING";

          if (!status) return Response.json({ ok: true });

          await rtdbUpdate(`payments/${paymentId}`, {
            status,
            ...(r.MpesaReceiptNumber ? { MpesaReceiptNumber: r.MpesaReceiptNumber } : {}),
            ...(r.ResultDesc ? { resultDesc: r.ResultDesc } : {}),
            updatedAt: Date.now(),
          });

          return Response.json({ ok: true });
        } catch {
          // Always 200 so PayHero doesn't keep retrying with errors.
          return Response.json({ ok: true });
        }
      },
    },
  },
} as never);
