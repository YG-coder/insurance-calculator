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
//   별표15(2026.5.6 연혁본, 2026.8.28 공포본에서도 문언 동일 확인) 특별약관1·2는
//   비급여를 **보장종목 3종**으로 나눈다.
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
  // 2·3세대 전용 — 입원 자기부담 상한 200만원의 연 누적 자기부담금. 기본 0.
  //   ⚠ 5세대는 이 필드를 읽지 않는다. 5세대 500만원 상한은 자기부담금이 아니라
  //     약관상 **공제금액**을 누적하므로 별도 필드(priorAnnualDeductible)를 쓴다.
  priorAnnualPaid?: number;
  // 5세대 전용 — 특별약관1 제5조⑤ 상급종합·종합병원 입원 공제금액의 연 누적. 기본 0.
  priorAnnualDeductible?: number;
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
  // ⚠ 두 축은 비급여 특별약관의 금액 축이라 급여에는 대응 축이 없다(G-30).
  //   종전에는 선언 자체가 없어 리터럴만 막혔고(초과 속성 검사), 변수 경유·외부 데이터는
  //   통과해 런타임이 **조용히 폐기**했다(실측: 접근자 호출 0회). 타입과 런타임을 함께 닫는다.
  priorAnnualDeductible?: never;
  perVisitCoverageLimit?: never;
  // ⚠ 두 축은 비급여 특별약관이 만든 구분이라 급여에는 대응 축이 없다(G-31). 종전에는
  //   선언 자체가 없어 리터럴만 막혔고(초과 속성 검사), 변수 경유·외부 데이터는 통과해
  //   런타임이 **조용히 폐기**했다(실측: 접근자 호출 0회). 타입과 런타임을 함께 닫는다.
  //   ⚠ `nhisCoinsuranceRate`는 여기서 닫지 못한다 — 급여 **통원**은 소비하고 **입원**은
  //     쓰지 않는데, 유니온을 `visit`으로 쪼개면 호출부가 `visit`을 변수로 넘기므로 정상
  //     화면이 `as` 없이 컴파일되지 않는다. 그 축은 런타임으로만 닫았다(G-30이 같은 이유로
  //     `outpatientCoverageLimit`·`priorAnnualDeductible`을 런타임으로만 닫았다).
  severity?: never;
  nonBenefitItem?: never;
}

