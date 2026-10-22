import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import HealthCalc5th from "../src/components/calculators/HealthCalc5th";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom } from "./_uiRender";
import { confirmNoPrior2026 } from "./_priorInputs";

const multi = mount(HealthCalcMulti2026, stateNamesFrom(readFileSync(
  "src/components/calculators/HealthCalcMulti2026.tsx", "utf8",
)));
multi.set("submitted", true);
let screen = multi.render();
assert.equal(screen.nodes.filter(node => node.props.role === "alert").length, 1);
assert.equal(screen.resultItems(), null);

// 각 행은 유효하지만 합계가 안전 정수 범위를 넘으면 엔진 보류를 알리고 금액을 숨긴다.
confirmNoPrior2026(multi);
multi.set("coverage", "benefit");
multi.set("visit", "inpatient");
multi.set("amounts", ["5000000000000000", "5000000000000000"]);
screen = multi.render();
assert.match(screen.nodes.find(node => node.props.role === "alert")?.text ?? "", /보류/);
assert.equal(screen.resultItems(), null);
assert.equal(screen.nodes.filter(node => node.props.role === "status").length, 0);

// 정상적인 0원 청구는 보류가 아니다. 결과와 정상 상태 안내를 함께 제공한다.
multi.set("amounts", ["0"]);
screen = multi.render();
assert.equal(screen.nodes.filter(node => node.props.role === "alert").length, 0);
assert.equal(screen.nodes.filter(node => node.props.role === "status").length, 1);
assert.ok(screen.resultItems());

const single = mount(HealthCalc5th, stateNamesFrom(readFileSync(
  "src/components/calculators/HealthCalc5th.tsx", "utf8",
)));
single.set("coverage", "benefit");
single.set("visit", "outpatient");
single.set("amount", "300000");
single.set("nhisRate", "");
single.set("submitted", true);
screen = single.render();
assert.equal(screen.resultItems(), null);
assert.ok(screen.nodes.some(node => node.props.role === "alert" && /본인부담률/.test(node.text)));
assert.ok(screen.nodes.some(node => node.props.role === "alert" && /영수증이나 보험사 안내/.test(node.text)));
assert.ok(screen.nodes.every(node => !node.text.includes("#2 입력 필요")));
console.log("[5세대 안내 접근성] 입력 차단·합계 초과 보류·정상 0원·단건 본인부담률 누락 확인");
