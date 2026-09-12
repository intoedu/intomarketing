-- =========================================================
-- 권한 확인 도우미
--
-- users 표의 정책 안에서 users 를 다시 읽어야 하므로 (무한 재귀를 피하려고)
-- security definer 로 두고 search_path 를 고정합니다.
-- =========================================================

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.approved
      and u.role in ('owner', 'admin', 'staff')
  );
$$;
comment on function public.is_staff() is '승인된 직원(최고관리자·관리자·직원)인지';

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.approved and u.role = 'owner'
  );
$$;

-- 특정 권한 보유 여부. 최고관리자는 항상 통과합니다.
create or replace function public.can(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.approved
      and (
        u.role = 'owner'
        or (u.role in ('admin', 'staff') and coalesce((u.perms ->> perm)::boolean, false))
      )
  );
$$;
comment on function public.can(text) is '권한 보유 여부 (requests · services · customers · settlement · members · settings)';

-- 그 고객이 정보 수정을 승인해 두었는지.
-- 기한(expires_at)은 문자열이라 앱이 확인하고, 지나면 status 를 expired 로 바꿉니다.
create or replace function public.edit_approved(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.edit_consents c
    where c.customer_id = target and c.status = 'approved'
  );
$$;

grant execute on function public.is_staff(), public.is_owner(),
  public.can(text), public.edit_approved(uuid) to anon, authenticated;
