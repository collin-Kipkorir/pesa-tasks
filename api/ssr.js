import path from "path";
import { pathToFileURL } from "url";

let handlerFactory = null;
let handlerInstance = null;

async function loadEntry() {
  if (handlerFactory) return handlerFactory;
  const built = path.resolve(process.cwd(), "dist", "server", "index.js");
  try {
    console.log("[ssr] loading built server entry:", built);
    const mod = await import(pathToFileURL(built).href);
    console.log("[ssr] module keys:", Object.keys(mod));
    // Prefer a fully-initialized default export when available (the build often
    // exports a ready-to-use server entry as `default`). Fall back to
    // createServerEntry factory if default is not provided.
    handlerFactory = mod.default || mod.createServerEntry;
    console.log("[ssr] resolved factory type:", typeof handlerFactory);
    if (!handlerFactory) {
      console.error("[ssr] no factory found in module exports", Object.keys(mod));
      throw new Error("No server entry factory found in dist/server/index.js");
    }
    return handlerFactory;
  } catch (e) {
    console.error("[ssr] failed loading server entry:", e?.stack || e?.message || e);
    throw e;
  }
}

function nodeReqToRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host;
  const url = `${protocol}://${host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, String(vv)));
    else if (v != null) headers.set(k, String(v));
  }
  const body = req.method === "GET" || req.method === "HEAD" ? null : req;
  return new Request(url, { method: req.method, headers, body });
}

async function respondWithNode(res, response) {
  res.statusCode = response.status;
  for (const [k, v] of response.headers) {
    // Node can't set some headers after body start; set all before piping
    res.setHeader(k, v);
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    // No body or not a stream
    const text = await response.text();
    res.end(text);
    return;
  }
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    }
  });
  const nodeStream = stream.pipeTo ? stream : null;
  // Fallback: consume by reading chunks and writing to res
  const reader2 = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

export default async function handler(req, res) {
  try {
    const factory = await loadEntry();
    if (!handlerInstance) {
      // The factory may return an object with a `fetch` method (worker style)
      handlerInstance = await factory();
    }
    // If instance has fetch, call as web fetch handler
    if (handlerInstance && typeof handlerInstance.fetch === "function") {
      const webReq = nodeReqToRequest(req);
      const webRes = await handlerInstance.fetch(webReq);
      return respondWithNode(res, webRes);
    }
    // Otherwise, if the factory returned a Node-compatible handler function
    if (typeof handlerInstance === "function") {
      return handlerInstance(req, res);
    }
    // If the factory itself is a function that handles req/res
    if (typeof factory === "function") {
      const maybe = await factory(req, res);
      if (maybe) return maybe;
    }
    res.statusCode = 500;
    res.end("No usable server handler found");
  } catch (err) {
    console.error("SSR proxy error:", err?.stack || err?.message || err);
    res.statusCode = 500;
    res.end("SSR error");
  }
}
