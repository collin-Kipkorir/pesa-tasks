import { createFileRoute } from "@tanstack/react-router";

declare global {
  // eslint-disable-next-line no-var
  var __payheroStatus: Map<string, { status: string; message?: string; purpose?: string; userPhone?: string }> | undefined;
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
            };
            status?: boolean;
          };

          const r = body.response;
          if (!r) return Response.json({ ok: true });

          const refKey = r.CheckoutRequestID || r.ExternalReference || "";
          if (refKey) {
            const success = r.ResultCode === 0 || r.Status === "Success";
            globalThis.__payheroStatus!.set(refKey, {
              status: success ? "SUCCESS" : "FAILED",
              message: r.ResultDesc,
            });
          }
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: true });
        }
      },
    },
  },
} as never);
