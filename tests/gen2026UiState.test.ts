import { confirmNoPrior2026 } from "./_priorInputs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Single from "../src/components/calculators/HealthCalc5th";
import Many from "../src/components/calculators/HealthCalcMulti2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { mount, stateNamesFrom, type Harness, type Screen } from "./_uiRender";

const setup = (Component: () => unknown, name: string, inputs: Record<string, unknown> = {}) => {
  const h = mount(Component, stateNamesFrom(readFileSync(`src/components/calculators/${name}.tsx`, "utf8")));
  if (Component === Many) confirmNoPrior2026(h);
  for (const [key, value] of Object.entries(inputs)) h.set(key, value);
  return h;
};
const click = (h: Harness, text: string) => {
  const button = h.render().nodes.find(n => n.tag === "button" && n.text.trim() === text);
  assert(button, `버튼: ${text}`);
  (button.props.onClick as () => void)();
};
const findSelect = (tree: unknown): { props: { onChange: (e: unknown) => void } } | undefined => {
  if (!tree || typeof tree !== "object") return;
  if (Array.isArray(tree)) {
    for (const child of tree) { const found = findSelect(child); if (found) return found; }
    return;
  }
  const el = tree as { type?: unknown; props?: { children?: unknown; onChange?: unknown } };
  if (el.type === "select") return el as ReturnType<typeof findSelect>;
  return findSelect(el.props?.children);
};
const pick = (h: Harness, label: string, value: string) => {
  const node = h.render().nodes.find(n => n.tag === "label" && n.text.startsWith(label));
  assert(node, `라벨: ${label}`);
  const select = findSelect(node.props.children);
  assert(select, `선택 입력: ${label}`);
  select.props.onChange({ target: { value } });
};
const warnings = (screen: Screen) => screen.nodes.filter(n => n.tag === "#NoticeBox" && n.props.variant === "warning");
const hiddenUntilSubmit = (h: Harness) => {
  assert.equal(h.render().resultItems(), null);
  assert.deepEqual(warnings(h.render()), []);
};
const general = {
  coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical",
  visit: "outpatient", cause: "disease", priorOutDays: "0", nhisRate: "20",
};

// 용도 미선택 경고 → 실제 선택 이벤트 → 재계산 전에는 다음 입력 경고도 표시하지 않는다.
for (const severity of ["critical", "non_critical"]) {
  const h = setup(Many, "HealthCalcMulti2026", { ...general, nonBenefitItem: "injection", severity, cause: "", priorOutDays: "" });
  click(h, "여러 건 계산하기");
  assert(warnings(h.render()).some(n => /약제 용도를 선택/.test(n.text)));
  pick(h, "약제 용도", "anticancer"); hiddenUntilSubmit(h);
  click(h, "여러 건 계산하기");
  assert(warnings(h.render()).some(n => /원인/.test(n.text)));
  pick(h, "원인", "disease"); hiddenUntilSubmit(h);
}
for (const [inputs, label, value, warning] of [
  [{ ...general, severity: "" }, "질환 구분", "non_critical", /질환 구분을 선택/],
  [{ ...general, cause: "" }, "원인", "disease", /원인/],
  [{ ...general, nonBenefitItem: "" }, "치료유형", "general", /치료유형/],
  [{ ...general, visit: "inpatient" }, "입원 의료기관", "clinic", /입원 의료기관/],
] as const) {
  const h = setup(Many, "HealthCalcMulti2026", inputs);
  click(h, "여러 건 계산하기"); assert(warnings(h.render()).some(n => warning.test(n.text)));
  pick(h, label, value); hiddenUntilSubmit(h);
  click(h, "여러 건 계산하기"); assert(h.render().resultItems());
}
// 정상 금액 → 판정 입력 변경: 경고와 금액이 모두 재계산 전까지 숨겨진다.
for (const [label, value] of [["급여 구분", "benefit"], ["치료 형태", "inpatient"],
  ["치료유형", "injection"], ["질환 구분", "critical"], ["원인", "injury"]]) {
  const h = setup(Many, "HealthCalcMulti2026", general);
  click(h, "여러 건 계산하기"); assert(h.render().resultItems());
  pick(h, label, value); hiddenUntilSubmit(h);
}
const exception = setup(Many, "HealthCalcMulti2026", { ...general, nonBenefitItem: "injection", nonCriticalInjectionPurpose: "anticancer" });
click(exception, "여러 건 계산하기"); assert(exception.render().resultItems());
pick(exception, "약제 용도", ""); hiddenUntilSubmit(exception);
click(exception, "여러 건 계산하기"); assert(warnings(exception.render()).some(n => /약제 용도/.test(n.text)));

