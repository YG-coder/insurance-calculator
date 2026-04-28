"use client";

import { useMemo, useState } from "react";
import ResultCard from "../ResultCard";
import {
  calcCarInsurance,
  type AccidentHistory,
} from "@/lib/calculators/insurance";

export default function CarCalc() {
  const [age, setAge] = useState("35");
  const [career, setCareer] = useState("5");
  const [accident, setAccident] = useState<AccidentHistory>("0");
  const [carPrice, setCarPrice] = useState("25000000");

  const result = useMemo(() => {
    return calcCarInsurance({
      age: Number(age) || 0,
      career: Number(career) || 0,
      accident,
      carPrice: Number(carPrice) || 0,
    });
  }, [age, career, accident, carPrice]);

  const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

  return (
      <div className="space-y-6">
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label-base" htmlFor="age">
                나이
              </label>
              <input
                  id="age"
                  type="number"
                  min={18}
                  max={100}
                  className="input-base"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div>
              <label className="label-base" htmlFor="career">
                운전 경력 (년)
              </label>
              <input
                  id="career"
                  type="number"
                  min={0}
                  className="input-base"
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
              />
            </div>

            <div>
              <label className="label-base">최근 3년 사고 이력</label>
              <div className="grid grid-cols-3 gap-2">
                {(["0", "1", "2+"] as const).map((v) => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => setAccident(v)}
                        className={`px-3 py-3 rounded-xl text-sm font-semibold transition ${
                            accident === v
                                ? "bg-brand-600 text-white"
                                : "bg-slate-100 text-slate-700"
                        }`}
                    >
                      {v === "0" ? "무사고" : v === "1" ? "1건" : "2건 이상"}
                    </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-base" htmlFor="price">
                차량가액 (원)
              </label>
              <input
                  id="price"
                  type="number"
                  min={0}
                  step={1000000}
                  className="input-base"
                  value={carPrice}
                  onChange={(e) => setCarPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        <ResultCard
            items={[
              { label: "예상 연 보험료 (최소)", value: fmt(result.min) },
              {
                label: "예상 연 보험료 (최대)",
                value: fmt(result.max),
                highlight: true,
              },
            ]}
        />
      </div>
  );
}