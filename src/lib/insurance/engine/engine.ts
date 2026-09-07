import { ClaimInput, CalcResult, Gen2026ClaimInput, Generation } from "./types";
import { calcStandardized } from "./generationStandardized";
import { calc2021 } from "./generation2021";
import { calc2026 } from "./generation2026";

/* ────────────────────────────────────────────────────────────────────────
 * G-34A — 제네릭 진입점의 **세대·경로별 소유권 표**.
 *
 * G-33은 "5세대 전용 축 5개"라는 **이름 목록**으로 이전 세대 경로를 막았다. 그 목록은
 * 5세대에서 온 축만 담고 있어서, 다른 진입점(다회·별도 보장종목·상급병실료)의 축과
 * 세대가 서로 바꿔 쓸 수 없는 축(`plan`↔`tier`, `facility`)은 그대로 통과했다.
 * G-34A는 목록을 **소유권 표**로 바꾼다: 그 세대가 그 경로에서 **실제로 읽는 축만**
 * 통과시키고 나머지는 전부 막는다.
 *
 * ⚠ 소유권은 "타입에 선언돼 있다"가 아니라 **실측**으로 정한다(기준선 `5ea987c`,
 *   UI 미경유 엔진 직접 호출, 30경로 × 34축):
 *     · 축을 base에서 뺀 결과를 기준으로 삼고,
 *     · 접근자(getter) 호출 횟수와 결과 지문(status·금액·요율·캡·안내) 변화를 함께 본다.
 *   접근자 0회 **그리고** 결과 무변화일 때만 "읽지 않는다"로 본다. 결과가 같다는 것만으로
 *   미소비라고 부르지 않는다.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 다른 진입점이 소유한 축 — `ClaimInput`에 **선언조차 없다.**
 * 선언이 없으면 객체 리터럴만 초과 속성 검사에 걸리고, 변수를 거쳐 온 객체·외부 데이터는
 * 그대로 통과해 런타임이 **조용히 버렸다**(실측: 접근자 0회, 결과 무변화).
 *   `cause`                         상해/질병. 다회·별도 보장종목 진입점이 연 한도를 상해·질병
 *                                   각각으로 나눌 때 쓰는 축이다. 단건 계산에는 대응 축이 없다.
 *   `outpatientCoverageLimit`       5세대 다회 통원 한도.
 *   `annualCoverageLimit`           4·5세대 다회 연간 보험가입금액.
 *   `priorAnnualInsurancePaid`      4·5세대 다회 연 누적 보험금.
 *   `priorAnnualRiderPaid`          4세대 다회 특약 연 누적 보험금.
 *   `priorAnnual*Visits/Days/Prescriptions`  다회 진입점의 연간 횟수 카운터.
 *   `approvedThroughVisit`          4세대 다회 특약·5세대 근골격계의 승인 회차.
 *   `priorAnnualCoveredCount`       5세대 별도 보장종목 연간 보장 횟수.
 *   `priorAnnualTreatmentActCount`  5세대 근골격계 치료 행위 횟수.
 *   `priorAnnualInpatientDeductible` 5세대 별도 보장종목 입원 공제 누적.
 *   `injectionPurpose`·`item`·`rider`·`route`  별도 보장종목·특약·진입점 선택 축.
 */
const OTHER_ENTRY_AXES = [
  "cause",
  "outpatientCoverageLimit", "annualCoverageLimit",
  "priorAnnualInsurancePaid", "priorAnnualRiderPaid",
  "priorAnnualOutpatientVisits", "priorAnnualOutpatientDays",
  "priorAnnualPrescriptions", "priorAnnualRiderVisits",
  "approvedThroughVisit", "priorAnnualCoveredCount",
  "priorAnnualTreatmentActCount", "priorAnnualInpatientDeductible",
  "injectionPurpose", "item", "rider", "route",
] as const;

/**
 * 여러 건·여러 박을 담는 **컨테이너 축**. 단건 진입점은 `amount` 하나만 읽는다.
 * ⚠ 이 다섯은 조용히 버려질 때 피해가 가장 크다 — 호출부는 여러 건을 넘겼다고 믿는데
 *   결과는 `amount` 한 건만 계산한 값이라 **총액이 조용히 축소**된다.
 */
