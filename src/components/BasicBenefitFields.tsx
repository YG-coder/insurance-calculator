"use client";

import type { Dispatch, SetStateAction } from "react";
import { GEN5_INPATIENT_POOL_NOTE } from "@/lib/insurance/engine/regulatoryRules";
import RawAmountInput from "./RawAmountInput";
import type { BasicBenefitLimits, Cause, Visit } from "@/lib/insurance/engine/types";

function optionalWon(raw: string) {
  if (raw === "") return undefined;
  return /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/.test(raw) ? Number(raw.replaceAll(",", "")) : NaN;
}

export const emptyBasicFields = {
  prior: "", injury: { outpatient: "", remaining: "" }, disease: { outpatient: "", remaining: "" },
};

export function basicBenefitFields(
  values: typeof emptyBasicFields, setValues: Dispatch<SetStateAction<typeof emptyBasicFields>>,
  id: string, visit: Visit, options: { year: "2021" | "2026"; bundle: boolean; cause?: Cause },
) {
  const { year, bundle, cause = "disease" } = options;
  // 4세대 다회 화면은 증권상 연간 가입금액과 기존 지급보험금으로 잔여액을 구한다.
  const showAnnual = year === "2026" || !bundle;
  const { prior } = values;
  const selected = values[cause];
  function update(key: keyof typeof selected, value: string) {
    setValues(prev => ({ ...prev, [cause]: { ...prev[cause], [key]: value } }));
  }
  const contract: BasicBenefitLimits = {
    priorInpatientDeductible: visit === "inpatient" ? optionalWon(prior) : undefined,
    outpatientLimit: visit === "outpatient" ? optionalWon(selected.outpatient) : undefined,
    remainingAnnualBenefit: showAnnual ? optionalWon(selected.remaining) : undefined,
  };
  const fields = <fieldset className="mt-4 space-y-3">
    <legend className="font-semibold">급여 보장 계약 조건</legend>
    <p className="text-sm text-slate-600">진료비에는 공단에서 환급받을 금액을 제외한 보장 대상 급여 본인부담금만 입력하세요.</p>
    {visit === "inpatient" ? <div>
      <label className="label-base" htmlFor={id + "-prior"}>이번 계약연도에 이미 부담한 급여 입원 공제액{year === "2021" && " (상해·질병 합산)"}</label>
      {year === "2026" && <p className="text-sm text-slate-600">{GEN5_INPATIENT_POOL_NOTE}</p>}
      <RawAmountInput id={id + "-prior"} value={prior} onChange={prior => setValues(prev => ({ ...prev, prior }))} placeholder={bundle ? "이전 공제액이 없으면 0" : "비우면 0원으로 가정"} />
    </div> : <div>
      <label className="label-base" htmlFor={id + "-visit"}>증권의 급여 통원 1회 가입금액 (선택)</label>
      <RawAmountInput id={id + "-visit"} value={selected.outpatient} onChange={v => update("outpatient", v)} placeholder="비우면 최고 20만 원 기준" />
    </div>}
    {showAnnual && <div>
      <label className="label-base" htmlFor={id + "-annual"}>이번 청구와 같은 보장(상해 또는 질병)의 연간 잔여 지급한도 (선택)</label>
      <RawAmountInput id={id + "-annual"} value={selected.remaining} onChange={v => update("remaining", v)} placeholder="가입금액에서 기존 입원·통원 지급액을 뺀 금액" />
    </div>}
  </fieldset>;
  return { contract, fields };
}
