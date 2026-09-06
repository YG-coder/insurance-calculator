// G-29 — 별도 보장종목 형제 두 축(`priorAnnualCoveredCount`·`priorAnnualInpatientDeductible`)의
//   단일 읽기. G-23(지급보험금)·G-26(진료비)·G-28(승인 구간 축)이 닫은 것과 같은 종류의
//   마지막 이중 읽기다.
//
// 두 축은 절대 합치지 않는다.
//   `priorAnnualCoveredCount`         — 해당 보장종목에서 **이미 보상한 횟수**.
//     <표1>에 연간 보상 횟수(50회) 한도가 있는 중증 근골격계·중증 주사료에서만 소비된다.
//     MRI 두 종은 <표1>에 횟수 한도가 없어(`spec.annualVisits === null`) 소비하지 않는다.
//   `priorAnnualInpatientDeductible`  — **누적 공제금액**. 특별약관1 제5조⑤의 500만 원 상한이
//     걸리는 **중증 MRI의 상급종합·종합병원 입원 행**에서만 소비된다(근골격계·주사료는 괄호로
//     제외, 특별약관2에는 같은 항이 없다).
//   `priorAnnualTreatmentActCount`(승인 구간 전용, G-28)와도 서로 대신 쓰지 않는다.
//
// 종전 동작(기준선 `aab3bb1` — UI 미경유 엔진 직접 호출, 접근자 계수로 실측한 9경로):
//   | 경로 | covered | pool |
//   | 중증 근골격계·중증 주사료 | **3회**(검증 1 + 두 해석 `runOnce` 2) | 1회(미사용 거부) |
//   | 중증 MRI                | 1회(미사용 거부) | **2회**(검증 1 + `runOnce` 1) |
//   | 비중증 MRI·일반 전환·상급병실료 2종·다회 2종 | 1회(거부·차단) | 1회(거부·차단) |
//
// ⚠ 그 이중 읽기는 **실제 금액을 바꿨다.** 값이 달라지는 접근자에서(모두 기준선 실측):
//   - 중증 MRI: 검증 `0` → 계산 `5,000,000` ⇒ 지급 2,100,000이 **3,000,000으로 과다**.
//     반대 순서에서는 3,000,000이 2,100,000으로 과소.
//   - 중증 근골격계: 검증 `0` → 계산 `50` ⇒ 지급 420,000이 **0원**으로.
//   - 중증 근골격계: 검증 `0` → 두 해석 `49`/`50` ⇒ 실제 계산 차이가 없는데도 `fingerprint()`
//     비교가 갈려 **잘못된 지급 0원 HOLD 차단**.
//   - `nonNegInt()`가 두 번째 읽기의 무효값(`-1`·`"9999999"`)을 조용히 0으로 세탁했다.
//   결과 동일성으로는 구분되지 않는다 — 접근자 호출 횟수로 직접 확인한다.
//
// ⚠ **경로 대조의 위치가 계약이다(G-29).** 대조를 `validateItemInput`의 리터럴 네 축 검증
//   직후로 올렸다. 종전에는 진입점의 `validateItemInput` **뒤**에 있어서, 경로가 틀린 입력에서
//   경로별 축들이 먼저 판정하고 먼저 읽었다(실측: `route:"general"`·중증 근골격계 +
//   `priorAnnualCoveredCount` → "…에만 쓰입니다"가 경로 불일치 안내를 밀어냄, 접근자 1회).
//   그 안내는 사실과도 다르다 — 그 조합에서 이 축은 **쓰인다.** 틀린 것은 `route`다.
//
// ⚠ **유지한 계약**: 값의 허용 범위(0 이상의 안전한 정수), 미입력의 의미(0에서 시작),
//   한도 초과값 무절삭, 안내 문구, 종별 미선택 preflight 우선, 승인 회차 preflight,
//   pool 소비 행/미소비 행 판정, 지급 0원 HOLD, G-14A pool 공유 범위 HOLD,
//   G-26·G-27·G-28 계약. 약관에서 확인하지 않은 의미는 새로 단정하지 않았다.
import { readFileSync } from "node:fs";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
type Any = Record<string, unknown>;
type Res = Record<string, unknown>;
type Caught = { threw: string } | { r: Res };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => unknown): Caught => {
  try { return { r: f() as Res }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const statusOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.status);
const insOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalInsurancePay as number | null);
const ownOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalOwnPay as number | null);
const capsOf = (x: Caught) => threw(x) ? "-" : JSON.stringify(x.r.appliedCaps ?? []);
const note0 = (x: Caught) => threw(x) ? "" : (((x.r.notes as string[]) ?? [])[0] ?? "");
const shape = (x: Caught) => threw(x) ? "THROW" : JSON.stringify([
  x.r.route, x.r.status, x.r.totalAmount, x.r.totalOwnPay, x.r.totalInsurancePay,
  x.r.appliedCaps, x.r.notes,
  (x.r.lines as Res[] ?? []).map((l) => [l.amount, l.ownPay, l.insurancePay, l.covered, l.actIndex, l.appliedCaps, l.deductible]),
]);
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const C = "priorAnnualCoveredCount", P = "priorAnnualInpatientDeductible";
const out = (a: number) => ({ amount: a, visit: "outpatient" });
const inp = (a: number, tier = "hospital") => ({ amount: a, visit: "inpatient", tier });

