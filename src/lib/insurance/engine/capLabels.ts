import { CapCode } from "./types";

export const CAP_LABELS: Record<CapCode, string> = {
  GEN2009_INPATIENT_OWN_PAY_ANNUAL: "입원 자기부담 상한 200만 원(계약해당일 기준 연간)",
  GEN2009_PER_VISIT_COVERAGE_LIMIT: "회(건)당 가입금액 한도",
  GEN2009_OUTPATIENT_ANNUAL_VISITS: "연간 외래 방문 180회 한도 초과",
  GEN2009_PRESCRIPTION_ANNUAL_COUNT: "연간 처방전 180건 한도 초과",
  GEN2017_INPATIENT_OWN_PAY_ANNUAL: "입원 자기부담 상한 200만 원(계약해당일 기준 연간)",
  GEN2017_PER_VISIT_COVERAGE_LIMIT: "회(건)당 가입금액 한도",
  GEN2017_OUTPATIENT_ANNUAL_VISITS: "연간 외래 방문 180회 한도 초과",
  GEN2017_PRESCRIPTION_ANNUAL_COUNT: "연간 처방전 180건 한도 초과",
  GEN2021_OUTPATIENT_PER_VISIT: "통원 회당 보험금 20만 원 한도",
  GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL: "중증 입원 자기부담 상한 500만 원(상급종합·종합병원·연 누적)",
  GEN2026_CRITICAL_OUTPATIENT_PER_VISIT: "중증 통원 회당 보험금 20만 원 한도",
  GEN2026_NONCRITICAL_INPATIENT_PER_VISIT: "비중증 입원 회당 보험금 300만 원 한도",
  GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY: "비중증 통원 일당 보험금 20만 원 한도",
};
