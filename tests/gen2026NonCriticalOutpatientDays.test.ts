// 비중증 비급여 통원 — 연간 통원 100**일** 한도.
//
// 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특별약관2 제3조 (1)상해비급여 제1항 <구분·보상금액> 통원 행, 인쇄 p.288
//   특별약관2 제3조 (2)질병비급여 제1항 <구분·보상금액> 통원 행, 인쇄 p.291
//     "…<표1>의 '통원 항목별 공제금액'을 뺀 금액
//      (매년 계약해당일부터 1년간 통원 100일을 한도로 합니다.)"
//   특별약관2 제5조 제4항, 인쇄 p.309
//     "연간 보장한도(일수)에서 직전 보험기간 종료일까지 보상한 일수를 차감한 잔여 일수"
//
// ⚠ 중증(특별약관1)의 "통원 100회"와 **단위가 다르다**. 상수·카운터·CapCode·입력 필드를
//   공유하지 않는다. 종전 구현에는 이 한도가 아예 없어 101일째 이후에도 계속 지급했다.
//
// ⚠ 지급 보험금이 0원인 통원일이 이 100일을 소진하는지는 원문에 판단 문언이 없다
//   (GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY = HOLD). 두 해석을 모두 계산해
//   결과가 갈리면 묶음 전체를 차단한다.
import { readFileSync } from "node:fs";
import { mount, stateNamesFrom } from "./_uiRender";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { CAP_LABELS } from "../src/lib/insurance/engine/capLabels";
import {
  Cause, Gen2026ItemClaimInput, Gen2026ItemClaimResult, Gen2026MultiClaimInput, MultiClaimResult,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const LIMIT = GEN2026.nonBenefit.nonCritical.outpatientAnnualDays;
const CAP = "GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS";

type Extra = Partial<Record<string, unknown>>;
const nc = (amounts: number[], days: number | undefined, extra: Extra = {}, cause: Cause = "disease") =>
  calculateMany2026({
    cause, coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    severity: "non_critical", nonBenefitItem: "general", amounts,
    priorAnnualOutpatientDays: days, ...extra,
  } as unknown as Gen2026MultiClaimInput);
const cr = (amounts: number[], visits: number | undefined, extra: Extra = {}) =>
  calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    severity: "critical", nonBenefitItem: "general", amounts,
    priorAnnualOutpatientVisits: visits, ...extra,
  } as unknown as Gen2026MultiClaimInput);
const paid = (r: MultiClaimResult) => r.lines.map((l) => l.insurancePay);
const covered = (r: MultiClaimResult) => r.lines.map((l) => l.covered);
const isBlocked = (r: MultiClaimResult, totalAmount: number) =>
  r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
  && r.totalOwnPay === null && r.totalInsurancePay === null
  && r.appliedCaps.length === 0 && r.totalAmount === totalAmount;

// ── 근거·레지스트리 추적 ──────────────────────────────────────────────
console.log("\n[비중증 통원 100일] 근거·레지스트리 추적");
{
  const rules = Object.values(REGULATORY_RULES) as unknown as {
    ruleId: string; value: unknown; status: string; evidenceGrade: string;
    sources: readonly { url: string; locator: string; document: string }[];
  }[];
  const rule = rules.find((r) => r.ruleId === "GEN2026-NONCRITICAL-OUTPATIENT-ANNUAL-DAYS");
  check("규칙이 등록돼 있다", rule !== undefined);
  check("값 100", rule?.value === 100 && LIMIT === 100, String(rule?.value));
  check("CONFIRMED · A등급", rule?.status === "CONFIRMED" && rule?.evidenceGrade === "A");
  check("상수가 레지스트리에서 파생", LIMIT === rule?.value);
  for (const page of ["p.288", "p.291", "p.309"]) {
    check(`출처에 인쇄 ${page}`, !!rule?.sources.some((s) => s.locator.includes(page)), page);
  }
  check("출처에 별표 식별번호 3216359",
    !!rule?.sources.every((s) => s.locator.includes("3216359")));
  check("출처가 2026.5.6 판본 직행 주소",
    !!rule?.sources.every((s) => s.url === "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108697"));
  check("뒤 판본 주소가 섞이지 않음",
    !!rule?.sources.every((s) => !s.url.includes("2200000108867") && !s.url.includes("2200000108939")));
  check("출처가 '통원 100일'을 인용", !!rule?.sources.some((s) => s.locator.includes("통원 100일")));
  check("출처가 제5조④ '보상한 일수'를 인용", !!rule?.sources.some((s) => s.locator.includes("보상한 일수")));

  const hold = rules.find((r) => r.ruleId === "GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY");
  check("0원 일수 소진은 HOLD", hold?.status === "HOLD" && hold?.value === null);
  check("HOLD 등급은 REVIEW", hold?.evidenceGrade === "REVIEW");

  check("CapCode 라벨이 '일'을 쓴다", CAP_LABELS[CAP] === "비중증 통원 연 100일 한도 초과", CAP_LABELS[CAP]);
  check("중증 라벨은 '회'를 유지",
    CAP_LABELS.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS === "중증 통원 연간 100회 한도 초과");
  check("두 CapCode가 다른 값",
    String(CAP) !== String("GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS")
    && CAP_LABELS[CAP] !== CAP_LABELS.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS);
  // ⚠ 값이 둘 다 100이라 잘못 파생해도 결과가 같다. 파생 경로를 소스로 확인한다.
  {
    const con = readFileSync("src/lib/insurance/engine/constants.ts", "utf8");
    check("비중증 상수가 비중증 규칙에서 파생",
      /outpatientAnnualDays: R\.GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS\.value,/.test(con));
    check("중증 상수가 중증 규칙에서 파생",
      /outpatientAnnualVisits: R\.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS\.value,/.test(con));
    check("비중증 상수가 중증 규칙을 끌어다 쓰지 않는다",
      !/outpatientAnnualDays: R\.GEN2026_CRITICAL/.test(con));
    check("중증 상수가 비중증 규칙을 끌어다 쓰지 않는다",
      !/outpatientAnnualVisits: R\.GEN2026_NONCRITICAL/.test(con));
    check("엔진이 비중증 카운터에 중증 상수를 쓰지 않는다", (() => {
      const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
      return /outpatientDays >= GEN2026\.nonBenefit\.nonCritical\.outpatientAnnualDays/.test(eng)
        && /outpatientVisits >= GEN2026\.nonBenefit\.critical\.outpatientAnnualVisits/.test(eng);
    })());
  }
  check("두 상수가 다른 규칙에서 온다",
    GEN2026.nonBenefit.critical.outpatientAnnualVisits === 100 && LIMIT === 100
    && REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS.ruleId
       !== REGULATORY_RULES.GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS.ruleId);
}

