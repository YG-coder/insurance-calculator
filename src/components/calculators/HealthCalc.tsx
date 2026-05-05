"use client";

import { useState, useMemo } from "react";
import ResultCard from "@/components/ResultCard";

type CareType = "outpatient" | "inpatient";
type BenefitType = "covered" | "uncovered";

const RATE: Record<BenefitType, Record<CareType, number>> = {
  // 4세대 실손보험 자기부담률 (참고용 단순화)
  covered: { outpatient: 0.2, inpatient: 0.1 },
  uncovered: { outpatient: 0.3, inpatient: 0.2 },
};

// 통원 1회당 최소공제액 (참고용 단순화)
const MIN_DEDUCTIBLE: Record<BenefitType, number> = {
  covered: 10000,
  uncovered: 20000,
};

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export default function HealthCalc() {
  const [amount, setAmount] = useState<string>("");
  const [careType, setCareType] = useState<CareType>("outpatient");
  const [benefitType, setBenefitType] = useState<BenefitType>("covered");

  const result = useMemo(() => {
    const billing = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!billing || billing <= 0) return null;

    const rate = RATE[benefitType][careType];
    const rateBased = Math.round(billing * rate);

    let selfPay = rateBased;
    if (careType === "outpatient") {
      const minDed = MIN_DEDUCTIBLE[benefitType];
      selfPay = Math.max(rateBased, Math.min(billing, minDed));
    }

    const insurancePay = Math.max(0, billing - selfPay);
    const ratio = (insurancePay / billing) * 100;

    return { billing, selfPay, insurancePay, rate, ratio };
  }, [amount, careType, benefitType]);

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label className="label-base">병원비 총액</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 300000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-base"
          />
          <p className="mt-1 text-xs text-slate-500">
            진료비 영수증의 ‘본인부담금 + 공단부담금’ 합계를 입력하세요.
          </p>
        </div>

        <div>
          <label className="label-base">진료 형태</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCareType("outpatient")}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                careType === "outpatient"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              통원
            </button>
            <button
              type="button"
              onClick={() => setCareType("inpatient")}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                careType === "inpatient"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              입원
            </button>
          </div>
        </div>

        <div>
          <label className="label-base">보장 구분</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBenefitType("covered")}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                benefitType === "covered"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              급여
            </button>
            <button
              type="button"
              onClick={() => setBenefitType("uncovered")}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                benefitType === "uncovered"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              비급여
            </button>
          </div>
        </div>
      </div>

      {result ? (
        <div className="mt-6">
          <ResultCard
            title="계산 결과 (4세대 실손 기준 · 참고용)"
            items={[
              { label: "청구 의료비", value: formatKRW(result.billing) },
              { label: "예상 본인부담금", value: formatKRW(result.selfPay) },
              { label: "예상 보험금", value: formatKRW(result.insurancePay), highlight: true },
            ]}
          />
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            적용 자기부담률 <strong>{Math.round(result.rate * 100)}%</strong>, 보장률 약{" "}
            <strong>{result.ratio.toFixed(1)}%</strong>입니다.
            {careType === "outpatient" && (
              <>
                {" "}통원의 경우 정률보다 최소공제액({formatKRW(MIN_DEDUCTIBLE[benefitType])})이 큰 경우, 최소공제액이 본인부담금이 됩니다.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-6 text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          병원비 금액을 입력하면 본인부담금과 예상 보험금이 자동으로 계산됩니다.
        </div>
      )}
    </div>
  );
}
