// 4세대 엔진 정확성 테스트.
// 기준선(_reference2021.ts)과 무관하게, 산식이 반드시 만족해야 하는 성질만 검사한다.
// 회귀 테스트(generation2021.test.ts)는 "이전과 같은가"를, 이 파일은 "옳은가"를 본다.
import { calc2021 } from "../src/lib/insurance/engine/generation2021";
import { Coverage, Visit, Tier } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const amounts = [
  0, 1, 9999, 10000, 10001, 14999, 15000, 19999, 20000, 29999, 30000, 30001,
  50000, 100000, 100001, 100003, 300000, 300001, 1000000, 5000000, 99999999,
];
const coverages: Coverage[] = ["benefit", "non_benefit"];
const visits: Visit[] = ["outpatient", "inpatient"];
const tiers: Tier[] = ["clinic", "hospital"];

let cases = 0;
for (const amount of amounts)
  for (const coverage of coverages)
    for (const visit of visits)
      for (const tier of tiers) {
        cases++;
        const r = calc2021({ amount, coverage, visit, tier });
        const id = `[${amount}/${coverage}/${visit}/${tier}]`;
        const own = r.ownPay ?? NaN;
        const ins = r.insurancePay ?? NaN;

        check(`${id} 합계 불변식`, own + ins === amount, `own=${own} ins=${ins} amount=${amount}`);
        check(`${id} 자기부담금은 진료비를 초과할 수 없다`, own <= amount, `own=${own} amount=${amount}`);
        check(`${id} 음수 금액 없음`, own >= 0 && ins >= 0, `own=${own} ins=${ins}`);
        check(`${id} 원 단위 정수(ownPay)`, Number.isInteger(own), `own=${own}`);
        check(`${id} 원 단위 정수(insurancePay)`, Number.isInteger(ins), `ins=${ins}`);
      }

// 비정상 입력 방어
{
  const neg = calc2021({ amount: -100000, coverage: "non_benefit", visit: "outpatient", tier: "clinic" });
  check("음수 진료비 → 0 정규화", neg.amount === 0 && neg.ownPay === 0 && neg.insurancePay === 0, JSON.stringify(neg));
  const nan = calc2021({ amount: NaN, coverage: "benefit", visit: "inpatient", tier: "clinic" });
  check("NaN 진료비 → 0 정규화", nan.amount === 0 && nan.ownPay === 0 && nan.insurancePay === 0, JSON.stringify(nan));
  const frac = calc2021({ amount: 10000.9, coverage: "benefit", visit: "inpatient", tier: "clinic" });
  check("소수 진료비 → floor", frac.amount === 10000 && frac.ownPay === 2000, JSON.stringify(frac));
}

// R-1 회귀 방지: 소액 통원에서 자기부담금이 진료비를 넘지 않는다
{
  const a = calc2021({ amount: 10000, coverage: "non_benefit", visit: "outpatient", tier: "clinic" });
  check("R-1 비급여 통원 1만원 → 본인 1만원 / 보험 0원", a.ownPay === 10000 && a.insurancePay === 0, JSON.stringify(a));
  const b = calc2021({ amount: 15000, coverage: "benefit", visit: "outpatient", tier: "hospital" });
  check("R-1 급여 통원 1.5만원(상급) → 본인 1.5만원 / 보험 0원", b.ownPay === 15000 && b.insurancePay === 0, JSON.stringify(b));
}

console.log(`[generation2021 정확성] ${cases}케이스 × 5불변식 + 개별 5건 — 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
else console.log("  ✅ 정확성 불변식 전부 통과");
