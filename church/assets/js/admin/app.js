/* =========================================================
   관리자 화면 셸 — 인증 게이트, 사이드바, 해시 라우터
   각 화면은 assets/js/admin/*.js 에서 CAPSAdmin.register() 로 등록합니다.
   ========================================================= */

window.CAPSAdmin = (function () {
  'use strict';

  var db = window.CAPSDB;
  var views = {};
  var order = [];
  var state = {
    requests: [], customers: [], subscriptions: [], users: [],
    invoices: [], serviceContent: [], settings: [], editConsents: [],
  };
  var stops = [];
  var currentKey = null;
  var seen = {};          /* { 화면키: [읽은 id...] } */
  var unreadWas = null;   /* 직전에 세어 둔 안 읽은 건수 — 늘어난 것만 알립니다 */
  var baseTitle = document.title;

  /* ---------------- 유틸 ---------------- */

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(id) { return document.getElementById(id); }

  function toast(message, kind) {
    var wrap = el('toastWrap');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' is-' + kind : '');
    t.textContent = message;
    wrap.appendChild(t);
    window.setTimeout(function () {
      t.style.opacity = '0';
      t.style.transition = 'opacity .25s';
      window.setTimeout(function () { t.remove(); }, 260);
    }, 2600);
  }

  function money(n) { return db.money(n); }

  /** 표 없음 상태 */
  function emptyRow(cols, title, desc) {
    return '<tr><td colspan="' + cols + '"><div class="adm-empty"><strong>' + h(title) + '</strong>' +
      (desc ? '<p>' + h(desc) + '</p>' : '') + '</div></td></tr>';
  }

  /** CSV 내려받기 (엑셀 한글 대응 BOM 포함) */
  function downloadCsv(filename, headers, rows) {
    var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var body = [headers.map(cell).join(',')]
      .concat(rows.map(function (r) { return r.map(cell).join(','); }))
      .join('\r\n');
    var blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------------- 서랍(drawer) ---------------- */

  var drawerLastFocus = null;

  function openDrawer(opts) {
    var d = el('drawer');
    el('drawerTitle').textContent = opts.title || '';
    el('drawerSub').textContent = opts.sub || '';
    el('drawerBody').innerHTML = opts.body || '';
    drawerLastFocus = document.activeElement;
    d.hidden = false;
    document.body.style.overflow = 'hidden';
    el('drawerClose').focus();
    if (opts.onMount) opts.onMount(el('drawerBody'));
  }

  function closeDrawer() {
    var d = el('drawer');
    if (d.hidden) return;
    d.hidden = true;
    document.body.style.overflow = '';
    if (drawerLastFocus && drawerLastFocus.focus) drawerLastFocus.focus();
  }

  /* ---------------- 화면 등록 ---------------- */

  function register(key, view) {
    views[key] = view;
    order.push(key);
  }

  /* ---------------- 읽음 표시 ----------------

     사이드바 숫자는 두 가지입니다.

       알림 배지 — 아직 안 본 새 건입니다. 화면을 열면 그때 목록에 있던
                   건은 읽은 것으로 남고 숫자가 사라집니다. 그 뒤에 들어온
                   건만 다시 숫자로 올라옵니다. 화면이 alerts() 로 알립니다.

       현황 숫자 — 내 작업, 미수금처럼 '지금 몇 건인가'를 보는 숫자입니다.
                   읽었다고 사라지면 안 되므로 그대로 둡니다. badge() 입니다.

     읽은 기록은 이 브라우저에 직원별로 저장합니다. 서버에 두지 않으므로
     다른 컴퓨터에서 열면 처음 보는 것으로 나옵니다.
  */

  function seenKey() {
    var me = db.auth.current();
    return 'caps.admin.seen.' + ((me && me.id) || 'anon');
  }

  function loadSeen() {
    seen = {};
    try {
      var raw = window.localStorage.getItem(seenKey());
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') seen = parsed;
    } catch (err) { seen = {}; }
  }

  function saveSeen() {
    try { window.localStorage.setItem(seenKey(), JSON.stringify(seen)); }
    catch (err) { /* 저장이 막혀 있어도 화면은 그대로 동작합니다 */ }
  }

  /** 이 화면이 알림으로 세는 건들의 id. 알림을 쓰지 않는 화면은 null 입니다. */
  function alertIds(key) {
    var v = views[key];
    if (!v || !v.alerts) return null;
    try {
      return (v.alerts(state) || []).map(String);
    } catch (err) { return null; }
  }

  function unreadCount(key) {
    var ids = alertIds(key);
    if (ids == null) return null;
    var read = seen[key] || [];
    var n = 0;
    for (var i = 0; i < ids.length; i++) {
      if (read.indexOf(ids[i]) === -1) n++;
    }
    return n;
  }

  /** key 화면에서 지금 보이는 건을 읽은 것으로 남깁니다.

      같은 건을 함께 보여 주는 화면에도 같이 남깁니다 — 항목별 화면에서
      본 신청이 [전체] 에 새 건으로 다시 뜨면 안 됩니다.

      기록은 '지금 알림 목록에 있는 id' 만 남기고 나머지는 버립니다.
      처리가 끝나 목록에서 빠진 건은 기억할 필요가 없고, 그래야 저장
      내용이 무한정 늘지 않습니다. */
  function markSeen(key) {
    var mine = alertIds(key);
    if (mine == null) return;
    var changed = false;

    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var ids = k === key ? mine : alertIds(k);
      if (ids == null) continue;

      var old = seen[k] || [];
      var read = [];
      for (var j = 0; j < ids.length; j++) {
        var id = ids[j];
        if (k === key || mine.indexOf(id) !== -1 || old.indexOf(id) !== -1) read.push(id);
      }
      if (read.length !== old.length || read.join('\u0001') !== old.join('\u0001')) {
        seen[k] = read;
        changed = true;
      }
    }
    if (changed) saveSeen();
  }

  function unreadMap() {
    var m = {};
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (views[k].perm && !db.can(views[k].perm)) continue;
      var n = unreadCount(k);
      if (n != null) m[k] = n;
    }
    return m;
  }

  /** 탭 제목과 알림을 맞춥니다.
      quiet 이면 숫자만 갱신하고 알림은 띄우지 않습니다 (방금 읽은 직후). */
  function syncAlerts(quiet) {
    var now = unreadMap();

    if (!quiet && unreadWas) {
      for (var k in now) {
        if (views[k].rollup) continue;  /* 다른 화면과 겹치는 숫자입니다 */
        var grew = now[k] - (unreadWas[k] || 0);
        if (grew > 0) toast((views[k].nav || views[k].title) + ' ' + grew + '건이 새로 들어왔습니다.', 'new');
      }
    }
    unreadWas = now;

    /* 관리자 화면을 띄워 놓고 다른 일을 하는 동안에도 알 수 있게 탭 제목에 답니다. */
    var total = 0;
    for (var key in now) {
      if (views[key].rollup) continue;
      total += now[key];
    }
    document.title = (total ? '(' + total + ') ' : '') + baseTitle;
  }

  /* ---------------- 사이드바 ---------------- */

  var ICONS = {
    rules: '<path d="M12 3 4 6.5v5.8c0 4.3 3.4 7.9 8 8.7 4.6-.8 8-4.4 8-8.7V6.5L12 3Z"/><path d="M12 8.6v3.2M12 15h.01"/>',
    mytasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
    alltasks: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16M8 13h4M8 16.5h6"/>',
    workload: '<path d="M3 20h18"/><path d="M6 20v-6M11 20V8M16 20v-9M21 20V5"/>',
    dashboard: '<path d="M3 12h6V3H3v9Zm0 9h6v-6H3v6Zm9 0h9v-9h-9v9Zm0-18v6h9V3h-9Z"/>',
    requests: '<path d="M14 3H7.4A1.4 1.4 0 0 0 6 4.4v15.2A1.4 1.4 0 0 0 7.4 21h9.2a1.4 1.4 0 0 0 1.4-1.4V7l-4-4Z"/><path d="M14 3v4h4M9.2 12.5h5.6M9.2 16h5.6"/>',
    customers: '<path d="M15.5 20v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.4V20"/><circle cx="9.2" cy="7.6" r="3.3"/><path d="M21 20v-1.6a3.6 3.6 0 0 0-2.7-3.5"/>',
    consents: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8.5 8.5h7M8.5 12h7"/><path d="m9 16.5 1.7 1.7 3.6-3.8"/>',
    listings: '<path d="M3 21h18M5 21V9.5L12 4l7 5.5V21"/><path d="M10 21v-6h4v6"/>',
    subscriptions: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/><path d="M12 8v4l3 2"/>',
    settlement: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/><path d="M6.5 14.5h4"/>',
    services: '<path d="M12 3 4 7v5.5c0 4.2 3.3 7.7 8 8.5 4.7-.8 8-4.3 8-8.5V7l-8-4Z"/><path d="m9 12 2 2 4-4"/>',
    members: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1a4.5 4.5 0 0 1 4.5-4.5h5A4.5 4.5 0 0 1 19 19v1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  };

  function icon(name) {
    return '<svg class="adm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.dashboard) + '</svg>';
  }

  var GROUPS = [
    { title: '', keys: ['dashboard'] },
    { title: '작업', keys: ['mytasks', 'alltasks', 'workload'] },
    { title: '의뢰 관리', keys: ['requests', 'customers', 'consents', 'subscriptions'] },
    /* 지원 항목마다 따로 들어옵니다. keys 를 손으로 적지 않고 앞가지로 모읍니다 —
       항목이 늘거나 줄면 site.js 만 고치면 메뉴가 따라옵니다. */
    { title: '지원 항목별', prefix: 'req-' },
    { title: '게시판', keys: ['listings', 'marketBoard', 'guestBoard', 'eventBoard', 'jobBoard'] },
    { title: '설치 대행', keys: ['installs'] },
    { title: '정산', keys: ['settlement'] },
    { title: '센터 관리', keys: ['services', 'members', 'settings', 'rules'] },
  ];

  function renderSidebar() {
    var me = db.auth.current();
    var nav = el('admNav');

    nav.innerHTML = GROUPS.map(function (g) {
      var keys = g.keys || order.filter(function (k) { return k.indexOf(g.prefix) === 0; });
      var shown = keys.filter(function (k) { return views[k] && (!views[k].perm || db.can(views[k].perm)); });

      var links = shown
        .map(function (k) {
          var v = views[k];
          var badge = '';
          var fresh = unreadCount(k);
          if (fresh) {
            /* 안 본 새 건이 있을 때만 뜹니다. 읽으면 사라집니다. */
            badge = '<span class="adm-count is-new">' + fresh + '</span>';
          } else if (v.badge) {
            var count = v.badge(state);
            if (count != null) {
              badge = '<span class="adm-count' + (count ? '' : ' is-zero') + '">' + count + '</span>';
            }
          }
          return '<button type="button" class="adm-link' + (currentKey === k ? ' is-on' : '') + '" data-view="' + k + '">' +
            icon(v.icon || k) + '<span class="adm-link-text">' + h(v.nav || v.title) + '</span>' + badge + '</button>';
        })
        .join('');
      if (!links) return '';

      /* 메뉴가 많아 한눈에 훑기 어려우므로, 새 건이 있는 묶음에 점을 답니다. */
      var groupNew = shown.filter(function (k) { return !views[k].rollup && unreadCount(k); }).length;

      return (g.title
        ? '<div class="adm-group"><p class="adm-group-title">' + h(g.title) +
          (groupNew ? '<span class="adm-group-dot" title="새로 들어온 건이 있습니다"></span>' : '') + '</p>'
        : '<div class="adm-group">') +
        links + '</div>';
    }).join('');

    el('admMe').innerHTML =
      '<strong>' + h(me.name || me.email) + '</strong>' +
      '<small>' + h(me.email) + '</small>' +
      '<span class="adm-role">' + h(db.roleLabel(me.role)) + '</span>';

    el('admMode').hidden = db.mode !== 'local';
  }

  /* ---------------- 라우팅 ---------------- */

  function firstAllowed() {
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (!views[k].perm || db.can(views[k].perm)) return k;
    }
    return null;
  }

  function go(key, replace) {
    if (!views[key] || (views[key].perm && !db.can(views[key].perm))) {
      key = firstAllowed();
      if (!key) return;
    }
    if (window.location.hash.slice(1) !== key) {
      if (replace) window.location.replace('#' + key);
      else window.location.hash = key;
      return; // hashchange 가 다시 호출합니다
    }
    render(key);
  }

  function render(key) {
    currentKey = key;
    var v = views[key];
    closeDrawer();
    /* 이 화면을 여는 순간 읽은 것으로 처리합니다 — 배지가 바로 사라집니다. */
    markSeen(key);
    syncAlerts(true);
    el('admTitle').textContent = v.title;
    el('admDesc').textContent = v.desc || '';
    el('admActions').innerHTML = '';
    el('admMobileTitle').textContent = v.title;
    var body = el('admBody');
    body.innerHTML = '';
    renderSidebar();
    try {
      v.render(body, state, { actions: el('admActions') });
    } catch (err) {
      body.innerHTML = '<div class="adm-card"><h2>화면을 표시할 수 없습니다</h2>' +
        '<p class="adm-card-lead">' + h(err.message) + '</p></div>';
    }
    el('admSide').classList.remove('is-open');
    window.scrollTo(0, 0);
  }

  function rerender() {
    if (currentKey) render(currentKey);
  }

  /* ---------------- 데이터 구독 ---------------- */

  function watchAll(done) {
    var names = ['requests', 'customers', 'subscriptions', 'users', 'invoices',
      'serviceContent', 'settings', 'editConsents', 'listings',
      'marketItems', 'installRequests', 'guestHouses', 'events', 'ticketOrders', 'jobPosts'];
    var seen = 0;
    var finished = false;

    names.forEach(function (name) {
      var stop = db.watch(name, function (rows) {
        state[name] = rows;
        seen++;
        if (!finished && seen >= names.length) {
          finished = true;
          done();
        } else if (finished) {
          // 다른 화면이 열려 있어도 사이드바 숫자는 항상 갱신
          syncAlerts(false);
          renderSidebar();
          if (currentKey && views[currentKey].live !== false) render(currentKey);
        }
      });
      stops.push(stop);
    });
  }

  /* ---------------- 인증 게이트 ---------------- */

  function showGate(kind, user) {
    el('admShell').hidden = true;
    var gate = el('admGate');
    gate.hidden = false;

    var body;
    var loadError = db.loadError();
    if (loadError) {
      body =
        '<h1>연결할 수 없습니다</h1>' +
        '<p>' + h(loadError) + '</p>' +
        '<div class="gate-actions">' +
          '<button type="button" class="btn btn-primary" id="gateReload">다시 시도</button>' +
          '<a class="btn btn-outline" href="index.html">홈페이지로 돌아가기</a>' +
        '</div>';
    } else if (kind === 'anon') {
      body =
        '<h1>로그인이 필요합니다</h1>' +
        '<p>우리교회지원센터 업무 시스템입니다.<br>직원 로그인 페이지에서 로그인해 주세요.</p>' +
        (db.mode === 'local'
          ? '<p class="auth-demo" style="margin-top:20px;text-align:left">데모 모드입니다. ' +
            '<code>admin@caps.or.kr</code> / <code>caps1234</code> 로 로그인해 보세요.</p>'
          : '') +
        '<div class="gate-actions">' +
          '<a class="btn btn-primary btn-lg" href="staff.html">직원 로그인으로 이동</a>' +
          '<a class="btn btn-outline" href="index.html">홈페이지로 돌아가기</a>' +
        '</div>';
    } else if (kind === 'pending') {
      body =
        '<h1>승인 대기 중입니다</h1>' +
        '<p><strong>' + h(user.name || user.email) + '</strong> 님의 직원 계정은<br>' +
        '최고관리자 승인 후 이용할 수 있습니다.<br>승인되면 이 화면에서 바로 들어오실 수 있습니다.</p>' +
        '<div class="gate-actions">' +
          '<button type="button" class="btn btn-primary" id="gateReload">승인 확인</button>' +
          '<button type="button" class="btn btn-outline" id="gateOut">로그아웃</button>' +
          '<a class="btn btn-primary" href="index.html">홈페이지로 돌아가기</a>' +
        '</div>';
    } else {
      body =
        '<h1>접근 권한이 없습니다</h1>' +
        '<p>이 계정(<strong>' + h(user.email) + '</strong>)은 고객 계정입니다.<br>' +
        '관리자 화면은 센터 직원만 이용할 수 있습니다.</p>' +
        '<div class="gate-actions">' +
          '<a class="btn btn-primary" href="status.html">내 신청 내역 보기</a>' +
          '<button type="button" class="btn btn-outline" id="gateOut">로그아웃</button>' +
        '</div>';
    }

    gate.innerHTML = '<div class="gate-card">' + el('gateLogo').innerHTML + body + '</div>';

    var reload = el('gateReload');
    if (reload) reload.addEventListener('click', function () { window.location.reload(); });
    var out = el('gateOut');
    if (out) {
      out.addEventListener('click', function () {
        db.auth.signOut().then(function () { window.location.reload(); });
      });
    }
  }

  function boot() {
    db.auth.onChange(function (user) {
      stops.forEach(function (s) { s(); });
      stops = [];

      if (!user) return showGate('anon', null);
      if (user.role === 'client') return showGate('client', user);
      if (!user.approved) return showGate('pending', user);

      /* 교회 · 직분 · 연락처가 비어 있으면 먼저 받습니다.
         저장하면 로그인 상태가 갱신되어 이 함수가 다시 불립니다. */
      if (window.CAPSProfile && db.needsProfile(user)) {
        el('admShell').hidden = true;
        el('admGate').hidden = true;
        window.CAPSProfile.ensure(user);
        return;
      }

      el('admGate').hidden = true;
      el('admShell').hidden = false;
      el('admBody').innerHTML = '<div class="adm-card"><p class="adm-card-lead">불러오는 중…</p></div>';

      /* 직원마다 읽은 기록이 다릅니다. 한 컴퓨터를 같이 써도 섞이지 않습니다. */
      loadSeen();
      unreadWas = null;
      document.title = baseTitle;

      watchAll(function () {
        syncAlerts(true);   /* 처음 들어올 때는 알림을 띄우지 않습니다 */
        var key = window.location.hash.slice(1) || firstAllowed();
        go(key, true);
      });
    });

    window.addEventListener('hashchange', function () {
      var key = window.location.hash.slice(1);
      if (!key) return;
      if (el('admShell').hidden) return;
      go(key);
    });

    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-view]');
      if (link) { go(link.dataset.view); return; }
      if (e.target.closest('#drawerClose') || e.target.closest('.drawer-backdrop')) closeDrawer();
      if (e.target.closest('#admBurger')) el('admSide').classList.toggle('is-open');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    el('admAccount').addEventListener('click', function () {
      if (window.CAPSAccount) window.CAPSAccount.open();
    });

    el('admSignOut').addEventListener('click', function () {
      db.auth.signOut().then(function () { window.location.reload(); });
    });
  }

  return {
    register: register,
    boot: boot,
    go: go,
    rerender: rerender,
    renderSidebar: renderSidebar,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    toast: toast,
    downloadCsv: downloadCsv,
    emptyRow: emptyRow,
    money: money,
    h: h,
    db: db,
    state: state,
  };
})();
