// Reads the three Receipts Desk data sources from Notion and maps them to the
// small, whitelisted JSON shape the browser is allowed to see.
//
// Nothing in here computes a verdict. Statuses, weights and text are passed
// through exactly as stored in Notion.

export const DATA_SOURCES = {
  officials: "1b514b9b-b945-449b-87f4-eea2176f8c1a",
  promises: "02dad62b-a744-410e-8477-548d6ec6bf8a",
  briefings: "54840704-ed94-4c38-858c-a28052e52a76",
};

// Order used for scorecards and filters. Mirrors the Status options in Notion.
export const STATUS_ORDER = [
  "Not started",
  "In motion",
  "Stalled",
  "Kept",
  "Compromised",
  "Broken",
  "Abandoned",
];

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";
const MAX_BRIEFING_BODIES = 12; // newest N briefings get their page body fetched

export class NotionError extends Error {
  constructor(status, code) {
    super(`Notion API ${status} ${code || ""}`.trim());
    this.status = status;
    this.code = code;
  }
}

async function notionFetch(path, { token, fetchImpl, method = "GET", body }) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${NOTION_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 2) {
      const wait = Math.min(Number(res.headers.get("retry-after")) || 1, 5);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      let code;
      try {
        code = (await res.json()).code;
      } catch {
        /* ignore */
      }
      throw new NotionError(res.status, code);
    }
    return res.json();
  }
}

async function queryAll(dataSourceId, ctx) {
  const rows = [];
  let cursor;
  do {
    const page = await notionFetch(`/data_sources/${dataSourceId}/query`, {
      ...ctx,
      method: "POST",
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// ---- property readers -------------------------------------------------------

const text = (p) =>
  ((p && (p.title || p.rich_text)) || []).map((t) => t.plain_text).join("").trim();
const select = (p) => (p && (p.select || p.status) ? (p.select || p.status).name : "") || "";
const date = (p) => (p && p.date && p.date.start) || "";
const number = (p) => (p && typeof p.number === "number" ? p.number : null);
const checkbox = (p) => Boolean(p && p.checkbox);
const relation = (p) => ((p && p.relation) || []).map((r) => r.id);
// Only http(s) links are ever passed to the browser.
const url = (p) => {
  const v = p && typeof p.url === "string" ? p.url.trim() : "";
  return /^https?:\/\//i.test(v) ? v : "";
};

function slugify(name) {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "official"
  );
}

// ---- row mappers ------------------------------------------------------------
// Fields deliberately NOT mapped (never leave the server):
//   Officials: Notes (may contain personal details)
//   Promises:  My Prediction, Prediction Date, Prediction Correct
//   Briefings: Reviewed By Me

function mapOfficial(row) {
  const p = row.properties;
  const latestActivity = text(p["Latest Activity"]);
  return {
    id: row.id,
    name: text(p["Name"]),
    office: text(p["Office"]),
    level: select(p["Level"]),
    district: text(p["District"]),
    party: text(p["Party"]),
    tier: select(p["Tier"]),
    trackingStatus: select(p["Tracking Status"]),
    termStart: date(p["Term Start"]),
    nextElection: date(p["Next Election"]),
    officialSite: url(p["Official Site"]),
    votingRecordSource: url(p["Voting Record Source"]),
    campaignFinanceSource: url(p["Campaign Finance Source"]),
    latestActivity,
    latestActivityDate: date(p["Latest Activity Date"]),
    latestActivitySource: url(p["Latest Activity Source"]),
    // Flags are markers typed into Notion text. Only the boolean is exposed.
    needsRefresh: /NEEDS REFRESH/.test(latestActivity),
    provisional: /PROVISIONAL/.test(text(p["Notes"])),
  };
}

function mapPromise(row) {
  const p = row.properties;
  return {
    id: row.id,
    promise: text(p["Promise"]),
    officialIds: relation(p["Official"]),
    exactQuote: text(p["Exact Quote"]),
    quoteSource: url(p["Quote Source"]),
    dateSaid: date(p["Date Said"]),
    issueArea: select(p["Issue Area"]),
    weight: number(p["Weight"]),
    status: select(p["Status"]),
    evidence: text(p["Evidence"]),
    evidenceSource: url(p["Evidence Source"]),
    episodeCandidate: checkbox(p["Episode Candidate"]),
    lastReviewed: date(p["Last Reviewed"]),
  };
}

function mapBriefing(row) {
  const p = row.properties;
  return {
    id: row.id,
    title: text(p["Briefing"]),
    weekOf: date(p["Week Of"]),
    officialIds: relation(p["Officials Covered"]),
    flags: number(p["Flags"]),
    headline: text(p["Headline"]),
    episodeMaterial: checkbox(p["Episode Material"]),
    blocks: [],
    bodyTruncated: false,
  };
}

// ---- briefing page bodies ---------------------------------------------------

const BLOCK_TYPES = {
  paragraph: "p",
  heading_1: "h1",
  heading_2: "h2",
  heading_3: "h3",
  bulleted_list_item: "li",
  numbered_list_item: "oli",
  to_do: "li",
  quote: "quote",
  callout: "quote",
  divider: "hr",
};

function mapBlock(block) {
  const kind = BLOCK_TYPES[block.type];
  if (!kind) return null;
  if (kind === "hr") return { kind, spans: [] };
  const rich = (block[block.type] && block[block.type].rich_text) || [];
  const spans = rich
    .map((t) => ({
      text: t.plain_text || "",
      href: t.href && /^https?:\/\//i.test(t.href) ? t.href : "",
    }))
    .filter((s) => s.text);
  return spans.length ? { kind, spans } : null;
}

async function loadBriefingBody(briefing, ctx) {
  const page = await notionFetch(`/blocks/${briefing.id}/children?page_size=100`, ctx);
  briefing.blocks = page.results.map(mapBlock).filter(Boolean);
  // Nested blocks and anything past the first 100 blocks are not rendered.
  briefing.bodyTruncated = Boolean(page.has_more) || page.results.some((b) => b.has_children);
}

// ---- entry point ------------------------------------------------------------

export async function loadDesk({ token, fetchImpl = fetch, now = new Date() }) {
  const ctx = { token, fetchImpl };

  const [officialRows, promiseRows, briefingRows] = await Promise.all([
    queryAll(DATA_SOURCES.officials, ctx),
    queryAll(DATA_SOURCES.promises, ctx),
    queryAll(DATA_SOURCES.briefings, ctx),
  ]);

  const officials = officialRows.map(mapOfficial).filter((o) => o.name);
  const seen = new Map();
  for (const o of officials.sort((a, b) => a.name.localeCompare(b.name))) {
    const base = slugify(o.name);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    o.slug = n === 1 ? base : `${base}-${n}`;
  }

  const promises = promiseRows.map(mapPromise).filter((p) => p.promise);

  const briefings = briefingRows
    .map(mapBriefing)
    .sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || ""));
  for (const b of briefings.slice(0, MAX_BRIEFING_BODIES)) {
    await loadBriefingBody(b, ctx);
  }

  return {
    generatedAt: now.toISOString(),
    statusOrder: STATUS_ORDER,
    officials,
    promises,
    briefings,
  };
}
