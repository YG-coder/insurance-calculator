"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcSurrender, SurrenderMode } from "@/lib/insurance/decision/surrenderValue";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (n: number) => `${n.toFixed(1)}%`;

const btn = (active: boolean) =>
  `px-4 py-3 rounded-xl border text-sm font-semibold transition ${
    active ? "bg-brand-600 text-white border-brand-600"
           : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
  }`;

const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

export default function HealthSurrenderCalc() {
  const [mode, setMode] = useState<SurrenderMode>("known");
  const [monthly, setMonthly] = useState("180000");
  const [paidMonths, setPaidMonths] = useState("24");
  const [surrender, setSurrender] = useState("3000000"); // known
  const [estRate, setEstRate] = useState(""); // estimate: 예상 환급률
  const [remaining, setRemaining] = useState(""); // 선택
  const [submitted, setSubmitted] = useState(false);
  const [ack, setAck] = useState(false); // estimate 모드 안내 확인

  const result = calcSurrender({
    monthlyPremium: onlyNum(monthly),
    paidMonths: onlyNum(paidMonths),
    mode,
    surrenderValue: mode === "known" ? onlyNum(surrender) : undefined,
    estimatedRatePercent: mode === "estimate" && estRate ? Number(estRate.replace(/[^0-9.]/g, "")) : undefined,
    remainingMonths: remaining ? onlyNum(remaining) : undefined,
  });

  return (
    <div className="card">
      {/* 모드 선택 */}
      <div className="mb-5">
        <label className="label-base">내 해지환급금을 알고 있나요?</label>
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <button type="button" onClick={() => { setMode("known"); setSubmitted(false); }} className={btn(mode === "known")}>
            알고 있어요
          </button>
          <button type="button" onClick={() => { setMode("estimate"); setSubmitted(false); }} className={btn(mode === "estimate")}>
            몰라요
          </button>
        </div>
      </div>

      {/* Mode B 안내: 환급금 모름 → 먼저 안내 후 참고 시뮬레이션 동의 */}
      {mode === "estimate" && !ack && (
        <div className="mb-5 space-y-3">
          <NoticeBox variant="warning">
            약관의 <b>해지환급금표</b>를 모르면 정확한 계산은 불가능합니다. 아래는 사용자가 직접 입력한
            예상값으로만 계산하는 <b>참고용 시뮬레이션</b>입니다. 평균 환급률·상품별 기준값은 제공하지 않습니다.
          </NoticeBox>
          <button type="button" className="btn-primary" onClick={() => setAck(true)}>
            참고 시뮬레이션 진행
          </button>
        </div>
      )}

      {(mode === "known" || ack) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label-base" htmlFor="sv-monthly">월 보험료 (원)</label>
              <AmountInput id="sv-monthly" value={monthly} onChange={setMonthly} placeholder="예: 180,000" />
            </div>
            <div>
              <label className="label-base" htmlFor="sv-paid">기납입 개월 수</label>
              <AmountInput id="sv-paid" value={paidMonths} onChange={setPaidMonths} placeholder="예: 24" />
            </div>

            {mode === "known" ? (
              <div>
                <label className="label-base" htmlFor="sv-value">현재 해지환급금 (원)</label>
                <AmountInput id="sv-value" value={surrender} onChange={setSurrender} placeholder="약관/앱에서 확인한 금액" />
              </div>
            ) : (
              <div>
                <label className="label-base" htmlFor="sv-rate">예상 환급률 (%) — 직접 입력</label>
                <input
                  id="sv-rate" inputMode="decimal" value={estRate}
                  onChange={(e) => setEstRate(e.target.value)}
                  placeholder="예: 60"
                  className="input-base w-full"
                />
              </div>
            )}

            <div>
              <label className="label-base" htmlFor="sv-remain">
                남은 납입 개월 수 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <AmountInput id="sv-remain" value={remaining} onChange={setRemaining} placeholder="입력 시 앞으로 낼 보험료까지 계산" />
            </div>
          </div>

          <div className="mt-6">
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setSubmitted(true)}>
              해지 손익 계산하기
            </button>
          </div>
        </>
      )}

      {submitted && (mode === "known" || ack) && (
        <div className="mt-8 space-y-4">
          {result.status === "NEED_INPUT" ? (
            <NoticeBox variant="info">{result.notes[0]}</NoticeBox>
          ) : (
            <>
              <ResultCard
                title={result.reference ? "계산 결과 (참고용 · 입력 가정 기반)" : "계산 결과"}
                items={[
                  { label: "총 납입보험료", value: won(result.totalPaid ?? 0) },
                  { label: result.reference ? "예상 해지환급금" : "현재 해지환급금", value: won(result.surrenderValue ?? 0) },
                  result.isGain
                    ? { label: "환급금이 납입액을 초과 (이익)", value: won(Math.abs(result.loss ?? 0)), highlight: true }
                    : { label: "납입액과 환급금 차이", value: won(result.loss ?? 0), highlight: true },
                  { label: "환급률", value: pct(result.refundRatePercent ?? 0) },
                  { label: result.isGain ? "월평균 이익" : "월평균 손실", value: won(Math.abs(result.monthlyAvgLoss ?? 0)) },
                  ...(result.futurePremium !== null
                    ? [
                        { label: "앞으로 낼 보험료", value: won(result.futurePremium) },
                        { label: "완납 시 총 납입액", value: won(result.totalAtCompletion ?? 0) },
                      ]
                    : []),
                ]}
              />
              {result.status === "OK" && !result.isGain && result.refundRatePercent !== null && (
                <div className="rounded-xl bg-brand-50 border border-brand-100 px-5 py-4 text-slate-700 leading-relaxed">
                  {result.reference ? (
                    <>입력하신 예상 기준, 지금까지 낸 보험료 중 약{" "}
                      <b className="text-brand-700">{pct(result.refundRatePercent)}</b>를 돌려받고, 약{" "}
                      <b className="text-brand-700">{pct(100 - result.refundRatePercent)}</b>는 현재 환급금에 포함되지 않습니다.</>
                  ) : (
                    <>지금까지 낸 보험료 중{" "}
                      <b className="text-brand-700">{pct(result.refundRatePercent)}</b>를 돌려받고,{" "}
                      <b className="text-brand-700">{pct(100 - result.refundRatePercent)}</b>는 현재 해지환급금에 포함되지 않습니다.</>
                  )}
                </div>
              )}
              {result.status === "OK" && result.isGain && (
                <div className="rounded-xl bg-brand-50 border border-brand-100 px-5 py-4 text-slate-700 leading-relaxed">
                  해지환급금이 지금까지 낸 보험료보다{" "}
                  <b className="text-brand-700">{won(Math.abs(result.loss ?? 0))}</b> 많습니다.
                </div>
              )}
              {result.reference && (
                <NoticeBox variant="info">
                  이 결과는 입력하신 예상값 기반의 참고 수치입니다. 정확한 금액은 약관의 해지환급금표를 확인하세요.
                </NoticeBox>
              )}
              <p className="text-xs text-slate-500">
                ※ 해지환급금은 상품·약관·경과기간에 따라 다르며, 정확한 값은 가입 보험사에서 확인하시기 바랍니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
