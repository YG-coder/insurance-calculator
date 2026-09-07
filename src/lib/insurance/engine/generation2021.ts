// 4세대 실손(현행) 엔진.
// 2026-08-24: 금액 종결을 공통 settle()에 위임한다.
//   - R-1: 자기부담금이 진료비를 초과하던 결함 수정(소액 통원 경계값).
//   - R-2: 원 단위 정수로 확정해 반환 → 표시 계층에서 합계가 어긋나지 않는다.
//   - H-2b: 통원 회당 보험금 지급 한도 20만원 적용. 급여·비급여 동일, 입원은 대상 아님.
//           연간 100회·연간 5천만원·3대비급여 항목별 한도는 입력 모델상 적용 불가 →
//           notes로 미적용 사실을 반환한다. 고지는 급여/비급여·입원/통원 적용 범위에 맞춰
//           구성한다(GEN2021_NOT_APPLIED).
//   의도된 출력 변경은 tests/generation2021.test.ts의 INTENDED_DIVERGENCES에 등록되어 있다.
import { ClaimInput, CalcResult } from "./types";
import { GEN2021, GEN2021_NOT_APPLIED } from "./constants";
import { settle, normalizeAmount } from "../common/settle";

/* ────────────────────────────────────────────────────────────────────────
 * 입력 소유권과 종별 값 검증 (G-34C)
 *
 * 이 엔진이 읽는 축은 `amount`·`coverage`·`visit`·`tier` 넷뿐이고, `tier`는 그중에서도
 * **급여 통원**만 소비한다(실측: 4경로군 × 35축에서 접근자 호출과 결과 변화).
 *
 * ⚠ 제네릭 라우터 `calculate()`는 세대별 소유 필드만 **지연 투영**해 넘기므로 이 검사에
 *   걸리지 않는다. 라우터의 G-34A 안내·순서·반환 계약이 그대로 앞선다.
 * ⚠ 값이 `0`이어도 막고 `undefined`만 미제공으로 본다. 각 키를 **한 번만** 읽는다.
 * ⚠ 안내에 받은 값 자체를 넣지 않고 `typeof`만 넣는다(형제 파일들의 G-15 계약).
 * ──────────────────────────────────────────────────────────────────────── */
const GEN2021_UNUSED_KEYS = [
  "amounts", "lines", "stays", "roomChargeTotal", "inpatientDays", "generation",
  "cause", "severity", "facility", "plan", "route", "item", "rider", "nonBenefitItem",
  "injectionPurpose", "nhisCoinsuranceRate", "perVisitCoverageLimit",
  "outpatientCoverageLimit", "annualCoverageLimit", "priorAnnualPaid",
  "priorAnnualDeductible", "priorAnnualInpatientDeductible", "priorAnnualInsurancePaid",
  "priorAnnualRiderPaid", "priorAnnualOutpatientVisits", "priorAnnualOutpatientDays",
  "priorAnnualPrescriptions", "priorAnnualRiderVisits", "approvedThroughVisit",
  "priorAnnualCoveredCount", "priorAnnualTreatmentActCount",
] as const;

/** 이 진입점의 실패 반환 — 형제 엔진들과 같은 모양이다(검증된 `amount` 보존, 나머지는 null). */
function pending(amount: number, reasons: string[]): CalcResult {
  return {
    status: "PENDING_UNVERIFIED", generation: "2021", amount,
    ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null,
    notes: reasons, appliedCaps: [],
  };
}

