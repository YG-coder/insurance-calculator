// G-28 — `priorAnnualTreatmentActCount`(승인 구간 전용 축)의 경로별 입력 계약.
//   G-27까지 남아 있던 "일반 전환 경로 조용한 폐기"를 닫는다.
//
// 이 축은 <표1> 주)의 "각 치료횟수"이고 **중증 근골격계 이학요법·체외충격파의 보상 승인
// 구간에서만** 소비된다. `priorAnnualCoveredCount`('이미 보상한 횟수')와 다른 축이다 —
// 지급 0원 치료가 있으면 두 수가 갈라지므로 서로 대신 쓸 수 없다
// (GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY = HOLD, 이번에 건드리지 않았다).
//
// 종전 동작(기준선 f8f7237 — UI 미경유 엔진 직접 호출로 실측한 9경로):
//   | 경로 | 처리 | 접근자 |
//   | 중증 근골격계          | **소비**(승인 판정)        | **2회** |
//   | 중증 주사료·중증 MRI·비중증 MRI | 명시적 거부(rejected)   | 1회 |
//   | 일반 전환(근골격계·주사료·항암제) | **조용한 폐기**        | **0회** |
//   | 상급병실료(진입점·전용 진입점)  | **조용한 폐기**        | **0회** |
//   | 급여 다회·직접 다회       | 명시적 거부(blocked)      | 2회 |
//   ⚠ 조용한 폐기 경로에서 값 `0`·`5`의 결과가 미제공과 **완전히 같았다.** 반영돼서가 아니라
//     **읽히지 않아서**다(접근자 호출 0회로 직접 확인했다 — 결과 동일성만으로는 구분되지 않는다).
//   ⚠ 소비 경로의 2회 읽기는 검증(`validateItemInput`)과 승인 preflight가 각각 읽어서였다.
//     값이 달라지는 접근자에서 **검증한 값과 승인 판정에 쓰는 값이 갈렸다**(실측:
//     검증 5 → 판정 20으로 차단).
//
// ⚠ **유지한 계약**: 소비 경로의 승인 경계(미입력 차단 / `0`~`9` OK / `10` 이상 차단,
//   `approvedThroughVisit`과의 관계), 무효값 20종의 `rejected()` 거부와 문구,
//   형제 축의 거부 문구와 안내 우선순위, `priorAnnualCoveredCount`와의 분리,
//   지급 0원 HOLD, 산식·규칙값·한도·다른 입력 축.
//
// ⚠ **stray 검사의 위치**: 진입점의 **경로 대조 뒤**다(`validateItemInput`의 일반 분기 끝이
//   아니다). 분기 끝에 두면 `route: "general"`인데 약관상 별도 보장종목인 조합(중증
//   근골격계·중증 MRI·비중증 MRI)과 약제 용도 미정 조합에서 **기존 경로 불일치 안내를
//   밀어내고**, 경로 불일치가 이미 확정된 입력에서 접근자까지 실행됐다. 지급보험금(G-23)·
//   진료비(G-26)이 세운 "그 축이 실제로 쓰이는 자리 앞에서 읽는다"와 같은 원칙이다.
//   3-b절이 안내로, 4절이 접근자 0회로 고정한다.
//
// ⚠ **예외 계약의 유일한 변화**: 조용한 폐기를 막으려면 값을 읽어야 하므로, 종전에 이 필드를
//   **읽지 않던** 다섯 경로(일반 전환 3종 · 상급병실료 2종)에서 던지는 접근자의 예외가 이제
//   전파된다. 그 대상은 **종전에 조용히 폐기하며 성공하던 입력뿐**이고, 다른 축이 이미
//   무효이거나 경로가 불일치라 앞에서 차단되던 입력은 종전 그대로 예외 없이 끝난다
//   (아래 4절이 12조합으로 고정한다).
//   `in` 연산자로 읽지 않고 막는 방법도 있으나 채택하지 않았다 — 저장소의 형제 축이 모두
//   `!== undefined`로 판정하고, 외부 호출자가 흔히 쓰는 `{ ...base, key: undefined }`
//   패턴을 `in`은 "제공됨"으로 보아 정상 입력을 막게 된다.
import { readFileSync } from "node:fs";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
type Res = Record<string, unknown>;
type Caught = { threw: string } | { r: Res };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => unknown): Caught => {
  try { return { r: f() as Res }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const statusOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.status);
const routeOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.route ?? "-");
const amtOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalAmount as number | null);
const insOf = (x: Caught): number | null => threw(x) ? null : (x.r.totalInsurancePay as number | null);
const rowsN = (x: Caught) => threw(x) ? -1 : (x.r.lines as unknown[]).length;
const notes = (x: Caught) => threw(x) ? [] : ((x.r.notes as string[]) ?? []);
const note0 = (x: Caught) => notes(x)[0] ?? "";
/** 별도 보장종목 진입점의 거부 계약 — 총액을 만들지 않는다. */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0
  && Array.isArray(x.r.appliedCaps) && (x.r.appliedCaps as unknown[]).length === 0;
