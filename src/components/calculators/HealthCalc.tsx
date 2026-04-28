"use client";

import { useMemo, useState } from "react";
import ResultCard from "../ResultCard";
import {
  calcHealthInsurance,
  type HealthInsuranceType,
  type VisitType,
} from "@/lib/calculators/insurance";

export default function HealthCalc() {
  const [total, setTotal] = useState("100000");
  const [type, setType] = useState<HealthInsuranceType>("covered");
  const [visit, setVisit] = useState<VisitType>("outpatient");

  const result = useMemo(() => {
    return calcHealthInsurance({
      amount: Number(total) || 0,
      type,
      visit,
    });
  }, [total, type, visit]);

  const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

  return (
      <div className="space-y-6">
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="label-base" htmlFor="total">
                총 병원비 (원)
              </label>
              <input
                  id="total"
                  type="number"
                  min={0}
                  className="input-base"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="예: 100000"
              />
            </div>

            <div>
              <label className="label-base">진료 구분</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setType("covered")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        type === "covered"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  급여
                </button>
                <button
                    type="button"
                    onClick={() => setType("non-covered")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        type === "non-covered"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  비급여
                </button>
              </div>
            </div>

            <div>
              <label className="label-base">치료 형태</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setVisit("outpatient")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        visit === "outpatient"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  통원
                </button>
                <button
                    type="button"
                    onClick={() => setVisit("inpatient")}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
                        visit === "inpatient"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  입원
                </button>
              </div>
            </div>
          </div>
        </div>

        <ResultCard
            items={[
              { label: "본인부담률 (추정)", value: `${result.rate}%` },
              { label: "예상 본인부담금", value: fmt(result.selfPay) },
              {
                label: "예상 보험 적용 금액",
                value: fmt(result.insured),
                highlight: true,
              },
            ]}
        />
      </div>
  );
}