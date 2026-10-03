/* ══════════════════════════════════════════════════════════════════
   포트원(PortOne) 결제 — 준비 코드
   2026-10-03 작성 · 🔴 «아직 어느 화면에도 연결하지 않았습니다»

   왜 연결하지 않았나
   · 가맹점 식별코드(storeId)와 채널키(channelKey)가 아직 없습니다. PG 심사가 끝나야 나옵니다.
   · 키 없이 버튼만 붙이면 «눌렀을 때 오류»가 납니다. 심사하는 분이 눌러 보면 그게 더 큰 감점입니다.
   · 그래서 심사에 필요한 것(가격표 · 결제 시점 · 환불 기준 · 사업자 정보)은 /payment/ 페이지로 먼저 갖추고,
     이 파일은 키가 나온 뒤에 붙입니다.

   붙일 때 할 일
   1) 아래 STORE_ID · CHANNEL_KEY 를 실제 값으로 바꿉니다.
   2) 결제를 띄울 화면에 SDK 를 넣습니다.
        <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
   3) 🔴 서버 확인(4번 단계)을 «반드시» 만듭니다. 이것 없이 쓰면 안 됩니다.
   ══════════════════════════════════════════════════════════════════ */

var PAY = (function () {
  'use strict';

  var STORE_ID   = 'store-00000000-0000-0000-0000-000000000000'; /* 포트원 콘솔 → 상점 식별코드 */
  var CHANNEL_KEY= 'channel-key-0000';                           /* 포트원 콘솔 → 채널키 */
  var VERIFY_URL = '/api/pay/verify';                            /* 우리 서버의 확인 주소 (아직 없음) */

  /* 주문번호 — 가게마다 겹치면 안 됩니다 */
  function makeOrderId(prefix) {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return (prefix || 'IM') + '-' +
      d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  /* 결제 띄우기
     쓰는 법 : PAY.requestPay({ name:'홈페이지 제작 1단계', amount:150000, buyer:{name:'...', tel:'...', email:'...'} }) */
  async function requestPay(opt) {
    if (!window.PortOne) { alert('결제 모듈을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주십시오.'); return; }

    var orderId = makeOrderId('IM');

    /* 1) 결제창을 띄웁니다 */
    var res = await window.PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      paymentId: orderId,
      orderName: opt.name,            /* 고객 명세서에 찍히는 이름 */
      totalAmount: opt.amount,        /* 원 단위 정수 (부가세 포함 금액) */
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',              /* CARD · TRANSFER(계좌이체) · VIRTUAL_ACCOUNT(가상계좌) · EASY_PAY(간편결제) */
      customer: {
        fullName: opt.buyer && opt.buyer.name,
        phoneNumber: opt.buyer && opt.buyer.tel,
        email: opt.buyer && opt.buyer.email
      },
      /* 휴대폰에서 다른 앱으로 갔다 돌아올 때 쓰는 주소 */
      redirectUrl: location.origin + '/payment/done.html'
    });

    /* 2) 고객이 취소했거나 실패한 경우 */
    if (res.code !== undefined) {
      alert('결제가 완료되지 않았습니다.\n' + (res.message || ''));
      return { ok: false, reason: res.message };
    }

    /* 3) 🔴 여기서 끝내면 안 됩니다.
          결제창이 성공을 돌려줬다는 것만으로는 «실제로 결제됐는지 · 금액이 맞는지» 알 수 없습니다.
          화면 코드는 누구나 고칠 수 있어서, 금액을 1원으로 바꿔 보내는 일이 실제로 일어납니다. */
    var v = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: res.paymentId, expectedAmount: opt.amount })
    }).then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });

    if (!v.ok) {
      alert('결제 확인에 실패했습니다. 결제가 되었는지 담당자에게 확인해 주십시오. 010-7318-1790');
      return { ok: false, reason: 'verify-failed' };
    }

    return { ok: true, paymentId: res.paymentId, orderId: orderId };
  }

  /* ────────────────────────────────────────────────────────────────
     휴대폰 본인인증 창 띄우기
     쓰는 법 : var r = await PAY.verifyIdentity(); if(r.ok){ ... }

     🔴 본인인증은 «별도 채널»입니다. 결제 채널키와 다른 키를 씁니다.
     🔴 본인확인기관(KG이니시스·다날 등)과 따로 계약해야 쓸 수 있습니다. 결제 심사와 별건입니다.
     🔴 이름·생년월일·휴대폰번호·통신사가 넘어옵니다. 개인정보처리방침의 «수집 항목»에
        이 값들이 적혀 있어야 합니다. 지금 방침에는 없으니, 쓰기로 정해지면 방침을 먼저 고쳐야 합니다
        (방침을 고치면 공지 의무가 생깁니다 — 행정 창에 확인). */
  var IDENTITY_CHANNEL_KEY = 'channel-key-identity-0000';   /* 본인인증 전용 채널키 */

  async function verifyIdentity() {
    if (!window.PortOne) { alert('본인인증 모듈을 불러오지 못했습니다.'); return { ok:false }; }

    var res = await window.PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      channelKey: IDENTITY_CHANNEL_KEY,
      identityVerificationId: makeOrderId('IDV'),
      redirectUrl: location.origin + '/payment/done.html'     /* 휴대폰에서 돌아올 자리 */
    });

    if (res.code !== undefined) { return { ok:false, reason: res.message }; }

    /* 🔴 여기서도 결과를 그대로 믿으면 안 됩니다. 서버에서 다시 물어봐야 진짜 값입니다.
       GET https://api.portone.io/identity-verifications/{identityVerificationId}
       서버가 돌려주는 verifiedCustomer 안에 이름·생년월일·휴대폰번호가 들어 있습니다. */
    var v = await fetch('/api/pay/identity', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ identityVerificationId: res.identityVerificationId })
    }).then(function(r){return r.json();}).catch(function(){return {ok:false};});

    return v.ok ? { ok:true, customer:v.customer } : { ok:false, reason:'verify-failed' };
  }

  /* ────────────────────────────────────────────────────────────────
     정기결제 — 카드 빌링키 발급
     쓰는 법 : var r = await PAY.issueBillingKey({ buyer:{...} });  →  r.billingKey 를 서버에 저장

     어디에 쓰나 : 홈페이지 «월 관리비»와 채널 «정기 콘텐츠» 월 요금처럼 매달 빠져나가는 것.

     🔴 빌링키는 «카드를 대신하는 열쇠»입니다. 이것만 있으면 금액을 정해 마음대로 긁을 수 있습니다.
        · 화면(브라우저)에 저장하지 마세요. 받자마자 서버로 보내고 화면에서는 버립니다.
        · 서버에서도 암호화해 두고, 접근 기록을 남깁니다.
     🔴 정기결제는 «동의»가 따로 필요합니다. 결제 전에 아래를 화면에 보여주고 체크를 받아야 합니다.
        — 매달 빠져나가는 금액 · 결제일 · 언제까지 · 해지하는 방법
        약관 제7조에 「최소 3개월 뒤 납부일 7일 전까지 알리면 해지」가 있으니 그 문장을 그대로 씁니다. */
  async function issueBillingKey(opt) {
    if (!window.PortOne) { alert('결제 모듈을 불러오지 못했습니다.'); return { ok:false }; }

    var res = await window.PortOne.requestIssueBillingKey({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      billingKeyMethod: 'CARD',
      issueId: makeOrderId('BK'),
      issueName: opt && opt.name ? opt.name : '인투마케팅 정기결제 카드 등록',
      customer: {
        fullName: opt && opt.buyer && opt.buyer.name,
        phoneNumber: opt && opt.buyer && opt.buyer.tel,
        email: opt && opt.buyer && opt.buyer.email
      },
      redirectUrl: location.origin + '/payment/done.html'
    });

    if (res.code !== undefined) { return { ok:false, reason: res.message }; }

    /* 서버로 넘겨 저장합니다. 🔴 화면에는 남기지 않습니다. */
    var sv = await fetch('/api/pay/billing-key', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ billingKey: res.billingKey, orderRef: opt && opt.orderRef })
    }).then(function(r){return r.json();}).catch(function(){return {ok:false};});

    return sv.ok ? { ok:true } : { ok:false, reason:'save-failed' };
  }

  return { requestPay: requestPay, verifyIdentity: verifyIdentity,
           issueBillingKey: issueBillingKey, makeOrderId: makeOrderId };
})();

