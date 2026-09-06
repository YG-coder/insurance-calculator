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
import { GEN2026 } from "./constants";
import { CAUSE_VALUES, SEVERITY_VALUES, isClaimAmount, isPositiveInt, oneOf, rejected } from "./itemGuards";
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
  "priorAnnualOutpatientDays",
  // ⚠ G-28에서 추가했다. 이 키가 빠져 있어 상급병실료 경로가 승인 구간 전용 축
  //   `priorAnnualTreatmentActCount`를 **조용히 폐기**했다(실측: 값 `0`·`5` 모두 결과가
  //   미제공과 완전히 같았고 접근자 호출 0회 — 반영돼서가 아니라 읽히지 않아서다).
  //   타입은 이미 `?: never`로 닫혀 있었으므로 타입과 런타임이 어긋난 상태였다.
  //   ⚠ **목록의 맨 끝**에 넣는다. 이 루프는 먼저 찾은 키에서 반환하므로, 뒤에 붙이면
  //     기존 13개 키의 안내 우선순위가 그대로 유지된다.
  "priorAnnualTreatmentActCount",
  // ⚠ G-31에서 추가했다. 이 키가 빠져 있어 상급병실료 경로가 급여 전용 축
  //   `nhisCoinsuranceRate`를 **조용히 폐기**했다(실측: 값 `0.2`·`0`의 결과가 미제공과
  //   완전히 같았고 접근자 호출 0회). 이 진입점은 `coverage: "non_benefit"`만 받으므로
  //   국민건강보험 본인부담률에 대응하는 축이 없다.
  //   ⚠ **목록의 맨 끝**에 넣는다. 이 루프는 먼저 찾은 키에서 반환하므로, 뒤에 붙이면
  //     기존 14개 키의 안내 우선순위가 그대로 유지된다(G-28이 같은 이유로 맨 끝에 붙였다).
  "nhisCoinsuranceRate",
] as const;

/**
 * 검증을 통과한 두 금액 축. `undefined`는 미입력이고, 그 밖은 0 이상의 안전한 정수다.
 *   ⚠ 본체가 입력을 **다시 읽지 않도록** 값을 그대로 돌려준다.
 */
type CheckedMoney = {
  paid: number | undefined; limit: number | undefined;
  /**
   * 검증을 통과한 행별 진료비. `stays`와 같은 순서·같은 길이다.
   *   ⚠ 본체가 `stay.roomChargeTotal`을 **다시 읽지 않도록** 값을 그대로 돌려준다.
   *     종전에는 같은 이름을 3회 읽었다(가드 인자·음수 비교·본체 `normalizeAmount`).
   *     외부 객체의 접근자가 여러 번 실행되면 값이 실행 사이에 달라져, 검증한 값과
   *     계산에 쓰는 값이 갈린다(실측: 검증 1,000,000 → 계산 4,000,000).
   */
  stayTotals: number[];
};

