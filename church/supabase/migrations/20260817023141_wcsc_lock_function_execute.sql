-- =========================================================
-- 함수 호출 권한 정리
--
-- security definer 함수가 REST(/rest/v1/rpc/...)로 그대로 열려 있으면
-- 의도치 않게 밖에서 부를 수 있습니다. 필요한 만큼만 남깁니다.
--
--  · 트리거 전용 함수 → 아무도 직접 못 부르게 (트리거는 영향받지 않습니다)
--  · 권한 확인 함수   → 로그인한 사용자만. RLS 정책이 호출자 권한으로
--                       평가되므로 authenticated 에는 남겨 두어야 합니다.
--                       (본인 권한 여부만 알려 주므로 알려져도 문제없습니다)
-- =========================================================

-- 트리거 전용
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.users_guard()          from public, anon, authenticated;
revoke execute on function public.customers_guard()      from public, anon, authenticated;
revoke execute on function public.listings_guard()       from public, anon, authenticated;
revoke execute on function public.edit_consents_guard()  from public, anon, authenticated;

-- 권한 확인 — 익명에게는 필요 없습니다 (익명이 쓰는 정책은 조건이 상수입니다)
revoke execute on function public.is_staff()             from public, anon;
revoke execute on function public.is_owner()             from public, anon;
revoke execute on function public.can(text)              from public, anon;
revoke execute on function public.edit_approved(uuid)    from public, anon;

grant execute on function public.is_staff()          to authenticated;
grant execute on function public.is_owner()          to authenticated;
grant execute on function public.can(text)           to authenticated;
grant execute on function public.edit_approved(uuid) to authenticated;
