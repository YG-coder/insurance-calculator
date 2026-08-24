import { regulated, RegulatorySource } from "./regulatory";

const GEN4_BENEFIT_TERMS: RegulatorySource = {
  document: "ABL생명 무배당 급여실손의료비보장보험(갱신형)(계약전환용) 약관",
  issuer: "ABL생명",
  publishedOrEffective: "2022-09-01",
  url: "https://abllife.co.kr/cms/pban/prdtPban/whlPrdt/__icsFiles/afieldfile/2022/09/01/20220901_NP_%EA%B8%89%EC%97%AC%EC%8B%A4%EC%86%90%EC%9D%98%EB%A3%8C%EB%B9%84%EB%B3%B4%EC%9E%A5%EB%B3%B4%ED%97%98%28%EA%B0%B1%EC%8B%A0%ED%98%95%29%28%EA%B3%84%EC%95%BD%EC%A0%84%ED%99%98%EC%9A%A9%29.pdf",
  locator: "제3조 보장종목별 보상내용 <표1>, 제6조⑤",
};

const GEN4_NON_BENEFIT_TERMS: RegulatorySource = {
  document: "KDB생명 (무)비급여실손의료비특약 약관 V03",
  issuer: "KDB생명",
  publishedOrEffective: "2024-01-01",
  url: "http://www.kdblife.com/nKumhoFiles/data_pdf/arrangement/2024/I20659_20240101_(%EB%AC%B4)%EB%B9%84%EA%B8%89%EC%97%AC%EC%8B%A4%EC%86%90%EC%9D%98%EB%A3%8C%EB%B9%84%ED%8A%B9%EC%95%BD_%EC%95%BD%EA%B4%80_V03.pdf",
  locator: "제3조 (1)·(2) 및 <표1>, 제5조③",
};

const GEN5_FSC_RELEASE: RegulatorySource = {
  document: "5월 6일부터 치료비 부담이 큰 중증질환의 보장을 강화하고, 보험료는 낮춘 5세대 실손의료보험이 새롭게 출시·판매됩니다.",
  issuer: "금융위원회·금융감독원",
  publishedOrEffective: "2026-05-06",
  url: "https://www.fsc.go.kr/no010101/86831",
  locator: "첨부 보도자료 PDF p.4 본문 2.(1), <급여 관련 현행 4세대와 신규 5세대 비교>, <급여 통원(외래) 자기부담금 산출(예시)>; p.6 <비급여 관련 현행 4세대와 5세대 실손 비교>",
};

const confirmed = <T>(
  ruleId: string,
  generation: "2021" | "2026",
  value: T,
  sources: readonly RegulatorySource[],
  note?: string,
) => regulated({
  ruleId,
  generation,
  value,
  status: "CONFIRMED" as const,
  evidenceGrade: "A" as const,
  verifiedAt: "2026-08-24",
  sources,
  note,
});

