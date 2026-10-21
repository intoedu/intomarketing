-- ============================================================
-- 인투마케팅 신청서 → 「신청 접수 완료」 알림톡 (솔라피)
--
-- requests 에 새 줄이 들어오면 Edge Function apply-notify 를 부릅니다.
--   · 넘기는 값은 신청 건 id 하나뿐 — 나머지는 함수가 DB 에서 다시 읽습니다.
--   · 손님이 «자기 계정으로» 낸 인투마케팅(center='mkt') 건만 부릅니다.
--     관리자가 어드민에서 직접 넣은 건(user_id 없음)은 부르지 않습니다.
--   · 부르기가 실패해도 신청 저장은 절대 막지 않습니다.
--
-- 🔴 적용 순서 : ① 이 파일 적용 → ② 아래 「비밀값 꺼내기」로 나온 값을
--    Edge Function 비밀값 APPLY_HOOK_SECRET 에 넣기 → ③ apply-notify 배포 (JWT 검사 끔)
--    ② 를 안 하면 함수가 403 으로 거절해 아무것도 안 갑니다 (신청은 정상 저장).
-- 🔴 이 저장소는 공개입니다. 비밀값을 이 파일이나 문서에 적지 마세요.
--
-- 비밀값 꺼내기 (SQL Editor, 관리자만):
--   select decrypted_secret from vault.decrypted_secrets where name = 'mkt_apply_hook_secret';
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ── 발송 기록 ──
create table if not exists public.mkt_alimtalk_log (
  id          bigint generated always as identity primary key,
  request_id  text not null,                 -- requests.id (형식에 묶이지 않게 글자로 둡니다)
  user_id     uuid,
  kind        text not null,                 -- 'apply_received' = 신청 접수 완료
  to_phone    text,
  template_id text,
  variables   jsonb,
  status      text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  error       text,
  response    jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (request_id, kind)                  -- 같은 건에 같은 알림은 한 번만
);
create index if not exists mkt_alimtalk_log_phone_at on public.mkt_alimtalk_log (to_phone, created_at);
create index if not exists mkt_alimtalk_log_user_at  on public.mkt_alimtalk_log (user_id, created_at);

-- 휴대폰 번호가 들어 있으므로 바깥(anon · 로그인 손님)에서는 못 봅니다. 함수(service_role)만 씁니다.
alter table public.mkt_alimtalk_log enable row level security;
revoke all on public.mkt_alimtalk_log from anon, authenticated;

-- ── 함수가 받는 사람임을 확인하는 비밀값 (없을 때만 새로 만듦) ──
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'mkt_apply_hook_secret';
  if v_id is null then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'mkt_apply_hook_secret');
  end if;
end $$;

-- ── 트리거 ──
create or replace function public.mkt_apply_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
begin
  -- 손님 본인이 낸 건만 (관리자 직접 입력 · 다른 사람 이름으로 넣은 건 제외)
  if new.user_id is null or new.user_id is distinct from auth.uid() then
    return new;
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'mkt_apply_hook_secret';
  if v_secret is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://qkvebwxewttqtcryfycy.supabase.co/functions/v1/apply-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-hook-secret', v_secret
      ),
      body := jsonb_build_object('id', new.id)
    );
  exception when others then
    -- 알림이 실패해도 신청 저장은 그대로 둡니다
    raise warning 'mkt_apply_notify: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.mkt_apply_notify() from public, anon, authenticated;

drop trigger if exists on_mkt_request_created on public.requests;
create trigger on_mkt_request_created
  after insert on public.requests
  for each row
  when (new.center = 'mkt')
  execute function public.mkt_apply_notify();
