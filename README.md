# 보험계산기

Next.js 16.3.1 App Router 기반 보험 계산기 사이트 (보험계산기.kr).

**최종 갱신:** 2026-09-03 · **상태:** 2~5세대 계산기 공개,
2·3·4·5세대 다회 청구 지원

입력한 값으로만 계산하는 **참고용** 도구입니다. 추정 상수를 넣지 않고, 근거가 확인되지 않은
값은 계산하지 않습니다 — [HOLD 원칙](#hold-원칙-근거-없는-값은-계산하지-않는다) 참조.

## 실행

```bash
npm install
npm run dev              # 개발 서버
npm run build            # 프로덕션 빌드
npm run start            # 프로덕션 실행
npm run lint             # ESLint
npm run test:all         # tests/*.test.ts 전체 (글롭 자동 탐색)
npm run test:insurance   # 실손 엔진 관련 테스트만
npm run test:coverage    # 커버리지 (하한 강제 — 아래 표 참고)
npx tsc --noEmit         # 타입 검사
```

CI(GitHub Actions)는 Node.js 22에서 `npm ci` → `test:coverage` → `build` 순으로 실행합니다.
`test:coverage`가 `tests/*.test.ts`를 자동 탐색해 전체 테스트를 실행하며 타입 검사는 Next.js 빌드
단계에서도 수행됩니다. 린트는 로컬 검증 명령으로 별도 제공합니다.

### 커버리지

측정 대상은 `src/lib/insurance/**` **뿐**이며, 하한은 `--check-coverage`로 **강제**됩니다.
아래를 밑돌면 CI가 실패하므로, 그때그때의 실측 퍼센트는 README에 적지 않습니다.
현재 수치는 `npm run test:coverage` 출력이나 CI 로그에서 확인하세요.

| 지표 | 하한 |
|---|---|
| lines | 99% |
| statements | 99% |
| functions | 90% |
| branches | 80% |

범위와 제외는 `.c8rc.json`에 있습니다.

- **`include: ["src/lib/insurance/**"]`** — `--src`는 `--all`이 훑을 디렉터리만 제한할 뿐,
  테스트 실행 중 로드된 바깥 파일(`scripts/run-tests.mjs`, `src/lib/site.ts` 등)까지 막지 못합니다.
  그대로 두면 보험 코드와 무관한 파일의 변화가 하한을 흔듭니다.
- **`exclude`** — istanbul 기본 제외 목록(`tests/`, `**/*.d.ts`, 각종 설정 파일)을 그대로 옮겨 적고
  **`src/lib/insurance/engine/types.ts` 한 줄만** 더합니다. c8에서 `exclude`를 지정하면 기본 목록이
  병합이 아니라 **대체**되기 때문입니다. `types.ts`는 타입 선언만 있어 컴파일 산출물에 실행 코드가
  없는 **타입 전용** 파일이고, 로드되지 않는 218줄이 전체 수치를 9%p 넘게 끌어내려 하한 여유를
  갉아먹고 있었습니다.

`tests/coverageConfig.test.ts`가 이를 자동으로 지킵니다. 기본 제외 목록은 `@istanbuljs/schema`
원본과 대조하고, `types.ts`는 **TypeScript API로 실제 변환해 산출물이 비어 있는지** 확인하며
(정규식은 부작용 import·런타임 re-export·namespace를 놓칩니다), c8를 한 번 더 돌려 **실제 보고서의
파일 목록**이 보험 디렉터리만 담고 있는지 검사합니다.

## 지원 세대 — 실손보험

| 세대 | 가입 시기 | 계산기 | 근거 |
|---|---|---|---|
| **1세대** | ~2009.9 | ❌ **제공하지 않음** | 실손 표준약관 제정 이전이라 인용 가능한 1차 근거가 없습니다. 증권·개별 약관 확인 안내만 제공합니다 |
| **2세대** (표준화 실손) | 2009.10~2017.3 | `/2nd-3rd-generation-health-insurance-calculator` | 보험업감독업무시행세칙 [별표 15] 표준약관 (2010.3.29 / 2012.12.28 연혁본) |
| **3세대** (착한실손) | 2017.4~2021.6 | 위와 동일 | 같은 별표15 (2017.3.22 연혁본) |
| **4세대** | 2021.7~2026.4 | `/health-insurance-calculator` | 금융감독원 시행세칙 별표15 2021.7.1 연혁본 |
| **5세대** | 2026.5~ | `/5th-generation-health-insurance-calculator` | 금융감독원 시행세칙 별표15 2026.5.6 연혁본 |

> **5세대 계산 범위 — 일반 비급여만.** 별표15 특별약관1·2는 비급여를 보장종목 3종으로 나눕니다.
> 특약1(중증)은 (1)상해비급여 / (2)질병비급여 / **(3)3대비급여**(근골격계 이학요법·체외충격파,
> 주사료, MRI), 특약2(비중증)는 (1)(2)와 **(3)비급여 자기공명영상진단**입니다. 원문이
> "비급여의료비(3대비급여는 제외합니다)"(특약1 제3조 (2)①)와 "비급여의료비(비급여
> 자기공명영상진단은 제외합니다)"(특약2 제3조 (1)①)로 서로를 **명시적으로 배제**하고,
> 상급병실료 차액도 입원 보상 대상에서 제외되어 별도 산식(병실료의 50%, 1일 평균 10만 원 한도)을
> 갖습니다. 이 네 항목은 (1)(2) 산식으로 계산하면 틀리므로, 비급여 입력에 **치료유형 축**을 두고
> `general` 외에는 `PENDING_UNVERIFIED`로 차단합니다. 치료유형은 **기본값이 없습니다** —
> 명시적으로 고르기 전에는 계산하지 않습니다. (3) 보장종목과 상급병실료의 전체 계산은 미구현이며
> 해제 조건은 `docs/insurance/audit-status.md`에 있습니다.

