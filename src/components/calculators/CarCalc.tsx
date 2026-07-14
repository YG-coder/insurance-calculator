"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

export default function CarCalc() {
  const [age, setAge] = useState<string>("35");
  const [years, setYears] = useState<string>("5"); // 운전 경력
  const [accidents, setAccidents] = useState<string>("0"); // 최근 3년 사고
  const [carValue, setCarValue] = useState<string>("25000000"); // 차량가액
  const [submitted, setSubmitted] = useState(false);

  const ageNum = Math.min(80, Math.max(18, Number(age) || 0));
  const yearsNum = Math.min(50, Math.max(0, Number(years) || 0));
  const accNum = Math.min(10, Math.max(0, Number(accidents) || 0));
  const valNum = Number(carValue.replace(/[^0-9]/g, "")) || 0;

  // 단순화된 자동차보험료 모델 (참고용)
  // 기본료: 차량가액의 4% 연납
  const baseAnnual = valNum * 0.04;

  // 연령 요율: 26세 이상 1.0, 21~25세 1.2, 21세 미만 1.5
  const ageFactor = ageNum >= 26 ? 1.0 : ageNum >= 21 ? 1.2 : 1.5;

  // 경력 할인: 1년 -3%, 최대 -30%
  const expDiscount = Math.min(0.3, yearsNum * 0.03);

  // 사고 할증: 1건 +15%
  const accFactor = 1 + accNum * 0.15;

  const annual = baseAnnual * ageFactor * accFactor * (1 - expDiscount);
  const monthly = annual / 12;
  const low = annual * 0.85;
  const high = annual * 1.2;

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="car-age">
            나이 (만)
          </label>
          <input
            id="car-age"
            inputMode="numeric"
            className="input-base"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="예: 35"
          />
        </div>

        <div>
          <label className="label-base" htmlFor="car-years">
            운전 경력 (년)
          </label>
          <input
            id="car-years"
            inputMode="numeric"
            className="input-base"
            value={years}
            onChange={(e) => setYears(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="예: 5"
          />
        </div>

        <div>
          <label className="label-base" htmlFor="car-acc">
            최근 3년 사고 건수
          </label>
          <input
            id="car-acc"
            inputMode="numeric"
            className="input-base"
            value={accidents}
            onChange={(e) =>
              setAccidents(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="예: 0"
          />
        </div>

        <div>
          <label className="label-base" htmlFor="car-value">
            차량가액 (원)
          </label>
          <input
            id="car-value"
            inputMode="numeric"
            className="input-base"
            value={carValue}
            onChange={(e) =>
              setCarValue(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="예: 25000000"
          />
          <p className="mt-2 text-xs text-slate-500">
            현재 차량가액: {won(valNum)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() => setSubmitted(true)}
        >
          예상 자동차보험료 계산하기
        </button>
      </div>

      {submitted && valNum > 0 && (
        <div className="mt-8">
          <ResultCard
            title="예상 자동차보험료 (연납 기준 · 참고용)"
            items={[
              { label: "최저 추정 (연)", value: won(low) },
              { label: "중심값 (연)", value: won(annual), highlight: true },
              { label: "최고 추정 (연)", value: won(high) },
              { label: "월 환산 (중심값)", value: won(monthly) },
            ]}
          />
          <p className="mt-3 text-xs text-slate-500">
            ※ 본 계산 결과는 임의의 단순 추정 배율을 적용한 참고값이며, 보험개발원
            또는 개별 보험사의 실제 보험료 산출 요율을 적용한 견적이 아닙니다.
            실제 보험료는 차종, 운행 거리, 가입담보, 특약, 보험사별 요율에 따라
            크게 달라질 수 있으니 보험다모아나 각 보험사 다이렉트 견적으로 반드시
            확인하시기 바랍니다.
          </p>
        </div>
      )}
    </div>
  );
}
