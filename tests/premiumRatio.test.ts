import { calcPremiumRatio } from "../src/lib/insurance/decision/premiumRatio";
import assert from "node:assert/strict";

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

// 정확한 십진 반올림: 화면/상태 안내용 문자열을 Number.toFixed로 만들지 않는다.
const displayCases: [number, number, string][] = [
  [1, 750599937895082, "75059993789508200.0"],
  [7, 123456789012345, "1763668414462071.4"],
  [3000000, 300000, "10.0"],
  [4000000, 500000, "12.5"],
  [3000000, 0, "0.0"],
  [750599937895082, 750599937895082, "100.0"],
  [750599937895082, 1, "0.0"],
  [2000, 3, "0.2"], // 0.15% 정확히 절반 → 올림. 기존 toFixed는 0.1이었다.
  [1000000, 1499, "0.1"],
  [1000000, 1500, "0.2"],
  [1000000, 1501, "0.2"],
  [2000, 1999, "100.0"], // 99.95%에서 정수 자리까지 올림
  [2000.9, 3.9, "0.2"], // 기존 입력 내림 계약 유지
  [3000000, -1, "0.0"],
];
for (const [monthlyIncome, monthlyPremium, text] of displayCases) {
  const r = calcPremiumRatio({ monthlyIncome, monthlyPremium });
  assert.equal(r.status, "OK");
  assert.equal(r.ratioPercentText, text);
}
for (const [monthlyIncome, monthlyPremium, status] of [
  [0, 1, "NEED_INCOME"], [-1, 1, "NEED_INCOME"],
  [1, 750599937895083, "OUT_OF_RANGE"],
  [750599937895083, 0, "OUT_OF_RANGE"],
  [NaN, 1, "OUT_OF_RANGE"], [1, Infinity, "OUT_OF_RANGE"],
] as const) {
  const r = calcPremiumRatio({ monthlyIncome, monthlyPremium });
  assert.equal(r.status, status); assert.equal(r.ratioPercentText, null);
}

// 독립한 유리수 구간 검증: 정확값이 표시값을 중심으로 한
// [표시값-0.05%p, 표시값+0.05%p) 구간에 놓이는지 교차 곱으로 검사한다.
// 구현의 몫/나머지 반올림 식을 기대값으로 복제하지 않는다.
const limit = 750599937895082n;
let seed = 1903n, oracleCases = 0;
const next = () => { seed = (seed * 48271n) % 2147483647n; return seed; };
function intervalCheck(income: bigint, premium: bigint) {
  const r = calcPremiumRatio({ monthlyIncome: Number(income), monthlyPremium: Number(premium) });
  assert.equal(r.status, "OK");
  assert.match(r.ratioPercentText!, /^\d+\.\d$/);
  const roundedTenths = BigInt(r.ratioPercentText!.replace(".", ""));
  const exactTwiceScaled = premium * 2000n;
  assert((roundedTenths * 2n - 1n) * income <= exactTwiceScaled);
  assert(exactTwiceScaled < (roundedTenths * 2n + 1n) * income);
  oracleCases++;
}
for (let i = 0; i < 6000; i++) {
  const income = i % 3 === 0 ? next() % 100n + 1n : next() * next() % limit + 1n;
  const premium = next() * next() % (limit + 1n);
  intervalCheck(income, premium);
}
// 소수 둘째 자리 5 경계와 그 양옆을 작은 일반 입력에서도 전수 대조.
for (let income = 1n; income <= 100n; income++)
  for (let premium = 0n; premium <= 100n; premium++) intervalCheck(income, premium);
console.log(`[premiumRatio 표시] 명시 ${displayCases.length}사례 및 독립 유리수 ${oracleCases}사례 통과`);
console.log(`\n[premiumRatio] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
