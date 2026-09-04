// 5세대 별도 보장종목 — 특별약관1 (3)3대비급여 / 특별약관2 (3)비급여 자기공명영상진단.
//
// 근거: 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특약1 제3조(3)①<표1>·주) p.263~264 / ② p.265 / ④ p.266 / ⑦ p.267
//   특약1 제5조①③④⑤ p.279~280
//   특약2 제3조(3)①<표1> p.293 / ③ p.294 / 제5조 p.308~310
import { readFileSync } from "node:fs";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import {
  calculateGen2026Item, routeOfGen2026Item,
  GEN2026_INJECTION_GENERAL_ROUTE_DRUGS, GEN2026_MSK_APPROVED_THROUGH_VALUES,
} from "../src/lib/insurance/engine/specialItem2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { CAP_LABELS } from "../src/lib/insurance/engine/capLabels";
import {
  Cause, Gen2026CriticalMriLine, Gen2026InjectionPurpose, Gen2026ItemClaimInput,
  Gen2026RoutedGeneralInput, Gen2026RoutedGeneralResult, Gen2026SpecialItem,
  Gen2026SpecialItemInput, Gen2026SpecialItemResult, Gen2026SpecialLine, Severity, Visit,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const S = GEN2026.specialItem;

// ── 입력 헬퍼 ────────────────────────────────────────────────────────
const out = (amount: number): Gen2026SpecialLine => ({ amount, visit: "outpatient" });
const inp = (amount: number): Gen2026SpecialLine => ({ amount, visit: "inpatient" });
const mriOut = (amount: number): Gen2026CriticalMriLine => ({ amount, visit: "outpatient" });
const mriHosp = (amount: number): Gen2026CriticalMriLine => ({ amount, visit: "inpatient", tier: "hospital" });
const mriClinic = (amount: number): Gen2026CriticalMriLine => ({ amount, visit: "inpatient", tier: "clinic" });

// ⚠ 계산 함수는 진입점 하나뿐이다(검증 우회 입구를 만들지 않는다). 결과는 route로만 좁힌다.
const special = (input: Gen2026SpecialItemInput): Gen2026SpecialItemResult => {
  const r = calculateGen2026Item(input);
  if (r.route !== "special_item") throw new Error("special_item 결과가 아니다: " + JSON.stringify(r.notes));
  return r;
};
const general = (input: Gen2026RoutedGeneralInput): Gen2026RoutedGeneralResult => {
  const r = calculateGen2026Item(input);
  if (r.route !== "general") throw new Error("general 결과가 아니다: " + JSON.stringify(r.notes));
  return r;
};
const calculateSpecialItem2026 = special;
const calculateRoutedGeneral2026 = general;

// ⚠ 승인 구간은 '치료횟수' 축을 요구한다(<표1> 주)). 미입력이면 계산하지 않으므로,
//   이 헬퍼는 "확인 결과 0회"를 기본으로 넣고 개별 케이스가 덮어쓴다.
//   '보상한 횟수'(priorAnnualCoveredCount)는 연 50회 한도 축이라 서로 대신 쓰지 않는다.
const msk = (lines: Gen2026SpecialLine[], extra: { approvedThroughVisit?: 10 | 20 | 30 | 40 | 50; priorAnnualCoveredCount?: number; priorAnnualInsurancePaid?: number; priorAnnualTreatmentActCount?: number } = {}) =>
  special({
    route: "special_item", coverage: "non_benefit", severity: "critical",
    item: "musculoskeletal_esw", lines, priorAnnualTreatmentActCount: 0, ...extra,
  });
const inj = (lines: Gen2026SpecialLine[], extra: { priorAnnualCoveredCount?: number; priorAnnualInsurancePaid?: number } = {}) =>
  special({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "general", lines, ...extra });
const cMri = (lines: Gen2026CriticalMriLine[], extra: { priorAnnualInpatientDeductible?: number; priorAnnualInsurancePaid?: number } = {}) =>
  special({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines, ...extra });
const nMri = (lines: Gen2026SpecialLine[], extra: { priorAnnualInsurancePaid?: number } = {}) =>
  special({ route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri", lines, ...extra });

console.log("\n[별도 보장종목] 규칙 추적");
check("공제 정액 3만원", S.deductibleFixed === 30_000 && S.deductibleFixed === REGULATORY_RULES.GEN2026_THIRD_DEDUCTIBLE_FIXED.value);
check("공제 정률 30%", S.deductibleRate === 0.3 && S.deductibleRate === REGULATORY_RULES.GEN2026_THIRD_DEDUCTIBLE_RATE.value);
check("근골격계 350만·50회", S.msk.annualCoverage === 3_500_000 && S.msk.annualVisits === 50);
check("주사료 250만·50회", S.injection.annualCoverage === 2_500_000 && S.injection.annualVisits === 50);
check("중증 MRI 300만", S.criticalMri.annualCoverage === 3_000_000);
check("비중증 MRI 5만·50%·200만", S.nonCriticalMri.deductibleFixed === 50_000 && S.nonCriticalMri.deductibleRate === 0.5 && S.nonCriticalMri.annualCoverage === 2_000_000);
check("근골격계 최초 10회·10회 단위", S.msk.initialApprovedVisits === 10 && S.msk.approvalStep === 10);
check("0원 지급 횟수는 HOLD", S.countOnZeroPay === null && REGULATORY_RULES.GEN2026_SPECIAL_ITEM_COUNT_ON_ZERO_PAY.status === "HOLD");
for (const code of ["GEN2026_MSK_ANNUAL_COVERAGE", "GEN2026_MSK_ANNUAL_VISITS", "GEN2026_INJECTION_ANNUAL_COVERAGE", "GEN2026_INJECTION_ANNUAL_VISITS", "GEN2026_CRITICAL_MRI_ANNUAL_COVERAGE", "GEN2026_NONCRITICAL_MRI_ANNUAL_COVERAGE"] as const) {
  check(`CapCode 라벨 존재: ${code}`, typeof CAP_LABELS[code] === "string" && CAP_LABELS[code].length > 0);
}

console.log("\n[라우팅] 실제 허용 조합만");
const ROUTES: [Severity, Gen2026SpecialItem, Gen2026InjectionPurpose | undefined, string][] = [
  ["critical", "musculoskeletal_esw", undefined, "special_item"],
  ["critical", "mri", undefined, "special_item"],
  ["critical", "injection", "general", "special_item"],
  ["critical", "injection", "anticancer", "general"],
  ["critical", "injection", "antibiotic", "general"],
  ["critical", "injection", "orphan_drug", "general"],
  ["critical", "injection", undefined, "missing_purpose"],
  ["non_critical", "musculoskeletal_esw", undefined, "general"],
  ["non_critical", "injection", undefined, "general"],
  ["non_critical", "mri", undefined, "special_item"],
];
for (const [sev, item, purpose, want] of ROUTES) {
  check(`${sev}/${item}/${purpose ?? "-"} → ${want}`, routeOfGen2026Item(sev, item, purpose) === want);
}
{
  // 런타임 우회 경로도 막는다(외부 데이터는 타입을 우회할 수 있다).
  const wrong = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri", lines: [out(1_000_000)] } as never);
  check("올바른 경로는 계산", wrong.status === "OK");
  const bad = calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "critical", item: "mri", cause: "disease", visit: "outpatient", amounts: [1_000_000] } as never);
  check("중증 MRI의 일반 경로 → 차단", bad.status === "PENDING_UNVERIFIED" && bad.lines.length === 0, JSON.stringify(bad.notes));
  const bad2 = calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", cause: "disease", visit: "outpatient", amounts: [1_000_000] } as never);
  check("중증 근골격계의 일반 경로 → 차단", bad2.status === "PENDING_UNVERIFIED");
  const bad3 = calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "general", cause: "disease", visit: "outpatient", amounts: [1_000_000] } as never);
  check("중증 일반 주사의 일반 경로 → 차단", bad3.status === "PENDING_UNVERIFIED");
  const bad4 = calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "non_critical", item: "mri", cause: "disease", visit: "outpatient", amounts: [1_000_000] } as never);
  check("비중증 MRI의 일반 경로 → 차단", bad4.status === "PENDING_UNVERIFIED");
  const bad5 = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", lines: [out(1_000_000)] } as never);
  check("중증 예외 주사 목적 누락 → 차단", bad5.status === "PENDING_UNVERIFIED" && bad5.notes.some((n) => n.includes("약제 용도")));
  const bad6 = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "anticancer", lines: [out(1_000_000)] } as never);
  check("예외 주사의 특별약관 경로 → 차단", bad6.status === "PENDING_UNVERIFIED");
}