/** 다회 진입점의 차단 계약 — 진료비 합계를 보존한다. */
const isBlocked = (x: Caught, total: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === total && x.r.totalOwnPay === null && (x.r.lines as unknown[]).length === 0;

type Any = Record<string, unknown>;
const MAX = Number.MAX_SAFE_INTEGER;
const circ: Any = {}; circ.self = circ;
const out = (a: number) => ({ amount: a, visit: "outpatient" });

// ── 9경로 어댑터 ─────────────────────────────────────────────────────
const MSK = (e: Any = {}, lines = 1, approved = 10) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw",
  lines: Array.from({ length: lines }, () => out(300_000)), priorAnnualCoveredCount: 0,
  approvedThroughVisit: approved, ...e });
const INJ = (e: Any = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "injection", injectionPurpose: "general", lines: [out(300_000)], priorAnnualCoveredCount: 0, ...e });
const CMRI = (e: Any = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "mri", lines: [out(300_000)], ...e });
const NMRI = (e: Any = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "non_critical",
  item: "mri", lines: [out(300_000)], ...e });
const GEN_MSK = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "non_critical",
  item: "musculoskeletal_esw", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientDays: 0, ...e });
const GEN_INJ = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "non_critical",
  item: "injection", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientDays: 0, ...e });
const GEN_ANTI = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "injection", injectionPurpose: "anticancer", cause: "disease", visit: "outpatient",
  amounts: [300_000], priorAnnualOutpatientVisits: 0, ...e });
/**
 * 경로 불일치 조합 — `route: "general"`이지만 약관상 별도 보장종목이라 진입점의 경로 대조가
 * 막는 자리다. 이 축이 실려 와도 **종전(f8f7237)의 경로 불일치 안내가 그대로 우선**해야 한다.
 */
const MIS_MSK = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "musculoskeletal_esw", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0, ...e });
const MIS_CMRI = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "mri", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0, ...e });
const MIS_NMRI = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "non_critical",
  item: "mri", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientDays: 0, ...e });
/** 약제 용도가 없어 경로를 정할 수 없는 조합 — 경로 대조 직전의 전용 안내가 우선해야 한다. */
const MIS_PURPOSE = (e: Any = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical",
  item: "injection", cause: "disease", visit: "outpatient", amounts: [300_000],
  priorAnnualOutpatientVisits: 0, ...e });
/** 반대 방향 — `route: "special_item"`이지만 약관상 일반 전환인 조합(종전 계약 그대로). */
const MIS_REV = (e: Any = {}) => ({ route: "special_item", coverage: "non_benefit",
  severity: "non_critical", item: "musculoskeletal_esw", lines: [out(300_000)], ...e });
const RC = (e: Any = {}) => ({ route: "room_charge", coverage: "non_benefit", cause: "disease",
  severity: "non_critical", stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 5 }], ...e });
const BENEFIT = (e: Any = {}) => ({ cause: "disease", coverage: "benefit", visit: "outpatient",
  tier: "clinic", nhisCoinsuranceRate: 0.4, amounts: [300_000], ...e });
const MANY = (e: Any = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
  severity: "non_critical", nonBenefitItem: "general", amounts: [300_000], priorAnnualOutpatientDays: 0, ...e });

const item = (mk: (e: Any) => Any) => (e: Any = {}) => wrap(() => calculateGen2026Item(mk(e) as never));
const many = (mk: (e: Any) => Any) => (e: Any = {}) => wrap(() => calculateMany2026(mk(e) as never));
const room = (e: Any = {}) => wrap(() => calculateRoomCharge2026(RC(e) as never));

/** 미사용(= 차단) 경로 8종. 두 진입점의 반환 계약이 다르므로 판정 함수를 함께 싣는다. */
const UNUSED: [string, (e: Any) => Caught, (x: Caught) => boolean, string][] = [
  ["중증 주사료", item(INJ), isRejected, "과거 치료행위 수(priorAnnualTreatmentActCount)는 근골격계"],
  ["중증 MRI", item(CMRI), isRejected, "과거 치료행위 수(priorAnnualTreatmentActCount)는 근골격계"],
  ["비중증 MRI", item(NMRI), isRejected, "과거 치료행위 수(priorAnnualTreatmentActCount)는 근골격계"],
  ["일반전환 근골격계", item(GEN_MSK), isRejected, "과거 치료행위 수(priorAnnualTreatmentActCount)는 중증 근골격계"],
  ["일반전환 주사료", item(GEN_INJ), isRejected, "과거 치료행위 수(priorAnnualTreatmentActCount)는 중증 근골격계"],
  ["일반전환 항암제", item(GEN_ANTI), isRejected, "과거 치료행위 수(priorAnnualTreatmentActCount)는 중증 근골격계"],
  ["상급병실료(진입점)", item(RC), isRejected, "상급병실료 차액 계산에 쓰이지 않는 입력(priorAnnualTreatmentActCount)"],
  ["상급병실료(전용 진입점)", room, isRejected, "상급병실료 차액 계산에 쓰이지 않는 입력(priorAnnualTreatmentActCount)"],
];

