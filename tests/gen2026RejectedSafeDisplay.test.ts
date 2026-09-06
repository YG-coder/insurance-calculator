// G-14D — 공용 `itemGuards.rejected()`의 '받은 값' 표시를 안전하게 낮춘다.
//
// 종전 동작(현행 소스 직접 호출로 실측, 2026-09-05):
//   `받은 값: ${JSON.stringify(got) ?? String(got)}`는 `JSON.stringify`가 던지는 값에서
//   그대로 **런타임 예외**로 끝났다. `??`는 `JSON.stringify`가 **정상적으로** `undefined`를
//   돌려줄 때만 동작하므로, 예외에는 폴백이 없었다.
//     - `bigint` → TypeError: Do not know how to serialize a BigInt
//     - 순환 참조 객체·배열 → TypeError: Converting circular structure to JSON
//     - `toJSON()`이 던지는 객체 → 그 예외가 그대로 나감
//   이는 G-14B의 두 축만의 문제가 아니었다. `specialItem2026.ts`의 30곳(route·coverage·
//   severity·item·injectionPurpose·lines·행의 amount/visit/tier·acts·approvedThroughVisit·
//   cause·amounts…)과 `roomCharge2026.ts`의 11곳 **전부**가 같은 `rejected()`를 쓰므로,
//   두 진입점(`calculateGen2026Item`·`calculateRoomCharge2026`) 어디로 들어와도 같았다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: `itemGuards.ts` 안의 지역 `showValue()` 신설과 `rejected()`의 두 번째 안내 교체.
//   - 하지 않는다: 계산식·규칙값·타입·입력 허용 범위·검증 순서·첫 번째 안내·반환 객체 변경,
//     정상적으로 직렬화되는 값의 표시 변경, `multiClaim2026.ts`의 G-14C `showValue()` 통합
//     (그 파일은 손대지 않는다), 결과 비교용 `fingerprint()`의 `JSON.stringify` 변경,
//     G-14A pool 범위 HOLD·지급 0원 HOLD 3종·상급병실료 HOLD·4세대 검증.
//
// ⚠ 두 번째 catch는 `JSON.stringify`와 `String()`이 **모두** 실패하는 값 전용이다.
//   `toString()`만 던지는 보통의 객체는 JSON 직렬화가 성공해 폴백에 도달하지 않으므로,
//   그 값으로는 이 분기를 검사할 수 없다. 아래는 null-prototype + bigint로 고정한다.
import { readFileSync } from "node:fs";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { rejected } from "../src/lib/insurance/engine/itemGuards";
import {
  Gen2026ItemClaimInput, Gen2026ItemClaimResult, Gen2026RoomChargeInput,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

/** 예외를 값으로 바꿔 잡는다 — 예외가 났다는 사실 자체가 검사 대상이다. */
type Caught = { threw: string } | { r: Gen2026ItemClaimResult };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const callItem = (input: unknown): Caught => {
  try { return { r: calculateGen2026Item(input as Gen2026ItemClaimInput) }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name + ": " + e.message.slice(0, 50) : String(e) }; }
};
const callRoom = (input: unknown): Caught => {
  try { return { r: calculateRoomCharge2026(input as Gen2026RoomChargeInput) }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name + ": " + e.message.slice(0, 50) : String(e) }; }
};
const isRejected = (x: Caught) =>
  !threw(x) && x.r.route === "rejected" && x.r.status === "PENDING_UNVERIFIED";

// 위험 값 — 브라우저 화면이 만들 수 없는 값이다. 엔진 직접 호출 계약 전용 검사다.
const circObj: Record<string, unknown> = {}; circObj.self = circObj;
const circArr: unknown[] = []; circArr.push(circArr);
const throwingToJson = { toJSON() { throw new Error("toJSON boom"); } };
/** `JSON.stringify`도 `String()`도 실패하는 값 — 두 번째 catch 전용. */
const noDisplay = Object.assign(Object.create(null) as Record<string, unknown>, { big: 1n });

