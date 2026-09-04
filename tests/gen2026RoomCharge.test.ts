// 5세대 상급병실료 차액.
//
// 근거: 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특약1 제2조(용어의 정의) 인쇄 p.257
//   특약1 제3조 (1)①(p.258)·(2)①(p.261), 특약2 제3조 (1)①(p.287)·(2)①(p.290)
//     <구분·보상금액> '상급병실료 차액' 행 — 네 표의 문언이 동일하다.
//     "비급여 병실료의 50%. 다만, 1일 평균금액 10만원을 한도로 하며, 1일 평균금액은
//      입원기간 동안 비급여 병실료 전체를 총 입원일수로 나누어 산출합니다."
//   특약1 제5조①(p.279)·특약2 제5조①(p.308) — 연간 보험가입금액
// 보조 근거(적용 순서 확인용, 5세대 원문 아님): 삼성화재 라이프케어 계산 예시
//   (20만−2만) × 50% × 10일 = 90만원 / 1일 평균 15만원이면 1일 10만원 한도로 50만원
import { readFileSync } from "node:fs";
import { mount, stateNamesFrom } from "./_uiRender";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { CAP_LABELS } from "../src/lib/insurance/engine/capLabels";
import {
  Cause, Gen2026ItemClaimInput, Gen2026RoomChargeInput, Gen2026RoomChargeResult, Severity,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const R = GEN2026.roomCharge;

const room = (input: Gen2026RoomChargeInput): Gen2026RoomChargeResult => {
  const r = calculateGen2026Item(input);
  if (r.route !== "room_charge") throw new Error("room_charge 결과가 아니다: " + JSON.stringify(r.notes));
  return r;
};
const one = (total: number, days: number, extra: Partial<Gen2026RoomChargeInput> = {}) =>
  room({ route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical",
    stays: [{ roomChargeTotal: total, inpatientDays: days }], ...extra } as Gen2026RoomChargeInput);

console.log("\n[상급병실료] 근거·레지스트리 추적");
check("보상률 50%", R.payRate === 0.5 && R.payRate === REGULATORY_RULES.GEN2026_ROOM_CHARGE_PAY_RATE.value);
check("1일 보험금 한도 10만원", R.dailyPayCap === 100_000 && R.dailyPayCap === REGULATORY_RULES.GEN2026_ROOM_CHARGE_DAILY_PAY_CAP.value);
check("한도는 보상금액 기준", R.dailyCapBasis === "insurance_pay");
check("연간 가입금액 공유", R.sharesAnnualLimit === true);
check("상해·질병 분리", R.causeSeparated === true);
check("일반 입원 의료비에서 제외", R.excludedFromInpatientMedical === true);
check("500만원 공제 pool은 HOLD", R.deductiblePool === null
  && REGULATORY_RULES.GEN2026_ROOM_CHARGE_DEDUCTIBLE_POOL.status === "HOLD");
check("적용 순서 규칙이 보조 근거의 역할을 밝힘",
  (REGULATORY_RULES.GEN2026_ROOM_CHARGE_DAILY_CAP_BASIS.note ?? "").includes("보조 근거는 5세대 원문이 아니며"));
check("적용 순서 규칙이 원문과 보조 근거를 모두 인용",
  REGULATORY_RULES.GEN2026_ROOM_CHARGE_DAILY_CAP_BASIS.sources.length === 2
  && REGULATORY_RULES.GEN2026_ROOM_CHARGE_DAILY_CAP_BASIS.sources.some((s) => s.url.includes("admRulSeq=2200000108697"))
  && REGULATORY_RULES.GEN2026_ROOM_CHARGE_DAILY_CAP_BASIS.sources.some((s) => s.url.includes("samsungfire")));
check("보조 근거가 5세대 원문으로 위장되지 않음",
  REGULATORY_RULES.GEN2026_ROOM_CHARGE_DAILY_CAP_BASIS.sources
    .filter((s) => s.url.includes("samsungfire"))
    .every((s) => s.document.includes("보조 근거") && !s.document.includes("별표 15")));
check("원문 출처가 네 조문 쪽수를 모두 인용",
  REGULATORY_RULES.GEN2026_ROOM_CHARGE_PAY_RATE.sources.every((s) =>
    ["p.258", "p.261", "p.287", "p.290"].every((pg) => s.locator.includes(pg))));
for (const code of ["GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT", "GEN2026_ROOM_CHARGE_ANNUAL_COVERAGE"] as const) {
  check(`CapCode 라벨 존재: ${code}`, typeof CAP_LABELS[code] === "string" && CAP_LABELS[code].length > 0);
}

console.log("\n[산식] 공식 예시와 경계");
{
  // 삼성화재 예시 ①: 10일 · 1일 차액 18만 → 총 180만 → 50% 90만 (1일 평균 보험금 9만)
  const a = one(1_800_000, 10);
  check("10일·차액 180만 → 90만 지급", a.totalInsurancePay === 900_000 && a.appliedCaps.length === 0, JSON.stringify(a.totalInsurancePay));
  // 삼성화재 예시 ②: 5일 · 1일 차액 30만 → 총 150만 → 50% 75만 → 1일 10만 한도로 50만
  const b = one(1_500_000, 5);
  check("5일·차액 150만 → 일 한도로 50만", b.totalInsurancePay === 500_000 && b.appliedCaps.includes("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT"), JSON.stringify(b.totalInsurancePay));

  check("10일·차액 200만 → 100만", one(2_000_000, 10).totalInsurancePay === 1_000_000);
  const c = one(3_000_000, 10);
  check("10일·차액 300만 → 150만이 아니라 100만", c.totalInsurancePay === 1_000_000 && c.lines[0].dailyCapExcess === 500_000);
  check("일 한도 CapCode", c.appliedCaps.includes("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT"));
  check("1일·차액 20만 → 10만", one(200_000, 1).totalInsurancePay === 100_000);
  const d = one(200_002, 1);
  check("1일·차액 200,002원 → 10만 + 일 한도 CapCode",
    d.totalInsurancePay === 100_000 && d.appliedCaps.includes("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT"), JSON.stringify(d.lines[0]));
  const exact = one(200_000, 1);
  check("일 한도와 정확히 같으면 CapCode 없음", exact.totalInsurancePay === 100_000 && exact.appliedCaps.length === 0);
  const over1 = one(200_001, 1);
  check("일 한도를 1원 넘기면 CapCode",
    over1.totalInsurancePay === 100_000 && over1.appliedCaps.includes("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT"), JSON.stringify(over1.lines[0]));
  const zero = one(0, 5);
  check("차액 0원 → 지급 0, 계산은 성립", zero.status === "OK" && zero.totalInsurancePay === 0 && zero.totalOwnPay === 0);
  const multi = room({ route: "room_charge", coverage: "non_benefit", cause: "injury", severity: "non_critical",
    stays: [{ roomChargeTotal: 1_800_000, inpatientDays: 10 }, { roomChargeTotal: 200_000, inpatientDays: 1 }] });
  check("여러 입원 합계", multi.totalInsurancePay === 1_000_000 && multi.totalAmount === 2_000_000, JSON.stringify(multi.totalInsurancePay));
}

console.log("\n[불변식] 홀수 총액과 격자");
{
  const odd = one(101, 1);
  const l = odd.lines[0];
  check("101원: payBeforeCaps 51 / baseOwnPay 50",
    l.payBeforeCaps === 51 && l.baseOwnPay === 50 && l.insurancePay === 51 && l.ownPay === 50, JSON.stringify(l));
  check("101원: 원금 보존", (l.ownPay ?? 0) + (l.insurancePay ?? 0) === l.amount);
  let bad = 0; let first = ""; let n = 0;
  for (const total of [0, 1, 101, 99_999, 100_000, 200_001, 1_999_999, 2_000_000, 12_345_678])
    for (const days of [1, 2, 7, 30])
      for (const limit of [undefined, 300_000, 1_000_000, 60_000_000])
        for (const prior of [0, 500_000]) {
          n++;
          const r = one(total, days, { annualCoverageLimit: limit, priorAnnualInsurancePaid: prior });
          const x = r.lines[0];
          const ok = (x.ownPay ?? 0) + (x.insurancePay ?? 0) === x.amount
            && x.baseOwnPay === x.amount - x.payBeforeCaps
            && x.excessOwnPay === x.payBeforeCaps - (x.insurancePay ?? 0)
            && x.ownPay === x.baseOwnPay + x.excessOwnPay
            && x.excessOwnPay === x.dailyCapExcess + x.annualCapExcess
            && Number.isInteger(x.ownPay ?? 0) && Number.isInteger(x.insurancePay ?? 0)
            && (x.insurancePay ?? 0) >= 0 && (x.ownPay ?? 0) >= 0;
          if (!ok) { bad++; if (!first) first = `${total}/${days}/${limit}/${prior} → ${JSON.stringify(x)}`; }
        }
  check(`불변식 ${n}건 통과 (ownPay+insurancePay=차액, ownPay=기본+초과, 초과=일한도+연간한도)`, bad === 0, first);
}

console.log("\n[연간 보험가입금액]");
{
  const none = one(2_000_000, 10);
  check("미입력이면 미적용 안내", none.notes.some((x) => x.includes("입력하지 않아 적용하지 않았습니다")));
  check("0·음수는 미입력 처리",
    one(2_000_000, 10, { annualCoverageLimit: 0 }).totalInsurancePay === 1_000_000
    && one(2_000_000, 10, { annualCoverageLimit: -1 }).totalInsurancePay === 1_000_000);
  const critOver = one(200_000_000, 1000, { annualCoverageLimit: 90_000_000 });
  check("중증 상한선 5천만으로 절삭", critOver.totalInsurancePay === 50_000_000, JSON.stringify(critOver.totalInsurancePay));
  const ncOver = one(200_000_000, 1000, { severity: "non_critical", annualCoverageLimit: 90_000_000 });
  check("비중증 상한선 1천만으로 절삭", ncOver.totalInsurancePay === 10_000_000, JSON.stringify(ncOver.totalInsurancePay));
  check("한도 직전", one(2_000_000, 10, { annualCoverageLimit: 1_000_001 }).appliedCaps.length === 0);
  check("한도와 정확히 같으면 구속 아님", one(2_000_000, 10, { annualCoverageLimit: 1_000_000 }).appliedCaps.length === 0);
  const partial = one(2_000_000, 10, { annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 700_000 });
  check("부분 지급", partial.totalInsurancePay === 300_000 && partial.lines[0].annualCapExcess === 700_000
    && partial.appliedCaps.includes("GEN2026_ROOM_CHARGE_ANNUAL_COVERAGE"), JSON.stringify(partial.lines[0]));
  const exhausted = room({ route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical",
    annualCoverageLimit: 1_000_000, stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }, { roomChargeTotal: 2_000_000, inpatientDays: 10 }] });
  check("완전 소진 이후 행은 지급 0", exhausted.lines[1].insurancePay === 0 && exhausted.lines[1].covered === true
    && exhausted.totalInsurancePay === 1_000_000, JSON.stringify(exhausted.totalInsurancePay));
  // 일 한도와 연간 한도가 동시에 구속
  const both = one(3_000_000, 10, { annualCoverageLimit: 600_000 });
  check("일 한도·연간 한도 동시 구속",
    both.totalInsurancePay === 600_000
    && both.lines[0].dailyCapExcess === 500_000 && both.lines[0].annualCapExcess === 400_000
    && both.appliedCaps.includes("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT")
    && both.appliedCaps.includes("GEN2026_ROOM_CHARGE_ANNUAL_COVERAGE"), JSON.stringify(both.lines[0]));
  // 축 분리 — 상해·질병, 중증·비중증은 각각 자기 한도를 온전히 쓴다.
  for (const cause of ["injury", "disease"] as Cause[]) for (const severity of ["critical", "non_critical"] as Severity[]) {
    const r = one(2_000_000, 10, { cause, severity, annualCoverageLimit: 1_000_000 });
    check(`${cause}/${severity} 축은 자기 한도를 온전히 사용`, r.totalInsurancePay === 1_000_000);
  }
  check("안내가 원인 축을 밝힘", one(1_000, 1, { cause: "injury" }).notes.some((x) => x.includes("상해비급여 축에만 누적")));
}

