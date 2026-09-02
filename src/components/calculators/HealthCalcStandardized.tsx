"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calculate } from "@/lib/insurance/engine/engine";
import { Facility, Plan, Visit } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";

type StdGeneration = "2009" | "2017";

const won = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

const btn = (active: boolean) =>
  `px-4 py-3 rounded-xl border text-sm font-semibold transition ${
    active
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
  }`;

const FACILITY_LABELS: Record<Facility, string> = {
  clinic: "의원급",
  hospital: "병원·종합병원",
  tertiary: "상급종합병원",
  pharmacy: "약국 처방조제",
};

export default function HealthCalcStandardized() {
  const [generation, setGeneration] = useState<StdGeneration>("2017");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [amount, setAmount] = useState<string>("300000");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [facility, setFacility] = useState<Facility>("clinic");
  const [priorAnnualPaid, setPriorAnnualPaid] = useState<string>("0");
  const [submitted, setSubmitted] = useState(false);

  const num = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const priorAnnualPaidNum = Number(priorAnnualPaid.replace(/[^0-9]/g, "")) || 0;

  const result = calculate(generation, {
    amount: num,
    // 2·3세대 기본형은 급여·비급여를 합한 금액에 단일 정률을 적용한다.
    // coverage는 요율을 가르지 않지만 ClaimInput의 필수 필드라 값을 채워 전달한다.
    coverage: "benefit",
    visit,
    facility: visit === "outpatient" ? facility : undefined,
    plan: plan ?? undefined,
    priorAnnualPaid: visit === "inpatient" ? priorAnnualPaidNum : undefined,
  });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label className="label-base">가입 세대</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button type="button" onClick={() => setGeneration("2009")} className={btn(generation === "2009")}>
              2세대 (2009.10~2017.3)
            </button>
            <button type="button" onClick={() => setGeneration("2017")} className={btn(generation === "2017")}>
              3세대 (2017.4~2021.6)
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            두 세대의 기본형 산식은 표준약관상 동일합니다. 3세대는 도수치료·주사·MRI가 별도 특약으로
            분리되어 기본형 계산에 포함되지 않습니다.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">자기부담 유형</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button type="button" onClick={() => setPlan("standard")} className={btn(plan === "standard")}>
              표준형
            </button>
            <button type="button" onClick={() => setPlan("selective")} className={btn(plan === "selective")}>
              선택형
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            보험증권의 상품명·가입내역에서 확인하세요. 가입 시기로 추정하지 않습니다. 표준형은 자기부담이
            크고 보험료가 낮으며, 선택형은 그 반대입니다.
          </p>
        </div>

        <div>
          <label className="label-base" htmlFor="std-amount">
            병원비 (원)
          </label>
          <AmountInput id="std-amount" value={amount} onChange={setAmount} placeholder="예: 300,000" />
          <p className="mt-2 text-xs text-slate-500">
            급여 본인부담금과 비급여를 합한 금액을 입력하세요(상급병실료 차액 제외).
          </p>
        </div>

        <div>
          <label className="label-base">치료 형태</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setVisit("outpatient")} className={btn(visit === "outpatient")}>
              통원
            </button>
            <button type="button" onClick={() => setVisit("inpatient")} className={btn(visit === "inpatient")}>
              입원
            </button>
          </div>
        </div>

        {visit === "outpatient" && (
          <div className="sm:col-span-2">
            <label className="label-base">방문 구분</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(FACILITY_LABELS) as Facility[]).map((key) => (
                <button key={key} type="button" onClick={() => setFacility(key)} className={btn(facility === key)}>
                  {FACILITY_LABELS[key]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              약관 &lt;표1&gt;의 항목별 공제금액 분류입니다. 종합병원은 병원급(1만 5천 원)에 해당하며,
              4세대의 분류와 다릅니다.
            </p>
          </div>
        )}

        {visit === "inpatient" && (
          <div className="sm:col-span-2 max-w-md">
            <label className="label-base" htmlFor="std-prior-annual-paid">
              계약해당일 기준 1년간 이미 부담한 입원 자기부담금 (원)
            </label>
            <AmountInput
              id="std-prior-annual-paid"
              value={priorAnnualPaid}
              onChange={setPriorAnnualPaid}
              placeholder="없으면 0"
            />
            <p className="mt-2 text-xs text-slate-500">
              입원 자기부담은 계약일 또는 매년 계약해당일부터 1년간 200만 원이 상한이며, 초과분은 보험이
              부담합니다. 이미 부담한 금액을 입력하면 상한에 누적 반영됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setSubmitted(true)}>
          자기부담금 계산하기
        </button>
      </div>

      {submitted && (
        <div className="mt-8 space-y-4">
          {result.status === "PENDING_UNVERIFIED" && (
            <NoticeBox variant="warning">
              <b>표준형 / 선택형</b>을 선택해 주세요. 두 유형은 자기부담률과 통원 공제 방식이 다릅니다.
            </NoticeBox>
          )}

          {result.status === "OK" && num > 0 && (
            <>
              <ResultCard
                title={`계산 결과 (${generation === "2009" ? "2세대" : "3세대"} 실손 기본형 기준 · 참고용)`}
                items={[
                  { label: "총 진료비", value: won(result.amount) },
                  {
                    label:
                      result.rateApplied && result.rateApplied > 0
                        ? `자기부담률 (${((result.rateApplied ?? 0) * 100).toFixed(0)}%${
                            result.minDeductible ? ` · 공제금액 ${won(result.minDeductible)} 비교` : ""
                          })`
                        : `정액 공제금액 (${won(result.minDeductible ?? 0)})`,
                    value: won(
                      result.rateApplied && result.rateApplied > 0
                        ? result.rateBased ?? 0
                        : result.minDeductible ?? 0,
                    ),
                  },
                  { label: "본인부담금", value: won(result.ownPay ?? 0), highlight: true },
                  { label: "보험 적용 금액", value: won(result.insurancePay ?? 0) },
                ]}
              />
              {result.appliedCaps.length > 0 && (
                <NoticeBox variant="info">
                  적용된 한도: {result.appliedCaps.map((code) => CAP_LABELS[code]).join(", ")}. 보험 적용/본인부담 금액이 조정되었습니다.
                </NoticeBox>
              )}
              {result.notes.length > 0 && <NoticeBox variant="info">{result.notes.join(" ")}</NoticeBox>}
              <p className="text-xs text-slate-500">
                ※ 실제 보험금은 가입 상품, 약관, 연간 누적 사용액, 가입금액 설정에 따라 달라질 수 있습니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
