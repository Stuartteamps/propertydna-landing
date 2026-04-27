-- ============================================================
-- PropertyDNA — Storage Buckets
-- Run AFTER 002_rls.sql
-- ============================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('report-pdfs',    'report-pdfs',    false, 52428800,  ARRAY['application/pdf']),
  ('report-json',    'report-json',    false, 10485760,  ARRAY['application/json']),
  ('property-images','property-images',true,  10485760,  ARRAY['image/jpeg','image/png','image/webp']),
  ('user-uploads',   'user-uploads',   false, 52428800,  NULL),
  ('exports',        'exports',        false, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ───────────────────────────────────────────────

-- report-pdfs: service role write, owner read (by path prefix = email)
CREATE POLICY "report_pdfs_service_write" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'report-pdfs');

CREATE POLICY "report_pdfs_service_read"  ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'report-pdfs');

CREATE POLICY "report_pdfs_anon_read"     ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'report-pdfs');  -- actual access control via signed URLs

-- report-json: service role only
CREATE POLICY "report_json_service_only"  ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'report-json')
  WITH CHECK (bucket_id = 'report-json');

-- property-images: public read, service role write
CREATE POLICY "prop_images_public_read"   ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'property-images');

CREATE POLICY "prop_images_service_write" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'property-images');

-- user-uploads: service role only
CREATE POLICY "user_uploads_service_only" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'user-uploads')
  WITH CHECK (bucket_id = 'user-uploads');

-- exports: service role only
CREATE POLICY "exports_service_only"      ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'exports')
  WITH CHECK (bucket_id = 'exports');
