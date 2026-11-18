// 표준화 실손 엔진 — 2세대(2009.10~2017.3) · 3세대(2017.4~2021.6) 공용.
//
// 표준형과 해당 2세대 선택형Ⅰ은 합계 진료비로 계산한다.
// 가입 약관이 선택형Ⅱ이면 급여 본인부담금과 보장 대상 비급여를 구분한다.
//
// 4·5세대와 다른 점 — 옮겨 적을 때 반드시 지켜야 한다:
//   1) 선택형Ⅱ는 항목별 정률을 더한다. 통원은 이 금액과 항목별 정액 중 큰 금액을 공제한다.
//   2) 지원하는 2세대 선택형Ⅰ의 통원은 약관 <표1>의 정액 공제만 적용한다.
//   3) 입원 자기부담에는 연간 200만원 상한이 있다. 이는 보험금 상한이 아니라 자기부담 상한이므로
//      settle의 insuranceCap이 아니라 ownPayRaw를 깎아야 한다(5세대 500만 상한과 같은 성질).
//   4) 통원 공제 분류축(Facility)은 4세대의 Tier와 다르다. 종합병원이 2·3세대에서는 1만5천원,
//      4세대에서는 상급종합과 같은 2만원이다. 섞어 쓰면 안 된다.
import { combinedRateAmounts, roundedRateAmount, rateAmountExceeds } from "../common/exactMoney";
import { CapCode, ClaimInput, CalcResult, Plan, StandardizedSplitAmounts } from "./types";
import { GEN2009, GEN2009_NOT_APPLIED, GEN2017, GEN2017_NOT_APPLIED } from "./constants";
import { REGULATORY_RULES } from "./regulatoryRules";
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
 * `perVisitCoverageLimit`을 사용한다. 선택형Ⅱ는 `splitAmounts`도 사용한다.
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
  "basicLimits",
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

export function standardizedPlanBlock(generation: StandardizedGeneration, plan: unknown): string | null {
  if (generation === "2017" && plan === "selective") {
    return "3세대 선택형은 계약의 공제 기준을 확인해야 하므로 계산을 보류합니다.";
  }
  if (plan === "standard" || plan === "selective" || plan === "selectiveII") return null;
  return "표준형/선택형(plan) 미지정 → 계산 불가. 보험증권의 상품명 또는 가입내역에서 확인해 주세요.";
}

const selectiveIIRates = REGULATORY_RULES.GEN23_SELECTIVE_II_COST_SHARE.value;

