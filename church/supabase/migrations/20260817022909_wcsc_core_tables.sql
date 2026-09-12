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