console.log("\n[G-28] 1. 소비 경로(중증 근골격계) — 승인 판정 계약 무회귀");
{
  const M = (v: unknown) => item(MSK)({ priorAnnualTreatmentActCount: v });
  const MA = (v: unknown, approved: number) => wrap(() => calculateGen2026Item(MSK({ priorAnnualTreatmentActCount: v }, 1, approved) as never));
  check("필드 생략 → 종전대로 승인 안내로 차단(총액 보존)",
    statusOf(item(MSK)()) === "PENDING_UNVERIFIED" && amtOf(item(MSK)()) === 300_000
    && note0(item(MSK)()).startsWith("근골격계 이학요법·체외충격파는 최초 10회 이후에는"), note0(item(MSK)()).slice(0, 40));
  check("명시적 undefined도 같다", statusOf(M(undefined)) === "PENDING_UNVERIFIED" && amtOf(M(undefined)) === 300_000);
  for (const v of [0, 1, 5, 8, 9]) {
    check(`acts=${v} → 종전대로 계산된다`, statusOf(M(v)) === "OK" && insOf(M(v)) === 210_000, `${statusOf(M(v))}/${insOf(M(v))}`);
  }
  for (const v of [10, 11, MAX]) {
    check(`acts=${v === MAX ? "MAX_SAFE" : v} → 종전대로 승인 경계로 차단`,
      statusOf(M(v)) === "PENDING_UNVERIFIED" && amtOf(M(v)) === 300_000 && rowsN(M(v)) === 0, statusOf(M(v)));
  }
  check("approved=20이면 acts=10도 계산된다(경계가 승인 회차를 따른다)", statusOf(MA(10, 20)) === "OK");
  check("approved=10 · 2행 · acts=9 → 경계를 넘어 차단",
    statusOf(wrap(() => calculateGen2026Item(MSK({ priorAnnualTreatmentActCount: 9 }, 2, 10) as never))) === "PENDING_UNVERIFIED");
  // 무효값은 종전 문구 그대로 거부한다.
  const BAD: [string, unknown][] = [["-1", -1], ["-5", -5], ["0.5", 0.5], ["5.5", 5.5],
    ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity], ["'5'", "5"], ["''", ""], ["' '", " "],
    ["'1e1'", "1e1"], ["'1,0'", "1,0"], ["null", null], ["true", true], ["false", false], ["{}", {}],
    ["[5]", [5]], ["1n", 1n], ["Symbol", Symbol("s")], ["함수", () => 1], ["순환 참조", circ], ["MAX+1", MAX + 1]];
  for (const [l, v] of BAD) {
    check(`소비 경로 무효 ${l} → 종전대로 rejected(총액 0)`, isRejected(M(v)), `${routeOf(M(v))}/${amtOf(M(v))}`);
  }
  check("소비 경로 무효 안내 문구가 종전 그대로",
    note0(M(-1)) === "과거 치료행위 수(priorAnnualTreatmentActCount)는 0 이상의 정수여야 합니다 — 값이 올바르지 않아 계산하지 않았습니다.", note0(M(-1)));
  check("소비 경로 무효 안내가 받은 값을 안전 표시로 싣는다", notes(M(1n))[1] === "받은 값: 1");
}

console.log("\n[G-28] 2. 미사용 경로 8종 — 값 0도 포함해 명시적으로 차단");
for (const [label, run, ok, want] of UNUSED) {
  for (const [l, v] of [["0", 0], ["5", 5], ["-1", -1], ["MAX_SAFE", MAX], ["'5'", "5"], ["null", null], ["1n", 1n]] as [string, unknown][]) {
    const x = run({ priorAnnualTreatmentActCount: v });
    check(`${label}: acts=${l} → 차단`, ok(x), `${routeOf(x)}/${statusOf(x)}/${amtOf(x)}`);
  }
  check(`${label}: 안내가 올바른 입력 경로를 설명한다`, note0(run({ priorAnnualTreatmentActCount: 0 })).startsWith(want),
    note0(run({ priorAnnualTreatmentActCount: 0 })).slice(0, 56));
  check(`${label}: 필드가 없으면 종전대로 계산된다`, statusOf(run({})) === "OK", statusOf(run({})));
  check(`${label}: 명시적 undefined는 미제공과 같다(형제 축과 같은 계약)`,
    statusOf(run({ priorAnnualTreatmentActCount: undefined })) === "OK");
}
console.log("  — 다회 두 경로(반환 계약이 다르다: blocked — 진료비 합계 보존)");
for (const [label, mk] of [["급여 다회", BENEFIT], ["직접 다회", MANY]] as [string, (e: Any) => Any][]) {
  for (const [l, v] of [["0", 0], ["5", 5], ["-1", -1]] as [string, unknown][]) {
    const x = many(mk)({ priorAnnualTreatmentActCount: v });
    check(`${label}: acts=${l} → 종전대로 blocked(총액 300,000 보존)`, isBlocked(x, 300_000), `${statusOf(x)}/${amtOf(x)}`);
  }
  check(`${label}: 안내가 종전 그대로`, note0(many(mk)({ priorAnnualTreatmentActCount: 0 })).startsWith("priorAnnualTreatmentActCount은(는) 별도 보장종목"));
  check(`${label}: 필드가 없으면 종전대로 계산된다`, statusOf(many(mk)()) === "OK");
}

