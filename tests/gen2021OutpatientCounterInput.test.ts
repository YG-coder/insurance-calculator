// F-1 — 4세대 통원·특약 횟수 입력의 엄격 검증.
//
// ⚠ 새 규제 숫자를 만들지 않는다. 비급여 통원 100회와 특약 50회 한도는 그대로다.
//   바뀐 것은 "잘못된 입력을 어떻게 다루는가"뿐이다.
//
// 종전 동작(nonNegInt): 미입력·음수·소수·NaN·±Infinity·문자열이 전부 0 또는 내림값이 됐다.
//   문자열 "100"과 Infinity가 0이 되는 것이 가장 위험했다 — 한도를 채운 사람이
//   "한 번도 안 썼다"로 계산되어 보험금이 과다 산출된다.
//
// ⚠ 세 축은 한도·근거·CapCode·안내가 모두 다르다. 형식 규칙만 공유하고 나머지는 분리한다.
//     일반 비급여 통원 100회 / 도수치료 등 50회 / 비급여 주사료 50회.
//     MRI는 **횟수 한도가 없어** 축 자체를 두지 않는다.
//
// ⚠ 지급 0원 통원의 횟수 소진은 이번에 해석하지 않는다(F-3). 계산 순서와 소진 방식 무변경.
import { readFileSync } from "node:fs";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { GEN2021 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { Gen2021MultiClaimInput, MultiClaimResult } from "../src/lib/insurance/engine/types";
import HealthCalcMulti2021 from "../src/components/calculators/HealthCalcMulti2021";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const A = 100_000;            // 비급여 통원 30% vs 최소공제 3만 → 자기부담 3만, 지급 7만
const PAY = 70_000;
const OUT_LIMIT = GEN2021.nonBenefitOutpatientAnnualVisits;      // 100
const MANUAL_LIMIT = GEN2021.rider.manual_therapy.annualVisits;  // 50
const INJ_LIMIT = GEN2021.rider.injection.annualVisits;          // 50
const eng = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
const ui = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");

type Extra = Partial<Record<string, unknown>>;
const call = (o: Extra) => calculateMany2021({ cause: "disease", amounts: [A], ...o } as unknown as Gen2021MultiClaimInput);
/** 일반 비급여 통원(연 100회). OMIT은 키 자체를 넣지 않는다. */
const gen = (amounts: number[], v: unknown, extra: Extra = {}) => calculateMany2021({
  cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic", amounts,
  ...(v === "OMIT" ? {} : { priorAnnualOutpatientVisits: v }), ...extra,
} as unknown as Gen2021MultiClaimInput);
/** 3대비급여 특약(연 50회). */
// ⚠ 도수 축에는 <표1> 주)의 보상 승인 회차가 함께 걸린다(F-3c). 이 파일이 검사하는 것은
//   **연 50회 한도의 입력 검증**이므로, 승인 축은 최대값을 고정해 그 영향을 제거한다.
//   승인 구간 자체의 경계는 gen2021MskApproval.test.ts가 따로 고정한다.
const rid = (r: "manual_therapy" | "injection") => (amounts: number[], v: unknown, extra: Extra = {}) =>
  calculateMany2021({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: r, amounts,
    ...(r === "manual_therapy" ? { approvedThroughVisit: MANUAL_LIMIT } : {}),
    ...(v === "OMIT" ? {} : { priorAnnualRiderVisits: v }), ...extra,
  } as unknown as Gen2021MultiClaimInput);

const paid = (r: MultiClaimResult) => r.lines.map((l) => l.insurancePay).join();
const blockedOk = (r: MultiClaimResult, totalAmount: number) =>
  r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
  && r.totalOwnPay === null && r.totalInsurancePay === null
  && r.appliedCaps.length === 0 && r.totalAmount === totalAmount;

const BAD: [string, unknown][] = [
  ["-1", -1], ["-0.1", -0.1], ["1.5", 1.5], ["49.9", 49.9], ["NaN", NaN],
  ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ['문자열 "50"', "50"], ['문자열 "abc"', "abc"],
  ["객체", {}], ["null", null], ["true", true],
];

// ── 근거 ─────────────────────────────────────────────────────────────
console.log("\n[근거] 새 규제 숫자를 만들지 않는다");
{
  const rules = REGULATORY_RULES as unknown as Record<string, { ruleId: string; value: unknown; status: string }>;
  const byId = Object.fromEntries(Object.values(rules).map((r) => [r.ruleId, r]));
  for (const [id, want] of [
    ["GEN2021-NONBENEFIT-OUTPATIENT-ANNUAL-VISITS", 100],
    ["GEN2021-MANUAL-THERAPY-ANNUAL-VISITS", 50],
    ["GEN2021-INJECTION-ANNUAL-VISITS", 50]] as const) {
    check(`${id} = ${want} CONFIRMED 그대로`,
      byId[id]?.status === "CONFIRMED" && byId[id]?.value === want);
  }
  check("MRI에는 횟수 한도 규칙이 없다",
    !Object.keys(byId).some((id) => /GEN2021-MRI.*VISIT/i.test(id))
    && GEN2021.rider.mri.annualVisits === null);
  check("입력 검증용 새 규칙을 만들지 않았다",
    !Object.keys(byId).some((id) => /GEN2021.*(INPUT|VALIDATION|PARSER)/i.test(id)));
  check("한도는 상수에서 읽는다",
    /visits >= GEN2021\.nonBenefitOutpatientAnnualVisits/.test(eng)
    && !/visits >= 100/.test(eng) && !/visits >= 50/.test(eng));
}

// ── 일반 비급여 통원 (연 100회) ───────────────────────────────────────
console.log("\n[일반] 비급여 통원 연 100회");
{
  check("미입력(키 없음) → 차단", blockedOk(gen([A], "OMIT"), A));
  check("undefined → 차단", blockedOk(gen([A], undefined), A));
  check("미입력 안내가 무엇을 넣어야 하는지 알려준다",
    gen([A], "OMIT").notes.some((n) => n.includes("이미 사용한 통원 횟수") && n.includes("0을 넣어 주세요")));
  check("미입력 안내가 '회' 단위와 100회를 밝힌다",
    gen([A], "OMIT").notes.some((n) => n.includes(`${OUT_LIMIT}회가 한도`)));
  check("명시적 0 → 정상", paid(gen([A], 0)) === String(PAY));
  check("98 → 정상", paid(gen([A], 98)) === String(PAY));
  check("99 → 100회째라 보상", paid(gen([A], 99)) === String(PAY));
  check("99 + 2건 → 둘째만 제외", paid(gen([A, A], 99)) === [PAY, 0].join());
  check("100 → 제외", paid(gen([A], 100)) === "0");
  check("101 → 제외", paid(gen([A], 101)) === "0");
  //   ⚠ 이 런타임 검사만으로는 **절삭 여부를 증명하지 못한다** — 5000을 100으로 잘라도
  //     "제외"라는 결과가 같기 때문이다. 절삭 금지는 아래 [구조] 절이 소스로 고정한다.
  check("5000 → 절삭하지 않고 제외(결과)", paid(gen([A], 5_000)) === "0");
  check("MAX_SAFE_INTEGER는 유효값", gen([A], Number.MAX_SAFE_INTEGER).status === "OK");
  check("제외 행에 일반 통원 CapCode",
    gen([A], 100).appliedCaps.includes("GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS"));
  for (const [what, v] of BAD) check(`${what} → 차단`, blockedOk(gen([A], v), A), gen([A], v).status);
  check("-1을 0으로 바꾸지 않는다", paid(gen([A], -1)) !== String(PAY));
  check("49.9를 49로 내리지 않는다", gen([A], 49.9).status !== "OK");
  check('문자열 "100"을 0으로 바꾸지 않는다', gen([A], "100").status !== "OK");
}

// ── 특약 (연 50회) — 도수·주사를 각각 검사한다 ────────────────────────
for (const [label, r, limit, cap] of [
  ["도수치료 등", "manual_therapy", MANUAL_LIMIT, "GEN2021_MANUAL_THERAPY_ANNUAL_VISITS"],
  ["비급여 주사료", "injection", INJ_LIMIT, "GEN2021_INJECTION_ANNUAL_VISITS"]] as const) {
  console.log(`\n[특약] ${label} 연 ${limit}회`);
  const run = rid(r);
  check(`${label}: 미입력 → 차단`, blockedOk(run([A], "OMIT"), A));
  check(`${label}: 미입력 안내가 '치료 횟수'와 한도를 밝힌다`,
    run([A], "OMIT").notes.some((n) => n.includes("이미 사용한 치료 횟수"))
    && run([A], "OMIT").notes.some((n) => n.includes(`${limit}회가 한도`)));
  check(`${label}: 안내가 '통원 횟수'와 섞이지 않는다`,
    !run([A], "OMIT").notes.some((n) => n.includes("이미 사용한 통원 횟수")));
  check(`${label}: 명시적 0 → 정상`, run([A], 0).status === "OK");
  check(`${label}: ${limit - 1} → 보상`, run([A], limit - 1).lines[0].covered);
  check(`${label}: ${limit} → 제외`, run([A], limit).lines[0].covered === false);
  check(`${label}: ${limit + 1} → 제외`, run([A], limit + 1).lines[0].covered === false);
  //   ⚠ 결과가 같아 절삭 여부를 증명하지 못한다. 절삭 금지는 [구조] 절이 소스로 고정한다.
  check(`${label}: 999 → 절삭하지 않고 제외(결과)`, run([A], 999).lines[0].covered === false);
  check(`${label}: 제외 행에 자기 CapCode`, run([A], limit).appliedCaps.includes(cap));
  for (const [what, v] of BAD) check(`${label}: ${what} → 차단`, blockedOk(run([A], v), A));
  check(`${label}: 일반 축이 실리면 차단`,
    run([A], 0, { priorAnnualOutpatientVisits: 0 }).status === "PENDING_UNVERIFIED");
}
{
  // 두 특약은 별개 한도다. 한쪽 한도를 다른 쪽에 쓰면 안 된다.
  const m = rid("manual_therapy"), i = rid("injection");
  check("도수·주사가 서로 다른 CapCode를 쓴다",
    m([A], MANUAL_LIMIT).appliedCaps.join() !== i([A], INJ_LIMIT).appliedCaps.join());
  check("도수 결과에 주사 CapCode가 섞이지 않는다",
    !m([A], MANUAL_LIMIT).appliedCaps.includes("GEN2021_INJECTION_ANNUAL_VISITS"));
}

// ── MRI — 횟수 한도가 없다 ───────────────────────────────────────────
console.log("\n[특약] MRI는 횟수를 요구하지 않는다");
{
  const mri = (extra: Extra = {}) => call({ coverage: "non_benefit", visit: "outpatient",
    rider: "mri", amounts: [1_000_000], ...extra });
  check("횟수 없이 정상 계산", mri().status === "OK" && mri().lines[0].covered);
  check("금액 한도는 그대로 적용",
    mri({ priorAnnualRiderPaid: 2_900_000 }).totalInsurancePay === 100_000);
  check("특약 횟수 축이 실리면 값 0이어도 차단",
    call({ coverage: "non_benefit", visit: "outpatient", rider: "mri", amounts: [1_000_000],
      priorAnnualRiderVisits: 0 }).status === "PENDING_UNVERIFIED");
  check("차단 안내가 '횟수 한도가 없다'는 사실을 밝힌다",
    call({ coverage: "non_benefit", visit: "outpatient", rider: "mri", amounts: [1_000_000],
      priorAnnualRiderVisits: 0 }).notes.some((n) => n.includes("횟수 한도가 없고")));
  check("일반 축이 실려도 차단",
    call({ coverage: "non_benefit", visit: "outpatient", rider: "mri", amounts: [1_000_000],
      priorAnnualOutpatientVisits: 0 }).status === "PENDING_UNVERIFIED");
  check("999를 실어도 조용히 무시하지 않는다",
    call({ coverage: "non_benefit", visit: "outpatient", rider: "mri", amounts: [1_000_000],
      priorAnnualRiderVisits: 999 }).status === "PENDING_UNVERIFIED");
}

// ── 무관한 경로 — 정상 입력에는 새 차단이 없다 ────────────────────────
console.log("\n[범위] 급여·입원과 축 교차");
{
  for (const [what, base] of [
    ["급여 통원", { coverage: "benefit", visit: "outpatient", tier: "clinic" }],
    ["급여 입원", { coverage: "benefit", visit: "inpatient" }],
    ["비급여 입원", { coverage: "non_benefit", visit: "inpatient" }]] as const) {
    check(`${what}: 횟수 없이 정상 계산`, call(base).status === "OK");
    for (const field of ["priorAnnualOutpatientVisits", "priorAnnualRiderVisits"] as const) {
      check(`${what}: ${field}가 실리면 값 0이어도 차단`,
        blockedOk(call({ ...base, [field]: 0 }), A), call({ ...base, [field]: 0 }).status);
    }
  }
  check("급여 통원 차단 안내가 '급여에는 횟수 한도가 없다'를 밝힌다",
    call({ coverage: "benefit", visit: "outpatient", priorAnnualOutpatientVisits: 0 })
      .notes.some((n) => n.includes("급여 청구와 입원에는 연간 횟수 한도가 없습니다")));
  check("일반 통원에 특약 축이 실리면 차단",
    gen([A], 0, { priorAnnualRiderVisits: 0 }).status === "PENDING_UNVERIFIED");
  check("두 축이 뒤바뀌어 실리면 차단(일반 경로에 특약 축만)",
    gen([A], "OMIT", { priorAnnualRiderVisits: 0 }).status === "PENDING_UNVERIFIED");
  check("축 교차 안내가 두 축이 별개임을 밝힌다",
    gen([A], 0, { priorAnnualRiderVisits: 0 }).notes.some((n) => n.includes("서로 대신 쓰지 않습니다")));
}

// ── 지급 0원 처리·계산 순서 무변경 (F-3 대상) ─────────────────────────
console.log("\n[무변경] 지급 0원 처리와 계산 순서");
{
  // 4세대는 행이 있으면 지급액과 무관하게 카운터를 소진한다. 이번 커밋에서 바꾸지 않는다.
  check("진료비 0원 행도 종전대로 횟수를 소진한다",
    gen([0, A], 99).lines[1].covered === false);
  check("소진 판정이 여전히 계산 **전**에 있다(구조 무변경)",
    /if \(visits >= GEN2021\.nonBenefitOutpatientAnnualVisits\)[\s\S]{0,400}visits \+= 1;[\s\S]{0,200}let single: CalcResult;/.test(eng));
  check("지급 0원 이중 해석을 도입하지 않았다",
    !eng.includes("fingerprint") && !eng.includes("countZeroPay"));
}

// ── 타입 ─────────────────────────────────────────────────────────────
console.log("\n[타입] 판별 유니온");
{
  const iface = (name: string) => {
    const m = new RegExp(`interface ${name} extends [^{]*\\{([\\s\\S]*?)\\n\\}`).exec(types);
    return m === null ? null : m[1];
  };
  const NEVER_BOTH = ["Gen2021MultiGeneralBenefitInput",
    "Gen2021MultiGeneralNonBenefitInpatientInput", "Gen2021MultiRiderMriInput"];
  for (const n of NEVER_BOTH) {
    const b = iface(n);
    check(`${n}이 두 축을 never로 봉인`,
      b !== null && b.includes("priorAnnualOutpatientVisits?: never;")
      && b.includes("priorAnnualRiderVisits?: never;"), b?.slice(0, 80));
  }
  const outB = iface("Gen2021MultiGeneralNonBenefitOutpatientInput");
  check("일반 비급여 통원만 일반 축을 연다",
    outB !== null && outB.includes("priorAnnualOutpatientVisits?: number;")
    && outB.includes("priorAnnualRiderVisits?: never;"));
  // F-3c에서 도수·주사를 별개 인터페이스로 분리했다(승인 축이 도수에만 있다).
  //   Gen2021MultiRiderCountedInput은 둘의 합집합 별칭으로 남는다.
  const manB = iface("Gen2021MultiRiderManualInput");
  const injB = iface("Gen2021MultiRiderInjectionInput");
  check("도수만 특약 축 + 승인 축을 연다",
    manB !== null && manB.includes("priorAnnualRiderVisits?: number;")
    && manB.includes("priorAnnualOutpatientVisits?: never;")
    && manB.includes('rider: "manual_therapy";'));
  check("주사료는 특약 축만 열고 승인 축은 봉인",
    injB !== null && injB.includes("priorAnnualRiderVisits?: number;")
    && injB.includes("priorAnnualOutpatientVisits?: never;")
    && injB.includes("approvedThroughVisit?: never;")
    && injB.includes('rider: "injection";'));
  check("두 특약 인터페이스가 합집합 별칭으로 묶인다",
    /export type Gen2021MultiRiderCountedInput =\s*\|\s*Gen2021MultiRiderManualInput\s*\|\s*Gen2021MultiRiderInjectionInput;/.test(types));
  const common = /interface Gen2021MultiCommonInput \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
  check("공통 베이스에는 두 축이 없다",
    !common.includes("priorAnnualOutpatientVisits") && !common.includes("priorAnnualRiderVisits"));
  check("유니온이 다섯 변형을 모두 포함",
    /export type Gen2021MultiClaimInput =[\s\S]{0,400}Gen2021MultiRiderMriInput;/.test(types)
    && (types.match(/\| Gen2021Multi(General|Rider)\w+;?/g) ?? []).length >= 5);
  check("타입 주석이 미입력≠0을 명시",
    types.includes("미입력(undefined)과 확인 결과 0은 다른 상태다"));
}

// ── 구조 ─────────────────────────────────────────────────────────────
console.log("\n[구조] 검증 위치와 세대 분리");
{
  check("형식 검증을 한 함수로 모았다", /const badCount = \(v: unknown\): boolean =>/.test(eng));
  check("badCount가 안전 정수와 0 이상을 본다",
    /typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0/.test(eng));
  check("쓰이는 축을 rider·coverage·visit으로 함께 정한다",
    /const usesGeneralVisits = rider === "none"[\s\S]{0,120}coverage === "non_benefit" && input\.visit === "outpatient"/.test(eng)
    && /const usesRiderVisits = rider === "manual_therapy" \|\| rider === "injection"/.test(eng));
  check("두 축의 미입력을 각각 차단한다",
    /if \(usesGeneralVisits\) \{\s*\n\s*if \(visitsRaw === undefined\)/.test(eng)
    && /if \(usesRiderVisits\) \{[\s\S]{0,200}if \(riderVisitsRaw === undefined\)/.test(eng));
  check("카운터를 더 이상 정규화하지 않는다",
    !/nonNegInt\(rider === "none" \? input\.priorAnnualOutpatientVisits/.test(eng));
  check("금액 축의 nonNegInt는 그대로 남아 있다",
    /nonNegInt\(rider === "none" \? input\.priorAnnualInsurancePaid/.test(eng));
  check("차단 결과가 진료비 합계를 유지한다",
    /totalAmount: totalInput, totalOwnPay: null, totalInsurancePay: null, appliedCaps: \[\]/.test(eng));
  check("5세대 파서·상수를 재사용하지 않는다",
    !eng.includes("GEN2026") && !eng.includes("badOutpatientDays") && !eng.includes("outpatientAnnualVisits:"));

  // ── 절삭 금지를 소스로 고정한다 ──────────────────────────────────
  //   ⚠ 런타임 결과로는 증명할 수 없다. 5000을 한도값으로 잘라도 "제외"가 같아서다.
  //     검증을 통과한 원본 값이 **손대지 않은 채** 카운터에 들어가는지 본다.
  //   ⚠ 검사 범위는 **횟수 카운터 초기화 구간**뿐이다. 연간 가입금액의 정당한
  //     Math.min(제5조 상한 절삭)이나 특약 금액 한도의 Math.max는 금지하지 않는다.
  {
    const init = /\n  let visits = ([^\n]*);\n/.exec(eng);
    check("횟수 카운터 초기화 구간을 찾음", init !== null);
    const expr = init === null ? "" : init[1];
    // 두 축을 각각 확인한다. 한쪽만 절삭해도 실패해야 한다.
    check("일반축: visitsRaw가 그대로 카운터에 들어간다",
      /\busesGeneralVisits \? visitsRaw\b/.test(expr), expr);
    check("특약축: riderVisitsRaw가 그대로 카운터에 들어간다",
      /: riderVisitsRaw\b/.test(expr), expr);
    check("초기화 구간에 절삭·비교가 없다",
      !/Math\.(min|max|floor|ceil|round)/.test(expr) && !/[<>]/.test(expr)
      && !/GEN2021\./.test(expr) && !/\b\d{2,}\b/.test(expr), expr);
    check("초기화가 미입력 자리값 이외의 변형을 하지 않는다",
      expr.replace(/\s+/g, " ").trim()
      === "((usesGeneralVisits ? visitsRaw : riderVisitsRaw) as number | undefined) ?? 0", expr);
    // 초기화 뒤 첫 청구를 처리하기 전에 값이 다시 손질되면 안 된다.
    const beforeLoop = eng.slice(
      eng.indexOf("  let visits = "), eng.indexOf("  amounts.forEach("));
    check("초기화와 첫 행 사이에서 카운터를 다시 손대지 않는다",
      !/visits\s*=[^=]/.test(beforeLoop.slice(beforeLoop.indexOf(";")))
      && !/visits\s*(\+=|-=|\*=)/.test(beforeLoop.slice(beforeLoop.indexOf(";"))), beforeLoop);
    // ⚠ 범위 한정이 실제로 지켜지는지 함께 못박는다 — 금액 축의 정당한 절삭은 그대로 있다.
    //   연간 가입금액은 약관상 5천만원 상한이라 Math.min이 맞다(횟수와 다르다).
    check("금액 한도의 정당한 Math.min은 금지하지 않는다",
      eng.includes("Math.min(nonNegInt(input.annualCoverageLimit), GEN2021.annualLimitMaximum)")
      && /Math\.max\(rc\.annualLimit - paid, 0\)/.test(eng));
    // 루프 안에서도 카운터에 대한 대입은 1 증가뿐이다(한도 비교는 허용).
    const loop = eng.slice(eng.indexOf("  amounts.forEach("));
    const writes = loop.match(/visits\s*(?:=[^=]|\+=|-=|\*=|\/=)[^;]*/g) ?? [];
    check("루프 안의 카운터 대입은 '+= 1'뿐이다",
      writes.length > 0 && writes.every((w) => /^visits \+= 1/.test(w)), writes.join(" | "));
  }
}

// ── 2·3·5세대 무회귀 ─────────────────────────────────────────────────
console.log("\n[범위] 2·3·5세대 무변경");
{
  // ⚠ 2·3세대는 F-2에서 별도로 엄격 검증으로 바뀌었다(그 계약은 전용 테스트가 맡는다).
  //   여기서는 4세대 변경이 2·3세대 계산을 건드리지 않았는지만 본다.
  const std = calculateMany("2017", { plan: "standard",
    lines: [{ amount: 300_000, visit: "outpatient", facility: "clinic" }],
    priorAnnualOutpatientVisits: 0 });
  check("2·3세대의 정상 입력 계산은 종전과 같다",
    std.status === "OK" && std.totalInsurancePay === 240_000);
  check("2·3세대 엔진은 4세대 파서를 재사용하지 않는다",
    !readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8").includes("GEN2021"));
  const g5 = calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    tier: "clinic", severity: "critical", nonBenefitItem: "general", amounts: [500_000],
    priorAnnualOutpatientVisits: 0 } as never);
  check("5세대는 종전대로 계산", g5.status === "OK" && g5.totalInsurancePay === 350_000);
  check("5세대는 여전히 미입력을 차단", calculateMany2026({ cause: "disease",
    coverage: "non_benefit", visit: "outpatient", tier: "clinic", severity: "critical",
    nonBenefitItem: "general", amounts: [500_000] } as never).status === "PENDING_UNVERIFIED");
}

// ── UI 상태 전이 ─────────────────────────────────────────────────────
console.log("\n[화면] 상태 전이");
{
  const names = stateNamesFrom(ui);
  const OUT_LABEL = "계약해당일 기준 1년간 이미 사용한 비급여 통원 횟수";
  const MANUAL_LABEL = "계약해당일 기준 1년간 이미 받은 도수치료 등 치료 횟수";
  const INJ_LABEL = "계약해당일 기준 1년간 이미 받은 비급여 주사 횟수";
  const setup = (over: Record<string, unknown> = {}) => {
    const h = mount(HealthCalcMulti2021 as unknown as () => unknown, names);
    for (const [k, v] of Object.entries(over)) h.set(k, v);
    return h.render();
  };
  const warnBoxes = (s: ReturnType<typeof setup>) =>
    s.nodes.filter((n) => n.tag === "#NoticeBox" && n.props.variant === "warning").length;

  const fresh = setup();
  check("① 새 화면: 비급여 통원 횟수 노출, 빈 값",
    fresh.has(OUT_LABEL) && fresh.nodes.some((n) => n.tag === "input" && n.props.value === ""));
  check("① 새 화면: 계산 전 결과·경고 없음", fresh.resultItems() === null && warnBoxes(fresh) === 0);
  const emptyOut = setup({ submitted: true });
  check("② 일반: 빈 값이면 안내만, 결과 없음",
    warnBoxes(emptyOut) === 1 && emptyOut.resultItems() === null);
  check("② 일반: 엔진 안내가 화면에 새지 않는다",
    !emptyOut.nodes.some((n) => (n.text ?? "").includes("priorAnnualOutpatientVisits")));
  check("③ 일반: 0이면 정상 계산",
    setup({ submitted: true, priorOutVisits: "0" }).resultItems() !== null);
  // 기본 화면은 30만원 2건이다. 99회면 첫 건만 100회째로 보상되고 둘째는 제외된다.
  check("④ 일반 99 → 첫 건만 보상",
    setup({ submitted: true, priorOutVisits: "99" }).resultItems()?.[2]?.value === "200,000원");
  check("④ 일반 100 → 두 건 모두 제외",
    setup({ submitted: true, priorOutVisits: "100" }).resultItems()?.[2]?.value === "0원");
  check("④ 일반 0 → 두 건 모두 보상",
    setup({ submitted: true, priorOutVisits: "0" }).resultItems()?.[2]?.value === "400,000원");
  for (const bad of ["", "  ", "-1", "1.5", "abc", "1e2", "+1", "1,0", "9007199254740993"]) {
    const s = setup({ submitted: true, priorOutVisits: bad });
    check(`⑤ 일반 잘못된 값 ${JSON.stringify(bad)} → 차단`,
      warnBoxes(s) === 1 && s.resultItems() === null);
  }
  // 특약 — 두 상태가 분리돼 있고 서로 넘어가지 않는다.
  const man = (o: Record<string, unknown> = {}) => setup({ rider: "manual_therapy", submitted: true, ...o });
  const inj = (o: Record<string, unknown> = {}) => setup({ rider: "injection", submitted: true, ...o });
  check("⑥ 도수: 전용 라벨 노출, 일반·주사 라벨 없음",
    man().has(MANUAL_LABEL) && !man().has(OUT_LABEL) && !man().has(INJ_LABEL));
  check("⑥ 주사: 전용 라벨 노출, 일반·도수 라벨 없음",
    inj().has(INJ_LABEL) && !inj().has(OUT_LABEL) && !inj().has(MANUAL_LABEL));
  check("⑥ 도수: 빈 값이면 계산 차단", man().resultItems() === null && warnBoxes(man()) === 1);
  check("⑥ 주사: 빈 값이면 계산 차단", inj().resultItems() === null);
  check("⑦ 도수: 0이면 정상 계산", man({ priorManualVisits: "0" }).resultItems() !== null);
  check("⑦ 주사: 0이면 정상 계산", inj({ priorInjectionVisits: "0" }).resultItems() !== null);
  check("⑦ 도수 49 → 보상", man({ priorManualVisits: "49" }).resultItems()?.[2]?.value !== "0원");
  check("⑦ 도수 50 → 제외", man({ priorManualVisits: "50" }).resultItems()?.[2]?.value === "0원");
  check("⑦ 주사 49 → 보상", inj({ priorInjectionVisits: "49" }).resultItems()?.[2]?.value !== "0원");
  check("⑦ 주사 50 → 제외", inj({ priorInjectionVisits: "50" }).resultItems()?.[2]?.value === "0원");
  // ⚠ 값이 다른 항목으로 넘어가면 여기서 잡힌다 — 채운 쪽만 계산되고 반대쪽은 막힌다.
  check("⑧ 도수 값이 주사로 넘어가지 않는다", inj({ priorManualVisits: "0" }).resultItems() === null);
  check("⑧ 주사 값이 도수로 넘어가지 않는다", man({ priorInjectionVisits: "0" }).resultItems() === null);
  check("⑧ 일반 값이 특약으로 넘어가지 않는다", man({ priorOutVisits: "0" }).resultItems() === null);
  check("⑧ 특약 값이 일반으로 넘어가지 않는다",
    setup({ submitted: true, priorManualVisits: "0" }).resultItems() === null);
  // MRI — 입력을 노출하지 않고 횟수 없이 계산한다.
  const mri = setup({ rider: "mri", submitted: true, amounts: ["1000000"] });
  check("⑨ MRI: 세 라벨 모두 없음",
    !mri.has(OUT_LABEL) && !mri.has(MANUAL_LABEL) && !mri.has(INJ_LABEL));
  check("⑨ MRI: 횟수 없이 정상 계산", mri.resultItems() !== null && warnBoxes(mri) === 0);
  check("⑨ MRI: 횟수 한도가 없다는 안내가 있다",
    mri.nodes.some((n) => n.tag === "#NoticeBox" && n.text.includes("금액 한도만")));
  check("⑨ MRI 화면에 잔존 상태가 있어도 계산됨",
    setup({ rider: "mri", submitted: true, amounts: ["1000000"],
      priorOutVisits: "9", priorManualVisits: "9", priorInjectionVisits: "9" }).resultItems() !== null);
  // 급여·입원 — 횟수 입력이 없고 정상 계산된다.
  for (const [what, over] of [
    ["급여 통원", { coverage: "benefit" }],
    ["비급여 입원", { visit: "inpatient" }]] as const) {
    const s = setup({ submitted: true, ...over });
    check(`⑩ ${what}: 횟수 입력 없음`, !s.has(OUT_LABEL));
    check(`⑩ ${what}: 잔존 상태가 있어도 정상 계산`,
      setup({ submitted: true, ...over, priorOutVisits: "9" }).resultItems() !== null);
  }
  check("⑪ UI가 공용 digits()로 횟수를 읽지 않는다",
    !/digits\(prior(Out|Manual|Injection)Visits\)/.test(ui));
  check("⑪ UI가 세 상태를 분리해 선언",
    /const \[priorOutVisits, setPriorOutVisits\] = useState\(""\);/.test(ui)
    && /const \[priorManualVisits, setPriorManualVisits\] = useState\(""\);/.test(ui)
    && /const \[priorInjectionVisits, setPriorInjectionVisits\] = useState\(""\);/.test(ui));
  check("⑪ UI가 한도를 상수에서 읽는다",
    /\{GEN2021\.nonBenefitOutpatientAnnualVisits\}회/.test(ui)
    && /\{GEN2021\.rider\.manual_therapy\.annualVisits\}회/.test(ui)
    && /\{GEN2021\.rider\.injection\.annualVisits\}회/.test(ui));
  check("⑪ UI가 satisfies로 초과 필드를 막는다",
    (ui.match(/\} satisfies Gen2021Multi\w+\)/g) ?? []).length >= 5);
}

console.log(`\n[4세대 횟수 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
