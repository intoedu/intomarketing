/* 공개 페이지 로그인 / 회원가입 모달 + 헤더 로그인 상태 표시
 *
 * 페이지 내용은 로그인 없이 볼 수 있습니다.
 * 신청서 제출처럼 계정이 필요한 동작에서만 이 모달이 열립니다.
 *   window.CAPSAuthUI.require().then(function (user) { ... })
 */
window.CAPSAuthUI = (function () {
  'use strict';

  var db = window.CAPSDB;
  var modal = null;
  var pendingResolve = null;
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 구글 로고 (공식 4색) */
  function googleMark() {
    return '<svg class="g-mark" viewBox="0 0 18 18" aria-hidden="true">' +
      '<path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>' +
      '<path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A8.99 8.99 0 0 0 9 18Z"/>' +
      '<path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"/>' +
      '<path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"/>' +
      '</svg>';
  }

  function base() {
    // services/ 하위 페이지에서도 링크가 맞도록 경로 접두사를 계산합니다.
    return /\/services\//.test(window.location.pathname) ? '../' : '';
  }

  /* ---------------- 모달 만들기 ---------------- */

  function build() {
    if (modal) return modal;

    var demoHint = db.mode === 'local'
      ? '<p class="auth-demo">지금은 <strong>데모 모드</strong>입니다 (Firebase 미연결). ' +
        '둘러보기용 관리자 계정: <code>admin@caps.or.kr</code> / <code>caps1234</code></p>'
      : '';

    var el = document.createElement('div');
    el.className = 'auth-modal';
    el.id = 'authModal';
    el.hidden = true;
    el.innerHTML =
      '<div class="auth-backdrop" data-close></div>' +
      '<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="authTabLogin">' +
        '<div class="auth-tabs">' +
          '<button type="button" class="auth-tab is-on" id="authTabLogin" data-tab="login">로그인</button>' +
          '<button type="button" class="auth-tab" id="authTabSignup" data-tab="signup">회원가입</button>' +
          '<button type="button" class="auth-close" data-close aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="auth-body">' +
          demoHint +
          '<p class="auth-note" id="authReason" hidden></p>' +

          /* 로그인 */
          '<form class="auth-form" id="loginForm" data-pane="login" novalidate>' +
            '<div class="field"><label for="loginEmail">이메일</label>' +
              '<input type="email" id="loginEmail" autocomplete="email" required placeholder="church@example.com"></div>' +
            '<div class="field"><label for="loginPw">비밀번호</label>' +
              '<div class="pw-row"><input type="password" id="loginPw" autocomplete="current-password" required>' +
              '<button type="button" class="pw-toggle" data-pw="loginPw">표시</button></div></div>' +
            '<p class="auth-err" id="loginErr" hidden></p>' +
            '<button type="submit" class="btn btn-primary btn-block btn-lg">로그인</button>' +
            '<p class="auth-or"><span>또는</span></p>' +
            '<button type="button" class="btn btn-outline btn-block auth-google" id="googleBtn">' +
              googleMark() + 'Google 계정으로 로그인</button>' +
            '<button type="button" class="link-btn auth-reset" id="resetBtn">비밀번호를 잊으셨나요?</button>' +
            '<p class="auth-staff-link">우리교회지원센터 직원이신가요? ' +
              '<a href="' + base() + 'staff.html">직원 로그인 &rarr;</a></p>' +
          '</form>' +

          /* 회원가입 */
          '<form class="auth-form" id="signupForm" data-pane="signup" hidden novalidate>' +
            /* 구글 가입을 가장 위에 둡니다 — 가장 빠른 방법이기 때문입니다. */
            '<button type="button" class="btn btn-outline btn-block btn-lg auth-google is-first" id="googleSignupBtn">' +
              googleMark() + 'Google 계정으로 가입하기</button>' +
            '<p class="auth-google-note">비밀번호를 따로 만들지 않아도 됩니다. ' +
              '교회명 · 직분 · 연락처는 다음 화면에서 입력합니다.</p>' +
            '<p class="auth-err" id="signupGoogleErr" hidden></p>' +
            '<p class="auth-or"><span>또는 이메일로 가입</span></p>' +

            '<div class="field"><label for="suName">성함 <em class="req">필수</em></label>' +
              '<input type="text" id="suName" autocomplete="name" required></div>' +
            '<div class="field"><label for="suBirth">생년월일 <span class="opt">선택</span></label>' +
              '<input type="date" id="suBirth" autocomplete="bday"></div>' +
            '<div class="field"><label for="suChurch">교회명 <em class="req">필수</em></label>' +
              '<input type="text" id="suChurch" autocomplete="organization" required></div>' +
            '<div class="field"><label for="suRole">직분 <em class="req">필수</em></label>' +
              '<select id="suRole" required>' + db.roleOptionsHtml() + '</select></div>' +
            '<div class="field" id="suRoleOtherBox" hidden><label for="suRoleOther">직분 직접 입력 <em class="req">필수</em></label>' +
              '<input type="text" id="suRoleOther"></div>' +
            '<div class="field"><label for="suPhone">연락처 <em class="req">필수</em></label>' +
              '<input type="tel" id="suPhone" autocomplete="tel" required placeholder="01000000000">' +
              '<p class="field-hint">숫자 11자리까지 입력됩니다. 하이픈은 자동으로 들어갑니다.</p></div>' +
            '<div class="field"><label for="suEmail">이메일 <em class="req">필수</em></label>' +
              '<input type="email" id="suEmail" autocomplete="email" required placeholder="church@example.com"></div>' +
            '<div class="field"><label for="suPw">비밀번호 <em class="req">필수</em></label>' +
              '<div class="pw-row"><input type="password" id="suPw" autocomplete="new-password" required minlength="6" placeholder="6자 이상">' +
              '<button type="button" class="pw-toggle" data-pw="suPw">표시</button></div></div>' +
            '<div class="field"><label for="suPw2">비밀번호 확인 <em class="req">필수</em></label>' +
              '<div class="pw-row"><input type="password" id="suPw2" autocomplete="new-password" required minlength="6">' +
              '<button type="button" class="pw-toggle" data-pw="suPw2">표시</button></div>' +
              '<p class="field-hint" id="suPwMatch"></p></div>' +
            '<label class="check-line"><input type="checkbox" id="suAgree" required>' +
              '<span>개인정보 수집 · 이용에 동의합니다. <em class="req">필수</em></span></label>' +
            '<p class="auth-err" id="signupErr" hidden></p>' +
            '<button type="submit" class="btn btn-primary btn-block btn-lg">가입하고 계속하기</button>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    modal = el;
    wire();
    return el;
  }

  /** 회원가입 필수값 검증. 문제가 있으면 [메시지, 대상칸id] 를 돌려줍니다. */
  function validateSignup(needPassword) {
    var v = function (id) { return (modal.querySelector('#' + id).value || '').trim(); };

    if (!v('suName')) return ['성함을 입력해 주세요.', 'suName'];
    if (!v('suChurch')) return ['교회명을 입력해 주세요.', 'suChurch'];
    if (!v('suRole')) return ['직분을 선택해 주세요.', 'suRole'];
    if (!db.roleValue(modal.querySelector('#suRole'), modal.querySelector('#suRoleOther'))) {
      return ['직분을 직접 입력해 주세요.', 'suRoleOther'];
    }
    if (!v('suPhone')) return ['연락처를 입력해 주세요.', 'suPhone'];
    if (!db.isValidPhone(v('suPhone'))) return ['연락처를 정확히 입력해 주세요.', 'suPhone'];
    if (!modal.querySelector('#suAgree').checked) return ['개인정보 수집 · 이용에 동의해 주세요.', 'suAgree'];

    if (needPassword) {
      if (!v('suEmail')) return ['이메일을 입력해 주세요.', 'suEmail'];
      if (v('suPw').length < 6) return ['비밀번호는 6자 이상으로 입력해 주세요.', 'suPw'];
      if (v('suPw') !== v('suPw2')) return ['비밀번호가 서로 다릅니다. 다시 확인해 주세요.', 'suPw2'];
    }
    return null;
  }

  function signupData() {
    var v = function (id) { return (modal.querySelector('#' + id).value || '').trim(); };
    return {
      email: v('suEmail'),
      password: v('suPw'),
      name: v('suName'),
      birthDate: v('suBirth'),
      church: v('suChurch'),
      contactRole: db.roleValue(modal.querySelector('#suRole'), modal.querySelector('#suRoleOther')),
      phone: db.formatPhone(v('suPhone')),
    };
  }

  function wire() {
    /* 연락처는 숫자 11자리까지만 입력됩니다. */
    db.bindPhoneInput(modal.querySelector('#suPhone'));

    /* 직분에서 '기타'를 고르면 직접 입력칸이 나타납니다. */
    db.bindRoleSelect(modal.querySelector('#suRole'), modal.querySelector('#suRoleOther'));

    /* 비밀번호 확인 실시간 표시 */
    var pw = modal.querySelector('#suPw');
    var pw2 = modal.querySelector('#suPw2');
    var pwMatch = modal.querySelector('#suPwMatch');
    var checkMatch = function () {
      if (!pw2.value) { pwMatch.textContent = ''; pwMatch.className = 'field-hint'; return; }
      var same = pw.value === pw2.value;
      pwMatch.textContent = same ? '비밀번호가 일치합니다.' : '비밀번호가 서로 다릅니다.';
      pwMatch.className = 'field-hint ' + (same ? 'is-match' : 'is-mismatch');
    };
    pw.addEventListener('input', checkMatch);
    pw2.addEventListener('input', checkMatch);

    var tabs = modal.querySelectorAll('.auth-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
    });

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
      var pw = e.target.closest('[data-pw]');
      if (pw) {
        var input = modal.querySelector('#' + pw.dataset.pw);
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        pw.textContent = showing ? '표시' : '숨기기';
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) close();
    });

    /* 로그인 */
    modal.querySelector('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = modal.querySelector('#loginErr');
      err.hidden = true;
      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '로그인 중…';
      db.auth
        .signIn({
          email: modal.querySelector('#loginEmail').value,
          password: modal.querySelector('#loginPw').value,
        })
        .then(function () { succeed(); })
        .catch(function (ex) {
          err.innerHTML = ex.message;
          err.hidden = false;
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = '로그인';
        });
    });

    /* 구글 로그인 */
    modal.querySelector('#googleBtn').addEventListener('click', function () {
      var err = modal.querySelector('#loginErr');
      err.hidden = true;
      db.auth.signInGoogle()
        .then(function () { succeed(); })
        .catch(function (ex) {
          err.innerHTML = ex.message;
          err.hidden = false;
        });
    });

    /* 구글 계정으로 가입 (처음이면 자동 가입, 이미 있으면 로그인)
       위 칸을 미리 채우지 않아도 됩니다. 비어 있으면 구글 인증 뒤에
       [추가 정보 입력] 화면에서 교회 · 직분 · 연락처를 받습니다. */
    modal.querySelector('#googleSignupBtn').addEventListener('click', function () {
      var err = modal.querySelector('#signupGoogleErr');
      err.hidden = true;
      modal.querySelector('#signupErr').hidden = true;

      db.auth.signInGoogle(signupData())
        .then(function () { succeed(); })
        .catch(function (ex) {
          err.innerHTML = ex.message;
          err.hidden = false;
        });
    });

    /* 비밀번호 재설정 */
    modal.querySelector('#resetBtn').addEventListener('click', function () {
      var err = modal.querySelector('#loginErr');
      var email = modal.querySelector('#loginEmail').value.trim();
      if (!email) {
        err.textContent = '이메일을 먼저 입력해 주세요.';
        err.hidden = false;
        return;
      }
      db.auth.resetPassword(email)
        .then(function () {
          err.textContent = '';
          err.hidden = true;
          window.alert(email + ' 로 비밀번호 재설정 메일을 보냈습니다.');
        })
        .catch(function (ex) {
          err.innerHTML = ex.message;
          err.hidden = false;
        });
    });

    /* 회원가입 */
    modal.querySelector('#signupForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = modal.querySelector('#signupErr');
      err.hidden = true;
      modal.querySelector('#signupGoogleErr').hidden = true;

      var problem = validateSignup(true);
      if (problem) {
        err.textContent = problem[0];
        err.hidden = false;
        var target = modal.querySelector('#' + problem[1]);
        if (target) target.focus();
        return;
      }
      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '가입 중…';
      db.auth.signUp(signupData())
        .then(function () { succeed(); })
        .catch(function (ex) {
          err.innerHTML = ex.message;
          err.hidden = false;
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = '가입하고 계속하기';
        });
    });
  }

  function switchTab(name) {
    modal.querySelectorAll('.auth-tab').forEach(function (t) {
      t.classList.toggle('is-on', t.dataset.tab === name);
    });
    modal.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
    var focusTarget = modal.querySelector('[data-pane="' + name + '"] input');
    if (focusTarget) focusTarget.focus();
  }

  function open(opts) {
    var o = opts || {};
    build();
    var reason = modal.querySelector('#authReason');
    if (o.reason) {
      reason.textContent = o.reason;
      reason.hidden = false;
    } else {
      reason.hidden = true;
    }
    switchTab(o.tab || 'login');
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (pendingResolve) {
      var reject = pendingResolve.reject;
      pendingResolve = null;
      reject(new Error('cancelled'));
    }
  }

  /**
   * 교회명 · 직분 · 연락처가 비어 있으면 [추가 정보 입력] 화면을 거칩니다.
   * 저장을 마치면 원래 하려던 동작으로 이어집니다.
   */
  function profileGate(user) {
    if (!user) return Promise.reject(new Error('cancelled'));
    if (!window.CAPSProfile) return Promise.resolve(user);
    return window.CAPSProfile.ensure(user).then(function (u) {
      if (!u) throw new Error('cancelled');
      return u;
    });
  }

  function succeed() {
    var user = db.auth.current();
    modal.hidden = true;
    // 추가 정보 화면이 이어서 열리는 경우에는 스크롤 잠금을 그대로 둡니다.
    if (!(window.CAPSProfile && window.CAPSProfile.isOpen())) {
      document.body.style.overflow = '';
    }

    var waiting = pendingResolve;
    pendingResolve = null;
    var gate = profileGate(user);
    if (!waiting) {
      gate.catch(function () { /* 무시 */ });
      return;
    }
    gate.then(waiting.resolve, waiting.reject);
  }

  /** 로그인이 필요한 동작에서 사용. 이미 로그인 상태면 바로 통과합니다. */
  function require(reason) {
    var user = db.auth.current();
    if (user) return profileGate(user);
    return new Promise(function (resolve, reject) {
      pendingResolve = { resolve: resolve, reject: reject };
      open({ reason: reason || '이어서 진행하려면 로그인이 필요합니다.' });
    });
  }

  /* ---------------- 헤더 상태 표시 ---------------- */

  function renderHeader(user) {
    var slot = document.getElementById('authSlot');
    if (!slot) return;

    if (!user) {
      slot.innerHTML = '<button type="button" class="nav-link auth-open">로그인</button>';
      slot.querySelector('.auth-open').addEventListener('click', function () { open({ tab: 'login' }); });
      return;
    }

    var adminLink = db.isStaff()
      ? '<a class="user-menu-item" href="' + base() + 'admin.html">관리자 화면</a>'
      : '';
    var pending = user.role === 'staff' && !user.approved
      ? '<span class="user-menu-note">직원 승인 대기 중</span>'
      : '';

    slot.innerHTML =
      '<div class="user-box">' +
        '<button type="button" class="user-btn" id="userBtn" aria-expanded="false">' +
          '<span class="user-avatar">' + esc((user.name || user.email || '?').slice(0, 1)) + '</span>' +
          '<span class="user-name">' + esc(user.name || user.email) + '</span>' +
        '</button>' +
        '<div class="user-menu" id="userMenu" hidden>' +
          '<p class="user-menu-head"><strong>' + esc(user.name || '이름 미등록') + '</strong>' +
            '<small>' + esc(user.email) + '</small>' +
            '<em>' + esc(db.roleLabel(user.role)) + '</em>' + pending +
          '</p>' +
          '<button type="button" class="user-menu-item" id="acctOpen">내 정보 수정</button>' +
          '<a class="user-menu-item" href="' + base() + 'status.html">내 신청 내역</a>' +
          adminLink +
          '<button type="button" class="user-menu-item is-danger" id="signOutBtn">로그아웃</button>' +
        '</div>' +
      '</div>';

    var btn = slot.querySelector('#userBtn');
    var menu = slot.querySelector('#userMenu');
    btn.addEventListener('click', function () {
      var open_ = menu.hidden;
      menu.hidden = !open_;
      btn.setAttribute('aria-expanded', String(open_));
    });
    document.addEventListener('click', function (e) {
      if (!slot.contains(e.target)) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    var acct = slot.querySelector('#acctOpen');
    if (acct) {
      acct.addEventListener('click', function () {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        if (window.CAPSAccount) window.CAPSAccount.open();
      });
    }
    slot.querySelector('#signOutBtn').addEventListener('click', function () {
      db.auth.signOut().then(function () { window.location.reload(); });
    });
  }

  /* 로그인할 때마다 필수 정보를 확인합니다.
     구글로 가입한 계정과 예전에 만들어진 계정도 이 지점에서 걸립니다. */
  db.auth.onChange(function (user) {
    renderHeader(user);
    if (user && window.CAPSProfile) window.CAPSProfile.ensure(user);
  });

  return { open: open, close: close, require: require };
})();
