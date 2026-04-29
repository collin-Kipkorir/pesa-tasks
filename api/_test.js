// Simple health/test endpoint to confirm serverless functions are deployed
export default async function handler(req, res) {
  return res.status(200).json({ ok: true, path: "/api/_test", now: Date.now() });
}
