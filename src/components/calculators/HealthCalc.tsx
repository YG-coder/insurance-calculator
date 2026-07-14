"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";

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

  // 4세대 실손 자기부담률 (금융위원회 안내 기준)
  // 급여: 입원·통원 동일 20% / 비급여: 입원·통원 동일 30%
  const rate = coverage === "benefit" ? 0.2 : 0.3;

  // 통원 최소공제액 (입원은 정률만 적용, 최소공제액 없음)
  // 급여: 병·의원급 1만 원 / 상급종합·종합병원 2만 원
  // 비급여: 3만 원 (의료기관 구분 없음)
  const minDeductible =
    visit !== "outpatient"
      ? 0
      : coverage === "benefit"
      ? tier === "clinic"
        ? 10000
        : 20000
      : 30000;

  const rateBased = num * rate;
  const ownPay = Math.max(rateBased, minDeductible);
  const insurancePay = Math.max(num - ownPay, 0);

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="med-amount">
            병원비 (원)
          </label>
          <input
            id="med-amount"
            inputMode="numeric"
            className="input-base"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="예: 300000"
          />
          <p className="mt-2 text-xs text-slate-500">
            현재 입력 금액: {won(num)}
          </p>
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
          <p className="mt-3 text-xs text-slate-500">
            ※ 실제 보험금은 가입 상품, 약관, 한도, 차등제 등에 따라 달라질 수
            있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