function validate(input: Gen2026RoomChargeInput): Gen2026RejectedResult | CheckedMoney {
  const raw = input as unknown as Record<string, unknown>;
  if (raw.route !== "room_charge") return rejected("경로(route)", raw.route);
  if (raw.coverage !== "non_benefit") return rejected("급여 구분(coverage)", raw.coverage);
  if (!oneOf(raw.cause, CAUSE_VALUES)) return rejected("원인(cause)", raw.cause);
  if (!oneOf(raw.severity, SEVERITY_VALUES)) return rejected("질환 구분(severity)", raw.severity);
  // ⚠ 각 키를 **한 번만** 읽는다(G-28). 종전에는 존재 검사와 `rejected()` 인자에서 같은
  //   이름을 2회 읽어, 값이 달라지는 접근자에서 검사한 값과 안내에 실리는 값이 갈릴 수
  //   있었다. 결과는 종전과 같고 읽는 횟수만 줄었다.
  for (const key of UNUSED_KEYS) {
    const got: unknown = raw[key];
    if (got !== undefined) return rejected(`상급병실료 차액 계산에 쓰이지 않는 입력(${key})`, got);
  }
  if (!Array.isArray(raw.stays)) return rejected("입원 목록(stays)", raw.stays);
  // ── 진료비: 컨테이너 → 원소 → 합계 (G-26) ────────────────────────
  //   ⚠ 종전에는 공용 `isNum()`(= 유한한 숫자)에 음수 비교만 더했다. 그래서 **소수와 안전
  //     정수 초과가 통과했고**, 통과한 값이 본체 `normalizeAmount`에서 조용히 달라졌다
  //     (실측: `0.5` → 0원 행, `300000.9` → 300,000, `MAX_SAFE+1` → 무검증 통과).
  //   ⚠ 숫자 `0`은 **유효한 청구 행**이다. 종전 그대로 계산에 포함한다.
  //   ⚠ 안내 문구는 바꾸지 않았다 — 바뀐 것은 그 안내에 **도달하는 값의 범위**뿐이다.
  const stayTotals: number[] = [];
  for (let i = 0; i < raw.stays.length; i++) {
    const stay = raw.stays[i] as Record<string, unknown> | null;
    if (stay === null || typeof stay !== "object") return rejected(`${i + 1}번째 입원`, stay);
    // ⚠ **한 번만 읽는다.** 아래 검사와 본체 계산이 모두 이 값 하나를 쓴다.
    const total: unknown = stay.roomChargeTotal;
    if (!isClaimAmount(total)) {
      return rejected(`${i + 1}번째 입원의 상급병실료 차액(roomChargeTotal)`, total);
    }
    // 총 입원일수는 약관에 산정 방법 정의가 없다. 추정하지 않고 양의 정수만 받는다.
    if (!isPositiveInt(stay.inpatientDays)) {
      return rejected(`${i + 1}번째 입원의 총 입원일수(inpatientDays)`, stay.inpatientDays);
    }
    stayTotals.push(total);
  }
  // ⚠ 원소가 모두 안전한 정수여도 **합계**는 범위를 벗어날 수 있다([MAX_SAFE, MAX_SAFE]).
  //   그 뒤의 누적(지급보험금·연간 한도 비교)이 정밀도를 잃으므로 계산하지 않는다.
  const stayTotalSum = stayTotals.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(stayTotalSum)) {
    return rejected(
      `상급병실료 차액의 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다. 각 행이 안전한 정수여도 합계는 벗어날 수 있습니다(받은 행 수 ${stayTotals.length}) —`,
      stayTotalSum,
    );
  }
  // ── 두 금액 축의 값 검증 ──────────────────────────────────────────
  //   종전에는 공용 `isNum()`(= 유한한 숫자)만 봤다. 그래서 **음수와 소수가 통과했고**,
  //   통과한 뒤 하류에서 조용히 다른 값이 됐다(기준선 e0b3db9 엔진 직접 호출로 실측).
  //     - 기존 지급보험금 `-400,000` → `nonNegInt`가 **0**으로 만들어, 정답 지급액 600,000이
  //       ins 1,000,000이 됐다(누적이 사라져 남은 한도가 커졌다).
  //     - 연간 가입금액 `0.5` → `annualLimitOf`의 `Math.floor`가 **한도 0원**을 만들어 적용해
  //       ins **0**이 됐다. 같은 격자에서 명시적 `0`은 미적용이라 1,000,000이다.
  //     - 연간 가입금액 `400,000.9` → 내림 400,000으로 조용히 바뀌었다.
  //   ⚠ 두 축 모두 **런타임 예외는 내지 않았다.** 조용히 틀린 금액이 문제다.
  //
  //   ⚠ 공용 `isNum()`을 강화하지 않는다. 나머지 호출부는 **계약이 다르다** —
  //     `roomChargeTotal`과 `line.amount`(진료비)는 `undefined`를 거부하고 `0`이 유효한
  //     청구 행이며 하류 `normalizeAmount`의 계약을 따른다. 한 가드가 "유한한 숫자"와
  //     "0 이상의 안전한 정수"를 동시에 뜻하게 만들면 어느 축을 고칠 때 다른 축이 함께 움직인다.
  //     그래서 이 파일 안에 **이름이 분명한 전용 가드**를 두고 이 두 축만 바꾼다.
  //   ⚠ 두 축은 **각각 한 번만** 읽는다. 종전에는 존재 검사·가드 인자·`rejected()` 인자·본체에서
  //     같은 이름을 **3회** 읽었다(실측). 외부 객체의 접근자가 여러 번 실행되면 값이 실행 사이에
  //     달라질 수 있다. 검증한 값을 그대로 돌려주어 본체가 다시 읽지 않게 한다.
  //   ⚠ 허용 범위는 축마다 그대로다 — 기존 지급보험금은 한도를 넘는 과거 상태도 유효하고,
  //     연간 가입금액은 상한을 넘으면 종전대로 상한으로 깎는다. `undefined`와 숫자 `0`의
  //     계산도 종전 그대로다. 이 커밋은 **무효값을 막을 뿐 계산을 바꾸지 않는다.**
  //   ⚠ 안내는 기존 `rejected()`를 그대로 쓴다. 문구는 한 글자도 바꾸지 않았다 —
  //     바뀐 것은 그 안내에 **도달하는 값의 범위**뿐이다.
  const paidRaw: unknown = (raw as Record<string, unknown>).priorAnnualInsurancePaid;
  if (paidRaw !== undefined && !nonNegSafeInt(paidRaw)) {
    return rejected("기존 지급보험금(priorAnnualInsurancePaid)", paidRaw);
  }
  const limitRaw: unknown = (raw as Record<string, unknown>).annualCoverageLimit;
  if (limitRaw !== undefined && !nonNegSafeInt(limitRaw)) {
    return rejected("연간 보험가입금액(annualCoverageLimit)", limitRaw);
  }
  return { paid: paidRaw as number | undefined, limit: limitRaw as number | undefined, stayTotals };
}

