// 5세대 별도 보장종목 엔진 — 특별약관1 (3)3대비급여 / 특별약관2 (3)비급여 자기공명영상진단.
//
// 근거: 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359).
//   이 보장종목들은 일반 (1)상해비급여·(2)질병비급여에서 **명시적으로 제외**되며
//   공제금액·보장한도·적용 축이 모두 다르다. 일반 산식으로 계산하면 근사가 아니라 오답이다.
//
// 축이 다른 지점 세 가지를 먼저 못박는다.
//   1) 한도가 상해·질병을 **합산**한다(<표1> "각 상해·질병 치료행위를 합산하여").
//      → 입력에 cause가 없다. 일반 경로는 제5조①이 원인별로 가입금액을 나누므로 필요하다.
//   2) 일반 경로의 통원 20만원·연간 보험가입금액이 **적용되지 않는다**(제5조①단서·③).
//      → 계약자 선택값 입력을 받지 않는다. 한도는 약관이 고정한다.
//   3) 1행 = 약관상 **공제 적용 단위 1개**(④1·④2·④3). 결과 행과 1:1로 대응한다.
// ⚠ `normalizeAmount`를 더 이상 import하지 않는다. 진료비를 조용히 고치던 세 자리
//   (`totalAmount`·`runOnce`·승인 회차 집계)가 모두 **검증된 값**을 쓰게 되어 사용처가
//   사라졌다. 남겨 두면 다음에 추가되는 행 축이 다시 조용히 변형될 자리가 생긴다.
//   ⚠ 함수 자체는 바꾸지 않았다. 다른 엔진(`multiClaim.ts`·`multiClaim2026.ts`·
//     `generation*.ts`)이 각자의 계약으로 쓰고 있고, 이번 범위가 아니다.
import { settle } from "../common/settle";
import { GEN2026 } from "./constants";
import { calculateMany2026 } from "./multiClaim2026";
import {
  CAUSE_VALUES, SEVERITY_VALUES, TIER_VALUES, VISIT_VALUES, isClaimAmount, oneOf, rejected,
} from "./itemGuards";
import { calculateRoomCharge2026 } from "./roomCharge2026";
import {
  CapCode, Gen2026CriticalMriLine, Gen2026DeductibleBreakdown, Gen2026InjectionPurpose,
  Gen2026ItemClaimInput, Gen2026ItemClaimResult, Gen2026MskApprovedThrough,
  Gen2026RejectedResult, Gen2026RoomChargeInput, Gen2026RoutedGeneralInput,
  Gen2026RoutedGeneralResult, Gen2026SpecialItem, Gen2026SpecialItemInput,
  Gen2026SpecialItemResult, Severity, SpecialItemLineResult, Tier,
} from "./types";

const S = GEN2026.specialItem;
const POOL_CAP = GEN2026.nonBenefit.critical.annualDeductibleCap;

export const GEN2026_SPECIAL_ITEM_LABEL: Record<Gen2026SpecialItem, string> = {
  musculoskeletal_esw: "근골격계 이학요법·체외충격파",
  injection: "비급여 주사료",
  mri: "비급여 MRI",
};

export const GEN2026_INJECTION_PURPOSE_LABEL: Record<Gen2026InjectionPurpose, string> = {
  general: "일반 주사",
  anticancer: "항암제",
  antibiotic: "항생제·항진균제",
  orphan_drug: "희귀의약품",
};

/**
 * 제3조(3)②가 (1)(2)로 보내는 약제.
 * ⚠ 여기서 값을 다시 나열하지 않는다. 목록이 두 곳에 있으면 한쪽만 바뀌어도 테스트가 통과한다.
 *   원천은 REGULATORY_RULES.GEN2026_INJECTION_GENERAL_ROUTE_DRUGS이며 constants가 파생한다.
 */
export const GEN2026_INJECTION_GENERAL_ROUTE_DRUGS: readonly Gen2026InjectionPurpose[] =
  S.injectionGeneralRouteDrugs;

export const GEN2026_MSK_APPROVED_THROUGH_VALUES: readonly Gen2026MskApprovedThrough[] =
  [10, 20, 30, 40, 50];


/**
 * 입력 조합이 어느 경로에서 보상되는지. UI와 엔진이 같은 판단을 쓰도록 한 곳에 둔다.
 *   "missing_purpose" — 중증 주사료인데 약제 용도를 고르지 않아 경로를 정할 수 없다.
 */
export type Gen2026ItemRoute = "special_item" | "general" | "missing_purpose";

export function routeOfGen2026Item(
  severity: Severity,
  item: Gen2026SpecialItem,
  injectionPurpose?: Gen2026InjectionPurpose,
): Gen2026ItemRoute {
  if (severity === "critical") {
    if (item !== "injection") return "special_item"; // 근골격계·MRI는 (3)3대비급여
    if (injectionPurpose === undefined) return "missing_purpose";
    return GEN2026_INJECTION_GENERAL_ROUTE_DRUGS.includes(injectionPurpose) ? "general" : "special_item";
  }
  // 비중증 — 특약2 (1)①·(2)①이 배제하는 것은 MRI뿐이다.
  return item === "mri" ? "special_item" : "general";
}

interface ItemSpec {
  fixed: number;
  rate: number;
  annualCoverage: number;
  /** 연간 보상 횟수 한도. MRI 두 종은 <표1>에 횟수 한도가 없다. */
  annualVisits: number | null;
  coverageCap: CapCode;
  visitsCap: CapCode | null;
  /** 제5조⑤ 500만원 공제 pool 대상 여부. 3대비급여 중 MRI만 해당한다. */
  poolEligible: boolean;
  label: string;
}

function specOf(input: Gen2026SpecialItemInput): ItemSpec {
  if (input.severity === "non_critical") {
    return {
      fixed: S.nonCriticalMri.deductibleFixed, rate: S.nonCriticalMri.deductibleRate,
      annualCoverage: S.nonCriticalMri.annualCoverage, annualVisits: null,
      coverageCap: "GEN2026_NONCRITICAL_MRI_ANNUAL_COVERAGE", visitsCap: null,
      poolEligible: false, label: "비중증 " + GEN2026_SPECIAL_ITEM_LABEL.mri,
    };
  }
  const base = { fixed: S.deductibleFixed, rate: S.deductibleRate };
  if (input.item === "musculoskeletal_esw") {
    return { ...base, annualCoverage: S.msk.annualCoverage, annualVisits: S.msk.annualVisits,
      coverageCap: "GEN2026_MSK_ANNUAL_COVERAGE", visitsCap: "GEN2026_MSK_ANNUAL_VISITS",
      poolEligible: false, label: GEN2026_SPECIAL_ITEM_LABEL.musculoskeletal_esw };
  }
  if (input.item === "injection") {
    return { ...base, annualCoverage: S.injection.annualCoverage, annualVisits: S.injection.annualVisits,
      coverageCap: "GEN2026_INJECTION_ANNUAL_COVERAGE", visitsCap: "GEN2026_INJECTION_ANNUAL_VISITS",
      poolEligible: false, label: GEN2026_SPECIAL_ITEM_LABEL.injection };
  }
  return { ...base, annualCoverage: S.criticalMri.annualCoverage, annualVisits: null,
    coverageCap: "GEN2026_CRITICAL_MRI_ANNUAL_COVERAGE", visitsCap: null,
    poolEligible: true, label: "중증 " + GEN2026_SPECIAL_ITEM_LABEL.mri };
}

