# intomarketing.co.kr

인투마케팅 웹사이트. 도메인 하나 안에 **분야별 경로**로 쌓습니다.

```
intomarketing.co.kr            → index.html   인투마케팅 대표 (지금은 「준비 중」 한 장)
intomarketing.co.kr/hakwon/    → hakwon/      학원지원센터 (ESC)
intomarketing.co.kr/medical/   → (추후)       병의원
```

블로그·리뷰 센터는 **다른 저장소**입니다 — `intoedu/hakwon-blog` → `center.intomarketing.co.kr`.
전 분야가 함께 쓰는 작업 도구라서, 분야 경로 밑에 두지 않고 분리했습니다.
홈페이지 배포가 깨져도 블로거 원고 작업과 정산이 멈추지 않습니다.

## 구조

| | |
|---|---|
| `.nojekyll` | 🔴 **반드시 루트에.** `hakwon/` 안에만 두면 효력이 없습니다 |
| `CNAME` | `intomarketing.co.kr` |
| `index.html` | 대표 페이지. 홈페이지가 만들어지면 갈아끼웁니다 |
| `hakwon/` | 학원지원센터. `intoedu/hakwon-support` 에서 통째로 옮겨왔습니다 |

## 주의

- **`hakwon/index.html` 의 포트폴리오 링크는 남의 사이트입니다** —
  `koreayjk.github.io/…`, `juel2414.github.io/…`,
  `intoedu.github.io/Mirae-N-Math-Xi-Home-Page/` 는 다른 학원 고객사입니다.
  🔴 `intoedu.github.io` 를 일괄 치환하면 이것들이 깨집니다.
- `intoedu/hakwon-support` 는 **지우지 않았습니다.** 이미 그 주소를 받은 학원이 있어서
  새 주소로 넘겨주는 `index.html` 한 장만 남겨 뒀습니다.
- 도메인은 **가비아**에서 관리합니다. DNS 의 **TXT·MX 를 지우면 회사메일이 죽습니다.**

## 사업자

인투마케팅 · 306-24-53380 · 대표 양회광
대전광역시 유성구 은구비남로33번길 13-8, 3397호
