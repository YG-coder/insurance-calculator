import { regulated, RegulatorySource } from "./regulatory";

const GEN4_SOURCE_BASE = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관 — 2021. 7. 1. 연혁본",
  issuer: "금융감독원",
  publishedOrEffective: "2021-07-01",
  url: "https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2200000079045",
};

const GEN4_BENEFIT_TERMS: RegulatorySource = {
  ...GEN4_SOURCE_BASE,
  locator: "기본형 실손의료보험(급여) 제3조(보상내용)·제5조(보험가입금액의 한도 등)",
};

const GEN4_NON_BENEFIT_TERMS: RegulatorySource = {
  ...GEN4_SOURCE_BASE,
  locator: "실손의료보험 특별약관(비급여) 제3조(보상내용)·제5조(보험가입금액의 한도 등), 인쇄 p.245~264",
};

const GEN4_RIDER_TERMS: RegulatorySource = {
  ...GEN4_SOURCE_BASE,
  locator: "3대비급여 특별약관 제3조(보장종목별 보상내용) 제1항 <공제금액 및 보장한도> 표, 인쇄 p.251",
};


const GEN5_FSC_RELEASE: RegulatorySource = {
  document: "5월 6일부터 치료비 부담이 큰 중증질환의 보장을 강화하고, 보험료는 낮춘 5세대 실손의료보험이 새롭게 출시·판매됩니다.",
  issuer: "금융위원회·금융감독원",
  publishedOrEffective: "2026-05-06",
  url: "https://www.fsc.go.kr/no010101/86831",
  locator: "첨부 보도자료 PDF p.4 본문 2.(1), <급여 관련 현행 4세대와 신규 5세대 비교>, <급여 통원(외래) 자기부담금 산출(예시)>; p.6 <비급여 관련 현행 4세대와 5세대 실손 비교>",
};


// ─────────────────────────────────────────────────────────────────────
// 2·3세대 근거 — 금융감독원 보험업감독업무시행세칙 [별표 15] 표준약관.
//   이 별표는 2004년부터 전 개정본의 연혁이 공개되어 있어 세대별 원문 대조가 가능하다.
//   재현 절차: 아래 URL → 목록에서 "[별표 15] 표준약관(제5-13조제1항관련)" 선택 →
//              뷰어 상단 "별표연혁" 드롭다운에서 해당 시행일 선택.
//   쪽수는 뷰어가 렌더링하는 변환 PDF 기준이며, 약관 본문의 인쇄 쪽수를 함께 적었다.
// ─────────────────────────────────────────────────────────────────────
const FSS_BYLAW15_URL =
  "https://www.law.go.kr/admRulBylSc.do?menuId=9&subMenuId=57&tabMenuId=267&query=%ED%91%9C%EC%A4%80%EC%95%BD%EA%B4%80";

const GEN2_EARLY_TERMS: RegulatorySource = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관(제5-13조제1항관련) — 별표연혁 [세칙, 2010. 3. 29.]",
  issuer: "금융감독원",
  publishedOrEffective: "2010-03-29",
  url: FSS_BYLAW15_URL,
  locator: "<실손의료보험> 제3조 (1)상해입원 <구분·보상금액>, (2)상해통원 <표1 항목별 공제금액> — 뷰어 189~191쪽",
};

const GEN2_LATE_TERMS: RegulatorySource = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관(제5-13조제1항관련) — 별표연혁 [세칙, 2012. 12. 28.]",
  issuer: "금융감독원",
  publishedOrEffective: "2012-12-28",
  url: FSS_BYLAW15_URL,
  locator: "<실손의료보험> 제3조 (1)상해입원 <구분·보상금액> 표준형·선택형, (2)상해통원 <표1 항목별 공제금액> 표준형·선택형 — 뷰어 219·221쪽",
};

