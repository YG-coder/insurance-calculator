"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import RawAmountInput from "@/components/RawAmountInput";
import NoticeBox from "@/components/NoticeBox";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { calculate } from "@/lib/insurance/engine/engine";

type Coverage = "benefit" | "non_benefit"; // 급여 / 비급여
type Visit = "outpatient" | "inpatient";   // 통원 / 입원
type Tier = "clinic" | "hospital";         // 병·의원급 / 상급종합·종합병원

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

/**
 * 4세대 **단건** 진료비 파서. 원문 문자열을 형식으로 **먼저** 판정한다.
 *
 * ⚠ 종전 `Number(amount.replace(/[^0-9]/g, "")) || 0`을 쓰면 안 된다. 숫자가 아닌 문자를
 *   **지우고** 실패를 0으로 바꾸므로 파서에 닿기 전에 값이 다른 유효값으로 둔갑한다 —
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**15**(점을 지워 10배), `1e3`→**13**, `1,0`→**10**,
 *   `abc`·빈 값·`Infinity`→**0**. 위젯(`AmountInput`)도 같은 정제를 하고 15자리로 **자르므로**
 *   파서만 고쳐서는 늦다. 그래서 위젯을 `RawAmountInput`으로 바꿔 원문을 보존한다.
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ 다회 계산기의 `gen2021Amount`나 다른 세대 파서를 재사용하지 않는다. 형식 규칙이 같아도
 *   세대·화면·안내가 다르고, 다회의 파서·게이트는 이번에 건드리지 않는다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `300000`) 또는 정확한 천 단위 구분
 *   (`300,000`, `1,234,567`). **명시적으로 입력한 `0`도 파서에서는 유효한 숫자**다 —
 *   0원을 어떻게 다룰지는 아래 화면 정책(4세대는 "1원 이상")이 정한다.
 * 무효(null): 빈 값·공백, 부호(`-`/`+`), 문자, `NaN`·`Infinity`, 소수(`1.5`·`1.`·`.5`),
 *   지수 표기(`1e3`), 잘못된 쉼표(`1,0`·`1,00,000`·`,300`·`300,`), 안전 정수 초과.
 */
