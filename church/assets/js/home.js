/* =========================================================
   홈 화면 (index.html)

     1) 미는 배너의 점
     2) 지원 항목을 갈래로 걸러 보기

   찾기는 머리(header)에 있고 assets/js/search.js 가 맡습니다.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 첫 화면 인트로 ----------

     홈에 들어오시면 로고가 잠깐 떴다가 걷히고, 그 뒤로 배너와
     아이콘이 하나씩 차례로 떠오릅니다. 전부 1.2초입니다.

     덩어리째 띄우지 않고 낱개로 세우는 이유
       칸 전체가 한꺼번에 나타나면 그냥 늦게 그려진 것처럼 보입니다.
       하나씩 조금씩 늦춰야 "차례로 놓인다" 로 읽힙니다.

     지키는 것 넷
       1. 기다리게 하지 않습니다. 어디를 누르거나 스크롤하거나
          자판을 치시면 그 자리에서 걷힙니다.
       2. 움직임을 줄여 달라고 설정하신 분께는 아무것도 하지
          않습니다. 어지러움을 느끼시는 분이 실제로 계십니다.
       3. 자바스크립트가 늦거나 막혀도 화면은 그대로 다 보입니다 —
          가림막은 자바스크립트가 직접 붙였다 뗍니다.
       4. 어떤 일이 있어도 1.8초 뒤에는 반드시 걷힙니다.
  */

  (function intro() {
    var still = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) return;

    /* 메뉴의 [홈] 을 눌러 오신 경우에는 가림막을 띄우지 않습니다.
       페이지 사이를 오가는 일이라 그때마다 화면이 덮이면 성가십니다.
       처음 들어오실 때와 로고를 누르실 때는 그대로 뜹니다. */
    var skipVeil = false;
    try {
      skipVeil = window.sessionStorage.getItem('wcsc.veil') === 'skip';
      window.sessionStorage.removeItem('wcsc.veil');
    } catch (ignore) { skipVeil = false; }

    var VEIL = 550;    // 가림막이 걷히기 시작하는 때
    var OPEN = skipVeil ? 60 : 900;   // 내용이 움직이기 시작하는 때

    /* [무엇을, 언제부터, 몇 ms 씩 늦춰]

       가림막이 사라진 뒤부터 움직입니다. 앞서는 0.64초부터
       움직이게 해 두었는데, 그때는 아직 가림막이 덮고 있어
       가림막 뒤에서 다 끝나 버렸습니다 — 보이지 않는 움직임은
       없는 것과 같습니다. */
    var plan = [
      ['.bn', OPEN - 50, 130],        // 배너 카드
      ['.sc-label', OPEN + 120, 0],   // 줄 이름
      ['.sc', OPEN + 170, 55],        // 아이콘 하나씩
      ['.hd-row', OPEN + 320, 0],     // 항목 제목
      ['.cat-tab', OPEN + 380, 45],   // 갈래 탭
    ];

    var moved = [];
    plan.forEach(function (row) {
      var list = document.querySelectorAll(row[0]);
      Array.prototype.forEach.call(list, function (el, i) {
        el.classList.add('rise');
        el.style.animationDelay = (row[1] + i * row[2]) + 'ms';
        moved.push(el);
      });
    });

    /* 가림막 — 로고가 잠깐 떴다가 걷힙니다. */
    var veil = null;
    if (!skipVeil) {
      veil = document.createElement('div');
      veil.className = 'intro';
      veil.setAttribute('aria-hidden', 'true');
      veil.innerHTML = '<img class="intro-logo" src="assets/img/logo-light.png" alt="">';
      document.body.appendChild(veil);
      document.body.classList.add('is-intro');
    }

    /* 표시를 떼면 그 자리에서 다 보입니다 (.rise 가 없으면 그냥 화면).
       그래서 두 가지를 나눠 둡니다 —
         걷기(veil)   가림막을 올립니다
         정리(clean)  움직임 표시를 뗍니다
       늦게 시작하는 아이콘까지 다 지나간 뒤에 정리해야 중간에
       잘리지 않습니다. 다만 누르셔서 건너뛰실 때는 곧바로
       정리해 그 자리에서 다 보이게 합니다. */

    var last = 0;
    plan.forEach(function (row) {
      var n = document.querySelectorAll(row[0]).length;
      if (n) last = Math.max(last, row[1] + (n - 1) * row[2]);
    });
    var CLEAN = last + 500;

    var lifted = false;
    var cleaned = false;

    function clean() {
      if (cleaned) return;
      cleaned = true;
      moved.forEach(function (el) {
        el.classList.remove('rise');
        el.style.animationDelay = '';
      });
    }

    function lift(now) {
      if (lifted) return;
      lifted = true;

      if (veil) {
        veil.classList.add('is-gone');
        document.body.classList.remove('is-intro');
        window.setTimeout(function () {
          if (veil.parentNode) veil.parentNode.removeChild(veil);
        }, 370);
      }

      ['click', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
        window.removeEventListener(ev, skip);
      });

      // 건너뛰신 경우에는 바로 정리해 곧장 다 보이게 합니다.
      if (now) clean();
    }

    function skip() { lift(true); }

    /* 누르거나 스크롤하시면 바로 걷습니다 */
    ['click', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, skip, { passive: true });
    });

    window.setTimeout(function () { lift(false); }, skipVeil ? 0 : VEIL);
    window.setTimeout(clean, CLEAN);
    // 무슨 일이 있어도 여기서는 걷히고 정리됩니다.
    window.setTimeout(function () { lift(true); }, 1600);
  }());

  /* ---------- 미는 배너 ----------
     화살표 단추를 붙이지 않았습니다. 손가락으로 미는 것이 이미
     되고, 마우스로는 다음 장이 걸쳐 보여 밀 수 있다는 것이 보입니다.
     점은 어디까지 왔는지 알려 주는 몫만 합니다. */

  var rail = document.getElementById('bnRail');
  var dots = document.getElementById('bnDots');

  if (rail && dots) {
    var buttons = dots.querySelectorAll('.bn-dot');

    /* 점은 배너 한 장에 하나씩 둡니다. 다만 화면이 넓으면 배너가 두 장씩
       보여, 끝까지 밀어도 마지막 장이 첫 자리에 오지 않습니다. 그래서
       끝에 닿으면 마지막 점을 켜 줍니다 — 그러지 않으면 눌러도 켜지지
       않는 점이 생깁니다. */
    var paint = function () {
      var cards = rail.querySelectorAll('.bn');
      if (!cards.length) return;
      var step = cards[0].offsetWidth + 16;
      var end = rail.scrollWidth - rail.clientWidth;

      var at = Math.min(buttons.length - 1, Math.max(0, Math.round(rail.scrollLeft / step)));

      if (end > 0 && end - rail.scrollLeft < 4) {
        // 끝에서는 마지막 두 장이 함께 보입니다. 방금 고른 점이 화면에 있으면
        // 그 점을 그대로 두고, 아니면 마지막 점을 켭니다.
        var on = -1;
        Array.prototype.forEach.call(buttons, function (b, i) {
          if (b.classList.contains('is-on')) on = i;
        });
        var seen = on > -1 && cards[on]
          && cards[on].offsetLeft - rail.offsetLeft >= rail.scrollLeft - 4;
        at = seen ? on : buttons.length - 1;
      }

      Array.prototype.forEach.call(buttons, function (b, i) {
        b.classList.toggle('is-on', i === at);
      });
    };

    var waiting = false;
    rail.addEventListener('scroll', function () {
      if (waiting) return;
      waiting = true;
      window.requestAnimationFrame(function () { paint(); waiting = false; });
    }, { passive: true });

    dots.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      var cards = rail.querySelectorAll('.bn');
      var i = Number(b.getAttribute('data-go'));
      if (!cards[i]) return;
      // 오른쪽 끝을 넘겨 밀 수는 없습니다. 마지막 점은 끝까지 데려다 줍니다.
      var to = Math.min(cards[i].offsetLeft - rail.offsetLeft, rail.scrollWidth - rail.clientWidth);
      rail.scrollTo({ left: to, behavior: 'smooth' });
      Array.prototype.forEach.call(buttons, function (x, n) { x.classList.toggle('is-on', n === i); });
    });

    window.addEventListener('resize', paint);
    paint();
  }

  /* ---------- 갈래로 걸러 보기 ---------- */

  var tabs = document.getElementById('catTabs');
  var grid = document.getElementById('itemGrid');

  if (tabs && grid) {
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) return;

      var want = btn.getAttribute('data-cat');
      Array.prototype.forEach.call(tabs.querySelectorAll('.cat-tab'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
      Array.prototype.forEach.call(grid.querySelectorAll('.item'), function (card) {
        card.hidden = !!want && card.getAttribute('data-cat') !== want;
      });
    });
  }

}());
