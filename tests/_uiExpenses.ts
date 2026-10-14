import type { Harness } from "./_uiRender";

// 기존 금액/판정 회귀 사례의 진료비를 직접 입력한다. 초기 상태 검사에는 사용하지 않는다.
export function enterHealthExpenses(h: Harness): void {
  if (h.names.includes("amount")) h.set("amount", "300000");
  if (h.names.includes("amounts")) h.set("amounts", ["300000", "300000"]);
  if (h.names.includes("generation") && h.names.includes("plan")) {
    h.set("rows", (h.get("rows") as { amount: string }[]).map(row => ({ ...row, amount: "300000" })));
    h.set("quickAmount", "300000");
  }
}
