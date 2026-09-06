// G-33 — 제네릭 `calculate()`의 **이전 세대 경로에서 5세대 전용 입력 축 거부**.
//   G-30이 미사용 금액 축을, G-31이 미사용 비금액 축을, G-32가 소비 축의 값 검증을 닫았다.
//   모두 5세대 진입점 안의 일이었고, 여기서는 **세대 라우터**의 계약을 세운다.
//
// 전수 행렬 (기준선 `a3017ca`, UI 미경유 엔진 직접 호출 + 접근자 계수, 20경로).
// | 세대 | 경로 | nhis | severity | nonBenefitItem | priorAnnualDeductible | perVisitCoverageLimit |
// | 2009 | 통원 4경로(급여·비급여 × 표준·선택) | 0회 | 0회 | 0회 | 0회 | **1회 소비** |
// | 2009 | 입원 4경로 | 0회 | 0회 | 0회 | 0회 | **0회 폐기** |
// | 2017 | 통원 4경로 | 0회 | 0회 | 0회 | 0회 | **1회 소비** |
// | 2017 | 입원 4경로 | 0회 | 0회 | 0회 | 0회 | **0회 폐기** |
// | 2021 | 4경로 | 0회 | 0회 | 0회 | 0회 | **0회 폐기** |
//
// ⚠ `perVisitCoverageLimit`은 **세대·경로별로 의미가 다르다.** 2·3세대 통원은 약관의
//   회(건)당 가입금액으로 **실제 소비**한다(값 200,000에서 결과가 달라지고 `appliedCaps`에
//   `GEN2009_PER_VISIT_COVERAGE_LIMIT`이 실린다). 이름이 같다고 거부 목록에 넣지 않는다.
// ⚠ `priorAnnualDeductible`(5세대 공제금액 누적)과 `priorAnnualPaid`(2·3세대 자기부담금
//   누적)는 **다른 축**이다. 누적 대상이 공제금액이냐 자기부담금이냐가 다르므로 합치지 않는다.
//
// 목표 계약: `undefined`는 미제공과 동일 / 그 밖은 숫자 `0`도 포함해 명시적 거부 /
//   세대 선택과 기존 선행 preflight가 먼저 결과를 정하면 **읽지 않음** / 각 축을 한 번만 읽음 /
//   세대별 반환 계약과 **검증된 진료비(`amount`) 보존** / 안내는 `typeof`만 싣는 안전 표시 /
//   기존 안내 우선순위 보존 / 5세대 진입점과 세대별 직접 진입점은 **손대지 않음** /
//   산식·규칙값·한도·HOLD·화면 정책 불변.
import { readFileSync } from "node:fs";
import { calculate } from "../src/lib/insurance/engine/engine";
import { calcStandardized } from "../src/lib/insurance/engine/generationStandardized";
import { calc2021 } from "../src/lib/insurance/engine/generation2021";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import type { ClaimInput, Generation } from "../src/lib/insurance/engine/types";
import type { LegacyClaimInput } from "../src/lib/insurance/engine/engine";

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
const note0 = (x: Caught) => threw(x) ? "" : (((x.r.notes as string[]) ?? [])[0] ?? "");
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw : JSON.stringify([
  x.r.status, x.r.generation, x.r.amount, x.r.ownPay, x.r.insurancePay,
  x.r.rateApplied, x.r.minDeductible, x.r.rateBased, x.r.appliedCaps, x.r.notes,
]);
/** 이 라우터의 차단 계약 — 세대와 **검증된 진료비**를 보존하고 금액을 만들지 않는다. */
const isRejected = (x: Caught, gen: string, amount: number) => !threw(x)
  && x.r.status === "PENDING_UNVERIFIED" && x.r.generation === gen && x.r.amount === amount
  && x.r.ownPay === null && x.r.insurancePay === null
  && x.r.rateApplied === null && x.r.minDeductible === null && x.r.rateBased === null
  && Array.isArray(x.r.appliedCaps) && (x.r.appliedCaps as unknown[]).length === 0;

