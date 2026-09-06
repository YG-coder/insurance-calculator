// G-32 — 5세대 비급여 **중증/비중증(severity)** 입력의 열거값 검증.
//   G-30이 미사용 금액 축을, G-31이 미사용 비금액 축을 닫았다. 여기서는 **실제로 소비하는**
//   축의 값 검증을 다룬다 — 미사용 축의 stray 계약과는 다른 종류의 결함이다.
//
// 종전 결함 (기준선 `dc58740`, UI 미경유 엔진 직접 호출 + 접근자 계수).
//   단건 `calc2026`   `if (!input.severity)`만 있었고 그 뒤 판정이 `severity === "critical"`이라
//                     **falsy만 막고 그 밖의 어떤 truthy 값이든 비중증으로 계산**했다.
//   다회 `calculateMany2026`  검증이 아예 없었다. `=== "critical"` / `=== "non_critical"` 비교만
//                     있어 무효값은 **통원 카운터 preflight까지 통과**하고(유효값이면 카운터
//                     미입력이 차단되는데도) 행 계산에서 비중증으로 계산됐다.
//   항목·상급병실료   이미 `oneOf(raw.severity, SEVERITY_VALUES)`로 검증하고 있었다 —
//                     **두 진입점 사이 계약이 갈려 있었다.**
//
// 금액 영향(실측).
//   단건 비급여 통원 30만원: `"critical"` → 자기부담 90,000 / `"mild"`·`"x"`·`"CRITICAL"`·
//     `1`·`true`·`{}`·`[]`·`bigint`·`Symbol`·함수·순환 참조 → 전부 **150,000**.
//   다회 비급여 입원(상급) 300만원: `"critical"` → 900,000 / 무효 truthy → **1,500,000**.
//   중증 청구가 조용히 비중증으로 계산돼 자기부담금이 과다, 보험금이 과소 산출됐다.
//
// 목표 계약.
//   `undefined`의 기존 의미는 그대로다 — "미지정 → 계산 불가"이고 안내 문구도 종전 그대로다.
//   `undefined`가 아닌 값은 `"critical"`·`"non_critical"` 두 열거값만 통과하고, 그 밖은
//   **미지정이 아니라 무효값**으로 분리해 안내한다(G-24·G-25가 `0`원을 미입력과 분리한 계보).
//   비중증으로 추정하지 않는다 / 진입점의 기존 실패 반환 계약 유지(단건 `pending`,
//   다회 `blocked` — 검증된 진료비 합계 보존) / 선행 preflight·경로 불일치가 결과를 정하는
//   경로에서는 읽지 않음 / 판정 지점에서 정확히 한 번 읽고 그 값을 판정·안내·산식이 모두 씀 /
//   안내는 각 파일의 기존 안전 표시 계약을 따름 / 산식·한도·공제·HOLD·G-30·G-31 계약 불변.
import { readFileSync } from "node:fs";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import type {
  Gen2026ClaimInput, Gen2026MultiClaimInput, Gen2026CriticalMriInput,
  Gen2026RoomChargeInput, Gen2026NonBenefitInput, Gen2026MultiNonBenefitInput, Severity,
} from "../src/lib/insurance/engine/types";

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
  x.r.route, x.r.status, x.r.amount, x.r.ownPay, x.r.insurancePay,
  x.r.totalAmount, x.r.totalOwnPay, x.r.totalInsurancePay, x.r.appliedCaps, x.r.notes,
  (x.r.lines as unknown[] ?? []).length,
]);
/** 단건 차단 계약 — 진료비 보존, 금액 없음. */
const isPending = (x: Caught, amount: number) => !threw(x)
  && x.r.status === "PENDING_UNVERIFIED" && x.r.amount === amount
  && x.r.ownPay === null && x.r.insurancePay === null && x.r.route === undefined;
