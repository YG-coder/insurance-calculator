import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Health from "../src/components/calculators/HealthCalc";
import Single from "../src/components/calculators/HealthCalc5th";
import Standardized from "../src/components/calculators/HealthCalcStandardized";
import FourthMany from "../src/components/calculators/HealthCalcMulti2021";
import FifthMany from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom } from "./_uiRender";
import { visibleCopy } from "./_uiCopyGuard";

const fresh = (Component: () => unknown, name: string) => mount(Component, stateNamesFrom(readFileSync(`src/components/calculators/${name}.tsx`, "utf8")));
for (const [Component, name, state, pay] of [
  [Health, "HealthCalc", { coverage: "benefit", visit: "inpatient" }, "240,000원"],
  [Single, "HealthCalc5th", { coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient" }, "150,000원"],
  [Standardized, "HealthCalcStandardized", { plan: "standard", priorVisits: "0" }, "240,000원"],
  [FourthMany, "HealthCalcMulti2021", { priorPaidByAxis: { disease_non_benefit: "0" }, priorOutVisits: "0" }, "400,000원"],
  [FifthMany, "HealthCalcMulti2026", { nonBenefitItem: "general", severity: "non_critical", cause: "disease", priorOutDays: "0", priorInsuranceByAxis: { general_non_critical_disease: "0" } }, "300,000원"],
] as const) {
  const h = fresh(Component, name);
  if (h.names.includes("amount")) assert.equal(h.get("amount"), "", name);
  if (h.names.includes("amounts")) assert.deepEqual(h.get("amounts"), ["", ""], name);
  if (h.names.includes("quickAmount")) {
    assert.equal(h.get("quickAmount"), "");
    assert((h.get("rows") as { amount: string }[]).every(row => row.amount === ""));
    assert.equal(h.get("quickCount"), "3");
  }
  if (h.names.includes("copyCount")) assert.equal(h.get("copyCount"), "3");
  for (const [key, value] of Object.entries(state)) h.set(key, value);
  h.set("submitted", true);
  assert.equal(h.render().resultItems(), null, name + " missing expense must hold");
  assert.match(visibleCopy(h.renderMarkup()), /올바르게 입력/);
  if (h.names.includes("amount")) h.set("amount", "300000");
  if (h.names.includes("amounts")) h.set("amounts", ["300000", "300000"]);
  if (h.names.includes("quickAmount")) h.set("rows", (h.get("rows") as object[]).map(row => ({ ...row, amount: "300000" })));
  assert.equal(h.render().resultItems()?.find(item => item.label.includes("보험 적용"))?.value, pay, name + " explicit expense must calculate");
  if (h.names.includes("quickAmount")) {
    const addRow = h.render().nodes.find(node => node.tag === "button" && node.text === "+ 행 추가");
    assert(addRow);
    (addRow.props.onClick as () => void)();
    assert.equal((h.get("rows") as { amount: string }[]).at(-1)?.amount, "");
    h.set("submitted", true);
    assert.equal(h.render().resultItems(), null, "new empty row must block partial sum");
  }
  if (h.names.includes("amounts")) {
    h.set("amounts", ["300000", ""]);
    assert.equal(h.render().resultItems(), null, name + " incomplete row must block entire sum");
  }
}

// 정상 결과를 이미 본 뒤에도 보류 유형으로 바꾸면 이전 금액이 사라져야 한다.
const standardized = fresh(Standardized, "HealthCalcStandardized");
const chooseStandardized = (value: string) => {
  const choice = standardized.render().nodes.find(node => node.props["data-value"] === value);
  assert(choice);
  (choice.props.onClick as () => void)();
};
const standardizedSubmit = () => standardized.render().nodes.find(node => node.tag === "button" && node.text === "자기부담금 계산하기");
standardized.set("rows", [{ id: 1, amount: "100000", visit: "inpatient" }]);
standardized.set("priorPaid", "0");
standardized.set("submitted", true);
chooseStandardized("standard");
assert.equal(standardized.render().resultItems()?.[1].value, "20,000원");
for (const generation of ["2017", "2009"]) {
  chooseStandardized(generation);
  chooseStandardized("selectiveII");
  assert.equal(standardizedSubmit()?.props.disabled, false);
  const splitFields = standardized.render().nodes.filter(node => node.tag === "#RawAmountInput"
    && /1번 (급여 본인부담금|보장 대상 비급여 의료비)/.test(String(node.props.ariaLabel)));
  assert.equal(splitFields.length, 2);
  assert.equal(standardized.render().resultItems(), null);
  const [benefitField, nonBenefitField] = splitFields;
  (benefitField.props.onChange as (value: string) => void)("0");
  assert.equal(standardized.render().resultItems(), null, "blank non-benefit must not become zero");
  (nonBenefitField.props.onChange as (value: string) => void)("100000");
  assert.equal(standardized.render().resultItems()?.[1].value, "20,000원");
  assert.equal(standardized.render().resultItems()?.[2].value, "80,000원");
  standardized.set("rows", [{ id: 1, amount: "100000", visit: "inpatient" }]);
}
chooseStandardized("selective");
assert.equal(standardizedSubmit()?.props.disabled, false);
assert.equal(standardized.render().resultItems()?.[1].value, "10,000원");
standardized.set("policyDate", "2015-08-31");
assert.doesNotMatch(visibleCopy(standardized.renderMarkup()), /2세대 계약은 선택형Ⅱ일 수 있습니다/);
standardized.set("policyDate", "2015-09-01");
assert.match(visibleCopy(standardized.renderMarkup()), /2세대 계약은 선택형Ⅱ일 수 있습니다/);
assert.equal(standardized.render().resultItems()?.[1].value, "10,000원", "판매 시기로 약관 유형을 바꾸지 않는다");
chooseStandardized("2017");
assert.equal(standardizedSubmit()?.props.disabled, true);
assert.match(visibleCopy(standardized.renderMarkup()), /3세대 선택형.*계산을 보류합니다/);
assert.match(visibleCopy(standardized.renderMarkup()), /약관에 급여 본인부담금 10%·비급여 20%가 각각 적용되면 위의 선택형Ⅱ를 선택하세요/);
assert.equal(standardized.render().resultItems(), null);
chooseStandardized("2009");
assert.equal(standardized.get("plan"), null);
assert.equal(standardized.render().resultItems(), null);
chooseStandardized("standard");
assert.equal(standardized.render().resultItems()?.[1].value, "20,000원");

const initial = fresh(FourthMany, "HealthCalcMulti2021");
assert(Object.values(initial.get("priorPaidByAxis") as Record<string, string>).every(value => value === ""));
for (const key of ["priorOutVisits", "priorManualVisits", "priorInjectionVisits"]) assert.equal(initial.get(key), "");
const paths = [
  ["injury_benefit", "injury", "benefit", "none", 500000, 400000],
  ["disease_benefit", "disease", "benefit", "none", 500000, 400000],
  ["injury_non_benefit", "injury", "non_benefit", "none", 500000, 400000],
  ["disease_non_benefit", "disease", "non_benefit", "none", 500000, 400000],
  ["manual_therapy", "disease", "non_benefit", "manual_therapy", 3500000, 3400000],
  ["injection", "injury", "non_benefit", "injection", 2500000, 2400000],
  ["mri", "disease", "non_benefit", "mri", 3000000, 2900000],
] as const;
for (const [axis, cause, coverage, rider, limit, used] of paths) {
  const h = fresh(FourthMany, "HealthCalcMulti2021");
  for (const [key, value] of Object.entries({ cause, coverage, rider, amounts: ["300000", "300000"],
    priorOutVisits: "0", priorManualVisits: "0", priorInjectionVisits: "0", submitted: true })) h.set(key, value);
  assert.equal(h.render().resultItems(), null, axis + " cumulative blank must hold");
  assert.match(visibleCopy(h.renderMarkup()), /빈 값은 0으로 추정하지 않고 계산을 보류/);
  h.set("priorPaidByAxis", { ...(h.get("priorPaidByAxis") as object), [axis]: "0" });
  assert.equal(h.render().resultItems()?.[2].value, rider === "none" ? "400,000원" : "420,000원");
  h.set("priorPaidByAxis", { ...(h.get("priorPaidByAxis") as object), [axis]: String(used) });
  if (rider === "none") h.set("annualLimitByAxis", { ...(h.get("annualLimitByAxis") as object), [axis]: String(limit) });
  // 연간 잔여액 10만 원: 첫 행에 지급되고 두 번째 행은 0원. 공제/한도 순서의 수기 기대값.
  assert.equal(h.render().resultItems()?.[2].value, "100,000원");
  h.set("priorPaidByAxis", { ...(h.get("priorPaidByAxis") as object), [axis]: "" });
  assert.equal(h.render().resultItems(), null);
  assert.equal(h.render().nodes.filter(node => node.tag === "td").length, 0);
}
for (const [rider, counter] of [["none", "priorOutVisits"], ["manual_therapy", "priorManualVisits"], ["injection", "priorInjectionVisits"]]) {
  const h = fresh(FourthMany, "HealthCalcMulti2021");
  const axis = rider === "none" ? "disease_non_benefit" : rider;
  for (const [key, value] of Object.entries({ rider, priorPaidByAxis: { [axis]: "0" }, amounts: ["300000"], submitted: true })) h.set(key, value);
  assert.equal(h.render().resultItems(), null, counter + " blank must hold");
  h.set(counter, "0"); assert(h.render().resultItems());
}
// 다른 축의 명시 입력을 새 축에 가져오지 않는다. 돌아오면 직접 입력한 값만 남는다.
initial.set("priorPaidByAxis", { ...(initial.get("priorPaidByAxis") as object), disease_non_benefit: "0" });
initial.set("cause", "injury");
assert.equal(initial.render().nodes.find(node => node.props.id === "gen2021-prior-paid")?.props.value, "");
initial.set("cause", "disease");
assert.equal(initial.render().nodes.find(node => node.props.id === "gen2021-prior-paid")?.props.value, "0");
assert(Object.values(fresh(FourthMany, "HealthCalcMulti2021").get("priorPaidByAxis") as Record<string, string>).every(value => value === ""));
console.log("[실손 초기 입력] 진료비 미입력 차단·명시 입력, 4세대 누적 7축·횟수·잔여 한도·재마운트 통과");
