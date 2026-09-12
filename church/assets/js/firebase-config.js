/* =========================================================
   Firebase 설정
   =========================================================

   아래 값을 채우면 Firebase(Firestore + Authentication)로 동작합니다.
   비워두면 브라우저 저장소를 쓰는 "로컬 데모 모드"로 동작합니다.
   (로컬 모드에서도 모든 화면과 기능을 그대로 사용해 볼 수 있습니다.)

   ---------------------------------------------------------
   설정 방법
   ---------------------------------------------------------
   1) https://console.firebase.google.com 에서 프로젝트 생성
   2) 좌측 [빌드] → [Authentication] → 시작하기
        · [이메일/비밀번호] 사용 설정
        · (선택) [Google] 사용 설정
   3) 좌측 [빌드] → [Firestore Database] → 데이터베이스 만들기
        · 위치: asia-northeast3 (서울) 권장
        · 규칙은 이 저장소의 firestore.rules 내용을 붙여넣기
   4) [프로젝트 설정] → [내 앱] → 웹 앱 추가(</> 아이콘)
        · 표시되는 firebaseConfig 값을 아래에 그대로 붙여넣기
   5) [Authentication] → [설정] → [승인된 도메인] 에
        배포 주소(예: intoedu.github.io)를 추가

   ※ 이 값들은 공개되어도 되는 식별자입니다. 비밀 키가 아닙니다.
      실제 보안은 firestore.rules 로 처리합니다.
   ---------------------------------------------------------

   ⚠ 첫 관리자 계정 만들기
   Firebase 연결 후 처음 회원가입한 계정은 "승인 대기" 상태입니다.
   Firestore 콘솔에서 users 컬렉션의 해당 문서를 찾아
     role: "owner", approved: true
   로 직접 바꿔주세요. 이후부터는 그 계정으로 다른 직원을 승인할 수 있습니다.
*/

window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCe6VkSMUC_etFLnsGn96oTOPLQJ4Yfo58',
  authDomain: 'caps-4e079.firebaseapp.com',
  projectId: 'caps-4e079',
  storageBucket: 'caps-4e079.firebasestorage.app',
  messagingSenderId: '111846219367',
  appId: '1:111846219367:web:1d1a0dea68c54ec032fec2',
  // measurementId 는 Google 애널리틱스용입니다. 이 사이트에서는 사용하지 않습니다.
  measurementId: 'G-61JXH58N7R',
};

/* 센터 운영 관련 기본값 */
window.CAPS_APP_CONFIG = {
  // 회원가입 시 이 도메인 이메일은 자동으로 '직원' 후보로 표시됩니다 (승인은 여전히 필요).
  staffEmailDomains: ['caps.or.kr', 'intoedu.co.kr'],
  // 정산 화면 기본 통화 표기
  currency: '원',
};