/** 다회 차단 계약 — 검증된 진료비 합계 보존, 행·후보 보험금 미노출. */
const isBlocked = (x: Caught, total: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === total && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0
  && Array.isArray(x.r.appliedCaps) && (x.r.appliedCaps as unknown[]).length === 0;
/** 항목 거부 계약 — 총액 0. */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0;

const A = 300_000, BIG = 3_000_000;
const circ: Any = {}; circ.self = circ;
/** 브라우저가 만들 수 없는 값도 **엔진 직접 호출**로만 넣는다(공개 화면 주입 아님). */
const TRUTHY: [string, unknown][] = [
  ["'mild'", "mild"], ["'CRITICAL'", "CRITICAL"], ["'Critical'", "Critical"], ["'x'", "x"],
  ["'critical '", "critical "], ["' critical'", " critical"], ["'non-critical'", "non-critical"],
  ["1", 1], ["-1", -1], ["true", true], ["{}", { a: 1 }], ["[]", []], ["['critical']", ["critical"]],
  ["bigint", 10n], ["Symbol", Symbol("s")], ["함수", () => "critical"], ["순환 참조", circ],
  ["Date", new Date(0)], ["정규식", /critical/],
  ["toString이 던지는 객체", { toString() { throw new Error("x"); }, toJSON() { throw new Error("y"); } }],
];
const FALSY: [string, unknown][] = [["''", ""], ["null", null], ["0", 0], ["-0", -0], ["false", false], ["NaN", NaN]];

const f1 = (i: Any) => wrap(() => calc2026(i as unknown as Gen2026ClaimInput));
const fM = (i: Any) => wrap(() => calculateMany2026(i as unknown as Gen2026MultiClaimInput));
const fI = (i: Any) => wrap(() => calculateGen2026Item(i as unknown as Gen2026CriticalMriInput));
const fR = (i: Any) => wrap(() => calculateRoomCharge2026(i as unknown as Gen2026RoomChargeInput));

const S: Record<string, (e?: Any) => Any> = {
  "단건 비급여 통원": (e = {}) => ({ amount: A, coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "general", ...e }),
  "단건 비급여 입원(상급)": (e = {}) => ({ amount: A, coverage: "non_benefit", visit: "inpatient", tier: "hospital", nonBenefitItem: "general", ...e }),
  "단건 비급여 입원(의원)": (e = {}) => ({ amount: A, coverage: "non_benefit", visit: "inpatient", tier: "clinic", nonBenefitItem: "general", ...e }),
};
const M: Record<string, (e?: Any) => Any> = {
  "다회 비급여 통원(회)": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "general", amounts: [A], priorAnnualOutpatientVisits: 0, ...e }),
  "다회 비급여 통원(일)": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "general", amounts: [A], priorAnnualOutpatientDays: 0, ...e }),
  "다회 비급여 입원(상급)": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "hospital", nonBenefitItem: "general", amounts: [BIG], ...e }),
  "다회 비급여 입원(의원)": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic", nonBenefitItem: "general", amounts: [A], ...e }),
};
const I: Record<string, (e?: Any) => Any> = {
  "항목 중증 MRI": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [{ amount: A, visit: "outpatient" }], ...e }),
  "항목 중증 근골격": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: [{ amount: A, visit: "outpatient" }], priorAnnualTreatmentActCount: 0, ...e }),
  "항목 비중증 MRI": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri", lines: [{ amount: A, visit: "outpatient" }], ...e }),
  "항목 일반전환": (e = {}) => ({ route: "general", coverage: "non_benefit", cause: "disease", severity: "non_critical", item: "musculoskeletal_esw", amounts: [A], visit: "outpatient", tier: "clinic", priorAnnualOutpatientDays: 0, ...e }),
};
const ROOM = (e: Any = {}) => ({ route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical", stays: [{ roomChargeTotal: 400_000, inpatientDays: 2 }], ...e });

console.log("\n[G-32] 1. 정상 열거값은 종전 그대로 계산한다");
{
  const exp: [string, string, number, number][] = [
    ["단건 비급여 통원", "critical", 90_000, 210_000],
    ["단건 비급여 통원", "non_critical", 150_000, 150_000],
    ["단건 비급여 입원(상급)", "critical", 90_000, 210_000],
    ["단건 비급여 입원(상급)", "non_critical", 150_000, 150_000],
    ["단건 비급여 입원(의원)", "critical", 90_000, 210_000],
    ["단건 비급여 입원(의원)", "non_critical", 150_000, 150_000],
  ];
  for (const [name, sv, own, ins] of exp) {
    const r = f1(S[name]({ severity: sv }));
    check(`${name} · ${sv} → own=${own}/ins=${ins}`, !threw(r) && r.r.status === "OK"
      && r.r.ownPay === own && r.r.insurancePay === ins, statusOf(r) + " " + String(r && (r as { r?: Res }).r?.ownPay));
  }
  const mc = fM(M["다회 비급여 입원(상급)"]({ severity: "critical" }));
  check("다회 비급여 입원(상급) · critical → 900,000/2,100,000",
    !threw(mc) && mc.r.totalOwnPay === 900_000 && mc.r.totalInsurancePay === 2_100_000, statusOf(mc));
  const mn = fM(M["다회 비급여 입원(상급)"]({ severity: "non_critical" }));
  check("다회 비급여 입원(상급) · non_critical → 1,500,000/1,500,000",
    !threw(mn) && mn.r.totalOwnPay === 1_500_000 && mn.r.totalInsurancePay === 1_500_000, statusOf(mn));
  check("다회 통원(회) · critical은 카운터 계약 그대로", statusOf(fM(M["다회 비급여 통원(회)"]({ severity: "critical" }))) === "OK");
  check("다회 통원(일) · non_critical은 카운터 계약 그대로", statusOf(fM(M["다회 비급여 통원(일)"]({ severity: "non_critical" }))) === "OK");
  for (const [n, mk] of Object.entries(I)) check(`${n} 정상값 그대로`, statusOf(fI(mk())) === "OK", statusOf(fI(mk())));
  check("상급병실료 정상값 그대로", statusOf(fR(ROOM())) === "OK");
}

console.log("\n[G-32] 2. undefined의 기존 의미와 안내 문구는 그대로다");
{
  for (const [n, mk] of Object.entries(S)) {
    const explicit = f1(mk({ severity: undefined }));
    const missing = f1(mk());
    check(`${n} · 명시적 undefined = 미제공`, shape(explicit) === shape(missing));
    check(`${n} · 종전 미지정 안내 그대로`,
      note0(explicit) === "비급여: 중증/비중증(severity) 미지정 → 계산 불가", note0(explicit).slice(0, 40));
    check(`${n} · 단건 차단 계약`, isPending(explicit, A));
  }
  for (const [n, mk] of Object.entries(M)) {
    const explicit = fM(mk({ severity: undefined }));
    check(`${n} · 명시적 undefined = 미제공`, shape(explicit) === shape(fM(mk())));
    check(`${n} · 종전 미지정 안내 그대로`,
      note0(explicit) === "비급여: 중증/비중증(severity) 미지정 → 계산 불가", note0(explicit).slice(0, 40));
  }
}

console.log("\n[G-32] 3. truthy 무효값은 비중증으로 추정하지 않고 차단한다");
{
  for (const [n, mk] of Object.entries(S)) for (const [vn, v] of TRUTHY) {
    const r = f1(mk({ severity: v }));
    check(`${n} · ${vn} → pending`, isPending(r, A)
      && note0(r).startsWith("비급여: 중증/비중증(severity)은")
      && note0(r).includes("두 값만 받습니다"), `${statusOf(r)} ${note0(r).slice(0, 30)}`);
  }
  for (const [n, mk] of Object.entries(M)) for (const [vn, v] of TRUTHY) {
    const total = n.includes("입원(상급)") ? BIG : A;
    const r = fM(mk({ severity: v }));
    check(`${n} · ${vn} → blocked`, isBlocked(r, total)
      && note0(r).startsWith("비급여: 중증/비중증(severity)은"), `${statusOf(r)} ${note0(r).slice(0, 30)}`);
  }
  // 비중증으로 계산되지 않는다 — 종전 금액이 나오면 실패다.
  const wrong = f1(S["단건 비급여 통원"]({ severity: "CRITICAL" }));
  check("오타 'CRITICAL'이 150,000원을 만들지 않는다", !threw(wrong) && wrong.r.ownPay !== 150_000);
}

console.log("\n[G-32] 4. falsy 무효값도 '미지정'이 아니라 무효값으로 분리한다");
{
  for (const [n, mk] of Object.entries(S)) for (const [vn, v] of FALSY) {
    const r = f1(mk({ severity: v }));
    check(`${n} · ${vn} → 무효값 안내`, isPending(r, A)
      && note0(r).startsWith("비급여: 중증/비중증(severity)은")
      && note0(r) !== "비급여: 중증/비중증(severity) 미지정 → 계산 불가", note0(r).slice(0, 34));
  }
  for (const [n, mk] of Object.entries(M)) for (const [vn, v] of FALSY) {
    const total = n.includes("입원(상급)") ? BIG : A;
    const r = fM(mk({ severity: v }));
    check(`${n} · ${vn} → 무효값 안내`, isBlocked(r, total)
      && note0(r).startsWith("비급여: 중증/비중증(severity)은"), note0(r).slice(0, 34));
  }
  check("undefined만 '미지정' 문구를 쓴다",
    note0(f1(S["단건 비급여 통원"]())) === "비급여: 중증/비중증(severity) 미지정 → 계산 불가");
}

console.log("\n[G-32] 5. 반환 계약을 섞지 않는다");
{
  const a = f1(S["단건 비급여 통원"]({ severity: "x" }));
  check("단건은 pending — 진료비 보존, route 키 없음", isPending(a, A) && !threw(a) && a.r.generation === "2026");
  const b = fM(M["다회 비급여 통원(회)"]({ severity: "x" }));
  check("다회는 blocked — 검증된 합계 보존", isBlocked(b, A));
  const multi = fM({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic",
    nonBenefitItem: "general", amounts: [100, 200, 300], severity: "x" });
  check("다회 합계 보존: 여러 행의 합계를 그대로 싣는다", isBlocked(multi, 600));
  const c = fI(I["항목 중증 MRI"]({ severity: "x" }));
  check("항목은 종전대로 rejected — 총액 0", isRejected(c));
  const d = fR(ROOM({ severity: "x" }));
  check("상급병실료도 종전대로 rejected", isRejected(d));
}

console.log("\n[G-32] 6. 선행 preflight·경로 불일치가 먼저다 (그 경로에서는 읽지 않는다)");
{
  const noItem = f1({ amount: A, coverage: "non_benefit", visit: "outpatient", severity: "x" });
  check("치료유형 미지정 안내가 먼저다", note0(noItem).includes("치료유형(nonBenefitItem) 미지정"), note0(noItem).slice(0, 34));
  const blockedItem = f1({ amount: A, coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "mri", severity: "x" });
  check("계산 대상 아닌 치료유형 안내가 먼저다", note0(blockedItem).includes("현재 계산 대상이 아닙니다"), note0(blockedItem).slice(0, 34));
  const legacy = f1(S["단건 비급여 통원"]({ priorAnnualPaid: 0, severity: "x" }));
  check("레거시 priorAnnualPaid 안내가 먼저다", note0(legacy).includes("priorAnnualPaid"), note0(legacy).slice(0, 34));
  const wrongRoute = fI({ ...I["항목 중증 근골격"](), route: "general", severity: "critical" });
  check("항목의 경로 불일치 안내가 그대로다", note0(wrongRoute).includes("경로에서 계산해야 합니다"), note0(wrongRoute).slice(0, 34));
  // 다회: 선행 preflight가 결과를 정하면 이름을 읽지 않는다.
  for (const [label, base] of [
    ["치료유형 미지정", { cause: "disease", coverage: "non_benefit", visit: "outpatient", amounts: [A] }],
    ["입원 카운터 stray", { cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic", nonBenefitItem: "general", amounts: [A], priorAnnualOutpatientDays: 0 }],
    ["B군 전용 키 stray", { cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic", nonBenefitItem: "general", amounts: [A], item: "mri" }],
    ["진료비 무효", { cause: "disease", coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "general", amounts: [-1] }],
  ] as [string, Any][]) {
    let reads = 0;
    const o: Any = { ...base };
    Object.defineProperty(o, "severity", { get() { reads++; return "x"; }, enumerable: true, configurable: true });
    const r = fM(o);
    check(`다회 · ${label} 경로에서는 severity를 읽지 않는다`,
      reads === 0 && statusOf(r) === "PENDING_UNVERIFIED", `reads=${reads}`);
  }
}

console.log("\n[G-32] 7. 접근자 — 판정 지점에서 정확히 한 번 읽는다");
{
  for (const [n, mk] of Object.entries(S)) for (const v of ["critical", "non_critical", "x", undefined]) {
    let reads = 0;
    const o: Any = mk();
    Object.defineProperty(o, "severity", { get() { reads++; return v; }, enumerable: true, configurable: true });
    const r = f1(o);
    check(`${n} · severity=${String(v)} → 1회만 읽는다`, reads === 1 && !threw(r), `reads=${reads}`);
  }
  for (const [n, mk] of Object.entries(M)) for (const v of ["critical", "non_critical", "x"]) {
    let reads = 0;
    const o: Any = mk();
    Object.defineProperty(o, "severity", { get() { reads++; return v; }, enumerable: true, configurable: true });
    const r = fM(o);
    check(`${n} · severity=${String(v)} → 1회만 읽는다`, reads === 1 && !threw(r), `reads=${reads}`);
  }
  // 값이 변하는 getter에서도 계산·안내가 같은 값을 쓴다.
  {
    const seq = ["critical", "non_critical", "non_critical", "non_critical"]; let i = 0;
    const o: Any = S["단건 비급여 통원"]();
    Object.defineProperty(o, "severity", { get() { return seq[i++ % seq.length]; }, enumerable: true, configurable: true });
    const varied = f1(o);
    const fixed = f1(S["단건 비급여 통원"]({ severity: "critical" }));
    check("변하는 getter도 첫 값 하나로 계산·안내가 정해진다", shape(varied) === shape(fixed), shape(varied).slice(0, 60));
  }
  {
    const seq = ["critical", "non_critical", "non_critical", "non_critical", "non_critical"]; let i = 0;
    const o: Any = M["다회 비급여 입원(상급)"]();
    Object.defineProperty(o, "severity", { get() { return seq[i++ % seq.length]; }, enumerable: true, configurable: true });
    const varied = fM(o);
    const fixed = fM(M["다회 비급여 입원(상급)"]({ severity: "critical" }));
    check("다회도 첫 값 하나로 전 행·안내가 정해진다", shape(varied) === shape(fixed), shape(varied).slice(0, 60));
  }
  // 던지는 getter: 읽는 자리에서만 전파되고, 선행 preflight가 막으면 조용하다.
  {
    const o: Any = S["단건 비급여 통원"]();
    Object.defineProperty(o, "severity", { get() { throw new Error("BOOM"); }, enumerable: true, configurable: true });
    check("던지는 getter는 판정 지점에서 전파된다", threw(f1(o)));
    const o2: Any = { amount: A, coverage: "non_benefit", visit: "outpatient" };
    Object.defineProperty(o2, "severity", { get() { throw new Error("BOOM"); }, enumerable: true, configurable: true });
    check("치료유형 미지정이 먼저면 던지는 getter도 조용하다", !threw(f1(o2)));
  }
}

console.log("\n[G-32] 8. 위험한 값에서도 예외가 아니라 안내로 끝난다");
{
  for (const [vn, v] of [["bigint", 10n], ["Symbol", Symbol("s")], ["순환 참조", circ],
    ["toString이 던지는 객체", { toString() { throw new Error("x"); }, toJSON() { throw new Error("y"); } }]] as [string, unknown][]) {
    check(`단건 · ${vn} → 예외 없이 pending`, isPending(f1(S["단건 비급여 통원"]({ severity: v })), A));
    check(`다회 · ${vn} → 예외 없이 blocked`, isBlocked(fM(M["다회 비급여 통원(회)"]({ severity: v })), A));
  }
  const gen = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("generation2026은 받은 값 자체를 문자열로 만들지 않는다(typeof만)",
    !/받은 값: \$\{(?!typeof)/.test(gen));
  const mul = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("multiClaim2026의 중증도 안내는 지역 showValue를 쓴다",
    /받은 값: \$\{showValue\(rawSeverity\)\}/.test(mul));
}

console.log("\n[G-32] 9. 구조 — 한 자리에서 읽고, 원본을 다시 읽지 않는다");
{
  const gen = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const mul = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("generation2026: 검증 뒤 지역 변수를 쓴다",
    /const rawSeverity: unknown = \(input as \{ severity\?: unknown \}\)\.severity;/.test(gen)
    && /const severity: Severity = rawSeverity;/.test(gen));
  check("generation2026: truthy 통과 검사가 사라졌다",
    !/if \(!input\.severity\) \{/.test(gen.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")));
  check("generation2026: 본문이 input.severity를 다시 읽지 않는다",
    (gen.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ").match(/input\.severity/g) ?? []).length === 0);
  check("generation2026: 두 열거값만 통과시킨다",
    /rawSeverity !== "critical" && rawSeverity !== "non_critical"/.test(gen));
  check("multiClaim2026: 한 자리에서만 읽는다",
    (mul.match(/readCount\(nb, "severity"\)/g) ?? []).length === 1
    && !/nb\?\.severity/.test(mul));
  check("multiClaim2026: 본문·안내가 input.severity를 다시 읽지 않는다",
    (mul.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ").match(/input\.severity/g) ?? []).length === 0);
  check("multiClaim2026: buildNotes가 검증된 값을 인자로 받는다",
    /severity: Severity \| undefined,\n\): string\[\] \{/.test(mul)
    && /notes: buildNotes\(input, limitState, outpatientLimitState, severity\),/.test(mul));
  check("multiClaim2026: 검증이 통원 카운터 축 분리 앞이다",
    mul.indexOf('const rawSeverity = readCount(nb, "severity");') < mul.indexOf("// ── 통원 카운터 축 분리"));
  check("multiClaim2026: 검증이 입원 카운터 stray 뒤다",
    mul.indexOf('const rawSeverity = readCount(nb, "severity");') > mul.indexOf("통원 횟수·일수 카운터는 입원 계산에 쓰이지 않습니다."));
  check("multiClaim2026: undefined는 여기서 막지 않는다",
    /if \(rawSeverity !== undefined\n\s*&& rawSeverity !== "critical" && rawSeverity !== "non_critical"\) \{/.test(mul));
  // 항목·상급병실료는 종전 그대로 공용 가드를 쓴다.
  const itm = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("specialItem2026은 종전 oneOf 가드 그대로", /if \(!oneOf\(raw\.severity, SEVERITY_VALUES\)\) return rejected\("질환 구분\(severity\)", raw\.severity\);/.test(itm));
  check("roomCharge2026도 종전 oneOf 가드 그대로", /if \(!oneOf\(raw\.severity, SEVERITY_VALUES\)\) return rejected\("질환 구분\(severity\)", raw\.severity\);/.test(room));
}

console.log("\n[G-32] 10. 타입 — 리터럴 유니온이 `string`으로 완화되지 않았다");
{
  /** 엄격판: 미선언도 실패로 본다(느슨한 Sealed를 되살리지 않는다). */
  type Sealed<T, K extends string> = K extends keyof T ? ([T[K]] extends [undefined] ? true : false) : false;
  const sealed = <T, K extends string>(v: Sealed<T, K>): boolean => v as unknown as boolean;
  /** 정확한 열거 타입인지 — `string`이면 실패한다. */
  type ExactSeverity<T> = [Severity | undefined] extends [T] ? ([T] extends [Severity | undefined] ? true : false) : false;
  const exact = <T,>(v: ExactSeverity<T>): boolean => v as unknown as boolean;
  check("단건 비급여의 severity는 정확한 리터럴 유니온이다", exact<Gen2026NonBenefitInput["severity"]>(true));
  check("다회 비급여의 severity는 정확한 리터럴 유니온이다", exact<Gen2026MultiNonBenefitInput["severity"]>(true));
  check("G-31: 단건 급여의 severity는 봉인 그대로", sealed<import("../src/lib/insurance/engine/types").Gen2026BenefitInput, "severity">(true));
  check("G-31: 다회 급여의 severity는 봉인 그대로", sealed<import("../src/lib/insurance/engine/types").Gen2026MultiBenefitInput, "severity">(true));
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  check("Severity 정의가 두 리터럴 그대로다",
    /export type Severity = "critical" \| "non_critical";/.test(types));
}

console.log("\n[G-32] 11. G-30·G-31 계약과 HOLD는 그대로다");
{
  const dOK = f1(S["단건 비급여 입원(상급)"]({ severity: "critical", priorAnnualDeductible: 1_000_000 }));
  check("G-30 누적 공제금액 소비 조합 그대로", statusOf(dOK) === "OK");
  const dNo = f1(S["단건 비급여 입원(의원)"]({ severity: "critical", priorAnnualDeductible: 1_000_000 }));
  check("G-30 미소비 조합은 그대로 차단", isPending(dNo, A) && note0(dNo).includes("priorAnnualDeductible"));
  const pv = f1(S["단건 비급여 통원"]({ severity: "critical", perVisitCoverageLimit: 200_000 }));
  check("G-30 통원 가입금액 소비 그대로", statusOf(pv) === "OK");
  const nhis = f1(S["단건 비급여 통원"]({ severity: "critical", nhisCoinsuranceRate: 0.2 }));
  check("G-31 비급여 nhis stray 그대로 차단", isPending(nhis, A) && note0(nhis).includes("nhisCoinsuranceRate"));
  const benSev = f1({ amount: A, coverage: "benefit", visit: "inpatient", severity: "critical" });
  check("G-31 급여의 severity stray 그대로 차단", isPending(benSev, A) && note0(benSev).includes("severity"));
  const mBenSev = fM({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [A], severity: "critical" });
  check("G-31 다회 급여의 severity stray 그대로 차단", isBlocked(mBenSev, A) && note0(mBenSev).includes("severity"));
  const gen = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("500만원 공제 상한 산식은 그대로",
    /const remaining = Math\.max\(c\.annualDeductibleCap - priorDeductible, 0\);/.test(gen)
    && /const priorDeductible = Math\.max\(0, \(rawDeductible as number \| undefined\) \?\? 0\);/.test(gen));
}

console.log("\n[G-32] 12. 화면 — 무효 중증도는 도달할 수 없다");
{
  const ui = [
    readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8"),
    readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8"),
  ];
  check("단건 화면의 상태 타입이 Severity로 좁혀져 있다", /useState<Severity \| null>\(null\)/.test(ui[0]));
  check("다회 화면의 상태 타입이 Severity로 좁혀져 있다", /useState<Severity \| "">\(""\)/.test(ui[1]));
  check("단건 화면은 두 버튼으로만 값을 만든다",
    (ui[0].match(/setSeverity\("(critical|non_critical)"\)/g) ?? []).length === 2
    && !/setSeverity\((?!"critical"|"non_critical")/.test(ui[0]));
  check("다회 화면은 미선택을 게이트로 막는다", /const needsSeverity = coverage === "non_benefit" && nonBenefitItem !== "" && severity === "";/.test(ui[1]));
}

console.log(`\n[G-32 비급여 중증도 입력의 열거값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
