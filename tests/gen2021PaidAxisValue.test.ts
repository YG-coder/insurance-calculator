// G-17 — 4세대 다회 엔진의 **활성 지급보험금 누적 축** 값 검증.
//   대상: 일반 경로 priorAnnualInsurancePaid / 특약 경로 priorAnnualRiderPaid
//
// 종전 동작(기준선 25cf9cb 엔진 직접 호출로 실측, UI 미경유):
//   `let paid = nonNegInt(rider === "none" ? input.priorAnnualInsurancePaid
//                                          : input.priorAnnualRiderPaid);`
//   nonNegInt는 `Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0`이라
//     - 문자열·음수·NaN·±Infinity·null·불리언·객체·배열·bigint·순환 참조 → 조용히 **0**
//     - 소수 → 내림
//     - 안전 정수 초과 → 그대로 통과
//   0이 되면 남은 한도가 실제보다 커져 **보험금이 과다 산출된다.** 실측:
//     비급여 통원, 가입금액 500,000, 청구 300,000, 기존 지급 400,000
//       정답        → ins = 100,000
//       무효값 12종 → ins = 200,000 (전부)
//     특약(주사료, 약관 연 250만)도 정답 2,400,000 → 100,000 / 무효값 → 210,000으로 같았다.
//   반대로 MAX_SAFE·MAX_SAFE+1은 한도를 다 소진해 ins = 0이 됐다(과소 산출).
//   ⚠ 이 축들은 런타임 예외를 내지 않았다 — nonNegInt의 `Number.isFinite`가 bigint·객체를
//     걸러 던지지 않기 때문이다. 문제는 예외가 아니라 **조용히 틀린 금액**이다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: **활성 축 하나**의 값 검증. 일반 경로는 priorAnnualInsurancePaid,
//     특약 경로는 priorAnnualRiderPaid. 무효값을 기존 blocked()로 차단한다.
//   - 하지 않는다: 비활성 축 stray 거부(후속 항목 — 조용한 폐기 동작 그대로),
//     annualCoverageLimit 값 검증(후속 항목), 약관 한도 초과 값의 절삭,
//     undefined·명시적 0의 의미 변경, nonNegInt() 삭제·전역 변경,
//     기존 안내 6곳의 JSON.stringify 안전 표시, 5세대·2·3세대 엔진 변경.
//
// 검증 순서: G-16 금액(컨테이너·원소·합계) → 기존 횟수·승인 → **활성 지급보험금** → 계산.
//   잘못된 진료비·횟수·승인 회차가 함께 있으면 그 안내가 그대로 앞선다.
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
const ins = (x: Caught) => threw(x) ? "THROW:" + x.threw : x.r.status !== "OK" ? "차단" : String(x.r.totalInsurancePay);
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}/lines=${x.r.lines.length}`;
/** 기존 blocked() 계약 — 진료비 합계는 보존한다. */
const isBlocked = (x: Caught, amt: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === amt && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && x.r.lines.length === 0;

// 화면이 만들 수 없는 값이다 — 엔진 직접 호출 계약 전용 검사다.
const circ: Record<string, unknown> = {}; circ.self = circ;
const AMT = 300_000;
/** 일반 비급여 통원 — 가입금액 500,000이면 정답(기존 지급 400,000)에서 ins = 100,000. */
const GEN = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", visit: "outpatient",
  amounts: [AMT], priorAnnualOutpatientVisits: 0, annualCoverageLimit: 500_000, ...extra,
});
/** 특약(주사료) — 약관 연 250만 한도. 정답(기존 지급 2,400,000)에서 ins = 100,000. */
const RID = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "injection",
  amounts: [AMT], priorAnnualRiderVisits: 0, ...extra,
});

const BAD: [string, unknown][] = [
  ["문자열 숫자", "400000"], ["문자열 abc", "abc"], ["음수", -400_000], ["소수", 400_000.9],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity], ["null", null],
  ["true", true], ["false", false], ["{}", {}], ["[]", []], ["[400000]", [400_000]],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ["bigint", 400_000n], ["순환 참조", circ],
  ["Symbol", Symbol("s")],
];

console.log("\n[G-17] 1. 정상 값 무회귀");
{
  check("일반: 미전달 → ins 200,000", ins(call(GEN())) === "200000", ins(call(GEN())));
  check("일반: 명시적 0 → 미전달과 같다",
    shape(call(GEN({ priorAnnualInsurancePaid: 0 }))) === shape(call(GEN())), shape(call(GEN({ priorAnnualInsurancePaid: 0 }))));
  check("일반: 정상 400,000 → ins 100,000", ins(call(GEN({ priorAnnualInsurancePaid: 400_000 }))) === "100000");
  check("일반: 가입금액 소진 500,000 → ins 0", ins(call(GEN({ priorAnnualInsurancePaid: 500_000 }))) === "0");
  check("일반: 가입금액 초과 600,000도 허용(절삭 없음) → ins 0",
    ins(call(GEN({ priorAnnualInsurancePaid: 600_000 }))) === "0");
  check("일반: MAX_SAFE(안전 정수) 허용 → ins 0",
    ins(call(GEN({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER }))) === "0");
  check("특약: 미전달 → ins 210,000", ins(call(RID())) === "210000", ins(call(RID())));
  check("특약: 명시적 0 → 미전달과 같다",
    shape(call(RID({ priorAnnualRiderPaid: 0 }))) === shape(call(RID())));
  check("특약: 정상 2,400,000 → ins 100,000", ins(call(RID({ priorAnnualRiderPaid: 2_400_000 }))) === "100000");
  check("특약: 약관 한도와 같음 2,500,000 → ins 0", ins(call(RID({ priorAnnualRiderPaid: 2_500_000 }))) === "0");
  check("특약: 약관 한도 초과 3,000,000도 허용(절삭 없음) → ins 0",
    ins(call(RID({ priorAnnualRiderPaid: 3_000_000 }))) === "0");
  check("약관 한도 상수가 그대로",
    GEN2021.rider.injection.annualLimit === 2_500_000 && GEN2021.rider.manual_therapy.annualLimit === 3_500_000
    && GEN2021.rider.mri.annualLimit === 3_000_000 && GEN2021.annualLimitMaximum === 50_000_000);
}

console.log("\n[G-17] 2. 활성 일반 축 — 무효값 차단");
{
  for (const [label, v] of BAD) {
    const x = call(GEN({ priorAnnualInsurancePaid: v }));
    check(`일반 ${label} → 예외 없이 blocked`, isBlocked(x, AMT), shape(x));
    check(`일반 ${label} → 전용 안내`,
      notes(x).includes("기존 지급보험금(priorAnnualInsurancePaid)은 0 이상의 안전한 정수"), notes(x).slice(0, 45));
  }
  check("안내에 받은 값의 형식이 들어간다",
    notes(call(GEN({ priorAnnualInsurancePaid: "abc" }))).includes("받은 값의 형식: string"));
}

console.log("\n[G-17] 2b. 안내가 방향을 단정하지 않는다 — 두 사례 실측 + 문구 되돌림 방지");
{
  // ⚠ 이 절이 보장하는 것은 두 층이다.
  //     ① 의미  — 종전에 방향이 반대였던 두 사례가 **완전히 같은 안내**로 차단된다.
  //     ② 되돌림 — 그 안내 본문에 방향 낱말이 없고, 종전 문구 형태가 돌아오지 않는다.
  //   ②는 저장소 전체의 방향 단정을 잡는 검사가 아니다. 아래 주석에 범위를 적어 둔다.
  //
  // ⚠ 종전 동작은 값에 따라 **반대로** 갈렸다. 두 사례를 직접 확인한다.
  //   ① 문자열·음수 — nonNegInt가 0으로 만들어 한도가 되살아났다(보험금이 많아짐)
  //   ② MAX_SAFE+1  — 그대로 통과해 한도를 다 소진했다(보험금이 적어짐)
  //   기준선 실측: ①은 ins 200,000(정답 100,000), ②는 ins 0.
  const NEUTRAL = "계산기가 잘못된 값을 임의로 고치지 않습니다";
  const cases: [string, unknown][] = [
    ["문자열 '400000'(종전 0 정규화)", "400000"],
    ["음수 -400000(종전 0 정규화)", -400_000],
    ["MAX_SAFE+1(종전 한도 소진)", Number.MAX_SAFE_INTEGER + 1],
  ];
  const seen: string[] = [];
  for (const [label, v] of cases) {
    const x = call(GEN({ priorAnnualInsurancePaid: v }));
    check(`${label} → 차단`, isBlocked(x, AMT), shape(x));
    check(`${label} → 같은 중립 문구`, notes(x).includes(NEUTRAL), notes(x).slice(0, 60));
    seen.push(threw(x) ? "THROW" : x.r.notes.slice(0, 2).join(" | "));
  }
  check("세 사례의 안내(형식 줄 제외)가 완전히 같다",
    seen[0] === seen[1] && seen[1] === seen[2], seen.join("  ≠  "));
  // 특약 축도 같다.
  const rs = cases.map(([, v]) => { const x = call(RID({ priorAnnualRiderPaid: v }));
    return threw(x) ? "THROW" : x.r.notes.slice(0, 2).join(" | "); });
  check("특약 축도 세 사례가 같은 문구", rs[0] === rs[1] && rs[1] === rs[2], rs.join("  ≠  "));

  const noteText = [...cases, ["null", null] as [string, unknown]]
    .flatMap(([, v]) => { const x = call(GEN({ priorAnnualInsurancePaid: v })); return threw(x) ? [] : x.r.notes; })
    .join("\n");

  // ── 사용자 안내 본문: 방향 낱말 자체가 없다 (텍스트 전수 검사) ──────────
  //   대상이 차단 안내 4종의 **전체 텍스트**이므로, 이 검사는 그 텍스트에 한해
  //   빠짐없다. 검사만 지우고 문구를 되돌리는 것을 막으려고 중립 문구도 함께 고정한다.
  check("차단 안내 본문에 방향 낱말이 들어 있지 않다",
    !/과다|과소|많이 산출|적게 산출/.test(noteText), (noteText.match(/과다|과소|많이 산출|적게 산출/) ?? [""])[0]);
  check("중립 문구가 실제로 쓰인다", noteText.includes(NEUTRAL));

  // ── 되돌림 방지: 이번에 실제로 있었던 문구 형태만 막는 낱말 패턴 ──────────
  //   ⚠ **범위를 분명히 한다.** 이것은 "한쪽 방향 단정이 없다"는 의미 보장이 아니라,
  //     아래 다섯 텍스트에서 `(항상|모두|전부|언제나)` 뒤 20자 안에 방향 낱말이
  //     나오는지만 보는 **낱말·거리 패턴 검사**다. 다르게 쓴 방향 단정이나 20자보다
  //     멀리 떨어진 조합은 잡지 못한다.
  //   ⚠ 의미 쪽 보장은 위의 "세 사례가 완전히 같은 안내"와 바로 앞의 본문 전수 검사가
  //     맡는다. 여기서 막는 것은 종전 문구가 그 형태로 되돌아오는 것뿐이다.
  //   ⚠ 패턴은 이어 붙여 만든다. 한 덩어리 리터럴로 적으면 이 파일 자신이 걸린다.
  const ALWAYS_OVER = new RegExp("(항상|모두|전부|언제나)[^\\n]{0,20}" + "과" + "다");
  for (const [label, text] of [
    ["차단 안내 본문", noteText],
    ["multiClaim2021.ts", readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8")],
    ["이 테스트", readFileSync("tests/gen2021PaidAxisValue.test.ts", "utf8")],
    ["multi-claim-design.md", readFileSync("docs/insurance/multi-claim-design.md", "utf8")],
    ["audit-status.md", readFileSync("docs/insurance/audit-status.md", "utf8")],
  ] as [string, string][]) {
    const m = text.match(ALWAYS_OVER);
    check(`${label}: 전부·항상 계열 낱말 뒤 20자 안에 방향 낱말이 없다`, m === null, m ? m[0] : "");
  }
}

console.log("\n[G-17] 3. 활성 특약 축 — 무효값 차단");
{
  for (const [label, v] of BAD) {
    const x = call(RID({ priorAnnualRiderPaid: v }));
    check(`특약 ${label} → 예외 없이 blocked`, isBlocked(x, AMT), shape(x));
    check(`특약 ${label} → 전용 안내(특약 문구)`,
      notes(x).includes("이 특약의 기존 지급보험금(priorAnnualRiderPaid)은 0 이상의 안전한 정수"), notes(x).slice(0, 45));
  }
  // 세 특약 모두 같은 계약이다.
  for (const rider of ["manual_therapy", "injection", "mri"]) {
    const base: Record<string, unknown> = { cause: "disease", coverage: "non_benefit", visit: "outpatient",
      rider, amounts: [AMT], ...(rider === "mri" ? {} : { priorAnnualRiderVisits: 0 }) };
    check(`특약 ${rider}: 무효값 차단`, isBlocked(call({ ...base, priorAnnualRiderPaid: "abc" }), AMT));
    check(`특약 ${rider}: 정상값 계산`, ins(call({ ...base, priorAnnualRiderPaid: 0 })) === "210000");
  }
}

console.log("\n[G-17] 4. 비활성 축 stray는 종전대로 조용히 폐기된다(후속 항목)");
{
  // 일반 경로에 특약 축이 실려도, 특약 경로에 일반 축이 실려도 이번 커밋은 보지 않는다.
  for (const [label, base, key] of [
    ["일반 경로 + priorAnnualRiderPaid", GEN, "priorAnnualRiderPaid"],
    ["특약 경로 + priorAnnualInsurancePaid", RID, "priorAnnualInsurancePaid"],
  ] as [string, (e?: Record<string, unknown>) => unknown, string][]) {
    const ref = shape(call(base()));
    for (const v of [0, 400_000, "abc", null, {}, NaN, 400_000n]) {
      const x = call(base({ [key]: v }));
      check(`${label} = ${typeof v} → 종전과 같은 결과(조용한 폐기 유지)`, shape(x) === ref, shape(x));
    }
  }
}

console.log("\n[G-17] 5. 연간 가입금액이 없어도 활성 축을 검증한다");
{
  const noLimit = (extra: Record<string, unknown> = {}) => ({
    cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [AMT], priorAnnualOutpatientVisits: 0, ...extra,
  });
  // 한도가 없으면 이 값은 결과를 바꾸지 못한다 — 그래도 형식은 본다.
  check("한도 없음 + 정상 400,000 → 계산됨(값은 결과를 바꾸지 않는다)",
    ins(call(noLimit({ priorAnnualInsurancePaid: 400_000 }))) === "200000");
  for (const [label, v] of [["문자열", "400000"], ["음수", -1], ["NaN", NaN], ["{}", {}], ["bigint", 1n]] as [string, unknown][]) {
    const x = call(noLimit({ priorAnnualInsurancePaid: v }));
    check(`한도 없음 + ${label} → 그래도 blocked`, isBlocked(x, AMT), shape(x));
  }
  // 급여 경로·입원 경로에서도 같다.
  for (const [label, base] of [
    ["급여 통원", { cause: "disease", coverage: "benefit", visit: "outpatient", amounts: [AMT] }],
    ["급여 입원", { cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [AMT] }],
    ["비급여 입원", { cause: "disease", coverage: "non_benefit", visit: "inpatient", amounts: [AMT] }],
  ] as [string, Record<string, unknown>][]) {
    check(`${label}: 한도 없이도 무효값 차단`, isBlocked(call({ ...base, priorAnnualInsurancePaid: "abc" }), AMT));
    check(`${label}: 정상값은 계산`, (() => { const x = call({ ...base, priorAnnualInsurancePaid: 0 }); return !threw(x) && x.r.status === "OK"; })());
  }
}

console.log("\n[G-17] 6. 안내 우선순위 — 금액 → 횟수·승인 → 지급보험금");
{
  // 진료비가 무효이면 G-16 안내가 먼저이고 totalAmount는 0이다.
  const badAmt = call(GEN({ amounts: ["abc"], priorAnnualInsurancePaid: "abc" }));
  check("진료비 무효 + 지급보험금 무효 → 진료비 안내가 우선",
    !threw(badAmt) && badAmt.r.totalAmount === 0
    && notes(badAmt).includes("0 이상의 안전한 정수여야 합니다")
    && !notes(badAmt).includes("기존 지급보험금"), notes(badAmt).slice(0, 55));
  // 횟수 미입력이면 횟수 안내가 먼저다.
  const noCnt = call({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [AMT], priorAnnualInsurancePaid: "abc" });
  check("횟수 미입력 + 지급보험금 무효 → 횟수 안내가 우선",
    isBlocked(noCnt, AMT) && notes(noCnt).includes("이미 사용한 통원 횟수")
    && !notes(noCnt).includes("기존 지급보험금"), notes(noCnt).slice(0, 55));
  // 횟수 값 오류도 먼저다.
  const badCnt = call(GEN({ priorAnnualOutpatientVisits: -1, priorAnnualInsurancePaid: "abc" }));
  check("횟수 값 오류 + 지급보험금 무효 → 횟수 안내가 우선",
    isBlocked(badCnt, AMT) && notes(badCnt).includes("0 이상의 정수여야 합니다")
    && !notes(badCnt).includes("기존 지급보험금"), notes(badCnt).slice(0, 55));
  // 승인 회차 부족도 먼저다.
  const appr = call({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    rider: "manual_therapy", amounts: [AMT, AMT], priorAnnualRiderVisits: 9,
    approvedThroughVisit: 10, priorAnnualRiderPaid: "abc" });
  check("승인 회차 부족 + 지급보험금 무효 → 승인 안내가 우선",
    !threw(appr) && appr.r.status === "PENDING_UNVERIFIED"
    && notes(appr).includes("적용된 보상 승인 회차는")
    && !notes(appr).includes("기존 지급보험금"), notes(appr).slice(0, 55));
  // 승인 축 값 오류도 먼저다.
  const apprBad = call({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    rider: "manual_therapy", amounts: [AMT], priorAnnualRiderVisits: 0,
    approvedThroughVisit: 15, priorAnnualRiderPaid: "abc" });
  check("승인 회차 값 오류 + 지급보험금 무효 → 승인 안내가 우선",
    !threw(apprBad) && notes(apprBad).includes("보상 승인 회차는")
    && !notes(apprBad).includes("기존 지급보험금"), notes(apprBad).slice(0, 55));
  // 반대로 앞선 입력이 모두 유효하면 지급보험금 안내가 나온다.
  const only = call(GEN({ priorAnnualInsurancePaid: "abc" }));
  check("앞선 입력이 모두 유효하면 지급보험금 안내가 나온다",
    isBlocked(only, AMT) && notes(only).includes("기존 지급보험금(priorAnnualInsurancePaid)"));
}

console.log("\n[G-17] 7. blocked() 계약 — totalAmount 보존");
{
  for (const [label, amounts, want] of [
    ["1건", [AMT], AMT], ["2건", [AMT, 150_000], 450_000], ["0원 포함", [0, AMT], AMT], ["빈 배열", [], 0],
  ] as [string, number[], number][]) {
    const x = call(GEN({ amounts, priorAnnualInsurancePaid: "abc" }));
    check(`${label}: totalAmount ${want} 보존`, isBlocked(x, want), shape(x));
  }
  const x = call(GEN({ priorAnnualInsurancePaid: "abc" }));
  check("합계 두 축은 null, lines는 비어 있다",
    !threw(x) && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
    && x.r.lines.length === 0 && x.r.appliedCaps.length === 0, shape(x));
  check("G-16의 unusable(총액 0)을 쓰지 않는다", !threw(x) && x.r.totalAmount !== 0);
}

console.log("\n[G-17] 8. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("활성 축 하나만 읽는다",
    /const paidKey = rider === "none" \? "priorAnnualInsurancePaid" : "priorAnnualRiderPaid";/.test(body)
    && /const paidRaw = readCount\(input, paidKey\);/.test(body));
  check("값 검증이 badCount를 쓴다", /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{/.test(body));
  check("undefined는 통과시킨다", /paidRaw !== undefined &&/.test(body));
  check("기존 blocked()로 반환한다(unusable이 아니다)",
    /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{\n\s*return blocked\(\[/.test(body));
  check("안내는 typeof만 쓴다", /받은 값의 형식: \$\{typeof paidRaw\}/.test(body));
  check("안내에 JSON.stringify를 쓰지 않는다", !/받은 값의 형식: \$\{JSON\.stringify/.test(body));
  check("일반·특약 안내를 나눠 쓴다",
    /기존 지급보험금\(priorAnnualInsurancePaid\)/.test(body) && /이 특약의 기존 지급보험금\(priorAnnualRiderPaid\)/.test(body));
  check("nonNegInt를 지우지 않았다", /const nonNegInt = \(value: number \| undefined\) =>/.test(body));
  check("nonNegInt의 정의가 그대로다",
    /value !== undefined && Number\.isFinite\(value\) \? Math\.max\(0, Math\.floor\(value\)\) : 0;/.test(body));
  check("annualCoverageLimit은 여전히 nonNegInt의 관용을 쓴다",
    /input\.annualCoverageLimit === undefined \|\| nonNegInt\(input\.annualCoverageLimit\) <= 0/.test(body));
  check("paid는 검증 뒤에 만든다", /let paid = nonNegInt\(paidRaw as number \| undefined\);/.test(body));
  // 순서: G-16 금액 → 횟수 → 승인 preflight → 지급보험금 → 계산
  const iAmt = body.indexOf("Array.isArray(rawAmounts)");
  const iCnt = body.indexOf('readCount(input, "priorAnnualOutpatientVisits")');
  const iApr = body.indexOf("countedThisBatch > 0 && visits + countedThisBatch > approved");
  const iPaid = body.indexOf("if (paidRaw !== undefined && badCount(paidRaw))");
  const iLoop = body.indexOf("amounts.forEach((amount, index) =>");
  check("검증 순서: 금액 → 횟수 → 승인 → 지급보험금 → 계산",
    iAmt > 0 && iAmt < iCnt && iCnt < iApr && iApr < iPaid && iPaid < iLoop,
    `${iAmt}/${iCnt}/${iApr}/${iPaid}/${iLoop}`);
  // 범위 밖이 그대로인지.
  check("비활성 축 stray 거부를 넣지 않았다",
    !/priorAnnualRiderPaid.*전용|미사용 축.*priorAnnualInsurancePaid/.test(body));
  check("기존 안내 6곳의 JSON.stringify는 그대로",
    (body.match(/받은 값: \$\{JSON\.stringify\(/g) ?? []).length === 6,
    String((body.match(/받은 값: \$\{JSON\.stringify\(/g) ?? []).length));
  check("G-16 금액 계약이 그대로",
    /if \(!Array\.isArray\(rawAmounts\)\)/.test(body) && /if \(!Number\.isSafeInteger\(totalInput\)\)/.test(body)
    && /const unusable = \(notes: string\[\]\): MultiClaimResult => \(\{/.test(body));
  const std = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("2·3세대 엔진은 손대지 않았다", (std.match(/받은 값: \$\{JSON\.stringify\(/g) ?? []).length === 4);
  const g5 = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("5세대 엔진은 손대지 않았다", /const consumes = amount > 0 &&/.test(g5));
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
  check("UI는 축을 계속 분리해 전달한다",
    /priorAnnualRiderPaid: isRider \? money\.priorPaid : undefined,/.test(ui)
    && (ui.match(/priorAnnualInsurancePaid: money\.priorPaid,/g) ?? []).length === 3);
}

console.log(`\n[G-17 활성 지급보험금 축 값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
