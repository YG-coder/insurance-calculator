import { normalizeAmount, settle } from "../common/settle";
import { GEN2021 } from "./constants";
import { calc2021 } from "./generation2021";
import {
  CalcResult, CapCode, ClaimLineResult, Gen2021MultiClaimInput,
  Gen2021Rider, MultiClaimResult,
} from "./types";

const nonNegInt = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/**
 * 이미 사용한 횟수 축 검증(4세대 전용).
 *
 * ⚠ 금액 축이 쓰는 nonNegInt()의 관용(음수→0, NaN·Infinity→0, 소수 내림)을 물려받지 않는다.
 *   실제로 nonNegInt()는 문자열 "100"과 Infinity를 **0**으로 만들었다 — "이미 100회 썼다"가
 *   "한 번도 안 썼다"가 되어 한도가 사라지고 보험금이 과다 산출된다.
 *   ⚠ 한도를 넘는 값도 유효한 과거 상태다. 절삭하지 않는다.
 *   (금액 축의 관용은 이번 범위가 아니라 그대로 둔다.)
 *
 * ⚠ 형식 규칙만 공유한다. 일반 통원 100회와 특약 50회는 한도·근거·CapCode·안내가 모두 다르다.
 */
const badCount = (v: unknown): boolean =>
  !(typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
const readCount = (o: object, key: string): unknown =>
  (o as Record<string, unknown>)[key];

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
  const totalInput = amounts.reduce((s, x) => s + x, 0);
  /** 차단 계약 — 후보 보험금·후보 행을 노출하지 않고 진료비 합계만 유지한다. */
  const blocked = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation: "2021", lines: [],
    totalAmount: totalInput, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });

  // ── 이미 사용한 횟수 축 ──────────────────────────────────────────────
  //   어느 축이 쓰이는지는 rider·coverage·visit이 함께 정한다.
  //     일반 비급여 통원 → 연 100회(GEN2021-NONBENEFIT-OUTPATIENT-ANNUAL-VISITS)
  //     도수치료·주사료 → 각 연 50회(GEN2021-MANUAL-THERAPY / INJECTION-ANNUAL-VISITS)
  //     MRI·급여·입원   → 횟수 한도 자체가 없다. 실려 오면 쓰이지 않는 입력이다.
  //   ⚠ 타입이 막는 조합이라도 외부 런타임 데이터는 타입을 우회한다. 여기서도 막는다.
  const visitsRaw = readCount(input, "priorAnnualOutpatientVisits");
  const riderVisitsRaw = readCount(input, "priorAnnualRiderVisits");
  const usesGeneralVisits = rider === "none"
    && input.coverage === "non_benefit" && input.visit === "outpatient";
  const usesRiderVisits = rider === "manual_therapy" || rider === "injection";

  if (!usesGeneralVisits && visitsRaw !== undefined) {
    return blocked([
      "일반 통원 횟수(priorAnnualOutpatientVisits)는 비급여 통원의 연 100회 한도에만 쓰입니다.",
      rider === "none"
        ? "급여 청구와 입원에는 연간 횟수 한도가 없습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다."
        : "3대비급여 특약은 별도 횟수 축(priorAnnualRiderVisits)을 씁니다. 두 축은 한도가 달라 서로 대신 쓰지 않습니다.",
      `받은 값: ${JSON.stringify(visitsRaw)}`,
    ]);
  }
  if (!usesRiderVisits && riderVisitsRaw !== undefined) {
    return blocked([
      "3대비급여 특약 횟수(priorAnnualRiderVisits)는 도수치료·체외충격파·증식치료와 비급여 주사료의 연 50회 한도에만 쓰입니다.",
      rider === "mri"
        ? "비급여 MRI·MRA에는 횟수 한도가 없고 금액 한도만 있습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다."
        : "일반 보장은 별도 횟수 축(priorAnnualOutpatientVisits)을 씁니다. 두 축은 한도가 달라 서로 대신 쓰지 않습니다.",
      `받은 값: ${JSON.stringify(riderVisitsRaw)}`,
    ]);
  }
  // 미입력은 0으로 추정하지 않는다 — 과거 사용량을 모르면 한도를 반영할 수 없다.
  //   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 0은 유효값이다.
  if (usesGeneralVisits) {
    if (visitsRaw === undefined) {
      return blocked([
        `비급여 통원은 계약해당일 기준 1년간 ${GEN2021.nonBenefitOutpatientAnnualVisits}회가 한도입니다.`,
        "이미 사용한 통원 횟수(priorAnnualOutpatientVisits)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 사용한 통원이 없으면 0을 넣어 주세요.",
      ]);
    }
    if (badCount(visitsRaw)) {
      return blocked([
        "이미 사용한 통원 횟수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
        `받은 값: ${JSON.stringify(visitsRaw)}`,
      ]);
    }
  }
  if (usesRiderVisits) {
    const limit = RIDER_CAPS[rider].annualVisits;
    if (riderVisitsRaw === undefined) {
      return blocked([
        `이 특약은 계약해당일 기준 1년간 ${limit}회가 한도입니다.`,
        "이미 사용한 치료 횟수(priorAnnualRiderVisits)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 받은 치료가 없으면 0을 넣어 주세요.",
      ]);
    }
    if (badCount(riderVisitsRaw)) {
      return blocked([
        "이미 사용한 치료 횟수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
        `받은 값: ${JSON.stringify(riderVisitsRaw)}`,
      ]);
    }
  }

  let paid = nonNegInt(rider === "none" ? input.priorAnnualInsurancePaid : input.priorAnnualRiderPaid);
  // ⚠ 정규화하지 않는다. 위에서 미입력·잘못된 값을 이미 차단했고, 쓰이지 않는 축은
  //   실려 오는 것 자체가 차단된다. 여기서 ?? 0은 "쓰이지 않는 축"의 자리값이다.
  let visits = ((usesGeneralVisits ? visitsRaw : riderVisitsRaw) as number | undefined) ?? 0;
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
