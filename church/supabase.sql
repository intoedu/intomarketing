-- =========================================================
-- 우리교회지원센터 (WCSC) — Supabase 전체 설정
--
-- WCSC_SUPABASE_VERSION: 20260912010000
--
-- 새 Supabase 프로젝트를 쓰실 때는 이 파일 하나를 SQL Editor 에 통째로
-- 붙여넣고 실행하시면 됩니다. 표 · 접근 규칙(RLS) · 저장소 버킷 ·
-- 가입 트리거가 한 번에 만들어집니다.
--
-- 이 파일은 supabase/migrations/*.sql 을 순서대로 이어 붙인 것입니다.
-- 직접 고치지 마시고, 마이그레이션 파일을 고친 뒤 npm run build 를 실행하세요.
-- =========================================================

-- ---------------------------------------------------------
-- 20260817022909_wcsc_core_tables.sql
-- ---------------------------------------------------------

-- =========================================================
-- 우리교회지원센터 (WCSC) — 기본 표
--
-- 날짜 값은 앱이 ISO 문자열로 다루고 "비어 있음"을 '' 로 표현하므로
-- text 로 둡니다 (ISO-8601 은 문자열 정렬이 시간 순서와 같습니다).
-- DB 쪽 정렬·보관용으로 inserted_at timestamptz 를 따로 둡니다.
-- =========================================================

-- 계정 (auth.users 와 1:1)
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null default '',
  name          text not null default '',
  phone         text not null default '',
  church        text not null default '',
  contact_role  text not null default '',
  birth_date    text not null default '',
  role          text not null default 'client'
                check (role in ('owner', 'admin', 'staff', 'client')),
  approved      boolean not null default false,
  perms         jsonb not null default '{}'::jsonb,
  created_at    text not null default '',
  inserted_at   timestamptz not null default now()
);
comment on table public.users is '계정 정보. 직분(role)과 승인(approved)은 권한자만 바꿀 수 있습니다.';

-- 지원 신청
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'received'
                check (status in ('received','consulting','proposed','progress','hold','done','canceled')),
  services      text[] not null default '{}',
  church_name   text not null default '',
  denomination  text not null default '',
  contact_name  text not null default '',
  contact_role  text not null default '',
  phone         text not null default '',
  email         text not null default '',
  location      text not null default '',
  size          text not null default '',
  budget        text not null default '',
  timeline      text not null default '',
  message       text not null default '',
  prefer        text not null default '',
  marketing     boolean not null default false,
  extra         jsonb not null default '{}'::jsonb,
  assignee      text not null default '',
  due_date      text not null default '',
  memo          text not null default '',
  tasks         jsonb not null default '[]'::jsonb,
  customer_id   uuid,
  created_at    text not null default '',
  inserted_at   timestamptz not null default now()
);
create index requests_user_id_idx on public.requests (user_id);
create index requests_status_idx on public.requests (status);
create index requests_assignee_idx on public.requests (assignee);

-- 고객 교회
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null default '',
  denomination  text not null default '',
  contact_name  text not null default '',
  contact_role  text not null default '',
  phone         text not null default '',
  email         text not null default '',
  location      text not null default '',
  size          text not null default '',
  memo          text not null default '',
  created_at    text not null default '',
  inserted_at   timestamptz not null default now()
);
comment on column public.customers.memo is '센터 내부 메모. 교회 승인 없이도 수정할 수 있는 유일한 항목입니다.';

alter table public.requests
  add constraint requests_customer_fk
  foreign key (customer_id) references public.customers(id) on delete set null;

-- 교회 정보 수정 동의 (고객 한 곳당 가장 최근 요청 한 건)
create table public.edit_consents (
  customer_id       uuid primary key references public.customers(id) on delete cascade,
  customer_name     text not null default '',
  user_id           uuid not null references auth.users(id) on delete cascade,
  fields            text[] not null default '{}',
  reason            text not null default '',
  status            text not null default 'pending'
                    check (status in ('pending','approved','rejected','used','canceled','expired')),
  requested_by      text not null default '',
  requested_by_name text not null default '',
  requested_at      text not null default '',
  responded_at      text not null default '',
  reject_note       text not null default '',
  expires_at        text not null default '',
  used_at           text not null default '',
  created_at        text not null default '',
  inserted_at       timestamptz not null default now()
);
create index edit_consents_user_id_idx on public.edit_consents (user_id);

-- 부동산 매물
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_email     text not null default '',
  status         text not null default 'pending'
                 check (status in ('pending','awaiting_payment','published','rejected','hidden','expired')),
  kind           text not null default 'rent_monthly',
  holder         text not null default 'owner' check (holder in ('owner','tenant','agent')),
  use            text not null default 'church',
  use_other      text not null default '',
  title          text not null default '',
  region         text not null default '',
  address_rough  text not null default '',
  area           text not null default '',
  floor          text not null default '',
  parking        text not null default '',
  deposit        bigint not null default 0,
  monthly        bigint not null default 0,
  sale_price     bigint not null default 0,
  maintenance    bigint not null default 0,
  move_in        text not null default '',
  religious_use  text not null default '',
  "desc"         text not null default '',
  contact_name   text not null default '',
  contact_phone  text not null default '',
  contact_hours  text not null default '',
  photos         jsonb not null default '[]'::jsonb,
  proof          jsonb,
  fee            jsonb not null default '{"amount":60000,"paid":false,"paidAt":"","noticeSentAt":"","invoiceId":""}'::jsonb,
  reject_note    text not null default '',
  views          integer not null default 0,
  reviewed_by    text not null default '',
  reviewed_at    text not null default '',
  published_at   text not null default '',
  expires_at     text not null default '',
  hidden_at      text not null default '',
  sample         boolean not null default false,
  created_at     text not null default '',
  updated_at     text not null default '',
  inserted_at    timestamptz not null default now()
);
create index listings_status_idx on public.listings (status);
create index listings_user_id_idx on public.listings (user_id);
comment on column public.listings.proof is '권리 증빙 파일 정보. 파일 자체는 listing-proofs 버킷에 있고 본인·직원만 열 수 있습니다.';

-- 구독
create table public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references public.customers(id) on delete cascade,
  service_id   text not null default '',
  plan         text not null default '',
  monthly_fee  bigint not null default 0,
  status       text not null default 'active' check (status in ('active','paused','ended')),
  start_date   text not null default '',
  billing_day  integer not null default 1,
  memo         text not null default '',
  created_at   text not null default '',
  inserted_at  timestamptz not null default now()
);

-- 청구 · 정산
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers(id) on delete set null,
  customer_name text not null default '',
  month         text not null default '',
  item          text not null default '',
  amount        bigint not null default 0,
  paid          boolean not null default false,
  paid_at       text not null default '',
  memo          text not null default '',
  created_at    text not null default '',
  inserted_at   timestamptz not null default now()
);
create index invoices_month_idx on public.invoices (month);

-- 지원 항목 공개 내용 (관리자 수정본) · 센터 설정
-- 두 표는 문서 통째로 덮어쓰는 성격이라 data jsonb 하나로 둡니다.
create table public.service_content (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now()
);

create table public.settings (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 20260817022927_wcsc_security_helpers.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 20260817022950_wcsc_column_guards.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 20260817023020_wcsc_rls_policies.sql
-- ---------------------------------------------------------

-- =========================================================
-- 접근 규칙 (RLS) — firestore.rules 와 같은 내용입니다.
--
-- 기본 원칙
--  · 홈페이지 내용(지원 항목, 센터 설정)은 로그인 없이 누구나 읽습니다.
--  · 신청서는 로그인한 사용자가 자기 것만 만들고 읽습니다.
--  · 고객 · 구독 · 청구 정보는 승인된 직원만 읽습니다.
--  · 교회 정보는 그 교회가 수정을 승인한 동안에만 직원이 고칠 수 있습니다.
--  · 매물 게시판은 게시(published)된 글만 공개됩니다.
-- =========================================================

alter table public.users           enable row level security;
alter table public.requests        enable row level security;
alter table public.customers       enable row level security;
alter table public.edit_consents   enable row level security;
alter table public.listings        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.invoices        enable row level security;
alter table public.service_content enable row level security;
alter table public.settings        enable row level security;

/* ---------- users : 계정 ---------- */
create policy users_read on public.users for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());

-- 가입 시 본인 문서를 만듭니다. 스스로 관리자가 될 수는 없습니다.
create policy users_insert_self on public.users for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('client', 'staff')
    and (case when role = 'client' then approved else not approved end)
    and perms = '{}'::jsonb
  );

-- 본인 수정 (직분 · 승인 · 권한은 트리거가 막습니다)
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy users_update_staff on public.users for update to authenticated
  using (public.can('members')) with check (public.can('members'));

create policy users_delete on public.users for delete to authenticated
  using (public.can('members'));

/* ---------- requests : 지원 신청 ---------- */
create policy requests_read on public.requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy requests_insert on public.requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'received'
    and assignee = ''
    and memo = ''
  );

create policy requests_update_staff on public.requests for update to authenticated
  using (public.can('requests')) with check (public.can('requests'));

-- 담당자로 배정된 직원은 자기 작업의 진행 정보만 (열 제한은 아래 트리거 없이
-- 정책만으로는 어려워, 담당자 본인 행에 한정하는 것으로 둡니다)
create policy requests_update_assignee on public.requests for update to authenticated
  using (public.is_staff() and assignee = (select auth.uid())::text)
  with check (public.is_staff() and assignee = (select auth.uid())::text);

create policy requests_delete on public.requests for delete to authenticated
  using (public.can('requests'));

/* ---------- customers : 고객 교회 ---------- */
create policy customers_read on public.customers for select to authenticated
  using (public.is_staff());

create policy customers_insert on public.customers for insert to authenticated
  with check (public.can('customers'));

