import { rtdbGet, rtdbUpdate } from "../_lib/rtdb-server.js";
import {
  parseJsonSafe,
  payHeroConfig,
  resolvePaymentStatus,
} from "../_lib/payhero.js";

export default async function handler(req, res) {
  const paymentId = req.query?.paymentId || "";
  const refParam = req.query?.reference || "";

  let pid = paymentId;
  let doc = null;

  if (pid) {
    doc = await rtdbGet(`payments/${pid}`);
  } else if (refParam) {
    const found = await rtdbGet(`paymentRefs/${refParam}`);
    if (found) {
      pid = found;
      doc = await rtdbGet(`payments/${pid}`);
    }
  }

  if (doc?.status === "SUCCESS" || doc?.status === "FAILED" || doc?.status === "CANCELLED") {
    return res.status(200).json({
      status: doc.status,
      reference: doc.reference || refParam || "",
      CheckoutRequestID: doc.CheckoutRequestID || "",
      MpesaReceiptNumber: doc.MpesaReceiptNumber || "",
      message: doc.resultDesc || "",
    });
  }

  const reference = doc?.reference || refParam;
  if (!reference) {
    return res.status(200).json({ status: doc?.status || "PENDING" });
  }

  try {
    const response = await fetch(
      `${payHeroConfig.transactionStatusUrl}?reference=${encodeURIComponent(reference)}`,
      {
        headers: payHeroConfig.authToken
          ? { Authorization: payHeroConfig.authToken }
          : {},
      },
    );
    const data = await parseJsonSafe(response);
    const receipt =
      data?.MpesaReceiptNumber ||
      data?.mpesa_receipt_number ||
      data?.provider_reference ||
      "";
    const mapped =
      resolvePaymentStatus({
        status: data?.Status || data?.status || doc?.status || "PENDING",
        resultCode: data?.ResultCode ?? data?.result_code,
        resultDesc: data?.ResultDesc || data?.result_desc || data?.message || "",
        mpesaReceiptNumber: receipt,
      }) ||
      doc?.status ||
      "PENDING";

    if (pid && mapped !== doc?.status) {
      await rtdbUpdate(`payments/${pid}`, {
        status: mapped,
        ...(receipt ? { MpesaReceiptNumber: receipt } : {}),
        ...(data?.ResultDesc || data?.result_desc || data?.message
          ? { resultDesc: data?.ResultDesc || data?.result_desc || data?.message }
          : {}),
        updatedAt: Date.now(),
      });
    }

    return res.status(200).json({
      status: mapped,
      reference,
      CheckoutRequestID: doc?.CheckoutRequestID || "",
      MpesaReceiptNumber: receipt,
      message: data?.ResultDesc || data?.result_desc || data?.message || "",
    });
  } catch (error) {
    return res.status(200).json({
      status: doc?.status || "PENDING",
      reference,
      CheckoutRequestID: doc?.CheckoutRequestID || "",
      message: error instanceof Error ? error.message : "Could not fetch status",
    });
  }
}
