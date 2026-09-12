'use strict';

/**
 * 게시판 세 갈래 — 중고 장터 · 게스트하우스 · 집회 티켓팅.
 *
 * 부동산 매물 게시판(build.js 의 buildListings)과 같은 뼈대를 씁니다.
 *   #list  목록 · #view/<id>  상세 · #new  등록 · #mine  내가 올린 것
 * 화면 클래스도 매물 게시판의 ls-* 를 그대로 씁니다 — 네 갈래가 한 곳처럼
 * 보여야 하고, 스타일이 갈래마다 갈라지면 나중에 손대기 어려워집니다.
 */

const T = require('./templates');

const { esc, icon, layout, pageHero, sectionHead, ctaBand, boardTabs, site } = T;

const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북',
  '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주'];

const regionFilter = (label) => ['<option value="">' + label + '</option>']
  .concat(REGIONS.map((r) => `<option>${r}</option>`)).join('');

const regionForm = () => '<option value="">선택해 주세요</option>'
  + REGIONS.map((r) => `<option>${r}</option>`).join('');

const opts = (pairs, first) =>
  (first ? [`<option value="">${esc(first)}</option>`] : [])
    .concat(pairs.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`))
    .join('');

/** 예시를 눌러 그대로 넣을 수 있는 칩 (매물 게시판과 같은 장치입니다) */
const egChips = (target, items) => `<div class="ls-eg" data-eg="${target}">
            <span class="ls-eg-label">예시</span>
            ${items.map((t) => `<button type="button" class="ls-eg-chip">${esc(t)}</button>`).join('\n            ')}
          </div>`;

/** 연락 가능 시간 조각 — 교회 일정은 예배에 매여 있어 빈칸에서 짓기 번거롭습니다. */
const HOURS_OK = ['평일 낮 10–18시', '평일 저녁 7–9시', '토요일 10–17시',
  '주일 오후 2–5시', '문자 남겨주시면 회신'];
const HOURS_AVOID = ['주일 오전 9–12시', '수요 예배 저녁 7–9시',
  '금요 기도회 밤 9–11시', '새벽 기도 5–7시'];

const hoursPicker = (target) => `<div class="ls-eg is-pick" data-eg="${target}">
            <div class="ls-eg-row">
              <span class="ls-eg-label">연락 되는 때</span>
              ${HOURS_OK.map((t) => `<button type="button" class="ls-eg-chip" data-add="ok">${esc(t)}</button>`).join('\n              ')}
            </div>
            <div class="ls-eg-row">
              <span class="ls-eg-label is-avoid">예배 · 기도회</span>
              ${HOURS_AVOID.map((t) => `<button type="button" class="ls-eg-chip is-avoid" data-add="avoid">${esc(t)}</button>`).join('\n              ')}
            </div>
            <p class="ls-eg-tip">
              누르면 <strong>칸에 더해집니다</strong> — 여러 개 고르셔도 됩니다.
              아래쪽(예배 · 기도회)은 <strong>&ldquo;… 제외&rdquo;</strong>로 들어갑니다.
              시간은 교회마다 다르니, 넣으신 뒤 칸에서 직접 고쳐 주세요.
            </p>
          </div>`;

/** 금액 입력칸 */
const money = (id, label, hint, kindsFor) =>
  `<div class="field ls-money"${kindsFor ? ` data-kinds="${kindsFor}"` : ''}>
            <label for="${id}">${esc(label)}</label>
            <div class="ls-won"><input type="text" id="${id}" inputmode="numeric" autocomplete="off" placeholder="0"><span>원</span></div>
            ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}
          </div>`;

/** 여러 개 고르는 네모칸 묶음 */
const checkGroup = (name, pairs) => pairs.map(([v, l]) =>
  `<label class="ls-chk"><input type="checkbox" name="${name}" value="${v}"><span>${esc(l)}</span></label>`
).join('\n            ');

/** 사진 올리는 칸 — 세 갈래가 같은 모양을 씁니다. */
const photoField = (prefix, max, min, note) => `<div class="field">
            <span class="label-txt">사진 <em>*</em> <small>(최대 ${max}장)</small></span>
            <p class="hint">${esc(note)}</p>
            <div class="ls-photo-pick">
              <input type="file" id="${prefix}FPhotos" accept="image/*" multiple hidden>
              <button type="button" class="btn btn-outline" id="${prefix}PhotoBtn">사진 고르기</button>
              <span class="ls-photo-count" id="${prefix}PhotoStatus">아직 올린 사진이 없습니다 (${min}장 이상 권합니다)</span>
            </div>
            <div class="ls-photo-grid" id="${prefix}PhotoGrid"></div>
          </div>`;

/** 목록 · 상세 · 내 글 · 등록 — 네 화면의 껍데기는 갈래마다 같습니다. */
function boardShell(o) {
  return `
<!-- ============ 목록 ============ -->
<section class="section" id="${o.prefix}Board">
  <div class="wrap">
    <div class="ls-bar">
      <div class="ls-search">
        ${icon('doc', 'ico ico-sm')}
        <input type="search" id="${o.prefix}Q" placeholder="${esc(o.searchHint)}" aria-label="검색">
      </div>
      ${o.filters}
      <span class="ls-count" id="${o.prefix}Count"></span>
    </div>

    <div class="ls-grid${o.gridClass ? ' ' + o.gridClass : ''}" id="${o.prefix}List" aria-live="polite">
      <p class="ls-loading">${esc(o.loadingText)}</p>
    </div>

    <div class="ls-empty" id="${o.prefix}Empty" hidden>
      <h2>${esc(o.emptyTitle)}</h2>
      <p>${esc(o.emptyLead)}</p>
      <a class="btn btn-primary" href="#new">${esc(o.newLabel)}</a>
    </div>

    <div class="ls-scope">
      <div class="ls-scope-card is-do">
        <h2>${icon('check', 'ico ico-sm')} 센터가 해 드리는 일</h2>
        <ul>
        ${o.does.map((t) => `<li>${esc(t)}</li>`).join('\n        ')}
        </ul>
      </div>
      <div class="ls-scope-card is-tip">
        <h2>${esc(o.tipTitle)}</h2>
        <p class="ls-scope-note">${o.tipBody}</p>
        <p class="ls-scope-fine">${esc(o.fineprint)}</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ 상세 ============ -->
<section class="section" id="${o.prefix}Detail" hidden>
  <div class="wrap narrow">
    <a class="ls-back" href="#list">← 목록으로</a>
    <div id="${o.prefix}DetailBody"></div>
  </div>
</section>

<!-- ============ 내가 올린 것 ============ -->
<section class="section" id="${o.prefix}Mine" hidden>
  <div class="wrap narrow">
    <a class="ls-back" href="#list">← 목록으로</a>
    ${sectionHead(o.mineEyebrow, o.mineTitle, o.mineLead, 'left')}
    <div id="${o.prefix}MineBody"></div>
  </div>
</section>

<!-- ============ 등록 ============ -->
<section class="section is-tint" id="${o.prefix}New" hidden>
  <div class="wrap narrow">
    <a class="ls-back" href="#list">← 목록으로</a>
    ${sectionHead(o.formEyebrow, o.formTitle, o.formLead, 'left')}

    <div class="ls-gate" id="${o.prefix}Gate" hidden>
      <p>${esc(o.gateText)}</p>
      <button type="button" class="btn btn-primary" id="${o.prefix}GateLogin">로그인 / 회원가입</button>
    </div>

    <form class="ls-form" id="${o.prefix}Form" novalidate hidden>
      <input type="hidden" id="${o.prefix}EditId" value="">
      ${o.formBody}
      <p class="form-msg is-err" id="${o.prefix}FormErr" hidden></p>
      <p class="form-msg is-ok" id="${o.prefix}FormOk" hidden></p>
      <div class="ls-form-actions">
        <button type="submit" class="btn btn-primary btn-lg" id="${o.prefix}Submit">${esc(o.submitLabel)}</button>
        <a class="btn btn-outline btn-lg" href="#list">취소</a>
      </div>
    </form>
  </div>
