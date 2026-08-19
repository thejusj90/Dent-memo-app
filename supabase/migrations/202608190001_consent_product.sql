-- DentMemo Consent product schema.
-- Apply this migration before enabling live Consent mode.
-- Create the private `dm-consent-documents` Storage bucket separately through
-- the Supabase Storage API/Dashboard; policies below protect its objects.

create table public.dm_product_entitlements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  product_key text not null check (product_key in ('consent')),
  status text not null default 'expired'
    check (status in ('trial','active','past_due','cancelled','expired')),
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, product_key)
);

create table public.dm_consent_doctor_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  doctor_name text not null check (length(trim(doctor_name)) between 2 and 120),
  registration_number text,
  email text not null check (position('@' in email) > 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dm_consent_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.dm_clinics(id) on delete cascade,
  source_template_id uuid references public.dm_consent_templates(id) on delete set null,
  procedure_key text not null,
  display_title text not null check (length(trim(display_title)) between 2 and 160),
  consent_text text not null check (length(trim(consent_text)) >= 40),
  locale text not null default 'en-IN',
  version integer not null default 1 check (version >= 1),
  approval_status text not null default 'needs_review'
    check (approval_status in ('needs_review','approved')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dm_consent_template_source_version_uidx
  on public.dm_consent_templates(clinic_id, source_template_id, version)
  where source_template_id is not null;

create table public.dm_consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  consent_number text not null,
  template_id uuid references public.dm_consent_templates(id) on delete set null,
  template_version integer not null default 1,
  patient_id uuid references public.dm_patients(id) on delete set null,
  patient_name_snapshot text not null check (length(trim(patient_name_snapshot)) >= 2),
  patient_mobile_snapshot text,
  patient_dob_snapshot date,
  patient_identifier_snapshot text,
  doctor_setting_id uuid references public.dm_consent_doctor_settings(id) on delete set null,
  doctor_name_snapshot text not null,
  doctor_registration_snapshot text,
  doctor_email_snapshot text,
  procedure_key text not null,
  procedure_name_snapshot text not null,
  tooth_numbers text,
  procedure_notes text,
  consent_title_snapshot text not null,
  consent_text_snapshot text not null,
  locale text not null default 'en-IN',
  acknowledgements jsonb not null default '[]'::jsonb,
  signer_type text not null check (signer_type in ('patient','guardian')),
  signer_name text not null,
  signer_relationship text,
  signature_strokes jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','ready_for_signature','signed','voided')),
  signed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  pdf_storage_path text,
  email_status text not null default 'pending'
    check (email_status in ('pending','sent','failed')),
  email_sent_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, consent_number),
  check ((status in ('draft','ready_for_signature')) or
    (signed_at is not null and jsonb_array_length(signature_strokes) > 0)),
  check (status <> 'voided' or
    (voided_at is not null and length(trim(coalesce(void_reason,''))) >= 3)),
  check (signer_type <> 'guardian' or
    length(trim(coalesce(signer_relationship,''))) >= 2)
);

create table public.dm_consent_audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.dm_clinics(id) on delete cascade,
  consent_id uuid not null references public.dm_consents(id) on delete cascade,
  event_type text not null check (event_type in (
    'created','consent_presented','acknowledged','signed','pdf_generated',
    'email_sent','email_failed','pdf_downloaded','voided'
  )),
  actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index dm_entitlement_clinic_status_idx
  on public.dm_product_entitlements(clinic_id, product_key, status);
create index dm_consent_doctors_clinic_idx
  on public.dm_consent_doctor_settings(clinic_id, active, doctor_name);
create index dm_consent_templates_clinic_idx
  on public.dm_consent_templates(clinic_id, active, display_title);
create index dm_consents_clinic_created_idx
  on public.dm_consents(clinic_id, created_at desc);
create index dm_consents_clinic_patient_idx
  on public.dm_consents(clinic_id, patient_name_snapshot);
create index dm_consents_clinic_mobile_idx
  on public.dm_consents(clinic_id, patient_mobile_snapshot);
create index dm_consent_audit_consent_idx
  on public.dm_consent_audit_events(consent_id, created_at);

