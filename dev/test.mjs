// node --test dev/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadDesk } from "../netlify/functions/lib/notion.mjs";
import { mockNotionFetch } from "./fixture.mjs";

test("maps rows, paginates, and sends the token only to Notion", async () => {
  const f = mockNotionFetch({ pageSize: 2 });
  const desk = await loadDesk({ token: "tok", fetchImpl: f });
  assert.equal(desk.officials.length, 6);
  assert.equal(desk.promises.length, 7);
  assert.ok(f.calls.every((c) => c.url.startsWith("https://api.notion.com/v1/") && c.auth === "Bearer tok" && c.version));
});

test("private fields never appear in the payload", async () => {
  const out = JSON.stringify(await loadDesk({ token: "tok", fetchImpl: mockNotionFetch() }));
  for (const banned of ["SECRET-NOTE", "Will keep", "Prediction", "Reviewed By Me", "notes", "tok"]) {
    assert.ok(!out.includes(banned), `payload leaked: ${banned}`);
  }
});

test("flags, unsafe urls, statuses pass through unmodified", async () => {
  const desk = await loadDesk({ token: "tok", fetchImpl: mockNotionFetch() });
  const by = (n) => desk.officials.find((o) => o.name.includes(n));
  assert.equal(by("Official B").needsRefresh, true);
  assert.equal(by("Official B").provisional, true);
  assert.equal(by("Official A").provisional, false);
  assert.equal(by("onerror").latestActivitySource, "", "javascript: url dropped");
  assert.deepEqual(desk.promises.map((p) => p.status), ["In motion", "Not started", "Kept", "Broken", "Stalled", "Compromised", "Abandoned"]);
  assert.equal(new Set(desk.officials.map((o) => o.slug)).size, 6);
});

test("briefings newest first with bodies; empty database is fine", async () => {
  const desk = await loadDesk({ token: "tok", fetchImpl: mockNotionFetch() });
  assert.deepEqual(desk.briefings.map((b) => b.weekOf), ["2099-01-12", "2099-01-05"]);
  assert.equal(desk.briefings[0].blocks.length, 4);
  const empty = await loadDesk({ token: "tok", fetchImpl: mockNotionFetch({ empty: true }) });
  assert.deepEqual(empty.briefings, []);
});

test("Notion errors surface as NotionError with status", async () => {
  await assert.rejects(loadDesk({ token: "tok", fetchImpl: mockNotionFetch({ status: 401 }) }), (e) => e.status === 401);
});
