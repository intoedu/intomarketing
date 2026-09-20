/* ──────────────────────────────────────────────────────────────
   신청서 공통 동작 — apply/design · video · blog · sns 가 같이 씁니다.

   각 신청서는 «내용만» 적으면 됩니다. 표시가 붙은 칸을 알아서 모읍니다.
     data-col="academy_name"   requests 표의 그 칸으로 바로 들어감
     data-q="물음 이름"          details(jsonb) 안에 그 이름으로 들어감
     data-multi                  여러 개 고르는 묶음 (체크박스)
     data-one                    하나만 고르는 묶음 (라디오)
     data-qty="이름"             수량 칸. 0이면 안 담음
     data-req="사람에게 보일 이름"  비어 있으면 못 내게 막음

   🔴 금액·입금·담당자·단계는 넣지 않습니다.
      바깥에서 못 넣게 DB 규칙이 막고 있고, 관리자가 채웁니다.
   ────────────────────────────────────────────────────────────── */
(function(){
"use strict";
var SB_URL="https://qkvebwxewttqtcryfycy.supabase.co";
var SB_KEY="sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa";
var sb=(window.supabase&&window.supabase.createClient)?window.supabase.createClient(SB_URL,SB_KEY):null;
function $(id){return document.getElementById(id);}

/* ── 고르면 표시 ── */
function paintPicks(box){
  box.querySelectorAll('.pick').forEach(function(p){
    var i=p.querySelector('input'); if(i)p.classList.toggle('on',i.checked);
  });
}
document.querySelectorAll('.picks').forEach(function(box){
  box.addEventListener('change',function(){paintPicks(box);});
});
document.querySelectorAll('.chips').forEach(function(box){
  box.addEventListener('change',function(e){
    var i=e.target; if(!i||i.tagName!=='INPUT')return;
    if(i.type==='radio'){
      box.querySelectorAll('.chip').forEach(function(c){
        var x=c.querySelector('input'); c.classList.toggle('on',!!(x&&x.checked));
      });
    }else{
      var c=i.closest('.chip'); if(c)c.classList.toggle('on',i.checked);
    }
  });
});

/* ── 수량 단추 ── */
document.querySelectorAll('.qty').forEach(function(q){
  var inp=q.querySelector('input');
  q.querySelectorAll('button').forEach(function(b){
    b.type='button';
    b.addEventListener('click',function(){
      var v=Number(inp.value||0)+(b.dataset.d==='+'?1:-1);
      var lo=Number(inp.min||0), hi=Number(inp.max||99);
      if(v<lo)v=lo; if(v>hi)v=hi;
      inp.value=v;
    });
  });
});

/* ── 값 읽기 ── */
function readOne(box){
  var el=box.querySelector('input:checked');
  return el?el.value:'';
}
function readMulti(box){
  return [].slice.call(box.querySelectorAll('input:checked')).map(function(i){return i.value;});
}

/* ── 모으기 ── */
function collect(form){
  var cols={}, details={}, missing=null;

  /* 표의 칸으로 바로 가는 것 */
  form.querySelectorAll('[data-col]').forEach(function(el){
    var v=(el.value||'').trim();
    cols[el.dataset.col]=v||null;
    if(!v && el.dataset.req && !missing) missing={el:el, name:el.dataset.req};
  });

  /* details 로 가는 것 */
  form.querySelectorAll('[data-q]').forEach(function(el){
    var q=el.dataset.q, v='';
    if(el.hasAttribute('data-multi'))      v=readMulti(el).join(', ');
    else if(el.hasAttribute('data-one'))   v=readOne(el);
    else                                   v=(el.value||'').trim();
    if(!v && el.dataset.req && !missing) missing={el:el, name:el.dataset.req};
    if(v) details[q]=v;
  });

  /* 수량 칸 — 0이면 안 담습니다 */
  form.querySelectorAll('[data-qty]').forEach(function(el){
    var inp=el.querySelector('input[type=number]');
    var n=Number(inp&&inp.value||0);
    if(n>0) details[el.dataset.qty]=n+'개';
  });

  return {cols:cols, details:details, missing:missing};
}

/* ── 내기 ── */
var form=$('form');
if(form) form.addEventListener('submit',async function(e){
  e.preventDefault();
  var err=$('err'), btn=$('btn');
  err.textContent='';

  var got=collect(form);
  if(got.missing){
    err.textContent='「'+got.missing.name+'」을(를) 적거나 골라 주세요.';
    try{
      got.missing.el.scrollIntoView({block:'center',behavior:'smooth'});
      if(got.missing.el.focus) got.missing.el.focus({preventScroll:true});
    }catch(x){}
    return;
  }
  if(!$('f_consent').checked){err.textContent='개인정보 수집·이용에 동의해 주셔야 접수됩니다.';return;}
  if(!sb){err.textContent='연결이 안 됩니다. 잠시 뒤 다시 시도해 주세요.';return;}

  btn.disabled=true; btn.textContent='보내는 중...';
  var row={
    area:   form.dataset.area || '제작',
    center: 'mkt',
    kind:   form.dataset.kind,
    consent:true,
    details:got.details
  };
  Object.keys(got.cols).forEach(function(k){ row[k]=got.cols[k]; });

  var res=await sb.from('requests').insert(row);
  if(res.error){
    btn.disabled=false; btn.textContent=btn.dataset.label||'신청서 제출 ↗';
    err.textContent='제출에 실패했습니다: '+res.error.message
      +' — 010-7318-1790 으로 연락 주시면 바로 도와드리겠습니다.';
    return;
  }
  form.style.display='none';
  $('done').style.display='';
  window.scrollTo({top:0,behavior:'smooth'});
});
})();
