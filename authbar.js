/* ──────────────────────────────────────────────────────────────
   머리띠 로그인 표시 — 「로그인」 / 「로그아웃」 (2026-10-08)

   왜 있는가
     2026-10-07 부터 신청은 로그인한 분만 할 수 있게 바뀌었습니다.
     그런데 로그인을 «다 쓴 뒤에» 묻기 때문에, 평소 화면 어디에도
     지금 로그인되어 있는지가 나타나지 않았습니다. 그것을 보이게 합니다.

   무엇을 하나 — 자리만 만들어 두면 됩니다
     <span id="authbar"></span>      머리띠 안 (넓은 화면)
     <div  id="authbar-m"></div>     손전화 메뉴 안 (선택)

     로그인 됨   :  ● name@mail.com   [로그아웃]
     로그인 안 됨 :  [로그인]

     자리가 둘 다 없으면 아무 일도 하지 않습니다. 그래서 어느 쪽에
     붙여도 안전합니다.

   🔴 로그인 뒤에 쪽을 다시 불러오지 «않습니다»
      신청서를 쓰던 중일 수 있습니다. 다시 불러오면 적은 게 다 날아갑니다.
      빈 칸만 저장해 둔 값으로 채우고 끝냅니다.

   🔴 로그아웃 뒤에는 쪽을 다시 «불러옵니다»
      자동으로 채워 둔 전화번호·사업자 정보가 화면에 남아 있으면 안 됩니다.
      그래서 먼저 「내용이 사라집니다」라고 물어봅니다.

   🔴 클라이언트는 쪽마다 «하나만» 씁니다 (window.IMSB)
      두 벌을 만들면 supabase 가 경고를 내고, 신청서에서 로그인한 것을
      머리띠가 못 알아봅니다(표시가 안 바뀜).

   붙이는 순서
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/apply/account.js"></script>    ← 로그인 창이 여기 있습니다
     <script src="/authbar.js"></script>
   ────────────────────────────────────────────────────────────── */
