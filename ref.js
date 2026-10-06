/* 신청서 공통 칸 (2026-09-30)
   ─────────────────────────────────────────────────────────────
   신청서 화면에 아래 두 칸을 «저절로» 붙입니다. 신청서 HTML 은 고치지 않습니다
   (#f_consent 가 있으면 신청서로 봅니다 — 새 신청서를 만들어도 그대로 붙습니다).

     ① 기관 등록증   — 등록증 종류 + 등록증 번호
     ② 담당 영업실장 — 이름을 직접 적고, 두 글자부터 «추천 목록»이 뜹니다

   · 실장 전용 링크(...?p=코드)로 들어오면 칸에 이름을 미리 채워 둡니다 (지우고 고칠 수 있습니다).
   🔴 화면에서 보내는 값은 «글자»뿐입니다. 실제로 어느 실장에게 붙일지는 서버가 코드로 찾습니다
      (DB 트리거 t_request_fill_partner). 남의 코드를 적어 보내도 소용없습니다.

   쓰는 법
     <script src="/ref.js"></script>            ← supabase-js 다음, 신청서 코드보다 먼저
     저장할 때 :  Object.assign(row, IMRef.values());
                  Object.assign(row.details, IMRef.extraDetails());
*/
(function(){
  var KEY='im_ref', DAYS=90;
  var SB_URL="https://qkvebwxewttqtcryfycy.supabase.co";
  var SB_KEY="sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa";

  /* ---------- 실장 코드 기억 ---------- */
  function save(code){ try{ localStorage.setItem(KEY, JSON.stringify({code:code, at:Date.now()})); }catch(e){} }
  function load(){
    try{
      var v=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!v||!v.code)return null;
      if(Date.now()-(v.at||0) > DAYS*24*60*60*1000){localStorage.removeItem(KEY);return null;}
      return v.code;
    }catch(e){ return null; }
  }
  var urlCode=null;
  try{
    var q=new URLSearchParams(location.search);
    urlCode=(q.get('p')||q.get('ref')||'').trim() || null;
  }catch(e){}
  if(urlCode) save(urlCode);
  var LINK_CODE = urlCode || load();      /* 링크로 들어온 코드 (있을 때만) */

  var PICKED=null;   /* 추천 목록에서 고른 것 {name, code} */
  var TYPED='';      /* 손님이 친 글자 */

  /* ---------- 서버 ----------
     🔴 supabase-js 클라이언트를 여기서 또 만들지 마세요.
        신청서가 이미 하나 만들어 쓰고 있어서, 두 개가 되면 로그인 저장소를 서로 기다립니다
        (콘솔 「Multiple GoTrueClient」 경고). 실제로 추천이 뜨는 데 «16초» 걸렸습니다.
        이 칸들은 로그인이 필요 없으므로 그냥 물어보기(fetch)만 합니다. */
  async function rpc(name, body){
    try{
      var r=await fetch(SB_URL+'/rest/v1/rpc/'+name,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY},
        body:JSON.stringify(body)
      });
      if(!r.ok)return null;
      return await r.json();
    }catch(e){ return null; }
  }
  async function nameOf(code){
    if(!code)return null;
    var d=await rpc('partner_name',{p_code:code});
    return (typeof d==='string'&&d)?d:null;
  }
  async function suggest(q){
    var d=await rpc('partner_suggest',{p_q:q});
    return Array.isArray(d)?d:[];
  }

  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  /* ---------- 화면 ---------- */
  var CSS=''
   +'.im-x{position:relative}'
   +'.im-sug{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:40;background:#fff;'
   +'border:1px solid #DFE6F1;border-radius:10px;box-shadow:0 12px 30px rgba(16,32,64,.12);overflow:hidden;display:none}'
   +'.im-sug.on{display:block}'
   +'.im-sug button{display:block;width:100%;text-align:left;border:0;background:none;padding:11px 14px;'
   +'font:inherit;cursor:pointer;border-bottom:1px solid #EFF3F9}'
   +'.im-sug button:last-child{border-bottom:0}'
   +'.im-sug button:hover,.im-sug button.on{background:#EFF3F9}'
   +'.im-sug .c{color:#5B6A82;font-size:.82em;margin-left:6px}'
   +'.im-hint{font-size:13px;color:#5B6A82;margin:8px 0 0;line-height:1.7}';

  function html(){
    return ''
    /* ① 기관 등록증 */
    +'<section class="card" id="im-biz-card">'
    +'  <h2 style="font-size:1rem;margin:0 0 4px">사업자 정보</h2>'
    +'  <p class="im-hint" style="margin:0 0 12px">세금계산서·계약서에 쓰는 정보입니다. 아직 없으시면 비워 두셔도 됩니다.</p>'
    +'  <div class="g2">'
    +'    <div class="fld"><label for="im-biz-kind">등록증 종류</label>'
    +'      <select class="inp" id="im-biz-kind">'
    +'        <option value="">선택해 주세요</option>'
    +'        <option>사업자등록증</option><option>법인등록증</option><option>고유번호증</option>'
    +'        <option>학교인가증</option><option>개인사업자등록증</option>'
    +'      </select></div>'
    +'    <div class="fld"><label for="im-biz-no">기관 등록증 번호</label>'
    +'      <input class="inp" id="im-biz-no" inputmode="numeric" placeholder="000-00-00000" autocomplete="off"></div>'
    +'  </div>'
    +'</section>'
    /* ② 담당 영업실장 */
    +'<section class="card" id="im-ref-card">'
    +'  <h2 style="font-size:1rem;margin:0 0 4px">담당 영업실장</h2>'
    +'  <p class="im-hint" style="margin:0 0 12px">소개해 주신 분이 있으면 성함을 적어 주세요. 없으면 비워 두셔도 됩니다.</p>'
    +'  <div class="im-x fld" style="max-width:340px;margin:0">'
    /* 🔴 aria-label — 이 칸만 .fld 바깥이라 form.js 의 이름표 묶기가 닿지 않습니다.
          없으면 음성으로 읽는 분에게 그냥 「편집」이라고만 들립니다. */
    +'    <input class="inp" id="im-ref-name" aria-label="담당 영업실장 성함"'
    +'           placeholder="성함을 적어 주세요" autocomplete="off">'
    +'    <div class="im-sug" id="im-ref-sug"></div>'
    +'  </div>'
    +'  <p class="im-hint" id="im-ref-msg"></p>'
    +'</section>';
  }

  var inp, sug, msg, kind, bizno, items=[], cur=-1, timer=null;

  function closeSug(){ sug.classList.remove('on'); sug.innerHTML=''; items=[]; cur=-1; }
  function drawSug(list){
    items=list||[];
    if(!items.length){ closeSug(); return; }
    sug.innerHTML=items.map(function(x,i){
      return '<button type="button" data-i="'+i+'">'+esc(x.name)+'<span class="c">'+esc(x.code)+'</span></button>';
    }).join('');
    sug.classList.add('on'); cur=-1;
    sug.querySelectorAll('button').forEach(function(b){
      /* mousedown 으로 잡습니다 — click 은 칸에서 포커스가 빠진 뒤라 목록이 먼저 닫힙니다 */
      b.addEventListener('mousedown',function(e){ e.preventDefault(); pick(items[Number(b.dataset.i)]); });
    });
  }
  function pick(x){
    if(!x)return;
    PICKED={name:x.name, code:x.code};
    TYPED=x.name; inp.value=x.name;
    msg.innerHTML='<b style="color:#1E47C0">'+esc(x.name)+'</b> 님으로 접수됩니다.';
    closeSug();
  }
  function markCur(){
    sug.querySelectorAll('button').forEach(function(b,i){ b.classList.toggle('on', i===cur); });
  }

  function mount(){
    if(!document.getElementById('f_consent'))return;              /* 신청서가 아니면 안 붙임 */
    var consent=document.getElementById('f_consent');
    var target=consent.closest('section')||consent.closest('.card')||document.querySelector('.submit');
    if(!target)return;
    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
    target.insertAdjacentHTML('beforebegin', html());

    inp=document.getElementById('im-ref-name');
    sug=document.getElementById('im-ref-sug');
    msg=document.getElementById('im-ref-msg');
    kind=document.getElementById('im-biz-kind');
    bizno=document.getElementById('im-biz-no');

    /* 링크로 들어왔으면 이름을 미리 채워 둡니다 (지우고 고칠 수 있습니다) */
    if(LINK_CODE){
      nameOf(LINK_CODE).then(function(n){
        if(!n)return;
        if(inp.value.trim())return;                 /* 손님이 벌써 적고 있으면 건드리지 않습니다 */
        PICKED={name:n, code:LINK_CODE}; TYPED=n; inp.value=n;
        msg.innerHTML='<b style="color:#1E47C0">'+esc(n)+'</b> 님을 통해 오셨습니다. 다르면 지우고 다시 적어 주세요.';
      });
    }

    inp.addEventListener('input',function(){
      TYPED=inp.value.trim();
      PICKED=null;                                   /* 고른 뒤 글자를 고치면 고른 것은 취소 */
      msg.textContent='';
      clearTimeout(timer);
      if(TYPED.length<2){ closeSug(); return; }
      var asked=TYPED;
      timer=setTimeout(function(){
        suggest(asked).then(function(list){
          /* 🔴 답이 늦게 오는 사이 글자가 바뀌었으면 버립니다.
                «칸에 지금 적힌 글자»와 비교합니다 — 몇 번째 조회인지 세는 방식보다 확실합니다. */
          if(inp.value.trim()!==asked)return;
          drawSug(list);
          msg.textContent = list.length ? ''
            : '명단에 없는 이름입니다. 그대로 보내셔도 되고, 저희가 확인해 연결해 드립니다.';
        });
      },250);
    });
    inp.addEventListener('keydown',function(e){
      if(!items.length)return;
      if(e.key==='ArrowDown'){ e.preventDefault(); cur=(cur+1)%items.length; markCur(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); cur=(cur<=0?items.length:cur)-1; markCur(); }
      else if(e.key==='Enter'){ if(cur>=0){ e.preventDefault(); pick(items[cur]); } }
      else if(e.key==='Escape'){ closeSug(); }
    });
    inp.addEventListener('blur',function(){ setTimeout(closeSug,120); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();

  /* ---------- 신청서에서 쓰는 값 ---------- */
  window.IMRef={
    /* 저장할 때 :  Object.assign(row, IMRef.values()) */
    values:function(){
      if(PICKED&&PICKED.code)                       /* 목록에서 고른 경우 — 코드로 정확히 붙습니다 */
        return { ref_code: PICKED.code, ref_source: (LINK_CODE===PICKED.code)?'link':'form' };
      if(TYPED)                                     /* 직접 적은 이름 — 관리자가 보고 연결합니다 */
        return { ref_code: TYPED, ref_source:'form' };
      return {};
    },
    /* 저장할 때 :  Object.assign(row.details, IMRef.extraDetails()) */
    extraDetails:function(){
      var d={};
      if(kind&&kind.value)d['등록증 종류']=kind.value;
      if(bizno&&bizno.value.trim())d['기관 등록증 번호']=bizno.value.trim();
      return d;
    },
    code:function(){ return (PICKED&&PICKED.code)||TYPED||null; },
    nameOf:nameOf
  };
})();
