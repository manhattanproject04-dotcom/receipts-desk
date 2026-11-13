// Local preview: node dev/serve.mjs
// Without NOTION_TOKEN it serves clearly-labelled PLACEHOLDER data.
// With NOTION_TOKEN set in your shell it reads your real Notion databases.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { mockNotionFetch } from "./fixture.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const live = Boolean(process.env.NOTION_TOKEN);
globalThis.Netlify = { env: { get: (k) => process.env[k] || (k === "NOTION_TOKEN" && !live ? "placeholder" : undefined) } };
if (!live) globalThis.fetch = mockNotionFetch({ empty: process.env.EMPTY === "1" });
const { default: handler } = await import("../netlify/functions/data.mjs");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT) || 8888;
createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/api/data") {
    const r = await handler();
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  try {
    const file = join(root, normalize(path === "/" ? "/index.html" : path));
    if (!file.startsWith(root)) throw new Error("outside root");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`Receipts Desk preview on http://localhost:${port} (${live ? "LIVE Notion data" : "PLACEHOLDER data"})`));
