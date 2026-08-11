// 해지 vs 유지 계산기 (decision/)
// 역할: 두 금액을 안전하게 나란히 보여주는 비교 도구. 차액·추천 없음.
// 원칙: 입력값은 사용자 사실값(C). 추정 상수·보장가치 계산 없음.

export interface CancelVsKeepInput {
  surrenderValue: number;  // 현재 해지환급금(원) [C]
  futurePremium: number;   // 앞으로 낼 보험료(원) [C]
}

export type CancelVsKeepStatus = "OK" | "NEED_INPUT";

export interface CancelVsKeepResult {
  status: CancelVsKeepStatus;
  surrenderValue: number | null; // 지금 해지 시 받을 현금
  futurePremium: number | null;  // 유지 시 앞으로 낼 보험료
  notes: string[];
  // 의도적으로 차액(difference)을 계산/노출하지 않는다 — v0.2 결정.
}

const normalize = (v: number) => (isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function calcCancelVsKeep(input: CancelVsKeepInput): CancelVsKeepResult {
  // 음수/비정상 입력은 0으로 정규화
  const surrenderValue = normalize(input.surrenderValue);
  const futurePremium = normalize(input.futurePremium);

  // 둘 중 하나라도 값이 없으면(0이면) 비교 불가로 본다
  if (surrenderValue === 0 || futurePremium === 0) {
    return {
      status: "NEED_INPUT",
      surrenderValue: null,
      futurePremium: null,
      notes: ["현재 해지환급금과 앞으로 낼 보험료를 모두 입력하면 두 금액을 나란히 보여드립니다."],
    };
  }

  return {
    status: "OK",
    surrenderValue,
    futurePremium,
    notes: [],
  };
}
