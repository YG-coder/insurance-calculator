"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import RawAmountInput from "@/components/RawAmountInput";
import ResultCard from "@/components/ResultCard";
import {
  calculateMany2021, GEN2021_MSK_APPROVED_THROUGH_VALUES,
} from "@/lib/insurance/engine/multiClaim2021";
import {
  Cause, Coverage, Gen2021MskApprovedThrough, Gen2021MultiGeneralBenefitInput,
  Gen2021MultiGeneralNonBenefitInpatientInput,
  Gen2021MultiGeneralNonBenefitOutpatientInput, Gen2021MultiRiderInjectionInput,
  Gen2021MultiRiderManualInput, Gen2021MultiRiderMriInput, Gen2021Rider, Tier, Visit,
} from "@/lib/insurance/engine/types";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { GEN2021 } from "@/lib/insurance/engine/constants";

// ⚠ 종전 공용 정제 `digits()`(= `Number(v.replace(/[^0-9]/g, "")) || 0`)는 이 커밋에서
//   마지막 사용처(복제 횟수)가 사라져 **삭제했다.** 아래 주석들이 이 이름을 언급하는 것은
//   "그 관용 정제를 쓰면 안 된다"는 근거를 남기기 위해서다.
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 누적 금액이 이어지는 **보장축**. 별표15 2021.7.1 판본 직독 결과다.
 *
 * - 일반 4축 — 기본형 제5조①은 "(1)상해급여에 대하여 입원과 통원의 보상금액을 합산하여
 *   5천만원 이내에서, (2)질병급여에 대하여 … 5천만원 이내에서" 계약자가 고른 금액을
 *   연간 보험가입금액으로 정한다(인쇄 p.209). 비급여 특별약관 제5조①이 상해비급여·
 *   질병비급여에 대해 같은 구조를 둔다(p.264). 그래서 **원인 × 급여 구분 4축**이고,
 *   **같은 축 안에서 입원과 통원은 합산**한다 — visit은 축을 가르지 않는다.
 * - 특약 3축 — <표1>은 세 항목 각각 "각 상해·질병 치료행위를 합산하여 350만원/250만원/
 *   300만원 이내"로 정하고(p.252), 제5조③이 "(3)3대비급여의 경우 각 비급여의료비별
 *   보상한도로 한다"고 정한다(p.264). 그래서 **항목별 3축**이고, **상해·질병은 합산**한다
 *   — cause는 축을 가르지 않는다. 3대비급여는 비급여 전용이라 coverage도 가르지 않는다.
 *
 * ⚠ 축 키가 coverage를 쓰지 않는다고 해서 화면의 coverage 상태를 건드리지 않는다.
 *   특약 선택 시 급여 선택창이 비활성화되는 기존 동작과 엔진 계약은 그대로다.
 */
type Gen2021GeneralAxis = `${Cause}_${Coverage}`;
type Gen2021RiderAxis = Exclude<Gen2021Rider, "none">;
type Gen2021PaidAxis = Gen2021GeneralAxis | Gen2021RiderAxis;
const GEN2021_GENERAL_AXES: readonly Gen2021GeneralAxis[] = [
  "injury_benefit", "injury_non_benefit", "disease_benefit", "disease_non_benefit",
];
const GEN2021_RIDER_AXES: readonly Gen2021RiderAxis[] = ["manual_therapy", "injection", "mri"];
const GEN2021_PAID_AXES: readonly Gen2021PaidAxis[] = [...GEN2021_GENERAL_AXES, ...GEN2021_RIDER_AXES];
/** 화면 라벨용 축 이름. 어느 한도의 누적인지 사용자가 알 수 있어야 한다. */
const GEN2021_GENERAL_AXIS_LABEL: Record<Gen2021GeneralAxis, string> = {
  injury_benefit: "상해·급여", injury_non_benefit: "상해·비급여",
  disease_benefit: "질병·급여", disease_non_benefit: "질병·비급여",
};
const GEN2021_RIDER_AXIS_LABEL: Record<Gen2021RiderAxis, string> = {
  manual_therapy: "도수·체외충격파·증식치료", injection: "비급여 주사료", mri: "비급여 MRI·MRA",
};

