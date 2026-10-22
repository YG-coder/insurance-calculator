import assert from "node:assert/strict";
import { calcDeathCoverage } from "../src/lib/insurance/decision/deathCoverage";
import { calcFamilyLiving } from "../src/lib/insurance/decision/familyLiving";
import { calcPremiumRatio } from "../src/lib/insurance/decision/premiumRatio";
import { calcCoverageGap } from "../src/lib/insurance/decision/coverageGap";
import { calcCarQuoteCompare } from "../src/lib/insurance/decision/carQuoteCompare";
import { calcCancelVsKeep } from "../src/lib/insurance/decision/cancelVsKeep";

const MAX = 9_007_199_254_740_991n;
const N = Number(MAX);
let cases = 0;
function blocked(r: object, fields: string[]) {
  const v = r as Record<string, unknown>;
  assert.equal(v.status, "OUT_OF_RANGE");
  for (const field of fields) assert.equal(v[field], null, field);
  assert.match(String(v.note), /정확하게 계산할 수 있는 범위/);
  if ("segments" in v) assert.deepEqual(v.segments, []);
  if ("isCovered" in v) assert.equal(v.isCovered, false);
}
const df = ["livingTotal", "neededTotal", "preparedTotal", "requiredCoverage", "surplus"];
const ff = ["total", "totalMonths"];
const pf = ["ratioPercent", "monthlyIncome", "monthlyPremium", "yearlyIncome", "yearlyPremium"];

// Public 15-digit amounts produce an unsafe product; independent exact value.
assert.equal(999_999_999_999_999n * 120n, 119_999_999_999_999_880n);
blocked(calcDeathCoverage({ monthlyLiving: 999999999999999, coverageMonths: 120 }), df);
blocked(calcFamilyLiving([{ monthlyLiving: 999999999999999, months: 120 }]), ff);
blocked(calcPremiumRatio({ monthlyIncome: 999999999999999, monthlyPremium: 1 }), pf);
blocked(calcPremiumRatio({ monthlyIncome: 1, monthlyPremium: 999999999999999 }), pf);

// Exact inclusive limit, product overflow, safe terms with an unsafe sum.
const exact = { monthlyLiving: 1416003655831, coverageMonths: 6361 };
assert.equal(calcDeathCoverage(exact).livingTotal, N);
assert.equal(calcDeathCoverage({ ...exact, existingDeathBenefit: N }).requiredCoverage, 0);
blocked(calcDeathCoverage({ ...exact, debt: 1 }), df);
blocked(calcDeathCoverage({ monthlyLiving: 0, coverageMonths: 0, debt: N, otherFunds: 1 }), df);
blocked(calcDeathCoverage({ monthlyLiving: 0, coverageMonths: 0, existingDeathBenefit: N, usableAssets: 1 }), df);
blocked(calcDeathCoverage({ monthlyLiving: 562949953421312, coverageMonths: 16 }), df);
assert.equal(calcFamilyLiving([{ monthlyLiving: 1416003655831, months: 6361 }]).total, N);
assert.equal(calcFamilyLiving([{ monthlyLiving: 1, months: N - 1 }, { monthlyLiving: 1, months: 1 }]).total, N);
blocked(calcFamilyLiving([{ monthlyLiving: 1, months: N }, { monthlyLiving: 1, months: 1 }]), ff);
blocked(calcFamilyLiving([{ monthlyLiving: 0, months: N }, { monthlyLiving: 0, months: 1 }]), ff);
blocked(calcFamilyLiving([{ monthlyLiving: 100000000000000, months: 45 }, { monthlyLiving: 100000000000000, months: 46 }]), ff);
const yearlyBoundary = Number(MAX / 12n);
assert.equal(calcPremiumRatio({ monthlyIncome: yearlyBoundary, monthlyPremium: yearlyBoundary }).yearlyIncome, Number(MAX / 12n * 12n));
blocked(calcPremiumRatio({ monthlyIncome: yearlyBoundary + 1, monthlyPremium: 0 }), pf);
blocked(calcPremiumRatio({ monthlyIncome: 0, monthlyPremium: yearlyBoundary + 1 }), pf);

for (const bad of [NaN, Infinity, -Infinity, N + 1, -(N + 1), Number.MAX_VALUE]) {
  for (const field of ["monthlyLiving", "coverageMonths", "debt", "otherFunds", "existingDeathBenefit", "usableAssets"] as const)
    blocked(calcDeathCoverage({ monthlyLiving: 1, coverageMonths: 1, [field]: bad }), df);
  for (const field of ["monthlyLiving", "months"] as const)
    blocked(calcFamilyLiving([{ monthlyLiving: 1, months: 1, [field]: bad }]), ff);
  for (const field of ["monthlyIncome", "monthlyPremium"] as const)
    blocked(calcPremiumRatio({ monthlyIncome: 1, monthlyPremium: 1, [field]: bad }), pf);
}

