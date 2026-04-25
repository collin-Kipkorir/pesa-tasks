import path from "path";
import { pathToFileURL } from "url";

async function run() {
  const built = path.resolve(process.cwd(), "dist", "server", "index.js");
  console.log("Loading", built);
  const mod = await import(pathToFileURL(built).href);
  console.log("Exports:", Object.keys(mod));
  if (typeof mod.createServerEntry === "function") {
    console.log("createServerEntry is a function");
    const h = await mod.createServerEntry();
    console.log("createServerEntry() returned:", typeof h);
  }
  if (typeof mod.default === "function") {
    console.log("default export is a function");
    const h2 = await mod.default();
    console.log("default() returned:", typeof h2);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
