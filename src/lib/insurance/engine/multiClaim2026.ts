import { normalizeAmount } from "../common/settle";
import { GEN2026 } from "./constants";
import { calc2026 } from "./generation2026";
import { CapCode, ClaimLineResult, Gen2026MultiClaimInput, Gen2026NonBenefitItem, MultiClaimResult, Severity } from "./types";

const nonNegInt = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/**
 * 비중증 통원 일수 카운터 전용 검증.
 *
 * ⚠ 기존 필드들이 쓰는 nonNegInt()의 관용(음수→0, NaN·Infinity→0, 소수→내림)을 물려받지
 *   않는다. 잘못된 값을 조용히 0으로 만들면 한도가 통째로 사라져 보험금이 과다 산출된다.
 *   ⚠ 100을 넘는 값도 유효한 과거 상태다. 절삭하지 않는다.
 *   (기존 필드의 관용은 이번 변경 범위가 아니라 그대로 둔다.)
 */
const badOutpatientDays = (v: number | undefined): boolean =>
  v !== undefined && (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0);

/**
 * 두 해석의 결과가 실제로 같은지 비교하는 지문.
 *   status·합계·행별 보상 여부·금액·공제·CapCode·최상위 CapCode를 모두 넣는다.
 *   notes는 카운터와 무관하게 만들어지므로 제외한다(넣어도 항상 같다).
 */
function fingerprint(r: MultiClaimResult): string {
  return JSON.stringify([
    r.status, r.totalAmount, r.totalOwnPay, r.totalInsurancePay,
    [...r.appliedCaps].sort(),
    r.lines.map((l) => [
      l.index, l.covered, l.status, l.amount, l.ownPay, l.insurancePay,
      l.rateBased, l.rateApplied, l.minDeductible, l.deductibleApplied,
      [...l.appliedCaps].sort(),
    ]),
  ]);
}

/**
 * 지급 보험금이 0원인 통원일이 연 100일을 소진하는지는 원문에 판단 문언이 없다
 * (GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY = HOLD).
 */
const ZERO_PAY_DAYS_HOLD_NOTES = [
  "지급 보험금이 0원인 통원일이 비중증 통원 연 100일 한도의 일수를 소진하는지는 표준약관에 정해져 있지 않습니다.",
  "이 계산에는 그런 날이 있어 이후 청구의 보상 여부가 달라지므로 계산을 중단했습니다.",
  "가입하신 보험사에 확인해 주세요.",
];

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
  if (input.coverage === "benefit") return notes;
  // 여기부터는 일반 비급여(nonBenefitItem === "general")만 도달한다.
  //   3대비급여·MRI·상급병실료는 계산 전에 PENDING_UNVERIFIED로 차단된다.
  notes.push(
    "이 계산은 일반 비급여((1)상해비급여·(2)질병비급여)만 다룹니다. 근골격계 이학요법·체외충격파, 비급여 주사료, 비급여 MRI, 상급병실료 차액은 약관상 별도 보장종목이라 이 결과에 포함되지 않습니다.",
  );
  // 아래 두 안내는 비급여 통원에만 해당한다. 급여 통원에 붙이면 사실과 다르다.
  const isNonBenefitOutpatient = input.visit === "outpatient";
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
  if (!limitApplied) {
    notes.push(`연간 보험가입금액도 계약자가 선택한 값이라 입력하지 않으면 적용하지 않습니다. 약관상 상해비급여·질병비급여 각각에 대해 따로 정해지므로, ${causeLabel}비급여 축의 가입금액을 입력해 주세요.`);
  }
  return notes;
}

