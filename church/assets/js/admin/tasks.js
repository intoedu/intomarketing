/* 작업 관리
 *   내 작업        — 나에게 배정된 건만. 디데이 설정·상태 변경 가능 (권한 없이 사용)
 *   전체 작업      — 모든 직원이 전체 진행 상황을 확인 (읽기 전용)
 *   직원별 업무량  — 누가 얼마나 들고 있는지 (직원 관리 권한자 · 최고관리자)
 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var OPEN = ['received', 'consulting', 'proposed', 'progress', 'hold'];

  var mineFilter = { q: '', show: 'open' };
  var allFilter = { q: '', status: '', assignee: '', show: 'open' };

  function staffList(state) {
    return state.users.filter(function (u) { return u.role !== 'client' && u.approved; });
  }

  function staffName(state, id) {
    if (!id) return '';
    var hit = state.users.filter(function (u) { return u.id === id; });
    return hit.length ? (hit[0].name || hit[0].email) : '(삭제된 계정)';
  }

  function isOpen(r) { return OPEN.indexOf(r.status) > -1; }

  /** 디데이 배지 */
  function ddayBadge(r) {
    if (db.isClosed(r.status)) {
      return '<span class="dd dd-done">완료</span>';
    }
    var d = db.dday(r.dueDate);
    if (!d) return '<span class="dd dd-none">미설정</span>';
    return '<span class="dd ' + d.cls + '">' + d.label + '</span>';
  }

  /** 마감 임박·지연 정렬 (미설정은 뒤로) */
  function byDue(a, b) {
    var da = db.dday(a.dueDate);
    var dbb = db.dday(b.dueDate);
    if (!da && !dbb) return 0;
    if (!da) return 1;
    if (!dbb) return -1;
    return da.days - dbb.days;
  }

  function statusOptions(cur) {
    return Object.keys(db.REQUEST_STATUS).map(function (k) {
      return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' +
        h(db.REQUEST_STATUS[k]) + '</option>';
    }).join('');
  }

  function searchBox(id, value, placeholder) {
    return '<input type="search" id="' + id + '" placeholder="' + h(placeholder) + '" value="' + h(value) + '">';
  }

  /** 검색창 입력을 디바운스하고 포커스를 유지합니다. */
  function wireSearch(root, id, onValue) {
    var el = root.querySelector('#' + id);
    var timer = null;
    el.addEventListener('input', function () {
      onValue(el.value);
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        A.rerender();
        var again = document.getElementById(id);
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      }, 260);
    });
  }

  /* =========================================================
     내 작업
     ========================================================= */

  A.register('mytasks', {
    title: '내 작업',
    nav: '내 작업',
    desc: '나에게 배정된 건만 모았습니다. 마감일(디데이)을 직접 설정할 수 있습니다.',
    icon: 'mytasks',
    badge: function (state) {
      var me = db.auth.current();
      if (!me) return 0;
      return state.requests.filter(function (r) {
        return r.assignee === me.id && isOpen(r);
      }).length;
    },

    render: function (root, state, ctx) {
      var me = db.auth.current();
      var mine = state.requests.filter(function (r) { return r.assignee === me.id; });

      var open = mine.filter(isOpen);
      var late = open.filter(function (r) {
        var d = db.dday(r.dueDate);
        return d && d.late;
      });
      var soon = open.filter(function (r) {
        var d = db.dday(r.dueDate);
        return d && !d.late && d.days <= 3;
      });
      var noDue = open.filter(function (r) { return !r.dueDate; });

      var rows = mine
        .filter(function (r) {
          if (mineFilter.show === 'open' && !isOpen(r)) return false;
          if (mineFilter.show === 'late') {
            var d = db.dday(r.dueDate);
            if (!isOpen(r) || !d || !d.late) return false;
          }
          if (!mineFilter.q) return true;
          var hay = [r.code, r.church_name, r.contact_name, r.memo].join(' ').toLowerCase();
          return hay.indexOf(mineFilter.q.toLowerCase()) > -1;
        })
        .sort(byDue);

      ctx.actions.innerHTML =
        '<button type="button" class="btn btn-outline btn-sm" id="mineCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + open.length + '</strong><span>진행 중인 내 작업</span></div>' +
          '<div class="adm-stat' + (late.length ? ' is-alert' : '') + '"><strong>' + late.length +
            '</strong><span>마감 지남</span>' + (late.length ? '<small>확인이 필요합니다</small>' : '') + '</div>' +
          '<div class="adm-stat"><strong>' + soon.length + '</strong><span>3일 이내 마감</span></div>' +
          '<div class="adm-stat"><strong>' + noDue.length + '</strong><span>마감일 미설정</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          searchBox('mineQ', mineFilter.q, '교회명 · 접수번호 · 메모 검색') +
          '<select id="mineShow">' +
            '<option value="open"' + (mineFilter.show === 'open' ? ' selected' : '') + '>진행 중만</option>' +
            '<option value="late"' + (mineFilter.show === 'late' ? ' selected' : '') + '>마감 지난 건만</option>' +
            '<option value="all"' + (mineFilter.show === 'all' ? ' selected' : '') + '>완료 포함 전체</option>' +
          '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th style="width:96px">디데이</th><th style="width:150px">마감일</th>' +
          '<th>교회명 · 항목</th><th style="width:140px">상태</th>' +
          '<th>진행</th><th style="width:60px"></th>' +
        '</tr></thead><tbody id="mineRows">' +
        (rows.length
          ? rows.map(function (r) {
              var done = (r.tasks || []).filter(function (t) { return t.done; }).length;
              var total = (r.tasks || []).length;
              return '<tr>' +
                '<td>' + ddayBadge(r) + '</td>' +
                '<td><input type="date" class="due-input" data-due="' + h(r.id) + '" value="' + h(r.dueDate || '') + '"></td>' +
                '<td class="strong">' + h(r.church_name) +
                  '<span class="sub">' + h((r.services || []).map(db.serviceName).join(', ')) + '</span></td>' +
                '<td><select class="inline-select" data-status="' + h(r.id) + '">' +
                  statusOptions(r.status) + '</select></td>' +
                '<td>' + (total ? done + ' / ' + total : '<span style="color:var(--muted)">-</span>') +
                  (r.memo ? '<span class="sub">' + h(r.memo.slice(0, 26)) + (r.memo.length > 26 ? '…' : '') + '</span>' : '') + '</td>' +
                '<td><button type="button" class="icon-btn" data-open="' + h(r.id) + '" aria-label="상세">›</button></td>' +
                '</tr>';
            }).join('')
          : A.emptyRow(6,
              mine.length ? '조건에 맞는 작업이 없습니다' : '배정된 작업이 없습니다',
              mine.length ? '필터를 바꿔보세요.' : '신청 건에 담당자로 배정되면 여기에 표시됩니다.')) +
        '</tbody></table></div>';

      wireSearch(root, 'mineQ', function (v) { mineFilter.q = v; });
      root.querySelector('#mineShow').addEventListener('change', function (e) {
        mineFilter.show = e.target.value;
        A.rerender();
      });

      var tbody = root.querySelector('#mineRows');

      tbody.addEventListener('change', function (e) {
        var due = e.target.closest('[data-due]');
        if (due) {
          db.update('requests', due.dataset.due, { dueDate: due.value })
            .then(function () { A.toast(due.value ? '마감일을 저장했습니다.' : '마감일을 지웠습니다.', 'ok'); })
            .catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
          return;
        }
        var st = e.target.closest('[data-status]');
        if (st) {
          db.update('requests', st.dataset.status, { status: st.value })
            .then(function () { A.toast('상태를 변경했습니다.', 'ok'); })
            .catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
        }
      });

      tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-open]');
        if (btn) openMine(btn.dataset.open, state);
      });

      ctx.actions.querySelector('#mineCsv').addEventListener('click', function () {
        A.downloadCsv('caps-내작업.csv',
          ['접수번호', '교회명', '신청항목', '상태', '마감일', '디데이', '할일완료', '메모'],
          rows.map(function (r) {
            var d = db.dday(r.dueDate);
            return [r.code, r.church_name, (r.services || []).map(db.serviceName).join(' / '),
              db.REQUEST_STATUS[r.status] || r.status, r.dueDate || '', d ? d.label : '',
              (r.tasks || []).filter(function (t) { return t.done; }).length + '/' + (r.tasks || []).length,
              r.memo];
          }));
      });
    },
  });

  /** 내 작업 상세 — 담당자가 수정할 수 있는 항목만 */
  function openMine(id, state) {
    var r = state.requests.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var tasks = (r.tasks || []).map(function (t) { return { text: t.text, done: t.done }; });

    function taskRows(list) {
      if (!list.length) {
        return '<li style="background:none;border:none;padding:4px 0;color:var(--muted);font-size:14px">' +
          '등록된 할 일이 없습니다.</li>';
      }
      return list.map(function (t, i) {
        return '<li' + (t.done ? ' class="is-done"' : '') + '>' +
          '<input type="checkbox" data-task-idx="' + i + '"' + (t.done ? ' checked' : '') + ' aria-label="완료 표시">' +
          '<span>' + h(t.text) + '</span>' +
          '<button type="button" class="icon-btn is-danger" data-task-del="' + i + '" aria-label="삭제">×</button></li>';
      }).join('');
    }

    function row(dt, dd) {
      return dd ? '<div><dt>' + h(dt) + '</dt><dd>' + h(dd) + '</dd></div>' : '';
    }

    A.openDrawer({
      title: r.church_name,
      sub: r.code + ' · 내 작업',
      body:
        '<div class="drawer-section"><h3>마감일 (디데이)</h3>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<input type="date" id="mdDue" value="' + h(r.dueDate || '') + '" ' +
            'style="padding:12px 14px;border:1.5px solid var(--line);border-radius:10px;font-size:14.5px">' +
            ddayBadge(r) +
          '</div>' +
          '<p class="field-hint">비워두면 마감일 없이 진행합니다.</p>' +
        '</div>' +

        '<div class="drawer-section"><h3>상태</h3>' +
          '<select id="mdStatus" style="width:100%;padding:12px 14px;border:1.5px solid var(--line);' +
          'border-radius:10px;font-size:14.5px">' + statusOptions(r.status) + '</select></div>' +

        '<div class="drawer-section"><h3>진행 메모</h3>' +
          '<textarea id="mdMemo" rows="4" style="width:100%;padding:13px 15px;border:1.5px solid var(--line);' +
          'border-radius:10px;font-size:14.5px;line-height:1.7;resize:vertical">' + h(r.memo || '') + '</textarea></div>' +

        '<div class="drawer-section"><h3>할 일</h3>' +
          '<div class="task-add"><input type="text" id="mdTaskInput" placeholder="할 일 입력 후 Enter">' +
            '<button type="button" class="btn btn-outline btn-sm" id="mdTaskAdd">추가</button></div>' +
          '<ul class="task-list" id="mdTasks">' + taskRows(tasks) + '</ul></div>' +

        '<div class="drawer-section"><h3>신청 내용</h3><dl class="dl-flat">' +
          row('신청 항목', (r.services || []).map(db.serviceName).join(', ')) +
          row('담당자', (r.contact_name || '') + (r.contact_role ? ' ' + r.contact_role : '')) +
          row('연락처', r.phone) +
          row('이메일', r.email) +
          row('소재지', r.location) +
          row('희망 시기', r.timeline) +
          row('요청 내용', r.message) +
        '</dl></div>' +

        '<button type="button" class="btn btn-primary" id="mdSave">저장</button>',

      onMount: function (body) {
        function redraw() { body.querySelector('#mdTasks').innerHTML = taskRows(tasks); }

        function addTask() {
          var input = body.querySelector('#mdTaskInput');
          var text = input.value.trim();
          if (!text) return;
          tasks.push({ text: text, done: false });
          input.value = '';
          redraw();
        }

        body.querySelector('#mdTaskAdd').addEventListener('click', addTask);
        body.querySelector('#mdTaskInput').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); addTask(); }
        });

        body.querySelector('#mdTasks').addEventListener('click', function (e) {
          var del = e.target.closest('[data-task-del]');
          if (del) { tasks.splice(Number(del.dataset.taskDel), 1); redraw(); return; }
          var box = e.target.closest('[data-task-idx]');
          if (box) { tasks[Number(box.dataset.taskIdx)].done = box.checked; redraw(); }
        });

        body.querySelector('#mdSave').addEventListener('click', function () {
          db.update('requests', r.id, {
            dueDate: body.querySelector('#mdDue').value,
            status: body.querySelector('#mdStatus').value,
            memo: body.querySelector('#mdMemo').value,
            tasks: tasks,
          }).then(function () {
            A.toast('저장했습니다.', 'ok');
            A.closeDrawer();
          }).catch(function (err) {
            A.toast(err.message || '저장에 실패했습니다.', 'err');
          });
        });
      },
    });
  }

  /* =========================================================
     전체 작업 (모든 직원 열람)
     ========================================================= */

  A.register('alltasks', {
    title: '전체 작업',
    nav: '전체 작업',
    desc: '센터의 모든 진행 상황입니다. 모든 직원이 확인할 수 있습니다.',
    icon: 'alltasks',
    badge: function (state) {
      return state.requests.filter(isOpen).length;
    },

    render: function (root, state, ctx) {
      var all = state.requests;
      var open = all.filter(isOpen);
      var late = open.filter(function (r) {
        var d = db.dday(r.dueDate);
        return d && d.late;
      });
      var unassigned = open.filter(function (r) { return !r.assignee; });

      var rows = all
        .filter(function (r) {
          if (allFilter.show === 'open' && !isOpen(r)) return false;
          if (allFilter.show === 'late') {
            var d = db.dday(r.dueDate);
            if (!isOpen(r) || !d || !d.late) return false;
          }
          if (allFilter.status && r.status !== allFilter.status) return false;
          if (allFilter.assignee === '__none') {
            if (r.assignee) return false;
          } else if (allFilter.assignee && r.assignee !== allFilter.assignee) return false;
          if (!allFilter.q) return true;
          var hay = [r.code, r.church_name, r.contact_name, r.memo, staffName(state, r.assignee)]
            .join(' ').toLowerCase();
          return hay.indexOf(allFilter.q.toLowerCase()) > -1;
        })
        .sort(byDue);

      ctx.actions.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="allCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + open.length + '</strong><span>진행 중</span></div>' +
          '<div class="adm-stat' + (late.length ? ' is-alert' : '') + '"><strong>' + late.length +
            '</strong><span>마감 지남</span></div>' +
          '<div class="adm-stat"><strong>' + unassigned.length + '</strong><span>담당자 미배정</span></div>' +
          '<div class="adm-stat"><strong>' +
            all.filter(function (r) { return r.status === 'done'; }).length + '</strong><span>완료</span></div>' +
        '</div>' +

        '<div class="adm-toolbar">' +
          searchBox('allQ', allFilter.q, '교회명 · 접수번호 · 담당자 검색') +
          '<select id="allShow">' +
            '<option value="open"' + (allFilter.show === 'open' ? ' selected' : '') + '>진행 중만</option>' +
            '<option value="late"' + (allFilter.show === 'late' ? ' selected' : '') + '>마감 지난 건만</option>' +
            '<option value="all"' + (allFilter.show === 'all' ? ' selected' : '') + '>완료 포함 전체</option>' +
          '</select>' +
          '<select id="allStatus"><option value="">상태 전체</option>' + statusOptions(allFilter.status) + '</select>' +
          '<select id="allAssignee"><option value="">담당자 전체</option>' +
            '<option value="__none"' + (allFilter.assignee === '__none' ? ' selected' : '') + '>미배정</option>' +
            staffList(state).map(function (u) {
              return '<option value="' + h(u.id) + '"' + (allFilter.assignee === u.id ? ' selected' : '') + '>' +
                h(u.name || u.email) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th style="width:96px">디데이</th><th style="width:104px">마감일</th>' +
          '<th>교회명 · 항목</th><th style="width:130px">담당자</th>' +
          '<th style="width:110px">상태</th><th>진행</th><th style="width:100px">접수일</th>' +
        '</tr></thead><tbody>' +
        (rows.length
          ? rows.map(function (r) {
              var done = (r.tasks || []).filter(function (t) { return t.done; }).length;
              var total = (r.tasks || []).length;
              return '<tr>' +
                '<td>' + ddayBadge(r) + '</td>' +
                '<td class="nowrap">' + h(r.dueDate || '-') + '</td>' +
                '<td class="strong">' + h(r.church_name) +
                  '<span class="sub">' + h((r.services || []).map(db.serviceName).join(', ')) + '</span></td>' +
                '<td class="nowrap">' + (r.assignee ? h(staffName(state, r.assignee))
                  : '<span style="color:var(--muted)">미배정</span>') + '</td>' +
                '<td><span class="st st-' + h(r.status) + '">' +
                  h(db.REQUEST_STATUS[r.status] || r.status) + '</span></td>' +
                '<td>' + (total ? done + ' / ' + total : '<span style="color:var(--muted)">-</span>') + '</td>' +
                '<td class="nowrap">' + h(db.formatDate(r.createdAt, false)) + '</td></tr>';
            }).join('')
          : A.emptyRow(7, all.length ? '조건에 맞는 작업이 없습니다' : '아직 신청이 없습니다',
              all.length ? '필터를 바꿔보세요.' : '')) +
        '</tbody></table></div>' +

        '<p class="adm-note">전체 작업은 열람 전용입니다. 내용 수정은 담당자가 ' +
          '<button type="button" class="link-btn" data-view="mytasks">내 작업</button> 에서 하거나, ' +
          '신청·의뢰 관리 권한자가 처리합니다.</p>';

      wireSearch(root, 'allQ', function (v) { allFilter.q = v; });
      root.querySelector('#allShow').addEventListener('change', function (e) {
        allFilter.show = e.target.value; A.rerender();
      });
      root.querySelector('#allStatus').addEventListener('change', function (e) {
        allFilter.status = e.target.value; A.rerender();
      });
      root.querySelector('#allAssignee').addEventListener('change', function (e) {
        allFilter.assignee = e.target.value; A.rerender();
      });

      ctx.actions.querySelector('#allCsv').addEventListener('click', function () {
        A.downloadCsv('caps-전체작업.csv',
          ['접수번호', '교회명', '신청항목', '담당자', '상태', '마감일', '디데이', '할일완료', '접수일'],
          rows.map(function (r) {
            var d = db.dday(r.dueDate);
            return [r.code, r.church_name, (r.services || []).map(db.serviceName).join(' / '),
              staffName(state, r.assignee), db.REQUEST_STATUS[r.status] || r.status,
              r.dueDate || '', d ? d.label : '',
              (r.tasks || []).filter(function (t) { return t.done; }).length + '/' + (r.tasks || []).length,
              db.formatDate(r.createdAt, false)];
          }));
      });
    },
  });

  /* =========================================================
     직원별 업무량
     ========================================================= */

  A.register('workload', {
    title: '직원별 업무량',
    nav: '직원별 업무량',
    desc: '직원마다 얼마나 일을 들고 있는지 확인합니다.',
    icon: 'workload',
    perm: 'members',

    render: function (root, state, ctx) {
      var staff = staffList(state);
      var open = state.requests.filter(isOpen);

      var stats = staff.map(function (u) {
        var mine = state.requests.filter(function (r) { return r.assignee === u.id; });
        var mineOpen = mine.filter(isOpen);
        var late = mineOpen.filter(function (r) {
          var d = db.dday(r.dueDate);
          return d && d.late;
        });
        var soon = mineOpen.filter(function (r) {
          var d = db.dday(r.dueDate);
          return d && !d.late && d.days <= 3;
        });
        return {
          user: u,
          open: mineOpen.length,
          late: late.length,
          soon: soon.length,
          noDue: mineOpen.filter(function (r) { return !r.dueDate; }).length,
          done: mine.filter(function (r) { return r.status === 'done'; }).length,
          total: mine.length,
        };
      }).sort(function (a, b) { return b.open - a.open; });

      var unassigned = open.filter(function (r) { return !r.assignee; });
      var maxOpen = Math.max.apply(null, stats.map(function (s) { return s.open; }).concat([1]));
      var avg = staff.length ? Math.round((open.length - unassigned.length) / staff.length * 10) / 10 : 0;

      ctx.actions.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="wlCsv">CSV 내려받기</button>';

      root.innerHTML =
        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + open.length + '</strong><span>진행 중 전체</span></div>' +
          '<div class="adm-stat"><strong>' + staff.length + '</strong><span>직원 수</span></div>' +
          '<div class="adm-stat"><strong>' + avg + '</strong><span>1인 평균 (건)</span></div>' +
          '<div class="adm-stat' + (unassigned.length ? ' is-alert' : '') + '"><strong>' + unassigned.length +
            '</strong><span>미배정</span>' + (unassigned.length ? '<small>배정이 필요합니다</small>' : '') + '</div>' +
        '</div>' +

        (unassigned.length
          ? '<div class="guide-box"><strong>담당자가 정해지지 않은 건이 ' + unassigned.length + '건 있습니다.</strong> ' +
            '<button type="button" class="link-btn" data-view="requests">지원 신청에서 배정하기</button></div>'
          : '') +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th style="width:160px">직원</th><th>업무량 (진행 중)</th>' +
          '<th class="num" style="width:90px">진행 중</th><th class="num" style="width:90px">마감 지남</th>' +
          '<th class="num" style="width:100px">3일 이내</th><th class="num" style="width:100px">마감 미설정</th>' +
          '<th class="num" style="width:80px">완료</th>' +
        '</tr></thead><tbody>' +
        (stats.length
          ? stats.map(function (s) {
              var pct = Math.round((s.open / maxOpen) * 100);
              return '<tr>' +
                '<td class="strong">' + h(s.user.name || s.user.email) +
                  '<span class="sub">' + h(db.roleLabel(s.user.role)) + '</span></td>' +
                '<td><div class="wl-bar"><div class="wl-fill' + (s.late ? ' is-late' : '') +
                  '" style="width:' + pct + '%"></div></div></td>' +
                '<td class="num strong">' + s.open + '</td>' +
                '<td class="num"' + (s.late ? ' style="color:#B3261E;font-weight:700"' : '') + '>' + s.late + '</td>' +
                '<td class="num">' + s.soon + '</td>' +
                '<td class="num">' + s.noDue + '</td>' +
                '<td class="num">' + s.done + '</td></tr>';
            }).join('')
          : A.emptyRow(7, '승인된 직원이 없습니다', '관리자 목록에서 직원을 승인하면 여기에 표시됩니다.')) +
        '</tbody></table></div>' +

        '<p class="adm-note">진행 중 = 접수 · 상담중 · 견적 발송 · 진행중 · 보류. 완료와 취소는 제외합니다.</p>';

      ctx.actions.querySelector('#wlCsv').addEventListener('click', function () {
        A.downloadCsv('caps-직원별업무량.csv',
          ['직원', '직분', '진행중', '마감지남', '3일이내', '마감미설정', '완료', '전체'],
          stats.map(function (s) {
            return [s.user.name || s.user.email, db.roleLabel(s.user.role),
              s.open, s.late, s.soon, s.noDue, s.done, s.total];
          }));
      });
    },
  });
})();