(function(){
"use strict";

var SB_URL="https://qkvebwxewttqtcryfycy.supabase.co";
var SB_KEY="sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa";

/* ── 모양 — 쓰는 쪽 CSS 와 섞이지 않게 모두 imab- 로 시작합니다.
      글자색·배경은 currentColor 에서 끌어오므로 어두운 머리띠(인투마케팅)와
      밝은 홈 화면 양쪽에서 그대로 읽힙니다. ── */
var CSS=[
'.imab{display:inline-flex;align-items:center;gap:6px;min-height:44px}',
'.imab-who{display:inline-flex;align-items:center;gap:7px;max-width:180px;',
'  min-height:34px;padding:0 12px;border-radius:999px;',
'  font-size:var(--t-sm,13.5px);font-weight:700;line-height:1.2;',
'  background:rgba(130,145,175,.18);',
'  background:color-mix(in srgb,currentColor 13%,transparent)}',
'.imab-mail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.imab-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:#19A974;',
'  box-shadow:0 0 0 3px rgba(25,169,116,.22)}',
'.imab-btn{min-height:44px;padding:0 13px;border-radius:999px;cursor:pointer;',
'  color:inherit;background:none;border:1px solid rgba(130,145,175,.5);',
'  font:inherit;font-size:var(--t-sm,13.5px);font-weight:700;white-space:nowrap;',
'  display:inline-flex;align-items:center;',
'  transition-property:border-color,background-color;transition-duration:.15s;',
'  transition-timing-function:ease-out}',
'.imab-btn:hover{border-color:currentColor}',
/* 좁아지면 메일 주소를 접고 초록 점만 남깁니다 — 상태는 그대로 읽힙니다 */
'@media(max-width:1180px){.imab-mail{display:none}.imab-who{padding:0 10px}}',
/* 신청서 머리띠는 왼쪽에 「← 돌아가기」가 있어 한 줄로 나눠 놓습니다 */
'.imab-row{display:flex;align-items:center;justify-content:space-between;gap:16px}',
'.imab-row .back{margin-bottom:0}',
/* 손전화 메뉴 안 — 바깥 .msheet a 모양을 그대로 씁니다 */
'.imab-m{cursor:default}',
'.imab-m .imab-dot{display:inline-block;margin-right:8px;vertical-align:middle}'
].join('\n');

function style(){
  if(document.getElementById('imab-css')) return;
  var s=document.createElement('style');
  s.id='imab-css'; s.textContent=CSS;
  document.head.appendChild(s);
}

/* 쪽에 이미 만들어 둔 것이 있으면 그것을 씁니다 */
function sbc(){
  if(window.IMSB) return window.IMSB;
  if(!(window.supabase && window.supabase.createClient)) return null;
  window.IMSB=window.supabase.createClient(SB_URL,SB_KEY);
  if(window.IMAccount) window.IMAccount.init(window.IMSB);
  return window.IMSB;
}

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

function paint(u){
  style();
  var d=document.getElementById('authbar');
  var m=document.getElementById('authbar-m');
  var mail=(u && u.email) || '계정';

  if(d){
    if(d.className.indexOf('imab')<0) d.className=(d.className+' imab').trim();
    d.innerHTML = u
      ? '<span class="imab-who" title="'+esc(mail)+' 로 로그인되어 있습니다">'
        +   '<i class="imab-dot"></i><span class="imab-mail">'+esc(mail)+'</span>'
        + '</span>'
        + '<button class="imab-btn" type="button" data-imab="out">로그아웃</button>'
      : '<button class="imab-btn" type="button" data-imab="in">로그인</button>';
  }
  if(m){
    m.innerHTML = u
      ? '<a class="imab-m"><i class="imab-dot"></i>'+esc(mail)+'</a>'
        + '<a data-imab="out">로그아웃</a>'
      : '<a data-imab="in">로그인 · 계정 만들기</a>';
  }
}

async function look(){
  var sb=sbc();
  if(!sb){ paint(null); return; }
  var u=null;
  /* getSession() 은 저장된 것을 읽기만 해서 빠릅니다.
     getUser() 는 서버에 물어보러 가므로 머리띠에는 쓰지 않습니다. */
  try{
    var r=await sb.auth.getSession();
    u=(r && r.data && r.data.session && r.data.session.user) || null;
  }catch(e){}
  paint(u);
}

async function login(){
  var sb=sbc();
  if(!sb || !window.IMAccount){ location.href='/my/'; return; }
  window.IMAccount.init(sb);
  await window.IMAccount.signIn();
  /* 🔴 location.reload() 를 넣지 마세요 — 쓰던 신청서가 날아갑니다 */
  try{ if(window.IMAccount.prefill) await window.IMAccount.prefill(); }catch(e){}
  look();
}

async function logout(){
  var sb=sbc(); if(!sb) return;
  if(!window.confirm('로그아웃하시겠습니까?\n이 화면에 적어 두신 내용은 사라집니다.')) return;
  try{ await sb.auth.signOut(); }catch(e){}
  location.reload();   /* 🔴 자동으로 채운 전화·사업자 정보를 화면에서 치웁니다 */
}

document.addEventListener('click',function(e){
  var t=e.target;
  var b=(t && t.closest) ? t.closest('[data-imab]') : null;
  if(!b) return;
  e.preventDefault();
  if(b.getAttribute('data-imab')==='in') login(); else logout();
});

function start(){
  if(!document.getElementById('authbar') && !document.getElementById('authbar-m')) return;
  look();
  /* 신청서가 제출 직전에 띄우는 로그인 창에서 로그인해도 표시가 바뀌게 */
  var sb=sbc();
  if(sb){ try{ sb.auth.onAuthStateChange(function(){ look(); }); }catch(e){} }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();
})();
