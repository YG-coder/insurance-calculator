"use client";

import { useState } from "react";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calcCancelVsKeep } from "@/lib/insurance/decision/cancelVsKeep";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const onlyNum = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

export default function CancelVsKeepCalc() {
  const [surrender, setSurrender] = useState("3000000");
  const [future, setFuture] = useState("21600000");
  const [submitted, setSubmitted] = useState(false);

  const result = calcCancelVsKeep({
    surrenderValue: onlyNum(surrender),
    futurePremium: onlyNum(future),
  });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="cvk-surrender">현재 해지환급금 (원)</label>
          <AmountInput id="cvk-surrender" value={surrender} onChange={setSurrender} placeholder="해지환급금 계산기 결과 또는 약관 확인값" />
        </div>
        <div>
          <label className="label-base" htmlFor="cvk-future">앞으로 낼 보험료 (원)</label>
          <AmountInput id="cvk-future" value={future} onChange={setFuture} placeholder="앞으로 낼 보험료 계산기 결과" />
        </div>
      </div>

      <div className="mt-6">
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setSubmitted(true)}>
          두 금액 나란히 보기
        </button>
      </div>

      {submitted && (
        <div className="mt-8 space-y-4">
          {result.status === "NEED_INPUT" ? (
            <NoticeBox variant="info">{result.notes[0]}</NoticeBox>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold text-slate-500 mb-1">지금 해지하면</p>
                  <p className="text-sm text-slate-600 mb-2">현재 받을 수 있는 해지환급금</p>
                  <p className="text-2xl font-bold text-slate-900">{won(result.surrenderValue ?? 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold text-slate-500 mb-1">그대로 유지하면</p>
                  <p className="text-sm text-slate-600 mb-2">앞으로 추가로 납입할 보험료</p>
                  <p className="text-2xl font-bold text-slate-900">{won(result.futurePremium ?? 0)}</p>
                </div>
              </div>

              <NoticeBox variant="info">
                두 금액은 성격이 다릅니다. 해지환급금은 <b>현재 받을 수 있는 금액</b>이고, 앞으로 낼 보험료는
                <b> 향후 보험을 유지하면서 납입할 총액</b>입니다. 앞으로 받을 수 있는 보장의 가치는 사람마다
                다르므로 계산에 넣지 않았습니다. 어느 쪽이 유리한지는 판단하지 않으며, 두 금액과 본인의 상황을
                함께 고려해 주세요.
              </NoticeBox>
            </>
          )}
        </div>
      )}
    </div>
  );
}
