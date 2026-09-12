/* 접수 현황 (데모): 검색, 필터, 상태 변경, CSV 내려받기 */
(function () {
  'use strict';

  var rowsEl = document.getElementById('adminRows');
  if (!rowsEl) return;

  var statsEl = document.getElementById('adminStats');
  var emptyEl = document.getElementById('adminEmpty');
  var searchEl = document.getElementById('adminSearch');
  var filterEl = document.getElementById('adminFilter');
  var modal = document.getElementById('detailModal');
  var modalBody = document.getElementById('modalBody');
  var modalTitle = document.getElementById('modalTitle');
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function visible() {
    var q = (searchEl.value || '').trim().toLowerCase();
    var f = filterEl.value;
    return window.CAPS.all().filter(function (r) {
      if (f && (r.services || []).indexOf(f) === -1) return false;
      if (!q) return true;
      return [r.code, r.church_name, r.contact_name, r.phone, r.location]
        .join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function renderStats(list) {
    var total = window.CAPS.all();
    var counts = { received: 0, progress: 0, done: 0 };
    total.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    statsEl.innerHTML =
      '<span class="admin-chip">전체 <strong>' + total.length + '</strong></span>' +
      '<span class="admin-chip">접수 <strong>' + counts.received + '</strong></span>' +
      '<span class="admin-chip">진행 <strong>' + counts.progress + '</strong></span>' +
      '<span class="admin-chip">완료 <strong>' + counts.done + '</strong></span>' +
      (list.length !== total.length ? '<span class="admin-chip">검색 결과 <strong>' + list.length + '</strong></span>' : '');
  }

  function render() {
    var list = visible();
    renderStats(list);

    rowsEl.innerHTML = list
      .map(function (r) {
        var tags = (r.services || [])
          .map(function (id) { return '<span class="tag">' + esc(window.CAPS.serviceName(id)) + '</span>'; })
          .join('');
        var options = Object.keys(window.CAPS.STATUS)
          .map(function (k) {
            return '<option value="' + k + '"' + (r.status === k ? ' selected' : '') + '>' +
              window.CAPS.STATUS[k].label + '</option>';
          })
          .join('');
        return (
          '<tr>' +
            '<td class="code">' + esc(r.code) + '</td>' +
            '<td>' + esc(window.CAPS.formatDate(r.createdAt)) + '</td>' +
            '<td>' + esc(r.church_name) + '</td>' +
            '<td>' + esc(r.contact_name) + (r.contact_role ? ' ' + esc(r.contact_role) : '') + '</td>' +
            '<td>' + esc(r.phone) + '</td>' +
            '<td><div class="tag-list">' + tags + '</div></td>' +
            '<td><select class="status-select" data-code="' + esc(r.code) + '" aria-label="상태 변경">' + options + '</select></td>' +
            '<td><button type="button" class="link-btn" data-detail="' + esc(r.code) + '">상세</button></td>' +
          '</tr>'
        );
      })
      .join('');

    emptyEl.hidden = list.length > 0;
    if (!window.CAPS.all().length) {
      emptyEl.innerHTML = '저장된 신청 내역이 없습니다. <a href="apply.html">신청서 페이지</a>에서 테스트 신청을 남겨보세요.';
    } else if (!list.length) {
      emptyEl.textContent = '검색 조건에 맞는 신청이 없습니다.';
    }
  }

  /* ---------- 상세 모달 ---------- */
  function openDetail(code) {
    var r = window.CAPS.find(code);
    if (!r) return;

    function row(dt, dd) {
      return dd ? '<div><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd></div>' : '';
    }
    var extraRows = Object.keys(r.extra || {})
      .map(function (key) {
        var p = key.split('__');
        return row(window.CAPS.serviceName(p[0]) + ' · ' + p[1], r.extra[key]);
      })
      .join('');

    modalTitle.textContent = r.code;
    modalBody.innerHTML =
      '<dl class="result-dl">' +
        row('접수 일시', window.CAPS.formatDate(r.createdAt)) +
        row('상태', (window.CAPS.STATUS[r.status] || {}).label) +
        row('신청 항목', window.CAPS.serviceNames(r.services).join(', ')) +
        row('교회명', r.church_name) +
        row('교단', r.denomination) +
        row('담당자', r.contact_name + (r.contact_role ? ' ' + r.contact_role : '')) +
        row('연락처', r.phone) +
        row('이메일', r.email) +
        row('소재지', r.location) +
        row('교인 수', r.size) +
        row('예산 범위', r.budget) +
        row('희망 시기', r.timeline) +
        row('연락 방법', r.prefer) +
        row('소식 수신', r.marketing ? '동의' : '미동의') +
        extraRows +
        row('요청 내용', r.message) +
      '</dl>' +
      '<p style="margin-top:22px"><button type="button" class="link-btn" data-remove="' + esc(r.code) + '">이 신청 삭제</button></p>';

    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('.modal-close').focus();
  }

  function closeDetail() {
    modal.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- CSV ---------- */
  function toCsv() {
    var head = ['접수번호', '접수일시', '상태', '신청항목', '교회명', '교단', '담당자', '직분', '연락처', '이메일', '소재지', '교인수', '예산', '희망시기', '연락방법', '요청내용'];
    var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = visible().map(function (r) {
      return [
        r.code, window.CAPS.formatDate(r.createdAt), (window.CAPS.STATUS[r.status] || {}).label,
        window.CAPS.serviceNames(r.services).join(' / '), r.church_name, r.denomination,
        r.contact_name, r.contact_role, r.phone, r.email, r.location, r.size,
        r.budget, r.timeline, r.prefer, r.message,
      ].map(cell).join(',');
    });
    // 엑셀에서 한글이 깨지지 않도록 BOM 추가
    return '﻿' + [head.map(cell).join(',')].concat(lines).join('\r\n');
  }

  document.getElementById('exportCsv').addEventListener('click', function () {
    var blob = new Blob([toCsv()], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    a.href = url;
    a.download = 'caps-신청현황-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /* ---------- 이벤트 ---------- */
  searchEl.addEventListener('input', render);
  filterEl.addEventListener('change', render);

  rowsEl.addEventListener('change', function (e) {
    if (!e.target.classList.contains('status-select')) return;
    window.CAPS.update(e.target.dataset.code, { status: e.target.value });
    render();
  });

  rowsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-detail]');
    if (btn) openDetail(btn.dataset.detail);
  });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeDetail(); return; }
    var del = e.target.closest('[data-remove]');
    if (del && window.confirm('이 신청 내역을 삭제할까요? 되돌릴 수 없습니다.')) {
      window.CAPS.remove(del.dataset.remove);
      closeDetail();
      render();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeDetail();
  });

  render();
})();
