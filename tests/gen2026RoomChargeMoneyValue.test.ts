// G-22 — 상급병실료 차액 진입점의 **두 금액 축** 값 검증.
//   대상: `roomCharge2026.ts`의 `priorAnnualInsurancePaid`·`annualCoverageLimit`
//
// 종전 동작(기준선 e0b3db9 엔진 직접 호출로 실측, UI 미경유):
//   두 축이 공용 `isNum()`(= `typeof v === "number" && Number.isFinite(v)`)만 통과하면 됐다.
//   그래서 **음수와 소수가 통과한 뒤 하류에서 조용히 다른 값이 됐다.**
//     - 기존 지급보험금 `-400,000` → `nonNegInt`가 **0**으로 만들어 누적이 사라졌다.
//       실측(한도 1,000,000·차액 2,000,000·10일): 정답 `400,000`이면 ins 600,000인데 ins 1,000,000.
//     - 연간 가입금액 `0.5` → `annualLimitOf`의 `Math.floor`가 **한도 0원**을 만들어 적용해
//       ins **0**이 됐다. 같은 격자에서 명시적 `0`은 미적용이라 ins 1,000,000이다.
//     - 연간 가입금액 `400,000.9` → 내림 400,000으로 조용히 바뀌었다.
//     - `MAX_SAFE + 1`은 두 축 모두 검증 없이 통과했다.
//   ⚠ 두 축 모두 **런타임 예외를 내지 않았다.** 문제는 예외가 아니라 조용히 틀린 금액이다.
//   ⚠ 같은 이름을 **3회** 읽었다(존재 검사 + 가드 인자 + 본체). 외부 객체의 접근자가 여러 번
//     실행되면 값이 실행 사이에 달라질 수 있다.
//
// ⚠ **공용 `isNum()`은 강화하지 않았다.** 나머지 호출부는 계약이 다르다 —
//   이 파일의 진료비 `roomChargeTotal`과 `specialItem2026`의 `line.amount`는 `undefined`를
//   거부하고 `0`이 유효한 청구 행이며 하류 `normalizeAmount`의 계약을 따른다. 한 가드가
//   "유한한 숫자"와 "0 이상의 안전한 정수"를 동시에 뜻하면 어느 축을 고칠 때 다른 축이 함께
//   움직인다. 그래서 이 파일 안에 전용 가드 `nonNegSafeInt`를 두고 **두 축만** 바꿨다.
//
// ⚠ 이번 커밋이 하지 않는 것: `undefined`·숫자 `0`·한도 초과 과거 지급액·상한 절삭의 계약 변경,
//   안내 문구 변경, 진료비 두 축 변경, `specialItem2026`·`multiClaim2026` 변경,
//   HOLD의 값·상태·계산 동작 변경, 0원 전용 안내 신설(다회 엔진에만 있다 — 후속 항목).
import { readFileSync } from "node:fs";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
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
const notes = (x: Caught) => threw(x) ? "" : ((x.r.notes as string[] | undefined) ?? []).join(" ¶ ");
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : `${x.r.route}/${x.r.status}/amt=${x.r.totalAmount}/own=${x.r.totalOwnPay}/ins=${x.r.totalInsurancePay}`
    + `/lines=${(x.r.lines as unknown[]).length}`;
/** 이 진입점의 거부 계약 — `rejected()`는 총액을 만들지 않는다(0). */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const circ: Record<string, unknown> = {}; circ.self = circ;
const MAXNC = GEN2026.nonBenefit.nonCritical.annualLimitMax;
const MAXC = GEN2026.nonBenefit.critical.annualLimitMax;

/** 비중증·차액 2,000,000·10일 → 지급 전 1,000,000(1일 평균 10만원 한도가 구속). */
const RC = (extra: Record<string, unknown> = {}) => ({
  route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical",
  stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 10 }], ...extra,
});
const rc = (extra: Record<string, unknown> = {}) => wrap(() => calculateRoomCharge2026(RC(extra) as never));

