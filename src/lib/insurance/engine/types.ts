// 실손보험 계산 엔진 공통 타입

// 표준화 실손(2세대) / 착한실손(3세대) / 4세대 / 5세대.
//   1세대(2009.9 이전)는 표준약관 제정 이전이라 인용 가능한 1차 근거가 없다.
//   추정 상수를 넣지 않기 위해 계산 대상에서 제외한다 — generationFromPolicyDate의 "PRE_STANDARD".
export type Generation = "2009" | "2017" | "2021" | "2026";

export type Coverage = "benefit" | "non_benefit"; // 급여 / 비급여
export type Visit = "outpatient" | "inpatient";   // 통원 / 입원
export type Tier = "clinic" | "hospital";         // 병·의원급 / 상급종합·종합병원 (4·5세대 축)
export type Severity = "critical" | "non_critical"; // 중증 / 비중증 (5세대 비급여 전용)
export type Cause = "injury" | "disease"; // 상해 / 질병 (4세대 연간 한도 구분축)
export type Gen2021Rider = "none" | "manual_therapy" | "injection" | "mri";

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
  // 계약자가 정한 회(건)당 보험가입금액(원). 2·3세대 통원의 30만원 이내 설정값이 대표적이다.
  // 상수화할 수 없는 계약별 값이므로 사용자가 준 경우에만 적용하고, 미제공 시 미적용 고지만 한다.
  perVisitCoverageLimit?: number;
}

// OK = 계산 완료 / PENDING_UNVERIFIED = 미확정 상수 또는 필수 입력 누락으로 계산 불가(HOLD)
export type CalcStatus = "OK" | "PENDING_UNVERIFIED";
export type CapCode =
  | "GEN2009_INPATIENT_OWN_PAY_ANNUAL"
  | "GEN2009_PER_VISIT_COVERAGE_LIMIT"
  | "GEN2009_OUTPATIENT_ANNUAL_VISITS"
  | "GEN2009_PRESCRIPTION_ANNUAL_COUNT"
  | "GEN2017_INPATIENT_OWN_PAY_ANNUAL"
  | "GEN2017_PER_VISIT_COVERAGE_LIMIT"
  | "GEN2017_OUTPATIENT_ANNUAL_VISITS"
  | "GEN2017_PRESCRIPTION_ANNUAL_COUNT"
  | "GEN2021_OUTPATIENT_PER_VISIT"
  | "GEN2021_ANNUAL_COVERAGE"
  | "GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS"
  | "GEN2021_MANUAL_THERAPY_ANNUAL"
  | "GEN2021_MANUAL_THERAPY_ANNUAL_VISITS"
  | "GEN2021_INJECTION_ANNUAL"
  | "GEN2021_INJECTION_ANNUAL_VISITS"
  | "GEN2021_MRI_ANNUAL"
  | "GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL"
  | "GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"
  | "GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"
  | "GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY"
  | "GEN2026_CRITICAL_ANNUAL_COVERAGE"
  | "GEN2026_NONCRITICAL_ANNUAL_COVERAGE";

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

// ─────────────────────────────────────────────────────────────────────
// 다회 청구
//
// 1행(ClaimLine) = 약관상 **1회의 청구 단위**(통원 1회 방문, 처방전 1건, 입원 1회).
//   ⚠ 하루에 2회 이상 통원한 경우 약관이 이를 "1회로 보고 가장 높은 공제금액을 적용"하도록
//     규정하므로, 사용자가 한 행으로 합쳐 입력한다. 날짜 축을 두지 않는 이유가 이것이다.
//
// 건 사이에 이어지는 상태가 두 가지 있다.
//   1) 입원 자기부담 연간 상한 — 앞선 건이 상한을 얼마나 소진했는지에 따라 뒤 건이 달라진다.
//      ⚠ 이 상한은 **입원에만** 누적된다. 약관의 200만원 단서는 (1)상해입원 표 안에만 있다.
//   2) 연간 외래 방문·처방전 횟수 — 한도를 넘긴 행은 보상 대상이 아니다.
// 따라서 다회 계산은 행을 **순서대로** 처리한다. 총액은 순서와 무관하지만(불변식으로 고정),
// 어느 행이 상한에 걸리는지는 순서가 정한다. 입력 행 순서를 발생 순서로 본다.
// ─────────────────────────────────────────────────────────────────────
export interface ClaimLine {
  amount: number;
  visit: Visit;
  facility?: Facility; // 통원에서만 의미 있음
}

export interface MultiClaimInput {
  plan?: Plan;
  lines: ClaimLine[];
  priorAnnualPaid?: number;              // 계약해당일 기준 1년간 이미 부담한 입원 자기부담금
  priorAnnualOutpatientVisits?: number;  // 이미 사용한 외래 방문 횟수
  priorAnnualPrescriptions?: number;     // 이미 사용한 처방전 건수
  perVisitCoverageLimit?: number;        // 계약자가 정한 회(건)당 가입금액. 미제공 시 미적용
}

export interface ClaimLineResult extends CalcResult {
  index: number;    // 입력 행 순서(0-based). 결과 표와 입력 행을 잇는다
  covered: boolean; // 연간 횟수 한도를 넘겨 보상 대상에서 제외되었으면 false
}

export interface MultiClaimResult {
  status: CalcStatus;
  generation: Generation;
  lines: ClaimLineResult[];
  totalAmount: number;
  totalOwnPay: number | null;
  totalInsurancePay: number | null;
  appliedCaps: CapCode[]; // 전 행에서 실제로 구속된 한도의 합집합
  notes: string[];
}

/** 4세대는 한 계산 묶음을 동일한 (상해/질병)×(급여/비급여) 보장축으로 받는다. */
export interface Gen2021MultiClaimInput {
  cause: Cause;
  coverage: Coverage;
  visit: Visit;
  tier?: Tier;
  rider?: Gen2021Rider;
  amounts: number[];
  annualCoverageLimit?: number; // 증권상 선택 가입금액(최대 5천만원). 미입력 시 적용하지 않음
  priorAnnualInsurancePaid?: number;
  priorAnnualOutpatientVisits?: number; // 비급여 일반 통원에만 적용
  priorAnnualRiderPaid?: number;
  priorAnnualRiderVisits?: number;
}

export interface Gen2026MultiClaimInput {
  coverage: Coverage;
  visit: Visit;
  tier?: Tier;
  severity?: Severity;
  nhisCoinsuranceRate?: number;
  amounts: number[];
  priorAnnualInsurancePaid?: number;
  priorAnnualOwnPay?: number;
}
