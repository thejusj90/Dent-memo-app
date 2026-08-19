-- Private storage buckets for DentMemo Consent.
-- PDFs are retained for recovery if email copies are deleted.
-- Branding assets are kept separately from clinical documents.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'dm-consent-documents',
    'dm-consent-documents',
    false,
    5242880,
    array['application/pdf']::text[]
  ),
  (
    'dm-consent-branding',
    'dm-consent-branding',
    false,
    2097152,
    array['image/png','image/jpeg','image/webp']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
