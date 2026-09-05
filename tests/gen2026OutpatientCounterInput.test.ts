// 안전성 커밋 — 5세대 통원 카운터 입력의 엄격 검증.
//
// ⚠ 이것은 **새 규제 숫자가 아니라 입력 검증 강화**다. 연 100회·100일 한도와
//   지급 0원 HOLD는 그대로다. 바뀌는 것은 "잘못된 입력을 어떻게 다루는가"뿐이다.
//
// 종전 동작(nonNegInt): 음수→0, 소수→내림, NaN·Infinity→0, **문자열 "99"→0**, 미입력→0.
//   어느 쪽이든 "이미 썼다"가 "안 썼다"로 바뀌는 방향이라 보험금이 과다 산출된다.
//
// ⚠ 회(특약1 제3조·제5조④ '보상한 횟수')와 일(특약2 제3조·제5조④ '보상한 일수')은
//   **형식 규칙만** 공유한다. 상수·카운터·안내 문구·도메인 필드는 계속 분리한다.
import { readFileSync } from "node:fs";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { Gen2026ItemClaimInput, Gen2026MultiClaimInput, MultiClaimResult } from "../src/lib/insurance/engine/types";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const A = 500_000;          // 중증 통원: 30% = 15만 vs 최소공제 3만 → 자기부담 15만, 지급 35만
const PAY = 350_000;
const ZERO = 20_000;        // 공제(3만) 이상이라 지급 0원이 되는 행
const CAP = "GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS";
const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
const router = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");

type Extra = Partial<Record<string, unknown>>;
/** 직접 경로 — 중증 일반 비급여 통원. OMIT은 키 자체를 넣지 않는다(미입력). */
const direct = (amounts: number[], visits: unknown, extra: Extra = {}) =>
  calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    severity: "critical", nonBenefitItem: "general", amounts,
    ...(visits === "OMIT" ? {} : { priorAnnualOutpatientVisits: visits }), ...extra,
  } as unknown as Gen2026MultiClaimInput);
/** 일반 전환 경로 — 중증 예외 주사료(항암제). */
const inj = (amounts: number[], visits: unknown, extra: Extra = {}) =>
  calculateGen2026Item({
    route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "anticancer", cause: "disease", visit: "outpatient", tier: "clinic", amounts,
    ...(visits === "OMIT" ? {} : { priorAnnualOutpatientVisits: visits }), ...extra,
  } as unknown as Gen2026ItemClaimInput) as MultiClaimResult;
const PATHS = [["직접", direct], ["예외 주사 전환", inj]] as const;

const paid = (r: MultiClaimResult) => r.lines.map((l) => l.insurancePay).join();
/** 차단 계약 — 후보 보험금·후보 행을 노출하지 않고 진료비 합계만 유지한다. */
const blockedOk = (r: MultiClaimResult, totalAmount: number) =>
  r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
  && r.totalOwnPay === null && r.totalInsurancePay === null
  && r.appliedCaps.length === 0 && r.totalAmount === totalAmount;

// ── 이번 변경이 규제 숫자를 만들지 않았는지 ───────────────────────────
console.log("\n[근거] 새 규제 숫자를 만들지 않는다");
{
  const rules = REGULATORY_RULES as unknown as Record<string, { ruleId: string; value: unknown; status: string }>;
  const byId = Object.fromEntries(Object.values(rules).map((r) => [r.ruleId, r]));
  check("연 100회 한도는 CONFIRMED 그대로",
    byId["GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS"]?.status === "CONFIRMED"
    && byId["GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS"]?.value === 100);
  check("연 100일 한도는 CONFIRMED 그대로",
    byId["GEN2026-NONCRITICAL-OUTPATIENT-ANNUAL-DAYS"]?.status === "CONFIRMED"
    && byId["GEN2026-NONCRITICAL-OUTPATIENT-ANNUAL-DAYS"]?.value === 100);
  check("지급 0원 HOLD 2건은 그대로 HOLD",
    byId["GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY"]?.status === "HOLD"
    && byId["GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY"]?.value === null
    && byId["GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY"]?.status === "HOLD");
  check("입력 검증용 새 규칙을 만들지 않았다",
    !Object.keys(byId).some((id) => /INPUT|VALIDATION|PARSER/i.test(id)));
  check("한도는 여전히 상수에서 읽는다",
    /outpatientVisits >= GEN2026\.nonBenefit\.critical\.outpatientAnnualVisits/.test(eng)
    && GEN2026.nonBenefit.critical.outpatientAnnualVisits === 100);
}

