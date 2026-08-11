// 유족 생활비 계산기 (decision/)
// 역할: 사용자가 입력한 생활비 구간을 합산해 총액만 구한다. 적정/필요액을 정하지 않는다.
// 순수 함수: 구간 배열을 받아 합산. 0 포함 비음수 허용. 미입력 판정은 UI 책임.
//   - 평균/물가/할인율/추천값 없음. 구간 수 임의 상한 없음.

export interface LivingSegment {
  monthlyLiving: number; // 월 생활비(원) [C]
  months: number;        // 개월 수(정수) [C]  ← UI에서 연×12+개월
}

export interface FamilyLivingResult {
  segments: { amount: number; months: number }[]; // 구간별 금액·개월
  totalMonths: number;  // 총 보장 개월
  total: number;        // 총 유족 생활비 = Σ 구간 금액
}

const nonNeg = (v: number) => (isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function calcFamilyLiving(input: LivingSegment[]): FamilyLivingResult {
  const segments = (input ?? []).map((seg) => {
    const monthly = nonNeg(seg.monthlyLiving);
    const months = nonNeg(seg.months);
    return { amount: monthly * months, months };
  });

  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const totalMonths = segments.reduce((s, seg) => s + seg.months, 0);

  return { segments, totalMonths, total };
}

// UI 보조: 연 + 추가 개월 → 개월 정수
export function toMonths(years: number, extraMonths: number = 0): number {
  const y = isFinite(years) && years > 0 ? Math.floor(years) : 0;
  const m = isFinite(extraMonths) && extraMonths > 0 ? Math.floor(extraMonths) : 0;
  return y * 12 + m;
}