// ⚠ 관용 파서 `nonNegInt()`를 이 파일에서 **삭제했다.** 유일한 사용처였던 기존 지급보험금이
//   엄격 검증으로 바뀌어, 이제 검증을 통과한 원값(`undefined` 또는 0 이상의 안전한 정수)만 쓴다.
//   파서를 남겨 두면 다음에 추가되는 축이 다시 조용히 변형될 자리가 생긴다.
//   ⚠ 다른 엔진(`multiClaim.ts`·`multiClaim2026.ts`·`specialItem2026.ts`)은 각자 자기 사본을
//     가지며 이번 변경 범위가 아니다.

function annualLimitOf(severity: Severity, limit: number | undefined): number | undefined {
  // 계약자가 "N원 이내에서 선택한 금액"이다(제5조①). 미입력과 `0`은 미적용으로 본다.
  //   ⚠ 여기 오는 값은 검증을 통과했다 — `undefined`이거나 0 이상의 안전한 정수다.
  //     그래서 `Number.isFinite`·`Math.floor`가 필요 없다. 내림은 값을 조용히 바꾸는 자리였다.
  //   ⚠ `0`을 미적용으로 보는 것은 **이 계산기의 정책**이고 종전 그대로다. 0원 가입이 실제로
  //     선택 가능한 계약값인지는 원문에서 확인하지 않았고 이 커밋에서 단정하지 않는다.
  //   ⚠ 상한을 넘는 값의 절삭은 제5조①에 근거가 있는 정당한 계산이다. 종전 그대로 둔다.
  if (limit === undefined || limit === 0) return undefined;
  const max = severity === "critical"
    ? GEN2026.nonBenefit.critical.annualLimitMax
    : GEN2026.nonBenefit.nonCritical.annualLimitMax;
  return Math.min(limit, max);
}

/**
 * 0 이상의 안전한 정수인지만 보는 **형식 검증**. 상급병실료의 **두 금액 축 전용**이다
 * (기존 지급보험금·연간 보험가입금액).
 *
 * ⚠ 공용 `isNum()`(= 유한한 숫자)과 **다른 계약**이다. `isNum()`은 이 파일의 진료비
 *   (`roomChargeTotal`)와 `specialItem2026`의 `line.amount`도 쓰는데, 그 두 축은
 *   `undefined`를 거부하고 `0`이 유효한 청구 행이며 하류 `normalizeAmount`를 따른다.
 *   공용 가드를 강화하면 승인 범위 밖의 두 축이 함께 움직인다. 그래서 여기 따로 둔다.
 * ⚠ 이 가드는 **형식만** 본다. 한도 초과 허용 여부·`0`의 의미·상한 절삭은 축마다 다르고
 *   각자의 자리에서 정한다.
 */
