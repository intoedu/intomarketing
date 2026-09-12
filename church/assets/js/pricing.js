/* 패키지 — 월 납부 / 연납 전환
 *
 * 금액은 빌드할 때 카드마다 data-month · data-year 로 박아 둡니다.
 * 여기서는 그 두 값을 갈아끼우기만 하므로, 스크립트가 막혀도
 * 월 요금은 그대로 보입니다.
 */
(function () {
  'use strict';

  var sw = document.getElementById('planSwitch');
  if (!sw) return;

  var buttons = [].slice.call(sw.querySelectorAll('button'));
  var prices = [].slice.call(document.querySelectorAll('.plan-price'));
  var years = [].slice.call(document.querySelectorAll('.plan-year'));

  function show(cycle) {
    buttons.forEach(function (b) {
      var on = b.getAttribute('data-cycle') === cycle;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    prices.forEach(function (p) {
      var strong = p.querySelector('strong');
      if (!strong) return;
      strong.textContent = p.getAttribute(cycle === 'year' ? 'data-year' : 'data-month');
    });

    /* 연납일 때는 "연납 …원" 줄이 값을 되풀이하므로 문구를 바꿉니다 */
    years.forEach(function (el) {
      if (!el.getAttribute('data-month-text')) {
        el.setAttribute('data-month-text', el.innerHTML);
      }
      el.innerHTML = cycle === 'year'
        ? '1년치를 한 번에 내신 금액을 <b>12로 나눈 값</b>입니다'
        : el.getAttribute('data-month-text');
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      show(b.getAttribute('data-cycle'));
    });
  });

  show('month');
})();