console.log("\n[중증 3대비급여] 공제 경계");
{
  const r = msk([out(100_000)]); // 30% = 3만 = 정액 → 어느 쪽으로 계산해도 같다
  check("정액=정률 경계 10만원", r.lines[0].deductible.deductibleApplied === 30_000 && r.lines[0].insurancePay === 70_000, JSON.stringify(r.lines[0]));
  const under = msk([out(90_000)]);
  check("10만원 미만은 정액 3만원", under.lines[0].deductible.deductibleApplied === 30_000 && under.lines[0].insurancePay === 60_000);
  const over = msk([out(200_000)]);
  check("10만원 초과는 정률 30%", over.lines[0].deductible.deductibleApplied === 60_000 && over.lines[0].insurancePay === 140_000);
  const zero = msk([out(20_000)]);
  check("공제가 진료비를 넘지 않음", zero.lines[0].ownPay === 20_000 && zero.lines[0].insurancePay === 0 && zero.lines[0].deductible.deductibleApplied === 20_000);
}
console.log("\n[비중증 MRI] 공제 경계");
{
  const eq = nMri([out(100_000)]); // 50% = 5만 = 정액
  check("정액=정률 경계 10만원", eq.lines[0].deductible.deductibleApplied === 50_000 && eq.lines[0].insurancePay === 50_000);
  check("10만원 미만은 정액 5만원", nMri([out(80_000)]).lines[0].deductible.deductibleApplied === 50_000);
  check("10만원 초과는 정률 50%", nMri([out(300_000)]).lines[0].deductible.deductibleApplied === 150_000);
  check("4만원은 지급 0원", nMri([out(40_000)]).lines[0].insurancePay === 0);
  check("비중증 MRI는 횟수 한도 없음", nMri(Array.from({ length: 60 }, () => out(60_000))).lines.every((l) => l.covered));
}

