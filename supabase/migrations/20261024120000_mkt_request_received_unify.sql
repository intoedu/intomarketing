-- ============================================================
-- 인투마케팅 신청서 → 「신청 접수 완료」 알림톡 — 발송 통로를 하나로
--
-- 이 DB(qkvebwxewttqtcryfycy)는 블로그센터와 함께 씁니다. 알림톡은 «한 통로»로만 나갑니다:
--   requests 새 줄 → 트리거 requests_alimtalk_receipt_t → Edge Function send-alimtalk → 솔라피
--   · 솔라피 키는 send-alimtalk 이 이미 씁니다 (Edge Functions → Secrets)
--   · 템플릿 ID · 변수 · 승인 값 · 문자 대체발송 여부는 settings(key='blog') 의
--     alimtalk_templates.request_received 한곳에 둡니다
--   · 보낸 기록은 alimtalk_log 하나에 남습니다 (ref = 'request:<신청 id>')
--
-- 이 파일이 바꾸는 것 — 10/21 에 적용된 requests_alimtalk_receipt() 를 보강합니다.
--   · 손님 본인 계정으로 낸 신청만 (관리자 직접 입력 · 「제작 자료」 제출은 보내지 않음)
--   · 같은 번호 24시간 5통 · 같은 계정 24시간 10건까지 (남의 번호를 적는 장난 방지)
--   · 템플릿을 바꿔도 트리거를 고치지 않게 — settings 의 vars 목록대로 변수를 골라 보냄
--   · settings 의 enum(심사 때 승인받은 값) 밖의 값이면 보내지 않음
--   · 보내지 않은 건도 이유를 alimtalk_log 에 skipped 로 남김
--   · 알림이 실패해도 신청 저장은 절대 막지 않음
--
-- 🔴 예전 계획(20261021120000_mkt_apply_alimtalk.sql · Edge Function apply-notify)은 쓰지 않습니다.
--    같이 켜면 신청 1건에 알림톡이 2통 갑니다. 저장소에서도 지웠습니다 (2026-10-24).
-- 🔴 이 저장소는 공개입니다. 템플릿 ID · 키를 이 파일에 적지 마세요 (settings 표에 넣습니다).
-- ============================================================

