// #12 발달장애 보장 — HOLD.
//
// 원문은 확인됐다. 별표15 2026.5.6 연혁본 기본형 실손의료보험(급여)
// 제4조(보상하지 않는 사항) ②1. 단서와 ②4.가 근거다(인쇄 p.214~215).
// 규칙 GEN2026-DEVELOPMENTAL-DISORDER-BENEFIT에 출처를 등록해 두었다.
//
// 막힌 이유는 근거 부족이 아니라 **판정 축 부재**다.
//   ① 질병분류코드(F80~F89 / Q00~Q04 등)
//   ② 보험가입 당시 태아 여부  ← 이 조건이 붙어 있다. 무조건 보상이 아니다.
//   ③ 피보험자 연령(18세까지)
// 셋 다 ClaimInput에 없으므로 계산할 수 없다. 값을 만들지 않고 막는다.
export const DEVELOPMENTAL_STATUS = "HOLD" as const;
export function developmentalBenefit(): never {
  throw new Error(
    "[HOLD] 발달장애 보장 미구현: 근거는 확인됨(별표15 기본형 급여 제4조②1.·②4.). " +
    "질병분류코드·보험가입 당시 태아 여부·연령 입력축이 없어 판정 불가(#12)",
  );
}