console.log("\n[안전 차단] 타입을 우회한 입력");
{
  const base = { route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical", stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 10 }] };
  const BAD: [string, Record<string, unknown>][] = [
    ["알 수 없는 route", { ...base, route: "bogus" }],
    ["알 수 없는 coverage", { ...base, coverage: "benefit" }],
    ["원인 미선택", { ...base, cause: undefined }],
    ["알 수 없는 cause", { ...base, cause: "bogus" }],
    ["질환 구분 미선택", { ...base, severity: undefined }],
    ["알 수 없는 severity", { ...base, severity: "bogus" }],
    ["stays가 배열이 아님", { ...base, stays: "nope" }],
    ["행이 객체가 아님", { ...base, stays: [null] }],
    ["차액이 숫자가 아님", { ...base, stays: [{ roomChargeTotal: "100", inpatientDays: 10 }] }],
    ["차액이 NaN", { ...base, stays: [{ roomChargeTotal: Number.NaN, inpatientDays: 10 }] }],
    ["차액이 Infinity", { ...base, stays: [{ roomChargeTotal: Number.POSITIVE_INFINITY, inpatientDays: 10 }] }],
    ["차액이 음수", { ...base, stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] }],
    ["입원일수 미입력", { ...base, stays: [{ roomChargeTotal: 1_000_000 }] }],
    ["입원일수 0", { ...base, stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 0 }] }],
    ["입원일수 음수", { ...base, stays: [{ roomChargeTotal: 1_000_000, inpatientDays: -3 }] }],
    ["입원일수 소수", { ...base, stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 2.5 }] }],
    ["입원일수 NaN", { ...base, stays: [{ roomChargeTotal: 1_000_000, inpatientDays: Number.NaN }] }],
    ["입원일수 Infinity", { ...base, stays: [{ roomChargeTotal: 1_000_000, inpatientDays: Number.POSITIVE_INFINITY }] }],
    ["기존 지급보험금이 NaN", { ...base, priorAnnualInsurancePaid: Number.NaN }],
    ["연간 가입금액이 NaN", { ...base, annualCoverageLimit: Number.NaN }],
    ["쓰이지 않는 visit 주입", { ...base, visit: "inpatient" }],
    ["쓰이지 않는 tier 주입", { ...base, tier: "hospital" }],
    ["쓰이지 않는 item 주입", { ...base, item: "mri" }],
    ["쓰이지 않는 injectionPurpose 주입", { ...base, injectionPurpose: "general" }],
    ["쓰이지 않는 priorAnnualDeductible 주입", { ...base, priorAnnualDeductible: 1_000_000 }],
    ["쓰이지 않는 outpatientCoverageLimit 주입", { ...base, outpatientCoverageLimit: 200_000 }],
    ["쓰이지 않는 priorAnnualCoveredCount 주입", { ...base, priorAnnualCoveredCount: 3 }],
  ];
  for (const [name, bad] of BAD) {
    const r = calculateGen2026Item(bad as unknown as Gen2026ItemClaimInput);
    check(`${name} → 차단`, r.status === "PENDING_UNVERIFIED" && r.route === "rejected", JSON.stringify(r).slice(0, 150));
    check(`${name} → 숫자를 반환하지 않음`,
      r.lines.length === 0 && r.totalAmount === 0 && r.totalOwnPay === null && r.totalInsurancePay === null && r.appliedCaps.length === 0);
  }
  check("정상 입력은 그대로 계산", calculateGen2026Item(base as unknown as Gen2026ItemClaimInput).status === "OK");
}

