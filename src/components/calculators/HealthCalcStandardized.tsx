"use client";

import { useState } from "react";
import ResultCard from "@/components/ResultCard";
import RawAmountInput from "@/components/RawAmountInput";
import NoticeBox from "@/components/NoticeBox";
import { calculateMany } from "@/lib/insurance/engine/multiClaim";
import { ClaimLine, Facility, Plan, Visit } from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";

type StdGeneration = "2009" | "2017";
type Row = { id: number; amount: string; visit: Visit; facility: Facility };

const MAX_ROWS = 20;

const won = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;
// ⚠ 종전 공용 정제 `onlyNum()`(= `Number(v.replace(/[^0-9]/g, "")) || 0`)은 이 커밋에서
//   마지막 사용처(빠른 채우기 반복 횟수)가 사라져 **삭제했다.** 아래 주석들이 이 이름을
//   언급하는 것은 "그 관용 정제를 쓰면 안 된다"는 근거를 남기기 위해서다.

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
/**
 * 2·3세대 다회의 **금액 입력** 문자열 파서 — 회(건)당 보험가입금액과 기존 입원
 * 자기부담금 두 곳에 쓴다. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `onlyNum()`을 쓰면 안 된다. 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾼다.
 *   `-1`·`+1`→**1**, `1.5`→**15**, `1e3`→**13**, `20만`→**20**, `1,0`→**10**이 되고
 *   `abc`·`NaN`·`Infinity`는 빈 값과 함께 **미입력**으로 합쳐진다.
 * ⚠ 위젯도 함께 바꿔야 한다. `AmountInput`은 이 파서에 닿기 전에 문자를 지우고
 *   **15자리로 자른다**. 절단은 무효값 문제가 아니라 **정상 입력의 무단 변형**이다 —
 *   `1000000000000000`(안전 정수인 16자리)이 `100000000000000`으로 바뀌어 자릿수가
 *   하나 줄고, 화면에도 바뀐 값이 그대로 표시돼 사용자가 변형 사실을 알 수 없다.
 * ⚠ **자릿수 제한과 안전 정수 검증은 다르다.** 이 파서는 자릿수를 제한하지 않는다.
 *   `1000000000000000`·`9007199254740991`은 안전 정수이므로 **원문과 값을 그대로 받고**,
 *   `9007199254740993`만 안전 정수 범위를 벗어나므로 차단한다.
 * ⚠ 잘못된 입력의 결과 방향은 **해석 가능한 경우에만** 말할 수 있다.
 *   - `1,0`을 `1,000`의 오타로 의도했다면 10원이 되어 **적게** 반영된다.
 *   - `-1`·`abc`·`1e3` 같은 값은 사용자가 의도한 유효값을 알 수 없다. 이때 말할 수 있는
 *     것은 **계산기가 원문을 임의의 다른 숫자로 바꾸거나 미입력으로 지웠다**는 사실뿐이다.
 *   그래서 방향을 추정하지 않고 차단한다.
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ `trim()`으로 정리해 통과시키지 않는다. 화면에 남은 원문과 계산에 쓰인 값이 달라진다.
 * ⚠ 진료비 파서(`stdAmount`)·4세대 금액 파서(`gen2021Money`)와 형식 규칙이 같아도
 *   재사용하지 않는다. 세대·라벨·안내·무효 시 차단 범위가 다르다.
 *
 * 유효: 쉼표 없는 0 이상의 안전 정수(`0`, `00`, `300000`, `1000000000000000`) 또는
 *   정확한 천 단위 구분(`300,000`). **명시적 `0`·`00`은 유효값**이며 그 뒤 처리는
 *   각 입력의 종전 정책을 따른다.
 * 무효(null): 공백만·앞뒤 공백·부호·문자·소수·지수 표기·잘못된 쉼표·안전 정수 초과.
 *   빈 문자열 `""`은 파서가 아니라 **호출부**에서 미입력으로 처리한다(둘 다 `undefined`).
 */
