# The Receipts Desk

A read-only dashboard for the Receipts Desk civic tracker. Notion is the only
data store; this site displays what is logged there.

- `public/` — static site (HTML, CSS, one JS file). No framework, no build step.
- `netlify/functions/data.mjs` — the one function, `GET /api/data`. It reads
  Notion with the token and returns whitelisted JSON.
- `netlify/functions/lib/notion.mjs` — Notion queries and the field whitelist.
- `dev/` — local preview server, tests, and PLACEHOLDER fixture data. Never deployed.

There are no npm dependencies.

## Setup

1. **Create a Notion integration.** In Notion: Settings → Connections →
   Develop or manage integrations → New integration. Type: Internal.
   Capabilities: **Read content** only (no update, insert, comment or user
   information). Copy the integration secret.
2. **Share one page with it.** Open the hub page *The Receipts Desk — Civic
   Tracker* → `•••` menu → Connections → add the integration. The three
   databases (Officials, Promises, Weekly Briefings) sit under that page and
   inherit access. Nothing else needs sharing.
3. **Set the environment variable in Netlify.** Project → Project
   configuration → Environment variables → Add a variable:

   | Key | Value | Scope |
   |---|---|---|
   | `NOTION_TOKEN` | the integration secret | Functions |

   Mark it as secret. This is the only variable.
4. **Redeploy** so the function picks the variable up (Deploys → Trigger
   deploy, or `npx netlify deploy --prod`).

The token is read only inside the function. It is never written to the repo,
the static files, or the JSON sent to the browser.

## How refresh works

The browser calls `/api/data`. Netlify's CDN caches that response for
**5 minutes**. After that, the next page load reads Notion again (about half a
second slower) and caches the new copy. So:

- Notion is queried at most about once per 5 minutes, however many page views.
- An edit in Notion shows up within 5 minutes; reload the page to see it.
- A new deploy clears the cache immediately.
- No scheduled rebuilds, so refreshing uses no deploys.

To change the interval, edit `CACHE_SECONDS` in `netlify/functions/data.mjs`.
The footer of every page shows when the data was last pulled.

## What is shown, and what is not

Shown as stored: official name, office, level, district, party, tier, term
start, next election, source links, latest activity; promise text, quote,
sources, date said, issue area, weight, status, evidence, last reviewed;
briefing title, week, headline, flag count, officials covered, and page body
(headings, paragraphs, lists, quotes, links; first 100 top-level blocks of the
12 newest briefings).

Never sent to the browser: Officials **Notes**; Promises **My Prediction**,
**Prediction Date**, **Prediction Correct**; Briefings **Reviewed By Me**.

Flags are read from text typed into Notion:

- `NEEDS REFRESH` anywhere in an official's *Latest Activity* → "Needs refresh" badge.
- `PROVISIONAL` anywhere in an official's *Notes* → "Provisional" badge (only
  the badge is exposed, not the note).

A missing source is shown as "unsourced"; it is never hidden. The site never
computes a status: it prints the Status value from Notion.

## Add an official

Add a row to the Officials database in Notion. It appears after the next
refresh. Set:

- **Name**, **Office**, **Tracking Status** = Active
- **Tier** = Tier 1, Tier 2 or Tier 3 (blank shows under "No tier set")
- **Latest Activity**, **Latest Activity Date**, **Latest Activity Source**

To add promises, add rows to Promises and link each to the official in the
**Official** relation. Paused officials are listed at the bottom of the
overview. No code changes or redeploys are needed for any of this.

If you add a new Status option or Issue Area in Notion it will display, but new
statuses use the default colour until added to `public/styles.css`
(`.status-<name>`) and `STATUS_ORDER` in `lib/notion.mjs`.

## Key art

Put a 16:9 image at `public/hero.jpg` and push it to GitHub. Until then the
overview shows a plain banner; once the image exists it becomes a 16:9 frame.

## Visibility

The site allows search engines to index it. Who can open it is controlled in
Netlify (project page → Make public / Visitor access), not in this code. To
hide it from search again, set `robots.txt` to `Disallow: /` and add an
`X-Robots-Tag = "noindex, nofollow"` header in `netlify.toml`.

## Local preview and tests

```bash
node dev/serve.mjs            # PLACEHOLDER data, http://localhost:8888
NOTION_TOKEN=... node dev/serve.mjs   # your real Notion data
node --test dev/test.mjs
```

## Deploy

```bash
npx netlify deploy --prod
```
