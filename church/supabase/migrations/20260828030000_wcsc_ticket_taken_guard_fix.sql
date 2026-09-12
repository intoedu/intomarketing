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
