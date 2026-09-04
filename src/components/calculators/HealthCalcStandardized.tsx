"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import RawAmountInput from "@/components/RawAmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calculateMany } from "@/lib/insurance/engine/multiClaim";
import { ClaimLine, Facility, Plan, Visit } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";

type StdGeneration = "2009" | "2017";
type Row = { id: number; amount: string; visit: Visit; facility: Facility };

const MAX_ROWS = 20;

const won = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;
const onlyNum = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;

/**
 * 2·3세대 **진료비** 문자열 파서. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `onlyNum()`을 쓰면 안 된다. 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**15**(점을 지워 10배), `1e3`→**13**,
 *   `1,0`→**10**이 되고, 빈 값·`abc`·`NaN`·`Infinity`가 전부 **0원**으로 합쳐진다.
 *   0원 행은 연간 외래·처방전 횟수를 1회 소진하므로, 빈 행 하나가 마지막 정상 청구를
 *   한도 초과 제외로 뒤집는다.
 * ⚠ 입력 위젯도 함께 바꿔야 한다. `AmountInput`은 이 파서에 닿기 전에 문자를 지우고
 *   15자리로 자르므로, 파서만 엄격하게 해도 변형을 막지 못한다(RawAmountInput 참조).
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ 5·4세대 파서를 재사용하지 않는다. 형식 규칙이 같아도 세대·라벨·안내가 다르다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `300000`) 또는 정확한 천 단위 구분
 *   (`300,000`, `1,234,567`). **명시적으로 입력한 `0`은 유효값**이다.
 * 무효(null = 미입력·잘못된 입력): 빈 값·공백, 부호(`-`/`+`), 문자, `NaN`·`Infinity`,
 *   소수(`1.5`), 지수 표기(`1e3`), 잘못된 쉼표(`1,0`·`1,00,000`·`,300`),
 *   안전 정수 범위(2^53−1) 초과.
 */