const GEN3_TERMS: RegulatorySource = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관(제5-13조제1항관련) — 별표연혁 [세칙, 2017. 3. 22.]",
  issuer: "금융감독원",
  publishedOrEffective: "2017-03-22",
  url: FSS_BYLAW15_URL,
  locator: "□ 기본형 실손의료보험 제3조 (1)상해입원 <구분·보상금액>(인쇄 p.176), (2)상해통원 보상한도표(인쇄 p.178)·<표1 항목별 공제금액>(인쇄 p.179)",
};

const GEN3_RIDER_MANUAL_THERAPY: RegulatorySource = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관(제5-13조제1항관련) — 별표연혁 [세칙, 2017. 3. 22.]",
  issuer: "금융감독원",
  publishedOrEffective: "2017-03-22",
  url: FSS_BYLAW15_URL,
  locator: "□ 비급여 도수치료·체외충격파치료·증식치료 실손의료보험 특별약관 제3조(보상내용) <구분·내용> — 뷰어 227쪽",
};

const GEN3_RIDER_INJECTION: RegulatorySource = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관(제5-13조제1항관련) — 별표연혁 [세칙, 2017. 3. 22.]",
  issuer: "금융감독원",
  publishedOrEffective: "2017-03-22",
  url: FSS_BYLAW15_URL,
  locator: "□ 비급여 주사료 실손의료보험 특별약관 제3조(보상내용) <구분·내용>(인쇄 p.235)",
};

const GEN3_RIDER_MRI: RegulatorySource = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관(제5-13조제1항관련) — 별표연혁 [세칙, 2017. 3. 22.]",
  issuer: "금융감독원",
  publishedOrEffective: "2017-03-22",
  url: FSS_BYLAW15_URL,
  locator: "□ 비급여 자기공명영상진단(MRI/MRA) 실손의료보험 특별약관 제3조(보상내용) <구분·내용>(인쇄 p.242)",
};

// ─────────────────────────────────────────────────────────────────────
// 5세대 근거 — 금융감독원 보험업감독업무시행세칙 [별표 15] 표준약관 2026.5.6 연혁본.
//   5세대 표준약관은 이 별표에 실려 있다. 종전에 "판매약관 미확보"를 이유로 HOLD였던
//   항목들(자기부담 상한 기산점, 같은 날 통원 적용 단위)은 이 원문으로 확정된다.
//   재현 절차: 아래 URL → "[별표 15] 표준약관(제5-13조제1항관련)" → 별표연혁에서 2026. 5. 6. 선택.
// ─────────────────────────────────────────────────────────────────────
const GEN5_SOURCE_BASE = {
  document: "보험업감독업무시행세칙 [별표 15] 표준약관 — 2026. 5. 6. 연혁본",
  issuer: "금융감독원",
  publishedOrEffective: "2026-05-06",
  url: FSS_BYLAW15_URL,
};

const GEN5_CRITICAL_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관1(중증 비급여 실손의료비) 제3조(보장종목별 보상내용) <구분·보상금액> 및 <표1> 통원 항목별 공제금액, 인쇄 p.258",
};

const GEN5_CRITICAL_LIMIT_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관1 제5조(보험가입금액 한도 등) 제2항·제3항·제5항, 인쇄 p.280",
};

const GEN5_CRITICAL_SAMEDAY_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관1 제3조 (1)상해비급여 제6항·제7항, 인쇄 p.259",
};

const GEN5_NONCRITICAL_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관2(비중증 비급여 실손의료비) 제3조(보장종목별 보상내용) <구분·보상금액>, 인쇄 p.287",
};

const GEN5_CRITICAL_ANNUAL_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관1 제5조(보험가입금액 한도 등) 제1항, 인쇄 p.279",
};

const GEN5_NONCRITICAL_ANNUAL_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관2 제5조(보험가입금액 한도 등) 제1항, 인쇄 p.308",
};

const GEN5_NONCRITICAL_LIMIT_TERMS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관2 제5조(보험가입금액 한도 등) 제2항·제3항, 인쇄 p.309",
};


const confirmed = <T>(
  ruleId: string,
  generation: "2009" | "2017" | "2021" | "2026",
  value: T,
  sources: readonly RegulatorySource[],
  note?: string,
  verifiedAt = "2026-08-24",
) => regulated({
  ruleId,
  generation,
  value,
  status: "CONFIRMED" as const,
  evidenceGrade: "A" as const,
  verifiedAt,
  sources,
  note,
});

