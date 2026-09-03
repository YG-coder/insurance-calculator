"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import ResultCard from "@/components/ResultCard";
import { calculateMany2026 } from "@/lib/insurance/engine/multiClaim2026";
import {
  GEN2026_INJECTION_PURPOSE_LABEL, GEN2026_MSK_APPROVED_THROUGH_VALUES,
  GEN2026_SPECIAL_ITEM_LABEL, calculateGen2026Item, routeOfGen2026Item,
} from "@/lib/insurance/engine/specialItem2026";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { GEN2026 } from "@/lib/insurance/engine/constants";
import {
  Cause, Coverage, Gen2026CriticalExceptionalInjectionInput, Gen2026CriticalMriLine,
  Gen2026InjectionPurpose, Gen2026ItemClaimResult, Gen2026NonCriticalInjectionInput,
  Gen2026NonCriticalMskInput,
  Gen2026MskApprovedThrough, Gen2026NonBenefitItem, Gen2026SpecialItem, Gen2026SpecialLine,
  Severity, Tier, Visit,
} from "@/lib/insurance/engine/types";
import { GEN2026_NON_BENEFIT_ITEM_LABEL } from "@/lib/insurance/engine/generation2026";

// ⚠ 기본 선택 없음. 단건 계산기와 같은 정책이다.
const NON_BENEFIT_ITEMS: Gen2026NonBenefitItem[] = [
  "general", "musculoskeletal_esw", "injection", "mri", "room_charge",
];
const INJECTION_PURPOSES: Gen2026InjectionPurpose[] = ["general", "anticancer", "antibiotic", "orphan_drug"];

const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;
const smallButton = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40";

/** 특별약관 입력 행. 1행 = 약관상 공제 적용 단위 1개. */
interface SpecialRow { amount: string; visit: Visit | ""; tier: Tier | "" }
const emptyRow = (): SpecialRow => ({ amount: "", visit: "", tier: "" });

/** 상급병실료 차액 입력 행. 1행 = 약관상 1회의 입원. */
interface RoomChargeRow { amount: string; days: string }
/** 총 입원일수는 약관에 산정 방법이 없다. 양의 정수만 받고 추정하지 않는다. */
const positiveDays = (v: string): number | null => {
  const t = v.trim();
  return /^[0-9]+$/.test(t) && Number(t) > 0 ? Number(t) : null;
};
/**
 * 상급병실료 차액 금액 전용 파서. **원문 문자열을 형식으로 먼저 판정한다.**
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. `num()`은 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-100` → `100`, `abc`·빈 값·`1.2.3`·`Infinity` → `0`이 되어, 엔진의 엄격한 런타임 검증에
 *   닿기 전에 UI가 없는 값을 만들어 낸다. 이 경로는 "NaN을 조용히 0으로 계산하지 않는다"가
 *   구현 원칙이므로 문자열을 **변형하지 않고 그대로 판정**한다.
 *
 * ⚠ 쉼표를 먼저 지우고 검사해도 같은 종류의 변형이 된다 — `1,2`→12, `1,,000`→1000,
 *   `,100`·`100,`→100, `12,34,567`→1234567처럼 잘못된 입력이 정상 금액이 되어 버린다.
 *   그래서 **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `100`, `1000`) 또는 정확한 천 단위 구분
 *   (`1,000`, `12,345`, `1,234,567`). **명시적으로 입력한 `0`은 유효값**이다.
 * 무효(null = 불완전 입력): 빈 값·공백, 부호(`-`/`+`), 문자, `Infinity`·`NaN`,
 *   소수(`1.5`·`.5`·`1.`— 원 단위라 허용하지 않는다), 지수 표기(`1e6`),
 *   잘못된 쉼표 형식, 안전 정수 범위(2^53−1) 초과.
 */
const ROOM_CHARGE_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
/**
 * 비중증 통원 '이미 사용한 통원일수' 전용 파서.
 *   0 이상의 안전 정수만 허용한다. 공백·부호·소수·문자·지수 표기·안전 정수 초과는 null이며,
 *   **제거·절삭·0으로의 변형을 하지 않는다.** 100을 넘는 값도 유효한 과거 상태로 받는다.
 */
