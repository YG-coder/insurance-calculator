"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { calculate } from "@/lib/insurance/engine/engine";

type Coverage = "benefit" | "non_benefit"; // 급여 / 비급여
type Visit = "outpatient" | "inpatient";   // 통원 / 입원
type Tier = "clinic" | "hospital";         // 병·의원급 / 상급종합·종합병원

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

export default function HealthCalc() {
  const [amount, setAmount] = useState<string>("300000");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [submitted, setSubmitted] = useState(false);

  const num = Number(amount.replace(/[^0-9]/g, "")) || 0;

  // 계산은 실손보험 엔진(generation2021)에 위임. 산식은 src/lib/insurance/ 로 이동.
  // 내부 엔진 교체이며, 화면·상태·라벨·결과값은 종전과 동일하다.
  const result = calculate("2021", { amount: num, coverage, visit, tier });
  const rate = result.rateApplied ?? 0;
  const minDeductible = result.minDeductible ?? 0;
  const rateBased = result.rateBased ?? 0;
  const ownPay = result.ownPay ?? 0;
  const insurancePay = result.insurancePay ?? 0;

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="med-amount">
            병원비 (원)
          </label>
          <AmountInput
            id="med-amount"
            value={amount}
            onChange={setAmount}
            placeholder="예: 300,000"
          />
        </div>

        <div>
          <label className="label-base">진료 구분</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCoverage("benefit")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                coverage === "benefit"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              급여
            </button>
            <button
              type="button"
              onClick={() => setCoverage("non_benefit")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                coverage === "non_benefit"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              비급여
            </button>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">치료 형태</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button
              type="button"
              onClick={() => setVisit("outpatient")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                visit === "outpatient"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              통원
            </button>
            <button
              type="button"
              onClick={() => setVisit("inpatient")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                visit === "inpatient"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              입원
            </button>
          </div>
        </div>

        {visit === "outpatient" && coverage === "benefit" && (
          <div className="sm:col-span-2">
            <label className="label-base">방문 의료기관</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button
                type="button"
                onClick={() => setTier("clinic")}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                  tier === "clinic"
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
                }`}
              >
                병·의원급
              </button>
              <button
                type="button"
                onClick={() => setTier("hospital")}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                  tier === "hospital"
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
                }`}
              >
                상급종합·종합병원
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              급여 통원 최소공제액: 병·의원급 1만 원 / 상급종합·종합병원 2만 원
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() => setSubmitted(true)}
        >
          자기부담금 계산하기
        </button>
      </div>

      {submitted && num > 0 && (
        <div className="mt-8">
          <ResultCard
            title="계산 결과 (4세대 실손 기준 · 참고용)"
            items={[
              { label: "총 진료비", value: won(num) },
              {
                label: `자기부담률 (${(rate * 100).toFixed(0)}%${
                  visit === "outpatient"
                    ? ` · 최소공제액 ${won(minDeductible)} 비교`
                    : ""
                })`,
                value: won(rateBased),
              },
              { label: "본인부담금", value: won(ownPay), highlight: true },
              { label: "보험 적용 금액", value: won(insurancePay) },
            ]}
          />
          {result.appliedCaps.length > 0 && (
            <div className="mt-4">
              <NoticeBox variant="info">
                적용된 한도: {result.appliedCaps.map((code) => CAP_LABELS[code]).join(", ")}. 보험 적용 금액이 조정되었습니다. 통원 보험금은 외래와
                처방조제비를 합해 1회당 20만 원이 상한입니다.
              </NoticeBox>
            </div>
          )}
          {result.notes.length > 0 && (
            <div className="mt-3">
              <NoticeBox variant="info">{result.notes[0]}</NoticeBox>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            ※ 실제 보험금은 가입 상품, 약관, 한도, 차등제 등에 따라 달라질 수
            있습니다.
          </p>
        </div>
      )}
      {submitted && num === 0 && (
        <div className="mt-6">
          <NoticeBox variant="info">진료비를 1원 이상 입력해 주세요.</NoticeBox>
        </div>
      )}
    </div>
  );
}
