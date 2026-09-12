/* 추가 정보 입력 (필수) — 교회명 · 직분 · 연락처
 *
 * 구글 계정으로 가입하면 이름과 이메일만 넘어옵니다.
 * 예전에 만들어진 계정에도 이 정보가 없을 수 있습니다.
 * 그래서 로그인할 때마다 확인하고, 비어 있으면 이 화면으로 막습니다.
 *
 *   window.CAPSProfile.ensure().then(function (user) { ... })
 *     - 필수 정보가 이미 있으면 그대로 통과합니다.
 *     - 비어 있으면 화면을 띄우고, 저장한 뒤에 통과합니다.
 *     - 닫기 · Esc · 배경 클릭으로는 닫히지 않습니다. (로그아웃만 가능)
 */
window.CAPSProfile = (function () {
  'use strict';

  var db = window.CAPSDB;
  var modal = null;
  var waiting = null;   // { promise, resolve }

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
    el.className = 'auth-modal profile-modal';
    el.id = 'profileModal';
    el.hidden = true;
    el.innerHTML =
      '<div class="auth-backdrop"></div>' +
      '<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="pfTitle">' +
        '<div class="pf-head">' +
          '<h2 id="pfTitle">추가 정보를 입력해 주세요</h2>' +
          '<p>신청 내용을 확인하고 연락드리기 위해 <strong>교회명 · 직분 · 연락처</strong>가 필요합니다.<br>' +
            '한 번만 입력하면 다음부터는 묻지 않습니다.</p>' +
        '</div>' +
        '<div class="auth-body">' +
          '<p class="pf-who" id="pfWho"></p>' +
          '<form class="auth-form" id="profileForm" novalidate>' +
            '<div class="field"><label for="pfName">성함 <em class="req">필수</em></label>' +
              '<input type="text" id="pfName" autocomplete="name" required></div>' +
            '<div class="field"><label for="pfBirth">생년월일 <span class="opt">선택</span></label>' +
              '<input type="date" id="pfBirth" autocomplete="bday"></div>' +
            '<div class="field"><label for="pfChurch">교회명 <em class="req">필수</em></label>' +
              '<input type="text" id="pfChurch" autocomplete="organization" required></div>' +
            '<div class="field"><label for="pfRole">직분 <em class="req">필수</em></label>' +
              '<select id="pfRole" required>' + db.roleOptionsHtml() + '</select></div>' +
            '<div class="field" id="pfRoleOtherBox" hidden><label for="pfRoleOther">직분 직접 입력 <em class="req">필수</em></label>' +
              '<input type="text" id="pfRoleOther"></div>' +
            '<div class="field"><label for="pfPhone">연락처 <em class="req">필수</em></label>' +
              '<input type="tel" id="pfPhone" autocomplete="tel" required placeholder="01000000000">' +
              '<p class="field-hint">숫자 11자리까지 입력됩니다. 하이픈은 자동으로 들어갑니다.</p></div>' +
            '<p class="auth-err" id="pfErr" hidden></p>' +
            '<button type="submit" class="btn btn-primary btn-block btn-lg">저장하고 시작하기</button>' +
            '<p class="pf-foot">다른 계정으로 이용하시려면 ' +
              '<button type="button" class="link-btn" id="pfSignOut">로그아웃</button>하시면 됩니다.</p>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    modal = el;
    wire();
    return el;
  }

  function wire() {
    db.bindPhoneInput(modal.querySelector('#pfPhone'));

    /* 직분에서 '기타'를 고르면 직접 입력칸이 나타납니다. */
    db.bindRoleSelect(modal.querySelector('#pfRole'), modal.querySelector('#pfRoleOther'));

    modal.querySelector('#pfSignOut').addEventListener('click', function () {
      db.auth.signOut().then(function () {
        window.location.href = base() + 'index.html';
      });
    });

    modal.querySelector('#profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = modal.querySelector('#pfErr');
      err.hidden = true;

      var v = function (id) { return (modal.querySelector('#' + id).value || '').trim(); };
      var problem = null;
      var role = db.roleValue(modal.querySelector('#pfRole'), modal.querySelector('#pfRoleOther'));
      if (!v('pfName')) problem = ['성함을 입력해 주세요.', 'pfName'];
      else if (!v('pfChurch')) problem = ['교회명을 입력해 주세요.', 'pfChurch'];
      else if (!v('pfRole')) problem = ['직분을 선택해 주세요.', 'pfRole'];
      else if (!role) problem = ['직분을 직접 입력해 주세요.', 'pfRoleOther'];
      else if (!v('pfPhone')) problem = ['연락처를 입력해 주세요.', 'pfPhone'];
      else if (!db.isValidPhone(v('pfPhone'))) problem = ['연락처를 정확히 입력해 주세요.', 'pfPhone'];

      if (problem) {
        err.textContent = problem[0];
        err.hidden = false;
        var target = modal.querySelector('#' + problem[1]);
        if (target) target.focus();
        return;
      }

      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '저장 중…';

      db.auth.updateProfile({
        name: v('pfName'),
        birthDate: v('pfBirth'),
        church: v('pfChurch'),
        contactRole: role,
        phone: db.formatPhone(v('pfPhone')),
      }).then(function () {
        settle(db.auth.current());
      }).catch(function (ex) {
        err.innerHTML = ex.message;
        err.hidden = false;
      }).then(function () {
        btn.disabled = false;
        btn.textContent = '저장하고 시작하기';
      });
    });
  }

  function fill(user) {
    var set = function (id, value) { modal.querySelector('#' + id).value = value || ''; };
    set('pfName', user.name);
    set('pfBirth', user.birthDate);
    set('pfChurch', user.church);
    db.setRoleValue(modal.querySelector('#pfRole'), modal.querySelector('#pfRoleOther'), user.contactRole);
    set('pfPhone', user.phone);
    modal.querySelector('#pfWho').innerHTML =
      '<strong>' + esc(user.name || '이름 미등록') + '</strong><small>' + esc(user.email) + '</small>';
  }

  function show(user) {
    build();
    fill(user);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var first = modal.querySelector('#pfChurch');
    if (first) window.setTimeout(function () { first.focus(); }, 30);
  }

  function hide() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  /**
   * 필수 정보가 채워질 때까지 기다립니다.
   * @param {object} [user] 없으면 현재 로그인 계정
   * @returns {Promise<object|null>} 통과한 계정 (미로그인이면 null)
   */
  /** 화면을 닫고 기다리던 약속을 마칩니다. */
  function settle(user) {
    hide();
    var done = waiting;
    waiting = null;
    if (done) done.resolve(user || null);
  }

  function ensure(user) {
    var u = user || db.auth.current();
    if (!u || !db.needsProfile(u)) {
      settle(u || null);
      return Promise.resolve(u || null);
    }

    // 이미 열려 있으면 같은 약속을 그대로 돌려줍니다 (onChange 가 여러 번 불려도 안전).
    if (waiting) {
      fill(u);
      return waiting.promise;
    }

    var box = {};
    box.promise = new Promise(function (resolve) { box.resolve = resolve; });
    waiting = box;
    show(u);
    return box.promise;
  }

  /** 지금 추가 정보 화면이 떠 있는지 */
  function isOpen() { return !!(modal && !modal.hidden); }

  return { ensure: ensure, isOpen: isOpen, close: hide };
})();
