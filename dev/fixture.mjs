// PLACEHOLDER DATA for local development and tests only. None of this is real:
// no real official, quote, source, date or number appears here. It is shaped
// like Notion API responses so the real code path can run without a token.
// It is never deployed (it lives outside public/ and netlify/functions/).

const rt = (s) => (s ? [{ plain_text: s, href: null }] : []);
const title = (s) => ({ title: rt(s) });
const text = (s) => ({ rich_text: rt(s) });
const sel = (s) => ({ select: s ? { name: s } : null });
const status = (s) => ({ status: s ? { name: s } : null });
const url = (s) => ({ url: s || null });
const date = (s) => ({ date: s ? { start: s } : null });
const num = (n) => ({ number: n ?? null });
const check = (b) => ({ checkbox: !!b });
const rel = (...ids) => ({ relation: ids.map((id) => ({ id })) });

const official = (id, o) => ({
  id,
  properties: {
    Name: title(o.name), Office: text(o.office), Level: sel(o.level), District: text(o.district),
    Party: text(o.party), Tier: sel(o.tier), "Tracking Status": sel(o.tracking || "Active"),
    "Term Start": date(o.termStart), "Next Election": date(o.nextElection),
    "Official Site": url(o.site), "Voting Record Source": url(o.votes), "Campaign Finance Source": url(o.finance),
    "Latest Activity": text(o.activity), "Latest Activity Date": date(o.activityDate),
    "Latest Activity Source": url(o.activitySource), Notes: text(o.notes),
  },
});

const promise = (id, p) => ({
  id,
  properties: {
    Promise: title(p.promise), Official: rel(...(p.officials || [])), "Exact Quote": text(p.quote),
    "Quote Source": url(p.quoteSource), "Date Said": date(p.dateSaid), "Issue Area": sel(p.issue),
    Weight: num(p.weight), Status: status(p.status), Evidence: text(p.evidence),
    "Evidence Source": url(p.evidenceSource), "Episode Candidate": check(p.episode),
    "Last Reviewed": date(p.reviewed),
    "My Prediction": sel("Will keep"), "Prediction Correct": sel("Pending"), // must never reach the browser
  },
});

export const officials = [
  official("o1", { name: "PLACEHOLDER Official A", office: "Placeholder Office One", level: "State", district: "Placeholder District 1", party: "Party X", tier: "Tier 1", termStart: "2099-01-01", site: "https://example.com/a", votes: "https://example.com/a/votes", activity: "Placeholder activity text for official A.", activityDate: "2099-02-03", activitySource: "https://example.com/a/news", notes: "SECRET-NOTE private text that must never reach the browser." }),
  official("o2", { name: "PLACEHOLDER Official B", office: "Placeholder Office Two", level: "Local", district: "Placeholder District 2", party: "Party Y", tier: "Tier 1", activity: "Placeholder activity with no source and no date. NEEDS REFRESH: placeholder reason text.", notes: "PROVISIONAL: SECRET-NOTE placeholder." }),
  official("o3", { name: "PLACEHOLDER <img src=x onerror=alert(1)> C", office: "Placeholder Office Three", level: "Federal", district: "Placeholder", party: "Party Z", tier: "Tier 2", activity: "<script>alert('xss')</script> placeholder", activityDate: "2099-03-01", activitySource: "javascript:alert(1)" }),
  official("o4", { name: "PLACEHOLDER Official D", office: "Placeholder Office Four", level: "Local", district: "Placeholder", party: "Party X", tier: "Tier 3", activity: "", }),
  official("o5", { name: "PLACEHOLDER Official E (paused)", office: "Placeholder Office Five", level: "State", district: "Placeholder", party: "Party Y", tracking: "Paused", activity: "Placeholder activity.", activityDate: "2099-01-05", activitySource: "https://example.com/e" }),
  official("o6", { name: "PLACEHOLDER Official F (no tier)", office: "Placeholder Office Six", level: "State", district: "Placeholder", party: "Party Z", activity: "Placeholder activity.", activityDate: "2099-01-06", activitySource: "https://example.com/f" }),
];

