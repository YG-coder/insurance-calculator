// 실손보험 계산 엔진 공통 타입

// 표준화 실손(2세대) / 착한실손(3세대) / 4세대 / 5세대.
//   1세대(2009.9 이전)는 표준약관 제정 이전이라 인용 가능한 1차 근거가 없다.
//   추정 상수를 넣지 않기 위해 계산 대상에서 제외한다 — generationFromPolicyDate의 "PRE_STANDARD".
export type Generation = "2009" | "2017" | "2021" | "2026";

export type Coverage = "benefit" | "non_benefit"; // 급여 / 비급여
export type Visit = "outpatient" | "inpatient";   // 통원 / 입원
export type Tier = "clinic" | "hospital";         // 병·의원급 / 상급종합·종합병원 (4·5세대 축)
export type Severity = "critical" | "non_critical"; // 중증 / 비중증 (5세대 비급여 전용)

// 2·3세대 표준약관 <표1 항목별 공제금액>의 분류축.
//   ⚠ 4·5세대의 Tier와 다른 축이다. 종합병원이 2·3세대에서는 1만5천원(hospital)이지만
//     4세대에서는 상급종합과 같은 2만원(Tier "hospital")으로 묶인다. 섞어 쓰면 안 된다.
export type Facility = "clinic" | "hospital" | "tertiary" | "pharmacy";

// 2·3세대 자기부담 유형. 표준형은 정률 공제가 있고, 선택형은 정액 공제만 있다.
//   2세대 전기(2012.12.28 세칙 개정 전) 계약에는 표준형이 없다 — 사용자가 증권을 보고 고른다.
export type Plan = "standard" | "selective";

export interface ClaimInput {
  amount: number;              // 진료비(원). 현행 로직과 동일하게 비음수 정수 가정
  coverage: Coverage;
  visit: Visit;
  tier?: Tier;                 // 급여 통원 최소공제 결정용 (미지정 시 clinic) — 4·5세대
  facility?: Facility;         // 2·3세대 통원 공제 결정용 (미지정 시 clinic)
  plan?: Plan;                 // 2·3세대 필수. 미지정 시 계산 불가(PENDING_UNVERIFIED)
  severity?: Severity;         // 5세대 비급여에서 필수
  nhisCoinsuranceRate?: number; // 5세대 급여 통원용 건강보험 본인부담률(0~1). 미확정 시 undefined
  priorAnnualPaid?: number;    // 연 누적 본인부담(자기부담 상한 계산용). 기본 0
}

// OK = 계산 완료 / PENDING_UNVERIFIED = 미확정 상수 또는 필수 입력 누락으로 계산 불가(HOLD)
export type CalcStatus = "OK" | "PENDING_UNVERIFIED";
export type CapCode =
  | "GEN2009_INPATIENT_OWN_PAY_ANNUAL"
  | "GEN2017_INPATIENT_OWN_PAY_ANNUAL"
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
  notes: string[];              // HOLD/상한/미적용 사유
  appliedCaps: CapCode[];       // 실제로 구속된 한도 코드
}
