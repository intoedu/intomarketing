/* 정보 수정 승인 — 고객에게 보낸 요청과 응답을 한 화면에서 봅니다.
 *
 * 교회가 알려준 정보(교회명 · 담당자 · 연락처 등)는
 * 그 교회가 승인한 동안에만 수정할 수 있습니다.
 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var filter = 'open'; // open | all

  function customerOf(state, id) {
    return state.customers.filter(function (c) { return c.id === id; })[0] || null;
  }

  function userOf(state, id) {
    return state.users.filter(function (u) { return u.id === id; })[0] || null;
  }

  var ST_CLASS = {
    pending: 'hold', approved: 'progress', rejected: 'canceled',
    used: 'done', canceled: 'canceled', expired: 'canceled',
  };

  A.register('consents', {
    title: '정보 수정 승인',
    nav: '정보 수정 승인',
    desc: '고객 교회에 정보 수정 승인을 요청하고, 응답을 확인합니다.',
    icon: 'consents',
    perm: 'customers',
    alerts: function (state) {
      return state.editConsents
        .filter(function (x) { return x.status === 'pending'; })
        .map(function (x) { return x.id; });
    },

    render: function (root, state, ctx) {
      var all = state.editConsents.slice().sort(function (a, b) {
        return String(b.requestedAt || '').localeCompare(String(a.requestedAt || ''));
      });

      var rows = all.filter(function (x) {
        if (filter === 'all') return true;
        return x.status === 'pending' || db.consentLive(x);
      });

      var pending = all.filter(function (x) { return x.status === 'pending'; }).length;
      var live = all.filter(function (x) { return db.consentLive(x); }).length;
      var rejected = all.filter(function (x) { return x.status === 'rejected'; }).length;

      ctx.actions.innerHTML =
        '<button type="button" class="btn btn-outline btn-sm" id="ecCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-card" style="margin-bottom:18px">' +
          '<h2>어떻게 쓰는 화면인가요?</h2>' +
          '<p class="adm-card-lead">교회가 알려준 정보는 센터가 임의로 고칠 수 없습니다. ' +
            '[고객 관리] 에서 해당 교회를 열고 <strong>[정보 수정 요청 보내기]</strong> 를 누르면, ' +
            '그 교회 계정이 홈페이지에서 승인 또는 거절합니다. ' +
            '승인하면 ' + db.CONSENT_DAYS + '일 동안 수정할 수 있고, 저장을 마치면 다시 잠깁니다.</p>' +
        '</div>' +

        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + pending + '</strong><span>승인 대기</span></div>' +
          '<div class="adm-stat is-accent"><strong>' + live + '</strong><span>지금 수정 가능</span></div>' +
          '<div class="adm-stat"><strong>' + rejected + '</strong><span>거절</span></div>' +
          '<div class="adm-stat"><strong>' + all.length + '</strong><span>전체 요청</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          '<select id="ecFilter">' +
            '<option value="open"' + (filter === 'open' ? ' selected' : '') + '>진행 중인 요청만</option>' +
            '<option value="all"' + (filter === 'all' ? ' selected' : '') + '>전체 보기</option>' +
          '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th>교회</th><th style="width:150px">승인할 계정</th><th>요청 항목 · 사유</th>' +
          '<th style="width:120px">상태</th><th style="width:150px">요청 · 응답</th><th style="width:120px"></th>' +
        '</tr></thead><tbody id="ecRows">' +
        (rows.length
          ? rows.map(function (x) {
              var v = db.consentView(x);
              var c = customerOf(state, x.customerId);
              var u = userOf(state, x.userId);
              return '<tr data-id="' + h(x.id) + '">' +
                '<td class="strong">' + h(x.customerName || (c ? c.name : '(삭제된 고객)')) +
                  (c ? '' : '<span class="sub">고객 정보가 삭제되었습니다</span>') + '</td>' +
                '<td>' + h(u ? (u.name || u.email) : '-') +
                  (u ? '<span class="sub">' + h(u.email) + '</span>' : '') + '</td>' +
                '<td>' + h(db.fieldLabels(v.fields)) +
                  (v.reason ? '<span class="sub">' + h(v.reason) + '</span>' : '') +
                  (x.rejectNote ? '<span class="sub">거절 사유: ' + h(x.rejectNote) + '</span>' : '') + '</td>' +
                '<td><span class="st st-' + h(ST_CLASS[v.status] || 'received') + '">' + h(v.label) + '</span>' +
                  (v.live && v.expiresAt
                    ? '<span class="sub">' + h(db.formatDate(v.expiresAt, false)) + ' 까지</span>' : '') + '</td>' +
                '<td class="nowrap">' + h(db.formatDate(x.requestedAt, false)) +
                  (x.respondedAt ? '<span class="sub">응답 ' + h(db.formatDate(x.respondedAt, false)) + '</span>' : '') +
                  (x.requestedByName ? '<span class="sub">' + h(x.requestedByName) + '</span>' : '') + '</td>' +
                '<td>' +
                  (c ? '<button type="button" class="btn btn-outline btn-sm" data-open="' + h(x.customerId) + '">고객 열기</button>' : '') +
                  (x.status === 'pending'
                    ? ' <button type="button" class="btn btn-outline btn-sm" data-cancel="' + h(x.customerId) + '">취소</button>'
                    : '') +
                '</td></tr>';
            }).join('')
          : A.emptyRow(6, all.length ? '진행 중인 요청이 없습니다' : '보낸 요청이 없습니다',
              '[고객 관리] 에서 교회를 열고 [정보 수정 요청 보내기] 를 눌러주세요.')) +
        '</tbody></table></div>';

      root.querySelector('#ecFilter').addEventListener('change', function (e) {
        filter = e.target.value;
        A.rerender();
      });

      root.querySelector('#ecRows').addEventListener('click', function (e) {
        var open = e.target.closest('[data-open]');
        if (open) {
          window.sessionStorage.setItem('caps.admin.openCustomer', open.dataset.open);
          A.go('customers');
          return;
        }
        var cancel = e.target.closest('[data-cancel]');
        if (cancel) {
          db.cancelChurchEdit(cancel.dataset.cancel).then(function () {
            A.toast('요청을 취소했습니다.');
          }).catch(function (err) { A.toast(err.message || '취소에 실패했습니다.', 'err'); });
        }
      });

      ctx.actions.querySelector('#ecCsv').addEventListener('click', function () {
        A.downloadCsv(
          'caps-정보수정승인.csv',
          ['교회', '승인 계정', '요청 항목', '사유', '상태', '요청일', '응답일', '기한', '거절 사유', '요청자'],
          rows.map(function (x) {
            var v = db.consentView(x);
            var u = userOf(state, x.userId);
            return [x.customerName, u ? u.email : '', db.fieldLabels(v.fields), v.reason, v.label,
              db.formatDate(x.requestedAt, false), db.formatDate(x.respondedAt, false),
              x.expiresAt ? db.formatDate(x.expiresAt, false) : '', x.rejectNote, x.requestedByName];
          })
        );
      });
    },
  });
})();
