// 유족 생활비 계산기 (decision/)
// 역할: 사용자가 입력한 생활비 구간을 합산해 총액만 구한다. 적정/필요액을 정하지 않는다.
// 순수 함수: 구간 배열을 받아 합산. 0 포함 비음수 허용. 미입력 판정은 UI 책임.
//   - 평균/물가/할인율/추천값 없음. UI는 입력 편의를 위해 최대 6구간으로 제한한다.

export interface LivingSegment {
  monthlyLiving: number; // 월 생활비(원) [C]
  months: number;        // 개월 수(정수) [C]  ← UI에서 연×12+개월
}

interface FamilyLivingReady {
  status: "OK";
  segments: { amount: number; months: number }[]; // 구간별 금액·개월
  totalMonths: number;  // 총 보장 개월
  total: number;        // 총 유족 생활비 = Σ 구간 금액
}

export type FamilyLivingResult = FamilyLivingReady | {
  status: "OUT_OF_RANGE";
  segments: [];
  totalMonths: null;
  total: null;
  note: string;
};

export function calcFamilyLiving(input: LivingSegment[]): FamilyLivingResult {
  const blocked: FamilyLivingResult = {
    status: "OUT_OF_RANGE", segments: [], totalMonths: null, total: null,
    note: "정확하게 계산할 수 있는 범위를 벗어났습니다. 각 구간의 생활비와 기간을 줄여 다시 입력해 주세요.",
  };
  if ((input ?? []).some((seg) => [seg.monthlyLiving, seg.months].some((value) =>
    !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER,
  ))) return blocked;
  const segments = (input ?? []).map((seg) => {
    const monthly = nonNegativeInteger(seg.monthlyLiving);
    const months = nonNegativeInteger(seg.months);
    return { amount: monthly * months, months };
  });

  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const totalMonths = segments.reduce((s, seg) => s + seg.months, 0);
  if (segments.some((seg) => !Number.isSafeInteger(seg.amount))
    || !Number.isSafeInteger(total) || !Number.isSafeInteger(totalMonths)) return blocked;

  return { status: "OK", segments, totalMonths, total };
}

import { nonNegativeInteger } from "../common/number";
export { toMonths } from "../common/time";