5세대의 연간 한도와 중증 입원 자기부담 상한 500만 원은 약관상 **계약일 또는 매년 계약해당일부터
1년** 단위로 누적됩니다(역년 아님). 통원 가입금액(20만 원)과 연간 보험가입금액(중증 5천만·비중증 1천만 원)은
약관이 모두 **그 금액 이내에서 계약 시 정한 금액**으로 규정하므로 증권의 값을 입력한 경우에만
적용합니다. 연간 보험가입금액은 **상해비급여·질병비급여 각 축에 대해 따로** 정해지므로, 한 번의
계산에는 같은 원인 축의 청구만 넣습니다. 0원·음수는 미입력으로 처리합니다.

같은 날 통원의 합산은 **중증과 비중증의 조건이 다릅니다.**

- **비중증** — 조문 자체가 `통원 1일당(외래 및 처방·조제비 합산)`이므로 같은 날은 합산합니다.
- **중증** — ①동일 의료기관에서 같은 날 받은 외래+처방, ②하루에 **같은 치료를 목적으로** 2회 이상
  받은 통원만 1회로 봅니다. **치료 목적이 다르거나 다른 의료기관이면 별도 행으로 입력합니다.**

2·3세대는 **표준형/선택형**에 따라 자기부담률과 통원 공제 방식이 다릅니다. 계약일로 추정하지
않고 사용자가 증권을 보고 선택합니다. 미선택 시 계산하지 않습니다.

2·3세대 계산기는 방문별 행, 연간 외래 180회·처방전 180건, 입원 자기부담 연간 200만 원
상한을 반영합니다. 4세대는 동일한 보장축의 청구를 묶어 회당 20만 원, 비급여 통원 100회,
증권상 연간 가입금액, 3대비급여의 항목별 금액·횟수 한도를 반영합니다. 계약마다 다른 가입금액은
증권에서 확인한 값을 입력한 경우에만 적용합니다. 5세대는 회당·일당 한도와 비급여 연간 보험금
한도, 상급종합·종합병원 중증 입원 자기부담 500만 원 상한을 건 사이에 누적합니다.

## 현재 검증 기준

현재 `main` 기준입니다. 커밋 해시는 배포 이력으로 관리하고 README에는 고정하지 않습니다.

| 항목 | 결과 |
|---|---|
| 전체 테스트 | 21개 파일 통과 |
| 2·3세대 다회 청구 | 합계 정합·단건 정합·연간 횟수·입원 상한 누적·1024케이스 불변식 검증 |
| 4세대 다회 청구 | 회당 20만원·비급여 100회·연간 가입금액·3대비급여 항목별 금액/횟수 한도 검증 |
| 5세대 비급여 치료유형 | 치료유형 미선택·별도 보장종목 4종 차단(단건·다회), 급여는 요구하지 않음, 일반 비급여 기준 결과 고정 |
| 커버리지 측정 설정 | 실제 보고서 파일 목록이 보험 디렉터리 한정임을 재실행으로 검사, istanbul 기본 제외 목록 보존, 타입 전용 여부를 컴파일 산출물로 판정, 하한 하향 방지 |
| 5세대 다회 청구 | 상해·질병 보장축 분리, 계약자 선택 통원·연간 가입금액, 중증 통원 연간 100회, 자기부담 상한 누적, 급여 통원 입력 게이트 검증 |
| 커버리지 | 설정 하한(lines·statements 99% / functions 90% / branches 80%) 통과 — 실측은 CI 로그 참조 |
| 프로덕션 빌드 | 45개 라우트 생성 통과 |
| 화면 확인 | 4세대 다회 청구 입력·결과 UI 로컬 확인 |