console.log("\n[G-28] 3. 안내 우선순위 — 다른 선행 입력이 미완료면 그 안내가 우선");
{
  // 소비 경로: 종전 순서 그대로 (route → coverage → severity → item → lines → 진료비 → visit → tier → covered → acts → approved)
  const PRI: [string, Any, string][] = [
    ["route 무효", { route: "x" }, "경로(route)"],
    ["coverage 무효", { coverage: "benefit" }, "급여 구분(coverage)"],
    ["severity 무효", { severity: "x" }, "질환 구분(severity)"],
    ["item 무효", { item: "x" }, "치료유형(item)"],
    ["lines 비배열", { lines: null }, "행 목록(lines)"],
    ["진료비 무효", { lines: [{ amount: -1, visit: "outpatient" }] }, "1번째 행의 진료비(amount)"],
    ["visit 무효", { lines: [{ amount: 300_000, visit: "x" }] }, "1번째 행의 치료 형태(visit)"],
    ["covered 무효", { priorAnnualCoveredCount: -1 }, "이미 보상한 횟수(priorAnnualCoveredCount)"],
    ["통원 카운터 stray", { priorAnnualOutpatientDays: 0 }, "통원 카운터는 별도 보장종목"],
  ];
  for (const [l, over, want] of PRI) {
    const x = item(MSK)({ priorAnnualTreatmentActCount: -1, ...over });
    check(`소비 경로: ${l}이 acts보다 앞선다`, note0(x).startsWith(want), note0(x).slice(0, 44));
  }
  check("소비 경로: acts가 승인 회차(approvedThroughVisit) 검증보다 앞선다(종전 그대로)",
    note0(item(MSK)({ priorAnnualTreatmentActCount: -1, approvedThroughVisit: 15 })).startsWith("과거 치료행위 수"));
  check("소비 경로: acts 정상이면 승인 회차 안내가 나온다(종전 그대로)",
    note0(item(MSK)({ priorAnnualTreatmentActCount: 5, approvedThroughVisit: 15 })).startsWith("보상 승인 회차(approvedThroughVisit)"));
  check("소비 경로: acts가 지급보험금 검증보다 앞선다(종전 그대로)",
    note0(item(MSK)({ priorAnnualTreatmentActCount: -1, priorAnnualInsurancePaid: -1 })).startsWith("과거 치료행위 수"));
  // 일반 전환 경로: 새 검사가 **분기의 맨 끝**이라 기존 안내가 전부 우선한다.
  const GPRI: [string, Any, string][] = [
    ["route 무효", { route: "x" }, "경로(route)"],
    ["coverage 무효", { coverage: "benefit" }, "급여 구분(coverage)"],
    ["severity 무효", { severity: "x" }, "질환 구분(severity)"],
    ["item 무효", { item: "x" }, "치료유형(item)"],
    ["cause 무효", { cause: "x" }, "원인(cause)"],
    ["visit 무효", { visit: "x" }, "치료 형태(visit)"],
    ["tier 무효", { tier: "x" }, "의료기관 종별(tier)"],
    ["진료비 컨테이너", { amounts: null }, "진료비 목록(amounts)"],
    ["진료비 원소", { amounts: [-1] }, "1번째 진료비(amounts)"],
    ["covered stray", { priorAnnualCoveredCount: 0 }, "이미 보상한 횟수(priorAnnualCoveredCount)"],
    ["pool stray", { priorAnnualInpatientDeductible: 0 }, "누적 공제금액(priorAnnualInpatientDeductible)"],
    ["카운터 축 교차", { priorAnnualOutpatientVisits: 0 }, "비중증 통원의 연간 한도는"],
  ];
  for (const [l, over, want] of GPRI) {
    const x = item(GEN_MSK)({ priorAnnualTreatmentActCount: 5, ...over });
    check(`일반 전환: ${l}이 acts stray보다 앞선다(종전 안내 유지)`, note0(x).startsWith(want), note0(x).slice(0, 46));
  }
  // 상급병실료: 목록 맨 끝에 넣어 기존 13개 키가 앞선다.
  for (const [l, over, want] of [["visit stray", { visit: "outpatient" }, "쓰이지 않는 입력(visit)"],
    ["lines stray", { lines: [] }, "쓰이지 않는 입력(lines)"],
    ["covered stray", { priorAnnualCoveredCount: 0 }, "쓰이지 않는 입력(priorAnnualCoveredCount)"],
    ["cause 무효", { cause: "x" }, "원인(cause)"]] as [string, Any, string][]) {
    const x = room({ priorAnnualTreatmentActCount: 5, ...over });
    check(`상급병실료: ${l}이 acts보다 앞선다`, note0(x).includes(want), note0(x).slice(0, 50));
  }
  // ⚠ **의도한 안내 전환 1건.** `UNUSED_KEYS` 루프는 `stays` 형식 검사보다 **앞**이다.
  //   그래서 `stays`가 무효이면서 이 축이 실려 오면, 기준선의 "입원 목록(stays)" 안내 대신
  //   "쓰이지 않는 입력" 안내가 나간다. 이 순서는 이 축이 만든 것이 아니라 **형제 13개 키가
  //   이미 갖고 있던 계약**이고, 목록에 키 하나를 더하면 자동으로 따라온다. 형제와 다르게
  //   두려면 이 키만 루프 밖 `stays` 뒤로 빼야 하는데, 같은 종류의 축에 두 가지 순서가
  //   생겨 더 나쁘다. 아래가 그 근거를 형제 축과 나란히 고정한다.
  {
    const bad = (over: Any) => note0(room({ stays: 3, ...over }));
    check("기준: stays만 무효 → 입원 목록 안내", bad({}).startsWith("입원 목록(stays)"), bad({}).slice(0, 40));
    for (const k of ["approvedThroughVisit", "priorAnnualCoveredCount", "priorAnnualInpatientDeductible",
      "outpatientCoverageLimit", "priorAnnualOutpatientDays"]) {
      check(`형제 축 ${k}: 종전부터 stays 안내보다 앞선다`,
        bad({ [k]: 5 }).includes(`쓰이지 않는 입력(${k})`), bad({ [k]: 5 }).slice(0, 46));
    }
    check("acts도 형제와 같은 순서다(의도한 전환 · 안내 5격자)",
      bad({ priorAnnualTreatmentActCount: 5 }).includes("쓰이지 않는 입력(priorAnnualTreatmentActCount)"),
      bad({ priorAnnualTreatmentActCount: 5 }).slice(0, 46));
  }
}

