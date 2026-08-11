"use client";

import { useState } from "react";
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
          .filter((r) => r.amount.trim() !== "")
          .map((r) => ({ name: r.name, amount: onlyNum(r.amount) }))
      )
    : null;

  return (
    <div className="card">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_auto] gap-3 items-end">
            <div>
              {i === 0 && <label className="label-base">보험사 이름 <span className="text-slate-400 font-normal">(선택)</span></label>}
              <input
                type="text"
                value={r.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder={`견적 ${String.fromCharCode(65 + i)}`}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              {i === 0 && <label className="label-base">견적 금액 (원)</label>}
              <AmountInput id={`car-a-${i}`} value={r.amount} onChange={(v) => update(i, "amount", v)} placeholder="예: 850,000" />
            </div>
            <div>
              {rows.length > 2 && (
                <button type="button" onClick={() => removeRow(i)} className="px-3 py-3 text-xs text-slate-400 hover:text-red-500">
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {rows.length < 6 && (
          <button type="button" onClick={addRow} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300">
            + 견적 추가
          </button>
        )}
        <button
          type="button"
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canCalc}
          onClick={() => setSubmitted(true)}
        >
          견적 비교하기
        </button>
      </div>
      {!canCalc && <p className="mt-2 text-xs text-slate-500">비교하려면 견적 금액을 2개 이상 입력해 주세요.</p>}

      {submitted && result && result.status === "OK" && (
        <div className="mt-8 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
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
              <p className="text-xl font-bold text-slate-900">{won(result.gap ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">월 환산 차액 (÷12)</p>
              <p className="text-xl font-bold text-slate-900">{won(result.monthlyGap ?? 0)}</p>
            </div>
          </div>

          <NoticeBox variant="info">
            이 계산기는 입력하신 견적을 비교할 뿐, 어느 보험사가 더 좋은지 판단하지 않습니다. 최저 견적
            표시는 단순 사실 안내이며, 실제 가입 조건(보장 범위·특약·자기부담금)이 서로 같은지도 함께
            확인하시기 바랍니다.
          </NoticeBox>
        </div>
      )}
    </div>
  );
}
