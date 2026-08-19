import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

test("compiled Worker exposes fetch", async () => {
  const worker = await loadWorker();
  assert.ok(worker);
  assert.equal(typeof worker.fetch, "function");
});

test("Consent route is wired to the standalone product app", async () => {
  const route = await readFile(new URL("../app/consent/page.tsx", import.meta.url), "utf8");
  assert.match(route, /ConsentApp/);
  assert.match(route, /return\s*<ConsentApp\s*\/>/);
});

test("Consent product source contains v2 standalone experience", async () => {
  const app = await readFile(new URL("../components/consent/ConsentApp.tsx", import.meta.url), "utf8");
  assert.match(app, /Create\. Sign\. Email\. Retrieve\./i);
  assert.match(app, /Consent archive/i);
  assert.match(app, /Accept & Submit/i);
  assert.match(app, /Activity log/i);
  assert.match(app, /Clinic identity & users/i);
  assert.match(app, /\+ New template/i);
  assert.match(app, /Create new version/i);
});