// ─────────────────────────────────────────────────────────────────────
// 입력 검증 — 타입을 우회한 외부 데이터를 진입점에서 전부 막는다.
//   ⚠ 모르는 값이 else 분기나 기본 반환을 타고 MRI·비중증·일반 주사 산식으로 떨어지면
//     "계산 못 함"이 아니라 **틀린 보험금**이 나온다. 값을 확인하기 전에는 계산하지 않는다.
// ─────────────────────────────────────────────────────────────────────
const SPECIAL_ITEM_VALUES: readonly string[] = Object.keys(GEN2026_SPECIAL_ITEM_LABEL);
const PURPOSE_VALUES: readonly string[] = Object.keys(GEN2026_INJECTION_PURPOSE_LABEL);

/**
 * 검증을 통과한 **행별 진료비**. 입력의 `lines[].amount`(별도 보장종목) 또는
 * `amounts[]`(일반 전환 경로)와 같은 순서·같은 길이다.
 *
 * ⚠ 본체가 원본을 **다시 읽지 않도록** 값을 그대로 돌려준다. 종전에는 별도 보장종목이
 *   `line.amount`를 **4회** 읽었다(검증 1 + `totalAmount` 1 + 두 해석의 `runOnce` 2).
 *   외부 객체의 접근자가 여러 번 실행되면 값이 실행 사이에 달라져, 검증한 값과 계산에
 *   쓰는 값이 갈리고 **두 해석이 서로 다른 값에서 출발한다**(실측: 검증 300,000 →
 *   계산 900,000). G-23이 지급보험금에 세운 계약과 같다.
 */
type CheckedItemInput = {
  amounts: number[];
  /**
   * 검증을 통과한 **과거 치료행위 수**(근골격계 승인 구간 전용). 소비 경로가 아니면 `undefined`다.
   *
   * ⚠ 본체가 원본을 **다시 읽지 않도록** 값을 그대로 돌려준다(G-28). 종전에는 검증(`acts`)과
   *   승인 preflight(`priorActs`)가 각각 읽어 **2회**였고, 값이 달라지는 접근자에서
   *   **검증한 값과 승인 판정에 쓰는 값이 갈렸다**(실측: 검증 5 → 판정 20으로 차단).
   *   G-23이 지급보험금에, G-26이 진료비에 세운 계약과 같다.
   */
  acts?: number;
  /**
   * 검증을 통과한 **이미 보상한 횟수**(<표1> 연간 50회 한도 전용). 소비 경로가 아니면 `undefined`다.
   *
   * ⚠ 본체가 원본을 **다시 읽지 않도록** 값을 그대로 돌려준다(G-29). 종전에는 검증 1회 +
   *   두 해석의 `runOnce()` 2회로 **3회** 읽었다. 값이 달라지는 접근자에서 두 해석이 서로
   *   다른 값에서 출발해, 실제 계산 차이가 없는데도 `fingerprint()` 비교가 갈려
   *   **잘못된 지급 0원 HOLD 차단**이 났다(실측: 검증 0 → 두 해석 49/50 → HOLD).
   *   검증값과 계산값이 갈리기도 했다(실측: 검증 0 → 계산 50 → 지급 420,000이 0원으로).
   */
  covered?: number;
  /**
   * 검증을 통과한 **누적 공제금액**(중증 MRI 상급종합·종합병원 입원 전용). 소비 경로가 아니면 `undefined`다.
   *
   * ⚠ 본체가 원본을 **다시 읽지 않도록** 값을 그대로 돌려준다(G-29). 종전에는 검증 1회 +
   *   `runOnce()` 1회로 **2회** 읽었다(중증 MRI는 횟수 한도가 없어 해석이 하나다).
   *   실측: 검증 `0` → 계산 `5,000,000`이면 500만 원 상한이 이미 소진된 것처럼 계산돼
   *   지급 2,100,000이 **3,000,000으로 과다 산출**됐다. 반대 순서에서는 과소 산출됐다.
   */
  pool?: number;
};

