// 표준화 실손 엔진 — 2세대(2009.10~2017.3) · 3세대(2017.4~2021.6) 공용.
//
// 두 세대의 기본형 산식은 금융감독원 보험업감독업무시행세칙 [별표 15] 표준약관 직독 결과
// 동일하다. 세대가 갈리는 지점은 계산식이 아니라 (a) 근거 약관과 (b) 미적용 고지 문구다.
// 따라서 산식은 한 곳에 두고 세대별 상수·고지만 주입한다.
//
// 4·5세대와 다른 점 — 옮겨 적을 때 반드시 지켜야 한다:
//   1) 급여·비급여를 **합한 금액**에 단일 정률을 적용한다. coverage로 요율이 갈리지 않는다.
//   2) **선택형에는 통원 정률공제가 없다.** 정액 공제만 적용한다(약관 <표1> 선택형 행).
//   3) 입원 자기부담에는 연간 200만원 상한이 있다. 이는 보험금 상한이 아니라 자기부담 상한이므로
//      settle의 insuranceCap이 아니라 ownPayRaw를 깎아야 한다(5세대 500만 상한과 같은 성질).
//   4) 통원 공제 분류축(Facility)은 4세대의 Tier와 다르다. 종합병원이 2·3세대에서는 1만5천원,
//      4세대에서는 상급종합과 같은 2만원이다. 섞어 쓰면 안 된다.
import { CapCode, ClaimInput, CalcResult, Facility, Plan } from "./types";
import { GEN2009, GEN2009_NOT_APPLIED, GEN2017, GEN2017_NOT_APPLIED } from "./constants";
import { settle, normalizeAmount } from "../common/settle";

type StandardizedGeneration = "2009" | "2017";

const TABLE = {
  "2009": {
    constants: GEN2009, notApplied: GEN2009_NOT_APPLIED,
    cap: "GEN2009_INPATIENT_OWN_PAY_ANNUAL" as CapCode,
    perVisitCap: "GEN2009_PER_VISIT_COVERAGE_LIMIT" as CapCode,
  },
  "2017": {
    constants: GEN2017, notApplied: GEN2017_NOT_APPLIED,
    cap: "GEN2017_INPATIENT_OWN_PAY_ANNUAL" as CapCode,
    perVisitCap: "GEN2017_PER_VISIT_COVERAGE_LIMIT" as CapCode,
  },
} as const;

/**
 * 계약자가 정한 회(건)당 가입금액.
 * 0·음수·비정상 값은 미입력으로 본다 — 0을 한도로 적용하면 보험금이 0원이 되는데,
 * 이는 계약 내용이 아니라 미입력일 가능성이 압도적으로 높다.
 */
