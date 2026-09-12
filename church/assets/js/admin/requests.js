/* 지원 신청 관리 — 목록, 필터, 상세 서랍(상태·담당자·메모·할 일) */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var filter = { q: '', status: '', service: '', assignee: '' };

  function staffList(state) {
    return state.users.filter(function (u) {
      return u.role !== 'client' && u.approved;
    });
  }

  function staffName(state, id) {
    if (!id) return '';
    var hit = state.users.filter(function (u) { return u.id === id; });
    return hit.length ? (hit[0].name || hit[0].email) : '(삭제된 계정)';
  }

  function ddayCell(r) {
    if (db.isClosed(r.status)) return '<span class="dd dd-done">완료</span>';
    var d = db.dday(r.dueDate);
    if (!d) return '<span class="dd dd-none">미설정</span>';
    return '<span class="dd ' + d.cls + '">' + d.label + '</span>';
  }

  function match(r, state) {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.service && (r.services || []).indexOf(filter.service) === -1) return false;
    if (filter.assignee === '__none') {
      if (r.assignee) return false;
    } else if (filter.assignee && r.assignee !== filter.assignee) return false;
    if (filter.q) {
      var hay = [r.code, r.church_name, r.contact_name, r.phone, r.location, r.memo,
        staffName(state, r.assignee)].join(' ').toLowerCase();
      if (hay.indexOf(filter.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  /* ---------------- 상세 서랍 ---------------- */

  function openDetail(id, state) {
    var r = state.requests.filter(function (x) { return x.id === id; })[0];
    if (!r) return;

    var statusBtns = Object.keys(db.REQUEST_STATUS).map(function (k) {
      return '<button type="button" data-status="' + k + '"' + (r.status === k ? ' class="is-on"' : '') + '>' +
        h(db.REQUEST_STATUS[k]) + '</button>';
    }).join('');

    var assigneeOpts = ['<option value="">담당자 미배정</option>']
      .concat(staffList(state).map(function (u) {
        return '<option value="' + h(u.id) + '"' + (r.assignee === u.id ? ' selected' : '') + '>' +
          h(u.name || u.email) + '</option>';
      })).join('');

    /* 신청서에 적힌 칸 이름(logo · bizdoc)이 아니라 교회가 본 라벨로 적습니다. */
    function fieldLabel(sid, fname) {
      var svc = (window.CAPS_SERVICES || []).filter(function (x) { return x.id === sid; })[0];
      var f = svc && (svc.extraFields || []).filter(function (x) { return x.name === fname; })[0];
      return (f && f.label) || fname;
    }

    var extraRows = Object.keys(r.extra || {}).map(function (key) {
      var parts = key.split('__');
      var val = r.extra[key];
      var body;
      if (Object.prototype.toString.call(val) === '[object Array]') {
        /* 첨부는 비공개 저장소에 있습니다 — 누를 때 10분짜리 주소를 받아 엽니다. */
        body = '<ul class="adm-files">' + val.map(function (f) {
          var kb = f.size ? ' <small>' + Math.max(1, Math.round(f.size / 1024)) + 'KB</small>' : '';
          return '<li>' + h(f.name || '파일') + kb +
            '<button type="button" data-file="' + h(f.path) + '">열기</button></li>';
        }).join('') + '</ul>';
      } else {
        body = h(val);
      }
      return '<div><dt>' + h(db.serviceName(parts[0])) +
        '<br><small style="font-weight:400">' + h(fieldLabel(parts[0], parts[1])) + '</small></dt>' +
        '<dd>' + body + '</dd></div>';
    }).join('');

    var tasks = r.tasks || [];

    A.openDrawer({
      title: r.church_name,
      sub: r.code + ' · 접수 ' + db.formatDate(r.createdAt),
      body:
        '<div class="drawer-section"><h3>상태</h3><div class="seg" id="dStatus">' + statusBtns + '</div></div>' +

        '<div class="drawer-section"><h3>마감일 (디데이)</h3>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<input type="date" id="dDue" value="' + h(r.dueDate || '') + '" ' +
            'style="padding:12px 14px;border:1.5px solid var(--line);border-radius:10px;font-size:14.5px">' +
            ddayCell(r) +
          '</div>' +
          '<p class="field-hint">담당자는 [내 작업] 화면에서도 직접 바꿀 수 있습니다.</p>' +
        '</div>' +

        '<div class="drawer-section"><h3>담당자</h3>' +
          '<select class="inline-select" id="dAssignee" style="max-width:none;width:100%;padding:12px 14px;font-size:14.5px">' +
            assigneeOpts + '</select></div>' +

        '<div class="drawer-section"><h3>신청 항목</h3><div class="chip-row">' +
          (r.services || []).map(function (sid) {
            return '<span class="chip is-gold">' + h(db.serviceName(sid)) + '</span>';
          }).join('') + '</div></div>' +

        '<div class="drawer-section"><h3>진행 메모</h3>' +
          '<textarea id="dMemo" rows="4" placeholder="진행하면서 남길 메모를 적어주세요." ' +
          'style="width:100%;padding:13px 15px;border:1.5px solid var(--line);border-radius:10px;font-size:14.5px;line-height:1.7;resize:vertical">' +
          h(r.memo || '') + '</textarea>' +
          '<p class="field-hint">메모는 자동 저장되지 않습니다. 아래 저장 버튼을 눌러주세요.</p></div>' +

        '<div class="drawer-section"><h3>할 일</h3>' +
          '<div class="task-add"><input type="text" id="dTaskInput" placeholder="할 일 입력 후 Enter">' +
            '<button type="button" class="btn btn-outline btn-sm" id="dTaskAdd">추가</button></div>' +
          '<ul class="task-list" id="dTasks">' + renderTasks(tasks) + '</ul></div>' +

        '<div class="drawer-section"><h3>신청 내용</h3><dl class="dl-flat">' +
          row('담당자', (r.contact_name || '') + (r.contact_role ? ' ' + r.contact_role : '')) +
          row('연락처', r.phone) +
          row('이메일', r.email) +
          row('교단', r.denomination) +
          row('소재지', r.location) +
          row('교인 수', r.size) +
          row('예산 범위', r.budget) +
          row('희망 시기', r.timeline) +
          row('연락 방법', r.prefer) +
          extraRows +
          row('요청 내용', r.message) +
        '</dl></div>' +

        '<div class="drawer-section"><h3>연결</h3>' +
          '<div class="seg">' +
            (r.customerId ? '<button type="button" id="dGoCustomer">고객 정보 보기</button>' : '') +
            '<button type="button" id="dMakeSub">구독으로 등록</button>' +
          '</div>' +
          '<p class="field-hint">정기 계약(주보·행정 대행 등)으로 이어지는 건은 구독으로 등록하면 정산에 자동 반영됩니다.</p>' +
        '</div>' +

        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
          '<button type="button" class="btn btn-primary" id="dSave">변경 내용 저장</button>' +
          '<button type="button" class="btn btn-outline" id="dCopy">연락처 복사</button>' +
          '<button type="button" class="btn btn-outline is-danger" id="dDelete" ' +
            'style="margin-left:auto;color:#B3261E;border-color:#E5A9A3">삭제</button>' +
        '</div>',

      onMount: function (body) {
        /* 첨부 열기 — 비공개라 잠깐 열리는 주소를 받아 새 창으로 엽니다. */
        body.addEventListener('click', function (e) {
          var b = e.target.closest('[data-file]');
          if (!b) return;
          var path = b.getAttribute('data-file');
          b.disabled = true;
          db.requestFileUrl(path).then(function (url) {
            b.disabled = false;
            if (url) window.open(url, '_blank', 'noopener');
            else A.toast('파일을 열지 못했습니다.');
          }).catch(function () {
            b.disabled = false;
            A.toast('파일을 열지 못했습니다.');
          });
        });

        var pendingStatus = r.status;
        var pendingTasks = tasks.slice();

        body.querySelector('#dStatus').addEventListener('click', function (e) {
          var b = e.target.closest('[data-status]');
          if (!b) return;
          pendingStatus = b.dataset.status;
          body.querySelectorAll('#dStatus button').forEach(function (x) {
            x.classList.toggle('is-on', x === b);
          });
        });

        function redrawTasks() {
          body.querySelector('#dTasks').innerHTML = renderTasks(pendingTasks);
        }

        function addTask() {
          var input = body.querySelector('#dTaskInput');
          var text = input.value.trim();
          if (!text) return;
          pendingTasks.push({ text: text, done: false });
          input.value = '';
          redrawTasks();
        }

        body.querySelector('#dTaskAdd').addEventListener('click', addTask);
        body.querySelector('#dTaskInput').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); addTask(); }
        });

        body.querySelector('#dTasks').addEventListener('click', function (e) {
          var del = e.target.closest('[data-task-del]');
          if (del) {
            pendingTasks.splice(Number(del.dataset.taskDel), 1);
            redrawTasks();
            return;
          }
          var box = e.target.closest('[data-task-idx]');
          if (box) {
            var i = Number(box.dataset.taskIdx);
            pendingTasks[i].done = box.checked;
            redrawTasks();
          }
        });

        body.querySelector('#dSave').addEventListener('click', function () {
          db.update('requests', r.id, {
            status: pendingStatus,
            dueDate: body.querySelector('#dDue').value,
            assignee: body.querySelector('#dAssignee').value,
            memo: body.querySelector('#dMemo').value,
            tasks: pendingTasks,
          }).then(function () {
            A.toast('저장했습니다.', 'ok');
            A.closeDrawer();
          }).catch(function (err) {
            A.toast(err.message || '저장에 실패했습니다.', 'err');
          });
        });

        body.querySelector('#dCopy').addEventListener('click', function () {
          var text = [r.church_name, r.contact_name, r.phone, r.email].filter(Boolean).join(' / ');
          var write = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
          write.then(function () { A.toast('연락처를 복사했습니다.', 'ok'); })
            .catch(function () { window.prompt('복사하세요', text); });
        });

        body.querySelector('#dDelete').addEventListener('click', function () {
          if (!window.confirm('이 신청을 삭제할까요? 되돌릴 수 없습니다.')) return;
          db.remove('requests', r.id).then(function () {
            A.toast('삭제했습니다.');
            A.closeDrawer();
          });
        });

        var goCust = body.querySelector('#dGoCustomer');
        if (goCust) {
          goCust.addEventListener('click', function () {
            A.closeDrawer();
            window.sessionStorage.setItem('caps.admin.openCustomer', r.customerId);
            A.go('customers');
          });
        }

        body.querySelector('#dMakeSub').addEventListener('click', function () {
          A.closeDrawer();
          window.sessionStorage.setItem('caps.admin.newSub', JSON.stringify({
            customerId: r.customerId || '',
            serviceId: (r.services || [])[0] || '',
          }));
          A.go('subscriptions');
        });
      },
    });
  }

  function row(dt, dd) {
    if (!dd) return '';
    return '<div><dt>' + h(dt) + '</dt><dd>' + h(dd) + '</dd></div>';
  }

  function renderTasks(tasks) {
    if (!tasks.length) return '<li style="background:none;border:none;padding:4px 0;color:var(--muted);font-size:14px">등록된 할 일이 없습니다.</li>';
    return tasks.map(function (t, i) {
      return '<li' + (t.done ? ' class="is-done"' : '') + '>' +
        '<input type="checkbox" data-task-idx="' + i + '"' + (t.done ? ' checked' : '') + ' aria-label="완료 표시">' +
        '<span>' + h(t.text) + '</span>' +
        '<button type="button" class="icon-btn is-danger" data-task-del="' + i + '" aria-label="삭제">×</button></li>';
    }).join('');
  }

  /**
   * 고객으로 연결되지 않은 신청을 정리합니다.
   * 같은 교회명이 이미 있으면 연결만, 없으면 고객을 새로 만듭니다.
   * (신청자 권한으로는 고객 목록을 볼 수 없어 관리자 화면에서 처리합니다.)
   */
  function linkAll(list, state) {
    var byName = {};
    state.customers.forEach(function (c) {
      byName[String(c.name || '').trim()] = c.id;
    });

    var count = 0;
    // 같은 교회가 여러 건 들어와도 고객이 중복 생성되지 않도록 순차 처리합니다.
    return list.reduce(function (chain, r) {
      return chain.then(function () {
        var name = String(r.church_name || '').trim();
        if (!name) return null;

        var existing = byName[name];
        if (existing) {
          count++;
          return db.update('requests', r.id, { customerId: existing });
        }
        return db.add('customers', {
          name: name,
          denomination: r.denomination || '',
          contactName: r.contact_name || '',
          contactRole: r.contact_role || '',
          phone: r.phone || '',
          email: r.email || '',
          location: r.location || '',
          size: r.size || '',
          memo: '',
          userId: r.userId || '',
        }).then(function (cust) {
          byName[name] = cust.id;
          count++;
          return db.update('requests', r.id, { customerId: cust.id });
        });
      });
    }, Promise.resolve()).then(function () { return count; });
  }

  /* ---------------- 목록 화면 ---------------- */

  /* ---------------- 화면 만들기 ----------------

     [전체] 하나와, 지원 항목마다 하나씩 만듭니다.
     항목별 화면은 그 항목이 담긴 신청만 보여 주고, 미확인 건수도 따로 셉니다.
     한 신청에 항목이 여럿이면 그 항목들 화면에 모두 나옵니다 — 한 건을
     여러 담당자가 각자 자기 자리에서 보게 하려는 것입니다. */

  function makeView(svc) {
    return {
      title: svc ? svc.name + ' 신청' : '지원 신청 전체',
      nav: svc ? svc.name + (svc.soon ? ' (준비 중)' : '') : '전체',
      /* [전체] 는 항목별 화면과 같은 건을 셉니다. 배지는 보여 주되 탭 제목
         합계와 알림에서는 빼야 한 건이 두 번 세어지지 않습니다. */
      rollup: !svc,
      alerts: function (state) {
        return state.requests.filter(function (r) {
          if (r.status !== 'received') return false;
          return !svc || (r.services || []).indexOf(svc.id) !== -1;
        }).map(function (r) { return r.id; });
      },
      desc: '신청받은 내용을 확인하고 담당자와 진행 상황을 관리합니다.',
      icon: 'requests',
      perm: 'requests',

      render: function (root, state, ctx) {
        /* 항목별 화면이면 그 항목이 담긴 신청만 봅니다. 통계와 [신청이 없습니다]
           안내도 이 범위를 따릅니다 — 화면마다 자기 숫자를 보여야 합니다. */
        var all = svc
          ? state.requests.filter(function (r) { return (r.services || []).indexOf(svc.id) !== -1; })
          : state.requests;
        var rows = all.filter(function (r) { return match(r, state); });

        var counts = { received: 0, progress: 0, done: 0 };
        all.forEach(function (r) {
          if (r.status === 'received') counts.received++;
          else if (r.status === 'done') counts.done++;
          else if (r.status !== 'canceled') counts.progress++;
        });

        ctx.actions.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="reqCsv">CSV 내려받기</button>';

        var unlinked = all.filter(function (r) { return !r.customerId; });

        root.innerHTML =
          (unlinked.length && db.can('customers') && db.can('requests')
            ? '<div class="guide-box"><strong>고객으로 연결되지 않은 신청이 ' + unlinked.length + '건 있습니다.</strong><br>' +
              '연결하면 고객 관리·구독·정산에서 같은 교회로 묶여 보입니다. ' +
              '<button type="button" class="btn btn-outline btn-sm" id="linkCustomers" ' +
              'style="margin-top:10px">고객으로 연결하기</button></div>'
            : '') +
          '<div class="adm-stats">' +
            '<div class="adm-stat"><strong>' + all.length + '</strong><span>전체</span></div>' +
            '<div class="adm-stat"><strong>' + counts.received + '</strong><span>접수 (미확인)</span></div>' +
            '<div class="adm-stat"><strong>' + counts.progress + '</strong><span>진행 중</span></div>' +
            '<div class="adm-stat"><strong>' + counts.done + '</strong><span>완료</span></div>' +
          '</div>' +

          '<div class="adm-toolbar">' +
            '<input type="search" id="fq" placeholder="교회명 · 담당자 · 접수번호 · 메모 검색" value="' + h(filter.q) + '">' +
            '<select id="fstatus"><option value="">상태 전체</option>' +
              Object.keys(db.REQUEST_STATUS).map(function (k) {
                return '<option value="' + k + '"' + (filter.status === k ? ' selected' : '') + '>' +
                  h(db.REQUEST_STATUS[k]) + '</option>';
              }).join('') +
            '</select>' +
            /* 항목별 화면에서는 감춥니다 — 이미 그 항목만 보고 있습니다. */
            (svc ? '' :
              '<select id="fservice"><option value="">항목 전체</option>' +
              (window.CAPS_SERVICES || []).map(function (x) {
                return '<option value="' + x.id + '"' + (filter.service === x.id ? ' selected' : '') + '>' +
                  h(x.name) + '</option>';
              }).join('') +
              '</select>') +
            '<select id="fassignee"><option value="">담당자 전체</option>' +
              '<option value="__none"' + (filter.assignee === '__none' ? ' selected' : '') + '>미배정</option>' +
              staffList(state).map(function (u) {
                return '<option value="' + h(u.id) + '"' + (filter.assignee === u.id ? ' selected' : '') + '>' +
                  h(u.name || u.email) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +

          '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
            '<th style="width:150px">접수번호</th><th>교회명 · 담당자</th><th>신청 항목</th>' +
            '<th style="width:130px">담당자</th><th style="width:90px">디데이</th>' +
            '<th>진행</th><th style="width:120px">상태</th><th style="width:100px">접수일</th>' +
          '</tr></thead><tbody id="reqRows">' +
          (rows.length
            ? rows.map(function (r) {
                var done = (r.tasks || []).filter(function (t) { return t.done; }).length;
                var total = (r.tasks || []).length;
                return '<tr data-id="' + h(r.id) + '" style="cursor:pointer">' +
                  '<td class="code">' + h(r.code) + '</td>' +
                  '<td class="strong">' + h(r.church_name) +
                    '<span class="sub">' + h(r.contact_name || '') + (r.phone ? ' · ' + h(r.phone) : '') + '</span></td>' +
                  '<td><div class="chip-row">' + (r.services || []).map(function (id) {
                    return '<span class="chip">' + h(db.serviceName(id)) + '</span>';
                  }).join('') + '</div></td>' +
                  '<td class="nowrap">' + (r.assignee ? h(staffName(state, r.assignee)) :
                    '<span style="color:var(--muted)">미배정</span>') + '</td>' +
                  '<td>' + ddayCell(r) + '</td>' +
                  '<td class="nowrap">' + (total ? done + ' / ' + total : '<span style="color:var(--muted)">-</span>') +
                    (r.memo ? '<span class="sub">' + h(r.memo.slice(0, 22)) + (r.memo.length > 22 ? '…' : '') + '</span>' : '') + '</td>' +
                  '<td><span class="st st-' + h(r.status) + '">' + h(db.REQUEST_STATUS[r.status] || r.status) + '</span></td>' +
                  '<td class="nowrap">' + h(db.formatDate(r.createdAt, false)) + '</td></tr>';
              }).join('')
            : A.emptyRow(8, all.length ? '조건에 맞는 신청이 없습니다' : '아직 신청이 없습니다',
                all.length ? '검색어나 필터를 바꿔보세요.' : '홈페이지에서 신청이 들어오면 여기에 표시됩니다.')) +
          '</tbody></table></div>';

        /* 이벤트 */
        var apply = function () { A.rerender(); };

        var q = root.querySelector('#fq');
        var timer = null;
        q.addEventListener('input', function () {
          filter.q = q.value;
          window.clearTimeout(timer);
          timer = window.setTimeout(function () {
            apply();
            var again = document.getElementById('fq');
            if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
          }, 260);
        });

        root.querySelector('#fstatus').addEventListener('change', function (e) { filter.status = e.target.value; apply(); });
        var fsvc = root.querySelector('#fservice');
        if (fsvc) fsvc.addEventListener('change', function (e) { filter.service = e.target.value; apply(); });
        root.querySelector('#fassignee').addEventListener('change', function (e) { filter.assignee = e.target.value; apply(); });

        var linkBtn = root.querySelector('#linkCustomers');
        if (linkBtn) {
          linkBtn.addEventListener('click', function () {
            linkBtn.disabled = true;
            linkBtn.textContent = '연결 중…';
            linkAll(unlinked, state).then(function (n) {
              A.toast(n ? n + '건을 고객으로 연결했습니다.' : '연결할 신청이 없습니다.', n ? 'ok' : 'err');
            }).catch(function (err) {
              A.toast(err.message || '연결에 실패했습니다.', 'err');
              linkBtn.disabled = false;
              linkBtn.textContent = '고객으로 연결하기';
            });
          });
        }

        root.querySelector('#reqRows').addEventListener('click', function (e) {
          var tr = e.target.closest('tr[data-id]');
          if (tr) openDetail(tr.dataset.id, state);
        });

        ctx.actions.querySelector('#reqCsv').addEventListener('click', function () {
          A.downloadCsv(
            'caps-신청목록.csv',
            ['접수번호', '접수일', '상태', '신청항목', '교회명', '교단', '담당자', '직분', '연락처', '이메일',
              '소재지', '교인수', '예산', '희망시기', '연락방법', '배정담당자', '메모', '요청내용'],
            rows.map(function (r) {
              return [r.code, db.formatDate(r.createdAt), db.REQUEST_STATUS[r.status] || r.status,
                (r.services || []).map(db.serviceName).join(' / '), r.church_name, r.denomination,
                r.contact_name, r.contact_role, r.phone, r.email, r.location, r.size,
                r.budget, r.timeline, r.prefer, staffName(state, r.assignee), r.memo, r.message];
            })
          );
        });
      },
    };
  }

  A.register('requests', makeView(null));
  (window.CAPS_SERVICES || []).forEach(function (s) {
    A.register('req-' + s.id, makeView(s));
  });
})();
