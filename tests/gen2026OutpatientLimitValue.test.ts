// G-24 — 5세대 **통원 가입금액 축**의 값 검증과 명시적 `0` 안내 분리.
//   대상: 단건 `generation2026.ts`의 `perVisitCoverageLimit`
//        다회 `multiClaim2026.ts`의 `outpatientCoverageLimit`(→ 같은 축으로 전달)
//
// ⚠ **두 이름은 같은 축이다.** 다회가 `nb.outpatientCoverageLimit`을 읽어
//   `perVisitCoverageLimit`으로 단건 엔진에 넘긴다. 소비하는 산식은 `calc2026`의
//   비급여 통원 두 분기뿐이다(중증 = 1회당, 비중증 = 1일당). 급여·입원은 읽지 않는다.
//
// 종전 동작(기준선 7dee81b 엔진 직접 호출로 실측, UI 미경유):
//   `outpatientLimit()`이 `value === undefined || !Number.isFinite(value) || value <= 0`을
//   한 줄에 묶어 **미입력으로 반환**했다.
//     - 명시적 `0`·음수·`NaN`·`±Infinity`·문자열·빈 문자열·`null`·불리언·객체·배열·
//       `bigint`·`Symbol`·순환 참조가 **전부 "미입력"**이 되어 한도가 통째로 사라졌다.
//       실측(중증 통원·청구 1,000,000·공제 300,000 → 지급 전 700,000, 가입금액 150,000):
//       정답 ins 150,000인데 무효값이면 ins **700,000** — 4.67배 과다.
//     - 반대로 `0.5`는 `Math.floor`가 **한도 0원**을 만들어 적용해 ins가 **0**이 됐다.
//       같은 축에서 값에 따라 방향이 갈렸다(G-21의 연간 가입금액과 같은 결함).
//     - `150,000.7`은 내림 150,000으로 조용히 바뀌었다.
//     - `MAX_SAFE + 1`은 검증 없이 통과해 상한 200,000으로 절삭됐다.
//     - 명시적 `0`을 넘겨도 안내는 "**입력하지 않아** 적용하지 않았습니다"였다(사실과 다름).
//       다회는 `=== undefined`만 보므로 `0`에서 **아무 안내도 없었다.**
//   ⚠ 런타임 예외는 어디서도 나지 않았다. 문제는 예외가 아니라 조용히 틀린 한도다.
//   ⚠ 다회는 같은 이름을 **2N+2회** 읽었다(행 3개면 8회 — `runBundle`이 행마다, 그리고 두
//     해석에서 각각 다시 읽었다). 호출마다 값이 달라지는 접근자를 실으면 **행마다 다른
//     한도**가 적용됐고(실측 rows=[150000, 700000, 150000]), 두 해석이 어긋나면 계산 차이가
//     없는데도 **잘못된 지급 0원 HOLD 차단**이 났다.
//
// 이번 커밋이 바꾸는 것:
//   1) `outpatientLimit()`을 네 상태(applied/unset/zero/invalid)로 나눈다.
//   2) 무효값은 이 진입점의 기존 차단 계약 `pending()`으로 막는다. 다회에서는 그것이
//      `blocked(single.notes)`로 감싸져 **진료비 합계를 보존**한다 — 두 공개 계약이 그대로다.
//   3) 명시적 `0`에 미입력과 분리된 전용 안내를 붙인다(계산 결과는 종전 그대로 미적용).
//   4) 다회가 이 축을 **활성일 때만 한 번** 읽어 모든 행과 두 해석에 같은 값을 넘긴다.
//
// ⚠ 이번 커밋이 하지 않는 것: 산식·최소공제·상한 절삭(20만원)·`undefined`와 숫자 `0`의
//   **계산** 계약·미입력 안내 문구·급여 전 경로·비급여 입원 전 경로·별도 보장종목·
//   **상급병실료(`annualCoverageLimit`의 0원 안내는 다른 필드·다른 엔진이라 범위 밖)**·
//   진료비 축·카운터·공제금액 축·HOLD의 값/상태/문구.
// ⚠ 0원 가입이 약관상 유효한 계약인지, 실제 한도가 0원인지는 원문에서 확인하지 않았고
//   안내에서 단정하지 않는다. 안내는 계산기가 무엇을 했는지만 말한다.
import { readFileSync } from "node:fs";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

