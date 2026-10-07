/* ──────────────────────────────────────────────────────────────
   신청서 공용 — 로그인 · 내 정보 (2026-10-07)

   왜 있는가
     2026-10-07 부터 신청은 «로그인한 분만» 할 수 있습니다.
     DB 규칙(customer_insert_own_request)이 user_id = 본인 인 것만 받습니다.
     그래서 화면에서 막아 주지 않으면 제출 순간에 영문 모를 오류가 납니다.

   어떻게 쓰나 — 신청서마다 세 줄이면 됩니다
     IMAccount.init(sb);                     // 1. 붙이기
     var me = await IMAccount.need();        // 2. 내기 직전. 없으면 창이 뜨고 기다립니다
     if(!me) return;                         //    (닫으면 null)
     row.user_id = me.id;                    // 3. 내 것으로 표시
     IMAccount.remember(row, details);       //    (선택) 다음에 자동으로 채워지게 저장

   🔴 쓴 내용을 날리지 않습니다
      로그인 창은 «덮어쓰는 창»이라 신청서는 그대로 남아 있습니다.
      로그인이 끝나면 쓰던 자리에서 이어서 제출됩니다.
      다른 쪽으로 보내 로그인시키면 적은 게 다 날아갑니다. 그렇게 바꾸지 마세요.

   🔴 가입은 «메일과 비밀번호만» 받습니다
      사업자 정보는 신청서를 쓰면서 자연스럽게 모여 profiles 에 저장됩니다.
      가입 단계를 길게 만들면 신청이 줄어듭니다.
   ────────────────────────────────────────────────────────────── */
