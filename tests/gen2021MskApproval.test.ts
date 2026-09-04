// F-3c — 4세대 도수 계열 보상 승인 구간(<표1> 주))을 반영한다.
//
// 종전 동작: 4세대 엔진은 연 50회·금액 한도만 적용하고, 승인 구간은 상수·분기·고지 어디에도
//   없었다. 과거 10회를 채운 사람의 11회째에도 확정 금액(70,000원)을 아무 안내 없이 제시했다.
//   승인 미확인은 "보상 안 됨"이 아니라 **확인 불가**이므로, 행을 제외하지 않고 묶음을 막는다.
//
// ⚠ 승인 검사 대상은 **이번 묶음에서 연 50회 한도 안에 들어가는 행**뿐이다. 한도를 넘긴 행은
//   이미 연간 한도로 확정 제외라 추가 승인이 필요한 상태가 아니다. 이 경계를 놓치면
//   "한도 초과 제외"라는 확정 결과가 "확인 불가"로 뒤바뀐다.
//
// ⚠ 과거 횟수를 50으로 절삭하지 않는다. 승인 검사용 capacity는 지역 계산이다.
// ⚠ 행 산정은 루프와 같은 정책이다 — 진료비 0원 행도 1회로 센다. 승인 검사에서만
//   양수 행을 세면 같은 청구가 축마다 다른 회차가 된다.
// ⚠ 지급 0원 정책·진료비 0원 정책·5세대는 이번에 바꾸지 않는다.
import { readFileSync } from "node:fs";
import {
  calculateMany2021, GEN2021_MSK_APPROVED_THROUGH_VALUES,
} from "../src/lib/insurance/engine/multiClaim2021";
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

const A = 100_000;
const PAY = 70_000;
const LIMIT = GEN2021.rider.manual_therapy.annualVisits;          // 50
const INITIAL = GEN2021.rider.mskApproval.initialApproved;        // 10
const STEP = GEN2021.rider.mskApproval.step;                      // 10
const eng = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
const rules = readFileSync("src/lib/insurance/engine/regulatoryRules.ts", "utf8");
const ui = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");

type Extra = Partial<Record<string, unknown>>;
const rep = (n: number) => Array.from({ length: n }, () => A);
const msk = (amounts: number[], prior: number, approved?: unknown, extra: Extra = {}) =>
  calculateMany2021({
    cause: "disease", coverage: "non_benefit", visit: "outpatient",
    rider: "manual_therapy", amounts, priorAnnualRiderVisits: prior, priorAnnualRiderPaid: 0,
    ...(approved === undefined ? {} : { approvedThroughVisit: approved }), ...extra,
  } as unknown as Gen2021MultiClaimInput);
const shape = (r: MultiClaimResult) =>
  r.status === "PENDING_UNVERIFIED" ? "차단" : r.lines.map((l) => l.covered ? String(l.insurancePay) : "제외").join("/");
const blockedOk = (r: MultiClaimResult, totalAmount: number) =>
  r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
  && r.totalOwnPay === null && r.totalInsurancePay === null
  && r.appliedCaps.length === 0 && r.totalAmount === totalAmount;

// ── ① 재현했던 결함이 닫혔는가 ────────────────────────────────────────
console.log("\n[재현] 종전에는 승인 없이 11회째 이후에도 금액을 제시했다");
check("prior=0, 15건 → 차단", shape(msk(rep(15), 0)) === "차단");
check(`prior=${INITIAL}, 1건(11회째) → 차단`, shape(msk([A], INITIAL)) === "차단");
check("차단 계약(후보 행·후보 보험금 미노출)", blockedOk(msk(rep(15), 0), A * 15));
check("차단 안내가 최초 구간·단위·한도를 모두 밝힌다",
  msk([A], INITIAL).notes.some((n) =>
    n.includes(`최초 ${INITIAL}회`) && n.includes(`${STEP}회 단위`) && n.includes(`연간 ${LIMIT}회`)));
check("차단 안내가 <표1> 주)를 근거로 인용한다",
  msk([A], INITIAL).notes.some((n) => n.includes("<표1> 주)")));
// ⚠ 판정 한계는 미선택·명시 선택 양쪽 차단 경로에 모두 있어야 한다. 종전에는 미선택
//   경로에 이 문장이 없었고, 테스트는 이름과 달리 다른 문장("승인된 범위의 치료만
//   입력")을 확인해 그 구멍을 잡지 못했다.
const JUDGE_LIMIT = "계산기는 증상의 개선·병변 호전 여부를 판정하지 않습니다.";
check("미선택 차단 안내가 판정 한계를 밝힌다",
  msk([A], INITIAL).notes.includes(JUDGE_LIMIT));
