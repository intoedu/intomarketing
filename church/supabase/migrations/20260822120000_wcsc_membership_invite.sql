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
