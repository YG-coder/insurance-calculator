// F-2 — 2·3세대 외래·처방전 횟수 입력의 엄격 검증.
//
// ⚠ 새 규제 숫자를 만들지 않는다. 외래 180회·처방전 180건 한도는 그대로다.
//   바뀐 것은 "잘못된 입력을 어떻게 다루는가"뿐이다.
//
// ⚠ 미입력 차단은 **계산기의 안전 정책**이다. 약관이 이 입력을 의무화한 것이 아니다.
//   한도가 걸린 축이라 과거 사용량을 모르면 결과를 낼 수 없다는 판단이다.
//
// ⚠ 4·5세대와 달리 이 묶음은 행마다 visit·facility가 다르다. 어떤 축이 필요한지는
//   최상위 필드가 아니라 lines의 내용이 정한다 — 그래서 타입 판별 유니온을 쓸 수 없고,
//   두 필드는 optional로 두되 런타임이 같은 계약을 강제한다.
//
// ⚠ 지급 0원·진료비 0원 행의 횟수 소진은 이번에 해석하지 않는다. 계산 순서 무변경.
import { readFileSync } from "node:fs";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { GEN2009, GEN2017 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { ClaimLine, Facility, MultiClaimInput, MultiClaimResult } from "../src/lib/insurance/engine/types";
import HealthCalcStandardized from "../src/components/calculators/HealthCalcStandardized";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const A = 300_000;          // 표준형 외래 의원 20% = 6만 → 지급 24만
const PAY = 240_000;
const RX = 30_000;          // 처방조제 8천 공제 → 지급 2.2만
const eng = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
const ui = readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8");
const GENS = ["2009", "2017"] as const;
const LIMIT = GEN2017.outpatientAnnualVisits;      // 180
const RX_LIMIT = GEN2017.prescriptionAnnualCount;  // 180

const out = (amount: number, facility: Facility = "clinic"): ClaimLine =>
  ({ amount, visit: "outpatient", facility });
const inp = (amount: number): ClaimLine => ({ amount, visit: "inpatient" });
type Extra = Partial<Record<string, unknown>>;
const run = (gen: "2009" | "2017", lines: ClaimLine[], extra: Extra = {}) =>
  calculateMany(gen, { plan: "standard", lines, ...extra } as unknown as MultiClaimInput);
/** 외래 축만 쓰는 묶음. OMIT은 키 자체를 넣지 않는다. */
const vis = (gen: "2009" | "2017", lines: ClaimLine[], v: unknown, extra: Extra = {}) =>
  run(gen, lines, { ...(v === "OMIT" ? {} : { priorAnnualOutpatientVisits: v }), ...extra });
/** 처방전 축만 쓰는 묶음. */
const rx = (gen: "2009" | "2017", lines: ClaimLine[], v: unknown, extra: Extra = {}) =>
  run(gen, lines, { ...(v === "OMIT" ? {} : { priorAnnualPrescriptions: v }), ...extra });

const paid = (r: MultiClaimResult) => r.lines.map((l) => l.insurancePay).join();
const blockedOk = (r: MultiClaimResult, totalAmount: number) =>
  r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
  && r.totalOwnPay === null && r.totalInsurancePay === null
  && r.appliedCaps.length === 0 && r.totalAmount === totalAmount;

const BAD: [string, unknown][] = [
  ["-1", -1], ["-0.1", -0.1], ["1.5", 1.5], ["179.9", 179.9], ["NaN", NaN],
  ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ['문자열 "180"', "180"], ['문자열 "abc"', "abc"],
  ["객체", {}], ["null", null], ["true", true],
];

// ── 근거 ─────────────────────────────────────────────────────────────
console.log("\n[근거] 새 규제 숫자를 만들지 않는다");
{
  const rules = REGULATORY_RULES as unknown as Record<string, { ruleId: string; value: unknown; status: string }>;
  const byId = Object.fromEntries(Object.values(rules).map((r) => [r.ruleId, r]));
  for (const id of ["GEN2009-OUTPATIENT-ANNUAL-VISITS", "GEN2009-PRESCRIPTION-ANNUAL-COUNT",
    "GEN2017-OUTPATIENT-ANNUAL-VISITS", "GEN2017-PRESCRIPTION-ANNUAL-COUNT"] as const) {
    check(`${id} = 180 CONFIRMED 그대로`, byId[id]?.status === "CONFIRMED" && byId[id]?.value === 180);
  }
  check("두 세대의 상수를 각각 읽는다",
    GEN2009.outpatientAnnualVisits === 180 && GEN2017.outpatientAnnualVisits === 180
    && GEN2009.prescriptionAnnualCount === 180 && GEN2017.prescriptionAnnualCount === 180);
  check("입력 검증용 새 규칙을 만들지 않았다",
    !Object.keys(byId).some((id) => /GEN20(09|17).*(INPUT|VALIDATION|PARSER)/i.test(id)));
  check("한도는 상수에서 읽는다",
    /constants\.outpatientAnnualVisits/.test(eng) && /constants\.prescriptionAnnualCount/.test(eng)
    && !/>= 180/.test(eng));
  check("미입력 차단을 약관 의무로 서술하지 않는다",
    /계산기의 안전 정책이다\. 약관이 이 입력을 의무화한 것이 아니다/.test(eng));
}

// ── 두 세대 × 두 축 ──────────────────────────────────────────────────
for (const gen of GENS) {
  const label = gen === "2009" ? "2세대" : "3세대";

  console.log(`\n[${label}] 외래 연 ${LIMIT}회`);
  {
    const L = [out(A)];
    check("미입력(키 없음) → 차단", blockedOk(vis(gen, L, "OMIT"), A));
    check("undefined → 차단", blockedOk(vis(gen, L, undefined), A));
    check("미입력 안내가 무엇을 넣어야 하는지 알려준다",
      vis(gen, L, "OMIT").notes.some((n) => n.includes("이미 사용한 외래 방문 횟수"))
      && vis(gen, L, "OMIT").notes.some((n) => n.includes("이전 방문이 없으면 0")));
    check("미입력 안내는 '회' 단위",
      vis(gen, L, "OMIT").notes.some((n) => n.includes(`${LIMIT}회가 한도`)));
    check("명시적 0 → 정상", paid(vis(gen, L, 0)) === String(PAY));
    check("178 → 정상", paid(vis(gen, L, 178)) === String(PAY));
    check("179 → 180회째라 보상", paid(vis(gen, L, 179)) === String(PAY));
    check("179 + 2건 → 첫 건만 보상",
      paid(vis(gen, [out(A), out(A)], 179)) === [PAY, 0].join());
    check("180 → 제외", paid(vis(gen, L, 180)) === "0");
    check("181 → 제외", paid(vis(gen, L, 181)) === "0");
    check("5000 → 절삭하지 않고 제외(결과)", paid(vis(gen, L, 5_000)) === "0");
    check("MAX_SAFE_INTEGER는 유효값", vis(gen, L, Number.MAX_SAFE_INTEGER).status === "OK");
    check("제외 행에 외래 CapCode",
      vis(gen, L, 180).appliedCaps.includes(`GEN${gen}_OUTPATIENT_ANNUAL_VISITS`));
    for (const [what, v] of BAD) check(`${what} → 차단`, blockedOk(vis(gen, L, v), A));
    check("-1을 0으로 바꾸지 않는다", paid(vis(gen, L, -1)) !== String(PAY));
    check("179.9를 179로 내리지 않는다", vis(gen, L, 179.9).status !== "OK");
    check('문자열 "180"을 0으로 바꾸지 않는다', vis(gen, L, "180").status !== "OK");
    check("처방전 축이 실리면 차단(약국 행이 없다)",
      vis(gen, L, 0, { priorAnnualPrescriptions: 0 }).status === "PENDING_UNVERIFIED");
  }

  console.log(`\n[${label}] 처방전 연 ${RX_LIMIT}건`);
  {
    const L = [out(RX, "pharmacy")];
    const RXPAY = rx(gen, L, 0).lines[0].insurancePay;
    check("미입력 → 차단", blockedOk(rx(gen, L, "OMIT"), RX));
    check("미입력 안내가 '건' 단위와 처방전을 밝힌다",
      rx(gen, L, "OMIT").notes.some((n) => n.includes(`${RX_LIMIT}건이 한도`))
      && rx(gen, L, "OMIT").notes.some((n) => n.includes("이미 사용한 처방전 건수")));
    check("안내가 '외래 방문'과 섞이지 않는다",
      !rx(gen, L, "OMIT").notes.some((n) => n.includes("이미 사용한 외래 방문 횟수")));
    check("명시적 0 → 정상", rx(gen, L, 0).status === "OK" && (RXPAY ?? 0) > 0);
    check("179 → 보상", rx(gen, L, 179).lines[0].covered === true);
    check("180 → 제외", rx(gen, L, 180).lines[0].covered === false);
    check("181 → 제외", rx(gen, L, 181).lines[0].covered === false);
    check("5000 → 절삭하지 않고 제외(결과)", rx(gen, L, 5_000).lines[0].covered === false);
    check("제외 행에 처방전 CapCode",
      rx(gen, L, 180).appliedCaps.includes(`GEN${gen}_PRESCRIPTION_ANNUAL_COUNT`));
    for (const [what, v] of BAD) check(`${what} → 차단`, blockedOk(rx(gen, L, v), RX));
    check("외래 축이 실리면 차단(약국 아닌 통원 행이 없다)",
      rx(gen, L, 0, { priorAnnualOutpatientVisits: 0 }).status === "PENDING_UNVERIFIED");
  }

  console.log(`\n[${label}] 두 축이 섞인 묶음·입원`);
  {
    const mixed = [out(A), out(RX, "pharmacy")];
    check("외래+약국 묶음: 두 축 모두 필요",
      blockedOk(run(gen, mixed, { priorAnnualOutpatientVisits: 0 }), A + RX)
      && blockedOk(run(gen, mixed, { priorAnnualPrescriptions: 0 }), A + RX));
    check("외래+약국 묶음: 둘 다 주면 정상",
      run(gen, mixed, { priorAnnualOutpatientVisits: 0, priorAnnualPrescriptions: 0 }).status === "OK");
    check("두 축은 별도로 센다",
      run(gen, mixed, { priorAnnualOutpatientVisits: 179, priorAnnualPrescriptions: 0 })
        .lines.map((l) => l.covered).join() === "true,true");
    check("외래 한도만 소진되면 약국 행은 보상",
      run(gen, mixed, { priorAnnualOutpatientVisits: 180, priorAnnualPrescriptions: 0 })
        .lines.map((l) => l.covered).join() === "false,true");
    check("처방전 한도만 소진되면 외래 행은 보상",
      run(gen, mixed, { priorAnnualOutpatientVisits: 0, priorAnnualPrescriptions: 180 })
        .lines.map((l) => l.covered).join() === "true,false");
    // 입원만 있는 묶음
    const inpOnly = [inp(1_000_000)];
    check("입원만: 카운터 없이 정상 계산", run(gen, inpOnly).status === "OK");
    for (const field of ["priorAnnualOutpatientVisits", "priorAnnualPrescriptions"] as const) {
      check(`입원만: ${field}가 실리면 값 0이어도 차단`,
        blockedOk(run(gen, inpOnly, { [field]: 0 }), 1_000_000));
    }
    // 입원이 섞인 묶음은 통원 축만 요구한다
    check("외래+입원 묶음: 외래 축만 요구",
      run(gen, [out(A), inp(1_000_000)], { priorAnnualOutpatientVisits: 0 }).status === "OK");
    check("입원은 통원 한도의 영향을 받지 않는다",
      run(gen, [out(A), inp(1_000_000)], { priorAnnualOutpatientVisits: 180 })
        .lines.map((l) => l.covered).join() === "false,true");
  }
}

// ── 지급 0원 처리·계산 순서 무변경 (범위 밖) ──────────────────────────
console.log("\n[무변경] 지급 0원 처리와 계산 순서");
{
  check("진료비 0원 행도 종전대로 횟수를 소진한다",
    vis("2017", [out(0), out(A)], 179).lines[1].covered === false);
  check("소진 판정이 여전히 계산 **전**에 있다(구조 무변경)",
    /if \(used >= limit\) \{[\s\S]{0,400}if \(isPrescription\) prescriptions \+= 1; else outpatientVisits \+= 1;[\s\S]{0,200}const single: CalcResult/.test(eng));
  check("지급 0원 이중 해석을 도입하지 않았다",
    !eng.includes("fingerprint") && !eng.includes("countZeroPay"));
}

// ── 타입 ─────────────────────────────────────────────────────────────
console.log("\n[타입] optional인 이유가 문서화돼 있다");
{
  // ⚠ G-34B에서 필드 선언부의 이름이 `MultiClaimInputFields`로 바뀌었다 — 공개 타입
  //   `MultiClaimInput`이 그 선언부와 **미사용 축 봉인**(`SealNever<…>`)의 교차가 됐기
  //   때문이다. 이 검사가 보는 것은 "두 카운터가 optional이고 그 이유가 문서화돼 있다"이므로
  //   선언부만 그대로 잡는다.
  const body = /interface MultiClaimInputFields \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
  check("MultiClaimInput 선언부를 찾음", body.length > 0);
  check("공개 타입이 선언부와 미사용 축 봉인의 교차다",
    /export type MultiClaimInput = MultiClaimInputFields\n\s*& SealNever</.test(types));
  check("두 축이 optional이다", /priorAnnualOutpatientVisits\?: number;/.test(body)
    && /priorAnnualPrescriptions\?: number;/.test(body));
  check("optional인 이유가 '타입으로 표현 불가'로 적혀 있다",
    body.includes("타입으로 표현할 수 없어서")
    && body.includes("lines의 내용이 정하고"));
  check("'미입력 허용'이 아님을 명시", body.includes('"미입력을 허용해서"가 아니라'));
  check("미입력≠0을 명시", body.includes("미입력(undefined)과 확인 결과 0은 다른 상태다"));
  check("두 축이 별개임을 명시", body.includes("단위가 회 ≠ 건이고"));
  check("절삭 금지를 명시", body.includes("절삭하지 않는다"));
}

// ── 구조 ─────────────────────────────────────────────────────────────
console.log("\n[구조] 검증 위치와 절삭 금지");
{
  check("형식 검증을 한 함수로 모았다", /const badCount = \(v: unknown\): boolean =>/.test(eng));
  check("badCount가 안전 정수와 0 이상을 본다",
    /typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0/.test(eng));
  check("축 필요 여부를 lines 내용으로 정한다",
    /const usesVisits = lines\.some\(\(l\) => l\.visit === "outpatient" && !isPharmacyLine\(l\)\)/.test(eng)
    && /const usesPrescriptions = lines\.some\(isPharmacyLine\)/.test(eng));
  check("약국 판정이 facility 기본값을 반영한다",
    /\(l\.facility \?\? "clinic"\) === "pharmacy"/.test(eng));
  check("두 축의 미입력을 각각 차단한다",
    /if \(usesVisits\) \{\s*\n\s*if \(visitsRaw === undefined\)/.test(eng)
    && /if \(usesPrescriptions\) \{\s*\n\s*if \(prescriptionsRaw === undefined\)/.test(eng));
  check("두 축이 서로 실리면 각각 차단한다",
    /if \(!usesVisits && visitsRaw !== undefined\)/.test(eng)
    && /if \(!usesPrescriptions && prescriptionsRaw !== undefined\)/.test(eng));
  check("카운터를 더 이상 정규화하지 않는다",
    !/nonNegInt\(input\.priorAnnualOutpatientVisits\)/.test(eng)
    && !/nonNegInt\(input\.priorAnnualPrescriptions\)/.test(eng));
  check("금액 축의 nonNegInt는 그대로 남아 있다",
    /nonNegInt\(input\.priorAnnualPaid\)/.test(eng));
  check("차단 결과가 진료비 합계를 유지한다",
    /totalAmount: lines\.reduce\(\(sum, l\) => sum \+ normalizeAmount\(l\.amount\), 0\),\s*\n\s*totalOwnPay: null, totalInsurancePay: null, appliedCaps: \[\], notes,/.test(eng));
  check("4·5세대 파서·상수를 재사용하지 않는다",
    !eng.includes("GEN2021") && !eng.includes("GEN2026") && !eng.includes("badOutpatientDays"));

  // ── 절삭 금지를 소스로 고정한다 ──────────────────────────────────
  //   ⚠ 런타임 결과로는 증명할 수 없다. 5000을 180으로 잘라도 "제외"가 같아서다.
  //   ⚠ 검사 범위는 **두 카운터의 초기화 구간**뿐이다. 금액 축의 정당한 클램프는 막지 않는다.
  {
    const initV = /\n  let outpatientVisits = ([^\n]*);\n/.exec(eng);
    const initP = /\n  let prescriptions = ([^\n]*);\n/.exec(eng);
    check("두 카운터의 초기화 구간을 찾음", initV !== null && initP !== null);
    for (const [axis, m, raw] of [["외래", initV, "visitsRaw"], ["처방전", initP, "prescriptionsRaw"]] as const) {
      const expr = m === null ? "" : m[1];
      check(`${axis}축: 검증을 통과한 원본이 그대로 카운터에 들어간다`,
        expr.replace(/\s+/g, " ").trim() === `(${raw} as number | undefined) ?? 0`, expr);
      check(`${axis}축: 초기화 구간에 절삭·비교가 없다`,
        !/Math\.(min|max|floor|ceil|round)/.test(expr) && !/[<>]/.test(expr)
        && !/constants\./.test(expr) && !/\b\d{2,}\b/.test(expr), expr);
    }
    // 초기화 뒤 첫 행 처리 전에 다시 손대지 않는다.
    const between = eng.slice(eng.indexOf("  let outpatientVisits = "), eng.indexOf("  lines.forEach("));
    const after = between.slice(between.indexOf("let prescriptions"));
    check("초기화와 첫 행 사이에서 카운터를 다시 손대지 않는다",
      !/(outpatientVisits|prescriptions)\s*(=[^=]|\+=|-=|\*=)/.test(after.slice(after.indexOf(";"))), after);
    // 루프 안의 대입은 1 증가뿐이다.
    const loop = eng.slice(eng.indexOf("  lines.forEach("));
    const writes = loop.match(/(?:outpatientVisits|prescriptions)\s*(?:=[^=]|\+=|-=|\*=|\/=)[^;]*/g) ?? [];
    check("루프 안의 카운터 대입은 '+= 1'뿐이다",
      writes.length > 0 && writes.every((w) => /\+= 1$/.test(w.trim())), writes.join(" | "));
    // 범위 한정이 지켜지는지 — 금액 축의 정당한 클램프는 그대로 있다.
    check("금액 축의 정당한 클램프는 금지하지 않는다",
      /Math\.max\(0, Math\.floor\(v\)\)/.test(eng));
  }
}

// ── 4·5세대 무회귀 ───────────────────────────────────────────────────
console.log("\n[범위] 4·5세대 무변경");
{
  // ⚠ G-34B: 4세대 다회는 급여 통원만 종별을 소비한다. 비급여 통원 픽스처에서 `tier`를 뺐다.
  const g4 = calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    rider: "none", amounts: [100_000], priorAnnualOutpatientVisits: 0 } as never);
  check("4세대는 종전대로 계산", g4.status === "OK" && g4.totalInsurancePay === 70_000);
  check("4세대는 여전히 미입력을 차단", calculateMany2021({ cause: "disease",
    coverage: "non_benefit", visit: "outpatient", tier: "clinic", rider: "none",
    amounts: [100_000] } as never).status === "PENDING_UNVERIFIED");
  const g5 = calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    tier: "clinic", severity: "critical", nonBenefitItem: "general", amounts: [500_000],
    priorAnnualOutpatientVisits: 0 } as never);
  check("5세대는 종전대로 계산", g5.status === "OK" && g5.totalInsurancePay === 350_000);
}