const CONTAINER_AXES = ["lines", "amounts", "stays", "roomChargeTotal", "inpatientDays",
  // ⚠ G-34B에서 추가했다. `generation`은 **결과 필드**이지 입력 축이 아니다 — 세대는 이
  //   함수의 첫 인자로 받는다. 입력 객체에 실으면 계산 세대를 바꾸지 않고 조용히 버려졌다.
  //   G-34B가 묶음·항목 진입점에서 같은 축을 닫으면서 형제 정렬을 위해 여기도 함께 닫는다.
  "generation"] as const;

/**
 * 5세대 전용 축 (G-33이 세운 목록 — 순서와 안내 문구를 그대로 유지한다).
 * 이전 세대 경로에서 이 네 축의 안내는 G-33 이후 한 글자도 바뀌지 않는다.
 */
const GEN2026_ONLY_AXES = [
  "nhisCoinsuranceRate", "severity", "nonBenefitItem", "priorAnnualDeductible",
] as const;

/**
 * 제네릭 진입점이 **어느 세대에서도 막지 않는** 축. 후보 목록(`ROUTER_AXES`) 밖에 두지만
 * 분류표에서 빼지는 않는다 — 총수와 분류 합계가 맞아야 검증할 수 있다.
 *   `amount`·`visit`  네 세대가 모두 소비한다.
 *   `coverage`        2021·2026은 소비한다. 2·3세대는 **읽지 않지만**(급여·비급여 합계에 단일
 *                     정률) 막지 않는다 — `tests/generationStandardized.test.ts`의 "급여/비급여로
 *                     자기부담이 갈리지 않음"이 **그 축의 허용을 목적으로** 두 값을 모두 넣고
 *                     결과가 같아야 한다고 단언한다. 결과 차등은 없지만 **의미상 허용된 입력**이다.
 *                     ⚠ "결과가 달라져야 실제 소비"라는 기준만으로는 이 축을 옳게 분류하지 못한다.
 */
export const ALWAYS_ACCEPTED_AXES = ["amount", "coverage", "visit"] as const;

/**
 * 안내 우선순위 = 이 배열의 순서. G-33이 만든 다섯 자리를 앞에 두어 기존 안내가 바뀌지 않게 한다.
 * ⚠ 여기 없는 축은 **막지 못한다.** `types.ts`에 입력 축이 추가되면 이 목록이나
 *   `ALWAYS_ACCEPTED_AXES`에 넣어야 하고, `tests/gen2034RouterOwnership.test.ts`가 두 곳이
 *   어긋나면 실패한다.
 */
const ROUTER_AXES = [
  ...GEN2026_ONLY_AXES,
  "perVisitCoverageLimit",
  "tier", "plan", "facility", "priorAnnualPaid",
  ...OTHER_ENTRY_AXES,
  ...CONTAINER_AXES,
] as const;
type RouterAxis = (typeof ROUTER_AXES)[number];

/**
 * 세대별 소유권. `always`/`outpatientOnly`/`inpatientOnly`는 **실측된 소비**다.
 * `held`는 소비하지 않는데도 막지 않는 축 — **판단 보류**이며, 확정에 무엇이 더 필요한지
 * 주석에 적는다.
 *
 * ⚠ `held`는 "공통 타입이니까 괜찮다"나 "화면이 늘 싣는다"로 채우지 않는다. 화면이 네 경로에
 *   같은 객체를 넘긴다는 사실은 **UI 구현 편의**이지, 나머지 경로에서 조용히 버리는 것이 공개
 *   엔진 계약이라는 근거가 아니다. 그래서 이 칸의 이름은 "공통 통로"가 아니라 "보류"다.
 * ⚠ 여러 진입점 공용 통로임을 **문서·API 계약이 명시한** 자리(= 근거 있는 공통 통로)는
 *   현재 **한 자리도 없다.** 그런 칸을 미리 만들어 두지 않는다.
 */
type Ownership = {
  readonly always: readonly RouterAxis[];
  readonly outpatientOnly: readonly RouterAxis[];
  readonly inpatientOnly: readonly RouterAxis[];
  readonly held: readonly RouterAxis[];
};

