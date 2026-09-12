/* 고객 관리 — 교회별 정보, 구독 현황, 신청 이력 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var filter = { q: '', only: '' };

  function subsOf(state, customerId) {
    return state.subscriptions.filter(function (s) { return s.customerId === customerId; });
  }

  function reqsOf(state, customerId) {
    return state.requests.filter(function (r) { return r.customerId === customerId; });
  }

  function mrrOf(state, customerId) {
    return subsOf(state, customerId)
      .filter(function (s) { return s.status === 'active'; })
      .reduce(function (sum, s) { return sum + (Number(s.monthlyFee) || 0); }, 0);
  }

  function field(label, name, value, opts) {
    var o = opts || {};
    var lock = o.locked ? ' disabled' : '';
    // noName 인 칸은 저장할 때 폼에서 자동으로 읽지 않습니다
    // (직분 '기타' 직접 입력칸 — 최종 값은 db.roleValue 로 계산합니다).
    var nm = o.noName ? '' : ' name="' + name + '"';
    return '<div class="field' + (o.locked ? ' is-locked' : '') + '" id="cf_' + name + '">' +
      '<label for="c_' + name + '">' + h(label) +
      (o.required ? ' <em class="req">필수</em>' : '') +
      (o.locked ? ' <span class="lock-tag">승인 필요</span>' : '') + '</label>' +
      (o.type === 'textarea'
        ? '<textarea id="c_' + name + '"' + nm + ' rows="3"' + lock + '>' + h(value || '') + '</textarea>'
        : o.type === 'select'
          ? '<select id="c_' + name + '"' + nm + lock + '><option value="">선택</option>' +
            o.options.map(function (op) {
              return '<option' + (op === value ? ' selected' : '') + '>' + h(op) + '</option>';
            }).join('') + '</select>'
          : '<input type="' + (o.type || 'text') + '" id="c_' + name + '"' + nm +
            ' value="' + h(value || '') + '"' +
            (o.placeholder ? ' placeholder="' + h(o.placeholder) + '"' : '') + lock + '>') +
      '</div>';
  }

  function consentOf(state, customerId) {
    return state.editConsents.filter(function (x) { return x.id === customerId; })[0] || null;
  }

  /** 교회 정보 잠금 상태 안내 + 버튼 */
  function consentPanel(c, state, isNew) {
    if (isNew) {
      return '<p class="consent-note is-open">처음 등록할 때는 교회가 알려준 내용을 그대로 입력하시면 됩니다. ' +
        '등록 후에 이 정보를 고치려면 해당 교회의 승인이 필요합니다.</p>';
    }

    var doc = consentOf(state, c.id);
    var v = db.consentView(doc);
    var account = db.accountOf(c, state.requests);
    var who = account
      ? (state.users.filter(function (u) { return u.id === account; })[0] || null)
      : null;

    if (v.live) {
      return '<div class="consent-note is-ok">' +
        '<strong>' + h(c.name) + ' 교회가 수정을 승인했습니다.</strong>' +
        '<span>승인 요청 항목: ' + h(db.fieldLabels(v.fields)) + '</span>' +
        '<span>기한: ' + h(db.formatDate(v.expiresAt)) + ' 까지 · 저장하면 다시 잠깁니다</span>' +
        '<button type="button" class="btn btn-outline btn-sm" id="cConsentCancel">승인 반납(다시 잠금)</button>' +
        '</div>';
    }

    if (v.status === 'pending') {
      return '<div class="consent-note is-wait">' +
        '<strong>승인을 기다리고 있습니다.</strong>' +
        '<span>' + h(who ? (who.name || who.email) : '교회 계정') + ' 님에게 요청을 보냈습니다 (' +
          h(db.formatDate(doc.requestedAt)) + ')</span>' +
        '<span>요청 항목: ' + h(db.fieldLabels(v.fields)) + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" id="cConsentCancel">요청 취소</button>' +
        '</div>';
    }

    var last = '';
    if (v.status === 'rejected') {
      last = '<span class="is-bad">지난 요청은 거절되었습니다.' +
        (doc.rejectNote ? ' 사유: ' + h(doc.rejectNote) : '') + '</span>';
    } else if (v.status === 'used') {
      last = '<span>지난 승인으로 ' + h(db.formatDate(doc.usedAt)) + ' 에 수정을 마쳤습니다.</span>';
    } else if (v.status === 'expired') {
      last = '<span>지난 승인은 기한이 지났습니다.</span>';
    }

    return '<div class="consent-note is-lock">' +
      '<strong>교회 정보는 잠겨 있습니다.</strong>' +
      '<span>교회명 · 담당자 · 연락처 등은 해당 교회가 승인해야 수정할 수 있습니다. ' +
        '내부 메모는 언제든 수정됩니다.</span>' +
      last +
      (account
        ? '<button type="button" class="btn btn-primary btn-sm" id="cConsentAsk">정보 수정 요청 보내기</button>'
        : '<span class="is-bad">이 교회에 연결된 계정이 없어 요청을 보낼 수 없습니다. ' +
          '[지원 신청] 화면에서 신청 건을 이 고객으로 연결하면 계정이 이어집니다.</span>') +
      '</div>';
  }

  /** 요청 보내기 창 */
  function askConsent(c, state) {
    var account = db.accountOf(c, state.requests);
    var keys = Object.keys(db.CHURCH_FIELDS);

    A.openDrawer({
      title: '정보 수정 요청',
      sub: h(c.name) + ' 교회 계정에 승인을 요청합니다.',
      body:
        '<div class="drawer-section">' +
          '<h3>어떤 항목을 고칠까요?</h3>' +
          '<p class="field-hint" style="margin-bottom:10px">고객에게 그대로 보여집니다. ' +
            '하나도 고르지 않으면 "교회 정보 전체"로 요청합니다.</p>' +
          '<div class="chk-grid" id="ecFields">' +
            keys.map(function (k) {
              return '<label class="check-line"><input type="checkbox" value="' + h(k) + '">' +
                '<span>' + h(db.CHURCH_FIELDS[k]) + '</span></label>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="drawer-section">' +
          '<h3>사유 (고객에게 보입니다)</h3>' +
          '<div class="field"><textarea id="ecReason" rows="3" ' +
            'placeholder="예: 주보 발송 주소가 반송되어 소재지와 연락처를 확인하고 싶습니다."></textarea></div>' +
        '</div>' +
        '<p class="field-hint">승인하면 ' + db.CONSENT_DAYS + '일 동안 수정할 수 있고, ' +
          '저장을 마치면 자동으로 다시 잠깁니다.</p>' +
        '<div style="display:flex;gap:10px;margin-top:14px">' +
          '<button type="button" class="btn btn-primary" id="ecSend">요청 보내기</button>' +
          '<button type="button" class="btn btn-outline" id="ecBack">뒤로</button>' +
        '</div>',

      onMount: function (body) {
        body.querySelector('#ecBack').addEventListener('click', function () {
          openCustomer(c.id, A.state);
        });
        body.querySelector('#ecSend').addEventListener('click', function () {
          var fields = Array.prototype.slice
            .call(body.querySelectorAll('#ecFields input:checked'))
            .map(function (i) { return i.value; });
          db.requestChurchEdit(c, {
            userId: account,
            fields: fields,
            reason: body.querySelector('#ecReason').value,
          }).then(function () {
            A.toast('수정 요청을 보냈습니다. 고객이 승인하면 알려드립니다.', 'ok');
            A.closeDrawer();
          }).catch(function (err) { A.toast(err.message || '요청에 실패했습니다.', 'err'); });
        });
      },
    });
  }

  /* ---------------- 상세 / 등록 서랍 ---------------- */

  function openCustomer(id, state) {
    var c = id ? state.customers.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !c) return;
    var isNew = !c;
    c = c || {};

    var subs = isNew ? [] : subsOf(state, c.id);
    var reqs = isNew ? [] : reqsOf(state, c.id);

    /* 교회가 알려준 정보는 그 교회가 승인한 동안에만 수정할 수 있습니다.
       (보안 규칙에도 같은 조건이 걸려 있습니다) */
    var consent = isNew ? null : consentOf(state, c.id);
    var unlocked = isNew || db.consentLive(consent);
    var lk = { locked: !unlocked };

    A.openDrawer({
      title: isNew ? '고객 교회 등록' : c.name,
      sub: isNew ? '직접 등록한 교회도 구독과 정산에 함께 반영됩니다.'
        : (c.location || '') + (c.createdAt ? ' · 등록 ' + db.formatDate(c.createdAt, false) : ''),
      body:
        consentPanel(c, state, isNew) +
        '<form id="custForm">' +
          '<div class="drawer-section"><h3>교회 정보</h3>' +
            field('교회명', 'name', c.name, { required: true, placeholder: '예: 은혜로교회', locked: lk.locked }) +
            field('교단', 'denomination', c.denomination, { placeholder: '예: 예장합동', locked: lk.locked }) +
            field('소재지', 'location', c.location, { placeholder: '예: 경기 성남시 분당구', locked: lk.locked }) +
            field('출석 교인 수', 'size', c.size, {
              type: 'select', locked: lk.locked,
              options: ['50명 미만', '50~150명', '150~500명', '500~1,000명', '1,000명 이상'],
            }) +
          '</div>' +
          '<div class="drawer-section"><h3>담당자</h3>' +
            field('담당자 성함', 'contactName', c.contactName, { locked: lk.locked }) +
            field('직분', 'contactRole', c.contactRole, {
              type: 'select', locked: lk.locked, options: db.ROLE_OPTIONS,
            }) +
            field('직분 직접 입력', 'contactRoleOther', '', { locked: lk.locked, noName: true }) +
            field('연락처', 'phone', c.phone, { type: 'tel', placeholder: '010-0000-0000', locked: lk.locked }) +
            field('이메일', 'email', c.email, { type: 'email', locked: lk.locked }) +
          '</div>' +
          '<div class="drawer-section"><h3>메모</h3>' +
            field('내부 메모', 'memo', c.memo, { type: 'textarea' }) +
          '</div>' +
        '</form>' +

        (isNew ? '' :
          '<div class="drawer-section"><h3>구독 중인 항목 (' + subs.length + ')</h3>' +
            (subs.length
              ? '<div class="adm-tablewrap"><table class="adm-t" style="min-width:0"><tbody>' +
                subs.map(function (s) {
                  return '<tr><td class="strong">' + h(db.serviceName(s.serviceId)) +
                    '<span class="sub">' + h(s.plan || '') + '</span></td>' +
                    '<td class="num">' + A.money(s.monthlyFee) + '원</td>' +
                    '<td><span class="st st-' + h(s.status) + '">' + h(db.SUB_STATUS[s.status] || s.status) + '</span></td></tr>';
                }).join('') +
                '<tr><td class="strong">월 합계 (이용중)</td><td class="num strong">' + A.money(mrrOf(state, c.id)) +
                '원</td><td></td></tr>' +
                '</tbody></table></div>'
              : '<p class="field-hint">구독 중인 항목이 없습니다.</p>') +
            '<button type="button" class="btn btn-outline btn-sm" id="cAddSub" style="margin-top:12px">구독 항목 추가</button>' +
          '</div>' +

          '<div class="drawer-section"><h3>신청 이력 (' + reqs.length + ')</h3>' +
            (reqs.length
              ? '<div class="adm-tablewrap"><table class="adm-t" style="min-width:0"><tbody>' +
                reqs.map(function (r) {
                  return '<tr><td class="code">' + h(r.code) + '</td>' +
                    '<td>' + (r.services || []).map(db.serviceName).join(', ') + '</td>' +
                    '<td><span class="st st-' + h(r.status) + '">' + h(db.REQUEST_STATUS[r.status] || r.status) + '</span></td>' +
                    '<td class="nowrap">' + h(db.formatDate(r.createdAt, false)) + '</td></tr>';
                }).join('') + '</tbody></table></div>'
              : '<p class="field-hint">신청 이력이 없습니다.</p>') +
          '</div>') +

        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
          '<button type="button" class="btn btn-primary" id="cSave">' + (isNew ? '등록하기' : '저장') + '</button>' +
          (isNew ? '' : '<button type="button" class="btn btn-outline" id="cDelete" ' +
            'style="margin-left:auto;color:#B3261E;border-color:#E5A9A3">삭제</button>') +
        '</div>',

      onMount: function (body) {
        /* 직분에서 '기타'를 고르면 직접 입력칸이 나타납니다. */
        var roleSel = body.querySelector('#c_contactRole');
        var roleOther = body.querySelector('#c_contactRoleOther');
        db.setRoleValue(roleSel, roleOther, c.contactRole);

        var ask = body.querySelector('#cConsentAsk');
        if (ask) ask.addEventListener('click', function () { askConsent(c, A.state); });

        var undo = body.querySelector('#cConsentCancel');
        if (undo) {
          undo.addEventListener('click', function () {
            db.cancelChurchEdit(c.id).then(function () {
              A.toast('요청을 취소했습니다.');
              A.closeDrawer();
            }).catch(function (err) { A.toast(err.message || '취소에 실패했습니다.', 'err'); });
          });
        }

        body.querySelector('#cSave').addEventListener('click', function () {
          var form = body.querySelector('#custForm');
          var data = {};
          Array.prototype.slice.call(form.querySelectorAll('[name]')).forEach(function (input) {
            // 잠긴 칸은 보내지 않습니다 (서버 규칙에서도 거부됩니다).
            if (input.disabled) return;
            data[input.name] = input.value.trim();
          });
          // 직분은 select + 직접 입력을 합쳐 최종 값으로 저장합니다.
          if (!roleSel.disabled) data.contactRole = db.roleValue(roleSel, roleOther);
          else delete data.contactRole;

          if (isNew && !data.name) {
            A.toast('교회명을 입력해 주세요.', 'err');
            form.querySelector('#c_name').focus();
            return;
          }
          var done = isNew ? db.add('customers', data) : db.update('customers', c.id, data);
          done.then(function () {
            // 승인받아 수정한 경우에는 저장과 함께 다시 잠급니다.
            if (!isNew && unlocked && consent) return db.finishChurchEdit(c.id);
            return null;
          }).then(function () {
            A.toast(isNew ? '고객을 등록했습니다.'
              : (unlocked && consent ? '저장했습니다. 교회 정보는 다시 잠겼습니다.' : '저장했습니다.'), 'ok');
            A.closeDrawer();
          }).catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
        });

        var del = body.querySelector('#cDelete');
        if (del) {
          del.addEventListener('click', function () {
            var n = subsOf(state, c.id).length;
            var msg = n
              ? '이 고객에게 연결된 구독 ' + n + '건도 함께 삭제됩니다. 계속할까요?'
              : '이 고객을 삭제할까요? 되돌릴 수 없습니다.';
            if (!window.confirm(msg)) return;
            Promise.all(subsOf(state, c.id).map(function (s) { return db.remove('subscriptions', s.id); }))
              .then(function () { return db.remove('customers', c.id); })
              .then(function () {
                A.toast('삭제했습니다.');
                A.closeDrawer();
              });
          });
        }

        var addSub = body.querySelector('#cAddSub');
        if (addSub) {
          addSub.addEventListener('click', function () {
            A.closeDrawer();
            window.sessionStorage.setItem('caps.admin.newSub', JSON.stringify({ customerId: c.id, serviceId: '' }));
            A.go('subscriptions');
          });
        }
      },
    });
  }

  /* ---------------- 목록 ---------------- */

  A.register('customers', {
    title: '고객 관리',
    nav: '고객 관리',
    desc: '교회별 정보와 구독 현황, 신청 이력을 확인합니다.',
    icon: 'customers',
    perm: 'customers',
    /* 전체 고객 수가 아니라 '아직 안 본 새 고객' 입니다. */
    alerts: function (state) {
      return state.customers.map(function (c) { return c.id; });
    },

    render: function (root, state, ctx) {
      var all = state.customers;
      var rows = all.filter(function (c) {
        if (filter.only === 'sub' && !subsOf(state, c.id).some(function (s) { return s.status === 'active'; })) return false;
        if (filter.only === 'nosub' && subsOf(state, c.id).some(function (s) { return s.status === 'active'; })) return false;
        if (!filter.q) return true;
        var hay = [c.name, c.contactName, c.phone, c.email, c.location, c.denomination, c.memo].join(' ').toLowerCase();
        return hay.indexOf(filter.q.toLowerCase()) > -1;
      });

      var totalMrr = all.reduce(function (sum, c) { return sum + mrrOf(state, c.id); }, 0);
      var withSub = all.filter(function (c) {
        return subsOf(state, c.id).some(function (s) { return s.status === 'active'; });
      }).length;

      ctx.actions.innerHTML =
        '<button type="button" class="btn btn-primary btn-sm" id="cNew">고객 등록</button> ' +
        '<button type="button" class="btn btn-outline btn-sm" id="cCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + all.length + '</strong><span>전체 고객 교회</span></div>' +
          '<div class="adm-stat"><strong>' + withSub + '</strong><span>구독 중인 교회</span></div>' +
          '<div class="adm-stat"><strong>' + (all.length - withSub) + '</strong><span>단건 · 미구독</span></div>' +
          '<div class="adm-stat is-accent"><strong>' + A.money(totalMrr) + '</strong><span>월 구독 합계 (원)</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          '<input type="search" id="cq" placeholder="교회명 · 담당자 · 연락처 · 지역 검색" value="' + h(filter.q) + '">' +
          '<select id="conly">' +
            '<option value="">전체</option>' +
            '<option value="sub"' + (filter.only === 'sub' ? ' selected' : '') + '>구독 중인 교회만</option>' +
            '<option value="nosub"' + (filter.only === 'nosub' ? ' selected' : '') + '>미구독 교회만</option>' +
          '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th>교회명</th><th style="width:150px">담당자</th><th style="width:130px">연락처</th>' +
          '<th>구독 항목</th><th class="num" style="width:130px">월 구독료</th>' +
          '<th class="num" style="width:80px">신청</th><th style="width:100px">등록일</th>' +
        '</tr></thead><tbody id="custRows">' +
        (rows.length
          ? rows.map(function (c) {
              var subs = subsOf(state, c.id);
              var cv = db.consentView(consentOf(state, c.id));
              var mark = cv.status === 'pending' ? ' <span class="st st-hold">수정 승인 대기</span>'
                : cv.live ? ' <span class="st st-done">수정 가능</span>' : '';
              return '<tr data-id="' + h(c.id) + '" style="cursor:pointer">' +
                '<td class="strong">' + h(c.name) + mark +
                  '<span class="sub">' + h(c.location || '') + (c.denomination ? ' · ' + h(c.denomination) : '') + '</span></td>' +
                '<td>' + h(c.contactName || '-') +
                  (c.contactRole ? '<span class="sub">' + h(c.contactRole) + '</span>' : '') + '</td>' +
                '<td class="nowrap">' + h(c.phone || '-') + '</td>' +
                '<td><div class="chip-row">' + (subs.length
                  ? subs.map(function (s) {
                      return '<span class="chip' + (s.status === 'active' ? ' is-gold' : '') + '">' +
                        h(db.serviceName(s.serviceId)) + (s.status !== 'active' ? ' (' + h(db.SUB_STATUS[s.status]) + ')' : '') +
                        '</span>';
                    }).join('')
                  : '<span style="color:var(--muted);font-size:13.5px">없음</span>') + '</div></td>' +
                '<td class="num">' + (mrrOf(state, c.id) ? A.money(mrrOf(state, c.id)) + '원' : '-') + '</td>' +
                '<td class="num">' + reqsOf(state, c.id).length + '</td>' +
                '<td class="nowrap">' + h(db.formatDate(c.createdAt, false)) + '</td></tr>';
            }).join('')
          : A.emptyRow(7, all.length ? '조건에 맞는 고객이 없습니다' : '등록된 고객이 없습니다',
              all.length ? '검색어나 필터를 바꿔보세요.' : '신청이 접수되면 자동으로 등록되고, 직접 등록할 수도 있습니다.')) +
        '</tbody></table></div>';

      var cq = root.querySelector('#cq');
      var timer = null;
      cq.addEventListener('input', function () {
        filter.q = cq.value;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          A.rerender();
          var again = document.getElementById('cq');
          if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
        }, 260);
      });
      root.querySelector('#conly').addEventListener('change', function (e) {
        filter.only = e.target.value;
        A.rerender();
      });

      root.querySelector('#custRows').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (tr) openCustomer(tr.dataset.id, state);
      });

      ctx.actions.querySelector('#cNew').addEventListener('click', function () { openCustomer(null, state); });
      ctx.actions.querySelector('#cCsv').addEventListener('click', function () {
        A.downloadCsv(
          'caps-고객목록.csv',
          ['교회명', '교단', '소재지', '교인수', '담당자', '직분', '연락처', '이메일', '구독항목', '월구독료', '신청건수', '등록일', '메모'],
          rows.map(function (c) {
            return [c.name, c.denomination, c.location, c.size, c.contactName, c.contactRole, c.phone, c.email,
              subsOf(state, c.id).map(function (s) { return db.serviceName(s.serviceId); }).join(' / '),
              mrrOf(state, c.id), reqsOf(state, c.id).length, db.formatDate(c.createdAt, false), c.memo];
          })
        );
      });

      /* 다른 화면에서 넘어온 경우 해당 고객 자동 열기 */
      var pending = window.sessionStorage.getItem('caps.admin.openCustomer');
      if (pending) {
        window.sessionStorage.removeItem('caps.admin.openCustomer');
        openCustomer(pending, state);
      }
    },
  });
})();
