# WORK 메타버스 사옥 — 인수인계 (2026-11-12)

> 새 채팅에서 **이 문서 하나만 먼저 읽으면** 이어서 작업할 수 있게 정리했다.

---

## 0. 사용자와 일하는 방식 (가장 중요)

- 사용자(혜연)는 **코딩을 모른다.** 한국어로, 쉬운 말로 짧게 답한다. 어려운 말(브랜치, 커밋, 셰이더 등)은 쓰지 않거나 풀어서 말한다.
- 작업이 끝나면 **스크린샷을 보여 주고**(SendUserFile, display: render) 무엇이 바뀌었는지 짧게 정리한다.
- 사용자는 휴대폰 캡처로 문제를 알려 준다. **빨간 동그라미가 문제 위치.**
- 지금까지는 사용자가 **"반영해줘 / 배포해줘"라고 하거나, 고쳐 달라는 요청이면 바로 사이트(main)에 올려 왔다.** 큰 기능을 새로 넣을 때는 먼저 보여 주고 물어본다.
- **솔직하게.** 확인 못 한 것은 확인 못 했다고 말한다. 특히 작업 컴퓨터에서는 **실제 사이트와 Supabase에 접속이 막혀 있다(프록시 403)** → 같이 접속·물소리·실제 휴대폰 성능은 사용자에게 확인을 부탁한다.
- 무겁게 만들지 않는다(사용자: "서버 부하 너무 있게 하지 마", "외부 공간에 너무 힘쓰지 마").

## 1. 지켜야 할 규칙

1. **Supabase Secret 키(sb_secret_, service_role)는 절대 받지 않는다.** Publishable 키만.
2. 커밋·코드·문서에 AI 모델 이름을 적지 않는다.
3. PR은 사용자가 말할 때만.
4. 실제 회사·브랜드 로고를 베끼지 않는다(참고 사진은 분위기만).
5. 직함은 바꾸지 않는다 — 결투는 **레벨 숫자와 패배자 칭호만**.

## 2. 어디에 무엇이 있나

| 항목 | 값 |
|---|---|
| 저장소 | GitHub `roronee91-star/Work` (공개, MIT 라이선스) |
| 작업 브랜치 | `ccr-7aac66fd-4m6fie` |
| 배포 | GitHub Pages가 `main` 루트를 서비스 → 작업 브랜치에서 `git push origin HEAD:main` (fast-forward만) |
| 사이트(직원용 입장 링크) | https://roronee91-star.github.io/Work/ |
| Supabase | 회사용 `work` 프로젝트 (지역 Sydney), URL·Publishable 키는 `src/config.js` |
| Supabase 표 | `notices`(공지판), `duel_stats`(결투 레벨, 이름별) — `docs/supabase.sql`. `duel_stats`는 2026-11-12에 추가, 사용자가 SQL을 실행했는지 확인 필요 |
| 라이브러리 | `vendor/three`(0.169.0 + 쓰는 addons), `vendor/supabase`(2.45.4) — 저장소 안에 있음, 빌드 없음 |
| 사용자용 안내서 | `README.md` (비개발자용 Fork → 이름 바꾸기 → Supabase → Pages) |

## 3. 지금 들어 있는 것 (배포 완료, main = `cd43dda` 기준)