-- 교회 정보 열은 customers_guard 트리거가 승인 여부를 확인합니다.
create policy customers_update on public.customers for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy customers_delete on public.customers for delete to authenticated
  using (public.can('customers'));

/* ---------- edit_consents : 교회 정보 수정 동의 ---------- */
create policy consents_read on public.edit_consents for select to authenticated
  using (public.is_staff() or user_id = (select auth.uid()));

create policy consents_insert on public.edit_consents for insert to authenticated
  with check (public.can('customers') and status = 'pending');

-- 직원이 스스로 approved 로 만들 수는 없습니다 — 그래야 승인이 의미가 있습니다.
create policy consents_update_staff on public.edit_consents for update to authenticated
  using (public.can('customers'))
  with check (public.can('customers') and status in ('pending', 'canceled', 'used', 'expired'));

create policy consents_update_client on public.edit_consents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('approved', 'rejected'));

create policy consents_delete on public.edit_consents for delete to authenticated
  using (public.can('customers'));

/* ---------- listings : 부동산 매물 게시판 ---------- */
-- 게시된 글은 로그인 없이 누구나 읽습니다.
create policy listings_read_public on public.listings for select to anon, authenticated
  using (status = 'published');

create policy listings_read_own on public.listings for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- 등록은 언제나 '승인 대기'로 시작하고, 요금은 미납 상태로 만들어집니다.
create policy listings_insert on public.listings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and (fee ->> 'paid')::boolean is not true
    and reviewed_by = ''
    and published_at = ''
  );

-- 등록자는 내용만. 고치면 다시 승인 대기로 돌아갑니다.
create policy listings_update_own on public.listings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy listings_update_staff on public.listings for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy listings_delete on public.listings for delete to authenticated
  using (user_id = (select auth.uid()) or public.can('customers'));

/* ---------- subscriptions · invoices ---------- */
create policy subs_read on public.subscriptions for select to authenticated
  using (public.can('customers') or public.can('settlement'));
create policy subs_write on public.subscriptions for all to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy invoices_all on public.invoices for all to authenticated
  using (public.can('settlement')) with check (public.can('settlement'));

/* ---------- serviceContent · settings : 홈페이지가 로그인 없이 읽습니다 ---------- */
create policy content_read on public.service_content for select to anon, authenticated
  using (true);
create policy content_write on public.service_content for all to authenticated
  using (public.can('services')) with check (public.can('services'));

create policy settings_read on public.settings for select to anon, authenticated
  using (true);
create policy settings_write on public.settings for all to authenticated
  using (public.can('settings')) with check (public.can('settings'));


-- ---------------------------------------------------------
-- 20260817023039_wcsc_storage_buckets.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 20260817023109_wcsc_auth_trigger_and_realtime.sql
-- ---------------------------------------------------------

-- =========================================================
-- 가입하면 계정 문서를 자동으로 만듭니다.
--
-- 구글 로그인처럼 화면이 개입할 틈이 없는 경우에도 빠짐없이 만들어지도록
-- auth.users 에 트리거를 답니다. 가입 화면이 넘긴 값(options.data)은
-- raw_user_meta_data 로 들어옵니다.
-- 직원 신청(staffRequest)은 승인 대기로 시작합니다.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m     jsonb   := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  staff boolean := coalesce((m ->> 'staffRequest')::boolean, false);
begin
  insert into public.users (
    id, email, name, phone, church, contact_role, birth_date,
    role, approved, perms, created_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(m ->> 'name', ''), m ->> 'full_name', ''),
    coalesce(m ->> 'phone', ''),
    coalesce(m ->> 'church', ''),
    coalesce(m ->> 'contactRole', ''),
    coalesce(m ->> 'birthDate', ''),
    case when staff then 'staff' else 'client' end,
    not staff,
    '{}'::jsonb,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 실시간 구독 — 관리자 화면이 값이 바뀌는 즉시 다시 그리도록
-- (Firestore 의 onSnapshot 에 해당합니다)
-- =========================================================
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.edit_consents;
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.subscriptions;
alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.service_content;
alter publication supabase_realtime add table public.settings;


-- ---------------------------------------------------------
-- 20260817023141_wcsc_lock_function_execute.sql
-- ---------------------------------------------------------

-- =========================================================
-- 함수 호출 권한 정리
--
-- security definer 함수가 REST(/rest/v1/rpc/...)로 그대로 열려 있으면
-- 의도치 않게 밖에서 부를 수 있습니다. 필요한 만큼만 남깁니다.
--
--  · 트리거 전용 함수 → 아무도 직접 못 부르게 (트리거는 영향받지 않습니다)
--  · 권한 확인 함수   → 로그인한 사용자만. RLS 정책이 호출자 권한으로
--                       평가되므로 authenticated 에는 남겨 두어야 합니다.
--                       (본인 권한 여부만 알려 주므로 알려져도 문제없습니다)
-- =========================================================

-- 트리거 전용
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.users_guard()          from public, anon, authenticated;
revoke execute on function public.customers_guard()      from public, anon, authenticated;
revoke execute on function public.listings_guard()       from public, anon, authenticated;
revoke execute on function public.edit_consents_guard()  from public, anon, authenticated;

-- 권한 확인 — 익명에게는 필요 없습니다 (익명이 쓰는 정책은 조건이 상수입니다)
revoke execute on function public.is_staff()             from public, anon;
revoke execute on function public.is_owner()             from public, anon;
revoke execute on function public.can(text)              from public, anon;
revoke execute on function public.edit_approved(uuid)    from public, anon;

grant execute on function public.is_staff()          to authenticated;
grant execute on function public.is_owner()          to authenticated;
grant execute on function public.can(text)           to authenticated;
grant execute on function public.edit_approved(uuid) to authenticated;


-- ---------------------------------------------------------
-- 20260817024044_wcsc_guards_allow_service_role.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 20260817025200_wcsc_tighten_function_grants.sql
-- ---------------------------------------------------------

-- =========================================================
-- 함수 권한 마무리 (Supabase 보안 점검 결과 반영)
--
-- 1) no_end_user() 에 search_path 를 고정합니다.
--    검색 경로가 열려 있으면, 같은 이름의 함수를 다른 스키마에 만들어
--    바꿔치기하는 수법을 막을 수 없습니다.
--
-- 2) 정책이 실제로 쓰지 않는 함수는 REST 에서 닫습니다.
--    · is_staff() · can()      → 정책이 "호출자 권한으로" 평가하므로
--                                authenticated 에 EXECUTE 가 있어야 합니다. (유지)
--    · is_owner() · edit_approved() → 어떤 정책도 쓰지 않고, 화면에서도
--                                부르지 않습니다. 열어 둘 이유가 없어 닫습니다.
--                                (edit_approved 는 customers_guard 안에서만
--                                 쓰이는데, 그 트리거는 security definer 라
--                                 호출자 권한과 무관하게 동작합니다.)
-- =========================================================

create or replace function public.no_end_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null;
$$;

revoke execute on function public.no_end_user() from public, anon, authenticated;

revoke execute on function public.is_owner()           from public, anon, authenticated;
revoke execute on function public.edit_approved(uuid)  from public, anon, authenticated;


-- ---------------------------------------------------------
-- 20260817064500_wcsc_listing_until_sold.sql
-- ---------------------------------------------------------

-- =========================================================
-- 매물 게시 기간 — 90일에서 "팔릴 때까지"로
--
-- 기간을 두지 않으니, 대신 끝나는 자리가 필요합니다.
-- 거래가 끝나면 내리는 상태(done, '거래 완료')를 추가합니다.
--
-- 누가 내리는가 —
--   팔린 것을 가장 먼저 아는 사람은 등록자입니다. 센터가 알 방법이 없으니
--   등록자가 직접 내릴 수 있어야 합니다. 그래서 등록자에게 done 으로
--   바꿀 권한을 줍니다. 대신 done 에서 다시 published 로 올릴 수는 없습니다
--   (다시 올리려면 pending 으로 돌아가 재검토를 받습니다).
--
-- 옛 expired 는 지우지 않고 남깁니다 — 기간 제한이 있던 때의 글이
-- 남아 있을 수 있고, 상태 값을 없애면 그 글을 읽을 수 없게 됩니다.
-- =========================================================

alter table public.listings drop constraint if exists listings_status_check;

alter table public.listings add constraint listings_status_check
  check (status in (
    'pending',           -- 승인 대기
    'awaiting_payment',  -- 입금 대기
    'published',         -- 게시중 (기한 없음 — 팔릴 때까지)
    'rejected',          -- 반려
    'hidden',            -- 센터가 내림
    'done',              -- 거래 완료 (등록자 또는 센터가 내림)
    'expired'            -- (옛 기간 제한 시절의 글)
  ));

comment on column public.listings.expires_at is
  '더 쓰지 않습니다. 게시는 거래가 끝날 때까지 유지됩니다 (옛 글 호환용).';

/* 등록자가 자기 글을 '거래 완료'로 내릴 수 있게 합니다.
   내용을 고치면 지금처럼 pending 으로 돌아가 재검토를 받습니다. */
drop policy if exists listings_update_own on public.listings;

create policy listings_update_own on public.listings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and status in ('pending', 'done')
  );


-- ---------------------------------------------------------
-- 20260817072000_wcsc_listing_edit_review.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 20260818014534_wcsc_listing_edit_review.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 20260822120000_wcsc_membership_invite.sql
-- ---------------------------------------------------------

-- =========================================================
-- 요금제 가입 · 초대 할인
--
-- 결제는 계좌 입금입니다. 카드 자동결제가 없으므로
-- "청구서를 만들고 → 입금을 확인하면 → 기간을 늘린다" 세 걸음으로 굴러갑니다.
-- 청구는 이미 있는 invoices 표를 그대로 씁니다.
--
-- 기존 subscriptions 표는 항목별(홈페이지·인투오피스) 구독이라 그대로 두고,
-- 교회 단위 요금제는 memberships 로 따로 둡니다. 한 교회가 요금제에 가입한 채
-- 항목 구독을 따로 가질 수 있어야 하기 때문입니다.
-- =========================================================

