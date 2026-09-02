import { normalizeAmount } from "../common/settle";
import { GEN2026 } from "./constants";
import { calc2026 } from "./generation2026";
import { CapCode, ClaimLineResult, Gen2026MultiClaimInput, MultiClaimResult } from "./types";

const nonNegInt = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/**
 * 같은 날 통원의 취급은 약관에 명시되어 있다.
 *   중증  — 특별약관1 제3조⑥⑦: 하루 2회 이상 통원(외래·처방조제 합산)은 1회의 통원으로 본다.
 *   비중증 — 특별약관2 제3조: 보상 단위 자체가 "통원 1일당(외래 및 처방·조제비 합산)"이다.
 * 두 경우 모두 같은 날은 합산해 한 행으로 입력하는 것이 약관대로다.
 */
function buildNotes(input: Gen2026MultiClaimInput, limitApplied: boolean): string[] {
  const causeLabel = input.cause === "injury" ? "상해" : "질병";
  const coverageLabel = input.coverage === "benefit" ? "급여" : "비급여";
  const notes = [
    `각 행을 발생 순서대로 계산했습니다. ${causeLabel}·${coverageLabel} 보장축만 계산했으며, 입력한 모든 행과 기존 지급보험금·자기부담금이 이 축의 것이어야 합니다. 다른 원인의 청구는 별도로 계산해 주세요.`,
  ];
  // 아래 두 안내는 비급여 통원에만 해당한다. 급여 통원에 붙이면 사실과 다르다.
  const isNonBenefitOutpatient = input.coverage === "non_benefit" && input.visit === "outpatient";
  if (isNonBenefitOutpatient) {
    notes.push(
      input.severity === "critical"
        // ⚠ 약관 조건을 그대로 옮긴다. 무조건 "같은 날이면 합치라"가 아니다.
        //    제3조⑥은 동일 의료기관의 외래+처방, ⑦은 "같은 치료를 목적으로" 한 다회 통원이다.
        ? "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 한 행으로 합쳐 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 행을 나눠 입력합니다."
        : "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 청구는 한 행으로 합쳐 입력해 주세요.",
    );
    if (input.outpatientCoverageLimit === undefined) {
      notes.push("통원 가입금액은 계약마다 다른 값이라 입력하지 않으면 적용하지 않습니다. 증권에서 확인해 입력하면 지급 한도로 반영됩니다.");
    }
  }
  if (input.coverage === "non_benefit" && !limitApplied) {
    notes.push(`연간 보험가입금액도 계약자가 선택한 값이라 입력하지 않으면 적용하지 않습니다. 약관상 상해비급여·질병비급여 각각에 대해 따로 정해지므로, ${causeLabel}비급여 축의 가입금액을 입력해 주세요.`);
  }
  return notes;
}

export function calculateMany2026(input: Gen2026MultiClaimInput): MultiClaimResult {
  const amounts = (input.amounts ?? []).map(normalizeAmount);
  let insurancePaid = nonNegInt(input.priorAnnualInsurancePaid);
  let ownPayPaid = nonNegInt(input.priorAnnualOwnPay);
  let outpatientVisits = nonNegInt(input.priorAnnualOutpatientVisits);
  // 연간 보험가입금액도 "N원 이내에서 계약자가 선택한 금액"이다(제5조①).
  // 0·음수·미입력은 미적용으로 본다. 상한선을 넘겨 입력하면 상한선으로 깎는다.
  const annualMax = input.severity === "critical"
    ? GEN2026.nonBenefit.critical.annualLimitMax
    : GEN2026.nonBenefit.nonCritical.annualLimitMax;
  const raw = input.annualCoverageLimit;
  const annualLimit = raw === undefined || !Number.isFinite(raw) || raw <= 0
    ? undefined
    : Math.min(Math.floor(raw), annualMax);
  const results: ClaimLineResult[] = [];
  const isCriticalOutpatient = input.coverage === "non_benefit" &&
    input.severity === "critical" && input.visit === "outpatient";

  for (let index = 0; index < amounts.length; index++) {
    const amount = amounts[index];

    // 중증 통원은 매년 계약해당일부터 1년간 100회가 한도다(특별약관1 제3조).
    //   ⚠ 0원·빈 행은 청구가 아니므로 횟수를 소진하지 않는다.
    if (isCriticalOutpatient && amount > 0 && outpatientVisits >= GEN2026.nonBenefit.critical.outpatientAnnualVisits) {
      results.push({
        status: "OK", generation: "2026", index, covered: false,
        amount, ownPay: amount, insurancePay: 0,
        rateBased: 0, rateApplied: 0, minDeductible: 0,
        notes: [`계약해당일 기준 1년간 통원 ${GEN2026.nonBenefit.critical.outpatientAnnualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`],
        appliedCaps: ["GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"],
      });
      continue;
    }
    if (isCriticalOutpatient && amount > 0) outpatientVisits += 1;

    let single = calc2026({
      amount, coverage: input.coverage, visit: input.visit, tier: input.tier,
      severity: input.severity, nhisCoinsuranceRate: input.nhisCoinsuranceRate,
      perVisitCoverageLimit: input.visit === "outpatient" ? input.outpatientCoverageLimit : undefined,
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

    if (input.coverage === "non_benefit" && input.severity && annualLimit !== undefined) {
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
    notes: buildNotes(input, annualLimit !== undefined),
  };
}
