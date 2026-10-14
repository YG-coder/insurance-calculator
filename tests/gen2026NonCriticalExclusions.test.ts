import { enterHealthExpenses } from "./_uiExpenses";
import { confirmNoPrior2026 } from "./_priorInputs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import HealthPage from "../src/app/5th-generation-health-insurance-calculator/page";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculate } from "../src/lib/insurance/engine/engine";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item, routeOfGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { REGULATORY_RULES as R } from "../src/lib/insurance/engine/regulatoryRules";
import Single from "../src/components/calculators/HealthCalc5th";
import Many from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom } from "./_uiRender";
import type { Gen2026InjectionPurpose } from "../src/lib/insurance/engine/types";

// 독립 기대값: 2026.5.6 별표15 특약2 제4조 (1)③15~17(p.299), (2)③16~18(p.302).
// 면책은 금액 산식이 아니므로 모든 금액 결과는 null이다. 예외 주사는 일반 산식을 수계산한다.
for (const item of ["musculoskeletal_esw", "injection"] as const) {
  const purpose = item === "injection" ? "general" as const : undefined;
  assert.equal(routeOfGen2026Item("non_critical", item, purpose), "excluded");
  for (const visit of ["outpatient", "inpatient"] as const) {
    const singleInput = { amount: 300_000, coverage: "non_benefit" as const, severity: "non_critical" as const, nonBenefitItem: item, visit, injectionPurpose: purpose };
    for (const r of [calc2026(singleInput), calculate("2026", singleInput)]) {
      assert.equal(r.status, "EXCLUDED"); assert.equal(r.insurancePay, null); assert.equal(r.ownPay, null);
      assert.match(r.notes.join(" "), /특별약관2 제4조.*p\.299·302/);
    }
    const many = calculateMany2026({ cause: "disease", coverage: "non_benefit", severity: "non_critical", nonBenefitItem: item, visit, injectionPurpose: purpose, amounts: [300_000, 100_000] });
    assert.equal(many.status, "EXCLUDED"); assert.equal(many.totalAmount, 400_000);
    assert.equal(many.totalInsurancePay, null); assert.equal(many.totalOwnPay, null); assert.deepEqual(many.lines, []);
    const routed = calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "non_critical", item, injectionPurpose: purpose, cause: "disease", visit, amounts: [300_000] } as never);
    assert.equal(routed.status, "EXCLUDED"); assert.equal(routed.route, "excluded"); assert.equal(routed.totalInsurancePay, null);
  }
}
assert.equal(routeOfGen2026Item("non_critical", "injection"), "missing_purpose");
const missingInput = { amount: 300_000, coverage: "non_benefit" as const, severity: "non_critical" as const, nonBenefitItem: "injection" as const, visit: "outpatient" as const };
for (const r of [calc2026(missingInput), calculate("2026", missingInput)]) {
  assert.equal(r.status, "PENDING_UNVERIFIED"); assert.equal(r.insurancePay, null); assert.equal(r.ownPay, null);
}
const missingMany = calculateMany2026({ cause: "disease", coverage: "non_benefit", severity: "non_critical", nonBenefitItem: "injection", visit: "outpatient", amounts: [300_000] });
assert.equal(missingMany.status, "PENDING_UNVERIFIED");
assert.equal(missingMany.totalInsurancePay, null); assert.equal(missingMany.totalOwnPay, null); assert.deepEqual(missingMany.lines, []);
for (const purpose of ["anticancer", "antibiotic", "orphan_drug"] as const) {
  assert.equal(routeOfGen2026Item("non_critical", "injection", purpose), "general");
  const r = calculateMany2026({ cause: "disease", coverage: "non_benefit", severity: "non_critical", nonBenefitItem: "injection", injectionPurpose: purpose, visit: "outpatient", amounts: [300_000, 100_000], priorAnnualOutpatientDays: 0, annualCoverageLimit: 10_000_000, outpatientCoverageLimit: 200_000 });
  // max(5만원, 금액×50%) 공제: 30만원→15만원 지급, 10만원→5만원 지급.
  assert.equal(r.status, "OK"); assert.equal(r.totalInsurancePay, 200_000); assert.equal(r.totalOwnPay, 200_000);
  const capped = calculateMany2026({ cause: "injury", coverage: "non_benefit", severity: "non_critical", nonBenefitItem: "injection", injectionPurpose: purpose, visit: "outpatient", amounts: [300_000, 100_000], priorAnnualOutpatientDays: 0, annualCoverageLimit: 10_000_000, priorAnnualInsurancePaid: 9_900_000, outpatientCoverageLimit: 200_000 });
  assert.equal(capped.totalInsurancePay, 100_000); assert.equal(capped.totalOwnPay, 300_000);
}
for (const bad of ["antifungal", "bogus", null, 0, Symbol("x")] as unknown[]) {
  const r = calc2026({ amount: 300_000, coverage: "non_benefit", severity: "non_critical", nonBenefitItem: "injection", injectionPurpose: bad, visit: "outpatient" } as never);
  assert.equal(r.status, "PENDING_UNVERIFIED"); assert.equal(r.insurancePay, null);
  const many = calculateMany2026({ cause: "disease", coverage: "non_benefit", severity: "non_critical", nonBenefitItem: "injection", injectionPurpose: bad, visit: "outpatient", amounts: [300_000] } as never);
  assert.equal(many.status, "PENDING_UNVERIFIED"); assert.equal(many.totalInsurancePay, null);
}
assert.notEqual(R.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS.value, R.GEN2026_NONCRITICAL_INJECTION_EXCEPTION_DRUGS.value);
assert.match(R.GEN2026_NONCRITICAL_INJECTION_EXCEPTION_DRUGS.note!, /괄호가 없다/);
assert.equal(R.GEN2026_NONCRITICAL_INJECTION_EXCEPTION_DRUGS.verifiedAt, "2026-10-14");
// 각 약제는 소속 규칙의 원문·판본·확인일·적용 기록을 따른다. 두 원문은 합치지 않는다.
for (const [rule, pages] of [
  [R.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS, /p\.265/],
  [R.GEN2026_NONCRITICAL_INJECTION_EXCEPTION_DRUGS, /p\.299.*p\.302/],
] as const) {
  for (const purpose of ["anticancer", "antibiotic", "orphan_drug"] as const) {
    assert(rule.value.includes(purpose));
    assert.match(rule.sources[0].locator, pages);
    assert.match(rule.sources[0].document, /2026\. 5\. 6\. 연혁본/);
    assert.equal(rule.verifiedAt, "2026-10-14");
    assert.equal(rule.application?.startsOn, "2026-05-06");
    assert.equal(rule.application?.verifiedAt, "2026-10-14");
    assert.match(rule.application!.scope, /계약의 보험기간/);
    assert(rule.application!.sources.some(s => s.url === "https://www.fsc.go.kr/no010101/86831"));
    assert(rule.application!.sources.some(s => /p\.257·286/.test(s.locator)));
  }
}
assert.equal(routeOfGen2026Item("critical", "injection", "general"), "special_item");
assert.equal(routeOfGen2026Item("critical", "injection", "antibiotic"), "general");
assert.equal(routeOfGen2026Item("non_critical", "mri"), "special_item");

