// G-21 — 5세대 다회 엔진의 **연간 보험가입금액 축**(annualCoverageLimit) 값 검증과 안내 분리.
//   대상: `multiClaim2026.ts`의 일반 비급여 경로(직접 경로와 일반 전환 경로가 공유한다).
//
// 종전 동작(기준선 99925c3 엔진 직접 호출로 실측, UI 미경유):
//   `const annualLimit = raw === undefined || !Number.isFinite(raw) || raw <= 0
//      ? undefined : Math.min(Math.floor(raw), annualMax);`
//   방향이 **값에 따라 갈렸다.**
//     ① 음수·NaN·±Infinity·문자열·빈 문자열·null·불리언·객체·배열·bigint·Symbol·순환 참조
//        → 미입력과 같아져 **연간 한도가 통째로 사라졌다.** 그러면서 안내는 "입력하지 않으면
//        적용하지 않습니다"라고 말했다 — 값을 넘겼는데도.
//        실측(일반 전환·중증 입원·청구 200만·기존 지급 100만): 정답 한도 400,000에서 ins 0인데
//        무효값 13종은 모두 ins 1,400,000이었다.
//     ② `Math.floor`가 **0과 1 사이의 소수를 한도 0원으로 만들어 적용했다.** 실측에서 `0.5`는
//        보험금을 **0원**으로 만들었고(같은 격자에서 명시적 `0`은 미적용이라 전액 지급이다)
//        그때 아무 안내도 나가지 않았다. 1 이상의 소수는 조용히 내려갔다.
//     ③ 안전 정수 범위를 넘는 값은 상한으로 잘려 통과했다.
//   ⚠ 이 축은 **런타임 예외를 내지 않았다** — `Number.isFinite`가 bigint·객체를 걸러 던지지
//     않기 때문이다. 문제는 예외가 아니라 조용히 틀린 금액이다.
//   ⚠ 공개 화면은 도달할 수 없다. UI 파서가 먼저 막는다. **엔진 직접 호출 계약** 전용이다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 비급여 경로에서 원문을 **한 번만** 읽고 엄격 검증한다. 명시적 `0`의 **안내를 분리**한다.
//   - 하지 않는다: `undefined`·숫자 `0`의 계산 변경, 상한 클램프 변경, 계산식·상한 상수·라우팅·
//     UI 파서 변경, G-20 지급보험금 계약 변경, `specialItem2026`·`roomCharge2026` 변경,
//     지급 0원 HOLD의 값·상태·계산 동작 변경, 급여에 실려 온 stray 값의 조용한 폐기 동작 자체.
//
// ⚠ `0`을 한도 미적용으로 보는 것은 **이 계산기의 정책**이지 약관 해석이 아니다. 0원 가입이
//   실제로 선택 가능한 계약값인지, 그 경우 한도가 0원인지는 원문에서 확인하지 않았다.
import { readFileSync } from "node:fs";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
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
const statusOf = (x: Caught) => threw(x) ? "THROW" : x.r.status;
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/lines=${x.r.lines.length}/caps=[${[...x.r.appliedCaps].sort().join(",")}]`;
const isBlocked = (x: Caught, amt: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === amt && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && x.r.lines.length === 0;

const circ: Record<string, unknown> = {}; circ.self = circ;
const MAXC = GEN2026.nonBenefit.critical.annualLimitMax;
const BAD: [string, unknown][] = [
  ["음수", -400_000], ["음수 -1", -1], ["소수 400000.9", 400_000.9], ["소수 0.5", 0.5],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["문자열 숫자", "400000"], ["빈 문자열", ""], ["null", null],
  ["true", true], ["false", false], ["{}", {}], ["[400000]", [400_000]],
  ["bigint", 400_000n], ["Symbol", Symbol("s")], ["순환 참조", circ],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1],
];

/** 일반 전환 경로 — 중증 입원. 한도 없으면 ins 1,400,000, 한도 400,000이면 ins 0. */
const RT = (extra: Record<string, unknown> = {}) => ({
  route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
  injectionPurpose: "anticancer", cause: "injury", visit: "inpatient", tier: "hospital",
  amounts: [2_000_000], priorAnnualInsurancePaid: 1_000_000, ...extra,
});
const rt = (extra: Record<string, unknown> = {}) => wrap(() => calculateGen2026Item(RT(extra) as never));
/** 비급여 직접 경로 — 중증 입원(통원 가입금액 안내가 섞이지 않는다). */
const NB = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical",
  visit: "inpatient", tier: "hospital", amounts: [2_000_000], priorAnnualInsurancePaid: 1_000_000, ...extra,
});
const nb = (extra: Record<string, unknown> = {}) => wrap(() => calculateMany2026(NB(extra) as never));
/** 급여 경로 — 이 축이 타입에 없다. */
const BF = (extra: Record<string, unknown> = {}) => ({
  cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic",
  nhisCoinsuranceRate: 0.3, amounts: [300_000], ...extra,
});
const bf = (extra: Record<string, unknown> = {}) => wrap(() => calculateMany2026(BF(extra) as never));

const NOTE_UNSET = "입력하지 않으면 적용하지 않습니다";
const NOTE_ZERO = "연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다";
const FIRST = "연간 보험가입금액(annualCoverageLimit)은 0 이상의 안전한 정수";
const NEUTRAL = "계산기가 잘못된 값을 임의로 고치지 않습니다";

console.log("\n[G-21] 1. undefined·숫자 0의 계산 무회귀");
{
  const u = nb(), z = nb({ annualCoverageLimit: 0 });
  check("미전달 → ins 1,400,000(한도 미적용)", ins(u) === "1400000", ins(u));
  check("숫자 0 → 미전달과 계산이 완전히 같다", shape(z) === shape(u), shape(z));
  const ru = rt(), rz = rt({ annualCoverageLimit: 0 });
  check("전환 경로도 같다", shape(rz) === shape(ru), shape(rz));
}

console.log("\n[G-21] 2. 미입력과 명시적 0원의 안내를 나눈다");
{
  const u = nb(), z = nb({ annualCoverageLimit: 0 });
  check("미전달 → 기존 미입력 안내", notes(u).includes(NOTE_UNSET));
  check("미전달 → 0원 안내는 나오지 않는다", !notes(u).includes(NOTE_ZERO));
  check("숫자 0 → 0원 전용 안내", notes(z).includes(NOTE_ZERO), notes(z).slice(-90));
  check("숫자 0 → 미입력 안내가 더 이상 나오지 않는다", !notes(z).includes(NOTE_UNSET));
  check("두 안내는 동시에 나오지 않는다",
    [u, z].every((x) => Number(notes(x).includes(NOTE_UNSET)) + Number(notes(x).includes(NOTE_ZERO)) === 1));
  check("한도를 적용하면 둘 다 나오지 않는다",
    !notes(nb({ annualCoverageLimit: 400_000 })).includes(NOTE_UNSET)
    && !notes(nb({ annualCoverageLimit: 400_000 })).includes(NOTE_ZERO));
  check("전환 경로도 0원 전용 안내", notes(rt({ annualCoverageLimit: 0 })).includes(NOTE_ZERO));
  // ⚠ 0원 안내는 계산기 정책만 말한다. 약관상 의미·계약 유효성을 단정하지 않는다.
  //   범위: **사용자 안내 텍스트만** 본다(주석·문서는 "확인하지 않았다"를 설명해야 하므로 대상이 아니다).
  const zNote = notes(z);
  check("0원 안내가 계산기 정책임을 밝힌다", zNote.includes("계산기에서는"));
  const ZERO_LEGAL = new RegExp("(0원[^\\n]{0,30}(약" + "관상|약" + "관에|약" + "관은|무효|유효))|((약" + "관상|약" + "관에|약" + "관은)[^\\n]{0,30}0원)");
  check("0원 안내가 약관상 의미·계약 유효성을 단정하지 않는다", !ZERO_LEGAL.test(zNote), (zNote.match(ZERO_LEGAL) ?? [""])[0]);
  check("실제 한도가 0원이라고 말하지 않는다", !/한도[^\n]{0,10}0원|0원[^\n]{0,10}한도(가|는|로) 적용/.test(zNote), zNote.slice(-90));
}

console.log("\n[G-21] 3. 정상값·상한 경계·상한 초과 클램프 무회귀");
{
  check("정상 400,000 → ins 0(한도가 구속)", ins(nb({ annualCoverageLimit: 400_000 })) === "0");
  check("정상 2,000,000 → ins 1,000,000", ins(nb({ annualCoverageLimit: 2_000_000 })) === "1000000",
    ins(nb({ annualCoverageLimit: 2_000_000 })));
  check("상한과 같은 값 → 통과", ins(nb({ annualCoverageLimit: MAXC })) === "1400000");
  check("상한 초과 → 기존 클램프 유지(상한과 같은 결과)",
    ins(nb({ annualCoverageLimit: MAXC + 1_000_000 })) === ins(nb({ annualCoverageLimit: MAXC })));
  check("MAX_SAFE → 거부하지 않고 클램프", ins(nb({ annualCoverageLimit: Number.MAX_SAFE_INTEGER })) === "1400000");
  check("클램프가 실제로 상한에서 일어난다",
    ins(nb({ annualCoverageLimit: MAXC + 1, priorAnnualInsurancePaid: MAXC - 100_000 })) === "100000",
    ins(nb({ annualCoverageLimit: MAXC + 1, priorAnnualInsurancePaid: MAXC - 100_000 })));
  check("상한 상수가 그대로", MAXC === 50_000_000 && GEN2026.nonBenefit.nonCritical.annualLimitMax === 10_000_000);
  check("상한 초과·MAX_SAFE에는 미입력·0원 안내가 없다",
    !notes(nb({ annualCoverageLimit: Number.MAX_SAFE_INTEGER })).includes(NOTE_UNSET)
    && !notes(nb({ annualCoverageLimit: Number.MAX_SAFE_INTEGER })).includes(NOTE_ZERO));
}

console.log("\n[G-21] 4. 무효값 차단 · 소수 내림 제거");
{
  for (const [label, v] of BAD) {
    const x = nb({ annualCoverageLimit: v });
    check(`${label} → 예외 없이 blocked(진료비 합계 보존)`, isBlocked(x, 2_000_000), shape(x));
    check(`${label} → 전용 안내 첫 줄`, notes(x).startsWith(FIRST), notes(x).slice(0, 45));
    check(`${label} → 중립 문구`, notes(x).includes(NEUTRAL));
    check(`${label} → 종전 미입력 안내가 나오지 않는다`, !notes(x).includes(NOTE_UNSET));
    check(`${label} → 전환 경로도 같다`, isBlocked(rt({ annualCoverageLimit: v }), 2_000_000));
  }
  check("MAX_SAFE 허용·MAX_SAFE+1 차단",
    statusOf(nb({ annualCoverageLimit: Number.MAX_SAFE_INTEGER })) === "OK"
    && isBlocked(nb({ annualCoverageLimit: Number.MAX_SAFE_INTEGER + 1 }), 2_000_000));
  // ⚠ 소수 내림이 실제로 사라졌는지 — 종전에 결과를 바꾸던 두 사례로 확인한다.
  check("소수 0.5는 더 이상 한도 0원으로 적용되지 않는다(종전 ins 0)",
    isBlocked(nb({ annualCoverageLimit: 0.5 }), 2_000_000));
  check("1 이상의 소수도 더 이상 내려가지 않는다(종전 400,000으로 내림)",
    isBlocked(nb({ annualCoverageLimit: 400_000.9 }), 2_000_000));
  check("명시적 0과 소수 0.5의 결과가 이제 명확히 갈린다",
    statusOf(nb({ annualCoverageLimit: 0 })) === "OK" && statusOf(nb({ annualCoverageLimit: 0.5 })) === "PENDING_UNVERIFIED");
  // 안내가 방향을 단정하지 않는다.
  const noteText = BAD.flatMap(([, v]) => { const x = nb({ annualCoverageLimit: v }); return threw(x) ? [] : (x.r.notes ?? []); }).join("\n");
  check("차단 안내 본문에 방향 낱말이 없다",
    !/과다|과소|많이 산출|적게 산출/.test(noteText), (noteText.match(/과다|과소|많이 산출|적게 산출/) ?? [""])[0]);
  check("차단 안내가 약관 근거를 달지 않는다", !/약관/.test(noteText), (noteText.match(/[^\n]{0,20}약관[^\n]{0,20}/) ?? [""])[0]);
  check("모든 무효값이 같은 안내로 차단된다", new Set(BAD.map(([, v]) => {
    const x = nb({ annualCoverageLimit: v }); return threw(x) ? "THROW" : (x.r.notes ?? []).slice(0, 2).join(" | ");
  })).size === 1);
}

console.log("\n[G-21] 5. bigint·Symbol·순환 참조에서 예외 없는 안내");
{
  for (const [label, v] of [["bigint", 400_000n], ["Symbol", Symbol("s")], ["순환 참조", circ]] as [string, unknown][]) {
    const x = nb({ annualCoverageLimit: v });
    check(`${label} → 예외 없음`, !threw(x), shape(x));
    check(`${label} → 안내를 끝까지 만든다`, notes(x).includes(NEUTRAL) && /받은 값: /.test(notes(x)));
  }
  check("bigint 표시가 JSON 직렬화 예외로 끊기지 않는다",
    /받은 값: 400000$/.test(notes(nb({ annualCoverageLimit: 400_000n }))),
    notes(nb({ annualCoverageLimit: 400_000n })).slice(-30));
}

console.log("\n[G-21] 6. 접근자 호출 횟수 — 읽는 계약을 결과와 따로 검사한다");
{
  const probe = (base: Record<string, unknown>, ret: unknown) => {
    let reads = 0; const o = { ...base };
    Object.defineProperty(o, "annualCoverageLimit", { get() { reads++; return ret; }, enumerable: true, configurable: true });
    // ⚠ 엔진을 **먼저** 부르고 그 다음에 reads를 읽는다. 객체 리터럴에 나란히 쓰면 `reads`가
    //   왼쪽에서 먼저 평가돼 호출 전 값(0)이 잡힌다.
    const x = wrap(() => calculateMany2026(o as never));
    return { reads, x };
  };
  const a = probe(NB(), 400_000);
  check("활성 경로: 접근자 정확히 1회", a.reads === 1, `reads=${a.reads}`);
  check("활성 경로: 읽은 값이 한도로 적용된다", ins(a.x) === "0", ins(a.x));
  // 지급 0원 HOLD로 두 해석을 비교하는 통원 경로에서도 한 번만 읽는다.
  const b = probe({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general",
    severity: "non_critical", visit: "outpatient", amounts: [300_000, 300_000],
    priorAnnualOutpatientDays: 0, priorAnnualInsurancePaid: 300_000 }, 400_000);
  check("HOLD 이중 실행 경로: 접근자 1회", b.reads === 1, `reads=${b.reads}`);
  // ⚠ **계약이 바뀌었다(G-30).** G-21 시점에는 급여가 이 이름을 **읽지 않아** 조용히
  //   폐기했고, 그 사실(접근자 0회)을 여기서 고정하고 있었다. 후속 과제로 남겼던 그 조용한
  //   폐기를 G-30이 닫았다 — 이 축은 비급여 특별약관 제5조①의 축이라 급여에 대응 축이 없다.
  //   조용한 폐기를 막으려면 값을 **읽어야** 하므로 접근자도 1회 실행되고, 던지는 접근자의
  //   예외는 전파된다. 그 대상은 **종전에 조용히 폐기하며 성공하던 입력뿐**이다.
  const c = probe(BF(), 400_000);
  check("급여(미사용 경로): 접근자 정확히 1회", c.reads === 1, `reads=${c.reads}`);
  check("급여(미사용 경로): 읽은 값으로 stray를 차단한다", isBlocked(c.x, 300_000), shape(c.x));
  let boomReads = 0;
  const boom = { ...BF() };
  Object.defineProperty(boom, "annualCoverageLimit", { get() { boomReads++; throw new Error("touched"); }, enumerable: true, configurable: true });
  const cb = wrap(() => calculateMany2026(boom as never));
  check("급여: 던지는 접근자는 전파된다(막으려면 읽어야 한다)", boomReads === 1 && threw(cb), `reads=${boomReads}`);
  // 선행 차단 경로에서는 종전 그대로 읽지 않는다.
  let preReads = 0;
  const pre = { ...BF({ amounts: ["abc"] }) };
  Object.defineProperty(pre, "annualCoverageLimit", { get() { preReads++; throw new Error("x"); }, enumerable: true, configurable: true });
  check("급여: 진료비가 먼저 무효면 접근자 0회이고 예외도 없다",
    !threw(wrap(() => calculateMany2026(pre as never))) && preReads === 0, `reads=${preReads}`);
  const d = probe(NB(), "400000");
  check("무효값도 접근자 1회 뒤 차단", d.reads === 1 && isBlocked(d.x, 2_000_000), `reads=${d.reads}`);
  // 급여에 실려 온 stray는 값과 무관하게 차단된다(숫자 0 포함).
  for (const [label, v] of [["숫자 0", 0], ["정상값", 400_000], ...BAD] as [string, unknown][]) {
    check(`급여 + ${label} → stray 차단(진료비 합계 보존)`,
      isBlocked(wrap(() => calculateMany2026(BF({ annualCoverageLimit: v }) as never)), 300_000));
  }
  check("급여: 축을 싣지 않으면 종전대로 계산한다", !isBlocked(bf(), 300_000));
  check("급여: 명시적 undefined는 미제공과 같다",
    shape(bf({ annualCoverageLimit: undefined })) === shape(bf()));
}

console.log("\n[G-21] 7. 안내 우선순위 — 앞선 검증이 가려지지 않는다");
{
  const bad = { annualCoverageLimit: "abc" };
  const strayKey = wrap(() => calculateMany2026({ ...NB(bad), priorAnnualCoveredCount: 3 } as never));
  check("별도 보장종목 전용 키가 먼저", notes(strayKey).includes("별도 보장종목") && !notes(strayKey).includes(FIRST));
  const legacy = wrap(() => calculateMany2026({ ...NB(bad), priorAnnualPaid: 1 } as never));
  check("레거시 priorAnnualPaid가 먼저", notes(legacy).includes("priorAnnualPaid는") && !notes(legacy).includes(FIRST));
  const noItem = wrap(() => calculateMany2026({ ...NB(bad), nonBenefitItem: undefined } as never));
  check("치료유형 preflight가 먼저", !notes(noItem).includes(FIRST), notes(noItem).slice(0, 40));
  const badDeduct = nb({ ...bad, priorAnnualDeductible: -1 });
  check("누적 공제금액 값 검증이 먼저", notes(badDeduct).includes("이미 누적된 공제금액") && !notes(badDeduct).includes(FIRST));
  const badPaid = nb({ ...bad, priorAnnualInsurancePaid: "abc" });
  check("G-20 지급보험금 검증이 먼저",
    notes(badPaid).includes("기존 지급보험금(priorAnnualInsurancePaid)") && !notes(badPaid).includes(FIRST),
    notes(badPaid).slice(0, 45));
  const only = nb(bad);
  check("앞선 입력이 모두 유효하면 이 축의 안내가 나온다", isBlocked(only, 2_000_000) && notes(only).startsWith(FIRST));
  // 통원 카운터도 먼저다.
  const noDays = wrap(() => calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general",
    severity: "non_critical", visit: "outpatient", amounts: [300_000], annualCoverageLimit: "abc" } as never));
  check("통원 카운터 미입력이 먼저", notes(noDays).includes("통원일수") && !notes(noDays).includes(FIRST));
}

console.log("\n[G-21] 8. blocked() 계약 — totalAmount 보존");
{
  for (const [label, amounts, want] of [
    ["1건", [2_000_000], 2_000_000], ["2건", [2_000_000, 500_000], 2_500_000],
    ["0원 포함", [0, 2_000_000], 2_000_000], ["빈 배열", [], 0],
  ] as [string, number[], number][]) {
    const x = nb({ amounts, annualCoverageLimit: "abc" });
    check(`${label}: totalAmount ${want} 보존`, isBlocked(x, want), shape(x));
  }
  const x = nb({ annualCoverageLimit: "abc" });
  check("합계 두 축은 null, lines·caps는 비어 있다",
    !threw(x) && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
    && x.r.lines.length === 0 && x.r.appliedCaps.length === 0, shape(x));
}

console.log("\n[G-21] 9. G-20·다른 진입점·HOLD 무변경");
{
  // G-20 지급보험금 검증은 그대로다.
  check("G-20: 무효 지급보험금은 여전히 차단", isBlocked(nb({ priorAnnualInsurancePaid: "abc" }), 2_000_000));
  check("G-20: 정상 지급보험금은 그대로 반영", ins(nb({ annualCoverageLimit: 2_000_000, priorAnnualInsurancePaid: 1_500_000 })) === "500000",
    ins(nb({ annualCoverageLimit: 2_000_000, priorAnnualInsurancePaid: 1_500_000 })));
  // 다른 진입점은 이번 범위가 아니다.
  const room = (v: unknown) => wrap(() => calculateRoomCharge2026({ route: "room_charge", coverage: "non_benefit",
    cause: "disease", severity: "non_critical", stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }],
    priorAnnualInsurancePaid: 0, annualCoverageLimit: v } as never));
  // ⚠ **낡은 계약을 교체했다.** G-21 시점에는 상급병실료가 음수·소수를 통과시켜 그 사실을
  //   후속 과제 표지로 고정했다. G-22가 그 진입점의 두 금액 축을 전용 가드로 막았으므로,
  //   확인 대상을 "이제 두 진입점이 같은 방향으로 막는다"로 옮긴다.
  //   그 진입점의 새 계약은 tests/gen2026RoomChargeMoneyValue.test.ts가 본다.
  check("상급병실료: 음수도 이제 막힌다(G-22)", statusOf(room(-400_000)) === "PENDING_UNVERIFIED", shape(room(-400_000)));
  check("상급병실료: 소수 0.5도 이제 막힌다(G-22)", statusOf(room(0.5)) === "PENDING_UNVERIFIED", shape(room(0.5)));
  check("상급병실료: 문자열은 종전대로 막힌다", statusOf(room("400000")) === "PENDING_UNVERIFIED");
  check("상급병실료: 정상값·undefined·0은 그대로 계산된다",
    statusOf(room(400_000)) === "OK" && statusOf(room(0)) === "OK" && statusOf(room(undefined)) === "OK");
  const item = (v: unknown) => wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "injection", injectionPurpose: "general",
    lines: [{ amount: 1_000_000, visit: "outpatient", tier: "clinic" }], priorAnnualCoveredCount: 0,
    annualCoverageLimit: v } as never));
  // ⚠ **계약이 바뀌었다(G-30).** 종전에는 별도 보장종목이 이 축을 **조용히 폐기**해
  //   값과 무관하게 결과가 같았다(접근자 호출 0회). 이제는 값과 무관하게 **거부**한다 —
  //   (3) 별도 보장종목의 한도는 <표1>이 항목별로 따로 정하고 일반 가입금액을 쓰지 않는다.
  check("별도 보장종목: 이 축을 쓰지 않고 값과 무관하게 거부한다(G-30)",
    shape(item(400_000)) === shape(item("abc")) && shape(item(400_000)) === shape(item(0))
    && statusOf(item(400_000)) === "PENDING_UNVERIFIED", shape(item("abc")));
  check("별도 보장종목: 축을 싣지 않으면 종전대로 계산한다", statusOf(item(undefined)) === "OK");
  // HOLD는 그대로다.
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("지급 0원 HOLD 이중 실행·fingerprint 비교가 그대로",
    /const countedA = runBundle\(true\);\n\s*const countedB = runBundle\(false\);/.test(eng)
    && /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(eng));
  check("소진 판정식이 그대로", /const consumes = amount > 0 && \(countZeroPay \|\| \(single\.insurancePay \?\? 0\) > 0\);/.test(eng));
}

console.log("\n[G-21] 10. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("원문을 비급여일 때만 읽는다", /const limitRaw = readCount\(nb, "annualCoverageLimit"\);/.test(body));
  check("이 이름을 속성으로 읽는 곳이 그 한 줄뿐이다",
    (body.match(/readCount\([^,]+, "annualCoverageLimit"\)/g) ?? []).length === 1
    && !/nb\??\.annualCoverageLimit/.test(body) && !/input\.annualCoverageLimit/.test(body)
    && !/\["annualCoverageLimit"\]/.test(body),
    (body.match(/[^\n]*annualCoverageLimit[^\n]*/g) ?? []).join(" | ").slice(0, 130));
  check("읽기가 runBundle 밖이다", body.indexOf("const limitRaw =") < body.indexOf("function runBundle("));
  check("값 검증이 badCount를 쓴다", /if \(limitRaw !== undefined && badCount\(limitRaw\)\) \{/.test(body));
  check("기존 blocked()로 반환한다", /if \(limitRaw !== undefined && badCount\(limitRaw\)\) \{\n\s*return blocked\(\[/.test(body));
  check("안내가 지역 showValue를 쓴다", /받은 값: \$\{showValue\(limitRaw\)\}/.test(body));
  check("검증된 원값으로만 한도를 만든다",
    /const limit = limitRaw as number \| undefined;/.test(body)
    && /const annualLimit = limitState === "applied"\n\s*\? Math\.min\(limit as number, annualMax\)\n\s*: undefined;/.test(body));
  check("이 축에 Math.floor·nonNegInt를 쓰지 않는다",
    !/Math\.floor\([^)]*limit/i.test(body) && !/nonNegInt\([^)]*limit/i.test(body)
    && !/Number\.isFinite\([^)]*limit/i.test(body));
  check("상태를 세 갈래로 나눈다",
    /const limitState: "applied" \| "unset" \| "zero" =/.test(body)
    && /limit === undefined \? "unset" : limit === 0 \? "zero" : "applied";/.test(body));
  // ⚠ 계약 갱신(G-24): 통원 가입금액도 같은 방식으로 상태를 넘기게 되어 인자가 하나 늘었다.
  //   이 커밋(G-21)이 고정하려는 것은 **연간 가입금액의 상태가 input 재읽기가 아니라 인자로
  //   전달된다**는 사실이므로, 그 요지를 유지한 채 확인 대상을 새 시그니처로 옮긴다.
  // ⚠ 앵커 갱신(G-24 → G-32). G-32가 검증된 중증도를 인자로 넘기게 되어 인자가 하나 더
  //   늘었다. 이 커밋(G-21)이 고정하려는 것은 **연간 가입금액의 상태가 input 재읽기가
  //   아니라 인자로 전달된다**는 사실이므로, 그 요지를 유지한 채 새 시그니처로 옮긴다.
  check("buildNotes가 상태를 받는다",
    /function buildNotes\(\n\s*input: Gen2026MultiClaimInput,\n\s*limitState: "applied" \| "unset" \| "zero",/.test(body)
    && /notes: buildNotes\(input, limitState, outpatientLimitState, severity\),/.test(body));
  check("미입력·0원 안내가 각각 한 갈래에만 걸린다",
    /if \(limitState === "unset"\) \{/.test(body) && /if \(limitState === "zero"\) \{/.test(body));
  // 순서: … → G-20 지급보험금 → 연간 가입금액 → 계산
  const iPaid = body.indexOf('const paidRaw = readCount(nb, "priorAnnualInsurancePaid")');
  const iLimit = body.indexOf('const limitRaw = readCount(nb, "annualCoverageLimit")');
  const iRun = body.indexOf("function runBundle(");
  const iDeduct = body.indexOf('readCount(input, "priorAnnualDeductible")');
  check("검증 순서: 누적 공제금액 → 지급보험금 → 연간 가입금액 → 계산",
    iDeduct > 0 && iDeduct < iPaid && iPaid < iLimit && iLimit < iRun, `${iDeduct}/${iPaid}/${iLimit}/${iRun}`);
  // ⚠ **낡은 계약을 교체했다(G-30).** 위치·기존 의미("이 축이 관용 파서를 거치지 않는다")는
  //   그대로다. G-30이 마지막 사용처(누적 공제금액)를 단일 읽기로 옮기며 함수를 삭제했다.
  check("nonNegInt가 이 파일에서 사라졌다(G-30)", !/nonNegInt/.test(body));
  // 범위 밖 파일은 그대로다.
  const rc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  // ⚠ 계약 갱신(G-22): 그 함수도 검증된 원값만 받게 바뀌었다. 이 커밋이 손대지 않았다는
  //   요지는 같으므로 확인 대상을 새 모양으로 옮긴다.
  check("roomCharge2026의 annualLimitOf는 이 커밋이 손대지 않았다(G-22의 모양)",
    /if \(limit === undefined \|\| limit === 0\) return undefined;/.test(rc));
  const g21 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("4세대 엔진은 손대지 않았다", /const limitRaw = rider === "none" \? readCount\(input, "annualCoverageLimit"\) : undefined;/.test(g21));
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("UI 전달 형태는 그대로", (ui.match(/annualCoverageLimit: money\.annual,/g) ?? []).length === 3);
}

console.log(`\n[G-21 5세대 다회 연간 보험가입금액 축 값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
