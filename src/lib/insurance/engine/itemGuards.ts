// 5세대 항목별 진입점의 공통 입력 검증 조각.
//   ⚠ 타입을 우회한 외부 값이 산식에 닿기 전에 막기 위한 것이다. 값 목록을 각 엔진에서
//     다시 나열하면 한쪽만 바뀌어도 통과하므로 여기 한 곳에만 둔다.
import { Gen2026RejectedResult } from "./types";

export const SEVERITY_VALUES: readonly string[] = ["critical", "non_critical"];
export const VISIT_VALUES: readonly string[] = ["outpatient", "inpatient"];
export const TIER_VALUES: readonly string[] = ["clinic", "hospital"];
export const CAUSE_VALUES: readonly string[] = ["injury", "disease"];

export const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
export const isPositiveInt = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v > 0;
export const oneOf = (v: unknown, values: readonly string[]) =>
  typeof v === "string" && values.includes(v);

/** 입력을 신뢰할 수 없어 계산하지 않은 결과. 숫자를 만들지 않는다. */
export function rejected(what: string, got: unknown): Gen2026RejectedResult {
  return {
    route: "rejected", status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
    totalAmount: 0, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [],
    notes: [
      `${what} 값이 올바르지 않아 계산하지 않았습니다.`,
      `받은 값: ${JSON.stringify(got) ?? String(got)}`,
    ],
  };
}
