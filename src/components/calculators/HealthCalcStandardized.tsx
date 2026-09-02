"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calculateMany } from "@/lib/insurance/engine/multiClaim";
import { ClaimLine, Facility, Plan, Visit } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";

type StdGeneration = "2009" | "2017";
type Row = { id: number; amount: string; visit: Visit; facility: Facility };

const MAX_ROWS = 20;

const won = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;
const onlyNum = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;

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

  const lines: ClaimLine[] = rows.map((r) => ({
    amount: onlyNum(r.amount),
    visit: r.visit,
    facility: r.visit === "outpatient" ? r.facility : undefined,
  }));

  const result = calculateMany(generation, {
    plan: plan ?? undefined,
    lines,
    priorAnnualPaid: priorPaid.trim() === "" ? undefined : onlyNum(priorPaid),
    priorAnnualOutpatientVisits: priorVisits.trim() === "" ? undefined : onlyNum(priorVisits),
    priorAnnualPrescriptions: priorPrescriptions.trim() === "" ? undefined : onlyNum(priorPrescriptions),
    perVisitCoverageLimit: perVisitLimit.trim() === "" ? undefined : onlyNum(perVisitLimit),
  });

  const hasInpatient = rows.some((r) => r.visit === "inpatient");
  const hasOutpatient = rows.some((r) => r.visit === "outpatient");

  const quickFill = () => {
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
              <AmountInput
                id={`std-amount-${row.id}`}
                value={row.amount}
                onChange={(v) => patch(row.id, { amount: v })}
                placeholder="예: 300,000"
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
            <AmountInput id="std-quick-amount" value={quickAmount} onChange={setQuickAmount} placeholder="1회 금액" />
            <input
              aria-label="반복 횟수"
              type="number"
              min={1}
              max={MAX_ROWS}
              className="input-base w-full"
              value={quickCount}
              onChange={(e) => setQuickCount(e.target.value)}
            />
            <button type="button" className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300" onClick={quickFill}>
              채우기
            </button>
          </div>
        </div>
      </div>

      {/* 선택 입력 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {hasOutpatient && (
          <>
            <div>
              <label className="label-base" htmlFor="std-prior-visits">
                올 계약연도에 이미 사용한 외래 방문 횟수 (선택)
              </label>
              <input
                id="std-prior-visits"
                type="number"
                min={0}
                className="input-base w-full"
                value={priorVisits}
                onChange={(e) => setPriorVisits(e.target.value)}
                placeholder="모르면 비워두세요"
              />
              <p className="mt-2 text-xs text-slate-500">
                계약해당일 기준 1년간 외래 180회가 한도입니다. 입력하면 한도 초과분을 결과에 반영합니다.
              </p>
            </div>
            <div>
              <label className="label-base" htmlFor="std-prior-prescriptions">
                이미 사용한 처방전 건수 (선택)
              </label>
              <input
                id="std-prior-prescriptions"
                type="number"
                min={0}
                className="input-base w-full"
                value={priorPrescriptions}
                onChange={(e) => setPriorPrescriptions(e.target.value)}
                placeholder="모르면 비워두세요"
              />
              <p className="mt-2 text-xs text-slate-500">
                처방전은 외래와 별도로 180건 한도입니다.
              </p>
            </div>
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
          {result.status === "PENDING_UNVERIFIED" && (
            <NoticeBox variant="warning">
              <b>표준형 / 선택형</b>을 선택해 주세요. 두 유형은 자기부담률과 통원 공제 방식이 다릅니다.
            </NoticeBox>
          )}

          {result.status === "OK" && result.totalAmount > 0 && (
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
