/* 보안 규칙 — 전체를 한 번에 복사해서 백엔드 콘솔에 붙여넣습니다.
 *
 *   · Supabase SQL   (supabase.sql)    — 지금 쓰는 백엔드. 표 · 접근 규칙(RLS) ·
 *                                        저장소 버킷 · 가입 트리거가 한 파일에 들어 있습니다.
 *   · Firestore 규칙 (firestore.rules) — 옛 백엔드(Firebase)를 쓰실 때만
 *   · Storage 규칙   (storage.rules)   — 〃
 *
 * 원본은 저장소의 파일들이고, build.js 가 그 내용을
 * assets/js/rules-text.js 로 내보냅니다. 따라서 이 화면에는 항상 최신 내용이 표시됩니다.
 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var h = A.h;

  var PROJECT_ID = (window.FIREBASE_CONFIG || {}).projectId || '';

  function consoleUrl(part) {
    return PROJECT_ID
      ? 'https://console.firebase.google.com/project/' + PROJECT_ID + '/' + part
      : 'https://console.firebase.google.com';
  }

  var PROJECT_REF = (function () {
    var u = (window.SUPABASE_CONFIG || {}).url || '';
    var m = u.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
    return m ? m[1] : '';
  })();

  var KINDS = {
    supabase: {
      label: 'Supabase SQL',
      file: 'supabase.sql',
      what: '표 · <strong>접근 규칙(RLS)</strong> · 저장소 버킷 · 가입 트리거가 모두 들어 있습니다. ' +
        '<strong>새 프로젝트에 한 번만</strong> 실행하면 됩니다 — 이미 만들어 두신 프로젝트에 ' +
        '다시 실행하면 "이미 있다" 는 오류가 납니다 (그건 정상입니다).',
      where: 'SQL Editor → New query',
      url: PROJECT_REF
        ? 'https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new'
        : 'https://supabase.com/dashboard',
      linkLabel: 'Supabase SQL Editor 열기',
      text: function () { return window.CAPS_SUPABASE_SQL || ''; },
      version: function () { return window.CAPS_SUPABASE_SQL_VERSION || '(미표기)'; },
      steps: [
        '<strong>[전체 복사]</strong> 를 누릅니다.',
        '<strong>[Supabase SQL Editor 열기]</strong> 로 대시보드를 새 창에 엽니다.',
        '편집창에 <code>Ctrl+V</code> 로 붙여넣고 <strong>[Run]</strong> 을 누릅니다.',
        '"Success. No rows returned" 이 나오면 끝입니다.',
        '가입한 뒤 첫 최고관리자를 지정하세요 — 아래 한 줄을 SQL Editor 에 실행합니다.',
      ],
    },
    firestore: {
      label: 'Firestore 규칙',
      file: 'firestore.rules',
      what: '신청서 · 고객 · 구독 · 매물 글 같은 <strong>데이터</strong>를 지킵니다.',
      where: 'Firestore Database → [규칙] 탭',
      url: consoleUrl('firestore/rules'),
      text: function () { return window.CAPS_FIRESTORE_RULES || ''; },
      version: function () { return window.CAPS_FIRESTORE_RULES_VERSION || '(미표기)'; },
    },
    storage: {
      label: 'Storage 규칙',
      file: 'storage.rules',
      what: '매물 게시판에 올라온 <strong>권리 증빙 서류 파일</strong>을 지킵니다. ' +
        '계약서에는 이름 · 주소 · 금액이 들어 있어, 올린 본인과 승인된 직원만 열 수 있게 막아 둔 규칙입니다.',
      where: 'Storage → [Rules] 탭',
      url: consoleUrl('storage/rules'),
      text: function () { return window.CAPS_STORAGE_RULES || ''; },
      version: function () { return window.CAPS_STORAGE_RULES_VERSION || '(미표기)'; },
    },
  };

  var which = 'supabase';

  A.register('rules', {
    title: '보안 규칙',
    nav: '보안 규칙',
    desc: '백엔드 콘솔에 붙여넣을 내용 전체입니다. 아래 버튼으로 한 번에 복사하세요.',
    icon: 'rules',
    perm: 'settings',
    live: false, // 데이터가 바뀔 때마다 다시 그리지 않습니다 (복사 중 화면이 튀지 않도록)

    render: function (root) {
      var kind = KINDS[which];
      var text = kind.text();

      var tabs = Object.keys(KINDS).map(function (key) {
        return '<button type="button" class="adm-tab' + (key === which ? ' is-on' : '') +
          '" data-kind="' + key + '">' + h(KINDS[key].label) + '</button>';
      }).join('');

      var head = '<div class="adm-tabs">' + tabs + '</div>';

      if (!text) {
        root.innerHTML = head +
          '<div class="adm-card"><h2>내용을 불러올 수 없습니다</h2>' +
          '<p class="adm-card-lead"><code>' + h(kind.file) + '</code> 의 내용이 비어 있습니다. ' +
          '저장소에서 <code>npm run build</code> 를 실행하면 <code>assets/js/rules-text.js</code> 로 생성됩니다.</p></div>';
        bindTabs(root);
        return;
      }

      root.innerHTML = head +
        '<div class="adm-card">' +
          '<h2>' + h(kind.label) + ' 붙여넣는 순서</h2>' +
          '<p class="adm-card-lead">' + kind.what +
            (which === 'supabase' ? ''
              : ' 규칙은 <strong>일부만 고치는 것이 아니라 전체를 덮어쓰는</strong> 방식입니다.') + '</p>' +
          '<ol class="rules-steps">' +
            (kind.steps || [
              '<strong>[규칙 전체 복사]</strong> 를 누릅니다.',
              '<strong>[' + h(kind.linkLabel || 'Firebase 규칙 화면 열기') + ']</strong> 로 콘솔을 새 창에 엽니다. (' + h(kind.where) + ')',
              '편집창을 클릭하고 <code>Ctrl+A</code> → <code>Delete</code> 로 <strong>기존 내용을 모두 지웁니다.</strong>',
              '<code>Ctrl+V</code> 로 붙여넣고 <strong>[게시]</strong> 를 누릅니다.',
              '"규칙이 게시되었습니다" 가 나오면 끝입니다. 반영에 1분쯤 걸릴 수 있습니다.',
            ]).map(function (t) { return '<li>' + t + '</li>'; }).join('') +
          '</ol>' +
          (which === 'supabase'
            ? '<div class="guide-box" style="margin-bottom:18px"><strong>첫 최고관리자 지정</strong><br>' +
              '가입을 마친 뒤 SQL Editor 에서 아래 한 줄을 실행하세요 (이메일만 바꿔서).' +
              '<textarea class="rules-text is-short" id="ownerSql" readonly spellcheck="false">' +
              "update public.users set role = 'owner', approved = true\nwhere email = '본인이메일@example.com';" +
              '</textarea></div>'
            : '') +

          '<div class="rules-actions">' +
            '<button type="button" class="btn btn-primary" id="rulesCopy">전체 복사</button>' +
            '<a class="btn btn-outline" href="' + kind.url + '" target="_blank" rel="noopener">' +
              h(kind.linkLabel || 'Firebase 규칙 화면 열기') + '</a>' +
            '<button type="button" class="btn btn-outline" id="rulesDownload">파일로 내려받기</button>' +
          '</div>' +

          '<dl class="dl-flat" style="margin-top:22px">' +
            '<div><dt>규칙 판</dt><dd>' + h(kind.version()) + '</dd></div>' +
            '<div><dt>원본 파일</dt><dd><code>' + h(kind.file) + '</code></dd></div>' +
            '<div><dt>줄 수</dt><dd>' + text.split('\n').length + '줄 · ' + text.length + '자</dd></div>' +
            '<div><dt>대상 프로젝트</dt><dd>' +
              h(which === 'supabase' ? (PROJECT_REF || '(설정 없음)') : (PROJECT_ID || '(설정 없음)')) +
            '</dd></div>' +
          '</dl>' +
        '</div>' +

        '<div class="adm-card">' +
          '<div class="adm-card-head">' +
            '<h2>' + h(kind.file) + ' 전체</h2>' +
            '<button type="button" class="btn btn-outline btn-sm" id="rulesCopy2">전체 복사</button>' +
          '</div>' +
          '<textarea class="rules-text" id="rulesBox" readonly spellcheck="false" ' +
            'aria-label="' + h(kind.label) + ' 전체">' + h(text) + '</textarea>' +
          '<p class="field-hint">복사가 안 되면 이 칸을 클릭하고 <code>Ctrl+A</code> → <code>Ctrl+C</code> 로 직접 복사하세요.</p>' +
        '</div>' +

        '<div class="adm-card">' +
          '<h2>규칙을 다시 게시해야 하는 때</h2>' +
          '<ul class="rules-when">' +
            '<li>저장소를 새로 배포한 뒤 <strong>규칙 판 번호가 달라졌을 때</strong></li>' +
            '<li>화면에서 <code>Missing or insufficient permissions</code> 오류가 날 때</li>' +
            '<li>직원이 자기 작업을 저장하지 못할 때</li>' +
            '<li>고객 목록·정산 화면이 비어 보일 때</li>' +
            '<li>매물 증빙 서류가 열리지 않거나 등록자가 파일을 올리지 못할 때 (저장소 버킷 정책)</li>' +
            '<li>Supabase 는 <strong>새 프로젝트를 만들 때 한 번만</strong> 실행하면 됩니다 — ' +
              '규칙을 고쳤을 때는 바뀐 부분만 따로 실행하세요</li>' +
          '</ul>' +
          '<div class="guide-box" style="margin-top:18px"><strong>규칙 내용을 바꾸고 싶으시면</strong><br>' +
            '이 화면에서는 수정할 수 없습니다. 저장소의 <code>' + h(kind.file) + '</code> 를 고치고 ' +
            '<code>npm run build</code> 를 실행하면 이 화면에도 반영됩니다. ' +
            '(잘못 고치면 사이트 전체가 막힐 수 있어 읽기 전용으로 두었습니다.)</div>' +
        '</div>';

      bindTabs(root);

      function copyAll(btn) {
        var original = btn.textContent;
        var write = navigator.clipboard
          ? navigator.clipboard.writeText(text)
          : Promise.reject();

        write.then(function () {
          btn.textContent = '복사됨 ✓';
          A.toast('규칙 전체를 복사했습니다. 콘솔 편집창에 붙여넣으세요.', 'ok');
          window.setTimeout(function () { btn.textContent = original; }, 2200);
        }).catch(function () {
          // 클립보드 권한이 없을 때는 직접 선택하도록 돕습니다.
          var box = document.getElementById('rulesBox');
          box.focus();
          box.select();
          A.toast('Ctrl+C 를 눌러 복사해 주세요.', 'err');
        });
      }

      root.querySelector('#rulesCopy').addEventListener('click', function () { copyAll(this); });
      root.querySelector('#rulesCopy2').addEventListener('click', function () { copyAll(this); });

      root.querySelector('#rulesDownload').addEventListener('click', function () {
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = kind.file;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        A.toast(kind.file + ' 파일을 내려받았습니다.', 'ok');
      });
    },
  });

  function bindTabs(root) {
    var box = root.querySelector('.adm-tabs');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-kind]');
      if (!btn || btn.dataset.kind === which) return;
      which = btn.dataset.kind;
      A.rerender();
    });
  }
})();