function validateItemInput(
  input: Exclude<Gen2026ItemClaimInput, Gen2026RoomChargeInput>,
): Gen2026RejectedResult | CheckedItemInput {
  const raw = input as unknown as Record<string, unknown>;
  if (raw.route !== "special_item" && raw.route !== "general") return rejected("경로(route)", raw.route);
  if (raw.coverage !== "non_benefit") return rejected("급여 구분(coverage)", raw.coverage);
  if (!oneOf(raw.severity, SEVERITY_VALUES)) return rejected("질환 구분(severity)", raw.severity);
  if (!oneOf(raw.item, SPECIAL_ITEM_VALUES)) return rejected("치료유형(item)", raw.item);

  // 약제 용도는 중증 비급여 주사료에서만 의미가 있다. 그 밖의 조합에 실려 오면 막는다.
  const purpose = raw.injectionPurpose;
  const usesPurpose = raw.item === "injection" && raw.severity === "critical";
  if (usesPurpose) {
    if (purpose !== undefined && !oneOf(purpose, PURPOSE_VALUES)) return rejected("약제 용도(injectionPurpose)", purpose);
  } else if (purpose !== undefined) {
    return rejected("약제 용도(injectionPurpose)는 중증 비급여 주사료에서만 사용합니다 —", purpose);
  }

  // ── 경로 대조 — 리터럴 네 축이 유효해지는 즉시, 경로별 축을 읽기 **전에** ──────
  //   ⚠ **위치가 계약이다(G-29).** 종전에는 이 대조가 진입점의 `validateItemInput` 뒤에
  //     있어서, 아래 경로별 축들이 **경로가 틀린 입력에서도 먼저 판정하고 먼저 읽었다.**
  //     실측(기준선 `aab3bb1`): `route:"general"` · 중증 근골격계 + `priorAnnualCoveredCount`
  //     → "이미 보상한 횟수는 …에만 쓰입니다"가 경로 불일치 안내를 밀어냈고 접근자 1회.
  //     그 안내는 사실과도 다르다 — 이 조합에서 그 축은 **쓰인다.** 틀린 것은 `route`다.
  //   ⚠ 경로 판정에 필요한 값은 위에서 검증한 넷(route·severity·item·injectionPurpose)뿐이므로
  //     여기가 판정할 수 있는 가장 이른 자리다. 아래는 전부 경로별 축이다.
  //   ⚠ 진입점에서 이 자리로 **옮긴 것**이지 새로 만든 검사가 아니다. 문구·반환 계약은 그대로다.
  //   ⚠ G-23·G-26·G-28이 세운 "그 축이 실제로 쓰이는 자리 앞에서 읽는다"의 연장이다.
  const expectedRoute = routeOfGen2026Item(
    raw.severity as Severity, raw.item as Gen2026SpecialItem,
    purpose as Gen2026InjectionPurpose | undefined,
  );
  if (expectedRoute === "missing_purpose") {
    return rejected(
      "비급여 주사료의 약제 용도(injectionPurpose)가 없어 보상 보장종목을 정할 수 없습니다(특별약관1 제3조(3)제2항) —",
      purpose,
    );
  }
  if (expectedRoute !== raw.route) {
    return rejected(
      `이 조합은 ${expectedRoute === "general" ? "일반 상해·질병 비급여" : "별도 보장종목"} 경로에서 계산해야 합니다. 요청된 경로(route)`,
      raw.route,
    );
  }

  // ── 통원 카운터는 어느 경로에서든 먼저 본다 ─────────────────────────
  //   ⚠ special_item 분기가 먼저 return하면 이 검사에 도달하지 못해, 잘못 실린 카운터가
  //     조용히 버려진다. 그 구조 자체가 이번에 고친 결함의 원인이었다.
  const days = raw.priorAnnualOutpatientDays;
  const visits = raw.priorAnnualOutpatientVisits;

  // ── (3) 별도 보장종목 전용 두 축도 **경로와 무관하게 먼저** 본다 ──
  //   ⚠ 위 통원 카운터와 같은 이유다. `special_item` 분기가 먼저 return하면 일반 (1)(2)로
  //     되돌아가는 조합(항암제 등 주사료·비중증 근골격계/주사료)에 실린 값이 검사에 닿지
  //     못하고 조용히 버려진다. 두 축은 **route === "special_item"에서만** 쓰인다.

  // ── '보상한 횟수'(priorAnnualCoveredCount) ───────────────────────
  //   <표1>의 **연간 보상 횟수 한도(50회)가 있는 항목 전용** 축이다. 중증 근골격계와
  //   중증 일반 주사료뿐이며, MRI 두 종은 <표1>에 횟수 한도가 없어(금액 한도만 있다)
  //   엔진도 `spec.annualVisits === null`이라 이 값을 소비하지 않는다.
  //   ⚠ 승인 구간의 '치료횟수'(priorAnnualTreatmentActCount)와 다른 축이다. 합치지 않는다.
  //   ⚠ 값이 0이어도 거부한다. 쓰이지 않는 입력을 조용히 버리면 반영됐다고 오해한다 —
  //     acts·통원 카운터와 같은 계약이다.
  //   ⚠ **한 번만 읽는다(G-29).** 종전에는 여기서 1회 + 두 해석의 `runOnce()`가 각각 1회로
  //     **3회**였다. 값이 달라지는 접근자에서 (a) 검증한 값과 계산에 쓰는 값이 갈리고
  //     (실측: 검증 `0` → 계산 `50` → 지급 420,000이 **0원**으로), (b) 두 해석이 서로 다른
  //     값에서 출발해 실제 계산 차이가 없는데도 **잘못된 지급 0원 HOLD 차단**이 났다
  //     (실측: 검증 `0` → 두 해석 `49`/`50`). 검증한 값 하나를 `CheckedItemInput`에 실어 넘긴다.
  const covered: unknown = (raw as { priorAnnualCoveredCount?: unknown }).priorAnnualCoveredCount;
  const usesCovered = raw.route === "special_item" && raw.severity === "critical"
    && (raw.item === "musculoskeletal_esw" || raw.item === "injection");
  if (!usesCovered && covered !== undefined) {
    return rejected("이미 보상한 횟수(priorAnnualCoveredCount)는 <표1>에 연간 보상 횟수 한도가 있는 보장종목(중증 근골격계 이학요법·체외충격파, 중증 비급여 주사료)에만 쓰입니다 —", covered);
  }
  //   ⚠ 미입력(undefined)은 종전 그대로 0에서 시작한다는 뜻이다. 이번에 그 의미를 바꾸지
  //     않는다(통원 카운터처럼 "미입력이면 차단"으로 바꾸는 것은 이 커밋의 범위가 아니다).
  //   ⚠ 50을 넘는 값도 유효한 과거 상태다. 절삭하지 않는다 — 한도 판정은 산식이 한다.
  if (covered !== undefined
    && !(typeof covered === "number" && Number.isSafeInteger(covered) && covered >= 0)) {
    return rejected("이미 보상한 횟수(priorAnnualCoveredCount)는 0 이상의 정수여야 합니다 —", covered);
  }

  // ── 500만원 pool 누적 공제금액(priorAnnualInpatientDeductible) ────
  //   특별약관1 제5조⑤(2026-09-05 직독, 인쇄 p.280)은 이 상한을 **상급종합병원·종합병원
  //   입원**에만 걸고, 3대비급여 중 근골격계 이학요법·체외충격파와 주사료를 괄호로
  //   제외한다. 특별약관2(비중증) 제5조에는 같은 항이 없다(인쇄 p.308~310).
  //   ⚠ 합산 범위(상해·질병 및 3대비급여를 하나로 세는지)는 확정되지 않았고
  //     (GEN2026-CRITICAL-DEDUCTIBLE-POOL-SCOPE = HOLD) 이 검증은 그것을 건드리지 않는다.
  //     여기서 하는 것은 **이 필드가 실제로 소비되는 조합인지**만 보는 것이다.
  //   ⚠ **한 번만 읽는다(G-29).** 종전에는 여기서 1회 + `runOnce()`가 1회로 **2회**였다
  //     (중증 MRI는 <표1>에 횟수 한도가 없어 해석이 하나뿐이라 `runOnce()`가 한 번 돈다).
  //     값이 달라지는 접근자에서 검증한 값과 계산에 쓰는 값이 갈렸다 — 실측: 검증 `0` →
  //     계산 `5,000,000`이면 상한이 이미 소진된 것처럼 계산돼 지급 2,100,000이
  //     **3,000,000으로 과다 산출**됐고, 반대 순서에서는 3,000,000이 2,100,000으로 과소
  //     산출됐다. 검증한 값 하나를 `CheckedItemInput`에 실어 넘긴다.
  const pool: unknown = (raw as { priorAnnualInpatientDeductible?: unknown }).priorAnnualInpatientDeductible;
  const usesPoolItem = raw.route === "special_item" && raw.severity === "critical" && raw.item === "mri";
  if (!usesPoolItem && pool !== undefined) {
    return rejected("누적 공제금액(priorAnnualInpatientDeductible)은 500만 원 공제금액 상한의 대상인 중증 비급여 MRI에만 쓰입니다(특별약관1 제5조 제5항 — 근골격계 이학요법·체외충격파와 주사료는 괄호로 제외) —", pool);
  }
  //   ⚠ 행 단위 조건까지 본다. 엔진은 `spec.poolEligible && visit === "inpatient" &&
  //     tier === "hospital"`인 **행에서만** pool을 소진하므로, 그런 행이 하나도 없으면
  //     이 값은 어디에도 쓰이지 않는다. `every`가 아니라 `some`이다 — 혼합 구성에서
  //     대상 행이 하나라도 있으면 실제로 소진된다.
  //   ⚠ `tier === undefined`(종별 미선택)도 후보에 넣는다. 종별 미선택은
  //     `calculateSpecialItem2026`의 preflight가 전용 안내로 막아야 할 상황이고,
  //     여기서 먼저 거부하면 "종별을 고르세요" 대신 "이 필드를 쓰지 마세요"라는
  //     엉뚱한 안내가 나간다. 후보로 두면 preflight가 제 안내를 낸다.
  //   ⚠ 행 형식 자체는 아래 special_item 분기가 검사한다. 여기서는 배열이 아닐 수 있는
  //     외부 데이터를 만나도 던지지 않도록 방어적으로 읽는다.
  if (usesPoolItem && pool !== undefined) {
    const lines = Array.isArray(raw.lines) ? raw.lines as { visit?: unknown; tier?: unknown }[] : [];
    const eligible = lines.some((l) => l !== null && typeof l === "object"
      && l.visit === "inpatient" && (l.tier === "hospital" || l.tier === undefined));
    if (!eligible) {
      return rejected("누적 공제금액(priorAnnualInpatientDeductible)은 상급종합·종합병원 입원 행에만 적용됩니다(특별약관1 제5조 제5항). 입력한 행에는 해당하는 행이 없습니다 —", pool);
    }
  }
  //   ⚠ 500만 원을 넘는 값도 유효한 과거 상태다. 절삭하지 않는다 — 상한 처리는 산식이
  //     `Math.max(cap - poolUsed, 0)`으로 한다.
  if (pool !== undefined
    && !(typeof pool === "number" && Number.isSafeInteger(pool) && pool >= 0)) {
    return rejected("누적 공제금액(priorAnnualInpatientDeductible)은 0 이상의 정수여야 합니다 —", pool);
  }

  if (raw.route === "special_item") {
    // (3) 별도 보장종목에는 통원 한도가 적용되지 않는다. <표1>의 보장한도는 별개이며
    //   통원 가입금액·연간 가입금액도 여기 적용되지 않는다(제5조①단서·③).
    //   두 카운터 중 어느 쪽이든 실려 오면 값이 0이어도 계산하지 않는다.
    if (days !== undefined || visits !== undefined) {
      return rejected("통원 카운터는 별도 보장종목(3대비급여·비중증 MRI)에 적용되지 않습니다 —", days ?? visits);
    }
    if (!Array.isArray(raw.lines)) return rejected("행 목록(lines)", raw.lines);
    // ── 진료비: 컨테이너 → 원소 → 합계 (G-26) ──────────────────────
    //   ⚠ 종전에는 공용 `isNum()`(= 유한한 숫자)만 봤다. 그래서 **음수·소수·안전 정수
    //     초과가 통과했고**, 통과한 값이 하류 `normalizeAmount`에서 조용히 달라졌다
    //     (실측: `-1`·`-300000`·`0.5`·`-0.5` → 모두 0원 행, `300000.9` → 300,000).
    //   ⚠ 숫자 `0`은 **유효한 청구 행**이다. 종전 그대로 계산에 포함하며, 0원 행이 이 경로의
    //     횟수·승인 회차를 소진하는지의 기존 계약(HOLD 포함)도 그대로다.
    //   ⚠ 안내 문구는 바꾸지 않았다 — 바뀐 것은 그 안내에 도달하는 값의 범위뿐이다.
    const lineAmounts: number[] = [];
    for (let i = 0; i < raw.lines.length; i++) {
      const line = raw.lines[i] as Record<string, unknown> | null;
      if (line === null || typeof line !== "object") return rejected(`${i + 1}번째 행`, line);
      // ⚠ **한 번만 읽는다.** 검증과 본체 계산이 이 값 하나를 쓴다.
      const amount: unknown = line.amount;
      if (!isClaimAmount(amount)) return rejected(`${i + 1}번째 행의 진료비(amount)`, amount);
      if (!oneOf(line.visit, VISIT_VALUES)) return rejected(`${i + 1}번째 행의 치료 형태(visit)`, line.visit);
      // tier는 조건부 필수다. 값이 실려 왔다면 그 값 자체는 반드시 유효해야 한다.
      if (line.tier !== undefined && !oneOf(line.tier, TIER_VALUES)) return rejected(`${i + 1}번째 행의 의료기관 종별(tier)`, line.tier);
      lineAmounts.push(amount);
    }
    // ⚠ 원소가 모두 안전한 정수여도 **합계**는 범위를 벗어날 수 있다([MAX_SAFE, MAX_SAFE]).
    //   그 뒤의 누적(지급보험금·연간 보장한도 비교)이 정밀도를 잃으므로 계산하지 않는다.
    const lineSum = lineAmounts.reduce((a, b) => a + b, 0);
    if (!Number.isSafeInteger(lineSum)) {
      return rejected(
        `진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다. 각 행이 안전한 정수여도 합계는 벗어날 수 있습니다(받은 행 수 ${lineAmounts.length}) —`,
        lineSum,
      );
    }
    // 승인 구간의 '치료횟수' 축은 근골격계 전용이다. 다른 항목에 실리면 조용히 버리지 않고 막는다.
    //   ⚠ '보상한 횟수'(priorAnnualCoveredCount)와 다른 축이다. 서로 대신 쓰지 않는다.
    const acts = (raw as { priorAnnualTreatmentActCount?: unknown }).priorAnnualTreatmentActCount;
    const usesActs = raw.severity === "critical" && raw.item === "musculoskeletal_esw";
    if (!usesActs && acts !== undefined) {
      return rejected("과거 치료행위 수(priorAnnualTreatmentActCount)는 근골격계 이학요법·체외충격파의 보상 승인 구간에만 쓰입니다 —", acts);
    }
    if (acts !== undefined
      && !(typeof acts === "number" && Number.isSafeInteger(acts) && acts >= 0)) {
      return rejected("과거 치료행위 수(priorAnnualTreatmentActCount)는 0 이상의 정수여야 합니다 —", acts);
    }
    // ⚠ 여기서 확정한 값을 본체에 넘긴다. 승인 preflight가 입력을 다시 읽지 않는다(G-28).
    const checkedActs = acts as number | undefined;
    const approved = raw.approvedThroughVisit;
    if (approved !== undefined && !(typeof approved === "number" && (GEN2026_MSK_APPROVED_THROUGH_VALUES as readonly number[]).includes(approved))) {
      return rejected("보상 승인 회차(approvedThroughVisit)", approved);
    }

    // ⚠ 기존 지급보험금(priorAnnualInsurancePaid)은 **여기서 보지 않는다.** 이 축은
    //   `calculateSpecialItem2026`의 preflight를 통과한 뒤에만 소비되므로, 검증도 그 뒤에서
    //   한다. 여기서 읽으면 preflight가 이미 결과를 정한 입력에서까지 접근자가 실행되어
    //   종전에 안전하게 차단되던 입력에 새 런타임 예외가 생긴다.
    // ⚠ 여기서 확정한 세 축(진료비·승인 구간 축·형제 두 축)을 본체에 넘긴다. 본체와 두
    //   해석이 `input`을 다시 읽지 않는다(G-26·G-28·G-29).
    return {
      amounts: lineAmounts, acts: checkedActs,
      covered: covered as number | undefined, pool: pool as number | undefined,
    };
  }

  if (!oneOf(raw.cause, CAUSE_VALUES)) return rejected("원인(cause)", raw.cause);
  if (!oneOf(raw.visit, VISIT_VALUES)) return rejected("치료 형태(visit)", raw.visit);
  if (raw.tier !== undefined && !oneOf(raw.tier, TIER_VALUES)) return rejected("의료기관 종별(tier)", raw.tier);
  // ── 진료비: 컨테이너 → 원소 → 합계 (G-26) ────────────────────────
  //   ⚠ 종전에는 `every(isNum)` 하나였다. **음수·소수·안전 정수 초과가 통과했고**,
  //     통과한 값이 하류 `calculateMany2026`의 `normalizeAmount`에서 조용히 달라졌다
  //     (실측: `-1`·`0.5` → 0원 행, `300000.9` → 300,000).
  //   ⚠ **안내가 정밀해졌다.** 종전에는 원소가 잘못돼도 컨테이너 안내("진료비 목록")만
  //     나가 몇 번째인지 알 수 없었다. 별도 보장종목·상급병실료와 같은 모양으로 맞춘다.
  //     반환 계약(`rejected()` — 총액을 만들지 않는다)은 그대로다.
  //   ⚠ 숫자 `0`은 유효한 청구 행이다. 빈 배열도 종전대로 유효한 빈 묶음이다.
  if (!Array.isArray(raw.amounts)) return rejected("진료비 목록(amounts)", raw.amounts);
  const generalAmounts: number[] = [];
  for (let i = 0; i < raw.amounts.length; i++) {
    // ⚠ **한 번만 읽는다.** 검증한 값을 그대로 하류에 넘긴다.
    const amount: unknown = raw.amounts[i];
    if (!isClaimAmount(amount)) return rejected(`${i + 1}번째 진료비(amounts)`, amount);
    generalAmounts.push(amount);
  }
  const generalSum = generalAmounts.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(generalSum)) {
    return rejected(
      `진료비 합계가 안전한 정수 범위를 벗어나 계산하지 않았습니다. 각 행이 안전한 정수여도 합계는 벗어날 수 있습니다(받은 행 수 ${generalAmounts.length}) —`,
      generalSum,
    );
  }

  // ── 통원 카운터 축 분리 (일반 전환 경로) ───────────────────────────
  //   중증은 연 100'회'(특약1 제3조 (1)①·(2)① 표),
  //   비중증은 연 100'일'(특약2 (1)①·(2)① 표)로 단위가 다르다.
  //   반대편 필드가 실려 오면 호출자가 단위를 잘못 알고 있다는 뜻이므로 값이 0이어도 막는다.
  //   ⚠ 조용히 버리지 않는다 — 버리면 한도가 통째로 사라져 보험금이 과다 산출된다.
  if (raw.severity === "critical" && days !== undefined) {
    return rejected("중증 통원의 연간 한도는 통원 100회입니다. 일수 카운터(priorAnnualOutpatientDays)는 비중증 전용이라 —", days);
  }
  if (raw.severity === "non_critical" && visits !== undefined) {
    return rejected("비중증 통원의 연간 한도는 통원 100일입니다. 횟수 카운터(priorAnnualOutpatientVisits)는 중증 전용이라 —", visits);
  }
  // 통원 카운터는 통원에서만 쓰인다. 입원에 실려 오면 쓰이지 않는 입력이므로 막는다.
  if (raw.visit === "inpatient" && (days !== undefined || visits !== undefined)) {
    return rejected("통원 카운터는 입원 계산에 쓰이지 않습니다 —", days ?? visits);
  }
  // ── 이미 사용한 통원 횟수·일수의 값 검증은 여기서 하지 않는다 ──────
  //   일반 전환 경로는 calculateMany2026에 그대로 위임하고, 그쪽이 미입력·음수·소수·
  //   NaN·Infinity·안전 정수 초과·문자열을 모두 막는다. 여기서 rejected()로 먼저 막으면
  //   **totalAmount가 0으로 보고되어** 차단 결과의 계약(진료비 합계는 유지)이 깨진다.
  //   ⚠ 검증을 없앤 것이 아니라 한 곳으로 모은 것이다. 두 진입점이 서로 다른 계약을
  //     갖지 않도록, 이 경로에는 검증을 우회하는 두 번째 공개 진입점을 만들지 않는다.
  //   ⚠ 지급보험금(priorAnnualInsurancePaid)도 같은 이유로 여기서 읽지 않는다.
  //     `calculateRoutedGeneral2026`이 `calculateMany2026`으로 그대로 넘긴다.
  return { amounts: generalAmounts };
}

