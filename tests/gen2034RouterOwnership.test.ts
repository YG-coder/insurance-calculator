// G-34A — 제네릭 `calculate()`의 **세대·경로별 소유권 표**와 확정 stray 봉인.
//   G-33은 "5세대 전용 축 5개"라는 **이름 목록**으로 이전 세대 경로를 막았다. 그 목록은
//   5세대에서 온 축만 담아, 다른 진입점(다회·별도 보장종목·상급병실료)의 축과 세대끼리
//   바꿔 쓸 수 없는 축(`plan`↔`tier`, `facility`)은 그대로 통과했다.
//
// 전수 스윕 (기준선 `5ea987c`, UI 미경유 엔진 직접 호출, 30경로 × 34축, 축을 base에서
// 뺀 결과를 기준으로 삼고 접근자 계수 + 결과 지문 변화를 함께 관측):
//   · 기준선이 OK인 경로 30 / 선행 차단으로 제외 0
//   · (세대, 축) 단위 — 전 경로 조용한 폐기 95 · 경로별 조용한 폐기 6 · 전 경로 읽힘 23
//   → 조용한 폐기가 관찰된 자리 **101**  (G-33이 이미 닫은 자리는 여기에 포함되지 않는다)
//
// 그 101자리의 분류:
//   · 확정 공통 통로 2 — `2021 tier`(외부 호출부 `HealthCalc.tsx`가 네 조합 모두에서 싣는다),
//     `2026 tier`(5세대 직접 진입점과 **같은 모양**이어야 하므로 여기서 단독으로 정하지 않는다)
//   · 확정 stray 99 — 이 커밋이 봉인한다 (전 경로 95 + 경로별 4)
//
// ⚠ 접근자 0회만으로, 또는 "미제공과 결과가 같다"만으로 결함을 확정하지 않았다. 두 관측이
//   모두 성립할 때만 조용한 폐기로 셌다. 반대로 "공통 타입이라서"를 허용 근거로 쓰지도 않았다 —
//   공통 통로로 남긴 두 자리는 각각 외부 호출부·후속 확정 대상이라는 근거를 코드에 적었다.
//
// 목표 계약: `undefined`는 미제공과 동일 / 그 밖은 숫자 `0`도 포함해 명시적 거부 /
//   선행 preflight가 결과를 정하면 **읽지 않음** / 각 축을 한 번만 읽음 / 세대별 반환 계약과
//   **검증된 진료비(`amount`) 보존** / 안내는 `typeof`만 싣는 안전 표시 / G-33이 만든 다섯 축의
//   안내 문구·우선순위 보존 / 소비 축(2·3세대 통원 `facility`·`perVisitCoverageLimit`, 입원
//   `priorAnnualPaid`)은 종전대로 계산 / 세대별 직접 진입점은 손대지 않음 /
//   산식·규칙값·한도·HOLD·화면 정책 불변.
import { readFileSync } from "node:fs";
import { calculate } from "../src/lib/insurance/engine/engine";
import { calcStandardized } from "../src/lib/insurance/engine/generationStandardized";
import { calc2021 } from "../src/lib/insurance/engine/generation2021";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import type { ClaimInput, Generation } from "../src/lib/insurance/engine/types";
import { ALWAYS_ACCEPTED_AXES } from "../src/lib/insurance/engine/engine";
import type { LegacyClaimInput, Gen2021ClaimInput, Gen2026RouterInput } from "../src/lib/insurance/engine/engine";

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
const notesOf = (x: Caught) => threw(x) ? [] : (((x.r.notes as string[]) ?? []));
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

/** 다른 진입점이 소유한 축 — `ClaimInput`에 선언조차 없어 변수 경유가 전부 통과했다. */
const OTHER_ENTRY = ["cause", "outpatientCoverageLimit", "annualCoverageLimit",
  "priorAnnualInsurancePaid", "priorAnnualRiderPaid", "priorAnnualOutpatientVisits",
  "priorAnnualOutpatientDays", "priorAnnualPrescriptions", "priorAnnualRiderVisits",
  "approvedThroughVisit", "priorAnnualCoveredCount", "priorAnnualTreatmentActCount",
  "priorAnnualInpatientDeductible", "injectionPurpose", "item", "rider", "route"] as const;