/* ---------- 요금제 가입 ---------- */
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete set null,
  church_name   text not null default '',
  contact_name  text not null default '',
  contact_phone text not null default '',

  -- community · starter · basic · ministry · full
  plan          text not null default 'community',
  cycle         text not null default 'month' check (cycle in ('month', 'year')),

  -- trial   : 30일 무료 체험 중 (결제수단 없음)
  -- pending : 첫 청구서를 드렸고 입금을 기다리는 중
  -- active  : 입금 확인, 이용 중
  -- overdue : 기간이 지났는데 입금이 없음
  -- ended   : 해지 (커뮤니티 무료로 내려감)
  status        text not null default 'trial'
                check (status in ('trial', 'pending', 'active', 'overdue', 'ended')),

  trial_started text not null default '',
  trial_ends    text not null default '',
  paid_until    text not null default '',   -- 이 날짜까지 이용 (입금 확인 때 늘어납니다)

  -- 할인 (퍼센트). 초대 할인은 invites 를 세어 다시 계산합니다.
  invite_pct    integer not null default 0 check (invite_pct between 0 and 30),
  small_church  boolean not null default false,   -- 성도 50명 이하 절반 감면
  discount_memo text not null default '',

  invite_code   text not null default '',         -- 이 교회가 남에게 주는 코드
  invited_by    text not null default '',         -- 이 교회가 쓴 남의 코드

  memo          text not null default '',
  created_at    text not null default '',
  inserted_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index memberships_user_id_key on public.memberships (user_id);
create unique index memberships_invite_code_key on public.memberships (invite_code)
  where invite_code <> '';
create index memberships_status_idx on public.memberships (status);
create index memberships_plan_idx on public.memberships (plan);

comment on table public.memberships is '교회 단위 요금제 가입. 결제는 계좌 입금이라 paid_until 을 입금 확인 때 늘립니다.';

/* ---------- 초대 ---------- */
create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,                     -- 초대한 교회의 invite_code
  inviter_id   uuid not null references auth.users(id) on delete cascade,
  invitee_id   uuid references auth.users(id) on delete set null,
  invitee_name text not null default '',

  -- joined : 가입함 (아직 3개월 미만)  · held : 3개월을 채워 할인이 굳음
  -- cancelled : 3개월 안에 해지 — 할인에서 빠집니다
  status       text not null default 'joined'
               check (status in ('joined', 'held', 'cancelled')),
  joined_at    text not null default '',
  holds_at     text not null default '',          -- 이 날짜가 지나면 held
  created_at   text not null default '',
  inserted_at  timestamptz not null default now()
);
create unique index invites_invitee_key on public.invites (invitee_id)
  where invitee_id is not null;
create index invites_inviter_idx on public.invites (inviter_id);
create index invites_code_idx on public.invites (code);

comment on table public.invites is '초대 관계. 초대받은 교회가 3개월을 채워야(held) 할인이 이어집니다.';

/* ---------- 요금제 열 잠그기 ----------
   교회가 스스로 요금제를 올리거나 할인을 넣을 수 있으면 안 됩니다.
   Postgres 의 with check 는 옛 행(OLD)을 못 보므로 트리거로 막습니다. */
create or replace function public.memberships_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 서비스 역할(관리 작업)과 직원은 그대로 통과합니다.
  if auth.role() = 'service_role' or public.is_staff() then
    return new;
  end if;

  if new.plan is distinct from old.plan
     or new.cycle is distinct from old.cycle
     or new.status is distinct from old.status
     or new.paid_until is distinct from old.paid_until
     or new.trial_ends is distinct from old.trial_ends
     or new.invite_pct is distinct from old.invite_pct
     or new.small_church is distinct from old.small_church
     or new.invite_code is distinct from old.invite_code
     or new.user_id is distinct from old.user_id
  then
    raise exception '요금제 · 기간 · 할인은 센터에서만 바꿀 수 있습니다';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger memberships_guard_trg
  before update on public.memberships
  for each row execute function public.memberships_guard();

/* ---------- 권한 ---------- */
alter table public.memberships    enable row level security;
alter table public.invites        enable row level security;

/* 요금제 — 교회는 자기 것만, 직원은 전부 */
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.can('subscriptions'));

-- 교회가 직접 가입 신청(체험 시작)할 수 있습니다. 잠긴 열은 트리거가 지킵니다.
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    (user_id = auth.uid() and status = 'trial' and invite_pct = 0 and not small_church)
    or public.can('subscriptions')
  );

create policy memberships_update on public.memberships for update to authenticated
  using (user_id = auth.uid() or public.can('subscriptions'))
  with check (user_id = auth.uid() or public.can('subscriptions'));

create policy memberships_delete on public.memberships for delete to authenticated
  using (public.can('subscriptions'));

/* 초대 — 초대한 쪽과 초대받은 쪽이 자기 관계를 봅니다 */
create policy invites_read on public.invites for select to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid() or public.can('subscriptions'));

create policy invites_insert on public.invites for insert to authenticated
  with check (invitee_id = auth.uid() or public.can('subscriptions'));

create policy invites_update on public.invites for update to authenticated
  using (public.can('subscriptions')) with check (public.can('subscriptions'));

create policy invites_delete on public.invites for delete to authenticated
  using (public.can('subscriptions'));

/* ---------- 초대 코드로 초대한 교회 찾기 ----------
   가입할 때 남의 코드를 넣습니다. 그 코드의 주인을 알아야 하는데
   남의 memberships 행 전체를 보여 줄 수는 없으므로 함수로만 엽니다. */
create or replace function public.invite_owner(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id
  from public.memberships m
  where m.invite_code = upper(trim(p_code))
    and m.invite_code <> ''
    and m.status in ('trial', 'pending', 'active', 'overdue')
  limit 1;
$$;
revoke all on function public.invite_owner(text) from public;
grant execute on function public.invite_owner(text) to authenticated;
comment on function public.invite_owner(text) is '초대 코드의 주인. 코드가 맞는지 확인하는 용도로만 씁니다.';

revoke all on function public.memberships_guard() from public;


-- ---------------------------------------------------------
-- 20260828010000_wcsc_market_guesthouse_tickets.sql
-- ---------------------------------------------------------

-- =========================================================
-- 교역자만이 아니라 성도까지 — 게시판 세 갈래를 더합니다
--
--   market_items  중고 장터   교회 장비 · 물품을 팔고 삽니다.
--                             등록비는 받지 않고, 사시는 교회가 원하면
--                             센터 음향팀이 철거 · 운반 · 설치 · 튜닝을 맡습니다.
--                             그 설치 대행료가 센터의 몫입니다.
--   guest_houses  게스트하우스 교회가 비어 있는 사택 · 선교관을 내어 놓고,
--                             해외에서 들어온 사역자 · 선교사가 머뭅니다.
--   events        집회 티켓팅 찬양집회 · 수련회 신청을 받습니다.
--   ticket_orders 신청 내역   정원이 차면 자동으로 마감됩니다.
--
-- 부동산 매물(listings)과 같은 흐름을 씁니다.
--   pending → (관리자 확인) → published / rejected / hidden / done
-- 사진은 listing-photos 버킷을 그대로 씁니다 (공개 버킷).
-- =========================================================

-- ---------------------------------------------------------
-- 중고 장터
-- ---------------------------------------------------------
create table public.market_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_email     text not null default '',
  status         text not null default 'pending'
                 check (status in ('pending','published','rejected','hidden','done')),
  category       text not null default 'sound',
  category_other text not null default '',
  title          text not null default '',
  brand          text not null default '',
  model          text not null default '',
  condition      text not null default 'good'
                 check (condition in ('new','like_new','good','used','broken')),
  bought_year    text not null default '',
  quantity       integer not null default 1,
  price          bigint not null default 0,
  negotiable     boolean not null default false,
  free_giveaway  boolean not null default false,
  region         text not null default '',
  address_rough  text not null default '',
  -- 설치 대행 — 파는 쪽이 "설치까지 맡길 수 있는 물건"인지 표시합니다.
  install_ok     boolean not null default true,
  install_note   text not null default '',
  delivery       text not null default 'pickup'
                 check (delivery in ('pickup','deliver','both')),
  "desc"         text not null default '',
  contact_name   text not null default '',
  contact_phone  text not null default '',
  contact_hours  text not null default '',
  photos         jsonb not null default '[]'::jsonb,
  reject_note    text not null default '',
  views          integer not null default 0,
  reviewed_by    text not null default '',
  reviewed_at    text not null default '',
  published_at   text not null default '',
  hidden_at      text not null default '',
  sample         boolean not null default false,
  created_at     text not null default '',
  updated_at     text not null default '',
  inserted_at    timestamptz not null default now()
);
create index market_items_status_idx on public.market_items (status);
create index market_items_user_id_idx on public.market_items (user_id);
comment on table public.market_items is '중고 장터. 센터는 물건을 팔지 않고 설치 대행만 합니다.';

