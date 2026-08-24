import { Coverage, Tier } from "./types";
import { REGULATORY_RULES as R } from "./regulatoryRules";

const manWon = (value: number) => `${(value / 10_000).toLocaleString("ko-KR")}만원`;

// ─────────────────────────────────────────────
// 4세대 (generation 2021) — 현행 배포 로직 재현. 회귀 기준선.
// ─────────────────────────────────────────────
export const GEN2021 = {
  rate: {
    benefit: {
      inpatient: R.GEN2021_BENEFIT_INPATIENT_RATE.value,
      outpatient: R.GEN2021_BENEFIT_OUTPATIENT_RATE.value,
    },
    non_benefit: {
      inpatient: R.GEN2021_NON_BENEFIT_INPATIENT_RATE.value,
      outpatient: R.GEN2021_NON_BENEFIT_OUTPATIENT_RATE.value,
    },
  } as Record<Coverage, Record<"inpatient" | "outpatient", number>>,
  outpatientMinDeductible: {
    benefit: {
      clinic: R.GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN.value,
      hospital: R.GEN2021_BENEFIT_OUTPATIENT_HOSPITAL_MIN.value,
    } as Record<Tier, number>,
    non_benefit: R.GEN2021_NON_BENEFIT_OUTPATIENT_MIN.value, // 의료기관 구분 없음
  },
  outpatientPerVisitLimit: R.GEN2021_OUTPATIENT_PER_VISIT_LIMIT.value,
} as const;

// ── 4세대에서 확인되었으나 이번 엔진이 적용하지 않는 한도 ──────────────
//   1건 계산기의 입력 모델(ClaimInput)로는 표현할 수 없다. 결과에 미적용 사실을 명시한다.
//   검증 상태 : CONFIRMED (위 근거 1·2와 동일 출처)
//
//   ⚠ 적용 범위를 반드시 구분한다. 급여 청구에 적용되지 않는 제한을 급여 결과에
//     안내하면 사용자가 자신에게도 적용되는 것으로 오인한다.
//
//   ⚠ 급여 통원에는 연간 횟수 한도가 없다. 급여 약관의 "90회"는 계약 종료 후 계속 중인
//     통원을 추가 보상하는 특수 규정이며 일반 한도가 아니다. 상수화 금지.
export const GEN2021_NOT_APPLIED = {
  // 급여·비급여, 입원·통원 전부 해당.
  //   (상해/질병) × (급여/비급여) 각 축의 연간 한도이며 축 안에서 입원·통원이 합산 소진된다.
  all: [`연간 보상한도 ${manWon(R.GEN2021_ANNUAL_LIMIT.value)}(상해·질병별 보장 안에서 입원·통원 합산)`],

  // 비급여 전용. 약관상 항목별 한도이며 입원·통원을 구분해 규정하지 않는다.
  nonBenefit: [
    `3대비급여 항목별 한도(도수 ${manWon(R.GEN2021_MANUAL_THERAPY_ANNUAL_LIMIT.value)}·주사 ${manWon(R.GEN2021_INJECTION_ANNUAL_LIMIT.value)}·MRI ${manWon(R.GEN2021_MRI_ANNUAL_LIMIT.value)})`,
  ],

  // 비급여 통원 전용. 약관 문언이 "통원 100회"로 통원을 명시한다.
  nonBenefitOutpatient: [
    `비급여 통원 연간 ${R.GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS.value}회 한도(계약해당일 기준 1년)`,
  ],
} as const;

// ─────────────────────────────────────────────
// 5세대 (generation 2026).
//   모든 값은 regulatoryRules.ts의 금융위 원문 직독 A 확정 규칙에서 파생한다.
// ─────────────────────────────────────────────
export const GEN2026 = {
  benefit: {
    inpatientRate: R.GEN2026_BENEFIT_INPATIENT_RATE.value,
    outpatient: {
      floorRate: R.GEN2026_BENEFIT_OUTPATIENT_FLOOR_RATE.value,
      minDeductible: R.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.value,
    },
  },
  nonBenefit: {
    critical: {
      inpatientRate: R.GEN2026_CRITICAL_INPATIENT_RATE.value,
      outpatientRate: R.GEN2026_CRITICAL_OUTPATIENT_RATE.value,
      outpatientMinDeductible: R.GEN2026_CRITICAL_OUTPATIENT_MIN.value,
      outpatientPerVisitLimit: R.GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT.value,
      annualLimit: R.GEN2026_CRITICAL_ANNUAL_LIMIT.value,
      annualOwnPayCap: R.GEN2026_CRITICAL_ANNUAL_OWN_PAY_CAP.value,
    },
    nonCritical: {
      inpatientRate: R.GEN2026_NONCRITICAL_INPATIENT_RATE.value,
      outpatientRate: R.GEN2026_NONCRITICAL_OUTPATIENT_RATE.value,
      outpatientMinDeductible: R.GEN2026_NONCRITICAL_OUTPATIENT_MIN.value,
      inpatientPerVisitLimit: R.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT.value,
      outpatientPerDayLimit: R.GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY_LIMIT.value,
      annualLimit: R.GEN2026_NONCRITICAL_ANNUAL_LIMIT.value,
    },
  },
} as const;
