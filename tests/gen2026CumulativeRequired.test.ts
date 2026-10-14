import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Many from "../src/components/calculators/HealthCalcMulti2026";
import Standardized from "../src/components/calculators/HealthCalcStandardized";
import Health from "../src/components/calculators/HealthCalc";
import { calcStandardized } from "../src/lib/insurance/engine/generationStandardized";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { mount, stateNamesFrom } from "./_uiRender";
import { confirmNoPrior2026 } from "./_priorInputs";
import { visibleCopy } from "./_uiCopyGuard";

const fresh = () => mount(Many, stateNamesFrom(readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8")));
const initial = fresh();
assert(Object.values(initial.get("priorInsuranceByAxis") as Record<string, string>).every(value => value === ""));
assert.equal(initial.get("priorDeductible"), "");
assert.equal(initial.get("priorPool"), "");
const axes = [
  ["general_critical_injury", "general", "critical", "injury"],
  ["general_critical_disease", "general", "critical", "disease"],
  ["general_non_critical_injury", "general", "non_critical", "injury"],
  ["general_non_critical_disease", "general", "non_critical", "disease"],
  ["item_msk_critical", "musculoskeletal_esw", "critical", ""],
  ["item_injection_critical", "injection", "critical", ""],
  ["item_mri_critical", "mri", "critical", ""],
  ["item_mri_non_critical", "mri", "non_critical", ""],
];
for (const [axis, item, severity, cause] of axes) {
  const h = fresh();
  for (const [key, value] of Object.entries({ nonBenefitItem: item, severity, cause, injectionPurpose: "general",
    priorVisits: "0", priorOutDays: "0", priorActs: "0", priorCountByItem: { musculoskeletal_esw: "0", injection: "0" },
    rows: [{ amount: "300000", visit: "outpatient", tier: "" }], submitted: true })) h.set(key, value);
  assert.equal(h.render().resultItems(), null, axis + " blank must hold");
  assert.match(visibleCopy(h.renderMarkup()), /기존 지급보험금.*빈 값은 0으로 추정하지 않고 계산을 보류/);
  h.set("priorInsuranceByAxis", { ...(h.get("priorInsuranceByAxis") as object), [axis]: "0" });
  assert(h.render().resultItems(), axis + " explicit zero must calculate");
  for (const value of ["", " ", "-1", "1.5"]) {
    h.set("priorInsuranceByAxis", { ...(h.get("priorInsuranceByAxis") as object), [axis]: value });
    assert.equal(h.render().resultItems(), null, axis + " invalid must remove result");
    assert.equal(h.render().nodes.filter(n => n.tag === "td").length, 0);
  }
}
const hospital = fresh(); confirmNoPrior2026(hospital);
for (const [key, value] of Object.entries({ nonBenefitItem: "general", severity: "critical", cause: "disease", visit: "inpatient",
  nbInpatientTier: "hospital", amounts: ["10000000", "10000000"], submitted: true })) hospital.set(key, value);
assert.equal(hospital.render().resultItems()?.[2].value, "15,000,000원");
hospital.set("priorDeductible", "4000000");
assert.equal(hospital.render().resultItems()?.[2].value, "19,000,000원");
hospital.set("priorDeductible", "");
assert.equal(hospital.render().resultItems(), null);
assert.match(visibleCopy(hospital.renderMarkup()), /누적된 공제금액.*빈 값은 0으로 추정하지 않고 계산을 보류/);
hospital.set("nbInpatientTier", "clinic");
assert(hospital.render().resultItems(), "unused missing deduction must not block clinic");
hospital.set("nonBenefitItem", "mri");
hospital.set("rows", [{ amount: "10000000", visit: "inpatient", tier: "hospital" }]);
hospital.set("priorPool", "");
assert.equal(hospital.render().resultItems(), null, "MRI missing cumulative deductible must hold");
hospital.set("priorPool", "0");
assert(hospital.render().resultItems());

const routed = fresh(); confirmNoPrior2026(routed);
for (const [key, value] of Object.entries({ severity: "non_critical", nonBenefitItem: "injection", cause: "injury",
  nonCriticalInjectionPurpose: "orphan_drug", priorOutDays: "0", submitted: true })) routed.set(key, value);
assert(routed.render().resultItems());
routed.set("cause", "disease");
routed.set("priorInsuranceByAxis", { general_non_critical_injury: "0", general_non_critical_disease: "" });
assert.equal(routed.render().resultItems(), null, "empty other axis must not inherit zero");
routed.set("cause", "injury");
assert(routed.render().resultItems(), "explicit entry survives axis switch");
const benefit = fresh(); benefit.set("coverage", "benefit"); benefit.set("visit", "inpatient"); benefit.set("submitted", true);
assert(benefit.render().resultItems(), "unused cumulative blanks must not block benefit");
const room = fresh(); room.set("nonBenefitItem", "room_charge"); room.set("severity", "critical"); room.set("cause", "disease");
room.set("rcRows", [{ amount: "600000", days: "3" }]); room.set("submitted", true);
assert.equal(room.render().resultItems(), null, "room charge cumulative blank must hold");
confirmNoPrior2026(room); assert(room.render().resultItems());

for (const generation of ["2009", "2017"] as const) {
  const h = mount(Standardized, stateNamesFrom(readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8")));
  h.set("generation", generation); h.set("plan", "standard");
  h.set("rows", [{ id: 1, amount: "10000000", visit: "inpatient", facility: "hospital" }]); h.set("submitted", true);
  assert.equal(h.render().resultItems(), null);
  assert.match(visibleCopy(h.renderMarkup()), /빈 값은 0으로 추정하지 않고 계산을 보류/);
  h.set("priorPaid", "0"); assert.equal(h.render().resultItems()?.[1].value, "2,000,000원");
  h.set("priorPaid", "1900000"); assert.equal(h.render().resultItems()?.[1].value, "100,000원");
  const scalar = calcStandardized(generation, { amount: 10000000, coverage: "benefit", visit: "inpatient", plan: "standard" });
  assert(scalar.notes.some(note => note.includes("누적액을 0원으로 가정")));
  const input = { plan: "standard" as const, lines: [{ amount: 10000000, visit: "inpatient" as const }] };
  assert(calculateMany(generation, input).notes.some(note => note.includes("누적액을 0원으로 가정")));
  assert(!calculateMany(generation, { ...input, priorAnnualPaid: 0 }).notes.some(note => note.includes("0원으로 가정")));
}
const fourth = mount(Health, stateNamesFrom(readFileSync("src/components/calculators/HealthCalc.tsx", "utf8")));
fourth.set("amount", "300000"); fourth.set("submitted", true);
assert.match(visibleCopy(fourth.renderMarkup()), /반영되지 않은 약관 한도.*연간/);
console.log("[누적 입력] 8축 미입력·명시적 0·실제 누적액, 일반·예외·MRI·상급병실료, 2·3세대와 4세대 안내 통과");
