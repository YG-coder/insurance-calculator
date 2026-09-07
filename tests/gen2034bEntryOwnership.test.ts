// G-34B — 묶음·항목·상급병실료 진입점의 **교차 입력 소유권**과 확정 stray 봉인.
//   G-34A가 제네릭 라우터를 닫았다. 여기서는 나머지 다섯 공개 진입점을 같은 방법으로 닫는다.
//
// 모집단 (기준선 `0914d7d`): **32경로군 × 35축 = 1,120자리**.
//   경로군은 진입점이 아니라 **판별 유니온 멤버와 소유권을 가르는 축**까지 내려가 나눴다
//   (세대·행 구성·coverage·visit·severity·item·route·rider).
//     calculateMany 8 · calculateMany2021 7 · calculateMany2026 6 ·
//     calculateGen2026Item 9(별도 4 + 일반복귀 3 + 상급병실료 2) · calculateRoomCharge2026 2
//   ⚠ `Gen2026ItemClaimInput`은 `Gen2026RoomChargeInput`도 포함한다 — 같은 진입점이
//     `route: "room_charge"`를 받아 위임한다. 진입점 단위로 세면 그 2경로군이 통째로 빠진다.
//
// 판정은 세 열을 **따로** 본다. 접근자 0회만으로 결함을 확정하지 않고, 결과 동일성만으로
// 미소비를 단정하지도 않는다.
//   reads      그 경로가 이름을 읽는가
//   calcDelta  status가 OK인 채로 결과가 달라지는가 = **산식·분기에서 실제 소비**
//   rejDelta   status가 OK를 벗어나는가 = 그 진입점의 **값 검증**이 반응한 것(소비가 아니다)
// ⚠ 기준선 금액 하나에 기대지 않는다. 금액 배율 3벌(×1·×0.1·×10)에서 한 번이라도 계산이
//   달라지면 소비다. 작으면 상한이 구속되지 않아 누적 축의 소비가 안 보이고, 너무 크면 항목
//   한도가 먼저 구속돼 공제 축의 소비가 안 보인다(중증 MRI에서 실제로 일어났다).
//
// 6분류 결과 — 합계가 모집단과 같다:
//   1 산식·분기에서 실제 소비 210 / 2 결과 차등 없으나 의미상 허용 19 /
//   3 근거 있는 공통 통로 0 / 4 선행 차단 미도달 0 / 5 확정 stray 889 / 6 판단 보류 2
//   cat5 889 = 이미 봉인 253 + **이번에 봉인 636**(미봉인 633 + 부분 봉인 3)
// ⚠ 승인 범위(구현 대상 637)와 1자리 다르다. 승인된 분류(cat1 214 · cat5 885)에서 최종
//   (cat1 210 · cat5 889)까지 **이동한 셀은 6개**다. 소유권 분류와 봉인 상태는 다른 축이라,
//   가드를 새로 넣었다고 기준선의 소비 여부가 바뀌지는 않는다.
//   · cat1 → cat5 5자리 — 4세대 특약 도수·주사료·MRI와 5세대 급여 통원·입원의
//     `priorAnnualInsurancePaid`. 승인 시점 **탐침 오류**였다: 보조 축
//     `annualCoverageLimit: 1,000,000`을 무조건 얹었는데 이 다섯 경로가 그 보조 축 자체를
//     거부해 기준선이 PENDING_UNVERIFIED가 됐고, 측정기가 "미지정이면 계산 불가 = 필수 축"
//     으로 기록했다. 기준선이 OK일 때만 얹는 가드로 다시 재면 정상 리터럴 3개(0 · 1,000,000 ·
//     49,000,000)를 **전부 거부**한다 — 기준선에서 **이미 봉인된** stray다(구현 대상 불변).
//   · cat5 → cat1 1자리 — 중증 MRI `priorAnnualInpatientDeductible`. 기준 금액 3,000만원
//     에서는 항목 한도 300만원이 먼저 구속돼 안 보였고, **×0.1 배율**에서 정상 리터럴
//     4,900,000이 자기부담 900,000 → 100,000으로 바꿨다. 구현에서 뺐다 → 637 − 1 = 636.
// ⚠ 분류표와 구현을 1,120자리 전부 대조했다 — 봉인해야 할 889(cat5) 전부 막혔고(누락 0),
//   통과해야 할 231(cat1·2·6)은 **기준선 대비** 새로 막힌 자리가 없다(과잉 0). cat5 889 중
//   253은 기준선에서 이미 막혀 있었고 이번 구현이 막은 자리가 636이다.
//   ⚠ 과잉의 기준은 "지금 막히는가"가 아니라 "기준선에서 통과하던 것이 새로 막히는가"다.
//   ⚠ 대조의 기준 입력은 **승인된 화면 입력 구성**을 따른다 — tier를 더는 싣지 않는 일곱
//     경로군에 tier를 남겨 두면 승인된 tier 봉인이 coverage의 과잉으로 잘못 잡힌다.
//
// ⚠ **판단 보류 2자리**(5세대 다회 비급여 통원의 `tier`)는 막지 않았다. 단건 `calc2026`의
//   같은 축이 G-34A에서 보류로 남아 G-34C에서 확정되므로, 다회만 먼저 좁히면 5세대 계약이
//   갈린다. 보류는 허용이 아니다 — 지금 막지 않을 뿐이다.
// ⚠ 화면이 값을 싣는다는 사실은 **허용 근거가 아니다.** 4세대 다회 6자리와 5세대 다회 급여
//   입원 1자리는 화면의 공통 객체를 분리해 **함께** 닫았다.
import { readFileSync } from "node:fs";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";

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
  x.r.status, x.r.route, x.r.generation, x.r.totalAmount, x.r.totalOwnPay, x.r.totalInsurancePay,
  x.r.lines, x.r.appliedCaps, x.r.notes,
]);