-- 설치 대행 문의 — 물건을 산 교회가 "달아 주세요" 하고 부르는 창구입니다.
create table public.install_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  user_email    text not null default '',
  item_id       uuid references public.market_items(id) on delete set null,
  item_title    text not null default '',
  tier          text not null default 'install'
                check (tier in ('pickup','install','tuning')),
  church_name   text not null default '',
  region        text not null default '',
  address       text not null default '',
  floor         text not null default '',
  elevator      text not null default '',
  wish_date     text not null default '',
  contact_name  text not null default '',
  contact_phone text not null default '',
  contact_hours text not null default '',
  note          text not null default '',
  status        text not null default 'received'
                check (status in ('received','quoted','scheduled','done','canceled')),
  quote_amount  bigint not null default 0,
  quote_note    text not null default '',
  assignee_id   uuid references auth.users(id) on delete set null,
  created_at    text not null default '',
  updated_at    text not null default '',
  inserted_at   timestamptz not null default now()
);
create index install_requests_status_idx on public.install_requests (status);
create index install_requests_user_id_idx on public.install_requests (user_id);

-- ---------------------------------------------------------
-- 교회 게스트하우스
-- ---------------------------------------------------------
create table public.guest_houses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_email      text not null default '',
  status          text not null default 'pending'
                  check (status in ('pending','published','rejected','hidden','done')),
  church_name     text not null default '',
  denomination    text not null default '',
  title           text not null default '',
  room_type       text not null default 'private'
                  check (room_type in ('private','share','whole','dorm')),
  guests_max      integer not null default 2,
  rooms           integer not null default 1,
  beds            text not null default '',
  bath            text not null default 'private',
  region          text not null default '',
  address_rough   text not null default '',
  nearest         text not null default '',
  -- 요금 — 하루 / 주 / 달 중 쓰는 것만 채웁니다. 0 이면 안 보여 줍니다.
  price_night     bigint not null default 0,
  price_week      bigint not null default 0,
  price_month     bigint not null default 0,
  deposit         bigint not null default 0,
  free_stay       boolean not null default false,
  min_nights      integer not null default 1,
  max_nights      integer not null default 0,
  -- 누가 머무를 수 있는지 (해외 사역자 · 선교사 · 유학생 …)
  guest_types     jsonb not null default '[]'::jsonb,
  amenities       jsonb not null default '[]'::jsonb,
  house_rules     text not null default '',
  languages       jsonb not null default '[]'::jsonb,
  available_from  text not null default '',
  available_to    text not null default '',
  "desc"          text not null default '',
  contact_name    text not null default '',
  contact_phone   text not null default '',
  contact_hours   text not null default '',
  photos          jsonb not null default '[]'::jsonb,
  reject_note     text not null default '',
  views           integer not null default 0,
  reviewed_by     text not null default '',
  reviewed_at     text not null default '',
  published_at    text not null default '',
  hidden_at       text not null default '',
  sample          boolean not null default false,
  created_at      text not null default '',
  updated_at      text not null default '',
  inserted_at     timestamptz not null default now()
);
create index guest_houses_status_idx on public.guest_houses (status);
create index guest_houses_user_id_idx on public.guest_houses (user_id);

-- ---------------------------------------------------------
-- 집회 · 찬양집회 티켓팅
--
--   open_at  이 시각 전에는 신청 버튼이 열리지 않습니다 (얼리버드 · 오픈런).
--   capacity 정원. 신청 합계가 여기에 닿으면 자동으로 마감됩니다.
--   seatmap  좌석도. 선택입니다 — 비워 두면 인원수로만 받습니다.
-- ---------------------------------------------------------
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_email     text not null default '',
  status         text not null default 'pending'
                 check (status in ('pending','published','rejected','hidden','closed','done')),
  category       text not null default 'praise',
  title          text not null default '',
  subtitle       text not null default '',
  host           text not null default '',
  speakers       text not null default '',
  region         text not null default '',
  venue          text not null default '',
  address        text not null default '',
  starts_at      text not null default '',
  ends_at        text not null default '',
  schedule_note  text not null default '',
  -- 예매
  open_at        text not null default '',   -- 비면 게시 즉시 열립니다
  close_at       text not null default '',
  capacity       integer not null default 0, -- 0 이면 정원 제한 없음
  per_person_max integer not null default 4,
  price          bigint not null default 0,
  early_price    bigint not null default 0,
  early_until    text not null default '',
  free_event     boolean not null default false,
  age_note       text not null default '',
  -- 좌석 — 쓰지 않으면 seating_on 이 false 이고 seatmap 은 비어 있습니다.
  seating_on     boolean not null default false,
  seatmap        jsonb not null default '{}'::jsonb,
  poster         jsonb,                       -- 대표 포스터 (photos[0] 과 같아도 됩니다)
  photos         jsonb not null default '[]'::jsonb,
  "desc"         text not null default '',
  notice         text not null default '',
  contact_name   text not null default '',
  contact_phone  text not null default '',
  contact_hours  text not null default '',
  -- 신청 합계 — reserve_tickets() 만 올립니다 (동시 신청에도 정원을 넘지 않게).
  taken          integer not null default 0,
  reject_note    text not null default '',
  views          integer not null default 0,
  reviewed_by    text not null default '',
  reviewed_at    text not null default '',
  published_at   text not null default '',
  hidden_at      text not null default '',
  sample         boolean not null default false,
  created_at     text not null default '',
  updated_at     text not null default '',
  inserted_at    timestamptz not null default now(),
  constraint events_capacity_ok check (capacity >= 0),
  constraint events_taken_ok check (taken >= 0)
);
create index events_status_idx on public.events (status);
create index events_user_id_idx on public.events (user_id);
create index events_starts_at_idx on public.events (starts_at);

create table public.ticket_orders (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  user_email    text not null default '',
  event_title   text not null default '',
  qty           integer not null default 1 check (qty > 0),
  seats         jsonb not null default '[]'::jsonb,
  name          text not null default '',
  phone         text not null default '',
  church_name   text not null default '',
  note          text not null default '',
  status        text not null default 'confirmed'
                check (status in ('confirmed','canceled','checked_in')),
  code          text not null default '',
  canceled_at   text not null default '',
  created_at    text not null default '',
  updated_at    text not null default '',
  inserted_at   timestamptz not null default now()
);
create index ticket_orders_event_idx on public.ticket_orders (event_id);
create index ticket_orders_user_idx on public.ticket_orders (user_id);
-- 한 사람이 같은 집회에 두 번 신청하지 못하게 합니다 (취소한 건은 제외).
create unique index ticket_orders_one_per_person
  on public.ticket_orders (event_id, user_id)
  where status <> 'canceled';

-- ---------------------------------------------------------
-- 정원을 넘지 않게 신청을 받는 함수
--
-- 신청은 반드시 이 함수를 거칩니다. 행을 잠그고 정원을 확인한 뒤에야
-- taken 을 올리므로, 오픈 직후 수백 명이 동시에 눌러도 정원을 넘지 않습니다.
-- 좌석 지정 집회라면 이미 팔린 좌석과 겹치는지도 여기서 봅니다.
-- ---------------------------------------------------------
create or replace function public.reserve_tickets(
  p_event  uuid,
  p_qty    integer,
  p_seats  jsonb default '[]'::jsonb,
  p_name   text default '',
  p_phone  text default '',
  p_church text default '',
  p_note   text default ''
)
returns public.ticket_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ev     public.events%rowtype;
  me     uuid := auth.uid();
  seats  jsonb := coalesce(p_seats, '[]'::jsonb);
  n      integer := coalesce(p_qty, 0);
  taken_seats jsonb;
  row_out public.ticket_orders%rowtype;
begin
  if me is null then
    raise exception '신청하려면 로그인해 주세요.' using errcode = '28000';
  end if;

  -- 행을 잠급니다 — 여기서부터는 이 신청 하나만 정원을 봅니다.
  select * into ev from public.events where id = p_event for update;
  if not found then
    raise exception '집회를 찾을 수 없습니다.';
  end if;
  if ev.status <> 'published' then
    raise exception '지금은 신청을 받지 않는 집회입니다.';
  end if;

  if ev.open_at <> '' and now() < ev.open_at::timestamptz then
    raise exception '아직 예매가 열리지 않았습니다.';
  end if;
  if ev.close_at <> '' and now() > ev.close_at::timestamptz then
    raise exception '신청이 마감되었습니다.';
  end if;

  if n < 1 then
    raise exception '신청 인원을 확인해 주세요.';
  end if;
  if ev.per_person_max > 0 and n > ev.per_person_max then
    raise exception '한 번에 최대 %명까지 신청하실 수 있습니다.', ev.per_person_max;
  end if;

  if ev.capacity > 0 and ev.taken + n > ev.capacity then
    raise exception '정원이 모두 찼습니다. (남은 자리 %석)', greatest(ev.capacity - ev.taken, 0);
  end if;

  if ev.seating_on then
    if jsonb_array_length(seats) <> n then
      raise exception '좌석을 %개 골라 주세요.', n;
    end if;
    -- 이미 팔린 좌석과 겹치는지
    select coalesce(jsonb_agg(s), '[]'::jsonb) into taken_seats
      from public.ticket_orders o, jsonb_array_elements_text(o.seats) s
     where o.event_id = p_event and o.status <> 'canceled';
    if exists (
      select 1 from jsonb_array_elements_text(seats) w
       where taken_seats ? w.value
    ) then
      raise exception '방금 다른 분이 먼저 잡은 좌석이 있습니다. 좌석도를 새로 고쳐 주세요.';
    end if;
  else
    seats := '[]'::jsonb;
  end if;

  insert into public.ticket_orders
    (event_id, user_id, user_email, event_title, qty, seats,
     name, phone, church_name, note, status, code, created_at, updated_at)
  values
    (p_event, me, coalesce((select email from auth.users where id = me), ''),
     ev.title, n, seats,
     coalesce(p_name, ''), coalesce(p_phone, ''), coalesce(p_church, ''), coalesce(p_note, ''),
     'confirmed',
     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  returning * into row_out;

  update public.events
     set taken = taken + n,
         -- 정원이 다 찼으면 여기서 바로 마감으로 바꿉니다.
         status = case when capacity > 0 and taken + n >= capacity then 'closed' else status end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_event;

  return row_out;
end;
$$;

-- 신청 취소 — 자리를 정원으로 되돌리고, 마감이었으면 다시 엽니다.
create or replace function public.cancel_ticket(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o  public.ticket_orders%rowtype;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into o from public.ticket_orders where id = p_order for update;
  if not found then
    raise exception '신청 내역을 찾을 수 없습니다.';
  end if;
  if o.user_id <> me and not public.is_staff() then
    raise exception '본인이 신청한 건만 취소하실 수 있습니다.';
  end if;
  if o.status = 'canceled' then
    return;
  end if;

  update public.ticket_orders
     set status = 'canceled',
         canceled_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_order;

  update public.events
     set taken = greatest(taken - o.qty, 0),
         status = case when status = 'closed' then 'published' else status end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = o.event_id;
end;
$$;

-- =========================================================
-- 접근 규칙 (RLS)
-- =========================================================
alter table public.market_items     enable row level security;
alter table public.install_requests enable row level security;
alter table public.guest_houses     enable row level security;
alter table public.events           enable row level security;
alter table public.ticket_orders    enable row level security;

/* ---------- market_items ---------- */
create policy market_read_public on public.market_items for select to anon, authenticated
  using (status = 'published');
create policy market_read_own on public.market_items for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy market_insert on public.market_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by = ''
    and published_at = ''
  );
create policy market_update_own on public.market_items for update to authenticated
  using (user_id = (select auth.uid()))
  -- 고치면 다시 확인을 받습니다. 다만 '거래 완료'로 내리는 것은 언제든 됩니다.
  with check (user_id = (select auth.uid()) and status in ('pending', 'done'));
create policy market_update_staff on public.market_items for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));
create policy market_delete on public.market_items for delete to authenticated
  using (user_id = (select auth.uid()) or public.can('customers'));

