// 비중증 비급여 입원 1회당 300만원 한도 — **적용 대상 의료기관** 가드.
//
// 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특별약관2 제3조 (1)상해비급여 제1항 <구분·보상금액> 입원 행, 인쇄 p.287
//   특별약관2 제3조 (2)질병비급여 제1항 <구분·보상금액> 입원 행, 인쇄 p.290
//     "…의 50%에 해당하는 금액. 다만, 「의료법」 제3조제2항에 의한 의료기관(동법 제3조의3에
//      의한 종합병원은 제외)에서 발생한 비급여 의료비는 1회당 300만원을 한도로 합니다."
//
// 종전 구현은 tier를 보지 않고 모든 비중증 입원에 300만원 한도를 걸어 상급종합·종합병원
// 입원에서 보험금을 **과소 산출**했다. 진료비 1,000만원 기준 200만원 차이다.
import { readFileSync } from "node:fs";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { Cause, Tier } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const N = GEN2026.nonBenefit.nonCritical;
const one = (amount: number, tier: Tier | undefined) =>
  calc2026({ amount, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient", tier });
const many = (amounts: number[], tier: Tier | undefined, cause: Cause = "disease") =>
  calculateMany2026({ cause, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient", tier, amounts });

console.log("\n[비중증 입원 300만 한도] 근거·레지스트리 추적");
check("한도 300만원", N.inpatientPerVisitLimit === 3_000_000
  && N.inpatientPerVisitLimit === REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT.value);
check("적용 대상은 병·의원급뿐", JSON.stringify([...N.inpatientPerVisitLimitTiers]) === JSON.stringify(["clinic"]));
check("적용 대상이 레지스트리에서 파생",
  N.inpatientPerVisitLimitTiers === REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT_TIERS.value);
check("적용 대상 규칙이 종합병원 제외를 밝힘",
  (REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT_TIERS.note ?? "").includes("종합병원"));
check("출처가 두 조문·쪽수를 모두 인용",
  REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT_TIERS.sources
    .every((src) => src.locator.includes("p.287") && src.locator.includes("p.290")));
check("검증일 기록", REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT_TIERS.verifiedAt === "2026-09-03");

console.log("\n[단건] 종별에 따라 한도가 갈린다");
{
  const clinic = one(10_000_000, "clinic");
  const hosp = one(10_000_000, "hospital");
  check("병·의원급 1천만 → 보험금 300만", clinic.insurancePay === 3_000_000 && clinic.ownPay === 7_000_000, JSON.stringify(clinic));
  check("상급종합·종합 1천만 → 보험금 500만", hosp.insurancePay === 5_000_000 && hosp.ownPay === 5_000_000, JSON.stringify(hosp));
  check("CapCode는 병·의원급에서만", clinic.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT")
    && !hosp.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"));
  check("공제금액은 종별과 무관하게 50%", clinic.deductibleApplied === 5_000_000 && hosp.deductibleApplied === 5_000_000);
  check("자기부담률 표기는 둘 다 50%", clinic.rateApplied === 0.5 && hosp.rateApplied === 0.5);
}

console.log("\n[단건] 경계 — 600만원 전후 (50%가 정확히 300만원이 되는 지점)");
{
  const under = one(5_999_998, "clinic");
  const exact = one(6_000_000, "clinic");
  const over = one(6_000_002, "clinic");
  check("600만 미만은 미구속", under.insurancePay === 2_999_999 && !under.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"), JSON.stringify(under));
  check("정확히 600만은 미구속", exact.insurancePay === 3_000_000 && !exact.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"), JSON.stringify(exact));
  check("600만 초과는 구속", over.insurancePay === 3_000_000 && over.ownPay === 3_000_002 && over.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"), JSON.stringify(over));
  // 상급종합·종합병원에는 같은 구간에서도 한도가 걸리지 않는다.
  check("상급종합 600만 초과는 50% 그대로", one(6_000_002, "hospital").insurancePay === 3_000_001);
}

console.log("\n[다회] 상해·질병 양쪽 · 종별 양쪽");
for (const cause of ["injury", "disease"] as Cause[]) {
  const clinic = many([10_000_000, 10_000_000], "clinic", cause);
  const hosp = many([10_000_000, 10_000_000], "hospital", cause);
  check(`${cause} 병·의원급 두 건 → 600만`, clinic.totalInsurancePay === 6_000_000, JSON.stringify(clinic.totalInsurancePay));
  check(`${cause} 상급종합 두 건 → 1,000만`, hosp.totalInsurancePay === 10_000_000, JSON.stringify(hosp.totalInsurancePay));
  check(`${cause} CapCode는 병·의원급에서만`,
    clinic.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT")
    && !hosp.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"));
}

console.log("\n[안전 차단] 종별 미지정·잘못된 값");
{
  const none = one(10_000_000, undefined);
  check("종별 미지정 → 계산 불가", none.status === "PENDING_UNVERIFIED" && none.ownPay === null, JSON.stringify(none));
  check("차단 사유가 조문과 이유를 밝힘",
    none.notes.some((n) => n.includes("「의료법」 제3조제2항") && n.includes("보험금이 달라집니다")), JSON.stringify(none.notes));
  const bogus = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient", tier: "bogus" as never });
  check("잘못된 종별 → 계산 불가", bogus.status === "PENDING_UNVERIFIED" && bogus.ownPay === null, JSON.stringify(bogus));
  check("잘못된 종별이 병·의원급으로 떨어지지 않음", bogus.insurancePay === null);
  const manyNone = many([10_000_000], undefined);
  check("다회도 종별 미지정이면 차단", manyNone.status === "PENDING_UNVERIFIED" && manyNone.lines.length === 0);
}

console.log("\n[중증 입원] 종별 미지정도 차단한다");
{
  // 중증도 종별에 따라 공제금액 상한 500만원(특약1 제5조⑤) 적용 여부가 갈린다.
  const none = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient" });
  check("중증 입원 종별 미지정 → 계산 불가", none.status === "PENDING_UNVERIFIED" && none.ownPay === null, JSON.stringify(none));
  check("중증 차단 사유가 500만원 상한을 밝힘", none.notes.some((n) => n.includes("공제금액 상한 500만원은 상급종합·종합병원 입원에만")), JSON.stringify(none.notes));
  const bogus = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "bogus" as never });
  check("중증 입원 잘못된 종별 → 계산 불가", bogus.status === "PENDING_UNVERIFIED" && bogus.insurancePay === null);
  const manyNone = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", amounts: [10_000_000] });
  check("중증 다회도 첫 행 전에 차단", manyNone.status === "PENDING_UNVERIFIED" && manyNone.lines.length === 0, JSON.stringify(manyNone.notes));
  const ok = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "clinic" });
  check("종별을 고르면 정상 계산", ok.status === "OK" && ok.insurancePay === 7_000_000);
}

console.log("\n[무회귀] 다른 축은 그대로");
{
  // 중증 입원은 종별이 500만 pool만 좌우한다. 300만 한도는 원래 없다.
  const crit = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "clinic" });
  check("중증 입원에는 300만 한도 없음", crit.insurancePay === 7_000_000 && !crit.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"));
  // 비중증 통원은 이 한도와 무관하다.
  const out = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient" });
  check("비중증 통원은 종별을 요구하지 않음", out.status === "OK" && out.insurancePay === 5_000_000, JSON.stringify(out));
  const ben = calc2026({ amount: 10_000_000, coverage: "benefit", visit: "inpatient" });
  check("급여 입원 불변", ben.status === "OK" && ben.insurancePay === 8_000_000);
}

console.log("\n[가드] 소스에 종별 조건이 실제로 연결돼 있다");
{
  const eng = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("한도를 종별로 고른다", /limitTiers\.includes\(input\.tier\) \? n\.inpatientPerVisitLimit : undefined/.test(eng));
  check("한도를 무조건 적용하지 않음", !/settle\(amount, amount \* rate, n\.inpatientPerVisitLimit\)/.test(eng));
  check("종별 미지정을 막는다", /input\.tier !== "clinic" && input\.tier !== "hospital"/.test(eng));
  check("적용 대상 목록을 상수에서 읽는다", /n\.inpatientPerVisitLimitTiers/.test(eng));
  check("소스에 종별 목록을 다시 나열하지 않음", !/\["clinic"\]/.test(eng));
  const eng2 = eng;
  check("중증 입원도 종별 미지정을 막는다",
    /중증 비급여 입원: 의료기관 종별 미지정/.test(eng2) && (eng2.match(/input\.tier !== "clinic" && input\.tier !== "hospital"/g) ?? []).length === 2);
  const ui = [
    readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8"),
    readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8"),
  ].map((x) => x.replace(/\s+/g, " "));
  check("단건 UI가 비중증 입원에도 종별을 노출", /severity !== null && visit === "inpatient"/.test(ui[0]));
  check("다회 UI가 비중증 입원에도 종별을 노출", /showGeneralForm && severity !== "" && visit === "inpatient"/.test(ui[1]));
  for (const [i, name] of [[0, "단건"], [1, "다회"]] as const) {
    check(`${name} UI가 300만 한도의 적용 대상을 안내`,
      ui[i].includes("종합병원을 제외한 곳") && ui[i].includes("상급종합·종합병원 입원에는 적용하지 않습니다"));
  }

  // ── 종별 자동 선택 금지 — 화면마다 따로 검사한다 ──────────────────
  //   ⚠ 엔진 테스트는 tier: undefined를 직접 넣어야 차단을 본다. 화면이 기본값을 넣어 두면
  //     사용자는 그 차단을 만나지 못한다. 초기값·빈 선택지·계산 게이트를 각각 강제한다.
  check("단건: 비급여 입원 종별 초기값이 미선택",
    /const \[nbInpatientTier, setNbInpatientTier\] = useState<Tier \| null>\(null\)/.test(ui[0]));
  check("다회: 비급여 입원 종별 초기값이 미선택",
    /const \[nbInpatientTier, setNbInpatientTier\] = useState<Tier \| "">\(""\)/.test(ui[1]));
  check("단건: 비급여 종별이 clinic으로 자동 선택되지 않음",
    !/useState<Tier \| null>\("clinic"\)/.test(ui[0]) && !/const \[tier, setTier\] = useState<Tier>\("clinic"\)/.test(ui[0]));
  check("다회: 비급여 종별이 clinic으로 자동 선택되지 않음",
    !/const \[tier, setTier\] = useState<Tier>\("clinic"\)/.test(ui[1]));
  check("다회: 입원 의료기관 선택지에 빈 값이 있음",
    /입원 의료기관<select[^§]{0,200}<option value="">선택해 주세요<\/option><option value="clinic">/.test(ui[1]));
  check("단건: 두 종별 버튼 중 어느 것도 초기 선택되지 않음",
    /btn\(nbInpatientTier === "clinic"\)/.test(ui[0]) && /btn\(nbInpatientTier === "hospital"\)/.test(ui[0]));
  // 계산 게이트 연결 — 변수 존재만 보면 게이트에서 빠져도 통과한다.
  check("단건: needsTier가 계산 게이트에 연결",
    /const needsTier =[\s\S]{0,220}nbInpatientTier === null;/.test(ui[0])
    && /needsItem \|\| needsSeverity \|\| needsTier \? null/.test(ui[0]));
  check("다회: needsTier가 일반 비급여 게이트에 연결",
    /nonBenefitItem === "general" && severity !== "" && cause !== "" && !needsTier/.test(ui[1]));
  check("다회: 일반 전환 게이트도 종별 미선택을 배제",
    /visit === "inpatient" && nbInpatientTier === ""/.test(ui[1]));
  // ── 안내 순서 — 아직 보이지 않는 입력을 선택하라고 하지 않는다 ─────────
  //   단건의 종별 입력은 질환 구분을 고른 뒤에야 나타난다. 소스에서 게이트 식을 그대로
  //   꺼내 상태를 넣고 평가한다(문자열 존재 검사가 아니라 실제 조건을 계산한다).
  {
    const src = readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8");
    const grab = (name: string) => {
      const m = src.match(new RegExp(`const ${name} =([^;]*);`));
      if (!m) throw new Error(`${name} 정의를 찾지 못했다`);
      return m[1].replace(/\/\/[^\n]*/g, " ").replace(/\s+/g, " ").trim();
    };
    const KEYS = ["coverage", "nonBenefitItem", "severity", "visit", "nbInpatientTier"] as const;
    type State = Record<(typeof KEYS)[number], unknown>;
    const evalGate = (expr: string, st: State): boolean =>
      (Function(...KEYS, `return (${expr});`) as (...a: unknown[]) => boolean)(...KEYS.map((k) => st[k]));
    const needsSeverityExpr = grab("needsSeverity");
    const needsTierExpr = grab("needsTier");
    const base: State = { coverage: "non_benefit", nonBenefitItem: "general", severity: null, visit: "inpatient", nbInpatientTier: null };
    check("단건: 질환 구분 미선택이면 종별 안내가 뜨지 않음",
      evalGate(needsSeverityExpr, base) === true && evalGate(needsTierExpr, base) === false,
      `${needsSeverityExpr} / ${needsTierExpr}`);
    const picked: State = { ...base, severity: "non_critical" };
    check("단건: 질환 구분 선택 후 종별 미선택이면 종별 안내",
      evalGate(needsSeverityExpr, picked) === false && evalGate(needsTierExpr, picked) === true);
    const done: State = { ...picked, nbInpatientTier: "clinic" };
    check("단건: 종별까지 고르면 두 안내 모두 사라짐",
      evalGate(needsSeverityExpr, done) === false && evalGate(needsTierExpr, done) === false);
    check("단건: 통원에는 종별 안내가 뜨지 않음",
      evalGate(needsTierExpr, { ...picked, visit: "outpatient" }) === false);
    check("단건: 급여에는 종별 안내가 뜨지 않음",
      evalGate(needsTierExpr, { ...picked, coverage: "benefit" }) === false);
    check("단건: 별도 보장종목에는 종별 안내가 뜨지 않음",
      evalGate(needsTierExpr, { ...picked, nonBenefitItem: "mri" }) === false);
  }
  check("다회: needsTier도 질환 구분 선택 후에만",
    /const needsTier = showGeneralForm && severity !== "" && visit === "inpatient" && nbInpatientTier === "";/.test(ui[1]));
  check("단건·다회 모두 미선택 안내가 있음",
    ui[0].includes("입원 의료기관을 선택해 주세요") && ui[1].includes("<b>입원 의료기관</b>을 선택해 주세요"));
  // 급여 경로는 종전 동작을 유지한다(새로 강제하지 않는다).
  for (const [i, name] of [[0, "단건"], [1, "다회"]] as const) {
    check(`${name}: 급여 종별은 종전 기본값 유지`,
      /useState<Tier>\("clinic"\)/.test(ui[i]) && /benefitTier/.test(ui[i]));
  }
  check("단건: 급여 계산이 benefitTier를 쓴다", /coverage: "benefit", visit, tier: benefitTier/.test(ui[0]));
  check("다회: 급여 계산이 benefitTier를 쓴다", /coverage: "benefit", visit, tier: benefitTier/.test(ui[1]));
  check("비급여 미선택을 급여 기본값으로 덮지 않음",
    !/nbInpatientTier \?\? "clinic"/.test(ui[0] + ui[1]) && !/nbInpatientTier \|\| "clinic"/.test(ui[0] + ui[1]));
}

console.log(`\n[비중증 입원 한도] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
