# 보험계산기

Next.js 16.3.1 App Router 기반 보험 계산기 사이트 (보험계산기.kr).

**최종 갱신:** 2026-09-02 · **배포 기준:** `43c8cb1` · **상태:** 2~5세대 계산기 공개,
2·3세대 다회 청구 지원

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
npm run test:coverage    # 커버리지 (보험 로직 하한: lines/statements/functions 90%, branches 80%)
npx tsc --noEmit         # 타입 검사
```

CI(GitHub Actions)는 Node.js 22에서 `npm ci` → `test:coverage` → `build` 순으로 실행합니다.
`test:coverage`가 `tests/*.test.ts`를 자동 탐색해 전체 테스트를 실행하며 타입 검사는 Next.js 빌드
단계에서도 수행됩니다. 린트는 로컬 검증 명령으로 별도 제공합니다.

## 지원 세대 — 실손보험

| 세대 | 가입 시기 | 계산기 | 근거 |
|---|---|---|---|
| **1세대** | ~2009.9 | ❌ **제공하지 않음** | 실손 표준약관 제정 이전이라 인용 가능한 1차 근거가 없습니다. 증권·개별 약관 확인 안내만 제공합니다 |
| **2세대** (표준화 실손) | 2009.10~2017.3 | `/2nd-3rd-generation-health-insurance-calculator` | 보험업감독업무시행세칙 [별표 15] 표준약관 (2010.3.29 / 2012.12.28 연혁본) |
| **3세대** (착한실손) | 2017.4~2021.6 | 위와 동일 | 같은 별표15 (2017.3.22 연혁본) |
| **4세대** | 2021.7~2026.4 | `/health-insurance-calculator` | 보험사 표준약관 2건 (ABL생명·KDB생명) |
| **5세대** | 2026.5~ | `/5th-generation-health-insurance-calculator` | 금융위원회·금융감독원 보도자료 (2026.5.6) |

2·3세대는 **표준형/선택형**에 따라 자기부담률과 통원 공제 방식이 다릅니다. 계약일로 추정하지
않고 사용자가 증권을 보고 선택합니다. 미선택 시 계산하지 않습니다.

2·3세대 계산기는 **다회 청구**를 지원합니다. 방문별로 행을 입력하면 계약해당일 기준 연간 외래
180회·처방전 180건 한도와 입원 자기부담 연간 상한 200만 원의 건 사이 누적까지 반영합니다.
외래·처방조제비의 회(건)당 보험가입금액은 증권에서 확인한 값을 선택 입력할 수 있습니다.

## 현재 검증 기준

배포 커밋 `43c8cb1` 기준입니다.

| 항목 | 결과 |
|---|---|
| 전체 테스트 | 19개 파일 통과 |
| 2·3세대 다회 청구 | 합계 정합·단건 정합·연간 횟수·입원 상한 누적·1024케이스 불변식 검증 |
| 커버리지 | Statements 93.05% · Branches 84.94% · Functions 98% (설정 하한 통과) |
| 프로덕션 빌드 | 45개 라우트 생성 통과 |
| 배포 확인 | 신규 다회 청구 UI와 구조화 데이터 공개 페이지 반영 확인 |

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

1. 보험업감독업무시행세칙 별표15의 2021.7.1 연혁본으로 4세대 상수 근거를 감독당국 1차
   자료로 승격합니다.
2. 연간 100회·연간 5천만 원·3대비급여 항목별 한도의 적용 단위와 순서를 확인한 뒤 4세대
   다회 청구를 구현합니다.
3. 5세대는 기산점을 추정하지 않고 "약관상 누적기간 내 이미 부담한 금액"을 사용자에게 받아
   연간 한도와 중증 입원 자기부담 상한의 건 사이 누적을 구현합니다.

세부 범위와 보류 이유는 [`docs/insurance/multi-claim-design.md`](./docs/insurance/multi-claim-design.md)
§4와 [`docs/insurance/audit-status.md`](./docs/insurance/audit-status.md)에서 관리합니다.

## 특징

- 그린/민트 신뢰감 톤, 모바일 최적화
- SEO metadata + `sitemap.ts` + `robots.ts` + JSON-LD(`WebApplication`)
- 개인정보 수집 0
