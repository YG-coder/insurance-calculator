"use client";

import { useState } from "react";
import NoticeBox from "@/components/NoticeBox";
import RawAmountInput from "@/components/RawAmountInput";
import ResultCard from "@/components/ResultCard";
import { calculateMany2026 } from "@/lib/insurance/engine/multiClaim2026";
import {
  GEN2026_INJECTION_PURPOSE_LABEL, GEN2026_MSK_APPROVED_THROUGH_VALUES,
  GEN2026_SPECIAL_ITEM_LABEL, calculateGen2026Item, routeOfGen2026Item,
} from "@/lib/insurance/engine/specialItem2026";
import { CAP_LABELS } from "@/lib/insurance/engine/capLabels";
import { GEN2026 } from "@/lib/insurance/engine/constants";
import {
  Cause, Coverage, Gen2026CriticalExceptionalInjectionInput, Gen2026CriticalMriLine,
  Gen2026InjectionPurpose, Gen2026ItemClaimResult, Gen2026NonCriticalInjectionInput,
  Gen2026NonCriticalMskInput,
  Gen2026MskApprovedThrough, Gen2026NonBenefitItem, Gen2026SpecialItem, Gen2026SpecialLine,
  Severity, Tier, Visit,
} from "@/lib/insurance/engine/types";
import { GEN2026_NON_BENEFIT_ITEM_LABEL } from "@/lib/insurance/engine/generation2026";

// ⚠ 기본 선택 없음. 단건 계산기와 같은 정책이다.
const NON_BENEFIT_ITEMS: Gen2026NonBenefitItem[] = [
  "general", "musculoskeletal_esw", "injection", "mri", "room_charge",
];
const INJECTION_PURPOSES: Gen2026InjectionPurpose[] = ["general", "anticancer", "antibiotic", "orphan_drug"];

const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;
const smallButton = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 disabled:opacity-40";

/** 특별약관 입력 행. 1행 = 약관상 공제 적용 단위 1개. */
interface SpecialRow { amount: string; visit: Visit | ""; tier: Tier | "" }
const emptyRow = (): SpecialRow => ({ amount: "", visit: "", tier: "" });

/** 상급병실료 차액 입력 행. 1행 = 약관상 1회의 입원. */
interface RoomChargeRow { amount: string; days: string }
/** 총 입원일수는 약관에 산정 방법이 없다. 양의 정수만 받고 추정하지 않는다. */
const positiveDays = (v: string): number | null => {
  const t = v.trim();
  return /^[0-9]+$/.test(t) && Number(t) > 0 ? Number(t) : null;
};
/**
 * 상급병실료 차액 금액 전용 파서. **원문 문자열을 형식으로 먼저 판정한다.**
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. `num()`은 숫자가 아닌 문자를 **지우고** 실패를 0으로 바꾸므로
 *   `-100` → `100`, `abc`·빈 값·`1.2.3`·`Infinity` → `0`이 되어, 엔진의 엄격한 런타임 검증에
 *   닿기 전에 UI가 없는 값을 만들어 낸다. 이 경로는 "NaN을 조용히 0으로 계산하지 않는다"가
 *   구현 원칙이므로 문자열을 **변형하지 않고 그대로 판정**한다.
 *
 * ⚠ 쉼표를 먼저 지우고 검사해도 같은 종류의 변형이 된다 — `1,2`→12, `1,,000`→1000,
 *   `,100`·`100,`→100, `12,34,567`→1234567처럼 잘못된 입력이 정상 금액이 되어 버린다.
 *   그래서 **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `100`, `1000`) 또는 정확한 천 단위 구분
 *   (`1,000`, `12,345`, `1,234,567`). **명시적으로 입력한 `0`은 유효값**이다.
 * 무효(null = 불완전 입력): 빈 값·공백, 부호(`-`/`+`), 문자, `Infinity`·`NaN`,
 *   소수(`1.5`·`.5`·`1.`— 원 단위라 허용하지 않는다), 지수 표기(`1e6`),
 *   잘못된 쉼표 형식, 안전 정수 범위(2^53−1) 초과.
 */
const ROOM_CHARGE_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
/**
 * 통원 카운터 문자열 파서. 중증 '이미 사용한 통원 **횟수**'와 비중증 '이미 사용한
 * 통원 **일수**'가 **형식 규칙만** 공유한다 — 둘 다 0 이상의 안전 정수다.
 *   공백·부호·소수·문자·지수 표기·안전 정수 초과는 null이며,
 *   **제거·절삭·0으로의 변형을 하지 않는다.** 100을 넘는 값도 유효한 과거 상태로 받는다.
 *   빈 값도 null이다 — 미입력과 명시적 0을 구분해야 하므로 빈 값을 0으로 만들지 않는다.
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. `num()`은 `-1`→**1**(부호를 지워 양수가 된다),
 *   `1.5`→1.5, `1e3`→13, `1,0`→10, `abc`·빈 값·`Infinity`→0으로 바꾼다.
 * ⚠ 형식만 공유하고 도메인 필드는 분리한다. 회와 일은 서로 다른 상태·라벨·근거 조문을 쓴다.
 */
