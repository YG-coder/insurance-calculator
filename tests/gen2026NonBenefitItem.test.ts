// 5세대 비급여 치료유형 축(nonBenefitItem) — 긴급 정확성 패치의 회귀 검사.
//
// 근거: 보험업감독업무시행세칙 [별표 15] 표준약관(2026.8.28 현행본, 2026.5.6 연혁본과 동일 문언)
//   특별약관1(중증)  — (1)상해비급여 / (2)질병비급여 / (3)3대비급여        (인쇄 p.259~265)
//   특별약관2(비중증) — (1)상해비급여 / (2)질병비급여 / (3)비급여 자기공명영상진단 (인쇄 p.288, p.294)
//   특약1 제3조 (2)① "비급여의료비(3대비급여는 제외합니다)"
//   특약2 제3조 (1)① "비급여의료비(비급여 자기공명영상진단은 제외합니다)"
//   특약1·2 제3조 입원 표 — 보상 대상은 "비급여 의료비(비급여 병실료는 제외합니다)"
// → 3대비급여·MRI·상급병실료를 (1)(2) 산식으로 계산하는 것은 약관이 금지한 계산이다.
//   전체 구현 전까지 숫자를 만들지 않고 차단한다.
import { calc2026, GEN2026_NON_BENEFIT_ITEM_LABEL } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculate } from "../src/lib/insurance/engine/engine";
import { CalcResult, Gen2026NonBenefitItem, MultiClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

/** 차단이란 "숫자를 하나도 돌려주지 않는 것"이다. 근사치는 이번 결함의 원인이었다. */
function noNumbers(r: CalcResult | MultiClaimResult): boolean {
  if ("lines" in r) {
    return r.status === "PENDING_UNVERIFIED" &&
      r.totalOwnPay === null && r.totalInsurancePay === null &&
      r.lines.length === 0 && r.appliedCaps.length === 0;
  }
  return r.status === "PENDING_UNVERIFIED" &&
    r.ownPay === null && r.insurancePay === null &&
    r.rateBased === null && r.rateApplied === null && r.minDeductible === null &&
    r.appliedCaps.length === 0;
}

const BLOCKED: Gen2026NonBenefitItem[] = ["musculoskeletal_esw", "injection", "mri", "room_charge"];

// ── 1. 치료유형 미지정 → 계산 불가 ──
{
  // 타입은 필수로 강제하지만 런타임 우회를 가정한 검사다.
  const r = calc2026({ amount: 300_000, coverage: "non_benefit", visit: "inpatient", severity: "critical" } as never);
  check("단건: 치료유형 미지정 → 계산 불가", noNumbers(r), JSON.stringify(r));
  check("단건: 미지정 사유를 밝힘", r.notes.some((n) => n.includes("치료유형")), JSON.stringify(r.notes));

  const bad = calc2026({ amount: 300_000, coverage: "non_benefit", visit: "inpatient", severity: "critical", nonBenefitItem: "made_up" } as never);
  check("단건: 알 수 없는 치료유형도 차단", noNumbers(bad), JSON.stringify(bad));

  const m = calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "critical", amounts: [300_000] } as never);
  check("다회: 치료유형 미지정 → 계산 불가", noNumbers(m), JSON.stringify(m));

  const empty = calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "critical", amounts: [] } as never);
  check("다회: 행이 없어도 치료유형 미지정이면 차단", noNumbers(empty), JSON.stringify(empty));

  // 제네릭 진입점도 같은 정책이어야 한다(타입 강제가 없는 경로).
  const g = calculate("2026", { amount: 300_000, coverage: "non_benefit", visit: "inpatient", severity: "critical" });
  check("제네릭 calculate(): 치료유형 미지정 → 계산 불가", noNumbers(g), JSON.stringify(g));
}

// ── 2. 별도 보장종목 4종 → 숫자 없이 차단 (단건·다회 동일) ──
for (const item of BLOCKED) {
  const label = GEN2026_NON_BENEFIT_ITEM_LABEL[item];
  for (const severity of ["critical", "non_critical"] as const) {
    for (const visit of ["inpatient", "outpatient"] as const) {
      const r = calc2026({ amount: 1_000_000, coverage: "non_benefit", visit, severity, nonBenefitItem: item, tier: "hospital", priorAnnualDeductible: 4_800_000 });
      check(`단건 ${label}/${severity}/${visit}: 숫자 반환 없이 차단`, noNumbers(r), JSON.stringify(r));
      check(`단건 ${label}/${severity}/${visit}: 항목명을 밝힘`, r.notes.some((n) => n.includes(label)), JSON.stringify(r.notes));

      const m = calculateMany2026({ cause: "injury", coverage: "non_benefit", visit, severity, nonBenefitItem: item, tier: "hospital", amounts: [1_000_000, 1_000_000] });
      check(`다회 ${label}/${severity}/${visit}: 숫자 반환 없이 차단`, noNumbers(m), JSON.stringify(m));
    }
  }
}

