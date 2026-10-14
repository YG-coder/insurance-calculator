import type { Harness } from "./_uiRender";

// 금액·경로 회귀 검사에서 기존 사용 없음(0)을 명시한다. 초기값 검사에는 사용하지 않는다.
export function confirmNoPrior2026(h: Harness): void {
  const axes = h.get("priorInsuranceByAxis") as Record<string, string>;
  h.set("priorInsuranceByAxis", Object.fromEntries(Object.keys(axes).map(axis => [axis, "0"])));
  h.set("priorDeductible", "0");
  h.set("priorPool", "0");
}
