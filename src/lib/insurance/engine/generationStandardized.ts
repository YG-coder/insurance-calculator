// 표준화 실손 엔진 — 2세대(2009.10~2017.3) · 3세대(2017.4~2021.6) 공용.
//
// 두 세대의 기본형 산식은 금융감독원 보험업감독업무시행세칙 [별표 15] 표준약관 직독 결과
// 동일하다. 세대가 갈리는 지점은 계산식이 아니라 (a) 근거 약관과 (b) 미적용 고지 문구다.
// 따라서 산식은 한 곳에 두고 세대별 상수·고지만 주입한다.
//
// 4·5세대와 다른 점 — 옮겨 적을 때 반드시 지켜야 한다:
//   1) 급여·비급여를 **합한 금액**에 단일 정률을 적용한다. coverage로 요율이 갈리지 않는다.
//   2) **선택형에는 통원 정률공제가 없다.** 정액 공제만 적용한다(약관 <표1> 선택형 행).
//   3) 입원 자기부담에는 연간 200만원 상한이 있다. 이는 보험금 상한이 아니라 자기부담 상한이므로
//      settle의 insuranceCap이 아니라 ownPayRaw를 깎아야 한다(5세대 500만 상한과 같은 성질).
//   4) 통원 공제 분류축(Facility)은 4세대의 Tier와 다르다. 종합병원이 2·3세대에서는 1만5천원,
//      4세대에서는 상급종합과 같은 2만원이다. 섞어 쓰면 안 된다.
import { CapCode, ClaimInput, CalcResult, Facility, Plan } from "./types";
import { GEN2009, GEN2009_NOT_APPLIED, GEN2017, GEN2017_NOT_APPLIED } from "./constants";
import { settle, normalizeAmount } from "../common/settle";

type StandardizedGeneration = "2009" | "2017";

const TABLE = {
  "2009": { constants: GEN2009, notApplied: GEN2009_NOT_APPLIED, cap: "GEN2009_INPATIENT_OWN_PAY_ANNUAL" as CapCode },
  "2017": { constants: GEN2017, notApplied: GEN2017_NOT_APPLIED, cap: "GEN2017_INPATIENT_OWN_PAY_ANNUAL" as CapCode },
} as const;

function pending(generation: StandardizedGeneration, amount: number, reasons: string[]): CalcResult {
  return {
    status: "PENDING_UNVERIFIED", generation, amount,
    ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null,
    notes: reasons, appliedCaps: [],
  };
}

export function calcStandardized(generation: StandardizedGeneration, input: ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  const { constants, notApplied, cap } = TABLE[generation];

  // 표준형/선택형은 계약자가 가입한 상품이 정하는 값이다. 계약일로 추정하지 않는다.
  const plan: Plan | undefined = input.plan;
  if (plan !== "standard" && plan !== "selective") {
    return pending(generation, amount, [
      "표준형/선택형(plan) 미지정 → 계산 불가. 보험증권의 상품명 또는 가입내역에서 확인해 주세요.",
    ]);
  }

  const isOutpatient = input.visit === "outpatient";
  const notes: string[] = [];
  const notAppliedList: string[] = [...notApplied.all];
  if (isOutpatient) notAppliedList.push(...notApplied.outpatient);

  if (!isOutpatient) {
    // ── 입원 ──
    const rate = constants.inpatientRate[plan];
    const capValue = constants.inpatientAnnualOwnPayCap;
    const prior = Math.max(0, input.priorAnnualPaid ?? 0);
    const remaining = Math.max(capValue - prior, 0);

    let ownPayRaw = amount * rate;
    const appliedCaps: CapCode[] = [];
    if (ownPayRaw > remaining) {
      ownPayRaw = remaining;
      appliedCaps.push(cap);
    }
    notes.push(
      `입원 자기부담은 계약일 또는 매년 계약해당일 기준 1년간 ${capValue.toLocaleString("ko-KR")}원이 상한입니다(초과분은 보험이 부담).`,
      "이 계산에 반영되지 않은 약관 한도: " + notAppliedList.join(" / "),
    );

    const s = settle(amount, ownPayRaw);
    return {
      status: "OK", generation, amount: s.amount, ownPay: s.ownPay, insurancePay: s.insurancePay,
      rateBased: Math.round(amount * rate), rateApplied: rate, minDeductible: 0,
      notes, appliedCaps,
    };
  }

  // ── 통원 ──
  const facility: Facility = input.facility ?? "clinic";
  const minDeductible = constants.outpatientMinDeductible[facility];
  // 표준형만 정률과 비교한다. 선택형은 정액 공제뿐이다.
  const rate = plan === "standard" ? constants.outpatientStandardRate : 0;
  const ownPayRaw = plan === "standard"
    ? Math.max(amount * rate, minDeductible)
    : minDeductible;

  notes.push(
    plan === "standard"
      ? `통원 공제는 ${minDeductible.toLocaleString("ko-KR")}원과 의료비의 ${Math.round(rate * 100)}% 중 큰 금액입니다.`
      : `선택형 통원 공제는 정액 ${minDeductible.toLocaleString("ko-KR")}원입니다(정률 공제 없음).`,
    "이 계산에 반영되지 않은 약관 한도: " + notAppliedList.join(" / "),
  );

  const s = settle(amount, ownPayRaw);
  return {
    status: "OK", generation, amount: s.amount, ownPay: s.ownPay, insurancePay: s.insurancePay,
    rateBased: Math.round(amount * rate), rateApplied: rate, minDeductible,
    notes, appliedCaps: [],
  };
}
