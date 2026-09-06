// 5세대 항목별 진입점의 공통 입력 검증 조각.
//   ⚠ 타입을 우회한 외부 값이 산식에 닿기 전에 막기 위한 것이다. 값 목록을 각 엔진에서
//     다시 나열하면 한쪽만 바뀌어도 통과하므로 여기 한 곳에만 둔다.
import { Gen2026RejectedResult } from "./types";

export const SEVERITY_VALUES: readonly string[] = ["critical", "non_critical"];
export const VISIT_VALUES: readonly string[] = ["outpatient", "inpatient"];
export const TIER_VALUES: readonly string[] = ["clinic", "hospital"];
export const CAUSE_VALUES: readonly string[] = ["injury", "disease"];

/**
 * **진료비 축 전용** 형식 검증 — 0 이상의 안전한 정수.
 *
 * ⚠ 종전의 `isNum`(= 유한한 숫자)을 대체한다. 그 가드는 **음수·소수·안전 정수 초과를
 *   통과시켰고**, 통과한 값이 하류 `normalizeAmount`(`Math.max(0, Math.floor(v))`)에서
 *   조용히 다른 금액이 됐다(엔진 직접 호출로 실측). 진료비를 0원 행으로 바꾸면 총액과
 *   행 목록이 입력과 달라진다.
 * ⚠ 사용처는 5세대 진료비 **세 곳뿐**이다 — 상급병실료 `stays[].roomChargeTotal`,
 *   별도 보장종목 `lines[].amount`, 일반 전환 경로 `amounts[]`.
 *   금액이라는 이름이 같아도 계약이 다른 축(통원·연간 가입금액, 지급보험금, 누적 공제금액)에는
 *   **쓰지 않는다.** 그 축들은 각자의 자리에서 허용 범위를 정한다.
 * ⚠ 숫자 `0`은 **유효한 청구 행**이다. 거부하지 않는다.
 * ⚠ 합계의 안전 정수 여부는 이 가드가 보지 않는다. 원소가 모두 안전해도 합계는 범위를
 *   벗어날 수 있으므로 각 진입점이 원소 검사 뒤에 따로 본다.
 */
export const isClaimAmount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export const isPositiveInt = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v > 0;
export const oneOf = (v: unknown, values: readonly string[]) =>
  typeof v === "string" && values.includes(v);

/**
 * '받은 값' 표시 전용 헬퍼. **계산에는 쓰지 않는다.**
 *
 * ⚠ `JSON.stringify`는 `bigint`·순환 참조·`toJSON()`이 던지는 객체에서 **예외를 던진다.**
 *   `rejected()`는 타입을 우회한 외부 입력을 막는 자리이므로, 그 입력이 `rejected()` 결과가
 *   아니라 런타임 예외로 끝나면 막는 의미가 없다. 그래서 표시를 단계적으로 낮춘다.
 * ⚠ 정상적으로 직렬화되는 값의 표시는 **종전과 한 글자도 같다.** `JSON.stringify`가
 *   정상적으로 `undefined`를 돌려주는 값(`undefined`·Symbol·함수)도 종전 `?? String(got)`와
 *   같은 문자열이 된다 — 낮추는 것은 **예외가 났을 때뿐**이다.
 * ⚠ 두 번째 catch는 `JSON.stringify`와 `String()`이 **모두** 실패하는 값에서만 쓰인다
 *   (예: `Object.create(null)`에 `bigint` 필드를 넣은 값). `toString()`만 던지는 보통의
 *   객체는 JSON 직렬화가 성공하므로 여기까지 오지 않는다.
 * ⚠ 결과 비교용 `fingerprint()`의 `JSON.stringify`는 이 헬퍼의 대상이 아니다.
 */
const showValue = (v: unknown): string => {
  try {
    const json = JSON.stringify(v);
    if (json !== undefined) return json;
  } catch { /* bigint·순환 참조·toJSON 예외 */ }
  try {
    return String(v);
  } catch { /* toString·[Symbol.toPrimitive]가 던지거나 없는 객체 */ }
  return "(표시할 수 없는 값)";
};

/** 입력을 신뢰할 수 없어 계산하지 않은 결과. 숫자를 만들지 않는다. */
export function rejected(what: string, got: unknown): Gen2026RejectedResult {
  return {
    route: "rejected", status: "PENDING_UNVERIFIED", generation: "2026", lines: [],
    totalAmount: 0, totalOwnPay: null, totalInsurancePay: null, appliedCaps: [],
    notes: [
      `${what} 값이 올바르지 않아 계산하지 않았습니다.`,
      `받은 값: ${showValue(got)}`,
    ],
  };
}