check("명시 선택 차단 안내도 판정 한계를 밝힌다",
  msk(rep(10), 45, 40).notes.includes(JUDGE_LIMIT));
check("두 차단 경로가 다음 행동도 함께 안내한다",
  msk([A], INITIAL).notes.some((n) => n.includes("승인된 범위의 치료만 입력"))
  && msk(rep(10), 45, 40).notes.some((n) => n.includes("승인된 범위의 치료만 입력")));
// ⚠ 미선택은 "승인된 것으로 의제"가 아니라 기본 보장 구간을 **적용**한 것이다.
//   같은 안내 안에서 "승인된 것으로 보았다"와 "보험사가 승인한 회차가 아니다"가 부딪히면
//   안 된다.
check("미선택 차단 안내가 '적용했다'로 쓴다",
  msk([A], INITIAL).notes.some((n) =>
    n.includes(`최초 ${INITIAL}회 기본 보장 구간까지만 적용했습니다`)));
check("미선택 차단 안내가 '승인된 것으로 보았다'로 쓰지 않는다",
  !msk([A], INITIAL).notes.some((n) => /승인된 것으로 (보|봤)/.test(n)));
check("명시 선택 차단에는 기본 구간 설명을 붙이지 않는다",
  !msk(rep(10), 45, 40).notes.some((n) => n.includes("기본 보장 구간")));

// ── ② 사용자 지정 경계 — 승인 검사 대상은 한도 안 행뿐이다 ────────────
console.log("\n[경계] 연 50회 초과와 승인 미확인을 구분한다");
check(`과거 ${INITIAL - 1}회 + 2건, 기본 구간 → 전체 차단`, shape(msk(rep(2), INITIAL - 1)) === "차단");
check(`과거 ${LIMIT - 1}회 + 2건, 승인 ${LIMIT}회 → ${LIMIT}회째 계산·${LIMIT + 1}회째 제외`,
  shape(msk(rep(2), LIMIT - 1, LIMIT)) === `${PAY}/제외`);
check(`과거 ${LIMIT}회 + 1건 → 승인 확인 없이 횟수 한도 제외`,
  shape(msk([A], LIMIT)) === "제외");
check("과거 5000회 + 2건 → 승인 확인 없이 전부 제외",
  shape(msk(rep(2), 5_000)) === "제외/제외");
check("신규 행 없음 → 승인 부족만으로 새 차단을 만들지 않음",
  msk([], 40).status === "OK" && msk([], 40).lines.length === 0);
check("신규 행 없음 + 과거 5000회도 차단하지 않음", msk([], 5_000).status === "OK");

console.log("\n[경계] 승인 회차별 통과 범위");
check(`과거 ${INITIAL - 1}회 + 1건 → ${INITIAL}회째 보상`, shape(msk([A], INITIAL - 1)) === String(PAY));
check(`과거 0회 + ${INITIAL}건 → 전부 보상`, shape(msk(rep(INITIAL), 0)) === rep(INITIAL).map(() => PAY).join("/"));
check(`과거 0회 + ${INITIAL + 1}건, 기본 구간 → 차단`, shape(msk(rep(INITIAL + 1), 0)) === "차단");
check(`과거 0회 + ${INITIAL + 1}건, 승인 ${INITIAL + STEP}회 → 전부 보상`,
  shape(msk(rep(INITIAL + 1), 0, INITIAL + STEP)) === rep(INITIAL + 1).map(() => PAY).join("/"));
check(`과거 45회 + 10건, 승인 ${LIMIT}회 → 5건 보상·5건 제외`,
  shape(msk(rep(10), 45, LIMIT)) === [PAY, PAY, PAY, PAY, PAY, "제외", "제외", "제외", "제외", "제외"].join("/"));
check("과거 45회 + 10건, 승인 40회 → 차단(46회째가 승인 밖)",
  shape(msk(rep(10), 45, 40)) === "차단");
check("차단 안내가 필요 회차와 적용 승인 회차를 함께 밝힌다",
  msk(rep(10), 45, 40).notes.some((n) => n.includes("50회째까지") && n.includes("40회까지")));

