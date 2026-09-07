// 다회 청구 엔진 — 2·3세대(표준화 실손 / 착한실손).
//
// 단건 엔진(calcStandardized)을 행마다 호출하되, 건 사이에 이어지는 상태를 순서대로 넘긴다.
// 기존 CalcResult 계약은 건드리지 않는다 — 4·5세대와 단건 경로는 영향이 없다.
//
// 이어지는 상태 두 가지
//   1) 입원 자기부담 연간 상한(200만원). **입원 자기부담만 누적한다.**
//      약관의 200만원 단서는 (1)상해입원 표 안에만 있고 통원 쪽에는 없다.
//   2) 연간 외래 방문·처방전 횟수. 한도를 넘긴 행은 보상 대상이 아니므로
//      자기부담 = 진료비 전액, 보험금 0으로 확정한다.
//
// 순서 규약
//   입력 행 순서를 발생 순서로 본다. **총액은 순서와 무관하지만**(테스트로 고정),
//   어느 행이 상한·횟수 한도에 걸리는지는 순서가 정한다.
import {
  CalcResult, CapCode, ClaimLine, ClaimLineResult, Facility,
  MultiClaimInput, MultiClaimResult,
} from "./types";
import { GEN2009, GEN2017 } from "./constants";
import { calcStandardized } from "./generationStandardized";
import { normalizeAmount } from "../common/settle";

type StandardizedGeneration = "2009" | "2017";

const LIMITS = {
  "2009": {
    constants: GEN2009,
    visitCap: "GEN2009_OUTPATIENT_ANNUAL_VISITS" as CapCode,
    prescriptionCap: "GEN2009_PRESCRIPTION_ANNUAL_COUNT" as CapCode,
  },
  "2017": {
    constants: GEN2017,
    visitCap: "GEN2017_OUTPATIENT_ANNUAL_VISITS" as CapCode,
    prescriptionCap: "GEN2017_PRESCRIPTION_ANNUAL_COUNT" as CapCode,
  },
} as const;

const nonNegInt = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/**
 * 안내에 "받은 값"을 실을 때 쓰는 **안전 표시**. **계산에는 쓰지 않는다.**
 *
 * ⚠ `JSON.stringify`는 값에 따라 **예외를 던진다** — `bigint`("Do not know how to serialize
 *   a BigInt"), 순환 참조("Converting circular structure to JSON"), `toJSON()`이 던지는 객체다.
 *   이 파일의 검증은 **타입을 우회한 외부 입력**을 막는 자리인데, 그 입력이 차단 결과가 아니라
 *   런타임 예외로 끝나면 막는 의미가 없다. 실측으로 세 종류 모두 예외가 확인됐다.
 * ⚠ 표시 실패가 검증 실패가 되어서는 안 된다. 실패하면 `String()`으로 낮추고, 그것마저
 *   실패하면 고정 문구로 대체한다. 반환 계약(`blocked`)과 안내의 의미·순서는 그대로다.
 * ⚠ **정상적으로 직렬화되는 값의 표시는 종전과 한 글자도 같다.** 낮추는 것은 예외가 났을 때뿐이다.
 *   `undefined`도 종전과 같다 — 종전에는 `JSON.stringify(undefined)`가 돌려준 `undefined`가
 *   템플릿에서 "undefined"로 찍혔고, 여기서는 `String(undefined)`가 같은 문자열을 만든다.
 *   ⚠ 다만 `JSON.stringify`가 **정상적으로** `undefined`를 돌려주는 그 밖의 값(Symbol·함수)은
 *     종전에 "undefined"로 찍혀 미입력과 구분되지 않았다. 이제 `String()`의 결과가 찍힌다
 *     (예: `Symbol(s)`). 잘못된 값을 미입력처럼 보이게 하던 표시를 고친 **의도된 변경**이다.
 * ⚠ 두 번째 catch는 `JSON.stringify`와 `String()`이 **모두** 실패하는 값에서만 쓰인다
 *   (예: `Object.create(null)`에 `bigint` 필드를 넣은 값). `toString()`만 던지는 보통의
 *   객체는 JSON 직렬화가 성공하므로 여기까지 오지 않는다.
 * ⚠ 공용 모듈로 빼지 않는다. 세대별 엔진은 각자 자기 사본을 가진다 — 이 표시 헬퍼를 공용화하면
 *   세대마다 다른 안내 계약이 한 파일에 묶여, 한쪽을 고칠 때 다른 쪽이 함께 움직인다.
 */
