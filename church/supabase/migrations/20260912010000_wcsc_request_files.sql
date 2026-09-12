-- =========================================================
-- 신청서 첨부 파일 — request-files
--
-- 홈페이지 의뢰서처럼 신청할 때 파일을 함께 올리는 항목이 있습니다.
-- 로고 원본, 예배당 사진, 그리고 사업자등록증까지 한 자리에 옵니다.
--
-- 왜 전부 비공개인가
--   사업자등록증에는 상호 · 대표자 성명 · 주소 · 등록번호가 그대로
--   들어 있습니다. 로고와 사진만 공개로 두고 서류만 가리는 방법도
--   있지만, 올리는 분이 어느 칸에 무엇을 넣을지는 우리가 정하지
--   못합니다 — 사진 칸에 등록증을 넣는 일이 실제로 생깁니다.
--   그래서 신청서에 딸린 파일은 종류를 가리지 않고 모두 비공개로 둡니다.
--   매물 사진(listing-photos)과 달리 남에게 보여 주는 것이 목적이
--   아니므로, 잃는 것도 없습니다.
--
-- 여는 방법
--   비공개 버킷이라 주소가 그대로 열리지 않습니다.
--   assets/js/db.js 의 files.url() 이 10분짜리 서명 주소를 만들어 줍니다
--   (listing-proofs 와 같은 방식).
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-files', 'request-files', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
         'application/postscript', 'image/vnd.adobe.photoshop', 'application/zip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 올린 본인과 승인된 직원만 ----------
-- 경로는 request-files/<올린 사람 id>/<파일> 입니다.
-- 첫 칸이 자기 id 인 것만 쓸 수 있으므로, 남의 자리에 넣지 못합니다.

create policy request_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'request-files'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  );

create policy request_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'request-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy request_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'request-files'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  );
