/* 매물 게시판 관리 — 올라온 글을 확인해 게시하거나 내립니다.
 *
 * 센터가 게시판에서 하는 일은 이것뿐입니다.
 *   · 권리 증빙 서류를 열어 실제 매물주 · 세입자인지 확인
 *   · 등록비(6만원) 입금 확인
 *   · 게시 / 반려 / 내리기
 * 중개나 조건 협의는 하지 않습니다.
 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var filter = 'pending'; // pending | published | all
  var q = '';

  var ST_CLASS = {
    pending: 'hold', edit_pending: 'hold', awaiting_payment: 'progress', published: 'done',
    rejected: 'canceled', hidden: 'canceled',
    done: 'received',    // 거래 완료 — 잘 끝난 것이므로 반려와 구분합니다
    expired: 'received', // (옛 기간 제한 시절의 글)
  };

  var BOARD = window.CAPS_LISTING_BOARD || {};

  /** 카카오톡으로 보낼 계좌 — src/data/site.js 의 site.listingBoard.bank */
  function bankLine() {
    return BOARD.bank || '(계좌가 설정되지 않았습니다 — src/data/site.js 의 listingBoard.bank)';
  }

  /** 승인 시 카카오톡으로 보낼 안내문 (그대로 복사해 붙이도록) */
  function kakaoText(row) {
    return '안녕하세요, 우리교회지원센터입니다.\n\n'
      + '올려주신 매물 「' + (row.title || '') + '」 의 권리 증빙 서류를 확인했습니다.\n'
      + '아래 계좌로 등록비를 보내주시면 확인 후 바로 게시해 드립니다.\n\n'
      + '· 등록비 : ' + db.money(db.LISTING_FEE) + '원\n'
      + '· 계좌   : ' + bankLine() + '\n'
      + '· 게시 기간 : ' + db.LISTING_DAYS + '일\n\n'
      + '입금이 확인되면 게시글이 올라갑니다. 감사합니다.';
  }

  function copy(text, btn, okMsg) {
    var original = btn.textContent;
    var write = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
    write.then(function () {
      btn.textContent = '복사됨 ✓';
      A.toast(okMsg || '복사했습니다.');
      window.setTimeout(function () { btn.textContent = original; }, 1800);
    }).catch(function () {
      A.toast('복사가 막혀 있습니다. 아래 칸을 직접 선택해 복사해 주세요.', 'err');
    });
  }

  function userOf(state, id) {
    return state.users.filter(function (u) { return u.id === id; })[0] || null;
  }

  function kb(n) {
    var v = Number(n) || 0;
    if (v >= 1048576) return (Math.round(v / 104857.6) / 10) + 'MB';
    return Math.max(1, Math.round(v / 1024)) + 'KB';
  }

  /* ---------------- 증빙 서류 ---------------- */

  /** 서류는 게시판에 공개되지 않습니다. 여기서만 새 창으로 엽니다. */
  function openProof(row, btn) {
    if (!row.proof || !row.proof.path) {
      A.toast('첨부된 서류가 없습니다.', 'err');
      return;
    }
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '여는 중…';
    db.proofUrl(row.proof.path).then(function (url) {
      btn.disabled = false;
      btn.textContent = label;
      if (!url) {
        A.toast('서류 파일을 열 수 없습니다. 저장소 설정(storage.rules)을 확인해 주세요.', 'err');
        return;
      }
      window.open(url, '_blank', 'noopener');
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = label;
      A.toast(err.message || '서류를 열지 못했습니다.', 'err');
    });
  }

  /* ---------------- 상세 서랍 ---------------- */

  function money(n) {
    return db.money(n) + '원';
  }

  function priceBlock(r) {
    var out = [];
    if (r.kind === 'sale') out.push(['매매가', money(r.salePrice)]);
    if (r.kind === 'rent_jeonse') out.push(['전세금', money(r.deposit)]);
    if (r.kind === 'rent_monthly') {
      out.push(['보증금', money(r.deposit)]);
      out.push(['월세', money(r.monthly)]);
    }
    if (r.kind === 'share') out.push(['대여료', r.monthly ? money(r.monthly) : '협의']);
    if (r.maintenance) out.push(['관리비', money(r.maintenance) + ' / 월']);
    return out;
  }

  function rowsHtml(pairs) {
    return pairs.filter(function (p) { return p[1]; })
      .map(function (p) {
        return '<div><dt>' + h(p[0]) + '</dt><dd>' + h(p[1]) + '</dd></div>';
      }).join('');
  }

  function openRow(row, state) {
    var v = db.listingView(row);
    var u = userOf(state, row.userId);
    var fee = row.fee || {};

    var info = rowsHtml([
      ['종류', v.kindLabel],
      ['용도', v.useLabel],
      ['위치', row.addressRough || row.region],
      ['면적', row.area],
      ['층', row.floor],
      ['주차', row.parking],
    ].concat(priceBlock(row)).concat([
      ['입주 가능', row.moveIn],
      ['종교시설 사용', row.religiousUse],
      ['연락 가능 시간', row.contactHours || '(적지 않음)'],
      ['사진', v.photos.length + '장'],
      ['등록', db.formatDate(row.createdAt)],
      ['최종 수정', db.formatDate(row.updatedAt)],
      // 수정 재검토 건은 언제 요청했는지가 따로 보여야 합니다.
      ['수정 승인 요청', v.editRequestedAt ? db.formatDate(v.editRequestedAt) : ''],
      ['처음 게시일', v.firstPublishedAt ? db.formatDate(v.firstPublishedAt) : ''],
      ['게시일', row.publishedAt ? db.formatDate(row.publishedAt) : ''],
      ['게시한 지', v.up != null ? v.up + '일' : ''],
      // 기한이 있던 옛 글에만 나옵니다.
      ['게시 종료 (옛 기준)', row.expiresAt ? db.formatDate(row.expiresAt, false) : ''],
    ]));

    var body =
      '<div class="ls-adm-state">' +
        '<span class="st st-' + h(ST_CLASS[v.status] || 'received') + '">' + h(v.label) + '</span>' +
        '<span class="st ' + (fee.paid ? 'st-done' : 'st-hold') + '">등록비 ' +
          (fee.paid ? '입금 확인' : '미확인') + '</span>' +
        (v.status === 'published' && v.up != null
          ? '<span class="sub">게시한 지 ' + v.up + '일</span>' : '') +
        (v.days != null ? '<span class="sub">옛 기한 ' + v.days + '일 남음</span>' : '') +
      '</div>' +

      '<div class="adm-card">' +
        '<h2>권리 증명</h2>' +
        '<p class="adm-card-lead">등록자가 스스로 밝힌 입장과 제출한 서류입니다. ' +
          '서류를 열어 <strong>이름 · 주소가 등록 내용과 맞는지</strong> 확인해 주세요.</p>' +
        '<dl class="adm-dl">' +
          rowsHtml([
            ['등록자 입장', v.holderLabel],
            ['제출 서류', v.proofLabel],
            ['파일', row.proof ? row.proof.name + ' (' + kb(row.proof.size) + ')' : '없음'],
            ['올린 계정', u ? (u.name || '') + ' · ' + u.email : (row.userEmail || row.userId || '-')],
            ['계정 연락처', u && u.phone ? db.formatPhone(u.phone) : ''],
            ['글에 적은 연락처', db.formatPhone(row.contactPhone) + ' (' + (row.contactName || '-') + ')'],
          ]) +
        '</dl>' +
        '<div class="adm-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" id="lsProofOpen">서류 열기 ↗</button>' +
          '<span class="adm-hint">서류는 게시판에 공개되지 않습니다. 이 화면과 등록자 본인만 열 수 있습니다.</span>' +
        '</div>' +
      '</div>' +

      '<div class="adm-card"><h2>매물 내용</h2>' +
        '<p class="adm-card-lead strong">' + h(row.title || '(제목 없음)') + '</p>' +
        (v.photos.length
          ? '<div class="ls-adm-shots">' +
              v.photos.map(function (ph, i) {
                return '<a href="' + h(ph.url || '') + '" target="_blank" rel="noopener"' +
                  ' title="사진 ' + (i + 1) + ' 크게 보기">' +
                  '<img src="' + h(ph.url || '') + '" alt="사진 ' + (i + 1) + '" loading="lazy">' +
                  (i ? '' : '<span>대표</span>') + '</a>';
              }).join('') +
            '</div>'
          : '<p class="adm-hint" style="margin-bottom:14px">사진이 없는 글입니다.</p>') +
        '<dl class="adm-dl">' + info + '</dl>' +
        '<div class="ls-adm-desc">' + h(row.desc || '(설명 없음)') + '</div>' +
      '</div>' +

      (row.rejectNote
        ? '<div class="consent-note is-wait"><strong>지난 반려 · 중지 사유</strong><br>' + h(row.rejectNote) + '</div>'
        : '') +

      /* ---- 수정 승인 요청 — 새 등록과 봐야 할 것이 다릅니다 ---- */
      (v.status === 'edit_pending'
        ? '<div class="adm-card is-step">' +
            '<h2>수정 승인 요청</h2>' +
            '<p class="adm-card-lead">' +
              '<strong>이미 승인해 게시했던 글을 등록자가 고쳤습니다.</strong>' +
              (v.editRequestedAt ? ' 요청 시각: <strong>' + h(db.formatDate(v.editRequestedAt)) + '</strong>' : '') +
              (v.firstPublishedAt ? ' · 처음 게시: ' + h(db.formatDate(v.firstPublishedAt, false)) : '') +
              '<br>서류를 처음부터 다시 볼 필요는 없습니다 — <strong>바뀐 내용</strong>만 확인하고 다시 게시해 주세요. ' +
              '<strong>등록비는 이미 받았습니다</strong> (다시 받지 않습니다).' +
              '<br>확인하는 동안 이 글은 게시판에서 내려가 있습니다.' +
            '</p>' +
            '<div class="adm-actions">' +
              '<button type="button" class="btn btn-primary btn-sm" id="lsEditOk">수정 승인 · 다시 게시</button>' +
              '<button type="button" class="btn btn-outline btn-sm" id="lsReject">반려</button>' +
            '</div>' +
          '</div>'
        : '') +

      /* ---- 1단계: 서류 확인 → 계좌를 카카오톡으로 ---- */
      (v.status === 'pending'
        ? '<div class="adm-card is-step">' +
            '<h2><span class="ls-adm-step">1</span> 서류 확인 · 계좌 안내</h2>' +
            '<p class="adm-card-lead">서류가 맞으면 아래 버튼을 누르고, <strong>안내문을 복사해 등록자에게 ' +
              '카카오톡으로 보내 주세요.</strong> 입금은 그 뒤에 들어옵니다 ' +
              '(확인되지 않은 글에 돈이 먼저 들어오는 일을 막기 위한 순서입니다).</p>' +
            '<div class="ls-kakao">' +
              '<textarea id="lsKakao" rows="9" readonly spellcheck="false">' +
                h(kakaoText(row)) + '</textarea>' +
              '<div class="adm-actions">' +
                '<button type="button" class="btn btn-primary btn-sm" id="lsKakaoCopy">안내문 복사</button>' +
                '<button type="button" class="btn btn-outline btn-sm" id="lsBankCopy">계좌만 복사</button>' +
                '<span class="adm-hint">계좌는 <code>src/data/site.js</code> 의 ' +
                  '<code>listingBoard.bank</code> 에서 바꿉니다.</span>' +
              '</div>' +
            '</div>' +
            '<div class="adm-actions">' +
              '<button type="button" class="btn btn-primary btn-sm" id="lsNotice">' +
                '서류 확인 완료 · 계좌 보냈습니다 → 입금 대기</button>' +
              '<button type="button" class="btn btn-outline btn-sm" id="lsReject">반려</button>' +
            '</div>' +
          '</div>'
        : '') +

      /* ---- 2단계: 입금 확인 → 게시 ---- */
      '<div class="adm-card' + (v.status === 'awaiting_payment' ? ' is-step' : '') + '">' +
        '<h2>' +
          (v.status === 'published' ? '게시 관리'
            : v.status === 'edit_pending' ? '등록비 · 게시 상태'
            : '<span class="ls-adm-step">2</span> 입금 확인 · 게시') +
        '</h2>' +
        (v.status === 'awaiting_payment'
          ? '<p class="adm-card-lead">' +
              (fee.noticeSentAt
                ? '계좌 안내를 ' + h(db.formatDate(fee.noticeSentAt)) + ' 에 보냈습니다. '
                : '') +
              '입금이 들어왔는지 확인한 뒤 아래를 체크하고 [게시하기] 를 눌러 주세요.</p>'
          : '') +
        '<div class="ls-adm-fee">' +
          '<label class="chk"><input type="checkbox" id="lsFeePaid"' +
            (fee.paid ? ' checked' : '') + '>' +
            '<span>등록비 ' + money(fee.amount || db.LISTING_FEE) + ' 입금을 확인했습니다.</span></label>' +
          '<button type="button" class="btn btn-outline btn-sm" id="lsFeeSave">입금 여부만 저장</button>' +
        '</div>' +
        '<p class="field-hint">게시에는 <strong>기한이 없습니다</strong> — 거래가 끝날 때까지 올라가 있습니다. ' +
          '팔리면 등록자가 직접 [거래 완료] 로 내릴 수 있고, 여기서 내려 드릴 수도 있습니다.</p>' +
        '<div class="field">' +
          '<label for="lsNote">반려 · 중지 사유</label>' +
          '<textarea id="lsNote" rows="3" placeholder="예: 제출하신 등기부등본의 소유자 이름이 등록자와 다릅니다.">' +
            h(row.rejectNote || '') + '</textarea>' +
          '<small class="hint">여기 적은 내용이 등록자에게 그대로 보입니다.</small>' +
        '</div>' +
        '<div class="adm-actions">' +
          (v.status === 'published'
            ? '<button type="button" class="btn btn-primary btn-sm" id="lsDone">거래 완료로 내리기</button>' +
              '<button type="button" class="btn btn-outline btn-sm" id="lsHide">게시 중지 (내리기)</button>'
            : '<button type="button" class="btn btn-primary btn-sm" id="lsApprove">' +
                (v.status === 'edit_pending' ? '수정 승인 · 다시 게시' : '게시하기') + '</button>' +
              (v.status === 'pending' || v.status === 'edit_pending' ? '' :
                '<button type="button" class="btn btn-outline btn-sm" id="lsReject">반려</button>')) +
          '<button type="button" class="btn btn-outline btn-sm is-danger" id="lsDelete">삭제</button>' +
        '</div>' +
      '</div>';

    A.openDrawer({
      title: row.title || '(제목 없음)',
      sub: v.kindLabel + ' · ' + (row.addressRough || row.region || '') + ' · ' + db.listingPrice(row),
      body: body,
      onMount: function (mount) {
        var note = mount.querySelector('#lsNote');
        var paid = mount.querySelector('#lsFeePaid');

        mount.querySelector('#lsProofOpen').addEventListener('click', function () {
          openProof(row, this);
        });

        // 체크만 해서는 저장하지 않습니다 — 저장하면 화면이 새로 그려져
        // 서랍이 닫히기 때문에, 아래 처리 버튼과 함께 한 번에 저장합니다.
        var feeStep = function () {
          if (!!paid.checked === !!fee.paid) return Promise.resolve();
          return db.markListingFee(row.id, paid.checked, fee.invoiceId || '');
        };

        var kakaoCopy = mount.querySelector('#lsKakaoCopy');
        if (kakaoCopy) {
          kakaoCopy.addEventListener('click', function () {
            copy(kakaoText(row), this, '안내문을 복사했습니다. 카카오톡에 붙여넣어 보내 주세요.');
          });
        }
        var bankCopy = mount.querySelector('#lsBankCopy');
        if (bankCopy) {
          bankCopy.addEventListener('click', function () {
            copy(bankLine(), this, '계좌를 복사했습니다.');
          });
        }

        var notice = mount.querySelector('#lsNotice');
        if (notice) {
          notice.addEventListener('click', function () {
            db.noticeListingFee(row.id).then(function () {
              A.closeDrawer();
              A.toast('입금 대기로 넘겼습니다. 등록자 화면에도 안내가 표시됩니다.');
            }).catch(function (err) { A.toast(err.message || '처리에 실패했습니다.', 'err'); });
          });
        }

        mount.querySelector('#lsFeeSave').addEventListener('click', function () {
          feeStep().then(function () {
            A.closeDrawer();
            A.toast(paid.checked ? '입금 확인으로 저장했습니다.' : '입금 미확인으로 저장했습니다.');
          }).catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
        });

        var isEdit = v.status === 'edit_pending';

        var doApprove = function () {
          // 수정 재검토는 등록비를 이미 받은 글이라 다시 묻지 않습니다.
          if (!isEdit && !paid.checked &&
            !window.confirm('등록비 입금이 확인되지 않았습니다. 그래도 게시하시겠습니까?\n' +
              '(보통은 계좌 안내 → 입금 확인 → 게시 순서로 진행합니다.)')) return;
          feeStep()
            // row 를 넘겨 처음 게시일(firstPublishedAt)을 그대로 지킵니다.
            .then(function () { return db.approveListing(row.id, { row: row }); })
            .then(function () {
              A.closeDrawer();
              A.toast(isEdit ? '수정 내용을 승인해 다시 게시했습니다.' : '게시했습니다. 이제 게시판에 공개됩니다.');
            })
            .catch(function (err) { A.toast(err.message || '게시에 실패했습니다.', 'err'); });
        };

        var approve = mount.querySelector('#lsApprove');
        if (approve) approve.addEventListener('click', doApprove);
        var editOk = mount.querySelector('#lsEditOk');
        if (editOk) editOk.addEventListener('click', doApprove);

        var done = mount.querySelector('#lsDone');
        if (done) {
          done.addEventListener('click', function () {
            if (!window.confirm('거래가 끝난 것으로 보고 목록에서 내립니다.\n' +
              '등록자 화면에는 [거래 완료] 로 남습니다. 계속하시겠습니까?')) return;
            db.markListingDone(row.id).then(function () {
              A.closeDrawer();
              A.toast('거래 완료로 내렸습니다.');
            }).catch(function (err) { A.toast(err.message || '처리에 실패했습니다.', 'err'); });
          });
        }

        var reject = mount.querySelector('#lsReject');
        if (reject) {
          reject.addEventListener('click', function () {
            db.rejectListing(row.id, note.value).then(function () {
              A.closeDrawer();
              A.toast('반려했습니다. 등록자에게 사유가 표시됩니다.');
            }).catch(function (err) { A.toast(err.message || '반려에 실패했습니다.', 'err'); });
          });
        }

        var hide = mount.querySelector('#lsHide');
        if (hide) {
          hide.addEventListener('click', function () {
            if (!window.confirm('이 매물을 게시판에서 내립니다. 계속하시겠습니까?')) return;
            db.hideListing(row.id, note.value).then(function () {
              A.closeDrawer();
              A.toast('게시를 중지했습니다.');
            }).catch(function (err) { A.toast(err.message || '처리에 실패했습니다.', 'err'); });
          });
        }

        mount.querySelector('#lsDelete').addEventListener('click', function () {
          if (!window.confirm('매물과 첨부 서류를 함께 삭제합니다.\n되돌릴 수 없습니다. 계속하시겠습니까?')) return;
          db.deleteListing(row).then(function () {
            A.closeDrawer();
            A.toast('삭제했습니다.');
          }).catch(function (err) { A.toast(err.message || '삭제에 실패했습니다.', 'err'); });
        });
      },
    });
  }

  /* ---------------- 화면 ---------------- */

  A.register('listings', {
    title: '매물 게시판',
    nav: '매물 게시판',
    desc: '올라온 매물을 확인해 게시하거나 내립니다. 센터는 게시판만 관리하며 중개는 하지 않습니다.',
    icon: 'listings',
    perm: 'customers',
    alerts: function (state) {
      // 수정 승인 요청도 처리해야 할 건입니다 (저장값은 pending 입니다).
      return (state.listings || []).filter(function (r) {
        return r.status === 'pending' || r.status === 'awaiting_payment';
      }).map(function (r) { return r.id; });
    },

    render: function (root, state, ctx) {
      var all = (state.listings || []).slice().sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });

      var counts = {
        // 새로 올라온 글 (한 번도 승인받지 않은 글)
        pending: all.filter(function (r) { return db.listingView(r).status === 'pending'; }).length,
        // 이미 승인받았던 글의 수정 재검토
        edits: all.filter(function (r) { return db.listingView(r).status === 'edit_pending'; }).length,
        waiting: all.filter(function (r) { return r.status === 'awaiting_payment'; }).length,
        published: all.filter(function (r) { return db.listingLive(r); }).length,
        // 기한이 없어졌으니, 오래 올라가 있는 글을 대신 세어 둡니다.
        // (팔렸는데 안 내린 글일 수 있어 한 번 확인해 볼 대상입니다)
        soon: all.filter(function (r) {
          var v = db.listingView(r);
          return v.status === 'published' && v.up != null && v.up >= 90;
        }).length,
      };

      var needle = q.trim().toLowerCase();
      var rows = all.filter(function (r) {
        if (filter === 'pending' && db.listingView(r).status !== 'pending') return false;
        if (filter === 'edits' && db.listingView(r).status !== 'edit_pending') return false;
        if (filter === 'waiting' && r.status !== 'awaiting_payment') return false;
        if (filter === 'published' && !db.listingLive(r)) return false;
        if (filter === 'done' && r.status !== 'done') return false;
        // 오래 올라가 있는 글 — 팔렸는데 안 내린 글일 수 있어 한 번 확인해 볼 대상입니다.
        if (filter === 'old') {
          var vv = db.listingView(r);
          if (!(vv.status === 'published' && vv.up != null && vv.up >= 90)) return false;
        }
        if (!needle) return true;
        return [r.title, r.region, r.addressRough, r.contactName, r.contactPhone, r.userEmail]
          .join(' ').toLowerCase().indexOf(needle) > -1;
      });

      ctx.actions.innerHTML =
        '<a class="btn btn-outline btn-sm" href="listings.html" target="_blank" rel="noopener">게시판 열기 ↗</a>' +
        ' <button type="button" class="btn btn-outline btn-sm" id="lsCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-card" style="margin-bottom:18px">' +
          '<h2>어떻게 쓰는 화면인가요?</h2>' +
          '<p class="adm-card-lead">등록자가 홈페이지에서 직접 올린 매물이 <strong>승인 대기</strong>로 들어옵니다. ' +
            '순서는 <strong>두 단계</strong>입니다.</p>' +
          '<ol class="ls-adm-flow">' +
            '<li><strong>서류 확인 · 계좌 안내</strong> — 글을 열어 권리 증빙 서류(등기부등본 · 임대차계약서 · 위임장)를 ' +
              '확인하고, 맞으면 안내문을 복사해 <strong>등록자에게 카카오톡으로 계좌를 보냅니다</strong> → 입금 대기</li>' +
            '<li><strong>입금 확인 · 게시</strong> — 입금이 들어오면 체크하고 [게시하기] → 게시판에 공개</li>' +
          '</ol>' +
          '<p class="adm-card-lead">서류가 맞지 않으면 사유를 적어 반려해 주세요 — 그 사유가 등록자에게 그대로 보이고, ' +
            '<strong>계좌 안내를 보내지 않으므로 돈이 먼저 나가는 일이 없습니다.</strong> ' +
            '기본 게시 기간은 ' + db.LISTING_DAYS + '일이고, 기간이 지나면 자동으로 내려갑니다. ' +
            '중개 · 조건 협의는 센터 업무가 아니며 문의 전화는 등록자에게 직접 갑니다.</p>' +
        '</div>' +

        '<div class="adm-stats">' +
          '<div class="adm-stat is-accent"><strong>' + counts.pending + '</strong><span>새 등록 (서류 확인)</span></div>' +
          '<div class="adm-stat is-accent"><strong>' + counts.edits + '</strong><span>수정 승인 요청</span></div>' +
          '<div class="adm-stat is-accent"><strong>' + counts.waiting + '</strong><span>입금 대기</span></div>' +
          '<div class="adm-stat"><strong>' + counts.published + '</strong><span>게시중</span></div>' +
          '<div class="adm-stat"><strong>' + counts.soon + '</strong><span>90일 넘게 게시</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          '<input type="search" id="lsSearch" placeholder="제목 · 지역 · 연락처 검색" value="' + h(q) + '">' +
          '<select id="lsFilter">' +
            '<option value="pending"' + (filter === 'pending' ? ' selected' : '') + '>새 등록만 (서류 확인)</option>' +
            '<option value="edits"' + (filter === 'edits' ? ' selected' : '') + '>수정 승인 요청만</option>' +
            '<option value="waiting"' + (filter === 'waiting' ? ' selected' : '') + '>입금 대기만</option>' +
            '<option value="published"' + (filter === 'published' ? ' selected' : '') + '>게시중만</option>' +
            '<option value="old"' + (filter === 'old' ? ' selected' : '') + '>90일 넘게 게시된 글</option>' +
            '<option value="done"' + (filter === 'done' ? ' selected' : '') + '>거래 완료만</option>' +
            '<option value="all"' + (filter === 'all' ? ' selected' : '') + '>전체 보기</option>' +
          '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th>매물</th><th style="width:130px">종류 · 금액</th><th style="width:150px">등록자 · 증빙</th>' +
          '<th style="width:120px">상태</th><th style="width:110px">등록비</th><th style="width:120px">등록일</th>' +
        '</tr></thead><tbody id="lsRows">' +
        (rows.length
          ? rows.map(function (r) {
              var v = db.listingView(r);
              var u = userOf(state, r.userId);
              var fee = r.fee || {};
              return '<tr data-id="' + h(r.id) + '" class="is-click">' +
                '<td class="strong">' + h(r.title || '(제목 없음)') +
                  '<span class="sub">' + h(r.addressRough || r.region || '') +
                  (r.area ? ' · ' + h(r.area) : '') + '</span></td>' +
                '<td>' + h(v.kindLabel) + '<span class="sub">' + h(db.listingPrice(r)) + '</span>' +
                  '<span class="sub">사진 ' + v.photos.length + '장</span></td>' +
                '<td>' + h(v.holderLabel) +
                  '<span class="sub">' + h(v.proofLabel || '서류 없음') + '</span>' +
                  '<span class="sub">' + h(u ? (u.name || u.email) : (r.userEmail || '-')) + '</span></td>' +
                '<td><span class="st st-' + h(ST_CLASS[v.status] || 'received') + '">' + h(v.label) + '</span>' +
                  (v.status === 'published' && v.up != null
                    ? '<span class="sub">' + v.up + '일째</span>' : '') +
                  // 수정 승인 요청은 "언제 요청했는지" 가 처리 순서를 정합니다.
                  (v.status === 'edit_pending' && v.editRequestedAt
                    ? '<span class="sub">' + h(db.formatDate(v.editRequestedAt)) + ' 요청</span>' : '') + '</td>' +
                '<td>' + (fee.paid
                  ? '<span class="st st-done">확인</span>'
                  : fee.noticeSentAt
                    ? '<span class="st st-progress">안내 발송</span>'
                    : '<span class="st st-hold">미확인</span>') + '</td>' +
                '<td class="nowrap">' + h(db.formatDate(r.createdAt, false)) +
                  (v.status === 'edit_pending' && v.editRequestedAt
                    ? '<span class="sub">수정 ' + h(db.formatDate(v.editRequestedAt, false)) + '</span>' : '') +
                  '</td>' +
                '</tr>';
            }).join('')
          : A.emptyRow(6,
              filter === 'pending' ? '새로 올라온 매물이 없습니다'
                : filter === 'edits' ? '수정 승인을 기다리는 매물이 없습니다'
                : filter === 'waiting' ? '입금을 기다리는 매물이 없습니다'
                : filter === 'done' ? '거래 완료로 내린 매물이 없습니다' : '매물이 없습니다',
              '홈페이지 [매물 게시판] 에서 등록된 글이 여기로 들어옵니다.')) +
        '</tbody></table></div>';

      var search = root.querySelector('#lsSearch');
      search.addEventListener('input', function () {
        q = search.value;
        A.rerender();
        var again = document.getElementById('lsSearch');
        if (again) { again.focus(); again.setSelectionRange(q.length, q.length); }
      });

      root.querySelector('#lsFilter').addEventListener('change', function (e) {
        filter = e.target.value;
        A.rerender();
      });

      root.querySelector('#lsRows').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (!tr) return;
        var hit = all.filter(function (r) { return r.id === tr.dataset.id; })[0];
        if (hit) openRow(hit, state);
      });

      ctx.actions.querySelector('#lsCsv').addEventListener('click', function () {
        A.downloadCsv(
          'caps-매물게시판.csv',
          ['제목', '종류', '용도', '지역', '위치', '금액', '면적', '층', '사진 수',
            '등록자 입장', '제출 서류', '등록 계정', '연락처', '연락 가능 시간',
            '상태', '등록비', '계좌 안내', '등록일', '게시일', '게시 종료', '사유'],
          rows.map(function (r) {
            var v = db.listingView(r);
            var u = userOf(state, r.userId);
            return [r.title, v.kindLabel, v.useLabel, r.region, r.addressRough,
              db.listingPrice(r), r.area, r.floor, v.photos.length,
              v.holderLabel, v.proofLabel,
              u ? u.email : (r.userEmail || ''), db.formatPhone(r.contactPhone),
              r.contactHours || '', v.label,
              (r.fee || {}).paid ? '확인' : '미확인',
              (r.fee || {}).noticeSentAt ? db.formatDate(r.fee.noticeSentAt, false) : '',
              db.formatDate(r.createdAt, false),
              r.publishedAt ? db.formatDate(r.publishedAt, false) : '',
              r.expiresAt ? db.formatDate(r.expiresAt, false) : '',
              r.rejectNote];
          })
        );
      });
    },
  });
})();
