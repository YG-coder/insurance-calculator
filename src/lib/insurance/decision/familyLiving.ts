// 유족 생활비 계산기 (decision/)
// 역할: 사용자가 입력한 생활비 구간을 합산해 총액만 구한다. 적정/필요액을 정하지 않는다.
// 순수 함수: 구간 배열을 받아 합산. 0 포함 비음수 허용. 미입력 판정은 UI 책임.
//   - 평균/물가/할인율/추천값 없음. UI는 입력 편의를 위해 최대 6구간으로 제한한다.

export interface LivingSegment {
  monthlyLiving: number; // 월 생활비(원) [C]
  months: number;        // 개월 수(정수) [C]  ← UI에서 연×12+개월
}

export interface FamilyLivingResult {
  segments: { amount: number; months: number }[]; // 구간별 금액·개월
  totalMonths: number;  // 총 보장 개월
  total: number;        // 총 유족 생활비 = Σ 구간 금액
}

export function calcFamilyLiving(input: LivingSegment[]): FamilyLivingResult {
  const segments = (input ?? []).map((seg) => {
    const monthly = nonNegativeInteger(seg.monthlyLiving);
    const months = nonNegativeInteger(seg.months);
    return { amount: monthly * months, months };
  });

  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const totalMonths = segments.reduce((s, seg) => s + seg.months, 0);

  return { segments, totalMonths, total };
}

import { nonNegativeInteger } from "../common/number";
export { toMonths } from "../common/time";
