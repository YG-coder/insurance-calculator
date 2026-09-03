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

// ─────────────────────────────────────────────────────────────────────
// feature/ 4종의 HOLD 근거.
//   네 항목 모두 "원문을 못 찾아서" 막힌 것이 아니다. 원문은 확인됐고,
//   ①판정에 필요한 입력축이 이 계산기에 없거나 ②공통 규정이 계산 수치를 정하지 않는다.
//   값을 만들지 않기 위해 status: "HOLD" / value: null로 등록하고 출처만 추적한다.
//
//   ⚠ 아래 별표15 출처는 모두 2026.5.6 연혁본이다. 해당 조문을 직접 읽은 판본이
//     그것이기 때문이며, 뒤 판본으로 갈아 끼우지 않았다.
//     판본 대조 범위는 파일 하단 주석에 따로 적었다.
// ─────────────────────────────────────────────────────────────────────
const GEN5_BASIC_BENEFIT_EXCLUSIONS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 기본형 실손의료보험(급여) 제4조(보상하지 않는 사항) 제2항, 인쇄 p.214~215",
};

const GEN5_NONCRITICAL_EXCLUSIONS: RegulatorySource = {
  ...GEN5_SOURCE_BASE,
  locator: "□ 실손의료보험 특별약관2(비중증 비급여 실손의료비) 제4조(보상하지 않는 사항), 인쇄 p.296~307",
};

/**
 * 비급여 보험료 할인·할증의 **감독규정** 근거.
 * 적용 대상·산정기간·적용 방식의 틀을 정한다. 등급 경계와 요율 상대도는 약관 쪽에 있다.
 */
const FSC_SUPERVISION_REG_DISCOUNT: RegulatorySource = {
  document: "보험업감독규정 [시행 2026. 5. 6.] [금융위원회고시 제2026-16호, 2026. 5. 6., 일부개정]",
  issuer: "금융위원회",
  publishedOrEffective: "2026-05-06",
  url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000279112",
  locator: "제7-63조(제3보험의 보험상품설계 등) 제2항 제3호의2·제3호의3, 제7-73조 제9항",
};

/**
 * 비급여 보험료 할인·할증의 **약관** 근거 — 등급 경계와 요율 상대도가 여기에 있다.
 *
 * 2026-09-03에 세 판본을 각각 열어 특별약관2 제6조③④를 직접 대조했고 **문언이 동일**했다.
 * 판본별 인쇄 쪽수만 다르므로 셋을 모두 남긴다. 하나만 적으면 다음 사람이 나머지를
 * "확인되지 않은 판본"으로 읽게 된다.
 *
 * ⚠ url은 판본마다 달라야 한다. 검색 페이지 주소 하나로 셋을 가리키면 기본 선택
 *   판본이 바뀌는 순간 어느 문언을 읽었는지 재현할 수 없다.
 *
 * ⚠ 시행일 주의 — 2026.8.28 공포본은 **2026.9.10 시행**이라 아직 시행 전이다.
 *   2026-09-03 현재 시행 중인 판본은 2026.7.13 공포 / **2026.7.15 시행본**이다.
 */
/**
 * 판본별 행정규칙 URL. 별표 PDF로 직행하는 안정적 주소가 없어(뷰어가 1회용 key를
 * 쓴다) 각 판본의 admRulSeq가 박힌 공식 행정규칙 주소를 쓴다. 여기서 "별표/서식"
 * 탭 → [별표 15] → 뷰어 순으로 열면 해당 판본의 약관에 도달한다.
 *
 * 2026-09-03 확인: 세 주소 모두 200이며 [시행]·[공포] 표기가 아래와 일치했다.
 */
const BYLAW15_VERSION_URL = {
  "2026-05-06": "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108697",
  "2026-07-15": "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108867",
  "2026-09-10": "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108939",
} as const;