</section>
`;
}

/* =========================================================
   1. 중고 장터

   중고나라처럼 물건이 오가는 곳입니다. 다만 센터가 돈을 버는 자리는
   물건이 아니라 **설치** 입니다 — 스피커와 믹서를 싸게 사도
   예배당에 다는 일은 그대로 남기 때문입니다.
   그래서 목록 · 상세 · 등록 어디에서나 설치 대행이 함께 붙어 있습니다.
   ========================================================= */
function buildMarket(write) {
  const board = site.marketBoard;
  const tiers = board.install.tiers;

  const cats = [
    ['sound', '음향 (스피커 · 믹서 · 앰프)'],
    ['mic', '마이크 · 무선'],
    ['instrument', '악기'],
    ['video', '영상 · 프로젝터'],
    ['light', '조명'],
    ['furniture', '집기 (강대상 · 의자 · 장의자)'],
    ['office', '사무 · 전산'],
    ['kitchen', '주방 · 식당'],
    ['education', '교육 · 유아부'],
    ['other', '기타'],
  ];

  const conditions = [
    ['new', '미개봉'],
    ['like_new', '거의 새것'],
    ['good', '상태 좋음'],
    ['used', '사용감 있음'],
    ['broken', '고장 · 부품용'],
  ];

  const deliveries = [
    ['pickup', '직접 가지러 오셔야 합니다'],
    ['deliver', '보내 드릴 수 있습니다'],
    ['both', '직접 오셔도, 보내 드려도 됩니다'],
  ];

  const tierCards = tiers.map((t) => `<label class="ls-tier">
            <input type="radio" name="mkTier" value="${t.key}"${t.key === 'install' ? ' checked' : ''}>
            <span class="ls-tier-in">
              <strong>${esc(t.label)}</strong>
              <b>${t.price ? t.price.toLocaleString('ko-KR') + '원~' : '상담 후 견적'}</b>
              <small>${esc(t.desc)}</small>
            </span>
          </label>`).join('\n          ');

  const formBody = `
      <fieldset class="ls-fs">
        <legend><span class="ls-step">1</span> 무엇을 내놓으시나요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="mkFCategory">갈래 <em>*</em></label>
            <select id="mkFCategory">${opts(cats)}</select>
          </div>
          <div class="field" id="mkCatOtherBox" hidden>
            <label for="mkFCategoryOther">어떤 물건인가요? <em>*</em></label>
            <input type="text" id="mkFCategoryOther" placeholder="예: 성찬기 세트" maxlength="30">
          </div>
        </div>

        <div class="field">
          <label for="mkFTitle">제목 <em>*</em> <span class="ls-counter" id="mkTitleCount"></span></label>
          <input type="text" id="mkFTitle" maxlength="60"
            placeholder="예: JBL 액티브 스피커 2조 — 2년 사용, 소리 이상 없습니다">
          ${egChips('mkFTitle', [
    'JBL 액티브 스피커 2조 — 2년 사용, 소리 이상 없습니다',
    '야마하 믹서 MG16XU · 박스 · 설명서 있습니다',
    '무선 마이크 4채널 세트 (충전 거치대 포함)',
    '장의자 20개 — 교육관 리모델링으로 나눔합니다',
    '프로젝터 5000안시 + 스크린 100인치',
  ])}
        </div>

        <div class="grid-3">
          <div class="field">
            <label for="mkFBrand">만든 곳</label>
            <input type="text" id="mkFBrand" placeholder="예: JBL, 야마하" maxlength="30">
          </div>
          <div class="field">
            <label for="mkFModel">모델명</label>
            <input type="text" id="mkFModel" placeholder="예: EON615" maxlength="40">
          </div>
          <div class="field">
            <label for="mkFQuantity">수량</label>
            <input type="number" id="mkFQuantity" min="1" max="999" value="1">
          </div>
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="mkFCondition">상태 <em>*</em></label>
            <select id="mkFCondition">${opts(conditions)}</select>
          </div>
          <div class="field">
            <label for="mkFBoughtYear">들여온 해</label>
            <input type="text" id="mkFBoughtYear" inputmode="numeric" placeholder="예: 2021" maxlength="4">
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">2</span> 값과 넘기는 방법</legend>
        <label class="ls-chk is-wide"><input type="checkbox" id="mkFFree"><span>
          <strong>무료로 나눕니다</strong> — 값을 받지 않고 필요한 교회에 드립니다.</span></label>

        <div class="grid-2" id="mkPriceBox">
          ${money('mkFPrice', '값', '전체 수량의 값을 적어 주세요.')}
          <div class="field">
            <span class="label-txt">값 조정</span>
            <label class="ls-chk"><input type="checkbox" id="mkFNego"><span>조정할 수 있습니다</span></label>
          </div>
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="mkFRegion">지역 <em>*</em></label>
            <select id="mkFRegion">${regionForm()}</select>
          </div>
          <div class="field">
            <label for="mkFAddress">대략의 위치</label>
            <input type="text" id="mkFAddress" placeholder="예: 부천시 원미구 (자세한 주소는 연락 후에)" maxlength="60">
          </div>
        </div>

        <div class="field">
          <label for="mkFDelivery">넘기는 방법 <em>*</em></label>
          <select id="mkFDelivery">${opts(deliveries)}</select>
        </div>
      </fieldset>

      <fieldset class="ls-fs" id="mkInstallFs">
        <legend><span class="ls-step">3</span> 설치는 센터가 맡아도 될까요?</legend>
        <p class="ls-fs-lead">
          음향 · 영상 · 조명은 사고 나서 <strong>다는 일</strong>이 남습니다.
          그 일은 센터가 <strong>따로 비용을 받고</strong> 맡습니다.
          사시는 교회가 원하면 센터 음향팀이 철거 · 운반 · 설치 · 튜닝을 맡습니다.
          설치는 물건값과 <strong>별개로 비용이 드는 서비스</strong>이며,
          그 비용은 사시는 교회가 냅니다 — 파시는 분께 드는 비용은 없습니다.
        </p>
        <label class="ls-chk is-wide"><input type="checkbox" id="mkFInstallOk" checked><span>
          <strong>설치 대행을 안내해도 좋습니다</strong> — 글에 [설치 맡기기] 버튼이 붙습니다.</span></label>
        <div class="field">
          <label for="mkFInstallNote">설치할 때 알아둘 점</label>
          <textarea id="mkFInstallNote" rows="2" maxlength="200"
            placeholder="예: 2층이고 엘리베이터가 없습니다. 브라켓은 벽에 박혀 있어 떼어 가셔야 합니다."></textarea>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">4</span> 사진과 설명</legend>
        ${photoField('mk', board.photoMax, board.photoMin,
    '실제 물건을 찍은 사진을 올려 주세요. 상표 · 모델명이 보이는 사진과, '
    + '흠집이 있으면 흠집 사진도 함께 올리시면 헛걸음이 줄어듭니다.')}

        <div class="field">
          <label for="mkFDesc">설명 <em>*</em></label>
          <textarea id="mkFDesc" rows="7" maxlength="2000"
            placeholder="쓰신 기간, 왜 내놓으시는지, 함께 드리는 것(케이블 · 거치대 · 케이스), 흠집이나 고장 난 곳을 적어 주세요."></textarea>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">5</span> 연락처</legend>
        <p class="ls-fs-lead">사시려는 분이 직접 연락합니다. 센터는 중간에 서지 않습니다.</p>
        <div class="grid-2">
          <div class="field">
            <label for="mkFContactName">성함 <em>*</em></label>
            <input type="text" id="mkFContactName" maxlength="20" autocomplete="name">
          </div>
          <div class="field">
            <label for="mkFContactPhone">연락처 <em>*</em></label>
            <input type="tel" id="mkFContactPhone" placeholder="010-0000-0000" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="mkFHours">연락 가능 시간 <em>*</em></label>
          <input type="text" id="mkFHours" maxlength="120" placeholder="예: 평일 낮 10–18시 · 주일 오전 제외">
          ${hoursPicker('mkFHours')}
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">6</span> 확인</legend>
        <div class="ls-vows">
          <label class="ls-chk is-wide"><input type="checkbox" id="mkVow1"><span>
            제가 이 물건을 <strong>실제로 가지고 있고, 넘길 권한이 있습니다.</strong></span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="mkVow2"><span>
            사진과 설명은 <strong>이 물건을 실제로 찍고 적은 것</strong>입니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="mkVow3"><span>
            값 · 대금 · 인수인계는 <strong>사시는 분과 제가 직접</strong> 하며,
            센터는 게시판 관리와 설치 대행만 한다는 것을 압니다.</span></label>
        </div>
      </fieldset>`;

  const filters = `<select id="mkCategory" aria-label="갈래">${opts(cats, '전체 갈래')}</select>
      <select id="mkCondition" aria-label="상태">${opts(conditions, '전체 상태')}</select>
      <select id="mkRegion" aria-label="지역">${regionFilter('전체 지역')}</select>
      <label class="ls-toggle"><input type="checkbox" id="mkInstallOnly"><span>설치 가능한 것만</span></label>`;

  const body = `
