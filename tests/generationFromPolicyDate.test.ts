import { generationFromPolicyDate } from "../src/lib/insurance/engine/generationFromPolicyDate";

const cases = [
  ["2021-06-30", "LEGACY"],
  ["2021-07-01", "2021"],
  ["2026-05-05", "2021"],
  ["2026-05-06", "2026"],
  ["", "INVALID"],
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
