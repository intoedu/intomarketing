/* 직원 전용 포털 (staff.html)
 *
 * 공개 홈페이지와 분리된 로그인 · 계정 신청 화면입니다.
 * 로그인 결과에 따라 다음처럼 갈라집니다.
 *   승인된 직원   → admin.html 로 이동
 *   승인 대기 직원 → 대기 안내
 *   고객 계정     → 홈페이지로 안내
 */
(function () {
  'use strict';

  var db = window.CAPSDB;

  var gate = document.getElementById('spGate');
  var stateBox = document.getElementById('spState');
  var loginForm = document.getElementById('spLoginForm');
  var signupForm = document.getElementById('spSignupForm');

  /* 신청 직후에는 자동 이동 대신 안내를 먼저 보여줍니다. */
  var justSignedUp = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var ICON = {
    wait: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>',
    no: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>',
  };

  /* ---------------- 화면 전환 ---------------- */

  function showGate(tab) {
    stateBox.hidden = true;
    gate.hidden = false;
    switchTab(tab || 'login');
  }

  function showState(kind, title, message, extra, actions) {
    gate.hidden = true;
    stateBox.hidden = false;
    stateBox.innerHTML =
      '<div class="sp-state">' +
        '<span class="sp-state-ico is-' + kind + '">' + ICON[kind] + '</span>' +
        '<h2>' + esc(title) + '</h2>' +
        '<p>' + message + '</p>' +
        (extra || '') +
        '<div class="sp-actions">' + actions + '</div>' +
      '</div>';

    var out = document.getElementById('spSignOut');
    if (out) {
      out.addEventListener('click', function () {
        db.auth.signOut().then(function () { window.location.reload(); });
      });
    }
    var acct = document.getElementById('spAccount');
    if (acct) {
      acct.addEventListener('click', function () {
        if (window.CAPSAccount) window.CAPSAccount.open();
      });
    }
    var again = document.getElementById('spRecheck');
    if (again) {
      again.addEventListener('click', function () { window.location.reload(); });
    }
  }

  function switchTab(name) {
    document.querySelectorAll('.sp-tab').forEach(function (t) {
      t.classList.toggle('is-on', t.dataset.tab === name);
    });
    document.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
    var first = document.querySelector('[data-pane="' + name + '"] input');
    if (first) first.focus();
  }

  /* ---------------- 로그인 상태에 따른 분기 ---------------- */

  function route(user) {
    var loadError = db.loadError();
    if (loadError) {
      showState('no', '연결할 수 없습니다', esc(loadError),
        '',
        '<button type="button" class="btn btn-primary" id="spRecheck">다시 시도</button>' +
        '<a class="btn btn-outline" href="index.html">홈페이지로 이동</a>');
      return;
    }

    if (!user) {
      showGate('login');
      return;
    }

    /* 교회 · 직분 · 연락처가 비어 있으면 먼저 받습니다 (구글 가입 · 예전 계정).
       저장하면 로그인 상태가 갱신되어 이 함수가 다시 불립니다. */
    if (window.CAPSProfile && db.needsProfile(user)) {
      window.CAPSProfile.ensure(user);
      return;
    }

    var who =
      '<span class="sp-who"><strong>' + esc(user.name || user.email) + '</strong><br>' +
      esc(user.email) + '</span>';

    /* 고객 계정 */
    if (user.role === 'client') {
      showState('no', '직원 계정이 아닙니다',
        '이 계정은 <strong>교회(고객) 계정</strong>입니다.<br>' +
        '센터 직원용 계정이 필요하시면 <strong>로그아웃</strong> 후 [직원 계정 신청] 탭에서 신청해 주세요.',
        who,
        '<a class="btn btn-primary" href="index.html">홈페이지로 이동</a>' +
        '<a class="btn btn-outline" href="status.html">내 신청 내역 보기</a>' +
        '<button type="button" class="btn btn-outline" id="spSignOut">로그아웃</button>');
      return;
    }

    /* 승인 대기 */
    if (!user.approved) {
      showState('wait', '승인을 기다리고 있습니다',
        (justSignedUp
          ? '계정이 만들어졌습니다.<br>'
          : '') +
        '최고관리자가 승인하면 업무 시스템에 들어오실 수 있습니다.<br>' +
        '승인 후 이 화면에서 [승인 확인]을 눌러주세요.',
        who,
        '<button type="button" class="btn btn-primary" id="spRecheck">승인 확인</button>' +
        '<button type="button" class="btn btn-outline" id="spAccount">내 정보 수정</button>' +
        '<a class="btn btn-outline" href="index.html">홈페이지로 이동</a>' +
        '<button type="button" class="btn btn-outline" id="spSignOut">로그아웃</button>');
      return;
    }

    /* 승인된 직원 → 관리자 화면 */
    showState('ok', '로그인되었습니다',
      esc(db.roleLabel(user.role)) + ' 권한으로 업무 시스템으로 이동합니다.',
      who,
      '<a class="btn btn-primary btn-lg" href="admin.html">업무 시스템 열기</a>' +
      '<a class="btn btn-outline" href="index.html">홈페이지로 이동</a>');

    if (!justSignedUp) {
      window.setTimeout(function () {
        // 사용자가 이미 다른 곳으로 이동했다면 건드리지 않습니다.
        if (!stateBox.hidden) window.location.replace('admin.html');
      }, 900);
    }
  }

  /* ---------------- 입력 검증 ---------------- */

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  /** 직원 계정 신청 필수값 검증 */
  function validateSignup(needPassword) {
    if (!val('spName')) return ['성함을 입력해 주세요.', 'spName'];
    if (!val('spChurch')) return ['교회명을 입력해 주세요.', 'spChurch'];
    if (!val('spRole')) return ['직분을 선택해 주세요.', 'spRole'];
    if (!db.roleValue(document.getElementById('spRole'), document.getElementById('spRoleOther'))) {
      return ['직분을 직접 입력해 주세요.', 'spRoleOther'];
    }
    if (!val('spPhone')) return ['연락처를 입력해 주세요.', 'spPhone'];
    if (!db.isValidPhone(val('spPhone'))) return ['연락처를 정확히 입력해 주세요.', 'spPhone'];
    if (!document.getElementById('spAgree').checked) {
      return ['개인정보 수집 · 이용에 동의해 주세요.', 'spAgree'];
    }
    if (needPassword) {
      if (!val('spSuEmail')) return ['이메일을 입력해 주세요.', 'spSuEmail'];
      if (val('spSuPw').length < 6) return ['비밀번호는 6자 이상으로 입력해 주세요.', 'spSuPw'];
      if (val('spSuPw') !== val('spSuPw2')) return ['비밀번호가 서로 다릅니다. 다시 확인해 주세요.', 'spSuPw2'];
    }
    return null;
  }

  function signupData() {
    return {
      email: val('spSuEmail'),
      password: val('spSuPw'),
      name: val('spName'),
      birthDate: val('spBirth'),
      church: val('spChurch'),
      contactRole: db.roleValue(document.getElementById('spRole'), document.getElementById('spRoleOther')),
      phone: db.formatPhone(val('spPhone')),
      staffRequest: true,
    };
  }

  function showProblem(errId, problem) {
    var err = document.getElementById(errId);
    err.textContent = problem[0];
    err.hidden = false;
    var target = document.getElementById(problem[1]);
    if (target) target.focus();
  }

  /* ---------------- 이벤트 ---------------- */

  document.querySelectorAll('.sp-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
  });

  document.addEventListener('click', function (e) {
    var pw = e.target.closest('[data-pw]');
    if (!pw) return;
    var input = document.getElementById(pw.dataset.pw);
    var showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    pw.textContent = showing ? '표시' : '숨기기';
  });

  /* 연락처는 숫자 11자리까지만 입력됩니다. */
  db.bindPhoneInput(document.getElementById('spPhone'));

  /* 직분 목록과 '기타' 직접 입력칸 */
  document.getElementById('spRole').innerHTML = db.roleOptionsHtml();
  db.bindRoleSelect(document.getElementById('spRole'), document.getElementById('spRoleOther'));

  /* 비밀번호 확인 실시간 표시 */
  (function () {
    var pw = document.getElementById('spSuPw');
    var pw2 = document.getElementById('spSuPw2');
    var match = document.getElementById('spPwMatch');
    var check = function () {
      if (!pw2.value) { match.textContent = ''; match.className = 'field-hint'; return; }
      var same = pw.value === pw2.value;
      match.textContent = same ? '비밀번호가 일치합니다.' : '비밀번호가 서로 다릅니다.';
      match.className = 'field-hint ' + (same ? 'is-match' : 'is-mismatch');
    };
    pw.addEventListener('input', check);
    pw2.addEventListener('input', check);
  })();

  /* 로그인 */
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = document.getElementById('spLoginErr');
    err.hidden = true;
    var btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '로그인 중…';

    db.auth.signIn({
      email: document.getElementById('spEmail').value,
      password: document.getElementById('spPw').value,
    }).catch(function (ex) {
      err.innerHTML = ex.message;
      err.hidden = false;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = '로그인';
    });
  });

  /* 구글 로그인 · 가입
     이 페이지에서 처음 쓰는 구글 계정은 '직원 신청'(승인 대기)으로 만들어집니다.
     이미 있는 계정은 기존 직분이 그대로 유지됩니다. */
  function googleAuth(errId, fromSignup) {
    var err = document.getElementById(errId);
    err.hidden = true;

    // 신청 탭의 칸은 비워두어도 됩니다.
    // 비어 있으면 구글 인증 뒤 [추가 정보 입력] 화면에서 받습니다.
    if (fromSignup) justSignedUp = true;

    db.auth.signInGoogle(fromSignup ? signupData() : { staffRequest: true })
      .catch(function (ex) {
        justSignedUp = false;
        err.innerHTML = ex.message;
        err.hidden = false;
      });
  }

  document.getElementById('spGoogle').addEventListener('click', function () {
    googleAuth('spLoginErr', false);
  });
  document.getElementById('spGoogleSignup').addEventListener('click', function () {
    document.getElementById('spSignupErr').hidden = true;
    googleAuth('spSignupGoogleErr', true);
  });

  /* 비밀번호 재설정 */
  document.getElementById('spReset').addEventListener('click', function () {
    var err = document.getElementById('spLoginErr');
    var email = document.getElementById('spEmail').value.trim();
    if (!email) {
      err.textContent = '이메일을 먼저 입력해 주세요.';
      err.hidden = false;
      return;
    }
    db.auth.resetPassword(email).then(function () {
      err.hidden = true;
      window.alert(email + ' 로 비밀번호 재설정 메일을 보냈습니다.');
    }).catch(function (ex) {
      err.innerHTML = ex.message;
      err.hidden = false;
    });
  });

  /* 직원 계정 신청 */
  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = document.getElementById('spSignupErr');
    err.hidden = true;
    document.getElementById('spSignupGoogleErr').hidden = true;

    var problem = validateSignup(true);
    if (problem) { showProblem('spSignupErr', problem); return; }

    var btn = signupForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '신청 중…';
    justSignedUp = true;

    // 이 페이지의 가입은 항상 직원 신청입니다 (signupData 가 staffRequest 를 붙입니다).
    db.auth.signUp(signupData()).catch(function (ex) {
      justSignedUp = false;
      err.innerHTML = ex.message;
      err.hidden = false;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = '계정 신청하기';
    });
  });

  /* 로그인 상태 변화에 따라 화면 결정 */
  db.auth.onChange(route);
})();
