/* Vercel serverless endpoint to initiate a PayHero STK payment.
   Mirrors the server logic in src/routes/api.payhero.initiate.ts but as a
   simple Node (serverless) handler so Vercel can receive requests and set the
   callback URL correctly.

   Required env vars:
     - PAYHERO_AUTH_TOKEN
     - PAYHERO_CHANNEL_ID (optional)
     - FIREBASE_DB_SECRET (for RTDB server writes)
     - FIREBASE_DB_URL (optional, defaults to the value used in the repo)
     - PUBLIC_BASE_URL (optional, recommended: https://your-deployed-domain)
*/

const PAYMENT_URL = 'https://backend.payhero.co.ke/api/v2/payments';
const DEFAULT_DB_URL = 'https://surveys-2791f-default-rtdb.firebaseio.com';

function withAuthUrl(dbUrl, path) {
  const secret = process.env.FIREBASE_DB_SECRET;
  const url = `${dbUrl.replace(/\/$/, '')}/${path}.json`;
  return secret ? `${url}?auth=${encodeURIComponent(secret)}` : url;
}

async function rtdbSet(dbUrl, path, value) {
  const res = await fetch(withAuthUrl(dbUrl, path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`RTDB set ${path} failed: ${res.status}`);
}

async function rtdbUpdate(dbUrl, path, patch) {
  const res = await fetch(withAuthUrl(dbUrl, path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`RTDB update ${path} failed: ${res.status}`);
}

function normalizePhone(phone) {
  if (!phone) return '';
  let s = String(phone).trim();
  s = s.replace(/[^0-9+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0') && s.length === 10) {
    // 07xxxxxxxx -> 2547xxxxxxxx
    return '254' + s.slice(1);
  }
  if (s.length === 9 && s.startsWith('7')) return '254' + s;
  if (s.startsWith('254')) return s;
  return s; // best-effort
}

function isValidKePhone(p) {
  return typeof p === 'string' && /^2547\d{8}$/.test(p);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const amount = Number(body.amount);
    if (!amount || amount < 1 || amount > 1000000) return res.status(400).json({ success: false, error: 'Invalid amount' });
    if (!body.purpose || (body.purpose !== 'activation' && body.purpose !== 'vip')) return res.status(400).json({ success: false, error: 'Invalid purpose' });

    const localPayer = normalizePhone(body.phone);
    if (!isValidKePhone(localPayer)) return res.status(400).json({ success: false, error: 'Invalid phone number' });
    const payerMsisdn = localPayer;
    const userPhone = normalizePhone(body.userPhone || '');

    const auth = process.env.PAYHERO_AUTH_TOKEN;
    const channelId = Number(process.env.PAYHERO_CHANNEL_ID || '3838');
    if (!auth) return res.status(500).json({ success: false, error: 'PayHero not configured' });

    const dbUrl = process.env.FIREBASE_DB_URL || DEFAULT_DB_URL;

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const externalReference = `${(body.purpose || 'PAY').toUpperCase()}-${userPhone || 'unknown'}-${Date.now()}`;

    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    const host = process.env.PUBLIC_BASE_URL || `${forwardedProto}://${req.headers.host}`;
    const publicBase = String(host).replace(/\/$/, '');
    const callbackUrl = `${publicBase}/api/payhero/callback?pid=${paymentId}`;

    await rtdbSet(dbUrl, `payments/${paymentId}`, {
      paymentId,
      phone: userPhone,
      payerPhone: payerMsisdn,
      amount,
      purpose: body.purpose,
      status: 'PENDING',
      externalReference,
      createdAt: Date.now(),
    });

    const payload = {
      amount,
      phone_number: payerMsisdn,
      channel_id: channelId,
      provider: 'm-pesa',
      external_reference: externalReference,
      customer_name: userPhone,
      callback_url: callbackUrl,
    };

    const phRes = await fetch(PAYMENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(payload),
    });
    const data = await phRes.json().catch(() => ({}));

    if (!phRes.ok || !data.success || !data.reference) {
      await rtdbUpdate(dbUrl, `payments/${paymentId}`, {
        status: 'FAILED',
        resultDesc: data.error_message || data.error || `PayHero ${phRes.status}`,
        updatedAt: Date.now(),
      }).catch(() => {});
      return res.status(400).json({ success: false, paymentId, error: data.error_message || data.error || `PayHero ${phRes.status}` });
    }

    await rtdbUpdate(dbUrl, `payments/${paymentId}`, {
      reference: data.reference,
      CheckoutRequestID: data.CheckoutRequestID || '',
      updatedAt: Date.now(),
    }).catch(() => {});

    if (data.reference) await rtdbSet(dbUrl, `paymentRefs/${data.reference}`, paymentId).catch(() => {});
    if (data.CheckoutRequestID) await rtdbSet(dbUrl, `paymentRefs/${data.CheckoutRequestID}`, paymentId).catch(() => {});
    await rtdbSet(dbUrl, `paymentRefs/${externalReference}`, paymentId).catch(() => {});

    return res.json({ success: true, paymentId, reference: data.reference, checkoutRequestId: data.CheckoutRequestID, externalReference });
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
  }
}
