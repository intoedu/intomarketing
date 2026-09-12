/* 정산 — 월별 청구서 생성, 입금 확인, 미수금 관리 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  function thisMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  var month = thisMonth();
  var filter = { q: '', status: '' };

  function monthLabel(m) {
    var parts = String(m).split('-');
    return parts[0] + '년 ' + Number(parts[1]) + '월';
  }

  function customerName(state, id) {
    var hit = state.customers.filter(function (c) { return c.id === id; });
    return hit.length ? hit[0].name : '(삭제된 고객)';
  }

  function monthInvoices(state) {
    return state.invoices.filter(function (i) { return i.month === month; });
  }

  /* ---------------- 청구서 생성 ---------------- */

  function generate(state) {
    var existing = monthInvoices(state);
    var actives = state.subscriptions.filter(function (s) { return s.status === 'active'; });

    var toAdd = actives.filter(function (s) {
      // 이미 이 달에 같은 구독으로 만든 청구서가 있으면 건너뜁니다.
      return !existing.some(function (i) { return i.subscriptionId === s.id; });
    });

    if (!toAdd.length) {
      A.toast('이 달에 새로 만들 청구서가 없습니다.', 'err');
      return;
    }

    if (!window.confirm(
      monthLabel(month) + ' 구독 청구서 ' + toAdd.length + '건을 만들까요?\n' +
      '합계 ' + A.money(toAdd.reduce(function (t, s) { return t + (Number(s.monthlyFee) || 0); }, 0)) + '원'
    )) return;

    Promise.all(toAdd.map(function (s) {
      return db.add('invoices', {
        month: month,
        customerId: s.customerId,
        subscriptionId: s.id,
        serviceId: s.serviceId,
        title: s.plan || db.serviceName(s.serviceId),
        amount: Number(s.monthlyFee) || 0,
        status: 'unpaid',
        paidAt: '',
        memo: '',
        kind: 'subscription',
      });
    })).then(function () {
      A.toast(toAdd.length + '건의 청구서를 만들었습니다.', 'ok');
    }).catch(function (err) {
      A.toast(err.message || '청구서 생성에 실패했습니다.', 'err');
    });
  }

  /* ---------------- 단건 청구 추가 ---------------- */

  function openInvoice(id, state) {
    var inv = id ? state.invoices.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !inv) return;
    var isNew = !inv;
    inv = inv || { month: month, status: 'unpaid', kind: 'onetime' };

    var custOpts = ['<option value="">고객 교회를 선택하세요</option>'].concat(
      state.customers.map(function (c) {
        return '<option value="' + h(c.id) + '"' + (inv.customerId === c.id ? ' selected' : '') + '>' + h(c.name) + '</option>';
      })
    ).join('');

    var svcOpts = ['<option value="">해당 없음</option>'].concat(
      (window.CAPS_SERVICES || []).map(function (v) {
        return '<option value="' + v.id + '"' + (inv.serviceId === v.id ? ' selected' : '') + '>' + h(v.name) + '</option>';
      })
    ).join('');

    A.openDrawer({
      title: isNew ? '단건 청구 추가' : (inv.title || '청구 상세'),
      sub: isNew ? '홈페이지 제작처럼 한 번만 청구하는 건을 등록합니다.'
        : customerName(state, inv.customerId) + ' · ' + monthLabel(inv.month),
      body:
        '<form id="invForm">' +
          '<div class="drawer-section"><h3>청구 내용</h3>' +
            '<div class="field"><label for="i_month">청구 월</label>' +
              '<input type="month" id="i_month" name="month" value="' + h(inv.month) + '"></div>' +
            '<div class="field"><label for="i_customerId">고객 교회 <em class="req">필수</em></label>' +
              '<select id="i_customerId" name="customerId">' + custOpts + '</select></div>' +
            '<div class="field"><label for="i_serviceId">지원 항목</label>' +
              '<select id="i_serviceId" name="serviceId">' + svcOpts + '</select></div>' +
            '<div class="field"><label for="i_title">청구 항목명 <em class="req">필수</em></label>' +
              '<input type="text" id="i_title" name="title" value="' + h(inv.title || '') + '" ' +
              'placeholder="예: 홈페이지 제작 (잔금)"></div>' +
            '<div class="field"><label for="i_amount">금액 (원) <em class="req">필수</em></label>' +
              '<input type="number" id="i_amount" name="amount" min="0" step="1000" value="' + h(inv.amount || '') + '"></div>' +
          '</div>' +
          '<div class="drawer-section"><h3>입금</h3>' +
            '<div class="field"><label for="i_status">상태</label>' +
              '<select id="i_status" name="status">' +
                '<option value="unpaid"' + (inv.status !== 'paid' ? ' selected' : '') + '>미입금</option>' +
                '<option value="paid"' + (inv.status === 'paid' ? ' selected' : '') + '>입금 완료</option>' +
              '</select></div>' +
            '<div class="field"><label for="i_paidAt">입금일</label>' +
              '<input type="date" id="i_paidAt" name="paidAt" value="' + h(inv.paidAt || '') + '"></div>' +
            '<div class="field"><label for="i_memo">메모</label>' +
              '<textarea id="i_memo" name="memo" rows="3">' + h(inv.memo || '') + '</textarea></div>' +
          '</div>' +
        '</form>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
          '<button type="button" class="btn btn-primary" id="iSave">' + (isNew ? '추가하기' : '저장') + '</button>' +
          (isNew ? '' : '<button type="button" class="btn btn-outline" id="iDelete" ' +
            'style="margin-left:auto;color:#B3261E;border-color:#E5A9A3">삭제</button>') +
        '</div>',

      onMount: function (body) {
        body.querySelector('#iSave').addEventListener('click', function () {
          var data = {};
          Array.prototype.slice.call(body.querySelectorAll('#invForm [name]')).forEach(function (input) {
            data[input.name] = input.value.trim();
          });
          if (!data.customerId) { A.toast('고객 교회를 선택해 주세요.', 'err'); return; }
          if (!data.title) { A.toast('청구 항목명을 입력해 주세요.', 'err'); return; }
          data.amount = Number(data.amount) || 0;
          if (data.status === 'paid' && !data.paidAt) data.paidAt = new Date().toISOString().slice(0, 10);
          if (data.status !== 'paid') data.paidAt = '';
          if (isNew) data.kind = 'onetime';

          var done = isNew ? db.add('invoices', data) : db.update('invoices', inv.id, data);
          done.then(function () {
            A.toast(isNew ? '청구를 추가했습니다.' : '저장했습니다.', 'ok');
            A.closeDrawer();
          }).catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
        });

        var del = body.querySelector('#iDelete');
        if (del) {
          del.addEventListener('click', function () {
            if (!window.confirm('이 청구를 삭제할까요?')) return;
            db.remove('invoices', inv.id).then(function () {
              A.toast('삭제했습니다.');
              A.closeDrawer();
            });
          });
        }
      },
    });
  }

  /* ---------------- 화면 ---------------- */

  A.register('settlement', {
    title: '정산',
    nav: '정산',
    desc: '월별 청구서를 만들고 입금 여부와 미수금을 관리합니다.',
    icon: 'settlement',
    perm: 'settlement',
    badge: function (state) {
      return state.invoices.filter(function (i) { return i.status !== 'paid'; }).length;
    },

    render: function (root, state, ctx) {
      var all = monthInvoices(state);
      var rows = all.filter(function (i) {
        if (filter.status === 'paid' && i.status !== 'paid') return false;
        if (filter.status === 'unpaid' && i.status === 'paid') return false;
        if (!filter.q) return true;
        var hay = [customerName(state, i.customerId), i.title, db.serviceName(i.serviceId), i.memo].join(' ').toLowerCase();
        return hay.indexOf(filter.q.toLowerCase()) > -1;
      });

      var total = all.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0);
      var paid = all.filter(function (i) { return i.status === 'paid'; });
      var paidSum = paid.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0);
      var activeSubs = state.subscriptions.filter(function (s) { return s.status === 'active'; });
      var notYet = activeSubs.filter(function (s) {
        return !all.some(function (i) { return i.subscriptionId === s.id; });
      });

      /* 고객별 합계 */
      var byCustomer = {};
      all.forEach(function (i) {
        var key = i.customerId || '_';
        byCustomer[key] = byCustomer[key] || { total: 0, paid: 0, count: 0 };
        byCustomer[key].total += Number(i.amount) || 0;
        byCustomer[key].count++;
        if (i.status === 'paid') byCustomer[key].paid += Number(i.amount) || 0;
      });
      var custRows = Object.keys(byCustomer).sort(function (a, b) {
        return byCustomer[b].total - byCustomer[a].total;
      });

      ctx.actions.innerHTML =
        '<button type="button" class="btn btn-outline btn-sm" id="stCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-toolbar">' +
          '<input type="month" id="stMonth" value="' + h(month) + '" aria-label="정산 월">' +
          '<button type="button" class="btn btn-primary btn-sm" id="stGen">이 달 구독 청구서 만들기</button>' +
          '<button type="button" class="btn btn-outline btn-sm" id="stAdd">단건 청구 추가</button>' +
          '<span style="font-size:13.5px;color:var(--muted)">' +
            (notYet.length
              ? '아직 청구서를 만들지 않은 구독 ' + notYet.length + '건이 있습니다'
              : '이용중인 구독 모두 청구서가 만들어졌습니다') +
          '</span>' +
        '</div>' +

        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + all.length + '</strong><span>' + h(monthLabel(month)) + ' 청구 건수</span></div>' +
          '<div class="adm-stat is-accent"><strong>' + A.money(total) + '</strong><span>청구 합계 (원)</span></div>' +
          '<div class="adm-stat"><strong>' + A.money(paidSum) + '</strong><span>입금 완료 (원)</span>' +
            '<small>' + paid.length + ' / ' + all.length + '건</small></div>' +
          '<div class="adm-stat"><strong>' + A.money(total - paidSum) + '</strong><span>미수금 (원)</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          '<input type="search" id="stq" placeholder="교회명 · 항목 검색" value="' + h(filter.q) + '">' +
          '<select id="ststatus">' +
            '<option value="">전체</option>' +
            '<option value="unpaid"' + (filter.status === 'unpaid' ? ' selected' : '') + '>미입금만</option>' +
            '<option value="paid"' + (filter.status === 'paid' ? ' selected' : '') + '>입금 완료만</option>' +
          '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th>고객 교회</th><th>청구 항목</th><th style="width:120px">구분</th>' +
          '<th class="num" style="width:120px">금액</th><th style="width:120px">입금</th>' +
          '<th style="width:110px">입금일</th><th style="width:60px"></th>' +
        '</tr></thead><tbody id="invRows">' +
        (rows.length
          ? rows.map(function (i) {
              return '<tr data-id="' + h(i.id) + '">' +
                '<td class="strong">' + h(customerName(state, i.customerId)) + '</td>' +
                '<td>' + h(i.title || '-') +
                  (i.serviceId ? '<span class="sub">' + h(db.serviceName(i.serviceId)) + '</span>' : '') + '</td>' +
                '<td><span class="chip' + (i.kind === 'subscription' ? ' is-gold' : '') + '">' +
                  (i.kind === 'subscription' ? '구독' : '단건') + '</span></td>' +
                '<td class="num">' + A.money(i.amount) + '원</td>' +
                '<td><label class="switch"><input type="checkbox" data-paid="' + h(i.id) + '"' +
                  (i.status === 'paid' ? ' checked' : '') + '><span class="switch-track"></span>' +
                  '<span>' + (i.status === 'paid' ? '완료' : '대기') + '</span></label></td>' +
                '<td class="nowrap">' + h(i.paidAt || '-') + '</td>' +
                '<td><button type="button" class="icon-btn" data-edit="' + h(i.id) + '" aria-label="상세">›</button></td></tr>';
            }).join('')
          : A.emptyRow(7, all.length ? '조건에 맞는 청구가 없습니다' : monthLabel(month) + ' 청구 내역이 없습니다',
              all.length ? '필터를 바꿔보세요.' : '위의 [이 달 구독 청구서 만들기] 를 눌러 구독 청구를 생성하세요.')) +
        '</tbody>' +
        (rows.length ? '<tfoot><tr><td colspan="3">합계</td><td class="num">' +
          A.money(rows.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0)) +
          '원</td><td colspan="3"></td></tr></tfoot>' : '') +
        '</table></div>' +

        (custRows.length
          ? '<div class="adm-card" style="margin-top:22px">' +
              '<h2>고객별 합계</h2>' +
              '<p class="adm-card-lead">' + h(monthLabel(month)) + ' 기준입니다. 교회별로 한 번에 청구하실 때 참고하세요.</p>' +
              '<div class="adm-tablewrap"><table class="adm-t" style="min-width:0"><thead><tr>' +
                '<th>고객 교회</th><th class="num" style="width:90px">건수</th>' +
                '<th class="num" style="width:130px">청구</th><th class="num" style="width:130px">입금</th>' +
                '<th class="num" style="width:130px">미수금</th>' +
              '</tr></thead><tbody>' +
              custRows.map(function (key) {
                var v = byCustomer[key];
                return '<tr><td class="strong">' + h(customerName(state, key)) + '</td>' +
                  '<td class="num">' + v.count + '</td>' +
                  '<td class="num">' + A.money(v.total) + '원</td>' +
                  '<td class="num">' + A.money(v.paid) + '원</td>' +
                  '<td class="num"' + (v.total - v.paid ? ' style="color:#B3261E;font-weight:700"' : '') + '>' +
                    A.money(v.total - v.paid) + '원</td></tr>';
              }).join('') +
              '</tbody></table></div>' +
            '</div>'
          : '');

      /* 이벤트 */
      root.querySelector('#stMonth').addEventListener('change', function (e) {
        month = e.target.value || thisMonth();
        A.rerender();
      });
      root.querySelector('#stGen').addEventListener('click', function () { generate(state); });
      root.querySelector('#stAdd').addEventListener('click', function () { openInvoice(null, state); });
      root.querySelector('#ststatus').addEventListener('change', function (e) {
        filter.status = e.target.value;
        A.rerender();
      });

      var stq = root.querySelector('#stq');
      var timer = null;
      stq.addEventListener('input', function () {
        filter.q = stq.value;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          A.rerender();
          var again = document.getElementById('stq');
          if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
        }, 260);
      });

      var tbody = root.querySelector('#invRows');
      tbody.addEventListener('change', function (e) {
        var box = e.target.closest('[data-paid]');
        if (!box) return;
        var isPaid = box.checked;
        db.update('invoices', box.dataset.paid, {
          status: isPaid ? 'paid' : 'unpaid',
          paidAt: isPaid ? new Date().toISOString().slice(0, 10) : '',
        }).then(function () {
          A.toast(isPaid ? '입금 완료로 표시했습니다.' : '미입금으로 되돌렸습니다.', 'ok');
        });
      });
      tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-edit]');
        if (btn) openInvoice(btn.dataset.edit, state);
      });

      ctx.actions.querySelector('#stCsv').addEventListener('click', function () {
        A.downloadCsv(
          'caps-정산-' + month + '.csv',
          ['청구월', '고객교회', '청구항목', '지원항목', '구분', '금액', '입금상태', '입금일', '메모'],
          rows.map(function (i) {
            return [i.month, customerName(state, i.customerId), i.title, db.serviceName(i.serviceId),
              i.kind === 'subscription' ? '구독' : '단건', i.amount,
              i.status === 'paid' ? '입금 완료' : '미입금', i.paidAt, i.memo];
          })
        );
      });
    },
  });
})();