function blocked(totalAmount: number, notes: string[]): Gen2026SpecialItemResult {
  return {
    route: "special_item", status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
    totalAmount, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [], notes,
  };
}

/** 180일 계속 치료는 계산하지 않는다. 계약 종료일·치료 계속 여부를 계산기가 판정할 수 없다. */
const CONTINUED_TREATMENT_NOTE =
  "이 계산은 보험기간 중의 치료만 다룹니다. 보험계약이 종료된 뒤에도 계속 중인 치료는 종료일 다음 날부터 180일까지 남은 금액과 남은 횟수를 한도로 보상되지만(특별약관1 제3조(3)⑦·제5조④), 이 계산에는 반영하지 않았습니다.";

const CAUSE_MERGED_NOTE =
  "이 보장종목의 한도는 약관상 상해와 질병 치료행위를 **합산**해 적용합니다. 상해와 질병 청구를 한 번에 넣어 계산해 주세요.";

const GENERAL_LIMITS_NOTE =
  "일반 비급여의 통원 가입금액(20만 원)과 연간 보험가입금액은 이 보장종목에 적용되지 않습니다. 한도는 약관이 정한 금액·횟수입니다(특별약관1 제5조 제1항 단서·제3항).";

const UNIT_NOTE: Record<Gen2026SpecialItem, string> = {
  musculoskeletal_esw: "근골격계 이학요법·체외충격파는 치료행위마다 공제금액과 한도를 각각 적용합니다(제3조(3)④제1호). 2종류 이상을 받거나 같은 치료를 2회 이상 받았다면 행을 나눠 입력해 주세요. 보상 승인 회차(최초 10회·이후 10회 단위)는 약관상 '각 치료횟수'로 셉니다(<표1> 주)). '이미 보상한 횟수'는 보험금이 지급된 횟수라 지급 0원 치료가 있으면 치료행위 수와 달라지므로, 두 값을 따로 입력받고 서로 대신 쓰지 않습니다.",
  injection: "비급여 주사료는 1회 통원(또는 1회 입원)에서 2회 이상 주사치료를 받아도 1회로 봅니다(제3조(3)④제2호). 같은 1회 안의 주사료는 합산해 한 행에 입력해 주세요.",
  mri: "비급여 MRI는 진단행위마다 공제금액과 한도를 각각 적용합니다(제3조(3)④제3호). 2개 이상 부위를 촬영했거나 같은 부위를 2회 이상 촬영했다면 행을 나눠 입력해 주세요.",
};

