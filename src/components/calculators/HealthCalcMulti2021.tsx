"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import ResultCard from "@/components/ResultCard";
import { calculateMany2021 } from "@/lib/insurance/engine/multiClaim2021";
import {
  Cause, Coverage, Gen2021MultiGeneralBenefitInput, Gen2021MultiGeneralNonBenefitInpatientInput,
  Gen2021MultiGeneralNonBenefitOutpatientInput, Gen2021MultiRiderCountedInput,
  Gen2021MultiRiderMriInput, Gen2021Rider, Tier, Visit,
} from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { GEN2021 } from "@/lib/insurance/engine/constants";

const digits = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 4세대 '이미 사용한 횟수' 문자열 파서. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `digits()`를 쓰면 안 된다. 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-1`→**1**(부호를 지워 양수가 된다), `1.5`→**15**(점을 지운다), `1e3`→13, `1,0`→10,
 *   `abc`·빈 값·`Infinity`→0이 되어 잘못된 입력이 다른 유효값으로 둔갑한다.
 *   과거 사용량이 0으로 줄어드는 방향이라 보험금이 과다 산출된다.
 * ⚠ 5세대 파서를 재사용하지 않는다. 형식 규칙이 같아도 세대·한도·라벨이 다르다.
 *
 * 유효: 0 이상의 안전 정수(`0`, `50`, `100`, 한도 초과값 포함).
 * 무효(null = 미입력·잘못된 입력): 빈 값·공백·부호·소수·문자·지수 표기·쉼표·안전 정수 초과.
 */
const GEN2021_COUNT_FORMAT = /^[0-9]+$/;
const gen2021Count = (v: string): number | null => {
  if (!GEN2021_COUNT_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

export default function HealthCalcMulti2021() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  const [cause, setCause] = useState<Cause>("disease");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [rider, setRider] = useState<Gen2021Rider>("none");
  const [annualLimit, setAnnualLimit] = useState("");
  const [priorPaid, setPriorPaid] = useState("0");
  // ⚠ 세 축의 상태를 분리한다. 하나를 라벨만 바꿔 재사용하면 항목을 바꿀 때 값이
  //   다른 한도(100회 ↔ 50회)로 말없이 넘어간다. MRI는 횟수 한도가 없어 상태가 없다.
  //   ⚠ 빈 값으로 시작한다. 기본값 "0"은 사용자가 확인하지 않은 "기존 사용 없음"을
  //     화면이 대신 만들어 내는 것이라 한도가 통째로 사라진다. 0은 직접 입력해야 한다.
  const [priorOutVisits, setPriorOutVisits] = useState("");
  const [priorManualVisits, setPriorManualVisits] = useState("");
  const [priorInjectionVisits, setPriorInjectionVisits] = useState("");
  const [copyCount, setCopyCount] = useState("3");
  const [submitted, setSubmitted] = useState(false);

  const isRider = rider !== "none";
  // 어느 축이 쓰이는지는 rider·coverage·visit이 함께 정한다. 엔진과 같은 규칙이다.
  const usesOutVisits = !isRider && coverage === "non_benefit" && visit === "outpatient";
  const usesRiderVisits = rider === "manual_therapy" || rider === "injection";
  const riderVisitsText = rider === "manual_therapy" ? priorManualVisits
    : rider === "injection" ? priorInjectionVisits : "";
  //   한도가 걸린 축은 과거 사용량 없이는 계산할 수 없다. 빈 값을 0으로 추정하지 않는다.
  const needsOutVisits = usesOutVisits && gen2021Count(priorOutVisits) === null;
  const needsRiderVisits = usesRiderVisits && gen2021Count(riderVisitsText) === null;
  const gated = needsOutVisits || needsRiderVisits;

  // ⚠ 축은 분기마다 자기 것만 싣는다. 스프레드로 공통에 두면 쓰이지 않는 경로에도
  //   같은 필드가 따라 들어가고, 초과 필드는 타입 검사에서 드러나지 않는다.
  const common = {
    cause, visit, tier, amounts: amounts.map(digits),
    priorAnnualRiderPaid: isRider ? digits(priorPaid) : undefined,
  };
  const result = usesRiderVisits
    ? calculateMany2021({
        ...common, rider: rider as "manual_therapy" | "injection", coverage,
        priorAnnualRiderVisits: gen2021Count(riderVisitsText) ?? undefined,
      } satisfies Gen2021MultiRiderCountedInput)
    : rider === "mri"
      ? calculateMany2021({ ...common, rider: "mri", coverage } satisfies Gen2021MultiRiderMriInput)
      : coverage === "benefit"
        ? calculateMany2021({
            ...common, rider: "none", coverage: "benefit",
            annualCoverageLimit: annualLimit ? digits(annualLimit) : undefined,
            priorAnnualInsurancePaid: digits(priorPaid),
          } satisfies Gen2021MultiGeneralBenefitInput)
        : visit === "inpatient"
          ? calculateMany2021({
              ...common, rider: "none", coverage: "non_benefit", visit: "inpatient",
              annualCoverageLimit: annualLimit ? digits(annualLimit) : undefined,
              priorAnnualInsurancePaid: digits(priorPaid),
            } satisfies Gen2021MultiGeneralNonBenefitInpatientInput)
          : calculateMany2021({
              ...common, rider: "none", coverage: "non_benefit", visit: "outpatient",
              annualCoverageLimit: annualLimit ? digits(annualLimit) : undefined,
              priorAnnualInsurancePaid: digits(priorPaid),
              priorAnnualOutpatientVisits: gen2021Count(priorOutVisits) ?? undefined,
            } satisfies Gen2021MultiGeneralNonBenefitOutpatientInput);

  const setLine = (index: number, value: string) =>
    setAmounts((old) => old.map((v, i) => i === index ? value : v));
  const smallButton = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40";

  return (
    <div className="card mt-8">
      <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
      <p className="mt-2 text-sm text-slate-600">
        선택한 원인·급여 구분의 한 보장축만 계산합니다. 같은 축의 청구를 발생 순서대로 입력하면 회당·연간 한도와 기존 지급액을 이어서 계산합니다.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-sm font-semibold">원인
          <select className="input-base mt-1" value={cause} onChange={(e) => setCause(e.target.value as Cause)}>
            <option value="disease">질병</option><option value="injury">상해</option>
          </select>
        </label>
        <label className="text-sm font-semibold">급여 구분
          <select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)} disabled={isRider}>
            <option value="benefit">급여</option><option value="non_benefit">비급여</option>
          </select>
        </label>
        <label className="text-sm font-semibold">치료 형태
          <select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}>
            <option value="outpatient">통원</option><option value="inpatient">입원</option>
          </select>
        </label>
        <label className="text-sm font-semibold">3대 비급여
          <select className="input-base mt-1" value={rider} onChange={(e) => setRider(e.target.value as Gen2021Rider)}>
            <option value="none">해당 없음</option>
            <option value="manual_therapy">도수·충격파·증식</option>
            <option value="injection">비급여 주사</option>
            <option value="mri">MRI/MRA</option>
          </select>
        </label>
      </div>

      {!isRider && visit === "outpatient" && coverage === "benefit" && (
        <label className="mt-4 block text-sm font-semibold">의료기관
          <select className="input-base mt-1 max-w-xs" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            <option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option>
          </select>
        </label>
      )}

      <div className="mt-5 space-y-3">
        {amounts.map((amount, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex-1 text-sm font-semibold">{i + 1}건 진료비
              <input className="input-base mt-1" inputMode="numeric" value={amount}
                onChange={(e) => setLine(i, e.target.value)} />
            </label>
            <button type="button" className={smallButton} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))} disabled={amounts.length === 1}>삭제</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button>
          <input className="input-base w-20" inputMode="numeric" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" />
          <button type="button" className={smallButton} onClick={() => setAmounts(Array.from({ length: Math.max(1, Math.min(100, digits(copyCount))) }, () => amounts[0] ?? ""))}>첫 금액 × N회</button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {!isRider && <label className="text-sm font-semibold">증권상 연간 가입금액
          <input className="input-base mt-1" inputMode="numeric" placeholder="예: 50,000,000" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">약관상 최대 5천만 원. 비우면 연간 금액 한도를 적용하지 않습니다.</span>
        </label>}
        <label className="text-sm font-semibold">누적기간 내 기존 지급보험금
          <input className="input-base mt-1" inputMode="numeric" value={priorPaid} onChange={(e) => setPriorPaid(e.target.value)} />
        </label>
        {/* ⚠ 축마다 자기 상태·라벨·한도를 쓴다. MRI는 횟수 한도가 없어 입력을 노출하지 않는다. */}
        {usesOutVisits && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 사용한 비급여 통원 횟수
          <input className="input-base mt-1" inputMode="numeric" placeholder="이전 통원이 없으면 0"
            value={priorOutVisits} onChange={(e) => setPriorOutVisits(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">비급여 통원은 약관상 <b>계약해당일부터 1년간 {GEN2021.nonBenefitOutpatientAnnualVisits}회</b>가 한도입니다(상해·질병 보장축별). 급여에는 적용하지 않습니다.</span>
        </label>}
        {rider === "manual_therapy" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 받은 도수치료 등 치료 횟수
          <input className="input-base mt-1" inputMode="numeric" placeholder="받은 치료가 없으면 0"
            value={priorManualVisits} onChange={(e) => setPriorManualVisits(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">도수치료·체외충격파치료·증식치료는 <b>각 치료횟수를 합산해 연 {GEN2021.rider.manual_therapy.annualVisits}회</b>가 한도입니다. 비급여 주사료와는 별개 한도입니다.</span>
        </label>}
        {rider === "injection" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 받은 비급여 주사 횟수
          <input className="input-base mt-1" inputMode="numeric" placeholder="받은 치료가 없으면 0"
            value={priorInjectionVisits} onChange={(e) => setPriorInjectionVisits(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">비급여 주사료는 <b>입원과 통원을 합산해 연 {GEN2021.rider.injection.annualVisits}회</b>가 한도입니다. 도수치료 등과는 별개 한도입니다.</span>
        </label>}
      </div>

      {rider === "mri" && <div className="mt-4"><NoticeBox variant="info">비급여 MRI·MRA는 약관상 <b>금액 한도만</b> 있고 연간 횟수 한도가 없습니다. 그래서 이미 받은 횟수를 묻지 않습니다.</NoticeBox></div>}

      <button type="button" className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>

      {submitted && needsOutVisits && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 사용한 비급여 통원 횟수</b>를 입력해 주세요. 이전 통원이 없으면 <b>0</b>을 입력하세요. 비급여 통원은 연 {GEN2021.nonBenefitOutpatientAnnualVisits}회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}
      {submitted && needsRiderVisits && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 받은 치료 횟수</b>를 입력해 주세요. 받은 치료가 없으면 <b>0</b>을 입력하세요. 이 특약은 연 {rider === "manual_therapy" ? GEN2021.rider.manual_therapy.annualVisits : GEN2021.rider.injection.annualVisits}회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}

      {submitted && !gated && result.totalAmount > 0 && <div className="mt-7">
        <ResultCard title="다회 청구 합계 (4세대 · 참고용)" items={[
          { label: "총 진료비", value: won(result.totalAmount) },
          { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true },
          { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) },
        ]} />
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>
          {result.lines.map((line) => <tr key={line.index} className="border-t"><td className="py-2">{line.index + 1}{!line.covered ? " (한도 초과)" : ""}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}
        </tbody></table></div>
        {result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}
        {result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}
      </div>}
    </div>
  );
}
