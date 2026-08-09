// #13 할인·할증 — HOLD. 5.6 최종 보도자료 + 차등제 감독규정 확정 후 구현.
// 1등급 할인율은 회사별 상이 → 반드시 파라미터화, 하드코딩 금지.
export const DISCOUNT_STATUS = "HOLD" as const;
export function applyDiscount(): never {
  throw new Error("[HOLD] 할인·할증 미구현: 원문 세부 수치 미확정(#13)");
}