/** 두 금액 축이 함께 거부해야 하는 값. */
const BAD: [string, unknown][] = [
  ["음수", -400_000], ["음수 -1", -1], ["소수 0.5", 0.5], ["소수 400000.9", 400_000.9],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["문자열 숫자", "400000"], ["빈 문자열", ""], ["null", null],
  ["true", true], ["false", false], ["{}", {}], ["[400000]", [400_000]],
  ["bigint", 400_000n], ["Symbol", Symbol("s")], ["순환 참조", circ],
  ["MAX_SAFE+1", Number.MAX_SAFE_INTEGER + 1],
];
const AXES: [string, string][] = [
  ["기존 지급보험금", "priorAnnualInsurancePaid"],
  ["연간 가입금액", "annualCoverageLimit"],
];

console.log("\n[G-22] 1. 정상 입력 무회귀");
{
  check("기준(두 축 미전달) → ins 1,000,000", ins(rc()) === "1000000", ins(rc()));
  check("지급보험금 400,000 → ins 600,000",
    ins(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 400_000 })) === "600000",
    ins(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 400_000 })));
  check("가입금액 400,000 → ins 400,000", ins(rc({ annualCoverageLimit: 400_000 })) === "400000");
  check("가입금액 1,000,001 → 한도가 구속하지 않는다",
    (rc({ annualCoverageLimit: 1_000_001 }) as { r: Res }).r.appliedCaps !== undefined
    && ((rc({ annualCoverageLimit: 1_000_001 }) as { r: Res }).r.appliedCaps as string[]).length === 0);
  check("두 축 조합(한도 1,000,000·기존 700,000) → ins 300,000",
    ins(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 700_000 })) === "300000");
  check("진료비·일수 계약은 그대로", ins(wrap(() => calculateRoomCharge2026({
    ...RC(), stays: [{ roomChargeTotal: 400_000, inpatientDays: 10 }] } as never))) === "200000");
}

console.log("\n[G-22] 2. undefined·숫자 0의 축별 기존 계약");
{
  const base = rc();
  check("지급보험금 undefined → 미전달과 같다", shape(rc({ priorAnnualInsurancePaid: undefined })) === shape(base));
  check("지급보험금 0 → 미전달과 같다", shape(rc({ priorAnnualInsurancePaid: 0 })) === shape(base));
  check("가입금액 undefined → 미적용 + 기존 안내",
    ins(rc()) === "1000000" && notes(base).includes("연간 보험가입금액을 입력하지 않아 적용하지 않았습니다"));
  check("가입금액 0 → 종전대로 미적용(계산 동일)",
    shape(rc({ annualCoverageLimit: 0 })) === shape(base), shape(rc({ annualCoverageLimit: 0 })));
  // ⚠ **낡은 계약을 교체했다(G-25).** G-22 시점에는 0원 전용 안내가 이 진입점에 없었고
  //   (다회 엔진에만 있었다), G-22가 신설하지 않았음을 고정했다. G-25가 신설했으므로
  //   이제 **계산은 미제공과 같고 안내만 다르다**를 고정한다. 계산 동일성은 위 줄이 본다.
  check("가입금액 0의 안내는 미제공과 다르다(G-25가 0원 전용 안내를 신설)",
    notes(rc({ annualCoverageLimit: 0 })) !== notes(base)
    && notes(rc({ annualCoverageLimit: 0 })).includes("연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다.")
    && !notes(rc({ annualCoverageLimit: 0 })).includes("입력하지 않아 적용하지 않았습니다"));
}

console.log("\n[G-22] 3. 한도 경계·한도 초과값");
{
  check("가입금액 상한과 같음 → 통과", statusOf(rc({ annualCoverageLimit: MAXNC })) !== "PENDING_UNVERIFIED");
  check("가입금액 상한 초과 → 기존 절삭 유지(비중증 1천만)",
    ins(wrap(() => calculateRoomCharge2026({ ...RC(), stays: [{ roomChargeTotal: 200_000_000, inpatientDays: 1000 }],
      annualCoverageLimit: 90_000_000 } as never))) === "10000000");
  check("중증 상한 초과 → 5천만으로 절삭",
    ins(wrap(() => calculateRoomCharge2026({ ...RC(), severity: "critical",
      stays: [{ roomChargeTotal: 200_000_000, inpatientDays: 1000 }], annualCoverageLimit: 90_000_000 } as never))) === "50000000");
  check("가입금액 MAX_SAFE → 거부하지 않고 절삭", ins(rc({ annualCoverageLimit: Number.MAX_SAFE_INTEGER })) === "1000000");
  check("지급보험금이 한도를 넘어도 유효(절삭하지 않는다)",
    ins(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 5_000_000 })) === "0");
  check("지급보험금 MAX_SAFE → 허용", ins(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: Number.MAX_SAFE_INTEGER })) === "0");
  check("상한 상수가 그대로", MAXC === 50_000_000 && MAXNC === 10_000_000);
}

