// 5세대 실손 엔진 (Engine Core). v0.4 게이팅 기준.
//   - 값이 박힌 계산은 금융위 원문 직독 A 확정 항목만.
//   - 급여 통원 최소공제는 금융위 2026-05-06 원문으로 확인됐다.
//   - 건강보험 본인부담률은 건별 사용자 입력값이므로 미제공 시 PENDING_UNVERIFIED로 반환한다.
// 2026-09-04: 비급여 치료유형 축(nonBenefitItem) 신설 — 긴급 정확성 패치.
//   별표15 특별약관1·2는 비급여를 보장종목 3종으로 나누고 원문이 서로를 명시적으로 배제한다.
//   3대비급여(근골격계 이학요법·체외충격파 / 주사료 / MRI)와 비중증 MRI, 그리고 상급병실료
//   차액은 (1)상해비급여·(2)질병비급여 산식으로 계산하면 틀린다. 계산하지 않고 막는다.
// 2026-09-03: 별표15 2026.5.6 연혁본(5세대 표준약관) 직독 반영.
//   - 통원 한도(중증 1회당 / 비중증 1일당)는 약관 제5조③이 "20만원 이내에서 회사가 정한
//     금액 중 계약자가 선택한 금액"으로 규정한다. 상한선이지 계약값이 아니므로
//     사용자가 증권의 값을 준 경우에만 적용하고, 없으면 미적용 사실을 알린다.
//   - 자기부담 상한 500만원의 '연간'은 제5조②가 계약일 기준으로 정의한다(역년 아님).
// 2026-08-24: 전 경로의 금액 종결을 공통 settle()에 위임한다.
//   - R-2: 원 단위 정수로 확정 → 표시 계층에서 합계가 어긋나지 않는다.
//   - 급여 통원 경로의 클램프 누락(잠복 결함)도 함께 해소된다. HOLD 해제 시 재발하지 않는다.
import { CapCode, CalcResult, Gen2026ClaimInput, Gen2026NonBenefitItem } from "./types";
import { GEN2026 } from "./constants";
import { settle, normalizeAmount } from "../common/settle";

function ok(
  amount: number,
  ownPay: number,
  insurancePay: number,
  rateApplied: number,
  minDeductible: number,
  notes: string[] = [],
  appliedCaps: CapCode[] = [],
): CalcResult {
  return { status: "OK", generation: "2026", amount, ownPay, insurancePay, rateBased: Math.round(amount * rateApplied), rateApplied, minDeductible, notes, appliedCaps };
}

/**
 * 계약자가 선택한 통원 가입금액. 약관상 상한선을 넘겨 입력하면 상한선으로 깎는다.
 *
 * 정책 — 0·음수·비정상 값은 **미입력으로 본다**.
 *   0을 실제 한도로 적용하면 보험금이 0원이 되는데, 이는 "가입금액을 0으로 정한 계약"이
 *   아니라 입력하지 않았다는 뜻일 가능성이 압도적으로 높다. 조용히 0원 한도를 적용하는
 *   것보다 미적용 사실을 알리는 쪽이 안전하다.
 */
function outpatientLimit(value: number | undefined, max: number): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.floor(value), max);
}

function pending(amount: number, reasons: string[]): CalcResult {
  return { status: "PENDING_UNVERIFIED", generation: "2026", amount,
    ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null, notes: reasons, appliedCaps: [] };
}

/** 화면 표기용 이름. UI와 결과 안내가 같은 문구를 쓰도록 엔진에 둔다. */
export const GEN2026_NON_BENEFIT_ITEM_LABEL: Record<Gen2026NonBenefitItem, string> = {
  general: "일반 비급여",
  musculoskeletal_esw: "근골격계 이학요법·체외충격파",
  injection: "비급여 주사료",
  mri: "비급여 MRI",
  room_charge: "상급병실료 차액",
};

const NON_BENEFIT_ITEM_VALUES = Object.keys(GEN2026_NON_BENEFIT_ITEM_LABEL) as Gen2026NonBenefitItem[];

