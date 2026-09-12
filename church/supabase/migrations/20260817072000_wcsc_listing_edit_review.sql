-- =========================================================
-- 매물 수정 승인 요청을 새 등록과 구분합니다
--
-- 등록자가 이미 게시된 글을 고치면 다시 pending 으로 돌아가 재검토를 받는데,
-- 관리자 화면에서는 처음 올라온 글과 똑같이 "승인 대기" 로만 보였습니다.
-- 둘은 봐야 할 것이 다릅니다 —
--   · 새 등록      : 서류부터 처음 확인해야 합니다 (등록비도 아직 안 받았습니다)
--   · 수정 재검토  : 이미 확인한 글이고 등록비도 받았습니다. 바뀐 내용만 봅니다.
--
-- 그래서 두 칸을 둡니다.
--   first_published_at  처음 게시한 시각. 한 번 채우면 지우지 않습니다 —
--                       "전에 승인받은 적이 있는 글" 이라는 표시입니다.
--   edit_requested_at   수정 승인을 요청한 시각. 게시하면 비웁니다.
--
-- published_at 은 수정 요청 때 비워집니다(내려가 있는 상태이므로).
-- 그래서 그것만으로는 과거 승인 여부를 알 수 없어 칸을 따로 둡니다.
-- =========================================================

alter table public.listings
  add column if not exists first_published_at text not null default '',
  add column if not exists edit_requested_at  text not null default '';

comment on column public.listings.first_published_at is
  '처음 게시한 시각. 지우지 않습니다 — 전에 승인받은 글인지 가리는 표시입니다.';
comment on column public.listings.edit_requested_at is
  '수정 승인을 요청한 시각. 게시하면 비웁니다.';

-- 이미 게시된 글은 그 게시일을 첫 게시일로 봅니다.
update public.listings
   set first_published_at = published_at
 where first_published_at = '' and published_at <> '';

create index if not exists listings_edit_requested_idx
  on public.listings (edit_requested_at)
  where edit_requested_at <> '';

/* 첫 게시일은 센터만 다룹니다 — 등록자가 고쳐서 "새 글" 인 척하거나
   반대로 "전에 승인받았다" 고 주장할 수 없게 막습니다.
   (edit_requested_at 은 등록자가 수정을 요청할 때 채우므로 열어 둡니다) */
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
