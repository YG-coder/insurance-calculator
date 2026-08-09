// 배포 중 HealthCalc.tsx의 계산 로직을 그대로 옮긴 참조 구현. 회귀 비교 기준.
type Coverage = "benefit" | "non_benefit";
type Visit = "outpatient" | "inpatient";
type Tier = "clinic" | "hospital";

export function reference2021(amount: number, coverage: Coverage, visit: Visit, tier: Tier) {
  const rate = coverage === "benefit" ? 0.2 : 0.3;
  const minDeductible =
    visit !== "outpatient"
      ? 0
      : coverage === "benefit"
      ? tier === "clinic"
        ? 10000
        : 20000
      : 30000;
  const rateBased = amount * rate;
  const ownPay = Math.max(rateBased, minDeductible);
  const insurancePay = Math.max(amount - ownPay, 0);
  return { rate, minDeductible, ownPay, insurancePay };
}
