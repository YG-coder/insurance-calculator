"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";

type Coverage = "benefit" | "non_benefit"; // 급여 / 비급여
type Visit = "outpatient" | "inpatient";   // 통원 / 입원

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

export default function HealthCalc() {
  const [amount, setAmount] = useState<string>("300000");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [submitted, setSubmitted] = useState(false);

  const num = Number(amount.replace(/[^0-9]/g, "")) || 0;

  // 4세대 실손 자기부담률 (참고용 단순 적용)
  // 급여+통원 20% / 급여+입원 10% / 비급여+통원 30% / 비급여+입원 20%
  const rate =
    coverage === "benefit"
      ? visit === "outpatient"
        ? 0.2
        : 0.1
      : visit === "outpatient"
      ? 0.3
      : 0.2;

  // 통원 최소공제액 (외래 1만 / 처방 등 단순화 위해 1만 원 가정)
  const minDeductible = visit === "outpatient" ? 10000 : 0;

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
                  visit === "outpatient" ? " · 최소공제액 1만 원 비교" : ""
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