/* ---------- install_requests : 본인과 직원만 ---------- */
create policy install_read on public.install_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy install_insert on public.install_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'received' and quote_amount = 0);
create policy install_update_own on public.install_requests for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('received', 'canceled'));
create policy install_update_staff on public.install_requests for update to authenticated
  using (public.can('requests')) with check (public.can('requests'));
create policy install_delete on public.install_requests for delete to authenticated
  using (public.can('requests'));

/* ---------- guest_houses ---------- */
create policy guest_read_public on public.guest_houses for select to anon, authenticated
  using (status = 'published');
create policy guest_read_own on public.guest_houses for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy guest_insert on public.guest_houses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by = ''
    and published_at = ''
  );
create policy guest_update_own on public.guest_houses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('pending', 'done'));
create policy guest_update_staff on public.guest_houses for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));
create policy guest_delete on public.guest_houses for delete to authenticated
  using (user_id = (select auth.uid()) or public.can('customers'));

/* ---------- events ---------- */
-- 마감(closed)된 집회도 보여야 합니다 — "마감되었습니다"를 읽으려면요.
create policy events_read_public on public.events for select to anon, authenticated
  using (status in ('published', 'closed', 'done'));
create policy events_read_own on public.events for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy events_insert on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and taken = 0
    and reviewed_by = ''
    and published_at = ''
  );
-- 주최자는 내용만 고칩니다. taken 은 예약 함수만 건드립니다(아래 트리거가 지킵니다).
create policy events_update_own on public.events for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('pending', 'done'));
create policy events_update_staff on public.events for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));
create policy events_delete on public.events for delete to authenticated
  using ((user_id = (select auth.uid()) and taken = 0) or public.can('customers'));

/* ---------- ticket_orders ---------- */
-- 신청자 본인, 집회를 연 주최자, 직원만 봅니다.
create policy orders_read on public.ticket_orders for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_staff()
    or exists (select 1 from public.events e
                where e.id = event_id and e.user_id = (select auth.uid()))
  );
-- 직접 insert 는 막습니다 — 반드시 reserve_tickets() 를 거쳐야 정원이 지켜집니다.
create policy orders_update_staff on public.ticket_orders for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));
create policy orders_delete on public.ticket_orders for delete to authenticated
  using (public.can('customers'));

-- =========================================================
-- taken 은 예약 함수만 — 주최자가 직접 늘리지 못하게 막습니다.
-- =========================================================
create or replace function public.guard_event_taken()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.taken is distinct from old.taken
     and current_setting('role', true) is distinct from 'service_role'
     and not public.is_staff() then
    new.taken := old.taken;
  end if;
  return new;
end;
$$;

create trigger events_guard_taken
  before update on public.events
  for each row execute function public.guard_event_taken();

-- =========================================================
-- 실행 권한 — 로그인한 사람만 예약 · 취소를 부를 수 있습니다.
-- =========================================================
revoke all on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) from public, anon;
grant execute on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) to authenticated;
revoke all on function public.cancel_ticket(uuid) from public, anon;
grant execute on function public.cancel_ticket(uuid) to authenticated;
revoke all on function public.guard_event_taken() from public, anon, authenticated;

-- =========================================================
-- 실시간 구독
-- =========================================================
alter publication supabase_realtime add table public.market_items;
alter publication supabase_realtime add table public.install_requests;
alter publication supabase_realtime add table public.guest_houses;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.ticket_orders;


-- ---------------------------------------------------------
-- 20260828020000_wcsc_reserve_closed_message.sql
-- ---------------------------------------------------------

-- =========================================================
-- 마감된 집회에 신청했을 때 나오는 말을 고칩니다.
--
-- 정원이 차면 집회가 'closed' 로 바뀝니다. 그런데 그 뒤에 신청한 사람에게는
-- "지금은 신청을 받지 않는 집회입니다" 라고만 나왔습니다.
-- 왜 못 받는지가 빠져 있어, 마감된 것인지 내려간 것인지 알 수 없었습니다.
--
-- 함수 안의 문구 하나만 갈라 줍니다 — 나머지는 그대로입니다.
-- =========================================================

create or replace function public.reserve_tickets(
  p_event  uuid,
  p_qty    integer,
  p_seats  jsonb default '[]'::jsonb,
  p_name   text default '',
  p_phone  text default '',
  p_church text default '',
  p_note   text default ''
)
returns public.ticket_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ev     public.events%rowtype;
  me     uuid := auth.uid();
  seats  jsonb := coalesce(p_seats, '[]'::jsonb);
  n      integer := coalesce(p_qty, 0);
  taken_seats jsonb;
  row_out public.ticket_orders%rowtype;
begin
  if me is null then
    raise exception '신청하려면 로그인해 주세요.' using errcode = '28000';
  end if;

  -- 행을 잠급니다 — 여기서부터는 이 신청 하나만 정원을 봅니다.
  select * into ev from public.events where id = p_event for update;
  if not found then
    raise exception '집회를 찾을 수 없습니다.';
  end if;

  -- 마감인지, 아예 안 받는 것인지를 갈라서 말해 줍니다.
  if ev.status = 'closed' then
    raise exception '정원이 모두 찼습니다 — 신청이 마감되었습니다.';
  end if;
  if ev.status <> 'published' then
    raise exception '지금은 신청을 받지 않는 집회입니다.';
  end if;

  if ev.open_at <> '' and now() < ev.open_at::timestamptz then
    raise exception '아직 예매가 열리지 않았습니다.';
  end if;
  if ev.close_at <> '' and now() > ev.close_at::timestamptz then
    raise exception '신청이 마감되었습니다.';
  end if;

  if n < 1 then
    raise exception '신청 인원을 확인해 주세요.';
  end if;
  if ev.per_person_max > 0 and n > ev.per_person_max then
    raise exception '한 번에 최대 %명까지 신청하실 수 있습니다.', ev.per_person_max;
  end if;

  if ev.capacity > 0 and ev.taken + n > ev.capacity then
    raise exception '정원이 %석밖에 남지 않았습니다. 인원을 줄여 다시 신청해 주세요.',
      greatest(ev.capacity - ev.taken, 0);
  end if;

  if ev.seating_on then
    if jsonb_array_length(seats) <> n then
      raise exception '좌석을 %개 골라 주세요.', n;
    end if;
    select coalesce(jsonb_agg(s), '[]'::jsonb) into taken_seats
      from public.ticket_orders o, jsonb_array_elements_text(o.seats) s
     where o.event_id = p_event and o.status <> 'canceled';
    if exists (
      select 1 from jsonb_array_elements_text(seats) w
       where taken_seats ? w.value
    ) then
      raise exception '방금 다른 분이 먼저 잡은 좌석이 있습니다. 좌석도를 새로 고쳐 주세요.';
    end if;
  else
    seats := '[]'::jsonb;
  end if;

  insert into public.ticket_orders
    (event_id, user_id, user_email, event_title, qty, seats,
     name, phone, church_name, note, status, code, created_at, updated_at)
  values
    (p_event, me, coalesce((select email from auth.users where id = me), ''),
     ev.title, n, seats,
     coalesce(p_name, ''), coalesce(p_phone, ''), coalesce(p_church, ''), coalesce(p_note, ''),
     'confirmed',
     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  returning * into row_out;

  update public.events
     set taken = taken + n,
         -- 정원이 다 찼으면 여기서 바로 마감으로 바꿉니다.
         status = case when capacity > 0 and taken + n >= capacity then 'closed' else status end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_event;

  return row_out;
end;
$$;

revoke all on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) from public, anon;
grant execute on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) to authenticated;


-- ---------------------------------------------------------
-- 20260828030000_wcsc_ticket_taken_guard_fix.sql
-- ---------------------------------------------------------

