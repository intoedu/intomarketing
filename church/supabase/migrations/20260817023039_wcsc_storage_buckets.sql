-- =========================================================
-- 파일 저장소 — 공개 범위가 정반대인 두 버킷
--
--   listing-photos  매물 사진   누구나 봅니다 (게시판에 보여 주는 것이 목적)
--   listing-proofs  권리 증빙   올린 본인과 승인된 직원만
--
-- 계약서 · 등기부등본에는 이름 · 주소 · 금액이 들어 있어
-- 게시판에는 절대 노출되지 않아야 합니다. 두 버킷을 섞지 마세요.
-- 파일 경로는 <올린 사람 uid>/<파일명> 규칙을 씁니다.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif']),
  ('listing-proofs', 'listing-proofs', false, 10485760,
   array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* ---------- 매물 사진 : 읽기는 공개, 쓰기는 본인만 ---------- */
create policy listing_photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-photos');

create policy listing_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy listing_photos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy listing_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  );

/* ---------- 권리 증빙 : 올린 본인과 승인된 직원만 ---------- */
create policy listing_proofs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  );

create policy listing_proofs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy listing_proofs_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  );
