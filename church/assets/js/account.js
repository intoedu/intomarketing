/* 내 정보 수정 (고객 · 직원 공용)
 *
 * 헤더 사용자 메뉴, 관리자 사이드바, 직원 포털 승인 대기 화면에서 엽니다.
 *   window.CAPSAccount.open()
 *
 * 여기서 고치는 값은 모두 본인 계정 문서(users)의 것입니다.
 * 직분 · 승인 · 권한은 보안 규칙에서 본인이 바꿀 수 없게 막혀 있으므로
 * 이 화면에도 나오지 않습니다.
 *
 * 가입 직후 필수 정보를 받는 화면은 assets/js/profile.js 입니다.
 * (그쪽은 닫을 수 없고, 이 화면은 닫을 수 있습니다.)
 */
window.CAPSAccount = (function () {
  'use strict';

  var db = window.CAPSDB;
  var modal = null;
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function base() {
    return /\/services\//.test(window.location.pathname) ? '../' : '';
  }

  function build() {
    if (modal) return modal;

    var el = document.createElement('div');
    el.className = 'auth-modal acct-modal';
    el.id = 'acctModal';
    el.hidden = true;
    el.innerHTML =
      '<div class="auth-backdrop" data-close></div>' +
      '<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="acTitle">' +
        '<div class="ac-head">' +
          '<h2 id="acTitle">내 정보</h2>' +
          '<p id="acWho"></p>' +
          '<button type="button" class="auth-close" data-close aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="auth-body">' +

          /* ---- 기본 정보 ---- */
          '<form class="auth-form" id="acForm" novalidate>' +
            '<p class="ac-sec">기본 정보</p>' +
            '<div class="field"><label for="acName">성함 <em class="req">필수</em></label>' +
              '<input type="text" id="acName" autocomplete="name" required></div>' +
            '<div class="field"><label for="acBirth">생년월일 <span class="opt">선택</span></label>' +
              '<input type="date" id="acBirth" autocomplete="bday"></div>' +
            '<div class="field"><label for="acChurch">교회명 <em class="req">필수</em></label>' +
              '<input type="text" id="acChurch" autocomplete="organization" required></div>' +
            '<div class="field"><label for="acRole">직분 <em class="req">필수</em></label>' +
              '<select id="acRole" required></select></div>' +
            '<div class="field" id="acRoleOtherBox" hidden><label for="acRoleOther">직분 직접 입력 <em class="req">필수</em></label>' +
              '<input type="text" id="acRoleOther"></div>' +
            '<div class="field"><label for="acPhone">연락처 <em class="req">필수</em></label>' +
              '<input type="tel" id="acPhone" autocomplete="tel" required placeholder="01000000000">' +
              '<p class="field-hint">숫자 11자리까지 입력됩니다. 하이픈은 자동으로 들어갑니다.</p></div>' +
            '<p class="auth-err" id="acErr" hidden></p>' +
            '<p class="auth-ok" id="acOk" hidden></p>' +
            '<button type="submit" class="btn btn-primary btn-block btn-lg">저장</button>' +
          '</form>' +

          /* ---- 로그인 정보 ---- */
          '<div class="ac-block">' +
            '<p class="ac-sec">로그인 정보</p>' +
            '<p class="ac-row"><span>이메일</span><strong id="acEmail"></strong></p>' +
            '<p class="ac-row"><span>로그인 방식</span><strong id="acProvider"></strong></p>' +
            '<p class="ac-note">이메일은 로그인 아이디여서 이 화면에서 바꿀 수 없습니다. ' +
              '변경이 필요하시면 센터로 문의해 주세요.</p>' +
          '</div>' +

          /* ---- 비밀번호 변경 (이메일 계정만) ---- */
          '<form class="auth-form ac-block" id="acPwForm" novalidate hidden>' +
            '<p class="ac-sec">비밀번호 변경</p>' +
            '<div class="field"><label for="acPwNow">현재 비밀번호 <em class="req">필수</em></label>' +
              '<div class="pw-row"><input type="password" id="acPwNow" autocomplete="current-password" required>' +
              '<button type="button" class="pw-toggle" data-pw="acPwNow">표시</button></div></div>' +
            '<div class="field"><label for="acPwNew">새 비밀번호 <em class="req">필수</em></label>' +
              '<div class="pw-row"><input type="password" id="acPwNew" autocomplete="new-password" required placeholder="6자 이상">' +
              '<button type="button" class="pw-toggle" data-pw="acPwNew">표시</button></div></div>' +
            '<div class="field"><label for="acPwNew2">새 비밀번호 확인 <em class="req">필수</em></label>' +
              '<div class="pw-row"><input type="password" id="acPwNew2" autocomplete="new-password" required>' +
              '<button type="button" class="pw-toggle" data-pw="acPwNew2">표시</button></div>' +
              '<p class="field-hint" id="acPwMatch"></p></div>' +
            '<p class="auth-err" id="acPwErr" hidden></p>' +
            '<p class="auth-ok" id="acPwOk" hidden></p>' +
            '<button type="submit" class="btn btn-outline btn-block">비밀번호 바꾸기</button>' +
          '</form>' +

          /* ---- 구글 계정 안내 ---- */
          '<div class="ac-block" id="acGoogleNote" hidden>' +
            '<p class="ac-sec">비밀번호</p>' +
            '<p class="ac-note">구글 로그인으로 가입하신 계정이라 센터에 비밀번호가 없습니다. ' +
              '비밀번호는 구글 계정 설정에서 관리해 주세요.</p>' +
          '</div>' +

          '<p class="ac-foot"><button type="button" class="link-btn" id="acSignOut">로그아웃</button></p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    modal = el;
    wire();
    return el;
  }

  function wire() {
    var q = function (id) { return modal.querySelector('#' + id); };

    q('acRole').innerHTML = db.roleOptionsHtml();
    db.bindRoleSelect(q('acRole'), q('acRoleOther'));
    db.bindPhoneInput(q('acPhone'));

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      var pw = e.target.closest('[data-pw]');
      if (pw) {
        var input = q(pw.dataset.pw);
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        pw.textContent = showing ? '표시' : '숨기기';
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) close();
    });

    q('acSignOut').addEventListener('click', function () {
      db.auth.signOut().then(function () { window.location.href = base() + 'index.html'; });
    });

    /* 새 비밀번호 일치 표시 */
    var n1 = q('acPwNew'), n2 = q('acPwNew2'), match = q('acPwMatch');
    var checkMatch = function () {
      if (!n2.value) { match.textContent = ''; match.className = 'field-hint'; return; }
      var same = n1.value === n2.value;
      match.textContent = same ? '비밀번호가 일치합니다.' : '비밀번호가 서로 다릅니다.';
      match.className = 'field-hint ' + (same ? 'is-match' : 'is-mismatch');
    };
    n1.addEventListener('input', checkMatch);
    n2.addEventListener('input', checkMatch);

    /* 기본 정보 저장 */
    q('acForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = q('acErr'), ok = q('acOk');
      err.hidden = true;
      ok.hidden = true;

      var v = function (id) { return (q(id).value || '').trim(); };
      var role = db.roleValue(q('acRole'), q('acRoleOther'));
      var problem = null;
      if (!v('acName')) problem = ['성함을 입력해 주세요.', 'acName'];
      else if (!v('acChurch')) problem = ['교회명을 입력해 주세요.', 'acChurch'];
      else if (!q('acRole').value) problem = ['직분을 선택해 주세요.', 'acRole'];
      else if (!role) problem = ['직분을 직접 입력해 주세요.', 'acRoleOther'];
      else if (!v('acPhone')) problem = ['연락처를 입력해 주세요.', 'acPhone'];
      else if (!db.isValidPhone(v('acPhone'))) problem = ['연락처를 정확히 입력해 주세요.', 'acPhone'];

      if (problem) {
        err.textContent = problem[0];
        err.hidden = false;
        var t = q(problem[1]);
        if (t) t.focus();
        return;
      }

      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '저장 중…';
      db.auth.updateProfile({
        name: v('acName'),
        birthDate: v('acBirth'),
        church: v('acChurch'),
        contactRole: role,
        phone: db.formatPhone(v('acPhone')),
      }).then(function () {
        ok.textContent = '저장했습니다.';
        ok.hidden = false;
        fill();
      }).catch(function (ex) {
        err.innerHTML = ex.message;
        err.hidden = false;
      }).then(function () {
        btn.disabled = false;
        btn.textContent = '저장';
      });
    });

    /* 비밀번호 변경 */
    q('acPwForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = q('acPwErr'), ok = q('acPwOk');
      err.hidden = true;
      ok.hidden = true;

      var now = q('acPwNow').value, a = q('acPwNew').value, b = q('acPwNew2').value;
      var problem = null;
      if (!now) problem = ['현재 비밀번호를 입력해 주세요.', 'acPwNow'];
      else if (a.length < 6) problem = ['새 비밀번호는 6자 이상으로 입력해 주세요.', 'acPwNew'];
      else if (a !== b) problem = ['새 비밀번호가 서로 다릅니다.', 'acPwNew2'];
      else if (a === now) problem = ['지금 쓰는 비밀번호와 같습니다.', 'acPwNew'];

      if (problem) {
        err.textContent = problem[0];
        err.hidden = false;
        q(problem[1]).focus();
        return;
      }

      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '바꾸는 중…';
      db.auth.changePassword({ current: now, next: a }).then(function () {
        ok.textContent = '비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.';
        ok.hidden = false;
        q('acPwNow').value = '';
        q('acPwNew').value = '';
        q('acPwNew2').value = '';
        q('acPwMatch').textContent = '';
      }).catch(function (ex) {
        err.innerHTML = ex.message;
        err.hidden = false;
      }).then(function () {
        btn.disabled = false;
        btn.textContent = '비밀번호 바꾸기';
      });
    });
  }

  var PROVIDER_LABEL = {
    password: '이메일 · 비밀번호',
    'google.com': 'Google 계정',
  };

  function fill() {
    var u = db.auth.current();
    if (!u) return;
    var q = function (id) { return modal.querySelector('#' + id); };

    q('acWho').innerHTML =
      '<strong>' + esc(u.name || '이름 미등록') + '</strong>' +
      '<span>' + esc(db.roleLabel(u.role)) + '</span>';
    q('acName').value = u.name || '';
    q('acBirth').value = u.birthDate || '';
    q('acChurch').value = u.church || '';
    db.setRoleValue(q('acRole'), q('acRoleOther'), u.contactRole);
    q('acPhone').value = u.phone || '';
    q('acEmail').textContent = u.email || '-';

    var list = (db.auth.providers && db.auth.providers()) || [];
    q('acProvider').textContent = list.length
      ? list.map(function (p) { return PROVIDER_LABEL[p] || p; }).join(' · ')
      : '이메일 · 비밀번호';

    var hasPw = !list.length || list.indexOf('password') > -1;
    q('acPwForm').hidden = !hasPw;
    q('acGoogleNote').hidden = hasPw;
  }

  function open() {
    if (!db.auth.current()) {
      if (window.CAPSAuthUI) window.CAPSAuthUI.open({ tab: 'login', reason: '내 정보를 보려면 로그인이 필요합니다.' });
      return;
    }
    build();
    fill();
    ['acErr', 'acOk', 'acPwErr', 'acPwOk'].forEach(function (id) {
      modal.querySelector('#' + id).hidden = true;
    });
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () { modal.querySelector('#acName').focus(); }, 30);
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  return { open: open, close: close };
})();
