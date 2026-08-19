-- DentMemo Consent security hardening: audit RPC is available only to signed-in users.
revoke execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) from public;
revoke execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) from anon;
grant execute on function public.dm_log_consent_audit(uuid,uuid,text,text,uuid,jsonb) to authenticated;