// ── 입력 계약: 두 경로가 **각각** 같은 결론을 낸다 ────────────────────
console.log("\n[계약] 유효·무효 입력");
for (const [label, run] of PATHS) {
  check(`${label}: 미입력(키 없음) → 차단`, blockedOk(run([A], "OMIT"), A));
  check(`${label}: undefined → 차단`, blockedOk(run([A], undefined), A));
  check(`${label}: 미입력 안내가 무엇을 넣어야 하는지 알려준다`,
    run([A], "OMIT").notes.some((n) => n.includes("이미 사용한 통원 횟수") && n.includes("0을 넣어 주세요")));
  check(`${label}: 미입력 안내는 '회' 단위`,
    run([A], "OMIT").notes.some((n) => n.includes("통원 100회") && !n.includes("100일")));
  check(`${label}: 명시적 0 → 정상`, paid(run([A], 0)) === String(PAY));
  check(`${label}: 98 → 정상`, paid(run([A], 98)) === String(PAY));
  check(`${label}: 99 → 다음 1건이 100회째라 보상`, paid(run([A], 99)) === String(PAY));
  check(`${label}: 99 + 2건 → 둘째만 제외`, paid(run([A, A], 99)) === [PAY, 0].join());
  check(`${label}: 100 → 제외`, paid(run([A], 100)) === "0");
  check(`${label}: 101 → 제외`, paid(run([A], 101)) === "0");
  check(`${label}: 5000 → 절삭하지 않고 제외`, paid(run([A], 5_000)) === "0");
  check(`${label}: 100 초과도 유효한 과거 상태(차단이 아니다)`, run([A], 5_000).status === "OK");
  check(`${label}: 제외 행에 중증 CapCode`, run([A], 100).appliedCaps.includes(CAP));
  for (const [what, v] of [["-1", -1], ["-0.1", -0.1], ["1.5", 1.5], ["99.9", 99.9],
    ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
    ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ['문자열 "99"', "99"], ['문자열 "abc"', "abc"],
    ["객체", {}], ["null", null], ["true", true]] as const) {
    check(`${label}: ${what} → 차단`, blockedOk(run([A], v), A), JSON.stringify(run([A], v).status));
  }
  check(`${label}: MAX_SAFE_INTEGER는 유효값`, run([A], Number.MAX_SAFE_INTEGER).status === "OK");
  // 변형 금지 — 잘못된 값이 "다른 유효값"으로 바뀌어 계산되지 않는다.
  check(`${label}: -1을 0으로 바꾸지 않는다`, paid(run([A], -1)) !== String(PAY));
  check(`${label}: 99.9를 99로 내리지 않는다`, paid(run([A], 99.9)) !== String(PAY));
  check(`${label}: 문자열 "99"를 0으로 바꾸지 않는다`, run([A], "99").status !== "OK");
  // 반대 축·입원
  check(`${label}: 반대 축 동시 입력은 값 0이어도 차단`,
    run([A], 0, { priorAnnualOutpatientDays: 0 }).status === "PENDING_UNVERIFIED");
  check(`${label}: 입원에 횟수가 실리면 차단`,
    run([A], 100, { visit: "inpatient", tier: "clinic" }).status === "PENDING_UNVERIFIED");
  check(`${label}: 입원 차단 안내가 사유를 밝힌다`,
    run([A], 100, { visit: "inpatient", tier: "clinic" }).notes
      .some((n) => n.includes("입원 계산에 쓰이지 않습니다")));
  // 지급 0원 이중 해석 차단이 그대로 살아 있다
  check(`${label}: 99 + [지급0원, 정상] → 여전히 전체 차단`,
    blockedOk(run([ZERO, A], 99), ZERO + A));
  check(`${label}: 99 + [진료비 0원, 정상] → 정상`, paid(run([0, A], 99)) === [0, PAY].join());
  check(`${label}: 0회 + [지급0원, 정상] → 정상`, paid(run([ZERO, A], 0)) === [0, PAY].join());
  // 결과 키 집합
  check(`${label}: 정상 결과의 행 키 집합 유지`,
    Object.keys(run([A], 0).lines[0]).sort().join(",")
    === "amount,appliedCaps,covered,deductibleApplied,generation,index,insurancePay,minDeductible,notes,ownPay,rateApplied,rateBased,status");
}

