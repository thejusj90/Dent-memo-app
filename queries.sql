-- benchmarks/queries.sql
--
-- Run each of these with EXPLAIN ANALYZE, before and after seeding, and
-- before and after applying 202608120001_scale_indexes_and_partitioning.sql.
-- Swap in a real clinic_id / patient_id / user_id from your seeded data.
--
-- What to look for: "Seq Scan" on patients/visits/appointments/audit_log at
-- clinic scale is the red flag -- it means an index isn't being used, and
-- the query cost will grow linearly with total table size, not with a
-- single clinic's data size (which is what your dentists actually feel).

-- 1. Today's schedule for one clinic (the single most-hit query in the app)
explain analyze
select * from public.appointments
where clinic_id = '<CLINIC_ID>'
  and starts_at >= current_date
  and starts_at < current_date + interval '1 day'
order by starts_at;

-- 2. Patient search by phone within a clinic (used on every check-in)
explain analyze
select * from public.patients
where clinic_id = '<CLINIC_ID>'
  and phone = '<PHONE_NUMBER>';

-- 3. Patient search by partial name within a clinic
explain analyze
select * from public.patients
where clinic_id = '<CLINIC_ID>'
  and full_name ilike '<PARTIAL_NAME>%';

-- 4. Full visit history for one patient (opened on every patient profile view)
explain analyze
select * from public.visits
where patient_id = '<PATIENT_ID>'
order by occurred_at desc;

-- 5. Which clinics does this user belong to (login / clinic switcher --
--    this is the query the new clinic_members_user_idx index targets)
explain analyze
select clinic_id, role from public.clinic_members
where user_id = '<USER_ID>' and active = true;

-- 6. Monthly revenue for a clinic (a reporting-style query -- watch this one
--    as data grows; it's the first candidate for a read replica)
explain analyze
select date_trunc('month', received_at) as month, sum(amount)
from public.payments
where clinic_id = '<CLINIC_ID>'
  and received_at >= now() - interval '12 months'
group by 1
order by 1;

-- 7. Owner's audit log for a clinic, most recent first (this is the query
--    the audit_log partitioning targets -- compare plan/timing against
--    the pre-partition table)
explain analyze
select * from public.audit_log
where clinic_id = '<CLINIC_ID>'
order by created_at desc
limit 50;

-- 8. Due reminders across ALL clinics (this is what the WhatsApp reminder
--    cron job runs every few minutes -- must stay fast regardless of
--    total clinic count, since it's not filtered by clinic_id)
explain analyze
select * from public.reminders
where status = 'pending'
  and scheduled_for <= now()
order by scheduled_for
limit 500;

-- ----------------------------------------------------------------------------
-- Sanity checks: row counts and table sizes, to track growth over time
-- ----------------------------------------------------------------------------
select
  relname as table_name,
  n_live_tup as row_estimate,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