console.log("\n[G-14D] 1. 정상 직렬화 값의 표시가 종전과 같다");
{
  // 기준선(72e0c96)의 `JSON.stringify(got) ?? String(got)` 결과를 그대로 고정한다.
  const throwingToString = { toString() { throw new Error("toString boom"); } };
  for (const [label, got, want] of [
    ["number", 3, "3"],
    ["negative", -1, "-1"],
    ["minus zero", -0, "0"],
    ["fraction", 1.5, "1.5"],
    ["NaN", NaN, "null"],
    ["Infinity", Infinity, "null"],
    ["safe integer 초과", Number.MAX_SAFE_INTEGER + 1, "9007199254740992"],
    ["string", "x", "\"x\""],
    ["빈 문자열", "", "\"\""],
    ["공백 문자열", "  ", "\"  \""],
    ["한글", "한글", "\"한글\""],
    ["null", null, "null"],
    ["undefined", undefined, "undefined"],
    ["true", true, "true"],
    ["array", [1, 2], "[1,2]"],
    ["빈 array", [], "[]"],
    ["object", { a: 1 }, "{\"a\":1}"],
    ["빈 object", {}, "{}"],
    ["Symbol", Symbol("s"), "Symbol(s)"],
    ["toString이 던지는 객체(JSON은 성공)", throwingToString, "{}"],
  ] as [string, unknown, string][]) {
    check(`표시 무변경 — ${label}`, rejected("W", got).notes[1] === `받은 값: ${want}`,
      rejected("W", got).notes[1]);
  }
}

console.log("\n[G-14D] 2. 예외를 던지던 값이 예외 없이 결과가 된다");
{
  for (const [label, got, want] of [
    ["bigint 1n", 1n, "1"],
    ["bigint 0n", 0n, "0"],
    ["순환 참조 객체", circObj, "[object Object]"],
    ["순환 참조 배열", circArr, ""],
    ["toJSON이 던지는 객체", throwingToJson, "[object Object]"],
  ] as [string, unknown, string][]) {
    let note = "(예외)";
    try { note = rejected("W", got).notes[1]; } catch { /* 실패로 남긴다 */ }
    check(`예외 없이 String()으로 낮춤 — ${label}`, note === `받은 값: ${want}`, note);
  }
  // 두 번째 catch — JSON도 String도 실패하는 값에서만 도달한다.
  let note = "(예외)";
  try { note = rejected("W", noDisplay).notes[1]; } catch { /* 실패로 남긴다 */ }
  check("JSON·String 모두 실패 → 고정 문구", note === "받은 값: (표시할 수 없는 값)", note);
  // `String()`이 실제로 던지는 값인지 직접 확인한다 — 분기를 우연히 밟지 않기 위해서다.
  let stringThrew = false;
  try { String(noDisplay); } catch { stringThrew = true; }
  let jsonThrew = false;
  try { JSON.stringify(noDisplay); } catch { jsonThrew = true; }
  check("고정 문구 검사값이 실제로 두 단계 모두 실패한다", stringThrew && jsonThrew,
    `String=${stringThrew} JSON=${jsonThrew}`);
}

console.log("\n[G-14D] 3. 반환 객체 계약이 그대로다");
{
  for (const [label, got] of [
    ["정상 값", "ZZZ"], ["bigint", 1n], ["순환 참조", circObj], ["표시 불가", noDisplay],
  ] as [string, unknown][]) {
    const r = rejected("테스트", got);
    check(`반환 계약 — ${label}`,
      r.route === "rejected" && r.status === "PENDING_UNVERIFIED" && r.generation === "2026"
      && r.totalAmount === 0 && r.totalOwnPay === null && r.totalInsurancePay === null
      && r.lines.length === 0 && r.appliedCaps.length === 0
      && r.notes.length === 2
      && r.notes[0] === "테스트 값이 올바르지 않아 계산하지 않았습니다.",
      JSON.stringify([r.route, r.status, r.totalAmount, r.notes.length]));
  }
}

