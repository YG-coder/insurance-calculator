import { REGULATORY_RULES as rules } from "./insurance/engine/regulatoryRules";
const selectiveTwo = rules.GEN23_SELECTIVE_II_COST_SHARE;

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const larger = (first: string, second: string) => `${first}, ${second} 중 큰 금액`;

const selectiveTwoFormula = `급여 본인부담금 × ${percent(selectiveTwo.value.benefit)} + 비급여 의료비 × ${percent(selectiveTwo.value.nonBenefit)}`;
const selectiveTwoOutpatient = larger("기관·처방별 정액", selectiveTwoFormula);
const gen3StandardRate = percent(rules.GEN2017_INPATIENT_RATE_STANDARD.value);
const gen3RiderDeductible = larger(won(rules.GEN2017_RIDER_DEDUCT_MIN.value), `보장대상 의료비의 ${percent(rules.GEN2017_RIDER_DEDUCT_RATE.value)}`);

const gen23Deductibles = rules.GEN2017_OUTPATIENT_MIN_DEDUCTIBLE.value;
const gen4And5BenefitMinimum = `종합·상급종합병원 ${won(rules.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.value.hospital)}, 그 외 병·의원 ${won(rules.GEN2026_BENEFIT_OUTPATIENT_MIN_DEDUCTIBLE.value.clinic)}`;

export const silsonCopaymentTable = {
  caption: "일반 개인 실손보험 세대별 입원 자기부담과 통원 공제금액",
  headers: ["세대·담보", "입원 자기부담", "외래·처방조제 공제"],
  rows: [
    ["1세대", "가입 상품의 약관 기준", "가입 상품의 약관 기준"],
    ["2세대 선택형Ⅰ·초기 계약", `급여 본인부담금과 비급여 합계의 ${percent(rules.GEN2009_INPATIENT_RATE_SELECTIVE.value)} (해당 약관 기준)`, "기관·처방별 정액 공제 (해당 약관 기준)"],
    ["2세대 표준형", `급여 본인부담금과 비급여 합계의 ${percent(rules.GEN2009_INPATIENT_RATE_STANDARD.value)}`, larger("기관·처방별 정액", `보장대상 의료비의 ${percent(rules.GEN2009_OUTPATIENT_RATE_STANDARD.value)}`)],
    ["2세대 선택형Ⅱ", selectiveTwoFormula, selectiveTwoOutpatient],
    ["3세대 기본형 · 표준형", `급여 본인부담금과 비급여 합계의 ${gen3StandardRate}`, larger("기관·처방별 정액", `보장대상 의료비의 ${percent(rules.GEN2017_OUTPATIENT_RATE_STANDARD.value)}`)],
    ["3세대 기본형 · 선택형Ⅱ", selectiveTwoFormula, selectiveTwoOutpatient],
    ["3세대 3대 비급여 특약", gen3RiderDeductible, gen3RiderDeductible],
    ["4세대 급여", percent(rules.GEN2021_BENEFIT_INPATIENT_RATE.value), `의료비의 ${percent(rules.GEN2021_BENEFIT_OUTPATIENT_RATE.value)}와 최소공제액 중 큰 금액. 종합·상급종합병원 ${won(rules.GEN2021_BENEFIT_OUTPATIENT_HOSPITAL_MIN.value)}, 그 외 병·의원 ${won(rules.GEN2021_BENEFIT_OUTPATIENT_CLINIC_MIN.value)}`],
    ["4세대 일반 비급여", percent(rules.GEN2021_NON_BENEFIT_INPATIENT_RATE.value), larger(won(rules.GEN2021_NON_BENEFIT_OUTPATIENT_MIN.value), `의료비의 ${percent(rules.GEN2021_NON_BENEFIT_OUTPATIENT_RATE.value)}`)],
    ["4세대 3대 비급여", larger(won(rules.GEN2021_RIDER_MIN_DEDUCTIBLE.value), `보장대상 의료비의 ${percent(rules.GEN2021_RIDER_DEDUCT_RATE.value)}`), "입원과 같은 특약 공제 기준"],
    ["5세대 급여", percent(rules.GEN2026_BENEFIT_INPATIENT_RATE.value), `보장대상 의료비에 건강보험 본인부담률을 곱한 금액, 의료비의 ${percent(rules.GEN2026_BENEFIT_OUTPATIENT_FLOOR_RATE.value)}, 최소공제액 중 가장 큰 금액. ${gen4And5BenefitMinimum}`],
    ["5세대 중증 비급여 일반담보", percent(rules.GEN2026_CRITICAL_INPATIENT_RATE.value), larger(won(rules.GEN2026_CRITICAL_OUTPATIENT_MIN.value), `의료비의 ${percent(rules.GEN2026_CRITICAL_OUTPATIENT_RATE.value)}`)],
    ["5세대 비중증 비급여 일반담보", percent(rules.GEN2026_NONCRITICAL_INPATIENT_RATE.value), larger(won(rules.GEN2026_NONCRITICAL_OUTPATIENT_MIN.value), `의료비의 ${percent(rules.GEN2026_NONCRITICAL_OUTPATIENT_RATE.value)}`)],
  ],
};

export const gen23OutpatientAmounts = `의원급 ${won(gen23Deductibles.clinic)}, 병원·종합병원 등 ${won(gen23Deductibles.hospital)}, 상급종합병원 등 ${won(gen23Deductibles.tertiary)}, 처방조제 ${won(gen23Deductibles.pharmacy)}`;

export const gen3CopaymentAnswer = `3세대 기본형 표준형의 입원 자기부담률은 급여 본인부담금과 비급여 합계의 ${gen3StandardRate}입니다. 선택형Ⅱ는 ${selectiveTwoFormula}로 계산합니다. 외래와 처방조제는 각각 약관에 적힌 정액과 계약 유형별 정률 계산액을 비교해 큰 금액을 공제합니다. 도수치료 등·비급여 주사·비급여 MRI/MRA 특약의 1회당 공제액은 ${gen3RiderDeductible}입니다.`;
