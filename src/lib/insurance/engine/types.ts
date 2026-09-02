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

// 5세대 비급여 치료유형 축.
//   별표15(2026.8.28 현행본) 특별약관1·2는 비급여를 **보장종목 3종**으로 나눈다.
//     특별약관1(중증)  — (1)상해비급여 / (2)질병비급여 / (3)3대비급여
//     특별약관2(비중증) — (1)상해비급여 / (2)질병비급여 / (3)비급여 자기공명영상진단
//   원문이 서로를 명시적으로 배제한다.
//     특약1 제3조 (2)질병비급여① "비급여의료비(3대비급여는 제외합니다)"        — 인쇄 p.261
//     특약2 제3조 (1)상해비급여① "비급여의료비(비급여 자기공명영상진단은 제외합니다)" — 인쇄 p.288
//   따라서 3대비급여·MRI 청구를 (1)(2) 경로로 계산하는 것은 근사가 아니라 약관이 금지한 계산이다.
//   상급병실료 차액도 입원 보상 대상에서 제외되고 별도 산식(50%, 1일 평균 10만원 한도)을 갖는다.
//   (3) 보장종목과 병실료는 아직 미구현이므로, 이 축으로 식별해 계산 자체를 차단한다.
//   ⚠ 기본값을 두지 않는다. "general"이 자동 선택되면 차단의 의미가 없다.
export type Gen2026NonBenefitItem =
  | "general"             // 일반 비급여 — (1)상해비급여 / (2)질병비급여
  | "musculoskeletal_esw" // 근골격계 이학요법·체외충격파 (중증 3대비급여)
  | "injection"           // 비급여 주사료 (중증 3대비급여)
  | "mri"                 // 비급여 MRI (중증 3대비급여 / 비중증 별도 보장종목)
  | "room_charge";        // 상급병실료 차액

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
  // 5세대 비급여 치료유형. **제네릭 진입점(calculate)의 통로일 뿐** 여기서는 선택 필드다.
  // 타입 수준 강제는 Gen2026NonBenefitInput / Gen2026MultiNonBenefitInput이 담당하고,
  // 이 경로로 들어온 값은 calc2026이 런타임에서 검사해 미지정이면 PENDING_UNVERIFIED로 막는다.
  nonBenefitItem?: Gen2026NonBenefitItem;
}

// ─────────────────────────────────────────────────────────────────────
// 5세대 전용 입력. 비급여에서는 치료유형이 **필수**라서 누락이 컴파일 에러가 된다.
//   급여에는 요구하지 않는다(coverage로 판별되는 유니온).
// ─────────────────────────────────────────────────────────────────────
interface Gen2026CommonInput {
  amount: number;
  visit: Visit;
  tier?: Tier;
}

export interface Gen2026BenefitInput extends Gen2026CommonInput {
  coverage: "benefit";
  nhisCoinsuranceRate?: number;
}

export interface Gen2026NonBenefitInput extends Gen2026CommonInput {
  coverage: "non_benefit";
  severity?: Severity;                    // 미지정 시 런타임에서 PENDING_UNVERIFIED
  nonBenefitItem: Gen2026NonBenefitItem;  // 필수
  priorAnnualPaid?: number;
  perVisitCoverageLimit?: number;
}

export type Gen2026ClaimInput = Gen2026BenefitInput | Gen2026NonBenefitInput;

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
  | "GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"
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

// 5세대 다회 청구. 단건과 같은 정책 — 비급여에서 치료유형은 필수다.
interface Gen2026MultiCommonInput {
  // 5세대 연간 보험가입금액과 자기부담 누적은 (1)상해비급여 / (2)질병비급여 **각 축에 대해
  // 따로** 정해진다(특별약관1·2 제5조①). 한 계산 묶음은 하나의 원인 축만 포함한다.
  cause: Cause;
  visit: Visit;
  tier?: Tier;
  amounts: number[];
  priorAnnualInsurancePaid?: number;
}

export interface Gen2026MultiBenefitInput extends Gen2026MultiCommonInput {
  coverage: "benefit";
  nhisCoinsuranceRate?: number;
}

export interface Gen2026MultiNonBenefitInput extends Gen2026MultiCommonInput {
  coverage: "non_benefit";
  severity?: Severity;
  nonBenefitItem: Gen2026NonBenefitItem; // 필수
  priorAnnualOwnPay?: number;
  // 통원 가입금액(중증은 1회당, 비중증은 1일당). 약관상 20만원 "이내에서 계약자가 선택한 금액"
  // 이므로 상수화할 수 없다. 미제공 시 적용하지 않고 미적용 사실만 알린다.
  outpatientCoverageLimit?: number;
  priorAnnualOutpatientVisits?: number; // 중증 통원 연간 100회 한도용
  // 연간 보험가입금액. 약관 제5조①이 "N원 이내에서 계약자가 선택한 금액"으로 규정하므로
  // 상수화할 수 없다. 상해비급여·질병비급여 각 축에 대해 따로 정해진다.
  annualCoverageLimit?: number;
}

export type Gen2026MultiClaimInput =
  | Gen2026MultiBenefitInput
  | Gen2026MultiNonBenefitInput;
