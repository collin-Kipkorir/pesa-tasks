const express = require('express');
const fetch = require('node-fetch');
const { rtdbSet, rtdbGet, rtdbUpdate } = require('./lib/rtdb-server');
const { toMsisdn, normalizePhone, isValidKePhone } = require('./lib/phone');

const app = express();
app.use(express.json());

const PAYMENT_URL = process.env.PAYHERO_PAYMENT_URL || 'https://backend.payhero.co.ke/api/v2/payments';
const STATUS_URL = process.env.PAYHERO_STATUS_URL || 'https://backend.payhero.co.ke/api/v2/transaction-status';

app.post('/initiate', async (req, res) => {
  try {
    const body = req.body || {};
    const amount = Number(body.amount || 0);
    if (!amount || amount < 1) return res.status(400).json({ success: false, error: 'Invalid amount' });
    if (!body.phone) return res.status(400).json({ success: false, error: 'Missing phone' });
    const local = normalizePhone(body.phone);
    if (!isValidKePhone(local)) return res.status(400).json({ success: false, error: 'Invalid phone' });

    const payerMsisdn = toMsisdn(body.phone);
    const userPhone = normalizePhone(body.userPhone || '');
    const auth = process.env.PAYHERO_AUTH_TOKEN;
    const channelId = Number(process.env.PAYHERO_CHANNEL_ID || '3838');
    if (!auth) return res.status(500).json({ success: false, error: 'PayHero not configured' });

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const externalReference = body.externalReference || `PAY-${userPhone || 'guest'}-${Date.now()}`;
    const callbackUrl = (process.env.PUBLIC_BASE_URL || '') + `/api/payment-callback?pid=${paymentId}`;

    await rtdbSet(`payments/${paymentId}`, {
      paymentId, payerPhone: payerMsisdn, phone: userPhone, amount, purpose: body.purpose || 'payment', status: 'PENDING', externalReference, createdAt: Date.now()
    });

    const payload = { amount, phone_number: payerMsisdn, channel_id: channelId, provider: 'm-pesa', external_reference: externalReference, customer_name: userPhone || undefined, callback_url: callbackUrl };

    const r = await fetch(PAYMENT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify(payload) });
    const data = await r.json().catch(()=>null);
    if (!r.ok) {
      const msg = (data && (data.error || data.error_message)) || `PayHero ${r.status}`;
      await rtdbUpdate(`payments/${paymentId}`, { status: 'FAILED', resultDesc: msg, updatedAt: Date.now() });
      return res.status(400).json({ success: false, error: msg });
    }

    await rtdbUpdate(`payments/${paymentId}`, { status: data?.status || 'QUEUED', reference: data?.reference || '', CheckoutRequestID: data?.CheckoutRequestID || '', updatedAt: Date.now() });
    if (data?.reference) await rtdbSet(`paymentRefs/${data.reference}`, paymentId);
    if (data?.CheckoutRequestID) await rtdbSet(`paymentRefs/${data.CheckoutRequestID}`, paymentId);
    await rtdbSet(`paymentRefs/${externalReference}`, paymentId);

    return res.status(201).json({ success: true, status: data?.status || 'QUEUED', reference: data?.reference, CheckoutRequestID: data?.CheckoutRequestID || '', paymentId, externalReference });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'unknown' });
  }
});