/**
 * 미구현 보장종목의 차단 사유. 약관이 왜 일반 경로를 금지하는지까지 밝힌다.
 * ⚠ 숫자를 만들어 내지 않는다. 근사치를 보여주는 것이 지금 문제의 원인이었다.
 */
const BLOCKED_ITEM_REASON: Record<Exclude<Gen2026NonBenefitItem, "general">, string> = {
  musculoskeletal_esw:
    "근골격계 이학요법·체외충격파는 중증에서 특별약관1 제3조 (3)3대비급여의 별도 보장종목이며, (1)상해비급여·(2)질병비급여에서 명시적으로 제외됩니다. 공제금액·금액한도·횟수한도가 일반 경로와 달라 현재 계산하지 않습니다.",
  injection:
    "비급여 주사료는 중증에서 특별약관1 제3조 (3)3대비급여의 별도 보장종목이며, (1)상해비급여·(2)질병비급여에서 명시적으로 제외됩니다(항암제·항생제·항진균제·희귀의약품 용도는 반대로 일반 경로에서 보상). 현재 계산하지 않습니다.",
  mri:
    "비급여 MRI는 중증에서 특별약관1 제3조 (3)3대비급여, 비중증에서 특별약관2 제3조 (3)비급여 자기공명영상진단의 별도 보장종목이며, 두 특약 모두 (1)상해비급여·(2)질병비급여에서 명시적으로 제외됩니다. 현재 계산하지 않습니다.",
  room_charge:
    "상급병실료 차액은 입원 보상 대상인 '비급여 의료비'에서 제외되고 별도 산식(비급여 병실료의 50%, 1일 평균 10만원 한도)이 적용됩니다. 입원일수 축이 필요해 현재 계산하지 않습니다.",
};