console.log("\n[G-22] 4. 음수·소수·비숫자 차단 · MAX_SAFE 허용·MAX_SAFE+1 차단");
{
  for (const [axisLabel, key] of AXES) {
    for (const [label, v] of BAD) {
      const x = rc({ [key]: v });
      check(`${axisLabel} + ${label} → 예외 없이 rejected`, isRejected(x), shape(x));
      check(`${axisLabel} + ${label} → 기존 안내 문구 그대로`,
        notes(x).startsWith(key === "priorAnnualInsurancePaid"
          ? "기존 지급보험금(priorAnnualInsurancePaid) 값이 올바르지 않아 계산하지 않았습니다."
          : "연간 보험가입금액(annualCoverageLimit) 값이 올바르지 않아 계산하지 않았습니다."),
        notes(x).slice(0, 50));
      check(`${axisLabel} + ${label} → 받은 값 줄이 있다`, /받은 값: /.test(notes(x)));
    }
    check(`${axisLabel}: MAX_SAFE 허용 · MAX_SAFE+1 차단`,
      !isRejected(rc({ [key]: Number.MAX_SAFE_INTEGER }))
      && isRejected(rc({ [key]: Number.MAX_SAFE_INTEGER + 1 })));
  }
  // 종전에 결과를 바꾸던 두 사례를 직접 못박는다.
  check("음수 지급보험금이 더 이상 0으로 뭉개지지 않는다(종전 ins 1,000,000)",
    isRejected(rc({ annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: -400_000 })));
  check("가입금액 0.5가 더 이상 한도 0원으로 적용되지 않는다(종전 ins 0)",
    isRejected(rc({ annualCoverageLimit: 0.5 })));
  check("가입금액 400,000.9가 더 이상 내려가지 않는다(종전 400,000으로 내림)",
    isRejected(rc({ annualCoverageLimit: 400_000.9 })));
  check("명시적 0과 소수 0.5의 결과가 이제 명확히 갈린다",
    statusOf(rc({ annualCoverageLimit: 0 })) !== "PENDING_UNVERIFIED" && isRejected(rc({ annualCoverageLimit: 0.5 })));
}

console.log("\n[G-22] 5. bigint·Symbol·순환 참조에서 예외 없는 안전 표시");
{
  for (const [axisLabel, key] of AXES) {
    for (const [label, v] of [["bigint", 400_000n], ["Symbol", Symbol("s")], ["순환 참조", circ]] as [string, unknown][]) {
      const x = rc({ [key]: v });
      check(`${axisLabel} + ${label} → 예외 없음`, !threw(x), shape(x));
      check(`${axisLabel} + ${label} → 안내를 끝까지 만든다`, /받은 값: /.test(notes(x)));
    }
    check(`${axisLabel}: bigint 표시가 직렬화 예외로 끊기지 않는다`,
      /받은 값: 400000$/.test(notes(rc({ [key]: 400_000n }))), notes(rc({ [key]: 400_000n })).slice(-25));
  }
}

