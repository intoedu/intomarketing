/* 영업실장 유입 기록 (2026-09-27)
   ─────────────────────────────────────────────────────────────
   · 실장 전용 링크(...?p=코드)로 들어오면 코드를 기억해 두었다가,
     신청서를 낼 때 «누구를 통해 들어왔는지»를 같이 보냅니다.
   · 신청서 화면에는 「담당 영업실장」 칸이 저절로 생깁니다
     (신청서 HTML 은 고치지 않습니다 — #f_consent 가 있으면 신청서로 봅니다).

   🔴 화면에서 보내는 값은 «코드 글자»뿐입니다.
      실제로 어느 실장에게 붙일지는 서버가 코드로 직접 찾습니다
      (DB 트리거 t_request_fill_partner). 남의 번호를 적어 보내도 소용없습니다.

   쓰는 법
     <script src="/ref.js"></script>   ← supabase-js 다음, 신청서 코드보다 먼저
     신청서 저장할 때 :  Object.assign(row, IMRef.values())
*/
(function(){
  var KEY='im_ref', DAYS=90;
  var SB_URL="https://qkvebwxewttqtcryfycy.supabase.co";
  var SB_KEY="sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa";

  /* ---------- 저장 (브라우저에 기억) ---------- */
  function save(code){
    try{ localStorage.setItem(KEY, JSON.stringify({code:code, at:Date.now()})); }catch(e){}
  }
  function load(){
    try{
      var v=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!v||!v.code)return null;
      if(Date.now()-(v.at||0) > DAYS*24*60*60*1000){localStorage.removeItem(KEY);return null;}
      return v.code;
    }catch(e){ return null; }
  }
  /* 주소에 ?p= 또는 ?ref= 가 있으면 그것이 우선입니다 */
  var url=null;
  try{
    var q=new URLSearchParams(location.search);
    url=(q.get('p')||q.get('ref')||'').trim() || null;
  }catch(e){}
  if(url) save(url);

  var CODE = url || load();          /* 지금 화면에서 쓸 코드 */
  var FROM = url ? 'link' : (CODE ? 'link' : null);

  /* ---------- 이름 확인 ---------- */
  var sb=null;
  function client(){
    if(sb)return sb;
    if(window.supabase&&window.supabase.createClient) sb=window.supabase.createClient(SB_URL,SB_KEY);
    return sb;
  }
  /* 코드 → 실장 이름. 없는 코드면 null (표 전체는 못 봅니다 — RPC partner_name) */
  async function nameOf(code){
    var c=client(); if(!c||!code)return null;
    try{
      var r=await c.rpc('partner_name',{p_code:code});
      return (r&&!r.error&&r.data)?r.data:null;
    }catch(e){ return null; }
  }

  /* ---------- 신청서에 칸 붙이기 ---------- */
  var typed=null;            /* 손님이 직접 적은 코드 */
  var box=null, msg=null, inp=null, wrap=null;

  function html(){
    return ''
     +'<section class="card" id="im-ref-card">'
     +'  <h2 style="font-size:1rem;margin:0 0 4px">담당 영업실장</h2>'
     +'  <p class="note" id="im-ref-msg" style="margin:0 0 10px">소개해 주신 분이 있으면 적어 주세요. 없으면 비워 두셔도 됩니다.</p>'
     +'  <div id="im-ref-input" style="display:none">'
     +'    <input class="inp" id="im-ref-code" placeholder="영업실장 코드 또는 성함" autocomplete="off" style="max-width:320px">'
     +'  </div>'
     +'</section>';
  }
  function render(name){
    if(!msg)return;
    if(name){
      msg.innerHTML='<b style="color:#1E47C0">'+esc(name)+'</b> 님을 통해 오셨습니다. '
        +'<a href="#" id="im-ref-change" style="color:#5B6A82">아니라면 여기를 눌러 주세요</a>';
      wrap.style.display='none';
      var a=document.getElementById('im-ref-change');
      if(a)a.addEventListener('click',function(e){
        e.preventDefault(); CODE=null; typed=null; FROM=null;
        try{ localStorage.removeItem(KEY); }catch(x){}
        msg.textContent='소개해 주신 분이 있으면 적어 주세요. 없으면 비워 두셔도 됩니다.';
        wrap.style.display=''; inp.value=''; inp.focus();
      });
    }else{
      wrap.style.display='';
    }
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function mount(){
    if(!document.getElementById('f_consent'))return;          /* 신청서가 아니면 안 붙임 */
    var anchor=document.querySelector('.submit');
    var consent=document.getElementById('f_consent');
    var card=consent.closest('section')||consent.closest('.card');
    var target=card||anchor; if(!target)return;
    target.insertAdjacentHTML('beforebegin',html());
    box=document.getElementById('im-ref-card');
    msg=document.getElementById('im-ref-msg');
    wrap=document.getElementById('im-ref-input');
    inp=document.getElementById('im-ref-code');

    if(CODE){
      msg.textContent='확인 중…'; wrap.style.display='none';
      nameOf(CODE).then(function(n){
        if(n){ render(n); }
        else{ CODE=null; FROM=null;    /* 없는 코드면 없던 일로 */
              msg.textContent='소개해 주신 분이 있으면 적어 주세요. 없으면 비워 두셔도 됩니다.';
              wrap.style.display=''; }
      });
    }
    /* 직접 적은 코드도 확인해 줍니다 (오타를 그 자리에서 알 수 있게)
       🔴 조회가 늦게 끝나면 «먼저 친 코드의 답»이 나중에 덮어쓸 수 있습니다.
          그래서 몇 번째 조회인지 세어 두고, 마지막 것만 화면에 씁니다. */
    var t=null, seq=0;
    inp.addEventListener('input',function(){
      typed=inp.value.trim()||null;
      clearTimeout(t);
      var mine=++seq;
      if(!typed){msg.textContent='소개해 주신 분이 있으면 적어 주세요. 없으면 비워 두셔도 됩니다.';return;}
      t=setTimeout(function(){
        var asked=typed;
        nameOf(asked).then(function(n){
          if(mine!==seq)return;                     /* 그 사이 더 친 글자가 있으면 버립니다 */
          msg.innerHTML = n
            ? '<b style="color:#1E47C0">'+esc(n)+'</b> 님으로 접수됩니다.'
            : '<span style="color:#96631C">확인되지 않는 코드입니다.</span> 그대로 보내셔도 되고, 저희가 확인해 연결해 드립니다.';
        });
      },350);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();

  /* ---------- 신청서에서 쓰는 값 ---------- */
  window.IMRef={
    /* 저장할 때 :  Object.assign(row, IMRef.values()) */
    values:function(){
      var code = typed || CODE;
      if(!code)return {};
      return { ref_code: code, ref_source: (typed && typed!==CODE) ? 'form' : (FROM||'form') };
    },
    code:function(){ return typed || CODE || null; },
    nameOf:nameOf
  };
})();
