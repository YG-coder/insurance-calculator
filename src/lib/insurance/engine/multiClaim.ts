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

  // 이어지는 상태
  let inpatientOwnPaySoFar = nonNegInt(input.priorAnnualPaid);
  let outpatientVisits = nonNegInt(input.priorAnnualOutpatientVisits);
  let prescriptions = nonNegInt(input.priorAnnualPrescriptions);

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
