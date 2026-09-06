// G-26 — 5세대 **진료비 축 세 곳**의 값 검증.
//   대상: `roomCharge2026.ts`의 `stays[].roomChargeTotal`
//         `specialItem2026.ts`의 `lines[].amount`(별도 보장종목)
//         `specialItem2026.ts`의 `amounts[]`(일반 전환 경로)
//   = 공용 `isNum()`의 **남은 호출부 전부**(호출 2 + 함수 참조 1). 그래서 `isNum`은 삭제됐다.
//
// 종전 동작(기준선 75408f3 — UI 미경유 엔진 직접 호출로 실측):
//   `isNum = (v) => typeof v === "number" && Number.isFinite(v)`만 통과하면 됐다.
//     - `lines[].amount`·`amounts[]`: **음수·음수 소수가 통과**해 하류 `normalizeAmount`
//       (`Math.max(0, Math.floor(v))`)에서 **0원 행**이 됐다(`-1`·`-300000`·`-0.5` 모두).
//     - 세 축 모두 **양수 소수가 통과**해 내림됐다(`0.5` → 0원 행, `300000.9` → 300,000).
//     - 세 축 모두 **안전 정수 초과가 무검증 통과**했다(`MAX_SAFE + 1`).
//     - **합계 검사가 없었다.** 원소가 모두 안전해도 `[MAX_SAFE, MAX_SAFE]`가 통과해
//       총액과 그 뒤 누적이 정밀도를 잃었다.
//   ⚠ 세 축 모두 **런타임 예외는 내지 않았다.** 조용히 틀린 금액과 없던 행이 문제다.
//   ⚠ 읽는 횟수도 중복이었다 — `roomChargeTotal` **3회**(가드 인자·음수 비교·본체),
//     `line.amount` **4회**(검증·총액·두 해석의 `runOnce`), `amounts[i]` **2회**
//     (`every` · 하류 `normalizeAmount`). 값이 달라지는 접근자에서 **검증한 값과 계산에
//     쓰는 값이 갈렸다**(실측: 상급병실료 검증 1,000,000 → 계산 4,000,000,
//     별도 보장종목 검증 300,000 → 계산 900,000, 두 해석도 서로 다른 값에서 출발).
//
// ⚠ **유지한 계약**:
//   숫자 `0`은 **유효한 청구 행**이다(거부하지 않는다). 빈 배열은 유효한 빈 묶음이다.
//   컨테이너 미제공·비배열의 거부, 각 진입점의 `rejected()` 반환 계약(총액 0),
//   기존 안내 문구와 우선순위, 산식·공제·한도·지급보험금·횟수·승인 회차,
//   0원 행의 소진 계약(5세대는 소진하지 않는다)과 모든 HOLD.
//   ⚠ 공용 `normalizeAmount`는 **한 글자도 바꾸지 않았다.** 검증된 값에 대해 항등이므로
//     세 경로에서 호출을 걷어냈을 뿐이고, 다른 엔진의 사용처는 이번 범위가 아니다.
//
// ⚠ **범위 밖(이번에 새로 확정)**: `multiClaim2026.calculateMany2026`의 `amounts`는
//   **네 번째 진료비 자리**다. `isNum`을 쓰지 않아 전수 검색에 걸리지 않았고, 검증이
//   전혀 없어 모든 무효값이 0원 행이 된다(비배열은 런타임 `TypeError`). 반환 계약이
//   `blocked()`(진료비 합계 보존)이고 컨테이너 미제공의 의미도 달라(빈 묶음) 같은 커밋으로
//   묶지 않았다. 아래 12절이 그 자리가 **아직 그대로인지**를 고정한다.
import { readFileSync } from "node:fs";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