const STANDARDIZED_OWNERSHIP: Ownership = {
  // `plan`은 미지정이면 계산 자체가 PENDING이다(필수 축). `amount`·`coverage`·`visit`은
  // ROUTER_AXES에 없다 — 어느 세대에서도 막지 않으므로 후보가 아니다.
  always: ["plan"],
  // 통원 정액공제 표(<표1 항목별 공제금액>)의 분류축과 회(건)당 가입금액.
  //   실측: 통원 8경로에서 접근자 호출 + 값에 따라 결과가 달라진다.
  outpatientOnly: ["facility", "perVisitCoverageLimit"],
  // 입원 자기부담 연간 상한(200만원)의 연 누적 자기부담금.
  //   실측: 입원 8경로에서만 소비. 통원 8경로는 접근자 0회 · 결과 무변화 → 값 `0`도 막는다.
  inpatientOnly: ["priorAnnualPaid"],
  // 보류 없음. (`coverage`는 어느 세대에서도 막지 않으므로 `ALWAYS_ACCEPTED_AXES`에 있다.)
  held: [],
};

const GEN2021_OWNERSHIP: Ownership = {
  // `tier`는 4세대 **급여 통원**만 소비한다 — 실측: `coverage === "benefit" && visit ===
  // "outpatient"`에서만 접근자가 호출되고 값에 따라 결과가 달라진다.
  //   ⚠ G-34C까지는 이 칸이 `held`였다(급여 입원·비급여 통원·비급여 입원 3자리 판단 보류).
  //     그 3자리는 **확정 stray**로 닫혔고, 판정 자리는 `calc2021`이다 — 라우터는 `visit`으로만
  //     경로를 나누므로 `coverage`까지 보는 조건을 여기서 다시 쓸 수 없고, 같은 판정을 두 곳에서
  //     하면 안내가 갈린다(5세대 축을 `calc2026`에 맡기는 아래 표와 같은 이유다).
  //     그래서 라우터는 이 축을 **세대 소유로 넘기고**, 경로별 거부·값 검증은 `calc2021`이 한다.
  always: ["tier"],
  outpatientOnly: [],
  inpatientOnly: [],
  held: [],
};

const GEN2026_OWNERSHIP: Ownership = {
  // 5세대 단건 엔진이 실제로 읽는 축. 급여/비급여·통원/입원 중 **어느 한 경로라도** 읽으면
  // 여기에 둔다 — 경로별로 좁히는 일은 5세대 자기 진입점(G-30·G-31·G-32)이 이미 하고 있고,
  // 라우터가 같은 판정을 두 번 하면 안내가 갈린다.
  always: [
    "nhisCoinsuranceRate", "severity", "nonBenefitItem",
    "priorAnnualDeductible", "perVisitCoverageLimit", "priorAnnualPaid", "tier",
  ],
  outpatientOnly: [],
  inpatientOnly: [],
  // ⚠ G-34C까지는 `held: ["tier"]`였다(급여 입원·비급여 통원 판단 보류). 두 자리는 **확정
  //   stray**로 닫혔고 판정 자리는 `calc2026`이다 — 위 `always` 축들과 같은 이유로 라우터가
  //   같은 판정을 두 번 하지 않는다. 그래서 `tier`도 `always`로 옮겼다.
  held: [],
};

const OWNERSHIP: Record<Generation, Ownership> = {
  "2009": STANDARDIZED_OWNERSHIP,
  "2017": STANDARDIZED_OWNERSHIP,
  "2021": GEN2021_OWNERSHIP,
  "2026": GEN2026_OWNERSHIP,
};

/** 소유권 표에서 경로별 거부 목록을 모듈 적재 시점에 한 번만 만든다. */
function unusedOf(o: Ownership, visit: "outpatient" | "inpatient"): readonly RouterAxis[] {
  const owned = new Set<RouterAxis>([
    ...o.always, ...o.held,
    ...(visit === "outpatient" ? o.outpatientOnly : o.inpatientOnly),
  ]);
  return ROUTER_AXES.filter((k) => !owned.has(k));
}
const byVisit = (o: Ownership) => ({ outpatient: unusedOf(o, "outpatient"), inpatient: unusedOf(o, "inpatient") });
const UNUSED: Record<Generation, { outpatient: readonly RouterAxis[]; inpatient: readonly RouterAxis[] }> = {
  "2009": byVisit(OWNERSHIP["2009"]),
  "2017": byVisit(OWNERSHIP["2017"]),
  "2021": byVisit(OWNERSHIP["2021"]),
  "2026": byVisit(OWNERSHIP["2026"]),
};

