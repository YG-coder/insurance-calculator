// G-23 — 별도 보장종목(3대비급여·비중증 MRI) 진입점의 **기존 지급보험금 축** 값 검증.
//   대상: `specialItem2026.ts`의 `priorAnnualInsurancePaid`
//
// 종전 동작(기준선 70a4535 엔진 직접 호출로 실측, UI 미경유):
//   이 축만 `validateItemInput()`의 검사 목록에서 빠져 있었다. 형제 축인 '보상한 횟수'
//   (priorAnnualCoveredCount)·'누적 공제금액'(priorAnnualInpatientDeductible)·'치료행위 수'
//   (priorAnnualTreatmentActCount)는 모두 `Number.isSafeInteger(v) && v >= 0`으로 막고 있었다.
//   그 결과 `runOnce()`의 `nonNegInt()`가 무효값을 **조용히 0으로** 만들었다.
//     - 음수·NaN·Infinity·문자열·null·true·객체·배열·bigint·Symbol·함수 → 전부 0.
//       실측(주사료 한도 2,500,000·청구 1,000,000·기존 지급 2,300,000):
//       정답 ins 200,000인데 무효값이면 ins **700,000** — 3.5배 과다.
//     - 소수 `100000.7` → 내림 100,000으로 조용히 바뀌었다.
//     - `MAX_SAFE + 1`은 `Number.isFinite`를 통과해 그대로 쓰였고, 한도를 소진해 ins **0**이
//       됐다 — 같은 축에서 값에 따라 과다·과소 **양쪽**으로 갈렸다.
//   ⚠ 같은 이름을 **해석마다 다시 읽었다.** `runOnce()`가 두 번 실행되므로 근골격계·주사료는
//     2회, MRI 두 종은 1회였다. 호출마다 값이 달라지는 접근자를 실으면 두 해석이 서로 다른
//     원값에서 출발해 `fingerprint()` 비교가 무의미해지고, 계산 차이가 없는데도 지급 0원
//     HOLD 차단이 나왔다(실측: `[0, 9000000]`을 번갈아 돌려주는 getter).
//
// 이번 커밋이 바꾸는 것:
//   1) `calculateSpecialItem2026`의 **preflight 뒤·계산 앞**에서 이 축을 검증한다.
//   2) 거기서 **한 번만** 읽어 두 `runOnce` 호출에 같은 원값을 넘긴다.
//   3) `nonNegInt()`는 남기되 사용처를 두 곳으로 못박는다(형제 축의 미입력 기본값 전용).
//
// ⚠ 이번 커밋이 하지 않는 것: `undefined`·숫자 `0`의 계약 변경, 한도 초과·`MAX_SAFE` 절삭,
//   산식·항목별 한도·라우팅·승인 회차·HOLD의 값/상태/문구 변경, `fingerprint()` 필드 변경,
//   일반 전환 경로(`calculateMany2026`의 `blocked()` 계약)·상급병실료(G-22) 변경,
//   진료비 축(`line.amount`·`amounts`)의 공용 `isNum()` 계약 변경.
//
// ⚠ **검증 위치가 계약이다.** 형제 축(보상한 횟수·누적 공제금액)은 `validateItemInput`에 있지만
//   이 축은 그 층으로 올리지 않는다. 올리면 세 가지 기존 계약이 함께 깨진다.
//     1) 근골격계 승인 회차 preflight·중증 MRI 종별 preflight 안내가 형식 거부로 바뀐다.
//     2) preflight가 이미 결과를 정한 입력에서 접근자가 실행된다(0회 → 1회).
//     3) 던지는 접근자에서 **종전에 안전하게 차단되던 입력에 새 런타임 예외**가 생긴다.
//   아래 8절이 이 세 가지를 각각 고정한다. 안내 우선순위 변화는 **0건**이어야 한다.
import { readFileSync } from "node:fs";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
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
const routeOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.route);
const ins = (x: Caught) => threw(x) ? "THROW:" + x.threw : String(x.r.totalInsurancePay);
const ownOf = (x: Caught) => threw(x) ? null : x.r.totalOwnPay;
const totalOf = (x: Caught) => threw(x) ? null : x.r.totalAmount;
const noteCount = (x: Caught) => threw(x) ? -1 : ((x.r.notes as string[] | undefined) ?? []).length;
const notes = (x: Caught) => threw(x) ? "" : ((x.r.notes as string[] | undefined) ?? []).join(" ¶ ");
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.route}/${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/lines=${(x.r.lines as unknown[]).length}`;
/** 이 진입점의 거부 계약 — `rejected()`는 총액을 만들지 않는다(0). */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;
/** preflight·HOLD의 차단 계약 — `blocked()`는 진료비 합계를 보존한다. */
const isBlocked = (x: Caught, total: number) => !threw(x) && x.r.route === "special_item"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === total
  && x.r.totalInsurancePay === null;

const circ: Record<string, unknown> = {}; circ.self = circ;
const S = GEN2026.specialItem;
const LINE = { amount: 1_000_000, visit: "outpatient" as const };

/** 중증 비급여 주사료(일반 주사) — 한도 2,500,000, 청구 1,000,000 → 지급 전 700,000. */
const INJ = (extra: Record<string, unknown> = {}) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "injection", injectionPurpose: "general", lines: [LINE], ...extra,
});
/** 중증 근골격계 — 승인 회차 preflight를 통과시켜 계산까지 간다. */
const MSK = (extra: Record<string, unknown> = {}) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "musculoskeletal_esw", lines: [LINE], priorAnnualTreatmentActCount: 0, ...extra,
});
/** 중증 비급여 MRI(통원) — 종별 preflight 대상이 아니다. */
const MRI = (extra: Record<string, unknown> = {}) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "mri", lines: [LINE], ...extra,
});
/** 비중증 비급여 MRI — 공제 5만·50%라 지급 전 500,000. */
const NCMRI = (extra: Record<string, unknown> = {}) => ({
  route: "special_item", coverage: "non_benefit", severity: "non_critical",
  item: "mri", lines: [LINE], ...extra,
});
/** 일반 (1)(2)로 되돌아가는 조합 — 이 축은 calculateMany2026이 자기 계약으로 막는다. */
const GEN = (extra: Record<string, unknown> = {}) => ({
  route: "general", coverage: "non_benefit", severity: "critical",
  item: "injection", injectionPurpose: "anticancer", cause: "disease",
  visit: "outpatient", amounts: [1_000_000], ...extra,
});
/** 상급병실료 — G-22가 닫은 별도 진입점. */
const RC = (extra: Record<string, unknown> = {}) => ({
  route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
  stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }], ...extra,
});

const call = (o: object) => wrap(() => calculateGen2026Item(o as never));

/** 근골격계 승인 회차 preflight가 막는 입력(치료행위 수 미입력). */
const MSK_NO_ACTS = (extra: Record<string, unknown> = {}) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "musculoskeletal_esw", lines: [LINE], ...extra,
});
/** 중증 MRI 종별 preflight가 막는 입력(입원인데 종별 미선택). */
const MRI_NO_TIER = (extra: Record<string, unknown> = {}) => ({
  route: "special_item", coverage: "non_benefit", severity: "critical",
  item: "mri", lines: [{ amount: 1_000_000, visit: "inpatient" as const }], ...extra,
});
const MSK_PREFLIGHT_NOTE = "근골격계 이학요법·체외충격파는 최초 10회 이후에는";
const MRI_PREFLIGHT_NOTE = "중증 비급여 MRI 입원은 의료기관 종별에 따라";

/** 별도 보장종목 세 항목 — 모두 이 축을 소비한다. */
const ITEMS: [string, (e?: Record<string, unknown>) => object, number][] = [
  ["중증 근골격계", MSK, 700_000],
  ["중증 주사료", INJ, 700_000],
  ["중증 MRI", MRI, 700_000],
  ["비중증 MRI", NCMRI, 500_000],
];

/** 거부해야 하는 값. */
const BAD: [string, unknown][] = [
  ["음수 -1", -1], ["음수 -400000", -400_000], ["음수 소수 -0.5", -0.5],
  ["소수 0.5", 0.5], ["소수 100000.7", 100_000.7],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["문자열 숫자", "100000"], ["빈 문자열", ""], ["null", null],
  ["true", true], ["false", false], ["{}", {}], ["[]", []], ["[100000]", [100_000]],
  ["bigint", 100_000n], ["Symbol", Symbol("s")], ["함수", () => 1], ["순환 참조", circ],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1], ["1e21", 1e21],
];

console.log("\n[G-23] 1. 정상 입력 무회귀");
{
  for (const [label, mk, base] of ITEMS) {
    check(`${label}: 미전달 → ins ${base}`, ins(call(mk())) === String(base), ins(call(mk())));
    check(`${label}: 지급보험금 100,000 → 한도가 아직 남아 ins ${base}`,
      ins(call(mk({ priorAnnualInsurancePaid: 100_000 }))) === String(base));
  }
  check("주사료: 기존 지급 2,300,000 → 남은 한도 200,000이 구속한다",
    ins(call(INJ({ priorAnnualInsurancePaid: 2_300_000 }))) === "200000",
    ins(call(INJ({ priorAnnualInsurancePaid: 2_300_000 }))));
  check("근골격계: 기존 지급 3,300,000 → 남은 한도 200,000이 구속한다",
    ins(call(MSK({ priorAnnualInsurancePaid: 3_300_000 }))) === "200000");
  check("중증 MRI: 기존 지급 2,800,000 → 남은 한도 200,000이 구속한다",
    ins(call(MRI({ priorAnnualInsurancePaid: 2_800_000 }))) === "200000");
  check("비중증 MRI: 기존 지급 1,900,000 → 남은 한도 100,000이 구속한다",
    ins(call(NCMRI({ priorAnnualInsurancePaid: 1_900_000 }))) === "100000");
  check("항목별 한도 상수가 그대로",
    S.msk.annualCoverage === 3_500_000 && S.injection.annualCoverage === 2_500_000
    && S.criticalMri.annualCoverage === 3_000_000 && S.nonCriticalMri.annualCoverage === 2_000_000);
}

console.log("\n[G-23] 2. undefined·숫자 0의 기존 계약(바꾸지 않는다)");
{
  for (const [label, mk] of ITEMS) {
    const base = call(mk());
    check(`${label}: undefined → 미전달과 같다`, shape(call(mk({ priorAnnualInsurancePaid: undefined }))) === shape(base));
    check(`${label}: 숫자 0 → 미전달과 같다`, shape(call(mk({ priorAnnualInsurancePaid: 0 }))) === shape(base));
    check(`${label}: 0의 안내도 종전 그대로(0원 전용 안내를 신설하지 않았다)`,
      notes(call(mk({ priorAnnualInsurancePaid: 0 }))) === notes(base));
  }
  check("-0은 0과 같이 취급한다(Number.isSafeInteger(-0) === true)",
    shape(call(INJ({ priorAnnualInsurancePaid: -0 }))) === shape(call(INJ())));
}

console.log("\n[G-23] 3. 항목별 한도 초과·MAX_SAFE는 유효하다(절삭하지 않는다)");
{
  for (const [label, mk] of ITEMS) {
    check(`${label}: 한도와 같은 금액 → 남은 한도 0 → ins 0`,
      ins(call(mk({ priorAnnualInsurancePaid: 9_000_000 }))) === "0");
    check(`${label}: MAX_SAFE → 거부하지 않고 ins 0`,
      ins(call(mk({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER }))) === "0",
      shape(call(mk({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER }))));
    check(`${label}: 한도 초과값을 한도로 깎지 않는다(자기부담이 전액)`,
      !threw(call(mk({ priorAnnualInsurancePaid: 9_000_000 })))
      && ownOf(call(mk({ priorAnnualInsurancePaid: 9_000_000 }))) === 1_000_000);
  }
  check("한도 경계: 주사료 2,500,000 → ins 0, 2,499,999 → ins 1",
    ins(call(INJ({ priorAnnualInsurancePaid: 2_500_000 }))) === "0"
    && ins(call(INJ({ priorAnnualInsurancePaid: 2_499_999 }))) === "1");
}

console.log("\n[G-23] 4. 무효값 차단 — 종전에는 전부 0으로 세탁됐다");
{
  for (const [label, mk] of ITEMS) {
    for (const [vlabel, v] of BAD) {
      const x = call(mk({ priorAnnualInsurancePaid: v }));
      check(`${label} + ${vlabel} → 예외 없이 rejected`, isRejected(x), shape(x));
      check(`${label} + ${vlabel} → 이 축의 이름을 말한다`,
        notes(x).startsWith("기존 지급보험금(priorAnnualInsurancePaid)은 0 이상의 정수여야 합니다 — 값이 올바르지 않아 계산하지 않았습니다."),
        notes(x).slice(0, 60));
      check(`${label} + ${vlabel} → 받은 값 줄이 있다`, /받은 값: /.test(notes(x)));
    }
    check(`${label}: MAX_SAFE 허용 · MAX_SAFE+1 차단`,
      !isRejected(call(mk({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER })))
      && isRejected(call(mk({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER + 1 }))));
  }
  // 종전에 결과를 바꾸던 두 방향을 직접 못박는다.
  check("과다 방향: 음수가 더 이상 0으로 뭉개지지 않는다(종전 ins 700,000, 정답 200,000)",
    isRejected(call(INJ({ priorAnnualInsurancePaid: -2_300_000 }))));
  check("과다 방향: 문자열 '2300000'도 차단된다(종전 ins 700,000)",
    isRejected(call(INJ({ priorAnnualInsurancePaid: "2300000" }))));
  check("과소 방향: MAX_SAFE+1이 더 이상 조용히 한도를 소진하지 않는다(종전 ins 0)",
    isRejected(call(INJ({ priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER + 1 }))));
  check("소수가 더 이상 내림되지 않는다(종전 100,000.7 → 100,000)",
    isRejected(call(INJ({ priorAnnualInsurancePaid: 100_000.7 }))));
  check("숫자 0과 소수 0.5의 결과가 이제 명확히 갈린다",
    statusOf(call(INJ({ priorAnnualInsurancePaid: 0 }))) === "OK"
    && isRejected(call(INJ({ priorAnnualInsurancePaid: 0.5 }))));
}

console.log("\n[G-23] 5. bigint·Symbol·순환 참조·함수에서 예외 없는 안전 표시");
{
  for (const [vlabel, v] of [["bigint", 100_000n], ["Symbol", Symbol("s")],
    ["순환 참조", circ], ["함수", () => 1]] as [string, unknown][]) {
    const x = call(INJ({ priorAnnualInsurancePaid: v }));
    check(`${vlabel} → 예외 없이 안내를 끝까지 만든다`, !threw(x) && /받은 값: /.test(notes(x)), shape(x));
  }
  check("bigint 표시가 직렬화 예외로 끊기지 않는다",
    /받은 값: 100000$/.test(notes(call(INJ({ priorAnnualInsurancePaid: 100_000n })))),
    notes(call(INJ({ priorAnnualInsurancePaid: 100_000n }))).slice(-25));
  check("순환 참조 표시가 예외로 끊기지 않는다",
    /받은 값: \[object Object\]$/.test(notes(call(INJ({ priorAnnualInsurancePaid: circ })))),
    notes(call(INJ({ priorAnnualInsurancePaid: circ }))).slice(-25));
  check("안내는 정확히 두 줄이다(rejected 계약)",
    noteCount(call(INJ({ priorAnnualInsurancePaid: -1 }))) === 2);
}

console.log("\n[G-23] 6. 읽는 계약 — 결과가 아니라 접근자 호출 횟수로 본다");
{
  const probe = (base: object, ret: unknown, key = "priorAnnualInsurancePaid") => {
    let reads = 0; const o = { ...base } as Record<string, unknown>;
    Object.defineProperty(o, key, { get() { reads++; return ret; }, enumerable: true, configurable: true });
    // ⚠ 엔진을 먼저 부르고 나서 reads를 읽는다. 객체 리터럴은 왼쪽부터 평가된다.
    const x = wrap(() => calculateGen2026Item(o as never));
    return { reads, x };
  };
  for (const [label, mk] of ITEMS) {
    const ok = probe(mk(), 100_000);
    check(`${label}: 활성 축을 정확히 1회 읽는다`, ok.reads === 1, `reads=${ok.reads}`);
    check(`${label}: 읽은 값이 실제로 계산에 반영된다`, statusOf(ok.x) === "OK", shape(ok.x));
    const bad = probe(mk(), -1);
    check(`${label}: 무효값도 1회만 읽고 거부한다`, bad.reads === 1 && isRejected(bad.x), `reads=${bad.reads}`);
  }
  // 종전에는 근골격계·주사료가 2회였다(runOnce 두 번). 그 사실을 수치로 못박는다.
  check("두 해석을 돌리는 항목도 1회다(종전 2회)",
    probe(MSK(), 100_000).reads === 1 && probe(INJ(), 100_000).reads === 1);
  // 이 축에 닿기 전에 결과가 정해지는 입력은 읽지 않는다.
  check("형식 검증이 먼저 걸리는 입력은 이 축을 읽지 않는다(0회)",
    probe({ ...INJ(), severity: "bogus" }, 100_000).reads === 0);
  check("경로가 다른 입력(일반 전환)은 별도 보장종목 검증이 읽지 않는다 — 전달용 1회뿐",
    probe(GEN(), 100_000).reads === 1);
  check("상급병실료 경로는 자기 엔진에서만 읽는다(1회)", probe(RC(), 100_000).reads === 1);
  // ⚠ **preflight가 결과를 정한 경로는 읽지 않는다(0회).** 검증을 형식 검증 층으로 올리면
  //   여기가 1회가 된다 — 이 검사가 그 이동을 막는다.
  check("근골격계 승인 회차 preflight(미입력)가 막으면 0회",
    probe(MSK_NO_ACTS(), 100_000).reads === 0, `reads=${probe(MSK_NO_ACTS(), 100_000).reads}`);
  check("근골격계 승인 부족 preflight가 막으면 0회",
    probe(MSK({ priorAnnualTreatmentActCount: 11 }), 100_000).reads === 0);
  check("중증 MRI 종별 preflight가 막으면 0회",
    probe(MRI_NO_TIER(), 100_000).reads === 0, `reads=${probe(MRI_NO_TIER(), 100_000).reads}`);
  // 던지는 접근자.
  const boomProbe = (base: object) => {
    let boom = 0; const o = { ...base } as Record<string, unknown>;
    Object.defineProperty(o, "priorAnnualInsurancePaid",
      { get() { boom++; throw new RangeError("touched"); }, enumerable: true, configurable: true });
    const x = wrap(() => calculateGen2026Item(o as never));
    return { boom, x };
  };
  // 계산까지 가는 경로: 활성 축은 읽어야 검증할 수 있으므로 예외가 나온다. 호출자 객체의
  //   문제이고, 기준선에서도 같았다(1회 실행 후 사망). 여기서 고정하는 것은 **횟수**다.
  const boomCalc = boomProbe(INJ());
  check("계산 경로: 던지는 접근자도 1회만 실행된다", threw(boomCalc.x) && boomCalc.boom === 1, `reads=${boomCalc.boom}`);
  // ⚠ **종전에 안전하게 차단되던 입력에 새 예외를 만들지 않는다.**
  const boomMsk = boomProbe(MSK_NO_ACTS());
  check("승인 preflight 차단 + 던지는 접근자 → 예외 없음 · 0회 · 기존 안내",
    !threw(boomMsk.x) && boomMsk.boom === 0 && isBlocked(boomMsk.x, 1_000_000)
    && notes(boomMsk.x).startsWith(MSK_PREFLIGHT_NOTE), `reads=${boomMsk.boom} ${shape(boomMsk.x)}`);
  const boomMri = boomProbe(MRI_NO_TIER());
  check("MRI 종별 preflight 차단 + 던지는 접근자 → 예외 없음 · 0회 · 기존 안내",
    !threw(boomMri.x) && boomMri.boom === 0 && isBlocked(boomMri.x, 1_000_000)
    && notes(boomMri.x).startsWith(MRI_PREFLIGHT_NOTE), `reads=${boomMri.boom} ${shape(boomMri.x)}`);
  const boomBad = boomProbe({ ...INJ(), severity: "bogus" });
  check("형식 검증이 먼저 걸리는 입력 + 던지는 접근자 → 예외 없음 · 0회",
    !threw(boomBad.x) && boomBad.boom === 0 && isRejected(boomBad.x));
}

console.log("\n[G-23] 7. 지급 0원 HOLD — 값·상태·문구를 바꾸지 않는다");
{
  // 진짜 HOLD: 지급 0원 행이 횟수를 소진하는지에 따라 뒤 행의 보상이 갈린다.
  const holdInput = INJ({
    priorAnnualCoveredCount: S.injection.annualVisits - 2,
    lines: [{ amount: 20_000, visit: "outpatient" }, { amount: 20_000, visit: "outpatient" }, LINE],
  });
  const hold = call(holdInput);
  check("지급 0원 HOLD가 그대로 작동한다", isBlocked(hold, 1_040_000), shape(hold));
  check("HOLD 안내 세 줄이 그대로",
    notes(hold).startsWith("지급 보험금이 0원인 치료행위가 연간 보상 횟수를 소진하는지는 표준약관에 정해져 있지 않습니다.")
    && notes(hold).includes("가입하신 보험사에 확인해 주세요."), notes(hold).slice(0, 60));
  check("HOLD 상황에서도 유효한 지급보험금은 그대로 HOLD를 낸다",
    isBlocked(call(INJ({ ...holdInput, priorAnnualInsurancePaid: 100_000 })), 1_040_000));
  check("HOLD 상황이라도 무효한 지급보험금은 형식 거부가 먼저다",
    isRejected(call(INJ({ ...holdInput, priorAnnualInsurancePaid: -1 }))));
  check("MRI는 횟수 한도가 없어 해석 차이가 없다(HOLD 대상이 아니다)",
    statusOf(call(MRI({ lines: [{ amount: 20_000, visit: "outpatient" }, LINE] }))) === "OK");

  // ⚠ 종전 결함: 호출마다 값이 달라지는 접근자가 두 해석을 **서로 다른 원값**에서 출발시켜
  //   계산 차이가 없는데도 HOLD 차단을 만들었다. 이제 한 번 읽은 값을 두 해석이 공유한다.
  const seq = [0, 9_000_000, 0, 9_000_000];
  let i = 0;
  const drift = { ...INJ() } as Record<string, unknown>;
  Object.defineProperty(drift, "priorAnnualInsurancePaid",
    { get() { return seq[i++ % seq.length]; }, enumerable: true, configurable: true });
  const driftResult = wrap(() => calculateGen2026Item(drift as never));
  check("값이 달라지는 접근자가 더 이상 허위 HOLD를 만들지 않는다(종전 PENDING_UNVERIFIED)",
    statusOf(driftResult) === "OK", shape(driftResult));
  check("그 경우 첫 번째 읽은 값이 두 해석 모두에 쓰인다", i === 1 && ins(driftResult) === "700000",
    `reads=${i} ins=${ins(driftResult)}`);
}

console.log("\n[G-23] 8. 안내 우선순위 — preflight가 먼저, 그 뒤에 이 축을 본다");
{
  // 형식 검증 층(형제 축·행·경로)은 종전 순서 그대로다.
  check("보상한 횟수 형식 오류가 지급보험금보다 먼저",
    notes(call(INJ({ priorAnnualCoveredCount: -1, priorAnnualInsurancePaid: -1 })))
      .includes("이미 보상한 횟수(priorAnnualCoveredCount)"));
  check("행 진료비 형식 오류가 지급보험금보다 먼저",
    notes(call(INJ({ lines: [{ amount: "x", visit: "outpatient" }], priorAnnualInsurancePaid: -1 })))
      .includes("1번째 행의 진료비(amount)"));
  check("치료행위 수 형식 오류가 지급보험금보다 먼저",
    notes(call(MSK({ priorAnnualTreatmentActCount: -1, priorAnnualInsurancePaid: -1 })))
      .includes("과거 치료행위 수(priorAnnualTreatmentActCount)"));
  check("승인 회차 형식 오류가 지급보험금보다 먼저",
    notes(call(MSK({ approvedThroughVisit: 15, priorAnnualInsurancePaid: -1 })))
      .includes("보상 승인 회차(approvedThroughVisit)"));
  check("경로 대조가 지급보험금보다 먼저",
    notes(call({ ...MRI(), severity: "non_critical", item: "musculoskeletal_esw",
      priorAnnualInsurancePaid: -1 })).includes("이 조합은"));

  // ⚠ **preflight 안내가 이 축의 형식 거부보다 먼저다.** 무효값이 실려 있어도 preflight
  //   안내가 그대로 나가야 한다 — 종전 계약이고, 이번에 바꾸지 않았다.
  const mskNoActs = call(MSK_NO_ACTS({ priorAnnualInsurancePaid: -1 }));
  check("승인 회차 preflight(미입력)가 무효 지급보험금보다 먼저",
    isBlocked(mskNoActs, 1_000_000) && notes(mskNoActs).startsWith(MSK_PREFLIGHT_NOTE), shape(mskNoActs));
  const mskShort = call(MSK({ priorAnnualTreatmentActCount: 11, priorAnnualInsurancePaid: -1 }));
  check("승인 부족 preflight가 무효 지급보험금보다 먼저",
    isBlocked(mskShort, 1_000_000) && notes(mskShort).startsWith(MSK_PREFLIGHT_NOTE), shape(mskShort));
  const mriNoTier = call(MRI_NO_TIER({ priorAnnualInsurancePaid: -1 }));
  check("중증 MRI 종별 preflight가 무효 지급보험금보다 먼저",
    isBlocked(mriNoTier, 1_000_000) && notes(mriNoTier).startsWith(MRI_PREFLIGHT_NOTE), shape(mriNoTier));
  // 무효값의 종류를 가리지 않는다.
  for (const [vlabel, v] of BAD) {
    check(`승인 preflight + ${vlabel} → 기존 preflight 안내 그대로`,
      notes(call(MSK_NO_ACTS({ priorAnnualInsurancePaid: v }))).startsWith(MSK_PREFLIGHT_NOTE));
    check(`MRI 종별 preflight + ${vlabel} → 기존 preflight 안내 그대로`,
      notes(call(MRI_NO_TIER({ priorAnnualInsurancePaid: v }))).startsWith(MRI_PREFLIGHT_NOTE));
  }
  // preflight를 통과한 뒤에는 이 축을 본다.
  check("승인 preflight 통과 후 무효 지급보험금 → rejected",
    isRejected(call(MSK({ priorAnnualTreatmentActCount: 0, priorAnnualInsurancePaid: -1 }))));
  check("MRI 종별을 선택하면 무효 지급보험금 → rejected",
    isRejected(call(MRI_NO_TIER({ lines: [{ amount: 1_000_000, visit: "inpatient", tier: "hospital" }],
      priorAnnualInsurancePaid: -1 }))));
  // preflight 자체는 유효값에서도 그대로다.
  check("유효한 지급보험금이면 두 preflight가 종전대로 나온다",
    isBlocked(call(MSK_NO_ACTS({ priorAnnualInsurancePaid: 100_000 })), 1_000_000)
    && isBlocked(call(MRI_NO_TIER({ priorAnnualInsurancePaid: 100_000 })), 1_000_000));
  check("지급보험금을 아예 넘기지 않아도 두 preflight가 종전대로 나온다",
    isBlocked(call(MSK_NO_ACTS()), 1_000_000) && isBlocked(call(MRI_NO_TIER()), 1_000_000));
}

console.log("\n[G-23] 9. 다른 경로 무회귀 — 계약을 섞지 않는다");
{
  // 일반 전환 경로: calculateMany2026의 blocked() 계약(진료비 합계 보존)을 그대로 둔다.
  for (const [vlabel, v] of [["음수", -1], ["소수", 0.5], ["NaN", NaN], ["문자열", "100000"],
    ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1]] as [string, unknown][]) {
    const x = call(GEN({ priorAnnualOutpatientVisits: 0, priorAnnualInsurancePaid: v }));
    check(`일반 전환 + ${vlabel} → rejected가 아니라 종전 blocked 계약`,
      !isRejected(x) && routeOf(x) === "general" && totalOf(x) === 1_000_000, shape(x));
  }
  check("일반 전환 정상값은 그대로 계산된다",
    statusOf(call(GEN({ priorAnnualOutpatientVisits: 0, priorAnnualInsurancePaid: 100_000 }))) === "OK",
    shape(call(GEN({ priorAnnualOutpatientVisits: 0, priorAnnualInsurancePaid: 100_000 }))));
  // 상급병실료: G-22가 닫은 계약 그대로.
  check("상급병실료 + 음수 → G-22의 rejected 문구 그대로",
    notes(call(RC({ priorAnnualInsurancePaid: -1 })))
      .startsWith("기존 지급보험금(priorAnnualInsurancePaid) 값이 올바르지 않아 계산하지 않았습니다."),
    notes(call(RC({ priorAnnualInsurancePaid: -1 }))).slice(0, 60));
  check("상급병실료 정상 계산 그대로", ins(call(RC({ priorAnnualInsurancePaid: 100_000 }))) === "1000000");
  // 형제 축의 계약도 그대로.
  check("보상한 횟수 미사용 조합 거부 그대로",
    notes(call(MRI({ priorAnnualCoveredCount: 0 }))).includes("이미 보상한 횟수(priorAnnualCoveredCount)는 <표1>에"));
  check("누적 공제금액 미사용 조합 거부 그대로",
    notes(call(INJ({ priorAnnualInpatientDeductible: 0 }))).includes("누적 공제금액(priorAnnualInpatientDeductible)은 500만 원"));
  check("통원 카운터 stray 거부 그대로",
    notes(call(INJ({ priorAnnualOutpatientVisits: 0 }))).includes("통원 카운터는 별도 보장종목"));
}

console.log("\n[G-23] 10. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("이 축을 안전 정수로 막는다",
    /if \(paidRaw !== undefined\n\s*&& !\(typeof paidRaw === "number" && Number\.isSafeInteger\(paidRaw\) && paidRaw >= 0\)\) \{/.test(body),
    "패턴 불일치");
  check("거부 안내가 형제 축과 같은 형식이다",
    /return rejected\("기존 지급보험금\(priorAnnualInsurancePaid\)은 0 이상의 정수여야 합니다 —", paidRaw\);/.test(body));
  // ⚠ **위치가 계약이다.** 검증은 `validateItemInput`이 아니라 두 preflight 뒤에 있어야 한다.
  const iValidate = body.indexOf("function validateItemInput(");
  const iCalc = body.indexOf("function calculateSpecialItem2026(");
  const iMskPre = body.indexOf('input.item === "musculoskeletal_esw"', iCalc);
  const iPaid = body.indexOf("const paidRaw", iCalc);
  const iRun = body.indexOf("const counted = runOnce(", iCalc);
  check("검증이 validateItemInput 밖에 있다(형식 검증 층으로 올리지 않았다)",
    iValidate > 0 && iCalc > iValidate && iPaid > iCalc,
    `${iValidate}/${iCalc}/${iPaid}`);
  check("검증 위치: 두 preflight → 지급보험금 → 두 해석 계산",
    iMskPre > 0 && iMskPre < iPaid && iPaid < iRun, `${iMskPre}/${iPaid}/${iRun}`);
  check("validateItemInput은 이 축을 읽지 않는다",
    body.slice(iValidate, iCalc).indexOf("priorAnnualInsurancePaid") === -1);
  check("검증한 원값을 지역 상수로 고정한다",
    /const priorPaid = paidRaw as number \| undefined;/.test(body));
  // ⚠ **낡은 계약 3건을 교체했다(G-26).** 형태만 바뀌었고 **G-23이 세운 계약은 그대로**다 —
  //   `runOnce`가 검증된 원값을 인자로 받고, 두 해석이 같은 값에서 출발한다.
  //   G-26이 진료비 배열도 같은 방식으로 넘기면서 `runOnce`의 인자와 `validateItemInput`의
  //   반환 형태가 달라졌다(진료비를 돌려주므로 `null`이 아니라 `{ amounts }`).
  // ⚠ **낡은 계약 2건을 다시 교체했다(G-29).** 위치는 같고(`runOnce` 시그니처와 두 해석
  //   호출), 기존 의미도 같다 — "검증된 원값을 인자로 받고 두 해석이 같은 값에서 출발한다".
  //   교체 이유: G-29가 형제 두 축(보상한 횟수·누적 공제금액)도 같은 통로에 실으면서
  //   `amounts: number[]` 인자가 `checked: CheckedItemInput` 하나로 합쳐졌다. 종전에는 그
  //   두 축만 `runOnce`가 `input`에서 다시 읽어(각각 3회·2회) 두 해석이 서로 다른 값에서
  //   출발할 수 있었다.
  check("runOnce가 검증된 값을 인자로 받는다",
    /priorPaid: number \| undefined, checked: CheckedItemInput,\n\): Gen2026SpecialItemResult \{/.test(body)
    && /let paid = priorPaid \?\? 0;/.test(body));
  check("두 해석이 같은 원값에서 출발한다(지급보험금·진료비·형제 두 축 모두)",
    /const counted = runOnce\(input, spec, true, priorPaid, checked\);/.test(body)
    && /const notCounted = runOnce\(input, spec, false, priorPaid, checked\);/.test(body)
    && /let count = checked\.covered \?\? 0;/.test(body)
    && /let poolUsed = checked\.pool \?\? 0;/.test(body));
  check("진입점의 검증 계약은 종전 그대로다(검증 → 거부면 반환 → 아니면 계산)",
    /const checked = validateItemInput\(rest\);/.test(body)
    && /if \("route" in checked\) return checked;/.test(body)
    // ⚠ **낡은 앵커를 두 번 교체했다(G-28 → G-29).** G-28에서 `checked.acts`를 더했고,
    //   G-29에서 형제 두 축까지 실리면서 검증 결과 전체를 그대로 넘기는 형태가 됐다.
    //   G-23이 세운 계약(검증 → 거부면 반환 → 아니면 계산)은 세 번 모두 그대로다.
    && /\? calculateSpecialItem2026\(rest, checked\)/.test(body));
  check("이 파일에서 이 속성을 정확히 두 번만 읽는다(special_item 검증 1 + 일반 전환 전달 1)",
    (body.match(/\.priorAnnualInsurancePaid/g) ?? []).length === 2,
    String((body.match(/\.priorAnnualInsurancePaid/g) ?? []).length));
  check("이 축에 내림·클램프를 걸지 않는다",
    !/nonNegInt\(input\.priorAnnualInsurancePaid\)/.test(body)
    && !/Math\.floor\([^)]*priorPaid/.test(body));
  // ⚠ **낡은 계약을 교체했다(G-29).** 위치는 같고(`nonNegInt` 사용처 고정), 기존 의미는
  //   "관용 파서를 남기되 형제 두 축의 미입력 기본값 전용으로 못박는다"였다. 교체 이유:
  //   G-29가 그 두 축을 `CheckedItemInput`으로 옮기면서 **마지막 사용처가 사라져 함수를
  //   삭제했다.** 두 축 모두 위에서 `Number.isSafeInteger(v) && v >= 0`으로 검증되므로
  //   세탁할 값이 남지 않는다. 남겨 두면 새 축이 다시 그 관용(음수→0·소수 내림·문자열→0)을
  //   타고 검증을 우회할 수 있다 — G-26이 공용 `isNum()`을 폐기한 것과 같은 이유다.
  check("관용 파서 nonNegInt가 이 파일에서 사라졌다", !/nonNegInt/.test(body));
  check("미입력 기본값은 검증된 값에 ?? 0으로 준다(관용 파서 없이)",
    /let count = checked\.covered \?\? 0;/.test(body) && /let poolUsed = checked\.pool \?\? 0;/.test(body));
  // ── G-22 보고 정정과 그 뒤 (G-26에서 교체) ───────────────────────
  //   ⚠ **낡은 계약 3건을 교체했다.** G-22 커밋 메시지·문서는 공용 isNum 호출부를 "4곳"이라
  //     적었으나 실제로는 5곳이었고(`raw.amounts.every(isNum)`가 함수 참조라 `isNum(`
  //     패턴에 걸리지 않았다), G-22 이후 남은 사용처는 3곳이었다. 이 파일은 그 **3곳이
  //     그대로 남아 있는지**를 고정했다. G-26이 그 3곳을 모두 진료비 전용 가드로 바꿔
  //     사용처가 0이 되었고, 공용 `isNum`은 삭제됐다. 이제 **삭제되었는지**를 고정한다.
  const guards = readFileSync("src/lib/insurance/engine/itemGuards.ts", "utf8");
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  const roomBody = room.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("공용 isNum이 삭제됐다(사용처 0)",
    !/export const isNum/.test(guards) && !/\bisNum\b/.test(body) && !/\bisNum\b/.test(roomBody));
  check("이 파일의 진료비 두 축이 진료비 전용 가드를 쓴다(행별 1 + 배열 원소 1)",
    (body.match(/isClaimAmount\(/g) ?? []).length === 2,
    String((body.match(/isClaimAmount\(/g) ?? []).length));
  check("상급병실료의 진료비 축도 같은 가드를 쓴다(1곳)",
    (roomBody.match(/isClaimAmount\(/g) ?? []).length === 1);
  check("진료비 전용 가드는 0 이상의 안전한 정수만 통과시킨다",
    /export const isClaimAmount = \(v: unknown\): v is number =>\n\s*typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0;/.test(guards));
  // HOLD·산식·한도는 그대로다.
  check("지급 0원 HOLD 안내가 그대로", /ZERO_PAY_HOLD_NOTES/.test(body)
    && /지급 보험금이 0원인 치료행위가 연간 보상 횟수를 소진하는지는 표준약관에 정해져 있지 않습니다\./.test(raw));
  check("fingerprint 필드 구성이 그대로",
    /r\.lines\.map\(\(l\) => \[l\.index, l\.covered, l\.amount, l\.ownPay, l\.insurancePay,/.test(body));
  check("승인 회차 상수·규칙이 그대로",
    /GEN2026_MSK_APPROVED_THROUGH_VALUES: readonly Gen2026MskApprovedThrough\[\] =\n\s*\[10, 20, 30, 40, 50\];/.test(raw));
  check("180일 계속 치료 미반영 고지가 그대로", /180일까지 남은 금액과 남은 횟수를 한도로 보상되지만/.test(raw));
  check("pool 합산 범위 HOLD 주석이 그대로", /GEN2026-CRITICAL-DEDUCTIBLE-POOL-SCOPE = HOLD/.test(raw));
  // 다른 엔진의 사본은 건드리지 않았다.
  for (const [label, path] of [["2·3세대", "src/lib/insurance/engine/multiClaim.ts"],
    /* G-30에서 삭제 */] as [string, string][]) {
    check(`${label} 엔진의 nonNegInt 사본은 그대로`, /const nonNegInt =/.test(readFileSync(path, "utf8")));
  }
  const stripped = (path: string) => readFileSync(path, "utf8").split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  // ⚠ 이 파일 자신의 `nonNegInt`는 G-29에서 사라졌다(위 계약 교체 참조).
  check("4세대·상급병실료 엔진에는 nonNegInt가 없다(G-18·G-22에서 제거 — 주석 언급만 남았다)",
    !/nonNegInt/.test(stripped("src/lib/insurance/engine/multiClaim2021.ts"))
    && !/nonNegInt/.test(roomBody));
}

console.log(`\n[G-23 별도 보장종목 기존 지급보험금 축 값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
