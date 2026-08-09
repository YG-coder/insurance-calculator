// #12 임신·출산 급여 — HOLD. 5.6 최종 보도자료 + 판매약관 확인 필요.
export const PREGNANCY_STATUS = "HOLD" as const;
export function pregnancyBenefit(): never {
  throw new Error("[HOLD] 임신·출산 보장 미구현: 원문 미확정(#12)");
}