const ZERO_PAY_HOLD_NOTES = [
  "지급 보험금이 0원인 치료행위가 연간 보상 횟수를 소진하는지는 표준약관에 정해져 있지 않습니다.",
  "이 계산에는 그런 행위가 있어 이후 행위의 보상 여부가 달라질 수 있으므로 계산을 중단했습니다.",
  "가입하신 보험사에 확인해 주세요.",
];

/** 한 해석(countZeroPay)으로 전 행을 계산한다. */
function runOnce(
  input: Gen2026SpecialItemInput, spec: ItemSpec, countZeroPay: boolean,
  priorPaid: number | undefined, checked: CheckedItemInput,
): Gen2026SpecialItemResult {
  const amounts = checked.amounts;
  // ⚠ 검증된 원값을 인자로 받는다. 여기서 input을 다시 읽으면 두 해석이 서로 다른 값에서
  //   출발할 수 있다(값이 달라지는 getter). 미입력은 종전대로 0에서 시작한다.
  //   ⚠ 형제 두 축도 같다(G-29). 종전에는 이 두 줄이 `input`을 직접 읽어, 두 해석이
  //     서로 다른 값에서 출발할 수 있었다. 이제 `validateItemInput`이 한 번 읽어 검증한
  //     값을 그대로 쓴다. 미입력은 종전대로 0에서 시작한다.
  //   ⚠ 관용 파서 `nonNegInt()`를 이 파일에서 **삭제했다.** 마지막 두 사용처가 여기였고,
  //     두 축 모두 위에서 `Number.isSafeInteger(v) && v >= 0`으로 검증되므로 세탁할 값이
  //     남지 않는다. 남겨 두면 새 축이 다시 그 관용(음수→0·소수 내림·문자열→0)을 타고
  //     검증을 우회할 수 있다 — G-26이 공용 `isNum()`을 폐기한 것과 같은 이유다.
  let paid = priorPaid ?? 0;
  let count = checked.covered ?? 0;
  let poolUsed = checked.pool ?? 0;
  const lines: SpecialItemLineResult[] = [];

  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index] as Gen2026CriticalMriLine & { tier?: Tier };
    // ⚠ 검증된 원값을 인자로 받는다. 두 해석이 같은 값에서 출발해야 한다.
    const amount = amounts[index];
    const appliedCaps: CapCode[] = [];

    // ── 횟수 축 ── 0원 행은 청구가 아니므로 횟수를 소진하지도, 한도에 걸리지도 않는다.
    const counts = spec.annualVisits !== null && amount > 0;
    if (counts && count >= spec.annualVisits!) {
      // 50회 초과는 약관이 정한 확정 한도다. 승인 부족과 달리 여기서만 보상 제외로 확정한다.
      appliedCaps.push(spec.visitsCap!);
      lines.push({
        status: "OK", generation: "2026", index, covered: false,
        item: input.item, actIndex: null,
        amount, ownPay: amount, insurancePay: 0,
        rateBased: Math.round(amount * spec.rate), rateApplied: spec.rate,
        minDeductible: spec.fixed, deductibleApplied: 0,
        // 보상 대상이 아닌 행위에는 약관상 공제가 적용되지 않는다 → 500만원 pool도 소진하지 않는다.
        deductible: { deductibleBeforeAnnualCap: 0, deductibleApplied: 0, excessOwnPay: amount, poolUsedAfter: null },
        notes: [`연간 보상 횟수 ${spec.annualVisits}회를 이미 채워 이 치료행위는 보상 대상이 아닙니다.`],
        appliedCaps,
      });
      continue;
    }

    // ── 공제금액 ── <표1> "1회당 N원과 보장대상의료비의 R% 중 큰 금액"
    const deductibleBeforeAnnualCap =
      Math.min(amount, Math.max(0, Math.round(Math.max(spec.fixed, amount * spec.rate))));
    let deductibleApplied = deductibleBeforeAnnualCap;
    let poolUsedAfter: number | null = null;

    // ── 제5조⑤ 500만원 공제 pool ── 중증 MRI · 입원 · 상급종합/종합만
    if (spec.poolEligible && line.visit === "inpatient" && line.tier === "hospital") {
      const remaining = Math.max(POOL_CAP - poolUsed, 0);
      if (deductibleApplied > remaining) {
        deductibleApplied = remaining;
        appliedCaps.push("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL");
      }
      poolUsed += deductibleApplied;
      poolUsedAfter = poolUsed;
    }

    // ── 금액 축 ── 누적 대상은 "지급한 금액"이다(⑦·제5조④).
    const payRaw = amount - deductibleApplied;
    const remainingCoverage = Math.max(spec.annualCoverage - paid, 0);
    const pay = Math.min(payRaw, remainingCoverage);
    if (pay < payRaw) appliedCaps.push(spec.coverageCap);

    const s = settle(amount, amount - pay);
    paid += s.insurancePay;
    if (counts && (countZeroPay || s.insurancePay > 0)) count += 1;

    const breakdown: Gen2026DeductibleBreakdown = {
      deductibleBeforeAnnualCap, deductibleApplied,
      excessOwnPay: s.ownPay - deductibleApplied,
      poolUsedAfter,
    };
    lines.push({
      status: "OK", generation: "2026", index, covered: true,
      item: input.item, actIndex: counts ? count : null,
      amount: s.amount, ownPay: s.ownPay, insurancePay: s.insurancePay,
      rateBased: Math.round(amount * spec.rate), rateApplied: spec.rate,
      minDeductible: spec.fixed, deductibleApplied,
      deductible: breakdown,
      notes: [], appliedCaps,
    });
  }

  const notes = [CAUSE_MERGED_NOTE, GENERAL_LIMITS_NOTE, UNIT_NOTE[input.item], CONTINUED_TREATMENT_NOTE];
  if (input.severity === "critical" && input.item === "mri") {
    notes.push("공제금액 상한 500만 원(특별약관1 제5조 제5항)은 상급종합·종합병원 입원 행에만 적용됩니다. 누적 대상은 약관상 공제금액이며, 보험가입금액 한도로 추가 부담한 금액은 포함되지 않습니다.");
  }
  if (input.severity === "critical" && input.item !== "mri") {
    notes.push("근골격계 이학요법·체외충격파와 비급여 주사료는 약관이 500만 원 공제금액 상한에서 제외합니다(특별약관1 제5조 제5항 괄호).");
  }
  return {
    route: "special_item", status: "OK", generation: "2026", lines,
    totalAmount: lines.reduce((a, l) => a + l.amount, 0),
    totalOwnPay: lines.reduce((a, l) => a + (l.ownPay ?? 0), 0),
    totalInsurancePay: lines.reduce((a, l) => a + (l.insurancePay ?? 0), 0),
    appliedCaps: [...new Set(lines.flatMap((l) => l.appliedCaps))],
    notes,
  };
}

