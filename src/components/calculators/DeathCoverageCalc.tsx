"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcDeathCoverage, toMonths } from "@/lib/insurance/decision/deathCoverage";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

export default function DeathCoverageCalc() {
  const [monthlyLiving, setMonthlyLiving] = useState("");
  const [years, setYears] = useState("");        // 필수
  const [extraMonths, setExtraMonths] = useState(""); // 선택 0~11
  const [debt, setDebt] = useState("");
  const [otherFunds, setOtherFunds] = useState("");
  const [existing, setExisting] = useState("");
  const [assets, setAssets] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // 필수: 월 생활비 + 보장 연수 (빈 문자열이면 미입력)
  const missing = monthlyLiving.trim() === "" || years.trim() === "";

  const coverageMonths = toMonths(onlyNum(years), extraMonths ? onlyNum(extraMonths) : 0);

  const result = missing
    ? null
    : calcDeathCoverage({
        monthlyLiving: onlyNum(monthlyLiving),
        coverageMonths,
        debt: debt ? onlyNum(debt) : undefined,
        otherFunds: otherFunds ? onlyNum(otherFunds) : undefined,
        existingDeathBenefit: existing ? onlyNum(existing) : undefined,
        usableAssets: assets ? onlyNum(assets) : undefined,
      });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="dc-living">월 생활비 (원)</label>
          <AmountInput id="dc-living" value={monthlyLiving} onChange={setMonthlyLiving} placeholder="유족이 매월 필요한 생활비" />
        </div>

        <div>
          <label className="label-base">생활비 보장 기간</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AmountInput id="dc-years" value={years} onChange={setYears} placeholder="예: 20" />
            </div>
            <span className="text-slate-500 text-sm">년</span>
            <div className="w-24">
              <AmountInput id="dc-extra" value={extraMonths} onChange={setExtraMonths} placeholder="0" />
            </div>
            <span className="text-slate-500 text-sm">개월</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">개월 칸은 선택(0~11). 미입력 시 0.</p>
        </div>

        <div>
          <label className="label-base" htmlFor="dc-debt">현재 남은 부채 <span className="text-slate-400 font-normal">(선택)</span></label>
          <AmountInput id="dc-debt" value={debt} onChange={setDebt} placeholder="대출 등 확정 부채" />
        </div>
        <div>
          <label className="label-base" htmlFor="dc-other">기타 목적자금 <span className="text-slate-400 font-normal">(선택)</span></label>
          <AmountInput id="dc-other" value={otherFunds} onChange={setOtherFunds} placeholder="이미 목표금액을 아는 경우만" />
        </div>
        <div>
          <label className="label-base" htmlFor="dc-exist">기존 사망보험금 <span className="text-slate-400 font-normal">(선택)</span></label>
          <AmountInput id="dc-exist" value={existing} onChange={setExisting} placeholder="이미 가입한 사망보험" />
        </div>
        <div>
          <label className="label-base" htmlFor="dc-assets">활용 가능 자산 <span className="text-slate-400 font-normal">(선택)</span></label>
          <AmountInput id="dc-assets" value={assets} onChange={setAssets} placeholder="예금·부동산 등" />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={missing}
          onClick={() => setSubmitted(true)}
        >
          필요 사망보장금액 계산하기
        </button>
        {missing && (
          <p className="mt-2 text-xs text-slate-500">월 생활비와 보장 기간(연)을 입력해 주세요.</p>
        )}
      </div>

      {submitted && result && (
        <div className="mt-8 space-y-4">
          <ResultCard
            title="계산 결과"
            items={[
              { label: `생활비 총액 (${onlyNum(years)}년${extraMonths && onlyNum(extraMonths) ? ` ${onlyNum(extraMonths)}개월` : ""})`, value: won(result.livingTotal) },
              { label: "유족 필요자금 (합계)", value: won(result.neededTotal) },
              { label: "준비된 자금 (합계)", value: won(result.preparedTotal) },
              result.isCovered
                ? { label: "추가로 필요한 사망보장금액", value: "없음", highlight: true }
                : { label: "필요 사망보장금액", value: won(result.requiredCoverage), highlight: true },
            ]}
          />
          {result.isCovered && result.surplus > 0 && (
            <NoticeBox variant="info">
              이미 준비된 자금이 유족 필요자금보다 <b>{won(result.surplus)}</b> 많습니다.
            </NoticeBox>
          )}
          <NoticeBox variant="info">
            이 계산기는 적정 사망보험금을 추천하지 않습니다. 입력하신 유족 필요자금과 이미 준비된 자금의
            차이만 계산합니다. 미래 소득·물가·평균 생활비 같은 추정값은 넣지 않았습니다.
          </NoticeBox>
        </div>
      )}
    </div>
  );
}
