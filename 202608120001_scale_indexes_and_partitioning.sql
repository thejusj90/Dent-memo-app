-- ============================================================================
-- 202608120001_scale_indexes_and_partitioning.sql
--
-- Purpose: close the two indexing gaps found in the initial schema, and
-- convert audit_log (the clearest unbounded-growth, append-only, no-incoming-FK
-- table) into a partitioned table before it accumulates production data.
--
-- Assumes this runs on a fresh/early-stage project (e.g. dentmemo-labs) with
-- no meaningful audit_log volume yet. If you ever need to run this against a
-- table that already has real rows, see "MIGRATING EXISTING DATA" at the
-- bottom before running the DROP TABLE step.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Missing indexes
-- ----------------------------------------------------------------------------

-- clinic_members' PK is (clinic_id, user_id) -- great for "who's in this
-- clinic" but useless for "which clinics is this user in", which is exactly
-- what a consultant working across multiple clinics needs on every login.
create index if not exists clinic_members_user_idx
  on public.clinic_members (user_id);

-- audit_log had no index on clinic_id at all; the owner-read RLS policy
-- (public.is_clinic_owner(clinic_id)) forces a full scan on every read
-- as the table grows. This index is superseded by the partitioned table
-- below, but is created here explicitly so it exists even if you skip
-- the partitioning step.
create index if not exists audit_log_clinic_created_idx
  on public.audit_log (clinic_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Partition audit_log by month
--
-- Why audit_log first (and not visits/appointments): it has no other table
-- referencing it via foreign key. Partitioning a table that other tables
-- point to (visits <- visit_treatments) requires the partition key to be
-- folded into every referencing FK, which is a bigger structural change.
-- Revisit visits/appointments once they approach ~10-20M rows -- monitor
-- with: select count(*) from public.visits; on a monthly cadence.
-- ----------------------------------------------------------------------------

alter table public.audit_log rename to audit_log_old;

create table public.audit_log (
  id uuid not null default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

create index audit_log_clinic_created_idx
  on public.audit_log (clinic_id, created_at desc);

alter table public.audit_log enable row level security;

create policy audit_owner_read on public.audit_log
  for select using (public.is_clinic_owner(clinic_id));

-- Any INSERTs should still go through your application/service layer;
-- no explicit insert policy is added here (matches the original schema,
-- which only granted an owner-read policy -- writes happen via
-- security-definer functions or a service role that bypasses RLS).

-- ----------------------------------------------------------------------------
-- 3. Partition management: create partitions ahead of time, and schedule
--    a monthly job so writes never fail because "next month" has no partition.
-- ----------------------------------------------------------------------------

create or replace function public.ensure_audit_log_partition(target_month date)
returns void language plpgsql as $$
declare
  partition_name text := 'audit_log_' || to_char(target_month, 'YYYY_MM');
  start_date date := date_trunc('month', target_month);
  end_date date := (date_trunc('month', target_month) + interval '1 month')::date;
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = partition_name and n.nspname = 'public'
  ) then
    execute format(
      'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
      partition_name, start_date, end_date
    );
  end if;
end;
$$;

-- Pre-create this month + next 2 months so there's always headroom.
select public.ensure_audit_log_partition(date_trunc('month', now())::date);
select public.ensure_audit_log_partition((date_trunc('month', now()) + interval '1 month')::date);
select public.ensure_audit_log_partition((date_trunc('month', now()) + interval '2 month')::date);

-- Supabase Postgres ships with pg_cron available; schedule partition
-- creation on the 25th of each month so the next month's partition
-- always exists well before the rollover.
create extension if not exists pg_cron;

select cron.schedule(
  'ensure-audit-log-partition',
  '0 0 25 * *',
  $$select public.ensure_audit_log_partition((date_trunc('month', now()) + interval '1 month')::date)$$
);

-- ----------------------------------------------------------------------------
-- 4. Drop the old unpartitioned table. Safe here because this project has
--    no production audit_log data yet.
-- ----------------------------------------------------------------------------

drop table public.audit_log_old;

-- ============================================================================
-- MIGRATING EXISTING DATA (only relevant once audit_log has real rows)
--
-- Do NOT rename-and-drop in that scenario. Instead:
--   1. Create the new partitioned table under a temp name (audit_log_new).
--   2. insert into audit_log_new select * from audit_log;  -- backfill
--   3. In a single transaction: rename audit_log -> audit_log_backup,
--      rename audit_log_new -> audit_log.
--   4. Verify row counts match, then drop audit_log_backup once confident.
-- This avoids any window where writes could be lost.
-- ============================================================================
