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
        <p className="mt-3 text-sm text-slate-700">
          4세대 가입 시기에 해당합니다. <Link className="font-semibold text-brand-700 underline" href="/health-insurance-calculator">4세대 계산기로 이동</Link>
        </p>
      )}
      {date && generation === "2026" && (
        <p className="mt-3 text-sm text-slate-700">
          5세대 가입 시기에 해당합니다. <Link className="font-semibold text-brand-700 underline" href="/5th-generation-health-insurance-calculator">5세대 계산기로 이동</Link>
        </p>
      )}
      {date && (generation === "2009" || generation === "2017") && (
        <p className="mt-3 text-sm text-slate-700">
          {generation === "2009" ? "2세대(표준화 실손)" : "3세대(착한실손)"} 가입 시기에 해당합니다.{" "}
          <Link className="font-semibold text-brand-700 underline" href="/2nd-3rd-generation-health-insurance-calculator">2·3세대 계산기로 이동</Link>
        </p>
      )}
      {date && generation === "PRE_STANDARD" && (
        <p className="mt-3 text-sm text-amber-800">
          실손 표준약관이 만들어지기 전(2009년 10월 이전) 가입 시기입니다. 이 시기 상품은 표준화되지 않아
          보장 내용과 자기부담이 상품마다 다릅니다. 근거로 삼을 표준약관이 없어 계산 결과를 제공하지 않으니,
          가입하신 <b>보험증권과 개별 약관</b>에서 자기부담 조건을 확인해 주세요.
        </p>
      )}
    </section>
  );
}
