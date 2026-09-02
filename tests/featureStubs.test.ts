// HOLD 스텁 가드.
//
// feature/ 4종은 근거(시행세칙 공포·감독규정 확정·판매약관)가 확보되지 않아 의도적으로
// 미구현 상태다. 이 테스트는 두 가지를 막는다.
//   1) 스텁이 조용히 값을 반환하게 바뀌는 것 — 근거 없는 계산이 결과에 섞인다
//   2) STATUS가 HOLD가 아닌 값으로 바뀌는 것 — 상태 표시와 실제가 어긋난다
// 근거가 확보되어 실제로 구현할 때는 이 테스트를 함께 고쳐야 한다. 그게 의도다.
import { DEVELOPMENTAL_STATUS, developmentalBenefit } from "../src/lib/insurance/engine/feature/developmental";
import { DISCOUNT_STATUS, applyDiscount } from "../src/lib/insurance/engine/feature/discount";
import { EXCLUSION_STATUS, isExcluded } from "../src/lib/insurance/engine/feature/exclusion";
import { PREGNANCY_STATUS, pregnancyBenefit } from "../src/lib/insurance/engine/feature/pregnancy";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const stubs = [
  ["발달장애 보장", DEVELOPMENTAL_STATUS, developmentalBenefit],
  ["할인·할증", DISCOUNT_STATUS, applyDiscount],
  ["비중증 제외항목", EXCLUSION_STATUS, isExcluded],
  ["임신·출산 급여", PREGNANCY_STATUS, pregnancyBenefit],
] as const;

for (const [name, status, fn] of stubs) {
  check(`${name}: STATUS가 HOLD`, status === "HOLD", String(status));

  let threw = false;
  let message = "";
  try {
    (fn as () => unknown)();
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check(`${name}: 호출 시 값을 반환하지 않고 실패`, threw);
  check(`${name}: 실패 사유에 HOLD 표시`, message.includes("[HOLD]"), message);
}

console.log(`\n[featureStubs] 스텁 ${stubs.length}종 · 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
