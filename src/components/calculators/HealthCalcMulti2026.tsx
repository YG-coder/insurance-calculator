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
import {
  Cause, Coverage, Gen2026CriticalMriLine, Gen2026InjectionPurpose, Gen2026ItemClaimResult,
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
  const [annualLimit, setAnnualLimit] = useState("");
  const [copyCount, setCopyCount] = useState("3");
  // 특별약관 전용 입력
  const [rows, setRows] = useState<SpecialRow[]>([emptyRow(), emptyRow()]);
  const [approvedThrough, setApprovedThrough] = useState<Gen2026MskApprovedThrough>(
    GEN2026_MSK_APPROVED_THROUGH_VALUES[0],
  );
  const [priorCount, setPriorCount] = useState("0");
  const [priorPool, setPriorPool] = useState("0");
  const [submitted, setSubmitted] = useState(false);

  const isSpecialItem = nonBenefitItem === "musculoskeletal_esw" || nonBenefitItem === "injection" || nonBenefitItem === "mri";
  const specialItem = isSpecialItem ? (nonBenefitItem as Gen2026SpecialItem) : null;
  const needsItem = coverage === "non_benefit" && nonBenefitItem === "";
  const isRoomCharge = nonBenefitItem === "room_charge";
  const needsSeverity = coverage === "non_benefit" && nonBenefitItem !== "" && !isRoomCharge && severity === "";

  // 경로 판정은 엔진과 같은 함수를 쓴다. 화면과 계산이 다른 판단을 하지 않게 한다.
  const route = specialItem !== null && severity !== ""
    ? routeOfGen2026Item(severity, specialItem, injectionPurpose === "" ? undefined : injectionPurpose)
    : null;
  const needsPurpose = route === "missing_purpose";
  const showSpecialForm = route === "special_item";
  const showGeneralForm = coverage === "non_benefit" && (nonBenefitItem === "general" || route === "general");
  // 일반 (1)(2)로 계산되는 조합에서만 원인이 필요하다. 별도 보장종목·급여에는 요구하지 않는다.
  const needsCause = showGeneralForm && severity !== "" && cause === "";
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
      && !(route === "general" && (cause === "" || (visit === "inpatient" && nbInpatientTier === "")))) {
    const generalCommon = {
      route: "general" as const, coverage: "non_benefit" as const, cause: cause as Cause, visit,
      // ⚠ 빈 값을 Tier로 단언하지 않는다. 아래 게이트가 미선택을 이미 배제한다.
      tier: visit === "inpatient" ? nbInpatientTier || undefined : undefined,
      amounts: amounts.map(num),
      priorAnnualInsurancePaid: num(priorInsurance),
      annualCoverageLimit: annualLimit !== "" ? num(annualLimit) : undefined,
      outpatientCoverageLimit: visit === "outpatient" && outpatientLimit !== "" ? num(outpatientLimit) : undefined,
      priorAnnualOutpatientVisits: severity === "critical" && visit === "outpatient" ? num(priorVisits) : undefined,
      priorAnnualDeductible: severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" ? num(priorDeductible) : undefined,
    };
    if (severity === "critical") {
      if (specialItem === "musculoskeletal_esw") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "musculoskeletal_esw", lines: specialLines,
          approvedThroughVisit: approvedThrough,
          priorAnnualCoveredCount: num(priorCount),
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
        });
      }
    } else if (specialItem === "mri") {
      itemResult = calculateGen2026Item({
        route: "special_item", coverage: "non_benefit", severity: "non_critical",
        item: "mri", lines: specialLines,
        priorAnnualInsurancePaid: num(priorInsurance),
      });
    } else {
      itemResult = calculateGen2026Item({ ...generalCommon, severity: "non_critical", item: specialItem });
    }
  }

  // ── 급여 / 일반 비급여 ──────────────────────────────────────────────
  const plainResult = coverage === "benefit"
    ? calculateMany2026({
        cause: benefitCause, coverage: "benefit", visit, tier: benefitTier,
        nhisCoinsuranceRate: visit === "outpatient" && nhisRate !== "" ? Math.min(100, num(nhisRate)) / 100 : undefined,
        amounts: amounts.map(num),
      })
    : nonBenefitItem === "general" && severity !== "" && cause !== "" && !needsTier
      ? calculateMany2026({
          cause, coverage: "non_benefit", visit, severity, nonBenefitItem: "general",
          tier: visit === "inpatient" ? nbInpatientTier || undefined : undefined,
          amounts: amounts.map(num),
          priorAnnualInsurancePaid: num(priorInsurance),
          priorAnnualDeductible: severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" ? num(priorDeductible) : undefined,
          outpatientCoverageLimit: visit === "outpatient" && outpatientLimit !== "" ? num(outpatientLimit) : undefined,
          priorAnnualOutpatientVisits: severity === "critical" && visit === "outpatient" ? num(priorVisits) : undefined,
          annualCoverageLimit: annualLimit !== "" ? num(annualLimit) : undefined,
        })
      : null;

  const result: Gen2026ItemClaimResult | ReturnType<typeof calculateMany2026> | null = itemResult ?? plainResult;
  // ⚠ 타입 단언 없이 route로만 좁힌다.
  const special = itemResult !== null && itemResult.route === "special_item" ? itemResult : null;

  const setRow = (i: number, patch: Partial<SpecialRow>) =>
    setRows((old) => old.map((r, j) => j === i ? { ...r, ...patch } : r));

  return <div className="card mt-8">
    <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
    <p className="mt-2 text-sm text-slate-600">연간 한도와 공제금액 상한을 건 사이에 이어서 계산합니다. 연간 기준은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b>입니다.</p>
    <p className="mt-2 text-sm text-slate-600">일반 비급여의 연간 보험가입금액은 약관상 <b>상해비급여·질병비급여 각각에 대해 따로</b> 정해집니다. 입력한 모든 행과 기존 지급보험금·누적 공제금액이 <b>같은 원인 보장축</b>의 것이어야 하며, 다른 원인의 청구는 따로 계산해 주세요. 반면 <b>별도 보장종목</b>(3대비급여·비중증 MRI)의 한도는 상해와 질병을 <b>합산</b>하므로 원인을 나누지 않습니다.</p>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {coverage === "benefit" && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={benefitCause} onChange={(e) => setBenefitCause(e.target.value as Cause)}><option value="disease">질병</option><option value="injury">상해</option></select></label>}
      {showGeneralForm && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={cause} onChange={(e) => setCause(e.target.value as Cause | "")}><option value="">선택해 주세요</option><option value="disease">질병</option><option value="injury">상해</option></select></label>}
      <label className="text-sm font-semibold">급여 구분<select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)}><option value="benefit">급여</option><option value="non_benefit">비급여</option></select></label>
      {!showSpecialForm && <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>}
      {coverage === "non_benefit" && <label className="text-sm font-semibold">치료유형<select className="input-base mt-1" value={nonBenefitItem} onChange={(e) => setNonBenefitItem(e.target.value as Gen2026NonBenefitItem | "")}><option value="">선택해 주세요</option>{NON_BENEFIT_ITEMS.map((it) => <option key={it} value={it}>{GEN2026_NON_BENEFIT_ITEM_LABEL[it]}</option>)}</select></label>}
      {coverage === "non_benefit" && nonBenefitItem !== "" && !isRoomCharge && <label className="text-sm font-semibold">질환 구분<select className="input-base mt-1" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}><option value="">선택해 주세요</option><option value="critical">중증</option><option value="non_critical">비중증</option></select></label>}
      {coverage === "non_benefit" && nonBenefitItem === "injection" && severity === "critical" && <label className="text-sm font-semibold">약제 용도<select className="input-base mt-1" value={injectionPurpose} onChange={(e) => setInjectionPurpose(e.target.value as Gen2026InjectionPurpose | "")}><option value="">선택해 주세요</option>{INJECTION_PURPOSES.map((p) => <option key={p} value={p}>{GEN2026_INJECTION_PURPOSE_LABEL[p]}</option>)}</select></label>}
      {coverage === "benefit" && visit === "outpatient" && <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={benefitTier} onChange={(e) => setBenefitTier(e.target.value as Tier)}><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
      {showGeneralForm && severity !== "" && visit === "inpatient" && <label className="text-sm font-semibold">입원 의료기관<select className="input-base mt-1" value={nbInpatientTier} onChange={(e) => setNbInpatientTier(e.target.value as Tier | "")}><option value="">선택해 주세요</option><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
      {showSpecialForm && specialItem === "musculoskeletal_esw" && <label className="text-sm font-semibold">보상 승인 회차<select className="input-base mt-1" value={approvedThrough} onChange={(e) => setApprovedThrough(Number(e.target.value) as Gen2026MskApprovedThrough)}>{GEN2026_MSK_APPROVED_THROUGH_VALUES.map((v) => <option key={v} value={v}>{v}회까지</option>)}</select></label>}
    </div>

    {coverage === "benefit" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">건강보험 본인부담률 (%)<input className="input-base mt-1" type="number" min="0" max="100" step="0.1" value={nhisRate} onChange={(e) => setNhisRate(e.target.value)} /></label>}

    {coverage === "non_benefit" && <div className="mt-4"><NoticeBox variant="info">5세대 비급여는 보장종목이 나뉘어 있습니다. <b>중증</b>의 근골격계 이학요법·체외충격파, 비급여 주사료(일반 주사), 비급여 MRI는 특별약관1 (3)3대비급여이고, <b>비중증</b>의 비급여 MRI는 특별약관2 (3)의 별도 보장종목입니다. 반대로 <b>비중증</b> 근골격계·주사료와 항암제·항생제(항진균제 포함)·희귀의약품을 위한 <b>중증</b> 주사료는 약관이 일반 상해·질병 비급여에서 보상합니다. <b>상급병실료 차액</b>은 입원일수 축이 필요해 아직 계산하지 않습니다.</NoticeBox></div>}
    {isRoomCharge && <div className="mt-4"><NoticeBox variant="warning">상급병실료 차액은 입원 보상 대상인 &lsquo;비급여 의료비&rsquo;에서 제외되고 별도 산식(비급여 병실료의 50%, 1일 평균 10만 원 한도)이 적용됩니다. 입원일수 축이 필요해 현재 계산하지 않습니다.</NoticeBox></div>}
    {route === "general" && <div className="mt-4"><NoticeBox variant="info">{severity === "critical" ? "항암제·항생제(항진균제 포함)·희귀의약품을 위해 사용된 비급여 주사료는 약관상 3대비급여가 아니라 상해비급여·질병비급여에서 보상합니다(특별약관1 제3조(3)제2항). 일반 비급여 입력으로 전환했습니다." : `비중증 ${GEN2026_SPECIAL_ITEM_LABEL[specialItem ?? "injection"]}는 약관상 별도 보장종목이 아니라 상해비급여·질병비급여에서 보상합니다(특별약관2 제3조 (1)제1항·(2)제1항 — 배제 대상은 비급여 자기공명영상진단뿐입니다). 일반 비급여 입력으로 전환했습니다.`}</NoticeBox></div>}

    {/* ── 일반 비급여 입력 (일반 비급여 + 일반 경로로 전환된 조합) ── */}
    {showGeneralForm && severity !== "" && visit === "outpatient" && <div className="mt-4"><NoticeBox variant="info">{severity === "non_critical" ? "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 청구는 한 행으로 합쳐 입력해 주세요." : "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 한 행으로 합쳐 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 행을 나눠 입력합니다."}</NoticeBox></div>}
    {showGeneralForm && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">통원 가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={outpatientLimit} onChange={(e) => setOutpatientLimit(e.target.value)} placeholder="예: 200000 — 모르면 비워두세요" /><span className="mt-2 block text-xs font-normal text-slate-500">약관상 20만 원 이내에서 계약 시 정한 금액입니다(중증 1회당·비중증 1일당). 입력하지 않으면 적용하지 않습니다.</span></label>}
    {showGeneralForm && severity !== "" && <label className="mt-4 block max-w-sm text-sm font-semibold">연간 보험가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} placeholder={severity === "critical" ? "예: 50000000 — 모르면 비워두세요" : "예: 10000000 — 모르면 비워두세요"} /><span className="mt-2 block text-xs font-normal text-slate-500">약관은 {severity === "critical" ? "5천만" : "1천만"} 원 <b>이내에서 계약 시 정한 금액</b>으로 규정하며, 상해비급여·질병비급여 각각에 대해 따로 정해집니다. 입력하지 않으면 적용하지 않습니다.</span></label>}
    {showGeneralForm && severity === "non_critical" && visit === "inpatient" && <div className="mt-4"><NoticeBox variant="info">비중증 입원의 <b>1회당 300만 원 한도</b>는 「의료법」 제3조제2항 의료기관 중 <b>종합병원을 제외한 곳</b>(병·의원급)에서 발생한 비급여 의료비에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항). 상급종합·종합병원 입원에는 적용하지 않습니다.</NoticeBox></div>}
    {showGeneralForm && severity === "critical" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">이미 사용한 통원 횟수 (선택)<input className="input-base mt-1" type="number" min="0" value={priorVisits} onChange={(e) => setPriorVisits(e.target.value)} /><span className="mt-2 block text-xs font-normal text-slate-500">중증 통원은 계약해당일 기준 1년간 100회가 한도입니다.</span></label>}

    {/* ── 특별약관 입력 안내 ── */}
    {showSpecialForm && specialItem !== null && <div className="mt-4"><NoticeBox variant="info">{specialItem === "injection"
      ? "비급여 주사료는 1회 통원(또는 1회 입원)에서 2회 이상 주사치료를 받아도 1회로 봅니다(특별약관1 제3조(3)제4항제2호). 같은 1회 안의 주사료는 합산해 한 행에 입력해 주세요."
      : specialItem === "musculoskeletal_esw"
        ? "근골격계 이학요법·체외충격파는 치료행위마다 공제금액과 한도를 각각 적용합니다(특별약관1 제3조(3)제4항제1호). 2종류 이상을 받았거나 같은 치료를 2회 이상 받았다면 행을 나눠 입력해 주세요."
        : "비급여 MRI는 진단행위마다 공제금액과 한도를 각각 적용합니다(제3조(3)제4항제3호 / 특별약관2 제3조(3)제3항). 2개 이상 부위를 촬영했거나 같은 부위를 2회 이상 촬영했다면 행을 나눠 입력해 주세요."}</NoticeBox></div>}
    {showSpecialForm && specialItem === "musculoskeletal_esw" && <div className="mt-4"><NoticeBox variant="info">약관은 각 치료횟수를 합산해 <b>최초 10회</b>를 보장하고, 이후에는 증상의 개선·병변호전 등이 확인된 경우에 한하여 <b>10회 단위</b>로 연간 50회까지 보상합니다(특별약관1 제3조(3)제1항 &lt;표1&gt; 주)). 이 계산기는 증상 개선 여부를 판정하지 않습니다. 보험사에서 확인된 승인 회차를 선택해 주세요.</NoticeBox></div>}

    {/* ── 입력 행 ── */}
    {showSpecialForm
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
    {showSpecialForm && <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">계약해당일 기준 1년간 이 보장종목의 기존 지급보험금<input className="input-base mt-1" inputMode="numeric" value={priorInsurance} onChange={(e) => setPriorInsurance(e.target.value)} /></label>
      {(specialItem === "musculoskeletal_esw" || specialItem === "injection") && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 보상한 횟수<input className="input-base mt-1" type="number" min="0" value={priorCount} onChange={(e) => setPriorCount(e.target.value)} /></label>}
      {needsRowTier && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액 (500만 원 상한)<input className="input-base mt-1" inputMode="numeric" value={priorPool} onChange={(e) => setPriorPool(e.target.value)} /></label>}
      <p className="text-xs text-slate-500 sm:col-span-2">약관은 연간 보장한도(금액)에서 <b>지급한 금액</b>을, 연간 보장한도(횟수)에서 <b>보상한 횟수</b>를 차감합니다(특별약관1 제3조(3)제7항·제5조 제4항). 일반 비급여의 통원 가입금액(20만 원)과 연간 보험가입금액은 이 보장종목에 적용되지 않습니다.</p>
    </div>}

    <button className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>
    {submitted && needsItem && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>치료유형</b>에 따라 적용되는 보장종목과 산식이 다릅니다. 치료유형을 먼저 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsSeverity && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsPurpose && <div className="mt-5"><NoticeBox variant="warning">비급여 주사료는 <b>약제 용도</b>에 따라 보상하는 보장종목이 달라집니다(특별약관1 제3조(3)제2항). 약제 용도를 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsTier && <div className="mt-5"><NoticeBox variant="warning">비급여 <b>입원</b>은 <b>의료기관 종별</b>에 따라 보험금이 달라집니다. 중증은 공제금액 상한 500만 원이 상급종합·종합병원 입원에만 적용되고(특별약관1 제5조 제5항), 비중증은 1회당 300만 원 한도가 병·의원급에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항). <b>입원 의료기관</b>을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsCause && <div className="mt-5"><NoticeBox variant="warning">일반 상해·질병 비급여는 약관상 <b>상해비급여·질병비급여 각각</b>에 대해 연간 보험가입금액과 누적이 따로 정해집니다(특별약관1·2 제5조 제1항). <b>원인</b>을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && rowsIncomplete && <div className="mt-5"><NoticeBox variant="warning">각 행의 <b>치료 형태</b>{needsRowTier ? <>와 입원 행의 <b>의료기관 종별</b></> : null}를 선택해 주세요.{needsRowTier ? " 중증 비급여 MRI 입원은 의료기관 종별에 따라 공제금액 상한 500만 원 적용 여부가 달라지므로 기본값으로 계산하지 않습니다." : ""}</NoticeBox></div>}
    {submitted && result && result.status === "PENDING_UNVERIFIED" && <div className="mt-5"><NoticeBox variant="warning">{result.notes.join(" ")}</NoticeBox></div>}

    {submitted && result && result.status === "OK" && result.totalAmount > 0 && <div className="mt-7">
      <ResultCard title="다회 청구 합계 (5세대 · 참고용)" items={[{ label: "총 진료비", value: won(result.totalAmount) }, { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true }, { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) }]} />
      <div className="mt-4 overflow-x-auto">
        {special
          ? <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>행</th><th>진료비</th><th>공제금액</th><th>본인부담</th><th>보험 적용</th><th>보상</th></tr></thead><tbody>{special.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.deductible.deductibleApplied)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td><td>{line.covered ? (line.actIndex === null ? "보상" : `${line.actIndex}회째`) : "제외"}</td></tr>)}</tbody></table>
          : <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>{result.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}</tbody></table>}
      </div>
      {result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}
      {result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}
    </div>}
  </div>;
}
