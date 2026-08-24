// 규제·약관 상수의 출처 추적 메타데이터.
// 계산 엔진은 RegulatedConstant.value만 사용하고, 감사·검증 코드는 ruleId와 sources를 추적한다.

export type RegulatoryStatus = "CONFIRMED" | "HOLD";
export type EvidenceGrade = "A" | "REVIEW";

export interface RegulatorySource {
  document: string;
  issuer: string;
  publishedOrEffective: string;
  url: string;
  locator: string;
}

export interface RegulatedConstant<T> {
  ruleId: string;
  value: T;
  generation: "2021" | "2026";
  status: RegulatoryStatus;
  evidenceGrade: EvidenceGrade;
  verifiedAt: string;
  sources: readonly RegulatorySource[];
  note?: string;
}

export function regulated<T>(rule: RegulatedConstant<T>): Readonly<RegulatedConstant<T>> {
  return Object.freeze(rule);
}
