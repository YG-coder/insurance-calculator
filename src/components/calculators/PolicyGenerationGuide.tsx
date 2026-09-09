"use client";

import { useState } from "react";
import Link from "next/link";
import { generationFromPolicyDate } from "@/lib/insurance/engine/generationFromPolicyDate";

export default function PolicyGenerationGuide() {
  const [date, setDate] = useState("");
  const [hasChangedPolicy, setHasChangedPolicy] = useState(false);
  const generation = hasChangedPolicy ? "INVALID" : generationFromPolicyDate(date);

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="block text-sm font-semibold text-slate-800" htmlFor="policy-start-date">
        내 실손보험 세대 확인
      </label>
      <p className="mt-1 text-xs text-slate-600">보험증권의 최초 계약일을 입력하세요. 갱신일이 아닙니다.</p>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={hasChangedPolicy} onChange={(event) => setHasChangedPolicy(event.target.checked)} />
        실손보험을 전환하거나 재가입한 적이 있습니다
      </label>
      {hasChangedPolicy && (
        <div className="mt-3 text-sm text-slate-700">
          <p>전환·재가입한 계약은 최초 가입일만으로 현재 세대를 판단할 수 없습니다. 현재 보험증권의 상품명과 적용 약관을 확인한 뒤 계산기를 선택하세요.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link className="text-brand-700 underline" href="/2nd-3rd-generation-health-insurance-calculator">2·3세대 계산기</Link>
            <Link className="text-brand-700 underline" href="/health-insurance-calculator">4세대 계산기</Link>
            <Link className="text-brand-700 underline" href="/5th-generation-health-insurance-calculator">5세대 계산기</Link>
          </div>
        </div>
      )}
      <input
        id="policy-start-date"
        type="date"
        disabled={hasChangedPolicy}
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
