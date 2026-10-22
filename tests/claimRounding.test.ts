import assert from "node:assert/strict";
import { roundedRateAmount, rateAmountExceeds, roundedIntegerRatio, percentToRate } from "../src/lib/insurance/common/exactMoney";
import { calcStandardized } from "../src/lib/insurance/engine/generationStandardized";
import { calc2021 } from "../src/lib/insurance/engine/generation2021";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";

// 기존 임시 반올림 정책의 산술 검증. 약관상 지급액의 정답으로 주장하지 않는다.
// 기대값은 손계산 또는 반올림 구간 부등식으로 확인하며 엔진/공용 helper로 만들지 않는다.
for (const [amount, rate, expected] of [
  [37300, 0.285, 10631], [100050, 0.29, 29015], [750, 0.666, 500],
  [9007199254740988, 0.3, 2702159776422296],
  [9007199254740991, 0.5, 4503599627370496],
  [0, 0.3, 0], [1, 0.5, 1], [10, 0, 0], [10, 1, 10], [5000000, 1e-7, 1],
]) assert.equal(roundedRateAmount(amount, rate), expected);
assert.equal(percentToRate(66.6), 0.666);
assert.equal(percentToRate(57.1), 0.571);
assert.equal(percentToRate(0), 0);
assert.equal(percentToRate(100), 1);
assert.equal(percentToRate(1e-7), 1e-9);
assert.equal(roundedRateAmount(1.5, 0.5), 1); // 직접 호출의 기존 비정수 계약은 유지
assert.equal(roundedRateAmount(-10, 0.3), -3);
assert.equal(roundedRateAmount(10, -0.3), -3);
assert.equal(roundedRateAmount(10, 2), 20);
assert.equal(roundedRateAmount(Infinity, 0.3), Infinity);
assert(Number.isNaN(roundedRateAmount(10, NaN)));
assert.equal(rateAmountExceeds(3, 0.2, 0), true);
assert.equal(rateAmountExceeds(5, 0.2, 1), false);
assert.equal(rateAmountExceeds(6, 0.2, 1), true);
assert.equal(rateAmountExceeds(6, 0.2, 1.5), false);
assert.equal(rateAmountExceeds(-6, 0.2, 0), false);
assert.equal(rateAmountExceeds(6, -0.2, 0), false);
assert.equal(rateAmountExceeds(6, 2, 0), true);
assert.equal(rateAmountExceeds(6, NaN, 0), false);
assert.equal(roundedIntegerRatio(9007199254740991, 3), 3002399751580330);
assert.equal(roundedIntegerRatio(1, 2), 1);
assert.equal(roundedIntegerRatio(1.5, 2), 1);
assert.equal(roundedIntegerRatio(-3, 2), -1);
assert.equal(roundedIntegerRatio(3, 0), Infinity);

let seed = 210022;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
for (let i = 0; i < 12000; i++) {
  const amount = Number((BigInt(rand()) * 2097152n + BigInt(rand() % 2097152)) % 9007199254740992n);
  const perMille = rand() % 1001;
  const actual = BigInt(roundedRateAmount(amount, Number(`${perMille}e-3`)));
  const exactTimesTwo = BigInt(amount) * BigInt(perMille) * 2n;
  assert((2n * actual - 1n) * 1000n <= exactTimesTwo && exactTimesTwo < (2n * actual + 1n) * 1000n);
  const divisor = 1 + rand() % 100000;
  const quotient = BigInt(roundedIntegerRatio(amount, divisor));
  assert((2n * quotient - 1n) * BigInt(divisor) <= BigInt(amount) * 2n
    && BigInt(amount) * 2n < (2n * quotient + 1n) * BigInt(divisor));
}

const g5 = calc2026({ amount: 37300, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.285 });
assert.equal(g5.ownPay, 10631); assert.equal(g5.insurancePay, 26669); assert.equal(g5.rateBased, 10631);
const g4 = calc2021({ amount: 9007199254740988, coverage: "non_benefit", visit: "inpatient" });
assert.equal(g4.ownPay, 2702159776422296); assert.equal(g4.insurancePay, 6305039478318692);
for (const gen of ["2009", "2017"] as const) {
  const r = calcStandardized(gen, { amount: 9007199254740991, coverage: "benefit", visit: "outpatient", facility: "clinic", plan: "standard" });
  assert.equal(r.ownPay, 1801439850948198); assert.equal(r.insurancePay, 7205759403792793);
  // 반올림 전 정률이 잔여 상한보다 크면 반올림 후 금액이 같아도 기존 상한 표시는 유지.
  const capped = calcStandardized(gen, { amount: 3, coverage: "benefit", visit: "inpatient", plan: "standard", priorAnnualPaid: 1999999.5 });
  assert(capped.appliedCaps.length > 0); assert.equal(capped.ownPay, 1);
}
const many5 = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [37300, 37300], nhisCoinsuranceRate: 0.285 });
assert.equal(many5.totalOwnPay, 21262); assert.equal(many5.totalInsurancePay, 53338);
const rider = calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "mri", amounts: [9007199254740988] });
assert.equal(rider.lines[0].rateBased, 2702159776422296); assert.equal(rider.totalInsurancePay, 3000000);
const special = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [{ amount: 9007199254740988, visit: "outpatient" }] });
assert.equal(special.lines[0].rateBased, 2702159776422296);
assert.equal(special.lines[0].deductibleApplied, 2702159776422296);
assert.equal(special.totalInsurancePay, 3000000);
const room = (amount: number, days: number) => calculateRoomCharge2026({ route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical", stays: [{ roomChargeTotal: amount, inpatientDays: days }] });
const r = room(9007199254740991, 3);
assert(r.route === "room_charge"); assert.equal(r.lines[0].dailyAverageRoomCharge, 3002399751580330);
assert.equal(r.totalInsurancePay, 300000); assert.equal(r.totalOwnPay, 9007199254440991);
// 병실료는 기존 정책대로 보험금 50%를 먼저 반올림한다(일반 경로와 확정 변수가 다름).
assert.equal(room(101, 1).totalInsurancePay, 51);
assert.equal(room(1000000, 90071992547).status, "OK");
for (const days of [90071992548, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]) {
  const b = room(1000000, days);
  assert.equal(b.status, "PENDING_UNVERIFIED"); assert.equal(b.totalInsurancePay, null); assert.equal(b.lines.length, 0);
}
console.log("[실손 산술] 손계산 회귀·12,000개 정률/나눗셈 구간·세대별 연결·병실료 일수 경계 통과");