const CONTAINER = ["lines", "amounts", "stays", "roomChargeTotal", "inpatientDays"] as const;
/** 후보 목록(engine.ts의 ROUTER_AXES)과 같은 31종. 어긋나면 §12의 완전성 검사가 잡는다. */
// ⚠ G-34B에서 `generation`이 더해졌다(결과 필드이지 입력 축이 아니다 — 세대는 첫 인자다).
//   묶음·항목 진입점이 같은 축을 닫으면서 라우터도 형제 정렬로 함께 닫았다. 모집단이
//   16경로군 × 34축 = 544 → 16 × 35 = 560이 되고, 늘어난 16자리는 전부 확정 stray다.
const ROUTER_AXES_FOR_TEST = ["nhisCoinsuranceRate", "severity", "nonBenefitItem", "priorAnnualDeductible",
  "perVisitCoverageLimit", "tier", "plan", "facility", "priorAnnualPaid",
  ...OTHER_ENTRY, ...CONTAINER, "generation"] as const;
const NORMAL: Record<string, unknown> = {
  cause: "injury", outpatientCoverageLimit: 200_000, annualCoverageLimit: 5_000_000,
  priorAnnualInsurancePaid: 1_000, priorAnnualRiderPaid: 1_000, priorAnnualOutpatientVisits: 1,
  priorAnnualOutpatientDays: 1, priorAnnualPrescriptions: 1, priorAnnualRiderVisits: 1,
  approvedThroughVisit: 20, priorAnnualCoveredCount: 1, priorAnnualTreatmentActCount: 1,
  priorAnnualInpatientDeductible: 1_000, injectionPurpose: "anticancer",
  item: "musculoskeletal_esw", rider: "injection", route: "general",
  lines: [{ amount: A, visit: "outpatient" }], amounts: [A],
  stays: [{ roomChargeTotal: 400_000, inpatientDays: 2 }], roomChargeTotal: 400_000, inpatientDays: 2,
  tier: "hospital", plan: "standard", facility: "hospital", priorAnnualPaid: 1_000,
  perVisitCoverageLimit: 200_000,
};

/** 기준선 OK 경로 — 이 표가 스윕의 정의역이다. */
const OK_PATHS: [Generation, string, Any][] = [];
for (const g of ["2009", "2017"] as const) for (const pl of ["standard", "selective"]) for (const cov of ["benefit", "non_benefit"]) {
  OK_PATHS.push([g, `${g}·${cov}·통원·${pl}`, { amount: A, coverage: cov, visit: "outpatient", plan: pl, facility: "clinic" }]);
  OK_PATHS.push([g, `${g}·${cov}·입원·${pl}`, { amount: A, coverage: cov, visit: "inpatient", plan: pl }]);
}
for (const cov of ["benefit", "non_benefit"]) for (const t of ["clinic", "hospital"]) {
  OK_PATHS.push(["2021", `2021·${cov}·통원·${t}`, { amount: A, coverage: cov, visit: "outpatient", tier: t }]);
  OK_PATHS.push(["2021", `2021·${cov}·입원·${t}`, { amount: A, coverage: cov, visit: "inpatient", tier: t }]);
}
for (const sev of ["critical", "non_critical"]) {
  OK_PATHS.push(["2026", `2026·비급여·${sev}·통원`, { amount: A, coverage: "non_benefit", visit: "outpatient", severity: sev, nonBenefitItem: "general" }]);
  OK_PATHS.push(["2026", `2026·비급여·${sev}·입원`, { amount: A, coverage: "non_benefit", visit: "inpatient", severity: sev, nonBenefitItem: "general", tier: "hospital" }]);
}
OK_PATHS.push(["2026", "2026·급여·통원", { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2 }]);
OK_PATHS.push(["2026", "2026·급여·입원", { amount: A, coverage: "benefit", visit: "inpatient", tier: "clinic" }]);

const f = (g: Generation, i: Any) => wrap(() => calculate(g, i as unknown as ClaimInput));

console.log("\n[G-34A] 1. 다른 진입점의 축은 네 세대 전 경로에서 거부한다");
{
  for (const [gen, name, base] of OK_PATHS) for (const key of [...OTHER_ENTRY, ...CONTAINER]) {
    const r = f(gen, { ...base, [key]: NORMAL[key] });
    check(`${name} · ${key} → 거부`, isRejected(r, gen, A) && note0(r).startsWith(`${gen}세대: `),
      `${statusOf(r)} ${note0(r).slice(0, 30)}`);
  }
}