console.log("\n[G-28] 3-b. 경로 불일치·용도 미정 안내가 stray 안내보다 **먼저** 나온다");
{
  // ⚠ 종전(f8f7237)에는 이 조합들이 이 축을 읽지 않았고, 경로 불일치 안내로 끝났다.
  //   stray 검사를 `validateItemInput`의 일반 분기 끝에 두면 그 안내를 밀어낸다.
  //   경로가 아직 확정되지 않은 자리에서 "이 조합은 일반 산식으로 계산하므로 쓰이지
  //   않습니다"라고 말하면 사실과 다르다 — 이 조합은 애초에 일반 산식으로 계산하지 않는다.
  const MISMATCH: [string, (e: Any) => Any, string][] = [
    ["중증 근골격계(route=general)", MIS_MSK, "이 조합은 별도 보장종목 경로에서 계산해야 합니다."],
    ["중증 MRI(route=general)", MIS_CMRI, "이 조합은 별도 보장종목 경로에서 계산해야 합니다."],
    ["비중증 MRI(route=general)", MIS_NMRI, "이 조합은 별도 보장종목 경로에서 계산해야 합니다."],
    ["약제 용도 미정(route=general)", MIS_PURPOSE, "비급여 주사료의 약제 용도(injectionPurpose)가 없어"],
  ];
  for (const [label, mk, head] of MISMATCH) {
    const bare = wrap(() => calculateGen2026Item(mk({}) as never));
    check(`${label}: 축 미제공 — 기준선 안내`, note0(bare).startsWith(head), note0(bare).slice(0, 40));
    for (const v of [0, 5, -1, "5", null, 1.5]) {
      const x = wrap(() => calculateGen2026Item(mk({ priorAnnualTreatmentActCount: v }) as never));
      check(`${label}: acts=${JSON.stringify(v)} — 같은 안내가 그대로 우선`,
        note0(x) === note0(bare) && isRejected(x), note0(x).slice(0, 40));
    }
  }
  // ⚠ **계약이 바뀌었다(G-29).** 종전(G-28 시점)에는 별도 보장종목 분기의 미사용 축 거부가
  //   먼저였다 — "과거 치료행위 수는 근골격계 이학요법…에만 쓰입니다". G-29가 경로 대조를
  //   `validateItemInput`의 리터럴 네 축 검증 직후로 올리면서, 경로가 틀린 입력에서는
  //   **경로 불일치 안내가 먼저** 나가고 경로별 축은 읽히지도 않는다. 이 방향이 P1에서
  //   고친 것과 같다 — 그 조합에서 이 축은 실제로 쓰이므로 "쓰이지 않습니다"는 사실과 다르다.
  const rev = wrap(() => calculateGen2026Item(MIS_REV({ priorAnnualTreatmentActCount: 5 }) as never));
  check("route=special_item·비중증 근골격계: 경로 불일치 안내가 먼저다(G-29)",
    isRejected(rev) && note0(rev).startsWith("이 조합은 일반 상해·질병 비급여 경로에서"),
    note0(rev).slice(0, 40));
  check("route=special_item·비중증 근골격계: 축 미제공이면 종전대로 경로 불일치 안내",
    note0(wrap(() => calculateGen2026Item(MIS_REV() as never))).startsWith("이 조합은 일반 상해·질병 비급여 경로에서"));
}

