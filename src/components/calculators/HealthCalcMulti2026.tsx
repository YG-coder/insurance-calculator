"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import ResultCard from "@/components/ResultCard";
import { calculateMany2026 } from "@/lib/insurance/engine/multiClaim2026";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { Coverage, Severity, Tier, Visit } from "@/lib/insurance/engine/types";

const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;
const smallButton = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40";

export default function HealthCalcMulti2026() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [severity, setSeverity] = useState<Severity>("critical");
  const [tier, setTier] = useState<Tier>("clinic");
  const [nhisRate, setNhisRate] = useState("");
  const [priorInsurance, setPriorInsurance] = useState("0");
  const [priorOwnPay, setPriorOwnPay] = useState("0");
  const [copyCount, setCopyCount] = useState("3");
  const [submitted, setSubmitted] = useState(false);

  const result = calculateMany2026({
    coverage, visit, severity: coverage === "non_benefit" ? severity : undefined, tier,
    nhisCoinsuranceRate: coverage === "benefit" && visit === "outpatient" && nhisRate !== "" ? Math.min(100, num(nhisRate)) / 100 : undefined,
    amounts: amounts.map(num),
    priorAnnualInsurancePaid: coverage === "non_benefit" ? num(priorInsurance) : undefined,
    priorAnnualOwnPay: coverage === "non_benefit" && severity === "critical" && visit === "inpatient" && tier === "hospital" ? num(priorOwnPay) : undefined,
  });

  return <div className="card mt-8">
    <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
    <p className="mt-2 text-sm text-slate-600">회당·일당 한도와 약관상 누적기간의 연간 한도를 건 사이에 이어서 계산합니다.</p>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="text-sm font-semibold">급여 구분<select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)}><option value="benefit">급여</option><option value="non_benefit">비급여</option></select></label>
      <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>
      {coverage === "non_benefit" && <label className="text-sm font-semibold">질환 구분<select className="input-base mt-1" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}><option value="critical">중증</option><option value="non_critical">비중증</option></select></label>}
      {(coverage === "benefit" && visit === "outpatient" || coverage === "non_benefit" && severity === "critical" && visit === "inpatient") && <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={tier} onChange={(e) => setTier(e.target.value as Tier)}><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
    </div>
    {coverage === "benefit" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">건강보험 본인부담률 (%)<input className="input-base mt-1" type="number" min="0" max="100" step="0.1" value={nhisRate} onChange={(e) => setNhisRate(e.target.value)} /></label>}
    {coverage === "non_benefit" && severity === "non_critical" && visit === "outpatient" && <div className="mt-4"><NoticeBox variant="warning">같은 날 여러 번 통원한 경우는 현재 지원하지 않습니다. 각 행에는 서로 다른 날짜의 청구만 입력해 주세요.</NoticeBox></div>}

    <div className="mt-5 space-y-3">{amounts.map((amount, i) => <div className="flex items-end gap-2" key={i}><label className="flex-1 text-sm font-semibold">{i + 1}건 진료비<input className="input-base mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmounts((old) => old.map((v, j) => j === i ? e.target.value : v))} /></label><button className={smallButton} disabled={amounts.length === 1} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))}>삭제</button></div>)}</div>
    <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button><input className="input-base w-20" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" /><button className={smallButton} onClick={() => setAmounts(Array.from({ length: Math.max(1, Math.min(100, Math.floor(num(copyCount)))) }, () => amounts[0] ?? ""))}>첫 금액 × N회</button></div>

    {coverage === "non_benefit" && <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">약관상 누적기간 내 기존 지급보험금<input className="input-base mt-1" inputMode="numeric" value={priorInsurance} onChange={(e) => setPriorInsurance(e.target.value)} /></label>{severity === "critical" && visit === "inpatient" && tier === "hospital" && <label className="text-sm font-semibold">약관상 누적기간 내 기존 자기부담금<input className="input-base mt-1" inputMode="numeric" value={priorOwnPay} onChange={(e) => setPriorOwnPay(e.target.value)} /></label>}<p className="text-xs text-slate-500 sm:col-span-2">누적기간의 기산점은 가입 상품 약관을 확인해 주세요. 역년이나 계약해당일로 추정하지 않습니다.</p></div>}

    <button className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>
    {submitted && result.status === "PENDING_UNVERIFIED" && <div className="mt-5"><NoticeBox variant="warning">{result.notes.join(" ")}</NoticeBox></div>}
    {submitted && result.status === "OK" && result.totalAmount > 0 && <div className="mt-7"><ResultCard title="다회 청구 합계 (5세대 · 참고용)" items={[{ label: "총 진료비", value: won(result.totalAmount) }, { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true }, { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) }]} /><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>{result.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}</tbody></table></div>{result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}{result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}</div>}
  </div>;
}
