-- DentMemo Consent v2: clinic identity, general audit, and versioned custom templates.

alter table public.dm_clinics
  add column if not exists consent_logo_path text,
  add column if not exists consent_address text,
  add column if not exists consent_phone text,
  add column if not exists consent_email text;

alter table public.dm_consent_audit_events
  alter column consent_id drop not null;

alter table public.dm_consent_audit_events
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists actor_display_name text;

alter table public.dm_consent_audit_events
  drop constraint if exists dm_consent_audit_events_event_type_check;

create index if not exists dm_consent_audit_clinic_created_idx
  on public.dm_consent_audit_events(clinic_id, created_at desc);

create or replace function public.dm_log_consent_audit(
  target_clinic uuid,
  target_consent uuid,
  target_event text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  if not private.dm_is_member(target_clinic) then
    raise exception 'Clinic access denied';
  end if;

  select m.display_name into display_name
  from public.dm_clinic_members m
  where m.clinic_id = target_clinic
    and m.user_id = auth.uid()
    and m.active = true
  limit 1;

  insert into public.dm_consent_audit_events(
    clinic_id, consent_id, event_type, actor_user_id,
    actor_display_name, entity_type, entity_id, metadata
  ) values (
    target_clinic, target_consent, target_event, auth.uid(),
    display_name, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) from public;
grant execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) to authenticated;

-- Clinic owners may update the Consent-facing clinic profile.
create policy dm_clinics_consent_update on public.dm_clinics
  for update to authenticated
  using (private.dm_is_owner(id))
  with check (private.dm_is_owner(id));

-- Allow clinic owners to create/update their own templates. Existing RLS still applies.
-- Editing an already-used template is handled in application code by creating a new version.

-- Private clinic logo bucket policies. Create the bucket `dm-consent-branding` separately.
create policy dm_consent_branding_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dm-consent-branding'
    and array_length(storage.foldername(name),1) >= 1
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and private.dm_is_member(((storage.foldername(name))[1])::uuid)
  );

create policy dm_consent_branding_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dm-consent-branding'
    and array_length(storage.foldername(name),1) >= 1
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and private.dm_is_owner(((storage.foldername(name))[1])::uuid)
  );

create policy dm_consent_branding_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'dm-consent-branding'
    and array_length(storage.foldername(name),1) >= 1
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and private.dm_is_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'dm-consent-branding'
    and array_length(storage.foldername(name),1) >= 1
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and private.dm_is_owner(((storage.foldername(name))[1])::uuid)
  );