function perVisitLimit(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

/* ────────────────────────────────────────────────────────────────────────
 * 입력 소유권 (G-34C) — 이 진입점이 쓰지 않는 축을 조용히 버리지 않는다.
 *
 * 이 엔진이 읽는 축은 `amount`·`coverage`·`visit`·`plan`·`facility`·`priorAnnualPaid`·
 * `perVisitCoverageLimit` 일곱뿐이다(실측: 8경로군 × 35축에서 접근자 호출과 결과 변화).
 * 나머지는 **다른 세대·다른 진입점의 축**이고, 종전에는 접근자 호출 0회로 조용히 버려졌다.
 *
 * ⚠ 제네릭 라우터 `calculate()`는 세대별 소유 필드만 **지연 투영**해 넘기므로 이 검사에
 *   걸리지 않는다. 여기서 막는 것은 이 함수를 **직접 호출**하는 경로다. 라우터의 G-34A
 *   안내·순서·반환 계약은 그대로 앞선다.
 * ⚠ 값이 `0`이어도 막고 `undefined`만 미제공으로 본다(`in`이 아니라 `!== undefined`).
 * ⚠ 각 키를 **한 번만** 읽는다. 목록 순서가 안내 우선순위다.
 * ⚠ 안내에 받은 값 자체를 넣지 않고 `typeof`만 넣는다 — 이 파일에는 `showValue()`가 없고,
 *   무효 입력을 템플릿 리터럴에 끼우면 Symbol·`toString()`이 던지는 객체에서 안내를 만드는
 *   중에 예외가 난다(`generation2026`의 G-15 계약과 같다).
 * ⚠ 자리는 **`plan` preflight 뒤**다. 선행 차단이 결과를 정하는 경로에서 새 이름을 읽지 않는다.
 * ──────────────────────────────────────────────────────────────────────── */
const STD_UNUSED_KEYS = [
  "amounts", "lines", "stays", "roomChargeTotal", "inpatientDays", "generation",
  "cause", "severity", "tier", "route", "item", "rider", "nonBenefitItem",
  "injectionPurpose", "nhisCoinsuranceRate", "outpatientCoverageLimit", "annualCoverageLimit",
  "priorAnnualDeductible", "priorAnnualInpatientDeductible", "priorAnnualInsurancePaid",
  "priorAnnualRiderPaid", "priorAnnualOutpatientVisits", "priorAnnualOutpatientDays",
  "priorAnnualPrescriptions", "priorAnnualRiderVisits", "approvedThroughVisit",
  "priorAnnualCoveredCount", "priorAnnualTreatmentActCount",
] as const;

/** 통원만 쓰는 축 — 입원에서는 stray다. 판정식은 아래 소비 분기와 **같은 모양**이다. */
const STD_OUTPATIENT_ONLY_KEYS = ["facility", "perVisitCoverageLimit"] as const;
/** 입원만 쓰는 축 — 통원에서는 stray다. */
const STD_INPATIENT_ONLY_KEYS = ["priorAnnualPaid"] as const;

const STD_PATH_WHY: Record<string, string> = {
  facility: "통원 항목별 공제금액(<표1>)을 가르는 축이라 입원 계산에는 쓰이지 않습니다. 입원 자기부담은 정률과 연간 상한으로 정해집니다.",
  perVisitCoverageLimit: "회(건)당 가입금액은 외래·처방조제비 항목의 축이라 입원 계산에는 쓰이지 않습니다.",
  priorAnnualPaid: "연 누적 자기부담금은 입원 자기부담 연간 상한(200만원)에만 쓰입니다. 통원에는 그 상한이 없습니다.",
};

function pending(generation: StandardizedGeneration, amount: number, reasons: string[]): CalcResult {
  return {
    status: "PENDING_UNVERIFIED", generation, amount,
    ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null,
    notes: reasons, appliedCaps: [],
  };
}

export function calcStandardized(generation: StandardizedGeneration, input: ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  const { constants, notApplied, cap, perVisitCap } = TABLE[generation];

  // 표준형/선택형은 계약자가 가입한 상품이 정하는 값이다. 계약일로 추정하지 않는다.
  const plan: Plan | undefined = input.plan;
  if (plan !== "standard" && plan !== "selective") {
    return pending(generation, amount, [
      "표준형/선택형(plan) 미지정 → 계산 불가. 보험증권의 상품명 또는 가입내역에서 확인해 주세요.",
    ]);
  }

  // `visit`은 어느 경로에서도 막지 않는 필수 축이라 여기서 한 번 읽어 아래 전부가 같은 값을 쓴다.
  const isOutpatient = input.visit === "outpatient";

  const strayList: readonly string[] = [
    ...STD_UNUSED_KEYS,
    ...(isOutpatient ? STD_INPATIENT_ONLY_KEYS : STD_OUTPATIENT_ONLY_KEYS),
  ];
  for (const key of strayList) {
    const got: unknown = (input as unknown as Record<string, unknown>)[key];
    if (got === undefined) continue;
    return pending(generation, amount, [
      STD_PATH_WHY[key] ?? `${key}은(는) 2·3세대 단건 계산에 쓰이지 않는 입력입니다.`,
      "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
      `받은 값의 형식: ${typeof got}`,
    ]);
  }

  const notes: string[] = [];
  const notAppliedList: string[] = [...notApplied.all];
  if (isOutpatient) notAppliedList.push(...notApplied.outpatient);

  if (!isOutpatient) {
    // ── 입원 ──
    const rate = constants.inpatientRate[plan];
    const capValue = constants.inpatientAnnualOwnPayCap;
    const prior = Math.max(0, input.priorAnnualPaid ?? 0);
    const remaining = Math.max(capValue - prior, 0);

    let ownPayRaw = amount * rate;
    const appliedCaps: CapCode[] = [];
    if (ownPayRaw > remaining) {
      ownPayRaw = remaining;
      appliedCaps.push(cap);
    }
    notes.push(
      `입원 자기부담은 계약일 또는 매년 계약해당일 기준 1년간 ${capValue.toLocaleString("ko-KR")}원이 상한입니다(초과분은 보험이 부담).`,
      "이 계산에 반영되지 않은 약관 한도: " + notAppliedList.join(" / "),
    );

    const s = settle(amount, ownPayRaw);
    return {
      status: "OK", generation, amount: s.amount, ownPay: s.ownPay, insurancePay: s.insurancePay,
      rateBased: Math.round(amount * rate), rateApplied: rate, minDeductible: 0,
      notes, appliedCaps,
    };
  }

  // ── 통원 ──
  const facility: Facility = input.facility ?? "clinic";
  const minDeductible = constants.outpatientMinDeductible[facility];
  // 표준형만 정률과 비교한다. 선택형은 정액 공제뿐이다.
  const rate = plan === "standard" ? constants.outpatientStandardRate : 0;
  const ownPayRaw = plan === "standard"
    ? Math.max(amount * rate, minDeductible)
    : minDeductible;

  // 회(건)당 가입금액은 계약자가 정하는 값이라 상수화할 수 없다.
  // 사용자가 준 경우에만 보험금 지급 상한으로 적용하고, 없으면 미적용 한도로 고지한다.
  // 입원에는 적용하지 않는다 — 약관의 회(건)당 한도는 외래·처방조제비 항목의 가입금액이다.
  const visitLimit = perVisitLimit(input.perVisitCoverageLimit);

  notes.push(
    plan === "standard"
      ? `통원 공제는 ${minDeductible.toLocaleString("ko-KR")}원과 의료비의 ${Math.round(rate * 100)}% 중 큰 금액입니다.`
      : `선택형 통원 공제는 정액 ${minDeductible.toLocaleString("ko-KR")}원입니다(정률 공제 없음).`,
  );
  if (visitLimit !== undefined) {
    notes.push(`입력하신 회(건)당 가입금액 ${visitLimit.toLocaleString("ko-KR")}원을 보험금 지급 한도로 적용했습니다.`);
  }
  notes.push("이 계산에 반영되지 않은 약관 한도: " + notAppliedList.join(" / "));

  const s = settle(amount, ownPayRaw, visitLimit);
  return {
    status: "OK", generation, amount: s.amount, ownPay: s.ownPay, insurancePay: s.insurancePay,
    rateBased: Math.round(amount * rate), rateApplied: rate, minDeductible,
    notes, appliedCaps: s.capped ? [perVisitCap] : [],
  };
}
