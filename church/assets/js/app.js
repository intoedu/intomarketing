/* 공통 UI 동작: 모바일 메뉴, 지원 항목 드롭다운, 스크롤 효과 */
(function () {
  'use strict';

  var header = document.getElementById('siteHeader');
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var mega = document.getElementById('mega');

  /* 모바일 메뉴 */
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? '메뉴 열기' : '메뉴 닫기');
      nav.classList.toggle('is-open', !open);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* 데스크톱 '지원 항목' 드롭다운 */
  if (mega) {
    var trigger = document.querySelector('.nav-link[href$="services/index.html"]');
    var closeTimer = null;
    var isDesktop = function () { return window.matchMedia('(min-width: 821px)').matches; };

    var open = function () {
      if (!isDesktop()) return;
      window.clearTimeout(closeTimer);
      mega.hidden = false;
    };
    var close = function (delay) {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function () { mega.hidden = true; }, delay || 0);
    };

    if (trigger) {
      trigger.addEventListener('mouseenter', open);
      trigger.addEventListener('focus', open);
      trigger.addEventListener('mouseleave', function () { close(180); });
    }
    mega.addEventListener('mouseenter', open);
    mega.addEventListener('mouseleave', function () { close(120); });
    if (header) {
      header.addEventListener('focusout', function (e) {
        if (!header.contains(e.relatedTarget)) close(0);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close(0);
    });
    window.addEventListener('resize', function () { if (!isDesktop()) mega.hidden = true; });
  }

  /* 스크롤 시 헤더 그림자 */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* 메뉴의 [홈] 으로 갈 때는 가림막을 띄우지 않습니다.

     처음 들어오실 때와 로고를 누르실 때는 가림막이 뜨는 편이
     좋습니다 — 사이트가 열리는 느낌이 있습니다. 그런데 메뉴에서
     [홈] 을 누르는 것은 페이지 사이를 오가는 일이라, 그때마다
     화면이 덮이면 성가십니다.

     둘 다 index.html 로 가므로 주소만으로는 가릴 수 없습니다.
     그래서 [홈] 을 누르셨다는 것만 같은 탭 안에 잠깐 적어 두고,
     홈에서 읽는 즉시 지웁니다. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.nav-link[href$="index.html"]');
    if (!a) return;
    try { window.sessionStorage.setItem('wcsc.veil', 'skip'); } catch (ignore) { /* 못 적어도 그만 */ }
  });

  /* 등장 애니메이션 */
  var targets = document.querySelectorAll(
    '.svc-card, .why-card, .step, .prep-card, .prob-card, .feat-card, .contact-card, .tl-item, '
    + '.item, .bd-tile'
  );
  if (targets.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.style.transitionDelay = Math.min(i * 60, 240) + 'ms';
          el.classList.add('is-in');
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.08 }
    );
    targets.forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  /* 떠 있는 [지원 신청] 버튼 — 진짜 버튼이 보이면 비켜 줍니다.

     좁은 화면에서만 뜨는 버튼인데 position:fixed 라, 마침 화면 아래쪽에
     [지원 신청하기] 버튼이 와 있으면 그 위에 겹쳐 앉았습니다.
     첫 화면에서 특히 그랬습니다 — 두 버튼이 포개져 글자가 서로 먹혔습니다.

     화면 안에 진짜 신청 버튼이 하나라도 보이면 뜬 버튼을 숨깁니다.
     어차피 그 순간에는 있을 이유가 없습니다. */
  var floatCta = document.querySelector('.float-cta');
  if (floatCta && window.IntersectionObserver) {
    var realCtas = Array.prototype.filter.call(
      document.querySelectorAll('a[href$="apply.html"], a[href*="apply.html?"]'),
      function (a) { return a !== floatCta && !a.closest('.site-footer'); }
    );

    if (realCtas.length) {
      var showing = 0;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          // 하나라도 보이는 동안에는 뜬 버튼을 접어 둡니다.
          showing += e.isIntersecting ? 1 : -1;
        });
        if (showing < 0) showing = 0;
        floatCta.classList.toggle('is-tucked', showing > 0);
      }, { rootMargin: '-8px' });

      realCtas.forEach(function (a) { io.observe(a); });
    }
  }

  /* 푸터 연도 */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