const STD_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const stdAmount = (v: string): number | null => {
  if (!STD_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 2·3세대 '이미 사용한 횟수·건수' 문자열 파서. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `onlyNum()`을 쓰면 안 된다. 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-1`→**1**(부호를 지워 양수가 된다), `1.5`→**15**(점을 지운다), `1e3`→13, `1,0`→10,
 *   `abc`·빈 값·`Infinity`→0이 되어 잘못된 입력이 다른 유효값으로 둔갑한다.
 *   과거 사용량이 0으로 줄어드는 방향이라 보험금이 과다 산출된다.
 * ⚠ 4·5세대 파서를 재사용하지 않는다. 형식 규칙이 같아도 세대·한도·라벨이 다르다.
 *
 * 유효: 0 이상의 안전 정수(`0`, `180`, 한도 초과값 포함).
 * 무효(null = 미입력·잘못된 입력): 빈 값·공백·부호·소수·문자·지수 표기·쉼표·안전 정수 초과.
 */
const STD_COUNT_FORMAT = /^[0-9]+$/;
const stdCount = (v: string): number | null => {
  if (!STD_COUNT_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

const btn = (active: boolean) =>
  `px-4 py-3 rounded-xl border text-sm font-semibold transition ${
    active
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
  }`;

const FACILITY_LABELS: Record<Facility, string> = {
  clinic: "의원급",
  hospital: "병원·종합병원",
  tertiary: "상급종합병원",
  pharmacy: "약국 처방조제",
};

let nextId = 1;
const newRow = (): Row => ({ id: nextId++, amount: "300000", visit: "outpatient", facility: "clinic" });

export default function HealthCalcStandardized() {
  const [generation, setGeneration] = useState<StdGeneration>("2017");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [quickAmount, setQuickAmount] = useState("300000");
  const [quickCount, setQuickCount] = useState("3");
  const [priorVisits, setPriorVisits] = useState("");
  const [priorPrescriptions, setPriorPrescriptions] = useState("");
  const [priorPaid, setPriorPaid] = useState("");
  const [perVisitLimit, setPerVisitLimit] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const patch = (id: number, next: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));

  // ⚠ 진료비를 여기서 0으로 만들지 않는다. 형식이 어긋난 행이 하나라도 있으면 아래
  //   `gated`가 엔진 호출 자체를 막으므로, 이 map은 게이트를 통과한 뒤에만 쓰인다.
  const lines: ClaimLine[] = rows.map((r) => ({
    amount: stdAmount(r.amount) as number,
    visit: r.visit,
    facility: r.visit === "outpatient" ? r.facility : undefined,
  }));

  const hasInpatient = rows.some((r) => r.visit === "inpatient");
  const hasOutpatient = rows.some((r) => r.visit === "outpatient");
  // ⚠ 두 축은 필요한 조건이 다르다. 한 게이트로 묶으면 약국 행이 없는데 처방전 입력이
  //   뜨거나 그 반대가 된다. 행 구성으로 각각 판정한다(엔진과 같은 규칙).
  const usesVisits = rows.some((r) => r.visit === "outpatient" && r.facility !== "pharmacy");
  const usesPrescriptions = rows.some((r) => r.visit === "outpatient" && r.facility === "pharmacy");
  //   한도가 걸린 축은 과거 사용량 없이는 계산할 수 없다. 빈 값을 0으로 추정하지 않는다.
  const needsVisits = usesVisits && stdCount(priorVisits) === null;
  const needsPrescriptions = usesPrescriptions && stdCount(priorPrescriptions) === null;
  // 진료비는 미입력과 잘못된 입력을 0원으로 바꾸지 않는다 — 명시적 0만 유효값이다.
  //   ⚠ 한 행만 어긋나도 묶음 전체를 계산하지 않는다. 그 행을 0원으로 계산하면 연간
  //     횟수를 1회 소진해 **다른 행의 보상 여부**까지 바꾸므로, 행 단위로 넘어갈 수 없다.
  //   ⚠ 부분합을 결과로 내보내지 않는다. 유효한 행만 더한 값은 실제 총 진료비가 아니다.
  const needsAmounts = rows.some((r) => stdAmount(r.amount) === null);
  const gated = needsVisits || needsPrescriptions || needsAmounts;

  // ⚠ 게이트가 걸린 동안에는 엔진을 호출하지 않는다. 호출하면 엔진의 차단 안내가 화면으로
  //   새어 나와 내부 필드명이 노출되고 경고가 겹친다.
  //   ⚠ 화면에서 숨겨진 카운터는 넘기지 않는다 — 쓰이지 않는 축이 실리면 엔진이 막는다.
  const result = gated ? null : calculateMany(generation, {
    plan: plan ?? undefined,
    lines,
    priorAnnualPaid: priorPaid.trim() === "" ? undefined : onlyNum(priorPaid),
    priorAnnualOutpatientVisits: usesVisits ? stdCount(priorVisits) ?? undefined : undefined,
    priorAnnualPrescriptions: usesPrescriptions ? stdCount(priorPrescriptions) ?? undefined : undefined,
    perVisitCoverageLimit: perVisitLimit.trim() === "" ? undefined : onlyNum(perVisitLimit),
  });

  // 빠른 채우기 금액은 모든 행의 진료비를 덮어쓴다. 같은 규칙으로 판정한다.
  const quickAmountInvalid = stdAmount(quickAmount) === null;
  const quickFill = () => {
    // ⚠ 잘못된 금액을 행에 복사하지 않는다. 복사하면 전 행이 한꺼번에 무효가 된다.
    if (quickAmountInvalid) return;
    const count = Math.min(MAX_ROWS, Math.max(1, onlyNum(quickCount) || 1));
    const base = rows[0] ?? newRow();
    setRows(
      Array.from({ length: count }, () => ({
        id: nextId++,
        amount: quickAmount,
        visit: base.visit,
        facility: base.facility,
      })),
    );
  };

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label className="label-base">가입 세대</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button type="button" onClick={() => setGeneration("2009")} className={btn(generation === "2009")}>
              2세대 (2009.10~2017.3)
            </button>
            <button type="button" onClick={() => setGeneration("2017")} className={btn(generation === "2017")}>
              3세대 (2017.4~2021.6)
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            두 세대의 기본형 산식은 표준약관상 동일합니다. 3세대는 도수치료·주사·MRI가 별도 특약으로
            분리되어 기본형 계산에 포함되지 않습니다.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">자기부담 유형</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button type="button" onClick={() => setPlan("standard")} className={btn(plan === "standard")}>
              표준형
            </button>
            <button type="button" onClick={() => setPlan("selective")} className={btn(plan === "selective")}>
              선택형
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            보험증권의 상품명·가입내역에서 확인하세요. 가입 시기로 추정하지 않습니다. 표준형은 자기부담이
            크고 보험료가 낮으며, 선택형은 그 반대입니다.
          </p>
        </div>
      </div>

      {/* 청구 내역 */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <label className="label-base mb-0">청구 내역</label>
          <span className="text-xs text-slate-500">{rows.length} / {MAX_ROWS}건</span>
        </div>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          한 행이 약관상 <b>1회의 청구 단위</b>입니다(통원 1회 방문, 처방전 1건, 입원 1회). 하루에 두 번
          이상 통원한 경우 약관이 이를 1회로 보고 가장 높은 공제금액을 적용하므로, <b>한 행으로 합쳐</b>
          입력해 주세요.
        </p>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[2rem_1fr_9rem_11rem_2.5rem] gap-2 items-center">
              <span className="hidden sm:block text-xs text-slate-400 text-center">{i + 1}</span>
              <RawAmountInput
                id={`std-amount-${row.id}`}
                value={row.amount}
                onChange={(v) => patch(row.id, { amount: v })}
                placeholder="예: 300,000"
                ariaLabel={`${i + 1}번 진료비`}
              />
              <select
                aria-label={`${i + 1}번 치료 형태`}
                className="input-base w-full"
                value={row.visit}
                onChange={(e) => patch(row.id, { visit: e.target.value as Visit })}
              >
                <option value="outpatient">통원</option>
                <option value="inpatient">입원</option>
              </select>
              <select
                aria-label={`${i + 1}번 방문 구분`}
                className="input-base w-full disabled:bg-slate-100 disabled:text-slate-400"
                value={row.facility}
                disabled={row.visit === "inpatient"}
                onChange={(e) => patch(row.id, { facility: e.target.value as Facility })}
              >
                {(Object.keys(FACILITY_LABELS) as Facility[]).map((k) => (
                  <option key={k} value={k}>{FACILITY_LABELS[k]}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`${i + 1}번 행 삭제`}
                className="px-3 py-3 rounded-xl border border-slate-300 text-sm text-slate-500 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                disabled={rows.length <= 1}
                onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40"
            disabled={rows.length >= MAX_ROWS}
            onClick={() => setRows((prev) => [...prev, newRow()])}
          >
            + 행 추가
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">같은 금액으로 여러 번</p>
          <p className="mt-1 text-xs text-slate-600">
            금액이 같은 방문이 반복된 경우 한 번에 채웁니다. 첫 행의 치료 형태·방문 구분을 따르며,
            기존 행은 대체됩니다. 금액이 다르면 행을 각각 입력해야 정확합니다.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_7rem_auto] gap-2">
            <RawAmountInput id="std-quick-amount" value={quickAmount} onChange={setQuickAmount} placeholder="1회 금액" ariaLabel="빠른 채우기 1회 금액" />
            <input
              aria-label="반복 횟수"
              type="number"
              min={1}
              max={MAX_ROWS}
              className="input-base w-full"
              value={quickCount}
              onChange={(e) => setQuickCount(e.target.value)}
            />
            <button type="button" disabled={quickAmountInvalid} className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={quickFill}>
              채우기
            </button>
          </div>
          {quickAmountInvalid && (
            <p className="mt-2 text-xs text-amber-700">
              채울 금액은 <b>0 이상의 정수</b>여야 합니다(<b>300000</b> 또는 <b>300,000</b>). 음수·소수·문자·잘못된 쉼표는
              계산기가 임의로 고치지 않습니다.
            </p>
          )}
        </div>
      </div>

      {/* 선택 입력 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* ⚠ 두 축은 노출 조건이 다르다. 약국 처방조제 행이 없으면 처방전 입력을 띄우지 않고,
            약국 행만 있으면 외래 입력을 띄우지 않는다. 화면에 없는 축은 엔진에도 넘기지 않는다. */}
        {usesVisits && (
          <div>
            <label className="label-base" htmlFor="std-prior-visits">
              계약해당일 기준 1년간 이미 사용한 외래 방문 횟수
            </label>
            <input
              id="std-prior-visits"
              inputMode="numeric"
              className="input-base w-full"
              value={priorVisits}
              onChange={(e) => setPriorVisits(e.target.value)}
              placeholder="이전 방문이 없으면 0"
            />
            <p className="mt-2 text-xs text-slate-500">
              외래는 계약해당일 기준 1년간 <b>180회</b>가 한도입니다. 약국 처방조제와는 별개 한도이며,
              이전 방문이 없으면 <b>0</b>을 입력해 주세요. 모르는 값을 0으로 추정하지 않습니다.
            </p>
          </div>
        )}
        {usesPrescriptions && (
          <div>
            <label className="label-base" htmlFor="std-prior-prescriptions">
              계약해당일 기준 1년간 이미 사용한 처방전 건수
            </label>
            <input
              id="std-prior-prescriptions"
              inputMode="numeric"
              className="input-base w-full"
              value={priorPrescriptions}
              onChange={(e) => setPriorPrescriptions(e.target.value)}
              placeholder="이전 처방이 없으면 0"
            />
            <p className="mt-2 text-xs text-slate-500">
              처방조제는 외래와 <b>별도로 180건</b>이 한도입니다(단위가 회가 아니라 건입니다).
              이전 처방이 없으면 <b>0</b>을 입력해 주세요. 모르는 값을 0으로 추정하지 않습니다.
            </p>
          </div>
        )}
        {hasOutpatient && (
          <>
            <div className="sm:col-span-2 max-w-md">
              <label className="label-base" htmlFor="std-per-visit-limit">
                회(건)당 보험가입금액 (선택)
              </label>
              <AmountInput
                id="std-per-visit-limit"
                value={perVisitLimit}
                onChange={setPerVisitLimit}
                placeholder="예: 300,000 — 모르면 비워두세요"
              />
              <p className="mt-2 text-xs text-slate-500">
                외래·처방조제비는 회(건)당 합산 30만 원 이내에서 <b>계약 시 정한 금액</b>이 한도가 됩니다.
                계약마다 다른 값이라 입력하지 않으면 적용하지 않습니다. 증권에서 확인해 주세요.
              </p>
            </div>
          </>
        )}

        {hasInpatient && (
          <div className="sm:col-span-2 max-w-md">
            <label className="label-base" htmlFor="std-prior-paid">
              계약해당일 기준 1년간 이미 부담한 입원 자기부담금 (선택)
            </label>
            <AmountInput
              id="std-prior-paid"
              value={priorPaid}
              onChange={setPriorPaid}
              placeholder="없으면 비워두세요"
            />
            <p className="mt-2 text-xs text-slate-500">
              입원 자기부담은 계약일 또는 매년 계약해당일부터 1년간 200만 원이 상한이며, 초과분은 보험이
              부담합니다. 통원 자기부담은 이 상한에 누적되지 않습니다.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setSubmitted(true)}>
          자기부담금 계산하기
        </button>
      </div>

      {submitted && (
        <div className="mt-8 space-y-4">
          {needsVisits && (
            <NoticeBox variant="warning">
              계약해당일 기준 1년간 <b>이미 사용한 외래 방문 횟수</b>를 입력해 주세요. 이전 방문이 없으면 <b>0</b>을
              입력하세요. 외래는 연 180회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지
              않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.
            </NoticeBox>
          )}
          {needsPrescriptions && (
            <NoticeBox variant="warning">
              계약해당일 기준 1년간 <b>이미 사용한 처방전 건수</b>를 입력해 주세요. 이전 처방이 없으면 <b>0</b>을
              입력하세요. 처방조제는 연 180건이 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지
              않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.
            </NoticeBox>
          )}
          {needsAmounts && (
            <NoticeBox variant="warning">
              {rows.map((r, i) => (stdAmount(r.amount) === null ? i + 1 : null)).filter((n) => n !== null).join(", ")}번째 행의{" "}
              <b>진료비</b>를 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>300000</b> 또는{" "}
              <b>300,000</b> 형식입니다. 진료비가 실제로 0원이면 <b>0</b>을 입력하세요. 음수·소수·문자·지수 표기·
              잘못된 쉼표는 계산기가 임의로 고치지 않으며, 빈 값을 0원으로 보지도 않습니다. 0원으로 보면 그 행이
              연간 횟수를 1회 소진해 <b>다른 행의 보상 여부</b>까지 바뀝니다. 그래서 한 행만 어긋나도 계산하지
              않습니다.
            </NoticeBox>
          )}
          {/* ⚠ 차단 사유를 plan 미선택으로 단정하지 않는다. 엔진이 준 안내를 그대로 보여준다. */}
          {result !== null && result.status === "PENDING_UNVERIFIED" && (
            <NoticeBox variant="warning">
              {result.notes.map((note) => <span key={note} className="block">{note}</span>)}
            </NoticeBox>
          )}

          {result !== null && result.status === "OK" && result.totalAmount > 0 && (
            <>
              <ResultCard
                title={`계산 결과 · ${result.lines.length}건 합계 (${generation === "2009" ? "2세대" : "3세대"} 실손 기본형 기준 · 참고용)`}
                items={[
                  { label: "총 진료비", value: won(result.totalAmount) },
                  { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true },
                  { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) },
                ]}
              />

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">청구 건별 계산 내역</caption>
                  <thead>
                    <tr className="bg-slate-50 text-slate-700">
                      <th scope="col" className="border border-slate-200 px-3 py-2 text-left">#</th>
                      <th scope="col" className="border border-slate-200 px-3 py-2 text-left">구분</th>
                      <th scope="col" className="border border-slate-200 px-3 py-2 text-right">진료비</th>
                      <th scope="col" className="border border-slate-200 px-3 py-2 text-right">본인부담금</th>
                      <th scope="col" className="border border-slate-200 px-3 py-2 text-right">보험 적용</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600">
                    {result.lines.map((line) => {
                      const row = rows[line.index];
                      const label =
                        row?.visit === "inpatient" ? "입원" : `통원 · ${FACILITY_LABELS[row?.facility ?? "clinic"]}`;
                      return (
                        <tr key={line.index} className={line.covered ? "" : "bg-amber-50"}>
                          <td className="border border-slate-200 px-3 py-2">{line.index + 1}</td>
                          <td className="border border-slate-200 px-3 py-2">
                            {label}
                            {!line.covered && <span className="ml-2 text-xs font-semibold text-amber-700">보상 제외</span>}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right">{won(line.amount)}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right font-semibold">{won(line.ownPay ?? 0)}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right">{won(line.insurancePay ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {result.appliedCaps.length > 0 && (
                <NoticeBox variant="info">
                  적용된 한도: {result.appliedCaps.map((code) => CAP_LABELS[code]).join(", ")}.
                </NoticeBox>
              )}
              {result.notes.length > 0 && <NoticeBox variant="info">{result.notes.join(" ")}</NoticeBox>}
              {result.lines[0]?.notes.length > 0 && (
                <NoticeBox variant="info">{result.lines[0].notes.join(" ")}</NoticeBox>
              )}
              <p className="text-xs text-slate-500">
                ※ 실제 보험금은 가입 상품, 약관, 연간 누적 사용액, 가입금액 설정에 따라 달라질 수 있습니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
