import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Consent migration enables RLS and signed-record immutability", async () => {
  const sql = await read("supabase/migrations/202608190001_consent_product.sql");
  for (const table of [
    "dm_product_entitlements",
    "dm_consent_doctor_settings",
    "dm_consent_templates",
    "dm_consents",
    "dm_consent_audit_events",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /create function private\.dm_consent_immutable\(\)/i);
  assert.match(sql, /Signed consent content is immutable/i);
  assert.match(sql, /create trigger dm_consents_immutable before update/i);
  assert.match(sql, /private\.dm_has_product\(clinic_id,'consent'\)/i);
});

test("Consent storage is clinic-scoped and has no delete/update policy", async () => {
  const sql = await read("supabase/migrations/202608190001_consent_product.sql");
  assert.match(sql, /bucket_id = 'dm-consent-documents'/i);
  assert.match(sql, /private\.dm_is_member\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid\)/i);
  assert.match(sql, /private\.dm_has_product\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid,'consent'\)/i);
  assert.doesNotMatch(sql, /create policy dm_consent_documents_(update|delete)/i);
});

test("Sample consent wording requires clinic review", async () => {
  const sql = await read("supabase/migrations/202608190001_consent_product.sql");
  const seededNeedsReview = sql.match(/'needs_review', true\)/g) ?? [];
  assert.ok(seededNeedsReview.length >= 5, "seed templates should default to needs_review");
});

test("Billing entitlement is webhook-controlled and webhook verifies HMAC", async () => {
  const checkout = await read("supabase/functions/consent-billing/index.ts");
  const webhook = await read("supabase/functions/consent-billing-webhook/index.ts");
  assert.match(checkout, /notes:\s*\{[\s\S]*clinic_id:/m);
  assert.doesNotMatch(checkout, /dm_product_entitlements/);
  assert.match(webhook, /x-razorpay-signature/i);
  assert.match(webhook, /HMAC/);
  assert.match(webhook, /dm_product_entitlements/);
  assert.match(webhook, /serviceRoleKey/);
});

test("Browser Consent code never embeds server secrets", async () => {
  const repository = await read("lib/consent/repository.ts");
  const ui = await read("components/consent/ConsentApp.tsx");
  for (const source of [repository, ui]) {
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /RAZORPAY_KEY_SECRET/);
    assert.doesNotMatch(source, /RESEND_API_KEY/);
  }
});
