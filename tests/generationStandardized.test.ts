// 2·3세대(표준화 실손 / 착한실손) 엔진 정확성·경계값·불변식 테스트.
//
// 기대값은 금융감독원 보험업감독업무시행세칙 [별표 15] 표준약관 원문에서 직접 옮긴 것이며,
// 구현을 다시 실행해 얻은 값이 아니다. 근거는 docs/insurance/insurance-gen123-engine-design.md 참조.
import { calculate } from "../src/lib/insurance/engine/engine";
import { GEN2009, GEN2017 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES as R } from "../src/lib/insurance/engine/regulatoryRules";
import { CalcResult, Facility, Generation, Plan, Visit } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const GENS: ("2009" | "2017")[] = ["2009", "2017"];
const PLANS: Plan[] = ["standard", "selective"];
const FACILITIES: Facility[] = ["clinic", "hospital", "tertiary", "pharmacy"];
const VISITS: Visit[] = ["outpatient", "inpatient"];

// ── 1. 상수가 규제 레지스트리에서 파생되는지 ─────────────────────────
check("2세대 표준형 입원률 추적", GEN2009.inpatientRate.standard === R.GEN2009_INPATIENT_RATE_STANDARD.value);
check("2세대 선택형 입원률 추적", GEN2009.inpatientRate.selective === R.GEN2009_INPATIENT_RATE_SELECTIVE.value);
check("2세대 입원 자기부담 상한 추적", GEN2009.inpatientAnnualOwnPayCap === R.GEN2009_INPATIENT_ANNUAL_OWN_PAY_CAP.value);
check("2세대 통원 공제표 추적", GEN2009.outpatientMinDeductible === R.GEN2009_OUTPATIENT_MIN_DEDUCTIBLE.value);
check("3세대 표준형 입원률 추적", GEN2017.inpatientRate.standard === R.GEN2017_INPATIENT_RATE_STANDARD.value);
check("3세대 통원 정률 추적", GEN2017.outpatientStandardRate === R.GEN2017_OUTPATIENT_RATE_STANDARD.value);
check("3세대 특약 공제 정액 등록", R.GEN2017_RIDER_DEDUCT_MIN.value === 20_000);
check("3세대 특약 공제 정률 등록", R.GEN2017_RIDER_DEDUCT_RATE.value === 0.3);
check("3세대 도수치료 특약 한도 등록", R.GEN2017_RIDER_MANUAL_THERAPY_ANNUAL_LIMIT.value === 3_500_000);
check("3세대 도수치료 특약 횟수 등록", R.GEN2017_RIDER_MANUAL_THERAPY_ANNUAL_VISITS.value === 50);
check("3세대 주사료 특약 한도 등록", R.GEN2017_RIDER_INJECTION_ANNUAL_LIMIT.value === 2_500_000);
check("3세대 주사료 특약 횟수 등록", R.GEN2017_RIDER_INJECTION_ANNUAL_VISITS.value === 50);
check("3세대 MRI 특약 한도 등록", R.GEN2017_RIDER_MRI_ANNUAL_LIMIT.value === 3_000_000);

// ── 2. 약관 원문에서 옮긴 개별 기대값 ────────────────────────────────
type Case = {
  name: string; gen: "2009" | "2017"; plan: Plan; visit: Visit;
  facility?: Facility; amount: number; prior?: number;
  ownPay: number; insurancePay: number;
};