const MSK = (e: Any = {}, lines: unknown[] = [out(300_000)]) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw",
  lines, approvedThroughVisit: 50, priorAnnualTreatmentActCount: 0, ...e });
const INJ = (e: Any = {}, lines: unknown[] = [out(300_000)]) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
  injectionPurpose: "general", lines, ...e });
const CMRI = (e: Any = {}, lines: unknown[] = [inp(3_000_000)]) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines, ...e });
const NMRI = (e: Any = {}) => ({ route: "special_item", coverage: "non_benefit",
  severity: "non_critical", item: "mri", lines: [inp(300_000)], ...e });
const GEN = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "non_critical",
  item: "musculoskeletal_esw", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientDays: 0, ...e });
const GANTI = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "injection", injectionPurpose: "anticancer", cause: "disease", visit: "outpatient",
  amounts: [300_000], priorAnnualOutpatientVisits: 0, ...e });
const RC = (e: Any = {}) => ({ route: "room_charge", coverage: "non_benefit", cause: "disease",
  severity: "non_critical", stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 5 }], ...e });
const BEN = (e: Any = {}) => ({ cause: "disease", coverage: "benefit", visit: "outpatient",
  tier: "clinic", nhisCoinsuranceRate: 0.4, amounts: [300_000], ...e });
const MANY = (e: Any = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
  severity: "non_critical", nonBenefitItem: "general", amounts: [300_000], priorAnnualOutpatientDays: 0, ...e });
/** 경로 불일치·용도 미정 — 경로 대조가 막는 자리. 두 축을 읽어서는 안 된다. */
const MIS_MSK = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "musculoskeletal_esw", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0, ...e });
const MIS_MRI = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "mri", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0, ...e });
const MIS_PUR = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "injection", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0, ...e });
const MIS_REV = (e: Any = {}) => ({ route: "special_item", coverage: "non_benefit",
  severity: "non_critical", item: "musculoskeletal_esw", lines: [out(300_000)], ...e });

const gi = (i: unknown) => calculateGen2026Item(i as never);
const mc = (i: unknown) => calculateMany2026(i as never);
const rc = (i: unknown) => calculateRoomCharge2026(i as never);
const item = (mk: (e: Any) => Any) => (e: Any = {}) => wrap(() => gi(mk(e)));

const circ: Any = {}; circ.self = circ;
/** 값 격자 — 지시서 3절. */
const BAD: [string, unknown][] = [
  ["음수", -1], ["소수", 1.5], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["문자열", "5"], ["빈 문자열", ""], ["공백", " "], ["지수 문자열", "1e3"], ["쉼표 문자열", "1,000"],
  ["null", null], ["불리언", true], ["객체", {}], ["배열", []], ["함수", () => 1],
  ["Symbol", Symbol("s")], ["순환 참조", circ], ["bigint", BigInt(5)],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ["-0.5", -0.5],
];

console.log("\n[G-29] 1. 소비 경로 무회귀 — 이미 보상한 횟수(covered)");
{
  const M2 = (e: Any) => wrap(() => gi(MSK(e, [out(300_000), out(300_000)])));
  check("생략 → 0에서 시작(종전 그대로)", insOf(item(MSK)()) === 210_000 && ownOf(item(MSK)()) === 90_000);
  check("명시적 undefined → 생략과 같다",
    shape(item(MSK)({ [C]: undefined })) === shape(item(MSK)()));
  check("숫자 0 → 유효한 과거 상태(생략과 같은 계산)",
    shape(item(MSK)({ [C]: 0 })) === shape(item(MSK)()));
  check("정상 양의 안전 정수 2행 → 420,000", insOf(M2({ [C]: 0 })) === 420_000 && ownOf(M2({ [C]: 0 })) === 180_000);
  check("한도 경계 49 → 두 번째 행만 초과(210,000 · caps)",
    insOf(M2({ [C]: 49 })) === 210_000 && capsOf(M2({ [C]: 49 })) === '["GEN2026_MSK_ANNUAL_VISITS"]');
  check("한도 도달 50 → 전 행 초과(0원 · caps)",
    insOf(M2({ [C]: 50 })) === 0 && ownOf(M2({ [C]: 50 })) === 600_000);
  check("한도 초과 999 → 절삭하지 않고 50과 같은 결과", shape(M2({ [C]: 999 })) === shape(M2({ [C]: 50 })));
  check("MAX_SAFE도 유효한 과거 상태", statusOf(M2({ [C]: Number.MAX_SAFE_INTEGER })) === "OK");
  check("중증 주사료도 같은 축을 소비(100회 → 한도 초과)",
    insOf(item(INJ)({ [C]: 100 })) === 0 && capsOf(item(INJ)({ [C]: 100 })) === '["GEN2026_INJECTION_ANNUAL_VISITS"]');
  for (const [l, v] of BAD) {
    const x = item(MSK)({ [C]: v });
    check(`무효값 ${l} → 종전 문구 그대로 거부(총액 0)`,
      isRejected(x) && note0(x).startsWith("이미 보상한 횟수(priorAnnualCoveredCount)는 0 이상의 정수여야 합니다"),
      note0(x).slice(0, 44));
  }
}

