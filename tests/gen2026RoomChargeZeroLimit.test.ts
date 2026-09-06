// G-25 — 상급병실료 차액의 연간 보험가입금액 **숫자 `0` 안내 분리**.
//   대상: `roomCharge2026.ts`의 `annualCoverageLimit`
//
// 종전 동작(기준선 a912a2b — 엔진 직접 호출과 공개 화면 양쪽에서 실측):
//   `annualLimitOf()`가 미입력(`undefined`)과 명시적 `0`을 **모두 `undefined`로 접는다.**
//   계산은 두 경우 모두 "한도 미적용"이라 같고, 그것이 이 계산기의 기존 정책이다.
//   그런데 `buildNotes()`는 **접힌 뒤의 값**만 보아 두 상태를 구분하지 못했다.
//     calculateRoomCharge2026({… annualCoverageLimit: 0})
//       → "연간 보험가입금액을 입력하지 않아 적용하지 않았습니다."
//   값을 넣은 사용자에게 "입력하지 않아"라고 말하는 것은 사실과 다르다.
//   공개 화면(5세대 다회 · 상급병실료 차액)에서도 같은 문장이 나왔다.
//
// 이 커밋이 하는 것: 판정을 세 상태(applied / unset / zero)로 나누고, `zero`에 미입력과
//   분리된 전용 안내를 붙인다. 문구는 일반 다회(G-21, multiClaim2026.ts)의 같은 축 안내와
//   한 글자도 다르지 않다.
//
// ⚠ 이 커밋이 **하지 않는 것**:
//   계산 변경(미입력·`0` 모두 종전대로 미적용), `annualLimitOf()`의 산식, 상한 절삭,
//   정상값·상한 초과값 처리, `nonNegSafeInt` 형식 검증과 허용 범위, 검증 순서와 안내
//   우선순위, 미입력 안내 문구, 반환 객체, 지급보험금 축, 진료비 축,
//   GEN2026-ROOM-CHARGE-DEDUCTIBLE-POOL을 비롯한 모든 HOLD.
//   접근자 읽기 횟수도 그대로다 — 상태는 **이미 읽어 검증한 값**에서 만든다.
//
// ⚠ `0`을 미적용으로 보는 것은 **이 계산기의 정책**이고 종전 그대로다. 0원 가입이 약관상
//   유효한 계약인지·무효인지, 실제 계약 한도가 0원인지, 0원이 미입력과 법적으로 같은지는
//   원문에서 확인하지 않았고 화면·주석·안내 어디서도 단정하지 않는다.
import { readFileSync } from "node:fs";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
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
const notes = (x: Caught) => threw(x) ? "" : ((x.r.notes as string[] | undefined) ?? []).join(" ¶ ");
const noteList = (x: Caught) => threw(x) ? [] : ((x.r.notes as string[] | undefined) ?? []);
/** 계산만 본다 — 안내는 뺀다. 이 커밋이 바꾸는 것은 안내뿐이기 때문이다. */
const calcShape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.route}/${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/caps=${((x.r.appliedCaps as string[] | undefined) ?? []).join("+")}`
    + `/lines=${JSON.stringify(x.r.lines)}`;
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0;

const UNSET_NOTE = "연간 보험가입금액을 입력하지 않아 적용하지 않았습니다. 증권에서 확인한 값을 입력하면 지급 한도로 반영됩니다.";
const ZERO_NOTE = "연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.";
const MAXNC = GEN2026.nonBenefit.nonCritical.annualLimitMax;
const MAXC = GEN2026.nonBenefit.critical.annualLimitMax;

const RC = (extra: Record<string, unknown> = {}) => ({
  route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
  stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }], ...extra,
});
const rc = (extra: Record<string, unknown> = {}) => wrap(() => calculateRoomCharge2026(RC(extra) as never));
/** `annualCoverageLimit` 키 자체를 싣지 않은 호출(= 진짜 미제공). */
const rcNoKey = (extra: Record<string, unknown> = {}) => wrap(() => calculateRoomCharge2026(RC(extra) as never));

console.log("\n[G-25] 1. 미제공과 숫자 0 — 계산은 같고 안내만 다르다");
{
  const base = rcNoKey();
  const zero = rc({ annualCoverageLimit: 0 });
  const undef = rc({ annualCoverageLimit: undefined });
  check("미제공: 계산 그대로(한도 미적용, ins 1,000,000)", calcShape(base).includes("ins=1000000"), calcShape(base));
  check("숫자 0: 계산이 미제공과 **완전히 같다**", calcShape(zero) === calcShape(base), calcShape(zero));
  check("명시적 undefined: 계산도 안내도 미제공과 같다",
    calcShape(undef) === calcShape(base) && notes(undef) === notes(base));
  check("미제공 안내: 종전 미입력 문구 그대로", noteList(base).includes(UNSET_NOTE), notes(base).slice(-140));
  check("미제공 안내: 0원 문구는 붙지 않는다", !notes(base).includes("0원으로 입력하셔서"));
  check("숫자 0 안내: 0원 전용 문구가 붙는다", noteList(zero).includes(ZERO_NOTE), notes(zero).slice(-160));
  check("숫자 0 안내: 미입력 문구는 붙지 않는다", !notes(zero).includes("입력하지 않아 적용하지 않았습니다"));
  check("두 안내는 서로 배타적이다(둘 다 붙는 일이 없다)",
    noteList(zero).filter((n) => n === UNSET_NOTE || n === ZERO_NOTE).length === 1
    && noteList(base).filter((n) => n === UNSET_NOTE || n === ZERO_NOTE).length === 1);
  check("안내 개수는 그대로다(한 줄을 바꿔 달았을 뿐)",
    noteList(zero).length === noteList(base).length, `${noteList(zero).length} / ${noteList(base).length}`);
  check("나머지 안내 7줄은 순서까지 동일하다",
    JSON.stringify(noteList(zero).slice(0, -1)) === JSON.stringify(noteList(base).slice(0, -1)));
  // 종전에는 이 문장이 0원에도 나갔다. 다시 나가면 안 된다.
  check("종전 결함 재발 방지: 0원에 '입력하지 않아'가 다시 나가지 않는다",
    !noteList(zero).includes(UNSET_NOTE));
  // `-0`은 `=== 0`이 참이고 `Number.isSafeInteger(-0)`도 참이다. 종전과 같은 자리로 간다.
  check("-0은 종전대로 0과 같게 다뤄진다(계산·안내 모두)",
    calcShape(rc({ annualCoverageLimit: -0 })) === calcShape(zero)
    && notes(rc({ annualCoverageLimit: -0 })) === notes(zero));
}

console.log("\n[G-25] 2. 정상값·경계·상한 초과 — 계산도 안내도 무회귀");
{
  const base = rcNoKey();
  const grid: [string, number, string][] = [
    ["1원", 1, "ins=1"],
    ["400,000", 400_000, "ins=400000"],
    ["999,999", 999_999, "ins=999999"],
    ["1,000,000(딱 지급액)", 1_000_000, "ins=1000000"],
    ["1,000,001", 1_000_001, "ins=1000000"],
    ["상한 10,000,000", MAXNC, "ins=1000000"],
    ["상한+1", MAXNC + 1, "ins=1000000"],
    ["MAX_SAFE", Number.MAX_SAFE_INTEGER, "ins=1000000"],
  ];
  for (const [label, v, want] of grid) {
    const x = rc({ annualCoverageLimit: v });
    check(`양의 정수 ${label}: 계산 그대로(${want})`, calcShape(x).includes(want), calcShape(x));
    check(`양의 정수 ${label}: 0원·미입력 안내가 모두 붙지 않는다`,
      !notes(x).includes(UNSET_NOTE) && !notes(x).includes(ZERO_NOTE));
    check(`양의 정수 ${label}: 나머지 안내 7줄이 그대로`,
      JSON.stringify(noteList(x)) === JSON.stringify(noteList(base).slice(0, -1)));
  }
  // 상한 절삭은 제5조①에 근거가 있는 정당한 계산이다. 종전 그대로여야 한다.
  const over = wrap(() => calculateRoomCharge2026(RC({
    stays: [{ roomChargeTotal: 200_000_000, inpatientDays: 1000 }], annualCoverageLimit: 90_000_000,
  }) as never));
  check("비중증 상한 1천만으로 절삭(종전 그대로)", calcShape(over).includes(`ins=${MAXNC}`), calcShape(over));
  const overC = wrap(() => calculateRoomCharge2026(RC({
    severity: "critical", stays: [{ roomChargeTotal: 200_000_000, inpatientDays: 1000 }],
    annualCoverageLimit: 90_000_000,
  }) as never));
  check("중증 상한 5천만으로 절삭(종전 그대로)", calcShape(overC).includes(`ins=${MAXC}`), calcShape(overC));
}

console.log("\n[G-25] 3. 무효 입력 차단 계약 — 한 글자도 바뀌지 않는다");
{
  const circ: Record<string, unknown> = {}; circ.self = circ;
  const BAD: [string, unknown][] = [
    ["음수 -1", -1], ["음수 -400000", -400_000], ["소수 0.5", 0.5], ["소수 400000.9", 400_000.9],
    ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
    ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1],
    ["문자열 '0'", "0"], ["문자열 '400000'", "400000"], ["빈 문자열", ""],
    ["null", null], ["true", true], ["false", false], ["객체", {}], ["배열", []], ["배열 [0]", [0]],
    ["bigint 0n", 0n], ["Symbol", Symbol("x")], ["Date", new Date(0)],
    ["Number 래퍼", new Number(400_000)], ["순환 참조", circ],
  ];
  for (const [label, v] of BAD) {
    const x = rc({ annualCoverageLimit: v });
    check(`무효 ${label}: 종전대로 거부(route rejected · totalAmount 0)`, isRejected(x), JSON.stringify(x).slice(0, 110));
    check(`무효 ${label}: 거부 안내에 0원 문구가 섞이지 않는다`,
      !notes(x).includes("0원으로 입력하셔서") && !notes(x).includes(UNSET_NOTE));
  }
  check("거부 안내 문구가 종전 그대로",
    noteList(rc({ annualCoverageLimit: -1 }))[0]?.startsWith("연간 보험가입금액(annualCoverageLimit) 값이 올바르지 않아"),
    noteList(rc({ annualCoverageLimit: -1 }))[0]);
}

console.log("\n[G-25] 4. 안내 우선순위 — 선행 preflight가 그대로 앞선다");
{
  const first = (x: Caught) => noteList(x)[0] ?? "";
  const cases: [string, Record<string, unknown>, string][] = [
    ["가입금액만 무효", { annualCoverageLimit: -1 }, "연간 보험가입금액(annualCoverageLimit)"],
    ["+ 지급보험금 무효", { annualCoverageLimit: -1, priorAnnualInsurancePaid: -1 }, "기존 지급보험금(priorAnnualInsurancePaid)"],
    ["+ 진료비 무효", { annualCoverageLimit: -1, stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] }, "1번째 입원의 상급병실료 차액(roomChargeTotal)"],
    ["+ 입원일수 무효", { annualCoverageLimit: -1, stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 0 }] }, "1번째 입원의 총 입원일수(inpatientDays)"],
    ["+ 원인 무효", { annualCoverageLimit: -1, cause: "x" }, "원인(cause)"],
    ["+ 질환 구분 무효", { annualCoverageLimit: -1, severity: "x" }, "질환 구분(severity)"],
    ["+ 급여 구분 무효", { annualCoverageLimit: -1, coverage: "benefit" }, "급여 구분(coverage)"],
    ["+ 미사용 축 stray", { annualCoverageLimit: -1, outpatientCoverageLimit: 200_000 }, "쓰이지 않는 입력(outpatientCoverageLimit)"],
    ["+ stays 아님", { annualCoverageLimit: -1, stays: null }, "입원 목록(stays)"],
  ];
  for (const [label, over, want] of cases) {
    check(`우선순위 ${label} → "${want}"`, first(rc(over)).includes(want), first(rc(over)).slice(0, 90));
  }
  // 숫자 `0`은 유효값이므로 선행 차단이 있으면 안내가 나오지 않는다.
  check("0원이어도 선행 차단이 이기면 0원 안내가 나오지 않는다",
    !notes(rc({ annualCoverageLimit: 0, stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] })).includes(ZERO_NOTE));
}

console.log("\n[G-25] 5. 접근자 — 읽기 횟수와 예외가 종전 그대로");
{
  const withGetter = (over: Record<string, unknown>, get: () => unknown) => {
    let n = 0;
    const o = { ...RC(over) } as Record<string, unknown>;
    Object.defineProperty(o, "annualCoverageLimit", {
      enumerable: true, configurable: true, get() { n++; return get(); },
    });
    const x = wrap(() => calculateRoomCharge2026(o as never));
    return { n, x };
  };
  const ok = withGetter({}, () => 0);
  check("정상 경로: 접근자를 **1회만** 읽는다", ok.n === 1, String(ok.n));
  check("정상 경로: 한 번 읽은 값으로 0원 안내가 붙는다", noteList(ok.x).includes(ZERO_NOTE));
  const okApplied = withGetter({}, () => 400_000);
  check("정상 경로(양의 정수): 읽기 1회 · 계산 반영", okApplied.n === 1 && calcShape(okApplied.x).includes("ins=400000"),
    `${okApplied.n} / ${calcShape(okApplied.x)}`);
  for (const [label, over] of [
    ["진료비 무효", { stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] }],
    ["입원일수 무효", { stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 0 }] }],
    ["원인 무효", { cause: "x" }],
    ["미사용 축 stray", { outpatientCoverageLimit: 200_000 }],
    ["지급보험금 무효", { priorAnnualInsurancePaid: -1 }],
  ] as [string, Record<string, unknown>][]) {
    const g = withGetter(over, () => 0);
    check(`선행 차단(${label}): 접근자를 **0회** 읽는다`, g.n === 0, String(g.n));
    check(`선행 차단(${label}): 새 런타임 예외가 없다`, !threw(g.x));
  }
  // 값이 달라지는 getter — 한 번만 읽으므로 계산과 안내가 같은 값에서 나온다.
  {
    let i = 0; const seq = [0, 400_000, 999];
    const o = { ...RC() } as Record<string, unknown>;
    Object.defineProperty(o, "annualCoverageLimit", {
      enumerable: true, configurable: true, get() { return seq[Math.min(i++, seq.length - 1)]; },
    });
    const x = wrap(() => calculateRoomCharge2026(o as never));
    check("변하는 getter: 첫 값 하나만 계산·안내에 함께 쓰인다",
      i === 1 && calcShape(x).includes("ins=1000000") && noteList(x).includes(ZERO_NOTE), `reads=${i}`);
  }
  // 던지는 getter — 종전 계약 그대로다(정상 경로에서는 전파, 선행 차단에서는 예외 없음).
  {
    const t = withGetter({}, () => { throw new Error("boom"); });
    check("던지는 getter(정상 경로): 종전대로 예외가 전파된다", threw(t.x) && t.n === 1);
    const t2 = withGetter({ stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] }, () => { throw new Error("boom"); });
    check("던지는 getter(선행 차단): 종전대로 예외 없이 안내로 끝난다", !threw(t2.x) && t2.n === 0);
  }
}

console.log("\n[G-25] 6. 다른 축·다른 경로 무회귀");
{
  const base = rcNoKey();
  // 지급보험금 축 — 값 검증도 계산도 그대로다.
  check("지급보험금 undefined = 미전달", calcShape(rc({ priorAnnualInsurancePaid: undefined })) === calcShape(base));
  check("지급보험금 0 = 미전달", calcShape(rc({ priorAnnualInsurancePaid: 0 })) === calcShape(base));
  check("지급보험금 0에는 0원 안내가 붙지 않는다(이 커밋의 대상 축이 아니다)",
    !notes(rc({ priorAnnualInsurancePaid: 0 })).includes("0원으로 입력하셔서"));
  check("지급보험금 누적이 한도를 깎는 계산 그대로",
    calcShape(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 400_000 })).includes("ins=600000"));
  check("지급보험금 무효는 종전대로 거부", isRejected(rc({ priorAnnualInsurancePaid: -1 })));
  // 진료비 축 — 계약이 다르다(0이 유효한 청구 행). 건드리지 않았다.
  check("진료비 0원 행은 종전대로 계산된다", calcShape(rc({ stays: [{ roomChargeTotal: 0, inpatientDays: 1 }] })).includes("ins=0"));
  check("진료비 소수는 종전대로 통과한다(normalizeAmount 계약)",
    !isRejected(rc({ stays: [{ roomChargeTotal: 400_000.9, inpatientDays: 10 }] })));
  check("진료비 음수는 종전대로 거부", isRejected(rc({ stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] })));
  // 진입점 경유도 같다.
  const viaItem = (extra: Record<string, unknown>) => wrap(() => calculateGen2026Item(RC(extra) as never));
  check("진입점(calculateGen2026Item) 경유: 0원 안내가 같다",
    notes(viaItem({ annualCoverageLimit: 0 })) === notes(rc({ annualCoverageLimit: 0 })));
  check("진입점 경유: 미제공 안내가 같다", notes(viaItem({})) === notes(base));
  // 범위 밖 경로 — 일반 다회(G-21)와 별도 보장종목은 그대로다.
  const many = (extra: Record<string, unknown>) => wrap(() => calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "non_critical",
    nonBenefitItem: "general", amounts: [300_000, 300_000], priorAnnualOutpatientDays: 0, ...extra,
  } as never));
  check("일반 다회 0원 안내가 그대로(G-21)",
    notes(many({ annualCoverageLimit: 0 })).includes(ZERO_NOTE));
  check("일반 다회 미입력 안내가 그대로(G-21)",
    notes(many({})).includes("연간 보험가입금액도 계약자가 선택한 값이라 입력하지 않으면 적용하지 않습니다"));
  check("일반 다회 계산이 0원·미입력에서 동일(그대로)",
    calcShape(many({ annualCoverageLimit: 0 })) === calcShape(many({})));
  const item = wrap(() => calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "general", lines: [{ amount: 1_000_000, visit: "outpatient" }],
    priorAnnualCoveredCount: 0,
  } as never));
  check("별도 보장종목은 연간 가입금액 축을 쓰지 않는다(그대로)",
    !notes(item).includes("연간 보험가입금액을"));
}

console.log("\n[G-25] 7. 안내 생성 위치와 분기 구조");
{
  const src = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("세 상태 타입이 있다", /type AnnualLimitState = "applied" \| "unset" \| "zero";/.test(code));
  check("상태는 **검증된 값**(checked.limit)에서 만든다 — 입력을 다시 읽지 않는다",
    /checked\.limit === undefined \? "unset" : checked\.limit === 0 \? "zero" : "applied"/.test(code));
  check("입력에서 annualCoverageLimit을 읽는 자리는 검증 한 곳뿐이다",
    (code.match(/\.annualCoverageLimit/g) ?? []).length === 1, String((code.match(/\.annualCoverageLimit/g) ?? []).length));
  check("buildNotes는 접힌 한도가 아니라 상태를 받는다",
    /function buildNotes\(input: Gen2026RoomChargeInput, limitState: AnnualLimitState\)/.test(code)
    && !/buildNotes\(input, annualLimit\)/.test(code));
  check("두 안내가 각각의 상태에서만 나온다",
    /if \(limitState === "unset"\)/.test(code) && /if \(limitState === "zero"\)/.test(code));
  check("annualLimitOf의 계산은 그대로다(미입력·0 모두 미적용)",
    /if \(limit === undefined \|\| limit === 0\) return undefined;/.test(code));
  check("상한 절삭이 그대로다", /return Math\.min\(limit, max\);/.test(code));
  check("형식 검증 가드가 그대로다",
    /typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0/.test(code));
  check("0원 안내 문구가 일반 다회(G-21)와 같다", src.includes(ZERO_NOTE));
  check("미입력 안내 문구가 그대로", src.includes(UNSET_NOTE));
  // 약관상 의미를 단정하지 않는다.
  for (const banned of ["0원 가입은 무효", "0원 가입도 유효", "약관상 0원", "실제 한도가 0원",
    "0원은 미입력과 같", "0원은 법적으로", "약관상 유효한 값"]) {
    check(`약관상 의미 단정 "${banned}" 없음`, !src.includes(banned));
  }
  // HOLD는 손대지 않았다.
  check("500만원 pool HOLD가 그대로(deductibleApplied 없음)", !/deductibleApplied/.test(code));
  check("500만원 pool 안내가 그대로",
    src.includes("공제금액 상한 500만 원(특별약관1 제5조 제5항)은 상급병실료 차액에 적용한다는 명시적 근거를 찾지 못해 반영하지 않았습니다."));
}

console.log(`\n[G-25 상급병실료 연간 가입금액 0원 안내 분리] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