export function isWon(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function standardizedSplitBlock(
  plan: Plan | undefined,
  amount: number,
  visit: unknown,
  facility: unknown,
  splitAmounts?: StandardizedSplitAmounts,
): string | null {
  if (plan !== "selectiveII") {
    return splitAmounts === undefined ? null : "급여·비급여 분리 금액은 선택형Ⅱ 계산에만 쓰입니다.";
  }
  if (!isWon(amount) || !isWon(splitAmounts?.benefit) || !isWon(splitAmounts?.nonBenefit)
    || splitAmounts.benefit + splitAmounts.nonBenefit !== amount) {
    return "선택형Ⅱ는 급여 본인부담금과 보장 대상 비급여를 각각 원 단위 정수로 입력해야 합니다. 두 금액의 합은 총 진료비와 같아야 합니다.";
  }
  if (visit !== "inpatient" && (visit !== "outpatient" || typeof facility !== "string"
    || !Object.hasOwn(GEN2009.outpatientMinDeductible, facility))) {
    return "선택형Ⅱ의 청구 건마다 입원 또는 통원을 선택하고, 통원은 의료기관이나 약국 구분을 확인해 주세요.";
  }
  return null;
}

export function calcStandardized(generation: StandardizedGeneration, input: ClaimInput): CalcResult {
  const enteredAmount = input.amount;
  const amount = normalizeAmount(enteredAmount);
  const { constants, notApplied, cap, perVisitCap } = TABLE[generation];

  // 표준형/선택형은 계약자가 가입한 상품이 정하는 값이다. 계약일로 추정하지 않는다.
  const plan: Plan | undefined = input.plan;
  const planBlock = standardizedPlanBlock(generation, plan);
  if (planBlock !== null) return pending(generation, amount, [planBlock]);

  // `visit`은 어느 경로에서도 막지 않는 필수 축이라 여기서 한 번 읽어 아래 전부가 같은 값을 쓴다.
  const visit = input.visit;
  const isOutpatient = visit === "outpatient";

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

  const splitAmounts = input.splitAmounts;
  const facility = isOutpatient ? input.facility : undefined;
  const splitBlock = standardizedSplitBlock(plan, enteredAmount, visit, facility, splitAmounts);
  if (splitBlock !== null) return pending(generation, amount, [splitBlock]);
  const splitDeduction = splitAmounts === undefined ? null : combinedRateAmounts(
    splitAmounts.benefit, selectiveIIRates.benefit, splitAmounts.nonBenefit, selectiveIIRates.nonBenefit,
  );

  const notes: string[] = [];
  if (splitDeduction) {
    notes.push(`선택형Ⅱ 정률 공제는 급여 본인부담금의 ${Math.round(selectiveIIRates.benefit * 100)}%와 보장 대상 비급여의 ${Math.round(selectiveIIRates.nonBenefit * 100)}%를 더한 금액입니다.`);
  }
  const notAppliedList: string[] = [...notApplied.all];
  if (isOutpatient) notAppliedList.push(...notApplied.outpatient);

  if (!isOutpatient) {
    // ── 입원 ──
    const rate = plan === "standard" ? constants.inpatientRate.standard : GEN2009.inpatientRate.selective;
    const capValue = constants.inpatientAnnualOwnPayCap;
    const priorAnnualPaid = input.priorAnnualPaid;
    if (splitDeduction && !isWon(priorAnnualPaid)) {
      return pending(generation, amount, ["선택형Ⅱ 입원은 이미 부담한 연간 입원 자기부담금을 입력해 주세요. 기존 부담액이 없으면 0을 입력하세요."]);
    }
    if (priorAnnualPaid === undefined) notes.push("기존 입원 자기부담금 누적액을 0원으로 가정한 계산입니다. 기존 누적액이 있으면 결과가 달라집니다.");
    const prior = Math.max(0, priorAnnualPaid ?? 0);
    const remaining = Math.max(capValue - prior, 0);

    const rateBased = splitDeduction?.rounded ?? roundedRateAmount(amount, rate);
    let ownPayRaw = rateBased;
    const appliedCaps: CapCode[] = [];
    if (splitDeduction ? splitDeduction.exceeds(remaining) : rateAmountExceeds(amount, rate, remaining)) {
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
      rateBased, rateApplied: splitDeduction ? null : rate, minDeductible: 0,
      notes, appliedCaps,
    };
  }

  // ── 통원 ──
  const minDeductible = constants.outpatientMinDeductible[facility ?? "clinic"];
  // 2세대 선택형Ⅰ의 통원은 정액 공제만 적용한다.
  const rate = plan === "standard" ? constants.outpatientStandardRate : 0;
  const rateBased = splitDeduction?.rounded ?? roundedRateAmount(amount, rate);
  const ownPayRaw = Math.max(rateBased, minDeductible);

  // 회(건)당 가입금액은 계약자가 정하는 값이라 상수화할 수 없다.
  // 사용자가 준 경우에만 보험금 지급 상한으로 적용하고, 없으면 미적용 한도로 고지한다.
  // 입원에는 적용하지 않는다 — 약관의 회(건)당 한도는 외래·처방조제비 항목의 가입금액이다.
  const enteredLimit = input.perVisitCoverageLimit;
  if (splitDeduction && enteredLimit !== undefined && !isWon(enteredLimit)) {
    return pending(generation, amount, ["회(건)당 보험가입금액은 0 이상의 원 단위 정수로 입력해 주세요."]);
  }
  const visitLimit = perVisitLimit(enteredLimit);

  notes.push(
    splitDeduction
      ? `통원 공제는 ${minDeductible.toLocaleString("ko-KR")}원과 급여·비급여 정률 공제의 합계 중 큰 금액입니다.`
      : plan === "standard"
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
    rateBased, rateApplied: splitDeduction ? null : rate, minDeductible,
    notes, appliedCaps: s.capped ? [perVisitCap] : [],
  };
}
