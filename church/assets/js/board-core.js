/* =========================================================
   게시판 공통 뼈대 (window.CAPSBoard)

   중고 장터 · 게스트하우스 · 집회 티켓팅이 함께 쓰는 부분만 모았습니다.
   부동산 매물 게시판(listings.js)에서 세 번 되풀이될 뻔한 것들입니다.

     · 해시 라우팅 (#list · #view/<id> · #new · #edit/<id> · #mine)
     · 사진 올리기 · 순서 바꾸기 · 지우기
     · 예시 칩과 연락 가능 시간 조각
     · 로그인 문지기, 금액칸, 오류 문구

   갈래마다 다른 것(무엇을 묻고, 어떻게 보여 줄지)은 각 화면 파일에 둡니다.
   ========================================================= */

window.CAPSBoard = (function () {
  'use strict';

  var db = window.CAPSDB;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  function digits(v) {
    return String(v == null ? '' : v).replace(/[^\d]/g, '');
  }

  function el(id) {
    return document.getElementById(id);
  }

  /** 금액을 세 자리마다 끊어 보여 줍니다. */
  function comma(n) {
    return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 오류 · 안내 문구 한 줄 */
  function say(box, msg) {
    if (!box) return;
    box.hidden = !msg;
    box.innerHTML = msg || '';
  }

  /** 금액 입력칸 — 치는 동안 쉼표를 넣어 줍니다. */
  function bindMoney(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var raw = digits(input.value);
      input.value = raw ? comma(raw) : '';
    });
  }

  /** 날짜 · 시각을 <input type="datetime-local"> 이 읽는 모양으로 */
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** <input type="datetime-local"> 의 값을 저장용 문자열로 */
  function fromLocalInput(v) {
    if (!v) return '';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  /** 사람이 읽는 날짜 · 시각 */
  function when(iso, withTime) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    var s = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() +
      '(' + days[d.getDay()] + ')';
    if (withTime === false) return s;
    var h = d.getHours();
    var m = d.getMinutes();
    return s + ' ' + (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + '시' +
      (m ? ' ' + m + '분' : '');
  }

  /** 남은 시간을 "2일 3시간 12분 05초" 로 */
  function countdown(sec) {
    if (sec <= 0) return '';
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    if (d > 0) return d + '일 ' + h + '시간 ' + m + '분';
    if (h > 0) return h + '시간 ' + pad(m) + '분 ' + pad(s) + '초';
    return pad(m) + '분 ' + pad(s) + '초';
  }

  /* =========================================================
     예시 칩 · 연락 가능 시간 조각
     (매물 게시판과 똑같이 움직여야 해서 그대로 옮겨 왔습니다)
     ========================================================= */

  function bindChips(root) {
    var scope = root || document;

    Array.prototype.forEach.call(scope.querySelectorAll('.ls-eg:not(.is-pick)'), function (box) {
      var target = el(box.getAttribute('data-eg'));
      if (!target || box.dataset.bound) return;
      box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        var chip = e.target.closest('.ls-eg-chip');
        if (!chip) return;
        target.value = chip.textContent;
        target.focus();
        target.dispatchEvent(new Event('input'));
      });
    });

    /* 교회 일정은 대개 "언제 되고, 언제는 안 된다" 두 가지라 그대로 나눠 두었습니다.
       넣은 뒤에는 그냥 글자이므로 시간을 직접 고치실 수 있고,
       고쳐 쓰신 내용은 다음에 칩을 눌러도 지우지 않고 뒤에 덧붙입니다. */
    Array.prototype.forEach.call(scope.querySelectorAll('.ls-eg.is-pick'), function (box) {
      var target = el(box.getAttribute('data-eg'));
      if (!target || box.dataset.bound) return;
      box.dataset.bound = '1';

      var pick = { ok: [], avoid: [] };
      var composed = '';

      function compose() {
        var s = pick.ok.join(' · ');
        if (pick.avoid.length) s += (s ? ' / ' : '') + pick.avoid.join(' · ') + ' 제외';
        return s;
      }

      function paint() {
        Array.prototype.forEach.call(box.querySelectorAll('.ls-eg-chip'), function (c) {
          var list = pick[c.getAttribute('data-add')] || [];
          var on = list.indexOf(c.textContent.trim()) > -1;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }

      box.addEventListener('click', function (e) {
        var chip = e.target.closest('.ls-eg-chip');
        if (!chip) return;
        var kind = chip.getAttribute('data-add');
        var txt = chip.textContent.trim();
        var now = target.value.trim();

        if (now && now !== composed.trim()) {
          pick.ok = [];
          pick.avoid = [];
          target.value = now + ' · ' + txt + (kind === 'avoid' ? ' 제외' : '');
        } else {
          var list = pick[kind];
          var at = list.indexOf(txt);
          if (at > -1) list.splice(at, 1);
          else list.push(txt);
          target.value = compose();
        }
        composed = target.value;
        paint();
        target.focus();
        target.dispatchEvent(new Event('input'));
      });
    });
  }

  /* =========================================================
     사진

     한 장씩 차례로 올립니다 — 한꺼번에 올리면 느린 회선에서 실패가 잦습니다.
     ========================================================= */

  function photoBox(prefix, max, minHint) {
    var input = el(prefix + 'FPhotos');
    var btn = el(prefix + 'PhotoBtn');
    var grid = el(prefix + 'PhotoGrid');
    var status = el(prefix + 'PhotoStatus');
    var list = [];
    var busy = false;

    function note(msg, cls) {
      if (!status) return;
      status.className = 'ls-photo-count' + (cls ? ' ' + cls : '');
      status.innerHTML = msg || '';
    }

    function render() {
      if (!grid) return;
      grid.innerHTML = list.map(function (ph, i) {
        return '<div class="ls-shot' + (i ? '' : ' is-cover') + '">' +
          '<img src="' + esc(ph.url || '') + '" alt="사진 ' + (i + 1) + '">' +
          (i ? '' : '<span class="ls-shot-badge">대표 사진</span>') +
          '<div class="ls-shot-act">' +
            (i ? '<button type="button" data-up="' + i + '" title="앞으로">←</button>' : '') +
            (i < list.length - 1 ? '<button type="button" data-down="' + i + '" title="뒤로">→</button>' : '') +
            '<button type="button" class="is-danger" data-rm="' + i + '" title="삭제">✕</button>' +
          '</div>' +
          '</div>';
      }).join('');

      if (btn) btn.disabled = busy || list.length >= max;

      if (busy) return;
      if (!list.length) {
        note('아직 올린 사진이 없습니다 (' + minHint + '장 이상 권합니다)', 'is-wait');
      } else if (list.length >= max) {
        note('<strong>' + list.length + '장</strong> — 최대치입니다. 바꾸시려면 먼저 지워 주세요.', 'is-full');
      } else {
        note('<strong>' + list.length + '장</strong> 올렸습니다. 앞으로 ' +
          (max - list.length) + '장 더 올리실 수 있습니다.' +
          (list.length < minHint ? ' (' + minHint + '장 이상 권합니다)' : ''), 'is-ok');
      }
    }

    if (btn && input) {
      btn.addEventListener('click', function () { input.click(); });
    }

    if (input) {
      input.addEventListener('change', function () {
        var picked = Array.prototype.slice.call(input.files || []);
        input.value = '';
        if (!picked.length || busy) return;

        var room = max - list.length;
        if (room <= 0) {
          note('사진은 최대 ' + max + '장까지입니다.', 'is-bad');
          return;
        }
        var over = picked.length - room;
        var files = picked.slice(0, room);
        var failed = [];
        busy = true;

        // 한 장씩 차례로 — 한꺼번에 올리면 느린 회선에서 자주 끊깁니다.
        var step = function (i) {
          if (i >= files.length) {
            busy = false;
            render();
            if (failed.length) {
              note('<strong>' + failed.length + '장</strong>을 올리지 못했습니다: ' +
                esc(failed.join(', ')), 'is-bad');
            } else if (over > 0) {
              note('<strong>' + list.length + '장</strong> 올렸습니다. ' +
                '최대 ' + max + '장이라 ' + over + '장은 올리지 못했습니다.', 'is-full');
            }
            return;
          }
          note('사진을 올리는 중입니다… (' + (i + 1) + '/' + files.length + ')', 'is-wait');
          if (btn) btn.disabled = true;
          db.uploadPhoto(files[i]).then(function (ph) {
            list.push(ph);
            render();
            note('사진을 올리는 중입니다… (' + (i + 1) + '/' + files.length + ')', 'is-wait');
            step(i + 1);
          }).catch(function (err) {
            failed.push((files[i].name || '사진') + ' — ' + (err.message || '실패'));
            step(i + 1);
          });
        };
        step(0);
      });
    }

    if (grid) {
      grid.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b || busy) return;
        var up = b.getAttribute('data-up');
        var down = b.getAttribute('data-down');
        var rm = b.getAttribute('data-rm');
        if (up != null) {
          var i = Number(up);
          var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t;
        } else if (down != null) {
          var j = Number(down);
          var u = list[j + 1]; list[j + 1] = list[j]; list[j] = u;
        } else if (rm != null) {
          // 파일은 문서에서 뺀 뒤에 지웁니다 (실패해도 화면은 이미 정리됩니다).
          var gone = list.splice(Number(rm), 1)[0];
          if (gone) db.deletePhoto(gone);
        }
        render();
      });
    }

    render();

    return {
      get: function () { return list.slice(); },
      set: function (next) { list = (next || []).slice(); render(); },
      clear: function () { list = []; render(); },
      count: function () { return list.length; },
      busy: function () { return busy; },
    };
  }

  /* =========================================================
     사진 크게 보기 (상세 화면)
     ========================================================= */

  function gallery(photos, id) {
    var list = photos || [];
    if (!list.length) return '';
    return '<div class="ls-gal" id="' + id + '">' +
      '<div class="ls-gal-main"><img src="' + esc(list[0].url || '') + '" alt="사진 1"></div>' +
      (list.length > 1
        ? '<div class="ls-gal-strip">' + list.map(function (ph, i) {
          return '<button type="button" class="ls-gal-thumb' + (i ? '' : ' is-on') + '" data-i="' + i + '">' +
            '<img src="' + esc(ph.url || '') + '" alt="사진 ' + (i + 1) + '" loading="lazy"></button>';
        }).join('') + '</div>'
        : '') +
      '<p class="ls-gal-n"><span>1</span> / ' + list.length + '</p>' +
      '</div>';
  }

  function bindGallery(photos, id) {
    var box = el(id);
    if (!box || !photos || photos.length < 2) return;
    var main = box.querySelector('.ls-gal-main img');
    var num = box.querySelector('.ls-gal-n span');

    box.addEventListener('click', function (e) {
      var b = e.target.closest('.ls-gal-thumb');
      if (!b) return;
      var i = Number(b.getAttribute('data-i'));
      if (!photos[i]) return;
      main.src = photos[i].url || '';
      main.alt = '사진 ' + (i + 1);
      if (num) num.textContent = String(i + 1);
      Array.prototype.forEach.call(box.querySelectorAll('.ls-gal-thumb'), function (t) {
        t.classList.toggle('is-on', t === b);
      });
    });
  }

  /** 상세 화면의 한 줄 (값이 없으면 아예 안 그립니다) */
  function dl(label, value) {
    if (value == null || value === '' || value === '-') return '';
    return '<div class="ls-dl"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
  }

  /* =========================================================
     로그인 문지기
     ========================================================= */

  function gate(prefix, onReady) {
    var box = el(prefix + 'Gate');
    var form = el(prefix + 'Form');
    var btn = el(prefix + 'GateLogin');
    var me = db.auth.current();

    if (box) box.hidden = !!me;
    if (form) form.hidden = !me;

    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        if (!window.CAPSAuthUI) return;
        window.CAPSAuthUI.require().then(function (user) {
          if (!user) return;
          if (box) box.hidden = true;
          if (form) form.hidden = false;
          if (onReady) onReady(user);
        });
      });
    }
    return !!me;
  }

  /* =========================================================
     해시 라우팅

     panes: { list: '엘리먼트 아이디', view: …, new: …, mine: … }
     routes: { view: fn(id), new: fn(''), edit: fn(id), mine: fn(), list: fn() }
     ========================================================= */

  function router(panes, routes, opts) {
    var o = opts || {};
    // 옛 모양(세 번째 인자가 그냥 속성 이름)도 그대로 받습니다.
    if (typeof o === 'string') o = { bodyAttr: o };

    function show(name) {
      Object.keys(panes).forEach(function (k) {
        var node = el(panes[k]);
        if (node) node.hidden = k !== name;
      });
      // 목록이 아닐 때는 큰 머리말을 접습니다 (같은 문구를 두 번 읽지 않도록).
      document.body.setAttribute(o.bodyAttr || 'data-ls-pane', name);
      // 목록에서만 보여야 하는 덧붙임 구역들 (예: 설치 대행 안내)
      (o.listOnly || []).forEach(function (id) {
        var node = el(id);
        if (node) node.hidden = name !== 'list';
      });
      if (o.onShow) o.onShow(name);
    }

    function route() {
      var hash = (window.location.hash || '').replace(/^#/, '');
      var parts = hash.split('/');
      var name = parts[0] || 'list';
      // 화면이 없는 해시는 목록으로 되돌립니다.
      if (!panes[name] && !(name === 'edit' && panes['new'])) name = 'list';

      var pane = name === 'edit' ? 'new' : name;
      show(pane);
      var fn = routes[name] || routes[pane];
      if (fn) fn(parts[1] || '');
      window.scrollTo(0, 0);
    }

    window.addEventListener('hashchange', route);

    return {
      route: route,
      show: show,
      go: function (hash) {
        if (window.location.hash === hash) route();
        else window.location.hash = hash;
      },
      current: function () {
        return (window.location.hash || '').replace(/^#/, '').split('/');
      },
    };
  }

  /** 여러 개 고르는 네모칸 묶음 읽기 · 채우기 */
  function checks(name) {
    return {
      get: function () {
        return Array.prototype.slice
          .call(document.querySelectorAll('input[name="' + name + '"]:checked'))
          .map(function (i) { return i.value; });
      },
      set: function (values) {
        var want = values || [];
        Array.prototype.forEach.call(
          document.querySelectorAll('input[name="' + name + '"]'),
          function (i) { i.checked = want.indexOf(i.value) > -1; }
        );
      },
    };
  }

  /** 목록이 비었을 때 · 개수 표시 */
  function countText(node, n, unit) {
    if (node) node.textContent = n ? n + unit : '';
  }

  return {
    db: db,
    el: el,
    esc: esc,
    nl2br: nl2br,
    digits: digits,
    comma: comma,
    say: say,
    dl: dl,
    when: when,
    countdown: countdown,
    toLocalInput: toLocalInput,
    fromLocalInput: fromLocalInput,
    bindMoney: bindMoney,
    bindChips: bindChips,
    photoBox: photoBox,
    gallery: gallery,
    bindGallery: bindGallery,
    gate: gate,
    router: router,
    checks: checks,
    countText: countText,
  };
}());