const circ: Any = {}; circ.self = circ;
/** §5 값 격자. 브라우저가 만들 수 없는 값도 **엔진 직접 호출**로만 넣는다. */
const GRID: [string, unknown][] = [
  ["null", null], ["0", 0], ["-0", -0], ["1", 1], ["음수", -1], ["소수", 1.5],
  ["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY],
  ["''", ""], ["문자열", "x"], ["true", true], ["false", false],
  ["객체", { a: 1 }], ["배열", [1]], ["bigint", 10n], ["Symbol", Symbol("s")],
  ["함수", () => 1], ["순환 참조", circ], ["Date", new Date(0)],
];

const OUT = (a = 1_000_000) => ({ amount: a, visit: "outpatient", facility: "clinic" });
const PHA = (a = 1_000_000) => ({ amount: a, visit: "outpatient", facility: "pharmacy" });
const INP = (a = 15_000_000) => ({ amount: a, visit: "inpatient" });
const SL = [{ amount: 3_000_000, visit: "outpatient" }];

/** 진입점별 기준 입력 — 전부 기준선에서 `OK`인 정상 입력이다. */
const BASE: Record<string, [(i: Any) => unknown, Any]> = {
  "2·3세대|통원only": [(i) => calculateMany("2009", i as never), { plan: "standard", lines: [OUT()], priorAnnualOutpatientVisits: 0 }],
  "2·3세대|처방only": [(i) => calculateMany("2017", i as never), { plan: "standard", lines: [PHA()], priorAnnualPrescriptions: 0 }],
  "2·3세대|입원only": [(i) => calculateMany("2009", i as never), { plan: "standard", lines: [INP()] }],
  "2·3세대|혼합": [(i) => calculateMany("2017", i as never), { plan: "standard", lines: [OUT(), PHA(), INP()], priorAnnualOutpatientVisits: 0, priorAnnualPrescriptions: 0 }],
  "4세대|일반|급여|통원": [(i) => calculateMany2021(i as never), { cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [30_000] }],
  "4세대|일반|비급여|통원": [(i) => calculateMany2021(i as never), { cause: "disease", coverage: "non_benefit", visit: "outpatient", amounts: [1_000_000], priorAnnualOutpatientVisits: 0 }],
  "4세대|특약|도수": [(i) => calculateMany2021(i as never), { cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "manual_therapy", amounts: [1_000_000], priorAnnualRiderVisits: 0 }],
  "5세대|급여|통원": [(i) => calculateMany2026(i as never), { cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2, amounts: [3_000_000] }],
  "5세대|급여|입원": [(i) => calculateMany2026(i as never), { cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [3_000_000] }],
  "5세대|비급여|입원|중증": [(i) => calculateMany2026(i as never), { cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "hospital", amounts: [3_000_000] }],
  "별도|중증|근골격계": [(i) => calculateGen2026Item(i as never), { route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: SL, priorAnnualTreatmentActCount: 15, approvedThroughVisit: 50 }],
  "별도|중증|주사료": [(i) => calculateGen2026Item(i as never), { route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "general", lines: SL }],
  "별도|중증|MRI": [(i) => calculateGen2026Item(i as never), { route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [{ amount: 3_000_000, visit: "inpatient", tier: "hospital" }] }],
  "일반복귀|비중증|근골격계": [(i) => calculateGen2026Item(i as never), { route: "general", coverage: "non_benefit", cause: "disease", severity: "non_critical", item: "musculoskeletal_esw", visit: "outpatient", tier: "clinic", amounts: [3_000_000], priorAnnualOutpatientDays: 0 }],
  "상급병실료|중증": [(i) => calculateRoomCharge2026(i as never), { route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical", stays: [{ roomChargeTotal: 400_000, inpatientDays: 2 }] }],
};

console.log("\n[G-34B] 1. 기준 입력은 전부 정상 계산이다");
for (const [name, [call, base]] of Object.entries(BASE)) {
  const r = wrap(() => call({ ...base }));
  check(`${name}: 기준선 OK`, statusOf(r) === "OK", statusOf(r) + " " + note0(r).slice(0, 40));
}

/** 이번에 봉인한 자리 — (경로군, 축). 정상 리터럴로도 거부돼야 한다. */
const SEALED: [string, string, unknown][] = [
  // 2·3세대 다회 — 종전에는 stray 목록 자체가 없었다.
  ["2·3세대|통원only", "tier", "clinic"], ["2·3세대|통원only", "coverage", "benefit"],
  ["2·3세대|통원only", "visit", "outpatient"], ["2·3세대|통원only", "facility", "clinic"],
  ["2·3세대|통원only", "severity", "critical"], ["2·3세대|통원only", "generation", "2017"],
  ["2·3세대|통원only", "amounts", [1]], ["2·3세대|통원only", "stays", [1]],
  ["2·3세대|통원only", "route", "general"], ["2·3세대|통원only", "item", "mri"],
  ["2·3세대|통원only", "rider", "injection"], ["2·3세대|통원only", "annualCoverageLimit", 5_000_000],
  // 행 구성이 정하는 두 금액 축
  ["2·3세대|통원only", "priorAnnualPaid", 0], ["2·3세대|처방only", "priorAnnualPaid", 1_500_000],
  ["2·3세대|입원only", "perVisitCoverageLimit", 0],
  // 4세대 다회
  ["4세대|일반|비급여|통원", "tier", "clinic"], ["4세대|특약|도수", "tier", "hospital"],
  ["4세대|일반|비급여|통원", "plan", "standard"], ["4세대|일반|비급여|통원", "severity", "critical"],
  ["4세대|일반|비급여|통원", "generation", "2009"], ["4세대|일반|비급여|통원", "lines", [1]],
  ["4세대|일반|비급여|통원", "priorAnnualPaid", 0], ["4세대|일반|비급여|통원", "item", "mri"],
  // 5세대 다회
  ["5세대|급여|입원", "tier", "clinic"], ["5세대|급여|통원", "plan", "standard"],
  ["5세대|급여|통원", "facility", "clinic"], ["5세대|급여|통원", "rider", "injection"],
  ["5세대|급여|통원", "generation", "2009"], ["5세대|급여|통원", "perVisitCoverageLimit", 0],
  // 별도 보장종목
  ["별도|중증|주사료", "approvedThroughVisit", 50], ["별도|중증|MRI", "approvedThroughVisit", 10],
  ["별도|중증|주사료", "cause", "disease"], ["별도|중증|주사료", "visit", "outpatient"],
  ["별도|중증|주사료", "tier", "clinic"], ["별도|중증|주사료", "amounts", [1]],
  ["별도|중증|주사료", "plan", "standard"], ["별도|중증|주사료", "generation", "2026"],
  ["일반복귀|비중증|근골격계", "lines", [1]], ["일반복귀|비중증|근골격계", "approvedThroughVisit", 50],
  // 상급병실료
  ["상급병실료|중증", "amount", 0], ["상급병실료|중증", "plan", "standard"],
  ["상급병실료|중증", "roomChargeTotal", 400_000], ["상급병실료|중증", "generation", "2026"],
];

console.log("\n[G-34B] 2. 확정 stray는 정상 리터럴이어도 거부한다");
for (const [name, axis, v] of SEALED) {
  const [call, base] = BASE[name];
  const r = wrap(() => call({ ...base, [axis]: v }));
  check(`${name} · ${axis}=${String(v)} → 거부`, statusOf(r) === "PENDING_UNVERIFIED", statusOf(r) + " " + note0(r).slice(0, 44));
}

console.log("\n[G-34B] 3. 값 격자 — undefined만 미제공, 그 밖은 무엇이든 거부");
{
  for (const [name, axis] of [["2·3세대|통원only", "tier"], ["4세대|일반|비급여|통원", "plan"],
    ["5세대|급여|통원", "rider"], ["별도|중증|주사료", "cause"], ["상급병실료|중증", "amount"]] as const) {
    const [call, base] = BASE[name];
    const plain = wrap(() => call({ ...base }));
    check(`${name} ${axis}: undefined는 미제공과 동일`,
      shape(wrap(() => call({ ...base, [axis]: undefined }))) === shape(plain));
    let bad = 0;
    for (const [, v] of GRID) if (statusOf(wrap(() => call({ ...base, [axis]: v }))) === "OK") bad++;
    check(`${name} ${axis}: 값 격자 ${GRID.length}종 전부 거부`, bad === 0, `통과 ${bad}건`);
  }
}

console.log("\n[G-34B] 4. 실제 소비 축은 종전대로 계산한다");
{
  const paid = wrap(() => calculateMany("2009", { plan: "standard", lines: [INP()], priorAnnualPaid: 1_500_000 } as never));
  const paid0 = wrap(() => calculateMany("2009", { plan: "standard", lines: [INP()] } as never));
  check("2·3세대 입원 priorAnnualPaid 소비", statusOf(paid) === "OK" && shape(paid) !== shape(paid0));
  const lim = wrap(() => calculateMany("2009", { plan: "standard", lines: [OUT()], priorAnnualOutpatientVisits: 0, perVisitCoverageLimit: 200_000 } as never));
  check("2·3세대 통원 perVisitCoverageLimit 소비", statusOf(lim) === "OK"
    && (lim as { r: Res }).r.totalInsurancePay === 200_000, shape(lim).slice(0, 60));
  const t4 = wrap(() => calculateMany2021({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "hospital", amounts: [30_000] } as never));
  check("4세대 급여 통원 tier 소비", statusOf(t4) === "OK" && (t4 as { r: Res }).r.totalOwnPay === 20_000, shape(t4).slice(0, 60));
  const t5 = wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "hospital", amounts: [30_000_000] } as never));
  const t5c = wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "clinic", amounts: [30_000_000] } as never));
  check("5세대 비급여 입원 tier 소비", statusOf(t5) === "OK" && shape(t5) !== shape(t5c));
  const msk = wrap(() => calculateGen2026Item({ ...BASE["별도|중증|근골격계"][1], approvedThroughVisit: 10 } as never));
  check("근골격계 approvedThroughVisit 소비(승인 경계)", statusOf(msk) === "PENDING_UNVERIFIED"
    && note0(msk).includes("최초 10회"), statusOf(msk) + " " + note0(msk).slice(0, 40));
  const pool = wrap(() => calculateGen2026Item({ ...BASE["별도|중증|MRI"][1], priorAnnualInpatientDeductible: 4_900_000 } as never));
  check("중증 MRI priorAnnualInpatientDeductible 소비", statusOf(pool) === "OK"
    && shape(pool) !== shape(wrap(() => calculateGen2026Item(BASE["별도|중증|MRI"][1] as never))));
}

