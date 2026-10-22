import assert from "node:assert/strict";
import { calcFuturePremium, type FuturePremiumResult } from "../src/lib/insurance/decision/futurePremium";
import { calcSurrender, type SurrenderResult } from "../src/lib/insurance/decision/surrenderValue";

const MAX = 9_007_199_254_740_991n;
const N = Number(MAX);
const futureFields = ["futurePremium", "paidSoFar", "totalAtCompletion", "futureSharePercent"] as const;
const surrenderFields = ["totalPaid", "surrenderValue", "loss", "refundRatePercent", "monthlyAvgLoss", "futurePremium", "totalAtCompletion"] as const;
let blocked = 0, accepted = 0;
function expectBlocked(r: FuturePremiumResult | SurrenderResult) {
  assert.equal(r.status, "NEED_INPUT");
  for (const field of ("mode" in r ? surrenderFields : futureFields)) {
    assert.equal((r as unknown as Record<string, unknown>)[field], null, field + ": 부정확한 부분 결과를 남기지 않음");
  }
  assert.match(r.notes[0], /범위/);
  if ("isGain" in r) assert.equal(r.isGain, false);
  blocked++;
}
const known = { monthlyPremium: 180000, paidMonths: 24, mode: "known", surrenderValue: 3000000 } as const;

// 보고된 입력의 기대값은 Number 연산이 아닌 독립 정수값으로 고정한다.
assert.equal(999_999_999_999_999n * 120n, 119_999_999_999_999_880n);
expectBlocked(calcFuturePremium({ monthlyPremium: 999999999999999, remainingMonths: 120 }));
expectBlocked(calcSurrender({ ...known, monthlyPremium: 999999999999999, paidMonths: 120 }));
expectBlocked(calcSurrender({ monthlyPremium: 999999999999999, paidMonths: 120, mode: "estimate", estimatedRatePercent: 60.5 }));

// 곱뿐 아니라 각각 범위 안인 금액을 합산해 초과해도 전체 결과를 보류한다.
expectBlocked(calcFuturePremium({ monthlyPremium: 2, remainingMonths: 1, paidMonths: 4503599627370496 }));
expectBlocked(calcFuturePremium({ monthlyPremium: 1, remainingMonths: N, paidMonths: 1 }));
expectBlocked(calcSurrender({ ...known, monthlyPremium: 2, paidMonths: 1, remainingMonths: 4503599627370496 }));
expectBlocked(calcSurrender({ ...known, monthlyPremium: 1, paidMonths: N, remainingMonths: 1 }));

// MAX-1/MAX를 잘못 차단하지 않는다. 입력란 상한 밖 사례는 엔진 직접 호출이다.
for (const value of [N - 1, N]) {
  const f = calcFuturePremium({ monthlyPremium: value, remainingMonths: 1 });
  assert.equal(f.status, "OK"); assert.equal(f.futurePremium, value);
  const s = calcSurrender({ monthlyPremium: value, paidMonths: 1, mode: "estimate", estimatedRatePercent: 100 });
  assert.equal(s.status, "OK"); assert.equal(s.totalPaid, value); assert.equal(s.surrenderValue, value);
  accepted += 2;
}
const exactFuture = calcFuturePremium({ monthlyPremium: 1, remainingMonths: N - 1, paidMonths: 1 });
assert.equal(exactFuture.status, "OK"); assert.equal(exactFuture.totalAtCompletion, N);
const exactSurrender = calcSurrender({ ...known, monthlyPremium: 1, paidMonths: N - 1, remainingMonths: 1 });
assert.equal(exactSurrender.status, "OK"); assert.equal(exactSurrender.totalAtCompletion, N);
assert.equal(calcSurrender({ ...known, surrenderValue: N }).status, "OK");

// 비유한 값·이미 정밀도 범위를 벗어난 입력을 0으로 정규화해 성공 처리하지 않는다.
for (const bad of [N + 1, -(N + 1), Number.MAX_VALUE, NaN, Infinity, -Infinity]) {
  for (const field of ["monthlyPremium", "remainingMonths", "paidMonths"] as const) {
    expectBlocked(calcFuturePremium({ monthlyPremium: 180000, remainingMonths: 120, [field]: bad }));
  }
  for (const field of ["monthlyPremium", "paidMonths", "remainingMonths", "surrenderValue"] as const) {
    expectBlocked(calcSurrender({ ...known, [field]: bad }));
  }
}

