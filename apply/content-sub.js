/* ──────────────────────────────────────────────────────────────
   정기 콘텐츠 — 세 팀이 함께 파는 «하나의» 상품 (2026-10-07)

   무엇인가
     월 ○개 콘텐츠를 만들어 올리고 채널을 관리하는 서비스입니다.
     SNS 신청서에서 신청할 수도 있고, 영상·디자인 신청서에서 신청할 수도 있습니다.
     어디서 넣든 결과물은 같습니다.

   🔴 신청은 «1건»입니다
      영상에서 정기 콘텐츠를 같이 신청하면 requests 한 줄에 다 들어갑니다.
      돈(견적·계약·결제·정산)은 영상/디자인 쪽에서 처리하고,
      SNS 쪽 어드민은 «작업에 필요한 정보»만 봅니다. 건을 둘로 쪼개지 마세요.

   🔴 한 번 신청하면 다시 묻지 않습니다
      my_content_sub() 로 먼저 확인해서, 이미 있으면 「월 ○개로 신청되어 있습니다」만
      보여 줍니다. 영상에서 신청하고 나중에 SNS 신청서를 또 쓰는 일이 없어야 합니다.

   🔴 계정 아이디 · 비밀번호는 «절대» 여기서 받지 않습니다
      신청서로 받으면 DB 에 그대로 남습니다. SNS 담당자가 따로 받습니다.

   🔴 「영상 · 디자인을 올리면 SNS 관리비 10% 할인」은 «없어졌습니다» (2026-10-13 결정).
      2026-10-07 에 넣었던 것인데, 팀 최종 매뉴얼에서 할인을 두 가지로만 정리했습니다.
        · 장기 계약 할인  — 정기 콘텐츠 3개월 10% · 6개월 20% (일시불 선결제)
        · 세팅비 할인     — 정기 콘텐츠 3개월 이상 계약 시 메인 세팅비 165,000 할인
      여기에 할인 문구를 다시 넣지 마세요. 금액은 견적서에서 정합니다.
      (서버 my_content_sub() 가 돌려주는 discount 값은 남아 있지만 아무도 읽지 않습니다.)

   쓰는 법 — 신청서에 자리만 만들어 두면 됩니다
     <div id="content-sub" data-label="영상"></div>
     <script src="../content-sub.js"></script>
   ────────────────────────────────────────────────────────────── */
