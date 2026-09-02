"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import ResultCard from "@/components/ResultCard";
import { calculateMany2021 } from "@/lib/insurance/engine/multiClaim2021";
import { Cause, Coverage, Gen2021Rider, Tier, Visit } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";

const digits = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function HealthCalcMulti2021() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  const [cause, setCause] = useState<Cause>("disease");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [rider, setRider] = useState<Gen2021Rider>("none");
  const [annualLimit, setAnnualLimit] = useState("");
  const [priorPaid, setPriorPaid] = useState("0");
  const [priorVisits, setPriorVisits] = useState("0");
  const [copyCount, setCopyCount] = useState("3");
  const [submitted, setSubmitted] = useState(false);

  const isRider = rider !== "none";
  const result = calculateMany2021({
    cause, coverage, visit, tier, rider,
    amounts: amounts.map(digits),
    annualCoverageLimit: !isRider && annualLimit ? digits(annualLimit) : undefined,
    priorAnnualInsurancePaid: !isRider ? digits(priorPaid) : undefined,
    priorAnnualOutpatientVisits: !isRider ? digits(priorVisits) : undefined,
    priorAnnualRiderPaid: isRider ? digits(priorPaid) : undefined,
    priorAnnualRiderVisits: isRider ? digits(priorVisits) : undefined,
  });

  const setLine = (index: number, value: string) =>
    setAmounts((old) => old.map((v, i) => i === index ? value : v));
  const smallButton = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40";

  return (
    <div className="card mt-8">
      <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
      <p className="mt-2 text-sm text-slate-600">
        선택한 원인·급여 구분의 한 보장축만 계산합니다. 같은 축의 청구를 발생 순서대로 입력하면 회당·연간 한도와 기존 지급액을 이어서 계산합니다.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-sm font-semibold">원인
          <select className="input-base mt-1" value={cause} onChange={(e) => setCause(e.target.value as Cause)}>
            <option value="disease">질병</option><option value="injury">상해</option>
          </select>
        </label>
        <label className="text-sm font-semibold">급여 구분
          <select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)} disabled={isRider}>
            <option value="benefit">급여</option><option value="non_benefit">비급여</option>
          </select>
        </label>
        <label className="text-sm font-semibold">치료 형태
          <select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}>
            <option value="outpatient">통원</option><option value="inpatient">입원</option>
          </select>
        </label>
        <label className="text-sm font-semibold">3대 비급여
          <select className="input-base mt-1" value={rider} onChange={(e) => setRider(e.target.value as Gen2021Rider)}>
            <option value="none">해당 없음</option>
            <option value="manual_therapy">도수·충격파·증식</option>
            <option value="injection">비급여 주사</option>
            <option value="mri">MRI/MRA</option>
          </select>
        </label>
      </div>

      {!isRider && visit === "outpatient" && coverage === "benefit" && (
        <label className="mt-4 block text-sm font-semibold">의료기관
          <select className="input-base mt-1 max-w-xs" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            <option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option>
          </select>
        </label>
      )}

      <div className="mt-5 space-y-3">
        {amounts.map((amount, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex-1 text-sm font-semibold">{i + 1}건 진료비
              <input className="input-base mt-1" inputMode="numeric" value={amount}
                onChange={(e) => setLine(i, e.target.value)} />
            </label>
            <button type="button" className={smallButton} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))} disabled={amounts.length === 1}>삭제</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button>
          <input className="input-base w-20" inputMode="numeric" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" />
          <button type="button" className={smallButton} onClick={() => setAmounts(Array.from({ length: Math.max(1, Math.min(100, digits(copyCount))) }, () => amounts[0] ?? ""))}>첫 금액 × N회</button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {!isRider && <label className="text-sm font-semibold">증권상 연간 가입금액
          <input className="input-base mt-1" inputMode="numeric" placeholder="예: 50,000,000" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">약관상 최대 5천만 원. 비우면 연간 금액 한도를 적용하지 않습니다.</span>
        </label>}
        <label className="text-sm font-semibold">누적기간 내 기존 지급보험금
          <input className="input-base mt-1" inputMode="numeric" value={priorPaid} onChange={(e) => setPriorPaid(e.target.value)} />
        </label>
        {(isRider || (coverage === "non_benefit" && visit === "outpatient")) && <label className="text-sm font-semibold">누적기간 내 기존 횟수
          <input className="input-base mt-1" inputMode="numeric" value={priorVisits} onChange={(e) => setPriorVisits(e.target.value)} />
        </label>}
      </div>

      <button type="button" className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>

      {submitted && result.totalAmount > 0 && <div className="mt-7">
        <ResultCard title="다회 청구 합계 (4세대 · 참고용)" items={[
          { label: "총 진료비", value: won(result.totalAmount) },
          { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true },
          { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) },
        ]} />
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>
          {result.lines.map((line) => <tr key={line.index} className="border-t"><td className="py-2">{line.index + 1}{!line.covered ? " (한도 초과)" : ""}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}
        </tbody></table></div>
        {result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}
        {result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}
      </div>}
    </div>
  );
}