${boardTabs('', 'market.html')}

${pageHero({
    eyebrow: '중고 장터 · 교회 물품',
    title: '교회에서 쓰던 것을<br>필요한 교회로',
    lead: '스피커와 믹서, 악기, 장의자까지 — 교회에서 나온 물건이 다른 교회로 갑니다. '
      + '설치까지 필요하시면 센터 음향팀이 철거 · 운반 · 설치 · 튜닝을 맡습니다 — 물건값과 별개로 비용이 듭니다.',
    extra: `<div class="ls-hero-meta">
      <span class="ls-hero-pill">사진 <strong>최대 ${board.photoMax}장</strong></span>
      <span class="ls-hero-pill is-key">설치 대행 <strong>별도 비용 · 상담 후 견적</strong></span>
    </div>
    <div class="ls-hero-actions">
      <a class="btn btn-gold btn-lg" href="#new" id="mkNewBtn">물건 올리기 ${icon('arrow', 'ico ico-sm')}</a>
      <a class="btn btn-outline btn-lg" href="#mine">내가 올린 물건</a>
    </div>`,
  })}

<!-- ============ 설치 대행 안내 ============ -->
<section class="section is-tint" id="mkInstall">
  <div class="wrap">
    ${sectionHead('설치 대행', '사는 것까지는 쉽습니다 — 다는 것이 일입니다',
    '중고로 싸게 산 스피커도, 예배당 천장에 달고 배선을 정리하고 소리를 잡는 일은 남습니다. '
    + '그 일을 센터 음향팀이 맡습니다 — 물건값에 포함되지 않는 별도 유상 서비스입니다. '
    + '장터에 올라온 물건이 아니어도 부르실 수 있습니다.')}
    <div class="ls-tiers">
      ${tiers.map((t) => `<div class="ls-tier-card">
        <h3>${esc(t.label)}</h3>
        <p class="ls-tier-price">${t.price
          ? t.price.toLocaleString('ko-KR') + '<span>원~</span>'
          : '<span class="is-ask">상담 후 견적</span>'}</p>
        <p>${esc(t.desc)}</p>
      </div>`).join('\n      ')}
    </div>
    <p class="ls-tier-note">${esc(board.install.note)}</p>
    <div class="ls-tier-cta">
      <a class="btn btn-primary btn-lg" href="#install">설치 대행 신청하기 ${icon('arrow', 'ico ico-sm')}</a>
      <a class="btn btn-outline btn-lg" href="services/sound.html">음향 지원 항목 보기</a>
    </div>
  </div>
</section>

${boardShell({
    prefix: 'mk',
    searchHint: '물건 이름 · 상표로 검색 (예: 스피커, 야마하)',
    filters,
    loadingText: '올라온 물건을 불러오는 중입니다…',
    emptyTitle: '아직 올라온 물건이 없습니다',
    emptyLead: '조건을 바꿔 다시 찾아보시거나, 쓰지 않는 물건을 먼저 올려 주세요.',
    newLabel: '물건 올리기',
    does: board.does,
    tipTitle: '사시기 전에 확인하세요',
    tipBody: '중고 음향 장비는 <strong>소리를 직접 들어 보는 것</strong>이 가장 확실합니다. '
      + '스피커는 유닛 찢어짐, 믹서는 페이더 잡음, 무선 마이크는 <strong>국내에서 쓸 수 있는 주파수</strong>인지 '
      + '(전파법상 허용 대역인지) 꼭 확인해 주세요. 판단이 어려우시면 설치 대행을 부르실 때 '
      + '점검을 함께 요청하시면 됩니다.',
    fineprint: board.fineprint,
    mineEyebrow: '내 물건',
    mineTitle: '내가 올린 물건',
    mineLead: '상태와 관리자 확인 결과를 여기에서 보실 수 있습니다.',
    formEyebrow: '물건 올리기',
    formTitle: '쓰지 않는 물건을 올립니다',
    formLead: '관리자가 사진과 설명을 확인한 뒤 게시됩니다.',
    gateText: '물건 등록은 로그인 후 이용하실 수 있습니다. 등록 후 진행 상태를 알려드리기 위해 계정이 필요합니다.',
    formBody,
    submitLabel: '등록 신청하기',
  })}

<!-- ============ 설치 대행 신청 ============ -->
<section class="section" id="mkInstallForm" hidden>
  <div class="wrap narrow">
    <a class="ls-back" href="#list">← 목록으로</a>
    ${sectionHead('설치 대행', '설치를 맡기시겠어요?',
    '실측 후 견적을 확정해 드립니다. 신청만으로 비용이 생기지 않습니다.', 'left')}

    <div class="ls-gate" id="mkIvGate" hidden>
      <p>설치 신청은 로그인 후 이용하실 수 있습니다.</p>
      <button type="button" class="btn btn-primary" id="mkIvGateLogin">로그인 / 회원가입</button>
    </div>

    <form class="ls-form" id="mkIvForm" novalidate hidden>
      <input type="hidden" id="mkIvItemId" value="">
      <div class="ls-iv-item" id="mkIvItem" hidden></div>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">1</span> 어디까지 맡기시겠어요?</legend>
        <div class="ls-tier-pick">
          ${tierCards}
        </div>
        <p class="ls-quote" id="mkIvQuote"></p>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">2</span> 어디에 설치하나요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="mkIvChurch">교회명 <em>*</em></label>
            <input type="text" id="mkIvChurch" maxlength="40">
          </div>
          <div class="field">
            <label for="mkIvRegion">지역 <em>*</em></label>
            <select id="mkIvRegion">${regionForm()}</select>
          </div>
        </div>
        <div class="field">
          <label for="mkIvAddress">주소 <em>*</em></label>
          <input type="text" id="mkIvAddress" maxlength="80" placeholder="설치할 예배당 주소">
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="mkIvFloor">층</label>
            <input type="text" id="mkIvFloor" maxlength="20" placeholder="예: 3층">
          </div>
          <div class="field">
            <label for="mkIvElevator">엘리베이터</label>
            <select id="mkIvElevator">
              <option value="">선택해 주세요</option>
              <option>있습니다</option>
              <option>없습니다</option>
              <option>있지만 장비가 안 들어갑니다</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="mkIvWish">원하시는 날짜</label>
          <input type="date" id="mkIvWish">
          <small class="hint">주일과 수요일은 예배가 있어 피하는 편이 좋습니다.</small>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">3</span> 연락처</legend>
        <div class="grid-2">
          <div class="field">
            <label for="mkIvName">성함 <em>*</em></label>
            <input type="text" id="mkIvName" maxlength="20" autocomplete="name">
          </div>
          <div class="field">
            <label for="mkIvPhone">연락처 <em>*</em></label>
            <input type="tel" id="mkIvPhone" placeholder="010-0000-0000" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="mkIvHours">연락 가능 시간</label>
          <input type="text" id="mkIvHours" maxlength="120" placeholder="예: 평일 낮 10–18시 · 주일 오전 제외">
          ${hoursPicker('mkIvHours')}
        </div>
        <div class="field">
          <label for="mkIvNote">남기실 말씀</label>
          <textarea id="mkIvNote" rows="4" maxlength="1000"
            placeholder="지금 쓰고 계신 장비, 예배당 크기(평), 언제까지 필요하신지 등을 적어 주시면 견적이 정확해집니다."></textarea>
        </div>
      </fieldset>

      <p class="form-msg is-err" id="mkIvErr" hidden></p>
      <p class="form-msg is-ok" id="mkIvOk" hidden></p>
      <div class="ls-form-actions">
        <button type="submit" class="btn btn-primary btn-lg" id="mkIvSubmit">설치 신청하기</button>
        <a class="btn btn-outline btn-lg" href="#list">취소</a>
      </div>
    </form>
  </div>
</section>

${ctaBand('', {
    title: '장비를 새로 들이실 계획이신가요?',
    lead: '중고로 채울 것과 새로 사야 할 것을 함께 정리해 드립니다.',
  })}