const nonNegSafeInt = (v: unknown): boolean =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

const CAUSE_LABEL = { injury: "상해", disease: "질병" } as const;

/**
 * 연간 보험가입금액의 상태.
 *   "applied" = 한도로 적용됨 / "unset" = 미입력 / "zero" = 명시적 0원.
 *
 * ⚠ "unset"과 "zero"는 **계산이 같고 안내만 다르다.** `annualLimitOf()`는 둘 다 `undefined`로
 *   접어 버리므로, 접힌 뒤의 값만으로는 두 상태를 구분할 수 없다. 종전에는 `buildNotes()`가
 *   접힌 값(`annualLimit === undefined`)만 보아 **0원을 넣은 사용자에게도** "입력하지 않아
 *   적용하지 않았습니다"라고 말했다(공개 화면·엔진 직접 호출 모두에서 실측).
 * ⚠ 이 판정은 **이미 한 번 읽어 검증한 값**(`CheckedMoney.limit`)에서 만든다. 입력을 다시
 *   읽지 않는다 — 접근자 호출 횟수는 종전 그대로 정상 경로 1회, 선행 preflight 차단 0회다.
 */
type AnnualLimitState = "applied" | "unset" | "zero";

function buildNotes(input: Gen2026RoomChargeInput, limitState: AnnualLimitState): string[] {
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
  // ⚠ 미입력 안내의 문구는 한 글자도 바꾸지 않았다. 바뀐 것은 **이 안내에 도달하는 상태**다 —
  //   종전에는 명시적 `0`도 여기로 왔다.
  if (limitState === "unset") {
    notes.push("연간 보험가입금액을 입력하지 않아 적용하지 않았습니다. 증권에서 확인한 값을 입력하면 지급 한도로 반영됩니다.");
  }
  // ⚠ 명시적 `0`은 미입력과 **다른 상태**다. 계산 결과는 종전 그대로 미적용이지만, 값을
  //   넘겼는데 "입력하지 않아"라고 말하면 사실과 다르다.
  // ⚠ 이 문장은 **계산기가 0원을 어떻게 다뤘는지**만 말한다. 0원 가입이 약관상 유효한 계약인지,
  //   무효인지, 실제 계약 한도가 0원인지, 0원이 미입력과 법적으로 같은지는 원문에서 확인하지
  //   않았고 여기서 단정하지 않는다.
  // ⚠ 문구는 일반 다회(G-21, multiClaim2026.ts)의 같은 축 안내와 한 글자도 다르지 않다.
  //   같은 축(연간 보험가입금액)을 같은 방식으로 다뤘으므로 화면마다 다르게 말하지 않는다.
  if (limitState === "zero") {
    notes.push("연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.");
  }
  return notes;
}

export function calculateRoomCharge2026(
  input: Gen2026RoomChargeInput,
): Gen2026RoomChargeResult | Gen2026RejectedResult {
  const checked = validate(input);
  if ("route" in checked) return checked;

  // 검증을 통과한 원값을 그대로 쓴다. 정규화하지 않고, 입력을 다시 읽지도 않는다.
  //   ⚠ 계산에 쓰는 한도와 안내에 쓰는 상태를 **같은 원값 하나**에서 만든다. 계산은 종전 그대로
  //     `annualLimitOf()`가 정하고, 상태는 접히기 전의 값에서 읽는다.
  const annualLimit = annualLimitOf(input.severity, checked.limit);
  const limitState: AnnualLimitState =
    checked.limit === undefined ? "unset" : checked.limit === 0 ? "zero" : "applied";
  let paid = checked.paid ?? 0;
  const lines: Gen2026RoomChargeLineResult[] = [];

  for (let index = 0; index < input.stays.length; index++) {
    const stay = input.stays[index];
    // ⚠ 검증을 통과한 값을 그대로 쓴다. `normalizeAmount`를 다시 걸지 않는다 —
    //   위 검사를 통과한 값에 대해 그 함수는 항등이며(`Math.max(0, Math.floor(v))`),
    //   다시 걸면 "여기서도 값을 고친다"고 읽힌다.
    const total = checked.stayTotals[index];
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
    notes: buildNotes(input, limitState),
  };
}