type Res = Record<string, unknown>;
type Caught = { threw: string } | { r: Res };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => unknown): Caught => {
  try { return { r: f() as Res }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const statusOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.status);
const ins = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : String(x.r.insurancePay ?? x.r.totalInsurancePay);
const own = (x: Caught) => threw(x) ? null : (x.r.ownPay ?? x.r.totalOwnPay);
const amt = (x: Caught) => threw(x) ? null : (x.r.amount ?? x.r.totalAmount);
const notes = (x: Caught) => threw(x) ? "" : ((x.r.notes as string[] | undefined) ?? []).join(" ¶ ");
const noteList = (x: Caught) => threw(x) ? [] : ((x.r.notes as string[] | undefined) ?? []);
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${amt(x)}/own=${own(x)}/ins=${ins(x)}`;

/** 단건의 차단 계약 — `pending()`은 진료비를 보존하고 금액 세 축을 null로 둔다. */
const singleBlocked = (x: Caught) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.amount === 1_000_000 && x.r.ownPay === null && x.r.insurancePay === null
  && x.r.rateApplied === null && (x.r.appliedCaps as unknown[]).length === 0;
/** 다회의 차단 계약 — `blocked()`는 **진료비 합계를 보존**한다. */
const multiBlocked = (x: Caught, total: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === total && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const C = GEN2026.nonBenefit.critical;
const N = GEN2026.nonBenefit.nonCritical;
const circ: Record<string, unknown> = {}; circ.self = circ;

/** 단건 중증 통원 — 공제 max(30%, 3만) = 300,000 → 지급 전 700,000. */
const S = (sev: "critical" | "non_critical", extra: Record<string, unknown> = {}) =>
  wrap(() => calc2026({ amount: 1_000_000, coverage: "non_benefit", visit: "outpatient",
    severity: sev, nonBenefitItem: "general", ...extra } as never));
const SIn = (extra: Record<string, unknown> = {}) =>
  wrap(() => calc2026({ amount: 1_000_000, coverage: "non_benefit", visit: "inpatient",
    severity: "critical", nonBenefitItem: "general", tier: "clinic", ...extra } as never));
const SBf = (extra: Record<string, unknown> = {}) =>
  wrap(() => calc2026({ amount: 1_000_000, coverage: "benefit", visit: "outpatient",
    nhisCoinsuranceRate: 0.3, ...extra } as never));

const M = (sev: "critical" | "non_critical", extra: Record<string, unknown> = {}, rows = 1) =>
  wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
    severity: sev, nonBenefitItem: "general", amounts: Array(rows).fill(1_000_000),
    ...(sev === "critical" ? { priorAnnualOutpatientVisits: 0 } : { priorAnnualOutpatientDays: 0 }),
    ...extra } as never));
const MIn = (extra: Record<string, unknown> = {}) =>
  wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "inpatient",
    severity: "critical", nonBenefitItem: "general", amounts: [1_000_000], tier: "clinic", ...extra } as never));
const MBf = (extra: Record<string, unknown> = {}) =>
  wrap(() => calculateMany2026({ cause: "disease", coverage: "benefit", visit: "outpatient",
    amounts: [1_000_000], nhisCoinsuranceRate: 0.3, ...extra } as never));
/** 별도 보장종목에서 일반 (1)(2)로 되돌아가는 조합 — 다회 엔진을 그대로 쓴다. */
const Routed = (extra: Record<string, unknown> = {}) =>
  wrap(() => calculateGen2026Item({ route: "general", coverage: "non_benefit", severity: "critical",
    item: "injection", injectionPurpose: "anticancer", cause: "disease", visit: "outpatient",
    amounts: [1_000_000], priorAnnualOutpatientVisits: 0, ...extra } as never));

/** 값 검증이 막아야 하는 값. */
const BAD: [string, unknown][] = [
  ["음수 -1", -1], ["음수 -50000", -50_000], ["소수 0.5", 0.5], ["소수 150000.7", 150_000.7],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["문자열 숫자", "150000"], ["빈 문자열", ""], ["null", null], ["true", true], ["false", false],
  ["{}", {}], ["[150000]", [150_000]], ["bigint", 150_000n], ["Symbol", Symbol("s")],
  ["순환 참조", circ], ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1],
];
/** 소비 경로 4종 — 두 이름·두 진입점을 모두 건다. */
const PATHS: [string, string, (v: unknown) => Caught, (x: Caught) => boolean][] = [
  ["단건 중증", "perVisitCoverageLimit", (v) => S("critical", { perVisitCoverageLimit: v }), singleBlocked],
  ["단건 비중증", "perVisitCoverageLimit", (v) => S("non_critical", { perVisitCoverageLimit: v }), singleBlocked],
  ["다회 중증", "outpatientCoverageLimit", (v) => M("critical", { outpatientCoverageLimit: v }), (x) => multiBlocked(x, 1_000_000)],
  ["다회 비중증", "outpatientCoverageLimit", (v) => M("non_critical", { outpatientCoverageLimit: v }), (x) => multiBlocked(x, 1_000_000)],
];

console.log("\n[G-24] 1. 단건·다회 정상값 무회귀");
{
  check("단건 중증: 미전달 → ins 700,000", ins(S("critical")) === "700000", ins(S("critical")));
  check("단건 비중증: 미전달 → ins 500,000", ins(S("non_critical")) === "500000");
  check("단건 중증 + 150,000 → ins 150,000", ins(S("critical", { perVisitCoverageLimit: 150_000 })) === "150000");
  check("단건 비중증 + 150,000 → ins 150,000", ins(S("non_critical", { perVisitCoverageLimit: 150_000 })) === "150000");
  check("다회 중증 + 150,000 → ins 150,000", ins(M("critical", { outpatientCoverageLimit: 150_000 })) === "150000");
  check("다회 비중증 + 150,000 → ins 150,000", ins(M("non_critical", { outpatientCoverageLimit: 150_000 })) === "150000");
  check("다회 3행 + 150,000 → 행마다 같은 한도(ins 450,000)",
    ins(M("critical", { outpatientCoverageLimit: 150_000 }, 3)) === "450000",
    ins(M("critical", { outpatientCoverageLimit: 150_000 }, 3)));
  check("일반 전환 경로도 같은 한도를 쓴다", ins(Routed({ outpatientCoverageLimit: 150_000 })) === "150000");
  check("상한 상수가 그대로(중증 1회당·비중증 1일당 모두 20만원)",
    C.outpatientPerVisitLimitMax === 200_000 && N.outpatientPerDayLimitMax === 200_000);
}

console.log("\n[G-24] 2. undefined·숫자 0의 계산 무회귀 · 안내는 분리");
{
  for (const [label, , mk] of PATHS) {
    const unset = mk(undefined), zero = mk(0);
    check(`${label}: 숫자 0의 계산이 미전달과 같다(종전 계약 유지)`, shape(zero) === shape(unset), `${shape(zero)} vs ${shape(unset)}`);
  }
  // 단건 — 미입력 안내와 0원 안내가 서로 배타적이다.
  const su = S("critical"), sz = S("critical", { perVisitCoverageLimit: 0 });
  check("단건 중증 미입력: 종전 미입력 안내 그대로",
    notes(su).includes("통원 1회당 가입금액(약관상 200,000원 이내에서 계약 시 정한 금액)은 입력하지 않아 적용하지 않았습니다.")
    && !notes(su).includes("0원으로 입력하셔서"));
  check("단건 중증 0: 0원 전용 안내(1회당)만 붙는다",
    notes(sz).includes("통원 가입금액을 0원으로 입력하셔서 계산기에서는 통원 1회당 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.")
    && !notes(sz).includes("입력하지 않아 적용하지 않았습니다"), notes(sz).slice(0, 120));
  const nz = S("non_critical", { perVisitCoverageLimit: 0 });
  check("단건 비중증 0: 단위가 1일당이다(특별약관2 — 외래·처방조제 합산)",
    notes(nz).includes("통원 1일당 지급 한도를 적용하지 않았습니다") && !notes(nz).includes("1회당"), notes(nz).slice(0, 120));
  // 다회 — 종전에는 0에서 **아무 안내도 없었다**.
  const mu = M("critical"), mz = M("critical", { outpatientCoverageLimit: 0 });
  check("다회 중증 미입력: 종전 미입력 안내 그대로",
    notes(mu).includes("통원 가입금액은 계약마다 다른 값이라 입력하지 않으면 적용하지 않습니다.")
    && !notes(mu).includes("0원으로 입력하셔서"));
  check("다회 중증 0: 0원 전용 안내가 신설됐다(종전 안내 없음)",
    notes(mz).includes("통원 가입금액을 0원으로 입력하셔서 계산기에서는 통원 1회당 지급 한도를 적용하지 않았습니다.")
    && !notes(mz).includes("통원 가입금액은 계약마다 다른 값이라"), notes(mz).slice(0, 120));
  check("다회 비중증 0: 단위가 1일당이다",
    notes(M("non_critical", { outpatientCoverageLimit: 0 })).includes("통원 1일당 지급 한도를 적용하지 않았습니다"));
  // 0원 안내는 약관상 의미를 단정하지 않는다.
  for (const t of ["약관상", "무효", "유효한 계약", "0원 가입"]) {
    check(`0원 안내가 "${t}"를 말하지 않는다`, !notes(sz).split("¶").find((n) => n.includes("0원으로 입력하셔서"))?.includes(t));
  }
}

console.log("\n[G-24] 3. 경계·한도 초과값 — 상한 절삭을 유지한다");
{
  for (const [label, key, mk] of PATHS) {
    const max = label.includes("비중증") ? N.outpatientPerDayLimitMax : C.outpatientPerVisitLimitMax;
    check(`${label}: 한도와 같은 값(${max}) → 그대로 적용`, ins(mk(max)) === String(max), ins(mk(max)));
    check(`${label}: 한도 초과 300,000 → 상한으로 절삭(거부하지 않는다)`, ins(mk(300_000)) === String(max));
    check(`${label}: MAX_SAFE → 거부하지 않고 상한으로 절삭`, ins(mk(Number.MAX_SAFE_INTEGER)) === String(max), shape(mk(Number.MAX_SAFE_INTEGER)));
    check(`${label}: 1 → 1원 한도가 그대로 적용된다(절삭·반올림 없음)`, ins(mk(1)) === "1");
    check(`${label}: MAX_SAFE 허용 · MAX_SAFE+1 차단`,
      statusOf(mk(Number.MAX_SAFE_INTEGER)) === "OK" && statusOf(mk(Number.MAX_SAFE_INTEGER + 1)) === "PENDING_UNVERIFIED");
    void key;
  }
}

console.log("\n[G-24] 4. 음수·소수·비숫자 차단 — 무효값을 미적용으로 삼키지 않는다");
{
  for (const [label, , mk, isBlocked] of PATHS) {
    for (const [vlabel, v] of BAD) {
      const x = mk(v);
      check(`${label} + ${vlabel} → 예외 없이 차단`, isBlocked(x), shape(x));
      check(`${label} + ${vlabel} → 이 축의 이름을 말한다`,
        noteList(x)[0]?.startsWith(label.includes("비중증") ? "통원 1일당 가입금액은 0 이상의 정수여야 합니다" : "통원 1회당 가입금액은 0 이상의 정수여야 합니다") === true,
        (noteList(x)[0] ?? "").slice(0, 46));
      check(`${label} + ${vlabel} → 받은 값의 형식 줄이 있다`, /받은 값의 형식: /.test(notes(x)));
    }
  }
  // 종전에 결과를 바꾸던 두 방향을 직접 못박는다.
  check("과다 방향: 문자열 '150000'이 더 이상 한도를 지우지 않는다(종전 ins 700,000)",
    statusOf(S("critical", { perVisitCoverageLimit: "150000" })) === "PENDING_UNVERIFIED");
  check("반대 방향: 0.5가 더 이상 한도 0원으로 적용되지 않는다(종전 ins 0)",
    statusOf(S("critical", { perVisitCoverageLimit: 0.5 })) === "PENDING_UNVERIFIED");
  check("소수 내림이 사라졌다(종전 150,000.7 → 150,000)",
    statusOf(S("critical", { perVisitCoverageLimit: 150_000.7 })) === "PENDING_UNVERIFIED");
  check("명시적 0과 소수 0.5의 결과가 이제 명확히 갈린다",
    statusOf(S("critical", { perVisitCoverageLimit: 0 })) === "OK"
    && statusOf(S("critical", { perVisitCoverageLimit: 0.5 })) === "PENDING_UNVERIFIED");
  check("-0은 0과 같이 취급한다", shape(S("critical", { perVisitCoverageLimit: -0 })) === shape(S("critical", { perVisitCoverageLimit: 0 })));
}

console.log("\n[G-24] 5. bigint·Symbol·순환 참조에서 예외 없는 안내");
{
  for (const [vlabel, v] of [["bigint", 150_000n], ["Symbol", Symbol("s")], ["순환 참조", circ],
    ["함수", () => 1]] as [string, unknown][]) {
    const s = S("critical", { perVisitCoverageLimit: v }), m = M("critical", { outpatientCoverageLimit: v });
    check(`단건 + ${vlabel} → 예외 없이 안내를 끝까지 만든다`, !threw(s) && /받은 값의 형식: /.test(notes(s)), shape(s));
    check(`다회 + ${vlabel} → 예외 없이 안내를 끝까지 만든다`, !threw(m) && /받은 값의 형식: /.test(notes(m)), shape(m));
  }
  // ⚠ 이 파일의 계약은 **값 자체를 문자열로 만들지 않는 것**이다(G-15). typeof만 쓴다.
  check("Symbol도 형식만 표시한다", /받은 값의 형식: symbol$/.test(notes(S("critical", { perVisitCoverageLimit: Symbol("s") }))));
  check("bigint도 형식만 표시한다", /받은 값의 형식: bigint$/.test(notes(S("critical", { perVisitCoverageLimit: 150_000n }))));
  check("차단 안내는 정확히 두 줄이다", noteList(S("critical", { perVisitCoverageLimit: -1 })).length === 2);
}

console.log("\n[G-24] 6. 읽는 계약 — 결과가 아니라 접근자 호출 횟수로 본다");
{
  const probe = (base: object, key: string, get: () => unknown, fn: (o: never) => unknown) => {
    let reads = 0;
    const o = Object.defineProperty({ ...base }, key,
      { get() { reads++; return get(); }, enumerable: true, configurable: true });
    // ⚠ 엔진을 먼저 부르고 나서 reads를 읽는다. 객체 리터럴은 왼쪽부터 평가된다.
    const x = wrap(() => fn(o as never));
    return { reads, x };
  };
  const SB = (sev: string, visit: string) => ({ amount: 1_000_000, coverage: "non_benefit", visit,
    severity: sev, nonBenefitItem: "general", tier: visit === "inpatient" ? "clinic" : undefined });
  const MB = (sev: string, visit: string, rows: number) => ({ cause: "disease", coverage: "non_benefit",
    visit, severity: sev, nonBenefitItem: "general", amounts: Array(rows).fill(1_000_000),
    tier: visit === "inpatient" ? "clinic" : undefined,
    ...(visit === "outpatient" ? (sev === "critical" ? { priorAnnualOutpatientVisits: 0 } : { priorAnnualOutpatientDays: 0 }) : {}) });
  const P = "perVisitCoverageLimit", O = "outpatientCoverageLimit";
  const one = () => 150_000;

  const s1 = probe(SB("critical", "outpatient"), P, one, calc2026 as never);
  check("단건 중증 통원: 활성 축을 정확히 1회 읽는다", s1.reads === 1 && statusOf(s1.x) === "OK", `reads=${s1.reads}`);
  const s2 = probe(SB("non_critical", "outpatient"), P, one, calc2026 as never);
  check("단건 비중증 통원: 1회", s2.reads === 1);
  // ⚠ **계약이 바뀌었다(G-30).** G-24 시점에는 단건의 미사용 두 경로(비급여 입원·급여)가
  //   이 이름을 **읽지 않아** 조용히 폐기했고 그 사실을 여기서 고정하고 있었다. G-30이 그
  //   조용한 폐기를 닫았다 — 통원 가입금액은 통원 행에만 있는 한도다. 이제 1회 읽고 막는다.
  check("단건 비급여 입원: 1회 읽고 차단(G-30)", (() => {
    const r = probe(SB("critical", "inpatient"), P, one, calc2026 as never);
    return r.reads === 1 && statusOf(r.x) === "PENDING_UNVERIFIED";
  })());
  check("단건 급여 통원: 1회 읽고 차단(G-30)", (() => {
    const r = probe({ amount: 1_000_000, coverage: "benefit", visit: "outpatient", nhisCoinsuranceRate: 0.3 }, P, one, calc2026 as never);
    return r.reads === 1 && statusOf(r.x) === "PENDING_UNVERIFIED";
  })());
  // ⚠ 종전에는 다회가 2N+2회였다(행 3개면 8회). 그 수치를 못박는다.
  for (const rows of [1, 2, 3, 4]) {
    const m = probe(MB("critical", "outpatient", rows), O, one, calculateMany2026 as never);
    check(`다회 중증 통원 ${rows}행: 행 수와 무관하게 1회(종전 ${2 * rows + 2}회)`, m.reads === 1, `reads=${m.reads}`);
  }
  check("다회 비중증 통원 3행: 1회", probe(MB("non_critical", "outpatient", 3), O, one, calculateMany2026 as never).reads === 1);
  // ⚠ **계약이 바뀌었다(G-30).** G-24 시점에는 다회의 미사용 두 경로(비급여 입원·급여)가
  //   이 이름을 **읽지 않아** 조용히 폐기했고 그 사실을 여기서 고정하고 있었다. G-30이 그
  //   조용한 폐기를 닫았다 — 통원 가입금액은 통원 행에만 있는 한도다. 이제 정확히 1회 읽고
  //   차단한다. **단건(`calc2026`)의 `perVisitCoverageLimit`은 이번 범위가 아니라 그대로다.**
  check("다회 비급여 입원 3행: 1회 읽고 차단(G-30)", (() => {
    const r = probe(MB("critical", "inpatient", 3), O, one, calculateMany2026 as never);
    return r.reads === 1 && multiBlocked(r.x, 3_000_000);
  })());
  check("다회 급여 통원: 1회 읽고 차단(G-30)", (() => {
    const r = probe({ cause: "disease", coverage: "benefit", visit: "outpatient", amounts: [1_000_000], nhisCoinsuranceRate: 0.3 },
      O, one, calculateMany2026 as never);
    return r.reads === 1 && multiBlocked(r.x, 1_000_000);
  })());
  // 무효값도 한 번만 읽고 막는다.
  const bad = probe(MB("critical", "outpatient", 3), O, () => -1, calculateMany2026 as never);
  check("다회: 무효값도 1회만 읽고 차단한다", bad.reads === 1 && multiBlocked(bad.x, 3_000_000), `reads=${bad.reads} ${shape(bad.x)}`);

  // ⚠ 던지는 접근자: 활성 축은 읽어야 검증할 수 있으므로 예외가 난다(호출자 객체의 문제이며
  //   기준선에서도 같았다). 미사용 경로에서는 **실행되지 않는다**.
  const boom = () => { throw new RangeError("touched"); };
  const bs = probe(SB("critical", "outpatient"), P, boom, calc2026 as never);
  check("단건 활성: 던지는 접근자도 1회만 실행된다", threw(bs.x) && bs.reads === 1, `reads=${bs.reads}`);
  const bm = probe(MB("critical", "outpatient", 3), O, boom, calculateMany2026 as never);
  check("다회 활성: 던지는 접근자가 1회만 실행된다(종전 8회 시도)", threw(bm.x) && bm.reads === 1, `reads=${bm.reads}`);
  // ⚠ **계약이 바뀌었다(G-30).** 조용한 폐기를 막으려면 읽어야 하므로 단건 입원에서도 전파된다.
  check("단건 입원: 던지는 접근자가 전파된다(G-30)", threw(probe(SB("critical", "inpatient"), P, boom, calc2026 as never).x));
  check("단건 입원: 치료유형이 먼저 미지정이면 실행되지 않는다(종전 그대로)",
    !threw(probe({ amount: 1_000_000, coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "critical" }, P, boom, calc2026 as never).x));
  // ⚠ **계약이 바뀌었다(G-30).** 조용한 폐기를 막으려면 값을 읽어야 하므로, 다회의 미사용
  //   두 경로에서도 던지는 접근자가 전파된다. 그 대상은 종전에 조용히 폐기하며 성공하던
  //   입력뿐이고, 선행 preflight가 막는 경로는 아래 검사대로 종전 그대로다.
  check("다회 입원: 던지는 접근자가 전파된다(G-30)", threw(probe(MB("critical", "inpatient", 3), O, boom, calculateMany2026 as never).x));
  check("다회 급여: 던지는 접근자가 전파된다(G-30)",
    threw(probe({ cause: "disease", coverage: "benefit", visit: "outpatient", amounts: [1_000_000], nhisCoinsuranceRate: 0.3 },
      O, boom, calculateMany2026 as never).x));
  check("다회 입원: 진료비가 먼저 무효면 실행되지 않는다(종전 그대로)",
    !threw(probe({ ...MB("critical", "inpatient", 3), amounts: ["abc"] }, O, boom, calculateMany2026 as never).x));
  // ⚠ 기존 preflight가 막는 경로에서도 실행되지 않는다(G-23의 계약과 같다).
  check("다회: 통원 카운터 미입력 preflight가 막으면 실행되지 않는다",
    !threw(probe({ cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "critical",
      nonBenefitItem: "general", amounts: [1_000_000] }, O, boom, calculateMany2026 as never).x));

  // ⚠ 호출마다 값이 달라지는 접근자: 종전에는 행마다 다른 한도가 적용되고 두 해석이 어긋나
  //   잘못된 지급 0원 HOLD 차단이 났다. 이제 첫 값 하나를 모두가 공유한다.
  for (const seq of [[150_000, 0], [150_000, 150_000, 0], [150_000, 0, 0, 150_000, 0]]) {
    let k = 0;
    const d = probe(MB("critical", "outpatient", 3), O, () => seq[k++ % seq.length], calculateMany2026 as never);
    check(`다회: 값이 달라지는 접근자(주기 ${seq.length})에서도 1회 · 모든 행 같은 한도`,
      d.reads === 1 && statusOf(d.x) === "OK" && ins(d.x) === "450000", `reads=${d.reads} ${shape(d.x)}`);
  }
}

console.log("\n[G-24] 7. 안내 우선순위와 반환 계약");
{
  const bad = { outpatientCoverageLimit: -1 };
  check("치료유형 미지정이 먼저",
    notes(wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      severity: "critical", amounts: [1_000_000], priorAnnualOutpatientVisits: 0, ...bad } as never)))
      .includes("치료유형(nonBenefitItem) 미지정"));
  check("질환 구분 미지정이 먼저",
    notes(wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      nonBenefitItem: "general", amounts: [1_000_000], priorAnnualOutpatientVisits: 0, ...bad } as never)))
      .includes("중증/비중증(severity) 미지정"));
  check("통원 카운터 미입력이 먼저",
    notes(wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      severity: "critical", nonBenefitItem: "general", amounts: [1_000_000], ...bad } as never)))
      .includes("이미 사용한 통원 횟수(priorAnnualOutpatientVisits)"));
  check("기존 지급보험금(G-20) 검증이 먼저",
    notes(M("critical", { ...bad, priorAnnualInsurancePaid: -1 })).includes("기존 지급보험금(priorAnnualInsurancePaid)"));
  check("연간 보험가입금액(G-21) 검증이 먼저",
    notes(M("critical", { ...bad, annualCoverageLimit: -1 })).includes("연간 보험가입금액(annualCoverageLimit)"));
  // 반환 계약 — 단건과 다회를 섞지 않는다.
  const s = S("critical", { perVisitCoverageLimit: -1 });
  check("단건 차단은 pending() 계약(진료비 보존·금액 null)", singleBlocked(s), shape(s));
  check("단건 차단에 lines/totalAmount 같은 다회 필드가 없다",
    !threw(s) && s.r.lines === undefined && s.r.totalAmount === undefined);
  const m = M("critical", { outpatientCoverageLimit: -1 }, 3);
  check("다회 차단은 blocked() 계약(진료비 합계 보존)", multiBlocked(m, 3_000_000), shape(m));
  check("다회 차단 안내가 단건 안내를 그대로 전달한다",
    noteList(m)[0] === noteList(s)[0], noteList(m)[0]?.slice(0, 40));
  // 일반 전환 경로도 다회 계약을 그대로 쓴다.
  const rt = Routed({ outpatientCoverageLimit: -1 });
  check("일반 전환: route는 general이고 진료비 합계가 보존된다",
    !threw(rt) && rt.r.route === "general" && rt.r.totalAmount === 1_000_000 && rt.r.status === "PENDING_UNVERIFIED", shape(rt));
  check("일반 전환: 차단 결과에 '계산했습니다' 안내를 붙이지 않는다", !notes(rt).includes("일반 비급여 산식으로 계산했습니다"));
}

console.log("\n[G-24] 8. 다른 축·다른 경로·HOLD 무회귀");
{
  // 급여·입원은 값과 무관하게 종전 그대로다.
  for (const [vlabel, v] of BAD) {
    // ⚠ **계약이 바뀌었다(G-30).** 두 미사용 경로는 이제 값과 무관하게 stray로 막는다.
    check(`단건 비급여 입원 + ${vlabel} → stray 차단(G-30)`, statusOf(SIn({ perVisitCoverageLimit: v })) === "PENDING_UNVERIFIED", shape(SIn({ perVisitCoverageLimit: v })));
    check(`단건 급여 통원 + ${vlabel} → stray 차단(G-30)`, statusOf(SBf({ perVisitCoverageLimit: v })) === "PENDING_UNVERIFIED", shape(SBf({ perVisitCoverageLimit: v })));
    // ⚠ **계약이 바뀌었다(G-30).** 두 미사용 경로는 이제 값과 무관하게 stray로 차단한다.
    //   단건 두 줄(위)은 이번 범위가 아니라 종전 그대로다.
    check(`다회 비급여 입원 + ${vlabel} → stray 차단(G-30)`, multiBlocked(MIn({ outpatientCoverageLimit: v }), 1_000_000), shape(MIn({ outpatientCoverageLimit: v })));
    check(`다회 급여 통원 + ${vlabel} → stray 차단(G-30)`, multiBlocked(MBf({ outpatientCoverageLimit: v }), 1_000_000), shape(MBf({ outpatientCoverageLimit: v })));
  }
  // 상급병실료는 이번 범위 밖이다 — 계산도 안내도 그대로다.
  const RC = (extra: Record<string, unknown> = {}) => wrap(() => calculateRoomCharge2026({
    route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
    stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }], ...extra } as never));
  check("상급병실료: 정상 계산 그대로", ins(RC()) === "1000000");
  check("상급병실료: annualCoverageLimit 0의 계산이 그대로(미적용)", shape(RC({ annualCoverageLimit: 0 })) === shape(RC()));
  // ⚠ **낡은 계약을 교체했다(G-25).** 종전 이 자리는 "상급병실료에 0원 전용 안내를
  //   신설하지 않았다"를 고정했다 — G-24는 통원 가입금액 축만 다뤘고 상급병실료의
  //   `annualCoverageLimit`은 다른 필드·다른 엔진이라 범위 밖이었기 때문이다.
  //   G-25가 그 축의 0원 전용 안내를 신설했으므로, 이제 **계산은 그대로이고 안내만 갈린다**를
  //   고정한다. G-24가 지킨 계산 무변경은 위 줄이 그대로 본다.
  check("상급병실료: 0원의 안내가 미제공과 갈린다(G-25)",
    notes(RC({ annualCoverageLimit: 0 })) !== notes(RC())
    && notes(RC({ annualCoverageLimit: 0 })).includes("0원으로 입력하셔서")
    && !notes(RC({ annualCoverageLimit: 0 })).includes("입력하지 않아 적용하지 않았습니다"));
  check("상급병실료: 통원 가입금액은 종전대로 쓰이지 않는 입력으로 거부",
    statusOf(RC({ outpatientCoverageLimit: 150_000 })) === "PENDING_UNVERIFIED");
  // 별도 보장종목(G-23)·미사용 축 stray 거부는 그대로다.
  const item = wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "injection", injectionPurpose: "general",
    lines: [{ amount: 1_000_000, visit: "outpatient" }], priorAnnualCoveredCount: 0 } as never));
  check("별도 보장종목: 종전 계산 그대로", ins(item) === "700000", shape(item));
  check("별도 보장종목: 기존 지급보험금 무효값은 G-23대로 rejected",
    statusOf(wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
      severity: "critical", item: "injection", injectionPurpose: "general",
      lines: [{ amount: 1_000_000, visit: "outpatient" }], priorAnnualCoveredCount: 0,
      priorAnnualInsurancePaid: -1 } as never))) === "PENDING_UNVERIFIED");
  // 지급 0원 HOLD가 그대로 작동한다.
  const hold = M("critical", { outpatientCoverageLimit: 150_000, amounts: [20_000, 1_000_000],
    priorAnnualOutpatientVisits: C.outpatientAnnualVisits - 1 });
  check("지급 0원 HOLD가 그대로 작동한다", statusOf(hold) === "PENDING_UNVERIFIED"
    && notes(hold).includes("지급 보험금이 0원인 통원이"), shape(hold));
}

console.log("\n[G-24] 9. 소스 계약");
{
  const engRaw = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const eng = engRaw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const mulRaw = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const mul = mulRaw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  check("판정이 네 상태로 나뉜다",
    /type OutpatientLimitCheck =\n\s*\| \{ state: "applied"; limit: number \}\n\s*\| \{ state: "unset" \}\n\s*\| \{ state: "zero" \}\n\s*\| \{ state: "invalid"; got: unknown \};/.test(eng));
  check("0 이상의 안전한 정수만 통과시킨다",
    /if \(!\(typeof value === "number" && Number\.isSafeInteger\(value\) && value >= 0\)\) \{\n\s*return \{ state: "invalid", got: value \};/.test(eng));
  // ⚠ 파일 전체가 아니라 **이 판정 함수 안**을 본다. 다른 산식의 Math.floor는 이 커밋의
  //   대상이 아니고, 그것까지 묶으면 무관한 변경에서 이 검사가 깨진다.
  const limitFn = eng.slice(eng.indexOf("function outpatientLimit("),
    eng.indexOf("const invalidOutpatientLimitNotes"));
  check("이 판정 함수 안에 Math.floor·Number.isFinite가 없다",
    limitFn.length > 0 && !/Math\.floor/.test(limitFn) && !/Number\.isFinite/.test(limitFn), limitFn.slice(0, 60));
  check("상한 절삭은 그대로다", /return \{ state: "applied", limit: Math\.min\(value, max\) \};/.test(eng));
  check("두 호출부가 네 상태를 모두 처리한다",
    (eng.match(/state === "invalid"/g) ?? []).length === 2
    && (eng.match(/state === "unset"/g) ?? []).length === 2
    && (eng.match(/state === "zero"/g) ?? []).length === 2
    && (eng.match(/state === "applied"/g) ?? []).length === 2);
  check("차단은 기존 pending() 계약을 쓴다", (eng.match(/return pending\(amount, invalidOutpatientLimitNotes\(/g) ?? []).length === 2);
  check("단위가 보장종목별로 갈린다(중증 1회당·비중증 1일당)",
    /invalidOutpatientLimitNotes\("통원 1회당 가입금액", checked\.got\)/.test(eng)
    && /invalidOutpatientLimitNotes\("통원 1일당 가입금액", dayChecked\.got\)/.test(eng)
    && /zeroOutpatientLimitNote\("1회당"\)/.test(eng) && /zeroOutpatientLimitNote\("1일당"\)/.test(eng));
  // ⚠ 이 파일은 값 자체를 문자열로 만들지 않는다(G-15의 계약). showValue를 복제하지 않았다.
  check("받은 값 자체를 문자열로 만들지 않는다", /받은 값의 형식: \$\{typeof got\}/.test(eng) && !/받은 값: \$\{/.test(eng));
  check("showValue를 이 파일에 복제하지 않았다", !/const showValue/.test(engRaw));
  check("미입력 안내 문구가 그대로다",
    /통원 1회당 가입금액\(약관상 \$\{c\.outpatientPerVisitLimitMax\.toLocaleString\("ko-KR"\)\}원 이내에서 계약 시 정한 금액\)은 입력하지 않아 적용하지 않았습니다\./.test(eng)
    && /통원 1일당 가입금액\(약관상 \$\{n\.outpatientPerDayLimitMax\.toLocaleString\("ko-KR"\)\}원 이내에서 계약 시 정한 금액\)은 입력하지 않아 적용하지 않았습니다\./.test(eng));
  check("0원 안내가 약관상 의미를 단정하지 않는다",
    /통원 가입금액을 0원으로 입력하셔서 계산기에서는 통원 \$\{unit\} 지급 한도를 적용하지 않았습니다\. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요\./.test(eng));

  // 다회 — 활성일 때만, 한 번만 읽는다.
  check("다회가 활성 조건을 명시한다",
    /const usesOutpatientLimit = !!nb && input\.visit === "outpatient";/.test(mul));
  check("다회가 이 이름을 정확히 한 번만 읽는다",
    (mul.match(/\.outpatientCoverageLimit/g) ?? []).length === 1
    && /const outpatientLimitRaw: unknown = usesOutpatientLimit \? nb\.outpatientCoverageLimit : undefined;/.test(mul),
    String((mul.match(/\.outpatientCoverageLimit/g) ?? []).length));
  check("행마다 읽지 않고 읽은 값을 넘긴다",
    /perVisitCoverageLimit: outpatientLimitRaw as number \| undefined,/.test(mul));
  check("buildNotes가 input을 다시 읽지 않고 상태를 받는다",
    /outpatientLimitState: "applied" \| "unset" \| "zero" \| "other",/.test(mul)
    && /notes: buildNotes\(input, limitState, outpatientLimitState\),/.test(mul)
    && !/input\.outpatientCoverageLimit/.test(mul));
  check("읽기가 두 runBundle 호출보다 위에 있다(두 해석이 같은 값을 쓴다)",
    mul.indexOf("const outpatientLimitRaw") < mul.indexOf("const countedA = runBundle(true);")
    && mul.indexOf("const outpatientLimitRaw") < mul.indexOf("function runBundle("));
  check("다회에 두 번째 가드를 만들지 않았다(검증은 calc2026 한 곳)",
    !/outpatientLimitRaw !== undefined && !\(/.test(mul) && !/isSafeInteger\(outpatientLimitRaw\)/.test(mul));
  check("다회의 0원 안내가 보장종목별 단위를 쓴다",
    /통원 \$\{input\.severity === "critical" \? "1회당" : "1일당"\} 지급 한도를 적용하지 않았습니다/.test(mul));

  // 범위 밖 파일은 그대로다.
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  // ⚠ **낡은 계약을 교체했다(G-25).** G-24 시점에는 상급병실료 엔진에 0원 안내가 없어야 했다.
  //   G-25가 그 안내를 신설했다. 통원 가입금액 축(이 파일의 대상)까지 번지지 않았는지만 본다.
  check("상급병실료 엔진의 0원 안내는 연간 가입금액 축의 것이다(통원 축으로 번지지 않았다)",
    /연간 보험가입금액을 0원으로 입력하셔서/.test(room) && !/통원 가입금액을 0원으로 입력하셔서/.test(room));
  check("상급병실료의 미입력 안내가 그대로", /연간 보험가입금액을 입력하지 않아 적용하지 않았습니다\./.test(room));
  const item = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("별도 보장종목은 이 축을 전달만 한다(읽기 1회)",
    /outpatientCoverageLimit: input\.outpatientCoverageLimit,/.test(item)
    && (item.match(/\.outpatientCoverageLimit/g) ?? []).length === 1,
    String((item.match(/\.outpatientCoverageLimit/g) ?? []).length));
  for (const [label, path] of [["2·3세대", "src/lib/insurance/engine/generationStandardized.ts"],
    ["4세대", "src/lib/insurance/engine/multiClaim2021.ts"]] as [string, string][]) {
    check(`${label} 엔진은 이 커밋의 대상이 아니다`, !/OutpatientLimitCheck/.test(readFileSync(path, "utf8")));
  }
  check("2·3세대의 회당 한도 파서는 그대로다",
    /const visitLimit = perVisitLimit\(input\.perVisitCoverageLimit\);/.test(readFileSync("src/lib/insurance/engine/generationStandardized.ts", "utf8")));
}

console.log(`\n[G-24 통원 가입금액 축 값 검증 · 0원 안내 분리] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
