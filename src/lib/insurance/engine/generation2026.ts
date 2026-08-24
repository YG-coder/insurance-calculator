// 5세대 실손 엔진 (Engine Core). v0.4 게이팅 기준.
//   - 값이 박힌 계산은 금융위 원문 직독 A 확정 항목만.
//   - #3 최소공제(급여 통원), #2 건보 본인부담률은 미확정 → HOLD.
//     이 둘이 필요한 경로는 임의 상수를 쓰지 않고 PENDING_UNVERIFIED로 반환한다.
import { ClaimInput, CalcResult } from "./types";
import { GEN2026 } from "./constants";

function ok(
  amount: number,
  ownPay: number,
  insurancePay: number,
  rateApplied: number,
  minDeductible: number,
  notes: string[] = [],
  cappedBy?: string,
): CalcResult {
  return { status: "OK", generation: "2026", amount, ownPay, insurancePay, rateBased: amount * rateApplied, rateApplied, minDeductible, notes, cappedBy };
}

function pending(amount: number, reasons: string[]): CalcResult {
  return { status: "PENDING_UNVERIFIED", generation: "2026", amount,
    ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null, notes: reasons };
}

export function calc2026(input: ClaimInput): CalcResult {
  const amount = Math.max(0, input.amount || 0);
  const notes: string[] = [];

  // ── 급여 ──
  if (input.coverage === "benefit") {
    if (input.visit === "inpatient") {
      // #1 A: 급여 입원 20%
      const rate = GEN2026.benefit.inpatientRate;
      const ownPay = amount * rate;
      return ok(amount, ownPay, Math.max(amount - ownPay, 0), rate, 0);
    }
    // 급여 통원: #2 구조 A = Max(건보율, 20%, 최소공제)
    // 그러나 건보율(#2 입력) + 최소공제(#3 REVIEW) 둘 다 미확정 → 임의값 금지.
    const holds: string[] = [];
    const nhis = input.nhisCoinsuranceRate;
    const md = GEN2026.benefit.outpatient.minDeductible; // null이면 HOLD
    if (nhis === undefined) holds.push("급여 통원: 건강보험 본인부담률 미제공 → 계산 불가(#2 입력 필요)");
    if (md === null) holds.push("급여 통원: 최소공제 금액 미확정(#3 REVIEW) → 원문 직독 대기");
    if (holds.length) return pending(amount, holds);

    const rate = Math.max(nhis as number, GEN2026.benefit.outpatient.floorRate);
    const tier = input.tier ?? "clinic";
    const deduct = (md as Record<string, number>)[tier];
    const ownPay = Math.max(amount * rate, deduct);
    return ok(amount, ownPay, Math.max(amount - ownPay, 0), rate, deduct);
  }

  // ── 비급여: 중증/비중증 필수 ──
  if (!input.severity) {
    return pending(amount, ["비급여: 중증/비중증(severity) 미지정 → 계산 불가"]);
  }
  const prior = Math.max(0, input.priorAnnualPaid ?? 0);

  if (input.severity === "critical") {
    const c = GEN2026.nonBenefit.critical;
    if (input.visit === "inpatient") {
      const rate = c.inpatientRate; // 30% A
      let ownPay = amount * rate;
      let cappedBy: string | undefined;
      // #6 상급종합·종합 입원 자기부담 상한 500만(연 누적)
      if (input.tier === "hospital") {
        const remaining = Math.max(c.annualOwnPayCap - prior, 0);
        if (ownPay > remaining) { ownPay = remaining; cappedBy = "중증 입원 자기부담 상한 500만(상급종합·종합·연 누적)"; }
        notes.push("500만 상한은 연간 누적 기준(priorAnnualPaid 반영).");
      }
      return ok(amount, ownPay, Math.max(amount - ownPay, 0), rate, 0, notes, cappedBy);
    }
    // 중증 통원: Max(30%, 3만), 통원 회당 20만(보험지급) 한도
    const rate = c.outpatientRate;
    let ownPay = Math.min(amount, Math.max(amount * rate, c.outpatientMinDeductible));
    let insurancePay = Math.max(amount - ownPay, 0);
    let cappedBy: string | undefined;
    if (insurancePay > c.outpatientPerVisitLimit) {
      insurancePay = c.outpatientPerVisitLimit;
      ownPay = amount - insurancePay;
      cappedBy = "중증 통원 회당 20만 한도";
    }
    return ok(amount, ownPay, insurancePay, rate, c.outpatientMinDeductible, notes, cappedBy);
  }

  // 비중증(특약2)
  const n = GEN2026.nonBenefit.nonCritical;
  if (input.visit === "inpatient") {
    const rate = n.inpatientRate; // 50% A
    let ownPay = amount * rate;
    let insurancePay = Math.max(amount - ownPay, 0);
    let cappedBy: string | undefined;
    if (insurancePay > n.inpatientPerVisitLimit) {
      insurancePay = n.inpatientPerVisitLimit;
      ownPay = amount - insurancePay;
      cappedBy = "비중증 입원 회당 300만 한도";
    }
    return ok(amount, ownPay, insurancePay, rate, 0, notes, cappedBy);
  }
  // 비중증 통원: Max(50%, 5만), 일당 20만 한도
  const rate = n.outpatientRate;
  let ownPay = Math.min(amount, Math.max(amount * rate, n.outpatientMinDeductible));
  let insurancePay = Math.max(amount - ownPay, 0);
  let cappedBy: string | undefined;
  if (insurancePay > n.outpatientPerDayLimit) {
    insurancePay = n.outpatientPerDayLimit;
    ownPay = amount - insurancePay;
    cappedBy = "비중증 통원 일당 20만 한도";
  }
  return ok(amount, ownPay, insurancePay, rate, n.outpatientMinDeductible, notes, cappedBy);
}
