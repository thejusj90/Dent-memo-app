create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.dm_clinics (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) between 2 and 120),
  city text,
  timezone text not null default 'Asia/Kolkata',
  registration_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dm_clinic_members (
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','dentist','consultant','assistant')),
  display_name text not null,
  registration_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinic_id,user_id)
);

create table public.dm_patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  patient_number text not null,
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text not null,
  date_of_birth date,
  gender text,
  allergies text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id,patient_number)
);

create table public.dm_appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  patient_id uuid references public.dm_patients(id) on delete set null,
  practitioner_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','arrived','in_progress','completed','cancelled','no_show')),
  reason text,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at > starts_at)
);

create table public.dm_treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  patient_id uuid not null references public.dm_patients(id) on delete cascade,
  tooth_number text,
  treatment_name text not null,
  diagnosis text,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  quoted_amount numeric(12,2) not null default 0 check (quoted_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dm_visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  patient_id uuid not null references public.dm_patients(id) on delete cascade,
  appointment_id uuid references public.dm_appointments(id) on delete set null,
  practitioner_user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  clinical_note text not null,
  follow_up_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dm_visit_treatments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.dm_visits(id) on delete cascade,
  treatment_plan_id uuid references public.dm_treatment_plans(id) on delete set null,
  tooth_number text,
  treatment_name text not null,
  status text not null check (status in ('planned','in_progress','completed','cancelled')),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  created_at timestamptz not null default now()
);

