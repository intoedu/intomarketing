/* 게시판 세 갈래 관리 — 중고 장터 · 게스트하우스 · 집회 티켓팅
 *
 * 부동산 매물 게시판(listings.js)과 하는 일이 같습니다.
 *   · 올라온 글을 열어 사진과 내용을 확인
 *   · 게시 / 반려 / 내리기
 * 다만 등록비를 받지 않아 입금 확인 단계가 없습니다.
 *
 * 하나 더 있는 것이 [설치 대행] 입니다 — 장터에서 물건을 산 교회가
 * "달아 주세요" 하고 부르는 창구이고, 센터가 실제로 돈을 받는 자리입니다.
 * 그래서 접수되면 대기 건수가 사이드바에 바로 뜹니다.
 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var ST_CLASS = {
    pending: 'hold',
    published: 'done',
    closed: 'progress',
    rejected: 'canceled',
    hidden: 'canceled',
    done: 'received',
  };

  var IV_CLASS = {
    received: 'hold', quoted: 'progress', scheduled: 'progress',
    done: 'done', canceled: 'canceled',
  };

  function userOf(state, id) {
    return (state.users || []).filter(function (u) { return u.id === id; })[0] || null;
  }

  function photoStrip(photos) {
    var list = Array.isArray(photos) ? photos : [];
    if (!list.length) return '<p class="adm-card-lead">올린 사진이 없습니다.</p>';
    return '<div class="ls-adm-shots">' + list.map(function (p, i) {
      return '<a href="' + h(p.url || '') + '" target="_blank" rel="noopener">' +
        '<img src="' + h(p.url || '') + '" alt="사진 ' + (i + 1) + '" loading="lazy"></a>';
    }).join('') + '</div>';
  }

  function stateTag(label, cls) {
    return '<span class="st st-' + h(cls) + '">' + h(label) + '</span>';
  }

  /**
   * 목록 · 서랍이 세 갈래 모두 같은 모양이라 하나로 묶었습니다.
   * 갈래마다 다른 것은 cfg 로 받습니다.
   */
  function boardView(cfg) {
    var filter = 'pending';
    var q = '';

    function rowsOf(state) {
      return (state[cfg.collection] || []).slice().sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    }

    function openRow(row, state) {
      var v = cfg.view(row);
      var u = userOf(state, row.userId);

      A.openDrawer({
        title: row[cfg.titleKey] || '(제목 없음)',
        sub: v.label + ' · ' + (u ? (u.name || u.email) : (row.userEmail || '등록 계정 알 수 없음')),
        body:
          '<div class="adm-card">' + cfg.detail(row, v, state) + '</div>' +
          '<div class="adm-card">' +
            '<h3>사진 ' + ((row.photos || []).length) + '장</h3>' +
            photoStrip(row.photos) +
          '</div>' +
          (row.rejectNote
            ? '<div class="adm-card"><h3>남긴 사유</h3><p class="adm-card-lead">' +
              h(row.rejectNote) + '</p></div>'
            : '') +
          '<div class="adm-card">' +
            '<h3>처리</h3>' +
            '<div class="adm-actions">' +
              (row.status !== 'published'
                ? '<button type="button" class="btn btn-primary" id="bdApprove">게시하기</button>' : '') +
              (row.status === 'published'
                ? '<button type="button" class="btn btn-outline" id="bdHide">내리기</button>' : '') +
              (row.status !== 'rejected'
                ? '<button type="button" class="btn btn-outline is-danger" id="bdReject">반려하기</button>' : '') +
            '</div>' +
            '<div class="field" style="margin-top:12px">' +
              '<label for="bdNote">사유 · 메모</label>' +
              '<textarea id="bdNote" rows="3" placeholder="반려하실 때는 반드시 적어 주세요. 등록자에게 그대로 보입니다."></textarea>' +
            '</div>' +
          '</div>',

        onMount: function (root) {
          var note = function () { return root.querySelector('#bdNote').value; };

          var ok = root.querySelector('#bdApprove');
          if (ok) {
            ok.addEventListener('click', function () {
              ok.disabled = true;
              cfg.approve(row.id).then(function () {
                A.toast('게시했습니다.');
                A.closeDrawer();
              }).catch(function (err) { A.toast(err.message, 'err'); ok.disabled = false; });
            });
          }

          var hide = root.querySelector('#bdHide');
          if (hide) {
            hide.addEventListener('click', function () {
              hide.disabled = true;
              cfg.hide(row.id, note()).then(function () {
                A.toast('게시를 중지했습니다.');
                A.closeDrawer();
              }).catch(function (err) { A.toast(err.message, 'err'); hide.disabled = false; });
            });
          }

          var no = root.querySelector('#bdReject');
          if (no) {
            no.addEventListener('click', function () {
              if (!note().trim()) {
                A.toast('반려 사유를 적어 주세요. 등록자에게 그대로 보입니다.', 'err');
                root.querySelector('#bdNote').focus();
                return;
              }
              no.disabled = true;
              cfg.reject(row.id, note()).then(function () {
                A.toast('반려했습니다.');
                A.closeDrawer();
              }).catch(function (err) { A.toast(err.message, 'err'); no.disabled = false; });
            });
          }
        },
      });
    }

    return {
      title: cfg.title,
      nav: cfg.nav,
      desc: cfg.desc,
      icon: 'listings',
      perm: 'customers',
      alerts: function (state) {
        return (state[cfg.collection] || []).filter(function (r) {
          return r.status === 'pending';
        }).map(function (r) { return r.id; });
      },

      render: function (root, state, ctx) {
        var all = rowsOf(state);
        var needle = q.trim().toLowerCase();

        var rows = all.filter(function (r) {
          if (filter === 'pending' && r.status !== 'pending') return false;
          if (filter === 'published' && r.status !== 'published') return false;
          if (!needle) return true;
          return cfg.haystack(r).toLowerCase().indexOf(needle) > -1;
        });

        var counts = {
          pending: all.filter(function (r) { return r.status === 'pending'; }).length,
          published: all.filter(function (r) { return r.status === 'published'; }).length,
        };

        ctx.actions.innerHTML =
          '<button type="button" class="btn btn-outline btn-sm" id="bdCsv">CSV 내려받기</button>';

        root.innerHTML =
          '<div class="adm-card">' +
            '<div class="adm-stats">' +
              '<div class="adm-stat"><strong>' + counts.pending + '</strong><span>확인 대기</span></div>' +
              '<div class="adm-stat"><strong>' + counts.published + '</strong><span>게시 중</span></div>' +
              '<div class="adm-stat"><strong>' + all.length + '</strong><span>전체</span></div>' +
            '</div>' +
            '<div class="adm-toolbar">' +
              '<input type="search" id="bdQ" placeholder="' + h(cfg.searchHint) + '" value="' + h(q) + '">' +
              '<select id="bdFilter">' +
                '<option value="pending"' + (filter === 'pending' ? ' selected' : '') + '>확인 대기</option>' +
                '<option value="published"' + (filter === 'published' ? ' selected' : '') + '>게시 중</option>' +
                '<option value="all"' + (filter === 'all' ? ' selected' : '') + '>전체</option>' +
              '</select>' +
            '</div>' +
            '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
              cfg.columns.map(function (c) { return '<th>' + h(c) + '</th>'; }).join('') +
            '</tr></thead><tbody id="bdRows">' +
              (rows.length
                ? rows.map(function (r) {
                  var v = cfg.view(r);
                  return '<tr data-id="' + h(r.id) + '" class="is-click">' +
                    cfg.cells(r, v, state).join('') +
                    '<td>' + stateTag(v.label, ST_CLASS[r.status] || 'received') + '</td>' +
                  '</tr>';
                }).join('')
                : A.emptyRow(cfg.columns.length, '해당하는 글이 없습니다.')) +
            '</tbody></table></div>' +
          '</div>';

        root.querySelector('#bdQ').addEventListener('input', function (e) {
          q = e.target.value;
          A.rerender();
          var box = document.getElementById('bdQ');
          if (box) { box.focus(); box.setSelectionRange(q.length, q.length); }
        });

        root.querySelector('#bdFilter').addEventListener('change', function (e) {
          filter = e.target.value;
          A.rerender();
        });

        root.querySelector('#bdRows').addEventListener('click', function (e) {
          var tr = e.target.closest('tr[data-id]');
          if (!tr) return;
          var hit = all.filter(function (r) { return r.id === tr.dataset.id; })[0];
          if (hit) openRow(hit, state);
        });

        ctx.actions.querySelector('#bdCsv').addEventListener('click', function () {
          A.downloadCsv(cfg.csvName, cfg.csvHead, rows.map(function (r) {
            return cfg.csvRow(r, cfg.view(r), state);
          }));
        });
      },
    };
  }

  /* =========================================================
     중고 장터
     ========================================================= */

  A.register('marketBoard', boardView({
    collection: 'marketItems',
    title: '중고 장터',
    nav: '중고 장터',
    desc: '올라온 물건을 확인해 게시하거나 내립니다. 등록비는 받지 않습니다 — 센터의 몫은 설치 대행료입니다.',
    titleKey: 'title',
    searchHint: '제목 · 상표 · 지역으로 검색',
    view: function (r) { return db.marketView(r); },
    haystack: function (r) {
      return [r.title, r.brand, r.model, r.region, r.userEmail].join(' ');
    },
    columns: ['제목', '갈래', '값', '지역', '설치', '등록일', '상태'],
    cells: function (r, v) {
      return [
        '<td class="strong">' + h(r.title || '(제목 없음)') + '</td>',
        '<td>' + h(v.categoryLabel) + '</td>',
        '<td>' + h(db.marketPrice(r)) + '</td>',
        '<td>' + h(r.region || '') + '</td>',
        '<td>' + (v.installable ? '가능' : '-') + '</td>',
        '<td>' + h(db.formatDate(r.createdAt, false)) + '</td>',
      ];
    },
    detail: function (r, v) {
      return '<dl class="adm-dl">' +
        '<div><dt>갈래</dt><dd>' + h(v.categoryLabel) + '</dd></div>' +
        '<div><dt>상태</dt><dd>' + h(v.conditionLabel) + '</dd></div>' +
        '<div><dt>만든 곳 · 모델</dt><dd>' + h([r.brand, r.model].filter(Boolean).join(' ') || '-') + '</dd></div>' +
        '<div><dt>수량</dt><dd>' + (Number(r.quantity) || 1) + '개</dd></div>' +
        '<div><dt>값</dt><dd>' + h(db.marketPrice(r)) + '</dd></div>' +
        '<div><dt>지역</dt><dd>' + h([r.region, r.addressRough].filter(Boolean).join(' · ')) + '</dd></div>' +
        '<div><dt>넘기는 방법</dt><dd>' + h(v.deliveryLabel) + '</dd></div>' +
        '<div><dt>설치 대행</dt><dd>' + (v.installable ? '안내해도 좋다고 하셨습니다' : '원하지 않으십니다') + '</dd></div>' +
        '<div><dt>연락처</dt><dd>' + h(r.contactName) + ' · ' + h(db.formatPhone(r.contactPhone)) + '</dd></div>' +
        '<div><dt>연락 가능 시간</dt><dd>' + h(r.contactHours || '-') + '</dd></div>' +
        '</dl>' +
        '<h3>설명</h3><p class="adm-card-lead">' + h(r.desc || '') + '</p>' +
        (r.installNote ? '<h3>설치 메모</h3><p class="adm-card-lead">' + h(r.installNote) + '</p>' : '');
    },
    approve: function (id) { return db.approveMarketItem(id); },
    reject: function (id, note) { return db.rejectMarketItem(id, note); },
    hide: function (id, note) { return db.hideMarketItem(id, note); },
    csvName: 'wcsc-중고장터.csv',
    csvHead: ['제목', '갈래', '상태', '값', '수량', '지역', '설치 가능',
      '등록 계정', '연락처', '연락 가능 시간', '게시 상태', '등록일', '게시일', '사유'],
    csvRow: function (r, v, state) {
      var u = userOf(state, r.userId);
      return [r.title, v.categoryLabel, v.conditionLabel, db.marketPrice(r),
        r.quantity, r.region, v.installable ? '가능' : '',
        u ? u.email : (r.userEmail || ''), db.formatPhone(r.contactPhone), r.contactHours,
        v.label, db.formatDate(r.createdAt, false),
        r.publishedAt ? db.formatDate(r.publishedAt, false) : '', r.rejectNote];
    },
  }));

  /* =========================================================
     게스트하우스
     ========================================================= */

  A.register('guestBoard', boardView({
    collection: 'guestHouses',
    title: '게스트하우스',
    nav: '게스트하우스',
    desc: '교회가 내어 놓은 방을 확인해 게시하거나 내립니다. 요금과 기간은 교회와 머무실 분이 정합니다.',
    titleKey: 'title',
    searchHint: '제목 · 교회명 · 지역으로 검색',
    view: function (r) { return db.guestView(r); },
    haystack: function (r) {
      return [r.title, r.churchName, r.region, r.userEmail].join(' ');
    },
    columns: ['제목', '교회', '형태', '요금', '지역', '등록일', '상태'],
    cells: function (r, v) {
      return [
        '<td class="strong">' + h(r.title || '(제목 없음)') + '</td>',
        '<td>' + h(r.churchName || '') + '</td>',
        '<td>' + h(v.roomLabel) + '</td>',
        '<td>' + h(db.guestPrice(r)) + '</td>',
        '<td>' + h(r.region || '') + '</td>',
        '<td>' + h(db.formatDate(r.createdAt, false)) + '</td>',
      ];
    },
    detail: function (r, v) {
      return '<dl class="adm-dl">' +
        '<div><dt>교회</dt><dd>' + h([r.churchName, r.denomination].filter(Boolean).join(' · ')) + '</dd></div>' +
        '<div><dt>형태</dt><dd>' + h(v.roomLabel) + ' · ' + h(v.bathLabel) + '</dd></div>' +
        '<div><dt>최대 인원</dt><dd>' + (Number(r.guestsMax) || 1) + '명</dd></div>' +
        '<div><dt>요금</dt><dd>' + h(db.guestPrice(r)) + '</dd></div>' +
        '<div><dt>지역</dt><dd>' + h([r.region, r.addressRough, r.nearest].filter(Boolean).join(' · ')) + '</dd></div>' +
        '<div><dt>모시는 분</dt><dd>' + h(v.typeLabels.join(' · ') || '-') + '</dd></div>' +
        '<div><dt>있는 것</dt><dd>' + h(v.amenityLabels.join(' · ') || '-') + '</dd></div>' +
        '<div><dt>언어</dt><dd>' + h(v.languages.join(' · ') || '-') + '</dd></div>' +
        '<div><dt>연락처</dt><dd>' + h(r.contactName) + ' · ' + h(db.formatPhone(r.contactPhone)) + '</dd></div>' +
        '<div><dt>연락 가능 시간</dt><dd>' + h(r.contactHours || '-') + '</dd></div>' +
        '</dl>' +
        '<h3>소개</h3><p class="adm-card-lead">' + h(r.desc || '') + '</p>' +
        (r.houseRules ? '<h3>지켜 주셨으면 하는 것</h3><p class="adm-card-lead">' + h(r.houseRules) + '</p>' : '');
    },
    approve: function (id) { return db.approveGuestHouse(id); },
    reject: function (id, note) { return db.rejectGuestHouse(id, note); },
    hide: function (id, note) { return db.hideGuestHouse(id, note); },
    csvName: 'wcsc-게스트하우스.csv',
    csvHead: ['제목', '교회', '교단', '형태', '최대 인원', '요금', '지역',
      '모시는 분', '등록 계정', '연락처', '연락 가능 시간', '게시 상태', '등록일', '사유'],
    csvRow: function (r, v, state) {
      var u = userOf(state, r.userId);
      return [r.title, r.churchName, r.denomination, v.roomLabel, r.guestsMax,
        db.guestPrice(r), r.region, v.typeLabels.join(' · '),
        u ? u.email : (r.userEmail || ''), db.formatPhone(r.contactPhone), r.contactHours,
        v.label, db.formatDate(r.createdAt, false), r.rejectNote];
    },
  }));

  /* =========================================================
     교역자 구인 공고

     여기서 보는 것은 하나입니다 — 사례비 · 사택 · 교통이
     실제로 적혀 있는가. 이 셋이 비어 있으면
     지원이 오지 않아, 게시해도 교회에 도움이 되지 않습니다.
     ========================================================= */

  A.register('jobBoard', boardView({
    collection: 'jobPosts',
    title: '교역자 구인',
    nav: '교역자 구인',
    desc: '교회가 올린 구인 공고를 확인해 게시합니다. 사례비 · 사택 · 교통이 적혀 있는지 보아 주세요.',
    titleKey: 'title',
    searchHint: '공고 제목 · 교회명 · 지역으로 검색',
    view: function (r) { return db.jobView(r); },
    haystack: function (r) {
      return [r.title, r.churchName, r.region, r.department, r.userEmail].join(' ');
    },
    columns: ['제목', '교회', '직분', '사례비', '사택', '지역', '등록일', '상태'],
    cells: function (r, v) {
      return [
        '<td class="strong">' + h(r.title || '(제목 없음)') + '</td>',
        '<td>' + h(r.churchName || '') + '</td>',
        '<td>' + h(v.positionLabel) + '</td>',
        '<td>' + h(db.jobPay(r)) + '</td>',
        '<td>' + h(v.housingLabel) + '</td>',
        '<td>' + h(r.region || '') + '</td>',
        '<td>' + h(db.formatDate(r.createdAt, false)) + '</td>',
      ];
    },
    detail: function (r, v) {
      return '<dl class="adm-dl">' +
        '<div><dt>교회</dt><dd>' + h([r.churchName, r.denomination, r.churchSize].filter(Boolean).join(' · ')) + '</dd></div>' +
        '<div><dt>직분 · 형태</dt><dd>' + h(v.positionLabel) + ' · ' + h(v.employmentLabel) +
          (r.department ? ' · ' + h(r.department) : '') + '</dd></div>' +
        '<div><dt>모집 인원</dt><dd>' + (Number(r.headcount) || 1) + '명</dd></div>' +
        '<div><dt>사례비</dt><dd>' + h(db.jobPay(r)) +
          (r.payNote ? ' · ' + h(r.payNote) : '') + '</dd></div>' +
        '<div><dt>사택</dt><dd>' + h(v.housingLabel) +
          (r.insurance ? ' · 4대보험 가입' : '') + '</dd></div>' +
        '<div><dt>근무 요일</dt><dd>' + h(r.workDays || '-') + '</dd></div>' +
        '<div><dt>지역</dt><dd>' + h([r.region, r.addressRough].filter(Boolean).join(' · ')) + '</dd></div>' +
        '<div><dt>부임 희망</dt><dd>' + h(r.startDate || '-') + '</dd></div>' +
        '<div><dt>모집 마감</dt><dd>' + h(r.closesAt ? db.formatDate(r.closesAt, false) : '구할 때까지') + '</dd></div>' +
        '<div><dt>연락처</dt><dd>' + h(r.contactName) + ' · ' + h(db.formatPhone(r.contactPhone)) +
          (r.contactEmail ? ' · ' + h(r.contactEmail) : '') + '</dd></div>' +
        '<div><dt>연락 가능 시간</dt><dd>' + h(r.contactHours || '-') + '</dd></div>' +
        '</dl>' +
        (r.commuteNote ? '<h3>오가는 길</h3><p class="adm-card-lead">' + h(r.commuteNote) + '</p>' : '') +
        '<h3>교회 소개와 하실 일</h3><p class="adm-card-lead">' + h(r.desc || '') + '</p>' +
        (r.qualification ? '<h3>바라는 자격</h3><p class="adm-card-lead">' + h(r.qualification) + '</p>' : '');
    },
    approve: function (id) { return db.approveJobPost(id); },
    reject: function (id, note) { return db.rejectJobPost(id, note); },
    hide: function (id, note) { return db.hideJobPost(id, note); },
    csvName: 'wcsc-교역자구인.csv',
    csvHead: ['제목', '교회', '교단', '직분', '근무 형태', '부서', '모집 인원', '사례비',
      '사택', '4대보험', '지역', '근무 요일', '부임 희망', '모집 마감',
      '등록 계정', '담당자', '연락처', '이메일', '연락 가능 시간', '게시 상태', '등록일', '사유'],
    csvRow: function (r, v, state) {
      var u = userOf(state, r.userId);
      return [r.title, r.churchName, r.denomination, v.positionLabel, v.employmentLabel,
        r.department, r.headcount, db.jobPay(r), v.housingLabel, r.insurance ? '가입' : '',
        r.region, r.workDays, r.startDate,
        r.closesAt ? db.formatDate(r.closesAt, false) : '구할 때까지',
        u ? u.email : (r.userEmail || ''), r.contactName, db.formatPhone(r.contactPhone),
        r.contactEmail, r.contactHours,
        v.label, db.formatDate(r.createdAt, false), r.rejectNote];
    },
  }));

  /* =========================================================
     집회 티켓팅

     여기만 하나 더 봅니다 — 신청 현황입니다.
     정원이 찬 집회는 자동으로 마감되므로 직원이 손댈 일은 없지만,
     "얼마나 찼는지" 는 한눈에 보여야 합니다.
     ========================================================= */

  A.register('eventBoard', boardView({
    collection: 'events',
    title: '집회 티켓팅',
    nav: '집회 티켓팅',
    desc: '올라온 집회의 주최 · 장소 · 일시를 확인해 게시합니다. 정원이 차면 자동으로 마감됩니다.',
    titleKey: 'title',
    searchHint: '집회 이름 · 주최 · 장소로 검색',
    view: function (r) { return db.eventView(r); },
    haystack: function (r) {
      return [r.title, r.host, r.venue, r.region, r.userEmail].join(' ');
    },
    columns: ['집회', '주최', '일시', '장소', '신청', '참가비', '상태'],
    cells: function (r, v) {
      return [
        '<td class="strong">' + h(r.title || '(이름 없음)') + '</td>',
        '<td>' + h(r.host || '') + '</td>',
        '<td>' + h(r.startsAt ? db.formatDate(r.startsAt, false) : '-') + '</td>',
        '<td>' + h([r.region, r.venue].filter(Boolean).join(' · ')) + '</td>',
        '<td>' + v.taken + (v.capacity ? ' / ' + v.capacity : '') + '</td>',
        '<td>' + h(db.eventPrice(r)) + '</td>',
      ];
    },
    detail: function (r, v, state) {
      var orders = (state.ticketOrders || []).filter(function (o) {
        return o.eventId === r.id && o.status !== 'canceled';
      });
      return '<dl class="adm-dl">' +
        '<div><dt>갈래</dt><dd>' + h(v.categoryLabel) + '</dd></div>' +
        '<div><dt>주최</dt><dd>' + h(r.host || '-') + '</dd></div>' +
        '<div><dt>강사 · 찬양팀</dt><dd>' + h(r.speakers || '-') + '</dd></div>' +
        '<div><dt>일시</dt><dd>' + h(r.startsAt ? db.formatDate(r.startsAt) : '-') + '</dd></div>' +
        '<div><dt>장소</dt><dd>' + h([r.venue, r.address].filter(Boolean).join(' · ')) + '</dd></div>' +
        '<div><dt>예매 시작</dt><dd>' + h(r.openAt ? db.formatDate(r.openAt) : '게시 즉시') + '</dd></div>' +
        '<div><dt>신청 마감</dt><dd>' + h(r.closeAt ? db.formatDate(r.closeAt) : '집회 시작까지') + '</dd></div>' +
        '<div><dt>정원</dt><dd>' + (v.capacity ? v.capacity + '명' : '제한 없음') +
          ' · 신청 ' + v.taken + '명' + (v.left != null ? ' · ' + v.left + '석 남음' : '') + '</dd></div>' +
        '<div><dt>참가비</dt><dd>' + h(db.eventPrice(r)) + '</dd></div>' +
        '<div><dt>좌석</dt><dd>' + (v.seating
          ? '좌석 지정 (' + db.seatmapCount(r.seatmap) + '석)'
          : '지정 없음 — 인원수로 받습니다') + '</dd></div>' +
        '<div><dt>문의</dt><dd>' + h(r.contactName) + ' · ' + h(db.formatPhone(r.contactPhone)) + '</dd></div>' +
        '</dl>' +
        (v.pct != null
          ? '<p class="adm-card-lead"><span class="tk-bar"><span class="tk-bar-in" style="width:' +
            v.pct + '%"></span></span> 정원의 ' + v.pct + '% 가 찼습니다 (신청 ' + orders.length + '건).</p>'
          : '') +
        '<h3>집회 소개</h3><p class="adm-card-lead">' + h(r.desc || '') + '</p>' +
        (r.notice ? '<h3>신청 전 안내</h3><p class="adm-card-lead">' + h(r.notice) + '</p>' : '');
    },
    approve: function (id) { return db.approveEvent(id); },
    reject: function (id, note) { return db.rejectEvent(id, note); },
    hide: function (id, note) { return db.hideEvent(id, note); },
    csvName: 'wcsc-집회티켓팅.csv',
    csvHead: ['집회', '갈래', '주최', '일시', '장소', '예매 시작', '정원', '신청',
      '참가비', '좌석 지정', '등록 계정', '문의', '게시 상태', '등록일', '사유'],
    csvRow: function (r, v, state) {
      var u = userOf(state, r.userId);
      return [r.title, v.categoryLabel, r.host,
        r.startsAt ? db.formatDate(r.startsAt) : '',
        [r.region, r.venue].filter(Boolean).join(' · '),
        r.openAt ? db.formatDate(r.openAt) : '게시 즉시',
        v.capacity || '제한 없음', v.taken, db.eventPrice(r),
        v.seating ? '지정' : '', u ? u.email : (r.userEmail || ''),
        db.formatPhone(r.contactPhone), v.label,
        db.formatDate(r.createdAt, false), r.rejectNote];
    },
  }));

  /* =========================================================
     설치 대행 문의

     센터가 실제로 돈을 받는 자리입니다 — 접수되면 바로 눈에 띄어야 해서
     대기 건수를 사이드바에 띄웁니다.
     ========================================================= */

  var ivFilter = 'open';

  A.register('installs', {
    title: '설치 대행',
    nav: '설치 대행',
    desc: '장터에서 산 장비를 달아 달라는 문의입니다. 실측 후 견적을 확정해 드립니다.',
    icon: 'requests',
    perm: 'requests',
    alerts: function (state) {
      return (state.installRequests || []).filter(function (r) {
        return r.status === 'received';
      }).map(function (r) { return r.id; });
    },

    render: function (root, state, ctx) {
      var all = (state.installRequests || []).slice().sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });

      var rows = all.filter(function (r) {
        if (ivFilter === 'open') return r.status !== 'done' && r.status !== 'canceled';
        if (ivFilter === 'done') return r.status === 'done';
        return true;
      });

      var pending = all.filter(function (r) { return r.status === 'received'; }).length;
      var scheduled = all.filter(function (r) { return r.status === 'scheduled'; }).length;
      var earned = all.filter(function (r) { return r.status === 'done'; })
        .reduce(function (n, r) { return n + (Number(r.quoteAmount) || 0); }, 0);

      ctx.actions.innerHTML =
        '<button type="button" class="btn btn-outline btn-sm" id="ivCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-card">' +
          '<div class="adm-stats">' +
            '<div class="adm-stat"><strong>' + pending + '</strong><span>새 문의</span></div>' +
            '<div class="adm-stat"><strong>' + scheduled + '</strong><span>일정 확정</span></div>' +
            '<div class="adm-stat"><strong>' + A.money(earned) + '원</strong><span>완료된 설치비 합계</span></div>' +
          '</div>' +
          '<div class="adm-toolbar">' +
            '<select id="ivFilter">' +
              '<option value="open"' + (ivFilter === 'open' ? ' selected' : '') + '>진행 중</option>' +
              '<option value="done"' + (ivFilter === 'done' ? ' selected' : '') + '>완료</option>' +
              '<option value="all"' + (ivFilter === 'all' ? ' selected' : '') + '>전체</option>' +
            '</select>' +
          '</div>' +
          '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
            '<th>교회</th><th>물건</th><th>범위</th><th>지역</th><th>희망일</th><th>견적</th><th>상태</th>' +
          '</tr></thead><tbody id="ivRows">' +
            (rows.length
              ? rows.map(function (r) {
                var tier = db.INSTALL_TIERS[r.tier] || {};
                return '<tr data-id="' + h(r.id) + '" class="is-click">' +
                  '<td class="strong">' + h(r.churchName || '') + '</td>' +
                  '<td>' + h(r.itemTitle || '') + '</td>' +
                  '<td>' + h(tier.label || r.tier) + '</td>' +
                  '<td>' + h(r.region || '') + '</td>' +
                  '<td>' + h(r.wishDate || '-') + '</td>' +
                  '<td>' + (Number(r.quoteAmount) ? A.money(r.quoteAmount) + '원' : '-') + '</td>' +
                  '<td>' + stateTag(db.INSTALL_STATUS[r.status] || r.status,
                    IV_CLASS[r.status] || 'received') + '</td>' +
                '</tr>';
              }).join('')
              : A.emptyRow(7, '해당하는 문의가 없습니다.')) +
          '</tbody></table></div>' +
        '</div>';

      root.querySelector('#ivFilter').addEventListener('change', function (e) {
        ivFilter = e.target.value;
        A.rerender();
      });

      root.querySelector('#ivRows').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (!tr) return;
        var r = all.filter(function (x) { return x.id === tr.dataset.id; })[0];
        if (!r) return;

        var tier = db.INSTALL_TIERS[r.tier] || {};

        A.openDrawer({
          title: r.churchName || '(교회명 없음)',
          sub: (tier.label || r.tier) + ' · ' + (db.INSTALL_STATUS[r.status] || r.status),
          body:
            '<div class="adm-card"><dl class="adm-dl">' +
              '<div><dt>설치할 물건</dt><dd>' + h(r.itemTitle || '-') + '</dd></div>' +
              '<div><dt>맡기시는 범위</dt><dd>' + h(tier.label || r.tier) + '</dd></div>' +
              '<div><dt>주소</dt><dd>' + h([r.region, r.address].filter(Boolean).join(' ')) + '</dd></div>' +
              '<div><dt>층 · 엘리베이터</dt><dd>' +
                h([r.floor, r.elevator].filter(Boolean).join(' · ') || '-') + '</dd></div>' +
              '<div><dt>희망일</dt><dd>' + h(r.wishDate || '-') + '</dd></div>' +
              '<div><dt>연락처</dt><dd>' + h(r.contactName) + ' · ' +
                h(db.formatPhone(r.contactPhone)) + '</dd></div>' +
              '<div><dt>연락 가능 시간</dt><dd>' + h(r.contactHours || '-') + '</dd></div>' +
            '</dl>' +
            (r.note ? '<h3>남기신 말씀</h3><p class="adm-card-lead">' + h(r.note) + '</p>' : '') +
            '</div>' +

            '<div class="adm-card">' +
              '<h3>견적과 일정</h3>' +
              '<div class="field"><label for="ivAmount">확정 견적 (원)</label>' +
                '<input type="number" id="ivAmount" value="' + (Number(r.quoteAmount) || '') + '"></div>' +
              '<div class="field"><label for="ivNote">견적 메모</label>' +
                '<textarea id="ivNote" rows="3">' + h(r.quoteNote || '') + '</textarea></div>' +
              '<div class="field"><label for="ivStatus">상태</label>' +
                '<select id="ivStatus">' +
                  Object.keys(db.INSTALL_STATUS).map(function (k) {
                    return '<option value="' + k + '"' + (r.status === k ? ' selected' : '') + '>' +
                      h(db.INSTALL_STATUS[k]) + '</option>';
                  }).join('') +
                '</select></div>' +
              '<div class="adm-actions">' +
                '<button type="button" class="btn btn-primary" id="ivSave">저장</button>' +
              '</div>' +
            '</div>',

          onMount: function (box) {
            box.querySelector('#ivSave').addEventListener('click', function (ev) {
              ev.target.disabled = true;
              db.updateInstallRequest(r.id, {
                quoteAmount: Number(box.querySelector('#ivAmount').value) || 0,
                quoteNote: box.querySelector('#ivNote').value.trim(),
                status: box.querySelector('#ivStatus').value,
              }).then(function () {
                A.toast('저장했습니다.');
                A.closeDrawer();
              }).catch(function (err) {
                A.toast(err.message, 'err');
                ev.target.disabled = false;
              });
            });
          },
        });
      });

      ctx.actions.querySelector('#ivCsv').addEventListener('click', function () {
        A.downloadCsv('wcsc-설치대행.csv',
          ['교회', '물건', '범위', '지역', '주소', '층', '엘리베이터', '희망일',
            '담당자', '연락처', '연락 가능 시간', '상태', '확정 견적', '견적 메모', '접수일'],
          rows.map(function (r) {
            var t = db.INSTALL_TIERS[r.tier] || {};
            return [r.churchName, r.itemTitle, t.label || r.tier, r.region, r.address,
              r.floor, r.elevator, r.wishDate, r.contactName,
              db.formatPhone(r.contactPhone), r.contactHours,
              db.INSTALL_STATUS[r.status] || r.status, r.quoteAmount, r.quoteNote,
              db.formatDate(r.createdAt, false)];
          }));
      });
    },
  });
})();
