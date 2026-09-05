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
import { normalizeAmount, settle } from "../common/settle";
import { GEN2026 } from "./constants";
import { calculateMany2026 } from "./multiClaim2026";
import {
  CAUSE_VALUES, SEVERITY_VALUES, TIER_VALUES, VISIT_VALUES, isNum, oneOf, rejected,
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

const nonNegInt = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

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

function validateItemInput(input: Exclude<Gen2026ItemClaimInput, Gen2026RoomChargeInput>): Gen2026RejectedResult | null {
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
  const covered = (raw as { priorAnnualCoveredCount?: unknown }).priorAnnualCoveredCount;
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
  const pool = (raw as { priorAnnualInpatientDeductible?: unknown }).priorAnnualInpatientDeductible;
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
    for (let i = 0; i < raw.lines.length; i++) {
      const line = raw.lines[i] as Record<string, unknown> | null;
      if (line === null || typeof line !== "object") return rejected(`${i + 1}번째 행`, line);
      if (!isNum(line.amount)) return rejected(`${i + 1}번째 행의 진료비(amount)`, line.amount);
      if (!oneOf(line.visit, VISIT_VALUES)) return rejected(`${i + 1}번째 행의 치료 형태(visit)`, line.visit);
      // tier는 조건부 필수다. 값이 실려 왔다면 그 값 자체는 반드시 유효해야 한다.
      if (line.tier !== undefined && !oneOf(line.tier, TIER_VALUES)) return rejected(`${i + 1}번째 행의 의료기관 종별(tier)`, line.tier);
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
    const approved = raw.approvedThroughVisit;
    if (approved !== undefined && !(typeof approved === "number" && (GEN2026_MSK_APPROVED_THROUGH_VALUES as readonly number[]).includes(approved))) {
      return rejected("보상 승인 회차(approvedThroughVisit)", approved);
    }
    return null;
  }

  if (!oneOf(raw.cause, CAUSE_VALUES)) return rejected("원인(cause)", raw.cause);
  if (!oneOf(raw.visit, VISIT_VALUES)) return rejected("치료 형태(visit)", raw.visit);
  if (raw.tier !== undefined && !oneOf(raw.tier, TIER_VALUES)) return rejected("의료기관 종별(tier)", raw.tier);
  if (!Array.isArray(raw.amounts) || !raw.amounts.every(isNum)) return rejected("진료비 목록(amounts)", raw.amounts);

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
  return null;
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
): Gen2026SpecialItemResult {
  let paid = nonNegInt(input.priorAnnualInsurancePaid);
  let count = nonNegInt(
    (input as { priorAnnualCoveredCount?: number }).priorAnnualCoveredCount,
  );
  let poolUsed = nonNegInt(
    (input as { priorAnnualInpatientDeductible?: number }).priorAnnualInpatientDeductible,
  );
  const lines: SpecialItemLineResult[] = [];

  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index] as Gen2026CriticalMriLine & { tier?: Tier };
    const amount = normalizeAmount(line.amount);
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
function calculateSpecialItem2026(input: Gen2026SpecialItemInput): Gen2026SpecialItemResult {
  const lines = input.lines ?? [];
  const totalAmount = lines.reduce((a, l) => a + normalizeAmount(l.amount), 0);
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
    const priorActs = (input as { priorAnnualTreatmentActCount?: number }).priorAnnualTreatmentActCount;
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
      + lines.filter((l) => normalizeAmount(l.amount) > 0).length;
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
  const counted = runOnce(input, spec, true);
  if (spec.annualVisits === null) return counted; // MRI는 횟수 한도가 없어 해석 차이가 없다
  const notCounted = runOnce(input, spec, false);
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
function calculateRoutedGeneral2026(input: Gen2026RoutedGeneralInput): Gen2026RoutedGeneralResult {
  // ⚠ 통원 카운터는 축에 맞는 쪽만 넘긴다. 둘을 동시에 넘기면 calculateMany2026의
  //   교차 필드 가드에 걸린다(그리고 걸리는 것이 맞다).
  //   중증 = 연 100회(특약1), 비중증 = 연 100일(특약2).
  const base = calculateMany2026({
    cause: input.cause, coverage: "non_benefit", visit: input.visit, tier: input.tier,
    severity: input.severity, nonBenefitItem: "general", amounts: input.amounts,
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
  const invalid = validateItemInput(rest);
  if (invalid !== null) return invalid;

  // 2) 경로 대조. 여기 오는 값은 모두 유효한 리터럴이다.
  const purpose = (rest as { injectionPurpose?: Gen2026InjectionPurpose }).injectionPurpose;
  const expected = routeOfGen2026Item(rest.severity, rest.item, purpose);
  if (expected === "missing_purpose") {
    return rejected(
      "비급여 주사료의 약제 용도(injectionPurpose)가 없어 보상 보장종목을 정할 수 없습니다(특별약관1 제3조(3)제2항) —",
      purpose,
    );
  }
  if (expected !== rest.route) {
    return rejected(
      `이 조합은 ${expected === "general" ? "일반 상해·질병 비급여" : "별도 보장종목"} 경로에서 계산해야 합니다. 요청된 경로(route)`,
      rest.route,
    );
  }

  // 3) 계산.
  return rest.route === "special_item"
    ? calculateSpecialItem2026(rest)
    : calculateRoutedGeneral2026(rest);
}
