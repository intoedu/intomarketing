-- =========================================================
-- 접근 규칙 (RLS) — firestore.rules 와 같은 내용입니다.
--
-- 기본 원칙
--  · 홈페이지 내용(지원 항목, 센터 설정)은 로그인 없이 누구나 읽습니다.
--  · 신청서는 로그인한 사용자가 자기 것만 만들고 읽습니다.
--  · 고객 · 구독 · 청구 정보는 승인된 직원만 읽습니다.
--  · 교회 정보는 그 교회가 수정을 승인한 동안에만 직원이 고칠 수 있습니다.
--  · 매물 게시판은 게시(published)된 글만 공개됩니다.
-- =========================================================

alter table public.users           enable row level security;
alter table public.requests        enable row level security;
alter table public.customers       enable row level security;
alter table public.edit_consents   enable row level security;
alter table public.listings        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.invoices        enable row level security;
alter table public.service_content enable row level security;
alter table public.settings        enable row level security;

/* ---------- users : 계정 ---------- */
create policy users_read on public.users for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());

-- 가입 시 본인 문서를 만듭니다. 스스로 관리자가 될 수는 없습니다.
create policy users_insert_self on public.users for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('client', 'staff')
    and (case when role = 'client' then approved else not approved end)
    and perms = '{}'::jsonb
  );

-- 본인 수정 (직분 · 승인 · 권한은 트리거가 막습니다)
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy users_update_staff on public.users for update to authenticated
  using (public.can('members')) with check (public.can('members'));

create policy users_delete on public.users for delete to authenticated
  using (public.can('members'));

/* ---------- requests : 지원 신청 ---------- */
create policy requests_read on public.requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy requests_insert on public.requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'received'
    and assignee = ''
    and memo = ''
  );

create policy requests_update_staff on public.requests for update to authenticated
  using (public.can('requests')) with check (public.can('requests'));

-- 담당자로 배정된 직원은 자기 작업의 진행 정보만 (열 제한은 아래 트리거 없이
-- 정책만으로는 어려워, 담당자 본인 행에 한정하는 것으로 둡니다)
create policy requests_update_assignee on public.requests for update to authenticated
  using (public.is_staff() and assignee = (select auth.uid())::text)
  with check (public.is_staff() and assignee = (select auth.uid())::text);

create policy requests_delete on public.requests for delete to authenticated
  using (public.can('requests'));

/* ---------- customers : 고객 교회 ---------- */
create policy customers_read on public.customers for select to authenticated
  using (public.is_staff());

create policy customers_insert on public.customers for insert to authenticated
  with check (public.can('customers'));

-- 교회 정보 열은 customers_guard 트리거가 승인 여부를 확인합니다.
create policy customers_update on public.customers for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy customers_delete on public.customers for delete to authenticated
  using (public.can('customers'));

/* ---------- edit_consents : 교회 정보 수정 동의 ---------- */
create policy consents_read on public.edit_consents for select to authenticated
  using (public.is_staff() or user_id = (select auth.uid()));

create policy consents_insert on public.edit_consents for insert to authenticated
  with check (public.can('customers') and status = 'pending');

-- 직원이 스스로 approved 로 만들 수는 없습니다 — 그래야 승인이 의미가 있습니다.
create policy consents_update_staff on public.edit_consents for update to authenticated
  using (public.can('customers'))
  with check (public.can('customers') and status in ('pending', 'canceled', 'used', 'expired'));

create policy consents_update_client on public.edit_consents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('approved', 'rejected'));

create policy consents_delete on public.edit_consents for delete to authenticated
  using (public.can('customers'));

/* ---------- listings : 부동산 매물 게시판 ---------- */
-- 게시된 글은 로그인 없이 누구나 읽습니다.
create policy listings_read_public on public.listings for select to anon, authenticated
  using (status = 'published');

create policy listings_read_own on public.listings for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- 등록은 언제나 '승인 대기'로 시작하고, 요금은 미납 상태로 만들어집니다.
create policy listings_insert on public.listings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and (fee ->> 'paid')::boolean is not true
    and reviewed_by = ''
    and published_at = ''
  );

-- 등록자는 내용만. 고치면 다시 승인 대기로 돌아갑니다.
create policy listings_update_own on public.listings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy listings_update_staff on public.listings for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy listings_delete on public.listings for delete to authenticated
  using (user_id = (select auth.uid()) or public.can('customers'));

/* ---------- subscriptions · invoices ---------- */
create policy subs_read on public.subscriptions for select to authenticated
  using (public.can('customers') or public.can('settlement'));
create policy subs_write on public.subscriptions for all to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy invoices_all on public.invoices for all to authenticated
  using (public.can('settlement')) with check (public.can('settlement'));

/* ---------- serviceContent · settings : 홈페이지가 로그인 없이 읽습니다 ---------- */
create policy content_read on public.service_content for select to anon, authenticated
  using (true);
create policy content_write on public.service_content for all to authenticated
  using (public.can('services')) with check (public.can('services'));

create policy settings_read on public.settings for select to anon, authenticated
  using (true);
create policy settings_write on public.settings for all to authenticated
  using (public.can('settings')) with check (public.can('settings'));