const STD_MONEY_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const stdMoney = (v: string): number | null => {
  if (!STD_MONEY_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

const STD_COUNT_FORMAT = /^[0-9]+$/;
const stdCount = (v: string): number | null => {
  if (!STD_COUNT_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 빠른 채우기 **반복 횟수** 전용 파서(2·3세대). 이 값은 "만들 행 수"일 뿐이고
 * 보험 횟수·한도·소진 상태와 아무 관계가 없다 — `stdCount`(외래 방문·처방전 횟수)와
 * **재사용하지 않는다.** 두 값은 허용 범위도 다르다(여기는 1 이상, 저기는 0 이상).
 *
 * ⚠ 공용 `onlyNum()`을 쓰면 안 된다. 실측: `1.5`→**15행**(점을 지운다), `1e3`→**13행**,
 *   `1,0`→**10행**, `20만`→**20행**, `abc`·빈 값·공백·`0`→**1행**. 게다가 종전에는
 *   무효값에서도 `채우기`가 실행돼 **이미 입력한 행을 전부 지우고 1행으로 만들었다**
 *   (4행 → 1행을 실측). 화면에 보이는 값과 실제로 만들어지는 행 수가 갈렸다.
 * ⚠ 상한을 넘는 값을 상한으로 **깎지 않는다.** 깎으면 사용자가 21을 넣었는데 20행이
 *   말없이 만들어진다.
 *
 * 유효: 1 이상 MAX_ROWS 이하의 안전 정수(`1`, `01`, `20`).
 * 무효(null): 빈 값·공백·`0`·상한 초과·부호·소수·지수 표기·쉼표·문자·안전 정수 초과.
 */
const STD_REPEAT_FORMAT = /^[0-9]+$/;
const stdRepeatCount = (v: string): number | null => {
  if (!STD_REPEAT_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_ROWS ? n : null;
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
  // 금액 두 축은 **현재 계산에 쓰이는 것만** 검증하고 전달한다.
  //   ⚠ 회(건)당 가입금액은 통원 행이 있을 때만, 기존 입원 자기부담금은 입원 행이 있을
  //     때만 쓰인다(엔진 multiClaim.ts의 행별 소비 조건과 같은 규칙). 종전에는 행 구성과
  //     무관하게 **무조건 전달**돼, 통원에서 넣은 가입금액이 입원만 남은 뒤에도 엔진에
  //     실려 "입력하지 않으면 적용하지 않습니다" 안내를 사라지게 했다.
  //   ⚠ 숨겨진 원문 상태는 지우지 않는다. 행 구성을 되돌리면 그대로 복원된다.
  //   ⚠ 빈 문자열만 미입력이다. 공백만 있는 입력은 무효다.
  const perVisitNum = !hasOutpatient || perVisitLimit === "" ? undefined : stdMoney(perVisitLimit);
  const priorPaidNum = !hasInpatient || priorPaid === "" ? undefined : stdMoney(priorPaid);
  const perVisitInvalid = perVisitNum === null;
  const priorPaidInvalid = priorPaidNum === null;
  const gated = needsVisits || needsPrescriptions || needsAmounts || perVisitInvalid || priorPaidInvalid;
  // 회(건)당 가입금액에 명시적 0을 넣으면 엔진은 한도를 적용하지 않는다(`perVisitLimit()`의
  //   `<= 0`). 그런데 엔진의 "입력하지 않으면 적용하지 않습니다" 안내는 `undefined`일 때만
  //   나오므로, 0을 넣은 사용자는 **적용 여부에 대한 안내를 하나도 못 본다.**
  //   ⚠ 엔진은 고치지 않는다. 0을 무효로 만들지도, 숫자 0을 undefined로 바꿔 엔진 안내를
  //     유도하지도 않는다 — 화면에서 따로 알린다. 통원 행이 없으면 이 한도 자체가 쓰이지
  //     않으므로 붙이지 않는다.
  const perVisitZero = perVisitNum !== undefined && perVisitNum !== null && perVisitNum <= 0;

  // ⚠ 게이트가 걸린 동안에는 엔진을 호출하지 않는다. 호출하면 엔진의 차단 안내가 화면으로
  //   새어 나와 내부 필드명이 노출되고 경고가 겹친다.
  //   ⚠ 화면에서 숨겨진 카운터는 넘기지 않는다 — 쓰이지 않는 축이 실리면 엔진이 막는다.
  //   ⚠ 무효값을 0이나 undefined로 바꿔 계산하지 않는다. null을 **배제**해야만 이 객체가
  //     만들어지고, 그 과정에서 두 값이 `number | undefined`로 좁혀진다. 타입 단언으로
  //     null을 숫자인 척 넘기면 게이트를 우회한 값이 그대로 엔진에 들어간다.
  const money = gated || perVisitNum === null || priorPaidNum === null ? null : {
    perVisit: perVisitNum, priorPaid: priorPaidNum,
  };
  const result = money === null ? null : calculateMany(generation, {
    plan: plan ?? undefined,
    lines,
    priorAnnualPaid: money.priorPaid,
    priorAnnualOutpatientVisits: usesVisits ? stdCount(priorVisits) ?? undefined : undefined,
    priorAnnualPrescriptions: usesPrescriptions ? stdCount(priorPrescriptions) ?? undefined : undefined,
    perVisitCoverageLimit: money.perVisit,
  });

  /**
   * 행별 안내를 모아 **같은 문구만** 중복 제거한다(G-12).
   *   ⚠ `result.lines[0]`만 보여주면 혼합 묶음에서 첫 행 종류의 안내만 나온다.
   *   ⚠ 문구로 종류를 판별하거나 걸러내지 않는다. 엔진이 만든 안내를 그대로 쓴다.
   *   ⚠ `Set`은 삽입 순서를 지키므로 행 순서 → 행 안의 순서가 그대로 유지된다.
   */
  const lineNotes = result === null || result.status !== "OK"
    ? []
    : [...new Set(result.lines.flatMap((line) => line.notes))];

  // 빠른 채우기 금액은 모든 행의 진료비를 덮어쓴다. 같은 규칙으로 판정한다.
  const quickAmountInvalid = stdAmount(quickAmount) === null;
  const quickCountNum = stdRepeatCount(quickCount);
  const quickCountInvalid = quickCountNum === null;
  const quickFill = () => {
    // ⚠ 잘못된 금액을 행에 복사하지 않는다. 복사하면 전 행이 한꺼번에 무효가 된다.
    if (quickAmountInvalid) return;
    // ⚠ 버튼 비활성만으로는 부족하다. 핸들러에서도 막는다 — 무효한 횟수로 실행되면
    //   종전처럼 **이미 입력한 행이 지워지고 1행만 남는다.**
    if (quickCountNum === null) return;
    const count = quickCountNum;
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
            {/* ⚠ `type="number"`가 아니라 원문 보존 입력이다. `type="number"`는 `1e3`·`1.5`를
                   그대로 통과시키면서 화면에는 원문을 남겨, 보이는 값과 만들어지는 행 수가
                   갈렸다. `min`·`max`도 제거한다 — 브라우저 힌트일 뿐 값을 막지 못했다. */}
            <input
              aria-label="반복 횟수"
              inputMode="numeric"
              autoComplete="off"
              className="input-base w-full"
              value={quickCount}
              onChange={(e) => setQuickCount(e.target.value)}
            />
            <button type="button" disabled={quickAmountInvalid || quickCountInvalid} className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={quickFill}>
              채우기
            </button>
          </div>
          {quickAmountInvalid && (
            <p className="mt-2 text-xs text-amber-700">
              채울 금액은 <b>0 이상의 정수</b>여야 합니다(<b>300000</b> 또는 <b>300,000</b>). 음수·소수·문자·잘못된 쉼표는
              계산기가 임의로 고치지 않습니다.
            </p>
          )}
          {/* ⚠ 경고 상자를 새로 띄우지 않는다. 이 값은 버튼을 누를 때만 쓰이므로 버튼
                 비활성과 짧은 입력 안내로 충분하다. 이미 입력한 행과 계산 결과는 그대로 둔다. */}
          {quickCountInvalid && (
            <p className="mt-2 text-xs text-slate-500">
              반복 횟수는 <b>1</b>부터 <b>{MAX_ROWS}</b>까지의 정수여야 합니다. 계산기가 임의로 1이나 {MAX_ROWS}로 바꾸지 않으며,
              이미 입력한 행은 그대로 둡니다.
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
              {/* ⚠ 맨 위젯이 아니라 원문 보존 위젯을 쓴다. `AmountInput`은 문자를 지우고
                     15자리로 자른 뒤 콤마를 붙여 표시하므로, 사용자가 넣은 값과 계산에 쓰인
                     값이 어긋나도 화면만 봐서는 알 수 없다. 콤마 자동 표시가 사라지는 것은
                     이번에 승인한 표시 변경이다 — 콤마는 직접 넣을 수 있고 파서가 형식을
                     검증한다. 공용 위젯 파일(RawAmountInput.tsx·AmountInput.tsx)은 고치지 않는다.
                     ⚠ ariaLabel을 주지 않는다. 위의 <label htmlFor>가 접근성 이름을 이미
                     제공하므로, 여기서 aria-label을 붙이면 그 라벨을 덮어쓴다. */}
              <RawAmountInput
                id="std-per-visit-limit"
                value={perVisitLimit}
                onChange={setPerVisitLimit}
                placeholder="예: 300000 — 모르면 비워두세요"
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
            <RawAmountInput
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
          {/* ⚠ 두 금액이 동시에 무효이면 두 안내를 모두 띄운다. 하나만 고쳐서는 계산이
                 재개되지 않는데 안내가 하나뿐이면 왜 막히는지 알 수 없다.
                 ⚠ 활성 입력만 안내한다 — 통원 행이 없으면 회(건)당 가입금액은 검증 대상이
                 아니므로 그 원문이 무효여도 안내하지 않는다(입원도 같다). */}
          {perVisitInvalid && (
            <NoticeBox variant="warning">
              <b>회(건)당 보험가입금액</b>을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 —{" "}
              <b>300000</b> 또는 <b>300,000</b> 형식입니다. 이 한도를 적용하지 않으려면{" "}
              <b>완전히 비워</b> 두세요. 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·
              지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다. 입력한 값을 다른 숫자로 바꾸거나
              미입력으로 지우면 실제 계약 한도와 다른 금액이 나오므로, 어느 쪽으로도 추정하지 않습니다.
            </NoticeBox>
          )}
          {priorPaidInvalid && (
            <NoticeBox variant="warning">
              계약해당일 기준 1년간 <b>이미 부담한 입원 자기부담금</b>을 올바르게 입력해 주세요.{" "}
              <b>0 이상의 정수</b>만 받습니다 — <b>300000</b> 또는 <b>300,000</b> 형식입니다. 이미 부담한
              금액이 없으면 <b>비워 두거나 0</b>을 입력하세요. 공백만 입력한 값은 빈 값으로 보지 않습니다.
              음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다. 이 값은 연간 200만 원
              자기부담 상한에서 <b>이미 소진한 금액</b>이라, 다른 숫자로 바뀌면 남은 상한이 실제와 달라집니다.
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
              {/* ⚠ 엔진의 "입력하지 않으면 적용하지 않습니다" 안내는 값이 undefined일 때만
                     나온다. 명시적 0은 엔진에서 한도 미적용이지만 그 안내가 뜨지 않아,
                     화면에서 따로 알린다. 엔진·0의 계산 정책은 그대로다. */}
              {perVisitZero && (
                <NoticeBox variant="info">
                  <b>회(건)당 보험가입금액</b>에 <b>0</b>을 입력해 현재 계산에는 해당 한도를 적용하지
                  않았습니다. 실제 가입금액은 증권에서 확인해 주세요.
                </NoticeBox>
              )}
              {/* ⚠ 종전에는 `result.lines[0]`의 안내만 보여줬다. 그러면 혼합 묶음에서 **첫 행의
                     종류에 따라** 통원 공제 설명만 보이거나 입원 상한 설명만 보였다
                     (`[외래, 입원]`이면 통원용, `[입원, 외래]`면 입원용).
                     모든 행의 안내를 모으고 **같은 문구만** 중복 제거한다.
                     ⚠ 문구 내용으로 통원·입원을 판별하거나 걸러내지 않는다 — 엔진이 만든
                     안내를 그대로 쓰고, 순서도 행 순서를 따른다. */}
              {lineNotes.length > 0 && (
                <NoticeBox variant="info">{lineNotes.join(" ")}</NoticeBox>
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
