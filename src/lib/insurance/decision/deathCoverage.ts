// 사망보장 계산기 (decision/) — A(조건부): 산식은 산수, 모든 가정값은 사용자 입력(C).
// 역할: 적정 사망보험금을 추천하지 않는다. 유족 필요자금과 준비된 자금의 차이만 계산한다.
// 순수 함수: 0 포함 비음수 허용. 미입력 판정은 UI가 빈 문자열로 처리.
//   보장 개월 수는 이미 정수로 변환되어 들어온다(UI가 연×12+개월 변환).

export interface DeathCoverageInput {
  monthlyLiving: number;   // 월 생활비(원) [C]
  coverageMonths: number;  // 보장 개월 수(정수) [C]  ← UI에서 연×12+개월
  debt?: number;           // 남은 부채(원) [C]
  otherFunds?: number;     // 기타 목적자금(원) [C] (한 칸)
  existingDeathBenefit?: number; // 기존 사망보험금(원) [C]
  usableAssets?: number;   // 활용 가능 자산(원) [C]
}

export interface DeathCoverageResult {
  livingTotal: number;     // 생활비 총액 = 월 생활비 × 보장 개월
  neededTotal: number;     // 유족 필요자금
  preparedTotal: number;   // 준비된 자금
  requiredCoverage: number; // 필요 사망보장금액 = max(필요-준비, 0)
  surplus: number;         // 준비가 더 많을 때 초과액 = max(준비-필요, 0)
  isCovered: boolean;      // 추가 필요 없음(준비 >= 필요)
}

export function calcDeathCoverage(input: DeathCoverageInput): DeathCoverageResult {
  const monthlyLiving = nonNegativeInteger(input.monthlyLiving);
  const coverageMonths = nonNegativeInteger(input.coverageMonths);
  const debt = nonNegativeInteger(input.debt);
  const otherFunds = nonNegativeInteger(input.otherFunds);
  const existingDeathBenefit = nonNegativeInteger(input.existingDeathBenefit);
  const usableAssets = nonNegativeInteger(input.usableAssets);

  const livingTotal = monthlyLiving * coverageMonths;
  const neededTotal = livingTotal + debt + otherFunds;
  const preparedTotal = existingDeathBenefit + usableAssets;

  const requiredCoverage = Math.max(neededTotal - preparedTotal, 0);
  const surplus = Math.max(preparedTotal - neededTotal, 0);

  return {
    livingTotal, neededTotal, preparedTotal,
    requiredCoverage, surplus,
    isCovered: preparedTotal >= neededTotal,
  };
}

import { nonNegativeInteger } from "../common/number";
export { toMonths } from "../common/time";
