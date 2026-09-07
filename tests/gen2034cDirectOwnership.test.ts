// G-34C — 세대별 **직접 진입점**(calcStandardized·calc2021·calc2026)의 입력 소유권 확정,
//   4세대 활성 종별의 값 검증, 그리고 호출당 단일 읽기.
//
// 모집단: 3진입점 × 18경로군 × 35축 = **630자리**.
//   6분류 결과 — 합계가 모집단과 같다:
//     1 산식·분기에서 실제 소비 75 / 2 결과 차등 없으나 의미상 허용 15 /
//     3 근거 있는 공통 통로 0 / 4 선행 차단 미도달 0 / 5 확정 stray 540 / 6 판단 보류 **0**
//   cat5 540 = 기준선에서 이미 봉인 24(전부 `calc2026`) + **이번에 봉인 516**.
//
// ⚠ **판단 보류 7자리가 여기서 0이 됐다.** G-34A의 라우터 5자리와 G-34B의 다회 2자리는
//   전부 `tier`였고, 직접 진입점 실측에서 접근자 호출 0회·모든 값 결과 무변화였다. 허용 근거를
//   찾으려고 기준선 엔진에 계측 래퍼를 넣고 테스트 77개 파일을 돌려 OK였던 25,025건을 경로군에
//   매핑했지만, **그 축의 허용을 목적으로 하는 검사는 하나도 없었다.** 오히려 반대 방향의
//   계약이 있었다("2·3세대는 tier를 읽지 않는다", "화면이 네 경로에 싣는 것은 허용 근거가 아니다").
//
// ⚠ 측정 도구에서 고친 오류 3건(고치기 전 수치는 폐기했다):
//   ① 결과 지문이 다회 필드(`total*`)만 봐서 단건의 `ownPay`가 전부 undefined로 같아졌다 —
//      실제로 소비되는 `tier`·`facility`가 미소비로 보였다(cat1 57 → 75).
//   ② 금액 배율이 컨테이너 축만 스케일해 스칼라 `amount`를 건드리지 않았다.
//   ③ 배율 폭이 좁아 최소공제(1~2만)가 구속되는 구간에 닿지 않았다(×0.01·×0.001 추가).
import { readFileSync } from "node:fs";
import { calcStandardized } from "../src/lib/insurance/engine/generationStandardized";
import { calc2021 } from "../src/lib/insurance/engine/generation2021";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculate } from "../src/lib/insurance/engine/engine";
import type { CalcResult, ClaimInput } from "../src/lib/insurance/engine/types";

type Any = Record<string, unknown>;
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
};
const wrap = (f: () => CalcResult) => { try { return { r: f() }; } catch (e) { return { threw: String(e) }; } };
type Caught = ReturnType<typeof wrap>;
const threw = (c: Caught) => "threw" in c;
const st = (c: Caught) => (threw(c) ? "THREW" : c.r!.status);
const note0 = (c: Caught) => (threw(c) ? "" : String(c.r!.notes?.[0] ?? ""));

const AXES = [
  "amount", "amounts", "lines", "stays", "roomChargeTotal", "inpatientDays",
  "generation", "coverage", "visit", "cause", "severity", "tier", "facility", "plan",
  "route", "item", "rider", "nonBenefitItem", "injectionPurpose", "nhisCoinsuranceRate",
  "perVisitCoverageLimit", "outpatientCoverageLimit", "annualCoverageLimit",
  "priorAnnualPaid", "priorAnnualDeductible", "priorAnnualInpatientDeductible",
  "priorAnnualInsurancePaid", "priorAnnualRiderPaid",
  "priorAnnualOutpatientVisits", "priorAnnualOutpatientDays", "priorAnnualPrescriptions",
  "priorAnnualRiderVisits", "approvedThroughVisit", "priorAnnualCoveredCount",
  "priorAnnualTreatmentActCount",
] as const;
/** 축마다 그 축이 **어딘가에서 정상인** 리터럴 하나. 값이 무효라서 막히는 것과 섞이지 않게 한다. */
const NORMAL: Record<string, unknown> = {
  amount: 300_000, amounts: [300_000], lines: [{ amount: 300_000, visit: "outpatient" }],
  stays: [{ roomChargeTotal: 400_000, inpatientDays: 2 }], roomChargeTotal: 400_000, inpatientDays: 2,
  generation: "2009", coverage: "benefit", visit: "outpatient", cause: "injury",
  severity: "critical", tier: "hospital", facility: "hospital", plan: "standard",
  route: "general", item: "mri", rider: "injection", nonBenefitItem: "general",
  injectionPurpose: "anticancer", nhisCoinsuranceRate: 0.2,
  perVisitCoverageLimit: 200_000, outpatientCoverageLimit: 200_000, annualCoverageLimit: 5_000_000,
  priorAnnualPaid: 1_000, priorAnnualDeductible: 1_000, priorAnnualInpatientDeductible: 1_000,
  priorAnnualInsurancePaid: 1_000, priorAnnualRiderPaid: 1_000,
  priorAnnualOutpatientVisits: 1, priorAnnualOutpatientDays: 1, priorAnnualPrescriptions: 1,
  priorAnnualRiderVisits: 1, approvedThroughVisit: 20, priorAnnualCoveredCount: 1,
  priorAnnualTreatmentActCount: 1,
};