`;

  write('market.html', layout({
    title: '교회 중고 장터 | 우리교회지원센터',
    description: '교회 음향 · 악기 · 집기 중고 장터. 사시는 교회가 원하면 '
      + '센터 음향팀이 설치를 맡습니다 (별도 비용).',
    base: '',
    active: 'market.html',
    body,
    scripts: ['board-core.js', 'market.js'],
  }));
}

/* =========================================================
   2. 교회 게스트하우스
   ========================================================= */
function buildGuesthouse(write) {
  const board = site.guestHouseBoard;

  const roomTypes = [
    ['private', '독립된 방 하나'],
    ['share', '방을 함께 씁니다'],
    ['whole', '집 전체'],
    ['dorm', '여러 명이 쓰는 방'],
  ];

  const guestTypes = [
    ['missionary', '해외 선교사 · 사역자'],
    ['pastor', '방문 교역자'],
    ['student', '유학생 · 신학생'],
    ['family', '가족 단위'],
    ['team', '단기선교팀 · 청년팀'],
    ['anyone', '성도 누구나'],
  ];

  const amenities = [
    ['wifi', '와이파이'],
    ['kitchen', '주방 사용'],
    ['laundry', '세탁기'],
    ['aircon', '에어컨'],
    ['heating', '난방'],
    ['desk', '책상'],
    ['parking', '주차'],
    ['bedding', '이불 · 침구 제공'],
    ['bath_item', '세면도구'],
    ['elevator', '엘리베이터'],
  ];

  const languages = ['한국어', 'English', '中文', '日本語', 'Español', 'Русский'];

  const formBody = `
      <fieldset class="ls-fs">
        <legend><span class="ls-step">1</span> 어느 교회의 방인가요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="ghFChurch">교회명 <em>*</em></label>
            <input type="text" id="ghFChurch" maxlength="40" placeholder="예: 우리교회">
          </div>
          <div class="field">
            <label for="ghFDenom">교단</label>
            <input type="text" id="ghFDenom" maxlength="30" placeholder="예: 예장 합동">
          </div>
        </div>
        <div class="field">
          <label for="ghFTitle">제목 <em>*</em> <span class="ls-counter" id="ghTitleCount"></span></label>
          <input type="text" id="ghFTitle" maxlength="60"
            placeholder="예: 선교관 독립 원룸 — 지하철 5분, 단기 체류 환영">
          ${egChips('ghFTitle', [
    '선교관 독립 원룸 — 지하철 5분, 단기 체류 환영',
    '비어 있는 사택 방 하나 — 주방 · 세탁기 함께 씁니다',
    '수양관 별채 전체 — 가족 단위로 오셔도 됩니다',
    '안식년 오신 선교사님을 위한 방 (무료, 사례 불필요)',
    '신학생 장기 체류 가능 — 책상 · 인터넷 있습니다',
  ])}
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">2</span> 어떤 방인가요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="ghFRoomType">형태 <em>*</em></label>
            <select id="ghFRoomType">${opts(roomTypes)}</select>
          </div>
          <div class="field">
            <label for="ghFBath">화장실 <em>*</em></label>
            <select id="ghFBath">
              <option value="private">방 안 화장실</option>
              <option value="shared">함께 쓰는 화장실</option>
            </select>
          </div>
        </div>
        <div class="grid-3">
          <div class="field">
            <label for="ghFGuests">최대 인원 <em>*</em></label>
            <input type="number" id="ghFGuests" min="1" max="50" value="2">
          </div>
          <div class="field">
            <label for="ghFRooms">방 수</label>
            <input type="number" id="ghFRooms" min="1" max="30" value="1">
          </div>
          <div class="field">
            <label for="ghFBeds">잠자리</label>
            <input type="text" id="ghFBeds" maxlength="30" placeholder="예: 싱글 침대 2 · 이불 2채">
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="ghFRegion">지역 <em>*</em></label>
            <select id="ghFRegion">${regionForm()}</select>
          </div>
          <div class="field">
            <label for="ghFAddress">대략의 위치</label>
            <input type="text" id="ghFAddress" placeholder="예: 서울 은평구 (자세한 주소는 연락 후에)" maxlength="60">
          </div>
        </div>
        <div class="field">
          <label for="ghFNearest">가까운 역 · 정류장</label>
          <input type="text" id="ghFNearest" maxlength="60" placeholder="예: 지하철 3호선 연신내역 도보 7분">
        </div>
        <div class="field">
          <span class="label-txt">있는 것 <small>(해당하는 것을 모두 골라 주세요)</small></span>
          <div class="ls-chks">
            ${checkGroup('ghAmenity', amenities)}
          </div>
        </div>
        <div class="field">
          <span class="label-txt">쓰실 수 있는 언어</span>
          <div class="ls-chks">
            ${languages.map((l) => `<label class="ls-chk"><input type="checkbox" name="ghLang" value="${esc(l)}"><span>${esc(l)}</span></label>`).join('\n            ')}
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">3</span> 요금과 기간</legend>
        <p class="ls-fs-lead">
          교회 건물에서 <strong>숙박비를 받으시려면 숙박업 신고가 되어 있어야 합니다.</strong>
          신고 없이 요금을 받으시면 교회가 곤란해집니다. 그래서 이 게시판에는
          <strong>무료로 내어 놓는 방</strong>과 <strong>숙박업 신고가 된 시설</strong>만 올리실 수 있습니다.
        </p>
        <div class="ls-chks is-stack">
          <label class="ls-chk is-wide"><input type="radio" name="ghPay" value="free" id="ghFFree" checked><span>
            <strong>무료로 내어 놓습니다</strong> — 요금을 받지 않습니다.
            사례 여부는 오시는 분과 상의합니다.</span></label>
          <label class="ls-chk is-wide"><input type="radio" name="ghPay" value="licensed" id="ghFLicensed"><span>
            <strong>숙박업 신고가 된 시설입니다</strong> — 수양관 · 기도원처럼
            요금을 받을 수 있도록 신고되어 있습니다.</span></label>
        </div>

        <div id="ghPriceBox">
          <p class="ls-fs-lead">쓰시는 단위만 채워 주세요. 비워 두면 보여 주지 않습니다.</p>
          <div class="grid-3">
            ${money('ghFNight', '1박', '')}
            ${money('ghFWeek', '주 단위', '')}
            ${money('ghFMonth', '월 단위', '')}
          </div>
          ${money('ghFDeposit', '보증금', '없으면 비워 두세요.')}
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="ghFMinNights">최소 며칠부터</label>
            <input type="number" id="ghFMinNights" min="1" max="365" value="1">
          </div>
          <div class="field">
            <label for="ghFMaxNights">최대 며칠까지</label>
            <input type="number" id="ghFMaxNights" min="0" max="3650" placeholder="제한 없으면 비워 두세요">
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="ghFFrom">언제부터 가능한가요</label>
            <input type="date" id="ghFFrom">
          </div>
          <div class="field">
            <label for="ghFTo">언제까지 가능한가요</label>
            <input type="date" id="ghFTo">
          </div>
        </div>
        <div class="field">
          <span class="label-txt">누가 머무를 수 있나요? <em>*</em></span>
          <div class="ls-chks">
            ${checkGroup('ghType', guestTypes)}
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">4</span> 사진과 안내</legend>
        ${photoField('gh', board.photoMax, board.photoMin,
    '방 · 화장실 · 주방 · 건물 바깥을 각각 한 장씩은 넣어 주세요. '
    + '멀리서 오시는 분일수록 사진 말고는 볼 방법이 없습니다.')}

        <div class="field">
          <label for="ghFDesc">소개 <em>*</em></label>
          <textarea id="ghFDesc" rows="7" maxlength="2000"
            placeholder="방의 분위기, 교회와의 거리, 주변에 무엇이 있는지, 어떤 분들이 머물다 가셨는지를 적어 주세요."></textarea>
        </div>
        <div class="field">
          <label for="ghFRules">지켜 주셨으면 하는 것</label>
          <textarea id="ghFRules" rows="4" maxlength="1000"
            placeholder="예: 흡연은 어렵습니다 · 밤 11시 이후에는 조용히 부탁드립니다 · 주일 오전에는 주차장을 비워 주세요."></textarea>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">5</span> 연락처</legend>
        <p class="ls-fs-lead">머무실 분이 직접 연락합니다. 센터는 중간에 서지 않습니다.</p>
        <div class="grid-2">
          <div class="field">
            <label for="ghFContactName">성함 <em>*</em></label>
            <input type="text" id="ghFContactName" maxlength="20" autocomplete="name">
          </div>
          <div class="field">
            <label for="ghFContactPhone">연락처 <em>*</em></label>
            <input type="tel" id="ghFContactPhone" placeholder="010-0000-0000" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="ghFHours">연락 가능 시간 <em>*</em></label>
          <input type="text" id="ghFHours" maxlength="120" placeholder="예: 평일 낮 10–18시 · 주일 오전 제외">
          ${hoursPicker('ghFHours')}
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">6</span> 확인</legend>
        <div class="ls-vows">
          <label class="ls-chk is-wide"><input type="checkbox" id="ghVow1"><span>
            이 방은 <strong>실제로 우리 교회가 내어 줄 수 있는 공간</strong>이며,
            제가 교회를 대신해 올릴 수 있습니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="ghVow2"><span>
            사진과 소개는 <strong>이 방을 실제로 찍고 적은 것</strong>입니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="ghVow3"><span>
            요금을 적은 경우 <strong>우리 시설이 숙박업 신고가 되어 있음을 확인</strong>했습니다.
            신고 여부는 우리 교회가 관할 시 · 군 · 구청에 확인하며,
            센터는 게시판만 운영한다는 것을 압니다.</span></label>
        </div>
      </fieldset>`;

  const filters = `<select id="ghRoomType" aria-label="형태">${opts(roomTypes, '전체 형태')}</select>
      <select id="ghGuestType" aria-label="머무는 분">${opts(guestTypes, '누구나')}</select>
      <select id="ghRegion" aria-label="지역">${regionFilter('전체 지역')}</select>
      <label class="ls-toggle"><input type="checkbox" id="ghFreeOnly"><span>무료만</span></label>`;

  const body = `
