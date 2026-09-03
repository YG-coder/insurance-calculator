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
  annualLimitMaximum: R.GEN2021_ANNUAL_LIMIT.value,
  nonBenefitOutpatientAnnualVisits: R.GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS.value,
  rider: {
    deductRate: R.GEN2021_RIDER_DEDUCT_RATE.value,
    minDeductible: R.GEN2021_RIDER_MIN_DEDUCTIBLE.value,
    manual_therapy: { annualLimit: R.GEN2021_MANUAL_THERAPY_ANNUAL_LIMIT.value, annualVisits: R.GEN2021_MANUAL_THERAPY_ANNUAL_VISITS.value },
    injection: { annualLimit: R.GEN2021_INJECTION_ANNUAL_LIMIT.value, annualVisits: R.GEN2021_INJECTION_ANNUAL_VISITS.value },
    mri: { annualLimit: R.GEN2021_MRI_ANNUAL_LIMIT.value, annualVisits: null },
  },
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
      // 계약자가 정하는 값의 상한선. 사용자가 증권의 값을 주지 않으면 적용하지 않는다.
      outpatientPerVisitLimitMax: R.GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT_MAX.value,
      outpatientAnnualVisits: R.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS.value,
      annualLimitMax: R.GEN2026_CRITICAL_ANNUAL_LIMIT_MAX.value,
      annualDeductibleCap: R.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.value,
    },
    nonCritical: {
      inpatientRate: R.GEN2026_NONCRITICAL_INPATIENT_RATE.value,
      outpatientRate: R.GEN2026_NONCRITICAL_OUTPATIENT_RATE.value,
      outpatientMinDeductible: R.GEN2026_NONCRITICAL_OUTPATIENT_MIN.value,
      inpatientPerVisitLimit: R.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT.value,
      /** 1회당 300만원 한도가 적용되는 의료기관 종별. **여기가 유일한 원천이다**. */
      inpatientPerVisitLimitTiers: R.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT_TIERS.value,
      outpatientPerDayLimitMax: R.GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY_LIMIT_MAX.value,
      annualLimitMax: R.GEN2026_NONCRITICAL_ANNUAL_LIMIT_MAX.value,
    },
  },
  // 별도 보장종목 — 특약1 (3)3대비급여 / 특약2 (3)비급여 자기공명영상진단.
  //   ⚠ 일반 (1)(2)의 통원 가입금액·연간 보험가입금액은 여기 적용되지 않는다(제5조①단서·③).
  //   ⚠ 한도는 상해·질병을 합산한다. cause 축이 없다.
  specialItem: {
    deductibleFixed: R.GEN2026_THIRD_DEDUCTIBLE_FIXED.value,
    deductibleRate: R.GEN2026_THIRD_DEDUCTIBLE_RATE.value,
    msk: {
      annualCoverage: R.GEN2026_MSK_ANNUAL_COVERAGE.value,
      annualVisits: R.GEN2026_MSK_ANNUAL_VISITS.value,
      initialApprovedVisits: R.GEN2026_MSK_INITIAL_APPROVED_VISITS.value,
      approvalStep: R.GEN2026_MSK_APPROVAL_STEP.value,
    },
    injection: {
      annualCoverage: R.GEN2026_INJECTION_ANNUAL_COVERAGE.value,
      annualVisits: R.GEN2026_INJECTION_ANNUAL_VISITS.value,
    },
    criticalMri: {
      annualCoverage: R.GEN2026_CRITICAL_MRI_ANNUAL_COVERAGE.value,
    },
    nonCriticalMri: {
      deductibleFixed: R.GEN2026_NONCRITICAL_MRI_DEDUCTIBLE_FIXED.value,
      deductibleRate: R.GEN2026_NONCRITICAL_MRI_DEDUCTIBLE_RATE.value,
      annualCoverage: R.GEN2026_NONCRITICAL_MRI_ANNUAL_COVERAGE.value,
    },
    /** 제3조(3)②가 (1)(2)로 보내는 약제. **여기가 유일한 원천이다** — 어디서도 다시 나열하지 않는다. */
    injectionGeneralRouteDrugs: R.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS.value,
    /** 지급 0원 행위의 횟수 소진은 원문 미확정(HOLD). null이면 두 해석을 비교한다. */
    countOnZeroPay: R.GEN2026_SPECIAL_ITEM_COUNT_ON_ZERO_PAY.value,
  },
} as const;