// 표준약관 <표1 항목별 공제금액>: 의원 1만 / 병원 1만5천 / 상급종합 2만 / 처방조제 8천
// 표준형은 "정액과 보상대상의료비의 20% 중 큰 금액", 선택형은 정액만.
const CASES: Case[] = [
  // 통원 · 표준형 — 20%가 정액보다 큰 구간
  { name: "3세대 표준형 통원 의원 30만", gen: "2017", plan: "standard", visit: "outpatient", facility: "clinic", amount: 300_000, ownPay: 60_000, insurancePay: 240_000 },
  { name: "3세대 표준형 통원 상급종합 30만", gen: "2017", plan: "standard", visit: "outpatient", facility: "tertiary", amount: 300_000, ownPay: 60_000, insurancePay: 240_000 },
  // 통원 · 표준형 — 정액이 20%보다 큰 구간(경계 아래)
  { name: "3세대 표준형 통원 의원 4만(정액 1만 우세)", gen: "2017", plan: "standard", visit: "outpatient", facility: "clinic", amount: 40_000, ownPay: 10_000, insurancePay: 30_000 },
  { name: "3세대 표준형 통원 의원 5만(경계: 정액=정률)", gen: "2017", plan: "standard", visit: "outpatient", facility: "clinic", amount: 50_000, ownPay: 10_000, insurancePay: 40_000 },
  { name: "3세대 표준형 통원 의원 5만1천(정률 우세)", gen: "2017", plan: "standard", visit: "outpatient", facility: "clinic", amount: 51_000, ownPay: 10_200, insurancePay: 40_800 },
  { name: "3세대 표준형 처방조제 3만(정액 8천 우세)", gen: "2017", plan: "standard", visit: "outpatient", facility: "pharmacy", amount: 30_000, ownPay: 8_000, insurancePay: 22_000 },
  // 통원 · 선택형 — 정률 없음. 정액만.
  { name: "2세대 선택형 통원 의원 30만(정액만)", gen: "2009", plan: "selective", visit: "outpatient", facility: "clinic", amount: 300_000, ownPay: 10_000, insurancePay: 290_000 },
  { name: "2세대 선택형 통원 병원 30만(정액만)", gen: "2009", plan: "selective", visit: "outpatient", facility: "hospital", amount: 300_000, ownPay: 15_000, insurancePay: 285_000 },
  { name: "2세대 선택형 통원 상급종합 30만(정액만)", gen: "2009", plan: "selective", visit: "outpatient", facility: "tertiary", amount: 300_000, ownPay: 20_000, insurancePay: 280_000 },
  { name: "2세대 선택형 처방조제 30만(정액만)", gen: "2009", plan: "selective", visit: "outpatient", facility: "pharmacy", amount: 300_000, ownPay: 8_000, insurancePay: 292_000 },
  // 통원 경계 — 진료비가 공제금액보다 작으면 자기부담이 진료비를 넘을 수 없다
  { name: "선택형 통원 5천원(공제 1만 > 진료비)", gen: "2017", plan: "selective", visit: "outpatient", facility: "clinic", amount: 5_000, ownPay: 5_000, insurancePay: 0 },
  { name: "표준형 통원 0원", gen: "2017", plan: "standard", visit: "outpatient", facility: "clinic", amount: 0, ownPay: 0, insurancePay: 0 },
  // 입원 — 표준형 20% / 선택형 10%
  { name: "3세대 표준형 입원 100만", gen: "2017", plan: "standard", visit: "inpatient", amount: 1_000_000, ownPay: 200_000, insurancePay: 800_000 },
  { name: "3세대 선택형 입원 100만", gen: "2017", plan: "selective", visit: "inpatient", amount: 1_000_000, ownPay: 100_000, insurancePay: 900_000 },
  { name: "2세대 선택형 입원 100만", gen: "2009", plan: "selective", visit: "inpatient", amount: 1_000_000, ownPay: 100_000, insurancePay: 900_000 },
  // 입원 자기부담 연간 상한 200만원 — 경계 및 초과
  { name: "표준형 입원 1000만(20%=200만, 상한 경계)", gen: "2017", plan: "standard", visit: "inpatient", amount: 10_000_000, ownPay: 2_000_000, insurancePay: 8_000_000 },
  { name: "표준형 입원 1500만(20%=300만 → 상한 200만)", gen: "2017", plan: "standard", visit: "inpatient", amount: 15_000_000, ownPay: 2_000_000, insurancePay: 13_000_000 },
  { name: "표준형 입원 1500만 + 기납부 50만 → 잔여 150만", gen: "2017", plan: "standard", visit: "inpatient", amount: 15_000_000, prior: 500_000, ownPay: 1_500_000, insurancePay: 13_500_000 },
  { name: "표준형 입원 1500만 + 기납부 200만 → 잔여 0", gen: "2017", plan: "standard", visit: "inpatient", amount: 15_000_000, prior: 2_000_000, ownPay: 0, insurancePay: 15_000_000 },
  { name: "표준형 입원 1500만 + 기납부 300만(초과) → 잔여 0", gen: "2017", plan: "standard", visit: "inpatient", amount: 15_000_000, prior: 3_000_000, ownPay: 0, insurancePay: 15_000_000 },
  { name: "2세대 선택형 입원 3000만(10%=300만 → 상한 200만)", gen: "2009", plan: "selective", visit: "inpatient", amount: 30_000_000, ownPay: 2_000_000, insurancePay: 28_000_000 },
  // 반올림 — 자기부담금을 사사오입으로 확정하고 보험금이 잔차를 흡수한다
  { name: "표준형 통원 100,003원(20%=20,000.6 → 20,001)", gen: "2017", plan: "standard", visit: "outpatient", facility: "clinic", amount: 100_003, ownPay: 20_001, insurancePay: 80_002 },
  { name: "표준형 입원 100,005원(20%=20,001 정확)", gen: "2017", plan: "standard", visit: "inpatient", amount: 100_005, ownPay: 20_001, insurancePay: 80_004 },
];