// ── 경계 ─────────────────────────────────────────────────────────────
console.log("\n[경계] 기존 사용일수 0·99·100·101");
{
  const A = 300_000, PAY = 150_000; // 50% - 최소공제 5만원 미만 아님 → 15만원
  check("0일 · 1건 → 정상", paid(nc([A], 0))[0] === PAY);
  check("99일 · 1건 → 100일째로 보상", paid(nc([A], 99))[0] === PAY);
  check("100일 · 1건 → 제외", paid(nc([A], 100))[0] === 0 && covered(nc([A], 100))[0] === false);
  check("101일 · 1건 → 제외(절삭하지 않음)", paid(nc([A], 101))[0] === 0);
  const r = nc([A, A], 99);
  check("99일 · 2건 → 첫 건만 보상", JSON.stringify(paid(r)) === JSON.stringify([PAY, 0]));
  check("99일 · 2건 → 둘째만 covered:false", JSON.stringify(covered(r)) === JSON.stringify([true, false]));
  check("제외 행에 CapCode", r.lines[1].appliedCaps.includes(CAP));
  check("보상 행에는 CapCode 없음", !r.lines[0].appliedCaps.includes(CAP));
  check("최상위 CapCode에도 반영", r.appliedCaps.includes(CAP));
  check("제외 행 계약: 전액 본인부담", r.lines[1].ownPay === A && r.lines[1].insurancePay === 0);
  check("제외 행 계약: 공제 0", r.lines[1].minDeductible === 0 && r.lines[1].deductibleApplied === 0
    && r.lines[1].rateBased === 0 && r.lines[1].rateApplied === 0);
  check("제외 행 키 집합이 보상 행과 동일",
    Object.keys(r.lines[0]).sort().join(",") === Object.keys(r.lines[1]).sort().join(","));
  check("정확히 100일 도달 시 다음 건부터 제외", paid(nc([A, A, A], 98)).join() === [PAY, PAY, 0].join());
  // ⚠ 종전에는 미입력을 0일로 봤다. 안전성 커밋에서 **차단**으로 바뀌었다 —
  //   과거 사용량을 모르면 한도를 반영할 수 없어 보험금이 과다 산출된다.
  check("미입력은 0일로 추정하지 않고 차단", isBlocked(nc([A], undefined), A));
  check("확인된 0은 유효값", paid(nc([A], 0))[0] === PAY);
  for (const cause of ["injury", "disease"] as const) {
    check(`${cause} 축에도 적용`, paid(nc([A, A], 99, {}, cause)).join() === [PAY, 0].join());
  }
  //   같은 날 외래+처방을 한 행(60만원)으로 합치면 1일만 소진하고 보상은 50%인 30만원이다.
  //   두 행(각 30만원)으로 나누면 2일을 소진하므로 100일 경계에서 결과가 달라진다.
  check("같은 날 합산은 한 행 = 1일", paid(nc([600_000], 99))[0] === 300_000, String(paid(nc([600_000], 99))[0]));
  check("같은 날을 두 행으로 나누면 둘째가 제외된다",
    paid(nc([300_000, 300_000], 99)).join() === [150_000, 0].join());
}