(function(){
"use strict";

var sb=null, cached=null;

function el(tag, cls){
  var e=document.createElement(tag);
  if(cls) e.className=cls;
  return e;
}

/* ── 창 모양 — 쓰는 쪽 CSS 와 섞이지 않게 모두 ima- 로 시작합니다 ── */
var CSS = [
'.ima-back{position:fixed;inset:0;z-index:9000;background:rgba(10,20,40,.55);',
'  display:grid;place-items:center;padding:20px;overflow-y:auto}',
'.ima-box{width:100%;max-width:400px;background:#fff;color:#0E1B33;border-radius:16px;',
'  padding:28px 24px;box-shadow:0 30px 70px -30px rgba(10,20,40,.6);',
'  font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",system-ui,sans-serif}',
'@media (prefers-color-scheme:dark){.ima-box{background:#111A2C;color:#E7EDF7}}',
'.ima-box h3{margin:0 0 6px;font-size:18px;letter-spacing:-.02em}',
'.ima-sub{margin:0 0 20px;font-size:13.5px;color:#56657F;line-height:1.7}',
'@media (prefers-color-scheme:dark){.ima-sub{color:#9BAAC3}}',
'.ima-tabs{display:flex;gap:4px;background:#EFF3F9;padding:4px;border-radius:999px;margin:0 0 18px}',
'@media (prefers-color-scheme:dark){.ima-tabs{background:#16233C}}',
'.ima-tab{flex:1;min-height:44px;border:0;background:none;border-radius:999px;cursor:pointer;',
'  font:inherit;font-size:14px;font-weight:700;color:#56657F}',
'.ima-tab[aria-selected="true"]{background:#fff;color:#0E1B33;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
'@media (prefers-color-scheme:dark){.ima-tab[aria-selected="true"]{background:#0A101E;color:#E7EDF7}}',
'.ima-f{margin-bottom:12px}',
'.ima-f label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}',
'.ima-f input{width:100%;min-height:44px;padding:12px 13px;border:1px solid #DFE6F1;border-radius:10px;',
'  background:#F7F9FC;font:inherit;font-size:15px;color:inherit}',
'@media (prefers-color-scheme:dark){.ima-f input{background:#0A101E;border-color:#22314C}}',
'.ima-f input:focus{outline:none;border-color:#2E5FE8;background:#fff}',
'@media (prefers-color-scheme:dark){.ima-f input:focus{background:#0A101E}}',
'.ima-go{width:100%;min-height:48px;margin-top:8px;border:0;border-radius:10px;cursor:pointer;',
'  background:#2E5FE8;color:#fff;font:inherit;font-size:15px;font-weight:700}',
'.ima-go:disabled{opacity:.6;cursor:default}',
'.ima-msg{margin:12px 0 0;font-size:13.5px;line-height:1.7;min-height:20px}',
'.ima-msg.err{color:#C2413B}.ima-msg.ok{color:#12805C}',
'@media (prefers-color-scheme:dark){.ima-msg.err{color:#FF9A90}.ima-msg.ok{color:#5BD6A8}}',
'.ima-x{display:block;width:100%;min-height:44px;margin-top:6px;border:0;background:none;cursor:pointer;',
'  font:inherit;font-size:13.5px;color:#56657F;text-decoration:underline}',
'.ima-keep{margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#EFF3F9;',
'  font-size:12.5px;color:#56657F;line-height:1.7}',
'@media (prefers-color-scheme:dark){.ima-keep{background:#16233C;color:#9BAAC3}}'
].join('\n');

function style(){
  if(document.getElementById('ima-css')) return;
  var s=el('style'); s.id='ima-css'; s.textContent=CSS;
  document.head.appendChild(s);
}

/* ── 로그인 창 — 끝나면 사용자(또는 null)를 돌려줍니다 ── */
function sheet(){
  style();
  return new Promise(function(done){
    var back=el('div','ima-back');
    back.innerHTML=
      '<div class="ima-box" role="dialog" aria-modal="true" aria-labelledby="ima-t">'
     +  '<h3 id="ima-t">신청하려면 로그인이 필요합니다</h3>'
     +  '<p class="ima-sub">메일과 비밀번호만 있으면 됩니다. '
     +     '다음부터는 사업자 정보가 자동으로 채워집니다.</p>'
     +  '<div class="ima-tabs" role="tablist">'
     +    '<button class="ima-tab" role="tab" aria-selected="true"  data-m="in">로그인</button>'
     +    '<button class="ima-tab" role="tab" aria-selected="false" data-m="up">계정 만들기</button>'
     +  '</div>'
     +  '<div class="ima-f"><label for="ima-e">메일</label>'
     +    '<input id="ima-e" type="email" autocomplete="email" inputmode="email"></div>'
     +  '<div class="ima-f"><label for="ima-p">비밀번호</label>'
     +    '<input id="ima-p" type="password" autocomplete="current-password"></div>'
     +  '<button class="ima-go" type="button" id="ima-go">로그인</button>'
     +  '<p class="ima-msg" id="ima-m" role="status"></p>'
     +  '<button class="ima-x" type="button" id="ima-x">나중에 하기</button>'
     +  '<p class="ima-keep">적으신 내용은 그대로 있습니다. 로그인하면 이어서 접수됩니다.</p>'
     + '</div>';
    document.body.appendChild(back);

    var mode='in';
    var E=back.querySelector('#ima-e'), P=back.querySelector('#ima-p');
    var GO=back.querySelector('#ima-go'), M=back.querySelector('#ima-m');

    function msg(t,k){ M.textContent=t||''; M.className='ima-msg'+(k?' '+k:''); }
    function close(user){ back.remove(); done(user||null); }

    back.querySelectorAll('.ima-tab').forEach(function(t){
      t.onclick=function(){
        mode=t.dataset.m;
        back.querySelectorAll('.ima-tab').forEach(function(o){o.setAttribute('aria-selected','false');});
        t.setAttribute('aria-selected','true');
        GO.textContent = mode==='in' ? '로그인' : '계정 만들고 이어서 신청';
        P.autocomplete = mode==='in' ? 'current-password' : 'new-password';
        msg('');
      };
    });

    GO.onclick=async function(){
      var mail=(E.value||'').trim(), pw=P.value||'';
      if(!mail || !pw) return msg('메일과 비밀번호를 넣어 주세요.','err');
      if(mode==='up' && pw.length<6) return msg('비밀번호는 6자 이상으로 해 주세요.','err');
      GO.disabled=true; msg('잠시만요...');
      try{
        var r;
        if(mode==='in'){
          r=await sb.auth.signInWithPassword({email:mail,password:pw});
          if(r.error) throw r.error;
        }else{
          r=await sb.auth.signUp({email:mail,password:pw});
          if(r.error) throw r.error;
          /* 메일 확인을 켜 둔 경우에는 바로 로그인되지 않습니다 */
          if(!r.data || !r.data.session){
            var s=await sb.auth.signInWithPassword({email:mail,password:pw});
            if(s.error){
              GO.disabled=false;
              return msg('계정은 만들어졌습니다. 메일에서 확인을 마친 뒤 로그인해 주세요.','ok');
            }
            r=s;
          }
        }
        cached=null;
        close((r.data && r.data.user) || null);
      }catch(e){
        GO.disabled=false;
        var m=String((e && e.message) || e);
        if(/Invalid login/i.test(m)) m='메일이나 비밀번호가 맞지 않습니다.';
        else if(/already registered|already been/i.test(m)) m='이미 있는 메일입니다. 「로그인」으로 들어와 주세요.';
        else if(/at least/i.test(m)) m='비밀번호는 6자 이상으로 해 주세요.';
        msg(m,'err');
      }
    };
    P.addEventListener('keydown',function(e){ if(e.key==='Enter') GO.click(); });
    back.querySelector('#ima-x').onclick=function(){ close(null); };
    back.addEventListener('mousedown',function(e){ if(e.target===back) close(null); });
    document.addEventListener('keydown',function esc(e){
      if(e.key==='Escape'){ document.removeEventListener('keydown',esc); close(null); }
    });
    setTimeout(function(){ E.focus(); },40);
  });
}

window.IMAccount = {
  init:function(client){ sb=client; },

  /* 지금 로그인된 사람 (없으면 null) */
  user:async function(){
    if(!sb) return null;
    try{ var r=await sb.auth.getUser(); return (r && r.data && r.data.user) || null; }
    catch(e){ return null; }
  },

  /* 로그인을 «요구»합니다. 이미 되어 있으면 바로, 아니면 창을 띄우고 기다립니다. */
  need:async function(){
    var u=await this.user();
    if(u) return u;
    return await sheet();
  },

  /* 저장해 둔 내 정보 */
  profile:async function(){
    if(!sb) return null;
    if(cached) return cached;
    var u=await this.user(); if(!u) return null;
    try{
      var r=await sb.from('profiles')
        .select('academy_name,manager_name,phone,email,biz_no,industry,address')
        .eq('id',u.id).maybeSingle();
      cached=(r && r.data) || null;
    }catch(e){ cached=null; }
    return cached;
  },

  /* 신청서에 적은 기본 정보를 다음에도 쓰도록 저장합니다.
     🔴 빈 값으로 기존 값을 덮지 않습니다 — 신청서마다 받는 칸이 다르기 때문입니다. */
  remember:async function(row, details){
    if(!sb) return;
    var u=await this.user(); if(!u) return;
    var d=details||{}, o={};
    function put(k,v){ if(v!=null && String(v).trim()!=='') o[k]=String(v).trim(); }
    put('academy_name', row.academy_name);
    put('manager_name', row.manager_name);
    put('phone',        row.phone);
    put('email',        row.email);
    put('industry',     d['업종']);
    put('address',      d['주소']);
    if(!Object.keys(o).length) return;
    o.updated_at=new Date().toISOString();
    try{ await sb.from('profiles').update(o).eq('id',u.id); cached=null; }catch(e){}
  },

  /* 저장해 둔 값으로 «빈 칸만» 채웁니다. 이미 적힌 칸은 건드리지 않습니다. */
  prefill:async function(root){
    var p=await this.profile(); if(!p) return;
    var scope=root||document;
    [['academy_name',p.academy_name],['manager_name',p.manager_name],
     ['phone',p.phone],['email',p.email]].forEach(function(x){
      var e=scope.querySelector('[data-col="'+x[0]+'"]');
      if(e && !e.value && x[1]) e.value=x[1];
    });
    [['업종',p.industry],['주소',p.address]].forEach(function(x){
      var e=scope.querySelector('[data-q="'+x[0]+'"]');
      if(e && ('value' in e) && !e.value && x[1]) e.value=x[1];
    });
  }
};
})();