export interface Gen2026NonBenefitInput extends Gen2026CommonInput {
  coverage: "non_benefit";
  severity?: Severity;                    // 미지정 시 런타임에서 PENDING_UNVERIFIED
  nonBenefitItem: Gen2026NonBenefitItem;  // 필수
  // ⚠ 국민건강보험이 정한 **급여** 항목의 본인부담률이라 비급여에는 대응 축이 없다(G-31).
  //   종전에는 선언조차 없어 리터럴만 막혔고, 변수 경유는 통과해 조용히 폐기됐다.
  nhisCoinsuranceRate?: never;
  // 특별약관1 제5조⑤ 500만원 상한의 연 누적 **공제금액**. 최종 자기부담금이 아니다.
  priorAnnualDeductible?: number;
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
  | "GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"
  | "GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"
  | "GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"
  | "GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY"
  | "GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"
  | "GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS"
  | "GEN2026_CRITICAL_ANNUAL_COVERAGE"
  | "GEN2026_NONCRITICAL_ANNUAL_COVERAGE"
  // 특별약관1 (3)3대비급여 / 특별약관2 (3)비급여 자기공명영상진단의 항목별 한도.
  //   ⚠ 일반 (1)(2) 한도와 별개다. 상해·질병을 합산한다(<표1> "각 상해·질병 치료행위를 합산하여").
  | "GEN2026_MSK_ANNUAL_COVERAGE"
  | "GEN2026_MSK_ANNUAL_VISITS"
  | "GEN2026_INJECTION_ANNUAL_COVERAGE"
  | "GEN2026_INJECTION_ANNUAL_VISITS"
  | "GEN2026_CRITICAL_MRI_ANNUAL_COVERAGE"
  | "GEN2026_NONCRITICAL_MRI_ANNUAL_COVERAGE"
  // 상급병실료 차액. ⚠ 일반 (1)(2) 표 안의 행이므로 연간 한도는 일반 보상금액과 공유하지만,
  //   구속 사유를 구분해 보여주기 위해 CapCode는 따로 둔다.
  | "GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT"
  | "GEN2026_ROOM_CHARGE_ANNUAL_COVERAGE";

export interface CalcResult {
  status: CalcStatus;
  generation: Generation;
  amount: number;
  ownPay: number | null;        // 본인부담금
  insurancePay: number | null;  // 보험 적용 금액
  rateBased: number | null;     // 정률 적용액 (최소공제 비교 전, = 금액 × 자기부담률)
  rateApplied: number | null;   // 적용 자기부담률
  minDeductible: number | null; // 적용 최소공제(약관상 정액 기준. 실제 공제액이 아니다)
  // 약관상 실제로 공제된 금액. 지급 한도(회당 가입금액·연간 보험가입금액)로 잘려
  // 추가로 부담한 금액은 여기에 포함되지 않으므로 ownPay보다 작을 수 있다.
  //   ⚠ 절대로 ownPay를 그대로 담지 말 것. 5세대 500만원 공제 누적이 이 값을 쓴다.
  // 현재 **5세대 비급여**의 정상 결과에만 존재한다. 급여 결과, PENDING_UNVERIFIED 결과,
  // 2·3·4세대 결과에는 키 자체가 없다(500만원 공제 pool이 비급여 전용이기 때문).
  deductibleApplied?: number;
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
  /**
   * 이미 사용한 외래 방문 **횟수**(연 180회 한도). 약국 처방조제가 아닌 통원 행이 하나라도
   * 있으면 필수다.
   *
   * ⚠ optional인 이유는 "미입력을 허용해서"가 아니라 **타입으로 표현할 수 없어서**다.
   *   2·3세대 다회는 행마다 visit·facility가 달라 한 묶음에 외래·처방조제·입원이 섞인다.
   *   그래서 축이 필요한지는 lines의 내용이 정하고, 최상위 필드로 판별할 수 없다
   *   (4세대가 rider·coverage·visit으로 판별 유니온을 쓸 수 있었던 것과 다르다).
   *   런타임이 같은 계약을 강제한다 — 미입력·잘못된 값·쓰이지 않는 축은 모두 차단한다.
   *
   * ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 미입력은 0으로 추정하지 않는다.
   *   음수·소수·NaN·Infinity·안전 정수 초과·문자열도 정규화하지 않고 차단한다.
   *   180을 넘는 값은 유효한 과거 상태이므로 절삭하지 않는다.
   */
  priorAnnualOutpatientVisits?: number;
  /**
   * 이미 사용한 처방전 **건수**(연 180건 한도). 약국 처방조제 통원 행이 하나라도 있으면 필수다.
   *   ⚠ 외래 횟수와 **별도 축**이다. 단위가 회 ≠ 건이고 카운터·CapCode도 다르다.
   *   optional인 이유와 입력 계약은 위 priorAnnualOutpatientVisits와 같다.
   */
  priorAnnualPrescriptions?: number;
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
interface Gen2021MultiCommonInput {
  cause: Cause;
  visit: Visit;
  tier?: Tier;
  amounts: number[];
  // ⚠ 두 횟수 축은 여기 두지 않는다. 공통 베이스에 두면 어느 조합에나 아무 축이나 실을 수
  //   있게 된다. 쓰는 변형에서만 number로 열고 나머지는 never로 닫는다.
  // ⚠ **금액 세 축도 같은 이유로 여기 두지 않는다(G-30).** 종전에는 셋 다 이 베이스에 열려
  //   있어 어느 조합에나 실을 수 있었고, 런타임은 비활성 축을 **조용히 폐기**했다
  //   (실측: 접근자 호출 0회). 일반 보장과 3대비급여 특약은 서로 다른 금액 축을 쓴다.
  //     일반(rider === "none") → `priorAnnualInsurancePaid` + `annualCoverageLimit`
  //       (기본형 제5조① 인쇄 p.209 · 비급여 특별약관 제5조① p.264 — 원인 × 급여 구분 4축)
  //     특약(도수·주사료·MRI)  → `priorAnnualRiderPaid`
  //       (특약 <표>가 항목별 연간 보상한도를 따로 정한다. 일반 가입금액과 별개다)
}

/** 일반 보장(rider === "none")이 쓰는 금액 축. 특약 축은 닫는다. */
interface Gen2021GeneralMoneyAxes {
  annualCoverageLimit?: number; // 증권상 선택 가입금액(최대 5천만원). 미입력 시 적용하지 않음
  priorAnnualInsurancePaid?: number;
  priorAnnualRiderPaid?: never;
}

/** 3대비급여 특약이 쓰는 금액 축. 일반 축 두 개는 닫는다. */
interface Gen2021RiderMoneyAxes {
  priorAnnualRiderPaid?: number;
  annualCoverageLimit?: never;
  priorAnnualInsurancePaid?: never;
}

/**
 * 이미 사용한 횟수 축의 공통 계약(4세대 전용).
 *   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 한도가 걸린 경로에서 미입력은
 *     0으로 추정하지 않고 차단한다. 음수·소수·NaN·Infinity·안전 정수 초과·문자열도
 *     정규화하지 않고 차단한다. 한도를 넘는 값은 유효한 과거 상태이므로 절삭하지 않는다.
 *   ⚠ 일반 통원(연 100회)과 3대비급여 특약(연 50회)은 한도·근거가 다른 별개 축이다.
 *     서로 대신 쓰지 않으며, 반대 축이 실리면 값이 0이어도 차단한다.
 */

/** 비급여 통원 — 연 100회 한도가 걸리는 유일한 일반 경로. */
export interface Gen2021MultiGeneralNonBenefitOutpatientInput extends Gen2021MultiCommonInput, Gen2021GeneralMoneyAxes {
  rider?: "none";
  coverage: "non_benefit";
  visit: "outpatient";
  priorAnnualOutpatientVisits?: number;
  priorAnnualRiderVisits?: never;
  approvedThroughVisit?: never;
}

/** 급여 — 연간 횟수 한도가 없다(약관의 '90회'는 계약 종료 후 계속 통원 규정이다). */
export interface Gen2021MultiGeneralBenefitInput extends Gen2021MultiCommonInput, Gen2021GeneralMoneyAxes {
  rider?: "none";
  coverage: "benefit";
  priorAnnualOutpatientVisits?: never;
  priorAnnualRiderVisits?: never;
  approvedThroughVisit?: never;
}

/** 비급여 입원 — 통원 횟수 한도가 적용되지 않는다. */
export interface Gen2021MultiGeneralNonBenefitInpatientInput extends Gen2021MultiCommonInput, Gen2021GeneralMoneyAxes {
  rider?: "none";
  coverage: "non_benefit";
  visit: "inpatient";
  priorAnnualOutpatientVisits?: never;
  priorAnnualRiderVisits?: never;
  approvedThroughVisit?: never;
}

/**
 * 4세대 도수 계열 보상 승인 회차(<표1> 주), 인쇄 p.252 — 10회 단위).
 *   ⚠ 미입력은 "모른다"가 아니라 약관이 **조건 없이 보장하는 최초 구간**을 뜻한다.
 *     그래서 다른 축과 달리 미입력을 차단하지 않고 기본값 10을 쓴다.
 *   ⚠ 기본값 10은 '보험사가 10회를 승인했다'는 뜻이 아니고, 면책사항 등 다른 보장 조건까지
 *     충족한다는 뜻도 아니다.
 *   ⚠ 5세대 Gen2026MskApprovedThrough와 같은 값이지만 별개 타입이다. 세대별 원문에서
 *     각각 확정했고, 한쪽이 바뀌어도 다른 쪽이 따라가면 안 된다.
 */
export type Gen2021MskApprovedThrough = 10 | 20 | 30 | 40 | 50;

/** 도수치료·체외충격파·증식치료 — 연 50회 한도 + <표1> 주)의 승인 구간. */
export interface Gen2021MultiRiderManualInput extends Gen2021MultiCommonInput, Gen2021RiderMoneyAxes {
  rider: "manual_therapy";
  coverage: Coverage;
  priorAnnualRiderVisits?: number;
  approvedThroughVisit?: Gen2021MskApprovedThrough;
  priorAnnualOutpatientVisits?: never;
}

/**
 * 비급여 주사료 — 연 50회 한도만 있다.
 *   ⚠ <표1> 주)의 승인 구간은 도수·체외충격파·증식치료 3종 전용이라 주사료에는 없다.
 *     승인 축이 실려 오면 쓰이지 않는 입력이므로 막는다.
 */
export interface Gen2021MultiRiderInjectionInput extends Gen2021MultiCommonInput, Gen2021RiderMoneyAxes {
  rider: "injection";
  coverage: Coverage;
  priorAnnualRiderVisits?: number;
  approvedThroughVisit?: never;
  priorAnnualOutpatientVisits?: never;
}

/** 두 특약이 공유하는 '연 50회 횟수 축을 쓰는 입력' 집합. */
export type Gen2021MultiRiderCountedInput =
  | Gen2021MultiRiderManualInput
  | Gen2021MultiRiderInjectionInput;

/** MRI·MRA — 금액 한도만 있고 **횟수 한도가 없다**. 횟수 축을 요구하지도 받지도 않는다. */
export interface Gen2021MultiRiderMriInput extends Gen2021MultiCommonInput, Gen2021RiderMoneyAxes {
  rider: "mri";
  coverage: Coverage;
  priorAnnualOutpatientVisits?: never;
  priorAnnualRiderVisits?: never;
  approvedThroughVisit?: never;
}

export type Gen2021MultiClaimInput =
  | Gen2021MultiGeneralNonBenefitOutpatientInput
  | Gen2021MultiGeneralBenefitInput
  | Gen2021MultiGeneralNonBenefitInpatientInput
  | Gen2021MultiRiderCountedInput
  | Gen2021MultiRiderMriInput;

// 5세대 다회 청구. 단건과 같은 정책 — 비급여에서 치료유형은 필수다.
interface Gen2026MultiCommonInput {
  // 5세대 연간 보험가입금액과 자기부담 누적은 (1)상해비급여 / (2)질병비급여 **각 축에 대해
  // 따로** 정해진다(특별약관1·2 제5조①). 한 계산 묶음은 하나의 원인 축만 포함한다.
  cause: Cause;
  visit: Visit;
  tier?: Tier;
  amounts: number[];
  // ⚠ 금액 축은 여기 두지 않는다(G-30). 기존 지급보험금·연간 보험가입금액·통원 가입금액은
  //   모두 **비급여 특별약관 제5조①**의 축이고 급여에는 대응 축이 없다. 종전에는
  //   `priorAnnualInsurancePaid`만 이 베이스에 열려 있어 급여에도 실을 수 있었고, 런타임은
  //   그 값을 **조용히 폐기**했다(실측: 접근자 호출 0회).
}

export interface Gen2026MultiBenefitInput extends Gen2026MultiCommonInput {
  coverage: "benefit";
  nhisCoinsuranceRate?: number;
  // ⚠ 비급여 특별약관 제5조①의 금액 축 세 개는 급여에 없다. 타입에서 닫고 런타임에서도 막는다.
  priorAnnualInsurancePaid?: never;
  annualCoverageLimit?: never;
  outpatientCoverageLimit?: never;
  priorAnnualDeductible?: never;
  // ⚠ 통원 카운터는 비급여 통원 전용이다(특약1·2 제3조 (1)①·(2)① 표의 '통원 100회'/'통원 100일').
  //   급여에는 연간 횟수·일수 한도가 없다. 타입에서 닫고 런타임에서도 막는다.
  priorAnnualOutpatientVisits?: never;
  priorAnnualOutpatientDays?: never;
  // ⚠ 중증/비중증 구분과 비급여 치료유형은 비급여 특별약관이 만든 축이다(G-31).
  //   급여에는 두 구분이 없다. 종전에는 선언조차 없어 변수 경유가 통과했고 런타임이
  //   **조용히 폐기**했다(실측: 접근자 호출 0회).
  severity?: never;
  nonBenefitItem?: never;
}

export interface Gen2026MultiNonBenefitInput extends Gen2026MultiCommonInput {
  coverage: "non_benefit";
  severity?: Severity;
  /** ⚠ 급여 전용 축이라 비급여에는 대응 축이 없다(G-31). 런타임에서도 막는다. */
  nhisCoinsuranceRate?: never;
  /** 제5조① — (1)상해비급여 / (2)질병비급여 각 축의 기존 지급보험금. 급여에는 없다. */
  priorAnnualInsurancePaid?: number;
  nonBenefitItem: Gen2026NonBenefitItem; // 필수
  // 특별약관1 제5조⑤ 500만원 상한의 연 누적 **공제금액**(중증·입원·상급종합/종합 전용).
  priorAnnualDeductible?: number;
  // 통원 가입금액(중증은 1회당, 비중증은 1일당). 약관상 20만원 "이내에서 계약자가 선택한 금액"
  // 이므로 상수화할 수 없다. 미제공 시 적용하지 않고 미적용 사실만 알린다.
  outpatientCoverageLimit?: number;
  // ⚠ 아래 두 카운터를 혼용하지 않는다. 단위가 회 ≠ 일이고 근거 조문도 다르다
  //   (특약1 (1)①·(2)① '통원 100회' / 특약2 (1)①·(2)① '통원 100일').
  //   대상 통원 경로에서 반대편 필드가 존재하면 값이 0이어도 런타임에서 차단한다.
  /**
   * 중증 통원 연간 100**회** 한도용(특약1 (1)①·(2)① 표 인쇄 p.258·261).
   *   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 중증 통원 경로에서 미입력은
   *     0으로 추정하지 않고 차단한다. 음수·소수·NaN·Infinity·안전 정수 초과·문자열도
   *     정규화하지 않고 차단한다. 100을 넘는 값은 유효한 과거 상태이므로 절삭하지 않는다.
   */
  priorAnnualOutpatientVisits?: number;
  /**
   * 비중증 통원 연간 100**일** 한도용(특약2 (1)①·(2)① 표 인쇄 p.288·291).
   *   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 비중증 통원 경로에서 미입력은
   *     0으로 추정하지 않고 차단한다. 음수·소수·NaN·Infinity·안전 정수 초과·문자열도
   *     정규화하지 않고 차단한다. 100을 넘는 값은 유효한 과거 상태이므로 절삭하지 않는다.
   */
  priorAnnualOutpatientDays?: number;
  // 연간 보험가입금액. 약관 제5조①이 "N원 이내에서 계약자가 선택한 금액"으로 규정하므로
  // 상수화할 수 없다. 상해비급여·질병비급여 각 축에 대해 따로 정해진다.
  annualCoverageLimit?: number;
}

export type Gen2026MultiClaimInput =
  | Gen2026MultiBenefitInput
  | Gen2026MultiNonBenefitInput;

// ─────────────────────────────────────────────────────────────────────
// 5세대 별도 보장종목 — 특별약관1 (3)3대비급여 / 특별약관2 (3)비급여 자기공명영상진단
//
// 근거: 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특약1 제3조(3)① <표1> 공제금액 및 보장한도, 인쇄 p.263~264
//   특약1 제3조(3)② 항암제·항생제(항진균제 포함)·희귀의약품 주사료의 예외, 인쇄 p.265
//   특약1 제3조(3)④ 공제 적용 단위, 인쇄 p.266
//   특약1 제5조①③⑤, 인쇄 p.279~280
//   특약2 제3조(3)① <표1>, 인쇄 p.293 / 특약2 제3조(3)③, 인쇄 p.294
//
// ⚠ 한도가 상해·질병을 **합산**하므로 이 경로는 cause를 받지 않는다. 일반 (1)(2)는
//   제5조①이 상해비급여·질병비급여 각각에 대해 가입금액을 따로 정하므로 cause가 필요하다.
// ─────────────────────────────────────────────────────────────────────

/** 특별약관 (3) 보장종목. */
export type Gen2026SpecialItem = "musculoskeletal_esw" | "injection" | "mri";

/**
 * 비급여 주사료의 약제 용도. 특약1 제3조(3)②(인쇄 p.265)는 아래 셋을 (3)3대비급여가 아니라
 * (1)상해비급여·(2)질병비급여에서 보상한다고 규정한다.
 *   ⚠ 세 예외를 하나로 합치지 않는다. 사용자가 고른 실제 용도가 결과 안내에 남아야 한다.
 */
export type Gen2026InjectionPurpose = "general" | "anticancer" | "antibiotic" | "orphan_drug";

/**
 * 근골격계 이학요법·체외충격파의 보상 승인 회차.
 * <표1> 주)(인쇄 p.264) "…각 치료횟수를 합산하여 최초 10회 보장하고, 이후 객관적이고 일반적으로
 * 인정되는 검사결과 등을 토대로 증상의 개선, 병변호전 등이 …확인된 경우에 한하여 10회 단위로
 * 연간 50회까지 보상합니다."
 *   ⚠ 계산기는 증상 개선을 판정하지 않는다. 10회는 약관이 조건 없이 보장하는 구간이므로 기본값이며,
 *     그 이상은 보험사에서 확인된 회차를 사용자가 입력한다.
 */
export type Gen2026MskApprovedThrough = 10 | 20 | 30 | 40 | 50;

/**
 * 특별약관 1행 = 약관상 **공제 적용 단위 1개**.
 *   근골격계·MRI — 각 치료·진단행위마다 별도 행 (제3조(3)④1·④3, 인쇄 p.266)
 *   주사료       — 1회 통원(또는 1회 입원)에서 받은 주사료 합산액을 한 행 (④2, 인쇄 p.266)
 * 입력 행과 결과 행이 1:1로 대응한다.
 */
export interface Gen2026SpecialLine {
  amount: number;
  visit: Visit;
}

/**
 * 중증 MRI 행. 입원이면 의료기관 종별이 **타입 수준에서 필수**다.
 * 제5조⑤(인쇄 p.280)의 500만원 공제 상한이 상급종합·종합병원 입원에만 적용되므로,
 * 종별을 모르면 기본값으로 계산하지 않고 차단해야 한다.
 */
export type Gen2026CriticalMriLine =
  | { amount: number; visit: "outpatient" }
  | { amount: number; visit: "inpatient"; tier: Tier };

interface Gen2026SpecialBase {
  route: "special_item";
  coverage: "non_benefit";
  /** ⑦·제5조④의 "지급한 금액" — 이 보장종목에서 이미 지급된 보험금. */
  priorAnnualInsurancePaid?: number;
  /** ⚠ 한도가 상해·질병 합산이라 이 경로에서는 원인 축을 받지 않는다. */
  cause?: never;
  /**
   * ⚠ 통원 카운터는 (3) 별도 보장종목에 적용되지 않는다.
   *   중증 100회는 특약1 (1)(2) 통원 행, 비중증 100일은 특약2 (1)(2) 통원 행의 한도이고
   *   <표1>의 보장한도는 이와 별개다(제5조①단서·③). 실려 오면 쓰이지 않는 입력이므로
   *   조용히 버리지 않고 런타임에서도 막는다.
   */
  priorAnnualOutpatientVisits?: never;
  priorAnnualOutpatientDays?: never;
  // ⚠ 아래 세 축은 일반 (1)(2) 전용이다(G-30). (3) 별도 보장종목의 한도는 <표1>이 항목별로
  //   따로 정하고, 제5조①단서·③이 일반 가입금액을 여기에 적용하지 않는다고 명시한다.
  //   종전에는 타입에 선언조차 없어 리터럴만 막혔고(초과 속성 검사), 변수 경유·외부 데이터는
  //   통과해 런타임이 **조용히 폐기**했다(실측: 네 경로 × 세 축 모두 접근자 호출 0회).
  //   ⚠ 중증 MRI의 500만원 상한은 별도 축 `priorAnnualInpatientDeductible`을 쓴다.
  //     `priorAnnualDeductible`(일반 축)과 합치지 않는다.
  annualCoverageLimit?: never;
  outpatientCoverageLimit?: never;
  priorAnnualDeductible?: never;
  // ⚠ 두 축도 이 경로에서 쓰이지 않는다(G-31). 보장종목은 `item`(+`injectionPurpose`)으로
  //   정하고, 이 진입점은 비급여만 받으므로 급여 본인부담률에 대응 축이 없다.
  //   종전에는 선언조차 없어 변수 경유가 통과했고 런타임이 **조용히 폐기**했다.
  nhisCoinsuranceRate?: never;
  nonBenefitItem?: never;
}

export interface Gen2026CriticalMskInput extends Gen2026SpecialBase {
  severity: "critical";
  item: "musculoskeletal_esw";
  lines: Gen2026SpecialLine[];
  approvedThroughVisit?: Gen2026MskApprovedThrough; // 미지정 시 10
  /**
   * ⑦·제5조④의 "보상한 횟수". **연간 50회 한도 전용**이다.
   *   ⚠ 승인 구간(최초 10회·10회 단위)에 쓰지 않는다 — 그쪽은 '치료횟수' 축이다.
   */
  priorAnnualCoveredCount?: number;
  /**
   * <표1> 주)의 "각 치료횟수" — **승인 구간 전용**. 보험사에서 확인한, 계약해당일 이후
   * 이미 받은 치료행위 수다. 지급 보험금이 0원이었던 치료도 포함한다.
   *   ⚠ `undefined`(미입력)와 `0`(확인 결과 없음)은 다른 상태다. 미입력을 0으로 추정하면
   *     승인 경계를 넘겼는지 알 수 없는 채로 보험금을 계산하게 된다.
   */
  priorAnnualTreatmentActCount?: number;
  injectionPurpose?: never;
  /**
   * ⚠ 제5조⑤ 500만원 pool은 3대비급여 중 **MRI만** 대상이다 — 근골격계 이학요법·체외충격파와
   *   주사료는 같은 항의 괄호가 명시적으로 제외한다(2026-09-05 직독, 인쇄 p.280).
   *   `never`로 닫아 리터럴 호출을 컴파일 단계에서 막고, 변수·외부 데이터는
   *   `validateItemInput`이 런타임에서 막는다.
   */
  priorAnnualInpatientDeductible?: never;
}

export interface Gen2026CriticalInjectionInput extends Gen2026SpecialBase {
  severity: "critical";
  item: "injection";
  /** 예외 3종은 (1)(2)에서 보상하므로 이 타입에 들어올 수 없다. */
  injectionPurpose: "general";
  lines: Gen2026SpecialLine[];
  priorAnnualCoveredCount?: number;
  /** 승인 구간은 근골격계에만 있다. */
  priorAnnualTreatmentActCount?: never;
  /** 제5조⑤ 괄호가 주사료를 500만원 pool에서 제외한다. */
  priorAnnualInpatientDeductible?: never;
}

export interface Gen2026CriticalMriInput extends Gen2026SpecialBase {
  severity: "critical";
  item: "mri";
  lines: Gen2026CriticalMriLine[];
  /** 제5조⑤ 500만원 pool의 연 누적 공제금액. 3대비급여 중 MRI만 대상이다. */
  priorAnnualInpatientDeductible?: number;
  injectionPurpose?: never;
  priorAnnualTreatmentActCount?: never;
  // <표1>에 횟수 한도가 없다 → 횟수 필드 없음
  /**
   * ⚠ 중증 MRI는 <표1>에 연간 보상 **횟수** 한도가 없다(금액 300만원만 있다).
   *   엔진도 `spec.annualVisits === null`이라 이 축을 소비하지 않는다. 실려 오면
   *   반영됐다고 오해할 수 있으므로 타입에서 닫고 런타임에서도 거부한다.
   */
  priorAnnualCoveredCount?: never;
}

export interface Gen2026NonCriticalMriInput extends Gen2026SpecialBase {
  severity: "non_critical";
  item: "mri";
  lines: Gen2026SpecialLine[];
  injectionPurpose?: never;
  priorAnnualTreatmentActCount?: never;
  // 특약2 제5조에는 500만원 조항이 없고(인쇄 p.309~310), <표1>에 횟수 한도도 없다.
  //   ⚠ 그 두 사실을 주석이 아니라 타입으로도 못박는다.
  priorAnnualInpatientDeductible?: never;
  priorAnnualCoveredCount?: never;
}

export type Gen2026SpecialItemInput =
  | Gen2026CriticalMskInput
  | Gen2026CriticalInjectionInput
  | Gen2026CriticalMriInput
  | Gen2026NonCriticalMriInput;

// ── 일반 (1)(2) 경로로 되돌아가는 조합 ────────────────────────────────
//   실제로 허용되는 조합만 표현한다. 중증 MRI·중증 근골격계·중증 일반 주사·비중증 MRI의
//   일반 경로는 이 유니온에 존재하지 않으므로 컴파일 단계에서 막힌다.
interface Gen2026RoutedGeneralBase {
  route: "general";
  coverage: "non_benefit";
  /** 제5조① — 일반 (1)(2)의 가입금액·누적은 상해·질병 각 축에 대해 따로 정해진다. */
  cause: Cause;
  visit: Visit;
  tier?: Tier;
  amounts: number[];
  priorAnnualInsurancePaid?: number;
  annualCoverageLimit?: number;
  outpatientCoverageLimit?: number;
  priorAnnualDeductible?: number;
  /** 승인 구간은 (3)3대비급여의 근골격계에만 있다. 일반 경로에는 없다. */
  priorAnnualTreatmentActCount?: never;
  /**
   * ⚠ 아래 두 축도 (3)3대비급여 전용이다. 일반 (1)(2)로 되돌아온 조합은
   *   `priorAnnualDeductible`(제5조⑤의 일반 축)과 통원 카운터를 쓰고,
   *   <표1>의 횟수·MRI pool은 적용되지 않는다.
   */
  priorAnnualCoveredCount?: never;
  priorAnnualInpatientDeductible?: never;
  // ⚠ 통원 카운터는 여기 두지 않는다. 중증은 '회'(특약1), 비중증은 '일'(특약2)로
  //   단위가 다르므로 공통 베이스에 두면 어느 축이든 아무 필드나 실을 수 있게 된다.
  //   각 변형에서 쓰는 쪽만 열고 반대편은 never로 닫는다.
}

/** 특약1 제3조(3)② — 항암제·항생제(항진균제 포함)·희귀의약품 주사료. */
export interface Gen2026CriticalExceptionalInjectionInput extends Gen2026RoutedGeneralBase {
  severity: "critical";
  item: "injection";
  injectionPurpose: "anticancer" | "antibiotic" | "orphan_drug";
  /**
   * 중증 통원은 연 100**회**(특약1 제3조 (1)①·(2)① 표).
   *   통원 계산에서 미입력은 0으로 추정하지 않고 차단한다(일반 경로와 같은 계약).
   */
  priorAnnualOutpatientVisits?: number;
  priorAnnualOutpatientDays?: never;
}

/** 특약2 (1)①·(2)①이 배제하는 것은 MRI뿐이다(인쇄 p.287·p.290). */
export interface Gen2026NonCriticalMskInput extends Gen2026RoutedGeneralBase {
  severity: "non_critical";
  item: "musculoskeletal_esw";
  /** ⚠ 비중증에서는 약제 용도가 경로도 안내도 바꾸지 않는다. 쓰이지 않는 입력을 만들지 않는다. */
  injectionPurpose?: never;
  /** 비중증 통원은 연 100**일**(특약2 제3조 (1)①·(2)① 표). */
  priorAnnualOutpatientDays?: number;
  priorAnnualOutpatientVisits?: never;
}

export interface Gen2026NonCriticalInjectionInput extends Gen2026RoutedGeneralBase {
  severity: "non_critical";
  item: "injection";
  injectionPurpose?: never;
  /** 비중증 통원은 연 100**일**(특약2 제3조 (1)①·(2)① 표). */
  priorAnnualOutpatientDays?: number;
  priorAnnualOutpatientVisits?: never;
}

export type Gen2026RoutedGeneralInput =
  | Gen2026CriticalExceptionalInjectionInput
  | Gen2026NonCriticalMskInput
  | Gen2026NonCriticalInjectionInput;

// ── 상급병실료 차액 ──────────────────────────────────────────────────
// 근거: 별표15 2026.5.6 공포·시행본 특약1 제3조 (1)①(인쇄 p.258)·(2)①(p.261),
//       특약2 제3조 (1)①(p.287)·(2)①(p.290) <구분·보상금액> '상급병실료 차액' 행,
//       특약1 제2조 용어의 정의(p.257), 특약1·2 제5조①(p.279·p.308).
//
// ⚠ 3대비급여와 달리 **독립된 (3) 보장종목이 아니다.** (1)상해비급여/(2)질병비급여 표 안의
//   한 행이므로 상해·질병 축이 나뉘고(cause 필수), 연간 보험가입금액을 일반 (1)(2)와 공유한다.
//   산식은 중증·비중증이 같지만 가입금액 축(중증 5천만·비중증 1천만 이내)이 달라 severity도 필수다.
// ⚠ 같은 표의 입원 행이 "비급여 의료비(비급여 병실료는 제외합니다)"이므로 일반 입원 의료비와
//   병실료 차액은 입력을 합치면 안 된다.

/** 1행 = 약관상 1회의 입원. "입원기간 동안 … 총 입원일수로 나누어"가 1회 입원 단위다. */
export interface Gen2026RoomChargeStay {
  /** 그 입원의 비급여 상급병실료 **차액** 총액(사용 병실료 − 기준병실료). 병실료 총액이 아니다. */
  roomChargeTotal: number;
  /** 그 입원의 총 입원일수. 약관에 산정 방법 정의가 없어 사용자 입력값을 그대로 쓴다. */
  inpatientDays: number;
}

export interface Gen2026RoomChargeInput {
  route: "room_charge";
  coverage: "non_benefit";
  cause: Cause;
  severity: Severity;
  stays: Gen2026RoomChargeStay[];
  priorAnnualInsurancePaid?: number;
  annualCoverageLimit?: number;
  // ⚠ 아래 축은 상급병실료 계산에 쓰이지 않는다. 타입에서 막고 런타임에서도 거부한다.
  injectionPurpose?: never;
  visit?: never;
  tier?: never;
  priorAnnualDeductible?: never;
  priorAnnualCoveredCount?: never;
  outpatientCoverageLimit?: never;
  priorAnnualOutpatientVisits?: never;
  priorAnnualOutpatientDays?: never;
  priorAnnualTreatmentActCount?: never;
  // ⚠ G-31. `nonBenefitItem`은 런타임 `UNUSED_KEYS`가 이미 막고 있었는데 타입에 선언이
  //   없어 변수 경유가 컴파일을 통과했다(타입과 런타임이 어긋난 상태). `nhisCoinsuranceRate`는
  //   양쪽 모두 비어 있어 **조용히 폐기**됐다(실측: 접근자 호출 0회). 둘 다 함께 닫는다.
  nonBenefitItem?: never;
  nhisCoinsuranceRate?: never;
}

export type Gen2026ItemClaimInput =
  | Gen2026SpecialItemInput
  | Gen2026RoutedGeneralInput
  | Gen2026RoomChargeInput;

// ── 결과 ──────────────────────────────────────────────────────────────

/** 특별약관 행의 공제 내역. 최종 자기부담금과 약관상 공제금액을 분리해 보존한다. */
export interface Gen2026DeductibleBreakdown {
  /** min(진료비, max(정액 최소공제, 정률 기준액)) — 500만원 pool 반영 전 */
  deductibleBeforeAnnualCap: number;
  /** 제5조⑤ pool 반영 후 실제 공제액. pool 비대상이면 위 값과 같다. */
  deductibleApplied: number;
  /** 항목별 연간 금액 한도·횟수 한도 때문에 공제금액을 넘어 추가로 부담한 금액. */
  excessOwnPay: number;
  /** 이 행위 처리 후 누적된 pool 공제금액. pool 비대상 행은 null. */
  poolUsedAfter: number | null;
}

export interface SpecialItemLineResult extends ClaimLineResult {
  item: Gen2026SpecialItem;
  /** 연간 몇 번째 치료·진단행위인지(prior 포함, 1-based). 횟수 한도가 없는 MRI는 null. */
  actIndex: number | null;
  deductible: Gen2026DeductibleBreakdown;
}

export interface Gen2026SpecialItemResult extends Omit<MultiClaimResult, "lines"> {
  route: "special_item";
  lines: SpecialItemLineResult[];
}

export interface Gen2026RoutedGeneralResult extends MultiClaimResult {
  route: "general";
}

/**
 * 입력 자체를 신뢰할 수 없어 계산하지 않은 결과.
 *   ⚠ 차단 결과를 무조건 "special_item"으로 위장하면 UI가 요청과 무관한 경로로 좁힌다.
 *     타입을 우회한 외부 값이 들어온 경우는 별도 판별값으로 돌려준다.
 */
export interface Gen2026RejectedResult extends Omit<MultiClaimResult, "lines"> {
  route: "rejected";
  lines: never[];
}

export interface Gen2026RoomChargeLineResult extends ClaimLineResult {
  inpatientDays: number;
  /** 총 차액 ÷ 총 입원일수 (표시용, 원 단위 반올림) */
  dailyAverageRoomCharge: number;
  /** 차액의 50% — 어떤 한도도 걸기 전 보험금 */
  payBeforeCaps: number;
  /** 1일 10만원 × 총 입원일수 */
  dailyCapAmount: number;
  /** 차액의 나머지 50% — 한도와 무관한 기본 자기부담 */
  baseOwnPay: number;
  /** 1일 평균 보험금 한도로 잘린 금액 */
  dailyCapExcess: number;
  /** 연간 보험가입금액 한도로 잘린 금액 */
  annualCapExcess: number;
  /** dailyCapExcess + annualCapExcess */
  excessOwnPay: number;
}

export interface Gen2026RoomChargeResult extends Omit<MultiClaimResult, "lines"> {
  route: "room_charge";
  lines: Gen2026RoomChargeLineResult[];
}

export type Gen2026ItemClaimResult =
  | Gen2026SpecialItemResult
  | Gen2026RoutedGeneralResult
  | Gen2026RoomChargeResult
  | Gen2026RejectedResult;
