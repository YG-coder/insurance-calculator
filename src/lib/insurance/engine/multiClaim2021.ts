// ⚠ `normalizeAmount`를 더 이상 import하지 않는다. 진료비를 조용히 고치던 유일한
//   호출부를 이번에 검증으로 바꿨고, 남겨 두면 "여기서도 값을 고친다"고 읽힌다.
//   `settle()`이 내부에서 여전히 자기 인자를 정규화하며 그 동작은 그대로다.
import { settle } from "../common/settle";
import { GEN2021 } from "./constants";
import { calc2021 } from "./generation2021";
import {
  CalcResult, CapCode, ClaimLineResult, Gen2021MskApprovedThrough, Gen2021MultiClaimInput,
  Gen2021Rider, MultiClaimResult,
} from "./types";

// ⚠ 관용 파서 `nonNegInt()`를 이 파일에서 **삭제했다.** 마지막 사용처였던 연간 보험가입금액이
//   엄격 검증으로 바뀌어, 이제 이 파일의 모든 숫자 축은 검증을 통과한 원값만 쓴다.
//   `undefined`이거나 0 이상의 안전한 정수뿐이므로 정규화할 것이 남아 있지 않다.
//   파서를 남겨 두면 다음에 추가되는 축이 다시 조용히 변형될 자리가 생긴다.
//   ⚠ 2·3세대 `multiClaim.ts`와 5세대 `multiClaim2026.ts`는 각자 자기 사본을 가지며
//     이번 변경 범위가 아니다. 그쪽 동작은 그대로다.

/**
 * 0 이상의 안전한 정수인지만 보는 **형식 검증**(4세대 전용).
 *
 * ⚠ 종전 관용 파서 nonNegInt()의 관용(음수→0, NaN·Infinity→0, 문자열·객체→0, 소수 내림)을
 *   물려받지 않았다(그 파서는 이제 이 파일에 없다).
 *   실제로 nonNegInt()는 문자열 "100"과 Infinity를 **0**으로 만들었다 — "이미 100회 썼다"가
 *   "한 번도 안 썼다"가 되어 한도가 사라지고 보험금이 과다 산출된다.
 *   ⚠ 한도를 넘는 값도 유효한 과거 상태다. 절삭하지 않는다.
 *
 * ⚠ 쓰는 곳: 두 횟수 축(일반 통원 100회·특약 50회)과, G-17에서 **활성 지급보험금 누적 축**
 *   (일반 priorAnnualInsurancePaid / 특약 priorAnnualRiderPaid)이 같은 형식 규칙을 쓴다.
 *   ⚠ 형식 규칙만 공유한다. 한도·근거·CapCode·안내 문구는 축마다 다르며 섞지 않는다.
 *   ⚠ 연간 보험가입금액(annualCoverageLimit)도 같은 형식 규칙을 쓴다. 다만 그 축은
 *     `undefined`와 숫자 `0`을 모두 "한도 미적용"으로 받고, 안내만 서로 다르다.
 */
