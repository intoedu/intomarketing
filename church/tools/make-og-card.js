/**
 * 링크를 나눌 때 뜨는 그림(og:image)을 만듭니다.
 *
 *   node tools/make-og-card.js     →  assets/img/og-card.png (1200×630)
 *
 * 왜 따로 만드는가
 *   og:image 가 없으면 카카오톡 · 페이스북이 화면에서 아무 그림이나
 *   골라 잘라 씁니다. 가로 로고(1780×307)를 집어 정사각으로 자르면
 *   가운데 [교회] 만 남습니다 — 실제로 그렇게 나왔습니다.
 *
 * 자를 것을 미리 셈해 두었습니다
 *   1200×630 한가운데 630×630 안에만 글과 로고를 넣습니다.
 *   정사각으로 잘려도 로고가 온전히 남습니다.
 *
 * 문구나 색을 고치시려면 tools/og-card.html 을 고치고 다시 돌리십시오.
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const root = path.join(__dirname, '..');
const src = path.join(__dirname, 'og-card.html');
const out = path.join(root, 'assets/img/og-card.png');

if (!fs.existsSync(CHROME)) {
  console.error('Chromium 을 찾지 못했습니다. CHROME_PATH 로 알려 주세요:', CHROME);
  process.exit(1);
}

execFileSync(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--virtual-time-budget=3000', '--window-size=1200,630',
  '--screenshot=' + out, 'file://' + src,
], { stdio: ['ignore', 'ignore', 'ignore'] });   // 컨테이너에서 크롬이 뱉는 dbus 잡소리를 덮습니다

const size = fs.statSync(out).size;
console.log(`만들었습니다 — ${path.relative(root, out)} (${Math.round(size / 1024)}KB)`);
if (size > 300 * 1024) console.warn('⚠ 300KB 가 넘습니다. 일부 메신저가 미리보기를 건너뜁니다.');