console.log("\n[G-14D] 4. 별도 보장종목 진입점 — 축마다 예외가 아니라 rejected");
{
  const mriBase = {
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri",
    cause: "disease", priorAnnualInsurancePaid: 0,
    lines: [{ amount: 1_000_000, visit: "inpatient", tier: "hospital" }],
  };
  const genBase = {
    route: "general", coverage: "non_benefit", severity: "non_critical",
    item: "musculoskeletal_esw", cause: "disease", visit: "inpatient", tier: "clinic",
    amounts: [300_000], priorAnnualInsurancePaid: 0,
  };
  const axes: [string, (v: unknown) => unknown][] = [
    ["route", (v) => ({ ...mriBase, route: v })],
    ["coverage", (v) => ({ ...mriBase, coverage: v })],
    ["severity", (v) => ({ ...mriBase, severity: v })],
    ["item", (v) => ({ ...mriBase, item: v })],
    ["injectionPurpose", (v) => ({ ...mriBase, item: "injection", injectionPurpose: v })],
    ["lines", (v) => ({ ...mriBase, lines: v })],
    ["행의 amount", (v) => ({ ...mriBase, lines: [{ amount: v, visit: "inpatient", tier: "hospital" }] })],
    ["행의 visit", (v) => ({ ...mriBase, lines: [{ amount: 1, visit: v, tier: "hospital" }] })],
    ["행의 tier", (v) => ({ ...mriBase, lines: [{ amount: 1, visit: "inpatient", tier: v }] })],
    ["priorAnnualCoveredCount", (v) => ({ ...mriBase, item: "injection",
      injectionPurpose: "general", priorAnnualCoveredCount: v })],
    ["priorAnnualInpatientDeductible", (v) => ({ ...mriBase, priorAnnualInpatientDeductible: v })],
    ["priorAnnualTreatmentActCount", (v) => ({ ...mriBase, item: "musculoskeletal_esw",
      priorAnnualTreatmentActCount: v })],
    ["approvedThroughVisit", (v) => ({ ...mriBase, item: "musculoskeletal_esw",
      priorAnnualTreatmentActCount: 0, approvedThroughVisit: v })],
    ["cause(일반 전환)", (v) => ({ ...genBase, cause: v })],
    ["visit(일반 전환)", (v) => ({ ...genBase, visit: v })],
    ["tier(일반 전환)", (v) => ({ ...genBase, tier: v })],
    ["amounts(일반 전환)", (v) => ({ ...genBase, amounts: v })],
  ];
  const risky: [string, unknown][] = [
    ["bigint", 1n], ["순환", circObj], ["순환 배열", circArr],
    ["toJSON 예외", throwingToJson], ["표시 불가", noDisplay],
  ];
  for (const [axis, make] of axes) {
    const bad = risky.filter(([, v]) => !isRejected(callItem(make(v))));
    check(`별도 보장종목 ${axis}: 위험 값 ${risky.length}종 모두 rejected`, bad.length === 0,
      bad.map(([n]) => n + "=" + JSON.stringify(callItem(make(risky.find((x) => x[0] === n)![1])))).join(" ").slice(0, 120));
  }
}

