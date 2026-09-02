import { generationFromPolicyDate } from "../src/lib/insurance/engine/generationFromPolicyDate";

// 세대 경계일. 각 경계의 직전/당일을 모두 고정한다.
//   PRE_STANDARD는 실손 표준약관 제정 이전이라 계산 경로를 제공하지 않는 구간이다.
const cases = [
  ["2009-09-30", "PRE_STANDARD"],
  ["2009-10-01", "2009"],
  ["2017-03-31", "2009"],
  ["2017-04-01", "2017"],
  ["2021-06-30", "2017"],
  ["2021-07-01", "2021"],
  ["2026-05-05", "2021"],
  ["2026-05-06", "2026"],
  ["1998-01-01", "PRE_STANDARD"],
  ["", "INVALID"],
  ["2021-13-01", "INVALID"],
  ["not-a-date", "INVALID"],
] as const;

let failed = 0;
for (const [date, expected] of cases) {
  const actual = generationFromPolicyDate(date);
  if (actual !== expected) {
    failed++;
    console.error(`❌ ${date}: ${actual} (expected ${expected})`);
  }
}
if (failed) process.exit(1);
console.log(`[generationFromPolicyDate] ✅ 경계값 ${cases.length}건 통과`);
