import { GEN2021, GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import type { RegulatorySource } from "../src/lib/insurance/engine/regulatory";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const rules = Object.values(REGULATORY_RULES);
/** regulatoryRules.ts의 FSS_BYLAW15_URL(별표 검색 페이지). 판본 구분이 안 되는 주소다. */
const FSS_BYLAW15_URL_FOR_TEST =
  "https://www.law.go.kr/admRulBylSc.do?menuId=9&subMenuId=57&tabMenuId=267&query=%ED%91%9C%EC%A4%80%EC%95%BD%EA%B4%80";
const ids = rules.map((rule) => rule.ruleId);
const isConfirmedGradeValid = (rule: { status: string; evidenceGrade: string }) =>
  rule.status !== "CONFIRMED" || rule.evidenceGrade === "A";
const isHoldValueValid = (rule: { status: string; value: unknown }) =>
  rule.status !== "HOLD" || rule.value === null;

check("규제 규칙 ruleId 중복 없음", new Set(ids).size === ids.length);
check("모든 규칙에 검증일 존재", rules.every((rule) => /^\d{4}-\d{2}-\d{2}$/.test(rule.verifiedAt)));
check("모든 규칙에 문서명·발행기관·일자·URL·위치 존재", rules.every((rule) =>
  rule.sources.length > 0 && rule.sources.every((source) =>
    Boolean(source.document && source.issuer && source.publishedOrEffective && source.url && source.locator)
    && /^https?:\/\//.test(source.url)
  )
));
check("CONFIRMED 규칙은 A등급", rules.every(isConfirmedGradeValid));
check("CONFIRMED 등급 검사가 잘못된 REVIEW 사례를 거부", !isConfirmedGradeValid({ status: "CONFIRMED", evidenceGrade: "REVIEW" }));
check("등록된 HOLD 규칙은 계산값 미확정", rules.every(isHoldValueValid));
check("HOLD 값 검사가 잘못된 확정값 사례를 거부", !isHoldValueValid({ status: "HOLD", value: 10_000 }));
check("5세대 급여 통원 최소공제 출처가 PDF 쪽수까지 기록", REGULATORY_RULES.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.sources.every((source) => /PDF p\.4/.test(source.locator)));

// 런타임 상수가 메타데이터의 값에서 파생되는지 대표 경로를 고정한다.
check("4세대 급여 입원률 추적", GEN2021.rate.benefit.inpatient === REGULATORY_RULES.GEN2021_BENEFIT_INPATIENT_RATE.value);
check("4세대 급여 통원 최소공제 추적", GEN2021.outpatientMinDeductible.benefit.clinic === REGULATORY_RULES.GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN.value);
check("4세대 비급여 통원률 추적", GEN2021.rate.non_benefit.outpatient === REGULATORY_RULES.GEN2021_NON_BENEFIT_OUTPATIENT_RATE.value);
check("4세대 통원 한도 추적", GEN2021.outpatientPerVisitLimit === REGULATORY_RULES.GEN2021_OUTPATIENT_PER_VISIT_LIMIT.value);
check("4세대 연간 가입금액 상한 추적", GEN2021.annualLimitMaximum === REGULATORY_RULES.GEN2021_ANNUAL_LIMIT.value);
check("4세대 3대비급여 공제율 추적", GEN2021.rider.deductRate === REGULATORY_RULES.GEN2021_RIDER_DEDUCT_RATE.value);
check("4세대 3대비급여 최소공제 3만원 추적", GEN2021.rider.minDeductible === 30_000 && GEN2021.rider.minDeductible === REGULATORY_RULES.GEN2021_RIDER_MIN_DEDUCTIBLE.value);
check("4세대 도수치료 횟수 추적", GEN2021.rider.manual_therapy.annualVisits === REGULATORY_RULES.GEN2021_MANUAL_THERAPY_ANNUAL_VISITS.value);
const gen4RiderRules = rules.filter((rule) => rule.generation === "2021" && rule.sources[0]?.locator.includes("인쇄 p.251"));
check("4세대 3대비급여 규칙 7건은 재대조일 기록", gen4RiderRules.length === 7 && gen4RiderRules.every((rule) => rule.verifiedAt === "2026-09-03"));
check("그 밖의 4세대 규칙은 최초 직독일 유지", rules.filter((rule) => rule.generation === "2021" && !gen4RiderRules.includes(rule)).every((rule) => rule.verifiedAt === "2026-09-02"));
check("4세대 급여·비급여 출처 위치 분리", REGULATORY_RULES.GEN2021_BENEFIT_INPATIENT_RATE.sources[0].locator !== REGULATORY_RULES.GEN2021_NON_BENEFIT_INPATIENT_RATE.sources[0].locator);
check("4세대 3대비급여 금액·횟수 출처 위치 통일", REGULATORY_RULES.GEN2021_MANUAL_THERAPY_ANNUAL_LIMIT.sources[0].locator === REGULATORY_RULES.GEN2021_MANUAL_THERAPY_ANNUAL_VISITS.sources[0].locator);
check("4세대 3대비급여 출처는 인쇄 p.251로 특정", REGULATORY_RULES.GEN2021_RIDER_MIN_DEDUCTIBLE.sources[0].locator.includes("인쇄 p.251"));
check("5세대 급여 통원 최소공제 추적", GEN2026.benefit.outpatient.minDeductible === REGULATORY_RULES.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.value);
check("5세대 중증 공제금액 상한 추적", GEN2026.nonBenefit.critical.annualDeductibleCap === REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.value);
check("5세대 비중증 입원 한도 추적", GEN2026.nonBenefit.nonCritical.inpatientPerVisitLimit === REGULATORY_RULES.GEN2026_NONCRITICAL_INPATIENT_PER_VISIT_LIMIT.value);


// 2026-09-03 별표15 2026.5.6 연혁본(5세대 표준약관) 재대조분
// 2026-09-03 별표15 2026.5.6 연혁본 직독분. HOLD 규칙은 검증일이 달라 확정분만 본다.
//   ⚠ 날짜를 특정 값으로 못 박지 않는다. 나중에 같은 연혁본을 다시 읽고 규칙을
//     추가하면 그 규칙의 검증일은 더 뒤가 되는 것이 정상이다. 막아야 하는 것은
//     이미 확인한 규칙의 검증일이 조사 이전으로 되돌아가는 쪽이다.
const gen5Bylaw = rules.filter((rule) =>
  rule.generation === "2026" && rule.status === "CONFIRMED"
  && rule.sources[0]?.document.includes("2026. 5. 6. 연혁본"));
check(`5세대 표준약관 확정 규칙에 재대조일 기록 (${gen5Bylaw.length}건)`,
  gen5Bylaw.length >= 12 && gen5Bylaw.every((rule) => rule.verifiedAt >= "2026-09-03"),
  gen5Bylaw.filter((rule) => rule.verifiedAt < "2026-09-03").map((rule) => `${rule.ruleId}:${rule.verifiedAt}`).join(", "));

check("5세대 '연간' 기산점이 계약해당일 기준으로 등록",
  REGULATORY_RULES.GEN2026_ANNUAL_PERIOD_BASIS.value === "contract_anniversary");
check("5세대 기산점 근거가 제5조 제2항을 특정",
  REGULATORY_RULES.GEN2026_ANNUAL_PERIOD_BASIS.sources.every((s) => s.locator.includes("제5조")));
check("같은 날 통원 합산 규정 등록", REGULATORY_RULES.GEN2026_SAME_DAY_OUTPATIENT_MERGED.value === true);
check("5세대 통원 가입금액은 상한선으로 등록(계약값 아님)",
  GEN2026.nonBenefit.critical.outpatientPerVisitLimitMax === REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT_MAX.value
  && Boolean(REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_PER_VISIT_LIMIT_MAX.note?.includes("계약값이 아니다")));
check("5세대 중증 통원 연간 횟수 추적",
  GEN2026.nonBenefit.critical.outpatientAnnualVisits === REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS.value);


// ── 2026-09-03 feature/ 4종 HOLD 근거 등록 ────────────────────────────
// 값을 만들지 않으면서 출처는 추적한다. note는 "확인된 근거"와 "막힌 이유"를 나눠 적는다.
const HOLD_RULES = [
  ["발달장애", REGULATORY_RULES.GEN2026_DEVELOPMENTAL_DISORDER_BENEFIT],
  ["임신·출산", REGULATORY_RULES.GEN2026_PREGNANCY_CHILDBIRTH_BENEFIT],
  ["비중증 제외항목", REGULATORY_RULES.GEN2026_NONCRITICAL_EXCLUSION_ITEMS],
  ["할인·할증 1단계 할인율", REGULATORY_RULES.GEN2026_PREMIUM_ADJ_TIER1_DISCOUNT_RATE],
  ["할인·할증 최종 보험료 적용", REGULATORY_RULES.GEN2026_PREMIUM_ADJ_FINAL_PREMIUM],
] as const;

for (const [name, rule] of HOLD_RULES) {
  check(`HOLD ${name}: 값이 확정되지 않음`, rule.status === "HOLD" && rule.value === null);
  // ⚠ 이번에 등록한 4건만 대상이다. 앞으로 다른 날 추가될 HOLD까지 이 날짜로
  //    강제하면 정상적인 신규 등록이 실패한다.
  check(`HOLD ${name}: 검증일이 실제 조사일(2026-09-03)`, rule.verifiedAt === "2026-09-03", rule.verifiedAt);
  check(`HOLD ${name}: 출처가 등록됨`, rule.sources.length > 0 && rule.sources.every((src) => Boolean(src.locator)));
  check(`HOLD ${name}: 확인된 근거를 명시`, Boolean(rule.note?.includes("확인됨")), rule.note);
  check(`HOLD ${name}: 막힌 이유를 근거와 분리해 명시`, Boolean(rule.note?.includes("막힌 이유")), rule.note);
}

check("HOLD 발달장애: '가입당시 태아' 조건이 빠지지 않음",
  Boolean(REGULATORY_RULES.GEN2026_DEVELOPMENTAL_DISORDER_BENEFIT.note?.includes("태아")));
check("HOLD 임신·출산: 조건부 보장(280일)과 일부 본인부담금을 명시",
  Boolean(REGULATORY_RULES.GEN2026_PREGNANCY_CHILDBIRTH_BENEFIT.note?.includes("280일"))
  && Boolean(REGULATORY_RULES.GEN2026_PREGNANCY_CHILDBIRTH_BENEFIT.note?.includes("일부 본인부담금")));
// ── 할인·할증: 확정된 것과 미확정인 것을 각각 강제한다 ────────────────
// 2026-09-03 약관 직독 전에는 전부 HOLD였다. 그때의 사유("등급 경계·할증률이 없다")는
// 감독규정만 보고 내린 판단이라 틀렸다. 확정값이 다시 HOLD로 되돌아가지 않도록 못 박는다.
{
  const A = REGULATORY_RULES;
  check("할인·할증 산정기간 확정", A.GEN2026_PREMIUM_ADJ_LOOKBACK.status === "CONFIRMED"
    && A.GEN2026_PREMIUM_ADJ_LOOKBACK.value === "renewal_minus_3months_month_end_prior_12months");
  check("할인·할증 산정기간이 '3개월 전 말일'을 명시",
    Boolean(A.GEN2026_PREMIUM_ADJ_LOOKBACK.note?.includes("3개월 전 말일")));
  check("할인·할증 적용 대상은 특별약관2 순보험료 총액",
    A.GEN2026_PREMIUM_ADJ_BASE.status === "CONFIRMED"
    && A.GEN2026_PREMIUM_ADJ_BASE.value === "special_terms2_net_premium_total");
  check("할인·할증 제외 대상은 장기요양 1·2등급 판정자",
    A.GEN2026_PREMIUM_ADJ_EXCLUDED_CLAIMS.status === "CONFIRMED"
    && A.GEN2026_PREMIUM_ADJ_EXCLUDED_CLAIMS.value === "ltc_grade_1_or_2_beneficiary");
  check("할인·할증 할증 적용 요건은 연간 지급실적 100만원 이상",
    A.GEN2026_PREMIUM_ADJ_SURCHARGE_THRESHOLD.status === "CONFIRMED"
    && A.GEN2026_PREMIUM_ADJ_SURCHARGE_THRESHOLD.value === 1_000_000);

  // 5단계 구간표 — 경계와 요율을 단계별로 검사한다.
  const tiers = A.GEN2026_PREMIUM_ADJ_TIERS.value;
  check("할인·할증 구간이 5단계", A.GEN2026_PREMIUM_ADJ_TIERS.status === "CONFIRMED" && tiers.length === 5);
  const expectTiers = [
    { tier: 1, kind: "discount", minInclusive: 0, maxExclusive: 1, relativity: null },
    { tier: 2, kind: "keep", minInclusive: 1, maxExclusive: 1_000_000, relativity: 1.0 },
    { tier: 3, kind: "surcharge", minInclusive: 1_000_000, maxExclusive: 1_500_000, relativity: 2.0 },
    { tier: 4, kind: "surcharge", minInclusive: 1_500_000, maxExclusive: 3_000_000, relativity: 3.0 },
    { tier: 5, kind: "surcharge", minInclusive: 3_000_000, maxExclusive: null, relativity: 4.0 },
  ];
  for (const want of expectTiers) {
    const got = tiers.find((t) => t.tier === want.tier);
    check(`할인·할증 ${want.tier}단계 경계·요율 고정`, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  }
  check("할인·할증 1단계 요율은 표에 값이 없으므로 null", tiers[0].relativity === null);

  // 미확정은 1단계 할인율과 최종 보험료 적용뿐이다.
  check("할인·할증 1단계 할인율은 HOLD",
    A.GEN2026_PREMIUM_ADJ_TIER1_DISCOUNT_RATE.status === "HOLD"
    && A.GEN2026_PREMIUM_ADJ_TIER1_DISCOUNT_RATE.value === null);
  check("할인·할증 1단계 할인율 사유가 '할증재원 배분'임을 명시",
    Boolean(A.GEN2026_PREMIUM_ADJ_TIER1_DISCOUNT_RATE.note?.includes("할증재원")));
  check("할인·할증 최종 보험료는 HOLD이며 별도 도메인 판단 기록",
    A.GEN2026_PREMIUM_ADJ_FINAL_PREMIUM.status === "HOLD"
    && A.GEN2026_PREMIUM_ADJ_FINAL_PREMIUM.value === null
    && Boolean(A.GEN2026_PREMIUM_ADJ_FINAL_PREMIUM.note?.includes("별도의 보험료 도메인")));

  // 출처 — 약관 세 판본과 감독규정을 모두 남겼는지
  const tierSources = A.GEN2026_PREMIUM_ADJ_TIERS.sources;
  check("할인·할증 구간표 출처가 별표15 특별약관2 제6조를 특정",
    tierSources.every((src) => src.locator.includes("특별약관2 제6조") || src.locator.includes("특별약관2(비중증 비급여 실손의료비) 제6조")));
  for (const [label, page] of [["2026. 5. 6.", "p.310"], ["2026. 7. 15. 시행본", "p.310"], ["2026. 9. 10. 시행 예정본", "p.311"]] as const) {
    check(`할인·할증 출처에 ${label} 기록(${page})`,
      tierSources.some((src) => src.document.includes(label) && src.locator.includes(page)));
  }
  // ── 판본별 출처 재현성 ────────────────────────────────────────────
  // 문서명·쪽수만 다르고 URL이 같으면, 검색 UI의 기본 선택 판본이 바뀌는 순간
  // 어느 문언을 읽었는지 재현할 수 없다. 판본 식별번호까지 강제한다.
  {
    const byl = tierSources.filter((src) => src.document.includes("별표 15"));
    check("할인·할증 출처 URL 3개가 서로 다름", new Set(byl.map((src) => src.url)).size === 3,
      byl.map((src) => src.url).join(" | "));
    check("할인·할증 출처가 검색 페이지 주소를 쓰지 않음",
      byl.every((src) => src.url !== FSS_BYLAW15_URL_FOR_TEST), byl.map((src) => src.url).join(" | "));
    // 시행일 ↔ 판본 식별번호 대응. 2026-09-03에 각 URL이 200이며 [시행] 표기가
    // 아래와 일치함을 확인했다.
    const SEQ_BY_EFFECTIVE: Record<string, string> = {
      "2026-05-06": "2200000108697",
      "2026-07-15": "2200000108867",
      "2026-09-10": "2200000108939",
    };
    for (const [effective, seq] of Object.entries(SEQ_BY_EFFECTIVE)) {
      const src = byl.find((x) => x.publishedOrEffective === effective);
      check(`할인·할증 ${effective} 출처의 식별번호가 ${seq}`,
        Boolean(src) && src!.url.includes(`admRulSeq=${seq}`), src?.url);
    }
    check("할인·할증 출처의 시행일이 세 판본 그대로",
      byl.map((src) => src.publishedOrEffective).sort().join(",") === "2026-05-06,2026-07-15,2026-09-10",
      byl.map((src) => src.publishedOrEffective).join(","));
    // locator에 재현 경로(별표 식별번호 + 조항 + 쪽수)가 남아 있는지
    for (const [effective, bylSeq, page] of [["2026-05-06", "3216359", "p.310"],
      ["2026-07-15", "3265643", "p.310"], ["2026-09-10", "3295613", "p.311"]] as const) {
      const src = byl.find((x) => x.publishedOrEffective === effective);
      check(`할인·할증 ${effective} locator에 재현 경로(${bylSeq}, ${page})`,
        Boolean(src) && src!.locator.includes(bylSeq) && src!.locator.includes(page)
        && src!.locator.includes("제6조"), src?.locator);
    }
    // 아직 시행 전인 판본을 "현재 시행 중"이라고 부르지 않는다.
    const notYet = byl.find((x) => x.publishedOrEffective === "2026-09-10");
    check("2026.9.10 시행 예정본을 현재 시행본이라 부르지 않음",
      Boolean(notYet) && !/현재 시행|현행본/.test(notYet!.document), notYet?.document);
    const inForce = byl.find((x) => x.publishedOrEffective === "2026-07-15");
    check("현재 시행 중인 판본이 무엇인지 문서명에 표시",
      Boolean(inForce) && inForce!.document.includes("현재 시행 중"), inForce?.document);
  }

  check("할인·할증 산정기간 출처에 감독규정 포함",
    A.GEN2026_PREMIUM_ADJ_LOOKBACK.sources.some((src) => src.document.includes("보험업감독규정")));

  // 금융위 2024.6.7. 보도자료를 5세대 근거로 쓰지 않는다.
  const premiumRules = [A.GEN2026_PREMIUM_ADJ_LOOKBACK, A.GEN2026_PREMIUM_ADJ_BASE,
    A.GEN2026_PREMIUM_ADJ_EXCLUDED_CLAIMS, A.GEN2026_PREMIUM_ADJ_TIERS,
    A.GEN2026_PREMIUM_ADJ_SURCHARGE_THRESHOLD, A.GEN2026_PREMIUM_ADJ_TIER1_DISCOUNT_RATE,
    A.GEN2026_PREMIUM_ADJ_FINAL_PREMIUM];
  check("할인·할증 규칙이 보도자료를 근거로 삼지 않음",
    premiumRules.every((rule) => rule.sources.every((src) => !/보도자료|낮은 보험료로/.test(src.document))));
}

check("HOLD 규칙은 CONFIRMED A등급 검사를 통과시키지 않음",
  HOLD_RULES.every(([, rule]) => rule.evidenceGrade === "REVIEW"));

// ── 판본별 출처가 "실제로 대조한 규칙"에만 머무는지 ────────────────────
// 2026-09-03 조사에서 세 판본(5.6 / 7.15 시행 / 9.10 시행 예정)을 모두 열어 대조한
// 것은 특별약관2 제6조③④뿐이다. 그 결과로 등록된 규칙이 아래 7개다.
//
// ⚠ ruleId 접두사(PREMIUM-ADJ)로 판별하지 않는다. 앞으로 다른 날 추가될 할인·할증
//   규칙까지 "이번 세 판본을 모두 인용하라"고 강제하게 되고, 그때는 다른 판본을
//   읽었을 수도 있다. 이번에 대조한 규칙을 이름으로 못 박는다.
const VERIFIED_IN_THREE_VERSIONS = new Set([
  "GEN2026-PREMIUM-ADJ-LOOKBACK",
  "GEN2026-PREMIUM-ADJ-BASE",
  "GEN2026-PREMIUM-ADJ-EXCLUDED-CLAIMS",
  "GEN2026-PREMIUM-ADJ-TIERS",
  "GEN2026-PREMIUM-ADJ-SURCHARGE-THRESHOLD",
  "GEN2026-PREMIUM-ADJ-TIER1-DISCOUNT-RATE",
  "GEN2026-PREMIUM-ADJ-FINAL-PREMIUM",
]);
const threeVersionRules = rules.filter((rule) => VERIFIED_IN_THREE_VERSIONS.has(rule.ruleId));
check(`세 판본 대조 규칙 ${VERIFIED_IN_THREE_VERSIONS.size}개가 모두 등록돼 있음`,
  threeVersionRules.length === VERIFIED_IN_THREE_VERSIONS.size,
  `${threeVersionRules.length}건만 발견`);

check("세 판본 대조 규칙은 세 판본을 모두 인용",
  threeVersionRules.every((rule) => {
    const byl = rule.sources.filter((src) => src.document.includes("별표 15"));
    return byl.length === 3
      && byl.some((s2) => s2.document.includes("2026. 5. 6."))
      && byl.some((s2) => s2.document.includes("2026. 7. 15."))
      && byl.some((s2) => s2.document.includes("2026. 8. 28."));
  }));

// 대조하지 않은 조문의 출처를 뒤 판본으로 갈아 끼우면 "읽지 않은 것을 읽었다"가 된다.
check("대조하지 않은 규칙에 뒤 판본 출처가 섞이지 않음",
  rules.filter((rule) => !VERIFIED_IN_THREE_VERSIONS.has(rule.ruleId))
    .every((rule) => rule.sources.every((src) =>
      !src.document.includes("2026. 8. 28") && !src.document.includes("2026. 7. 1"))));

// ⚠ "검색 페이지 주소를 영구 유지하라"고 강제하지 않는다. 다른 규칙도 원문을 직접
//   재대조하면 판본별 직행 링크로 승격하는 것이 정상적인 개선이다. 여기서 막는 것은
//   이번에 확보한 세 주소가 대조 범위 밖으로 새어 나가는 것뿐이다.
const THIS_SURVEY_URLS = [
  "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108697",
  "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108867",
  "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108939",
];
/**
 * 2026-09-03에 **2026.5.6 판본만** 직접 읽어 판본 직행 주소로 승격한 규칙들.
 *   할인·할증 7건과 달리 세 판본을 대조하지 않았으므로, 이 규칙들에는
 *   2026.5.6 주소만 허용하고 7.15·9.10 주소는 계속 금지한다.
 */
const VERIFIED_2026_05_06_DIRECT = new Set([
  "GEN2026-THIRD-DEDUCTIBLE-FIXED", "GEN2026-THIRD-DEDUCTIBLE-RATE",
  "GEN2026-MSK-ANNUAL-COVERAGE", "GEN2026-MSK-ANNUAL-VISITS",
  "GEN2026-MSK-INITIAL-APPROVED-VISITS", "GEN2026-MSK-APPROVAL-STEP",
  "GEN2026-INJECTION-ANNUAL-COVERAGE", "GEN2026-INJECTION-ANNUAL-VISITS",
  "GEN2026-CRITICAL-MRI-ANNUAL-COVERAGE",
  "GEN2026-NONCRITICAL-MRI-DEDUCTIBLE-FIXED", "GEN2026-NONCRITICAL-MRI-DEDUCTIBLE-RATE",
  "GEN2026-NONCRITICAL-MRI-ANNUAL-COVERAGE",
  "GEN2026-SPECIAL-ITEM-CAUSE-MERGED", "GEN2026-SPECIAL-ITEM-SEPARATE-FROM-GENERAL-LIMITS",
  "GEN2026-THIRD-DEDUCT-UNIT", "GEN2026-INJECTION-GENERAL-ROUTE-DRUGS",
  "GEN2026-NONCRITICAL-MSK-INJECTION-GENERAL-ROUTE", "GEN2026-SPECIAL-ITEM-CARRYOVER-BASIS",
  "GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY",
  // 2026-09-03 재직독 — 특약2 (1)①·(2)① 입원 행의 1회당 300만원 한도와 그 적용 대상.
  "GEN2026-NONCRITICAL-INPATIENT-PER-VISIT-LIMIT",
  "GEN2026-NONCRITICAL-INPATIENT-PER-VISIT-LIMIT-TIERS",
  // 2026-09-03 재직독 — 특약1·2 (1)(2) 표의 상급병실료 차액 행(인쇄 p.258·261·287·290)과
  //   용어 정의(p.257), 연간 보험가입금액 조문(p.279·308).
  //   5.6 판본만 직접 읽었으므로 7.15·9.10 주소는 여전히 금지된다.
  "GEN2026-ROOM-CHARGE-PAY-RATE", "GEN2026-ROOM-CHARGE-DAILY-PAY-CAP",
  "GEN2026-ROOM-CHARGE-DAILY-CAP-BASIS", "GEN2026-ROOM-CHARGE-SHARES-ANNUAL-LIMIT",
  "GEN2026-ROOM-CHARGE-CAUSE-SEPARATED",
  "GEN2026-ROOM-CHARGE-EXCLUDED-FROM-INPATIENT-MEDICAL",
  "GEN2026-ROOM-CHARGE-DEDUCTIBLE-POOL",
]);
const VERSION_5_6_URL = "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108697";
const leaked = rules
  .filter((rule) => !VERIFIED_IN_THREE_VERSIONS.has(rule.ruleId))
  .flatMap((rule) => rule.sources
    .filter((src) => THIS_SURVEY_URLS.includes(src.url)
      && !(src.url === VERSION_5_6_URL && VERIFIED_2026_05_06_DIRECT.has(rule.ruleId)))
    .map((src) => `${rule.ruleId} → ${src.url}`));
check("판본 직행 주소가 대조 범위 밖으로 누출되지 않음", leaked.length === 0, leaked.join(" | "));

// 직독 규칙은 실제로 판본 직행 주소와 별표 식별번호를 달고 있어야 한다.
const directRules = rules.filter((rule) => VERIFIED_2026_05_06_DIRECT.has(rule.ruleId));
check(`2026.5.6 직독 규칙 ${VERIFIED_2026_05_06_DIRECT.size}개가 모두 등록돼 있음`,
  directRules.length === VERIFIED_2026_05_06_DIRECT.size,
  `${directRules.length}개만 발견`);
// 직독 규칙은 판본 직행 주소를 **반드시 하나 이상** 달고 있어야 하고,
// 그 직행 출처는 별표 식별번호와 인쇄 쪽수를 모두 갖춰야 한다.
// (2026-09-03: 상급병실료 규칙 2건이 원문 외 출처를 함께 단다 —
//  적용 순서 확인용 보조 근거 1건과, 기존 연혁본 검색 주소 1건.
//  느슨하게 풀지 않고, 원문 출처의 요건은 그대로 두고 원문 아닌 출처를 따로 검증한다.)
const directOf = (rule: { sources: readonly RegulatorySource[] }) =>
  rule.sources.filter((src) => src.url === VERSION_5_6_URL);
check("직독 규칙은 2026.5.6 판본 주소를 하나 이상 사용",
  directRules.every((rule) => directOf(rule).length > 0),
  directRules.filter((r) => directOf(r).length === 0).map((r) => r.ruleId).join(" | "));
check("직독 규칙 출처에 별표 식별번호 3216359가 있음",
  directRules.every((rule) => directOf(rule).every((src) => src.locator.includes("3216359"))));
check("직독 규칙 출처에 인쇄 쪽수가 있음",
  directRules.every((rule) => directOf(rule).every((src) => /인쇄 p\.\d/.test(src.locator))));
// 직행 주소가 아닌 출처는 (a) 같은 별표 15 연혁본이거나 (b) 보조 근거라고 명시돼 있어야 한다.
// 라벨 없는 제3자 출처가 확정 규칙에 조용히 섞이는 것을 막는다.
const AUX_LABEL = "보조 근거";
const unlabeledAux = directRules.flatMap((rule) => rule.sources
  .filter((src) => src.url !== VERSION_5_6_URL)
  .filter((src) => !src.document.includes("[별표 15] 표준약관") && !src.document.includes(AUX_LABEL))
  .map((src) => `${rule.ruleId} → ${src.document}`));
check("직독 규칙의 원문 외 출처는 별표 15이거나 보조 근거로 명시됨",
  unlabeledAux.length === 0, unlabeledAux.join(" | "));
// 보조 근거는 값의 근거가 아니라 적용 순서 확인용이다. 쓰이는 규칙을 고정한다.
const AUX_ALLOWED_RULES = new Set(["GEN2026-ROOM-CHARGE-DAILY-CAP-BASIS"]);
const auxUsers = rules
  .filter((rule) => rule.sources.some((src) => src.document.includes(AUX_LABEL)))
  .map((rule) => rule.ruleId);
check("보조 근거는 지정된 규칙에서만 쓰인다",
  auxUsers.every((id) => AUX_ALLOWED_RULES.has(id)) && auxUsers.length === AUX_ALLOWED_RULES.size,
  auxUsers.join(" | "));
check("보조 근거는 5세대 원문이 아니라고 표시됨",
  rules.flatMap((r) => r.sources).filter((src) => src.document.includes(AUX_LABEL))
    .every((src) => src.document.includes("표준약관 원문 아님")));
check("직독 규칙에 뒤 판본 주소가 섞이지 않음",
  directRules.every((rule) => rule.sources.every((src) =>
    !src.url.includes("2200000108867") && !src.url.includes("2200000108939"))));

check("계산에 쓰이는 5세대 확정 규칙은 2026.5.6 연혁본 출처를 유지",
  rules.filter((rule) => rule.generation === "2026" && rule.status === "CONFIRMED"
    && !VERIFIED_IN_THREE_VERSIONS.has(rule.ruleId)
    && rule.sources.some((src) => src.document.includes("별표 15")))
    .every((rule) => rule.sources.every((src) =>
      !src.document.includes("별표 15") || src.document.includes("2026. 5. 6. 연혁본"))));

console.log(`\n[regulatoryRules] 규칙 ${rules.length}개 · 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
