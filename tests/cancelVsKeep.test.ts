import { calcCancelVsKeep } from "../src/lib/insurance/decision/cancelVsKeep";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

// 정상 입력
{
  const r = calcCancelVsKeep({ surrenderValue: 3000000, futurePremium: 21600000 });
  check("정상 → OK, 두 값 그대로", r.status === "OK" && r.surrenderValue === 3000000 && r.futurePremium === 21600000, JSON.stringify(r));
  check("차액 필드 없음 (병렬 표시만)", !("difference" in r));
}
// 한쪽 0 → NEED_INPUT
{
  const r = calcCancelVsKeep({ surrenderValue: 0, futurePremium: 21600000 });
  check("해지환급금 0 → NEED_INPUT", r.status === "NEED_INPUT" && r.surrenderValue === null, JSON.stringify(r));
}
{
  const r = calcCancelVsKeep({ surrenderValue: 3000000, futurePremium: 0 });
  check("앞으로 낼 보험료 0 → NEED_INPUT", r.status === "NEED_INPUT");
}
// 둘 다 미입력(0)
{
  const r = calcCancelVsKeep({ surrenderValue: 0, futurePremium: 0 });
  check("둘 다 0 → NEED_INPUT", r.status === "NEED_INPUT");
}
// 음수 정규화 → 0 취급 → NEED_INPUT
{
  const r = calcCancelVsKeep({ surrenderValue: -500000, futurePremium: 21600000 });
  check("음수 → 0 정규화 → NEED_INPUT", r.status === "NEED_INPUT", JSON.stringify(r));
}
// 큰 금액
{
  const r = calcCancelVsKeep({ surrenderValue: 50000000, futurePremium: 300000000 });
  check("큰 금액 → OK, 값 유지", r.status === "OK" && r.surrenderValue === 50000000 && r.futurePremium === 300000000);
}
// 소수 → floor
{
  const r = calcCancelVsKeep({ surrenderValue: 3000000.9, futurePremium: 21600000.7 });
  check("소수 → floor", r.surrenderValue === 3000000 && r.futurePremium === 21600000);
}

console.log(`\n[cancelVsKeep] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
