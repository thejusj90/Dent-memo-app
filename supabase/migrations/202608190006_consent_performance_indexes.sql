-- DentMemo Consent performance cleanup after advisor review.
-- Existing dm_clinics_update already covers owner-only clinic profile changes,
-- so the duplicate Consent-specific UPDATE policy is unnecessary.
drop policy if exists dm_clinics_consent_update on public.dm_clinics;

create index if not exists dm_consent_audit_actor_idx
  on public.dm_consent_audit_events(actor_user_id)
  where actor_user_id is not null;

create index if not exists dm_consent_templates_created_by_idx
  on public.dm_consent_templates(created_by)
  where created_by is not null;

create index if not exists dm_consent_templates_source_idx
  on public.dm_consent_templates(source_template_id)
  where source_template_id is not null;

create index if not exists dm_consents_created_by_idx
  on public.dm_consents(created_by);

create index if not exists dm_consents_doctor_setting_idx
  on public.dm_consents(doctor_setting_id)
  where doctor_setting_id is not null;

create index if not exists dm_consents_patient_fk_idx
  on public.dm_consents(patient_id)
  where patient_id is not null;

create index if not exists dm_consents_template_fk_idx
  on public.dm_consents(template_id)
  where template_id is not null;
