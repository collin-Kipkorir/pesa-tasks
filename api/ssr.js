// SSR handler for Vercel — delegates to the built server entry (dist/server/index.js)
// This file is used when a request doesn't match an API route or static file.

import path from "path";

let nodeHandler = null;

async function ensureHandler() {
  if (nodeHandler) return nodeHandler;
  const built = path.resolve(process.cwd(), "dist", "server", "index.js");
  const mod = await import(built);
  // TanStack Start server build exports `createServerEntry` which returns a
  // Node-compatible request handler. Call it and reuse the result.
  if (typeof mod.createServerEntry === "function") {
    nodeHandler = await mod.createServerEntry();
  } else if (typeof mod.default === "function") {
    // Some builds export default as a handler factory
    nodeHandler = await mod.default();
  } else {
    throw new Error("No server entry factory found in dist/server");
  }
  return nodeHandler;
}

export default async function handler(req, res) {
  try {
    const h = await ensureHandler();
    // Delegate to built handler
    return h(req, res);
  } catch (e) {
    console.error("SSR handler error", e?.stack || e?.message || e);
    res.statusCode = 500;
    res.end("SSR error");
  }
}
