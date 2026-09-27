/* 고객 마이페이지 공통 동작 (2026-09-27)
   ─────────────────────────────────────────────────────────────
   페이지에서 먼저 정해 주세요 :
     window.MY = { center:'mkt'|'esc', brand:'인투마케팅', phone:'010-...', email:'info@...' }

   🔴 고객은 «보기만» 합니다. 고치는 기능은 없습니다 — 틀린 것이 있으면 문의 버튼으로 받습니다.
   🔴 주문은 이메일로 «저절로» 붙이지 않습니다.
      상호명 + 전화 뒷자리 4자리를 맞춰야 연결됩니다 (my_claim).
      회사 대표 메일 하나를 여러 사람이 쓰는 일이 흔해서, 이메일만 믿으면 남의 주문이 보입니다.
*/
(function(){
"use strict";
var SB_URL="https://qkvebwxewttqtcryfycy.supabase.co";
var SB_KEY="sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa";
var sb=(window.supabase&&window.supabase.createClient)?window.supabase.createClient(SB_URL,SB_KEY):null;
var C=window.MY||{center:'mkt',brand:'인투마케팅',phone:'010-7318-1790',email:'info@intomarketing.co.kr'};

function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function won(n){return (Number(n)||0).toLocaleString('ko-KR')+'원';}
function fdate(s){return s?String(s).slice(0,10):'-';}
function gmsg(t,c){var m=$('gMsg');if(!m)return;m.textContent=t;m.className='msg'+(c?' '+c:'');}

/* ---------- 로그인 ---------- */
window.switchTab=function(t){
  var l=(t==='login');
  $('tabLogin').classList.toggle('on',l); $('tabJoin').classList.toggle('on',!l);
  $('paneLogin').style.display=l?'':'none'; $('paneJoin').style.display=l?'none':'';
  gmsg('');
};
window.doLogin=async function(){
  var e=$('li_email').value.trim(), p=$('li_pw').value;
  if(!e||!p)return gmsg('이메일과 비밀번호를 넣어 주세요.','err');
  if(!sb)return gmsg('연결이 안 됩니다. 새로고침해 주세요.','err');
  gmsg('들어가는 중…');
  var r=await sb.auth.signInWithPassword({email:e,password:p});
  if(r.error)return gmsg('로그인 실패: '+r.error.message,'err');
  boot();
};
window.doSignup=async function(){
  var e=$('su_email').value.trim(), p=$('su_pw').value;
  if(!e||!p)return gmsg('이메일과 비밀번호를 넣어 주세요.','err');
  if(p.length<6)return gmsg('비밀번호는 6자 이상으로 해 주세요.','err');
  if(!sb)return gmsg('연결이 안 됩니다. 새로고침해 주세요.','err');
  gmsg('계정 만드는 중…');
  var r=await sb.auth.signUp({email:e,password:p});
  if(r.error)return gmsg('가입 실패: '+r.error.message+' (이미 계정이 있으면 [로그인] 탭으로 들어오세요)','err');
  var s=await sb.auth.getSession();
  if(!s.data.session)return gmsg('계정이 만들어졌습니다. [로그인] 탭에서 로그인해 주세요.','ok');
  boot();
};
window.doLogout=async function(){ if(sb)await sb.auth.signOut(); location.reload(); };

/* ---------- 주문 연결 ---------- */
window.doClaim=async function(){
  var name=$('c_name').value.trim(), p4=$('c_phone4').value.trim(), m=$('cMsg');
  m.className='msg'; m.textContent='찾는 중…';
  var r=await sb.rpc('my_claim',{p_center:C.center,p_name:name,p_phone4:p4});
  if(r.error){m.className='msg err';m.textContent='실패: '+r.error.message;return;}
  if(!r.data||!r.data.ok){m.className='msg err';m.textContent=(r.data&&r.data.why)||'찾지 못했습니다.';return;}
  m.className='msg ok'; m.textContent=r.data.count+'건을 찾았습니다.';
  boot();
};

/* ---------- 들어오기 ---------- */
var ORDERS=[];
async function boot(){
  if(!sb)return gmsg('연결이 안 됩니다.','err');
  var s=await sb.auth.getSession();
  if(!s.data.session){ show('gAuth'); return; }
  $('meMail').textContent=s.data.session.user.email||'';

  var r=await sb.rpc('my_orders',{p_center:C.center});
  if(r.error){ show('gAuth'); return gmsg('조회 실패: '+r.error.message,'err'); }
  ORDERS=r.data||[];
  if(!ORDERS.length){ show('gClaim'); return; }

  $('gate').classList.add('hide'); $('app').classList.remove('hide');
  render();
}
function show(id){
  ['gAuth','gClaim'].forEach(function(x){ if($(x))$(x).style.display=(x===id?'':'none'); });
  $('gate').classList.remove('hide'); $('app').classList.add('hide');
}

/* ---------- 그리기 ---------- */
function statusPill(s){
  var t=(s==='신청접수')?'접수':(s||'접수');
  var cls=(t==='완료')?'ok':((t==='진행중')?'ing':((t==='보류')?'wait':''));
  return '<span class="pill '+cls+'">'+esc(t)+'</span>';
}
var STAGES=['접수·견적','디자인','개발','검수','완료'];
function steps(stage){
  if(!stage)return '';
  return '<div class="steps">'+STAGES.map(function(x){
    return '<span class="step'+(x===stage?' on':'')+'">'+esc(x)+'</span>';}).join('')+'</div>';
}
function line(k,v){ return v?('<div class="rowline"><span class="k">'+k+'</span><span>'+v+'</span></div>'):''; }

function render(){
  var ing=0, monthly=0, paid=0;
  var h='';
  ORDERS.forEach(function(o){
    var st=(o.status==='신청접수')?'접수':(o.status||'접수');
    if(st==='진행중')ing++;
    if(o.paid_at)paid++;
    monthly+=Number(o.monthly)||0;
    h+='<div class="ord">'
      +'<div class="h"><b>'+esc(o.kind||'의뢰')+'</b>'
        +(o.work_type?'<span class="pill">'+esc(o.work_type)+'</span>':'')
        +statusPill(o.status)
        +'<span style="margin-left:auto;color:var(--muted);font-size:.82rem">접수 '+fdate(o.created_at)+'</span></div>'
      +steps(o.stage)
      +'<div style="margin-top:10px">'
      +line('결제 금액', o.amount?('<b>'+won(o.amount)+'</b> <span style="color:var(--muted);font-size:.8rem">부가세 포함</span>'):'<span style="color:var(--muted)">확정 전</span>')
      +line('매월 요금', (Number(o.monthly)>0)?('<b>'+won(o.monthly)+'</b> / 월'):'')
      +line('입금일', o.paid_at?fdate(o.paid_at):'<span style="color:var(--muted)">입금 확인 전</span>')
      +line('견적번호', o.quote_no?esc(o.quote_no):'')
      +line('만든 사이트', o.site_url?('<a href="'+esc(o.site_url)+'" target="_blank" rel="noopener">'+esc(o.site_url)+'</a>'):'')
      +line('소개해 주신 분', o.partner_name?esc(o.partner_name)+' 실장님':'')
      +'</div></div>';
  });
  $('orders').innerHTML=h;
  $('s-all').textContent=ORDERS.length;
  $('s-ing').textContent=ing;
  $('s-paid').textContent=paid;
  $('s-month').textContent=won(monthly);
  $('mailBtn').href='mailto:'+C.email+'?subject='+encodeURIComponent('['+C.brand+'] 마이페이지 문의');
  $('telBtn').href='tel:'+String(C.phone).replace(/[^0-9]/g,'');
  $('smsBtn').href='sms:'+String(C.phone).replace(/[^0-9]/g,'');
  $('telText').textContent=C.phone;
}

boot();
})();
