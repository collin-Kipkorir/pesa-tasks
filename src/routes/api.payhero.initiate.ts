import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://backend.payhero.co.ke/api/v2";

// In-memory map of reference -> last known status (per worker instance).
// Sufficient for short-lived STK polling within a single request lifecycle.
const statusMap = new Map<string, { status: string; message?: string; purpose?: string; userPhone?: string }>();

// expose to /status route via global (workers per-isolate)
declare global {
  // eslint-disable-next-line no-var
  var __payheroStatus: Map<string, { status: string; message?: string; purpose?: string; userPhone?: string }> | undefined;
}
if (!globalThis.__payheroStatus) globalThis.__payheroStatus = statusMap;

export const Route = createFileRoute("/api/payhero/initiate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as {
            amount: number;
            phone: string;
            purpose: "activation" | "vip";
            userPhone: string;
          };

          const auth = process.env.PAYHERO_AUTH_TOKEN;
          const channelId = Number(process.env.PAYHERO_CHANNEL_ID || "3838");
          if (!auth) {
            return Response.json({ success: false, error: "PayHero not configured" }, { status: 500 });
          }

          const origin = new URL(request.url).origin;
          const callbackUrl = `${origin}/api/payhero/callback`;
          const externalReference = `${body.purpose.toUpperCase()}-${body.userPhone}-${Date.now()}`;

          const payload = {
            amount: body.amount,
            phone_number: body.phone,
            channel_id: channelId,
            provider: "m-pesa",
            external_reference: externalReference,
            customer_name: body.userPhone,
            callback_url: callbackUrl,
          };

          const res = await fetch(`${BASE}/payments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth,
            },
            body: JSON.stringify(payload),
          });
          const data = (await res.json()) as {
            success?: boolean;
            status?: string;
            reference?: string;
            CheckoutRequestID?: string;
            error?: string;
            error_message?: string;
          };
          if (!res.ok || !data.success || !data.reference) {
            return Response.json(
              { success: false, error: data.error_message || data.error || `PayHero ${res.status}` },
              { status: 400 },
            );
          }

          const meta = {
            status: "PENDING",
            purpose: body.purpose,
            userPhone: body.userPhone,
          } as const;
          // Track every possible key the callback might use to match.
          globalThis.__payheroStatus!.set(data.reference, { ...meta });
          if (data.CheckoutRequestID)
            globalThis.__payheroStatus!.set(data.CheckoutRequestID, { ...meta });
          globalThis.__payheroStatus!.set(externalReference, { ...meta });

          return Response.json({
            success: true,
            reference: data.reference,
            checkoutRequestId: data.CheckoutRequestID,
            externalReference,
          });
        } catch (e) {
          return Response.json(
            { success: false, error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
} as never);
