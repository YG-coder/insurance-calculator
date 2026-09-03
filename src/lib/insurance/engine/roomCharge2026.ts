// 5세대 상급병실료 차액 엔진.
//
// 근거: 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특약1 제2조(용어의 정의) — 인쇄 p.257
//     상급병실료 차액 = 상급병상을 이용함에 따라 요양급여 대상인 입원료 외에 추가로 부담하는
//     입원실 이용비용. 보장대상의료비 = 실제 부담액 − 보장제외금액(… 및 비급여 병실료 중
//     회사가 보장하지 않는 금액).
//   특약1 제3조 (1)①(p.258)·(2)①(p.261), 특약2 제3조 (1)①(p.287)·(2)①(p.290)
//     <구분·보상금액> '상급병실료 차액' 행 — 네 표의 문언이 동일하다.
//       "비급여 병실료의 50%. 다만, 1일 평균금액 10만원을 한도로 하며, 1일 평균금액은
//        입원기간 동안 비급여 병실료 전체를 총 입원일수로 나누어 산출합니다."
//     같은 표의 입원 행은 "비급여 의료비(비급여 병실료는 제외합니다)"이다.
//   특약1 제5조①(p.279)·특약2 제5조①(p.308) — 연간 보험가입금액은 (1)상해비급여·(2)질병비급여
//     각각에 대해 입원과 통원의 보상금액을 합산해 정한다.
//
// 축이 3대비급여와 반대다.
//   상급병실료 차액은 (1)(2) 표 안의 **행**이라 상해·질병이 나뉘고(cause 필수),
//   연간 보험가입금액을 일반 입원·통원 보상금액과 **공유**한다.
//   3대비급여는 독립 보장종목이라 상해·질병을 합산하고 별도 한도를 갖는다. 섞으면 안 된다.
//
// ⚠ 500만원 공제금액 상한(특약1 제5조⑤)은 적용하지 않는다.
//   상급병실료 행에는 약관상 '공제금액'이 규정돼 있지 않고, 제5조⑤가 이 행에 적용된다는
//   명시적 근거나 공식 해석을 찾지 못했다(GEN2026-ROOM-CHARGE-DEDUCTIBLE-POOL = HOLD).
//   미지급 50%를 deductibleApplied로 만들지도 않는다.
import { normalizeAmount } from "../common/settle";
import { GEN2026 } from "./constants";
import { CAUSE_VALUES, SEVERITY_VALUES, isNum, isPositiveInt, oneOf, rejected } from "./itemGuards";
import {
  CapCode, Gen2026RejectedResult, Gen2026RoomChargeInput, Gen2026RoomChargeLineResult,
  Gen2026RoomChargeResult, Severity,
} from "./types";

const R = GEN2026.roomCharge;

/** 상급병실료 계산에 쓰이지 않는 축. 실려 오면 조용히 무시하지 않고 막는다. */
const UNUSED_KEYS = [
  "visit", "tier", "item", "nonBenefitItem", "injectionPurpose", "lines", "amounts",
  "approvedThroughVisit", "priorAnnualCoveredCount", "priorAnnualInpatientDeductible",
  "priorAnnualDeductible", "outpatientCoverageLimit", "priorAnnualOutpatientVisits",
] as const;

function validate(input: Gen2026RoomChargeInput): Gen2026RejectedResult | null {
  const raw = input as unknown as Record<string, unknown>;
  if (raw.route !== "room_charge") return rejected("경로(route)", raw.route);
  if (raw.coverage !== "non_benefit") return rejected("급여 구분(coverage)", raw.coverage);
  if (!oneOf(raw.cause, CAUSE_VALUES)) return rejected("원인(cause)", raw.cause);
  if (!oneOf(raw.severity, SEVERITY_VALUES)) return rejected("질환 구분(severity)", raw.severity);
  for (const key of UNUSED_KEYS) {
    if (raw[key] !== undefined) return rejected(`상급병실료 차액 계산에 쓰이지 않는 입력(${key})`, raw[key]);
  }
  if (!Array.isArray(raw.stays)) return rejected("입원 목록(stays)", raw.stays);
  for (let i = 0; i < raw.stays.length; i++) {
    const stay = raw.stays[i] as Record<string, unknown> | null;
    if (stay === null || typeof stay !== "object") return rejected(`${i + 1}번째 입원`, stay);
    // ⚠ 금액을 조용히 0으로 정규화하지 않는다. 이 경로는 전용 진입점이라 NaN·Infinity·음수를
    //   명시적으로 거부할 수 있다. 차액에 음수는 의미가 없고 오입력 신호다.
    if (!isNum(stay.roomChargeTotal) || (stay.roomChargeTotal as number) < 0) {
      return rejected(`${i + 1}번째 입원의 상급병실료 차액(roomChargeTotal)`, stay.roomChargeTotal);
    }
    // 총 입원일수는 약관에 산정 방법 정의가 없다. 추정하지 않고 양의 정수만 받는다.
    if (!isPositiveInt(stay.inpatientDays)) {
      return rejected(`${i + 1}번째 입원의 총 입원일수(inpatientDays)`, stay.inpatientDays);
    }
  }
  if (raw.priorAnnualInsurancePaid !== undefined && !isNum(raw.priorAnnualInsurancePaid)) {
    return rejected("기존 지급보험금(priorAnnualInsurancePaid)", raw.priorAnnualInsurancePaid);
  }
  if (raw.annualCoverageLimit !== undefined && !isNum(raw.annualCoverageLimit)) {
    return rejected("연간 보험가입금액(annualCoverageLimit)", raw.annualCoverageLimit);
  }
  return null;
}

const nonNegInt = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