console.log("\n[G-28] 4. 접근자 — 경로마다 정확히 한 번, 선행 차단 0회");
{
  const withActs = (mkBase: Any, get: () => unknown, f: (i: unknown) => unknown) => {
    const n = { v: 0 };
    const o = { ...mkBase } as Any;
    Object.defineProperty(o, "priorAnnualTreatmentActCount", { enumerable: true, configurable: true, get() { n.v++; return get(); } });
    return { n, x: wrap(() => f(o)) };
  };
  const gi = (i: unknown) => calculateGen2026Item(i as never);
  const mc = (i: unknown) => calculateMany2026(i as never);
  const rcf = (i: unknown) => calculateRoomCharge2026(i as never);
  const CASES: [string, Any, (i: unknown) => unknown][] = [
    ["중증 근골격계(소비)", MSK(), gi], ["중증 주사료", INJ(), gi], ["중증 MRI", CMRI(), gi], ["비중증 MRI", NMRI(), gi],
    ["일반전환 근골격계", GEN_MSK(), gi], ["일반전환 주사료", GEN_INJ(), gi], ["일반전환 항암제", GEN_ANTI(), gi],
    ["상급병실료(진입점)", RC(), gi], ["상급병실료(전용)", RC(), rcf],
    ["급여 다회", BENEFIT(), mc], ["직접 다회", MANY(), mc],
  ];
  for (const [l, base, f] of CASES) {
    check(`${l}: 정확히 1회 읽는다`, withActs(base, () => 5, f).n.v === 1, String(withActs(base, () => 5, f).n.v));
  }
  // 선행 차단 경로에서는 읽지 않는다.
  const BLOCKED_FIRST: [string, Any, (i: unknown) => unknown][] = [
    ["소비 경로 · item 무효", MSK({ item: "x" }), gi],
    ["소비 경로 · 진료비 무효", MSK({ lines: [{ amount: -1, visit: "outpatient" }] }), gi],
    ["일반전환 · cause 무효", GEN_MSK({ cause: "x" }), gi],
    ["일반전환 · 진료비 무효", GEN_MSK({ amounts: [-1] }), gi],
    ["일반전환 · covered stray", GEN_MSK({ priorAnnualCoveredCount: 0 }), gi],
    ["상급병실료 · cause 무효", RC({ cause: "x" }), rcf],
    ["상급병실료 · 앞선 stray", RC({ visit: "outpatient" }), rcf],
    ["다회 · 레거시 필드", MANY({ priorAnnualPaid: 0 }), mc],
    // ⚠ 경로 불일치·용도 미정은 stray 검사보다 **앞선** 차단이다. 확정된 뒤에만 읽는다.
    ["경로 불일치 · 중증 근골격계", MIS_MSK(), gi],
    ["경로 불일치 · 중증 MRI", MIS_CMRI(), gi],
    ["경로 불일치 · 비중증 MRI", MIS_NMRI(), gi],
    ["용도 미정 · 중증 주사료", MIS_PURPOSE(), gi],
  ];
  for (const [l, base, f] of BLOCKED_FIRST) {
    const g = withActs(base, () => 5, f);
    check(`${l}: 접근자 0회`, g.n.v === 0, String(g.n.v));
    check(`${l}: 던지는 getter여도 예외가 없다(종전 그대로)`, !threw(withActs(base, () => { throw new Error("boom"); }, f).x));
  }
  // 변하는 getter — 검증한 첫 값 하나만 승인 판정에 쓰인다.
  {
    let i = 0;
    const g = withActs(MSK(), () => [5, 20][Math.min(i++, 1)], gi);
    check("소비 경로 변하는 getter: 첫 값(5)만 쓰여 계산된다(종전에는 두 번째 값 20으로 차단)",
      g.n.v === 1 && statusOf(g.x) === "OK" && insOf(g.x) === 210_000, `${g.n.v}/${statusOf(g.x)}`);
  }
  // 던지는 getter — 값을 읽어야 막을 수 있는 자리에서만 전파한다.
  for (const [l, base, f] of CASES) {
    check(`${l}: 던지는 getter는 전파된다(막으려면 읽어야 한다)`, threw(withActs(base, () => { throw new Error("boom"); }, f).x));
  }
}