const A = 30_000_000;
type Group = { entry: string; label: string; call: (i: Any) => CalcResult; base: Any };
const GROUPS: Group[] = [];
for (const gen of ["2009", "2017"] as const)
  for (const cov of ["benefit", "non_benefit"] as const)
    for (const v of ["outpatient", "inpatient"] as const)
      GROUPS.push({ entry: "calcStandardized",
        label: `calcStandardized|${gen}|${cov === "benefit" ? "급여" : "비급여"}|${v === "outpatient" ? "통원" : "입원"}`,
        call: (i) => calcStandardized(gen, i as unknown as ClaimInput),
        base: { amount: A, coverage: cov, visit: v, plan: "standard", ...(v === "outpatient" ? { facility: "clinic" } : {}) } });
for (const cov of ["benefit", "non_benefit"] as const)
  for (const v of ["outpatient", "inpatient"] as const)
    GROUPS.push({ entry: "calc2021",
      label: `calc2021|${cov === "benefit" ? "급여" : "비급여"}|${v === "outpatient" ? "통원" : "입원"}`,
      call: (i) => calc2021(i as unknown as ClaimInput),
      base: { amount: A, coverage: cov, visit: v, ...(cov === "benefit" && v === "outpatient" ? { tier: "clinic" } : {}) } });
GROUPS.push({ entry: "calc2026", label: "calc2026|급여|통원", call: (i) => calc2026(i as never),
  base: { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2 } });
GROUPS.push({ entry: "calc2026", label: "calc2026|급여|입원", call: (i) => calc2026(i as never),
  base: { amount: A, coverage: "benefit", visit: "inpatient" } });
for (const sev of ["critical", "non_critical"] as const)
  for (const v of ["outpatient", "inpatient"] as const)
    GROUPS.push({ entry: "calc2026",
      label: `calc2026|비급여|${v === "outpatient" ? "통원" : "입원"}|${sev === "critical" ? "중증" : "비중증"}`,
      call: (i) => calc2026(i as never),
      base: { amount: A, coverage: "non_benefit", visit: v, severity: sev, nonBenefitItem: "general",
        ...(v === "inpatient" ? { tier: "hospital" } : {}) } });

/** cat1·cat2 — 그 경로가 소비하거나 타입이 필수로 선언한 축. 나머지 35 − 이것 = cat5. */
const OWNED: Record<string, readonly string[]> = {};
for (const g of GROUPS) {
  const out = g.base.visit === "outpatient";
  if (g.entry === "calcStandardized") OWNED[g.label] = ["amount", "coverage", "visit", "plan", ...(out ? ["facility", "perVisitCoverageLimit"] : ["priorAnnualPaid"])];
  else if (g.entry === "calc2021") OWNED[g.label] = ["amount", "coverage", "visit", ...(out && g.base.coverage === "benefit" ? ["tier"] : [])];
  else {
    const ben = g.base.coverage === "benefit";
    OWNED[g.label] = ["amount", "coverage", "visit",
      ...(ben ? (out ? ["tier", "nhisCoinsuranceRate"] : []) : ["severity", "nonBenefitItem",
        ...(out ? ["perVisitCoverageLimit"] : ["tier"]),
        ...(!out && g.base.severity === "critical" ? ["priorAnnualDeductible"] : [])])];
  }
}

