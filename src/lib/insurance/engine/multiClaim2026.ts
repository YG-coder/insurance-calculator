import { normalizeAmount } from "../common/settle";
import { GEN2026 } from "./constants";
import { calc2026 } from "./generation2026";
import { CapCode, ClaimLineResult, Gen2026MultiClaimInput, MultiClaimResult } from "./types";

const nonNegInt = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

export function calculateMany2026(input: Gen2026MultiClaimInput): MultiClaimResult {
  const amounts = (input.amounts ?? []).map(normalizeAmount);
  let insurancePaid = nonNegInt(input.priorAnnualInsurancePaid);
  let ownPayPaid = nonNegInt(input.priorAnnualOwnPay);
  const results: ClaimLineResult[] = [];

  for (let index = 0; index < amounts.length; index++) {
    const amount = amounts[index];
    let single = calc2026({
      amount, coverage: input.coverage, visit: input.visit, tier: input.tier,
      severity: input.severity, nhisCoinsuranceRate: input.nhisCoinsuranceRate,
      priorAnnualPaid: input.coverage === "non_benefit" && input.severity === "critical" &&
        input.visit === "inpatient" && input.tier === "hospital" ? ownPayPaid : undefined,
    });
    if (single.status !== "OK") {
      return {
        status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
        totalAmount: amounts.reduce((s, x) => s + x, 0), totalOwnPay: null,
        totalInsurancePay: null, appliedCaps: [], notes: single.notes,
      };
    }

    if (input.coverage === "non_benefit" && input.severity) {
      const annualLimit = input.severity === "critical"
        ? GEN2026.nonBenefit.critical.annualLimit
        : GEN2026.nonBenefit.nonCritical.annualLimit;
      const capCode: CapCode = input.severity === "critical"
        ? "GEN2026_CRITICAL_ANNUAL_COVERAGE"
        : "GEN2026_NONCRITICAL_ANNUAL_COVERAGE";
      const remaining = Math.max(annualLimit - insurancePaid, 0);
      const before = single.insurancePay ?? 0;
      if (before > remaining) {
        single = {
          ...single, insurancePay: remaining, ownPay: amount - remaining,
          appliedCaps: [...single.appliedCaps, capCode],
        };
      }
    }

    insurancePaid += single.insurancePay ?? 0;
    if (input.coverage === "non_benefit" && input.severity === "critical" &&
        input.visit === "inpatient" && input.tier === "hospital") {
      ownPayPaid += single.ownPay ?? 0;
    }
    results.push({ ...single, index, covered: true });
  }

  return {
    status: "OK", generation: "2026", lines: results,
    totalAmount: results.reduce((s, x) => s + x.amount, 0),
    totalOwnPay: results.reduce((s, x) => s + (x.ownPay ?? 0), 0),
    totalInsurancePay: results.reduce((s, x) => s + (x.insurancePay ?? 0), 0),
    appliedCaps: [...new Set(results.flatMap((x) => x.appliedCaps))],
    notes: input.coverage === "non_benefit" && input.severity === "non_critical" && input.visit === "outpatient"
      ? ["각 행을 발생 순서대로 계산했습니다. 같은 날 여러 번 통원한 경우는 현재 정확히 계산할 수 없습니다. 행마다 서로 다른 날짜의 청구만 입력해 주세요."]
      : ["각 행을 발생 순서대로 계산했습니다."],
  };
}
