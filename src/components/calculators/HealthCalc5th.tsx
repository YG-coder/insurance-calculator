"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import AmountInput from "@/components/AmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calc2026, GEN2026_NON_BENEFIT_ITEM_LABEL } from "@/lib/insurance/engine/generation2026";
import { Coverage, Visit, Tier, Severity, Gen2026NonBenefitItem } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

// 화면 표기 순서. ⚠ 기본 선택이 없다 — 사용자가 MRI·주사료·병실료임을 모른 채
//    "일반 비급여"로 계산되는 일을 막는 것이 이 축의 목적이다.
const NON_BENEFIT_ITEMS: Gen2026NonBenefitItem[] = [
  "general", "musculoskeletal_esw", "injection", "mri", "room_charge",
];

const btn = (active: boolean) =>
  `px-4 py-3 rounded-xl border text-sm font-semibold transition ${
    active
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
  }`;

export default function HealthCalc5th() {
  const [amount, setAmount] = useState<string>("300000");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("inpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [severity, setSeverity] = useState<Severity | null>(null);
  // 초기값은 미선택이어야 한다. "general"을 기본값으로 두면 안전 차단이 무력화된다.
  const [nonBenefitItem, setNonBenefitItem] = useState<Gen2026NonBenefitItem | null>(null);
  const [priorAnnualPaid, setPriorAnnualPaid] = useState<string>("0");
  const [outpatientLimit, setOutpatientLimit] = useState<string>("");
  const [nhisRate, setNhisRate] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const num = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const priorAnnualPaidNum = Number(priorAnnualPaid.replace(/[^0-9]/g, "")) || 0;

  // 비급여는 ①치료유형 ②중증/비중증을 모두 고른 뒤에만 계산한다(엔진 호출 전 UI 가드).
  //   치료유형이 "일반 비급여"가 아니면 질환 구분과 무관하게 엔진이 차단한다.
  const needsItem = coverage === "non_benefit" && nonBenefitItem === null;
  const needsSeverity =
    coverage === "non_benefit" && nonBenefitItem === "general" && severity === null;

  // calc2026을 직접 호출한다 — 비급여에서 치료유형 누락이 컴파일 에러가 되는 경로다.
  const result =
    coverage === "benefit"
      ? calc2026({
          amount: num,
          coverage: "benefit",
          visit,
          tier,
          nhisCoinsuranceRate:
            visit === "outpatient" && nhisRate.trim() !== ""
              ? Math.min(100, Math.max(0, Number(nhisRate))) / 100
              : undefined,
        })
      : needsItem || needsSeverity
        ? null
        : calc2026({
            amount: num,
            coverage: "non_benefit",
            visit,
            tier,
            severity: severity ?? undefined,
            nonBenefitItem: nonBenefitItem as Gen2026NonBenefitItem,
            priorAnnualPaid:
              severity === "critical" && visit === "inpatient" && tier === "hospital"
                ? priorAnnualPaidNum
                : undefined,
            perVisitCoverageLimit:
              visit === "outpatient" && outpatientLimit.trim() !== ""
                ? Number(outpatientLimit.replace(/[^0-9]/g, "")) || 0
                : undefined,
          });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="med5-amount">
            병원비 (원)
          </label>
          <AmountInput
            id="med5-amount"
            value={amount}
            onChange={setAmount}
            placeholder="예: 300,000"
          />
        </div>

        <div>
          <label className="label-base">진료 구분</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCoverage("benefit")} className={btn(coverage === "benefit")}>
              급여
            </button>
            <button type="button" onClick={() => setCoverage("non_benefit")} className={btn(coverage === "non_benefit")}>
              비급여
            </button>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">치료 형태</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button type="button" onClick={() => setVisit("outpatient")} className={btn(visit === "outpatient")}>
              통원
            </button>
            <button type="button" onClick={() => setVisit("inpatient")} className={btn(visit === "inpatient")}>
              입원
            </button>
          </div>
        </div>

        {/* 비급여일 때만 치료유형 노출. 기본 선택 없음 — 고르기 전에는 계산하지 않는다. */}
        {coverage === "non_benefit" && (
          <div className="sm:col-span-2">
            <label className="label-base">치료유형</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NON_BENEFIT_ITEMS.map((it) => (
                <button
                  key={it}
                  type="button"
                  onClick={() => setNonBenefitItem(it)}
                  className={btn(nonBenefitItem === it)}
                >
                  {GEN2026_NON_BENEFIT_ITEM_LABEL[it]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              5세대 비급여는 <b>보장종목이 나뉘어</b> 있습니다. 근골격계 이학요법·체외충격파,
              비급여 주사료, 비급여 MRI는 약관상 <b>별도 보장종목</b>이라 일반 상해·질병 비급여에서
              제외되고, 상급병실료 차액도 입원 의료비와 별도 산식입니다. 이 계산기는 현재
              <b> 일반 비급여만</b> 계산하므로 치료유형을 먼저 선택해 주세요.
            </p>
          </div>
        )}

        {/* 일반 비급여일 때만 중증/비중증 노출 (조건부) */}
        {coverage === "non_benefit" && nonBenefitItem === "general" && (
          <div className="sm:col-span-2">
            <label className="label-base">질환 구분</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button type="button" onClick={() => setSeverity("critical")} className={btn(severity === "critical")}>
                중증
              </button>
              <button type="button" onClick={() => setSeverity("non_critical")} className={btn(severity === "non_critical")}>
                비중증
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              중증·비중증 구분은 가입 상품의 약관과 적용 기준을 확인해 선택해 주세요. 정확한 분류가
              필요한 경우 보험사 안내를 확인하시기 바랍니다.
            </p>
          </div>
        )}

        {/* 급여 통원일 때만 의료기관 구분 (계산은 보류되지만 입력 흐름은 유지) */}
        {coverage === "benefit" && visit === "outpatient" && (
          <>
            <div className="sm:col-span-2">
              <label className="label-base">방문 의료기관</label>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                <button type="button" onClick={() => setTier("clinic")} className={btn(tier === "clinic")}>
                  병·의원급
                </button>
                <button type="button" onClick={() => setTier("hospital")} className={btn(tier === "hospital")}>
                  상급종합·종합병원
                </button>
              </div>
            </div>
            <div className="sm:col-span-2 max-w-md">
              <label className="label-base" htmlFor="med5-nhis-rate">건강보험 본인부담률 (%)</label>
              <input
                id="med5-nhis-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={nhisRate}
                onChange={(e) => setNhisRate(e.target.value)}
                placeholder="진료비 영수증·보험사 안내에서 확인"
                className="input-base w-full"
              />
              <p className="mt-2 text-xs text-slate-500">건강보험 본인부담률을 모르면 정확한 급여 통원 계산을 제공하지 않습니다.</p>
            </div>
          </>
        )}

        {coverage === "non_benefit" && nonBenefitItem === "general" && visit === "outpatient" && (
          <div className="sm:col-span-2 max-w-md">
            <label className="label-base" htmlFor="med5-outpatient-limit">
              통원 가입금액 (선택)
            </label>
            <AmountInput
              id="med5-outpatient-limit"
              value={outpatientLimit}
              onChange={setOutpatientLimit}
              placeholder="예: 200,000 — 모르면 비워두세요"
            />
            <p className="mt-2 text-xs text-slate-500">
              약관은 통원 가입금액을 <b>20만 원 이내에서 계약 시 정한 금액</b>으로 규정합니다
              (중증은 1회당, 비중증은 1일당). 계약마다 다른 값이라 입력하지 않으면 적용하지 않으며,
              0원을 입력해도 미입력으로 처리합니다.
            </p>
          </div>
        )}

        {coverage === "non_benefit" && nonBenefitItem === "general" && severity === "critical" && visit === "inpatient" && (
          <>
            <div className="sm:col-span-2">
              <label className="label-base">입원 의료기관</label>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                <button type="button" onClick={() => setTier("clinic")} className={btn(tier === "clinic")}>
                  병·의원급
                </button>
                <button type="button" onClick={() => setTier("hospital")} className={btn(tier === "hospital")}>
                  상급종합·종합병원
                </button>
              </div>
            </div>
            {/* 자기부담 상한(500만)은 상급종합·종합병원 입원에만 적용된다.
                병·의원급에서 이 값을 받으면 계산에 반영되지 않아 사용자가 오인한다. */}
            {tier === "hospital" ? (
              <div>
                <label className="label-base" htmlFor="med5-prior-annual-paid">
                  계약해당일 기준 1년간 이미 부담한 중증 비급여 입원 자기부담금 (원)
                </label>
                <AmountInput
                  id="med5-prior-annual-paid"
                  value={priorAnnualPaid}
                  onChange={setPriorAnnualPaid}
                  placeholder="없으면 0"
                />
                <p className="mt-2 text-xs text-slate-500">
                  자기부담 상한 500만 원은 <b>계약일 또는 매년 계약해당일부터 1년</b> 단위로 누적됩니다
                  (표준약관 특별약관1 제5조). 그 기간에 이미 부담한 금액을 입력하면 상한에 누적 반영됩니다.
                </p>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">
                  자기부담 상한(500만 원)은 상급종합·종합병원 입원에만 적용됩니다. 병·의원급 입원에는
                  적용되지 않아 연간 누적 자기부담금을 입력받지 않습니다.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6">
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setSubmitted(true)}>
          자기부담금 계산하기
        </button>
      </div>

      {submitted && (
        <div className="mt-8 space-y-4">
          {needsItem && (
            <NoticeBox variant="warning">
              비급여는 <b>치료유형</b>에 따라 적용되는 보장종목과 산식이 다릅니다. 치료유형을 먼저
              선택해 주세요. 선택 전에는 계산하지 않습니다.
            </NoticeBox>
          )}

          {needsSeverity && (
            <NoticeBox variant="info">
              비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요.
            </NoticeBox>
          )}

          {/* 차단 사유는 엔진이 만든 문구를 그대로 보여준다. 화면에서 지어내지 않는다. */}
          {result && result.status === "PENDING_UNVERIFIED" && (
            <NoticeBox variant="warning">{result.notes.join(" ")}</NoticeBox>
          )}

          {result && result.status === "OK" && num > 0 && (
            <>
              <ResultCard
                title="계산 결과 (5세대 실손 기준 · 참고용)"
                items={[
                  { label: "총 진료비", value: won(result.amount) },
                  {
                    label: `자기부담률 (${((result.rateApplied ?? 0) * 100).toFixed(0)}%${
                      result.minDeductible ? ` · 최소공제액 ${won(result.minDeductible)} 비교` : ""
                    })`,
                    value: won(result.rateBased ?? 0),
                  },
                  { label: "본인부담금", value: won(result.ownPay ?? 0), highlight: true },
                  { label: "보험 적용 금액", value: won(result.insurancePay ?? 0) },
                ]}
              />
              {result.appliedCaps.length > 0 && (
                <NoticeBox variant="info">
                  적용된 한도: {result.appliedCaps.map((code) => CAP_LABELS[code]).join(", ")}. 보험 적용/본인부담 금액이 조정되었습니다.
                </NoticeBox>
              )}
              {result.notes.length > 0 && (
                <NoticeBox variant="info">{result.notes.join(" ")}</NoticeBox>
              )}
              {coverage === "non_benefit" && nonBenefitItem === "general" && visit === "outpatient" && (
                <NoticeBox variant="info">
                  {severity === "non_critical"
                    ? "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 여러 번 다녀왔다면 하루치를 합산한 금액을 입력해 주세요."
                    : "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 합산한 금액을 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 따로 계산합니다."}
                </NoticeBox>
              )}
              <p className="text-xs text-slate-500">
                ※ 실제 보험금은 가입 상품, 약관, 연간 누적 사용액, 차등제 등에 따라 달라질 수 있습니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