console.log("[G-34C] 0. 모집단과 분류 합계");
{
  check(`모집단 ${GROUPS.length}경로군 × ${AXES.length}축 = 630자리`,
    GROUPS.length === 18 && AXES.length === 35, `${GROUPS.length}×${AXES.length}`);
  let owned = 0;
  for (const g of GROUPS) owned += OWNED[g.label].length;
  check(`cat1+cat2 = 90자리 · cat5 = 540자리`, owned === 90 && 18 * 35 - owned === 540, String(owned));
  check("모든 경로군의 기준선이 OK다 — 소유권 판정의 정의역", GROUPS.every((g) => st(wrap(() => g.call({ ...g.base }))) === "OK"),
    GROUPS.filter((g) => st(wrap(() => g.call({ ...g.base }))) !== "OK").map((g) => g.label).join(", "));
}

console.log("\n[G-34C] 1. 확정 stray 540자리 — 값이 정상이어도 거부한다");
{
  let bad = 0; const first: string[] = [];
  for (const g of GROUPS) for (const ax of AXES) {
    if (OWNED[g.label].includes(ax)) continue;
    const r = wrap(() => g.call({ ...g.base, [ax]: NORMAL[ax] }));
    if (st(r) !== "PENDING_UNVERIFIED") { bad++; if (first.length < 3) first.push(`${g.label}|${ax}→${st(r)}`); }
  }
  check("cat5 540자리 전부 거부", bad === 0, first.join(", "));
}

console.log("\n[G-34C] 2. 값 `0`도 막고 `undefined`만 미제공이다");
{
  let bad0 = 0, badU = 0;
  for (const g of GROUPS) for (const ax of AXES) {
    if (OWNED[g.label].includes(ax)) continue;
    if (st(wrap(() => g.call({ ...g.base, [ax]: 0 }))) !== "PENDING_UNVERIFIED") bad0++;
    const u = wrap(() => g.call({ ...g.base, [ax]: undefined }));
    const b = wrap(() => g.call({ ...g.base }));
    if (JSON.stringify(u) !== JSON.stringify(b)) badU++;
  }
  check("숫자 0도 전부 거부", bad0 === 0, String(bad0));
  check("명시적 undefined는 미제공과 완전히 같다", badU === 0, String(badU));
}

console.log("\n[G-34C] 3. cat1·cat2 90자리 — 과잉 차단 0");
{
  let bad = 0; const first: string[] = [];
  for (const g of GROUPS) for (const ax of OWNED[g.label]) {
    const r = wrap(() => g.call({ ...g.base, [ax]: g.base[ax] ?? NORMAL[ax] }));
    if (st(r) !== "OK") { bad++; if (first.length < 3) first.push(`${g.label}|${ax}→${st(r)} ${note0(r).slice(0, 30)}`); }
  }
  check("소유 축은 하나도 막히지 않는다", bad === 0, first.join(", "));
}