create table public.dm_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  patient_id uuid not null references public.dm_patients(id) on delete cascade,
  visit_id uuid references public.dm_visits(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','upi','card','bank_transfer','other')),
  received_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.dm_reminders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  appointment_id uuid not null references public.dm_appointments(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dm_audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index dm_patients_clinic_name_idx on public.dm_patients(clinic_id,full_name);
create index dm_patients_clinic_phone_idx on public.dm_patients(clinic_id,phone);
create index dm_appointments_clinic_starts_idx on public.dm_appointments(clinic_id,starts_at);
create index dm_visits_patient_date_idx on public.dm_visits(patient_id,occurred_at desc);
create index dm_treatment_plans_patient_status_idx on public.dm_treatment_plans(patient_id,status);
create index dm_payments_patient_date_idx on public.dm_payments(patient_id,received_at desc);
create index dm_reminders_due_idx on public.dm_reminders(status,scheduled_for) where status = 'pending';

create function private.dm_is_member(target_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.dm_clinic_members m where m.clinic_id = target_clinic and m.user_id = (select auth.uid()) and m.active)
$$;
create function private.dm_has_clinical_access(target_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.dm_clinic_members m where m.clinic_id = target_clinic and m.user_id = (select auth.uid()) and m.active and m.role in ('owner','dentist','consultant'))
$$;
create function private.dm_is_owner(target_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.dm_clinic_members m where m.clinic_id = target_clinic and m.user_id = (select auth.uid()) and m.active and m.role = 'owner')
$$;
create function private.dm_add_owner_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.dm_clinic_members(clinic_id,user_id,role,display_name,registration_number)
  values(new.id,new.owner_user_id,'owner',coalesce((select raw_user_meta_data->>'full_name' from auth.users where id=new.owner_user_id),'Clinic owner'),new.registration_number);
  return new;
end; $$;
create function private.dm_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

revoke all on all functions in schema private from public;
grant execute on function private.dm_is_member(uuid), private.dm_has_clinical_access(uuid), private.dm_is_owner(uuid) to authenticated;

create trigger dm_clinic_add_owner after insert on public.dm_clinics for each row execute function private.dm_add_owner_membership();
create trigger dm_clinics_updated before update on public.dm_clinics for each row execute function private.dm_set_updated_at();
create trigger dm_patients_updated before update on public.dm_patients for each row execute function private.dm_set_updated_at();
create trigger dm_appointments_updated before update on public.dm_appointments for each row execute function private.dm_set_updated_at();
create trigger dm_treatment_plans_updated before update on public.dm_treatment_plans for each row execute function private.dm_set_updated_at();
create trigger dm_visits_updated before update on public.dm_visits for each row execute function private.dm_set_updated_at();
create trigger dm_reminders_updated before update on public.dm_reminders for each row execute function private.dm_set_updated_at();

alter table public.dm_clinics enable row level security;
alter table public.dm_clinic_members enable row level security;
alter table public.dm_patients enable row level security;
alter table public.dm_appointments enable row level security;
alter table public.dm_treatment_plans enable row level security;
alter table public.dm_visits enable row level security;
alter table public.dm_visit_treatments enable row level security;
alter table public.dm_payments enable row level security;
alter table public.dm_reminders enable row level security;
alter table public.dm_audit_log enable row level security;

create policy dm_clinics_select on public.dm_clinics for select to authenticated using (private.dm_is_member(id));
create policy dm_clinics_insert on public.dm_clinics for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy dm_clinics_update on public.dm_clinics for update to authenticated using (private.dm_is_owner(id)) with check (private.dm_is_owner(id));
create policy dm_clinics_delete on public.dm_clinics for delete to authenticated using (private.dm_is_owner(id));
create policy dm_members_select on public.dm_clinic_members for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_members_insert on public.dm_clinic_members for insert to authenticated with check (private.dm_is_owner(clinic_id));
create policy dm_members_update on public.dm_clinic_members for update to authenticated using (private.dm_is_owner(clinic_id)) with check (private.dm_is_owner(clinic_id));
create policy dm_members_delete on public.dm_clinic_members for delete to authenticated using (private.dm_is_owner(clinic_id));
create policy dm_patients_select on public.dm_patients for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_patients_insert on public.dm_patients for insert to authenticated with check (private.dm_is_member(clinic_id));
create policy dm_patients_update on public.dm_patients for update to authenticated using (private.dm_is_member(clinic_id)) with check (private.dm_is_member(clinic_id));
create policy dm_patients_delete on public.dm_patients for delete to authenticated using (private.dm_is_owner(clinic_id));
create policy dm_appointments_select on public.dm_appointments for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_appointments_insert on public.dm_appointments for insert to authenticated with check (private.dm_is_member(clinic_id));
create policy dm_appointments_update on public.dm_appointments for update to authenticated using (private.dm_is_member(clinic_id)) with check (private.dm_is_member(clinic_id));
create policy dm_appointments_delete on public.dm_appointments for delete to authenticated using (private.dm_is_owner(clinic_id));
create policy dm_treatments_select on public.dm_treatment_plans for select to authenticated using (private.dm_has_clinical_access(clinic_id));
create policy dm_treatments_insert on public.dm_treatment_plans for insert to authenticated with check (private.dm_has_clinical_access(clinic_id));
create policy dm_treatments_update on public.dm_treatment_plans for update to authenticated using (private.dm_has_clinical_access(clinic_id)) with check (private.dm_has_clinical_access(clinic_id));
create policy dm_treatments_delete on public.dm_treatment_plans for delete to authenticated using (private.dm_has_clinical_access(clinic_id));
create policy dm_visits_select on public.dm_visits for select to authenticated using (private.dm_has_clinical_access(clinic_id));
create policy dm_visits_insert on public.dm_visits for insert to authenticated with check (private.dm_has_clinical_access(clinic_id));
create policy dm_visits_update on public.dm_visits for update to authenticated using (private.dm_has_clinical_access(clinic_id)) with check (private.dm_has_clinical_access(clinic_id));
create policy dm_visits_delete on public.dm_visits for delete to authenticated using (private.dm_has_clinical_access(clinic_id));
create policy dm_visit_tx_select on public.dm_visit_treatments for select to authenticated using (exists(select 1 from public.dm_visits v where v.id = visit_id and private.dm_has_clinical_access(v.clinic_id)));
create policy dm_visit_tx_insert on public.dm_visit_treatments for insert to authenticated with check (exists(select 1 from public.dm_visits v where v.id = visit_id and private.dm_has_clinical_access(v.clinic_id)));
create policy dm_visit_tx_update on public.dm_visit_treatments for update to authenticated using (exists(select 1 from public.dm_visits v where v.id = visit_id and private.dm_has_clinical_access(v.clinic_id))) with check (exists(select 1 from public.dm_visits v where v.id = visit_id and private.dm_has_clinical_access(v.clinic_id)));
create policy dm_visit_tx_delete on public.dm_visit_treatments for delete to authenticated using (exists(select 1 from public.dm_visits v where v.id = visit_id and private.dm_has_clinical_access(v.clinic_id)));
create policy dm_payments_select on public.dm_payments for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_payments_insert on public.dm_payments for insert to authenticated with check (private.dm_is_member(clinic_id) and recorded_by = (select auth.uid()));
create policy dm_payments_update on public.dm_payments for update to authenticated using (private.dm_is_member(clinic_id)) with check (private.dm_is_member(clinic_id));
create policy dm_payments_delete on public.dm_payments for delete to authenticated using (private.dm_is_owner(clinic_id));
create policy dm_reminders_select on public.dm_reminders for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_reminders_insert on public.dm_reminders for insert to authenticated with check (private.dm_is_member(clinic_id));
create policy dm_reminders_update on public.dm_reminders for update to authenticated using (private.dm_is_member(clinic_id)) with check (private.dm_is_member(clinic_id));
create policy dm_reminders_delete on public.dm_reminders for delete to authenticated using (private.dm_is_owner(clinic_id));
create policy dm_audit_select on public.dm_audit_log for select to authenticated using (private.dm_is_owner(clinic_id));

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.dm_clinics,public.dm_clinic_members,public.dm_patients,public.dm_appointments,public.dm_treatment_plans,public.dm_visits,public.dm_visit_treatments,public.dm_payments,public.dm_reminders to authenticated;
grant select on public.dm_audit_log to authenticated;