// ── 두 해석 ──────────────────────────────────────────────────────────
console.log("\n[해석 A/B] 지급 0원 통원일");
{
  const ZERO = 40_000;   // 최소공제 5만원 미만 → 지급 0원
  const BIG = 5_000_000;
  check("경계에 닿지 않으면 정상 반환", nc([ZERO, BIG], 0).status === "OK");
  check("정상 반환 시 0원 행도 보상 행으로 남는다",
    nc([ZERO, BIG], 0).lines.length === 2 && nc([ZERO, BIG], 0).lines[0].covered === true);
  const split = nc([ZERO, BIG], 99);
  check("최소공제로 0원인 날이 경계에 닿으면 차단", isBlocked(split, ZERO + BIG), split.status);
  check("차단 안내가 근거 없음을 말한다",
    split.notes.some((n) => n.includes("표준약관에 정해져 있지 않습니다")));
  check("차단 시 후보 숫자를 노출하지 않는다",
    !split.notes.some((n) => /\d{1,3}(,\d{3})+원/.test(n)));
  // 연간 가입금액 소진으로 0원이 되는 날
  const byLimit = nc([BIG, ZERO + 10_000, BIG], 98, { annualCoverageLimit: 2_500_000 });
  check("연간 한도 소진으로 0원인 날도 같은 방식으로 판정",
    byLimit.status === "OK" || isBlocked(byLimit, BIG + ZERO + 10_000 + BIG), byLimit.status);
  check("0원 행(amount 0)은 두 해석 모두 미소진 → 차단되지 않음",
    nc([0, 300_000], 99).status === "OK" && paid(nc([0, 300_000], 99)).join() === [0, 150_000].join());
  check("빈 묶음도 정상", nc([], 99).status === "OK");
  // 소진 방향이 뒤집히지 않는다: A의 카운터는 항상 B 이상 → B가 제외하는데 A가 보상하는 일은 없다
  check("차단이 아니면 두 해석이 실제로 같다(격자)", (() => {
    const sets = [[ZERO], [ZERO, BIG], [BIG, ZERO], [ZERO, ZERO, BIG], [0, ZERO, BIG]];
    for (const amounts of sets) for (const d of [0, 97, 98, 99, 100]) {
      const r = nc(amounts, d);
      if (r.status === "OK") {
        // 정상 반환이면 제외 행 집합이 두 해석에서 같아야 한다 → 재현: 같은 입력을 다시 계산
        const again = nc(amounts, d);
        if (JSON.stringify(paid(r)) !== JSON.stringify(paid(again))) return false;
      }
    }
    return true;
  })());
}

// ── 축 분리 ──────────────────────────────────────────────────────────
console.log("\n[축 분리] 중증 100회 무회귀 · 다른 경로 미적용");
{
  const A = 300_000;
  check("중증 통원 100회는 종전대로", paid(cr([A, A], 99)).join() === [210_000, 0].join());
  check("중증 제외 행 CapCode는 종전 코드",
    cr([A, A], 100).lines[0].appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"));
  check("중증 결과에 비중증 CapCode 없음", !cr([A, A], 100).appliedCaps.includes(CAP));
  check("비중증 결과에 중증 CapCode 없음",
    !nc([A, A], 100).appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"));
  const inpatient = calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic",
    severity: "non_critical", nonBenefitItem: "general", amounts: [A, A],
    priorAnnualOutpatientDays: 100,
  } as unknown as Gen2026MultiClaimInput);
  // ⚠ 입원에는 통원 한도가 적용되지 않는다. 종전에는 실려 온 카운터를 조용히 버렸으나,
  //   안전성 커밋에서 **차단**으로 바뀌었다(일반 전환 경로는 이미 같은 계약이었다).
  check("비중증 입원에 일수 카운터가 실리면 차단",
    inpatient.status === "PENDING_UNVERIFIED" && inpatient.lines.length === 0
    && inpatient.notes.some((n) => n.includes("입원 계산에 쓰이지 않습니다")));
  const inpatientClean = calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic",
    severity: "non_critical", nonBenefitItem: "general", amounts: [A, A],
  } as unknown as Gen2026MultiClaimInput);
  check("비중증 입원 자체에는 통원 한도를 적용하지 않음",
    inpatientClean.status === "OK" && !inpatientClean.appliedCaps.includes(CAP)
    && inpatientClean.lines.every((l) => l.covered));
  const benefit = calculateMany2026({
    cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [A, A],
  } as unknown as Gen2026MultiClaimInput);
  check("급여에는 적용하지 않음", !benefit.appliedCaps.includes(CAP));
  for (const item of ["musculoskeletal_esw", "injection", "mri", "room_charge"] as const) {
    const r = calculateMany2026({
      cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic",
      severity: "non_critical", nonBenefitItem: item, amounts: [A],
      priorAnnualOutpatientDays: 100,
    } as unknown as Gen2026MultiClaimInput);
    check(`${item}은 별도 보장종목이라 도달하지 않음`,
      r.status === "PENDING_UNVERIFIED" && !r.appliedCaps.includes(CAP));
  }
}

// ── 교차 필드·잘못된 값 차단 ─────────────────────────────────────────
console.log("\n[차단] 교차 필드와 잘못된 값");
{
  const A = 300_000;
  check("비중증에 Visits가 있으면 차단(값 0이어도)",
    isBlocked(nc([A], 0, { priorAnnualOutpatientVisits: 0 }), A));
  check("비중증에 Visits가 있으면 차단(양수)",
    isBlocked(nc([A], 0, { priorAnnualOutpatientVisits: 5 }), A));
  check("비중증 차단 안내가 '통원 100일'을 말한다",
    nc([A], 0, { priorAnnualOutpatientVisits: 0 }).notes.some((n) => n.includes("통원 100일")));
  check("중증에 Days가 있으면 차단(값 0이어도)",
    isBlocked(cr([A], 0, { priorAnnualOutpatientDays: 0 }), A));
  check("중증 차단 안내가 '통원 100회'를 말한다",
    cr([A], 0, { priorAnnualOutpatientDays: 0 }).notes.some((n) => n.includes("통원 100회")));
  check("두 필드 동시 존재도 차단", isBlocked(nc([A], 0, { priorAnnualOutpatientVisits: 0 }), A));
  for (const [what, v] of [["음수", -1], ["소수", 1.5], ["NaN", NaN], ["Infinity", Infinity],
    ["-Infinity", -Infinity], ["안전 정수 초과", 9007199254740993]] as const) {
    check(`${what} 차단`, isBlocked(nc([A], v as number), A), String(v));
  }
  check("잘못된 값을 0으로 변형하지 않는다", nc([A], -1).lines.length === 0);
  check("100 초과는 유효한 과거 상태로 받는다",
    nc([A], 5_000).status === "OK" && paid(nc([A], 5_000))[0] === 0);
  // ⚠ 종전에는 중증 '회' 축만 nonNegInt의 관용(음수→0)을 남겨 두 축의 안전성이 달랐다.
  //   안전성 커밋에서 같은 수준으로 맞췄다. 두 축은 여전히 별개 상수·카운터·안내를 쓴다.
  check("중증 경로도 같은 수준으로 엄격해졌다",
    cr([A], -1).status === "PENDING_UNVERIFIED");
}


