const PAYHERO_BASE_URL = "https://api.payhero.co.ke";
const PAYHERO_BACKEND_URL = "https://backend.payhero.co.ke";

export const payHeroConfig = {
  baseUrl: process.env.PAYHERO_BASE_URL || PAYHERO_BASE_URL,
  paymentUrl:
    process.env.PAYHERO_PAYMENT_URL || `${PAYHERO_BACKEND_URL}/api/v2/payments`,
  transactionStatusUrl:
    process.env.PAYHERO_TRANSACTION_STATUS_URL ||
    `${PAYHERO_BACKEND_URL}/api/v2/transaction-status`,
  accountId: String(process.env.PAYHERO_ACCOUNT_ID || "3278"),
  channelId: String(process.env.PAYHERO_CHANNEL_ID || "3838"),
  authToken: process.env.PAYHERO_AUTH_TOKEN || "",
  callbackUrl: process.env.PAYHERO_CALLBACK_URL || "",
};

export function buildCallbackUrl(req, paymentId) {
  if (payHeroConfig.callbackUrl) {
    return payHeroConfig.callbackUrl;
  }

  const proto =
    req.headers["x-forwarded-proto"] || req.headers["x-forwarded-protocol"] || "https";
  const host = req.headers.host || process.env.VERCEL_URL || "";
  const origin = host ? `${proto}://${host}` : "";
  return `${origin.replace(/\/$/, "")}/api/payment-callback?pid=${paymentId}`;
}

export async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function normalizePayHeroStatus(input) {
  const value = String(input || "").trim().toUpperCase();
  if (["SUCCESS", "COMPLETED", "PAID"].includes(value)) return "SUCCESS";
  if (["FAILED", "FAIL", "ERROR"].includes(value)) return "FAILED";
  if (["CANCELLED", "CANCELED"].includes(value)) return "CANCELLED";
  if (["PROCESSING", "PENDING_CONFIRMATION"].includes(value)) return "PROCESSING";
  if (["QUEUED", "PENDING"].includes(value)) return value === "PENDING" ? "PENDING" : "QUEUED";
  return "";
}

export function extractCallbackPayload(body) {
  const root = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
  const data = root.response || root.data || root.body || root;
  const callback = data.CallbackMetadata || data.callbackMetadata || {};

  return {
    raw: data,
    checkoutRequestId:
      data.CheckoutRequestID || data.checkoutRequestId || data.checkout_request_id || "",
    externalReference:
      data.ExternalReference || data.external_reference || data.reference || "",
    status: data.Status || data.status || "",
    resultCode:
      typeof data.ResultCode === "number"
        ? data.ResultCode
        : typeof data.result_code === "number"
          ? data.result_code
          : null,
    resultDesc:
      data.ResultDesc || data.result_desc || data.message || data.description || "",
    mpesaReceiptNumber:
      data.MpesaReceiptNumber ||
      data.mpesa_receipt_number ||
      callback.MpesaReceiptNumber ||
      callback.mpesa_receipt_number ||
      "",
  };
}

export function resolvePaymentStatus({
  status,
  resultCode,
  resultDesc,
  mpesaReceiptNumber,
}) {
  const normalizedStatus = normalizePayHeroStatus(status);
  const desc = String(resultDesc || "").toLowerCase();

  if (mpesaReceiptNumber || resultCode === 0 || normalizedStatus === "SUCCESS") {
    return "SUCCESS";
  }

  if (
    normalizedStatus === "CANCELLED" ||
    resultCode === 1032 ||
    desc.includes("cancel")
  ) {
    return "CANCELLED";
  }

  if (
    normalizedStatus === "FAILED" ||
    (typeof resultCode === "number" && resultCode !== 0) ||
    desc.includes("failed")
  ) {
    return "FAILED";
  }

  if (normalizedStatus === "PROCESSING") {
    return "PROCESSING";
  }

  if (normalizedStatus === "QUEUED") {
    return "QUEUED";
  }

  return normalizedStatus === "PENDING" ? "PENDING" : "";
}
