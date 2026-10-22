import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mount, stateNamesFrom } from "./_uiRender";
import Health from "../src/components/calculators/HealthCalc";
import Standard from "../src/components/calculators/HealthCalcStandardized";
import Fifth from "../src/components/calculators/HealthCalc5th";
import Future from "../src/components/calculators/FuturePremiumCalc";
import Surrender from "../src/components/calculators/HealthSurrenderCalc";
import Cancel from "../src/components/calculators/CancelVsKeepCalc";
import Car from "../src/components/calculators/CarCalc";
import Family from "../src/components/calculators/FamilyLivingCalc";
import Premium from "../src/components/calculators/PremiumCalc";

const harness = (name: string, component: () => unknown) => mount(component,
  stateNamesFrom(readFileSync(`src/components/calculators/${name}.tsx`, "utf8")));
for (const [name, component] of [["HealthCalc", Health], ["HealthCalcStandardized", Standard], ["HealthCalc5th", Fifth]] as const) {
  const h = harness(name, component);
  h.set("submitted", true);
  assert.equal(h.render().resultItems(), null, `${name}: 빈 입력은 결과가 아님`);
  assert.equal(h.render().nodes.filter(n => n.props.role === "alert").length, 1, `${name}: 차단 요약 한 곳`);
}
const future = harness("FuturePremiumCalc", Future);
future.set("submitted", true);
future.set("remaining", "");
assert.equal(future.render().resultItems(), null, "빈 기간을 완납 0원으로 계산하지 않음");
assert.ok(future.render().nodes.some(n => n.props.role === "alert"));
future.set("remaining", "0");
assert.equal(future.render().resultItems()?.[0].value, "0원", "명시적 0개월은 완납 결과 유지");

const surrender = harness("HealthSurrenderCalc", Surrender);
surrender.set("submitted", true);
surrender.set("surrender", "");
assert.equal(surrender.render().resultItems(), null, "미입력 환급금을 0원으로 계산하지 않음");
surrender.set("surrender", "0");
assert.ok(surrender.render().resultItems()?.some(x => x.label === "현재 해지환급금" && x.value === "0원"));
surrender.set("mode", "estimate"); surrender.set("ack", true);
assert.equal(surrender.render().resultItems(), null, "가정값 없는 예상 모드는 차단");
assert.ok(surrender.render().nodes.some(n => n.props.role === "alert"));

for (const raw of ["-10", "1e2", "abc60", " 60 ", "60%", ".5", "101"]) {
  surrender.set("estRate", raw);
  assert.equal(surrender.render().resultItems(), null, `표시된 예상률 ${raw}를 다른 비율로 계산하지 않음`);
  assert.ok(surrender.render().nodes.some(n => n.props.role === "alert"));
}
surrender.set("estRate", "60.5");
assert.ok(surrender.render().resultItems()?.some(x => x.label === "예상 해지환급금" && x.value === "2,613,600원"));

const cancel = harness("CancelVsKeepCalc", Cancel);
cancel.set("submitted", true);
assert.match(cancel.render().text, /지금 해지하면/);
cancel.set("surrender", "");
assert.doesNotMatch(cancel.render().text, /지금 해지하면/, "계산 뒤 비운 입력은 결과를 숨김");
cancel.set("surrender", "0");
assert.match(cancel.render().text, /지금 해지하면/, "명시적 0원은 허용");

const car = harness("CarCalc", Car);
car.set("rows", [{name: "A", amount: "0"}, {name: "B", amount: "100000"}]);
car.set("submitted", true);
assert.ok(car.render().nodes.some(n => n.props.role === "alert"), "유효 견적 1개는 NEED_MORE 안내");
car.set("rows", [{name: "A", amount: "500000"}, {name: "B", amount: "700000"}, {name: "C", amount: ""}]);
assert.ok(car.render().nodes.some(n => n.props.role === "status" && /제외/.test(n.text)), "비교에서 빠진 견적 안내");

const family = harness("FamilyLivingCalc", Family);
family.set("rows", [{monthly: "3000000", years: "10", extra: ""}, {monthly: "2000000", years: "", extra: ""}]);
family.set("submitted", true);
assert.equal(family.render().resultItems()?.at(-1)?.value, "360,000,000원", "기존 완성 구간 합산 정책 유지");
assert.ok(family.render().nodes.some(n => n.props.role === "status" && /미완성 1개 구간은 제외/.test(n.text)));

const premium = harness("PremiumCalc", Premium);
premium.set("income", "0"); premium.set("premium", "100000"); premium.set("submitted", true);
assert.equal(premium.render().resultItems(), null);
assert.ok(premium.render().nodes.some(n => n.props.role === "alert"), "소득 0원 비율 보류 안내");
console.log("[조건부 안내] 빈 입력/실제 0원·제출 차단·부분 합산·비교 보류 회귀 통과");
