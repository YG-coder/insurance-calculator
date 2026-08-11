"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcCoverageGap } from "@/lib/insurance/decision/coverageGap";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

export default function CoverageGapCalc() {
  // 빈 문자열 = 미입력. "0"은 정상 입력. (0과 미입력을 구분)
  const [needed, setNeeded] = useState("");
  const [current, setCurrent] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // 미입력 판정은 UI 책임: 둘 중 하나라도 빈 문자열이면 계산하지 않는다.
  const missing = needed.trim() === "" || current.trim() === "";

  const result = missing
    ? null
    : calcCoverageGap({ needed: onlyNum(needed), current: onlyNum(current) });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="cg-needed">필요 보장금액 (원)</label>
          <AmountInput id="cg-needed" value={needed} onChange={setNeeded} placeholder="예: 500,000,000" />
        </div>
        <div>
          <label className="label-base" htmlFor="cg-current">현재 보장금액 (원)</label>
          <AmountInput id="cg-current" value={current} onChange={setCurrent} placeholder="예: 140,000,000 (없으면 0)" />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={missing}
          onClick={() => setSubmitted(true)}
        >
          보장 공백 계산하기
        </button>
        {missing && (
          <p className="mt-2 text-xs text-slate-500">
            필요 보장금액과 현재 보장금액을 모두 입력해 주세요. (보장이 없으면 0을 입력)
          </p>
        )}
      </div>

      {submitted && result && (
        <div className="mt-8 space-y-4">
          <ResultCard
            title="계산 결과"
            items={[
              { label: "필요 보장금액", value: won(result.needed) },
              { label: "현재 보장금액", value: won(result.current) },
              result.direction === "short"
                ? { label: "부족 보장금액", value: won(result.shortfall), highlight: true }
                : result.direction === "over"
                ? { label: "초과 보장금액", value: won(result.surplus), highlight: true }
                : { label: "차이", value: "없음", highlight: true },
            ]}
          />
          <div className="rounded-xl bg-brand-50 border border-brand-100 px-5 py-4 text-slate-700 leading-relaxed">
            {result.direction === "short" && (
              <>현재 보장금액이 필요 보장금액보다 <b className="text-brand-700">{won(result.shortfall)}</b> 부족합니다.</>
            )}
            {result.direction === "over" && (
              <>현재 보장금액이 필요 보장금액보다 <b className="text-brand-700">{won(result.surplus)}</b> 많습니다.</>
            )}
            {result.direction === "equal" && (
              <>현재 보장금액이 필요 보장금액과 같습니다.</>
            )}
          </div>
          <NoticeBox variant="info">
            이 계산기는 입력하신 필요 보장금액과 현재 보장금액의 차이만 계산합니다. 적정 보장금액이 얼마인지는
            계산하지 않으며(사람마다 다릅니다), 가입·해지에 대한 권유도 하지 않습니다.
          </NoticeBox>
        </div>
      )}
    </div>
  );
}
