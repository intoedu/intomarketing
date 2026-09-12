/* =========================================================
   부동산 매물 게시판 (listings.html)

   화면은 주소창의 해시로 나뉩니다.
     #list        목록 (기본)
     #view/<id>   상세
     #new         등록  (#edit/<id> 로 열면 내가 올린 글 수정)
     #mine        내가 올린 매물

   센터는 게시판만 관리합니다. 여기서 중개나 상담은 하지 않습니다.
   ========================================================= */
(function () {
  'use strict';

  var board = document.getElementById('lsBoard');
  if (!board) return;

  var db = window.CAPSDB;

  var el = {
    board: board,
    detail: document.getElementById('lsDetail'),
    detailBody: document.getElementById('lsDetailBody'),
    mine: document.getElementById('lsMine'),
    mineBody: document.getElementById('lsMineBody'),
    newPane: document.getElementById('lsNew'),
    form: document.getElementById('lsForm'),
    gate: document.getElementById('lsGate'),
    gateLogin: document.getElementById('lsGateLogin'),
    list: document.getElementById('lsList'),
    empty: document.getElementById('lsEmpty'),
    count: document.getElementById('lsCount'),
    q: document.getElementById('lsQ'),
    kind: document.getElementById('lsKind'),
    use: document.getElementById('lsUse'),
    region: document.getElementById('lsRegion'),
    err: document.getElementById('lsFormErr'),
    ok: document.getElementById('lsFormOk'),
    submit: document.getElementById('lsSubmit'),
    editId: document.getElementById('lsEditId'),
    proofKind: document.getElementById('lsFProofKind'),
    proofHint: document.getElementById('lsProofHint'),
    proofFile: document.getElementById('lsFProof'),
    fileInfo: document.getElementById('lsFileInfo'),
    photoInput: document.getElementById('lsFPhotos'),
    photoGrid: document.getElementById('lsPhotoGrid'),
    photoStatus: document.getElementById('lsPhotoStatus'),
    useOtherBox: document.getElementById('lsUseOtherBox'),
    titleCount: document.getElementById('lsTitleCount'),
  };

  var rows = [];      // 공개 매물
  var mineRows = [];  // 내가 올린 매물
  var loaded = false;

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

  /* =========================================================
     목록
     ========================================================= */

  function card(r) {
    var v = db.listingView(r);
    var bits = [r.addressRough || r.region, r.area, r.floor]
      .filter(Boolean).map(esc).join(' · ');
    var cover = v.photos.length ? (v.photos[0].url || '') : '';

    return '<a class="ls-card' + (cover ? ' has-shot' : '') + '" href="#view/' + esc(r.id) + '">' +
      (cover
        ? '<span class="ls-card-shot">' +
            '<img src="' + esc(cover) + '" alt="" loading="lazy">' +
            (v.photos.length > 1
              ? '<span class="ls-shot-n">사진 ' + v.photos.length + '장</span>' : '') +
          '</span>'
        : '<span class="ls-card-noshot">사진이 없는 글입니다</span>') +
      '<span class="ls-card-body">' +
        '<span class="ls-card-top">' +
          '<span class="ls-tag ls-tag-' + esc(r.kind) + '">' + esc(v.kindLabel) + '</span>' +
          (v.useLabel ? '<span class="ls-tag is-soft">' + esc(v.useLabel) + '</span>' : '') +
          (v.days != null && v.days <= 7 ? '<span class="ls-tag is-warn">게시 ' + v.days + '일 남음</span>' : '') +
        '</span>' +
        '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
        '<p class="ls-card-meta">' + bits + '</p>' +
        '<strong class="ls-card-price">' + esc(db.listingPrice(r)) + '</strong>' +
        (r.contactHours
          ? '<p class="ls-card-hours">연락 ' + esc(r.contactHours) + '</p>' : '') +
        '<span class="ls-card-more">자세히 보기 →</span>' +
      '</span>' +
      '</a>';
  }

  function filtered() {
    var q = (el.q.value || '').trim().toLowerCase();
    var kind = el.kind.value;
    var use = el.use ? el.use.value : '';
    var region = el.region.value;

    return rows.filter(function (r) {
      if (kind && r.kind !== kind) return false;
      if (use && r.use !== use) return false;
      if (region && r.region !== region) return false;
      if (!q) return true;
      var hay = [r.title, r.region, r.addressRough, r.desc, r.area, r.useOther]
        .join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderList() {
    if (!loaded) return;
    var list = filtered();
    el.count.textContent = !list.length ? ''
      : list.length === rows.length ? '전체 ' + rows.length + '건'
      : rows.length + '건 중 ' + list.length + '건';
    el.list.innerHTML = list.map(card).join('');
    el.list.hidden = !list.length;
    el.empty.hidden = !!list.length;
    el.empty.querySelector('h2').textContent = rows.length
      ? '조건에 맞는 매물이 없습니다'
      : '아직 게시된 매물이 없습니다';
  }

  function load() {
    return db.publishedListings().then(function (list) {
      rows = list;
      loaded = true;
      renderList();
      return list;
    });
  }

  /* =========================================================
     상세
     ========================================================= */

  function dl(label, value) {
    if (!value) return '';
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  /** 사진 — 큰 사진 하나 + 아래 작은 사진들. 누르면 큰 사진이 바뀝니다. */
  function gallery(photos) {
    var list = (photos || []).filter(function (ph) { return ph && (ph.url || ph.path); });
    if (!list.length) return '';
    var thumbs = list.length < 2 ? '' :
      '<div class="ls-thumbs" id="lsThumbs">' +
        list.map(function (ph, i) {
          return '<button type="button" class="ls-thumb' + (i ? '' : ' is-on') +
            '" data-i="' + i + '" aria-label="사진 ' + (i + 1) + '번 보기">' +
            '<img src="' + esc(ph.url || '') + '" alt="" loading="lazy"></button>';
        }).join('') +
      '</div>';

    return '<figure class="ls-gallery">' +
      '<div class="ls-shot-main">' +
        '<img id="lsShotMain" src="' + esc(list[0].url || '') + '" alt="매물 사진 1">' +
        (list.length > 1 ? '<span class="ls-shot-count" id="lsShotCount">1 / ' + list.length + '</span>' : '') +
      '</div>' +
      thumbs +
      '<figcaption>사진은 등록자가 올린 것입니다. 실제 상태는 방문해 확인해 주세요.</figcaption>' +
      '</figure>';
  }

  function priceRows(r) {
    var m = db.money;
    var out = '';
    if (r.kind === 'sale') out += dl('매매가', m(r.salePrice) + '원');
    if (r.kind === 'rent_jeonse') out += dl('전세금', m(r.deposit) + '원');
    if (r.kind === 'rent_monthly') {
      out += dl('보증금', m(r.deposit) + '원');
      out += dl('월세', m(r.monthly) + '원');
    }
    if (r.kind === 'share') out += dl('대여료', r.monthly ? m(r.monthly) + '원' : '협의');
    if (r.maintenance) out += dl('관리비', m(r.maintenance) + '원 / 월');
    return out;
  }

  function renderDetail(id) {
    var hit = rows.concat(mineRows).filter(function (r) { return r.id === id; });
    if (!hit.length) {
      el.detailBody.innerHTML =
        '<div class="notice-card"><p>이 매물은 게시가 끝났거나 찾을 수 없습니다.</p></div>';
      return;
    }
    var r = hit[0];
    var v = db.listingView(r);
    var me = db.auth.current();
    var isMine = !!(me && r.userId === me.id);

    if (!v.live && !isMine && !db.isStaff()) {
      el.detailBody.innerHTML =
        '<div class="notice-card"><p>이 매물은 현재 게시 중이 아닙니다. (' + esc(v.label) + ')</p></div>';
      return;
    }

    el.detailBody.innerHTML =
      '<article class="ls-view">' +
        '<div class="ls-view-top">' +
          '<span class="ls-tag ls-tag-' + esc(r.kind) + '">' + esc(v.kindLabel) + '</span>' +
          (v.useLabel ? '<span class="ls-tag is-soft">' + esc(v.useLabel) + '</span>' : '') +
          '<span class="ls-tag is-check">' + esc(v.holderLabel) + ' 확인' + '</span>' +
        '</div>' +
        '<h1>' + esc(r.title || '(제목 없음)') + '</h1>' +
        '<p class="ls-view-price">' + esc(db.listingPrice(r)) + '</p>' +

        gallery(v.photos) +

        '<dl class="ls-dl">' +
          dl('위치', r.addressRough || r.region) +
          dl('면적', r.area) +
          dl('층', r.floor) +
          dl('주차', r.parking) +
          priceRows(r) +
          dl('입주 가능', r.moveIn) +
          dl('종교시설 사용', r.religiousUse) +
          dl('연락 가능 시간', r.contactHours) +
          dl('게시일', r.publishedAt ? db.formatDate(r.publishedAt, false) : '') +
          dl('게시 종료', r.expiresAt ? db.formatDate(r.expiresAt, false) : '') +
        '</dl>' +

        (r.desc ? '<div class="ls-desc"><h2>상세 설명</h2><p>' + nl2br(r.desc) + '</p></div>' : '') +

        '<div class="ls-contact">' +
          '<h2>연락처</h2>' +
          '<p class="ls-contact-who">' + esc(r.contactName || '등록자') + '</p>' +
          (r.contactHours
            ? '<p class="ls-contact-when">' +
                '<span class="ls-when-label">연락 가능 시간</span>' +
                '<strong>' + esc(r.contactHours) + '</strong>' +
              '</p>'
            : '') +
          '<a class="btn btn-primary btn-lg" href="tel:' + esc(digits(r.contactPhone)) + '">' +
            esc(db.formatPhone(r.contactPhone)) + ' 전화하기</a>' +
          '<p class="ls-contact-note">' +
            (r.contactHours
              ? '<strong>위 시간에 맞춰 연락해 주세요.</strong> 등록자가 사역 중일 수 있습니다.<br>'
              : '') +
            '연락과 협상, 계약은 등록자와 직접 진행하십니다. ' +
            '센터는 이 매물을 중개하지 않고, 내용의 정확성과 계약 결과를 보증하지 않습니다.' +
          '</p>' +
        '</div>' +

        (isMine
          ? '<div class="ls-owner-bar">' +
              '<span>내가 올린 매물입니다.</span>' +
              '<a class="btn btn-ghost btn-sm" href="#edit/' + esc(r.id) + '">내용 수정</a>' +
              '<a class="btn btn-ghost btn-sm" href="#mine">내 매물 목록</a>' +
            '</div>'
          : '') +
      '</article>';

    bindGallery(v.photos);
  }

  /** 썸네일을 누르면 큰 사진이 바뀝니다. */
  function bindGallery(photos) {
    var box = document.getElementById('lsThumbs');
    if (!box) return;
    var main = document.getElementById('lsShotMain');
    var count = document.getElementById('lsShotCount');
    var list = (photos || []).filter(function (ph) { return ph && (ph.url || ph.path); });

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('.ls-thumb');
      if (!btn) return;
      var i = Number(btn.getAttribute('data-i')) || 0;
      if (!list[i]) return;
      main.src = list[i].url || '';
      main.alt = '매물 사진 ' + (i + 1);
      if (count) count.textContent = (i + 1) + ' / ' + list.length;
      Array.prototype.forEach.call(box.querySelectorAll('.ls-thumb'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
    });
  }

  /* =========================================================
     내가 올린 매물
     ========================================================= */

  function mineCard(r) {
    var v = db.listingView(r);
    var fee = r.fee || {};
    var lines = '';

    if (v.status === 'pending') {
      lines += '<p class="ls-mine-note is-wait">' +
        '<strong>서류를 확인하고 있습니다.</strong> 아직 입금하지 않으셔도 됩니다.<br>' +
        '확인이 끝나면 <strong>입금 계좌를 카카오톡으로</strong> 보내드립니다. ' +
        '보통 영업일 1일 이내입니다.' +
        '</p>';
    }
    if (v.status === 'edit_pending') {
      lines += '<p class="ls-mine-note is-wait">' +
        '<strong>수정 승인을 기다리고 있습니다.</strong>' +
        (v.editRequestedAt ? ' (' + esc(db.formatDate(v.editRequestedAt)) + " 요청)" : '') + '<br>' +
        '확인하는 동안에는 게시판에서 잠시 내려가 있습니다. 바뀐 내용이 확인되면 다시 게시됩니다.<br>' +
        '<strong>등록비를 다시 내지 않으셔도 됩니다.</strong>' +
        '</p>';
    }
    if (v.status === 'awaiting_payment') {
      /* 카드 결제가 연결되어 있으면 그 자리에서 내실 수 있게 버튼을 답니다.
         연결 전(기본값)에는 아래 계좌 안내만 나가 지금과 똑같습니다. */
      var canCard = db.paymentEnabled();
      lines += '<p class="ls-mine-note is-pay">' +
        '<strong>서류 확인이 끝났습니다. ' + (canCard ? '등록비를 내주세요.' : '입금해 주세요.') + '</strong><br>' +
        '등록비 ' + db.money(fee.amount || db.LISTING_FEE) + '원 · ' +
        (canCard
          ? '카드로 내시면 <strong>바로 게시됩니다</strong>. 계좌 이체도 그대로 됩니다 — ' +
            '계좌는 카카오톡으로 보내드렸습니다.'
          : '계좌는 <strong>카카오톡으로 보내드렸습니다</strong>' +
            (fee.noticeSentAt ? ' (' + esc(db.formatDate(fee.noticeSentAt)) + ')' : '') + '.<br>' +
            '입금이 확인되면 바로 게시됩니다. 카카오톡을 못 받으셨으면 센터로 알려 주세요.') +
        '</p>';
      if (canCard) {
        lines += '<div class="ls-pay-act">' +
          '<button type="button" class="btn btn-primary btn-sm" data-pay="' + esc(r.id) + '">' +
            '카드로 ' + db.money(fee.amount || db.LISTING_FEE) + '원 결제하기</button>' +
          '<span class="ls-pay-hint">결제가 끝나면 바로 게시됩니다.</span>' +
          '</div>';
      }
    }
    if (v.status === 'rejected') {
      lines += '<p class="ls-mine-note is-no"><strong>반려 사유</strong> ' +
        esc(r.rejectNote || '(사유 없음)') +
        '<br>내용을 고쳐 다시 신청하시면 등록비를 다시 내지 않으셔도 됩니다.</p>';
    }
    if (v.status === 'hidden') {
      lines += '<p class="ls-mine-note is-no"><strong>게시가 중지되었습니다.</strong> ' +
        esc(r.rejectNote || '자세한 사유는 센터로 문의해 주세요.') + '</p>';
    }
    if (v.status === 'done') {
      lines += '<p class="ls-mine-note is-wait"><strong>거래 완료로 내려졌습니다.</strong> ' +
        '다시 올리시려면 [내용 수정] 에서 확인하신 뒤 다시 신청해 주세요.</p>';
    }
    if (v.status === 'expired') {
      lines += '<p class="ls-mine-note is-wait">게시 기간이 끝났습니다 (옛 기준). ' +
        '지금은 기한 없이 거래가 끝날 때까지 올라갑니다 — 다시 신청해 주세요.</p>';
    }
    if (v.status === 'published') {
      lines += '<p class="ls-mine-note is-ok"><strong>게시 중입니다.</strong> ' +
        '기한은 없습니다 — 거래가 끝날 때까지 올라가 있습니다.' +
        (v.up != null ? ' (게시한 지 ' + v.up + '일)' : '') +
        '<br>거래가 끝나면 아래 <strong>[거래 완료]</strong> 를 눌러 내려 주세요. ' +
        '내리지 않으면 계속 문의 전화가 옵니다.' +
        (v.days != null ? '<br>옛 기준 기한이 ' + v.days + '일 남아 있습니다.' : '') +
        '</p>';
    }

    return '<div class="ls-mine-card">' +
      '<div class="ls-mine-head">' +
        '<span class="ls-state is-' + esc(v.cls) + '">' + esc(v.label) + '</span>' +
        '<strong>' + esc(r.title || '(제목 없음)') + '</strong>' +
        '<span class="ls-mine-price">' + esc(db.listingPrice(r)) + '</span>' +
      '</div>' +
      '<p class="ls-mine-meta">' +
        esc(v.kindLabel) + ' · ' + esc(r.addressRough || r.region || '') +
        ' · 등록 ' + esc(db.formatDate(r.createdAt, false)) +
        ' · 사진 ' + v.photos.length + '장' +
        ' · 등록비 ' + (fee.paid ? '입금 확인' : '미확인') +
      '</p>' +
      lines +
      '<div class="ls-mine-act">' +
        (v.status === 'published'
          ? '<a class="btn btn-ghost btn-sm" href="#view/' + esc(r.id) + '">게시된 모습 보기</a>' +
            '<button type="button" class="btn btn-primary btn-sm" data-done="' + esc(r.id) + '">거래 완료</button>'
          : '') +
        '<a class="btn btn-ghost btn-sm" href="#edit/' + esc(r.id) + '">내용 수정</a>' +
        '<button type="button" class="btn btn-ghost btn-sm is-danger" data-del="' + esc(r.id) + '">삭제</button>' +
      '</div>' +
      '</div>';
  }

  function renderMine() {
    var me = db.auth.current();
    if (!me) {
      el.mineBody.innerHTML =
        '<div class="auth-gate"><p>내가 올린 매물을 보려면 로그인해 주세요.</p>' +
        '<button type="button" class="btn btn-primary" id="lsMineLogin">로그인 · 회원가입</button></div>';
      var b = document.getElementById('lsMineLogin');
      if (b) {
        b.addEventListener('click', function () {
          if (window.CAPSAuthUI) window.CAPSAuthUI.require().then(renderMine);
        });
      }
      return;
    }

    el.mineBody.innerHTML = '<p class="ls-loading">불러오는 중입니다…</p>';
    db.myListings().then(function (list) {
      mineRows = list;
      if (!list.length) {
        el.mineBody.innerHTML =
          '<div class="notice-card"><p>아직 올리신 매물이 없습니다.</p>' +
          '<p><a class="btn btn-primary" href="#new">매물 등록하기</a></p></div>';
        return;
      }
      el.mineBody.innerHTML = list.map(mineCard).join('');
    });
  }

  if (el.mineBody) {
    /* 거래 완료 — 팔린 것을 아는 사람은 등록자이므로 직접 내리실 수 있게 합니다. */
    el.mineBody.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-done]');
      if (!btn) return;
      var id = btn.getAttribute('data-done');
      if (!window.confirm('거래가 끝난 것으로 목록에서 내립니다.\n' +
        '게시판에서는 바로 보이지 않게 되고, 내 매물에는 [거래 완료] 로 남습니다.\n' +
        '다시 올리시려면 내용을 고쳐 재신청하시면 됩니다. 계속하시겠습니까?')) return;
      btn.disabled = true;
      db.markListingDone(id).then(function () {
        renderMine();
        load();
      }).catch(function (err) {
        btn.disabled = false;
        window.alert(err.message || '처리하지 못했습니다.');
      });
    });

    /* 카드 결제 — 스위치가 꺼져 있으면 버튼 자체가 없어 여기까지 오지 않습니다. */
    el.mineBody.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pay]');
      if (!btn) return;
      var id = btn.getAttribute('data-pay');
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = '결제창을 여는 중…';

      db.openPayment('listing_fee', id)
        .then(function (pay) {
          return payWithPg(pay).then(function (providerPaymentId) {
            btn.textContent = '결제를 확인하는 중…';
            return db.confirmPayment(pay.orderId || pay.order_id, providerPaymentId);
          });
        })
        .then(function () {
          window.alert('결제가 끝났습니다. 매물이 게시되었습니다.');
          renderMine();
          load();
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = original;
          // 이용자가 결제창을 닫은 것은 오류가 아닙니다.
          if (err && err.canceled) return;
          window.alert(err.message || '결제하지 못했습니다.');
        });
    });

    el.mineBody.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      var id = btn.getAttribute('data-del');
      var hit = mineRows.filter(function (r) { return r.id === id; })[0];
      if (!hit) return;
      if (!window.confirm('이 매물을 삭제합니다. 올려 주신 서류도 함께 지워집니다.\n되돌릴 수 없습니다. 계속하시겠습니까?')) return;
      btn.disabled = true;
      db.deleteListing(hit).then(function () {
        renderMine();
        load();
      }).catch(function (err) {
        btn.disabled = false;
        window.alert(err.message || '삭제하지 못했습니다.');
      });
    });
  }

  /* =========================================================
     등록 · 수정 폼
     ========================================================= */

  var f = {
    kind: document.getElementById('lsFKind'),
    use: document.getElementById('lsFUse'),
    title: document.getElementById('lsFTitle'),
    region: document.getElementById('lsFRegion'),
    addr: document.getElementById('lsFAddr'),
    area: document.getElementById('lsFArea'),
    floor: document.getElementById('lsFFloor'),
    parking: document.getElementById('lsFParking'),
    moveIn: document.getElementById('lsFMoveIn'),
    religious: document.getElementById('lsFReligious'),
    deposit: document.getElementById('lsFDeposit'),
    monthly: document.getElementById('lsFMonthly'),
    sale: document.getElementById('lsFSale'),
    maint: document.getElementById('lsFMaint'),
    desc: document.getElementById('lsFDesc'),
    name: document.getElementById('lsFName'),
    phone: document.getElementById('lsFPhone'),
    hours: document.getElementById('lsFHours'),
    useOther: document.getElementById('lsFUseOther'),
  };

  /* 폼에 담긴 사진 목록 (아직 저장되지 않은 것도 포함) */
  var photos = [];

  var vows = ['lsVow1', 'lsVow2', 'lsVow3', 'lsVow4'].map(function (id) {
    return document.getElementById(id);
  });

  if (f.phone) db.bindPhoneInput(f.phone);

  /* 제목 글자 수 */
  if (f.title && el.titleCount) {
    var countTitle = function () {
      el.titleCount.textContent = f.title.value.length;
    };
    f.title.addEventListener('input', countTitle);
    countTitle();
  }

  /* 예시 칩 — 누르면 그대로 채워 넣습니다 (그 뒤 고쳐 쓰시면 됩니다). */
  Array.prototype.forEach.call(document.querySelectorAll('.ls-eg:not(.is-pick)'), function (box) {
    var target = document.getElementById(box.getAttribute('data-eg'));
    if (!target) return;
    box.addEventListener('click', function (e) {
      var chip = e.target.closest('.ls-eg-chip');
      if (!chip) return;
      target.value = chip.textContent;
      target.focus();
      target.dispatchEvent(new Event('input'));
    });
  });

  /* 연락 가능 시간 — 조각을 눌러 여러 개를 더합니다.
     교회 일정은 대개 "언제 되고, 언제는 안 된다" 두 가지라, 그대로 나눠 두었습니다.
     넣은 뒤에는 그냥 글자이므로 시간을 직접 고치실 수 있고,
     고쳐 쓰신 내용은 다음에 칩을 눌러도 지우지 않고 뒤에 덧붙입니다. */
  Array.prototype.forEach.call(document.querySelectorAll('.ls-eg.is-pick'), function (box) {
    var target = document.getElementById(box.getAttribute('data-eg'));
    if (!target) return;

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
        c.classList.toggle('is-on', list.indexOf(c.textContent.trim()) > -1);
        c.setAttribute('aria-pressed', list.indexOf(c.textContent.trim()) > -1 ? 'true' : 'false');
      });
    }

    box.addEventListener('click', function (e) {
      var chip = e.target.closest('.ls-eg-chip');
      if (!chip) return;

      var kind = chip.getAttribute('data-add');
      var txt = chip.textContent.trim();
      var now = target.value.trim();

      if (now && now !== composed.trim()) {
        // 직접 쓰신 글이 있습니다 — 지우지 않고 뒤에 붙입니다.
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

  /* 주 용도 '기타' → 직접 입력칸 */
  function syncUse() {
    if (!f.use || !el.useOtherBox) return;
    var other = f.use.value === 'other';
    el.useOtherBox.hidden = !other;
    if (f.useOther) {
      f.useOther.disabled = !other;
      if (!other) f.useOther.value = '';
    }
  }
  if (f.use) f.use.addEventListener('change', syncUse);

  /* 금액칸 — 숫자만 받고 콤마를 넣어 줍니다. 힌트에 '○○만원'을 함께 보여 줍니다. */
  function bindMoney(input) {
    if (!input) return;
    var hint = document.getElementById(input.id + 'Hint');
    var base = hint ? hint.textContent : '';
    var show = function () {
      var n = Number(digits(input.value)) || 0;
      input.value = n ? n.toLocaleString('ko-KR') : '';
      if (!hint) return;
      if (!n) { hint.textContent = base; return; }
      var eok = Math.floor(n / 1e8);
      var man = Math.floor((n % 1e8) / 1e4);
      hint.textContent = (eok ? eok + '억 ' : '') + (man ? man + '만' : '') + '원' +
        (base ? ' · ' + base : '');
    };
    input.addEventListener('input', show);
    input.addEventListener('blur', show);
    input._show = show;
  }

  [f.deposit, f.monthly, f.sale, f.maint].forEach(bindMoney);

  /** 종류에 따라 금액칸을 보이고 숨깁니다. */
  function syncKind() {
    var kind = f.kind.value;
    Array.prototype.forEach.call(document.querySelectorAll('.ls-money'), function (box) {
      var list = (box.getAttribute('data-kinds') || '').split(/\s+/);
      var on = list.indexOf(kind) > -1;
      box.hidden = !on;
      var input = box.querySelector('input');
      if (input) input.disabled = !on;
    });
    var dep = document.querySelector('label[for="lsFDeposit"]');
    if (dep) dep.textContent = kind === 'rent_jeonse' ? '전세금' : '보증금';
    var mon = document.querySelector('label[for="lsFMonthly"]');
    if (mon) mon.textContent = kind === 'share' ? '대여료 (월)' : '월세';
  }

  if (f.kind) f.kind.addEventListener('change', syncKind);

  /** 입장(소유자·세입자·대리인)에 맞는 서류 목록만 보여 줍니다. */
  function holderValue() {
    var on = document.querySelector('input[name="lsHolder"]:checked');
    return on ? on.value : 'owner';
  }

  var HOLDER_HINT = {
    owner: '소유자는 등기부등본이 가장 확실합니다. 인터넷등기소에서 발급한 PDF 를 그대로 올리셔도 됩니다.',
    tenant: '지금 쓰고 있는 공간이라면 임대차계약서로 확인합니다. 계약 당사자 이름이 보이도록 올려 주세요.',
    agent: '위임장과 함께 위임인의 권리 서류(등기부등본 또는 임대차계약서)를 올려 주세요.',
  };

  function syncHolder() {
    var holder = holderValue();
    var keys = db.PROOF_FOR[holder] || Object.keys(db.LISTING_PROOFS);
    var current = el.proofKind.value;
    el.proofKind.innerHTML = keys.map(function (k) {
      return '<option value="' + k + '">' + esc(db.LISTING_PROOFS[k]) + '</option>';
    }).join('');
    if (keys.indexOf(current) > -1) el.proofKind.value = current;
    el.proofHint.textContent = HOLDER_HINT[holder] || '';
  }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="lsHolder"]'), function (r) {
    r.addEventListener('change', syncHolder);
  });

  /* =========================================================
     사진 — 고르면 바로 올리고, 미리보기를 보여 줍니다.
     증빙 서류와 달리 사진은 게시판에 그대로 공개됩니다.
     ========================================================= */

  function photoNote(msg, cls) {
    if (!el.photoStatus) return;
    el.photoStatus.hidden = !msg;
    el.photoStatus.className = 'ls-photo-status' + (cls ? ' ' + cls : '');
    el.photoStatus.innerHTML = msg || '';
  }

  function renderPhotos() {
    if (!el.photoGrid) return;
    var max = db.PHOTO_MAX_COUNT;

    el.photoGrid.innerHTML = photos.map(function (ph, i) {
      return '<div class="ls-shot' + (i ? '' : ' is-cover') + '">' +
        '<img src="' + esc(ph.url || '') + '" alt="사진 ' + (i + 1) + '">' +
        (i ? '' : '<span class="ls-shot-badge">대표 사진</span>') +
        '<div class="ls-shot-act">' +
          (i ? '<button type="button" data-up="' + i + '" title="앞으로">←</button>' : '') +
          (i < photos.length - 1 ? '<button type="button" data-down="' + i + '" title="뒤로">→</button>' : '') +
          '<button type="button" class="is-danger" data-rm="' + i + '" title="삭제">✕</button>' +
        '</div>' +
        '</div>';
    }).join('');

    if (el.photoInput) {
      el.photoInput.disabled = photos.length >= max;
      var label = document.querySelector('.ls-photo-add');
      if (label) label.classList.toggle('is-full', photos.length >= max);
    }

    var rec = db.PHOTO_MIN_HINT + '~' + db.PHOTO_REC_TOP + '장';

    if (!photos.length) {
      photoNote('아직 올린 사진이 없습니다. ' + rec +
        '이면 충분하고, 최대 ' + max + '장까지 올리실 수 있습니다.', 'is-wait');
    } else if (photos.length >= max) {
      photoNote('<strong>' + photos.length + '장</strong> — 최대치입니다. ' +
        '바꾸시려면 먼저 지워 주세요.', 'is-full');
    } else {
      photoNote('<strong>' + photos.length + '장</strong> 올렸습니다. ' +
        (photos.length < db.PHOTO_MIN_HINT
          ? rec + '을 권합니다. '
          : '') +
        '앞으로 ' + (max - photos.length) + '장 더 올리실 수 있습니다.', 'is-ok');
    }
  }

  if (el.photoInput) {
    el.photoInput.addEventListener('change', function () {
      var picked = Array.prototype.slice.call(el.photoInput.files || []);
      el.photoInput.value = '';
      if (!picked.length) return;

      var room = db.PHOTO_MAX_COUNT - photos.length;
      if (room <= 0) {
        photoNote('사진은 최대 ' + db.PHOTO_MAX_COUNT + '장까지입니다.', 'is-bad');
        return;
      }
      var over = picked.length - room;
      var files = picked.slice(0, room);

      // 한 장씩 차례로 올립니다 (한꺼번에 올리면 느린 회선에서 실패가 잦습니다).
      var done = 0;
      var failed = [];
      var step = function (i) {
        if (i >= files.length) {
          renderPhotos();
          // renderPhotos() 가 이미 장수를 알려 주므로, 덧붙일 말이 있을 때만 덮어씁니다.
          if (failed.length) {
            photoNote('올리지 못한 사진 ' + failed.length + '장: ' + esc(failed.join(', ')), 'is-bad');
          } else if (over > 0) {
            photoNote('<strong>' + photos.length + '장</strong> — ' +
              (photos.length >= db.PHOTO_MAX_COUNT ? '최대치입니다. ' : '') +
              '한 번에 고른 사진 중 ' + over + '장은 최대 ' + db.PHOTO_MAX_COUNT +
              '장을 넘어 넣지 않았습니다.', 'is-full');
          }
          return;
        }
        photoNote('사진 올리는 중… (' + (i + 1) + ' / ' + files.length + ')', 'is-wait');
        db.uploadPhoto(files[i]).then(function (ph) {
          photos.push(ph);
          done++;
          renderPhotos();
          step(i + 1);
        }).catch(function (err) {
          failed.push((files[i].name || '사진') + ' — ' + (err.message || '실패'));
          step(i + 1);
        });
      };
      step(0);
    });
  }

  if (el.photoGrid) {
    el.photoGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-rm], button[data-up], button[data-down]');
      if (!btn) return;
      var swap = function (a, b) {
        var t = photos[a]; photos[a] = photos[b]; photos[b] = t;
      };
      if (btn.hasAttribute('data-up')) {
        var u = Number(btn.getAttribute('data-up'));
        swap(u, u - 1);
      } else if (btn.hasAttribute('data-down')) {
        var d2 = Number(btn.getAttribute('data-down'));
        swap(d2, d2 + 1);
      } else {
        var i = Number(btn.getAttribute('data-rm'));
        var gone = photos.splice(i, 1)[0];
        // 아직 저장 전이라 파일도 함께 지웁니다.
        db.deletePhoto(gone);
      }
      renderPhotos();
    });
  }

  /* 파일 선택 — 형식과 용량을 바로 확인해 알려 줍니다. */
  if (el.proofFile) {
    el.proofFile.addEventListener('change', function () {
      var file = el.proofFile.files && el.proofFile.files[0];
      el.fileInfo.hidden = !file;
      if (!file) return;
      var bad = db.checkProof(file);
      el.fileInfo.className = 'ls-file' + (bad ? ' is-bad' : ' is-ok');
      el.fileInfo.textContent = bad
        ? bad
        : file.name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + 'KB — 확인했습니다.';
    });
  }

  function say(box, msg) {
    if (!box) return;
    box.hidden = !msg;
    box.innerHTML = msg || '';
  }

  function fillForm(r) {
    el.editId.value = r ? r.id : '';
    var v = r || {};
    f.kind.value = v.kind || 'rent_monthly';
    f.use.value = v.use || 'church';
    if (f.useOther) f.useOther.value = v.useOther || '';
    syncUse();
    f.title.value = v.title || '';
    if (el.titleCount) el.titleCount.textContent = f.title.value.length;
    f.region.value = v.region || '';
    f.addr.value = v.addressRough || '';
    f.area.value = v.area || '';
    f.floor.value = v.floor || '';
    f.parking.value = v.parking || '';
    f.moveIn.value = v.moveIn || '';
    f.religious.value = v.religiousUse || '';
    f.deposit.value = v.deposit ? Number(v.deposit).toLocaleString('ko-KR') : '';
    f.monthly.value = v.monthly ? Number(v.monthly).toLocaleString('ko-KR') : '';
    f.sale.value = v.salePrice ? Number(v.salePrice).toLocaleString('ko-KR') : '';
    f.maint.value = v.maintenance ? Number(v.maintenance).toLocaleString('ko-KR') : '';
    f.desc.value = v.desc || '';

    var me = db.auth.current() || {};
    f.name.value = v.contactName || me.name || '';
    f.phone.value = v.contactPhone || me.phone || '';
    if (f.hours) f.hours.value = v.contactHours || '';

    photos = Array.isArray(v.photos) ? v.photos.slice() : [];
    renderPhotos();

    var holder = v.holder || 'owner';
    Array.prototype.forEach.call(document.querySelectorAll('input[name="lsHolder"]'), function (radio) {
      radio.checked = radio.value === holder;
    });
    syncHolder();
    if (v.proof && v.proof.kind) el.proofKind.value = v.proof.kind;
    syncKind();
    [f.deposit, f.monthly, f.sale, f.maint].forEach(function (i) { if (i && i._show) i._show(); });

    // 수정할 때는 이미 확인된 서류가 있으므로 다시 올리지 않아도 됩니다.
    var keep = !!(r && r.proof && r.proof.path);
    el.proofFile.required = !keep;
    el.fileInfo.hidden = !keep;
    if (keep) {
      el.fileInfo.className = 'ls-file is-ok';
      el.fileInfo.textContent = '이미 올린 서류: ' + (r.proof.name || '파일') +
        ' — 바꾸실 때만 새로 선택하세요.';
    }
    el.proofFile.value = '';

    vows.forEach(function (c) { if (c) c.checked = !!r; });
    el.submit.textContent = r ? '수정 신청하기' : '등록 신청하기';
    say(el.err, '');
    say(el.ok, '');
  }

  /* 쓰다 만 내용이 있는지 — 있으면 함부로 비우지 않습니다. */
  function formDirty() {
    if (photos.length) return true;
    if (el.proofFile && el.proofFile.files && el.proofFile.files.length) return true;
    var typed = [f.title, f.addr, f.area, f.floor, f.parking, f.moveIn, f.religious,
      f.deposit, f.monthly, f.sale, f.maint, f.desc, f.hours];
    for (var i = 0; i < typed.length; i++) {
      if (typed[i] && String(typed[i].value || '').trim()) return true;
    }
    // 이름 · 연락처는 계정 정보로 미리 채워지므로, 그것과 달라졌을 때만 셉니다.
    var me = db.auth.current() || {};
    if (f.name && f.name.value.trim() && f.name.value.trim() !== (me.name || '')) return true;
    if (f.phone && f.phone.value.trim() && f.phone.value.trim() !== (me.phone || '')) return true;
    return false;
  }

  function openForm(editId) {
    var me = db.auth.current();
    el.gate.hidden = !!me;
    el.form.hidden = !me;
    if (!me) return;

    // 같은 화면을 다시 여는 것이고 이미 쓰고 계신 내용이 있으면 그대로 둡니다.
    // (탭을 옮겼다 돌아오거나 로그인 상태를 다시 확인할 때 여기까지 옵니다.)
    // 다른 매물을 수정하러 오신 경우에는 바꿔 채워야 하므로 대상이 같을 때만 지킵니다.
    if ((el.editId.value || '') === (editId || '') && formDirty()) return;

    if (!editId) { fillForm(null); return; }
    el.form.hidden = true;
    db.myListings().then(function (list) {
      mineRows = list;
      var hit = list.filter(function (r) { return r.id === editId; })[0];
      el.form.hidden = false;
      if (!hit) {
        fillForm(null);
        say(el.err, '수정할 매물을 찾지 못했습니다. 새로 등록하는 화면으로 열었습니다.');
        return;
      }
      fillForm(hit);
    });
  }

  if (el.gateLogin) {
    el.gateLogin.addEventListener('click', function () {
      if (!window.CAPSAuthUI) return;
      window.CAPSAuthUI.require().then(function (user) {
        if (user) openForm(el.editId.value || '');
      });
    });
  }

  function collect() {
    var kind = f.kind.value;
    var num = function (input) { return Number(digits(input.value)) || 0; };
    return {
      kind: kind,
      use: f.use.value,
      useOther: f.use.value === 'other' && f.useOther ? f.useOther.value.trim() : '',
      holder: holderValue(),
      title: f.title.value.trim(),
      region: f.region.value,
      addressRough: f.addr.value.trim(),
      area: f.area.value.trim(),
      floor: f.floor.value.trim(),
      parking: f.parking.value.trim(),
      moveIn: f.moveIn.value.trim(),
      religiousUse: f.religious.value.trim(),
      deposit: kind === 'rent_monthly' || kind === 'rent_jeonse' ? num(f.deposit) : 0,
      monthly: kind === 'rent_monthly' || kind === 'share' ? num(f.monthly) : 0,
      salePrice: kind === 'sale' ? num(f.sale) : 0,
      maintenance: kind === 'sale' ? 0 : num(f.maint),
      desc: f.desc.value.trim(),
      contactName: f.name.value.trim(),
      contactPhone: db.formatPhone(f.phone.value),
      contactHours: f.hours ? f.hours.value.trim() : '',
      photos: photos.slice(),
    };
  }

  /** 저장 전 확인 — 통과하면 빈 문자열 */
  function validate(data, hasProof) {
    if (!data.title) return '제목을 적어 주세요.';
    if (data.use === 'other' && !data.useOther) return '주 용도를 직접 입력해 주세요.';
    if (!data.region) return '지역을 선택해 주세요.';
    if (!data.addressRough) return '위치를 동 단위까지 적어 주세요.';
    if (!data.desc) return '상세 설명을 적어 주세요.';
    if (!data.contactName) return '연락받을 성함을 적어 주세요.';
    if (!db.isValidPhone(data.contactPhone)) return '연락처를 다시 확인해 주세요.';
    if (!data.contactHours) {
      return '연락 가능 시간을 적어 주세요. 보시는 분이 이 시간을 확인하고 전화합니다.';
    }
    if (data.photos.length > db.PHOTO_MAX_COUNT) {
      return '사진은 최대 ' + db.PHOTO_MAX_COUNT + '장까지입니다.';
    }
    if (data.kind === 'sale' && !data.salePrice) return '매매가를 적어 주세요.';
    if (data.kind === 'rent_jeonse' && !data.deposit) return '전세금을 적어 주세요.';
    if (data.kind === 'rent_monthly' && !data.monthly) return '월세를 적어 주세요.';
    if (!hasProof) return '권리를 확인할 수 있는 서류를 첨부해 주세요.';
    if (vows.some(function (c) { return c && !c.checked; })) {
      return '아래 확인 항목 네 가지에 모두 동의해 주셔야 등록됩니다.';
    }
    return '';
  }

  if (el.form) {
    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      say(el.err, '');
      say(el.ok, '');

      var editId = el.editId.value;
      var existing = editId
        ? mineRows.filter(function (r) { return r.id === editId; })[0]
        : null;
      var file = el.proofFile.files && el.proofFile.files[0];
      var keptProof = existing && existing.proof && existing.proof.path ? existing.proof : null;

      var data = collect();
      var bad = validate(data, !!(file || keptProof));
      if (bad) { say(el.err, esc(bad)); return; }

      if (file) {
        var fileBad = db.checkProof(file);
        if (fileBad) { say(el.err, esc(fileBad)); return; }
      }

      el.submit.disabled = true;
      el.submit.textContent = file ? '서류를 올리는 중…' : '저장 중…';

      var step = file
        ? db.uploadProof(file, el.proofKind.value)
        : Promise.resolve(Object.assign({}, keptProof, { kind: el.proofKind.value }));

      // 전에 게시된 적이 있는 글을 고치는 것이면 안내 문구가 달라집니다.
      var isEditOfLive = !!(editId && existing &&
        (existing.firstPublishedAt || existing.publishedAt));

      step.then(function (proof) {
        if (editId && existing) {
          return db.saveListing(editId, Object.assign({}, data, { proof: proof }), existing);
        }
        return db.submitListing(data, proof);
      }).then(function () {
        say(el.ok, isEditOfLive
          ? '<strong>수정 승인을 요청했습니다.</strong> 확인하는 동안에는 게시판에서 잠시 내려갑니다.<br>' +
            '관리자가 바뀐 내용을 확인하면 다시 게시됩니다. ' +
            '<em>등록비를 다시 내지 않으셔도 됩니다.</em><br>' +
            '진행 상태는 <a href="#mine">내가 올린 매물</a> 에서 보실 수 있습니다.'
          : '<strong>접수되었습니다.</strong> 아직 공개되지 않은 <em>승인 대기</em> 상태입니다.<br>' +
            '관리자가 서류를 확인하고 승인하면 <strong>입금 계좌를 카카오톡으로 보내드립니다.</strong> ' +
            '입금이 확인되면 게시글이 올라갑니다. <em>지금 입금하지 않으셔도 됩니다.</em><br>' +
            '진행 상태는 <a href="#mine">내가 올린 매물</a> 에서 보실 수 있습니다.');
        el.submit.disabled = false;
        el.submit.textContent = '등록 신청하기';
        el.editId.value = '';
        window.setTimeout(function () { go('#mine'); }, 1400);
      }).catch(function (err) {
        say(el.err, esc(err.message || '등록하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
        el.submit.disabled = false;
        el.submit.textContent = editId ? '수정 신청하기' : '등록 신청하기';
      });
    });
  }


  /**
   * PG 결제창을 띄우고, 끝나면 PG 가 준 결제 번호를 돌려줍니다.
   *
   * 계약 전에는 이 자리에 올 일이 없습니다 (버튼이 안 그려집니다).
   * 계약 후에는 site.payment.sdk 에 적어 둔 SDK 를 한 번 읽어 씁니다.
   * PG 를 바꾸시면 이 함수와 Edge Function 의 verifyWithPg 두 곳만 고치면 됩니다.
   */
  function payWithPg(pay) {
    var cfg = db.paymentConfig();
    var orderId = pay.orderId || pay.order_id;
    var amount = pay.amount;
    var title = pay.targetTitle || pay.target_title || '매물 등록비';

    return loadSdk(cfg.sdk).then(function () {
      if (cfg.provider === 'portone' && window.PortOne) {
        return window.PortOne.requestPayment({
          storeId: cfg.storeId,
          channelKey: cfg.channelKey,
          paymentId: orderId,
          orderName: title,
          totalAmount: amount,
          currency: 'CURRENCY_KRW',
          payMethod: 'CARD',
        }).then(function (res) {
          if (res && res.code) {
            var e = new Error(res.message || '결제가 취소되었습니다.');
            e.canceled = true;
            throw e;
          }
          return (res && res.paymentId) || orderId;
        });
      }
      throw new Error('결제 수단이 설정되지 않았습니다. 센터로 알려 주세요.');
    });
  }

  /** SDK 를 한 번만 읽습니다. */
  var sdkLoaded = null;
  function loadSdk(src) {
    if (!src) return Promise.reject(new Error('결제 SDK 주소가 설정되지 않았습니다.'));
    if (sdkLoaded) return sdkLoaded;
    sdkLoaded = new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = function () { reject(new Error('결제 모듈을 불러오지 못했습니다.')); };
      document.head.appendChild(el);
    });
    return sdkLoaded;
  }

  /* =========================================================
     화면 전환 (해시 라우팅)
     ========================================================= */

  function show(pane) {
    el.board.hidden = pane !== 'list';
    el.detail.hidden = pane !== 'view';
    el.mine.hidden = pane !== 'mine';
    el.newPane.hidden = pane !== 'new';
    // 목록이 아닐 때는 큰 머리말을 접습니다 (같은 문구를 두 번 읽지 않도록).
    document.body.setAttribute('data-ls-pane', pane);
  }

  function go(hash) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  }

  function route() {
    var hash = (window.location.hash || '').replace(/^#/, '');
    var parts = hash.split('/');

    if (parts[0] === 'view' && parts[1]) {
      show('view');
      // 목록을 아직 못 읽었으면 먼저 읽고 그립니다.
      (loaded ? Promise.resolve() : load()).then(function () {
        var me = db.auth.current();
        var known = rows.concat(mineRows).some(function (r) { return r.id === parts[1]; });
        if (known || !me) { renderDetail(parts[1]); return; }
        db.myListings().then(function (list) {
          mineRows = list;
          renderDetail(parts[1]);
        });
      });
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === 'new' || parts[0] === 'edit') {
      show('new');
      openForm(parts[0] === 'edit' ? parts[1] || '' : '');
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === 'mine') {
      show('mine');
      renderMine();
      window.scrollTo(0, 0);
      return;
    }
    show('list');
    if (!loaded) load();
  }

  window.addEventListener('hashchange', route);

  [el.q, el.kind, el.use, el.region].forEach(function (input) {
    if (input) input.addEventListener('input', renderList);
    if (input) input.addEventListener('change', renderList);
  });

  /* 로그인 상태가 바뀌면 열려 있는 화면을 다시 그립니다. */
  db.auth.onChange(function () {
    var hash = (window.location.hash || '').replace(/^#/, '').split('/');
    if (hash[0] === 'mine') renderMine();
    if (hash[0] === 'new' || hash[0] === 'edit') openForm(hash[0] === 'edit' ? hash[1] || '' : '');
  });

  syncKind();
  syncHolder();
  load().catch(function () {
    el.list.innerHTML = '';
    el.empty.hidden = false;
  });
  route();
}());