for (const c of CASES) {
  const r = calculate(c.gen, {
    amount: c.amount, coverage: "benefit", visit: c.visit,
    facility: c.facility, plan: c.plan, priorAnnualPaid: c.prior,
  });
  check(
    c.name,
    r.status === "OK" && r.ownPay === c.ownPay && r.insurancePay === c.insurancePay,
    `기대 ${c.ownPay}/${c.insurancePay} · 실제 ${r.ownPay}/${r.insurancePay} (${r.status})`,
  );
}

// ── 3. 2세대와 3세대 기본형 산식 동일성 ──────────────────────────────
// 근거 약관은 다르지만 산식은 같다. 한쪽만 바뀌면 즉시 드러나야 한다.
let sameCount = 0, sameFail = 0;
for (const plan of PLANS) for (const visit of VISITS) for (const facility of FACILITIES) {
  for (const amount of [0, 1, 7, 9_999, 50_000, 300_000, 1_000_000, 15_000_000]) {
    const a = calculate("2009", { amount, coverage: "benefit", visit, facility, plan });
    const b = calculate("2017", { amount, coverage: "benefit", visit, facility, plan });
    sameCount++;
    if (a.ownPay !== b.ownPay || a.insurancePay !== b.insurancePay) sameFail++;
  }
}
check(`2·3세대 기본형 산식 동일 (${sameCount}케이스)`, sameFail === 0, `불일치 ${sameFail}건`);

// ── 4. 전 매트릭스 불변식 ────────────────────────────────────────────
const invariants: Record<string, number> = {
  "ownPay+insurancePay===amount": 0,
  "0<=ownPay<=amount": 0,
  "0<=insurancePay<=amount": 0,
  "정수 확정": 0,
  "generation 일치": 0,
};
let matrix = 0;
for (const gen of GENS) for (const plan of PLANS) for (const visit of VISITS) for (const facility of FACILITIES) {
  for (const amount of [0, 1, 3, 7, 9_999, 10_000, 10_001, 50_000, 50_001, 100_001, 300_000, 999_999, 1_000_000, 9_999_999, 15_000_000]) {
    for (const prior of [undefined, 0, 500_000, 2_000_000, 5_000_000]) {
      const r: CalcResult = calculate(gen, { amount, coverage: "benefit", visit, facility, plan, priorAnnualPaid: prior });
      matrix++;
      if (r.status !== "OK") continue;
      const own = r.ownPay as number, ins = r.insurancePay as number;
      if (own + ins !== r.amount) invariants["ownPay+insurancePay===amount"]++;
      if (!(own >= 0 && own <= r.amount)) invariants["0<=ownPay<=amount"]++;
      if (!(ins >= 0 && ins <= r.amount)) invariants["0<=insurancePay<=amount"]++;
      if (!Number.isInteger(own) || !Number.isInteger(ins)) invariants["정수 확정"]++;
      if (r.generation !== (gen as Generation)) invariants["generation 일치"]++;
    }
  }
}
for (const [name, bad] of Object.entries(invariants)) {
  check(`불변식 ${name} (${matrix}케이스)`, bad === 0, `위반 ${bad}건`);
}

