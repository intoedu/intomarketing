'use strict';

/**
 * 게시판 예시 글에 붙일 도안을 만듭니다.
 *   node tools/make-sample-art.js
 *
 * 사진이 아니라 그림입니다 — 없는 물건을 사진처럼 꾸며 보이면
 * 보는 분이 실제 매물로 오해하므로, 브랜드 색으로 그린 도안만 씁니다.
 * 카드가 4:3(게시판)과 3:4(집회 포스터)로 잘라 쓰므로 그 비율로 냅니다.
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'img', 'sample');

/* 홈페이지와 같은 색을 씁니다 (assets/css/style.css 의 --brand-*) */
const C = {
  ink: '#12301F',
  deep: '#1B4D2E',
  mid: '#1F7A44',
  soft: '#D3EBDB',
  pale: '#F2F9F4',
  gold: '#F2C82F',
  line: '#9DBCA8',
  white: '#FFFFFF',
};

const KO = "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";

/** 4:3 타일 — 위쪽에 그림, 아래쪽에 이름 한 줄 */
function tile(motif, caption) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="${esc(caption)}">
  <rect width="1200" height="900" fill="${C.pale}"/>
  <circle cx="1040" cy="140" r="210" fill="${C.soft}" opacity=".55"/>
  <circle cx="150" cy="820" r="160" fill="${C.soft}" opacity=".4"/>
  <g transform="translate(600 400)" fill="none" stroke="${C.deep}" stroke-width="9"
     stroke-linecap="round" stroke-linejoin="round">${motif}</g>
  <rect x="0" y="762" width="1200" height="138" fill="${C.ink}"/>
  <text x="64" y="848" font-family="${KO}" font-size="52" font-weight="700" fill="${C.white}">${esc(caption)}</text>
</svg>
`;
}

/** 3:4 포스터 — 집회용. 제목을 크게 세워 실제 포스터처럼 보이게 합니다. */
function poster(o) {
  const lines = wrap(o.title, 9).slice(0, 3);
  const start = 470 - (lines.length - 1) * 46;
  const title = lines
    .map((t, i) => `<tspan x="90" y="${start + i * 92}">${esc(t)}</tspan>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" width="900" height="1200" role="img" aria-label="${esc(o.title)}">
  <rect width="900" height="1200" fill="${C.ink}"/>
  <circle cx="740" cy="205" r="260" fill="${C.deep}"/>
  <circle cx="740" cy="205" r="150" fill="none" stroke="${C.gold}" stroke-width="6" opacity=".7"/>
  <g transform="translate(150 900)" fill="none" stroke="${C.deep}" stroke-width="10" opacity=".85"
     stroke-linecap="round">${o.motif || ''}</g>
  <text x="90" y="150" font-family="${KO}" font-size="30" font-weight="700"
        letter-spacing="6" fill="${C.gold}">${esc(o.kicker)}</text>
  <text font-family="${KO}" font-size="76" font-weight="800" fill="${C.white}"
        letter-spacing="-2">${title}</text>
  <rect x="90" y="${start + lines.length * 92 - 40}" width="96" height="8" fill="${C.gold}"/>
  <text x="90" y="${start + lines.length * 92 + 46}" font-family="${KO}" font-size="34"
        fill="${C.soft}">${esc(o.host)}</text>
  <text x="90" y="1090" font-family="${KO}" font-size="32" font-weight="700" fill="${C.white}">${esc(o.venue)}</text>
  <text x="90" y="1140" font-family="${KO}" font-size="28" fill="${C.line}">${esc(o.when)}</text>
