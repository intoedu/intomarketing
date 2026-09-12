/* 대시보드 — 한눈에 보는 현황 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  function thisMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  A.register('dashboard', {
    title: '대시보드',
    nav: '대시보드',
    desc: '센터 전체 현황을 한눈에 확인합니다.',
    icon: 'dashboard',

    render: function (root, state) {
      var me = db.auth.current();
      // 정산·고객 권한이 없는 직원에게는 금액 정보를 표시하지 않습니다.
      var canSeeMoney = db.can('settlement') || db.can('customers');
      var myOpen = state.requests.filter(function (r) {
        return r.assignee === me.id && ['done', 'canceled'].indexOf(r.status) === -1;
      }).length;

      var reqs = state.requests;
      var newReqs = reqs.filter(function (r) { return r.status === 'received'; });
      var running = reqs.filter(function (r) {
        return ['consulting', 'proposed', 'progress'].indexOf(r.status) > -1;
      });
      var activeSubs = state.subscriptions.filter(function (s) { return s.status === 'active'; });
      var mrr = activeSubs.reduce(function (sum, s) { return sum + (Number(s.monthlyFee) || 0); }, 0);
      var pendingStaff = state.users.filter(function (u) {
        return u.role !== 'client' && !u.approved;
      });

      /* 이번 달 미수금 */
      var month = thisMonth();
      var unpaid = state.invoices.filter(function (i) {
        return i.month === month && i.status !== 'paid';
      });
      var unpaidSum = unpaid.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0);

      /* 항목별 신청 수 */
      var byService = {};
      reqs.forEach(function (r) {
        (r.services || []).forEach(function (id) {
          byService[id] = (byService[id] || 0) + 1;
        });
      });
      var serviceRows = (window.CAPS_SERVICES || [])
        .map(function (s) {
          return { id: s.id, name: s.name, count: byService[s.id] || 0 };
        })
        .sort(function (a, b) { return b.count - a.count; });
      var maxCount = Math.max.apply(null, serviceRows.map(function (r) { return r.count; }).concat([1]));

      var recent = reqs.slice(0, 6);

      root.innerHTML =
        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + newReqs.length + '</strong><span>새 신청 (미확인)</span>' +
            (newReqs.length ? '<small>확인이 필요합니다</small>' : '') + '</div>' +
          '<div class="adm-stat"><strong>' + running.length + '</strong><span>진행 중인 건</span></div>' +
          '<div class="adm-stat"><strong>' + state.customers.length + '</strong><span>등록 고객 교회</span></div>' +
          (canSeeMoney
            ? '<div class="adm-stat is-accent"><strong>' + A.money(mrr) + '</strong><span>월 구독 합계 (원)</span>' +
              '<small>이용중 ' + activeSubs.length + '건</small></div>'
            : '<div class="adm-stat"><strong>' + myOpen + '</strong><span>내 진행 작업</span>' +
              '<small><button type="button" class="link-btn" data-view="mytasks">내 작업 보기</button></small></div>') +
        '</div>' +

        (pendingStaff.length
          ? '<div class="guide-box"><strong>승인 대기 중인 직원이 ' + pendingStaff.length + '명 있습니다.</strong> ' +
            '<button type="button" class="link-btn" data-view="members">관리자 목록에서 승인하기</button></div>'
          : '') +

        (unpaid.length && canSeeMoney
          ? '<div class="guide-box"><strong>이번 달 미수금 ' + A.money(unpaidSum) + '원</strong> (' + unpaid.length + '건) · ' +
            '<button type="button" class="link-btn" data-view="settlement">정산 화면에서 확인</button></div>'
          : '') +

        '<div class="adm-card">' +
          '<div class="adm-card-head"><h2>최근 신청</h2>' +
            '<button type="button" class="btn btn-outline btn-sm" data-view="requests">전체 보기</button></div>' +
          '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
            '<th>접수번호</th><th>교회명</th><th>신청 항목</th><th>상태</th><th>접수일</th>' +
          '</tr></thead><tbody>' +
          (recent.length
            ? recent.map(function (r) {
                return '<tr><td class="code">' + h(r.code) + '</td>' +
                  '<td class="strong">' + h(r.church_name) + '</td>' +
                  '<td><div class="chip-row">' + (r.services || []).map(function (id) {
                    return '<span class="chip">' + h(db.serviceName(id)) + '</span>';
                  }).join('') + '</div></td>' +
                  '<td><span class="st st-' + h(r.status) + '">' + h(db.REQUEST_STATUS[r.status] || r.status) + '</span></td>' +
                  '<td class="nowrap">' + h(db.formatDate(r.createdAt, false)) + '</td></tr>';
              }).join('')
            : A.emptyRow(5, '아직 신청이 없습니다', '홈페이지에서 신청이 들어오면 여기에 표시됩니다.')) +
          '</tbody></table></div>' +
        '</div>' +

        '<div class="adm-card">' +
          '<h2>항목별 신청 현황</h2>' +
          '<p class="adm-card-lead">누적 신청 건수입니다. 수요가 많은 항목을 확인하세요.</p>' +
          '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
            '<th style="width:200px">지원 항목</th><th>신청 건수</th><th class="num" style="width:90px">건</th>' +
          '</tr></thead><tbody>' +
          serviceRows.map(function (s) {
            var pct = Math.round((s.count / maxCount) * 100);
            return '<tr><td class="strong">' + h(s.name) + '</td>' +
              '<td><div style="height:10px;border-radius:999px;background:var(--line-2);overflow:hidden;max-width:420px">' +
                '<div style="height:100%;width:' + pct + '%;background:var(--brand-500);border-radius:999px"></div>' +
              '</div></td>' +
              '<td class="num">' + s.count + '</td></tr>';
          }).join('') +
          '</tbody></table></div>' +
        '</div>';
    },
  });
})();