-- =========================================================
-- 신청해도 정원이 차지 않던 문제
--
-- events.taken 은 주최자가 손으로 올리지 못하도록 트리거가 지키고 있었습니다.
-- 그런데 그 트리거가 "지금 누가 부르고 있나"를 current_setting('role') 로
-- 판단했습니다. 신청하는 분은 당연히 authenticated 이고 직원이 아니므로,
-- reserve_tickets() 가 올린 taken 까지 되돌려 버렸습니다.
--   → 신청은 들어가는데 정원은 그대로 0. 집회가 영영 마감되지 않습니다.
--     (직원 계정으로 시험할 때는 is_staff() 가 참이라 멀쩡해 보였습니다.)
--
-- 고치는 방법
--   예약 · 취소 함수가 "지금은 내가 정원을 만지는 중"이라는 표시를
--   트랜잭션 안에서만 사는 값으로 켜 두고, 트리거는 그 표시가 있을 때만
--   taken 변경을 통과시킵니다. 표시는 트랜잭션이 끝나면 사라지고,
--   바깥(PostgREST)에서는 켤 방법이 없습니다.
-- =========================================================

create or replace function public.guard_event_taken()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.taken is distinct from old.taken
     -- 예약 · 취소 함수가 켜 둔 표시 (트랜잭션 안에서만 삽니다)
     and coalesce(current_setting('wcsc.ticket_op', true), '') <> '1'
     and current_setting('role', true) is distinct from 'service_role'
     and not public.is_staff() then
    new.taken := old.taken;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_event_taken() from public, anon, authenticated;

-- 예약 함수 — 정원을 올리기 직전에 표시를 켭니다.
create or replace function public.reserve_tickets(
  p_event  uuid,
  p_qty    integer,
  p_seats  jsonb default '[]'::jsonb,
  p_name   text default '',
  p_phone  text default '',
  p_church text default '',
  p_note   text default ''
)
returns public.ticket_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ev     public.events%rowtype;
  me     uuid := auth.uid();
  seats  jsonb := coalesce(p_seats, '[]'::jsonb);
  n      integer := coalesce(p_qty, 0);
  taken_seats jsonb;
  row_out public.ticket_orders%rowtype;
begin
  if me is null then
    raise exception '신청하려면 로그인해 주세요.' using errcode = '28000';
  end if;

  -- 행을 잠급니다 — 여기서부터는 이 신청 하나만 정원을 봅니다.
  select * into ev from public.events where id = p_event for update;
  if not found then
    raise exception '집회를 찾을 수 없습니다.';
  end if;

  if ev.status = 'closed' then
    raise exception '정원이 모두 찼습니다 — 신청이 마감되었습니다.';
  end if;
  if ev.status <> 'published' then
    raise exception '지금은 신청을 받지 않는 집회입니다.';
  end if;

  if ev.open_at <> '' and now() < ev.open_at::timestamptz then
    raise exception '아직 예매가 열리지 않았습니다.';
  end if;
  if ev.close_at <> '' and now() > ev.close_at::timestamptz then
    raise exception '신청이 마감되었습니다.';
  end if;

  if n < 1 then
    raise exception '신청 인원을 확인해 주세요.';
  end if;
  if ev.per_person_max > 0 and n > ev.per_person_max then
    raise exception '한 번에 최대 %명까지 신청하실 수 있습니다.', ev.per_person_max;
  end if;

  if ev.capacity > 0 and ev.taken + n > ev.capacity then
    raise exception '정원이 %석밖에 남지 않았습니다. 인원을 줄여 다시 신청해 주세요.',
      greatest(ev.capacity - ev.taken, 0);
  end if;

  if ev.seating_on then
    if jsonb_array_length(seats) <> n then
      raise exception '좌석을 %개 골라 주세요.', n;
    end if;
    select coalesce(jsonb_agg(s), '[]'::jsonb) into taken_seats
      from public.ticket_orders o, jsonb_array_elements_text(o.seats) s
     where o.event_id = p_event and o.status <> 'canceled';
    if exists (
      select 1 from jsonb_array_elements_text(seats) w
       where taken_seats ? w.value
    ) then
      raise exception '방금 다른 분이 먼저 잡은 좌석이 있습니다. 좌석도를 새로 고쳐 주세요.';
    end if;
  else
    seats := '[]'::jsonb;
  end if;

  insert into public.ticket_orders
    (event_id, user_id, user_email, event_title, qty, seats,
     name, phone, church_name, note, status, code, created_at, updated_at)
  values
    (p_event, me, coalesce((select email from auth.users where id = me), ''),
     ev.title, n, seats,
     coalesce(p_name, ''), coalesce(p_phone, ''), coalesce(p_church, ''), coalesce(p_note, ''),
     'confirmed',
     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  returning * into row_out;

  perform set_config('wcsc.ticket_op', '1', true);
  update public.events
     set taken = taken + n,
         -- 정원이 다 찼으면 여기서 바로 마감으로 바꿉니다.
         status = case when capacity > 0 and taken + n >= capacity then 'closed' else status end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_event;
  perform set_config('wcsc.ticket_op', '', true);

  return row_out;
end;
$$;

-- 취소 함수 — 자리를 되돌릴 때도 같은 표시를 씁니다.
create or replace function public.cancel_ticket(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o  public.ticket_orders%rowtype;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into o from public.ticket_orders where id = p_order for update;
  if not found then
    raise exception '신청 내역을 찾을 수 없습니다.';
  end if;
  if o.user_id <> me and not public.is_staff() then
    raise exception '본인이 신청한 건만 취소하실 수 있습니다.';
  end if;
  if o.status = 'canceled' then
    return;
  end if;

  update public.ticket_orders
     set status = 'canceled',
         canceled_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_order;

  perform set_config('wcsc.ticket_op', '1', true);
  update public.events
     set taken = greatest(taken - o.qty, 0),
         status = case when status = 'closed' then 'published' else status end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = o.event_id;
  perform set_config('wcsc.ticket_op', '', true);
end;
$$;

revoke all on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) from public, anon;
grant execute on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) to authenticated;
revoke all on function public.cancel_ticket(uuid) from public, anon;
grant execute on function public.cancel_ticket(uuid) to authenticated;


-- ---------------------------------------------------------
-- 20260828040000_wcsc_reserve_duplicate_message.sql
-- ---------------------------------------------------------

-- =========================================================
-- 이미 신청한 집회에 또 신청했을 때
--
-- 한 사람이 같은 집회에 두 번 신청하지 못하도록 고유 인덱스를 걸어 두었는데,
-- 두 번째 신청에서 그 인덱스 이름이 그대로 화면에 나왔습니다.
--   duplicate key value violates unique constraint "ticket_orders_one_per_person"
-- 신청하신 분이 읽을 말이 아닙니다.
--
-- 넣기 전에 먼저 확인해 사람 말로 알려 주고,
-- 그래도 동시에 두 번 눌린 경우(23505)는 받아서 같은 말로 바꿔 줍니다.
-- 고유 인덱스는 마지막 방벽으로 그대로 둡니다.
-- =========================================================

create or replace function public.reserve_tickets(
  p_event  uuid,
  p_qty    integer,
  p_seats  jsonb default '[]'::jsonb,
  p_name   text default '',
  p_phone  text default '',
  p_church text default '',
  p_note   text default ''
)
returns public.ticket_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ev     public.events%rowtype;
  me     uuid := auth.uid();
  seats  jsonb := coalesce(p_seats, '[]'::jsonb);
  n      integer := coalesce(p_qty, 0);
  taken_seats jsonb;
  row_out public.ticket_orders%rowtype;
begin
  if me is null then
    raise exception '신청하려면 로그인해 주세요.' using errcode = '28000';
  end if;

  -- 행을 잠급니다 — 여기서부터는 이 신청 하나만 정원을 봅니다.
  select * into ev from public.events where id = p_event for update;
  if not found then
    raise exception '집회를 찾을 수 없습니다.';
  end if;

  if ev.status = 'closed' then
    raise exception '정원이 모두 찼습니다 — 신청이 마감되었습니다.';
  end if;
  if ev.status <> 'published' then
    raise exception '지금은 신청을 받지 않는 집회입니다.';
  end if;

  if ev.open_at <> '' and now() < ev.open_at::timestamptz then
    raise exception '아직 예매가 열리지 않았습니다.';
  end if;
  if ev.close_at <> '' and now() > ev.close_at::timestamptz then
    raise exception '신청이 마감되었습니다.';
  end if;

  -- 이미 신청하셨는지 먼저 봅니다 (인덱스 이름이 화면에 나오지 않도록).
  if exists (
    select 1 from public.ticket_orders
     where event_id = p_event and user_id = me and status <> 'canceled'
  ) then
    raise exception '이미 신청하셨습니다. [내 신청 내역] 에서 확인해 주세요.';
  end if;

  if n < 1 then
    raise exception '신청 인원을 확인해 주세요.';
  end if;
  if ev.per_person_max > 0 and n > ev.per_person_max then
    raise exception '한 번에 최대 %명까지 신청하실 수 있습니다.', ev.per_person_max;
  end if;

  if ev.capacity > 0 and ev.taken + n > ev.capacity then
    raise exception '정원이 %석밖에 남지 않았습니다. 인원을 줄여 다시 신청해 주세요.',
      greatest(ev.capacity - ev.taken, 0);
  end if;

  if ev.seating_on then
    if jsonb_array_length(seats) <> n then
      raise exception '좌석을 %개 골라 주세요.', n;
    end if;
    select coalesce(jsonb_agg(s), '[]'::jsonb) into taken_seats
      from public.ticket_orders o, jsonb_array_elements_text(o.seats) s
     where o.event_id = p_event and o.status <> 'canceled';
    if exists (
      select 1 from jsonb_array_elements_text(seats) w
       where taken_seats ? w.value
    ) then
      raise exception '방금 다른 분이 먼저 잡은 좌석이 있습니다. 좌석도를 새로 고쳐 주세요.';
    end if;
  else
    seats := '[]'::jsonb;
  end if;

  begin
    insert into public.ticket_orders
      (event_id, user_id, user_email, event_title, qty, seats,
       name, phone, church_name, note, status, code, created_at, updated_at)
    values
      (p_event, me, coalesce((select email from auth.users where id = me), ''),
       ev.title, n, seats,
       coalesce(p_name, ''), coalesce(p_phone, ''), coalesce(p_church, ''), coalesce(p_note, ''),
       'confirmed',
       upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
       to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
       to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    returning * into row_out;
  exception when unique_violation then
    -- 두 번이 동시에 눌린 경우입니다. 위 확인만으로는 못 걸러집니다.
    raise exception '이미 신청하셨습니다. [내 신청 내역] 에서 확인해 주세요.';
  end;

  perform set_config('wcsc.ticket_op', '1', true);
  update public.events
     set taken = taken + n,
         -- 정원이 다 찼으면 여기서 바로 마감으로 바꿉니다.
         status = case when capacity > 0 and taken + n >= capacity then 'closed' else status end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_event;
  perform set_config('wcsc.ticket_op', '', true);

  return row_out;
end;
$$;

revoke all on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) from public, anon;
grant execute on function public.reserve_tickets(uuid, integer, jsonb, text, text, text, text) to authenticated;


