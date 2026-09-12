const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 파일 주소 뒤에 내용 요약 번호를 붙입니다 (assets/css/style.css?v=1a2b3c4d).
 *
 * 왜 필요한가
 *   브라우저는 한 번 받은 css · js 를 한동안 다시 받지 않습니다.
 *   그래서 새 화면(html)에 옛 모양(css)이 붙어, 칸이 어긋나거나
 *   색이 빠진 채로 보입니다. 실제로 두 번 그런 일이 있었습니다.
 *
 *   내용이 바뀌면 번호도 바뀌므로 브라우저가 새로 받아 갑니다.
 *   내용이 그대로면 번호도 그대로라 쓸데없이 다시 받지 않습니다.
 */
const VER = new Map();
function ver(rel) {
  if (VER.has(rel)) return VER.get(rel);
  let tag = '';
  try {
    const buf = fs.readFileSync(path.join(__dirname, '..', rel));
    tag = '?v=' + crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
  } catch (e) {
    // 아직 만들어지지 않은 파일 — 번호 없이 둡니다.
  }
  VER.set(rel, tag);
  return tag;
}

'use strict';

const { site, categories, services, plans, planRules, trial, invite } = require('./data/site');

/** HTML 특수문자 이스케이프 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 24x24 line icon set (stroke 기반) */
const icons = {
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.6-1.9-.2-1 .5-1.9 1.6-1.9h1.6A4.2 4.2 0 0 0 21 13C21 7.5 16.9 3 12 3Z"/><circle cx="7.8" cy="11.5" r="1.1"/><circle cx="11" cy="7.6" r="1.1"/><circle cx="15.6" cy="9.2" r="1.1"/>',
  users:
    '<path d="M15.5 20v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.4V20"/><circle cx="9.2" cy="7.6" r="3.3"/><path d="M21 20v-1.6a3.6 3.6 0 0 0-2.7-3.5M15.8 4.5a3.6 3.6 0 0 1 0 6.9"/>',
  speaker:
    '<rect x="5" y="2.5" width="14" height="19" rx="2.4"/><circle cx="12" cy="14.6" r="3.6"/><circle cx="12" cy="6.6" r="1.4"/>',
  building:
    '<path d="M3 21h18M5 21V5.6c0-.9.6-1.6 1.5-1.6h5c.9 0 1.5.7 1.5 1.6V21M13 21V10.4h4.5c.9 0 1.5.7 1.5 1.6V21"/><path d="M8 8h2M8 12h2M8 16h2M16 14h1"/>',
  network:
    '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M10.4 7 6.6 15.8M13.6 7l3.8 8.8M7.4 18h9.2"/>',
  phone:
    '<rect x="6" y="2.5" width="12" height="19" rx="2.4"/><path d="M10.6 5.6h2.8"/><path d="M10.4 18.4h3.2"/>',
  briefcase:
    '<rect x="2.5" y="7.2" width="19" height="12.6" rx="2"/><path d="M8.6 7.2V5.4c0-.9.7-1.6 1.6-1.6h3.6c.9 0 1.6.7 1.6 1.6v1.8"/><path d="M2.5 12.4h19"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  phoneCall:
    '<path d="M21 16.5v2.6a1.8 1.8 0 0 1-2 1.8 17.8 17.8 0 0 1-7.8-2.8 17.5 17.5 0 0 1-5.4-5.4A17.8 17.8 0 0 1 3 4.9 1.8 1.8 0 0 1 4.8 3h2.6a1.8 1.8 0 0 1 1.8 1.6c.1 1 .4 1.9.7 2.8a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.4 14.4 0 0 0 5.4 5.4l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.6 2.8.7A1.8 1.8 0 0 1 21 16.5Z"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6.5 9 6.4 9-6.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  home: '<path d="M4 10.4 12 4l8 6.4V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19Z"/><path d="M9.6 20.6v-6h4.8v6"/>',
  ticket: '<path d="M3 8.4A1.4 1.4 0 0 1 4.4 7h15.2A1.4 1.4 0 0 1 21 8.4v2a2.2 2.2 0 0 0 0 4.4v1.8a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 16.6v-1.8a2.2 2.2 0 0 0 0-4.4Z"/><path d="M14.4 7v11"/>',
  pin: '<path d="M20 10.3c0 5.4-8 12-8 12s-8-6.6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10.1" r="2.8"/>',
  doc: '<path d="M14 3H7.4A1.4 1.4 0 0 0 6 4.4v15.2A1.4 1.4 0 0 0 7.4 21h9.2a1.4 1.4 0 0 0 1.4-1.4V7l-4-4Z"/><path d="M14 3v4h4M9.2 12.5h5.6M9.2 16h5.6"/>',
  /* 세로 화면 안에 재생 표시 — 숏츠 */
  shorts:
    '<rect x="6.6" y="2.5" width="10.8" height="19" rx="2.4"/><path d="m10.8 9.4 4.4 2.6-4.4 2.6Z"/>',
  /* 두 사람이 마주 놓인 종이를 함께 보는 모양 — 소그룹 나눔집 */
  share:
    '<path d="M4 4.6h6.2c1 0 1.8.8 1.8 1.8V19a1.6 1.6 0 0 0-1.6-1.6H4Z"/><path d="M20 4.6h-6.2c-1 0-1.8.8-1.8 1.8V19a1.6 1.6 0 0 1 1.6-1.6H20Z"/><path d="M6.4 8.4h2.8M6.4 11.6h2.8M14.8 8.4h2.8M14.8 11.6h2.8"/>',
};

