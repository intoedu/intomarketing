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
