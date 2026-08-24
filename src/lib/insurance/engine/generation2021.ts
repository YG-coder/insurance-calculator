// 4세대 실손(현행) 엔진.
// 2026-08-24: 금액 종결을 공통 settle()에 위임한다.
//   - R-1: 자기부담금이 진료비를 초과하던 결함 수정(소액 통원 경계값).
//   - R-2: 원 단위 정수로 확정해 반환 → 표시 계층에서 합계가 어긋나지 않는다.
//   - H-2b: 통원 회당 보험금 지급 한도 20만원 적용. 급여·비급여 동일, 입원은 대상 아님.
//           연간 100회·연간 5천만원·3대비급여 항목별 한도는 입력 모델상 적용 불가 →
//           notes로 미적용 사실을 반환한다. 고지는 급여/비급여·입원/통원 적용 범위에 맞춰
//           구성한다(GEN2021_NOT_APPLIED).
//   의도된 출력 변경은 tests/generation2021.test.ts의 INTENDED_DIVERGENCES에 등록되어 있다.
import { ClaimInput, CalcResult } from "./types";
import { GEN2021, GEN2021_NOT_APPLIED } from "./constants";
import { settle, normalizeAmount } from "../common/settle";

export function calc2021(input: ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  const isOutpatient = input.visit === "outpatient";
  const rate = GEN2021.rate[input.coverage][input.visit];

  let minDeductible = 0;
  if (isOutpatient) {
    if (input.coverage === "benefit") {
      const tier = input.tier ?? "clinic";
      minDeductible = GEN2021.outpatientMinDeductible.benefit[tier];
    } else {
      minDeductible = GEN2021.outpatientMinDeductible.non_benefit;
    }
  }

  // 통원에만 회당 보험금 지급 한도를 적용한다. 입원에는 회당 한도가 없다.
  const cap = isOutpatient ? GEN2021.outpatientPerVisitLimit : undefined;
  const s = settle(amount, Math.max(amount * rate, minDeductible), cap);

  // 미적용 한도 고지는 실제 적용 범위에 맞춰 구성한다.
  // 급여 청구에 적용되지 않는 제한(비급여 100회·3대비급여)을 급여 결과에 안내하지 않는다.
  const notApplied: string[] = [...GEN2021_NOT_APPLIED.all];
  if (input.coverage === "non_benefit") {
    notApplied.push(...GEN2021_NOT_APPLIED.nonBenefit);
    if (isOutpatient) notApplied.push(...GEN2021_NOT_APPLIED.nonBenefitOutpatient);
  }
  const notes: string[] = [
    "이 계산에 반영되지 않은 약관 한도: " + notApplied.join(" / "),
  ];

  return {
    status: "OK",
    generation: "2021",
    amount: s.amount,
    ownPay: s.ownPay,
    insurancePay: s.insurancePay,
    rateBased: Math.round(amount * rate),
    rateApplied: rate,
    minDeductible,
    notes,
    cappedBy: s.capped ? "통원 회당 보험금 20만 한도" : undefined,
  };
}
