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
      `받은 값: ${JSON.stringify(visitsRaw)}`,
    ]);
  }
  if (!usesPrescriptions && prescriptionsRaw !== undefined) {
    return blocked([
      `처방전 건수(priorAnnualPrescriptions)는 약국 처방조제의 연 ${constants.prescriptionAnnualCount}건 한도에만 쓰입니다.`,
      usesVisits
        ? "이 묶음에는 약국 처방조제 행이 없습니다. 외래 방문 횟수(priorAnnualOutpatientVisits)로 넘겨 주세요. 두 축은 단위가 회와 건으로 달라 서로 대신 쓰지 않습니다."
        : "이 묶음에는 통원 행이 없습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
      `받은 값: ${JSON.stringify(prescriptionsRaw)}`,
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
        `받은 값: ${JSON.stringify(visitsRaw)}`,
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
        `받은 값: ${JSON.stringify(prescriptionsRaw)}`,
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
  const outpatientCount = results.filter((r) => r.covered).length;
  if (outpatientCount > 0) {
    notes.push("각 행은 약관상 1회의 청구 단위입니다. 하루에 2회 이상 통원한 경우 약관이 1회로 보고 가장 높은 공제금액을 적용하므로, 한 행으로 합쳐 입력해 주세요.");
  }
  if (input.perVisitCoverageLimit === undefined) {
    notes.push("회(건)당 가입금액은 계약마다 다른 값이라 입력하지 않으면 적용하지 않습니다. 증권에서 확인해 입력하면 보험금 지급 한도로 반영됩니다.");
  }

  return {
    status: "OK", generation, lines: results,
    totalAmount, totalOwnPay, totalInsurancePay, appliedCaps, notes,
  };
}