// Reproducible independent oracle. No floating point math in monetary expectations.
let seed = 719n;
const next = (limit: bigint) => { seed = (seed * 48271n) % 2147483647n; return seed % limit; };
const values = [0n, 1n, 2n, 3000000n, MAX / 12n, 999999999999999n, MAX - 1n, MAX];
for (let i = 0; i < 1000; i++) {
  const m = i % 3 ? values[Number(next(BigInt(values.length)))] : next(1000000000000000n);
  const months = next(241n), debt = values[Number(next(8n))], funds = values[Number(next(8n))];
  const existing = values[Number(next(8n))], assets = values[Number(next(8n))];
  const living = m * months, needed = living + debt + funds, prepared = existing + assets;
  const d = calcDeathCoverage({ monthlyLiving: Number(m), coverageMonths: Number(months), debt: Number(debt), otherFunds: Number(funds), existingDeathBenefit: Number(existing), usableAssets: Number(assets) });
  if ([living, needed, prepared].some(v => v > MAX)) blocked(d, df);
  else {
    assert.equal(d.status, "OK");
    assert.equal(d.livingTotal, Number(living)); assert.equal(d.neededTotal, Number(needed)); assert.equal(d.preparedTotal, Number(prepared));
    assert.equal(d.requiredCoverage, Number(needed > prepared ? needed - prepared : 0n));
    assert.equal(d.surplus, Number(prepared > needed ? prepared - needed : 0n));
    assert.equal(d.isCovered, prepared >= needed);
  }
  const rows = [{ monthlyLiving: Number(m), months: Number(months) }, { monthlyLiving: Number(debt), months: Number(next(241n)) }];
  const amounts = rows.map(r => BigInt(r.monthlyLiving) * BigInt(r.months));
  const total = amounts.reduce((a,b) => a+b, 0n);
  const f = calcFamilyLiving(rows);
  if (total > MAX) blocked(f, ff);
  else {
    assert.equal(f.status, "OK"); assert.equal(f.total, Number(total));
    assert.deepEqual(f.segments.map(r => r.amount), amounts.map(Number));
    assert.equal(f.totalMonths, rows[0].months + rows[1].months);
  }
  const p = calcPremiumRatio({ monthlyIncome: Number(m), monthlyPremium: Number(debt) });
  if (m * 12n > MAX || debt * 12n > MAX) blocked(p, pf);
  else {
    assert.equal(p.status, m === 0n ? "NEED_INCOME" : "OK");
    assert.equal(p.yearlyIncome, Number(m * 12n)); assert.equal(p.yearlyPremium, Number(debt * 12n));
  }
  // Other decision calculators only compare/difference public 15-digit amounts.
  const a = m % 1000000000000000n, b = debt % 1000000000000000n;
  const gap = calcCoverageGap({ needed: Number(a), current: Number(b) });
  assert.equal(gap.shortfall, Number(a > b ? a - b : 0n));
  assert.equal(gap.surplus, Number(b > a ? b - a : 0n));
  const c = calcCancelVsKeep({ surrenderValue: Number(a), futurePremium: Number(b) });
  assert.equal(c.surrenderValue, Number(a)); assert.equal(c.futurePremium, Number(b));
  const q = calcCarQuoteCompare([{ amount: Number(a + 1n) }, { amount: Number(b + 1n) }]);
  const diff = a > b ? a - b : b - a;
  assert.equal(q.gap, Number(diff)); assert.equal(q.monthlyGap, Number((diff + 6n) / 12n));
  cases += 6;
}

// Existing normalization/zero contracts and ordinary values are unchanged.
assert.equal(calcDeathCoverage({ monthlyLiving: 3000000, coverageMonths: 240, debt: 50000000, otherFunds: 30000000, existingDeathBenefit: 200000000, usableAssets: 100000000 }).requiredCoverage, 500000000);
assert.equal(calcDeathCoverage({ monthlyLiving: -1, coverageMonths: 12 }).livingTotal, 0);
assert.equal(calcDeathCoverage({ monthlyLiving: 1.9, coverageMonths: 2.9 }).livingTotal, 2);
assert.equal(calcDeathCoverage({ monthlyLiving: 0, coverageMonths: N }).status, "OK");
assert.deepEqual(calcFamilyLiving([]), { status: "OK", segments: [], totalMonths: 0, total: 0 });
assert.equal(calcFamilyLiving([{ monthlyLiving: 1.9, months: 2.9 }]).total, 2);
assert.equal(calcPremiumRatio({ monthlyIncome: 0, monthlyPremium: 300000 }).status, "NEED_INCOME");
assert.equal(calcPremiumRatio({ monthlyIncome: 3000000, monthlyPremium: 0 }).ratioPercent, 0);
assert.equal(calcPremiumRatio({ monthlyIncome: 3000000.9, monthlyPremium: 300000.9 }).ratioPercent, 10);
console.log(`[보험 결정 계산 산술] BigInt ${cases}사례 및 상한/비유한/0/소수 회귀 통과`);