/**
 * 두 해석이 같은 답을 주는지 비교할 때 쓰는 지문.
 *   ⚠ actIndex는 뺀다. 몇 회째인지는 **표시값**이고, 막아야 하는 것은 보상 여부·금액·한도가
 *     해석에 따라 갈리는 경우다. actIndex까지 넣으면 0원 행이 하나만 있어도 무조건 막힌다.
 *     대신 두 해석의 actIndex가 다른 행은 결과에서 null로 돌려 어느 쪽도 단정하지 않는다.
 *   notes도 해석과 무관하므로 뺀다.
 */
const fingerprint = (r: Gen2026SpecialItemResult) => JSON.stringify(
  r.lines.map((l) => [l.index, l.covered, l.amount, l.ownPay, l.insurancePay,
    l.deductible.deductibleApplied, l.deductible.excessOwnPay, l.deductible.poolUsedAfter,
    [...l.appliedCaps].sort()]),
);

/** ⚠ export하지 않는다. 검증을 우회하는 두 번째 입구를 만들지 않기 위해서다. */
function calculateSpecialItem2026(
  input: Gen2026SpecialItemInput,
  checked: CheckedItemInput,
): Gen2026SpecialItemResult | Gen2026RejectedResult {
  const { amounts, acts: priorActs } = checked;
  const lines = input.lines ?? [];
  // ⚠ 검증을 통과한 값으로 합계를 만든다. `normalizeAmount`를 다시 걸지 않는다 —
  //   위 검사를 통과한 값에 대해 그 함수는 항등이며, 다시 걸면 "여기서도 값을 고친다"고 읽힌다.
  const totalAmount = amounts.reduce((a, b) => a + b, 0);
  const spec = specOf(input);

  // ── preflight 1: 중증 MRI 입원의 의료기관 종별은 조건부 필수다 ──
  //   제5조⑤ pool 적용 여부가 종별로 갈린다. 기본값으로 계산하면 사용자가 모르는 채 틀린다.
  if (spec.poolEligible) {
    const missing = lines
      .map((l, i) => ({ l: l as Gen2026CriticalMriLine & { tier?: Tier }, i }))
      .filter(({ l }) => l.visit === "inpatient" && l.tier !== "clinic" && l.tier !== "hospital")
      .map(({ i }) => i + 1);
    if (missing.length > 0) {
      return blocked(totalAmount, [
        `중증 비급여 MRI 입원은 의료기관 종별에 따라 공제금액 상한 500만 원(특별약관1 제5조 제5항) 적용 여부가 달라집니다. ${missing.join(", ")}번째 행의 의료기관 종별을 선택해 주세요.`,
        "종별을 모르는 상태에서 기본값으로 계산하지 않습니다.",
      ]);
    }
  }

  // ── preflight 2: 근골격계 승인 회차 ──
  //   승인 범위가 부족한 것은 "보상 거절 확정"이 아니라 **확인 불가**다. 행을 제외하지 않고 묶음을 막는다.
  if (input.severity === "critical" && input.item === "musculoskeletal_esw") {
    const approved = input.approvedThroughVisit ?? S.msk.initialApprovedVisits;
    if (!(GEN2026_MSK_APPROVED_THROUGH_VALUES as readonly number[]).includes(approved)) {
      return blocked(totalAmount, [
        `보상 승인 회차는 ${GEN2026_MSK_APPROVED_THROUGH_VALUES.join("·")}회 중 하나여야 합니다(<표1> 주) — 10회 단위).`,
      ]);
    }
    // 승인 구간의 카운터 **단위**는 치료행위다 — <표1> 주)의 "각 치료횟수를 합산하여 최초
    //   10회 보장"(GEN2026-MSK-APPROVAL-COUNT-BASIS = "treatment_acts", 인쇄 p.264).
    //
    // ⚠ 과거분에 priorAnnualCoveredCount('보상한 횟수')를 대신 쓰지 않는다. 두 축은 지급
    //   0원 치료가 있으면 갈라지고, 그 차이가 승인 판정과 지급 결과를 뒤집는다. 대신 쓰면
    //   과소 집계된 채 OK와 보험금을 돌려주게 되므로 안전하지 않다.
    // ⚠ 미입력을 0으로 추정하지도 않는다. "확인 결과 0회"와 "모른다"는 다른 상태다.
    //   모르는 상태에서는 승인 경계를 넘겼는지 판정할 수 없으므로 **묶음 전체를 막는다.**
    // ⚠ 검증된 원값을 인자로 받는다(G-28). 여기서 input을 다시 읽으면 검증한 값과 승인
    //   판정에 쓰는 값이 갈릴 수 있다(값이 달라지는 접근자). 미입력은 종전대로 차단한다.
    if (priorActs === undefined) {
      return blocked(totalAmount, [
        `근골격계 이학요법·체외충격파는 최초 ${S.msk.initialApprovedVisits}회 이후에는 증상의 개선·병변호전 등이 확인된 경우에 한하여 ${S.msk.approvalStep}회 단위로 보상합니다(특별약관1 제3조(3)제1항 <표1> 주)).`,
        "승인 회차는 약관상 '각 치료횟수'로 세므로, 계약해당일 이후 이미 받은 치료행위 수를 알아야 이번 청구가 승인 범위 안인지 판정할 수 있습니다.",
        "'이미 보상한 횟수'는 보험금이 지급된 횟수라 치료행위 수와 다를 수 있어 대신 쓰지 않습니다. 보험사에서 확인한 치료행위 수를 입력해 주세요. 받은 치료가 없으면 0을 입력하시면 됩니다.",
      ]);
    }
    // ⚠ 연간 50회 한도의 '보상한 횟수'는 이 규칙으로 확정되지 않는다
    //   (GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY = HOLD). 아래 두 해석 비교가 그쪽을 담당한다.
    const maxCount = priorActs
      + amounts.filter((a) => a > 0).length;
    const needApproval = Math.min(maxCount, S.msk.annualVisits);
    if (needApproval > approved) {
      return blocked(totalAmount, [
        `근골격계 이학요법·체외충격파는 최초 ${S.msk.initialApprovedVisits}회 이후에는 증상의 개선·병변호전 등이 확인된 경우에 한하여 ${S.msk.approvalStep}회 단위로 보상합니다(특별약관1 제3조(3)제1항 <표1> 주)).`,
        `입력한 치료행위가 연간 ${needApproval}회째까지인데 보상 승인 회차는 ${approved}회까지입니다.`,
        "계산기는 증상 개선 여부를 판정하지 않습니다. 보험사에서 확인된 승인 회차를 입력하시거나, 승인된 범위의 치료행위만 입력해 주세요.",
      ]);
    }
  }

  // ── 지급 0원 행위의 횟수 소진 (HOLD) ──
  //   두 해석을 모두 계산해 결과가 갈리는 경우에만 막는다. 내부 두 세트는 노출하지 않는다.
  // ── 기존 지급보험금(priorAnnualInsurancePaid) ────────────────────────
  //   <표1>의 **항목별 연간 보장한도**에서 이미 지급된 금액을 빼는 축이다. 세 항목 모두
  //   아래 `runOnce()`가 소비한다(근골격계 350만·주사료 250만·중증 MRI 300만·비중증 MRI 200만).
  //
  // ⚠ **위치가 계약이다 — preflight 뒤, 계산 앞.**
  //   위 두 preflight는 "값이 틀렸다"가 아니라 **확인 불가**를 알리는 자리이고, 그 안내가
  //   나가는 입력에서는 이 축이 어디에도 쓰이지 않는다. 그러므로 읽지도 않는다. 이 검증을
  //   `validateItemInput`(형식 검증 층)으로 올리면 세 가지가 함께 깨진다.
  //     1) 승인 회차·MRI 종별 preflight 안내가 형식 거부로 바뀐다.
  //     2) preflight가 이미 결과를 정한 입력에서 접근자가 실행된다.
  //     3) 던지는 접근자에서 **종전에 안전하게 차단되던 입력에 새 런타임 예외**가 생긴다.
  //   형제 축(보상한 횟수·누적 공제금액)이 형식 검증 층에 있다는 일관성보다 위 계약이 앞선다.
  //
  // ⚠ 여기서 **한 번만** 읽고 두 해석에 같은 원값을 넘긴다. `runOnce()`가 각자 다시 읽으면
  //   호출마다 값이 달라지는 접근자에서 두 해석이 서로 다른 값에서 출발해, 실제 계산 차이가
  //   없는데도 `fingerprint()` 비교가 갈려 잘못된 지급 0원 HOLD 차단이 난다(G-23 이전 실측:
  //   `[0, 9000000]`을 번갈아 돌려주는 getter).
  // ⚠ 무효값을 0·미입력·내림값으로 바꾸지 않는다. 종전에는 `nonNegInt()`가 음수·소수·
  //   NaN·Infinity·문자열을 모두 0으로 만들어, 이미 한도를 소진한 청구에서 보험금이 과다
  //   산출됐다(실측: 주사료 정답 200,000 → 700,000).
  // ⚠ 항목별 한도를 넘는 값과 `MAX_SAFE`는 유효한 과거 상태다. 절삭하지 않는다 —
  //   한도 판정은 산식이 `Math.max(limit - paid, 0)`으로 한다.
  const paidRaw: unknown = (input as { priorAnnualInsurancePaid?: unknown }).priorAnnualInsurancePaid;
  if (paidRaw !== undefined
    && !(typeof paidRaw === "number" && Number.isSafeInteger(paidRaw) && paidRaw >= 0)) {
    return rejected("기존 지급보험금(priorAnnualInsurancePaid)은 0 이상의 정수여야 합니다 —", paidRaw);
  }
  const priorPaid = paidRaw as number | undefined;

  const counted = runOnce(input, spec, true, priorPaid, checked);
  if (spec.annualVisits === null) return counted; // MRI는 횟수 한도가 없어 해석 차이가 없다
  const notCounted = runOnce(input, spec, false, priorPaid, checked);
  if (fingerprint(counted) !== fingerprint(notCounted)) return blocked(totalAmount, ZERO_PAY_HOLD_NOTES);
  // 결과는 같지만 "몇 회째"는 해석에 따라 다를 수 있다. 다른 행은 null로 두고 단정하지 않는다.
  return {
    ...counted,
    lines: counted.lines.map((l, i) => l.actIndex === notCounted.lines[i].actIndex
      ? l : { ...l, actIndex: null }),
  };
}

