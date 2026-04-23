import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/payhero/callback")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as {
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

          // Update both possible reference keys so the client poller can match.
          const keys = [r.CheckoutRequestID, r.ExternalReference].filter(
            Boolean,
          ) as string[];

          // Strict success: M-Pesa ResultCode 0 (the official "The service request is processed successfully").
          // Optional receipt strengthens the signal but isn't always echoed in the callback.
          const isSuccess = r.ResultCode === 0;
          const isFailedExplicit =
            typeof r.ResultCode === "number" && r.ResultCode !== 0;

          let mapped: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
          if (isSuccess) mapped = "SUCCESS";
          else if (isFailedExplicit || r.Status === "Failed") mapped = "FAILED";

          if (mapped !== "PENDING") {
            for (const k of keys) {
              const prev = globalThis.__payheroStatus!.get(k) || { status: mapped };
              globalThis.__payheroStatus!.set(k, {
                ...prev,
                status: mapped,
                message: r.ResultDesc,
              });
            }
          }
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: true });
        }
      },
    },
  },
} as never);
