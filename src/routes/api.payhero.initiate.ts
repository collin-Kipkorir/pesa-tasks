import { createFileRoute } from "@tanstack/react-router";
import { rtdbSet, rtdbUpdate } from "@/lib/rtdb-server";
import { toMsisdn, normalizePhone, isValidKePhone } from "@/lib/phone";

const PAYMENT_URL = "https://backend.payhero.co.ke/api/v2/payments";

export const Route = createFileRoute("/api/payhero/initiate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as {
            amount: number;
            phone: string; // payer phone
            purpose: "activation" | "vip";
            userPhone: string; // account owner phone (used as DB key)
          };

          // Basic validation
          const amount = Number(body.amount);
          if (!amount || amount < 1 || amount > 1000000) {
            return Response.json({ success: false, error: "Invalid amount" }, { status: 400 });
          }
          if (!body.purpose || (body.purpose !== "activation" && body.purpose !== "vip")) {
            return Response.json({ success: false, error: "Invalid purpose" }, { status: 400 });
          }
          const localPayer = normalizePhone(body.phone);
          if (!isValidKePhone(localPayer)) {
            return Response.json({ success: false, error: "Invalid phone number" }, { status: 400 });
          }
          const payerMsisdn = toMsisdn(body.phone);
          const userPhone = normalizePhone(body.userPhone);

          const auth = process.env.PAYHERO_AUTH_TOKEN;
          const channelId = Number(process.env.PAYHERO_CHANNEL_ID || "3838");
          if (!auth) {
            return Response.json({ success: false, error: "PayHero not configured" }, { status: 500 });
          }

          // Create payment record FIRST so the client can subscribe immediately.
          const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const externalReference = `${body.purpose.toUpperCase()}-${userPhone}-${Date.now()}`;
          // Prefer an explicit public base URL for the callback so PayHero can reach it
          // in production (preview URLs are not publicly reachable from PayHero).
          const publicBase =
            process.env.PUBLIC_BASE_URL || new URL(request.url).origin;
          const callbackUrl = `${publicBase.replace(/\/$/, "")}/api/payhero/callback?pid=${paymentId}`;

          await rtdbSet(`payments/${paymentId}`, {
            paymentId,
            phone: userPhone,
            payerPhone: payerMsisdn,
            amount,
            purpose: body.purpose,
            status: "PENDING",
            externalReference,
            createdAt: Date.now(),
          });

          const payload = {
            amount,
            phone_number: payerMsisdn,
            channel_id: channelId,
            provider: "m-pesa",
            external_reference: externalReference,
            customer_name: userPhone,
            callback_url: callbackUrl,
          };

          const res = await fetch(PAYMENT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: auth },
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
            await rtdbUpdate(`payments/${paymentId}`, {
              status: "FAILED",
              resultDesc: data.error_message || data.error || `PayHero ${res.status}`,
              updatedAt: Date.now(),
            });
            return Response.json(
              {
                success: false,
                paymentId,
                error: data.error_message || data.error || `PayHero ${res.status}`,
              },
              { status: 400 },
            );
          }

          // STK push accepted by PayHero — prompt is now on the user's phone.
          await rtdbUpdate(`payments/${paymentId}`, {
            status: "QUEUED",
            reference: data.reference,
            CheckoutRequestID: data.CheckoutRequestID || "",
            updatedAt: Date.now(),
          });

          // Index references back to paymentId for callback lookup.
          if (data.reference) await rtdbSet(`paymentRefs/${data.reference}`, paymentId);
          if (data.CheckoutRequestID)
            await rtdbSet(`paymentRefs/${data.CheckoutRequestID}`, paymentId);
          await rtdbSet(`paymentRefs/${externalReference}`, paymentId);

          return Response.json({
            success: true,
            paymentId,
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
