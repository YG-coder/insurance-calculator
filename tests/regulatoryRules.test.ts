import { GEN2021, GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const rules = Object.values(REGULATORY_RULES);
const ids = rules.map((rule) => rule.ruleId);
const isConfirmedGradeValid = (rule: { status: string; evidenceGrade: string }) =>
  rule.status !== "CONFIRMED" || rule.evidenceGrade === "A";
const isHoldValueValid = (rule: { status: string; value: unknown }) =>
  rule.status !== "HOLD" || rule.value === null;

check("규제 규칙 ruleId 중복 없음", new Set(ids).size === ids.length);
check("모든 규칙에 검증일 존재", rules.every((rule) => /^\d{4}-\d{2}-\d{2}$/.test(rule.verifiedAt)));
check("모든 규칙에 문서명·발행기관·일자·URL·위치 존재", rules.every((rule) =>
  rule.sources.length > 0 && rule.sources.every((source) =>
    Boolean(source.document && source.issuer && source.publishedOrEffective && source.url && source.locator)
    && /^https?:\/\//.test(source.url)
  )
));
check("CONFIRMED 규칙은 A등급", rules.every(isConfirmedGradeValid));
check("CONFIRMED 등급 검사가 잘못된 REVIEW 사례를 거부", !isConfirmedGradeValid({ status: "CONFIRMED", evidenceGrade: "REVIEW" }));
check("등록된 HOLD 규칙은 계산값 미확정", rules.every(isHoldValueValid));
check("HOLD 값 검사가 잘못된 확정값 사례를 거부", !isHoldValueValid({ status: "HOLD", value: 10_000 }));
check("5세대 급여 통원 최소공제 출처가 PDF 쪽수까지 기록", REGULATORY_RULES.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.sources.every((source) => /PDF p\.4/.test(source.locator)));

// 런타임 상수가 메타데이터의 값에서 파생되는지 대표 경로를 고정한다.
check("4세대 급여 입원률 추적", GEN2021.rate.benefit.inpatient === REGULATORY_RULES.GEN2021_BENEFIT_INPATIENT_RATE.value);
check("4세대 급여 통원 최소공제 추적", GEN2021.outpatientMinDeductible.benefit.clinic === REGULATORY_RULES.GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN.value);
check("4세대 비급여 통원률 추적", GEN2021.rate.non_benefit.outpatient === REGULATORY_RULES.GEN2021_NON_BENEFIT_OUTPATIENT_RATE.value);
check("4세대 통원 한도 추적", GEN2021.outpatientPerVisitLimit === REGULATORY_RULES.GEN2021_OUTPATIENT_PER_VISIT_LIMIT.value);
check("4세대 연간 가입금액 상한 추적", GEN2021.annualLimitMaximum === REGULATORY_RULES.GEN2021_ANNUAL_LIMIT.value);
check("4세대 3대비급여 공제율 추적", GEN2021.rider.deductRate === REGULATORY_RULES.GEN2021_RIDER_DEDUCT_RATE.value);
check("4세대 3대비급여 최소공제 3만원 추적", GEN2021.rider.minDeductible === 30_000 && GEN2021.rider.minDeductible === REGULATORY_RULES.GEN2021_RIDER_MIN_DEDUCTIBLE.value);
check("4세대 도수치료 횟수 추적", GEN2021.rider.manual_therapy.annualVisits === REGULATORY_RULES.GEN2021_MANUAL_THERAPY_ANNUAL_VISITS.value);
const gen4RiderRules = rules.filter((rule) => rule.generation === "2021" && rule.sources[0]?.locator.includes("인쇄 p.251"));
check("4세대 3대비급여 규칙 7건은 재대조일 기록", gen4RiderRules.length === 7 && gen4RiderRules.every((rule) => rule.verifiedAt === "2026-09-03"));
check("그 밖의 4세대 규칙은 최초 직독일 유지", rules.filter((rule) => rule.generation === "2021" && !gen4RiderRules.includes(rule)).every((rule) => rule.verifiedAt === "2026-09-02"));
check("4세대 급여·비급여 출처 위치 분리", REGULATORY_RULES.GEN2021_BENEFIT_INPATIENT_RATE.sources[0].locator !== REGULATORY_RULES.GEN2021_NON_BENEFIT_INPATIENT_RATE.sources[0].locator);
check("4세대 3대비급여 금액·횟수 출처 위치 통일", REGULATORY_RULES.GEN2021_MANUAL_THERAPY_ANNUAL_LIMIT.sources[0].locator === REGULATORY_RULES.GEN2021_MANUAL_THERAPY_ANNUAL_VISITS.sources[0].locator);
check("4세대 3대비급여 출처는 인쇄 p.251로 특정", REGULATORY_RULES.GEN2021_RIDER_MIN_DEDUCTIBLE.sources[0].locator.includes("인쇄 p.251"));
check("5세대 급여 통원 최소공제 추적", GEN2026.benefit.outpatient.minDeductible === REGULATORY_RULES.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.value);
check("5세대 중증 자기부담 상한 추적", GEN2026.nonBenefit.critical.annualOwnPayCap === REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_OWN_PAY_CAP.value);
check("5세대 비중증 입원 한도 추적", GEN2026.nonBenefit.nonCritical.inpatientPerVisitLimit === REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT.value);


// 2026-09-03 별표15 2026.5.6 연혁본(5세대 표준약관) 재대조분
const gen5Bylaw = rules.filter((rule) => rule.generation === "2026" && rule.sources[0]?.document.includes("2026. 5. 6. 연혁본"));
check(`5세대 표준약관 근거 규칙에 재대조일 기록 (${gen5Bylaw.length}건)`,
  gen5Bylaw.length >= 12 && gen5Bylaw.every((rule) => rule.verifiedAt === "2026-09-03"));
check("5세대 '연간' 기산점이 계약해당일 기준으로 등록",
  REGULATORY_RULES.GEN2026_ANNUAL_PERIOD_BASIS.value === "contract_anniversary");
check("5세대 기산점 근거가 제5조 제2항을 특정",
  REGULATORY_RULES.GEN2026_ANNUAL_PERIOD_BASIS.sources.every((s) => s.locator.includes("제5조")));
check("같은 날 통원 합산 규정 등록", REGULATORY_RULES.GEN2026_SAME_DAY_OUTPATIENT_MERGED.value === true);
check("5세대 통원 가입금액은 상한선으로 등록(계약값 아님)",
  GEN2026.nonBenefit.critical.outpatientPerVisitLimitMax === REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT_MAX.value
  && Boolean(REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT_MAX.note?.includes("계약값이 아니다")));
check("5세대 중증 통원 연간 횟수 추적",
  GEN2026.nonBenefit.critical.outpatientAnnualVisits === REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS.value);

console.log(`\n[regulatoryRules] 규칙 ${rules.length}개 · 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