console.log("\n[G-34A] 2. 세대끼리 바꿔 쓸 수 없는 축 — 소유하지 않은 세대에서 거부");
{
  // 2·3세대는 `tier`를 읽지 않는다(통원 공제는 `facility` 표로 가른다).
  for (const [gen, name, base] of OK_PATHS.filter(([g]) => g === "2009" || g === "2017")) {
    const r = f(gen, { ...base, tier: "hospital" });
    check(`${name} · tier → 거부`, isRejected(r, gen, A) && note0(r).includes("facility"), statusOf(r));
  }
  // 4·5세대는 `plan`·`facility`를 읽지 않는다.
  for (const [gen, name, base] of OK_PATHS.filter(([g]) => g === "2021" || g === "2026")) {
    for (const key of ["plan", "facility"]) {
      const r = f(gen, { ...base, [key]: NORMAL[key] });
      check(`${name} · ${key} → 거부`, isRejected(r, gen, A) && note0(r).includes(key), statusOf(r));
    }
  }
  // 4세대는 `priorAnnualPaid`(2·3세대 입원 상한 축)를 전 경로에서 읽지 않는다.
  for (const [, name, base] of OK_PATHS.filter(([g]) => g === "2021")) {
    const r = f("2021", { ...base, priorAnnualPaid: 1_000 });
    check(`${name} · priorAnnualPaid → 거부`, isRejected(r, "2021", A) && note0(r).includes("priorAnnualPaid"), statusOf(r));
  }
}

console.log("\n[G-34A] 3. 경로별 소유권 — 같은 축이 한 경로에서는 소비, 다른 경로에서는 거부");
{
  for (const gen of ["2009", "2017"] as const) for (const pl of ["standard", "selective"] as const) {
    const out: Any = { amount: A, coverage: "benefit", visit: "outpatient", plan: pl, facility: "clinic" };
    const inp: Any = { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: pl };
    // 통원: facility·perVisitCoverageLimit 소비 / priorAnnualPaid 거부(값 0 포함)
    check(`${gen} 통원 ${pl} · facility 소비`, statusOf(f(gen, out)) === "OK");
    const lim = f(gen, { ...out, amount: 1_000_000, perVisitCoverageLimit: 200_000 });
    check(`${gen} 통원 ${pl} · perVisitCoverageLimit 소비`, statusOf(lim) === "OK"
      && JSON.stringify(lim).includes("PER_VISIT"), shape(lim).slice(0, 80));
    for (const v of [0, 1_000, 2_000_000]) {
      const r = f(gen, { ...out, priorAnnualPaid: v });
      check(`${gen} 통원 ${pl} · priorAnnualPaid=${v} → 거부`, isRejected(r, gen, A)
        && note0(r).includes("priorAnnualPaid"), statusOf(r));
    }
    // 입원: priorAnnualPaid 소비 / facility·perVisitCoverageLimit 거부(값 0 포함)
    // ⚠ 선택형은 10%×1500만 = 150만으로 200만 상한에 닿지 않아 기납부 50만으로는 결과가
    //   달라지지 않는다. 두 형태 모두에서 소비가 드러나는 값(상한 전액)을 쓴다.
    const p = f(gen, { ...inp, priorAnnualPaid: 2_000_000 });
    check(`${gen} 입원 ${pl} · priorAnnualPaid 소비`, statusOf(p) === "OK"
      && shape(p) !== shape(f(gen, { ...inp, priorAnnualPaid: 0 })), shape(p).slice(0, 80));
    for (const v of [0, "clinic", "pharmacy"]) {
      const r = f(gen, { ...inp, facility: v });
      check(`${gen} 입원 ${pl} · facility=${String(v)} → 거부`, isRejected(r, gen, 15_000_000)
        && note0(r).includes("facility"), statusOf(r));
    }
    for (const v of [0, 200_000]) {
      const r = f(gen, { ...inp, perVisitCoverageLimit: v });
      check(`${gen} 입원 ${pl} · perVisitCoverageLimit=${v} → 거부`, isRejected(r, gen, 15_000_000)
        && note0(r).includes("perVisitCoverageLimit"), statusOf(r));
    }
  }
}