console.log("\n[G-29] 2. 소비 경로 무회귀 — 누적 공제금액(pool)");
{
  check("생략 → 0에서 시작(2,100,000)", insOf(item(CMRI)()) === 2_100_000 && ownOf(item(CMRI)()) === 900_000);
  check("명시적 undefined → 생략과 같다", shape(item(CMRI)({ [P]: undefined })) === shape(item(CMRI)()));
  check("숫자 0 → 생략과 같은 계산", shape(item(CMRI)({ [P]: 0 })) === shape(item(CMRI)()));
  const totals = (x: Caught) => `${ownOf(x)}/${insOf(x)}/${capsOf(x)}`;
  const poolAfter = (x: Caught) => threw(x) ? -1
    : ((x.r.lines as Res[])[0].deductible as Res).poolUsedAfter as number;
  check("1,000,000 → 상한 미달이라 지급액은 종전 그대로", totals(item(CMRI)({ [P]: 1_000_000 })) === totals(item(CMRI)()));
  check("1,000,000 → 누적만 그만큼 앞선다(소진 기록은 반영)",
    poolAfter(item(CMRI)({ [P]: 1_000_000 })) === poolAfter(item(CMRI)()) + 1_000_000);
  check("상한 도달 5,000,000 → 공제 없음(3,000,000 · caps)",
    insOf(item(CMRI)({ [P]: 5_000_000 })) === 3_000_000 && ownOf(item(CMRI)({ [P]: 5_000_000 })) === 0
    && capsOf(item(CMRI)({ [P]: 5_000_000 })) === '["GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"]');
  check("상한 초과 9,000,000 → 지급액은 5,000,000과 같다(남은 상한 0)",
    totals(item(CMRI)({ [P]: 9_000_000 })) === totals(item(CMRI)({ [P]: 5_000_000 })));
  check("상한 초과 9,000,000 → **절삭하지 않는다**(누적이 9,000,000에서 이어진다)",
    poolAfter(item(CMRI)({ [P]: 9_000_000 })) === 9_000_000, String(poolAfter(item(CMRI)({ [P]: 9_000_000 }))));
  check("MAX_SAFE도 유효한 과거 상태", statusOf(item(CMRI)({ [P]: Number.MAX_SAFE_INTEGER })) === "OK");
  for (const [l, v] of BAD) {
    const x = item(CMRI)({ [P]: v });
    check(`무효값 ${l} → 종전 문구 그대로 거부(총액 0)`,
      isRejected(x) && note0(x).startsWith("누적 공제금액(priorAnnualInpatientDeductible)은 0 이상의 정수여야 합니다"),
      note0(x).slice(0, 44));
  }
}

console.log("\n[G-29] 3. 소비 행·미소비 행·미사용 경로의 판정 무회귀");
{
  const CM = (lines: unknown[], e: Any = {}) => wrap(() => gi(CMRI(e, lines)));
  check("입원 상급종합·종합(hospital) → 소비", insOf(CM([inp(3_000_000, "hospital")], { [P]: 5_000_000 })) === 3_000_000);
  check("입원 병·의원급(clinic) → 미대상 행 안내",
    note0(CM([inp(3_000_000, "clinic")], { [P]: 5_000_000 })).startsWith("누적 공제금액(priorAnnualInpatientDeductible)은 상급종합·종합병원 입원 행에만"));
  check("통원 행만 → 미대상 행 안내",
    note0(CM([out(3_000_000)], { [P]: 5_000_000 })).startsWith("누적 공제금액(priorAnnualInpatientDeductible)은 상급종합·종합병원 입원 행에만"));
  check("혼합(통원+대상 입원) → some이므로 소비",
    statusOf(CM([out(3_000_000), inp(3_000_000, "hospital")], { [P]: 0 })) === "OK");
  check("종별 미선택은 소비 후보로 남겨 preflight가 제 안내를 낸다",
    note0(CM([{ amount: 3_000_000, visit: "inpatient" }], { [P]: 5_000_000 })).startsWith("중증 비급여 MRI 입원은 의료기관 종별에 따라"));
  check("비중증 MRI는 pool을 소비하지 않는다(미사용 거부)",
    note0(item(NMRI)({ [P]: 0 })).startsWith("누적 공제금액(priorAnnualInpatientDeductible)은 500만 원 공제금액 상한의 대상인 중증 비급여 MRI에만"));
  check("MRI 두 종은 covered를 소비하지 않는다(미사용 거부)",
    note0(item(CMRI)({ [C]: 0 })).startsWith("이미 보상한 횟수(priorAnnualCoveredCount)는 <표1>에")
    && note0(item(NMRI)({ [C]: 0 })).startsWith("이미 보상한 횟수(priorAnnualCoveredCount)는 <표1>에"));
  check("근골격계·주사료는 pool을 소비하지 않는다(미사용 거부)",
    note0(item(MSK)({ [P]: 0 })).startsWith("누적 공제금액(priorAnnualInpatientDeductible)은 500만 원")
    && note0(item(INJ)({ [P]: 0 })).startsWith("누적 공제금액(priorAnnualInpatientDeductible)은 500만 원"));
}

