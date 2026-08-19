-- Allow the pre-sign `consent_presented` event to be audited before the
-- dm_consents row exists, while preserving clinic isolation for all other events.
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
  resolved_consent uuid;
begin
  if not private.dm_is_member(target_clinic) then
    raise exception 'Clinic access denied';
  end if;

  if target_consent is not null then
    select c.id into resolved_consent
    from public.dm_consents c
    where c.id = target_consent
      and c.clinic_id = target_clinic;

    if resolved_consent is null and target_event <> 'consent_presented' then
      raise exception 'Consent does not belong to clinic or does not exist';
    end if;
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
    target_clinic, resolved_consent, target_event, auth.uid(),
    display_name, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) from public;
revoke execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) from anon;
grant execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) to authenticated;