console.log("\n[G-14D] 5. 상급병실료 — 두 진입점 모두");
{
  const rcBase = {
    route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical",
    stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 10 }], priorAnnualInsurancePaid: 0,
  };
  const axes: [string, (v: unknown) => unknown][] = [
    ["route", (v) => ({ ...rcBase, route: v })],
    ["coverage", (v) => ({ ...rcBase, coverage: v })],
    ["cause", (v) => ({ ...rcBase, cause: v })],
    ["severity", (v) => ({ ...rcBase, severity: v })],
    ["미사용 키(item)", (v) => ({ ...rcBase, item: v })],
    ["stays", (v) => ({ ...rcBase, stays: v })],
    ["roomChargeTotal", (v) => ({ ...rcBase, stays: [{ roomChargeTotal: v, inpatientDays: 10 }] })],
    ["inpatientDays", (v) => ({ ...rcBase, stays: [{ roomChargeTotal: 1, inpatientDays: v }] })],
    ["priorAnnualInsurancePaid", (v) => ({ ...rcBase, priorAnnualInsurancePaid: v })],
    ["annualCoverageLimit", (v) => ({ ...rcBase, annualCoverageLimit: v })],
  ];
  const risky: [string, unknown][] = [["bigint", 1n], ["순환", circObj], ["표시 불가", noDisplay]];
  for (const [axis, make] of axes) {
    // ⚠ `calculateGen2026Item` 경유와 직접 호출을 **따로** 확인한다.
    const viaItem = risky.filter(([, v]) => !isRejected(callItem(make(v))));
    const direct = risky.filter(([, v]) => !isRejected(callRoom(make(v))));
    check(`상급병실료 ${axis}: 두 진입점 모두 rejected`,
      viaItem.length === 0 && direct.length === 0,
      `viaItem=${viaItem.map((x) => x[0]).join(",")} direct=${direct.map((x) => x[0]).join(",")}`);
  }
}

console.log("\n[G-14D] 6. 계산 무회귀 — 정상 입력의 결과가 그대로다");
{
  // 값은 G-14B·G-14C 검사와 같은 기준선에서 온 것이다. 표시 변경이 계산에 닿지 않음을 고정한다.
  const mri = (extra: Record<string, unknown> = {}) => callItem({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri",
    cause: "disease", priorAnnualInsurancePaid: 0,
    lines: [{ amount: 1_000_000, visit: "inpatient", tier: "hospital" },
      { amount: 1_000_000, visit: "inpatient", tier: "clinic" }], ...extra,
  });
  const total = (x: Caught, pick: (r: Gen2026ItemClaimResult) => unknown) =>
    threw(x) ? x.threw : String(pick(x.r));
  check("중증 MRI pool 0 → 본인부담 600,000",
    total(mri({ priorAnnualInpatientDeductible: 0 }), (r) => r.totalOwnPay) === "600000");
  check("중증 MRI pool 4,900,000 → 본인부담 400,000",
    total(mri({ priorAnnualInpatientDeductible: 4_900_000 }), (r) => r.totalOwnPay) === "400000");
  check("중증 MRI pool 9,000,000(한도 초과 유효값) → 본인부담 300,000",
    total(mri({ priorAnnualInpatientDeductible: 9_000_000 }), (r) => r.totalOwnPay) === "300000");
  check("중증 MRI pool 미입력 → 0과 같다",
    total(mri(), (r) => r.totalOwnPay) === "600000");
  const room = callRoom({
    route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical",
    stays: [{ roomChargeTotal: 3_000_000, inpatientDays: 10 }], priorAnnualInsurancePaid: 0,
  });
  check("상급병실료 3,000,000/10일 → 보험 적용 1,000,000",
    !threw(room) && room.r.route === "room_charge" && room.r.totalInsurancePay === 1_000_000,
    threw(room) ? room.threw : String(room.r.totalInsurancePay));
  // 기존 거부·HOLD 경로가 살아 있다.
  const g14b = callItem({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri",
    cause: "disease", priorAnnualInsurancePaid: 0, priorAnnualCoveredCount: 0,
    lines: [{ amount: 1_000_000, visit: "inpatient", tier: "hospital" }],
  });
  check("G-14B 미사용 축 거부가 그대로",
    isRejected(g14b) && !threw(g14b)
    && g14b.r.notes.join(" ").includes("이미 보상한 횟수(priorAnnualCoveredCount)"),
    threw(g14b) ? g14b.threw : g14b.r.notes.join(" ").slice(0, 60));
  const zeroPay = callItem({
    route: "special_item", coverage: "non_benefit", severity: "critical",
    item: "musculoskeletal_esw", cause: "disease", priorAnnualInsurancePaid: 0,
    priorAnnualCoveredCount: 49, priorAnnualTreatmentActCount: 0, approvedThroughVisit: 10,
    lines: [{ amount: 20_000, visit: "outpatient" }, { amount: 100_000, visit: "outpatient" }],
  });
  check("지급 0원 HOLD 차단이 그대로",
    !threw(zeroPay) && zeroPay.r.status === "PENDING_UNVERIFIED"
    && zeroPay.r.notes.join(" ").includes("표준약관에 정해져 있지 않습니다"),
    threw(zeroPay) ? zeroPay.threw : zeroPay.r.notes.join(" ").slice(0, 60));
  check("상급병실료 HOLD 안내가 그대로",
    !threw(room) && room.r.notes.join(" ").includes("상급병실료 차액에 적용한다는 명시적 근거를 찾지 못해"));
}