const showValue = (v: unknown): string => {
  try {
    const json = JSON.stringify(v);
    if (json !== undefined) return json;
  } catch { /* bigint·순환 참조·toJSON 예외 */ }
  try {
    return String(v);
  } catch { /* toString·[Symbol.toPrimitive]가 던지거나 없는 객체 */ }
  return "(표시할 수 없는 값)";
};

/**
 * 이미 사용한 횟수·건수 축 검증(2·3세대 전용).
 *
 * ⚠ 금액 축이 쓰는 nonNegInt()의 관용(음수→0, NaN·Infinity→0, 소수 내림)을 물려받지 않는다.
 *   실제로 nonNegInt()는 문자열 "180"과 Infinity를 **0**으로 만들었다 — "이미 180회 썼다"가
 *   "한 번도 안 썼다"가 되어 한도가 사라지고 보험금이 과다 산출된다.
 *   ⚠ 한도를 넘는 값도 유효한 과거 상태다. 절삭하지 않는다.
 *   (금액 축의 관용은 이번 범위가 아니라 그대로 둔다.)
 *
 * ⚠ 형식 규칙만 공유한다. 외래는 '회', 처방전은 '건'이고 카운터·CapCode·안내가 모두 다르다.
 */
const badCount = (v: unknown): boolean =>
  !(typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
const readCount = (o: object, key: string): unknown =>
  (o as Record<string, unknown>)[key];

/**
 * 이 묶음 진입점의 **어느 행 구성에서도** 쓰이지 않는 축 29종 (G-34B).
 *
 * 종전에는 이 진입점에 stray 목록 자체가 없었다 — 두 카운터만 행 구성으로 판정했고,
 * 나머지 축은 실려 와도 **조용히 버려졌다**. 전수 스윕(기준선 `0914d7d`, 8경로군 × 35축,
 * 금액 배율 3벌 × 값 격자, 접근자 계수)에서 정상 리터럴이 전부 조용히 통과했다.
 *   · 다른 진입점의 축    `amount`(단건), `amounts`·`stays`·`roomChargeTotal`·
 *                         `inpatientDays`(4·5세대 다회·상급병실료의 컨테이너와 원소 필드)
 *   · 다른 세대의 축      `tier`·`cause`·`coverage`·`nhisCoinsuranceRate`·
 *                         `annualCoverageLimit`·`priorAnnualInsurancePaid`·
 *                         `priorAnnualRiderPaid`·`priorAnnualRiderVisits`·
 *                         `approvedThroughVisit`·`rider`(4세대),
 *                         `severity`·`nonBenefitItem`·`priorAnnualDeductible`·
 *                         `outpatientCoverageLimit`·`priorAnnualOutpatientDays`·
 *                         `route`·`item`·`injectionPurpose`·
 *                         `priorAnnualInpatientDeductible`·`priorAnnualCoveredCount`·
 *                         `priorAnnualTreatmentActCount`(5세대)
 *   · 행 안에서만 의미    `visit`·`facility`는 `lines[]`의 원소 필드다. 최상위에 실으면
 *                         읽히지 않는다 — 이 묶음은 행마다 둘이 다를 수 있기 때문이다.
 *   · 입력 축이 아닌 것   `generation`은 함수의 **첫 인자**이지 입력 객체의 필드가 아니다.
 *                         객체에 실으면 계산 세대를 바꾸지 않고 조용히 버려진다.
 * ⚠ `plan`은 넣지 않는다 — 이 진입점의 필수 축이고 위에서 이미 미지정을 막는다.
 * ⚠ 두 카운터(`priorAnnualOutpatientVisits`·`priorAnnualPrescriptions`)도 넣지 않는다.
 *   행 구성으로 판정하는 기존 계약이 이미 있고, 그 안내가 더 구체적이다.
 */
const MULTI_STD_UNUSED_KEYS = [
  "amount", "amounts", "stays", "roomChargeTotal", "inpatientDays", "generation",
  "coverage", "visit", "cause", "severity", "tier", "facility",
  "route", "item", "rider", "nonBenefitItem", "injectionPurpose", "nhisCoinsuranceRate",
  "outpatientCoverageLimit", "annualCoverageLimit",
  "priorAnnualDeductible", "priorAnnualInpatientDeductible", "priorAnnualInsurancePaid",
  "priorAnnualRiderPaid", "priorAnnualOutpatientDays", "priorAnnualRiderVisits",
  "approvedThroughVisit", "priorAnnualCoveredCount", "priorAnnualTreatmentActCount",
] as const;

/** 연간 횟수 한도를 넘겨 보상 대상이 아닌 행. 자기부담이 진료비 전액이 된다. */
function notCovered(
  generation: StandardizedGeneration,
  index: number,
  line: ClaimLine,
  capCode: CapCode,
  reason: string,
): ClaimLineResult {
  const amount = normalizeAmount(line.amount);
  return {
    status: "OK", generation, index, covered: false,
    amount, ownPay: amount, insurancePay: 0,
    rateBased: 0, rateApplied: 0, minDeductible: 0,
    notes: [reason], appliedCaps: [capCode],
  };
}

export function calculateMany(
  generation: StandardizedGeneration,
  input: MultiClaimInput,
): MultiClaimResult {
  const { constants, visitCap, prescriptionCap } = LIMITS[generation];
  const lines = input.lines ?? [];

  // plan 미지정은 단건과 같은 규약으로 보류한다. 값을 지어내지 않는다.
  if (input.plan !== "standard" && input.plan !== "selective") {
    return {
      status: "PENDING_UNVERIFIED", generation, lines: [],
      totalAmount: lines.reduce((sum, l) => sum + normalizeAmount(l.amount), 0),
      totalOwnPay: null, totalInsurancePay: null, appliedCaps: [],
      notes: ["표준형/선택형(plan) 미지정 → 계산 불가. 보험증권의 상품명 또는 가입내역에서 확인해 주세요."],
    };
  }

  // ── 이미 사용한 횟수·건수 축 ─────────────────────────────────────────
  //   ⚠ 4·5세대와 달리 이 묶음은 행마다 visit·facility가 다를 수 있다. 그래서 어떤 축이
  //     필요한지는 최상위 필드가 아니라 **lines의 내용**이 정한다.
  //       외래 180회  — 약국 처방조제가 아닌 통원 행이 하나라도 있으면 필요
  //       처방전 180건 — 약국 처방조제 통원 행이 하나라도 있으면 필요
  //       입원 행     — 두 축 모두 쓰지 않는다
  //   ⚠ 쓰이지 않는 축이 실려 오면 조용히 버리지 않는다. 버리면 한도를 반영했다고 오해한다.
  const visitsRaw = readCount(input, "priorAnnualOutpatientVisits");
  const prescriptionsRaw = readCount(input, "priorAnnualPrescriptions");
  const isPharmacyLine = (l: ClaimLine) => l.visit === "outpatient" && (l.facility ?? "clinic") === "pharmacy";
  const usesVisits = lines.some((l) => l.visit === "outpatient" && !isPharmacyLine(l));
  const usesPrescriptions = lines.some(isPharmacyLine);
  /**
   * 통원 행이 하나라도 있는가. **안내(notes)를 만들 조건으로만 쓴다** — 계산·한도·횟수에는
   * 관여하지 않는다.
   *
   * ⚠ 위 두 축과 다르다. `usesVisits`·`usesPrescriptions`는 **외래와 약국을 나눈** 축이고,
   *   이것은 둘을 합친 "통원 행이 있는가"다. 회(건)당 가입금액은 약국 처방조제 행에도
   *   적용되므로(아래 `line.visit === "outpatient"`) 나눈 축으로는 판정할 수 없다.
   */
  const hasOutpatient = lines.some((line) => line.visit === "outpatient");

  const blocked = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation, lines: [],
    totalAmount: lines.reduce((sum, l) => sum + normalizeAmount(l.amount), 0),
    totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });

  if (!usesVisits && visitsRaw !== undefined) {
    return blocked([
      `외래 방문 횟수(priorAnnualOutpatientVisits)는 약국 처방조제가 아닌 통원의 연 ${constants.outpatientAnnualVisits}회 한도에만 쓰입니다.`,
      usesPrescriptions
        ? "이 묶음에는 약국 처방조제 행만 있습니다. 처방전 건수(priorAnnualPrescriptions)로 넘겨 주세요. 두 축은 단위가 회와 건으로 달라 서로 대신 쓰지 않습니다."
        : "이 묶음에는 해당하는 통원 행이 없습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
      `받은 값: ${showValue(visitsRaw)}`,
    ]);
  }
  if (!usesPrescriptions && prescriptionsRaw !== undefined) {
    return blocked([
      `처방전 건수(priorAnnualPrescriptions)는 약국 처방조제의 연 ${constants.prescriptionAnnualCount}건 한도에만 쓰입니다.`,
      usesVisits
        ? "이 묶음에는 약국 처방조제 행이 없습니다. 외래 방문 횟수(priorAnnualOutpatientVisits)로 넘겨 주세요. 두 축은 단위가 회와 건으로 달라 서로 대신 쓰지 않습니다."
        : "이 묶음에는 통원 행이 없습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
      `받은 값: ${showValue(prescriptionsRaw)}`,
    ]);
  }
  // 미입력은 0으로 추정하지 않는다 — 과거 사용량을 모르면 한도를 반영할 수 없다.
  //   ⚠ 이는 계산기의 안전 정책이다. 약관이 이 입력을 의무화한 것이 아니다.
  //   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 0은 유효값이다.
  if (usesVisits) {
    if (visitsRaw === undefined) {
      return blocked([
        `외래 방문은 계약해당일 기준 1년간 ${constants.outpatientAnnualVisits}회가 한도입니다.`,
        "이미 사용한 외래 방문 횟수(priorAnnualOutpatientVisits)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 이전 방문이 없으면 0을 넣어 주세요.",
      ]);
    }
    if (badCount(visitsRaw)) {
      return blocked([
        "이미 사용한 외래 방문 횟수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
        `받은 값: ${showValue(visitsRaw)}`,
      ]);
    }
  }
  if (usesPrescriptions) {
    if (prescriptionsRaw === undefined) {
      return blocked([
        `처방조제는 계약해당일 기준 1년간 ${constants.prescriptionAnnualCount}건이 한도입니다.`,
        "이미 사용한 처방전 건수(priorAnnualPrescriptions)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 이전 처방이 없으면 0을 넣어 주세요.",
      ]);
    }
    if (badCount(prescriptionsRaw)) {
      return blocked([
        "이미 사용한 처방전 건수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
        `받은 값: ${showValue(prescriptionsRaw)}`,
      ]);
    }
  }

  // ── 쓰이지 않는 축 stray 거부 (G-34B) ───────────────────────────────
  //   ⚠ **선행 preflight 전부의 뒤**다(표준형/선택형 미지정 · 두 카운터의 stray·미입력·
  //     잘못된 값). 그 검사들이 결과를 정하는 경로에서는 아래 이름들을 **읽지 않는다.**
  //   ⚠ 각 키를 **한 번만** 읽고, 목록 순서대로 먼저 찾은 키만 안내한다.
  //   ⚠ 값이 `0`이어도 막는다. `undefined`만 미제공이다 — 호출부의
  //     `{ ...base, key: undefined }` 패턴은 막지 않는다(이 저장소의 화면이 그 패턴을 쓴다).
  //   ⚠ 반환은 기존 `blocked()`다 — **검증된 진료비 합계를 그대로 보존**하고 행은 비운다.
  //     이 진입점의 다른 차단과 같은 계약이고, 새 반환 모양을 만들지 않는다.
  {
    for (const key of MULTI_STD_UNUSED_KEYS) {
      const got = readCount(input, key);
      if (got === undefined) continue;
      return blocked([
        `${key}은(는) 2·3세대 여러 건 계산에 쓰이지 않는 입력입니다.`,
        "다른 세대·다른 진입점의 축이거나, 행(lines) 안에서만 의미가 있는 축입니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(got)}`,
      ]);
    }
    // ── 행 구성이 정하는 두 금액 축 (G-34B) ──────────────────────────
    //   두 카운터와 **같은 방식**이다 — 필요한지는 최상위 필드가 아니라 `lines`의 내용이
    //   정한다. 한 축만 다른 방식으로 두지 않는다.
    //     `priorAnnualPaid`        입원 자기부담 연 200만원 상한의 시작값. 입원 행이 없으면
    //                              읽지 않는다(실측: 입원 행이 있으면 보험금이
    //                              13,000,000 → 14,500,000으로 달라지고, 없으면 무변화).
    //     `perVisitCoverageLimit`  회(건)당 가입금액. 통원 행이 없으면 읽지 않는다
    //                              (실측: 통원 행이 있으면 800,000 → 200,000).
    //   ⚠ 화면은 이미 같은 조건으로 보낸다(`!hasInpatient`·`!hasOutpatient`에서 undefined).
    //     그래서 이 거부가 정상 화면을 막지 않는다.
    const hasInpatient = lines.some((l) => l.visit === "inpatient");
    const strayPaid = hasInpatient ? undefined : readCount(input, "priorAnnualPaid");
    if (strayPaid !== undefined) {
      return blocked([
        "연간 기납부 자기부담금(priorAnnualPaid)은 입원 자기부담 연간 상한(200만원) 계산에만 쓰입니다.",
        "이 묶음에는 입원 행이 없습니다. 쓰이지 않는 입력을 조용히 버리면 상한을 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(strayPaid)}`,
      ]);
    }
    const strayPerVisit = hasOutpatient ? undefined : readCount(input, "perVisitCoverageLimit");
    if (strayPerVisit !== undefined) {
      return blocked([
        "회(건)당 가입금액(perVisitCoverageLimit)은 통원(외래·처방조제) 행의 지급 한도에만 쓰입니다.",
        "이 묶음에는 통원 행이 없습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(strayPerVisit)}`,
      ]);
    }
  }

  // 이어지는 상태
  let inpatientOwnPaySoFar = nonNegInt(input.priorAnnualPaid);
  // ⚠ 두 카운터는 정규화하지 않는다. 위에서 미입력·잘못된 값을 이미 차단했고, 쓰이지 않는
  //   축은 실려 오는 것 자체가 차단된다. 여기서 ?? 0은 "쓰이지 않는 축"의 자리값이다.
  let outpatientVisits = (visitsRaw as number | undefined) ?? 0;
  let prescriptions = (prescriptionsRaw as number | undefined) ?? 0;

  const results: ClaimLineResult[] = [];

  lines.forEach((line, index) => {
    const facility: Facility = line.facility ?? "clinic";

    if (line.visit === "outpatient") {
      // 처방조제와 외래는 각각 별도 횟수 한도를 갖는다.
      const isPrescription = facility === "pharmacy";
      const used = isPrescription ? prescriptions : outpatientVisits;
      const limit = isPrescription ? constants.prescriptionAnnualCount : constants.outpatientAnnualVisits;
      const unit = isPrescription ? "처방전" : "외래 방문";

      if (used >= limit) {
        results.push(notCovered(
          generation, index, line,
          isPrescription ? prescriptionCap : visitCap,
          `계약해당일 기준 1년간 ${unit} ${limit}회(건) 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`,
        ));
        return;
      }
      if (isPrescription) prescriptions += 1; else outpatientVisits += 1;
    }

    const single: CalcResult = calcStandardized(generation, {
      amount: line.amount,
      coverage: "benefit", // 2·3세대는 급여·비급여 합계에 단일 정률이라 요율에 영향이 없다
      visit: line.visit,
      facility: line.visit === "outpatient" ? facility : undefined,
      plan: input.plan,
      priorAnnualPaid: line.visit === "inpatient" ? inpatientOwnPaySoFar : undefined,
      perVisitCoverageLimit: line.visit === "outpatient" ? input.perVisitCoverageLimit : undefined,
    });

    if (line.visit === "inpatient") inpatientOwnPaySoFar += single.ownPay ?? 0;
    results.push({ ...single, index, covered: true });
  });

  const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);
  const totalOwnPay = results.reduce((sum, r) => sum + (r.ownPay ?? 0), 0);
  const totalInsurancePay = results.reduce((sum, r) => sum + (r.insurancePay ?? 0), 0);

  const appliedCaps = [...new Set(results.flatMap((r) => r.appliedCaps))];

  const notes: string[] = [];
  const excluded = results.filter((r) => !r.covered).length;
  if (excluded > 0) {
    notes.push(`${excluded}건이 연간 횟수 한도를 넘겨 보상 대상에서 제외되었습니다.`);
  }
  // ⚠ 종전에는 `results.filter((r) => r.covered).length > 0`으로 판정했다. 이름은
  //   `outpatientCount`였지만 실제로는 **보상된 모든 행**을 세므로 입원도 포함됐고,
  //   입원만 있는 묶음에서도 "하루에 2회 이상 **통원**한 경우" 안내가 나왔다.
  // ⚠ `covered`로 판단해서도 안 된다. 연간 횟수 한도를 넘겨 통원 행이 **전부 보상 제외**돼도
  //   "같은 날 통원은 한 행으로 합쳐 입력하라"는 안내는 여전히 필요하다 — 그 안내는 보상
  //   여부가 아니라 **입력 방법**에 관한 것이다.
  if (hasOutpatient) {
    notes.push("각 행은 약관상 1회의 청구 단위입니다. 하루에 2회 이상 통원한 경우 약관이 1회로 보고 가장 높은 공제금액을 적용하므로, 한 행으로 합쳐 입력해 주세요.");
  }
  // ⚠ 회(건)당 가입금액은 **통원 행에만** 적용된다(아래 행 루프의
  //   `line.visit === "outpatient" ? input.perVisitCoverageLimit : undefined`).
  //   그래서 통원 행이 없으면 이 안내를 붙이지 않는다 — 종전에는 미입력이기만 하면 붙어,
  //   입원만 있는 묶음에서 **화면에 있지도 않은 입력**을 증권에서 확인해 넣으라고 안내했다.
  if (hasOutpatient && input.perVisitCoverageLimit === undefined) {
    notes.push("회(건)당 가입금액은 계약마다 다른 값이라 입력하지 않으면 적용하지 않습니다. 증권에서 확인해 입력하면 보험금 지급 한도로 반영됩니다.");
  }

  return {
    status: "OK", generation, lines: results,
    totalAmount, totalOwnPay, totalInsurancePay, appliedCaps, notes,
  };
}