## 페이지

**계산기**

- `/health-insurance-calculator` 실손보험(4세대) 자기부담금 계산기
- `/2nd-3rd-generation-health-insurance-calculator` 2·3세대 실손보험 자기부담금 계산기
- `/5th-generation-health-insurance-calculator` 5세대 실손보험 자기부담금 계산기
- `/surrender-value-calculator` 해지환급금 계산기
- `/future-premium-calculator` 앞으로 낼 보험료 계산기
- `/cancel-vs-keep-calculator` 보험 해지 vs 유지 계산기
- `/coverage-gap-calculator` 보장 공백 계산기
- `/death-coverage-calculator` 사망보장 계산기
- `/family-living-calculator` 유족 생활비 계산기
- `/insurance-premium-calculator` 보험료 비중 계산기
- `/car-insurance-calculator` 자동차보험 견적 비교 계산기

**허브 · 가이드 · 정책**

- `/` 홈 · `/silson-guide` 실손보험 허브 · `/protection-planning` 보장설계 허브 · `/insurance-cancellation` 해지 허브
- `/guide`, `/guide/[slug]` 가이드
- `/about` · `/privacy` · `/terms` · `/disclaimer`

## HOLD 원칙 — 근거 없는 값은 계산하지 않는다

이 저장소는 규제 상수를 코드에 직접 적지 않습니다.

1. 모든 규제 상수는 `src/lib/insurance/engine/regulatoryRules.ts`에 **문서명·발행기관·시행일·
   URL·조항 위치**와 함께 등록합니다.
2. `constants.ts`는 그 레지스트리에서 **값을 파생**합니다. 상수를 직접 쓰지 않습니다.
3. `tests/regulatoryRules.test.ts`가 출처 없는 상수를 거부합니다.
4. 근거가 확정되지 않은 경로는 값을 지어내지 않고 `status: "PENDING_UNVERIFIED"`를 반환합니다.
5. 사실을 단정하는 UI 문구는 `tests/uiCopy.test.ts`가 **양방향으로** 가드합니다.
6. 계산 결과의 금액은 `common/settle.ts`에서 종결되며 `본인부담금 + 보험적용금액 === 진료비`
   불변식이 전 경로 테스트로 고정되어 있습니다.

현재 남은 HOLD 항목은 [`docs/insurance/audit-status.md`](./docs/insurance/audit-status.md) §3에 있습니다.

## 구조

```
src/lib/insurance/
  common/      settle.ts(금액 종결·반올림 정책) · number.ts · time.ts
  engine/      규정 기반 실손 계산 — regulatoryRules.ts(출처 레지스트리) · constants.ts
               generationStandardized.ts(2·3세대) · generation2021.ts(4세대) · generation2026.ts(5세대)
               feature/  HOLD 스텁 (제외항목·할인할증·임신출산·발달장애)
  decision/    사용자 입력 기반 의사결정 산수 8종
src/components/calculators/   계산기 UI (산식 없음 — 도메인 함수 호출만)
tests/                        run-tests.mjs가 글롭으로 자동 탐색
docs/insurance/               개발 문서 (아래 색인)
```

## 개발 문서

- [`docs/insurance/audit-status.md`](./docs/insurance/audit-status.md) — 감사 최종 상태, 설계 원칙, 남은 HOLD
- [`docs/insurance/insurance-gen123-engine-design.md`](./docs/insurance/insurance-gen123-engine-design.md) — 1~3세대 엔진 근거 조사·구현 설계
- [`docs/insurance/multi-claim-design.md`](./docs/insurance/multi-claim-design.md) — 다회 청구 설계(방문별 행, 연간 횟수 한도, 자기부담 상한 누적)
- [`docs/insurance/stack-upgrade-log.md`](./docs/insurance/stack-upgrade-log.md) — 스택 업그레이드 기록

## 다음 개발 순서

1. 같은 날 통원을 날짜 축으로 자동 판정합니다. 현재는 약관 규정에 따라 사용자가 합산해
   한 행으로 입력합니다(중증은 동일 의료기관·같은 치료 목적 조건이 붙습니다).
2. 외부 근거가 확보되면 `feature/` HOLD 규칙 4종을 해제합니다.

세부 범위와 보류 이유는 [`docs/insurance/multi-claim-design.md`](./docs/insurance/multi-claim-design.md)
§4와 [`docs/insurance/audit-status.md`](./docs/insurance/audit-status.md)에서 관리합니다.

## 특징

- 그린/민트 신뢰감 톤, 모바일 최적화
- SEO metadata + `sitemap.ts` + `robots.ts` + JSON-LD(`WebApplication`)
- 개인정보 수집 0
