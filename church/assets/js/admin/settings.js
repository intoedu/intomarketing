/* 센터 설정 — 연락처, 안내 문구, 데이터 백업 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  var FIELDS = [
    { key: 'phone', label: '대표 전화', placeholder: '02-0000-0000' },
    { key: 'email', label: '대표 이메일', placeholder: 'help@caps.or.kr' },
    { key: 'hours', label: '운영 시간', placeholder: '평일 09:00 – 18:00' },
    { key: 'address', label: '주소', placeholder: '서울특별시 ○○구 ○○로 00, 0층' },
    { key: 'kakao', label: '카카오톡 채널', placeholder: '@caps교회지원센터' },
    { key: 'noticeBanner', label: '전체 공지 문구', type: 'textarea',
      placeholder: '비워두면 표시되지 않습니다. 예: 8월 12일~15일은 여름 휴무입니다.' },
  ];

  function current(state) {
    var hit = state.settings.filter(function (s) { return s.id === 'site'; });
    return hit.length ? hit[0] : {};
  }

  A.register('settings', {
    title: '센터 설정',
    nav: '센터 설정',
    desc: '홈페이지에 표시되는 연락처와 공지 문구를 수정하고, 데이터를 백업합니다.',
    icon: 'settings',
    perm: 'settings',

    render: function (root, state) {
      var s = current(state);
      var counts = ['requests', 'customers', 'subscriptions', 'invoices', 'users']
        .map(function (k) { return { k: k, n: (state[k] || []).length }; });

      root.innerHTML =
        '<div class="adm-card">' +
          '<h2>연락처 · 안내 문구</h2>' +
          '<p class="adm-card-lead">저장하면 홈페이지 상단 바와 푸터, 문의 페이지에 반영됩니다. ' +
            '비워두면 기본값(빌드에 포함된 값)이 표시됩니다.</p>' +
          FIELDS.map(function (f) {
            return '<div class="field"><label for="set_' + f.key + '">' + h(f.label) + '</label>' +
              (f.type === 'textarea'
                ? '<textarea id="set_' + f.key + '" data-set="' + f.key + '" rows="2" placeholder="' +
                  h(f.placeholder) + '">' + h(s[f.key] || '') + '</textarea>'
                : '<input type="text" id="set_' + f.key + '" data-set="' + f.key + '" value="' + h(s[f.key] || '') +
                  '" placeholder="' + h(f.placeholder) + '">') +
              '</div>';
          }).join('') +
          '<div class="save-bar"><p id="setStatus">' +
            (s.updatedAt ? '마지막 저장 ' + h(db.formatDate(s.updatedAt)) : '아직 저장한 적이 없습니다.') +
            '</p><button type="button" class="btn btn-primary" id="setSave">저장</button></div>' +
        '</div>' +

        '<div class="adm-card">' +
          '<h2>데이터 백업</h2>' +
          '<p class="adm-card-lead">전체 데이터를 JSON 파일로 내려받습니다. ' +
            '정기적으로 받아 두시면 사고가 있어도 복구할 수 있습니다.</p>' +
          '<div class="chip-row" style="margin-bottom:18px">' +
            counts.map(function (c) {
              var label = { requests: '신청', customers: '고객', subscriptions: '구독', invoices: '청구', users: '계정' }[c.k];
              return '<span class="chip">' + label + ' ' + c.n + '건</span>';
            }).join('') +
          '</div>' +
          '<button type="button" class="btn btn-outline" id="setBackup">전체 데이터 내려받기 (JSON)</button>' +
        '</div>' +

        '<div class="adm-card">' +
          '<h2>연결 상태</h2>' +
          '<dl class="dl-flat">' +
            '<div><dt>데이터베이스</dt><dd>' +
              (db.mode === 'firebase'
                ? 'Firebase (Firestore) 연결됨'
                : '로컬 데모 모드 — 이 브라우저에만 저장됩니다') + '</dd></div>' +
            '<div><dt>내 계정</dt><dd>' + h(db.auth.current().email) + ' · ' +
              h(db.roleLabel(db.auth.current().role)) + '</dd></div>' +
          '</dl>' +
          (db.mode === 'local'
            ? '<div class="guide-box" style="margin-top:18px"><strong>실제 운영으로 전환하려면</strong><ul>' +
              '<li><code>assets/js/firebase-config.js</code> 에 Firebase 설정값을 넣으세요.</li>' +
              '<li>보안 규칙은 <button type="button" class="link-btn" data-view="rules">[보안 규칙]</button> ' +
                '화면에서 전체를 복사해 콘솔에 붙여넣으세요.</li>' +
              '<li>전환 전에 위의 [전체 데이터 내려받기] 로 데모 데이터를 보관하실 수 있습니다.</li>' +
              '</ul></div>'
            : '<div class="guide-box" style="margin-top:18px"><strong>권한 오류가 나면</strong><br>' +
              '<button type="button" class="link-btn" data-view="rules">[보안 규칙]</button> 화면에서 ' +
              '규칙 전체를 다시 복사해 콘솔에 붙여넣고 게시해 주세요. 규칙은 부분 수정이 아니라 전체를 덮어쓰는 방식입니다.</div>') +
        '</div>';

      root.querySelector('#setSave').addEventListener('click', function () {
        var doc = { updatedAt: new Date().toISOString() };
        FIELDS.forEach(function (f) {
          doc[f.key] = root.querySelector('[data-set="' + f.key + '"]').value.trim();
        });
        db.set('settings', 'site', doc).then(function () {
          A.toast('저장했습니다. 홈페이지에 반영됩니다.', 'ok');
        }).catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
      });

      root.querySelector('#setBackup').addEventListener('click', function () {
        var dump = {};
        ['requests', 'customers', 'subscriptions', 'invoices', 'users', 'serviceContent', 'settings']
          .forEach(function (k) {
            dump[k] = (state[k] || []).map(function (row) {
              var copy = Object.assign({}, row);
              delete copy.password; // 데모 비밀번호는 백업에서 제외
              return copy;
            });
          });
        dump.exportedAt = new Date().toISOString();

        var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var d = new Date();
        var p = function (n) { return String(n).padStart(2, '0'); };
        a.href = url;
        a.download = 'caps-backup-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        A.toast('백업 파일을 내려받았습니다.', 'ok');
      });
    },
  });
})();