// ─────────────────────────────────────────────
// 2세대(표준화 실손, 2009.10~2017.3) / 3세대(착한실손, 2017.4~2021.6)
//   두 세대의 기본형 산식은 같다. 근거 약관이 다르므로 상수는 세대별로 분리해 파생한다.
//   ⚠ 급여·비급여를 합한 금액에 단일 정률을 적용한다. 급여/비급여로 요율이 갈리는 것은 4세대부터다.
//   ⚠ 선택형에는 통원 정률공제가 없다(정액 공제만). standardRate를 곱하지 말 것.
// ─────────────────────────────────────────────
export const GEN2009 = {
  inpatientRate: {
    standard: R.GEN2009_INPATIENT_RATE_STANDARD.value,
    selective: R.GEN2009_INPATIENT_RATE_SELECTIVE.value,
  },
  inpatientAnnualOwnPayCap: R.GEN2009_INPATIENT_ANNUAL_OWN_PAY_CAP.value,
  outpatientStandardRate: R.GEN2009_OUTPATIENT_RATE_STANDARD.value,
  outpatientMinDeductible: R.GEN2009_OUTPATIENT_MIN_DEDUCTIBLE.value,
  outpatientAnnualVisits: R.GEN2009_OUTPATIENT_ANNUAL_VISITS.value,
  prescriptionAnnualCount: R.GEN2009_PRESCRIPTION_ANNUAL_COUNT.value,
} as const;

export const GEN2017 = {
  inpatientRate: {
    standard: R.GEN2017_INPATIENT_RATE_STANDARD.value,
    selective: R.GEN2017_INPATIENT_RATE_SELECTIVE.value,
  },
  inpatientAnnualOwnPayCap: R.GEN2017_INPATIENT_ANNUAL_OWN_PAY_CAP.value,
  outpatientStandardRate: R.GEN2017_OUTPATIENT_RATE_STANDARD.value,
  outpatientMinDeductible: R.GEN2017_OUTPATIENT_MIN_DEDUCTIBLE.value,
  outpatientAnnualVisits: R.GEN2017_OUTPATIENT_ANNUAL_VISITS.value,
  prescriptionAnnualCount: R.GEN2017_PRESCRIPTION_ANNUAL_COUNT.value,
} as const;

// ── 2·3세대에서 확인되었으나 1건 계산기의 입력 모델로 표현할 수 없는 한도 ──────
//   계약자가 정하는 가입금액(입원 5천만·통원 회당 30만)은 상수가 아니라 계약별 값이므로
//   임의로 적용하지 않고 미적용 사실만 알린다.
export const GEN2009_NOT_APPLIED = {
  all: [
    `상급병실료 차액(차액의 ${R.GEN2009_UPPER_ROOM_DEDUCT_RATE.value * 100}% 공제·1일 평균 ${manWon(R.GEN2009_UPPER_ROOM_DAILY_CAP.value)} 한도)`,
    `보험가입금액 한도(입원 하나의 상해당 최고 ${manWon(R.GEN2009_INPATIENT_COVERAGE_MAX.value)}, 통원 외래·처방조제 회(건)당 합산 최고 ${manWon(R.GEN2009_OUTPATIENT_COVERAGE_MAX.value)} — 계약 시 정한 금액)`,
  ],
  outpatient: [
    `매년 계약해당일 기준 1년간 외래 ${R.GEN2009_OUTPATIENT_ANNUAL_VISITS.value}회·처방전 ${R.GEN2009_PRESCRIPTION_ANNUAL_COUNT.value}건 한도`,
  ],
} as const;

export const GEN2017_NOT_APPLIED = {
  all: [
    `상급병실료 차액(차액의 ${R.GEN2017_UPPER_ROOM_DEDUCT_RATE.value * 100}% 공제·1일 평균 ${manWon(R.GEN2017_UPPER_ROOM_DAILY_CAP.value)} 한도)`,
    `보험가입금액 한도(입원 하나의 상해당 최고 ${manWon(R.GEN2017_INPATIENT_COVERAGE_MAX.value)}, 통원 외래·처방조제 회(건)당 합산 최고 ${manWon(R.GEN2017_OUTPATIENT_COVERAGE_MAX.value)} — 계약 시 정한 금액)`,
    `3대비급여 특별약관(도수·체외충격파·증식 ${manWon(R.GEN2017_RIDER_MANUAL_THERAPY_ANNUAL_LIMIT.value)}·${R.GEN2017_RIDER_MANUAL_THERAPY_ANNUAL_VISITS.value}회, 주사료 ${manWon(R.GEN2017_RIDER_INJECTION_ANNUAL_LIMIT.value)}·${R.GEN2017_RIDER_INJECTION_ANNUAL_VISITS.value}회, MRI/MRA ${manWon(R.GEN2017_RIDER_MRI_ANNUAL_LIMIT.value)}) — 별도 특약이며 기본형 계산에 포함되지 않습니다`,
  ],
  outpatient: [
    `매년 계약해당일 기준 1년간 외래 ${R.GEN2017_OUTPATIENT_ANNUAL_VISITS.value}회·처방전 ${R.GEN2017_PRESCRIPTION_ANNUAL_COUNT.value}건 한도`,
  ],
} as const;