${boardTabs('', 'guesthouse.html')}

${pageHero({
    eyebrow: '게스트하우스 · 교회가 내어 주는 방',
    title: '한국에 머무는 동안<br>교회에서 지내십시오',
    lead: '비어 있는 사택과 선교관을 교회가 내어 놓습니다. 안식년으로 들어오신 선교사님, '
      + '방문 교역자, 유학생이 머물 곳을 찾습니다. '
      + '무료로 내어 놓는 방과 숙박업 신고가 된 시설만 올라옵니다.',
    extra: `<div class="ls-hero-meta">
      <span class="ls-hero-pill">사진 <strong>최대 ${board.photoMax}장</strong></span>
      <span class="ls-hero-pill is-key">교회 확인 <strong>후 게시</strong></span>
    </div>
    <div class="ls-hero-actions">
      <a class="btn btn-gold btn-lg" href="#new" id="ghNewBtn">우리 교회 방 내어 놓기 ${icon('arrow', 'ico ico-sm')}</a>
      <a class="btn btn-outline btn-lg" href="#mine">내가 올린 방</a>
    </div>`,
  })}

${boardShell({
    prefix: 'gh',
    searchHint: '지역 · 교회명으로 검색 (예: 은평, 선교관)',
    filters,
    loadingText: '올라온 방을 불러오는 중입니다…',
    emptyTitle: '아직 올라온 방이 없습니다',
    emptyLead: '조건을 바꿔 다시 찾아보시거나, 우리 교회의 빈 방을 먼저 올려 주세요.',
    newLabel: '방 내어 놓기',
    does: board.does,
    tipTitle: '머무시기 전에 확인하세요',
    tipBody: '<strong>요금에 무엇이 들어 있는지</strong>(공과금 · 인터넷 · 침구), '
      + '<strong>주방과 세탁기를 언제 쓸 수 있는지</strong>, '
      + '<strong>주일에 교회 행사가 있을 때 어떻게 되는지</strong>를 미리 여쭤보시면 좋습니다. '
      + '장기 체류시에는 전입신고나 체류 관련 서류가 필요한지도 교회와 함께 확인해 주세요.',
    fineprint: board.fineprint,
    mineEyebrow: '내 게시글',
    mineTitle: '내가 올린 방',
    mineLead: '상태와 관리자 확인 결과를 여기에서 보실 수 있습니다.',
    formEyebrow: '방 내어 놓기',
    formTitle: '우리 교회의 방을 올립니다',
    formLead: '관리자가 교회와 방을 확인한 뒤 게시됩니다.',
    gateText: '게스트하우스 등록은 로그인 후 이용하실 수 있습니다.',
    formBody,
    submitLabel: '등록 신청하기',
  })}

${ctaBand('', {
    title: '사택이나 선교관을 어떻게 쓸지 고민이신가요?',
    lead: '비어 있는 공간을 어떻게 쓸 수 있을지 함께 정리해 드립니다.',
  })}
