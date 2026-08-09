"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calculate } from "@/lib/insurance/engine/engine";
import { Coverage, Visit, Tier, Severity } from "@/lib/insurance/engine/types";

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

const btn = (active: boolean) =>
  `px-4 py-3 rounded-xl border text-sm font-semibold transition ${
    active
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
  }`;

export default function HealthCalc5th() {
  const [amount, setAmount] = useState<string>("300000");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("inpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const num = Number(amount.replace(/[^0-9]/g, "")) || 0;

  // 비급여인데 중증/비중증 미선택이면 계산 자체를 시도하지 않는다(엔진 호출 전 UI 가드).
  const needsSeverity = coverage === "non_benefit" && severity === null;

  const result = needsSeverity
    ? null
    : calculate("2026", {
        amount: num,
        coverage,
        visit,
        tier,
        severity: coverage === "non_benefit" ? (severity as Severity) : undefined,
      });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="med5-amount">
            병원비 (원)
          </label>
          <AmountInput
            id="med5-amount"
            value={amount}
            onChange={setAmount}
            placeholder="예: 300,000"
          />
        </div>

        <div>
          <label className="label-base">진료 구분</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCoverage("benefit")} className={btn(coverage === "benefit")}>
              급여
            </button>
            <button type="button" onClick={() => setCoverage("non_benefit")} className={btn(coverage === "non_benefit")}>
              비급여
            </button>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">치료 형태</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button type="button" onClick={() => setVisit("outpatient")} className={btn(visit === "outpatient")}>
              통원
            </button>
            <button type="button" onClick={() => setVisit("inpatient")} className={btn(visit === "inpatient")}>
              입원
            </button>
          </div>
        </div>

        {/* 비급여일 때만 중증/비중증 노출 (조건부) */}
        {coverage === "non_benefit" && (
          <div className="sm:col-span-2">
            <label className="label-base">질환 구분</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button type="button" onClick={() => setSeverity("critical")} className={btn(severity === "critical")}>
                중증
              </button>
              <button type="button" onClick={() => setSeverity("non_critical")} className={btn(severity === "non_critical")}>
                비중증
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              중증·비중증 구분은 가입 상품의 약관과 적용 기준을 확인해 선택해 주세요. 정확한 분류가
              필요한 경우 보험사 안내를 확인하시기 바랍니다.
            </p>
          </div>
        )}

        {/* 급여 통원일 때만 의료기관 구분 (계산은 보류되지만 입력 흐름은 유지) */}
        {coverage === "benefit" && visit === "outpatient" && (
          <div className="sm:col-span-2">
            <label className="label-base">방문 의료기관</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button type="button" onClick={() => setTier("clinic")} className={btn(tier === "clinic")}>
                병·의원급
              </button>
              <button type="button" onClick={() => setTier("hospital")} className={btn(tier === "hospital")}>
                상급종합·종합병원
              </button>
            </div>
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
          {needsSeverity && (
            <NoticeBox variant="info">
              비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요.
            </NoticeBox>
          )}

          {result && result.status === "PENDING_UNVERIFIED" && (
            <NoticeBox variant="warning">
              현재 5세대 급여 통원의 최소공제 기준을 공식 원문으로 추가 확인 중이라, 이 항목은 계산을
              제공하지 않습니다. 확인이 완료되는 대로 계산 기능을 열 예정입니다.
            </NoticeBox>
          )}

          {result && result.status === "OK" && num > 0 && (
            <>
              <ResultCard
                title="계산 결과 (5세대 실손 기준 · 참고용)"
                items={[
                  { label: "총 진료비", value: won(result.amount) },
                  {
                    label: `자기부담률 (${((result.rateApplied ?? 0) * 100).toFixed(0)}%${
                      result.minDeductible ? ` · 최소공제액 ${won(result.minDeductible)} 비교` : ""
                    })`,
                    value: won(result.rateBased ?? 0),
                  },
                  { label: "본인부담금", value: won(result.ownPay ?? 0), highlight: true },
                  { label: "보험 적용 금액", value: won(result.insurancePay ?? 0) },
                ]}
              />
              {result.cappedBy && (
                <NoticeBox variant="info">
                  {result.cappedBy}이 적용되어 보험 적용/본인부담 금액이 조정되었습니다.
                </NoticeBox>
              )}
              <p className="text-xs text-slate-500">
                ※ 실제 보험금은 가입 상품, 약관, 연간 누적 사용액, 차등제 등에 따라 달라질 수 있습니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
