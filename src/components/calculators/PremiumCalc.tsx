"use client";

import { useMemo, useState } from "react";
import ResultCard from "../ResultCard";
import {
  calcInsurancePremium,
  type Gender,
  type SmokeStatus,
} from "@/lib/calculators/insurance";

export default function PremiumCalc() {
  const [age, setAge] = useState("35");
  const [gender, setGender] = useState<Gender>("male");
  const [smoke, setSmoke] = useState<SmokeStatus>("no");
  const [coverage, setCoverage] = useState("100000000");

  const result = useMemo(() => {
    return calcInsurancePremium({
      age: Number(age) || 0,
      gender,
      smoke,
      coverage: Number(coverage) || 0,
    });
  }, [age, gender, smoke, coverage]);

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
                  min={0}
                  max={100}
                  className="input-base"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div>
              <label className="label-base">성별</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setGender("male")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        gender === "male"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700"
                    }`}
                >
                  남성
                </button>
                <button
                    type="button"
                    onClick={() => setGender("female")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        gender === "female"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700"
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
                    onClick={() => setSmoke("no")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        smoke === "no"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700"
                    }`}
                >
                  비흡연
                </button>
                <button
                    type="button"
                    onClick={() => setSmoke("yes")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        smoke === "yes"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700"
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
              <input
                  id="coverage"
                  type="number"
                  min={0}
                  step={10000000}
                  className="input-base"
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
              />
            </div>
          </div>
        </div>

        <ResultCard
            items={[
              { label: "예상 월 보험료 (최소)", value: fmt(result.min) },
              {
                label: "예상 월 보험료 (최대)",
                value: fmt(result.max),
                highlight: true,
              },
            ]}
        />
      </div>
  );
}