`;

  write('guesthouse.html', layout({
    title: '교회 게스트하우스 | 우리교회지원센터',
    description: '교회가 내어 주는 사택 · 선교관 게스트하우스. 안식년 선교사, 방문 교역자, '
      + '유학생이 한국에 머무는 동안 지낼 방을 찾습니다.',
    base: '',
    active: 'guesthouse.html',
    body,
    scripts: ['board-core.js', 'guesthouse.js'],
  }));
}

/* =========================================================
   3. 집회 · 찬양집회 티켓팅

   포스터와 집회 이름을 보고 들어와, 읽고, 신청합니다.
   얼리버드처럼 사람이 몰리는 집회는 예매 시작 시각을 정해 두고,
   정원이 차면 "마감되었습니다"가 뜹니다.
   좌석 지정은 선택입니다 — 안 쓰면 인원수로만 받습니다.
   ========================================================= */
function buildTickets(write) {
  const board = site.ticketBoard;

  const cats = [
    ['praise', '찬양집회'],
    ['revival', '부흥회 · 사경회'],
    ['camp', '수련회 · 캠프'],
    ['seminar', '세미나 · 컨퍼런스'],
    ['concert', '음악회 · 공연'],
    ['prayer', '기도회'],
    ['youth', '청년 · 청소년'],
    ['other', '기타'],
  ];

  const formBody = `
      <fieldset class="ls-fs">
        <legend><span class="ls-step">1</span> 어떤 집회인가요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="tkFCategory">갈래 <em>*</em></label>
            <select id="tkFCategory">${opts(cats)}</select>
          </div>
          <div class="field">
            <label for="tkFHost">주최 <em>*</em></label>
            <input type="text" id="tkFHost" maxlength="40" placeholder="예: 우리교회 청년부">
          </div>
        </div>
        <div class="field">
          <label for="tkFTitle">집회 이름 <em>*</em> <span class="ls-counter" id="tkTitleCount"></span></label>
          <input type="text" id="tkFTitle" maxlength="60" placeholder="예: 2026 여름 청년 찬양집회 「돌이키라」">
          ${egChips('tkFTitle', [
    '2026 여름 청년 찬양집회 「돌이키라」',
    '전교인 수련회 — 다시, 처음처럼',
    '가을 부흥성회 (3일 연속)',
    '중고등부 겨울캠프 「이 산지를 내게 주소서」',
    '찬양과 경배의 밤 — 초청 음악회',
  ])}
        </div>
        <div class="field">
          <label for="tkFSubtitle">한 줄 소개</label>
          <input type="text" id="tkFSubtitle" maxlength="80" placeholder="예: 사흘 동안 함께 기도하며 다시 시작합니다">
        </div>
        <div class="field">
          <label for="tkFSpeakers">강사 · 찬양팀</label>
          <input type="text" id="tkFSpeakers" maxlength="120" placeholder="예: ○○○ 목사 · 마커스워십">
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">2</span> 언제, 어디서 하나요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="tkFStarts">시작 <em>*</em></label>
            <input type="datetime-local" id="tkFStarts">
          </div>
          <div class="field">
            <label for="tkFEnds">끝</label>
            <input type="datetime-local" id="tkFEnds">
          </div>
        </div>
        <div class="field">
          <label for="tkFScheduleNote">일정 안내</label>
          <textarea id="tkFScheduleNote" rows="3" maxlength="500"
            placeholder="예: 첫날 19:00 개회 · 둘째날 10:00/19:00 · 마지막날 10:00 파송예배"></textarea>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="tkFRegion">지역 <em>*</em></label>
            <select id="tkFRegion">${regionForm()}</select>
          </div>
          <div class="field">
            <label for="tkFVenue">장소 <em>*</em></label>
            <input type="text" id="tkFVenue" maxlength="60" placeholder="예: 우리교회 본당">
          </div>
        </div>
        <div class="field">
          <label for="tkFAddress">주소</label>
          <input type="text" id="tkFAddress" maxlength="80">
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">3</span> 신청을 언제부터 받나요?</legend>
        <p class="ls-fs-lead">
          사람이 몰리는 집회는 <strong>예매 시작 시각</strong>을 정해 두시면 좋습니다.
          그 시각 전에는 신청 버튼이 열리지 않고, 남은 시간이 화면에 뜹니다.
          비워 두시면 게시되는 즉시 신청을 받습니다.
        </p>
        <div class="grid-2">
          <div class="field">
            <label for="tkFOpenAt">예매 시작</label>
            <input type="datetime-local" id="tkFOpenAt">
            <small class="hint">예: 2026-05-01 20:00 — 이 시각 정각에 버튼이 열립니다.</small>
          </div>
          <div class="field">
            <label for="tkFCloseAt">신청 마감</label>
            <input type="datetime-local" id="tkFCloseAt">
            <small class="hint">비워 두시면 집회 시작 때까지 받습니다.</small>
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="tkFCapacity">정원 <em>*</em></label>
            <input type="number" id="tkFCapacity" min="0" max="100000" placeholder="0 이면 제한 없음">
            <small class="hint">정원이 차면 <strong>자동으로 마감</strong>되고 안내 문구가 뜹니다.</small>
          </div>
          <div class="field">
            <label for="tkFPerPerson">한 사람당 최대 매수</label>
            <input type="number" id="tkFPerPerson" min="1" max="20" value="${board.perPersonMax}">
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">4</span> 참가비</legend>
        <label class="ls-chk is-wide"><input type="checkbox" id="tkFFree"><span>
          <strong>무료 집회입니다</strong></span></label>
        <div id="tkPriceBox">
          <div class="grid-2">
            ${money('tkFPrice', '참가비', '한 사람당 금액입니다.')}
            ${money('tkFEarlyPrice', '얼리버드 참가비', '일찍 신청하는 분께 받을 금액. 안 쓰시면 비워 두세요.')}
          </div>
          <div class="field">
            <label for="tkFEarlyUntil">얼리버드 마감</label>
            <input type="datetime-local" id="tkFEarlyUntil">
          </div>
        </div>
        <div class="field">
          <label for="tkFAgeNote">참가 대상</label>
          <input type="text" id="tkFAgeNote" maxlength="80" placeholder="예: 중학생 이상 · 초등부는 보호자 동반">
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">5</span> 좌석 <small>(선택입니다)</small></legend>
        <p class="ls-fs-lead">
          좌석을 지정해 받고 싶을 때만 켜 주세요. 켜지 않으면 <strong>인원수로만</strong> 받습니다.
          대부분의 집회는 좌석 없이 받는 편이 신청도 빠르고 관리도 쉽습니다.
        </p>
        <label class="ls-chk is-wide"><input type="checkbox" id="tkFSeating"><span>
          <strong>좌석을 지정해 받겠습니다</strong></span></label>

        <div id="tkSeatBox" hidden>
          <div class="grid-3">
            <div class="field">
              <label for="tkFSeatRows">줄 수</label>
              <input type="number" id="tkFSeatRows" min="1" max="30" value="10">
            </div>
            <div class="field">
              <label for="tkFSeatPer">한 줄에 몇 석</label>
              <input type="number" id="tkFSeatPer" min="1" max="40" value="12">
            </div>
            <div class="field">
              <span class="label-txt">&nbsp;</span>
              <button type="button" class="btn btn-outline" id="tkSeatMake">좌석도 만들기</button>
            </div>
          </div>
          <p class="hint">
            만든 뒤 <strong>자리를 눌러</strong> 통로 · 기둥처럼 앉을 수 없는 자리를 꺼 주세요.
            꺼진 자리는 신청 화면에 나오지 않습니다.
          </p>
          <div class="tk-seatmap is-edit" id="tkSeatEdit"></div>
          <p class="tk-seat-sum" id="tkSeatSum"></p>
          <div class="field">
            <label for="tkFSeatNote">좌석 안내</label>
            <input type="text" id="tkFSeatNote" maxlength="80" placeholder="예: A열은 찬양팀 자리입니다">
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">6</span> 포스터와 소개</legend>
        ${photoField('tk', board.photoMax, board.photoMin,
    '첫 장이 목록에 보이는 대표 포스터가 됩니다. 포스터 · 장소 사진 · 지난 집회 사진까지 '
    + `최대 ${board.photoMax}장 올리실 수 있습니다.`)}

        <div class="field">
          <label for="tkFDesc">집회 소개 <em>*</em></label>
          <textarea id="tkFDesc" rows="8" maxlength="4000"
            placeholder="어떤 마음으로 여는 집회인지, 누구를 초대하는지, 무엇을 함께 하는지를 적어 주세요. 신청하는 분이 읽고 결정합니다."></textarea>
        </div>
        <div class="field">
          <label for="tkFNotice">신청 전 안내</label>
          <textarea id="tkFNotice" rows="4" maxlength="1000"
            placeholder="예: 참가비는 신청 후 3일 안에 입금해 주세요 · 환불은 집회 7일 전까지 가능합니다 · 주차 공간이 좁습니다."></textarea>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">7</span> 문의처</legend>
        <div class="grid-2">
          <div class="field">
            <label for="tkFContactName">담당자 <em>*</em></label>
            <input type="text" id="tkFContactName" maxlength="20" autocomplete="name">
          </div>
          <div class="field">
            <label for="tkFContactPhone">연락처 <em>*</em></label>
            <input type="tel" id="tkFContactPhone" placeholder="010-0000-0000" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="tkFHours">연락 가능 시간 <em>*</em></label>
          <input type="text" id="tkFHours" maxlength="120" placeholder="예: 평일 낮 10–18시 · 주일 오전 제외">
          ${hoursPicker('tkFHours')}
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">8</span> 확인</legend>
        <div class="ls-vows">
          <label class="ls-chk is-wide"><input type="checkbox" id="tkVow1"><span>
            제가 <strong>이 집회의 주최 측이거나 위임받은 사람</strong>입니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="tkVow2"><span>
            일시 · 장소 · 정원은 <strong>실제로 정해진 것</strong>이며,
            신청하신 분들께 그대로 지키겠습니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="tkVow3"><span>
            참가비 수납 · 환불 · 일정 변경은 <strong>주최 측이 안내</strong>하며,
            센터는 신청 창구만 운영한다는 것을 압니다.</span></label>
        </div>
      </fieldset>`;

  const filters = `<select id="tkCategory" aria-label="갈래">${opts(cats, '전체 갈래')}</select>
      <select id="tkRegion" aria-label="지역">${regionFilter('전체 지역')}</select>
      <select id="tkWhen" aria-label="시기">
        <option value="upcoming">신청 받는 집회</option>
        <option value="soon">이번 달</option>
        <option value="all">지난 집회까지</option>
      </select>`;

  const body = `
${boardTabs('', 'tickets.html')}

${pageHero({
    eyebrow: '집회 티켓팅 · 찬양집회 · 수련회',
    title: '포스터를 보고,<br>읽고, 신청합니다',
    lead: '찬양집회와 수련회 신청을 한곳에서 받습니다. 예매 시작 시각을 정해 두면 그 시각 정각에 열리고, '
      + '정원이 차면 자동으로 마감됩니다. 좌석 지정은 원하는 집회만 쓰시면 됩니다.',
    extra: `<div class="ls-hero-meta">
      <span class="ls-hero-pill">사진 <strong>최대 ${board.photoMax}장</strong></span>
      <span class="ls-hero-pill">예매 시작 시각 <strong>지정</strong></span>
      <span class="ls-hero-pill is-key">정원 차면 <strong>자동 마감</strong></span>
    </div>
    <div class="ls-hero-actions">
      <a class="btn btn-gold btn-lg" href="#new" id="tkNewBtn">집회 올리기 ${icon('arrow', 'ico ico-sm')}</a>
      <a class="btn btn-outline btn-lg" href="#tickets">내 신청 내역</a>
    </div>`,
  })}

