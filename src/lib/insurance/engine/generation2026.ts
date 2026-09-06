// 5세대 실손 엔진 (Engine Core). v0.4 게이팅 기준.
//   - 값이 박힌 계산은 금융위 원문 직독 A 확정 항목만.
//   - 급여 통원 최소공제는 금융위 2026-05-06 원문으로 확인됐다.
//   - 건강보험 본인부담률은 건별 사용자 입력값이므로 미제공 시 PENDING_UNVERIFIED로 반환한다.
// 2026-09-03: 비급여 치료유형 축(nonBenefitItem) 신설 — 긴급 정확성 패치.
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
import { topic } from "../common/korean";

/**
 * 약관상 실제 공제금액.
 *
 * ⚠ ownPay와 다른 값이다. 지급 한도(통원 1회당·1일당 가입금액, 비중증 입원 회당 300만원,
 *   다회의 연간 보험가입금액)로 잘려 추가로 부담한 금액은 공제금액이 아니다.
 *   특별약관1 제5조⑤의 500만원 누적 대상은 이 값이지 최종 자기부담금이 아니다(인쇄 p.280).
 *
 * settle()과 같은 순서로 확정한다 — 반올림 후 진료비로 클램프.
 */
function deductibleOf(amount: number, rateBasedOwnPay: number): number {
  return Math.min(amount, Math.max(0, Math.round(rateBasedOwnPay)));
}

function ok(
  amount: number,
  ownPay: number,
  insurancePay: number,
  rateApplied: number,
  minDeductible: number,
  notes: string[] = [],
  appliedCaps: CapCode[] = [],
  // 비급여 전용. 500만원 공제 pool(제5조⑤)은 급여와 무관하므로 급여 결과에는
  // 값을 넣지 않는 것으로 끝내지 않고 **키 자체를 만들지 않는다**.
  deductibleApplied?: number,
): CalcResult {
  const r: CalcResult = { status: "OK", generation: "2026", amount, ownPay, insurancePay, rateBased: Math.round(amount * rateApplied), rateApplied, minDeductible, notes, appliedCaps };
  if (deductibleApplied !== undefined) r.deductibleApplied = deductibleApplied;
  return r;
}

/** 통원 가입금액 축의 판정 결과. 세 상태를 **호출부가 각각 다르게** 처리한다. */
type OutpatientLimitCheck =
  | { state: "applied"; limit: number }
  | { state: "unset" }
  | { state: "zero" }
  | { state: "invalid"; got: unknown };

/**
 * 계약자가 선택한 통원 가입금액. 약관상 상한선을 넘겨 입력하면 상한선으로 깎는다.
 *
 * 상한 절삭의 근거 — 두 상한선은 **계약값이 아니라 상한선**으로 등록돼 있다
 *   (GEN2026-CRITICAL-OUTPATIENT-PER-VISIT-LIMIT-MAX / GEN2026-NONCRITICAL-OUTPATIENT-PER-DAY-
 *   LIMIT-MAX, 둘 다 20만원). 약관이 "20만원 이내에서 계약 시 정한 금액"이라고 정하므로
 *   그보다 큰 값은 이 계약에서 나올 수 없다. **기존 절삭 처리를 그대로 둔다.**
 *
 * ⚠ **G-24에서 세 상태를 분리했다.** 종전에는 `value <= 0`과 `!Number.isFinite(value)`가
 *   한 줄에 묶여 있어, 명시적 `0`·음수·`NaN`·`±Infinity`·문자열·`null`·불리언·객체·배열·
 *   `bigint`·`Symbol`이 **모두 "미입력"으로 뭉개졌다**(엔진 직접 호출로 실측).
 *     - 한도가 통째로 사라져 보험금이 과다 산출됐다(중증 통원 격자: 정답 150,000 → 700,000).
 *     - 반대로 `0.5`는 `Math.floor`가 **한도 0원**을 만들어 적용해 보험금이 **0**이 됐다.
 *       같은 축에서 값에 따라 방향이 갈렸다.
 *     - `150,000.7`은 내림 150,000으로 조용히 바뀌었다.
 *     - `MAX_SAFE + 1`은 검증 없이 통과했다.
 *     - 명시적 `0`을 넘겼는데도 안내는 "**입력하지 않아** 적용하지 않았습니다"였다 —
 *       사실과 다른 안내다.
 * ⚠ `undefined`(미입력)와 숫자 `0`의 **계산 결과는 종전 그대로** 미적용이다. 바뀐 것은
 *   `0`에 붙는 안내와, 무효값이 미적용으로 삼켜지지 않는다는 점뿐이다.
 * ⚠ 0원 가입이 약관상 유효한 계약인지, 실제 한도가 0원인지는 원문에서 확인하지 않았고
 *   여기서 단정하지 않는다. 안내는 **계산기가 무엇을 했는지**만 말한다.
 */