create function private.dm_has_product(target_clinic uuid, target_product text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.dm_is_member(target_clinic) and exists(
    select 1
    from public.dm_product_entitlements e
    where e.clinic_id = target_clinic
      and e.product_key = target_product
      and e.status in ('trial','active')
      and (e.current_period_end is null or e.current_period_end > now())
  )
$$;

create function private.dm_consent_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status in ('signed','voided') then
    if old.status = 'voided' then
      raise exception 'Voided consents are immutable';
    end if;

    if new.status = 'voided' then
      if not private.dm_has_clinical_access(old.clinic_id) then
        raise exception 'Clinical access is required to void a signed consent';
      end if;
      if new.voided_at is null or length(trim(coalesce(new.void_reason,''))) < 3 then
        raise exception 'A void reason is required';
      end if;
    elsif new.status <> old.status then
      raise exception 'Signed consent status cannot be changed';
    end if;

    if new.clinic_id is distinct from old.clinic_id
      or new.consent_number is distinct from old.consent_number
      or new.template_id is distinct from old.template_id
      or new.template_version is distinct from old.template_version
      or new.patient_id is distinct from old.patient_id
      or new.patient_name_snapshot is distinct from old.patient_name_snapshot
      or new.patient_mobile_snapshot is distinct from old.patient_mobile_snapshot
      or new.patient_dob_snapshot is distinct from old.patient_dob_snapshot
      or new.patient_identifier_snapshot is distinct from old.patient_identifier_snapshot
      or new.doctor_setting_id is distinct from old.doctor_setting_id
      or new.doctor_name_snapshot is distinct from old.doctor_name_snapshot
      or new.doctor_registration_snapshot is distinct from old.doctor_registration_snapshot
      or new.doctor_email_snapshot is distinct from old.doctor_email_snapshot
      or new.procedure_key is distinct from old.procedure_key
      or new.procedure_name_snapshot is distinct from old.procedure_name_snapshot
      or new.tooth_numbers is distinct from old.tooth_numbers
      or new.procedure_notes is distinct from old.procedure_notes
      or new.consent_title_snapshot is distinct from old.consent_title_snapshot
      or new.consent_text_snapshot is distinct from old.consent_text_snapshot
      or new.locale is distinct from old.locale
      or new.acknowledgements is distinct from old.acknowledgements
      or new.signer_type is distinct from old.signer_type
      or new.signer_name is distinct from old.signer_name
      or new.signer_relationship is distinct from old.signer_relationship
      or new.signature_strokes is distinct from old.signature_strokes
      or new.signed_at is distinct from old.signed_at
      or new.pdf_storage_path is distinct from old.pdf_storage_path
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Signed consent content is immutable';
    end if;
  end if;
  return new;
end;
$$;

create function private.dm_consent_audit_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare audit_event text;
begin
  if tg_op = 'INSERT' then
    audit_event := case when new.status = 'signed' then 'signed' else 'created' end;
  elsif new.status is distinct from old.status then
    if new.status = 'signed' then
      audit_event := 'signed';
    elsif new.status = 'voided' then
      audit_event := 'voided';
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.dm_consent_audit_events(
    clinic_id, consent_id, event_type, actor_user_id, metadata
  ) values (
    new.clinic_id,
    new.id,
    audit_event,
    auth.uid(),
    case when audit_event = 'voided'
      then jsonb_build_object('reason', new.void_reason)
      else jsonb_build_object('template_version', new.template_version)
    end
  );
  return new;
end;
$$;

revoke all on function private.dm_has_product(uuid,text) from public;
revoke all on function private.dm_consent_immutable() from public;
revoke all on function private.dm_consent_audit_status() from public;
grant execute on function private.dm_has_product(uuid,text) to authenticated;

create trigger dm_product_entitlements_updated before update on public.dm_product_entitlements
  for each row execute function private.dm_set_updated_at();
create trigger dm_consent_doctors_updated before update on public.dm_consent_doctor_settings
  for each row execute function private.dm_set_updated_at();
create trigger dm_consent_templates_updated before update on public.dm_consent_templates
  for each row execute function private.dm_set_updated_at();
create trigger dm_consents_immutable before update on public.dm_consents
  for each row execute function private.dm_consent_immutable();
create trigger dm_consents_updated before update on public.dm_consents
  for each row execute function private.dm_set_updated_at();
create trigger dm_consents_audit_insert after insert on public.dm_consents
  for each row execute function private.dm_consent_audit_status();
create trigger dm_consents_audit_update after update on public.dm_consents
  for each row execute function private.dm_consent_audit_status();

alter table public.dm_product_entitlements enable row level security;
alter table public.dm_consent_doctor_settings enable row level security;
alter table public.dm_consent_templates enable row level security;
alter table public.dm_consents enable row level security;
alter table public.dm_consent_audit_events enable row level security;

create policy dm_entitlements_select on public.dm_product_entitlements
  for select to authenticated using (private.dm_is_member(clinic_id));

create policy dm_consent_doctors_select on public.dm_consent_doctor_settings
  for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_consent_doctors_insert on public.dm_consent_doctor_settings
  for insert to authenticated with check (private.dm_is_owner(clinic_id));
create policy dm_consent_doctors_update on public.dm_consent_doctor_settings
  for update to authenticated using (private.dm_is_owner(clinic_id))
  with check (private.dm_is_owner(clinic_id));
create policy dm_consent_doctors_delete on public.dm_consent_doctor_settings
  for delete to authenticated using (private.dm_is_owner(clinic_id));

create policy dm_consent_templates_select on public.dm_consent_templates
  for select to authenticated using (clinic_id is null or private.dm_is_member(clinic_id));
create policy dm_consent_templates_insert on public.dm_consent_templates
  for insert to authenticated with check (
    clinic_id is not null and private.dm_is_owner(clinic_id) and created_by = (select auth.uid())
  );
create policy dm_consent_templates_update on public.dm_consent_templates
  for update to authenticated using (clinic_id is not null and private.dm_is_owner(clinic_id))
  with check (clinic_id is not null and private.dm_is_owner(clinic_id));
create policy dm_consent_templates_delete on public.dm_consent_templates
  for delete to authenticated using (clinic_id is not null and private.dm_is_owner(clinic_id));

create policy dm_consents_select on public.dm_consents
  for select to authenticated using (private.dm_is_member(clinic_id));
create policy dm_consents_insert on public.dm_consents
  for insert to authenticated with check (
    private.dm_is_member(clinic_id)
    and private.dm_has_product(clinic_id,'consent')
    and created_by = (select auth.uid())
  );
create policy dm_consents_update on public.dm_consents
  for update to authenticated using (private.dm_is_member(clinic_id))
  with check (private.dm_is_member(clinic_id));

create policy dm_consent_audit_select on public.dm_consent_audit_events
  for select to authenticated using (private.dm_is_member(clinic_id));

grant select on public.dm_product_entitlements to authenticated;
grant select,insert,update,delete on public.dm_consent_doctor_settings to authenticated;
grant select,insert,update,delete on public.dm_consent_templates to authenticated;
grant select,insert,update on public.dm_consents to authenticated;
grant select on public.dm_consent_audit_events to authenticated;

-- The object name must be: {clinic_id}/{consent_id}/signed-consent.pdf
create policy dm_consent_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dm-consent-documents'
    and array_length(storage.foldername(name),1) >= 2
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and private.dm_is_member(((storage.foldername(name))[1])::uuid)
  );