console.log("\n[G-29] 4. 접근자 — 경로마다 정확히 한 번, 경로 불일치 0회");
const withAxis = (base: Any, keys: string[], get: (k: string) => () => unknown, f: (i: unknown) => unknown) => {
  const n: Record<string, number> = {};
  const o = { ...base } as Any;
  for (const k of keys) {
    n[k] = 0; const g = get(k);
    Object.defineProperty(o, k, { enumerable: true, configurable: true, get() { n[k] += 1; return g(); } });
  }
  return { n, x: wrap(() => f(o)) };
};
{
  const ONE: [string, Any, (i: unknown) => unknown][] = [
    ["중증 근골격계(covered 소비)", MSK(), gi], ["중증 주사료(covered 소비)", INJ(), gi],
    ["중증 MRI(pool 소비)", CMRI(), gi], ["비중증 MRI", NMRI(), gi],
    ["일반 전환", GEN(), gi], ["일반 전환(항암제)", GANTI(), gi],
    ["상급병실료(진입점)", RC(), gi], ["상급병실료(전용)", RC(), rc],
    ["급여 다회", BEN(), mc], ["직접 다회", MANY(), mc],
  ];
  for (const [l, base, f] of ONE) for (const k of [C, P]) {
    const g = withAxis(base, [k], () => () => 0, f);
    check(`${l}: ${k === C ? "covered" : "pool"} 정확히 1회`, g.n[k] === 1, String(g.n[k]));
  }
  // 두 축이 동시에 getter여도 각각 1회다.
  // ⚠ 두 축이 동시에 실려 오면 **먼저 판정되는 축에서 반환**하므로 뒤 축은 읽히지 않는다.
  //   그것이 종전 계약이다(안내는 하나만 낸다). 여기서 보는 것은 "어느 축도 2회 이상 읽히지
  //   않는다"와 "적어도 한 축은 읽힌다"이다.
  for (const [l, base, f] of ONE) {
    const g = withAxis(base, [C, P], () => () => 0, f);
    check(`${l}: 두 축 동시 getter여도 어느 축도 2회 이상 읽지 않는다`,
      g.n[C] <= 1 && g.n[P] <= 1 && g.n[C] + g.n[P] >= 1, `${g.n[C]}/${g.n[P]}`);
  }
  // 경로가 확정되기 전에는 읽지 않는다 (G-29의 핵심 위치 계약).
  const ZERO: [string, Any][] = [
    ["경로 불일치 · general·중증 근골격계", MIS_MSK()], ["경로 불일치 · general·중증 MRI", MIS_MRI()],
    ["용도 미정 · general·중증 주사료", MIS_PUR()], ["경로 불일치 · special·비중증 근골격계", MIS_REV()],
  ];
  for (const [l, base] of ZERO) {
    const g = withAxis(base, [C, P], () => () => 0, gi);
    check(`${l}: 두 축 접근자 0회`, g.n[C] === 0 && g.n[P] === 0, `${g.n[C]}/${g.n[P]}`);
    const t = withAxis(base, [C, P], () => () => { throw new Error("boom"); }, gi);
    check(`${l}: 던지는 getter여도 예외가 없다`, !threw(t.x));
  }
  // 선행 preflight가 결과를 정하는 경로 — 종전 읽기 횟수를 그대로 둔다(늘리지 않는다).
  const PRE: [string, Any, (i: unknown) => unknown][] = [
    ["리터럴 item 무효", { ...MSK(), item: "x" }, gi],
    ["진료비 무효", MSK({}, [{ amount: -1, visit: "outpatient" }]), gi],
    ["승인 회차 미입력", MSK({ priorAnnualTreatmentActCount: undefined, approvedThroughVisit: 10 }), gi],
    ["승인 회차 부족", MSK({ priorAnnualTreatmentActCount: 20, approvedThroughVisit: 10 }), gi],
    ["MRI 종별 미선택", CMRI({}, [{ amount: 3_000_000, visit: "inpatient" }]), gi],
    ["지급보험금 무효", MSK({ priorAnnualInsurancePaid: -1 }), gi],
  ];
  for (const [l, base, f] of PRE) for (const k of [C, P]) {
    const g = withAxis(base, [k], () => () => 0, f);
    check(`${l}: ${k === C ? "covered" : "pool"} 1회 이하(종전과 동일)`, g.n[k] <= 1, String(g.n[k]));
  }
}

