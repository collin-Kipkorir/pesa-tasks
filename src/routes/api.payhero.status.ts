import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://backend.payhero.co.ke/api/v2";

declare global {
  // eslint-disable-next-line no-var
  var __payheroStatus:
    | Map<
        string,
        { status: string; message?: string; purpose?: string; userPhone?: string }
      >
    | undefined;
}
if (!globalThis.__payheroStatus) globalThis.__payheroStatus = new Map();

export const Route = createFileRoute("/api/payhero/status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const reference = url.searchParams.get("reference");
        if (!reference) {
          return Response.json(
            { status: "ERROR", message: "Missing reference" },
            { status: 400 },
          );
        }

        // 1) Trust the callback cache first — that's the M-Pesa-confirmed source of truth.
        const cached = globalThis.__payheroStatus!.get(reference);
        if (
          cached &&
          (cached.status === "SUCCESS" ||
            cached.status === "FAILED" ||
            cached.status === "CANCELLED")
        ) {
          return Response.json({ status: cached.status, message: cached.message });
        }

        // 2) Fall back to PayHero transaction-status. Only treat as terminal SUCCESS
        // when both `status === "SUCCESS"` and an M-Pesa receipt / ResultCode 0 is present.
        try {
          const auth = process.env.PAYHERO_AUTH_TOKEN;
          const res = await fetch(
            `${BASE}/transaction-status?reference=${encodeURIComponent(reference)}`,
            { headers: auth ? { Authorization: auth } : {} },
          );
          const data = (await res.json()) as {
            status?: string;
            success?: boolean;
            ResultCode?: number;
            MpesaReceiptNumber?: string;
            mpesa_receipt_number?: string;
            ResultDesc?: string;
          };

          const s = (data.status || "").toUpperCase();
          const hasReceipt = Boolean(
            data.MpesaReceiptNumber || data.mpesa_receipt_number,
          );
          const resultCodeOk = data.ResultCode === 0;

          let mapped: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" = "PENDING";
          // Strict: only success when PayHero clearly confirms M-Pesa authorization.
          if ((s === "SUCCESS" && (hasReceipt || resultCodeOk)) || resultCodeOk) {
            mapped = "SUCCESS";
          } else if (s === "FAILED") {
            mapped = "FAILED";
          } else if (s === "CANCELLED") {
            mapped = "CANCELLED";
          }

          if (mapped !== "PENDING") {
            const prev = globalThis.__payheroStatus!.get(reference) || {
              status: mapped,
            };
            globalThis.__payheroStatus!.set(reference, {
              ...prev,
              status: mapped,
              message: data.ResultDesc,
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
