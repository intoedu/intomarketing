/* =========================================================
   중고 장터 (market.html)

     #list          목록 (기본)
     #view/<id>     상세
     #new           등록 (#edit/<id> 로 열면 내가 올린 글 수정)
     #mine          내가 올린 물건
     #install       설치 대행 신청 (#install/<물건 id> 로 열면 그 물건이 채워집니다)

   센터는 물건을 팔지 않습니다. 게시판을 관리하고, 사시는 교회가 원하면
   철거 · 운반 · 설치 · 튜닝을 맡습니다 — 그것이 센터의 몫입니다.
   ========================================================= */
(function () {
  'use strict';

  var B = window.CAPSBoard;
  if (!B || !document.getElementById('mkBoard')) return;

  var db = B.db;
  var esc = B.esc;
  var el = B.el;

  var BOARD = window.CAPS_MARKET_BOARD || {};
  var PHOTO_MAX = Number(BOARD.photoMax) || db.MARKET_PHOTO_MAX;
  var PHOTO_MIN = Number(BOARD.photoMin) || 3;

  var rows = [];      // 게시 중인 물건
  var mineRows = [];  // 내가 올린 것
  var loaded = false;

  var photos = B.photoBox('mk', PHOTO_MAX, PHOTO_MIN);

  /* =========================================================
     목록
     ========================================================= */

  function card(r) {
    var v = db.marketView(r);
    var cover = v.photos.length ? (v.photos[0].url || '') : '';
    var bits = [v.categoryLabel, r.addressRough || r.region, v.conditionLabel]
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
          '<span class="ls-tag ls-tag-' + esc(r.category) + '">' + esc(v.categoryLabel) + '</span>' +
          (r.freeGiveaway ? '<span class="ls-tag is-gold">무료 나눔</span>' : '') +
          (v.installable ? '<span class="ls-tag is-soft">설치 가능</span>' : '') +
        '</span>' +
        '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
        '<p class="ls-card-meta">' + bits + '</p>' +
        '<strong class="ls-card-price">' + esc(db.marketPrice(r)) + '</strong>' +
        (Number(r.quantity) > 1 ? '<p class="ls-card-hours">수량 ' + Number(r.quantity) + '개</p>' : '') +
        '<span class="ls-card-more">자세히 보기 →</span>' +
      '</span>' +
      '</a>';
  }

  function filtered() {
    var q = (el('mkQ').value || '').trim().toLowerCase();
    var cat = el('mkCategory').value;
    var cond = el('mkCondition').value;
    var region = el('mkRegion').value;
    var installOnly = el('mkInstallOnly').checked;

    return rows.filter(function (r) {
      if (cat && r.category !== cat) return false;
      if (cond && r.condition !== cond) return false;
      if (region && r.region !== region) return false;
      if (installOnly && !db.marketView(r).installable) return false;
      if (!q) return true;
      var hay = [r.title, r.brand, r.model, r.region, r.addressRough, r.desc, r.categoryOther]
        .join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderList() {
    var list = filtered();
    B.countText(el('mkCount'), list.length, '개');
    el('mkEmpty').hidden = !!list.length;
    el('mkList').innerHTML = list.length ? list.map(card).join('') : '';
  }

  function load() {
    return db.publishedMarketItems().then(function (list) {
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

  function renderDetail(id) {
    var r = rows.concat(mineRows).filter(function (x) { return x.id === id; })[0];
    var body = el('mkDetailBody');

    if (!r) {
      body.innerHTML = '<div class="ls-gone"><h2>글을 찾을 수 없습니다</h2>' +
        '<p>거래가 끝나 내려갔거나, 주소가 잘못되었을 수 있습니다.</p>' +
        '<a class="btn btn-primary" href="#list">목록으로</a></div>';
      return;
    }

    var v = db.marketView(r);

    body.innerHTML =
      '<div class="ls-view">' +
        '<div class="ls-view-head">' +
          '<span class="ls-tag ls-tag-' + esc(r.category) + '">' + esc(v.categoryLabel) + '</span>' +
          (r.freeGiveaway ? '<span class="ls-tag is-gold">무료 나눔</span>' : '') +
          '<span class="ls-tag is-soft">' + esc(v.conditionLabel) + '</span>' +
          (v.status !== 'published'
            ? '<span class="ls-tag is-warn">' + esc(v.label) + '</span>' : '') +
          '<h1>' + esc(r.title || '(제목 없음)') + '</h1>' +
          '<p class="ls-view-price">' + esc(db.marketPrice(r)) + '</p>' +
        '</div>' +

        B.gallery(v.photos, 'mkGal') +

        (v.installable
          ? '<div class="ls-install-band">' +
              '<div>' +
                '<h2>설치를 맡기실 수 있습니다 (별도 비용)</h2>' +
                '<p>철거 · 운반 · 설치 · 배선까지. 예배당에서 소리가 나는 상태로 넘겨 드립니다. ' +
                  '<strong>물건값과 별개로 비용이 드는 유상 서비스</strong>이며, 예배당을 보고 견적을 드립니다.</p>' +
                (r.installNote
                  ? '<p class="ls-install-note">파시는 분 메모 — ' + B.nl2br(r.installNote) + '</p>' : '') +
              '</div>' +
              '<a class="btn btn-gold btn-lg" href="#install/' + esc(r.id) + '">설치 맡기기</a>' +
            '</div>'
          : '') +

        '<dl class="ls-dls">' +
          B.dl('갈래', esc(v.categoryLabel)) +
          B.dl('만든 곳 · 모델', esc([r.brand, r.model].filter(Boolean).join(' ')) || null) +
          B.dl('상태', esc(v.conditionLabel)) +
          B.dl('수량', Number(r.quantity) > 0 ? Number(r.quantity) + '개' : null) +
          B.dl('들여온 해', esc(r.boughtYear)) +
          B.dl('지역', esc([r.region, r.addressRough].filter(Boolean).join(' · '))) +
          B.dl('넘기는 방법', esc(v.deliveryLabel)) +
        '</dl>' +

        '<div class="ls-view-desc"><h2>설명</h2><p>' + B.nl2br(r.desc) + '</p></div>' +

        '<div class="ls-contact">' +
          '<h2>연락처</h2>' +
          '<p class="ls-contact-name">' + esc(r.contactName) + '</p>' +
          '<p class="ls-contact-phone"><a href="tel:' + esc(B.digits(r.contactPhone)) + '">' +
            esc(db.formatPhone(r.contactPhone)) + '</a></p>' +
          (r.contactHours
            ? '<p class="ls-contact-hours">연락 가능 시간 — ' + esc(r.contactHours) + '</p>' : '') +
          '<p class="ls-contact-fine">' +
            '값 · 대금 · 인수인계는 파시는 분과 사시는 분이 직접 하십니다. ' +
            '센터는 게시판 관리와 설치 대행만 합니다.</p>' +
        '</div>' +

        '<div class="ls-view-foot">' +
          '<a class="btn btn-outline" href="#list">← 목록으로</a>' +
          (v.installable
            ? '<a class="btn btn-primary" href="#install/' + esc(r.id) + '">설치 맡기기</a>' : '') +
        '</div>' +
      '</div>';

    B.bindGallery(v.photos, 'mkGal');
  }

  /* =========================================================
     내가 올린 물건
     ========================================================= */

  function mineCard(r) {
    var v = db.marketView(r);
    var cover = v.photos.length ? (v.photos[0].url || '') : '';

    return '<article class="ls-mine' + ' is-' + esc(v.cls) + '">' +
      '<div class="ls-mine-head">' +
        (cover ? '<img class="ls-mine-shot" src="' + esc(cover) + '" alt="">' : '') +
        '<div>' +
          '<span class="ls-state is-' + esc(v.cls) + '">' + esc(v.label) + '</span>' +
          '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
          '<p class="ls-mine-meta">' + esc(v.categoryLabel) + ' · ' + esc(db.marketPrice(r)) + '</p>' +
        '</div>' +
      '</div>' +

      (v.status === 'pending'
        ? '<p class="ls-mine-note">관리자가 사진과 설명을 확인하고 있습니다. 확인이 끝나면 게시됩니다.</p>' : '') +
      (v.status === 'rejected'
        ? '<p class="ls-mine-note is-bad"><strong>반려되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '사유가 적혀 있지 않습니다.') +
          '<br>내용을 고쳐 다시 올려 주세요.</p>' : '') +
      (v.status === 'hidden'
        ? '<p class="ls-mine-note is-bad"><strong>게시가 중지되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '') + '</p>' : '') +
      (v.status === 'done'
        ? '<p class="ls-mine-note">거래가 끝나 내려갔습니다. 다시 올리시려면 내용을 고쳐 재등록해 주세요.</p>' : '') +
      (v.status === 'published' && v.up != null && v.up >= 60
        ? '<p class="ls-mine-note">올린 지 ' + v.up + '일 되었습니다. ' +
          '이미 파셨다면 <strong>[거래 완료]</strong> 를 눌러 내려 주세요.</p>' : '') +

      '<div class="ls-mine-act">' +
        '<a class="btn btn-outline btn-sm" href="#edit/' + esc(r.id) + '">고치기</a>' +
        (v.status === 'published'
          ? '<button type="button" class="btn btn-gold btn-sm" data-done="' + esc(r.id) + '">거래 완료</button>' : '') +
        (v.status === 'published'
          ? '<a class="btn btn-ghost btn-sm" href="#view/' + esc(r.id) + '">글 보기</a>' : '') +
        '<button type="button" class="btn btn-ghost btn-sm is-danger" data-del="' + esc(r.id) + '">삭제</button>' +
      '</div>' +
      '</article>';
  }

  function renderMine() {
    var box = el('mkMineBody');
    var me = db.auth.current();

    if (!me) {
      box.innerHTML = '<div class="ls-gate">' +
        '<p>내가 올린 물건을 보시려면 로그인해 주세요.</p>' +
        '<button type="button" class="btn btn-primary" id="mkMineLogin">로그인 / 회원가입</button></div>';
      var b = el('mkMineLogin');
      if (b) {
        b.addEventListener('click', function () {
          if (window.CAPSAuthUI) window.CAPSAuthUI.require().then(renderMine);
        });
      }
      return;
    }

    box.innerHTML = '<p class="ls-loading">불러오는 중입니다…</p>';
    db.myMarketItems().then(function (list) {
      mineRows = list.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      box.innerHTML = mineRows.length
        ? mineRows.map(mineCard).join('')
        : '<div class="ls-empty is-inline"><h3>아직 올리신 물건이 없습니다</h3>' +
          '<p>쓰지 않는 장비나 집기가 있으시면 올려 주세요.</p>' +
          '<a class="btn btn-primary" href="#new">물건 올리기</a></div>';
    });
  }

  el('mkMineBody').addEventListener('click', function (e) {
    var done = e.target.closest('[data-done]');
    var del = e.target.closest('[data-del]');

    if (done) {
      if (!window.confirm('이 물건을 거래 완료로 내릴까요?\n\n목록에서 사라집니다. 다시 올리시려면 내용을 고쳐 재등록하시면 됩니다.')) return;
      done.disabled = true;
      db.markMarketDone(done.getAttribute('data-done'))
        .then(renderMine)
        .catch(function (err) { window.alert(err.message); done.disabled = false; });
      return;
    }
    if (del) {
      if (!window.confirm('이 글을 삭제할까요?\n\n올리신 사진도 함께 지워지며 되돌릴 수 없습니다.')) return;
      del.disabled = true;
      var row = mineRows.filter(function (r) { return r.id === del.getAttribute('data-del'); })[0];
      db.deleteMarketItem(row || del.getAttribute('data-del'))
        .then(renderMine)
        .catch(function (err) { window.alert(err.message); del.disabled = false; });
    }
  });

  /* =========================================================
     등록 · 수정 폼
     ========================================================= */

  var f = {
    category: el('mkFCategory'),
    categoryOther: el('mkFCategoryOther'),
    title: el('mkFTitle'),
    brand: el('mkFBrand'),
    model: el('mkFModel'),
    quantity: el('mkFQuantity'),
    condition: el('mkFCondition'),
    boughtYear: el('mkFBoughtYear'),
    free: el('mkFFree'),
    price: el('mkFPrice'),
    nego: el('mkFNego'),
    region: el('mkFRegion'),
    address: el('mkFAddress'),
    delivery: el('mkFDelivery'),
    installOk: el('mkFInstallOk'),
    installNote: el('mkFInstallNote'),
    desc: el('mkFDesc'),
    name: el('mkFContactName'),
    phone: el('mkFContactPhone'),
    hours: el('mkFHours'),
  };

  var vows = ['mkVow1', 'mkVow2', 'mkVow3'].map(el);

  if (f.phone) db.bindPhoneInput(f.phone);
  B.bindMoney(f.price);
  B.bindChips();

  if (f.title) {
    var countTitle = function () {
      el('mkTitleCount').textContent = f.title.value.length + ' / 60';
    };
    f.title.addEventListener('input', countTitle);
    countTitle();
  }

  /** '기타' 갈래 → 직접 입력칸 */
  function syncCategory() {
    var other = f.category.value === 'other';
    el('mkCatOtherBox').hidden = !other;
    f.categoryOther.disabled = !other;
    if (!other) f.categoryOther.value = '';

    // 음향 · 영상 · 조명일 때만 설치 대행을 묻습니다.
    var canInstall = db.MARKET_INSTALLABLE.indexOf(f.category.value) > -1;
    el('mkInstallFs').hidden = !canInstall;
  }
  f.category.addEventListener('change', syncCategory);

  /** 무료 나눔이면 값 칸을 접습니다. */
  function syncFree() {
    el('mkPriceBox').hidden = f.free.checked;
    if (f.free.checked) {
      f.price.value = '';
      f.nego.checked = false;
    }
  }
  f.free.addEventListener('change', syncFree);

  function collect() {
    return {
      category: f.category.value,
      categoryOther: f.category.value === 'other' ? f.categoryOther.value.trim() : '',
      title: f.title.value.trim(),
      brand: f.brand.value.trim(),
      model: f.model.value.trim(),
      quantity: Math.max(1, Number(f.quantity.value) || 1),
      condition: f.condition.value,
      boughtYear: B.digits(f.boughtYear.value).slice(0, 4),
      freeGiveaway: f.free.checked,
      price: f.free.checked ? 0 : Number(B.digits(f.price.value)) || 0,
      negotiable: f.free.checked ? false : f.nego.checked,
      region: f.region.value,
      addressRough: f.address.value.trim(),
      delivery: f.delivery.value,
      installOk: db.MARKET_INSTALLABLE.indexOf(f.category.value) > -1 ? f.installOk.checked : false,
      installNote: f.installNote.value.trim(),
      desc: f.desc.value.trim(),
      contactName: f.name.value.trim(),
      contactPhone: f.phone.value.trim(),
      contactHours: f.hours.value.trim(),
      photos: photos.get(),
    };
  }

  function validate(d) {
    if (!d.title) return '제목을 적어 주세요.';
    if (d.category === 'other' && !d.categoryOther) return '어떤 물건인지 적어 주세요.';
    if (!d.region) return '지역을 골라 주세요.';
    if (!d.freeGiveaway && d.price <= 0) {
      return '값을 적어 주세요. 값을 받지 않으신다면 [무료로 나눕니다] 를 눌러 주세요.';
    }
    if (!d.photos.length) return '사진을 한 장 이상 올려 주세요. 사진이 없으면 헛걸음이 잦습니다.';
    if (d.desc.length < 20) return '설명을 조금 더 적어 주세요 (20자 이상).';
    if (!d.contactName) return '연락받으실 성함을 적어 주세요.';
    if (B.digits(d.contactPhone).length < 9) return '연락처를 확인해 주세요.';
    if (!d.contactHours) return '연락 가능 시간을 적어 주세요. 예배 중에 오는 전화를 줄여 줍니다.';
    for (var i = 0; i < vows.length; i++) {
      if (vows[i] && !vows[i].checked) return '아래 확인 항목에 모두 체크해 주세요.';
    }
    return '';
  }

  function fillForm(r) {
    f.category.value = r.category || 'sound';
    syncCategory();
    f.categoryOther.value = r.categoryOther || '';
    f.title.value = r.title || '';
    f.brand.value = r.brand || '';
    f.model.value = r.model || '';
    f.quantity.value = r.quantity || 1;
    f.condition.value = r.condition || 'good';
    f.boughtYear.value = r.boughtYear || '';
    f.free.checked = !!r.freeGiveaway;
    syncFree();
    f.price.value = r.price ? B.comma(r.price) : '';
    f.nego.checked = !!r.negotiable;
    f.region.value = r.region || '';
    f.address.value = r.addressRough || '';
    f.delivery.value = r.delivery || 'pickup';
    f.installOk.checked = r.installOk !== false;
    f.installNote.value = r.installNote || '';
    f.desc.value = r.desc || '';
    f.name.value = r.contactName || '';
    f.phone.value = db.formatPhone(r.contactPhone || '');
    f.hours.value = r.contactHours || '';
    photos.set(Array.isArray(r.photos) ? r.photos : []);
    f.title.dispatchEvent(new Event('input'));
  }

  function resetForm() {
    el('mkForm').reset();
    photos.clear();
    syncCategory();
    syncFree();
    f.title.dispatchEvent(new Event('input'));
  }

  function openForm(editId) {
    B.say(el('mkFormErr'), '');
    B.say(el('mkFormOk'), '');
    el('mkEditId').value = editId || '';
    el('mkSubmit').textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';

    if (!B.gate('mk', function () { openForm(editId); })) return;

    if (!editId) {
      resetForm();
      return;
    }
    // 고칠 글은 내 목록에서 찾습니다.
    var hit = mineRows.filter(function (r) { return r.id === editId; })[0];
    if (hit) { fillForm(hit); return; }
    db.myMarketItems().then(function (list) {
      mineRows = list;
      var row = list.filter(function (r) { return r.id === editId; })[0];
      if (row) fillForm(row);
      else B.say(el('mkFormErr'), '고치실 글을 찾지 못했습니다.');
    });
  }

  el('mkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    B.say(el('mkFormErr'), '');
    B.say(el('mkFormOk'), '');

    if (photos.busy()) {
      B.say(el('mkFormErr'), '사진을 아직 올리는 중입니다. 잠시만 기다려 주세요.');
      return;
    }

    var data = collect();
    var bad = validate(data);
    if (bad) {
      B.say(el('mkFormErr'), bad);
      el('mkFormErr').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var editId = el('mkEditId').value;
    var btn = el('mkSubmit');
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    var task = editId ? db.saveMarketItem(editId, data) : db.submitMarketItem(data);

    task.then(function () {
      B.say(el('mkFormOk'),
        editId
          ? '고친 내용을 보냈습니다. 관리자가 다시 확인한 뒤 게시됩니다.'
          : '등록 신청이 접수되었습니다. 관리자가 확인한 뒤 게시됩니다.');
      resetForm();
      window.setTimeout(function () { window.location.hash = '#mine'; }, 1200);
    }).catch(function (err) {
      B.say(el('mkFormErr'), err.message || '등록하지 못했습니다.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';
    });
  });

  /* =========================================================
     설치 대행 신청

     장터에 올라온 물건에서 들어오면 그 물건이 채워지고,
     그냥 #install 로 들어오면 빈 칸으로 열립니다
     (장터 밖에서 사신 장비도 달아 드립니다).
     ========================================================= */

  var iv = {
    itemId: el('mkIvItemId'),
    item: el('mkIvItem'),
    church: el('mkIvChurch'),
    region: el('mkIvRegion'),
    address: el('mkIvAddress'),
    floor: el('mkIvFloor'),
    elevator: el('mkIvElevator'),
    wish: el('mkIvWish'),
    name: el('mkIvName'),
    phone: el('mkIvPhone'),
    hours: el('mkIvHours'),
    note: el('mkIvNote'),
    quote: el('mkIvQuote'),
  };

  if (iv.phone) db.bindPhoneInput(iv.phone);

  function tierValue() {
    var on = document.querySelector('input[name="mkTier"]:checked');
    return on ? on.value : 'install';
  }

  /** 고른 갈래에 맞춰 안내 문구를 보여 줍니다 (금액은 실측 후 확정). */
  function syncQuote() {
    var q = db.installQuote(tierValue(), 1);

    iv.quote.innerHTML =
      '<strong>상담 후 견적</strong>' +
      '<br><small>' + esc(q.desc) + ' 예배당을 보고 비용을 확정해 드리며, ' +
      '신청만으로 비용이 생기지 않습니다.</small>';
  }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="mkTier"]'), function (r) {
    r.addEventListener('change', syncQuote);
  });

  function openInstall(itemId) {
    B.say(el('mkIvErr'), '');
    B.say(el('mkIvOk'), '');

    var box = el('mkIvGate');
    var form = el('mkIvForm');
    var me = db.auth.current();
    box.hidden = !!me;
    form.hidden = !me;

    iv.itemId.value = itemId || '';
    var row = rows.concat(mineRows).filter(function (r) { return r.id === itemId; })[0];

    if (row) {
      var v = db.marketView(row);
      iv.item.hidden = false;
      iv.item.innerHTML =
        '<p class="ls-iv-label">설치할 물건</p>' +
        '<p class="ls-iv-title">' + esc(row.title) + '</p>' +
        '<p class="ls-iv-meta">' + esc(v.categoryLabel) +
          (Number(row.quantity) > 1 ? ' · ' + Number(row.quantity) + '개' : '') +
          ' · ' + esc(db.marketPrice(row)) + '</p>' +
        (row.installNote
          ? '<p class="ls-iv-note">파시는 분 메모 — ' + B.nl2br(row.installNote) + '</p>' : '');
    } else {
      iv.item.hidden = false;
      iv.item.innerHTML =
        '<p class="ls-iv-label">설치할 물건</p>' +
        '<p class="ls-iv-title">장터 밖에서 구하신 장비</p>' +
        '<p class="ls-iv-meta">아래 [남기실 말씀] 에 어떤 장비인지 적어 주시면 견적이 정확해집니다.</p>';
    }

    syncQuote();
  }

  el('mkIvGateLogin').addEventListener('click', function () {
    if (!window.CAPSAuthUI) return;
    window.CAPSAuthUI.require().then(function (user) {
      if (user) openInstall(iv.itemId.value);
    });
  });

  el('mkIvForm').addEventListener('submit', function (e) {
    e.preventDefault();
    B.say(el('mkIvErr'), '');
    B.say(el('mkIvOk'), '');

    if (!iv.church.value.trim()) { B.say(el('mkIvErr'), '교회명을 적어 주세요.'); return; }
    if (!iv.region.value) { B.say(el('mkIvErr'), '지역을 골라 주세요.'); return; }
    if (!iv.address.value.trim()) { B.say(el('mkIvErr'), '설치할 주소를 적어 주세요.'); return; }
    if (!iv.name.value.trim()) { B.say(el('mkIvErr'), '연락받으실 성함을 적어 주세요.'); return; }
    if (B.digits(iv.phone.value).length < 9) { B.say(el('mkIvErr'), '연락처를 확인해 주세요.'); return; }

    var itemId = iv.itemId.value;
    var row = rows.concat(mineRows).filter(function (r) { return r.id === itemId; })[0];
    var btn = el('mkIvSubmit');
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    db.submitInstallRequest({
      itemId: itemId || '',
      itemTitle: row ? row.title : '(장터 밖 장비)',
      tier: tierValue(),
      churchName: iv.church.value.trim(),
      region: iv.region.value,
      address: iv.address.value.trim(),
      floor: iv.floor.value.trim(),
      elevator: iv.elevator.value,
      wishDate: iv.wish.value,
      contactName: iv.name.value.trim(),
      contactPhone: iv.phone.value.trim(),
      contactHours: iv.hours.value.trim(),
      note: iv.note.value.trim(),
    }).then(function () {
      B.say(el('mkIvOk'),
        '설치 신청이 접수되었습니다. 담당자가 1~2일 안에 연락드려 실측 일정을 잡습니다. ' +
        '신청만으로 비용이 생기지 않습니다.');
      el('mkIvForm').reset();
      syncQuote();
    }).catch(function (err) {
      B.say(el('mkIvErr'), err.message || '신청하지 못했습니다.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = '설치 신청하기';
    });
  });

  /* =========================================================
     화면 전환
     ========================================================= */

  var nav = B.router(
    {
      list: 'mkBoard',
      view: 'mkDetail',
      mine: 'mkMine',
      new: 'mkNew',
      install: 'mkInstallForm',
    },
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
          (me ? db.myMarketItems() : Promise.resolve([])).then(function (list) {
            mineRows = list;
            if (known()) { renderDetail(id); return; }
            return load().then(function () { renderDetail(id); });
          });
        });
      },
      mine: renderMine,
      new: function () { openForm(''); },
      edit: function (id) { openForm(id); },
      install: function (id) {
        (loaded ? Promise.resolve() : load()).then(function () { openInstall(id); });
      },
    },
    // 설치 대행 안내는 목록 화면에서만 보입니다.
    { bodyAttr: 'data-mk-pane', listOnly: ['mkInstall'] }
  );

  ['mkQ', 'mkCategory', 'mkCondition', 'mkRegion', 'mkInstallOnly'].forEach(function (id) {
    var node = el(id);
    if (!node) return;
    node.addEventListener('input', renderList);
    node.addEventListener('change', renderList);
  });

  db.auth.onChange(function () {
    var parts = nav.current();
    if (parts[0] === 'mine') renderMine();
    if (parts[0] === 'new' || parts[0] === 'edit') openForm(parts[1] || '');
    if (parts[0] === 'install') openInstall(parts[1] || '');
  });

  syncCategory();
  syncFree();
  load().catch(function () {
    el('mkList').innerHTML = '';
    el('mkEmpty').hidden = false;
  });
  nav.route();
}());
