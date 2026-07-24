"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";

type Gender = "male" | "female";

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

export default function PremiumCalc() {
  const [age, setAge] = useState<string>("35");
  const [gender, setGender] = useState<Gender>("male");
  const [smoker, setSmoker] = useState<boolean>(false);
  const [coverage, setCoverage] = useState<string>("100000000"); // 1억
  const [submitted, setSubmitted] = useState(false);

  const ageNum = Math.min(80, Math.max(0, Number(age) || 0));
  const covNum = Number(coverage.replace(/[^0-9]/g, "")) || 0;

  // 매우 단순화된 위험률 모델 (참고용)
  // base: 보장금액 1천만 원당 월 800원
  const base = (covNum / 10_000_000) * 800;

  // 연령 가산: 30세 1.0배, 10년 +0.6배
  const ageFactor = 1 + Math.max(0, ageNum - 30) * 0.06;

  // 성별: 남성 1.0, 여성 0.85
  const genderFactor = gender === "male" ? 1.0 : 0.85;

  // 흡연: 1.3배
  const smokeFactor = smoker ? 1.3 : 1.0;

  const center = base * ageFactor * genderFactor * smokeFactor;
  const low = center * 0.8;
  const high = center * 1.25;

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="age">
            나이 (만)
          </label>
          <input
            id="age"
            inputMode="numeric"
            className="input-base"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="예: 35"
          />
        </div>

        <div>
          <label className="label-base">성별</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGender("male")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                gender === "male"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              남성
            </button>
            <button
              type="button"
              onClick={() => setGender("female")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                gender === "female"
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
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
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
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
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
          <label className="label-base" htmlFor="coverage">
            보장금액 (원)
          </label>
          <AmountInput
            id="coverage"
            value={coverage}
            onChange={setCoverage}
            placeholder="예: 100,000,000"
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() => setSubmitted(true)}
        >
          예상 보험료 계산하기
        </button>
      </div>

      {submitted && covNum > 0 && ageNum > 0 && (
        <div className="mt-8">
          <ResultCard
            title="예상 월 보험료 범위 (참고용 추정)"
            items={[
              { label: "최저 추정", value: won(low) },
              { label: "중심값", value: won(center), highlight: true },
              { label: "최고 추정", value: won(high) },
            ]}
          />
          <p className="mt-3 text-xs text-slate-500">
            ※ 본 계산은 일반적인 산정 요소를 단순화한 추정치이며, 실제 보험료는
            보험사 상품·심사 결과·특약·납입 방식에 따라 크게 달라질 수
            있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