/**
 * 4세대 **진료비** 문자열 파서. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `digits()`를 쓰면 안 된다. 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**15**(점을 지워 10배), `1e3`→**13**,
 *   `1,0`→**10**이 되고, 빈 값·`abc`·`NaN`·`Infinity`가 전부 **0원**으로 합쳐진다.
 *   ⚠ 4세대 다회는 행 입력이 맨 `<input>`이라 **화면에는 원문이 그대로 남는다**.
 *     `-1`을 넣으면 화면은 `-1`인데 결과표는 `1원`으로 계산됐다. 화면과 계산이 어긋난다.
 *   ⚠ 0원 행은 비급여 통원 연 100회와 특약 연 50회를 1회 소진하고, 도수 승인 구간의
 *     회차 계산(`amounts.length`)에도 들어간다. 빈 행 하나가 다른 행의 보상 여부를 바꾸고
 *     승인 부족 차단까지 일으킨다.
 * ⚠ 입력 위젯도 함께 바꿔야 한다. 파서만 엄격하게 하면 늦는다(RawAmountInput 참조).
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ 2·3·5세대 파서를 재사용하지 않는다. 형식 규칙이 같아도 세대·라벨·안내가 다르다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `100000`) 또는 정확한 천 단위 구분
 *   (`100,000`, `1,234,567`). **명시적으로 입력한 `0`은 유효값**이다.
 * 무효(null = 미입력·잘못된 입력): 빈 값·공백, 부호(`-`/`+`), 문자, `NaN`·`Infinity`,
 *   소수(`1.5`·`1.`·`.5`), 지수 표기(`1e3`), 잘못된 쉼표(`1,0`·`1,00,000`·`,300`),
 *   안전 정수 범위(2^53−1) 초과.
 */