/** 2026-09-02 별표15 연혁본 직독으로 확인한 2·3·4세대 규칙. */
const confirmed0902 = <T>(
  ruleId: string,
  generation: "2009" | "2017" | "2021",
  value: T,
  sources: readonly RegulatorySource[],
  note?: string,
) => confirmed(ruleId, generation, value, sources, note, "2026-09-02");

/** 2026-09-03 별표15 2021.7.1 연혁본 인쇄 p.251을 재대조한 4세대 3대비급여 규칙. */
const confirmed0903 = <T>(
  ruleId: string,
  value: T,
  sources: readonly RegulatorySource[],
  note?: string,
) => confirmed(ruleId, "2021", value, sources, note, "2026-09-03");


/** 2026-09-03 별표15 2026.5.6 연혁본(5세대 표준약관) 직독으로 확인한 규칙. */
const confirmed5th = <T>(
  ruleId: string,
  value: T,
  sources: readonly RegulatorySource[],
  note?: string,
) => confirmed(ruleId, "2026", value, sources, note, "2026-09-03");

// 각 사용 지점마다 ruleId를 분리한다. 값이 같아도 적용 대상·한도 성격이 다르면 다른 규칙이다.
export const REGULATORY_RULES = {
  // ── 2세대(표준화 실손, 2009.10~2017.3) ─────────────────────────────
  //   전기(2010.3.29 본)에는 표준형·선택형 구분이 없고 통원 공제도 정액뿐이다.
  //   표준형과 통원 정률공제는 2012.12.28 개정본에서 처음 나타난다
  //   (직전 연혁본 2012.11.17에는 없음을 대조 확인).
  GEN2009_INPATIENT_RATE_SELECTIVE: confirmed0902(
    "GEN2009-INPATIENT-RATE-SELECTIVE", "2009", 0.1, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "선택형 입원: 급여 본인부담금+비급여(상급병실료 차액 제외) 합계액의 90% 보상 → 자기부담 10%",
  ),
  GEN2009_INPATIENT_RATE_STANDARD: confirmed0902(
    "GEN2009-INPATIENT-RATE-STANDARD", "2009", 0.2, [GEN2_LATE_TERMS],
    "표준형 입원: 합계액의 80% 보상 → 자기부담 20%",
  ),
  GEN2009_INPATIENT_ANNUAL_OWN_PAY_CAP: confirmed0902(
    "GEN2009-INPATIENT-ANNUAL-OWN-PAY-CAP", "2009", 2_000_000, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "자기부담 해당액이 계약일 또는 매년 계약해당일로부터 연간 200만원을 초과하면 초과금액을 보상",
  ),
  GEN2009_OUTPATIENT_RATE_STANDARD: confirmed0902(
    "GEN2009-OUTPATIENT-RATE-STANDARD", "2009", 0.2, [GEN2_LATE_TERMS],
    "표준형 통원 공제 = 정액과 보상대상의료비의 20% 중 큰 금액. 선택형에는 정률이 없다",
  ),
  GEN2009_OUTPATIENT_MIN_DEDUCTIBLE: confirmed0902(
    "GEN2009-OUTPATIENT-MIN-DEDUCTIBLE", "2009",
    { clinic: 10_000, hospital: 15_000, tertiary: 20_000, pharmacy: 8_000 },
    [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "<표1> 의원급 1만원 / 종합병원·병원·치과병원·한방병원·요양병원 1만5천원 / 종합전문요양기관·상급종합병원 2만원 / 처방조제 8천원",
  ),
  GEN2009_OUTPATIENT_ANNUAL_VISITS: confirmed0902(
    "GEN2009-OUTPATIENT-ANNUAL-VISITS", "2009", 180, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "매년 계약해당일로부터 1년간 외래 방문 180회 한도",
  ),
  GEN2009_PRESCRIPTION_ANNUAL_COUNT: confirmed0902(
    "GEN2009-PRESCRIPTION-ANNUAL-COUNT", "2009", 180, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "매년 계약해당일로부터 1년간 처방전 180건 한도",
  ),
  GEN2009_OUTPATIENT_COVERAGE_MAX: confirmed0902(
    "GEN2009-OUTPATIENT-COVERAGE-MAX", "2009", 300_000, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "외래·처방조제비 회(건)당 합산 최고한도. 계약자가 이 범위에서 정하는 가입금액이라 상수로 적용하지 않는다",
  ),
  GEN2009_INPATIENT_COVERAGE_MAX: confirmed0902(
    "GEN2009-INPATIENT-COVERAGE-MAX", "2009", 50_000_000, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "하나의 상해당 보험가입금액 최고한도. 계약자가 정하는 값이라 상수로 적용하지 않는다",
  ),
  GEN2009_UPPER_ROOM_DEDUCT_RATE: confirmed0902(
    "GEN2009-UPPER-ROOM-DEDUCT-RATE", "2009", 0.5, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "상급병실료 차액의 50%를 공제",
  ),
  GEN2009_UPPER_ROOM_DAILY_CAP: confirmed0902(
    "GEN2009-UPPER-ROOM-DAILY-CAP", "2009", 100_000, [GEN2_EARLY_TERMS, GEN2_LATE_TERMS],
    "상급병실료 차액 1일 평균 10만원 한도",
  ),

  // ── 3세대(착한실손, 2017.4~2021.6) ─────────────────────────────────
  //   기본형 산식은 2세대 후기와 같다. 달라진 것은 3대비급여가 특별약관으로 분리된 점이다.
  //   값이 같아도 근거 약관이 다르므로 ruleId를 분리한다.
  GEN2017_INPATIENT_RATE_SELECTIVE: confirmed0902(
    "GEN2017-INPATIENT-RATE-SELECTIVE", "2017", 0.1, [GEN3_TERMS],
    "선택형 입원 90% 보상 → 자기부담 10%",
  ),
  GEN2017_INPATIENT_RATE_STANDARD: confirmed0902(
    "GEN2017-INPATIENT-RATE-STANDARD", "2017", 0.2, [GEN3_TERMS],
    "표준형 입원 80% 보상 → 자기부담 20%",
  ),
  GEN2017_INPATIENT_ANNUAL_OWN_PAY_CAP: confirmed0902(
    "GEN2017-INPATIENT-ANNUAL-OWN-PAY-CAP", "2017", 2_000_000, [GEN3_TERMS],
    "자기부담 해당액이 계약일 또는 매년 계약해당일부터 기산하여 연간 200만원을 초과하면 초과금액을 보상",
  ),
  GEN2017_OUTPATIENT_RATE_STANDARD: confirmed0902(
    "GEN2017-OUTPATIENT-RATE-STANDARD", "2017", 0.2, [GEN3_TERMS],
    "표준형 통원 공제 = 정액과 보상대상 의료비의 20% 중 큰 금액. 선택형에는 정률이 없다",
  ),
  GEN2017_OUTPATIENT_MIN_DEDUCTIBLE: confirmed0902(
    "GEN2017-OUTPATIENT-MIN-DEDUCTIBLE", "2017",
    { clinic: 10_000, hospital: 15_000, tertiary: 20_000, pharmacy: 8_000 }, [GEN3_TERMS],
    "<표1> 의원급 1만원 / 병원급 1만5천원 / 상급종합·종합전문요양기관 2만원 / 처방조제 8천원",
  ),
  GEN2017_OUTPATIENT_ANNUAL_VISITS: confirmed0902(
    "GEN2017-OUTPATIENT-ANNUAL-VISITS", "2017", 180, [GEN3_TERMS],
    "매년 계약해당일부터 1년간 외래 방문 180회 한도",
  ),
  GEN2017_PRESCRIPTION_ANNUAL_COUNT: confirmed0902(
    "GEN2017-PRESCRIPTION-ANNUAL-COUNT", "2017", 180, [GEN3_TERMS],
    "매년 계약해당일부터 1년간 처방전 180건 한도",
  ),
  GEN2017_OUTPATIENT_COVERAGE_MAX: confirmed0902(
    "GEN2017-OUTPATIENT-COVERAGE-MAX", "2017", 300_000, [GEN3_TERMS],
    "외래·처방조제비 회(건)당 합산 최고한도. 계약자가 정하는 값이라 상수로 적용하지 않는다",
  ),
  GEN2017_INPATIENT_COVERAGE_MAX: confirmed0902(
    "GEN2017-INPATIENT-COVERAGE-MAX", "2017", 50_000_000, [GEN3_TERMS],
    "하나의 상해당 보험가입금액 최고한도. 계약자가 정하는 값이라 상수로 적용하지 않는다",
  ),
  GEN2017_UPPER_ROOM_DEDUCT_RATE: confirmed0902(
    "GEN2017-UPPER-ROOM-DEDUCT-RATE", "2017", 0.5, [GEN3_TERMS],
  ),
  GEN2017_UPPER_ROOM_DAILY_CAP: confirmed0902(
    "GEN2017-UPPER-ROOM-DAILY-CAP", "2017", 100_000, [GEN3_TERMS],
  ),

  // 3세대 3대비급여 특별약관 — 별도 담보이므로 기본형 계산에 적용하지 않고 고지에만 쓴다.
  GEN2017_RIDER_DEDUCT_MIN: confirmed0902(
    "GEN2017-RIDER-DEDUCT-MIN", "2017", 20_000,
    [GEN3_RIDER_MANUAL_THERAPY, GEN3_RIDER_INJECTION, GEN3_RIDER_MRI],
    "3특약 공통 — 1회당 2만원과 보상대상의료비의 30% 중 큰 금액",
  ),
  GEN2017_RIDER_DEDUCT_RATE: confirmed0902(
    "GEN2017-RIDER-DEDUCT-RATE", "2017", 0.3,
    [GEN3_RIDER_MANUAL_THERAPY, GEN3_RIDER_INJECTION, GEN3_RIDER_MRI],
  ),
  GEN2017_RIDER_MANUAL_THERAPY_ANNUAL_LIMIT: confirmed0902(
    "GEN2017-RIDER-MANUAL-THERAPY-ANNUAL-LIMIT", "2017", 3_500_000, [GEN3_RIDER_MANUAL_THERAPY],
    "계약일 또는 매년 계약해당일부터 1년 단위 350만원",
  ),
  GEN2017_RIDER_MANUAL_THERAPY_ANNUAL_VISITS: confirmed0902(
    "GEN2017-RIDER-MANUAL-THERAPY-ANNUAL-VISITS", "2017", 50, [GEN3_RIDER_MANUAL_THERAPY],
    "도수치료·체외충격파치료·증식치료의 각 치료횟수를 합산하여 50회",
  ),
  GEN2017_RIDER_INJECTION_ANNUAL_LIMIT: confirmed0902(
    "GEN2017-RIDER-INJECTION-ANNUAL-LIMIT", "2017", 2_500_000, [GEN3_RIDER_INJECTION],
    "계약일 또는 매년 계약해당일부터 1년 단위 250만원",
  ),
  GEN2017_RIDER_INJECTION_ANNUAL_VISITS: confirmed0902(
    "GEN2017-RIDER-INJECTION-ANNUAL-VISITS", "2017", 50, [GEN3_RIDER_INJECTION],
    "입원과 통원을 합산하여 50회",
  ),
  GEN2017_RIDER_MRI_ANNUAL_LIMIT: confirmed0902(
    "GEN2017-RIDER-MRI-ANNUAL-LIMIT", "2017", 3_000_000, [GEN3_RIDER_MRI],
    "계약일 또는 매년 계약해당일부터 1년 단위 연간 300만원. 횟수 한도 없음",
  ),

  GEN2021_BENEFIT_INPATIENT_RATE: confirmed0902(
    "GEN2021-BENEFIT-INPATIENT-RATE", "2021", 0.2, [GEN4_BENEFIT_TERMS],
    "급여 입원 본인부담률 20%",
  ),
  GEN2021_BENEFIT_OUTPATIENT_RATE: confirmed0902(
    "GEN2021-BENEFIT-OUTPATIENT-RATE", "2021", 0.2, [GEN4_BENEFIT_TERMS],
    "급여 통원 보장대상 의료비의 20%와 최소공제액 중 큰 금액",
  ),
  GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN: confirmed0902(
    "GEN2021-BENEFIT-OUTPATIENT-CLINIC-MIN", "2021", 10_000, [GEN4_BENEFIT_TERMS],
    "병·의원 및 약국 최소공제액",
  ),
  GEN2021_BENEFIT_OUTPATIENT_HOSPITAL_MIN: confirmed0902(
    "GEN2021-BENEFIT-OUTPATIENT-HOSPITAL-MIN", "2021", 20_000, [GEN4_BENEFIT_TERMS],
    "상급종합·종합병원 및 약국 최소공제액",
  ),
  GEN2021_NON_BENEFIT_INPATIENT_RATE: confirmed0902(
    "GEN2021-NONBENEFIT-INPATIENT-RATE", "2021", 0.3, [GEN4_NON_BENEFIT_TERMS],
    "비급여 입원 본인부담률 30%",
  ),
  GEN2021_NON_BENEFIT_OUTPATIENT_RATE: confirmed0902(
    "GEN2021-NONBENEFIT-OUTPATIENT-RATE", "2021", 0.3, [GEN4_NON_BENEFIT_TERMS],
    "비급여 통원 보장대상 의료비의 30%와 최소공제액 중 큰 금액",
  ),
  GEN2021_NON_BENEFIT_OUTPATIENT_MIN: confirmed0902(
    "GEN2021-NONBENEFIT-OUTPATIENT-MIN", "2021", 30_000, [GEN4_NON_BENEFIT_TERMS],
    "비급여 통원 최소공제액",
  ),
  GEN2021_OUTPATIENT_PER_VISIT_LIMIT: confirmed0902(
    "GEN2021-OUTPATIENT-PER-VISIT-LIMIT", "2021", 200_000,
    [GEN4_BENEFIT_TERMS, GEN4_NON_BENEFIT_TERMS],
    "급여·비급여 통원 1회당 보험금 지급액 상한",
  ),
  GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS: confirmed0902(
    "GEN2021-NONBENEFIT-OUTPATIENT-ANNUAL-VISITS", "2021", 100, [GEN4_NON_BENEFIT_TERMS],
    "매년 계약해당일부터 1년간 비급여 통원 횟수 한도",
  ),
  GEN2021_ANNUAL_LIMIT: confirmed0902(
    "GEN2021-ANNUAL-LIMIT", "2021", 50_000_000,
    [GEN4_BENEFIT_TERMS, GEN4_NON_BENEFIT_TERMS],
    "상해·질병별 보장 안에서 입원·통원 합산",
  ),
  GEN2021_MANUAL_THERAPY_ANNUAL_LIMIT: confirmed0903(
    "GEN2021-MANUAL-THERAPY-ANNUAL-LIMIT", 3_500_000, [GEN4_RIDER_TERMS],
  ),
  GEN2021_INJECTION_ANNUAL_LIMIT: confirmed0903(
    "GEN2021-INJECTION-ANNUAL-LIMIT", 2_500_000, [GEN4_RIDER_TERMS],
  ),
  GEN2021_MRI_ANNUAL_LIMIT: confirmed0903(
    "GEN2021-MRI-ANNUAL-LIMIT", 3_000_000, [GEN4_RIDER_TERMS],
  ),
  GEN2021_RIDER_DEDUCT_RATE: confirmed0903(
    "GEN2021-RIDER-DEDUCT-RATE", 0.3, [GEN4_RIDER_TERMS],
    "3대비급여: 1회당 3만원과 보장대상의료비 30% 중 큰 금액",
  ),
  GEN2021_RIDER_MIN_DEDUCTIBLE: confirmed0903(
    "GEN2021-RIDER-MIN-DEDUCTIBLE", 30_000, [GEN4_RIDER_TERMS],
  ),
  GEN2021_MANUAL_THERAPY_ANNUAL_VISITS: confirmed0903(
    "GEN2021-MANUAL-THERAPY-ANNUAL-VISITS", 50, [GEN4_RIDER_TERMS],
  ),
  GEN2021_INJECTION_ANNUAL_VISITS: confirmed0903(
    "GEN2021-INJECTION-ANNUAL-VISITS", 50, [GEN4_RIDER_TERMS],
  ),

  GEN2026_BENEFIT_INPATIENT_RATE: confirmed(
    "GEN2026-BENEFIT-INPATIENT-RATE", "2026", 0.2, [GEN5_FSC_RELEASE],
  ),
  GEN2026_BENEFIT_OUTPATIENT_FLOOR_RATE: confirmed(
    "GEN2026-BENEFIT-OUTPATIENT-FLOOR-RATE", "2026", 0.2, [GEN5_FSC_RELEASE],
    "건강보험 본인부담률·20%·최소공제액 중 최댓값",
  ),
  GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE: confirmed(
    "GEN2026-BENEFIT-OUTPATIENT-MIN-DEDUCTIBLE", "2026",
    { clinic: 10_000, hospital: 20_000 }, [GEN5_FSC_RELEASE],
    "병·의원+약국 1만원, 상급종합·종합병원+약국 2만원",
  ),
  GEN2026_CRITICAL_INPATIENT_RATE: confirmed5th(
    "GEN2026-CRITICAL-INPATIENT-RATE", 0.3, [GEN5_CRITICAL_TERMS],
    "약관은 '비급여 의료비의 70%에 해당하는 금액'으로 규정한다 → 자기부담 30%",
  ),
  GEN2026_CRITICAL_OUTPATIENT_RATE: confirmed5th(
    "GEN2026-CRITICAL-OUTPATIENT-RATE", 0.3, [GEN5_CRITICAL_TERMS],
    "<표1> 3만원과 보장대상 의료비의 30% 중 큰 금액",
  ),
  GEN2026_CRITICAL_OUTPATIENT_MIN: confirmed5th(
    "GEN2026-CRITICAL-OUTPATIENT-MIN", 30_000, [GEN5_CRITICAL_TERMS],
  ),
  GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS: confirmed5th(
    "GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS", 100, [GEN5_CRITICAL_TERMS],
    "매년 계약해당일부터 1년간 통원 100회를 한도로 한다",
  ),
  // ⚠ 상수가 아니라 상한선이다. 약관 제5조③: "통원 1회당 20만원 이내에서 회사가 정한
  //    금액 중 계약자가 선택한 금액". 계약자가 그보다 낮게 정했을 수 있으므로
  //    사용자가 증권의 값을 준 경우에만 적용한다.
  GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT_MAX: confirmed5th(
    "GEN2026-CRITICAL-OUTPATIENT-PER-VISIT-LIMIT-MAX", 200_000, [GEN5_CRITICAL_LIMIT_TERMS],
    "통원 1회당 가입금액의 상한선. 계약값이 아니다",
  ),
  // ⚠ 상수가 아니라 상한선이다. 제5조①: 상해비급여·질병비급여 각각에 대하여 입원과 통원의
  //    보상금액을 합산하여 "5천만원 이내에서 회사가 정한 금액 중 계약자가 선택한 금액".
  GEN2026_CRITICAL_ANNUAL_LIMIT_MAX: confirmed5th(
    "GEN2026-CRITICAL-ANNUAL-LIMIT-MAX", 50_000_000, [GEN5_CRITICAL_ANNUAL_TERMS],
    "상해비급여·질병비급여 각 축의 연간 보험가입금액 상한선. 계약값이 아니다",
  ),
  GEN2026_CRITICAL_ANNUAL_OWN_PAY_CAP: confirmed5th(
    "GEN2026-CRITICAL-ANNUAL-OWN-PAY-CAP", 5_000_000, [GEN5_CRITICAL_LIMIT_TERMS],
    "제5조⑤ — 상급종합·종합병원 입원의 공제금액이 계약일 또는 매년 계약해당일부터 기산하여 연간 500만원을 초과하면 500만원까지만 공제",
  ),
  // 5세대 약관이 '연간'을 스스로 정의한다. 역년이 아니다.
  GEN2026_ANNUAL_PERIOD_BASIS: confirmed5th(
    "GEN2026-ANNUAL-PERIOD-BASIS", "contract_anniversary",
    [GEN5_CRITICAL_LIMIT_TERMS, GEN5_NONCRITICAL_LIMIT_TERMS],
    "제5조② — '연간'이라 함은 계약일로부터 매 1년 단위로 도래하는 계약해당일 전일까지의 기간",
  ),
  // 같은 날 통원의 합산. ⚠ 무조건 합산이 아니다 — 중증은 약관이 조건을 달고 있다.
  GEN2026_SAME_DAY_OUTPATIENT_MERGED: confirmed5th(
    "GEN2026-SAME-DAY-OUTPATIENT-MERGED", true,
    [GEN5_CRITICAL_SAMEDAY_TERMS, GEN5_NONCRITICAL_TERMS],
    "중증(제3조⑥⑦): ①동일한 의료기관에서 같은 날 받은 외래와 처방조제를 합산해 통원 1회로, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 1회의 통원으로 본다. 치료 목적이 다르거나 다른 의료기관이면 합산 대상이 아니다. 비중증(제3조): 조건 없이 통원 1일당(외래 및 처방·조제비 합산)",
  ),
  GEN2026_NONCRITICAL_INPATIENT_RATE: confirmed5th(
    "GEN2026-NONCRITICAL-INPATIENT-RATE", 0.5, [GEN5_NONCRITICAL_TERMS],
    "약관은 '비급여 의료비의 50%에 해당하는 금액'으로 규정한다 → 자기부담 50%",
  ),
  GEN2026_NONCRITICAL_OUTPATIENT_RATE: confirmed5th(
    "GEN2026-NONCRITICAL-OUTPATIENT-RATE", 0.5, [GEN5_NONCRITICAL_TERMS],
  ),
  GEN2026_NONCRITICAL_OUTPATIENT_MIN: confirmed5th(
    "GEN2026-NONCRITICAL-OUTPATIENT-MIN", 50_000, [GEN5_NONCRITICAL_TERMS],
    "통원 1일당(외래 및 처방·조제비 합산) 기준으로 한 번 적용한다",
  ),
  GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT: confirmed5th(
    "GEN2026-NONCRITICAL-INPATIENT-PER-VISIT-LIMIT", 3_000_000, [GEN5_NONCRITICAL_TERMS],
    "「의료법」 제3조제2항 의료기관(종합병원 제외)에서 발생한 비급여 의료비는 1회당 300만원 한도",
  ),
  // ⚠ 상수가 아니라 상한선이다. 약관 제5조③: "통원 1일당 20만원 이내에서 회사가 정한
  //    금액 중 계약자가 선택한 금액".
  GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY_LIMIT_MAX: confirmed5th(
    "GEN2026-NONCRITICAL-OUTPATIENT-PER-DAY-LIMIT-MAX", 200_000, [GEN5_NONCRITICAL_LIMIT_TERMS],
    "통원 1일당 가입금액의 상한선. 계약값이 아니다",
  ),
  GEN2026_NONCRITICAL_ANNUAL_LIMIT_MAX: confirmed5th(
    "GEN2026-NONCRITICAL-ANNUAL-LIMIT-MAX", 10_000_000, [GEN5_NONCRITICAL_ANNUAL_TERMS],
    "상해비급여·질병비급여 각 축의 연간 보험가입금액 상한선. 계약값이 아니다",
  ),
} as const;

export type RegulatoryRuleId = typeof REGULATORY_RULES[keyof typeof REGULATORY_RULES]["ruleId"];
