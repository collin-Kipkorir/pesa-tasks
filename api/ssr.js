// SSR handler for Vercel — delegates to the built server entry (dist/server/index.js)
// This file is used when a request doesn't match an API route or static file.

import path from 'path';

let serverEntry = null;

async function loadServerEntry() {
  if (serverEntry) return serverEntry;
  // Resolve the built server entry
  const built = path.resolve(process.cwd(), 'dist', 'server', 'index.js');
  // Use dynamic import so Vercel can load the file at runtime
  serverEntry = await import(built);
  return serverEntry;
}

export default async function handler(req, res) {
  try {
    const entry = await loadServerEntry();
    // The build exports a default handler compatible with Node's request handler
    const fn = entry.default || entry.createServerEntry;
    if (typeof fn !== 'function') {
      res.statusCode = 500;
      res.end('Server entry not usable');
      return;
    }
    // Call the server entry with the Node req/res — the build should handle it.
    await fn(req, res);
  } catch (e) {
    console.error('SSR handler error', e);
    res.statusCode = 500;
    res.end('SSR error');
  }
}
