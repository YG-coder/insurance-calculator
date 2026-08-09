import { calcSurrender } from "../src/lib/insurance/decision/surrenderValue";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

// Mode known: 월 18만, 24개월, 환급금 300만
{
  const r = calcSurrender({ monthlyPremium: 180000, paidMonths: 24, mode: "known", surrenderValue: 3000000 });
  check("총납입 = 18만×24 = 432만", r.totalPaid === 4320000, JSON.stringify(r));
  check("손해액 = 432만 - 300만 = 132만", r.loss === 1320000);
  check("환급률 = 300/432 ≈ 69.44%", Math.abs((r.refundRatePercent ?? 0) - 69.4444) < 0.01);
  check("월평균손실 = 132만/24 = 55,000", r.monthlyAvgLoss === 55000);
  check("이익 아님", r.isGain === false);
}
// 선택 입력: 남은 120개월
{
  const r = calcSurrender({ monthlyPremium: 180000, paidMonths: 24, mode: "known", surrenderValue: 3000000, remainingMonths: 120 });
  check("앞으로 낼 보험료 = 18만×120 = 2160만", r.futurePremium === 21600000, JSON.stringify(r));
  check("완납 시 총액 = 432만 + 2160만 = 2592만", r.totalAtCompletion === 25920000);
}
// 남은 개월 미입력 → 미래 항목 null
{
  const r = calcSurrender({ monthlyPremium: 180000, paidMonths: 24, mode: "known", surrenderValue: 3000000 });
  check("남은개월 미입력 → futurePremium null", r.futurePremium === null);
  check("남은개월 미입력 → totalAtCompletion null", r.totalAtCompletion === null);
}
// 환급금 > 납입액 → 이익 표기
{
  const r = calcSurrender({ monthlyPremium: 100000, paidMonths: 10, mode: "known", surrenderValue: 1200000 });
  check("환급금>납입 → isGain true, loss 음수", r.isGain === true && (r.loss ?? 0) < 0, JSON.stringify(r));
}
// Mode estimate: 예상 환급률 50%
{
  const r = calcSurrender({ monthlyPremium: 100000, paidMonths: 20, mode: "estimate", estimatedRatePercent: 50 });
  check("estimate 환급률50% → 환급금 = 200만×50% = 100만", r.surrenderValue === 1000000, JSON.stringify(r));
  check("estimate → reference true", r.reference === true);
}
// Mode estimate: 예상 환급금 직접
{
  const r = calcSurrender({ monthlyPremium: 100000, paidMonths: 20, mode: "estimate", estimatedValue: 800000 });
  check("estimate 환급금 직접 → 800,000", r.surrenderValue === 800000);
}
// 유효성: 기납입 0
{
  const r = calcSurrender({ monthlyPremium: 100000, paidMonths: 0, mode: "known", surrenderValue: 0 });
  check("기납입 0 → NEED_INPUT", r.status === "NEED_INPUT", JSON.stringify(r));
}
// estimate인데 아무 가정값 없음 → NEED_INPUT
{
  const r = calcSurrender({ monthlyPremium: 100000, paidMonths: 20, mode: "estimate" });
  check("estimate 가정값 없음 → NEED_INPUT", r.status === "NEED_INPUT");
}

console.log(`\n[surrenderValue] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