export function calc2026(input: Gen2026ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  const notes: string[] = [];

  // ── 급여 ──
  if (input.coverage === "benefit") {
    if (input.visit === "inpatient") {
      // #1 A: 급여 입원 20%
      const rate = GEN2026.benefit.inpatientRate;
      const s = settle(amount, amount * rate);
      return ok(amount, s.ownPay, s.insurancePay, rate, 0);
    }
    // 급여 통원: Max(건보율, 20%, 최소공제). 건보율은 건별 사용자 입력값이다.
    const holds: string[] = [];
    const nhis = input.nhisCoinsuranceRate;
    const md = GEN2026.benefit.outpatient.minDeductible;
    if (nhis === undefined) holds.push("급여 통원: 건강보험 본인부담률 미제공 → 계산 불가(#2 입력 필요)");
    if (holds.length) return pending(amount, holds);

    const rate = Math.max(nhis as number, GEN2026.benefit.outpatient.floorRate);
    const tier = input.tier ?? "clinic";
    const deduct = md[tier];
    const s = settle(amount, Math.max(amount * rate, deduct));
    return ok(amount, s.ownPay, s.insurancePay, rate, deduct);
  }

  // ── 비급여: 치료유형 → 중증/비중증 순으로 검사 ──
  // 타입은 nonBenefitItem을 필수로 강제하지만, 제네릭 진입점(calculate)이나 외부 런타임
  // 데이터는 타입을 우회할 수 있으므로 여기서도 검사한다.
  // 타입상으로는 필수라 optional 비교가 되지 않는다. 우회 경로를 가정한 방어적 읽기다.
  const item = (input as { nonBenefitItem?: Gen2026NonBenefitItem }).nonBenefitItem;
  if (item === undefined || !NON_BENEFIT_ITEM_VALUES.includes(item)) {
    return pending(amount, [
      "비급여: 치료유형(nonBenefitItem) 미지정 → 계산 불가. 5세대 비급여는 보장종목이 나뉘어 있어 치료유형 없이는 어떤 산식을 적용할지 정할 수 없습니다.",
    ]);
  }
  if (item !== "general") {
    return pending(amount, [
      `${GEN2026_NON_BENEFIT_ITEM_LABEL[item]}는 현재 계산 대상이 아닙니다.`,
      BLOCKED_ITEM_REASON[item],
    ]);
  }
  if (!input.severity) {
    return pending(amount, ["비급여: 중증/비중증(severity) 미지정 → 계산 불가"]);
  }
  const prior = Math.max(0, input.priorAnnualPaid ?? 0);

  if (input.severity === "critical") {
    const c = GEN2026.nonBenefit.critical;
    notes.push(`연간 보험가입금액(약관상 ${c.annualLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액, 상해·질병 각각)은 1건 계산에 반영되지 않습니다.`);
    if (input.visit === "inpatient") {
      const rate = c.inpatientRate; // 30% A
      let ownPayRaw = amount * rate;
      const appliedCaps: CapCode[] = [];
      // #6 상급종합·종합 입원 자기부담 상한 500만(연 누적).
      // 이 상한은 ownPay 측 구속이므로 settle의 insuranceCap이 아니라 ownPayRaw를 깎는다.
      if (input.tier === "hospital") {
        const remaining = Math.max(c.annualOwnPayCap - prior, 0);
        if (ownPayRaw > remaining) { ownPayRaw = remaining; appliedCaps.push("GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL"); }
        notes.push("자기부담 상한 500만원은 계약일 또는 매년 계약해당일부터 1년간 누적 기준입니다(priorAnnualPaid 반영).");
      }
      const s = settle(amount, ownPayRaw);
      return ok(amount, s.ownPay, s.insurancePay, rate, 0, notes, appliedCaps);
    }
    // 중증 통원: Max(30%, 3만). 1회당 가입금액은 계약자 선택값이라 있을 때만 적용한다.
    const rate = c.outpatientRate;
    const limit = outpatientLimit(input.perVisitCoverageLimit, c.outpatientPerVisitLimitMax);
    if (limit === undefined) {
      notes.push(`통원 1회당 가입금액(약관상 ${c.outpatientPerVisitLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액)은 입력하지 않아 적용하지 않았습니다.`);
    }
    notes.push(`중증 통원은 약관상 계약해당일 기준 1년간 ${c.outpatientAnnualVisits}회가 한도이지만, 1건 계산에는 반영되지 않습니다. 횟수를 반영하려면 여러 건 합산 계산을 이용해 주세요.`);
    const s = settle(amount, Math.max(amount * rate, c.outpatientMinDeductible), limit);
    const appliedCaps: CapCode[] = s.capped ? ["GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"] : [];
    return ok(amount, s.ownPay, s.insurancePay, rate, c.outpatientMinDeductible, notes, appliedCaps);
  }

  // 비중증(특약2)
  const n = GEN2026.nonBenefit.nonCritical;
  notes.push(`연간 보험가입금액(약관상 ${n.annualLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액, 상해·질병 각각)은 1건 계산에 반영되지 않습니다.`);
  if (input.visit === "inpatient") {
    const rate = n.inpatientRate; // 50% A
    const s = settle(amount, amount * rate, n.inpatientPerVisitLimit);
    const appliedCaps: CapCode[] = s.capped ? ["GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"] : [];
    return ok(amount, s.ownPay, s.insurancePay, rate, 0, notes, appliedCaps);
  }
  // 비중증 통원: Max(50%, 5만). 약관이 "통원 1일당(외래 및 처방·조제비 합산)"으로 규정하므로
  // 한 건은 하루치를 합산한 금액이며, 최소공제도 하루에 한 번만 적용된다.
  const rate = n.outpatientRate;
  const dayLimit = outpatientLimit(input.perVisitCoverageLimit, n.outpatientPerDayLimitMax);
  if (dayLimit === undefined) {
    notes.push(`통원 1일당 가입금액(약관상 ${n.outpatientPerDayLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액)은 입력하지 않아 적용하지 않았습니다.`);
  }
  const s = settle(amount, Math.max(amount * rate, n.outpatientMinDeductible), dayLimit);
  const appliedCaps: CapCode[] = s.capped ? ["GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY"] : [];
  return ok(amount, s.ownPay, s.insurancePay, rate, n.outpatientMinDeductible, notes, appliedCaps);
}
