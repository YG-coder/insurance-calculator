"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import RawAmountInput from "@/components/RawAmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calc2026, GEN2026_NON_BENEFIT_ITEM_LABEL } from "@/lib/insurance/engine/generation2026";
import { Coverage, Visit, Tier, Severity, Gen2026NonBenefitItem } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { GEN2026 } from "@/lib/insurance/engine/constants";

const won = (n: number) =>
  `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

/**
 * **고정 비율 경로**의 자기부담률(%) 표기. 급여 입원(20%)·비급여 중증 입원(30%)·비중증
 * 입원(50%)처럼 규칙값에서 온 비율만 여기로 온다.
 *
 * ⚠ **사용자가 입력한 급여 통원 비율은 이 함수를 쓰지 않는다.** 아래
 *   `benefitOutpatientPct`가 곱셈을 거치지 않은 값을 그대로 그린다 — 그 경로에서
 *   `rate * 100`을 하면 이진 부동소수점 흔적이 생기고(실측: `0.259 * 100`은
 *   **25.900000000000002**, `0.269 * 100`은 **26.900000000000002**), 그것을 반올림해
 *   지우면 이번에는 **입력 자릿수가 잘린다**(`20.12345678901` → `toFixed(10)`이면
 *   `20.123456789`). 계약이 자릿수를 제한하지 않으므로 둘 다 곤란하다.
 *   (`0.305 * 100`은 정확히 `30.5`라 흔적이 없다 — 값에 따라 다르다.)
 * ⚠ 고정 비율은 `0.2`·`0.3`·`0.5`·`1`이라 `* 100`이 정확히 `20`·`30`·`50`·`100`이다.
 *   그래서 이 경로에는 곱셈이 안전하고, 꼬리 `0` 정리만 남긴다.
 * ⚠ **표시만 다룬다.** 계산에 쓰이는 값(`rateApplied`)도 산식도 엔진도 건드리지 않는다.
 *   최소공제액이 커서 실제 부담이 이 비율을 넘는 경우가 있는데, 그 사실은 라벨 뒤의
 *   "최소공제액 … 비교" 문구가 종전대로 알린다.
 */
const pct = (rate: number) => {
  const v = (rate ?? 0) * 100;
  if (!Number.isFinite(v)) return "0";
  return v.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
};

/**
 * 5세대 **단건** 진료비 파서. 원문 문자열을 형식으로 **먼저** 판정한다.
 *
 * ⚠ 종전 `Number(amount.replace(/[^0-9]/g, "")) || 0`을 쓰면 안 된다. 숫자가 아닌 문자를
 *   **지우고** 실패를 0으로 바꾸므로 파서에 닿기 전에 값이 다른 유효값으로 둔갑한다 —
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**15**(점을 지워 10배), `1e3`→**13**, `1,0`→**10**,
 *   `abc`·빈 값·`Infinity`→**0**. 위젯(`AmountInput`)도 같은 정제를 하고 15자리로 **자르므로**
 *   파서만 고쳐서는 늦다. 그래서 진료비 위젯만 `RawAmountInput`으로 바꿔 원문을 보존한다.
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ 다회 계산기의 `gen2026Amount`·`roomChargeAmount`나 4세대 파서를 재사용하지 않는다.
 *   형식 규칙이 같아도 세대·화면·안내가 다르고, 다회의 파서·게이트는 이번에 건드리지 않는다.
 * ⚠ 같은 화면의 **통원 가입금액·누적 공제금액도 이 파서를 쓴다(G-11A).** 형식 규칙은 같지만
 *   **빈 값의 뜻이 서로 다르다** — 통원 가입금액은 `undefined`(미적용), 누적 공제금액은 `0`.
 *   빈 문자열은 파서가 아니라 **호출부**에서 나눈다. 두 필드의 그 계약은 기존 그대로 유지한
 *   것이며, 빈 값을 그렇게 보는 것이 안전하다고 확정한 것이 아니다.
 * ⚠ 통원 가입금액의 **0 = 미입력** 판정은 화면이 아니라 **엔진 정책**이다
 *   (`generation2026.ts`의 `outpatientLimit()`이 `<= 0`을 미입력으로 본다). 숫자 `0`을 그대로
 *   넘기고 그 판정을 바꾸지 않는다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `300000`) 또는 정확한 천 단위 구분
 *   (`300,000`, `1,234,567`). **명시적으로 입력한 `0`도 파서에서는 유효한 숫자**다 —
 *   0원에서 결과를 내지 않는 것은 이 화면의 **종전 정책**이며 이번에 바꾸지 않는다.
 * ⚠ **자릿수를 제한하지 않는다.** `1000000000000000`(안전 정수인 16자리)은 그대로 받고,
 *   `9007199254740993`만 안전 정수 범위를 벗어나므로 차단한다.
 * 무효(null): 빈 값·공백, 부호(`-`/`+`), 문자, `NaN`·`Infinity`, 소수(`1.5`·`1.`·`.5`),
 *   지수 표기(`1e3`), 잘못된 쉼표(`1,0`·`1,00,000`·`,300`·`300,`), 안전 정수 초과.
 */
const GEN2026_SINGLE_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const gen2026SingleAmount = (v: string): number | null => {
  if (!GEN2026_SINGLE_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 5세대 단건 **급여 통원의 건강보험 본인부담률(%)** 전용 파서. 원문 문자열을 형식으로 먼저
 * 판정한다.
 *
 * ⚠ **금액 파서와 합치지 않는다.** 비율은 계약이 다르다 — 소수를 허용해야 하고(정당한
 *   `12.5%`를 금액 규칙으로 막으면 안 된다), 쉼표는 쓰지 않으며, 값의 범위가 0~100으로
 *   닫혀 있다. `gen2026SingleAmount`를 재사용하면 이 셋이 모두 어긋난다.
 * ⚠ 종전 `Math.min(100, Math.max(0, Number(nhisRate))) / 100`을 쓰면 안 된다. 그 식은
 *   **조용히 보정한다** — `1e3`·`300000`은 1000%·300000%인데 **100%로 깎여** 보험금이
 *   0원이 되고, `-1`은 **0%로 올라가** 하한 20%로 계산된다. 사용자는 자기가 넣은 값이
 *   바뀐 줄 모른다. 보정 대신 **차단**한다.
 * ⚠ 위젯도 함께 바꾼다. `type="number"`는 브라우저가 문자를 지워 원문이 상태에 닿지 않으므로
 *   파서만 고쳐서는 늦다(`abc`를 치면 화면과 상태가 조용히 `""`이 된다).
 *   `type="text"` + `inputMode="decimal"`로 원문을 보존하고 여기서 판정한다.
 * ⚠ **소수 자릿수를 제한하지 않는다.** 종전 화면의 `step="0.1"`은 스피너 증감폭이지
 *   약관이 한 자리로 정했다는 근거가 아니다. 자리 제한을 새로 만들면 근거 없는 규칙이 된다.
 * ⚠ **0~100 밖은 깎지 않고 차단한다.** `100.1`·`101`·아주 큰 수 모두 무효다.
 *
 * 유효: 부호·공백·쉼표·지수 표기 없는 0 이상 100 이하의 숫자.
 *   정수부는 필수, 소수부는 선택 — `0`, `00`, `01`, `20`, `12.5`, `12.50`, `100`, `100.0`.
 * 무효(null): `.5`(정수부 없음), `1.`(소수부 없음), `+1`·`-1`, `1e3`, `1,0`, `20만`, `abc`,
 *   공백만·앞뒤 공백, `NaN`, `Infinity`, `100.1`·`101` 같은 범위 초과.
 *   빈 문자열 `""`은 파서가 아니라 **호출부**에서 처리한다(미입력 → `undefined`).
 */
const GEN2026_NHIS_RATE_FORMAT = /^[0-9]+(?:\.[0-9]+)?$/;
const gen2026NhisRate = (v: string): number | null => {
  if (!GEN2026_NHIS_RATE_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

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
  // 급여 통원의 의료기관 종별. 최소공제가 갈리지만 종전부터 기본값이 있었고 이번에 바꾸지 않는다.
  const [benefitTier, setBenefitTier] = useState<Tier>("clinic");
  // 비급여 **입원**의 의료기관 종별. ⚠ 기본값을 두지 않는다.
  //   중증은 공제금액 상한 500만원(특약1 제5조⑤), 비중증은 1회당 300만원 한도(특약2 제3조 (1)①·(2)①)가
  //   종별에 따라 갈린다. 자동 선택되면 사용자가 인식하지 못한 채 한쪽으로 계산된다.
  const [nbInpatientTier, setNbInpatientTier] = useState<Tier | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  // 초기값은 미선택이어야 한다. "general"을 기본값으로 두면 안전 차단이 무력화된다.
  const [nonBenefitItem, setNonBenefitItem] = useState<Gen2026NonBenefitItem | null>(null);
  const [priorDeductible, setPriorDeductible] = useState<string>("0");
  const [outpatientLimit, setOutpatientLimit] = useState<string>("");
  const [nhisRate, setNhisRate] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  // ⚠ 원문이 유효한 형식일 때만 숫자가 된다. 실패를 0으로 바꾸지 않는다.
  const parsed = gen2026SingleAmount(amount);
  const amountInvalid = parsed === null;
  const num = parsed ?? 0;

  // 비급여는 ①치료유형 ②중증/비중증을 모두 고른 뒤에만 계산한다(엔진 호출 전 UI 가드).
  //   치료유형이 "일반 비급여"가 아니면 질환 구분과 무관하게 엔진이 차단한다.
  const needsItem = coverage === "non_benefit" && nonBenefitItem === null;
  const needsSeverity =
    coverage === "non_benefit" && nonBenefitItem === "general" && severity === null;
  // 비급여 입원은 종별을 고르기 전에는 계산하지 않는다(중증·비중증 모두).
  //   ⚠ 종별 입력은 질환 구분을 고른 뒤에야 화면에 나타난다. severity 조건을 빼면
  //     아직 보이지도 않는 입력을 선택하라는 안내가 질환 구분 안내와 함께 뜬다.
  //     안내 순서를 화면에 나타나는 순서와 맞춘다.
  const needsTier =
    coverage === "non_benefit" && nonBenefitItem === "general" && severity !== null
    && visit === "inpatient" && nbInpatientTier === null;

  // ── 두 금액 입력의 활성 조건 (G-11A) ────────────────────────────────
  /**
   * ⚠ **엔진 소비 조건을 새로 만들지 않고 그대로 옮겼다.**
   *   - `perVisitCoverageLimit`: `generation2026.ts`가 이 값을 읽는 곳은 **통원 두 분기뿐**이다
   *     (중증 = 1회당 `outpatientPerVisitLimitMax`, 비중증 = 1일당 `outpatientPerDayLimitMax`).
   *     입원 분기는 읽지 않는다.
   *   - `priorAnnualDeductible`: 500만원 상한은
   *     `severity === "critical" && visit === "inpatient" && tier === "hospital"`에서만 적용된다.
   *     `hospital`은 버튼 라벨대로 **상급종합·종합병원**이다.
   * ⚠ `nonBenefitItem === "general"`을 함께 본다. 화면의 두 입력이 이미 그 조건 안에서만
   *   보이고, 별도 보장종목(3대비급여·MRI·상급병실료)은 엔진이 계산 전에 차단하므로
   *   결과가 달라지지 않는다. 종전에는 이 조건이 전달식에 없어, 일반 비급여에서 고른
   *   질환 구분·종별이 남은 채 치료유형만 바꾸면 **쓰이지도 않을 값이 계속 실려 갔다.**
   *   노출·검증·전달을 하나의 조건으로 모은다.
   */
  const usesOutpatientLimit =
    coverage === "non_benefit" && nonBenefitItem === "general" && visit === "outpatient";
  const usesPriorDeductible =
    coverage === "non_benefit" && nonBenefitItem === "general"
    && severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital";
  /**
   * 건강보험 본인부담률의 활성 조건 (G-11B). 엔진이 이 값을 읽는 곳은 **급여 통원 분기뿐**이다
   * (`generation2026.ts`의 `Math.max(nhis, floorRate)`). 급여 입원과 모든 비급여 경로에서는
   * 검증도 전달도 하지 않는다.
   */
  const usesNhisRate = coverage === "benefit" && visit === "outpatient";
  /**
   * ⚠ **빈 문자열만** `undefined`다 — 그래야 엔진의 종전 `PENDING_UNVERIFIED` 안내
   *   ("건강보험 본인부담률 미제공 → 계산 불가")가 그대로 나온다.
   *   **공백만은 빈 값이 아니라 무효**다. `trim()`으로 정리해 통과시키지 않는다.
   * ⚠ 명시적 `0`은 숫자 0으로 전달하고 엔진의 종전 20% 하한 처리를 그대로 따른다.
   */
  const nhisRateNum = !usesNhisRate || nhisRate === "" ? undefined : gen2026NhisRate(nhisRate);
  const nhisRateInvalid = nhisRateNum === null;
  /**
   * 급여 통원 결과 라벨에 그릴 **적용 퍼센트**. `/100`하기 전의 검증된 값을 그대로 쓴다.
   *
   * ⚠ 이렇게 하는 이유는 **곱셈으로 생기는 부동소수점 흔적 자체를 피하기 위해서**다.
   *   엔진은 `Math.max(nhis, floorRate)`를 rate 단위로 계산하는데, 그 결과에 `* 100`을 하면
   *   실측으로 `0.259 * 100 = 25.900000000000002`, `0.269 * 100 = 26.900000000000002`처럼
   *   꼬리가 붙는다. 반올림으로 지우면 이번에는 입력 자릿수가 잘린다
   *   (`20.12345678901`은 `toFixed(10)`에서 `20.123456789`가 된다).
   *   사용자가 친 십진 값 자체를 들고 있으면 두 문제가 모두 사라진다.
   * ⚠ 하한은 엔진과 **같은 규칙값**을 쓴다. `floorRate`는 `0.2`이고 `0.2 * 100`은 정확히
   *   `20`이라 이 곱셈에는 흔적이 없다. 화면에 `20`을 하드코딩하지 않는다.
   * ⚠ 이것은 **표시 전용**이다. 엔진에는 여전히 `nhisRateNum / 100`이 간다.
   */
  const benefitOutpatientPct = !usesNhisRate || nhisRateNum === null || nhisRateNum === undefined
    ? null
    : Math.max(nhisRateNum, GEN2026.benefit.outpatient.floorRate * 100);
  /**
   * ⚠ **활성일 때만 검증한다.** 조건이 거짓이면 `undefined`다 — 숨은 원문은 상태에 남지만
   *   파서에 닿지 않고 엔진에도 가지 않는다. 조건이 돌아오면 무효값 안내도 다시 나타난다.
   * ⚠ **빈 값의 뜻이 서로 다르다.** 통원 가입금액은 `undefined`(미적용, 초기값이 `""`),
   *   누적 공제금액은 `0`(초기값이 `"0"`이고 종전 `Number("") || 0`도 0이었다).
   *   기존 계약을 그대로 유지한 것이며, 그렇게 보는 것이 안전하다고 확정한 것이 아니다.
   * ⚠ 종전에는 `outpatientLimit.trim() !== ""`로 공백만도 미입력으로 넘겼다. 이제 공백만은
   *   **무효**다 — `trim()`으로 정리해 통과시키면 화면 원문과 계산에 쓰인 값이 어긋난다.
   * ⚠ 통원 가입금액의 상한(20만원)과 `0 = 미입력` 판정은 **엔진**이 한다. 화면에서 깎지 않는다.
   */
  const outpatientLimitNum = !usesOutpatientLimit || outpatientLimit === ""
    ? undefined : gen2026SingleAmount(outpatientLimit);
  const priorDeductibleNum = !usesPriorDeductible ? undefined
    : priorDeductible === "" ? 0 : gen2026SingleAmount(priorDeductible);
  const outpatientLimitInvalid = outpatientLimitNum === null;
  const priorDeductibleInvalid = priorDeductibleNum === null;
  /**
   * ⚠ 무효값을 0이나 `undefined`로 바꿔 계산하지 않는다. `null`을 **배제**해야만 이 객체가
   *   만들어지고, 그 과정에서 두 값이 `number | undefined`로 좁혀진다.
   *   ⚠ 이 화면에 남아 있는 `nonBenefitItem as Gen2026NonBenefitItem` 단언은 **이번 대상이
   *     아니다.** 여기서 말하는 것은 **새로 만든 금액 파싱 결과에 단언을 추가하지 않는다**는
   *     범위다. 종전 단언의 정리는 별도 과제로 남긴다.
   */
  const limits = outpatientLimitNum === null || priorDeductibleNum === null
    ? null
    : { perVisit: outpatientLimitNum, deductible: priorDeductibleNum };

  // calc2026을 직접 호출한다 — 비급여에서 치료유형 누락이 컴파일 에러가 되는 경로다.
  //   ⚠ 무효한 원문에서는 **엔진을 호출하지 않는다.** 종전에는 급여에서 렌더마다 무조건
  //     호출해 `abc`·`-1`이 0원·1원짜리 후보 결과를 만들었고, 비급여에서도 선택 게이트만
  //     통과하면 같은 일이 벌어졌다. 결과·차단 안내 어느 쪽도 내보내지 않는다.
  const result = amountInvalid
    ? null
    : coverage === "benefit"
      // ⚠ 본인부담률이 무효이면 **엔진을 호출하지 않는다.** 결과 카드도 엔진 안내도 나오지
      //   않는다. `null`을 배제해야만 다음 줄에 닿으므로 타입 단언도 0 대체도 없다.
      ? nhisRateNum === null
        ? null
        : calc2026({
            amount: num,
            coverage: "benefit",
            visit,
            tier: benefitTier,
            // ⚠ 여기서 깎지 않는다. 범위 판정은 파서가 이미 했다.
            nhisCoinsuranceRate: nhisRateNum === undefined ? undefined : nhisRateNum / 100,
          })
      : needsItem || needsSeverity || needsTier || limits === null
        ? null
        : calc2026({
            amount: num,
            coverage: "non_benefit",
            visit,
            // ⚠ 빈 값을 Tier로 단언해 넘기지 않는다. 위 게이트가 미선택을 이미 배제한다.
            tier: visit === "inpatient" ? nbInpatientTier ?? undefined : undefined,
            severity: severity ?? undefined,
            nonBenefitItem: nonBenefitItem as Gen2026NonBenefitItem,
            priorAnnualDeductible: limits.deductible,
            perVisitCoverageLimit: limits.perVisit,
          });

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label-base" htmlFor="med5-amount">
            병원비 (원)
          </label>
          <RawAmountInput
            id="med5-amount"
            value={amount}
            onChange={setAmount}
            placeholder="예: 300,000"
            ariaLabel="병원비"
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
                <button type="button" onClick={() => setBenefitTier("clinic")} className={btn(benefitTier === "clinic")}>
                  병·의원급
                </button>
                <button type="button" onClick={() => setBenefitTier("hospital")} className={btn(benefitTier === "hospital")}>
                  상급종합·종합병원
                </button>
              </div>
            </div>
            {/* ⚠ 이 입력의 라벨은 **하나뿐이다.** 같은 페이지의 다회 계산기에도 같은 이름의
                   라벨이 있지만 그것은 다른 컴포넌트의 정상 라벨이며 건드리지 않는다.
                   `id`는 `med5-` 접두사라 다회(무명 input)와 충돌하지 않는다.
                ⚠ `type="number"`를 쓰면 안 된다. 브라우저가 문자를 지워 원문이 상태에 닿지
                   않으므로(`abc` → 화면·상태 모두 `""`) 아래 파서가 판정할 기회가 사라진다.
                   `min`/`max`/`step`도 함께 없앤다 — `type="text"`에서는 동작하지 않는 데다
                   `step="0.1"`은 약관이 소수 한 자리로 정했다는 근거가 아니다. */}
            <div className="sm:col-span-2 max-w-md">
              <label className="label-base" htmlFor="med5-nhis-rate">건강보험 본인부담률 (%)</label>
              <input
                id="med5-nhis-rate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-describedby="med5-nhis-rate-help"
                value={nhisRate}
                onChange={(e) => setNhisRate(e.target.value)}
                placeholder="진료비 영수증·보험사 안내에서 확인"
                className="input-base w-full"
              />
              <p id="med5-nhis-rate-help" className="mt-2 text-xs text-slate-500">
                <b>0~100 사이의 숫자</b>를 입력해 주세요. 소수도 받습니다 — <b>20</b> 또는
                <b> 12.5</b> 형식입니다. 건강보험 본인부담률을 모르면 <b>비워</b> 두세요.
                정확한 급여 통원 계산을 제공하지 않습니다.
              </p>
            </div>
          </>
        )}

        {coverage === "non_benefit" && nonBenefitItem === "general" && visit === "outpatient" && (
          <div className="sm:col-span-2 max-w-md">
            <label className="label-base" htmlFor="med5-outpatient-limit">
              통원 가입금액 (선택)
            </label>
            <RawAmountInput
              id="med5-outpatient-limit"
              value={outpatientLimit}
              onChange={setOutpatientLimit}
              placeholder="예: 200,000 — 모르면 비워두세요"
              ariaLabel="통원 가입금액"
            />
            <p className="mt-2 text-xs text-slate-500">
              약관은 통원 가입금액을 <b>20만 원 이내에서 계약 시 정한 금액</b>으로 규정합니다
              (중증은 1회당, 비중증은 1일당). 계약마다 다른 값이라 입력하지 않으면 적용하지 않으며,
              0원을 입력해도 미입력으로 처리합니다.
            </p>
          </div>
        )}

        {/* 입원 의료기관 종별은 중증·비중증 **모두** 결과를 바꾼다.
            중증 — 상급종합·종합병원에만 공제금액 상한 500만원(특별약관1 제5조⑤)
            비중증 — 병·의원급에만 1회당 300만원 한도(특별약관2 제3조 (1)①·(2)①)
            둘 다 종별에 따라 보험금이 달라지므로 기본값으로 계산하지 않는다. */}
        {coverage === "non_benefit" && nonBenefitItem === "general" && severity !== null && visit === "inpatient" && (
          <>
            <div className="sm:col-span-2">
              <label className="label-base">입원 의료기관</label>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                <button type="button" onClick={() => setNbInpatientTier("clinic")} className={btn(nbInpatientTier === "clinic")}>
                  병·의원급
                </button>
                <button type="button" onClick={() => setNbInpatientTier("hospital")} className={btn(nbInpatientTier === "hospital")}>
                  상급종합·종합병원
                </button>
              </div>
            </div>
            {severity === "non_critical" && (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">
                  비중증 입원의 <b>1회당 300만 원 한도</b>는 「의료법」 제3조제2항 의료기관 중
                  <b> 종합병원을 제외한 곳</b>(병·의원급)에서 발생한 비급여 의료비에만 적용됩니다
                  (표준약관 특별약관2 제3조 (1)제1항·(2)제1항). 상급종합·종합병원 입원에는 적용하지 않습니다.
                </p>
              </div>
            )}
            {/* 공제금액 상한(500만)은 상급종합·종합병원 입원에만 적용된다.
                병·의원급에서 이 값을 받으면 계산에 반영되지 않아 사용자가 오인한다.
                ⚠ 누적 대상은 약관상 공제금액이며 최종 자기부담금이 아니다(특별약관1 제5조⑤). */}
            {severity === "critical" && (nbInpatientTier === "hospital" ? (
              <div>
                <label className="label-base" htmlFor="med5-prior-annual-deductible">
                  계약해당일 기준 1년간 이미 누적된 중증 비급여 입원 공제금액 (원)
                </label>
                <RawAmountInput
                  id="med5-prior-annual-deductible"
                  value={priorDeductible}
                  onChange={setPriorDeductible}
                  placeholder="없으면 0"
                  ariaLabel="계약해당일 기준 1년간 이미 누적된 중증 비급여 입원 공제금액"
                />
                <p className="mt-2 text-xs text-slate-500">
                  공제금액 상한 500만 원은 <b>계약일 또는 매년 계약해당일부터 1년</b> 단위로 누적됩니다
                  (표준약관 특별약관1 제5조 제5항). 누적되는 것은 약관상 <b>공제금액</b>이며, 보험가입금액
                  한도로 추가 부담한 금액은 포함되지 않습니다.
                </p>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">
                  공제금액 상한(500만 원)은 상급종합·종합병원 입원에만 적용됩니다. 병·의원급 입원에는
                  적용되지 않아 연간 누적 공제금액을 입력받지 않습니다.
                </p>
              </div>
            ))}
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
          {/* ⚠ 진료비는 화면 맨 위의 입력이다. 안내 순서를 화면 순서와 맞춘다.
                 그리고 진료비가 무효인 동안에는 **아직 고르지도 않은 축을 선택하라는
                 경고를 새로 만들지 않는다** — 먼저 고칠 것을 하나만 가리킨다. */}
          {amountInvalid && (
            <NoticeBox variant="warning">
              <b>병원비</b>를 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 —
              <b> 300000</b> 또는 <b>300,000</b> 형식입니다. 빈 값이나 잘못된 입력(음수·소수·문자·
              지수 표기·잘못된 쉼표)을 계산기가 <b>임의로 다른 금액으로 바꾸지 않으며</b>,
              빈 값을 0원으로 보지도 않습니다. 올바르게 입력하기 전에는 계산하지 않습니다.
            </NoticeBox>
          )}

          {/* 급여 통원의 본인부담률. 화면에서 병원비 바로 다음에 오는 입력이므로 안내도
                 병원비 다음에 둔다. 아래 비급여 안내들과는 경로가 배타적이라 겹치지 않는다. */}
          {!amountInvalid && nhisRateInvalid && (
            <NoticeBox variant="warning">
              <b>건강보험 본인부담률</b>을 올바르게 입력해 주세요. <b>0~100 사이의 숫자</b>만
              받습니다 — <b>20</b> 또는 <b>12.5</b> 형식이고 소수도 받습니다. 모르면
              <b> 완전히 비워</b> 두세요. 공백만 입력한 값은 빈 값으로 보지 않습니다.
              음수·100 초과·문자·지수 표기·쉼표를 계산기가 <b>0%나 100%로 바꾸지 않으며</b>,
              올바르게 입력하기 전에는 계산하지 않습니다.
            </NoticeBox>
          )}

          {!amountInvalid && needsItem && (
            <NoticeBox variant="warning">
              비급여는 <b>치료유형</b>에 따라 적용되는 보장종목과 산식이 다릅니다. 치료유형을 먼저
              선택해 주세요. 선택 전에는 계산하지 않습니다.
            </NoticeBox>
          )}

          {!amountInvalid && needsSeverity && (
            <NoticeBox variant="info">
              비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요.
            </NoticeBox>
          )}

          {!amountInvalid && needsTier && (
            <NoticeBox variant="info">
              비급여 <b>입원</b>은 <b>의료기관 종별</b>에 따라 보험금이 달라집니다. 중증은 공제금액
              상한 500만 원이 상급종합·종합병원 입원에만 적용되고(특별약관1 제5조 제5항), 비중증은
              1회당 300만 원 한도가 병·의원급에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항).
              입원 의료기관을 선택해 주세요. 선택 전에는 계산하지 않습니다.
            </NoticeBox>
          )}

          {/* ⚠ 병원비가 무효인 동안에는 새 안내를 만들지 않는 종전 정책(G-4)을 그대로 따른다.
                 여러 입력이 동시에 무효이면 각각 안내한다. */}
          {!amountInvalid && outpatientLimitInvalid && (
            <NoticeBox variant="warning">
              <b>통원 가입금액</b>을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 —
              <b> 200000</b> 또는 <b>200,000</b> 형식입니다. 이 한도를 적용하지 않으려면
              <b> 완전히 비워</b> 두세요. 공백만 입력한 값은 빈 값으로 보지 않습니다.
              음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다.
            </NoticeBox>
          )}

          {!amountInvalid && priorDeductibleInvalid && (
            <NoticeBox variant="warning">
              <b>이미 누적된 공제금액</b>을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만
              받습니다 — <b>3000000</b> 또는 <b>3,000,000</b> 형식입니다. 누적된 공제금액이
              없으면 <b>0</b>을 입력하세요(완전히 비운 값도 0으로 봅니다). 공백만 입력한 값은
              빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로
              고치지 않습니다. 500만 원을 넘는 값도 그대로 받습니다 — 상한 처리는 약관 산식이 합니다.
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
                    // ⚠ 급여 통원은 사용자가 친 십진 값을, 그 밖의 경로는 규칙값을 그린다.
                    label: `자기부담률 (${benefitOutpatientPct === null ? pct(result.rateApplied ?? 0) : String(benefitOutpatientPct)}%${
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
