// 기존 HOLD note를 이용자 안내로 요약한다. 규칙값·확정 상태를 바꾸지 않는다.
export const REGULATORY_HOLD_COPY: Record<string, { title: string; summary: string }> = {
  "GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY": {
    title: "중증 통원에서 지급 보험금이 0원인 경우의 횟수",
    summary: "보험금이 0원인 통원이 연간 횟수를 소진하는지는 확인한 조문만으로 확정하지 못했습니다. 이 해석에 따라 결과가 달라지면 계산을 보류합니다.",
  },
  "GEN2026-MSK-APPROVAL-PRIOR-ACT-COUNT": {
    title: "이미 받은 근골격계 치료횟수의 확인 방법",
    summary: "과거 치료횟수를 확인할 공식 서류·기준은 확정하지 못했습니다. 보험사에서 확인한 치료횟수를 직접 입력해야 하며, 미입력을 0회로 가정하지 않습니다.",
  },
  "GEN2026-ROOM-CHARGE-DEDUCTIBLE-POOL": {
    title: "상급병실료 차액과 공제금액 상한의 관계",
    summary: "상급병실료 차액의 미지급 금액을 중증 입원 공제금액 상한에 포함하는 범위와 순서를 확인하지 못했습니다. 이 합산은 계산하지 않습니다.",
  },
  "GEN2026-CRITICAL-DEDUCTIBLE-POOL-SCOPE": {
    title: "일반 입원과 MRI 공제금액의 합산 범위",
    summary: "여러 보장종목의 공제금액을 함께 누적하는 범위와 순서를 확정하지 못했습니다. 현재 입력한 누적 공제금액은 해당 계산 경로에만 적용하므로 가입 상품의 약관과 보험사 안내를 확인하세요.",
  },
  "GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY": {
    title: "3대비급여에서 지급 보험금이 0원인 치료의 횟수",
    summary: "보험금이 0원인 치료가 연간 횟수 한도를 소진하는지는 확인한 조문만으로 확정하지 못했습니다. 이 해석에 따라 결과가 달라지면 계산을 보류합니다.",
  },
  "GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY": {
    title: "비중증 통원에서 지급 보험금이 0원인 날의 일수",
    summary: "진료비가 있지만 보험금이 0원인 통원일이 연간 일수 한도를 소진하는지 확정하지 못했습니다. 이 해석에 따라 결과가 달라지면 계산을 보류합니다.",
  },
  "GEN2026-DEVELOPMENTAL-DISORDER-BENEFIT": {
    title: "정신발달장애 관련 보장 여부",
    summary: "관련 약관은 확인했지만, 질병분류코드·가입 당시 태아 여부·연령을 입력받지 않아 개별 보장 여부를 판정하지 않습니다.",
  },
  "GEN2026-PREGNANCY-CHILDBIRTH-BENEFIT": {
    title: "임신·출산 관련 보장 여부",
    summary: "관련 약관은 확인했지만, 가입일·분만예정일·단체보험 여부·전환 이력·본인부담금 구분 등 필요한 입력이 없어 개별 보장 여부를 판정하지 않습니다.",
  },
  "GEN2026-NONCRITICAL-EXCLUSION-ITEMS": {
    title: "일부 비중증 비급여의 보상 제외 여부",
    summary: "일부 면책 조항은 확인했지만, 질병분류코드·치료 유형·진료 목적을 입력받지 않아 개별 면책 여부를 판정하지 않습니다. 모든 면책 항목을 망라한 목록은 아닙니다.",
  },
  "GEN2026-PREMIUM-ADJ-TIER1-DISCOUNT-RATE": {
    title: "비중증 비급여 보험료의 1단계 할인율",
    summary: "할인율 산출 원칙은 확인했지만 연도·보험사·상품에 따라 달라지는 값을 공통 고정값으로 정하지 않았습니다.",
  },
  "GEN2026-PREMIUM-ADJ-FINAL-PREMIUM": {
    title: "할인·할증을 반영한 최종 보험료",
    summary: "계약의 순보험료와 상품별 반올림·할인 적용 순서가 필요해 최종 보험료를 산출하지 않습니다.",
  },
};
