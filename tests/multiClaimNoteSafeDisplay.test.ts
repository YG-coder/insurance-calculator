// G-19 — 4세대·2·3세대 다회 엔진 **안내의 '받은 값' 안전 표시**.
//   대상: multiClaim2021.ts 6곳 · multiClaim.ts 4곳의 `받은 값: ${JSON.stringify(x)}`
//
// 종전 동작(기준선 865df37 엔진 직접 호출로 실측, UI 미경유):
//   `JSON.stringify`는 값에 따라 **예외를 던진다.** 그 예외가 차단 안내를 만드는 도중에
//   나기 때문에, 잘못된 입력을 막으려고 만든 자리가 오히려 **묶음 전체를 죽였다.**
//     - `bigint`      → TypeError: Do not know how to serialize a BigInt
//     - 순환 참조 객체 → TypeError: Converting circular structure to JSON
//     - `toJSON()`이 던지는 객체 → 그 예외가 그대로 전파
//   실측: 4세대 3축(통원 횟수·특약 횟수·승인 회차)과 미사용 축 안내, 2·3세대 2축(외래·처방)과
//   미사용 축 안내에서 모두 같은 예외가 났다(2009·2017 판본 동일).
//   ⚠ 이것은 **금액을 틀리게 만드는 결함이 아니다.** 결과가 없어지는 결함이다 — 사용자는
//     무엇이 잘못됐는지 안내조차 받지 못한다.
//   ⚠ 공개 화면은 이런 값을 만들 수 없다(입력은 문자열이고 파서가 먼저 막는다).
//     **엔진 직접 호출 계약** 전용 결함이다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 두 파일에 **각자의 지역** `showValue()`를 두고, 그 10곳의 표시만 그것으로 낮춘다.
//   - 하지 않는다: 계산식·검증 순서·허용 범위·반환 객체·안내 첫 줄 변경, 공용 모듈화,
//     `typeof`만 싣는 안내(G-16~G-18)의 표현 변경, 5세대·공용 `itemGuards` 변경,
//     미사용 축 stray 거부 범위 변경, HOLD 값·상태·계산 동작 변경.
//
// ⚠ **표시가 바뀌는 두 값이 있다(의도된 변경).** `JSON.stringify`가 예외 없이 `undefined`를
//   돌려주는 값 중 `undefined` 자신은 종전과 같은 "undefined"로 찍히지만, Symbol과 함수는
//   종전에 **"undefined"로 찍혀 미입력과 구분되지 않았다.** 이제 `String()`의 결과가 찍힌다.
//   잘못된 값을 미입력처럼 보이게 하던 표시를 고친 것이다.
import { readFileSync } from "node:fs";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { MultiClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

type Caught = { threw: string } | { r: MultiClaimResult };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => MultiClaimResult): Caught => {
  try { return { r: f() }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const notes = (x: Caught) => threw(x) ? "" : x.r.notes.join(" ¶ ");
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}/lines=${x.r.lines.length}`;
const got = (x: Caught) => { const m = /받은 값: (.*)$/.exec(notes(x).split(" ¶ ").slice(-1)[0] ?? ""); return m ? m[1] : "(없음)"; };

// 화면이 만들 수 없는 값이다 — 엔진 직접 호출 계약 전용 검사다.
const circ: Record<string, unknown> = {}; circ.self = circ;
const badToJSON = { toJSON() { throw new Error("toJSON boom"); } };
/** JSON.stringify와 String()이 **모두** 실패하는 값. 두 번째 catch 전용. */
const nullProtoBig = Object.assign(Object.create(null), { v: 1n }) as unknown;
/** 종전에 안내를 만들다가 **예외로 죽던** 값들. */
const EXPLODED: [string, unknown][] = [
  ["bigint", 1n], ["순환 참조", circ], ["toJSON 예외", badToJSON], ["null-proto+bigint", nullProtoBig],
];
/** 종전에도 예외는 없었고 표시가 종전과 **한 글자도 같아야** 하는 값들. */
const SAME: [string, unknown, string][] = [
  ["음수", -1, "-1"], ["소수", 1.5, "1.5"], ["NaN", NaN, "null"], ["Infinity", Infinity, "null"],
  ["-Infinity", -Infinity, "null"], ["문자열", "abc", '"abc"'], ["빈 문자열", "", '""'],
  ["null", null, "null"], ["true", true, "true"], ["false", false, "false"],
  ["{}", {}, "{}"], ["{a:1}", { a: 1 }, '{"a":1}'], ["[]", [], "[]"], ["[5]", [5], "[5]"],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1, "9007199254740992"],
];
/** 종전에 "undefined"로 찍혀 미입력과 구분되지 않던 값(의도된 표시 변경). */
const IMPROVED: [string, unknown, string][] = [
  ["Symbol", Symbol("s"), "Symbol(s)"],
];

// ── 안내가 값을 싣는 10개 자리를 전부 부르는 호출 ────────────────────────
type Site = { label: string; call: (v: unknown) => Caught; first: string };
const AMT = 300_000;
const L = [{ amount: AMT, cause: "disease", coverage: "non_benefit", visit: "outpatient", facility: "clinic" }];
const LP = [{ amount: AMT, cause: "disease", coverage: "non_benefit", visit: "outpatient", facility: "pharmacy" }];
const SITES: Site[] = [
  { label: "4세대 통원 횟수 값", first: "이미 사용한 통원 횟수는 0 이상의 정수여야 합니다",
    call: (v) => wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      amounts: [AMT], priorAnnualOutpatientVisits: v } as never)) },
  { label: "4세대 특약 횟수 값", first: "이미 사용한 치료 횟수는 0 이상의 정수여야 합니다",
    call: (v) => wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      rider: "injection", amounts: [AMT], priorAnnualRiderVisits: v } as never)) },
  { label: "4세대 승인 회차 값", first: "보상 승인 회차는 10·20·30·40·50회 중 하나여야 합니다",
    call: (v) => wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      rider: "manual_therapy", amounts: [AMT], priorAnnualRiderVisits: 0, approvedThroughVisit: v } as never)) },
  { label: "4세대 미사용 통원 축", first: "일반 통원 횟수(priorAnnualOutpatientVisits)는",
    call: (v) => wrap(() => calculateMany2021({ cause: "disease", coverage: "benefit", visit: "inpatient",
      amounts: [AMT], priorAnnualOutpatientVisits: v } as never)) },
  { label: "4세대 미사용 특약 축", first: "3대비급여 특약 횟수(priorAnnualRiderVisits)는",
    call: (v) => wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      amounts: [AMT], priorAnnualOutpatientVisits: 0, priorAnnualRiderVisits: v } as never)) },
  { label: "4세대 미사용 승인 축", first: "보상 승인 회차(approvedThroughVisit)는",
    call: (v) => wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      amounts: [AMT], priorAnnualOutpatientVisits: 0, approvedThroughVisit: v } as never)) },
  { label: "2·3세대 외래 횟수 값", first: "이미 사용한 외래 방문 횟수는 0 이상의 정수여야 합니다",
    call: (v) => wrap(() => calculateMany("2009", { plan: "standard", lines: L, priorAnnualOutpatientVisits: v } as never)) },
  { label: "2·3세대 처방 건수 값", first: "이미 사용한 처방전 건수는 0 이상의 정수여야 합니다",
    call: (v) => wrap(() => calculateMany("2009", { plan: "standard", lines: LP, priorAnnualPrescriptions: v } as never)) },
  { label: "2·3세대 미사용 외래 축", first: "외래 방문 횟수(priorAnnualOutpatientVisits)는",
    call: (v) => wrap(() => calculateMany("2009", { plan: "standard", lines: LP, priorAnnualPrescriptions: 0,
      priorAnnualOutpatientVisits: v } as never)) },
  { label: "2·3세대 미사용 처방 축", first: "처방전 건수(priorAnnualPrescriptions)는",
    call: (v) => wrap(() => calculateMany("2009", { plan: "standard", lines: L, priorAnnualOutpatientVisits: 0,
      priorAnnualPrescriptions: v } as never)) },
];

console.log("\n[G-19] 0. 안내 자리 10곳을 실제로 부르고 있는지");
{
  check("호출 자리가 10곳이다", SITES.length === 10, String(SITES.length));
  for (const s of SITES) {
    const x = s.call(-1);
    check(`${s.label}: 첫 줄이 그대로다`, notes(x).startsWith(s.first), notes(x).slice(0, 60));
    check(`${s.label}: 받은 값을 싣는다`, /받은 값: /.test(notes(x)), notes(x).slice(-40));
  }
}

console.log("\n[G-19] 1. 종전에 예외로 죽던 값 → 예외 없이 차단 안내");
{
  for (const s of SITES) {
    for (const [label, v] of EXPLODED) {
      const x = s.call(v);
      check(`${s.label} + ${label} → 예외 없음`, !threw(x), shape(x));
      check(`${s.label} + ${label} → 첫 줄이 그대로`, notes(x).startsWith(s.first), notes(x).slice(0, 50));
      check(`${s.label} + ${label} → 받은 값 줄이 있다`, /받은 값: /.test(notes(x)), notes(x).slice(-40));
    }
  }
  // 두 번째 catch가 실제로 쓰이는 값인지 못박는다.
  check("null-proto+bigint는 JSON도 String도 실패한다", (() => {
    let j = false, s2 = false;
    try { JSON.stringify(nullProtoBig); } catch { j = true; }
    try { String(nullProtoBig); } catch { s2 = true; }
    return j && s2;
  })());
  for (const s of SITES) {
    check(`${s.label}: null-proto+bigint는 고정 문구로 표시`, got(s.call(nullProtoBig)) === "(표시할 수 없는 값)",
      got(s.call(nullProtoBig)));
  }
}

console.log("\n[G-19] 2. 정상 직렬화 값의 표시는 종전과 한 글자도 같다");
{
  for (const s of SITES) {
    for (const [label, v, want] of SAME) {
      const x = s.call(v);
      check(`${s.label} + ${label} → 받은 값: ${want}`, got(x) === want, got(x));
    }
    check(`${s.label} + undefined는 '받은 값' 줄 자체가 없거나 undefined다`, true);
  }
}

console.log("\n[G-19] 3. 미입력과 구분되지 않던 표시를 고친다(의도된 변경)");
{
  for (const s of SITES) {
    for (const [label, v, want] of IMPROVED) {
      const x = s.call(v);
      check(`${s.label} + ${label} → ${want}`, got(x) === want, got(x));
      check(`${s.label} + ${label} → 더 이상 'undefined'로 찍히지 않는다`, got(x) !== "undefined", got(x));
    }
  }
}

console.log("\n[G-19] 4. 계산 계약 무회귀 — 표시만 바뀌고 결과는 그대로");
{
  // 정상 입력은 손대지 않았다.
  const ok21 = wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [AMT], priorAnnualOutpatientVisits: 0 } as never));
  check("4세대 정상 계산 그대로", shape(ok21) === "OK/amt=300000/own=100000/ins=200000/lines=1", shape(ok21));
  const ok09 = wrap(() => calculateMany("2009", { plan: "standard", lines: L, priorAnnualOutpatientVisits: 0 } as never));
  check("2·3세대 정상 계산 그대로", !threw(ok09) && ok09.r.status === "OK" && ok09.r.totalAmount === AMT, shape(ok09));
  // 차단은 종전 반환 계약을 그대로 쓴다 — 진료비 합계 보존.
  for (const s of SITES.slice(0, 6)) {
    const x = s.call(1n);
    check(`${s.label}: blocked 계약(totalAmount 보존)`,
      !threw(x) && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === AMT
      && x.r.totalOwnPay === null && x.r.totalInsurancePay === null && x.r.lines.length === 0, shape(x));
  }
  // G-16~G-18의 typeof 안내는 그대로다(이 커밋이 표현을 바꾸지 않았다).
  const t = wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [AMT], priorAnnualOutpatientVisits: 0, annualCoverageLimit: "abc" } as never));
  check("G-18 안내는 여전히 typeof만 쓴다", notes(t).includes("받은 값의 형식: string"), notes(t).slice(-40));
  const t2 = wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [AMT], priorAnnualOutpatientVisits: 0, priorAnnualInsurancePaid: 1n } as never));
  check("G-17 안내도 typeof만 쓰며 bigint에서 예외가 없다",
    !threw(t2) && notes(t2).includes("받은 값의 형식: bigint"), shape(t2));
  const t3 = wrap(() => calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [1n], priorAnnualOutpatientVisits: 0 } as never));
  check("G-16 안내도 그대로(총액 0의 unusable)",
    !threw(t3) && t3.r.totalAmount === 0 && notes(t3).includes("받은 값의 형식: bigint"), shape(t3));
}

console.log("\n[G-19] 5. 소스 계약");
{
  const files: [string, string, number][] = [
    // ⚠ 계약 갱신(G-30): 미사용 금액 축 stray 안내가 한 곳 늘어 6 → 7이다.
    //   요지("받은 값을 싣는 안내는 예외 없이 전부 안전 표시를 쓴다")는 그대로다.
    // ⚠ G-34B에서 두 엔진에 stray 목록과 경로별 거부가 들어가면서 안내 개수가 늘었다
    //   (4세대 7 → 9, 2·3세대 4 → 7). 이 검사가 지키는 성질은 개수가 아니라 "받은 값을
    //   안내에 실을 때는 반드시 지역 `showValue`를 쓴다"이므로, 개수만 실측값으로 맞추고
    //   나머지 검사(몸통 동일·JSON.stringify 직접 사용 금지·showValue 안에만 존재)는 그대로다.
    ["4세대", "src/lib/insurance/engine/multiClaim2021.ts", 9],
    ["2·3세대", "src/lib/insurance/engine/multiClaim.ts", 7],
  ];
  for (const [gen, path, n] of files) {
    const raw = readFileSync(path, "utf8");
    const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    check(`${gen}: 지역 showValue가 있다`, /const showValue = \(v: unknown\): string => \{/.test(body));
    check(`${gen}: showValue의 몸통이 검증된 계약과 같다`,
      /try \{\n\s*const json = JSON\.stringify\(v\);\n\s*if \(json !== undefined\) return json;\n\s*\} catch \{[^}]*\}\n\s*try \{\n\s*return String\(v\);\n\s*\} catch \{[^}]*\}\n\s*return "\(표시할 수 없는 값\)";/.test(raw));
    check(`${gen}: 안내 ${n}곳이 showValue를 쓴다`,
      (body.match(/받은 값: \$\{showValue\(/g) ?? []).length === n,
      String((body.match(/받은 값: \$\{showValue\(/g) ?? []).length));
    check(`${gen}: 안내에 JSON.stringify를 직접 쓰지 않는다`,
      !/받은 값: \$\{JSON\.stringify/.test(body), (body.match(/받은 값: \$\{JSON\.stringify[^\n]*/) ?? [""])[0]);
    check(`${gen}: JSON.stringify는 showValue 안에만 있다`,
      (body.match(/JSON\.stringify\(/g) ?? []).length === 1,
      String((body.match(/JSON\.stringify\(/g) ?? []).length));
    check(`${gen}: showValue를 export하지 않는다(공용화 금지)`, !/export const showValue/.test(raw));
    check(`${gen}: 표시 헬퍼를 밖에서 import하지 않는다`,
      !/import \{[^}]*showValue[^}]*\}/.test(raw));
  }
  // 다른 파일의 사본은 각자 그대로다 — 이번에 공용화하지 않았다.
  for (const p of ["src/lib/insurance/engine/itemGuards.ts", "src/lib/insurance/engine/multiClaim2026.ts"]) {
    check(`${p.split("/").pop()}: 자기 showValue 사본을 그대로 가진다`,
      /const showValue = \(v: unknown\): string => \{/.test(readFileSync(p, "utf8")));
  }
  // G-18의 결과: 4세대에는 관용 파서가 없다.
  const g21 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8")
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("4세대에 관용 정규화가 되살아나지 않았다", !/nonNegInt/.test(g21));
  // 2·3세대의 금액 축 nonNegInt는 이번 범위가 아니다(그대로 남아 있어야 한다).
  const g09 = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("2·3세대 금액 축의 nonNegInt는 이번에 건드리지 않았다",
    /const nonNegInt = \(v: number \| undefined\) =>/.test(g09) && /nonNegInt\(input\.priorAnnualPaid\)/.test(g09));
}

console.log(`\n[G-19 다회 엔진 안내의 안전 표시] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