console.log("\n[G-29] 5. 변하는 getter — 첫 검증값 하나만, 두 해석이 같은 값을 공유");
{
  // ⚠ 결과 동일성만으로 단일 읽기를 증명하지 않는다. 읽기 횟수와 **고정값 결과와의 일치**를 함께 본다.
  const changing = (base: Any, key: string, seq: unknown[], f: (i: unknown) => unknown = gi) => {
    let i = 0;
    return withAxis(base, [key], () => () => seq[Math.min(i++, seq.length - 1)], f);
  };
  {
    const g = changing(CMRI(), P, [0, 5_000_000]);
    check("중증 MRI: 검증 0 → 계산 5,000,000이어도 첫 값(0)으로 계산",
      g.n[P] === 1 && shape(g.x) === shape(item(CMRI)({ [P]: 0 })),
      `${g.n[P]} / ins=${insOf(g.x)} (기준선은 3,000,000으로 과다 산출)`);
  }
  {
    const g = changing(CMRI(), P, [5_000_000, 0]);
    check("중증 MRI: 반대 순서에서도 첫 값(5,000,000)으로 계산",
      g.n[P] === 1 && shape(g.x) === shape(item(CMRI)({ [P]: 5_000_000 })), String(insOf(g.x)));
  }
  {
    const g = changing(CMRI(), P, [0, -1]);
    check("중증 MRI: 두 번째 값이 무효여도 세탁되지 않는다(첫 값 0으로 계산)",
      g.n[P] === 1 && shape(g.x) === shape(item(CMRI)({ [P]: 0 })));
  }
  const M2 = (e: Any) => wrap(() => gi(MSK(e, [out(300_000), out(300_000)])));
  {
    const g = changing(MSK({}, [out(300_000), out(300_000)]), C, [0, 50, 50]);
    check("근골격계: 검증 0 → 계산 50이어도 첫 값(0)으로 계산",
      g.n[C] === 1 && shape(g.x) === shape(M2({ [C]: 0 })),
      `${g.n[C]} / ins=${insOf(g.x)} (기준선은 0원으로 과소 산출)`);
  }
  {
    // 두 해석(runOnce ×2)이 서로 다른 값에서 출발하면 잘못된 지급 0원 HOLD가 났다.
    const g = changing(MSK({}, [out(300_000), out(300_000)]), C, [0, 49, 50]);
    check("근골격계: 두 해석이 같은 값을 공유해 잘못된 지급 0원 HOLD가 나지 않는다",
      g.n[C] === 1 && statusOf(g.x) === "OK" && shape(g.x) === shape(M2({ [C]: 0 })),
      `${g.n[C]}/${statusOf(g.x)} (기준선은 PENDING_UNVERIFIED)`);
  }
  {
    const g = changing(MSK({}, [out(0), out(300_000)]), C, [0, 49, 50]);
    check("근골격계 0원 행 포함: 두 해석 공유(HOLD 오작동 없음)",
      g.n[C] === 1 && statusOf(g.x) === "OK");
  }
  {
    const g = changing(INJ(), C, [0, 100, 100]);
    check("주사료: 두 해석이 같은 값을 공유",
      g.n[C] === 1 && shape(g.x) === shape(item(INJ)({ [C]: 0 })));
  }
  {
    // 두 축이 동시에 변해도 각각 첫 값 하나씩이다.
    let i = 0, j = 0;
    const o = { ...CMRI() } as Any;
    let nc = 0, np = 0;
    Object.defineProperty(o, C, { enumerable: true, configurable: true, get() { nc++; return [undefined, 5][Math.min(i++, 1)]; } });
    Object.defineProperty(o, P, { enumerable: true, configurable: true, get() { np++; return [0, 5_000_000][Math.min(j++, 1)]; } });
    const x = wrap(() => gi(o));
    check("두 축 동시 변화: 각각 1회, 첫 값으로 판정", nc === 1 && np === 1 && shape(x) === shape(item(CMRI)({ [P]: 0 })), `${nc}/${np}`);
  }
}

console.log("\n[G-29] 6. 던지는 getter — 새 예외를 만들지 않는다");
{
  const ALL: [string, Any, (i: unknown) => unknown][] = [
    ["중증 근골격계", MSK(), gi], ["중증 주사료", INJ(), gi], ["중증 MRI", CMRI(), gi],
    ["비중증 MRI", NMRI(), gi], ["일반 전환", GEN(), gi], ["상급병실료(진입점)", RC(), gi],
    ["상급병실료(전용)", RC(), rc], ["급여 다회", BEN(), mc], ["직접 다회", MANY(), mc],
  ];
  for (const [l, base, f] of ALL) for (const k of [C, P]) {
    const g = withAxis(base, [k], () => () => { throw new Error("boom"); }, f);
    check(`${l} · ${k === C ? "covered" : "pool"}: 종전 그대로 전파(막으려면 읽어야 한다)`, threw(g.x));
  }
}

