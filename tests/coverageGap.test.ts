import { calcCoverageGap } from "../src/lib/insurance/decision/coverageGap";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const 억 = 100000000;

// 0 / 0 → 같음 (0은 정상 입력)
{
  const r = calcCoverageGap({ needed: 0, current: 0 });
  check("0/0 → equal, 부족·초과 0", r.direction === "equal" && r.shortfall === 0 && r.surplus === 0, JSON.stringify(r));
}
// 5억 / 0 → 5억 부족 (무보험)
{
  const r = calcCoverageGap({ needed: 5*억, current: 0 });
  check("5억/0 → short, 부족 5억", r.direction === "short" && r.shortfall === 5*억 && r.surplus === 0, JSON.stringify(r));
}
// 0 / 3억 → 3억 많음
{
  const r = calcCoverageGap({ needed: 0, current: 3*억 });
  check("0/3억 → over, 초과 3억", r.direction === "over" && r.surplus === 3*억 && r.shortfall === 0, JSON.stringify(r));
}
// 2억 / 1억4천 → 6천만 부족
{
  const r = calcCoverageGap({ needed: 2*억, current: 140000000 });
  check("2억/1.4억 → 6천만 부족", r.direction === "short" && r.shortfall === 60000000, JSON.stringify(r));
}
// 같은 값 → equal
{
  const r = calcCoverageGap({ needed: 3*억, current: 3*억 });
  check("3억/3억 → equal", r.direction === "equal" && r.shortfall === 0 && r.surplus === 0);
}
// 음수 → 0 정규화
{
  const r = calcCoverageGap({ needed: -100, current: 3*억 });
  check("음수 needed → 0 정규화 → 3억 초과", r.needed === 0 && r.direction === "over" && r.surplus === 3*억, JSON.stringify(r));
}
// 소수 → floor
{
  const r = calcCoverageGap({ needed: 200000000.9, current: 140000000.4 });
  check("소수 → floor", r.needed === 200000000 && r.current === 140000000);
}

console.log(`\n[coverageGap] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
