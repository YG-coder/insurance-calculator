// G-18 — 4세대 다회 엔진의 **연간 보험가입금액 축**(annualCoverageLimit) 값 검증과
//   관용 파서 `nonNegInt()`의 파일 내 완전 제거.
//
// 종전 동작(기준선 6f3eef0 엔진 직접 호출로 실측, UI 미경유):
//   `const selectedLimit = input.annualCoverageLimit === undefined
//        || nonNegInt(input.annualCoverageLimit) <= 0
//      ? undefined : Math.min(nonNegInt(input.annualCoverageLimit), GEN2021.annualLimitMaximum);`
//   nonNegInt는 `Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0`이라 방향이 갈렸다.
//     ① 문자열·음수·NaN·±Infinity·null·불리언·객체·배열·bigint·Symbol·순환 참조 → 조용히 **0**
//        → 이 축에서 0은 "미입력"으로 읽혀 **연간 한도가 통째로 사라졌다** → 보험금 과다 산출.
//        실측(비급여 통원, 청구 300,000, 기존 지급 400,000, 정답 한도 500,000):
//          정답 500000 → ins 100,000 / "500000"·-500000·NaN·{}·0.5 → 모두 ins 200,000.
//        그러면서 안내는 "증권의 금액을 입력하지 않아"라고 말했다 — 값을 넘겼는데도.
//     ② 소수 → 조용히 내림 → 한도가 입력값보다 **작아졌다** → 보험금 과소 산출.
//        실측(기존 지급 100,000): limit 100001 → ins 1 인데 limit 100000.9 → ins 0
//        (= 100000과 같은 결과). 내림이 실제로 금액을 바꿨다.
//     ③ 안전 정수 범위를 넘는 값(MAX_SAFE+1)은 5천만원 상한으로 잘려 통과했다.
//   ⚠ 이 축은 런타임 예외를 내지 않았다 — `Number.isFinite`가 bigint·객체를 걸러 던지지
//     않기 때문이다. 문제는 예외가 아니라 **조용히 틀린 금액**이다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 일반 축(rider === "none")의 annualCoverageLimit 값 검증(무효값 → 기존 blocked()),
//     명시적 `0`의 **안내 분리**, 그리고 이 파일에서 `nonNegInt()` 완전 제거.
//   - 하지 않는다: `undefined`와 숫자 `0`의 **계산 결과 변경**(둘 다 종전대로 한도 미적용),
//     5천만원 상한 절삭의 변경, 특약 경로의 미사용 축 stray 거부(후속 항목 — 조용한 폐기
//     동작 그대로), 기존 안내 6곳의 JSON.stringify 안전 표시, 지급보험금 축 계약 변경,
//     5세대·2·3세대 엔진 변경(그 파일들은 각자 `nonNegInt` 사본을 가지며 손대지 않는다).
//
// ⚠ `0`을 한도 미적용으로 보는 것은 **이 계산기의 정책**이지 약관 해석이 아니다.
//   표준약관에서 직접 읽어 확인한 것은 가입금액의 최대치(5천만원)뿐이고, 0원이 실제로
//   선택 가능한 계약값인지는 원문에서 확인하지 않았다. 그래서 이번 커밋은 0의 계산을
//   바꾸지 않고 안내만 "계산기가 이렇게 다뤘다"로 분리한다.
//
// 검증 순서: G-16 금액 → 기존 횟수·승인 → G-17 지급보험금 → **연간 가입금액** → 계산.
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
/** 결과 전체 모양 — 계산 무회귀를 값 하나가 아니라 모양으로 본다. */
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/lines=${x.r.lines.length}/caps=[${[...x.r.appliedCaps].sort().join(",")}]`;
/** 기존 blocked() 계약 — 진료비 합계는 보존한다. */
const isBlocked = (x: Caught, amt: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === amt && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && x.r.lines.length === 0;

// 화면이 만들 수 없는 값이다 — 엔진 직접 호출 계약 전용 검사다.
const circ: Record<string, unknown> = {}; circ.self = circ;
const AMT = 300_000;
/** 일반 비급여 통원. 한도 미적용이면 ins 200,000(회당 20만원 한도가 구속). */
const GEN = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", visit: "outpatient",
  amounts: [AMT], priorAnnualOutpatientVisits: 0, ...extra,
});
/** 특약(주사료) — 이 축을 쓰지 않는 경로. */
const RID = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "injection",
  amounts: [AMT], priorAnnualRiderVisits: 0, ...extra,
});

const BAD: [string, unknown][] = [
  ["문자열 숫자", "500000"], ["문자열 abc", "abc"], ["빈 문자열", ""],
  ["음수", -500_000], ["음수 -1", -1], ["소수", 500_000.9], ["소수 0.5", 0.5],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity], ["null", null],
  ["true", true], ["false", false], ["{}", {}], ["[]", []], ["[500000]", [500_000]],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ["bigint", 500_000n],
  ["순환 참조", circ], ["Symbol", Symbol("s")],
];

const NOTE_UNSET = "증권의 금액을 입력하지 않아 연간 지급 한도는 적용하지 않았습니다";
const NOTE_ZERO = "연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다";
const NOTE_CLAMP = "약관상 최대 5천만원을 넘어 5천만원으로 적용했습니다";
const NOTE_BAD = "연간 보험가입금액(annualCoverageLimit)은 0 이상의 안전한 정수";
const NEUTRAL = "계산기가 잘못된 값을 임의로 고치지 않습니다";

console.log("\n[G-18] 1. 정상 값 무회귀 — 계산 결과를 바꾸지 않는다");
{
  check("미전달 → ins 200,000", ins(call(GEN())) === "200000", ins(call(GEN())));
  check("숫자 0 → 미전달과 계산이 같다(한도 미적용)",
    shape(call(GEN({ annualCoverageLimit: 0 }))) === shape(call(GEN())),
    shape(call(GEN({ annualCoverageLimit: 0 }))));
  check("1 → 한도가 구속한다(ins 1)", ins(call(GEN({ annualCoverageLimit: 1 }))) === "1");
  check("500,000 → ins 200,000(한도가 구속하지 않는다)",
    ins(call(GEN({ annualCoverageLimit: 500_000 }))) === "200000");
  check("500,000 + 기존 지급 400,000 → ins 100,000",
    ins(call(GEN({ annualCoverageLimit: 500_000, priorAnnualInsurancePaid: 400_000 }))) === "100000");
  check("상한과 같은 5천만원 → 통과(클램프 안내 없음)",
    ins(call(GEN({ annualCoverageLimit: 50_000_000 }))) === "200000"
    && !notes(call(GEN({ annualCoverageLimit: 50_000_000 }))).includes(NOTE_CLAMP));
  check("상한 초과 6천만원 → 5천만원으로 절삭 + 클램프 안내",
    ins(call(GEN({ annualCoverageLimit: 60_000_000 }))) === "200000"
    && notes(call(GEN({ annualCoverageLimit: 60_000_000 }))).includes(NOTE_CLAMP));
  check("MAX_SAFE(안전 정수) → 거부하지 않고 클램프",
    ins(call(GEN({ annualCoverageLimit: Number.MAX_SAFE_INTEGER }))) === "200000"
    && notes(call(GEN({ annualCoverageLimit: Number.MAX_SAFE_INTEGER }))).includes(NOTE_CLAMP));
  check("절삭이 실제로 5천만원 경계에서 일어난다",
    ins(call(GEN({ annualCoverageLimit: 60_000_000, priorAnnualInsurancePaid: 49_900_000 }))) === "100000",
    ins(call(GEN({ annualCoverageLimit: 60_000_000, priorAnnualInsurancePaid: 49_900_000 }))));
  check("상한 상수가 그대로", GEN2021.annualLimitMaximum === 50_000_000);
}

console.log("\n[G-18] 2. 미입력과 명시적 0원의 안내를 나눈다");
{
  const u = call(GEN());
  const z = call(GEN({ annualCoverageLimit: 0 }));
  check("미전달 → '입력하지 않아' 안내", notes(u).includes(NOTE_UNSET));
  check("미전달 → 0원 안내는 나오지 않는다", !notes(u).includes(NOTE_ZERO));
  check("숫자 0 → 0원 전용 안내", notes(z).includes(NOTE_ZERO), notes(z).slice(0, 70));
  check("숫자 0 → '입력하지 않아' 안내는 더 이상 나오지 않는다", !notes(z).includes(NOTE_UNSET));
  check("두 안내는 동시에 나오지 않는다",
    [u, z].every((x) => Number(notes(x).includes(NOTE_UNSET)) + Number(notes(x).includes(NOTE_ZERO)) === 1));
  check("한도를 적용한 경우에는 둘 다 나오지 않는다",
    !notes(call(GEN({ annualCoverageLimit: 500_000 }))).includes(NOTE_UNSET)
    && !notes(call(GEN({ annualCoverageLimit: 500_000 }))).includes(NOTE_ZERO));
  // ⚠ 0원 안내는 계산기 정책만 말한다. 약관상 의미·계약 유효성을 단정하지 않는다.
  check("0원 안내가 계산기 정책임을 밝힌다", notes(z).includes("계산기에서는"));
  check("0원 안내가 약관상 의미를 단정하지 않는다",
    !/0원[^\n]{0,40}(약관|무효|가입하지|보장하지|해당하지)/.test(notes(z))
    && !/(약관|법)[^\n]{0,30}0원/.test(notes(z)), notes(z));
  // 네 경로 모두 같은 계약이다.
  for (const [label, base] of [
    ["급여 통원", { cause: "disease", coverage: "benefit", visit: "outpatient", amounts: [AMT] }],
    ["급여 입원", { cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [AMT] }],
    ["비급여 입원", { cause: "disease", coverage: "non_benefit", visit: "inpatient", amounts: [AMT] }],
  ] as [string, Record<string, unknown>][]) {
    check(`${label}: 0원 → 전용 안내`, notes(call({ ...base, annualCoverageLimit: 0 })).includes(NOTE_ZERO));
    check(`${label}: 0원의 계산은 미전달과 같다`,
      shape(call({ ...base, annualCoverageLimit: 0 })) === shape(call(base)),
      shape(call({ ...base, annualCoverageLimit: 0 })));
  }
}

console.log("\n[G-18] 3. 무효값 차단");
{
  for (const [label, v] of BAD) {
    const x = call(GEN({ annualCoverageLimit: v }));
    check(`${label} → 예외 없이 blocked`, isBlocked(x, AMT), shape(x));
    check(`${label} → 전용 안내`, notes(x).includes(NOTE_BAD), notes(x).slice(0, 45));
    check(`${label} → 종전 '입력하지 않아' 안내가 나오지 않는다`, !notes(x).includes(NOTE_UNSET));
  }
  check("안내에 받은 값의 형식이 들어간다",
    notes(call(GEN({ annualCoverageLimit: "abc" }))).includes("받은 값의 형식: string")
    && notes(call(GEN({ annualCoverageLimit: {} }))).includes("받은 값의 형식: object")
    && notes(call(GEN({ annualCoverageLimit: 500_000n }))).includes("받은 값의 형식: bigint")
    && notes(call(GEN({ annualCoverageLimit: Symbol("s") }))).includes("받은 값의 형식: symbol"));
  check("한도가 결과를 바꾸지 않는 격자에서도 차단한다(형식은 형식이다)",
    isBlocked(call(GEN({ annualCoverageLimit: "abc", amounts: [] })), 0));
}

console.log("\n[G-18] 3b. 안내가 방향을 단정하지 않는다 — 반대 방향 두 사례 실측");
{
  // ⚠ 종전 동작은 값에 따라 **반대로** 갈렸다(파일 머리말의 실측 참조).
  //   ① 문자열 "500000" — 0이 되어 한도가 사라졌다(보험금이 많아짐)
  //   ② 소수 100000.9  — 내림되어 한도가 작아졌다(보험금이 적어짐)
  const cases: [string, unknown][] = [
    ["문자열 '500000'(종전 한도 소멸)", "500000"],
    ["음수 -500000(종전 한도 소멸)", -500_000],
    ["소수 100000.9(종전 내림)", 100_000.9],
  ];
  const seen: string[] = [];
  for (const [label, v] of cases) {
    const x = call(GEN({ annualCoverageLimit: v }));
    check(`${label} → 차단`, isBlocked(x, AMT), shape(x));
    check(`${label} → 같은 중립 문구`, notes(x).includes(NEUTRAL), notes(x).slice(0, 60));
    seen.push(threw(x) ? "THROW" : x.r.notes.slice(0, 2).join(" | "));
  }
  check("세 사례의 안내(형식 줄 제외)가 완전히 같다",
    seen[0] === seen[1] && seen[1] === seen[2], seen.join("  ≠  "));

  const noteText = BAD.flatMap(([, v]) => {
    const x = call(GEN({ annualCoverageLimit: v })); return threw(x) ? [] : x.r.notes;
  }).join("\n");
  // ── 차단 안내 본문 전수 검사 ─────────────────────────────────────────
  //   대상이 무효값 20종의 차단 안내 **전체 텍스트**이므로, 그 텍스트에 한해 빠짐없다.
  check("차단 안내 본문에 방향 낱말이 들어 있지 않다",
    !/과다|과소|많이 산출|적게 산출/.test(noteText), (noteText.match(/과다|과소|많이 산출|적게 산출/) ?? [""])[0]);
  check("중립 문구가 실제로 쓰인다", noteText.includes(NEUTRAL));

  // ── 되돌림 방지: 낱말·거리 패턴 ────────────────────────────────────
  //   ⚠ **범위를 분명히 한다.** 저장소 전체의 방향 단정을 잡는 의미 보장이 아니라,
  //     아래 텍스트에서 `(항상|모두|전부|언제나)` 뒤 20자 안에 방향 낱말이 오는지만 보는
  //     낱말·거리 패턴 검사다. 다르게 쓴 단정이나 20자보다 먼 조합은 잡지 못한다.
  //   ⚠ 패턴은 이어 붙여 만든다. 한 덩어리 리터럴로 적으면 이 파일 자신이 걸린다.
  const ALWAYS_DIR = new RegExp("(항상|모두|전부|언제나)[^\\n]{0,20}(" + "과" + "다|" + "과" + "소)");
  for (const [label, text] of [
    ["차단 안내 본문", noteText],
    ["multiClaim2021.ts", readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8")],
    ["이 테스트", readFileSync("tests/gen2021AnnualLimitValue.test.ts", "utf8")],
  ] as [string, string][]) {
    const m = text.match(ALWAYS_DIR);
    check(`${label}: 전부·항상 계열 낱말 뒤 20자 안에 방향 낱말이 없다`, m === null, m ? m[0] : "");
  }
  // ── 되돌림 방지: 0원 안내가 약관 근거를 달지 않는다 ─────────────────
  //   ⚠ **범위를 분명히 한다.** 대상은 **사용자에게 나가는 안내 텍스트뿐**이다.
  //     소스·테스트·문서의 주석은 대상이 아니다 — 그쪽은 "약관에서 확인하지 않았다"를
  //     설명해야 하므로 같은 낱말이 정당하게 등장하고, 낱말로 막으면 그 설명이 막힌다.
  //   ⚠ 이것도 낱말·거리 패턴이다. 안내 텍스트에서 "0원" 앞뒤 30자 안에 약관 근거
  //     낱말이 붙는지만 본다. 다르게 쓴 단정은 잡지 못한다. 안내가 계산기 정책임을
  //     밝히는지는 위 2절의 "계산기에서는" 검사가 함께 맡는다.
  const ZERO_LEGAL = new RegExp("(0원[^\\n]{0,30}(약" + "관상|약" + "관에|약" + "관은|약" + "관의))|((약" + "관상|약" + "관에|약" + "관은|약" + "관의)[^\\n]{0,30}0원)");
  const userNotes = noteText + "\n" + notes(call(GEN({ annualCoverageLimit: 0 })))
    + "\n" + notes(call(GEN())) + "\n" + notes(call(GEN({ annualCoverageLimit: 60_000_000 })));
  const zm = userNotes.match(ZERO_LEGAL);
  check("사용자 안내 텍스트: 0원 근처 30자 안에 약관 근거 낱말이 없다", zm === null, zm ? zm[0] : "");
  check("검사 대상 안내가 실제로 비어 있지 않다",
    userNotes.includes(NOTE_ZERO) && userNotes.includes(NOTE_UNSET) && userNotes.includes(NOTE_BAD));
}

// ⚠ **계약이 바뀌었다(G-30).** G-18 시점에는 특약 경로가 이 축을 **조용히 폐기**했고
//   (접근자 호출 0회) 그 사실 자체를 여기서 고정하고 있었다. 후속 항목으로 남겼던 그
//   조용한 폐기를 G-30이 닫았다 — 이제 값이 `0`이어도 차단한다. 특약의 연간 보상한도는
//   특약 <표>가 항목별로 따로 정하므로 일반 가입금액 축을 쓰지 않는다.
console.log("\n[G-18] 4. 특약 경로는 이 축을 쓰지 않고 **차단**한다 (G-30에서 전환)");
{
  const STRAY_HEAD = "연간 보험가입금액(annualCoverageLimit)은 일반 급여·비급여 보";
  for (const [label, v] of [["숫자 0", 0], ["정상값", 500_000], ...BAD] as [string, unknown][]) {
    const x = call(RID({ annualCoverageLimit: v }));
    check(`특약 + ${label} → stray 차단(진료비 합계 보존)`,
      isBlocked(x, AMT) && notes(x).includes(STRAY_HEAD), shape(x));
  }
  check("특약 경로에는 가입금액 **적용** 안내가 하나도 나오지 않는다",
    !notes(call(RID({ annualCoverageLimit: 0 }))).includes(NOTE_ZERO)
    && !notes(call(RID())).includes(NOTE_UNSET)
    && !notes(call(RID({ annualCoverageLimit: 60_000_000 }))).includes(NOTE_CLAMP));
  check("축을 싣지 않으면 특약은 종전대로 계산한다", shape(call(RID())) === shape(call(RID())));
  for (const rider of ["manual_therapy", "injection", "mri"]) {
    const base: Record<string, unknown> = { cause: "disease", coverage: "non_benefit", visit: "outpatient",
      rider, amounts: [AMT], ...(rider === "mri" ? {} : { priorAnnualRiderVisits: 0 }) };
    check(`특약 ${rider}: 가입금액이 실리면 값과 무관하게 차단한다`,
      isBlocked(call({ ...base, annualCoverageLimit: "abc" }), AMT)
      && isBlocked(call({ ...base, annualCoverageLimit: 0 }), AMT));
    check(`특약 ${rider}: 축이 없으면 종전대로 계산한다`, ins(call(base)) === "210000");
  }
}

console.log("\n[G-18] 4b. 특약 경로는 이 이름을 **읽지도** 않는다(접근자 실행 없음)");
{
  // ⚠ 엔진 직접 호출 계약 전용 검사다. 값 자체가 아니라 **읽는 행위**를 본다 — 쓰지 않는
  //   축을 읽으면 외부 객체의 접근자(getter)가 실행되고, 그 접근자가 던지면 특약 묶음
  //   전체가 예외로 죽는다. 검증을 건너뛰는 것만으로는 이 계약이 지켜지지 않는다.
  // ⚠ **계약이 바뀌었다(G-30).** 조용한 폐기를 막으려면 값을 **읽어야** 하므로, 특약 경로도
  //   이제 이 이름을 정확히 한 번 읽는다. 던지는 접근자의 예외가 전파되는 대상은 **종전에
  //   조용히 폐기하며 성공하던 입력뿐**이고, 다른 축이 이미 무효라 앞에서 차단되던 입력은
  //   종전 그대로다(아래 4c절이 고정한다).
  let reads = 0;
  const counting = { ...RID(), get annualCoverageLimit(): number { reads++; return 500_000; } };
  const rr = call(counting);
  check("특약 경로: 접근자를 정확히 한 번 읽는다", reads === 1, `reads=${reads}`);
  check("특약 경로: 읽은 값으로 stray를 차단한다", isBlocked(rr, AMT), shape(rr));

  const boom = { ...RID(), get annualCoverageLimit(): number { throw new Error("touched"); } };
  check("특약 경로: 던지는 접근자는 전파된다(막으려면 읽어야 한다)", threw(call(boom)));
  // 선행 차단 경로에서는 종전 그대로 읽지 않는다.
  let pre = 0;
  const preBlocked = { ...RID({ amounts: ["abc"] }), get annualCoverageLimit(): number { pre++; return 1; } };
  check("특약 경로: 진료비가 먼저 무효면 접근자 0회(종전 그대로)", (call(preBlocked), pre === 0), `reads=${pre}`);
  check("특약 경로: 진료비가 먼저 무효면 던지는 접근자도 안전(종전 그대로)",
    !threw(call({ ...RID({ amounts: ["abc"] }), get annualCoverageLimit(): number { throw new Error("x"); } })));

  // 일반 축에서는 반대로 **정확히 한 번** 읽는다(같은 값을 두 번 읽어 달라지면 안 된다).
  let g = 0;
  const genCounting = { ...GEN(), get annualCoverageLimit(): number { g++; return 500_000; } };
  const gr = call(genCounting);
  check("일반 축: 접근자를 정확히 한 번 읽는다", g === 1, `reads=${g}`);
  check("일반 축: 읽은 값이 실제로 한도로 적용된다", ins(gr) === "200000" && ins(call(GEN({ annualCoverageLimit: 500_000 }))) === "200000");
  let g2 = 0;
  const genBad = { ...GEN(), get annualCoverageLimit(): unknown { g2++; return "abc"; } };
  check("일반 축: 무효값을 돌려주는 접근자도 차단된다", isBlocked(call(genBad), AMT) && g2 === 1, `reads=${g2}`);
}

console.log("\n[G-18] 5. 안내 우선순위 — 금액 → 횟수·승인 → 지급보험금 → 가입금액");
{
  const badAmt = call(GEN({ amounts: ["abc"], annualCoverageLimit: "abc" }));
  check("진료비 무효 + 가입금액 무효 → 진료비 안내가 우선(totalAmount 0)",
    !threw(badAmt) && badAmt.r.totalAmount === 0 && !notes(badAmt).includes(NOTE_BAD), notes(badAmt).slice(0, 55));
  const noCnt = call({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    amounts: [AMT], annualCoverageLimit: "abc" });
  check("횟수 미입력 + 가입금액 무효 → 횟수 안내가 우선",
    isBlocked(noCnt, AMT) && notes(noCnt).includes("이미 사용한 통원 횟수") && !notes(noCnt).includes(NOTE_BAD),
    notes(noCnt).slice(0, 55));
  const badCnt = call(GEN({ priorAnnualOutpatientVisits: -1, annualCoverageLimit: "abc" }));
  check("횟수 값 오류 + 가입금액 무효 → 횟수 안내가 우선",
    isBlocked(badCnt, AMT) && !notes(badCnt).includes(NOTE_BAD), notes(badCnt).slice(0, 55));
  const badPaid = call(GEN({ priorAnnualInsurancePaid: "abc", annualCoverageLimit: "abc" }));
  check("지급보험금 무효 + 가입금액 무효 → 지급보험금 안내가 우선",
    isBlocked(badPaid, AMT) && notes(badPaid).includes("기존 지급보험금(priorAnnualInsurancePaid)")
    && !notes(badPaid).includes(NOTE_BAD), notes(badPaid).slice(0, 55));
  const only = call(GEN({ annualCoverageLimit: "abc" }));
  check("앞선 입력이 모두 유효하면 가입금액 안내가 나온다", isBlocked(only, AMT) && notes(only).includes(NOTE_BAD));
}

console.log("\n[G-18] 6. blocked() 계약 — totalAmount 보존");
{
  for (const [label, amounts, want] of [
    ["1건", [AMT], AMT], ["2건", [AMT, 150_000], 450_000], ["0원 포함", [0, AMT], AMT], ["빈 배열", [], 0],
  ] as [string, number[], number][]) {
    const x = call(GEN({ amounts, annualCoverageLimit: "abc" }));
    check(`${label}: totalAmount ${want} 보존`, isBlocked(x, want), shape(x));
  }
  const x = call(GEN({ annualCoverageLimit: "abc" }));
  check("합계 두 축은 null, lines·caps는 비어 있다",
    !threw(x) && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
    && x.r.lines.length === 0 && x.r.appliedCaps.length === 0, shape(x));
  check("G-16의 unusable(총액 0)을 쓰지 않는다", !threw(x) && x.r.totalAmount !== 0);
}

console.log("\n[G-18] 7. 소스 계약 — nonNegInt 완전 제거와 검증 위치");
{
  const raw = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  // ⚠ **낡은 계약을 교체했다.** gen2021AmountEngineContract·gen2021OutpatientCounterInput·
  //   gen2021PaidAxisValue·gen2021MoneyInput은 "nonNegInt가 그대로 남아 있다"와
  //   "annualCoverageLimit은 아직 그 관용을 쓴다"를 고정하고 있었다. 이번 커밋이 그 두
  //   사실을 모두 끝내므로 해당 검사를 이 파일의 계약으로 옮기고 그쪽은 갱신한다.
  check("nonNegInt 정의가 소스에서 사라졌다", !/const nonNegInt\s*=/.test(raw), (raw.match(/const nonNegInt[^\n]*/) ?? [""])[0]);
  check("nonNegInt 호출이 코드에 하나도 없다", !/nonNegInt\(/.test(body), (body.match(/nonNegInt\([^\n]*/) ?? [""])[0]);
  // ⚠ `Math.floor`는 <표1> 승인 회차 후보 **개수**를 두 상수에서 파생하는 한 곳에만 남는다.
  //   입력값을 내리는 자리가 아니다. 전면 금지로 적으면 그 정당한 파생까지 막는다.
  {
    const floors = body.match(/Math\.floor\([^\n]*/g) ?? [];
    const around = body.indexOf("Math.floor(") < 0 ? ""
      : body.slice(body.indexOf("Math.floor("), body.indexOf("Math.floor(") + 220);
    check("Math.floor는 승인 회차 후보 개수 계산 한 곳뿐이다",
      floors.length === 1 && /GEN2021\.rider\.manual_therapy\.annualVisits/.test(around), floors.join(" | "));
  }
  check("읽어 온 원값(*Raw)에 내림·클램프를 걸지 않는다",
    !/Math\.(floor|ceil|round|max|min)\([^)]*Raw/.test(body),
    (body.match(/Math\.(floor|ceil|round|max|min)\([^)]*Raw[^\n]*/) ?? [""])[0]);
  check("Number.isFinite 기반 관용 정규화가 남아 있지 않다",
    !/Number\.isFinite\([^)]*\)\s*\?\s*Math\.max/.test(body));
  // 검증과 파생값.
  // ⚠ **일반 축일 때만 읽는다.** 특약 경로에서 이름에 접근하는 것만으로 외부 객체의 getter가
  //   실행되므로, "보지 않는다"는 계약은 검증을 건너뛰는 것이 아니라 **읽지 않는 것**이어야 한다.
  check("원문을 일반 축일 때만 읽는다",
    /const limitRaw = rider === "none" \? readCount\(input, "annualCoverageLimit"\) : undefined;/.test(body));
  check("readCount로 이 이름을 읽는 곳이 그 한 줄뿐이다",
    (body.match(/readCount\(input, "annualCoverageLimit"\)/g) ?? []).length === 1
    && !/input\.annualCoverageLimit/.test(body)
    && !/\["annualCoverageLimit"\]/.test(body));
  check("값 검증이 badCount를 쓴다", /if \(limitRaw !== undefined && badCount\(limitRaw\)\) \{/.test(body));
  check("기존 blocked()로 반환한다(unusable이 아니다)",
    /if \(limitRaw !== undefined && badCount\(limitRaw\)\) \{\n\s*return blocked\(\[/.test(body));
  check("안내는 typeof만 쓴다", /받은 값의 형식: \$\{typeof limitRaw\}/.test(body));
  check("안내에 JSON.stringify를 쓰지 않는다", !/받은 값의 형식: \$\{JSON\.stringify/.test(body));
  check("selectedLimit을 검증된 원값으로 만든다",
    /const limit = limitRaw as number \| undefined;/.test(body)
    && /const selectedLimit = limit === undefined \|\| limit === 0\n\s*\? undefined\n\s*: Math\.min\(limit, GEN2021\.annualLimitMaximum\);/.test(body));
  check("paid도 검증된 원값을 그대로 쓴다",
    /let paid = \(paidRaw as number \| undefined\) \?\? 0;/.test(body));
  check("클램프 안내도 검증된 원값으로 판단한다",
    /if \(rider === "none" && limit !== undefined && limit > GEN2021\.annualLimitMaximum\) \{/.test(body));
  check("0원 안내가 숫자 0에만 걸린다", /if \(rider === "none" && limit === 0\) \{/.test(body));
  check("미입력 안내가 undefined에만 걸린다", /if \(rider === "none" && limit === undefined\) \{/.test(body));
  check("input.annualCoverageLimit을 더 이상 직접 읽지 않는다", !/input\.annualCoverageLimit/.test(body));
  // 순서: 금액 → 횟수 → 승인 → 지급보험금 → 가입금액 → 계산
  const iAmt = body.indexOf("Array.isArray(rawAmounts)");
  const iCnt = body.indexOf('readCount(input, "priorAnnualOutpatientVisits")');
  const iApr = body.indexOf("countedThisBatch > 0 && visits + countedThisBatch > approved");
  const iPaid = body.indexOf("if (paidRaw !== undefined && badCount(paidRaw))");
  const iLim = body.indexOf("if (limitRaw !== undefined && badCount(limitRaw))");
  const iLoop = body.indexOf("amounts.forEach((amount, index) =>");
  check("검증 순서: 금액 → 횟수 → 승인 → 지급보험금 → 가입금액 → 계산",
    iAmt > 0 && iAmt < iCnt && iCnt < iApr && iApr < iPaid && iPaid < iLim && iLim < iLoop,
    `${iAmt}/${iCnt}/${iApr}/${iPaid}/${iLim}/${iLoop}`);
  // 범위 밖이 그대로인지.
  // ⚠ **낡은 계약을 교체했다.** 이 검사는 "기존 안내 6곳의 JSON.stringify는 이번 범위 밖"을
  //   고정하고 있었다. G-19가 그 6곳을 지역 `showValue()`로 낮췄으므로(bigint·순환 참조·
  //   `toJSON()` 예외에서 안내를 만들다 죽던 것을 고쳤다), 확인 대상을 새 표시로 옮긴다.
  //   요지(이 커밋이 그 자리를 건드리지 않았다)는 같다. 새 계약은
  //   tests/multiClaimNoteSafeDisplay.test.ts가 본다.
  // ⚠ 계약 갱신(G-30): 미사용 금액 축 stray 안내가 한 곳 늘어 6 → 7이다.
  check("다른 안내 7곳은 안전 표시(showValue)를 쓴다",
    (body.match(/받은 값: \$\{showValue\(/g) ?? []).length === 7
    && !/받은 값: \$\{JSON\.stringify/.test(body),
    String((body.match(/받은 값: \$\{showValue\(/g) ?? []).length));
  check("G-16 금액 계약이 그대로",
    /if \(!Array\.isArray\(rawAmounts\)\)/.test(body) && /if \(!Number\.isSafeInteger\(totalInput\)\)/.test(body)
    && /const unusable = \(notes: string\[\]\): MultiClaimResult => \(\{/.test(body));
  check("G-17 지급보험금 계약이 그대로",
    /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{/.test(body)
    && /받은 값의 형식: \$\{typeof paidRaw\}/.test(body));
  check("badCount 정의가 그대로",
    /const badCount = \(v: unknown\): boolean =>\n\s*!\(typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0\);/.test(raw));
  // 다른 세대는 각자 사본을 가지며 손대지 않았다.
  const std = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("2·3세대 엔진은 자기 nonNegInt를 그대로 가진다", /const nonNegInt =/.test(std));
  check("2·3세대 엔진의 안내 4곳도 안전 표시로 바뀌었다(G-19)",
    (std.match(/받은 값: \$\{showValue\(/g) ?? []).length === 4
    && !/받은 값: \$\{JSON\.stringify/.test(std));
  const g5 = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  // ⚠ **낡은 계약을 교체했다(G-30).** 위치·기존 의미("이 커밋이 5세대 엔진을 손대지
  //   않았다")는 그대로다. G-30이 5세대 다회의 마지막 `nonNegInt` 사용처(누적 공제금액)를
  //   단일 읽기로 옮기면서 그 파일에서도 함수를 삭제했다.
  check("5세대 엔진에는 nonNegInt가 없다(G-30에서 제거)",
    !/nonNegInt/.test(g5.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")));
  check("5세대 엔진 계산은 손대지 않았다", /const consumes = amount > 0 &&/.test(g5));
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
  check("UI 전달 형태는 그대로",
    (ui.match(/annualCoverageLimit: money\.annualLimit,/g) ?? []).length === 3);
}

console.log(`\n[G-18 연간 보험가입금액 축 값 검증 · nonNegInt 제거] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
