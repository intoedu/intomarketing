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
