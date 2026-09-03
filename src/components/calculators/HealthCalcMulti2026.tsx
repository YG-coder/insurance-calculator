"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import ResultCard from "@/components/ResultCard";
import { calculateMany2026 } from "@/lib/insurance/engine/multiClaim2026";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { Cause, Coverage, Gen2026NonBenefitItem, Severity, Tier, Visit } from "@/lib/insurance/engine/types";
import { GEN2026_NON_BENEFIT_ITEM_LABEL } from "@/lib/insurance/engine/generation2026";

// ⚠ 기본 선택 없음. 단건 계산기와 같은 정책이다.
const NON_BENEFIT_ITEMS: Gen2026NonBenefitItem[] = [
  "general", "musculoskeletal_esw", "injection", "mri", "room_charge",
];

const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;
const smallButton = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40";

export default function HealthCalcMulti2026() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  const [cause, setCause] = useState<Cause>("disease");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  // "" = 미선택. 단건 계산기와 같은 정책 — 기본값을 두면 사용자가 인식하지 못한 채
  //   중증으로 계산되고, 중증/비중증은 자기부담률(30% vs 50%)과 한도가 크게 다르다.
  const [severity, setSeverity] = useState<Severity | "">("");
  // "" = 미선택. 고르기 전에는 계산하지 않는다.
  const [nonBenefitItem, setNonBenefitItem] = useState<Gen2026NonBenefitItem | "">("");
  const [tier, setTier] = useState<Tier>("clinic");
  const [nhisRate, setNhisRate] = useState("");
  const [priorInsurance, setPriorInsurance] = useState("0");
  const [priorDeductible, setPriorDeductible] = useState("0");
  const [outpatientLimit, setOutpatientLimit] = useState("");
  const [priorVisits, setPriorVisits] = useState("0");
  const [annualLimit, setAnnualLimit] = useState("");
  const [copyCount, setCopyCount] = useState("3");
  const [submitted, setSubmitted] = useState(false);

  const needsItem = coverage === "non_benefit" && nonBenefitItem === "";
  const needsSeverity = coverage === "non_benefit" && nonBenefitItem === "general" && severity === "";

  // 급여/비급여를 나눠 호출한다 — 비급여에서 치료유형 누락이 컴파일 에러가 되는 경로다.
  const result = coverage === "benefit"
    ? calculateMany2026({
        cause, coverage: "benefit", visit, tier,
        nhisCoinsuranceRate: visit === "outpatient" && nhisRate !== "" ? Math.min(100, num(nhisRate)) / 100 : undefined,
        amounts: amounts.map(num),
      })
    : needsItem || needsSeverity
      ? null
      : calculateMany2026({
          cause, coverage: "non_benefit", visit, severity: severity as Severity, tier,
          nonBenefitItem: nonBenefitItem as Gen2026NonBenefitItem,
          amounts: amounts.map(num),
          priorAnnualInsurancePaid: num(priorInsurance),
          priorAnnualDeductible: severity === "critical" && visit === "inpatient" && tier === "hospital" ? num(priorDeductible) : undefined,
          outpatientCoverageLimit: visit === "outpatient" && outpatientLimit !== "" ? num(outpatientLimit) : undefined,
          priorAnnualOutpatientVisits: severity === "critical" && visit === "outpatient" ? num(priorVisits) : undefined,
          annualCoverageLimit: annualLimit !== "" ? num(annualLimit) : undefined,
        });

  return <div className="card mt-8">
    <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
    <p className="mt-2 text-sm text-slate-600">연간 한도와 공제금액 상한을 건 사이에 이어서 계산합니다. 연간 기준은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b>입니다.</p>
    <p className="mt-2 text-sm text-slate-600">연간 보험가입금액은 약관상 <b>상해비급여·질병비급여 각각에 대해 따로</b> 정해집니다. 입력한 모든 행과 기존 지급보험금·누적 공제금액이 <b>같은 원인 보장축</b>의 것이어야 하며, 다른 원인의 청구는 따로 계산해 주세요.</p>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={cause} onChange={(e) => setCause(e.target.value as Cause)}><option value="disease">질병</option><option value="injury">상해</option></select></label>
      <label className="text-sm font-semibold">급여 구분<select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)}><option value="benefit">급여</option><option value="non_benefit">비급여</option></select></label>
      <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>
      {coverage === "non_benefit" && <label className="text-sm font-semibold">치료유형<select className="input-base mt-1" value={nonBenefitItem} onChange={(e) => setNonBenefitItem(e.target.value as Gen2026NonBenefitItem | "")}><option value="">선택해 주세요</option>{NON_BENEFIT_ITEMS.map((it) => <option key={it} value={it}>{GEN2026_NON_BENEFIT_ITEM_LABEL[it]}</option>)}</select></label>}
      {coverage === "non_benefit" && nonBenefitItem === "general" && <label className="text-sm font-semibold">질환 구분<select className="input-base mt-1" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}><option value="">선택해 주세요</option><option value="critical">중증</option><option value="non_critical">비중증</option></select></label>}
      {(coverage === "benefit" && visit === "outpatient" || coverage === "non_benefit" && nonBenefitItem === "general" && severity === "critical" && visit === "inpatient") && <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={tier} onChange={(e) => setTier(e.target.value as Tier)}><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
    </div>
    {coverage === "benefit" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">건강보험 본인부담률 (%)<input className="input-base mt-1" type="number" min="0" max="100" step="0.1" value={nhisRate} onChange={(e) => setNhisRate(e.target.value)} /></label>}
    {coverage === "non_benefit" && <div className="mt-4"><NoticeBox variant="info">5세대 비급여는 보장종목이 나뉘어 있습니다. <b>근골격계 이학요법·체외충격파, 비급여 주사료, 비급여 MRI</b>는 약관상 별도 보장종목이라 일반 상해·질병 비급여에서 제외되고, <b>상급병실료 차액</b>도 입원 의료비와 별도 산식입니다. 이 계산기는 현재 <b>일반 비급여만</b> 계산합니다.</NoticeBox></div>}
    {coverage === "non_benefit" && nonBenefitItem === "general" && severity !== "" && visit === "outpatient" && <div className="mt-4"><NoticeBox variant="info">{severity === "non_critical" ? "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 청구는 한 행으로 합쳐 입력해 주세요." : "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 한 행으로 합쳐 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 행을 나눠 입력합니다."}</NoticeBox></div>}
    {coverage === "non_benefit" && nonBenefitItem === "general" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">통원 가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={outpatientLimit} onChange={(e) => setOutpatientLimit(e.target.value)} placeholder="예: 200000 — 모르면 비워두세요" /><span className="mt-2 block text-xs font-normal text-slate-500">약관상 20만 원 이내에서 계약 시 정한 금액입니다(중증 1회당·비중증 1일당). 입력하지 않으면 적용하지 않습니다.</span></label>}
    {coverage === "non_benefit" && nonBenefitItem === "general" && severity !== "" && <label className="mt-4 block max-w-sm text-sm font-semibold">연간 보험가입금액 (선택)<input className="input-base mt-1" inputMode="numeric" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} placeholder={severity === "critical" ? "예: 50000000 — 모르면 비워두세요" : "예: 10000000 — 모르면 비워두세요"} /><span className="mt-2 block text-xs font-normal text-slate-500">약관은 {severity === "critical" ? "5천만" : "1천만"} 원 <b>이내에서 계약 시 정한 금액</b>으로 규정하며, 상해비급여·질병비급여 각각에 대해 따로 정해집니다. 입력하지 않으면 적용하지 않습니다.</span></label>}
    {coverage === "non_benefit" && nonBenefitItem === "general" && severity === "critical" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">이미 사용한 통원 횟수 (선택)<input className="input-base mt-1" type="number" min="0" value={priorVisits} onChange={(e) => setPriorVisits(e.target.value)} /><span className="mt-2 block text-xs font-normal text-slate-500">중증 통원은 계약해당일 기준 1년간 100회가 한도입니다.</span></label>}

    <div className="mt-5 space-y-3">{amounts.map((amount, i) => <div className="flex items-end gap-2" key={i}><label className="flex-1 text-sm font-semibold">{i + 1}건 진료비<input className="input-base mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmounts((old) => old.map((v, j) => j === i ? e.target.value : v))} /></label><button className={smallButton} disabled={amounts.length === 1} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))}>삭제</button></div>)}</div>
    <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button><input className="input-base w-20" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" /><button className={smallButton} onClick={() => setAmounts(Array.from({ length: Math.max(1, Math.min(100, Math.floor(num(copyCount)))) }, () => amounts[0] ?? ""))}>첫 금액 × N회</button></div>

    {coverage === "non_benefit" && nonBenefitItem === "general" && severity !== "" && <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">계약해당일 기준 1년간 기존 지급보험금<input className="input-base mt-1" inputMode="numeric" value={priorInsurance} onChange={(e) => setPriorInsurance(e.target.value)} /></label>{severity === "critical" && visit === "inpatient" && tier === "hospital" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액<input className="input-base mt-1" inputMode="numeric" value={priorDeductible} onChange={(e) => setPriorDeductible(e.target.value)} /></label>}<p className="text-xs text-slate-500 sm:col-span-2">연간 한도와 공제금액 상한은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b> 단위로 누적됩니다(표준약관 특별약관1·2 제5조 제2항). 역년 기준이 아닙니다. 500만 원 상한에 누적되는 것은 약관상 <b>공제금액</b>이며, 보험가입금액 한도로 추가 부담한 금액은 포함되지 않습니다.</p></div>}

    <button className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>
    {submitted && needsItem && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>치료유형</b>에 따라 적용되는 보장종목과 산식이 다릅니다. 치료유형을 먼저 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsSeverity && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && result && result.status === "PENDING_UNVERIFIED" && <div className="mt-5"><NoticeBox variant="warning">{result.notes.join(" ")}</NoticeBox></div>}
    {submitted && result && result.status === "OK" && result.totalAmount > 0 && <div className="mt-7"><ResultCard title="다회 청구 합계 (5세대 · 참고용)" items={[{ label: "총 진료비", value: won(result.totalAmount) }, { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true }, { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) }]} /><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>{result.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}</tbody></table></div>{result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}{result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}</div>}
  </div>;
}