const A = 300_000;
const circ: Any = {}; circ.self = circ;
/** 브라우저가 만들 수 없는 값도 **엔진 직접 호출**로만 넣는다(공개 화면 주입 아님). */
const VALUES: [string, unknown][] = [
  ["0", 0], ["-0", -0], ["1", 1], ["null", null], ["''", ""], ["문자열", "x"], ["true", true],
  ["false", false], ["객체", { a: 1 }], ["배열", [1]], ["NaN", NaN], ["Infinity", Infinity],
  ["bigint", 10n], ["Symbol", Symbol("s")], ["함수", () => 1], ["순환 참조", circ],
  ["Date", new Date(0)], ["toString이 던지는 객체", { toString() { throw new Error("x"); } }],
];
/** 이전 세대가 어느 경로에서도 쓰지 않는 5세대 전용 축. 목록 순서가 안내 우선순위다. */
const FOUR = ["nhisCoinsuranceRate", "severity", "nonBenefitItem", "priorAnnualDeductible"] as const;
const NORMAL: Record<string, unknown> = {
  nhisCoinsuranceRate: 0.2, severity: "critical", nonBenefitItem: "general",
  priorAnnualDeductible: 1_000_000, perVisitCoverageLimit: 200_000,
};

const STD: Record<string, Any> = {};
for (const cov of ["benefit", "non_benefit"]) for (const v of ["outpatient", "inpatient"]) for (const pl of ["standard", "selective"]) {
  STD[`${cov}·${v}·${pl}`] = { amount: A, coverage: cov, visit: v, plan: pl, facility: v === "outpatient" ? "clinic" : undefined };
}
const G21: Record<string, Any> = {};
for (const cov of ["benefit", "non_benefit"]) for (const v of ["outpatient", "inpatient"]) {
  G21[`${cov}·${v}`] = { amount: A, coverage: cov, visit: v, tier: "clinic" };
}
const f = (g: Generation, i: Any) => wrap(() => calculate(g, i as unknown as ClaimInput));

console.log("\n[G-33] 1. 이전 세대가 쓰지 않는 네 축은 값과 무관하게 거부한다");
{
  for (const gen of ["2009", "2017"] as const) for (const [n, b] of Object.entries(STD)) for (const key of FOUR) {
    const r = f(gen, { ...b, [key]: NORMAL[key] });
    check(`${gen} ${n} · ${key} → 거부`, isRejected(r, gen, A)
      && note0(r).startsWith(`${gen}세대: `) && note0(r).includes(key), `${statusOf(r)} ${note0(r).slice(0, 26)}`);
  }
  for (const [n, b] of Object.entries(G21)) for (const key of FOUR) {
    const r = f("2021", { ...b, [key]: NORMAL[key] });
    check(`2021 ${n} · ${key} → 거부`, isRejected(r, "2021", A) && note0(r).includes(key), statusOf(r));
  }
  // 값 격자 — 숫자 0을 포함해 undefined가 아닌 모든 값을 막는다.
  for (const key of FOUR) for (const [vn, v] of VALUES) {
    const r9 = f("2009", { ...STD["non_benefit·outpatient·standard"], [key]: v });
    const r21 = f("2021", { ...G21["non_benefit·outpatient"], [key]: v });
    check(`2009 통원 · ${key} + ${vn} → 거부`, isRejected(r9, "2009", A), statusOf(r9));
    check(`2021 통원 · ${key} + ${vn} → 거부`, isRejected(r21, "2021", A), statusOf(r21));
  }
}