console.log("\n[근골격계] 승인 회차 경계 9·10·11 / 승인 10·20");
{
  const nine = msk(Array.from({ length: 9 }, () => out(100_000)));
  check("9회 · 승인 10 → 계산", nine.status === "OK" && nine.lines.length === 9);
  const ten = msk(Array.from({ length: 10 }, () => out(100_000)));
  check("10회 · 승인 10 → 계산", ten.status === "OK" && ten.lines.every((l) => l.covered));
  const eleven = msk(Array.from({ length: 11 }, () => out(100_000)));
  check("11회 · 승인 10 → 묶음 전체 차단", eleven.status === "PENDING_UNVERIFIED" && eleven.lines.length === 0, JSON.stringify(eleven.notes));
  check("승인 부족은 보상 제외로 처리하지 않음", eleven.appliedCaps.length === 0);
  check("차단 사유가 증상 개선 미판정을 밝힘", eleven.notes.some((n) => n.includes("증상 개선 여부를 판정하지 않습니다")));
  const eleven20 = msk(Array.from({ length: 11 }, () => out(100_000)), { approvedThroughVisit: 20 });
  check("11회 · 승인 20 → 계산", eleven20.status === "OK" && eleven20.lines.every((l) => l.covered));
  const fifteen = msk(Array.from({ length: 15 }, () => out(100_000)), { approvedThroughVisit: 20 });
  check("15회 · 승인 20 → 15행 모두 보상", fifteen.status === "OK" && fifteen.lines.filter((l) => l.covered).length === 15);
  const prior = msk([out(100_000)], { priorAnnualTreatmentActCount: 10 });
  check("이미 10회 치료 + 1행 · 승인 10 → 차단", prior.status === "PENDING_UNVERIFIED");
  // ⚠ '보상한 횟수'만 10이고 치료행위가 0회로 확인되면 승인 구간은 소진되지 않는다.
  //   두 축을 대신 쓰지 않는다는 계약을 여기서 고정한다.
  const coveredOnly = msk([out(100_000)], { priorAnnualCoveredCount: 10, priorAnnualTreatmentActCount: 0 });
  check("보상 10회·치료 0회 → 승인 구간은 소진되지 않음", coveredOnly.status === "OK", coveredOnly.status);
  const missing = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: [out(100_000)], priorAnnualCoveredCount: 10 } as never);
  check("치료행위 수 미입력 → 차단(보상 횟수로 대신 세지 않음)",
    missing.status === "PENDING_UNVERIFIED" && missing.lines.length === 0
    && missing.totalOwnPay === null && missing.totalInsurancePay === null, missing.status);
  const zeroRows = msk([out(0), out(0)], { approvedThroughVisit: 10, priorAnnualTreatmentActCount: 10 });
  check("0원 행은 승인 판정에 세지 않음", zeroRows.status === "OK", JSON.stringify(zeroRows.notes));
  const badApproved = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: [out(100_000)], approvedThroughVisit: 15 as never });
  check("승인 회차는 10회 단위만", badApproved.status === "PENDING_UNVERIFIED" && badApproved.route === "rejected");
}

console.log("\n[횟수] 49·50·51회");
{
  // 승인 50회로 열어두고 횟수 한도만 본다. 회당 6만원 지급 → 50회에 300만원(350만 이내)
  const r = msk(Array.from({ length: 51 }, () => out(90_000)), { approvedThroughVisit: 50 });
  check("51회 중 50회만 보상", r.lines.filter((l) => l.covered).length === 50, String(r.lines.filter((l) => l.covered).length));
  check("51번째 행은 covered:false", r.lines[50].covered === false && r.lines[50].insurancePay === 0 && r.lines[50].ownPay === 90_000);
  check("횟수 CapCode", r.lines[50].appliedCaps.includes("GEN2026_MSK_ANNUAL_VISITS"));
  check("보상 제외 행은 공제 0", r.lines[50].deductible.deductibleApplied === 0 && r.lines[50].deductible.excessOwnPay === 90_000);
  check("49회째까지 actIndex 증가", r.lines[48].actIndex === 49 && r.lines[49].actIndex === 50);
  const inj51 = inj(Array.from({ length: 51 }, () => out(80_000)));
  check("주사료도 50회 한도", inj51.lines.filter((l) => l.covered).length === 50 && inj51.lines[50].appliedCaps.includes("GEN2026_INJECTION_ANNUAL_VISITS"));
}

console.log("\n[금액 한도] 직전·도달·부분 지급·완전 소진");
{
  // 근골격계 350만. 회당 진료비 100만 → 공제 30만, 지급 70만.
  const five = msk(Array.from({ length: 5 }, () => out(1_000_000)), { approvedThroughVisit: 10 });
  check("5회 350만 정확히 도달", five.totalInsurancePay === 3_500_000 && five.appliedCaps.length === 0, String(five.totalInsurancePay));
  const six = msk(Array.from({ length: 6 }, () => out(1_000_000)), { approvedThroughVisit: 10 });
  check("6회째 부분 지급 0원", six.lines[5].insurancePay === 0 && six.totalInsurancePay === 3_500_000);
  check("한도 소진 이후 행도 covered:true", six.lines[5].covered === true);
  check("금액 CapCode", six.lines[5].appliedCaps.includes("GEN2026_MSK_ANNUAL_COVERAGE"));
  const partial = msk([out(1_000_000)], { priorAnnualInsurancePaid: 3_200_000, approvedThroughVisit: 10 });
  check("잔여 30만원만 부분 지급", partial.lines[0].insurancePay === 300_000 && partial.lines[0].ownPay === 700_000, JSON.stringify(partial.lines[0]));
  check("부분 지급 행의 excessOwnPay", partial.lines[0].deductible.deductibleApplied === 300_000 && partial.lines[0].deductible.excessOwnPay === 400_000);
}