const VISIT_COUNT_FORMAT = /^[0-9]+$/;
const nonNegSafeInt = (v: string): number | null => {
  if (!VISIT_COUNT_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
/** 비중증 통원 '이미 사용한 통원일수'(연 100일 한도용). */
const outpatientDays = nonNegSafeInt;
/** 중증 통원 '이미 사용한 통원 횟수'(연 100회 한도용). */
const outpatientVisits = nonNegSafeInt;

/**
 * 연 50회 한도가 있는 **별도 보장종목**(3대비급여 <표1>) — 과거 '보상한 횟수'를 항목마다
 * 따로 담는 축. MRI는 <표1>에 횟수 한도가 없어(`annualVisits: null`) 축을 만들지 않는다.
 *
 * ⚠ 상해·질병으로 나누지 않는다. <표1>은 각 상해·질병 치료행위를 **합산**해 한도를 정한다
 *   (등록 규칙 GEN2026-MSK-ANNUAL-*, GEN2026-INJECTION-ANNUAL-*). 그래서 이 화면의 별도
 *   보장종목 경로에는 원인 선택창 자체가 없다.
 */
const GEN2026_COUNTED_ITEMS = ["musculoskeletal_esw", "injection"] as const;
type Gen2026CountedItem = (typeof GEN2026_COUNTED_ITEMS)[number];
/** 항목별 연 횟수 한도. 화면에 숫자를 하드코딩하지 않고 엔진과 같은 규칙값을 쓴다. */
const GEN2026_COUNTED_ITEM_ANNUAL_VISITS: Record<Gen2026CountedItem, number> = {
  musculoskeletal_esw: GEN2026.specialItem.msk.annualVisits,
  injection: GEN2026.specialItem.injection.annualVisits,
};

/**
 * 별도 보장종목 '이미 보상한 횟수' 파서. 형식 규칙은 위 통원 카운터와 같지만 **필드를
 * 재사용하지 않는다** — 근거 조문(<표1> 본문의 항목별 행)·라벨·안내·한도가 다르다.
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. 실측: `-1`→**1**(부호를 지워 양수), `1.5`→**1.5**(소수를
 *   그대로 통과), `1e3`→**13**, `1,0`→**10**, `20만`→**20**, `abc`·빈 값·공백→**0**,
 *   `9007199254740993`→**9007199254740992**. 0으로 바뀌면 연 50회 한도가 통째로 사라져
 *   보험금이 과다 산출된다.
 * ⚠ 50을 넘는 값도 유효한 과거 상태다. 절삭하지 않는다 — 절삭하면 이미 한도를 넘긴 계약이
 *   아직 여유가 있는 것처럼 계산된다.
 *
 * 유효: 0 이상의 안전 정수(`0`, `00`, `50`, `51`, `100`, 안전 정수 최대값).
 * 무효(null = 미입력·잘못된 입력): 빈 값·공백·부호·소수·지수 표기·쉼표·문자·안전 정수 초과.
 */
const coveredCount = nonNegSafeInt;

/** 복제 버튼이 한 번에 만들 수 있는 최대 행 수(5세대 화면의 종전 상한). */
const GEN2026_MAX_COPIES = 100;
/**
 * 복제 **횟수** 전용 파서(5세대). 이 값은 "만들 행 수"일 뿐이고 보험 횟수·한도·소진
 * 상태와 아무 관계가 없다 — 통원 카운터(`nonNegSafeInt`)나 보상 횟수(`coveredCount`)와
 * **재사용하지 않는다.** 허용 범위도 다르다(여기는 1 이상 상한 이하, 저기는 0 이상).
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. 실측: `1e3`→**13행**, `1,0`→**10행**, `20만`→**20행**,
 *   `1.5`→1행(내림), `abc`·빈 값·공백·`0`→**1행**. 종전에는 무효값에서도 복제가 실행돼
 *   **이미 입력한 행을 전부 지우고 1행으로 만들었다**(4행 → 1행을 실측).
 * ⚠ 상한을 넘는 값을 상한으로 **깎지 않는다.**
 * ⚠ 4세대·2·3세대 파서를 재사용하지 않는다. 상한과 라벨·안내가 화면마다 다르다.
 *
 * 유효: 1 이상 GEN2026_MAX_COPIES 이하의 안전 정수.
 * 무효(null): 빈 값·공백·`0`·상한 초과·부호·소수·지수 표기·쉼표·문자·안전 정수 초과.
 */
const GEN2026_COPY_FORMAT = /^[0-9]+$/;
const gen2026CopyCount = (v: string): number | null => {
  if (!GEN2026_COPY_FORMAT.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 && n <= GEN2026_MAX_COPIES ? n : null;
};

const roomChargeAmount = (v: string): number | null => {
  if (!ROOM_CHARGE_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 5세대 **진료비** 전용 파서. 일반 비급여·급여 행(`amounts`)과 특별약관 행(`rows`)이 쓴다.
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. `num()`은 숫자·점이 아닌 문자를 **지우고** 실패를 0으로
 *   바꾸므로 파서에 닿기 전에 값이 **다른 유효값으로 둔갑**한다 —
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**1.5**(원 단위인데 소수를 통과시킨다),
 *   `1e3`→**13**, `1,0`→**10**, `abc`·빈 값·`Infinity`→**0**.
 *   위젯이 원문을 화면에 남기므로 **화면에 보이는 값과 계산에 쓰는 값이 달라진다.**
 *
 * ⚠ 5세대에서 **진료비 0원 행은 횟수·일수를 소진하지 않는다** — 중증 통원 회수와 비중증
 *   통원 일수는 `amount > 0`일 때만(multiClaim2026.ts), 특별약관 횟수는 `amount > 0`일 때만
 *   (specialItem2026.ts `counts`), 근골격계 승인 회차는 양수 금액 행만 센다(같은 파일
 *   `normalizeAmount(l.amount) > 0`). **2·3·4세대의 0원 행 설명을 여기에 옮기지 말 것.**
 *   별개 논점인 **진료비는 양수인데 지급보험금이 0원인 건**은, 직접 확인한 범위에서 횟수 소진
 *   기준을 확정하지 못해 **HOLD**로 유지한다. 두 해석의 비교 결과가 다를 때만 묶음을 차단하고,
 *   같으면 기존 계약대로 계산한다(설계 문서 §5.4.2·§5.4.4). 이번 입력 검증과 무관하다.
 *   그러므로 이 게이트의 근거는 횟수 소진이 아니라 **입력 계약** 자체다 — 계산기는 빈 값이나
 *   잘못된 입력을 임의로 다른 금액으로 바꾸지 않는다.
 * ⚠ 입력 위젯도 함께 바꿔야 한다. 파서만 엄격하게 하면 늦다(RawAmountInput 참조).
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ `roomChargeAmount`를 재사용하지 않는다. 형식 규칙이 같아도 근거 조문·라벨·안내가
 *   다르고, 상급병실료 차액은 금액과 입원일수를 함께 판정하는 별도 계약이다.
 * ⚠ 2·3·4세대 파서를 재사용하지 않는다. 같은 이유다.
 *
 * 유효: 쉼표 없는 0 이상의 정수(`0`, `300000`) 또는 정확한 천 단위 구분
 *   (`300,000`, `1,234,567`). **명시적으로 입력한 `0`은 유효값**이다.
 * 무효(null = 미입력·잘못된 입력): 빈 값·공백, 부호(`-`/`+`), 문자, `NaN`·`Infinity`,
 *   소수(`1.5`·`1.`·`.5`), 지수 표기(`1e3`), 잘못된 쉼표(`1,0`·`1,00,000`·`,300`·`300,`),
 *   안전 정수 범위(2^53−1) 초과.
 */
const GEN2026_AMOUNT_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const gen2026Amount = (v: string): number | null => {
  if (!GEN2026_AMOUNT_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 5세대 다회의 **누적 금액 파서** — 기존 지급보험금·연간 보험가입금액·통원 가입금액
 * 세 곳에만 쓴다. **원문을 변형 전에 형식으로 판정한다.**
 *
 * ⚠ 공용 `num()`을 쓰면 안 된다. `num()`은 `/[^0-9.]/`를 지우므로 **점을 남긴다** —
 *   4세대 `digits()`(`1.5`→15)나 2·3세대 `onlyNum()`(`1.5`→15)과 동작이 다르다.
 *     `-1`·`+1`→**1**(부호 삭제), `1.5`→**1.5**(소수가 그대로 전달됨),
 *     `1e3`→**13**, `20만`→**20**, `1,0`→**10**, `abc`·`1.2.3`·빈 값·공백만→**0**,
 *     `9007199254740993`→`…992`(반올림).
 *   ⚠ 세 입력 모두 맨 `<input>`이라 **화면에는 원문이 그대로 남는다**. 화면과 계산이 어긋난다.
 *   ⚠ 소수 차단은 **이번에 승인한 의도된 동작 변경**이다. 종전에는 `1.5`가 그대로 엔진에
 *     들어가 `nonNegInt`의 `Math.floor`로 잘렸다.
 * ⚠ 잘못된 입력의 결과 방향은 **비교 대상인 실제 이력·계약값을 알 때만** 말할 수 있다.
 *   `1,0`을 `1,000`의 오타로 본다면 한도가 10원이 되어 적게 나온다고 말할 수 있다.
 *   그러나 `-1`·`abc`·`1e3`은 사용자가 의도한 값을 알 수 없으므로 크다/작다고 단정하지 않고,
 *   **계산기가 원문을 다른 숫자로 바꾸거나 0으로 지웠다**는 사실로만 설명한다.
 * ⚠ 쉼표를 먼저 지우면 안 된다. `1,0`이 `10`이 되어 잘못된 입력이 유효값이 된다.
 *   **형식 검증이 끝난 뒤에만** 쉼표를 지운다.
 * ⚠ `trim()`으로 정리해 통과시키지 않는다. 화면에 남은 원문과 계산에 쓰인 값이 달라진다.
 * ⚠ **자릿수를 제한하지 않는다.** `1000000000000000`(안전 정수인 16자리)은 그대로 받고,
 *   `9007199254740993`만 안전 정수 범위를 벗어나므로 차단한다.
 * ⚠ 진료비 파서 `gen2026Amount`·상급병실료 `roomChargeAmount`와 형식 규칙이 겹쳐도
 *   재사용하지 않는다. 라벨·안내·무효 시 차단 범위가 다르다.
 * ⚠ **`priorDeductible`·`priorPool`(공제금액 두 입력)도 이 파서를 쓴다(G-10 항목 A).**
 *   형식 규칙은 같지만 **빈 값의 뜻은 다르다** — 두 필드 모두 초기값이 `"0"`이고 빈 값은
 *   `0`이다(가입금액 두 종류의 `undefined`와 다르다). 500만 원을 넘는 유효한 값도
 *   자르거나 거부하지 않는다 — 상한 처리는 엔진 산식에 있고 그대로 둔다.
 *
 * 유효: 쉼표 없는 0 이상의 안전 정수(`0`, `00`, `300000`, `1000000000000000`) 또는
 *   정확한 천 단위 구분(`300,000`). **명시적 `0`·`00`은 유효값**이고 그 뒤 처리는 각 입력의
 *   종전 정책을 따른다(엔진 무변경).
 * 무효(null): 공백만·앞뒤 공백·부호·문자·소수·지수 표기·잘못된 쉼표·안전 정수 초과.
 *   빈 문자열 `""`은 파서가 아니라 **호출부**에서 처리한다 —
 *   지급보험금은 `0`, 가입금액 두 종류는 `undefined`(미적용), 공제금액 두 종류는 `0`.
 *   필드마다 다르다.
 */
const GEN2026_MONEY_FORMAT = /^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/;
const gen2026Money = (v: string): number | null => {
  if (!GEN2026_MONEY_FORMAT.test(v)) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * 누적 금액이 이어지는 **보장축**. 별표15 2026.5.6 판본 직독 결과다.
 *
 * - 일반 4축 — 특약1 제5조①(인쇄 p.279)과 특약2 제5조①(p.308)이 "(1)상해비급여에 대하여
 *   입원과 통원의 보상금액을 합산하여 5천만원(비중증 1천만원) 이내에서, (2)질병비급여에
 *   대하여 … 이내에서" 계약자가 고른 금액을 연간 보험가입금액으로 정한다. 제5조③은 통원
 *   가입금액도 "(1)상해비급여 또는 (2)질병비급여 **각각에 대하여**" 정한다(p.280·p.309).
 *   ⇒ **질환 구분 × 원인 4축**이고, **같은 축 안에서 입원과 통원은 합산**한다.
 *   중증(특약1)과 비중증(특약2)은 **별개 특별약관의 별개 조문**이라 축이 갈린다.
 * - 별도 보장종목 4축 — 제5조①단서·③이 "(3)3대비급여의 보험가입금액은 제3조(3)제1항에서
 *   정한 연간 보장한도로 합니다"·"각 비급여의료비별 보장한도로 합니다"라고 정하고,
 *   특약2도 비급여 자기공명영상진단에 같은 단서를 둔다(p.279~280·p.308~309).
 *   <표1>은 "각 상해·질병 치료행위를 합산"하므로 **cause는 축을 가르지 않는다**.
 *   중증 MRI(특약1 (3))와 비중증 MRI(특약2 (3))는 **다른 약관의 다른 보장종목**이라 갈린다.
 *
 * ⚠ 일반 직접 경로·**일반 전환 경로**(중증 예외적 용도 주사·비중증 근골격계·주사료)·
 *   **상급병실료**는 모두 (1)(2) 보장종목에 귀속되므로 같은 일반 축을 **공유**한다.
 *   ⚠ 이는 각 청구가 (1)(2)로 보내진다는 **보장종목 귀속에 따른 해석**이다. "전환된 청구가
 *     (1)(2)의 가입금액을 소진한다"는 명문을 새로 확인한 것이 아니다.
 * ⚠ 축 키는 **기존 라우팅 결과**(route·specialItem·severity·cause와 폼 표시 조건)에서만
 *   만든다. 별도의 항목 판정 로직을 두면 엔진 라우팅과 어긋난다.
 */
type Gen2026GeneralAxis = `general_${Severity}_${Cause}`;
type Gen2026ItemAxis =
  | "item_msk_critical" | "item_injection_critical" | "item_mri_critical" | "item_mri_non_critical";
type Gen2026PaidAxis = Gen2026GeneralAxis | Gen2026ItemAxis;
const GEN2026_GENERAL_AXES: readonly Gen2026GeneralAxis[] = [
  "general_critical_injury", "general_critical_disease",
  "general_non_critical_injury", "general_non_critical_disease",
];
const GEN2026_ITEM_AXES: readonly Gen2026ItemAxis[] = [
  "item_msk_critical", "item_injection_critical", "item_mri_critical", "item_mri_non_critical",
];
const GEN2026_PAID_AXES: readonly Gen2026PaidAxis[] = [...GEN2026_GENERAL_AXES, ...GEN2026_ITEM_AXES];
/** `route === "special_item"`인 조합만 별도 보장종목 축을 갖는다. 그 외는 undefined다. */
const GEN2026_ITEM_AXIS_OF: Record<Gen2026SpecialItem, Partial<Record<Severity, Gen2026ItemAxis>>> = {
  musculoskeletal_esw: { critical: "item_msk_critical" },
  injection: { critical: "item_injection_critical" },
  mri: { critical: "item_mri_critical", non_critical: "item_mri_non_critical" },
};
const GEN2026_ITEM_AXIS_LABEL: Record<Gen2026ItemAxis, string> = {
  item_msk_critical: "중증 근골격계 이학요법·체외충격파·증식치료",
  item_injection_critical: "중증 비급여 주사료",
  item_mri_critical: "중증 비급여 MRI·MRA",
  item_mri_non_critical: "비중증 비급여 MRI·MRA",
};
/**
 * 일반 축의 화면 이름. **네 키를 모두 명시한다.**
 *
 * ⚠ 축 키를 `split("_")`로 쪼개면 안 된다. `Severity`의 `"non_critical"` 자체에 밑줄이 있어
 *   `general_non_critical_injury`가 `["general","non","critical","injury"]`로 나뉘고, 원인
 *   자리에 `"critical"`이 들어온다. 여기에 "`injury`가 아니면 질병" 같은 기본 분기를 두면
 *   **비중증 상해가 질병으로 표시된다** — 계산은 상해 축을 쓰는데 라벨과 공유 안내만 질병이라
 *   사용자가 다른 보장축의 이력을 그 칸에 넣게 된다. 실제로 `7944248`에서 그렇게 나왔다.
 * ⚠ 그래서 문자열 분해도, 실패를 특정 축으로 돌리는 fallback도 두지 않는다. 키가 늘어나면
 *   이 Record가 컴파일 단계에서 빠진 항목을 잡는다.
 */
const GEN2026_GENERAL_AXIS_LABEL: Record<Gen2026GeneralAxis, string> = {
  general_critical_injury: "중증 상해비급여",
  general_critical_disease: "중증 질병비급여",
  general_non_critical_injury: "비중증 상해비급여",
  general_non_critical_disease: "비중증 질병비급여",
};
const generalAxisLabel = (a: Gen2026GeneralAxis): string => GEN2026_GENERAL_AXIS_LABEL[a];

export default function HealthCalcMulti2026() {
  const [amounts, setAmounts] = useState(["300000", "300000"]);
  // "" = 미선택. 일반 (1)(2)는 제5조①이 상해·질병 각 축으로 가입금액과 누적을 나누므로,
  //   원인을 고르지 않은 채 계산하면 사용자가 인식하지 못한 채 한쪽 축으로 계산된다.
  //   ⚠ 별도 보장종목은 상해·질병 합산이라 이 입력을 노출하지도, 요구하지도 않는다.
  const [cause, setCause] = useState<Cause | "">("");
  // 급여는 원인이 산식에 영향을 주지 않고 결과 안내 문구에만 쓰인다. 종전 동작을 그대로 둔다
  //   — 이번 변경으로 급여 사용자에게 새 선택을 강제하지 않기 위해서다.
  const [benefitCause, setBenefitCause] = useState<Cause>("disease");
  const [coverage, setCoverage] = useState<Coverage>("non_benefit");
  const [visit, setVisit] = useState<Visit>("outpatient");
  // "" = 미선택. 단건 계산기와 같은 정책 — 기본값을 두면 사용자가 인식하지 못한 채
  //   중증으로 계산되고, 중증/비중증은 자기부담률(30% vs 50%)과 한도가 크게 다르다.
  const [severity, setSeverity] = useState<Severity | "">("");
  // "" = 미선택. 고르기 전에는 계산하지 않는다.
  const [nonBenefitItem, setNonBenefitItem] = useState<Gen2026NonBenefitItem | "">("");
  // "" = 미선택. 약제 용도가 보상하는 보장종목을 바꾼다(특약1 제3조(3)②).
  const [injectionPurpose, setInjectionPurpose] = useState<Gen2026InjectionPurpose | "">("");
  // 급여 통원의 의료기관 종별. 종전부터 기본값이 있었고 이번에 바꾸지 않는다.
  const [benefitTier, setBenefitTier] = useState<Tier>("clinic");
  // 비급여 **입원**의 의료기관 종별. ⚠ 기본값을 두지 않는다.
  //   중증은 공제금액 상한 500만원(특약1 제5조⑤), 비중증은 1회당 300만원 한도(특약2 제3조 (1)①·(2)①)가
  //   종별에 따라 갈린다. 자동 선택되면 사용자가 인식하지 못한 채 한쪽으로 계산된다.
  const [nbInpatientTier, setNbInpatientTier] = useState<Tier | "">("");
  const [nhisRate, setNhisRate] = useState("");
  // ⚠ 누적 금액 상태는 **보장축마다** 따로 둔다. 하나를 공유하면 축을 바꿀 때 값이 말없이
  //   다른 한도로 넘어간다 — 일반(연 5천만 축)에 넣은 900만원이 중증 근골격계(연 350만 축)에
  //   그대로 적용돼 보험금이 0원이 되는 것을 프로덕션에서 재현했다. 축 구성은 별표15
  //   2026.5.6 판본 직독 결과다(설계 문서 §5의 G-8 절 참조).
  //   ⚠ 초기값은 그대로다 — 지급보험금 "0", 가입금액 빈 문자열.
  const [priorInsuranceByAxis, setPriorInsuranceByAxis] = useState<Record<Gen2026PaidAxis, string>>(
    () => Object.fromEntries(GEN2026_PAID_AXES.map((k) => [k, "0"])) as Record<Gen2026PaidAxis, string>,
  );
  const [priorDeductible, setPriorDeductible] = useState("0");
  //   연간·통원 가입금액은 일반 4축에만 있다(별도 보장종목의 가입금액은 <표1>의 항목별
  //   연간 보장한도로 정해져 계약자가 고르지 않는다 — 제5조①단서·③).
  //   ⚠ 세 입력은 같은 일반 축 키를 쓰지만 **값은 각각 별도 상태**다.
  const [outpatientLimitByAxis, setOutpatientLimitByAxis] = useState<Record<Gen2026GeneralAxis, string>>(
    () => Object.fromEntries(GEN2026_GENERAL_AXES.map((k) => [k, ""])) as Record<Gen2026GeneralAxis, string>,
  );
  //   ⚠ 빈 값으로 시작한다. 기본값 "0"은 사용자가 확인하지 않은 "기존 사용 없음"을
  //     화면이 대신 만들어 내는 것이라 한도가 통째로 사라진다. 0은 직접 입력해야 한다.
  const [priorVisits, setPriorVisits] = useState("");
  // ⚠ 기본값 없음. 0으로 추정하면 사용자가 인식하지 못한 채 "이전 통원 없음"으로 계산된다.
  const [priorOutDays, setPriorOutDays] = useState("");
  const [annualLimitByAxis, setAnnualLimitByAxis] = useState<Record<Gen2026GeneralAxis, string>>(
    () => Object.fromEntries(GEN2026_GENERAL_AXES.map((k) => [k, ""])) as Record<Gen2026GeneralAxis, string>,
  );
  const [copyCount, setCopyCount] = useState("3");
  // 특별약관 전용 입력
  const [rows, setRows] = useState<SpecialRow[]>([emptyRow(), emptyRow()]);
  // 상급병실료 차액 — 1행 = 1회 입원. 입원일수는 기본 빈 값(추정하지 않는다).
  const [rcRows, setRcRows] = useState<RoomChargeRow[]>([{ amount: "", days: "" }]);
  const [approvedThrough, setApprovedThrough] = useState<Gen2026MskApprovedThrough>(
    GEN2026_MSK_APPROVED_THROUGH_VALUES[0],
  );
  /**
   * 별도 보장종목의 '이미 보상한 횟수' — **항목마다 따로** 담는다.
   *
   * ⚠ 종전에는 상태가 하나뿐이라 근골격계에 넣은 값이 주사료로 그대로 넘어갔다. 실측:
   *   근골격계에 50을 넣고 주사료로 바꾸면 주사료도 50회를 쓴 것으로 계산돼 보험 적용이
   *   0원이 됐고, 반대로 주사료에 10을 넣고 근골격계로 돌아오면 원래 50이 사라져 한도가
   *   남아 있는 것처럼 420,000원이 나왔다. 뒤쪽이 더 위험하다 — 보험금이 **더 나오는**
   *   방향이라 사용자가 눈치채기 어렵다.
   * ⚠ 등록 규칙이 두 항목의 금액·횟수 한도를 <표1>의 서로 다른 행으로 각각 등록하고
   *   (350만·50회 / 250만·50회), 엔진도 `annualVisits`·`visitsCap`을 항목별로 고른다.
   *   한 번의 엔진 호출 = 한 항목이므로 두 축을 섞던 곳은 이 화면의 단일 상태뿐이었다.
   *   같은 파일의 `priorInsuranceByAxis`(G-8)와 같은 형태로 맞춘다.
   * ⚠ 초기값은 빈 문자열이다. 종전 `"0"`은 사용자가 확인하지 않은 "보상 이력 없음"을
   *   화면이 대신 만들어 내는 것이라 연 50회 한도가 통째로 사라졌다. 0은 직접 입력해야 한다.
   */
  const [priorCountByItem, setPriorCountByItem] = useState<Record<Gen2026CountedItem, string>>(
    () => Object.fromEntries(GEN2026_COUNTED_ITEMS.map((k) => [k, ""])) as Record<Gen2026CountedItem, string>,
  );
  // ⚠ 기본값 없음. 승인 구간은 '치료횟수' 축이고 '보상한 횟수'로 대신 셀 수 없다.
  //   미입력을 0으로 추정하면 승인 경계를 넘겼는지 모르는 채 보험금을 계산하게 된다.
  const [priorActs, setPriorActs] = useState("");
  const [priorPool, setPriorPool] = useState("0");
  const [submitted, setSubmitted] = useState(false);

  // ⚠ 치료유형은 비급여에서만 고른다. 급여로 바꾸면 선택창은 사라지지만 `nonBenefitItem`
  //   상태는 남는다. 여기에 급여 조건을 걸지 않으면 **급여인데 특별약관·상급병실료 입력 폼이
  //   렌더되는데 급여 계산은 `amounts`를 쓴다** — 화면에 보이는 금액을 고쳐도 계산에 쓰이지
  //   않고, 숨겨진 `amounts`로 계산된다. 치료 형태 선택창도 상급병실료 조건에 가려 사라진다.
  //   화면·검증·계산이 같은 배열을 보도록 급여 여부를 여기서 한 번에 반영한다.
  const isSpecialItem = coverage === "non_benefit"
    && (nonBenefitItem === "musculoskeletal_esw" || nonBenefitItem === "injection" || nonBenefitItem === "mri");
  const specialItem = isSpecialItem ? (nonBenefitItem as Gen2026SpecialItem) : null;
  const needsItem = coverage === "non_benefit" && nonBenefitItem === "";
  const isRoomCharge = coverage === "non_benefit" && nonBenefitItem === "room_charge";
  // 상급병실료도 질환 구분이 필요하다 — 산식은 같지만 연간 가입금액 축(중증 5천만·비중증 1천만)이 다르다.
  const needsSeverity = coverage === "non_benefit" && nonBenefitItem !== "" && severity === "";

  // 경로 판정은 엔진과 같은 함수를 쓴다. 화면과 계산이 다른 판단을 하지 않게 한다.
  const route = specialItem !== null && severity !== ""
    ? routeOfGen2026Item(severity, specialItem, injectionPurpose === "" ? undefined : injectionPurpose)
    : null;
  const needsPurpose = route === "missing_purpose";
  const showSpecialForm = route === "special_item";
  const showGeneralForm = coverage === "non_benefit" && (nonBenefitItem === "general" || route === "general");
  // 일반 (1)(2)로 계산되는 조합에서만 원인이 필요하다. 별도 보장종목·급여에는 요구하지 않는다.
  //
  // 상급병실료는 (3) 별도 보장종목이 아니라 (1)(2) 표 안의 행이라 질환 구분과 원인이 모두 필요하다.
  //   화면 순서를 강제한다: ①치료유형 → ②질환 구분 → ③원인 → ④입력 폼.
  //   ⚠ 질환 구분 선택창을 상급병실료에서 숨기면 안내만 뜨고 고를 수단이 없어 진행이 막힌다.
  const showRoomChargeCause = isRoomCharge && severity !== "";
  const showRoomChargeForm = showRoomChargeCause && cause !== "";
  const needsCause = (showGeneralForm || showRoomChargeCause) && severity !== "" && cause === "";
  // 차액 총액·입원일수 어느 쪽이든 유효하지 않으면 계산하지 않는다.
  //   금액: 빈 값·음수·문자·Infinity·잘못된 소수는 불완전(명시적 0은 유효).
  //   일수: 0·음수·소수·빈 값은 불완전.
  const rcIncomplete = showRoomChargeForm
    && rcRows.some((r) => roomChargeAmount(r.amount) === null || positiveDays(r.days) === null);
  /**
   * 연 50회 한도의 '보상한 횟수' 축을 **지금 쓰는 항목**. 없으면 null.
   *
   * ⚠ `specialItem`만 보면 안 된다. 항암제·항생제·희귀의약품 목적의 주사료는
   *   `routeOfGen2026Item`이 **일반 (1)(2) 경로**로 돌려보내므로(특별약관1 제3조(3)제2항)
   *   이 축을 쓰지 않는다. 그래서 `showSpecialForm`(= route === "special_item")과 중증까지
   *   함께 본다. 화면·검증·전달이 모두 이 하나의 판정을 쓴다.
   * ⚠ MRI는 <표1>에 횟수 한도가 없어 이 축에 들어오지 않는다.
   */
  const countedItem: Gen2026CountedItem | null = showSpecialForm && severity === "critical"
    && (specialItem === "musculoskeletal_esw" || specialItem === "injection")
    ? specialItem
    : null;
  /** 활성 항목의 원문. 숨은 항목의 값은 상태에 남지만 여기서 읽지 않는다. */
  const priorCountRaw = countedItem === null ? "" : priorCountByItem[countedItem];
  /** 활성 항목의 확정된 숫자. null이면 미입력·잘못된 입력이라 계산하지 않는다. */
  const priorCountNum = countedItem === null ? null : coveredCount(priorCountRaw);
  //   빈 값을 0으로 추정하지 않는다 — 연 50회 한도가 통째로 사라져 보험금이 과다 산출된다.
  //   ⚠ 미입력(빈 값)과 확인 결과 0은 다른 상태다. 0은 유효값이다.
  const needsPriorCount = countedItem !== null && priorCountNum === null;
  // 중증 근골격계는 보상 승인 회차 판정에 '과거 치료행위 수'가 필요하다(<표1> 주)).
  //   확인된 0회와 미입력을 구분한다 — 0은 유효값이고 빈 값이면 계산하지 않는다.
  const needsPriorActs = coverage === "non_benefit" && severity === "critical"
    && specialItem === "musculoskeletal_esw" && route === "special_item"
    && outpatientDays(priorActs) === null;
  // 비중증 통원은 연 100일 한도가 걸리므로 이미 사용한 일수를 알아야 계산할 수 있다.
  //   빈 값을 0으로 추정하지 않는다 — 한도가 통째로 사라져 보험금이 과다 산출된다.
  const needsOutDays = coverage === "non_benefit" && (nonBenefitItem === "general" || route === "general")
    && severity === "non_critical" && visit === "outpatient" && outpatientDays(priorOutDays) === null;
  // 중증 통원은 연 100회 한도가 걸린다. 같은 이유로 이미 사용한 횟수 없이는 계산하지 않는다.
  //   ⚠ 단위가 '일'이 아니라 '회'다. 게이트도 상태도 비중증과 따로 둔다.
  const needsOutVisits = coverage === "non_benefit" && (nonBenefitItem === "general" || route === "general")
    && severity === "critical" && visit === "outpatient" && outpatientVisits(priorVisits) === null;
  // 일반 비급여 입원은 종별을 고르기 전에는 계산하지 않는다(중증·비중증 모두).
  const needsTier = showGeneralForm && severity !== "" && visit === "inpatient" && nbInpatientTier === "";
  // 중증 MRI 입원 행은 의료기관 종별이 조건부 필수다(제5조⑤ pool 판정).
  const needsRowTier = showSpecialForm && severity === "critical" && specialItem === "mri";
  const rowsIncomplete = showSpecialForm && rows.some((r) => r.visit === "" || (needsRowTier && r.visit === "inpatient" && r.tier === ""));
  /**
   * 중증 MRI **누적 공제금액 입력의 전용 조건**. 500만원 pool이 실제로 소진되는 행이
   * 하나라도 있을 때만 참이다.
   *
   * ⚠ `needsRowTier`를 재사용하면 안 된다. 그 조건은 **행별 의료기관 종별 선택창**과
   *   `rowsIncomplete`(미선택 차단)에도 쓰이므로, 여기 맞춰 좁히면 종별을 고를 수단이
   *   사라지고 미선택 게이트까지 무너진다. 두 조건은 목적이 다르므로 따로 둔다.
   * ⚠ 소비 조건은 엔진에 이미 있다 — `specialItem2026.ts`의
   *   `spec.poolEligible && line.visit === "inpatient" && line.tier === "hospital"`.
   *   여기서는 **그 조건을 새로 만들지 않고 노출·전달을 거기에 맞출 뿐**이다.
   *   `hospital`은 선택창 라벨대로 **상급종합·종합병원**을 뜻한다.
   * ⚠ `visit`과 `tier`를 **함께** 본다. 통원 행에 이전 선택으로 `tier: "hospital"`이
   *   남아 있어도 pool 대상이 아니다(엔진도 `visit === "inpatient"`를 함께 본다).
   * ⚠ `some`이다. 대상 행이 **하나라도** 있으면 노출·전달한다 — `every`로 바꾸면
   *   혼합 구성에서 실제로 소진되는 행이 있는데도 입력이 사라진다.
   * ⚠ 이 조건이 거짓이어도 상태는 그대로 둔다. 행 구성이 돌아오면 원문이 복원된다.
   */
  const usesPriorPool = showSpecialForm && severity === "critical" && specialItem === "mri"
    && rows.some((r) => r.visit === "inpatient" && r.tier === "hospital");

  // ── 활성 보장축 ─────────────────────────────────────────────────────
  //   ⚠ 키는 **이미 계산된 라우팅 결과**에서만 만든다. 새 항목 판정 로직을 두지 않는다.
  //   ⚠ 미선택(`""`)을 특정 축으로 대신 정하지 않는다. 축이 정해지지 않으면 `null`이고,
  //     그때는 어떤 축의 값도 읽지도 고치지도 않는다. `"undefined"` 같은 키를 만들지 않는다.
  //   ⚠ 급여는 이 상태들을 쓰지 않는다 — 아래 세 폼이 모두 비급여 조건 안에 있다.
  const generalAxis: Gen2026GeneralAxis | null =
    severity !== "" && cause !== "" ? `general_${severity}_${cause}` : null;
  const itemAxis: Gen2026ItemAxis | null = showSpecialForm && specialItem !== null && severity !== ""
    ? GEN2026_ITEM_AXIS_OF[specialItem][severity] ?? null
    : null;
  //   축은 **누적 입력 폼이 실제로 렌더되는 조건**과 같은 순서로 고른다.
  //     특별약관 폼 → 항목 축 / 상급병실료·일반 폼 → 일반 축.
  //   상급병실료와 일반 전환 경로는 (1)(2)에 귀속되므로 **같은 일반 축을 공유**한다.
  const paidAxis: Gen2026PaidAxis | null = showSpecialForm ? itemAxis
    : (showRoomChargeForm || showGeneralForm) ? generalAxis
    : null;
  //   활성 축이 없으면 화면도 엔진도 값을 보지 않는다. 기본값 "0"·""은 축이 정해진 뒤에만 쓰인다.
  const priorInsurance = paidAxis === null ? "0" : priorInsuranceByAxis[paidAxis];
  const annualLimit = generalAxis === null ? "" : annualLimitByAxis[generalAxis];
  const outpatientLimit = generalAxis === null ? "" : outpatientLimitByAxis[generalAxis];
  const setPriorInsurance = (v: string) => {
    if (paidAxis === null) return;
    setPriorInsuranceByAxis((old) => ({ ...old, [paidAxis]: v }));
  };
  const setAnnualLimit = (v: string) => {
    if (generalAxis === null) return;
    setAnnualLimitByAxis((old) => ({ ...old, [generalAxis]: v }));
  };
  const setOutpatientLimit = (v: string) => {
    if (generalAxis === null) return;
    setOutpatientLimitByAxis((old) => ({ ...old, [generalAxis]: v }));
  };

  // ── 누적 금액 검증 — **경로가 실제로 쓰는 것만** ─────────────────────
  //   ⚠ 급여는 세 금액을 하나도 쓰지 않는다. 다만 **그 이유를 정확히 적는다** —
  //     `paidAxis`는 세 폼이 모두 `coverage === "non_benefit"` 안에 있어 급여에서 null이
  //     되지만, `generalAxis`는 `severity`·`cause`로만 만들어지고 두 상태는 급여로 바꿔도
  //     초기화되지 않으므로 **남아 있을 수 있다.** 그때 파생 `annualLimit`·
  //     `outpatientLimit`은 ""이 아니라 그 축의 값을 읽는다.
  //     간섭을 막는 것은 축이 null이라는 사실이 아니라 아래 `usesAnnualLimit`·
  //     `usesOutpatientLimit`의 **활성 조건**이다 — 급여에서는 둘 다 거짓이라 검증도
  //     전달도 하지 않는다. 상태가 남아 있다는 사실과 그 값이 쓰인다는 것은 다르다.
  //   ⚠ 빈 문자열의 뜻이 **필드마다 다르다.** 지급보험금은 0(종전 `num("")`과 같다),
  //     가입금액 두 종류는 undefined(미적용). 한쪽 규칙을 다른 쪽에 옮기지 않는다.
  //   ⚠ 명시적 0·00은 유효값이고 숫자 0을 그대로 전달한다. 엔진의 종전 처리를 바꾸지 않고,
  //     이번에는 0에 대한 새 안내도 붙이지 않는다.
  const priorInsuranceNum = priorInsurance === "" ? 0 : gen2026Money(priorInsurance);
  //   연간 가입금액은 일반 (1)(2)와 상급병실료만 쓴다 — 별도 보장종목에는 없다(제5조①단서·③).
  const usesAnnualLimit = (showGeneralForm || showRoomChargeForm) && generalAxis !== null;
  const annualLimitNum = !usesAnnualLimit || annualLimit === "" ? undefined : gen2026Money(annualLimit);
  //   통원 가입금액은 일반 (1)(2)의 **통원**에서만 쓴다. 전달 조건과 같은 식이다.
  const usesOutpatientLimit = showGeneralForm && generalAxis !== null && visit === "outpatient";
  const outpatientLimitNum = !usesOutpatientLimit || outpatientLimit === ""
    ? undefined : gen2026Money(outpatientLimit);
  const priorInsuranceInvalid = priorInsuranceNum === null;
  const annualLimitInvalid = annualLimitNum === null;
  const outpatientLimitInvalid = outpatientLimitNum === null;
  // ⚠ 무효값을 0이나 undefined로 바꿔 계산하지 않는다. null을 **배제**해야만 이 객체가
  //   만들어지고, 그 과정에서 세 값이 number / number|undefined로 좁혀진다. 타입 단언으로
  //   null을 숫자인 척 넘기면 게이트를 우회한 값이 그대로 엔진에 들어간다.
  //   ⚠ 이 객체를 읽는 분기는 모두 세 폼 중 하나가 렌더되는 조건 안에 있으므로,
  //     그때 `paidAxis`는 null이 아니고 `prior`는 항상 숫자다.
  const money = priorInsuranceNum === null || annualLimitNum === null || outpatientLimitNum === null
    ? null
    : { prior: priorInsuranceNum, annual: annualLimitNum, out: outpatientLimitNum };

  // ── 공제금액 두 입력 검증 (G-10 항목 A) ─────────────────────────────
  /**
   * 일반 (1)(2) 경로의 **누적 공제금액** 전용 조건.
   *
   * ⚠ 엔진의 소비 조건을 새로 만들지 않고 **그대로 옮겼다**. `calc2026`은
   *   `severity === "critical" && visit === "inpatient" && tier === "hospital"`일 때만
   *   500만원 상한을 적용하고(generation2026.ts), `calculateMany2026`도 같은 조건에서만
   *   이 값을 건별 계산에 넘긴다(multiClaim2026.ts). 일반 경로로 전환된 특약 조합은
   *   `calculateRoutedGeneral2026`이 같은 엔진으로 되돌리므로 조건이 같다.
   *   `hospital`은 선택창 라벨대로 **상급종합·종합병원**을 뜻한다.
   * ⚠ `generalAxis !== null`을 함께 본다. 종전 **노출**이 이미 그 조건 안에 있었고,
   *   종전 **전달**이 일어나던 두 자리도 모두 원인이 선택된 뒤에만 도달한다
   *   (`plainResult`는 `cause !== ""`, 전환 경로는 `route === "general" && cause === ""`를
   *   게이트가 배제한다). 그래서 노출·검증·전달이 하나의 조건으로 모인다.
   * ⚠ 상급병실료는 이 축을 쓰지 않는다 — `roomCharge2026`의 `UNUSED_KEYS`가
   *   `priorAnnualDeductible`을 **거부**한다. `showGeneralForm`이 상급병실료를 배제하므로
   *   그 경로에서는 검증도 전달도 하지 않는다.
   */
  const usesPriorDeductible = showGeneralForm && generalAxis !== null
    && severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital";
  /**
   * ⚠ **활성일 때만** 검증한다. 조건이 거짓이면 `undefined`다 — 숨은 원문은 상태에 남지만
   *   파서에 닿지 않고 엔진에도 가지 않는다. 조건이 돌아오면 무효값 안내도 다시 나타난다.
   * ⚠ 빈 값은 **0**이다. 초기값이 `"0"`이고 종전 `num("")`도 0이었던 기존 계약을 그대로
   *   유지한 것이며, 빈 값을 0으로 보는 것이 안전하다고 확정한 것이 아니다.
   *   (두 필드가 요구하는 과거 누적액의 정확한 범위는 별도 조사 항목이다.)
   * ⚠ 500만원을 넘는 **유효한** 값은 파서가 자르지도 거부하지도 않는다. 상한 처리는
   *   엔진에 있고(`Math.max(cap - prior, 0)`), 이번에 그 동작을 바꾸지 않는다.
   */
  const priorDeductibleNum = !usesPriorDeductible ? undefined
    : priorDeductible === "" ? 0 : gen2026Money(priorDeductible);
  const priorPoolNum = !usesPriorPool ? undefined
    : priorPool === "" ? 0 : gen2026Money(priorPool);
  const priorDeductibleInvalid = priorDeductibleNum === null;
  const priorPoolInvalid = priorPoolNum === null;
  // ⚠ `money`와 같은 방식이다 — null을 **배제**해야만 객체가 만들어지고, 그 과정에서
  //   두 값이 `number | undefined`로 좁혀진다. 타입 단언도, 0 대체도 하지 않는다.
  const deductibles = priorDeductibleNum === null || priorPoolNum === null
    ? null
    : { general: priorDeductibleNum, pool: priorPoolNum };

  // ── 진료비 원문 검증 — **경로별로 분리한다** ──────────────────────────
  //   화면의 입력 행은 세 배열로 나뉘어 있고, 렌더 분기가 활성 배열과 정확히 일치한다
  //     (showRoomChargeForm → rcRows / showSpecialForm → rows / 그 외 → amounts).
  //   ⚠ 그래서 게이트도 **그 조합에서 실제로 계산에 들어가는 배열에만** 건다.
  //     한 배열에 게이트를 몰아 걸면 화면에 보이지도 않는 다른 경로의 남은 무효값 때문에
  //     현재 경로가 계산되지 않는다. 경로를 바꾸면 이전 경로의 입력은 상태에 남아 있다.
  //   ⚠ 상급병실료(rcRows)는 이미 `roomChargeAmount`로 엄격 검증하고 `rcIncomplete`가 막는다.
  //     이번 변경 대상이 아니며 파서·게이트·계산을 그대로 둔다.
  /** 급여 / 일반 비급여 / 일반 경로로 전환된 조합이 쓰는 `amounts` 배열이 활성인가. */
  const usesAmounts = coverage === "benefit" || showGeneralForm;
  /** 무효 행의 **1-기반 번호**. 안내에서 문제 행을 지목하는 데 쓴다. */
  const badAmountRows = usesAmounts
    ? amounts.map((a, i) => (gen2026Amount(a) === null ? i + 1 : null)).filter((n): n is number => n !== null)
    : [];
  const amountsIncomplete = badAmountRows.length > 0;
  /** 특별약관 행(`rows`)의 진료비. `showSpecialForm`일 때만 계산에 들어간다. */
  const badRowAmounts = showSpecialForm
    ? rows.map((r, i) => (gen2026Amount(r.amount) === null ? i + 1 : null)).filter((n): n is number => n !== null)
    : [];
  const rowAmountsIncomplete = badRowAmounts.length > 0;
  /**
   * 복제 원본은 **실제 첫 행 금액**이다. 무효면 버튼을 비활성화하고 핸들러에서도 막는다.
   *   ⚠ 명시적 `0`은 유효값이므로 복제할 수 있다.
   *   ⚠ 대체될 다른 행이 무효여도 복제는 막지 않는다 — 어차피 원본으로 덮인다.
   */
  const copySourceInvalid = gen2026Amount(amounts[0] ?? "") === null;
  const copyCountNum = gen2026CopyCount(copyCount);
  const copyCountInvalid = copyCountNum === null;

  // ⚠ 무효 행은 위 게이트가 엔진 호출 자체를 막는다. 0원으로 대체하거나 행을 지우지 않는다.
  //   0원으로 바꾸면 사용자가 입력하지 않은 금액을 계산기가 만들어 내는 것이고, 결과표에
  //   실제로 청구하지 않은 0원 행이 남는다.
  const specialLines: Gen2026SpecialLine[] = rows.map((r) => ({ amount: gen2026Amount(r.amount) as number, visit: r.visit as Visit }));
  const mriLines: Gen2026CriticalMriLine[] = rows.map((r) => r.visit === "inpatient"
    ? { amount: gen2026Amount(r.amount) as number, visit: "inpatient", tier: r.tier as Tier }
    : { amount: gen2026Amount(r.amount) as number, visit: "outpatient" });

  // ── 별도 보장종목 / 일반 경로 전환 ──────────────────────────────────
  //   판별 유니온이라 잘못된 조합은 여기서 컴파일되지 않는다.
  let itemResult: Gen2026ItemClaimResult | null = null;
  // ⚠ 금액이 무효이면 이 경로의 엔진 호출 자체를 막는다. 아래 세 분기는 `nonBenefitItem`으로
  //   상호배타적이라(general / msk·injection·mri / room_charge) 한 분기를 막아도
  //   `result = itemResult ?? roomResult ?? plainResult`가 다른 분기로 우회하지 않는다.
  if (money !== null && deductibles !== null
      && coverage === "non_benefit" && specialItem !== null && severity !== "" && !rowsIncomplete
      && !rowAmountsIncomplete
      && !needsPriorActs && !needsPriorCount
      && !(route === "general" && (cause === "" || (visit === "inpatient" && nbInpatientTier === "")
        || needsOutDays || needsOutVisits || amountsIncomplete))) {
    const generalCommon = {
      route: "general" as const, coverage: "non_benefit" as const, cause: cause as Cause, visit,
      // ⚠ 빈 값을 Tier로 단언하지 않는다. 아래 게이트가 미선택을 이미 배제한다.
      tier: visit === "inpatient" ? nbInpatientTier || undefined : undefined,
      amounts: amounts.map((a) => gen2026Amount(a) as number),
      priorAnnualInsurancePaid: money.prior,
      annualCoverageLimit: money.annual,
      outpatientCoverageLimit: money.out,
      priorAnnualDeductible: deductibles.general,
    };
    // ⚠ 통원 카운터는 generalCommon에 넣지 않는다. 스프레드로 실으면 축이 다른 분기에도
    //   같은 필드가 따라 들어가고, 초과 필드는 타입 검사에서 드러나지 않는다.
    //   각 분기에서 쓰는 쪽만 실어 보낸다.
    const outVisits = visit === "outpatient" ? outpatientVisits(priorVisits) ?? undefined : undefined; // 중증 = 회
    const outDays = visit === "outpatient" ? outpatientDays(priorOutDays) ?? undefined : undefined; // 비중증 = 일
    /**
     * 활성 항목의 확정된 '보상한 횟수'. 위 게이트가 `needsPriorCount`로 무효를 이미
     * 배제했으므로 아래 두 분기에서는 숫자다.
     *   ⚠ 타입 단언(`as number`)이나 `?? 0`으로 통과시키지 않는다 — `?? 0`은 미입력을
     *     "보상 이력 없음"으로 만들어 한도를 지운다. null이면 전달 자체를 하지 않는다.
     *   ⚠ 활성 항목이 아닌 쪽의 상태는 여기서 읽지 않는다(숨은 값 미전달).
     */
    const coveredSoFar = priorCountNum === null ? undefined : priorCountNum;
    if (severity === "critical") {
      if (specialItem === "musculoskeletal_esw") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "musculoskeletal_esw", lines: specialLines,
          approvedThroughVisit: approvedThrough,
          // ⚠ 두 축을 서로 대신 쓰지 않는다. 위는 연 50회 한도, 아래는 승인 구간용이다.
          priorAnnualCoveredCount: coveredSoFar,
          priorAnnualTreatmentActCount: outpatientDays(priorActs) ?? undefined,
          priorAnnualInsurancePaid: money.prior,
        });
      } else if (specialItem === "mri") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "mri", lines: mriLines,
          // ⚠ 소진 대상 행이 없으면 넘기지 않는다. 엔진의 `nonNegInt(undefined)`는 0이라
          //   pool 시작값이 같고, 진입점 검증도 이 필드를 미사용 축으로 거부하지 않는다
          //   (통원 카운터와 다르다). 그래서 결과가 달라지지 않는다.
          //   ⚠ 파서·초기값·빈 값 처리는 그대로다 — 이번 변경은 **노출·전달 조건**뿐이다.
          priorAnnualInpatientDeductible: deductibles.pool,
          priorAnnualInsurancePaid: money.prior,
        });
      } else if (injectionPurpose === "general") {
        itemResult = calculateGen2026Item({
          route: "special_item", coverage: "non_benefit", severity: "critical",
          item: "injection", injectionPurpose: "general", lines: specialLines,
          priorAnnualCoveredCount: coveredSoFar,
          priorAnnualInsurancePaid: money.prior,
        });
      } else if (injectionPurpose !== "") {
        itemResult = calculateGen2026Item({
          ...generalCommon, severity: "critical", item: "injection", injectionPurpose,
          priorAnnualOutpatientVisits: outVisits,
        } satisfies Gen2026CriticalExceptionalInjectionInput);
      }
    } else if (specialItem === "mri") {
      itemResult = calculateGen2026Item({
        route: "special_item", coverage: "non_benefit", severity: "non_critical",
        item: "mri", lines: specialLines,
        priorAnnualInsurancePaid: money.prior,
      });
    } else if (specialItem === "injection") {
      itemResult = calculateGen2026Item({
        ...generalCommon, severity: "non_critical", item: "injection",
        priorAnnualOutpatientDays: outDays,
      } satisfies Gen2026NonCriticalInjectionInput);
    } else if (specialItem === "musculoskeletal_esw") {
      itemResult = calculateGen2026Item({
        ...generalCommon, severity: "non_critical", item: "musculoskeletal_esw",
        priorAnnualOutpatientDays: outDays,
      } satisfies Gen2026NonCriticalMskInput);
    }
  }

  // ── 상급병실료 차액 ─────────────────────────────────────────────────
  let roomResult: Gen2026ItemClaimResult | null = null;
  // showRoomChargeForm이 이미 질환 구분·원인 선택을 포함한다(TS도 cause를 Cause로 좁힌다).
  if (money !== null && showRoomChargeForm && !rcIncomplete) {
    roomResult = calculateGen2026Item({
      route: "room_charge", coverage: "non_benefit", cause, severity,
      stays: rcRows.map((r) => ({
        roomChargeTotal: roomChargeAmount(r.amount) as number,
        inpatientDays: positiveDays(r.days) as number,
      })),
      priorAnnualInsurancePaid: money.prior,
      annualCoverageLimit: money.annual,
    });
  }

  // ── 급여 / 일반 비급여 ──────────────────────────────────────────────
  //   ⚠ 진료비가 하나라도 무효면 이 묶음의 엔진 호출을 막는다. 유효 행만 모아 부분합을
  //     만들지 않는다 — 부분합은 사용자가 입력한 총 진료비가 아니고, 무효 행이 어떤 금액이었는지
  //     계산기가 알 수 없기 때문이다. (5세대에서 진료비 0원 행은 횟수·일수를 소진하지 않는다.)
  //   ⚠ 급여는 세 금액을 쓰지 않으므로 `money`로 막지 않는다 — 비급여 분기에만 건다.
  const plainResult = amountsIncomplete
    ? null
    : coverage === "benefit"
    ? calculateMany2026({
        cause: benefitCause, coverage: "benefit", visit, tier: benefitTier,
        nhisCoinsuranceRate: visit === "outpatient" && nhisRate !== "" ? Math.min(100, num(nhisRate)) / 100 : undefined,
        amounts: amounts.map((a) => gen2026Amount(a) as number),
      })
    : money !== null && deductibles !== null && nonBenefitItem === "general" && severity !== "" && cause !== "" && !needsTier
      && !needsOutDays && !needsOutVisits
      ? calculateMany2026({
          cause, coverage: "non_benefit", visit, severity, nonBenefitItem: "general",
          tier: visit === "inpatient" ? nbInpatientTier || undefined : undefined,
          amounts: amounts.map((a) => gen2026Amount(a) as number),
          priorAnnualInsurancePaid: money.prior,
          priorAnnualDeductible: deductibles.general,
          outpatientCoverageLimit: money.out,
          priorAnnualOutpatientVisits: severity === "critical" && visit === "outpatient"
            ? outpatientVisits(priorVisits) ?? undefined : undefined,
          priorAnnualOutpatientDays: severity === "non_critical" && visit === "outpatient"
            ? outpatientDays(priorOutDays) ?? undefined : undefined,
          annualCoverageLimit: money.annual,
        })
      : null;

  const result: Gen2026ItemClaimResult | ReturnType<typeof calculateMany2026> | null =
    itemResult ?? roomResult ?? plainResult;
  // ⚠ 타입 단언 없이 route로만 좁힌다.
  const special = itemResult !== null && itemResult.route === "special_item" ? itemResult : null;
  const room = roomResult !== null && roomResult.route === "room_charge" ? roomResult : null;

  const setRow = (i: number, patch: Partial<SpecialRow>) =>
    setRows((old) => old.map((r, j) => j === i ? { ...r, ...patch } : r));
  const setRcRow = (i: number, patch: Partial<RoomChargeRow>) =>
    setRcRows((old) => old.map((r, j) => j === i ? { ...r, ...patch } : r));

  return <div className="card mt-8">
    <h2 className="text-xl font-bold text-slate-900">여러 건 합산 계산</h2>
    <p className="mt-2 text-sm text-slate-600">연간 한도와 공제금액 상한을 건 사이에 이어서 계산합니다. 연간 기준은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b>입니다.</p>
    <p className="mt-2 text-sm text-slate-600">일반 비급여의 연간 보험가입금액은 약관상 <b>상해비급여·질병비급여 각각에 대해 따로</b> 정해집니다. 입력한 모든 행과 기존 지급보험금·누적 공제금액이 <b>같은 원인 보장축</b>의 것이어야 하며, 다른 원인의 청구는 따로 계산해 주세요. 반면 <b>별도 보장종목</b>(3대비급여·비중증 MRI)의 한도는 상해와 질병을 <b>합산</b>하므로 원인을 나누지 않습니다.</p>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {coverage === "benefit" && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={benefitCause} onChange={(e) => setBenefitCause(e.target.value as Cause)}><option value="disease">질병</option><option value="injury">상해</option></select></label>}
      {(showGeneralForm || showRoomChargeCause) && <label className="text-sm font-semibold">원인<select className="input-base mt-1" value={cause} onChange={(e) => setCause(e.target.value as Cause | "")}><option value="">선택해 주세요</option><option value="disease">질병</option><option value="injury">상해</option></select></label>}
      <label className="text-sm font-semibold">급여 구분<select className="input-base mt-1" value={coverage} onChange={(e) => setCoverage(e.target.value as Coverage)}><option value="benefit">급여</option><option value="non_benefit">비급여</option></select></label>
      {!showSpecialForm && !isRoomCharge && <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={visit} onChange={(e) => setVisit(e.target.value as Visit)}><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>}
      {coverage === "non_benefit" && <label className="text-sm font-semibold">치료유형<select className="input-base mt-1" value={nonBenefitItem} onChange={(e) => setNonBenefitItem(e.target.value as Gen2026NonBenefitItem | "")}><option value="">선택해 주세요</option>{NON_BENEFIT_ITEMS.map((it) => <option key={it} value={it}>{GEN2026_NON_BENEFIT_ITEM_LABEL[it]}</option>)}</select></label>}
      {coverage === "non_benefit" && nonBenefitItem !== "" && <label className="text-sm font-semibold">질환 구분<select className="input-base mt-1" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}><option value="">선택해 주세요</option><option value="critical">중증</option><option value="non_critical">비중증</option></select></label>}
      {coverage === "non_benefit" && nonBenefitItem === "injection" && severity === "critical" && <label className="text-sm font-semibold">약제 용도<select className="input-base mt-1" value={injectionPurpose} onChange={(e) => setInjectionPurpose(e.target.value as Gen2026InjectionPurpose | "")}><option value="">선택해 주세요</option>{INJECTION_PURPOSES.map((p) => <option key={p} value={p}>{GEN2026_INJECTION_PURPOSE_LABEL[p]}</option>)}</select></label>}
      {coverage === "benefit" && visit === "outpatient" && <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={benefitTier} onChange={(e) => setBenefitTier(e.target.value as Tier)}><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
      {showGeneralForm && severity !== "" && visit === "inpatient" && <label className="text-sm font-semibold">입원 의료기관<select className="input-base mt-1" value={nbInpatientTier} onChange={(e) => setNbInpatientTier(e.target.value as Tier | "")}><option value="">선택해 주세요</option><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>}
      {showSpecialForm && specialItem === "musculoskeletal_esw" && <label className="text-sm font-semibold">보상 승인 회차<select className="input-base mt-1" value={approvedThrough} onChange={(e) => setApprovedThrough(Number(e.target.value) as Gen2026MskApprovedThrough)}>{GEN2026_MSK_APPROVED_THROUGH_VALUES.map((v) => <option key={v} value={v}>{v}회까지</option>)}</select></label>}
    </div>

    {coverage === "benefit" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">건강보험 본인부담률 (%)<input className="input-base mt-1" type="number" min="0" max="100" step="0.1" value={nhisRate} onChange={(e) => setNhisRate(e.target.value)} /></label>}

    {coverage === "non_benefit" && <div className="mt-4"><NoticeBox variant="info">5세대 비급여는 보장종목이 나뉘어 있습니다. <b>중증</b>의 근골격계 이학요법·체외충격파, 비급여 주사료(일반 주사), 비급여 MRI는 특별약관1 (3)3대비급여이고, <b>비중증</b>의 비급여 MRI는 특별약관2 (3)의 별도 보장종목입니다. 반대로 <b>비중증</b> 근골격계·주사료와 항암제·항생제(항진균제 포함)·희귀의약품을 위한 <b>중증</b> 주사료는 약관이 일반 상해·질병 비급여에서 보상합니다. <b>상급병실료 차액</b>은 같은 표의 별도 행이라 <b>차액의 50%·1일 평균 보험금 10만 원 한도</b>로 따로 계산합니다.</NoticeBox></div>}
    {isRoomCharge && <div className="mt-4"><NoticeBox variant="info">입력할 금액은 전체 병실료가 아니라 <b>실제 사용 병실과 기준병실의 비급여 차액</b>입니다(특별약관1 제2조). 약관의 입원 보상금액은 &lsquo;비급여 의료비(<b>비급여 병실료는 제외</b>합니다)&rsquo;이므로 <b>일반 입원 의료비와 합쳐 넣지 마세요</b>. <b>1행은 1회의 입원</b>이며, 보험금은 차액의 <b>50%</b>이고 <b>1일 평균 보험금 10만 원</b>이 한도입니다.</NoticeBox></div>}
    {showRoomChargeForm && <div className="mt-4"><NoticeBox variant="info">연간 보험가입금액은 약관상 <b>상해비급여·질병비급여 각각</b>, <b>중증·비중증 보장축별로</b> 계약 시 정한 금액입니다(특별약관1·2 제5조 제1항). 상급병실료 차액은 일반 입원·통원 보상금액과 <b>같은 한도를 나눠 씁니다</b>. 병실 변경·부분일·외박·복수 병원 입원의 일수 판단은 약관에 정의가 없어 계산기가 하지 않습니다. 계약 종료 후 180일 계속 입원과 공제금액 상한 500만 원은 이 계산에 반영하지 않았습니다.</NoticeBox></div>}
    {route === "general" && <div className="mt-4"><NoticeBox variant="info">{severity === "critical" ? "항암제·항생제(항진균제 포함)·희귀의약품을 위해 사용된 비급여 주사료는 약관상 3대비급여가 아니라 상해비급여·질병비급여에서 보상합니다(특별약관1 제3조(3)제2항). 일반 비급여 입력으로 전환했습니다." : `비중증 ${GEN2026_SPECIAL_ITEM_LABEL[specialItem ?? "injection"]}는 약관상 별도 보장종목이 아니라 상해비급여·질병비급여에서 보상합니다(특별약관2 제3조 (1)제1항·(2)제1항 — 배제 대상은 비급여 자기공명영상진단뿐입니다). 일반 비급여 입력으로 전환했습니다.`}</NoticeBox></div>}

    {/* ── 일반 비급여 입력 (일반 비급여 + 일반 경로로 전환된 조합) ── */}
    {showGeneralForm && severity !== "" && visit === "outpatient" && <div className="mt-4"><NoticeBox variant="info">{severity === "non_critical" ? "비중증 통원은 약관상 '통원 1일당(외래 및 처방·조제비 합산)' 기준입니다. 같은 날 청구는 한 행으로 합쳐 입력해 주세요." : "약관은 ①동일한 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원을 각각 1회의 통원으로 봅니다. 이 경우에만 한 행으로 합쳐 입력해 주세요. 치료 목적이 다르거나 다른 의료기관이면 행을 나눠 입력합니다."}</NoticeBox></div>}
    {/* ⚠ 축이 정해진 뒤에만 노출한다. 원인을 고르기 전에는 어느 보장축의 계약값인지 정할 수
           없어, 입력을 받아도 어디에 넣을지 알 수 없다(제5조③은 상해·질병 각각으로 정한다).
           화면 순서 강제(①치료유형 → ②질환 구분 → ③원인 → ④입력)와 같은 취지다. */}
    {showGeneralForm && generalAxis !== null && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">통원 가입금액 ({generalAxisLabel(generalAxis)} 보장축, 선택)<div className="mt-1">{/* ⚠ 맨 <input>이 아니라 원문 보존 위젯을 쓴다. 공용 위젯 파일은 고치지 않는다.
                     같은 필드가 서로 배타적인 세 폼에 나타나므로 id는 필드마다 하나씩만 둔다 —
                     한 번에 하나만 렌더되고, 셋을 구분해야 하는 것은 필드이지 폼이 아니다. */}<RawAmountInput id="gen2026-outpatient-limit" value={outpatientLimit}
        onChange={setOutpatientLimit} placeholder="예: 200000 — 모르면 비워두세요"
        ariaLabel={`통원 가입금액 (${generalAxisLabel(generalAxis)} 보장축)`} /></div><span className="mt-2 block text-xs font-normal text-slate-500">약관상 20만 원 이내에서 계약 시 정한 금액이며 <b>{generalAxisLabel(generalAxis)}</b> 보장축에 대해 따로 정해집니다(특별약관1·2 제5조 제3항). 중증은 <b>1회당</b>, 비중증은 <b>1일당</b>으로 단위가 다릅니다. 입력하지 않으면 적용하지 않습니다.</span></label>}
    {showGeneralForm && generalAxis !== null && <label className="mt-4 block max-w-sm text-sm font-semibold">연간 보험가입금액 ({generalAxisLabel(generalAxis)} 보장축, 선택)<div className="mt-1"><RawAmountInput id="gen2026-annual-limit" value={annualLimit}
        onChange={setAnnualLimit} placeholder={severity === "critical" ? "예: 50000000 — 모르면 비워두세요" : "예: 10000000 — 모르면 비워두세요"}
        ariaLabel={`연간 보험가입금액 (${generalAxisLabel(generalAxis)} 보장축)`} /></div><span className="mt-2 block text-xs font-normal text-slate-500">약관은 {severity === "critical" ? "5천만" : "1천만"} 원 <b>이내에서 계약 시 정한 금액</b>으로 규정하며, <b>{generalAxisLabel(generalAxis)}</b> 보장축에 대해 따로 정해집니다(특별약관1·2 제5조 제1항). 입원과 통원은 이 축 안에서 합산합니다. 입력하지 않으면 적용하지 않습니다.</span></label>}
    {showGeneralForm && severity === "non_critical" && visit === "inpatient" && <div className="mt-4"><NoticeBox variant="info">비중증 입원의 <b>1회당 300만 원 한도</b>는 「의료법」 제3조제2항 의료기관 중 <b>종합병원을 제외한 곳</b>(병·의원급)에서 발생한 비급여 의료비에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항). 상급종합·종합병원 입원에는 적용하지 않습니다.</NoticeBox></div>}
    {showGeneralForm && severity === "critical" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">계약해당일 기준 1년간 이미 사용한 통원 횟수<input className="input-base mt-1" inputMode="numeric" value={priorVisits} onChange={(e) => setPriorVisits(e.target.value)} placeholder="이전 통원이 없으면 0" /><span className="mt-2 block text-xs font-normal text-slate-500">중증 통원은 약관상 <b>계약일 또는 매년 계약해당일부터 1년간 통원 {GEN2026.nonBenefit.critical.outpatientAnnualVisits}회</b>가 한도입니다(특별약관1 제3조 (1)제1항·(2)제1항). 보상 단위가 <b>1회의 통원</b>이므로, ①같은 의료기관에서 같은 날 받은 외래와 처방조제, ②하루에 같은 치료를 목적으로 2회 이상 받은 통원만 <b>한 행으로 합쳐</b> 입력해 주세요.</span></label>}
    {showGeneralForm && severity === "non_critical" && visit === "outpatient" && <label className="mt-4 block max-w-sm text-sm font-semibold">계약해당일 기준 1년간 이미 사용한 통원일수<input className="input-base mt-1" inputMode="numeric" value={priorOutDays} onChange={(e) => setPriorOutDays(e.target.value)} placeholder="이전 통원이 없으면 0" /><span className="mt-2 block text-xs font-normal text-slate-500">비중증 통원은 약관상 <b>계약일 또는 매년 계약해당일부터 1년간 통원 {GEN2026.nonBenefit.nonCritical.outpatientAnnualDays}일</b>이 한도입니다(특별약관2 제3조 (1)제1항·(2)제1항). 보상 단위가 <b>통원 1일당</b>이므로, 같은 날 외래와 처방·조제비는 <b>한 행으로 합쳐</b> 입력해 주세요. 같은 날을 여러 행으로 나누면 일수가 실제보다 빨리 소진됩니다.</span></label>}

    {/* ── 특별약관 입력 안내 ── */}
    {showSpecialForm && specialItem !== null && <div className="mt-4"><NoticeBox variant="info">{specialItem === "injection"
      ? "비급여 주사료는 1회 통원(또는 1회 입원)에서 2회 이상 주사치료를 받아도 1회로 봅니다(특별약관1 제3조(3)제4항제2호). 같은 1회 안의 주사료는 합산해 한 행에 입력해 주세요."
      : specialItem === "musculoskeletal_esw"
        ? "근골격계 이학요법·체외충격파는 치료행위마다 공제금액과 한도를 각각 적용합니다(특별약관1 제3조(3)제4항제1호). 2종류 이상을 받았거나 같은 치료를 2회 이상 받았다면 행을 나눠 입력해 주세요."
        : "비급여 MRI는 진단행위마다 공제금액과 한도를 각각 적용합니다(제3조(3)제4항제3호 / 특별약관2 제3조(3)제3항). 2개 이상 부위를 촬영했거나 같은 부위를 2회 이상 촬영했다면 행을 나눠 입력해 주세요."}</NoticeBox></div>}
    {showSpecialForm && specialItem === "musculoskeletal_esw" && <div className="mt-4"><NoticeBox variant="info">약관은 각 치료횟수를 합산해 <b>최초 10회</b>를 보장하고, 이후에는 증상의 개선·병변호전 등이 확인된 경우에 한하여 <b>10회 단위</b>로 연간 50회까지 보상합니다(특별약관1 제3조(3)제1항 &lt;표1&gt; 주)). 이 계산기는 증상 개선 여부를 판정하지 않습니다. 보험사에서 확인된 승인 회차를 선택해 주세요.</NoticeBox></div>}

    {/* ── 입력 행 ── */}
    {showRoomChargeForm
      ? <>
        <div className="mt-5 space-y-3">{rcRows.map((row, i) => <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4" key={i}>
          <label className="text-sm font-semibold">{i + 1}번째 입원의 상급병실료 차액 총액<input className="input-base mt-1" inputMode="numeric" value={row.amount} onChange={(e) => setRcRow(i, { amount: e.target.value })} /></label>
          <label className="text-sm font-semibold">총 입원일수<input className="input-base mt-1" inputMode="numeric" value={row.days} onChange={(e) => setRcRow(i, { days: e.target.value })} placeholder="예: 10" /></label>
          <span />
          <button className={smallButton} disabled={rcRows.length === 1} onClick={() => setRcRows((old) => old.filter((_, j) => j !== i))}>삭제</button>
        </div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setRcRows((old) => [...old, { amount: "", days: "" }])}>입원 추가</button></div>
      </>
      : showSpecialForm
      ? <>
        <div className="mt-5 space-y-3">{rows.map((row, i) => <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4" key={i}>
          <label className="text-sm font-semibold">{i + 1}번째 {specialItem === "injection" ? "1회 주사료 합산액" : "행위 진료비"}
            <div className="mt-1"><RawAmountInput id={`gen2026-row-amount-${i}`} value={row.amount}
              onChange={(v) => setRow(i, { amount: v })} placeholder="예: 300,000"
              ariaLabel={`${i + 1}번째 ${specialItem === "injection" ? "1회 주사료 합산액" : "행위 진료비"}`} /></div>
          </label>
          <label className="text-sm font-semibold">치료 형태<select className="input-base mt-1" value={row.visit} onChange={(e) => setRow(i, { visit: e.target.value as Visit | "" })}><option value="">선택</option><option value="outpatient">통원</option><option value="inpatient">입원</option></select></label>
          {needsRowTier && row.visit === "inpatient"
            ? <label className="text-sm font-semibold">의료기관<select className="input-base mt-1" value={row.tier} onChange={(e) => setRow(i, { tier: e.target.value as Tier | "" })}><option value="">선택</option><option value="clinic">병·의원급</option><option value="hospital">상급종합·종합병원</option></select></label>
            : <span />}
          <button className={smallButton} disabled={rows.length === 1} onClick={() => setRows((old) => old.filter((_, j) => j !== i))}>삭제</button>
        </div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setRows((old) => [...old, emptyRow()])}>행 추가</button></div>
      </>
      : <>
        <div className="mt-5 space-y-3">{amounts.map((amount, i) => <div className="flex items-end gap-2" key={i}>
          <label className="flex-1 text-sm font-semibold">{i + 1}건 진료비
            <div className="mt-1"><RawAmountInput id={`gen2026-amount-${i}`} value={amount}
              onChange={(v) => setAmounts((old) => old.map((prev, j) => j === i ? v : prev))}
              placeholder="예: 300,000" ariaLabel={`${i + 1}건 진료비`} /></div>
          </label>
          <button className={smallButton} disabled={amounts.length === 1} onClick={() => setAmounts((old) => old.filter((_, j) => j !== i))}>삭제</button>
        </div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => setAmounts((old) => [...old, ""])}>행 추가</button><input className="input-base w-20" inputMode="numeric" autoComplete="off" value={copyCount} onChange={(e) => setCopyCount(e.target.value)} aria-label="복사할 횟수" /><button className={smallButton} disabled={copySourceInvalid || copyCountInvalid} onClick={() => {
          // ⚠ 버튼 비활성만으로는 부족하다. 핸들러에서도 원본을 다시 검증한다.
          if (copySourceInvalid) return;
          // ⚠ 무효한 횟수로 실행되면 종전처럼 **이미 입력한 행이 지워지고 1행만 남는다.**
          if (copyCountNum === null) return;
          setAmounts(Array.from({ length: copyCountNum }, () => amounts[0] ?? ""));
        }}>첫 금액 × N회</button></div>
        {copySourceInvalid && <p className="mt-2 text-xs text-slate-500">1건 진료비를 올바르게 입력하면 복제할 수 있습니다. 실제로 0원이면 <b>0</b>을 입력하세요.</p>}
        {/* ⚠ 경고 상자를 새로 띄우지 않는다. 버튼 비활성과 짧은 입력 안내로 충분하고,
               이미 입력한 행과 계산 결과는 그대로 둔다. */}
        {copyCountInvalid && <p className="mt-2 text-xs text-slate-500">복사할 횟수는 <b>1</b>부터 <b>{GEN2026_MAX_COPIES}</b>까지의 정수여야 합니다. 계산기가 임의로 1이나 {GEN2026_MAX_COPIES}로 바꾸지 않으며, 이미 입력한 행은 그대로 둡니다.</p>}
      </>}

    {/* ── 누적 입력 ── */}
    {showGeneralForm && generalAxis !== null && <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">계약해당일 기준 1년간 기존 지급보험금 ({generalAxisLabel(generalAxis)} 보장축)<div className="mt-1"><RawAmountInput id="gen2026-prior-insurance" value={priorInsurance}
        onChange={setPriorInsurance} ariaLabel={`계약해당일 기준 1년간 기존 지급보험금 (${generalAxisLabel(generalAxis)} 보장축)`} /></div><span className="mt-2 block text-xs font-normal text-slate-500">이 축에 이미 지급된 보험금입니다. <b>같은 {generalAxisLabel(generalAxis)} 보장축의 일반 입원·통원과 상급병실료 차액 지급액을 모두 포함</b>해 주세요 — 셋 다 (1)(2) 보장종목의 같은 연간 보험가입금액을 씁니다. 다른 질환 구분·원인의 지급액과 3대비급여·비급여 MRI의 지급액은 이 축에 누적되지 않습니다.</span></label>{usesPriorDeductible && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액<div className="mt-1"><RawAmountInput id="gen2026-prior-deductible" value={priorDeductible}
        onChange={setPriorDeductible} ariaLabel="계약해당일 기준 1년간 이미 누적된 공제금액" /></div></label>}<p className="text-xs text-slate-500 sm:col-span-2">연간 한도와 공제금액 상한은 약관상 <b>계약일 또는 매년 계약해당일부터 1년</b> 단위로 누적됩니다(표준약관 특별약관1·2 제5조 제2항). 역년 기준이 아닙니다. 500만 원 상한에 누적되는 것은 약관상 <b>공제금액</b>이며, 보험가입금액 한도로 추가 부담한 금액은 포함되지 않습니다.</p></div>}
    {showRoomChargeForm && <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">계약해당일 기준 1년간 기존 지급보험금 ({generalAxis === null ? "" : generalAxisLabel(generalAxis)} 보장축, 선택)<div className="mt-1"><RawAmountInput id="gen2026-prior-insurance" value={priorInsurance}
        onChange={setPriorInsurance} ariaLabel={`계약해당일 기준 1년간 기존 지급보험금 (${generalAxis === null ? "" : generalAxisLabel(generalAxis)} 보장축)`} /></div></label>
      <label className="text-sm font-semibold">연간 보험가입금액 ({generalAxis === null ? "" : generalAxisLabel(generalAxis)} 보장축, 선택)<div className="mt-1"><RawAmountInput id="gen2026-annual-limit" value={annualLimit}
        onChange={setAnnualLimit} placeholder={severity === "critical" ? "예: 50000000 — 모르면 비워두세요" : "예: 10000000 — 모르면 비워두세요"}
        ariaLabel={`연간 보험가입금액 (${generalAxis === null ? "" : generalAxisLabel(generalAxis)} 보장축)`} /></div></label>
      <p className="text-xs text-slate-500 sm:col-span-2">약관은 {severity === "critical" ? "5천만" : "1천만"} 원 <b>이내에서 계약 시 정한 금액</b>으로 규정합니다. 입력하지 않으면 적용하지 않습니다. 상급병실료 차액은 (1)(2) 표 안의 한 행이라 <b>일반 입원·통원과 같은 연간 보험가입금액을 공유</b>합니다. 그래서 위 두 값은 <b>일반 화면과 같은 보장축 상태</b>이며, 기존 지급보험금에는 <b>같은 축의 일반 입원·통원과 상급병실료 지급액을 모두 포함</b>해 주세요.</p>
    </div>}
    {showSpecialForm && <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">계약해당일 기준 1년간 이 보장종목의 기존 지급보험금 ({itemAxis === null ? "" : GEN2026_ITEM_AXIS_LABEL[itemAxis]})<div className="mt-1"><RawAmountInput id="gen2026-prior-insurance" value={priorInsurance}
        onChange={setPriorInsurance} ariaLabel={`계약해당일 기준 1년간 이 보장종목의 기존 지급보험금 (${itemAxis === null ? "" : GEN2026_ITEM_AXIS_LABEL[itemAxis]})`} /></div><span className="mt-2 block text-xs font-normal text-slate-500">이 보장종목의 연간 보장한도에 이미 지급된 보험금만 넣어 주세요. 약관은 <b>각 비급여의료비별 보장한도</b>로 정하고(제5조①단서·③) <b>상해·질병을 합산</b>하므로(&lt;표1&gt;), 원인을 나누지 않고 이 항목 하나로 누적합니다. 일반 (1)(2)의 입원·통원·상급병실료 지급액은 여기에 넣지 않습니다.</span></label>
      {/* ⚠ 노출·검증·전달이 모두 같은 `countedItem` 판정을 쓴다. 종전에는 `specialItem`만 보아
             항암제 등 일반 (1)(2) 경로로 넘어가는 주사료에도 칸이 남았고, 상태가 하나뿐이라
             근골격계에 넣은 횟수가 주사료로 그대로 넘어갔다.
             ⚠ 라벨에 보장종목 이름을 넣는다 — 어느 종목의 과거 횟수인지 화면에서 구분돼야 한다.
             ⚠ 안내 문구는 **계산기가 이 입력을 어떻게 쓰는지**만 말한다. 확인한 범위는 등록된
                항목별 한도(<표1>의 서로 다른 행)와 엔진의 항목별 비교까지이고, 두 보장종목의
                횟수가 약관상 서로 독립적으로 소진된다는 문장은 원문에서 직접 읽어 확인하지
                않았다. 화면에서 그보다 강하게 단정하지 않는다.
             ⚠ `type="number"`가 아니라 원문 보존 입력이다. `type="number"`는 `1e3`·`-1`을
                그대로 통과시키면서 화면에는 원문을 남겨, 보이는 값과 계산에 쓰는 값이 갈렸다. */}
      {countedItem !== null && <label className="text-sm font-semibold">계약해당일 기준 1년간 <b>{GEN2026_SPECIAL_ITEM_LABEL[countedItem]}</b>로 이미 <b>보상한 횟수</b> (연 {GEN2026_COUNTED_ITEM_ANNUAL_VISITS[countedItem]}회 한도용)<input className="input-base mt-1" inputMode="numeric" autoComplete="off" value={priorCountRaw} onChange={(e) => setPriorCountByItem((old) => ({ ...old, [countedItem]: e.target.value }))} placeholder="보상받은 적이 없으면 0" aria-label={`${GEN2026_SPECIAL_ITEM_LABEL[countedItem]}로 이미 보상한 횟수`} /><span className="mt-2 block text-xs font-normal text-slate-500">이 칸은 <b>보장종목마다 따로</b> 입력받습니다. 계산기는 지금 고른 보장종목의 값만 그 종목의 연 {GEN2026_COUNTED_ITEM_ANNUAL_VISITS[countedItem]}회 한도에 적용하고 다른 보장종목의 값을 대신 쓰지 않으며, 종목을 바꾸면 각자 입력한 값이 그대로 남습니다.</span></label>}
      {specialItem === "musculoskeletal_esw" && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 받은 <b>치료행위 수</b> (보상 승인 회차용)<input className="input-base mt-1" inputMode="numeric" value={priorActs} onChange={(e) => setPriorActs(e.target.value)} placeholder="받은 치료가 없으면 0" /><span className="mt-2 block text-xs font-normal text-slate-500">약관은 보상 승인 회차를 <b>&lsquo;각 치료횟수&rsquo;</b>로 셉니다(&lt;표1&gt; 주)). 위의 <b>보상한 횟수</b>는 보험금이 지급된 횟수라, 공제금액에 못 미쳐 <b>0원이 지급된 치료</b>가 있으면 두 값이 달라집니다. 보험사에서 확인한 값을 입력해 주세요.</span></label>}
      {/* ⚠ `needsRowTier`가 아니라 `usesPriorPool`을 쓴다. 종별 선택창과 미선택 차단은
             `needsRowTier` 그대로이고, 이 입력만 실제 소진 대상 행이 있을 때 노출한다. */}
      {usesPriorPool && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액 (500만 원 상한)<div className="mt-1"><RawAmountInput id="gen2026-prior-pool" value={priorPool}
        onChange={setPriorPool} ariaLabel="계약해당일 기준 1년간 이미 누적된 공제금액 (500만 원 상한)" /></div></label>}
      <p className="text-xs text-slate-500 sm:col-span-2">보험계약이 종료된 뒤에도 <b>계속 중인 치료</b>는 연간 보장한도(금액)에서 <b>지급한 금액</b>을, 연간 보장한도(횟수)에서 <b>보상한 횟수</b>를 뺀 잔여분을 한도로 보상합니다(특별약관1 제3조(3)제7항·제5조 제4항 — 이월 계산 전용이며, 보험기간 중 연간 한도의 소진 기준을 정하는 조항이 아닙니다). 일반 비급여의 통원 가입금액(20만 원)과 연간 보험가입금액은 이 보장종목에 적용되지 않습니다.</p>
    </div>}

    <button className="btn-primary mt-6" onClick={() => setSubmitted(true)}>여러 건 계산하기</button>
    {submitted && needsItem && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>치료유형</b>에 따라 적용되는 보장종목과 산식이 다릅니다. 치료유형을 먼저 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsSeverity && <div className="mt-5"><NoticeBox variant="warning">비급여는 <b>중증 / 비중증</b>에 따라 자기부담률과 한도가 다릅니다. 질환 구분을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsPurpose && <div className="mt-5"><NoticeBox variant="warning">비급여 주사료는 <b>약제 용도</b>에 따라 보상하는 보장종목이 달라집니다(특별약관1 제3조(3)제2항). 약제 용도를 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && rcIncomplete && <div className="mt-5"><NoticeBox variant="warning">각 입원의 <b>차액 총액</b>과 <b>총 입원일수</b>를 올바르게 입력해 주세요. 차액 총액은 <b>0 이상의 숫자</b>, 총 입원일수는 <b>1 이상의 정수</b>여야 합니다. 음수·문자가 섞인 값은 계산기가 임의로 고치지 않고, 약관에 일수 산정 방법이 정해져 있지 않아 일수도 추정하지 않습니다. 올바르게 입력하기 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && amountsIncomplete && <div className="mt-5"><NoticeBox variant="warning">{badAmountRows.join("·")}번째 행의 <b>진료비</b>를 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>300000</b> 또는 <b>300,000</b> 형식입니다. 진료비가 실제로 0원이면 <b>0</b>을 입력하세요. 빈 값이나 잘못된 입력(음수·소수·문자·지수 표기·잘못된 쉼표)을 계산기가 <b>임의로 다른 금액으로 바꾸지 않으며</b>, 빈 값을 0원으로 보지도 않습니다. <b>모든 행에 올바른 진료비를 입력해야 계산할 수 있습니다.</b> 유효한 행만 모아 부분합을 내지도 않습니다.</NoticeBox></div>}
    {submitted && rowAmountsIncomplete && <div className="mt-5"><NoticeBox variant="warning">{badRowAmounts.join("·")}번째 행의 <b>{specialItem === "injection" ? "1회 주사료 합산액" : "행위 진료비"}</b>을(를) 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>300000</b> 또는 <b>300,000</b> 형식입니다. 실제로 0원이면 <b>0</b>을 입력하세요. 빈 값이나 잘못된 입력(음수·소수·문자·지수 표기·잘못된 쉼표)을 계산기가 <b>임의로 다른 금액으로 바꾸지 않으며</b>, 빈 값을 0원으로 보지도 않습니다. <b>모든 행에 올바른 진료비를 입력해야 계산할 수 있습니다.</b> 유효한 행만 모아 부분합을 내지도 않습니다.</NoticeBox></div>}
    {submitted && needsTier && <div className="mt-5"><NoticeBox variant="warning">비급여 <b>입원</b>은 <b>의료기관 종별</b>에 따라 보험금이 달라집니다. 중증은 공제금액 상한 500만 원이 상급종합·종합병원 입원에만 적용되고(특별약관1 제5조 제5항), 비중증은 1회당 300만 원 한도가 병·의원급에만 적용됩니다(특별약관2 제3조 (1)제1항·(2)제1항). <b>입원 의료기관</b>을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsPriorCount && countedItem !== null && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>{GEN2026_SPECIAL_ITEM_LABEL[countedItem]}</b>로 <b>이미 보상한 횟수</b>를 입력해 주세요. 보상받은 적이 없으면 <b>0</b>을 입력하세요. 이 보장종목은 연 {GEN2026_COUNTED_ITEM_ANNUAL_VISITS[countedItem]}회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수·지수 표기·쉼표·문자는 계산하지 않습니다. 한도를 넘긴 과거 값도 그대로 받습니다.</NoticeBox></div>}
    {submitted && needsPriorActs && <div className="mt-5"><NoticeBox variant="warning">근골격계 이학요법·체외충격파는 최초 10회 이후 증상의 개선·병변호전이 확인된 경우에 한하여 10회 단위로 보상합니다(특별약관1 제3조(3)제1항 &lt;표1&gt; 주)). 승인 회차는 약관상 <b>&lsquo;각 치료횟수&rsquo;</b>로 세므로, 계약해당일 기준 1년간 <b>이미 받은 치료행위 수</b>를 입력해 주세요. 받은 치료가 없으면 <b>0</b>을 입력하시면 됩니다. <b>보상한 횟수</b>는 보험금이 지급된 횟수라 대신 쓰지 않으며, 입력 전에는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsOutDays && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 사용한 통원일수</b>를 입력해 주세요. 이전 통원이 없으면 <b>0</b>을 입력하세요. 비중증 통원은 연 {GEN2026.nonBenefit.nonCritical.outpatientAnnualDays}일이 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsOutVisits && <div className="mt-5"><NoticeBox variant="warning">계약해당일 기준 1년간 <b>이미 사용한 통원 횟수</b>를 입력해 주세요. 이전 통원이 없으면 <b>0</b>을 입력하세요. 중증 통원은 연 {GEN2026.nonBenefit.critical.outpatientAnnualVisits}회가 한도라 이 값이 있어야 계산할 수 있고, 계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수는 계산하지 않습니다.</NoticeBox></div>}
    {submitted && needsCause && <div className="mt-5"><NoticeBox variant="warning">일반 상해·질병 비급여는 약관상 <b>상해비급여·질병비급여 각각</b>에 대해 연간 보험가입금액과 누적이 따로 정해집니다(특별약관1·2 제5조 제1항). <b>원인</b>을 선택해 주세요. 선택 전에는 계산하지 않습니다.</NoticeBox></div>}
    {/* ⚠ 여러 입력이 동시에 무효이면 각각 안내한다. 활성 경로가 실제로 쓰는 입력만 판정하므로,
           숨은 축이나 이 경로가 쓰지 않는 입력 때문에 안내가 뜨지 않는다. */}
    {submitted && priorInsuranceInvalid && <div className="mt-5"><NoticeBox variant="warning">
      <b>기존 지급보험금</b>{paidAxis === null ? null : <>({showSpecialForm ? (itemAxis === null ? "" : GEN2026_ITEM_AXIS_LABEL[itemAxis]) : (generalAxis === null ? "" : `${generalAxisLabel(generalAxis)} 보장축`)})</>}을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>3000000</b> 또는 <b>3,000,000</b> 형식입니다. 이 축에 이미 지급된 보험금이 없으면 <b>0</b>을 입력하세요. 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다.
    </NoticeBox></div>}
    {submitted && annualLimitInvalid && <div className="mt-5"><NoticeBox variant="warning">
      <b>연간 보험가입금액</b>({generalAxis === null ? "" : `${generalAxisLabel(generalAxis)} 보장축`})을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>50000000</b> 또는 <b>50,000,000</b> 형식입니다. 이 한도를 적용하지 않으려면 <b>완전히 비워</b> 두세요. 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다.
    </NoticeBox></div>}
    {submitted && outpatientLimitInvalid && <div className="mt-5"><NoticeBox variant="warning">
      <b>통원 가입금액</b>({generalAxis === null ? "" : `${generalAxisLabel(generalAxis)} 보장축`})을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>200000</b> 또는 <b>200,000</b> 형식입니다. 이 한도를 적용하지 않으려면 <b>완전히 비워</b> 두세요. 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다.
    </NoticeBox></div>}
    {submitted && priorDeductibleInvalid && <div className="mt-5"><NoticeBox variant="warning">
      <b>이미 누적된 공제금액</b>({generalAxis === null ? "" : `${generalAxisLabel(generalAxis)} 보장축`})을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>3000000</b> 또는 <b>3,000,000</b> 형식입니다. 이미 누적된 공제금액이 없으면 <b>0</b>을 입력하세요(완전히 비운 값도 0으로 봅니다). 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다. 500만 원을 넘는 값도 그대로 받습니다 — 상한 처리는 약관 산식이 합니다.
    </NoticeBox></div>}
    {submitted && priorPoolInvalid && <div className="mt-5"><NoticeBox variant="warning">
      <b>이미 누적된 공제금액</b>(중증 비급여 MRI·MRA, 500만 원 상한)을 올바르게 입력해 주세요. <b>0 이상의 정수</b>만 받습니다 — <b>3000000</b> 또는 <b>3,000,000</b> 형식입니다. 이미 누적된 공제금액이 없으면 <b>0</b>을 입력하세요(완전히 비운 값도 0으로 봅니다). 공백만 입력한 값은 빈 값으로 보지 않습니다. 음수·소수·문자·지수 표기·잘못된 쉼표는 계산기가 임의로 고치지 않습니다. 500만 원을 넘는 값도 그대로 받습니다 — 상한 처리는 약관 산식이 합니다.
    </NoticeBox></div>}
    {submitted && rowsIncomplete && <div className="mt-5"><NoticeBox variant="warning">각 행의 <b>치료 형태</b>{needsRowTier ? <>와 입원 행의 <b>의료기관 종별</b></> : null}를 선택해 주세요.{needsRowTier ? " 중증 비급여 MRI 입원은 의료기관 종별에 따라 공제금액 상한 500만 원 적용 여부가 달라지므로 기본값으로 계산하지 않습니다." : ""}</NoticeBox></div>}
    {submitted && result && result.status === "PENDING_UNVERIFIED" && <div className="mt-5"><NoticeBox variant="warning">{result.notes.join(" ")}</NoticeBox></div>}

    {submitted && result && result.status === "OK" && result.totalAmount > 0 && <div className="mt-7">
      <ResultCard title="다회 청구 합계 (5세대 · 참고용)" items={[{ label: "총 진료비", value: won(result.totalAmount) }, { label: "총 본인부담금", value: won(result.totalOwnPay ?? 0), highlight: true }, { label: "총 보험 적용 금액", value: won(result.totalInsurancePay ?? 0) }]} />
      <div className="mt-4 overflow-x-auto">
        {room
          ? <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>입원</th><th>차액</th><th>일수</th><th>1일 평균 차액</th><th>50%</th><th>지급</th><th>본인부담</th></tr></thead><tbody>{room.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{line.inpatientDays}일</td><td>{won(line.dailyAverageRoomCharge)}</td><td>{won(line.payBeforeCaps)}</td><td>{won(line.insurancePay ?? 0)}</td><td>{won(line.ownPay ?? 0)}</td></tr>)}</tbody></table>
          : special
          ? <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>행</th><th>진료비</th><th>공제금액</th><th>본인부담</th><th>보험 적용</th><th>보상</th></tr></thead><tbody>{special.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.deductible.deductibleApplied)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td><td>{line.covered ? (line.actIndex === null ? "보상" : `${line.actIndex}회째`) : "제외"}</td></tr>)}</tbody></table>
          : <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>건</th><th>진료비</th><th>본인부담</th><th>보험 적용</th></tr></thead><tbody>{result.lines.map((line) => <tr className="border-t" key={line.index}><td className="py-2">{line.index + 1}</td><td>{won(line.amount)}</td><td>{won(line.ownPay ?? 0)}</td><td>{won(line.insurancePay ?? 0)}</td></tr>)}</tbody></table>}
      </div>
      {result.appliedCaps.length > 0 && <div className="mt-4"><NoticeBox variant="info">적용된 한도: {result.appliedCaps.map((c) => CAP_LABELS[c]).join(", ")}</NoticeBox></div>}
      {result.notes.map((note) => <div className="mt-3" key={note}><NoticeBox variant="info">{note}</NoticeBox></div>)}
    </div>}
  </div>;
}
