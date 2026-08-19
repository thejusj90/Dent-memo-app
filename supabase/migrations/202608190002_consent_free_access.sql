-- DentMemo Consent is free-access for clinic members.
-- This migration deliberately removes payment/subscription gating from consent creation.

-- Existing and future clinics get an active Consent access marker so older clients
-- that still read dm_product_entitlements do not show a subscription gate.
insert into public.dm_product_entitlements (clinic_id, product_key, status)
select c.id, 'consent', 'active'
from public.dm_clinics c
on conflict (clinic_id, product_key)
do update set status = 'active', current_period_end = null, updated_at = now();

create or replace function private.dm_grant_consent_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dm_product_entitlements (clinic_id, product_key, status)
  values (new.id, 'consent', 'active')
  on conflict (clinic_id, product_key)
  do update set status = 'active', current_period_end = null, updated_at = now();
  return new;
end;
$$;

revoke all on function private.dm_grant_consent_access() from public;

drop trigger if exists dm_grant_consent_access on public.dm_clinics;
create trigger dm_grant_consent_access
after insert on public.dm_clinics
for each row execute function private.dm_grant_consent_access();

-- Consent creation depends only on clinic membership, never on a paid entitlement.
drop policy if exists dm_consents_insert on public.dm_consents;
create policy dm_consents_insert
on public.dm_consents
for insert
to authenticated
with check (
  private.dm_is_member(clinic_id)
  and created_by = (select auth.uid())
);

-- Private PDF upload is clinic-member scoped and is not payment-gated.
drop policy if exists dm_consent_documents_insert on storage.objects;
create policy dm_consent_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dm-consent-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and private.dm_is_member(((storage.foldername(name))[1])::uuid)
);