// 급여 의료기관·원인 및 특약 승인/행별 종별도 같은 제출 초기화 계약을 따른다.
for (const [inputs, label, value] of [
  [{ ...general, coverage: "benefit" }, "의료기관", "hospital"],
  [{ ...general, coverage: "benefit" }, "원인", "injury"],
  [{ nonBenefitItem: "musculoskeletal_esw", severity: "critical" }, "보상 승인 회차", "20"],
  [{ nonBenefitItem: "mri", severity: "critical", rows: [{ amount: "300000", visit: "inpatient", tier: "clinic" }] }, "의료기관", "hospital"],
] as const) {
  const h = setup(Many, "HealthCalcMulti2026", inputs);
  click(h, "여러 건 계산하기"); pick(h, label, value); hiddenUntilSubmit(h);
}
const row = setup(Many, "HealthCalcMulti2026", { nonBenefitItem: "injection", severity: "critical", injectionPurpose: "general" });
click(row, "여러 건 계산하기"); pick(row, "치료 형태", "outpatient"); hiddenUntilSubmit(row);

const checkGroup = (h: Harness, labels: string[], selected: string | null) => {
  const screen = h.render();
  for (const label of labels) {
    const button = screen.nodes.find(n => n.tag === "button" && n.text.trim() === label);
    assert(button, `선택 버튼: ${label}`);
    assert.equal(button.props["aria-pressed"], label === selected, `선택 상태: ${label}`);
  }
  // 다른 선택 그룹에도 속성이 빠지지 않는다. 계산 실행 버튼은 토글이 아니다.
  for (const button of screen.nodes.filter(n => n.tag === "button" && !n.text.includes("계산하기"))) {
    assert.equal(typeof button.props["aria-pressed"], "boolean", `토글 속성: ${button.text}`);
  }
};
const single = setup(Single, "HealthCalc5th");
const items = ["일반 비급여", "근골격계 이학요법·체외충격파", "비급여 주사료", "비급여 MRI", "상급병실료 차액"];
checkGroup(single, ["급여", "비급여"], "비급여");
checkGroup(single, ["통원", "입원"], "입원");
checkGroup(single, items, null);
for (const label of items) { click(single, label); checkGroup(single, items, label); }
click(single, "일반 비급여"); checkGroup(single, ["중증", "비중증"], null);
for (const label of ["중증", "비중증"]) { click(single, label); checkGroup(single, ["중증", "비중증"], label); }
const tiers = ["병·의원급", "상급종합·종합병원"];
checkGroup(single, tiers, null);
for (const label of tiers) { click(single, label); checkGroup(single, tiers, label); }
click(single, "급여"); checkGroup(single, ["급여", "비급여"], "급여");
click(single, "통원"); checkGroup(single, ["통원", "입원"], "통원");
checkGroup(single, tiers, "병·의원급");
for (const label of tiers) { click(single, label); checkGroup(single, tiers, label); }
click(single, "비급여"); checkGroup(single, ["급여", "비급여"], "비급여");
click(single, "입원"); checkGroup(single, ["통원", "입원"], "입원");

const capped = setup(Single, "HealthCalc5th", {
  amount: "20000000", coverage: "non_benefit", nonBenefitItem: "general",
  severity: "critical", visit: "inpatient", nbInpatientTier: "hospital",
});
const prior = capped.render().nodes.find(n => n.props.id === "med5-prior-annual-deductible");
assert(prior); assert.equal(prior.props.value, "0");
assert.match(capped.render().text, /0원으로 가정/);
click(capped, "자기부담금 계산하기");
assert.equal(capped.render().resultItems()![2].value, "5,000,000원");
assert.match(capped.render().text, /기존 누적 공제금액 0원을 반영/);
assert.doesNotMatch(capped.render().text, /priorAnnualDeductible/);
(prior.props.onChange as (value: string) => void)("4000000");
click(capped, "자기부담금 계산하기");
assert.equal(capped.render().resultItems()![2].value, "1,000,000원");
assert.match(capped.render().text, /기존 누적 공제금액 4,000,000원을 반영/);

for (const purpose of ["anticancer", "antibiotic", "orphan_drug"]) {
  const h = setup(Single, "HealthCalc5th", { coverage: "non_benefit", severity: "non_critical", visit: "outpatient", amount: "300000", nonBenefitItem: "injection", injectionPurpose: purpose });
  click(h, "자기부담금 계산하기"); assert(h.render().resultItems());
  assert.match(h.render().text, /면책 예외에 해당하여 일반 비급여 산식을 적용/);
}
const orphan = calculateGen2026Item({
  route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
  injectionPurpose: "orphan_drug", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0,
});
assert.equal(orphan.status, "OK"); assert.match(orphan.notes.join(" "), /희귀의약품 용도의/);
assert.doesNotMatch(orphan.notes.join(" "), /희귀의약품를/);
console.log("[5세대 화면 상태] 판정 선택 전이·경고/결과 초기화·모든 단건 토글 선택 상태 통과");
