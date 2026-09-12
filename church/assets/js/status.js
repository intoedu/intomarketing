/* 신청 조회 — 접수번호로 조회하거나, 로그인한 계정의 신청 내역을 봅니다. */
(function () {
  'use strict';

  var form = document.getElementById('lookupForm');
  if (!form) return;

  var db = window.CAPSDB;
  var input = document.getElementById('code');
  var errBox = document.getElementById('lookupErr');
  var resultBox = document.getElementById('lookupResult');
  var recentBox = document.getElementById('recentBox');
  var recentList = document.getElementById('recentList');
  var recentTitle = recentBox ? recentBox.querySelector('h3') : null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function row(dt, dd) {
    if (!dd) return '';
    return '<div><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd></div>';
  }

  var STATUS_CLASS = {
    received: 'badge-received', consulting: 'badge-progress', proposed: 'badge-progress',
    progress: 'badge-progress', hold: 'badge-received', done: 'badge-done', canceled: 'badge-received',
  };

  function render(record) {
    var label = db.REQUEST_STATUS[record.status] || record.status;
    var cls = STATUS_CLASS[record.status] || 'badge-received';

    var extraRows = Object.keys(record.extra || {}).map(function (key) {
      var parts = key.split('__');
      return row(db.serviceName(parts[0]) + ' · ' + parts[1], record.extra[key]);
    }).join('');

    resultBox.innerHTML =
      '<div class="result-card">' +
        '<div class="result-head">' +
          '<strong>' + esc(record.code) + '</strong>' +
          '<span class="badge ' + cls + '">' + esc(label) + '</span>' +
        '</div>' +
        '<dl class="result-dl">' +
          row('접수 일시', db.formatDate(record.createdAt)) +
          row('신청 항목', (record.services || []).map(db.serviceName).join(', ')) +
          row('교회명', record.church_name + (record.denomination ? ' (' + record.denomination + ')' : '')) +
          row('담당자', record.contact_name + (record.contact_role ? ' ' + record.contact_role : '')) +
          row('연락처', record.phone) +
          row('이메일', record.email) +
          row('소재지', record.location) +
          row('교인 수', record.size) +
          row('예산 범위', record.budget) +
          row('희망 시기', record.timeline) +
          row('연락 방법', record.prefer) +
          extraRows +
          row('요청 내용', record.message) +
        '</dl>' +
      '</div>';
    resultBox.hidden = false;
  }

  function lookup(code, scrollTo) {
    db.findByCode(code).then(function (record) {
      if (!record) {
        resultBox.hidden = true;
        errBox.textContent = '해당 접수번호를 찾을 수 없습니다. 번호를 다시 확인해 주세요.';
        errBox.hidden = false;
        return;
      }
      errBox.hidden = true;
      render(record);
      if (scrollTo !== false) resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) {
      resultBox.hidden = true;
      errBox.textContent = '접수번호를 입력해 주세요.';
      errBox.hidden = false;
      return;
    }
    lookup(value);
  });

  /* ---------- 내 신청 내역 ---------- */

  function renderMine(user) {
    if (!recentBox) return;

    if (!user) {
      recentTitle.textContent = '내 신청 내역';
      recentList.innerHTML =
        '<li style="border:none;padding:8px 0"><button type="button" class="link-btn" id="myLogin">' +
        '로그인하면 신청 내역을 한 번에 볼 수 있습니다</button></li>';
      recentBox.hidden = false;
      var btn = document.getElementById('myLogin');
      if (btn) btn.addEventListener('click', function () { window.CAPSAuthUI.open({ tab: 'login' }); });
      return;
    }

    // 본인 신청만 조회합니다 (보안 규칙이 조회 범위를 확인합니다).
    db.list('requests', { where: { userId: user.id } }).then(function (mine) {
      recentTitle.textContent = mine.length ? '내 신청 내역 (' + mine.length + '건)' : '내 신청 내역';

      if (!mine.length) {
        recentList.innerHTML =
          '<li style="border:none;padding:8px 0;color:var(--muted);font-size:14.5px">' +
          '아직 신청한 내역이 없습니다. <a href="apply.html" style="color:var(--brand-600);font-weight:700">지원 신청하기</a></li>';
        recentBox.hidden = false;
        return;
      }

      recentList.innerHTML = mine.map(function (r) {
        var label = db.REQUEST_STATUS[r.status] || r.status;
        return '<li><a href="#" data-code="' + esc(r.code) + '">' +
          '<strong>' + esc(r.code) + '</strong>' +
          '<span>' + esc((r.services || []).map(db.serviceName).join(', ')) +
            ' · ' + esc(label) + ' · ' + esc(db.formatDate(r.createdAt, false)) + '</span>' +
          '</a></li>';
      }).join('');
      recentBox.hidden = false;
    });
  }

  if (recentList) {
    recentList.addEventListener('click', function (e) {
      var link = e.target.closest('a[data-code]');
      if (!link) return;
      e.preventDefault();
      input.value = link.dataset.code;
      lookup(link.dataset.code);
    });
  }

  db.auth.onChange(renderMine);

  /* ?code= 파라미터로 바로 조회 */
  var preset = new URLSearchParams(window.location.search).get('code');
  if (preset) {
    input.value = preset;
    lookup(preset, false);
  }
})();
