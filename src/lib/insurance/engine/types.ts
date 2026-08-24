// 실손보험 계산 엔진 공통 타입

export type Generation = "2021" | "2026"; // 4세대 / 5세대

export type Coverage = "benefit" | "non_benefit"; // 급여 / 비급여
export type Visit = "outpatient" | "inpatient";   // 통원 / 입원
export type Tier = "clinic" | "hospital";         // 병·의원급 / 상급종합·종합병원
export type Severity = "critical" | "non_critical"; // 중증 / 비중증 (5세대 비급여 전용)

export interface ClaimInput {
  amount: number;              // 진료비(원). 현행 로직과 동일하게 비음수 정수 가정
  coverage: Coverage;
  visit: Visit;
  tier?: Tier;                 // 급여 통원 최소공제 결정용 (미지정 시 clinic)
  severity?: Severity;         // 5세대 비급여에서 필수
  nhisCoinsuranceRate?: number; // 5세대 급여 통원용 건강보험 본인부담률(0~1). 미확정 시 undefined
  priorAnnualPaid?: number;    // 연 누적 본인부담(500만 상한 계산용). 기본 0
}

// OK = 계산 완료 / PENDING_UNVERIFIED = 미확정 상수로 계산 불가(HOLD)
export type CalcStatus = "OK" | "PENDING_UNVERIFIED";
export type CapCode =
  | "GEN2021_OUTPATIENT_PER_VISIT"
  | "GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL"
  | "GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"
  | "GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"
  | "GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY";

export interface CalcResult {
  status: CalcStatus;
  generation: Generation;
  amount: number;
  ownPay: number | null;        // 본인부담금
  insurancePay: number | null;  // 보험 적용 금액
  rateBased: number | null;     // 정률 적용액 (최소공제 비교 전, = 금액 × 자기부담률)
  rateApplied: number | null;   // 적용 자기부담률
  minDeductible: number | null; // 적용 최소공제
  notes: string[];              // HOLD/상한/미확정 사유
  appliedCaps: CapCode[];       // 실제로 구속된 한도 코드
}