// 각 사용 지점마다 ruleId를 분리한다. 값이 같아도 적용 대상·한도 성격이 다르면 다른 규칙이다.
export const REGULATORY_RULES = {
  GEN2021_BENEFIT_INPATIENT_RATE: confirmed(
    "GEN2021-BENEFIT-INPATIENT-RATE", "2021", 0.2, [GEN4_BENEFIT_TERMS],
    "급여 입원 본인부담률 20%",
  ),
  GEN2021_BENEFIT_OUTPATIENT_RATE: confirmed(
    "GEN2021-BENEFIT-OUTPATIENT-RATE", "2021", 0.2, [GEN4_BENEFIT_TERMS],
    "급여 통원 보장대상 의료비의 20%와 최소공제액 중 큰 금액",
  ),
  GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN: confirmed(
    "GEN2021-BENEFIT-OUTPATIENT-CLINIC-MIN", "2021", 10_000, [GEN4_BENEFIT_TERMS],
    "병·의원 및 약국 최소공제액",
  ),
  GEN2021_BENEFIT_OUTPATIENT_HOSPITAL_MIN: confirmed(
    "GEN2021-BENEFIT-OUTPATIENT-HOSPITAL-MIN", "2021", 20_000, [GEN4_BENEFIT_TERMS],
    "상급종합·종합병원 및 약국 최소공제액",
  ),
  GEN2021_NON_BENEFIT_INPATIENT_RATE: confirmed(
    "GEN2021-NONBENEFIT-INPATIENT-RATE", "2021", 0.3, [GEN4_NON_BENEFIT_TERMS],
    "비급여 입원 본인부담률 30%",
  ),
  GEN2021_NON_BENEFIT_OUTPATIENT_RATE: confirmed(
    "GEN2021-NONBENEFIT-OUTPATIENT-RATE", "2021", 0.3, [GEN4_NON_BENEFIT_TERMS],
    "비급여 통원 보장대상 의료비의 30%와 최소공제액 중 큰 금액",
  ),
  GEN2021_NON_BENEFIT_OUTPATIENT_MIN: confirmed(
    "GEN2021-NONBENEFIT-OUTPATIENT-MIN", "2021", 30_000, [GEN4_NON_BENEFIT_TERMS],
    "비급여 통원 최소공제액",
  ),
  GEN2021_OUTPATIENT_PER_VISIT_LIMIT: confirmed(
    "GEN2021-OUTPATIENT-PER-VISIT-LIMIT", "2021", 200_000,
    [GEN4_BENEFIT_TERMS, GEN4_NON_BENEFIT_TERMS],
    "급여·비급여 통원 1회당 보험금 지급액 상한",
  ),
  GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS: confirmed(
    "GEN2021-NONBENEFIT-OUTPATIENT-ANNUAL-VISITS", "2021", 100, [GEN4_NON_BENEFIT_TERMS],
    "매년 계약해당일부터 1년간 비급여 통원 횟수 한도",
  ),
  GEN2021_ANNUAL_LIMIT: confirmed(
    "GEN2021-ANNUAL-LIMIT", "2021", 50_000_000,
    [GEN4_BENEFIT_TERMS, GEN4_NON_BENEFIT_TERMS],
    "상해·질병별 보장 안에서 입원·통원 합산",
  ),
  GEN2021_MANUAL_THERAPY_ANNUAL_LIMIT: confirmed(
    "GEN2021-MANUAL-THERAPY-ANNUAL-LIMIT", "2021", 3_500_000, [GEN4_NON_BENEFIT_TERMS],
  ),
  GEN2021_INJECTION_ANNUAL_LIMIT: confirmed(
    "GEN2021-INJECTION-ANNUAL-LIMIT", "2021", 2_500_000, [GEN4_NON_BENEFIT_TERMS],
  ),
  GEN2021_MRI_ANNUAL_LIMIT: confirmed(
    "GEN2021-MRI-ANNUAL-LIMIT", "2021", 3_000_000, [GEN4_NON_BENEFIT_TERMS],
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
  GEN2026_CRITICAL_INPATIENT_RATE: confirmed(
    "GEN2026-CRITICAL-INPATIENT-RATE", "2026", 0.3, [GEN5_FSC_RELEASE],
  ),
  GEN2026_CRITICAL_OUTPATIENT_RATE: confirmed(
    "GEN2026-CRITICAL-OUTPATIENT-RATE", "2026", 0.3, [GEN5_FSC_RELEASE],
  ),
  GEN2026_CRITICAL_OUTPATIENT_MIN: confirmed(
    "GEN2026-CRITICAL-OUTPATIENT-MIN", "2026", 30_000, [GEN5_FSC_RELEASE],
  ),
  GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT: confirmed(
    "GEN2026-CRITICAL-OUTPATIENT-PER-VISIT-LIMIT", "2026", 200_000, [GEN5_FSC_RELEASE],
    "보험금 지급액 상한",
  ),
  GEN2026_CRITICAL_ANNUAL_LIMIT: confirmed(
    "GEN2026-CRITICAL-ANNUAL-LIMIT", "2026", 50_000_000, [GEN5_FSC_RELEASE],
  ),
  GEN2026_CRITICAL_ANNUAL_OWN_PAY_CAP: confirmed(
    "GEN2026-CRITICAL-ANNUAL-OWN-PAY-CAP", "2026", 5_000_000, [GEN5_FSC_RELEASE],
    "상급종합·종합병원 중증 비급여 입원 자기부담 상한. 기산점은 판매약관 확인 전 미확정",
  ),
  GEN2026_NONCRITICAL_INPATIENT_RATE: confirmed(
    "GEN2026-NONCRITICAL-INPATIENT-RATE", "2026", 0.5, [GEN5_FSC_RELEASE],
  ),
  GEN2026_NONCRITICAL_OUTPATIENT_RATE: confirmed(
    "GEN2026-NONCRITICAL-OUTPATIENT-RATE", "2026", 0.5, [GEN5_FSC_RELEASE],
  ),
  GEN2026_NONCRITICAL_OUTPATIENT_MIN: confirmed(
    "GEN2026-NONCRITICAL-OUTPATIENT-MIN", "2026", 50_000, [GEN5_FSC_RELEASE],
  ),
  GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT: confirmed(
    "GEN2026-NONCRITICAL-INPATIENT-PER-VISIT-LIMIT", "2026", 3_000_000, [GEN5_FSC_RELEASE],
    "병·의원 입원 회당 보험금 지급액 상한",
  ),
  GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY_LIMIT: confirmed(
    "GEN2026-NONCRITICAL-OUTPATIENT-PER-DAY-LIMIT", "2026", 200_000, [GEN5_FSC_RELEASE],
    "통원 일당 보험금 지급액 상한",
  ),
  GEN2026_NONCRITICAL_ANNUAL_LIMIT: confirmed(
    "GEN2026-NONCRITICAL-ANNUAL-LIMIT", "2026", 10_000_000, [GEN5_FSC_RELEASE],
  ),
} as const;

export type RegulatoryRuleId = typeof REGULATORY_RULES[keyof typeof REGULATORY_RULES]["ruleId"];
