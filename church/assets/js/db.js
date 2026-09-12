/* =========================================================
   CAPS 데이터 계층 (window.CAPSDB)
   =========================================================
   두 가지 백엔드를 같은 API로 감쌉니다.

   · firebase — assets/js/firebase-config.js 에 설정을 채운 경우
   · local    — 설정이 비어 있으면 브라우저 저장소 사용 (데모)

   화면 코드는 둘의 차이를 몰라도 됩니다. 모두 Promise 를 반환합니다.
   ========================================================= */

window.CAPSDB = (function () {
  'use strict';

  /* ---------------- 상수 ---------------- */

  var ROLES = {
    owner: { label: '최고관리자', rank: 4 },
    admin: { label: '관리자', rank: 3 },
    staff: { label: '직원', rank: 2 },
    client: { label: '고객', rank: 1 },
  };

  var PERMS = {
    requests: '신청·의뢰 관리',
    services: '지원 항목 수정',
    customers: '고객·구독 관리',
    settlement: '정산 관리',
    members: '직원 승인·권한 관리',
    settings: '센터 설정',
  };

  var COLLECTIONS = ['users', 'requests', 'customers', 'subscriptions', 'invoices',
    'serviceContent', 'settings', 'editConsents', 'listings',
    'marketItems', 'installRequests', 'guestHouses', 'events', 'ticketOrders',
    'payments', 'jobPosts', 'searchLogs'];

  /* 교회가 알려준 정보 — 고치려면 그 교회의 승인이 필요합니다.
     (firestore.rules 의 churchInfoFields() 와 같은 목록을 유지해야 합니다) */
  var CHURCH_FIELDS = {
    name: '교회명',
    denomination: '교단',
    location: '소재지',
    size: '출석 교인 수',
    contactName: '담당자 성함',
    contactRole: '담당자 직분',
    phone: '연락처',
    email: '이메일',
  };

  var CONSENT_STATUS = {
    pending: '승인 대기',
    approved: '수정 가능',
    rejected: '거절',
    used: '수정 완료',
    canceled: '요청 취소',
    expired: '기한 지남',
  };

  /** 승인 후 수정할 수 있는 기간 (일) */
  var CONSENT_DAYS = 7;

  var REQUEST_STATUS = {
    received: '접수',
    consulting: '상담중',
    proposed: '견적 발송',
    progress: '진행중',
    hold: '보류',
    done: '완료',
    canceled: '취소',
  };

  var SUB_STATUS = { active: '이용중', paused: '일시정지', ended: '종료' };

  /* 회원가입 · 내 정보 · 고객 관리에서 함께 쓰는 직분 목록.
     '기타'를 고르면 직접 입력칸이 열립니다. */
  var ROLE_OPTIONS = [
    '담임목사', '부목사', '전도사', '장로', '권사', '집사', '행정 간사', '성도', '기타',
  ];

  /* =========================================================
     부동산 매물 게시판 (listings)

     센터가 하는 일은 딱 하나입니다 — 게시판을 관리하는 것.
     중개·상담·계약은 하지 않으며, 글은 등록자가 직접 씁니다.
     대신 아무나 남의 건물을 올리지 못하도록,
     등록할 때 권리 증빙(임대차계약서 · 등기부등본 등)을 받습니다.
     ========================================================= */

  var LISTING_STATUS = {
    pending: '승인 대기',
    // 저장되는 값은 아니고, 화면에서만 쓰는 이름입니다.
    // pending 이면서 전에 승인받은 적이 있는 글 = 수정 재검토입니다.
    edit_pending: '수정 승인 요청',
    awaiting_payment: '입금 대기',
    published: '게시중',
    rejected: '반려',
    hidden: '게시 중지',
    done: '거래 완료',
    // 게시 기간을 두던 때의 글입니다. 지금은 기한이 없습니다.
    expired: '기간 지남',
  };

  var LISTING_KIND = {
    rent_monthly: '월세',
    rent_jeonse: '전세',
    sale: '매매',
    share: '공간 공유 · 대여',
  };

  /** 등록자가 이 매물에 대해 어떤 사람인지 */
  var LISTING_HOLDER = {
    owner: '소유자 (임대인)',
    tenant: '임차인 (현재 세입자)',
    agent: '위임받은 대리인',
  };

  /** 권리 증빙으로 받을 수 있는 서류 */
  var LISTING_PROOFS = {
    deed: '등기부등본 (부동산 등기사항증명서)',
    lease: '임대차계약서',
    sale: '매매계약서',
    delegation: '위임장 (+ 위임인 신분 확인)',
    other: '그 외 권리를 확인할 수 있는 서류',
  };

  /** 증빙 서류별로 어떤 입장에서 쓰는 것인지 안내 */
  var PROOF_FOR = {
    owner: ['deed', 'sale', 'other'],
    tenant: ['lease', 'other'],
    agent: ['delegation', 'deed', 'lease', 'other'],
  };

  /** 주 용도 — '기타'를 고르면 직접 입력칸이 열립니다. */
  var LISTING_USES = {
    church: '교회',
    education: '교육관',
    prayer: '기도원',
    retreat: '수양관',
    land: '종교부지',
    other: '기타',
  };

  var LISTING_REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북',
    '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];

  /** 제목 예시 — 보는 사람이 한 줄로 판단할 수 있게 쓰도록 돕습니다. */
  var LISTING_TITLE_EXAMPLES = [
    '뷰가 좋은 3층 예배실 — 한강 조망, 주차 12대',
    '지하철 5분 · 주차 8대, 2층 예배 공간 65평',
    '리모델링 완료된 교육관 — 소그룹실 3칸',
    '단독 건물 전체, 사택 포함 (즉시 입주)',
    '상가 1층 · 간판 설치 가능, 유동인구 많은 자리',
  ];

  /** 연락 가능 시간 예시 */
  var LISTING_HOURS_EXAMPLES = [
    '평일 09:00 – 18:00',
    '평일 · 토요일 10:00 – 20:00 (주일 제외)',
    '주일 오후 제외 언제든',
    '문자 남겨주시면 회신드립니다',
  ];

  /** 게시 등록비 (원) — 게시판에 올려 드리는 비용이며 중개 수수료가 아닙니다. */
  var LISTING_FEE = 60000;

  /** 기본 게시 기간 (일) */
  /* 게시 기간 — 0 은 "기한 없음" 입니다.
     거래가 끝날 때까지 올려 두고, 팔리면 등록자나 센터가 내립니다.
     (예전에는 90일이 지나면 자동으로 내려갔습니다) */
  var LISTING_DAYS = 0;

  /** 증빙 파일 제한 — storage.rules 와 같은 값을 유지해야 합니다. */
  var PROOF_MAX_BYTES = 10 * 1024 * 1024;
  var PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

  /* 매물 사진 — 게시판에 그대로 공개됩니다 (증빙 서류와 달리).
     올릴 때 브라우저에서 긴 변 1600px · JPEG 로 줄이므로 용량 걱정이 줄어듭니다. */
  var PHOTO_MAX_COUNT = 10;
  // 권장 범위입니다 — 막는 값이 아닙니다. 실제 제한은 PHOTO_MAX_COUNT 하나뿐입니다.
  var PHOTO_MIN_HINT = 5;
  var PHOTO_REC_TOP = 7;
  var PHOTO_MAX_BYTES = 15 * 1024 * 1024; // 줄이기 전 원본 기준
  var PHOTO_LONG_EDGE = 1600;
  var PHOTO_QUALITY = 0.82;

  /* =========================================================
     중고 장터 (marketItems) · 게스트하우스 (guestHouses) ·
     집회 티켓팅 (events · ticketOrders)

     교역자를 돕는다는 뼈대는 그대로입니다. 다만 물건을 사고파는 일,
     방을 내어 주는 일, 집회에 신청하는 일은 교역자만의 일이 아니라
     성도가 함께 하는 일이라, 세 갈래는 로그인한 누구에게나 열려 있습니다.
     ========================================================= */

  /* ---------- 중고 장터 ---------- */

  var MARKET_STATUS = {
    pending: '확인 대기',
    published: '판매중',
    rejected: '반려',
    hidden: '게시 중지',
    done: '거래 완료',
  };

  /* '기타'를 고르면 직접 입력칸이 열립니다.
     (build.js 의 장터 갈래 목록과 같은 값을 유지해야 합니다) */
  var MARKET_CATEGORIES = {
    sound: '음향 (스피커 · 믹서 · 앰프)',
    mic: '마이크 · 무선',
    instrument: '악기',
    video: '영상 · 프로젝터',
    light: '조명',
    furniture: '집기 (강대상 · 의자 · 장의자)',
    office: '사무 · 전산',
    kitchen: '주방 · 식당',
    education: '교육 · 유아부',
    other: '기타',
  };

  /* 센터가 설치를 맡는 갈래 — 여기에 드는 물건은 등록 화면에서
     "설치까지 맡기시겠어요?" 를 먼저 묻습니다. */
  var MARKET_INSTALLABLE = ['sound', 'mic', 'video', 'light'];

  var MARKET_CONDITION = {
    new: '미개봉',
    like_new: '거의 새것',
    good: '상태 좋음',
    used: '사용감 있음',
    broken: '고장 · 부품용',
  };

  var MARKET_DELIVERY = {
    pickup: '직접 가지러 오셔야 합니다',
    deliver: '보내 드릴 수 있습니다',
    both: '직접 오셔도, 보내 드려도 됩니다',
  };

  /* 설치 대행 — 센터가 따로 비용을 받고 맡는 일입니다.
     값은 대표님이 정하십니다. price 를 비워 두면 화면에 [상담 후 견적] 으로 나옵니다.
     (src/data/site.js 의 marketBoard.install 과 같은 값을 유지해야 합니다) */
  var INSTALL_TIERS = {
    pickup: { label: '운반만', price: 0,
      desc: '판매자 교회에서 싣고 와 사시는 교회 앞까지 내려 드립니다.' },
    install: { label: '설치 · 배선', price: 0,
      desc: '거치 · 배선 · 전원 정리까지. 소리가 나는 상태로 넘겨 드립니다.' },
    tuning: { label: '설치 + 음향 튜닝', price: 0,
      desc: '예배당에서 실제로 소리를 잡아 드립니다 (하울링 · 이퀄라이징 · 프리셋 저장).' },
  };

  var INSTALL_STATUS = {
    received: '접수',
    quoted: '견적 발송',
    scheduled: '일정 확정',
    done: '설치 완료',
    canceled: '취소',
  };

  /* ---------- 교회 게스트하우스 ---------- */

  var GUEST_STATUS = {
    pending: '확인 대기',
    published: '모집중',
    rejected: '반려',
    hidden: '게시 중지',
    done: '마감',
  };

  var GUEST_ROOM_TYPE = {
    private: '독립된 방 하나',
    share: '방을 함께 씁니다',
    whole: '집 전체',
    dorm: '여러 명이 쓰는 방',
  };

  var GUEST_BATH = {
    private: '방 안 화장실',
    shared: '함께 쓰는 화장실',
  };

  /* 누가 머무를 수 있는지 — 여러 개 고를 수 있습니다. */
  var GUEST_TYPES = {
    missionary: '해외 선교사 · 사역자',
    pastor: '방문 교역자',
    student: '유학생 · 신학생',
    family: '가족 단위',
    team: '단기선교팀 · 청년팀',
    anyone: '성도 누구나',
  };

  var GUEST_AMENITIES = {
    wifi: '와이파이',
    kitchen: '주방 사용',
    laundry: '세탁기',
    aircon: '에어컨',
    heating: '난방',
    desk: '책상',
    parking: '주차',
    bedding: '이불 · 침구 제공',
    bath_item: '세면도구',
    elevator: '엘리베이터',
  };

  var GUEST_LANGUAGES = ['한국어', 'English', '中文', '日本語', 'Español', 'Русский'];

  /* ---------- 집회 · 찬양집회 티켓팅 ---------- */

  var EVENT_STATUS = {
    pending: '확인 대기',
    published: '신청 받는 중',
    closed: '마감',
    rejected: '반려',
    hidden: '게시 중지',
    done: '종료',
  };

  var EVENT_CATEGORIES = {
    praise: '찬양집회',
    revival: '부흥회 · 사경회',
    camp: '수련회 · 캠프',
    seminar: '세미나 · 컨퍼런스',
    concert: '음악회 · 공연',
    prayer: '기도회',
    youth: '청년 · 청소년',
    other: '기타',
  };

  var TICKET_STATUS = {
    confirmed: '신청 완료',
    checked_in: '입장 확인',
    canceled: '취소',
  };

  /* ---------- 교역자 구인 공고 ---------- */

  var JOB_STATUS = {
    pending: '확인 대기',
    published: '모집중',
    rejected: '반려',
    hidden: '게시 중지',
    done: '모집 완료',
  };

  /* '기타'를 고르면 직접 입력칸이 열립니다. */
  var JOB_POSITIONS = {
    senior: '담임목사',
    associate: '부목사',
    assistant: '전도사',
    education: '교육전도사',
    worship: '찬양인도자',
    pianist: '반주자',
    staff: '행정 간사',
    other: '기타',
  };

  var JOB_EMPLOYMENT = {
    full: '전임',
    part: '파트',
    weekend: '주말 사역',
    short: '단기 · 대체',
  };

  var JOB_PAY_TYPE = {
    monthly: '월 사례비',
    weekly: '주 단위',
    per_service: '집회 · 예배 건별',
    negotiable: '면접 후 협의',
  };

  /* 사택은 갈지 말지를 가르는 조건이라 따로 받습니다. */
  var JOB_HOUSING = {
    provided: '사택 제공',
    support: '주거비 지원',
    negotiable: '협의',
    none: '없음',
  };

  var JOB_DEPARTMENTS = ['영아 · 유아부', '유치부', '유년 · 초등부', '중고등부',
    '청년부', '장년 · 남녀전도회', '찬양팀', '전체 · 협력', '기타'];

  var JOB_SIZES = ['50명 미만', '50~150명', '150~500명', '500~1,000명', '1,000명 이상'];

  /** 구인 공고 사진 최대 장수 */
  var JOB_PHOTO_MAX = 10;

  /** 집회 사진 최대 장수 — 포스터를 여러 장 올리는 집회가 많아 넉넉히 둡니다. */
  var EVENT_PHOTO_MAX = 20;
  /** 장터 · 게스트하우스 사진 최대 장수 */
  var MARKET_PHOTO_MAX = 12;
  var GUEST_PHOTO_MAX = 15;

  /* ---------------- 공통 유틸 ---------------- */

  /**
   * 저장소에 쓸 파일 이름을 만듭니다.
   *
   * Supabase Storage 는 키에 영문 · 숫자 · 몇 가지 기호만 받습니다.
   * `카카오톡_사진.jpg` · `스크린샷 2026년 8월.png` 처럼 한글이 든 이름은
   * "Invalid key" 로 거부되는데, 우리 화면에서는 그 사진 한 장만 조용히
   * 빠진 것처럼 보여 원인을 찾기 어렵습니다.
   *
   * 그래서 키에서는 한글을 빼고, 사람이 보는 이름(name)은 원본 그대로 둡니다.
   * 이름이 통째로 한글이면 남는 게 확장자뿐이라, 그때는 'file' 을 붙여 줍니다.
   */
  function safeKey(name, fallbackExt) {
    var raw = String(name || '');
    var dot = raw.lastIndexOf('.');
    var ext = dot > 0 ? raw.slice(dot + 1) : '';
    var base = dot > 0 ? raw.slice(0, dot) : raw;

    var clean = function (s) { return s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-'); };

    base = clean(base).replace(/^[-.]+|[-.]+$/g, '').slice(0, 60);
    ext = clean(ext).toLowerCase().slice(0, 8) || String(fallbackExt || '');

    if (!base) base = 'file';
    return ext ? base + '.' + ext : base;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function makeCode() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return 'CAPS-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) +
      '-' + String(Math.floor(1000 + Math.random() * 9000));
  }

  /** Firebase 설정이 채워져 있는지 (옛 백엔드) */
  function isConfigured() {
    var c = window.FIREBASE_CONFIG || {};
    return !!(c.apiKey && c.projectId && c.authDomain);
  }

  /** Supabase 설정이 채워져 있는지 (기본 백엔드) */
  function hasSupabase() {
    var c = window.SUPABASE_CONFIG || {};
    return !!(c.url && c.anonKey);
  }

  /** 문서 목록에 정렬·필터 적용 (두 어댑터 공통) */
  function applyQuery(rows, opts) {
    var o = opts || {};
    var out = rows.slice();
    if (o.where) {
      Object.keys(o.where).forEach(function (key) {
        var want = o.where[key];
        out = out.filter(function (r) {
          if (Array.isArray(r[key])) return r[key].indexOf(want) > -1;
          return r[key] === want;
        });
      });
    }
    var field = o.orderBy || 'createdAt';
    var dir = o.desc === false ? 1 : -1;
    out.sort(function (a, b) {
      var x = a[field], y = b[field];
      if (x === y) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x > y ? dir * 1 : dir * -1;
    });
    if (o.limit) out = out.slice(0, o.limit);
    return out;
  }

  /* =========================================================
     로컬 어댑터 (데모)
     ========================================================= */

  function LocalAdapter() {
    var PREFIX = 'caps.db.';
    var SESSION = 'caps.session';
    var listeners = {};

    function read(name) {
      try {
        var raw = window.localStorage.getItem(PREFIX + name);
        var v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    }

    function write(name, rows) {
      try {
        window.localStorage.setItem(PREFIX + name, JSON.stringify(rows));
      } catch (e) {
        /* 용량 초과 등은 무시 */
      }
      (listeners[name] || []).forEach(function (cb) {
        try { cb(rows.slice()); } catch (err) { /* 개별 리스너 오류 무시 */ }
      });
    }

    /* 데모 초기 데이터 */
    function seed() {
      // 판 번호를 올리면 데모 데이터가 새 구조로 다시 깔립니다.
      if (window.localStorage.getItem(PREFIX + '__seeded') === '2') return;
      window.localStorage.setItem(PREFIX + '__seeded', '2');

      write('users', [
        {
          id: 'demo-owner', email: 'admin@caps.or.kr', password: 'caps1234',
          name: '관리자', phone: '02-0000-0000', role: 'owner', approved: true,
          church: '우리교회지원센터', contactRole: '행정 간사', birthDate: '',
          perms: {}, createdAt: nowIso(),
        },
      ]);

      var d = function (days) {
        return new Date(Date.now() - days * 864e5).toISOString();
      };

      write('customers', [
        { id: 'cust-1', name: '은혜로교회', denomination: '예장합동', contactName: '김은혜', contactRole: '담임목사',
          phone: '010-2222-3333', email: 'grace@example.com', location: '경기 성남시 분당구', size: '150~500명',
          memo: '홈페이지 오픈 후 주보 정기 제작까지 이어짐.', createdAt: d(120) },
        { id: 'cust-2', name: '한빛교회', denomination: '기장', contactName: '박한빛', contactRole: '행정 간사',
          phone: '010-4444-5555', email: 'hanbit@example.com', location: '서울 은평구', size: '50~150명',
          memo: '', createdAt: d(64) },
        { id: 'cust-3', name: '샘물교회', denomination: '예장통합', contactName: '이샘물', contactRole: '장로',
          phone: '010-6666-7777', email: 'well@example.com', location: '부산 해운대구', size: '500~1,000명',
          memo: '음향 진단 후 장비 일부 교체 예정.', createdAt: d(28) },
      ]);

      write('subscriptions', [
        { id: 'sub-1', customerId: 'cust-1', serviceId: 'design', plan: '주보 정기 제작 (주 300부)',
          monthlyFee: 350000, status: 'active', startDate: d(100).slice(0, 10), billingDay: 5, memo: '', createdAt: d(100) },
        { id: 'sub-2', customerId: 'cust-1', serviceId: 'homepage', plan: '홈페이지 유지관리',
          monthlyFee: 80000, status: 'active', startDate: d(90).slice(0, 10), billingDay: 5, memo: '', createdAt: d(90) },
        { id: 'sub-3', customerId: 'cust-2', serviceId: 'intooffice', plan: '인투오피스 (월 구독)',
          monthlyFee: 6900, status: 'active', startDate: d(60).slice(0, 10), billingDay: 10, memo: '', createdAt: d(60) },
        { id: 'sub-4', customerId: 'cust-3', serviceId: 'smartchurch', plan: '스마트처치 앱 (500~1,000명)',
          monthlyFee: 200000, status: 'paused', startDate: d(25).slice(0, 10), billingDay: 1,
          memo: '앱 오픈 준비 중 — 다음 달부터 청구', createdAt: d(25) },
      ]);

      write('requests', [
        { id: 'req-1', code: 'CAPS-260806-1204', createdAt: d(7), status: 'received',
          services: ['homepage', 'design'], church_name: '새순교회', denomination: '예장합동',
          contact_name: '조수아', contact_role: '전도사', phone: '010-5555-1234', email: 'saesoon@example.com',
          location: '대전 유성구', size: '50~150명', budget: '300~1,000만원', timeline: '3개월 이내',
          message: '홈페이지가 5년째 방치되어 있고, 주보도 담당 집사님이 혼자 만들고 계십니다.',
          prefer: '전화', marketing: false, extra: {}, assignee: '', memo: '', tasks: [] },
        { id: 'req-2', code: 'CAPS-260804-3391', createdAt: d(9), status: 'consulting',
          services: ['sound'], church_name: '주찬양교회', denomination: '',
          contact_name: '이예은', contact_role: '집사', phone: '010-4040-2270', email: '',
          location: '광주 서구', size: '150~500명', budget: '아직 정하지 못했습니다', timeline: '가능한 빨리',
          message: '뒷자리에서 설교가 잘 들리지 않고 찬양 때 하울링이 심합니다.',
          prefer: '문자/카카오톡', marketing: true,
          extra: { sound__sanctuary_size: '150~300석', sound__sound_issue: '뒷자리 전달력 부족, 하울링' },
          assignee: 'demo-owner', memo: '현장 방문 일정 조율 중 (다음 주 화요일 예정).',
          tasks: [{ text: '현장 방문 진단', done: true }, { text: '진단 보고서 작성', done: false }] },
        { id: 'req-3', code: 'CAPS-260728-8820', createdAt: d(16), status: 'progress',
          services: ['sound'], church_name: '한빛교회', denomination: '기장',
          contact_name: '박한빛', contact_role: '행정 간사', phone: '010-4444-5555', email: 'hanbit@example.com',
          location: '서울 은평구', size: '50~150명', budget: '', timeline: '1개월 이내',
          message: '교육 전도사 청빙 공고를 부탁드립니다.', prefer: '이메일', marketing: false,
          extra: {},
          assignee: 'demo-owner', memo: '공고 배포 완료. 지원자 3명 정리 중.',
          tasks: [{ text: '공고문 작성', done: true }, { text: '공고 배포', done: true }, { text: '지원자 비교표 전달', done: false }],
          customerId: 'cust-2' },
      ]);

      /* 예시 글(lst-0)은 "이렇게 쓰시면 됩니다" 를 보여 주는 견본입니다.
         제목 · 연락 가능 시간 · 사진까지 모두 채워 두었습니다. */
      var sampleShot = function (n) {
        return { path: '', url: 'assets/img/sample/listing-' + n + '.svg',
          name: '예시 이미지 ' + n + '.svg', size: 0, sample: true };
      };

      write('listings', [
        { id: 'lst-0', userId: 'demo-owner', status: 'published', sample: true,
          kind: 'rent_monthly', holder: 'owner', use: 'church', useOther: '',
          title: '뷰가 좋은 3층 예배실 — 한강 조망, 주차 12대',
          region: '서울', addressRough: '서울 광진구 자양동',
          area: '82평 (271㎡)', floor: '3층 / 7층 (엘리베이터)', parking: '12대 (주일 인근 공영주차장 무료)',
          deposit: 50000000, monthly: 3800000, salePrice: 0, maintenance: 320000,
          moveIn: '즉시 입주 가능 (협의 시 6월 이후도 가능)',
          religiousUse: '건축물대장 종교집회장 — 용도 변경 없이 바로 사용 가능',
          desc: '한강이 보이는 3층 전체입니다. 남향이라 오전 예배 때 조명을 거의 켜지 않아도 됩니다.\n\n'
            + '· 본당 250석 규모, 강단과 음향 배선이 그대로 남아 있습니다 (스피커 4조 포함 양도 가능)\n'
            + '· 유아실 1칸, 소그룹실 2칸, 사무실 1칸이 따로 있습니다\n'
            + '· 엘리베이터가 있어 어르신들 접근이 편합니다\n'
            + '· 같은 층에 다른 세대가 없어 찬양 시간 민원 걱정이 적습니다\n'
            + '· 지하철 2호선 구의역에서 걸어서 7분입니다\n\n'
            + '이전 교회가 더 큰 곳으로 옮기면서 내놓았습니다. 보증금과 월세는 조건에 따라 협의 가능합니다.',
          contactName: '김요한 장로', contactPhone: '010-2345-6789',
          contactHours: '평일 · 토요일 10:00 – 20:00 (주일 제외)',
          photos: [sampleShot(1), sampleShot(2), sampleShot(3), sampleShot(4)],
          proof: { path: 'demo/deed-0.pdf', name: '등기부등본.pdf', size: 268000, kind: 'deed', uploadedAt: d(12) },
          fee: { amount: LISTING_FEE, paid: true, paidAt: d(11), noticeSentAt: d(12), invoiceId: '' },
          rejectNote: '', views: 213,
          reviewedBy: 'demo-owner', reviewedAt: d(11), publishedAt: d(11),
          expiresAt: new Date(Date.now() + 79 * 864e5).toISOString(),
          hiddenAt: '', createdAt: d(12), updatedAt: d(11) },

        { id: 'lst-1', userId: 'demo-owner', status: 'published',
          kind: 'rent_monthly', holder: 'owner', use: 'church', useOther: '',
          title: '2층 예배실 (지하철 5분, 주차 8대)', region: '경기', addressRough: '경기 부천시 원미구',
          area: '65평 (215㎡)', floor: '2층 / 5층', parking: '8대',
          deposit: 30000000, monthly: 2200000, salePrice: 0, maintenance: 250000,
          moveIn: '협의 가능', religiousUse: '건물주 동의 완료 (종교시설 사용 가능)',
          desc: '기존 교회가 사용하던 공간으로 강단·음향 배선이 남아 있습니다.\n엘리베이터 있고, 주말 주차가 넉넉합니다.',
          contactName: '관리자', contactPhone: '02-0000-0000',
          contactHours: '평일 09:00 – 18:00',
          photos: [],
          proof: { path: 'demo/deed-1.pdf', name: '등기부등본.pdf', size: 214000, kind: 'deed', uploadedAt: d(20) },
          fee: { amount: LISTING_FEE, paid: true, paidAt: d(19), noticeSentAt: d(20), invoiceId: '' },
          rejectNote: '', views: 41,
          reviewedBy: 'demo-owner', reviewedAt: d(19), publishedAt: d(19),
          expiresAt: new Date(Date.now() + 70 * 864e5).toISOString(),
          hiddenAt: '', createdAt: d(20), updatedAt: d(19) },

        { id: 'lst-2', userId: 'demo-owner', status: 'pending',
          kind: 'rent_jeonse', holder: 'tenant', use: 'education', useOther: '',
          title: '교육관으로 쓰던 지하 1층 (전세)', region: '서울', addressRough: '서울 강북구 수유동',
          area: '40평 (132㎡)', floor: '지하 1층 / 4층', parking: '2대',
          deposit: 180000000, monthly: 0, salePrice: 0, maintenance: 120000,
          moveIn: '2026년 10월 이후', religiousUse: '건물주 확인 필요',
          desc: '소그룹실 3칸으로 나뉘어 있습니다. 계약 기간이 남아 승계 조건 협의 가능합니다.',
          contactName: '관리자', contactPhone: '02-0000-0000',
          contactHours: '주일 오후 제외 언제든',
          photos: [],
          proof: { path: 'demo/lease-2.pdf', name: '임대차계약서.pdf', size: 331000, kind: 'lease', uploadedAt: d(1) },
          fee: { amount: LISTING_FEE, paid: false, paidAt: '', noticeSentAt: '', invoiceId: '' },
          rejectNote: '', views: 0,
          reviewedBy: '', reviewedAt: '', publishedAt: '', expiresAt: '',
          hiddenAt: '', createdAt: d(1), updatedAt: d(1) },
      ]);

      write('invoices', []);
      write('serviceContent', []);
      write('settings', []);
    }

    /* 파일 (데모) — 사진과 증빙 서류를 브라우저에 담습니다.
       IndexedDB 를 씁니다. localStorage 는 5MB 남짓이라 휴대폰 사진 네댓 장이면
       꽉 차 버리는데, 그때 조용히 실패하면 "올렸습니다" 라고 해 놓고 빈 칸이
       나오기 때문입니다. IndexedDB 는 수백 MB 까지 들어갑니다.
       IndexedDB 를 못 쓰는 브라우저에서는 localStorage 로 물러서고,
       그 경우 용량이 넘치면 성공한 척하지 않고 오류를 냅니다. */
    var FILES = 'caps.files';
    var DB_NAME = 'caps.files.db';
    var DB_STORE = 'files';
    var idbReady = null;

    function openIdb() {
      if (idbReady) return idbReady;
      idbReady = new Promise(function (resolve) {
        if (!window.indexedDB) return resolve(null);
        var req;
        try {
          req = window.indexedDB.open(DB_NAME, 1);
        } catch (e) {
          return resolve(null);
        }
        req.onupgradeneeded = function () {
          if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      });
      return idbReady;
    }

    function idbRun(mode, fn) {
      return openIdb().then(function (idb) {
        if (!idb) return Promise.reject(new Error('no-idb'));
        return new Promise(function (resolve, reject) {
          var tx = idb.transaction(DB_STORE, mode);
          var req = fn(tx.objectStore(DB_STORE));
          tx.onabort = function () { reject(tx.error || new Error('저장 공간이 가득 찼습니다.')); };
          tx.onerror = function () { reject(tx.error || new Error('저장하지 못했습니다.')); };
          if (req) {
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
          } else {
            tx.oncomplete = function () { resolve(); };
          }
        });
      });
    }

    /* localStorage 쪽 (IndexedDB 를 못 쓸 때만) */
    function readFiles() {
      try {
        var raw = window.localStorage.getItem(FILES);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    var FULL_MSG =
      '브라우저 저장 공간이 가득 찼습니다. 데모 모드는 사진을 이 브라우저에만 담기 때문에 ' +
      '여러 장을 넣기 어렵습니다. 이미 올린 사진을 지우고 다시 시도하시거나, ' +
      '실제 운영 설정(Supabase)에서 올려 주세요.';

    /* ---- 인증 (데모) ---- */
    var authListeners = [];
    var session = null;

    function loadSession() {
      try {
        var raw = window.localStorage.getItem(SESSION);
        if (!raw) return null;
        var id = JSON.parse(raw).id;
        var found = read('users').filter(function (u) { return u.id === id; });
        return found.length ? found[0] : null;
      } catch (e) {
        return null;
      }
    }

    function publicUser(u) {
      if (!u) return null;
      var copy = Object.assign({}, u);
      delete copy.password;
      return copy;
    }

    function emitAuth() {
      authListeners.forEach(function (cb) {
        try { cb(publicUser(session)); } catch (e) { /* 무시 */ }
      });
    }

    function setSession(u) {
      session = u;
      if (u) window.localStorage.setItem(SESSION, JSON.stringify({ id: u.id }));
      else window.localStorage.removeItem(SESSION);
      emitAuth();
    }

    seed();
    session = loadSession();

    return {
      mode: 'local',

      auth: {
        current: function () { return publicUser(session); },
        onChange: function (cb) {
          authListeners.push(cb);
          cb(publicUser(session));
          return function () {
            authListeners = authListeners.filter(function (f) { return f !== cb; });
          };
        },
        signUp: function (data) {
          var users = read('users');
          var email = String(data.email || '').trim().toLowerCase();
          if (users.some(function (u) { return u.email.toLowerCase() === email; })) {
            return Promise.reject(new Error('이미 가입된 이메일입니다.'));
          }
          if (String(data.password || '').length < 6) {
            return Promise.reject(new Error('비밀번호는 6자 이상으로 입력해 주세요.'));
          }
          var isStaff = !!data.staffRequest;
          var user = {
            id: uid('user'), email: email, password: data.password,
            name: (data.name || '').trim(), phone: (data.phone || '').trim(),
            church: (data.church || '').trim(),
            contactRole: (data.contactRole || '').trim(),
            birthDate: (data.birthDate || '').trim(),
            role: isStaff ? 'staff' : 'client',
            approved: !isStaff, // 고객은 즉시 이용, 직원은 승인 대기
            perms: {}, createdAt: nowIso(),
          };
          users.push(user);
          write('users', users);
          setSession(user);
          return Promise.resolve(publicUser(user));
        },
        signIn: function (data) {
          var email = String(data.email || '').trim().toLowerCase();
          var found = read('users').filter(function (u) {
            return u.email.toLowerCase() === email && u.password === data.password;
          });
          if (!found.length) return Promise.reject(new Error('이메일 또는 비밀번호가 맞지 않습니다.'));
          setSession(found[0]);
          return Promise.resolve(publicUser(found[0]));
        },
        signInGoogle: function () {
          return Promise.reject(new Error('구글 로그인·가입은 Firebase 연결 후 사용할 수 있습니다. 데모 모드에서는 이메일로 가입해 주세요.'));
        },
        signOut: function () { setSession(null); return Promise.resolve(); },
        resetPassword: function () {
          return Promise.reject(new Error('비밀번호 재설정은 Firebase 연결 후 사용할 수 있습니다.'));
        },
        updateProfile: function (patch) {
          if (!session) return Promise.reject(new Error('로그인이 필요합니다.'));
          var users = read('users').map(function (u) {
            return u.id === session.id ? Object.assign(u, patch) : u;
          });
          write('users', users);
          setSession(users.filter(function (u) { return u.id === session.id; })[0]);
          return Promise.resolve(publicUser(session));
        },
        /** 로그인 방식 목록 — 데모는 이메일/비밀번호만 있습니다. */
        providers: function () { return session ? ['password'] : []; },
        changePassword: function (data) {
          if (!session) return Promise.reject(new Error('로그인이 필요합니다.'));
          var rows = read('users');
          var me = rows.filter(function (u) { return u.id === session.id; })[0];
          if (!me) return Promise.reject(new Error('계정을 찾을 수 없습니다.'));
          if (me.password !== data.current) {
            return Promise.reject(new Error('현재 비밀번호가 맞지 않습니다.'));
          }
          if (String(data.next || '').length < 6) {
            return Promise.reject(new Error('새 비밀번호는 6자 이상으로 입력해 주세요.'));
          }
          me.password = data.next;
          write('users', rows);
          return Promise.resolve();
        },
      },

      list: function (name, opts) {
        return Promise.resolve(applyQuery(read(name), opts));
      },
      get: function (name, id) {
        var found = read(name).filter(function (r) { return r.id === id; });
        return Promise.resolve(found.length ? found[0] : null);
      },
      add: function (name, data) {
        var rows = read(name);
        var row = Object.assign({ id: uid(name.slice(0, 3)), createdAt: nowIso() }, data);
        rows.push(row);
        write(name, rows);
        return Promise.resolve(row);
      },
      set: function (name, id, data) {
        var rows = read(name);
        var row = Object.assign({ id: id }, data);
        var i = rows.findIndex(function (r) { return r.id === id; });
        if (i > -1) rows[i] = row; else rows.push(row);
        write(name, rows);
        return Promise.resolve(row);
      },
      update: function (name, id, patch) {
        var rows = read(name).map(function (r) {
          return r.id === id ? Object.assign({}, r, patch) : r;
        });
        write(name, rows);
        return Promise.resolve();
      },
      remove: function (name, id) {
        write(name, read(name).filter(function (r) { return r.id !== id; }));
        return Promise.resolve();
      },
      watch: function (name, cb) {
        listeners[name] = listeners[name] || [];
        listeners[name].push(cb);
        cb(read(name));
        return function () {
          listeners[name] = listeners[name].filter(function (f) { return f !== cb; });
        };
      },

      files: {
        upload: function (path, file) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
            reader.readAsDataURL(file);
          }).then(function (url) {
            var rec = { name: file.name, size: file.size, type: file.type, url: url };
            return idbRun('readwrite', function (store) { return store.put(rec, path); })
              .then(function () { return path; })
              .catch(function (err) {
                if (err && err.message !== 'no-idb') throw new Error(FULL_MSG);
                // IndexedDB 를 못 쓰는 브라우저 — localStorage 로 물러섭니다.
                var map = readFiles();
                map[path] = rec;
                try {
                  window.localStorage.setItem(FILES, JSON.stringify(map));
                } catch (e) {
                  // 여기서 성공한 척하면 빈 사진이 올라간 것처럼 보입니다.
                  throw new Error(FULL_MSG);
                }
                return path;
              });
          });
        },
        url: function (path) {
          return idbRun('readonly', function (store) { return store.get(path); })
            .then(function (rec) { return (rec && rec.url) || ''; })
            .catch(function () {
              var map = readFiles();
              return (map[path] && map[path].url) || '';
            });
        },
        remove: function (path) {
          return idbRun('readwrite', function (store) { return store.delete(path); })
            .catch(function () { /* 없으면 그만 */ })
            .then(function () {
              var map = readFiles();
              if (!map[path]) return;
              delete map[path];
              try { window.localStorage.setItem(FILES, JSON.stringify(map)); } catch (e) { /* 무시 */ }
            });
        },
      },
    };
  }

  /* =========================================================
     Firebase 어댑터
     ========================================================= */

  function FirebaseAdapter() {
    var V = '10.14.1';
    var base = 'https://www.gstatic.com/firebasejs/' + V + '/';
    var fb = {};
    var authListeners = [];
    var profile = null;
    var loadError = null;

    var LOAD_MSG =
      'Firebase 연결에 실패했습니다. 인터넷 연결을 확인해 주세요. ' +
      '(광고 차단 프로그램이나 사내 방화벽이 googleapis.com · gstatic.com 을 막고 있을 수도 있습니다.)';

    /** SDK 로드 실패 시 모든 데이터 호출을 같은 메시지로 막습니다. */
    function guard() {
      return ready.then(function () {
        if (loadError) throw new Error(LOAD_MSG);
      });
    }

    var ready = Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'),
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      fb.app = appMod.initializeApp(window.FIREBASE_CONFIG);
      fb.auth = authMod.getAuth(fb.app);
      fb.fs = fsMod.getFirestore(fb.app);
      fb.authMod = authMod;
      fb.fsMod = fsMod;

      return new Promise(function (resolve) {
        var first = true;
        authMod.onAuthStateChanged(fb.auth, function (user) {
          var step = user ? ensureProfile(user) : Promise.resolve(null);
          step.then(function (p) {
            profile = p;
            authListeners.forEach(function (cb) {
              try { cb(p); } catch (e) { /* 무시 */ }
            });
            if (first) { first = false; resolve(); }
          });
        });
      });
    }).catch(function (err) {
      // SDK 로드 또는 초기화 실패 — 화면이 멈추지 않도록 여기서 흡수합니다.
      loadError = err;
      authListeners.forEach(function (cb) {
        try { cb(null); } catch (e) { /* 무시 */ }
      });
    });

    /** 로그인한 계정의 users 문서를 확인하고, 없으면 만듭니다. */
    function ensureProfile(user) {
      var fs = fb.fsMod;
      var ref = fs.doc(fb.fs, 'users', user.uid);
      return fs.getDoc(ref).then(function (snap) {
        if (snap.exists()) {
          return Object.assign({ id: user.uid, email: user.email }, snap.data());
        }
        var pending = window.sessionStorage.getItem('caps.signup.intent');
        var intent = {};
        try { intent = pending ? JSON.parse(pending) : {}; } catch (e) { intent = {}; }
        window.sessionStorage.removeItem('caps.signup.intent');

        var isStaff = !!intent.staffRequest;
        var doc = {
          email: user.email || '',
          name: intent.name || user.displayName || '',
          phone: intent.phone || '',
          church: intent.church || '',
          contactRole: intent.contactRole || '',
          birthDate: intent.birthDate || '',
          role: isStaff ? 'staff' : 'client',
          approved: !isStaff,
          perms: {},
          createdAt: nowIso(),
        };
        return fs.setDoc(ref, doc).then(function () {
          return Object.assign({ id: user.uid }, doc);
        });
      });
    }

    function col(name) { return fb.fsMod.collection(fb.fs, name); }

    function snapRows(snap) {
      var rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      return rows;
    }

    return {
      mode: 'firebase',
      ready: ready,
      loadError: function () { return loadError && LOAD_MSG; },

      auth: {
        current: function () { return profile; },
        onChange: function (cb) {
          authListeners.push(cb);
          ready.then(function () { cb(profile); });
          return function () {
            authListeners = authListeners.filter(function (f) { return f !== cb; });
          };
        },
        signUp: function (data) {
          return guard().then(function () {
            window.sessionStorage.setItem('caps.signup.intent', JSON.stringify({
              name: data.name, phone: data.phone, church: data.church,
              contactRole: data.contactRole, birthDate: data.birthDate,
              staffRequest: !!data.staffRequest,
            }));
            return fb.authMod
              .createUserWithEmailAndPassword(fb.auth, String(data.email).trim(), data.password)
              .then(function (cred) {
                if (data.name) {
                  return fb.authMod.updateProfile(cred.user, { displayName: data.name }).then(function () { return cred; });
                }
                return cred;
              })
              .then(function () { return ensureProfile(fb.auth.currentUser); })
              .catch(function (err) { throw new Error(authMessage(err)); });
          });
        },
        signIn: function (data) {
          return guard().then(function () {
            return fb.authMod
              .signInWithEmailAndPassword(fb.auth, String(data.email).trim(), data.password)
              .catch(function (err) { throw new Error(authMessage(err)); });
          });
        },
        /**
         * 구글 계정으로 로그인 또는 가입.
         * 처음 사용하는 계정이면 자동으로 가입 처리되며, intent 로 넘긴 값이
         * users 문서 생성에 사용됩니다 (직원 포털은 staffRequest: true).
         */
        signInGoogle: function (intent) {
          return guard().then(function () {
            if (intent) {
              window.sessionStorage.setItem('caps.signup.intent', JSON.stringify({
                name: intent.name || '', phone: intent.phone || '',
                church: intent.church || '', contactRole: intent.contactRole || '',
                birthDate: intent.birthDate || '', staffRequest: !!intent.staffRequest,
              }));
            }
            var provider = new fb.authMod.GoogleAuthProvider();
            return fb.authMod.signInWithPopup(fb.auth, provider)
              .catch(function (err) {
                window.sessionStorage.removeItem('caps.signup.intent');
                throw new Error(authMessage(err, 'google'));
              });
          });
        },
        signOut: function () {
          return guard().then(function () { return fb.authMod.signOut(fb.auth); });
        },
        resetPassword: function (email) {
          return guard().then(function () {
            return fb.authMod.sendPasswordResetEmail(fb.auth, String(email).trim())
              .catch(function (err) { throw new Error(authMessage(err)); });
          });
        },
        /**
         * 로그인 방식 목록 ('password' · 'google.com' 등).
         * 비밀번호 변경 화면을 보여줄지 판단하는 데 씁니다.
         */
        providers: function () {
          var u = fb.auth && fb.auth.currentUser;
          if (!u) return [];
          return (u.providerData || []).map(function (p) { return p.providerId; });
        },
        /** 비밀번호 변경 — 현재 비밀번호로 다시 인증한 뒤 바꿉니다. */
        changePassword: function (data) {
          return guard().then(function () {
            var user = fb.auth.currentUser;
            if (!user) throw new Error('로그인이 필요합니다.');
            var hasPw = (user.providerData || []).some(function (p) {
              return p.providerId === 'password';
            });
            if (!hasPw) {
              throw new Error(
                '이 계정은 구글 로그인으로 만들어져 센터에 비밀번호가 없습니다. ' +
                '비밀번호는 구글 계정 설정에서 관리해 주세요.'
              );
            }
            if (String(data.next || '').length < 6) {
              throw new Error('새 비밀번호는 6자 이상으로 입력해 주세요.');
            }
            var cred = fb.authMod.EmailAuthProvider.credential(user.email, data.current);
            return fb.authMod.reauthenticateWithCredential(user, cred)
              .catch(function (err) {
                var code = (err && err.code) || '';
                if (/wrong-password|invalid-credential|invalid-login/.test(code)) {
                  throw new Error('현재 비밀번호가 맞지 않습니다.');
                }
                throw new Error(authMessage(err));
              })
              .then(function () {
                return fb.authMod.updatePassword(user, data.next)
                  .catch(function (err) { throw new Error(authMessage(err)); });
              });
          });
        },
        updateProfile: function (patch) {
          return guard().then(function () {
            if (!profile) throw new Error('로그인이 필요합니다.');
            return fb.fsMod.updateDoc(fb.fsMod.doc(fb.fs, 'users', profile.id), patch).then(function () {
              profile = Object.assign({}, profile, patch);
              // 헤더·게이트 등 로그인 상태를 보는 화면도 함께 갱신합니다.
              authListeners.forEach(function (cb) {
                try { cb(profile); } catch (e) { /* 무시 */ }
              });
              return profile;
            });
          });
        },
      },

      list: function (name, opts) {
        return guard().then(function () {
          var o = opts || {};
          var fs = fb.fsMod;
          var ref = col(name);

          // where 조건은 서버로 넘깁니다. 보안 규칙이 조회 범위를 확인할 수 있어야
          // 하기 때문입니다 (전체 목록 조회는 권한이 없으면 거부됩니다).
          if (o.where) {
            var clauses = Object.keys(o.where).map(function (key) {
              return fs.where(key, '==', o.where[key]);
            });
            if (clauses.length) ref = fs.query.apply(null, [ref].concat(clauses));
          }

          return fs.getDocs(ref).then(function (snap) {
            // 정렬·개수 제한은 색인을 추가하지 않아도 되도록 여기서 처리합니다.
            var rest = Object.assign({}, o);
            delete rest.where;
            return applyQuery(snapRows(snap), rest);
          });
        });
      },
      get: function (name, id) {
        return guard().then(function () {
          return fb.fsMod.getDoc(fb.fsMod.doc(fb.fs, name, id)).then(function (d) {
            return d.exists() ? Object.assign({ id: d.id }, d.data()) : null;
          });
        });
      },
      add: function (name, data) {
        return guard().then(function () {
          var row = Object.assign({ createdAt: nowIso() }, data);
          return fb.fsMod.addDoc(col(name), row).then(function (ref) {
            return Object.assign({ id: ref.id }, row);
          });
        });
      },
      set: function (name, id, data) {
        return guard().then(function () {
          return fb.fsMod.setDoc(fb.fsMod.doc(fb.fs, name, id), data).then(function () {
            return Object.assign({ id: id }, data);
          });
        });
      },
      update: function (name, id, patch) {
        return guard().then(function () {
          return fb.fsMod.updateDoc(fb.fsMod.doc(fb.fs, name, id), patch);
        });
      },
      remove: function (name, id) {
        return guard().then(function () {
          return fb.fsMod.deleteDoc(fb.fsMod.doc(fb.fs, name, id));
        });
      },
      watch: function (name, cb) {
        var stop = null;
        var dead = false;
        ready.then(function () {
          if (dead) return;
          if (loadError) { cb([]); return; }
          stop = fb.fsMod.onSnapshot(col(name), function (snap) { cb(snapRows(snap)); }, function () { cb([]); });
        });
        return function () {
          dead = true;
          if (stop) stop();
        };
      },

      /* 증빙 파일 — Firebase Storage.
         계약서에는 민감한 정보가 들어 있어 게시판에는 노출되지 않고,
         올린 본인과 승인된 직원만 열 수 있습니다 (storage.rules). */
      files: {
        upload: function (path, file) {
          return storageMod().then(function (mod) {
            return mod.uploadBytes(mod.ref(fb.st, path), file, { contentType: file.type })
              .then(function () { return path; })
              .catch(function (err) { throw new Error(storageMessage(err)); });
          });
        },
        url: function (path) {
          return storageMod().then(function (mod) {
            return mod.getDownloadURL(mod.ref(fb.st, path))
              .catch(function () { return ''; });
          });
        },
        remove: function (path) {
          return storageMod().then(function (mod) {
            return mod.deleteObject(mod.ref(fb.st, path)).catch(function () { /* 이미 없으면 무시 */ });
          });
        },
      },
    };

    /** Storage SDK 는 필요할 때만 불러옵니다 (게시판을 쓰지 않으면 로드하지 않음). */
    function storageMod() {
      return guard().then(function () {
        if (fb.stMod) return fb.stMod;
        return import(base + 'firebase-storage.js').then(function (mod) {
          fb.stMod = mod;
          fb.st = mod.getStorage(fb.app);
          return mod;
        }).catch(function () {
          throw new Error(
            '파일 저장소(Firebase Storage) 에 연결할 수 없습니다. ' +
            'Firebase 콘솔에서 Storage 를 시작했는지 확인해 주세요.');
        });
      });
    }

    function storageMessage(err) {
      var code = (err && err.code) || '';
      if (code === 'storage/unauthorized') {
        return '파일을 올릴 권한이 없습니다. 로그인 상태와 저장소 보안 규칙(storage.rules)을 확인해 주세요.';
      }
      if (code === 'storage/quota-exceeded') return '저장소 용량이 부족합니다.';
      if (code === 'storage/retry-limit-exceeded') return '업로드가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
      if (code === 'storage/unknown' || code === 'storage/unauthenticated') {
        return '파일을 올리지 못했습니다. 다시 로그인한 뒤 시도해 주세요.';
      }
      return (err && err.message) || '파일을 올리지 못했습니다.';
    }

    /** 콘솔에서 바로 켤 수 있도록 링크를 붙입니다. */
    function providerHint(what) {
      var pid = (window.FIREBASE_CONFIG || {}).projectId;
      var url = pid
        ? 'https://console.firebase.google.com/project/' + pid + '/authentication/providers'
        : 'https://console.firebase.google.com';
      return 'Firebase 콘솔에서 ' + what + ' 로그인을 켜야 합니다. ' +
        '<a href="' + url + '" target="_blank" rel="noopener">Authentication → 로그인 방법 열기 ↗</a>';
    }

    function authMessage(err, kind) {
      var code = (err && err.code) || '';
      if (code === 'auth/operation-not-allowed') {
        return providerHint(kind === 'google' ? '[Google]' : '[이메일/비밀번호]');
      }
      if (code === 'auth/configuration-not-found') {
        return providerHint('[이메일/비밀번호]');
      }
      var map = {
        'auth/invalid-email': '이메일 형식을 확인해 주세요.',
        'auth/email-already-in-use': '이미 가입된 이메일입니다.',
        'auth/weak-password': '비밀번호는 6자 이상으로 입력해 주세요.',
        'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
        'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
        'auth/user-not-found': '가입되지 않은 이메일입니다.',
        'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
        'auth/unauthorized-domain':
          '이 주소가 Firebase [Authentication → 설정 → 승인된 도메인] 에 등록되지 않았습니다.',
        'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
        'auth/api-key-not-valid': 'Firebase 설정값(apiKey)이 올바르지 않습니다. firebase-config.js 를 확인해 주세요.',
        'auth/invalid-api-key': 'Firebase 설정값(apiKey)이 올바르지 않습니다. firebase-config.js 를 확인해 주세요.',

      };
      if (map[code]) return map[code];
      // Firebase 가 코드에 설명을 덧붙이는 경우가 있어 부분 일치도 확인합니다.
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        if (code.indexOf(keys[i]) === 0) return map[keys[i]];
      }
      if (code.indexOf('api-key') > -1) return map['auth/api-key-not-valid'];
      return (err && err.message) || '처리 중 문제가 발생했습니다.';
    }
  }

  /* =========================================================
     Supabase 어댑터

     Postgres + Auth + Storage. Firebase 어댑터와 같은 API 를 제공하므로
     화면 코드는 어느 쪽이 붙어 있는지 몰라도 됩니다.

     · 표 이름과 열 이름은 Postgres 관례대로 snake_case 이고,
       화면이 쓰는 camelCase 와는 이 어댑터가 맨 위 단계에서만 바꿔 줍니다.
       (jsonb 안쪽 키는 건드리지 않습니다 — extra · perms · fee · proof · photos)
     · 접근 제어는 전부 데이터베이스의 RLS 정책이 합니다. supabase.sql 참고.
     ========================================================= */

  function SupabaseAdapter() {
    var cfg = window.SUPABASE_CONFIG || {};
    var sb = null;
    var profile = null;   // public.users 행 (화면이 보는 계정 정보)
    var authUser = null;  // auth 사용자 (로그인 방식 확인에 씁니다)
    var authListeners = [];
    var loadError = null;

    var LOAD_MSG =
      'Supabase 연결에 실패했습니다. 인터넷 연결을 확인해 주세요. ' +
      '(사내 방화벽이 supabase.co 를 막고 있을 수도 있습니다.)';

    /* ---------- 이름 바꾸기 ---------- */

    /** 화면이 쓰는 컬렉션 이름 → 표 이름 */
    var TABLE = {
      users: 'users',
      requests: 'requests',
      customers: 'customers',
      subscriptions: 'subscriptions',
      invoices: 'invoices',
      serviceContent: 'service_content',
      settings: 'settings',
      editConsents: 'edit_consents',
      listings: 'listings',
      marketItems: 'market_items',
      installRequests: 'install_requests',
      guestHouses: 'guest_houses',
      events: 'events',
      ticketOrders: 'ticket_orders',
      payments: 'payments',
      jobPosts: 'job_posts',
      searchLogs: 'search_logs',
    };

    /** 문서 통째로 jsonb 한 칸에 담는 표 (내용이 자유로워서) */
    var DOC_TABLES = { serviceContent: true, settings: true };

    /** 기본 키가 id 가 아닌 표 */
    var PK = { editConsents: 'customer_id' };

    /** 비어 있으면 '' 가 아니라 null 이어야 하는 열 (uuid) */
    var UUID_KEYS = ['userId', 'customerId', 'assigneeId', 'itemId', 'eventId', 'targetId'];

    function snake(k) {
      return k.replace(/[A-Z]/g, function (c) { return '_' + c.toLowerCase(); });
    }

    function camel(k) {
      return k.replace(/_([a-z0-9])/g, function (_, c) { return c.toUpperCase(); });
    }

    /** 화면 → DB. 맨 위 단계 키만 바꿉니다. */
    function toRow(name, data) {
      if (DOC_TABLES[name]) {
        var doc = Object.assign({}, data);
        delete doc.id;
        return { data: doc };
      }
      var out = {};
      Object.keys(data || {}).forEach(function (k) {
        if (k === 'id') return; // 기본 키는 따로 넣습니다
        var v = data[k];
        if (UUID_KEYS.indexOf(k) > -1 && (v === '' || v === undefined)) v = null;
        out[snake(k)] = v === undefined ? null : v;
      });
      return out;
    }

    /** DB → 화면 */
    function fromRow(name, row) {
      if (!row) return null;
      if (DOC_TABLES[name]) {
        return Object.assign({ id: row.id }, row.data || {});
      }
      var out = {};
      Object.keys(row).forEach(function (k) {
        if (k === 'inserted_at') return; // DB 내부 정렬용
        var key = camel(k);
        var v = row[k];
        if (v === null && UUID_KEYS.indexOf(key) > -1) v = '';
        out[key] = v;
      });
      // editConsents 는 고객 아이디가 곧 문서 아이디입니다.
      if (name === 'editConsents') out.id = row.customer_id;
      return out;
    }

    /* ---------- 접속 ---------- */

    /** UMD 묶음을 필요할 때 한 번만 읽습니다 (CDN 이 아니라 저장소 안 파일). */
    function loadSdk() {
      if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
      return new Promise(function (resolve, reject) {
        var base = document.currentScript && document.currentScript.src;
        var prefix = base ? base.replace(/assets\/js\/db\.js.*$/, '') : '';
        var el = document.createElement('script');
        el.src = prefix + 'assets/vendor/supabase-2.112.3.js';
        el.onload = function () {
          if (window.supabase && window.supabase.createClient) resolve(window.supabase);
          else reject(new Error('Supabase 라이브러리를 읽지 못했습니다.'));
        };
        el.onerror = function () { reject(new Error('Supabase 라이브러리를 읽지 못했습니다.')); };
        document.head.appendChild(el);
      });
    }

    /* 계정 상태를 한 줄로 만들어 견줍니다.
       Supabase 는 탭을 다시 보게 될 때마다 SIGNED_IN 을 다시 흘려 줍니다
       (세션을 되살리고 토큰을 갱신하면서). 그걸 그대로 화면에 전하면
       "로그인 상태가 바뀌었다" 고 오해해 열려 있던 화면을 다시 그리고,
       쓰고 있던 신청서 내용이 날아갑니다.

       그래서 정말 달라졌을 때만 알립니다 — 로그인 · 로그아웃 · 직분 ·
       승인 · 권한 · 이름 같은 값이 하나라도 달라지면 알리고, 똑같으면
       조용히 넘깁니다. */
    function sigOf(p) {
      try { return p ? JSON.stringify(p) : ''; } catch (e) { return p ? 'x' : ''; }
    }

    var lastSig = null; // null = 아직 첫 확인 전

    /** @param {boolean} [force] 내용이 같아도 반드시 알립니다 (연결 실패 안내 등) */
    function emitAuth(force) {
      var sig = sigOf(profile);
      if (!force && lastSig !== null && sig === lastSig) return;
      lastSig = sig;
      authListeners.forEach(function (cb) {
        try { cb(profile); } catch (e) { /* 개별 리스너 오류 무시 */ }
      });
    }

    /** 로그인한 계정의 users 행을 읽습니다. (가입 트리거가 만들어 둡니다) */
    function loadProfile(user) {
      if (!user) return Promise.resolve(null);
      return sb.from('users').select('*').eq('id', user.id).maybeSingle()
        .then(function (res) {
          if (res.data) return fromRow('users', res.data);
          // 트리거가 도는 사이 잠깐 없을 수 있어 한 번 더 봅니다.
          return new Promise(function (r) { window.setTimeout(r, 700); })
            .then(function () {
              return sb.from('users').select('*').eq('id', user.id).maybeSingle();
            })
            .then(function (again) {
              return again.data ? fromRow('users', again.data) : null;
            });
        })
        .catch(function () { return null; });
    }

    /* 서버에 정말 닿는지 뒤에서 한 번 두드려 봅니다.
       getSession() 은 브라우저에 저장된 값만 읽어서, 서버가 죽어 있어도 성공합니다.
       그대로 두면 연결이 끊긴 상태에서 로그인 창만 뜨고 눌러도 아무 일이 없어,
       쓰는 분이 원인을 알 수 없습니다. 그래서 누구나 읽을 수 있는 settings 를
       한 줄만 세어 보고, 네트워크 자체가 막혔을 때만 연결 실패로 표시합니다.
       (권한 오류 · 표 없음 같은 것은 로그인을 막을 이유가 아니라 무시합니다.)

       확인은 첫 화면을 붙잡지 않습니다 — 응답이 늦어도 헤더와 로그인 단추는
       바로 나오고, 실패했을 때만 그때 다시 알려 줍니다. */
    var PING_TIMEOUT = 12000;

    function offline(msg) {
      return /Failed to fetch|NetworkError|Load failed|fetch failed|ERR_/i.test(msg || '');
    }

    function watchdog() {
      var call = sb.from('settings').select('id', { count: 'exact', head: true })
        .then(
          function (res) { return (res && res.error && res.error.message) || ''; },
          function (err) { return (err && err.message) || 'fetch failed'; }
        )
        .then(function (msg) { if (offline(msg)) throw new Error(msg); });

      // 응답이 아예 오지 않는 경우 (막힌 방화벽 등) 무한정 기다리지 않습니다.
      var timer = new Promise(function (_, reject) {
        window.setTimeout(function () { reject(new Error('fetch failed (timeout)')); }, PING_TIMEOUT);
      });

      Promise.race([call, timer]).catch(function (err) {
        loadError = err;
        // 이미 그려진 화면(관리자 게이트 등)이 원인을 다시 보여 주도록 알립니다.
        ready.then(function () { emitAuth(true); }, function () { /* 이미 실패로 처리됨 */ });
      });
    }

    var ready = loadSdk().then(function (lib) {
      sb = lib.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });

      watchdog();

      return sb.auth.getSession().then(function (res) {
        var user = res.data && res.data.session ? res.data.session.user : null;
        authUser = user;
        return loadProfile(user).then(function (p) {
          profile = p;
          lastSig = sigOf(profile); // 기준선

          sb.auth.onAuthStateChange(function (event, session) {
            authUser = session ? session.user : null;
            // 토큰 갱신만 된 경우에는 다시 읽지 않습니다.
            if (event === 'TOKEN_REFRESHED' && profile) return;
            loadProfile(authUser).then(function (next) {
              profile = next;
              emitAuth(); // 내용이 같으면 emitAuth 가 알아서 넘깁니다
            });
          });
        });
      });
    }).catch(function (err) {
      loadError = err;
      authListeners.forEach(function (cb) {
        try { cb(null); } catch (e) { /* 무시 */ }
      });
    });

    function guard() {
      return ready.then(function () {
        if (loadError) throw new Error(LOAD_MSG);
      });
    }

    /** Supabase 오류를 사람이 읽는 문구로 */
    function say(err) {
      var msg = (err && (err.message || err.error_description)) || '';
      var map = [
        [/Invalid login credentials/i, '이메일 또는 비밀번호가 맞지 않습니다.'],
        [/Email not confirmed/i, '이메일 확인이 끝나지 않았습니다. 받은 편지함의 확인 링크를 눌러 주세요.'],
        [/User already registered|already been registered/i, '이미 가입된 이메일입니다.'],
        [/Password should be at least/i, '비밀번호는 6자 이상으로 입력해 주세요.'],
        [/Unable to validate email address|invalid format/i, '이메일 형식을 확인해 주세요.'],
        [/For security purposes|rate limit|Too many/i, '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'],
        [/provider is not enabled/i,
          'Supabase 대시보드 [Authentication → Providers] 에서 이 로그인 방법을 켜야 합니다.'],
        [/row-level security|violates row-level/i, '이 작업을 할 권한이 없습니다.'],
        // 저장소는 파일 이름에 영문 · 숫자만 받습니다. safeKey() 가 미리 걸러 주지만,
        // 혹시 새어 나가면 무슨 일인지 알아볼 수 있도록 우리말로 바꿔 둡니다.
        [/Invalid key/i,
          '파일 이름에 쓸 수 없는 글자가 있어 올리지 못했습니다. ' +
          '이름을 영문·숫자로 바꿔서 다시 올려 주세요.'],
        [/exceeded the maximum allowed size|Payload too large|413/i,
          '파일이 너무 큽니다. 사진은 5MB, 서류는 10MB 까지입니다.'],
        [/mime type .* is not supported|invalid_mime_type/i,
          '이 형식은 올릴 수 없습니다. 사진은 JPG · PNG · HEIC, 서류는 PDF 나 사진으로 올려 주세요.'],
        [/Failed to fetch|NetworkError/i, '네트워크 연결을 확인해 주세요.'],
      ];
      for (var i = 0; i < map.length; i++) if (map[i][0].test(msg)) return map[i][1];
      return msg || '처리 중 문제가 발생했습니다.';
    }

    function fail(res) {
      if (res && res.error) throw new Error(say(res.error));
      return res;
    }

    /* ---------- 저장소 (파일) ---------- */

    /** 'listing-photos/uid/a.jpg' → { bucket, key } */
    function split(path) {
      var i = String(path || '').indexOf('/');
      if (i < 0) return { bucket: 'listing-photos', key: String(path || '') };
      return { bucket: path.slice(0, i), key: path.slice(i + 1) };
    }

    return {
      mode: 'supabase',
      ready: ready,
      loadError: function () { return loadError && LOAD_MSG; },

      auth: {
        current: function () { return profile; },
        onChange: function (cb) {
          authListeners.push(cb);
          ready.then(function () { cb(profile); });
          return function () {
            authListeners = authListeners.filter(function (f) { return f !== cb; });
          };
        },

        signUp: function (data) {
          return guard().then(function () {
            return sb.auth.signUp({
              email: String(data.email || '').trim(),
              password: data.password,
              options: {
                // 가입 트리거(handle_new_user)가 이 값으로 users 행을 만듭니다.
                data: {
                  name: (data.name || '').trim(),
                  phone: (data.phone || '').trim(),
                  church: (data.church || '').trim(),
                  contactRole: (data.contactRole || '').trim(),
                  birthDate: (data.birthDate || '').trim(),
                  staffRequest: !!data.staffRequest,
                },
              },
            }).then(function (res) {
              fail(res);
              if (!res.data.session) {
                // 대시보드에서 "Confirm email" 이 켜져 있는 경우입니다.
                throw new Error(
                  '가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 확인을 마친 뒤 로그인해 주세요.');
              }
              authUser = res.data.user;
              return loadProfile(res.data.user).then(function (p) {
                profile = p;
                emitAuth();
                return p;
              });
            });
          });
        },

        signIn: function (data) {
          return guard().then(function () {
            return sb.auth.signInWithPassword({
              email: String(data.email || '').trim(),
              password: data.password,
            }).then(function (res) {
              fail(res);
              authUser = res.data.user;
              return loadProfile(res.data.user).then(function (p) {
                profile = p;
                emitAuth();
                return p;
              });
            });
          });
        },

        /**
         * 구글 계정으로 로그인 또는 가입.
         * Supabase 는 팝업이 아니라 페이지를 옮겼다 돌아오는 방식이라,
         * 직원 신청 여부 같은 값은 sessionStorage 에 두고 돌아온 뒤 씁니다.
         */
        signInGoogle: function (intent) {
          return guard().then(function () {
            if (intent) {
              window.sessionStorage.setItem('caps.signup.intent', JSON.stringify({
                name: intent.name || '', phone: intent.phone || '',
                church: intent.church || '', contactRole: intent.contactRole || '',
                birthDate: intent.birthDate || '', staffRequest: !!intent.staffRequest,
              }));
            }
            return sb.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.href },
            }).then(function (res) {
              if (res.error) {
                window.sessionStorage.removeItem('caps.signup.intent');
                throw new Error(say(res.error));
              }
              // 여기서 페이지가 구글로 넘어갑니다.
              return null;
            });
          });
        },

        signOut: function () {
          return guard().then(function () {
            return sb.auth.signOut().then(function () {
              profile = null;
              authUser = null;
              emitAuth();
            });
          });
        },

        resetPassword: function (email) {
          return guard().then(function () {
            return sb.auth.resetPasswordForEmail(String(email || '').trim(), {
              redirectTo: window.location.origin + window.location.pathname,
            }).then(fail).then(function () { return true; });
          });
        },

        /** 로그인 방식 목록 ('password' · 'google' 등) */
        providers: function () {
          if (!authUser) return [];
          var list = (authUser.identities || []).map(function (i) { return i.provider; });
          if (list.length) return list;
          // identities 를 못 읽는 경우에는 app_metadata 로 넘어갑니다.
          var meta = authUser.app_metadata || {};
          return meta.providers || (meta.provider ? [meta.provider] : ['email']);
        },

        /** 비밀번호 변경 — 현재 비밀번호로 다시 확인한 뒤 바꿉니다. */
        changePassword: function (data) {
          return guard().then(function () {
            if (!profile) throw new Error('로그인이 필요합니다.');
            if (String(data.next || '').length < 6) {
              throw new Error('새 비밀번호는 6자 이상으로 입력해 주세요.');
            }
            return sb.auth.signInWithPassword({
              email: profile.email,
              password: data.current,
            }).then(function (res) {
              if (res.error) throw new Error('현재 비밀번호가 맞지 않습니다.');
              return sb.auth.updateUser({ password: data.next }).then(fail);
            }).then(function () { return true; });
          });
        },

        updateProfile: function (patch) {
          return guard().then(function () {
            if (!profile) throw new Error('로그인이 필요합니다.');
            return sb.from('users').update(toRow('users', patch)).eq('id', profile.id)
              .then(fail)
              .then(function () {
                profile = Object.assign({}, profile, patch);
                emitAuth();
                return profile;
              });
          });
        },
      },

      list: function (name, opts) {
        return guard().then(function () {
          var o = opts || {};
          var q = sb.from(TABLE[name] || name).select('*');
          if (o.where) {
            Object.keys(o.where).forEach(function (key) {
              q = q.eq(snake(key), o.where[key]);
            });
          }
          return q.then(function (res) {
            if (res.error) throw new Error(say(res.error));
            var rows = (res.data || []).map(function (r) { return fromRow(name, r); });
            var rest = Object.assign({}, o);
            delete rest.where;
            return applyQuery(rows, rest);
          });
        });
      },

      get: function (name, id) {
        return guard().then(function () {
          return sb.from(TABLE[name] || name).select('*')
            .eq(PK[name] || 'id', id).maybeSingle()
            .then(function (res) {
              if (res.error) throw new Error(say(res.error));
              return fromRow(name, res.data);
            });
        });
      },

      add: function (name, data) {
        return guard().then(function () {
          var row = toRow(name, Object.assign({ createdAt: nowIso() }, data));
          return sb.from(TABLE[name] || name).insert(row).select().single()
            .then(function (res) {
              if (res.error) throw new Error(say(res.error));
              return fromRow(name, res.data);
            });
        });
      },

      set: function (name, id, data) {
        return guard().then(function () {
          var pk = PK[name] || 'id';
          var row = toRow(name, data);
          row[pk] = id;
          return sb.from(TABLE[name] || name).upsert(row, { onConflict: pk }).select().single()
            .then(function (res) {
              if (res.error) throw new Error(say(res.error));
              return fromRow(name, res.data);
            });
        });
      },

      update: function (name, id, patch) {
        return guard().then(function () {
          if (DOC_TABLES[name]) {
            // 문서 표는 부분 수정 대신 기존 내용에 덮어씁니다.
            return sb.from(TABLE[name]).select('data').eq('id', id).maybeSingle()
              .then(function (res) {
                var merged = Object.assign({}, (res.data && res.data.data) || {}, patch);
                delete merged.id;
                return sb.from(TABLE[name]).upsert({ id: id, data: merged }, { onConflict: 'id' })
                  .then(fail);
              });
          }
          return sb.from(TABLE[name] || name).update(toRow(name, patch))
            .eq(PK[name] || 'id', id).then(fail);
        });
      },

      remove: function (name, id) {
        return guard().then(function () {
          return sb.from(TABLE[name] || name).delete().eq(PK[name] || 'id', id).then(fail);
        });
      },

      /**
       * 값이 바뀌면 목록 전체를 다시 읽어 넘깁니다.
       * (Firestore 의 onSnapshot 과 같은 모양으로 맞춘 것입니다)
       */
      watch: function (name, cb) {
        var dead = false;
        var channel = null;
        var table = TABLE[name] || name;

        var pull = function () {
          if (dead) return;
          sb.from(table).select('*').then(function (res) {
            if (dead) return;
            if (res.error) { cb([]); return; }
            cb((res.data || []).map(function (r) { return fromRow(name, r); }));
          });
        };

        ready.then(function () {
          if (dead) return;
          if (loadError) { cb([]); return; }
          pull();
          channel = sb.channel('wcsc-' + table)
            .on('postgres_changes', { event: '*', schema: 'public', table: table }, pull)
            .subscribe();
        });

        return function () {
          dead = true;
          if (channel) sb.removeChannel(channel);
        };
      },

      /**
       * 데이터베이스 함수 호출 (Supabase 전용).
       * 티켓 예약처럼 "확인하고 나서 올린다"를 한 번에 해야 하는 일은
       * 브라우저에서 나눠 하면 동시에 눌린 신청이 정원을 넘길 수 있습니다.
       * 그래서 서버 함수 하나로 묶어 부릅니다.
       */
      rpc: function (name, args) {
        return guard().then(function () {
          return sb.rpc(name, args || {}).then(function (res) {
            if (res.error) throw new Error(say(res.error));
            return res.data;
          });
        });
      },

      /**
       * Edge Function 호출 (Supabase 전용).
       * 결제 승인처럼 비밀키가 필요한 일은 브라우저에서 할 수 없어
       * 서버 쪽 함수에 맡깁니다.
       */
      fn: function (name, body) {
        return guard().then(function () {
          return sb.functions.invoke(name, { body: body || {} }).then(function (res) {
            if (res.error) {
              // 함수가 스스로 거절한 경우(아직 연결 안 됨 등)의 안내를 살려 냅니다.
              var msg = (res.data && res.data.message) || say(res.error);
              var err = new Error(msg);
              err.code = (res.data && res.data.error) || '';
              throw err;
            }
            return res.data;
          });
        });
      },

      files: {
        upload: function (path, file) {
          return guard().then(function () {
            var at = split(path);
            return sb.storage.from(at.bucket)
              .upload(at.key, file, { contentType: file.type, upsert: true })
              .then(function (res) {
                if (res.error) throw new Error(say(res.error));
                return path;
              });
          });
        },

        /**
         * 사진은 공개 버킷이라 주소가 그대로 열리고,
         * 증빙 서류는 비공개라 잠깐 동안만 열리는 주소를 만들어 줍니다.
         */
        url: function (path) {
          return guard().then(function () {
            var at = split(path);
            /* 비공개 버킷은 잠깐 동안만 열리는 주소를 만들어 줍니다. */
            if (at.bucket === 'listing-proofs' || at.bucket === 'request-files') {
              return sb.storage.from(at.bucket).createSignedUrl(at.key, 60 * 10)
                .then(function (res) {
                  return (res.data && res.data.signedUrl) || '';
                })
                .catch(function () { return ''; });
            }
            var pub = sb.storage.from(at.bucket).getPublicUrl(at.key);
            return (pub.data && pub.data.publicUrl) || '';
          });
        },

        remove: function (path) {
          return guard().then(function () {
            var at = split(path);
            return sb.storage.from(at.bucket).remove([at.key]).catch(function () { return null; });
          });
        },
      },
    };
  }

  /* =========================================================
     공개 API
     ========================================================= */

  /* Supabase 설정이 있으면 그쪽을, 없고 Firebase 설정이 있으면 Firebase 를,
     둘 다 없으면 브라우저 저장소(데모)를 씁니다. */
  var adapter = hasSupabase() ? SupabaseAdapter()
    : isConfigured() ? FirebaseAdapter()
    : LocalAdapter();

  var api = {
    mode: adapter.mode,
    ready: adapter.ready || Promise.resolve(),
    /** Firebase SDK 로드에 실패한 경우 안내 문구, 정상이면 null */
    loadError: adapter.loadError || function () { return null; },
    ROLES: ROLES,
    PERMS: PERMS,
    REQUEST_STATUS: REQUEST_STATUS,
    SUB_STATUS: SUB_STATUS,
    COLLECTIONS: COLLECTIONS,
    CHURCH_FIELDS: CHURCH_FIELDS,
    CONSENT_STATUS: CONSENT_STATUS,
    CONSENT_DAYS: CONSENT_DAYS,

    LISTING_STATUS: LISTING_STATUS,
    LISTING_KIND: LISTING_KIND,
    LISTING_HOLDER: LISTING_HOLDER,
    LISTING_PROOFS: LISTING_PROOFS,
    PROOF_FOR: PROOF_FOR,
    LISTING_USES: LISTING_USES,
    LISTING_REGIONS: LISTING_REGIONS,
    LISTING_TITLE_EXAMPLES: LISTING_TITLE_EXAMPLES,
    LISTING_HOURS_EXAMPLES: LISTING_HOURS_EXAMPLES,
    LISTING_FEE: LISTING_FEE,
    LISTING_DAYS: LISTING_DAYS,
    PROOF_MAX_BYTES: PROOF_MAX_BYTES,
    PROOF_TYPES: PROOF_TYPES,
    PHOTO_MAX_COUNT: PHOTO_MAX_COUNT,
    PHOTO_MIN_HINT: PHOTO_MIN_HINT,
    PHOTO_REC_TOP: PHOTO_REC_TOP,
    PHOTO_MAX_BYTES: PHOTO_MAX_BYTES,

    MARKET_STATUS: MARKET_STATUS,
    MARKET_CATEGORIES: MARKET_CATEGORIES,
    MARKET_INSTALLABLE: MARKET_INSTALLABLE,
    MARKET_CONDITION: MARKET_CONDITION,
    MARKET_DELIVERY: MARKET_DELIVERY,
    MARKET_PHOTO_MAX: MARKET_PHOTO_MAX,
    INSTALL_TIERS: INSTALL_TIERS,
    INSTALL_STATUS: INSTALL_STATUS,

    GUEST_STATUS: GUEST_STATUS,
    GUEST_ROOM_TYPE: GUEST_ROOM_TYPE,
    GUEST_BATH: GUEST_BATH,
    GUEST_TYPES: GUEST_TYPES,
    GUEST_AMENITIES: GUEST_AMENITIES,
    GUEST_LANGUAGES: GUEST_LANGUAGES,
    GUEST_PHOTO_MAX: GUEST_PHOTO_MAX,

    JOB_STATUS: JOB_STATUS,
    JOB_POSITIONS: JOB_POSITIONS,
    JOB_EMPLOYMENT: JOB_EMPLOYMENT,
    JOB_PAY_TYPE: JOB_PAY_TYPE,
    JOB_HOUSING: JOB_HOUSING,
    JOB_DEPARTMENTS: JOB_DEPARTMENTS,
    JOB_SIZES: JOB_SIZES,
    JOB_PHOTO_MAX: JOB_PHOTO_MAX,

    EVENT_STATUS: EVENT_STATUS,
    EVENT_CATEGORIES: EVENT_CATEGORIES,
    EVENT_PHOTO_MAX: EVENT_PHOTO_MAX,
    TICKET_STATUS: TICKET_STATUS,

    files: adapter.files,

    auth: adapter.auth,
    list: adapter.list,
    get: adapter.get,
    add: adapter.add,
    set: adapter.set,
    update: adapter.update,
    remove: adapter.remove,
    watch: adapter.watch,

    makeCode: makeCode,

    /** 현재 계정이 특정 권한을 가졌는지 */
    can: function (perm) {
      var u = adapter.auth.current();
      if (!u || !u.approved) return false;
      if (u.role === 'owner') return true;
      if (u.role === 'client') return false;
      return !!(u.perms && u.perms[perm]);
    },

    /**
     * 필수 프로필(교회명 · 직분 · 연락처)이 비어 있는지.
     * 구글로 가입한 계정과 예전에 만들어진 계정을 걸러내기 위한 것입니다.
     */
    needsProfile: function (user) {
      var u = user || adapter.auth.current();
      if (!u) return false;
      return !String(u.church || '').trim()
        || !String(u.contactRole || '').trim()
        || !String(u.phone || '').trim();
    },

    /* =====================================================
       고객 정보 수정 동의 (editConsents)

       흐름
         1. 직원이 고객에게 [정보 수정 요청] 을 보냅니다  → pending
         2. 교회 계정이 홈페이지에서 승인 또는 거절합니다  → approved / rejected
         3. 승인된 동안(기본 7일) 직원이 교회 정보를 수정합니다
         4. 저장을 마치면 다시 잠깁니다                    → used

       보안 규칙이 customers 의 교회 정보 항목을 이 승인과 묶어 두었으므로,
       화면에서 잠금을 우회해도 서버에서 거부됩니다.
       ===================================================== */

    /** 승인이 살아 있는지 (승인 상태이고 기한이 남았는지) */
    consentLive: function (doc) {
      if (!doc || doc.status !== 'approved') return false;
      if (!doc.expiresAt) return true;
      return new Date(doc.expiresAt).getTime() > Date.now();
    },

    /** 화면 표시용 상태 정보 */
    consentView: function (doc) {
      if (!doc) return { status: 'none', label: '요청 없음', cls: 'none', live: false };
      var live = api.consentLive(doc);
      var status = doc.status;
      if (status === 'approved' && !live) status = 'expired';
      return {
        status: status,
        label: CONSENT_STATUS[status] || status,
        cls: status,
        live: live,
        fields: doc.fields || [],
        reason: doc.reason || '',
        expiresAt: doc.expiresAt || '',
      };
    },

    /** 항목 키 목록을 사람이 읽는 문구로 */
    fieldLabels: function (keys) {
      var list = (keys || []).map(function (k) { return CHURCH_FIELDS[k] || k; });
      return list.length ? list.join(' · ') : '교회 정보 전체';
    },

    /**
     * 고객 교회 계정을 찾습니다.
     * customers.userId 를 먼저 보고, 없으면 연결된 신청서에서 찾습니다.
     */
    accountOf: function (customer, requests) {
      if (!customer) return '';
      if (customer.userId) return customer.userId;
      var linked = (requests || []).filter(function (r) {
        return r.customerId === customer.id && r.userId;
      });
      return linked.length ? linked[0].userId : '';
    },

    /** 직원 → 고객에게 정보 수정 요청 보내기 */
    requestChurchEdit: function (customer, opts) {
      var o = opts || {};
      var me = adapter.auth.current();
      var userId = String(o.userId || '').trim();
      if (!userId) {
        return Promise.reject(new Error(
          '이 교회에 연결된 계정이 없습니다. 먼저 신청 건을 고객으로 연결하거나, 교회 계정을 확인해 주세요.'));
      }
      return adapter.set('editConsents', customer.id, {
        customerId: customer.id,
        customerName: customer.name || '',
        userId: userId,
        fields: o.fields || [],
        reason: String(o.reason || '').trim(),
        status: 'pending',
        requestedBy: me ? me.id : '',
        requestedByName: me ? (me.name || me.email) : '',
        requestedAt: nowIso(),
        respondedAt: '',
        rejectNote: '',
        expiresAt: '',
        createdAt: nowIso(),
      });
    },

    /** 직원 → 요청 취소 */
    cancelChurchEdit: function (customerId) {
      return adapter.update('editConsents', customerId, {
        status: 'canceled', respondedAt: nowIso(),
      });
    },

    /** 직원 → 수정을 마쳐 다시 잠금 */
    finishChurchEdit: function (customerId) {
      return adapter.update('editConsents', customerId, {
        status: 'used', usedAt: nowIso(),
      });
    },

    /** 기한이 지난 승인을 정리 */
    expireChurchEdit: function (customerId) {
      return adapter.update('editConsents', customerId, { status: 'expired' });
    },

    /** 고객 → 승인 또는 거절 */
    respondChurchEdit: function (customerId, approve, note) {
      var patch = {
        status: approve ? 'approved' : 'rejected',
        respondedAt: nowIso(),
        rejectNote: approve ? '' : String(note || '').trim(),
        expiresAt: approve
          ? new Date(Date.now() + CONSENT_DAYS * 864e5).toISOString()
          : '',
      };
      return adapter.update('editConsents', customerId, patch);
    },

    /** 고객 → 나에게 온 요청 목록 (보안 규칙이 조회 범위를 확인합니다) */
    myEditConsents: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('editConsents', { where: { userId: me.id } });
    },

    /* =====================================================
       부동산 매물 게시판 (listings)

       흐름
         1. 등록자가 매물 정보 · 사진 · 권리 증빙 서류를 올립니다   → pending
         2. 관리자가 서류를 확인하고 승인하면서
            입금 계좌를 카카오톡으로 보냅니다                       → awaiting_payment
         3. 입금이 확인되면 게시됩니다                              → published
         4. 서류가 맞지 않으면 사유와 함께 반려                     → rejected
         5. 필요하면 관리자가 내립니다                              → hidden
         6. 게시 기간(기본 90일)이 지나면                           → expired

       계좌를 화면에 붙여 두지 않고 승인 시점에 카카오톡으로 보내는 이유는,
       확인되지 않은 글에 입금이 먼저 들어오는 일을 막기 위한 것입니다.

       센터는 게시판만 관리합니다. 중개·상담·계약은 하지 않으며,
       연락은 등록자와 보는 사람이 직접 합니다. 그래서 글에는
       연락처와 함께 **연락 가능 시간**을 받아 함께 보여 줍니다.

       사진은 게시판에 공개되지만, 증빙 서류는 절대 보이지 않습니다.
       (Storage 규칙으로 올린 본인과 승인된 직원만 열 수 있습니다.)
       ===================================================== */

    /** 게시 중인지 — 기한은 없습니다 (팔릴 때까지).
        expiresAt 이 남아 있는 옛 글만 그 날짜를 봅니다. */
    listingLive: function (row) {
      if (!row || row.status !== 'published') return false;
      if (!row.expiresAt) return true;
      return new Date(row.expiresAt).getTime() > Date.now();
    },

    /** 화면 표시용 상태 */
    listingView: function (row) {
      if (!row) return { status: 'none', label: '-', cls: 'none', live: false, days: null, up: null };
      var status = row.status;
      if (status === 'published' && !api.listingLive(row)) status = 'expired';

      /* 새 등록과 수정 재검토는 봐야 할 것이 다릅니다.
         새 등록  : 서류부터 처음 확인 (등록비도 아직)
         수정 재검토: 이미 확인한 글 · 등록비도 받았음 → 바뀐 내용만 봅니다
         전에 승인받은 적이 있으면(firstPublishedAt) 수정 재검토로 봅니다. */
      var isEdit = row.status === 'pending' && !!(row.firstPublishedAt || row.editRequestedAt);
      if (isEdit) status = 'edit_pending';
      // 남은 날수(days)는 기한이 있던 옛 글에만 있습니다.
      var days = null;
      if (status === 'published' && row.expiresAt) {
        days = Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 864e5);
      }
      // 올린 지 며칠 됐는지 — 기한이 없어졌으니 이걸로 오래된 글을 가려냅니다.
      var up = null;
      if (row.publishedAt) {
        up = Math.max(0, Math.floor((Date.now() - new Date(row.publishedAt).getTime()) / 864e5));
      }
      var use = row.use === 'other'
        ? (String(row.useOther || '').trim() || '기타')
        : (LISTING_USES[row.use] || row.use || '');
      return {
        status: status,
        label: LISTING_STATUS[status] || status,
        cls: status,
        live: status === 'published',
        // 저장된 값 그대로 (pending 등). 위 status 는 화면용 이름입니다.
        rawStatus: row.status,
        isEdit: isEdit,
        editRequestedAt: row.editRequestedAt || '',
        firstPublishedAt: row.firstPublishedAt || '',
        days: days,
        up: up,
        kindLabel: LISTING_KIND[row.kind] || row.kind || '-',
        holderLabel: LISTING_HOLDER[row.holder] || row.holder || '-',
        useLabel: use,
        proofLabel: row.proof ? (LISTING_PROOFS[row.proof.kind] || '권리 증빙 서류') : '',
        photos: Array.isArray(row.photos) ? row.photos : [],
      };
    },

    /** 금액 요약 — 목록에 한 줄로 보여 줄 문구 */
    listingPrice: function (row) {
      if (!row) return '-';
      var m = api.money;
      if (row.kind === 'sale') return '매매 ' + m(row.salePrice) + '원';
      if (row.kind === 'rent_jeonse') return '전세 ' + m(row.deposit) + '원';
      if (row.kind === 'share') {
        return row.monthly ? '대여 ' + m(row.monthly) + '원' : '금액 협의';
      }
      return '보증금 ' + m(row.deposit) + ' / 월 ' + m(row.monthly) + '원';
    },

    /** 증빙 서류 파일 검사 (형식 · 용량) — 통과하면 빈 문자열 */
    checkProof: function (file) {
      if (!file) return '권리를 확인할 수 있는 서류를 첨부해 주세요.';
      if (file.size > PROOF_MAX_BYTES) {
        return '파일 용량은 10MB 이하로 올려 주세요. (현재 ' +
          Math.round(file.size / 1024 / 102.4) / 10 + 'MB)';
      }
      var t = String(file.type || '').toLowerCase();
      if (PROOF_TYPES.indexOf(t) === -1 && t.indexOf('image/') !== 0) {
        return 'PDF 또는 사진(JPG · PNG) 파일만 올릴 수 있습니다.';
      }
      return '';
    },

    /** 증빙 서류 업로드 → 문서에 담을 파일 정보 */
    uploadProof: function (file, kind) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('로그인이 필요합니다.'));
      var bad = api.checkProof(file);
      if (bad) return Promise.reject(new Error(bad));

      var safe = safeKey(file.name, 'pdf');
      var path = 'listing-proofs/' + me.id + '/' +
        Date.now().toString(36) + '-' + safe;

      return adapter.files.upload(path, file).then(function () {
        return {
          path: path,
          name: file.name || safe,
          size: file.size || 0,
          type: file.type || '',
          kind: kind || 'other',
          uploadedAt: nowIso(),
        };
      });
    },

    /* -------- 신청서 첨부 --------
       홈페이지 의뢰서처럼 신청할 때 파일을 함께 받는 항목이 있습니다.
       사업자등록증이 섞이므로 종류를 가리지 않고 비공개로 둡니다
       (supabase/migrations 의 request-files 참고). */

    /** 첨부 파일 검사 — 통과하면 빈 문자열 */
    checkRequestFile: function (file) {
      if (!file) return '파일을 고르지 않으셨습니다.';
      if (file.size > 10 * 1024 * 1024) return '파일은 10MB 까지 올릴 수 있습니다.';
      return '';
    },

    /** 첨부 올리기 → 신청서에 담을 파일 정보 */
    uploadRequestFile: function (file, slot) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('로그인이 필요합니다.'));
      var bad = api.checkRequestFile(file);
      if (bad) return Promise.reject(new Error(bad));

      var safe = safeKey(file.name, 'bin');
      var path = 'request-files/' + me.id + '/' +
        Date.now().toString(36) + '-' + safe;

      return adapter.files.upload(path, file).then(function () {
        return {
          path: path,
          name: file.name || safe,
          size: file.size || 0,
          type: file.type || '',
          slot: slot || '',
          uploadedAt: nowIso(),
        };
      });
    },

    /** 첨부 열기용 주소 (올린 본인 · 직원만 열립니다) */
    requestFileUrl: function (path) {
      if (!path) return Promise.resolve('');
      return adapter.files.url(path);
    },

    /** 증빙 서류 열기용 주소 (본인 · 직원만 열립니다) */
    proofUrl: function (path) {
      if (!path) return Promise.resolve('');
      return adapter.files.url(path);
    },

    /* -------- 매물 사진 --------
       증빙 서류와 달리 사진은 게시판에 그대로 공개됩니다.
       올릴 때 브라우저에서 긴 변 1600px · JPEG 로 줄여 용량을 낮춥니다. */

    /** 사진 파일 검사 — 통과하면 빈 문자열 */
    checkPhoto: function (file) {
      if (!file) return '사진 파일을 선택해 주세요.';
      if (String(file.type || '').toLowerCase().indexOf('image/') !== 0) {
        return '사진(JPG · PNG · HEIC)만 올릴 수 있습니다.';
      }
      if (file.size > PHOTO_MAX_BYTES) {
        return '사진 한 장은 15MB 이하로 올려 주세요.';
      }
      return '';
    },

    /**
     * 사진을 긴 변 1600px JPEG 로 줄입니다.
     * 브라우저가 못 하는 경우(예: HEIC 디코딩 실패)에는 원본을 그대로 씁니다.
     */
    shrinkPhoto: function (file) {
      return new Promise(function (resolve) {
        if (!window.URL || !window.URL.createObjectURL) { resolve(file); return; }
        var url = window.URL.createObjectURL(file);
        var img = new window.Image();
        var done = function (out) {
          window.URL.revokeObjectURL(url);
          resolve(out || file);
        };
        img.onerror = function () { done(null); };
        img.onload = function () {
          try {
            var long = Math.max(img.naturalWidth, img.naturalHeight);
            var scale = long > PHOTO_LONG_EDGE ? PHOTO_LONG_EDGE / long : 1;
            var w = Math.round(img.naturalWidth * scale);
            var h = Math.round(img.naturalHeight * scale);
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(function (blob) {
              if (!blob || blob.size >= file.size) { done(null); return; }
              // File 로 감싸 이름·형식을 유지합니다 (지원하지 않으면 Blob 그대로).
              var name = String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
              try {
                done(new File([blob], name, { type: 'image/jpeg' }));
              } catch (e) {
                blob.name = name;
                done(blob);
              }
            }, 'image/jpeg', PHOTO_QUALITY);
          } catch (e) {
            done(null);
          }
        };
        img.src = url;
      });
    },

    /** 사진 한 장 올리기 → 문서에 담을 정보 */
    uploadPhoto: function (file) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('로그인이 필요합니다.'));
      var bad = api.checkPhoto(file);
      if (bad) return Promise.reject(new Error(bad));

      return api.shrinkPhoto(file).then(function (small) {
        var safe = safeKey(small.name || file.name, 'jpg');
        var path = 'listing-photos/' + me.id + '/' +
          Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + '-' + safe;
        return adapter.files.upload(path, small).then(function () {
          return adapter.files.url(path).then(function (url) {
            return {
              path: path,
              url: url || '',
              name: file.name || safe,
              size: small.size || 0,
              uploadedAt: nowIso(),
            };
          });
        });
      });
    },

    /** 사진 주소 — 저장된 url 이 있으면 그대로 씁니다. */
    photoUrl: function (photo) {
      if (!photo) return Promise.resolve('');
      if (photo.url) return Promise.resolve(photo.url);
      if (!photo.path) return Promise.resolve('');
      return adapter.files.url(photo.path);
    },

    /** 사진 파일 삭제 (문서에서 뺀 뒤 호출) */
    deletePhoto: function (photo) {
      if (!photo || !photo.path) return Promise.resolve();
      return adapter.files.remove(photo.path).catch(function () { return null; });
    },

    /** 매물 등록 — 언제나 '승인 대기'로 시작합니다. */
    submitListing: function (data, proof) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('매물을 등록하려면 로그인해 주세요.'));
      if (!proof || !proof.path) {
        return Promise.reject(new Error('권리를 확인할 수 있는 서류를 먼저 올려 주세요.'));
      }
      var record = Object.assign({
        kind: 'rent_monthly', holder: 'owner', use: 'church', useOther: '',
        title: '', region: '', addressRough: '', area: '', floor: '', parking: '',
        deposit: 0, monthly: 0, salePrice: 0, maintenance: 0,
        moveIn: '', religiousUse: '', desc: '',
        contactName: '', contactPhone: '', contactHours: '',
        photos: [],
      }, data, {
        userId: me.id,
        userEmail: me.email || '',
        proof: proof,
        status: 'pending',
        fee: { amount: LISTING_FEE, paid: false, paidAt: '', noticeSentAt: '', invoiceId: '' },
        rejectNote: '',
        views: 0,
        reviewedBy: '',
        reviewedAt: '',
        publishedAt: '',
        firstPublishedAt: '',
        editRequestedAt: '',
        expiresAt: '',
        hiddenAt: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      return adapter.add('listings', record);
    },

    /**
     * 등록자가 내용을 고칩니다.
     * 고친 글은 다시 확인해야 하므로 '승인 대기'로 돌아갑니다.
     * (보안 규칙도 같은 조건을 요구합니다.)
     */
    saveListing: function (id, data, prev) {
      /* 전에 승인받은 적이 있는 글이면 "수정 승인 요청" 으로 남깁니다.
         관리자 화면에서 새 등록과 갈라 보여 주기 위한 표시입니다.
         (firstPublishedAt 은 센터만 다루므로 여기서 건드리지 않습니다) */
      var wasLive = !!(prev && (prev.firstPublishedAt || prev.publishedAt));
      var patch = Object.assign({}, data, {
        status: 'pending',
        rejectNote: '',
        reviewedBy: '',
        reviewedAt: '',
        publishedAt: '',
        expiresAt: '',
        updatedAt: nowIso(),
      });
      if (wasLive) patch.editRequestedAt = nowIso();
      return adapter.update('listings', id, patch);
    },

    /**
     * 관리자 → 1단계: 서류 확인 완료, 계좌를 카카오톡으로 보냄 → 입금 대기
     * 계좌를 화면에 붙여 두지 않고 승인할 때 카카오톡으로 보내는 이유는,
     * 확인되지 않은 글에 입금이 먼저 들어오는 일을 막기 위한 것입니다.
     */
    noticeListingFee: function (id) {
      var me = adapter.auth.current();
      return adapter.update('listings', id, {
        status: 'awaiting_payment',
        rejectNote: '',
        fee: {
          amount: LISTING_FEE,
          paid: false,
          paidAt: '',
          noticeSentAt: nowIso(),
          invoiceId: '',
        },
        reviewedBy: me ? me.id : '',
        reviewedAt: nowIso(),
        updatedAt: nowIso(),
      });
    },

    /** 관리자 → 2단계: 입금 확인 후 게시 */
    approveListing: function (id, opts) {
      var o = opts || {};
      var me = adapter.auth.current();
      // 기한을 두지 않습니다 — 거래가 끝날 때까지 올려 둡니다.
      // (직원이 굳이 기한을 지정하면 그때만 넣습니다)
      var days = Number(o.days) > 0 ? Number(o.days) : LISTING_DAYS;
      var patch = {
        status: 'published',
        publishedAt: nowIso(),
        // 처음 게시한 시각은 한 번만 채우고 그대로 둡니다.
        firstPublishedAt: (o.row && o.row.firstPublishedAt) || nowIso(),
        editRequestedAt: '',
        expiresAt: days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : '',
        rejectNote: '',
        hiddenAt: '',
        reviewedBy: me ? me.id : '',
        reviewedAt: nowIso(),
        updatedAt: nowIso(),
      };
      if (o.fee) patch.fee = o.fee;
      return adapter.update('listings', id, patch);
    },

    /** 관리자 → 반려 (사유 필수) */
    rejectListing: function (id, note) {
      var me = adapter.auth.current();
      var reason = String(note || '').trim();
      if (!reason) {
        return Promise.reject(new Error('반려 사유를 적어 주세요. 등록자에게 그대로 보입니다.'));
      }
      return adapter.update('listings', id, {
        status: 'rejected',
        rejectNote: reason,
        publishedAt: '',
        expiresAt: '',
        reviewedBy: me ? me.id : '',
        reviewedAt: nowIso(),
        updatedAt: nowIso(),
      });
    },

    /** 관리자 → 게시 중지 (내리기) */
    hideListing: function (id, note) {
      var me = adapter.auth.current();
      return adapter.update('listings', id, {
        status: 'hidden',
        hiddenAt: nowIso(),
        rejectNote: String(note || '').trim(),
        reviewedBy: me ? me.id : '',
        reviewedAt: nowIso(),
        updatedAt: nowIso(),
      });
    },

    /** 관리자 → 등록비 입금 확인 */
    markListingFee: function (id, paid, invoiceId) {
      return adapter.update('listings', id, {
        fee: {
          amount: LISTING_FEE,
          paid: !!paid,
          paidAt: paid ? nowIso() : '',
          invoiceId: invoiceId || '',
        },
        updatedAt: nowIso(),
      });
    },

    /** 거래가 끝나 내립니다.
     *
     *  팔린 것을 가장 먼저 아는 사람은 등록자입니다 — 센터가 알 방법이 없어,
     *  등록자가 직접 내릴 수 있게 했습니다 (접근 규칙에서도 허용했습니다).
     *  다시 올리시려면 내용을 고쳐 재검토를 받으시면 됩니다.
     */
    markListingDone: function (id) {
      return adapter.update('listings', id, {
        status: 'done',
        updatedAt: nowIso(),
      });
    },

    /** 매물 삭제 — 증빙 서류와 사진도 함께 지웁니다. */
    deleteListing: function (row) {
      var id = typeof row === 'string' ? row : (row && row.id);
      if (!id) return Promise.resolve();
      var doc = typeof row === 'object' ? row : null;
      var paths = [];
      if (doc && doc.proof && doc.proof.path) paths.push(doc.proof.path);
      (doc && Array.isArray(doc.photos) ? doc.photos : []).forEach(function (ph) {
        if (ph && ph.path) paths.push(ph.path);
      });
      return adapter.remove('listings', id).then(function () {
        return Promise.all(paths.map(function (p) {
          return adapter.files.remove(p).catch(function () { return null; });
        }));
      });
    },

    /**
     * 공개 목록 — 로그인 없이 누구나 봅니다.
     * 보안 규칙이 조회 범위를 확인하므로 반드시 status 조건을 붙입니다.
     */
    publishedListings: function () {
      return adapter.list('listings', { where: { status: 'published' } })
        .then(function (rows) {
          return rows.filter(function (r) { return api.listingLive(r); });
        })
        .catch(function () { return []; });
    },

    /** 내가 올린 매물 (보안 규칙이 조회 범위를 확인합니다) */
    myListings: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('listings', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    /** 관리자 화면 — 전체 목록 */
    allListings: function () {
      return adapter.list('listings');
    },

    /* =====================================================
       중고 장터 (marketItems)

       부동산 매물과 흐름은 같지만 두 가지가 다릅니다.
         · 권리 증빙 서류가 없습니다 — 대신 등록비도 받지 않습니다.
         · 센터의 몫은 등록비가 아니라 **설치 대행료** 입니다.
           스피커 · 믹서를 중고로 싸게 사도, 예배당에 다는 일은 남습니다.
           그 일을 센터 음향팀이 맡고 비용을 받습니다.
       ===================================================== */

    /** 지금 팔고 있는 글인지 */
    marketLive: function (row) {
      return !!row && row.status === 'published';
    },

    /** 화면 표시용 */
    marketView: function (row) {
      if (!row) return { status: 'none', label: '-', cls: 'none', live: false, photos: [] };
      var cat = row.category === 'other'
        ? (String(row.categoryOther || '').trim() || '기타')
        : (MARKET_CATEGORIES[row.category] || row.category || '');
      var up = null;
      if (row.publishedAt) {
        up = Math.max(0, Math.floor((Date.now() - new Date(row.publishedAt).getTime()) / 864e5));
      }
      return {
        status: row.status,
        label: MARKET_STATUS[row.status] || row.status,
        cls: row.status,
        live: row.status === 'published',
        up: up,
        categoryLabel: cat,
        conditionLabel: MARKET_CONDITION[row.condition] || row.condition || '',
        deliveryLabel: MARKET_DELIVERY[row.delivery] || '',
        // 센터가 달아 드릴 수 있는 물건인지 — 음향 · 영상 · 조명이 여기 듭니다.
        installable: row.installOk !== false && MARKET_INSTALLABLE.indexOf(row.category) > -1,
        photos: Array.isArray(row.photos) ? row.photos : [],
      };
    },

    /** 값 한 줄 */
    marketPrice: function (row) {
      if (!row) return '-';
      if (row.freeGiveaway) return '무료 나눔';
      if (!Number(row.price)) return '가격 문의';
      return api.money(row.price) + '원' + (row.negotiable ? ' (조정 가능)' : '');
    },

    /** 설치 대행 견적 — 실측 전 어림값입니다. */
    installQuote: function (tier, qty) {
      var t = INSTALL_TIERS[tier] || INSTALL_TIERS.install;
      var n = Math.max(1, Number(qty) || 1);
      // 대수가 늘어도 출장은 한 번이라, 두 번째부터는 절반만 더합니다.
      var amount = t.price + Math.round(t.price * 0.5) * (n - 1);
      return { tier: tier, label: t.label, desc: t.desc, unit: t.price, amount: amount };
    },

    /** 장터 등록 — 언제나 '확인 대기'로 시작합니다. */
    submitMarketItem: function (data) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('물건을 올리려면 로그인해 주세요.'));
      var record = Object.assign({
        category: 'sound', categoryOther: '', title: '', brand: '', model: '',
        condition: 'good', boughtYear: '', quantity: 1,
        price: 0, negotiable: false, freeGiveaway: false,
        region: '', addressRough: '', installOk: true, installNote: '',
        delivery: 'pickup', desc: '',
        contactName: '', contactPhone: '', contactHours: '', photos: [],
      }, data, {
        userId: me.id,
        userEmail: me.email || '',
        status: 'pending',
        rejectNote: '', views: 0,
        reviewedBy: '', reviewedAt: '', publishedAt: '', hiddenAt: '',
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      return adapter.add('marketItems', record);
    },

    /** 등록자가 고칩니다 — 고친 글은 다시 확인을 받습니다. */
    saveMarketItem: function (id, data) {
      return adapter.update('marketItems', id, Object.assign({}, data, {
        status: 'pending', rejectNote: '',
        reviewedBy: '', reviewedAt: '', publishedAt: '',
        updatedAt: nowIso(),
      }));
    },

    /** 관리자 → 게시 */
    approveMarketItem: function (id) {
      var me = adapter.auth.current();
      return adapter.update('marketItems', id, {
        status: 'published', publishedAt: nowIso(), rejectNote: '', hiddenAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    /** 관리자 → 반려 (사유 필수 — 등록자에게 그대로 보입니다) */
    rejectMarketItem: function (id, note) {
      var me = adapter.auth.current();
      var reason = String(note || '').trim();
      if (!reason) return Promise.reject(new Error('반려 사유를 적어 주세요. 등록자에게 그대로 보입니다.'));
      return adapter.update('marketItems', id, {
        status: 'rejected', rejectNote: reason, publishedAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    /** 관리자 → 내리기 */
    hideMarketItem: function (id, note) {
      var me = adapter.auth.current();
      return adapter.update('marketItems', id, {
        status: 'hidden', hiddenAt: nowIso(), rejectNote: String(note || '').trim(),
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    /** 팔렸습니다 — 판 사람이 직접 내립니다 (센터는 알 방법이 없습니다). */
    markMarketDone: function (id) {
      return adapter.update('marketItems', id, { status: 'done', updatedAt: nowIso() });
    },

    deleteMarketItem: function (row) {
      var id = typeof row === 'string' ? row : (row && row.id);
      if (!id) return Promise.resolve();
      var doc = typeof row === 'object' ? row : null;
      var paths = (doc && Array.isArray(doc.photos) ? doc.photos : [])
        .filter(function (ph) { return ph && ph.path; }).map(function (ph) { return ph.path; });
      return adapter.remove('marketItems', id).then(function () {
        return Promise.all(paths.map(function (p) {
          return adapter.files.remove(p).catch(function () { return null; });
        }));
      });
    },

    publishedMarketItems: function () {
      return adapter.list('marketItems', { where: { status: 'published' } })
        .catch(function () { return []; });
    },

    myMarketItems: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('marketItems', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    allMarketItems: function () {
      return adapter.list('marketItems');
    },

    /* -------- 설치 대행 문의 --------
       물건을 산 교회가 "달아 주세요" 하고 부르는 창구입니다.
       여기가 센터의 수익이 나는 자리라, 접수되면 관리자 화면에 바로 뜹니다. */

    submitInstallRequest: function (data) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('설치를 신청하려면 로그인해 주세요.'));
      var tier = INSTALL_TIERS[data && data.tier] ? data.tier : 'install';
      var record = Object.assign({
        itemId: '', itemTitle: '', churchName: '', region: '', address: '',
        floor: '', elevator: '', wishDate: '',
        contactName: '', contactPhone: '', contactHours: '', note: '',
      }, data, {
        tier: tier,
        userId: me.id,
        userEmail: me.email || '',
        status: 'received',
        quoteAmount: 0, quoteNote: '', assigneeId: '',
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      return adapter.add('installRequests', record);
    },

    /** 관리자 → 견적 · 일정 · 완료 처리 */
    updateInstallRequest: function (id, patch) {
      return adapter.update('installRequests', id, Object.assign({}, patch, { updatedAt: nowIso() }));
    },

    myInstallRequests: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('installRequests', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    allInstallRequests: function () {
      return adapter.list('installRequests');
    },

    /* =====================================================
       교회 게스트하우스 (guestHouses)

       비어 있는 사택 · 선교관을 교회가 내어 놓고,
       해외에서 들어와 한국에 머무르는 사역자 · 선교사 · 유학생이 빌려 씁니다.
       센터는 게시판만 봅니다 — 요금과 기간은 두 분이 직접 정하십니다.
       ===================================================== */

    guestLive: function (row) {
      return !!row && row.status === 'published';
    },

    guestView: function (row) {
      if (!row) return { status: 'none', label: '-', cls: 'none', live: false, photos: [] };
      var types = (Array.isArray(row.guestTypes) ? row.guestTypes : [])
        .map(function (k) { return GUEST_TYPES[k] || k; });
      var amen = (Array.isArray(row.amenities) ? row.amenities : [])
        .map(function (k) { return GUEST_AMENITIES[k] || k; });
      return {
        status: row.status,
        label: GUEST_STATUS[row.status] || row.status,
        cls: row.status,
        live: row.status === 'published',
        roomLabel: GUEST_ROOM_TYPE[row.roomType] || row.roomType || '',
        bathLabel: GUEST_BATH[row.bath] || '',
        typeLabels: types,
        amenityLabels: amen,
        languages: Array.isArray(row.languages) ? row.languages : [],
        photos: Array.isArray(row.photos) ? row.photos : [],
      };
    },

    /** 요금 한 줄 — 채워 넣은 단위만 보여 줍니다. */
    guestPrice: function (row) {
      if (!row) return '-';
      if (row.freeStay) return '무료 (사례는 교회와 상의)';
      var m = api.money;
      var bits = [];
      if (Number(row.priceNight)) bits.push('1박 ' + m(row.priceNight) + '원');
      if (Number(row.priceWeek)) bits.push('주 ' + m(row.priceWeek) + '원');
      if (Number(row.priceMonth)) bits.push('월 ' + m(row.priceMonth) + '원');
      return bits.length ? bits.join(' · ') : '요금 문의';
    },

    submitGuestHouse: function (data) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('게스트하우스를 올리려면 로그인해 주세요.'));
      var record = Object.assign({
        churchName: '', denomination: '', title: '', roomType: 'private',
        guestsMax: 2, rooms: 1, beds: '', bath: 'private',
        region: '', addressRough: '', nearest: '',
        priceNight: 0, priceWeek: 0, priceMonth: 0, deposit: 0, freeStay: false,
        minNights: 1, maxNights: 0,
        guestTypes: [], amenities: [], houseRules: '', languages: [],
        availableFrom: '', availableTo: '', desc: '',
        contactName: '', contactPhone: '', contactHours: '', photos: [],
      }, data, {
        userId: me.id,
        userEmail: me.email || '',
        status: 'pending',
        rejectNote: '', views: 0,
        reviewedBy: '', reviewedAt: '', publishedAt: '', hiddenAt: '',
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      return adapter.add('guestHouses', record);
    },

    saveGuestHouse: function (id, data) {
      return adapter.update('guestHouses', id, Object.assign({}, data, {
        status: 'pending', rejectNote: '',
        reviewedBy: '', reviewedAt: '', publishedAt: '',
        updatedAt: nowIso(),
      }));
    },

    approveGuestHouse: function (id) {
      var me = adapter.auth.current();
      return adapter.update('guestHouses', id, {
        status: 'published', publishedAt: nowIso(), rejectNote: '', hiddenAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    rejectGuestHouse: function (id, note) {
      var me = adapter.auth.current();
      var reason = String(note || '').trim();
      if (!reason) return Promise.reject(new Error('반려 사유를 적어 주세요. 등록자에게 그대로 보입니다.'));
      return adapter.update('guestHouses', id, {
        status: 'rejected', rejectNote: reason, publishedAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    hideGuestHouse: function (id, note) {
      var me = adapter.auth.current();
      return adapter.update('guestHouses', id, {
        status: 'hidden', hiddenAt: nowIso(), rejectNote: String(note || '').trim(),
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    /** 방이 나갔습니다 — 내어 놓은 교회가 직접 내립니다. */
    markGuestDone: function (id) {
      return adapter.update('guestHouses', id, { status: 'done', updatedAt: nowIso() });
    },

    deleteGuestHouse: function (row) {
      var id = typeof row === 'string' ? row : (row && row.id);
      if (!id) return Promise.resolve();
      var doc = typeof row === 'object' ? row : null;
      var paths = (doc && Array.isArray(doc.photos) ? doc.photos : [])
        .filter(function (ph) { return ph && ph.path; }).map(function (ph) { return ph.path; });
      return adapter.remove('guestHouses', id).then(function () {
        return Promise.all(paths.map(function (p) {
          return adapter.files.remove(p).catch(function () { return null; });
        }));
      });
    },

    publishedGuestHouses: function () {
      return adapter.list('guestHouses', { where: { status: 'published' } })
        .catch(function () { return []; });
    },

    myGuestHouses: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('guestHouses', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    allGuestHouses: function () {
      return adapter.list('guestHouses');
    },

    /* =====================================================
       집회 · 찬양집회 티켓팅 (events · ticketOrders)

       흐름
         1. 주최 측이 집회를 올립니다                     → pending
         2. 관리자가 주최 · 장소 · 일시를 확인해 게시      → published
         3. 예매 시작 시각(openAt)이 되어야 버튼이 열립니다
         4. 정원이 차면 자동으로                          → closed
              "정원이 모두 찼습니다 — 마감되었습니다"

       정원 확인과 자리 차지를 브라우저에서 나눠 하면,
       오픈 직후 동시에 눌린 신청이 정원을 넘길 수 있습니다.
       그래서 신청은 데이터베이스 함수 reserve_tickets() 한 번으로 처리합니다.
       ===================================================== */

    /** 예매가 열리는 시각이 지났는지 */
    ticketOpen: function (row) {
      if (!row || !row.openAt) return true;
      return Date.now() >= new Date(row.openAt).getTime();
    },

    /** 남은 자리 — 정원이 0 이면 제한 없음(null) */
    seatsLeft: function (row) {
      if (!row || !Number(row.capacity)) return null;
      return Math.max(0, Number(row.capacity) - Number(row.taken || 0));
    },

    /**
     * 신청 버튼의 상태를 한 곳에서 정합니다.
     * 화면 세 군데(목록 · 상세 · 내 신청)가 같은 답을 쓰게 하려는 것입니다.
     */
    eventView: function (row) {
      if (!row) {
        return { status: 'none', label: '-', cls: 'none', can: false, why: '', photos: [] };
      }
      var left = api.seatsLeft(row);
      var opened = api.ticketOpen(row);
      var closedByTime = !!row.closeAt && Date.now() > new Date(row.closeAt).getTime();
      var over = !!row.startsAt && Date.now() > new Date(row.startsAt).getTime();
      var full = left === 0;

      var status = row.status;
      if (status === 'published') {
        if (full) status = 'closed';
        else if (over) status = 'done';
      }

      var can = row.status === 'published' && !full && !closedByTime && !over && opened;
      var why = '';
      if (row.status === 'closed' || full) why = '정원이 모두 찼습니다 — 신청이 마감되었습니다.';
      else if (row.status !== 'published') why = '지금은 신청을 받지 않습니다.';
      else if (over) why = '이미 지난 집회입니다.';
      else if (closedByTime) why = '신청 기간이 끝났습니다.';
      else if (!opened) why = '아직 예매가 열리지 않았습니다.';

      return {
        status: status,
        label: EVENT_STATUS[status] || status,
        cls: status,
        categoryLabel: EVENT_CATEGORIES[row.category] || row.category || '',
        can: can,
        why: why,
        opened: opened,
        full: full,
        over: over,
        left: left,
        capacity: Number(row.capacity) || 0,
        taken: Number(row.taken) || 0,
        // 정원 대비 얼마나 찼는지 (막대 그래프용)
        pct: Number(row.capacity) > 0
          ? Math.min(100, Math.round((Number(row.taken) || 0) / Number(row.capacity) * 100))
          : null,
        seating: !!row.seatingOn,
        perPersonMax: Number(row.perPersonMax) > 0 ? Number(row.perPersonMax) : 4,
        photos: Array.isArray(row.photos) ? row.photos : [],
        poster: row.poster || (Array.isArray(row.photos) && row.photos[0]) || null,
      };
    },

    /** 참가비 한 줄 — 얼리버드가 살아 있으면 그 값을 앞세웁니다. */
    eventPrice: function (row) {
      if (!row) return '-';
      if (row.freeEvent) return '무료';
      var m = api.money;
      var early = Number(row.earlyPrice) > 0
        && (!row.earlyUntil || Date.now() <= new Date(row.earlyUntil).getTime());
      if (early) return '얼리버드 ' + m(row.earlyPrice) + '원 (정가 ' + m(row.price) + '원)';
      if (!Number(row.price)) return '무료';
      return m(row.price) + '원';
    },

    /** 예매 시작까지 남은 시간 — 초 단위. 이미 열렸으면 0.
     *  올림으로 셉니다 — 반올림하면 아직 열리지 않았는데 "0초"가 떠서
     *  화면이 열린 것처럼 보이는 순간이 생깁니다. */
    openInSeconds: function (row) {
      if (!row || !row.openAt) return 0;
      return Math.max(0, Math.ceil((new Date(row.openAt).getTime() - Date.now()) / 1000));
    },

    /* -------- 좌석도 --------
       필수가 아닙니다. 쓰지 않으면 인원수로만 받습니다.
       모양은 { rows: [{ name, seats: [{ id, no, off }] }], note } 입니다.
       'off' 는 통로 · 기둥처럼 앉을 수 없는 자리입니다. */

    /** 줄 수 · 줄당 좌석 수로 기본 좌석도를 만듭니다. */
    makeSeatmap: function (rowCount, perRow, note) {
      var rows = [];
      var n = Math.max(1, Math.min(30, Number(rowCount) || 0));
      var w = Math.max(1, Math.min(40, Number(perRow) || 0));
      for (var i = 0; i < n; i++) {
        var name = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26) + 1) : '');
        var seats = [];
        for (var j = 1; j <= w; j++) {
          seats.push({ id: name + '-' + j, no: String(j), off: false });
        }
        rows.push({ name: name, seats: seats });
      }
      return { rows: rows, note: String(note || '') };
    },

    /** 좌석도에서 실제로 앉을 수 있는 자리 수 */
    seatmapCount: function (map) {
      var rows = (map && Array.isArray(map.rows)) ? map.rows : [];
      return rows.reduce(function (sum, r) {
        return sum + (r.seats || []).filter(function (s) { return !s.off; }).length;
      }, 0);
    },

    /** 이미 팔린 좌석 아이디 목록 */
    takenSeats: function (orders) {
      var out = {};
      (orders || []).forEach(function (o) {
        if (!o || o.status === 'canceled') return;
        (Array.isArray(o.seats) ? o.seats : []).forEach(function (id) { out[id] = true; });
      });
      return out;
    },

    submitEvent: function (data) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('집회를 올리려면 로그인해 주세요.'));
      var record = Object.assign({
        category: 'praise', title: '', subtitle: '', host: '', speakers: '',
        region: '', venue: '', address: '',
        startsAt: '', endsAt: '', scheduleNote: '',
        openAt: '', closeAt: '', capacity: 0, perPersonMax: 4,
        price: 0, earlyPrice: 0, earlyUntil: '', freeEvent: false, ageNote: '',
        seatingOn: false, seatmap: {}, poster: null, photos: [],
        desc: '', notice: '',
        contactName: '', contactPhone: '', contactHours: '',
      }, data, {
        userId: me.id,
        userEmail: me.email || '',
        status: 'pending',
        taken: 0,
        rejectNote: '', views: 0,
        reviewedBy: '', reviewedAt: '', publishedAt: '', hiddenAt: '',
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      return adapter.add('events', record);
    },

    /**
     * 주최자가 내용을 고칩니다.
     * 이미 신청한 분이 있으면 정원 · 일시를 함부로 바꿀 수 없게 막습니다 —
     * 신청해 둔 분들의 약속이 조용히 바뀌는 일을 막기 위한 것입니다.
     */
    saveEvent: function (id, data, current) {
      var taken = Number(current && current.taken) || 0;
      if (taken > 0) {
        var cap = Number(data.capacity) || 0;
        if (cap > 0 && cap < taken) {
          return Promise.reject(new Error(
            '이미 ' + taken + '명이 신청하셨습니다. 정원을 그보다 적게 줄이실 수 없습니다.'
          ));
        }
      }
      return adapter.update('events', id, Object.assign({}, data, {
        status: 'pending', rejectNote: '',
        reviewedBy: '', reviewedAt: '', publishedAt: '',
        updatedAt: nowIso(),
      }));
    },

    approveEvent: function (id) {
      var me = adapter.auth.current();
      return adapter.update('events', id, {
        status: 'published', publishedAt: nowIso(), rejectNote: '', hiddenAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    rejectEvent: function (id, note) {
      var me = adapter.auth.current();
      var reason = String(note || '').trim();
      if (!reason) return Promise.reject(new Error('반려 사유를 적어 주세요. 주최 측에 그대로 보입니다.'));
      return adapter.update('events', id, {
        status: 'rejected', rejectNote: reason, publishedAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    hideEvent: function (id, note) {
      var me = adapter.auth.current();
      return adapter.update('events', id, {
        status: 'hidden', hiddenAt: nowIso(), rejectNote: String(note || '').trim(),
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    /** 주최자 · 관리자가 손으로 마감합니다 (정원이 남아 있어도). */
    closeEvent: function (id) {
      return adapter.update('events', id, { status: 'closed', updatedAt: nowIso() });
    },

    /** 마감을 풀어 다시 신청을 받습니다. */
    reopenEvent: function (id) {
      return adapter.update('events', id, { status: 'published', updatedAt: nowIso() });
    },

    deleteEvent: function (row) {
      var id = typeof row === 'string' ? row : (row && row.id);
      if (!id) return Promise.resolve();
      var doc = typeof row === 'object' ? row : null;
      var paths = (doc && Array.isArray(doc.photos) ? doc.photos : [])
        .filter(function (ph) { return ph && ph.path; }).map(function (ph) { return ph.path; });
      return adapter.remove('events', id).then(function () {
        return Promise.all(paths.map(function (p) {
          return adapter.files.remove(p).catch(function () { return null; });
        }));
      });
    },

    /** 공개 목록 — 마감된 집회도 함께 보여 줍니다 ("마감" 을 읽어야 하니까요). */
    publishedEvents: function () {
      var wanted = { published: true, closed: true, done: true };
      return adapter.list('events')
        .then(function (rows) {
          return rows.filter(function (r) { return wanted[r.status]; });
        })
        .catch(function () {
          // 로그인 없이 보는 경우, 조회 범위를 좁혀 다시 시도합니다.
          return adapter.list('events', { where: { status: 'published' } })
            .catch(function () { return []; });
        });
    },

    myEvents: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('events', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    allEvents: function () {
      return adapter.list('events');
    },

    /* -------- 신청 (ticketOrders) -------- */

    /**
     * 신청합니다.
     * Supabase 에서는 데이터베이스 함수 하나로 처리합니다 — 정원 확인과
     * 자리 차지가 같은 잠금 안에서 일어나야 동시 신청에도 정원을 넘지 않습니다.
     * 설정이 없는 데모(브라우저 저장소)에서는 같은 순서를 흉내 냅니다.
     */
    reserveTickets: function (eventId, opts) {
      var o = opts || {};
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('신청하려면 로그인해 주세요.'));
      var qty = Math.max(1, Number(o.qty) || 1);
      var seats = Array.isArray(o.seats) ? o.seats : [];

      if (adapter.rpc) {
        return adapter.rpc('reserve_tickets', {
          p_event: eventId,
          p_qty: qty,
          p_seats: seats,
          p_name: o.name || '',
          p_phone: o.phone || '',
          p_church: o.churchName || '',
          p_note: o.note || '',
        });
      }

      // 데모 — 한 사람만 쓰는 브라우저 저장소라 경쟁이 없습니다.
      return adapter.get('events', eventId).then(function (ev) {
        if (!ev) throw new Error('집회를 찾을 수 없습니다.');
        var v = api.eventView(ev);
        if (!v.can) throw new Error(v.why || '지금은 신청을 받지 않습니다.');
        if (qty > v.perPersonMax) {
          throw new Error('한 번에 최대 ' + v.perPersonMax + '명까지 신청하실 수 있습니다.');
        }
        if (v.left != null && qty > v.left) {
          throw new Error('정원이 모두 찼습니다. (남은 자리 ' + v.left + '석)');
        }
        return adapter.list('ticketOrders', { where: { eventId: eventId } }).then(function (orders) {
          var mine = (orders || []).filter(function (r) {
            return r.userId === me.id && r.status !== 'canceled';
          });
          if (mine.length) throw new Error('이미 신청하셨습니다. [내 신청 내역] 에서 확인해 주세요.');
          if (v.seating) {
            if (seats.length !== qty) throw new Error('좌석을 ' + qty + '개 골라 주세요.');
            var taken = api.takenSeats(orders);
            var clash = seats.filter(function (s) { return taken[s]; });
            if (clash.length) {
              throw new Error('방금 다른 분이 먼저 잡은 좌석이 있습니다. 좌석도를 새로 고쳐 주세요.');
            }
          }
          return adapter.add('ticketOrders', {
            eventId: eventId,
            userId: me.id,
            userEmail: me.email || '',
            eventTitle: ev.title || '',
            qty: qty,
            seats: v.seating ? seats : [],
            name: o.name || '',
            phone: o.phone || '',
            churchName: o.churchName || '',
            note: o.note || '',
            status: 'confirmed',
            code: Math.random().toString(36).slice(2, 10).toUpperCase(),
            canceledAt: '',
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }).then(function (saved) {
            var next = Number(ev.taken || 0) + qty;
            return adapter.update('events', eventId, {
              taken: next,
              status: (Number(ev.capacity) > 0 && next >= Number(ev.capacity)) ? 'closed' : ev.status,
              updatedAt: nowIso(),
            }).then(function () { return saved; });
          });
        });
      });
    },

    /** 신청 취소 — 자리를 정원으로 되돌립니다. */
    cancelTicket: function (orderId) {
      if (adapter.rpc) {
        return adapter.rpc('cancel_ticket', { p_order: orderId });
      }
      return adapter.get('ticketOrders', orderId).then(function (o) {
        if (!o) throw new Error('신청 내역을 찾을 수 없습니다.');
        if (o.status === 'canceled') return null;
        return adapter.update('ticketOrders', orderId, {
          status: 'canceled', canceledAt: nowIso(), updatedAt: nowIso(),
        }).then(function () {
          return adapter.get('events', o.eventId).then(function (ev) {
            if (!ev) return null;
            return adapter.update('events', o.eventId, {
              taken: Math.max(0, Number(ev.taken || 0) - Number(o.qty || 0)),
              status: ev.status === 'closed' ? 'published' : ev.status,
              updatedAt: nowIso(),
            });
          });
        });
      });
    },

    /** 내 신청 내역 */
    myTickets: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('ticketOrders', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    /** 한 집회의 신청자 명단 (주최자 · 직원만 읽힙니다) */
    eventTickets: function (eventId) {
      return adapter.list('ticketOrders', { where: { eventId: eventId } })
        .catch(function () { return []; });
    },

    allTickets: function () {
      return adapter.list('ticketOrders');
    },

    /** 관리자 · 주최자 → 입장 확인 */
    checkInTicket: function (id) {
      return adapter.update('ticketOrders', id, { status: 'checked_in', updatedAt: nowIso() });
    },

    /* =====================================================
       찾은 말 기록 (searchLogs)

       로그인하신 분만 남습니다. 로그인하지 않은 분은 아무것도
       저장하지 않습니다 — 남길 자리(계정)가 없기 때문입니다.

       무엇을 찾으셨는지는 개인정보라, 본인만 읽고 본인만 지울 수
       있게 해 두었습니다. 직원도 볼 수 없습니다.
       ===================================================== */

    /**
     * 찾은 말을 남깁니다.
     *
     * 글자를 칠 때마다 남기지 않습니다 — "교", "교역", "교역자" 가
     * 다 쌓이면 목록이 쓸모없어집니다. 실제로 결과를 눌러 들어가신
     * 말만 남깁니다.
     *
     * 실패해도 조용히 넘어갑니다. 기록을 남기지 못한 것 때문에
     * 찾기가 멈추면 안 됩니다.
     */
    logSearch: function (q) {
      var me = adapter.auth.current();
      var word = String(q || '').trim();
      if (!me || !word || word.length > 100) return Promise.resolve();
      if (!adapter.rpc) return Promise.resolve();
      return adapter.rpc('log_search', { p_q: word }).catch(function () { return null; });
    },

    /** 최근에 찾으신 말 (새것부터) */
    recentSearches: function (limit) {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('searchLogs', { where: { userId: me.id } })
        .then(function (rows) {
          return (rows || [])
            .sort(function (a, b) {
              return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
            })
            .slice(0, Math.max(1, Number(limit) || 8))
            .map(function (r) { return r.q; });
        })
        .catch(function () { return []; });
    },

    /** 기록을 한 번에 지웁니다 */
    clearSearches: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve();
      return adapter.list('searchLogs', { where: { userId: me.id } })
        .then(function (rows) {
          return Promise.all((rows || []).map(function (r) {
            return adapter.remove('searchLogs', r.id);
          }));
        });
    },

    /* =====================================================
       교역자 구인 공고 (jobPosts)

       교회가 사진과 글로 공고를 올리고, 사역자가 직접 보고 연락합니다.
       지원은 아직 사이트 안에서 받지 않습니다 — 공고의 연락처로 갑니다.
       ===================================================== */

    jobLive: function (row) {
      return !!row && row.status === 'published';
    },

    jobView: function (row) {
      if (!row) return { status: 'none', label: '-', cls: 'none', live: false, photos: [] };
      var pos = row.position === 'other'
        ? (String(row.positionOther || '').trim() || '기타')
        : (JOB_POSITIONS[row.position] || row.position || '');
      // 마감일이 지났으면 목록에서 조용히 내려갑니다.
      var closed = !!row.closesAt && Date.now() > new Date(row.closesAt).getTime();
      var status = (row.status === 'published' && closed) ? 'done' : row.status;
      return {
        status: status,
        label: JOB_STATUS[status] || status,
        cls: status,
        live: status === 'published',
        closed: closed,
        positionLabel: pos,
        employmentLabel: JOB_EMPLOYMENT[row.employment] || '',
        housingLabel: JOB_HOUSING[row.housing] || '',
        photos: Array.isArray(row.photos) ? row.photos : [],
      };
    },

    /**
     * 사례비 한 줄.
     * "협의" 만 적힌 공고는 보시는 분이 갈지 말지를 정할 수 없어,
     * 범위가 있으면 반드시 숫자로 보여 줍니다.
     */
    jobPay: function (row) {
      if (!row) return '-';
      if (row.payType === 'negotiable') return '면접 후 협의';
      var unit = row.payType === 'weekly' ? '주'
        : row.payType === 'per_service' ? '건당' : '월';
      var lo = Number(row.payMin) || 0;
      var hi = Number(row.payMax) || 0;
      if (!lo && !hi) return '면접 후 협의';
      if (lo && hi && hi > lo) return unit + ' ' + api.money(lo) + '~' + api.money(hi) + '원';
      return unit + ' ' + api.money(lo || hi) + '원';
    },

    submitJobPost: function (data) {
      var me = adapter.auth.current();
      if (!me) return Promise.reject(new Error('공고를 올리려면 로그인해 주세요.'));
      var record = Object.assign({
        churchName: '', denomination: '', churchSize: '', region: '', addressRough: '',
        title: '', position: 'assistant', positionOther: '', department: '',
        employment: 'full', headcount: 1,
        payType: 'monthly', payMin: 0, payMax: 0, payNote: '',
        housing: 'none', insurance: false,
        commuteNote: '', workDays: '', startDate: '', closesAt: '',
        qualification: '', desc: '', photos: [],
        contactName: '', contactPhone: '', contactEmail: '', contactHours: '',
      }, data, {
        userId: me.id,
        userEmail: me.email || '',
        status: 'pending',
        applyMode: 'contact',
        rejectNote: '', views: 0,
        reviewedBy: '', reviewedAt: '', publishedAt: '', hiddenAt: '',
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      return adapter.add('jobPosts', record);
    },

    saveJobPost: function (id, data) {
      return adapter.update('jobPosts', id, Object.assign({}, data, {
        status: 'pending', rejectNote: '',
        reviewedBy: '', reviewedAt: '', publishedAt: '',
        updatedAt: nowIso(),
      }));
    },

    approveJobPost: function (id) {
      var me = adapter.auth.current();
      return adapter.update('jobPosts', id, {
        status: 'published', publishedAt: nowIso(), rejectNote: '', hiddenAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    rejectJobPost: function (id, note) {
      var me = adapter.auth.current();
      var reason = String(note || '').trim();
      if (!reason) return Promise.reject(new Error('반려 사유를 적어 주세요. 교회에 그대로 보입니다.'));
      return adapter.update('jobPosts', id, {
        status: 'rejected', rejectNote: reason, publishedAt: '',
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    hideJobPost: function (id, note) {
      var me = adapter.auth.current();
      return adapter.update('jobPosts', id, {
        status: 'hidden', hiddenAt: nowIso(), rejectNote: String(note || '').trim(),
        reviewedBy: me ? me.id : '', reviewedAt: nowIso(), updatedAt: nowIso(),
      });
    },

    /** 사람을 구했습니다 — 교회가 직접 내립니다. */
    markJobDone: function (id) {
      return adapter.update('jobPosts', id, { status: 'done', updatedAt: nowIso() });
    },

    deleteJobPost: function (row) {
      var id = typeof row === 'string' ? row : (row && row.id);
      if (!id) return Promise.resolve();
      var doc = typeof row === 'object' ? row : null;
      var paths = (doc && Array.isArray(doc.photos) ? doc.photos : [])
        .filter(function (ph) { return ph && ph.path; }).map(function (ph) { return ph.path; });
      return adapter.remove('jobPosts', id).then(function () {
        return Promise.all(paths.map(function (p) {
          return adapter.files.remove(p).catch(function () { return null; });
        }));
      });
    },

    publishedJobPosts: function () {
      return adapter.list('jobPosts', { where: { status: 'published' } })
        .then(function (rows) {
          return rows.filter(function (r) { return !api.jobView(r).closed; });
        })
        .catch(function () { return []; });
    },

    myJobPosts: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('jobPosts', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    allJobPosts: function () {
      return adapter.list('jobPosts');
    },

    /* =====================================================
       카드 결제 (payments) — 아직 켜지 않았습니다

       site.payment.enabled 가 false 인 동안에는 paymentEnabled() 가
       거짓이라 화면에 결제 버튼이 아예 그려지지 않습니다.
       PG 계약이 끝나 그 값을 true 로 바꾸면 아래 흐름이 그대로 돕니다.

         1. openPayment()   서버가 결제 건을 열고 금액을 정합니다
                            (브라우저가 보낸 금액은 쓰지 않습니다)
         2. PG 결제창        브라우저가 띄웁니다 (공개 값만 씁니다)
         3. confirmPayment() Edge Function 이 PG 에 다시 물어 확인하고,
                            금액이 맞으면 매물을 바로 게시합니다
       ===================================================== */

    /** 카드 결제를 쓸 수 있는 상태인지 */
    paymentEnabled: function () {
      var p = window.CAPS_PAYMENT || {};
      return !!(p.enabled && p.provider && p.storeId);
    },

    /** 결제 설정 (화면이 안내 문구를 꺼내 쓸 때) */
    paymentConfig: function () {
      return window.CAPS_PAYMENT || {};
    },

    /** 결제 건을 엽니다 — 금액은 서버가 정합니다. */
    openPayment: function (kind, targetId) {
      if (!adapter.rpc) {
        return Promise.reject(new Error('카드 결제는 실제 서버에 연결된 뒤에 쓸 수 있습니다.'));
      }
      return adapter.rpc('open_payment', { p_kind: kind, p_target: targetId });
    },

    /** 결제창이 끝난 뒤 서버에 확인을 맡깁니다. */
    confirmPayment: function (orderId, providerPaymentId) {
      if (!adapter.fn) {
        return Promise.reject(new Error('카드 결제는 실제 서버에 연결된 뒤에 쓸 수 있습니다.'));
      }
      return adapter.fn('payment-confirm', {
        orderId: orderId,
        paymentId: providerPaymentId,
      });
    },

    /** 내 결제 내역 */
    myPayments: function () {
      var me = adapter.auth.current();
      if (!me) return Promise.resolve([]);
      return adapter.list('payments', { where: { userId: me.id } })
        .catch(function () { return []; });
    },

    /** 관리자 화면 — 전체 결제 내역 */
    allPayments: function () {
      return adapter.list('payments').catch(function () { return []; });
    },

    /** 관리자 화면에 들어올 수 있는 계정인지 */
    isStaff: function () {
      var u = adapter.auth.current();
      if (!u || !u.approved) return false;
      return u.role === 'owner' || u.role === 'admin' || u.role === 'staff';
    },

    roleLabel: function (role) {
      return (ROLES[role] || {}).label || role || '-';
    },

    /**
     * 신청서 제출.
     * requests 문서 하나만 만듭니다. 고객(customers) 연결은 관리자 화면에서 처리합니다.
     * — 고객 목록을 읽으려면 다른 교회 정보까지 볼 수 있어야 하므로,
     *   신청자 권한으로는 조회하지 않습니다.
     */
    submitRequest: function (data) {
      var me = adapter.auth.current();
      var record = Object.assign({}, data, {
        code: makeCode(),
        createdAt: nowIso(),
        status: 'received',
        assignee: '',
        dueDate: '',
        memo: '',
        tasks: [],
        userId: me ? me.id : '',
      });
      return adapter.add('requests', record);
    },

    /** 접수번호로 조회. 고객은 본인 신청만, 직원은 전체를 조회합니다. */
    findByCode: function (code) {
      var needle = String(code || '').trim().toUpperCase();
      if (!needle) return Promise.resolve(null);

      var me = adapter.auth.current();
      var isStaffUser = !!(me && me.approved &&
        ['owner', 'admin', 'staff'].indexOf(me.role) > -1);
      var opts = isStaffUser ? {} : { where: { userId: me ? me.id : '__none__' } };

      return adapter.list('requests', opts).then(function (rows) {
        var hit = rows.filter(function (r) {
          return String(r.code || '').toUpperCase() === needle;
        });
        return hit.length ? hit[0] : null;
      });
    },

    /** 지원 항목 공개 콘텐츠 (관리자가 수정한 내용) */
    serviceContent: function () {
      return adapter.list('serviceContent').then(function (rows) {
        var map = {};
        rows.forEach(function (r) { map[r.id] = r; });
        return map;
      });
    },

    formatDate: function (iso, withTime) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      var p = function (n) { return String(n).padStart(2, '0'); };
      var s = d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
      return withTime === false ? s : s + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },

    money: function (n) {
      return (Number(n) || 0).toLocaleString('ko-KR');
    },

    /**
     * 마감일까지 남은 일수(디데이)를 계산합니다.
     * @param {string} dateStr 'YYYY-MM-DD'
     * @returns {{days:number, label:string, cls:string, late:boolean}|null}
     */
    dday: function (dateStr) {
      if (!dateStr) return null;
      var parts = String(dateStr).split('-');
      if (parts.length !== 3) return null;

      var due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (isNaN(due.getTime())) return null;

      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var days = Math.round((due - today) / 864e5);

      if (days < 0) return { days: days, label: 'D+' + -days, cls: 'dd-late', late: true };
      if (days === 0) return { days: 0, label: 'D-DAY', cls: 'dd-today', late: false };
      if (days <= 3) return { days: days, label: 'D-' + days, cls: 'dd-soon', late: false };
      return { days: days, label: 'D-' + days, cls: 'dd-ok', late: false };
    },

    /** 작업이 끝난 상태인지 (지연 계산에서 제외) */
    isClosed: function (status) {
      return status === 'done' || status === 'canceled';
    },

    /**
     * 전화번호 입력칸을 숫자 11자리로 제한하고 하이픈을 자동으로 넣습니다.
     * (하이픈은 표시용이고, 실제로 입력받는 숫자는 최대 11자리입니다.)
     */
    /* =====================================================
       직분 선택 — 목록에 없으면 '기타'로 직접 입력합니다.

       화면에서는 select 하나와 text 하나를 짝지어 두고,
       저장되는 값은 언제나 실제 직분 이름입니다 ('기타'가 남지 않습니다).
       ===================================================== */

    ROLE_OPTIONS: ROLE_OPTIONS,

    /** select 옵션 태그 문자열 */
    roleOptionsHtml: function () {
      return '<option value="">선택해 주세요</option>' +
        ROLE_OPTIONS.map(function (r) { return '<option>' + r + '</option>'; }).join('');
    },

    /** '기타'를 고르면 직접 입력칸이 나타나도록 묶습니다. */
    bindRoleSelect: function (select, input) {
      if (!select || !input) return;
      var box = input.closest('.field') || input;
      var sync = function (keep) {
        var other = select.value === '기타';
        box.hidden = !other;
        input.disabled = !other || select.disabled;
        if (!other && !keep) input.value = '';
        if (other) input.setAttribute('placeholder', '직분을 직접 입력해 주세요');
      };
      select.addEventListener('change', function () { sync(false); });
      sync(true);
      return sync;
    },

    /** 최종 직분 값 — '기타'면 직접 입력한 내용 */
    roleValue: function (select, input) {
      var v = ((select && select.value) || '').trim();
      if (v !== '기타') return v;
      return ((input && input.value) || '').trim();
    },

    /** 저장된 직분을 select + input 에 채웁니다 (목록에 없으면 기타로) */
    setRoleValue: function (select, input, value) {
      if (!select) return;
      var v = String(value || '').trim();
      if (!v) select.value = '';
      else if (ROLE_OPTIONS.indexOf(v) > -1 && v !== '기타') select.value = v;
      else {
        select.value = '기타';
        if (input) input.value = v;
      }
      select.dispatchEvent(new Event('change'));
      // change 로 초기화되지 않도록 다시 채웁니다.
      if (input && select.value === '기타') input.value = v === '기타' ? '' : v;
    },

    bindPhoneInput: function (input) {
      if (!input) return;
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('maxlength', '13'); // 010-0000-0000
      input.addEventListener('input', function () {
        var d = input.value.replace(/\D/g, '').slice(0, 11);
        if (d.length < 4) { input.value = d; return; }
        if (d.startsWith('02')) {
          input.value = d.length <= 5 ? d.replace(/(\d{2})(\d+)/, '$1-$2')
            : d.length <= 9 ? d.replace(/(\d{2})(\d{3})(\d+)/, '$1-$2-$3')
            : d.replace(/(\d{2})(\d{4})(\d{1,4})/, '$1-$2-$3');
        } else {
          input.value = d.length <= 7 ? d.replace(/(\d{3})(\d+)/, '$1-$2')
            : d.length <= 10 ? d.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3')
            : d.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
        }
      });
    },

    /** 숫자만 세어 유효한 길이인지 확인 (휴대폰 11자리 · 서울 지역번호 9~10자리) */
    isValidPhone: function (value) {
      var d = String(value || '').replace(/\D/g, '');
      return d.length >= 9 && d.length <= 11;
    },

    /** 전화번호에 하이픈을 넣습니다. 형식을 알 수 없으면 원본을 그대로 돌려줍니다. */
    formatPhone: function (value) {
      var d = String(value || '').replace(/\D/g, '');
      if (d.length < 9 || d.length > 11) return String(value || '');
      if (d.startsWith('02')) {
        return d.length === 9
          ? d.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3')
          : d.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      return d.length === 10
        ? d.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
        : d.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    },

    serviceName: function (id) {
      var list = window.CAPS_SERVICES || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
      return id;
    },
  };

  return api;
})();
