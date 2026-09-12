/* =========================================================
   Supabase 설정
   =========================================================

   이 값이 채워져 있으면 Supabase(Postgres + Auth + Storage)로 동작합니다.
   비워두면 브라우저 저장소를 쓰는 "로컬 데모 모드"로 동작합니다.
   (로컬 모드에서도 모든 화면과 기능을 그대로 사용해 볼 수 있습니다.)

   ---------------------------------------------------------
   여기 적힌 키는 공개해도 되는 값입니다
   ---------------------------------------------------------
   publishable(anon) 키는 브라우저에 그대로 나가는 것을 전제로 만들어진 키입니다.
   실제 접근 제어는 데이터베이스의 RLS 정책이 합니다 — supabase.sql 참고.
   반대로 service_role 키는 RLS 를 통째로 무시하므로 절대 이 파일에 넣지 마세요.

   ---------------------------------------------------------
   설정 방법
   ---------------------------------------------------------
   1) https://supabase.com/dashboard 에서 프로젝트 생성
   2) SQL Editor 에 저장소의 supabase.sql 내용을 붙여넣고 실행
        · 표 · 접근 규칙(RLS) · 저장소 버킷이 한 번에 만들어집니다
   3) Project Settings → API 에서 아래 두 값을 복사해 넣기
        · Project URL
        · publishable key (sb_publishable_... 또는 anon key)
   4) Authentication → Providers
        · Email 사용 설정, "Confirm email" 은 끄기
          (가입하자마자 신청서를 이어서 제출하는 흐름이라 확인 메일을 기다리면 끊깁니다)
        · (선택) Google 사용 설정
   5) Authentication → URL Configuration
        · Site URL 과 Redirect URLs 에 배포 주소를 넣기 (구글 로그인에 필요)
   6) 첫 최고관리자 지정 — 가입한 뒤 SQL Editor 에서 한 줄:
        update public.users set role = 'owner', approved = true
        where email = '본인이메일@example.com';
   ========================================================= */

window.SUPABASE_CONFIG = {
  url: 'https://tbxosynzszcgtieonsui.supabase.co',
  anonKey: 'sb_publishable_cdMCKXcHMpIaHqLT5uvs0w_5SwIRGgt',
};
