# DentMemo Consent

DentMemo Consent is a standalone, payment-free product experience inside the DentMemo codebase. It shares authentication, clinic tenancy and Supabase infrastructure with DentMemo, but it does not require a DentMemo subscription, payment, plan or checkout.

## Product boundary

The product lives at `/consent/` and has its own application shell. A consent stores patient, doctor, treatment and template snapshots so a historical signed document remains meaningful even when live clinic data changes later.

The MVP flow is:

1. Sign up or sign in.
2. Create/select a clinic workspace.
3. Configure treating doctors and their delivery email addresses.
4. Review and approve a clinic consent template.
5. Enter patient and treatment information.
6. Hand the device to the patient for review and acknowledgements.
7. Capture the patient or guardian handwritten signature.
8. Generate and privately store the signed PDF.
9. Attempt delivery to the configured treating doctor.
10. Search, view, download, resend or void the archived record.

There is no billing screen, payment provider integration, subscription gate or upgrade flow.

## Database

Base migration: `supabase/migrations/202608190001_consent_product.sql`

Free-access migration: `supabase/migrations/202608190002_consent_free_access.sql`

The free-access migration makes consent creation and private PDF upload depend on clinic membership rather than a paid entitlement. It also keeps older clients compatible by marking Consent access active for existing and newly created clinics.

All tenant tables use `clinic_id` and Row Level Security. Signed consent content becomes immutable after signing. Corrections must be handled by voiding the original with a reason and creating a new consent.

## Templates

Sample wording for common dental procedures starts as `needs_review`. A clinic owner must review and approve wording before it appears in the live consent flow. Sample wording should not be treated as guaranteed legally or clinically sufficient for every clinic or jurisdiction.

## Storage

Create one private Supabase Storage bucket:

`dm-consent-documents`

Object path:

`{clinic_id}/{consent_id}/signed-consent.pdf`

Clinic membership controls reads and uploads. There is no client update/delete policy for signed PDFs.

## Email delivery

Function: `supabase/functions/consent-email/index.ts`

Required Edge Function secrets:

- `RESEND_API_KEY`
- `CONSENT_FROM_EMAIL`

Supabase-provided values such as `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must remain server-side.

## Client environment

See `.env.example`.

Required browser values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CONSENT_DEMO_MODE`

There are no payment-related environment variables.

## Demo mode

If Supabase is not configured, or `NEXT_PUBLIC_CONSENT_DEMO_MODE=true`, `/consent/` opens a self-contained product demo with sample doctor/template data. Demo mode is for interface testing only; do not enter real patient information.

## Applying to Supabase

Before real patient use:

1. Apply `202608190001_consent_product.sql`.
2. Apply `202608190002_consent_free_access.sql`.
3. Create the private `dm-consent-documents` bucket.
4. Confirm RLS is enabled on all Consent tables.
5. Run Supabase security/performance advisors.
6. Deploy `consent-email` with JWT verification enabled.
7. Configure and verify the Resend sender.
8. Test Clinic A / Clinic B isolation.
9. Test signing on iPad and Android.
10. Review the generated PDF and clinic consent wording before clinical use.

## Deployment

The repository's existing GitHub Pages workflow publishes the historical `docs/` directory. A standalone preview is published from `docs/consent/` so `/consent/` does not fall back to the old DentMemo feature interface.

The Next/Vite implementation remains the source for the eventual authenticated Supabase-backed product.