const GEN2021_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const gen2021Amount = (v: string): number | null => {
  if (!GEN2021_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

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

/** 복제 버튼이 한 번에 만들 수 있는 최대 행 수(4세대 화면의 종전 상한). */
const GEN2021_MAX_COPIES = 100;
/**
 * 복제 **횟수** 전용 파서(4세대). 이 값은 "만들 행 수"일 뿐이고 보험 횟수·한도·소진
 * 상태와 아무 관계가 없다 — `gen2021Count`(통원·특약 횟수)와 **재사용하지 않는다.**
 * 허용 범위도 다르다(여기는 1 이상 상한 이하, 저기는 0 이상 무제한).
 *
 * ⚠ 공용 `digits()`를 쓰면 안 된다. 실측: `1.5`→**15행**(점을 지운다), `1e3`→**13행**,
 *   `1,0`→**10행**, `20만`→**20행**, `abc`·빈 값·공백·`0`→**1행**. 종전에는 무효값에서도
 *   복제가 실행돼 **이미 입력한 행을 전부 지우고 1행으로 만들었다**(4행 → 1행을 실측).
 * ⚠ 상한을 넘는 값을 상한으로 **깎지 않는다.**
 * ⚠ 5세대·2·3세대 파서를 재사용하지 않는다. 상한과 라벨·안내가 화면마다 다르다.
 *
 * 유효: 1 이상 GEN2021_MAX_COPIES 이하의 안전 정수.
 * 무효(null): 빈 값·공백·`0`·상한 초과·부호·소수·지수 표기·쉼표·문자·안전 정수 초과.
 */
const GEN2021_COPY_FORMAT = /^[0-9]+$/;
const gen2021CopyCount = (v: string): number | null => {
  if (!GEN2021_COPY_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 && n <= GEN2021_MAX_COPIES ? n : null;
};

/**
 * 4세대 다회의 **금액 입력** 문자열 파서 — 증권상 연간 가입금액과 누적기간 내 기존
 * 지급보험금 두 곳에 쓴다. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `digits()`를 쓰면 안 된다. 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**15**(점을 지워 10배), `1e3`→**13**,
 *   `20만`→**20**, `1,0`→**10**이 되고, `abc`·`NaN`·`Infinity`가 전부 **0**으로 합쳐진다.
 *   두 입력 모두 맨 `<input>`이라 화면에는 원문이 그대로 남아 화면과 계산이 어긋났다.
 * ⚠ 잘못된 입력의 결과 방향은 **입력별로 고정되지 않는다**. 필드와 값에 따라 다르다.
 *   - 가입금액 `abc`·`   `(공백만) → 한도 **미적용**. 실제 가입금액보다 **많이** 나올 수 있다.
 *   - 가입금액 `-1`·`1.5`·`1e3`·`20만`·`1,0` → 1·15·13·20·10원. **적게** 나온다.
 *   - 지급보험금 `-1`·`1.5`·`abc`·`1,0` → 과거 사용액이 줄어 **많이** 나온다.
 *   - 지급보험금 안전 정수 초과 → 반올림된 큰 값이 들어가 **0원**이 될 수 있다.
 *   그래서 "한쪽은 과소, 다른 쪽은 과다"로 일반화하지 않는다. 어느 쪽이든 임의로 고치지 않는다.
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ 공백을 `trim()`으로 정리해 통과시키지 않는다. 화면에 남은 원문과 계산에 쓰인 값이
 *   달라진다. 공백만 있는 입력과 앞뒤 공백이 붙은 입력은 무효로 본다.
 * ⚠ 진료비 파서(`gen2021Amount`)와 형식 규칙이 같아도 재사용하지 않는다. 라벨·안내·
 *   무효 시 차단 범위가 다르고, 한쪽 규칙이 바뀔 때 다른 쪽이 말없이 따라가면 안 된다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `00`, `50000000`) 또는 정확한 천 단위 구분
 *   (`50,000,000`). **명시적으로 입력한 `0`·`00`은 유효값**이다(기존 처리 유지).
 *   안전 정수 최대값(2^53−1)까지 받는다 — 약관상 상한·잔여액 처리는 엔진이 그대로 한다.
 * 무효(null): 공백만·앞뒤 공백·부호(`-`/`+`)·문자·소수·지수 표기·잘못된 쉼표
 *   (`1,0`·`1,00,000`·`,300`)·안전 정수 초과. **안전 정수 초과 차단은 이번 변경이다** —
 *   종전에는 `9007199254740993`이 `9007199254740992`로 반올림돼 조용히 계산됐다.
 *   빈 문자열 `""`은 파서가 아니라 **호출부**에서 기존 선택 입력으로 처리한다
 *   (가입금액 → 한도 미적용, 지급보험금 → 0원). 파서에 넣으면 무효다.
 */
const GEN2021_MONEY_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const gen2021Money = (v: string): number | null => {
  if (!GEN2021_MONEY_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

export default function HealthCalcMulti2021() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  const [cause, setCause] = useState<Cause>("disease");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  const [tier, setTier] = useState<Tier>("clinic");
  const [rider, setRider] = useState<Gen2021Rider>("none");
  // ⚠ 누적 금액 상태는 **보장축마다** 따로 둔다. 하나를 공유하면 축을 바꿀 때 값이
  //   말없이 다른 한도로 넘어간다 — 도수(연 350만)에 넣은 지급보험금이 MRI(연 300만)
  //   한도에 그대로 적용돼 보험금이 0원이 되는 것을 프로덕션에서 재현했다.
  //   축 구성은 별표15 2021.7.1 판본 직독 결과다(설계 문서 §4의 G-5 절 참조).
  const [priorPaidByAxis, setPriorPaidByAxis] = useState<Record<Gen2021PaidAxis, string>>(
    () => Object.fromEntries(GEN2021_PAID_AXES.map((k) => [k, "0"])) as Record<Gen2021PaidAxis, string>,
  );
  //   연간 보험가입금액은 일반 4축에만 있다(3대비급여의 가입금액은 <표1>의 항목별
  //   연간 보상한도로 정해져 계약자가 고르지 않는다 — 특별약관 제5조①단서).
  const [annualLimitByAxis, setAnnualLimitByAxis] = useState<Record<Gen2021GeneralAxis, string>>(
    () => Object.fromEntries(GEN2021_GENERAL_AXES.map((k) => [k, ""])) as Record<Gen2021GeneralAxis, string>,
  );
  // ⚠ 세 축의 상태를 분리한다. 하나를 라벨만 바꿔 재사용하면 항목을 바꿀 때 값이
  //   다른 한도(100회 ↔ 50회)로 말없이 넘어간다. MRI는 횟수 한도가 없어 상태가 없다.
  //   ⚠ 빈 값으로 시작한다. 기본값 "0"은 사용자가 확인하지 않은 "기존 사용 없음"을
  //     화면이 대신 만들어 내는 것이라 한도가 통째로 사라진다. 0은 직접 입력해야 한다.
  const [priorOutVisits, setPriorOutVisits] = useState("");
  // ⚠ 미선택("")은 "모른다"가 아니라 약관이 조건 없이 보장하는 **최초 기본 보장 구간**을
  //   뜻한다. 그래서 다른 축과 달리 미선택을 차단하지 않는다(엔진과 같은 규칙).
  const [approvedThrough, setApprovedThrough] = useState<"" | Gen2021MskApprovedThrough>("");
  const [priorManualVisits, setPriorManualVisits] = useState("");
  const [priorInjectionVisits, setPriorInjectionVisits] = useState("");
  const [copyCount, setCopyCount] = useState("3");
  const [submitted, setSubmitted] = useState(false);

  const isRider = rider !== "none";
  // ── 활성 보장축 ─────────────────────────────────────────────────────
  //   일반은 원인 × 급여 구분, 특약은 항목이 축을 정한다. visit은 어느 쪽도 가르지 않는다.
  const generalAxis: Gen2021GeneralAxis = `${cause}_${coverage}`;
  const paidAxis: Gen2021PaidAxis = isRider ? (rider as Gen2021RiderAxis) : generalAxis;
  //   화면·엔진 모두 **활성 축의 값만** 본다. 다른 축 값은 상태에 남아 있을 뿐 전달되지 않는다.
  const priorPaid = priorPaidByAxis[paidAxis];
  const annualLimit = annualLimitByAxis[generalAxis];
  const setPriorPaid = (v: string) => setPriorPaidByAxis((old) => ({ ...old, [paidAxis]: v }));
  const setAnnualLimit = (v: string) => setAnnualLimitByAxis((old) => ({ ...old, [generalAxis]: v }));
  //   라벨·접근성 이름에 쓰는 활성 축 이름. rider를 좁혀서 만든다 — 단언을 쓰지 않는다.
  const paidAxisLabel = rider === "none"
    ? `${GEN2021_GENERAL_AXIS_LABEL[generalAxis]} 보장축`
    : GEN2021_RIDER_AXIS_LABEL[rider];
  // 어느 축이 쓰이는지는 rider·coverage·visit이 함께 정한다. 엔진과 같은 규칙이다.
  const usesOutVisits = !isRider && coverage === "non_benefit" && visit === "outpatient";
  const usesRiderVisits = rider === "manual_therapy" || rider === "injection";
  const riderVisitsText = rider === "manual_therapy" ? priorManualVisits
    : rider === "injection" ? priorInjectionVisits : "";
  //   한도가 걸린 축은 과거 사용량 없이는 계산할 수 없다. 빈 값을 0으로 추정하지 않는다.
  const needsOutVisits = usesOutVisits && gen2021Count(priorOutVisits) === null;
  const needsRiderVisits = usesRiderVisits && gen2021Count(riderVisitsText) === null;
  // 진료비는 미입력과 잘못된 입력을 0원으로 바꾸지 않는다 — 명시적 0만 유효값이다.
  //   ⚠ 한 행만 어긋나도 묶음 전체를 계산하지 않는다. 그 행을 0원으로 계산하면 연간
  //     횟수를 1회 소진해 **다른 행의 보상 여부**를 바꾸고, 도수 승인 구간에서는
  //     회차가 밀려 승인 부족 차단까지 일으킨다. 행 단위로 넘어갈 수 없다.
  //   ⚠ 부분합을 결과로 내보내지 않는다. 유효한 행만 더한 값은 실제 총 진료비가 아니다.
  const badAmountRows = amounts
    .map((a, i) => (gen2021Amount(a) === null ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const needsAmounts = badAmountRows.length > 0;
  // 금액 입력 두 곳도 **활성 축 기준으로만** 판정한다. 숫자 변환은 여기서 한 번만 한다.
  //   ⚠ 특약에서는 일반 가입금액을 아예 읽지 않는다(undefined). 화면에 없는 다른 축의
  //     무효값이 지금 계산을 막으면 안 된다. 무효 축으로 돌아오면 원문과 안내가 살아난다.
  //   ⚠ 빈 문자열만 기존 선택 입력으로 본다 — 가입금액은 한도 미적용, 지급보험금은 0원.
  //     이는 종전 계산기 계약을 그대로 보존하는 선택이지, 미입력을 0으로 보는 것이
  //     정확하거나 안전하다고 이번에 확인한 것이 아니다. 공백만 있는 입력은 무효다.
  const annualLimitNum = isRider || annualLimit === "" ? undefined : gen2021Money(annualLimit);
  const priorPaidNum = priorPaid === "" ? 0 : gen2021Money(priorPaid);
  const limitInvalid = annualLimitNum === null;
  const paidInvalid = priorPaidNum === null;
  const gated = needsOutVisits || needsRiderVisits || needsAmounts || limitInvalid || paidInvalid;
  // 복제 원본은 **첫 행 진료비**다(별도 금액 칸이 없다). 원본만 판정한다 —
  //   다른 행이 무효여도 복제는 그 행들을 어차피 전부 대체하므로 막지 않는다.
  //   ⚠ 명시적 0은 유효값이라 복제할 수 있다.
  const copySourceInvalid = gen2021Amount(amounts[0] ?? "") === null;
  const copyCountNum = gen2021CopyCount(copyCount);
  const copyCountInvalid = copyCountNum === null;

  // ⚠ 축은 분기마다 자기 것만 싣는다. 스프레드로 공통에 두면 쓰이지 않는 경로에도
  //   같은 필드가 따라 들어가고, 초과 필드는 타입 검사에서 드러나지 않는다.
  // ⚠ 진료비를 여기서 0으로 만들지 않는다. 무효 행이 있으면 아래에서 엔진 호출 자체를
  //   막으므로, 이 map은 게이트를 통과한 뒤에만 쓰인다.
  //   ⚠ 무효값을 0이나 undefined로 바꿔 계산하지 않는다. null을 **배제**해야만 이 객체가
  //     만들어지고, 그 과정에서 타입이 number / number|undefined로 좁혀진다. 타입 단언으로
  //     null을 숫자인 척 넘기면 게이트를 우회한 값이 그대로 엔진에 들어간다.
  const money = gated || priorPaidNum === null || annualLimitNum === null ? null : {
    priorPaid: priorPaidNum, annualLimit: annualLimitNum,
  };
  // ⚠ 금액 축은 `common`에 넣지 않는다(G-30). 스프레드로 실으면 축이 다른 분기에도 같은
  //   필드가 따라 들어간다 — 종전에는 `priorAnnualRiderPaid: isRider ? … : undefined`가
  //   일반 세 분기에도 실려, 타입이 막지 못하고 엔진이 조용히 폐기했다. 각 분기에서 쓰는
  //   쪽만 실어 보낸다(5세대 화면이 통원 카운터에 쓰는 방식과 같다).
  // ⚠ `tier`는 공통 객체에서 뺐다(G-34B). 종별이 최소공제를 가르는 것은 **급여 통원**뿐이고,
  //   비급여·입원·특약 경로에서는 엔진이 읽지 않는다. 종전에는 공통 객체를 여섯 분기에
  //   스프레드해 모든 경로에 실어 보냈고, 쓰지 않는 경로에서는 **읽고 무시**됐다 —
  //   화면이 고른 종별이 반영된 것처럼 보였다. 공통 객체가 값을 싣는다는 사실은
  //   허용 근거가 아니므로, 런타임 거부와 함께 화면의 전달도 바로잡는다.
  //   ⚠ 상태(`tier`)와 선택 UI는 그대로 둔다. 경로를 오가도 선택이 보존되고, 급여 통원으로
  //     돌아오면 같은 값이 다시 전달된다. **비활성 경로에만 싣지 않는다.**
  const common = money === null ? null : {
    cause, visit, amounts: amounts.map((a) => gen2021Amount(a) as number),
  };
  /** 급여 통원에서만 종별을 싣는다 — 엔진의 소비 분기와 같은 모양이다. */
  const tierForPath = coverage === "benefit" && visit === "outpatient" ? tier : undefined;
  // ⚠ 게이트가 걸린 동안에는 엔진을 호출하지 않는다. 무효 행을 넘기면 엔진의
  //   normalizeAmount가 조용히 0원으로 바꿔 계산해 버린다.
  const result = money === null || common === null ? null : rider === "manual_therapy"
    ? calculateMany2021({
        ...common, tier: tierForPath, rider: "manual_therapy", coverage,
        priorAnnualRiderPaid: money.priorPaid,
        priorAnnualRiderVisits: gen2021Count(riderVisitsText) ?? undefined,
        // ⚠ 미선택이면 필드를 싣지 않는다. 화면이 10을 만들어 보내면 "보험사가 승인한
        //   10회"와 "기본 보장 구간"이 결과에서 구분되지 않는다.
        approvedThroughVisit: approvedThrough === "" ? undefined : approvedThrough,
      } satisfies Gen2021MultiRiderManualInput)
    : rider === "injection"
    ? calculateMany2021({
        ...common, tier: tierForPath, rider: "injection", coverage,
        priorAnnualRiderPaid: money.priorPaid,
        priorAnnualRiderVisits: gen2021Count(riderVisitsText) ?? undefined,
        // ⚠ 승인 축은 주사료에 없다. 화면에서 숨겨진 값을 넘기지 않는다.
      } satisfies Gen2021MultiRiderInjectionInput)
    : rider === "mri"
      ? calculateMany2021({
        ...common, tier: tierForPath, rider: "mri", coverage, priorAnnualRiderPaid: money.priorPaid,
      } satisfies Gen2021MultiRiderMriInput)
      : coverage === "benefit"
        ? calculateMany2021({
            ...common, tier: tierForPath, rider: "none", coverage: "benefit",
            annualCoverageLimit: money.annualLimit,
            priorAnnualInsurancePaid: money.priorPaid,
          } satisfies Gen2021MultiGeneralBenefitInput)
        : visit === "inpatient"
          ? calculateMany2021({
              ...common, tier: tierForPath, rider: "none", coverage: "non_benefit", visit: "inpatient",
              annualCoverageLimit: money.annualLimit,
              priorAnnualInsurancePaid: money.priorPaid,
            } satisfies Gen2021MultiGeneralNonBenefitInpatientInput)
          : calculateMany2021({
              ...common, tier: tierForPath, rider: "none", coverage: "non_benefit", visit: "outpatient",
              annualCoverageLimit: money.annualLimit,
              priorAnnualInsurancePaid: money.priorPaid,
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
              <div className="mt-1">
                <RawAmountInput id={`gen2021-amount-${i}`} value={amount}
                  onChange={(v) => setLine(i, v)} placeholder="예: 100,000"
                  ariaLabel={`${i + 1}건 진료비`} />
              </div>
            </label>
            <button type="button" className={smallButton} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))} disabled={amounts.length === 1}>삭제</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button>
          <input className="input-base w-20" inputMode="numeric" autoComplete="off" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" />
          <button type="button" className={smallButton} disabled={copySourceInvalid || copyCountInvalid} onClick={() => {
            // ⚠ 버튼 비활성만으로는 부족하다. 핸들러에서도 막는다 — 무효한 첫 행을
            //   전 행에 복제하면 한 번에 모든 행이 무효가 된다.
            if (copySourceInvalid) return;
            // ⚠ 무효한 횟수로 실행되면 종전처럼 **이미 입력한 행이 지워지고 1행만 남는다.**
            if (copyCountNum === null) return;
            setAmounts(Array.from({ length: copyCountNum }, () => amounts[0] ?? ""));
          }}>첫 금액 × N회</button>
        </div>
        {copySourceInvalid && <p className="mt-2 text-xs text-amber-700">
          복제할 <b>1건 진료비</b>가 <b>0 이상의 정수</b>여야 합니다(<b>100000</b> 또는 <b>100,000</b>).
          음수·소수·문자·잘못된 쉼표는 계산기가 임의로 고치지 않습니다.
        </p>}
        {/* ⚠ 경고 상자를 새로 띄우지 않는다. 버튼 비활성과 짧은 입력 안내로 충분하고,
               이미 입력한 행과 계산 결과는 그대로 둔다. */}
        {copyCountInvalid && <p className="mt-2 text-xs text-slate-500">
          복사할 횟수는 <b>1</b>부터 <b>{GEN2021_MAX_COPIES}</b>까지의 정수여야 합니다. 계산기가 임의로 1이나 {GEN2021_MAX_COPIES}로
          바꾸지 않으며, 이미 입력한 행은 그대로 둡니다.
        </p>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {!isRider && <label className="text-sm font-semibold">증권상 연간 가입금액 ({GEN2021_GENERAL_AXIS_LABEL[generalAxis]} 보장축)
          {/* ⚠ 맨 <input>이 아니라 원문 보존 위젯을 쓴다. 두 금액 입력은 id로 구분하고,
                 접근성 이름에 현재 보장축을 넣는다 — 어느 한도의 값인지 소리로만 들어도
                 구분돼야 한다. 시각적 라벨과의 연결은 감싸는 <label>이 그대로 유지한다.
                 공용 위젯 파일(RawAmountInput.tsx)은 고치지 않는다. */}
          <div className="mt-1">
            <RawAmountInput id="gen2021-annual-limit" value={annualLimit}
              onChange={setAnnualLimit} placeholder="예: 50,000,000"
              ariaLabel={`증권상 연간 가입금액 (${GEN2021_GENERAL_AXIS_LABEL[generalAxis]} 보장축)`} />
          </div>
          <span className="mt-1 block text-xs font-normal text-slate-500">약관상 최대 5천만 원이며 <b>{GEN2021_GENERAL_AXIS_LABEL[generalAxis]} 보장축</b>에 대해 따로 정해집니다(기본형·특별약관 제5조 제1항). 입원과 통원은 이 축 안에서 합산합니다. 완전히 비우거나 0원을 입력하면 계산기에서는 이 한도를 적용하지 않습니다. 0원을 입력한 경우 그 사실을 결과 안내에 따로 표시합니다.</span>
        </label>}
        <label className="text-sm font-semibold">누적기간 내 기존 지급보험금 ({paidAxisLabel})
          <div className="mt-1">
            <RawAmountInput id="gen2021-prior-paid" value={priorPaid}
              onChange={setPriorPaid} placeholder="기존 지급이 없으면 0"
              ariaLabel={`누적기간 내 기존 지급보험금 (${paidAxisLabel})`} />
          </div>
          <span className="mt-1 block text-xs font-normal text-slate-500">{isRider
            ? <>이 항목의 연간 보상한도에 이미 지급된 보험금입니다. 약관은 <b>각 상해·질병 치료행위를 합산</b>해 항목별로 한도를 적용하므로(특별약관 제3조(3) &lt;표1&gt;·제5조 제3항), 원인을 나누지 않고 <b>{GEN2021_RIDER_AXIS_LABEL[rider as Gen2021RiderAxis]}</b> 한 축으로 누적합니다.</>
            : <><b>{GEN2021_GENERAL_AXIS_LABEL[generalAxis]} 보장축</b>에 이미 지급된 보험금입니다. 다른 원인·급여 구분의 지급액은 이 축에 누적되지 않으며, 입원과 통원은 이 축 안에서 합산합니다.</>}</span>
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
        {rider === "manual_therapy" && <label className="text-sm font-semibold">보상 승인 회차 (보험사에서 확인한 경우)
          <select className="input-base mt-1" value={approvedThrough}
            onChange={(e) => setApprovedThrough(e.target.value === "" ? "" : Number(e.target.value) as Gen2021MskApprovedThrough)}>
            <option value="">선택 안 함 — 최초 {GEN2021.rider.mskApproval.initialApproved}회 기본 보장 구간까지만 적용</option>
            {GEN2021_MSK_APPROVED_THROUGH_VALUES.map((v) => <option key={v} value={v}>{v}회까지 승인 확인됨</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">선택하지 않으면 약관이 <b>조건 없이 보장하는 최초 {GEN2021.rider.mskApproval.initialApproved}회</b>까지만 적용합니다. 이는 보험사가 승인한 회차가 아니라 <b>기본 보장 구간</b>이며, 면책사항 등 다른 보장 조건까지 충족한다는 뜻은 아닙니다.</span>
        </label>}
        {rider === "injection" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 받은 비급여 주사 횟수
          <input className="input-base mt-1" inputMode="numeric" placeholder="받은 치료가 없으면 0"
            value={priorInjectionVisits} onChange={(e) => setPriorInjectionVisits(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-slate-500">비급여 주사료는 <b>입원과 통원을 합산해 연 {GEN2021.rider.injection.annualVisits}회</b>가 한도입니다. 도수치료 등과는 별개 한도입니다.</span>
        </label>}
      </div>

      {rider === "manual_therapy" && <div className="mt-4"><NoticeBox variant="info">도수치료·체외충격파치료·증식치료는 각 치료횟수를 합산해 <b>최초 {GEN2021.rider.mskApproval.initialApproved}회</b>를 보장하고, 이후에는 증상의 개선·병변 호전 등이 확인된 경우에 한하여 <b>{GEN2021.rider.mskApproval.step}회 단위</b>로 연간 {GEN2021.rider.manual_therapy.annualVisits}회까지 보상합니다(실손의료보험 특별약관 제3조 (3)3대비급여 제1항 &lt;표1&gt; 주)). 이 계산기는 증상 개선 여부를 판정하지 않습니다.</NoticeBox></div>}
      {rider === "mri" && <div className="mt-4"><NoticeBox variant="info">비급여 MRI·MRA는 약관상 <b>금액 한도만</b> 있고 연간 횟수 한도가 없습니다. 그래서 이미 받은 횟수를 묻지 않습니다.</NoticeBox></div>}

      <button type="button" className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>

      {submitted && needsOutVisits && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 사용한 비급여 통원 횟수</b>를 입력해 주세요. 이전 통원이 없으면 <b>0</b>을 입력하세요. 비급여 통원은 연 {GEN2021.nonBenefitOutpatientAnnualVisits}회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}
      {submitted && needsRiderVisits && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 받은 치료 횟수</b>를 입력해 주세요. 받은 치료가 없으면 <b>0</b>을 입력하세요. 이 특약은 연 {rider === "manual_therapy" ? GEN2021.rider.manual_therapy.annualVisits : GEN2021.rider.injection.annualVisits}회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}
      {submitted && needsAmounts && <div className="mt-5"><NoticeBox variant="warning">{badAmountRows.join(", ")}번째 행의 <b>진료비</b>를 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>100000</b> 또는 <b>100,000</b> 형식입니다. 진료비가 실제로 0원이면 <b>0</b>을 입력하세요. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않으며, 빈 값을 0원으로 보지도 않습니다. 0원으로 보면 그 행이 연간 횟수를 1회 소진해 <b>다른 행의 보상 여부</b>가 바뀌고, 도수치료 등에서는 <b>보상 승인 회차</b>까지 밀립니다. 그래서 한 행만 어긋나도 계산하지 않습니다.</NoticeBox></div>}

      {/* ⚠ 두 금액이 동시에 무효이면 두 안내를 모두 띄운다. 하나만 고쳐서는 계산이
             재개되지 않는데 안내가 하나뿐이면 왜 막히는지 알 수 없다. */}
      {submitted && limitInvalid && <div className="mt-5"><NoticeBox variant="warning"><b>증권상 연간 가입금액</b>({GEN2021_GENERAL_AXIS_LABEL[generalAxis]} 보장축)을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>50000000</b> 또는 <b>50,000,000</b> 형식입니다. <b>완전히 비우거나 0원을 입력하면</b> 계산기에서는 이 한도를 적용하지 않습니다. 0원을 입력한 경우 그 사실을 결과 안내에 따로 표시합니다. 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다. 잘못된 값을 한도 미적용으로 넘기면 실제 가입금액보다 <b>많은 금액</b>이, 다른 숫자로 바뀌어 넘어가면 <b>적은 금액</b>이 산출될 수 있어 어느 쪽으로도 추정하지 않습니다.</NoticeBox></div>}
      {submitted && paidInvalid && <div className="mt-5"><NoticeBox variant="warning"><b>누적기간 내 기존 지급보험금</b>({paidAxisLabel})을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>3000000</b> 또는 <b>3,000,000</b> 형식입니다. 이 축에 이미 지급된 보험금이 없으면 <b>0</b>을 입력하세요. 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다. 잘못된 값이 <b>0</b>으로 바뀌면 남은 한도가 실제보다 커져 보험금이 <b>많이</b> 산출됩니다.</NoticeBox></div>}

      {/* ⚠ 엔진이 막았으면 후보 금액을 그리지 않는다. 종전 조건은 totalAmount만 봐서
             차단 결과의 null 합계가 "0원"으로 렌더될 수 있었다. */}
      {submitted && result !== null && result.status === "PENDING_UNVERIFIED" && <div className="mt-5">
        {result.notes.map((note) => <div className="mt-3 first:mt-0" key={note}><NoticeBox variant="warning">{note}</NoticeBox></div>)}
      </div>}

      {submitted && result !== null && result.status === "OK" && result.totalAmount > 0 && <div className="mt-7">
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
