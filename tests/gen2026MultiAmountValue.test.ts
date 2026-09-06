// G-27 — 5세대 다회 진입점 `calculateMany2026`의 진료비(`amounts`) 입력 계약.
//   G-26이 **네 번째 진료비 자리**로 확정하고 의도적으로 남겨 둔 항목을 닫는다.
//
// 종전 동작(기준선 a090359 — UI 미경유 엔진 직접 호출로 실측):
//   첫 줄이 `const amounts = (input.amounts ?? []).map(normalizeAmount);`였다. **검증이
//   전혀 없었다.**
//     - 컨테이너: `undefined`·`null`이 **빈 묶음**으로 조용히 통과했고(타입은 `amounts: number[]`
//       필수인데도), 객체·문자열·숫자·불리언·함수·비배열 iterable은 **런타임 TypeError**였다.
//     - 원소: 음수·음수 소수·양수 소수·NaN·±Infinity·문자열·불리언·객체·배열·bigint·Symbol·
//       함수·순환 참조·`null`·`undefined`가 **전부 0원 행**이 됐고, `300000.9`는 300,000으로
//       내림, `MAX_SAFE + 1`은 무검증 통과였다.
//     - 합계: 검사가 없어 `[MAX_SAFE, 1]`이 통과하고 총액이 정밀도를 잃었다.
//     - 혼합: `[300000, "abc"]`가 **부분합 300,000과 없던 0원 행**을 함께 노출했다.
//     - 그리고 그 합계가 `blocked()`의 `totalAmount`로 그대로 나갔다 — 검증되지 않은 입력에서
//       만든 부분합이 차단 결과에 실렸다(실측: 카운터 미입력 + `[300000,"abc"]` → amt 300,000).
//
// ⚠ **유지한 계약**: 정상 양의 안전 정수, 빈 배열(유효한 빈 묶음), 숫자 `0`(유효한 청구 행),
//   5세대에서 0원 행이 통원 횟수·일수를 **소진하지 않는다**는 계약, 검증을 통과한 뒤의
//   `blocked()`(진료비 합계 보존)와 그 안내들, 산식·공제·한도·지급보험금·카운터·모든 HOLD.
//   ⚠ 공용 `normalizeAmount`는 한 글자도 바꾸지 않았다. 이 파일에서 사용처가 사라져 import만 지웠다.
//
// ⚠ **의도한 전환 2건**: ①`undefined`·`null`이 빈 묶음에서 차단으로 바뀐다.
//   ②진료비 검사가 **모든 preflight보다 앞**에 오므로, 진료비와 다른 축이 **함께** 무효인
//   호출에서 안내가 진료비 쪽으로 바뀐다. 4세대 G-16이 같은 이유로 같은 자리를 골랐고,
//   그렇게 해야 `blocked()`의 총액이 항상 검증된 값에서 나온다.
import { readFileSync } from "node:fs";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";

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
const amtOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalAmount as number | null);
const insOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalInsurancePay as number | null);
const rowsN = (x: Caught) => threw(x) ? -1 : (x.r.lines as unknown[]).length;
const rowAmts = (x: Caught) => threw(x) ? "THROW"
  : (x.r.lines as { amount?: unknown }[]).map((l) => String(l.amount)).join(",");
const notes = (x: Caught) => threw(x) ? [] : ((x.r.notes as string[]) ?? []);
const note0 = (x: Caught) => notes(x)[0] ?? "";
const caps = (x: Caught) => threw(x) ? "THROW"
  : (x.r.lines as { appliedCaps?: string[] }[]).flatMap((l) => l.appliedCaps ?? []).join("+");

/** 신뢰할 수 있는 총액이 **없을 때**의 차단 — 부분합도 부분 행도 노출하지 않는다. */
const isUnusable = (x: Caught) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === 0 && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0
  && Array.isArray(x.r.appliedCaps) && (x.r.appliedCaps as unknown[]).length === 0
  && x.r.generation === "2026";
