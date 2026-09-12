/* =========================================================
   교회 게스트하우스 (guesthouse.html)

     #list        목록 (기본)
     #view/<id>   상세
     #new         등록 (#edit/<id> 로 열면 내가 올린 글 수정)
     #mine        내가 올린 방

   센터는 게시판만 봅니다 — 요금과 기간은 교회와 머무실 분이 직접 정하십니다.
   ========================================================= */
(function () {
  'use strict';

  var B = window.CAPSBoard;
  if (!B || !document.getElementById('ghBoard')) return;

  var db = B.db;
  var esc = B.esc;
  var el = B.el;

  var BOARD = window.CAPS_GUEST_BOARD || {};
  var PHOTO_MAX = Number(BOARD.photoMax) || db.GUEST_PHOTO_MAX;
  var PHOTO_MIN = Number(BOARD.photoMin) || 4;

  var rows = [];
  var mineRows = [];
  var loaded = false;

  var photos = B.photoBox('gh', PHOTO_MAX, PHOTO_MIN);
  var amenityChecks = B.checks('ghAmenity');
  var typeChecks = B.checks('ghType');
  var langChecks = B.checks('ghLang');

  /* =========================================================
     목록
     ========================================================= */

  function card(r) {
    var v = db.guestView(r);
    var cover = v.photos.length ? (v.photos[0].url || '') : '';
    var bits = [r.region, r.nearest || r.addressRough, v.roomLabel]
      .filter(Boolean).map(esc).join(' · ');

    return '<a class="ls-card' + (cover ? ' has-shot' : '') + '" href="#view/' + esc(r.id) + '">' +
      (cover
        ? '<span class="ls-card-shot">' +
            '<img src="' + esc(cover) + '" alt="" loading="lazy">' +
            (v.photos.length > 1 ? '<span class="ls-shot-n">사진 ' + v.photos.length + '장</span>' : '') +
          '</span>'
        : '<span class="ls-card-noshot">사진이 없는 글입니다</span>') +
      '<span class="ls-card-body">' +
        '<span class="ls-card-top">' +
          '<span class="ls-tag ls-tag-' + esc(r.roomType) + '">' + esc(v.roomLabel) + '</span>' +
          (r.freeStay ? '<span class="ls-tag is-gold">무료</span>' : '') +
          '<span class="ls-tag is-soft">최대 ' + (Number(r.guestsMax) || 1) + '명</span>' +
        '</span>' +
        '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
        '<p class="ls-card-meta">' + esc(r.churchName || '') + (bits ? ' · ' + bits : '') + '</p>' +
        '<strong class="ls-card-price">' + esc(db.guestPrice(r)) + '</strong>' +
        (v.typeLabels.length
          ? '<p class="ls-card-hours">' + esc(v.typeLabels.slice(0, 3).join(' · ')) + '</p>' : '') +
        '<span class="ls-card-more">자세히 보기 →</span>' +
      '</span>' +
      '</a>';
  }

  function filtered() {
    var q = (el('ghQ').value || '').trim().toLowerCase();
    var roomType = el('ghRoomType').value;
    var type = el('ghGuestType').value;
    var region = el('ghRegion').value;
    var freeOnly = el('ghFreeOnly').checked;

    return rows.filter(function (r) {
      if (roomType && r.roomType !== roomType) return false;
      if (region && r.region !== region) return false;
      if (freeOnly && !r.freeStay) return false;
      if (type) {
        var list = Array.isArray(r.guestTypes) ? r.guestTypes : [];
        // '성도 누구나' 로 열어 둔 방은 어떤 조건에도 걸립니다.
        if (list.indexOf(type) === -1 && list.indexOf('anyone') === -1) return false;
      }
      if (!q) return true;
      var hay = [r.title, r.churchName, r.region, r.addressRough, r.nearest, r.desc]
        .join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderList() {
    var list = filtered();
    B.countText(el('ghCount'), list.length, '곳');
    el('ghEmpty').hidden = !!list.length;
    el('ghList').innerHTML = list.length ? list.map(card).join('') : '';
  }

  function load() {
    return db.publishedGuestHouses().then(function (list) {
      rows = list.sort(function (a, b) {
        return String(b.publishedAt || b.createdAt || '')
          .localeCompare(String(a.publishedAt || a.createdAt || ''));
      });
      loaded = true;
      renderList();
    });
  }

  /* =========================================================
     상세
     ========================================================= */

  function stayWindow(r) {
    var from = r.availableFrom ? B.when(r.availableFrom, false) : '';
    var to = r.availableTo ? B.when(r.availableTo, false) : '';
    if (from && to) return from + ' ~ ' + to;
    if (from) return from + ' 부터';
    if (to) return to + ' 까지';
    return '';
  }

  function nightRange(r) {
    var min = Number(r.minNights) || 1;
    var max = Number(r.maxNights) || 0;
    if (max) return min + '박 ~ ' + max + '박';
    return min + '박 이상';
  }

  function renderDetail(id) {
    var r = rows.concat(mineRows).filter(function (x) { return x.id === id; })[0];
    var body = el('ghDetailBody');

    if (!r) {
      body.innerHTML = '<div class="ls-gone"><h2>글을 찾을 수 없습니다</h2>' +
        '<p>마감되어 내려갔거나, 주소가 잘못되었을 수 있습니다.</p>' +
        '<a class="btn btn-primary" href="#list">목록으로</a></div>';
      return;
    }

    var v = db.guestView(r);

    body.innerHTML =
      '<div class="ls-view">' +
        '<div class="ls-view-head">' +
          '<span class="ls-tag ls-tag-' + esc(r.roomType) + '">' + esc(v.roomLabel) + '</span>' +
          (r.freeStay ? '<span class="ls-tag is-gold">무료</span>' : '') +
          (v.status !== 'published'
            ? '<span class="ls-tag is-warn">' + esc(v.label) + '</span>' : '') +
          '<h1>' + esc(r.title || '(제목 없음)') + '</h1>' +
          '<p class="ls-view-sub">' + esc(r.churchName || '') +
            (r.denomination ? ' · ' + esc(r.denomination) : '') + '</p>' +
          '<p class="ls-view-price">' + esc(db.guestPrice(r)) + '</p>' +
        '</div>' +

        B.gallery(v.photos, 'ghGal') +

        (v.typeLabels.length
          ? '<div class="ls-chiprow"><span class="ls-chiprow-label">이런 분들을 모십니다</span>' +
            v.typeLabels.map(function (t) {
              return '<span class="ls-pill">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '') +

        '<dl class="ls-dls">' +
          B.dl('형태', esc(v.roomLabel)) +
          B.dl('최대 인원', (Number(r.guestsMax) || 1) + '명') +
          B.dl('방 · 잠자리', esc([
            (Number(r.rooms) || 1) + '개 방', r.beds,
          ].filter(Boolean).join(' · '))) +
          B.dl('화장실', esc(v.bathLabel)) +
          B.dl('지역', esc([r.region, r.addressRough].filter(Boolean).join(' · '))) +
          B.dl('가까운 역 · 정류장', esc(r.nearest)) +
          B.dl('머무는 기간', esc(nightRange(r))) +
          B.dl('가능한 때', esc(stayWindow(r))) +
          B.dl('보증금', Number(r.deposit) ? B.comma(r.deposit) + '원' : null) +
          B.dl('쓰실 수 있는 언어', v.languages.length ? esc(v.languages.join(' · ')) : null) +
        '</dl>' +

        (v.amenityLabels.length
          ? '<div class="ls-chiprow"><span class="ls-chiprow-label">있는 것</span>' +
            v.amenityLabels.map(function (t) {
              return '<span class="ls-pill is-soft">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '') +

        '<div class="ls-view-desc"><h2>소개</h2><p>' + B.nl2br(r.desc) + '</p></div>' +

        (r.houseRules
          ? '<div class="ls-view-desc is-rules"><h2>지켜 주셨으면 하는 것</h2><p>' +
            B.nl2br(r.houseRules) + '</p></div>'
          : '') +

        '<div class="ls-contact">' +
          '<h2>연락처</h2>' +
          '<p class="ls-contact-name">' + esc(r.contactName) + '</p>' +
          '<p class="ls-contact-phone"><a href="tel:' + esc(B.digits(r.contactPhone)) + '">' +
            esc(db.formatPhone(r.contactPhone)) + '</a></p>' +
          (r.contactHours
            ? '<p class="ls-contact-hours">연락 가능 시간 — ' + esc(r.contactHours) + '</p>' : '') +
          '<p class="ls-contact-fine">' +
            '요금 · 기간 · 입실 조건은 내어 놓은 교회와 머무실 분이 직접 정하십니다. ' +
            '센터는 게시판만 운영합니다.</p>' +
        '</div>' +

        '<div class="ls-view-foot">' +
          '<a class="btn btn-outline" href="#list">← 목록으로</a>' +
        '</div>' +
      '</div>';

    B.bindGallery(v.photos, 'ghGal');
  }

  /* =========================================================
     내가 올린 방
     ========================================================= */

  function mineCard(r) {
    var v = db.guestView(r);
    var cover = v.photos.length ? (v.photos[0].url || '') : '';

    return '<article class="ls-mine is-' + esc(v.cls) + '">' +
      '<div class="ls-mine-head">' +
        (cover ? '<img class="ls-mine-shot" src="' + esc(cover) + '" alt="">' : '') +
        '<div>' +
          '<span class="ls-state is-' + esc(v.cls) + '">' + esc(v.label) + '</span>' +
          '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
          '<p class="ls-mine-meta">' + esc(r.churchName || '') + ' · ' + esc(db.guestPrice(r)) + '</p>' +
        '</div>' +
      '</div>' +

      (v.status === 'pending'
        ? '<p class="ls-mine-note">관리자가 교회와 방을 확인하고 있습니다. 확인이 끝나면 게시됩니다.</p>' : '') +
      (v.status === 'rejected'
        ? '<p class="ls-mine-note is-bad"><strong>반려되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '사유가 적혀 있지 않습니다.') +
          '<br>내용을 고쳐 다시 올려 주세요.</p>' : '') +
      (v.status === 'hidden'
        ? '<p class="ls-mine-note is-bad"><strong>게시가 중지되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '') + '</p>' : '') +
      (v.status === 'done'
        ? '<p class="ls-mine-note">마감되어 내려갔습니다. 다시 받으시려면 내용을 고쳐 재등록해 주세요.</p>' : '') +

      '<div class="ls-mine-act">' +
        '<a class="btn btn-outline btn-sm" href="#edit/' + esc(r.id) + '">고치기</a>' +
        (v.status === 'published'
          ? '<button type="button" class="btn btn-gold btn-sm" data-done="' + esc(r.id) + '">마감</button>' : '') +
        (v.status === 'published'
          ? '<a class="btn btn-ghost btn-sm" href="#view/' + esc(r.id) + '">글 보기</a>' : '') +
        '<button type="button" class="btn btn-ghost btn-sm is-danger" data-del="' + esc(r.id) + '">삭제</button>' +
      '</div>' +
      '</article>';
  }

  function renderMine() {
    var box = el('ghMineBody');
    var me = db.auth.current();

    if (!me) {
      box.innerHTML = '<div class="ls-gate">' +
        '<p>내가 올린 방을 보시려면 로그인해 주세요.</p>' +
        '<button type="button" class="btn btn-primary" id="ghMineLogin">로그인 / 회원가입</button></div>';
      var b = el('ghMineLogin');
      if (b) {
        b.addEventListener('click', function () {
          if (window.CAPSAuthUI) window.CAPSAuthUI.require().then(renderMine);
        });
      }
      return;
    }

    box.innerHTML = '<p class="ls-loading">불러오는 중입니다…</p>';
    db.myGuestHouses().then(function (list) {
      mineRows = list.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      box.innerHTML = mineRows.length
        ? mineRows.map(mineCard).join('')
        : '<div class="ls-empty is-inline"><h3>아직 올리신 방이 없습니다</h3>' +
          '<p>비어 있는 사택이나 선교관이 있으시면 올려 주세요.</p>' +
          '<a class="btn btn-primary" href="#new">방 내어 놓기</a></div>';
    });
  }

  el('ghMineBody').addEventListener('click', function (e) {
    var done = e.target.closest('[data-done]');
    var del = e.target.closest('[data-del]');

    if (done) {
      if (!window.confirm('이 방을 마감할까요?\n\n목록에서 사라집니다. 다시 받으시려면 내용을 고쳐 재등록하시면 됩니다.')) return;
      done.disabled = true;
      db.markGuestDone(done.getAttribute('data-done'))
        .then(renderMine)
        .catch(function (err) { window.alert(err.message); done.disabled = false; });
      return;
    }
    if (del) {
      if (!window.confirm('이 글을 삭제할까요?\n\n올리신 사진도 함께 지워지며 되돌릴 수 없습니다.')) return;
      del.disabled = true;
      var row = mineRows.filter(function (r) { return r.id === del.getAttribute('data-del'); })[0];
      db.deleteGuestHouse(row || del.getAttribute('data-del'))
        .then(renderMine)
        .catch(function (err) { window.alert(err.message); del.disabled = false; });
    }
  });

  /* =========================================================
     등록 · 수정 폼
     ========================================================= */

  var f = {
    church: el('ghFChurch'),
    denom: el('ghFDenom'),
    title: el('ghFTitle'),
    roomType: el('ghFRoomType'),
    bath: el('ghFBath'),
    guests: el('ghFGuests'),
    rooms: el('ghFRooms'),
    beds: el('ghFBeds'),
    region: el('ghFRegion'),
    address: el('ghFAddress'),
    nearest: el('ghFNearest'),
    free: el('ghFFree'),
    night: el('ghFNight'),
    week: el('ghFWeek'),
    month: el('ghFMonth'),
    deposit: el('ghFDeposit'),
    minNights: el('ghFMinNights'),
    maxNights: el('ghFMaxNights'),
    from: el('ghFFrom'),
    to: el('ghFTo'),
    desc: el('ghFDesc'),
    rules: el('ghFRules'),
    name: el('ghFContactName'),
    phone: el('ghFContactPhone'),
    hours: el('ghFHours'),
  };

  var vows = ['ghVow1', 'ghVow2', 'ghVow3'].map(el);

  if (f.phone) db.bindPhoneInput(f.phone);
  [f.night, f.week, f.month, f.deposit].forEach(B.bindMoney);
  B.bindChips();

  if (f.title) {
    var countTitle = function () {
      el('ghTitleCount').textContent = f.title.value.length + ' / 60';
    };
    f.title.addEventListener('input', countTitle);
    countTitle();
  }

  /* 무료로 내어 놓는 방에는 요금 칸을 아예 보여 주지 않습니다.
     신고되지 않은 교회가 값을 적어 넣는 일을 처음부터 막습니다. */
  function syncFree() {
    el('ghPriceBox').hidden = f.free.checked;
    if (f.free.checked) {
      f.night.value = '';
      f.week.value = '';
      f.month.value = '';
      f.deposit.value = '';
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="ghPay"]'), function (r) {
    r.addEventListener('change', syncFree);
  });

  function collect() {
    return {
      churchName: f.church.value.trim(),
      denomination: f.denom.value.trim(),
      title: f.title.value.trim(),
      roomType: f.roomType.value,
      bath: f.bath.value,
      guestsMax: Math.max(1, Number(f.guests.value) || 1),
      rooms: Math.max(1, Number(f.rooms.value) || 1),
      beds: f.beds.value.trim(),
      region: f.region.value,
      addressRough: f.address.value.trim(),
      nearest: f.nearest.value.trim(),
      freeStay: f.free.checked,
      priceNight: f.free.checked ? 0 : Number(B.digits(f.night.value)) || 0,
      priceWeek: f.free.checked ? 0 : Number(B.digits(f.week.value)) || 0,
      priceMonth: f.free.checked ? 0 : Number(B.digits(f.month.value)) || 0,
      deposit: f.free.checked ? 0 : Number(B.digits(f.deposit.value)) || 0,
      minNights: Math.max(1, Number(f.minNights.value) || 1),
      maxNights: Math.max(0, Number(f.maxNights.value) || 0),
      availableFrom: f.from.value,
      availableTo: f.to.value,
      guestTypes: typeChecks.get(),
      amenities: amenityChecks.get(),
      languages: langChecks.get(),
      houseRules: f.rules.value.trim(),
      desc: f.desc.value.trim(),
      contactName: f.name.value.trim(),
      contactPhone: f.phone.value.trim(),
      contactHours: f.hours.value.trim(),
      photos: photos.get(),
    };
  }

  function validate(d) {
    if (!d.churchName) return '교회명을 적어 주세요.';
    if (!d.title) return '제목을 적어 주세요.';
    if (!d.region) return '지역을 골라 주세요.';
    if (!d.guestTypes.length) return '어떤 분들이 머무실 수 있는지 하나 이상 골라 주세요.';
    if (!d.freeStay && !d.priceNight && !d.priceWeek && !d.priceMonth) {
      return '요금을 하나 이상 적어 주세요. 받지 않으신다면 [요금을 받지 않습니다] 를 눌러 주세요.';
    }
    if (d.maxNights && d.maxNights < d.minNights) {
      return '최대 기간이 최소 기간보다 짧습니다. 다시 확인해 주세요.';
    }
    if (d.availableFrom && d.availableTo && d.availableTo < d.availableFrom) {
      return '가능한 기간의 끝이 시작보다 앞섭니다. 다시 확인해 주세요.';
    }
    if (!d.photos.length) return '사진을 한 장 이상 올려 주세요. 멀리서 오시는 분은 사진 말고 볼 방법이 없습니다.';
    if (d.desc.length < 20) return '소개를 조금 더 적어 주세요 (20자 이상).';
    if (!d.contactName) return '연락받으실 성함을 적어 주세요.';
    if (B.digits(d.contactPhone).length < 9) return '연락처를 확인해 주세요.';
    if (!d.contactHours) return '연락 가능 시간을 적어 주세요. 예배 중에 오는 전화를 줄여 줍니다.';
    if (!d.freeStay && !d.priceNight && !d.priceWeek && !d.priceMonth) {
      return '요금을 적어 주시거나, [무료로 내어 놓습니다] 를 골라 주세요.';
    }
    for (var i = 0; i < vows.length; i++) {
      if (vows[i] && !vows[i].checked) return '아래 확인 항목에 모두 체크해 주세요.';
    }
    return '';
  }

  function fillForm(r) {
    f.church.value = r.churchName || '';
    f.denom.value = r.denomination || '';
    f.title.value = r.title || '';
    f.roomType.value = r.roomType || 'private';
    f.bath.value = r.bath || 'private';
    f.guests.value = r.guestsMax || 2;
    f.rooms.value = r.rooms || 1;
    f.beds.value = r.beds || '';
    f.region.value = r.region || '';
    f.address.value = r.addressRough || '';
    f.nearest.value = r.nearest || '';
    f.free.checked = !!r.freeStay;
    if (!r.freeStay && el('ghFLicensed')) el('ghFLicensed').checked = true;
    syncFree();
    f.night.value = r.priceNight ? B.comma(r.priceNight) : '';
    f.week.value = r.priceWeek ? B.comma(r.priceWeek) : '';
    f.month.value = r.priceMonth ? B.comma(r.priceMonth) : '';
    f.deposit.value = r.deposit ? B.comma(r.deposit) : '';
    f.minNights.value = r.minNights || 1;
    f.maxNights.value = r.maxNights || '';
    f.from.value = (r.availableFrom || '').slice(0, 10);
    f.to.value = (r.availableTo || '').slice(0, 10);
    typeChecks.set(r.guestTypes);
    amenityChecks.set(r.amenities);
    langChecks.set(r.languages);
    f.rules.value = r.houseRules || '';
    f.desc.value = r.desc || '';
    f.name.value = r.contactName || '';
    f.phone.value = db.formatPhone(r.contactPhone || '');
    f.hours.value = r.contactHours || '';
    photos.set(Array.isArray(r.photos) ? r.photos : []);
    f.title.dispatchEvent(new Event('input'));
  }

  function resetForm() {
    el('ghForm').reset();
    photos.clear();
    typeChecks.set([]);
    amenityChecks.set([]);
    langChecks.set([]);
    syncFree();
    f.title.dispatchEvent(new Event('input'));
  }

  function openForm(editId) {
    B.say(el('ghFormErr'), '');
    B.say(el('ghFormOk'), '');
    el('ghEditId').value = editId || '';
    el('ghSubmit').textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';

    if (!B.gate('gh', function () { openForm(editId); })) return;

    if (!editId) { resetForm(); return; }

    var hit = mineRows.filter(function (r) { return r.id === editId; })[0];
    if (hit) { fillForm(hit); return; }
    db.myGuestHouses().then(function (list) {
      mineRows = list;
      var row = list.filter(function (r) { return r.id === editId; })[0];
      if (row) fillForm(row);
      else B.say(el('ghFormErr'), '고치실 글을 찾지 못했습니다.');
    });
  }

  el('ghForm').addEventListener('submit', function (e) {
    e.preventDefault();
    B.say(el('ghFormErr'), '');
    B.say(el('ghFormOk'), '');

    if (photos.busy()) {
      B.say(el('ghFormErr'), '사진을 아직 올리는 중입니다. 잠시만 기다려 주세요.');
      return;
    }

    var data = collect();
    var bad = validate(data);
    if (bad) {
      B.say(el('ghFormErr'), bad);
      el('ghFormErr').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var editId = el('ghEditId').value;
    var btn = el('ghSubmit');
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    var task = editId ? db.saveGuestHouse(editId, data) : db.submitGuestHouse(data);

    task.then(function () {
      B.say(el('ghFormOk'),
        editId
          ? '고친 내용을 보냈습니다. 관리자가 다시 확인한 뒤 게시됩니다.'
          : '등록 신청이 접수되었습니다. 관리자가 교회와 방을 확인한 뒤 게시됩니다.');
      resetForm();
      window.setTimeout(function () { window.location.hash = '#mine'; }, 1200);
    }).catch(function (err) {
      B.say(el('ghFormErr'), err.message || '등록하지 못했습니다.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';
    });
  });

  /* =========================================================
     화면 전환
     ========================================================= */

  var nav = B.router(
    { list: 'ghBoard', view: 'ghDetail', mine: 'ghMine', new: 'ghNew' },
    {
      list: function () { if (!loaded) load(); },
      view: function (id) {
        (loaded ? Promise.resolve() : load()).then(function () {
          var me = db.auth.current();
          var known = function () {
            return rows.concat(mineRows).some(function (r) { return r.id === id; });
          };
          if (known()) { renderDetail(id); return; }
          // 캐시에 없습니다 — 내가 올린 것과 목록을 한 번씩 더 읽어 봅니다.
          // (방금 올라온 글의 주소를 바로 열었을 때 "없습니다"가 뜨지 않도록)
          (me ? db.myGuestHouses() : Promise.resolve([])).then(function (list) {
            mineRows = list;
            if (known()) { renderDetail(id); return; }
            return load().then(function () { renderDetail(id); });
          });
        });
      },
      mine: renderMine,
      new: function () { openForm(''); },
      edit: function (id) { openForm(id); },
    },
    { bodyAttr: 'data-gh-pane' }
  );

  ['ghQ', 'ghRoomType', 'ghGuestType', 'ghRegion', 'ghFreeOnly'].forEach(function (id) {
    var node = el(id);
    if (!node) return;
    node.addEventListener('input', renderList);
    node.addEventListener('change', renderList);
  });

  db.auth.onChange(function () {
    var parts = nav.current();
    if (parts[0] === 'mine') renderMine();
    if (parts[0] === 'new' || parts[0] === 'edit') openForm(parts[1] || '');
  });

  syncFree();
  load().catch(function () {
    el('ghList').innerHTML = '';
    el('ghEmpty').hidden = false;
  });
  nav.route();
}());
