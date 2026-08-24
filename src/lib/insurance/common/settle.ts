// 금액 종결(settle) — 자기부담금·보험적용금액을 원 단위 정수로 확정한다.
//
// 이 파일은 다음 세 가지를 한 지점에서 처리한다.
//   1) 자기부담금이 진료비를 초과하지 못하도록 클램프 (소액 통원 경계값)
//   2) 원 단위 정수화 (표시 계층에서 합계가 어긋나지 않도록)
//   3) 보험지급 한도 적용 순서 (한도가 구속될 때는 확정 변수가 뒤바뀐다)
//
// ─────────────────────────────────────────────────────────────────────
// 원 단위 종결 정책 (Rounding Policy)
//
//   확정 대상 : ownPay (자기부담금). insurancePay가 잔차를 흡수한다.
//   방향      : Math.round (사사오입 — .5는 올림)
//   등급      : D — 임시 정책. 규제 근거가 아니다.
//
//   근거      : 약관·감독규정상 직접 근거 미확인.
//               2026-08-24 조사 — 실손 약관 2종 전문(삼성화재 실손의료비보험 2605.1,
//               무배당 프로미라이프 실손의료비보험2101)과 보험업감독규정·보험업감독업무
//               시행세칙에서 보험금 단수처리 규정을 찾지 못했다.
//               채택 이유는 규제 근거가 아니라 **기존 화면 호환성**이다.
//               종전 UI가 본인부담금을 Math.round로 표시했으므로, 강조 항목인
//               본인부담금 표시를 그대로 유지하고 보험적용금액만 잔차를 흡수하게 한다.
//
//   편향      : Math.round는 .5를 올리므로 타이에서 자기부담금이 1원 상향된다.
//               비급여 비중증 50% 경로는 홀수 진료비 전부가 타이이므로, 이 편향은
//               드문 경계값이 아니라 해당 경로 입력의 약 절반에 적용된다.
//               (급여 20% 0% / 비급여 중증 30% 10% / 비급여 비중증 50% 50%)
//
//   참고 자료 (정책 근거 아님) :
//               건강보험 본인일부부담금에는 "10원 미만 절사"가 있다
//               (보건복지부 고시 제2017-118호, 건강보험심사평가원 본인부담기준 안내).
//               그러나 이는 요양기관이 환자에게 청구하는 국민건강보험 본인일부부담금에
//               대한 규정으로, 보험사가 지급하는 실손보험금에는 직접 적용되지 않는다.
//               기록으로만 남기며 방향 결정 근거로 사용하지 않는다.
//
//   재검토    : 표준약관 개정 또는 감독당국 유권해석으로 공식 근거가 확인되는 시점.
//   결정일    : 2026-08-24
// ─────────────────────────────────────────────────────────────────────

export const ROUNDING_POLICY = {
  target: "ownPay",
  mode: "round",
  grade: "D",
  decidedAt: "2026-08-24",
  basis: "regulatory-basis-not-found; adopted for display compatibility",
} as const;

/** 진료비 정규화 — 비음수 원 단위 정수. 두 엔진이 동일 계약을 갖도록 공유한다. */
export function normalizeAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

export interface SettleResult {
  amount: number;       // 정규화된 진료비(원, 정수)
  ownPay: number;       // 자기부담금(원, 정수)
  insurancePay: number; // 보험 적용 금액(원, 정수)
  capped: boolean;      // 보험지급 한도가 구속되었는지
}

/**
 * 자기부담금·보험적용금액을 원 단위 정수로 확정한다.
 *
 * 보장 성질 (불변식):
 *   - ownPay + insurancePay === amount
 *   - 0 <= ownPay <= amount
 *   - 0 <= insurancePay <= amount
 *   - Number.isInteger(ownPay) && Number.isInteger(insurancePay)
 *
 * 확정 변수의 순서가 중요하다:
 *   - 한도가 구속되지 않으면 ownPay가 확정 변수이고 insurancePay가 잔차를 흡수한다.
 *   - 한도가 구속되면 insurancePay가 한도(정수 상수)로 확정되고 ownPay가 잔차를 흡수한다.
 *   반올림을 한도 적용 후 일괄 후처리로 넣으면 한도가 깨진다. 이 순서를 지켜야 한다.
 *
 * @param amount       진료비(원)
 * @param ownPayRaw    정률·최소공제·자기부담 상한까지 반영한 자기부담금(실수 허용)
 * @param insuranceCap 보험지급 한도(원, 정수). 지정 시 한도가 구속 변수가 된다.
 */
export function settle(amount: number, ownPayRaw: number, insuranceCap?: number): SettleResult {
  const a = normalizeAmount(amount);
  const raw = Number.isFinite(ownPayRaw) ? ownPayRaw : 0;

  // 정책: ownPay를 사사오입으로 확정한다. 진료비를 초과할 수 없다.
  let ownPay = Math.min(a, Math.max(0, Math.round(raw)));
  let insurancePay = a - ownPay;
  let capped = false;

  if (insuranceCap !== undefined && Number.isFinite(insuranceCap) && insurancePay > insuranceCap) {
    // 한도가 구속되면 확정 변수가 insurancePay로 바뀐다.
    insurancePay = Math.max(0, Math.floor(insuranceCap));
    ownPay = a - insurancePay;
    capped = true;
  }

  return { amount: a, ownPay, insurancePay, capped };
}