// ── 5. 입력 정규화 경계값 ────────────────────────────────────────────
const neg = calculate("2017", { amount: -50_000, coverage: "benefit", visit: "inpatient", plan: "standard" });
check("음수 진료비는 0으로 정규화", neg.status === "OK" && neg.amount === 0 && neg.ownPay === 0 && neg.insurancePay === 0);
const nan = calculate("2017", { amount: Number.NaN, coverage: "benefit", visit: "inpatient", plan: "standard" });
check("NaN 진료비는 0으로 정규화", nan.status === "OK" && nan.amount === 0);
const frac = calculate("2017", { amount: 10_000.9, coverage: "benefit", visit: "inpatient", plan: "selective" });
check("소수 진료비는 floor", frac.amount === 10_000 && frac.ownPay === 1_000);
const negPrior = calculate("2017", { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: "standard", priorAnnualPaid: -1_000_000 });
check("음수 누적액은 0으로 클램프", negPrior.ownPay === 2_000_000);
const noFacility = calculate("2017", { amount: 300_000, coverage: "benefit", visit: "outpatient", plan: "selective" });
check("facility 미지정 시 의원급 기본값", noFacility.minDeductible === 10_000 && noFacility.ownPay === 10_000);

// ── 6. plan 미지정은 추정하지 않고 보류 ──────────────────────────────
for (const gen of GENS) {
  const r = calculate(gen, { amount: 300_000, coverage: "benefit", visit: "outpatient", facility: "clinic" });
  check(`${gen} plan 미지정 → PENDING_UNVERIFIED`, r.status === "PENDING_UNVERIFIED" && r.ownPay === null && r.rateApplied === null);
}

// ── 7. coverage가 요율을 가르지 않는다 (4세대와 다른 지점) ────────────
let coverageDiff = 0;
for (const gen of GENS) for (const plan of PLANS) for (const visit of VISITS) {
  const a = calculate(gen, { amount: 300_000, coverage: "benefit", visit, facility: "clinic", plan });
  const b = calculate(gen, { amount: 300_000, coverage: "non_benefit", visit, facility: "clinic", plan });
  if (a.ownPay !== b.ownPay) coverageDiff++;
}
check("급여/비급여로 자기부담이 갈리지 않음", coverageDiff === 0, `차이 ${coverageDiff}건`);

// ── 8. 선택형 통원에는 정률이 없다 ───────────────────────────────────
let selectiveRateBad = 0;
for (const gen of GENS) for (const facility of FACILITIES) {
  const r = calculate(gen, { amount: 10_000_000, coverage: "benefit", visit: "outpatient", facility, plan: "selective" });
  if (r.rateApplied !== 0) selectiveRateBad++;
  if (r.ownPay !== GEN2009.outpatientMinDeductible[facility]) selectiveRateBad++;
}
check("선택형 통원 자기부담 = 정액 공제뿐", selectiveRateBad === 0, `위반 ${selectiveRateBad}건`);

// ── 9. 미적용 한도 고지 ──────────────────────────────────────────────
const gen3Out = calculate("2017", { amount: 300_000, coverage: "benefit", visit: "outpatient", facility: "clinic", plan: "standard" });
check("3세대 결과에 3대비급여 특약 미적용 고지", gen3Out.notes.join(" ").includes("3대비급여 특별약관"));
const gen2Out = calculate("2009", { amount: 300_000, coverage: "benefit", visit: "outpatient", facility: "clinic", plan: "standard" });
check("2세대 결과에는 3대비급여 특약 고지 없음(기본 보장 포함)", !gen2Out.notes.join(" ").includes("3대비급여 특별약관"));
check("통원 결과에 연간 횟수 미적용 고지", gen3Out.notes.join(" ").includes("180회"));
const gen3In = calculate("2017", { amount: 1_000_000, coverage: "benefit", visit: "inpatient", plan: "standard" });
check("입원 결과에는 통원 횟수 고지 없음", !gen3In.notes.join(" ").includes("180회"));

// ── 10. 한도 구속 시 appliedCaps ─────────────────────────────────────
const capped = calculate("2017", { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: "standard" });
check("상한 구속 시 3세대 capCode", capped.appliedCaps.includes("GEN2017_INPATIENT_OWN_PAY_ANNUAL"));
const capped2 = calculate("2009", { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: "standard" });
check("상한 구속 시 2세대 capCode", capped2.appliedCaps.includes("GEN2009_INPATIENT_OWN_PAY_ANNUAL"));
const notCapped = calculate("2017", { amount: 1_000_000, coverage: "benefit", visit: "inpatient", plan: "standard" });
check("상한 미구속 시 capCode 없음", notCapped.appliedCaps.length === 0);

console.log(`\n[generationStandardized] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