/** 진료비 검증을 통과한 뒤 **다른 이유**로 막힌 차단 — 진료비 합계를 보존한다. */
const isBlocked = (x: Caught, total: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === total && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const MAX = Number.MAX_SAFE_INTEGER;
const circ: Record<string, unknown> = {}; circ.self = circ;
type Any = Record<string, unknown>;
const M = (amounts: unknown, over: Any = {}) => wrap(() => calculateMany2026({
  cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "non_critical",
  nonBenefitItem: "general", amounts, priorAnnualOutpatientDays: 0, ...over } as never));

console.log("\n[G-27] 1. 정상 양의 안전 정수 — 무회귀");
for (const [l, v, wantIns] of [["1", 1, 0], ["300,000", 300_000, 150_000],
  ["1,000,000", 1_000_000, 500_000]] as [string, number, number][]) {
  const x = M([v]);
  check(`${l}: 계산된다`, statusOf(x) === "OK" && amtOf(x) === v && insOf(x) === wantIns, `${statusOf(x)}/${amtOf(x)}/${insOf(x)}`);
  check(`${l}: 행 금액이 입력 그대로다`, rowAmts(x) === String(v), rowAmts(x));
}
check("여러 행의 총액이 입력 합계와 같다", amtOf(M([300_000, 700_000])) === 1_000_000);
check("MAX_SAFE 한 행은 종전대로 통과", statusOf(M([MAX])) === "OK" && amtOf(M([MAX])) === MAX);

console.log("\n[G-27] 2. 명시적 숫자 0 — 유효한 청구 행(무회귀)");
{
  check("0 한 행 → OK · 행이 남는다", statusOf(M([0])) === "OK" && rowAmts(M([0])) === "0");
  check("-0도 종전대로 0과 같다", rowAmts(M([-0])) === "0" && amtOf(M([-0])) === 0);
  check("[0, 300000] → 두 행 · 총액 300,000", rowsN(M([0, 300_000])) === 2 && amtOf(M([0, 300_000])) === 300_000);
  check("[300000, 0] → 두 행 · 총액 300,000", rowsN(M([300_000, 0])) === 2 && amtOf(M([300_000, 0])) === 300_000);
  check("모두 0원인 배열 → OK · 행 수 유지 · 총액 0",
    statusOf(M([0, 0, 0])) === "OK" && rowsN(M([0, 0, 0])) === 3 && amtOf(M([0, 0, 0])) === 0);
}

console.log("\n[G-27] 3. 빈 배열 — 유효한 빈 묶음(무회귀)");
{
  const e = M([]);
  check("빈 배열 → OK · 총액 0 · 행 0", statusOf(e) === "OK" && amtOf(e) === 0 && rowsN(e) === 0);
  check("빈 배열은 차단이 아니다", !isUnusable(e));
  check("빈 배열의 안내가 종전대로 계산 안내다", note0(e).startsWith("각 행을 발생 순서대로 계산했습니다"), note0(e));
}

console.log("\n[G-27] 4. undefined·null — 빈 묶음에서 차단으로 (의도된 전환)");
for (const [l, v] of [["undefined", undefined], ["null", null]] as [string, unknown][]) {
  const x = M(v);
  check(`컨테이너 ${l} → 차단(총액 0 · 행 0)`, isUnusable(x), `${statusOf(x)}/${amtOf(x)}/${rowsN(x)}`);
  check(`컨테이너 ${l}: 안내가 배열을 요구한다`,
    note0(x) === "진료비 목록(amounts)은 배열이어야 합니다. 청구가 없는 묶음은 빈 배열로 넘겨 주세요.", note0(x));
  check(`컨테이너 ${l}: 미제공과 '청구 없음'을 구분한다고 말한다`,
    notes(x)[1]?.includes("넘기지 않은 것과 청구가 없다는 것은 다른 상태"), notes(x)[1]);
  check(`컨테이너 ${l}: 받은 값을 형식으로만 표시한다`, notes(x)[2] === `받은 값의 형식: ${typeof v}`, notes(x)[2]);
}

console.log("\n[G-27] 5. 비배열 컨테이너 — 예외에서 안전한 차단으로");
for (const [l, v] of [["객체", {}], ["문자열", "abc"], ["숫자", 1], ["true", true], ["false", false],
  ["함수", () => 1], ["Symbol", Symbol("s")], ["bigint", 1n], ["Date", new Date(0)],
  ["iterable(비배열)", { *[Symbol.iterator]() { yield 1; }, length: 1 }],
  ["유사 배열", { 0: 300_000, length: 1 }], ["순환 참조", circ]] as [string, unknown][]) {
  const x = M(v);
  check(`컨테이너 ${l} → 예외가 아니라 차단`, isUnusable(x), threw(x) ? "THROW:" + x.threw : statusOf(x));
}
check("Proxy 배열은 종전대로 배열로 통과한다", statusOf(M(new Proxy([300_000], {}))) === "OK");

console.log("\n[G-27] 6. 무효 원소 — 0원 행 변환에서 차단으로");
const BAD: [string, unknown][] = [
  ["음수 -1", -1], ["음수 -300000", -300_000], ["음수 소수 -0.5", -0.5],
  ["양수 소수 0.5", 0.5], ["양수 소수 300000.9", 300_000.9],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["숫자 문자열", "300000"], ["빈 문자열", ""], ["공백", " "], ["지수 문자열", "3e5"], ["쉼표 문자열", "300,000"],
  ["null", null], ["undefined", undefined], ["true", true], ["false", false],
  ["객체", {}], ["중첩 배열", [1]], ["bigint", 1n], ["Symbol", Symbol("s")], ["함수", () => 1], ["순환 참조", circ],
];
for (const [l, v] of BAD) {
  const x = M([v]);
  check(`원소 ${l} → 차단(0원 행이 되지 않는다)`, isUnusable(x), `${statusOf(x)}/${amtOf(x)}/${rowAmts(x)}`);
}
check("원소 안내가 몇 번째인지 지목한다", note0(M([300_000, -1])).startsWith("2번째 진료비는 0 이상의 안전한 정수여야 합니다"), note0(M([300_000, -1])));
check("원소 안내가 0원으로 바꾸지 않는다고 말한다",
  notes(M([-1]))[1] === "잘못된 값을 0원으로 바꾸지 않습니다 — 입력하지 않은 0원 행이 생겨 총액과 행 목록이 입력과 달라집니다.",
  notes(M([-1]))[1]);
check("원소 안내가 받은 값을 형식으로만 표시한다", notes(M([-1]))[2] === "1번째 받은 값의 형식: number", notes(M([-1]))[2]);
check("원소 안내가 위험 방향을 단정하지 않는다", !/과다|과소|많이|적게/.test(notes(M([-1])).join(" ")));
check("bigint·Symbol·순환 참조에서도 예외가 아니라 안내로 끝난다",
  isUnusable(M([1n])) && isUnusable(M([Symbol("s")])) && isUnusable(M([circ])));

console.log("\n[G-27] 7. 안전 정수 초과 원소 — 차단");
check("MAX_SAFE+1 → 차단", isUnusable(M([MAX + 1])), `${statusOf(M([MAX + 1]))}/${amtOf(M([MAX + 1]))}`);
check("1e300 → 차단", isUnusable(M([1e300])));
check("MAX_SAFE는 종전대로 통과", statusOf(M([MAX])) === "OK");

console.log("\n[G-27] 8. 합계 안전 정수 초과 — 차단 신설");
{
  check("[MAX_SAFE, 0] → 합계가 안전하므로 통과", statusOf(M([MAX, 0])) === "OK" && amtOf(M([MAX, 0])) === MAX);
  const over1 = M([MAX, 1]), over2 = M([MAX, MAX]);
  check("[MAX_SAFE, 1] → 차단", isUnusable(over1), `${statusOf(over1)}/${amtOf(over1)}`);
  check("[MAX_SAFE, MAX_SAFE] → 차단", isUnusable(over2));
  check("합계 안내가 원소 안내와 구분된다",
    note0(over1) === "진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다. 각 행이 안전한 정수여도 합계는 벗어날 수 있습니다.", note0(over1));
  check("합계 안내가 행 수를 알려준다", notes(over1)[1] === "받은 행 수: 2", notes(over1)[1]);
  check("[MAX_SAFE-1, 1]은 통과", statusOf(M([MAX - 1, 1])) === "OK");
}

console.log("\n[G-27] 9. 혼합 묶음 — 부분합·부분 행 금지");
for (const [l, a] of [["[정상, 무효]", [300_000, "abc"]], ["[무효, 정상]", ["abc", 300_000]],
  ["[정상, 무효, 정상]", [300_000, -1, 700_000]], ["[정상, 정상, 무효]", [300_000, 700_000, NaN]],
  ["[0, 무효]", [0, 0.5]]] as [string, unknown[]][]) {
  const x = M(a);
  check(`${l} → 총액 0`, amtOf(x) === 0, String(amtOf(x)));
  check(`${l} → 유효 행을 노출하지 않는다`, rowsN(x) === 0 && rowAmts(x) === "", rowAmts(x));
  check(`${l} → 차단 계약 그대로`, isUnusable(x));
}

console.log("\n[G-27] 10. 통원 일수 경계 — 무회귀");
{
  const D = (a: number[], p: number) => M(a, { priorAnnualOutpatientDays: p });
  check("정상 2행 prior 98 → 두 행 모두 지급", insOf(D([300_000, 300_000], 98)) === 300_000, String(insOf(D([300_000, 300_000], 98))));
  check("정상 2행 prior 99 → 두 번째 행이 한도 초과", insOf(D([300_000, 300_000], 99)) === 150_000
    && caps(D([300_000, 300_000], 99)).includes("GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS"), caps(D([300_000, 300_000], 99)));
  check("prior 100 → 정상 행이 전부 한도 초과", insOf(D([300_000], 100)) === 0);
}

console.log("\n[G-27] 11. 0원 행의 비소진 계약 — 무회귀");
{
  const D = (a: number[], p: number) => M(a, { priorAnnualOutpatientDays: p });
  check("0원 행은 통원 일수를 소진하지 않는다(prior 99에서 정상 행 지급)",
    insOf(D([0, 300_000], 99)) === 150_000 && caps(D([0, 300_000], 99)) === "", caps(D([0, 300_000], 99)));
  check("양수 뒤의 0원 행도 소진하지 않는다", insOf(D([300_000, 0], 99)) === 150_000 && caps(D([300_000, 0], 99)) === "");
  check("0원 3행 prior 100 → 계산되고 한도 표시가 붙지 않는다",
    statusOf(D([0, 0, 0], 100)) === "OK" && caps(D([0, 0, 0], 100)) === "");
  const src = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("소진 판정이 종전대로 amount > 0을 요구한다", /const consumes = amount > 0 &&/.test(src));
}

console.log("\n[G-27] 12. 검증 통과 후의 blocked() — 진료비 합계 보존(무회귀)");
{
  const cases: [string, unknown[], Any, number, string][] = [
    ["카운터 미입력", [300_000, 300_000], { priorAnnualOutpatientDays: undefined }, 600_000, "비중증 통원은 계약해당일 기준"],
    ["카운터 무효값", [300_000], { priorAnnualOutpatientDays: -1 }, 300_000, "이미 사용한 통원일수는 0 이상의 정수"],
    ["카운터 축 교차", [300_000], { severity: "critical", priorAnnualOutpatientDays: 0 }, 300_000, "중증 통원의 연간 한도는"],
    ["치료유형 무효", [300_000], { nonBenefitItem: "mri", severity: "critical", priorAnnualOutpatientVisits: 0 }, 300_000, "비급여 MRI는 현재 계산 대상이"],
    ["레거시 필드", [300_000], { priorAnnualPaid: 0 }, 300_000, "priorAnnualPaid는 2·3세대"],
    ["별도 축 stray", [300_000], { priorAnnualCoveredCount: 0 }, 300_000, "priorAnnualCoveredCount"],
    ["입원에 카운터", [300_000], { visit: "inpatient", tier: "clinic" }, 300_000, "통원 횟수·일수 카운터는 입원 계산에"],
  ];
  for (const [l, a, over, total, want] of cases) {
    const x = M(a, over);
    check(`${l}: 진료비 합계 ${total.toLocaleString("ko-KR")}가 보존된다`, isBlocked(x, total), `${statusOf(x)}/${amtOf(x)}/${rowsN(x)}`);
    check(`${l}: 안내가 종전 그대로`, note0(x).includes(want), note0(x).slice(0, 50));
  }
  check("빈 배열에서도 blocked()의 총액은 0이다(부분합이 아니라 실제 합계)",
    isBlocked(M([], { priorAnnualOutpatientDays: undefined }), 0));
}

console.log("\n[G-27] 13. 안내 우선순위 — 진료비가 앞선다(의도된 전환)");
{
  const PRE: [string, Any, string][] = [
    ["레거시 필드", { priorAnnualPaid: 0 }, "priorAnnualPaid는"],
    ["별도 축 stray", { priorAnnualCoveredCount: 0 }, "priorAnnualCoveredCount"],
    ["치료유형 무효", { nonBenefitItem: "mri", severity: "critical", priorAnnualOutpatientVisits: 0 }, "비급여 MRI는"],
    ["카운터 미입력", { priorAnnualOutpatientDays: undefined }, "비중증 통원은"],
    ["카운터 축 교차", { severity: "critical", priorAnnualOutpatientDays: 0 }, "중증 통원의"],
  ];
  for (const [l, over, otherNote] of PRE) {
    const bad = M([300_000, "abc"], over), good = M([300_000], over);
    check(`${l} + 진료비 무효 → 진료비 안내가 먼저`, note0(bad).startsWith("2번째 진료비는"), note0(bad).slice(0, 40));
    check(`${l} + 진료비 무효 → 부분합을 노출하지 않는다`, isUnusable(bad), `${amtOf(bad)}`);
    check(`${l} + 진료비 정상 → 종전 안내 그대로`, note0(good).includes(otherNote), note0(good).slice(0, 40));
  }
  check("컨테이너 무효도 다른 축보다 앞선다",
    note0(M(null, { priorAnnualCoveredCount: 0 })).startsWith("진료비 목록(amounts)은 배열이어야"));
}

console.log("\n[G-27] 14. 접근자 — 정확히 1회, 예외 계약 무회귀");
{
  const withArr = (get: () => unknown, over: Any = {}) => {
    const n = { v: 0 };
    const a: unknown[] = [];
    Object.defineProperty(a, "0", { enumerable: true, configurable: true, get() { n.v++; return get(); } });
    a.length = 1;
    return { n, x: M(a, over) };
  };
  const ok = withArr(() => 300_000);
  check("정상 경로에서 정확히 1회 읽는다", ok.n.v === 1, String(ok.n.v));
  check("무효값도 1회만 읽는다", withArr(() => -1).n.v === 1);
  // ⚠ 기준선에는 **선행 preflight에서 0회**인 경로가 없었다 — 첫 줄에서 항상 읽었다.
  //   진료비 검사가 맨 앞으로 오면서도 읽는 횟수는 종전과 같은 1회다(측정으로 고정한다).
  for (const [l, over] of [["레거시", { priorAnnualPaid: 0 }], ["별도 축 stray", { priorAnnualCoveredCount: 0 }],
    ["치료유형 무효", { nonBenefitItem: "mri", severity: "critical", priorAnnualOutpatientVisits: 0 }],
    ["카운터 미입력", { priorAnnualOutpatientDays: undefined }]] as [string, Any][]) {
    check(`${l} 경로에서도 1회다(종전과 같다)`, withArr(() => 300_000, over).n.v === 1, String(withArr(() => 300_000, over).n.v));
  }
  {
    let i = 0;
    const g = withArr(() => [300_000, 900_000][Math.min(i++, 1)]);
    check("변하는 getter — 첫 값 하나만 검증·계산에 쓰인다",
      g.n.v === 1 && amtOf(g.x) === 300_000 && rowAmts(g.x) === "300000", `${g.n.v}/${amtOf(g.x)}`);
  }
  check("던지는 getter는 종전대로 전파된다", threw(withArr(() => { throw new Error("boom"); }).x));
  check("던지는 getter + 다른 축 무효도 종전대로 전파된다",
    threw(withArr(() => { throw new Error("boom"); }, { priorAnnualCoveredCount: 0 }).x));
  const pxThrow = new Proxy([300_000], { get(t, p, r) { if (p === "length") throw new Error("len boom"); return Reflect.get(t, p, r); } });
  check("Proxy의 length 예외는 종전대로 전파된다(새로 포착하지 않는다)", threw(M(pxThrow)));
}

console.log("\n[G-27] 15. 범위 밖 — G-26의 세 경로와 다른 세대는 그대로");
{
  const RC = (a: unknown[]) => wrap(() => calculateGen2026Item({
    route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
    stays: a.map((v) => ({ roomChargeTotal: v, inpatientDays: 5 })) } as never));
  const SI = (a: unknown[]) => wrap(() => calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "general", lines: a.map((v) => ({ amount: v, visit: "outpatient" })),
    priorAnnualCoveredCount: 0 } as never));
  const RG = (a: unknown) => wrap(() => calculateGen2026Item({
    route: "general", coverage: "non_benefit", severity: "non_critical", item: "musculoskeletal_esw",
    cause: "disease", visit: "outpatient", amounts: a, priorAnnualOutpatientDays: 0 } as never));
  for (const [l, f] of [["상급병실료", RC], ["별도 보장종목", SI]] as [string, (a: unknown[]) => Caught][]) {
    check(`${l}: 정상 계산 그대로`, statusOf(f([300_000])) === "OK");
    check(`${l}: 무효 원소는 종전대로 rejected(총액 0)`,
      !threw(f([-1])) && (f([-1]) as { r: Res }).r.route === "rejected" && amtOf(f([-1])) === 0);
    check(`${l}: 0원 행은 종전대로 유효`, statusOf(f([0])) === "OK");
  }
  check("일반 전환 경로: 정상 계산 그대로", statusOf(RG([300_000])) === "OK" && amtOf(RG([300_000])) === 300_000);
  check("일반 전환 경로: 무효 원소는 종전대로 rejected",
    !threw(RG([-1])) && (RG([-1]) as { r: Res }).r.route === "rejected");
  check("일반 전환 경로: 검증된 배열이 이 엔진에 그대로 전달된다(이중 검증이 결과를 바꾸지 않는다)",
    statusOf(RG([0, 300_000])) === "OK" && amtOf(RG([0, 300_000])) === 300_000);
  const settle = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  check("공용 normalizeAmount의 정의가 한 글자도 바뀌지 않았다",
    /export function normalizeAmount\(amount: number\): number \{\n\s*return Number\.isFinite\(amount\) \? Math\.max\(0, Math\.floor\(amount\)\) : 0;\n\}/.test(settle));
  const src21 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("4세대 진료비 계약(G-16)이 그대로", src21.includes("진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다."));
  const src09 = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("2·3세대는 종전대로 normalizeAmount를 쓴다", /normalizeAmount\(l\.amount\)/.test(src09));
}