console.log("\n[축 분리] 다른 한도가 섞이지 않는다");
{
  const r = one(3_000_000, 10, { annualCoverageLimit: 600_000 });
  const codes = r.appliedCaps.join(",");
  for (const forbidden of [
    "OUTPATIENT", "MSK", "INJECTION", "MRI", "GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL",
    "GEN2026_CRITICAL_ANNUAL_COVERAGE", "GEN2026_NONCRITICAL_ANNUAL_COVERAGE",
    "GEN2026_NONCRITICAL_INPATIENT_PER_VISIT",
  ]) {
    check(`CapCode에 ${forbidden} 없음`, !codes.includes(forbidden), codes);
  }
  check("결과 행에 deductibleApplied 키 없음", r.lines.every((l) => !Object.hasOwn(l, "deductibleApplied")), JSON.stringify(r.lines[0]));
  check("의료기관 종별을 받지 않음", !Object.hasOwn(r.lines[0], "tier"));
  check("자기부담률 50%·정액 최소공제 없음", r.lines[0].rateApplied === 0.5 && r.lines[0].minDeductible === 0);
}

console.log("\n[단건] 계속 차단하고 다회로 유도");
{
  const r = calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "room_charge", severity: "critical", visit: "inpatient", tier: "clinic" });
  {
    const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
    check("Gen2026SpecialItem은 3대비급여 3종뿐",
      /export type Gen2026SpecialItem = "musculoskeletal_esw" \| "injection" \| "mri";/.test(types));
    check("room_charge는 별도 입력 타입",
      /export interface Gen2026RoomChargeInput \{[\s\S]*?route: "room_charge";/.test(types));
    check("room_charge는 별도 결과 타입",
      /export interface Gen2026RoomChargeResult[\s\S]*?route: "room_charge";/.test(types));
    check("결과 유니온에 room_charge가 별도 항목으로 들어감",
      /Gen2026ItemClaimResult =[\s\S]{0,240}Gen2026RoomChargeResult/.test(types));
    const labels = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
    check("3대비급여 라벨표에 room_charge 없음",
      /GEN2026_SPECIAL_ITEM_LABEL: Record<Gen2026SpecialItem, string> = \{[^}]*\}/.test(labels)
      && !/GEN2026_SPECIAL_ITEM_LABEL: Record<Gen2026SpecialItem, string> = \{[^}]*room_charge/.test(labels));
  }
  check("단건 상급병실료 차단", r.status === "PENDING_UNVERIFIED");
  check("단건 안내가 다회로 유도", r.notes.some((n) => n.includes("여러 건 합산 계산에서 입원일수와 함께 계산할 수 있습니다")), JSON.stringify(r.notes));
}