console.log("\n[G-33] 2. perVisitCoverageLimit은 세대·경로별로 다르게 다룬다");
{
  // 2·3세대 통원 — 실제 소비. 거부하지 않는다.
  for (const gen of ["2009", "2017"] as const) for (const [n, b] of Object.entries(STD)) {
    if (!n.includes("outpatient")) continue;
    const withLimit = f(gen, { ...b, perVisitCoverageLimit: 200_000 });
    const without = f(gen, b);
    check(`${gen} ${n} · perVisit 200,000은 소비된다`, statusOf(withLimit) === "OK"
      && shape(withLimit) !== shape(without), statusOf(withLimit));
    check(`${gen} ${n} · 한도 CapCode가 실린다`, !threw(withLimit)
      && (withLimit.r.appliedCaps as string[]).includes(`GEN${gen}_PER_VISIT_COVERAGE_LIMIT`),
      JSON.stringify(threw(withLimit) ? [] : withLimit.r.appliedCaps));
    // 0·음수·무효값은 종전대로 "미입력"으로 보고 계산을 계속한다(이 커밋이 바꾸지 않는다).
    for (const v of [0, -1, NaN, "x"]) {
      check(`${gen} ${n} · perVisit ${String(v)}은 종전대로 미적용`, shape(f(gen, { ...b, perVisitCoverageLimit: v })) === shape(without));
    }
  }
  // 2·3세대 입원 — 미소비. 거부한다.
  for (const gen of ["2009", "2017"] as const) for (const [n, b] of Object.entries(STD)) {
    if (n.includes("outpatient")) continue;
    for (const [vn, v] of VALUES.slice(0, 8)) {
      const r = f(gen, { ...b, perVisitCoverageLimit: v });
      check(`${gen} ${n} · perVisit + ${vn} → 거부`, isRejected(r, gen, A)
        && note0(r).includes("perVisitCoverageLimit"), statusOf(r));
    }
  }
  // 4세대 — 전 경로 미소비(회당 한도가 약관 상수다). 거부한다.
  for (const [n, b] of Object.entries(G21)) for (const [vn, v] of VALUES.slice(0, 8)) {
    const r = f("2021", { ...b, perVisitCoverageLimit: v });
    check(`2021 ${n} · perVisit + ${vn} → 거부`, isRejected(r, "2021", A), statusOf(r));
  }
  check("4세대 통원의 20만원 한도는 그대로 적용된다",
    (() => { const r = f("2021", G21["non_benefit·outpatient"]);
      return !threw(r) && (r.r.appliedCaps as string[]).includes("GEN2021_OUTPATIENT_PER_VISIT"); })());
}

console.log("\n[G-33] 3. undefined는 미제공과 같다");
{
  for (const gen of ["2009", "2017"] as const) for (const [n, b] of Object.entries(STD))
    for (const key of [...FOUR, "perVisitCoverageLimit"]) {
      check(`${gen} ${n} · ${key} 명시적 undefined = 미제공`,
        shape(f(gen, { ...b, [key]: undefined })) === shape(f(gen, b)));
    }
  for (const [n, b] of Object.entries(G21)) for (const key of [...FOUR, "perVisitCoverageLimit"]) {
    check(`2021 ${n} · ${key} 명시적 undefined = 미제공`,
      shape(f("2021", { ...b, [key]: undefined })) === shape(f("2021", b)));
  }
}

console.log("\n[G-33] 4. 선행 preflight가 결과를 정하면 읽지 않는다");
{
  for (const gen of ["2009", "2017"] as const) for (const key of [...FOUR, "perVisitCoverageLimit"]) {
    let reads = 0;
    const o: Any = { amount: A, coverage: "non_benefit", visit: "outpatient" }; // plan 미지정
    Object.defineProperty(o, key, { get() { reads++; return NORMAL[key]; }, enumerable: true, configurable: true });
    const r = f(gen, o);
    check(`${gen} plan 미지정 · ${key}를 읽지 않는다`, reads === 0
      && note0(r).startsWith("표준형/선택형(plan) 미지정"), `reads=${reads} ${note0(r).slice(0, 24)}`);
  }
  // 던지는 getter도 선행 차단 경로에서는 조용하다.
  for (const key of FOUR) {
    const o: Any = { amount: A, coverage: "non_benefit", visit: "outpatient" };
    Object.defineProperty(o, key, { get() { throw new Error("BOOM"); }, enumerable: true, configurable: true });
    check(`2009 plan 미지정 · ${key} 던지는 getter도 조용하다`, !threw(f("2009", o)));
  }
}