/**
 * 세대·경로별 미사용 축 목록.
 * ⚠ 판정식은 각 세대 엔진의 소비 분기와 **같은 모양**이다(`input.visit === "outpatient"`).
 *   한쪽만 고치면 계약이 갈린다.
 * ⚠ `visit`을 여기서 한 번 읽는다. `visit`은 어느 세대에서도 막지 않는 필수 축이라
 *   이 읽기가 stray 판정을 앞당기지 않는다.
 */
function unusedKeysOf(generation: Generation, visit: unknown): readonly RouterAxis[] {
  const byVisit = UNUSED[generation];
  return visit === "outpatient" ? byVisit.outpatient : byVisit.inpatient;
}

/** 여러 진입점이 함께 쓰는 안내 문구 — 계열이 같으면 문구도 같아야 읽는 사람이 헷갈리지 않는다. */
const MULTI_ENTRY_WHY =
  "여러 건을 합산하는 진입점(다회 청구)의 입력 축이라 단건 계산에는 대응 축이 없습니다.";
const SPECIAL_ITEM_WHY =
  "별도 보장종목 진입점(3대 비급여·근골격계·상급병실료)의 입력 축이라 단건 계산에는 대응 축이 없습니다.";
const CONTAINER_WHY =
  "여러 건을 담는 입력 축이라 단건 계산에는 대응 축이 없습니다. 단건 진입점은 amount 한 건만 계산하므로, 이 값을 조용히 버리면 총액이 실제보다 작게 나옵니다. 여러 건은 다회 청구 진입점으로 넘겨 주세요.";

const WHY: Record<RouterAxis, string> = {
  // ── G-33이 세운 다섯 문구. 그대로 유지한다(이전 세대 경로의 안내가 바뀌지 않는다). ──
  nhisCoinsuranceRate: "건강보험 본인부담률(nhisCoinsuranceRate)은 5세대 급여 통원 계산에만 쓰입니다.",
  severity: "중증/비중증(severity)은 5세대 비급여 특별약관1·2가 만든 구분이라 이전 세대 표준약관에는 없습니다.",
  nonBenefitItem: "치료유형(nonBenefitItem)은 5세대가 비급여를 보장종목으로 나눈 축이라 이전 세대에는 없습니다.",
  priorAnnualDeductible: "누적 공제금액(priorAnnualDeductible)은 5세대 특별약관1 제5조 제5항의 500만원 공제금액 상한 전용입니다. 2·3세대 입원 자기부담 상한(200만원)은 누적 대상이 자기부담금이라 priorAnnualPaid로 넘겨 주세요.",
  perVisitCoverageLimit: "회(건)당 가입금액(perVisitCoverageLimit)은 이 세대·경로에서 쓰이지 않습니다. 2·3세대는 통원에서만 적용하고, 4세대의 통원 회당 한도는 약관이 정한 고정값이라 계약자가 고른 금액을 받지 않습니다.",

  // ── G-34A가 추가한 축 ──
  tier: "의료기관 종별(tier)은 4·5세대의 축입니다. 2·3세대는 통원 정액공제를 facility(의원·병원·종합병원·약국)로 가르고 tier를 읽지 않습니다. 두 축은 분류가 달라 이름만 보고 바꿔 넣으면 공제액이 달라집니다.",
  plan: "표준형/선택형(plan)은 2·3세대의 자기부담 유형 축입니다. 4·5세대는 이 구분이 없어 읽지 않습니다.",
  facility: "의료기관 종별 공제 구분(facility)은 2·3세대 통원의 정액공제 표에만 쓰입니다. 2·3세대 입원과 4·5세대는 읽지 않습니다.",
  priorAnnualPaid: "연간 기납부 자기부담금(priorAnnualPaid)은 2·3세대 입원 자기부담 연간 상한(200만원) 계산에만 쓰입니다. 2·3세대 통원과 4세대는 읽지 않습니다.",

  cause: "상해/질병 구분(cause)은 연간 한도를 상해·질병 각각으로 나누는 진입점(다회 청구·별도 보장종목)의 축이라 단건 계산에는 대응 축이 없습니다.",
  outpatientCoverageLimit: MULTI_ENTRY_WHY,
  annualCoverageLimit: MULTI_ENTRY_WHY,
  priorAnnualInsurancePaid: MULTI_ENTRY_WHY,
  priorAnnualRiderPaid: MULTI_ENTRY_WHY,
  priorAnnualOutpatientVisits: MULTI_ENTRY_WHY,
  priorAnnualOutpatientDays: MULTI_ENTRY_WHY,
  priorAnnualPrescriptions: MULTI_ENTRY_WHY,
  priorAnnualRiderVisits: MULTI_ENTRY_WHY,
  approvedThroughVisit: SPECIAL_ITEM_WHY,
  priorAnnualCoveredCount: SPECIAL_ITEM_WHY,
  priorAnnualTreatmentActCount: SPECIAL_ITEM_WHY,
  priorAnnualInpatientDeductible: SPECIAL_ITEM_WHY,
  injectionPurpose: SPECIAL_ITEM_WHY,
  item: SPECIAL_ITEM_WHY,
  rider: "특약 종류(rider)는 4세대 다회 청구 진입점의 축이라 단건 계산에는 대응 축이 없습니다.",
  route: "진입점 선택(route)은 별도 보장종목·상급병실료 진입점의 축이라 단건 계산에는 대응 축이 없습니다.",

  generation: "세대(generation)는 이 함수의 **첫 인자**로 받습니다. 입력 객체에 실어도 계산 세대를 바꾸지 않습니다.",
  lines: CONTAINER_WHY,
  amounts: CONTAINER_WHY,
  stays: CONTAINER_WHY,
  roomChargeTotal: CONTAINER_WHY,
  inpatientDays: CONTAINER_WHY,
};