console.log("\n[G-22] 6. 읽는 계약 — 결과가 아니라 접근자 호출 횟수로 본다");
{
  const probe = (key: string, ret: unknown, base: Record<string, unknown> = RC()) => {
    let reads = 0; const o = { ...base };
    Object.defineProperty(o, key, { get() { reads++; return ret; }, enumerable: true, configurable: true });
    // ⚠ 엔진을 먼저 부르고 나서 reads를 읽는다.
    const x = wrap(() => calculateRoomCharge2026(o as never));
    return { reads, x };
  };
  for (const [axisLabel, key] of AXES) {
    const ok = probe(key, 400_000);
    check(`${axisLabel}: 활성 축을 정확히 1회 읽는다`, ok.reads === 1, `reads=${ok.reads}`);
    check(`${axisLabel}: 읽은 값이 실제로 계산에 반영된다`, statusOf(ok.x) === "OK");
    const bad = probe(key, -1);
    check(`${axisLabel}: 무효값도 1회 읽고 거부한다`, bad.reads === 1 && isRejected(bad.x), `reads=${bad.reads}`);
  }
  // 미사용 축은 거부 안내에 값을 실어야 하므로 읽는 것 자체가 계약이다 — 계산에는 쓰이지 않는다.
  const unused = probe("priorAnnualInpatientDeductible", 1);
  check("미사용 축은 거부된다", isRejected(unused.x), shape(unused.x));
  check("미사용 축 거부 안내가 그 이름을 말한다",
    notes(unused.x).includes("쓰이지 않는 입력(priorAnnualInpatientDeductible)"), notes(unused.x).slice(0, 50));
  // 던지는 접근자: 활성 축에서는 읽으므로 예외가 나지만, 그것은 호출자 객체의 문제다.
  //   여기서 고정하는 것은 **읽는 횟수가 1회로 줄었다**는 사실이다.
  let boom = 0;
  const o = { ...RC() };
  Object.defineProperty(o, "priorAnnualInsurancePaid", { get() { boom++; throw new Error("touched"); }, enumerable: true, configurable: true });
  wrap(() => calculateRoomCharge2026(o as never));
  check("던지는 접근자도 1회만 실행된다(종전 3회 시도)", boom === 1, `reads=${boom}`);
}

console.log("\n[G-22] 7. 거부 반환 객체·첫 안내·계산 합계 계약");
{
  const x = rc({ priorAnnualInsurancePaid: -1 });
  check("route가 rejected다", routeOf(x) === "rejected");
  check("총액 세 축이 rejected 계약대로다",
    !threw(x) && x.r.totalAmount === 0 && x.r.totalOwnPay === null && x.r.totalInsurancePay === null);
  check("lines·appliedCaps가 비어 있다",
    !threw(x) && (x.r.lines as unknown[]).length === 0 && (x.r.appliedCaps as unknown[]).length === 0);
  check("안내가 두 줄이다(rejected 계약)", !threw(x) && ((x.r.notes as string[]).length === 2));
  // 앞선 검증이 가려지지 않는다.
  const badRoute = wrap(() => calculateRoomCharge2026({ ...RC(), route: "x", priorAnnualInsurancePaid: -1 } as never));
  check("경로 검사가 먼저", notes(badRoute).includes("경로(route)"));
  const badStay = wrap(() => calculateRoomCharge2026({ ...RC(),
    stays: [{ roomChargeTotal: -1, inpatientDays: 10 }], priorAnnualInsurancePaid: -1 } as never));
  check("진료비 검사가 먼저", notes(badStay).includes("상급병실료 차액(roomChargeTotal)"));
  const badDays = wrap(() => calculateRoomCharge2026({ ...RC(),
    stays: [{ roomChargeTotal: 2_000_000, inpatientDays: 0 }], priorAnnualInsurancePaid: -1 } as never));
  check("일수 검사가 먼저", notes(badDays).includes("총 입원일수(inpatientDays)"));
  check("지급보험금이 가입금액보다 먼저",
    notes(rc({ priorAnnualInsurancePaid: -1, annualCoverageLimit: -1 })).includes("기존 지급보험금"));
}

