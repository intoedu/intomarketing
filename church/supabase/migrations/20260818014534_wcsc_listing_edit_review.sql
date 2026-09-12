-- =========================================================
-- 게시된 매물을 고칠 때도 다시 확인을 받습니다
--
-- 이 파일은 **운영 데이터베이스에서 되찾아 온 것**입니다.
-- 콘솔에서 직접 실행되어 저장소에는 남아 있지 않았고, 그 바람에
-- supabase.sql 로 새 프로젝트를 만들면 이 변경만 빠졌습니다.
-- (2026-08-28 확인 후 원래 자리에 되돌려 놓았습니다.)
--
-- 하는 일
--   listings 에 두 칸을 더합니다.
--     first_published_at  처음 게시한 시각. 지우지 않습니다 —
--                         전에 한 번 승인받은 글인지 가리는 표시입니다.
--     edit_requested_at   수정 승인을 요청한 시각. 다시 게시하면 비웁니다.
--   그리고 listings_guard 트리거가 first_published_at 까지 지키게 합니다 —
--   등록자가 "전에 승인받았다"는 표시를 스스로 만들어 낼 수 없어야 하니까요.
-- =========================================================

alter table public.listings
  add column if not exists first_published_at text not null default '',
  add column if not exists edit_requested_at  text not null default '';

comment on column public.listings.first_published_at is
  '처음 게시한 시각. 지우지 않습니다 — 전에 승인받은 글인지 가리는 표시입니다.';
comment on column public.listings.edit_requested_at is
  '수정 승인을 요청한 시각. 게시하면 비웁니다.';

-- 이미 게시된 글에는 지금 게시 시각을 그대로 넣어 둡니다.
update public.listings
   set first_published_at = published_at
 where first_published_at = '' and published_at <> '';

create index if not exists listings_edit_requested_idx
  on public.listings (edit_requested_at)
  where edit_requested_at <> '';

create or replace function public.listings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.no_end_user() or public.can('customers') then return new; end if;
  if new.user_id is distinct from old.user_id then
    raise exception '등록자를 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  if new.fee is distinct from old.fee then
    raise exception '등록비 상태는 센터만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if new.published_at is distinct from old.published_at
     or new.first_published_at is distinct from old.first_published_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.expires_at is distinct from old.expires_at then
    raise exception '게시 정보는 센터만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 함수 실행 권한은 다른 가드들과 같게 맞춰 둡니다 (트리거만 부릅니다).
revoke execute on function public.listings_guard() from public, anon, authenticated;
