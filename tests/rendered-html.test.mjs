import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname } from "node:path";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function compiledText(root = new URL("../dist/", import.meta.url)) {
  const parts = [];
  async function walk(directoryUrl) {
    const entries = await readdir(directoryUrl, { withFileTypes: true });
    for (const entry of entries) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
      if (entry.isDirectory()) {
        await walk(child);
        continue;
      }
      const extension = extname(entry.name);
      if (![".js", ".html", ".json", ".txt"].includes(extension)) continue;
      parts.push(await readFile(child, "utf8"));
    }
  }
  await walk(root);
  return parts.join("\n");
}

test("compiled Worker exposes fetch", async () => {
  const worker = await loadWorker();
  assert.ok(worker);
  assert.equal(typeof worker.fetch, "function");
});

test("compiled output contains development preview metadata", async () => {
  const output = await compiledText();
  assert.match(output, /codex-preview/i);
  assert.match(output, /development/i);
});

test("compiled output contains standalone DentMemo Consent experience", async () => {
  const output = await compiledText();
  assert.match(output, /DentMemo Consent/i);
  assert.match(output, /Dental consent\. Signed in under a minute\./i);
  assert.match(output, /Consent records/i);
});