function annualLimitOf(severity: Severity, raw: number | undefined): number | undefined {
  // 계약자가 "N원 이내에서 선택한 금액"이다(제5조①). 0·음수·미입력은 미적용으로 본다.
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return undefined;
  const max = severity === "critical"
    ? GEN2026.nonBenefit.critical.annualLimitMax
    : GEN2026.nonBenefit.nonCritical.annualLimitMax;
  return Math.min(Math.floor(raw), max);
}

const CAUSE_LABEL = { injury: "상해", disease: "질병" } as const;

function buildNotes(input: Gen2026RoomChargeInput, annualLimit: number | undefined): string[] {
  const max = input.severity === "critical"
    ? GEN2026.nonBenefit.critical.annualLimitMax
    : GEN2026.nonBenefit.nonCritical.annualLimitMax;
  const notes = [
    "입력한 금액은 전체 병실료가 아니라 실제 사용 병실과 기준병실의 **비급여 차액**입니다(특별약관1 제2조).",
    "일반 입원 의료비와 합쳐 넣지 마세요. 약관의 입원 보상금액은 '비급여 의료비(비급여 병실료는 제외합니다)'이고, 상급병실료 차액은 같은 표의 별도 행입니다.",
    "보험금은 차액의 50%이며, 1일 평균 보험금 10만 원이 한도입니다. 1행은 약관상 1회의 입원입니다.",
    `연간 보험가입금액은 약관상 ${max.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액이며, ${CAUSE_LABEL[input.cause]}비급여 축에만 누적됩니다. 일반 입원·통원 보상금액과 같은 한도를 나눠 쓰므로 기존 지급보험금에 그 금액도 포함해 입력해 주세요(특별약관1·2 제5조 제1항).`,
    "병실 변경·부분일·외박·복수 병원 입원의 일수 판단은 약관에 정의가 없어 계산기가 하지 않습니다. 입력한 총 입원일수를 그대로 사용합니다.",
    "보험계약이 종료된 뒤에도 계속 중인 입원은 종료일 다음 날부터 180일까지 보상되지만(특별약관1 제3조 (1)제3항), 이 계산에는 반영하지 않았습니다.",
    "공제금액 상한 500만 원(특별약관1 제5조 제5항)은 상급병실료 차액에 적용한다는 명시적 근거를 찾지 못해 반영하지 않았습니다.",
  ];
  if (annualLimit === undefined) {
    notes.push("연간 보험가입금액을 입력하지 않아 적용하지 않았습니다. 증권에서 확인한 값을 입력하면 지급 한도로 반영됩니다.");
  }
  return notes;
}

export function calculateRoomCharge2026(
  input: Gen2026RoomChargeInput,
): Gen2026RoomChargeResult | Gen2026RejectedResult {
  const invalid = validate(input);
  if (invalid !== null) return invalid;

  const annualLimit = annualLimitOf(input.severity, input.annualCoverageLimit);
  let paid = nonNegInt(input.priorAnnualInsurancePaid);
  const lines: Gen2026RoomChargeLineResult[] = [];

  for (let index = 0; index < input.stays.length; index++) {
    const stay = input.stays[index];
    const total = normalizeAmount(stay.roomChargeTotal);
    const days = stay.inpatientDays;
    const appliedCaps: CapCode[] = [];

    // ⚠ 순서가 값을 바꾼다. 50%를 먼저 적용한 뒤 1일 평균 **보험금**에 한도를 건다.
    //   반대로 하면(병실료를 먼저 자르고 50%) 1일 지급이 최대 5만원으로 절반이 된다.
    const payBeforeCaps = Math.round(total * R.payRate);
    const dailyCapAmount = R.dailyPayCap * days;
    const payAfterDailyCap = Math.min(payBeforeCaps, dailyCapAmount);
    if (payAfterDailyCap < payBeforeCaps) appliedCaps.push("GEN2026_ROOM_CHARGE_DAILY_AVERAGE_LIMIT");

    const insurancePay = annualLimit === undefined
      ? payAfterDailyCap
      : Math.min(payAfterDailyCap, Math.max(annualLimit - paid, 0));
    if (insurancePay < payAfterDailyCap) appliedCaps.push("GEN2026_ROOM_CHARGE_ANNUAL_COVERAGE");

    const baseOwnPay = total - payBeforeCaps;
    const dailyCapExcess = payBeforeCaps - payAfterDailyCap;
    const annualCapExcess = payAfterDailyCap - insurancePay;
    const excessOwnPay = dailyCapExcess + annualCapExcess;
    const ownPay = baseOwnPay + excessOwnPay;
    paid += insurancePay;

    lines.push({
      status: "OK", generation: "2026", index, covered: true,
      amount: total, ownPay, insurancePay,
      // 자기부담률 50%. 상급병실료 차액에는 약관상 정액 최소공제가 없다.
      rateBased: payBeforeCaps, rateApplied: R.payRate, minDeductible: 0,
      // ⚠ deductibleApplied는 채우지 않는다. 이 행에는 약관상 '공제금액' 개념이 없다.
      inpatientDays: days,
      dailyAverageRoomCharge: Math.round(total / days),
      payBeforeCaps, dailyCapAmount, baseOwnPay, dailyCapExcess, annualCapExcess, excessOwnPay,
      notes: [], appliedCaps,
    });
  }

  return {
    route: "room_charge", status: "OK", generation: "2026", lines,
    totalAmount: lines.reduce((a, l) => a + l.amount, 0),
    totalOwnPay: lines.reduce((a, l) => a + (l.ownPay ?? 0), 0),
    totalInsurancePay: lines.reduce((a, l) => a + (l.insurancePay ?? 0), 0),
    appliedCaps: [...new Set(lines.flatMap((l) => l.appliedCaps))],
    notes: buildNotes(input, annualLimit),
  };
}