const OUTPATIENT_DAYS_FORMAT = /^[0-9]+$/;
const outpatientDays = (v: string): number | null => {
  if (!OUTPATIENT_DAYS_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

const roomChargeAmount = (v: string): number | null => {
  if (!ROOM_CHARGE_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

export default function HealthCalcMulti2026() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  // "" = 미선택. 일반 (1)(2)는 제5조①이 상해·질병 각 축으로 가입금액과 누적을 나누므로,
  //   원인을 고르지 않은 채 계산하면 사용자가 인식하지 못한 채 한쪽 축으로 계산된다.
  //   ⚠ 별도 보장종목은 상해·질병 합산이라 이 입력을 노출하지도, 요구하지도 않는다.
  const [cause, setCause] = useState<Cause | "">("");
  // 급여는 원인이 산식에 영향을 주지 않고 결과 안내 문구에만 쓰인다. 종전 동작을 그대로 둔다
  //   — 이번 변경으로 급여 사용자에게 새 선택을 강제하지 않기 위해서다.
  const [benefitCause, setBenefitCause] = useState<Cause>("disease");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  // "" = 미선택. 단건 계산기와 같은 정책 — 기본값을 두면 사용자가 인식하지 못한 채
  //   중증으로 계산되고, 중증/비중증은 자기부담률(30% vs 50%)과 한도가 크게 다르다.
  const [severity, setSeverity] = useState<Severity | "">("");
  // "" = 미선택. 고르기 전에는 계산하지 않는다.
  const [nonBenefitItem, setNonBenefitItem] = useState<Gen2026NonBenefitItem | "">("");
  // "" = 미선택. 약제 용도가 보상하는 보장종목을 바꾼다(특약1 제3조(3)②).
  const [injectionPurpose, setInjectionPurpose] = useState<Gen2026InjectionPurpose | "">("");
  // 급여 통원의 의료기관 종별. 종전부터 기본값이 있었고 이번에 바꾸지 않는다.
  const [benefitTier, setBenefitTier] = useState<Tier>("clinic");
  // 비급여 **입원**의 의료기관 종별. ⚠ 기본값을 두지 않는다.
  //   중증은 공제금액 상한 500만원(특약1 제5조⑤), 비중증은 1회당 300만원 한도(특약2 제3조 (1)①·(2)①)가
  //   종별에 따라 갈린다. 자동 선택되면 사용자가 인식하지 못한 채 한쪽으로 계산된다.
  const [nbInpatientTier, setNbInpatientTier] = useState<Tier | "">("");
  const [nhisRate, setNhisRate] = useState("");
  const [priorInsurance, setPriorInsurance] = useState("0");
  const [priorDeductible, setPriorDeductible] = useState("0");
  const [outpatientLimit, setOutpatientLimit] = useState("");
  const [priorVisits, setPriorVisits] = useState("0");
  // ⚠ 기본값 없음. 0으로 추정하면 사용자가 인식하지 못한 채 "이전 통원 없음"으로 계산된다.
  const [priorOutDays, setPriorOutDays] = useState("");
  const [annualLimit, setAnnualLimit] = useState("");
  const [copyCount, setCopyCount] = useState("3");
  // 특별약관 전용 입력
  const [rows, setRows] = useState<SpecialRow[]>([emptyRow(), emptyRow()]);
  // 상급병실료 차액 — 1행 = 1회 입원. 입원일수는 기본 빈 값(추정하지 않는다).
  const [rcRows, setRcRows] = useState<RoomChargeRow[]>([{ amount: "", days: "" }]);
  const [approvedThrough, setApprovedThrough] = useState<Gen2026MskApprovedThrough>(
    GEN2026_MSK_APPROVED_THROUGH_VALUES[0],
  );
  const [priorCount, setPriorCount] = useState("0");
  // ⚠ 기본값 없음. 승인 구간은 '치료횟수' 축이고 '보상한 횟수'로 대신 셀 수 없다.
  //   미입력을 0으로 추정하면 승인 경계를 넘겼는지 모르는 채 보험금을 계산하게 된다.
  const [priorActs, setPriorActs] = useState("");
  const [priorPool, setPriorPool] = useState("0");
  const [submitted, setSubmitted] = useState(false);

  const isSpecialItem = nonBenefitItem === "musculoskeletal_esw" || nonBenefitItem === "injection" || nonBenefitItem === "mri";
  const specialItem = isSpecialItem ? (nonBenefitItem as Gen2026SpecialItem) : null;
  const needsItem = coverage === "non_benefit" && nonBenefitItem === "";
  const isRoomCharge = nonBenefitItem === "room_charge";
  // 상급병실료도 질환 구분이 필요하다 — 산식은 같지만 연간 가입금액 축(중증 5천만·비중증 1천만)이 다르다.
  const needsSeverity = coverage === "non_benefit" && nonBenefitItem !== "" && severity === "";

  // 경로 판정은 엔진과 같은 함수를 쓴다. 화면과 계산이 다른 판단을 하지 않게 한다.
  const route = specialItem !== null && severity !== ""
    ? routeOfGen2026Item(severity, specialItem, injectionPurpose === "" ? undefined : injectionPurpose)
    : null;
  const needsPurpose = route === "missing_purpose";
  const showSpecialForm = route === "special_item";
  const showGeneralForm = coverage === "non_benefit" && (nonBenefitItem === "general" || route === "general");
  // 일반 (1)(2)로 계산되는 조합에서만 원인이 필요하다. 별도 보장종목·급여에는 요구하지 않는다.
  //
  // 상급병실료는 (3) 별도 보장종목이 아니라 (1)(2) 표 안의 행이라 질환 구분과 원인이 모두 필요하다.
  //   화면 순서를 강제한다: ①치료유형 → ②질환 구분 → ③원인 → ④입력 폼.
  //   ⚠ 질환 구분 선택창을 상급병실료에서 숨기면 안내만 뜨고 고를 수단이 없어 진행이 막힌다.
  const showRoomChargeCause = isRoomCharge && severity !== "";
  const showRoomChargeForm = showRoomChargeCause && cause !== "";
  const needsCause = (showGeneralForm || showRoomChargeCause) && severity !== "" && cause === "";
  // 차액 총액·입원일수 어느 쪽이든 유효하지 않으면 계산하지 않는다.
  //   금액: 빈 값·음수·문자·Infinity·잘못된 소수는 불완전(명시적 0은 유효).
  //   일수: 0·음수·소수·빈 값은 불완전.
  const rcIncomplete = showRoomChargeForm
    && rcRows.some((r) => roomChargeAmount(r.amount) === null || positiveDays(r.days) === null);
  // 중증 근골격계는 보상 승인 회차 판정에 '과거 치료행위 수'가 필요하다(<표1> 주)).
  //   확인된 0회와 미입력을 구분한다 — 0은 유효값이고 빈 값이면 계산하지 않는다.
  const needsPriorActs = coverage === "non_benefit" && severity === "critical"
    && specialItem === "musculoskeletal_esw" && route === "special_item"
    && outpatientDays(priorActs) === null;
  // 비중증 통원은 연 100일 한도가 걸리므로 이미 사용한 일수를 알아야 계산할 수 있다.
  //   빈 값을 0으로 추정하지 않는다 — 한도가 통째로 사라져 보험금이 과다 산출된다.
  const needsOutDays = coverage === "non_benefit" && (nonBenefitItem === "general" || route === "general")
    && severity === "non_critical" && visit === "outpatient" && outpatientDays(priorOutDays) === null;
  // 일반 비급여 입원은 종별을 고르기 전에는 계산하지 않는다(중증·비중증 모두).
  const needsTier = showGeneralForm && severity !== "" && visit === "inpatient" && nbInpatientTier === "";
  // 중증 MRI 입원 행은 의료기관 종별이 조건부 필수다(제5조⑤ pool 판정).
  const needsRowTier = showSpecialForm && severity === "critical" && specialItem === "mri";
  const rowsIncomplete = showSpecialForm && rows.some((r) => r.visit === "" || (needsRowTier && r.visit === "inpatient" && r.tier === ""));

  const specialLines: Gen2026SpecialLine[] = rows.map((r) => ({ amount: num(r.amount), visit: r.visit as Visit }));
  const mriLines: Gen2026CriticalMriLine[] = rows.map((r) => r.visit === "inpatient"
    ? { amount: num(r.amount), visit: "inpatient", tier: r.tier as Tier }
    : { amount: num(r.amount), visit: "outpatient" });

  // ── 별도 보장종목 / 일반 경로 전환 ──────────────────────────────────
  //   판별 유니온이라 잘못된 조합은 여기서 컴파일되지 않는다.
  let itemResult: Gen2026ItemClaimResult | null = null;
  if (coverage === "non_benefit" && specialItem !== null && severity !== "" && !rowsIncomplete
      && !needsPriorActs
      && !(route === "general" && (cause === "" || (visit === "inpatient" && nbInpatientTier === "") || needsOutDays))) {
    const generalCommon = {
      route: "general" as const, coverage: "non_benefit" as const, cause: cause as Cause, visit,
      // ⚠ 빈 값을 Tier로 단언하지 않는다. 아래 게이트가 미선택을 이미 배제한다.
      tier: visit === "inpatient" ? nbInpatientTier || undefined : undefined,
      amounts: amounts.map(num),
      priorAnnualInsurancePaid: num(priorInsurance),
      annualCoverageLimit: annualLimit !== "" ? num(annualLimit) : undefined,
      outpatientCoverageLimit: visit === "outpatient" && outpatientLimit !== "" ? num(outpatientLimit) : undefined,
      priorAnnualDeductible: severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" ? num(priorDeductible) : undefined,
    };
    // ⚠ 통원 카운터는 generalCommon에 넣지 않는다. 스프레드로 실으면 축이 다른 분기에도
    //   같은 필드가 따라 들어가고, 초과 필드는 타입 검사에서 드러나지 않는다.
    //   각 분기에서 쓰는 쪽만 실어 보낸다.
    const outVisits = visit === "outpatient" ? num(priorVisits) : undefined;         // 중증 = 회
    const outDays = visit === "outpatient" ? outpatientDays(priorOutDays) ?? undefined : undefined; // 비중증 = 일
    if (severity === "critical") {
      if (specialItem === "musculoskeletal_esw") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "musculoskeletal_esw", lines: specialLines,
          approvedThroughVisit: approvedThrough,
          // ⚠ 두 축을 서로 대신 쓰지 않는다. 위는 연 50회 한도, 아래는 승인 구간용이다.
          priorAnnualCoveredCount: num(priorCount),
          priorAnnualTreatmentActCount: outpatientDays(priorActs) ?? undefined,
          priorAnnualInsurancePaid: num(priorInsurance),
        });
      } else if (specialItem === "mri") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "mri", lines: mriLines,
          priorAnnualInpatientDeductible: num(priorPool),
          priorAnnualInsurancePaid: num(priorInsurance),
        });
      } else if (injectionPurpose === "general") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "injection", injectionPurpose: "general", lines: specialLines,
          priorAnnualCoveredCount: num(priorCount),
          priorAnnualInsurancePaid: num(priorInsurance),
        });
      } else if (injectionPurpose !== "") {
        itemResult = calculateGen2026Item({
          ...generalCommon, severity: "critical", item: "injection", injectionPurpose,
          priorAnnualOutpatientVisits: outVisits,
        } satisfies Gen2026CriticalExceptionalInjectionInput);
      }
    } else if (specialItem === "mri") {
      itemResult = calculateGen2026Item({
        route: "special_item", coverage: "non_benefit", severity: "non_critical",
        item: "mri", lines: specialLines,
        priorAnnualInsurancePaid: num(priorInsurance),
      });
    } else if (specialItem === "injection") {
      itemResult = calculateGen2026Item({
        ...generalCommon, severity: "non_critical", item: "injection",
        priorAnnualOutpatientDays: outDays,
      } satisfies Gen2026NonCriticalInjectionInput);
    } else if (specialItem === "musculoskeletal_esw") {
      itemResult = calculateGen2026Item({
        ...generalCommon, severity: "non_critical", item: "musculoskeletal_esw",
        priorAnnualOutpatientDays: outDays,
      } satisfies Gen2026NonCriticalMskInput);
    }
  }

  // ── 상급병실료 차액 ─────────────────────────────────────────────────
  let roomResult: Gen2026ItemClaimResult | null = null;
  // showRoomChargeForm이 이미 질환 구분·원인 선택을 포함한다(TS도 cause를 Cause로 좁힌다).
  if (showRoomChargeForm && !rcIncomplete) {
    roomResult = calculateGen2026Item({
      route: "room_charge", coverage: "non_benefit", cause, severity,
      stays: rcRows.map((r) => ({
        roomChargeTotal: roomChargeAmount(r.amount) as number,
        inpatientDays: positiveDays(r.days) as number,
      })),
      priorAnnualInsurancePaid: num(priorInsurance),
      annualCoverageLimit: annualLimit !== "" ? num(annualLimit) : undefined,
    });
  }

  // ── 급여 / 일반 비급여 ──────────────────────────────────────────────
  const plainResult = coverage === "benefit"
    ? calculateMany2026({
        cause: benefitCause, coverage: "benefit", visit, tier: benefitTier,
        nhisCoinsuranceRate: visit === "outpatient" && nhisRate !== "" ? Math.min(100, num(nhisRate)) / 100 : undefined,
        amounts: amounts.map(num),
      })
    : nonBenefitItem === "general" && severity !== "" && cause !== "" && !needsTier && !needsOutDays
      ? calculateMany2026({
          cause, coverage: "non_benefit", visit, severity, nonBenefitItem: "general",
          tier: visit === "inpatient" ? nbInpatientTier || undefined : undefined,
          amounts: amounts.map(num),
          priorAnnualInsurancePaid: num(priorInsurance),
          priorAnnualDeductible: severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" ? num(priorDeductible) : undefined,
          outpatientCoverageLimit: visit === "outpatient" && outpatientLimit !== "" ? num(outpatientLimit) : undefined,
          priorAnnualOutpatientVisits: severity === "critical" && visit === "outpatient" ? num(priorVisits) : undefined,
          priorAnnualOutpatientDays: severity === "non_critical" && visit === "outpatient"
            ? outpatientDays(priorOutDays) ?? undefined : undefined,
          annualCoverageLimit: annualLimit !== "" ? num(annualLimit) : undefined,
        })
      : null;

  const result: Gen2026ItemClaimResult | ReturnType<typeof calculateMany2026> | null =
    itemResult ?? roomResult ?? plainResult;
  // ⚠ 타입 단언 없이 route로만 좁힌다.
  const special = itemResult !== null && itemResult.route === "special_item" ? itemResult : null;
  const room = roomResult !== null && roomResult.route === "room_charge" ? roomResult : null;

  const setRow = (i: number, patch: Partial<SpecialRow>) =>
    setRows((old) => old.map((r, j) => j === i ? { ...r, ...patch } : r));
  const setRcRow = (i: number, patch: Partial<RoomChargeRow>) =>
    setRcRows((old) => old.map((r, j) => j === i ? { ...r, ...patch } : r));

  return <div className="card mt-8">
    <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
    <p className="mt-2 text-sm text-slate-600">연간 한도와 공제금액 상한을 건 사이에 이어서 계산합니다. 연간 기준은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b>입니다.</p>
    <p className="mt-2 text-sm text-slate-600">일반 비급여의 연간 보험가입금액은 약관상 <b>상해비급여·질병비급여 각각에 대해 따로</b> 정해집니다. 입력한 모든 행과 기존 지급보험금·누적 공제금액이 <b>같은 원인 보장축</b>의 것이어야 하며, 다른 원인의 청구는 따로 계산해 주세요. 반면 <b>별도 보장종목</b>(3대비급여·비중증 MRI)의 한도는 상해와 질병을 <b>합산</b>하므로 원인을 나누지 않습니다.</p>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {coverage === "benefit" && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={benefitCause} onChange={(e) => setBenefitCause(e.target.value as Cause)}><option value="disease">질병</option><option value="injury">상해</option></select></label>}
      {(showGeneralForm || showRoomChargeCause) && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={cause} onChange={(e) => setCause(e.target.value as Cause | "")}><option value="">선택해 주세요</option><option value="disease">질병</option><option value="injury">상해</option></select></label>}
      <label className="text-sm font-semibold">급여 구분<select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)}><option value="benefit">급여</option><option value="non_benefit">비급여</option></select></label>
      {!showSpecialForm && !isRoomCharge && <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>}
      {coverage === "non_benefit" && <label className="text-sm font-semibold">치료유형<select className="input-base mt-1" value={nonBenefitItem} onChange={(e) => setNonBenefitItem(e.target.value as Gen2026NonBenefitItem | "")}><option value="">선택해 주세요</option>{NON_BENEFIT_ITEMS.map((it) => <option key={it} value={it}>{GEN2026_NON_BENEFIT_ITEM_LABEL[it]}</option>)}</select></label>}
      {coverage === "non_benefit" && nonBenefitItem !== "" && <label className="text-sm font-semibold">질환 구분<select className="input-base mt-1" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}><option value="">선택해 주세요</option><option value="critical">중증</option><option value="non_critical">비중증</option></select></label>}
      {coverage === "non_benefit" && nonBenefitItem === "injection" && severity === "critical" && <label className="text-sm font-semibold">약제 용도<select className="input-base mt-1" value={injectionPurpose} onChange={(e) => setInjectionPurpose(e.target.value as Gen2026InjectionPurpose | "")}><option value="">선택해 주세요</option>{INJECTION_PURPOSES.map((p) => <option key={p} value={p}>{GEN2026_INJECTION_PURPOSE_LABEL[p]}</option>)}</select></label>}
      {coverage === "benefit" && visit === "outpatient" && <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={benefitTier} onChange={(e) => setBenefitTier(e.target.value as Tier)}><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
      {showGeneralForm && severity !== "" && visit === "inpatient" && <label className="text-sm font-semibold">입원 의료기관<select className="input-base mt-1" value={nbInpatientTier} onChange={(e) => setNbInpatientTier(e.target.value as Tier | "")}><option value="">선택해 주세요</option><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
      {showSpecialForm && specialItem === "musculoskeletal_esw" && <label className="text-sm font-semibold">보상 승인 회차<select className="input-base mt-1" value={approvedThrough} onChange={(e) => setApprovedThrough(Number(e.target.value) as Gen2026MskApprovedThrough)}>{GEN2026_MSK_APPROVED_THROUGH_VALUES.map((v) => <option key={v} value={v}>{v}회까지</option>)}</select></label>}
    </div>

    {coverage === "benefit" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">건강보험 본인부담률 (%)<input className="input-base mt-1" type="number" min="0" max="100" step="0.1" value={nhisRate} onChange={(e) => setNhisRate(e.target.value)} /></label>}

    {coverage === "non_benefit" && <div className="mt-4"><NoticeBox variant="info">5세대 비급여는 보장종목이 나뉘어 있습니다. <b>중증</b>의 근골격계 이학요법·체외충격파, 비급여 주사료(일반 주사), 비급여 MRI는 특별약관1 (3)3대비급여이고, <b>비중증</b>의 비급여 MRI는 특별약관2 (3)의 별도 보장종목입니다. 반대로 <b>비중증</b> 근골격계·주사료와 항암제·항생제(항진균제 포함)·희귀의약품을 위한 <b>중증</b> 주사료는 약관이 일반 상해·질병 비급여에서 보상합니다. <b>상급병실료 차액</b>은 같은 표의 별도 행이라 <b>차액의 50%·1일 평균 보험금 10만 원 한도</b>로 따로 계산합니다.</NoticeBox></div>}
    {isRoomCharge && <div className="mt-4"><NoticeBox variant="info">입력할 금액은 전체 병실료가 아니라 <b>실제 사용 병실과 기준병실의 비급여 차액</b>입니다(특별약관1 제2조). 약관의 입원 보상금액은 &lsquo;비급여 의료비(<b>비급여 병실료는 제외</b>합니다)&rsquo;이므로 <b>일반 입원 의료비와 합쳐 넣지 마세요</b>. <b>1행은 1회의 입원</b>이며, 보험금은 차액의 <b>50%</b>이고 <b>1일 평균 보험금 10만 원</b>이 한도입니다.</NoticeBox></div>}
    {showRoomChargeForm && <div className="mt-4"><NoticeBox variant="info">연간 보험가입금액은 약관상 <b>상해비급여·질병비급여 각각</b>, <b>중증·비중증 보장축별로</b> 계약 시 정한 금액입니다(특별약관1·2 제5조 제1항). 상급병실료 차액은 일반 입원·통원 보상금액과 <b>같은 한도를 나눠 씁니다</b>. 병실 변경·부분일·외박·복수 병원 입원의 일수 판단은 약관에 정의가 없어 계산기가 하지 않습니다. 계약 종료 후 180일 계속 입원과 공제금액 상한 500만 원은 이 계산에 반영하지 않았습니다.</NoticeBox></div>}
    {route === "general" && <div className="mt-4"><NoticeBox variant="info">{severity === "critical" ? "항암제·항생제(항진균제 포함)·희귀의약품을 위해 사용된 비급여 주사료는 약관상 3대비급여가 아니라 상해비급여·질병비급여에서 보상합니다(특별약관1 제3조(3)제2항). 일반 비급여 입력으로 전환했습니다." : `비중증 ${GEN2026_SPECIAL_ITEM_LABEL[specialItem ?? "injection"]}는 약관상 별도 보장종목이 아니라 상해비급여·질병비급여에서 보상합니다(특별약관2 제3조 (1)제1항·(2)제1항 — 배제 대상은 비급여 자기공명영상진단뿐입니다). 일반 비급여 입력으로 전환했습니다.`}</NoticeBox></div>}

    {/* ── 일반 비급여 입력 (일반 비급여 + 일반 경로로 전환된 조합) ── */}
    {showGeneralForm && severity !== "" && visit === "outpatient" && <div className="mt-4"><NoticeBox variant="info">{severity === "non_critical" ? "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 청구는 한 행으로 합쳐 입력해 주세요." : "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 한 행으로 합쳐 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 행을 나눠 입력합니다."}</NoticeBox></div>}
    {showGeneralForm && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">통원 가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={outpatientLimit} onChange={(e) => setOutpatientLimit(e.target.value)} placeholder="예: 200000 — 모르면 비워두세요" /><span className="mt-2 block text-xs font-normal text-slate-500">약관상 20만 원 이내에서 계약 시 정한 금액입니다(중증 1회당·비중증 1일당). 입력하지 않으면 적용하지 않습니다.</span></label>}
    {showGeneralForm && severity !== "" && <label className="mt-4 block max-w-sm text-sm font-semibold">연간 보험가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} placeholder={severity === "critical" ? "예: 50000000 — 모르면 비워두세요" : "예: 10000000 — 모르면 비워두세요"} /><span className="mt-2 block text-xs font-normal text-slate-500">약관은 {severity === "critical" ? "5천만" : "1천만"} 원 <b>이내에서 계약 시 정한 금액</b>으로 규정하며, 상해비급여·질병비급여 각각에 대해 따로 정해집니다. 입력하지 않으면 적용하지 않습니다.</span></label>}
    {showGeneralForm && severity === "non_critical" && visit === "inpatient" && <div className="mt-4"><NoticeBox variant="info">비중증 입원의 <b>1회당 300만 원 한도</b>는 「의료법」 제3조제2항 의료기관 중 <b>종합병원을 제외한 곳</b>(병·의원급)에서 발생한 비급여 의료비에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항). 상급종합·종합병원 입원에는 적용하지 않습니다.</NoticeBox></div>}
    {showGeneralForm && severity === "critical" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">이미 사용한 통원 횟수 (선택)<input className="input-base mt-1" type="number" min="0" value={priorVisits} onChange={(e) => setPriorVisits(e.target.value)} /><span className="mt-2 block text-xs font-normal text-slate-500">중증 통원은 계약해당일 기준 1년간 100회가 한도입니다.</span></label>}
    {showGeneralForm && severity === "non_critical" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">계약해당일 기준 1년간 이미 사용한 통원일수<input className="input-base mt-1" inputMode="numeric" value={priorOutDays} onChange={(e) => setPriorOutDays(e.target.value)} placeholder="이전 통원이 없으면 0" /><span className="mt-2 block text-xs font-normal text-slate-500">비중증 통원은 약관상 <b>계약일 또는 매년 계약해당일부터 1년간 통원 {GEN2026.nonBenefit.nonCritical.outpatientAnnualDays}일</b>이 한도입니다(특별약관2 제3조 (1)제1항·(2)제1항). 보상 단위가 <b>통원 1일당</b>이므로, 같은 날 외래와 처방·조제비는 <b>한 행으로 합쳐</b> 입력해 주세요. 같은 날을 여러 행으로 나누면 일수가 실제보다 빨리 소진됩니다.</span></label>}

    {/* ── 특별약관 입력 안내 ── */}
    {showSpecialForm && specialItem !== null && <div className="mt-4"><NoticeBox variant="info">{specialItem === "injection"
      ? "비급여 주사료는 1회 통원(또는 1회 입원)에서 2회 이상 주사치료를 받아도 1회로 봅니다(특별약관1 제3조(3)제4항제2호). 같은 1회 안의 주사료는 합산해 한 행에 입력해 주세요."
      : specialItem === "musculoskeletal_esw"
        ? "근골격계 이학요법·체외충격파는 치료행위마다 공제금액과 한도를 각각 적용합니다(특별약관1 제3조(3)제4항제1호). 2종류 이상을 받았거나 같은 치료를 2회 이상 받았다면 행을 나눠 입력해 주세요."
        : "비급여 MRI는 진단행위마다 공제금액과 한도를 각각 적용합니다(제3조(3)제4항제3호 / 특별약관2 제3조(3)제3항). 2개 이상 부위를 촬영했거나 같은 부위를 2회 이상 촬영했다면 행을 나눠 입력해 주세요."}</NoticeBox></div>}
    {showSpecialForm && specialItem === "musculoskeletal_esw" && <div className="mt-4"><NoticeBox variant="info">약관은 각 치료횟수를 합산해 <b>최초 10회</b>를 보장하고, 이후에는 증상의 개선·병변호전 등이 확인된 경우에 한하여 <b>10회 단위</b>로 연간 50회까지 보상합니다(특별약관1 제3조(3)제1항 &lt;표1&gt; 주)). 이 계산기는 증상 개선 여부를 판정하지 않습니다. 보험사에서 확인된 승인 회차를 선택해 주세요.</NoticeBox></div>}

    {/* ── 입력 행 ── */}
    {showRoomChargeForm
      ? <>
        <div className="mt-5 space-y-3">{rcRows.map((row, i) => <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4" key={i}>
          <label className="text-sm font-semibold">{i + 1}번째 입원의 상급병실료 차액 총액<input className="input-base mt-1" inputMode="numeric" value={row.amount} onChange={(e) => setRcRow(i, { amount: e.target.value })} /></label>
          <label className="text-sm font-semibold">총 입원일수<input className="input-base mt-1" inputMode="numeric" value={row.days} onChange={(e) => setRcRow(i, { days: e.target.value })} placeholder="예: 10" /></label>
          <span />
          <button className={smallButton} disabled={rcRows.length === 1} onClick={() => setRcRows((old) => old.filter((_, j) => j !== i))}>삭제</button>
        </div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setRcRows((old) => [...old, { amount: "", days: "" }])}>입원 추가</button></div>
      </>
      : showSpecialForm
      ? <>
        <div className="mt-5 space-y-3">{rows.map((row, i) => <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4" key={i}>
          <label className="text-sm font-semibold">{i + 1}번째 {specialItem === "injection" ? "1회 주사료 합산액" : "행위 진료비"}<input className="input-base mt-1" inputMode="numeric" value={row.amount} onChange={(e) => setRow(i, { amount: e.target.value })} /></label>
          <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={row.visit} onChange={(e) => setRow(i, { visit: e.target.value as Visit | "" })}><option value="">선택</option><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>
          {needsRowTier && row.visit === "inpatient"
            ? <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={row.tier} onChange={(e) => setRow(i, { tier: e.target.value as Tier | "" })}><option value="">선택</option><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>
            : <span />}
          <button className={smallButton} disabled={rows.length === 1} onClick={() => setRows((old) => old.filter((_, j) => j !== i))}>삭제</button>
        </div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setRows((old) => [...old, emptyRow()])}>행 추가</button></div>
      </>
      : <>
        <div className="mt-5 space-y-3">{amounts.map((amount, i) => <div className="flex items-end gap-2" key={i}><label className="flex-1 text-sm font-semibold">{i + 1}건 진료비<input className="input-base mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmounts((old) => old.map((v, j) => j === i ? e.target.value : v))} /></label><button className={smallButton} disabled={amounts.length === 1} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))}>삭제</button></div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button><input className="input-base w-20" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" /><button className={smallButton} onClick={() => setAmounts(Array.from({ length: Math.max(1, Math.min(100, Math.floor(num(copyCount)))) }, () => amounts[0] ?? ""))}>첫 금액 × N회</button></div>
      </>}

    {/* ── 누적 입력 ── */}
    {showGeneralForm && severity !== "" && <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">계약해당일 기준 1년간 기존 지급보험금<input className="input-base mt-1" inputMode="numeric" value={priorInsurance} onChange={(e) => setPriorInsurance(e.target.value)} /></label>{severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액<input className="input-base mt-1" inputMode="numeric" value={priorDeductible} onChange={(e) => setPriorDeductible(e.target.value)} /></label>}<p className="text-xs text-slate-500 sm:col-span-2">연간 한도와 공제금액 상한은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b> 단위로 누적됩니다(표준약관 특별약관1·2 제5조 제2항). 역년 기준이 아닙니다. 500만 원 상한에 누적되는 것은 약관상 <b>공제금액</b>이며, 보험가입금액 한도로 추가 부담한 금액은 포함되지 않습니다.</p></div>}
    {showRoomChargeForm && <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">계약해당일 기준 1년간 기존 지급보험금 (선택)<input className="input-base mt-1" inputMode="numeric" value={priorInsurance} onChange={(e) => setPriorInsurance(e.target.value)} /></label>
      <label className="text-sm font-semibold">연간 보험가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} placeholder={severity === "critical" ? "예: 50000000 — 모르면 비워두세요" : "예: 10000000 — 모르면 비워두세요"} /></label>
      <p className="text-xs text-slate-500 sm:col-span-2">약관은 {severity === "critical" ? "5천만" : "1천만"} 원 <b>이내에서 계약 시 정한 금액</b>으로 규정합니다. 입력하지 않으면 적용하지 않습니다. 기존 지급보험금에는 같은 축의 <b>일반 입원·통원 보험금</b>도 포함해 주세요.</p>
    </div>}
    {showSpecialForm && <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">계약해당일 기준 1년간 이 보장종목의 기존 지급보험금<input className="input-base mt-1" inputMode="numeric" value={priorInsurance} onChange={(e) => setPriorInsurance(e.target.value)} /></label>
      {(specialItem === "musculoskeletal_esw" || specialItem === "injection") && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 <b>보상한 횟수</b> (연 50회 한도용)<input className="input-base mt-1" type="number" min="0" value={priorCount} onChange={(e) => setPriorCount(e.target.value)} /></label>}
      {specialItem === "musculoskeletal_esw" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 받은 <b>치료행위 수</b> (보상 승인 회차용)<input className="input-base mt-1" inputMode="numeric" value={priorActs} onChange={(e) => setPriorActs(e.target.value)} placeholder="받은 치료가 없으면 0" /><span className="mt-2 block text-xs font-normal text-slate-500">약관은 보상 승인 회차를 <b>&lsquo;각 치료횟수&rsquo;</b>로 셉니다(&lt;표1&gt; 주)). 위의 <b>보상한 횟수</b>는 보험금이 지급된 횟수라, 공제금액에 못 미쳐 <b>0원이 지급된 치료</b>가 있으면 두 값이 달라집니다. 보험사에서 확인한 값을 입력해 주세요.</span></label>}
      {needsRowTier && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액 (500만 원 상한)<input className="input-base mt-1" inputMode="numeric" value={priorPool} onChange={(e) => setPriorPool(e.target.value)} /></label>}
      <p className="text-xs text-slate-500 sm:col-span-2">약관은 연간 보장한도(금액)에서 <b>지급한 금액</b>을, 연간 보장한도(횟수)에서 <b>보상한 횟수</b>를 차감합니다(특별약관1 제3조(3)제7항·제5조 제4항). 일반 비급여의 통원 가입금액(20만 원)과 연간 보험가입금액은 이 보장종목에 적용되지 않습니다.</p>
    </div>}

    <button className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>
    {submitted && needsItem && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>치료유형</b>에 따라 적용되는 보장종목과 산식이 다릅니다. 치료유형을 먼저 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsSeverity && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsPurpose && <div className="mt-5"><NoticeBox variant="warning">비급여 주사료는 <b>약제 용도</b>에 따라 보상하는 보장종목이 달라집니다(특별약관1 제3조(3)제2항). 약제 용도를 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && rcIncomplete && <div className="mt-5"><NoticeBox variant="warning">각 입원의 <b>차액 총액</b>과 <b>총 입원일수</b>를 올바르게 입력해 주세요. 차액 총액은 <b>0 이상의 숫자</b>, 총 입원일수는 <b>1 이상의 정수</b>여야 합니다. 음수·문자가 섞인 값은 계산기가 임의로 고치지 않고, 약관에 일수 산정 방법이 정해져 있지 않아 일수도 추정하지 않습니다. 올바르게 입력하기 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsTier && <div className="mt-5"><NoticeBox variant="warning">비급여 <b>입원</b>은 <b>의료기관 종별</b>에 따라 보험금이 달라집니다. 중증은 공제금액 상한 500만 원이 상급종합·종합병원 입원에만 적용되고(특별약관1 제5조 제5항), 비중증은 1회당 300만 원 한도가 병·의원급에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항). <b>입원 의료기관</b>을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsPriorActs && <div className="mt-5"><NoticeBox variant="warning">근골격계 이학요법·체외충격파는 최초 10회 이후 증상의 개선·병변호전이 확인된 경우에 한하여 10회 단위로 보상합니다(특별약관1 제3조(3)제1항 &lt;표1&gt; 주)). 승인 회차는 약관상 <b>&lsquo;각 치료횟수&rsquo;</b>로 세므로, 계약해당일 기준 1년간 <b>이미 받은 치료행위 수</b>를 입력해 주세요. 받은 치료가 없으면 <b>0</b>을 입력하시면 됩니다. <b>보상한 횟수</b>는 보험금이 지급된 횟수라 대신 쓰지 않으며, 입력 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsOutDays && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 사용한 통원일수</b>를 입력해 주세요. 이전 통원이 없으면 <b>0</b>을 입력하세요. 비중증 통원은 연 {GEN2026.nonBenefit.nonCritical.outpatientAnnualDays}일이 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsCause && <div className="mt-5"><NoticeBox variant="warning">일반 상해·질병 비급여는 약관상 <b>상해비급여·질병비급여 각각</b>에 대해 연간 보험가입금액과 누적이 따로 정해집니다(특별약관1·2 제5조 제1항). <b>원인</b>을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && rowsIncomplete && <div className="mt-5"><NoticeBox variant="warning">각 행의 <b>치료 형태</b>{needsRowTier ? <>와 입원 행의 <b>의료기관 종별</b></> : null}를 선택해 주세요.{needsRowTier ? " 중증 비급여 MRI 입원은 의료기관 종별에 따라 공제금액 상한 500만 원 적용 여부가 달라지므로 기본값으로 계산하지 않습니다." : ""}</NoticeBox></div>}
    {submitted && result && result.status === "PENDING_UNVERIFIED" && <div className="mt-5"><NoticeBox variant="warning">{result.notes.join(" ")}</NoticeBox></div>}

    {submitted && result && result.status === "OK" && result.totalAmount > 0 && <div className="mt-7">
      <ResultCard title="다회 청구 합계 (5세대 · 참고용)" items={[{ label: "총 진료비", value: won(result.totalAmount) }, { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true }, { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) }]} />
      <div className="mt-4 overflow-x-auto">
        {room
          ? <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>입원</th><th>차액</th><th>일수</th><th>1일 평균 차액</th><th>50%</th><th>지급</th><th>본인부담</th></tr></thead><tbody>{room.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{line.inpatientDays}일</td><td>{won(line.dailyAverageRoomCharge)}</td><td>{won(line.payBeforeCaps)}</td><td>{won(line.insurancePay ?? 0)}</td><td>{won(line.ownPay ?? 0)}</td></tr>)}</tbody></table>
          : special
          ? <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>행</th><th>진료비</th><th>공제금액</th><th>본인부담</th><th>보험 적용</th><th>보상</th></tr></thead><tbody>{special.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.deductible.deductibleApplied)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td><td>{line.covered ? (line.actIndex === null ? "보상" : `${line.actIndex}회째`) : "제외"}</td></tr>)}</tbody></table>
          : <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>{result.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}</tbody></table>}
      </div>
      {result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}
      {result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}
    </div>}
  </div>;
}