console.log("\n[가드] 소스·문구");
{
  const eng = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8").replace(/\s+/g, " ");
  const page = readFileSync("src/app/5th-generation-health-insurance-calculator/page.tsx", "utf8").replace(/\s+/g, " ");
  check("보상률을 상수에서 읽는다", /Math\.round\(total \* R\.payRate\)/.test(eng) && !/\* 0\.5/.test(eng));
  check("일 한도를 상수에서 읽는다", /R\.dailyPayCap \* days/.test(eng) && !/100_000 \* days/.test(eng));
  check("50%를 먼저 적용한 뒤 일 한도를 건다",
    /const payBeforeCaps = Math\.round\(total \* R\.payRate\);[\s\S]{0,200}const payAfterDailyCap = Math\.min\(payBeforeCaps, dailyCapAmount\);/.test(eng));
  check("일 한도 CapCode가 실제 절삭에만 붙는다",
    /if \(payAfterDailyCap < payBeforeCaps\) appliedCaps\.push\("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT"\)/.test(eng));
  check("연간 한도 CapCode가 실제 절삭에만 붙는다",
    /if \(insurancePay < payAfterDailyCap\) appliedCaps\.push\("GEN2026_ROOM_CHARGE_ANNUAL_COVERAGE"\)/.test(eng));
  // 변조 테스트에서 새어 나간 구멍을 막는다: 특정 식별자 몇 개만 금지하면
  //   다른 이름의 pool 상수를 끌어다 쓰는 변조를 잡지 못한다.
  //   ⇒ 주석을 걷어낸 실행 코드에 'deduct'가 들어간 식별자는 minDeductible: 0 하나만 허용한다.
  //   (거부 대상 축 이름을 나열한 UNUSED_KEYS 배열은 검사에서 제외한다 — 그 목록은 따로 검증한다.)
  const engCode = eng.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    .replace(/const UNUSED_KEYS = \[[\s\S]*?\] as const;/, "");
  const deductTokens = [...engCode.matchAll(/[A-Za-z_$][\w$]*[Dd]educt[\w$]*/g)].map((m) => m[0]);
  const ALLOWED_DEDUCT = new Set(["minDeductible"]);
  check("500만원 pool을 쓰지 않는다",
    deductTokens.every((t) => ALLOWED_DEDUCT.has(t)),
    [...new Set(deductTokens)].filter((t) => !ALLOWED_DEDUCT.has(t)).join(" | "));
  check("minDeductible은 0 고정", /minDeductible: 0,/.test(engCode));
  check("deductibleApplied를 만들지 않는다", !/deductibleApplied/.test(engCode));
  // 미사용 축 목록 자체가 지워지면 잘못된 입력이 조용히 통과한다.
  for (const key of ["priorAnnualInpatientDeductible", "priorAnnualDeductible", "approvedThroughVisit",
    "priorAnnualCoveredCount", "outpatientCoverageLimit", "priorAnnualOutpatientVisits",
    "visit", "tier", "item", "nonBenefitItem", "injectionPurpose"]) {
    check(`미사용 축 목록에 ${key} 유지`, new RegExp(`"${key}"`).test(eng), key);
  }
  check("cause를 실제로 쓴다", /cause/.test(eng));
  check("UI가 route로 좁혀 전용 필드를 읽는다",
    ui.includes('roomResult.route === "room_charge"') && !/as Gen2026RoomChargeResult/.test(ui));
  check("UI 입원일수 기본 빈 값", /useState<RoomChargeRow\[\]>\(\[\{ amount: "", days: "" \}\]\)/.test(ui));
  // 화면 노출 자체가 질환 구분(연간 가입금액 축)을 기다려야 한다.
  //   이 조건이 빠지면 축이 정해지기 전에 폼이 열려 사용자가 미완성 상태로 입력하게 된다.
  check("UI 상급병실료 폼이 질환 구분과 원인을 차례로 기다림",
    /const showRoomChargeCause = isRoomCharge && severity !== "";/.test(ui)
    && /const showRoomChargeForm = showRoomChargeCause && cause !== "";/.test(ui));
  // ⚠ G-9가 이 경로의 누적 금액(지급보험금·연간 가입금액) 게이트를 추가했다.
  //   상급병실료 자체의 게이트(`rcIncomplete`)와 파서는 그대로다.
  check("UI 입력 게이트가 계산에 연결",
    /rcIncomplete = showRoomChargeForm && rcRows\.some\(\(r\) => roomChargeAmount\(r\.amount\) === null \|\| positiveDays\(r\.days\) === null\)/.test(ui)
    && /if \(money !== null && showRoomChargeForm && !rcIncomplete\)/.test(ui));
  check("UI가 상급병실료에서 치료 형태를 숨김", /!showSpecialForm && !isRoomCharge && <label[^§]{0,40}치료 형태/.test(ui));
  check("UI가 상급병실료에서 원인을 노출", /\(showGeneralForm \|\| showRoomChargeCause\) && <label[^§]{0,60}>원인/.test(ui));
  for (const [what, phrase] of [
    ["차액임을 안내", "실제 사용 병실과 기준병실의 비급여 차액"],
    ["합산 금지 안내", "일반 입원 의료비와 합쳐 넣지 마세요"],
    ["1행 = 1회 입원", "1행은 1회의 입원"],
    ["50%·1일 10만원", "1일 평균 보험금 10만 원"],
    ["일수 판단 미수행", "계산기가 하지 않습니다"],
    ["180일 미반영", "180일 계속 입원과 공제금액 상한 500만 원은 이 계산에 반영하지 않았습니다"],
  ] as const) {
    check(`UI ${what}`, ui.includes(phrase), phrase);
  }
  // 낡은 차단 문구는 상급병실료에 한해서만 사라져야 한다(다른 항목의 차단 안내는 유지).
  check("UI에 상급병실료 미계산 문구 없음", !ui.includes("입원일수 축이 필요해 아직 계산하지 않습니다") && !ui.includes("입원일수 축이 필요해 현재 계산하지 않습니다"));
  check("페이지도 상급병실료 미계산 단정을 지움", !page.includes("두 계산기 모두 계산 대상이 아닙니다"));
  check("페이지가 다른 항목의 단건 차단은 유지", page.includes("단건 계산은 차단"));
  check("합산 입력을 권하는 낡은 문구 없음",
    !ui.includes("상급병실료도 입원 의료비에 합산") && !page.includes("상급병실료도 입원 의료비에 합산"));
}