function icon(name, cls) {
  const body = icons[name] || icons.check;
  return `<svg class="${cls || 'ico'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/**
 * 브랜드 로고.
 *
 * 글자 자체가 로고(워드마크)라 옆에 센터 이름을 또 쓰지 않습니다.
 * 어두운 바탕(푸터)에서는 진한 초록이 묻히므로 흰색 판본을 씁니다.
 * 가로세로비 899:549 를 width/height 로 박아 두어 글이 흔들리지 않게 합니다.
 */
function logoMark(base, opt) {
  const o = opt || {};
  /* 헤더는 높이가 76px 뿐이라 두 줄 판본은 작아집니다 — 가로 한 줄 판본을 씁니다.
     푸터처럼 세로로 여유가 있는 곳은 원본 두 줄 판본이 더 낫습니다. */
  const row = o.row !== false;
  const file = (row ? 'logo-row' : 'logo') + (o.light ? '-light' : '') + '.png';
  const w = row ? 1780 : 899;
  const h = row ? 307 : 549;
  return `<img class="logo-img${row ? ' is-row' : ''}" src="${base || ''}assets/img/${file}"
    width="${w}" height="${h}" alt="우리교회지원센터" decoding="async">`;
}

/* =========================================================
   연락처 표기 — 반드시 이 함수들로 출력하세요.

   관리자 화면 [센터 설정] 에서 연락처를 바꾸면 live-content.js 가
   data-live 표시가 붙은 곳만 갈아끼웁니다. 그냥 ${site.contact.phone}
   으로 찍으면 그 자리는 옛 번호가 그대로 남습니다.
   ========================================================= */

/** 전화번호 (관리자 수정 반영) */
function phoneText() {
  return `<span data-live="site.phone">${esc(site.contact.phone)}</span>`;
}

/** 이메일 (관리자 수정 반영) */
function emailText() {
  return `<span data-live="site.email">${esc(site.contact.email)}</span>`;
}

/** 운영 시간 (관리자 수정 반영) */
function hoursText() {
  return `<span data-live="site.hours">${esc(site.contact.hours)}</span>`;
}

/** 주소 (관리자 수정 반영) */
function addressText() {
  /* 비면 빈 문자열입니다 — 부르는 쪽에서 줄째로 감춥니다. */
  if (!site.contact.address) return '';
  return `<span data-live="site.address">${esc(site.contact.address)}</span>`;
}

/**
 * 게시판 네 갈래.
 * 처음엔 부동산 매물 하나였습니다. 교역자를 돕는다는 뼈대는 그대로 두되,
 * 물건을 사고파는 일 · 방을 내어 주는 일 · 집회에 신청하는 일은
 * 교역자만의 일이 아니라 성도가 함께 하는 일이라 갈래를 넷으로 나눴습니다.
 */
const BOARDS = [
  { href: 'listings.html', label: '부동산 매물', sub: '예배 공간 매매 · 임대' },
  { href: 'market.html', label: '중고 장터', sub: '음향 · 악기 · 집기 (설치는 별도)' },
  { href: 'jobs.html', label: '교역자 구인', sub: '교회가 올리고, 직접 지원' },
  { href: 'guesthouse.html', label: '게스트하우스', sub: '교회가 내어 주는 방' },
  { href: 'tickets.html', label: '집회 티켓팅', sub: '찬양집회 · 수련회 신청' },
];

/** 게시판 네 갈래를 오가는 탭. 모든 게시판 페이지 맨 위에 같은 모양으로 붙습니다. */
function boardTabs(base, active) {
  const items = BOARDS.map((b) => {
    const on = b.href === active;
    return `<a class="board-tab${on ? ' is-on' : ''}" href="${base}${b.href}"${on ? ' aria-current="page"' : ''}>
        <strong>${esc(b.label)}</strong>
        <small>${esc(b.sub)}</small>
      </a>`;
  }).join('\n      ');

  return `<nav class="board-tabs" aria-label="게시판 갈래">
  <div class="wrap board-tabs-in">
      ${items}
  </div>
</nav>`;
}

const NAV = [
  { href: 'index.html', label: '홈' },
  { href: 'about.html', label: '센터 소개' },
  { href: 'services/index.html', label: '지원 항목', key: 'services' },
  { href: 'pricing.html', label: '패키지' },
  { href: 'listings.html', label: '게시판', key: 'boards' },
  { href: 'process.html', label: '이용 절차' },
  { href: 'faq.html', label: '자주 묻는 질문' },
  { href: 'contact.html', label: '문의' },
];

function header(base, active) {
  const links = NAV.map((n) => {
    const isOn = active === n.href
      || (n.key === 'services' && active && active.startsWith('services/'))
      || (n.key === 'boards' && BOARDS.some((x) => x.href === active));
    return `<a class="nav-link${isOn ? ' is-active' : ''}" href="${base}${n.href}">${n.label}</a>`;
  }).join('');

  const serviceMenu = services
    .map(
      (s) =>
        `<a class="mega-item" href="${base}services/${s.slug}.html">
          <span class="mega-ico">${icon(s.icon)}</span>
          <span class="mega-text"><strong>${esc(s.name)}${s.soon ? '<span class="mega-soon">준비 중</span>' : ''}</strong><small>${esc(s.tagline)}</small></span>
        </a>`
    )
    .join('');

  return `<a class="skip-link" href="#main">본문으로 건너뛰기</a>
<header class="site-header" id="siteHeader">
  <div class="topbar">
    <div class="wrap topbar-in">
      <span class="topbar-item">${icon('clock', 'ico ico-xs')} ${hoursText()}</span>
      <span class="topbar-links">
        <a href="${site.contact.phoneHref}">${icon('phoneCall', 'ico ico-xs')} ${phoneText()}</a>
        <a href="mailto:${esc(site.contact.email)}">${icon('mail', 'ico ico-xs')} ${emailText()}</a>
      </span>
    </div>
  </div>

  <!-- 윗줄 — 로고 · 찾기 · 내 계정
       찾기 칸을 머리 안에 두면 어느 페이지에서나 같은 자리에 있습니다.
       메뉴와 자리를 다투지 않으므로 넓게 쓸 수 있습니다. -->
  <div class="wrap header-in">
    <a class="brand" href="${base}index.html" aria-label="우리교회지원센터 홈으로">
      ${logoMark(base, { row: true })}
    </a>

    <button type="button" class="hsearch" data-search-open aria-label="사이트 안에서 찾기">
      ${icon('search', 'ico')}
      <span class="hsearch-text">무엇을 찾으시나요?</span>
      <span class="hsearch-key" aria-hidden="true">/</span>
    </button>

    <div class="header-side">
      <span id="authSlot"></span>
      <a class="btn btn-primary btn-sm nav-cta" href="${base}apply.html">지원 신청</a>
      <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="nav" aria-label="메뉴 열기">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>

  <!-- 아랫줄 — 메뉴 -->
  <div class="navbar">
    <div class="wrap">
      <nav class="nav" id="nav" aria-label="주 메뉴">
        ${links}
      </nav>
    </div>
  </div>

  <div class="mega" id="mega" hidden>
    <div class="wrap mega-in">${serviceMenu}</div>
  </div>
</header>`;
}

function footer(base) {
  const serviceLinks = services
    .map((s) => `<li><a href="${base}services/${s.slug}.html">${esc(s.name)}</a></li>`)
    .join('');

  return `<footer class="site-footer">
  <div class="wrap footer-top">
    <div class="footer-brand">
      <a class="brand brand-light" href="${base}index.html" aria-label="우리교회지원센터 홈으로">
        ${logoMark(base, { light: true, row: false })}
      </a>
      <p class="footer-desc">${esc(site.description)}</p>
      <a class="btn btn-gold" href="${base}apply.html">지원 신청하기 ${icon('arrow', 'ico ico-sm')}</a>
    </div>
    <div class="footer-col">
      <h3>지원 항목</h3>
      <ul>${serviceLinks}</ul>
    </div>
    <div class="footer-col">
      <h3>센터 안내</h3>
      <ul>
        <li><a href="${base}about.html">센터 소개</a></li>
        <li><a href="${base}process.html">이용 절차</a></li>
        <li><a href="${base}faq.html">자주 묻는 질문</a></li>
        <li><a href="${base}contact.html">문의하기</a></li>
        <li><a href="${base}status.html">신청 조회</a></li>
        <li><a href="${base}privacy.html">개인정보 처리방침</a></li>
        <li><a href="${base}listings.html">부동산 매물</a></li>
        <li><a href="${base}market.html">중고 장터</a></li>
        <li><a href="${base}guesthouse.html">게스트하우스</a></li>
        <li><a href="${base}tickets.html">집회 티켓팅</a></li>
        <li><a href="${base}jobs.html">교역자 구인</a></li>
        <li><a href="${base}staff.html" class="footer-staff">직원 로그인</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h3>문의</h3>
      <ul class="footer-contact">
        <li>${icon('phoneCall', 'ico ico-sm')} <a href="${site.contact.phoneHref}">${phoneText()}</a></li>
        <li>${icon('mail', 'ico ico-sm')} <a href="mailto:${esc(site.contact.email)}">${emailText()}</a></li>
        <li>${icon('clock', 'ico ico-sm')} ${hoursText()}</li>
        ${addressText() ? `<li>${icon('pin', 'ico ico-sm')} ${addressText()}</li>` : ''}
      </ul>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <p>© <span id="year">2026</span> 우리교회지원센터. All rights reserved.</p>
    <p class="footer-note">한국 교회를 위한 통합 지원 기관</p>
  </div>
</footer>`;
}

/**
 * 페이지 레이아웃
 * @param {{title:string, description:string, base:string, active:string, body:string, scripts?:string[], bodyClass?:string}} o
 */
function layout(o) {
  const base = o.base || '';
  const scripts = (o.scripts || []).map((s) =>
    `<script src="${base}assets/js/${s}${ver('assets/js/' + s)}" defer></script>`).join('\n  ');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(o.title)}">
  <meta property="og:description" content="${esc(o.description)}">
  <meta property="og:site_name" content="우리교회지원센터">
  <meta property="og:image" content="${site.url}assets/img/og-card.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="우리교회지원센터">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${site.url}assets/img/og-card.png">
  <meta name="theme-color" content="#1F7A44">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%231F7A44'/%3E%3Cpath d='M20 9.5v21M13 16.5h14' stroke='%23F2C82F' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="${base}assets/css/style.css${ver('assets/css/style.css')}">
  <link rel="stylesheet" href="${base}assets/css/auth.css${ver('assets/css/auth.css')}">
  <script>
  /* 새로고침하면 홈으로 돌아갑니다.

     브라우저는 "새로고침(reload)" 과 "링크·주소창으로 들어옴(navigate)" 을
     구분해 알려 줍니다. 새로고침일 때만 보내므로, 남에게 받은 매물 · 공고
     주소로 들어오신 분은 그 화면을 그대로 보십니다.

     그림이 그려지기 전에 옮기려고 <head> 안에서 바로 돕니다.
     history 를 늘리지 않도록 replace 를 씁니다 — [뒤로] 가 막히지 않습니다. */
  (function () {
    try {
      var e = (window.performance && performance.getEntriesByType)
        ? performance.getEntriesByType('navigation')[0] : null;
      var reloaded = e ? e.type === 'reload'
        : !!(performance.navigation && performance.navigation.type === 1);
      var path = location.pathname;
      var atHome = path.charAt(path.length - 1) === '/'
        || path.slice(-11) === '/index.html' || path === 'index.html';
      if (reloaded && !atHome) location.replace('${base}index.html');
    } catch (err) { /* 못 알아보는 브라우저에서는 그냥 둡니다 */ }
  })();
  </script>
  ${o.head || ''}
</head>
<body${o.bodyClass ? ` class="${o.bodyClass}"` : ''}${o.serviceId ? ` data-service="${o.serviceId}"` : ''}>
  ${header(base, o.active)}
  <main id="main">
${o.body}
  </main>
  ${footer(base)}
  <a class="float-cta" href="${base}apply.html">지원 신청</a>

  <!-- 찾아보기 — assets/js/search.js 가 채웁니다 -->
  <div class="ss" id="siteSearch" data-base="${base}" hidden role="dialog" aria-modal="true" aria-label="찾아보기">
    <div class="ss-panel">
      <div class="ss-bar">
        ${icon('search', 'ico')}
        <input type="search" id="ssInput" autocomplete="off"
          placeholder="찾으시는 것을 적어 주세요 (예: 음향, 사택, 요금)" aria-label="찾아보기">
        <button type="button" class="ss-close" data-search-close aria-label="닫기">닫기</button>
      </div>
      <div class="ss-results" id="ssResults"></div>
      <p class="ss-foot">
        <kbd>↑</kbd><kbd>↓</kbd> 로 고르고 <kbd>Enter</kbd> 로 엽니다 ·
        어디서든 <kbd>/</kbd> 로 열립니다
      </p>
    </div>
  </div>
  <script src="${base}assets/js/supabase-config.js${ver('assets/js/supabase-config.js')}" defer></script>
  <script src="${base}assets/js/firebase-config.js${ver('assets/js/firebase-config.js')}" defer></script>
  <script src="${base}assets/js/data.js${ver('assets/js/data.js')}" defer></script>
  <script src="${base}assets/js/db.js${ver('assets/js/db.js')}" defer></script>
  <script src="${base}assets/js/profile.js${ver('assets/js/profile.js')}" defer></script>
  <script src="${base}assets/js/account.js${ver('assets/js/account.js')}" defer></script>
  <script src="${base}assets/js/auth-ui.js${ver('assets/js/auth-ui.js')}" defer></script>
  <script src="${base}assets/js/consent-ui.js${ver('assets/js/consent-ui.js')}" defer></script>
  <script src="${base}assets/js/live-content.js${ver('assets/js/live-content.js')}" defer></script>
  <script src="${base}assets/js/search-index.js${ver('assets/js/search-index.js')}" defer></script>
  <script src="${base}assets/js/search.js${ver('assets/js/search.js')}" defer></script>
  <script src="${base}assets/js/app.js${ver('assets/js/app.js')}" defer></script>
  ${scripts}
</body>
</html>
`;
}

