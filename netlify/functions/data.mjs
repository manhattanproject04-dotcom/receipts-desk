// GET /api/data
// The only place the Notion token is used. The response is cached on Netlify's
// CDN, so Notion is queried at most about once per CACHE_SECONDS no matter how
// many people load the site. No stale-while-revalidate: once the cached copy
// expires, the next visitor waits for a fresh read (about half a second), so a
// Notion edit is guaranteed to show within CACHE_SECONDS.

import { loadDesk, NotionError } from "./lib/notion.mjs";

const CACHE_SECONDS = 300; // 5 minutes

const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

const NO_STORE = { "Cache-Control": "no-store" };

export default async () => {
  const token = Netlify.env.get("NOTION_TOKEN");
  if (!token) {
    return json({ error: "not_configured" }, 503, NO_STORE);
  }

  try {
    const desk = await loadDesk({ token });
    return json(desk, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${CACHE_SECONDS}`,
    });
  } catch (err) {
    // Log detail server-side only; the browser gets a short reason code.
    console.error("Notion read failed:", err.message);
    const reason =
      err instanceof NotionError && err.status === 401
        ? "notion_unauthorized"
        : err instanceof NotionError && err.status === 404
          ? "notion_not_shared"
          : "notion_unavailable";
    return json({ error: reason }, 502, NO_STORE);
  }
};

export const config = { path: "/api/data", method: "GET" };
