/* =========================================================
   찾아보기

   사이트에 페이지가 늘면서 "그 기능이 어디 있더라" 가 됩니다.
   메뉴를 다 뒤지지 않고 한 칸에 적어 찾도록 만든 것입니다.

   두 가지를 함께 찾습니다.
     1) 사이트의 기능 — 페이지 · 지원 항목 · 게시판 · 자주 묻는 질문
        (build.js 가 미리 만들어 둔 목록을 씁니다)
     2) 게시판에 지금 올라와 있는 글 — 매물 · 물건 · 방 · 집회 · 공고
        (수시로 바뀌므로 찾을 때 그 자리에서 읽어 옵니다)

   초성으로도 찾습니다.
     한글은 타자를 다 치기 전에 'ㅎㅍㅇㅈ' 까지만 쳐도 무엇을 찾는지
     대개 정해집니다. 그래서 제목의 초성을 함께 견줍니다.
   ========================================================= */
(function () {
  'use strict';

  var box = document.getElementById('siteSearch');
  if (!box) return;

  var input = document.getElementById('ssInput');
  var out = document.getElementById('ssResults');
  var openers = document.querySelectorAll('[data-search-open]');
  var BASE = box.getAttribute('data-base') || '';
  var INDEX = window.CAPS_SEARCH || [];

  /* ---------- 초성 ---------- */

  var CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  function chosung(text) {
    var outStr = '';
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0xac00 && c <= 0xd7a3) outStr += CHO[Math.floor((c - 0xac00) / 588)];
      else outStr += text[i];
    }
    return outStr;
  }

  /** 친 글자가 초성만으로 이루어져 있을 때만 초성으로 견줍니다. */
  function isChosungOnly(q) {
    for (var i = 0; i < q.length; i++) {
      if (q[i] === ' ') continue;
      if (CHO.indexOf(q[i]) === -1) return false;
    }
    return q.replace(/\s/g, '').length > 0;
  }

  /* ---------- 점수 ---------- */

  /**
   * 띄어쓰기는 견주기 전에 없앱니다.
   *
   *   "교역자구인" 으로 치셔도 [교역자 구인] 이 나와야 합니다.
   *   어디를 띄어 쓰는지는 사람마다 다르고, 틀렸다고 못 찾게 하면
   *   찾는 사람만 손해입니다.
   */
  function squash(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');
  }

  function scoreOne(q, title, body, cat) {
    var qs = squash(q);
    if (!qs) return 0;

    var t = squash(title);
    var b = squash(body);

    if (t === qs) return 1000;
    if (t.indexOf(qs) === 0) return 800;
    if (t.indexOf(qs) > -1) return 600;

    // 초성으로 친 경우 — 제목에만 견줍니다 (본문까지 보면 아무거나 걸립니다)
    if (isChosungOnly(qs)) {
      var ct = chosung(t);
      if (ct.indexOf(qs) === 0) return 500;
      if (ct.indexOf(qs) > -1) return 380;
      return 0;
    }

    if (b.indexOf(qs) > -1) return cat === '질문' ? 300 : 240;

    // 띄어 친 낱말이 모두 어딘가에 있으면 (예: "음향 견적")
    var words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      var all = t + b;
      for (var i = 0; i < words.length; i++) {
        if (all.indexOf(words[i]) === -1) return 0;
      }
      return 200;
    }
    return 0;
  }

  function searchIndex(q) {
    var hits = [];
    for (var i = 0; i < INDEX.length; i++) {
      var r = INDEX[i];
      var s = scoreOne(q, r.title, (r.desc || '') + ' ' + (r.kw || ''), r.cat);
      if (!s) continue;
      // 지원 항목과 페이지를 질문보다 위에 둡니다 — 대개 기능을 찾아 오십니다.
      if (r.cat === '자주 찾는 것') s += 90;
      else if (r.cat === '지원 항목' || r.cat === '게시판') s += 60;
      else if (r.cat === '페이지' || r.cat === '갈래') s += 40;
      hits.push({ row: r, score: s });
    }
    return hits.sort(function (a, b) {
      return b.score - a.score || a.row.title.length - b.row.title.length;
    }).slice(0, 12).map(function (x) { return x.row; });
  }

  /* ---------- 게시판에 올라온 글 ---------- */

  var db = window.CAPSDB;
  var postCache = null;
  var postLoading = null;

  function loadPosts() {
    if (postCache) return Promise.resolve(postCache);
    if (postLoading) return postLoading;
    if (!db) return Promise.resolve([]);

    var jobs = [
      ['listings.html', '부동산 매물', db.publishedListings],
      ['market.html', '중고 장터', db.publishedMarketItems],
      ['guesthouse.html', '게스트하우스', db.publishedGuestHouses],
      ['tickets.html', '집회', db.publishedEvents],
      ['jobs.html', '교역자 구인', db.publishedJobPosts],
    ].map(function (j) {
      if (typeof j[2] !== 'function') return Promise.resolve([]);
      return j[2].call(db).then(function (list) {
        return (list || []).map(function (r) {
          return {
            url: j[0] + '#view/' + r.id,
            title: r.title || r.name || '(제목 없음)',
            desc: [r.churchName, r.region, r.addressRough].filter(Boolean).join(' · '),
            cat: j[1],
            kw: [r.desc, r.department, r.denomination, r.place, r.host].filter(Boolean).join(' '),
            post: true,
          };
        });
      }).catch(function () { return []; });
    });

    postLoading = Promise.all(jobs).then(function (all) {
      postCache = all.reduce(function (a, b) { return a.concat(b); }, []);
      postLoading = null;
      return postCache;
    });
    return postLoading;
  }

  function searchPosts(q, list) {
    var hits = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var s = scoreOne(q, r.title, (r.desc || '') + ' ' + (r.kw || ''), r.cat);
      if (s) hits.push({ row: r, score: s });
    }
    return hits.sort(function (a, b) { return b.score - a.score; })
      .slice(0, 8).map(function (x) { return x.row; });
  }

  /* ---------- 그리기 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * 찾으신 글자에 표시를 합니다 — 왜 걸렸는지 보이도록.
   *
   * 견주기는 띄어쓰기를 없애고 하므로, 표시할 자리를 찾으려면
   * 없앤 글자의 위치를 원래 글의 위치로 되돌려야 합니다.
   * (예: "교역자구인" 으로 치셔도 [교역자 구인] 의 다섯 글자에
   *  표시가 걸리도록)
   */
  function mark(text, q) {
    var raw = String(text == null ? '' : text);
    var qs = squash(q);
    if (!qs) return esc(raw);

    var flat = '';
    var at = [];                       // 없앤 글의 자리 → 원래 글의 자리
    for (var i = 0; i < raw.length; i++) {
      if (/\s/.test(raw[i])) continue;
      flat += raw[i].toLowerCase();
      at.push(i);
    }

    var hit = flat.indexOf(qs);
    if (hit === -1) return esc(raw);

    var from = at[hit];
    var to = at[hit + qs.length - 1] + 1;
    return esc(raw.slice(0, from)) + '<mark>' + esc(raw.slice(from, to)) + '</mark>'
      + esc(raw.slice(to));
  }

  function trim(s, n) {
    var t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  function item(r, q, i) {
    return '<a class="ss-hit" href="' + esc(BASE + r.url) + '" data-i="' + i + '">' +
      '<span class="ss-hit-cat">' + esc(r.cat) + '</span>' +
      '<span class="ss-hit-body">' +
        '<strong>' + mark(r.title, q) + '</strong>' +
        (r.desc ? '<small>' + mark(trim(r.desc, 90), q) + '</small>' : '') +
      '</span>' +
      '</a>';
  }

  /* 최근에 찾으신 말 — 로그인하신 분만 남습니다.
     로그인하지 않은 분은 남길 자리(계정)가 없어 비어 있습니다. */
  var recent = [];

  function loadRecent() {
    if (!db || !db.recentSearches) { recent = []; return Promise.resolve(); }
    return db.recentSearches(8).then(function (list) {
      recent = list || [];
    }).catch(function () { recent = []; });
  }

  /* 아무것도 못 찾았을 때와 처음 열었을 때 함께 씁니다 */
  var QUICK = ['음향', '홈페이지', '비용이 얼마', '사택', '교역자 구인', '중고'];

  var lastQ = '';

  function render(q, rows, posts, loading) {
    if (!q) {
      out.innerHTML =
        (recent.length
          ? '<div class="ss-recent">' +
            '<p class="ss-group">최근에 찾으신 것' +
              '<button type="button" class="ss-wipe" data-wipe>지우기</button></p>' +
            '<div class="ss-quick">' + recent.map(function (t) {
              return '<button type="button" class="ss-chip is-recent" data-q="' + esc(t) + '">'
                + esc(t) + '</button>';
            }).join('') + '</div></div>'
          : '') +
        '<p class="ss-hint">무엇을 찾으시나요? <b>음향</b>, <b>홈페이지 얼마</b>, ' +
        '<b>사택</b> 처럼 적어 보세요. 띄어쓰기는 맞지 않아도 되고, ' +
        '초성(<b>ㅎㅍㅇㅈ</b>)으로도 찾습니다.</p>' +
        '<div class="ss-quick">' +
        QUICK.map(function (t) {
          return '<button type="button" class="ss-chip" data-q="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') +
        '</div>';
      return;
    }

    var html = '';
    if (rows.length) {
      html += '<p class="ss-group">사이트 안에서</p>' +
        rows.map(function (r, i) { return item(r, q, i); }).join('');
    }
    if (posts && posts.length) {
      html += '<p class="ss-group">게시판에 올라온 글</p>' +
        posts.map(function (r, i) { return item(r, q, rows.length + i); }).join('');
    }
    if (loading) html += '<p class="ss-loading">게시판을 찾아보는 중입니다…</p>';

    // 못 찾았을 때 문의로 떠밀지 않습니다 — 찾던 것을 못 찾은 분께
    // 전화를 걸라고 하는 것은 답이 아닙니다. 다른 말로 다시 찾아보시게
    // 자주 찾는 것들만 다시 내어 놓습니다.
    if (!html) {
      html = '<div class="ss-none">' +
        '<p><strong>&ldquo;' + esc(q) + '&rdquo;</strong> 으로는 찾지 못했습니다.</p>' +
        '<p class="ss-none-lead">다른 낱말로 적어 보세요. 띄어쓰기는 맞지 않아도 됩니다.</p>' +
        '</div>' +
        '<div class="ss-quick">' + QUICK.map(function (t) {
          return '<button type="button" class="ss-chip" data-q="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div>';
    }
    out.innerHTML = html;
  }

  function run() {
    var q = input.value.trim().toLowerCase();
    lastQ = q;
    if (!q) { render('', [], []); return; }

    var rows = searchIndex(q);
    // 두 글자부터 게시판까지 찾습니다 (한 글자면 거의 다 걸립니다).
    if (q.length < 2) { render(q, rows, []); return; }

    if (postCache) { render(q, rows, searchPosts(q, postCache)); return; }
    render(q, rows, [], true);
    loadPosts().then(function (list) {
      if (lastQ !== q) return;   // 그 사이 더 치셨으면 버립니다
      render(q, rows, searchPosts(q, list));
    });
  }

  /* ---------- 열고 닫기 ---------- */

  var lastFocus = null;

  function open(seed) {
    lastFocus = document.activeElement;
    box.hidden = false;
    document.body.classList.add('is-search-open');
    input.value = seed || '';
    run();
    window.setTimeout(function () { input.focus(); }, 20);

    // 최근 목록은 늦게 와도 됩니다 — 오면 그때 다시 그립니다.
    loadRecent().then(function () {
      if (!box.hidden && !input.value.trim()) render('', [], []);
    });
  }

  function close() {
    box.hidden = true;
    document.body.classList.remove('is-search-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  Array.prototype.forEach.call(openers, function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); open(''); });
  });

  box.addEventListener('click', function (e) {
    if (e.target === box || e.target.closest('[data-search-close]')) { close(); return; }

    var wipe = e.target.closest('[data-wipe]');
    if (wipe) {
      e.preventDefault();
      if (!window.confirm('최근에 찾으신 말을 모두 지울까요?')) return;
      wipe.disabled = true;
      db.clearSearches().then(function () {
        recent = [];
        render('', [], []);
      }).catch(function () { wipe.disabled = false; });
      return;
    }

    var chip = e.target.closest('[data-q]');
    if (chip) { input.value = chip.getAttribute('data-q'); run(); input.focus(); return; }

    /* 결과를 눌러 들어가신 말만 남깁니다.
       글자를 칠 때마다 남기면 "교", "교역", "교역자" 가 다 쌓여
       목록이 쓸모없어집니다. */
    if (e.target.closest('.ss-hit')) remember();
  });

  function remember() {
    var q = input.value.trim();
    if (!q || !db || !db.logSearch) return;
    db.logSearch(q);
    // 다음에 열 때 바로 보이도록 손에 든 목록도 맞춰 둡니다.
    recent = [q].concat(recent.filter(function (t) { return t !== q; })).slice(0, 8);
  }

  input.addEventListener('input', run);

  /* 위아래 화살표로 고르고 엔터로 엽니다 — 손이 자판을 떠나지 않도록. */
  var cursor = -1;

  function hits() { return out.querySelectorAll('.ss-hit'); }

  function move(step) {
    var list = hits();
    if (!list.length) return;
    if (cursor > -1 && list[cursor]) list[cursor].classList.remove('is-on');
    cursor = (cursor + step + list.length) % list.length;
    list[cursor].classList.add('is-on');
    list[cursor].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', function () { cursor = -1; });

  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Enter') {
      var list = hits();
      var go = cursor > -1 ? list[cursor] : list[0];
      if (go) {
        e.preventDefault();
        remember();
        window.location.href = go.getAttribute('href');
        close();
      }
    }
  });

  /* 어디서든 '/' 나 Ctrl+K 로 엽니다. 글을 쓰는 중일 때는 빼고요. */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault(); box.hidden ? open('') : close(); return;
    }
    if (e.key === '/' && !typing && box.hidden) { e.preventDefault(); open(''); }
  });

  /* 로그인하거나 로그아웃하시면 최근 목록도 달라집니다 */
  if (db && db.auth && db.auth.onChange) {
    db.auth.onChange(function () {
      loadRecent().then(function () {
        if (!box.hidden && !input.value.trim()) render('', [], []);
      });
    });
  }

  /* ---------- 닻(#앵커)으로 건너뛰기 ----------

     머리가 두 줄이라, 브라우저가 알아서 맞춰 주는 자리로는
     제목이 머리 밑에 숨습니다. CSS 의 scroll-padding 은 글꼴과
     그림이 늦게 실릴 때 어긋나기도 해서, 여기서 직접 잡습니다.

     자주 묻는 질문은 답이 접혀 있으므로 먼저 펴고, 펴면서 아래
     글이 밀리니 그 뒤에 자리를 잡습니다. */

  function settleAnchor() {
    var id = window.location.hash.slice(1);
    if (!id) return;

    var node;
    try { node = document.getElementById(id); } catch (ignore) { return; }
    if (!node) return;

    var d = node.closest('details');
    if (d) d.open = true;

    window.setTimeout(function () {
      var head = document.querySelector('.site-header');
      var gap = (head ? head.getBoundingClientRect().height : 0) + 20;
      var y = node.getBoundingClientRect().top + window.pageYOffset - gap;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 60);
  }

  window.addEventListener('hashchange', settleAnchor);
  settleAnchor();
  // 글꼴과 그림이 늦게 실리면 자리가 밀립니다 — 다 실린 뒤 한 번 더.
  window.addEventListener('load', settleAnchor);
}());