/* ---------- 공통 섹션 컴포넌트 ---------- */

function pageHero(o) {
  return `<section class="page-hero">
  <div class="wrap">
    ${o.eyebrow ? `<p class="eyebrow">${esc(o.eyebrow)}</p>` : ''}
    <h1>${o.title}</h1>
    ${o.lead ? `<p class="lead">${esc(o.lead)}</p>` : ''}
    ${o.extra || ''}
  </div>
</section>`;
}

function sectionHead(eyebrow, title, lead, align) {
  return `<div class="sec-head${align === 'left' ? ' is-left' : ''}">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h2>${title}</h2>
    ${lead ? `<p class="sec-lead">${esc(lead)}</p>` : ''}
  </div>`;
}

function faqList(items, idPrefix, attrs) {
  return `<div class="faq"${attrs ? ' ' + attrs : ''}>
    ${items
      .map(
        (f, i) => `<details class="faq-item"${i === 0 ? ' open' : ''}>
      <summary id="${idPrefix}-${i}"><span>${esc(f.q)}</span><i aria-hidden="true"></i></summary>
      <div class="faq-body"><p>${esc(f.a)}</p></div>
    </details>`
      )
      .join('\n    ')}
  </div>`;
}

/**
 * 항목 신청 버튼.
 * externalApply 가 있으면 외부 접수 사이트로, 없으면 내부 신청서로 연결합니다.
 * data-apply 표시는 live-content.js 가 관리자 수정본을 반영할 때 사용합니다.
 */
