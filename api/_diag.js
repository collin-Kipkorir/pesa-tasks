// Safe diagnostic endpoint - returns presence booleans for required env vars
export default async function handler(req, res) {
  try {
    const keys = [
      'PAYHERO_AUTH_TOKEN',
      'PAYHERO_CHANNEL_ID',
      'PUBLIC_BASE_URL',
      'VITE_PAYHERO_AUTH_TOKEN',
      'VITE_PAYHERO_CHANNEL_ID',
      'VITE_PAYHERO_BASE_URL'
    ];

    const env = {};
    for (const k of keys) env[k] = !!process.env[k];

    return res.status(200).json({ ok: true, env, timestamp: Date.now() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'diag error' });
  }
}
