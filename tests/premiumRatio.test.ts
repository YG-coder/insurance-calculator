import { calcPremiumRatio } from "../src/lib/insurance/decision/premiumRatio";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}
const 만 = 10000;

// 월소득 300만, 보험료 30만 → 10%
{
  const r = calcPremiumRatio({ monthlyIncome: 300*만, monthlyPremium: 30*만 });
  check("비중 = 10%", Math.abs((r.ratioPercent ?? 0) - 10) < 0.001, JSON.stringify(r));
  check("연간 보험료 = 360만", r.yearlyPremium === 3600000);
  check("연간 소득 = 3600만", r.yearlyIncome === 36000000);
}
// 월소득 400만, 보험료 50만 → 12.5%
{
  const r = calcPremiumRatio({ monthlyIncome: 400*만, monthlyPremium: 50*만 });
  check("비중 = 12.5%", Math.abs((r.ratioPercent ?? 0) - 12.5) < 0.001, JSON.stringify(r));
}
// 소득 0 → NEED_INCOME
{
  const r = calcPremiumRatio({ monthlyIncome: 0, monthlyPremium: 30*만 });
  check("소득 0 → NEED_INCOME, 비중 null", r.status === "NEED_INCOME" && r.ratioPercent === null, JSON.stringify(r));
}
// 보험료 0 → 0% (정상, 보험료 없음)
{
  const r = calcPremiumRatio({ monthlyIncome: 300*만, monthlyPremium: 0 });
  check("보험료 0 → 0%", r.status === "OK" && r.ratioPercent === 0, JSON.stringify(r));
}
// 음수 → 0 정규화
{
  const r = calcPremiumRatio({ monthlyIncome: -100, monthlyPremium: 30*만 });
  check("음수 소득 → NEED_INCOME", r.status === "NEED_INCOME");
}
// 소수 → floor 입력
{
  const r = calcPremiumRatio({ monthlyIncome: 3000000.9, monthlyPremium: 300000.7 });
  check("입력 floor", r.monthlyIncome === 3000000 && r.monthlyPremium === 300000);
}

console.log(`\n[premiumRatio] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