create policy dm_consent_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dm-consent-documents'
    and array_length(storage.foldername(name),1) >= 2
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and private.dm_has_product(((storage.foldername(name))[1])::uuid,'consent')
  );

-- Seed globally readable sample templates. Clinics should review and approve their
-- own copies before treating the text as clinic-approved wording.
insert into public.dm_consent_templates(
  clinic_id, procedure_key, display_title, consent_text, locale, version, approval_status, active
) values
(null, 'general_treatment', 'General Dental Treatment',
 'The proposed dental treatment, its purpose, expected benefits, relevant risks, alternatives and the possibility that additional treatment may become necessary have been explained to me. I have had an opportunity to ask questions and understand that outcomes cannot be guaranteed.',
 'en-IN', 1, 'needs_review', true),
(null, 'extraction', 'Dental Extraction',
 'The proposed dental extraction, expected benefits, relevant risks and possible complications, alternatives to extraction, and post-operative care have been explained to me. I have had an opportunity to ask questions and agree to proceed with the proposed treatment.',
 'en-IN', 1, 'needs_review', true),
(null, 'root_canal', 'Root Canal Treatment',
 'The proposed root canal treatment, its purpose, expected benefits, relevant risks, possible complications, alternatives and the possibility of additional treatment have been explained to me. I have had an opportunity to ask questions and understand that outcomes cannot be guaranteed.',
 'en-IN', 1, 'needs_review', true),
(null, 'implant', 'Dental Implant Treatment',
 'The proposed dental implant treatment, expected benefits, relevant surgical and restorative risks, alternatives, healing requirements and the possibility of additional procedures have been explained to me. I have had an opportunity to ask questions and understand that treatment outcomes cannot be guaranteed.',
 'en-IN', 1, 'needs_review', true),
(null, 'photography', 'Dental Photography / Media Consent',
 'The purpose and intended use of dental photographs or related media have been explained to me. I understand what information may be captured and the clinic has explained whether the media is intended for clinical records, education or another approved purpose. I have had an opportunity to ask questions before giving this consent.',
 'en-IN', 1, 'needs_review', true);