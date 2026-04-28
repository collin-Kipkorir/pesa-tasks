// Wrapper to match /api/pay contract — delegates to ./payhero/initiate.js
import handler from "./payhero/initiate.js";

export default async function (req, res) {
  return handler(req, res);
}