function applyLink(s, base, o) {
  const opt = o || {};
  const cls = 'btn ' + (opt.cls || 'btn-primary btn-lg');
  const arrow = opt.arrow === false ? '' : ' ' + icon('arrow', 'ico ico-sm');

  // 아직 열지 않은 항목은 신청서로 보내지 않습니다 — 신청서에서 고를 수 없기 때문입니다.
  if (s.soon) {
    return `<a class="${cls}" href="${base}contact.html"
      data-apply="${s.id}">준비 중 — 문의하기${arrow}</a>`;
  }

  // 우리 게시판에서 받는 항목은 신청서가 아니라 그 게시판으로 보냅니다.
  if (s.applyVia) {
    const v = s.applyVia;
    return `<a class="${cls}" href="${base}${v.href}"
      data-apply="${s.id}">${esc(v.label)}${esc(v.verb || '으로 가기')}${arrow}</a>`;
  }

  if (s.externalApply) {
    const who = s.externalApplyLabel || '외부 사이트';
    /* 접수 페이지로 보내는 항목은 "…에서 신청하기", 서비스 자체로
       바로 보내는 항목은 "… 바로가기" 가 맞습니다. */
    const verb = s.externalApplyVerb || '에서 신청하기';
    return `<a class="${cls}" href="${s.externalApply}" target="_blank" rel="noopener"
      data-apply="${s.id}">${esc(who)}${esc(verb)}${arrow}</a>`;
  }
  return `<a class="${cls}" href="${base}apply.html?service=${s.id}"
      data-apply="${s.id}">${esc(opt.label || '이 항목 신청하기')}${arrow}</a>`;
}

