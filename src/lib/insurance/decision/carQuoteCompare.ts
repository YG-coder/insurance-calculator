// 자동차보험 견적 비교 계산기 (decision/)
// 역할: 사용자가 입력한 실제 견적들을 비교해 최저·최고·차액만 계산한다.
// 원칙: 보험료를 추정하지 않는다(사용자 입력). 보험사 추천·판단 없음.
//   - 순수 함수. 유효 견적(금액>0) 2개 이상일 때만 계산.

export interface CarQuote {
  name?: string;   // 견적 이름(선택) [C]
  amount: number;  // 사용자가 받은 연간 견적 금액(원) [C]
}

export type CarQuoteStatus = "OK" | "NEED_MORE";

export interface CarQuoteResult {
  status: CarQuoteStatus;
  quotes: { name: string; amount: number; isLowest: boolean; isHighest: boolean }[];
  lowest: number | null;
  highest: number | null;
  gap: number | null;        // 최고 − 최저
  monthlyGap: number | null; // 연간 견적 차액 ÷ 12개월(단순 월 환산)
}

const nonNeg = (v: number) => (isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function calcCarQuoteCompare(input: CarQuote[]): CarQuoteResult {
  // 유효 견적 = 금액 > 0
  const valid = (input ?? [])
    .map((q, i) => ({ name: q.name?.trim() || `견적 ${String.fromCharCode(65 + i)}`, amount: nonNeg(q.amount) }))
    .filter((q) => q.amount > 0);

  if (valid.length < 2) {
    return { status: "NEED_MORE", quotes: [], lowest: null, highest: null, gap: null, monthlyGap: null };
  }

  const amounts = valid.map((q) => q.amount);
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);
  const gap = highest - lowest;
  const monthlyGap = Math.round(gap / 12);

  const quotes = valid.map((q) => ({
    ...q,
    isLowest: q.amount === lowest,
    isHighest: q.amount === highest,
  }));

  return { status: "OK", quotes, lowest, highest, gap, monthlyGap };
}
