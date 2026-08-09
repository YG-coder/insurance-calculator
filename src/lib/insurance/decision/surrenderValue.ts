// 해지환급금 계산기 로직 (decision/)
// 원칙: 계산기는 사실을 계산하고 판단은 사용자가 한다. 추정 상수 없음.
//   - 모든 값은 산수(A) 또는 사용자 입력(C).
//   - 기본/평균 환급률, 예정이율, 상품 보정값 등은 넣지 않는다.

export type SurrenderMode = "known" | "estimate"; // 환급금 앎 / 모름(참고용)

export interface SurrenderInput {
  monthlyPremium: number;   // 월 보험료(원)
  paidMonths: number;       // 기납입 개월 수
  mode: SurrenderMode;
  // mode "known": 현재 해지환급금(원)
  surrenderValue?: number;
  // mode "estimate": 사용자가 직접 넣은 값 중 하나 (둘 중 하나만)
  estimatedRatePercent?: number; // 예상 환급률(%)
  estimatedValue?: number;       // 예상 해지환급금(원)
  // 선택: 남은 납입 개월 수 → 미래 부담까지 계산
  remainingMonths?: number;
}

export type SurrenderStatus = "OK" | "NEED_INPUT";

export interface SurrenderResult {
  status: SurrenderStatus;
  mode: SurrenderMode;
  reference: boolean;          // 참고용(사용자 가정 기반) 여부 = estimate 모드
  totalPaid: number | null;    // 총 납입액
  surrenderValue: number | null; // 적용된 해지환급금(known=입력, estimate=산출)
  loss: number | null;         // 손해액 (음수면 이익)
  isGain: boolean;             // 환급금이 납입액 초과(이익)
  refundRatePercent: number | null; // 환급률(%)
  monthlyAvgLoss: number | null;    // 월평균 손실 (이익이면 null 처리 안 함, 음수 허용)
  // 선택 입력(remainingMonths) 있을 때만
  futurePremium: number | null;     // 앞으로 낼 보험료
  totalAtCompletion: number | null; // 완납 시 총 납입액
  notes: string[];
}

const n = (v: number | undefined) => (typeof v === "number" && isFinite(v) ? v : 0);

export function calcSurrender(input: SurrenderInput): SurrenderResult {
  const monthlyPremium = Math.max(0, n(input.monthlyPremium));
  const paidMonths = Math.max(0, Math.floor(n(input.paidMonths)));
  const notes: string[] = [];
  const reference = input.mode === "estimate";

  const base: SurrenderResult = {
    status: "OK", mode: input.mode, reference,
    totalPaid: null, surrenderValue: null, loss: null, isGain: false,
    refundRatePercent: null, monthlyAvgLoss: null,
    futurePremium: null, totalAtCompletion: null, notes,
  };

  const totalPaid = monthlyPremium * paidMonths;

  // 유효성: 계산 불가 케이스
  if (paidMonths === 0 || totalPaid === 0) {
    return { ...base, status: "NEED_INPUT", totalPaid: totalPaid || 0,
      notes: ["월 보험료와 기납입 개월 수를 입력하면 계산됩니다."] };
  }

  // 해지환급금 결정
  let surrenderValue: number | null = null;
  if (input.mode === "known") {
    if (typeof input.surrenderValue !== "number") {
      return { ...base, status: "NEED_INPUT", totalPaid,
        notes: ["현재 해지환급금을 입력해 주세요."] };
    }
    surrenderValue = Math.max(0, input.surrenderValue);
  } else {
    // estimate: 예상 환급률(%) 또는 예상 환급금 중 사용자가 넣은 값만 사용
    if (typeof input.estimatedValue === "number") {
      surrenderValue = Math.max(0, input.estimatedValue);
    } else if (typeof input.estimatedRatePercent === "number") {
      surrenderValue = totalPaid * (Math.max(0, input.estimatedRatePercent) / 100);
    } else {
      return { ...base, status: "NEED_INPUT", totalPaid,
        notes: ["예상 환급률(%) 또는 예상 해지환급금을 직접 입력해 주세요."] };
    }
    notes.push("참고용: 사용자가 입력한 가정값 기반 계산입니다.");
  }

  const loss = totalPaid - surrenderValue;       // 음수면 이익
  const isGain = loss < 0;
  const refundRatePercent = (surrenderValue / totalPaid) * 100;
  const monthlyAvgLoss = loss / paidMonths;

  // 선택: 남은 납입 개월
  let futurePremium: number | null = null;
  let totalAtCompletion: number | null = null;
  if (typeof input.remainingMonths === "number" && input.remainingMonths > 0) {
    const remaining = Math.floor(input.remainingMonths);
    futurePremium = monthlyPremium * remaining;
    totalAtCompletion = totalPaid + futurePremium;
  }

  return {
    ...base, status: "OK", totalPaid, surrenderValue, loss, isGain,
    refundRatePercent, monthlyAvgLoss, futurePremium, totalAtCompletion, notes,
  };
}