app.post('/callback', async (req, res) => {
  try {
    const body = req.body || {};
    const r = body.response || body;
    if (!r) return res.status(200).json({ ok: true });
    let pid = req.query.pid || '';
    if (!pid) {
      const keys = [r.CheckoutRequestID, r.ExternalReference].filter(Boolean);
      for (const k of keys) {
        const found = await rtdbGet(`paymentRefs/${k}`);
        if (found) { pid = found; break; }
      }
    }
    if (!pid) return res.status(200).json({ ok: true });
    if (r.CheckoutRequestID) await rtdbSet(`paymentRefs/${r.CheckoutRequestID}`, pid);
    if (r.ExternalReference) await rtdbSet(`paymentRefs/${r.ExternalReference}`, pid);

    const isSuccess = r.ResultCode === 0 || Boolean(r.MpesaReceiptNumber) || (r.Status && r.Status.toString().toLowerCase()==='success');
    const desc = (r.ResultDesc || '').toLowerCase();
    const isCancelled = r.ResultCode === 1032 || desc.includes('cancel');
    const isFailed = !isSuccess && ((typeof r.ResultCode === 'number' && r.ResultCode !== 0) || (r.Status && r.Status.toString().toLowerCase()==='failed'));
    const isProcessing = !isSuccess && !isFailed && !isCancelled && (r.Status==='Processing' || r.Status==='Queued' || desc.includes('processing'));
    let status = null;
    if (isSuccess) status = 'SUCCESS'; else if (isCancelled) status = 'CANCELLED'; else if (isFailed) status = 'FAILED'; else if (isProcessing) status = 'PROCESSING';
    if (!status) return res.status(200).json({ ok: true });
    await rtdbUpdate(`payments/${pid}`, { status, ...(r.MpesaReceiptNumber ? { MpesaReceiptNumber: r.MpesaReceiptNumber } : {}), ...(r.ResultDesc ? { resultDesc: r.ResultDesc } : {}), updatedAt: Date.now() });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: true });
  }
});

app.get('/status', async (req, res) => {
  try {
    const paymentId = req.query.paymentId || '';
    const refParam = req.query.reference || '';
    let pid = paymentId; let doc = null;
    if (pid) doc = await rtdbGet(`payments/${pid}`);
    else if (refParam) { const found = await rtdbGet(`paymentRefs/${refParam}`); if (found) { pid = found; doc = await rtdbGet(`payments/${pid}`); } }
    if (doc?.status === 'SUCCESS' || doc?.status === 'FAILED' || doc?.status === 'CANCELLED') return res.status(200).json({ status: doc.status });
    const reference = doc?.reference || refParam; if (!reference) return res.status(200).json({ status: doc?.status || 'PENDING' });
    const auth = process.env.PAYHERO_AUTH_TOKEN;
    const r = await fetch(`${STATUS_URL}?reference=${encodeURIComponent(reference)}`, { headers: auth ? { Authorization: auth } : {} });
    const data = await r.json().catch(()=>null);
    const s = (data?.status || '').toString().toUpperCase();
    const receipt = data?.MpesaReceiptNumber || data?.mpesa_receipt_number || data?.provider_reference;
    const desc = (data?.ResultDesc || data?.result_desc || '').toLowerCase();
    const isSuccess = data?.ResultCode === 0 || s === 'SUCCESS' || (s === 'SUCCESS' && Boolean(receipt));
    const isCancelled = s === 'CANCELLED' || data?.ResultCode === 1032 || desc.includes('cancel');
    const isFailed = !isSuccess && !isCancelled && (s === 'FAILED' || (typeof data?.ResultCode === 'number' && data?.ResultCode !== 0 && !receipt));
    const isProcessing = !isSuccess && !isFailed && !isCancelled && (s === 'PROCESSING' || s === 'QUEUED' || desc.includes('processing'));
    let mapped = doc?.status || 'PENDING';
    if (isSuccess) mapped = 'SUCCESS'; else if (isCancelled) mapped = 'CANCELLED'; else if (isFailed) mapped = 'FAILED'; else if (isProcessing) mapped = 'PROCESSING';
    if (pid && mapped !== doc?.status) { await rtdbUpdate(`payments/${pid}`, { status: mapped, ...(receipt ? { MpesaReceiptNumber: receipt } : {}), ...(data?.ResultDesc || data?.result_desc ? { resultDesc: data?.ResultDesc || data?.result_desc } : {}), updatedAt: Date.now() }); }
    return res.status(200).json({ status: mapped, message: data?.ResultDesc || data?.result_desc });
  } catch (e) { return res.status(200).json({ status: 'PENDING', message: e?.message || 'Could not fetch status' }); }
});

module.exports = app;