console.log("\n[G-33] 5. 접근자 — 판정 지점에서 정확히 한 번 읽는다");
{
  for (const gen of ["2009", "2021"] as const) {
    const base = gen === "2009" ? STD["non_benefit·outpatient·standard"] : G21["non_benefit·outpatient"];
    for (const key of FOUR) {
      let reads = 0;
      const o: Any = { ...base };
      Object.defineProperty(o, key, { get() { reads++; return NORMAL[key]; }, enumerable: true, configurable: true });
      const r = f(gen, o);
      check(`${gen} · ${key}를 정확히 1회만 읽는다`, reads === 1 && isRejected(r, gen, A), `reads=${reads}`);
    }
    // 목록 앞 키가 먼저 나가고, 뒤 키는 읽히지 않는다.
    let laterReads = 0;
    const o: Any = { ...base, nhisCoinsuranceRate: 0.2 };
    Object.defineProperty(o, "severity", { get() { laterReads++; return "critical"; }, enumerable: true, configurable: true });
    const r = f(gen, o);
    check(`${gen} · 목록 첫 키만 안내하고 뒤 키는 읽지 않는다`,
      laterReads === 0 && note0(r).includes("nhisCoinsuranceRate"), `reads=${laterReads}`);
  }
  // 값이 변하는 getter에서도 판정과 안내가 같은 값 하나를 쓴다(형식만 싣는다).
  {
    const seq = [1, "x", {}]; let i = 0;
    const o: Any = { ...STD["non_benefit·outpatient·standard"] };
    Object.defineProperty(o, "severity", { get() { return seq[i++ % seq.length]; }, enumerable: true, configurable: true });
    check("변하는 getter도 한 번 읽은 값의 형식만 싣는다",
      note0(f("2009", o)).includes("severity") && shape(f("2009", o)).includes("PENDING_UNVERIFIED"));
  }
}

console.log("\n[G-33] 6. 반환 계약과 합계 보존");
{
  for (const gen of ["2009", "2017", "2021"] as const) {
    const base = gen === "2021" ? G21["non_benefit·outpatient"] : STD["non_benefit·outpatient·standard"];
    const r = f(gen, { ...base, severity: "critical" });
    check(`${gen} · generation과 검증된 진료비를 보존한다`, isRejected(r, gen, A));
    const zero = f(gen, { ...base, amount: 0, severity: "critical" });
    check(`${gen} · 진료비 0원도 그대로 보존한다`, isRejected(zero, gen, 0));
    const big = f(gen, { ...base, amount: 1_234_567, severity: "critical" });
    check(`${gen} · 진료비 1,234,567원을 그대로 보존한다`, isRejected(big, gen, 1_234_567));
  }
  // 소수·음수는 종전 normalizeAmount 계약대로 정리된 값이 실린다.
  const neg = f("2009", { ...STD["non_benefit·outpatient·standard"], amount: -5, severity: "critical" });
  check("음수 진료비는 종전 정규화 계약대로 0원으로 실린다", isRejected(neg, "2009", 0), shape(neg).slice(0, 50));
}

