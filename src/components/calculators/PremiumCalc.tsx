"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcPremiumRatio } from "@/lib/insurance/decision/premiumRatio";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

export default function PremiumCalc() {
  const [income, setIncome] = useState("");
  const [premium, setPremium] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // 미입력 = 빈 문자열. "0"은 정상 입력.
  const missing = income.trim() === "" || premium.trim() === "";
  const result = missing
    ? null
    : calcPremiumRatio({ monthlyIncome: onlyNum(income), monthlyPremium: onlyNum(premium) });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="pr-income">월 소득 (원)</label>
          <AmountInput id="pr-income" value={income} onChange={setIncome} placeholder="예: 3,000,000" />
        </div>
        <div>
          <label className="label-base" htmlFor="pr-premium">월 보험료 (원)</label>
          <AmountInput id="pr-premium" value={premium} onChange={setPremium} placeholder="내고 있는 보험료 합계" />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={missing}
          onClick={() => setSubmitted(true)}
        >
          보험료 비중 계산하기
        </button>
        {missing && (
          <p className="mt-2 text-xs text-slate-500">월 소득과 월 보험료를 모두 입력해 주세요.</p>
        )}
      </div>

      {submitted && result && (
        <div className="mt-8 space-y-4">
          {result.status === "NEED_INCOME" ? (
            <NoticeBox variant="info">
              보험료 비중을 계산하려면 월 소득을 입력해 주세요. (소득이 0이면 비율을 계산할 수 없습니다.)
            </NoticeBox>
          ) : (
            <>
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
                <p className="text-sm font-semibold text-slate-500 mb-1">보험료 비중</p>
                <p className="text-4xl font-bold text-brand-700">
                  {(result.ratioPercent ?? 0).toFixed(1)}%
                </p>
                <p className="text-sm text-slate-500 mt-2">입력한 월 소득 기준(세전·세후 중 사용자가 선택)</p>
              </div>
              <ResultCard
                title="입력·연간 환산"
                items={[
                  { label: "월 보험료", value: won(result.monthlyPremium) },
                  { label: "월 소득", value: won(result.monthlyIncome) },
                  { label: "연간 보험료", value: won(result.yearlyPremium) },
                  { label: "연간 소득", value: won(result.yearlyIncome) },
                ]}
              />
              <NoticeBox variant="info">
                이 계산기는 입력하신 월 보험료가 소득에서 차지하는 비중만 계산합니다. 적정 비중이 몇 %인지는
                사람마다 다르므로 제시하지 않습니다. 비중이 높은지 낮은지는 본인의 상황에 맞게 판단해 주세요.
              </NoticeBox>
            </>
          )}
        </div>
      )}
    </div>
  );
}