/** 외부 접수 항목임을 알리는 안내 문구 */
function externalNote(s) {
  if (!s.externalApply) return '';
  const who = s.externalApplyLabel || '외부 사이트';
  const note = s.externalApplyNote
    || `이 항목의 신청은 <strong>${esc(who)}</strong> 접수 페이지에서 진행됩니다.`;
  return `<p class="apply-external-note" data-apply-note="${s.id}">
    ${note} 버튼을 누르면 새 창으로 열립니다.
  </p>`;
}

/**
 * 항목을 갈래별로 묶어 보여 줍니다.
 * 8개를 한 줄로 늘어놓으면 무엇부터 볼지 알기 어려워, 자리별로 나눴습니다.
 * 갈래에 들어가지 않는 항목이 생기면 맨 아래 '그 밖에' 로 따로 나옵니다.
 */
function serviceGroups(base) {
  const rest = services.filter((s) => !categories.some((c) => c.id === s.category));

  const block = (c, list) => `<section class="svc-cat" id="cat-${c.id}">
      <div class="svc-cat-head">
        <span class="svc-cat-ico">${icon(c.icon)}</span>
        <div>
          <h2 class="svc-cat-name">${esc(c.name)}</h2>
          <p class="svc-cat-tag">${esc(c.tagline)}</p>
        </div>
        <span class="svc-cat-count">${list.length}개 항목</span>
      </div>
      ${c.desc ? `<p class="svc-cat-desc">${esc(c.desc)}</p>` : ''}
      <div class="svc-grid">
        ${list.map((s) => serviceCard(s, base)).join('\n        ')}
      </div>
    </section>`;

  return categories
    .map((c) => {
      const list = services.filter((s) => s.category === c.id);
      return list.length ? block(c, list) : '';
    })
    .filter(Boolean)
    .concat(
      rest.length
        ? [block({ id: 'etc', name: '그 밖에', tagline: '아래 항목도 함께 진행합니다', icon: 'briefcase' }, rest)]
        : []
    )
    .join('\n    ');
}