const GEN5_PREMIUM_ADJUSTMENT_TERMS: readonly RegulatorySource[] = [
  {
    document: "보험업감독업무시행세칙 [별표 15] 표준약관 — 2026. 5. 6. 공포·시행본",
    issuer: "금융감독원",
    publishedOrEffective: "2026-05-06",
    url: BYLAW15_VERSION_URL["2026-05-06"],
    locator: "별표/서식 → [별표 15] 표준약관(별표 식별번호 3216359) → 실손의료보험 특별약관2(비중증 비급여 실손의료비) 제6조(보험료의 계산) 제3항·제4항, 인쇄 p.310",
  },
  {
    document: "보험업감독업무시행세칙 [별표 15] 표준약관 — 2026. 7. 13. 공포 / 2026. 7. 15. 시행본(2026-09-03 현재 시행 중)",
    issuer: "금융감독원",
    publishedOrEffective: "2026-07-15",
    url: BYLAW15_VERSION_URL["2026-07-15"],
    locator: "별표/서식 → [별표 15] 표준약관(별표 식별번호 3265643) → 실손의료보험 특별약관2 제6조 제3항·제4항, 인쇄 p.310",
  },
  {
    document: "보험업감독업무시행세칙 [별표 15] 표준약관 — 2026. 8. 28. 공포 / 2026. 9. 10. 시행 예정본",
    issuer: "금융감독원",
    publishedOrEffective: "2026-09-10",
    url: BYLAW15_VERSION_URL["2026-09-10"],
    locator: "별표/서식 → [별표 15] 표준약관(별표 식별번호 3295613) → 실손의료보험 특별약관2 제6조 제3항·제4항, 인쇄 p.311",
  },
] as const;


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

/**
 * 계산값을 확정할 수 없는 규칙. 출처는 추적하되 값은 만들지 않는다.
 * `note`에는 "무엇이 확인됐는지"와 "무엇이 없어서 막혔는지"를 반드시 나눠 적는다.
 *
 * ⚠ `verifiedAt`은 **필수**다. 기본값을 두면 나중에 다른 날 추가되는 규칙에도
 *   과거 날짜가 조용히 찍힌다. 검증일은 규칙 단위로 명시한다.
 */