console.log("\n[G-28] 5. priorAnnualCoveredCount와의 축 분리 · 지급 0원 HOLD 무회귀");
{
  check("covered=10 · acts=0 → 계산된다(승인 축은 covered를 보지 않는다)",
    statusOf(item(MSK)({ priorAnnualCoveredCount: 10, priorAnnualTreatmentActCount: 0 })) === "OK");
  check("covered=0 · acts=10 → 승인 경계로 차단(covered로 대신 쓰지 않는다)",
    statusOf(item(MSK)({ priorAnnualCoveredCount: 0, priorAnnualTreatmentActCount: 10 })) === "PENDING_UNVERIFIED");
  check("covered=5 · acts=10 → 차단(두 축이 독립)",
    statusOf(item(MSK)({ priorAnnualCoveredCount: 5, priorAnnualTreatmentActCount: 10 })) === "PENDING_UNVERIFIED");
  check("0원 행은 승인 회차를 밀지 않는다(종전 그대로)",
    statusOf(wrap(() => calculateGen2026Item(MSK({ priorAnnualTreatmentActCount: 9,
      lines: [out(0), out(300_000)] }, 1, 10) as never))) === "OK");
  const src = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("지급 0원 HOLD 차단이 그대로",
    /if \(fingerprint\(counted\) !== fingerprint\(notCounted\)\) return blocked\(totalAmount, ZERO_PAY_HOLD_NOTES\);/.test(src));
  check("HOLD 안내 3줄이 그대로",
    src.includes("지급 보험금이 0원인 치료행위가 연간 보상 횟수를 소진하는지는 표준약관에 정해져 있지 않습니다."));
  check("승인 회차 집계가 종전대로 양수 금액 행만 센다", /amounts\.filter\(\(a\) => a > 0\)\.length/.test(src));
}

console.log("\n[G-28] 6. 범위 밖 무회귀 — 진료비 계약(G-26·G-27)과 다른 축");
{
  check("G-26 상급병실료 진료비 계약 그대로", isRejected(room({ stays: [{ roomChargeTotal: -1, inpatientDays: 5 }] })));
  check("G-26 별도 보장종목 진료비 계약 그대로", isRejected(item(INJ)({ lines: [{ amount: 0.5, visit: "outpatient" }] })));
  check("G-27 다회 진료비 계약 그대로",
    !threw(many(MANY)({ amounts: [300_000, "abc"] })) && amtOf(many(MANY)({ amounts: [300_000, "abc"] })) === 0);
  check("정상 계산 무회귀 — 소비 경로", insOf(item(MSK)({ priorAnnualTreatmentActCount: 0 })) === 210_000);
  check("정상 계산 무회귀 — 일반 전환", insOf(item(GEN_MSK)()) === 150_000);
  check("정상 계산 무회귀 — 상급병실료", insOf(room()) === 500_000);
  check("정상 계산 무회귀 — 직접 다회", insOf(many(MANY)()) === 150_000);
  check("정상 계산 무회귀 — 급여 다회", insOf(many(BENEFIT)()) === 180_000);
}

