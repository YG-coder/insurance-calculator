import { normalizeAmount, settle } from "../common/settle";
import { GEN2021 } from "./constants";
import { calc2021 } from "./generation2021";
import {
  CalcResult, CapCode, ClaimLineResult, Gen2021MultiClaimInput,
  Gen2021Rider, MultiClaimResult,
} from "./types";

const nonNegInt = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const RIDER_CAPS: Record<Exclude<Gen2021Rider, "none">, {
  annualLimit: number;
  annualVisits: number | null;
  moneyCap: CapCode;
  visitCap?: CapCode;
}> = {
  manual_therapy: {
    ...GEN2021.rider.manual_therapy,
    moneyCap: "GEN2021_MANUAL_THERAPY_ANNUAL",
    visitCap: "GEN2021_MANUAL_THERAPY_ANNUAL_VISITS",
  },
  injection: {
    ...GEN2021.rider.injection,
    moneyCap: "GEN2021_INJECTION_ANNUAL",
    visitCap: "GEN2021_INJECTION_ANNUAL_VISITS",
  },
  mri: { ...GEN2021.rider.mri, moneyCap: "GEN2021_MRI_ANNUAL" },
};

function excluded(index: number, amount: number, cap: CapCode, note: string): ClaimLineResult {
  return {
    status: "OK", generation: "2021", index, covered: false,
    amount, ownPay: amount, insurancePay: 0, rateBased: 0, rateApplied: 0,
    minDeductible: 0, notes: [note], appliedCaps: [cap],
  };
}

/**
 * 4세대 다회 청구. 한 호출은 동일한 보장축에서 발생한 청구 묶음이다.
 * 연간 가입금액은 계약자가 선택한 값이므로 입력된 경우에만 적용한다.
 */
export function calculateMany2021(input: Gen2021MultiClaimInput): MultiClaimResult {
  const amounts = (input.amounts ?? []).map(normalizeAmount);
  const rider = input.rider ?? "none";
  const results: ClaimLineResult[] = [];
  let paid = nonNegInt(rider === "none" ? input.priorAnnualInsurancePaid : input.priorAnnualRiderPaid);
  let visits = nonNegInt(rider === "none" ? input.priorAnnualOutpatientVisits : input.priorAnnualRiderVisits);
  // 0·음수·비정상 값은 미입력으로 본다(0을 한도로 적용하면 보험금이 0원이 된다).
  const selectedLimit = input.annualCoverageLimit === undefined || nonNegInt(input.annualCoverageLimit) <= 0
    ? undefined
    : Math.min(nonNegInt(input.annualCoverageLimit), GEN2021.annualLimitMaximum);

  amounts.forEach((amount, index) => {
    if (rider === "none" && input.coverage === "non_benefit" && input.visit === "outpatient") {
      if (visits >= GEN2021.nonBenefitOutpatientAnnualVisits) {
        results.push(excluded(index, amount, "GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS",
          `계약해당일 기준 1년간 비급여 통원 ${GEN2021.nonBenefitOutpatientAnnualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`));
        return;
      }
      visits += 1;
    }

    let single: CalcResult;
    if (rider === "none") {
      single = calc2021({
        amount, coverage: input.coverage, visit: input.visit, tier: input.tier,
      });
    } else {
      const rc = RIDER_CAPS[rider];
      if (rc.annualVisits !== null && visits >= rc.annualVisits) {
        results.push(excluded(index, amount, rc.visitCap!,
          `계약해당일 기준 1년간 ${rc.annualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`));
        return;
      }
      if (rc.annualVisits !== null) visits += 1;
      const remaining = Math.max(rc.annualLimit - paid, 0);
      const s = settle(amount, Math.max(amount * GEN2021.rider.deductRate, GEN2021.rider.minDeductible), remaining);
      single = {
        status: "OK", generation: "2021", amount: s.amount,
        ownPay: s.ownPay, insurancePay: s.insurancePay,
        rateBased: Math.round(amount * GEN2021.rider.deductRate),
        rateApplied: GEN2021.rider.deductRate,
        minDeductible: GEN2021.rider.minDeductible,
        notes: [], appliedCaps: s.capped ? [rc.moneyCap] : [],
      };
    }

    // 일반 급여/비급여는 상해·질병 및 급여·비급여 보장축 안에서 입원·통원이 합산된다.
    if (rider === "none" && selectedLimit !== undefined) {
      const remaining = Math.max(selectedLimit - paid, 0);
      const insuranceBefore = single.insurancePay ?? 0;
      if (insuranceBefore > remaining) {
        single = {
          ...single,
          ownPay: amount - remaining,
          insurancePay: remaining,
          appliedCaps: [...single.appliedCaps, "GEN2021_ANNUAL_COVERAGE"],
        };
      }
    }

    paid += single.insurancePay ?? 0;
    results.push({ ...single, index, covered: true });
  });

  const totalAmount = results.reduce((s, r) => s + r.amount, 0);
  const totalOwnPay = results.reduce((s, r) => s + (r.ownPay ?? 0), 0);
  const totalInsurancePay = results.reduce((s, r) => s + (r.insurancePay ?? 0), 0);
  const notes: string[] = [];
  const causeLabel = input.cause === "injury" ? "상해" : "질병";
  if (rider === "none") {
    notes.push(`${causeLabel}·${input.coverage === "benefit" ? "급여" : "비급여"} 보장축만 계산했습니다. 다른 원인의 청구는 별도로 계산해 주세요.`);
  }
  if (rider === "none" && selectedLimit === undefined) {
    notes.push("연간 보험가입금액은 계약자가 선택한 값입니다. 증권의 금액을 입력하지 않아 연간 지급 한도는 적용하지 않았습니다.");
  }
  if (rider === "none" && input.annualCoverageLimit !== undefined && nonNegInt(input.annualCoverageLimit) > GEN2021.annualLimitMaximum) {
    notes.push("입력한 연간 가입금액이 약관상 최대 5천만원을 넘어 5천만원으로 적용했습니다.");
  }
  const excludedCount = results.filter((r) => !r.covered).length;
  if (excludedCount) notes.push(`${excludedCount}건이 연간 횟수 한도를 넘어 보상 대상에서 제외되었습니다.`);

  return {
    status: "OK", generation: "2021", lines: results,
    totalAmount, totalOwnPay, totalInsurancePay,
    appliedCaps: [...new Set(results.flatMap((r) => r.appliedCaps))], notes,
  };
}
