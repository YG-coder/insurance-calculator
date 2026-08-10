// 앞으로 낼 보험료 계산기 (decision/)
// 질문: "현재 보험료가 그대로라고 가정했을 때, 납입 종료까지 앞으로 얼마를 더 내는가?"
// 원칙: 입력값은 사용자 사실값(C), 산식·출력이 A. 추정 상수 없음.
//   - 인상률/갱신률/물가/평균값/현재 해지환급금은 넣지 않는다.

export interface FuturePremiumInput {
  monthlyPremium: number;   // 월 보험료(원)  [C]
  remainingMonths: number;  // 남은 납입 개월  [C]
  paidMonths?: number;      // 기납입 개월(선택) [C]
}

export type FuturePremiumStatus = "OK" | "NEED_INPUT";

export interface FuturePremiumResult {
  status: FuturePremiumStatus;
  futurePremium: number | null;      // 앞으로 낼 보험료
  // 아래는 기납입 개월 입력 시에만
  paidSoFar: number | null;          // 지금까지 낸 보험료
  totalAtCompletion: number | null;  // 완납 시 총 납입액
  futureSharePercent: number | null; // 앞으로 부담 비중(%)
  notes: string[];
}

const nonNegInt = (v: number | undefined) =>
  typeof v === "number" && isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

export function calcFuturePremium(input: FuturePremiumInput): FuturePremiumResult {
  const monthlyPremium = Math.max(0, isFinite(input.monthlyPremium) ? input.monthlyPremium : 0);
  const remainingMonths = nonNegInt(input.remainingMonths);
  const hasPaid = typeof input.paidMonths === "number";
  const paidMonths = nonNegInt(input.paidMonths);

  const base: FuturePremiumResult = {
    status: "OK",
    futurePremium: null, paidSoFar: null, totalAtCompletion: null, futureSharePercent: null,
    notes: [],
  };

  // 필수: 월 보험료 + 남은 납입 개월
  if (monthlyPremium === 0 || remainingMonths === 0) {
    if (remainingMonths === 0 && monthlyPremium > 0) {
      return { ...base, status: "OK", futurePremium: 0,
        notes: ["남은 납입 개월이 0입니다. 이미 납입이 끝난(완납) 상태로 앞으로 낼 보험료가 없습니다."] };
    }
    return { ...base, status: "NEED_INPUT",
      notes: ["월 보험료와 남은 납입 개월 수를 입력하면 계산됩니다."] };
  }

  const futurePremium = monthlyPremium * remainingMonths;

  let paidSoFar: number | null = null;
  let totalAtCompletion: number | null = null;
  let futureSharePercent: number | null = null;

  if (hasPaid) {
    paidSoFar = monthlyPremium * paidMonths;
    totalAtCompletion = paidSoFar + futurePremium;
    futureSharePercent = totalAtCompletion > 0 ? (futurePremium / totalAtCompletion) * 100 : null;
  }

  return { ...base, status: "OK", futurePremium, paidSoFar, totalAtCompletion, futureSharePercent };
}