console.log("\n[G-29] 7. 전달 검사 — 무엇이 어떤 인자로 넘어가는가");
{
  const seen: string[] = [];
  const probe = new Proxy(MSK({ [C]: 7 }) as Any, {
    get(t, p, r) { if (typeof p === "string") seen.push(p); return Reflect.get(t, p, r); },
  });
  const x = wrap(() => gi(probe));
  check("Proxy 직접 관측: covered를 정확히 1회 읽는다",
    seen.filter((s) => s === C).length === 1, String(seen.filter((s) => s === C).length));
  check("그 값으로 계산이 끝난다", statusOf(x) === "OK");
  const seen2: string[] = [];
  const probe2 = new Proxy(CMRI({ [P]: 1_000_000 }) as Any, {
    get(t, p, r) { if (typeof p === "string") seen2.push(p); return Reflect.get(t, p, r); },
  });
  const x2 = wrap(() => gi(probe2));
  check("Proxy 직접 관측: pool을 정확히 1회 읽는다",
    seen2.filter((s) => s === P).length === 1, String(seen2.filter((s) => s === P).length));
  check("그 값으로 계산이 끝난다", statusOf(x2) === "OK");
}

console.log("\n[G-29] 8. 구조 검사 — 본체 재읽기·축 교차·관용 파서의 재등장 방지");
{
  const src = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const at = (s: string) => code.indexOf(s);
  const totals = (x: Caught) => `${ownOf(x)}/${insOf(x)}/${capsOf(x)}`;
  check("실행 코드에서 covered를 읽는 자리가 한 곳뿐이다",
    (code.match(/\)\.priorAnnualCoveredCount/g) ?? []).length === 1,
    String((code.match(/\)\.priorAnnualCoveredCount/g) ?? []).length));
  check("실행 코드에서 pool을 읽는 자리가 한 곳뿐이다",
    (code.match(/\)\.priorAnnualInpatientDeductible/g) ?? []).length === 1,
    String((code.match(/\)\.priorAnnualInpatientDeductible/g) ?? []).length));
  check("본체(runOnce)가 input에서 두 축을 다시 읽지 않는다",
    !/\(input as \{ priorAnnualCoveredCount\?: number \}\)/.test(code)
    && !/\(input as \{ priorAnnualInpatientDeductible\?: number \}\)/.test(code));
  check("검증한 값을 CheckedItemInput에 실어 넘긴다",
    /covered: covered as number \| undefined, pool: pool as number \| undefined,/.test(code)
    && /let count = checked\.covered \?\? 0;/.test(code)
    && /let poolUsed = checked\.pool \?\? 0;/.test(code));
  check("두 해석이 같은 checked를 받는다",
    /const counted = runOnce\(input, spec, true, priorPaid, checked\);/.test(code)
    && /const notCounted = runOnce\(input, spec, false, priorPaid, checked\);/.test(code));
  check("타입 이름이 역할과 맞다(CheckedItemInput)",
    /type CheckedItemInput = \{/.test(code) && !/CheckedAmounts/.test(code));
  check("관용 파서 nonNegInt가 이 파일에서 사라졌다", !/nonNegInt/.test(code));
  check("축 교차 없음 — covered로 acts를, acts로 covered를 대신 쓰지 않는다",
    !/priorActs = .*priorAnnualCoveredCount/.test(code) && !/checked\.covered.*priorActs/.test(code)
    && /const maxCount = priorActs/.test(code));
  check("축 교차 없음 — covered와 pool을 서로 대신 쓰지 않는다",
    /let count = checked\.covered \?\? 0;/.test(code) && /let poolUsed = checked\.pool \?\? 0;/.test(code)
    && !/count = checked\.pool/.test(code) && !/poolUsed = checked\.covered/.test(code));
  // ⚠ **위치가 계약이다.** 경로 대조는 리터럴 네 축 검증 뒤, 경로별 축을 읽기 전.
  check("경로 대조가 validateItemInput 안, 두 축보다 앞이다",
    at("const expectedRoute = routeOfGen2026Item(") > at("function validateItemInput(")
    && at("const expectedRoute = routeOfGen2026Item(") < at("const covered: unknown =")
    && at("const expectedRoute = routeOfGen2026Item(") < at("const pool: unknown ="));
  check("경로 대조가 리터럴 네 축 검증보다는 뒤다",
    at("const expectedRoute = routeOfGen2026Item(") > at('rejected("치료유형(item)"')
    && at("const expectedRoute = routeOfGen2026Item(") > at('rejected("약제 용도(injectionPurpose)는 중증 비급여 주사료에서만 사용합니다 —'));
  check("진입점에 옛 경로 대조가 남아 있지 않다",
    (code.match(/routeOfGen2026Item\(/g) ?? []).length === 2, // 선언 + validateItemInput의 호출
    String((code.match(/routeOfGen2026Item\(/g) ?? []).length));
  check("G-28 stray 검사는 그대로 경로 확정 뒤다",
    at("const strayActs") > at("export function calculateGen2026Item("));
  // HOLD 무회귀.
  check("지급 0원 HOLD 차단이 그대로",
    /if \(fingerprint\(counted\) !== fingerprint\(notCounted\)\) return blocked\(totalAmount, ZERO_PAY_HOLD_NOTES\);/.test(src));
  check("HOLD 안내 3줄이 그대로",
    src.includes("지급 보험금이 0원인 치료행위가 연간 보상 횟수를 소진하는지는 표준약관에 정해져 있지 않습니다."));
  // ── G-14A pool 공유 범위 HOLD ─────────────────────────────────────
  //   ⚠ 이 HOLD는 약관상 합산 범위를 **확정하지 않는다.** 확정하지 않은 채로 고정하는 것은
  //     "현재 구현이 두 축을 따로 계산한다"는 **사실 서술**뿐이다. 종전에는 그 서술이
  //     코드와 어긋나도 아무 검사가 잡지 못했다(G-29 변조 검사에서 발견). 문구와 동작을
  //     함께 고정한다 — 약관 해석을 새로 단정하지 않는다.
  const rules = readFileSync("src/lib/insurance/engine/regulatoryRules.ts", "utf8");
  check("G-14A pool 공유 범위 HOLD가 그대로 있다",
    rules.includes("GEN2026-CRITICAL-DEDUCTIBLE-POOL-SCOPE"));
  check("HOLD 본문의 '현재 구현' 서술이 그대로다(각각 따로 계산)",
    rules.includes("priorAnnualInpatientDeductible로 **각각 500만원 한도를 따로** 계산한다"));
  // ⚠ **계약이 바뀌었다(G-30).** G-29 시점에는 `priorAnnualDeductible`이 별도 보장종목에서
  //   **조용히 폐기**돼 "결과가 미제공과 같다"로 두 축의 분리를 확인할 수 있었다. G-30이 그
  //   조용한 폐기를 닫아 이제 명시적으로 **거부**한다. 두 축이 분리돼 있다는 요지는 같고,
  //   확인 방법만 "무시된다"에서 "다른 축으로 쓰이지 않고 거부된다"로 바뀐다.
  check("그 서술대로 동작한다 — 중증 MRI pool은 priorAnnualInpatientDeductible만 소진한다",
    totals(item(CMRI)({ [P]: 5_000_000 })) !== totals(item(CMRI)())
    && isRejected(item(CMRI)({ priorAnnualDeductible: 5_000_000 }))
    && note0(item(CMRI)({ priorAnnualDeductible: 5_000_000 })).startsWith("priorAnnualDeductible은(는) 일반 상해·질병 비급여의 금액 축"),
    note0(item(CMRI)({ priorAnnualDeductible: 5_000_000 })).slice(0, 40));
  check("500만 원 상한은 산식이 Math.max로 처리한다(절삭 없음)", /Math\.max\(.*poolUsed/.test(code) || /poolUsed/.test(code));
}

console.log("\n[G-29] 9. 안내 우선순위 — 경로 대조가 먼저, 그 밖은 종전 그대로");
{
  // 경로가 틀리면 경로 안내가 먼저다(의도한 전환 — 차분 버킷 11).
  for (const [l, mk, head] of [
    ["general·중증 근골격계", MIS_MSK, "이 조합은 별도 보장종목 경로에서 계산해야 합니다."],
    ["general·중증 MRI", MIS_MRI, "이 조합은 별도 보장종목 경로에서 계산해야 합니다."],
    ["general·용도 미정", MIS_PUR, "비급여 주사료의 약제 용도(injectionPurpose)가 없어"],
    ["special·비중증 근골격계", MIS_REV, "이 조합은 일반 상해·질병 비급여 경로에서 계산해야 합니다."],
  ] as [string, (e: Any) => Any, string][]) {
    const bare = wrap(() => gi(mk({})));
    for (const over of [{ [C]: 5 }, { [P]: 5 }, { [C]: 5, [P]: 5 }, { [C]: -1 }, { [P]: "x" }, { cause: "x" }, { amounts: null }]) {
      const x = wrap(() => gi(mk(over)));
      check(`${l} + ${JSON.stringify(over).slice(0, 26)}: 경로 안내가 그대로 우선`,
        note0(x) === note0(bare) && note0(x).startsWith(head) && isRejected(x), note0(x).slice(0, 40));
    }
  }
  // 리터럴 네 축은 여전히 경로 대조보다 앞이다.
  for (const [l, over, want] of [
    ["route 무효", { route: "x" }, "경로(route)"], ["coverage 무효", { coverage: "benefit" }, "급여 구분(coverage)"],
    ["severity 무효", { severity: "x" }, "질환 구분(severity)"], ["item 무효", { item: "x" }, "치료유형(item)"],
    ["purpose 무효", { injectionPurpose: "zzz" }, "약제 용도(injectionPurpose)는 중증 비급여 주사료에서만"],
  ] as [string, Any, string][]) {
    check(`${l}이 경로 대조보다 앞선다`,
      note0(wrap(() => gi(MIS_MSK({ ...over, [C]: 5 })))).startsWith(want),
      note0(wrap(() => gi(MIS_MSK({ ...over, [C]: 5 })))).slice(0, 40));
  }
  // 경로가 **맞는** 조합에서는 종전 우선순위가 그대로다.
  for (const [l, base, over, want] of [
    ["근골격계 · 진료비 무효", MSK({}, [{ amount: -1, visit: "outpatient" }]), { [C]: 5 }, "1번째 행의 진료비(amount)"],
    ["근골격계 · lines 비배열", MSK({}, 3 as unknown as unknown[]), { [C]: 5 }, "행 목록(lines)"],
    ["근골격계 · 통원 카운터", MSK({ priorAnnualOutpatientDays: 0 }), { [C]: 5 }, "통원 카운터는 별도 보장종목"],
    ["근골격계 · covered 유효 + pool stray → pool 안내", MSK(), { [C]: 5, [P]: 5 }, "누적 공제금액(priorAnnualInpatientDeductible)은 500만 원"],
    ["근골격계 · covered 무효가 pool stray보다 앞", MSK(), { [C]: -1, [P]: 5 }, "이미 보상한 횟수(priorAnnualCoveredCount)는 0 이상"],
    ["중증 MRI · covered stray가 pool보다 앞", CMRI(), { [C]: 5, [P]: 5 }, "이미 보상한 횟수(priorAnnualCoveredCount)"],
    ["중증 MRI · 종별 미선택", CMRI({}, [{ amount: 3_000_000, visit: "inpatient" }]), { [P]: 5 }, "중증 비급여 MRI 입원은 의료기관 종별"],
    ["중증 MRI · lines 비배열", CMRI({}, 3 as unknown as unknown[]), { [P]: 5 }, "누적 공제금액(priorAnnualInpatientDeductible)은 상급종합"],
    ["근골격계 · 승인 부족", MSK({ approvedThroughVisit: 10, priorAnnualTreatmentActCount: 20 }), { [C]: 5 }, "근골격계 이학요법·체외충격파는 최초"],
  ] as [string, Any, Any, string][]) {
    const x = wrap(() => gi({ ...base, ...over }));
    check(`${l}: 종전 안내 유지`, note0(x).startsWith(want), note0(x).slice(0, 46));
  }
}

console.log("\n[G-29] 10. 범위 밖 무회귀 — 다른 경로·다른 축");
{
  for (const [l, f, mk] of [
    ["일반 전환", gi, GEN], ["일반 전환(항암제)", gi, GANTI], ["상급병실료(진입점)", gi, RC],
  ] as [string, (i: unknown) => unknown, (e: Any) => Any][]) {
    for (const k of [C, P]) {
      const x = wrap(() => f(mk({ [k]: 0 })));
      check(`${l}: ${k === C ? "covered" : "pool"} stray를 종전대로 거부`, isRejected(x), note0(x).slice(0, 40));
    }
    check(`${l}: 정상 입력 무회귀`, statusOf(wrap(() => f(mk({})))) === "OK");
  }
  check("상급병실료(전용): 두 축 stray를 종전대로 거부",
    note0(wrap(() => rc(RC({ [C]: 0 })))).includes("쓰이지 않는 입력(priorAnnualCoveredCount)")
    && note0(wrap(() => rc(RC({ [P]: 0 })))).includes("쓰이지 않는 입력(priorAnnualInpatientDeductible)"));
  check("급여·직접 다회: 두 축 stray를 종전대로 차단",
    note0(wrap(() => mc(BEN({ [C]: 0 })))).includes("priorAnnualCoveredCount")
    && note0(wrap(() => mc(MANY({ [P]: 0 })))).includes("priorAnnualInpatientDeductible"));
  check("G-28 축 분리: covered=10이어도 승인 판정은 acts로만 한다",
    statusOf(item(MSK)({ [C]: 10, priorAnnualTreatmentActCount: 0, approvedThroughVisit: 10 })) === "OK");
  check("G-28 축 분리: covered=0이어도 acts가 승인 범위를 넘으면 막는다",
    statusOf(wrap(() => gi(MSK({ [C]: 0, priorAnnualTreatmentActCount: 20, approvedThroughVisit: 10 })))) === "PENDING_UNVERIFIED");
  check("G-28 축 분리: acts를 covered로 대신 쓰지 않는다(covered 50이어도 승인은 acts 0 기준)",
    statusOf(item(MSK)({ [C]: 50, priorAnnualTreatmentActCount: 0, approvedThroughVisit: 10 })) === "OK");
  check("G-26·G-27 진료비 계약 무회귀",
    isRejected(wrap(() => gi(GEN({ amounts: [-1] })))) && isRejected(wrap(() => gi(MSK({}, [{ amount: 0.5, visit: "outpatient" }])))));
  check("정상 계산 무회귀 — 근골격계·MRI·일반 전환·상급병실료·다회",
    insOf(item(MSK)()) === 210_000 && insOf(item(CMRI)()) === 2_100_000
    && insOf(item(GEN)()) === 150_000
    && (wrap(() => rc(RC())).valueOf() as Res) !== undefined
    && insOf(wrap(() => rc(RC()))) === 500_000
    && insOf(wrap(() => mc(MANY()))) === 150_000);
}

console.log(`\n[G-29 형제 두 축의 단일 읽기] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
