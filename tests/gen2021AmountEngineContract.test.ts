// G-16 — 4세대 다회 엔진의 **진료비 입력 계약**(컨테이너 → 원소 → 합계).
//
// 종전 동작(기준선 a2141ab 엔진 직접 호출로 실측, UI 미경유):
//   `calculateMany2021`의 첫 줄이 `(input.amounts ?? []).map(normalizeAmount)`였다.
//     - `amounts`가 배열이 아니면 `.map`이 없어 **TypeError가 그대로 관통**했다
//       (문자열·숫자·객체·유사배열·불리언·bigint·순환 참조).
//     - `undefined`·`null`은 `?? []`로 **빈 묶음**이 됐다. 타입은 `amounts: number[]`로
//       필수인데 관용적 부작용이 계약처럼 굳어 있었다.
//     - 배열 원소의 무효값(음수·소수·문자열·NaN·±Infinity·null·undefined·불리언·객체·
//       배열·bigint·Symbol)은 `normalizeAmount`가 **조용히 0원 행**으로 바꿨다.
//   ⚠ 0원 행은 4세대에서 연간 횟수를 1회 소진하고 도수 승인 회차 판정(`amounts.length`)에도
//     들어간다. 그래서 무효 금액은 금액만 틀리는 것이 아니라 **횟수와 승인까지** 틀어졌다.
//     실측: 비급여 통원 과거 99회에서 `["abc", 300000]`이 유효한 두 행과 똑같이 2행을
//     한도 초과로 제외시켰고, 도수(과거 9회·승인 10회)에서도 두 행과 똑같이 차단됐다.
//   ⚠ 안전 정수 초과는 원소·합계 모두 검증이 없어 그대로 통과했다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 컨테이너·원소·합계 검증을 **다른 어떤 검사보다 앞에** 두고,
//     신뢰 가능한 총액이 없으면 부분합을 노출하지 않는다.
//   - 하지 않는다: 명시적 숫자 `0` 행의 기존 처리(계산 포함·횟수 소진·승인 회차 산입) 변경,
//     횟수·승인 회차 검증의 순서·문구 변경, `blocked()`의 기존 `totalAmount` 보존 계약 변경,
//     `priorAnnualInsurancePaid`·`priorAnnualRiderPaid`·`annualCoverageLimit`의 값 검증,
//     미사용 금액 축 stray 거부, 이 파일 기존 안내 6곳의 `JSON.stringify` 안전 표시,
//     2·3세대·5세대 엔진 변경.
//
// 최종 계약
//   컨테이너: 배열만 허용(`undefined`·`null` 포함 그 밖의 모든 값 차단)
//   빈 배열 : 허용 — 청구가 없는 묶음
//   원소    : 0 이상의 **안전한 정수**만 허용
//   합계    : `Number.isSafeInteger` 범위 안
//   무효 시 : status PENDING_UNVERIFIED / totalAmount 0 / 합계 null / lines []
import { readFileSync } from "node:fs";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { GEN2021 } from "../src/lib/insurance/engine/constants";
import { Gen2021MultiClaimInput, MultiClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

type Caught = { threw: string } | { r: MultiClaimResult };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const call = (input: unknown): Caught => {
  try { return { r: calculateMany2021(input as Gen2021MultiClaimInput) }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const notes = (x: Caught) => threw(x) ? "" : x.r.notes.join(" ");
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}/lines=${x.r.lines.length}`;
/** 신뢰 가능한 총액이 없을 때의 계약. 부분합을 노출하지 않는다. */
const isUnusable = (x: Caught) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === 0 && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && x.r.lines.length === 0 && x.r.appliedCaps.length === 0;

// 화면이 만들 수 없는 값이다 — 엔진 직접 호출 계약 전용 검사다.
const circ: Record<string, unknown> = {}; circ.self = circ;

const OUT = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", visit: "outpatient",
  priorAnnualOutpatientVisits: 0, ...extra,
});
const RIDER = (rider: string, extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", visit: "outpatient", rider,
  ...(rider === "mri" ? {} : { priorAnnualRiderVisits: 0 }), ...extra,
});

console.log("\n[G-16] 1. 정상 입력의 결과가 그대로다");
{
  for (const [label, input, want] of [
    ["비급여 통원 1건", OUT({ amounts: [300_000] }), "OK/amt=300000/own=100000/ins=200000/lines=1"],
    ["비급여 통원 2건", OUT({ amounts: [300_000, 150_000] }), "OK/amt=450000/own=145000/ins=305000/lines=2"],
    ["급여 통원", { cause: "disease", coverage: "benefit", visit: "outpatient", amounts: [300_000] }, "OK/amt=300000/own=100000/ins=200000/lines=1"],
    ["급여 입원", { cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [300_000] }, "OK/amt=300000/own=60000/ins=240000/lines=1"],
    ["비급여 입원", { cause: "disease", coverage: "non_benefit", visit: "inpatient", amounts: [300_000] }, "OK/amt=300000/own=90000/ins=210000/lines=1"],
    ["주사료", RIDER("injection", { amounts: [300_000] }), "OK/amt=300000/own=90000/ins=210000/lines=1"],
    ["MRI", RIDER("mri", { amounts: [300_000] }), "OK/amt=300000/own=90000/ins=210000/lines=1"],
    ["도수", RIDER("manual_therapy", { amounts: [300_000] }), "OK/amt=300000/own=90000/ins=210000/lines=1"],
    ["도수+승인 회차", RIDER("manual_therapy", { amounts: [300_000], approvedThroughVisit: 10 }), "OK/amt=300000/own=90000/ins=210000/lines=1"],
    ["한도·기존 지급 반영", OUT({ amounts: [300_000], annualCoverageLimit: 500_000, priorAnnualInsurancePaid: 400_000 }), "OK/amt=300000/own=200000/ins=100000/lines=1"],
  ] as [string, unknown, string][]) {
    check(`무회귀 — ${label}`, shape(call(input)) === want, shape(call(input)));
  }
  check("빈 배열은 허용된다(청구 없는 묶음)",
    shape(call(OUT({ amounts: [] }))) === "OK/amt=0/own=0/ins=0/lines=0", shape(call(OUT({ amounts: [] }))));
  // 명시적 0 행의 기존 처리는 그대로다.
  const zero = call(OUT({ amounts: [0, 300_000] }));
  check("명시적 0 행이 계산에 그대로 들어간다",
    shape(zero) === "OK/amt=300000/own=100000/ins=200000/lines=2", shape(zero));
  const zeroBurn = call(OUT({ amounts: [0, 300_000], priorAnnualOutpatientVisits: 99 }));
  check("명시적 0 행이 종전대로 횟수를 소진한다(정책 무변경)",
    !threw(zeroBurn) && zeroBurn.r.lines.length === 2 && zeroBurn.r.lines[1].covered === false,
    shape(zeroBurn));
}

console.log("\n[G-16] 2. 컨테이너 — 배열만 허용");
{
  for (const [label, v] of [
    ["undefined(미전달)", undefined], ["null", null], ["문자열 'x'", "x"], ["문자열 '300000'", "300000"],
    ["숫자 0", 0], ["숫자 300000", 300_000], ["{}", {}], ["유사배열", { 0: 300_000, length: 1 }],
    ["true", true], ["false", false], ["bigint", 1n], ["순환 참조", circ], ["Symbol", Symbol("s")],
  ] as [string, unknown][]) {
    const x = call(v === undefined ? OUT({}) : OUT({ amounts: v }));
    check(`컨테이너 ${label} → 예외 없이 차단`, isUnusable(x), shape(x));
    check(`컨테이너 ${label} → 전용 안내`,
      notes(x).includes("진료비 목록(amounts)은 배열이어야 합니다"), notes(x).slice(0, 50));
  }
  const un = call(OUT({}));
  check("⚠ undefined·null은 빈 묶음이 아니다(종전 `?? []` 관용 폐기)",
    isUnusable(un) && notes(un).includes("넘기지 않은 것과 청구가 없다는 것은 다른 상태"), notes(un).slice(0, 60));
  check("안내에 받은 값의 형식이 들어간다", notes(call(OUT({ amounts: "x" }))).includes("받은 값의 형식: string"));
}

console.log("\n[G-16] 3. 원소 — 0 이상의 안전한 정수만");
{
  for (const [label, v] of [
    ["-1", -1], ["-300000", -300_000], ["0.5", 0.5], ["300000.7", 300_000.7], ["NaN", NaN],
    ["Infinity", Infinity], ["-Infinity", -Infinity], ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1],
    ["문자열 '300000'", "300000"], ["문자열 'abc'", "abc"], ["null", null], ["undefined", undefined],
    ["true", true], ["false", false], ["{}", {}], ["[300000]", [300_000]],
    ["bigint", 300_000n], ["순환 참조", circ], ["Symbol", Symbol("s")],
  ] as [string, unknown][]) {
    const x = call(OUT({ amounts: [v] }));
    check(`원소 ${label} → 예외 없이 차단`, isUnusable(x), shape(x));
    check(`원소 ${label} → 전용 안내`,
      notes(x).includes("0 이상의 안전한 정수여야 합니다"), notes(x).slice(0, 50));
  }
  // 허용 경계
  for (const [label, v, wantAmt] of [
    ["0", 0, 0], ["1", 1, 1], ["MAX_SAFE", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ] as [string, number, number][]) {
    const x = call(OUT({ amounts: [v] }));
    check(`원소 경계 ${label} → 허용`, !threw(x) && x.r.status === "OK" && x.r.totalAmount === wantAmt, shape(x));
  }
  // 무효 행의 위치를 안내가 가리킨다.
  const second = call(OUT({ amounts: [300_000, "abc"] }));
  check("무효 행 번호를 안내한다(2번째)", notes(second).includes("2번째 진료비"), notes(second).slice(0, 40));
  check("⚠ 부분합을 노출하지 않는다([300000,'abc'] → totalAmount 0)",
    isUnusable(second) && !notes(second).includes("300,000"), shape(second));
  const first = call(OUT({ amounts: ["abc", 300_000] }));
  check("첫 무효 행에서 멈춘다(1번째)", notes(first).includes("1번째 진료비"), notes(first).slice(0, 40));
}

console.log("\n[G-16] 4. 합계 — 안전 정수 범위");
{
  const over = call(OUT({ amounts: [Number.MAX_SAFE_INTEGER, 1] }));
  check("원소는 모두 안전 정수여도 합계가 벗어나면 차단", isUnusable(over), shape(over));
  check("합계 전용 안내", notes(over).includes("진료비 합계가 안전한 정수 범위를 벗어나"), notes(over).slice(0, 50));
  check("합계 안내는 원소 안내와 다르다", !notes(over).includes("번째 진료비"));
  const over3 = call(OUT({ amounts: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] }));
  check("두 개 다 MAX_SAFE여도 차단", isUnusable(over3), shape(over3));
  const edge = call(OUT({ amounts: [Number.MAX_SAFE_INTEGER, 0] }));
  check("합계가 정확히 MAX_SAFE면 허용",
    !threw(edge) && edge.r.status === "OK" && edge.r.totalAmount === Number.MAX_SAFE_INTEGER, shape(edge));
  check("단일 MAX_SAFE도 허용", !threw(call(OUT({ amounts: [Number.MAX_SAFE_INTEGER] }))));
}

console.log("\n[G-16] 5. 검증 순서 — 금액이 횟수·승인보다 앞");
{
  // 금액이 무효이면서 횟수도 무효/미입력일 때, 금액 안내가 나가야 한다.
  const both = call({ cause: "disease", coverage: "non_benefit", visit: "outpatient", amounts: ["abc"] });
  check("금액 무효 + 횟수 미입력 → 금액 안내가 우선",
    isUnusable(both) && notes(both).includes("0 이상의 안전한 정수여야 합니다")
    && !notes(both).includes("이미 사용한 통원 횟수"), notes(both).slice(0, 60));
  const stray = call({ cause: "disease", coverage: "non_benefit", visit: "inpatient", amounts: "x", priorAnnualOutpatientVisits: 0 });
  check("컨테이너 무효 + 횟수 stray → 금액 안내가 우선",
    isUnusable(stray) && notes(stray).includes("배열이어야 합니다")
    && !notes(stray).includes("일반 통원 횟수"), notes(stray).slice(0, 60));
  const appr = call(RIDER("manual_therapy", { amounts: ["abc", 300_000], priorAnnualRiderVisits: 9, approvedThroughVisit: 10 }));
  check("금액 무효 + 승인 회차 부족 → 금액 안내가 우선",
    isUnusable(appr) && notes(appr).includes("0 이상의 안전한 정수여야 합니다")
    && !notes(appr).includes("보상 승인 회차"), notes(appr).slice(0, 60));
  // 무효 금액이 더 이상 횟수를 소진하지 못한다.
  const burn = call(OUT({ amounts: ["abc", 300_000], priorAnnualOutpatientVisits: 99 }));
  check("⚠ 무효 금액이 횟수를 소진하지 못한다(종전에는 2행이 제외됐다)",
    isUnusable(burn), shape(burn));
  // 금액이 유효하면 기존 횟수·승인 안내가 그대로 동작한다.
  const cnt = call({ cause: "disease", coverage: "non_benefit", visit: "outpatient", amounts: [300_000] });
  check("금액이 유효하면 기존 횟수 미입력 안내가 그대로",
    !threw(cnt) && cnt.r.status === "PENDING_UNVERIFIED"
    && notes(cnt).includes("이미 사용한 통원 횟수") && cnt.r.totalAmount === 300_000,
    shape(cnt));
  check("⚠ 기존 blocked()는 진료비 합계를 계속 보존한다",
    !threw(cnt) && cnt.r.totalAmount === 300_000, shape(cnt));
  const badCnt = call(OUT({ amounts: [300_000], priorAnnualOutpatientVisits: -1 }));
  check("금액이 유효하면 기존 횟수 값 오류 안내가 그대로",
    !threw(badCnt) && badCnt.r.status === "PENDING_UNVERIFIED"
    && notes(badCnt).includes("0 이상의 정수여야 합니다") && badCnt.r.totalAmount === 300_000, shape(badCnt));
  const apprOk = call(RIDER("manual_therapy", { amounts: [300_000, 300_000], priorAnnualRiderVisits: 9, approvedThroughVisit: 10 }));
  check("금액이 유효하면 기존 승인 회차 차단이 그대로",
    !threw(apprOk) && apprOk.r.status === "PENDING_UNVERIFIED"
    && notes(apprOk).includes("도수치료·체외충격파치료·증식치료는")
    && notes(apprOk).includes("적용된 보상 승인 회차는")
    && apprOk.r.totalAmount === 600_000, shape(apprOk));
}

console.log("\n[G-16] 6. 전 경로에서 같은 계약");
{
  const paths: [string, (a: unknown) => unknown][] = [
    ["급여 통원", (a) => ({ cause: "disease", coverage: "benefit", visit: "outpatient", amounts: a })],
    ["급여 입원", (a) => ({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: a })],
    ["비급여 통원", (a) => OUT({ amounts: a })],
    ["비급여 입원", (a) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", amounts: a })],
    ["도수", (a) => RIDER("manual_therapy", { amounts: a })],
    ["도수+승인", (a) => RIDER("manual_therapy", { amounts: a, approvedThroughVisit: 10 })],
    ["주사료", (a) => RIDER("injection", { amounts: a })],
    ["MRI", (a) => RIDER("mri", { amounts: a })],
  ];
  for (const [name, mk] of paths) {
    const bad = [["컨테이너", "x"], ["원소", ["abc"]], ["합계", [Number.MAX_SAFE_INTEGER, 1]]] as [string, unknown][];
    const miss = bad.filter(([, a]) => !isUnusable(call(mk(a))));
    check(`${name}: 세 검사 모두 예외 없이 차단`, miss.length === 0, miss.map((m) => m[0]).join(","));
    check(`${name}: 정상 배열은 계산된다`, (() => { const x = call(mk([300_000])); return !threw(x) && x.r.status === "OK"; })());
  }
}

console.log("\n[G-16] 7. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("컨테이너 검사가 있다", /if \(!Array\.isArray\(rawAmounts\)\)/.test(body));
  check("원소 검사가 안전 정수다",
    /typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0/.test(body));
  check("합계 검사가 있다", /if \(!Number\.isSafeInteger\(totalInput\)\)/.test(body));
  check("총액을 만들 수 없을 때 전용 차단을 쓴다",
    /const unusable = \(notes: string\[\]\): MultiClaimResult => \(\{/.test(body)
    && /totalAmount: 0, totalOwnPay: null, totalInsurancePay: null, appliedCaps: \[\], notes,/.test(body));
  check("기존 blocked()는 합계를 계속 보존한다",
    /totalAmount: totalInput, totalOwnPay: null, totalInsurancePay: null, appliedCaps: \[\], notes,/.test(body));
  check("종전 `?? []` 관용이 사라졌다", !/input\.amounts \?\? \[\]/.test(body));
  check("진료비를 다시 정규화하지 않는다", !/normalizeAmount/.test(body));
  check("normalizeAmount를 import하지 않는다", !/import \{ normalizeAmount/.test(raw));
  check("settle은 그대로 쓴다", /import \{ settle \} from "\.\.\/common\/settle";/.test(body));
  // 순서: 컨테이너 → 원소 → 합계 → 기존 횟수·승인
  const iC = body.indexOf("Array.isArray(rawAmounts)");
  // ⚠ 값 판정식은 파일 상단의 badCount 헬퍼와 글자가 같다. 순서 검사의 앵커는
  //   이 블록에만 있는 구문으로 잡는다.
  const iE = body.indexOf("const v: unknown = rawAmounts[i]");
  const iS = body.indexOf("Number.isSafeInteger(totalInput)");
  const iV = body.indexOf("readCount(input, \"priorAnnualOutpatientVisits\")");
  const iA = body.indexOf("readCount(input, \"approvedThroughVisit\")");
  check("검증 순서: 컨테이너 → 원소 → 합계 → 횟수 → 승인",
    iC > 0 && iC < iE && iE < iS && iS < iV && iV < iA, `${iC}/${iE}/${iS}/${iV}/${iA}`);
  // 안내를 만들면서 값을 문자열로 만들지 않는다.
  check("새 안내는 typeof만 쓴다",
    /받은 값의 형식: \$\{typeof rawAmounts\}/.test(body) && /받은 값의 형식: \$\{typeof v\}/.test(body));
  check("새 안내에 JSON.stringify를 쓰지 않는다",
    !/받은 값의 형식: \$\{JSON\.stringify/.test(body));
  // ⚠ **낡은 계약을 교체했다.** 이 검사는 "기존 안내 6곳의 JSON.stringify는 이번 범위 밖"을
  //   고정하고 있었다. G-19가 그 6곳을 지역 `showValue()`로 낮췄으므로(bigint·순환 참조·
  //   `toJSON()` 예외에서 안내를 만들다 죽던 것을 고쳤다), 확인 대상을 새 표시로 옮긴다.
  //   요지(이 커밋이 그 자리를 건드리지 않았다)는 같다. 새 계약은
  //   tests/multiClaimNoteSafeDisplay.test.ts가 본다.
  check("다른 안내 6곳은 안전 표시(showValue)를 쓴다",
    (body.match(/받은 값: \$\{showValue\(/g) ?? []).length === 6
    && !/받은 값: \$\{JSON\.stringify/.test(body),
    String((body.match(/받은 값: \$\{showValue\(/g) ?? []).length));
  // ⚠ **낡은 계약을 교체했다.** G-16 시점에는 금액 누적 3축이 모두 nonNegInt의 관용을
  //   쓰고 있어 그 사실을 한 줄로 고정했다. G-17이 **활성 지급보험금 2축**을 검증으로
  //   바꿨으므로(무효값 → blocked), 그 부분은 새 계약으로 옮기고 여기서는
  //   `annualCoverageLimit`이 아직 관용을 쓴다는 사실만 남긴다.
  //   두 지급보험금 축의 새 계약은 tests/gen2021PaidAxisValue.test.ts가 본다.
  // ⚠ **낡은 계약을 두 번째로 교체했다.** G-18이 `annualCoverageLimit`까지 검증으로 바꿨다.
  //   그 축의 새 계약(허용·거부·안내 분리)은 tests/gen2021AnnualLimitValue.test.ts가 본다.
  check("annualCoverageLimit도 형식 검증으로 옮겨졌다",
    /if \(limitRaw !== undefined && badCount\(limitRaw\)\) \{/.test(body));
  check("지급보험금 2축은 더 이상 nonNegInt로 조용히 정규화되지 않는다",
    !/let paid = nonNegInt\(rider === "none" \? input\.priorAnnualInsurancePaid : input\.priorAnnualRiderPaid\);/.test(body)
    && /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{/.test(body));
  check("금액 누적 3축 어디에도 관용 정규화가 남아 있지 않다", !/nonNegInt/.test(body));
  // 상수는 건드리지 않았다.
  check("4세대 규칙값이 그대로",
    GEN2021.nonBenefitOutpatientAnnualVisits === 100
    && GEN2021.rider.manual_therapy.annualVisits === 50
    && GEN2021.rider.mskApproval.initialApproved === 10);
  const multi26 = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("5세대 엔진은 손대지 않았다", /const consumes = amount > 0 &&/.test(multi26));
  const std = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("2·3세대 엔진은 이 커밋이 손대지 않았다(안내 4곳은 G-19의 안전 표시)",
    (std.match(/받은 값: \$\{showValue\(/g) ?? []).length === 4
    && !/받은 값: \$\{JSON\.stringify/.test(std));
}

console.log(`\n[G-16 4세대 진료비 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
