// 4세대 실손(현행) 엔진.
// 2026-08-24: 금액 종결을 공통 settle()에 위임한다.
//   - R-1: 자기부담금이 진료비를 초과하던 결함 수정(소액 통원 경계값).
//   - R-2: 원 단위 정수로 확정해 반환 → 표시 계층에서 합계가 어긋나지 않는다.
//   의도된 출력 변경은 tests/generation2021.test.ts의 INTENDED_DIVERGENCES에 등록되어 있다.
import { ClaimInput, CalcResult } from "./types";
import { GEN2021 } from "./constants";
import { settle, normalizeAmount } from "../common/settle";

export function calc2021(input: ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  const rate = GEN2021.rate[input.coverage];

  let minDeductible = 0;
  if (input.visit === "outpatient") {
    if (input.coverage === "benefit") {
      const tier = input.tier ?? "clinic";
      minDeductible = GEN2021.outpatientMinDeductible.benefit[tier];
    } else {
      minDeductible = GEN2021.outpatientMinDeductible.non_benefit;
    }
  }

  // 4세대에는 보험지급 한도가 구현되어 있지 않다(감사 H-2). settle에 한도를 넘기지 않는다.
  const s = settle(amount, Math.max(amount * rate, minDeductible));

  return {
    status: "OK",
    generation: "2021",
    amount: s.amount,
    ownPay: s.ownPay,
    insurancePay: s.insurancePay,
    rateBased: Math.round(amount * rate),
    rateApplied: rate,
    minDeductible,
    notes: [],
  };
}