console.log("\n[G-33] 7. 안내 — 위험한 값에서도 예외가 아니라 안내로 끝난다");
{
  for (const [vn, v] of [["bigint", 10n], ["Symbol", Symbol("s")], ["순환 참조", circ],
    ["toString이 던지는 객체", { toString() { throw new Error("x"); }, toJSON() { throw new Error("y"); } }]] as [string, unknown][]) {
    check(`2009 · severity ${vn} → 예외 없이 거부`, isRejected(f("2009", { ...STD["non_benefit·outpatient·standard"], severity: v }), "2009", A));
    check(`2021 · severity ${vn} → 예외 없이 거부`, isRejected(f("2021", { ...G21["non_benefit·outpatient"], severity: v }), "2021", A));
  }
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  check("engine.ts는 받은 값 자체를 문자열로 만들지 않는다(typeof만)",
    /받은 값의 형식: \$\{typeof got\}/.test(src) && !/받은 값: \$\{/.test(src));
  check("engine.ts에 showValue를 복제하지 않았다", !/const showValue/.test(src));
}

console.log("\n[G-33] 8. 5세대와 세대별 직접 진입점은 손대지 않았다");
{
  const NB: Any = { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general" };
  check("제네릭 2026은 calc2026과 같은 결과", shape(f("2026", NB)) === shape(wrap(() => calc2026(NB as never))));
  check("2026 정상 중증 계산이 그대로", (() => { const r = f("2026", NB); return !threw(r) && r.r.ownPay === 90_000; })());
  check("2026 severity 무효는 G-32 안내 그대로",
    note0(f("2026", { ...NB, severity: "x" })).startsWith("비급여: 중증/비중증(severity)은"));
  // 직접 진입점은 stray를 보지 않는다 — 이 커밋의 범위가 아니다.
  for (const key of FOUR) {
    const std = wrap(() => calcStandardized("2009", { ...STD["non_benefit·outpatient·standard"], [key]: NORMAL[key] } as never));
    check(`calcStandardized는 ${key}를 종전대로 무시한다`, statusOf(std) === "OK");
    const d21 = wrap(() => calc2021({ ...G21["non_benefit·outpatient"], [key]: NORMAL[key] } as never));
    check(`calc2021은 ${key}를 종전대로 무시한다`, statusOf(d21) === "OK");
  }
  const manyBase = { plan: "standard", facility: "clinic", priorAnnualOutpatientVisits: 0,
    lines: [{ amount: A, visit: "outpatient" }, { amount: A, visit: "inpatient" }] };
  const many = wrap(() => calculateMany("2009", manyBase as never));
  check("2·3세대 다회는 그대로 계산한다", statusOf(many) === "OK", statusOf(many) + " " + note0(many).slice(0, 30));
  const manyStray = wrap(() => calculateMany("2009", { ...manyBase, severity: "critical" } as never));
  check("2·3세대 다회는 이 커밋의 대상이 아니다(종전 그대로)",
    shape(manyStray) === shape(many), statusOf(manyStray));
}

console.log("\n[G-33] 9. 구조 — 위치·목록·순서");
{
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  // ⚠ 아래 여섯 앵커는 G-34A에서 **기존 의미를 유지한 채 대상만 바꿨다.** 종전에는 상수 이름
  //   `LEGACY_UNUSED_GEN2026_KEYS`·`STANDARDIZED_INPATIENT_UNUSED_KEY`와 함수 이름
  //   `rejectUnusedGen2026Keys`를 직접 잡았고, "2026 경로는 stray 검사를 거치지 않는다"까지
  //   단언했다. G-34A가 이름 목록을 **세대·경로별 소유권 표**로 일반화하면서
  //     · 다섯 축 목록은 `GEN2026_ONLY_AXES`(같은 네 축·같은 순서) + 경로별 소유권으로 나뉘고,
  //     · perVisit은 "2·3세대 통원이 소비"라는 사실이 `outpatientOnly`로 옮겨 갔으며,
  //     · 2026 경로도 **다른 세대·다른 진입점의 축**은 검사하게 됐다(자기 축은 여전히 안 본다).
  //   낡은 앵커를 지우지 않고, 지키려던 성질을 새 구조 위에서 다시 잡는다.
  check("5세대 전용 네 축이 같은 순서로 상수 분리돼 있다",
    /const GEN2026_ONLY_AXES = \[\n\s*"nhisCoinsuranceRate", "severity", "nonBenefitItem", "priorAnnualDeductible",\n\] as const;/.test(src));
  check("perVisitCoverageLimit을 그 목록에 합치지 않았다",
    // ⚠ `[^\]]*`로 **선언 블록 안만** 본다. `[\s\S]*?`를 쓰면 뒤쪽 ROUTER_AXES의
    //   "perVisitCoverageLimit"까지 건너뛰어 매치돼 검사가 거짓으로 실패한다.
    !/GEN2026_ONLY_AXES = \[[^\]]*perVisitCoverageLimit[^\]]*\] as const;/.test(src));
  check("2·3세대는 통원에서 perVisit을 소비 축으로 둔다",
    /outpatientOnly: \["facility", "perVisitCoverageLimit"\],/.test(code));
  check("2021은 전 경로에서 perVisit을 소비 축에 넣지 않는다",
    /const GEN2021_OWNERSHIP: Ownership = \{[\s\S]*?\};/.exec(code)?.[0].includes("perVisitCoverageLimit") === false);
  check("위임 결과가 OK일 때만 stray를 본다 (세 세대 경로 모두)",
    (code.match(/if \(r\.status !== "OK"\) return r;/g) ?? []).length === 3);
  check("stray 거부가 위임 뒤에 온다",
    code.indexOf("calcStandardized(generation, input)") < code.indexOf("rejectUnusedAxes(generation, input, r)"));
  check("2026 경로도 위임 뒤에 stray 검사를 거친다",
    /const r = calc2026\(input as Gen2026ClaimInput\);\n\s*if \(r\.status !== "OK"\) return r;\n\s*return rejectUnusedAxes\(generation, input, r\) \?\? r;/.test(code));
  check("2026의 자기 축(급여·비급여 경로 판정)은 라우터가 다시 보지 않는다",
    /const GEN2026_OWNERSHIP: Ownership = \{[\s\S]*?\};/.exec(code)?.[0].includes('"severity"') === true);
  check("각 키를 한 번만 읽는다",
    /const got: unknown = \(input as unknown as Record<string, unknown>\)\[key\];\n\s*if \(got === undefined\) continue;/.test(src));
  check("in 연산자가 아니라 !== undefined로 본다", !/"(severity|nonBenefitItem|nhisCoinsuranceRate|priorAnnualDeductible)" in /.test(code));
  check("반환이 위임 결과의 amount를 그대로 쓴다", /amount: ok\.amount,/.test(src));
  check("priorAnnualPaid는 2·3세대 입원의 소비 축으로 남아 있다",
    /inpatientOnly: \["priorAnnualPaid"\],/.test(code));
}