// ── 3. 차단 사유가 "별도 보장종목"임을 정확히 구분해 안내한다 ──
{
  const msw = calc2026({ amount: 500_000, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "musculoskeletal_esw" }).notes.join(" ");
  check("근골격계: 3대비급여 별도 보장종목이라는 사실", msw.includes("3대비급여") && msw.includes("제외"), msw);
  const inj = calc2026({ amount: 500_000, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "injection" }).notes.join(" ");
  check("주사료: 항암제·항생제·희귀의약품 예외를 안내", inj.includes("항암제") && inj.includes("희귀의약품"), inj);
  const mri = calc2026({ amount: 500_000, coverage: "non_benefit", visit: "outpatient", severity: "non_critical", nonBenefitItem: "mri" }).notes.join(" ");
  check("MRI: 중증·비중증 모두 별도 보장종목이라는 사실", mri.includes("3대비급여") && mri.includes("자기공명영상진단"), mri);
  const room = calc2026({ amount: 500_000, coverage: "non_benefit", visit: "inpatient", severity: "critical", nonBenefitItem: "room_charge" }).notes.join(" ");
  check("상급병실료: 별도 산식(50%·1일 평균 10만원)이라는 사실", room.includes("50%") && room.includes("10만원"), room);
}

// ── 4. 급여에는 치료유형을 요구하지 않는다 ──
{
  const inp = calc2026({ amount: 300_000, coverage: "benefit", visit: "inpatient" });
  check("급여 입원: 치료유형 없이 계산됨", inp.status === "OK" && inp.ownPay === 60_000, JSON.stringify(inp));
  const out = calc2026({ amount: 300_000, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4 });
  check("급여 통원: 치료유형 없이 계산됨", out.status === "OK" && out.ownPay === 120_000, JSON.stringify(out));
  const m = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [300_000, 300_000] });
  check("급여 다회: 치료유형 없이 계산됨", m.status === "OK" && m.totalOwnPay === 120_000, JSON.stringify(m));
  const mOut = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4, amounts: [300_000] });
  check("급여 다회 통원: 건보율이 엔진에 전달됨", mOut.status === "OK" && mOut.totalOwnPay === 120_000, JSON.stringify(mOut));
}

// ── 5. 일반 비급여 기준 결과 고정 — 이번 패치로 회귀가 없어야 한다 ──
//   패치 전 e62e100에서 산출된 값을 그대로 못박는다.
{
  const cases: { name: string; got: CalcResult; own: number; ins: number }[] = [
    { name: "중증 통원 5만", got: calc2026({ amount: 50_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "outpatient", severity: "critical" }), own: 30_000, ins: 20_000 },
    { name: "중증 통원 100만(한도 미입력)", got: calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "outpatient", severity: "critical" }), own: 300_000, ins: 700_000 },
    { name: "중증 통원 100만 + 가입금액 20만", got: calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "outpatient", severity: "critical", perVisitCoverageLimit: 200_000 }), own: 800_000, ins: 200_000 },
    { name: "중증 입원 1천만 상급종합(상한 500만)", got: calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "inpatient", severity: "critical", tier: "hospital" }), own: 3_000_000, ins: 7_000_000 },
    { name: "중증 입원 3천만 상급종합(상한 구속)", got: calc2026({ amount: 30_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "inpatient", severity: "critical", tier: "hospital" }), own: 5_000_000, ins: 25_000_000 },
    // ⚠ 300만원 한도는 병·의원급에만 적용된다(특별약관2 제3조 (1)①·(2)①, 인쇄 p.287·p.290).
    { name: "비중증 입원 1천만·병·의원급(1회당 300만 한도)", got: calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "inpatient", severity: "non_critical", tier: "clinic" }), own: 7_000_000, ins: 3_000_000 },
    { name: "비중증 입원 1천만·상급종합/종합(한도 미적용)", got: calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "inpatient", severity: "non_critical", tier: "hospital" }), own: 5_000_000, ins: 5_000_000 },
    { name: "비중증 통원 10만", got: calc2026({ amount: 100_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "outpatient", severity: "non_critical" }), own: 50_000, ins: 50_000 },
    { name: "급여 입원 30만", got: calc2026({ amount: 300_000, coverage: "benefit", visit: "inpatient" }), own: 60_000, ins: 240_000 },
  ];
  for (const c of cases) {
    check(`기준 결과 고정 — ${c.name}`, c.got.status === "OK" && c.got.ownPay === c.own && c.got.insurancePay === c.ins, JSON.stringify(c.got));
  }

  const m = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [1_000_000, 1_000_000], outpatientCoverageLimit: 200_000 });
  check("기준 결과 고정 — 다회 중증 통원 2건", m.status === "OK" && m.totalInsurancePay === 400_000 && m.totalOwnPay === 1_600_000, JSON.stringify(m));
  const mi = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "hospital", amounts: [10_000_000, 10_000_000], priorAnnualDeductible: 4_000_000 });
  check("기준 결과 고정 — 다회 중증 입원 자기부담 상한 이월", mi.status === "OK" && mi.totalOwnPay === 1_000_000, JSON.stringify(mi));
}

// ── 6. 일반 비급여 결과에도 미지원 범위를 알린다 ──
{
  const m = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [300_000] });
  const joined = m.notes.join(" ");
  check("다회 일반 비급여: 4종 미지원 범위를 명시", 
    joined.includes("근골격계") && joined.includes("주사료") && joined.includes("MRI") && joined.includes("상급병실료"), joined);
  const b = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [300_000] });
  check("다회 급여: 비급여 전용 안내가 붙지 않음", !b.notes.join(" ").includes("상급병실료"), b.notes.join(" "));
}

console.log(`\n[gen2026NonBenefitItem] ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