// ── 무관한 경로 ──────────────────────────────────────────────────────
console.log("\n[범위] 이 축이 쓰이지 않는 경로");
{
  const stray = (o: Record<string, unknown>) =>
    calculateMany2026({ cause: "disease", amounts: [A], ...o } as unknown as Gen2026MultiClaimInput);
  for (const field of ["priorAnnualOutpatientVisits", "priorAnnualOutpatientDays"] as const) {
    const ben = stray({ coverage: "benefit", visit: "outpatient", tier: "clinic",
      nhisCoinsuranceRate: 0.2, [field]: 0 });
    check(`급여 통원에 ${field}가 실리면 값 0이어도 차단`, blockedOk(ben, A), ben.status);
    check(`급여 차단 안내가 비급여 전용임을 밝힌다`,
      ben.notes.some((n) => n.includes("비급여 통원 전용")));
    const inp = stray({ coverage: "non_benefit", visit: "inpatient", tier: "clinic",
      severity: "critical", nonBenefitItem: "general", [field]: 0 });
    check(`중증 입원에 ${field}가 실리면 값 0이어도 차단`, blockedOk(inp, A), inp.status);
  }
  check("급여 통원 자체는 종전대로 계산된다",
    stray({ coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2 })
      .totalInsurancePay === 400_000);
  check("중증 입원 자체는 종전대로 계산된다",
    stray({ coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "critical",
      nonBenefitItem: "general" }).status === "OK");
  // 별도 보장종목·상급병실료는 종전 계약 그대로다.
  for (const item of ["musculoskeletal_esw", "mri"] as const) {
    check(`별도 보장종목 ${item}은 종전대로 카운터를 거부`,
      (calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical",
        item, lines: [{ amount: A, visit: "outpatient" }], priorAnnualOutpatientVisits: 0,
        ...(item === "musculoskeletal_esw" ? { priorAnnualTreatmentActCount: 0 } : {}),
      } as unknown as Gen2026ItemClaimInput) as MultiClaimResult).status === "PENDING_UNVERIFIED");
  }
  check("상급병실료는 종전대로 카운터를 거부",
    (calculateGen2026Item({ route: "room_charge", coverage: "non_benefit", cause: "disease",
      severity: "critical", stays: [{ roomChargeTotal: 1_800_000, inpatientDays: 10 }],
      priorAnnualOutpatientVisits: 0 } as unknown as Gen2026ItemClaimInput) as MultiClaimResult)
      .status === "PENDING_UNVERIFIED");
}

