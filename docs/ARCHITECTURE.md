# DentMemo MVP architecture

## Runtime

- Frontend: Next.js-compatible React app, mobile-first and installable later as a PWA.
- Source control: GitHub. Use feature branches and pull requests once more than one developer contributes.
- Authentication and database: Supabase Auth + Postgres with Row Level Security.
- Hosting: Vercel or Cloudflare Pages can deploy directly from GitHub.
- Calendar: a server-only Google OAuth integration, added after the core records work.
- WhatsApp: a scheduled server function sends one-way approved template reminders; no inbox or two-way chat.

## Tenant boundary

Every business record has `clinic_id`. Production tables use a `dm_` prefix and access is derived from `dm_clinic_members`, never from a clinic ID supplied by the browser alone. RLS is the final enforcement layer. Existing prototype tables are preserved until their records are deliberately migrated.

| Role | Patient basics | Appointments | Clinical notes/plans | Payments | Team/settings | Insights |
| --- | --- | --- | --- | --- | --- | --- |
| Owner dentist | Full | Full | Full | Full | Full | Full |
| Dentist/consultant | Full | Full | Full | Full | No | Limited |
| Assistant | Full | Full | Read-only summary | Record/see status | No | No |

The first schema is intentionally file-free. Google event IDs and reminder delivery status are stored, but integration credentials must remain encrypted and server-only.

## Build sequence

1. Connect a Supabase project and run the migration.
2. Replace demo onboarding with Auth `signUpDentist()` and `create_clinic()`.
3. Replace demo arrays with repository functions for patients, appointments, visits, treatments and payments.
4. Add invitation-based assistant and consultant onboarding.
5. Add Calendar OAuth and webhooks.
6. Add one-way WhatsApp templates and a scheduled reminder worker.
