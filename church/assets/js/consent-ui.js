/* 정보 수정 승인 (고객 쪽 화면)
 *
 * 센터가 교회 정보를 고쳐야 할 때는 먼저 그 교회에 승인을 요청합니다.
 * 이 파일은 로그인한 교회 계정에게 요청을 보여주고 승인 · 거절을 받습니다.
 *
 *   · 헤더 아래에 안내 띠가 뜹니다 (요청이 있는 동안 계속)
 *   · 창은 세션에 한 번 자동으로 열리고, 띠에서 다시 열 수 있습니다
 *   · 프로필 필수 입력과 달리 닫을 수 있습니다 (강제하지 않습니다)
 */
window.CAPSConsentUI = (function () {
  'use strict';

  var db = window.CAPSDB;
  var SEEN = 'caps.consent.seen';
  var modal = null;
  var rows = [];       // 응답을 기다리는 요청들
  var current = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- 안내 띠 ---------------- */

  function strip(count) {
    var bar = document.getElementById('consentStrip');
    if (!count) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'consent-strip';
      bar.id = 'consentStrip';
      var header = document.querySelector('.site-header');
      var after = document.querySelector('.site-notice') || header;
      if (!after) return;
      after.after(bar);
    }
    bar.innerHTML =
      '<div class="wrap">' +
        '<span><strong>우리교회지원센터</strong>가 교회 정보 수정 승인을 요청했습니다' +
          (count > 1 ? ' (' + count + '건)' : '') + '.</span>' +
        '<button type="button" class="btn btn-primary btn-sm" id="consentOpen">내용 확인하기</button>' +
      '</div>';
    bar.querySelector('#consentOpen').addEventListener('click', function () { open(); });
  }

  /* ---------------- 창 ---------------- */

  function build() {
    if (modal) return modal;
    var el = document.createElement('div');
    el.className = 'auth-modal consent-modal';
    el.id = 'consentModal';
    el.hidden = true;
    el.innerHTML =
      '<div class="auth-backdrop" data-close></div>' +
      '<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="csTitle">' +
        '<div class="cs-head">' +
          '<h2 id="csTitle">교회 정보 수정 승인 요청</h2>' +
          '<p>승인하시면 센터 담당자가 아래 항목을 ' + db.CONSENT_DAYS + '일 동안 고칠 수 있습니다.<br>' +
            '승인하지 않으셔도 다른 이용에는 영향이 없습니다.</p>' +
          '<button type="button" class="auth-close" data-close aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="auth-body" id="csBody"></div>' +
      '</div>';
    document.body.appendChild(el);
    modal = el;

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) close();
    });
    return el;
  }

  function paint() {
    var body = modal.querySelector('#csBody');
    if (!rows.length) {
      body.innerHTML =
        '<p class="cs-done">확인하실 요청이 없습니다.</p>' +
        '<button type="button" class="btn btn-outline btn-block" data-close>닫기</button>';
      return;
    }

    current = rows[0];
    var v = db.consentView(current);

    body.innerHTML =
      (rows.length > 1 ? '<p class="cs-count">요청 ' + rows.length + '건 중 1건</p>' : '') +
      '<div class="cs-card">' +
        '<p class="cs-line"><span>교회</span><strong>' + esc(current.customerName || '-') + '</strong></p>' +
        '<p class="cs-line"><span>수정할 항목</span><strong>' + esc(db.fieldLabels(v.fields)) + '</strong></p>' +
        '<p class="cs-line"><span>요청한 사람</span><strong>' +
          esc(current.requestedByName || '우리교회지원센터') + '</strong></p>' +
        '<p class="cs-line"><span>요청 일시</span><strong>' +
          esc(db.formatDate(current.requestedAt)) + '</strong></p>' +
      '</div>' +
      (v.reason
        ? '<div class="cs-reason"><strong>요청 사유</strong><p>' + esc(v.reason) + '</p></div>'
        : '') +
      '<p class="auth-err" id="csErr" hidden></p>' +
      '<div class="cs-actions">' +
        '<button type="button" class="btn btn-primary btn-block btn-lg" id="csYes">승인합니다</button>' +
        '<button type="button" class="btn btn-outline btn-block" id="csNo">거절합니다</button>' +
      '</div>' +
      '<div class="cs-reject" id="csRejectBox" hidden>' +
        '<div class="field"><label for="csNote">거절 사유 (선택)</label>' +
          '<textarea id="csNote" rows="2" placeholder="예: 담당자가 바뀌는 중이라 다음 주에 다시 요청해 주세요."></textarea></div>' +
        '<button type="button" class="btn btn-outline btn-block" id="csNoConfirm">거절 보내기</button>' +
      '</div>' +
      '<p class="cs-foot">나중에 결정하시려면 창을 닫으시면 됩니다. ' +
        '홈페이지 위쪽 안내에서 다시 열 수 있습니다.</p>';

    body.querySelector('#csYes').addEventListener('click', function () { respond(true, ''); });
    body.querySelector('#csNo').addEventListener('click', function () {
      body.querySelector('#csRejectBox').hidden = false;
      body.querySelector('#csNote').focus();
    });
    body.querySelector('#csNoConfirm').addEventListener('click', function () {
      respond(false, body.querySelector('#csNote').value);
    });
  }

  function respond(approve, note) {
    var err = modal.querySelector('#csErr');
    err.hidden = true;
    var id = current.customerId || current.id;

    db.respondChurchEdit(id, approve, note).then(function () {
      rows = rows.filter(function (r) { return r !== current; });
      strip(rows.length);
      if (!rows.length) {
        modal.querySelector('#csBody').innerHTML =
          '<p class="cs-done">' + (approve
            ? '승인해 주셔서 감사합니다. 센터 담당자가 정보를 확인하고 수정합니다.'
            : '거절 의견을 전달했습니다. 센터에서 다시 연락드릴 수 있습니다.') + '</p>' +
          '<button type="button" class="btn btn-primary btn-block" data-close>닫기</button>';
        return;
      }
      paint();
    }).catch(function (ex) {
      err.textContent = ex.message || '처리 중 문제가 발생했습니다.';
      err.hidden = false;
    });
  }

  function open() {
    build();
    paint();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------------- 확인 ---------------- */

  function check(user) {
    if (!user) {
      rows = [];
      strip(0);
      close();
      return Promise.resolve([]);
    }

    return db.myEditConsents().then(function (list) {
      rows = list.filter(function (x) { return x.status === 'pending'; });
      strip(rows.length);
      if (!rows.length) return rows;

      // 추가 정보 입력이 걸려 있으면 그쪽을 먼저 끝내도록 비켜 줍니다.
      if (window.CAPSProfile && window.CAPSProfile.isOpen()) return rows;

      // 세션마다 한 번만 자동으로 엽니다.
      // 새 요청이 오면 열쇠가 달라져 다시 한 번 열립니다.
      var key = user.id + ':' + rows.map(function (r) {
        return r.id + '@' + (r.requestedAt || '');
      }).join(',');
      if (window.sessionStorage.getItem(SEEN) !== key) {
        window.sessionStorage.setItem(SEEN, key);
        open();
      }
      return rows;
    }).catch(function () {
      // 조회에 실패해도 페이지 이용을 막지 않습니다.
      return [];
    });
  }

  db.auth.onChange(function (user) {
    if (!user) { check(null); return; }
    // 필수 정보 입력이 끝난 뒤에 확인합니다.
    if (window.CAPSProfile) window.CAPSProfile.ensure(user).then(check);
    else check(user);
  });

  return { open: open, close: close, check: check, pending: function () { return rows.slice(); } };
})();
