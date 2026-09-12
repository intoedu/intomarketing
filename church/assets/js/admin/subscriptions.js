/* 구독 관리 — 정기 계약(주보·행정 대행·앱 등) 등록과 상태 관리 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var filter = { q: '', status: '', service: '' };

  function customerName(state, id) {
    var hit = state.customers.filter(function (c) { return c.id === id; });
    return hit.length ? hit[0].name : '(삭제된 고객)';
  }

  function openSub(id, state, prefill) {
    var s = id ? state.subscriptions.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !s) return;
    var isNew = !s;
    s = s || Object.assign({ status: 'active', billingDay: 5, startDate: new Date().toISOString().slice(0, 10) }, prefill || {});

    var custOpts = ['<option value="">고객 교회를 선택하세요</option>'].concat(
      state.customers.map(function (c) {
        return '<option value="' + h(c.id) + '"' + (s.customerId === c.id ? ' selected' : '') + '>' + h(c.name) + '</option>';
      })
    ).join('');

    var svcOpts = ['<option value="">지원 항목을 선택하세요</option>'].concat(
      (window.CAPS_SERVICES || []).map(function (v) {
        return '<option value="' + v.id + '"' + (s.serviceId === v.id ? ' selected' : '') + '>' + h(v.name) + '</option>';
      })
    ).join('');

    var statusOpts = Object.keys(db.SUB_STATUS).map(function (k) {
      return '<option value="' + k + '"' + (s.status === k ? ' selected' : '') + '>' + h(db.SUB_STATUS[k]) + '</option>';
    }).join('');

    var dayOpts = [];
    for (var i = 1; i <= 28; i++) {
      dayOpts.push('<option value="' + i + '"' + (Number(s.billingDay) === i ? ' selected' : '') + '>매월 ' + i + '일</option>');
    }

    A.openDrawer({
      title: isNew ? '구독 등록' : db.serviceName(s.serviceId),
      sub: isNew ? '정기 계약을 등록하면 정산 화면에 매달 자동으로 잡힙니다.'
        : customerName(state, s.customerId) + ' · 시작 ' + (s.startDate || '-'),
      body:
        '<form id="subForm">' +
          '<div class="drawer-section"><h3>계약 대상</h3>' +
            '<div class="field"><label for="s_customerId">고객 교회 <em class="req">필수</em></label>' +
              '<select id="s_customerId" name="customerId">' + custOpts + '</select></div>' +
            '<div class="field"><label for="s_serviceId">지원 항목 <em class="req">필수</em></label>' +
              '<select id="s_serviceId" name="serviceId">' + svcOpts + '</select></div>' +
            '<div class="field"><label for="s_plan">계약 내용</label>' +
              '<input type="text" id="s_plan" name="plan" value="' + h(s.plan || '') + '" ' +
              'placeholder="예: 주보 정기 제작 (주 300부)"></div>' +
          '</div>' +

          '<div class="drawer-section"><h3>청구</h3>' +
            '<div class="field"><label for="s_monthlyFee">월 이용료 (원) <em class="req">필수</em></label>' +
              '<input type="number" id="s_monthlyFee" name="monthlyFee" min="0" step="1000" ' +
              'value="' + h(s.monthlyFee || '') + '" placeholder="350000"></div>' +
            '<div class="field"><label for="s_billingDay">청구일</label>' +
              '<select id="s_billingDay" name="billingDay">' + dayOpts.join('') + '</select></div>' +
            '<div class="field"><label for="s_startDate">계약 시작일</label>' +
              '<input type="date" id="s_startDate" name="startDate" value="' + h(s.startDate || '') + '"></div>' +
            '<div class="field"><label for="s_status">상태</label>' +
              '<select id="s_status" name="status">' + statusOpts + '</select>' +
              '<p class="field-hint">일시정지·종료 상태는 정산에서 제외됩니다.</p></div>' +
          '</div>' +

          '<div class="drawer-section"><h3>메모</h3>' +
            '<div class="field"><textarea id="s_memo" name="memo" rows="3" ' +
              'placeholder="계약 관련 특이사항">' + h(s.memo || '') + '</textarea></div>' +
          '</div>' +
        '</form>' +

        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
          '<button type="button" class="btn btn-primary" id="sSave">' + (isNew ? '등록하기' : '저장') + '</button>' +
          (isNew ? '' : '<button type="button" class="btn btn-outline" id="sDelete" ' +
            'style="margin-left:auto;color:#B3261E;border-color:#E5A9A3">삭제</button>') +
        '</div>',

      onMount: function (body) {
        body.querySelector('#sSave').addEventListener('click', function () {
          var form = body.querySelector('#subForm');
          var data = {};
          Array.prototype.slice.call(form.querySelectorAll('[name]')).forEach(function (input) {
            data[input.name] = input.value.trim();
          });
          if (!data.customerId) { A.toast('고객 교회를 선택해 주세요.', 'err'); return; }
          if (!data.serviceId) { A.toast('지원 항목을 선택해 주세요.', 'err'); return; }
          data.monthlyFee = Number(data.monthlyFee) || 0;
          data.billingDay = Number(data.billingDay) || 1;

          var done = isNew ? db.add('subscriptions', data) : db.update('subscriptions', s.id, data);
          done.then(function () {
            A.toast(isNew ? '구독을 등록했습니다.' : '저장했습니다.', 'ok');
            A.closeDrawer();
          }).catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
        });

        var del = body.querySelector('#sDelete');
        if (del) {
          del.addEventListener('click', function () {
            if (!window.confirm('이 구독을 삭제할까요? 지난 정산 기록은 그대로 남습니다.')) return;
            db.remove('subscriptions', s.id).then(function () {
              A.toast('삭제했습니다.');
              A.closeDrawer();
            });
          });
        }
      },
    });
  }

  A.register('subscriptions', {
    title: '구독 관리',
    nav: '구독 관리',
    desc: '월 정기 계약을 등록하고 상태를 관리합니다. 정산 화면에 매달 자동으로 반영됩니다.',
    icon: 'subscriptions',
    perm: 'customers',
    badge: function (state) {
      return state.subscriptions.filter(function (s) { return s.status === 'active'; }).length;
    },

    render: function (root, state, ctx) {
      var all = state.subscriptions;
      var rows = all.filter(function (s) {
        if (filter.status && s.status !== filter.status) return false;
        if (filter.service && s.serviceId !== filter.service) return false;
        if (!filter.q) return true;
        var hay = [customerName(state, s.customerId), db.serviceName(s.serviceId), s.plan, s.memo].join(' ').toLowerCase();
        return hay.indexOf(filter.q.toLowerCase()) > -1;
      });

      var active = all.filter(function (s) { return s.status === 'active'; });
      var mrr = active.reduce(function (sum, s) { return sum + (Number(s.monthlyFee) || 0); }, 0);
      var paused = all.filter(function (s) { return s.status === 'paused'; }).length;

      ctx.actions.innerHTML =
        '<button type="button" class="btn btn-primary btn-sm" id="sNew">구독 등록</button> ' +
        '<button type="button" class="btn btn-outline btn-sm" id="sCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + active.length + '</strong><span>이용중</span></div>' +
          '<div class="adm-stat"><strong>' + paused + '</strong><span>일시정지</span></div>' +
          '<div class="adm-stat is-accent"><strong>' + A.money(mrr) + '</strong><span>월 합계 (원)</span></div>' +
          '<div class="adm-stat"><strong>' + A.money(mrr * 12) + '</strong><span>연 환산 (원)</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          '<input type="search" id="sq" placeholder="교회명 · 항목 · 계약 내용 검색" value="' + h(filter.q) + '">' +
          '<select id="sstatus"><option value="">상태 전체</option>' +
            Object.keys(db.SUB_STATUS).map(function (k) {
              return '<option value="' + k + '"' + (filter.status === k ? ' selected' : '') + '>' +
                h(db.SUB_STATUS[k]) + '</option>';
            }).join('') + '</select>' +
          '<select id="sservice"><option value="">항목 전체</option>' +
            (window.CAPS_SERVICES || []).map(function (v) {
              return '<option value="' + v.id + '"' + (filter.service === v.id ? ' selected' : '') + '>' +
                h(v.name) + '</option>';
            }).join('') + '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th>고객 교회</th><th style="width:150px">지원 항목</th><th>계약 내용</th>' +
          '<th class="num" style="width:120px">월 이용료</th><th style="width:100px">청구일</th>' +
          '<th style="width:110px">시작일</th><th style="width:110px">상태</th>' +
        '</tr></thead><tbody id="subRows">' +
        (rows.length
          ? rows.map(function (s) {
              return '<tr data-id="' + h(s.id) + '" style="cursor:pointer">' +
                '<td class="strong">' + h(customerName(state, s.customerId)) + '</td>' +
                '<td>' + h(db.serviceName(s.serviceId)) + '</td>' +
                '<td>' + h(s.plan || '-') +
                  (s.memo ? '<span class="sub">' + h(s.memo.slice(0, 30)) + (s.memo.length > 30 ? '…' : '') + '</span>' : '') + '</td>' +
                '<td class="num">' + A.money(s.monthlyFee) + '원</td>' +
                '<td class="nowrap">매월 ' + h(s.billingDay || 1) + '일</td>' +
                '<td class="nowrap">' + h(s.startDate || '-') + '</td>' +
                '<td><span class="st st-' + h(s.status) + '">' + h(db.SUB_STATUS[s.status] || s.status) + '</span></td></tr>';
            }).join('')
          : A.emptyRow(7, all.length ? '조건에 맞는 구독이 없습니다' : '등록된 구독이 없습니다',
              all.length ? '검색어나 필터를 바꿔보세요.' : '주보 정기 제작이나 행정 대행처럼 매달 청구하는 계약을 등록하세요.')) +
        '</tbody>' +
        (rows.length ? '<tfoot><tr><td colspan="3">이용중 합계</td>' +
          '<td class="num">' + A.money(rows.filter(function (s) { return s.status === 'active'; })
            .reduce(function (sum, s) { return sum + (Number(s.monthlyFee) || 0); }, 0)) + '원</td>' +
          '<td colspan="3"></td></tr></tfoot>' : '') +
        '</table></div>';

      var sq = root.querySelector('#sq');
      var timer = null;
      sq.addEventListener('input', function () {
        filter.q = sq.value;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          A.rerender();
          var again = document.getElementById('sq');
          if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
        }, 260);
      });
      root.querySelector('#sstatus').addEventListener('change', function (e) { filter.status = e.target.value; A.rerender(); });
      root.querySelector('#sservice').addEventListener('change', function (e) { filter.service = e.target.value; A.rerender(); });

      root.querySelector('#subRows').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (tr) openSub(tr.dataset.id, state);
      });

      ctx.actions.querySelector('#sNew').addEventListener('click', function () { openSub(null, state); });
      ctx.actions.querySelector('#sCsv').addEventListener('click', function () {
        A.downloadCsv(
          'caps-구독목록.csv',
          ['고객교회', '지원항목', '계약내용', '월이용료', '청구일', '시작일', '상태', '메모'],
          rows.map(function (s) {
            return [customerName(state, s.customerId), db.serviceName(s.serviceId), s.plan,
              s.monthlyFee, s.billingDay, s.startDate, db.SUB_STATUS[s.status] || s.status, s.memo];
          })
        );
      });

      /* 다른 화면에서 '구독으로 등록' 을 누른 경우 */
      var pending = window.sessionStorage.getItem('caps.admin.newSub');
      if (pending) {
        window.sessionStorage.removeItem('caps.admin.newSub');
        try { openSub(null, state, JSON.parse(pending)); } catch (e) { openSub(null, state); }
      }
    },
  });
})();