console.log("\n[중증 MRI] 500만원 공제 pool");
{
  const clinic = cMri([mriClinic(10_000_000)]);
  check("입원 병·의원급은 pool 미적용", clinic.lines[0].deductible.poolUsedAfter === null && clinic.lines[0].deductible.deductibleApplied === 3_000_000);
  const outp = cMri([mriOut(10_000_000)]);
  check("통원은 pool 미적용", outp.lines[0].deductible.poolUsedAfter === null);
  const hospEdge = cMri([mriHosp(10_000_000)], { priorAnnualInpatientDeductible: 4_700_000 });
  check("잔여 30만원까지만 공제", hospEdge.lines[0].deductible.deductibleApplied === 300_000 && hospEdge.lines[0].deductible.poolUsedAfter === 5_000_000);
  check("pool CapCode", hospEdge.lines[0].appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
  const hospFull = cMri([mriHosp(1_000_000)], { priorAnnualInpatientDeductible: 5_000_000 });
  check("이미 500만원이면 공제 0", hospFull.lines[0].deductible.deductibleApplied === 0 && hospFull.lines[0].ownPay === 0);
  const exact = cMri([mriHosp(1_000_000)], { priorAnnualInpatientDeductible: 4_700_000 });
  check("잔여와 공제가 같으면 미구속", exact.lines[0].deductible.deductibleApplied === 300_000 && !exact.lines[0].appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
  const noTier = special({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [{ amount: 1_000_000, visit: "inpatient" } as never] });
  check("입원 행의 종별 미지정 → 차단", noTier.status === "PENDING_UNVERIFIED" && noTier.lines.length === 0, JSON.stringify(noTier.notes));
}
{
  // MRI만 pool 대상. 근골격계·주사료는 제5조⑤ 괄호로 제외된다.
  const m = msk([inp(10_000_000)], { approvedThroughVisit: 10 });
  const i = inj([inp(10_000_000)]);
  check("근골격계 입원은 pool 미적용", m.lines[0].deductible.poolUsedAfter === null && !m.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
  check("주사료 입원도 pool 미적용", i.lines[0].deductible.poolUsedAfter === null && !i.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
  check("근골격계·주사료 안내에 pool 제외 명시", m.notes.some((n) => n.includes("500만 원 공제금액 상한에서 제외")));
  // ⚠ 근골격계·주사료 행 타입에는 tier가 없다(구조적 차단). 외부 데이터가 tier를 실어 보내도
  //    pool이 적용되면 안 된다 — 제5조⑤ 괄호가 두 항목을 명시적으로 제외한다.
  const mTier = calculateSpecialItem2026({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: [{ amount: 10_000_000, visit: "inpatient", tier: "hospital" } as never], approvedThroughVisit: 10, priorAnnualTreatmentActCount: 0 });
  const iTier = calculateSpecialItem2026({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "general", lines: [{ amount: 10_000_000, visit: "inpatient", tier: "hospital" } as never] });
  check("근골격계 행에 tier가 실려도 pool 미적용",
    mTier.lines[0].deductible.poolUsedAfter === null && mTier.lines[0].deductible.deductibleApplied === 3_000_000, JSON.stringify(mTier.lines[0].deductible));
  check("주사료 행에 tier가 실려도 pool 미적용",
    iTier.lines[0].deductible.poolUsedAfter === null && !iTier.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
}
{
  // covered:false 행은 pool을 소진하지 않는다. (횟수 한도가 있는 항목으로 확인)
  const r = inj([...Array.from({ length: 50 }, () => inp(60_000)), inp(10_000_000)]);
  check("보상 제외 행은 pool·공제를 쓰지 않음", r.lines[50].covered === false && r.lines[50].deductible.deductibleApplied === 0 && r.lines[50].deductible.poolUsedAfter === null);
}

console.log("\n[HOLD] 지급 0원 행위의 횟수 소진");
{
  // 두 해석이 같은 결과 → OK
  const same = msk([out(20_000), out(100_000)], { approvedThroughVisit: 10 });
  check("결과가 같으면 OK", same.status === "OK" && same.lines[0].insurancePay === 0 && same.lines[1].insurancePay === 70_000, JSON.stringify(same.notes));
  // 두 해석이 갈리는 경우 → 전체 차단
  const diverge = msk([out(20_000), out(100_000)], { priorAnnualCoveredCount: 49, approvedThroughVisit: 50 });
  check("결과가 갈리면 전체 차단", diverge.status === "PENDING_UNVERIFIED" && diverge.lines.length === 0);
  check("차단 안내는 3줄", diverge.notes.length === 3 && diverge.notes[0].includes("정해져 있지 않습니다"));
  check("내부 두 세트를 노출하지 않음", diverge.notes.every((n) => !n.includes("해석") || !n.includes("{")));
  // MRI는 횟수 한도가 없어 이 HOLD가 적용되지 않는다.
  const mriZero = cMri([mriOut(20_000), mriOut(1_000_000)]);
  check("MRI에는 HOLD 미적용", mriZero.status === "OK");
  const nMriZero = nMri([out(20_000), out(1_000_000)]);
  check("비중증 MRI에도 HOLD 미적용", nMriZero.status === "OK");
}

console.log("\n[일반 경로 전환] 기존 결과와 동일 + 안내 한 줄");
{
  // ⚠ 두 통원 축은 미입력을 0으로 추정하지 않는다. 확인된 0을 명시해야 계산된다.
  //   축은 severity가 정하므로 shared에 넣지 않고 분기마다 자기 축만 싣는다.
  const shared = { cause: "disease" as Cause, visit: "outpatient" as Visit, amounts: [1_000_000, 2_000_000], annualCoverageLimit: 10_000_000, outpatientCoverageLimit: 200_000, priorAnnualInsurancePaid: 0 };
  const baseline = calculateMany2026({ ...shared, coverage: "non_benefit", severity: "non_critical", nonBenefitItem: "general", priorAnnualOutpatientDays: 0 });
  for (const item of ["musculoskeletal_esw", "injection"] as const) {
    const routed = calculateRoutedGeneral2026({ route: "general", coverage: "non_benefit", severity: "non_critical", item, ...shared, priorAnnualOutpatientDays: 0 });
    check(`비중증 ${item}: 행 결과가 일반 경로와 동일`, JSON.stringify(routed.lines) === JSON.stringify(baseline.lines));
    check(`비중증 ${item}: 합계 동일`, routed.totalOwnPay === baseline.totalOwnPay && routed.totalInsurancePay === baseline.totalInsurancePay && JSON.stringify(routed.appliedCaps) === JSON.stringify(baseline.appliedCaps));
    check(`비중증 ${item}: notes는 안내 한 줄만 추가`, routed.notes.length === baseline.notes.length + 1 && JSON.stringify(routed.notes.slice(1)) === JSON.stringify(baseline.notes));
  }
  const critBase = calculateMany2026({ ...shared, coverage: "non_benefit", severity: "critical", nonBenefitItem: "general", priorAnnualOutpatientVisits: 0 });
  const exceptional = (["anticancer", "antibiotic", "orphan_drug"] as const).map((p) =>
    calculateRoutedGeneral2026({ route: "general", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: p, ...shared, priorAnnualOutpatientVisits: 0 }));
  check("예외 주사 3종: 행 결과가 일반 경로와 동일", exceptional.every((r) => JSON.stringify(r.lines) === JSON.stringify(critBase.lines)));
  check("예외 주사 3종: 계산 결과는 서로 같음", new Set(exceptional.map((r) => JSON.stringify(r.lines))).size === 1);
  check("예외 주사 3종: 안내 문구는 약제별로 다름", new Set(exceptional.map((r) => r.notes[0])).size === 3);
  check("예외 주사 안내가 약제명을 밝힘", exceptional[0].notes[0].includes("항암제") && exceptional[1].notes[0].includes("항생제") && exceptional[2].notes[0].includes("희귀의약품"));
  check("전환 결과의 route", exceptional[0].route === "general");
  // 차단된 결과에는 "계산했다"는 안내를 붙이지 않는다.
  const blockedRouted = calculateRoutedGeneral2026({ route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "disease", visit: "outpatient", amounts: [] });
  check("차단 결과에는 전환 안내를 붙이지 않음", blockedRouted.status !== "OK" ? blockedRouted.notes.every((n) => !n.includes("계산했습니다")) : true);
}

console.log("\n[런타임 검증] 타입을 우회한 값은 전부 차단한다");
{
  const base = { route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [mriHosp(1_000_000)] };
  const BAD: [string, Record<string, unknown>][] = [
    ["알 수 없는 route", { ...base, route: "bogus" }],
    ["route 누락", { ...base, route: undefined }],
    ["알 수 없는 coverage", { ...base, coverage: "benefit" }],
    ["알 수 없는 severity", { ...base, severity: "bogus" }],
    ["severity 누락", { ...base, severity: undefined }],
    ["알 수 없는 item", { ...base, item: "bogus" }],
    ["item 누락", { ...base, item: undefined }],
    ["일반 비급여 item은 이 진입점 대상이 아님", { ...base, item: "general" }],
    ["상급병실료 item", { ...base, item: "room_charge" }],
    ["알 수 없는 약제 용도", { ...base, item: "injection", injectionPurpose: "bogus", lines: [out(1_000_000)] }],
    ["주사 목적 누락", { ...base, item: "injection", injectionPurpose: undefined, lines: [out(1_000_000)] }],
    ["비중증에 주사 목적 전달", { ...base, severity: "non_critical", injectionPurpose: "general", lines: [out(1_000_000)] }],
    ["MRI에 주사 목적 전달", { ...base, injectionPurpose: "general" }],
    ["lines가 배열이 아님", { ...base, lines: "nope" }],
    ["행이 객체가 아님", { ...base, lines: [null] }],
    ["행의 진료비가 숫자가 아님", { ...base, lines: [{ amount: "1000000", visit: "outpatient" }] }],
    ["행의 진료비가 NaN", { ...base, lines: [{ amount: Number.NaN, visit: "outpatient" }] }],
    ["행의 visit이 알 수 없는 값", { ...base, lines: [{ amount: 1_000_000, visit: "bogus" }] }],
    ["행의 visit 누락", { ...base, lines: [{ amount: 1_000_000 }] }],
    ["행의 tier가 알 수 없는 값", { ...base, lines: [{ amount: 1_000_000, visit: "inpatient", tier: "bogus" }] }],
    ["승인 회차가 10회 단위가 아님", { ...base, item: "musculoskeletal_esw", lines: [out(1_000_000)], approvedThroughVisit: 15 }],
    ["일반 경로에 cause 누락", { route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", visit: "outpatient", amounts: [1_000_000] }],
    ["일반 경로에 알 수 없는 cause", { route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "bogus", visit: "outpatient", amounts: [1_000_000] }],
    ["일반 경로에 알 수 없는 visit", { route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "disease", visit: "bogus", amounts: [1_000_000] }],
    ["일반 경로에 알 수 없는 tier", { route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "disease", visit: "inpatient", tier: "bogus", amounts: [1_000_000] }],
    ["일반 경로 amounts가 배열이 아님", { route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "disease", visit: "outpatient", amounts: 1_000_000 }],
    ["일반 경로 amounts에 숫자가 아닌 값", { route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "disease", visit: "outpatient", amounts: [1_000_000, "x"] }],
  ];
  for (const [name, bad] of BAD) {
    const r = calculateGen2026Item(bad as unknown as Gen2026ItemClaimInput);
    check(`${name} → 차단`, r.status === "PENDING_UNVERIFIED", JSON.stringify(r).slice(0, 160));
    check(`${name} → 숫자를 반환하지 않음`,
      r.lines.length === 0 && r.totalOwnPay === null && r.totalInsurancePay === null && r.appliedCaps.length === 0,
      JSON.stringify(r).slice(0, 160));
    check(`${name} → 판별값이 rejected`, r.route === "rejected", r.route);
    check(`${name} → 합계도 비어 있음`, r.totalAmount === 0, String(r.totalAmount));
  }
  // ⚠ 종전 결함 재현: 잘못된 값이 기본 분기로 떨어져 실제 보험금이 나왔다.
  const bogusItem = calculateGen2026Item({ severity: "critical", item: "bogus", route: "special_item", coverage: "non_benefit", lines: [out(100_000)] } as never);
  check("잘못된 item이 MRI 산식으로 계산되지 않음",
    bogusItem.status === "PENDING_UNVERIFIED" && bogusItem.lines.length === 0, JSON.stringify(bogusItem).slice(0, 200));
  const bogusPurpose = calculateGen2026Item({ severity: "critical", item: "injection", injectionPurpose: "bogus", route: "special_item", coverage: "non_benefit", lines: [out(100_000)] } as never);
  check("잘못된 약제 용도가 일반 주사로 계산되지 않음",
    bogusPurpose.status === "PENDING_UNVERIFIED" && bogusPurpose.lines.length === 0, JSON.stringify(bogusPurpose).slice(0, 200));
  // 정상 입력은 계속 계산돼야 한다(검증이 과하게 막지 않는지).
  const good = calculateGen2026Item(base as unknown as Gen2026ItemClaimInput);
  check("정상 입력은 그대로 계산", good.status === "OK" && good.route === "special_item");
}

console.log("\n[레지스트리] 예외 약제 목록은 단일 원천에서 파생한다");
{
  check("라우터 목록 === 레지스트리 값",
    JSON.stringify([...GEN2026_INJECTION_GENERAL_ROUTE_DRUGS]) === JSON.stringify([...REGULATORY_RULES.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS.value]),
    JSON.stringify([...GEN2026_INJECTION_GENERAL_ROUTE_DRUGS]));
  check("상수 계층도 같은 값을 가리킴",
    S.injectionGeneralRouteDrugs === REGULATORY_RULES.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS.value);
  // 레지스트리 값을 바꾸면 라우팅이 함께 바뀌어야 한다(목록이 두 곳에 있으면 이 검사가 실패한다).
  check("레지스트리에 없는 약제는 특별약관으로 라우팅",
    (["general"] as Gen2026InjectionPurpose[]).every((p) => routeOfGen2026Item("critical", "injection", p) === "special_item"));
  check("레지스트리에 있는 약제는 모두 일반 경로",
    REGULATORY_RULES.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS.value.every((p) => routeOfGen2026Item("critical", "injection", p) === "general"));
  check("소스에 목록이 다시 나열되지 않음",
    !/\["anticancer", "antibiotic", "orphan_drug"\]/.test(readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8")));
  // 승인 회차 선택지도 규칙과 어긋나면 안 된다.
  check("승인 회차 선택지가 규칙과 일치",
    JSON.stringify([...GEN2026_MSK_APPROVED_THROUGH_VALUES])
    === JSON.stringify(Array.from({ length: S.msk.annualVisits / S.msk.approvalStep }, (_, i) => (i + 1) * S.msk.approvalStep)));
}

console.log("\n[결과 계약] route로 좁혀 특별 필드를 읽는다");
{
  // 타입 단언 없이 route로만 좁힌다. 아래가 컴파일되는 것 자체가 계약이다.
  const r = calculateGen2026Item({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [mriHosp(1_000_000)] });
  if (r.route === "special_item") {
    const line = r.lines[0];
    check("route 좁힘 후 deductible 접근", line.deductible.deductibleApplied === 300_000 && line.item === "mri");
    check("actIndex는 횟수 한도 없으면 null", line.actIndex === null);
  } else {
    check("route 좁힘", false, "special_item이어야 한다");
  }
  // ⚠ 비중증 입원은 의료기관 종별이 1회당 300만원 한도 적용 여부를 가른다(특별약관2 제3조 (1)①·(2)①).
  const g = calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "non_critical", item: "injection", cause: "injury", visit: "inpatient", tier: "clinic", amounts: [1_000_000] });
  check("일반 전환 결과의 route", g.route === "general" && g.status === "OK");
}

console.log("\n[불변식] 격자");
{
  const amounts = [0, 1, 29_999, 30_000, 49_999, 50_000, 100_000, 999_999, 3_000_000, 12_000_000];
  const priors = [0, 1_000_000, 3_400_000, 5_000_000];
  let bad = 0; let first = "";
  let cases = 0;
  for (const amount of amounts) for (const prior of priors) for (const visit of ["outpatient", "inpatient"] as Visit[]) {
    const runs = [
      msk([{ amount, visit }], { priorAnnualInsurancePaid: prior, approvedThroughVisit: 50 }),
      inj([{ amount, visit }], { priorAnnualInsurancePaid: prior }),
      nMri([{ amount, visit }], { priorAnnualInsurancePaid: prior }),
      cMri([visit === "inpatient" ? mriHosp(amount) : mriOut(amount)], { priorAnnualInsurancePaid: prior, priorAnnualInpatientDeductible: prior }),
    ];
    for (const r of runs) {
      cases++;
      if (r.status !== "OK") { bad++; if (!first) first = `status ${amount}/${prior}/${visit}`; continue; }
      for (const l of r.lines) {
        const d = l.deductible;
        const ok = (l.ownPay ?? 0) + (l.insurancePay ?? 0) === l.amount
          && d.deductibleApplied >= 0 && d.deductibleApplied <= d.deductibleBeforeAnnualCap
          && d.deductibleBeforeAnnualCap <= l.amount
          && (l.ownPay ?? 0) === d.deductibleApplied + d.excessOwnPay
          && l.deductibleApplied === d.deductibleApplied
          && Number.isInteger(l.ownPay ?? 0) && Number.isInteger(l.insurancePay ?? 0);
        if (!ok) { bad++; if (!first) first = `${amount}/${prior}/${visit} → ${JSON.stringify(l)}`; }
      }
    }
  }
  check(`불변식 ${cases}건 통과 (ownPay+insurancePay=amount, ownPay=공제+초과부담)`, bad === 0, first);
}

console.log("\n[무회귀] 단건 차단 유지 · 일반 경로 불변");
{
  for (const item of ["musculoskeletal_esw", "injection", "mri", "room_charge"] as const) {
    const r = calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: item, severity: "critical", visit: "outpatient" });
    check(`단건 ${item} 계속 차단`, r.status === "PENDING_UNVERIFIED");
  }
  const src = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  for (const item of ["musculoskeletal_esw", "injection", "mri"] as const) {
    check(`단건 ${item} 안내가 다회로 유도`, src.includes("아래 여러 건 합산 계산에서 계산해 주세요"));
  }
  // 커밋 B: 상급병실료도 다회로 계산된다. 다만 안내 문구는 다른 3항목과 달라야 한다
  // (입원일수라는 추가 축을 함께 넣어야 한다는 사실을 알려야 하므로).
  check("상급병실료도 다회로 유도", src.includes("아래 여러 건 합산 계산에서 입원일수와 함께 계산할 수 있습니다"));
  check("상급병실료 안내가 3대비급여 문구와 구분됨",
    !/room_charge:\s*\n?\s*"[^"]*아래 여러 건 합산 계산에서 계산해 주세요/.test(src));
  check("상급병실료 미계산 단정이 사라짐",
    !src.includes("입원일수 축이 필요해 현재 계산하지 않습니다")
    && !src.includes("입원일수 축이 필요해 아직 계산하지 않습니다"));
  check("일반 비급여 다회는 그대로", calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "hospital", amounts: [10_000_000] }).lines[0].ownPay === 3_000_000);
}

console.log("\n[가드] 축·문구·출처의 금지형");
{
  const eng = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8").replace(/\s+/g, " ");
  check("특별약관 입력에 cause를 두지 않음", /interface Gen2026SpecialBase[\s\S]{0,600}cause\?: never;/.test(types));
  // 일반 경로 전환부와 입력 검증부는 cause를 읽는 것이 맞다(제5조① 원인별 축).
  //   실제 계산부(runOnce ~ calculateSpecialItem2026)만 잘라 검사한다.
  const specialPart = (eng.split("function runOnce")[1] ?? "").split("일반 (1)(2) 경로로 되돌아가는 조합")[0];
  check("특별약관 계산부가 cause를 읽지 않음", !/\.cause\b|cause:/.test(specialPart), (specialPart.match(/.{0,40}(\.cause|cause:).{0,40}/) ?? [""])[0]);
  check("일반 경로 전환부는 cause를 넘긴다", /cause: input\.cause/.test(eng));
  check("일반 경로 전환이 기존 엔진을 호출", /calculateMany2026\(\{/.test(eng));
  check("전환 경로가 결과 금액을 손대지 않음", !/totalInsurancePay:/.test(eng.split("calculateRoutedGeneral2026")[1] ?? ""));
  check("승인 부족은 blocked로 처리", /needApproval > approved[\s\S]{0,200}return blocked/.test(eng));
  check("승인 부족에 covered:false를 쓰지 않음", !/needApproval[\s\S]{0,300}covered: false/.test(eng));
  check("50회 초과만 covered:false", /count >= spec\.annualVisits[\s\S]{0,400}covered: false/.test(eng));
  check("pool 분기가 항목 자격을 먼저 본다", /if \(spec\.poolEligible && line\.visit === "inpatient" && line\.tier === "hospital"\)/.test(eng));
  check("근골격계·주사료 행 타입에 tier가 없음", /interface Gen2026SpecialLine \{\s*amount: number;\s*visit: Visit;\s*\}/.test(types));
  check("보상 제외 행의 공제·pool이 0으로 고정", /deductibleBeforeAnnualCap: 0, deductibleApplied: 0, excessOwnPay: amount, poolUsedAfter: null/.test(eng));
  check("0원 해석을 두 번 계산해 비교", /runOnce\(input, spec, true\)[\s\S]{0,400}runOnce\(input, spec, false\)/.test(eng));
  check("UI가 라우팅을 엔진 함수로 판정", ui.includes("routeOfGen2026Item("));
  check("UI가 route로 좁혀 특별 결과를 읽음", ui.includes('itemResult.route === "special_item"'));
  check("UI에 as 단언으로 특별 결과를 읽는 코드가 없음", !/as Gen2026SpecialItemResult/.test(ui));
  // G-8에서 노출 조건이 `severity !== ""`에서 `generalAxis !== null`(질환 구분·원인이
  //   모두 정해진 상태)로 좁아졌다. 특별약관에서 숨긴다는 계약은 그대로다 —
  //   `showGeneralForm`이 false이므로 렌더되지 않는다.
  check("UI가 특별약관에서 연간 가입금액을 숨김",
    /showGeneralForm && generalAxis !== null && <label[^§]{0,120}연간 보험가입금액/.test(ui)
    && /const generalAxis: Gen2026GeneralAxis \| null =\s*\n?\s*severity !== "" && cause !== ""/.test(ui));
  check("UI 승인 회차 기본값 10", ui.includes("GEN2026_MSK_APPROVED_THROUGH_VALUES[0]") && GEN2026_MSK_APPROVED_THROUGH_VALUES[0] === 10);
  check("UI 행별 치료 형태 기본 미선택", ui.includes('visit: "", tier: ""'));
  check("UI 약제 용도 기본 미선택", ui.includes('useState<Gen2026InjectionPurpose | "">("")'));
  check("UI가 180일 미반영을 안내", eng.includes("180일까지 남은 금액과 남은 횟수를 한도로 보상되지만"));
  check("UI가 주사료 합산 입력을 안내", ui.includes("같은 1회 안의 주사료는 합산해 한 행에 입력해 주세요"));
  check("UI가 행위별 분리 입력을 안내", ui.includes("행을 나눠 입력해 주세요"));
  // ── 원인(상해/질병) 기본 선택 제거 — 양방향 검사 ──
  check("UI 원인 초기값이 미선택", /useState<Cause \| "">\(""\)/.test(ui));
  check("UI 원인이 '질병'으로 자동 선택되지 않음", !/useState<Cause>\("disease"\)/.test(ui.replace(/benefitCause[\s\S]{0,120}/, "")));
  check("UI 원인 선택지에 빈 값이 있음", /<option value="">선택해 주세요<\/option><option value="disease">/.test(ui));
  check("UI 미선택 안내가 있음", ui.includes("<b>원인</b>을 선택해 주세요"));
  // ⚠ 초기값만 보면 게이트에서 빠져도 통과한다. 실제 계산 진입 조건에 연결됐는지 본다.
  check("일반 전환 계산이 원인 미선택을 배제", /!\(route === "general" && \(cause === ""/.test(ui));
  check("일반 전환 계산이 입원 종별 미선택도 배제", /visit === "inpatient" && nbInpatientTier === ""/.test(ui));
  check("일반 비급여 계산이 원인 미선택을 배제", /nonBenefitItem === "general" && severity !== "" && cause !== ""/.test(ui));
  check("needsCause가 안내와 같은 값을 씀", /const needsCause = \(showGeneralForm \|\| showRoomChargeCause\) && severity !== "" && cause === "";/.test(ui) && /submitted && needsCause/.test(ui));
  // 원인 입력은 일반 (1)(2) 경로와 상급병실료(같은 축을 공유)에서만 노출된다.
  // 별도 보장종목(3대비급여·비중증 MRI)은 상해·질병을 합산하므로 원인을 묻지 않는다.
  {
    const m = /\{([^{}]*) && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value=\{cause\}/.exec(ui);
    check("원인 입력이 게이트를 달고 노출됨", m !== null);
    const gate = m === null ? "" : m[1];
    check("별도 보장종목에는 원인을 노출하지 않음",
      gate === '(showGeneralForm || showRoomChargeCause)', gate);
    check("원인 노출 게이트에 showSpecialForm 없음", !gate.includes("showSpecialForm"), gate);
  }
  check("급여는 종전대로 원인 기본값을 유지", /const \[benefitCause, setBenefitCause\] = useState<Cause>\("disease"\)/.test(ui) && /cause: benefitCause, coverage: "benefit"/.test(ui));
}

console.log(`\n[별도 보장종목] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