console.log("\n[G-22] 8. 다른 진입점·다른 축·HOLD 무회귀");
{
  // ⚠ **낡은 계약 2건을 교체했다(G-26).** G-22 시점에는 진료비 축이 공용 `isNum()`(= 유한한
  //   숫자)만 통과하면 됐고, 이 파일은 "음수는 통과하고 소수는 내림된다"를 **후속 과제로
  //   남겨 둔 상태**로 고정했다. G-26이 세 진료비 축을 모두 0 이상의 안전한 정수로 닫았다.
  //   이 파일의 요지(상급병실료의 **두 금액 축**은 진료비와 다른 계약이다)는 그대로다.
  const negAmount = wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "injection", injectionPurpose: "general",
    lines: [{ amount: -400_000, visit: "outpatient", tier: "clinic" }], priorAnnualCoveredCount: 0 } as never));
  check("별도 보장종목: 음수 진료비가 이제 막힌다(G-26)", isRejected(negAmount), shape(negAmount));
  const fracAmount = wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "injection", injectionPurpose: "general",
    lines: [{ amount: 400_000.9, visit: "outpatient", tier: "clinic" }], priorAnnualCoveredCount: 0 } as never));
  check("별도 보장종목: 소수 진료비가 이제 막힌다(G-26 — 내림하지 않는다)", isRejected(fracAmount));
  // ⚠ **낡은 계약을 교체했다.** G-22 시점에는 별도 보장종목의 지급보험금이 아직 관용을 써서
  //   음수가 통과했다. G-23이 그 축을 닫았으므로 확인 대상을 새 계약으로 옮긴다.
  //   이 파일의 요지(상급병실료 진료비 두 축은 그대로다)는 아래 두 검사가 계속 고정한다.
  const negPaidItem = wrap(() => calculateGen2026Item({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "injection", injectionPurpose: "general",
    lines: [{ amount: 1_000_000, visit: "outpatient", tier: "clinic" }], priorAnnualCoveredCount: 0,
    priorAnnualInsurancePaid: -400_000 } as never));
  check("별도 보장종목: 음수 지급보험금도 이제 막힌다(G-23)", isRejected(negPaidItem), shape(negPaidItem));
  // 이 파일의 진료비 축도 그대로다.
  // ⚠ **낡은 계약을 교체했다(G-26).** 종전에는 소수가 통과해 `normalizeAmount`가 내림했다.
  check("상급병실료 진료비: 소수가 이제 막힌다(G-26 — 내림하지 않는다)",
    isRejected(wrap(() => calculateRoomCharge2026({ ...RC(), stays: [{ roomChargeTotal: 400_000.9, inpatientDays: 10 }] } as never))));
  check("상급병실료 진료비: 음수는 종전대로 거부",
    isRejected(wrap(() => calculateRoomCharge2026({ ...RC(), stays: [{ roomChargeTotal: -1, inpatientDays: 10 }] } as never))));
  check("상급병실료 진료비: undefined는 종전대로 거부",
    isRejected(wrap(() => calculateRoomCharge2026({ ...RC(), stays: [{ inpatientDays: 10 }] } as never))));
  // HOLD는 그대로다.
  const src = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("500만원 공제 pool 미적용 HOLD 안내가 그대로",
    /공제금액 상한 500만 원\(특별약관1 제5조 제5항\)은 상급병실료 차액에 적용한다는 명시적 근거를 찾지 못해 반영하지 않았습니다\./.test(src));
  check("180일 계속 입원 미반영 고지가 그대로", /180일까지 보상되지만[^\n]*이 계산에는 반영하지 않았습니다/.test(src));
  check("미사용 키 목록이 그대로", /UNUSED_KEYS/.test(src));
}

