"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcFamilyLiving, toMonths } from "@/lib/insurance/decision/familyLiving";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

interface Row {
  monthly: string; // 월 생활비
  years: string;   // 필수
  extra: string;   // 선택 0~11
}

const emptyRow = (): Row => ({ monthly: "", years: "", extra: "" });

export default function FamilyLivingCalc() {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [submitted, setSubmitted] = useState(false);

  const update = (i: number, key: keyof Row, val: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  // 미입력 판정(UI): 유효한 구간이 하나도 없으면 계산 안 함.
  // 유효 구간 = 월 생활비와 연 수가 모두 채워진 구간.
  const validRows = rows.filter((r) => r.monthly.trim() !== "" && r.years.trim() !== "");
  const canCalc = validRows.length > 0;

  const result = canCalc
    ? calcFamilyLiving(
        validRows.map((r) => ({
          monthlyLiving: onlyNum(r.monthly),
          months: toMonths(onlyNum(r.years), r.extra ? onlyNum(r.extra) : 0),
        }))
      )
    : null;

  return (
    <div className="card">
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-500">구간 {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-xs text-slate-400 hover:text-red-500">
                  삭제
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-base">월 생활비 (원)</label>
                <AmountInput id={`fl-m-${i}`} value={r.monthly} onChange={(v) => update(i, "monthly", v)} placeholder="예: 3,000,000" />
              </div>
              <div>
                <label className="label-base">기간</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <AmountInput id={`fl-y-${i}`} value={r.years} onChange={(v) => update(i, "years", v)} placeholder="예: 10" />
                  </div>
                  <span className="text-slate-500 text-sm">년</span>
                  <div className="w-20">
                    <AmountInput id={`fl-e-${i}`} value={r.extra} onChange={(v) => update(i, "extra", v)} placeholder="0" />
                  </div>
                  <span className="text-slate-500 text-sm">개월</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={addRow} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300">
          + 생활비 구간 추가
        </button>
        <button
          type="button"
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canCalc}
          onClick={() => setSubmitted(true)}
        >
          총 유족 생활비 계산하기
        </button>
      </div>
      {!canCalc && (
        <p className="mt-2 text-xs text-slate-500">각 구간의 월 생활비와 기간(연)을 입력해 주세요.</p>
      )}

      {submitted && result && (
        <div className="mt-8 space-y-4">
          <ResultCard
            title="계산 결과"
            items={[
              ...result.segments.map((seg, i) => ({
                label: `구간 ${i + 1} (${Math.floor(seg.months / 12)}년${seg.months % 12 ? ` ${seg.months % 12}개월` : ""})`,
                value: won(seg.amount),
              })),
              { label: "총 유족 생활비", value: won(result.total), highlight: true },
            ]}
          />
          <NoticeBox variant="info">
            이 계산기는 입력하신 생활비를 합산할 뿐, 적정 생활비나 필요 보장액을 정하지 않습니다.
            물가상승률·평균 생활비 같은 추정값은 넣지 않았습니다.
          </NoticeBox>
        </div>
      )}
    </div>
  );
}
