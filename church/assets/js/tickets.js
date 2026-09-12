/* =========================================================
   집회 · 찬양집회 티켓팅 (tickets.html)

     #list         집회 목록 (기본)
     #view/<id>    집회 소개 — 포스터와 이름을 보고 들어와 읽는 곳
     #apply/<id>   신청하기 (좌석 지정 집회는 좌석도가 함께 열립니다)
     #new          집회 올리기 (#edit/<id> 로 열면 내가 올린 집회 수정)
     #mine         내가 올린 집회
     #tickets      내 신청 내역

   신청은 데이터베이스 함수 하나로 처리합니다 — 정원 확인과 자리 차지가
   같은 잠금 안에서 일어나야 오픈 직후 동시 신청에도 정원을 넘지 않습니다.
   ========================================================= */
(function () {
  'use strict';

  var B = window.CAPSBoard;
  if (!B || !document.getElementById('tkBoard')) return;

  var db = B.db;
  var esc = B.esc;
  var el = B.el;

  var BOARD = window.CAPS_TICKET_BOARD || {};
  var PHOTO_MAX = Number(BOARD.photoMax) || db.EVENT_PHOTO_MAX;
  var PHOTO_MIN = Number(BOARD.photoMin) || 1;

  var rows = [];
  var mineRows = [];
  var loaded = false;

  var photos = B.photoBox('tk', PHOTO_MAX, PHOTO_MIN);

  /* 등록 화면에서 만드는 좌석도 (아직 저장되지 않은 것) */
  var draftSeatmap = { rows: [], note: '' };

  /* 신청 화면에서 고른 좌석 · 남은 시간을 세는 타이머 */
  var picked = [];
  var ticker = null;

  function stopTicker() {
    if (ticker) { window.clearInterval(ticker); ticker = null; }
  }

  /* =========================================================
     목록 — 포스터를 앞세웁니다
     ========================================================= */

  function card(r) {
    var v = db.eventView(r);
    var cover = v.poster ? (v.poster.url || '') : '';
    var left = v.left;

    var badge = '';
    if (v.full || v.status === 'closed') badge = '<span class="tk-badge is-full">마감</span>';
    else if (!v.opened) badge = '<span class="tk-badge is-soon">예매 예정</span>';
    else if (left != null && left <= 10) badge = '<span class="tk-badge is-few">' + left + '석 남음</span>';
    else if (v.status === 'done') badge = '<span class="tk-badge is-done">종료</span>';

    return '<a class="tk-card" href="#view/' + esc(r.id) + '">' +
      '<span class="tk-card-poster">' +
        (cover
          ? '<img src="' + esc(cover) + '" alt="" loading="lazy">'
          : '<span class="tk-card-noposter">' + esc(v.categoryLabel) + '</span>') +
        badge +
      '</span>' +
      '<span class="tk-card-body">' +
        '<span class="ls-tag ls-tag-' + esc(r.category) + '">' + esc(v.categoryLabel) + '</span>' +
        '<h3>' + esc(r.title || '(이름 없음)') + '</h3>' +
        (r.subtitle ? '<p class="tk-card-sub">' + esc(r.subtitle) + '</p>' : '') +
        '<p class="tk-card-when">' + esc(B.when(r.startsAt)) + '</p>' +
        '<p class="tk-card-where">' + esc([r.region, r.venue].filter(Boolean).join(' · ')) + '</p>' +
        '<strong class="tk-card-price">' + esc(db.eventPrice(r)) + '</strong>' +
        (v.pct != null
          ? '<span class="tk-bar"><span class="tk-bar-in" style="width:' + v.pct + '%"></span></span>' +
            '<span class="tk-bar-txt">' + v.taken + ' / ' + v.capacity + '명</span>'
          : '') +
        (!v.opened && r.openAt
          ? '<span class="tk-open">예매 시작 ' + esc(B.when(r.openAt)) + '</span>' : '') +
        '<span class="ls-card-more">집회 보기 →</span>' +
      '</span>' +
      '</a>';
  }

  function filtered() {
    var q = (el('tkQ').value || '').trim().toLowerCase();
    var cat = el('tkCategory').value;
    var region = el('tkRegion').value;
    var when = el('tkWhen').value;
    var now = Date.now();
    var monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    return rows.filter(function (r) {
      if (cat && r.category !== cat) return false;
      if (region && r.region !== region) return false;

      var starts = r.startsAt ? new Date(r.startsAt).getTime() : 0;
      if (when === 'upcoming') {
        // 신청을 받고 있거나 아직 열리지 않은 집회 (지난 집회는 뺍니다)
        if (starts && starts < now) return false;
        if (r.status === 'done') return false;
      } else if (when === 'soon') {
        if (!starts || starts < now || starts > monthEnd.getTime()) return false;
      }

      if (!q) return true;
      var hay = [r.title, r.subtitle, r.host, r.speakers, r.venue, r.region, r.desc]
        .join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderList() {
    var list = filtered().sort(function (a, b) {
      // 가까운 집회부터. 날짜가 없는 것은 뒤로 보냅니다.
      var x = a.startsAt || '9999';
      var y = b.startsAt || '9999';
      return x.localeCompare(y);
    });
    B.countText(el('tkCount'), list.length, '개');
    el('tkEmpty').hidden = !!list.length;
    el('tkList').innerHTML = list.length ? list.map(card).join('') : '';
  }

  function load() {
    return db.publishedEvents().then(function (list) {
      rows = list;
      loaded = true;
      renderList();
    });
  }

  /* =========================================================
     좌석도

     필수가 아닙니다 — 켜지 않은 집회는 인원수로만 받습니다.
     ========================================================= */

  function seatmapHtml(map, opts) {
    var o = opts || {};
    var mapRows = (map && Array.isArray(map.rows)) ? map.rows : [];
    if (!mapRows.length) return '';

    return '<div class="tk-seatmap' + (o.edit ? ' is-edit' : '') + '" id="' + (o.id || '') + '">' +
      '<p class="tk-stage">무대 · 강단</p>' +
      mapRows.map(function (row) {
        return '<div class="tk-row">' +
          '<span class="tk-row-name">' + esc(row.name) + '</span>' +
          (row.seats || []).map(function (s) {
            var cls = 'tk-seat';
            var dis = '';
            if (s.off) { cls += ' is-off'; }
            else if (o.taken && o.taken[s.id]) { cls += ' is-taken'; dis = ' disabled'; }
            else if (o.picked && o.picked.indexOf(s.id) > -1) { cls += ' is-picked'; }
            if (!o.edit && s.off) dis = ' disabled';
            return '<button type="button" class="' + cls + '" data-seat="' + esc(s.id) + '"' + dis +
              ' title="' + esc(s.id) + '">' + esc(s.no) + '</button>';
          }).join('') +
          '</div>';
      }).join('') +
      (map.note ? '<p class="tk-seat-note">' + esc(map.note) + '</p>' : '') +
      '<p class="tk-seat-legend">' +
        '<span class="tk-key"><i class="is-free"></i> 빈자리</span>' +
        '<span class="tk-key"><i class="is-picked"></i> 고른 자리</span>' +
        '<span class="tk-key"><i class="is-taken"></i> 이미 찬 자리</span>' +
        '<span class="tk-key"><i class="is-off"></i> 앉을 수 없음</span>' +
      '</p>' +
      '</div>';
  }

  /* =========================================================
     상세 — 포스터를 보고 들어와 읽는 곳
     ========================================================= */

  function renderDetail(id) {
    var r = rows.concat(mineRows).filter(function (x) { return x.id === id; })[0];
    var body = el('tkDetailBody');
    stopTicker();

    if (!r) {
      body.innerHTML = '<div class="ls-gone"><h2>집회를 찾을 수 없습니다</h2>' +
        '<p>내려갔거나, 주소가 잘못되었을 수 있습니다.</p>' +
        '<a class="btn btn-primary" href="#list">목록으로</a></div>';
      return;
    }

    var v = db.eventView(r);

    body.innerHTML =
      '<div class="ls-view tk-view">' +
        '<div class="ls-view-head">' +
          '<span class="ls-tag ls-tag-' + esc(r.category) + '">' + esc(v.categoryLabel) + '</span>' +
          (v.full || v.status === 'closed' ? '<span class="ls-tag is-warn">마감</span>' : '') +
          '<h1>' + esc(r.title || '(이름 없음)') + '</h1>' +
          (r.subtitle ? '<p class="ls-view-sub">' + esc(r.subtitle) + '</p>' : '') +
          '<p class="ls-view-price">' + esc(db.eventPrice(r)) + '</p>' +
        '</div>' +

        B.gallery(v.photos, 'tkGal') +

        '<div class="tk-status" id="tkStatus"></div>' +

        '<dl class="ls-dls">' +
          B.dl('일시', esc(B.when(r.startsAt)) +
            (r.endsAt ? ' ~ ' + esc(B.when(r.endsAt)) : '')) +
          B.dl('장소', esc([r.venue, r.address].filter(Boolean).join(' · '))) +
          B.dl('주최', esc(r.host)) +
          B.dl('강사 · 찬양팀', esc(r.speakers)) +
          B.dl('참가 대상', esc(r.ageNote)) +
          B.dl('참가비', esc(db.eventPrice(r))) +
          B.dl('정원', v.capacity ? v.capacity + '명 (신청 ' + v.taken + '명)' : '제한 없음') +
          B.dl('한 사람당', v.perPersonMax + '명까지') +
          B.dl('예매 시작', r.openAt ? esc(B.when(r.openAt)) : '게시 즉시') +
          B.dl('신청 마감', r.closeAt ? esc(B.when(r.closeAt)) : null) +
          B.dl('좌석', v.seating ? '좌석을 골라 신청합니다' : '좌석 지정 없이 인원수로 받습니다') +
        '</dl>' +

        (r.scheduleNote
          ? '<div class="ls-view-desc"><h2>일정</h2><p>' + B.nl2br(r.scheduleNote) + '</p></div>' : '') +

        '<div class="ls-view-desc"><h2>집회 소개</h2><p>' + B.nl2br(r.desc) + '</p></div>' +

        (r.notice
          ? '<div class="ls-view-desc is-rules"><h2>신청 전 안내</h2><p>' +
            B.nl2br(r.notice) + '</p></div>' : '') +

        '<div class="ls-contact">' +
          '<h2>문의</h2>' +
          '<p class="ls-contact-name">' + esc(r.contactName) + '</p>' +
          '<p class="ls-contact-phone"><a href="tel:' + esc(B.digits(r.contactPhone)) + '">' +
            esc(db.formatPhone(r.contactPhone)) + '</a></p>' +
          (r.contactHours
            ? '<p class="ls-contact-hours">연락 가능 시간 — ' + esc(r.contactHours) + '</p>' : '') +
          '<p class="ls-contact-fine">' +
            '참가비 수납 · 환불 · 일정 변경은 주최 측이 안내합니다. ' +
            '센터는 신청 창구만 운영합니다.</p>' +
        '</div>' +

        '<div class="ls-view-foot">' +
          '<a class="btn btn-outline" href="#list">← 목록으로</a>' +
        '</div>' +
      '</div>';

    B.bindGallery(v.photos, 'tkGal');
    paintStatus(r, el('tkStatus'), true);
  }

  /**
   * 신청 버튼과 그 위의 한 줄.
   * 예매 시작 전에는 남은 시간이 1초마다 줄어들고, 0 이 되면 버튼이 열립니다.
   * 정원이 차면 "마감되었습니다" 로 바뀝니다.
   */
  function paintStatus(r, box, withCta) {
    if (!box) return;
    stopTicker();

    function paint() {
      var v = db.eventView(r);
      var wait = db.openInSeconds(r);

      if (v.full || v.status === 'closed') {
        box.className = 'tk-status is-full';
        box.innerHTML =
          '<p class="tk-status-title">정원이 모두 찼습니다 — 마감되었습니다</p>' +
          '<p class="tk-status-sub">' +
            (v.capacity ? '정원 ' + v.capacity + '명이 모두 신청하셨습니다. ' : '') +
            '취소가 나오면 자리가 다시 열립니다 — 이 쪽을 가끔 확인해 주세요.</p>';
        stopTicker();
        return;
      }

      if (v.status === 'done' || v.over) {
        box.className = 'tk-status is-done';
        box.innerHTML = '<p class="tk-status-title">이미 지난 집회입니다</p>';
        stopTicker();
        return;
      }

      if (!v.opened) {
        box.className = 'tk-status is-soon';
        box.innerHTML =
          '<p class="tk-status-title">예매 시작까지 <strong>' +
            esc(B.countdown(Math.max(wait, 1))) + '</strong></p>' +
          '<p class="tk-status-sub">' + esc(B.when(r.openAt)) + ' 정각에 신청 버튼이 열립니다.</p>' +
          (withCta ? '<button type="button" class="btn btn-lg" disabled>아직 신청할 수 없습니다</button>' : '');
        return;
      }

      if (!v.can) {
        box.className = 'tk-status is-shut';
        box.innerHTML = '<p class="tk-status-title">' + esc(v.why || '지금은 신청을 받지 않습니다.') + '</p>';
        stopTicker();
        return;
      }

      box.className = 'tk-status is-open';
      box.innerHTML =
        '<p class="tk-status-title">신청을 받고 있습니다' +
          (v.left != null ? ' — <strong>' + v.left + '석</strong> 남았습니다' : '') + '</p>' +
        (v.pct != null
          ? '<span class="tk-bar"><span class="tk-bar-in" style="width:' + v.pct + '%"></span></span>' : '') +
        (withCta
          ? '<a class="btn btn-gold btn-lg" href="#apply/' + esc(r.id) + '">신청하기</a>' : '');
      stopTicker();
    }

    paint();
    // 예매 시작 전이면 1초마다 남은 시간을 고쳐 그립니다.
    if (!db.ticketOpen(r)) {
      ticker = window.setInterval(function () {
        if (db.ticketOpen(r)) {
          // 시각이 되었습니다 — 정원이 그새 찼을 수 있어 다시 읽어 옵니다.
          stopTicker();
          db.publishedEvents().then(function (list) {
            rows = list;
            var fresh = list.filter(function (x) { return x.id === r.id; })[0];
            paintStatus(fresh || r, box, withCta);
          });
          return;
        }
        paint();
      }, 1000);
    }
  }

  /* =========================================================
     신청하기
     ========================================================= */

  function renderApply(id) {
    var body = el('tkApplyBody');
    stopTicker();
    picked = [];

    var r = rows.concat(mineRows).filter(function (x) { return x.id === id; })[0];
    if (!r) {
      body.innerHTML = '<div class="ls-gone"><h2>집회를 찾을 수 없습니다</h2>' +
        '<a class="btn btn-primary" href="#list">목록으로</a></div>';
      return;
    }

    var me = db.auth.current();
    if (!me) {
      body.innerHTML = '<div class="ls-gate">' +
        '<p><strong>' + esc(r.title) + '</strong> 신청은 로그인 후 이용하실 수 있습니다.<br>' +
        '신청 내역과 신청 번호를 확인하시려면 계정이 필요합니다.</p>' +
        '<button type="button" class="btn btn-primary" id="tkApplyLogin">로그인 / 회원가입</button></div>';
      el('tkApplyLogin').addEventListener('click', function () {
        if (window.CAPSAuthUI) {
          window.CAPSAuthUI.require().then(function (u) { if (u) renderApply(id); });
        }
      });
      return;
    }

    var v = db.eventView(r);

    if (!v.can) {
      body.innerHTML =
        '<div class="tk-shut">' +
          '<h1>' + esc(r.title) + '</h1>' +
          '<p class="tk-shut-msg">' + esc(v.why || '지금은 신청을 받지 않습니다.') + '</p>' +
          (v.full
            ? '<p>취소가 나오면 자리가 다시 열립니다. 집회 쪽을 가끔 확인해 주세요.</p>' : '') +
          '<div class="ls-view-foot">' +
            '<a class="btn btn-outline" href="#view/' + esc(r.id) + '">집회 소개로</a>' +
            '<a class="btn btn-ghost" href="#list">목록으로</a>' +
          '</div>' +
        '</div>';
      return;
    }

    var qtyMax = v.left != null ? Math.min(v.perPersonMax, v.left) : v.perPersonMax;
    var qtyOpts = '';
    for (var i = 1; i <= qtyMax; i++) {
      qtyOpts += '<option value="' + i + '">' + i + '명</option>';
    }

    body.innerHTML =
      '<div class="tk-apply">' +
        '<p class="eyebrow">신청하기</p>' +
        '<h1>' + esc(r.title) + '</h1>' +
        '<p class="tk-apply-when">' + esc(B.when(r.startsAt)) + ' · ' +
          esc([r.venue, r.region].filter(Boolean).join(' · ')) + '</p>' +
        '<p class="tk-apply-price">' + esc(db.eventPrice(r)) + '</p>' +

        (r.notice
          ? '<div class="tk-notice"><h2>신청 전 안내</h2><p>' + B.nl2br(r.notice) + '</p></div>' : '') +

        '<form class="ls-form" id="tkApplyForm" novalidate>' +
          '<fieldset class="ls-fs">' +
            '<legend><span class="ls-step">1</span> 몇 분이 오시나요?</legend>' +
            '<div class="field">' +
              '<label for="tkQty">인원 <em>*</em></label>' +
              '<select id="tkQty">' + qtyOpts + '</select>' +
              '<small class="hint">한 사람당 최대 ' + v.perPersonMax + '명까지 신청하실 수 있습니다.' +
                (v.left != null ? ' 지금 남은 자리는 ' + v.left + '석입니다.' : '') + '</small>' +
            '</div>' +
          '</fieldset>' +

          (v.seating
            ? '<fieldset class="ls-fs">' +
                '<legend><span class="ls-step">2</span> 자리를 골라 주세요</legend>' +
                '<p class="ls-fs-lead">인원 수만큼 고르시면 됩니다. ' +
                  '이미 찬 자리는 눌리지 않습니다.</p>' +
                '<div id="tkSeatPick"><p class="ls-loading">좌석을 불러오는 중입니다…</p></div>' +
                '<p class="tk-seat-sum" id="tkPickSum"></p>' +
              '</fieldset>'
            : '') +

          '<fieldset class="ls-fs">' +
            '<legend><span class="ls-step">' + (v.seating ? 3 : 2) + '</span> 신청하시는 분</legend>' +
            '<div class="grid-2">' +
              '<div class="field"><label for="tkName">성함 <em>*</em></label>' +
                '<input type="text" id="tkName" maxlength="20" autocomplete="name" value="' +
                esc(me.name || '') + '"></div>' +
              '<div class="field"><label for="tkPhone">연락처 <em>*</em></label>' +
                '<input type="tel" id="tkPhone" placeholder="010-0000-0000" autocomplete="tel"></div>' +
            '</div>' +
            '<div class="field"><label for="tkChurch">교회명</label>' +
              '<input type="text" id="tkChurch" maxlength="40"></div>' +
            '<div class="field"><label for="tkNote">남기실 말씀</label>' +
              '<textarea id="tkNote" rows="3" maxlength="500" ' +
              'placeholder="예: 휠체어 자리가 필요합니다 · 아이 2명과 함께 갑니다"></textarea></div>' +
          '</fieldset>' +

          '<p class="form-msg is-err" id="tkApplyErr" hidden></p>' +
          '<p class="form-msg is-ok" id="tkApplyOk" hidden></p>' +
          '<div class="ls-form-actions">' +
            '<button type="submit" class="btn btn-gold btn-lg" id="tkApplyBtn">신청 확정하기</button>' +
            '<a class="btn btn-outline btn-lg" href="#view/' + esc(r.id) + '">집회 소개로</a>' +
          '</div>' +
        '</form>' +
      '</div>';

    var phone = el('tkPhone');
    if (phone) db.bindPhoneInput(phone);

    if (v.seating) bindSeatPick(r);
    bindApplySubmit(r);
  }

  /** 좌석 고르기 — 이미 팔린 자리를 읽어 와 잠급니다. */
  function bindSeatPick(r) {
    var box = el('tkSeatPick');
    var sum = el('tkPickSum');
    var qty = el('tkQty');

    function paintSum() {
      var want = Number(qty.value) || 1;
      sum.textContent = picked.length
        ? '고른 자리 — ' + picked.join(', ') + ' (' + picked.length + ' / ' + want + ')'
        : '아직 고르신 자리가 없습니다 (' + want + '개 고르셔야 합니다).';
    }

    db.eventTickets(r.id).then(function (orders) {
      var taken = db.takenSeats(orders);
      box.innerHTML = seatmapHtml(r.seatmap, { taken: taken, picked: picked, id: 'tkSeatGrid' });
      paintSum();

      box.addEventListener('click', function (e) {
        var b = e.target.closest('.tk-seat');
        if (!b || b.disabled) return;
        var id = b.getAttribute('data-seat');
        var at = picked.indexOf(id);
        var want = Number(qty.value) || 1;

        if (at > -1) {
          picked.splice(at, 1);
        } else {
          if (picked.length >= want) {
            // 인원보다 많이 고르셨습니다 — 가장 먼저 고른 자리를 놓아 줍니다.
            var dropped = picked.shift();
            var old = box.querySelector('.tk-seat[data-seat="' + dropped + '"]');
            if (old) old.classList.remove('is-picked');
          }
          picked.push(id);
        }
        b.classList.toggle('is-picked', picked.indexOf(id) > -1);
        paintSum();
      });

      qty.addEventListener('change', function () {
        var want = Number(qty.value) || 1;
        while (picked.length > want) {
          var dropped = picked.shift();
          var old = box.querySelector('.tk-seat[data-seat="' + dropped + '"]');
          if (old) old.classList.remove('is-picked');
        }
        paintSum();
      });
    });
  }

  function bindApplySubmit(r) {
    var form = el('tkApplyForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = el('tkApplyErr');
      var ok = el('tkApplyOk');
      B.say(err, '');
      B.say(ok, '');

      var v = db.eventView(r);
      var qty = Number(el('tkQty').value) || 1;
      var name = el('tkName').value.trim();
      var phone = el('tkPhone').value.trim();

      if (!name) { B.say(err, '성함을 적어 주세요.'); return; }
      if (B.digits(phone).length < 9) { B.say(err, '연락처를 확인해 주세요.'); return; }
      if (v.seating && picked.length !== qty) {
        B.say(err, '자리를 ' + qty + '개 골라 주세요. 지금 ' + picked.length + '개 고르셨습니다.');
        return;
      }

      var btn = el('tkApplyBtn');
      btn.disabled = true;
      btn.textContent = '신청하는 중…';

      db.reserveTickets(r.id, {
        qty: qty,
        seats: v.seating ? picked.slice() : [],
        name: name,
        phone: phone,
        churchName: el('tkChurch').value.trim(),
        note: el('tkNote').value.trim(),
      }).then(function () {
        B.say(ok, '신청이 확정되었습니다. [내 신청 내역] 에서 신청 번호를 확인해 주세요.');
        // 남은 자리가 줄었으니 목록도 새로 읽어 둡니다.
        return db.publishedEvents().then(function (list) {
          rows = list;
          renderList();
        });
      }).then(function () {
        window.setTimeout(function () { window.location.hash = '#tickets'; }, 1200);
      }).catch(function (error) {
        B.say(err, error.message || '신청하지 못했습니다.');
        btn.disabled = false;
        btn.textContent = '신청 확정하기';
        // 좌석이 겹쳐 실패한 경우가 많아, 좌석도를 새로 읽어 줍니다.
        if (v.seating) {
          picked = [];
          bindSeatPick(r);
        }
      });
    });
  }

  /* =========================================================
     내 신청 내역
     ========================================================= */

  function ticketCard(o, ev) {
    var cls = o.status === 'canceled' ? 'canceled'
      : o.status === 'checked_in' ? 'done' : 'published';

    return '<article class="ls-mine is-' + cls + '">' +
      '<div class="ls-mine-head"><div>' +
        '<span class="ls-state is-' + cls + '">' +
          esc(db.TICKET_STATUS[o.status] || o.status) + '</span>' +
        '<h3>' + esc(o.eventTitle || (ev && ev.title) || '(집회)') + '</h3>' +
        '<p class="ls-mine-meta">' +
          (ev ? esc(B.when(ev.startsAt)) + ' · ' + esc(ev.venue || '') : '') + '</p>' +
      '</div></div>' +

      '<dl class="ls-dls is-tight">' +
        B.dl('신청 번호', '<code>' + esc(o.code || '-') + '</code>') +
        B.dl('인원', (Number(o.qty) || 1) + '명') +
        B.dl('좌석', (Array.isArray(o.seats) && o.seats.length)
          ? esc(o.seats.join(', ')) : null) +
        B.dl('신청한 때', esc(B.when(o.createdAt))) +
      '</dl>' +

      (o.status === 'canceled'
        ? '<p class="ls-mine-note">취소하셨습니다. 자리는 다른 분께 돌아갔습니다.</p>' : '') +

      '<div class="ls-mine-act">' +
        (ev ? '<a class="btn btn-outline btn-sm" href="#view/' + esc(ev.id) + '">집회 보기</a>' : '') +
        (o.status === 'confirmed'
          ? '<button type="button" class="btn btn-ghost btn-sm is-danger" data-cancel="' +
            esc(o.id) + '">신청 취소</button>' : '') +
      '</div>' +
      '</article>';
  }

  function renderTickets() {
    var box = el('tkTicketsBody');
    var me = db.auth.current();

    if (!me) {
      box.innerHTML = '<div class="ls-gate">' +
        '<p>내 신청 내역을 보시려면 로그인해 주세요.</p>' +
        '<button type="button" class="btn btn-primary" id="tkTicketsLogin">로그인 / 회원가입</button></div>';
      el('tkTicketsLogin').addEventListener('click', function () {
        if (window.CAPSAuthUI) window.CAPSAuthUI.require().then(renderTickets);
      });
      return;
    }

    box.innerHTML = '<p class="ls-loading">불러오는 중입니다…</p>';
    db.myTickets().then(function (list) {
      var sorted = list.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      box.innerHTML = sorted.length
        ? sorted.map(function (o) {
          var ev = rows.filter(function (r) { return r.id === o.eventId; })[0];
          return ticketCard(o, ev);
        }).join('')
        : '<div class="ls-empty is-inline"><h3>아직 신청하신 집회가 없습니다</h3>' +
          '<p>목록에서 마음이 가는 집회를 찾아 신청해 보세요.</p>' +
          '<a class="btn btn-primary" href="#list">집회 둘러보기</a></div>';
    });
  }

  el('tkTicketsBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cancel]');
    if (!b) return;
    if (!window.confirm('신청을 취소할까요?\n\n자리는 바로 다른 분께 돌아갑니다. 다시 신청하시려면 자리가 남아 있어야 합니다.')) return;
    b.disabled = true;
    db.cancelTicket(b.getAttribute('data-cancel'))
      .then(function () { return db.publishedEvents(); })
      .then(function (list) { rows = list; renderList(); renderTickets(); })
      .catch(function (err) { window.alert(err.message); b.disabled = false; });
  });

  /* =========================================================
     내가 올린 집회
     ========================================================= */

  function mineCard(r) {
    var v = db.eventView(r);
    var cover = v.poster ? (v.poster.url || '') : '';

    return '<article class="ls-mine is-' + esc(v.cls) + '">' +
      '<div class="ls-mine-head">' +
        (cover ? '<img class="ls-mine-shot" src="' + esc(cover) + '" alt="">' : '') +
        '<div>' +
          '<span class="ls-state is-' + esc(v.cls) + '">' + esc(v.label) + '</span>' +
          '<h3>' + esc(r.title || '(이름 없음)') + '</h3>' +
          '<p class="ls-mine-meta">' + esc(B.when(r.startsAt)) + ' · ' + esc(r.venue || '') + '</p>' +
        '</div>' +
      '</div>' +

      (v.capacity
        ? '<div class="tk-mine-bar">' +
            '<span class="tk-bar"><span class="tk-bar-in" style="width:' + (v.pct || 0) + '%"></span></span>' +
            '<span class="tk-bar-txt"><strong>' + v.taken + '</strong> / ' + v.capacity + '명 신청' +
            (v.left === 0 ? ' — 정원이 모두 찼습니다' : ' — ' + v.left + '석 남음') + '</span>' +
          '</div>'
        : '<p class="ls-mine-note">정원 제한 없이 받고 있습니다 (지금까지 ' + v.taken + '명).</p>') +

      (v.status === 'pending'
        ? '<p class="ls-mine-note">관리자가 주최 · 장소 · 일시를 확인하고 있습니다.</p>' : '') +
      (v.status === 'rejected'
        ? '<p class="ls-mine-note is-bad"><strong>반려되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '사유가 적혀 있지 않습니다.') + '</p>' : '') +
      (v.status === 'hidden'
        ? '<p class="ls-mine-note is-bad"><strong>게시가 중지되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '') + '</p>' : '') +

      '<div class="ls-mine-act">' +
        '<a class="btn btn-outline btn-sm" href="#edit/' + esc(r.id) + '">고치기</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-roster="' + esc(r.id) + '">신청자 명단</button>' +
        (r.status === 'published'
          ? '<button type="button" class="btn btn-gold btn-sm" data-close="' + esc(r.id) + '">지금 마감</button>' : '') +
        (r.status === 'closed'
          ? '<button type="button" class="btn btn-gold btn-sm" data-reopen="' + esc(r.id) + '">다시 열기</button>' : '') +
        (Number(r.taken) ? ''
          : '<button type="button" class="btn btn-ghost btn-sm is-danger" data-del="' + esc(r.id) + '">삭제</button>') +
      '</div>' +
      '<div class="tk-roster" id="tkRoster-' + esc(r.id) + '" hidden></div>' +
      '</article>';
  }

  function renderMine() {
    var box = el('tkMineBody');
    var me = db.auth.current();

    if (!me) {
      box.innerHTML = '<div class="ls-gate">' +
        '<p>내가 올린 집회를 보시려면 로그인해 주세요.</p>' +
        '<button type="button" class="btn btn-primary" id="tkMineLogin">로그인 / 회원가입</button></div>';
      el('tkMineLogin').addEventListener('click', function () {
        if (window.CAPSAuthUI) window.CAPSAuthUI.require().then(renderMine);
      });
      return;
    }

    box.innerHTML = '<p class="ls-loading">불러오는 중입니다…</p>';
    db.myEvents().then(function (list) {
      mineRows = list.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      box.innerHTML = mineRows.length
        ? mineRows.map(mineCard).join('')
        : '<div class="ls-empty is-inline"><h3>아직 올리신 집회가 없습니다</h3>' +
          '<p>여시는 집회의 신청을 여기에서 받으실 수 있습니다.</p>' +
          '<a class="btn btn-primary" href="#new">집회 올리기</a></div>';
    });
  }

  el('tkMineBody').addEventListener('click', function (e) {
    var roster = e.target.closest('[data-roster]');
    var shut = e.target.closest('[data-close]');
    var open = e.target.closest('[data-reopen]');
    var del = e.target.closest('[data-del]');

    if (roster) {
      var id = roster.getAttribute('data-roster');
      var pane = el('tkRoster-' + id);
      if (!pane.hidden) { pane.hidden = true; return; }
      pane.hidden = false;
      pane.innerHTML = '<p class="ls-loading">명단을 불러오는 중입니다…</p>';
      db.eventTickets(id).then(function (list) {
        var live = list.filter(function (o) { return o.status !== 'canceled'; });
        if (!live.length) {
          pane.innerHTML = '<p class="tk-roster-empty">아직 신청하신 분이 없습니다.</p>';
          return;
        }
        pane.innerHTML =
          '<table class="tk-roster-table"><thead><tr>' +
            '<th>성함</th><th>연락처</th><th>교회</th><th>인원</th><th>좌석</th><th>번호</th>' +
          '</tr></thead><tbody>' +
          live.map(function (o) {
            return '<tr>' +
              '<td>' + esc(o.name) + '</td>' +
              '<td>' + esc(db.formatPhone(o.phone)) + '</td>' +
              '<td>' + esc(o.churchName || '') + '</td>' +
              '<td>' + (Number(o.qty) || 1) + '</td>' +
              '<td>' + esc((o.seats || []).join(', ')) + '</td>' +
              '<td><code>' + esc(o.code || '') + '</code></td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>' +
          '<p class="tk-roster-sum">모두 ' + live.length + '건 · ' +
            live.reduce(function (n, o) { return n + (Number(o.qty) || 1); }, 0) + '명</p>';
      });
      return;
    }

    if (shut) {
      if (!window.confirm('지금 마감할까요?\n\n자리가 남아 있어도 신청을 더 받지 않습니다. 나중에 다시 여실 수 있습니다.')) return;
      shut.disabled = true;
      db.closeEvent(shut.getAttribute('data-close')).then(renderMine)
        .catch(function (err) { window.alert(err.message); shut.disabled = false; });
      return;
    }
    if (open) {
      open.disabled = true;
      db.reopenEvent(open.getAttribute('data-reopen')).then(renderMine)
        .catch(function (err) { window.alert(err.message); open.disabled = false; });
      return;
    }
    if (del) {
      if (!window.confirm('이 집회를 삭제할까요?\n\n올리신 사진도 함께 지워지며 되돌릴 수 없습니다.')) return;
      del.disabled = true;
      var row = mineRows.filter(function (r) { return r.id === del.getAttribute('data-del'); })[0];
      db.deleteEvent(row || del.getAttribute('data-del')).then(renderMine)
        .catch(function (err) { window.alert(err.message); del.disabled = false; });
    }
  });

  /* =========================================================
     집회 올리기
     ========================================================= */

  var f = {
    category: el('tkFCategory'),
    host: el('tkFHost'),
    title: el('tkFTitle'),
    subtitle: el('tkFSubtitle'),
    speakers: el('tkFSpeakers'),
    starts: el('tkFStarts'),
    ends: el('tkFEnds'),
    scheduleNote: el('tkFScheduleNote'),
    region: el('tkFRegion'),
    venue: el('tkFVenue'),
    address: el('tkFAddress'),
    openAt: el('tkFOpenAt'),
    closeAt: el('tkFCloseAt'),
    capacity: el('tkFCapacity'),
    perPerson: el('tkFPerPerson'),
    free: el('tkFFree'),
    price: el('tkFPrice'),
    earlyPrice: el('tkFEarlyPrice'),
    earlyUntil: el('tkFEarlyUntil'),
    ageNote: el('tkFAgeNote'),
    seating: el('tkFSeating'),
    seatRows: el('tkFSeatRows'),
    seatPer: el('tkFSeatPer'),
    seatNote: el('tkFSeatNote'),
    desc: el('tkFDesc'),
    notice: el('tkFNotice'),
    name: el('tkFContactName'),
    phone: el('tkFContactPhone'),
    hours: el('tkFHours'),
  };

  var vows = ['tkVow1', 'tkVow2', 'tkVow3'].map(el);

  if (f.phone) db.bindPhoneInput(f.phone);
  [f.price, f.earlyPrice].forEach(B.bindMoney);
  B.bindChips();

  if (f.title) {
    var countTitle = function () {
      el('tkTitleCount').textContent = f.title.value.length + ' / 60';
    };
    f.title.addEventListener('input', countTitle);
    countTitle();
  }

  function syncFree() {
    el('tkPriceBox').hidden = f.free.checked;
    if (f.free.checked) {
      f.price.value = '';
      f.earlyPrice.value = '';
      f.earlyUntil.value = '';
    }
  }
  f.free.addEventListener('change', syncFree);

  function syncSeating() {
    el('tkSeatBox').hidden = !f.seating.checked;
    if (!f.seating.checked) {
      draftSeatmap = { rows: [], note: '' };
      paintSeatEditor();
    }
  }
  f.seating.addEventListener('change', syncSeating);

  /** 좌석도 편집 — 자리를 눌러 끄고 켭니다. */
  function paintSeatEditor() {
    var box = el('tkSeatEdit');
    var sum = el('tkSeatSum');
    if (!box) return;

    if (!draftSeatmap.rows.length) {
      box.innerHTML = '';
      sum.textContent = '';
      return;
    }
    box.outerHTML = seatmapHtml(draftSeatmap, { edit: true, id: 'tkSeatEdit' });
    var n = db.seatmapCount(draftSeatmap);
    sum.innerHTML = '앉을 수 있는 자리 <strong>' + n + '석</strong>' +
      '<br><small>이 수를 그대로 정원으로 쓰시려면 위 [정원] 칸에 <strong>' + n +
      '</strong> 을(를) 넣어 주세요.</small>';
  }

  el('tkSeatMake').addEventListener('click', function () {
    var note = draftSeatmap.note || '';
    draftSeatmap = db.makeSeatmap(f.seatRows.value, f.seatPer.value, note);
    paintSeatEditor();
  });

  // 좌석도의 자리를 눌러 켜고 끕니다 (통로 · 기둥 자리).
  el('tkSeatBox').addEventListener('click', function (e) {
    var b = e.target.closest('#tkSeatEdit .tk-seat');
    if (!b) return;
    var id = b.getAttribute('data-seat');
    draftSeatmap.rows.forEach(function (row) {
      (row.seats || []).forEach(function (s) {
        if (s.id === id) s.off = !s.off;
      });
    });
    paintSeatEditor();
  });

  function collect() {
    var seating = f.seating.checked && draftSeatmap.rows.length > 0;
    return {
      category: f.category.value,
      host: f.host.value.trim(),
      title: f.title.value.trim(),
      subtitle: f.subtitle.value.trim(),
      speakers: f.speakers.value.trim(),
      startsAt: B.fromLocalInput(f.starts.value),
      endsAt: B.fromLocalInput(f.ends.value),
      scheduleNote: f.scheduleNote.value.trim(),
      region: f.region.value,
      venue: f.venue.value.trim(),
      address: f.address.value.trim(),
      openAt: B.fromLocalInput(f.openAt.value),
      closeAt: B.fromLocalInput(f.closeAt.value),
      capacity: Math.max(0, Number(f.capacity.value) || 0),
      perPersonMax: Math.max(1, Number(f.perPerson.value) || 4),
      freeEvent: f.free.checked,
      price: f.free.checked ? 0 : Number(B.digits(f.price.value)) || 0,
      earlyPrice: f.free.checked ? 0 : Number(B.digits(f.earlyPrice.value)) || 0,
      earlyUntil: f.free.checked ? '' : B.fromLocalInput(f.earlyUntil.value),
      ageNote: f.ageNote.value.trim(),
      seatingOn: seating,
      seatmap: seating
        ? { rows: draftSeatmap.rows, note: f.seatNote.value.trim() }
        : {},
      desc: f.desc.value.trim(),
      notice: f.notice.value.trim(),
      contactName: f.name.value.trim(),
      contactPhone: f.phone.value.trim(),
      contactHours: f.hours.value.trim(),
      photos: photos.get(),
      poster: photos.get()[0] || null,
    };
  }

  function validate(d) {
    if (!d.title) return '집회 이름을 적어 주세요.';
    if (!d.host) return '주최를 적어 주세요.';
    if (!d.startsAt) return '집회 시작 일시를 골라 주세요.';
    if (d.endsAt && d.endsAt < d.startsAt) return '끝나는 때가 시작보다 앞섭니다. 다시 확인해 주세요.';
    if (!d.region) return '지역을 골라 주세요.';
    if (!d.venue) return '장소를 적어 주세요.';
    if (d.openAt && d.openAt > d.startsAt) {
      return '예매 시작이 집회보다 늦습니다. 다시 확인해 주세요.';
    }
    if (d.closeAt && d.openAt && d.closeAt < d.openAt) {
      return '신청 마감이 예매 시작보다 앞섭니다. 다시 확인해 주세요.';
    }
    if (!d.freeEvent && d.earlyPrice > 0 && d.price > 0 && d.earlyPrice >= d.price) {
      return '얼리버드 참가비가 정가보다 비쌉니다. 다시 확인해 주세요.';
    }
    if (!d.freeEvent && d.earlyPrice > 0 && !d.earlyUntil) {
      return '얼리버드 마감 시각을 골라 주세요. 언제까지인지 없으면 정가로 넘어갈 수 없습니다.';
    }
    if (d.seatingOn) {
      var n = db.seatmapCount(d.seatmap);
      if (!n) return '좌석도에 앉을 수 있는 자리가 없습니다. 좌석도를 만들어 주세요.';
      if (d.capacity > 0 && d.capacity > n) {
        return '정원(' + d.capacity + '명)이 좌석 수(' + n + '석)보다 많습니다. 좌석을 늘리거나 정원을 줄여 주세요.';
      }
    }
    if (!d.photos.length) return '포스터를 한 장 이상 올려 주세요. 첫 장이 목록에 보이는 대표 포스터가 됩니다.';
    if (d.desc.length < 20) return '집회 소개를 조금 더 적어 주세요 (20자 이상).';
    if (!d.contactName) return '문의받으실 담당자 성함을 적어 주세요.';
    if (B.digits(d.contactPhone).length < 9) return '연락처를 확인해 주세요.';
    if (!d.contactHours) return '연락 가능 시간을 적어 주세요.';
    for (var i = 0; i < vows.length; i++) {
      if (vows[i] && !vows[i].checked) return '아래 확인 항목에 모두 체크해 주세요.';
    }
    return '';
  }

  function fillForm(r) {
    f.category.value = r.category || 'praise';
    f.host.value = r.host || '';
    f.title.value = r.title || '';
    f.subtitle.value = r.subtitle || '';
    f.speakers.value = r.speakers || '';
    f.starts.value = B.toLocalInput(r.startsAt);
    f.ends.value = B.toLocalInput(r.endsAt);
    f.scheduleNote.value = r.scheduleNote || '';
    f.region.value = r.region || '';
    f.venue.value = r.venue || '';
    f.address.value = r.address || '';
    f.openAt.value = B.toLocalInput(r.openAt);
    f.closeAt.value = B.toLocalInput(r.closeAt);
    f.capacity.value = r.capacity || '';
    f.perPerson.value = r.perPersonMax || 4;
    f.free.checked = !!r.freeEvent;
    syncFree();
    f.price.value = r.price ? B.comma(r.price) : '';
    f.earlyPrice.value = r.earlyPrice ? B.comma(r.earlyPrice) : '';
    f.earlyUntil.value = B.toLocalInput(r.earlyUntil);
    f.ageNote.value = r.ageNote || '';
    f.seating.checked = !!r.seatingOn;
    draftSeatmap = (r.seatmap && Array.isArray(r.seatmap.rows))
      ? { rows: r.seatmap.rows, note: r.seatmap.note || '' }
      : { rows: [], note: '' };
    f.seatNote.value = draftSeatmap.note;
    el('tkSeatBox').hidden = !f.seating.checked;
    paintSeatEditor();
    f.desc.value = r.desc || '';
    f.notice.value = r.notice || '';
    f.name.value = r.contactName || '';
    f.phone.value = db.formatPhone(r.contactPhone || '');
    f.hours.value = r.contactHours || '';
    photos.set(Array.isArray(r.photos) ? r.photos : []);
    f.title.dispatchEvent(new Event('input'));
  }

  function resetForm() {
    el('tkForm').reset();
    photos.clear();
    draftSeatmap = { rows: [], note: '' };
    syncFree();
    syncSeating();
    paintSeatEditor();
    f.title.dispatchEvent(new Event('input'));
  }

  function openForm(editId) {
    B.say(el('tkFormErr'), '');
    B.say(el('tkFormOk'), '');
    el('tkEditId').value = editId || '';
    el('tkSubmit').textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';

    if (!B.gate('tk', function () { openForm(editId); })) return;

    if (!editId) { resetForm(); return; }

    var hit = mineRows.filter(function (r) { return r.id === editId; })[0];
    if (hit) { fillForm(hit); return; }
    db.myEvents().then(function (list) {
      mineRows = list;
      var row = list.filter(function (r) { return r.id === editId; })[0];
      if (row) fillForm(row);
      else B.say(el('tkFormErr'), '고치실 집회를 찾지 못했습니다.');
    });
  }

  el('tkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    B.say(el('tkFormErr'), '');
    B.say(el('tkFormOk'), '');

    if (photos.busy()) {
      B.say(el('tkFormErr'), '사진을 아직 올리는 중입니다. 잠시만 기다려 주세요.');
      return;
    }

    var data = collect();
    var bad = validate(data);
    if (bad) {
      B.say(el('tkFormErr'), bad);
      el('tkFormErr').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var editId = el('tkEditId').value;
    var current = mineRows.filter(function (r) { return r.id === editId; })[0];
    var btn = el('tkSubmit');
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    var task = editId ? db.saveEvent(editId, data, current) : db.submitEvent(data);

    task.then(function () {
      B.say(el('tkFormOk'),
        editId
          ? '고친 내용을 보냈습니다. 관리자가 다시 확인한 뒤 게시됩니다.'
          : '등록 신청이 접수되었습니다. 관리자가 주최 · 장소 · 일시를 확인한 뒤 게시됩니다.');
      resetForm();
      window.setTimeout(function () { window.location.hash = '#mine'; }, 1200);
    }).catch(function (err) {
      B.say(el('tkFormErr'), err.message || '등록하지 못했습니다.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';
    });
  });

  /* =========================================================
     화면 전환
     ========================================================= */

  var nav = B.router(
    {
      list: 'tkBoard',
      view: 'tkDetail',
      apply: 'tkApply',
      mine: 'tkMine',
      new: 'tkNew',
      tickets: 'tkTickets',
    },
    {
      list: function () { stopTicker(); if (!loaded) load(); },
      view: function (id) {
        (loaded ? Promise.resolve() : load()).then(function () {
          var me = db.auth.current();
          var known = function () {
            return rows.concat(mineRows).some(function (r) { return r.id === id; });
          };
          if (known()) { renderDetail(id); return; }
          // 캐시에 없습니다 — 내가 올린 것과 목록을 한 번씩 더 읽어 봅니다.
          // (방금 올라온 글의 주소를 바로 열었을 때 "없습니다"가 뜨지 않도록)
          (me ? db.myEvents() : Promise.resolve([])).then(function (list) {
            mineRows = list;
            if (known()) { renderDetail(id); return; }
            return load().then(function () { renderDetail(id); });
          });
        });
      },
      apply: function (id) {
        // 신청 화면은 언제나 가장 최근 정원으로 엽니다 — 그새 찼을 수 있습니다.
        db.publishedEvents().then(function (list) {
          rows = list;
          renderApply(id);
        });
      },
      mine: function () { stopTicker(); renderMine(); },
      new: function () { stopTicker(); openForm(''); },
      edit: function (id) { stopTicker(); openForm(id); },
      tickets: function () {
        stopTicker();
        (loaded ? Promise.resolve() : load()).then(renderTickets);
      },
    },
    { bodyAttr: 'data-tk-pane' }
  );

  ['tkQ', 'tkCategory', 'tkRegion', 'tkWhen'].forEach(function (id) {
    var node = el(id);
    if (!node) return;
    node.addEventListener('input', renderList);
    node.addEventListener('change', renderList);
  });

  db.auth.onChange(function () {
    var parts = nav.current();
    if (parts[0] === 'mine') renderMine();
    if (parts[0] === 'tickets') renderTickets();
    if (parts[0] === 'apply') renderApply(parts[1] || '');
    if (parts[0] === 'new' || parts[0] === 'edit') openForm(parts[1] || '');
  });

  syncFree();
  syncSeating();
  load().catch(function () {
    el('tkList').innerHTML = '';
    el('tkEmpty').hidden = false;
  });
  nav.route();
}());
