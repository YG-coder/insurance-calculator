// 보험료 비중 계산기 (decision/)
// 역할: 사용자가 입력한 월 보험료가 소득에서 차지하는 비중만 계산한다.
// 원칙: 보험료를 추정하지 않는다(사용자 입력). 적정 비중을 제시하지 않는다.
//   - 순수 함수. 미입력 판정은 UI(빈 문자열).

export interface PremiumRatioInput {
  monthlyIncome: number;  // 월 소득(원) [C]
  monthlyPremium: number; // 월 보험료(원) [C]
}

export type PremiumRatioStatus = "OK" | "NEED_INCOME";

export interface PremiumRatioResult {
  status: PremiumRatioStatus;
  ratioPercent: number | null; // 보험료 비중(%) = 월 보험료 ÷ 월 소득 × 100
  monthlyIncome: number;
  monthlyPremium: number;
  yearlyIncome: number;        // 월 소득 × 12
  yearlyPremium: number;       // 월 보험료 × 12
}

const nonNeg = (v: number) => (isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function calcPremiumRatio(input: PremiumRatioInput): PremiumRatioResult {
  const monthlyIncome = nonNeg(input.monthlyIncome);
  const monthlyPremium = nonNeg(input.monthlyPremium);
  const yearlyIncome = monthlyIncome * 12;
  const yearlyPremium = monthlyPremium * 12;

  // 소득 0이면 나눗셈 불가
  if (monthlyIncome === 0) {
    return {
      status: "NEED_INCOME",
      ratioPercent: null,
      monthlyIncome, monthlyPremium, yearlyIncome, yearlyPremium,
    };
  }

  const ratioPercent = (monthlyPremium / monthlyIncome) * 100;
  return {
    status: "OK",
    ratioPercent,
    monthlyIncome, monthlyPremium, yearlyIncome, yearlyPremium,
  };
}
