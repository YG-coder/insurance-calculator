// 배포 중 HealthCalc.tsx의 계산 로직을 그대로 옮긴 참조 구현. 회귀 비교 기준.
//
// [동결] 2026-08 리팩터링 시점의 배포 동작 기록이다. **정답 사양이 아니다.**
//        이 파일의 산식은 고치지 않는다. 엔진과 함께 수정하면 회귀 테스트가
//        자기 자신을 비교하게 되어 공허하게 통과한다(아무것도 검증하지 못한다).
//
//        정확성 사양 : tests/generation2021.correctness.test.ts
//        의도된 변경 : tests/generation2021.test.ts 의 INTENDED_DIVERGENCES
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
