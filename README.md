# Web-Runner Unlimited

Gameloft × Marvel의 모바일 게임 **Spider-Man Unlimited** (2014-09-10 출시 · 2019-03-31 서비스 종료)를
공개 자료를 바탕으로 재구성한 **비공식 팬 리메이크 웹 러너**입니다.
빌드 도구 없이 순수 HTML/CSS/JS + Canvas 2D + Web Audio로만 만들어졌습니다.

▶ **플레이**: `index.html`을 브라우저로 열거나, GitHub Pages / Vercel에 올리면 링크로 바로 실행됩니다.

### 배포

```bash
npx vercel          # 미리보기 URL
npx vercel --prod   # 운영 URL
```

GitHub에 push한 뒤 Vercel에서 저장소를 연결하면 push할 때마다 자동 배포됩니다.
GitHub Pages를 쓸 경우 저장소 Settings → Pages → Source를 **GitHub Actions**로 바꾸면 됩니다.

---

## 게임 구성

| 영역 | 내용 |
|---|---|
| 스토리 | 이슈 6개 · 보스는 `B` 미션에서만 등장 · 이슈 절반(보스 2명 포함) 클리어 시 다음 이슈 해금 |
| 보스 | 30종(6계열 × 변종 5~6). 같은 이슈의 보스는 팔레트 스왑 + 동일 패턴(원작 방식) |
| 구간 | 옥상 달리기 · 웹 스윙 · 벽 타기 · 자유 낙하가 끊김 없이 이어짐, 구간별 시점 전환 |
| 적 | 일반 / 무장(투사체) / 장갑(슬라이드 전용) / 비행(점프 전용) / 미니언(미스테리오전) |
| 카드 | 65종 · 커먼(3★)~타이탄(8★) · 등급 특성 + 캐릭터 고유 능력 18종 + 타이탄 전용 능력 3종 |
| 시스템 | 에너지, 바이알/ISO-8, 포털 소환 연출, 이벤트(주간), 스파이디 옵스, 데일리 보상, 치트·쿠폰 코드 |

### 조작

| | PC | 모바일 |
|---|---|---|
| 차선 이동 | `←` `→` `A` `D` | 좌우 스와이프 |
| 점프 · 웹 킥 · 보스 연타 | `W` `↑` `Space` `Enter` · 클릭 | 위 스와이프 · 탭 |
| 슬라이드 | `↓` `S` | 아래 스와이프 |
| 스윙 상승 | 위 키를 길게 | 길게 터치 |
| 벽 타기 · 낙하 | 마우스 좌우 | 기기 기울이기(자이로) |
| 일시정지 | `Esc` `P` | — |

---

## 원작 대비

자료에서 확인된 시스템을 그대로 옮기되, 실시간 대기 시간만 줄였습니다.

| 항목 | 원작 | 이 재구성 |
|---|---|---|
| 에너지 | 최대 5, 10분당 1 회복 | 최대 5, 3분당 1 회복 |
| 희귀도 | 커먼 3★ → 타이탄 8★ | 동일 |
| 스파이디 파워 | `P = L/10 + (S−1)/2` | 동일 (+ 랭크업당 0.5) |
| 이벤트 배율 | 팀원 배율 가산 (4× + 3× = 7×) | 동일 |
| 스파이디 옵스 | 1~6명 파견, 1~18시간 | 최대 6명, 1/3/6분 |

**그래픽은 원작과 무관합니다.** 캐릭터·보스·배경은 전부 Canvas 2D로 새로 그린 추상 카툰 스타일이며,
원작 에셋을 일절 포함하지 않습니다. 캐릭터 이름만 데이터로 사용합니다.

---

## 소스 구조

빌드 단계는 파일을 이어 붙이는 것뿐입니다.