// ── 화면 상태 전이 ────────────────────────────────────────────────────
//   ⚠ 문자열 존재 검사가 아니라 **실제로 렌더된 입력**을 본다.
//   커밋 2ee330d의 결함: 게이트(showRoomChargeForm)는 질환 구분을 요구하는데
//   질환 구분 선택창은 `!isRoomCharge`로 숨겨져, 안내만 뜨고 고를 수단이 없었다.
//   이전 항목에서 남은 severity가 있을 때만 우연히 동작했다.
{
  console.log("\n[화면] 상태 전이 — 실제 렌더 검사");
  const uiSrc = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  const names = stateNamesFrom(uiSrc);

  /** 항상 새 화면에서 시작한다 — 남은 상태에 기대지 않기 위해서다. */
  const fresh = () => mount(HealthCalcMulti2026 as unknown as () => unknown, names);
  const warnings = (scr: ReturnType<ReturnType<typeof fresh>["render"]>) =>
    scr.nodes.filter((n) => n.tag === "#NoticeBox" && n.props.variant === "warning").map((n) => n.text);
  const rcWarned = (scr: ReturnType<ReturnType<typeof fresh>["render"]>) =>
    warnings(scr).some((t) => t.includes("차액 총액") && t.includes("총 입원일수"));

  // ① 새 화면 — 치료유형만 보이고 질환 구분·원인·입력 폼은 없다.
  {
    const h = fresh();
    const scr = h.render();
    check("① 새 화면: 치료유형 노출", scr.has("치료유형"));
    check("① 새 화면: 질환 구분 미노출", !scr.has("질환 구분"));
    check("① 새 화면: 원인 미노출", !scr.has("원인"));
    check("① 새 화면: 상급병실료 입력 미노출", !scr.has("1번째 입원의 상급병실"));
  }

  // ② 새 화면에서 곧바로 상급병실료 선택 — 질환 구분 선택창이 **반드시** 나와야 한다.
  //    (남은 severity에 기대지 않는 실제 상태 전이)
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    const scr = h.render();
    check("② 상급병실료 선택 직후: 질환 구분 선택창 노출", scr.has("질환 구분"));
    check("② 상급병실료 선택 직후: 원인 미노출", !scr.has("원인"));
    check("② 상급병실료 선택 직후: 입력 폼 미노출", !scr.has("1번째 입원의 상급병실"));
    check("② 상급병실료에서는 치료 형태를 숨김", !scr.has("치료 형태"));
    // 안내만 뜨고 고를 수단이 없는 상태(2ee330d의 결함)를 직접 배제한다.
    h.set("submitted", true);
    const warned = h.render();
    check("② 질환 구분 안내가 뜨면 선택창도 함께 있다",
      !warnings(warned).some((t) => t.includes("질환 구분을 선택")) || warned.has("질환 구분"));
  }

  // ③ 질환 구분 선택 → 원인이 나온다. 입력 폼은 아직 아니다.
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    h.set("severity", "non_critical");
    const scr = h.render();
    check("③ 질환 구분 선택 후: 원인 노출", scr.has("원인"));
    check("③ 질환 구분 선택 후: 입력 폼 미노출", !scr.has("1번째 입원의 상급병실"));
  }

  // ④ 원인 선택 → 입력 폼(차액 총액·입원일수)이 나온다.
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    h.set("severity", "non_critical");
    h.set("cause", "disease");
    const scr = h.render();
    check("④ 원인 선택 후: 차액 총액 입력 노출", scr.has("1번째 입원의 상급병실"));
    check("④ 원인 선택 후: 총 입원일수 입력 노출", scr.has("총 입원일수"));
    // G-8에서 라벨에 보장축이 들어갔다(값이 어느 축의 것인지 화면이 밝힌다).
    check("④ 원인 선택 후: 연간 가입금액 선택 입력 노출",
      scr.has("연간 보험가입금액 (비중증 질병비급여 보장축, 선택)"));
    check("④ 입원일수 기본 빈 값이라 아직 결과 없음", scr.resultItems() === null);
    // 숨겨야 할 입력들
    for (const hidden of ["의료기관 종별", "통원 보험가입금액", "연간 보상 횟수",
      "이미 누적된 공제금액", "약제 용도", "승인"]) {
      check(`④ ${hidden} 미노출`, !scr.has(hidden), hidden);
    }
  }

  // ⑤ 잘못된 입력은 엔진을 호출하지 않는다. 명시적 0은 유효값이다.
  {
    const CASES: [string, string, string, boolean][] = [
      // 금액, 일수, 설명, 차단되어야 하는가
      ["", "10", "빈 금액", true],
      ["   ", "10", "공백 금액", true],
      [" 1800000", "10", "앞 공백", true],
      ["1800000 ", "10", "뒤 공백", true],
      ["abc", "10", "문자 금액", true],
      ["-100", "10", "음수 금액", true],
      ["+100", "10", "부호 붙은 금액", true],
      ["1.5", "10", "소수(원 단위 아님)", true],
      ["1.2.3", "10", "잘못된 소수", true],
      ["1.", "10", "끝이 점인 소수", true],
      [".5", "10", "점으로 시작하는 소수", true],
      ["Infinity", "10", "Infinity", true],
      ["NaN", "10", "NaN", true],
      ["1e6", "10", "지수 표기", true],
      // ⚠ 쉼표를 먼저 지우고 검사하면 아래가 전부 정상 금액으로 바뀐다.
      ["1,2", "10", "쉼표 뒤 자릿수 부족(1,2)", true],
      ["1,,000", "10", "연속 쉼표(1,,000)", true],
      [",100", "10", "앞 쉼표(,100)", true],
      ["100,", "10", "뒤 쉼표(100,)", true],
      ["12,34,567", "10", "자릿수 어긋난 쉼표(12,34,567)", true],
      ["1,23,456", "10", "자릿수 어긋난 쉼표(1,23,456)", true],
      ["1,0000", "10", "쉼표 뒤 4자리(1,0000)", true],
      ["1,000.5", "10", "쉼표 + 소수", true],
      ["9007199254740993", "10", "안전 정수 범위 초과", true],
      ["1800000", "", "빈 일수", true],
      ["1800000", "0", "일수 0", true],
      ["1800000", "-1", "일수 음수", true],
      ["1800000", "2.5", "일수 소수", true],
      ["1800000", "abc", "일수 문자", true],
      ["0", "10", "명시적 0 (유효)", false],
      ["100", "10", "쉼표 없는 정수", false],
      ["1000", "10", "쉼표 없는 네 자리", false],
      ["1,000", "1", "천 단위 쉼표 1,000", false],
      ["12,345", "1", "천 단위 쉼표 12,345", false],
      ["1800000", "10", "정상", false],
      ["1,800,000", "10", "천 단위 쉼표 1,800,000", false],
      ["9007199254740991", "99999999999", "안전 정수 상한", false],
    ];
    for (const [amount, days, what, blocked] of CASES) {
      const h = fresh();
      h.set("nonBenefitItem", "room_charge");
      h.set("severity", "non_critical");
      h.set("cause", "disease");
      h.set("rcRows", [{ amount, days }]);
      h.set("submitted", true);
      const scr = h.render();
      check(`⑤ ${what} → ${blocked ? "계산 차단·안내" : "계산 진행"}`,
        rcWarned(scr) === blocked, `경고=${rcWarned(scr)}`);
      if (blocked) check(`⑤ ${what} → 결과 미표시`, scr.resultItems() === null);
    }
  }

  // ⑤-2 쉼표 표기가 **같은 금액**으로 해석된다(형식만 통과시키고 값이 어긋나면 안 된다).
  {
    const paid = (amount: string) => {
      const h = fresh();
      h.set("nonBenefitItem", "room_charge");
      h.set("severity", "non_critical");
      h.set("cause", "disease");
      h.set("rcRows", [{ amount, days: "10" }]);
      h.set("submitted", true);
      return h.render().resultItems()?.[0]?.value ?? null;
    };
    check("⑤-2 1,800,000 == 1800000", paid("1,800,000") === paid("1800000"), String(paid("1,800,000")));
    check("⑤-2 1,800,000 → 총 진료비 1,800,000원", paid("1,800,000") === "1,800,000원");
    check("⑤-2 12,345 → 총 진료비 12,345원", paid("12,345") === "12,345원");
  }

  // ⑥ 정상 입력 — 공식 예시가 화면에 그대로 나온다.
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    h.set("severity", "non_critical");
    h.set("cause", "disease");
    h.set("rcRows", [{ amount: "1800000", days: "10" }]);
    h.set("submitted", true);
    const items = h.render().resultItems();
    check("⑥ 예시 A: 결과 표시", items !== null);
    check("⑥ 예시 A: 총 진료비 1,800,000원",
      items?.[0]?.value === "1,800,000원", JSON.stringify(items));
    check("⑥ 예시 A: 총 본인부담금 900,000원", items?.[1]?.value === "900,000원");
    check("⑥ 예시 A: 총 보험 적용 금액 900,000원", items?.[2]?.value === "900,000원");
  }
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    h.set("severity", "non_critical");
    h.set("cause", "disease");
    h.set("rcRows", [{ amount: "1500000", days: "5" }]);
    h.set("submitted", true);
    const items = h.render().resultItems();
    check("⑥ 예시 B: 일 한도로 500,000원", items?.[2]?.value === "500,000원", JSON.stringify(items));
  }

  // ⑦ 여러 행 — 한 행만 잘못돼도 전체가 차단된다.
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    h.set("severity", "non_critical");
    h.set("cause", "disease");
    h.set("rcRows", [{ amount: "1800000", days: "10" }, { amount: "-1", days: "3" }]);
    h.set("submitted", true);
    const scr = h.render();
    check("⑦ 두 행 중 하나가 음수 → 전체 차단", rcWarned(scr) && scr.resultItems() === null);
    const h2 = fresh();
    h2.set("nonBenefitItem", "room_charge");
    h2.set("severity", "non_critical");
    h2.set("cause", "disease");
    h2.set("rcRows", [{ amount: "1,800,000", days: "10" }, { amount: "12,34,567", days: "3" }]);
    h2.set("submitted", true);
    const scr2 = h2.render();
    check("⑦ 두 행 중 하나가 잘못된 쉼표 형식 → 전체 차단",
      rcWarned(scr2) && scr2.resultItems() === null);
  }

  // ⑧ 되돌리기 — 질환 구분을 지우면 폼이 닫히고 결과가 사라진다.
  {
    const h = fresh();
    h.set("nonBenefitItem", "room_charge");
    h.set("severity", "non_critical");
    h.set("cause", "disease");
    h.set("rcRows", [{ amount: "1800000", days: "10" }]);
    h.set("submitted", true);
    check("⑧ 되돌리기 전 결과 있음", h.render().resultItems() !== null);
    h.set("severity", "");
    const scr = h.render();
    check("⑧ 질환 구분 해제 → 결과 사라짐", scr.resultItems() === null);
    check("⑧ 질환 구분 해제 → 입력 폼 닫힘", !scr.has("1번째 입원의 상급병실"));
    check("⑧ 질환 구분 해제 → 선택창은 여전히 있음", scr.has("질환 구분"));
  }

  // ⑨ 다른 항목의 화면 흐름은 그대로다(무회귀).
  {
    const h = fresh();
    h.set("nonBenefitItem", "general");
    const a = h.render();
    check("⑨ 일반 비급여: 질환 구분 노출", a.has("질환 구분"));
    check("⑨ 일반 비급여: 치료 형태 노출", a.has("치료 형태"));
    h.set("severity", "critical");
    check("⑨ 일반 비급여: 질환 구분 후 원인 노출", h.render().has("원인"));
    const g = fresh();
    g.set("nonBenefitItem", "mri");
    g.set("severity", "critical");
    const b = g.render();
    check("⑨ 중증 MRI: 원인 미노출(상해·질병 합산)", !b.has("원인"));
  }
}

