# DentMemo Consent

DentMemo Consent is a standalone paid product inside the DentMemo codebase. It shares authentication, clinic tenancy and Supabase infrastructure with DentMemo, but its commercial entitlement is separate from the core patient-memory product.

## Product boundary

The product is available at `/consent/` and does not require a DentMemo patient record. A consent stores patient, doctor, treatment and template snapshots so a historical signed document remains meaningful even when live clinic records change later.

The MVP flow is:

1. Sign up or sign in.
2. Create/select a clinic workspace.
3. Activate the `consent` product entitlement.
4. Configure treating doctors and their delivery email addresses.
5. Review and approve a clinic consent template.
6. Enter patient and treatment information.
7. Hand the device to the patient for review and acknowledgements.
8. Capture the patient or guardian handwritten signature with Pointer Events.
9. Generate and privately store the signed PDF.
10. Attempt delivery to the configured treating doctor.
11. Search, view, download, resend or void the archived record.

## Routes

The current MVP is implemented as a standalone application shell at `/consent/`. Dashboard, new consent, records, templates, settings and billing are client-side product views inside this namespace. This avoids coupling the MVP to the existing DentMemo clinical navigation while keeping the current static-export architecture intact.

## Database

Migration: `supabase/migrations/202608190001_consent_product.sql`

The migration creates:

- `dm_product_entitlements`: product-level access independent of the core DentMemo app.
- `dm_consent_doctor_settings`: clinic-controlled treating doctor identity and email destinations.
- `dm_consent_templates`: versionable global samples and clinic-owned approved copies.
- `dm_consents`: immutable signed snapshots plus delivery state.
- `dm_consent_audit_events`: append-only lifecycle/delivery audit entries.

All tenant tables use `clinic_id` and Row Level Security. Existing private helper functions (`dm_is_member`, `dm_is_owner`, `dm_has_clinical_access`) remain the tenancy source of truth.

### Signed record immutability

Once a consent is signed, a database trigger rejects changes to the clinical/patient/document snapshot. Delivery metadata may still change. An authorized clinical user may move a signed record to `voided` only with a reason; the original signed content is preserved.

Never implement an `Edit signed consent` path. Correct an error by voiding the original and creating a new consent.

## Template approval

The migration seeds sample wording for general treatment, extraction, root canal treatment, implants and dental photography/media. All seeded samples start as `needs_review`.

A clinic owner must review a sample and select **Approve for Clinic Use**. For a global sample this creates a clinic-owned copy and marks that copy approved. New consents only expose templates with `approval_status = approved`.

Sample wording is not presented as guaranteed legally or clinically sufficient. Clinics should have final wording reviewed for their treatment workflow and jurisdiction before production use.

## Storage

Create one Supabase Storage bucket:

`dm-consent-documents`

Requirements:

- private bucket; do not enable public URLs
- object path: `{clinic_id}/{consent_id}/signed-consent.pdf`
- no client delete/update policy for signed PDFs

The migration installs object policies that allow clinic members to read documents and only clinics with an active/trial Consent entitlement to insert them. The application downloads PDFs through authenticated Supabase Storage calls.

## Email delivery

Function: `supabase/functions/consent-email/index.ts`

Deploy with JWT verification enabled.

The function:

- validates the caller's Supabase session
- loads the consent through the caller's RLS-scoped client
- downloads the private PDF with the server-only service role
- sends it to the configured treating-doctor email through Resend
- avoids patient names in the email subject
- records `sent` or `failed` delivery state and an audit event
- uses an idempotency key based on the consent ID

Required Edge Function secrets:

- `RESEND_API_KEY`
- `CONSENT_FROM_EMAIL`

Supabase-provided function secrets such as `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must remain server-side.

## Billing

Checkout function: `supabase/functions/consent-billing/index.ts`

Deploy with JWT verification enabled.

Webhook function: `supabase/functions/consent-billing-webhook/index.ts`

Deploy the webhook without Supabase JWT verification because Razorpay is the external caller. The function authenticates requests itself using the raw request body and `x-razorpay-signature` HMAC verification.

Required billing secrets:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_CONSENT_PLAN_ID`
- `RAZORPAY_CONSENT_TOTAL_COUNT`
- `CONSENT_PLAN_NAME`
- `CONSENT_PRICE_DISPLAY`

The browser receives only the Razorpay public key ID and subscription ID. It never receives the key secret or webhook secret.

### Entitlement source of truth

A successful browser checkout callback does not activate the product. The callback only tells the user that verification is pending. The verified Razorpay webhook is the code path that writes `dm_product_entitlements`.

Mapped states include active, past-due, cancelled and expired. Billing expiry blocks creation of new consents but does not delete historical clinical records.

## Client environment

See `.env.example`.

Important values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CONSENT_DEMO_MODE`
- `NEXT_PUBLIC_CONSENT_PRICE_DISPLAY`

Do not expose server secrets with a `NEXT_PUBLIC_` prefix.

## Demo mode

If Supabase is not configured, or `NEXT_PUBLIC_CONSENT_DEMO_MODE=true`, `/consent/` opens a self-contained product demo. Demo mode includes two approved sample templates and a sample doctor so signature/PDF UX can be tested without touching production data.

Demo records are not persisted and email/payment operations do not become production actions.

## Applying to Supabase

The migration has been syntax-checked against the current DentMemo Product Postgres schema inside a transaction that was rolled back. No production schema was changed during that validation.

Before going live:

1. Review and apply `202608190001_consent_product.sql` to the intended DentMemo Supabase project.
2. Create private bucket `dm-consent-documents`.
3. Confirm all new tables have RLS enabled.
4. Run Supabase security/performance advisors after migration.
5. Deploy `consent-email` with JWT verification enabled.
6. Deploy `consent-billing` with JWT verification enabled.
7. Deploy `consent-billing-webhook` with JWT verification disabled and configure the Razorpay webhook URL/secret.
8. Configure Resend and verify the sender domain/address.
9. Configure a Razorpay plan and set the plan ID/secrets.
10. Set production client environment variables and keep demo mode off.
11. Test Clinic A / Clinic B cross-tenant isolation before allowing real patient use.

## Development

Use the repository's existing Node requirement and scripts:

```bash
npm ci
npm run lint
npm test
```

`npm test` runs the verified build, rendered-route checks and Consent security-contract tests.

## Current deployment caveat

The repository's existing GitHub Pages workflow deploys the historical `docs/` directory from `main`. It does not currently publish the Next/Vite source from this feature branch.

Therefore merging this code is not, by itself, a production deployment of `/consent/`. Decide whether to move the main deployment to the verified Next/Vite build output (or deploy it to the existing app hosting used for `app.dentmemo.in`) after CI passes. Do not replace the current production deployment blindly.

## Production checklist

Before accepting real patient signatures:

- migration applied and advisors reviewed
- private bucket created and cross-clinic access tested
- at least one clinic-owned template reviewed and approved
- treating doctor identity/email configured
- email sender verified and delivery tested
- Razorpay webhook verified using a test subscription
- production entitlement created only from verified billing state
- tablet signing tested on iPad and Android where available
- PDF visually reviewed for patient/doctor names, consent wording, signature and timestamps
- void/resend/download tested
- privacy and clinical/legal wording reviewed by the clinic's appropriate professional adviser
