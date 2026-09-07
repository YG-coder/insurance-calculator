// ⚠ `normalizeAmount`를 더 이상 import하지 않는다(G-27). 진료비를 조용히 고치던 유일한
//   자리(`(input.amounts ?? []).map(normalizeAmount)`)가 엄격 검증으로 바뀌어 사용처가
//   사라졌다. 남겨 두면 다음에 추가되는 금액 축이 다시 조용히 변형될 자리가 생긴다.
//   ⚠ 함수 자체는 한 글자도 바꾸지 않았다. 다른 엔진(`multiClaim.ts`·`generation*.ts`)이
//     각자의 계약으로 쓰고 있고 이번 범위가 아니다. 4세대 `multiClaim2021.ts`도 G-16에서
//     같은 이유로 import를 지웠다.
import { GEN2026 } from "./constants";
import { calc2026 } from "./generation2026";
import { CapCode, ClaimLineResult, Gen2026MultiClaimInput, Gen2026NonBenefitItem, MultiClaimResult, Severity } from "./types";

/**
 * ⚠ 관용 정규화 `nonNegInt()`를 이 파일에서 **삭제했다(G-30).** 마지막 사용처였던
 *   `priorAnnualDeductible`이 C군에서 검증한 값을 그대로 쓰게 되면서(단일 읽기) 이 함수를
 *   지날 값이 남지 않았다. 종전에는 `Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0`이라
 *   두 번째 읽기의 음수·소수·문자열·객체를 조용히 0으로 세탁했다.
 *   ⚠ 남겨 두면 다음에 추가되는 축이 다시 그 관용을 타고 검증을 우회한다 —
 *     G-26이 공용 `isNum()`을, G-29가 `specialItem2026`의 같은 함수를 폐기한 이유와 같다.
 *   ⚠ 2·3세대 `multiClaim.ts`는 자기 사본을 가지며 이번 변경 범위가 아니다.
 */


/**
 * 통원 카운터 검증. **회와 일이 같은 형식 규칙을 쓴다** — 둘 다 0 이상의 안전 정수다.
 *
 * ⚠ 기존 필드들이 쓰는 nonNegInt()의 관용(음수→0, NaN·Infinity→0, 소수→내림)을 물려받지
 *   않는다. 잘못된 값을 조용히 0으로 만들면 한도가 통째로 사라져 보험금이 과다 산출된다.
 *   실제로 nonNegInt()는 문자열 "99"와 Infinity를 **0**으로 만들었다 — "이미 100회 썼다"가
 *   "한 번도 안 썼다"가 되는 방향이라 가장 위험한 변형이다.
 *   ⚠ 100을 넘는 값도 유효한 과거 상태다. 절삭하지 않는다.
 *
 * ⚠ 형식 규칙만 공유한다. 단위(회 ≠ 일)·근거 조문·안내 문구·카운터는 계속 분리한다.
 *   (nonNegInt() 자체는 2·3·4세대와 다른 필드가 계속 쓰므로 그대로 둔다.)
 */
const badCount = (v: unknown): boolean =>
  !(typeof v === "number" && Number.isSafeInteger(v) && v >= 0);

/**
 * 진료비 원소의 형식 검증 — 0 이상의 안전한 정수.
 *
 * ⚠ `itemGuards.isClaimAmount`와 **본문이 한 글자도 다르지 않다.** 그런데도 import하지 않고
 *   이 파일에 두는 이유는 **모듈 경계 계약**이 먼저이기 때문이다 — `itemGuards`는 항목별
 *   진입점(`specialItem2026`·`roomCharge2026`)의 leaf 가드이고, 그 파일이 함께 내보내는
 *   `rejected()`·`showValue()`는 이 엔진의 반환 계약(`blocked()` — 진료비 합계 보존)과
 *   **다른 계약**이다. 이 파일이 `itemGuards`를 import하지 않는다는 계약은 G-14D부터
 *   검사로 고정돼 있고(tests/gen2026RejectedSafeDisplay), 술어 하나를 아끼려고 그 경계를
 *   허물면 다음에 `rejected()`가 딸려 들어올 자리가 생긴다.
 *   ⚠ 대신 두 정의가 **조용히 갈라지지 못하도록** 회귀검사가 두 파일의 본문을 서로 대조한다.
 * ⚠ `badCount`(통원 카운터)와 술어가 같아 보여도 축이 다르다. 단위·안내·근거 조문이 모두
 *   다르므로 서로 대신 쓰지 않는다(G-22가 세운 판단 그대로다).
 * ⚠ 숫자 `0`은 **유효한 진료비 행**이다. 거부하지 않는다.
 */
const isClaimAmount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const readCount = (o: object | undefined, key: string): unknown =>
  (o as Record<string, unknown> | undefined)?.[key];

/**
 * 별도 보장종목·상급병실료 전용 축. 이 묶음 엔진은 일반 (1)(2)와 급여만 계산하므로
 * 아래 키는 **어느 경로에서도 소비되지 않는다.**
 *   ⚠ `roomCharge2026`의 `UNUSED_KEYS`와 목적이 같지만 **목록을 공유하지 않는다** —
 *     그쪽은 상급병실료가 쓰지 않는 축(통원 카운터·priorAnnualDeductible 포함)이고,
 *     이쪽은 이 묶음이 쓰지 않는 축이다. 합치면 한쪽 변경이 다른 쪽을 조용히 바꾼다.
 *   ⚠ `priorAnnualDeductible`은 여기 넣지 않는다. 이 묶음이 **실제로 소비하는** 축이라
 *     아래에서 경로·값을 따로 검증한다.
 */
/**
 * 급여 묶음에서 쓰이지 않는 금액 축 (G-30).
 *   세 축 모두 비급여 특별약관 제5조①의 축이라 급여에는 대응 축이 없다.
 *   ⚠ 순서가 안내 우선순위다. 여러 키가 동시에 실려도 먼저 찾은 키 하나만 안내한다.
 *   ⚠ `priorAnnualDeductible`은 여기 넣지 않는다 — C군이 급여 전용 안내를 이미 갖고 있다.
 */
const BENEFIT_UNUSED_MONEY_KEYS = [
  "priorAnnualInsurancePaid", "annualCoverageLimit", "outpatientCoverageLimit",
] as const;

/**
 * 급여 묶음에서 쓰이지 않는 **비금액** 축 (G-31).
 *
 * `severity`(중증/비중증)와 `nonBenefitItem`(비급여 치료유형)은 둘 다 **비급여 특별약관**이
 * 만든 구분이다 — 특별약관1(중증)·2(비중증)가 비급여를 중증도로 나누고, 각 특약 제3조가
 * 비급여를 보장종목으로 다시 나눈다. 급여에는 두 구분이 없다.
 *   ⚠ 종전에는 급여 두 경로에서 **조용히 폐기**됐다(실측: 두 축 모두 접근자 호출 0회).
 *   ⚠ `SPECIAL_ITEM_ONLY_KEYS`에 넣지 않는다 — 그 목록은 **어느 경로에서도** 쓰이지 않는
 *     키이고, 이 둘은 비급여 묶음에서 **실제로 소비된다.** 합치면 정상 비급여가 막힌다.
 *   ⚠ 금액 축 목록과도 합치지 않는다. 거부 사유가 다르고, 한쪽을 고치면 다른 쪽 안내가
 *     조용히 따라 바뀐다.
 */
const BENEFIT_UNUSED_NON_MONEY_KEYS = ["severity", "nonBenefitItem"] as const;

const SPECIAL_ITEM_ONLY_KEYS = [
  "priorAnnualInpatientDeductible", "priorAnnualCoveredCount", "priorAnnualTreatmentActCount",
  "approvedThroughVisit", "injectionPurpose", "item", "lines", "route", "stays",
] as const;

/**
 * 이 묶음 진입점의 **어느 경로에서도** 쓰이지 않는 축 11종 (G-34B).
 *
 * 전수 스윕(기준선 `0914d7d`, 6경로군 × 35축, 금액 배율 3벌 × 값 격자, 접근자 계수)에서
 * 정상 리터럴이 **조용히 통과**했다 — 접근자 호출 0회이고 결과가 미제공과 한 글자도 다르지
 * 않았다.
 *   `amount`                      단건 진입점의 축이다. 이 진입점은 `amounts[]`로 받는다.
 *   `roomChargeTotal`·`inpatientDays`  `stays[]`의 **원소** 필드다(상급병실료 진입점).
 *   `generation`                  결과 필드이지 입력 축이 아니다.
 *   `facility`·`plan`             2·3세대 표준약관의 축이다.
 *   `rider`·`priorAnnualRiderPaid`·`priorAnnualRiderVisits`  4세대 3대비급여 특약의 축이다.
 *   `perVisitCoverageLimit`       2·3세대 통원의 회(건)당 가입금액이다.
 *   `priorAnnualPrescriptions`    2·3세대 다회의 처방조제 건수 카운터다.
 * ⚠ `SPECIAL_ITEM_ONLY_KEYS`와 합치지 않는다 — 그쪽은 "별도 보장종목으로 계산하세요"라는
 *   다른 안내를 낸다. 목록을 합치면 안내가 갈린다.
 * ⚠ `priorAnnualPaid`는 여기 넣지 않는다. 아래 A군이 이미 자기 안내로 막고 있다.
 */