console.log("\n[G-34C] 4. 4세대 활성 종별의 값 검증 — 승인된 열거값");
{
  const out = (t?: unknown) => wrap(() => calc2021({ amount: 30_000, coverage: "benefit", visit: "outpatient",
    ...(t === "OMIT" ? {} : { tier: t }) } as unknown as ClaimInput));
  const okv = (c: Caught) => (threw(c) ? null : c.r!);
  check("clinic → 최소공제 10,000원", okv(out("clinic"))?.minDeductible === 10_000 && okv(out("clinic"))?.ownPay === 10_000,
    JSON.stringify(okv(out("clinic"))?.ownPay));
  check("hospital → 최소공제 20,000원", okv(out("hospital"))?.minDeductible === 20_000 && okv(out("hospital"))?.ownPay === 20_000,
    JSON.stringify(okv(out("hospital"))?.ownPay));
  check("undefined(키 없음) → 기존 clinic 기본값", JSON.stringify(okv(out("OMIT"))) === JSON.stringify(okv(out("clinic"))));
  check("명시적 undefined도 기존 기본값", JSON.stringify(okv(out(undefined))) === JSON.stringify(okv(out("clinic"))));
  // ⚠ `tertiary`는 2·3세대 `Facility`의 값이고 4세대 표(`Tier`)에는 키가 없다. 허용하면
  //   `md["tertiary"]`가 undefined → `Math.max(amount*rate, undefined)`가 NaN → `settle()`의
  //   `Number.isFinite` 폴백에 걸려 **자기부담 0원 = 보험금 전액 지급**으로 끝났다(실측).
  //   `ownPay + insurancePay === amount` 불변식은 유지되므로 하류 검사가 잡지 못한다.
  check("tertiary → 계산 차단", st(out("tertiary")) === "PENDING_UNVERIFIED", st(out("tertiary")));
  check("tertiary 안내가 2·3세대 축임을 밝힌다", note0(out("tertiary")).includes('"clinic" 또는 "hospital"')
    || (threw(out("tertiary")) ? false : String(out("tertiary").r!.notes?.[1] ?? "").includes("facility")));
  const BAD: [string, unknown][] = [["null", null], ["빈 문자열", ""], ["임의 문자열", "ZZZ"],
    ["숫자 0", 0], ["숫자 1", 1], ["true", true], ["false", false], ["객체", { a: 1 }],
    ["배열", ["clinic"]], ["bigint", 10n], ["Symbol", Symbol("t")], ["함수", () => "clinic"], ["Date", new Date(0)]];
  let badRej = 0, badZero = 0;
  for (const [l, v] of BAD) {
    const r = out(v);
    if (st(r) !== "PENDING_UNVERIFIED") { badRej++; console.log(`     · ${l} → ${st(r)}`); }
    if (!threw(r) && r.r!.status === "OK" && r.r!.ownPay === 0) badZero++;
  }
  check(`무효값 ${BAD.length}종 전부 차단`, badRej === 0, String(badRej));
  check("무효값에서 ownPay 0인 정상 결과가 만들어지지 않는다", badZero === 0, String(badZero));
  check("4·5세대 Tier 계약이 두 값으로 일치한다",
    st(out("tertiary")) === "PENDING_UNVERIFIED"
    && st(wrap(() => calc2026({ amount: 30_000, coverage: "benefit", visit: "outpatient",
      nhisCoinsuranceRate: 0.2, tier: "tertiary" } as never))) === "PENDING_UNVERIFIED");
  // 2·3세대의 `facility`는 다른 축이고 `tertiary`가 유효값이다 — 이번 변경의 영향을 받지 않는다.
  const std = wrap(() => calcStandardized("2009", { amount: 300_000, coverage: "benefit",
    visit: "outpatient", plan: "standard", facility: "tertiary" } as unknown as ClaimInput));
  check('2·3세대 facility: "tertiary"는 계속 정상 소비된다',
    st(std) === "OK" && !threw(std) && std.r!.minDeductible === 20_000, JSON.stringify(threw(std) ? std : std.r!.minDeductible));
}

