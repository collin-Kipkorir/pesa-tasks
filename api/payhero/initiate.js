// PayHero initiate handler per documentation
import { rtdbSet, rtdbUpdate } from "../../_lib/rtdb-server.js";
import { toMsisdn, normalizePhone, isValidKePhone } from "../../_lib/phone.js";

const DEFAULT_PAYMENT_URL = process.env.VITE_PAYHERO_BASE_URL
  ? `${process.env.VITE_PAYHERO_BASE_URL.replace(/\/$/, "")}/api/v2/payments`
  : "https://backend.payhero.co.ke/api/v2/payments";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const amount = Number(body.amount || 0);
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }
    if (!body.phone) {
      return res.status(400).json({ success: false, error: "Missing phone" });
    }
    const localPayer = normalizePhone(body.phone);
    if (!isValidKePhone(localPayer)) {
      return res.status(400).json({ success: false, error: "Invalid phone" });
    }

    const payerMsisdn = toMsisdn(body.phone);
    const userPhone = normalizePhone(body.userPhone || "");

    const auth = process.env.PAYHERO_AUTH_TOKEN || process.env.VITE_PAYHERO_AUTH_TOKEN;
    const channelId = Number(
      process.env.PAYHERO_CHANNEL_ID || process.env.VITE_PAYHERO_CHANNEL_ID || "3838"
    );
    const paymentUrl = process.env.PAYHERO_PAYMENT_URL || DEFAULT_PAYMENT_URL;
    if (!auth) {
      return res.status(500).json({ success: false, error: "PayHero not configured" });
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const externalReference =
      body.externalReference ||
      `${(body.purpose || "PAY").toString().toUpperCase()}-${userPhone || "guest"}-${Date.now()}`;

    const proto =
      req.headers["x-forwarded-proto"] || req.headers["x-forwarded-protocol"] || "https";
    const host = req.headers.host || process.env.VERCEL_URL || "";
    const publicBase =
      process.env.PUBLIC_BASE_URL || process.env.VITE_PAYHERO_CALLBACK_URL || (host ? `${proto}://${host}` : "");
    const callbackUrl = `${publicBase.replace(/\/$/, "")}/api/payment-callback?pid=${paymentId}`;

    await rtdbSet(`payments/${paymentId}`, {
      paymentId,
      phone: userPhone,
      payerPhone: payerMsisdn,
      amount,
      purpose: body.purpose || "payment",
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
      customer_name: userPhone || undefined,
      callback_url: callbackUrl,
    };

    const r = await fetch(paymentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(payload),
    });

    const data = await (async () => {
      try { return await r.json(); } catch { return null; }
    })();

    if (!r.ok) {
      const msg = (data && (data.error || data.error_message)) || `PayHero ${r.status}`;
      await rtdbUpdate(`payments/${paymentId}`, { status: "FAILED", resultDesc: msg, updatedAt: Date.now() });
      return res.status(400).json({ success: false, paymentId, error: msg });
    }

    await rtdbUpdate(`payments/${paymentId}`, {
      status: data?.status || "QUEUED",
      reference: data?.reference || "",
      CheckoutRequestID: data?.CheckoutRequestID || data?.checkoutRequestId || "",
      updatedAt: Date.now(),
    });

    if (data?.reference) await rtdbSet(`paymentRefs/${data.reference}`, paymentId);
    if (data?.CheckoutRequestID) await rtdbSet(`paymentRefs/${data.CheckoutRequestID}`, paymentId);
    await rtdbSet(`paymentRefs/${externalReference}`, paymentId);

    return res.status(201).json({ success: true, status: data?.status || "QUEUED", reference: data?.reference, CheckoutRequestID: data?.CheckoutRequestID || data?.checkoutRequestId, paymentId, externalReference });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Unknown error" });
  }
}
