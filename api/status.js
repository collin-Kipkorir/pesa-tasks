// Wrapper to match /api/status contract — delegates to ./payhero/status.js
import handler from "./payhero/status.js";

export default async function (req, res) {
  return handler(req, res);
}