function outpatientLimit(value: unknown, max: number): OutpatientLimitCheck {
  if (value === undefined) return { state: "unset" };
  if (!(typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) {
    return { state: "invalid", got: value };
  }
  if (value === 0) return { state: "zero" };
  return { state: "applied", limit: Math.min(value, max) };
}

/**
 * 무효한 통원 가입금액의 차단 안내. 이 진입점의 기존 차단 계약(`pending()`)을 그대로 쓴다.
 *
 * ⚠ **받은 값 자체를 문자열로 만들지 않는다 — `typeof`만 표시한다.** 이 파일은 G-15에서
 *   그 계약을 세웠다(`받은 값의 형식: ${typeof …}`). 외부 값을 문자열로 만들면 `Symbol`이나
 *   `toString()`이 던지는 객체에서 **차단 안내를 만드는 도중 예외**가 난다. 다른 엔진의
 *   `showValue()`(단계적 낮춤)를 여기에 복제하지 않는 것도 같은 이유이며, 이 파일 안에서
 *   두 가지 표시 방식이 섞이지 않게 한다.
 * @param axis "통원 1회당 가입금액"(중증) 또는 "통원 1일당 가입금액"(비중증)
 */
const invalidOutpatientLimitNotes = (axis: string, got: unknown): string[] => [
  `${axis}은 0 이상의 정수여야 합니다. 계산기가 잘못된 값을 임의로 고치지 않습니다 — 값을 고치면 지급 한도가 증권과 달라져 보험금이 잘못 계산됩니다. 증권에 적힌 통원 가입금액을 입력해 주세요.`,
  `받은 값의 형식: ${typeof got}`,
];

/**
 * 명시적 `0`의 안내. 미입력 안내와 **분리한다** — 값을 넘겼는데 "입력하지 않아"라고 말하면
 * 사실과 다르다.
 * @param unit "1회당"(중증, 특별약관1) 또는 "1일당"(비중증, 특별약관2 — 외래·처방조제 합산)
 */
const zeroOutpatientLimitNote = (unit: string): string =>
  `통원 가입금액을 0원으로 입력하셔서 계산기에서는 통원 ${unit} 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.`;

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
    "근골격계 이학요법·체외충격파는 중증에서 특별약관1 제3조 (3)3대비급여의 별도 보장종목이며, (1)상해비급여·(2)질병비급여에서 명시적으로 제외됩니다. 연간 금액·횟수 한도와 10회 단위 보상 승인이 함께 걸려 있어 1건만으로는 계산할 수 없습니다. 아래 여러 건 합산 계산에서 계산해 주세요.",
  injection:
    "비급여 주사료는 중증에서 특별약관1 제3조 (3)3대비급여의 별도 보장종목이며, (1)상해비급여·(2)질병비급여에서 명시적으로 제외됩니다(항암제·항생제·항진균제·희귀의약품 용도는 반대로 일반 경로에서 보상). 연간 금액·횟수 한도가 걸려 있어 1건만으로는 계산할 수 없습니다. 아래 여러 건 합산 계산에서 계산해 주세요.",
  mri:
    "비급여 MRI는 중증에서 특별약관1 제3조 (3)3대비급여, 비중증에서 특별약관2 제3조 (3)비급여 자기공명영상진단의 별도 보장종목이며, 두 특약 모두 (1)상해비급여·(2)질병비급여에서 명시적으로 제외됩니다. 연간 금액 한도가 걸려 있어 1건만으로는 계산할 수 없습니다. 아래 여러 건 합산 계산에서 계산해 주세요.",
  room_charge:
    "상급병실료 차액은 입원 보상 대상인 '비급여 의료비'에서 제외되고 별도 산식(차액의 50%, 1일 평균 보험금 10만원 한도)이 적용됩니다. 총 입원일수가 있어야 1일 평균 보험금을 계산할 수 있어 1건만으로는 계산할 수 없습니다. 아래 여러 건 합산 계산에서 입원일수와 함께 계산할 수 있습니다.",
};