console.log("\n[G-34C] 5. 호출당 단일 읽기 — 종전 2~4회를 1회로");
{
  const probe = (g: Group, ax: string, get: () => unknown) => {
    let reads = 0; const o: Any = { ...g.base };
    Object.defineProperty(o, ax, { get() { reads++; return get(); }, enumerable: true, configurable: true });
    const r = wrap(() => g.call(o));
    return { reads, r };
  };
  let over = 0; const first: string[] = [];
  for (const g of GROUPS) for (const ax of AXES) {
    const p = probe(g, ax, () => (g.base[ax] ?? NORMAL[ax]));
    if (p.reads > 1) { over++; if (first.length < 4) first.push(`${g.label}|${ax}=${p.reads}회`); }
  }
  check("630자리 전부에서 2회 이상 읽는 자리 0", over === 0, first.join(", "));
  // 변하는 getter — 첫 값 하나로 결과가 확정된다.
  const varying = (g: Group, ax: string, a: unknown, b: unknown) => {
    let i = 0; const o: Any = { ...g.base };
    Object.defineProperty(o, ax, { get() { return i++ === 0 ? a : b; }, enumerable: true, configurable: true });
    return wrap(() => g.call(o));
  };
  const g21 = GROUPS.find((x) => x.label === "calc2021|급여|통원")!;
  const small = { ...g21, base: { ...g21.base, amount: 30_000 } };
  check("4세대 급여 통원 tier: 변하는 getter는 첫 값(clinic)으로 확정",
    JSON.stringify(varying(small, "tier", "clinic", "hospital"))
    === JSON.stringify(wrap(() => small.call({ ...small.base, tier: "clinic" }))));
  const gIn = GROUPS.find((x) => x.label === "calc2026|비급여|입원|중증")!;
  check("5세대 비급여 입원 tier: 변하는 getter는 첫 값(hospital)으로 확정",
    JSON.stringify(varying(gIn, "tier", "hospital", "clinic"))
    === JSON.stringify(wrap(() => gIn.call({ ...gIn.base, tier: "hospital" }))));
  // ⚠ 회귀 고정: 메모이제이션 게터가 자기 자신을 부르면 종별이 늘 undefined가 되어
  //   중증 비급여 입원이 "종별 미지정"으로 전부 차단된다(구현 중 실제로 겪었다).
  check("tierOf()가 자기 자신을 부르지 않는다(종별이 실제로 읽힌다)",
    st(wrap(() => gIn.call({ ...gIn.base }))) === "OK"
    && !note0(wrap(() => gIn.call({ ...gIn.base }))).startsWith("중증 비급여 입원: 의료기관 종별 미지정"));
  const src26 = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("tierOf()의 본문이 원본을 읽는다",
    /tierVal = \(input as \{ tier\?: unknown \}\)\.tier;/.test(src26) && !/tierVal = tierOf\(\)/.test(src26));
}

console.log("\n[G-34C] 6. 던지는 getter와 선행 preflight");
{
  const thrower = (g: Group, ax: string) => {
    const o: Any = { ...g.base };
    Object.defineProperty(o, ax, { get() { throw new Error("boom"); }, enumerable: true, configurable: true });
    return wrap(() => g.call(o));
  };
  const std = GROUPS.find((x) => x.label === "calcStandardized|2009|급여|통원")!;
  // 선행 preflight(표준형/선택형 미지정)가 결과를 정하면 stray 이름을 읽지 않는다.
  const o: Any = { ...std.base }; delete o.plan;
  let read = 0;
  Object.defineProperty(o, "cause", { get() { read++; return "injury"; }, enumerable: true, configurable: true });
  const r = wrap(() => std.call(o));
  check("plan 미지정이면 stray 이름을 읽지 않는다", read === 0 && note0(r).startsWith("표준형/선택형(plan) 미지정"), `reads=${read}`);
  check("stray 축의 던지는 getter는 전파된다", threw(thrower(std, "cause")));
}