const MULTI2026_UNUSED_KEYS = [
  "amount", "roomChargeTotal", "inpatientDays", "generation",
  "facility", "plan", "rider", "perVisitCoverageLimit",
  "priorAnnualRiderPaid", "priorAnnualPrescriptions", "priorAnnualRiderVisits",
] as const;

/**
 * 안내에 "받은 값"을 실을 때 쓰는 **안전 표시**.
 *
 * ⚠ `JSON.stringify`는 값에 따라 **예외를 던진다** — `bigint`는 "Do not know how to
 *   serialize a BigInt", 순환 참조 객체는 "Converting circular structure to JSON"이다.
 *   이 파일의 검증은 **타입을 우회한 외부 입력**을 막는 것이 목적이므로, 잘못된 입력이
 *   차단 결과가 아니라 런타임 예외로 끝나면 목적 자체가 무너진다.
 * ⚠ 표시 실패가 검증 실패가 되어서는 안 된다. 실패하면 문자열로 낮춰 보여 주고,
 *   그것마저 실패하면 고정 문구로 대체한다. 반환 계약(blocked)과 안내의 의미는 그대로다.
 * ⚠ `undefined`는 `JSON.stringify`가 `undefined`를 돌려주므로 문자열로 만들어 준다.
 */
const showValue = (v: unknown): string => {
  try {
    const json = JSON.stringify(v);
    if (json !== undefined) return json;
  } catch { /* bigint·순환 참조 등 — 아래로 낮춘다 */ }
  try {
    return String(v);
  } catch { /* Symbol·toString이 던지는 객체 등 */ }
  return "(표시할 수 없는 값)";
};

/**
 * 두 해석의 결과가 실제로 같은지 비교하는 지문.
 *   status·합계·행별 보상 여부·금액·공제·CapCode·최상위 CapCode를 모두 넣는다.
 *   notes는 카운터와 무관하게 만들어지므로 제외한다(넣어도 항상 같다).
 */
function fingerprint(r: MultiClaimResult): string {
  return JSON.stringify([
    r.status, r.totalAmount, r.totalOwnPay, r.totalInsurancePay,
    [...r.appliedCaps].sort(),
    r.lines.map((l) => [
      l.index, l.covered, l.status, l.amount, l.ownPay, l.insurancePay,
      l.rateBased, l.rateApplied, l.minDeductible, l.deductibleApplied,
      [...l.appliedCaps].sort(),
    ]),
  ]);
}

/**
 * 지급 보험금이 0원인 통원일이 연 100일을 소진하는지는 원문에 판단 문언이 없다
 * (GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY = HOLD).
 */
const ZERO_PAY_DAYS_HOLD_NOTES = [
  "지급 보험금이 0원인 통원일이 비중증 통원 연 100일 한도의 일수를 소진하는지는 표준약관에 정해져 있지 않습니다.",
  "이 계산에는 그런 날이 있어 이후 청구의 보상 여부가 달라지므로 계산을 중단했습니다.",
  "가입하신 보험사에 확인해 주세요.",
];

/**
 * 중증도 같다. 표는 '통원 100회'(특약1 제3조 (1)①·(2)① 인쇄 p.258·261)라 **통원 자체**를 센다.
 * 지급 0원 통원의 처리는 직접 읽은 범위에서 판단 문언을 찾지 못해 보류돼 있다
 * (GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY = HOLD).
 *   ⚠ 제5조④(p.280)의 '보상한 횟수'를 반대 해석의 근거로 들지 않는다 —
 *     계속 중인 입원·통원의 이월 한도 전용 조항이다.
 *   ⚠ 비중증(일)과 별개 규칙이다. 안내 문구도 단위를 섞지 않는다.
 */
const ZERO_PAY_VISITS_HOLD_NOTES = [
  "지급 보험금이 0원인 통원이 중증 통원 연 100회 한도의 횟수를 소진하는지는 표준약관에 정해져 있지 않습니다.",
  "이 계산에는 그런 통원이 있어 이후 청구의 보상 여부가 달라지므로 계산을 중단했습니다.",
  "가입하신 보험사에 확인해 주세요.",
];

/**
 * 같은 날 통원의 취급은 약관에 명시되어 있다.
 *   중증  — 특별약관1 제3조⑥⑦: 하루 2회 이상 통원(외래·처방조제 합산)은 1회의 통원으로 본다.
 *   비중증 — 특별약관2 제3조: 보상 단위 자체가 "통원 1일당(외래 및 처방·조제비 합산)"이다.
 * 두 경우 모두 같은 날은 합산해 한 행으로 입력하는 것이 약관대로다.
 */
/**
 * @param limitState 연간 보험가입금액의 상태.
 *   "applied" = 한도로 적용됨 / "unset" = 미입력 / "zero" = 명시적 0원.
 *   ⚠ "unset"과 "zero"는 **계산이 같고 안내만 다르다.** 종전에는 둘을 구분하지 않아
 *     0원을 넣은 사용자에게도 "입력하지 않으면 적용하지 않습니다"라고 말했다.
 */
function buildNotes(
  input: Gen2026MultiClaimInput,
  limitState: "applied" | "unset" | "zero",
  outpatientLimitState: "applied" | "unset" | "zero" | "other",
  // ⚠ 호출부가 **한 번 읽고 검증한** 중증도를 넘긴다(G-32). 종전에는 이 함수가
  //   `input.severity`를 두 번 더 읽어, 값이 달라지는 접근자에서 계산에 쓴 중증도와
  //   안내에 실리는 중증도가 갈릴 수 있었다. 급여 묶음에서는 `undefined`다.
  severity: Severity | undefined,
): string[] {
  const causeLabel = input.cause === "injury" ? "상해" : "질병";
  const coverageLabel = input.coverage === "benefit" ? "급여" : "비급여";
  const notes = [
    `각 행을 발생 순서대로 계산했습니다. ${causeLabel}·${coverageLabel} 보장축만 계산했으며, 입력한 모든 행과 기존 지급보험금·자기부담금이 이 축의 것이어야 합니다. 다른 원인의 청구는 별도로 계산해 주세요.`,
  ];
  if (input.coverage === "benefit") return notes;
  // 여기부터는 일반 비급여(nonBenefitItem === "general")만 도달한다.
  //   3대비급여·MRI·상급병실료는 계산 전에 PENDING_UNVERIFIED로 차단된다.
  notes.push(
    "이 계산은 일반 비급여((1)상해비급여·(2)질병비급여)만 다룹니다. 근골격계 이학요법·체외충격파, 비급여 주사료, 비급여 MRI, 상급병실료 차액은 약관상 별도 보장종목이라 이 결과에 포함되지 않습니다.",
  );
  // 아래 두 안내는 비급여 통원에만 해당한다. 급여 통원에 붙이면 사실과 다르다.
  const isNonBenefitOutpatient = input.visit === "outpatient";
  if (isNonBenefitOutpatient) {
    notes.push(
      severity === "critical"
        // ⚠ 약관 조건을 그대로 옮긴다. 무조건 "같은 날이면 합치라"가 아니다.
        //    제3조⑥은 동일 의료기관의 외래+처방, ⑦은 "같은 치료를 목적으로" 한 다회 통원이다.
        ? "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 한 행으로 합쳐 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 행을 나눠 입력합니다."
        : "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 청구는 한 행으로 합쳐 입력해 주세요.",
    );
    // ⚠ 여기서 `input`을 다시 읽지 않는다. 호출부가 **한 번 읽은** 원값의 판정을 넘긴다.
    if (outpatientLimitState === "unset") {
      notes.push("통원 가입금액은 계약마다 다른 값이라 입력하지 않으면 적용하지 않습니다. 증권에서 확인해 입력하면 지급 한도로 반영됩니다.");
    }
    // ⚠ 명시적 `0`은 미입력과 **다른 상태**다. 계산 결과는 종전 그대로 미적용이지만, 값을
    //   넘겼는데 "입력하지 않으면"이라고 말하면 사실과 다르다. 단위는 세대가 아니라
    //   **보장종목**이 정한다 — 중증은 특별약관1의 통원 1회당, 비중증은 특별약관2의
    //   통원 1일당(외래 및 처방·조제비 합산)이다.
    // ⚠ 이 문장은 **계산기가 0원을 어떻게 다뤘는지**만 말한다. 0원 가입이 유효한 계약인지,
    //   무효인지, 실제 한도가 0원인지는 원문에서 확인하지 않았고 여기서 단정하지 않는다.
    if (outpatientLimitState === "zero") {
      notes.push(`통원 가입금액을 0원으로 입력하셔서 계산기에서는 통원 ${severity === "critical" ? "1회당" : "1일당"} 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.`);
    }
  }
  if (limitState === "unset") {
    notes.push(`연간 보험가입금액도 계약자가 선택한 값이라 입력하지 않으면 적용하지 않습니다. 약관상 상해비급여·질병비급여 각각에 대해 따로 정해지므로, ${causeLabel}비급여 축의 가입금액을 입력해 주세요.`);
  }
  // ⚠ 이 문장은 **계산기가 0원을 어떻게 다뤘는지**만 말한다. 0원 가입이 유효한 계약인지,
  //   무효인지, 실제 한도가 0원인지는 원문에서 확인하지 않았고 여기서 단정하지 않는다.
  if (limitState === "zero") {
    notes.push("연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.");
  }
  return notes;
}

