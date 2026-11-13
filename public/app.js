// The Receipts Desk — read-only front end.
// Renders whatever /api/data returns. All text is inserted with textContent,
// never as HTML, and nothing here decides a promise's status.

(() => {
  "use strict";

  const main = document.getElementById("main");
  const TIERS = [
    { key: "Tier 1", label: "Tier 1", cadence: "Weekly, in depth" },
    { key: "Tier 2", label: "Tier 2", cadence: "Weekly, headline only" },
    { key: "Tier 3", label: "Tier 3", cadence: "Monthly" },
  ];
  let desk = null;

  // ---- tiny DOM helpers -----------------------------------------------------

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");

  function host(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return "source";
    }
  }

  // A source link, or a visible "unsourced" marker. Never silently omitted.
  function source(u, label) {
    const href = safeUrl(u);
    if (!href) return h("span", { class: "tag tag-unsourced" }, `${label}: unsourced`);
    return h(
      "a",
      { class: "source", href, target: "_blank", rel: "noopener noreferrer" },
      `${label}: ${host(href)}`,
      h("span", { class: "ext", "aria-hidden": "true" }, " ↗"),
    );
  }

  function fmtDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.toLocaleDateString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const statusClass = (s) => "status status-" + (s || "none").toLowerCase().replace(/[^a-z]+/g, "-");
  const statusChip = (s) => h("span", { class: statusClass(s) }, s || "No status set");

  function flags(o) {
    return [
      o.provisional &&
        h("span", { class: "tag tag-provisional", title: "Marked provisional in the source log" }, "Provisional"),
      o.needsRefresh &&
        h("span", { class: "tag tag-refresh", title: "Marked NEEDS REFRESH in the source log" }, "Needs refresh"),
    ];
  }

  // ---- data helpers ---------------------------------------------------------

  const promisesFor = (o) => desk.promises.filter((p) => p.officialIds.includes(o.id));
  const officialById = (id) => desk.officials.find((o) => o.id === id);

  function byWeight(a, b) {
    return (b.weight ?? -1) - (a.weight ?? -1) || a.promise.localeCompare(b.promise);
  }

  function scorecard(list) {
    if (!list.length) return h("p", { class: "muted small" }, "No promises logged yet.");
    const known = desk.statusOrder;
    const extra = [...new Set(list.map((p) => p.status))].filter((s) => !known.includes(s));
    return h(
      "ul",
      { class: "scorecard", "aria-label": "Promises by status" },
      [...known, ...extra]
        .map((s) => [s, list.filter((p) => p.status === s).length])
        .filter(([, n]) => n > 0)
        .map(([s, n]) => h("li", { class: statusClass(s) }, h("b", {}, n), " ", s || "No status set")),
    );
  }

  // The NEEDS REFRESH note is typed into the activity text. Show the text as
  // logged, with the note split out so it reads as a flag rather than a fact.
  function activity(o, { full } = {}) {
    const raw = o.latestActivity || "";
    const i = raw.indexOf("NEEDS REFRESH");
    const body = (i >= 0 ? raw.slice(0, i) : raw).trim();
    const note = i >= 0 ? raw.slice(i).replace(/^NEEDS REFRESH:?\s*/, "").trim() : "";
    return h(
      "div",
      { class: "activity" },
      h(
        "p",
        { class: "meta" },
        "Latest logged activity · ",
        o.latestActivityDate
          ? h("time", { datetime: o.latestActivityDate }, fmtDate(o.latestActivityDate))
          : h("span", { class: "tag tag-unsourced" }, "undated"),
      ),
      body ? h("p", { class: full ? "" : "clamp" }, body) : h("p", { class: "muted" }, "No activity logged."),
      note && h("p", { class: "refresh-note" }, h("b", {}, "Needs refresh: "), note),
      body && h("p", { class: "sources" }, source(o.latestActivitySource, "Source")),
    );
  }

  // ---- views ----------------------------------------------------------------

  function officialCard(o) {
    return h(
      "article",
      { class: "card" },
      h(
        "header",
        {},
        h("h3", {}, h("a", { href: `#/official/${o.slug}` }, o.name)),
        h("p", { class: "office" }, [o.office, o.district].filter(Boolean).join(" · ")),
        h("p", { class: "flags" }, flags(o)),
      ),
      activity(o),
      h("div", { class: "card-foot" }, scorecard(promisesFor(o))),
    );
  }

  function viewOverview() {
    const active = desk.officials.filter((o) => o.trackingStatus === "Active");
    const paused = desk.officials.filter((o) => o.trackingStatus !== "Active");
    const untiered = active.filter((o) => !TIERS.some((t) => t.key === o.tier));

    const hero = h(
      "section",
      { class: "hero", "aria-label": "Key art" },
      h("div", { class: "hero-placeholder" }, h("span", {}, "Key art slot · 16:9"), h("small", {}, "Add public/hero.jpg to fill this frame")),
      h("img", { class: "hero-img", src: "/hero.jpg", alt: "" }),
      h(
        "div",
        { class: "hero-copy" },
        h("p", { class: "kicker" }, "Civic tracker"),
        h("h1", {}, "What they said. What they did."),
        h(
          "p",
          { class: "hero-stats" },
          h("span", {}, h("b", {}, active.length), " officials tracked"),
          h("span", {}, h("b", {}, desk.promises.length), " promises logged"),
          h("span", {}, h("b", {}, desk.briefings.length), " weekly briefings"),
        ),
      ),
    );
    hero.querySelector(".hero-img").addEventListener("error", (e) => e.target.remove());

    const tierSection = (title, cadence, list) =>
      list.length &&
      h(
        "section",
        { class: "tier" },
        h("div", { class: "tier-head" }, h("h2", {}, title), cadence && h("p", { class: "meta" }, cadence), h("p", { class: "meta count" }, `${list.length} officials`.replace(/^1 officials/, "1 official"))),
        h("div", { class: "grid" }, list.map(officialCard)),
      );

    return [
      hero,
      h(
        "section",
        { class: "overall" },
        h("h2", { class: "label" }, "All logged promises, by status"),
        scorecard(desk.promises),
      ),
      TIERS.map((t) => tierSection(t.label, t.cadence, active.filter((o) => o.tier === t.key))),
      tierSection("No tier set", "", untiered),
      paused.length &&
        h(
          "section",
          { class: "paused" },
          h("h2", { class: "label" }, `Paused (${paused.length})`),
          h(
            "ul",
            {},
            paused.map((o) =>
              h("li", {}, h("a", { href: `#/official/${o.slug}` }, o.name), " — ", [o.office, o.district].filter(Boolean).join(" · ")),
            ),
          ),
        ),
    ];
  }

  function promiseItem(p, { showOfficial } = {}) {
    const who = p.officialIds.map(officialById).filter(Boolean);
    return h(
      "article",
      { class: "promise" },
      h(
        "header",
        {},
        h("h3", {}, p.promise),
        h(
          "p",
          { class: "promise-meta" },
          statusChip(p.status),
          h(
            "span",
            { class: "weight", title: "Weight: 1 trivial to 5 cornerstone", "aria-label": p.weight == null ? "No weight set" : `Weight ${p.weight} of 5` },
            p.weight == null ? "Weight —" : [1, 2, 3, 4, 5].map((n) => h("i", { class: n <= p.weight ? "on" : "" })),
          ),
          p.issueArea && h("span", { class: "tag" }, p.issueArea),
        ),
        showOfficial &&
          h(
            "p",
            { class: "meta" },
            who.length
              ? who.map((o, i) => [i ? ", " : "", h("a", { href: `#/official/${o.slug}` }, o.name)])
              : "No official linked",
          ),
      ),
      h(
        "dl",
        {},
        h("dt", {}, "Quote"),
        h(
          "dd",
          {},
          p.exactQuote
            ? h("blockquote", {}, `“${p.exactQuote}”`)
            : h("p", { class: "muted" }, "No direct quote on file. The promise above is a paraphrase."),
          h(
            "p",
            { class: "sources" },
            source(p.quoteSource, "Quote source"),
            h("span", { class: "meta" }, p.dateSaid ? `Said ${fmtDate(p.dateSaid)}` : "Date said not on file"),
          ),
        ),
        h("dt", {}, "Evidence"),
        h(
          "dd",
          {},
          p.evidence ? h("p", {}, p.evidence) : h("p", { class: "muted" }, "No evidence logged."),
          h(
            "p",
            { class: "sources" },
            source(p.evidenceSource, "Evidence source"),
            p.lastReviewed && h("span", { class: "meta" }, `Last reviewed ${fmtDate(p.lastReviewed)}`),
          ),
        ),
      ),
    );
  }

  function viewOfficial(slug) {
    const o = desk.officials.find((x) => x.slug === slug);
    if (!o) return viewNotFound();
    const list = promisesFor(o).sort(byWeight);
    const fact = (label, value) => [h("dt", {}, label), h("dd", {}, value || h("span", { class: "muted" }, "Not on file"))];
    const link = (u) => (safeUrl(u) ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, host(u), " ↗") : null);

    return [
      h("p", { class: "crumb" }, h("a", { href: "#/" }, "← Overview")),
      h(
        "header",
        { class: "profile" },
        h("p", { class: "kicker" }, [o.tier, o.trackingStatus !== "Active" && o.trackingStatus].filter(Boolean).join(" · ") || "No tier set"),
        h("h1", {}, o.name),
        h("p", { class: "office" }, [o.office, o.district].filter(Boolean).join(" · ")),
        h("p", { class: "flags" }, flags(o)),
        o.provisional &&
          h("p", { class: "refresh-note" }, h("b", {}, "Provisional: "), "this entry is marked provisional in the source log and has not been confirmed."),
      ),
      h(
        "div",
        { class: "two-col" },
        h("section", { class: "panel" }, h("h2", { class: "label" }, "Latest activity"), activity(o, { full: true })),
        h(
          "section",
          { class: "panel" },
          h("h2", { class: "label" }, "On file"),
          h(
            "dl",
            { class: "facts" },
            fact("Level", o.level),
            fact("Party", o.party),
            fact("Term start", fmtDate(o.termStart)),
            fact("Next election", fmtDate(o.nextElection)),
            fact("Official site", link(o.officialSite)),
            fact("Voting record", link(o.votingRecordSource)),
            fact("Campaign finance", link(o.campaignFinanceSource)),
          ),
        ),
      ),
      h(
        "section",
        {},
        h("div", { class: "tier-head" }, h("h2", {}, "Promises"), h("p", { class: "meta count" }, `${list.length} logged`)),
        scorecard(list),
        list.map((p) => promiseItem(p)),
      ),
    ];
  }

  function viewLedger(params) {
    const f = { official: params.get("official") || "", status: params.get("status") || "", issue: params.get("issue") || "" };
    const withPromises = desk.officials.filter((o) => promisesFor(o).length);
    const issues = [...new Set(desk.promises.map((p) => p.issueArea).filter(Boolean))].sort();
    const statuses = [...new Set([...desk.statusOrder, ...desk.promises.map((p) => p.status).filter(Boolean)])];

    const list = desk.promises
      .filter((p) => !f.official || p.officialIds.some((id) => (officialById(id) || {}).slug === f.official))
      .filter((p) => !f.status || p.status === f.status)
      .filter((p) => !f.issue || p.issueArea === f.issue)
      .sort(byWeight);

    const picker = (name, label, options) => {
      const sel = h(
        "select",
        { id: `f-${name}`, name },
        h("option", { value: "" }, "All"),
        options.map(([value, text]) => h("option", { value, selected: f[name] === value }, text)),
      );
      sel.addEventListener("change", () => {
        const next = new URLSearchParams(params);
        sel.value ? next.set(name, sel.value) : next.delete(name);
        const qs = next.toString();
        location.hash = "#/ledger" + (qs ? "?" + qs : "");
      });
      return h("label", { for: `f-${name}` }, h("span", {}, label), sel);
    };

    return [
      h("header", { class: "profile" }, h("p", { class: "kicker" }, "Receipts ledger"), h("h1", {}, "Every logged promise")),
      h(
        "form",
        { class: "filters", "aria-label": "Filter promises" },
        picker("official", "Official", withPromises.map((o) => [o.slug, o.name])),
        picker("status", "Status", statuses.map((s) => [s, s])),
        picker("issue", "Issue area", issues.map((s) => [s, s])),
        (f.official || f.status || f.issue) && h("a", { class: "clear", href: "#/ledger" }, "Clear filters"),
      ),
      h("p", { class: "meta", role: "status" }, `Showing ${list.length} of ${desk.promises.length} promises, heaviest weight first`),
      list.length
        ? list.map((p) => promiseItem(p, { showOfficial: true }))
        : h("p", { class: "empty" }, desk.promises.length ? "No promises match these filters." : "No promises have been logged yet."),
    ];
  }

  function briefingItem(b) {
    const who = b.officialIds.map(officialById).filter(Boolean);
    const hasLinks = b.blocks.some((bl) => bl.spans.some((s) => s.href));
    const spans = (bl) =>
      bl.spans.map((s) =>
        safeUrl(s.href) ? h("a", { href: s.href, target: "_blank", rel: "noopener noreferrer" }, s.text) : s.text,
      );
    const body = [];
    let listEl = null;
    for (const bl of b.blocks) {
      if (bl.kind === "li" || bl.kind === "oli") {
        const tag = bl.kind === "li" ? "ul" : "ol";
        if (!listEl || listEl.tagName.toLowerCase() !== tag) body.push((listEl = h(tag, {})));
        listEl.append(h("li", {}, spans(bl)));
        continue;
      }
      listEl = null;
      if (bl.kind === "hr") body.push(h("hr", {}));
      else if (bl.kind === "quote") body.push(h("blockquote", {}, spans(bl)));
      else if (bl.kind === "p") body.push(h("p", {}, spans(bl)));
      else body.push(h(bl.kind === "h1" ? "h4" : "h5", {}, spans(bl)));
    }

    return h(
      "article",
      { class: "promise briefing" },
      h(
        "header",
        {},
        h("p", { class: "meta" }, b.weekOf ? `Week of ${fmtDate(b.weekOf)}` : "Week not set"),
        h("h3", {}, b.title || "Untitled briefing"),
        b.headline && h("p", { class: "headline" }, b.headline),
        h(
          "p",
          { class: "promise-meta" },
          h("span", { class: "tag" }, b.flags == null ? "Say-vs-do flags: not recorded" : `Say-vs-do flags: ${b.flags}`),
          !hasLinks && h("span", { class: "tag tag-unsourced" }, "No source links in this briefing"),
        ),
        who.length > 0 &&
          h("p", { class: "meta" }, "Covers: ", who.map((o, i) => [i ? ", " : "", h("a", { href: `#/official/${o.slug}` }, o.name)])),
      ),
      body.length > 0 && h("details", {}, h("summary", {}, "Read the briefing"), h("div", { class: "body" }, body)),
      b.bodyTruncated && h("p", { class: "muted small" }, "Part of this briefing is not shown here (nested or very long content)."),
    );
  }

  function viewBriefings() {
    return [
      h("header", { class: "profile" }, h("p", { class: "kicker" }, "Weekly briefings"), h("h1", {}, "Briefings, newest first")),
      desk.briefings.length
        ? desk.briefings.map(briefingItem)
        : h(
            "div",
            { class: "empty" },
            h("p", {}, h("b", {}, "No briefings yet.")),
            h("p", {}, "Weekly briefings will appear here once the first one is added to the log."),
          ),
    ];
  }

  function viewNotFound() {
    return [h("div", { class: "empty" }, h("p", {}, h("b", {}, "Nothing here.")), h("p", {}, h("a", { href: "#/" }, "Back to the overview")))];
  }

  // ---- router ---------------------------------------------------------------

  function render() {
    if (!desk) return;
    const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    let view, nav, title;
    if (!parts.length) [view, nav, title] = [viewOverview(), "overview", "Overview"];
    else if (parts[0] === "official" && parts[1]) {
      const o = desk.officials.find((x) => x.slug === parts[1]);
      [view, nav, title] = [viewOfficial(parts[1]), "overview", o ? o.name : "Not found"];
    } else if (parts[0] === "ledger") [view, nav, title] = [viewLedger(new URLSearchParams(query)), "ledger", "Ledger"];
    else if (parts[0] === "briefings") [view, nav, title] = [viewBriefings(), "briefings", "Briefings"];
    else [view, nav, title] = [viewNotFound(), "", "Not found"];

    const keepFocus = document.activeElement && document.activeElement.id;
    main.replaceChildren(...[view].flat(Infinity).filter(Boolean));
    document.title = `${title} · The Receipts Desk`;
    for (const a of document.querySelectorAll("[data-nav]")) {
      a.dataset.nav === nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    }
    const again = keepFocus && document.getElementById(keepFocus);
    if (again) again.focus();
    else window.scrollTo(0, 0);
  }

  const ERRORS = {
    not_configured: ["The desk is not connected yet.", "Set the NOTION_TOKEN environment variable in Netlify, then redeploy."],
    notion_unauthorized: ["Notion rejected the token.", "Check that NOTION_TOKEN in Netlify holds a current integration secret, then redeploy."],
    notion_not_shared: ["Notion could not find the databases.", "Share the Receipts Desk hub page with the integration in Notion."],
    notion_unavailable: ["The log could not be read right now.", "Try again in a few minutes."],
  };

  async function start() {
    try {
      const res = await fetch("/api/data", { headers: { Accept: "application/json" } });
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error("api"), { reason: body && body.error });
      desk = body;
      const when = new Date(desk.generatedAt);
      document.getElementById("pulled").textContent =
        `Data pulled from Notion ${when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Edits in Notion appear here within 5 minutes; reload the page to see them.`;
      render();
    } catch (err) {
      const [head, help] = ERRORS[err.reason] || ERRORS.notion_unavailable;
      main.replaceChildren(h("div", { class: "empty" }, h("p", {}, h("b", {}, head)), h("p", {}, help)));
    }
  }

  window.addEventListener("hashchange", render);
  start();
})();
