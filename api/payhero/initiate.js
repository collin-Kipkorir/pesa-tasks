// Vercel serverless function: POST /api/payhero/initiate
import { rtdbSet, rtdbUpdate } from "../../_lib/rtdb-server.js";
import { toMsisdn, normalizePhone, isValidKePhone } from "../../_lib/phone.js";

const PAYMENT_URL = "https://backend.payhero.co.ke/api/v2/payments";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const amount = Number(body.amount);
    if (!amount || amount < 1 || amount > 1000000) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }
    if (!body.purpose || (body.purpose !== "activation" && body.purpose !== "vip")) {
      return res.status(400).json({ success: false, error: "Invalid purpose" });
    }
    const localPayer = normalizePhone(body.phone);
    if (!isValidKePhone(localPayer)) {
      return res.status(400).json({ success: false, error: "Invalid phone number" });
    }
    const payerMsisdn = toMsisdn(body.phone);
    const userPhone = normalizePhone(body.userPhone);

  const auth = process.env.PAYHERO_AUTH_TOKEN || process.env.VITE_PAYHERO_AUTH_TOKEN;
  const channelId = Number(process.env.PAYHERO_CHANNEL_ID || process.env.VITE_PAYHERO_CHANNEL_ID || "3838");
    if (!auth) {
      return res.status(500).json({ success: false, error: "PayHero not configured" });
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const externalReference = `${body.purpose.toUpperCase()}-${userPhone}-${Date.now()}`;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const publicBase = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
    const callbackUrl = `${publicBase.replace(/\/$/, "")}/api/payhero/callback?pid=${paymentId}`;

    await rtdbSet(`payments/${paymentId}`, {
      paymentId, phone: userPhone, payerPhone: payerMsisdn, amount,
      purpose: body.purpose, status: "PENDING", externalReference, createdAt: Date.now(),
    });

    const payload = {
      amount, phone_number: payerMsisdn, channel_id: channelId,
      provider: "m-pesa", external_reference: externalReference,
      customer_name: userPhone, callback_url: callbackUrl,
    };

    const r = await fetch(PAYMENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(payload),
    });
    const data = await r.json();

    if (!r.ok || !data.success || !data.reference) {
      await rtdbUpdate(`payments/${paymentId}`, {
        status: "FAILED",
        resultDesc: data.error_message || data.error || `PayHero ${r.status}`,
        updatedAt: Date.now(),
      });
      return res.status(400).json({
        success: false, paymentId,
        error: data.error_message || data.error || `PayHero ${r.status}`,
      });
    }

    await rtdbUpdate(`payments/${paymentId}`, {
      status: "QUEUED", reference: data.reference,
      CheckoutRequestID: data.CheckoutRequestID || "", updatedAt: Date.now(),
    });

    if (data.reference) await rtdbSet(`paymentRefs/${data.reference}`, paymentId);
    if (data.CheckoutRequestID) await rtdbSet(`paymentRefs/${data.CheckoutRequestID}`, paymentId);
    await rtdbSet(`paymentRefs/${externalReference}`, paymentId);

    return res.status(200).json({
      success: true, paymentId, reference: data.reference,
      checkoutRequestId: data.CheckoutRequestID, externalReference,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Unknown error" });
  }
}