export function calculateMany2026(input: Gen2026MultiClaimInput): MultiClaimResult {
  /**
   * 신뢰할 수 있는 총액이 **없을 때**의 차단 (G-27).
   *   ⚠ 아래 `blocked()`와 다르다. `blocked()`는 진료비가 이미 검증된 뒤 횟수·일수·치료유형
   *     같은 **다른 이유**로 계산을 막는 자리이고 진료비 합계를 보존한다. 진료비 자체가
   *     무효이면 그 합계를 만들 수 없다 — `[300000, "abc"]`에서 `totalAmount: 300000`을
   *     돌려주면 "무효 행을 뺀 합계"라는 새 계약이 생긴다. 총액을 0으로 통일한다.
   *   ⚠ 4세대 G-16의 `unusable()`과 같은 형태다. 반환 객체의 모양은 공개 타입
   *     `MultiClaimResult` 그대로이고 상태도 기존 `PENDING_UNVERIFIED`다.
   */
  const unusable = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
    totalAmount: 0, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });

  // ── 진료비: 컨테이너 → 원소 → 합계 (G-27) ──────────────────────────
  //   ⚠ **어떤 검사보다 먼저**다. 종전에는 첫 줄의 `(input.amounts ?? []).map(normalizeAmount)`가
  //     값을 조용히 고쳐, 잘못된 금액이 **0원 행**이 되어 계산에 들어갔다(엔진 직접 호출로
  //     실측: 음수·소수·NaN·±Infinity·문자열·불리언·객체·배열·bigint·Symbol·함수·순환 참조·
  //     `null`·`undefined`가 전부 0원 행, `300000.9`는 300,000으로 내림, `MAX_SAFE+1`은
  //     무검증 통과). `[300000, "abc"]`는 **부분합 300,000과 없던 0원 행**을 함께 노출했다.
  //   ⚠ 그리고 그 합계가 아래 `blocked()`의 `totalAmount`로 그대로 나갔다 — 검증되지 않은
  //     입력에서 만든 부분합이 차단 결과에 실렸다는 뜻이다. 그래서 이 검사가 **모든
  //     preflight보다 앞**에 와야 한다. 4세대 G-16이 같은 이유로 같은 자리를 골랐다.
  //   ⚠ **안내 우선순위가 바뀐다.** 종전에는 진료비가 무효여도 stray 키·치료유형·통원 카운터
  //     안내가 먼저 나갔다(진료비 검사가 없었으므로). 이제는 진료비가 먼저다. 이 전환은
  //     의도한 것이고 차분에서 별도 버킷으로 집계한다.
  //   ⚠ `amounts ?? []` 폴백을 제거했다. 타입은 `amounts: number[]`로 **필수**이고,
  //     미제공을 빈 묶음으로 보면 "넘기지 않았다"와 "청구가 없다"가 같은 상태가 된다.
  //   ⚠ 명시적으로 입력한 숫자 `0` 행의 기존 처리(계산 포함)는 그대로다. 5세대에서 0원 행은
  //     통원 횟수·일수를 **소진하지 않는다**(4세대와 반대다). 이번에 바꾸지 않았다.
  //   ⚠ 안내에 받은 값 자체를 넣지 않고 `typeof`만 넣는다. 형식만 알려도 충분한 자리이고,
  //     무효 입력을 템플릿 리터럴에 그대로 끼우면 `Symbol`이나 `toString()`이 던지는 객체에서
  //     안내를 만드는 중에 예외가 난다. (이 파일의 다른 안내 11곳은 값 자체가 단서가 되는
  //     자리라 지역 `showValue()`를 쓴다. 두 방식 모두 예외를 내지 않는다.)
  const rawAmounts: unknown = (input as { amounts?: unknown }).amounts;
  if (!Array.isArray(rawAmounts)) {
    return unusable([
      "진료비 목록(amounts)은 배열이어야 합니다. 청구가 없는 묶음은 빈 배열로 넘겨 주세요.",
      "미입력·null을 빈 묶음으로 보지 않습니다 — 넘기지 않은 것과 청구가 없다는 것은 다른 상태입니다.",
      `받은 값의 형식: ${typeof rawAmounts}`,
    ]);
  }
  // ⚠ 각 원소를 **정확히 한 번** 읽고, 검증한 값을 아래 계산이 그대로 쓴다. 값이 달라지는
  //   접근자에서 검증한 값과 계산에 쓰는 값이 갈리지 않게 하기 위해서다.
  const amounts: number[] = [];
  for (let i = 0; i < rawAmounts.length; i++) {
    const v: unknown = rawAmounts[i];
    if (!isClaimAmount(v)) {
      return unusable([
        `${i + 1}번째 진료비는 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다.`,
        "잘못된 값을 0원으로 바꾸지 않습니다 — 입력하지 않은 0원 행이 생겨 총액과 행 목록이 입력과 달라집니다.",
        `${i + 1}번째 받은 값의 형식: ${typeof v}`,
      ]);
    }
    amounts.push(v);
  }
  // ⚠ 원소가 모두 안전한 정수여도 **합계**는 범위를 벗어날 수 있다([MAX_SAFE, 1]).
  //   그 뒤의 누적(지급보험금·연간 한도 비교)이 정밀도를 잃으므로 계산하지 않는다.
  const totalAmount = amounts.reduce((s, x) => s + x, 0);
  if (!Number.isSafeInteger(totalAmount)) {
    return unusable([
      "진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다. 각 행이 안전한 정수여도 합계는 벗어날 수 있습니다.",
      `받은 행 수: ${amounts.length}`,
    ]);
  }
  // ⚠ `normalizeAmount`를 다시 걸지 않는다. 위 검사를 통과한 값에 대해 그 함수는 항등이며
  //   (`Math.max(0, Math.floor(v))`), 다시 걸면 "여기서도 값을 고친다"고 읽힌다.

  // 유니온 내로잉. 급여 묶음에는 비급여 전용 축이 없다.
  const nb = input.coverage === "non_benefit" ? input : undefined;
  const bf = input.coverage === "benefit" ? input : undefined;
  /**
   * 검증을 통과한 중증/비중증 (G-32).
   *   ⚠ **읽기는 아래 한 자리에서만** 한다 — 선행 preflight(치료유형·통원 카운터 stray)가
   *     결과를 정하는 경로에서는 이 이름에 닿지 않는다. 급여 묶음에서는 끝까지 `undefined`다.
   */
  let severity: Severity | undefined;
  /** 진료비는 이미 검증됐고, **다른 이유**로 계산을 막는 자리. 진료비 합계를 보존한다. */
  const blocked = (notes: string[]): MultiClaimResult => ({
    status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
    totalAmount, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  });

  /**
   * 검증 전이지만 **한 번만 읽은** 건강보험 본인부담률 (G-31).
   *   ⚠ 급여 묶음에서만 채운다. 값 검증은 종전대로 `calc2026`이 첫 행에서 한다 —
   *     여기서 하는 일은 "행마다 다시 읽지 않는 것"뿐이고 안내·순서는 그대로다.
   */
  let checkedNhis: unknown;

  // 두 통원 카운터는 **비급여 통원 전용**이다. 급여 묶음에 실려 오면 쓰이지 않는 입력이므로
  //   조용히 버리지 않는다. 타입에서는 never로 닫았지만 외부 런타임 데이터는 타입을 우회한다.
  if (bf) {
    const strayVisits = readCount(bf, "priorAnnualOutpatientVisits");
    const strayDays = readCount(bf, "priorAnnualOutpatientDays");
    if (strayVisits !== undefined || strayDays !== undefined) {
      return blocked([
        "통원 횟수·일수 카운터는 비급여 통원 전용입니다. 급여 계산에는 쓰이지 않습니다.",
        "쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(strayVisits ?? strayDays)}`,
      ]);
    }
    // ── 급여 묶음의 미사용 금액 축 stray 거부 (G-30) ────────────────
    //   연간 보험가입금액·통원 가입금액·기존 지급보험금 세 축은 모두 **비급여 특별약관**의
    //   축이다(제5조① — "(1)상해비급여에 대하여… (2)질병비급여에 대하여…"). 급여 묶음에는
    //   대응 축이 없어 이 엔진이 어디에서도 읽지 않는다.
    //   ⚠ 종전에는 **조용히 폐기**됐다(실측: 세 축 모두 접근자 호출 0회 — 결과가 미제공과
    //     완전히 같았던 이유는 반영돼서가 아니라 읽히지 않아서다).
    //   ⚠ 값이 `0`이어도 막는다 — 바로 위 통원 카운터와 같은 계약이다.
    //   ⚠ 위 카운터 안내가 **먼저**다. 이 블록을 그 뒤에 두어 종전 우선순위를 유지한다.
    //   ⚠ 각 키를 한 번만 읽고, 목록 순서대로 먼저 찾은 키만 안내한다.
    //   ⚠ `priorAnnualDeductible`은 여기 넣지 않는다 — 아래 C군이 급여 전용 안내를 이미
    //     갖고 있고, 한 축을 두 자리에서 막으면 안내가 갈린다.
    for (const key of BENEFIT_UNUSED_MONEY_KEYS) {
      const got = readCount(bf, key);
      if (got === undefined) continue;
      return blocked([
        `${key}은(는) 비급여 특별약관의 금액 축입니다(제5조 제1항 — 상해비급여·질병비급여 각각에 대해 따로 정합니다). 급여 계산에는 쓰이지 않습니다.`,
        "급여의 본인부담금은 국민건강보험 본인부담률과 약관의 공제 기준으로 정해지며, 이 세 축을 쓰지 않습니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(got)}`,
      ]);
    }
    // ── 급여 묶음의 미사용 비금액 축 stray 거부 (G-31) ───────────────
    //   ⚠ **금액 축 루프 뒤**다. 두 가족이 동시에 실려도 배포된 G-30 안내가 먼저 나간다.
    //   ⚠ 값이 `0`이어도 막는다 — 형제 축과 같은 계약이다.
    //   ⚠ 각 키를 한 번만 읽고, 목록 순서대로 먼저 찾은 키만 안내한다.
    for (const key of BENEFIT_UNUSED_NON_MONEY_KEYS) {
      const got = readCount(bf, key);
      if (got === undefined) continue;
      return blocked([
        `${key}은(는) 비급여 특별약관이 만든 구분이라 급여 계산에는 쓰이지 않습니다. 중증/비중증은 특별약관1·2가 비급여에 대해 나눈 것이고, 치료유형은 각 특약 제3조가 비급여를 보장종목으로 나눈 것입니다.`,
        "급여의 본인부담금은 국민건강보험 본인부담률과 약관의 공제 기준으로 정해집니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(got)}`,
      ]);
    }
    // ── 건강보험 본인부담률: **여기서 한 번만 읽는다** (G-31) ─────────
    //   ⚠ 종전에는 아래 행 루프가 `bf?.nhisCoinsuranceRate`를 **행마다** 읽었다
    //     (실측: 3행이면 3회, 5행이면 5회). 값이 달라지는 접근자에서 행마다 다른 요율이
    //     적용됐다 — 실측: getter가 0.2/0.9/0.5를 차례로 돌려주면 30만원 3행의 총
    //     자기부담금이 480,000원이 됐다(고정 0.2는 180,000원, 고정 0.9는 810,000원).
    //     검증한 값과 계산에 쓰는 값이 갈리는 G-29·G-30과 같은 결함이다.
    //   ⚠ 위 세 stray 뒤다 — 그 검사들이 결과를 정하는 경로에서는 이 이름을 읽지 않는다.
    //   ⚠ 값 검증은 종전대로 `calc2026`이 한다(첫 행에서 `pending` → `blocked`).
    //     여기서 검증을 앞당기면 안내 문구·순서가 바뀐다.
    checkedNhis = readCount(bf, "nhisCoinsuranceRate");
    // ── 급여 입원의 건강보험 본인부담률 (G-31) ───────────────────────
    //   `calc2026`이 이 값을 읽는 곳은 급여 **통원** 분기뿐이다. 급여 입원은 약관이 정률
    //   20%로 고정한다. 종전에는 이 묶음이 값을 읽어 `calc2026`에 넘기고 **거기서 무시**됐다
    //   (실측: 행당 1회 읽고 결과는 미제공과 동일 — 조용한 폐기가 아니라 읽고 무시다).
    //   ⚠ 조건은 소비 분기의 부정과 정확히 같다. 통원은 건드리지 않는다.
    if (input.visit === "inpatient" && checkedNhis !== undefined) {
      return blocked([
        "건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원에서만 쓰입니다. 급여 입원의 자기부담률은 약관이 20%로 정하고 있어 이 값을 읽지 않습니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(checkedNhis)}`,
      ]);
    }
    // ── 급여 입원의 의료기관 종별 (G-34B) ────────────────────────────
    //   급여 **통원**은 종별로 최소공제가 갈려 이 값을 소비한다(실측: `tertiary`에서 종별
    //   preflight가 반응한다). 급여 **입원**은 약관이 정률 20%로 고정해 종별을 읽지 않는다 —
    //   종전에는 행마다 읽어 `calc2026`에 넘기고 거기서 무시됐다(실측: 세 종별 값 모두
    //   결과가 같았다). 조용한 폐기가 아니라 **읽고 무시**다.
    //   ⚠ 조건은 바로 위 본인부담률 검사와 **같은 모양**이다. 형제 두 축을 다른 자리에 두지
    //     않는다. 통원은 건드리지 않는다.
    //   ⚠ 화면도 함께 고쳤다 — `HealthCalcMulti2026`이 급여 입원 분기에 `tier`를 싣지
    //     않는다. 런타임만 막고 화면을 두면 정상 화면이 즉시 계산 불가가 된다.
    if (input.visit === "inpatient") {
      const strayTier = readCount(bf, "tier");
      if (strayTier !== undefined) {
        return blocked([
          "의료기관 종별(tier)은 급여 통원의 최소공제를 가르는 축입니다. 급여 입원의 자기부담률은 약관이 20%로 정하고 있어 종별을 읽지 않습니다.",
          "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
          `받은 값: ${showValue(strayTier)}`,
        ]);
      }
    }
  }

  // ── A군: 2·3세대 전용 레거시 필드 ─────────────────────────────────
  //   단건 `calc2026`은 `priorAnnualPaid`의 **존재 자체를 거부**한다(2·3세대 입원 자기부담
  //   상한 200만원 전용 축이라 5세대에서는 읽지 않는다). 그런데 다회는 그 거부를 물려받지
  //   못했다 — 아래 preflight가 `calc2026`을 부를 때 `amount: 0`짜리 고정 인자로
  //   `nonBenefitItem`·`visit`·`tier`만 넘기고 **원본 입력을 넘기지 않기 때문**이다.
  //   ⚠ 여기에 금액 방향(과다·과소)을 붙이지 않는다. 5세대의 대응 축이 아니어서 "올바른 값"에
  //     해당하는 비교 대상 계산이 없다. 위험은 금액이 아니라 **조용한 폐기**다.
  //   ⚠ 값이 0이어도 막는다. 명시적으로 전달된 레거시 필드이므로 단건과 같은 계약이다.
  //   ⚠ preflight보다 **앞**이다. 이 필드는 nonBenefitItem·severity가 무엇이든 쓰이지 않는다.
  {
    const legacy = readCount(input, "priorAnnualPaid");
    if (legacy !== undefined) {
      return blocked([
        "priorAnnualPaid는 2·3세대 입원 자기부담 상한(200만원)용 필드라 5세대에서는 읽지 않습니다.",
        "5세대 중증 입원의 500만원 상한은 약관상 공제금액을 누적하므로 priorAnnualDeductible로 넘겨 주세요(특별약관1 제5조 제5항).",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(legacy)}`,
      ]);
    }
  }

  // ── B군: 별도 보장종목(3대비급여·비중증 MRI·상급병실료) 전용 키 ────
  //   이 묶음 엔진은 일반 (1)(2)와 급여만 계산한다. 아래 키들은 `specialItem2026`·
  //   `roomCharge2026`의 축이라 **어느 경로에서도 쓰이지 않는다.** 타입에는 선언조차 없어
  //   리터럴은 tsc가 막지만, 변수 경유·외부 데이터는 타입을 우회한다.
  //   ⚠ 값이 0이어도 막는다 — 통원 카운터·acts와 같은 계약이다.
  //   ⚠ preflight보다 앞이다. `nonBenefitItem`이 무엇이든 이 키들은 쓰이지 않으므로,
  //     "이 치료유형은 대상이 아닙니다"보다 먼저 정확한 이유를 말하는 편이 낫다.
  {
    // ⚠ 각 키를 **한 번만** 읽는다(G-28). 종전에는 `find`의 존재 검사와 안내의
    //   `readCount`가 같은 이름을 2회 읽어, 값이 달라지는 접근자에서 검사한 값과 안내에
    //   실리는 값이 갈릴 수 있었다. 먼저 찾은 키에서 반환하는 계약과 안내 문구는 그대로다.
    for (const stray of SPECIAL_ITEM_ONLY_KEYS) {
      const got = readCount(input, stray);
      if (got === undefined) continue;
      return blocked([
        `${stray}은(는) 별도 보장종목(3대비급여·비중증 MRI·상급병실료 차액) 전용 입력이라 이 묶음 계산에 쓰이지 않습니다.`,
        "그 보장종목은 calculateGen2026Item으로 계산해 주세요. 공제금액·보장한도·적용 축이 모두 다릅니다(특별약관1 제5조 제1항 단서·제3항).",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(got)}`,
      ]);
    }
  }

  // ── 어느 경로에서도 쓰이지 않는 축 stray 거부 (G-34B) ──────────────
  //   ⚠ **별도 보장종목 전용 축 목록 바로 뒤**다. 그 목록이 결과를 정하는 경로에서는 이
  //     이름들을 읽지 않고, 배포된 안내 우선순위도 밀리지 않는다.
  //   ⚠ 각 키를 **한 번만** 읽고, 목록 순서대로 먼저 찾은 키만 안내한다.
  //   ⚠ 값이 `0`이어도 막는다. `readCount`는 `in`이 아니라 값을 보므로 호출부의
  //     `{ ...base, key: undefined }` 패턴은 막지 않는다.
  {
    for (const stray of MULTI2026_UNUSED_KEYS) {
      const got = readCount(input, stray);
      if (got === undefined) continue;
      return blocked([
        `${stray}은(는) 5세대 여러 건 계산에 쓰이지 않는 입력입니다.`,
        "다른 세대·다른 진입점의 입력 축이거나, 행 안에서만 의미가 있는 축입니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(got)}`,
      ]);
    }
  }

  // 단건과 같은 정책을 행 수와 무관하게 먼저 적용한다(빈 입력도 막힌다).
  //   calc2026의 사유 문구를 그대로 쓰기 위해 0원 1건으로 물어본다.
  if (nb) {
    const probe = calc2026({
      amount: 0, coverage: "non_benefit", visit: nb.visit, tier: nb.tier,
      severity: "critical", // 치료유형 검사가 severity보다 먼저라 결과에 영향이 없다
      nonBenefitItem: (nb as { nonBenefitItem?: Gen2026NonBenefitItem }).nonBenefitItem as Gen2026NonBenefitItem,
    });
    if (probe.status !== "OK") return blocked(probe.notes);

    const visits = readCount(nb, "priorAnnualOutpatientVisits");
    const days = readCount(nb, "priorAnnualOutpatientDays");

    // 통원 카운터는 통원에서만 쓰인다. 입원에 실려 오면 조용히 버리지 않는다.
    //   ⚠ 일반 경로로 전환되는 치료유형(specialItem2026)은 이미 같은 계약이었다.
    //     직접 경로만 뚫려 있어 두 진입점의 계약이 갈렸다.
    if (nb.visit === "inpatient" && (visits !== undefined || days !== undefined)) {
      return blocked([
        "통원 횟수·일수 카운터는 입원 계산에 쓰이지 않습니다.",
        "쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(visits ?? days)}`,
      ]);
    }

    // ── 중증/비중증은 열거값만 받는다 (G-32) ─────────────────────
    //   ⚠ 종전에는 이 진입점이 중증도를 **검증하지 않았다.** `severity === "critical"` /
    //     `=== "non_critical"` 비교만 있어, 그 둘이 아닌 값은 아래 통원 카운터 preflight를
    //     **통과해 버리고**(유효값이면 카운터 미입력이 차단되는데도) 행 계산에서
    //     `calc2026`이 비중증으로 계산했다. 실측(비급여 통원 30만원 1행):
    //     `"critical"`은 카운터 안내로 차단 / `"mild"`·`"x"`·`"CRITICAL"`·`1`·`true`·`{}`·
    //     `[]`·`bigint`·`Symbol`·함수·순환 참조는 **OK 150,000원**. 무효값이 유효값보다
    //     느슨한 경로를 탔다. 입원에서도 중증 900,000이어야 할 자기부담금이 1,500,000이 됐다.
    //   ⚠ `undefined`의 기존 의미는 그대로다 — 여기서 막지 않고, 행 계산의 `calc2026`이
    //     내던 "비급여: 중증/비중증(severity) 미지정 → 계산 불가"를 그대로 쓴다.
    //   ⚠ **자리가 계약이다.** 위 치료유형 preflight와 입원의 통원 카운터 stray 안내가
    //     먼저다(둘 다 중증도와 무관하게 결정된다). 바로 아래 카운터 축 분리가 이 값을
    //     처음 소비하므로, 여기가 "실제 쓰이는 자리 앞"의 가장 늦은 지점이다.
    //   ⚠ **여기서 한 번만 읽는다.** 이 값을 아래 판정·산식·안내가 모두 쓴다.
    //   ⚠ 반환은 이 진입점의 기존 실패 계약 `blocked()` 그대로다 — 검증된 진료비 합계를
    //     보존하고 행·후보 보험금을 노출하지 않는다.
    const rawSeverity = readCount(nb, "severity");
    if (rawSeverity !== undefined
      && rawSeverity !== "critical" && rawSeverity !== "non_critical") {
      return blocked([
        "비급여: 중증/비중증(severity)은 \"critical\"(중증) 또는 \"non_critical\"(비중증) 두 값만 받습니다. 두 값은 특별약관1·2가 서로 다른 자기부담률·한도·통원 카운터를 정하므로, 확인하기 전에는 계산하지 않습니다.",
        "값이 그 둘이 아니면 비중증으로 추정하지 않습니다 — 추정하면 중증 청구가 조용히 비중증으로 계산됩니다.",
        `받은 값: ${showValue(rawSeverity)}`,
      ]);
    }
    severity = rawSeverity as Severity | undefined;

    // ── 통원 카운터 축 분리 ───────────────────────────────────────
    //   중증은 '통원 100회'(특약1 제3조 (1)①·(2)① 표), 비중증은 '통원 100일'
    //   (특약2 (1)①·(2)① 표)로 단위가 다르다. 반대편 필드를 넘겼다면 호출자가
    //   단위를 잘못 알고 있다는 뜻이므로, 값이 0이어도 계산하지 않는다.
    //   ⚠ 대상은 해당 통원 경로뿐이다. 다른 경로의 기존 관용 동작은 이번에 정리하지 않는다.
    if (nb.visit === "outpatient" && severity === "critical" && days !== undefined) {
      return blocked([
        "중증 통원의 연간 한도는 약관상 통원 100회입니다(특별약관1 제3조 (1)제1항·(2)제1항 <구분·보상금액>).",
        "일수 카운터(priorAnnualOutpatientDays)는 비중증 전용이라 중증 계산에 쓰지 않습니다. 통원 횟수(priorAnnualOutpatientVisits)로 넘겨 주세요.",
      ]);
    }
    if (nb.visit === "outpatient" && severity === "non_critical" && visits !== undefined) {
      return blocked([
        "비중증 통원의 연간 한도는 약관상 통원 100일입니다(특별약관2 제3조 (1)제1항·(2)제1항 <구분·보상금액>).",
        "횟수 카운터(priorAnnualOutpatientVisits)는 중증 전용이라 비중증 계산에 쓰지 않습니다. 통원일수(priorAnnualOutpatientDays)로 넘겨 주세요.",
      ]);
    }
    // ── 이미 사용한 통원 횟수·일수: 미입력을 0으로 추정하지 않는다 ──
    //   한도가 걸린 축이므로 과거 사용량을 모르면 계산 자체가 성립하지 않는다.
    //   ⚠ 미입력(undefined)과 확인 결과 0은 다른 상태다. 0은 유효값이다.
    //   ⚠ 회와 일은 안내 문구·근거 조문을 섞지 않는다.
    if (nb.visit === "outpatient" && severity === "critical") {
      if (visits === undefined) {
        return blocked([
          "중증 통원은 계약해당일 기준 1년간 통원 100회가 한도입니다(특별약관1 제3조 (1)제1항·(2)제1항 <구분·보상금액>).",
          "이미 사용한 통원 횟수(priorAnnualOutpatientVisits)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 사용한 통원이 없으면 0을 넣어 주세요.",
        ]);
      }
      if (badCount(visits)) {
        return blocked([
          "이미 사용한 통원 횟수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
          `받은 값: ${showValue(visits)}`,
        ]);
      }
    }
    if (nb.visit === "outpatient" && severity === "non_critical") {
      if (days === undefined) {
        return blocked([
          "비중증 통원은 계약해당일 기준 1년간 통원 100일이 한도입니다(특별약관2 제3조 (1)제1항·(2)제1항 <구분·보상금액>).",
          "이미 사용한 통원일수(priorAnnualOutpatientDays)를 알아야 이후 청구의 보상 여부가 정해지므로, 입력 전에는 계산하지 않습니다. 사용한 통원이 없으면 0을 넣어 주세요.",
        ]);
      }
      if (badCount(days)) {
        return blocked([
          "이미 사용한 통원일수는 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
          `받은 값: ${showValue(days)}`,
        ]);
      }
    }
  }

  // ── C군: priorAnnualDeductible — 실제 소비 경로에서만 허용 ─────────
  //   제5조⑤ 500만원 공제금액 상한은 **상급종합병원·종합병원 입원**에만 걸린다. 엔진도
  //   `calc2026`이 `severity === "critical" && visit === "inpatient" && tier === "hospital"`
  //   일 때만 이 값을 쓴다(generation2026.ts). 그 밖의 조합에서는 어디에도 쓰이지 않는다.
  //   ⚠ 이 검사는 위 preflight·통원 카운터 안내 **뒤**에 온다. `severity`·`tier`·
  //     `nonBenefitItem`이 정해지지 않은 상태에서 먼저 거부하면, "질환 구분을 골라 주세요"·
  //     "의료기관 종별을 골라 주세요"라고 말해야 할 자리에 "이 필드를 쓰지 마세요"가 나간다.
  //     그래서 **미지정은 후보로 두고** 기존 안내가 제 역할을 하게 둔다.
  //   ⚠ 합산 범위(상해·질병 및 3대비급여를 하나로 세는지)는 확정되지 않았고
  //     (GEN2026-CRITICAL-DEDUCTIBLE-POOL-SCOPE = HOLD) 이 검증은 그것을 건드리지 않는다.
  //   ⚠ 여기서 읽은 값을 아래 계산이 그대로 쓴다(G-30). 종전에는 `runBundle`이
  //     `nonNegInt(nb?.priorAnnualDeductible)`로 다시 읽어 **2회**였다.
  let checkedDeductible: number | undefined;
  {
    const deductible = readCount(input, "priorAnnualDeductible");
    if (deductible !== undefined) {
      // 급여 묶음에는 이 축이 없다(제5조⑤는 비급여 특별약관 조항이다).
      if (bf) {
        return blocked([
          "누적 공제금액(priorAnnualDeductible)은 비급여 중증 입원의 500만원 공제금액 상한 전용입니다. 급여 계산에는 쓰이지 않습니다.",
          "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
          `받은 값: ${showValue(deductible)}`,
        ]);
      }
      // 여기부터는 비급여다. 미지정(undefined)은 위 안내가 이미 처리했거나 처리할 몫이므로
      //   후보로 남긴다 — 확정된 값이 소비 조건과 어긋날 때만 막는다.
      const usesDeductible = (severity === undefined || severity === "critical")
        && nb?.visit === "inpatient"
        && (nb.tier === undefined || nb.tier === "hospital");
      if (!usesDeductible) {
        return blocked([
          "누적 공제금액(priorAnnualDeductible)은 중증 비급여 입원 중 상급종합병원·종합병원에만 적용됩니다(특별약관1 제5조 제5항).",
          "이 조합에서는 계산에 쓰이지 않으므로, 조용히 버리지 않고 계산하지 않았습니다.",
          `받은 값: ${showValue(deductible)}`,
        ]);
      }
      // 값 검증 — 통원 카운터와 **같은 형식 규칙**을 쓴다(0 이상의 안전 정수).
      //   ⚠ 단위와 근거 조문은 다르다. 문구·카운터는 계속 분리한다.
      //   ⚠ 명시적 0은 유효값이고, 500만원을 넘는 값도 유효한 과거 상태라 절삭하지 않는다.
      //     상한 처리는 `calc2026`의 `Math.max(cap - prior, 0)`이 한다.
      if (badCount(deductible)) {
        return blocked([
          "이미 누적된 공제금액은 0 이상의 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열은 계산하지 않습니다.",
          "500만원을 넘는 값도 유효한 과거 상태이므로 그대로 받습니다 — 상한 처리는 약관 산식이 합니다.",
          `받은 값: ${showValue(deductible)}`,
        ]);
      }
      // ⚠ 검증한 값을 그대로 아래 계산에 넘긴다. 여기까지 온 값은 0 이상의 안전한 정수다.
      checkedDeductible = deductible as number;
    }
  }

  // ── D군: outpatientCoverageLimit — 통원에서만 소비한다 (G-30) ─────
  //   통원 가입금액은 특별약관1·2 제3조 (1)①·(2)① 표의 **통원 행**에만 있는 한도다
  //   (중증은 1회당, 비중증은 1일당). 입원 행에는 이 축이 없다.
  //   ⚠ 종전에는 비급여 **입원**에 실려 오면 조용히 폐기됐다(실측: 접근자 호출 0회 —
  //     `usesOutpatientLimit = !!nb && visit === "outpatient"`가 이름에 닿지 않았다).
  //     급여 묶음의 같은 축은 위 급여 stray 블록이 막는다.
  //   ⚠ 값이 `0`이어도 막는다 — 형제 축(통원 카운터·누적 공제금액)과 같은 계약이다.
  //   ⚠ **C군 뒤, 활성 축 검증 앞**이다. 위 preflight·통원 카운터·공제금액 안내가 모두
  //     앞서므로 종전 안내 우선순위가 바뀌지 않는다.
  //   ⚠ 한 번만 읽는다. 검사한 값과 안내에 표시하는 값이 같다.
  //   ⚠ 타입은 `visit`으로 좁힐 수 없다(호출부가 `visit`을 변수로 넘기므로 유니온을 쪼개면
  //     정상 화면이 `as` 없이는 컴파일되지 않는다). 그래서 이 축만 런타임으로 닫는다.
  if (nb && nb.visit === "inpatient") {
    const strayOut = readCount(nb, "outpatientCoverageLimit");
    if (strayOut !== undefined) {
      return blocked([
        "통원 가입금액(outpatientCoverageLimit)은 통원 보상에만 적용됩니다(특별약관1·2 제3조 (1)제1항·(2)제1항 <구분·보상금액>의 통원 행 — 중증은 1회당, 비중증은 1일당).",
        "입원 보상에는 이 한도가 없고 연간 보험가입금액(annualCoverageLimit)만 적용됩니다.",
        "쓰이지 않는 입력을 조용히 버리면 한도를 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(strayOut)}`,
      ]);
    }
  }

  // ── E군: 비급여 묶음의 건강보험 본인부담률 stray 거부 (G-31) ────────
  //   `nhisCoinsuranceRate`는 **국민건강보험이 정한 급여 항목의 본인부담률**이다. 비급여는
  //   정의상 국민건강보험이 부담하지 않는 항목이라 이 비율이 존재하지 않고, 비급여의
  //   자기부담률은 특별약관1·2 제3조가 보장종목별로 따로 정한다.
  //   ⚠ 종전에는 비급여 **전 경로**에서 **조용히 폐기**됐다(실측: 접근자 호출 0회).
  //   ⚠ **C군·D군 뒤**다. 배포된 안내 우선순위(치료유형 → 질환 구분 → 통원 카운터 →
  //     누적 공제금액 → 통원 가입금액)를 새 검사가 밀어내지 않는다.
  //   ⚠ 값이 `0`이어도 막는다. 급여 통원에서는 `0`이 유효값이지만 비급여에는 축이 없다.
  //   ⚠ 한 번만 읽는다.
  if (nb) {
    const strayNhis = readCount(nb, "nhisCoinsuranceRate");
    if (strayNhis !== undefined) {
      return blocked([
        "건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원 계산에만 쓰입니다. 비급여는 국민건강보험이 부담하지 않는 항목이라 이 비율이 없고, 자기부담률은 특별약관1·2 제3조가 보장종목별로 정합니다.",
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값: ${showValue(strayNhis)}`,
      ]);
    }
  }

  // ── 활성 지급보험금 누적 축의 값 검증 ─────────────────────────────
  //   종전 동작(기준선 5ce96c9 엔진 직접 호출로 실측): `nonNegInt()`가
  //   `Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0`이라 음수·`NaN`·`±Infinity`·문자열·
  //   빈 문자열·`null`·불리언·객체·배열·`bigint`·Symbol·순환 참조를 **조용히 0**으로 만들었다.
  //   0이 되면 남은 한도가 실제보다 커진다 — 비중증 통원(가입금액 1천만·청구 100만·정답 기존
  //   지급 990만)에서 정답 ins 100,000이어야 할 계산이 무효값 13종에서 ins 500,000이 됐고,
  //   일반 전환 경로(중증 입원·가입금액 1천만·청구 200만)에서는 100,000이 1,400,000이 됐다.
  //   소수도 조용히 내려가 같은 방향으로 어긋난다. 안전 정수 범위를 넘는 값은 검증 없이 통과했다.
  //   ⚠ 이 축은 **런타임 예외를 내지 않았다** — `Number.isFinite`가 bigint·객체를 걸러 던지지
  //     않기 때문이다. 문제는 예외가 아니라 조용히 틀린 금액이다.
  //
  //   ⚠ **읽는 축은 비급여 하나뿐이다.** 급여 묶음에는 연간 보험가입금액 축 자체가 없어
  //     (`Gen2026MultiBenefitInput`) 이 값이 결과를 바꿀 수 없다. 그런데 종전에는 급여에서도
  //     이름에 접근해 외부 객체의 접근자(getter)가 실행됐다. "쓰지 않는다"는 계약은 검증을
  //     건너뛰는 것이 아니라 **읽지 않는 것**이어야 하므로 `nb`로 감싸 읽는다.
  //     급여에 실려 온 stray 값의 조용한 폐기 동작 자체는 그대로다(후속 항목).
  //   ⚠ **원문을 한 번만 읽는다.** 종전에는 `runBundle` 안에서 읽어, 지급 0원 HOLD의 두 해석을
  //     비교하는 통원 경로에서 **같은 이름을 두 번** 읽었다(실측: 접근자 2회 호출). 값이 두 실행
  //     사이에 달라지면 비교 자체가 오염된다. HOLD의 값·상태·계산 동작은 바꾸지 않는다.
  //   ⚠ `undefined`와 명시적 숫자 `0`은 종전대로 허용한다 — 둘 다 "누적 0에서 시작"이다.
  //   ⚠ 연간 가입금액 한도를 넘는 과거 지급액도 **유효한 상태**다. 절삭하지 않는다.
  //   ⚠ 연간 가입금액이 없어 이 값이 결과를 바꾸지 못하는 경우에도 검증한다. "현재 산식에
  //     영향이 없다"와 "올바른 입력이다"는 다른 말이고, 뒤에 가입금액이 입력되면 같은 값이
  //     곧바로 금액을 바꾼다.
  //   ⚠ 형식 규칙은 통원 카운터·누적 공제금액과 같은 `badCount`를 쓴다. 단위·근거·안내 문구는
  //     축마다 다르며 섞지 않는다.
  //   ⚠ 검증 위치는 C군(누적 공제금액) **뒤**다. 치료유형·질환 구분·통원 카운터·공제금액이 함께
  //     잘못되어 있으면 그 안내가 더 앞선 안내이므로 가려지면 안 된다.
  //   ⚠ 반환은 이 파일의 기존 `blocked()`다 — 진료비 합계(`totalAmount`)를 보존한다.
  const paidRaw = readCount(nb, "priorAnnualInsurancePaid");
  if (paidRaw !== undefined && badCount(paidRaw)) {
    return blocked([
      "기존 지급보험금(priorAnnualInsurancePaid)은 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다.",
      // ⚠ 지급 방향을 단정하지 않는다. 어느 쪽으로 어긋나는지는 함께 들어온 가입금액·청구
      //   구성이 정하므로, 안내는 "고치지 않는다"는 사실만 말한다.
      "계산기가 잘못된 값을 임의로 고치지 않습니다 — 값을 고치면 남은 한도가 실제와 달라져 보험금이 잘못 계산될 수 있습니다. 지급받은 적이 없으면 0을 입력해 주세요.",
      `받은 값: ${showValue(paidRaw)}`,
    ]);
  }

  // ── 연간 보험가입금액 축의 값 검증 ────────────────────────────────
  //   연간 보험가입금액은 "N원 이내에서 계약자가 선택한 금액"이다(제5조①).
  //
  //   종전 동작(기준선 99925c3 엔진 직접 호출로 실측): `!Number.isFinite(raw) || raw <= 0`이
  //   음수·`NaN`·`±Infinity`·문자열·빈 문자열·`null`·불리언·객체·배열·`bigint`·Symbol·순환 참조를
  //   **미입력과 같게** 만들어 연간 한도가 통째로 사라졌고, 그러면서 안내는 "입력하지 않으면
  //   적용하지 않습니다"라고 말했다 — 값을 넘겼는데도.
  //   ⚠ 방향은 값에 따라 갈렸다. 위 무효값들은 한도가 사라지는 쪽이지만, `Math.floor`가
  //     **0과 1 사이의 소수를 한도 0원으로 만들어** 적용했다 — 실측에서 `0.5`는 보험금을
  //     0원으로 만들었고(같은 격자에서 명시적 `0`은 한도 미적용이라 전액 지급이다) 그때
  //     아무 안내도 나가지 않았다. 1 이상의 소수는 조용히 내려갔다.
  //   ⚠ 이 축은 **런타임 예외를 내지 않았다** — `Number.isFinite`가 bigint·객체를 걸러
  //     던지지 않기 때문이다. 문제는 예외가 아니라 조용히 틀린 금액이다.
  //
  //   ⚠ **읽는 축은 비급여 하나뿐이다.** 급여 묶음에는 이 축이 타입에 없다. `readCount(nb, …)`가
  //     `nb`가 없으면 이름에 접근조차 하지 않으므로, 급여에서는 외부 객체의 접근자(getter)가
  //     실행되지 않는다(G-20과 같은 규칙, 실측으로 확인).
  //   ⚠ **원문을 한 번만 읽는다.** `runBundle` 밖이라 지급 0원 HOLD의 두 해석이 같은 값에서
  //     출발한다. HOLD의 값·상태·계산 동작은 바꾸지 않는다.
  //   ⚠ **허용**: `undefined`(미입력)와 숫자 `0`. 둘 다 종전과 같이 한도를 적용하지 않는다.
  //     이 커밋은 두 값의 계산을 바꾸지 않고 **안내만 분리**한다.
  //   ⚠ 0을 미적용으로 보는 것은 **이 계산기의 정책**이지 약관 해석이 아니다. 0원 가입이
  //     실제로 선택 가능한 계약값인지, 그 경우 한도가 0원인지는 원문에서 확인하지 않았다.
  //     그래서 0을 무효로 차단하지도, 한도 0원으로 적용하지도 않고 종전 계산을 유지한다.
  //   ⚠ 상한을 넘는 안전 정수는 **거부하지 않는다.** 상한 절삭은 제5조①에 근거가 있는
  //     정당한 계산이고 종전 동작 그대로다.
  //   ⚠ 검증 위치는 G-20 지급보험금 검증 **뒤, 실제 계산 앞**이다.
  //   ⚠ 반환은 이 파일의 기존 `blocked()`다 — 진료비 합계(`totalAmount`)를 보존한다.
  const limitRaw = readCount(nb, "annualCoverageLimit");
  if (limitRaw !== undefined && badCount(limitRaw)) {
    return blocked([
      "연간 보험가입금액(annualCoverageLimit)은 0 이상의 안전한 정수여야 합니다. 음수·소수·NaN·Infinity·안전 정수 범위를 넘는 값·문자열·객체는 계산하지 않습니다.",
      // ⚠ 지급 방향을 단정하지 않는다. 종전 동작은 값에 따라 양쪽으로 갈렸다.
      "계산기가 잘못된 값을 임의로 고치지 않습니다 — 가입금액을 고치면 연간 지급 한도가 증권과 달라져 보험금이 잘못 계산될 수 있습니다. 증권에 적힌 연간 보험가입금액을 입력해 주세요.",
      `받은 값: ${showValue(limitRaw)}`,
    ]);
  }

  const annualMax = severity === "critical"
    ? GEN2026.nonBenefit.critical.annualLimitMax
    : GEN2026.nonBenefit.nonCritical.annualLimitMax;
  // 여기 오는 값은 `undefined`이거나 0 이상의 안전한 정수다. 내림·정규화 없이 그대로 쓴다.
  const limit = limitRaw as number | undefined;
  const limitState: "applied" | "unset" | "zero" =
    limit === undefined ? "unset" : limit === 0 ? "zero" : "applied";
  const annualLimit = limitState === "applied"
    ? Math.min(limit as number, annualMax)
    : undefined;
  const isCriticalOutpatient = !!nb && severity === "critical" && input.visit === "outpatient";
  const isNonCriticalOutpatient = !!nb && severity === "non_critical" && input.visit === "outpatient";

  // ── 통원 가입금액(outpatientCoverageLimit) ────────────────────────────
  //   ⚠ **활성 축일 때만 읽는다.** 이 축을 소비하는 곳은 `calc2026`의 비급여 통원 두 분기뿐이다.
  //     급여·입원 묶음에서는 이름에 접근조차 하지 않는다 — "쓰지 않는다"는 계약은 검증을
  //     건너뛰는 것이 아니라 **읽지 않는 것**이다(G-18의 계약).
  //   ⚠ **한 번만 읽는다.** 종전에는 `runBundle`이 행마다(그리고 두 해석에서 각각) 다시 읽어
  //     행 3개면 8회였다(2N+2, 엔진 직접 호출로 실측). 호출마다 값이 달라지는 접근자를 실으면
  //     **행마다 다른 한도**가 적용됐고(실측: rows=[150000, 700000, 150000]), 두 해석이
  //     어긋나면 계산 차이가 없는데도 **잘못된 지급 0원 HOLD 차단**이 났다.
  //   ⚠ 값 검증은 하류 `calc2026`이 한 곳에서 한다. 여기서 `blocked()`로 먼저 막으면 단건과
  //     다회가 서로 다른 가드를 갖게 된다. `calc2026`의 `pending()`은 아래 `runBundle`에서
  //     `blocked(single.notes)`로 감싸지므로 이 진입점의 계약(진료비 합계 보존)은 유지된다.
  const usesOutpatientLimit = !!nb && input.visit === "outpatient";
  const outpatientLimitRaw: unknown = usesOutpatientLimit ? nb.outpatientCoverageLimit : undefined;
  const outpatientLimitState: "applied" | "unset" | "zero" | "other" =
    !usesOutpatientLimit ? "other"
      : outpatientLimitRaw === undefined ? "unset"
        : outpatientLimitRaw === 0 ? "zero" : "applied";

  /**
   * 묶음 한 번을 처음부터 끝까지 계산한다.
   *
   * 가변 상태(누적 지급보험금·공제금액 pool·통원 카운터)는 **모두 이 함수 안에서 새로 만든다.**
   *   두 해석을 비교하려면 실행 사이에 공유되는 상태가 하나도 없어야 한다.
   *
   * @param countZeroPay 통원 카운터의 해석. 축은 묶음마다 하나뿐이다
   *   (중증 통원이면 '회', 비중증 통원이면 '일'. 둘은 동시에 활성화되지 않는다).
   *   true  = 해석 A — 진료비가 있는 통원은 지급액이 0원이어도 횟수·일수를 소진
   *   false = 해석 B — 실제 지급보험금이 0원보다 큰 통원만 소진
   *   ⚠ 이 인자를 읽는 곳은 아래 두 카운터뿐이고, 그 둘은 서로 배타적이다.
   *     통원이 아닌 경로(급여·입원·별도 보장종목)는 두 번째 실행 자체가 없다.
   */
  function runBundle(countZeroPay: boolean): MultiClaimResult {
    // 여기 오는 값은 `undefined`이거나 0 이상의 안전한 정수다. 정규화하지 않고 그대로 쓴다.
    //   ⚠ 위에서 **한 번만** 읽은 원값을 재사용한다. 두 해석이 같은 값에서 출발해야 한다.
    let insurancePaid = (paidRaw as number | undefined) ?? 0;
    // 특별약관1 제5조⑤ 500만원 상한의 누적 대상은 약관상 **공제금액**이다(인쇄 p.280).
    //   ⚠ single.ownPay를 누적하면 안 된다. 연간 보험가입금액 한도로 잘려 추가 부담한 금액이
    //     섞여 pool이 과대 소진되고, 이후 건의 공제가 사라져 보험금이 과다 산출된다.
    // ⚠ **한 번만 읽는다(G-30).** 종전에는 위 C군 검증이 한 번, 여기가 또 한 번 읽어
    //   중증·입원·상급종합/종합 경로에서 **2회**였다. 값이 달라지는 접근자에서 검증한 값과
    //   계산에 쓰는 값이 갈리고, 두 번째 값은 `nonNegInt`가 조용히 세탁했다.
    //   G-23·G-26·G-28·G-29가 다른 축에 세운 계약과 같다. 위에서 검증한 값을 그대로 쓴다.
    let deductiblePaid = checkedDeductible ?? 0;
    // ⚠ 두 카운터 모두 정규화하지 않는다. 대상 통원 경로에서는 위에서 미입력·잘못된 값을
    //   이미 차단했고, 그 밖의 경로에서는 실려 오는 것 자체가 차단된다. 여기서 ?? 0은
    //   "쓰이지 않는 축"의 자리값일 뿐 미입력을 0으로 추정하는 것이 아니다.
    let outpatientVisits = (nb?.priorAnnualOutpatientVisits as number | undefined) ?? 0;
    let outpatientDays = (nb as { priorAnnualOutpatientDays?: number } | undefined)
      ?.priorAnnualOutpatientDays ?? 0;
    const results: ClaimLineResult[] = [];

    for (let index = 0; index < amounts.length; index++) {
      const amount = amounts[index];

      // 중증 통원은 매년 계약해당일부터 1년간 100회가 한도다(특별약관1 제3조).
      //   ⚠ 0원·빈 행은 청구가 아니므로 횟수를 소진하지 않는다.
      if (isCriticalOutpatient && amount > 0 && outpatientVisits >= GEN2026.nonBenefit.critical.outpatientAnnualVisits) {
        results.push({
          status: "OK", generation: "2026", index, covered: false,
          amount, ownPay: amount, insurancePay: 0,
          // 보상 대상이 아닌 건은 약관상 공제 자체가 적용되지 않는다 → 500만원 pool도 소진하지 않는다.
          rateBased: 0, rateApplied: 0, minDeductible: 0, deductibleApplied: 0,
          notes: [`계약해당일 기준 1년간 통원 ${GEN2026.nonBenefit.critical.outpatientAnnualVisits}회 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`],
          appliedCaps: ["GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"],
        });
        continue;
      }
      // 비중증 통원은 매년 계약해당일부터 1년간 100일이 한도다(특별약관2 제3조 (1)①·(2)①).
      //   ⚠ 중증과 카운터·상수·CapCode를 공유하지 않는다. 단위가 회 ≠ 일이다.
      if (isNonCriticalOutpatient && amount > 0 && outpatientDays >= GEN2026.nonBenefit.nonCritical.outpatientAnnualDays) {
        results.push({
          status: "OK", generation: "2026", index, covered: false,
          amount, ownPay: amount, insurancePay: 0,
          rateBased: 0, rateApplied: 0, minDeductible: 0, deductibleApplied: 0,
          notes: [`계약해당일 기준 1년간 통원 ${GEN2026.nonBenefit.nonCritical.outpatientAnnualDays}일 한도를 이미 채워 이 건은 보상 대상이 아닙니다.`],
          appliedCaps: ["GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS"],
        });
        continue;
      }

      let single = nb
        ? calc2026({
            amount, coverage: "non_benefit", visit: nb.visit, tier: nb.tier, severity,
            nonBenefitItem: nb.nonBenefitItem,
            // ⚠ 위에서 한 번 읽은 원값을 재사용한다. 여기서 다시 읽으면 행마다·해석마다
            //   다른 값이 적용될 수 있다.
            perVisitCoverageLimit: outpatientLimitRaw as number | undefined,
            priorAnnualDeductible: severity === "critical" && nb.visit === "inpatient" && nb.tier === "hospital"
              ? deductiblePaid : undefined,
          })
        : calc2026({
            amount, coverage: "benefit", visit: input.visit, tier: input.tier,
            // ⚠ 위에서 한 번 읽은 원값을 재사용한다(G-31). 종전에는 이 자리가 행마다
            //   `bf?.nhisCoinsuranceRate`를 다시 읽어 행마다 다른 요율이 적용될 수 있었다.
            nhisCoinsuranceRate: checkedNhis as number | undefined,
          });
      if (single.status !== "OK") return blocked(single.notes);

      if (nb && severity && annualLimit !== undefined) {
        const capCode: CapCode = severity === "critical"
          ? "GEN2026_CRITICAL_ANNUAL_COVERAGE"
          : "GEN2026_NONCRITICAL_ANNUAL_COVERAGE";
        const remaining = Math.max(annualLimit - insurancePaid, 0);
        const before = single.insurancePay ?? 0;
        if (before > remaining) {
          single = {
            ...single, insurancePay: remaining, ownPay: amount - remaining,
            appliedCaps: [...single.appliedCaps, capCode],
          };
        }
      }

      // 소진 판정은 지급액이 정해진 **뒤에** 한다(해석 B가 지급액을 봐야 하므로).
      //   amount === 0인 행은 두 해석 모두 소진하지 않는다 — 기존 0원 행 계약 그대로다.
      //   ⚠ 중증은 '회', 비중증은 '일'. 카운터를 공유하지 않는다.
      const consumes = amount > 0 && (countZeroPay || (single.insurancePay ?? 0) > 0);
      if (isCriticalOutpatient && consumes) outpatientVisits += 1;
      if (isNonCriticalOutpatient && consumes) outpatientDays += 1;

      insurancePaid += single.insurancePay ?? 0;
      if (nb && severity === "critical" && nb.visit === "inpatient" && nb.tier === "hospital") {
        // 연간 보험가입금액 클램프는 insurancePay·ownPay만 바꾸고 deductibleApplied는 건드리지
        // 않는다. 그래서 한도 구속 건에서도 약관상 공제금액만 정확히 누적된다.
        deductiblePaid += single.deductibleApplied ?? 0;
      }
      results.push({ ...single, index, covered: true });
    }

    return {
      status: "OK", generation: "2026", lines: results,
      totalAmount: results.reduce((s, x) => s + x.amount, 0),
      totalOwnPay: results.reduce((s, x) => s + (x.ownPay ?? 0), 0),
      totalInsurancePay: results.reduce((s, x) => s + (x.insurancePay ?? 0), 0),
      appliedCaps: [...new Set(results.flatMap((x) => x.appliedCaps))],
      notes: buildNotes(input, limitState, outpatientLimitState, severity),
    };
  }

  // 지급 0원 해석이 결과를 바꿀 수 있는 축은 **일반 비급여 통원의 연간 횟수·일수**뿐이다.
  //   급여·입원·별도 보장종목·2·3·4세대는 두 번째 실행 자체가 없다(구조적 무회귀).
  const dualAxis = isCriticalOutpatient ? ZERO_PAY_VISITS_HOLD_NOTES
    : isNonCriticalOutpatient ? ZERO_PAY_DAYS_HOLD_NOTES
    : null;
  if (dualAxis === null) return runBundle(true);

  // 두 해석을 **처음부터 독립 실행**한다. runBundle이 누적 지급보험금·공제 pool·두 통원
  //   카운터를 실행마다 새로 만들므로 실행 사이에 공유되는 상태가 없다.
  //   내부 후보 결과와 카운터는 노출하지 않는다.
  const countedA = runBundle(true);
  const countedB = runBundle(false);
  if (fingerprint(countedA) !== fingerprint(countedB)) return blocked(dualAxis);
  return countedA;
}