console.log("\n[G-34B] 5. 판단 보류 2자리 — 막지 않되 근거를 코드에 남긴다");
{
  for (const sev of ["critical", "non_critical"] as const) {
    const r = wrap(() => calculateMany2026({
      cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: sev,
      visit: "outpatient", tier: "clinic", amounts: [3_000_000],
      ...(sev === "critical" ? { priorAnnualOutpatientVisits: 0 } : { priorAnnualOutpatientDays: 0 }),
    } as never));
    check(`5세대 비급여 통원 ${sev}: tier 보류(막지 않음)`, statusOf(r) === "OK", statusOf(r) + " " + note0(r).slice(0, 40));
  }
  const mul = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("5세대 다회의 종별 거부가 급여 입원 조건과 같은 모양이다",
    /if \(input\.visit === "inpatient"\) \{\n\s*const strayTier = readCount\(bf, "tier"\);/.test(mul));
  check("비급여 통원 tier를 막는 코드가 없다", !/non_benefit[\s\S]{0,200}strayTier/.test(mul));
}

console.log("\n[G-34B] 6. 반환 계약 — 진입점마다 종전 모양 그대로다");
{
  const many = wrap(() => calculateMany("2009", { plan: "standard", lines: [OUT()], priorAnnualOutpatientVisits: 0, tier: "clinic" } as never));
  check("2·3세대 다회: blocked — 검증된 진료비 합계 보존 · 행 없음",
    !threw(many) && many.r.status === "PENDING_UNVERIFIED" && many.r.totalAmount === 1_000_000
    && many.r.totalOwnPay === null && (many.r.lines as unknown[]).length === 0
    && (many.r.appliedCaps as unknown[]).length === 0, shape(many).slice(0, 80));
  const m21 = wrap(() => calculateMany2021({ ...BASE["4세대|일반|비급여|통원"][1], plan: "standard" } as never));
  check("4세대 다회: blocked — 합계 보존", !threw(m21) && m21.r.totalAmount === 1_000_000 && m21.r.totalOwnPay === null);
  const m26 = wrap(() => calculateMany2026({ ...BASE["5세대|급여|통원"][1], plan: "standard" } as never));
  check("5세대 다회: blocked — 합계 보존", !threw(m26) && m26.r.totalAmount === 3_000_000 && m26.r.totalOwnPay === null);
  const item = wrap(() => calculateGen2026Item({ ...BASE["별도|중증|주사료"][1], plan: "standard" } as never));
  check("별도 보장종목: rejected — route가 rejected이고 총액 0",
    !threw(item) && item.r.route === "rejected" && item.r.status === "PENDING_UNVERIFIED"
    && item.r.totalAmount === 0 && (item.r.lines as unknown[]).length === 0, shape(item).slice(0, 80));
  const room = wrap(() => calculateRoomCharge2026({ ...BASE["상급병실료|중증"][1], plan: "standard" } as never));
  check("상급병실료: rejected — 총액 0", !threw(room) && room.r.route === "rejected" && room.r.totalAmount === 0);
  check("미검증 부분합을 노출하지 않는다 — 진료비가 무효면 총액 0",
    (() => { const r = wrap(() => calculateMany2026({ ...BASE["5세대|급여|통원"][1], amounts: [3_000_000, "abc"] } as never));
      return !threw(r) && r.r.totalAmount === 0; })());
}

console.log("\n[G-34B] 7. 읽는 계약 — 각 축을 한 번만, 선행 preflight가 정하면 읽지 않는다");
{
  for (const [name, axis] of [["2·3세대|통원only", "tier"], ["4세대|일반|비급여|통원", "plan"],
    ["5세대|급여|통원", "rider"], ["상급병실료|중증", "amount"]] as const) {
    const [call, base] = BASE[name];
    let reads = 0;
    const o: Any = { ...base };
    Object.defineProperty(o, axis, { get() { reads++; return "x"; }, enumerable: true, configurable: true });
    const r = wrap(() => call(o));
    check(`${name} ${axis}: 접근자 1회`, reads === 1 && statusOf(r) === "PENDING_UNVERIFIED", `읽기 ${reads}회 ${statusOf(r)}`);
  }
  // 선행 preflight가 결과를 정한 경로에서는 stray 이름을 읽지 않는다.
  const blocked: [string, Any, string][] = [
    ["2·3세대 plan 미지정", { lines: [OUT()], priorAnnualOutpatientVisits: 0 }, "tier"],
    ["2·3세대 외래 횟수 미입력", { plan: "standard", lines: [OUT()] }, "tier"],
  ];
  for (const [label, base, axis] of blocked) {
    const plain = wrap(() => calculateMany("2009", base as never));
    check(`${label}: 기준이 계산 불가`, statusOf(plain) === "PENDING_UNVERIFIED", statusOf(plain));
    let reads = 0;
    const o: Any = { ...base };
    Object.defineProperty(o, axis, { get() { reads++; return "clinic"; }, enumerable: true, configurable: true });
    const r = wrap(() => calculateMany("2009", o as never));
    check(`${label} + ${axis}: 읽지 않고 선행 안내 유지`, reads === 0 && shape(r) === shape(plain), `읽기 ${reads}회`);
  }
  // 행마다 원본 getter를 다시 읽지 않는다.
  let rowReads = 0;
  const many: Any = { plan: "standard", lines: [INP(), INP(), INP()] };
  Object.defineProperty(many, "priorAnnualPaid", { get() { rowReads++; return 0; }, enumerable: true, configurable: true });
  const rr = wrap(() => calculateMany("2009", many as never));
  check("2·3세대 다회: priorAnnualPaid를 행마다 다시 읽지 않는다(3행에 1회)",
    rowReads === 1 && statusOf(rr) === "OK", `읽기 ${rowReads}회 ${statusOf(rr)}`);
}

console.log("\n[G-34B] 8. 화면 — 비활성 경로에는 종별을 싣지 않는다(상태는 보존)");
{
  const ui21 = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
  check("4세대: 공통 객체에서 tier를 뺐다",
    /const common = money === null \? null : \{\n\s*cause, visit, amounts:/.test(ui21));
  check("4세대: 급여 통원에서만 종별을 싣는다",
    /const tierForPath = coverage === "benefit" && visit === "outpatient" \? tier : undefined;/.test(ui21));
  check("4세대: 여섯 분기 전부 같은 축을 쓴다", (ui21.match(/tier: tierForPath/g) ?? []).length === 6,
    String((ui21.match(/tier: tierForPath/g) ?? []).length));
  check("4세대: 종별 상태와 선택 UI는 그대로다(왕복 보존)",
    /useState<Tier>\("clinic"\)/.test(ui21) && /setTier\(e\.target\.value as Tier\)/.test(ui21));
  const ui26 = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("5세대: 급여 통원에서만 종별을 싣는다",
    /tier: visit === "outpatient" \? benefitTier : undefined,/.test(ui26));
  check("5세대: 급여 두 경로에 무조건 싣던 형태가 사라졌다",
    !/coverage: "benefit", visit, tier: benefitTier/.test(ui26));
  check("5세대: 종별 상태는 그대로다(왕복 보존)", /const \[benefitTier, setBenefitTier\] = useState<Tier>\("clinic"\)/.test(ui26));
  check("화면에 as 단언을 더하지 않았다",
    !/tierForPath as /.test(ui21) && !/benefitTier as /.test(ui26));
}

console.log("\n[G-34B] 8b. 안전 표시 — 새 안내도 값 자체를 직접 문자열화하지 않는다");
{
  // ⚠ 새로 만든 거부 안내가 `Symbol`·`bigint`·`toString()`이 던지는 객체에서 예외를 내면
  //   "무효 입력을 차단한다"는 목적 자체가 무너진다. 진입점마다 기존 안전 표시를 그대로 쓴다.
  const nasty: [string, unknown][] = [["Symbol", Symbol("s")], ["bigint", 10n],
    ["순환 참조", circ], ["toString이 던지는 객체", { toString() { throw new Error("x"); } }]];
  for (const [name, axis] of [["2·3세대|통원only", "tier"], ["4세대|일반|비급여|통원", "plan"],
    ["5세대|급여|통원", "rider"], ["별도|중증|주사료", "cause"], ["상급병실료|중증", "amount"]] as const) {
    const [call, base] = BASE[name];
    for (const [label, v] of nasty) {
      const r = wrap(() => call({ ...base, [axis]: v }));
      check(`${name} ${axis}=${label}: 예외 없이 차단`, statusOf(r) === "PENDING_UNVERIFIED", statusOf(r));
    }
  }
  for (const [file, path, n] of [
    ["multiClaim", "src/lib/insurance/engine/multiClaim.ts", 7],
    ["multiClaim2021", "src/lib/insurance/engine/multiClaim2021.ts", 9],
    ["multiClaim2026", "src/lib/insurance/engine/multiClaim2026.ts", 19],
  ] as const) {
    const body = readFileSync(path, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    check(`${file}: 안내 ${n}곳이 모두 지역 showValue를 쓴다`,
      (body.match(/받은 값: \$\{showValue\(/g) ?? []).length === n
      && !/받은 값: \$\{(String|JSON\.stringify)\(/.test(body),
      String((body.match(/받은 값: \$\{showValue\(/g) ?? []).length));
  }
  const itm = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("항목·상급병실료: 공용 rejected()가 안전 표시를 맡는다",
    !/받은 값: \$\{/.test(itm) && !/받은 값: \$\{/.test(room));
}

console.log("\n[G-34B] 9. 구조 — 목록 위치와 기존 우선순위");
{
  const std = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  const stdCode = std.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("2·3세대: 새 목록이 상수로 분리돼 있다", /const MULTI_STD_UNUSED_KEYS = \[/.test(std));
  check("2·3세대: 선행 preflight 뒤다",
    stdCode.indexOf("if (usesPrescriptions) {") < stdCode.indexOf("for (const key of MULTI_STD_UNUSED_KEYS)"));
  check("2·3세대: 두 카운터를 목록에 넣지 않았다",
    !/MULTI_STD_UNUSED_KEYS = \[[^\]]*priorAnnualOutpatientVisits/.test(std)
    && !/MULTI_STD_UNUSED_KEYS = \[[^\]]*priorAnnualPrescriptions/.test(std));
  check("2·3세대: plan을 목록에 넣지 않았다(필수 축)", !/MULTI_STD_UNUSED_KEYS = \[[^\]]*"plan"/.test(std));
  const m21 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("4세대: 새 목록이 기존 금액 축 stray 뒤다",
    m21.indexOf("const strayKeys: readonly string[]") < m21.indexOf("for (const key of MULTI2021_UNUSED_KEYS)"));
  check("4세대: tier를 목록에 넣지 않고 경로 조건으로 막는다",
    !/MULTI2021_UNUSED_KEYS = \[[^\]]*"tier"/.test(m21)
    && /if \(!\(input\.coverage === "benefit" && input\.visit === "outpatient"\)\) \{/.test(m21));
  const m26 = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("5세대: 새 목록이 별도 보장종목 전용 축 뒤다",
    m26.indexOf("for (const stray of SPECIAL_ITEM_ONLY_KEYS)") < m26.indexOf("for (const stray of MULTI2026_UNUSED_KEYS)"));
  const itm = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const itmCode = itm.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  // ⚠ 이 진입점만 목록을 **컨테이너 검증 뒤**로 내렸다. 앞에 두면 `lines`·`amounts`가 무효인
  //   선행 차단 경로에서 새 이름을 읽어, 던지는 getter가 종전에 없던 예외를 만든다(실측 14곳).
  check("항목: 경로별 목록이 컨테이너·진료비 검증 뒤에서 불린다",
    itmCode.indexOf("if (!Array.isArray(raw.lines)) return rejected") < itmCode.indexOf("const stray = rejectPathUnusedAxes(raw);")
    && itmCode.indexOf("const strayGeneral = rejectPathUnusedAxes(raw);") > itmCode.indexOf("return rejected(\n"));
  check("항목: 두 경로 모두에서 부른다",
    (itmCode.match(/rejectPathUnusedAxes\(raw\)/g) ?? []).length === 2);
  check("항목: 승인 회차를 별도 보장종목의 근골격계로 좁혔다",
    /const APPROVAL_ONLY_ITEM = "musculoskeletal_esw";/.test(itm)
    && /if \(!\(raw\.route === "special_item" && raw\.item === APPROVAL_ONLY_ITEM\)\) \{/.test(itmCode));
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("상급병실료: 새 12종이 기존 16개 뒤다",
    room.indexOf('"nhisCoinsuranceRate",') < room.indexOf('"priorAnnualRiderVisits",'));
  for (const [file, body] of [["multiClaim", stdCode], ["multiClaim2021", m21], ["multiClaim2026", m26]] as const) {
    check(`${file}: in 연산자가 아니라 값을 본다`, !/"(tier|plan|generation)" in /.test(body));
  }
}

console.log("\n[G-34B] 10. 타입 — 경로와 무관하게 막는 축만 봉인한다");
{
  type Sealed<T, K extends string> = K extends keyof T ? ([T[K]] extends [undefined] ? true : false) : false;
  const sealed = <T, K extends string>(v: Sealed<T, K>): boolean => v as unknown as boolean;
  type MC = import("../src/lib/insurance/engine/types").MultiClaimInput;
  type M21 = import("../src/lib/insurance/engine/types").Gen2021MultiClaimInput;
  type M26 = import("../src/lib/insurance/engine/types").Gen2026MultiClaimInput;
  type RC = import("../src/lib/insurance/engine/types").Gen2026RoomChargeInput;
  check("2·3세대 다회: tier 봉인", sealed<MC, "tier">(true));
  check("2·3세대 다회: generation 봉인", sealed<MC, "generation">(true));
  check("2·3세대 다회: visit·facility 봉인(행 안에서만 의미)", sealed<MC, "visit">(true) && sealed<MC, "facility">(true));
  check("2·3세대 다회: priorAnnualPaid는 봉인하지 않는다(행 구성이 정한다)", !sealed<MC, "priorAnnualPaid">(false));
  check("2·3세대 다회: perVisitCoverageLimit도 봉인하지 않는다", !sealed<MC, "perVisitCoverageLimit">(false));
  check("2·3세대 다회: lines는 봉인하지 않는다(필수 컨테이너)", !sealed<MC, "lines">(false));
  check("4세대 다회: plan 봉인", sealed<M21, "plan">(true));
  check("4세대 다회: severity 봉인", sealed<M21, "severity">(true));
  check("4세대 다회: tier는 봉인하지 않는다(급여 통원 소비)", !sealed<M21, "tier">(false));
  check("5세대 다회: facility 봉인", sealed<M26, "facility">(true));
  check("5세대 다회: rider 봉인", sealed<M26, "rider">(true));
  check("5세대 다회: tier는 봉인하지 않는다(비급여 입원·급여 통원 소비)", !sealed<M26, "tier">(false));
  check("상급병실료: amount 봉인", sealed<RC, "amount">(true));
  check("상급병실료: roomChargeTotal 봉인(원소 필드)", sealed<RC, "roomChargeTotal">(true));
  check("상급병실료: stays는 봉인하지 않는다(필수 컨테이너)", !sealed<RC, "stays">(false));
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  check("경로별 축을 타입으로 닫지 못한 이유가 기록돼 있다",
    types.includes("경로별 축은 여기서 닫지 않는다"));
  check("화면에 as 단언을 더하지 않는다고 적혀 있다", types.includes("`as` 단언을 더하지 않는다"));
}

console.log(`\n[G-34B 묶음·항목·상급병실료 진입점 소유권] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
