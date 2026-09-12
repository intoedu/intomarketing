/* 관리자 목록 — 직원 승인, 직분(역할)·권한 관리 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var tab = null;      // 아직 사용자가 탭을 고르지 않은 상태
  var tabTouched = false;
  var outsideBound = false;

  function isStaffAccount(u) { return u.role !== 'client'; }

  function permCells(u, me) {
    var isOwnerRole = u.role === 'owner';
    var lockSelf = u.id === me.id; // 자기 권한은 스스로 낮추지 못하게 막습니다.
    return Object.keys(db.PERMS).map(function (key) {
      var on = isOwnerRole || !!(u.perms && u.perms[key]);
      var locked = isOwnerRole || lockSelf;
      return '<label class="perm-check' + (locked ? ' is-locked' : '') + '">' +
        '<input type="checkbox" data-perm="' + h(u.id) + ':' + key + '"' +
        (on ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
        '<span>' + h(db.PERMS[key]) + '</span></label>';
    }).join('');
  }

  /** 행 오른쪽의 (⋯) 메뉴 */
  function rowMenu(u, me) {
    if (u.id === me.id) return '<span style="font-size:13px;color:var(--muted)">-</span>';
    return '<div class="row-menu">' +
      '<button type="button" class="icon-btn" data-menu="' + h(u.id) + '" aria-label="관리 메뉴" ' +
        'aria-expanded="false">⋯</button>' +
      '<div class="row-menu-list" hidden>' +
        '<button type="button" class="row-menu-item" data-make-staff="' + h(u.id) + '">직원으로 전환</button>' +
        '<button type="button" class="row-menu-item is-danger" data-delete="' + h(u.id) + '">계정 정보 삭제</button>' +
      '</div>' +
    '</div>';
  }

  function roleSelect(u, me) {
    var lockSelf = u.id === me.id;
    return '<select class="inline-select" data-role="' + h(u.id) + '"' + (lockSelf ? ' disabled' : '') + '>' +
      ['owner', 'admin', 'staff', 'client'].map(function (r) {
        return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' +
          h(db.roleLabel(r)) + '</option>';
      }).join('') + '</select>';
  }

  A.register('members', {
    title: '관리자 목록',
    nav: '관리자 목록',
    desc: '승인 요청을 수락하고 직분 · 권한을 관리합니다.',
    icon: 'members',
    perm: 'members',
    alerts: function (state) {
      return state.users
        .filter(function (u) { return isStaffAccount(u) && !u.approved; })
        .map(function (u) { return u.id; });
    },

    render: function (root, state, ctx) {
      var me = db.auth.current();
      var pending = state.users.filter(function (u) { return isStaffAccount(u) && !u.approved; });
      var approved = state.users.filter(function (u) { return isStaffAccount(u) && u.approved; });
      var clients = state.users.filter(function (u) { return !isStaffAccount(u); });

      // 처리해야 할 승인 요청이 있으면 그 탭부터 보여줍니다.
      if (!tabTouched) tab = pending.length ? 'pending' : 'approved';

      var rows = tab === 'pending' ? pending : tab === 'clients' ? clients : approved;

      ctx.actions.innerHTML = '<button type="button" class="btn btn-outline btn-sm" id="mCsv">CSV 내려받기</button>';

      var guide =
        '<div class="guide-box">' +
          '<strong>권한은 이렇게 정해집니다.</strong>' +
          '<ul>' +
            '<li>직분을 <code>최고관리자</code> 로 바꾸면 체크 없이도 전부 열립니다.</li>' +
            '<li><code>관리자</code> · <code>직원</code> 은 체크한 권한만 사용할 수 있습니다.</li>' +
            '<li><code>고객</code> 으로 바꾸면 관리자 화면에 들어올 수 없습니다.</li>' +
            '<li>본인 계정의 직분과 권한은 스스로 바꿀 수 없습니다. 다른 최고관리자에게 요청하세요.</li>' +
          '</ul>' +
        '</div>';

      root.innerHTML =
        '<div class="tabs">' +
          '<button type="button" data-tab="pending"' + (tab === 'pending' ? ' class="is-on"' : '') + '>' +
            '승인 대기 (' + pending.length + ')</button>' +
          '<button type="button" data-tab="approved"' + (tab === 'approved' ? ' class="is-on"' : '') + '>' +
            '승인된 직원 (' + approved.length + ')</button>' +
          '<button type="button" data-tab="clients"' + (tab === 'clients' ? ' class="is-on"' : '') + '>' +
            '고객 계정 (' + clients.length + ')</button>' +
        '</div>' +

        (tab === 'clients'
          ? '<div class="guide-box"><strong>고객 계정 관리</strong>' +
            '<ul>' +
              '<li>교회명 · 직분 · 연락처는 회원가입 때 받은 값입니다.</li>' +
              '<li>오른쪽 <code>⋯</code> 에서 <strong>직원으로 전환</strong>하거나 <strong>계정 정보를 삭제</strong>할 수 있습니다.</li>' +
              '<li>계정 정보를 삭제해도 로그인 계정은 남습니다. 완전히 지우려면 Firebase 콘솔 ' +
                '[Authentication → Users] 에서도 삭제해 주세요.</li>' +
            '</ul></div>'
          : guide) +

        '<div class="adm-tablewrap"><table class="adm-t"><thead><tr>' +
          '<th style="width:50px">#</th><th style="width:120px">이름</th><th>이메일</th>' +
          '<th style="width:130px">연락처</th>' +
          (tab === 'clients'
            ? '<th style="width:150px">교회</th><th style="width:110px">직분</th>' +
              '<th style="width:110px">생년월일</th><th style="width:100px">가입일</th>' +
              '<th style="width:60px">관리</th>'
            : '<th>직분 · 권한</th><th style="width:120px">관리</th>') +
        '</tr></thead><tbody id="memRows">' +
        (rows.length
          ? rows.map(function (u, i) {
              if (tab === 'clients') {
                return '<tr><td>' + (i + 1) + '</td>' +
                  '<td class="strong">' + h(u.name || '-') + '</td>' +
                  '<td>' + h(u.email) + '</td>' +
                  '<td class="nowrap">' + h(u.phone ? db.formatPhone(u.phone) : '-') + '</td>' +
                  '<td>' + (u.church
                    ? h(u.church)
                    : '<span style="color:var(--muted)">미입력</span>') + '</td>' +
                  '<td>' + h(u.contactRole || '-') + '</td>' +
                  '<td class="nowrap">' + h(u.birthDate || '-') + '</td>' +
                  '<td class="nowrap">' + h(db.formatDate(u.createdAt, false)) + '</td>' +
                  '<td>' + rowMenu(u, me) + '</td></tr>';
              }
              return '<tr><td>' + (i + 1) + '</td>' +
                '<td class="strong">' + h(u.name || '-') +
                  (u.id === me.id ? '<span class="sub">본인</span>' : '') + '</td>' +
                '<td>' + h(u.email) + '</td>' +
                '<td class="nowrap">' + h(u.phone ? db.formatPhone(u.phone) : '-') + '</td>' +
                '<td>' +
                  '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
                    '<span class="st ' + (u.role === 'owner' ? 'st-done' : 'st-received') + '">' +
                      h(db.roleLabel(u.role)) + '</span>' +
                    roleSelect(u, me) +
                  '</div>' +
                  '<div class="perm-grid">' + permCells(u, me) + '</div>' +
                '</td>' +
                '<td>' +
                  (u.approved
                    ? (u.id === me.id
                        ? '<span style="font-size:13px;color:var(--muted)">-</span>'
                        : '<button type="button" class="btn btn-outline btn-sm" data-revoke="' + h(u.id) + '" ' +
                          'style="color:#B3261E;border-color:#E5A9A3">권한 해제</button>')
                    : '<button type="button" class="btn btn-primary btn-sm" data-approve="' + h(u.id) + '">승인</button>' +
                      '<button type="button" class="btn btn-outline btn-sm" data-reject="' + h(u.id) + '" ' +
                      'style="margin-top:6px;color:#B3261E;border-color:#E5A9A3">거절</button>') +
                '</td></tr>';
            }).join('')
          : A.emptyRow(tab === 'clients' ? 9 : 6,
              tab === 'pending' ? '승인 대기 중인 요청이 없습니다'
                : tab === 'clients' ? '고객 계정이 없습니다' : '승인된 직원이 없습니다',
              tab === 'pending'
                ? '직원 포털(staff.html)에서 계정을 신청하면 여기에 들어옵니다.' : '')) +
        '</tbody></table></div>' +

        (db.mode === 'local'
          ? '<div class="guide-box" style="margin-top:22px"><strong>데모 모드 안내</strong><ul>' +
            '<li>지금은 브라우저 저장소를 쓰고 있어 이 기기에서만 보입니다.</li>' +
            '<li>Firebase 연결 후 처음 가입한 계정은 Firestore 콘솔에서 ' +
            '<code>role: "owner"</code>, <code>approved: true</code> 로 직접 바꿔주세요.</li>' +
            '</ul></div>'
          : '');

      /* 탭 */
      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          tab = b.dataset.tab;
          tabTouched = true;
          A.rerender();
        });
      });

      var tbody = root.querySelector('#memRows');

      /* 직분 변경 */
      tbody.addEventListener('change', function (e) {
        var roleSel = e.target.closest('[data-role]');
        if (roleSel) {
          var id = roleSel.dataset.role;
          var newRole = roleSel.value;
          var target = state.users.filter(function (u) { return u.id === id; })[0];
          if (newRole === 'client' && !window.confirm(
            (target.name || target.email) + ' 님을 고객으로 바꾸면 관리자 화면에 들어올 수 없습니다. 계속할까요?'
          )) {
            A.rerender();
            return;
          }
          db.update('users', id, { role: newRole, approved: newRole === 'client' ? true : target.approved })
            .then(function () { A.toast('직분을 변경했습니다.', 'ok'); });
          return;
        }

        var permBox = e.target.closest('[data-perm]');
        if (permBox) {
          var parts = permBox.dataset.perm.split(':');
          var user = state.users.filter(function (u) { return u.id === parts[0]; })[0];
          var perms = Object.assign({}, user.perms || {});
          perms[parts[1]] = permBox.checked;
          db.update('users', parts[0], { perms: perms }).then(function () {
            A.toast('권한을 변경했습니다.', 'ok');
          });
        }
      });

      /* 승인 / 거절 / 해제 */
      tbody.addEventListener('click', function (e) {
        var ap = e.target.closest('[data-approve]');
        if (ap) {
          db.update('users', ap.dataset.approve, { approved: true }).then(function () {
            A.toast('승인했습니다. 이제 관리자 화면을 이용할 수 있습니다.', 'ok');
          });
          return;
        }
        var rj = e.target.closest('[data-reject]');
        if (rj) {
          if (!window.confirm('이 요청을 거절할까요? 계정은 고객으로 전환됩니다.')) return;
          db.update('users', rj.dataset.reject, { role: 'client', approved: true }).then(function () {
            A.toast('거절 처리했습니다.');
          });
          return;
        }
        var rv = e.target.closest('[data-revoke]');
        if (rv) {
          var u = state.users.filter(function (x) { return x.id === rv.dataset.revoke; })[0];
          if (!window.confirm((u.name || u.email) + ' 님의 관리자 권한을 해제할까요?\n계정은 유지되고 고객으로 전환됩니다.')) return;
          db.update('users', rv.dataset.revoke, { role: 'client', approved: true, perms: {} }).then(function () {
            A.toast('권한을 해제했습니다.');
          });
        }
      });

      /* (⋯) 메뉴 열기 · 닫기 */
      tbody.addEventListener('click', function (e) {
        var toggle = e.target.closest('[data-menu]');
        // 다른 메뉴는 모두 닫습니다.
        tbody.querySelectorAll('.row-menu-list').forEach(function (list) {
          if (!toggle || list.previousElementSibling !== toggle) list.hidden = true;
        });
        tbody.querySelectorAll('[data-menu]').forEach(function (b) {
          if (b !== toggle) b.setAttribute('aria-expanded', 'false');
        });
        if (toggle) {
          var list = toggle.nextElementSibling;
          list.hidden = !list.hidden;
          toggle.setAttribute('aria-expanded', String(!list.hidden));
          return;
        }

        /* 직원으로 전환 */
        var mk = e.target.closest('[data-make-staff]');
        if (mk) {
          var target = state.users.filter(function (x) { return x.id === mk.dataset.makeStaff; })[0];
          if (!target) return;
          if (!window.confirm(
            (target.name || target.email) + ' 님을 직원으로 전환할까요?\n\n' +
            '전환 후 권한 체크박스에서 필요한 항목을 켜주세요. ' +
            '(승인된 직원 탭으로 이동합니다)'
          )) return;
          // 저장이 끝나면 곧바로 다시 그려지므로, 탭 전환은 먼저 정해 둡니다.
          tab = 'approved';
          tabTouched = true;
          db.update('users', mk.dataset.makeStaff, { role: 'staff', approved: true })
            .then(function () {
              A.toast('직원으로 전환했습니다. 권한을 지정해 주세요.', 'ok');
            })
            .catch(function (err) {
              tab = 'clients';
              A.rerender();
              A.toast(err.message || '전환에 실패했습니다.', 'err');
            });
          return;
        }

        /* 계정 정보 삭제 */
        var del = e.target.closest('[data-delete]');
        if (del) {
          var victim = state.users.filter(function (x) { return x.id === del.dataset.delete; })[0];
          if (!victim) return;
          if (!window.confirm(
            (victim.name || victim.email) + ' 님의 계정 정보를 삭제할까요?\n\n' +
            '· 이 화면과 관리자 목록에서 사라집니다.\n' +
            '· 그 분이 남긴 신청 내역은 그대로 남습니다.\n' +
            '· 로그인 계정 자체는 Firebase 콘솔 [Authentication → Users] 에서 지워야 합니다. ' +
            '지우지 않으면 다시 로그인할 때 고객으로 새로 등록됩니다.\n\n' +
            '되돌릴 수 없습니다.'
          )) return;
          db.remove('users', del.dataset.delete)
            .then(function () { A.toast('계정 정보를 삭제했습니다.'); })
            .catch(function (err) { A.toast(err.message || '삭제에 실패했습니다.', 'err'); });
        }
      });

      /* 표 밖을 누르면 메뉴 닫기 (전역 리스너는 한 번만 등록) */
      if (!outsideBound) {
        outsideBound = true;
        document.addEventListener('click', function (e) {
          if (e.target.closest('.row-menu')) return;
          document.querySelectorAll('.row-menu-list').forEach(function (l) { l.hidden = true; });
        });
      }

      ctx.actions.querySelector('#mCsv').addEventListener('click', function () {
        A.downloadCsv(
          'caps-계정목록.csv',
          ['이름', '이메일', '연락처', '교회', '교회직분', '생년월일', '직분', '승인', '권한', '가입일'],
          state.users.map(function (u) {
            return [u.name, u.email, u.phone, u.church, u.contactRole, u.birthDate,
              db.roleLabel(u.role), u.approved ? 'Y' : 'N',
              Object.keys(u.perms || {}).filter(function (k) { return u.perms[k]; })
                .map(function (k) { return db.PERMS[k]; }).join(' / '),
              db.formatDate(u.createdAt, false)];
          })
        );
      });
    },
  });
})();
