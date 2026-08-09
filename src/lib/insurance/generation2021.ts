// 4세대 실손(현행) 엔진. 배포 중 HealthCalc.tsx 인라인 로직을 1:1 재현.
import { ClaimInput, CalcResult } from "./types";
import { GEN2021 } from "./constants";

export function calc2021(input: ClaimInput): CalcResult {
  const amount = input.amount;
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

  const rateBased = amount * rate;
  const ownPay = Math.max(rateBased, minDeductible);
  const insurancePay = Math.max(amount - ownPay, 0);

  return {
    status: "OK",
    generation: "2021",
    amount,
    ownPay,
    insurancePay,
    rateBased,
    rateApplied: rate,
    minDeductible,
    notes: [],
  };
}