// ── ③ 0원 행 산정은 루프와 같은 정책이다 ──────────────────────────────
console.log("\n[0원 행] 승인 검사도 모든 행을 센다 — 두 기준을 어긋나게 두지 않는다");
//   양수 행만 세면 need=10이 되어 통과한다. 모든 행을 세야 need=11로 차단된다.
check("prior=9, [0, 10만] → 차단(양수만 세지 않는다)", shape(msk([0, A], INITIAL - 1)) === "차단");
check("prior=9, [0] → 10회째로 계산", shape(msk([0], INITIAL - 1)) === "0");
check("승인 검사가 amounts.length를 쓴다(양수 필터 금지)",
  /countedThisBatch = Math\.min\(amounts\.length, capacity\)/.test(eng)
  && !/filter\([^)]*normalizeAmount[^)]*> 0\)/.test(eng));

// ── ④ 승인 축의 적용 범위 ─────────────────────────────────────────────
console.log("\n[적용 범위] 주)의 대상은 도수 계열 3종뿐이다");
for (const [label, extra] of [
  ["비급여 주사료", { rider: "injection", priorAnnualRiderVisits: 0 }],
  ["MRI", { rider: "mri" }],
  ["일반 급여", { rider: "none", coverage: "benefit" }],
] as [string, Extra][]) {
  const r = calculateMany2021({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    amounts: [A], ...extra, approvedThroughVisit: INITIAL,
  } as unknown as Gen2021MultiClaimInput);
  check(`${label}에 승인 축이 실리면 차단`, blockedOk(r, A));
  check(`${label} 차단 안내가 자기 사유를 밝힌다`,
    r.notes[0].includes("approvedThroughVisit") && r.notes.some((n) => n.includes("약관상 승인 구간이 없")));
}
check("주사료는 승인 구간의 영향을 받지 않는다(15건 전부 보상)",
  calculateMany2021({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "injection",
    amounts: rep(15), priorAnnualRiderVisits: 0, priorAnnualRiderPaid: 0,
  } as unknown as Gen2021MultiClaimInput).lines.every((l) => l.covered && l.insurancePay === PAY));

// ── ⑤ 허용값 ─────────────────────────────────────────────────────────
console.log("\n[허용값] 10회 단위만 받는다");
check("허용값이 규칙에서 파생된다",
  GEN2021_MSK_APPROVED_THROUGH_VALUES.join(",") === "10,20,30,40,50");
check("허용값 목록이 소스에 다시 나열돼 있지 않다",
  !/\[10, 20, 30, 40, 50\]/.test(eng));