console.log("\n[G-22] 9. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("전용 가드가 이 파일 안에 있다",
    /const nonNegSafeInt = \(v: unknown\): boolean =>\n\s*typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0;/.test(raw));
  check("전용 가드를 export하지 않는다(공용화 금지)", !/export const nonNegSafeInt/.test(raw));
  check("두 금액 축이 전용 가드를 쓴다",
    (body.match(/!nonNegSafeInt\(/g) ?? []).length === 2
    && /if \(paidRaw !== undefined && !nonNegSafeInt\(paidRaw\)\)/.test(body)
    && /if \(limitRaw !== undefined && !nonNegSafeInt\(limitRaw\)\)/.test(body));
  // ⚠ **낡은 계약 3건을 교체했다(G-26).** G-22는 "공용 `isNum()`을 강화하지 않는다 —
  //   진료비 축이 계속 쓴다"를 고정했다. 그 판단의 근거는 **진료비 축과 이 파일의 두 금액
  //   축이 계약이 다르다**는 것이었고, 그 근거는 지금도 유효하다. 다만 G-26이 진료비 축
  //   자체를 닫으면서 `isNum`의 사용처가 0이 되어 **가드를 삭제**했다(전용 가드
  //   `isClaimAmount`로 대체). 여기서는 두 가드가 **여전히 분리돼 있는지**를 고정한다.
  const guards = readFileSync("src/lib/insurance/engine/itemGuards.ts", "utf8");
  const item0 = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const item0Code = item0.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("공용 isNum이 실행 코드에서 사라졌다(사용처 0)",
    !/export const isNum/.test(guards)
    && !/\bisNum\b/.test(body) && !/\bisNum\b/.test(item0Code));
  check("진료비 전용 가드가 공용으로 생겼다(isClaimAmount)",
    /export const isClaimAmount = \(v: unknown\): v is number =>\n\s*typeof v === "number" && Number\.isSafeInteger\(v\) && v >= 0;/.test(guards));
  check("이 파일의 진료비 축은 진료비 전용 가드를 쓴다", /if \(!isClaimAmount\(total\)\)/.test(body));
  const item = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("별도 보장종목의 진료비 축도 같은 진료비 전용 가드를 쓴다",
    /if \(!isClaimAmount\(amount\)\) return rejected\(`\$\{i \+ 1\}번째 행의 진료비\(amount\)`/.test(item));
  check("두 금액 축의 전용 가드는 진료비 가드와 **분리된 채**로 남았다",
    /const nonNegSafeInt = /.test(body) && !/isClaimAmount\(paidRaw\)/.test(body)
    && !/isClaimAmount\(limitRaw\)/.test(body));
  // 각 축을 한 번만 읽는다.
  check("두 축을 각각 한 번만 읽는다",
    (body.match(/\.priorAnnualInsurancePaid/g) ?? []).length === 1
    && (body.match(/\.annualCoverageLimit/g) ?? []).length === 1,
    `${(body.match(/\.priorAnnualInsurancePaid/g) ?? []).length} / ${(body.match(/\.annualCoverageLimit/g) ?? []).length}`);
  // ⚠ G-26에서 반환에 `stayTotals`가 추가됐다(진료비도 같은 계약으로 넘긴다). 두 금액 축의
  //   계약은 그대로다.
  check("검증한 값을 그대로 돌려주어 본체가 다시 읽지 않는다",
    /return \{ paid: paidRaw as number \| undefined, limit: limitRaw as number \| undefined, stayTotals \};/.test(body)
    && /const annualLimit = annualLimitOf\(input\.severity, checked\.limit\);/.test(body)
    && /let paid = checked\.paid \?\? 0;/.test(body));
  // 관용 파서가 사라졌다.
  check("nonNegInt가 이 파일에서 사라졌다", !/nonNegInt/.test(body), (body.match(/[^\n]*nonNegInt[^\n]*/) ?? [""])[0]);
  check("이 두 축에 내림·클램프를 걸지 않는다",
    !/Math\.floor\([^)]*(paid|limit)/i.test(body) && !/Math\.max\(0, [^)]*(paid|limit)/i.test(body));
  check("annualLimitOf가 검증된 원값만 쓴다",
    /if \(limit === undefined \|\| limit === 0\) return undefined;/.test(body)
    && /return Math\.min\(limit, max\);/.test(body)
    && !/Number\.isFinite/.test(body));
  // 상한 절삭은 그대로다.
  check("상한 절삭이 그대로", /GEN2026\.nonBenefit\.critical\.annualLimitMax/.test(body)
    && /GEN2026\.nonBenefit\.nonCritical\.annualLimitMax/.test(body));
  // 안내 문구는 한 글자도 바꾸지 않았다.
  check("거부 안내 문구가 그대로",
    /return rejected\("기존 지급보험금\(priorAnnualInsurancePaid\)", paidRaw\);/.test(body)
    && /return rejected\("연간 보험가입금액\(annualCoverageLimit\)", limitRaw\);/.test(body));
  // 다른 엔진은 자기 사본을 그대로 가진다.
  for (const [label, path] of [["2·3세대", "src/lib/insurance/engine/multiClaim.ts"],
    ["5세대 다회", "src/lib/insurance/engine/multiClaim2026.ts"],
    ["별도 보장종목", "src/lib/insurance/engine/specialItem2026.ts"]] as [string, string][]) {
    check(`${label} 엔진의 nonNegInt 사본은 그대로`, /const nonNegInt =/.test(readFileSync(path, "utf8")));
  }
}

console.log(`\n[G-22 상급병실료 두 금액 축 값 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
