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
});

test("Consent free-access migration removes payment gating", async () => {
  const sql = await read("supabase/migrations/202608190002_consent_free_access.sql");
  assert.match(sql, /private\.dm_is_member\(clinic_id\)/i);
  assert.match(sql, /private\.dm_is_member\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid\)/i);
  assert.doesNotMatch(sql, /dm_has_product/i);
  assert.match(sql, /status = 'active'/i);
});

test("Consent storage remains private, clinic-scoped and immutable", async () => {
  const base = await read("supabase/migrations/202608190001_consent_product.sql");
  const free = await read("supabase/migrations/202608190002_consent_free_access.sql");
  const buckets = await read("supabase/migrations/202608190004_consent_storage_buckets.sql");
  assert.match(base, /bucket_id = 'dm-consent-documents'/i);
  assert.match(free, /bucket_id = 'dm-consent-documents'/i);
  assert.doesNotMatch(`${base}\n${free}`, /create policy dm_consent_documents_(update|delete)/i);
  assert.match(buckets, /'dm-consent-documents'[\s\S]*false[\s\S]*application\/pdf/i);
  assert.match(buckets, /'dm-consent-branding'[\s\S]*false[\s\S]*image\/png/i);
});

test("Sample consent wording requires clinic review", async () => {
  const sql = await read("supabase/migrations/202608190001_consent_product.sql");
  const seededNeedsReview = sql.match(/'needs_review', true\)/g) ?? [];
  assert.ok(seededNeedsReview.length >= 5, "seed templates should default to needs_review");
});

test("Consent UI contains no payment or Razorpay path", async () => {
  const repository = await read("lib/consent/repository.ts");
  const ui = await read("components/consent/ConsentApp.tsx");
  for (const source of [repository, ui]) {
    assert.doesNotMatch(source, /Razorpay/i);
    assert.doesNotMatch(source, /createBillingSubscription/i);
    assert.doesNotMatch(source, /Start subscription/i);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /RESEND_API_KEY/);
  }
});

test("Consent email supports real resends and attributed audit rows", async () => {
  const email = await read("supabase/functions/consent-email/index.ts");
  assert.match(email, /const attemptId = crypto\.randomUUID\(\)/);
  assert.match(email, /Idempotency-Key.*attemptId/s);
  assert.match(email, /actor_display_name: actorDisplayName/);
  assert.match(email, /entity_type: "consent"/);
  assert.doesNotMatch(email, /Idempotency-Key.*dentmemo-consent-\$\{consent\.id\}`/);
});

test("Consent audit RPC is not callable by anonymous users", async () => {
  const hardening = await read("supabase/migrations/202608190005_consent_audit_rpc_privileges.sql");
  assert.match(hardening, /revoke execute[\s\S]*from anon/i);
  assert.match(hardening, /grant execute[\s\S]*to authenticated/i);
});

test("Consent foreign keys have supporting indexes and duplicate clinic policy is removed", async () => {
  const sql = await read("supabase/migrations/202608190006_consent_performance_indexes.sql");
  assert.match(sql, /drop policy if exists dm_clinics_consent_update/i);
  for (const index of [
    "dm_consent_audit_actor_idx",
    "dm_consent_templates_created_by_idx",
    "dm_consent_templates_source_idx",
    "dm_consents_created_by_idx",
    "dm_consents_doctor_setting_idx",
    "dm_consents_patient_fk_idx",
    "dm_consents_template_fk_idx",
  ]) {
    assert.match(sql, new RegExp(index));
  }
});
