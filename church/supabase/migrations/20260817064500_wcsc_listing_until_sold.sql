-- =========================================================
-- 매물 게시 기간 — 90일에서 "팔릴 때까지"로
--
-- 기간을 두지 않으니, 대신 끝나는 자리가 필요합니다.
-- 거래가 끝나면 내리는 상태(done, '거래 완료')를 추가합니다.
--
-- 누가 내리는가 —
--   팔린 것을 가장 먼저 아는 사람은 등록자입니다. 센터가 알 방법이 없으니
--   등록자가 직접 내릴 수 있어야 합니다. 그래서 등록자에게 done 으로
--   바꿀 권한을 줍니다. 대신 done 에서 다시 published 로 올릴 수는 없습니다
--   (다시 올리려면 pending 으로 돌아가 재검토를 받습니다).
--
-- 옛 expired 는 지우지 않고 남깁니다 — 기간 제한이 있던 때의 글이
-- 남아 있을 수 있고, 상태 값을 없애면 그 글을 읽을 수 없게 됩니다.
-- =========================================================

alter table public.listings drop constraint if exists listings_status_check;

alter table public.listings add constraint listings_status_check
  check (status in (
    'pending',           -- 승인 대기
    'awaiting_payment',  -- 입금 대기
    'published',         -- 게시중 (기한 없음 — 팔릴 때까지)
    'rejected',          -- 반려
    'hidden',            -- 센터가 내림
    'done',              -- 거래 완료 (등록자 또는 센터가 내림)
    'expired'            -- (옛 기간 제한 시절의 글)
  ));

comment on column public.listings.expires_at is
  '더 쓰지 않습니다. 게시는 거래가 끝날 때까지 유지됩니다 (옛 글 호환용).';

/* 등록자가 자기 글을 '거래 완료'로 내릴 수 있게 합니다.
   내용을 고치면 지금처럼 pending 으로 돌아가 재검토를 받습니다. */
drop policy if exists listings_update_own on public.listings;

create policy listings_update_own on public.listings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and status in ('pending', 'done')
  );
