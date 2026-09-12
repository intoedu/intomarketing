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