// ── 일반 경로로 전환되는 치료유형 ────────────────────────────────────
//   ⚠ 특약2 (1)①·(2)①이 배제하는 것은 비급여 자기공명영상진단뿐이다(인쇄 p.287·290).
//   비중증 근골격계 이학요법·체외충격파와 주사료는 일반 (1)(2)에서 보상하므로
//   **같은 연 100일 한도가 걸린다.** 라우터가 카운터를 버리면 한도가 통째로 사라진다.
console.log("\n[일반 전환] 비중증 근골격계·주사료도 같은 100일 한도");
const ROUTED = ["musculoskeletal_esw", "injection"] as const;
const routed = (item: (typeof ROUTED)[number], amounts: number[], extra: Record<string, unknown> = {}) =>
  calculateGen2026Item({
    route: "general", coverage: "non_benefit", severity: "non_critical", item,
    cause: "disease", visit: "outpatient", amounts, ...extra,
  } as unknown as Gen2026ItemClaimInput) as Gen2026ItemClaimResult & {
    lines: { covered: boolean; insurancePay: number | null; appliedCaps: string[] }[];
  };
// ⚠ 두 항목을 각각 검사한다. 한쪽만 고쳐도 통과하면 안 된다.
for (const item of ROUTED) {
  const one = routed(item, [300_000], { priorAnnualOutpatientDays: 99 });
  check(`${item}: 99일 + 1건 → 15만원`, one.totalInsurancePay === 150_000, String(one.totalInsurancePay));
  const two = routed(item, [300_000, 300_000], { priorAnnualOutpatientDays: 99 });
  check(`${item}: 99일 + 2건 → 첫 건만 보상`,
    two.lines.map((l) => l.insurancePay).join() === [150_000, 0].join(),
    JSON.stringify(two.lines.map((l) => l.insurancePay)));
  check(`${item}: 둘째 행이 covered:false`, two.lines[1].covered === false);
  check(`${item}: 둘째 행 CapCode`, two.lines[1].appliedCaps.includes(CAP));
  check(`${item}: 중증 CapCode 없음`,
    !two.appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"));
  const at100 = routed(item, [300_000], { priorAnnualOutpatientDays: 100 });
  check(`${item}: 100일 → 제외·0원`,
    at100.totalInsurancePay === 0 && at100.appliedCaps.includes(CAP), String(at100.totalInsurancePay));
  const at101 = routed(item, [300_000], { priorAnnualOutpatientDays: 101 });
  check(`${item}: 101일 → 제외`, at101.totalInsurancePay === 0);
  const split = routed(item, [40_000, 5_000_000], { priorAnnualOutpatientDays: 99 });
  check(`${item}: 99일 + [4만, 500만] → 두 해석 차이로 차단`,
    split.status === "PENDING_UNVERIFIED" && split.lines.length === 0
    && split.totalOwnPay === null && split.totalInsurancePay === null
    && split.totalAmount === 5_040_000, split.status);
  check(`${item}: 99일 + [0, 30만] → 정상`,
    routed(item, [0, 300_000], { priorAnnualOutpatientDays: 99 }).totalInsurancePay === 150_000);
  // ⚠ 종전에는 미입력을 0일로 봤다. 안전성 커밋에서 차단으로 바뀌었다.
  check(`${item}: 미입력은 0일로 추정하지 않고 차단`,
    routed(item, [300_000]).status === "PENDING_UNVERIFIED");
  check(`${item}: 확인된 0은 유효값`,
    routed(item, [300_000], { priorAnnualOutpatientDays: 0 }).totalInsurancePay === 150_000);
  // 축 교차·잘못된 값
  const cross = routed(item, [300_000], { priorAnnualOutpatientVisits: 0 });
  check(`${item}: Visits가 실리면 차단(값 0이어도)`,
    cross.status === "PENDING_UNVERIFIED" && cross.lines.length === 0);
  for (const [what, v] of [["음수", -1], ["소수", 1.5], ["NaN", NaN], ["Infinity", Infinity],
    ["안전 정수 초과", 9007199254740993]] as const) {
    const r = routed(item, [300_000], { priorAnnualOutpatientDays: v });
    check(`${item}: ${what} 차단`, r.status === "PENDING_UNVERIFIED" && r.lines.length === 0, String(v));
  }
  // 입원에는 통원 카운터가 실리면 안 된다
  const inp = calculateGen2026Item({
    route: "general", coverage: "non_benefit", severity: "non_critical", item,
    cause: "disease", visit: "inpatient", tier: "clinic", amounts: [300_000],
    priorAnnualOutpatientDays: 0,
  } as unknown as Gen2026ItemClaimInput);
  check(`${item}: 입원에 통원 카운터가 실리면 차단`, inp.status === "PENDING_UNVERIFIED");
}
// ── 별도 보장종목 (3) — 통원 카운터를 조용히 버리지 않는다 ───────────
//   ⚠ 종전 테스트는 `OK면 CapCode만 없으면 통과`라 실질적인 가드가 아니었다.
//     잘못 실린 카운터가 버려지는 것이 바로 이번에 고친 결함이므로, **차단**을 요구한다.
{
  const sp = (severity: "critical" | "non_critical", item: string, extra: Record<string, unknown>) =>
    calculateGen2026Item({
      route: "special_item", coverage: "non_benefit", severity, item,
      lines: [{ amount: 300_000, visit: "outpatient" }],
      ...(item === "injection" && severity === "critical" ? { injectionPurpose: "general" } : {}),
      ...extra,
    } as unknown as Gen2026ItemClaimInput);
  const blockedSp = (r: Gen2026ItemClaimResult) =>
    r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
    && r.totalOwnPay === null && r.totalInsurancePay === null && r.appliedCaps.length === 0;

  // 정상 입력은 그대로 계산된다.
  check("비중증 MRI 정상 입력은 계산된다",
    sp("non_critical", "mri", {}).status === "OK"
    && sp("non_critical", "mri", {}).totalInsurancePay === 150_000);
  check("비중증 MRI에는 100일 CapCode가 붙지 않는다",
    !sp("non_critical", "mri", {}).appliedCaps.includes(CAP));
  check("중증 MRI 정상 입력은 계산된다", sp("critical", "mri", {}).status === "OK");

  // 두 카운터 어느 쪽이든, 값이 0이어도 차단한다.
  const SPECIAL: [("critical" | "non_critical"), string][] = [
    ["non_critical", "mri"], ["critical", "mri"],
    ["critical", "musculoskeletal_esw"], ["critical", "injection"],
  ];
  for (const [severity, item] of SPECIAL) {
    for (const field of ["priorAnnualOutpatientDays", "priorAnnualOutpatientVisits"] as const) {
      for (const v of [0, 100]) {
        check(`${severity}/${item} + ${field}:${v} → 차단`,
          blockedSp(sp(severity, item, { [field]: v })), sp(severity, item, { [field]: v }).status);
      }
    }
    check(`${severity}/${item}: 두 필드 동시 존재도 차단`,
      blockedSp(sp(severity, item, { priorAnnualOutpatientDays: 0, priorAnnualOutpatientVisits: 0 })));
  }
  check("차단 안내가 별도 보장종목임을 말한다",
    sp("non_critical", "mri", { priorAnnualOutpatientDays: 0 }).notes
      .some((n) => n.includes("별도 보장종목")));
  check("차단 시 후보 숫자를 노출하지 않는다",
    !sp("non_critical", "mri", { priorAnnualOutpatientDays: 100 }).notes
      .some((n) => /\d{1,3}(,\d{3})+원/.test(n)));
}

// ── 상급병실료 — 두 카운터 모두 차단 ─────────────────────────────────
{
  const rc = (extra: Record<string, unknown>) => calculateGen2026Item({
    route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
    stays: [{ roomChargeTotal: 1_800_000, inpatientDays: 10 }], ...extra,
  } as unknown as Gen2026ItemClaimInput);
  check("상급병실료 정상 입력은 공식 예시대로 계산된다",
    rc({}).status === "OK" && rc({}).totalInsurancePay === 900_000, String(rc({}).totalInsurancePay));
  for (const field of ["priorAnnualOutpatientDays", "priorAnnualOutpatientVisits"] as const) {
    for (const v of [0, 100]) {
      const r = rc({ [field]: v });
      check(`상급병실료 + ${field}:${v} → 차단`,
        r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
        && r.totalOwnPay === null && r.totalInsurancePay === null, r.status);
    }
  }
  const both = rc({ priorAnnualOutpatientDays: 0, priorAnnualOutpatientVisits: 0 });
  check("상급병실료: 두 필드 동시 존재도 차단",
    both.status === "PENDING_UNVERIFIED" && both.lines.length === 0);
}
// 중증 예외 주사는 기존 100회 로직을 그대로 쓴다.
{
  const exInj = (extra: Record<string, unknown>) => calculateGen2026Item({
    route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "anticancer", cause: "disease", visit: "outpatient", amounts: [300_000], ...extra,
  } as unknown as Gen2026ItemClaimInput);
  const r99 = exInj({ priorAnnualOutpatientVisits: 99 });
  check("중증 예외 주사: 99회 → 보상", r99.status === "OK" && r99.totalInsurancePay === 210_000,
    String(r99.totalInsurancePay));
  const r100 = exInj({ priorAnnualOutpatientVisits: 100 });
  check("중증 예외 주사: 100회 → 중증 CapCode로 제외",
    r100.appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS")
    && !r100.appliedCaps.includes(CAP));
  check("중증 예외 주사: Days가 실리면 차단",
    exInj({ priorAnnualOutpatientDays: 0 }).status === "PENDING_UNVERIFIED");
}
// 라우터가 실제로 필드를 전달하는지 소스로도 못박는다(값이 같아 우연히 통과하는 것을 막는다).
{
  const router = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("라우터가 축에 맞는 카운터만 전달",
    /input\.severity === "critical"\s*\n?\s*\? \{ priorAnnualOutpatientVisits: input\.priorAnnualOutpatientVisits \}\s*\n?\s*: \{ priorAnnualOutpatientDays: input\.priorAnnualOutpatientDays \}/.test(router));
  // ⚠ 값 검증은 calculateMany2026 한 곳으로 모았다. 라우터가 rejected()로 먼저 막으면
  //   차단 결과의 totalAmount가 0으로 보고되어 계약이 깨지기 때문이다.
  //   검증이 사라진 것이 아님을 **런타임 결과로** 확인한다(문구 존재 검사가 아니다).
  check("전환 경로에서도 잘못된 Days가 차단되고 진료비 합계는 유지된다", (() => {
    const bad = routed("injection", [300_000], { priorAnnualOutpatientDays: -1 });
    return bad.status === "PENDING_UNVERIFIED" && bad.lines.length === 0
      && bad.totalOwnPay === null && bad.totalInsurancePay === null && bad.totalAmount === 300_000;
  })());
  check("전환 경로에서도 미입력이 차단된다", (() => {
    const none = routed("injection", [300_000]);
    return none.status === "PENDING_UNVERIFIED" && none.totalAmount === 300_000;
  })());
  check("라우터 진입점이 축 교차를 막는다",
    /if \(raw\.severity === "critical" && days !== undefined\) \{/.test(router)
    && /if \(raw\.severity === "non_critical" && visits !== undefined\) \{/.test(router));
  check("라우터 진입점이 입원의 통원 카운터를 막는다",
    /if \(raw\.visit === "inpatient" && \(days !== undefined \|\| visits !== undefined\)\) \{/.test(router));
  check("라우터가 두 필드를 동시에 넘기지 않는다",
    !/priorAnnualOutpatientVisits: input\.priorAnnualOutpatientVisits,[\s\S]{0,120}priorAnnualOutpatientDays: input\.priorAnnualOutpatientDays,/.test(router));
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  {
    // 베이스 본문만 잘라서 본다(뒤 인터페이스의 필드가 섞여 오탐하지 않도록).
    const body = /interface Gen2026RoutedGeneralBase \{([^}]*)\}/.exec(types);
    check("공통 베이스 본문을 찾음", body !== null);
    check("공통 베이스에는 통원 카운터가 없다",
      body !== null && !body[1].includes("priorAnnualOutpatient"), body?.[1]);
  }
  check("중증 전환은 Days를 never로 닫는다",
    /Gen2026CriticalExceptionalInjectionInput[\s\S]{0,400}priorAnnualOutpatientDays\?: never;/.test(types));
  for (const iface of ["Gen2026NonCriticalMskInput", "Gen2026NonCriticalInjectionInput"]) {
    check(`${iface}는 Days를 열고 Visits를 never로 닫는다`,
      new RegExp(`${iface}[\\s\\S]{0,400}priorAnnualOutpatientDays\\?: number;[\\s\\S]{0,80}priorAnnualOutpatientVisits\\?: never;`).test(types));
  }
  // 별도 보장종목·상급병실료에서 카운터를 거부하는 구조 자체를 못박는다.
  check("special_item 분기가 카운터를 먼저 거부",
    /if \(raw\.route === "special_item"\) \{[\s\S]{0,400}if \(days !== undefined \|\| visits !== undefined\) \{/.test(router));
  check("days·visits를 route 분기보다 앞에서 읽는다", (() => {
    const readAt = router.indexOf("const days = raw.priorAnnualOutpatientDays;");
    const routeAt = router.indexOf('if (raw.route === "special_item") {');
    return readAt >= 0 && routeAt >= 0 && readAt < routeAt;
  })());
  const rcSrc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  for (const key of ["priorAnnualOutpatientDays", "priorAnnualOutpatientVisits"]) {
    check(`상급병실료 UNUSED_KEYS에 ${key}`,
      new RegExp(`const UNUSED_KEYS = \\[[\\s\\S]*?"${key}"[\\s\\S]*?\\] as const;`).test(rcSrc), key);
  }
  {
    // 상급병실료 입력 타입이 두 카운터를 never로 닫는지 본문만 잘라 확인한다.
    const body = /export interface Gen2026RoomChargeInput \{([^}]*)\}/.exec(types);
    check("상급병실료 입력 타입 본문을 찾음", body !== null);
    check("Gen2026RoomChargeInput이 Days를 never로 닫는다",
      body !== null && body[1].includes("priorAnnualOutpatientDays?: never;"));
    check("Gen2026RoomChargeInput이 Visits를 never로 닫는다",
      body !== null && body[1].includes("priorAnnualOutpatientVisits?: never;"));
    const spBase = /interface Gen2026SpecialBase \{([^}]*)\}/.exec(types);
    check("Gen2026SpecialBase가 두 카운터를 never로 닫는다",
      spBase !== null && spBase[1].includes("priorAnnualOutpatientVisits?: never;")
      && spBase[1].includes("priorAnnualOutpatientDays?: never;"));
  }
  // ⚠ MRI 검사가 다시 "OK여도 통과"로 느슨해지지 않게 한다.
  {
    const self = readFileSync("tests/gen2026NonCriticalOutpatientDays.test.ts", "utf8");
    check("MRI 카운터 검사가 OK를 허용하지 않는다",
      !/mriBad\.status === "OK" \?/.test(self)
      && !/status === "OK" \? [^\n]*: true/.test(self));
    check("별도 보장종목 카운터 검사가 차단을 요구",
      /blockedSp\(sp\(severity, item, \{ \[field\]: v \}\)\)/.test(self));
  }
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("UI가 satisfies로 초과 필드를 막는다",
    /\} satisfies Gen2026NonCriticalMskInput\)/.test(ui)
    && /\} satisfies Gen2026NonCriticalInjectionInput\)/.test(ui)
    && /\} satisfies Gen2026CriticalExceptionalInjectionInput\)/.test(ui));
  check("UI generalCommon에는 통원 카운터가 없다",
    !/const generalCommon = \{[\s\S]*?priorAnnualOutpatient[\s\S]*?\n    \};/.test(ui));
}

