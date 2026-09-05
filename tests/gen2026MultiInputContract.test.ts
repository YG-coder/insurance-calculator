// G-14C — 5세대 다회 진입점(`calculateMany2026`)의 입력 계약을 보강한다.
//
// 종전 동작(기준선 d56e57f 직접 호출로 실측): 이 진입점은 통원 카운터 stray와
//   `nonBenefitItem` 말고는 아무것도 막지 않았다.
//   - `priorAnnualPaid`(2·3세대 입원 자기부담 상한 200만원 전용)를 **단건 `calc2026`은
//     존재 자체로 거부**하는데 다회는 `OK`로 통과시켰다. 다회 preflight가 `calc2026`을 부를 때
//     `amount: 0`짜리 고정 인자로 `nonBenefitItem`·`visit`·`tier`만 넘기고 원본 입력을 넘기지
//     않아 단건의 레거시 필드 거부가 상속되지 않았다.
//     ⚠ 여기에 금액 방향(과다·과소)을 붙이지 않는다. 5세대의 대응 축이 아니어서 "올바른 값"에
//       해당하는 비교 대상 계산이 없다. 위험은 금액이 아니라 **조용한 폐기**다.
//   - 별도 보장종목 전용 키 9종(`priorAnnualInpatientDeductible`·`priorAnnualCoveredCount`·
//     `priorAnnualTreatmentActCount`·`approvedThroughVisit`·`injectionPurpose`·`item`·`lines`·
//     `route`·`stays`)도 값이 0이든 아니든 통과했다.
//   - `priorAnnualDeductible`은 급여·통원·비중증·병·의원급 입원처럼 **소비되지 않는 조합**에
//     실려도 통과했고, 값 검증도 없어 문자열·null·객체·배열·불리언·음수·NaN·±Infinity가
//     `nonNegInt()`로 조용히 0이 됐다(→ 남은 공제 여력이 최대로 열려 **보험금 과소 산출**).
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: A군(레거시)·B군(별도 보장종목 전용 키)·C군(`priorAnnualDeductible` 경로·값) 가드,
//     그리고 안내에 "받은 값"을 실을 때 쓰는 **안전 표시 헬퍼**.
//   - 하지 않는다: `outpatientCoverageLimit`·`nhisCoinsuranceRate`·`tier`의 전체 경로 봉인
//     (별도 조사 대상), `undefined`의 의미 변경, 명시적 0 거부, 한도 초과 안전 정수 절삭,
//     산식·규칙값·UI·G-14A pool 범위 HOLD·지급 0원 HOLD 3종·상급병실료 HOLD 변경.
//
// ⚠ 반환 계약은 이 파일의 기존 `blocked()`다 — `PENDING_UNVERIFIED`이면서 **`totalAmount`를
//   보존**한다. `specialItem2026.ts`의 `rejected()`(`totalAmount: 0`, `route: "rejected"`)와
//   섞지 않는다. 두 진입점의 계약이 서로 다른 것은 의도다.
import { readFileSync } from "node:fs";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { Gen2026MultiClaimInput, MultiClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
/** ⚠ 던지지 않는다는 것 자체가 계약이다. 던지면 그 사실을 결과로 돌려 검사에 걸리게 한다. */
const call = (input: unknown): MultiClaimResult | { threw: string } => {
  try { return calculateMany2026(input as Gen2026MultiClaimInput); }
  catch (e) { return { threw: (e as Error).message.slice(0, 80) }; }
};
const threw = (r: ReturnType<typeof call>): r is { threw: string } => "threw" in r;
const notes = (r: ReturnType<typeof call>) => threw(r) ? "" : r.notes.join(" ");
/** blocked() 계약: PENDING_UNVERIFIED · totalAmount 보존 · 금액과 행을 만들지 않음. */
const isBlocked = (r: ReturnType<typeof call>, keepAmount: number) =>
  !threw(r) && r.status === "PENDING_UNVERIFIED" && r.totalAmount === keepAmount
  && r.totalOwnPay === null && r.totalInsurancePay === null && r.lines.length === 0;

const NB_AMT = 2_000_000, OUT_AMT = 300_000, BEN_AMT = 1_000_000;
const nbIn = (e: Record<string, unknown> = {}) => ({ cause: "injury", coverage: "non_benefit",
  visit: "inpatient", tier: "hospital", severity: "critical", nonBenefitItem: "general",
  amounts: [NB_AMT], ...e });
const nbOut = (e: Record<string, unknown> = {}) => ({ cause: "injury", coverage: "non_benefit",
  visit: "outpatient", severity: "critical", nonBenefitItem: "general", amounts: [OUT_AMT],
  priorAnnualOutpatientVisits: 0, ...e });
const ben = (e: Record<string, unknown> = {}) => ({ cause: "injury", coverage: "benefit",
  visit: "inpatient", tier: "hospital", amounts: [BEN_AMT], ...e });

const SPECIAL_ONLY = ["priorAnnualInpatientDeductible", "priorAnnualCoveredCount",
  "priorAnnualTreatmentActCount", "approvedThroughVisit", "injectionPurpose",
  "item", "lines", "route", "stays"];
const BAD_VALUES: [string, unknown][] = [
  ["문자열 '4900000'", "4900000"], ["빈 문자열", ""], ["null", null], ["객체", { v: 1 }],
  ["배열", [1]], ["true", true], ["false", false], ["음수 -1", -1], ["소수 1.5", 1.5],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["안전 정수+1", Number.MAX_SAFE_INTEGER + 1], ["1e308", 1e308],
];
/** ⚠ 이 두 값은 `JSON.stringify`가 **예외를 던진다.** 안전 표시가 없으면 계산 중단이 아니라
 *    런타임 예외로 끝난다 — 타입을 우회한 입력을 막는 작업의 목적이 무너진다. */
const makeCircular = () => { const o: Record<string, unknown> = { a: 1 }; o.self = o; return o; };
const THROWING_VALUES: [string, () => unknown][] = [
  ["bigint 1n", () => 1n], ["순환 참조 객체", makeCircular],
];

// ── 1. 정상 입력 무회귀 ──────────────────────────────────────────────
console.log("\n[G-14C] 1. 정상 입력 무회귀");
{
  const a = call(nbIn()), b = call(ben()), c = call(nbOut());
  check("비급여 중증 입원 상급종합", !threw(a) && a.status === "OK" && a.totalInsurancePay === 1_400_000);
  check("급여 입원", !threw(b) && b.status === "OK" && b.totalInsurancePay === 800_000);
  check("비급여 중증 통원", !threw(c) && c.status === "OK" && c.totalInsurancePay === 210_000);
}

// ── 2. A군 — 2·3세대 전용 레거시 필드 ────────────────────────────────
console.log("\n[G-14C] 2. A군 priorAnnualPaid");
for (const v of [3_000_000, 0]) {
  for (const [n, mk, amt] of [["비급여", nbIn, NB_AMT], ["급여", ben, BEN_AMT]] as
    [string, (e: Record<string, unknown>) => unknown, number][]) {
    const r = call(mk({ priorAnnualPaid: v }));
    check(`${n} priorAnnualPaid=${v} 거부(0도 거부)`,
      isBlocked(r, amt) && notes(r).includes("2·3세대 입원 자기부담 상한"), notes(r).slice(0, 70));
  }
}
{
  const r = call(nbIn({ priorAnnualPaid: 1 }));
  check("A군: 5세대 대체 축을 안내", notes(r).includes("priorAnnualDeductible로 넘겨 주세요"));
  check("A군: 조용히 버리지 않는 이유를 명시", notes(r).includes("조용히 버리면"));
  // ⚠ 금액 방향을 단정하지 않는다 — 5세대의 대응 축이 아니라 비교할 올바른 계산값이 없다.
  for (const banned of ["과다 산출", "과소 산출", "보험금이 늘어", "보험금이 줄어"]) {
    check(`A군 안내에 금액 방향 단정 없음: ${banned}`, !notes(r).includes(banned));
  }
  check("A군: 단건 calc2026과 같은 판단",
    calc2026({ amount: NB_AMT, coverage: "non_benefit", nonBenefitItem: "general",
      severity: "critical", visit: "inpatient", tier: "hospital",
      priorAnnualPaid: 1 } as never).status === "PENDING_UNVERIFIED");
}

// ── 3. B군 — 별도 보장종목 전용 키 ───────────────────────────────────
console.log("\n[G-14C] 3. B군 별도 보장종목 전용 키 9종");
for (const k of SPECIAL_ONLY) {
  for (const v of [1, 0]) {
    const r = call(nbIn({ [k]: v }));
    check(`${k}=${v} 거부(비급여)`, isBlocked(r, NB_AMT) && notes(r).includes(k), notes(r).slice(0, 60));
  }
  const rb = call(ben({ [k]: 0 }));
  check(`${k}=0 거부(급여)`, isBlocked(rb, BEN_AMT) && notes(rb).includes(k));
}
{
  const r = call(nbIn({ item: "mri" }));
  check("B군: 올바른 진입점을 안내", notes(r).includes("calculateGen2026Item"));
  check("B군: 근거 조문을 명시", notes(r).includes("제5조 제1항 단서·제3항"));
}

// ── 4. C군 — priorAnnualDeductible 경로 ──────────────────────────────
console.log("\n[G-14C] 4. C군 priorAnnualDeductible 경로");
{
  const ok = call(nbIn({ priorAnnualDeductible: 4_900_000 }));
  check("중증·입원·상급종합: 허용되고 계산됨",
    !threw(ok) && ok.status === "OK" && ok.totalInsurancePay === 1_900_000);
  check("명시적 0: 유효값",
    (call(nbIn({ priorAnnualDeductible: 0 })) as MultiClaimResult).totalInsurancePay === 1_400_000);
  check("생략: 종전 의미(0에서 시작) 유지",
    (call(nbIn()) as MultiClaimResult).totalInsurancePay === 1_400_000);
  check("undefined: 생략과 동일",
    (call(nbIn({ priorAnnualDeductible: undefined })) as MultiClaimResult).totalInsurancePay === 1_400_000);
  // 한도 초과 안전 정수는 유효한 과거 상태다. 절삭하지 않는다.
  check("5,000,001: 무절삭·허용",
    (call(nbIn({ priorAnnualDeductible: 5_000_001 })) as MultiClaimResult).totalInsurancePay === 2_000_000);
  check("안전 정수 최대: 무절삭·허용",
    (call(nbIn({ priorAnnualDeductible: Number.MAX_SAFE_INTEGER })) as MultiClaimResult).totalInsurancePay === 2_000_000);

  for (const [n, arg, amt] of [
    ["병·의원급 입원", nbIn({ tier: "clinic", priorAnnualDeductible: 4_900_000 }), NB_AMT],
    ["중증 통원", nbOut({ priorAnnualDeductible: 4_900_000 }), OUT_AMT],
    ["비중증 입원", nbIn({ severity: "non_critical", priorAnnualDeductible: 4_900_000 }), NB_AMT],
    ["병·의원급 입원 · 값 0", nbIn({ tier: "clinic", priorAnnualDeductible: 0 }), NB_AMT],
  ] as [string, unknown, number][]) {
    const r = call(arg);
    check(`${n}: 거부`, isBlocked(r, amt) && notes(r).includes("상급종합병원·종합병원에만 적용됩니다"),
      notes(r).slice(0, 70));
  }
  const rb = call(ben({ priorAnnualDeductible: 4_900_000 }));
  check("급여: 거부", isBlocked(rb, BEN_AMT) && notes(rb).includes("급여 계산에는 쓰이지 않습니다"));
}

// ── 5. 안내 우선순위 ─────────────────────────────────────────────────
console.log("\n[G-14C] 5. 안내 우선순위");
{
  // A·B는 preflight보다 앞이다 — nonBenefitItem이 무엇이든 이 키들은 쓰이지 않는다.
  const a = call(nbIn({ nonBenefitItem: "mri", priorAnnualPaid: 1 }));
  check("A군이 preflight(치료유형)보다 먼저", notes(a).includes("2·3세대 입원 자기부담 상한")
    && !notes(a).includes("현재 계산 대상이 아닙니다"), notes(a).slice(0, 60));
  const b = call(nbIn({ nonBenefitItem: "mri", item: "mri" }));
  check("B군이 preflight(치료유형)보다 먼저", notes(b).includes("별도 보장종목")
    && !notes(b).includes("현재 계산 대상이 아닙니다"), notes(b).slice(0, 60));
  // C는 기존 선택 안내 뒤다 — 미지정 상태에서 엉뚱한 안내가 나가면 안 된다.
  const noTier = call({ cause: "injury", coverage: "non_benefit", visit: "inpatient",
    severity: "critical", nonBenefitItem: "general", amounts: [NB_AMT], priorAnnualDeductible: 4_900_000 });
  check("종별 미지정: 기존 종별 안내가 우선",
    notes(noTier).includes("의료기관 종별 미지정") && !notes(noTier).includes("상급종합병원·종합병원에만 적용됩니다"),
    notes(noTier).slice(0, 60));
  const noSev = call({ cause: "injury", coverage: "non_benefit", visit: "inpatient", tier: "hospital",
    nonBenefitItem: "general", amounts: [NB_AMT], priorAnnualDeductible: 4_900_000 });
  check("질환 구분 미지정: 기존 안내가 우선",
    notes(noSev).includes("중증/비중증(severity) 미지정") && !notes(noSev).includes("상급종합병원·종합병원에만 적용됩니다"),
    notes(noSev).slice(0, 60));
  const outCounter = call({ cause: "injury", coverage: "non_benefit", visit: "outpatient",
    severity: "critical", nonBenefitItem: "general", amounts: [OUT_AMT], priorAnnualDeductible: 4_900_000 });
  check("통원 카운터 미입력이 C군보다 우선",
    notes(outCounter).includes("통원 100회가 한도입니다"), notes(outCounter).slice(0, 60));
}

// ── 6. C군 값 검증 ───────────────────────────────────────────────────
console.log("\n[G-14C] 6. C군 값 검증");
for (const [n, v] of BAD_VALUES) {
  const r = call(nbIn({ priorAnnualDeductible: v }));
  check(`priorAnnualDeductible ${n} 거부`,
    isBlocked(r, NB_AMT) && notes(r).includes("0 이상의 정수여야 합니다"), notes(r).slice(0, 60));
}
{
  const r = call(nbIn({ priorAnnualDeductible: -1 }));
  check("값 안내가 무절삭 계약을 함께 밝힘", notes(r).includes("500만원을 넘는 값도 유효한 과거 상태"));
}

// ── 7. 안전 표시 — bigint·순환 객체가 예외 없이 blocked ──────────────
console.log("\n[G-14C] 7. 안전 표시(bigint·순환 참조)");
for (const [n, make] of THROWING_VALUES) {
  for (const [label, arg, amt] of [
    ["A군", (v: unknown) => nbIn({ priorAnnualPaid: v }), NB_AMT],
    ["B군", (v: unknown) => nbIn({ priorAnnualCoveredCount: v }), NB_AMT],
    ["C군 경로", (v: unknown) => ben({ priorAnnualDeductible: v }), BEN_AMT],
    ["C군 값", (v: unknown) => nbIn({ priorAnnualDeductible: v }), NB_AMT],
    ["기존 카운터 값", (v: unknown) => nbOut({ priorAnnualOutpatientVisits: v }), OUT_AMT],
    ["기존 카운터 급여 stray", (v: unknown) => ben({ priorAnnualOutpatientVisits: v }), BEN_AMT],
    ["기존 카운터 입원 stray", (v: unknown) => nbIn({ priorAnnualOutpatientVisits: v }), NB_AMT],
  ] as [string, (v: unknown) => unknown, number][]) {
    const r = call(arg(make()));
    check(`${label}: ${n} → 예외 없이 blocked`, isBlocked(r, amt),
      threw(r) ? "THROW " + r.threw : "status=" + (r as MultiClaimResult).status);
  }
}
{
  // 표시가 실패해도 안내 자체는 나온다.
  const r = call(nbIn({ priorAnnualDeductible: 1n }));
  check("안전 표시: '받은 값' 줄이 그대로 있다", notes(r).includes("받은 값:"));
  check("안전 표시: 값이 문자열로 낮춰 표시된다", notes(r).includes("받은 값: 1"), notes(r).slice(-40));
}

// ── 8. 소스 계약 ─────────────────────────────────────────────────────
console.log("\n[G-14C] 8. 소스 계약");
{
  const src = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const body = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("안전 표시 헬퍼가 있다", /const showValue = \(v: unknown\): string => \{/.test(body));
  check("안전 표시가 try/catch로 감싸져 있다",
    /try \{[\s\S]{0,200}JSON\.stringify\(v\)[\s\S]{0,200}\} catch/.test(body));
  check("실패 시 String(v)로 낮춘다", /return String\(v\);/.test(body));
  check("그마저 실패하면 고정 문구", /return "\(표시할 수 없는 값\)";/.test(body));
  // ⚠ 안내에서 JSON.stringify를 직접 쓰면 다시 던진다. 지문(fingerprint)용 1회만 남아야 한다.
  check("안내에 JSON.stringify를 직접 쓰지 않는다",
    !/받은 값: \$\{JSON\.stringify/.test(body));
  // 통원 카운터 4곳 + A군 1 + B군 1 + C군 3(급여 경로·미소비 경로·값) + 지급보험금 1(G-20) = 10.
  //   ⚠ 계약 갱신(G-20): 기존 지급보험금 축이 값 검증으로 옮겨지면서 안내가 한 곳 늘었다.
  //     요지("받은 값을 싣는 안내는 예외 없이 전부 안전 표시를 쓴다")는 그대로다.
  check("'받은 값' 안내가 모두 안전 표시를 쓴다",
    (body.match(/받은 값: \$\{showValue\(/g) ?? []).length === 10,
    String((body.match(/받은 값: \$\{showValue\(/g) ?? []).length));
  check("B군 키 목록이 9종", (body.match(/const SPECIAL_ITEM_ONLY_KEYS = \[[\s\S]*?\] as const;/) ?? [""])[0]
    .split('"').filter((x) => x.startsWith("prior") || ["approvedThroughVisit", "injectionPurpose", "item", "lines", "route", "stays"].includes(x)).length === 9);
  check("B군 목록에 priorAnnualDeductible을 넣지 않는다",
    !/const SPECIAL_ITEM_ONLY_KEYS = \[[\s\S]*?"priorAnnualDeductible"[\s\S]*?\] as const;/.test(body));
  check("roomCharge의 UNUSED_KEYS와 목록을 공유하지 않는다",
    !/UNUSED_KEYS/.test(body));
  check("C군 소비 조건이 calc2026과 같은 식",
    /severity === undefined \|\| severity === "critical"/.test(body)
    && /nb\?\.visit === "inpatient"/.test(body)
    && /nb\.tier === undefined \|\| nb\.tier === "hospital"/.test(body));
  check("C군 값 검증이 통원 카운터와 같은 형식 규칙(badCount)", /if \(badCount\(deductible\)\) \{/.test(body));
  check("C군에 절삭·변환을 넣지 않는다",
    !/Math\.min\([^)]*deductible/.test(body) && !/Number\(\s*deductible\s*\)/.test(body));
  check("반환은 blocked()이며 rejected()를 쓰지 않는다", !/rejected\(/.test(body));
  // A·B가 preflight보다 앞, C가 뒤라는 **순서**를 소스로도 고정한다.
  const iA = body.indexOf("priorAnnualPaid는 2·3세대");
  const iB = body.indexOf("SPECIAL_ITEM_ONLY_KEYS.find");
  const iP = body.indexOf("const probe = calc2026(");
  const iC = body.indexOf("const deductible = readCount(input,");
  check("순서: A군 < preflight", iA > 0 && iA < iP);
  check("순서: B군 < preflight", iB > 0 && iB < iP);
  check("순서: preflight < C군", iP > 0 && iP < iC);
}

// ── 9. 규칙값·산식·HOLD 불변 ─────────────────────────────────────────
console.log("\n[G-14C] 9. 규칙값·산식·HOLD 불변");
{
  check("500만 원 값 불변", GEN2026.nonBenefit.critical.annualDeductibleCap === 5_000_000
    && REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.value === 5_000_000);
  check("G-14A pool 범위 HOLD 불변",
    REGULATORY_RULES.GEN2026_CRITICAL_DEDUCTIBLE_POOL_SCOPE.status === "HOLD"
    && REGULATORY_RULES.GEN2026_CRITICAL_DEDUCTIBLE_POOL_SCOPE.value === null);
  check("지급 0원 HOLD 3종 불변",
    REGULATORY_RULES.GEN2026_SPECIAL_ITEM_COUNT_ON_ZERO_PAY.status === "HOLD"
    && REGULATORY_RULES.GEN2026_NONCRITICAL_OUTPATIENT_DAYS_ON_ZERO_PAY.status === "HOLD"
    && REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_VISITS_ON_ZERO_PAY.status === "HOLD");
  check("상급병실료 HOLD 불변", REGULATORY_RULES.GEN2026_ROOM_CHARGE_DEDUCTIBLE_POOL.status === "HOLD");
  // 지급 0원 HOLD 차단이 여전히 동작한다 — 가드 추가로 그 경로가 사라지지 않았다.
  const hold = call(nbOut({ amounts: [10_000, 300_000], priorAnnualOutpatientVisits: 99 }));
  check("중증 통원 지급 0원 HOLD 경로가 살아 있음",
    !threw(hold) && (hold.status === "OK" || notes(hold).includes("표준약관에 정해져 있지 않습니다")));
  // 거부 안내에 규제 HOLD 문구를 섞지 않는다.
  for (const h of ["표준약관에 정해져 있지 않습니다", "가입하신 보험사에 확인해 주세요"]) {
    check(`거부 안내에 HOLD 문구 없음: ${h}`, !notes(call(nbIn({ priorAnnualPaid: 1 }))).includes(h));
  }
}

// ── 10. 범위 밖(이번에 봉인하지 않은 축)이 그대로인지 ────────────────
console.log("\n[G-14C] 10. 범위 밖 축 무변경");
{
  const a = call(nbIn({ outpatientCoverageLimit: 100_000 }));
  check("outpatientCoverageLimit을 입원에 실어도 종전대로 계산",
    !threw(a) && a.status === "OK" && a.totalInsurancePay === 1_400_000);
  const b = call(nbIn({ nhisCoinsuranceRate: 0.2 }));
  check("nhisCoinsuranceRate를 비급여에 실어도 종전대로 계산",
    !threw(b) && b.status === "OK" && b.totalInsurancePay === 1_400_000);
  const c = call(nbOut({ tier: "hospital" }));
  check("tier를 통원에 실어도 종전대로 계산",
    !threw(c) && c.status === "OK" && c.totalInsurancePay === 210_000);
}

console.log(`\n[G-14C 다회 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
