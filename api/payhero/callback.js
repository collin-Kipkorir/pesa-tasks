import { rtdbGet, rtdbSet, rtdbUpdate } from "../../_lib/rtdb-server.js";

export default async function handler(req, res) {
  // Respond 200 immediately; process body but tolerate errors silently
  try {
    const pidFromQuery = req.query?.pid || "";
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const r = body.response || body;
    if (!r) return res.status(200).json({ ok: true });

    // Find paymentId by query pid, CheckoutRequestID or ExternalReference
    let paymentId = pidFromQuery || "";
    if (!paymentId) {
      const tryKeys = [r.CheckoutRequestID, r.ExternalReference].filter(Boolean);
      for (const k of tryKeys) {
        const found = await rtdbGet(`paymentRefs/${k}`);
        if (found) { paymentId = found; break; }
      }
    }
    if (!paymentId) return res.status(200).json({ ok: true });

    // idempotent mapping: ensure paymentRefs contain the keys
    if (r.CheckoutRequestID) await rtdbSet(`paymentRefs/${r.CheckoutRequestID}`, paymentId);
    if (r.ExternalReference) await rtdbSet(`paymentRefs/${r.ExternalReference}`, paymentId);

    const isSuccess = r.ResultCode === 0 || Boolean(r.MpesaReceiptNumber) || (r.Status && r.Status.toString().toLowerCase() === "success");
    const desc = (r.ResultDesc || "").toLowerCase();
    const isCancelled = r.ResultCode === 1032 || desc.includes("cancel");
    const isFailed = !isSuccess && ((typeof r.ResultCode === "number" && r.ResultCode !== 0) || (r.Status && r.Status.toString().toLowerCase() === "failed"));
    const isProcessing = !isSuccess && !isFailed && !isCancelled && (r.Status === "Processing" || r.Status === "Queued" || desc.includes("processing") || desc.includes("pin"));

    let status = null;
    if (isSuccess) status = "SUCCESS";
    else if (isCancelled) status = "CANCELLED";
    else if (isFailed) status = "FAILED";
    else if (isProcessing) status = "PROCESSING";

    if (!status) return res.status(200).json({ ok: true });

    await rtdbUpdate(`payments/${paymentId}`, {
      status,
      ...(r.MpesaReceiptNumber ? { MpesaReceiptNumber: r.MpesaReceiptNumber } : {}),
      ...(r.ResultDesc ? { resultDesc: r.ResultDesc } : {}),
      updatedAt: Date.now(),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Always return 200 to PayHero, but log server-side if needed
    return res.status(200).json({ ok: true });
  }
}
