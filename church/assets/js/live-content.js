/* 관리자 수정 내용을 공개 페이지에 반영합니다.
 *
 * 정적 HTML(빌드 결과)이 기본이고, 관리자가 고친 항목만 덮어씁니다.
 * 데이터를 못 가져와도 페이지는 기본 내용으로 정상 동작합니다.
 *
 * 대상 표시는 build.js 가 넣어 둔 data-live 속성으로 찾습니다.
 *   data-live="svc.<항목id>.<필드>"     — 텍스트 교체
 *   data-live-list="svc.<항목id>.<필드>" — 목록 전체 교체
 *   data-live="site.<필드>"             — 센터 연락처 등
 */
(function () {
  'use strict';

  var db = window.CAPSDB;
  if (!db) return;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 지원 항목 ---------- */

  function applyServices(map) {
    Object.keys(map).forEach(function (id) {
      var over = map[id];

      /* 텍스트 필드 */
      ['name', 'tagline', 'summary', 'duration', 'priceNote'].forEach(function (key) {
        if (over[key] == null || over[key] === '') return;
        document.querySelectorAll('[data-live="svc.' + id + '.' + key + '"]').forEach(function (el) {
          el.textContent = over[key];
        });
      });

      /* 지원 내용 */
      if (over.features && over.features.length) {
        document.querySelectorAll('[data-live-list="svc.' + id + '.features"]').forEach(function (host) {
          host.innerHTML = over.features.map(function (f) {
            return '<article class="feat-card">' +
              '<span class="feat-ico"><svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="m4.5 12.5 5 5 10-11"/></svg></span>' +
              '<h3>' + esc(f.title) + '</h3><p>' + esc(f.desc) + '</p></article>';
          }).join('');
        });
      }

      /* 제공 내역 */
      if (over.deliverables && over.deliverables.length) {
        document.querySelectorAll('[data-live-list="svc.' + id + '.deliverables"]').forEach(function (host) {
          host.innerHTML = over.deliverables.map(function (d) {
            return '<li><svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="m4.5 12.5 5 5 10-11"/></svg><span>' + esc(d) + '</span></li>';
          }).join('');
        });
      }

      /* FAQ */
      if (over.faqs && over.faqs.length) {
        document.querySelectorAll('[data-live-list="svc.' + id + '.faqs"]').forEach(function (host) {
          host.innerHTML = over.faqs.map(function (f, i) {
            return '<details class="faq-item"' + (i === 0 ? ' open' : '') + '>' +
              '<summary><span>' + esc(f.q) + '</span><i aria-hidden="true"></i></summary>' +
              '<div class="faq-body"><p>' + esc(f.a) + '</p></div></details>';
          }).join('');
        });
      }

      /* 외부 접수 주소 변경 */
      if (over.externalApply != null) applyExternal(id, over);

      /* 숨김 처리 */
      if (over.published === false) hideService(id);
    });
  }

  /** 관리자가 바꾼 외부 접수 주소를 신청 버튼에 반영합니다. */
  function applyExternal(id, over) {
    var url = String(over.externalApply || '').trim();
    var who = String(over.externalApplyLabel || '').trim() || '외부 사이트';

    document.querySelectorAll('[data-apply="' + id + '"]').forEach(function (a) {
      if (url) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        // 버튼 문구의 앞부분(사이트 이름)만 바꿉니다.
        if (/에서 신청하기/.test(a.textContent)) {
          var arrow = a.querySelector('svg');
          a.textContent = who + '에서 신청하기';
          if (arrow) a.appendChild(arrow);
        }
      } else {
        // 주소를 비우면 내부 신청서로 되돌립니다.
        var prefix = /\/services\//.test(window.location.pathname) ? '../' : '';
        a.href = prefix + 'apply.html?service=' + id;
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });

    document.querySelectorAll('[data-apply-note="' + id + '"]').forEach(function (note) {
      if (!url) { note.hidden = true; return; }
      note.hidden = false;
      note.innerHTML = '이 항목의 신청은 <strong>' + esc(who) +
        '</strong> 접수 페이지에서 진행됩니다. 버튼을 누르면 새 창으로 열립니다.';
    });
  }

  /** 공개를 끈 항목: 목록 카드에 표시하고, 상세 페이지의 신청 버튼을 막습니다. */
  function hideService(id) {
    document.querySelectorAll('a.svc-card[href$="/' + id + '.html"], a.svc-card[href$="services/' + id + '.html"]')
      .forEach(function (card) {
        card.classList.add('is-closed');
        if (!card.querySelector('.svc-closed')) {
          var tag = document.createElement('span');
          tag.className = 'svc-closed';
          tag.textContent = '접수 일시 중지';
          card.appendChild(tag);
        }
      });

    document.querySelectorAll('.hero-card-list a[href$="services/' + id + '.html"]').forEach(function (a) {
      a.classList.add('is-closed');
    });

    if (document.body.dataset.service !== id) return;

    // 상세 페이지 본문
    document.querySelectorAll('a[href*="apply.html?service=' + id + '"]').forEach(function (btn) {
      var span = document.createElement('span');
      span.className = 'btn btn-outline btn-lg is-disabled';
      span.textContent = '현재 접수를 받지 않습니다';
      btn.replaceWith(span);
    });

    var hero = document.querySelector('.svc-hero .lead');
    if (hero && !document.querySelector('.svc-closed-notice')) {
      var box = document.createElement('p');
      box.className = 'svc-closed-notice';
      box.textContent = '이 항목은 현재 신청 접수를 잠시 중지했습니다. 문의는 전화로 부탁드립니다.';
      hero.after(box);
    }
  }

  /* ---------- 센터 정보 ---------- */

  function applySite(s) {
    if (!s) return;

    if (s.phone) {
      document.querySelectorAll('[data-live="site.phone"]').forEach(function (el) { el.textContent = s.phone; });
      var href = 'tel:' + s.phone.replace(/[^0-9+]/g, '');
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.href = href; });
    }
    if (s.email) {
      document.querySelectorAll('[data-live="site.email"]').forEach(function (el) { el.textContent = s.email; });
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) { a.href = 'mailto:' + s.email; });
    }
    ['hours', 'address'].forEach(function (key) {
      if (!s[key]) return;
      document.querySelectorAll('[data-live="site.' + key + '"]').forEach(function (el) { el.textContent = s[key]; });
    });

    if (s.noticeBanner) showNotice(s.noticeBanner);
  }

  function showNotice(text) {
    if (document.querySelector('.site-notice')) return;
    var bar = document.createElement('div');
    bar.className = 'site-notice';
    bar.innerHTML = '<div class="wrap"><span>' + esc(text) + '</span></div>';
    var header = document.querySelector('.site-header');
    if (header) header.after(bar);
  }

  /* ---------- 실행 ---------- */

  function run() {
    db.list('serviceContent')
      .then(function (rows) {
        var map = {};
        rows.forEach(function (r) { map[r.id] = r; });
        applyServices(map);
      })
      .catch(function () { /* 실패 시 기본 내용 유지 */ });

    db.list('settings')
      .then(function (rows) {
        var hit = rows.filter(function (r) { return r.id === 'site'; });
        if (hit.length) applySite(hit[0]);
      })
      .catch(function () { /* 실패 시 기본 내용 유지 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