/**
 * 미사용 축 stray 거부 (G-33 → G-34A로 일반화).
 *
 * ⚠ **위치가 계약이다.** 세대 위임이 이미 `PENDING_UNVERIFIED`를 냈다면(2·3세대의 표준형/
 *   선택형 미지정, 5세대의 치료유형·중증도 미지정 등) 그 안내가 먼저이므로 **이 이름들을
 *   읽지 않는다.** 그래서 호출부는 결과가 `OK`일 때만 이 함수를 부른다.
 * ⚠ 각 키를 **한 번만** 읽는다. 목록 순서가 안내 우선순위다.
 * ⚠ 값이 `0`이어도 막는다 — `undefined`(미제공)만 미사용과 같다. `in`이 아니라
 *   `!== undefined`로 보아 호출부의 `{ ...base, key: undefined }` 패턴을 막지 않는다.
 * ⚠ 안내에 **받은 값 자체를 넣지 않고 `typeof`만 넣는다.** 이 파일에는 `showValue()`가 없고,
 *   무효 입력을 템플릿 리터럴에 끼우면 `Symbol`이나 `toString()`이 던지는 객체에서 안내를
 *   만드는 중에 예외가 난다(`generation2026`이 G-15에서 세운 계약과 같다).
 * ⚠ 반환은 위임 결과 `ok`를 바탕으로 만든다 — `generation`과 **검증된 `amount`가 그대로
 *   보존**되고, 세대별 실패 반환 계약(`ownPay`/`insurancePay`/`rateApplied` 등이 `null`,
 *   `appliedCaps`는 빈 배열)도 그 세대의 기존 모양과 같다.
 */