export function calc2026(input: Gen2026ClaimInput): CalcResult {
  const amount = normalizeAmount(input.amount);
  const notes: string[] = [];

  // 5세대는 priorAnnualPaid를 읽지 않는다. 이 필드는 2·3세대 입원 자기부담 상한(200만원)용이고,
  // 5세대 500만원 상한(제5조⑤)은 자기부담금이 아니라 약관상 **공제금액**을 누적한다.
  //   제네릭 진입점(calculate)은 ClaimInput을 그대로 넘기므로 잘못된 필드가 들어올 수 있다.
  //   ⚠ 값이 무엇이든, priorAnnualDeductible을 함께 넘겼든 **존재 자체를 거부**한다.
  //     "둘 다 넘겼으면 통과"로 두면 레거시 값이 조용히 무시되어 사용자가 반영됐다고 오인한다.
  //     0도 명시적으로 전달된 레거시 필드이므로 차단한다.
  if ((input as { priorAnnualPaid?: number }).priorAnnualPaid !== undefined) {
    return pending(amount, [
      "5세대: priorAnnualPaid는 2·3세대 입원 자기부담 상한용 필드라 5세대에서는 읽지 않습니다. 5세대 500만원 상한은 약관상 공제금액을 누적하므로 priorAnnualDeductible로 넘겨 주세요.",
    ]);
  }

  // ── 급여 ──
  if (input.coverage === "benefit") {
    if (input.visit === "inpatient") {
      // #1 A: 급여 입원 20%
      const rate = GEN2026.benefit.inpatientRate;
      const s = settle(amount, amount * rate);
      return ok(amount, s.ownPay, s.insurancePay, rate, 0);
    }
    // 급여 통원: Max(건보율, 20%, 최소공제). 건보율은 건별 사용자 입력값이다.
    //
    // ⚠ 두 축을 **산식에 쓰기 전에** 검증한다(2026-09-05 실측으로 확인한 결함).
    //   종전에는 `Math.max(nhis as number, floorRate)`와 `md[input.tier ?? "clinic"]`이
    //   타입 단언과 인덱싱만으로 값을 받아, 타입을 우회한 외부 입력이 그대로 산식에 닿았다.
    //     - `nhis`가 `NaN`·`Infinity`·문자열·객체이면 `Math.max`가 **NaN**을 만들고,
    //     - `tier`가 `"clinic"`·`"hospital"` 밖의 값이면 `md[tier]`가 **undefined**가 되어
    //       `Math.max(amount * rate, undefined)`가 역시 **NaN**이 된다.
    //   그 NaN은 `settle()`의 `Number.isFinite(ownPayRaw) ? ownPayRaw : 0` 폴백에 걸려
    //   **자기부담금 0원 = 보험금 전액 지급**으로 끝났다(보험금 과다 산출). `settle`의 불변식
    //   (`ownPay + insurancePay === amount`)은 그대로라 하류의 어떤 검사도 이것을 잡지 못한다.
    //   ⚠ `settle`의 폴백을 없애는 것이 아니라 **여기서 NaN이 만들어지지 않게** 막는다.
    //     그 폴백은 다른 경로의 최후 방어선이라 그대로 둔다.
    //
    // ⚠ 두 축의 `undefined`는 서로 다른 뜻이고, 이번에 그 의미를 바꾸지 않는다.
    //     nhis  — "모른다". 계산이 성립하지 않으므로 종전 안내로 차단한다.
    //     tier  — **계산기의 종전 계약**이 미지정을 병·의원급 최소공제로 계산해 왔다.
    //             그 폴백을 그대로 둔다. ⚠ 이 폴백에 약관 근거를 붙이지 않는다 — 직접 읽은
    //             범위에서 표준약관은 종별 미지정의 기본값을 정하지 않는다. 여기서 유지하는
    //             것은 약관이 정한 값이 아니라 **기존 동작**이다.
    //   ⚠ 그러나 `null`은 두 축 모두 **거부**다. 타입 계약은 `tier?: Tier`이므로 유효값은
    //     `undefined`·`"clinic"`·`"hospital"`뿐이고, 종전에 `?? "clinic"`이 `null`을
    //     병·의원급으로 해석한 것은 의도한 입력 계약이 아니라 관용적 부작용이었다.
    //     한 축의 `null`만 해석하면 두 축의 엄격 검증 원칙이 어긋난다.
    //
    // ⚠ 산식·20% 하한·최소공제·`ok()`의 반환값은 그대로다. 바뀌는 것은 **무효 입력이
    //   숫자를 만들지 못하게 막는 것**뿐이다. 0은 유효값이라 종전대로 20% 하한이 적용된다.
    //
    // ⚠ 안내에 **받은 값 자체를 넣지 않고 `typeof`만 넣는다.** 무효 입력을 템플릿 리터럴에
    //   그대로 끼우면 Symbol이나 `toString()`이 던지는 객체에서 안내를 만드는 중에 예외가 난다.
    //   `itemGuards`·`multiClaim2026`의 `showValue()`를 이 파일에 세 번째로 복제하는 것은
    //   승인받은 범위(급여 통원 분기)를 넘으므로 하지 않는다. `typeof`는 어떤 값에서도
    //   던지지 않으면서 "무엇을 잘못 넘겼는지"를 알려 준다.
    const holds: string[] = [];
    const nhis = input.nhisCoinsuranceRate;
    const md = GEN2026.benefit.outpatient.minDeductible;
    if (nhis === undefined) holds.push("급여 통원: 건강보험 본인부담률 미제공 → 계산 불가(#2 입력 필요)");
    else if (!(typeof nhis === "number" && Number.isFinite(nhis) && nhis >= 0 && nhis <= 1)) {
      holds.push(`급여 통원: 건강보험 본인부담률(nhisCoinsuranceRate)은 0 이상 1 이하의 유한한 숫자여야 합니다(비율이며 백분율이 아닙니다 — 20%는 0.2). 받은 값의 형식: ${typeof nhis}`);
    }
    const tierRaw = (input as { tier?: unknown }).tier;
    if (tierRaw !== undefined && tierRaw !== "clinic" && tierRaw !== "hospital") {
      holds.push(`급여 통원: 의료기관 종별(tier)은 "clinic" 또는 "hospital"이어야 합니다. 최소공제금액이 종별로 다르므로(병·의원급 ${md.clinic.toLocaleString("ko-KR")}원 / 상급종합·종합병원 ${md.hospital.toLocaleString("ko-KR")}원) 값을 확인하기 전에는 계산하지 않습니다. 받은 값의 형식: ${typeof tierRaw}`);
    }
    if (holds.length) return pending(amount, holds);

    const rate = Math.max(nhis as number, GEN2026.benefit.outpatient.floorRate);
    // ⚠ 여기 오는 tierRaw는 `undefined`·"clinic"·"hospital" 셋뿐이다(위 검사가 나머지를
    //   거부했다). `?? "clinic"`을 쓰지 않는 이유는 그것이 `null`까지 병·의원급으로
    //   해석해 버리기 때문이고, 타입 단언을 쓰지 않는 이유는 값 목록을 여기서 다시
    //   좁히는 편이 검사와 산식이 어긋날 여지를 남기지 않기 때문이다.
    //   `undefined`(미지정)와 "clinic"은 같은 병·의원급 최소공제로 간다 — 종전 그대로다.
    const tier = tierRaw === "hospital" ? "hospital" : "clinic";
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
      // 조사는 라벨의 받침에 따라 달라진다("차액은" / "주사료는"). 하드코딩하지 않는다.
      `${topic(GEN2026_NON_BENEFIT_ITEM_LABEL[item])} 현재 계산 대상이 아닙니다.`,
      BLOCKED_ITEM_REASON[item],
    ]);
  }
  if (!input.severity) {
    return pending(amount, ["비급여: 중증/비중증(severity) 미지정 → 계산 불가"]);
  }
  const priorDeductible = Math.max(0, input.priorAnnualDeductible ?? 0);

  if (input.severity === "critical") {
    const c = GEN2026.nonBenefit.critical;
    notes.push(`연간 보험가입금액(약관상 ${c.annualLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액, 상해·질병 각각)은 1건 계산에 반영되지 않습니다.`);
    if (input.visit === "inpatient") {
      // ⚠ 종별에 따라 공제금액 상한 500만원(제5조⑤) 적용 여부가 갈린다. 미지정으로 계산하면
      //   상급종합·종합병원 입원에서 공제가 과다 적용돼 보험금이 과소 산출된다.
      //   비중증 입원의 1회당 300만원 한도와 같은 이유로, 값을 확인하기 전에는 계산하지 않는다.
      if (input.tier !== "clinic" && input.tier !== "hospital") {
        return pending(amount, [
          "중증 비급여 입원: 의료기관 종별 미지정 → 계산 불가. 공제금액 상한 500만원은 상급종합·종합병원 입원에만 적용되므로(특별약관1 제5조 제5항), 병·의원급인지 상급종합·종합병원인지에 따라 보험금이 달라집니다.",
        ]);
      }
      const rate = c.inpatientRate; // 30% A
      let deductRaw = amount * rate;
      const appliedCaps: CapCode[] = [];
      // #6 상급종합·종합 입원 **공제금액** 상한 500만(연 누적). 특별약관1 제5조⑤(인쇄 p.280)
      //   "…상해·질병 및 3대비급여 의료비(…) 중 **공제금액**이 …연간 500만원을 초과하는
      //    때에는 500만원까지 공제합니다."
      //   자기부담금 상한이 아니라 공제 상한이므로 settle의 insuranceCap이 아니라 공제액을 깎는다.
      if (input.tier === "hospital") {
        const remaining = Math.max(c.annualDeductibleCap - priorDeductible, 0);
        if (deductRaw > remaining) { deductRaw = remaining; appliedCaps.push("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"); }
        notes.push("공제금액 상한 500만원은 계약일 또는 매년 계약해당일부터 1년간 누적 기준입니다(priorAnnualDeductible 반영). 누적 대상은 약관상 공제금액이며, 보험가입금액 한도로 추가 부담한 금액은 포함되지 않습니다.");
      }
      const s = settle(amount, deductRaw);
      return ok(amount, s.ownPay, s.insurancePay, rate, 0, notes, appliedCaps, deductibleOf(amount, deductRaw));
    }
    // 중증 통원: Max(30%, 3만). 1회당 가입금액은 계약자 선택값이라 있을 때만 적용한다.
    const rate = c.outpatientRate;
    const checked = outpatientLimit(input.perVisitCoverageLimit, c.outpatientPerVisitLimitMax);
    if (checked.state === "invalid") {
      return pending(amount, invalidOutpatientLimitNotes("통원 1회당 가입금액", checked.got));
    }
    if (checked.state === "unset") {
      notes.push(`통원 1회당 가입금액(약관상 ${c.outpatientPerVisitLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액)은 입력하지 않아 적용하지 않았습니다.`);
    }
    if (checked.state === "zero") notes.push(zeroOutpatientLimitNote("1회당"));
    const limit = checked.state === "applied" ? checked.limit : undefined;
    notes.push(`중증 통원은 약관상 계약해당일 기준 1년간 ${c.outpatientAnnualVisits}회가 한도이지만, 1건 계산에는 반영되지 않습니다. 횟수를 반영하려면 여러 건 합산 계산을 이용해 주세요.`);
    const ownPayRaw = Math.max(amount * rate, c.outpatientMinDeductible);
    const s = settle(amount, ownPayRaw, limit);
    const appliedCaps: CapCode[] = s.capped ? ["GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"] : [];
    // 1회당 가입금액이 구속되면 ownPay가 공제금액보다 커진다. 공제금액은 한도 반영 전 값이다.
    return ok(amount, s.ownPay, s.insurancePay, rate, c.outpatientMinDeductible, notes, appliedCaps, deductibleOf(amount, ownPayRaw));
  }

  // 비중증(특약2)
  const n = GEN2026.nonBenefit.nonCritical;
  notes.push(`연간 보험가입금액(약관상 ${n.annualLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액, 상해·질병 각각)은 1건 계산에 반영되지 않습니다.`);
  if (input.visit === "inpatient") {
    const rate = n.inpatientRate; // 50% A
    // 1회당 300만원 한도는 **모든 입원**에 걸리지 않는다. 특별약관2 제3조 (1)제1항·(2)제1항
    //   <구분·보상금액> 입원 행(인쇄 p.287·p.290):
    //   "…50%에 해당하는 금액. 다만, 「의료법」 제3조제2항에 의한 의료기관(동법 제3조의3에 의한
    //    종합병원은 제외)에서 발생한 비급여 의료비는 1회당 300만원을 한도로 합니다."
    //   → 병·의원급(clinic)만 대상이고 상급종합·종합병원(hospital)에는 적용하지 않는다.
    //   ⚠ 종별에 따라 지급 보험금이 갈리므로 미지정 상태로는 계산하지 않는다.
    //     기본값으로 계산하면 상급종합·종합병원 입원에서 보험금이 과소 산출된다.
    if (input.tier !== "clinic" && input.tier !== "hospital") {
      return pending(amount, [
        "비중증 비급여 입원: 의료기관 종별 미지정 → 계산 불가. 1회당 300만원 한도는 「의료법」 제3조제2항 의료기관 중 종합병원을 제외한 곳에서 발생한 비급여 의료비에만 적용되므로(특별약관2 제3조 (1)제1항·(2)제1항), 병·의원급인지 상급종합·종합병원인지에 따라 보험금이 달라집니다.",
      ]);
    }
    const limitTiers: readonly string[] = n.inpatientPerVisitLimitTiers;
    const perVisitLimit = limitTiers.includes(input.tier) ? n.inpatientPerVisitLimit : undefined;
    notes.push(perVisitLimit === undefined
      ? "1회당 300만원 한도는 「의료법」 제3조제2항 의료기관 중 종합병원을 제외한 곳에만 적용됩니다. 상급종합·종합병원 입원에는 적용하지 않았습니다(특별약관2 제3조 (1)제1항·(2)제1항)."
      : "병·의원급 입원의 비급여 의료비는 1회당 300만원이 한도입니다(특별약관2 제3조 (1)제1항·(2)제1항).");
    const s = settle(amount, amount * rate, perVisitLimit);
    const appliedCaps: CapCode[] = s.capped ? ["GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"] : [];
    return ok(amount, s.ownPay, s.insurancePay, rate, 0, notes, appliedCaps, deductibleOf(amount, amount * rate));
  }
  // 비중증 통원: Max(50%, 5만). 약관이 "통원 1일당(외래 및 처방·조제비 합산)"으로 규정하므로
  // 한 건은 하루치를 합산한 금액이며, 최소공제도 하루에 한 번만 적용된다.
  const rate = n.outpatientRate;
  const dayChecked = outpatientLimit(input.perVisitCoverageLimit, n.outpatientPerDayLimitMax);
  if (dayChecked.state === "invalid") {
    return pending(amount, invalidOutpatientLimitNotes("통원 1일당 가입금액", dayChecked.got));
  }
  if (dayChecked.state === "unset") {
    notes.push(`통원 1일당 가입금액(약관상 ${n.outpatientPerDayLimitMax.toLocaleString("ko-KR")}원 이내에서 계약 시 정한 금액)은 입력하지 않아 적용하지 않았습니다.`);
  }
  if (dayChecked.state === "zero") notes.push(zeroOutpatientLimitNote("1일당"));
  const dayLimit = dayChecked.state === "applied" ? dayChecked.limit : undefined;
  const ownPayRaw = Math.max(amount * rate, n.outpatientMinDeductible);
  const s = settle(amount, ownPayRaw, dayLimit);
  const appliedCaps: CapCode[] = s.capped ? ["GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY"] : [];
  return ok(amount, s.ownPay, s.insurancePay, rate, n.outpatientMinDeductible, notes, appliedCaps, deductibleOf(amount, ownPayRaw));
}
