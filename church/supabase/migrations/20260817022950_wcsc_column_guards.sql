-- =========================================================
-- 열 단위 잠금
--
-- Postgres 정책의 WITH CHECK 는 이전 값(OLD)을 볼 수 없어서,
-- "이 열만은 못 바꾼다" 는 규칙은 트리거로 막습니다.
-- (Firestore 규칙에서 request.resource.data.x == resource.data.x 로 하던 부분)
-- =========================================================

-- 본인은 이름 · 연락처 등만. 직분 · 승인 · 권한은 잠급니다.
create or replace function public.users_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can('members') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.approved is distinct from old.approved
     or new.perms is distinct from old.perms then
    raise exception '직분 · 승인 · 권한은 본인이 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger users_guard
  before update on public.users
  for each row execute function public.users_guard();

-- 교회가 알려준 정보는 그 교회가 승인한 동안에만 고칠 수 있습니다.
-- (내부 메모 memo 는 언제든 수정 가능 — 센터가 관리하는 값이라서)
create or replace function public.customers_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger customers_guard
  before update on public.customers
  for each row execute function public.customers_guard();

-- 매물: 등록자는 내용만. 상태를 스스로 올리거나 요금을 납부 처리할 수 없습니다.
create or replace function public.listings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can('customers') then
    return new;
  end if;
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

create trigger listings_guard
  before update on public.listings
  for each row execute function public.listings_guard();

-- 동의: 교회 계정은 승인 · 거절만. 어떤 항목을 고치겠다는 내용 자체는 못 바꿉니다.
create or replace function public.edit_consents_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can('customers') then
    return new;
  end if;
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

create trigger edit_consents_guard
  before update on public.edit_consents
  for each row execute function public.edit_consents_guard();
