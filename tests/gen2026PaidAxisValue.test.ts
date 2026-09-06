// G-20 — 5세대 다회 엔진의 **활성 지급보험금 누적 축** 값 검증.
//   대상: `multiClaim2026.ts`의 `priorAnnualInsurancePaid` (일반 비급여 직접 경로와
//   그 경로로 전환되는 일반 전환 경로가 공유한다).
//
// 종전 동작(기준선 5ce96c9 엔진 직접 호출로 실측, UI 미경유):
//   `let insurancePaid = nonNegInt(input.priorAnnualInsurancePaid);`
//   nonNegInt는 `Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0`이라
//     - 음수·NaN·±Infinity·문자열·빈 문자열·null·불리언·객체·배열·bigint·Symbol·순환 참조
//       → 조용히 **0**. 남은 한도가 실제보다 커진다.
//     - 소수 → 내림(같은 방향으로 어긋난다)
//     - 안전 정수 초과 → 검증 없이 통과
//   실측 격자:
//     비중증 통원 · 가입금액 10,000,000 · 청구 1,000,000 · 정답 기존 지급 9,900,000
//       정답 ins 100,000 → 무효값 13종 모두 ins 500,000
//     일반 전환(중증 입원 상급종합) · 가입금액 10,000,000 · 청구 2,000,000
//       정답 ins 100,000 → 무효값 13종 모두 ins 1,400,000
//   ⚠ 이 축은 **런타임 예외를 내지 않았다** — `Number.isFinite`가 bigint·객체를 걸러
//     던지지 않기 때문이다. 문제는 예외가 아니라 조용히 틀린 금액이다.
//   ⚠ 공개 화면은 도달할 수 없다. UI 파서 `gen2026Money`가 먼저 막는다(실측).
//     **엔진 직접 호출 계약** 전용 결함이다.
//
// ⚠ 종전에는 원문을 **잘못된 자리에서** 읽었다.
//   - `runBundle` 안에서 읽어, 지급 0원 HOLD의 두 해석을 비교하는 통원 경로에서 같은 이름을
//     **두 번** 읽었다(실측: 접근자 2회). 값이 두 실행 사이에 달라지면 비교가 오염된다.
//   - 급여 묶음에는 연간 보험가입금액 축 자체가 없어 이 값이 결과를 바꿀 수 없는데도
//     **읽었다**(실측: 접근자 1회). "쓰지 않는다"는 계약은 읽지 않는 것이어야 한다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 비급여 경로에서 원문을 **한 번만** 읽고 엄격 검증한다. 무효값은 기존 blocked()로
//     차단하고 진료비 합계를 보존한다.
//   - 하지 않는다: `undefined`·명시적 `0`의 계산 변경, 한도 초과 과거 지급액의 절삭,
//     `annualCoverageLimit`·`outpatientCoverageLimit`·`priorAnnualDeductible` 등 다른 축의
//     검증(후속 항목), 급여에 실려 온 stray 값의 조용한 폐기 동작 자체(후속 항목),
//     계산식·한도 상수·라우팅·UI 파서 변경, `specialItem2026`·`roomCharge2026` 변경,
//     지급 0원 HOLD의 값·상태·계산 동작 변경.
//
// 검증 순서: 급여 stray 카운터 → 레거시 priorAnnualPaid → 별도 보장종목 전용 키 →
//   치료유형 preflight → 통원 카운터 → 누적 공제금액 → **지급보험금** → 연간 가입금액 → 계산.
import { readFileSync } from "node:fs";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { MultiClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

type Caught = { threw: string } | { r: MultiClaimResult };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => unknown): Caught => {
  try { return { r: f() as MultiClaimResult }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const notes = (x: Caught) => threw(x) ? "" : (x.r.notes ?? []).join(" ¶ ");
const ins = (x: Caught) => threw(x) ? "THROW:" + x.threw : x.r.status !== "OK" ? "차단" : String(x.r.totalInsurancePay);
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/lines=${x.r.lines.length}/caps=[${[...x.r.appliedCaps].sort().join(",")}]`;
/** 이 파일의 기존 blocked() 계약 — 진료비 합계는 보존한다. */
/** 상태만 꺼낸다 — 던졌으면 "THROW". `.r?.` 옵셔널 체이닝은 유니온을 좁히지 못한다. */
const statusOf = (x: Caught) => threw(x) ? "THROW" : x.r.status;
const isBlocked = (x: Caught, amt: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === amt && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && x.r.lines.length === 0;

// 화면이 만들 수 없는 값이다 — 엔진 직접 호출 계약 전용 검사다.
const circ: Record<string, unknown> = {}; circ.self = circ;
const BAD: [string, unknown][] = [
  ["음수", -9_900_000], ["음수 -1", -1], ["소수", 9_900_000.9], ["소수 0.5", 0.5],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["문자열 숫자", "9900000"], ["빈 문자열", ""], ["null", null],
  ["true", true], ["false", false], ["{}", {}], ["[9900000]", [9_900_000]],
  ["bigint", 9_900_000n], ["Symbol", Symbol("s")], ["순환 참조", circ],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1],
];

const AMT = 1_000_000, LIMIT = 10_000_000, RIGHT = 9_900_000;
/** 비급여 직접 경로 — 비중증 통원. 한도 없으면 ins 500,000, 정답 기존 지급이면 ins 100,000. */
const NB = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical",
  visit: "outpatient", amounts: [AMT], priorAnnualOutpatientDays: 0, annualCoverageLimit: LIMIT, ...extra,
});
/** 같은 경로, 연간 가입금액 없음 — 이 값이 결과를 바꾸지 못한다. */
const NOLIMIT = (extra: Record<string, unknown> = {}) => {
  const b = NB(extra) as Record<string, unknown>; delete b.annualCoverageLimit; return b;
};
/** 급여 경로 — 연간 가입금액 축 자체가 타입에 없다. */
const BF = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic",
  nhisCoinsuranceRate: 0.3, amounts: [AMT], ...extra,
});
/** 일반 전환 경로 — route:"general"이 calculateMany2026으로 넘어간다. */
const ROUTED = (extra: Record<string, unknown> = {}) => ({
  route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
  injectionPurpose: "anticancer", cause: "injury", visit: "inpatient", tier: "hospital",
  amounts: [2_000_000], annualCoverageLimit: LIMIT, ...extra,
});

const NEUTRAL = "계산기가 잘못된 값을 임의로 고치지 않습니다";
const FIRST = "기존 지급보험금(priorAnnualInsurancePaid)은 0 이상의 안전한 정수";

console.log("\n[G-20] 1. 정상값 무회귀");
{
  check("정답 9,900,000 → ins 100,000", ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: RIGHT }) as never))) === "100000",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: RIGHT }) as never))));
  check("1 → ins 100,000보다 큼(정상 누적 반영)",
    Number(ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 1 }) as never)))) === 500_000);
  check("5,000,000 → 남은 한도 5,000,000, 회당 산식이 구속",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 5_000_000 }) as never))) === "500000");
  check("9,999,999 → ins 1", ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 9_999_999 }) as never))) === "1");
  check("MAX_SAFE(안전 정수) 허용 → ins 0",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER }) as never))) === "0");
}

console.log("\n[G-20] 2. undefined·명시적 0 무회귀");
{
  const u = wrap(() => calculateMany2026(NB() as never));
  const z = wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 0 }) as never));
  check("미전달 → ins 500,000", ins(u) === "500000", ins(u));
  check("명시적 0 → 미전달과 결과가 완전히 같다", shape(z) === shape(u), shape(z));
  check("명시적 0 → 안내도 같다", notes(z) === notes(u));
  check("둘 다 차단 안내가 나오지 않는다", !notes(u).includes(FIRST) && !notes(z).includes(FIRST));
}

console.log("\n[G-20] 3. 한도 경계·한도 초과 과거 지급액을 절삭하지 않는다");
{
  check("한도와 같은 10,000,000 → ins 0",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: LIMIT }) as never))) === "0");
  check("한도 초과 12,000,000 → 허용하고 ins 0(절삭 없음)",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 12_000_000 }) as never))) === "0");
  check("한도 초과 값도 차단하지 않는다",
    !notes(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 12_000_000 }) as never))).includes(FIRST));
  // 절삭했다면 남은 한도가 되살아나 ins가 0보다 커진다. 소스로도 고정한다(아래 8절).
  check("절삭했다면 달라질 값이 실제로 0이다",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER }) as never))) === "0");
}

console.log("\n[G-20] 4. 무효값 차단 — 비급여 직접 경로");
{
  for (const [label, v] of BAD) {
    const x = wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: v }) as never));
    check(`${label} → 예외 없이 blocked(진료비 합계 보존)`, isBlocked(x, AMT), shape(x));
    check(`${label} → 전용 안내 첫 줄`, notes(x).startsWith(FIRST), notes(x).slice(0, 45));
    check(`${label} → 중립 문구`, notes(x).includes(NEUTRAL), notes(x).slice(0, 60));
    check(`${label} → 받은 값 줄이 있다`, /받은 값: /.test(notes(x)), notes(x).slice(-40));
  }
  check("MAX_SAFE는 허용, MAX_SAFE+1은 차단",
    ins(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER }) as never))) === "0"
    && isBlocked(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER + 1 }) as never)), AMT));
  // 안내가 한쪽 지급 방향을 단정하지 않는다.
  const noteText = BAD.flatMap(([, v]) => {
    const x = wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: v }) as never));
    return threw(x) ? [] : (x.r.notes ?? []);
  }).join("\n");
  check("차단 안내 본문에 방향 낱말이 없다",
    !/과다|과소|많이 산출|적게 산출/.test(noteText), (noteText.match(/과다|과소|많이 산출|적게 산출/) ?? [""])[0]);
  check("모든 무효값이 같은 안내로 차단된다", (() => {
    const seen = new Set(BAD.map(([, v]) => {
      const x = wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: v }) as never));
      return threw(x) ? "THROW" : (x.r.notes ?? []).slice(0, 2).join(" | ");
    }));
    return seen.size === 1;
  })());
  // 약관에서 확인하지 않은 공유 범위·지급 방향을 단정하지 않는다.
  check("안내가 약관 근거를 달지 않는다", !/약관/.test(noteText), (noteText.match(/[^\n]{0,20}약관[^\n]{0,20}/) ?? [""])[0]);
}

console.log("\n[G-20] 5. bigint·Symbol·순환 참조에서도 예외 없이 안전한 안내");
{
  for (const [label, v] of [["bigint", 9_900_000n], ["Symbol", Symbol("s")], ["순환 참조", circ]] as [string, unknown][]) {
    const x = wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: v }) as never));
    check(`${label} → 예외 없음`, !threw(x), shape(x));
    check(`${label} → 안내를 끝까지 만든다`, notes(x).includes(NEUTRAL) && /받은 값: /.test(notes(x)));
  }
  check("bigint 표시가 JSON 직렬화 예외로 끊기지 않는다",
    /받은 값: 9900000$/.test(notes(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 9_900_000n }) as never)))),
    notes(wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: 9_900_000n }) as never))).slice(-30));
}

console.log("\n[G-20] 6. 연간 가입금액이 없어도 검증한다");
{
  check("한도 없음 + 정상값 → 계산됨(값은 결과를 바꾸지 않는다)",
    ins(wrap(() => calculateMany2026(NOLIMIT({ priorAnnualInsurancePaid: RIGHT }) as never))) === "500000");
  check("한도 없음 + 미전달과 결과가 같다",
    shape(wrap(() => calculateMany2026(NOLIMIT({ priorAnnualInsurancePaid: RIGHT }) as never)))
    === shape(wrap(() => calculateMany2026(NOLIMIT() as never))));
  for (const [label, v] of [["문자열", "9900000"], ["음수", -1], ["NaN", NaN], ["{}", {}], ["bigint", 1n]] as [string, unknown][]) {
    check(`한도 없음 + ${label} → 그래도 blocked`, isBlocked(wrap(() => calculateMany2026(NOLIMIT({ priorAnnualInsurancePaid: v }) as never)), AMT));
  }
}

console.log("\n[G-20] 7. 경로별 계약 — 활성 경로만 읽고, 급여는 읽지도 않는다");
{
  // 일반 전환 경로도 같은 엔진을 쓰므로 같은 계약이다.
  check("전환 경로: 정답 → ins 100,000",
    ins(wrap(() => calculateGen2026Item(ROUTED({ priorAnnualInsurancePaid: RIGHT }) as never))) === "100000",
    ins(wrap(() => calculateGen2026Item(ROUTED({ priorAnnualInsurancePaid: RIGHT }) as never))));
  check("전환 경로: 미전달 → ins 1,400,000",
    ins(wrap(() => calculateGen2026Item(ROUTED() as never))) === "1400000");
  for (const [label, v] of BAD) {
    const x = wrap(() => calculateGen2026Item(ROUTED({ priorAnnualInsurancePaid: v }) as never));
    check(`전환 경로 ${label} → blocked(진료비 합계 보존)`, isBlocked(x, 2_000_000), shape(x));
  }
  // 급여 경로는 이 축을 쓰지 않는다 — 계산은 종전 그대로이고, 값을 읽지도 않는다.
  const bfRef = shape(wrap(() => calculateMany2026(BF() as never)));
  for (const [label, v] of [["정상값", RIGHT], ...BAD] as [string, unknown][]) {
    check(`급여 + ${label} → 종전과 같은 결과(조용한 폐기 유지)`,
      shape(wrap(() => calculateMany2026(BF({ priorAnnualInsurancePaid: v }) as never))) === bfRef,
      shape(wrap(() => calculateMany2026(BF({ priorAnnualInsurancePaid: v }) as never))));
  }
  check("급여 경로에는 이 축의 차단 안내가 나오지 않는다",
    !notes(wrap(() => calculateMany2026(BF({ priorAnnualInsurancePaid: "abc" }) as never))).includes(FIRST));
}

console.log("\n[G-20] 7b. 접근자 호출 횟수 — '읽지 않는다'는 결과가 아니라 접근으로 확인한다");
{
  // ⚠ 결과가 같다는 사실로는 "읽지 않았다"를 증명할 수 없다. 접근자를 세어 직접 본다.
  const probe = (base: Record<string, unknown>, ret: unknown) => {
    let reads = 0;
    const o = { ...base };
    Object.defineProperty(o, "priorAnnualInsurancePaid",
      { get() { reads++; return ret; }, enumerable: true, configurable: true });
    const x = wrap(() => calculateMany2026(o as never));
    return { reads, x };
  };
  // 지급 0원 HOLD로 두 해석을 비교하는 통원 경로에서도 **한 번만** 읽는다.
  const a = probe(NB(), RIGHT);
  check("비중증 통원(HOLD 이중 실행): 접근자 1회", a.reads === 1, `reads=${a.reads}`);
  check("비중증 통원: 읽은 값이 실제로 한도에 반영된다", ins(a.x) === "100000", ins(a.x));
  const b = probe({ ...NB(), severity: "critical", priorAnnualOutpatientVisits: 0, priorAnnualOutpatientDays: undefined }, RIGHT);
  check("중증 통원(HOLD 이중 실행): 접근자 1회", b.reads === 1, `reads=${b.reads}`);
  // 급여 경로에서는 아예 읽지 않는다 — 던지는 접근자로도 확인한다.
  const c = probe(BF(), RIGHT);
  check("급여: 접근자 0회", c.reads === 0, `reads=${c.reads}`);
  let boomReads = 0;
  const boom = { ...BF() };
  Object.defineProperty(boom, "priorAnnualInsurancePaid",
    { get() { boomReads++; throw new Error("touched"); }, enumerable: true, configurable: true });
  const cb = wrap(() => calculateMany2026(boom as never));
  check("급여: 던지는 접근자가 있어도 예외로 죽지 않는다", !threw(cb), shape(cb));
  check("급여: 던지는 접근자가 실행되지 않았다", boomReads === 0, `reads=${boomReads}`);
  check("급여: 결과가 종전과 같다", shape(cb) === shape(wrap(() => calculateMany2026(BF() as never))));
  // 무효값도 한 번만 읽고 차단한다.
  const d = probe(NB(), "9900000");
  check("무효값도 접근자 1회 뒤 차단", d.reads === 1 && isBlocked(d.x, AMT), `reads=${d.reads} ${shape(d.x)}`);
}

console.log("\n[G-20] 8. 안내 우선순위 — 앞선 검증이 가려지지 않는다");
{
  const bad = { priorAnnualInsurancePaid: "abc" };
  // 별도 보장종목 전용 키(B군)가 먼저다.
  const strayKey = wrap(() => calculateMany2026({ ...NB(bad), priorAnnualCoveredCount: 3 } as never));
  check("별도 보장종목 전용 키가 먼저", notes(strayKey).includes("별도 보장종목") && !notes(strayKey).includes(FIRST), notes(strayKey).slice(0, 45));
  // 레거시 priorAnnualPaid(A군)가 먼저다.
  const legacy = wrap(() => calculateMany2026({ ...NB(bad), priorAnnualPaid: 1 } as never));
  check("레거시 priorAnnualPaid가 먼저", notes(legacy).includes("priorAnnualPaid는") && !notes(legacy).includes(FIRST), notes(legacy).slice(0, 45));
  // 치료유형 preflight가 먼저다.
  const noItem = wrap(() => calculateMany2026({ ...NB(bad), nonBenefitItem: undefined } as never));
  check("치료유형 preflight가 먼저", !notes(noItem).includes(FIRST), notes(noItem).slice(0, 45));
  // 통원 카운터가 먼저다.
  const noDays = wrap(() => calculateMany2026({ ...NB(bad), priorAnnualOutpatientDays: undefined } as never));
  check("통원 카운터 미입력이 먼저", notes(noDays).includes("통원일수") && !notes(noDays).includes(FIRST), notes(noDays).slice(0, 45));
  const badDays = wrap(() => calculateMany2026(NB({ ...bad, priorAnnualOutpatientDays: -1 }) as never));
  check("통원 카운터 값 오류가 먼저", notes(badDays).includes("이미 사용한 통원일수") && !notes(badDays).includes(FIRST), notes(badDays).slice(0, 45));
  // 누적 공제금액(C군)이 먼저다.
  const badDeduct = wrap(() => calculateMany2026(NB({ ...bad, priorAnnualDeductible: 1 }) as never));
  check("누적 공제금액 경로 검사가 먼저", notes(badDeduct).includes("누적 공제금액") && !notes(badDeduct).includes(FIRST), notes(badDeduct).slice(0, 45));
  // 앞선 입력이 모두 유효하면 이 축의 안내가 나온다.
  const only = wrap(() => calculateMany2026(NB(bad) as never));
  check("앞선 입력이 모두 유효하면 이 축의 안내가 나온다", isBlocked(only, AMT) && notes(only).startsWith(FIRST));
}

console.log("\n[G-20] 9. blocked() 계약 — totalAmount 보존");
{
  for (const [label, amounts, want] of [
    ["1건", [AMT], AMT], ["2건", [AMT, 500_000], 1_500_000], ["0원 포함", [0, AMT], AMT], ["빈 배열", [], 0],
  ] as [string, number[], number][]) {
    const x = wrap(() => calculateMany2026(NB({ amounts, priorAnnualInsurancePaid: "abc" }) as never));
    check(`${label}: totalAmount ${want} 보존`, isBlocked(x, want), shape(x));
  }
  const x = wrap(() => calculateMany2026(NB({ priorAnnualInsurancePaid: "abc" }) as never));
  check("합계 두 축은 null, lines·caps는 비어 있다",
    !threw(x) && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
    && x.r.lines.length === 0 && x.r.appliedCaps.length === 0, shape(x));
}

console.log("\n[G-20] 10. 다른 진입점·다른 축·HOLD 무변경");
{
  // 상급병실료·별도 보장종목은 이번 범위가 아니다 — 종전 계약 그대로다(후속 과제).
  const room = (v: unknown) => wrap(() => calculateRoomCharge2026({ route: "room_charge", coverage: "non_benefit",
    cause: "disease", severity: "non_critical", stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }],
    annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: v } as never));
  // ⚠ **낡은 계약을 교체했다.** G-20 시점에는 상급병실료가 음수 지급보험금을 통과시켜 그
  //   사실을 후속 과제 표지로 고정했다. G-22가 그 진입점을 막았으므로 확인 대상을 옮긴다.
  //   그 진입점의 새 계약은 tests/gen2026RoomChargeMoneyValue.test.ts가 본다.
  check("상급병실료: 음수도 이제 막힌다(G-22)",
    statusOf(room(-9_900_000)) === "PENDING_UNVERIFIED", shape(room(-9_900_000)));
  check("상급병실료: 문자열도 종전대로 막힌다",
    statusOf(room("9900000")) === "PENDING_UNVERIFIED", shape(room("9900000")));
  check("상급병실료: 정상값·undefined·0은 그대로 계산된다",
    statusOf(room(400_000)) === "OK" && statusOf(room(0)) === "OK" && statusOf(room(undefined)) === "OK");
  const item = (v: unknown) => wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "injection", injectionPurpose: "general",
    lines: [{ amount: AMT, visit: "outpatient", tier: "clinic" }], priorAnnualCoveredCount: 0,
    priorAnnualInsurancePaid: v } as never));
  // ⚠ **낡은 계약을 교체했다.** G-20 시점에는 별도 보장종목의 같은 이름이 아직 관용을 써서
  //   무효값이 통과했다. G-23이 그 축을 닫았으므로 확인 대상을 새 계약으로 옮긴다.
  check("별도 보장종목: 무효값도 이제 막힌다(G-23)",
    statusOf(item("9900000")) === "PENDING_UNVERIFIED"
    && shape(item("9900000")).includes("amt=0"), // rejected()는 총액을 만들지 않는다
    shape(item("9900000")));
  check("별도 보장종목: 정상값·undefined·0은 그대로 계산된다",
    statusOf(item(400_000)) === "OK" && statusOf(item(0)) === "OK" && statusOf(item(undefined)) === "OK");
  // 다른 축은 그대로다.
  // ⚠ **낡은 계약을 교체했다.** G-20 시점에는 `annualCoverageLimit`이 아직 관용을 써서 그 사실을
  //   후속 과제 표지로 고정했다. G-21이 그 축도 검증으로 바꿨으므로, 확인 대상을 "두 축이
  //   서로 독립적으로 검증된다"로 옮긴다. 그 축의 새 계약은 gen2026AnnualLimitValue가 본다.
  check("가입금액이 무효여도 지급보험금 안내가 먼저 나온다(순서 유지)",
    notes(wrap(() => calculateMany2026(NB({ annualCoverageLimit: "abc", priorAnnualInsurancePaid: "abc" }) as never)))
      .startsWith(FIRST));
  check("지급보험금이 유효하면 가입금액 안내가 나온다",
    statusOf(wrap(() => calculateMany2026(NB({ annualCoverageLimit: "abc", priorAnnualInsurancePaid: 0 }) as never))) === "PENDING_UNVERIFIED");
  // 지급 0원 HOLD의 이중 실행·차단은 그대로다.
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("HOLD 이중 실행과 fingerprint 비교가 그대로",
    /const countedA = runBundle\(true\);\n\s*const countedB = runBundle\(false\);/.test(eng)
    && /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(eng));
  check("지급 0원 HOLD 안내 상수가 그대로",
    /ZERO_PAY_VISITS_HOLD_NOTES/.test(eng) && /ZERO_PAY_DAYS_HOLD_NOTES/.test(eng));
  check("소진 판정 식이 그대로", /const consumes = amount > 0 && \(countZeroPay \|\| \(single\.insurancePay \?\? 0\) > 0\);/.test(eng));
}

console.log("\n[G-20] 11. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("원문을 비급여일 때만 읽는다",
    /const paidRaw = readCount\(nb, "priorAnnualInsurancePaid"\);/.test(body));
  // ⚠ 안내 문구 안의 필드 이름은 읽기가 아니다. **속성 접근**만 센다.
  check("이 이름을 속성으로 읽는 곳이 그 한 줄뿐이다",
    (body.match(/readCount\([^,]+, "priorAnnualInsurancePaid"\)/g) ?? []).length === 1
    && !/input\.priorAnnualInsurancePaid/.test(body)
    && !/nb\??\.priorAnnualInsurancePaid/.test(body)
    && !/\["priorAnnualInsurancePaid"\]/.test(body),
    (body.match(/[^\n]*priorAnnualInsurancePaid[^\n]*/g) ?? []).join(" | ").slice(0, 120));
  check("읽기가 runBundle 밖이다(두 해석이 같은 값에서 출발한다)",
    body.indexOf("const paidRaw =") < body.indexOf("function runBundle("));
  check("값 검증이 badCount를 쓴다", /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{/.test(body));
  check("undefined는 통과시킨다", /paidRaw !== undefined &&/.test(body));
  check("기존 blocked()로 반환한다", /if \(paidRaw !== undefined && badCount\(paidRaw\)\) \{\n\s*return blocked\(\[/.test(body));
  check("안내가 지역 showValue를 쓴다", /받은 값: \$\{showValue\(paidRaw\)\}/.test(body));
  check("안내에 JSON.stringify를 직접 쓰지 않는다", !/받은 값: \$\{JSON\.stringify/.test(body));
  check("검증된 원값을 정규화 없이 쓴다", /let insurancePaid = \(paidRaw as number \| undefined\) \?\? 0;/.test(body));
  check("이 축에 nonNegInt를 쓰지 않는다", !/nonNegInt\(input\.priorAnnualInsurancePaid\)/.test(body) && !/nonNegInt\(paidRaw/.test(body));
  check("이 축에 절삭·클램프를 걸지 않는다", !/Math\.(min|max|floor|ceil|round)\([^)]*paidRaw/.test(body));
  // 남은 nonNegInt 사용처를 정확히 고정한다.
  const uses = body.match(/nonNegInt\([^)]*\)/g) ?? [];
  check("nonNegInt의 남은 사용처는 priorAnnualDeductible 한 곳뿐이다",
    uses.length === 1 && uses[0] === "nonNegInt(nb?.priorAnnualDeductible)", uses.join(" | "));
  // 순서: 급여 stray → 레거시 → 별도 키 → 치료유형 → 통원 카운터 → 공제금액 → 지급보험금 → 가입금액 → 계산
  const iLegacy = body.indexOf('readCount(input, "priorAnnualPaid")');
  // ⚠ **낡은 앵커를 교체했다(G-28).** 위와 같은 이유다(단일 읽기 for 루프).
  const iStray = body.indexOf("for (const stray of SPECIAL_ITEM_ONLY_KEYS)");
  const iProbe = body.indexOf("const probe = calc2026(");
  const iDays = body.indexOf("if (badCount(days))");
  const iDeduct = body.indexOf('readCount(input, "priorAnnualDeductible")');
  const iPaid = body.indexOf('const paidRaw = readCount(nb, "priorAnnualInsurancePaid")');
  const iLimit = body.indexOf('const limitRaw = readCount(nb, "annualCoverageLimit")');
  const iRun = body.indexOf("function runBundle(");
  check("검증 순서: 레거시 → 별도 키 → 치료유형 → 통원 카운터 → 공제금액 → 지급보험금 → 가입금액 → 계산",
    iLegacy > 0 && iLegacy < iStray && iStray < iProbe && iProbe < iDays && iDays < iDeduct
    && iDeduct < iPaid && iPaid < iLimit && iLimit < iRun,
    `${iLegacy}/${iStray}/${iProbe}/${iDays}/${iDeduct}/${iPaid}/${iLimit}/${iRun}`);
  // 범위 밖 파일은 그대로다.
  const si = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  // ⚠ 계약 갱신(G-23): 별도 보장종목의 지급보험금도 검증된 원값을 쓰게 바뀌었다. 이 커밋이
  //   손대지 않았다는 요지는 같으므로 확인 대상을 새 모양으로 옮긴다. `nonNegInt` 자체는
  //   형제 축(보상한 횟수·누적 공제금액)의 미입력 기본값으로 그 파일에 남아 있다.
  check("specialItem2026은 검증된 원값을 인자로 받는다(G-23) · nonNegInt는 두 곳에 남는다",
    /let paid = priorPaid \?\? 0;/.test(si)
    && !/nonNegInt\(input\.priorAnnualInsurancePaid\)/.test(si)
    && (si.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n")
      .match(/nonNegInt\(/g) ?? []).length === 2);
  const rc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  // ⚠ 계약 갱신(G-22): 상급병실료도 검증된 원값을 쓰게 바뀌었다. 이 커밋이 손대지 않았다는
  //   요지는 같으므로 확인 대상을 새 모양으로 옮긴다.
  check("roomCharge2026은 이 커밋이 손대지 않았다(G-22의 모양)", /let paid = checked\.paid \?\? 0;/.test(rc));
  const g21 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("4세대 엔진은 손대지 않았다", /const paidKey = rider === "none" \? "priorAnnualInsurancePaid" : "priorAnnualRiderPaid";/.test(g21));
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("UI 파서·전달 형태는 그대로",
    (ui.match(/priorAnnualInsurancePaid: money\.prior,/g) ?? []).length === 7,
    String((ui.match(/priorAnnualInsurancePaid: money\.prior,/g) ?? []).length));
}

console.log(`\n[G-20 5세대 다회 활성 지급보험금 축 값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
