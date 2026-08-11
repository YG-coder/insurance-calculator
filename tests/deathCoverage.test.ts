import { calcDeathCoverage, toMonths } from "../src/lib/insurance/decision/deathCoverage";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}
const 만 = 10000, 억 = 100000000;

// toMonths 변환
check("20년 → 240개월", toMonths(20) === 240);
check("15년 6개월 → 186개월", toMonths(15, 6) === 186);
check("연 0/개월 0 → 0", toMonths(0, 0) === 0);

// 기본: 월 300만 × 240개월 = 7.2억 + 부채 5천만 + 기타 3천만 = 8억 필요
//       준비 = 기존 2억 + 자산 1억 = 3억 → 필요보장 5억
{
  const r = calcDeathCoverage({
    monthlyLiving: 300*만, coverageMonths: 240,
    debt: 5000*만, otherFunds: 3000*만,
    existingDeathBenefit: 2*억, usableAssets: 1*억,
  });
  check("생활비 총액 = 300만×240 = 7.2억", r.livingTotal === 720000000, JSON.stringify(r));
  check("유족 필요자금 = 8억", r.neededTotal === 800000000);
  check("준비된 자금 = 3억", r.preparedTotal === 300000000);
  check("필요 사망보장 = 5억", r.requiredCoverage === 500000000);
  check("초과 0, isCovered false", r.surplus === 0 && r.isCovered === false);
}
// 준비가 더 많은 경우 → 필요보장 0 + 초과 표기
{
  const r = calcDeathCoverage({
    monthlyLiving: 100*만, coverageMonths: 120, // 1.2억
    existingDeathBenefit: 2*억,
  });
  check("준비>필요 → 필요보장 0", r.requiredCoverage === 0, JSON.stringify(r));
  check("초과 = 2억 - 1.2억 = 8천만, isCovered true", r.surplus === 80000000 && r.isCovered === true);
}
// 선택 항목 전부 미입력(0) → 생활비만
{
  const r = calcDeathCoverage({ monthlyLiving: 200*만, coverageMonths: 120 });
  check("선택 미입력 → 필요=생활비, 준비 0", r.neededTotal === 240000000 && r.preparedTotal === 0 && r.requiredCoverage === 240000000, JSON.stringify(r));
}
// 부채 0 명시 = 정상 (0은 유효 입력)
{
  const r = calcDeathCoverage({ monthlyLiving: 200*만, coverageMonths: 120, debt: 0, usableAssets: 0 });
  check("부채/자산 0 명시 → 정상 계산", r.requiredCoverage === 240000000);
}
// 음수 → 0 정규화
{
  const r = calcDeathCoverage({ monthlyLiving: -100, coverageMonths: 120 });
  check("음수 월생활비 → 0", r.livingTotal === 0 && r.requiredCoverage === 0);
}

console.log(`\n[deathCoverage] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
