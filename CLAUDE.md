# 이 저장소에서 작업할 때 지킬 것

유민혁(minhyuk94)의 개인 프로젝트 "노동자의 도시 (City of Laborer)". 사용자는 한국어로 대화합니다. 게임 글자도 한국어.

## 무엇인가

새벽 인력시장에서 시작하는 하루살이 게임 (사용자 요청: "이용자들이 최대한 공감할 수 있게, 중독성 있게, 진짜 인력시장에서 일하는 사람이 된 것처럼").
하루 = 새벽 → 인력사무소(지원·뽑히기) → 오전 일 → 점심 → 오후 일 → 일당 봉투 → 저녁 → 일기 → 잠. 사연 셋(청년·가장·어르신), 꿈(목표 금액)을 이루면 엔딩, 계속하기 가능.
GitHub Pages(`https://mhyoo-games.github.io/city-of-laborer/`, 조직 mhyoo-games)에 올린다.

## 지킬 것

- 사람·회사·현장 이름은 모두 지어낸 것. 다른 게임·회사 이름을 README·화면·이력서에 넣지 않는다. 만든 사람 표기는 "심심풀이".
- 그림: Kenney Tiny Factory(CC0, `public/assets/kenney/LICENSE.txt`, 묶음 그림 `tinyfactory.png` 16px 12×11칸, 사람은 120번 하나뿐이라 `gfx/tiles.ts`의 `worker`가 안전모·작업복·머리 색을 바꿔 여럿을 만든다). 하늘·도시·가게·봉고차는 코드로 (`gfx/scenes.ts`). 글꼴: 갈무리(OFL).
- 소리: `src/audio/sound.ts`에서 Web Audio로 합성. 곡은 새로 쓴 것만(멜로디·베이스 길이가 같아야 함 — 테스트). 음원 파일을 넣지 않는다.
- 하루 규칙은 `src/core/sim.ts`(표는 `data.ts`), 현장 게임 다섯(`clean·sort·line·pipe·crane`)은 `src/games/mini.ts` — 둘 다 화면과 분리한 순수 TS (import에 `.ts` → `node --test`). 화면은 `src/gfx/`, 흐름·메뉴(HTML)는 `src/main.ts`.
- 균형: `tests/core.test.ts`의 60일 봇(잘함/보통/서툼 × 사연 셋)이 "잘하면 30~40일쯤 꿈, 서툴면 겨우 버팀"인지 본다. 숫자(일당·뽑힐 가능성·생활비·방값)를 바꾸면 같이 본다. `tests/games.test.ts`는 현장 게임마다 잘하는 봇 ≥80, 가만있기 ≤15, 막 누르기 ≤55.
- 게시판에는 공장·물류 일이 꼭 하나 있다(이수증 없는 첫날에도 지원할 곳이 있게).
- 화면은 960×540 무대를 창에 맞춰 줄인다(캔버스 320×180을 3배). 메뉴 패널이 오른쪽을 덮으므로 장면의 주인공·소품은 왼쪽 150px 안에. 세로 휴대폰은 위에 그림, 아래에 메뉴를 제 크기로(`body.portrait`), 일할 때만 터치 패드(`#pad`).
- 저장은 localStorage `col_save` 하나, 새벽(wake)에만 저장한다. `parseSave`가 망가진 값도 받아 주고 늘 그날 새벽부터 다시 시작한다(일당을 두 번 받지 않게).
- CI(`ci.yml`): 테스트 → 타입 검사 → 빌드 → headless Chrome으로 하루 한 바퀴(`scripts/smoke.mjs`) → Pages 배포.
- 큰 기능이 바뀌면 조직 첫 화면(mhyoo-games.github.io `games.json`)과 이력서 저장소(minhyuk94.github.io `games`)도 ko/ja/en으로 맞춘다. 소스 코드·저장소 링크는 이력서에 넣지 않는다.

## 이 작업 환경에서 돌려 보기

- npm 설치가 막혀 있을 수 있다. `ln -s /opt/npm-tools/node_modules node_modules` 후 `node scripts/build.mjs`, 타입 검사는 `/opt/npm-tools/node_modules/.bin/tsc --noEmit -p .`
- 화면 확인: `dist`에서 `python3 -m http.server 8765` 후 `SHOTS=/tmp/x CHROME=/usr/bin/google-chrome PLAYWRIGHT_PATH=/opt/npm-tools/node_modules/playwright/index.mjs node scripts/smoke.mjs` (SHOTS가 있으면 화면마다 찍음). 주소에 `?dev=1`이면 `window.__col`: `screen`, `game`, `mini`, `opts`, `choose(i)`, `go(화면)`, `newGame(bg)`, `hire()`, `play(kind)`, `finishMini(점수)`.
