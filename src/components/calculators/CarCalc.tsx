"use client";

import { useState, useMemo } from "react";
import ResultCard from "@/components/ResultCard";

type CarType = "compact" | "midsize" | "fullsize" | "suv" | "import";

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

const CAR_FACTOR: Record<CarType, number> = {
  compact: 0.8,
  midsize: 1.0,
  fullsize: 1.3,
  suv: 1.2,
  import: 1.8,
};

const CAR_LABEL: Record<CarType, string> = {
  compact: "경/소형",
  midsize: "중형",
  fullsize: "대형",
  suv: "SUV",
  import: "수입차",
};

function driverAgeFactor(age: number) {
  if (age < 21) return 2.5;
  if (age < 26) return 1.7;
  if (age < 30) return 1.3;
  if (age < 50) return 1.0;
  if (age < 60) return 1.05;
  if (age < 70) return 1.2;
  return 1.5;
}

function experienceFactor(years: number) {
  if (years < 1) return 1.4;
  if (years < 3) return 1.2;
  if (years < 5) return 1.05;
  if (years < 10) return 0.95;
  return 0.85;
}

function accidentFactor(count: number) {
  if (count <= 0) return 0.9;
  if (count === 1) return 1.15;
  if (count === 2) return 1.4;
  return 1.8;
}

export default function CarCalc() {
  const [age, setAge] = useState<string>("");
  const [experience, setExperience] = useState<string>("");
  const [accidents, setAccidents] = useState<string>("0");
  const [carType, setCarType] = useState<CarType>("midsize");
  const [carValue, setCarValue] = useState<string>("25000000");

  const result = useMemo(() => {
    const ageNum = parseInt(age, 10);
    const expNum = parseInt(experience, 10);
    const accNum = parseInt(accidents, 10);
    const value = parseInt(carValue.replace(/[^0-9]/g, ""), 10);

    if (!ageNum || ageNum < 18 || ageNum > 100) return null;
    if (isNaN(expNum) || expNum < 0) return null;
    if (!value || value <= 0) return null;

    // 차량가액 1천만 원당 기본 보험료 (참고용 단순화)
    const basePerTenMillion = 200_000;
    const tenMillions = value / 10_000_000;

    const factor =
      CAR_FACTOR[carType] *
      driverAgeFactor(ageNum) *
      experienceFactor(expNum) *
      accidentFactor(accNum);

    const yearly = Math.round(basePerTenMillion * tenMillions * factor);
    const monthly = Math.round(yearly / 12);
    const low = Math.round(yearly * 0.8);
    const high = Math.round(yearly * 1.2);

    return { yearly, monthly, low, high };
  }, [age, experience, accidents, carType, carValue]);

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base">운전자 연령</label>
          <input
            type="number"
            min={18}
            max={100}
            placeholder="예: 35"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">운전 경력 (년)</label>
          <input
            type="number"
            min={0}
            max={70}
            placeholder="예: 5"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <label className="label-base">최근 3년 사고 건수</label>
          <select
            value={accidents}
            onChange={(e) => setAccidents(e.target.value)}
            className="input-base"
          >
            <option value="0">무사고</option>
            <option value="1">1건</option>
            <option value="2">2건</option>
            <option value="3">3건 이상</option>
          </select>
        </div>

        <div>
          <label className="label-base">차종</label>
          <select
            value={carType}
            onChange={(e) => setCarType(e.target.value as CarType)}
            className="input-base"
          >
            {Object.entries(CAR_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">차량가액</label>
          <select
            value={carValue}
            onChange={(e) => setCarValue(e.target.value)}
            className="input-base"
          >
            <option value="10000000">1,000만 원</option>
            <option value="15000000">1,500만 원</option>
            <option value="20000000">2,000만 원</option>
            <option value="25000000">2,500만 원</option>
            <option value="30000000">3,000만 원</option>
            <option value="40000000">4,000만 원</option>
            <option value="50000000">5,000만 원</option>
            <option value="70000000">7,000만 원</option>
            <option value="100000000">1억 원</option>
          </select>
        </div>
      </div>

      {result ? (
        <div className="mt-6">
          <ResultCard
            title="예상 자동차보험료 (참고용)"
            items={[
              { label: "예상 연 보험료", value: formatKRW(result.yearly), highlight: true },
              { label: "월 환산", value: formatKRW(result.monthly) },
              {
                label: "최저 ~ 최고 (보험사 변동성)",
                value: `${formatKRW(result.low)} ~ ${formatKRW(result.high)}`,
              },
            ]}
          />
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            동일 조건이라도 보험사·담보 구성·특약·블랙박스 할인 등에 따라 실제 보험료는 크게 달라질 수 있습니다.
            <strong> 다이렉트 자동차보험 비교 견적</strong>을 통해 정확한 금액을 확인하시기 바랍니다.
          </p>
        </div>
      ) : (
        <div className="mt-6 text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          연령, 경력, 차량 정보를 입력하면 예상 보험료가 자동으로 계산됩니다.
        </div>
      )}
    </div>
  );
}