for (const [Component, name] of [[Single, "HealthCalc5th"], [Many, "HealthCalcMulti2026"]] as const) {
  const h = mount(Component, stateNamesFrom(readFileSync(`src/components/calculators/${name}.tsx`, "utf8"))); enterHealthExpenses(h);
  if (Component === Many) confirmNoPrior2026(h);
  h.set("coverage", "non_benefit"); h.set("severity", "non_critical"); h.set("nonBenefitItem", "musculoskeletal_esw"); h.set("submitted", true);
  let screen = h.render(); assert.equal(screen.resultItems(), null); assert.match(screen.text, /보상하지 않는 항목/);
  h.set("nonBenefitItem", "injection"); screen = h.render(); assert(screen.has("약제 용도")); assert.equal(screen.resultItems(), null); assert.match(screen.text, /선택/);
  h.set(name === "HealthCalc5th" ? "injectionPurpose" : "nonCriticalInjectionPurpose", "general" satisfies Gen2026InjectionPurpose);
  screen = h.render(); assert.equal(screen.resultItems(), null); assert.match(screen.text, /보상하지 않는 항목/);
  // 정상 결과 → 면책으로 바꿨을 때 이전 금액 카드가 남지 않는다.
  h.set(name === "HealthCalc5th" ? "injectionPurpose" : "nonCriticalInjectionPurpose", "anticancer");
  h.set("visit", "outpatient");
  if (name === "HealthCalc5th") { h.set("amount", "300000"); h.set("outpatientLimit", "200000"); }
  else { h.set("cause", "disease"); h.set("amounts", ["300000"]); h.set("priorOutDays", "0"); }
  assert(h.render().resultItems());
  // 정상 결과 → 용도 미선택: 이전 금액을 남기거나 0원 결과로 대체하지 않는다.
  h.set(name === "HealthCalc5th" ? "injectionPurpose" : "nonCriticalInjectionPurpose", "");
  screen = h.render(); assert.equal(screen.resultItems(), null); assert.match(screen.text, /약제 용도.*선택/);
  h.set(name === "HealthCalc5th" ? "injectionPurpose" : "nonCriticalInjectionPurpose", "anticancer");
  assert(h.render().resultItems()); h.set("nonBenefitItem", "musculoskeletal_esw"); assert.equal(h.render().resultItems(), null);
}
const isolated = mount(Many, stateNamesFrom(readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8")));
isolated.set("coverage", "non_benefit"); isolated.set("nonBenefitItem", "injection");
isolated.set("severity", "critical"); isolated.set("injectionPurpose", "antibiotic");
isolated.set("severity", "non_critical"); isolated.set("submitted", true);
assert.equal(isolated.get("nonCriticalInjectionPurpose"), "");
assert.equal(isolated.render().resultItems(), null);
const pageText = renderToStaticMarkup(HealthPage()).replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
assert.match(pageText, /비중증의 근골격계 이학요법·체외충격파와 일반 주사료는 보상하지 않는 항목/);
assert.doesNotMatch(pageText, /비중증의 근골격계.*약관이 반대로/);
console.log("[5세대 비중증 면책] 공식 원문 기대값·모든 진입점·화면 전이 통과");
