-- =========================================================
-- 열 잠금 트리거 — 관리 도구는 통과시킵니다
--
-- 앞의 트리거들은 "본인이 자기 직분을 올릴 수 없다" 같은 규칙을 강제합니다.
-- 그런데 그 규칙이 Supabase 대시보드 · SQL Editor · service_role 키에도
-- 똑같이 걸려, 첫 최고관리자를 지정하는 한 줄조차 막히는 문제가 있었습니다.
--
--   update public.users set role = 'owner' ... ;
--   → ERROR: 직분 · 승인 · 권한은 본인이 바꿀 수 없습니다.
--
-- 원인은 can('members') 가 auth.uid() 를 보는데, 대시보드에서 실행하면
-- 로그인한 사용자가 없어 auth.uid() 가 null 이라 항상 false 가 되기 때문입니다.
--
-- 그래서 "브라우저에서 온 요청인지" 를 먼저 확인하고, 아니면(= 관리 도구에서
-- 직접 실행한 SQL 이면) 규칙을 건너뜁니다. 브라우저에서 오는 anon ·
-- authenticated 요청은 언제나 auth.uid() 가 채워지므로 그대로 막힙니다.
-- =========================================================

-- 로그인한 사용자가 없는 요청 = 대시보드 · SQL Editor · service_role
create or replace function public.no_end_user()
returns boolean
language sql
stable
as $$
  select auth.uid() is null;
$$;

revoke execute on function public.no_end_user() from public, anon, authenticated;

/* ---------- users : 직분 · 승인 · 권한 ---------- */
create or replace function public.users_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.no_end_user() or public.can('members') then return new; end if;
  if new.role is distinct from old.role
     or new.approved is distinct from old.approved
     or new.perms is distinct from old.perms then
    raise exception '직분 · 승인 · 권한은 본인이 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

/* ---------- customers : 교회 정보는 승인이 있어야 ---------- */
create or replace function public.customers_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.no_end_user() then return new; end if;
  if new.name          is distinct from old.name
     or new.denomination is distinct from old.denomination
     or new.location     is distinct from old.location
     or new.size         is distinct from old.size
     or new.contact_name is distinct from old.contact_name
     or new.contact_role is distinct from old.contact_role
     or new.phone        is distinct from old.phone
     or new.email        is distinct from old.email then
    if not public.edit_approved(old.id) then
      raise exception '교회 정보를 고치려면 그 교회의 수정 승인이 필요합니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

/* ---------- listings : 등록비 · 게시 정보는 센터만 ---------- */
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
     or new.reviewed_by is distinct from old.reviewed_by
     or new.expires_at is distinct from old.expires_at then
    raise exception '게시 정보는 센터만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

/* ---------- edit_consents : 요청 내용은 센터만 ---------- */
create or replace function public.edit_consents_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.no_end_user() or public.can('customers') then return new; end if;
  if new.fields is distinct from old.fields
     or new.reason is distinct from old.reason
     or new.user_id is distinct from old.user_id
     or new.customer_name is distinct from old.customer_name
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at then
    raise exception '요청 내용은 센터만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
