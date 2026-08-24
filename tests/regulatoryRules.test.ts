import { GEN2021, GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const rules = Object.values(REGULATORY_RULES);
const ids = rules.map((rule) => rule.ruleId);

check("규제 규칙 ruleId 중복 없음", new Set(ids).size === ids.length);
check("모든 규칙에 검증일 존재", rules.every((rule) => /^\d{4}-\d{2}-\d{2}$/.test(rule.verifiedAt)));
check("모든 규칙에 문서명·발행기관·일자·URL·위치 존재", rules.every((rule) =>
  rule.sources.length > 0 && rule.sources.every((source) =>
    Boolean(source.document && source.issuer && source.publishedOrEffective && source.url && source.locator)
    && /^https?:\/\//.test(source.url)
  )
));
check("CONFIRMED 규칙은 A등급", rules.filter((rule) => rule.status === "CONFIRMED").every((rule) => rule.evidenceGrade === "A"));
check("HOLD 규칙은 계산값 미확정", rules.filter((rule) => rule.status === "HOLD").every((rule) => rule.value === null));

// 런타임 상수가 메타데이터의 값에서 파생되는지 대표 경로를 고정한다.
check("4세대 급여 입원률 추적", GEN2021.rate.benefit.inpatient === REGULATORY_RULES.GEN2021_BENEFIT_INPATIENT_RATE.value);
check("4세대 급여 통원 최소공제 추적", GEN2021.outpatientMinDeductible.benefit.clinic === REGULATORY_RULES.GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN.value);
check("4세대 비급여 통원률 추적", GEN2021.rate.non_benefit.outpatient === REGULATORY_RULES.GEN2021_NON_BENEFIT_OUTPATIENT_RATE.value);
check("4세대 통원 한도 추적", GEN2021.outpatientPerVisitLimit === REGULATORY_RULES.GEN2021_OUTPATIENT_PER_VISIT_LIMIT.value);
check("5세대 급여 통원 최소공제 추적", GEN2026.benefit.outpatient.minDeductible === REGULATORY_RULES.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.value);
check("5세대 중증 자기부담 상한 추적", GEN2026.nonBenefit.critical.annualOwnPayCap === REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_OWN_PAY_CAP.value);
check("5세대 비중증 입원 한도 추적", GEN2026.nonBenefit.nonCritical.inpatientPerVisitLimit === REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT.value);

console.log(`\n[regulatoryRules] 규칙 ${rules.length}개 · 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
