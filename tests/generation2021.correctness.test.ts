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

// H-2b: 통원 회당 보험금 20만원 한도 — 경계값
{
  // 급여 통원(병·의원): ownPay = max(0.2a, 1만), ins = 0.8a. ins가 20만이 되는 지점 = 25만
  const atLimit = calc2021({ amount: 250000, coverage: "benefit", visit: "outpatient", tier: "clinic" });
  check("급여 통원 경계: 25만원 → 보험금 정확히 20만, 한도 미표기", atLimit.insurancePay === 200000 && atLimit.appliedCaps.length === 0, JSON.stringify(atLimit));
  const overLimit = calc2021({ amount: 250001, coverage: "benefit", visit: "outpatient", tier: "clinic" });
  check("급여 통원 경계+1: 보험금 20만 고정 + 한도 표기", overLimit.insurancePay === 200000 && overLimit.appliedCaps.includes("GEN2021_OUTPATIENT_PER_VISIT"), JSON.stringify(overLimit));
  check("급여 통원 경계+1: 초과분은 본인부담", overLimit.ownPay === 250001 - 200000, JSON.stringify(overLimit));

  // 비급여 통원: ownPay = max(0.3a, 3만), ins = 0.7a. ins가 20만이 되는 지점 ≒ 285,714
  const nb = calc2021({ amount: 1000000, coverage: "non_benefit", visit: "outpatient", tier: "clinic" });
  check("비급여 통원 100만원 → 보험금 20만 한도", nb.insurancePay === 200000 && nb.ownPay === 800000, JSON.stringify(nb));

  // 입원에는 회당 한도가 없다
  const inp = calc2021({ amount: 5000000, coverage: "benefit", visit: "inpatient", tier: "clinic" });
  check("급여 입원 500만원: 회당 한도 없음", inp.insurancePay === 4000000 && inp.appliedCaps.length === 0, JSON.stringify(inp));
  const inpNb = calc2021({ amount: 5000000, coverage: "non_benefit", visit: "inpatient", tier: "clinic" });
  check("비급여 입원 500만원: 회당 한도 없음", inpNb.insurancePay === 3500000 && inpNb.appliedCaps.length === 0, JSON.stringify(inpNb));

}

// H-2b 고지 범위: 급여 청구에 적용되지 않는 제한을 급여 결과에 안내하면 안 된다
{
  const n = (r: ReturnType<typeof calc2021>) => r.notes.join(" ");

  const benOut = calc2021({ amount: 300000, coverage: "benefit", visit: "outpatient", tier: "clinic" });
  check("급여 통원: 연간 보상한도 고지 있음", n(benOut).includes("5,000만원"), n(benOut));
  check("급여 통원: 비급여 100회 고지 없음", !n(benOut).includes("100회"), n(benOut));
  check("급여 통원: 3대비급여 고지 없음", !n(benOut).includes("3대비급여"), n(benOut));

  const benIn = calc2021({ amount: 3000000, coverage: "benefit", visit: "inpatient", tier: "clinic" });
  check("급여 입원: 연간 보상한도 고지 있음", n(benIn).includes("5,000만원"), n(benIn));
  check("급여 입원: 비급여 전용 고지 없음", !n(benIn).includes("100회") && !n(benIn).includes("3대비급여"), n(benIn));

  const nbOut = calc2021({ amount: 300000, coverage: "non_benefit", visit: "outpatient", tier: "clinic" });
  check("비급여 통원: 세 고지 모두 있음",
    n(nbOut).includes("5,000만원") && n(nbOut).includes("100회") && n(nbOut).includes("3대비급여"), n(nbOut));

  const nbIn = calc2021({ amount: 3000000, coverage: "non_benefit", visit: "inpatient", tier: "clinic" });
  check("비급여 입원: 3대비급여 고지 있음", n(nbIn).includes("3대비급여"), n(nbIn));
  check("비급여 입원: 통원 전용 100회 고지 없음", !n(nbIn).includes("100회"), n(nbIn));
}

console.log(`[generation2021 정확성] ${cases}케이스 × 5불변식 + 개별 18건 — 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
else console.log("  ✅ 정확성 불변식 전부 통과");
