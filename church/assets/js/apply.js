/* 신청서 페이지: 항목 선택, 동적 추가 필드, 검증, 제출 */
(function () {
  'use strict';

  var form = document.getElementById('applyForm');
  if (!form) return;

  var SERVICES = window.CAPS_SERVICES || [];
  var extraFieldset = document.getElementById('extraFieldset');
  var extraWrap = document.getElementById('extraFields');
  var progress = document.getElementById('formProgress');
  var formError = document.getElementById('formError');
  var submitBtn = document.getElementById('submitBtn');

  function svc(id) {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i];
    return null;
  }

  function checkedServices() {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="services"]:checked'))
      .map(function (el) { return el.value; });
  }

  /* ---------- URL 파라미터로 항목 미리 선택 ---------- */
  (function preselect() {
    var params = new URLSearchParams(window.location.search);
    var wanted = params.getAll('service').concat((params.get('services') || '').split(',')).filter(Boolean);
    if (!wanted.length) return;
    wanted.forEach(function (id) {
      var box = form.querySelector('input[name="services"][value="' + CSS.escape(id) + '"]');
      if (box && !box.disabled) box.checked = true;   // 준비 중 항목은 건너뜁니다
    });
  })();

  /* ---------- 선택 항목에 따른 추가 필드 ----------

     type 이 세 가지입니다.
       select    고르기
       textarea  여러 줄 글 (인사말 · SNS 주소 · 참고 홈페이지)
       files     파일 올리기 (로고 · 사진 · 사업자등록증)

     파일은 고르기만 하고 바로 올리지 않습니다.
     신청서는 제출할 때 로그인을 받는데, 저장소는 로그인한 사람만 쓸 수
     있습니다. 고르는 즉시 올리면 [로그인이 필요합니다] 에서 막힙니다.
     그래서 파일은 들고 있다가, 로그인이 끝난 뒤 제출 직전에 올립니다.

     항목을 껐다 켜도 고른 파일을 잃지 않도록 화면 밖에 둡니다. */
  var chosen = {};   // { 'homepage__logo': [File, File, …] }

  function buildExtraFields() {
    var ids = checkedServices();
    var kept = {};
    // 이미 입력한 값은 유지
    Array.prototype.slice.call(extraWrap.querySelectorAll('[name]')).forEach(function (el) {
      kept[el.name] = el.value;
    });

    var html = '';
    ids.forEach(function (id) {
      var s = svc(id);
      if (!s || !s.extraFields || !s.extraFields.length) return;
      html += '<div class="extra-group"><h4 class="extra-title">' + esc(s.name) + '</h4><div class="grid-2">';
      s.extraFields.forEach(function (f) {
        var name = s.id + '__' + f.name;
        var val = kept[name] || '';
        var wide = f.type === 'textarea' || f.type === 'files';
        html += '<div class="field' + (wide ? ' is-wide' : '') + '">' +
          '<label for="' + name + '">' + esc(f.label) + ' <span class="opt">선택</span></label>';
        if (f.type === 'files') {
          html += '<input type="file" id="' + name + '" data-files="' + name + '" multiple>' +
            '<ul class="file-list" id="' + name + '__list"></ul>';
        } else if (f.type === 'textarea') {
          html += '<textarea id="' + name + '" name="' + name + '" rows="5"' +
            (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>' + esc(val) + '</textarea>';
        } else if (f.type === 'select') {
          html += '<select id="' + name + '" name="' + name + '"><option value="">선택해 주세요</option>';
          f.options.forEach(function (o) {
            html += '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>';
          });
          html += '</select>';
        } else if (f.type !== 'files' && f.type !== 'textarea') {
          html +=
            '<input type="' + (f.type || 'text') + '" id="' + name + '" name="' + name + '"' +
            (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
            ' value="' + esc(val) + '">';
        }
        if (f.help) html += '<p class="field-help">' + esc(f.help) + '</p>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    extraWrap.innerHTML = html;
    extraFieldset.hidden = html === '';
    wireFiles();
  }

  /* ---------- 파일 올리기 ---------- */

  function fileRow(name, f, i) {
    var kb = f.size ? ' <small>' + Math.max(1, Math.round(f.size / 1024)) + 'KB</small>' : '';
    return '<li>' + esc(f.name) + kb +
      ' <button type="button" class="file-del" data-del="' + name + '" data-i="' + i + '">지우기</button></li>';
  }

  function drawList(name) {
    var ul = document.getElementById(name + '__list');
    if (!ul) return;
    var list = chosen[name] || [];
    ul.innerHTML = list.map(function (f, i) { return fileRow(name, f, i); }).join('');
  }

  function wireFiles() {
    Array.prototype.slice.call(extraWrap.querySelectorAll('[data-files]')).forEach(function (input) {
      var name = input.getAttribute('data-files');
      drawList(name);
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.value = '';
        if (!files.length) return;
        var bad = '';
        files.forEach(function (f) { bad = bad || window.CAPSDB.checkRequestFile(f); });
        if (bad) { window.alert(bad); return; }
        chosen[name] = (chosen[name] || []).concat(files);
        drawList(name);
      });
    });

    extraWrap.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      var name = btn.getAttribute('data-del');
      var i = Number(btn.getAttribute('data-i'));
      (chosen[name] || []).splice(i, 1);
      drawList(name);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 진행 표시 ---------- */
  function updateProgress() {
    if (!progress) return;
    var items = progress.children;
    var s1 = checkedServices().length > 0;
    var s2 = ['church_name', 'contact_name', 'phone', 'location'].every(function (n) {
      var el = form.elements[n];
      return el && el.value.trim() !== '';
    });
    var s3 = form.elements.message.value.trim() !== '' && form.elements.consent.checked;
    var states = [s1, s2, s3];
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-done', states[i]);
      items[i].classList.toggle('is-on', !states[i] && states.slice(0, i).every(Boolean));
    }
  }

  /* ---------- 검증 ---------- */
  var RULES = {
    church_name: { msg: '교회명을 입력해 주세요.' },
    contact_name: { msg: '담당자 성함을 입력해 주세요.' },
    location: { msg: '교회 소재지를 입력해 주세요.' },
    message: { msg: '요청 내용을 입력해 주세요.' },
    phone: {
      msg: '연락처를 정확히 입력해 주세요.',
      test: function (v) { return /^[0-9][0-9\-\s()]{7,19}$/.test(v.trim()); },
    },
    email: {
      msg: '이메일 형식을 확인해 주세요.',
      optional: true,
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    },
  };

  function setFieldError(name, message) {
    var input = form.elements[name];
    if (!input) return;
    var field = input.closest('.field');
    var err = form.querySelector('.err[data-for="' + name + '"]');
    if (field) field.classList.toggle('is-invalid', !!message);
    if (input.setAttribute) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (err) {
      err.textContent = message || '';
      err.hidden = !message;
    }
  }

  function validateField(name) {
    var rule = RULES[name];
    var input = form.elements[name];
    if (!rule || !input) return true;
    var value = input.value.trim();
    if (!value) {
      if (rule.optional) { setFieldError(name, ''); return true; }
      setFieldError(name, rule.msg);
      return false;
    }
    if (rule.test && !rule.test(value)) {
      setFieldError(name, rule.msg);
      return false;
    }
    setFieldError(name, '');
    return true;
  }

  function validateAll() {
    var problems = [];

    var errServices = document.getElementById('err-services');
    var hasService = checkedServices().length > 0;
    errServices.hidden = hasService;
    if (!hasService) problems.push(document.querySelector('.pick input'));

    Object.keys(RULES).forEach(function (name) {
      if (!validateField(name)) problems.push(form.elements[name]);
    });

    var errConsent = document.getElementById('err-consent');
    var consent = form.elements.consent.checked;
    errConsent.hidden = consent;
    if (!consent) problems.push(form.elements.consent);

    return problems;
  }

  /* ---------- 이벤트 ---------- */
  form.addEventListener('change', function (e) {
    if (e.target.name === 'services') {
      buildExtraFields();
      if (checkedServices().length) document.getElementById('err-services').hidden = true;
    }
    if (e.target.name === 'consent' && e.target.checked) {
      document.getElementById('err-consent').hidden = true;
    }
    updateProgress();
  });

  form.addEventListener('input', function (e) {
    if (RULES[e.target.name]) {
      var field = e.target.closest('.field');
      // 이미 오류 표시된 항목만 실시간으로 다시 검사
      if (field && field.classList.contains('is-invalid')) validateField(e.target.name);
    }
    updateProgress();
  });

  form.addEventListener('blur', function (e) {
    if (RULES[e.target.name]) validateField(e.target.name);
  }, true);

  /* 전화번호 자동 하이픈 */
  var phone = form.elements.phone;
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) { phone.value = d; return; }
    if (d.startsWith('02')) {
      phone.value = d.length <= 5 ? d.replace(/(\d{2})(\d+)/, '$1-$2')
        : d.length <= 9 ? d.replace(/(\d{2})(\d{3})(\d+)/, '$1-$2-$3')
        : d.replace(/(\d{2})(\d{4})(\d{1,4})/, '$1-$2-$3');
    } else {
      phone.value = d.length <= 7 ? d.replace(/(\d{3})(\d+)/, '$1-$2')
        : d.length <= 10 ? d.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3')
        : d.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
    }
  });

  /* ---------- 제출 ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.hidden = true;

    var problems = validateAll();
    if (problems.length) {
      formError.textContent = '입력하지 않은 필수 항목이 ' + problems.length + '개 있습니다. 표시된 부분을 확인해 주세요.';
      formError.hidden = false;
      var first = problems[0];
      if (first) {
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); }
      }
      return;
    }

    // 신청 내역을 계정에 남기기 위해 제출 시점에 로그인을 요청합니다.
    window.CAPSAuthUI
      .require('신청 내역을 확인하고 진행 상황을 안내드리기 위해 로그인이 필요합니다. 처음이시면 회원가입을 해주세요.')
      .then(function () { send(); })
      .catch(function () { /* 로그인 창을 닫은 경우 — 입력 내용은 그대로 남습니다 */ });
  });

  var submitLabel = submitBtn.textContent;

  /* 고른 파일을 올립니다 — 로그인이 끝난 뒤에 부릅니다.
     고른 항목의 것만 올립니다 (껐다 켠 항목의 파일이 따라가지 않도록). */
  function uploadChosen() {
    var picked = checkedServices();
    var keys = Object.keys(chosen).filter(function (k) {
      return (chosen[k] || []).length && picked.indexOf(k.split('__')[0]) !== -1;
    });
    if (!keys.length) return Promise.resolve({});

    var out = {};
    var jobs = [];
    keys.forEach(function (k) {
      chosen[k].forEach(function (file) { jobs.push({ key: k, file: file }); });
    });
    var done = 0;
    return jobs.reduce(function (chain, job) {
      return chain.then(function () {
        return window.CAPSDB.uploadRequestFile(job.file, job.key).then(function (info) {
          (out[job.key] = out[job.key] || []).push(info);
          done += 1;
          submitBtn.textContent = '파일 올리는 중… (' + done + '/' + jobs.length + ')';
        });
      });
    }, Promise.resolve()).then(function () { return out; });
  }

  function send() {
    submitBtn.disabled = true;
    submitBtn.textContent = '파일 올리는 중…';

    uploadChosen().then(function (files) {
      submitBtn.textContent = '제출 중…';
      finish(files);
    }).catch(function (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
      formError.textContent = (err && err.message) || '파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.';
      formError.hidden = false;
      formError.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function finish(files) {
    var fd = new FormData(form);
    var extra = {};
    Object.keys(files).forEach(function (k) { extra[k] = files[k]; });
    fd.forEach(function (value, key) {
      if (key.indexOf('__') > -1 && String(value).trim() !== '') extra[key] = value;
    });

    var payload = {
      services: checkedServices(),
      church_name: fd.get('church_name').trim(),
      denomination: (fd.get('denomination') || '').trim(),
      contact_name: fd.get('contact_name').trim(),
      contact_role: fd.get('contact_role') || '',
      phone: fd.get('phone').trim(),
      email: (fd.get('email') || '').trim(),
      location: fd.get('location').trim(),
      size: fd.get('size') || '',
      budget: fd.get('budget') || '',
      timeline: fd.get('timeline') || '',
      message: fd.get('message').trim(),
      prefer: fd.get('prefer') || '전화',
      marketing: fd.get('marketing') === 'on',
      extra: extra,
    };

    window.CAPSDB.submitRequest(payload)
      .then(function (record) { mailIt(record); showDone(record); })
      .catch(function (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = '신청서 제출하기';
        formError.textContent = (err && err.message)
          ? '접수 처리 중 문제가 발생했습니다: ' + err.message
          : '접수 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하시거나 전화로 문의해 주세요.';
        formError.hidden = false;
      });
  }

  /* ---------- 접수 메일 ----------
     신청은 데이터베이스에 저장되지만, 그것만으로는 아무도 모릅니다.
     관리자 화면에 들어가 보기 전까지 신청이 묻히지 않도록,
     접수와 동시에 센터 메일함으로 한 통 보냅니다.

     보내는 일은 formsubmit.co 가 대신합니다 — 열쇠도 서버도 필요 없고,
     처음 한 번만 센터 메일로 온 확인 링크를 누르면 그때부터 계속 옵니다.
     메일이 실패해도 접수는 이미 끝났으므로 화면에는 티가 나지 않습니다. */
  function mailIt(record) {
    var to = (window.CAPS_CONTACT && window.CAPS_CONTACT.email) || '';
    if (!to || !window.fetch) return;

    var items = (record.services || []).map(window.CAPSDB.serviceName).join(', ');
    var body = {
      _subject: '[신청] ' + (record.church_name || '교회') + ' — ' + (items || '지원 신청'),
      _template: 'table',
      _captcha: 'false',
      접수번호: record.code,
      신청항목: items,
      교회명: record.church_name || '',
      교단: record.denomination || '',
      담당자: ((record.contact_name || '') + ' ' + (record.contact_role || '')).trim(),
      연락처: record.phone || '',
      이메일: record.email || '',
      지역: record.location || '',
      교회규모: record.size || '',
      희망시기: record.timeline || '',
      연락방법: record.prefer || '',
      남기신말씀: record.message || '',
    };

    try {
      window.fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      }).catch(function () { /* 접수는 이미 끝났습니다 */ });
    } catch (ignore) { /* 오래된 브라우저 */ }
  }

  /* ---------- 완료 화면 ---------- */
  function showDone(record) {
    var done = document.getElementById('applyDone');
    document.getElementById('doneCode').textContent = record.code;

    var rows = [
      ['신청 항목', record.services.map(window.CAPSDB.serviceName).join(', ')],
      ['교회명', record.church_name],
      ['담당자', record.contact_name + (record.contact_role ? ' ' + record.contact_role : '')],
      ['연락처', record.phone],
      ['접수 일시', window.CAPSDB.formatDate(record.createdAt)],
    ];
    document.getElementById('doneSummary').innerHTML = rows
      .map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; })
      .join('');

    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.title = '신청 완료 (' + record.code + ') | 우리교회지원센터';

    var copy = document.getElementById('copyCode');
    copy.addEventListener('click', function () {
      var write = navigator.clipboard
        ? navigator.clipboard.writeText(record.code)
        : Promise.reject();
      write
        .then(function () {
          copy.textContent = '복사됨';
          window.setTimeout(function () { copy.textContent = '번호 복사'; }, 1800);
        })
        .catch(function () {
          window.prompt('접수번호를 복사하세요', record.code);
        });
    });
  }

  /* 로그인 상태라면 담당자 정보를 미리 채웁니다. */
  window.CAPSDB.auth.onChange(function (user) {
    if (!user) return;
    var pairs = [['contact_name', user.name], ['email', user.email], ['phone', user.phone], ['church_name', user.church]];
    pairs.forEach(function (pair) {
      var input = form.elements[pair[0]];
      if (input && !input.value && pair[1]) input.value = pair[1];
    });
    updateProgress();
  });

  buildExtraFields();
  updateProgress();
})();
