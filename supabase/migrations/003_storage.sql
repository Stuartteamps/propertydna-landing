-- ============================================================
-- PropertyDNA — Storage Bucket Policies
-- Run AFTER 001_schema.sql + 002_rls.sql
--
-- NOTE: The 5 buckets (report-pdfs, report-json, property-images,
-- user-uploads, exports) were already created via the Storage API.
-- This file only sets the access policies on storage.objects.
-- ============================================================

-- report-pdfs: service role write, anon read via signed URLs
DROP POLICY IF EXISTS "report_pdfs_insert" ON storage.objects;
CREATE POLICY "report_pdfs_insert"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'report-pdfs');

DROP POLICY IF EXISTS "report_pdfs_select_service" ON storage.objects;
CREATE POLICY "report_pdfs_select_service"
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'report-pdfs');

DROP POLICY IF EXISTS "report_pdfs_select_anon" ON storage.objects;
CREATE POLICY "report_pdfs_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'report-pdfs');

-- report-json: service role only
DROP POLICY IF EXISTS "report_json_all_service" ON storage.objects;
CREATE POLICY "report_json_all_service"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'report-json')
  WITH CHECK (bucket_id = 'report-json');

-- property-images: public read, service role write
DROP POLICY IF EXISTS "prop_images_select_anon" ON storage.objects;
CREATE POLICY "prop_images_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "prop_images_insert_service" ON storage.objects;
CREATE POLICY "prop_images_insert_service"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'property-images');

-- user-uploads: service role only
DROP POLICY IF EXISTS "user_uploads_all_service" ON storage.objects;
CREATE POLICY "user_uploads_all_service"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'user-uploads')
  WITH CHECK (bucket_id = 'user-uploads');

-- exports: service role only
DROP POLICY IF EXISTS "exports_all_service" ON storage.objects;
CREATE POLICY "exports_all_service"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'exports')
  WITH CHECK (bucket_id = 'exports');