const held = (
  ruleId: string,
  generation: "2009" | "2017" | "2021" | "2026",
  sources: readonly RegulatorySource[],
  note: string,
  verifiedAt: string,
) => regulated<null>({
  ruleId,
  generation,
  value: null,
  status: "HOLD" as const,
  evidenceGrade: "REVIEW" as const,
  verifiedAt,
  sources,
  note,
});

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

  // ── HOLD — feature/ 4종. 값을 만들지 않고 근거와 막힌 이유만 남긴다. ──────
  //   ⚠ 아래 note의 "확인됨"과 "막힌 이유"를 섞지 말 것. 종전 사유("원문 미확정",
  //     "판매약관 확인 필요", "시행세칙 공포 대기")는 모두 사실이 아니었다.
  GEN2026_DEVELOPMENTAL_DISORDER_BENEFIT: held(
    "GEN2026-DEVELOPMENTAL-DISORDER-BENEFIT", "2026", [GEN5_BASIC_BENEFIT_EXCLUSIONS],
    "확인됨: 제4조②1. 단서 — 정신 및 행동장애(F04~F99)는 원칙 면책이나, F04~F09·F20~F29·F30~F39·F40~F48·F51·F90~F98 관련 치료의 요양급여 의료비는 보상하며, '피보험자가 보험가입당시 태아인 경우에는' 정신발달장애(F80~F89) 관련 치료의 요양급여 의료비도 18세까지 보상한다. 같은 조 ②4.도 선천성 뇌질환(Q00~Q04)을 가입 당시 태아인 경우에만 보상한다. "
    + "막힌 이유: 무조건 보상이 아니라 ①질병분류코드 ②보험가입 당시 태아 여부 ③피보험자 연령 세 축의 판정이 필요한데, 이 계산기의 입력에 셋 다 없다. 해제 조건은 세 축을 입력으로 받는 설계 확정.",
    "2026-09-03",
  ),
  GEN2026_PREGNANCY_CHILDBIRTH_BENEFIT: held(
    "GEN2026-PREGNANCY-CHILDBIRTH-BENEFIT", "2026", [GEN5_BASIC_BENEFIT_EXCLUSIONS],
    "확인됨: 제4조②3. — 임신·출산(제왕절개 포함)·산후기(O00~O99) 의료비는 원칙 면책이나, 보험가입일이 건강보험 임신출산진료비 지급신청서상 요양기관이 기재한 '분만예정일로부터 280일 이전'인 경우에는 요양급여 또는 의료급여 중 '일부 본인부담금'에 해당하는 의료비를 보상한다(단체보험 상품은 280일 이내여도 보상). '26.5.6. 이후 체결된 계약을 같은 회사 상품으로 전환·재가입한 경우 종전 계약의 보험가입일 기준으로 판단한다. "
    + "종전 기록의 '보장 신설 조항 미발견 / 자료 미발견'은 오류였다. "
    + "막힌 이유: 판정에 ①보험가입일 ②분만예정일 ③단체보험 여부 ④전환·재가입 이력 ⑤전액/일부 본인부담금 구분 다섯 축이 필요한데 이 계산기의 입력에 전부 없다. 해제 조건은 다섯 축을 입력으로 받는 설계 확정.",
    "2026-09-03",
  ),
  GEN2026_NONCRITICAL_EXCLUSION_ITEMS: held(
    "GEN2026-NONCRITICAL-EXCLUSION-ITEMS", "2026", [GEN5_NONCRITICAL_EXCLUSIONS],
    "확인됨: 특별약관2 제4조에 면책 항목이 모두 실려 있다(정신 및 행동장애 F04~F99, 습관성 유산·불임·인공수정 합병증 N96~N98, 치과치료 K00~K08, 직장·항문질환 K60~K62·K64, 혁신의료기술·평가유예 신의료기술, 첨단재생의료, 신의료기술 사용대상 외, 외모개선 목적 치료, 예방진료, 불임검사·보조생식술·인공유산 등). 시행세칙은 이미 공포·시행 중이므로 종전 사유 '시행세칙 공포 대기'는 사실이 아니었다. "
    + "막힌 이유: 판정 단위가 ①질병분류코드 ②치료 유형(혁신의료기술·첨단재생의료·신의료기술 사용대상 여부) ③진료 목적(외모개선·예방진료)인데, 현재 입력은 금액·급여구분·치료형태·의료기관 종별뿐이라 어느 축으로도 판정할 수 없다. 해제 조건은 세 축을 입력으로 받는 설계 확정.",
    "2026-09-03",
  ),
  // ── 비급여 보험료 할인·할증 ─────────────────────────────────────────
  //   ⚠ 이 묶음만 성격이 다르다. 보험금이 아니라 **보험료** 산출 영역이다.
  //
  //   2026-09-03 약관 직독으로 **대부분이 확정됐다.** 종전에 "공통 규정에 계산 수치가
  //   전혀 없다"고 적었던 것은 감독규정만 보고 내린 판단이라 불완전했다.
  //   등급 경계와 요율 상대도는 별표15 특별약관2 제6조③에 표로 실려 있다.
  //   미확정은 1단계 할인율 하나뿐이고, 그마저도 "회사가 정하지 못해서"가 아니라
  //   할증재원 배분 결과로 매년 달라지는 값이라 공통 상수가 될 수 없다.
  GEN2026_PREMIUM_ADJ_LOOKBACK: confirmed(
    "GEN2026-PREMIUM-ADJ-LOOKBACK", "2026", "renewal_minus_3months_month_end_prior_12months",
    [...GEN5_PREMIUM_ADJUSTMENT_TERMS, FSC_SUPERVISION_REG_DISCOUNT],
    "제6조③ — '보험료 갱신 시점 3개월 전 말일부터 직전 12개월 이내 기간' 동안의 보험금 지급 실적. 감독규정 제7-63조②3의3의 '갱신 전 12개월 이내'보다 약관이 구체적이다",
    "2026-09-03",
  ),
  GEN2026_PREMIUM_ADJ_BASE: confirmed(
    "GEN2026-PREMIUM-ADJ-BASE", "2026", "special_terms2_net_premium_total",
    [...GEN5_PREMIUM_ADJUSTMENT_TERMS, FSC_SUPERVISION_REG_DISCOUNT],
    "제6조③ — 적용 대상은 '순보험료(특별약관2의 순보험료 총액을 대상으로 합니다)'. 영업보험료가 아니다",
    "2026-09-03",
  ),
  GEN2026_PREMIUM_ADJ_EXCLUDED_CLAIMS: confirmed(
    "GEN2026-PREMIUM-ADJ-EXCLUDED-CLAIMS", "2026", "ltc_grade_1_or_2_beneficiary",
    [...GEN5_PREMIUM_ADJUSTMENT_TERMS],
    "제6조③ 단서 — 「노인장기요양보험법」상 장기요양대상자 중 1등급 또는 2등급으로 판정받은 자에 대한 비급여의료비는 요율 상대도 계산 시 보험금 지급실적에서 제외한다",
    "2026-09-03",
  ),
  // 등급 경계와 요율을 한 규칙에 묶는다. 따로 두면 경계와 요율이 서로 어긋난 채
  //   수정될 수 있다. 테스트는 5단계를 각각 검사한다.
  GEN2026_PREMIUM_ADJ_TIERS: confirmed(
    "GEN2026-PREMIUM-ADJ-TIERS", "2026",
    [
      { tier: 1, kind: "discount", minInclusive: 0, maxExclusive: 1, relativity: null },
      { tier: 2, kind: "keep", minInclusive: 1, maxExclusive: 1_000_000, relativity: 1.0 },
      { tier: 3, kind: "surcharge", minInclusive: 1_000_000, maxExclusive: 1_500_000, relativity: 2.0 },
      { tier: 4, kind: "surcharge", minInclusive: 1_500_000, maxExclusive: 3_000_000, relativity: 3.0 },
      { tier: 5, kind: "surcharge", minInclusive: 3_000_000, maxExclusive: null, relativity: 4.0 },
    ] as const,
    [...GEN5_PREMIUM_ADJUSTMENT_TERMS],
    "제6조③ 표 — 직전 12개월 보험금 지급실적 구간과 요율 상대도. 1단계는 지급실적 0원(보험금 지급실적 없음)이고 요율은 '할인주)'로만 적혀 있어 값이 없다(GEN2026-PREMIUM-ADJ-TIER1-DISCOUNT-RATE 참조). 2단계 100%, 3단계 200%, 4단계 300%, 5단계 400%",
    "2026-09-03",
  ),
  GEN2026_PREMIUM_ADJ_SURCHARGE_THRESHOLD: confirmed(
    "GEN2026-PREMIUM-ADJ-SURCHARGE-THRESHOLD", "2026", 1_000_000,
    [...GEN5_PREMIUM_ADJUSTMENT_TERMS],
    "제6조④ — 할증은 이 특별약관2에 따른 보험금 지급실적이 연간 100만원 이상인 계약에 한하여 적용한다",
    "2026-09-03",
  ),
  // ── 위 확정 규칙으로도 계산이 안 되는 부분 ─────────────────────────
  GEN2026_PREMIUM_ADJ_TIER1_DISCOUNT_RATE: held(
    "GEN2026-PREMIUM-ADJ-TIER1-DISCOUNT-RATE", "2026", [...GEN5_PREMIUM_ADJUSTMENT_TERMS],
    "확인됨: 제6조③ 표의 1단계 칸은 요율 상대도가 '할인주)'로만 적혀 있고, 주)는 '매년 상대도 적용 전·후의 총 보험료 수준이 일치하도록 3~5단계 할증대상자의 할증재원을 1단계(할인) 대상자들에게 분배할 경우 산출됨'이라고 규정한다. 제6조④도 같은 원칙을 반복한다. "
    + "막힌 이유: 값이 아니라 산출 원칙만 있다. 매년 할증재원 규모와 1단계 대상자 수에 따라 달라지므로 공통 고정값이 존재할 수 없다. 같은 조 뒤의 보험료 예시표도 '1단계(요율상대도 95% 가정)'이라고 가정임을 명시한다. "
    + "해제 조건: 해당 상품·보험사의 공식 요율표 또는 약관에서 그 해의 1단계 할인율이 확인될 것.",
    "2026-09-03",
  ),
  GEN2026_PREMIUM_ADJ_FINAL_PREMIUM: held(
    "GEN2026-PREMIUM-ADJ-FINAL-PREMIUM", "2026", [...GEN5_PREMIUM_ADJUSTMENT_TERMS, FSC_SUPERVISION_REG_DISCOUNT],
    "확인됨: 요율 상대도를 순보험료에 적용한다는 것과, 상대도 적용 전 보험료를 기준으로 연 ±25% 변동 제한을 적용한다는 것(감독규정 제7-63조②3의2). "
    + "막힌 이유: 상대도를 반영한 최종 보험료를 내려면 계약자의 특별약관2 순보험료, 상품별 반올림 규칙, 다른 할인(약관 예시표의 '직전 2년 무사고 시 10% 할인'은 예시상의 가정이며 제6조 본문 규정이 아니다)과의 적용 순서가 필요한데 어느 것도 공통값이 아니다. "
    + "설계 판단: 입력(지급실적·순보험료)도 출력(보험료)도 CalcResult와 무관하다. 구현하더라도 보험금 청구 엔진이 아니라 별도의 보험료 도메인으로 분리한다.",
    "2026-09-03",
  ),
} as const;

