-- =========================================================
-- 함수 권한 마무리 (Supabase 보안 점검 결과 반영)
--
-- 1) no_end_user() 에 search_path 를 고정합니다.
--    검색 경로가 열려 있으면, 같은 이름의 함수를 다른 스키마에 만들어
--    바꿔치기하는 수법을 막을 수 없습니다.
--
-- 2) 정책이 실제로 쓰지 않는 함수는 REST 에서 닫습니다.
--    · is_staff() · can()      → 정책이 "호출자 권한으로" 평가하므로
--                                authenticated 에 EXECUTE 가 있어야 합니다. (유지)
--    · is_owner() · edit_approved() → 어떤 정책도 쓰지 않고, 화면에서도
--                                부르지 않습니다. 열어 둘 이유가 없어 닫습니다.
--                                (edit_approved 는 customers_guard 안에서만
--                                 쓰이는데, 그 트리거는 security definer 라
--                                 호출자 권한과 무관하게 동작합니다.)
-- =========================================================

create or replace function public.no_end_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null;
$$;

revoke execute on function public.no_end_user() from public, anon, authenticated;

revoke execute on function public.is_owner()           from public, anon, authenticated;
revoke execute on function public.edit_approved(uuid)  from public, anon, authenticated;
