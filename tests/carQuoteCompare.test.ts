import { calcCarQuoteCompare } from "../src/lib/insurance/decision/carQuoteCompare";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}
// 중간 빈 행이 있어도 UI 행 이름(A/C)을 보존
{
  const r = calcCarQuoteCompare([{ amount: 800000 }, { amount: 0 }, { amount: 900000 }]);
  check("중간 빈 견적 뒤 자동 이름 보존", r.quotes[0].name === "견적 A" && r.quotes[1].name === "견적 C", JSON.stringify(r));
}
const 만 = 10000;

// 견적 3개: 80만, 95만, 88만 → 최저80 최고95 차액15 월환산 12500
{
  const r = calcCarQuoteCompare([
    { name: "A화재", amount: 80*만 },
    { name: "B해상", amount: 95*만 },
    { name: "C손보", amount: 88*만 },
  ]);
  check("최저 80만", r.lowest === 800000, JSON.stringify(r));
  check("최고 95만", r.highest === 950000);
  check("차액 15만", r.gap === 150000);
  check("월 환산 12,500", r.monthlyGap === 12500);
  check("A화재가 최저 표시", r.quotes[0].isLowest === true && r.quotes[1].isHighest === true);
}
// 견적 2개 (최소)
{
  const r = calcCarQuoteCompare([{ amount: 100*만 }, { amount: 120*만 }]);
  check("2개 → OK, 차액 20만", r.status === "OK" && r.gap === 200000, JSON.stringify(r));
  check("이름 미입력 → 견적 A/B", r.quotes[0].name === "견적 A" && r.quotes[1].name === "견적 B");
}
// 유효 견적 1개 → NEED_MORE
{
  const r = calcCarQuoteCompare([{ amount: 100*만 }, { amount: 0 }]);
  check("유효 1개 → NEED_MORE", r.status === "NEED_MORE", JSON.stringify(r));
}
// 빈 입력 → NEED_MORE
{
  const r = calcCarQuoteCompare([]);
  check("빈 입력 → NEED_MORE", r.status === "NEED_MORE");
}
// 동일 견적 → 차액 0
{
  const r = calcCarQuoteCompare([{ amount: 90*만 }, { amount: 90*만 }]);
  check("동일 견적 → 차액 0, 둘 다 최저이자 최고", r.gap === 0 && r.quotes[0].isLowest && r.quotes[0].isHighest, JSON.stringify(r));
}
// 음수 → 무시(유효 아님)
{
  const r = calcCarQuoteCompare([{ amount: -5 }, { amount: 100*만 }, { amount: 110*만 }]);
  check("음수 무시 → 유효 2개, 차액 10만", r.status === "OK" && r.gap === 100000, JSON.stringify(r));
}

console.log(`\n[carQuoteCompare] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