${boardShell({
    prefix: 'tk',
    searchHint: '집회 이름 · 주최로 검색 (예: 청년, 부흥회)',
    filters,
    gridClass: 'is-poster',
    loadingText: '집회를 불러오는 중입니다…',
    emptyTitle: '아직 올라온 집회가 없습니다',
    emptyLead: '조건을 바꿔 다시 찾아보시거나, 여시는 집회를 먼저 올려 주세요.',
    newLabel: '집회 올리기',
    does: board.does,
    tipTitle: '신청하시기 전에',
    tipBody: '<strong>참가비를 언제까지 어디로 보내는지</strong>, '
      + '<strong>환불이 언제까지 되는지</strong>는 집회마다 다릅니다 — 각 집회의 [신청 전 안내]를 '
      + '꼭 읽어 주세요. 신청은 <strong>한 집회에 한 번</strong>만 되고, 취소하시면 자리가 '
      + '바로 다른 분께 돌아갑니다.',
    fineprint: board.fineprint,
    mineEyebrow: '내 집회',
    mineTitle: '내가 올린 집회',
    mineLead: '신청 현황과 관리자 확인 결과를 여기에서 보실 수 있습니다.',
    formEyebrow: '집회 올리기',
    formTitle: '집회 신청을 받습니다',
    formLead: '관리자가 주최 · 장소 · 일시를 확인한 뒤 게시됩니다.',
    gateText: '집회 등록은 로그인 후 이용하실 수 있습니다.',
    formBody,
    submitLabel: '등록 신청하기',
  })}

<!-- ============ 내 신청 내역 ============ -->
<section class="section" id="tkTickets" hidden>
  <div class="wrap narrow">
    <a class="ls-back" href="#list">← 목록으로</a>
    ${sectionHead('내 신청', '내가 신청한 집회',
    '신청 번호와 좌석을 여기에서 확인하실 수 있습니다. 못 가시게 되면 꼭 취소해 주세요 — '
    + '자리가 바로 다음 분께 돌아갑니다.', 'left')}
    <div id="tkTicketsBody"></div>
  </div>
</section>

<!-- ============ 신청하기 ============ -->
<section class="section is-tint" id="tkApply" hidden>
  <div class="wrap narrow">
    <a class="ls-back" href="#list">← 목록으로</a>
    <div id="tkApplyBody"></div>
  </div>
</section>

${ctaBand('', {
    title: '집회 포스터나 홍보물이 필요하신가요?',
    lead: '집회 포스터 · 현수막 · 영상까지 디자인 지원 항목에서 함께 만들어 드립니다.',
  })}
