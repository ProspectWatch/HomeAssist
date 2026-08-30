-- Receipt photos are now uploaded by the browser straight to this bucket
-- (a Vercel Function rejects any request body over 4.5 MB, so a phone photo
-- can't travel through a Server Action). That moves the real enforcement point
-- for the app's 15 MB receipt contract from application code to the bucket:
-- a client that skips the app's own checks still can't put an oversized or
-- unreadable file in here.
--
-- 15 MB matches the app-side limit exactly (MAX_RECEIPT_BYTES). The MIME list
-- is exactly what the extractor can read — anything else would be stored and
-- then fail extraction, which is a worse experience than being refused.
--
-- The bucket stays private and the household-scoped RLS policies from 0015 are
-- unchanged; this only adds size and type limits on top of them.
update storage.buckets
set
  file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'receipts';
