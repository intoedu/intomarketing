/* =========================================================
   교역자 구인 공고 (jobs.html)

     #list        목록 (기본)
     #view/<id>   상세
     #new         공고 올리기 (#edit/<id> 로 열면 수정)
     #mine        내가 올린 공고

   지원은 사이트 안에서 받지 않습니다 — 공고에 적힌 연락처로 직접 갑니다.
   지원서를 여기서 받으면 센터가 지원자 개인정보의 보관·파기 책임을
   지게 되므로, 처리방침을 정한 뒤에 붙이기로 했습니다.
   ========================================================= */
(function () {
  'use strict';

  var B = window.CAPSBoard;
  if (!B || !document.getElementById('jbBoard')) return;

  var db = B.db;
  var esc = B.esc;
  var el = B.el;

  var BOARD = window.CAPS_JOB_BOARD || {};
  var PHOTO_MAX = Number(BOARD.photoMax) || db.JOB_PHOTO_MAX;
  var PHOTO_MIN = Number(BOARD.photoMin) || 3;

  var rows = [];
  var mineRows = [];
  var loaded = false;

  var photos = B.photoBox('jb', PHOTO_MAX, PHOTO_MIN);

  /* =========================================================
     목록
     ========================================================= */

  function card(r) {
    var v = db.jobView(r);
    var cover = v.photos.length ? (v.photos[0].url || '') : '';
    var bits = [r.region, r.addressRough, r.department].filter(Boolean).map(esc).join(' · ');

    return '<a class="ls-card' + (cover ? ' has-shot' : '') + '" href="#view/' + esc(r.id) + '">' +
      (cover
        ? '<span class="ls-card-shot">' +
            '<img src="' + esc(cover) + '" alt="" loading="lazy">' +
            (v.photos.length > 1 ? '<span class="ls-shot-n">사진 ' + v.photos.length + '장</span>' : '') +
          '</span>'
        : '<span class="ls-card-noshot">사진이 없는 공고입니다</span>') +
      '<span class="ls-card-body">' +
        '<span class="ls-card-top">' +
          '<span class="ls-tag ls-tag-' + esc(r.position) + '">' + esc(v.positionLabel) + '</span>' +
          '<span class="ls-tag is-soft">' + esc(v.employmentLabel) + '</span>' +
          (r.housing === 'provided' ? '<span class="ls-tag is-gold">사택 제공</span>' : '') +
        '</span>' +
        '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
        '<p class="ls-card-meta">' + esc(r.churchName || '') + (bits ? ' · ' + bits : '') + '</p>' +
        '<strong class="ls-card-price">' + esc(db.jobPay(r)) + '</strong>' +
        (r.workDays ? '<p class="ls-card-hours">' + esc(r.workDays) + '</p>' : '') +
        '<span class="ls-card-more">자세히 보기 →</span>' +
      '</span>' +
      '</a>';
  }

  function filtered() {
    var q = (el('jbQ').value || '').trim().toLowerCase();
    var pos = el('jbPosition').value;
    var emp = el('jbEmployment').value;
    var region = el('jbRegion').value;
    var housingOnly = el('jbHousingOnly').checked;

    return rows.filter(function (r) {
      if (pos && r.position !== pos) return false;
      if (emp && r.employment !== emp) return false;
      if (region && r.region !== region) return false;
      // "사택 있는 곳만" — 멀리서 오시는 분에게는 이게 첫 조건입니다.
      if (housingOnly && r.housing !== 'provided' && r.housing !== 'support') return false;
      if (!q) return true;
      var hay = [r.title, r.churchName, r.region, r.addressRough, r.department,
        r.denomination, r.qualification, r.desc].join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function renderList() {
    var list = filtered();
    B.countText(el('jbCount'), list.length, '곳');
    el('jbEmpty').hidden = !!list.length;
    el('jbList').innerHTML = list.length ? list.map(card).join('') : '';
  }

  function load() {
    return db.publishedJobPosts().then(function (list) {
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
    var body = el('jbDetailBody');

    if (!r) {
      body.innerHTML = '<div class="ls-gone"><h2>공고를 찾을 수 없습니다</h2>' +
        '<p>사람을 구하셔서 내려갔거나, 주소가 잘못되었을 수 있습니다.</p>' +
        '<a class="btn btn-primary" href="#list">목록으로</a></div>';
      return;
    }

    var v = db.jobView(r);

    body.innerHTML =
      '<div class="ls-view">' +
        '<div class="ls-view-head">' +
          '<span class="ls-tag ls-tag-' + esc(r.position) + '">' + esc(v.positionLabel) + '</span>' +
          '<span class="ls-tag is-soft">' + esc(v.employmentLabel) + '</span>' +
          (r.housing === 'provided' ? '<span class="ls-tag is-gold">사택 제공</span>' : '') +
          (v.status !== 'published'
            ? '<span class="ls-tag is-warn">' + esc(v.label) + '</span>' : '') +
          '<h1>' + esc(r.title || '(제목 없음)') + '</h1>' +
          '<p class="ls-view-sub">' + esc(r.churchName || '') +
            (r.denomination ? ' · ' + esc(r.denomination) : '') +
            (r.churchSize ? ' · 출석 ' + esc(r.churchSize) : '') + '</p>' +
          '<p class="ls-view-price">' + esc(db.jobPay(r)) + '</p>' +
        '</div>' +

        B.gallery(v.photos, 'jbGal') +

        '<dl class="ls-dls">' +
          B.dl('직분', esc(v.positionLabel)) +
          B.dl('맡을 부서', esc(r.department)) +
          B.dl('근무 형태', esc(v.employmentLabel)) +
          B.dl('모집 인원', (Number(r.headcount) || 1) + '명') +
          B.dl('근무 요일 · 시간', esc(r.workDays)) +
          B.dl('사례비', esc(db.jobPay(r)) + (r.payNote ? ' · ' + esc(r.payNote) : '')) +
          B.dl('사택', esc(v.housingLabel)) +
          B.dl('4대보험', r.insurance ? '가입' : null) +
          B.dl('지역', esc([r.region, r.addressRough].filter(Boolean).join(' · '))) +
          B.dl('부임 희망', esc(r.startDate)) +
          B.dl('모집 마감', r.closesAt ? B.when(r.closesAt, false) : '구할 때까지') +
        '</dl>' +

        (r.commuteNote
          ? '<div class="ls-view-desc is-rules"><h2>오가는 길</h2><p>' +
            B.nl2br(r.commuteNote) + '</p></div>'
          : '') +

        '<div class="ls-view-desc"><h2>교회 소개와 하실 일</h2><p>' + B.nl2br(r.desc) + '</p></div>' +

        (r.qualification
          ? '<div class="ls-view-desc"><h2>바라는 자격 · 경험</h2><p>' +
            B.nl2br(r.qualification) + '</p></div>'
          : '') +

        '<div class="ls-contact">' +
          '<h2>지원하시려면</h2>' +
          '<p class="ls-contact-name">' + esc(r.contactName) + '</p>' +
          '<p class="ls-contact-phone"><a href="tel:' + esc(B.digits(r.contactPhone)) + '">' +
            esc(db.formatPhone(r.contactPhone)) + '</a></p>' +
          (r.contactEmail
            ? '<p class="ls-contact-hours">이력서 — <a href="mailto:' + esc(r.contactEmail) + '">' +
              esc(r.contactEmail) + '</a></p>' : '') +
          (r.contactHours
            ? '<p class="ls-contact-hours">연락 가능 시간 — ' + esc(r.contactHours) + '</p>' : '') +
          '<p class="ls-contact-fine">' +
            '<strong>지원은 이 연락처로 직접 하시면 됩니다.</strong> 센터를 거치지 않습니다. ' +
            '면접과 청빙 결정은 교회와 사역자가 직접 하시며, 센터는 공고 게시판만 운영합니다. ' +
            '사례비 · 사택 · 근무 요일은 전화로 한 번 더 확인해 주세요.</p>' +
        '</div>' +

        '<div class="ls-view-foot">' +
          '<a class="btn btn-outline" href="#list">← 목록으로</a>' +
        '</div>' +
      '</div>';

    B.bindGallery(v.photos, 'jbGal');
  }

  /* =========================================================
     내가 올린 공고
     ========================================================= */

  function mineCard(r) {
    var v = db.jobView(r);
    var cover = v.photos.length ? (v.photos[0].url || '') : '';

    return '<article class="ls-mine is-' + esc(v.cls) + '">' +
      '<div class="ls-mine-head">' +
        (cover ? '<img class="ls-mine-shot" src="' + esc(cover) + '" alt="">' : '') +
        '<div>' +
          '<span class="ls-state is-' + esc(v.cls) + '">' + esc(v.label) + '</span>' +
          '<h3>' + esc(r.title || '(제목 없음)') + '</h3>' +
          '<p class="ls-mine-meta">' + esc(r.churchName || '') + ' · ' + esc(db.jobPay(r)) + '</p>' +
        '</div>' +
      '</div>' +

      (v.status === 'pending'
        ? '<p class="ls-mine-note">관리자가 교회와 공고 내용을 확인하고 있습니다. 확인이 끝나면 게시됩니다.</p>' : '') +
      (v.status === 'rejected'
        ? '<p class="ls-mine-note is-bad"><strong>반려되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '사유가 적혀 있지 않습니다.') +
          '<br>내용을 고쳐 다시 올려 주세요.</p>' : '') +
      (v.status === 'hidden'
        ? '<p class="ls-mine-note is-bad"><strong>게시가 중지되었습니다.</strong><br>' +
          B.nl2br(r.rejectNote || '') + '</p>' : '') +
      (v.status === 'done'
        ? '<p class="ls-mine-note">' +
          (v.closed && r.status === 'published'
            ? '모집 마감일이 지나 목록에서 내려갔습니다. 더 받으시려면 마감일을 고쳐 주세요.'
            : '모집 완료로 내려갔습니다. 다시 받으시려면 내용을 고쳐 재등록해 주세요.') +
          '</p>' : '') +

      '<div class="ls-mine-act">' +
        '<a class="btn btn-outline btn-sm" href="#edit/' + esc(r.id) + '">고치기</a>' +
        (v.status === 'published'
          ? '<button type="button" class="btn btn-gold btn-sm" data-done="' + esc(r.id) + '">모집 완료</button>' : '') +
        (v.status === 'published'
          ? '<a class="btn btn-ghost btn-sm" href="#view/' + esc(r.id) + '">공고 보기</a>' : '') +
        '<button type="button" class="btn btn-ghost btn-sm is-danger" data-del="' + esc(r.id) + '">삭제</button>' +
      '</div>' +
      '</article>';
  }

  function renderMine() {
    var box = el('jbMineBody');
    var me = db.auth.current();

    if (!me) {
      box.innerHTML = '<div class="ls-gate">' +
        '<p>내가 올린 공고를 보시려면 로그인해 주세요.</p>' +
        '<button type="button" class="btn btn-primary" id="jbMineLogin">로그인 / 회원가입</button></div>';
      var b = el('jbMineLogin');
      if (b) {
        b.addEventListener('click', function () {
          if (window.CAPSAuthUI) window.CAPSAuthUI.require().then(renderMine);
        });
      }
      return;
    }

    box.innerHTML = '<p class="ls-loading">불러오는 중입니다…</p>';
    db.myJobPosts().then(function (list) {
      mineRows = list.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      box.innerHTML = mineRows.length
        ? mineRows.map(mineCard).join('')
        : '<div class="ls-empty is-inline"><h3>아직 올리신 공고가 없습니다</h3>' +
          '<p>사역자를 찾고 계시면 올려 주세요.</p>' +
          '<a class="btn btn-primary" href="#new">공고 올리기</a></div>';
    });
  }

  el('jbMineBody').addEventListener('click', function (e) {
    var done = e.target.closest('[data-done]');
    var del = e.target.closest('[data-del]');

    if (done) {
      if (!window.confirm('사람을 구하셨습니까?\n\n공고가 목록에서 내려갑니다. 다시 받으시려면 내용을 고쳐 재등록하시면 됩니다.')) return;
      done.disabled = true;
      db.markJobDone(done.getAttribute('data-done'))
        .then(renderMine)
        .catch(function (err) { window.alert(err.message); done.disabled = false; });
      return;
    }
    if (del) {
      if (!window.confirm('이 공고를 삭제할까요?\n\n올리신 사진도 함께 지워지며 되돌릴 수 없습니다.')) return;
      del.disabled = true;
      var row = mineRows.filter(function (r) { return r.id === del.getAttribute('data-del'); })[0];
      db.deleteJobPost(row || del.getAttribute('data-del'))
        .then(renderMine)
        .catch(function (err) { window.alert(err.message); del.disabled = false; });
    }
  });

  /* =========================================================
     등록 · 수정 폼
     ========================================================= */

  var f = {
    church: el('jbFChurch'),
    denom: el('jbFDenom'),
    region: el('jbFRegion'),
    size: el('jbFSize'),
    address: el('jbFAddress'),
    title: el('jbFTitle'),
    position: el('jbFPosition'),
    positionOther: el('jbFPositionOther'),
    employment: el('jbFEmployment'),
    dept: el('jbFDept'),
    headcount: el('jbFHeadcount'),
    workDays: el('jbFWorkDays'),
    start: el('jbFStart'),
    closes: el('jbFCloses'),
    payType: el('jbFPayType'),
    payMin: el('jbFPayMin'),
    payMax: el('jbFPayMax'),
    payNote: el('jbFPayNote'),
    housing: el('jbFHousing'),
    insurance: el('jbFInsurance'),
    commute: el('jbFCommute'),
    desc: el('jbFDesc'),
    qual: el('jbFQual'),
    name: el('jbFContactName'),
    phone: el('jbFContactPhone'),
    email: el('jbFContactEmail'),
    hours: el('jbFHours'),
  };

  var vows = ['jbVow1', 'jbVow2', 'jbVow3'].map(el);

  if (f.phone) db.bindPhoneInput(f.phone);
  [f.payMin, f.payMax].forEach(B.bindMoney);
  B.bindChips();

  if (f.title) {
    var countTitle = function () {
      el('jbTitleCount').textContent = f.title.value.length + ' / 60';
    };
    f.title.addEventListener('input', countTitle);
    countTitle();
  }

  /* '기타' 직분일 때만 직접 입력칸을 엽니다. */
  function syncPosition() {
    el('jbPosOtherBox').hidden = f.position.value !== 'other';
  }
  f.position.addEventListener('change', syncPosition);

  /* '면접 후 협의' 를 고르면 금액칸을 감춥니다. */
  function syncPay() {
    el('jbPayBox').hidden = f.payType.value === 'negotiable';
    if (f.payType.value === 'negotiable') {
      f.payMin.value = '';
      f.payMax.value = '';
    }
  }
  f.payType.addEventListener('change', syncPay);

  function collect() {
    var neg = f.payType.value === 'negotiable';
    return {
      churchName: f.church.value.trim(),
      denomination: f.denom.value.trim(),
      churchSize: f.size.value,
      region: f.region.value,
      addressRough: f.address.value.trim(),
      title: f.title.value.trim(),
      position: f.position.value,
      positionOther: f.position.value === 'other' ? f.positionOther.value.trim() : '',
      department: f.dept.value,
      employment: f.employment.value,
      headcount: Math.max(1, Number(f.headcount.value) || 1),
      payType: f.payType.value,
      payMin: neg ? 0 : Number(B.digits(f.payMin.value)) || 0,
      payMax: neg ? 0 : Number(B.digits(f.payMax.value)) || 0,
      payNote: f.payNote.value.trim(),
      housing: f.housing.value,
      insurance: f.insurance.checked,
      commuteNote: f.commute.value.trim(),
      workDays: f.workDays.value.trim(),
      startDate: f.start.value.trim(),
      closesAt: f.closes.value,
      qualification: f.qual.value.trim(),
      desc: f.desc.value.trim(),
      contactName: f.name.value.trim(),
      contactPhone: f.phone.value.trim(),
      contactEmail: f.email.value.trim(),
      contactHours: f.hours.value.trim(),
      photos: photos.get(),
    };
  }

  function validate(d) {
    if (!d.churchName) return '교회명을 적어 주세요.';
    if (!d.region) return '지역을 골라 주세요.';
    if (!d.title) return '공고 제목을 적어 주세요.';
    if (d.position === 'other' && !d.positionOther) return '직분을 직접 적어 주세요.';
    if (d.payType !== 'negotiable' && !d.payMin && !d.payMax) {
      return '사례비를 적어 주세요. 정하지 못하셨다면 [면접 후 협의] 를 골라 주세요 — '
        + '다만 금액이 없는 공고에는 잘 연락하지 않으십니다.';
    }
    if (d.payMax && d.payMin && d.payMax < d.payMin) {
      return '사례비 범위의 끝이 시작보다 적습니다. 다시 확인해 주세요.';
    }
    if (d.closesAt && d.closesAt < new Date().toISOString().slice(0, 10)) {
      return '모집 마감일이 오늘보다 앞섭니다. 다시 확인해 주세요.';
    }
    if (!d.photos.length) {
      return '교회 사진을 한 장 이상 올려 주세요. 보시는 분은 사진 말고 교회를 볼 방법이 없습니다.';
    }
    if (d.desc.length < 30) return '교회 소개와 하실 일을 조금 더 적어 주세요 (30자 이상).';
    if (!d.contactName) return '연락받으실 담당자 성함을 적어 주세요.';
    if (B.digits(d.contactPhone).length < 9) return '연락처를 확인해 주세요.';
    if (d.contactEmail && d.contactEmail.indexOf('@') === -1) return '이메일 주소를 확인해 주세요.';
    if (!d.contactHours) return '연락 가능 시간을 적어 주세요. 예배 중에 오는 전화를 줄여 줍니다.';
    for (var i = 0; i < vows.length; i++) {
      if (vows[i] && !vows[i].checked) return '아래 확인 항목에 모두 체크해 주세요.';
    }
    return '';
  }

  function fillForm(r) {
    f.church.value = r.churchName || '';
    f.denom.value = r.denomination || '';
    f.region.value = r.region || '';
    f.size.value = r.churchSize || '';
    f.address.value = r.addressRough || '';
    f.title.value = r.title || '';
    f.position.value = r.position || 'assistant';
    f.positionOther.value = r.positionOther || '';
    syncPosition();
    f.employment.value = r.employment || 'full';
    f.dept.value = r.department || '';
    f.headcount.value = r.headcount || 1;
    f.workDays.value = r.workDays || '';
    f.start.value = r.startDate || '';
    f.closes.value = (r.closesAt || '').slice(0, 10);
    f.payType.value = r.payType || 'monthly';
    syncPay();
    f.payMin.value = r.payMin ? B.comma(r.payMin) : '';
    f.payMax.value = r.payMax ? B.comma(r.payMax) : '';
    f.payNote.value = r.payNote || '';
    f.housing.value = r.housing || 'none';
    f.insurance.checked = !!r.insurance;
    f.commute.value = r.commuteNote || '';
    f.desc.value = r.desc || '';
    f.qual.value = r.qualification || '';
    f.name.value = r.contactName || '';
    f.phone.value = db.formatPhone(r.contactPhone || '');
    f.email.value = r.contactEmail || '';
    f.hours.value = r.contactHours || '';
    photos.set(Array.isArray(r.photos) ? r.photos : []);
    f.title.dispatchEvent(new Event('input'));
  }

  function resetForm() {
    el('jbForm').reset();
    photos.clear();
    syncPosition();
    syncPay();
    f.title.dispatchEvent(new Event('input'));
  }

  function openForm(editId) {
    B.say(el('jbFormErr'), '');
    B.say(el('jbFormOk'), '');
    el('jbEditId').value = editId || '';
    el('jbSubmit').textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';

    if (!B.gate('jb', function () { openForm(editId); })) return;

    if (!editId) { resetForm(); return; }

    var hit = mineRows.filter(function (r) { return r.id === editId; })[0];
    if (hit) { fillForm(hit); return; }
    db.myJobPosts().then(function (list) {
      mineRows = list;
      var row = list.filter(function (r) { return r.id === editId; })[0];
      if (row) fillForm(row);
      else B.say(el('jbFormErr'), '고치실 공고를 찾지 못했습니다.');
    });
  }

  el('jbForm').addEventListener('submit', function (e) {
    e.preventDefault();
    B.say(el('jbFormErr'), '');
    B.say(el('jbFormOk'), '');

    if (photos.busy()) {
      B.say(el('jbFormErr'), '사진을 아직 올리는 중입니다. 잠시만 기다려 주세요.');
      return;
    }

    var data = collect();
    var bad = validate(data);
    if (bad) {
      B.say(el('jbFormErr'), bad);
      el('jbFormErr').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var editId = el('jbEditId').value;
    var btn = el('jbSubmit');
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    var task = editId ? db.saveJobPost(editId, data) : db.submitJobPost(data);

    task.then(function () {
      B.say(el('jbFormOk'),
        editId
          ? '고친 내용을 보냈습니다. 관리자가 다시 확인한 뒤 게시됩니다.'
          : '공고 등록 신청이 접수되었습니다. 관리자가 교회와 내용을 확인한 뒤 게시됩니다.');
      resetForm();
      window.setTimeout(function () { window.location.hash = '#mine'; }, 1200);
    }).catch(function (err) {
      B.say(el('jbFormErr'), err.message || '등록하지 못했습니다.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = editId ? '고쳐서 다시 올리기' : '등록 신청하기';
    });
  });

  /* =========================================================
     화면 전환
     ========================================================= */

  var nav = B.router(
    { list: 'jbBoard', view: 'jbDetail', mine: 'jbMine', new: 'jbNew' },
    {
      list: function () { if (!loaded) load(); },
      view: function (id) {
        (loaded ? Promise.resolve() : load()).then(function () {
          var me = db.auth.current();
          var known = function () {
            return rows.concat(mineRows).some(function (r) { return r.id === id; });
          };
          if (known()) { renderDetail(id); return; }
          (me ? db.myJobPosts() : Promise.resolve([])).then(function (list) {
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
    { bodyAttr: 'data-jb-pane' }
  );

  ['jbQ', 'jbPosition', 'jbEmployment', 'jbRegion', 'jbHousingOnly'].forEach(function (id) {
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

  syncPosition();
  syncPay();
  load().catch(function () {
    el('jbList').innerHTML = '';
    el('jbEmpty').hidden = false;
  });
  nav.route();
}());
