import { rtdbSet, rtdbUpdate } from "../_lib/rtdb-server.js";
import { toMsisdn, normalizePhone, isValidKePhone } from "../_lib/phone.js";
import {
  buildCallbackUrl,
  parseJsonSafe,
  payHeroConfig,
  resolvePaymentStatus,
} from "../_lib/payhero.js";

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

    if (!payHeroConfig.authToken) {
      return res.status(500).json({ success: false, error: "PayHero not configured" });
    }

    const payerMsisdn = toMsisdn(body.phone);
    const userPhone = normalizePhone(body.userPhone || "");
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const reference =
      body.externalReference ||
      `${(body.purpose || "PAY").toString().toUpperCase()}-${userPhone || "guest"}-${Date.now()}`;
    const callbackUrl = buildCallbackUrl(req, paymentId);

    await rtdbSet(`payments/${paymentId}`, {
      paymentId,
      phone: userPhone,
      payerPhone: payerMsisdn,
      amount,
      purpose: body.purpose || "activation",
      status: "PENDING",
      reference,
      externalReference: reference,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const payload = {
      amount,
      phone_number: payerMsisdn,
      channel_id: Number(payHeroConfig.channelId),
      provider: "m-pesa",
      external_reference: reference,
      customer_name: body.customerName || userPhone || "Customer",
      callback_url: callbackUrl,
    };

    const response = await fetch(payHeroConfig.paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: payHeroConfig.authToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(response);

    if (!response.ok) {
      const message =
        (data && (data.error || data.error_message || data.message)) ||
        `PayHero ${response.status}`;
      await rtdbUpdate(`payments/${paymentId}`, {
        status: "FAILED",
        resultDesc: message,
        updatedAt: Date.now(),
      });
      return res.status(400).json({ success: false, paymentId, error: message });
    }

    const checkoutRequestId =
      data?.CheckoutRequestID || data?.checkoutRequestId || data?.checkout_request_id || "";
    const payHeroStatus =
      resolvePaymentStatus({
        status: data?.Status || data?.status || "QUEUED",
        resultCode: data?.ResultCode ?? data?.result_code,
        resultDesc: data?.ResultDesc || data?.message || "",
        mpesaReceiptNumber:
          data?.MpesaReceiptNumber || data?.mpesa_receipt_number || "",
      }) || "QUEUED";

    await rtdbUpdate(`payments/${paymentId}`, {
      status: payHeroStatus,
      reference,
      externalReference: reference,
      CheckoutRequestID: checkoutRequestId,
      resultDesc: data?.ResultDesc || data?.message || "",
      updatedAt: Date.now(),
    });

    if (checkoutRequestId) {
      await rtdbSet(`paymentRefs/${checkoutRequestId}`, paymentId);
    }
    await rtdbSet(`paymentRefs/${reference}`, paymentId);

    return res.status(201).json({
      success: true,
      paymentId,
      status: payHeroStatus,
      reference,
      CheckoutRequestID: checkoutRequestId,
      callback_url: callbackUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