console.log("\n[G-34A] 4. 값 격자 — undefined만 미제공과 같고, 나머지는 무엇이든 거부");
{
  const cases: [Generation, Any, string][] = [
    ["2009", { amount: A, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" }, "cause"],
    ["2021", { amount: A, coverage: "non_benefit", visit: "inpatient", tier: "clinic" }, "plan"],
    ["2026", { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general" }, "lines"],
  ];
  for (const [gen, base, key] of cases) {
    const plain = f(gen, { ...base });
    check(`${gen} ${key}: 키 없음 = OK`, statusOf(plain) === "OK", statusOf(plain));
    check(`${gen} ${key}: undefined는 미제공과 동일`, shape(f(gen, { ...base, [key]: undefined })) === shape(plain));
    for (const [label, v] of VALUES) {
      const r = f(gen, { ...base, [key]: v });
      check(`${gen} ${key}=${label} → 거부`, isRejected(r, gen, A), statusOf(r));
    }
  }
}

console.log("\n[G-34A] 5. 안전 표시 — 값 자체를 안내에 싣지 않는다");
{
  const base: Any = { amount: A, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" };
  for (const [label, v] of VALUES) {
    const r = f("2009", { ...base, item: v });
    check(`2009 item=${label}: typeof만 싣는다`, isRejected(r, "2009", A)
      && notesOf(r).some((n) => n === `받은 값의 형식: ${typeof v}`), statusOf(r));
  }
  // ⚠ `{ ...base, ...thrower }`처럼 스프레드로 만들면 **전개하는 순간** 접근자가 실행돼
  //   `wrap` 밖에서 던진다. 라우터의 동작이 아니라 픽스처가 던지는 것이므로 정의로 붙인다.
  const thrower: Any = { ...base };
  Object.defineProperty(thrower, "item", { get() { throw new Error("boom"); }, enumerable: true, configurable: true });
  check("접근자가 던지면 안내를 만들지 않고 예외가 그대로 전파된다",
    statusOf(wrap(() => calculate("2009", thrower as unknown as ClaimInput))) === "THROW");
}

console.log("\n[G-34A] 6. 읽는 계약 — 각 축을 한 번만, 선행 preflight가 정하면 아예 읽지 않는다");
{
  const base: Any = { amount: A, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" };
  for (const key of ["cause", "item", "lines", "tier"]) {
    let reads = 0;
    const o: Any = { ...base };
    Object.defineProperty(o, key, { get() { reads++; return NORMAL[key]; }, enumerable: true, configurable: true });
    const r = f("2009", o);
    check(`2009 ${key}: 접근자 1회`, reads === 1 && isRejected(r, "2009", A), `읽기 ${reads}회 ${statusOf(r)}`);
  }
  // 선행 preflight가 결과를 정한 경로에서는 stray 이름을 읽지 않는다.
  const blocked: [Generation, string, Any][] = [
    ["2009", "표준형/선택형 미지정", { amount: A, coverage: "benefit", visit: "outpatient", facility: "clinic" }],
    ["2026", "치료유형 미지정", { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical" }],
    ["2026", "중증도 무효값", { amount: A, coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "general", severity: "HIGH" }],
    ["2026", "급여 입원 nhis stray", { amount: A, coverage: "benefit", visit: "inpatient", tier: "clinic", nhisCoinsuranceRate: 0.2 }],
  ];
  for (const [gen, label, base2] of blocked) {
    const plain = f(gen, { ...base2 });
    check(`${gen} ${label}: 기준이 계산 불가`, statusOf(plain) === "PENDING_UNVERIFIED", statusOf(plain));
    // ⚠ 그 경로를 막고 있는 **필수 축 자체**는 넣으면 차단이 풀린다(2·3세대의 `plan`).
    //   차단이 풀린 결과를 "읽지 않았다"의 반례로 세면 안 되므로 미리 뺀다.
    const probe = ["cause", "item", "lines", "plan", "facility"]
      .filter((k) => !(gen !== "2026" && k === "plan"));
    for (const key of probe) {
      if (base2[key] !== undefined) continue;
      let reads = 0;
      const o: Any = { ...base2 };
      Object.defineProperty(o, key, { get() { reads++; return NORMAL[key]; }, enumerable: true, configurable: true });
      const r = f(gen, o);
      check(`${gen} ${label} + ${key}: 읽지 않고 선행 안내 유지`, reads === 0 && shape(r) === shape(plain),
        `읽기 ${reads}회 ${statusOf(r)}`);
    }
  }
}

console.log("\n[G-34A] 7. 분류표 — 모집단 16경로군 × 34축 = 544자리, 분류 합계가 모집단과 같다");
{
  // ⚠ 미리 제외하는 축은 없다. `amount`·`coverage`·`visit`처럼 어느 세대에서도 막지 않는 축도
  //   표에 남긴다 — 총수와 분류 합계가 맞아야 검증할 수 있다.
  // 분류(6종): 1 산식·분기에서 실제 소비 / 2 결과 차등은 없으나 의미상 허용된 입력 /
  //            3 근거 있는 공통 통로 / 4 선행 차단 미도달 / 5 확정 stray / 6 판단 보류
  type Cat = 1 | 2 | 3 | 4 | 5 | 6;
  const GROUPS = [
    "2009|benefit|outpatient", "2009|benefit|inpatient", "2009|non_benefit|outpatient", "2009|non_benefit|inpatient",
    "2017|benefit|outpatient", "2017|benefit|inpatient", "2017|non_benefit|outpatient", "2017|non_benefit|inpatient",
    "2021|benefit|outpatient", "2021|benefit|inpatient", "2021|non_benefit|outpatient", "2021|non_benefit|inpatient",
    "2026|benefit|outpatient", "2026|benefit|inpatient", "2026|non_benefit|outpatient", "2026|non_benefit|inpatient",
  ] as const;
  const ALL_AXES = [...ALWAYS_ACCEPTED_AXES, ...ROUTER_AXES_FOR_TEST] as readonly string[];
  check(`축 35종 · 경로군 16 (모집단 ${GROUPS.length * ALL_AXES.length}자리)`,
    ALL_AXES.length === 35 && GROUPS.length === 16, `축 ${ALL_AXES.length} 경로군 ${GROUPS.length}`);

  /** cat1 — 세대별 **직접 진입점**으로 측정한 실제 소비(라우터 가드가 읽는 것은 세지 않는다). */
  const CONSUMED: Record<string, readonly string[]> = {
    "2009|benefit|outpatient": ["amount", "visit", "plan", "facility", "perVisitCoverageLimit"],
    "2009|benefit|inpatient": ["amount", "visit", "plan", "priorAnnualPaid"],
    "2009|non_benefit|outpatient": ["amount", "visit", "plan", "facility", "perVisitCoverageLimit"],
    "2009|non_benefit|inpatient": ["amount", "visit", "plan", "priorAnnualPaid"],
    "2021|benefit|outpatient": ["amount", "coverage", "visit", "tier"],
    "2021|benefit|inpatient": ["amount", "coverage", "visit"],
    "2021|non_benefit|outpatient": ["amount", "coverage", "visit"],
    "2021|non_benefit|inpatient": ["amount", "coverage", "visit"],
    "2026|benefit|outpatient": ["amount", "coverage", "visit", "tier", "nhisCoinsuranceRate", "priorAnnualPaid", "priorAnnualDeductible", "perVisitCoverageLimit", "severity", "nonBenefitItem"],
    "2026|benefit|inpatient": ["amount", "coverage", "visit", "nhisCoinsuranceRate", "priorAnnualPaid", "priorAnnualDeductible", "perVisitCoverageLimit", "severity", "nonBenefitItem"],
    "2026|non_benefit|outpatient": ["amount", "coverage", "visit", "nhisCoinsuranceRate", "priorAnnualPaid", "priorAnnualDeductible", "perVisitCoverageLimit", "severity", "nonBenefitItem"],
    "2026|non_benefit|inpatient": ["amount", "coverage", "visit", "tier", "nhisCoinsuranceRate", "priorAnnualPaid", "priorAnnualDeductible", "perVisitCoverageLimit", "severity", "nonBenefitItem"],
  };
  for (const g of ["2009|benefit|outpatient", "2009|benefit|inpatient", "2009|non_benefit|outpatient", "2009|non_benefit|inpatient"])
    CONSUMED[g.replace("2009", "2017")] = CONSUMED[g];
  /** cat2 — 결과 차등은 없지만 **그 축의 허용을 목적으로 하는** 기존 검사가 있는 자리. */
  const SEMANTIC = new Set(GROUPS.filter((g) => g.startsWith("2009") || g.startsWith("2017")).map((g) => `${g}|coverage`));
  /** cat3 — 문서·API 계약이 공용 통로임을 명시한 자리. 현재 없다. */
  const COMMON_CHANNEL = new Set<string>();
  /** cat6 — 조용히 버려지지만 확정에 **추가 결정**이 필요한 자리. */
  const HELD = new Set([
    "2021|benefit|inpatient|tier", "2021|non_benefit|outpatient|tier", "2021|non_benefit|inpatient|tier",
    "2026|benefit|inpatient|tier", "2026|non_benefit|outpatient|tier",
  ]);
  const catOf = (grp: string, ax: string): Cat =>
    (CONSUMED[grp] ?? []).includes(ax) ? 1
      : SEMANTIC.has(`${grp}|${ax}`) ? 2
      : COMMON_CHANNEL.has(`${grp}|${ax}`) ? 3
      : HELD.has(`${grp}|${ax}`) ? 6 : 5;
  const count: Record<Cat, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const grp of GROUPS) for (const ax of ALL_AXES) count[catOf(grp, ax)]++;
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  check(`분류 합계가 모집단과 같다 (${total})`, total === GROUPS.length * ALL_AXES.length, String(total));
  check(`cat1 실제 소비 ${count[1]}`, count[1] === 87, String(count[1]));
  check(`cat2 의미상 허용 ${count[2]}`, count[2] === 8, String(count[2]));
  check(`cat3 공통 통로 ${count[3]} — 근거가 있는 자리는 아직 없다`, count[3] === 0, String(count[3]));
  check(`cat4 선행 차단 미도달 ${count[4]}`, count[4] === 0, String(count[4]));
  check(`cat5 확정 stray ${count[5]}`, count[5] === 460, String(count[5]));
  check(`cat6 판단 보류 ${count[6]}`, count[6] === 5, String(count[6]));

  // 표와 구현이 어긋나면 여기서 잡힌다 — cat5만 거부되고 나머지는 통과해야 한다.
  const GBASE: Record<string, Any> = {
    "2009|benefit|outpatient": { amount: A, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" },
    "2009|benefit|inpatient": { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: "standard" },
    "2009|non_benefit|outpatient": { amount: A, coverage: "non_benefit", visit: "outpatient", plan: "standard", facility: "clinic" },
    "2009|non_benefit|inpatient": { amount: 15_000_000, coverage: "non_benefit", visit: "inpatient", plan: "standard" },
    "2021|benefit|outpatient": { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic" },
    "2021|benefit|inpatient": { amount: A, coverage: "benefit", visit: "inpatient", tier: "clinic" },
    "2021|non_benefit|outpatient": { amount: A, coverage: "non_benefit", visit: "outpatient", tier: "clinic" },
    "2021|non_benefit|inpatient": { amount: A, coverage: "non_benefit", visit: "inpatient", tier: "clinic" },
    "2026|benefit|outpatient": { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2 },
    "2026|benefit|inpatient": { amount: A, coverage: "benefit", visit: "inpatient", tier: "clinic" },
    "2026|non_benefit|outpatient": { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general" },
    "2026|non_benefit|inpatient": { amount: A, coverage: "non_benefit", visit: "inpatient", severity: "critical", nonBenefitItem: "general", tier: "hospital" },
  };
  for (const g of Object.keys(GBASE).filter((k) => k.startsWith("2009"))) GBASE[g.replace("2009", "2017")] = { ...GBASE[g] };
  const PROBE_VAL: Record<string, unknown> = { ...NORMAL, generation: "2009", amount: 700_000, nhisCoinsuranceRate: 0.2,
    severity: "non_critical", nonBenefitItem: "general", priorAnnualDeductible: 1_000, perVisitCoverageLimit: 200_000 };
  for (const grp of GROUPS) {
    const gen = grp.split("|")[0] as Generation;
    const base = GBASE[grp];
    let bad = 0; const first: string[] = [];
    for (const ax of ALL_AXES) {
      // ⚠ `coverage`·`visit`을 다른 값으로 바꾸면 **경로군 자체가 달라진다.** 두 축은 base의
      //   값을 그대로 실어 "실려 있을 때 거부되는가"만 본다.
      const val = (ax === "coverage" || ax === "visit") ? base[ax] : PROBE_VAL[ax];
      const r = f(gen, { ...base, [ax]: val });
      const rejected = statusOf(r) === "PENDING_UNVERIFIED" && note0(r).startsWith(`${gen}세대: `);
      if (rejected !== (catOf(grp, ax) === 5)) { bad++; if (first.length < 3) first.push(`${ax}(cat${catOf(grp, ax)}→${rejected ? "거부" : "통과"})`); }
    }
    check(`${grp}: 34축 분류와 구현 일치`, bad === 0, first.join(", "));
  }
}

console.log("\n[G-34A] 7b. 판단 보류 5자리 — 막지 않되 근거를 코드에 남긴다");
{
  // 보류는 "허용"이 아니다. 지금은 통과시키되, 무엇이 정해져야 확정되는지 코드에 적는다.
  for (const [cov, v] of [["benefit", "inpatient"], ["non_benefit", "outpatient"], ["non_benefit", "inpatient"]] as const) {
    const r = f("2021", { amount: A, coverage: cov, visit: v, tier: "hospital" });
    check(`2021 ${cov}·${v}: tier 보류(막지 않음)`, statusOf(r) === "OK", statusOf(r));
  }
  const held26 = [
    f("2026", { amount: A, coverage: "benefit", visit: "inpatient", tier: "hospital" }),
    f("2026", { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general", tier: "clinic" }),
  ];
  held26.forEach((r, i) => check(`2026 보류 tier ${i + 1}: 막지 않음`, statusOf(r) === "OK", statusOf(r)));
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  check("보류 칸의 이름이 '공통 통로'가 아니다", /readonly held: readonly RouterAxis\[\];/.test(src) && !/commonChannel/.test(src));
  check("UI 편의를 허용 근거로 쓰지 않는다고 적혀 있다",
    src.includes("UI 구현 편의**이지, 나머지 경로에서 조용히 버리는 것이 공개"));
  check("근거 있는 공통 통로가 아직 없다고 적혀 있다", src.includes("현재 **한 자리도 없다.**"));
  check("2021 tier 보류의 확정 조건이 적혀 있다", src.includes("입력 구성을 함께 바꾸는 결정**이 있어야 확정된다"));
  check("2026 tier 보류의 확정 조건이 적혀 있다", src.includes("확정 지점이 다른 파일"));
  const ui = readFileSync("src/components/calculators/HealthCalc.tsx", "utf8");
  check("2021 화면이 네 경로 모두에 tier를 싣는 것은 사실이다(허용 근거는 아니다)",
    /calculate\("2021", \{ amount: parsed, coverage, visit, tier \}\)/.test(ui));
}

console.log("\n[G-34A] 8. 세대별 직접 진입점은 손대지 않는다");
{
  // 라우터가 막는 축을 직접 진입점에 그대로 넣으면 **종전대로** 계산된다(G-34C의 대상).
  const std = calcStandardized("2009", { amount: A, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic", ...( { cause: "injury" } as Any) } as unknown as ClaimInput);
  check("calcStandardized: cause를 넣어도 종전대로 OK", std.status === "OK", std.status);
  const g21 = calc2021({ amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", ...({ plan: "standard" } as Any) } as unknown as ClaimInput);
  check("calc2021: plan을 넣어도 종전대로 OK", g21.status === "OK", g21.status);
  const g26 = calc2026({ amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general", ...({ item: "mri" } as Any) } as never);
  check("calc2026: item을 넣어도 종전대로 OK", g26.status === "OK", g26.status);
}

console.log("\n[G-34A] 9. 소비 축과 산식은 그대로다");
{
  const out = calculate("2009", { amount: A, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" });
  check("2009 표준형 통원 30만원 자기부담 60,000원", out.status === "OK" && out.ownPay === 60_000, String(out.ownPay));
  const inp = calculate("2017", { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: "standard", priorAnnualPaid: 500_000 });
  check("2017 표준형 입원 1500만 + 기납부 50만 → 잔여 150만", inp.status === "OK" && inp.ownPay === 1_500_000, String(inp.ownPay));
  const g21 = calculate("2021", { amount: A, coverage: "non_benefit", visit: "outpatient", tier: "clinic" });
  // 4세대 비급여 통원 30만원의 기준선 값(`5ea987c`)과 같다 — 이 커밋은 산식을 건드리지 않는다.
  check("2021 비급여 통원 30만원 종전 결과", g21.status === "OK" && g21.ownPay === 100_000, String(g21.ownPay));
  const g26 = calculate("2026", { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general" } as never);
  check("2026 중증 비급여 통원 30만원 종전 결과", g26.status === "OK" && g26.ownPay === 90_000, String(g26.ownPay));
}

console.log("\n[G-34A] 10. 구조 — 소유권 표가 하나이고, 목록과 타입이 같은 표에서 파생한다");
{
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("소유권 표가 세대별로 하나씩 선언돼 있다",
    /const OWNERSHIP: Record<Generation, Ownership> = \{/.test(code));
  check("거부 목록이 소유권 표에서 파생된다(따로 적지 않는다)",
    /return ROUTER_AXES\.filter\(\(k\) => !owned\.has\(k\)\);/.test(code));
  check("경로 판정식이 세대 엔진의 소비 분기와 같은 모양이다",
    /input\.visit === "outpatient" \? byVisit\.outpatient : byVisit\.inpatient;/.test(code));
  check("타입 봉인이 같은 표에서 파생된다",
    /type ForeignAxis = \(typeof OTHER_ENTRY_AXES\)\[number\] \| \(typeof CONTAINER_AXES\)\[number\];/.test(code));
  check("경로별 축은 타입으로 닫지 않은 이유가 기록돼 있다",
    src.includes("`visit`으로 유니온을 쪼개면 호출부가 `visit`을 변수로 넘기는 자리에서 `as` 없이"));
  check("각 키를 한 번만 읽는다",
    /const got: unknown = \(input as unknown as Record<string, unknown>\)\[key\];\n\s*if \(got === undefined\) continue;/.test(src));
  check("in 연산자가 아니라 !== undefined로 본다", !/"(cause|item|lines|plan|facility)" in /.test(code));
  check("안내에 typeof만 싣는다", /받은 값의 형식: \$\{typeof got\}/.test(src));
  check("showValue를 쓰지 않는다(이 파일의 G-15 계약)", !/showValue/.test(code));
}

console.log("\n[G-34A] 11. 타입 — 경로와 무관하게 막는 축만 봉인한다");
{
  /** 엄격판: 미선언도 실패로 본다. */
  type Sealed<T, K extends string> = K extends keyof T ? ([T[K]] extends [undefined] ? true : false) : false;
  const sealed = <T, K extends string>(v: Sealed<T, K>): boolean => v as unknown as boolean;
  check("Legacy(2·3세대): tier 봉인", sealed<LegacyClaimInput, "tier">(true));
  check("Legacy(2·3세대): cause 봉인", sealed<LegacyClaimInput, "cause">(true));
  check("Legacy(2·3세대): lines 봉인", sealed<LegacyClaimInput, "lines">(true));
  check("Legacy(2·3세대): severity 봉인(G-33 유지)", sealed<LegacyClaimInput, "severity">(true));
  check("Legacy(2·3세대): facility는 봉인하지 않는다(통원 소비)", !sealed<LegacyClaimInput, "facility">(false));
  check("Legacy(2·3세대): priorAnnualPaid는 봉인하지 않는다(입원 소비)", !sealed<LegacyClaimInput, "priorAnnualPaid">(false));
  check("Legacy(2·3세대): perVisitCoverageLimit은 봉인하지 않는다(통원 소비)", !sealed<LegacyClaimInput, "perVisitCoverageLimit">(false));
  check("2021: plan 봉인", sealed<Gen2021ClaimInput, "plan">(true));
  check("2021: facility 봉인", sealed<Gen2021ClaimInput, "facility">(true));
  check("2021: priorAnnualPaid 봉인", sealed<Gen2021ClaimInput, "priorAnnualPaid">(true));
  check("2021: perVisitCoverageLimit 봉인", sealed<Gen2021ClaimInput, "perVisitCoverageLimit">(true));
  check("2021: tier는 봉인하지 않는다(확정 공통 통로)", !sealed<Gen2021ClaimInput, "tier">(false));
  check("2026: plan 봉인", sealed<Gen2026RouterInput, "plan">(true));
  check("2026: facility 봉인", sealed<Gen2026RouterInput, "facility">(true));
  check("2026: route 봉인", sealed<Gen2026RouterInput, "route">(true));
  check("2026: severity는 봉인하지 않는다(5세대 소비 축)", !sealed<Gen2026RouterInput, "severity">(false));
  check("2026: tier는 봉인하지 않는다(후속 확정 대상)", !sealed<Gen2026RouterInput, "tier">(false));
  check("ClaimInput(넓은 통로)은 봉인하지 않는다", !sealed<ClaimInput, "tier">(false));
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  check("2·3세대 오버로드", /export function calculate\(generation: "2009" \| "2017", input: LegacyClaimInput\): CalcResult;/.test(src));
  check("2021 오버로드", /export function calculate\(generation: "2021", input: Gen2021ClaimInput\): CalcResult;/.test(src));
  check("2026 오버로드", /export function calculate\(generation: "2026", input: Gen2026RouterInput\): CalcResult;/.test(src));
  check("넓은 오버로드는 남긴다(변수 세대 호출부 보존)",
    /export function calculate\(generation: Generation, input: ClaimInput\): CalcResult;/.test(src));
}

console.log("\n[G-34A] 12. 완전성 — types.ts에 입력 축이 늘면 소유권 표도 함께 늘어야 한다");
{
  // ⚠ 이 검사가 이 커밋의 유통기한을 지킨다. `ROUTER_AXES`에 없는 축은 **막지 못한다** —
  //   나중에 누가 `types.ts`에 입력 축을 추가하고 표를 잊으면 그 축이 다시 조용히 버려진다.
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  const src = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  const listed = new Set([...src.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)].map((m) => m[1]));
  // 입력 계열 선언 블록만 본다(결과 타입 Result·LineResult는 제외).
  const blocks = [...types.matchAll(/(?:export )?interface (\w+) \{([\s\S]*?)\n\}/g)]
    .filter(([, name]) => /Input$|Line$|Stay$/.test(name) && !/Result/.test(name));
  const axes = new Set<string>();
  for (const [, , body] of blocks) {
    for (const m of body.matchAll(/^\s{2}(\w+)\??\s*:/gm)) axes.add(m[1]);
  }
  // 어느 세대에서도 막지 않는 축은 engine.ts가 **상수로** 선언한다(테스트가 따로 적지 않는다).
  const NEVER_REJECTED = new Set<string>([...ALWAYS_ACCEPTED_AXES, "policyDate"]);
  check(`입력 축을 실제로 수집했다 (${axes.size}종)`, axes.size >= 25, String(axes.size));
  const missing = [...axes].filter((a) => !listed.has(a) && !NEVER_REJECTED.has(a));
  check("모든 입력 축이 소유권 표(ROUTER_AXES)에 실려 있다", missing.length === 0, `누락: ${missing.join(", ")}`);
}

console.log(`\n[G-34A 제네릭 라우터 소유권] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