console.log("\n[G-33] 10. 타입 — 이전 세대 오버로드가 네 축을 봉인한다");
{
  /** 엄격판: 미선언도 실패로 본다(느슨한 Sealed를 되살리지 않는다). */
  type Sealed<T, K extends string> = K extends keyof T ? ([T[K]] extends [undefined] ? true : false) : false;
  const sealed = <T, K extends string>(v: Sealed<T, K>): boolean => v as unknown as boolean;
  check("LegacyClaimInput: nhisCoinsuranceRate 봉인", sealed<LegacyClaimInput, "nhisCoinsuranceRate">(true));
  check("LegacyClaimInput: severity 봉인", sealed<LegacyClaimInput, "severity">(true));
  check("LegacyClaimInput: nonBenefitItem 봉인", sealed<LegacyClaimInput, "nonBenefitItem">(true));
  check("LegacyClaimInput: priorAnnualDeductible 봉인", sealed<LegacyClaimInput, "priorAnnualDeductible">(true));
  // perVisitCoverageLimit은 2·3세대 통원이 소비하므로 **봉인하지 않는다**(과잉 봉인 방지).
  check("LegacyClaimInput: perVisitCoverageLimit은 봉인하지 않는다", !sealed<LegacyClaimInput, "perVisitCoverageLimit">(false));
  check("ClaimInput(5세대 통로)은 네 축을 봉인하지 않는다", !sealed<ClaimInput, "severity">(false));
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  // ⚠ 종전 앵커는 `"2009" | "2017" | "2021"` 한 오버로드가 `LegacyClaimInput`을 받는 모양을
  //   잡았다. G-34A에서 2021의 봉인 목록이 `plan`·`facility`·`priorAnnualPaid`·
  //   `perVisitCoverageLimit`만큼 넓어져 2·3세대와 계약이 달라졌으므로 오버로드를 세대별로
  //   나눴다. 지키려던 성질(제네릭 호출이 세대별 입력 타입으로 봉인된다)은 그대로다.
  check("2·3세대 오버로드가 LegacyClaimInput을 받는다",
    /export function calculate\(generation: "2009" \| "2017", input: LegacyClaimInput\): CalcResult;/.test(src));
  check("2021 오버로드가 따로 선언돼 있다",
    /export function calculate\(generation: "2021", input: Gen2021ClaimInput\): CalcResult;/.test(src));
  check("perVisit을 타입으로 닫지 못한 이유가 기록돼 있다",
    src.includes("`visit`으로 유니온을 쪼개면 호출부가 `visit`을 변수로 넘기는 자리에서 `as` 없이"));
}

console.log("\n[G-33] 11. 화면 — 이 축들은 도달할 수 없다");
{
  const ui = readFileSync("src/components/calculators/HealthCalc.tsx", "utf8");
  check("화면은 네 축과 perVisit을 싣지 않는다",
    /calculate\("2021", \{ amount: parsed, coverage, visit, tier \}\)/.test(ui));
  for (const key of [...FOUR, "perVisitCoverageLimit"]) {
    check(`화면 소스에 ${key}가 없다`, !ui.includes(key));
  }
}

console.log(`\n[G-33 이전 세대 경로의 5세대 전용 축 거부] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