const badCount = (v: unknown): boolean =>
  !(typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
const readCount = (o: object, key: string): unknown =>
  (o as Record<string, unknown>)[key];

/**
 * <표1> 주)의 승인 회차 후보. 값은 두 규칙에서 파생한다 — 여기에 다시 나열하지 않는다.
 *   최초 10회(mskApproval.initialApproved)부터 연 50회(annualVisits)까지 10회(step) 단위.
 */
export const GEN2021_MSK_APPROVED_THROUGH_VALUES: readonly Gen2021MskApprovedThrough[] =
  Array.from(
    { length: Math.floor(
      (GEN2021.rider.manual_therapy.annualVisits - GEN2021.rider.mskApproval.initialApproved)
      / GEN2021.rider.mskApproval.step) + 1 },
    (_, i) => GEN2021.rider.mskApproval.initialApproved + i * GEN2021.rider.mskApproval.step,
  ) as readonly Gen2021MskApprovedThrough[];

const RIDER_CAPS: Record<Exclude<Gen2021Rider, "none">, {
  annualLimit: number;
  annualVisits: number | null;
  moneyCap: CapCode;
  visitCap?: CapCode;
}> = {
  manual_therapy: {
    ...GEN2021.rider.manual_therapy,
    moneyCap: "GEN2021_MANUAL_THERAPY_ANNUAL",
    visitCap: "GEN2021_MANUAL_THERAPY_ANNUAL_VISITS",
  },
  injection: {
    ...GEN2021.rider.injection,
    moneyCap: "GEN2021_INJECTION_ANNUAL",
    visitCap: "GEN2021_INJECTION_ANNUAL_VISITS",
  },
  mri: { ...GEN2021.rider.mri, moneyCap: "GEN2021_MRI_ANNUAL" },
};

function excluded(index: number, amount: number, cap: CapCode, note: string): ClaimLineResult {
  return {
    status: "OK", generation: "2021", index, covered: false,
    amount, ownPay: amount, insurancePay: 0, rateBased: 0, rateApplied: 0,
    minDeductible: 0, notes: [note], appliedCaps: [cap],
  };
}

/**
 * 4세대 다회 청구. 한 호출은 동일한 보장축에서 발생한 청구 묶음이다.
 * 연간 가입금액은 계약자가 선택한 값이므로 입력된 경우에만 적용한다.
 */
export function calculateMany2021(input: Gen2021MultiClaimInput): MultiClaimResult {
  // ── 진료비: 컨테이너 → 원소 → 합계 ──────────────────────────────────
  //   ⚠ **어떤 검사보다 먼저**다. 종전에는 `(input.amounts ?? []).map(normalizeAmount)`가
  //     첫 줄에서 값을 조용히 고쳐, 잘못된 금액이 **0원 행**이 되어 계산에 들어갔다.
  //     0원 행은 4세대에서 연간 횟수를 1회 소진하고 도수 승인 회차 판정(`amounts.length`)에도
  //     들어가므로, 금액만 틀리는 것이 아니라 **횟수와 승인까지** 틀어졌다. 실측 결과
  //     `["abc", 300000]`은 과거 99회에서 유효한 두 행과 똑같이 2행을 한도 초과로 제외시켰다.
  //     그래서 금액 검사가 횟수·승인 검사보다 앞에 와야 하고, 잘못된 금액이 그 안내로
  //     가려져서도 안 된다.
  //   ⚠ 명시적으로 입력한 숫자 `0` 행의 기존 처리(계산 포함·횟수 소진·승인 회차 산입)는
  //     그대로다. 이번에 바꾸는 것은 **무효값이 0원 행이 되는 경로**뿐이다.
  const rawAmounts = (input as { amounts?: unknown }).amounts;
  /**
   * 신뢰 가능한 총액이 없을 때의 차단.
   *   ⚠ 아래 `blocked()`와 다르다. 진료비 자체가 무효이면 **부분합을 노출하지 않는다** —
   *     `[300000, "abc"]`에서 `totalAmount: 300000`을 돌려주면 "무효 행을 뺀 합계"라는
   *     새 계약이 생긴다. 총액을 만들 수 없으므로 0으로 통일한다.
   */
  const unusable = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation: "2021", lines: [],
    totalAmount: 0, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });
  // ⚠ 안내에 받은 값 자체를 넣지 않고 `typeof`만 넣는다. 무효 입력을 템플릿 리터럴에
  //   그대로 끼우면 Symbol이나 `toString()`이 던지는 객체에서 안내를 만드는 중에 예외가 난다.
  //   ⚠ 이 파일의 **기존** 안내 6곳이 쓰는 `JSON.stringify`는 이번 범위가 아니다.
  if (!Array.isArray(rawAmounts)) {
    return unusable([
      "진료비 목록(amounts)은 배열이어야 합니다. 청구가 없는 묶음은 빈 배열로 넘겨 주세요.",
      "미입력·null을 빈 묶음으로 보지 않습니다 — 넘기지 않은 것과 청구가 없다는 것은 다른 상태입니다.",
      `받은 값의 형식: ${typeof rawAmounts}`,
    ]);
  }
  for (let i = 0; i < rawAmounts.length; i++) {
    const v: unknown = rawAmounts[i];
    if (!(typeof v === "number" && Number.isSafeInteger(v) && v >= 0)) {
      return unusable([
        `${i + 1}번째 진료비는 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다.`,
        "잘못된 값을 0원으로 바꾸지 않습니다 — 0원 행은 연간 횟수를 소진하므로 금액뿐 아니라 횟수와 승인 회차까지 틀어집니다.",
        `${i + 1}번째 받은 값의 형식: ${typeof v}`,
      ]);
    }
  }
  // ⚠ 원소가 모두 안전한 정수여도 **합계**는 범위를 벗어날 수 있다([MAX_SAFE, 1]).
  //   그 뒤의 누적(paid·한도 비교)이 정밀도를 잃으므로 계산하지 않는다.
  const totalInput = rawAmounts.reduce((s: number, x: number) => s + x, 0);
  if (!Number.isSafeInteger(totalInput)) {
    return unusable([
      "진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다. 각 행이 안전한 정수여도 합계는 벗어날 수 있습니다.",
      `받은 행 수: ${rawAmounts.length}`,
    ]);
  }
  // ⚠ `normalizeAmount`를 다시 걸지 않는다. 위 검사를 통과한 값에 대해 그 함수는
  //   항등이며(`Math.max(0, Math.floor(v))`), 다시 걸면 "여기서도 값을 고친다"고 읽힌다.
  const amounts: number[] = rawAmounts;
  const rider = input.rider ?? "none";
  const results: ClaimLineResult[] = [];
  /** 차단 계약 — 후보 보험금·후보 행을 노출하지 않고 진료비 합계만 유지한다. */
  const blocked = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation: "2021", lines: [],
    totalAmount: totalInput, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });

  // ── 이미 사용한 횟수 축 ──────────────────────────────────────────────
  //   어느 축이 쓰이는지는 rider·coverage·visit이 함께 정한다.
  //     일반 비급여 통원 → 연 100회(GEN2021-NONBENEFIT-OUTPATIENT-ANNUAL-VISITS)
  //     도수치료·주사료 → 각 연 50회(GEN2021-MANUAL-THERAPY / INJECTION-ANNUAL-VISITS)
  //     MRI·급여·입원   → 횟수 한도 자체가 없다. 실려 오면 쓰이지 않는 입력이다.
  //   ⚠ 타입이 막는 조합이라도 외부 런타임 데이터는 타입을 우회한다. 여기서도 막는다.
  const visitsRaw = readCount(input, "priorAnnualOutpatientVisits");
  const riderVisitsRaw = readCount(input, "priorAnnualRiderVisits");
  const usesGeneralVisits = rider === "none"
    && input.coverage === "non_benefit" && input.visit === "outpatient";
  const usesRiderVisits = rider === "manual_therapy" || rider === "injection";

  if (!usesGeneralVisits && visitsRaw !== undefined) {
    return blocked([
      "일반 통원 횟수(priorAnnualOutpatientVisits)는 비급여 통원의 연 100회 한도에만 쓰입니다.",
      rider === "none"
        ? "급여 청구와 입원에는 연간 횟수 한도가 없습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다."
        : "3대비급여 특약은 별도 횟수 축(priorAnnualRiderVisits)을 씁니다. 두 축은 한도가 달라 서로 대신 쓰지 않습니다.",
      `받은 값: ${JSON.stringify(visitsRaw)}`,
    ]);
  }
  if (!usesRiderVisits && riderVisitsRaw !== undefined) {
    return blocked([
      "3대비급여 특약 횟수(priorAnnualRiderVisits)는 도수치료·체외충격파·증식치료와 비급여 주사료의 연 50회 한도에만 쓰입니다.",
      rider === "mri"
        ? "비급여 MRI·MRA에는 횟수 한도가 없고 금액 한도만 있습니다. 쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다."
        : "일반 보장은 별도 횟수 축(priorAnnualOutpatientVisits)을 씁니다. 두 축은 한도가 달라 서로 대신 쓰지 않습니다.",
      `받은 값: ${JSON.stringify(riderVisitsRaw)}`,
    ]);
  }
  // ── 보상 승인 회차 축 (도수 계열 전용) ────────────────────────────────
  //   <표1> 주)는 도수치료·체외충격파치료·증식치료 3종만 대상으로 한다.
  //   ⚠ 주사료·MRI·일반 보장에는 승인 구간이 없다. 실려 오면 쓰이지 않는 입력이므로 막는다.
  const approvedRaw = readCount(input, "approvedThroughVisit");
  if (rider !== "manual_therapy" && approvedRaw !== undefined) {
    return blocked([
      "보상 승인 회차(approvedThroughVisit)는 도수치료·체외충격파치료·증식치료의 승인 구간에만 쓰입니다.",
      rider === "injection"
        ? "비급여 주사료에는 약관상 승인 구간이 없고 연간 횟수·금액 한도만 있습니다. 쓰이지 않는 입력을 조용히 버리면 승인을 반영했다고 오해할 수 있어 계산하지 않았습니다."
        : rider === "mri"
          ? "비급여 MRI·MRA에는 약관상 승인 구간이 없고, 연간 횟수 한도도 없습니다. 쓰이지 않는 입력을 조용히 버리면 승인을 반영했다고 오해할 수 있어 계산하지 않았습니다."
          : "일반 급여·비급여 보장에는 약관상 승인 구간이 없습니다. 쓰이지 않는 입력을 조용히 버리면 승인을 반영했다고 오해할 수 있어 계산하지 않았습니다.",
      `받은 값: ${JSON.stringify(approvedRaw)}`,
    ]);
  }
  // ⚠ 미입력은 차단하지 않는다. 다른 축과 달리 "모른다"가 아니라 약관이 조건 없이
  //   보장하는 **최초 기본 보장 구간**을 뜻하기 때문이다(<표1> 주) 인쇄 p.252).
  if (approvedRaw !== undefined
    && !(GEN2021_MSK_APPROVED_THROUGH_VALUES as readonly unknown[]).includes(approvedRaw)) {
    return blocked([
      `보상 승인 회차는 ${GEN2021_MSK_APPROVED_THROUGH_VALUES.join("·")}회 중 하나여야 합니다(<표1> 주) — ${GEN2021.rider.mskApproval.step}회 단위).`,
      `받은 값: ${JSON.stringify(approvedRaw)}`,
    ]);
  }

  // 미입력은 0으로 추정하지 않는다 — 과거 사용량을 모르면 한도를 반영할 수 없다.
  //   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 0은 유효값이다.
  if (usesGeneralVisits) {
    if (visitsRaw === undefined) {
      return blocked([
        `비급여 통원은 계약해당일 기준 1년간 ${GEN2021.nonBenefitOutpatientAnnualVisits}회가 한도입니다.`,
        "이미 사용한 통원 횟수(priorAnnualOutpatientVisits)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 사용한 통원이 없으면 0을 넣어 주세요.",
      ]);
    }
    if (badCount(visitsRaw)) {
      return blocked([
        "이미 사용한 통원 횟수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
        `받은 값: ${JSON.stringify(visitsRaw)}`,
      ]);
    }
  }
  if (usesRiderVisits) {
    const limit = RIDER_CAPS[rider].annualVisits;
    if (riderVisitsRaw === undefined) {
      return blocked([
        `이 특약은 계약해당일 기준 1년간 ${limit}회가 한도입니다.`,
        "이미 사용한 치료 횟수(priorAnnualRiderVisits)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 받은 치료가 없으면 0을 넣어 주세요.",
      ]);
    }
    if (badCount(riderVisitsRaw)) {
      return blocked([
        "이미 사용한 치료 횟수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
        `받은 값: ${JSON.stringify(riderVisitsRaw)}`,
      ]);
    }
  }

  // ── 활성 지급보험금 누적 축: 원문만 읽어 둔다 ────────────────────────
  //   ⚠ 값 검증은 아래 **승인 회차 preflight 뒤**에서 한다. 잘못된 진료비·횟수·승인
  //     회차가 함께 있으면 그 안내가 더 앞선 안내이므로 가려지면 안 된다.
  //   ⚠ **활성 축 하나만** 읽는다. 일반 경로는 priorAnnualInsurancePaid, 특약 경로는
  //     priorAnnualRiderPaid다. 비활성 축에 남아 있는 값은 이번 커밋에서 보지 않는다 —
  //     미사용 금액 축 stray 거부는 후속 항목이고, 그 조용한 폐기 동작은 그대로다.
  const paidKey = rider === "none" ? "priorAnnualInsurancePaid" : "priorAnnualRiderPaid";
  const paidRaw = readCount(input, paidKey);
  // ⚠ 정규화하지 않는다. 위에서 미입력·잘못된 값을 이미 차단했고, 쓰이지 않는 축은
  //   실려 오는 것 자체가 차단된다. 여기서 ?? 0은 "쓰이지 않는 축"의 자리값이다.
  let visits = ((usesGeneralVisits ? visitsRaw : riderVisitsRaw) as number | undefined) ?? 0;
  // ── 연간 보험가입금액 축: 원문만 읽어 둔다 ──────────────────────────
  //   ⚠ 값 검증도 `selectedLimit` 계산도 아래 **지급보험금 축 검증 뒤**에서 한다.
  //     진료비·횟수·승인 회차·지급보험금이 함께 잘못되어 있으면 그 안내가 더 앞선다.
  //   ⚠ **일반 축일 때만 읽는다.** 특약 경로는 이 값을 계산에 쓰지 않는데, 이름에 접근하는
  //     것만으로 외부 객체의 접근자(getter)가 실행된다 — 쓰지 않는 값을 읽다가 부작용이
  //     나거나, getter가 던지면 특약 묶음 전체가 예외로 죽는다. "보지 않는다"는 계약은
  //     검증을 건너뛰는 것이 아니라 **읽지 않는 것**이어야 한다. 활성 축 하나만 읽는
  //     G-17의 규칙과 같다.
  const limitRaw = rider === "none" ? readCount(input, "annualCoverageLimit") : undefined;

  // ── preflight: 도수 계열 보상 승인 회차 ─────────────────────────────────
  //   승인 범위가 부족한 것은 "보상 거절 확정"이 아니라 **확인 불가**다. 행을 제외하지
  //   않고 묶음을 막는다.
  //
  //   ⚠ 승인 검사 대상은 **이번 묶음에서 연 50회 한도 안에 들어가는 행**뿐이다.
  //     한도를 넘긴 행은 이미 연간 한도로 확정 제외되므로 추가 승인이 필요한 상태가
  //     아니다. 대상을 나누지 않으면 과거 49회+2건이나 과거 50회+1건까지 차단돼,
  //     "한도 초과 제외"라는 확정 결과가 "확인 불가"로 뒤바뀐다.
  //
  //   ⚠ 과거 횟수(visits)를 50으로 절삭하지 않는다. 아래 capacity는 이 검사 전용
  //     지역 계산이고, 루프의 카운터는 입력값 그대로를 쓴다.
  //
  //   ⚠ 행 산정은 루프와 **같은 정책**이다 — 진료비 0원 행도 1회로 센다. 승인 검사에서만
  //     양수 행을 세면 같은 청구가 축마다 다른 회차가 되어 두 기준이 어긋난다.
  //     (연 50회 한도의 지급 0원 처리 자체는 이번 범위가 아니며 바꾸지 않는다.)
  if (rider === "manual_therapy") {
    const approved = (approvedRaw as Gen2021MskApprovedThrough | undefined)
      ?? GEN2021.rider.mskApproval.initialApproved;
    const capacity = Math.max(RIDER_CAPS.manual_therapy.annualVisits! - visits, 0);
    const countedThisBatch = Math.min(amounts.length, capacity);
    // 한도 안에 들어가는 행이 없으면(과거분이 이미 한도 이상이거나 청구 행이 없으면)
    //   승인 여부가 결과를 바꾸지 못한다. 새 차단을 만들지 않는다.
    if (countedThisBatch > 0 && visits + countedThisBatch > approved) {
      return blocked([
        `도수치료·체외충격파치료·증식치료는 각 치료횟수를 합산해 최초 ${GEN2021.rider.mskApproval.initialApproved}회를 보장하고, 이후에는 증상의 개선·병변 호전 등이 확인된 경우에 한하여 ${GEN2021.rider.mskApproval.step}회 단위로 연간 ${RIDER_CAPS.manual_therapy.annualVisits}회까지 보상합니다(실손의료보험 특별약관 제3조 (3)3대비급여 제1항 <표1> 주)).`,
        `이번 청구에서 연간 횟수 한도 안에 들어가는 치료는 ${visits + countedThisBatch}회째까지인데, 적용된 보상 승인 회차는 ${approved}회까지입니다.`,
        // ⚠ 미선택을 "승인된 것으로 보았다"고 쓰지 않는다. 바로 뒤에서 "보험사가 승인한
        //   회차가 아니다"라고 말하므로 같은 안내 안에서 서로 부딪힌다. 미선택은 약관이
        //   조건 없이 보장하는 구간을 **적용**한 것이지 승인을 의제한 것이 아니다.
        ...(approvedRaw === undefined
          ? [`승인 회차를 입력하지 않아 최초 ${GEN2021.rider.mskApproval.initialApproved}회 기본 보장 구간까지만 적용했습니다.`]
          : []),
        // ⚠ 판정 한계는 미선택·명시 선택 **양쪽**에 붙는다. 한쪽에만 붙이면 계산기가
        //   증상 개선을 판정했다고 오해할 여지가 그 경로에만 남는다.
        "계산기는 증상의 개선·병변 호전 여부를 판정하지 않습니다.",
        "보험사에서 확인된 승인 회차를 입력하시거나, 승인된 범위의 치료만 입력해 주세요.",
      ]);
    }
  }

  // ── 활성 지급보험금 누적 축의 값 검증 ───────────────────────────────
  //   종전 동작은 값에 따라 **방향이 갈렸다.**
  //     - 문자열·음수·NaN·±Infinity·null·불리언·객체·배열·bigint·순환 참조는
  //       nonNegInt()가 **조용히 0**으로 만들어 남은 한도가 되살아났다 → 보험금 과다 산출
  //       (실측: 가입금액 500,000·기존 지급 400,000에서 정답 ins=100,000이어야 할 계산이
  //        무효값 12종에서 모두 ins=200,000이 됐다).
  //     - 안전 정수 범위를 넘는 값(MAX_SAFE+1 등)은 **그대로 통과**해 한도를 다 소진했다
  //       → 보험금 과소 산출(같은 격자에서 ins=0).
  //   ⚠ 그래서 두 사례를 하나의 방향으로 설명하지 않는다. 안내는 방향을 단정하지 않고
  //     "값을 임의로 고치지 않는다"만 말하며, 두 사례가 **같은 문구**로 차단된다.
  //
  //   ⚠ `undefined`와 명시적 숫자 `0`은 종전대로 허용한다 — 둘 다 "누적 0에서 시작"이다.
  //   ⚠ 약관 한도를 넘는 과거 지급액도 **유효한 상태**다. 절삭하지 않는다.
  //   ⚠ 연간 가입금액이 없어 이 값이 결과를 바꾸지 못하는 경우에도 검증한다.
  //     "현재 산식에 영향이 없다"와 "올바른 입력이다"는 다른 말이고, 뒤에 가입금액이
  //     입력되면 같은 값이 곧바로 금액을 바꾼다.
  //   ⚠ 반환은 이 파일의 기존 `blocked()`다 — 진료비 합계(`totalAmount`)를 보존한다.
  //     진료비가 이미 검증을 통과했으므로 신뢰할 수 있는 총액이 있다. G-16의
  //     `unusable()`(총액 0)은 쓰지 않는다.
  //   ⚠ 형식 규칙은 횟수 축과 같은 `badCount`를 쓴다. 안내 문구·근거는 축마다 다르다.
  //   ⚠ `nonNegInt()`는 연간 보험가입금액까지 검증으로 바뀌면서 사용처가 사라져 삭제됐다.
  if (paidRaw !== undefined && badCount(paidRaw)) {
    return blocked([
      rider === "none"
        ? "기존 지급보험금(priorAnnualInsurancePaid)은 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다."
        : "이 특약의 기존 지급보험금(priorAnnualRiderPaid)은 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다.",
      // ⚠ 방향을 단정하지 않는다. 종전 동작은 값에 따라 **반대로** 갈렸다 —
      //   문자열·음수·NaN 등은 0이 되어 한도가 되살아났고(보험금이 많아짐),
      //   안전 정수 범위를 넘는 값은 그대로 통과해 한도를 다 소진했다(보험금이 적어짐).
      //   한쪽 방향으로만 단정하는 문구를 쓰면 두 번째 사례에서 사용자를 오도한다.
      "계산기가 잘못된 값을 임의로 고치지 않습니다 — 값을 고치면 남은 한도가 실제와 달라져 보험금이 잘못 계산됩니다. 지급받은 적이 없으면 0을 넣어 주세요.",
      // ⚠ 받은 값을 그대로 문자열로 만들지 않는다. Symbol이나 toString()이 던지는 객체에서
      //   안내를 만드는 중에 예외가 난다. 이 파일 기존 안내 6곳의 JSON.stringify는 범위 밖이다.
      `받은 값의 형식: ${typeof paidRaw}`,
    ]);
  }
  // ── 연간 보험가입금액의 값 검증 ─────────────────────────────────────
  //   종전 동작은 **이 축 안에서 값에 따라 방향이 갈렸다.** (지급보험금 축도 값에 따라 양쪽으로
  //   갈렸다 — 두 축이 서로 반대라는 뜻이 아니다. 축끼리 방향을 대응시키지 않는다.)
  //     - 문자열·음수·`NaN`·`±Infinity`·`null`·불리언·객체·배열은 nonNegInt()가 조용히 0으로
  //       만들었고, 0은 이 축에서 "미입력"으로 읽혀 **한도가 통째로 사라졌다** → 과다 산출.
  //       그러면서 안내는 "증권의 금액을 입력하지 않아"라고 말했다 — 값을 넘겼는데도.
  //     - 소수는 조용히 내려갔다(`500000.9` → 500,000). 한도가 실제보다 작아진다 → 과소 산출.
  //     - 안전 정수 범위를 넘는 값은 5천만원 상한으로 잘려 통과했다.
  //   ⚠ 그래서 안내는 한 방향으로 단정하지 않는다. "값을 임의로 고치지 않는다"만 말한다.
  //
  //   ⚠ **허용**: `undefined`(미입력)와 숫자 `0`. 둘 다 종전과 같이 한도를 적용하지 않는다.
  //     이 커밋은 두 값의 계산 결과를 바꾸지 않고 **안내만 분리**한다.
  //   ⚠ 0을 미적용으로 보는 것은 **이 계산기의 정책**이지 약관 해석이 아니다. 표준약관에서
  //     직접 읽어 확인한 것은 가입금액의 최대치(5천만원)뿐이고, 0원이 실제로 선택 가능한
  //     계약값인지는 원문에서 확인하지 않았다. 그래서 0을 무효로 차단하지도, 한도 0원으로
  //     적용하지도 않고 종전 계산을 유지한 채 "계산기가 이렇게 다뤘다"고만 알린다.
  //     (0을 한도로 그대로 적용하면 보험금이 0원이 되어, 확인하지 않은 전제로 지급액을
  //      0으로 만드는 셈이 된다.)
  //   ⚠ 5천만원을 넘는 안전 정수는 **거부하지 않는다.** 상한 절삭은 약관 근거가 있는
  //     정당한 계산이고 종전 안내도 그대로다.
  //   ⚠ **일반 축에서만** 검증한다. 특약 경로는 이 값을 계산에 쓰지 않으며, 쓰이지 않는 축의
  //     stray 값 거부는 후속 항목이다 — 그 조용한 폐기 동작은 이번에 바꾸지 않는다.
  //   ⚠ 반환은 기존 `blocked()`다 — 진료비 합계(`totalAmount`)를 보존한다.
  if (limitRaw !== undefined && badCount(limitRaw)) {
    return blocked([
      "연간 보험가입금액(annualCoverageLimit)은 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다.",
      "계산기가 잘못된 값을 임의로 고치지 않습니다 — 가입금액을 고치면 연간 지급 한도가 증권과 달라져 보험금이 잘못 계산됩니다. 증권에 적힌 연간 보험가입금액을 입력해 주세요.",
      // ⚠ 받은 값을 그대로 문자열로 만들지 않는다. Symbol이나 toString()이 던지는 객체에서
      //   안내를 만드는 중에 예외가 난다.
      `받은 값의 형식: ${typeof limitRaw}`,
    ]);
  }

  // 여기 오는 두 값은 `undefined`이거나 0 이상의 안전한 정수다. 정규화하지 않고 그대로 쓴다.
  let paid = (paidRaw as number | undefined) ?? 0;
  // ⚠ 특약 경로에서는 위에서 읽지 않았으므로 언제나 `undefined`다(계산에도 쓰이지 않는다).
  const limit = limitRaw as number | undefined;
  const selectedLimit = limit === undefined || limit === 0
    ? undefined
    : Math.min(limit, GEN2021.annualLimitMaximum);

  amounts.forEach((amount, index) => {
    if (rider === "none" && input.coverage === "non_benefit" && input.visit === "outpatient") {
      if (visits >= GEN2021.nonBenefitOutpatientAnnualVisits) {
        results.push(excluded(index, amount, "GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS",
          `계약해당일 기준 1년간 비급여 통원 ${GEN2021.nonBenefitOutpatientAnnualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`));
        return;
      }
      visits += 1;
    }

    let single: CalcResult;
    if (rider === "none") {
      single = calc2021({
        amount, coverage: input.coverage, visit: input.visit, tier: input.tier,
      });
    } else {
      const rc = RIDER_CAPS[rider];
      if (rc.annualVisits !== null && visits >= rc.annualVisits) {
        results.push(excluded(index, amount, rc.visitCap!,
          `계약해당일 기준 1년간 ${rc.annualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`));
        return;
      }
      if (rc.annualVisits !== null) visits += 1;
      const remaining = Math.max(rc.annualLimit - paid, 0);
      const s = settle(amount, Math.max(amount * GEN2021.rider.deductRate, GEN2021.rider.minDeductible), remaining);
      single = {
        status: "OK", generation: "2021", amount: s.amount,
        ownPay: s.ownPay, insurancePay: s.insurancePay,
        rateBased: Math.round(amount * GEN2021.rider.deductRate),
        rateApplied: GEN2021.rider.deductRate,
        minDeductible: GEN2021.rider.minDeductible,
        notes: [], appliedCaps: s.capped ? [rc.moneyCap] : [],
      };
    }

    // 일반 급여/비급여는 상해·질병 및 급여·비급여 보장축 안에서 입원·통원이 합산된다.
    if (rider === "none" && selectedLimit !== undefined) {
      const remaining = Math.max(selectedLimit - paid, 0);
      const insuranceBefore = single.insurancePay ?? 0;
      if (insuranceBefore > remaining) {
        single = {
          ...single,
          ownPay: amount - remaining,
          insurancePay: remaining,
          appliedCaps: [...single.appliedCaps, "GEN2021_ANNUAL_COVERAGE"],
        };
      }
    }

    paid += single.insurancePay ?? 0;
    results.push({ ...single, index, covered: true });
  });

  const totalAmount = results.reduce((s, r) => s + r.amount, 0);
  const totalOwnPay = results.reduce((s, r) => s + (r.ownPay ?? 0), 0);
  const totalInsurancePay = results.reduce((s, r) => s + (r.insurancePay ?? 0), 0);
  const notes: string[] = [];
  const causeLabel = input.cause === "injury" ? "상해" : "질병";
  if (rider === "none") {
    notes.push(`${causeLabel}·${input.coverage === "benefit" ? "급여" : "비급여"} 보장축만 계산했습니다. 다른 원인의 청구는 별도로 계산해 주세요.`);
  }
  // ⚠ 미입력과 명시적 0원을 **나눠서** 안내한다. 종전에는 0원을 넘겨도 "입력하지 않아"라고
  //   말해, 사용자가 넣은 값이 무시된 사실을 알 수 없었다.
  if (rider === "none" && limit === undefined) {
    notes.push("연간 보험가입금액은 계약자가 선택한 값입니다. 증권의 금액을 입력하지 않아 연간 지급 한도는 적용하지 않았습니다.");
  }
  // ⚠ 이 문장은 **계산기가 0원을 어떻게 다뤘는지**만 말한다. 0원 가입이 가능한 계약인지,
  //   0원의 약관상 의미가 무엇인지는 원문에서 확인하지 않았고 여기서 단정하지 않는다.
  if (rider === "none" && limit === 0) {
    notes.push("연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.");
  }
  if (rider === "none" && limit !== undefined && limit > GEN2021.annualLimitMaximum) {
    notes.push("입력한 연간 가입금액이 약관상 최대 5천만원을 넘어 5천만원으로 적용했습니다.");
  }
  const excludedCount = results.filter((r) => !r.covered).length;
  if (excludedCount) notes.push(`${excludedCount}건이 연간 횟수 한도를 넘어 보상 대상에서 제외되었습니다.`);
  // 승인 구간을 반영했다는 사실 자체를 고지한다. 종전에는 특약 경로가 안내를 하나도
  //   내보내지 않아, 11회째 이후 금액이 승인 없이도 확정된 것처럼 보였다.
  if (rider === "manual_therapy") {
    notes.push(`도수치료·체외충격파치료·증식치료는 각 치료횟수를 합산해 최초 ${GEN2021.rider.mskApproval.initialApproved}회를 보장하고, 이후에는 증상의 개선·병변 호전 등이 확인된 경우에 한하여 ${GEN2021.rider.mskApproval.step}회 단위로 보상합니다(<표1> 주)). 계산기는 증상 개선 여부를 판정하지 않고, 적용된 승인 회차 범위 안에서만 계산합니다.`);
    if (approvedRaw === undefined) {
      notes.push(`보상 승인 회차를 입력하지 않아 약관이 조건 없이 보장하는 최초 ${GEN2021.rider.mskApproval.initialApproved}회까지를 적용했습니다. 이는 보험사가 승인한 회차가 아니라 기본 보장 구간이며, 면책사항 등 다른 보장 조건까지 충족한다는 뜻은 아닙니다.`);
    }
  }

  return {
    status: "OK", generation: "2021", lines: results,
    totalAmount, totalOwnPay, totalInsurancePay,
    appliedCaps: [...new Set(results.flatMap((r) => r.appliedCaps))], notes,
  };
}
