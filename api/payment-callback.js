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
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const dbUrl = process.env.FIREBASE_DB_URL || DEFAULT_DB_URL;
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pidFromQuery = url.searchParams.get('pid');

    const body = req.body || {};
    const r = body.response || null;
    if (!r) return res.json({ ok: true });

    let paymentId = pidFromQuery || '';
    if (!paymentId) {
      const tryKeys = [r.CheckoutRequestID, r.ExternalReference].filter(Boolean);
      for (const k of tryKeys) {
        const found = await rtdbGet(dbUrl, `paymentRefs/${k}`);
        if (found) {
          paymentId = found;
          break;
        }
      }
    }
    if (!paymentId) return res.json({ ok: true });

    const isSuccess = r.ResultCode === 0 || Boolean(r.MpesaReceiptNumber);
    const isFailed = (typeof r.ResultCode === 'number' && r.ResultCode !== 0) || r.Status === 'Failed';
    const status = isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING';
    if (status === 'PENDING') return res.json({ ok: true });

    await rtdbUpdate(dbUrl, `payments/${paymentId}`, {
      status,
      MpesaReceiptNumber: r.MpesaReceiptNumber || '',
      resultDesc: r.ResultDesc || '',
      updatedAt: Date.now(),
    }).catch(() => {});

    return res.json({ ok: true });
  } catch (e) {
    return res.json({ ok: true });
  }
}