export const promises = [
  promise("p1", { promise: "PLACEHOLDER promise one", officials: ["o1"], quote: "Placeholder quote text, not a real statement.", quoteSource: "https://example.com/q1", dateSaid: "2099-01-10", issue: "Housing", weight: 5, status: "In motion", evidence: "Placeholder evidence text.", evidenceSource: "https://example.com/e1", reviewed: "2099-02-01" }),
  promise("p2", { promise: "PLACEHOLDER promise two", officials: ["o1"], quoteSource: "https://example.com/q2", issue: "Taxes", weight: 3, status: "Not started", evidence: "Placeholder evidence with no source." }),
  promise("p3", { promise: "PLACEHOLDER promise three", officials: ["o1"], issue: "Transit", weight: 1, status: "Kept", evidence: "Placeholder evidence.", evidenceSource: "https://example.com/e3" }),
  promise("p4", { promise: "PLACEHOLDER promise four", officials: ["o2"], issue: "Housing", status: "Broken", evidence: "Placeholder evidence.", evidenceSource: "https://example.com/e4" }),
  promise("p5", { promise: "PLACEHOLDER promise five", officials: ["o2"], issue: "Health", weight: 4, status: "Stalled" }),
  promise("p6", { promise: "PLACEHOLDER promise six", officials: ["o3"], issue: "Other", weight: 2, status: "Compromised" }),
  promise("p7", { promise: "PLACEHOLDER promise seven", officials: ["o3"], issue: "Other", weight: 2, status: "Abandoned" }),
];

export const briefings = [
  { id: "b1", properties: { Briefing: title("PLACEHOLDER briefing, earlier week"), "Week Of": date("2099-01-05"), "Officials Covered": rel("o1"), Flags: num(0), Headline: text("Placeholder headline one."), "Episode Material": check(false), "Reviewed By Me": check(true) } },
  { id: "b2", properties: { Briefing: title("PLACEHOLDER briefing, later week"), "Week Of": date("2099-01-12"), "Officials Covered": rel("o1", "o2"), Flags: num(2), Headline: text("Placeholder headline two."), "Episode Material": check(true), "Reviewed By Me": check(false) } },
];

export const blocks = {
  b1: [],
  b2: [
    { type: "heading_2", heading_2: { rich_text: rt("Placeholder section") } },
    { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Placeholder paragraph with a ", href: null }, { plain_text: "source link", href: "https://example.com/src" }, { plain_text: ".", href: null }] } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("Placeholder bullet one") } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("Placeholder bullet two") } },
    { type: "image", image: {} },
  ],
};

// A stand-in for fetch() that answers the Notion endpoints the site uses.
// `opts.empty` returns no briefings, `opts.pageSize` forces pagination.
export function mockNotionFetch(opts = {}) {
  const calls = [];
  const tables = { "1b514b9b-b945-449b-87f4-eea2176f8c1a": officials, "02dad62b-a744-410e-8477-548d6ec6bf8a": promises, "54840704-ed94-4c38-858c-a28052e52a76": opts.empty ? [] : briefings };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fn = async (input, init = {}) => {
    const u = new URL(input);
    calls.push({ url: u.href, auth: init.headers && init.headers.Authorization, version: init.headers && init.headers["Notion-Version"] });
    if (opts.status) return json({ code: "mock_error" }, opts.status);
    let m = /^\/v1\/data_sources\/([^/]+)\/query$/.exec(u.pathname);
    if (m && tables[m[1]]) {
      const size = opts.pageSize || 100;
      const start = Number(JSON.parse(init.body || "{}").start_cursor || 0);
      const slice = tables[m[1]].slice(start, start + size);
      const more = start + size < tables[m[1]].length;
      return json({ results: slice, has_more: more, next_cursor: more ? String(start + size) : null });
    }
    m = /^\/v1\/blocks\/([^/]+)\/children$/.exec(u.pathname);
    if (m) return json({ results: blocks[m[1]] || [], has_more: false });
    return json({ code: "object_not_found" }, 404);
  };
  fn.calls = calls;
  return fn;
}
