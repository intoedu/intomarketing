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
