import { GEN2026 } from "./constants";
import type { CalcResult, Gen2026ExcludedResult, Gen2026InjectionPurpose, Gen2026SpecialItem, Severity } from "./types";

export type Gen2026ItemRoute = "special_item" | "general" | "missing_purpose" | "excluded";

/** 제3조의保장 경로보다 제4조의 면책을 먼저 적용한다. 화면·모든 엔진의 공통 판정. */
export function routeOfGen2026Item(severity: Severity, item: Gen2026SpecialItem, purpose?: Gen2026InjectionPurpose): Gen2026ItemRoute {
  if (item === "mri") return "special_item";
  if (item === "musculoskeletal_esw") return severity === "critical" ? "special_item" : "excluded";
  if (purpose === undefined) return "missing_purpose";
  const exceptions: readonly Gen2026InjectionPurpose[] = severity === "critical"
    ? GEN2026.specialItem.injectionGeneralRouteDrugs
    : GEN2026.specialItem.nonCriticalInjectionExceptionDrugs;
  if (exceptions.includes(purpose)) return "general";
  return severity === "critical" ? "special_item" : "excluded";
}

export const GEN2026_NONCRITICAL_INJECTION_PURPOSE_LABEL: Record<Gen2026InjectionPurpose, string> = {
  general: "일반 주사", anticancer: "항암제", antibiotic: "항생제", orphan_drug: "희귀의약품",
};

export function nonCriticalExclusionNotes(item: "musculoskeletal_esw" | "injection"): string[] {
  return [
    "보상하지 않는 항목 — 특별약관2 제4조 (p.299·302).",
    item === "musculoskeletal_esw"
      ? "비중증 근골격계 이학요법·체외충격파 치료에 수반된 의료비는 보상하지 않습니다."
      : "비중증 주사치료는 항암제·항생제·희귀의약품 예외에 해당하지 않으면 보상하지 않습니다.",
    "보험금 0원을 계산한 결과가 아니라, 입력한 치료유형에 대한 약관상 면책 안내입니다.",
  ];
}

export function excludedSingle2026(amount: number, item: "musculoskeletal_esw" | "injection"): CalcResult {
  return { status: "EXCLUDED", generation: "2026", amount, ownPay: null, insurancePay: null,
    rateBased: null, rateApplied: null, minDeductible: null, appliedCaps: [], notes: nonCriticalExclusionNotes(item) };
}

export function excludedMany2026(totalAmount: number, item: "musculoskeletal_esw" | "injection"): Gen2026ExcludedResult {
  return { status: "EXCLUDED", route: "excluded", generation: "2026", totalAmount, lines: [],
    totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes: nonCriticalExclusionNotes(item) };
}
