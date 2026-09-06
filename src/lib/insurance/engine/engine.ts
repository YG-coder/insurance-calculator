import { ClaimInput, CalcResult, Gen2026ClaimInput, Generation } from "./types";
import { calcStandardized } from "./generationStandardized";
import { calc2021 } from "./generation2021";
import { calc2026 } from "./generation2026";

/**
 * 이전 세대가 **소비하지 않는 5세대 전용 입력 축** (G-33).
 *
 * 실측(기준선 `a3017ca`, UI 미경유 엔진 직접 호출 + 접근자 계수, 20경로):
 * 아래 네 축은 2009·2017·2021의 **모든 경로**에서 접근자 호출 **0회**였다 — 결과가 미제공과
 * 같았던 이유는 반영돼서가 아니라 **읽히지 않아서**다. 값이 무엇이든(정상값·`0`·`null`·
 * 문자열·객체·`bigint`·`Symbol`·함수·순환 참조) 결과가 한 글자도 달라지지 않았다.
 *
 *   `nhisCoinsuranceRate`   국민건강보험 본인부담률. 5세대 **급여 통원**만 이 값을 읽는다.
 *                           2·3세대는 급여·비급여 합계에 단일 정률이고, 4세대는 요율이
 *                           `coverage`×`visit` 표로 정해진다 — 어느 쪽도 대응 축이 없다.
 *   `severity`              중증/비중증. 5세대 **비급여 특별약관1·2**가 만든 구분이다.
 *                           이전 세대 표준약관에는 중증도 구분 자체가 없다.
 *   `nonBenefitItem`        비급여 치료유형. 5세대 각 특약 제3조가 비급여를 보장종목으로
 *                           나눈 축이다. 이전 세대에는 그 구분이 없다.
 *   `priorAnnualDeductible` 5세대 특별약관1 제5조⑤의 연 누적 **공제금액**(500만원 상한).
 *                           ⚠ 2·3세대의 입원 자기부담 상한(200만원)은 **다른 축**
 *                           `priorAnnualPaid`를 쓴다 — 누적 대상이 공제금액이 아니라
 *                           자기부담금이다. 이름이 비슷하다고 합치지 않는다.
 */
const LEGACY_UNUSED_GEN2026_KEYS = [
  "nhisCoinsuranceRate", "severity", "nonBenefitItem", "priorAnnualDeductible",
] as const;

/**
 * `perVisitCoverageLimit`은 **세대별로 의미가 다르다.** 이름만 보고 위 목록에 합치지 않는다.
 *
 *   2009·2017 **통원** — 실제로 소비한다(실측: 접근자 1회, 값 200,000에서 결과가 달라진다).
 *                        약관의 회(건)당 가입금액이고 `settle()`의 지급 한도로 들어간다.
 *                        **거부하지 않는다.**
 *   2009·2017 **입원** — 소비하지 않는다(실측: 0회). 약관의 회(건)당 한도는 외래·처방조제비
 *                        항목의 가입금액이라 입원 행에는 적용되지 않는다.
 *   2021 **전 경로**   — 소비하지 않는다(실측: 0회). 4세대의 통원 회당 20만원 한도는
 *                        약관이 정한 **상수**(`GEN2021.outpatientPerVisitLimit`)여서
 *                        계약자가 고른 값을 받지 않는다.
 */
const STANDARDIZED_INPATIENT_UNUSED_KEY = "perVisitCoverageLimit";

/** 세대별 미사용 축 목록. 순서가 안내 우선순위다. */
function unusedKeysOf(generation: Exclude<Generation, "2026">, input: ClaimInput): readonly string[] {
  if (generation === "2021") return [...LEGACY_UNUSED_GEN2026_KEYS, STANDARDIZED_INPATIENT_UNUSED_KEY];
  // 2009·2017: 통원은 이 축을 실제로 소비하므로 입원에서만 막는다.
  //   ⚠ 판정식은 `calcStandardized`의 소비 분기와 **정확히 같은 모양**이다
  //     (`input.visit === "outpatient"`). 한쪽만 고치면 계약이 갈린다.
  return input.visit === "outpatient"
    ? LEGACY_UNUSED_GEN2026_KEYS
    : [...LEGACY_UNUSED_GEN2026_KEYS, STANDARDIZED_INPATIENT_UNUSED_KEY];
}

const WHY: Record<string, string> = {
  nhisCoinsuranceRate: "건강보험 본인부담률(nhisCoinsuranceRate)은 5세대 급여 통원 계산에만 쓰입니다.",
  severity: "중증/비중증(severity)은 5세대 비급여 특별약관1·2가 만든 구분이라 이전 세대 표준약관에는 없습니다.",
  nonBenefitItem: "치료유형(nonBenefitItem)은 5세대가 비급여를 보장종목으로 나눈 축이라 이전 세대에는 없습니다.",
  priorAnnualDeductible: "누적 공제금액(priorAnnualDeductible)은 5세대 특별약관1 제5조 제5항의 500만원 공제금액 상한 전용입니다. 2·3세대 입원 자기부담 상한(200만원)은 누적 대상이 자기부담금이라 priorAnnualPaid로 넘겨 주세요.",
  perVisitCoverageLimit: "회(건)당 가입금액(perVisitCoverageLimit)은 이 세대·경로에서 쓰이지 않습니다. 2·3세대는 통원에서만 적용하고, 4세대의 통원 회당 한도는 약관이 정한 고정값이라 계약자가 고른 금액을 받지 않습니다.",
};