console.log("\n[G-34C] 7. 제네릭 라우터 — 지연 투영이 G-34A 안내를 앞지르지 않는다");
{
  // 라우터가 막는 축을 라우터로 넣으면 **라우터의** 안내가 나온다(직접 엔진의 새 가드가 아니다).
  for (const [gen, base, key] of [
    ["2009", { amount: 300_000, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" }, "cause"],
    ["2009", { amount: 300_000, coverage: "benefit", visit: "inpatient", plan: "standard" }, "facility"],
    ["2021", { amount: 300_000, coverage: "benefit", visit: "outpatient", tier: "clinic" }, "plan"],
    ["2026", { amount: 300_000, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general" }, "lines"],
  ] as [string, Any, string][]) {
    const r = wrap(() => calculate(gen as never, { ...base, [key]: NORMAL[key] } as never));
    check(`라우터 ${gen} · ${key} → 라우터 안내(${gen}세대: …)`,
      st(r) === "PENDING_UNVERIFIED" && note0(r).startsWith(`${gen}세대: `), note0(r).slice(0, 44));
  }
  // 정상 입력은 투영을 지나 종전대로 계산된다.
  check("라우터 2009 통원 정상 계산", calculate("2009", { amount: 300_000, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" }).ownPay === 60_000);
  check("라우터 2021 급여 통원 정상 계산", calculate("2021", { amount: 30_000, coverage: "benefit", visit: "outpatient", tier: "hospital" }).ownPay === 20_000);
  // 투영 getter도 필드당 원본을 한 번만 읽는다.
  const counts: Record<string, number> = {};
  const src: Any = {};
  for (const [k, v] of Object.entries({ amount: 300_000, coverage: "benefit", visit: "outpatient", plan: "standard", facility: "clinic" }))
    Object.defineProperty(src, k, { get() { counts[k] = (counts[k] ?? 0) + 1; return v; }, enumerable: true, configurable: true });
  calculate("2009", src as never);
  check("투영 getter: 원본을 필드당 1회만 읽는다",
    Object.values(counts).every((n) => n <= 1), JSON.stringify(counts));
  const code = readFileSync("src/lib/insurance/engine/engine.ts", "utf8");
  check("투영은 지연(getter 위임)이다", /get: key === "visit" \? visitOf : \(\) => src\[key\]/.test(code));
  check("stray 검사는 투영본이 아니라 원본을 본다",
    (code.match(/rejectUnusedAxes\(generation, input, r, p\.visitOf\(\)\)/g) ?? []).length === 3
    && !code.includes("rejectUnusedAxes(generation, projectOwned"));
  check("경로 판정도 세대 엔진이 읽은 그 값을 쓴다(원본 재읽기 없음)",
    /return \{ input: out as unknown as ClaimInput, visitOf \};/.test(code)
    && /function unusedKeysOf\(generation: Generation, visit: unknown\)/.test(code));
  check("보류 칸이 비어 있다", !/^\s*held: \["tier"\]/m.test(code));
}

console.log("\n[G-34C] 8. calc2021의 새 실패 반환이 형제 계약과 같은 모양이다");
{
  const r = calc2021({ amount: 300_000.7, coverage: "benefit", visit: "inpatient",
    ...({ tier: "clinic" } as Any) } as unknown as ClaimInput);
  check("status는 PENDING_UNVERIFIED", r.status === "PENDING_UNVERIFIED");
  check("generation은 2021", r.generation === "2021");
  check("검증된 amount가 보존된다(정규화 결과 300,000)", r.amount === 300_000, String(r.amount));
  check("금액 필드는 전부 null", r.ownPay === null && r.insurancePay === null
    && r.rateBased === null && r.rateApplied === null && r.minDeductible === null);
  check("appliedCaps는 빈 배열", Array.isArray(r.appliedCaps) && r.appliedCaps.length === 0);
  check("notes가 사유를 담는다", (r.notes ?? []).length >= 2);
  check("안내에 받은 값 자체를 넣지 않는다(typeof만)", String(r.notes?.[2] ?? "").startsWith("받은 값의 형식: "));
  const sym = wrap(() => calc2021({ amount: 300_000, coverage: "benefit", visit: "inpatient",
    ...({ tier: Symbol("s") } as Any) } as unknown as ClaimInput));
  check("Symbol·bigint에서도 안내를 만들다 죽지 않는다", !threw(sym) && st(sym) === "PENDING_UNVERIFIED", String(threw(sym) && sym.threw));
}

console.log("\n[G-34C] 9. 화면 — 비활성 경로에 종별을 싣지 않고 상태는 보존한다");
{
  const ui4 = readFileSync("src/components/calculators/HealthCalc.tsx", "utf8");
  const ui5 = readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8");
  check("4세대 화면: 급여 통원에만 전달",
    ui4.includes('tier: coverage === "benefit" && visit === "outpatient" ? tier : undefined'));
  check("4세대 화면: 상태와 선택 UI는 그대로", /useState<Tier>\("clinic"\)/.test(ui4)
    && ui4.includes('tier === "clinic"') && ui4.includes('tier === "hospital"'));
  check("5세대 화면: 급여는 통원에만 전달", /tier: visit === "outpatient" \? benefitTier : undefined/.test(ui5));
  check("5세대 화면: 비급여 입원은 기존 종별 계약 그대로",
    /tier: visit === "inpatient" \? nbInpatientTier \?\? undefined : undefined/.test(ui5));
  check("화면에 as 단언을 더하지 않았다",
    !/tier: \w+ as Tier/.test(ui4) && !/tier: \w+ as Tier/.test(ui5));
}

console.log("\n[G-34C] 10. 기준선에서 이미 봉인된 24자리 무회귀");
{
  // 전부 `calc2026`이고 자기 안내를 가지고 있다 — 새 목록이 그 안내를 밀어내지 않는다.
  const cases: [string, Any, string][] = [
    ["급여 통원 priorAnnualPaid", { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2, priorAnnualPaid: 0 }, "5세대: priorAnnualPaid"],
    ["급여 통원 perVisitCoverageLimit", { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2, perVisitCoverageLimit: 0 }, "5세대 급여: perVisitCoverageLimit"],
    ["급여 통원 severity", { amount: A, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2, severity: "critical" }, "5세대 급여: severity"],
    ["급여 입원 nhisCoinsuranceRate", { amount: A, coverage: "benefit", visit: "inpatient", nhisCoinsuranceRate: 0.2 }, "건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원에서만"],
    ["비급여 통원 nhisCoinsuranceRate", { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general", nhisCoinsuranceRate: 0.2 }, "건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원 계산에만"],
    ["비급여 통원 priorAnnualDeductible", { amount: A, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general", priorAnnualDeductible: 0 }, "누적 공제금액(priorAnnualDeductible)"],
    ["비급여 입원 perVisitCoverageLimit", { amount: A, coverage: "non_benefit", visit: "inpatient", severity: "critical", nonBenefitItem: "general", tier: "hospital", perVisitCoverageLimit: 0 }, "통원 가입금액(perVisitCoverageLimit)"],
  ];
  for (const [l, i, want] of cases) {
    const r = wrap(() => calc2026(i as never));
    check(`${l}: 종전 안내 그대로`, st(r) === "PENDING_UNVERIFIED" && note0(r).startsWith(want), note0(r).slice(0, 46));
  }
}

console.log("\n[G-34C] 11. 목록과 자리 — 구조 계약");
{
  const s1 = readFileSync("src/lib/insurance/engine/generationStandardized.ts", "utf8");
  const s2 = readFileSync("src/lib/insurance/engine/generation2021.ts", "utf8");
  const s3 = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const count = (src: string, name: string) => (src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`))?.[1].match(/"/g)?.length ?? 0) / 2;
  check("2·3세대 공통 목록 28종", count(s1, "STD_UNUSED_KEYS") === 28, String(count(s1, "STD_UNUSED_KEYS")));
  check("2·3세대 경로별 목록 2 + 1", count(s1, "STD_OUTPATIENT_ONLY_KEYS") === 2 && count(s1, "STD_INPATIENT_ONLY_KEYS") === 1);
  check("4세대 공통 목록 31종", count(s2, "GEN2021_UNUSED_KEYS") === 31, String(count(s2, "GEN2021_UNUSED_KEYS")));
  check("5세대 공통 목록 25종(레거시 priorAnnualPaid는 자기 안내를 가진 기존 검사에 남긴다)",
    count(s3, "GEN2026_FOREIGN_KEYS") === 25 && !/GEN2026_FOREIGN_KEYS = \[[\s\S]*?"priorAnnualPaid"/.test(s3),
    String(count(s3, "GEN2026_FOREIGN_KEYS")));
  check("2·3세대 stray 검사는 plan preflight 뒤다",
    s1.indexOf("표준형/선택형(plan) 미지정") < s1.indexOf("2·3세대 단건 계산에 쓰이지 않는 입력입니다"));
  check("5세대 공통 목록은 각 분기의 기존 검사 뒤에서 호출된다",
    s3.indexOf("5세대 급여: perVisitCoverageLimit") < s3.indexOf("const foreign = rejectForeignAxes(input, amount);")
    && s3.indexOf("건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원 계산에만") < s3.indexOf("const foreignNonBenefit = rejectForeignAxes(input, amount);"));
  check("각 키를 한 번만 읽는다(세 파일 공통 모양)",
    [s1, s2, s3].every((s) => /const got: unknown = \(input as unknown as Record<string, unknown>\)\[key\];\n\s*if \(got === undefined\) continue;/.test(s)));
  check("안내에 받은 값 자체를 넣지 않는다(typeof만)",
    [s1, s2, s3].every((s) => /받은 값의 형식: \$\{typeof/.test(s)) && !/showValue/.test(s2));
}

console.log(`\n[G-34C 직접 진입점 소유권] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
