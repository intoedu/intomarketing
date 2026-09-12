/* 지원 항목 관리 — 공개 페이지에 나가는 내용을 직접 수정합니다.
 *
 * 저장하면 serviceContent 컬렉션에 항목별 문서로 들어가고,
 * 공개 페이지는 assets/js/live-content.js 가 그 내용을 반영합니다.
 * 수정하지 않은 항목은 기본 내용(정적 HTML)이 그대로 나갑니다.
 */
(function () {
  'use strict';

  var A = window.CAPSAdmin;
  var db = A.db;
  var h = A.h;

  /** 편집 대상 필드 */
  var TEXT_FIELDS = [
    { key: 'name', label: '항목 이름', hint: '메뉴와 카드에 표시되는 이름입니다.' },
    { key: 'tagline', label: '한 줄 소개', hint: '이름 바로 아래 골드색으로 나오는 문구입니다.' },
    { key: 'summary', label: '요약 설명', type: 'textarea', hint: '카드와 상세 페이지 상단에 나옵니다. 2~3문장이 적당합니다.' },
    { key: 'duration', label: '소요 기간', hint: '예: 약 4~8주 (자료 준비 상황에 따라 조정)' },
    { key: 'priceNote', label: '비용 안내', type: 'textarea', hint: '금액을 적지 않으실 경우 산정 방식만 안내하세요.' },
    {
      key: 'externalApply', label: '외부 접수 주소',
      hint: '이 항목의 신청을 다른 사이트에서 받을 때 주소를 넣으세요. ' +
        '비워두면 우리교회지원센터 신청서로 접수합니다. (예: 홈페이지·디자인은 @IM 접수 페이지)',
    },
    {
      key: 'externalApplyLabel', label: '외부 접수 사이트 이름',
      hint: '버튼에 "○○에서 신청하기" 로 표시됩니다. 예: @IM',
    },
  ];

  function defaults(id) {
    var list = window.CAPS_SERVICES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function overrideOf(state, id) {
    var hit = state.serviceContent.filter(function (r) { return r.id === id; });
    return hit.length ? hit[0] : null;
  }

  /** 기본값과 저장된 수정본을 합친 현재 내용 */
  function merged(state, id) {
    var base = defaults(id) || {};
    var over = overrideOf(state, id) || {};
    var out = {};
    TEXT_FIELDS.forEach(function (f) {
      // 외부 접수 주소는 '빈 값으로 저장' 자체가 의미(내부 접수 전환)를 가집니다.
      if (f.key === 'externalApply' || f.key === 'externalApplyLabel') {
        out[f.key] = over[f.key] != null ? over[f.key] : (base[f.key] || '');
        return;
      }
      out[f.key] = over[f.key] != null && over[f.key] !== '' ? over[f.key] : (base[f.key] || '');
    });
    out.features = over.features || (base.features || []);
    out.deliverables = over.deliverables || (base.deliverables || []);
    out.faqs = over.faqs || (base.faqs || []);
    out.published = over.published !== false;
    return out;
  }

  function isEdited(state, id) {
    return !!overrideOf(state, id);
  }

  /* ---------------- 편집 화면 ---------------- */

  function pairRows(kind, items, aLabel, bLabel) {
    if (!items.length) {
      return '<p class="field-hint" data-empty="' + kind + '">항목이 없습니다. 아래 버튼으로 추가하세요.</p>';
    }
    return items.map(function (it, i) {
      var a = kind === 'faqs' ? it.q : it.title;
      var b = kind === 'faqs' ? it.a : it.desc;
      return '<div class="rep-item" data-kind="' + kind + '" data-i="' + i + '">' +
        '<input type="text" data-part="a" value="' + h(a || '') + '" placeholder="' + h(aLabel) + '">' +
        '<textarea data-part="b" rows="2" placeholder="' + h(bLabel) + '">' + h(b || '') + '</textarea>' +
        '<button type="button" class="icon-btn is-danger" data-del="' + kind + ':' + i + '" aria-label="삭제">×</button>' +
        '</div>';
    }).join('');
  }

  function lineRows(items) {
    if (!items.length) {
      return '<p class="field-hint" data-empty="deliverables">항목이 없습니다. 아래 버튼으로 추가하세요.</p>';
    }
    return items.map(function (it, i) {
      return '<div class="rep-item is-single" data-kind="deliverables" data-i="' + i + '">' +
        '<input type="text" data-part="a" value="' + h(it) + '" placeholder="제공 내역">' +
        '<button type="button" class="icon-btn is-danger" data-del="deliverables:' + i + '" aria-label="삭제">×</button>' +
        '</div>';
    }).join('');
  }

  function openEditor(id, state) {
    var base = defaults(id);
    if (!base) return;
    var data = merged(state, id);
    var edited = isEdited(state, id);

    A.openDrawer({
      title: base.name + ' 수정',
      sub: '지원 항목 ' + base.no + ' · 저장하면 공개 페이지에 바로 반영됩니다.',
      body:
        (data.externalApply
          ? '<div class="guide-box" style="margin-bottom:16px"><strong>외부 접수 항목입니다.</strong><br>' +
            '신청 버튼이 <code>' + h(data.externalApply) + '</code> 로 연결되며, ' +
            '우리교회지원센터 신청서에서는 체크박스가 아닌 링크로 표시됩니다.</div>'
          : '') +
        (edited
          ? '<div class="guide-box" style="margin-bottom:20px"><strong>수정된 항목입니다.</strong> ' +
            '기본 내용으로 되돌리려면 아래 [기본값으로 되돌리기] 를 누르세요.</div>'
          : '') +

        '<div class="drawer-section"><h3>공개 여부</h3>' +
          '<label class="switch"><input type="checkbox" id="svPublished"' + (data.published ? ' checked' : '') + '>' +
          '<span class="switch-track"></span><span id="svPubLabel">' +
          (data.published ? '공개 중' : '숨김 (목록과 상세 페이지에서 안내문으로 대체)') + '</span></label>' +
          '<p class="field-hint">잠시 접수를 받지 않는 항목은 숨김으로 두세요. 페이지 자체는 남고 신청 버튼이 막힙니다.</p>' +
        '</div>' +

        '<div class="drawer-section"><h3>기본 정보</h3>' +
          TEXT_FIELDS.map(function (f) {
            return '<div class="field"><label for="sv_' + f.key + '">' + h(f.label) + '</label>' +
              (f.type === 'textarea'
                ? '<textarea id="sv_' + f.key + '" data-field="' + f.key + '" rows="3">' + h(data[f.key]) + '</textarea>'
                : '<input type="text" id="sv_' + f.key + '" data-field="' + f.key + '" value="' + h(data[f.key]) + '">') +
              '<p class="field-hint">' + h(f.hint) + '</p></div>';
          }).join('') +
        '</div>' +

        '<div class="drawer-section"><h3>지원 내용 (' + data.features.length + ')</h3>' +
          '<div class="rep-list" id="svFeatures">' + pairRows('features', data.features, '제목', '설명') + '</div>' +
          '<button type="button" class="btn btn-outline btn-sm" data-add="features" style="margin-top:10px">지원 내용 추가</button>' +
        '</div>' +

        '<div class="drawer-section"><h3>제공 내역 (' + data.deliverables.length + ')</h3>' +
          '<div class="rep-list" id="svDeliverables">' + lineRows(data.deliverables) + '</div>' +
          '<button type="button" class="btn btn-outline btn-sm" data-add="deliverables" style="margin-top:10px">제공 내역 추가</button>' +
        '</div>' +

        '<div class="drawer-section"><h3>자주 묻는 질문 (' + data.faqs.length + ')</h3>' +
          '<div class="rep-list" id="svFaqs">' + pairRows('faqs', data.faqs, '질문', '답변') + '</div>' +
          '<button type="button" class="btn btn-outline btn-sm" data-add="faqs" style="margin-top:10px">질문 추가</button>' +
        '</div>' +

        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">' +
          '<button type="button" class="btn btn-primary" id="svSave">저장하고 공개</button>' +
          '<a class="btn btn-outline" href="services/' + h(base.slug) + '.html" target="_blank" rel="noopener">페이지 미리보기</a>' +
          (edited ? '<button type="button" class="btn btn-outline" id="svReset" style="margin-left:auto">기본값으로 되돌리기</button>' : '') +
        '</div>',

      onMount: function (body) {
        var work = {
          features: data.features.map(function (f) { return { title: f.title, desc: f.desc }; }),
          deliverables: data.deliverables.slice(),
          faqs: data.faqs.map(function (f) { return { q: f.q, a: f.a }; }),
        };

        function redraw(kind) {
          var host = body.querySelector(kind === 'features' ? '#svFeatures'
            : kind === 'faqs' ? '#svFaqs' : '#svDeliverables');
          host.innerHTML = kind === 'deliverables'
            ? lineRows(work.deliverables)
            : pairRows(kind, work[kind], kind === 'faqs' ? '질문' : '제목', kind === 'faqs' ? '답변' : '설명');
        }

        /* 입력 내용을 즉시 work 에 반영 */
        body.addEventListener('input', function (e) {
          var item = e.target.closest('[data-kind]');
          if (!item) return;
          var kind = item.dataset.kind;
          var i = Number(item.dataset.i);
          var part = e.target.dataset.part;
          if (kind === 'deliverables') {
            work.deliverables[i] = e.target.value;
          } else if (kind === 'faqs') {
            work.faqs[i][part === 'a' ? 'q' : 'a'] = e.target.value;
          } else {
            work.features[i][part === 'a' ? 'title' : 'desc'] = e.target.value;
          }
        });

        body.addEventListener('click', function (e) {
          var add = e.target.closest('[data-add]');
          if (add) {
            var kind = add.dataset.add;
            if (kind === 'deliverables') work.deliverables.push('');
            else if (kind === 'faqs') work.faqs.push({ q: '', a: '' });
            else work.features.push({ title: '', desc: '' });
            redraw(kind);
            var inputs = body.querySelectorAll('[data-kind="' + kind + '"] input');
            if (inputs.length) inputs[inputs.length - 1].focus();
            return;
          }
          var del = e.target.closest('[data-del]');
          if (del) {
            var parts = del.dataset.del.split(':');
            work[parts[0]].splice(Number(parts[1]), 1);
            redraw(parts[0]);
          }
        });

        var pub = body.querySelector('#svPublished');
        pub.addEventListener('change', function () {
          body.querySelector('#svPubLabel').textContent =
            pub.checked ? '공개 중' : '숨김 (목록과 상세 페이지에서 안내문으로 대체)';
        });

        body.querySelector('#svSave').addEventListener('click', function () {
          var doc = { published: pub.checked, updatedAt: new Date().toISOString() };
          TEXT_FIELDS.forEach(function (f) {
            doc[f.key] = body.querySelector('[data-field="' + f.key + '"]').value.trim();
          });
          doc.features = work.features.filter(function (f) { return (f.title || '').trim(); });
          doc.deliverables = work.deliverables.map(function (d) { return String(d).trim(); }).filter(Boolean);
          doc.faqs = work.faqs.filter(function (f) { return (f.q || '').trim(); });

          if (!doc.name) { A.toast('항목 이름은 비워둘 수 없습니다.', 'err'); return; }

          db.set('serviceContent', id, doc).then(function () {
            A.toast('저장했습니다. 공개 페이지에 반영됩니다.', 'ok');
            A.closeDrawer();
          }).catch(function (err) { A.toast(err.message || '저장에 실패했습니다.', 'err'); });
        });

        var reset = body.querySelector('#svReset');
        if (reset) {
          reset.addEventListener('click', function () {
            if (!window.confirm('수정한 내용을 지우고 기본 내용으로 되돌릴까요?')) return;
            db.remove('serviceContent', id).then(function () {
              A.toast('기본 내용으로 되돌렸습니다.');
              A.closeDrawer();
            });
          });
        }
      },
    });
  }

  /* ---------------- 목록 ---------------- */

  A.register('services', {
    title: '지원 항목 관리',
    nav: '지원 항목',
    desc: '공개 페이지에 나가는 항목 설명, 지원 내용, FAQ, 비용 안내를 직접 수정합니다.',
    icon: 'services',
    perm: 'services',

    render: function (root, state) {
      var list = window.CAPS_SERVICES || [];
      var editedCount = list.filter(function (s) { return isEdited(state, s.id); }).length;
      var hiddenCount = list.filter(function (s) {
        var o = overrideOf(state, s.id);
        return o && o.published === false;
      }).length;

      root.innerHTML =
        '<div class="guide-box">' +
          '<strong>여기서 수정한 내용은 홈페이지에 바로 반영됩니다.</strong>' +
          '<ul>' +
            '<li>수정하지 않은 항목은 기본 내용이 그대로 나갑니다.</li>' +
            '<li><code>공개 여부</code>를 끄면 신청 버튼이 막히고 안내문으로 대체됩니다. 페이지 주소는 그대로 남습니다.</li>' +
            '<li>항목을 새로 추가하거나 순서를 바꾸는 것은 <code>src/data/site.js</code> 를 고친 뒤 다시 빌드해야 합니다.</li>' +
          '</ul>' +
        '</div>' +

        '<div class="adm-stats">' +
          '<div class="adm-stat"><strong>' + list.length + '</strong><span>전체 항목</span></div>' +
          '<div class="adm-stat"><strong>' + (list.length - hiddenCount) + '</strong><span>공개 중</span></div>' +
          '<div class="adm-stat"><strong>' + hiddenCount + '</strong><span>숨김</span></div>' +
          '<div class="adm-stat"><strong>' + editedCount + '</strong><span>수정된 항목</span></div>' +
        '</div>' +

        '<div class="svc-editor-list">' +
        list.map(function (s) {
          var cur = merged(state, s.id);
          var off = !cur.published;
          return '<div class="svc-row' + (off ? ' is-off' : '') + '">' +
            '<span class="svc-row-no">' + h(s.no) + '</span>' +
            '<div class="svc-row-main">' +
              '<strong>' + h(cur.name) + '</strong>' +
              (isEdited(state, s.id) ? ' <span class="svc-row-edited">수정됨</span>' : '') +
              '<small>' + h(cur.tagline) + '</small>' +
            '</div>' +
            (cur.externalApply
              ? '<span class="chip is-gold">' + h(cur.externalApplyLabel || '외부') + ' 접수</span>'
              : '') +
            '<span class="st ' + (off ? 'st-hold' : 'st-active') + '">' + (off ? '숨김' : '공개') + '</span>' +
            '<button type="button" class="btn btn-outline btn-sm" data-edit="' + h(s.id) + '">수정</button>' +
            '</div>';
        }).join('') +
        '</div>';

      root.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-edit]');
        if (btn) openEditor(btn.dataset.edit, state);
      });
    },
  });
})();
