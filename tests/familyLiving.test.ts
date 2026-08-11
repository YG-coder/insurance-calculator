import { calcFamilyLiving, toMonths } from "../src/lib/insurance/decision/familyLiving";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}
const 만 = 10000, 억 = 100000000;

{
  const r = calcFamilyLiving([
    { monthlyLiving: 300*만, months: 120 },
    { monthlyLiving: 200*만, months: 180 },
  ]);
  check("구간1 = 3.6억", r.segments[0].amount === 360000000, JSON.stringify(r));
  check("구간2 = 3.6억", r.segments[1].amount === 360000000);
  check("총액 = 7.2억", r.total === 720000000);
  check("총 개월 = 300", r.totalMonths === 300);
}
{
  const r = calcFamilyLiving([{ monthlyLiving: 250*만, months: 240 }]);
  check("단일 구간 = 250만×240 = 6억", r.total === 600000000, JSON.stringify(r));
}
{
  const segs = Array.from({ length: 5 }, () => ({ monthlyLiving: 100*만, months: 12 }));
  const r = calcFamilyLiving(segs);
  check("5개 구간 합 = 6천만", r.total === 60000000 && r.segments.length === 5, JSON.stringify(r));
}
{
  const r = calcFamilyLiving([
    { monthlyLiving: 300*만, months: 120 },
    { monthlyLiving: 0, months: 60 },
  ]);
  check("0원 구간 → 0 합산, 총액 3.6억", r.total === 360000000 && r.segments[1].amount === 0, JSON.stringify(r));
}
{
  const r = calcFamilyLiving([]);
  check("빈 배열 → 총액 0", r.total === 0 && r.totalMonths === 0);
}
{
  const r = calcFamilyLiving([{ monthlyLiving: -100, months: 120 }]);
  check("음수 → 0", r.total === 0);
}
check("toMonths 10년 = 120", toMonths(10) === 120);
check("toMonths 15년 6개월 = 186", toMonths(15, 6) === 186);

console.log(`\n[familyLiving] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