// BigInt 독립 기준: 기존 number 연산으로 기대값을 만들지 않는다.
const amounts = [1n, 2n, 3n, 120n, 100000n, 75059993789508n, 999999999999999n, MAX / 2n, MAX - 1n, MAX];
let oracleCases = 0;
for (const monthly of amounts) for (const remaining of [1n, 2n, 9n, 120n]) for (const paid of [0n, 1n, 2n, 120n]) {
  const future = monthly * remaining, past = monthly * paid, total = future + past;
  const safe = future <= MAX && past <= MAX && total <= MAX;
  const f = calcFuturePremium({ monthlyPremium: Number(monthly), remainingMonths: Number(remaining), paidMonths: Number(paid) });
  if (!safe) expectBlocked(f);
  else {
    assert.equal(f.status, "OK");
    assert.equal(BigInt(f.futurePremium!), future); assert.equal(BigInt(f.paidSoFar!), past); assert.equal(BigInt(f.totalAtCompletion!), total);
    accepted++;
  }
  oracleCases++;
  if (paid === 0n) continue; // 해지 계산의 기납입0은 기존 NEED_INPUT 계약.
  const s = calcSurrender({ monthlyPremium: Number(monthly), paidMonths: Number(paid), remainingMonths: Number(remaining), mode: "known", surrenderValue: 0 });
  if (!safe) expectBlocked(s);
  else {
    assert.equal(s.status, "OK");
    assert.equal(BigInt(s.totalPaid!), past); assert.equal(BigInt(s.futurePremium!), future); assert.equal(BigInt(s.totalAtCompletion!), total); assert.equal(BigInt(s.loss!), past);
    accepted++;
  }
  oracleCases++;
}

// 정상값·0·소수의 기존 계약. 이번 수정으로 반올림 방식을 바꾸지 않는다.
const normal = calcFuturePremium({ monthlyPremium: 180000, remainingMonths: 120, paidMonths: 24 });
assert.equal(normal.futurePremium, 21600000); assert.equal(normal.paidSoFar, 4320000); assert.equal(normal.totalAtCompletion, 25920000);
const completed = calcFuturePremium({ monthlyPremium: 180000, remainingMonths: 0, paidMonths: 24 });
assert.equal(completed.status, "OK"); assert.equal(completed.futurePremium, 0); assert.equal(completed.paidSoFar, null);
assert.equal(calcFuturePremium({ monthlyPremium: 100000.9, remainingMonths: 2.9 }).futurePremium, 200000);
const zeroRefund = calcSurrender({ ...known, surrenderValue: 0 });
assert.equal(zeroRefund.status, "OK"); assert.equal(zeroRefund.surrenderValue, 0); assert.equal(zeroRefund.loss, 4320000);
const gain = calcSurrender({ ...known, surrenderValue: 5000000 });
assert.equal(gain.isGain, true); assert.equal(gain.loss, -680000);
assert.equal(calcSurrender({ ...known, paidMonths: 0 }).status, "NEED_INPUT");
assert.equal(calcSurrender({ ...known, remainingMonths: 0 }).futurePremium, null);
assert.equal(calcSurrender({ monthlyPremium: 180000, paidMonths: 24, mode: "estimate", estimatedRatePercent: 60.5 }).surrenderValue, 2613600);
const fractional = calcSurrender({ monthlyPremium: 1.5, paidMonths: 3, mode: "estimate", estimatedRatePercent: 50, remainingMonths: 2 });
assert.equal(fractional.status, "OK"); assert.equal(fractional.totalPaid, 4.5); assert.equal(fractional.surrenderValue, 2.25); assert.equal(fractional.totalAtCompletion, 7.5);
console.log(`[보험 큰 금액] BigInt ${oracleCases}사례, 차단 ${blocked}건·정상 ${accepted}건 및 기존 0/소수 계약 통과`);
