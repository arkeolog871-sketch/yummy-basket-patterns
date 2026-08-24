-- Advertisement videos in the branding bucket (MP4 / WEBM / MOV, 30 MB).
-- If allowed_mime_types is NULL the bucket already accepts all types; leave it open.

UPDATE storage.buckets
SET
  file_size_limit = CASE
    WHEN file_size_limit IS NULL THEN 31457280
    WHEN file_size_limit < 31457280 THEN 31457280
    ELSE file_size_limit
  END,
  allowed_mime_types = CASE
    WHEN allowed_mime_types IS NULL THEN NULL
    ELSE (
      SELECT array_agg(DISTINCT mime)
      FROM unnest(
        allowed_mime_types || ARRAY['video/mp4', 'video/webm', 'video/quicktime']::text[]
      ) AS mime
    )
  END
WHERE id = 'branding';