for (const v of [10, 20, 30, 40, 50]) {
  check(`${v} → 유효`, msk([A], 0, v).status === "OK");
}
for (const [what, v] of [
  ["0", 0], ["5", 5], ["15", 15], ["45", 45], ["60", 60], ["10.5", 10.5],
  ['문자열 "10"', "10"], ["null", null], ["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY],
  ["true", true], ["배열", [10]],
] as [string, unknown][]) {
  check(`${what} → 차단`, blockedOk(msk([A], 0, v), A));
}
check("허용값 위반 안내가 10회 단위를 밝힌다",
  msk([A], 0, 15).notes.some((n) => n.includes(`${STEP}회 단위`)));
check("미선택은 차단하지 않는다(기본 보장 구간)", msk([A], 0).status === "OK");

// ── ⑥ 기본값의 의미를 결과가 밝히는가 ────────────────────────────────
console.log("\n[고지] 기본값 10은 '승인된 10회'가 아니라 '기본 보장 구간'이다");
{
  const dflt = msk([A], 0);
  const explicit = msk([A], 0, INITIAL);
  check("도수 결과에 승인 구조 고지가 항상 붙는다",
    dflt.notes.some((n) => n.includes(`최초 ${INITIAL}회`) && n.includes(`${STEP}회 단위`))
    && explicit.notes.some((n) => n.includes(`최초 ${INITIAL}회`)));
  check("미선택이면 기본 보장 구간이라는 설명이 추가된다",
    dflt.notes.some((n) => n.includes("보험사가 승인한 회차가 아니라 기본 보장 구간")));
  check("결과 안내도 '승인된 것으로 보았다'로 쓰지 않는다",
    !dflt.notes.some((n) => /승인된 것으로 (보|봤)/.test(n)));
  // 주석은 이 금지형을 설명하는 자리라 제외하고, 사용자에게 나가는 문자열만 본다.
  const stripComments = (src: string) =>
    src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("사용자에게 나가는 문구에 '승인된 것으로 보았' 표현이 없다",
    !/승인된 것으로 (보|봤)/.test(stripComments(eng))
    && !/승인된 것으로 (보|봤)/.test(stripComments(ui)));
  check("미선택 안내가 다른 보장 조건까지 충족한다는 뜻이 아님을 밝힌다",
    dflt.notes.some((n) => n.includes("다른 보장 조건까지 충족한다는 뜻은 아닙니다")));
  check("명시 선택이면 기본값 설명을 붙이지 않는다",
    !explicit.notes.some((n) => n.includes("입력하지 않아")));
  check("주사료 결과에는 승인 고지가 붙지 않는다",
    !calculateMany2021({
      cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "injection",
      amounts: [A], priorAnnualRiderVisits: 0, priorAnnualRiderPaid: 0,
    } as unknown as Gen2021MultiClaimInput).notes.some((n) => n.includes("승인")));
}

// ── ⑦ 구조 — 경계 규칙을 소스로 고정한다 ─────────────────────────────
console.log("\n[구조] 경계와 무변경 계약");
check("capacity가 한도에서 과거분을 뺀 값이고 음수로 내려가지 않는다",
  /const capacity = Math\.max\(RIDER_CAPS\.manual_therapy\.annualVisits! - visits, 0\);/.test(eng));
check("과거 횟수를 한도로 절삭하지 않는다",
  !/visits = Math\.min\(/.test(eng) && !/priorAnnualRiderVisits[^;]*Math\.min/.test(eng));
check("한도 안 행이 0이면 승인 검사를 건너뛴다",
  /countedThisBatch > 0 && visits \+ countedThisBatch > approved/.test(eng));
check("승인 preflight가 루프보다 앞에 있다",
  eng.indexOf("preflight: 도수 계열 보상 승인 회차") < eng.indexOf("amounts.forEach"));
check("승인 검사는 도수에만 건다",
  /if \(rider === "manual_therapy"\) \{[\s\S]{0,200}const approved =/.test(eng));
check("승인 기본값을 규칙에서 읽는다",
  /\?\? GEN2021\.rider\.mskApproval\.initialApproved/.test(eng));
check("카운터 증가 순서는 그대로다(제외 검사 → += 1 → 지급 산정)",
  /if \(rc\.annualVisits !== null\) visits \+= 1;[\s\S]{0,200}const remaining = Math\.max\(rc\.annualLimit - paid, 0\);/.test(eng));
check("지급 0원 이중 해석을 도입하지 않았다",
  !eng.includes("fingerprint") && !eng.includes("countZeroPay"));
check("5세대 상수를 4세대가 참조하지 않는다",
  !/GEN2026/.test(eng));

// ── ⑧ 규칙 레지스트리 ────────────────────────────────────────────────
console.log("\n[규칙] 4세대 승인 규칙이 자기 근거로 등록됐다");
{
  const R = REGULATORY_RULES;
  check("최초 보장 구간 = 10 (CONFIRMED)",
    R.GEN2021_MSK_INITIAL_APPROVED_VISITS.value === 10
    && R.GEN2021_MSK_INITIAL_APPROVED_VISITS.status === "CONFIRMED"
    && R.GEN2021_MSK_INITIAL_APPROVED_VISITS.generation === "2021");
  check("승인 단위 = 10 (CONFIRMED)",
    R.GEN2021_MSK_APPROVAL_STEP.value === 10
    && R.GEN2021_MSK_APPROVAL_STEP.status === "CONFIRMED");
  check("카운터 단위 = treatment_acts",
    R.GEN2021_MSK_APPROVAL_COUNT_BASIS.value === "treatment_acts");
  for (const r of [R.GEN2021_MSK_INITIAL_APPROVED_VISITS, R.GEN2021_MSK_APPROVAL_STEP,
    R.GEN2021_MSK_APPROVAL_COUNT_BASIS]) {
    check(`${r.ruleId}: 4세대 판본을 출처로 든다`,
      r.sources.every((s) => s.document.includes("2021. 7. 1.")));
    check(`${r.ruleId}: 인쇄 p.252 <표1> 주)를 특정한다`,
      r.sources.some((s) => s.locator.includes("<표1> 주)") && s.locator.includes("p.252")));
    check(`${r.ruleId}: 별표 식별번호가 적혀 있다`,
      r.sources.some((s) => s.locator.includes("2372861")));
    check(`${r.ruleId}: 재현 가능한 판본 URL을 쓴다`,
      r.sources.some((s) => s.url.includes("admRulBylHstInfoR.do") && s.url.includes("bylSeq=2372861")));
  }
  check("기본값의 의미를 note가 구분한다",
    R.GEN2021_MSK_INITIAL_APPROVED_VISITS.note!.includes("보험사가 10회를 승인했다")
    && R.GEN2021_MSK_INITIAL_APPROVED_VISITS.note!.includes("기본 보장 구간"));
  check("연 50회 한도와 다른 규칙임을 note가 밝힌다",
    R.GEN2021_MSK_APPROVAL_COUNT_BASIS.note!.includes("연 50회 한도"));
  check("5세대 규칙에서 값을 가져오지 않았음을 소스가 밝힌다",
    /4세대 원문 주\)를 직접 읽어/.test(rules));
  check("발령일과 시행일이 같음을 확인한 기록이 있다",
    /연혁 목록 39번/.test(rules) && /시행 2021\. 7\. 1\./.test(rules));
  check("5세대 승인 규칙은 그대로다",
    R.GEN2026_MSK_INITIAL_APPROVED_VISITS.value === 10
    && R.GEN2026_MSK_APPROVAL_STEP.value === 10
    && R.GEN2026_MSK_APPROVAL_PRIOR_ACT_COUNT.status === "HOLD"
    && R.GEN2026_SPECIAL_ITEM_COUNT_ON_ZERO_PAY.status === "HOLD");
}

// ── ⑨ UI ─────────────────────────────────────────────────────────────
console.log("\n[UI] 도수에만 승인 select가 열리고 숨은 값은 전달되지 않는다");
{
  const names = stateNamesFrom(readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8"));
  const setup = (state: Record<string, unknown> = {}) => {
    const h = mount(HealthCalcMulti2021 as unknown as () => unknown, names);
    for (const [k, v] of Object.entries(state)) h.set(k, v);
    return h.render();
  };
  const APPROVAL_LABEL = "보상 승인 회차";
  check("도수 선택 시 승인 select가 보인다", setup({ rider: "manual_therapy" }).has(APPROVAL_LABEL));
  for (const r of ["injection", "mri", "none"]) {
    check(`${r}에는 승인 select가 없다`, !setup({ rider: r }).has(APPROVAL_LABEL));
  }
  check("주사료로 바꿔도 잔존 승인값이 결과를 막지 않는다",
    setup({
      submitted: true, rider: "injection", priorInjectionVisits: "0",
      approvedThrough: 10, priorPaid: "0",
    }).resultItems() !== null);
  check("도수 미선택 상태에서 10회 이하는 정상 계산",
    setup({
      submitted: true, rider: "manual_therapy", priorManualVisits: "0",
      approvedThrough: "", priorPaid: "0", amounts: ["300000", "300000"],
    }).resultItems() !== null);
  check("도수 미선택 상태에서 11회째를 넘기면 결과 대신 안내",
    setup({
      submitted: true, rider: "manual_therapy", priorManualVisits: String(INITIAL),
      approvedThrough: "", priorPaid: "0", amounts: ["300000"],
    }).resultItems() === null);
  check("UI가 미선택을 undefined로 넘긴다(10을 만들어 보내지 않는다)",
    /approvedThroughVisit: approvedThrough === "" \? undefined : approvedThrough/.test(ui));
  check("UI가 허용값을 엔진에서 읽는다",
    /GEN2021_MSK_APPROVED_THROUGH_VALUES\.map/.test(ui)
    && !/\[10, 20, 30, 40, 50\]/.test(ui));
  check("UI가 기본 구간의 의미를 밝힌다",
    ui.includes("기본 보장 구간") && ui.includes("다른 보장 조건까지 충족한다는 뜻은 아닙니다"));
  check("UI가 최초 구간·단위를 상수에서 읽는다",
    /GEN2021\.rider\.mskApproval\.initialApproved/.test(ui)
    && /GEN2021\.rider\.mskApproval\.step/.test(ui));
  check("차단 결과를 ResultCard로 그리지 않는다",
    /result\.status === "PENDING_UNVERIFIED"/.test(ui)
    && /result\.status === "OK" && result\.totalAmount > 0/.test(ui));
  check("도수·주사가 각각 satisfies로 초과 필드를 막는다",
    /\} satisfies Gen2021MultiRiderManualInput\)/.test(ui)
    && /\} satisfies Gen2021MultiRiderInjectionInput\)/.test(ui));
}

console.log(`\n[4세대 도수 승인 구간] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
