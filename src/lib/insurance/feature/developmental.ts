// #12 발달장애 보장 — HOLD. 5.6 최종 보도자료 + 판매약관 확인 필요.
export const DEVELOPMENTAL_STATUS = "HOLD" as const;
export function developmentalBenefit(): never {
  throw new Error("[HOLD] 발달장애 보장 미구현: 원문 미확정(#12)");
}
