import { settle } from "../common/settle";
import { GEN5_INPATIENT_POOL_NOTE, REGULATORY_RULES as rules } from "./regulatoryRules";
import type { BasicBenefitLimits, CalcResult, CapCode, Visit } from "./types";

export function basicMaximum(year: "2021" | "2026") {
  if (year === "2026") return {
    inpatientDeductible: rules.GEN2026_BASIC_INPATIENT_DEDUCTIBLE_CAP.value,
    outpatientMaximum: rules.GEN2026_BASIC_OUTPATIENT_MAXIMUM.value,
    annualMaximum: rules.GEN2026_BASIC_ANNUAL_MAXIMUM.value,
  };
  return {
    inpatientDeductible: rules.GEN2021_BASIC_INPATIENT_DEDUCTIBLE_CAP.value,
    outpatientMaximum: rules.GEN2021_OUTPATIENT_PER_VISIT_LIMIT.value,
    annualMaximum: rules.GEN2021_ANNUAL_LIMIT.value,
  };
}

export function basicLimitError(year: "2021" | "2026", visit: Visit, limits?: BasicBenefitLimits, bundle = false) {
  if (limits !== undefined && (!limits || typeof limits !== "object" || Array.isArray(limits))) return "급여 계약 한도 입력을 확인해 주세요.";
  const maximum = basicMaximum(year);
  const prior = limits?.priorInpatientDeductible;
  const perVisit = limits?.outpatientLimit;
  const remaining = limits?.remainingAnnualBenefit;
  if (visit === "inpatient" && bundle && prior === undefined) return "이미 부담한 급여 입원 자기부담금을 입력하세요. 없으면 0원을 입력하세요.";
  if (prior !== undefined && (visit !== "inpatient" || !Number.isSafeInteger(prior) || prior < 0 || prior > maximum.inpatientDeductible))
    return "급여 입원 누적 공제액은 0원부터 200만 원까지 입력하세요.";
  if (perVisit !== undefined && (visit !== "outpatient" || !Number.isSafeInteger(perVisit) || perVisit <= 0 || perVisit > maximum.outpatientMaximum))
    return "급여 통원 1회 가입금액은 1원부터 20만 원까지 입력하세요.";
  if (remaining !== undefined && (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > maximum.annualMaximum))
    return "해당 보장의 연간 잔여 지급한도는 0원부터 5천만 원까지 입력하세요.";
  return null;
}

export function basicNotes(year: "2021" | "2026", visit: Visit, limits?: BasicBenefitLimits) {
  const notes: string[] = [];
  if (year === "2026" && visit === "inpatient") notes.push(GEN5_INPATIENT_POOL_NOTE);
  if (visit === "inpatient" && limits?.priorInpatientDeductible === undefined)
    notes.push("이번 계약연도에 이미 부담한 급여 입원 공제액을 0원으로 가정했습니다.");
  if (visit === "outpatient" && limits?.outpatientLimit === undefined)
    notes.push("증권의 통원 가입금액을 입력하지 않아 회당 최고액 20만 원 기준으로 계산한 상한 추정치입니다.");
  if (limits?.remainingAnnualBenefit === undefined)
    notes.push("증권의 연간 보상한도 잔여액을 입력하지 않아 연간 최고액 5,000만원 기준으로 계산했습니다. 실제 지급액은 더 적을 수 있습니다.");
  return notes;
}

export function applyBasicLimits(year: "2021" | "2026", base: CalcResult, visit: Visit, limits?: BasicBenefitLimits): CalcResult {
  const error = basicLimitError(year, visit, limits);
  if (error) return { ...base, status: "PENDING_UNVERIFIED", ownPay: null, insurancePay: null,
    rateBased: null, rateApplied: null, minDeductible: null, notes: [error], appliedCaps: [] };
  const max = basicMaximum(year);
  const raw = Math.max(base.rateBased ?? 0, base.minDeductible ?? 0);
  let deduction = raw;
  const caps: CapCode[] = [];
  if (visit === "inpatient") {
    deduction = Math.min(raw, max.inpatientDeductible - (limits?.priorInpatientDeductible ?? 0));
    if (deduction < raw) caps.push(year === "2021" ? "GEN2021_BASIC_INPATIENT_DEDUCTIBLE" : "GEN2026_BASIC_INPATIENT_DEDUCTIBLE");
  }
  const perVisit = visit === "outpatient" ? limits?.outpatientLimit ?? max.outpatientMaximum : undefined;
  const payment = settle(base.amount, deduction, perVisit);
  if (payment.capped) caps.push(year === "2021" ? "GEN2021_OUTPATIENT_PER_VISIT" : "GEN2026_BASIC_OUTPATIENT_LIMIT");
  const remaining = limits?.remainingAnnualBenefit ?? max.annualMaximum;
  const insurancePay = Math.min(payment.insurancePay, remaining);
  if (insurancePay < payment.insurancePay) caps.push(year === "2021" ? "GEN2021_ANNUAL_COVERAGE" : "GEN2026_BASIC_ANNUAL_LIMIT");
  return { ...base, ownPay: base.amount - insurancePay, insurancePay, appliedCaps: caps, notes: basicNotes(year, visit, limits) };
}
