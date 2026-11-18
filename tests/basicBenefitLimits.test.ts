import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { basicBenefitFields, emptyBasicFields } from "../src/components/BasicBenefitFields";
import { calculate } from "../src/lib/insurance/engine/engine";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import type { BasicBenefitLimits, Plan, Visit } from "../src/lib/insurance/engine/types";

for (const year of ["2021", "2026"] as const) {
  function single(visit: Visit, amount: number, basicLimits?: BasicBenefitLimits) {
    return calculate(year, {
      amount, visit, coverage: "benefit", basicLimits,
      nhisCoinsuranceRate: year === "2026" && visit === "outpatient" ? 0.3 : undefined,
    });
  }
  function bundle(visit: Visit, amounts: number[], basicLimits?: BasicBenefitLimits) {
    const base = { coverage: "benefit", cause: "disease", visit, amounts, basicLimits } as const;
    return year === "2021" ? calculateMany2021(base)
      : calculateMany2026({ ...base, nhisCoinsuranceRate: visit === "outpatient" ? 0.3 : undefined });
  }
  const admission = single("inpatient", 15_000_000);
  assert.deepEqual([admission.ownPay, admission.insurancePay], [2_000_000, 13_000_000]);
  assert.match(admission.notes.join(" "), /0원으로 가정/);
  for (const [amount, prior, payment] of [
    [100_000, 0, 80_000], [10_000_000, 0, 8_000_000],
    [1_000_000, 1_900_000, 900_000], [100_000, 2_000_000, 100_000],
  ]) {
    assert.equal(single("inpatient", amount, {priorInpatientDeductible: prior}).insurancePay, payment);
  }
  assert.equal(bundle("inpatient", [100_000]).totalInsurancePay, null);
  const two = bundle("inpatient", [7_500_000, 7_500_000], { priorInpatientDeductible: 0 });
  assert.deepEqual(two.lines.map(row => row.insurancePay), [6_000_000, 7_000_000]);
  const interpretation = "5세대 표준약관의 입원 공제 조문이 4세대와 같아";
  assert.equal(admission.notes.join(" ").includes(interpretation), year === "2026");
  assert.equal(two.notes.join(" ").includes(interpretation), year === "2026");
  for (const multiple of [true, false]) {
    for (const visit of ["inpatient", "outpatient"] as const) {
      const values = { ...emptyBasicFields, disease: { outpatient: "100000", remaining: "420000" } };
      const { fields, contract } = basicBenefitFields(values, () => {}, "form", visit, { year, bundle: multiple });
      const html = renderToStaticMarkup(fields);
      const needsRemaining = year === "2026" || !multiple;
      assert.equal(html.includes('id="form-annual"'), needsRemaining);
      assert.equal(contract.remainingAnnualBenefit, needsRemaining ? 420_000 : undefined);
      assert.equal(html.includes(interpretation), year === "2026" && visit === "inpatient");
    }
  }
  const limited = bundle("inpatient", [7_500_000, 7_500_000], {priorInpatientDeductible: 0, remainingAnnualBenefit: 12_500_000});
  assert.deepEqual(limited.lines.map(row => row.insurancePay), [6_000_000, 6_500_000]);
  assert.equal(single("inpatient", 100_000, {remainingAnnualBenefit: 0}).insurancePay, 0);
  assert.equal(single("outpatient", 30_000, {outpatientLimit: 100_000}).insurancePay, 20_000);
  assert.equal(single("outpatient", 1_000_000, {outpatientLimit: 100_000}).insurancePay, 100_000);
  assert.equal(single("outpatient", 1_000_000, {outpatientLimit: 200_000}).insurancePay, 200_000);
  const unconfirmed = single("outpatient", 1_000_000);
  assert.equal(unconfirmed.insurancePay, 200_000);
  assert.match(unconfirmed.notes.join(" "), /상한 추정치/);
  assert.deepEqual(bundle("outpatient", [500_000, 500_000], {
    outpatientLimit: 100_000, remainingAnnualBenefit: 130_000,
  }).lines.map(x => x.insurancePay), [100_000, 30_000]);
  for (const visit of ["inpatient", "outpatient"] as const) {
    for (const invalid of [null, [], "100", {remainingAnnualBenefit: NaN}, {remainingAnnualBenefit: 50_000_001}]) {
      assert.equal(single(visit, 100_000, invalid as BasicBenefitLimits).insurancePay, null);
      assert.equal(bundle(visit, [100_000], invalid as BasicBenefitLimits).totalInsurancePay, null);
    }
  }
  for (const bad of [-1, 1.5, 200_001]) {
    assert.equal(single("outpatient", 30_000, {outpatientLimit: bad}).insurancePay, null);
  }
  assert.equal(single("inpatient", 30_000, {priorInpatientDeductible: 2_000_001}).insurancePay, null);
  assert.equal(single("outpatient", 30_000, {priorInpatientDeductible: 0}).insurancePay, null);
  assert.equal(single("inpatient", 30_000, {outpatientLimit: 100_000}).insurancePay, null);
}
for (const [generation, plan] of [["2009","selective"],["2017","standard"],["2017","selectiveII"]] as const) {
  const claim = { plan: plan as Plan, priorAnnualOutpatientVisits: 0,
    priorAnnualPrescriptions: 0, lines: [
      { visit: "outpatient" as const, facility: "clinic" as const, amount: 400_000 },
      { visit: "outpatient" as const, facility: "pharmacy" as const, amount: 100_000 },
    ].map(line => plan === "selectiveII" ? {...line, splitAmounts: {benefit: line.amount, nonBenefit: 0}} : line) };
  assert.equal(calculateMany(generation, {...claim, perVisitCoverageLimit: 250_000}).totalInsurancePay, null);
  for (const [index, limit] of [250_000, 50_000].entries()) {
    const result = calculateMany(generation, {...claim, priorAnnualOutpatientVisits: index === 0 ? 0 : undefined,
      priorAnnualPrescriptions: index === 1 ? 0 : undefined, lines: [claim.lines[index]], perVisitCoverageLimit: limit});
    assert.equal(result.totalInsurancePay, limit);
  }
}
console.log("급여 입원 공제·통원 계약액·연간 잔여액·외래/약국 독립 한도 검증 완료");
