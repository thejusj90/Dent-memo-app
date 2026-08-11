create extension if not exists pgcrypto;

create type public.clinic_role as enum ('owner','dentist','consultant','assistant');
create type public.appointment_status as enum ('scheduled','confirmed','arrived','in_progress','completed','cancelled','no_show');
create type public.treatment_status as enum ('planned','in_progress','completed','cancelled');
create type public.payment_method as enum ('cash','upi','card','bank_transfer','other');
create type public.reminder_status as enum ('pending','sent','failed','cancelled');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.clinic_role not null,
  full_name text not null,
  registration_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinic_id,user_id)
);
create table public.patients (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_number text not null, full_name text not null, phone text not null, date_of_birth date, gender text, allergies text,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(clinic_id,patient_number)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id), practitioner_user_id uuid references auth.users(id),
  starts_at timestamptz not null, ends_at timestamptz not null, status public.appointment_status not null default 'scheduled',
  reason text, google_event_id text, reminder_status text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at > starts_at)
);
create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade, tooth_number text, treatment_name text not null,
  diagnosis text, status public.treatment_status not null default 'planned', quoted_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.visits (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id), appointment_id uuid references public.appointments(id),
  practitioner_user_id uuid not null references auth.users(id), occurred_at timestamptz not null default now(), clinical_note text not null,
  follow_up_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.visit_treatments (
  id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id), tooth_number text, treatment_name text not null,
  status public.treatment_status not null, fee numeric(12,2) not null default 0, created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id), visit_id uuid references public.visits(id), amount numeric(12,2) not null check(amount > 0),
  method public.payment_method not null, received_at timestamptz not null default now(), recorded_by uuid not null references auth.users(id),
  note text, created_at timestamptz not null default now()
);
create table public.reminders (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade, channel text not null default 'whatsapp' check(channel='whatsapp'),
  scheduled_for timestamptz not null, status public.reminder_status not null default 'pending', provider_message_id text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_user_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create index patients_clinic_name_idx on public.patients(clinic_id,full_name);
create index patients_clinic_phone_idx on public.patients(clinic_id,phone);
create index appointments_clinic_starts_idx on public.appointments(clinic_id,starts_at);
create index visits_patient_date_idx on public.visits(patient_id,occurred_at desc);
create index treatment_plans_patient_idx on public.treatment_plans(patient_id,status);
create index reminders_due_idx on public.reminders(status,scheduled_for);

create function public.is_clinic_member(target_clinic uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.clinic_members where clinic_id=target_clinic and user_id=auth.uid() and active=true)
$$;
create function public.has_clinical_access(target_clinic uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.clinic_members where clinic_id=target_clinic and user_id=auth.uid() and active=true and role in ('owner','dentist','consultant'))
$$;
create function public.is_clinic_owner(target_clinic uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.clinic_members where clinic_id=target_clinic and user_id=auth.uid() and active=true and role='owner')
$$;

alter table public.clinics enable row level security; alter table public.clinic_members enable row level security;
alter table public.patients enable row level security; alter table public.appointments enable row level security;
alter table public.treatment_plans enable row level security; alter table public.visits enable row level security;
alter table public.visit_treatments enable row level security; alter table public.payments enable row level security;
alter table public.reminders enable row level security; alter table public.audit_log enable row level security;

create policy clinics_read on public.clinics for select using (public.is_clinic_member(id));
create policy clinics_insert on public.clinics for insert with check (owner_user_id=auth.uid());
create policy clinics_update on public.clinics for update using (public.is_clinic_owner(id));
create policy members_read on public.clinic_members for select using (public.is_clinic_member(clinic_id));
create policy members_manage on public.clinic_members for all using (public.is_clinic_owner(clinic_id)) with check (public.is_clinic_owner(clinic_id));
create policy patients_read on public.patients for select using (public.is_clinic_member(clinic_id));
create policy patients_write on public.patients for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy appointments_access on public.appointments for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy treatment_read on public.treatment_plans for select using (public.is_clinic_member(clinic_id));
create policy treatment_write on public.treatment_plans for all using (public.has_clinical_access(clinic_id)) with check (public.has_clinical_access(clinic_id));
create policy visits_read on public.visits for select using (public.is_clinic_member(clinic_id));
create policy visits_write on public.visits for all using (public.has_clinical_access(clinic_id)) with check (public.has_clinical_access(clinic_id));
create policy visit_tx_access on public.visit_treatments for all using (exists(select 1 from public.visits v where v.id=visit_id and public.has_clinical_access(v.clinic_id))) with check (exists(select 1 from public.visits v where v.id=visit_id and public.has_clinical_access(v.clinic_id)));
create policy payments_read on public.payments for select using (public.is_clinic_member(clinic_id));
create policy payments_write on public.payments for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy reminders_access on public.reminders for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy audit_owner_read on public.audit_log for select using (public.is_clinic_owner(clinic_id));

-- Atomic onboarding: create the clinic and first owner membership together.
create function public.create_clinic(clinic_name text, clinic_city text, owner_name text, registration_no text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_clinic_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.clinics(name,city,owner_user_id) values(clinic_name,clinic_city,auth.uid()) returning id into new_clinic_id;
  insert into public.clinic_members(clinic_id,user_id,role,full_name,registration_number) values(new_clinic_id,auth.uid(),'owner',owner_name,registration_no);
  return new_clinic_id;
end; $$;
grant execute on function public.create_clinic(text,text,text,text) to authenticated;