// ── 가드: 공용 num()이 상급병실료 금액 경로에 다시 연결되지 않는다 ──
{
  console.log("\n[가드] 금액 파서");
  const uiRaw = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("전용 파서가 존재한다", /const roomChargeAmount = \(v: string\): number \| null =>/.test(uiRaw));
  // ⚠ 핵심: **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
  //   되돌려 `replace(/,/g, "")`를 먼저 하면 1,2 → 12처럼 잘못된 입력이 정상 금액이 된다.
  {
    const body = /const roomChargeAmount = \(v: string\): number \| null => \{([\s\S]*?)\n\};/.exec(uiRaw);
    check("전용 파서 본문을 찾음", body !== null);
    const fn = body === null ? "" : body[1];
    const testAt = fn.indexOf(".test(v)");
    const stripAt = fn.indexOf('replace(/,/g, "")');
    check("전용 파서: 형식 검증이 원문 v에 대해 먼저 일어난다",
      testAt >= 0 && stripAt >= 0 && testAt < stripAt, fn.trim());
    check("전용 파서: 검증 전에 문자열을 변형하지 않는다",
      !/(replace|trim|normalize)\(/.test(fn.slice(0, testAt < 0 ? fn.length : testAt)), fn.trim());
    check("전용 파서: 숫자가 아닌 문자를 지우지 않는다",
      !/replace\(\/\[\^0-9/.test(fn));
  }
  check("형식이 쉼표 없는 정수 또는 정확한 천 단위 구분만 허용",
    /const ROOM_CHARGE_AMOUNT_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\//.test(uiRaw));
  check("전용 파서가 안전 정수·음수 아님을 확인",
    /Number\.isSafeInteger\(n\) && n >= 0 \? n : null/.test(uiRaw));
  check("전용 파서가 소수를 허용하지 않는다", !/\\\.\[0-9\]/.test(uiRaw.slice(uiRaw.indexOf("ROOM_CHARGE_AMOUNT_FORMAT"), uiRaw.indexOf("export default"))));
  const flat = uiRaw.replace(/\s+/g, " ");
  check("roomChargeTotal은 전용 파서 결과만 받는다",
    /roomChargeTotal: roomChargeAmount\(r\.amount\) as number/.test(flat)
    && !/roomChargeTotal: num\(/.test(flat));
  check("rcIncomplete가 금액과 일수를 모두 검사한다",
    /rcRows\.some\(\(r\) => roomChargeAmount\(r\.amount\) === null \|\| positiveDays\(r\.days\) === null\)/.test(flat));
  check("게이트가 질환 구분·원인을 단계로 요구한다",
    /const showRoomChargeCause = isRoomCharge && severity !== "";/.test(flat)
    && /const showRoomChargeForm = showRoomChargeCause && cause !== "";/.test(flat));
  check("질환 구분 선택창이 상급병실료에서 숨겨지지 않는다",
    !/nonBenefitItem !== "" && !isRoomCharge && <label[^§]{0,60}>질환 구분/.test(flat));
  check("안내 문구가 금액과 일수를 함께 말한다",
    flat.includes("각 입원의 <b>차액 총액</b>과 <b>총 입원일수</b>를 올바르게 입력해 주세요"));
}


console.log(`\n[상급병실료 차액] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
