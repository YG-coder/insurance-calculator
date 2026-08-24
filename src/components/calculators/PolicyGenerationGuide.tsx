"use client";

import { useState } from "react";
import Link from "next/link";
import { generationFromPolicyDate } from "@/lib/insurance/engine/generationFromPolicyDate";

export default function PolicyGenerationGuide() {
  const [date, setDate] = useState("");
  const generation = generationFromPolicyDate(date);

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="block text-sm font-semibold text-slate-800" htmlFor="policy-start-date">
        내 실손보험 세대 확인
      </label>
      <p className="mt-1 text-xs text-slate-600">보험증권의 최초 계약일을 입력하세요. 갱신일이 아닙니다.</p>
      <input
        id="policy-start-date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {date && generation === "2021" && (
        <p className="mt-3 text-sm text-slate-700">4세대 가입 시기에 해당합니다. 아래 4세대 계산기를 이용하세요.</p>
      )}
      {date && generation === "2026" && (
        <p className="mt-3 text-sm text-slate-700">
          5세대 가입 시기에 해당합니다. <Link className="font-semibold text-brand-700 underline" href="/5th-generation-health-insurance-calculator">5세대 계산기로 이동</Link>
        </p>
      )}
      {date && generation === "LEGACY" && (
        <p className="mt-3 text-sm text-amber-800">1~3세대 가입 시기에 해당해 현재 계산 대상이 아닙니다. 정확한 세대와 보장은 보험증권·약관을 확인하세요.</p>
      )}
    </section>
  );
}
