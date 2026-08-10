import { calcFuturePremium } from "../src/lib/insurance/decision/futurePremium";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

// 월 18만, 남은 120개월
{
  const r = calcFuturePremium({ monthlyPremium: 180000, remainingMonths: 120 });
  check("앞으로 낼 = 18만×120 = 2160만", r.futurePremium === 21600000, JSON.stringify(r));
  check("기납입 미입력 → 나머지 null", r.paidSoFar === null && r.totalAtCompletion === null && r.futureSharePercent === null);
}
// 기납입 24개월 추가
{
  const r = calcFuturePremium({ monthlyPremium: 180000, remainingMonths: 120, paidMonths: 24 });
  check("지금까지 낸 = 18만×24 = 432만", r.paidSoFar === 4320000, JSON.stringify(r));
  check("완납 총액 = 432만 + 2160만 = 2592만", r.totalAtCompletion === 25920000);
  check("부담 비중 = 2160/2592 ≈ 83.33%", Math.abs((r.futureSharePercent ?? 0) - 83.3333) < 0.01);
}
// 남은 0개월 → 완납 상태
{
  const r = calcFuturePremium({ monthlyPremium: 180000, remainingMonths: 0 });
  check("남은 0 → 앞으로 낼 0원 + 안내", r.status === "OK" && r.futurePremium === 0 && r.notes.length > 0, JSON.stringify(r));
}
// 월보험료 0 → NEED_INPUT
{
  const r = calcFuturePremium({ monthlyPremium: 0, remainingMonths: 120 });
  check("월보험료 0 → NEED_INPUT", r.status === "NEED_INPUT");
}
// 기납입 0개월 명시 입력 → paidSoFar 0, 부담비중 100%
{
  const r = calcFuturePremium({ monthlyPremium: 100000, remainingMonths: 60, paidMonths: 0 });
  check("기납입 0 명시 → 지금까지 0, 완납=미래", r.paidSoFar === 0 && r.totalAtCompletion === 6000000, JSON.stringify(r));
  check("부담 비중 100%", Math.abs((r.futureSharePercent ?? 0) - 100) < 0.001);
}

console.log(`\n[futurePremium] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