// ─────────────────────────────────────────────────────────────────────
// 별표15 판본 대조 기록 (2026-09-03)
//
//   ⚠ 판본과 시행일을 혼동하지 말 것.
//     2026. 5. 6. 공포 → 2026. 5. 6. 시행   (이 저장소의 5세대 규칙 근거)
//     2026. 6. 29. 공포 → 2026. 6. 30. 시행
//     2026. 7. 13. 공포 → 2026. 7. 15. 시행  ← 2026-09-03 현재 **시행 중**
//     2026. 8. 28. 공포 → 2026. 9. 10. 시행  ← 최신 공포본이지만 아직 **시행 전**
//   즉 "2026.8.28 현행본"이라는 표현은 틀렸다. 최신 공포본일 뿐이다.
//
//   5.6본과 8.28본을 **직접 눈으로 대조한 범위는 아래뿐이다.**
//
//     · 특별약관1 제3조 (1)상해비급여 / (2)질병비급여 / (3)3대비급여  인쇄 p.259~265
//     · 특별약관1 제5조(보험가입금액 한도 등) ①②③④⑤              인쇄 p.280~281
//     · 특별약관2 제3조 (1)상해비급여 / (3)비급여 자기공명영상진단   인쇄 p.288, p.294~295
//     · 특별약관2 제5조 ①                                            인쇄 p.309
//
//   위 조문들은 **문언이 동일**했고 인쇄 쪽수만 1쪽씩 뒤로 밀렸다(5.6본 p.280 → 8.28본 p.281).
//
//   별도로 특별약관2 제6조③④(보험료 할인·할증)는 **5.6본 / 7.15 시행본 / 8.28본 세 판본을
//   모두 열어 대조**했고 문언이 동일했다(5.6·7.15본 인쇄 p.310, 8.28본 p.311).
//   해당 규칙의 sources에 세 판본을 모두 남겼다.
//
//   ⚠ 대조하지 않은 조문에 대해 "5세대 약관 전체가 무변경"이라고 확대 해석하지 말 것.
//     그래서 기존 규칙의 verifiedAt·locator·document를 뒤 판본으로 일괄 교체하지 않았다.
//     교체하려면 해당 조문을 실제로 읽고 규칙 단위로 갱신해야 한다.
//     (tests/regulatoryRules.test.ts가 일괄 교체 여부를 검사한다.)
// ─────────────────────────────────────────────────────────────────────

export type RegulatoryRuleId = typeof REGULATORY_RULES[keyof typeof REGULATORY_RULES]["ruleId"];
