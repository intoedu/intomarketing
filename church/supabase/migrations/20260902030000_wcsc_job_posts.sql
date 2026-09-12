-- =========================================================
-- 교역자 구인 공고 (job_posts)
--
-- 지금까지는 교회가 조건을 알려 주면 센터가 사람을 찾아 이어 주는
-- 방식이었습니다. 그러면 센터가 아는 사람 안에서만 이어집니다.
-- 그래서 공고를 열어 두고 사역자가 직접 보고 연락하도록 바꿉니다 —
-- 특히 멀어서 사람 구하기 어려운 교회일수록 이 편이 낫습니다.
--
-- 지원은 아직 사이트 안에서 받지 않습니다.
--   공고에 적힌 연락처로 직접 연락합니다. 지원서를 사이트에 받으면
--   센터가 지원자 개인정보의 보관·파기 책임을 지게 되므로,
--   처리방침과 보관 기간을 정한 뒤에 붙이기로 했습니다.
--   그때를 위해 apply_mode 칸만 미리 두었습니다 ('contact' → 'onsite').
--
-- 사례비 · 사택 · 교통을 따로 칸으로 받는 이유
--   "협의" 한 줄만 있는 공고는 멀리 있는 사역자가 판단을 못 합니다.
--   갈지 말지를 정하는 건 결국 이 셋이라, 눈에 띄게 적게 했습니다.
-- =========================================================

create table public.job_posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_email      text not null default '',
  status          text not null default 'pending'
                  check (status in ('pending','published','rejected','hidden','done')),

  -- 어느 교회인가
  church_name     text not null default '',
  denomination    text not null default '',
  church_size     text not null default '',   -- 출석 교인 수 (구간)
  region          text not null default '',
  address_rough   text not null default '',

  -- 어떤 자리인가
  title           text not null default '',
  position        text not null default 'assistant',   -- 직분
  position_other  text not null default '',
  department      text not null default '',            -- 맡을 부서
  employment      text not null default 'full'
                  check (employment in ('full','part','weekend','short')),
  headcount       integer not null default 1,

  -- 사례비 — 멀리 있는 사역자가 가장 먼저 보는 값입니다
  pay_type        text not null default 'monthly'
                  check (pay_type in ('monthly','weekly','per_service','negotiable')),
  pay_min         bigint not null default 0,
  pay_max         bigint not null default 0,
  pay_note        text not null default '',
  housing         text not null default 'none'
                  check (housing in ('none','provided','support','negotiable')),
  insurance       boolean not null default false,

  -- 오가는 일 — "가기 어려운 곳" 을 숨기지 않고 미리 알리기 위한 칸들
  commute_note    text not null default '',   -- 가까운 역 · 터미널, 차량 필요 여부
  work_days       text not null default '',   -- 주일만 · 주중 포함 등
  start_date      text not null default '',   -- 부임 희망 시기
  closes_at       text not null default '',   -- 모집 마감 (비면 구할 때까지)

  -- 내용
  qualification   text not null default '',   -- 바라는 자격 · 경험
  "desc"          text not null default '',   -- 교회 소개와 하실 일
  photos          jsonb not null default '[]'::jsonb,

  -- 연락 (지금은 여기로 직접 지원합니다)
  contact_name    text not null default '',
  contact_phone   text not null default '',
  contact_email   text not null default '',
  contact_hours   text not null default '',

  -- 나중에 사이트 안 지원을 열 때 씁니다
  apply_mode      text not null default 'contact'
                  check (apply_mode in ('contact','onsite')),

  reject_note     text not null default '',
  views           integer not null default 0,
  reviewed_by     text not null default '',
  reviewed_at     text not null default '',
  published_at    text not null default '',
  hidden_at       text not null default '',
  sample          boolean not null default false,
  created_at      text not null default '',
  updated_at      text not null default '',
  inserted_at     timestamptz not null default now()
);

create index job_posts_status_idx on public.job_posts (status);
create index job_posts_user_id_idx on public.job_posts (user_id);
create index job_posts_region_idx on public.job_posts (region);

comment on table public.job_posts is
  '교역자 구인 공고. 지원은 공고에 적힌 연락처로 직접 합니다 (사이트 안 지원은 아직 열지 않았습니다).';
comment on column public.job_posts.apply_mode is
  '지원 방식. 지금은 contact 뿐입니다. 사이트 안 지원을 열 때 onsite 를 씁니다.';

-- =========================================================
-- 접근 규칙 — 다른 게시판과 같은 흐름입니다
-- =========================================================
alter table public.job_posts enable row level security;

create policy jobs_read_public on public.job_posts for select to anon, authenticated
  using (status = 'published');

create policy jobs_read_own on public.job_posts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy jobs_insert on public.job_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by = ''
    and published_at = ''
  );

-- 고치면 다시 확인을 받습니다. 다만 '모집 완료'로 내리는 것은 언제든 됩니다 —
-- 사람을 구했는지 가장 먼저 아는 쪽은 교회입니다.
create policy jobs_update_own on public.job_posts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('pending', 'done'));

create policy jobs_update_staff on public.job_posts for update to authenticated
  using (public.can('customers')) with check (public.can('customers'));

create policy jobs_delete on public.job_posts for delete to authenticated
  using (user_id = (select auth.uid()) or public.can('customers'));

alter publication supabase_realtime add table public.job_posts;
