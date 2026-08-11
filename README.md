# DentMemo

DentMemo is a mobile-first clinic memory system for a single independent dentist, optional consultants, and one or more assistants.

## What is implemented

- Six-step self-onboarding experience
- Separate dentist and assistant workspaces
- Today dashboard, schedule, patient search and patient record
- Tooth chart, clinical timeline and treatment plan
- Four-step quick-visit workflow with note, follow-up and payment
- Calendar, follow-ups, insights, settings and role preview
- Supabase-ready authentication helpers
- Multi-clinic Postgres schema with Row Level Security
- No file uploads in this MVP

## Run locally

1. Install Node.js 22+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add Supabase project values.
4. Run the SQL in `supabase/migrations/202608110001_initial_schema.sql` using the Supabase dashboard or CLI.
5. Run `npm run dev`.

Without environment values the product UI remains usable as a demo. With Supabase values, use the helpers under `lib/supabase` while replacing the demo arrays screen-by-screen.

## Safety rules for future Codex work

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.
- Every new tenant table must contain `clinic_id` and have RLS enabled before use.
- Assistants must not write clinical notes or treatment plans.
- Store timestamps as UTC and render them in the clinic timezone.
- Keep Calendar tokens and WhatsApp credentials in server-only secrets.
- Add migrations; do not manually change production tables without recording the SQL.

See `docs/ARCHITECTURE.md` for roles and the recommended build sequence.
