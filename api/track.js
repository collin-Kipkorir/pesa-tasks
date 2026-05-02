import { rtdbSet, rtdbUpdate } from "./_lib/rtdb-server.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const body = await (async () => {
      try { return req.body || JSON.parse(await readBody(req)); } catch { return req.body || {}; }
    })();
    const id = randomUUID();
    const payload = { id, ts: Date.now(), ...body };
    await rtdbSet(`analytics/installPrompts/${id}`, payload);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => s += c);
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}