type Res = Record<string, unknown>;
type Caught = { threw: string } | { r: Res };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => unknown): Caught => {
  try { return { r: f() as Res }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const statusOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.status);
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.route ?? "-"}/${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/rows=${(x.r.lines as unknown[]).length}`;
const rowAmounts = (x: Caught) => threw(x) ? "THROW"
  : (x.r.lines as { amount?: unknown }[]).map((l) => String(l.amount)).join(",");
const note0 = (x: Caught) => threw(x) ? "" : (((x.r.notes as string[]) ?? [])[0] ?? "");
/** 던진 경우와 값이 없는 경우를 구분해 읽는다. 좁히기가 호출 사이에 이어지지 않기 때문이다. */
const insOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalInsurancePay as number | null);
const amtOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalAmount as number | null);
/** 세 진입점 공통 거부 계약 — 총액을 만들지 않는다. */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const MAX = Number.MAX_SAFE_INTEGER;
const circ: Record<string, unknown> = {}; circ.self = circ;

// ── 세 경로의 호출 어댑터. 같은 격자를 세 곳에 그대로 먹인다. ──────────
const A = (amounts: unknown[]) => wrap(() => calculateRoomCharge2026({
  route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
  stays: amounts.map((a) => ({ roomChargeTotal: a, inpatientDays: 5 })),
} as never));
const Acont = (stays: unknown) => wrap(() => calculateRoomCharge2026({
  route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical", stays,
} as never));
const B = (amounts: unknown[]) => wrap(() => calculateGen2026Item({
  route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
  injectionPurpose: "general", lines: amounts.map((a) => ({ amount: a, visit: "outpatient" })),
  priorAnnualCoveredCount: 0,
} as never));
const Bcont = (lines: unknown) => wrap(() => calculateGen2026Item({
  route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
  injectionPurpose: "general", lines, priorAnnualCoveredCount: 0,
} as never));
const C = (amounts: unknown) => wrap(() => calculateGen2026Item({
  route: "general", coverage: "non_benefit", severity: "non_critical", item: "musculoskeletal_esw",
  cause: "disease", visit: "outpatient", amounts, priorAnnualOutpatientDays: 0,
} as never));
const PATHS: [string, (a: unknown[]) => Caught][] = [
  ["A 상급병실료", A], ["B 별도 보장종목", B], ["C 일반 전환", (a) => C(a)],
];

console.log("\n[G-26] 1. 정상 양의 안전 정수 — 무회귀");
for (const [label, run] of PATHS) {
  for (const [n, v] of [["1", 1], ["300,000", 300_000], ["MAX_SAFE", MAX]] as [string, number][]) {
    const x = run([v]);
    check(`${label}: ${n} → 계산된다`, statusOf(x) === "OK" && x !== undefined && !isRejected(x), shape(x));
    check(`${label}: ${n} → 행 금액이 입력 그대로다`, rowAmounts(x) === String(v), rowAmounts(x));
  }
  const two = run([300_000, 700_000]);
  check(`${label}: 여러 행의 총액이 입력 합계와 같다`,
    !threw(two) && two.r.totalAmount === 1_000_000, shape(two));
}

console.log("\n[G-26] 2. 명시적 숫자 0 — 유효한 청구 행(무회귀)");
for (const [label, run] of PATHS) {
  const z = run([0]);
  check(`${label}: 0원 한 행 → OK`, statusOf(z) === "OK", shape(z));
  check(`${label}: 0원 행이 결과에 남는다(버리지 않는다)`, rowAmounts(z) === "0", rowAmounts(z));
  const mix = run([0, 300_000]);
  check(`${label}: 0원 + 정상 → 두 행 모두 남고 총액은 300,000`,
    !threw(mix) && (mix.r.lines as unknown[]).length === 2 && mix.r.totalAmount === 300_000, shape(mix));
  check(`${label}: -0도 종전대로 0과 같다`, shape(run([-0])) === shape(run([0])));
}

console.log("\n[G-26] 3. 빈 배열 — 유효한 빈 묶음(무회귀)");
for (const [label, run] of PATHS) {
  const e = run([]);
  check(`${label}: 빈 배열 → OK · 총액 0 · 행 0`,
    statusOf(e) === "OK" && !threw(e) && e.r.totalAmount === 0 && (e.r.lines as unknown[]).length === 0, shape(e));
  check(`${label}: 빈 배열은 거부가 아니다`, !isRejected(e));
}

console.log("\n[G-26] 4. 잘못된 컨테이너 — 종전 거부 계약 그대로");
for (const [label, run] of [["A 상급병실료", Acont], ["B 별도 보장종목", Bcont], ["C 일반 전환", C]] as [string, (v: unknown) => Caught][]) {
  for (const [n, v] of [["undefined", undefined], ["null", null], ["객체", {}], ["문자열", "abc"], ["숫자", 1]] as [string, unknown][]) {
    check(`${label}: 컨테이너 ${n} → 거부(총액 0)`, isRejected(run(v)), shape(run(v)));
  }
}
check("A: 컨테이너 안내가 종전 그대로", note0(Acont(null)).startsWith("입원 목록(stays)"), note0(Acont(null)));
check("B: 컨테이너 안내가 종전 그대로", note0(Bcont(null)).startsWith("행 목록(lines)"), note0(Bcont(null)));
check("C: 컨테이너 안내가 종전 그대로", note0(C(null)).startsWith("진료비 목록(amounts)"), note0(C(null)));

console.log("\n[G-26] 5. 무효 원소 — 차단으로 전환");
const BAD: [string, unknown][] = [
  ["음수 -1", -1], ["음수 -300000", -300_000],
  ["양수 소수 0.5", 0.5], ["양수 소수 300000.9", 300_000.9], ["음수 소수 -0.5", -0.5],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["숫자 문자열", "300000"], ["빈 문자열", ""], ["공백", " "],
  ["지수 문자열", "3e5"], ["쉼표 문자열", "300,000"],
  ["true", true], ["false", false], ["객체", {}], ["중첩 배열", [1]],
  ["bigint", 1n], ["Symbol", Symbol("s")], ["함수", () => 1], ["순환 참조", circ],
  ["undefined", undefined], ["null", null],
];
for (const [label, run] of PATHS) {
  for (const [n, v] of BAD) {
    const x = run([v]);
    check(`${label}: ${n} → 거부(총액 0 · 행 0)`, isRejected(x), shape(x));
  }
}
console.log("\n[G-26] 6. 안전 정수 초과 원소 — 차단으로 전환");
for (const [label, run] of PATHS) {
  check(`${label}: MAX_SAFE+1 → 거부`, isRejected(run([MAX + 1])), shape(run([MAX + 1])));
  check(`${label}: MAX_SAFE는 종전대로 통과`, statusOf(run([MAX])) === "OK");
}

console.log("\n[G-26] 7. 합계 안전 정수 초과 — 차단 신설");
for (const [label, run] of PATHS) {
  const over = run([MAX, MAX]);
  check(`${label}: [MAX_SAFE, MAX_SAFE] → 거부(총액 0)`, isRejected(over), shape(over));
  check(`${label}: 합계 안내가 원소 안내와 구분된다`,
    note0(over).includes("합계가 안전한 정수 범위를 벗어나"), note0(over));
  check(`${label}: 합계 안내가 위험 방향을 단정하지 않는다`,
    !/과다|과소|많이|적게/.test(note0(over)), note0(over));
  check(`${label}: 원소가 안전하고 합계도 안전하면 통과`, statusOf(run([MAX - 1, 1])) === "OK");
}

console.log("\n[G-26] 8. 무효 원소가 섞인 묶음 — 부분합 금지");
for (const [label, run] of PATHS) {
  for (const [n, v] of [["음수", -1], ["소수", 0.5], ["문자열", "300000"], ["MAX+1", MAX + 1]] as [string, unknown][]) {
    const x = run([300_000, v]);
    check(`${label}: [정상, ${n}] → 총액 0 · 행 0(부분합 없음)`, isRejected(x), shape(x));
    check(`${label}: [정상, ${n}] → 유효 행만 노출하지 않는다`, rowAmounts(x) === "", rowAmounts(x));
  }
  const first = run([-1, 300_000]);
  check(`${label}: 무효가 1번째여도 같은 계약`, isRejected(first), shape(first));
}
check("A: 몇 번째 행인지 안내한다", note0(A([300_000, -1])).startsWith("2번째 입원의 상급병실료 차액(roomChargeTotal)"), note0(A([300_000, -1])));
check("B: 몇 번째 행인지 안내한다", note0(B([300_000, -1])).startsWith("2번째 행의 진료비(amount)"), note0(B([300_000, -1])));
// ⚠ **낡은 계약을 교체했다.** C는 종전에 원소가 잘못돼도 컨테이너 안내("진료비 목록(amounts)")만
//   내보내 몇 번째인지 알 수 없었다. 반환 계약은 그대로 두고 안내만 A·B와 같은 모양으로 맞췄다.
check("C: 몇 번째 행인지 안내한다(종전에는 컨테이너 안내였다)",
  note0(C([300_000, -1])).startsWith("2번째 진료비(amounts)"), note0(C([300_000, -1])));

console.log("\n[G-26] 9. 안내 우선순위 — 선행 preflight가 그대로 앞선다");
{
  const first = (x: Caught) => note0(x).slice(0, 44);
  const rcOver = (over: Record<string, unknown>) => wrap(() => calculateRoomCharge2026({
    route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
    stays: [{ roomChargeTotal: -1, inpatientDays: 5 }], ...over } as never));
  check("A: 원인 무효가 진료비보다 앞선다", first(rcOver({ cause: "x" })).startsWith("원인(cause)"));
  check("A: 미사용 축 stray가 진료비보다 앞선다",
    first(rcOver({ outpatientCoverageLimit: 1 })).startsWith("상급병실료 차액 계산에 쓰이지 않는 입력"));
  check("A: 진료비가 일수보다 앞선다(같은 행)",
    first(wrap(() => calculateRoomCharge2026({ route: "room_charge", coverage: "non_benefit", cause: "disease",
      severity: "non_critical", stays: [{ roomChargeTotal: -1, inpatientDays: 0 }] } as never)))
      .startsWith("1번째 입원의 상급병실료 차액"));
  check("A: 진료비가 지급보험금·가입금액보다 앞선다",
    first(rcOver({ priorAnnualInsurancePaid: -1, annualCoverageLimit: -1 }))
      .startsWith("1번째 입원의 상급병실료 차액"));
  const siOver = (over: Record<string, unknown>) => wrap(() => calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "general", lines: [{ amount: -1, visit: "outpatient" }],
    priorAnnualCoveredCount: 0, ...over } as never));
  check("B: 질환 구분 무효가 진료비보다 앞선다", first(siOver({ severity: "x" })).startsWith("질환 구분(severity)"));
  check("B: 통원 카운터 stray가 진료비보다 앞선다",
    first(siOver({ priorAnnualOutpatientDays: 0 })).startsWith("통원 카운터는 별도 보장종목"));
  check("B: 진료비가 치료 형태(visit)보다 앞선다(같은 행)",
    first(wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
      severity: "critical", item: "injection", injectionPurpose: "general",
      lines: [{ amount: -1, visit: "x" }], priorAnnualCoveredCount: 0 } as never)))
      .startsWith("1번째 행의 진료비(amount)"));
  check("B: 진료비가 승인 회차 preflight보다 앞선다(승인 회차는 계산 단계다)",
    isRejected(wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
      severity: "critical", item: "musculoskeletal_esw", lines: [{ amount: -1, visit: "outpatient" }],
      priorAnnualCoveredCount: 0 } as never))));
  check("C: 원인 무효가 진료비보다 앞선다",
    first(wrap(() => calculateGen2026Item({ route: "general", coverage: "non_benefit",
      severity: "non_critical", item: "musculoskeletal_esw", cause: "x", visit: "outpatient",
      amounts: [-1], priorAnnualOutpatientDays: 0 } as never))).startsWith("원인(cause)"));
  check("C: 진료비가 통원 카운터 축 분리보다 앞선다",
    first(wrap(() => calculateGen2026Item({ route: "general", coverage: "non_benefit",
      severity: "non_critical", item: "musculoskeletal_esw", cause: "disease", visit: "outpatient",
      amounts: [-1], priorAnnualOutpatientVisits: 0 } as never))).startsWith("1번째 진료비(amounts)"));
}

console.log("\n[G-26] 10. 0원 행의 기존 소진·HOLD 계약 — 무회귀");
{
  // 5세대는 0원 행이 횟수·일수를 **소진하지 않는다**(4세대와 반대다).
  const many = (amounts: number[], prior: number) => wrap(() => calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "non_critical",
    nonBenefitItem: "general", amounts, priorAnnualOutpatientDays: prior } as never));
  check("다회: 0원 행은 연 100일을 소진하지 않는다(prior 99에서 정상 행이 지급된다)",
    insOf(many([0, 300_000], 99)) === 150_000,
    shape(many([0, 300_000], 99)));
  const inj = (amounts: number[], prior: number) => wrap(() => calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "general", lines: amounts.map((a) => ({ amount: a, visit: "outpatient" })),
    priorAnnualCoveredCount: prior } as never));
  check("별도 보장종목: 0원 행은 연 50회를 소진하지 않는다",
    insOf(inj([0, 300_000], 49)) === 210_000,
    shape(inj([0, 300_000], 49)));
  check("별도 보장종목: 양수 행은 종전대로 소진한다(경계 확인)",
    insOf(inj([300_000, 300_000], 49)) === 210_000);
  // 승인 회차 집계는 양수 금액 행만 센다 — 검증된 배열을 쓰면서도 그대로다.
  const msk = (amounts: number[], approved: number) => wrap(() => calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw",
    lines: amounts.map((a) => ({ amount: a, visit: "outpatient" })), priorAnnualCoveredCount: 0,
    priorAnnualTreatmentActCount: 10, approvedThroughVisit: approved } as never));
  check("근골격계: 0원 행은 승인 회차를 밀지 않는다", statusOf(msk([0, 300_000], 20)) === "OK", shape(msk([0, 300_000], 20)));
  check("근골격계: 양수 두 행은 종전대로 승인 회차를 민다", statusOf(msk([300_000, 300_000], 10)) === "PENDING_UNVERIFIED");
  // 지급 0원 HOLD는 그대로 살아 있다.
  const holdSrc = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("지급 0원 HOLD 차단이 그대로", /if \(fingerprint\(counted\) !== fingerprint\(notCounted\)\) return blocked\(totalAmount, ZERO_PAY_HOLD_NOTES\);/.test(holdSrc));
  check("500만원 pool HOLD 안내가 그대로",
    readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8")
      .includes("공제금액 상한 500만 원(특별약관1 제5조 제5항)은 상급병실료 차액에 적용한다는 명시적 근거를 찾지 못해 반영하지 않았습니다."));
}

console.log("\n[G-26] 11. 접근자 — 정확히 1회, 선행 차단 0회");
{
  const withStay = (get: () => unknown, over: Record<string, unknown> = {}, days: unknown = 5) => {
    const n = { v: 0 };
    const stay: Record<string, unknown> = { inpatientDays: days };
    Object.defineProperty(stay, "roomChargeTotal", { enumerable: true, configurable: true, get() { n.v++; return get(); } });
    const x = wrap(() => calculateRoomCharge2026({ route: "room_charge", coverage: "non_benefit",
      cause: "disease", severity: "non_critical", stays: [stay], ...over } as never));
    return { n: n.v, x };
  };
  const okA = withStay(() => 1_000_000);
  check("A: 정상 경로에서 정확히 1회 읽는다", okA.n === 1, String(okA.n));
  check("A: 무효값도 1회만 읽는다", withStay(() => -1).n === 1);
  check("A: 일수 무효(후행)에서도 1회다", withStay(() => 1_000_000, {}, 0).n === 1);
  check("A: 선행 preflight 차단에서 0회", withStay(() => 1_000_000, { cause: "x" }).n === 0
    && withStay(() => 1_000_000, { outpatientCoverageLimit: 1 }).n === 0);
  {
    let i = 0;
    const g = withStay(() => [1_000_000, 4_000_000][Math.min(i++, 1)]);
    check("A: 변하는 getter — 첫 값 하나만 검증·계산에 쓰인다",
      g.n === 1 && !threw(g.x) && g.x.r.totalAmount === 1_000_000, shape(g.x));
  }
  const throwA = withStay(() => { throw new Error("boom"); });
  check("A: 던지는 getter는 종전대로 정상 경로에서만 전파", threw(throwA.x) && throwA.n === 1);
  check("A: 선행 차단이면 던지는 getter도 예외가 없다",
    !threw(withStay(() => { throw new Error("boom"); }, { cause: "x" }).x));

  const withLine = (get: () => unknown, over: Record<string, unknown> = {}) => {
    const n = { v: 0 };
    const line: Record<string, unknown> = { visit: "outpatient" };
    Object.defineProperty(line, "amount", { enumerable: true, configurable: true, get() { n.v++; return get(); } });
    const x = wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
      severity: "critical", item: "injection", injectionPurpose: "general", lines: [line],
      priorAnnualCoveredCount: 0, ...over } as never));
    return { n: n.v, x };
  };
  check("B: 정상 경로에서 정확히 1회 읽는다(종전 4회)", withLine(() => 300_000).n === 1,
    String(withLine(() => 300_000).n));
  check("B: 선행 preflight 차단에서 0회", withLine(() => 300_000, { severity: "x" }).n === 0
    && withLine(() => 300_000, { priorAnnualOutpatientDays: 0 }).n === 0);
  {
    let i = 0;
    const g = withLine(() => [300_000, 900_000][Math.min(i++, 1)]);
    check("B: 변하는 getter — 두 해석이 같은 첫 값에서 출발한다",
      g.n === 1 && !threw(g.x) && g.x.r.totalAmount === 300_000, shape(g.x));
  }
  check("B: 던지는 getter는 종전대로 전파", threw(withLine(() => { throw new Error("boom"); }).x));
  check("B: 선행 차단이면 던지는 getter도 예외가 없다",
    !threw(withLine(() => { throw new Error("boom"); }, { severity: "x" }).x));

  const withArr = (get: () => unknown, over: Record<string, unknown> = {}) => {
    const n = { v: 0 };
    const arr: unknown[] = [];
    Object.defineProperty(arr, "0", { enumerable: true, configurable: true, get() { n.v++; return get(); } });
    arr.length = 1;
    const x = wrap(() => calculateGen2026Item({ route: "general", coverage: "non_benefit",
      severity: "non_critical", item: "musculoskeletal_esw", cause: "disease", visit: "outpatient",
      amounts: arr, priorAnnualOutpatientDays: 0, ...over } as never));
    return { n: n.v, x };
  };
  check("C: 정상 경로에서 정확히 1회 읽는다(종전 2회)", withArr(() => 300_000).n === 1,
    String(withArr(() => 300_000).n));
  check("C: 선행 preflight 차단에서 0회", withArr(() => 300_000, { cause: "x" }).n === 0);
  {
    let i = 0;
    const g = withArr(() => [300_000, 900_000][Math.min(i++, 1)]);
    check("C: 변하는 getter — 검증한 값이 그대로 하류로 간다",
      g.n === 1 && !threw(g.x) && g.x.r.totalAmount === 300_000, shape(g.x));
  }
  check("C: 던지는 getter는 종전대로 전파", threw(withArr(() => { throw new Error("boom"); }).x));
}

console.log("\n[G-26] 12. 범위 밖 — 네 번째 자리와 다른 세대는 그대로다");
{
  // ⚠ **낡은 계약 6건을 교체했다(G-27).** G-26은 `multiClaim2026`의 `amounts`를 **네 번째
  //   진료비 자리**로 확정하고 범위 밖으로 남기면서, 그 자리가 **아직 종전 그대로인지**를
  //   여기에 고정했다(미제공 = 빈 묶음 / 무효 원소 = 0원 행 / 비배열 = 런타임 예외 /
  //   양수 소수 내림 / 안전 정수 초과 통과 / `map(normalizeAmount)` 원문). G-27이 그 자리를
  //   닫았으므로 **이제 닫혔는지**를 고정한다. 상세 계약은
  //   `tests/gen2026MultiAmountValue.test.ts`가 본다.
  const many = (amounts: unknown) => wrap(() => calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "non_critical",
    nonBenefitItem: "general", amounts, priorAnnualOutpatientDays: 0 } as never));
  const unusable = (x: Caught) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
    && x.r.totalAmount === 0 && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
    && (x.r.lines as unknown[]).length === 0;
  check("네 번째 자리: 미제공이 이제 차단된다(G-27)", unusable(many(undefined)), shape(many(undefined)));
  check("네 번째 자리: null도 차단된다", unusable(many(null)));
  check("네 번째 자리: 무효 원소가 0원 행이 되지 않는다", unusable(many([300_000, "abc"])), shape(many([300_000, "abc"])));
  check("네 번째 자리: 비배열이 예외가 아니라 안전한 차단이 된다", unusable(many({})), shape(many({})));
  check("네 번째 자리: 양수 소수가 내림되지 않는다", unusable(many([300_000.9])));
  check("네 번째 자리: 안전 정수 초과가 차단된다", unusable(many([MAX + 1])));
  check("네 번째 자리: 정상 계산과 빈 배열·0원 행은 그대로",
    insOf(many([300_000])) === 150_000 && statusOf(many([])) === "OK"
    && statusOf(many([0, 300_000])) === "OK" && amtOf(many([0, 300_000])) === 300_000);
  const src26 = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const src26Code = src26.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("네 번째 자리: amounts ?? [] 폴백이 사라졌다(주석 인용은 정상)",
    !/input\.amounts \?\? \[\]/.test(src26Code) && !/normalizeAmount\(/.test(src26Code));
  // 4세대·2·3세대는 손대지 않았다.
  const src21 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("범위 밖: 4세대 진료비 계약(G-16)이 그대로",
    src21.includes("진료비 목록(amounts)은 배열이어야 합니다. 청구가 없는 묶음은 빈 배열로 넘겨 주세요.")
    && src21.includes("진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다."));
  const src09 = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("범위 밖: 2·3세대는 종전대로 normalizeAmount를 쓴다", /normalizeAmount\(l\.amount\)/.test(src09));
  const settle = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  check("공용 normalizeAmount의 정의가 한 글자도 바뀌지 않았다",
    /export function normalizeAmount\(amount: number\): number \{\n\s*return Number\.isFinite\(amount\) \? Math\.max\(0, Math\.floor\(amount\)\) : 0;\n\}/.test(settle));
}

console.log("\n[G-26] 13. 반환 객체와 소스 계약");
{
  const guards = readFileSync("src/lib/insurance/engine/itemGuards.ts", "utf8");
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  const item = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const roomCode = code(room), itemCode = code(item);
  check("공용 isNum이 삭제됐다", !/export const isNum/.test(guards)
    && !/\bisNum\b/.test(roomCode) && !/\bisNum\b/.test(itemCode));
  check("진료비 전용 가드가 공용 파일에 하나 있다",
    /export const isClaimAmount = \(v: unknown\): v is number =>\n\s*typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0;/.test(guards));
  check("세 자리가 모두 그 가드를 쓴다",
    (roomCode.match(/isClaimAmount\(/g) ?? []).length === 1
    && (itemCode.match(/isClaimAmount\(/g) ?? []).length === 2,
    `${(roomCode.match(/isClaimAmount\(/g) ?? []).length} + ${(itemCode.match(/isClaimAmount\(/g) ?? []).length}`);
  check("상급병실료의 두 금액 축 가드는 분리된 채로 남았다",
    /const nonNegSafeInt = /.test(roomCode) && (roomCode.match(/nonNegSafeInt\(/g) ?? []).length === 2);
  check("세 자리 모두 컨테이너 → 원소 → 합계 순이다",
    /Array\.isArray\(raw\.stays\)[\s\S]{0,1400}isClaimAmount\(total\)[\s\S]{0,900}Number\.isSafeInteger\(stayTotalSum\)/.test(roomCode)
    && /Array\.isArray\(raw\.lines\)[\s\S]{0,900}isClaimAmount\(amount\)[\s\S]{0,900}Number\.isSafeInteger\(lineSum\)/.test(itemCode)
    && /Array\.isArray\(raw\.amounts\)[\s\S]{0,700}isClaimAmount\(amount\)[\s\S]{0,700}Number\.isSafeInteger\(generalSum\)/.test(itemCode));
  check("검증한 값을 본체에 넘긴다(다시 읽지 않는다)",
    /stayTotals: number\[\];/.test(room) && /const total = checked\.stayTotals\[index\];/.test(roomCode)
    // ⚠ **낡은 앵커를 교체했다(G-28).** `CheckedAmounts`에 승인 구간 축(`acts`)이 더해져
    //   여러 줄이 됐다. 진료비를 그대로 돌려준다는 G-26의 계약은 그대로다.
    && /type CheckedAmounts = \{\n\s*amounts: number\[\];/.test(item)
    && /const amount = amounts\[index\];/.test(itemCode)
    && /const totalAmount = amounts\.reduce\(\(a, b\) => a \+ b, 0\);/.test(itemCode));
  check("세 자리에서 normalizeAmount 호출이 사라졌다",
    !/normalizeAmount\(/.test(roomCode) && !/normalizeAmount\(/.test(itemCode));
  check("일반 전환 경로가 검증된 배열을 하류에 넘긴다",
    /calculateRoutedGeneral2026\(input: Gen2026RoutedGeneralInput, amounts: number\[\]\)/.test(itemCode)
    && !/amounts: input\.amounts/.test(itemCode));
  // 반환 객체 계약.
  const rej = A([-1]);
  check("거부 반환 객체가 종전 형태 그대로",
    !threw(rej) && rej.r.route === "rejected" && rej.r.generation === "2026"
    && Array.isArray(rej.r.appliedCaps) && (rej.r.appliedCaps as unknown[]).length === 0
    && ((rej.r.notes as string[]) ?? []).length === 2, shape(rej));
  check("거부 안내가 '받은 값'을 안전 표시로 싣는다(직접 JSON.stringify 아님)",
    ((A([1n]) as { r: Res }).r.notes as string[])[1]?.startsWith("받은 값:"));
  check("bigint·순환 참조에서도 예외가 아니라 안내로 끝난다",
    isRejected(A([1n])) && isRejected(B([circ])) && isRejected(C([Symbol("s")])));
  // 안내 문구는 바꾸지 않았다.
  check("A의 원소 안내 문구가 종전 그대로",
    note0(A([-1])) === "1번째 입원의 상급병실료 차액(roomChargeTotal) 값이 올바르지 않아 계산하지 않았습니다.");
  check("B의 원소 안내 문구가 종전 그대로",
    note0(B([-1])) === "1번째 행의 진료비(amount) 값이 올바르지 않아 계산하지 않았습니다.");
}

console.log(`\n[G-26 5세대 진료비 축 값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