`;

  write('tickets.html', layout({
    title: '집회 티켓팅 | 우리교회지원센터',
    description: '찬양집회 · 부흥회 · 수련회 신청 창구. 예매 시작 시각을 정하고, 정원이 차면 자동으로 '
      + '마감됩니다. 좌석 지정도 원하는 집회만 쓸 수 있습니다.',
    base: '',
    active: 'tickets.html',
    body,
    scripts: ['board-core.js', 'tickets.js'],
  }));
}

/* =========================================================
   4. 교역자 구인 공고

   지금까지는 교회가 조건을 알려 주면 센터가 사람을 찾아 이어 주었습니다.
   그러면 센터가 아는 사람 안에서만 이어집니다. 그 밖에 있는 교회는
   후보를 아예 만나지 못합니다. 그래서 공고를 열어 두고 사역자가
   직접 보고 연락하도록 바꿨습니다.

   센터가 할 수 있는 것은 여기까지입니다 — 사람을 늘려 드릴 수는
   없고, 서로를 볼 수 있게 해 드릴 뿐입니다. 그래서 사례비 · 사택 ·
   근무 조건을 반드시 적게 했습니다. "협의" 한 줄만 있는 공고는
   보시는 분이 판단할 수가 없습니다.
   ========================================================= */
function buildJobs(write) {
  const board = site.jobBoard;

  const positions = [
    ['senior', '담임목사'],
    ['associate', '부목사'],
    ['assistant', '전도사'],
    ['education', '교육전도사'],
    ['worship', '찬양인도자'],
    ['pianist', '반주자'],
    ['staff', '행정 간사'],
    ['other', '기타'],
  ];

  const employment = [
    ['full', '전임'],
    ['part', '파트'],
    ['weekend', '주말 사역'],
    ['short', '단기 · 대체'],
  ];

  const payTypes = [
    ['monthly', '월 사례비'],
    ['weekly', '주 단위'],
    ['per_service', '집회 · 예배 건별'],
    ['negotiable', '면접 후 협의'],
  ];

  const housing = [
    ['provided', '사택 제공'],
    ['support', '주거비 지원'],
    ['negotiable', '협의'],
    ['none', '없음'],
  ];

  const departments = ['영아 · 유아부', '유치부', '유년 · 초등부', '중고등부',
    '청년부', '장년 · 남녀전도회', '찬양팀', '전체 · 협력', '기타'];
  const sizes = ['50명 미만', '50~150명', '150~500명', '500~1,000명', '1,000명 이상'];

  const formBody = `
      <fieldset class="ls-fs">
        <legend><span class="ls-step">1</span> 어느 교회인가요?</legend>
        <div class="grid-2">
          <div class="field">
            <label for="jbFChurch">교회명 <em>*</em></label>
            <input type="text" id="jbFChurch" maxlength="40" placeholder="예: 새길교회">
          </div>
          <div class="field">
            <label for="jbFDenom">교단</label>
            <input type="text" id="jbFDenom" maxlength="30" placeholder="예: 예장 통합">
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="jbFRegion">지역 <em>*</em></label>
            <select id="jbFRegion">${regionForm()}</select>
          </div>
          <div class="field">
            <label for="jbFSize">출석 교인 수</label>
            <select id="jbFSize">
              <option value="">선택해 주세요</option>
              ${sizes.map((v) => `<option>${esc(v)}</option>`).join('\n              ')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="jbFAddress">대략의 위치</label>
          <input type="text" id="jbFAddress" maxlength="60" placeholder="예: 강원 홍천군 서면">
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">2</span> 어떤 자리인가요?</legend>
        <div class="field">
          <label for="jbFTitle">공고 제목 <em>*</em> <span class="ls-counter" id="jbTitleCount"></span></label>
          <input type="text" id="jbFTitle" maxlength="60"
            placeholder="예: 중고등부 교육전도사님을 모십니다 (사택 제공)">
          ${egChips('jbFTitle', [
    '중고등부 교육전도사님을 모십니다 (사택 제공)',
    '주일 오전 반주자 — 주말 사역, 교통비 별도',
    '청년부 담당 전도사 (전임) — 사택과 4대보험',
    '유년부 교육전도사 — 신학생 환영, 주 2회',
    '찬양인도자 모집 — 주일 1부 · 3부',
  ])}
        </div>
        <div class="grid-3">
          <div class="field">
            <label for="jbFPosition">직분 <em>*</em></label>
            <select id="jbFPosition">${opts(positions)}</select>
          </div>
          <div class="field" id="jbPosOtherBox" hidden>
            <label for="jbFPositionOther">직분 직접 입력 <em>*</em></label>
            <input type="text" id="jbFPositionOther" maxlength="20">
          </div>
          <div class="field">
            <label for="jbFEmployment">근무 형태 <em>*</em></label>
            <select id="jbFEmployment">${opts(employment)}</select>
          </div>
        </div>
        <div class="grid-3">
          <div class="field">
            <label for="jbFDept">맡을 부서</label>
            <select id="jbFDept">
              <option value="">선택해 주세요</option>
              ${departments.map((v) => `<option>${esc(v)}</option>`).join('\n              ')}
            </select>
          </div>
          <div class="field">
            <label for="jbFHeadcount">모집 인원</label>
            <input type="number" id="jbFHeadcount" min="1" max="20" value="1">
          </div>
          <div class="field">
            <label for="jbFWorkDays">근무 요일 · 시간</label>
            <input type="text" id="jbFWorkDays" maxlength="60" placeholder="예: 주일 종일 · 수요 저녁">
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="jbFStart">부임 희망 시기</label>
            <input type="text" id="jbFStart" maxlength="30" placeholder="예: 2026년 3월 · 협의 가능">
          </div>
          <div class="field">
            <label for="jbFCloses">모집 마감</label>
            <input type="date" id="jbFCloses">
            <small class="hint">비워 두시면 마감일 없이 올라갑니다.</small>
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">3</span> 사례비와 사택</legend>
        <p class="ls-fs-lead">
          지원하시는 분이 <strong>갈지 말지를 정하는 건 결국 이 두 가지</strong>입니다.
          &ldquo;협의&rdquo; 한 줄만 적힌 공고에는 연락이 잘 오지 않습니다.
          범위라도 적어 주시면 지원이 확실히 늘어납니다.
        </p>
        <div class="field">
          <label for="jbFPayType">사례비 방식 <em>*</em></label>
          <select id="jbFPayType">${opts(payTypes)}</select>
        </div>
        <div class="grid-2" id="jbPayBox">
          ${money('jbFPayMin', '얼마부터', '아래 칸을 비우시면 이 금액으로만 보입니다.')}
          ${money('jbFPayMax', '얼마까지', '범위가 없으면 비워 두세요.')}
        </div>
        <div class="field">
          <label for="jbFPayNote">사례비에 관해 덧붙일 말</label>
          <input type="text" id="jbFPayNote" maxlength="80" placeholder="예: 교통비 별도 · 명절 상여 있음">
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="jbFHousing">사택 <em>*</em></label>
            <select id="jbFHousing">${opts(housing)}</select>
          </div>
          <div class="field">
            <span class="label-txt">4대보험</span>
            <label class="ls-chk"><input type="checkbox" id="jbFInsurance"><span>가입해 드립니다</span></label>
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">4</span> 오가는 길</legend>
        <p class="ls-fs-lead">
          멀거나 대중교통이 어려운 곳이라면 <strong>숨기지 말고 적어 주세요.</strong>
          알고 오신 분은 오래 계시지만, 모르고 오신 분은 곧 그만두십니다.
        </p>
        <div class="field">
          <label for="jbFCommute">교통 안내</label>
          <textarea id="jbFCommute" rows="3" maxlength="300"
            placeholder="예: 시외버스터미널에서 차로 20분, 대중교통이 드물어 자차가 있으시면 좋습니다. 주일에는 교회 차량으로 모시러 갑니다."></textarea>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">5</span> 교회 사진과 소개</legend>
        ${photoField('jb', board.photoMax, board.photoMin,
    '예배당과 교회 바깥, 그리고 함께 일하실 공간을 보여 주세요. '
    + '사택을 제공하신다면 그 방도 한 장 넣어 주시면 좋습니다.')}

        <div class="field">
          <label for="jbFDesc">교회 소개와 하실 일 <em>*</em></label>
          <textarea id="jbFDesc" rows="8" maxlength="3000"
            placeholder="어떤 교회인지, 어떤 사역을 맡게 되는지, 함께 일할 분들은 어떤 분들인지 적어 주세요. 지원하시는 분이 읽고 결정합니다."></textarea>
        </div>
        <div class="field">
          <label for="jbFQual">바라는 자격 · 경험</label>
          <textarea id="jbFQual" rows="3" maxlength="500"
            placeholder="예: 신학대학원 재학 이상 · 중고등부 사역 경험이 있으시면 좋습니다 · 운전 가능하신 분"></textarea>
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">6</span> 연락처</legend>
        <p class="ls-fs-lead">
          <strong>지원은 여기로 직접 옵니다.</strong> 사이트 안에서 지원서를 받는 기능은
          아직 열지 않았습니다.
        </p>
        <div class="grid-2">
          <div class="field">
            <label for="jbFContactName">담당자 <em>*</em></label>
            <input type="text" id="jbFContactName" maxlength="20" autocomplete="name">
          </div>
          <div class="field">
            <label for="jbFContactPhone">연락처 <em>*</em></label>
            <input type="tel" id="jbFContactPhone" placeholder="010-0000-0000" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="jbFContactEmail">이메일 <small>(이력서를 받으실 주소)</small></label>
          <input type="email" id="jbFContactEmail" maxlength="60" autocomplete="email">
        </div>
        <div class="field">
          <label for="jbFHours">연락 가능 시간 <em>*</em></label>
          <input type="text" id="jbFHours" maxlength="120" placeholder="예: 평일 낮 10–18시 · 주일 오전 제외">
          ${hoursPicker('jbFHours')}
        </div>
      </fieldset>

      <fieldset class="ls-fs">
        <legend><span class="ls-step">7</span> 확인</legend>
        <div class="ls-vows">
          <label class="ls-chk is-wide"><input type="checkbox" id="jbVow1"><span>
            제가 <strong>이 교회를 대신해 공고를 올릴 수 있는 사람</strong>입니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="jbVow2"><span>
            적은 <strong>사례비 · 사택 · 근무 조건은 실제와 같으며</strong>,
            오시는 분께 그대로 지키겠습니다.</span></label>
          <label class="ls-chk is-wide"><input type="checkbox" id="jbVow3"><span>
            면접과 청빙 결정은 <strong>교회와 사역자가 직접</strong> 하며,
            센터는 공고 게시판만 운영한다는 것을 압니다.</span></label>
        </div>
      </fieldset>`;

  const filters = `<select id="jbPosition" aria-label="직분">${opts(positions, '전체 직분')}</select>
      <select id="jbEmployment" aria-label="근무 형태">${opts(employment, '전체 형태')}</select>
      <select id="jbRegion" aria-label="지역">${regionFilter('전체 지역')}</select>
      <label class="ls-toggle"><input type="checkbox" id="jbHousingOnly"><span>사택 있는 곳만</span></label>`;

  const body = `
${boardTabs('', 'jobs.html')}

${pageHero({
    eyebrow: '교역자 구인 · 사역자를 찾습니다',
    title: '교회가 직접 올리고,<br>사역자가 직접 봅니다',
    lead: '아는 분께 부탁하는 것 말고는 방법이 없었습니다. 그러면 그 연결망 밖에 있는 '
      + '교회는 후보를 아예 만나지 못합니다. 공고를 열어 두어, 교회와 사역자가 '
      + '서로를 볼 수 있게 합니다.',
    extra: `<div class="ls-hero-meta">
      <span class="ls-hero-pill">사진 <strong>최대 ${board.photoMax}장</strong></span>
      <span class="ls-hero-pill is-key">사례비 · 사택 <strong>필수 표기</strong></span>
    </div>
    <div class="ls-hero-actions">
      <a class="btn btn-gold btn-lg" href="#new" id="jbNewBtn">공고 올리기 ${icon('arrow', 'ico ico-sm')}</a>
      <a class="btn btn-outline btn-lg" href="#mine">내가 올린 공고</a>
    </div>`,
  })}

${boardShell({
    prefix: 'jb',
    searchHint: '교회명 · 지역 · 부서로 검색 (예: 중고등부, 홍천)',
    filters,
    loadingText: '공고를 불러오는 중입니다…',
    emptyTitle: '아직 올라온 공고가 없습니다',
    emptyLead: '조건을 바꿔 다시 찾아보시거나, 우리 교회의 자리를 먼저 올려 주세요.',
    newLabel: '공고 올리기',
    does: board.does,
    tipTitle: '지원하시기 전에',
    tipBody: '<strong>사례비 · 사택 · 근무 요일</strong>은 공고에 적힌 그대로가 맞는지 '
      + '전화로 한 번 더 확인해 주세요. 특히 <strong>오가는 길</strong>은 직접 한 번 가 보시는 편이 좋습니다 — '
      + '지도에서 가까워 보여도 대중교통이 끊기는 곳이 있습니다. '
      + '지원은 공고에 적힌 연락처로 직접 하시면 되고, 센터를 거치지 않습니다.',
    fineprint: board.fineprint,
    mineEyebrow: '내 공고',
    mineTitle: '내가 올린 공고',
    mineLead: '상태와 관리자 확인 결과를 여기에서 보실 수 있습니다.',
    formEyebrow: '공고 올리기',
    formTitle: '우리 교회의 자리를 올립니다',
    formLead: '관리자가 교회와 내용을 확인한 뒤 게시됩니다.',
    gateText: '공고 등록은 로그인 후 이용하실 수 있습니다.',
    formBody,
    submitLabel: '등록 신청하기',
  })}

${ctaBand('', {
    title: '사람을 구하는 일이 처음이신가요?',
    lead: '어떤 조건으로 올려야 연락이 오는지, 공고 문구부터 함께 정리해 드립니다.',
  })}
`;

  write('jobs.html', layout({
    title: '교역자 구인 | 우리교회지원센터',
    description: '교회가 직접 올리는 교역자 구인 공고. 아는 분께 부탁하지 않아도 '
      + '사역자가 보고 연락합니다. 사례비 · 사택 · 근무 조건을 분명히 적습니다.',
    base: '',
    active: 'jobs.html',
    body,
    scripts: ['board-core.js', 'jobs.js'],
  }));
}

module.exports = { buildMarket, buildGuesthouse, buildTickets, buildJobs };
