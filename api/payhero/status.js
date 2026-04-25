/* Vercel serverless endpoint to query PayHero transaction status.
   Mirrors the logic in src/routes/api.payhero.status.ts
*/
const STATUS_URL = 'https://backend.payhero.co.ke/api/v2/transaction-status';
const DEFAULT_DB_URL = 'https://surveys-2791f-default-rtdb.firebaseio.com';

function withAuthUrl(dbUrl, path) {
  const secret = process.env.FIREBASE_DB_SECRET;
  const url = `${dbUrl.replace(/\/$/, '')}/${path}.json`;
  return secret ? `${url}?auth=${encodeURIComponent(secret)}` : url;
}

async function rtdbGet(dbUrl, path) {
  const res = await fetch(withAuthUrl(dbUrl, path));
  if (!res.ok) return null;
  return await res.json();
}

async function rtdbUpdate(dbUrl, path, patch) {
  const res = await fetch(withAuthUrl(dbUrl, path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`RTDB update ${path} failed: ${res.status}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = new URL(req.url, `https://${req.headers.host}`);
  const paymentId = url.searchParams.get('paymentId');
  const refParam = url.searchParams.get('reference');

  const dbUrl = process.env.FIREBASE_DB_URL || DEFAULT_DB_URL;

  let pid = paymentId || '';
  let doc = null;
  if (pid) {
    doc = await rtdbGet(dbUrl, `payments/${pid}`);
  } else if (refParam) {
    const found = await rtdbGet(dbUrl, `paymentRefs/${refParam}`);
    if (found) {
      pid = found;
      doc = await rtdbGet(dbUrl, `payments/${pid}`);
    }
  }

  if (doc?.status && doc.status !== 'PENDING') return res.json({ status: doc.status });

  const reference = doc?.reference || refParam;
  if (!reference) return res.json({ status: 'PENDING' });

  try {
    const auth = process.env.PAYHERO_AUTH_TOKEN;
    const r = await fetch(`${STATUS_URL}?reference=${encodeURIComponent(reference)}`, { headers: auth ? { Authorization: auth } : {} });
    const data = await r.json().catch(() => ({}));
    const s = (data.status || '').toUpperCase();
    const receipt = data.MpesaReceiptNumber || data.mpesa_receipt_number;
    const isSuccess = data.ResultCode === 0 || (s === 'SUCCESS' && Boolean(receipt));
    const isFailed = s === 'FAILED' || s === 'CANCELLED' || (typeof data.ResultCode === 'number' && data.ResultCode !== 0 && !receipt);
    let mapped = 'PENDING';
    if (isSuccess) mapped = 'SUCCESS';
    else if (isFailed) mapped = 'FAILED';

    if (pid && mapped !== 'PENDING') {
      await rtdbUpdate(dbUrl, `payments/${pid}`, {
        status: mapped,
        MpesaReceiptNumber: receipt || '',
        resultDesc: data.ResultDesc || '',
        updatedAt: Date.now(),
      }).catch(() => {});
    }

    return res.json({ status: mapped, message: data.ResultDesc });
  } catch (e) {
    return res.json({ status: 'PENDING', message: e instanceof Error ? e.message : 'Could not fetch status' });
  }
}