- **건물**: 강가의 4층 유리 사옥(한 층 20×13m, 20명 규모) + 옥상. 1F 로비·사내카페·안내 비서 NPC, 2F 업무공간(16자리, 💻 일하기), 3F 회의실 2개·공지판, 4F 라운지·오락존(샌드백 부스 5칸)·⚔️ 결투장·결투 관리인 NPC, 옥상 테라스(불멍존). 엘리베이터(가까이 가면 층 선택 팝업 자동, 멀리서 고르면 길 찾아 걸어감).
- **실내 분위기**: 아이보리·밝은 원목·올리브 곡선 카펫, 라임/크림 콩 소파, 빈백, 곡선 자갈 화단, 조약돌 펜던트, 그레이 메시 사무 의자.
- **정원**: 분수(흐르는 물막), 개울(징검다리·낮은 둑·물소리), 꽃밭, 벤치 다수, 나무. 강 위 나무 없음. 자동차는 3D 모양으로 띄엄띄엄.
- **낮/밤**: 버튼 + 처음엔 실제 시간(7~18시 낮). 밤 빛번짐은 약하게, 실내등 은은하게.
- **캐릭터**: 교회 메타버스와 같은 2등신(약 1m), 남/여, 회사원 차림, 사원증. 이름·모습은 기기에 기억(다음부터 바로 출근), 👤로 변경. 같은 이름 금지(나중에 온 사람이 변경).
- **조작**: WASD/조이스틱, 바닥 탭하면 길 찾아 이동(A*), 점프(가구 위에 올라섬), 앉기(겹쳐 앉기 방지), 채팅(보낸 뒤 이어서 입력), 공지판, 샌드백 게임.
- **같이 접속**: Supabase Realtime(채널 `work-tower-88f`). 위치는 움직일 때 약 3회/초, 가만히 10초. 받는 쪽은 0.45초 늦게 보간. 탭 다녀오면 재연결·위치 재요청, 1분 무응답만 제거. `siteHost`가 다르면(복사본) Supabase 연결 안 함.
- **⚔️ 소환의 검 결투** (`src/duel.js`): 4층 결투 관리인 앞 E → 접속자 중 선택(사람 도전 하루 2번, 수락 시에만 차감) 또는 👾 업무 괴물(연습, 무제한, 레벨 영향 없음) → 상대 수락 → 모든 층 "대결이 시작되었습니다" 배너 → 결투장에서 30초·HP100 연타(콤보) → 진 쪽 쓰러짐. 모두 Lv.1 시작, 이기면 +1, 지면 😵패배자 칭호(다음에 이기면 떨어짐). 레벨·칭호는 Supabase `duel_stats` 표에 **이름별로** 저장(들어올 때·이름 바꿀 때 `duel.load(name)`으로 불러옴, 없으면 그 기기 기록을 올림). 표가 없거나 로컬 데모면 기기(localStorage `work-duel2`)에만.
- 카카오톡 등 앱 안 브라우저 → 기본 브라우저로 넘김/안내 띠.

## 4. 코드 지도 (`src/`)

| 파일 | 내용 |
|---|---|
| `config.js` | 회사 이름, `siteHost`, Supabase 주소·키, 기본 공지 |
| `main.js` | 렌더러·카메라·입력·걷기·충돌(`collide`, 원형/상자, `top` 높이)·길찾기(`findPath`)·앉기·점프·채팅·층 이동·NPC·샌드백 게임·결투 연결·낮밤·루프 |
| `building.js` | 건물·층별 가구. `Kit`(재질별로 합쳐 그리기, 상자 모서리 둥글게, `dy`로 묶음 높이 내리기), `col(x1,z1,x2,z2,tall,top)`, `SEATS`(의자가 앉을 자리 자동 등록, `DESK`=일하기), `FLOORS/ZONES/ELEV/ARENA/BOOTHS` |
| `garden.js` | 정원·분수·개울·벤치(`seats`) |
| `world.js` | 하늘(낮/밤 `uDay`)·산·도시·강·다리·거리·`createTraffic`(자동차) |
| `avatar.js` | 캐릭터(조각을 색과 함께 합쳐 5번 그리기), 이름표·말풍선(레이어 1 → 빛번짐 뒤에 그림), 앉기·점프(`jy/ground`)·복싱·칼(`setSword`)·맞음·쓰러짐(`knockout`), `WorkMonster` |
| `duel.js` | 결투 전체 흐름 (신청/수락/시작/타격/판정/레벨) |
| `net.js` | Supabase Realtime / BroadcastChannel(로컬 데모), 이벤트 `state/chat/sync/ev` |
| `notices.js` | 공지 읽기/쓰기, 공지판 그림 |
| `audio.js` | 물소리(잡음 세 겹, 크기는 `WATER_LEVEL`. 물방울식 계곡 소리는 사용자가 싫어해 되돌림)·퍽·신호음 (파일 없이 Web Audio로 생성) |

