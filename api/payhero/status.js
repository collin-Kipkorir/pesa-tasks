import { rtdbGet, rtdbUpdate } from "../../_lib/rtdb-server.js";

const DEFAULT_STATUS_URL = process.env.VITE_PAYHERO_BASE_URL
  ? `${process.env.VITE_PAYHERO_BASE_URL.replace(/\/$/, "")}/api/v2/transaction-status`
  : "https://backend.payhero.co.ke/api/v2/transaction-status";

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
    return res.status(200).json({ status: doc.status });
  }

  const reference = doc?.reference || refParam;
  if (!reference) return res.status(200).json({ status: doc?.status || "PENDING" });

  try {
    const auth = process.env.PAYHERO_AUTH_TOKEN || process.env.VITE_PAYHERO_AUTH_TOKEN;
    const statusUrl = process.env.PAYHERO_STATUS_URL || DEFAULT_STATUS_URL;
    const r = await fetch(`${statusUrl}?reference=${encodeURIComponent(reference)}`, {
      headers: auth ? { Authorization: auth } : {},
    });
    const data = await r.json();

    const s = (data.status || "").toString().toUpperCase();
    const receipt = data.MpesaReceiptNumber || data.mpesa_receipt_number || data.provider_reference;
    const desc = (data.ResultDesc || data.result_desc || "").toLowerCase();
    const isSuccess = data.ResultCode === 0 || s === "SUCCESS" || (s === "SUCCESS" && Boolean(receipt));
    const isCancelled = s === "CANCELLED" || data.ResultCode === 1032 || desc.includes("cancel");
    const isFailed = !isSuccess && !isCancelled && (s === "FAILED" || (typeof data.ResultCode === "number" && data.ResultCode !== 0 && !receipt));
    const isProcessing = !isSuccess && !isFailed && !isCancelled && (s === "PROCESSING" || s === "QUEUED" || desc.includes("processing"));

    let mapped = doc?.status || "PENDING";
    if (isSuccess) mapped = "SUCCESS";
    else if (isCancelled) mapped = "CANCELLED";
    else if (isFailed) mapped = "FAILED";
    else if (isProcessing) mapped = "PROCESSING";

    if (pid && mapped !== doc?.status) {
      await rtdbUpdate(`payments/${pid}`, {
        status: mapped,
        ...(receipt ? { MpesaReceiptNumber: receipt } : {}),
        ...(data.ResultDesc || data.result_desc ? { resultDesc: data.ResultDesc || data.result_desc } : {}),
        updatedAt: Date.now(),
      });
    }

    return res.status(200).json({ status: mapped, message: data.ResultDesc || data.result_desc });
  } catch (e) {
    return res.status(200).json({ status: "PENDING", message: e?.message || "Could not fetch status" });
  }
}