function rejectUnusedAxes(
  generation: Generation,
  input: ClaimInput,
  ok: CalcResult,
  visit: unknown,
): CalcResult | null {
  for (const key of unusedKeysOf(generation, visit)) {
    const got: unknown = (input as unknown as Record<string, unknown>)[key];
    if (got === undefined) continue;
    return {
      status: "PENDING_UNVERIFIED", generation, amount: ok.amount,
      ownPay: null, insurancePay: null, rateBased: null, rateApplied: null, minDeductible: null,
      appliedCaps: [],
      notes: [
        `${generation}세대: ${WHY[key]}`,
        "쓰이지 않는 입력을 조용히 버리면 반영했다고 오해할 수 있어 계산하지 않았습니다.",
        `받은 값의 형식: ${typeof got}`,
      ],
    };
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────
 * 타입 봉인 — 런타임에서 막는 축 중 **경로와 무관하게 막는 것만** 타입으로도 닫는다.
 * ⚠ 경로별 축(`facility`·`priorAnnualPaid`·`perVisitCoverageLimit`)은 닫지 않는다.
 *   `visit`으로 유니온을 쪼개면 호출부가 `visit`을 변수로 넘기는 자리에서 `as` 없이
 *   컴파일되지 않는다(G-30·G-31·G-33이 같은 이유로 남긴 경계).
 * ⚠ 봉인 목록은 위 소유권 표에서 파생한다 — 표와 타입이 따로 놀 수 없다.
 * ──────────────────────────────────────────────────────────────────────── */
type SealNever<K extends string> = { [P in K]?: never };
type ForeignAxis = (typeof OTHER_ENTRY_AXES)[number] | (typeof CONTAINER_AXES)[number];

/**
 * 2009·2017 제네릭 호출의 입력.
 *   ⚠ G-33에서는 이 이름이 2021까지 함께 받았다. G-34A에서 2021의 봉인 목록이
 *     `plan`·`facility`·`priorAnnualPaid`·`perVisitCoverageLimit`만큼 넓어져 두 계약이
 *     달라졌으므로 세대별 타입으로 나눈다. 이름과 기존 네 축의 봉인 의미는 그대로다.
 */
export type LegacyClaimInput = ClaimInput
  & SealNever<(typeof GEN2026_ONLY_AXES)[number] | "tier" | ForeignAxis>;

/** 2021 제네릭 호출의 입력. `tier`는 화면이 늘 싣는 축이라 열어 둔다(위 소유권 표 참조). */
export type Gen2021ClaimInput = ClaimInput
  & SealNever<(typeof GEN2026_ONLY_AXES)[number] | "perVisitCoverageLimit"
    | "plan" | "facility" | "priorAnnualPaid" | ForeignAxis>;

/** 2026 제네릭 호출의 입력. 5세대가 읽지 않는 2·3세대 축과 다른 진입점의 축을 닫는다. */
export type Gen2026RouterInput = ClaimInput & SealNever<"plan" | "facility" | ForeignAxis>;

/* ────────────────────────────────────────────────────────────────────────
 * 세대별 입력 투영 (G-34C)
 *
 * 직접 엔진들이 자기 소유가 아닌 축을 **직접 호출**에서 거부하게 되면서, 라우터가 원본을
 * 그대로 넘기면 그 새 가드가 이 파일의 G-34A 가드를 앞질러 안내·순서·반환 계약이 달라진다.
 * 그래서 라우터는 **그 세대가 소유한 축만** 골라 넘기고, 원본은 아래 `rejectUnusedAxes`의
 * stray 검사에만 쓴다. 직접 엔진은 투영된 입력으로 기존 preflight와 계산을 그대로 한다.
 *
 * ⚠ **지연 투영**이다. 즉시 복사(`{...input}`)하면 선행 preflight가 결과를 정하는 경로에서도
 *   소유 축을 미리 읽어 접근자 호출이 늘고, 배포된 계약(던지는 getter의 예외 시점 포함)이
 *   바뀐다. 아래 게터는 엔진이 그 이름을 실제로 읽을 때 원본을 읽는다.
 * ⚠ 목록은 위 소유권 표에서 파생한 것과 같은 축이다 — 표와 투영이 따로 놀 수 없다.
 *   `priorAnnualPaid`는 5세대에도 넘긴다: 5세대가 **자기 안내로** 거부하는 레거시 축이고,
 *   라우터가 대신 막으면 그 안내가 사라진다(G-33에서 세운 계약).
 * ──────────────────────────────────────────────────────────────────────── */
const OWNED_AXES: Record<Generation, readonly string[]> = {
  "2009": [...ALWAYS_ACCEPTED_AXES, "plan"],
  "2017": [...ALWAYS_ACCEPTED_AXES, "plan"],
  // 4·5세대의 경로별 축(`tier` 등)은 `coverage`×`visit`으로 갈리는데 이 표는 `visit`으로만
  // 경로를 나눈다. 그래서 세대 소유로 넘기고 판정은 세대 엔진이 한다(위 소유권 표 주석).
  "2021": [...ALWAYS_ACCEPTED_AXES, "tier"],
  "2026": [...ALWAYS_ACCEPTED_AXES, "tier", "severity", "nonBenefitItem", "nhisCoinsuranceRate",
    "perVisitCoverageLimit", "priorAnnualDeductible", "priorAnnualPaid"],
};

/**
 * 치료 형태가 소유를 가르는 축 — 2·3세대는 이 표가 **경로까지 정확**하므로 라우터가 계속
 * 소유한다. 상대 경로에서는 투영이 `undefined`를 돌려줘 세대 엔진이 그 이름을 보지 못하고,
 * 그래서 G-34A 라우터 안내가 그대로 먼저 나간다.
 */
const PATH_OWNED_AXES: Partial<Record<Generation, Readonly<Record<string, "outpatient" | "inpatient">>>> = {
  "2009": { facility: "outpatient", perVisitCoverageLimit: "outpatient", priorAnnualPaid: "inpatient" },
  "2017": { facility: "outpatient", perVisitCoverageLimit: "outpatient", priorAnnualPaid: "inpatient" },
};

type Projection = { readonly input: ClaimInput; readonly visitOf: () => unknown };

function projectOwned(generation: Generation, input: ClaimInput): Projection {
  const out: Record<string, unknown> = {};
  const src = input as unknown as Record<string, unknown>;
  const pathOwned = PATH_OWNED_AXES[generation] ?? {};
  // `visit`도 **한 번만** 읽는다 — 세대 엔진이 읽는 그 시점에 읽고, 경로별 축의 투영이
  // 그 값을 함께 쓴다. 미리 읽으면 선행 preflight가 결과를 정하는 경로에서 접근자가 늘고,
  // 던지는 getter의 예외 시점이 앞당겨진다.
  let visitRead = false, visitVal: unknown;
  const visitOf = (): unknown => {
    if (!visitRead) { visitRead = true; visitVal = src.visit; }
    return visitVal;
  };
  for (const key of OWNED_AXES[generation]) {
    Object.defineProperty(out, key, {
      get: key === "visit" ? visitOf : () => src[key],
      enumerable: true, configurable: true,
    });
  }
  for (const [key, owner] of Object.entries(pathOwned)) {
    Object.defineProperty(out, key, {
      get: () => ((visitOf() === "outpatient" ? "outpatient" : "inpatient") === owner ? src[key] : undefined),
      enumerable: true, configurable: true,
    });
  }
  // ⚠ `visitOf`를 밖으로 함께 내보낸다. 아래 stray 검사도 경로를 알아야 하는데, 원본을 다시
  //   읽으면 **같은 필드를 두 번 읽는** 셈이 된다(실측: 라우터 한 호출에서 `visit` 2회).
  //   세대 엔진이 이미 읽은 그 값을 그대로 쓴다.
  return { input: out as unknown as ClaimInput, visitOf };
}

export function calculate(generation: "2009" | "2017", input: LegacyClaimInput): CalcResult;
export function calculate(generation: "2021", input: Gen2021ClaimInput): CalcResult;
export function calculate(generation: "2026", input: Gen2026RouterInput): CalcResult;
export function calculate(generation: Generation, input: ClaimInput): CalcResult;
export function calculate(generation: Generation, input: ClaimInput): CalcResult {
  switch (generation) {
    case "2009":
    case "2017": {
      const p = projectOwned(generation, input);
      const r = calcStandardized(generation, p.input);
      // 선행 preflight(표준형/선택형 미지정 등)가 결과를 정했다 — 미사용 축을 읽지 않는다.
      if (r.status !== "OK") return r;
      return rejectUnusedAxes(generation, input, r, p.visitOf()) ?? r;
    }
    case "2021": {
      const p = projectOwned("2021", input);
      const r = calc2021(p.input);
      if (r.status !== "OK") return r;
      return rejectUnusedAxes(generation, input, r, p.visitOf()) ?? r;
    }
    case "2026": {
      // 제네릭 진입점은 세대별 필수 축을 타입으로 강제할 수 없다. 5세대 비급여 치료유형은
      // calc2026이 런타임에서 검사해 미지정이면 PENDING_UNVERIFIED로 막는다.
      // 타입 강제가 필요한 호출부(5세대 UI·다회 엔진)는 calc2026을 직접 호출한다.
      //   ⚠ 5세대 자기 축(급여/비급여·통원/입원의 경로별 판정)은 이 함수가 손대지 않는다 —
      //     G-30·G-31·G-32가 calc2026 안에서 이미 닫았다. 여기서 막는 것은 **다른 세대·다른
      //     진입점의 축**뿐이고, 그래서 선행 preflight가 결과를 정하면 읽지 않는다.
      const p = projectOwned("2026", input);
      const r = calc2026(p.input as Gen2026ClaimInput);
      if (r.status !== "OK") return r;
      return rejectUnusedAxes(generation, input, r, p.visitOf()) ?? r;
    }
    default: {
      const _exhaustive: never = generation;
      throw new Error("지원하지 않는 세대: " + _exhaustive);
    }
  }
}
