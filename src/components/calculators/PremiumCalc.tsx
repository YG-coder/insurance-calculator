"use client";

import { useState, useMemo } from "react";
import ResultCard from "@/components/ResultCard";

type Sex = "male" | "female";

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

// 나이대별 기본 위험 계수 (참고용 단순화)
function ageFactor(age: number) {
  if (age < 20) return 0.6;
  if (age < 30) return 0.8;
  if (age < 40) return 1.0;
  if (age < 50) return 1.4;
  if (age < 60) return 2.0;
  if (age < 70) return 3.0;
  return 4.5;
}

export default function PremiumCalc() {
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<Sex>("male");
  const [smoker, setSmoker] = useState<boolean>(false);
  const [coverage, setCoverage] = useState<string>("50000000");

  const result = useMemo(() => {
    const ageNum = parseInt(age, 10);
    const cov = parseInt(coverage.replace(/[^0-9]/g, ""), 10);

    if (!ageNum || ageNum < 0 || ageNum > 100) return null;
    if (!cov || cov <= 0) return null;

    const basePerTenMillion = 3000; // 보장 1천만 원당 기본 (참고용 단순화)
    const tenMillions = cov / 10_000_000;

    let factor = ageFactor(ageNum);
    if (sex === "female") factor *= 0.85;
    if (smoker) factor *= 1.3;

    const monthly = Math.round(basePerTenMillion * tenMillions * factor);
    const low = Math.round(monthly * 0.8);
    const high = Math.round(monthly * 1.2);
    const yearly = monthly * 12;

    return { monthly, low, high, yearly };
  }, [age, sex, smoker, coverage]);

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base">나이</label>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="예: 35"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">성별</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSex("male")}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                sex === "male"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              남성
            </button>
            <button
              type="button"
              onClick={() => setSex("female")}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                sex === "female"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              여성
            </button>
          </div>
        </div>

        <div>
          <label className="label-base">흡연 여부</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSmoker(false)}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                !smoker
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              비흡연
            </button>
            <button
              type="button"
              onClick={() => setSmoker(true)}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                smoker
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              흡연
            </button>
          </div>
        </div>

        <div>
          <label className="label-base">보장금액</label>
          <select
            value={coverage}
            onChange={(e) => setCoverage(e.target.value)}
            className="input-base"
          >
            <option value="10000000">1,000만 원</option>
            <option value="30000000">3,000만 원</option>
            <option value="50000000">5,000만 원</option>
            <option value="100000000">1억 원</option>
            <option value="200000000">2억 원</option>
            <option value="300000000">3억 원</option>
          </select>
        </div>
      </div>

      {result ? (
        <div className="mt-6">
          <ResultCard
            title="예상 보험료 범위 (참고용)"
            items={[
              { label: "예상 월 보험료", value: formatKRW(result.monthly), highlight: true },
              {
                label: "최저 ~ 최고 (보험사 변동성)",
                value: `${formatKRW(result.low)} ~ ${formatKRW(result.high)}`,
              },
              { label: "연간 예상", value: formatKRW(result.yearly) },
            ]}
          />
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            동일 조건이라도 보험사·상품·특약 구성에 따라 실제 보험료는 ±20% 이상 차이날 수 있습니다.
            정확한 견적은 각 보험사 공식 채널에서 확인하시기 바랍니다.
          </p>
        </div>
      ) : (
        <div className="mt-6 text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          나이와 보장금액을 입력하면 예상 보험료 범위가 자동으로 계산됩니다.
        </div>
      )}
    </div>
  );
}