/**
 * 첫 화면용 — 갈래 카드만 보여 줍니다.
 *
 * 항목 11개를 첫 화면에 늘어놓으면 무엇부터 볼지 알기 어렵습니다.
 * 지금 급한 자리(갈래)를 먼저 고르시게 하고, 그 안의 항목은
 * 카드 안에 이름만 적어 둡니다. 무료인 갈래(커뮤니티)는 아래 띠로 따로 냅니다.
 */
function categoryCards(base) {
  const paid = categories.filter((c) => !c.free);
  const free = categories.filter((c) => c.free);

  const card = (c) => {
    const list = services.filter((s) => s.category === c.id);
    return `<a class="cat-card" href="${base}services/index.html#cat-${c.id}">
      <span class="cat-card-ico">${icon(c.icon)}</span>
      <h3 class="cat-card-name">${esc(c.name)}</h3>
      <p class="cat-card-tag">${esc(c.tagline)}</p>
      <ul class="cat-card-list">
        ${list.map((s) => `<li>${esc(s.name)}</li>`).join('\n        ')}
      </ul>
      <span class="cat-card-go">${list.length}개 항목 보기 ${icon('arrow', 'ico ico-sm')}</span>
    </a>`;
  };

  const band = (c) => {
    const list = services.filter((s) => s.category === c.id);
    const items = c.highlights || [];
    return `<a class="cat-free" href="${base}services/${(list[0] || {}).slug || 'index'}.html">
      <div class="cat-free-main">
        <span class="cat-free-tag">가입 무료</span>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.tagline)}</p>
      </div>
      ${items.length ? `<ul class="cat-free-list">
        ${items.map((t) => `<li>${esc(t)}</li>`).join('\n        ')}
      </ul>` : ''}
      <span class="cat-free-go">${icon('arrow', 'ico')}</span>
    </a>`;
  };

  return `<div class="cat-cards">
      ${paid.map(card).join('\n      ')}
    </div>
    ${free.map(band).join('\n    ')}`;
}