/**
 * 미사용 축 stray 거부 (G-33).
 *
 * ⚠ **위치가 계약이다.** 세대 위임이 이미 `PENDING_UNVERIFIED`를 냈다면(2·3세대의 표준형/
 *   선택형 미지정, 5세대의 치료유형·중증도 미지정 등) 그 안내가 먼저이므로 **이 이름들을
 *   읽지 않는다.** 그래서 호출부는 결과가 `OK`일 때만 이 함수를 부른다.
 * ⚠ 각 키를 **한 번만** 읽는다. 목록 순서가 안내 우선순위다.
 * ⚠ 값이 `0`이어도 막는다 — `undefined`(미제공)만 미사용과 같다. `in`이 아니라
 *   `!== undefined`로 보아 호출부의 `{ ...base, key: undefined }` 패턴을 막지 않는다.
 * ⚠ 안내에 **받은 값 자체를 넣지 않고 `typeof`만 넣는다.** 이 파일에는 `showValue()`가 없고,
 *   무효 입력을 템플릿 리터럴에 끼우면 `Symbol`이나 `toString()`이 던지는 객체에서 안내를
 *   만드는 중에 예외가 난다(`generation2026`이 G-15에서 세운 계약과 같다).
 * ⚠ 반환은 위임 결과 `ok`를 바탕으로 만든다 — `generation`과 **검증된 `amount`가 그대로
 *   보존**되고, 세대별 실패 반환 계약(`ownPay`/`insurancePay`/`rateApplied` 등이 `null`,
 *   `appliedCaps`는 빈 배열)도 그 세대의 기존 모양과 같다.
 */
function rejectUnusedGen2026Keys(
  generation: Exclude<Generation, "2026">,
  input: ClaimInput,
  ok: CalcResult,
): CalcResult | null {
  for (const key of unusedKeysOf(generation, input)) {
    const got: unknown = (input as unknown as Record<string, unknown>)[key];
    if (got === undefined) continue;
    return {
      status: "PENDING_UNVERIFIED", generation, amount: ok.amount,
      ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null,
      appliedCaps: [],
      notes: [
        `${generation}세대: ${WHY[key]}`,
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값의 형식: ${typeof got}`,
      ],
    };
  }
  return null;
}

/**
 * 제네릭 진입점의 입력 — 5세대 전용 축을 **타입에서도 닫는다** (G-33).
 *   ⚠ `perVisitCoverageLimit`은 여기서 닫지 않는다. 2·3세대 통원이 실제로 소비하고,
 *     `visit`으로 유니온을 쪼개면 호출부가 `visit`을 변수로 넘기는 자리에서 `as` 없이
 *     컴파일되지 않는다. 그 축은 런타임으로만 막는다(G-30·G-31이 같은 이유로 남긴 경계).
 */
export type LegacyClaimInput = ClaimInput & {
  nhisCoinsuranceRate?: never;
  severity?: never;
  nonBenefitItem?: never;
  priorAnnualDeductible?: never;
};

export function calculate(generation: "2009" | "2017" | "2021", input: LegacyClaimInput): CalcResult;
export function calculate(generation: "2026", input: ClaimInput): CalcResult;
export function calculate(generation: Generation, input: ClaimInput): CalcResult;
export function calculate(generation: Generation, input: ClaimInput): CalcResult {
  switch (generation) {
    case "2009":
    case "2017": {
      const r = calcStandardized(generation, input);
      // 선행 preflight(표준형/선택형 미지정 등)가 결과를 정했다 — 미사용 축을 읽지 않는다.
      if (r.status !== "OK") return r;
      return rejectUnusedGen2026Keys(generation, input, r) ?? r;
    }
    case "2021": {
      const r = calc2021(input);
      if (r.status !== "OK") return r;
      return rejectUnusedGen2026Keys(generation, input, r) ?? r;
    }
    // 제네릭 진입점은 세대별 필수 축을 타입으로 강제할 수 없다. 5세대 비급여 치료유형은
    // calc2026이 런타임에서 검사해 미지정이면 PENDING_UNVERIFIED로 막는다.
    // 타입 강제가 필요한 호출부(5세대 UI·다회 엔진)는 calc2026을 직접 호출한다.
    //   ⚠ 5세대는 이 함수가 손대지 않는다 — 자기 진입점이 G-30·G-31·G-32로 이미 닫혀 있다.
    case "2026": return calc2026(input as Gen2026ClaimInput);
    default: {
      const _exhaustive: never = generation;
      throw new Error("지원하지 않는 세대: " + _exhaustive);
    }
  }
}