-- ---------------------------------------------------------
-- 20260902010000_wcsc_payments.sql
-- ---------------------------------------------------------

-- =========================================================
-- 카드 결제 — 아직 켜지 않았습니다
--
-- PG 계약 전이라 화면에서는 결제 버튼이 보이지 않습니다
-- (src/data/site.js 의 payment.enabled 가 false).
-- 계약이 끝나 그 값을 true 로 바꾸면 이 표가 그대로 쓰입니다.
--
-- 왜 표를 따로 두는가
--   listings.fee 는 "냈다/안 냈다" 한 줄뿐이라, 실패한 시도나 환불,
--   같은 건에 두 번 결제된 일을 나중에 설명할 수 없습니다.
--   돈이 오간 기록은 지우지 않고 쌓아 두고, listings.fee 는
--   그 결과를 비추기만 합니다.
--
-- 승인은 반드시 서버(Edge Function)에서 합니다.
--   금액을 브라우저가 보내 준 값으로 믿으면 6만원짜리를 100원에
--   결제하고 게시글을 얻을 수 있습니다. 그래서 이 표에 미리 적어 둔
--   amount 와 PG 가 알려 준 실제 결제 금액을 서버가 맞춰 봅니다.
-- =========================================================

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  user_email    text not null default '',

  -- 무엇에 대한 결제인가
  kind          text not null
                check (kind in ('listing_fee', 'install_fee')),
  target_id     uuid,                       -- listings.id 또는 install_requests.id
  target_title  text not null default '',   -- 나중에 대상이 지워져도 남도록

  -- 주문 — order_id 는 우리가 만들어 PG 에 넘기는 값입니다 (겹치면 안 됩니다)
  order_id      text not null unique,
  amount        bigint not null check (amount > 0),

  status        text not null default 'ready'
                check (status in ('ready','pending','paid','failed','canceled','refunded')),

  -- PG 쪽 값 — 계약 전이라 비어 있습니다
  provider      text not null default '',
  provider_id   text not null default '',   -- PG 가 준 결제 번호
  method        text not null default '',   -- 카드 · 간편결제 등
  receipt_url   text not null default '',

  paid_at       text not null default '',
  canceled_at   text not null default '',
  fail_reason   text not null default '',

  raw           jsonb not null default '{}'::jsonb,  -- PG 응답 원본 (분쟁 때 근거)

  created_at    text not null default '',
  updated_at    text not null default '',
  inserted_at   timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id);
create index payments_status_idx on public.payments (status);
create index payments_target_idx on public.payments (kind, target_id);

comment on table public.payments is
  '카드 결제 기록. 승인은 Edge Function 이 하며, 브라우저는 이 표를 직접 고칠 수 없습니다.';

-- =========================================================
-- 접근 규칙
--
-- 브라우저에게는 "내 결제 내역을 읽는 것"만 허용합니다.
-- 만들고 고치는 것은 전부 서버(service_role)와 직원의 몫입니다 —
-- 결제 상태를 브라우저가 쓸 수 있으면 결제 없이 paid 로 바꿔
-- 게시글을 얻을 수 있습니다.
-- =========================================================
alter table public.payments enable row level security;

create policy payments_read on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- insert · update 정책을 일부러 두지 않습니다.
-- RLS 는 정책이 없으면 막습니다 → 브라우저에서는 아무것도 쓸 수 없습니다.
-- Edge Function 은 service_role 로 붙으므로 RLS 를 지나갑니다.

create policy payments_staff_update on public.payments for update to authenticated
  using (public.can('settlement')) with check (public.can('settlement'));

create policy payments_staff_delete on public.payments for delete to authenticated
  using (public.can('settlement'));

