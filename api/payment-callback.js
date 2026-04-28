// Wrapper to match /api/payment-callback contract — delegates to ./payhero/callback.js
import handler from "./payhero/callback.js";

export default async function (req, res) {
  return handler(req, res);
}