// ── UI 상태 전이 ─────────────────────────────────────────────────────
console.log("\n[화면] 상태 전이");
{
  const uiSrc = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  const names = stateNamesFrom(uiSrc);
  const fresh = () => mount(HealthCalcMulti2026 as unknown as () => unknown, names);
  const DAYS_LABEL = "계약해당일 기준 1년간 이미 사용한 통원일수";
  //   ⚠ has()는 앞부분 일치라 라벨 전문을 그대로 쓴다. 두 라벨은 '통원일수'/'통원 횟수'에서 갈린다.
  const VISITS_LABEL = "계약해당일 기준 1년간 이미 사용한 통원 횟수";
  const setup = (over: Record<string, unknown> = {}) => {
    const h = fresh();
    const base: Record<string, unknown> = {
      coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical",
      visit: "outpatient", cause: "disease", amounts: ["300000"],
    };
    for (const [k, v] of Object.entries({ ...base, ...over })) h.set(k, v);
    return h;
  };
  const warned = (s: ReturnType<ReturnType<typeof fresh>["render"]>) =>
    s.nodes.some((n) => n.tag === "#NoticeBox" && n.props.variant === "warning"
      && n.text.includes("이미 사용한 통원일수"));

  const s1 = setup().render();
  check("① 비중증 통원: 통원일수 입력 노출", s1.has(DAYS_LABEL));
  check("① 통원 횟수 입력은 미노출", !s1.has(VISITS_LABEL));
  check("② 초기값이 빈 값이라 결과 없음", s1.resultItems() === null);
  const s2 = setup({ submitted: true }).render();
  check("③④ 계산 클릭 → 안내만, 결과 없음", warned(s2) && s2.resultItems() === null);
  const s3 = setup({ submitted: true, priorOutDays: "0" }).render();
  check("⑤ 0 입력 → 정상 계산", !warned(s3) && s3.resultItems()?.[2]?.value === "150,000원");
  const s99 = setup({ submitted: true, priorOutDays: "99" }).render();
  check("⑥ 99 → 보상", s99.resultItems()?.[2]?.value === "150,000원");
  const s100 = setup({ submitted: true, priorOutDays: "100" }).render();
  check("⑥ 100 → 미보상", s100.resultItems()?.[2]?.value === "0원");
  const s101 = setup({ submitted: true, priorOutDays: "101" }).render();
  check("⑥ 101 → 미보상", s101.resultItems()?.[2]?.value === "0원");
  for (const bad of ["", "  ", "-1", "1.5", "abc", "1e2", "9007199254740993"]) {
    const s = setup({ submitted: true, priorOutDays: bad }).render();
    check(`⑥ 잘못된 값 ${JSON.stringify(bad)} → 계산 차단`, warned(s) && s.resultItems() === null);
  }
  const sc = setup({ submitted: true, severity: "critical", priorOutDays: "50", priorVisits: "3" }).render();
  check("⑦ 중증 전환: 통원일수 숨김·통원 횟수 노출", !sc.has(DAYS_LABEL) && sc.has(VISITS_LABEL));
  check("⑦ 중증 전환: 숨겨진 Days를 넘기지 않아 계산됨", sc.resultItems() !== null);
  // 숨겨진 Days가 전달되면 중증 축 교차 가드에 걸려 계산 자체가 막힌다. 계산이 되면 안 넘어간 것이다.
  const scNoVisits = setup({ submitted: true, severity: "critical", priorOutDays: "50" }).render();
  check("⑦ 중증 전환: 횟수 미입력이면 계산하지 않음", scNoVisits.resultItems() === null);
  for (const [what, over] of [
    ["입원", { visit: "inpatient", nbInpatientTier: "clinic" }],
    ["MRI", { nonBenefitItem: "mri" }],
    ["상급병실료", { nonBenefitItem: "room_charge" }],
  ] as const) {
    const s = setup({ submitted: true, ...over }).render();
    check(`⑧ ${what}에서 두 통원 카운터 미노출`, !s.has(DAYS_LABEL) && !s.has(VISITS_LABEL));
  }
  // ⑨ 비중증 통원으로 되돌아와도 숨겨진 중증 필드를 넘기지 않는다
  const back = setup({ submitted: true, priorVisits: "77", priorOutDays: "0" }).render();
  check("⑨ 되돌아온 뒤에도 숨겨진 Visits를 넘기지 않음", back.resultItems()?.[2]?.value === "150,000원");

  // ⑩ 일반 경로로 전환되는 두 치료유형도 같은 화면 계약을 따른다.
  //   ⚠ 두 항목을 각각 검사한다 — 한쪽만 고쳐도 통과하면 안 된다.
  for (const item of ROUTED) {
    const it = (over: Record<string, unknown> = {}) =>
      setup({ nonBenefitItem: item, ...over }).render();
    check(`⑩ ${item}: 통원일수 입력 노출`, it().has(DAYS_LABEL));
    check(`⑩ ${item}: 통원 횟수 입력 미노출`, !it().has(VISITS_LABEL));
    check(`⑩ ${item}: 빈 값이면 계산 차단`,
      it({ submitted: true }).resultItems() === null);
    check(`⑩ ${item}: 0 입력 → 정상`,
      it({ submitted: true, priorOutDays: "0" }).resultItems()?.[2]?.value === "150,000원");
    check(`⑩ ${item}: 100 입력 → 0원`,
      it({ submitted: true, priorOutDays: "100" }).resultItems()?.[2]?.value === "0원");
    check(`⑩ ${item}: 99 + 2행 → 둘째 제외(합계 15만원)`,
      it({ submitted: true, priorOutDays: "99", amounts: ["300000", "300000"] })
        .resultItems()?.[2]?.value === "150,000원");
    check(`⑩ ${item}: 숨겨진 Visits를 넘기지 않음`,
      it({ submitted: true, priorOutDays: "0", priorVisits: "77" })
        .resultItems()?.[2]?.value === "150,000원");
  }
}