/* ══════════════════════════════════════════════════════════════════
   4) 서버에서 할 확인 — 포트원 V2 기준 (우리 서버에 아직 없습니다)

   POST /api/pay/verify   { paymentId, expectedAmount }

   서버 안에서 :
     a. 포트원에 그 결제를 물어봅니다
          GET https://api.portone.io/payments/{paymentId}
          헤더 Authorization: PortOne {V2 API 시크릿}      ← 🔴 시크릿은 서버에만 둡니다. 화면 코드에 절대 쓰지 마세요.
     b. 돌려받은 값에서 두 가지를 확인합니다
          · status 가 'PAID' 인가
          · amount.total 이 우리가 아는 그 주문의 금액과 «같은가»  (화면이 보낸 expectedAmount 를 믿으면 안 됩니다.
            주문번호로 우리 DB에서 금액을 다시 꺼내 비교해야 합니다)
     c. 다르면 즉시 결제를 취소합니다
          POST https://api.portone.io/payments/{paymentId}/cancel
     d. 맞으면 주문을 「결제 완료」로 바꾸고 영수증을 보냅니다

   ※ 웹훅(결제 결과 자동 통보)도 같이 받아 두는 것이 안전합니다.
      고객이 결제 직후 창을 닫아 버리면 위 3번이 실행되지 않기 때문입니다.
   ══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   5) 매달 긁는 것은 «서버»가 합니다 — 화면 코드로 하지 않습니다

   POST https://api.portone.io/payments/{새 주문번호}/billing-key
   헤더 Authorization: PortOne {V2 API 시크릿}
   본문 { billingKey, orderName, customer, amount:{ total: 금액 }, currency:'KRW' }

   · 매달 정해진 날에 서버가 돌면서 긁습니다(스케줄러).
   · 실패하면(한도 초과·카드 정지) 고객에게 알리고, 정해진 횟수만 다시 시도합니다.
   · 해지 요청이 오면 빌링키를 지웁니다 — 지우지 않으면 계속 빠져나갑니다.

   🔴 V2 API 시크릿은 서버에만 둡니다. 이 파일 같은 «화면 코드»에 절대 쓰지 마세요.
   ══════════════════════════════════════════════════════════════════ */