export function calc2021(input: ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  // ⚠ `coverage`·`visit`을 **한 번씩만** 읽는다. 종전에는 각각 2~3회 읽어(경로 판정 1 +
  //   요율 표 인덱싱 1 + 안내 구성 1), 값이 달라지는 접근자에서 판정에 쓴 값과 산식·안내에
  //   쓴 값이 갈릴 수 있었다. 아래 전부가 이 두 지역 변수 하나씩만 쓴다.
  const coverage = (input as { coverage: ClaimInput["coverage"] }).coverage;
  const visit = (input as { visit: ClaimInput["visit"] }).visit;
  const isOutpatient = visit === "outpatient";

  for (const key of GEN2021_UNUSED_KEYS) {
    const got: unknown = (input as unknown as Record<string, unknown>)[key];
    if (got === undefined) continue;
    return pending(amount, [
      `${key}은(는) 4세대 단건 계산에 쓰이지 않는 입력입니다.`,
      "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
      `받은 값의 형식: ${typeof got}`,
    ]);
  }

  // ── 의료기관 종별 (G-34C) ──────────────────────────────────────────
  //   급여 통원만 소유한다. 급여 입원은 약관이 정률만 정하고, 비급여 통원의 최소공제는
  //   종별 구분이 없으며(GEN2021.outpatientMinDeductible.non_benefit), 비급여 입원에는
  //   최소공제 자체가 없다.
  //   ⚠ 판정식은 아래 소비 분기와 **같은 모양**이다(`isOutpatient && coverage === "benefit"`).
  //   ⚠ 허용값은 `Tier` = "clinic" | "hospital" 두 가지뿐이다. `"tertiary"`는 2·3세대
  //     `Facility`의 값이고 4세대 표에는 키가 없다 — 넘어오면 `md[tier]`가 `undefined`가 되어
  //     `Math.max(amount * rate, undefined)`가 **NaN**이 되고, 그 NaN이 `settle()`의
  //     `Number.isFinite` 폴백에 걸려 **자기부담 0원 = 보험금 전액 지급**으로 끝났다
  //     (실측 3만원 급여 통원: clinic 10,000 · hospital 20,000 · tertiary **0**).
  //     `ownPay + insurancePay === amount` 불변식은 유지되므로 하류 검사가 잡지 못한다.
  //     `calc2026`이 같은 자리에서 이미 두 값만 받는다 — 그 계약과 일치시킨다.
  //   ⚠ `undefined`의 뜻은 바꾸지 않는다 — 종전대로 병·의원급 최소공제로 계산한다. 이 폴백에
  //     약관 근거를 붙이지 않는다. 유지하는 것은 약관이 정한 값이 아니라 **기존 동작**이다.
  //   ⚠ 한 번만 읽고, 그 값을 아래 산식이 그대로 쓴다.
  const tierRaw: unknown = (input as { tier?: unknown }).tier;
  const ownsTier = isOutpatient && coverage === "benefit";
  if (!ownsTier) {
    if (tierRaw !== undefined) {
      return pending(amount, [
        "의료기관 종별(tier)은 4세대 급여 통원의 최소공제만 가릅니다. 급여 입원은 약관이 정률만 정하고, 비급여 통원의 최소공제는 종별 구분이 없으며, 비급여 입원에는 최소공제가 없습니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값의 형식: ${typeof tierRaw}`,
      ]);
    }
  } else if (tierRaw !== undefined && tierRaw !== "clinic" && tierRaw !== "hospital") {
    return pending(amount, [
      `급여 통원: 의료기관 종별(tier)은 "clinic" 또는 "hospital"이어야 합니다. 최소공제금액이 종별로 다르므로(병·의원급 ${GEN2021.outpatientMinDeductible.benefit.clinic.toLocaleString("ko-KR")}원 / 상급종합·종합병원 ${GEN2021.outpatientMinDeductible.benefit.hospital.toLocaleString("ko-KR")}원) 값을 확인하기 전에는 계산하지 않습니다.`,
      "\"tertiary\"는 2·3세대 의료기관 구분(facility)의 값이라 4세대 종별로는 받지 않습니다.",
      `받은 값의 형식: ${typeof tierRaw}`,
    ]);
  }

  const rate = GEN2021.rate[coverage][visit];

  let minDeductible = 0;
  if (isOutpatient) {
    if (coverage === "benefit") {
      // 여기 오는 tierRaw는 `undefined`·"clinic"·"hospital" 셋뿐이다(위 검사가 나머지를
      // 거부했다). `?? "clinic"`을 쓰지 않는 이유는 그것이 `null`까지 병·의원급으로
      // 해석하기 때문이고, 값 목록을 여기서 다시 좁히는 편이 검사와 산식이 어긋날 여지를
      // 남기지 않는다. `undefined`와 "clinic"은 같은 병·의원급 공제로 간다 — 종전 그대로다.
      const tier = tierRaw === "hospital" ? "hospital" : "clinic";
      minDeductible = GEN2021.outpatientMinDeductible.benefit[tier];
    } else {
      minDeductible = GEN2021.outpatientMinDeductible.non_benefit;
    }
  }

  // 통원에만 회당 보험금 지급 한도를 적용한다. 입원에는 회당 한도가 없다.
  const cap = isOutpatient ? GEN2021.outpatientPerVisitLimit : undefined;
  const s = settle(amount, Math.max(amount * rate, minDeductible), cap);

  // 미적용 한도 고지는 실제 적용 범위에 맞춰 구성한다.
  // 급여 청구에 적용되지 않는 제한(비급여 100회·3대비급여)을 급여 결과에 안내하지 않는다.
  const notApplied: string[] = [...GEN2021_NOT_APPLIED.all];
  if (coverage === "non_benefit") {
    notApplied.push(...GEN2021_NOT_APPLIED.nonBenefit);
    if (isOutpatient) notApplied.push(...GEN2021_NOT_APPLIED.nonBenefitOutpatient);
  }
  const notes: string[] = [
    "이 계산에 반영되지 않은 약관 한도: " + notApplied.join(" / "),
  ];

  return {
    status: "OK",
    generation: "2021",
    amount: s.amount,
    ownPay: s.ownPay,
    insurancePay: s.insurancePay,
    rateBased: Math.round(amount * rate),
    rateApplied: rate,
    minDeductible,
    notes,
    appliedCaps: s.capped ? ["GEN2021_OUTPATIENT_PER_VISIT"] : [],
  };
}