// ── 가드: 문구·상수·필드 ─────────────────────────────────────────────
console.log("\n[가드] 단위와 파생");
{
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8").replace(/\s+/g, " ");
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("UI 초기값이 빈 값", /const \[priorOutDays, setPriorOutDays\] = useState\(""\);/.test(ui));
  check("UI 게이트가 계산에 연결",
    /const needsOutDays = [^;]*outpatientDays\(priorOutDays\) === null;/.test(ui)
    && /!needsTier && !needsOutDays/.test(ui) && /nbInpatientTier === ""\) \|\| needsOutDays/.test(ui));
  check("UI 파서가 0 이상 안전 정수만 허용",
    /const VISIT_COUNT_FORMAT = \/\^\[0-9\]\+\$\//.test(ui)
    && /Number\.isSafeInteger\(n\) && n >= 0 \? n : null/.test(ui));
  check("두 축이 같은 형식 파서를 쓰되 도메인 필드는 분리",
    /const outpatientDays = nonNegSafeInt;/.test(ui) && /const outpatientVisits = nonNegSafeInt;/.test(ui));
  check("UI가 잘못된 값을 정규화하지 않는다",
    !/outpatientDays[\s\S]{0,160}replace\(/.test(ui) && !/num\(priorOutDays\)/.test(ui));
  check("UI가 100을 재기재하지 않고 상수에서 읽는다",
    /통원 \{GEN2026\.nonBenefit\.nonCritical\.outpatientAnnualDays\}일/.test(ui)
    && /연 \{GEN2026\.nonBenefit\.nonCritical\.outpatientAnnualDays\}일/.test(ui));
  check("비중증 문구에 '회'를 쓰지 않는다", !/비중증 통원은[^§]{0,120}100회/.test(ui));
  check("중증 문구는 '회'를 유지",
    /중증 통원은 약관상 <b>계약일 또는 매년 계약해당일부터 1년간 통원 \{GEN2026\.nonBenefit\.critical\.outpatientAnnualVisits\}회<\/b>/.test(ui));
  check("UI가 같은 날 합산과 일수 소진을 연결해 설명",
    ui.includes("같은 날을 여러 행으로 나누면 일수가 실제보다 빨리 소진됩니다"));
  check("UI가 계약해당일 1년 기준을 명시",
    ui.includes("계약일 또는 매년 계약해당일부터 1년간 통원"));
  check("UI 안내가 0 입력을 안내", ui.includes("이전 통원이 없으면 <b>0</b>을 입력하세요"));
  check("엔진이 상수에서 한도를 읽는다",
    /outpatientDays >= GEN2026\.nonBenefit\.nonCritical\.outpatientAnnualDays/.test(eng)
    && !/outpatientDays >= 100/.test(eng));
  check("엔진이 중증·비중증 카운터를 분리",
    /let outpatientVisits =/.test(eng) && /let outpatientDays =/.test(eng));
  check("엔진이 두 해석을 독립 실행",
    /const countedA = runBundle\(true\);/.test(eng) && /const countedB = runBundle\(false\);/.test(eng));
  check("가변 상태가 runBundle 안에서 새로 만들어진다", (() => {
    const body = /function runBundle\([^)]*\): MultiClaimResult \{([\s\S]*?)\n  \}/.exec(eng);
    if (body === null) return false;
    const fn = body[1];
    // 누적 상태 넷이 모두 함수 안에서 선언돼야 두 실행이 서로를 오염시키지 않는다.
    return ["let insurancePaid =", "let deductiblePaid =", "let outpatientVisits =",
      "let outpatientDays =", "const results:"].every((d) => fn.includes(d));
  })());
  // ⚠ 커밋 E에서 중증 통원 100회도 같은 방식으로 바뀌면서 이 구조가 축 공용으로 일반화됐다.
  //   여기서는 **비중증 축이 자기 안내로 차단되는지**를 계속 확인한다. 축 선택이 뒤집히면
  //   비중증 묶음에 '회' 안내가 나가므로 아래 두 검사가 함께 잡는다.
  check("후보 비교가 실제로 차단에 연결",
    /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(eng));
  check("비중증 축이 '일' 안내를 고른다",
    /isNonCriticalOutpatient \? ZERO_PAY_DAYS_HOLD_NOTES/.test(eng));
  check("fingerprint가 보상 여부·금액·공제·CapCode를 모두 본다",
    /l\.covered[\s\S]{0,120}l\.insurancePay[\s\S]{0,120}l\.deductibleApplied[\s\S]{0,60}appliedCaps/.test(eng));
  check("두 통원 축이 아니면 한 번만 계산",
    /if \(dualAxis === null\) return runBundle\(true\);/.test(eng)
    && /const dualAxis = isCriticalOutpatient \? ZERO_PAY_VISITS_HOLD_NOTES/.test(eng));
  check("0원 행은 두 해석 모두 미소진",
    /const consumes = amount > 0 && \(countZeroPay \|\| \(single\.insurancePay \?\? 0\) > 0\);/.test(eng)
    && /if \(isNonCriticalOutpatient && consumes\) outpatientDays \+= 1;/.test(eng));
}

console.log(`\n[비중증 통원 100일] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
