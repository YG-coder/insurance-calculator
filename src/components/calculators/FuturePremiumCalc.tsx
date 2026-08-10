"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcFuturePremium } from "@/lib/insurance/decision/futurePremium";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (n: number) => `${n.toFixed(1)}%`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

export default function FuturePremiumCalc() {
  const [monthly, setMonthly] = useState("180000");
  const [remaining, setRemaining] = useState("120");
  const [paid, setPaid] = useState(""); // 선택
  const [submitted, setSubmitted] = useState(false);

  const result = calcFuturePremium({
    monthlyPremium: onlyNum(monthly),
    remainingMonths: onlyNum(remaining),
    paidMonths: paid ? onlyNum(paid) : undefined,
  });

  const hasPaid = paid !== "";

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="fp-monthly">월 보험료 (원)</label>
          <AmountInput id="fp-monthly" value={monthly} onChange={setMonthly} placeholder="예: 180,000" />
        </div>
        <div>
          <label className="label-base" htmlFor="fp-remain">남은 납입 개월 수</label>
          <AmountInput id="fp-remain" value={remaining} onChange={setRemaining} placeholder="예: 120" />
        </div>
        <div>
          <label className="label-base" htmlFor="fp-paid">
            기납입 개월 수 <span className="text-slate-400 font-normal">(선택)</span>
          </label>
          <AmountInput id="fp-paid" value={paid} onChange={setPaid} placeholder="입력 시 완납 총액·부담 비중까지 계산" />
        </div>
      </div>

      <div className="mt-6">
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setSubmitted(true)}>
          앞으로 낼 보험료 계산하기
        </button>
      </div>

      {submitted && (
        <div className="mt-8 space-y-4">
          {result.status === "NEED_INPUT" ? (
            <NoticeBox variant="info">{result.notes[0]}</NoticeBox>
          ) : (
            <>
              <ResultCard
                title="계산 결과"
                items={[
                  { label: "앞으로 낼 보험료", value: won(result.futurePremium ?? 0), highlight: true },
                  ...(hasPaid && result.paidSoFar !== null
                    ? [
                        { label: "지금까지 낸 보험료", value: won(result.paidSoFar) },
                        { label: "완납 시 총 납입액", value: won(result.totalAtCompletion ?? 0) },
                        ...(result.futureSharePercent !== null
                          ? [{ label: "앞으로 부담 비중", value: pct(result.futureSharePercent) }]
                          : []),
                      ]
                    : []),
                ]}
              />
              {result.notes.length > 0 && result.futurePremium === 0 && (
                <NoticeBox variant="info">{result.notes[0]}</NoticeBox>
              )}
              <NoticeBox variant="info">
                현재 입력한 월 보험료가 남은 납입기간 동안 동일하다고 가정한 계산입니다. 갱신형 보험의 실제
                보험료는 달라질 수 있습니다.
              </NoticeBox>
            </>
          )}
        </div>
      )}
    </div>
  );
}