-- requests.kind → 새 템플릿 「인투마케팅_신청접수」 의 #{신청분야} 값
-- (예전 템플릿 「신청접수안내」 의 #{서비스명} 은 alimtalk_service_name() 이 그대로 맡습니다)
create or replace function public.mkt_apply_field_name(p_kind text)
returns text
language sql
immutable
set search_path = public
as $$
  select case btrim(coalesce(p_kind, ''))
           when '홈페이지'    then '홈페이지 제작'
           when '앱'          then '앱 제작'
           when '프로그램'    then '프로그램 제작'
           when 'SNS'         then 'SNS 채널'
           when '디자인'      then '그래픽 디자인'
           when '영상'        then '영상 제작'
           when '블로그·리뷰' then '블로그 · 리뷰'
           else null
         end;
$$;

-- 이 신청 건에 알림톡을 보낼지 · 무엇을 보낼지 «판단만» 합니다 (보내지는 않습니다).
-- 트리거가 이것을 부르고, 사람이 SQL 로 미리 확인할 때도 씁니다:
--   select id, public.mkt_receipt_plan(r) from public.requests r where center='mkt' order by created_at desc limit 5;
-- 돌려주는 값 : { send:true,  to, template_id, vars }
--               { send:false, reason, to?, template_id? }
create or replace function public.mkt_receipt_plan(r public.requests)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_tpl    jsonb;
  v_names  jsonb;
  v_all    jsonb;
  v_vars   jsonb := '{}'::jsonb;
  v_name   text;
  v_val    text;
  v_ok     jsonb;
  v_phone  text;
  v_at     timestamp;
  v_n      int;
  v_base   jsonb;
begin
  if coalesce(r.center, '') <> 'mkt' then
    return jsonb_build_object('send', false, 'reason', 'NOT_MKT');
  end if;

  v_phone := regexp_replace(coalesce(r.phone, ''), '[^0-9]', '', 'g');
  if v_phone = '' then
    return jsonb_build_object('send', false, 'reason', 'NO_PHONE');
  end if;

  select value->'alimtalk_templates'->'request_received' into v_tpl
    from settings where key = 'blog';
  v_base := jsonb_build_object('send', false, 'to', v_phone, 'template_id', v_tpl->>'id');

  -- 손님 본인 계정으로 낸 신청만 — user_id 는 set_request_member() 가 auth.uid() 로 채웁니다.
  -- 관리자가 어드민에서 넣은 건은 관리자 계정이 들어가므로 「등록 경로」 표시로 가립니다.
  if r.user_id is null or coalesce(r.details->>'등록 경로', '') = '관리자 직접 입력' then
    return v_base || jsonb_build_object('reason', 'NOT_CUSTOMER');
  end if;
  -- 계약 뒤 「제작 자료」 제출은 신청이 아닙니다
  if coalesce(r.details->>'접수 구분', '') = '제작 자료' then
    return v_base || jsonb_build_object('reason', 'MATERIAL_FOLLOWUP');
  end if;

  -- 하루 한도 (지금 이 건은 아직 세지 않은 상태에서 봅니다)
  select count(*) into v_n from alimtalk_log
   where kind = 'request_received' and to_phone = v_phone and status = 'sent'
     and created_at > now() - interval '24 hours';
  if v_n >= 5 then
    return v_base || jsonb_build_object('reason', 'DAILY_LIMIT_PHONE');
  end if;
  select count(*) into v_n from requests
   where center = 'mkt' and user_id = r.user_id and id <> r.id
     and created_at > now() - interval '24 hours';
  if v_n >= 10 then
    return v_base || jsonb_build_object('reason', 'DAILY_LIMIT_USER');
  end if;

  -- 템플릿이 쓰는 변수만 골라 채웁니다 (settings 에 vars 가 없으면 예전 템플릿 두 개)
  v_names := coalesce(v_tpl->'vars', '["상호","서비스명"]'::jsonb);
  v_at := r.created_at at time zone 'Asia/Seoul';
  v_all := jsonb_build_object(
    '상호',     nullif(btrim(coalesce(r.academy_name, '')), ''),
    '서비스명', alimtalk_service_name(r.kind),
    '고객명',   coalesce(nullif(btrim(coalesce(r.manager_name, '')), ''),
                         nullif(btrim(coalesce(r.academy_name, '')), ''), '고객'),
    '신청분야', mkt_apply_field_name(r.kind),
    -- 홈페이지 신청서는 화면에서 만든 「신청 번호」, 나머지는 신청 건 id 앞 8자리
    '접수번호', coalesce(nullif(btrim(coalesce(r.details->>'신청 번호', '')), ''),
                         upper(left(replace(r.id::text, '-', ''), 8))),
    -- 2026년 10월 21일 오후 3:05
    '접수일시', to_char(v_at, 'YYYY"년" FMMM"월" FMDD"일" ')
                || case when extract(hour from v_at) < 12 then '오전 ' else '오후 ' end
                || to_char(v_at, 'FMHH12:MI')
  );

  for v_name in select jsonb_array_elements_text(v_names) loop
    v_val := v_all->>v_name;
    if v_val is null or v_val = '' then
      -- 예: 예전 템플릿에는 「앱」 「프로그램」 값이 없습니다
      return v_base || jsonb_build_object('reason', 'NO_VALUE:' || v_name);
    end if;
    v_ok := v_tpl->'enum'->v_name;
    if v_ok is not null and not (v_ok ? v_val) then
      return v_base || jsonb_build_object('reason', 'NOT_APPROVED:' || v_name || '=' || v_val);
    end if;
    v_vars := v_vars || jsonb_build_object(v_name, v_val);
  end loop;

  return jsonb_build_object('send', true, 'to', v_phone, 'template_id', v_tpl->>'id', 'vars', v_vars);
end $$;

revoke all on function public.mkt_receipt_plan(public.requests) from public, anon, authenticated;
revoke all on function public.mkt_apply_field_name(text) from public, anon, authenticated;

-- ── 트리거 함수 (트리거 requests_alimtalk_receipt_t 는 그대로 둡니다) ──
create or replace function public.requests_alimtalk_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_plan  jsonb;
  v_key   text;
  v_token text;
begin
  /* 인투마케팅 신청만 */
  if coalesce(new.center, '') <> 'mkt' then return new; end if;

  begin
    v_plan := mkt_receipt_plan(new);

    if not coalesce((v_plan->>'send')::boolean, false) then
      /* 보내지 않은 이유를 남깁니다 (번호가 없으면 남길 곳도 없습니다) */
      if v_plan ? 'to' then
        insert into alimtalk_log (kind, channel, template_id, to_phone, ref, status, error)
        values ('request_received', 'intomarketing', v_plan->>'template_id', v_plan->>'to',
                'request:' || new.id, 'skipped', v_plan->>'reason');
      end if;
      return new;
    end if;

    select decrypted_secret into v_key
      from vault.decrypted_secrets where name = 'alimtalk_anon_key';
    v_token := alimtalk_new_call_token();

    perform net.http_post(
      url := 'https://qkvebwxewttqtcryfycy.supabase.co/functions/v1/send-alimtalk',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-call-token', v_token,
        'Authorization', 'Bearer ' || coalesce(v_key, ''),
        'apikey', coalesce(v_key, '')),
      body := jsonb_build_object(
        'kind', 'request_received',
        'to',   v_plan->>'to',
        'vars', v_plan->'vars',
        'ref',  'request:' || new.id)
    );
  exception when others then
    /* 알림이 실패해도 신청 저장은 그대로 둡니다 */
    raise warning 'requests_alimtalk_receipt: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.requests_alimtalk_receipt() from public, anon, authenticated;