console.log("\n[G-27] 16. 구조 계약");
{
  const src = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("amounts ?? [] 폴백이 사라졌다", !/input\.amounts \?\? \[\]/.test(code));
  check("normalizeAmount를 더 이상 쓰지 않는다", !/normalizeAmount/.test(code));
  check("전용 실패 반환 unusable()이 있다",
    /const unusable = \(notes: string\[\]\): MultiClaimResult => \(\{[\s\S]{0,200}totalAmount: 0,/.test(code));
  check("blocked()는 진료비 합계를 그대로 보존한다",
    /const blocked = \(notes: string\[\]\): MultiClaimResult => \(\{[\s\S]{0,200}totalAmount, totalOwnPay: null/.test(code));
  check("컨테이너 → 원소 → 합계 순이다",
    /Array\.isArray\(rawAmounts\)[\s\S]{0,900}isClaimAmount\(v\)[\s\S]{0,900}Number\.isSafeInteger\(totalAmount\)/.test(code));
  check("검증이 모든 preflight보다 앞이다",
    code.indexOf("Array.isArray(rawAmounts)") < code.indexOf("SPECIAL_ITEM_ONLY_KEYS.find")
    && code.indexOf("Number.isSafeInteger(totalAmount)") < code.indexOf("const probe = calc2026("));
  check("각 원소를 한 번만 읽어 지역 배열에 담는다",
    /const v: unknown = rawAmounts\[i\];/.test(code) && (code.match(/rawAmounts\[/g) ?? []).length === 1
    && /amounts\.push\(v\);/.test(code));
  check("계산은 검증된 배열만 쓴다", !/input\.amounts/.test(code.replace("(input as { amounts?: unknown }).amounts", "")));
  // 두 가드의 본문이 조용히 갈라지지 않는지 서로 대조한다.
  const guards = readFileSync("src/lib/insurance/engine/itemGuards.ts", "utf8");
  const body = (s: string) => (s.match(/isClaimAmount = \(v: unknown\): v is number =>\s*\n?\s*(typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0;)/) ?? [])[1];
  check("진료비 술어가 itemGuards의 것과 본문이 같다", body(src) !== undefined && body(src) === body(guards),
    `${body(src)} ||| ${body(guards)}`);
  check("이 파일은 itemGuards를 import하지 않는다(모듈 경계 계약 유지)", !/from "\.\/itemGuards"/.test(code));
  check("지역 showValue가 그대로 있다", /const showValue = \(v: unknown\): string => \{/.test(code));
  check("통원 카운터 가드 badCount는 진료비 가드와 분리된 채로 남았다",
    /const badCount = /.test(code) && !/badCount\(v\)/.test(code));
}

console.log(`\n[G-27 5세대 다회 진료비 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