// ─────────────────────────────────────────────────────────────────────
// 일반 (1)(2) 경로로 되돌아가는 조합 — 안내 후 차단이 아니라 **실제 계산**한다.
//   기존 일반 엔진을 그대로 호출하고, 결과에는 사실 안내 한 줄만 덧붙인다.
// ─────────────────────────────────────────────────────────────────────
function routeNote(input: Gen2026RoutedGeneralInput): string {
  if (input.severity === "critical") {
    return `${GEN2026_INJECTION_PURPOSE_LABEL[input.injectionPurpose]}를 위해 사용된 비급여 주사료는 약관상 3대비급여가 아니라 상해비급여·질병비급여에서 보상합니다(특별약관1 제3조(3)제2항). 일반 비급여 산식으로 계산했습니다.`;
  }
  return `비중증 ${GEN2026_SPECIAL_ITEM_LABEL[input.item]}는 약관상 별도 보장종목이 아니라 상해비급여·질병비급여에서 보상합니다(특별약관2 제3조 (1)제1항·(2)제1항 — 배제 대상은 비급여 자기공명영상진단뿐입니다). 일반 비급여 산식으로 계산했습니다.`;
}

/** ⚠ export하지 않는다. 위와 같은 이유다. */
function calculateRoutedGeneral2026(input: Gen2026RoutedGeneralInput, amounts: number[]): Gen2026RoutedGeneralResult {
  // ⚠ 통원 카운터는 축에 맞는 쪽만 넘긴다. 둘을 동시에 넘기면 calculateMany2026의
  //   교차 필드 가드에 걸린다(그리고 걸리는 것이 맞다).
  //   중증 = 연 100회(특약1), 비중증 = 연 100일(특약2).
  const base = calculateMany2026({
    cause: input.cause, coverage: "non_benefit", visit: input.visit, tier: input.tier,
    severity: input.severity, nonBenefitItem: "general",
    // ⚠ 검증을 통과한 배열을 넘긴다. 원본을 다시 읽지 않는다 — 하류 `calculateMany2026`이
    //   `normalizeAmount`로 각 원소를 한 번 더 읽으면 값이 달라지는 접근자에서 갈린다.
    amounts,
    priorAnnualInsurancePaid: input.priorAnnualInsurancePaid,
    annualCoverageLimit: input.annualCoverageLimit,
    outpatientCoverageLimit: input.outpatientCoverageLimit,
    priorAnnualDeductible: input.priorAnnualDeductible,
    ...(input.severity === "critical"
      ? { priorAnnualOutpatientVisits: input.priorAnnualOutpatientVisits }
      : { priorAnnualOutpatientDays: input.priorAnnualOutpatientDays }),
  });
  // ⚠ 계산 결과는 손대지 않는다. 차단된 결과에는 "계산했다"는 안내를 붙이지 않는다.
  if (base.status !== "OK") return { ...base, route: "general" };
  return { ...base, route: "general", notes: [routeNote(input), ...base.notes] };
}

