"use client";

import { useState } from "react";
import { focusAfterUpdate } from "./focusAfterUpdate";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcCarQuoteCompare } from "@/lib/insurance/decision/carQuoteCompare";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

interface Row { name: string; amount: string; }
const emptyRow = (): Row => ({ name: "", amount: "" });

export default function CarCalc() {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [submitted, setSubmitted] = useState(false);

  const update = (i: number, key: keyof Row, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows((prev) => (prev.length < 6 ? [...prev, emptyRow()] : prev));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  // 유효 견적 = 금액 입력된(빈 문자열 아님) 행. 최소 2개.
  const validCount = rows.filter((r) => r.amount.trim() !== "").length;
  const canCalc = validCount >= 2;

  const result = canCalc
      ? calcCarQuoteCompare(
        rows
          .map((r) => ({ name: r.name, amount: onlyNum(r.amount) }))
      )
    : null;

  return (
    <div className="card">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_auto] gap-3 items-end">
            <div>
              {i === 0 && <label className="label-base" htmlFor="car-n-0">보험사 이름 <span className="text-slate-500 font-normal">(선택)</span></label>}
              <input
                id={`car-n-${i}`}
                type="text"
                aria-label={`견적 ${String.fromCharCode(65 + i)} 보험사 이름`}
                value={r.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder={`견적 ${String.fromCharCode(65 + i)}`}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              {i === 0 && <label className="label-base" htmlFor="car-a-0">연간 견적 금액 (원)</label>}
              <AmountInput id={`car-a-${i}`} value={r.amount} onChange={(v) => update(i, "amount", v)} placeholder="예: 850,000" aria-label={`견적 ${String.fromCharCode(65 + i)} 연간 견적 금액 (원)`} />
            </div>
            <div>
              {rows.length > 2 && (
                <button type="button" aria-label={`견적 ${String.fromCharCode(65 + i)} 삭제`} onClick={() => focusAfterUpdate(() => removeRow(i), `car-n-${Math.min(i, rows.length - 2)}`)} className="px-3 py-3 text-xs text-slate-500 hover:text-red-500">
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {rows.length < 6 && (
          <button type="button" onClick={() => focusAfterUpdate(addRow, `car-n-${rows.length}`)} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300">
            + 견적 추가
          </button>
        )}
        <button
          type="button"
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canCalc}
          onClick={() => focusAfterUpdate(() => setSubmitted(true), "car-blocked-summary")}
        >
          견적 비교하기
        </button>
      </div>
      {!canCalc && <p className="mt-2 text-xs text-slate-500" role="status" aria-live="polite">비교하려면 견적 금액을 2개 이상 입력해 주세요.</p>}

      {submitted && result?.status === "NEED_MORE" && (
        <div id="car-blocked-summary" role="alert" tabIndex={-1} className="mt-5"><NoticeBox variant="warning">비교하려면 0원보다 큰 견적 금액을 2개 이상 입력해 주세요. 0원과 미입력 견적은 비교에서 제외합니다.</NoticeBox></div>
      )}
      {submitted && result && result.status === "OK" && (
        <div className="mt-8 space-y-4">
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">비교 결과. {result.quotes.length}개 견적의 최고·최저 차액 {won(result.gap ?? 0)}.{result.quotes.length < rows.length ? ` 0원 또는 미입력 ${rows.length - result.quotes.length}개 견적은 제외했습니다.` : ""}</p>
          {result.quotes.length < rows.length && <NoticeBox variant="info">0원 또는 금액이 비어 있는 {rows.length - result.quotes.length}개 견적은 비교에서 제외했습니다.</NoticeBox>}
          <div tabIndex={0} role="region" aria-label="자동차보험 견적 비교표 (가로 스크롤 가능)" className="overflow-x-auto rounded-2xl border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">견적</th>
                  <th className="text-right px-4 py-3 font-semibold">금액</th>
                  <th className="text-right px-4 py-3 font-semibold">구분</th>
                </tr>
              </thead>
              <tbody>
                {result.quotes.map((q, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{q.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{won(q.amount)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {q.isLowest && q.isHighest ? "—" : q.isLowest ? "최저" : q.isHighest ? "최고" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">최고−최저 차액</p>
              <p className="break-all text-xl font-bold text-slate-900">{won(result.gap ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">월 환산 차액 (연간 차액 ÷ 12개월)</p>
              <p className="break-all text-xl font-bold text-slate-900">{won(result.monthlyGap ?? 0)}</p>
            </div>
          </div>

          <NoticeBox variant="info">
            입력 금액은 1년치 자동차보험 견적을 전제로 하며, 월 환산 차액은 연간 차액을 12개월로 단순
            나눈 값입니다. 이 계산기는 어느 보험사가 더 좋은지 판단하지 않습니다. 최저 견적 표시는 단순
            사실 안내이며, 실제 가입 조건(보장 범위·특약·자기부담금)이 서로 같은지도 함께 확인하시기 바랍니다.
          </NoticeBox>
        </div>
      )}
    </div>
  );
}