</svg>
`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 제목을 글자 수로 끊어 줄바꿈합니다 (한글은 폭이 고르므로 글자 수로 충분합니다) */
function wrap(s, n) {
  const words = String(s).split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= n) cur += ' ' + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------- 그림 조각 (가운데 0,0 기준) ---------- */
const M = {
  // 예배실 — 강대상과 의자 줄
  sanctuary: `<path d="M-250-150h500M-250-150v260M250-150v260"/>
    <path d="M-60 40h120v70h-120z" fill="${C.soft}"/>
    <path d="M0-20v-90M-40-70h80"/>
    <path d="M-250 150h500M-250 210h500M-250 270h500"/>`,
  // 교육관 — 칠판과 책상
  classroom: `<rect x="-240" y="-180" width="480" height="230" rx="10" fill="${C.soft}"/>
    <path d="M-180-110h240M-180-50h150"/>
    <rect x="-230" y="120" width="180" height="90" rx="8"/>
    <rect x="50" y="120" width="180" height="90" rx="8"/>`,
  // 건물 외관
  building: `<path d="M-230 250v-330l230-160 230 160v330z"/>
    <path d="M0-260v-70M-34-294h68"/>
    <rect x="-140" y="-40" width="90" height="90"/>
    <rect x="50" y="-40" width="90" height="90"/>
    <rect x="-55" y="110" width="110" height="140"/>`,
  // 기도실
  prayer: `<circle cx="0" cy="-40" r="120"/>
    <path d="M0-160v240M-60-100l120 120M60-100l-120 120" opacity=".5"/>
    <path d="M-230 190h460M-190 250h380"/>`,
  // 스피커
  speaker: `<rect x="-130" y="-230" width="260" height="460" rx="18"/>
    <circle cx="0" cy="-110" r="52"/><circle cx="0" cy="90" r="96"/><circle cx="0" cy="90" r="34"/>`,
  // 마이크
  mic: `<rect x="-52" y="-230" width="104" height="200" rx="52"/>
    <path d="M-110-70a110 110 0 0 0 220 0"/><path d="M0 40v120M-80 160h160"/>`,
  // 건반
  piano: `<rect x="-260" y="-90" width="520" height="200" rx="10"/>
    <path d="M-156-90v200M-52-90v200M52-90v200M156-90v200"/>
    <rect x="-200" y="-90" width="56" height="120" fill="${C.deep}"/>
    <rect x="-96" y="-90" width="56" height="120" fill="${C.deep}"/>
    <rect x="112" y="-90" width="56" height="120" fill="${C.deep}"/>`,
  // 프로젝터와 스크린
  projector: `<rect x="-250" y="-220" width="500" height="230" rx="10" fill="${C.soft}"/>
    <rect x="-140" y="80" width="280" height="130" rx="14"/>
    <circle cx="-60" cy="145" r="38"/><path d="M60 120h50M60 170h50"/>`,
  // 무대 조명
  light: `<path d="M-120-190h240l60 150h-360z"/>
    <path d="M0 40v170M-90 210h180"/>
    <path d="M-190-40l-70 130M190-40l70 130M0-40v150" opacity=".45"/>`,
  // 장의자
  pew: `<path d="M-260-60h520M-260 40h520"/>
    <path d="M-260-120v260M260-120v260M-90-60v100M90-60v100"/>`,
  // 복합기
  printer: `<rect x="-200" y="-180" width="400" height="120" rx="10"/>
    <rect x="-230" y="-60" width="460" height="170" rx="14"/>
    <rect x="-140" y="110" width="280" height="110" rx="8" fill="${C.soft}"/>
    <circle cx="150" cy="20" r="18"/>`,
  // 가스레인지
  stove: `<rect x="-240" y="-140" width="480" height="300" rx="14"/>
    <circle cx="-110" cy="-40" r="62"/><circle cx="110" cy="-40" r="62"/>
    <circle cx="-110" cy="90" r="42"/><circle cx="110" cy="90" r="42"/>
    <path d="M-240 200h480"/>`,
  // 유아부 교구
  kids: `<rect x="-230" y="20" width="200" height="190" rx="16" fill="${C.soft}"/>
    <rect x="30" y="20" width="200" height="190" rx="16"/>
    <circle cx="-130" cy="-110" r="80"/><path d="M60-190h140v140h-140z"/>`,
  // 성찬기
  cups: `<path d="M-70-160h140l-22 130a48 48 0 0 1-96 0z"/>
    <path d="M0-30v130M-70 100h140"/>
    <path d="M-230 190h460" opacity=".5"/>
    <circle cx="-160" cy="60" r="46"/><circle cx="160" cy="60" r="46"/>`,
  // 원룸
  room: `<rect x="-250" y="-190" width="500" height="380" rx="16"/>
    <rect x="-190" y="30" width="230" height="120" rx="10" fill="${C.soft}"/>
    <path d="M-190 30v-60h100v60"/>
    <rect x="90" y="-120" width="120" height="120" rx="8"/>`,
  // 함께 쓰는 방
  shareroom: `<rect x="-250" y="-180" width="500" height="360" rx="16"/>
    <path d="M0-180v360" stroke-dasharray="22 20"/>
    <rect x="-200" y="40" width="150" height="100" rx="10" fill="${C.soft}"/>
    <rect x="50" y="40" width="150" height="100" rx="10"/>`,
  // 별채 한 채
  cabin: `<path d="M-220 200v-230l220-150 220 150v230z"/>
    <path d="M-280-30l280-190 280 190"/>
    <rect x="-60" y="60" width="120" height="140"/>
    <rect x="-180" y="20" width="80" height="80"/><rect x="100" y="20" width="80" height="80"/>`,
  // 2층 침대
  bunk: `<path d="M-230-200v420M230-200v420"/>
    <rect x="-230" y="-90" width="460" height="40" rx="8" fill="${C.soft}"/>
    <rect x="-230" y="130" width="460" height="40" rx="8" fill="${C.soft}"/>
    <path d="M-160-130h90M-160 90h90"/>`,
  // 포스터용 얕은 무늬
  wave: `<path d="M0 0h600M0 60h600M0 120h480"/>`,
};

/* ---------- 무엇을 만들지 ---------- */
const tiles = [
  ['listing-rent',   M.sanctuary,  '2층 예배 공간 · 65평'],
  ['listing-jeonse', M.classroom,  '교육관 · 소그룹실 3칸'],
  ['listing-sale',   M.building,   '단독 건물 · 사택 포함'],
  ['listing-share',  M.prayer,     '기도실 · 30석'],

  ['market-sound',     M.speaker,   '액티브 스피커 2조'],
  ['market-mic',       M.mic,       '무선 마이크 4채널'],
  ['market-instrument',M.piano,     '디지털 피아노 88건반'],
  ['market-video',     M.projector, '프로젝터 · 스크린'],
  ['market-light',     M.light,     '무대 LED 조명'],
  ['market-furniture', M.pew,       '장의자'],
  ['market-office',    M.printer,   '사무용 복합기'],
  ['market-kitchen',   M.stove,     '업소용 가스레인지'],
  ['market-education', M.kids,      '유아부 매트 · 교구장'],
  ['market-other',     M.cups,      '성찬기 세트'],

  ['guest-private', M.room,      '선교관 독립 원룸'],
  ['guest-share',   M.shareroom, '사택 방 하나'],
  ['guest-whole',   M.cabin,     '수양관 별채 전체'],
  ['guest-dorm',    M.bunk,      '청년 게스트룸'],
];

const posters = [
  ['event-praise',  { kicker: '찬양집회', title: '돌이키라', host: '서문교회 청년부 · 마커스워십', venue: '서문교회 본당', when: '사흘 저녁 · 서울 마포', motif: M.wave }],
  ['event-revival', { kicker: '부흥성회', title: '다시, 처음처럼', host: '한빛교회', venue: '한빛교회 본당', when: '사흘 연속 저녁 7시 30분', motif: M.wave }],
  ['event-camp',    { kicker: '겨울캠프', title: '이 산지를 내게 주소서', host: '산돌교회 중고등부', venue: '산돌수양관 · 강원 홍천', when: '2박 3일 · 버스 운행', motif: M.wave }],
  ['event-seminar', { kicker: '실무 세미나', title: '서류와 결산', host: '우리교회지원센터', venue: '센터 교육장 · 서울 강서', when: '하루 과정 10:00–17:00', motif: M.wave }],
  ['event-concert', { kicker: '음악회', title: '찬양과 경배의 밤', host: '새길교회 찬양단', venue: '새길교회 본당', when: '저녁 7시 30분 · 좌석 지정', motif: M.wave }],
  ['event-prayer',  { kicker: '연합 기도회', title: '금요 연합 기도회', host: '지역 교회 연합', venue: '부평제일교회', when: '금요일 밤 8시', motif: M.wave }],
  ['event-youth',   { kicker: '청소년', title: '워십 나이트', host: '서문교회 중고등부', venue: '서문교회 지하 카페', when: '금요일 저녁 7시', motif: M.wave }],
  ['event-other',   { kicker: '헌신예배', title: '교회학교 교사 헌신예배', host: '산돌교회 교육위원회', venue: '산돌교회 본당', when: '주일 오후 2시', motif: M.wave }],
];

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [name, motif, caption] of tiles) {
  fs.writeFileSync(path.join(OUT, name + '.svg'), tile(motif, caption));
  n++;
}
for (const [name, o] of posters) {
  fs.writeFileSync(path.join(OUT, name + '.svg'), poster(o));
  n++;
}
console.log(`도안 ${n}개를 ${path.relative(process.cwd(), OUT)} 에 만들었습니다.`);