/** 항목이 속한 갈래 (없으면 null) */
function categoryOf(s) {
  return categories.filter((c) => c.id === s.category)[0] || null;
}

function serviceCard(s, base) {
  return `<a class="svc-card${s.soon ? ' is-soon' : ''}" href="${base}services/${s.slug}.html">
    <span class="svc-no">${s.no}</span>
    ${s.soon ? '<span class="svc-soon">준비 중</span>' : ''}
    <span class="svc-ico">${icon(s.icon)}</span>
    <h3 data-live="svc.${s.id}.name">${esc(s.name)}</h3>
    <p class="svc-tag" data-live="svc.${s.id}.tagline">${esc(s.tagline)}</p>
    <p class="svc-sum" data-live="svc.${s.id}.summary">${esc(s.summary)}</p>
    <span class="svc-price">${esc(s.price || '상담 후 결정')}<em>${esc(s.billing || '건별 견적')}</em></span>
    <span class="svc-more">자세히 보기 ${icon('arrow', 'ico ico-sm')}</span>
  </a>`;
}

function ctaBand(base, opts) {
  const o = opts || {};
  return `<section class="cta-band">
  <div class="wrap cta-in">
    <div>
      <h2>${esc(o.title || '어떤 항목이 필요한지 아직 모르셔도 괜찮습니다')}</h2>
      <p>${esc(o.lead || '교회 상황을 알려주시면 담당자가 필요한 항목을 함께 정리해 드립니다. 상담과 견적은 무료입니다.')}</p>
    </div>
    <div class="cta-actions">
      <a class="btn btn-gold btn-lg" href="${base}apply.html">지원 신청하기</a>
      <a class="btn btn-ghost-light btn-lg" href="${site.contact.phoneHref}">전화 상담 ${phoneText()}</a>
    </div>
  </div>
</section>`;
}

module.exports = {
  ver,
  BOARDS,
  boardTabs,
  categories,
  serviceGroups,
  categoryCards,
  plans,
  planRules,
  trial,
  invite,
  categoryOf,
  esc,
  icon,
  phoneText,
  emailText,
  hoursText,
  addressText,
  applyLink,
  externalNote,
  logoMark,
  layout,
  pageHero,
  sectionHead,
  faqList,
  serviceCard,
  ctaBand,
  site,
  services,
};