// ── 2·3·4세대는 건드리지 않았다 ───────────────────────────────────────
console.log("\n[범위] 2·3·4세대의 기존 정책 무변경");
{
  const std = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  const g4 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  // ⚠ 2·3세대는 F-2 안전성 커밋에서 이 파일과 **독립적으로** 엄격 검증으로 바뀌었다.
  //   그 계약은 tests/gen2009OutpatientCounterInput.test.ts가 맡는다. 여기서는
  //   5세대 코드가 2·3세대에 섞여 들어가지 않았는지만 본다(세대별 파서·상수 분리).
  check("2·3세대는 5세대 파서를 재사용하지 않는다",
    !std.includes("badOutpatientDays") && !std.includes("ZERO_PAY_") && !std.includes("GEN2026")
    && /const badCount = /.test(std));
  // ⚠ 4세대는 F-1 안전성 커밋에서 이 파일과 **독립적으로** 엄격 검증으로 바뀌었다.
  //   그 계약은 tests/gen2021OutpatientCounterInput.test.ts가 맡는다. 여기서는
  //   5세대 코드가 4세대에 섞여 들어가지 않았는지만 본다(세대별 파서·상수 분리).
  check("4세대는 5세대 파서를 재사용하지 않는다",
    !g4.includes("badOutpatientDays") && !g4.includes("ZERO_PAY_")
    && /const badCount = /.test(g4));
  check("2·3세대 UI가 5세대 도메인 파서를 재사용하지 않는다", (() => {
    const stdUi = readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8");
    return /const stdCount = /.test(stdUi)
      && !stdUi.includes("outpatientDays") && !stdUi.includes("nonNegSafeInt")
      && !stdUi.includes("gen2021Count");
  })());
  check("4세대 UI가 5세대 도메인 파서를 재사용하지 않는다", (() => {
    const ui = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
    return /const gen2021Count = /.test(ui)
      && !ui.includes("outpatientDays") && !ui.includes("nonNegSafeInt");
  })());
}

