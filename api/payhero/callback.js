import { rtdbGet, rtdbSet, rtdbUpdate } from "../_lib/rtdb-server.js";
import {
  extractCallbackPayload,
  resolvePaymentStatus,
} from "../_lib/payhero.js";

export default async function handler(req, res) {
  try {
    const pidFromQuery = req.query?.pid || "";
    const payload = extractCallbackPayload(req.body);
    const responseStatus = resolvePaymentStatus(payload);

    if (!payload.raw) {
      return res.status(200).json({ ok: true });
    }

    let paymentId = pidFromQuery || "";
    if (!paymentId) {
      const tryKeys = [payload.checkoutRequestId, payload.externalReference].filter(Boolean);
      for (const key of tryKeys) {
        const found = await rtdbGet(`paymentRefs/${key}`);
        if (found) {
          paymentId = found;
          break;
        }
      }
    }

    if (!paymentId) {
      return res.status(200).json({ ok: true });
    }

    if (payload.checkoutRequestId) {
      await rtdbSet(`paymentRefs/${payload.checkoutRequestId}`, paymentId);
    }
    if (payload.externalReference) {
      await rtdbSet(`paymentRefs/${payload.externalReference}`, paymentId);
    }

    if (!responseStatus) {
      return res.status(200).json({ ok: true });
    }

    await rtdbUpdate(`payments/${paymentId}`, {
      status: responseStatus,
      ...(payload.checkoutRequestId
        ? { CheckoutRequestID: payload.checkoutRequestId }
        : {}),
      ...(payload.externalReference
        ? {
            externalReference: payload.externalReference,
            reference: payload.externalReference,
          }
        : {}),
      ...(payload.mpesaReceiptNumber
        ? { MpesaReceiptNumber: payload.mpesaReceiptNumber }
        : {}),
      ...(payload.resultDesc ? { resultDesc: payload.resultDesc } : {}),
      updatedAt: Date.now(),
    });

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
}