```
src/head.html    스타일 + 마크업 (게임 HUD, 허브 UI)
src/data.js      캐릭터 65종, 이슈·보스, 등급 특성, 고유 능력
src/voices.js    보스 보이스 24종 + 배경음악 2곡 + 효과음 샘플 3종 (base64 mp3, 직접 제작)
src/render.js    캐릭터 리그·포즈, 보스 모델, 환경, 보스 패턴/해저드
src/game.js      게임 루프, 러너 엔진, 허브 화면, 저장, 치트 코드
src/fx.js        효과음(Web Audio 합성), 연출, 포털 소환 시네마틱, 보이스
```

```bash
./build.sh   # → index.html, dist/artifact.html
```

### 음악 · 보이스

배경음악 2곡(메인 / 보스)이 내장되어 있고, 보스 등장·격파에 맞춰 크로스페이드로 전환됩니다.
보스 보이스가 재생되는 동안에는 음악이 자동으로 낮아집니다(더킹). 상단의 ♪ 버튼으로 끌 수 있습니다.

효과음은 Web Audio 합성이 기본이고, 거미줄(웹 킥·스윙)·바이알 획득·타격(처치·연타)은 녹음 샘플을 씁니다.
링 통과는 바이알 샘플을 높은 피치로 재생합니다. 샘플은 매번 재생 속도를 살짝 흔들어 반복감을 줄이고,
연속 획득 시 음이 단계적으로 올라가며 최소 재생 간격이 걸려 있습니다.

보스 보이스는 6계열 × 4상황(등장/피격/공격/사망) 24종이며 `src/voices.js`에 내장되어 있습니다.
클립이 없는 계열(인헤리터스 등)은 Web Audio로 합성한 웃음·신음으로 대체됩니다.
대사는 항상 보스 머리 위 말풍선으로도 표시됩니다.

### 치트 코드

게임 내 코드 창(티켓 아이콘) → 맨 아래 접힌 섹션에서 입력합니다. 테스트용이며 반복 사용 가능합니다.

`WEBHEAD` 전 재화 · `MULTIVERSE` 전 카드 해금 · `TITANUP` 팀 최대 레벨 ·
`ALLSTAGES` 모든 이슈·미션 개방 · `IMMORTAL` 무적 토글 · `ENERGYMAX` 에너지 충전 · `WIPESAVE` 완전 초기화

### 저장 데이터

진행도와 설정은 브라우저 `localStorage`에 저장됩니다 (`wru_save_v1`, `wru_sfx`, `wru_voice`,
`wru_tts`, `wru_bgm`, `wru_ctrl`, `wru_vpitch`). 코드 창 맨 아래 **완전 초기화** 버튼을 누르면
한 번 더 누르면 전부 지우고 처음 상태로 되돌립니다 (iframe에서 `confirm()`이 막히는 환경 때문에 2단계 확인 방식).

---

## 자료

- [Gameloft and Marvel Announce Spider-Man Unlimited](https://www.gameloft.com/newsroom/gameloft-and-marvel-announce-spider-man-unlimited-3279)
- [Swing into Action with Spider-Man Unlimited — Gameloft Blog](https://www.gameloft.com/blog/players/swing-into-action-with-spider-man-unlimited)
- [Spider-Man Unlimited Guide and Walkthrough — GameFAQs](https://gamefaqs.gamespot.com/iphone/805886-spider-man-unlimited/faqs/73094)
- [Spider-Man Unlimited (video game) — Wikipedia](https://en.wikipedia.org/wiki/Spider-Man_Unlimited_(video_game))
- [Spider-Man Wiki](https://spiderman.fandom.com/wiki/Spider-Man_Unlimited_(video_game))

---

## 라이선스 / 고지

비영리 팬 프로젝트입니다. Spider-Man과 관련 캐릭터는 Marvel의 상표이며,
*Spider-Man Unlimited*는 Gameloft의 저작물입니다. 본 저장소는 그 어느 쪽과도 제휴 관계가 없고
원작의 코드·에셋·음원을 포함하지 않습니다. 코드와 직접 제작한 에셋은 자유롭게 사용하셔도 됩니다.