// ── 타입 ─────────────────────────────────────────────────────────────
console.log("\n[타입] 회·일 축 분리와 급여 차단");
{
  const iface = (name: string) => {
    const m = new RegExp(`interface ${name} extends [^{]*\\{([\\s\\S]*?)\\n\\}`).exec(types);
    return m === null ? null : m[1];
  };
  const ben = iface("Gen2026MultiBenefitInput");
  check("급여 묶음 타입이 두 카운터를 never로 닫는다",
    ben !== null && ben.includes("priorAnnualOutpatientVisits?: never;")
    && ben.includes("priorAnnualOutpatientDays?: never;"));
  const nb = iface("Gen2026MultiNonBenefitInput");
  check("비급여 묶음 타입은 두 축을 number로 연다",
    nb !== null && nb.includes("priorAnnualOutpatientVisits?: number;")
    && nb.includes("priorAnnualOutpatientDays?: number;"));
  const ex = iface("Gen2026CriticalExceptionalInjectionInput");
  check("예외 주사 타입은 회만 열고 일은 닫는다",
    ex !== null && ex.includes("priorAnnualOutpatientVisits?: number;")
    && ex.includes("priorAnnualOutpatientDays?: never;"));
  check("타입 주석이 미입력≠0을 명시",
    types.includes("미입력(undefined)과 확인 결과 0은 다른 상태다"));
  // ── 주석이 계약과 반대로 남지 않게 한다 ──────────────────────────
  //   ⚠ 종전 정책("미입력은 0일로 본다")이 되살아나면 실패한다. 금지형 검사다.
  //     타입은 계약 설명이라, 코드가 맞아도 여기만 반대면 읽는 사람이 잘못 쓴다.
  check("타입에 '미입력은 0으로 본다'류 설명이 남아 있지 않다",
    !/미입력은\s*0(일|회|으로)?\s*로?\s*본다/.test(types)
    && !/미입력[^\n]{0,20}0(일|회)로 (본다|간주)/.test(types));
  //   두 축이 **같은 입력 계약**을 각각 자기 단위로 설명하는지 본다.
  //   한쪽만 고치면 실패한다 — 이번 결함이 정확히 그 형태였다.
  {
    //   ⚠ 인터페이스 본문을 먼저 자른다. 파일 전체에서 찾으면 앞선 주석 블록까지 삼켜
    //     엉뚱한 텍스트를 검사하게 되고, 같은 이름의 필드가 다른 인터페이스에도 있다.
    const nbBody = /interface Gen2026MultiNonBenefitInput extends [^{]*\{([\s\S]*?)\n\}/
      .exec(types)?.[1] ?? "";
    const doc = (field: string) => {
      const lines = nbBody.split("\n");
      const at = lines.findIndex((l) => l.trim().startsWith(`${field}?: number;`));
      if (at < 0) return null;
      const block: string[] = [];
      for (let i = at - 1; i >= 0 && lines[i].trim() !== "/**"; i--) {
        if (!lines[i].trim().startsWith("*")) return null; // 주석 블록이 아니다
        block.unshift(lines[i]);
      }
      return block.join("\n");
    };
    const vDoc = doc("priorAnnualOutpatientVisits");
    const dDoc = doc("priorAnnualOutpatientDays");
    check("두 축의 주석 블록을 찾음", vDoc !== null && dDoc !== null);
    const CLAUSES = [
      "미입력(undefined)과 확인 결과 0은 다른 상태다",
      "0으로 추정하지 않고 차단한다",
      "음수·소수·NaN·Infinity·안전 정수 초과·문자열",
      "정규화하지 않고 차단한다",
      "100을 넘는 값은 유효한 과거 상태이므로 절삭하지 않는다",
    ];
    for (const c of CLAUSES) {
      check(`두 축 주석이 같은 계약을 설명: ${c.slice(0, 22)}…`,
        vDoc !== null && dDoc !== null && vDoc.includes(c) && dDoc.includes(c));
    }
    //   설명은 같아도 **단위·근거 조문은 각자의 것**이어야 한다. 문구를 합치지 않는다.
    check("중증 주석은 '회'와 특약1을 쓴다",
      vDoc !== null && vDoc.includes("100**회**") && vDoc.includes("특약1")
      && !vDoc.includes("100**일**") && !vDoc.includes("특약2"));
    check("비중증 주석은 '일'과 특약2를 쓴다",
      dDoc !== null && dDoc.includes("100**일**") && dDoc.includes("특약2")
      && !dDoc.includes("100**회**") && !dDoc.includes("특약1"));
  }
}

// ── 구조: 검증을 우회하는 두 번째 진입점을 만들지 않는다 ──────────────
console.log("\n[구조] 검증 위치");
{
  check("엔진이 형식 검증을 한 함수로 모았다", /const badCount = \(v: unknown\): boolean =>/.test(eng));
  check("badCount가 안전 정수와 0 이상을 모두 본다",
    /typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0/.test(eng));
  check("중증 통원에서 미입력을 차단한다",
    /if \(nb\.visit === "outpatient" && severity === "critical"\) \{\s*\n\s*if \(visits === undefined\)/.test(eng));
  check("비중증 통원에서도 미입력을 차단한다",
    /if \(nb\.visit === "outpatient" && severity === "non_critical"\) \{\s*\n\s*if \(days === undefined\)/.test(eng));
  check("카운터를 더 이상 정규화하지 않는다",
    !/nonNegInt\(nb\?\.priorAnnualOutpatientVisits\)/.test(eng)
    && !/badOutpatientDays/.test(eng));
  check("입원 가드가 두 카운터를 모두 본다",
    /nb\.visit === "inpatient" && \(visits !== undefined \|\| days !== undefined\)/.test(eng));
  check("급여 가드가 두 카운터를 모두 본다",
    /if \(bf\) \{[\s\S]{0,400}strayVisits !== undefined \|\| strayDays !== undefined/.test(eng));
  check("라우터는 값 검증을 중복하지 않고 엔진에 위임한다",
    !/Number\.isSafeInteger\(days\)/.test(router) && !/Number\.isSafeInteger\(visits\)/.test(router));
  check("라우터는 축 교차·입원 가드를 유지한다",
    /raw\.severity === "critical" && days !== undefined/.test(router)
    && /raw\.visit === "inpatient" && \(days !== undefined \|\| visits !== undefined\)/.test(router));
  check("라우터가 중증에만 '회' 축을 전달",
    /input\.severity === "critical"\s*\n?\s*\? \{ priorAnnualOutpatientVisits: input\.priorAnnualOutpatientVisits \}/.test(router));
  // ⚠ **낡은 계약을 교체했다.** 이 검사는 "카운터만 엄격해지고 금액 축은 nonNegInt의 관용을
  //   그대로 쓴다"를 기존 지급보험금 축으로 확인하고 있었다. G-20이 그 축을 badCount 검증으로
  //   옮겼으므로, 확인 대상을 아직 관용을 쓰는 `priorAnnualDeductible`로 옮긴다.
  //   요지(카운터와 다른 축의 계약이 다르다)는 같다.
  check("nonNegInt는 누적 공제금액 축용으로 남아 있다", /nonNegInt\(nb\?\.priorAnnualDeductible\)/.test(eng));
  check("기존 지급보험금 축은 카운터와 같은 형식 검증(badCount)으로 옮겨졌다",
    /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{/.test(eng));
}

// ── UI 상태 전이 ─────────────────────────────────────────────────────
console.log("\n[화면] 상태 전이");
{
  const names = stateNamesFrom(ui);
  const VISITS_LABEL = "계약해당일 기준 1년간 이미 사용한 통원 횟수";
  const DAYS_LABEL = "계약해당일 기준 1년간 이미 사용한 통원일수";
  const setup = (over: Record<string, unknown> = {}) => {
    const h = mount(HealthCalcMulti2026 as unknown as () => unknown, names);
    const base: Record<string, unknown> = {
      coverage: "non_benefit", nonBenefitItem: "general", severity: "critical",
      visit: "outpatient", cause: "disease", amounts: ["500000"],
    };
    for (const [k, v] of Object.entries({ ...base, ...over })) h.set(k, v);
    return h.render();
  };
  const warned = (s: ReturnType<typeof setup>) =>
    s.nodes.some((n) => n.tag === "#NoticeBox" && n.props.variant === "warning"
      && n.text.includes("이미 사용한 통원 횟수"));

  const fresh = setup();
  check("① 새 화면의 횟수 입력이 빈 값", fresh.has(VISITS_LABEL)
    && fresh.nodes.some((n) => n.tag === "input" && n.props.value === ""));
  check("② 계산 전에는 결과도 경고도 없다", fresh.resultItems() === null && !warned(fresh));
  const empty = setup({ submitted: true });
  check("③ 빈 값으로 계산하면 안내만 나오고 결과가 없다",
    warned(empty) && empty.resultItems() === null);
  check("③ 안내가 0 입력 방법을 알려준다",
    empty.nodes.some((n) => n.tag === "#NoticeBox" && n.text.includes("이전 통원이 없으면")));
  // ⚠ 게이트가 없으면 엔진을 호출하게 되고, 엔진의 차단 안내가 화면에 그대로 새어 나온다
  //   (경고 상자가 둘이 되고 내부 필드명이 노출된다). 게이트가 실제로 계산을 막는지 본다.
  const warnBoxes = (s: ReturnType<typeof setup>) =>
    s.nodes.filter((n) => n.tag === "#NoticeBox" && n.props.variant === "warning").length;
  check("③ 빈 값이면 계산 자체를 하지 않는다(엔진 안내가 새지 않음)",
    warnBoxes(empty) === 1
    && !empty.nodes.some((n) => (n.text ?? "").includes("priorAnnualOutpatientVisits")));
  const zero = setup({ submitted: true, priorVisits: "0" });
  check("④ 0을 입력하면 정상 계산", zero.resultItems() !== null && !warned(zero));
  const at99 = setup({ submitted: true, priorVisits: "99" });
  const at100 = setup({ submitted: true, priorVisits: "100" });
  check("⑤ 99 → 보상", at99.resultItems()?.[2]?.value === "350,000원");
  check("⑤ 100 → 미보상", at100.resultItems()?.[2]?.value === "0원");
  for (const bad of ["", "  ", "-1", "1.5", "abc", "1e2", "+1", "9007199254740993"]) {
    const s = setup({ submitted: true, priorVisits: bad });
    check(`⑥ 잘못된 값 ${JSON.stringify(bad)} → 계산 차단`, warned(s) && s.resultItems() === null);
  }
  check("⑦ UI가 잘못된 값을 변형하지 않는다(공용 num을 쓰지 않는다)",
    !/num\(priorVisits\)/.test(ui));
  // 예외 주사 전환 화면
  const injBase = { submitted: true, nonBenefitItem: "injection", injectionPurpose: "anticancer" };
  check("⑧ 예외 주사 전환: 횟수 입력 노출", setup(injBase).has(VISITS_LABEL));
  check("⑧ 예외 주사 전환: 빈 값이면 계산하지 않음", setup(injBase).resultItems() === null);
  check("⑧ 예외 주사 전환: 빈 값에서 엔진 안내가 새지 않음",
    warnBoxes(setup(injBase)) === 1
    && !setup(injBase).nodes.some((n) => (n.text ?? "").includes("priorAnnualOutpatientVisits")));
  check("⑧ 예외 주사 전환: 0을 넣으면 계산",
    setup({ ...injBase, priorVisits: "0" }).resultItems() !== null);
  check("⑧ 예외 주사 전환: 음수는 차단",
    setup({ ...injBase, priorVisits: "-1" }).resultItems() === null);
  // 비중증 전환 — 횟수를 숨기고 숨겨진 값도 넘기지 않는다
  const nc = setup({ submitted: true, severity: "non_critical", priorVisits: "50", priorOutDays: "3" });
  check("⑨ 비중증 전환: 횟수 입력 숨김·일수 입력 노출", !nc.has(VISITS_LABEL) && nc.has(DAYS_LABEL));
  check("⑨ 비중증 전환: 숨겨진 횟수를 넘기지 않아 계산됨", nc.resultItems() !== null);
  const back = setup({ submitted: true, severity: "critical", priorOutDays: "3", priorVisits: "0" });
  check("⑩ 중증으로 돌아오면 숨겨진 일수를 넘기지 않아 계산됨", back.resultItems() !== null);
  const backEmpty = setup({ submitted: true, severity: "critical", priorOutDays: "3" });
  check("⑩ 중증 복귀 시 일수 잔존값을 횟수로 쓰지 않는다", backEmpty.resultItems() === null);
  // ⚠ 통원에서 입원으로 바꾸면 횟수 입력은 숨겨지지만 상태값은 남는다. 그 값이 입원 계산에
  //   실려 가면 엔진의 입원 가드에 걸려 계산이 막힌다 — 계산이 되면 넘어가지 않은 것이다.
  const inpAfter = setup({ submitted: true, visit: "inpatient", nbInpatientTier: "clinic", priorVisits: "99" });
  check("⑩ 입원 전환 시 남은 횟수를 넘기지 않아 계산됨",
    !inpAfter.has(VISITS_LABEL) && inpAfter.resultItems() !== null);
  const injInp = setup({ submitted: true, nonBenefitItem: "injection", injectionPurpose: "anticancer",
    visit: "inpatient", nbInpatientTier: "clinic", priorVisits: "99" });
  check("⑩ 예외 주사 입원 전환에서도 남은 횟수를 넘기지 않아 계산됨",
    !injInp.has(VISITS_LABEL) && injInp.resultItems() !== null);
  // 노출하지 않는 화면
  for (const [what, over] of [
    ["입원", { visit: "inpatient", nbInpatientTier: "clinic" }],
    ["급여", { coverage: "benefit" }],
    ["MRI", { nonBenefitItem: "mri" }],
    ["3대비급여 주사", { nonBenefitItem: "injection", injectionPurpose: "general" }],
    ["상급병실료", { nonBenefitItem: "room_charge" }]] as const) {
    check(`⑪ ${what} 화면에는 횟수 입력이 없다`, !setup(over).has(VISITS_LABEL));
  }
  check("⑫ 라벨이 약관 표현과 단위를 밝힌다",
    /계약해당일 기준 1년간 이미 사용한 통원 횟수/.test(ui)
    && /1년간 통원 \{GEN2026\.nonBenefit\.critical\.outpatientAnnualVisits\}회/.test(ui));
  check("⑫ 라벨에 '(선택)'이 남아 있지 않다", !/이미 사용한 통원 횟수 \(선택\)/.test(ui));
}

console.log(`\n[통원 카운터 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