console.log("\n[G-28] 7. 전달 검사 — 어느 진입점에 무엇이 넘어가는가");
{
  // 결과 동일성이 아니라 **전달된 객체**로 확인한다.
  const seen: Any[] = [];
  const probe = new Proxy(MSK({ priorAnnualTreatmentActCount: 7 }) as Any, {
    get(t, p, r) { if (typeof p === "string") seen.push({ key: p }); return Reflect.get(t, p, r); },
  });
  const x = wrap(() => calculateGen2026Item(probe as never));
  const reads = seen.filter((s) => s.key === "priorAnnualTreatmentActCount").length;
  check("소비 경로: 진입점이 이 키를 정확히 1회 읽는다(Proxy로 직접 관측)", reads === 1, String(reads));
  check("소비 경로: 그 값으로 계산이 끝난다", statusOf(x) === "OK");
  const src = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  // ⚠ 개수가 아니라 **어디서 읽는가**로 본다. 실행 코드에서 이 속성을 실제로 읽는 자리는
  //   `validateItemInput`의 두 곳(소비 경로 검증 1 + 일반 전환 stray 1)뿐이어야 한다.
  const readSites = (code.match(/\)\.priorAnnualTreatmentActCount/g) ?? []).length;
  check("실행 코드에서 이 속성을 읽는 자리가 두 곳뿐이다(검증 1 + stray 1)", readSites === 2, String(readSites));
  check("본체(calculateSpecialItem2026)가 input에서 다시 읽지 않는다",
    !/\(input as \{ priorAnnualTreatmentActCount\?: number \}\)/.test(code));
  // ⚠ **낡은 앵커를 교체했다(G-29).** 위치는 같고(검증값 전달 계약), 기존 의미도 같다 —
  //   "승인 구간 축을 한 번 읽어 검증한 값을 본체에 넘긴다". 교체 이유: G-29가 형제 두 축을
  //   같은 통로에 실으면서 `CheckedAmounts`가 `CheckedItemInput`으로 이름이 바뀌고,
  //   본체 인자가 세 개에서 검증 결과 하나로 합쳐졌다.
  check("검증한 값을 인자로 넘긴다",
    /const checkedActs = acts as number \| undefined;/.test(code)
    && /amounts: lineAmounts, acts: checkedActs,/.test(code)
    && /const \{ amounts, acts: priorActs \} = checked;/.test(code)
    && /calculateSpecialItem2026\(rest, checked\)/.test(code));
  // ⚠ **위치가 계약이다.** stray 검사는 `validateItemInput`의 일반 분기 끝이 아니라
  //   진입점의 **경로 대조 뒤**에 있어야 한다. 분기 끝에 두면 `route: "general"`인데 실제로는
  //   별도 보장종목인 조합(중증 근골격계·MRI 등)에서 기존 경로 불일치 안내를 밀어내고,
  //   경로 불일치가 이미 확정된 입력에서 접근자까지 실행된다(아래 3-b·4절이 동작으로 고정).
  check("일반 전환 stray 검사가 validateItemInput 밖이다",
    code.indexOf("const strayActs") > code.indexOf("export function calculateGen2026Item("));
  check("일반 전환 stray 검사가 경로 대조 **뒤**, 계산 **앞**이다",
    code.indexOf("const strayActs") > code.indexOf("const expected = routeOfGen2026Item(")
    && code.indexOf("const strayActs") > code.indexOf("if (expected !== rest.route) {")
    && code.indexOf("const strayActs") < code.indexOf('return rest.route === "special_item"'));
  check("일반 전환 stray 검사가 route가 general로 확정된 뒤에만 실행된다",
    /if \(rest\.route === "general"\) \{\n\s*const strayActs: unknown =/.test(code));
  check("일반 전환 stray 값을 한 번만 읽는다", /const strayActs: unknown = \(rest as \{ priorAnnualTreatmentActCount\?: unknown \}\)\.priorAnnualTreatmentActCount;/.test(code));
  const rcSrc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  const rcCode = rcSrc.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  // ⚠ 앵커를 갱신했다(G-31). 기존 의미는 "G-28이 넣은 `priorAnnualTreatmentActCount`가
  //   **기존 13개 키 뒤**에 있어 그 키들의 안내 우선순위가 유지된다"였다. G-31이 같은 이유로
  //   `nhisCoinsuranceRate`를 그 뒤에 붙였으므로, "맨 끝"이 아니라 **직전 키 바로 뒤**를
  //   고정한다 — 지키려던 것(앞선 키들을 밀어내지 않는다)은 그대로다.
  check("상급병실료 미사용 키 목록에서 승인 구간 축이 기존 13개 뒤에 있다",
    /"priorAnnualOutpatientDays",\s*\n\s*"priorAnnualTreatmentActCount",/.test(rcCode), "직전 키 뒤 아님");
  check("G-31의 nhisCoinsuranceRate가 그 뒤이자 목록 맨 끝이다",
    /"priorAnnualTreatmentActCount",\s*\n\s*"nhisCoinsuranceRate",\s*\n\] as const;/.test(rcCode), "목록 끝 아님");
  check("상급병실료 미사용 키 루프가 한 번만 읽는다",
    /const got: unknown = raw\[key\];\n\s*if \(got !== undefined\) return rejected\(`상급병실료 차액 계산에 쓰이지 않는 입력\(\$\{key\}\)`, got\);/.test(rcCode));
  const mcSrc = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const mcCode = mcSrc.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("다회 stray 루프도 한 번만 읽는다",
    /for \(const stray of SPECIAL_ITEM_ONLY_KEYS\) \{\n\s*const got = readCount\(input, stray\);\n\s*if \(got === undefined\) continue;/.test(mcCode));
  check("다회 목록에 이 키가 그대로 있다", /"priorAnnualTreatmentActCount"/.test(mcCode));
  // 축 교차 금지.
  check("승인 축과 보상 횟수 축을 서로 대신 쓰지 않는다",
    !/priorActs = .*priorAnnualCoveredCount/.test(code) && !/count = priorActs/.test(code)
    && /const maxCount = priorActs/.test(code));
  // 안내가 약관 의미를 단정하지 않는다.
  // ⚠ **안내 문구만** 본다. 주석이 "약관상 독립 소진 여부는 단정하지 않는다"처럼 그 표현을
  //   인용하는 것은 정상이므로, 주석을 걷어낸 실행 코드에서 검사한다(G-24b에서 겪은 오탐).
  for (const banned of ["약관상 독립", "독립적으로 소진", "약관이 정한 별개", "약관상 무관", "약관상 서로 무관"]) {
    check(`안내에 확인되지 않은 약관 의미 "${banned}" 없음`, !code.includes(banned) && !rcCode.includes(banned));
  }
  check("새 안내가 역할과 올바른 입력 경로만 말한다",
    code.includes("중증 근골격계 이학요법·체외충격파의 보상 승인 구간 전용입니다. 이 조합은 일반 상해·질병 비급여 산식으로 계산하므로 쓰이지 않습니다"));
}

console.log(`\n[G-28 승인 구간 전용 축의 경로별 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
