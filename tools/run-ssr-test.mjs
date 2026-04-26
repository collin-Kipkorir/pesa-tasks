import path from "path";
import { pathToFileURL } from "url";

async function run() {
  const built = path.resolve(process.cwd(), "dist", "server", "index.js");
  console.log("Loading server entry:", built);
  const mod = await import(pathToFileURL(built).href);
  const candidate = mod.default || mod.createServerEntry;
  if (!candidate) throw new Error("no factory found");
  const instance = typeof candidate === "function" ? await candidate() : candidate;
  console.log("Factory returned:", Object.keys(instance || {}));
  if (instance && typeof instance.fetch === "function") {
    const req = new Request("http://localhost/");
    const res = await instance.fetch(req);
    console.log("response status:", res.status);
    const txt = await res.text();
    console.log("response body (first 2k chars):\n", txt.slice(0, 2048));
  } else if (typeof instance === "function") {
    console.log("Factory returned a node handler function; cannot invoke here");
  } else {
    console.log("Unknown handler shape", typeof instance);
  }
}

run().catch((e) => { console.error(e.stack || e); process.exit(1); });