## 5. 검사하는 법 (Claude용)

```bash
cd /home/user/work && timeout 3000 python3 -m http.server 8123 --bind 127.0.0.1   # run_in_background
# 다른 곳에 playwright가 있는 폴더(스크래치패드)에서:
#   npm i three@0.169.0 (필요 시) — playwright·chromium은 이미 설치돼 있음, 다시 설치하지 말 것
node tools/check/duel.cjs <그림폴더>      # 탭 2개로 결투 신청→수락→대결→레벨/칭호
node tools/check/monster.cjs <그림폴더>   # 업무 괴물 연습·쓰러짐
node tools/check/path.cjs                  # 층마다 엘리베이터까지 길찾기
node tools/check/npc.cjs <그림폴더>       # 1층 비서·카페
```
- 크롬 옵션: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --no-proxy-server`. 매우 느림(2~10fps) → 성능 판단은 실제 휴대폰으로.
- 테스트는 `config.js`를 가로채 `supabaseUrl: ''`로 바꿔 **로컬 데모 모드(같은 브라우저 탭끼리)** 로 돈다.
- `page.goto(..., { waitUntil: 'commit' })` 사용(가끔 'load'가 멈춤). `window.__work`에 디버그용 상태가 열려 있다(`player, cam, duel, goFloor, chooseFloor, findPath, collide, av` 등).
- 화면에 시스템 메시지가 겹치면 `#chatToggle`을 눌러 채팅을 접고 찍는다.

## 6. 배포하는 법

1. 작업 브랜치에서 커밋 → `git push -u origin ccr-7aac66fd-4m6fie`
2. `git fetch origin main && git merge-base --is-ancestor origin/main HEAD` 확인 후 `git push origin HEAD:main`
3. `mcp__github__actions_list`(list_workflow_runs, Work 저장소)로 Pages 배포 `success` 확인(약 30초~1분). 연달아 올리면 앞 것은 `cancelled`가 되는데 정상.
4. 사용자에게 "사이트에 올렸어요 + 바뀐 것 + 주소 + 휴대폰에서 새로 고침" 안내.

## 7. 남은 일 / 아이디어

- **초대코드**: 사용자가 "코드는 나중에"라고 함. 정하면 입장 화면에 초대코드 칸 + 기기 기억(문 앞에서 막는 정도라고 이미 설명함).
- 결투 레벨은 이름으로 묶임 → 다른 사람 이름으로 들어오면 그 레벨을 쓸 수 있음(사내용이라 그대로 둠).
- (해결) 2층 창가 원탁·곡선 화단 길찾기: 둥근 탁자·곡선 화단의 부딪힘을 원형(`circle`)으로 바꿈. 원형 가구 위에도 점프해서 설 수 있음(`noStand` 제외).
- 저장소 첫 커밋에 사용자 gmail이 남아 있음(사용자에게 알렸고, 원하면 깨끗한 공개용 저장소를 새로 만드는 방법 안내).
- Supabase 무료 한도: 20명 상시 이동이면 메시지 수가 한도에 가까울 수 있음(사용량은 Supabase Usage에서 확인하라고 안내함).

## 8. 새 채팅 시작할 때 붙여 넣을 말

```
WORK 메타버스 사옥을 이어서 작업할 거야.
GitHub 저장소 roronee91-star/Work 의 브랜치 ccr-7aac66fd-4m6fie 에서
docs/HANDOFF.md 를 먼저 읽고 그대로 이어서 해줘.
고친 건 확인하고 사이트(main)에 반영해줘.
```