-- =========================================================
-- 결제할 건을 여는 함수
--
-- 브라우저가 직접 payments 행을 만들지 못하므로, 이 함수로 엽니다.
-- 금액은 인자로 받지 않습니다 — 서버가 정합니다.
-- =========================================================
create or replace function public.open_payment(p_kind text, p_target uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  fee    bigint;
  title  text;
  ord    text;
  out_row public.payments%rowtype;
begin
  if me is null then
    raise exception '결제하려면 로그인해 주세요.' using errcode = '28000';
  end if;

  if p_kind = 'listing_fee' then
    -- 내가 올린 글이고, 입금을 기다리는 상태일 때만 열어 줍니다.
    select l.title into title from public.listings l
     where l.id = p_target and l.user_id = me and l.status = 'awaiting_payment';
    if not found then
      raise exception '지금 결제하실 수 있는 매물이 아닙니다.';
    end if;
    -- 금액은 글에 적혀 있는 등록비를 그대로 씁니다 (브라우저 값을 믿지 않습니다).
    select coalesce((l.fee ->> 'amount')::bigint, 60000) into fee
      from public.listings l where l.id = p_target;

  elsif p_kind = 'install_fee' then
    select r.item_title, r.quote_amount into title, fee
      from public.install_requests r
     where r.id = p_target and r.user_id = me and r.status = 'quoted';
    if not found then
      raise exception '지금 결제하실 수 있는 설치 건이 아닙니다.';
    end if;
    if coalesce(fee, 0) <= 0 then
      raise exception '아직 견적이 확정되지 않았습니다.';
    end if;

  else
    raise exception '알 수 없는 결제 종류입니다.';
  end if;

  -- 이미 열어 둔 건이 있으면 그것을 그대로 씁니다 (중복 결제를 막습니다).
  select * into out_row from public.payments
   where kind = p_kind and target_id = p_target and user_id = me
     and status in ('ready', 'pending')
   order by inserted_at desc limit 1;
  if found then
    return out_row;
  end if;

  -- 이미 낸 건이면 다시 열지 않습니다.
  if exists (select 1 from public.payments
              where kind = p_kind and target_id = p_target and status = 'paid') then
    raise exception '이미 결제가 끝난 건입니다.';
  end if;

  ord := 'wcsc-' || replace(p_kind, '_', '') || '-' ||
         to_char(now() at time zone 'utc', 'YYYYMMDDHH24MISS') || '-' ||
         substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.payments
    (user_id, user_email, kind, target_id, target_title, order_id, amount,
     status, created_at, updated_at)
  values
    (me, coalesce((select email from auth.users where id = me), ''),
     p_kind, p_target, coalesce(title, ''), ord, fee,
     'ready',
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  returning * into out_row;

  return out_row;
end;
$$;

revoke all on function public.open_payment(text, uuid) from public, anon;
grant execute on function public.open_payment(text, uuid) to authenticated;

-- =========================================================
-- 결제 완료 처리 — service_role 만 부릅니다 (Edge Function)
--
-- 승인 결과를 받아 결제 기록을 닫고, 대상 글을 다음 단계로 넘깁니다.
-- 매물이면 등록비를 낸 것으로 표시하고 바로 게시합니다 — 지금
-- 직원이 손으로 하던 [입금 확인 → 게시하기] 두 걸음이 여기서 끝납니다.
-- =========================================================
create or replace function public.settle_payment(
  p_order   text,
  p_paid    bigint,
  p_provider text,
  p_pid     text,
  p_method  text,
  p_receipt text,
  p_raw     jsonb
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments%rowtype;
  ts  text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  select * into pay from public.payments where order_id = p_order for update;
  if not found then
    raise exception '결제 건을 찾을 수 없습니다: %', p_order;
  end if;

  if pay.status = 'paid' then
    return pay;   -- 이미 처리했습니다 (같은 통지가 두 번 와도 안전하도록)
  end if;

  -- 금액이 다르면 절대 통과시키지 않습니다.
  if p_paid is distinct from pay.amount then
    update public.payments
       set status = 'failed',
           fail_reason = format('금액이 맞지 않습니다 (기대 %s, 결제 %s)', pay.amount, p_paid),
           raw = coalesce(p_raw, '{}'::jsonb), updated_at = ts
     where id = pay.id returning * into pay;
    raise exception '결제 금액이 맞지 않습니다.';
  end if;

  update public.payments
     set status = 'paid', provider = p_provider, provider_id = p_pid,
         method = coalesce(p_method, ''), receipt_url = coalesce(p_receipt, ''),
         raw = coalesce(p_raw, '{}'::jsonb), paid_at = ts, updated_at = ts
   where id = pay.id
  returning * into pay;

  if pay.kind = 'listing_fee' then
    update public.listings
       set fee = jsonb_build_object(
             'amount', pay.amount, 'paid', true, 'paidAt', ts,
             'noticeSentAt', coalesce(fee ->> 'noticeSentAt', ''),
             'invoiceId', pay.order_id),
           status = 'published',
           published_at = ts,
           first_published_at = case when first_published_at = '' then ts else first_published_at end,
           edit_requested_at = '',
           updated_at = ts
     where id = pay.target_id;

  elsif pay.kind = 'install_fee' then
    update public.install_requests
       set status = 'scheduled', updated_at = ts
     where id = pay.target_id;
  end if;

  return pay;
end;
$$;

revoke all on function public.settle_payment(text, bigint, text, text, text, text, jsonb)
  from public, anon, authenticated;
-- service_role 만 부릅니다. 따로 grant 하지 않습니다
-- (service_role 은 함수 실행 권한을 기본으로 가집니다).

alter publication supabase_realtime add table public.payments;


-- ---------------------------------------------------------
-- 20260902030000_wcsc_job_posts.sql
-- ---------------------------------------------------------

-- =========================================================
-- 교역자 구인 공고 (job_posts)
--
-- 지금까지는 교회가 조건을 알려 주면 센터가 사람을 찾아 이어 주는
-- 방식이었습니다. 그러면 센터가 아는 사람 안에서만 이어집니다.
-- 그래서 공고를 열어 두고 사역자가 직접 보고 연락하도록 바꿉니다 —
-- 특히 멀어서 사람 구하기 어려운 교회일수록 이 편이 낫습니다.
--
-- 지원은 아직 사이트 안에서 받지 않습니다.
--   공고에 적힌 연락처로 직접 연락합니다. 지원서를 사이트에 받으면
--   센터가 지원자 개인정보의 보관·파기 책임을 지게 되므로,
--   처리방침과 보관 기간을 정한 뒤에 붙이기로 했습니다.
--   그때를 위해 apply_mode 칸만 미리 두었습니다 ('contact' → 'onsite').
--
-- 사례비 · 사택 · 교통을 따로 칸으로 받는 이유
--   "협의" 한 줄만 있는 공고는 멀리 있는 사역자가 판단을 못 합니다.
--   갈지 말지를 정하는 건 결국 이 셋이라, 눈에 띄게 적게 했습니다.
-- =========================================================

create table public.job_posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_email      text not null default '',
  status          text not null default 'pending'
                  check (status in ('pending','published','rejected','hidden','done')),

  -- 어느 교회인가
  church_name     text not null default '',
  denomination    text not null default '',
  church_size     text not null default '',   -- 출석 교인 수 (구간)
  region          text not null default '',
  address_rough   text not null default '',

  -- 어떤 자리인가
  title           text not null default '',
  position        text not null default 'assistant',   -- 직분
  position_other  text not null default '',
  department      text not null default '',            -- 맡을 부서
  employment      text not null default 'full'
                  check (employment in ('full','part','weekend','short')),
  headcount       integer not null default 1,

  -- 사례비 — 멀리 있는 사역자가 가장 먼저 보는 값입니다
  pay_type        text not null default 'monthly'
                  check (pay_type in ('monthly','weekly','per_service','negotiable')),
  pay_min         bigint not null default 0,
  pay_max         bigint not null default 0,
  pay_note        text not null default '',
  housing         text not null default 'none'
                  check (housing in ('none','provided','support','negotiable')),
  insurance       boolean not null default false,

  -- 오가는 일 — "가기 어려운 곳" 을 숨기지 않고 미리 알리기 위한 칸들
  commute_note    text not null default '',   -- 가까운 역 · 터미널, 차량 필요 여부
  work_days       text not null default '',   -- 주일만 · 주중 포함 등
  start_date      text not null default '',   -- 부임 희망 시기
  closes_at       text not null default '',   -- 모집 마감 (비면 구할 때까지)

  -- 내용
  qualification   text not null default '',   -- 바라는 자격 · 경험
  "desc"          text not null default '',   -- 교회 소개와 하실 일
  photos          jsonb not null default '[]'::jsonb,

  -- 연락 (지금은 여기로 직접 지원합니다)
  contact_name    text not null default '',
  contact_phone   text not null default '',
  contact_email   text not null default '',
  contact_hours   text not null default '',

  -- 나중에 사이트 안 지원을 열 때 씁니다
  apply_mode      text not null default 'contact'
                  check (apply_mode in ('contact','onsite')),

  reject_note     text not null default '',
  views           integer not null default 0,
  reviewed_by     text not null default '',
  reviewed_at     text not null default '',
  published_at    text not null default '',
  hidden_at       text not null default '',
  sample          boolean not null default false,
  created_at      text not null default '',
  updated_at      text not null default '',
  inserted_at     timestamptz not null default now()
);

create index job_posts_status_idx on public.job_posts (status);
create index job_posts_user_id_idx on public.job_posts (user_id);
create index job_posts_region_idx on public.job_posts (region);

comment on table public.job_posts is
  '교역자 구인 공고. 지원은 공고에 적힌 연락처로 직접 합니다 (사이트 안 지원은 아직 열지 않았습니다).';
comment on column public.job_posts.apply_mode is
  '지원 방식. 지금은 contact 뿐입니다. 사이트 안 지원을 열 때 onsite 를 씁니다.';

-- =========================================================
-- 접근 규칙 — 다른 게시판과 같은 흐름입니다
-- =========================================================
alter table public.job_posts enable row level security;

create policy jobs_read_public on public.job_posts for select to anon, authenticated
  using (status = 'published');

create policy jobs_read_own on public.job_posts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy jobs_insert on public.job_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by = ''
    and published_at = ''
  );

-- 고치면 다시 확인을 받습니다. 다만 '모집 완료'로 내리는 것은 언제든 됩니다 —
-- 사람을 구했는지 가장 먼저 아는 쪽은 교회입니다.
create policy jobs_update_own on public.job_posts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('pending', 'done'));

create policy jobs_update_staff on public.job_posts for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy jobs_delete on public.job_posts for delete to authenticated
  using (user_id = (select auth.uid()) or public.can('customers'));

alter publication supabase_realtime add table public.job_posts;


-- ---------------------------------------------------------
-- 20260903010000_wcsc_search_logs.sql
-- ---------------------------------------------------------

-- =========================================================
-- 찾은 말 기록 (search_logs)
--
-- 로그인하신 분만 남습니다. 로그인하지 않은 분은 아무것도
-- 저장하지 않습니다 — 남길 자리(계정)가 없기 때문입니다.
--
-- 무엇을 찾으셨는지는 개인정보입니다. 그래서
--   · 본인만 읽고, 본인만 지울 수 있습니다 (직원도 못 봅니다)
--   · 찾기 창에서 [지우기] 로 언제든 한 번에 지울 수 있습니다
--   · 계정을 지우면 함께 지워집니다 (on delete cascade)
--
-- 같은 말을 여러 번 찾으시면 줄을 늘리지 않고 시각만 새로 씁니다.
-- 그래야 목록이 같은 말로 가득 차지 않습니다.
-- =========================================================

create table public.search_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  q           text not null check (length(q) between 1 and 100),
  hits        integer not null default 0,   -- 그때 몇 개가 나왔는지
  created_at  timestamptz not null default now(),

  -- 사람마다 같은 말은 한 줄만 둡니다
  unique (user_id, q)
);

create index search_logs_recent_idx on public.search_logs (user_id, created_at desc);

comment on table public.search_logs is
  '로그인한 분이 찾은 말. 본인만 읽고 지울 수 있으며, 직원도 볼 수 없습니다.';

alter table public.search_logs enable row level security;

-- 직원도 제외합니다. 무엇을 찾았는지는 운영에 필요한 정보가 아닙니다.
create policy search_logs_read on public.search_logs for select to authenticated
  using (user_id = (select auth.uid()));

create policy search_logs_insert on public.search_logs for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy search_logs_update on public.search_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy search_logs_delete on public.search_logs for delete to authenticated
  using (user_id = (select auth.uid()));

-- =========================================================
-- 남기기 — 같은 말이면 시각만 새로 씁니다.
-- 그리고 한 사람당 스무 줄만 남기고 오래된 것부터 지웁니다.
-- 기록이 끝없이 쌓이면 그것대로 부담입니다.
-- =========================================================
create or replace function public.log_search(p_q text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  word text := btrim(p_q);
begin
  if me is null or word = '' or length(word) > 100 then
    return;
  end if;

  insert into public.search_logs (user_id, q)
  values (me, word)
  on conflict (user_id, q) do update set created_at = now();

  delete from public.search_logs
   where user_id = me
     and id not in (
       select id from public.search_logs
        where user_id = me
        order by created_at desc
        limit 20
     );
end;
$$;

revoke all on function public.log_search(text) from public, anon;
grant execute on function public.log_search(text) to authenticated;


-- ---------------------------------------------------------
-- 20260907010000_wcsc_notify_request.sql
-- ---------------------------------------------------------

-- 새 지원 신청이 들어오면 담당자에게 메일이 가도록 합니다.
-- (Supabase 에 적용 완료 — 이 파일은 기록용입니다.)

create extension if not exists pg_net with schema extensions;

do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'notify_hook_secret';
  if v_id is null then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'notify_hook_secret');
  end if;
end $$;

create or replace function public.notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'notify_hook_secret';

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://tbxosynzszcgtieonsui.supabase.co/functions/v1/notify-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', v_secret
    ),
    body := jsonb_build_object(
      'code', new.code,
      'church', coalesce(new.church_name, ''),
      'name', coalesce(new.contact_name, ''),
      'phone', coalesce(new.phone, ''),
      'email', coalesce(new.email, ''),
      'services', coalesce(new.services::text, ''),
      'message', coalesce(new.message, ''),
      'createdAt', new.created_at
    )
  );
  return new;
end $$;

drop trigger if exists on_request_created on public.requests;
create trigger on_request_created
  after insert on public.requests
  for each row execute function public.notify_new_request();


-- ---------------------------------------------------------
-- 20260912010000_wcsc_request_files.sql
-- ---------------------------------------------------------

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
