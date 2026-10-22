// 보험료 비중 계산기 (decision/)
// 역할: 사용자가 입력한 월 보험료가 소득에서 차지하는 비중만 계산한다.
// 원칙: 보험료를 추정하지 않는다(사용자 입력). 적정 비중을 제시하지 않는다.
//   - 순수 함수. 미입력 판정은 UI(빈 문자열).

export interface PremiumRatioInput {
  monthlyIncome: number;  // 월 소득(원) [C]
  monthlyPremium: number; // 월 보험료(원) [C]
}

export type PremiumRatioStatus = "OK" | "NEED_INCOME" | "OUT_OF_RANGE";

interface PremiumRatioReady {
  status: "OK" | "NEED_INCOME";
  ratioPercent: number | null; // 계산 참조용 근사값. 화면에는 ratioPercentText를 사용한다.
  ratioPercentText: string | null; // 정확한 정수 비율을 소수 둘째 자리에서 반올림한 한 자리 표시
  monthlyIncome: number;
  monthlyPremium: number;
  yearlyIncome: number;        // 월 소득 × 12
  yearlyPremium: number;       // 월 보험료 × 12
}

export type PremiumRatioResult = PremiumRatioReady | {
  status: "OUT_OF_RANGE";
  ratioPercent: null;
  ratioPercentText: null;
  monthlyIncome: null;
  monthlyPremium: null;
  yearlyIncome: null;
  yearlyPremium: null;
  note: string;
};

export function calcPremiumRatio(input: PremiumRatioInput): PremiumRatioResult {
  const blocked: PremiumRatioResult = {
    status: "OUT_OF_RANGE", ratioPercent: null, ratioPercentText: null, monthlyIncome: null, monthlyPremium: null,
    yearlyIncome: null, yearlyPremium: null,
    note: "정확하게 계산할 수 있는 범위를 벗어났습니다. 월 소득과 월 보험료를 줄여 다시 입력해 주세요.",
  };
  if ([input.monthlyIncome, input.monthlyPremium].some((value) =>
    !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER,
  )) return blocked;
  const monthlyIncome = nonNegativeInteger(input.monthlyIncome);
  const monthlyPremium = nonNegativeInteger(input.monthlyPremium);
  const yearlyIncome = monthlyIncome * 12;
  const yearlyPremium = monthlyPremium * 12;
  if (!Number.isSafeInteger(yearlyIncome) || !Number.isSafeInteger(yearlyPremium)) return blocked;

  // 소득 0이면 나눗셈 불가
  if (monthlyIncome === 0) {
    return {
      status: "NEED_INCOME",
      ratioPercent: null,
      ratioPercentText: null,
      monthlyIncome, monthlyPremium, yearlyIncome, yearlyPremium,
    };
  }

  const ratioPercent = (monthlyPremium / monthlyIncome) * 100;
  // 금액 정규화/상한 검사 뒤의 정수만 사용한다. %의 소수 한 자리까지
  // Number를 거치지 않고 반올림해 큰 비율과 정확히 절반인 경계도 보존한다.
  const numerator = BigInt(monthlyPremium) * 1000n;
  const denominator = BigInt(monthlyIncome);
  const tenths = numerator / denominator
    + (numerator % denominator * 2n >= denominator ? 1n : 0n);
  const ratioPercentText = `${tenths / 10n}.${tenths % 10n}`;
  return {
    status: "OK",
    ratioPercent, ratioPercentText,
    monthlyIncome, monthlyPremium, yearlyIncome, yearlyPremium,
  };
}
import { nonNegativeInteger } from "../common/number";
