// #11 비중증 제외항목 정의·예외 — HOLD. 금융위 명시: 세부는 시행세칙 개정 반영 예정.
export const EXCLUSION_STATUS = "HOLD" as const;
export function isExcluded(): never {
  throw new Error("[HOLD] 제외항목 미구현: 시행세칙 공포 대기(#11)");
}