// ── UI 상태 전이 ─────────────────────────────────────────────────────
console.log("\n[화면] 상태 전이");
{
  const names = stateNamesFrom(ui);
  const VIS_LABEL = "계약해당일 기준 1년간 이미 사용한 외래 방문 횟수";
  const RX_LABEL = "계약해당일 기준 1년간 이미 사용한 처방전 건수";
  const row = (visit: string, facility: string) => ({ id: 1, amount: "300000", visit, facility });
  const setup = (over: Record<string, unknown> = {}) => {
    const h = mount(HealthCalcStandardized as unknown as () => unknown, names);
    for (const [k, v] of Object.entries({ plan: "standard", submitted: true, ...over })) h.set(k, v);
    return h.render();
  };
  const warnBoxes = (s: ReturnType<typeof setup>) =>
    s.nodes.filter((n) => n.tag === "#NoticeBox" && n.props.variant === "warning").length;

  const fresh = mount(HealthCalcStandardized as unknown as () => unknown, names).render();
  check("① 새 화면: 외래 입력 노출, 빈 값",
    fresh.has(VIS_LABEL) && fresh.nodes.some((n) => n.tag === "input" && n.props.value === ""));
  check("① 새 화면: 계산 전 경고 없음", warnBoxes(fresh) === 0);
  const emptyVis = setup();
  check("② 외래: 빈 값이면 안내만, 결과 없음",
    warnBoxes(emptyVis) === 1 && emptyVis.resultItems() === null);
  check("② 외래: 엔진 안내가 화면에 새지 않는다",
    !emptyVis.nodes.some((n) => (n.text ?? "").includes("priorAnnualOutpatientVisits")));
  check("③ 외래: 0이면 정상 계산", setup({ priorVisits: "0" }).resultItems() !== null);
  check("④ 외래 179 → 보상", setup({ priorVisits: "179" }).resultItems()?.[2]?.value === "240,000원");
  check("④ 외래 180 → 제외", setup({ priorVisits: "180" }).resultItems()?.[2]?.value === "0원");
  for (const bad of ["", "  ", "-1", "1.5", "abc", "1e2", "+1", "1,0", "9007199254740993"]) {
    const s = setup({ priorVisits: bad });
    check(`⑤ 외래 잘못된 값 ${JSON.stringify(bad)} → 차단`,
      warnBoxes(s) === 1 && s.resultItems() === null);
  }
  // 약국 행 — 처방전 축만 노출·요구
  const phRows = [row("outpatient", "pharmacy")];
  const ph = (o: Record<string, unknown> = {}) => setup({ rows: phRows, ...o });
  check("⑥ 약국 행만: 처방전 입력 노출, 외래 입력 없음",
    ph().has(RX_LABEL) && !ph().has(VIS_LABEL));
  check("⑥ 약국 행만: 빈 값이면 계산 차단", ph().resultItems() === null && warnBoxes(ph()) === 1);
  // ⚠ 게이트가 없으면 엔진을 호출하게 되고, 엔진 차단 안내가 화면에 그대로 새어 나온다
  //   (내부 필드명이 노출된다). 축마다 게이트가 실제로 계산을 막는지 각각 본다.
  check("⑥ 약국 행만: 엔진 안내가 화면에 새지 않는다",
    !ph().nodes.some((n) => (n.text ?? "").includes("priorAnnualPrescriptions")));
  const mixLeak = [row("outpatient", "clinic"), { id: 2, amount: "30000", visit: "outpatient", facility: "pharmacy" }];
  check("⑥ 섞인 묶음: 한쪽만 채워도 엔진 안내가 새지 않는다",
    !setup({ rows: mixLeak, priorVisits: "0" }).nodes
      .some((n) => (n.text ?? "").includes("priorAnnualPrescriptions"))
    && !setup({ rows: mixLeak, priorPrescriptions: "0" }).nodes
      .some((n) => (n.text ?? "").includes("priorAnnualOutpatientVisits")));
  check("⑦ 약국 행만: 0이면 정상 계산", ph({ priorPrescriptions: "0" }).resultItems() !== null);
  check("⑦ 약국 행만: 179 → 보상", ph({ priorPrescriptions: "179" }).resultItems()?.[2]?.value !== "0원");
  check("⑦ 약국 행만: 180 → 제외", ph({ priorPrescriptions: "180" }).resultItems()?.[2]?.value === "0원");
  // ⚠ 값이 다른 축으로 넘어가면 여기서 잡힌다 — 채운 쪽만 계산되고 반대쪽은 막힌다.
  check("⑧ 외래 값이 처방전으로 넘어가지 않는다", ph({ priorVisits: "0" }).resultItems() === null);
  check("⑧ 처방전 값이 외래로 넘어가지 않는다", setup({ priorPrescriptions: "0" }).resultItems() === null);
  // 두 축이 섞인 묶음
  const mixRows = [row("outpatient", "clinic"), { id: 2, amount: "30000", visit: "outpatient", facility: "pharmacy" }];
  check("⑨ 섞인 묶음: 두 입력 모두 노출",
    setup({ rows: mixRows }).has(VIS_LABEL) && setup({ rows: mixRows }).has(RX_LABEL));
  check("⑨ 섞인 묶음: 한쪽만 채우면 계산하지 않음",
    setup({ rows: mixRows, priorVisits: "0" }).resultItems() === null
    && setup({ rows: mixRows, priorPrescriptions: "0" }).resultItems() === null);
  check("⑨ 섞인 묶음: 둘 다 채우면 정상 계산",
    setup({ rows: mixRows, priorVisits: "0", priorPrescriptions: "0" }).resultItems() !== null);
  // 입원 행 — 두 입력 모두 미노출, 잔존값도 전달 안 함
  const inpRows = [{ id: 3, amount: "1000000", visit: "inpatient", facility: "clinic" }];
  check("⑩ 입원만: 두 입력 모두 없음",
    !setup({ rows: inpRows }).has(VIS_LABEL) && !setup({ rows: inpRows }).has(RX_LABEL));
  check("⑩ 입원만: 카운터 없이 정상 계산", setup({ rows: inpRows }).resultItems() !== null);
  check("⑩ 입원만: 잔존 상태가 있어도 정상 계산",
    setup({ rows: inpRows, priorVisits: "9", priorPrescriptions: "9" }).resultItems() !== null);
  check("⑪ UI가 공용 onlyNum()으로 횟수를 읽지 않는다",
    !/onlyNum\(prior(Visits|Prescriptions)\)/.test(ui));
  check("⑪ UI가 전용 파서를 쓴다", /const stdCount = /.test(ui)
    && /stdCount\(priorVisits\)/.test(ui) && /stdCount\(priorPrescriptions\)/.test(ui));
  check("⑪ 라벨에서 '(선택)'을 없애고 단위를 구분",
    !/이미 사용한 외래 방문 횟수 \(선택\)/.test(ui) && !/이미 사용한 처방전 건수 \(선택\)/.test(ui)
    && ui.includes("이전 방문이 없으면 0") && ui.includes("이전 처방이 없으면 0")
    && ui.includes("<b>180회</b>") && ui.includes("<b>별도로 180건</b>"));
  check("⑪ 차단 안내를 plan 미선택으로 단정하지 않는다",
    /result !== null && result\.status === "PENDING_UNVERIFIED"/.test(ui)
    && /result\.notes\.map/.test(ui));
}

console.log(`\n[2·3세대 횟수 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