console.log("\n[G-14D] 7. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/itemGuards.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("안전 표시 헬퍼가 있다", /const showValue = \(v: unknown\): string => \{/.test(body));
  check("안전 표시가 try/catch로 감싸져 있다",
    /try \{[\s\S]{0,200}JSON\.stringify\(v\)[\s\S]{0,200}\} catch/.test(body));
  check("실패 시 String(v)로 낮춘다", /return String\(v\);/.test(body));
  check("그마저 실패하면 고정 문구", /return "\(표시할 수 없는 값\)";/.test(body));
  check("catch가 두 개다", (body.match(/\} catch \{/g) ?? []).length === 2,
    String((body.match(/\} catch \{/g) ?? []).length));
  check("종전 표현이 남아 있지 않다", !/JSON\.stringify\(got\) \?\? String\(got\)/.test(body));
  check("'받은 값' 안내가 안전 표시를 쓴다",
    (body.match(/받은 값: \$\{showValue\(got\)\}/g) ?? []).length === 1,
    String((body.match(/받은 값: \$\{showValue\(/g) ?? []).length));
  check("첫 번째 안내 문장이 그대로다",
    /`\$\{what\} 값이 올바르지 않아 계산하지 않았습니다\.`/.test(body));
  check("반환 객체가 그대로다",
    /route: "rejected", status: "PENDING_UNVERIFIED", generation: "2026", lines: \[\],/.test(body)
    && /totalAmount: 0, totalOwnPay: null, totalInsurancePay: null, appliedCaps: \[\],/.test(body));
  check("showValue를 밖으로 내보내지 않는다", !/export const showValue|export function showValue/.test(body));
  check("itemGuards는 엔진을 import하지 않는다(leaf 유지)",
    !/from "\.\/(multiClaim2026|specialItem2026|roomCharge2026|generation2026)"/.test(body));
  // 검증 순서·허용 범위를 건드리지 않았다 — 판정 헬퍼 3종이 그대로다.
  // ⚠ **낡은 계약을 교체했다(G-26).** 종전 판정 헬퍼 `isNum`(= 유한한 숫자)은 진료비 축이
  //   유일한 사용처였고, G-26이 세 진료비 축을 0 이상의 안전한 정수로 닫으면서 사용처가
  //   0이 되어 삭제됐다(전용 가드 `isClaimAmount`로 대체). 나머지 헬퍼는 그대로다.
  check("판정 헬퍼가 그대로다(isNum → isClaimAmount 교체, 나머지 무변경)",
    /export const isClaimAmount = \(v: unknown\): v is number =>/.test(body)
    && !/export const isNum/.test(body)
    && /export const isPositiveInt =/.test(body) && /export const oneOf =/.test(body));

  // ⚠ G-14C의 지역 showValue는 **통합하지 않는다.** 공용 모듈로 빼면 그 파일의 소스 계약
  //   검사(gen2026MultiInputContract)가 깨지고, leaf 가드가 계산 엔진과 결합한다.
  const multi = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const multiBody = multi.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("multiClaim2026의 지역 showValue가 그대로 있다",
    /const showValue = \(v: unknown\): string => \{/.test(multiBody));
  check("multiClaim2026이 itemGuards를 import하지 않는다",
    !/from "\.\/itemGuards"/.test(multiBody));
  // ⚠ 계약 갱신(G-20·G-21 → G-30 → G-31): 두 금액 축의 값 검증으로 9 → 11곳이 됐고,
  //   G-30이 급여 묶음의 미사용 금액 축과 입원의 통원 가입금액 stray를 더해 11 → 13곳,
  //   G-31이 급여의 미사용 비금액 축·급여 입원의 본인부담률·비급여의 본인부담률을 더해
  //   13 → 16곳, G-32가 중증도 열거값 검증을 더해 16 → 17곳이 됐다.
  //   요지(이 파일의 안내는 전부 지역 showValue를 거친다)는 그대로다.
  check("multiClaim2026의 '받은 값' 17곳이 모두 안전 표시를 쓴다",
    (multiBody.match(/받은 값: \$\{showValue\(/g) ?? []).length === 17
    && !/받은 값: \$\{JSON\.stringify/.test(multiBody),
    String((multiBody.match(/받은 값: \$\{showValue\(/g) ?? []).length));
  // fingerprint는 결과 비교용이라 대상이 아니다 — 그대로 JSON.stringify를 쓴다.
  check("fingerprint의 JSON.stringify가 그대로다",
    /function fingerprint\(r: MultiClaimResult\): string \{\n\s*return JSON\.stringify\(\[/.test(multiBody));

  // roomCharge2026은 이번 커밋에서 손대지 않는다(FROZEN 해시 유지).
  const rc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("roomCharge2026은 itemGuards의 rejected를 그대로 쓴다",
    /import \{ CAUSE_VALUES, SEVERITY_VALUES, isClaimAmount, isPositiveInt, oneOf, rejected \} from "\.\/itemGuards";/.test(rc)
    && !/showValue/.test(rc));

  // FROZEN 표가 새 해시로 갱신됐고 이유가 남아 있다.
  const hold = readFileSync("tests/gen2026HoldStatus.test.ts", "utf8");
  check("FROZEN 표에 갱신 이유가 적혀 있다",
    /G-14D에서 \*\*의도적으로\*\* 갱신했다\(종전 c10d2fea…\)/.test(hold));
  // ⚠ **낡은 계약을 교체했다.** G-14D 시점에는 roomCharge2026을 손대지 않아 그 해시가
  //   유지된다는 사실을 고정했다. G-22가 그 파일의 두 금액 축을 값 검증으로 바꾸면서
  //   해시가 의도적으로 갱신됐다(이유는 FROZEN 표 옆에 적혀 있다). 이 절이 지켜야 할 것은
  //   특정 해시값이 아니라 **G-14D가 그 파일을 건드리지 않았다**는 사실이므로,
  //   그 파일이 여전히 공용 rejected()를 쓰고 자기 showValue 사본을 두지 않았음으로 확인한다.
  check("roomCharge2026의 해시 갱신에 이유가 적혀 있다",
    /G-22에서 \*\*의도적으로\*\* 갱신했다\(종전 fa3c0f00…\)/.test(hold));
  // ⚠ **낡은 계약을 교체했다(G-26).** 이 검사의 요지는 "G-14D가 `showValue`를 넣으면서 공용
  //   가드는 건드리지 않았다"였다. G-26이 진료비 축을 닫으며 `isNum`을 `isClaimAmount`로
  //   교체해 해시가 갱신됐다. G-14D가 세운 계약(안전 표시)은 그대로이므로, 갱신 이유가
  //   G-26으로 기록돼 있는지와 `showValue`·`rejected`가 그대로인지를 대신 고정한다.
  check("itemGuards.ts 해시 갱신 이유가 G-26으로 기록돼 있다",
    /G-26에서 \*\*의도적으로\*\* 갱신했다\(종전 ad08c2d9…\)/.test(hold)
    && /"src\/lib\/insurance\/engine\/itemGuards\.ts": "546f476a59ff0dd8ca85fd6e84c25eedeeaed80f63d042e1d662bdff0e1ebc94"/.test(hold));
}

console.log(`\n[G-14D rejected 안전 표시] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