(function(){
"use strict";

var sb=null, state=null;

/* 🔴 정기 콘텐츠로 올리는 곳만 적습니다 (가격·환불-모음 1012 · 1-5).
      지도 · 틱톡 · 페이스북 · 스레드는 정기 콘텐츠 상품이 아닙니다. */
var CHANNELS=['인스타그램','네이버 블로그 (공식 블로그)','유튜브 쇼츠 · 인스타 릴스','유튜브 롱폼'];
var TYPES=['사진 게시물','카드뉴스','숏폼 영상','긴 영상','블로그 글'];
var SHOOT=['현장 촬영 필요','사진 직접 제공','상의해서 결정'];

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

function chips(name, list, multi){
  return list.map(function(v){
    return '<label class="chip"><input type="'+(multi?'checkbox':'radio')+'"'
         + (multi?'':' name="'+name+'"')+' value="'+esc(v)+'">'+esc(v)+'</label>';
  }).join('');
}

/* 이미 신청되어 있을 때 */
function already(s){
  var from = s.kind ? ('「'+esc(s.kind)+'」 신청서에서 ') : '';
  return ''
  + '<section class="card">'
  +   '<p class="eyebrow">Monthly</p>'
  +   '<h2>정기 콘텐츠 · 채널 관리</h2>'
  +   '<div class="note">'
  +     '<b>이미 신청되어 있습니다.</b><br>'
  +     (s.monthly ? ('월 <b>'+esc(s.monthly)+'개</b>로 신청되어 있습니다. ') : '')
  +     from + '접수된 건입니다.<br>'
  +     '이 신청서에서 다시 신청할 필요가 없습니다. '
  +     '수량 변경은 담당자에게 요청해 주십시오.'
  +   '</div>'
  + '</section>';
}

/* 아직 신청 안 했을 때 */
function offer(kindLabel){
  return ''
  + '<section class="card">'
  +   '<p class="eyebrow">Monthly</p>'
  +   '<h2>정기 콘텐츠 · 채널 관리 <span class="hint">(해당 시)</span></h2>'
  +   '<p class="sub">제작한 콘텐츠를 <b>매월 업로드하고 채널을 관리</b>합니다. '
  +     '위의 1회성 옵션과 달리 <b>매월 발생하는 요금</b>이며 계약서를 함께 작성합니다.</p>'
  +   '<div class="chips" style="margin-bottom:4px">'
  +     '<label class="chip"><input type="checkbox" id="cs-on">정기 콘텐츠도 함께 신청합니다</label>'
  +   '</div>'
  +   '<div class="note" style="margin-top:16px">'
  +     '기본 운영비 <b>월 132,000원</b>에 업로드 건수만큼 합산하는 방식입니다. '
  +     '3개월 이상 계약 시 <b>장기 계약 할인</b>이 적용됩니다. 금액은 견적서로 안내합니다.'
  +   '</div>'
  +   '<div id="cs-body" style="display:none;margin-top:24px;'
  +        'border-top:1px solid var(--line);padding-top:24px">'
  +     '<div class="fld"><label>업로드 채널 <span class="req">*</span></label>'
  +       '<div class="chips" id="cs-ch">'+chips('cs_ch',CHANNELS,true)+'</div></div>'
  +     '<div class="fld"><label for="cs-mo">월 콘텐츠 수 <span class="req">*</span></label>'
  +       '<input class="inp" id="cs-mo" inputmode="numeric" placeholder="예: 8"></div>'
  +     '<div class="fld"><label for="cs-mo2">채널별 수량 (선택)</label>'
  +       '<input class="inp" id="cs-mo2" placeholder="예: 인스타 8개 + 유튜브 2편"></div>'
  +     '<div class="fld"><label>콘텐츠 종류</label>'
  +       '<div class="chips" id="cs-ty">'+chips('cs_ty',TYPES,true)+'</div></div>'
  +     '<div class="fld"><label>촬영 필요 여부</label>'
  +       '<div class="chips" id="cs-sh">'+chips('cs_sh',SHOOT,false)+'</div></div>'
  +     '<div class="note">'
  +       '🔴 <b>계정 아이디와 비밀번호는 여기에 입력하지 마십시오.</b><br>'
  +       '담당자가 별도로 받습니다. 신청서에 입력하면 그대로 저장됩니다.'
  +     '</div>'
  +   '</div>'
  + '</section>';
}

function paintPick(box){
  if(!box) return;
  box.querySelectorAll('.chip').forEach(function(c){
    var i=c.querySelector('input'); if(i) c.classList.toggle('on', i.checked);
  });
}

async function render(){
  var slot=document.getElementById('content-sub');
  var have=document.getElementById('cs-have');     /* SNS 신청서용 알림 자리 */
  if(!slot && !have) return;
  /* 🔴 SNS 신청서에는 slot 이 없고 have 만 있습니다. slot.dataset 을 그냥 읽으면
        오류가 나면서 아래 안내까지 통째로 안 뜹니다(2026-10-07 고침). */
  var kindLabel=(slot && slot.dataset.label) || '콘텐츠';

  /* 로그인 전에는 상태를 알 수 없습니다 — 그때는 신청할 수 있는 모습으로 둡니다 */
  if(sb){
    try{
      var u=await sb.auth.getUser();
      if(u && u.data && u.data.user){
        var r=await sb.rpc('my_content_sub');
        if(!r.error && r.data) state=r.data;
      }
    }catch(e){}
  }

  /* SNS 신청서 — 이미 있으면 알려만 주고, 없으면 원래 칸을 그대로 씁니다 */
  if(have){
    if(state && state.active){
      have.style.display='';
      have.innerHTML='<b>이미 신청되어 있습니다.</b><br>'
        + (state.monthly ? ('월 <b>'+esc(state.monthly)+'개</b>로 신청되어 있습니다. ') : '')
        + (state.kind ? ('「'+esc(state.kind)+'」 신청서에서 ') : '') + '접수된 건입니다.<br>'
        + '아래 항목은 다시 입력할 필요가 없습니다. 수량 변경은 담당자에게 요청해 주십시오.';
    }else{
      have.style.display='none';
    }
    if(!slot) return;
  }

  if(state && state.active){ slot.innerHTML=already(state); return; }

  slot.innerHTML=offer(kindLabel);
  var on=document.getElementById('cs-on'), body=document.getElementById('cs-body');
  on.addEventListener('change', function(){
    body.style.display = on.checked ? '' : 'none';
    paintPick(on.closest('.chips'));
  });
  ['cs-ch','cs-ty','cs-sh'].forEach(function(id){
    var b=document.getElementById(id);
    if(b) b.addEventListener('change', function(){ paintPick(b); });
  });
}

window.IMContentSub = {
  init:function(client){ sb=client; render(); },

  /* 이미 신청되어 있는가 (신청서가 다시 묻지 않게) */
  active:function(){ return !!(state && state.active); },

  /* 제출할 때 붙일 값. 안 골랐으면 null 을 돌려줍니다. */
  values:function(){
    if(this.active()) return null;              /* 이미 있으면 또 넣지 않습니다 */
    var on=document.getElementById('cs-on');
    if(!on || !on.checked) return null;
    function many(id){
      var b=document.getElementById(id); if(!b) return [];
      return [].slice.call(b.querySelectorAll('input:checked')).map(function(i){return i.value;});
    }
    function one(id){
      var b=document.getElementById(id); if(!b) return '';
      var i=b.querySelector('input:checked'); return i?i.value:'';
    }
    var mo=parseInt((document.getElementById('cs-mo')||{}).value,10);
    return {
      content_sub:true,
      content_monthly: isNaN(mo)?null:mo,
      content_info:{
        '채널': many('cs-ch'),
        '콘텐츠 종류': many('cs-ty'),
        '촬영 필요': one('cs-sh'),
        '월 콘텐츠 수': (document.getElementById('cs-mo2')||{}).value || ''
        /* 🔴 아이디·비밀번호 칸은 «일부러» 없습니다. 추가하지 마세요. */
      }
    };
  },

  /* 덜 채운 곳이 있으면 알려 줍니다 (제출 막기용) */
  missing:function(){
    var v=this.values(); if(!v) return null;
    if(!v.content_info['채널'].length) return {name:'올릴 채널', el:document.getElementById('cs-ch')};
    if(!v.content_monthly)             return {name:'월 콘텐츠 개수', el:document.getElementById('cs-mo')};
    return null;
  },

  /* 로그인 뒤 상태가 달라질 수 있어 다시 그립니다.
     🔴 화면을 «다시 그리므로» 고른 것이 지워집니다. 제출 직전에 부르지 마세요 — check() 를 쓰세요. */
  refresh:function(){ state=null; return render(); },

  /* 화면은 그대로 두고 «상태만» 다시 봅니다. 제출 직전에 쓰는 것은 이쪽입니다.
     🔴 전에 여기서 refresh() 를 불렀다가, 손님이 고른 채널·개수가 지워져
        정기 콘텐츠가 통째로 안 담기는 일이 있었습니다(2026-10-07 고침). */
  check:async function(){
    if(!sb) return false;
    try{
      var u=await sb.auth.getUser();
      if(!u || !u.data || !u.data.user) return false;
      var r=await sb.rpc('my_content_sub');
      if(!r.error && r.data) state=r.data;
    }catch(e){}
    return !!(state && state.active);
  }
};
})();
