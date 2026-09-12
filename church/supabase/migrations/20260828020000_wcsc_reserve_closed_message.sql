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