const GEN2021_SINGLE_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const gen2021SingleAmount = (v: string): number | null => {
  if (!GEN2021_SINGLE_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

export default function HealthCalc() {
  const [amount, setAmount] = useState<string>("300000");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [submitted, setSubmitted] = useState(false);

  // ⚠ 원문이 유효한 형식일 때만 숫자가 된다. 실패를 0으로 바꾸지 않는다.
  const parsed = gen2021SingleAmount(amount);
  const amountInvalid = parsed === null;

  // 계산은 실손보험 엔진(generation2021)에 위임. 산식은 src/lib/insurance/ 로 이동.
  // 내부 엔진 교체이며, 화면·상태·라벨·결과값은 종전과 동일하다.
  // ⚠ 무효한 원문에서는 **엔진을 호출하지 않는다.** 종전에는 렌더마다 무조건 호출해
  //   `abc`·`-1`이 0원·1원짜리 계산 결과를 만들었다.
  const result = parsed === null
    ? null
    // ⚠ 종별은 4세대 **급여 통원**의 최소공제만 가른다(G-34C). 급여 입원은 약관이 정률만
    //   정하고, 비급여 통원의 최소공제는 종별 구분이 없으며, 비급여 입원에는 최소공제가 없다.
    //   종전에는 네 경로 모두에 실어 보냈고 세 경로에서는 **읽고 무시**됐다 — 화면이 고른
    //   종별이 반영된 것처럼 보였다. 공통 객체가 값을 싣는다는 사실은 허용 근거가 아니므로
    //   런타임 거부와 함께 화면의 전달도 바로잡는다.
    //   ⚠ 상태(`tier`)와 선택 UI는 그대로 둔다. 경로를 오가도 선택이 보존되고, 급여 통원으로
    //     돌아오면 같은 값이 다시 전달된다. **비활성 경로에만 싣지 않는다.**
    : calculate("2021", {
        amount: parsed, coverage, visit,
        tier: coverage === "benefit" && visit === "outpatient" ? tier : undefined,
      });
  const num = parsed ?? 0;
  const rate = result?.rateApplied ?? 0;
  const minDeductible = result?.minDeductible ?? 0;
  const rateBased = result?.rateBased ?? 0;
  const ownPay = result?.ownPay ?? 0;
  const insurancePay = result?.insurancePay ?? 0;

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="med-amount">
            병원비 (원)
          </label>
          <RawAmountInput
            id="med-amount"
            value={amount}
            onChange={setAmount}
            placeholder="예: 300,000"
            ariaLabel="병원비"
          />
        </div>

        <div>
          <label className="label-base">진료 구분</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCoverage("benefit")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                coverage === "benefit"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              급여
            </button>
            <button
              type="button"
              onClick={() => setCoverage("non_benefit")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                coverage === "non_benefit"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              비급여
            </button>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label-base">치료 형태</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button
              type="button"
              onClick={() => setVisit("outpatient")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                visit === "outpatient"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              통원
            </button>
            <button
              type="button"
              onClick={() => setVisit("inpatient")}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                visit === "inpatient"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
              }`}
            >
              입원
            </button>
          </div>
        </div>

        {visit === "outpatient" && coverage === "benefit" && (
          <div className="sm:col-span-2">
            <label className="label-base">방문 의료기관</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button
                type="button"
                onClick={() => setTier("clinic")}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                  tier === "clinic"
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
                }`}
              >
                병·의원급
              </button>
              <button
                type="button"
                onClick={() => setTier("hospital")}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                  tier === "hospital"
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
                }`}
              >
                상급종합·종합병원
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              급여 통원 최소공제액: 병·의원급 1만 원 / 상급종합·종합병원 2만 원
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={() => setSubmitted(true)}
        >
          자기부담금 계산하기
        </button>
      </div>

      {/* ⚠ **정책 교체.** 종전 조건은 `num > 0`이었다 — 입력값을 보느라 (1) 정상 0원 결과를
             감췄고, (2) `result.status`를 **아예 보지 않아** 엔진이 차단한 결과도 `?? 0` 때문에
             전부 0원인 카드로 그렸다. 결과 상태를 기준으로 바꿔 두 문제를 함께 닫는다.
             ⚠ 차단 안내 UI는 이번에 만들지 않는다 — 이 화면은 `tier`를 항상 유효 리터럴로만
             싣고 stray 축을 넘기지 않아 공개 화면에서 PENDING 도달 경로를 찾지 못했다
             (없다고 단정하지는 않는다). 도달하면 카드를 그리지 않는 계약만 고정한다. */}
      {submitted && result !== null && result.status === "OK" && (
        <div className="mt-8">
          {/* ⚠ **라이브 리전은 요약 한 문장만 담는다.** 결과 카드·표를 이 안에 넣으면
                  제출 뒤 입력을 고칠 때마다 표 전체가 다시 낭독된다(이 화면들은 `submitted`가
                  true로 유지된 채 매 입력마다 재계산된다). `aria-atomic`으로 문장 전체를
                  한 번에 읽게 하고, 카드는 리전 **밖**에 둔다. */}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            계산 결과. 총 진료비 {won(num)}, 본인부담금 {won(ownPay)}, 보험 적용 금액 {won(insurancePay)}.
          </p>
          <ResultCard
            title="계산 결과 (4세대 실손 기준 · 참고용)"
            items={[
              { label: "총 진료비", value: won(num) },
              {
                label: `자기부담률 (${(rate * 100).toFixed(0)}%${
                  visit === "outpatient"
                    ? ` · 최소공제액 ${won(minDeductible)} 비교`
                    : ""
                })`,
                value: won(rateBased),
              },
              { label: "본인부담금", value: won(ownPay), highlight: true },
              { label: "보험 적용 금액", value: won(insurancePay) },
            ]}
          />
          {result.appliedCaps.length > 0 && (
            <div className="mt-4">
              <NoticeBox variant="info">
                적용된 한도: {result.appliedCaps.map((code) => CAP_LABELS[code]).join(", ")}. 보험 적용 금액이 조정되었습니다. 통원 보험금은 외래와
                처방조제비를 합해 1회당 20만 원이 상한입니다.
              </NoticeBox>
            </div>
          )}
          {result.notes.length > 0 && (
            <div className="mt-3">
              <NoticeBox variant="info">{result.notes[0]}</NoticeBox>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            ※ 실제 보험금은 가입 상품, 약관, 한도, 차등제 등에 따라 달라질 수
            있습니다.
          </p>
        </div>
      )}
      {/* ⚠ 형식 오류와 "0원"은 다른 안내다. 0원 거부는 이 화면의 **종전 정책**이고
             이번에 바꾸지 않는다. 형식 오류는 이번에 새로 막는 경우다. */}
      {submitted && amountInvalid && (
        <div className="mt-6">
          <NoticeBox variant="warning">
            <b>병원비</b>를 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 —
            <b> 300000</b> 또는 <b>300,000</b> 형식입니다. 빈 값이나 잘못된 입력(음수·소수·문자·
            지수 표기·잘못된 쉼표)을 계산기가 <b>임의로 다른 금액으로 바꾸지 않으며</b>,
            빈 값을 0원으로 보지도 않습니다. 올바르게 입력하기 전에는 계산하지 않습니다.
          </NoticeBox>
        </div>
      )}
      {/* ⚠ **삭제한 자리다.** 종전에는 `num === 0`에서 "진료비를 1원 이상 입력해 주세요."를
             띄웠다. 0원은 파서가 인정하는 **유효한 입력**이고 엔진도 정상 계산하는데, 그 안내가
             정상 결과를 입력 오류처럼 설명했다. 이제 위 게이트가 0원 결과 카드를 그린다.
             ⚠ 5세대에는 이 문구가 처음부터 없었다 — 세대 간 비대칭도 함께 없앴다. */}
    </div>
  );
}