export function calculateMany2026(input: Gen2026MultiClaimInput): MultiClaimResult {
  const amounts = (input.amounts ?? []).map(normalizeAmount);
  // 유니온 내로잉. 급여 묶음에는 비급여 전용 축이 없다.
  const nb = input.coverage === "non_benefit" ? input : undefined;
  const bf = input.coverage === "benefit" ? input : undefined;
  const severity: Severity | undefined = nb?.severity;
  const totalAmount = amounts.reduce((s, x) => s + x, 0);
  const blocked = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
    totalAmount, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });

  // 단건과 같은 정책을 행 수와 무관하게 먼저 적용한다(빈 입력도 막힌다).
  //   calc2026의 사유 문구를 그대로 쓰기 위해 0원 1건으로 물어본다.
  if (nb) {
    const probe = calc2026({
      amount: 0, coverage: "non_benefit", visit: nb.visit, tier: nb.tier,
      severity: "critical", // 치료유형 검사가 severity보다 먼저라 결과에 영향이 없다
      nonBenefitItem: (nb as { nonBenefitItem?: Gen2026NonBenefitItem }).nonBenefitItem as Gen2026NonBenefitItem,
    });
    if (probe.status !== "OK") return blocked(probe.notes);

    // ── 통원 카운터 축 분리 ───────────────────────────────────────
    //   중증은 '통원 100회'(특약1 제5조④ '보상한 횟수'), 비중증은 '통원 100일'
    //   (특약2 제5조④ '보상한 일수')로 단위가 다르다. 반대편 필드를 넘겼다면 호출자가
    //   단위를 잘못 알고 있다는 뜻이므로, 값이 0이어도 계산하지 않는다.
    //   ⚠ 대상은 해당 통원 경로뿐이다. 다른 경로의 기존 관용 동작은 이번에 정리하지 않는다.
    if (nb.visit === "outpatient" && severity === "critical"
      && (nb as { priorAnnualOutpatientDays?: number }).priorAnnualOutpatientDays !== undefined) {
      return blocked([
        "중증 통원의 연간 한도는 약관상 통원 100회입니다(특별약관1 제3조 <구분·보상금액>·제5조 제4항 '보상한 횟수').",
        "일수 카운터(priorAnnualOutpatientDays)는 비중증 전용이라 중증 계산에 쓰지 않습니다. 통원 횟수(priorAnnualOutpatientVisits)로 넘겨 주세요.",
      ]);
    }
    if (nb.visit === "outpatient" && severity === "non_critical"
      && nb.priorAnnualOutpatientVisits !== undefined) {
      return blocked([
        "비중증 통원의 연간 한도는 약관상 통원 100일입니다(특별약관2 제3조 <구분·보상금액>·제5조 제4항 '보상한 일수').",
        "횟수 카운터(priorAnnualOutpatientVisits)는 중증 전용이라 비중증 계산에 쓰지 않습니다. 통원일수(priorAnnualOutpatientDays)로 넘겨 주세요.",
      ]);
    }
    if (badOutpatientDays((nb as { priorAnnualOutpatientDays?: number }).priorAnnualOutpatientDays)) {
      return blocked([
        "이미 사용한 통원일수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값은 계산하지 않습니다.",
        `받은 값: ${JSON.stringify((nb as { priorAnnualOutpatientDays?: number }).priorAnnualOutpatientDays)}`,
      ]);
    }
  }

  // 연간 보험가입금액도 "N원 이내에서 계약자가 선택한 금액"이다(제5조①).
  // 0·음수·미입력은 미적용으로 본다. 상한선을 넘겨 입력하면 상한선으로 깎는다.
  const annualMax = severity === "critical"
    ? GEN2026.nonBenefit.critical.annualLimitMax
    : GEN2026.nonBenefit.nonCritical.annualLimitMax;
  const raw = nb?.annualCoverageLimit;
  const annualLimit = raw === undefined || !Number.isFinite(raw) || raw <= 0
    ? undefined
    : Math.min(Math.floor(raw), annualMax);
  const isCriticalOutpatient = !!nb && severity === "critical" && input.visit === "outpatient";
  const isNonCriticalOutpatient = !!nb && severity === "non_critical" && input.visit === "outpatient";

  /**
   * 묶음 한 번을 처음부터 끝까지 계산한다.
   *
   * 가변 상태(누적 지급보험금·공제금액 pool·통원 카운터)는 **모두 이 함수 안에서 새로 만든다.**
   *   두 해석을 비교하려면 실행 사이에 공유되는 상태가 하나도 없어야 한다.
   *
   * @param countZeroPayDays 비중증 통원 연 100일 카운터의 해석.
   *   true  = 해석 A — 진료비가 있는 통원일은 지급액이 0원이어도 일수를 소진
   *   false = 해석 B — 실제 지급보험금이 0원보다 큰 통원일만 일수를 소진
   *   ⚠ 이 인자를 읽는 곳은 아래 비중증 카운터 한 곳뿐이다. 중증 100회 로직은 두 실행에서
   *     완전히 같은 코드·같은 결과를 낸다.
   */
  function runBundle(countZeroPayDays: boolean): MultiClaimResult {
    let insurancePaid = nonNegInt(input.priorAnnualInsurancePaid);
    // 특별약관1 제5조⑤ 500만원 상한의 누적 대상은 약관상 **공제금액**이다(인쇄 p.280).
    //   ⚠ single.ownPay를 누적하면 안 된다. 연간 보험가입금액 한도로 잘려 추가 부담한 금액이
    //     섞여 pool이 과대 소진되고, 이후 건의 공제가 사라져 보험금이 과다 산출된다.
    let deductiblePaid = nonNegInt(nb?.priorAnnualDeductible);
    let outpatientVisits = nonNegInt(nb?.priorAnnualOutpatientVisits);
    // 비중증은 '일'이다. 미입력은 0일. 잘못된 값은 이미 위에서 차단됐다.
    let outpatientDays = (nb as { priorAnnualOutpatientDays?: number } | undefined)
      ?.priorAnnualOutpatientDays ?? 0;
    const results: ClaimLineResult[] = [];

    for (let index = 0; index < amounts.length; index++) {
      const amount = amounts[index];

      // 중증 통원은 매년 계약해당일부터 1년간 100회가 한도다(특별약관1 제3조).
      //   ⚠ 0원·빈 행은 청구가 아니므로 횟수를 소진하지 않는다.
      if (isCriticalOutpatient && amount > 0 && outpatientVisits >= GEN2026.nonBenefit.critical.outpatientAnnualVisits) {
        results.push({
          status: "OK", generation: "2026", index, covered: false,
          amount, ownPay: amount, insurancePay: 0,
          // 보상 대상이 아닌 건은 약관상 공제 자체가 적용되지 않는다 → 500만원 pool도 소진하지 않는다.
          rateBased: 0, rateApplied: 0, minDeductible: 0, deductibleApplied: 0,
          notes: [`계약해당일 기준 1년간 통원 ${GEN2026.nonBenefit.critical.outpatientAnnualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`],
          appliedCaps: ["GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"],
        });
        continue;
      }
      if (isCriticalOutpatient && amount > 0) outpatientVisits += 1;

      // 비중증 통원은 매년 계약해당일부터 1년간 100일이 한도다(특별약관2 제3조 (1)①·(2)①).
      //   ⚠ 중증과 카운터·상수·CapCode를 공유하지 않는다. 단위가 회 ≠ 일이다.
      if (isNonCriticalOutpatient && amount > 0 && outpatientDays >= GEN2026.nonBenefit.nonCritical.outpatientAnnualDays) {
        results.push({
          status: "OK", generation: "2026", index, covered: false,
          amount, ownPay: amount, insurancePay: 0,
          rateBased: 0, rateApplied: 0, minDeductible: 0, deductibleApplied: 0,
          notes: [`계약해당일 기준 1년간 통원 ${GEN2026.nonBenefit.nonCritical.outpatientAnnualDays}일 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`],
          appliedCaps: ["GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS"],
        });
        continue;
      }

      let single = nb
        ? calc2026({
            amount, coverage: "non_benefit", visit: nb.visit, tier: nb.tier, severity,
            nonBenefitItem: nb.nonBenefitItem,
            perVisitCoverageLimit: nb.visit === "outpatient" ? nb.outpatientCoverageLimit : undefined,
            priorAnnualDeductible: severity === "critical" && nb.visit === "inpatient" && nb.tier === "hospital"
              ? deductiblePaid : undefined,
          })
        : calc2026({
            amount, coverage: "benefit", visit: input.visit, tier: input.tier,
            nhisCoinsuranceRate: bf?.nhisCoinsuranceRate,
          });
      if (single.status !== "OK") return blocked(single.notes);

      if (nb && severity && annualLimit !== undefined) {
        const capCode: CapCode = severity === "critical"
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

      // 일수 소진 판정은 지급액이 정해진 **뒤에** 한다(해석 B가 지급액을 봐야 하므로).
      //   amount === 0인 행은 두 해석 모두 소진하지 않는다 — 기존 0원 행 계약 그대로다.
      if (isNonCriticalOutpatient && amount > 0
        && (countZeroPayDays || (single.insurancePay ?? 0) > 0)) {
        outpatientDays += 1;
      }

      insurancePaid += single.insurancePay ?? 0;
      if (nb && severity === "critical" && nb.visit === "inpatient" && nb.tier === "hospital") {
        // 연간 보험가입금액 클램프는 insurancePay·ownPay만 바꾸고 deductibleApplied는 건드리지
        // 않는다. 그래서 한도 구속 건에서도 약관상 공제금액만 정확히 누적된다.
        deductiblePaid += single.deductibleApplied ?? 0;
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

  // 비중증 통원이 아니면 해석 차이가 생길 수 없다 → 종전과 똑같이 한 번만 계산한다.
  if (!isNonCriticalOutpatient) return runBundle(true);

  // 두 해석을 처음부터 독립 실행해 결과를 비교한다. 내부 후보는 노출하지 않는다.
  const countedA = runBundle(true);
  const countedB = runBundle(false);
  if (fingerprint(countedA) !== fingerprint(countedB)) return blocked(ZERO_PAY_DAYS_HOLD_NOTES);
  return countedA;
}