// ─────────────────────────────────────────────────────────────────────
// 진입점 — route로 갈라 보낸다. 타입이 막는 조합을 런타임에서도 한 번 더 막는다.
// ─────────────────────────────────────────────────────────────────────
export function calculateGen2026Item(input: Gen2026ItemClaimInput): Gen2026ItemClaimResult {
  // 0) 상급병실료 차액은 축이 다르다(cause 필요, item 없음). 전용 엔진이 자체 검증까지 한다.
  if ((input as unknown as { route?: unknown }).route === "room_charge") {
    return calculateRoomCharge2026(input as Gen2026RoomChargeInput);
  }
  const rest = input as Exclude<Gen2026ItemClaimInput, Gen2026RoomChargeInput>;

  // 1) 값 검증이 먼저다. specOf()나 어떤 산식에도 닿기 전에 막는다.
  //   ⚠ 검증을 통과한 **행별 진료비**를 그대로 받아 아래 계산에 넘긴다. 본체가 입력을
  //     다시 읽지 않게 하기 위해서다(G-26).
  const checked = validateItemInput(rest);
  if ("route" in checked) return checked;

  // 2) 경로 대조는 `validateItemInput` 안에서 끝났다(G-29). 리터럴 네 축이 유효해지는
  //   즉시 대조해야 경로별 축(보상한 횟수·누적 공제금액·승인 구간 축)이 경로가 틀린
  //   입력에서 판정하거나 읽지 않는다. 여기 오는 입력은 `route`가 이미 확정된 것이다.

  // 3) 승인 구간 전용 축의 stray 차단 (G-28).
  //   ⚠ 종전에는 이 경로가 `priorAnnualTreatmentActCount`를 **조용히 폐기**했다. 검사가
  //     `special_item` 분기 안에만 있어서 `route: "general"`에는 닿지 않았다(실측: 값 `0`·`5`
  //     모두 결과가 미제공과 완전히 같았고 접근자 호출도 0회였다 — 결과가 같았던 이유는
  //     반영돼서가 아니라 **읽히지 않아서**다). 타입은 이미 `?: never`로 닫혀 있어
  //     리터럴 호출은 막혔지만, 변수 경유·외부 데이터는 타입을 우회한다.
  //   ⚠ 승인 구간은 (3)3대비급여의 **중증 근골격계에만** 있다. 일반 (1)(2)로 되돌아온 조합은
  //     일반 비급여 산식으로 계산하며 이 축을 소비하지 않는다. 값이 `0`이어도 막는다 —
  //     명시적으로 전달된 축이므로 형제 축(통원 카운터·`priorAnnualCoveredCount`)과 같은 계약이다.
  //   ⚠ **위치가 계약이다.** `validateItemInput`의 일반 분기 끝이 아니라 **2)의 경로 대조
  //     뒤**다. 처음에는 분기 끝에 두었는데, 그러면 `route: "general"`인데 실제로는 별도
  //     보장종목인 조합(예: 중증 `musculoskeletal_esw`)에서 기존 경로 불일치 안내보다
  //     이 안내가 먼저 나가고, 경로 불일치가 이미 확정된 입력에서 접근자까지 실행됐다.
  //     경로가 확정된 뒤에 읽으면 두 문제가 함께 사라진다 — 지급보험금(G-23)·진료비(G-26)이
  //     "그 축이 실제로 쓰이는 자리 앞에서 읽는다"로 세운 원칙과 같다.
  //   ⚠ 값을 **한 번만** 읽는다. 여기까지 오지 못한 입력에서는 읽지 않는다(접근자 0회 유지).
  //   ⚠ 안내는 올바른 입력 경로와 필드 역할만 말한다. 약관상 독립 소진 여부는 단정하지 않는다
  //     (GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY는 HOLD 그대로다).
  if (rest.route === "general") {
    const strayActs: unknown = (rest as { priorAnnualTreatmentActCount?: unknown }).priorAnnualTreatmentActCount;
    if (strayActs !== undefined) {
      return rejected("과거 치료행위 수(priorAnnualTreatmentActCount)는 중증 근골격계 이학요법·체외충격파의 보상 승인 구간 전용입니다. 이 조합은 일반 상해·질병 비급여 산식으로 계산하므로 쓰이지 않습니다 —", strayActs);
    }
  }

  // 4) 계산.
  return rest.route === "special_item"
    ? calculateSpecialItem2026(rest, checked)
    : calculateRoutedGeneral2026(rest, checked.amounts);
}
