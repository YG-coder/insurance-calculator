// G-30 — 4·5세대 **미사용 금액 축**의 런타임 거부와 경로별 타입 봉인.
//   확장 안전성 점검의 마지막 독립 과제다. G-16~G-29가 활성 축의 값 검증과 단일 읽기를
//   닫았고, 여기서는 **그 축이 쓰이지 않는 경로에 실려 왔을 때**의 계약을 세운다.
//
// ⚠ 이름에 "금액"이 들어간다는 이유만으로 같은 계약이라고 보지 않는다. 축마다 근거 조문과
//   소비 경로가 다르다. 아래 행렬이 이번 조사의 결과다(기준선 `f2ae27e`, UI 미경유 엔진
//   직접 호출 + 접근자 계수).
//
// | 세대 | 진입점 | 경로 | 필드 | 종전 런타임 | 종전 접근자 |
// | 4 | calculateMany2021 | 일반 3경로(rider "none") | priorAnnualRiderPaid | **조용한 폐기** | **0회** |
// | 4 | calculateMany2021 | 특약 3경로(도수·주사료·MRI) | annualCoverageLimit | **조용한 폐기** | **0회** |
// | 4 | calculateMany2021 | 특약 3경로 | priorAnnualInsurancePaid | **조용한 폐기** | **0회** |
// | 5 | calculateMany2026 | 급여 2경로 | priorAnnualInsurancePaid | **조용한 폐기** | **0회** |
// | 5 | calculateMany2026 | 급여 2경로 | annualCoverageLimit | **조용한 폐기** | **0회** |
// | 5 | calculateMany2026 | 급여 2경로 | outpatientCoverageLimit | **조용한 폐기** | **0회** |
// | 5 | calculateMany2026 | 비급여 **입원** | outpatientCoverageLimit | **조용한 폐기** | **0회** |
// | 5 | calculateGen2026Item | 별도 보장종목 4경로 | annualCoverageLimit | **조용한 폐기** | **0회** |
// | 5 | calculateGen2026Item | 별도 보장종목 4경로 | outpatientCoverageLimit | **조용한 폐기** | **0회** |
// | 5 | calculateGen2026Item | 별도 보장종목 4경로 | priorAnnualDeductible | **조용한 폐기** | **0회** |
// | 5 | calculateMany2026 | 비급여 중증·입원·상급종합 | priorAnnualDeductible | 소비하되 **2회 읽기** | 2회 |
//
// ⚠ **상급병실료는 정정 사항이다.** 이전 조사에서 `outpatientCoverageLimit` "2회 읽기"가
//   관측됐으나, G-28이 `UNUSED_KEYS` 루프를 단일 읽기로 바꾸면서 이미 닫혔다. 기준선
//   `f2ae27e`에서 재확인한 결과 세 축 모두 **1회 읽고 명시적으로 거부**한다(아래 5절).
//
// 목표 계약(미사용 금액 축):
//   `undefined`는 미제공과 동일 / `undefined`가 아닌 값은 **숫자 `0`도 포함해** 명시적 거부 /
//   조용히 폐기하지 않음 / 올바른 진입점과 활성 경로를 안내 / 그 진입점의 기존 실패 반환
//   계약 유지(`blocked()`는 검증된 진료비 합계 보존, `rejected()`는 총액 0) / 선행 preflight가
//   결과를 정한 경로에서는 읽지 않음 / 판정 지점에서 정확히 한 번 읽고 그 값을 안내에 표시 /
//   `in`이 아니라 `!== undefined`(호출부의 `{ ...base, key: undefined }` 패턴을 막지 않는다) /
//   계산식·한도·공제·횟수·승인 회차·HOLD는 변경하지 않음.
import { readFileSync } from "node:fs";
import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import {
  Gen2021MultiGeneralBenefitInput, Gen2021MultiGeneralNonBenefitInpatientInput,
  Gen2021MultiGeneralNonBenefitOutpatientInput, Gen2021MultiRiderInjectionInput,
  Gen2021MultiRiderManualInput, Gen2021MultiRiderMriInput,
  Gen2026CriticalInjectionInput, Gen2026CriticalMriInput, Gen2026CriticalMskInput,
  Gen2026BenefitInput, Gen2026MultiBenefitInput, Gen2026MultiNonBenefitInput,
  Gen2026NonBenefitInput, Gen2026NonCriticalMriInput,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
type Any = Record<string, unknown>;
type Res = Record<string, unknown>;
type Caught = { threw: string } | { r: Res };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const wrap = (f: () => unknown): Caught => {
  try { return { r: f() as Res }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const statusOf = (x: Caught) => threw(x) ? "THROW" : String(x.r.status);
const note0 = (x: Caught) => threw(x) ? "" : (((x.r.notes as string[]) ?? [])[0] ?? "");
const notesOf = (x: Caught) => threw(x) ? "" : ((x.r.notes as string[]) ?? []).join("\n");
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw : JSON.stringify([
  x.r.route, x.r.status, x.r.totalAmount, x.r.totalOwnPay, x.r.totalInsurancePay,
  x.r.appliedCaps, x.r.notes, (x.r.lines as unknown[] ?? []).length,
]);
/** 다회 진입점의 차단 계약 — 검증된 진료비 합계를 보존하고 행·후보 보험금을 노출하지 않는다. */
const isBlocked = (x: Caught, total: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === total && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0
  && Array.isArray(x.r.appliedCaps) && (x.r.appliedCaps as unknown[]).length === 0;
/** 항목 진입점의 거부 계약 — 총액을 만들지 않는다. */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const AMT = 300_000, BIG = 3_000_000;
const out = (a: number) => ({ amount: a, visit: "outpatient" });
const inp = (a: number, tier = "hospital") => ({ amount: a, visit: "inpatient", tier });

// ── 4세대 6경로 ──────────────────────────────────────────────────────
const G21: Record<string, (e?: Any) => Any> = {
  "일반 비급여 통원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic", amounts: [AMT], priorAnnualOutpatientVisits: 0, ...e }),
  "일반 급여": (e = {}) => ({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [AMT], ...e }),
  "일반 비급여 입원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "hospital", amounts: [AMT], ...e }),
  "특약 도수치료": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic", rider: "manual_therapy", amounts: [AMT], priorAnnualRiderVisits: 0, ...e }),
  "특약 주사료": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic", rider: "injection", amounts: [AMT], priorAnnualRiderVisits: 0, ...e }),
  "특약 MRI": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic", rider: "mri", amounts: [AMT], ...e }),
};
const GEN21 = ["일반 비급여 통원", "일반 급여", "일반 비급여 입원"];
const RID21 = ["특약 도수치료", "특약 주사료", "특약 MRI"];
// ── 5세대 다회 4경로 ─────────────────────────────────────────────────
const G26M: Record<string, (e?: Any) => Any> = {
  "비급여 통원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic", severity: "non_critical", nonBenefitItem: "general", amounts: [AMT], priorAnnualOutpatientDays: 0, ...e }),
  "비급여 입원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "hospital", severity: "critical", nonBenefitItem: "general", amounts: [BIG], ...e }),
  "급여 통원": (e = {}) => ({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4, amounts: [AMT], ...e }),
  "급여 입원": (e = {}) => ({ cause: "disease", coverage: "benefit", visit: "inpatient", tier: "hospital", nhisCoinsuranceRate: 0.4, amounts: [AMT], ...e }),
};
// ── 5세대 별도 보장종목 4경로 + 일반 전환 3경로 + 상급병실료 ─────────
const G26I: Record<string, (e?: Any) => Any> = {
  "중증 근골격계": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: [out(AMT)], approvedThroughVisit: 50, priorAnnualTreatmentActCount: 0, ...e }),
  "중증 주사료": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "general", lines: [out(AMT)], ...e }),
  "중증 MRI": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [inp(BIG)], ...e }),
  "비중증 MRI": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri", lines: [inp(AMT)], ...e }),
};
const ROUTED: Record<string, (e?: Any) => Any> = {
  "일반전환 비중증 근골격계": (e = {}) => ({ route: "general", coverage: "non_benefit", severity: "non_critical", item: "musculoskeletal_esw", cause: "disease", visit: "outpatient", amounts: [AMT], priorAnnualOutpatientDays: 0, ...e }),
  "일반전환 항암제": (e = {}) => ({ route: "general", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "anticancer", cause: "disease", visit: "outpatient", amounts: [AMT], priorAnnualOutpatientVisits: 0, ...e }),
};
const RC = (e: Any = {}) => ({ route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "non_critical", stays: [{ roomChargeTotal: 1_000_000, inpatientDays: 5 }], ...e });

const f21 = (i: unknown) => wrap(() => calculateMany2021(i as never));
const f26 = (i: unknown) => wrap(() => calculateMany2026(i as never));
const fSI = (i: unknown) => wrap(() => calculateGen2026Item(i as never));
const fRC = (i: unknown) => wrap(() => calculateRoomCharge2026(i as never));

/** 접근자 계수 — 값이 아니라 **읽는 행위**를 본다. */
const probe = (base: Any, key: string, get: () => unknown, f: (i: unknown) => Caught) => {
  let reads = 0;
  const o = { ...base };
  Object.defineProperty(o, key, { enumerable: true, configurable: true, get() { reads += 1; return get(); } });
  const x = f(o);
  return { reads, x };
};

const circ: Any = {}; circ.self = circ;
/** 지시서 4절의 전수 값 격자. */
const VALUES: [string, unknown][] = [
  ["숫자 0", 0], ["정상 양의 안전 정수", 400_000], ["한도와 같은 값", 5_000_000], ["한도 초과값", 60_000_000],
  ["음수", -1], ["소수", 1.5], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["숫자 문자열", "400000"], ["빈 문자열", ""], ["공백", " "], ["지수 문자열", "1e5"], ["쉼표 문자열", "1,000"],
  ["null", null], ["불리언", true], ["객체", {}], ["배열", []], ["bigint", BigInt(5)],
  ["Symbol", Symbol("s")], ["함수", () => 1], ["순환 참조", circ],
  ["MAX_SAFE_INTEGER", Number.MAX_SAFE_INTEGER], ["안전 정수 초과", Number.MAX_SAFE_INTEGER + 1],
];

console.log("\n[G-30] 1. 4세대 — 일반 경로는 특약 축을 거부한다");
{
  for (const name of GEN21) {
    const mk = G21[name];
    const ref = shape(f21(mk()));
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(f21(mk())) === "OK");
    check(`${name}: 명시적 undefined는 미제공과 같다`,
      shape(f21(mk({ priorAnnualRiderPaid: undefined }))) === ref);
    for (const [label, v] of VALUES) {
      const x = f21(mk({ priorAnnualRiderPaid: v }));
      check(`${name} + ${label} → blocked(진료비 합계 보존)`,
        isBlocked(x, AMT) && note0(x).startsWith("3대비급여 특약의 기존 지급보험금(priorAnnualRiderPaid)"),
        `${statusOf(x)} ${note0(x).slice(0, 34)}`);
    }
    check(`${name}: 안내가 올바른 활성 경로를 말한다`,
      notesOf(f21(mk({ priorAnnualRiderPaid: 0 }))).includes("일반 보장은 별도 축(priorAnnualInsurancePaid)을 씁니다"));
  }
}

console.log("\n[G-30] 2. 4세대 — 특약 경로는 일반 금액 두 축을 거부한다");
{
  for (const name of RID21) {
    const mk = G21[name];
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(f21(mk())) === "OK");
    for (const key of ["annualCoverageLimit", "priorAnnualInsurancePaid"]) {
      check(`${name} · ${key}: 명시적 undefined는 미제공과 같다`,
        shape(f21(mk({ [key]: undefined }))) === shape(f21(mk())));
      for (const [label, v] of VALUES.slice(0, 10)) {
        const x = f21(mk({ [key]: v }));
        check(`${name} · ${key} + ${label} → blocked`, isBlocked(x, AMT) && note0(x).includes(key),
          `${statusOf(x)} ${note0(x).slice(0, 30)}`);
      }
    }
    // 여러 stray 키가 동시에 있으면 목록 순서대로 첫 키만 안내한다.
    const both = f21(mk({ annualCoverageLimit: 0, priorAnnualInsurancePaid: 0 }));
    check(`${name}: 두 stray 동시 → 목록 첫 키(priorAnnualInsurancePaid)만 안내`,
      note0(both).includes("priorAnnualInsurancePaid") && !note0(both).includes("annualCoverageLimit"),
      note0(both).slice(0, 40));
  }
}

console.log("\n[G-30] 3. 5세대 다회 — 급여 경로의 미사용 금액 축");
{
  const KEYS = ["priorAnnualInsurancePaid", "annualCoverageLimit", "outpatientCoverageLimit"];
  for (const name of ["급여 통원", "급여 입원"]) {
    const mk = G26M[name];
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(f26(mk())) === "OK");
    for (const key of KEYS) {
      check(`${name} · ${key}: 명시적 undefined는 미제공과 같다`,
        shape(f26(mk({ [key]: undefined }))) === shape(f26(mk())));
      for (const [label, v] of VALUES.slice(0, 10)) {
        const x = f26(mk({ [key]: v }));
        check(`${name} · ${key} + ${label} → blocked`, isBlocked(x, AMT) && note0(x).includes(key),
          `${statusOf(x)} ${note0(x).slice(0, 30)}`);
      }
    }
    const all = f26(mk({ annualCoverageLimit: 0, outpatientCoverageLimit: 0, priorAnnualInsurancePaid: 0 }));
    check(`${name}: 세 stray 동시 → 목록 첫 키만 안내`,
      note0(all).includes("priorAnnualInsurancePaid"), note0(all).slice(0, 40));
    // 통원 카운터 안내가 종전대로 먼저다.
    check(`${name}: 통원 카운터 stray가 금액 stray보다 앞선다(종전 우선순위)`,
      note0(f26(mk({ priorAnnualOutpatientDays: 0, priorAnnualInsurancePaid: 0 })))
        .startsWith("통원 횟수·일수 카운터는 비급여 통원 전용입니다"));
    // priorAnnualDeductible은 C군의 급여 전용 안내를 그대로 쓴다(한 축을 두 자리에서 막지 않는다).
    check(`${name}: priorAnnualDeductible은 종전 C군 안내 그대로`,
      note0(f26(mk({ priorAnnualDeductible: 0 })))
        .startsWith("누적 공제금액(priorAnnualDeductible)은 비급여 중증 입원의 500만원"));
  }
}

console.log("\n[G-30] 4. 5세대 다회 — 비급여 입원의 통원 가입금액 (알려진 사례 A)");
{
  const mk = G26M["비급여 입원"];
  check("입원: 축을 싣지 않으면 종전대로 계산한다", statusOf(f26(mk())) === "OK");
  check("입원: 명시적 undefined는 미제공과 같다",
    shape(f26(mk({ outpatientCoverageLimit: undefined }))) === shape(f26(mk())));
  for (const [label, v] of VALUES) {
    const x = f26(mk({ outpatientCoverageLimit: v }));
    check(`입원 + ${label} → blocked(진료비 합계 보존)`,
      isBlocked(x, BIG) && note0(x).startsWith("통원 가입금액(outpatientCoverageLimit)은 통원 보상에만"),
      `${statusOf(x)} ${note0(x).slice(0, 30)}`);
  }
  check("통원에서는 종전대로 소비한다(적용 확인)",
    statusOf(f26(G26M["비급여 통원"]({ outpatientCoverageLimit: 100_000 }))) === "OK");
  // 접근자 격자.
  const one = () => 150_000;
  check("입원: 정확히 1회 읽는다", probe(mk(), "outpatientCoverageLimit", one, f26).reads === 1);
  const chg = (() => { let i = 0; const seq = [150_000, 0, 999]; return () => seq[Math.min(i++, 2)]; })();
  const c = probe(mk(), "outpatientCoverageLimit", chg, f26);
  check("입원: 변하는 getter에서도 1회 — 검사값과 안내값이 같다",
    c.reads === 1 && note0(c.x).startsWith("통원 가입금액") && notesOf(c.x).includes("받은 값: 150000"),
    notesOf(c.x).slice(-40));
  const boom = probe(mk(), "outpatientCoverageLimit", () => { throw new Error("boom"); }, f26);
  check("입원: 던지는 getter는 전파된다(막으려면 읽어야 한다)", threw(boom.x));
  const pre = probe(mk({ amounts: ["abc"] }), "outpatientCoverageLimit", () => { throw new Error("x"); }, f26);
  check("입원: 진료비가 먼저 무효면 접근자 0회이고 예외도 없다", pre.reads === 0 && !threw(pre.x));
}

console.log("\n[G-30] 5. 상급병실료 — 이미 닫혀 있다 (이전 조사 정정)");
{
  // ⚠ 이전 조사에서 `outpatientCoverageLimit` **2회 읽기**가 관측됐으나, G-28이
  //   `UNUSED_KEYS` 루프를 단일 읽기로 바꾸면서 이미 닫혔다. 기준선에서 재확인한 사실을
  //   회귀로 고정한다 — 이번 커밋은 이 파일을 손대지 않았다.
  for (const key of ["outpatientCoverageLimit", "priorAnnualDeductible", "priorAnnualInpatientDeductible", "priorAnnualCoveredCount"]) {
    for (const f of [fSI, fRC]) {
      const p = probe(RC(), key, () => 0, f);
      check(`상급병실료(${f === fSI ? "진입점" : "전용"}) · ${key}: 1회 읽고 rejected`,
        p.reads === 1 && isRejected(p.x) && note0(p.x).includes(`쓰이지 않는 입력(${key})`),
        `reads=${p.reads} ${note0(p.x).slice(0, 34)}`);
    }
  }
  check("상급병실료: 활성 두 축은 종전대로 소비한다",
    statusOf(fRC(RC({ priorAnnualInsurancePaid: 0, annualCoverageLimit: 10_000_000 }))) === "OK");
  const rcSrc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("상급병실료 미사용 키 루프는 G-28의 단일 읽기 그대로다(이번에 손대지 않았다)",
    /const got: unknown = raw\[key\];\n\s*if \(got !== undefined\) return rejected\(`상급병실료 차액 계산에 쓰이지 않는 입력\(\$\{key\}\)`, got\);/.test(rcSrc));
}

console.log("\n[G-30] 6. 별도 보장종목 — 일반 (1)(2) 전용 세 축 (알려진 사례 B 포함)");
{
  const KEYS = ["annualCoverageLimit", "outpatientCoverageLimit", "priorAnnualDeductible"];
  for (const name of Object.keys(G26I)) {
    const mk = G26I[name];
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(fSI(mk())) === "OK");
    for (const key of KEYS) {
      check(`${name} · ${key}: 명시적 undefined는 미제공과 같다`,
        shape(fSI(mk({ [key]: undefined }))) === shape(fSI(mk())));
      for (const [label, v] of VALUES.slice(0, 10)) {
        const x = fSI(mk({ [key]: v }));
        check(`${name} · ${key} + ${label} → rejected(총액 0)`,
          isRejected(x) && note0(x).startsWith(`${key}은(는) 일반 상해·질병 비급여의 금액 축`),
          `${statusOf(x)} ${note0(x).slice(0, 30)}`);
      }
    }
    const all = fSI(mk({ annualCoverageLimit: 0, outpatientCoverageLimit: 0, priorAnnualDeductible: 0 }));
    check(`${name}: 세 stray 동시 → 목록 첫 키(annualCoverageLimit)만 안내`,
      note0(all).startsWith("annualCoverageLimit은(는)"), note0(all).slice(0, 30));
  }
  // ⚠ 알려진 사례 B — 중증 MRI의 `priorAnnualDeductible`이 **다른 축으로 소비되지 않는다.**
  //   결과 동일성이 아니라 전달·접근자로 확인한다.
  const mri = G26I["중증 MRI"];
  const withPool = fSI(mri({ priorAnnualInpatientDeductible: 5_000_000 }));
  check("중증 MRI: 올바른 pool 축은 종전대로 소비한다(공제 없음)",
    statusOf(withPool) === "OK" && (withPool as { r: Res }).r.totalOwnPay === 0);
  check("중증 MRI: priorAnnualDeductible을 pool로 대신 쓰지 않고 거부한다",
    isRejected(fSI(mri({ priorAnnualDeductible: 5_000_000 })))
    && note0(fSI(mri({ priorAnnualDeductible: 5_000_000 }))).startsWith("priorAnnualDeductible은(는)"));
  const p = probe(mri(), "priorAnnualDeductible", () => 5_000_000, fSI);
  check("중증 MRI: priorAnnualDeductible을 정확히 1회 읽는다", p.reads === 1, `reads=${p.reads}`);
  const chg = (() => { let i = 0; const seq = [5_000_000, 0]; return () => seq[Math.min(i++, 1)]; })();
  const cx = probe(mri(), "priorAnnualDeductible", chg, fSI);
  check("중증 MRI: 변하는 getter에서 검사값과 안내값이 같다",
    cx.reads === 1 && notesOf(cx.x).includes("5000000"), notesOf(cx.x).slice(-40));
  // 경로 불일치·용도 미정에서는 읽지 않는다(G-29의 계약이 그대로다).
  const MIS = { route: "general", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw",
    cause: "disease", visit: "outpatient", amounts: [AMT], priorAnnualOutpatientVisits: 0 };
  for (const key of KEYS) {
    const z = probe(MIS, key, () => { throw new Error("boom"); }, fSI);
    check(`경로 불일치 · ${key}: 접근자 0회이고 예외도 없다`, z.reads === 0 && !threw(z.x));
    check(`경로 불일치 · ${key}: 경로 안내가 그대로 우선`,
      note0(z.x).startsWith("이 조합은 별도 보장종목 경로에서 계산해야 합니다"));
  }
  // ⚠ **형제 축과 같은 자리다.** `priorAnnualCoveredCount`·`priorAnnualInpatientDeductible`도
  //   `validateItemInput`에서 `route === "special_item"` 분기(행 검증)보다 **앞**에 판정한다.
  //   한 필드만 다른 순서로 두지 않는다(지시서 7절의 형제 정렬). 그래서 진료비·승인 회차보다
  //   먼저 나가는 것은 **의도한 전환**이고 차분 버킷으로 공개한다.
  for (const key of KEYS) {
    const z = probe(G26I["중증 근골격계"]({ lines: [{ amount: -1, visit: "outpatient" }] }), key, () => 0, fSI);
    const sib = probe(G26I["중증 근골격계"]({ lines: [{ amount: -1, visit: "outpatient" }] }), "priorAnnualInpatientDeductible", () => 0, fSI);
    check(`진료비 무효 + ${key}: 형제 축과 같은 순서(둘 다 1회 읽고 stray 안내)`,
      z.reads === 1 && sib.reads === 1 && isRejected(z.x) && isRejected(sib.x), `reads=${z.reads}/${sib.reads}`);
  }
  // 리터럴 네 축이 무효이면 종전대로 그 안내가 먼저이고 금액 축은 읽지 않는다.
  for (const [l, base] of [
    ["리터럴 item 무효", { ...G26I["중증 MRI"](), item: "zzz" }],
    ["리터럴 route 무효", { ...G26I["중증 MRI"](), route: "zzz" }],
    ["리터럴 severity 무효", { ...G26I["중증 MRI"](), severity: "zzz" }],
  ] as [string, Any][]) {
    const z = probe(base, "annualCoverageLimit", () => { throw new Error("boom"); }, fSI);
    check(`선행 차단(${l}): 접근자 0회이고 예외도 없다`, z.reads === 0 && !threw(z.x), `reads=${z.reads}`);
  }
}

console.log("\n[G-30] 7. 일반 전환 경로 — 세 축을 그대로 소비한다(무회귀)");
{
  for (const name of Object.keys(ROUTED)) {
    const mk = ROUTED[name];
    check(`${name}: 정상 계산 무회귀`, statusOf(fSI(mk())) === "OK");
    check(`${name}: annualCoverageLimit을 소비한다`,
      shape(fSI(mk({ annualCoverageLimit: 1 }))) !== shape(fSI(mk())));
    check(`${name}: outpatientCoverageLimit을 통원에서 소비한다`,
      shape(fSI(mk({ outpatientCoverageLimit: 1 }))) !== shape(fSI(mk())));
    check(`${name}: priorAnnualInsurancePaid를 소비한다(축을 거부하지 않는다)`,
      statusOf(fSI(mk({ priorAnnualInsurancePaid: 0 }))) === "OK");
  }
  // 일반 전환 **입원**에서는 통원 가입금액이 하류 다회 계약으로 차단된다.
  const inpRouted = fSI({ route: "general", coverage: "non_benefit", severity: "non_critical",
    item: "musculoskeletal_esw", cause: "disease", visit: "inpatient", tier: "hospital",
    amounts: [BIG], outpatientCoverageLimit: 100_000 });
  check("일반 전환 입원 + 통원 가입금액 → route general 유지, 진료비 합계 보존",
    !threw(inpRouted) && inpRouted.r.route === "general" && inpRouted.r.status === "PENDING_UNVERIFIED"
    && inpRouted.r.totalAmount === BIG, shape(inpRouted));
}

console.log("\n[G-30] 8. 활성 축의 단일 읽기 — 다회 누적 공제금액");
{
  const mk = G26M["비급여 입원"];
  const p = probe(mk(), "priorAnnualDeductible", () => 0, f26);
  check("중증·입원·상급종합: 정확히 1회 읽는다(종전 2회)", p.reads === 1, `reads=${p.reads}`);
  const chg = (() => { let i = 0; const seq = [0, 5_000_000]; return () => seq[Math.min(i++, 1)]; })();
  const cx = probe(mk(), "priorAnnualDeductible", chg, f26);
  check("변하는 getter에서 첫 검증값(0)으로 계산한다",
    cx.reads === 1 && shape(cx.x) === shape(f26(mk({ priorAnnualDeductible: 0 }))), shape(cx.x));
  const chg2 = (() => { let i = 0; const seq = [5_000_000, 0]; return () => seq[Math.min(i++, 1)]; })();
  const cy = probe(mk(), "priorAnnualDeductible", chg2, f26);
  check("반대 순서에서도 첫 검증값(5,000,000)으로 계산한다",
    cy.reads === 1 && shape(cy.x) === shape(f26(mk({ priorAnnualDeductible: 5_000_000 }))), shape(cy.x));
  const chg3 = (() => { let i = 0; const seq = [0, -1]; return () => seq[Math.min(i++, 1)]; })();
  check("두 번째 값이 무효여도 세탁되지 않는다(관용 파서 삭제)",
    shape(probe(mk(), "priorAnnualDeductible", chg3, f26).x) === shape(f26(mk({ priorAnnualDeductible: 0 }))));
  check("소비 조건·상한은 그대로다(0과 5,000,000의 결과가 다르다)",
    shape(f26(mk({ priorAnnualDeductible: 0 }))) !== shape(f26(mk({ priorAnnualDeductible: 5_000_000 }))));
}

console.log("\n[G-30] 9. 접근자 — 모든 미사용 축이 정확히 1회, 선행 차단 0회");
{
  const CASES: [string, Any, string[], (i: unknown) => Caught][] = [
    ...GEN21.map((n) => [`4세대 ${n}`, G21[n](), ["priorAnnualRiderPaid"], f21] as [string, Any, string[], (i: unknown) => Caught]),
    ...RID21.map((n) => [`4세대 ${n}`, G21[n](), ["annualCoverageLimit", "priorAnnualInsurancePaid"], f21] as [string, Any, string[], (i: unknown) => Caught]),
    ["5세대 급여 통원", G26M["급여 통원"](), ["priorAnnualInsurancePaid", "annualCoverageLimit", "outpatientCoverageLimit"], f26],
    ["5세대 급여 입원", G26M["급여 입원"](), ["priorAnnualInsurancePaid", "annualCoverageLimit", "outpatientCoverageLimit"], f26],
    ["5세대 비급여 입원", G26M["비급여 입원"](), ["outpatientCoverageLimit"], f26],
    ...Object.keys(G26I).map((n) => [`5세대 ${n}`, G26I[n](), ["annualCoverageLimit", "outpatientCoverageLimit", "priorAnnualDeductible"], fSI] as [string, Any, string[], (i: unknown) => Caught]),
  ];
  for (const [label, base, keys, f] of CASES) for (const key of keys) {
    const p = probe(base, key, () => 0, f);
    check(`${label} · ${key}: 정확히 1회`, p.reads === 1, `reads=${p.reads}`);
    // 값이 달라지는 getter에서도 검사값과 안내값이 같다.
    let i = 0;
    const seq: unknown[] = [7, "달라진값"];
    const c = probe(base, key, () => seq[Math.min(i++, 1)], f);
    check(`${label} · ${key}: 변하는 getter에서 안내에 첫 값(7)이 실린다`,
      c.reads === 1 && notesOf(c.x).includes("받은 값: 7"), notesOf(c.x).slice(-30));
  }
  // 선행 차단 — 진료비가 먼저 무효이면 어느 미사용 축도 읽지 않는다.
  //   ⚠ 별도 보장종목은 형제 축(covered·pool)과 같은 자리라 행 검증보다 앞이다 —
  //     위 6절이 그 순서를 형제와 나란히 고정한다. 여기서는 다회 두 진입점만 본다.
  const PRE: [string, Any, string[], (i: unknown) => Caught][] = [
    ["4세대 특약(진료비 무효)", G21["특약 도수치료"]({ amounts: ["abc"] }), ["annualCoverageLimit", "priorAnnualInsurancePaid"], f21],
    ["5세대 급여(진료비 무효)", G26M["급여 통원"]({ amounts: ["abc"] }), ["priorAnnualInsurancePaid", "annualCoverageLimit", "outpatientCoverageLimit"], f26],
    ["5세대 별도(리터럴 무효)", { ...G26I["중증 MRI"](), item: "zzz" }, ["annualCoverageLimit", "outpatientCoverageLimit", "priorAnnualDeductible"], fSI],
  ];
  for (const [label, base, keys, f] of PRE) for (const key of keys) {
    const p = probe(base, key, () => { throw new Error("boom"); }, f);
    check(`${label} · ${key}: 접근자 0회이고 예외도 없다`, p.reads === 0 && !threw(p.x), `reads=${p.reads}`);
  }
}

console.log("\n[G-30] 10. 구조 — 단일 읽기·in 미사용·관용 파서 부재");
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const m21 = strip("src/lib/insurance/engine/multiClaim2021.ts");
  const m26 = strip("src/lib/insurance/engine/multiClaim2026.ts");
  const si = strip("src/lib/insurance/engine/specialItem2026.ts");
  const rc = strip("src/lib/insurance/engine/roomCharge2026.ts");
  for (const [l, code] of [["4세대", m21], ["5세대 다회", m26], ["별도 보장종목", si], ["상급병실료", rc]] as [string, string][]) {
    check(`${l}: 미사용 키 판정에 in 연산자를 쓰지 않는다`, !/\bin (raw|input|nb|bf)\b/.test(code));
    check(`${l}: raw[key] !== undefined 뒤 같은 이름을 다시 읽지 않는다`,
      !/if \(raw\[[a-zA-Z]+\] !== undefined\)[\s\S]{0,200}raw\[[a-zA-Z]+\]\)/.test(code));
  }
  check("4세대 stray 루프가 한 번만 읽는다",
    /const got = readCount\(input, key\);\n\s*if \(got === undefined\) continue;/.test(m21));
  check("5세대 급여 stray 루프가 한 번만 읽는다",
    /const got = readCount\(bf, key\);\n\s*if \(got === undefined\) continue;/.test(m26));
  check("별도 보장종목 stray 루프가 한 번만 읽는다",
    /const got: unknown = raw\[key\];\n\s*if \(got === undefined\) continue;/.test(si));
  check("입원의 통원 가입금액도 한 번만 읽는다",
    /const strayOut = readCount\(nb, "outpatientCoverageLimit"\);\n\s*if \(strayOut !== undefined\)/.test(m26));
  check("5세대 다회에 관용 파서 nonNegInt가 없다(G-30에서 제거)", !/nonNegInt/.test(m26));
  check("별도 보장종목에도 없다(G-29에서 제거)", !/nonNegInt/.test(si));
  check("2·3세대 엔진은 자기 사본을 그대로 가진다(범위 밖)",
    /const nonNegInt =/.test(strip("src/lib/insurance/engine/multiClaim.ts")));
  check("누적 공제금액이 검증한 값을 그대로 쓴다",
    /let deductiblePaid = checkedDeductible \?\? 0;/.test(m26)
    && /checkedDeductible = deductible as number;/.test(m26));
  // 목록 상수 — 순서가 안내 우선순위다.
  check("급여 미사용 금액 축 목록이 세 축이고 순서가 고정돼 있다",
    /const BENEFIT_UNUSED_MONEY_KEYS = \[\n\s*"priorAnnualInsurancePaid", "annualCoverageLimit", "outpatientCoverageLimit",\n\] as const;/.test(m26));
  check("별도 보장종목 미사용 금액 축 목록이 세 축이고 순서가 고정돼 있다",
    /const SPECIAL_ITEM_UNUSED_MONEY_KEYS = \[\n\s*"annualCoverageLimit", "outpatientCoverageLimit", "priorAnnualDeductible",\n\] as const;/.test(si));
  // HOLD·규칙값 무회귀.
  const rules = readFileSync("src/lib/insurance/engine/regulatoryRules.ts", "utf8");
  for (const id of ["GEN2026-CRITICAL-DEDUCTIBLE-POOL-SCOPE", "GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY",
    "GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY", "GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY"]) {
    check(`HOLD 그대로: ${id}`, rules.includes(id));
  }
  check("지급 0원 HOLD 차단이 그대로", /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(m26));
  check("500만원 상한 산식이 그대로(검증한 값을 쓴다 — G-30)",
    /const priorDeductible = Math\.max\(0, \(rawDeductible as number \| undefined\) \?\? 0\);/.test(strip("src/lib/insurance/engine/generation2026.ts"))
    && /const remaining = Math\.max\(c\.annualDeductibleCap - priorDeductible, 0\);/.test(strip("src/lib/insurance/engine/generation2026.ts")));
}

console.log("\n[G-30] 11. 타입 봉인 — 컴파일 단계에서 고정한다");
{
  // ⚠ 실행 결과가 아니라 **컴파일 결과**를 고정한다. `?: never`인 속성의 타입은 `undefined`
  //   이므로 `Sealed`가 `true`가 된다. 봉인을 풀면 `false`가 되어 이 파일이 컴파일되지 않고
  //   `tsc --noEmit`·`npm run lint`가 실패한다(저장소의 기존 방식과 같다).
  //   ⚠ **선언 자체가 사라지는 경우도 실패로 잡는다.** 저장소의 기존 `Sealed`는 미선언을
  //     `true`로 보지만, 그러면 `?: never` 줄을 지우기만 해도 검사를 통과한다. 미선언은
  //     초과 속성 검사만 남아 변수·외부 데이터를 막지 못하므로 여기서는 `false`로 본다.
  type Sealed<T, K extends string> = K extends keyof T
    ? (T[K] extends undefined ? true : false) : false;
  // 4세대 — 일반 세 변형은 특약 축이 닫혀 있다.
  const s1: Sealed<Gen2021MultiGeneralNonBenefitOutpatientInput, "priorAnnualRiderPaid"> = true;
  const s2: Sealed<Gen2021MultiGeneralBenefitInput, "priorAnnualRiderPaid"> = true;
  const s3: Sealed<Gen2021MultiGeneralNonBenefitInpatientInput, "priorAnnualRiderPaid"> = true;
  // 4세대 — 특약 세 변형은 일반 금액 두 축이 닫혀 있다.
  const s4: Sealed<Gen2021MultiRiderManualInput, "annualCoverageLimit"> = true;
  const s5: Sealed<Gen2021MultiRiderManualInput, "priorAnnualInsurancePaid"> = true;
  const s6: Sealed<Gen2021MultiRiderInjectionInput, "annualCoverageLimit"> = true;
  const s7: Sealed<Gen2021MultiRiderInjectionInput, "priorAnnualInsurancePaid"> = true;
  const s8: Sealed<Gen2021MultiRiderMriInput, "annualCoverageLimit"> = true;
  const s9: Sealed<Gen2021MultiRiderMriInput, "priorAnnualInsurancePaid"> = true;
  // 5세대 급여 — 비급여 금액 네 축이 닫혀 있다.
  const s10: Sealed<Gen2026MultiBenefitInput, "priorAnnualInsurancePaid"> = true;
  const s11: Sealed<Gen2026MultiBenefitInput, "annualCoverageLimit"> = true;
  const s12: Sealed<Gen2026MultiBenefitInput, "outpatientCoverageLimit"> = true;
  const s13: Sealed<Gen2026MultiBenefitInput, "priorAnnualDeductible"> = true;
  // 5세대 별도 보장종목 — 일반 (1)(2) 전용 세 축이 닫혀 있다.
  const s14: Sealed<Gen2026CriticalMskInput, "annualCoverageLimit"> = true;
  const s15: Sealed<Gen2026CriticalInjectionInput, "outpatientCoverageLimit"> = true;
  const s16: Sealed<Gen2026CriticalMriInput, "priorAnnualDeductible"> = true;
  const s17: Sealed<Gen2026NonCriticalMriInput, "annualCoverageLimit"> = true;
  const s18: Sealed<Gen2026NonCriticalMriInput, "priorAnnualDeductible"> = true;
  check("타입 봉인 18종이 컴파일 단계에서 고정",
    [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18].every(Boolean));
  // 열려 있어야 하는 축은 반대로 false여야 한다 — 과하게 봉인하면 여기서 걸린다.
  const o1: Sealed<Gen2021MultiGeneralBenefitInput, "annualCoverageLimit"> = false;
  const o2: Sealed<Gen2021MultiGeneralBenefitInput, "priorAnnualInsurancePaid"> = false;
  const o3: Sealed<Gen2021MultiRiderManualInput, "priorAnnualRiderPaid"> = false;
  const o4: Sealed<Gen2026MultiNonBenefitInput, "priorAnnualInsurancePaid"> = false;
  const o5: Sealed<Gen2026MultiNonBenefitInput, "annualCoverageLimit"> = false;
  const o6: Sealed<Gen2026MultiNonBenefitInput, "outpatientCoverageLimit"> = false;
  const o7: Sealed<Gen2026MultiNonBenefitInput, "priorAnnualDeductible"> = false;
  const o8: Sealed<Gen2026CriticalMskInput, "priorAnnualInsurancePaid"> = false;
  const o9: Sealed<Gen2026CriticalMriInput, "priorAnnualInpatientDeductible"> = false;
  check("활성 축 9종은 열려 있다(과봉인 방지)",
    [o1, o2, o3, o4, o5, o6, o7, o8, o9].every((v) => v === false));
  // 정상 호출부는 `as` 단언 없이 컴파일된다 — 실제 리터럴로 확인한다.
  const okGen: Gen2021MultiGeneralNonBenefitOutpatientInput = {
    cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "none",
    amounts: [AMT], priorAnnualOutpatientVisits: 0,
    annualCoverageLimit: 50_000_000, priorAnnualInsurancePaid: 0, priorAnnualRiderPaid: undefined,
  };
  const okRider: Gen2021MultiRiderManualInput = {
    cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "manual_therapy",
    amounts: [AMT], priorAnnualRiderVisits: 0, priorAnnualRiderPaid: 0,
  };
  const okBenefit: Gen2026MultiBenefitInput = {
    cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic",
    nhisCoinsuranceRate: 0.4, amounts: [AMT],
  };
  check("정상 호출부는 as 없이 컴파일된다",
    calculateMany2021(okGen).status === "OK" && calculateMany2021(okRider).status === "OK"
    && calculateMany2026(okBenefit).status === "OK");
  check("명시적 undefined는 타입도 허용한다(in으로 막지 않는 계약과 짝)",
    statusOf(f21(okGen)) === "OK");
  // 런타임 입력은 타입만 믿지 않는다 — JSON.parse로 우회해도 엔진이 거부한다.
  const viaJson = JSON.parse('{"cause":"disease","coverage":"benefit","visit":"outpatient","tier":"clinic","nhisCoinsuranceRate":0.4,"amounts":[300000],"priorAnnualInsurancePaid":0}');
  check("JSON.parse로 우회한 stray도 런타임이 거부한다", isBlocked(f26(viaJson), AMT), shape(f26(viaJson)));
  const viaJson21 = JSON.parse('{"cause":"disease","coverage":"non_benefit","visit":"outpatient","tier":"clinic","rider":"mri","amounts":[300000],"priorAnnualInsurancePaid":0}');
  check("4세대도 같다", isBlocked(f21(viaJson21), AMT), shape(f21(viaJson21)));
  const viaJsonSI = JSON.parse('{"route":"special_item","coverage":"non_benefit","severity":"non_critical","item":"mri","lines":[{"amount":300000,"visit":"inpatient","tier":"hospital"}],"annualCoverageLimit":0}');
  check("별도 보장종목도 같다", isRejected(fSI(viaJsonSI)), shape(fSI(viaJsonSI)));
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  //   ⚠ **선언만 본다** — 주석에는 "여기 두지 않는다"는 근거로 축 이름이 남아 있다.
  const bodyOf = (name: string) => ((types.match(new RegExp(`interface ${name} \\{([\\s\\S]*?)\\n\\}`)) ?? ["", ""])[1])
    .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const c21 = bodyOf("Gen2021MultiCommonInput"), c26 = bodyOf("Gen2026MultiCommonInput");
  check("공통 상위 타입에 금액 축을 열어 두지 않는다(4세대)",
    c21.length > 0 && !/priorAnnualRiderPaid/.test(c21) && !/annualCoverageLimit/.test(c21)
    && !/priorAnnualInsurancePaid\?: number/.test(c21), c21.slice(0, 60));
  check("공통 상위 타입에 금액 축을 열어 두지 않는다(5세대 다회)",
    c26.length > 0 && !/priorAnnualInsurancePaid\?: number/.test(c26), c26.slice(0, 60));
  check("공통 베이스는 진료비·경로 축만 갖는다",
    /amounts: number\[\];/.test(c21) && /amounts: number\[\];/.test(c26));
}

console.log("\n[G-30] 11b. 단건 엔진(calc2026)의 미사용 금액 축");
{
  // ⚠ 단건은 `pending(amount, …)`가 이 진입점의 기존 실패 계약이다. 다회의 `blocked()`·
  //   항목 진입점의 `rejected()`와 한 형태로 통일하지 않는다.
  const single = (e: unknown) => wrap(() => calc2026(e as never));
  const isPending = (x: Caught) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
    && x.r.ownPay === null && x.r.insurancePay === null;
  const NB_OUT = { amount: 1_000_000, coverage: "non_benefit", visit: "outpatient", tier: "clinic", severity: "non_critical", nonBenefitItem: "general" };
  const NB_IN = { amount: 3_000_000, coverage: "non_benefit", visit: "inpatient", tier: "hospital", severity: "critical", nonBenefitItem: "general" };
  const BF_OUT = { amount: 1_000_000, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4 };
  const BF_IN = { amount: 1_000_000, coverage: "benefit", visit: "inpatient", tier: "hospital" };
  check("통원에서는 종전대로 소비한다", statusOf(single({ ...NB_OUT, perVisitCoverageLimit: 200_000 })) === "OK"
    && shape(single({ ...NB_OUT, perVisitCoverageLimit: 200_000 })) !== shape(single(NB_OUT)));
  for (const [l, base] of [["비급여 입원", NB_IN], ["급여 통원", BF_OUT], ["급여 입원", BF_IN]] as [string, Any][]) {
    check(`${l}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(single(base)) === "OK");
    check(`${l}: 명시적 undefined는 미제공과 같다`,
      shape(single({ ...base, perVisitCoverageLimit: undefined })) === shape(single(base)));
    for (const [vl, v] of VALUES.slice(0, 12)) {
      check(`${l} + ${vl} → pending(단건 계약)`, isPending(single({ ...base, perVisitCoverageLimit: v })),
        shape(single({ ...base, perVisitCoverageLimit: v })));
    }
    const p = probe(base, "perVisitCoverageLimit", () => 0, single);
    check(`${l}: 정확히 1회 읽는다`, p.reads === 1, `reads=${p.reads}`);
    const t = probe(base, "perVisitCoverageLimit", () => { throw new Error("boom"); }, single);
    check(`${l}: 던지는 getter는 전파된다`, threw(t.x));
  }
  // ── 비급여의 누적 공제금액: 실제 소비 조합만 허용한다 (검토 P1 반영) ──
  //   ⚠ 종전에는 미소비 조합에서 **읽고 무시**했다(이름은 읽지만 상급종합·종합 입원 분기에서만
  //     썼다). 다회 엔진(C군)은 같은 조합을 이미 거부하고 있어 두 진입점의 계약이 갈려 있었다.
  {
    const NOTE = "누적 공제금액(priorAnnualDeductible)은 중증 비급여 입원 중 상급종합병원·종합병원에만 적용됩니다";
    const gen = (e: Any) => single({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", ...e });
    const CONSUME = { severity: "critical", visit: "inpatient", tier: "hospital" };
    check("소비 조합(중증·입원·상급종합/종합): 종전대로 계산한다",
      statusOf(gen({ ...CONSUME, priorAnnualDeductible: 4_900_000 })) === "OK");
    check("소비 조합: 값이 실제로 상한에 반영된다",
      shape(gen({ ...CONSUME, priorAnnualDeductible: 4_900_000 })) !== shape(gen(CONSUME)));
    const UNUSED: [string, Any][] = [
      ["중증 통원", { severity: "critical", visit: "outpatient", tier: "hospital" }],
      ["중증 병의원급 입원", { severity: "critical", visit: "inpatient", tier: "clinic" }],
      ["비중증 입원(상급종합)", { severity: "non_critical", visit: "inpatient", tier: "hospital" }],
      ["비중증 입원(병의원급)", { severity: "non_critical", visit: "inpatient", tier: "clinic" }],
      ["비중증 통원", { severity: "non_critical", visit: "outpatient", tier: "clinic" }],
    ];
    for (const [l, base] of UNUSED) {
      check(`${l}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(gen(base)) === "OK");
      check(`${l}: 명시적 undefined는 미제공과 같다`,
        shape(gen({ ...base, priorAnnualDeductible: undefined })) === shape(gen(base)));
      for (const [vl, v] of VALUES.slice(0, 12)) {
        const x = gen({ ...base, priorAnnualDeductible: v });
        check(`${l} + ${vl} → pending(다회 C군과 같은 문구)`,
          isPending(x) && note0(x).startsWith(NOTE), `${statusOf(x)} ${note0(x).slice(0, 30)}`);
      }
      const p2 = probe({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", ...base }, "priorAnnualDeductible", () => 0, single);
      check(`${l}: 정확히 1회 읽는다`, p2.reads === 1, `reads=${p2.reads}`);
    }
    // 선행 안내 순서는 그대로다 — 미지정 축은 후보로 남긴다.
    check("종별 미지정(중증 입원): 종별 preflight 안내가 먼저다",
      note0(gen({ severity: "critical", visit: "inpatient", priorAnnualDeductible: 4_900_000 }))
        .startsWith("중증 비급여 입원: 의료기관 종별 미지정"));
    check("종별 미지정(중증 입원): 통원 가입금액도 종별 preflight가 먼저다",
      note0(gen({ severity: "critical", visit: "inpatient", perVisitCoverageLimit: 0 }))
        .startsWith("중증 비급여 입원: 의료기관 종별 미지정"));
    check("치료유형 미지정: 그 안내가 먼저다",
      note0(single({ amount: 10_000_000, coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "critical", priorAnnualDeductible: 0 }))
        .startsWith("비급여: 치료유형(nonBenefitItem) 미지정"));
    check("중증 구분 미지정: 그 안내가 먼저다",
      note0(gen({ visit: "inpatient", tier: "clinic", priorAnnualDeductible: 0 }))
        .startsWith("비급여: 중증/비중증(severity) 미지정"));
    check("레거시 priorAnnualPaid: 그 안내가 먼저다",
      note0(gen({ ...CONSUME, priorAnnualPaid: 0, priorAnnualDeductible: 0 })).includes("priorAnnualPaid"));
    // 변하는 getter — 첫 검증값 하나만 산식에 쓰인다.
    {
      let i = 0; const seq = [4_900_000, 0];
      const g = probe({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", ...CONSUME },
        "priorAnnualDeductible", () => seq[Math.min(i++, 1)], single);
      check("소비 조합 · 변하는 getter: 1회 · 첫 값(4,900,000)으로 계산",
        g.reads === 1 && shape(g.x) === shape(gen({ ...CONSUME, priorAnnualDeductible: 4_900_000 })), `reads=${g.reads}`);
    }
    // 종전에 예외로 끝나던 값이 이제 정상 거부로 끝난다(개선).
    check("bigint·Symbol: 종전 예외가 정상 거부로 바뀐다",
      isPending(gen({ ...UNUSED[0][1], priorAnnualDeductible: BigInt(5) }))
      && isPending(gen({ ...UNUSED[0][1], priorAnnualDeductible: Symbol("s") })));
  }

  // 급여는 누적 공제금액도 쓰지 않는다(둘 다 종전 접근자 0회).
  for (const [l, base] of [["급여 통원", BF_OUT], ["급여 입원", BF_IN]] as [string, Any][]) {
    for (const [vl, v] of VALUES.slice(0, 8)) {
      check(`${l} · priorAnnualDeductible + ${vl} → pending`, isPending(single({ ...base, priorAnnualDeductible: v })));
    }
    const p = probe(base, "priorAnnualDeductible", () => 0, single);
    check(`${l} · priorAnnualDeductible: 정확히 1회 읽는다`, p.reads === 1, `reads=${p.reads}`);
    // 목록 순서가 안내 우선순위다.
    check(`${l}: 두 stray 동시 → 목록 첫 키(priorAnnualDeductible)만 안내`,
      note0(single({ ...base, priorAnnualDeductible: 0, perVisitCoverageLimit: 0 })).includes("priorAnnualDeductible"),
      note0(single({ ...base, priorAnnualDeductible: 0, perVisitCoverageLimit: 0 })).slice(0, 40));
  }
  // 선행 preflight가 결과를 정하면 읽지 않는다.
  for (const [l, base] of [
    ["레거시 priorAnnualPaid", { ...NB_IN, priorAnnualPaid: 0 }],
    ["치료유형 미지정", { amount: 1_000_000, coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "critical" }],
    ["치료유형 비대상", { ...NB_IN, nonBenefitItem: "mri" }],
  ] as [string, Any][]) {
    const p = probe(base, "perVisitCoverageLimit", () => { throw new Error("boom"); }, single);
    check(`선행 차단(${l}): 접근자 0회이고 예외도 없다`, p.reads === 0 && !threw(p.x), `reads=${p.reads}`);
  }
  // 안내에 받은 값 자체를 싣지 않는다(이 파일에는 showValue가 없다).
  const src = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  check("단건 안내는 받은 값 대신 typeof만 싣는다",
    !/받은 값: \$\{/.test(code) && /받은 값의 형식: \$\{typeof/.test(code));
  check("단건 stray 목록이 두 축이고 순서가 고정돼 있다",
    /const BENEFIT_UNUSED_MONEY_KEYS = \["priorAnnualDeductible", "perVisitCoverageLimit"\] as const;/.test(code));
  check("단건 stray가 한 번만 읽는다",
    /const got: unknown = \(input as unknown as Record<string, unknown>\)\[key\];\n\s*if \(got === undefined\) continue;/.test(code)
    && /const strayPerVisit: unknown = \(input as \{ perVisitCoverageLimit\?: unknown \}\)\.perVisitCoverageLimit;/.test(code));
  check("500만원 상한 산식은 그대로다(읽는 자리만 바뀌었다)",
    /const priorDeductible = Math\.max\(0, \(rawDeductible as number \| undefined\) \?\? 0\);/.test(code)
    && /const remaining = Math\.max\(c\.annualDeductibleCap - priorDeductible, 0\);/.test(code));
  check("단건 비급여 미소비 조합의 누적 공제금액 stray를 막는다(G-30)",
    /const rawDeductible: unknown = \(input as \{ priorAnnualDeductible\?: unknown \}\)\.priorAnnualDeductible;/.test(code)
    && /input\.tier === undefined \|\| input\.tier === "hospital"/.test(code));
  // 타입 봉인.
  type Sealed2<T, K extends string> = K extends keyof T
    ? (T[K] extends undefined ? true : false) : false;
  const b1: Sealed2<Gen2026BenefitInput, "priorAnnualDeductible"> = true;
  const b2: Sealed2<Gen2026BenefitInput, "perVisitCoverageLimit"> = true;
  const b3: Sealed2<Gen2026NonBenefitInput, "priorAnnualDeductible"> = false;
  const b4: Sealed2<Gen2026NonBenefitInput, "perVisitCoverageLimit"> = false;
  check("단건 급여 타입 봉인 2종 · 비급여는 열려 있다", b1 && b2 && b3 === false && b4 === false);
}

console.log("\n[G-30] 12. 범위 밖 무회귀 — G-16~G-29 계약");
{
  check("4세대 정상 계산", statusOf(f21(G21["일반 비급여 통원"]())) === "OK"
    && statusOf(f21(G21["특약 도수치료"]())) === "OK");
  check("5세대 다회 정상 계산", statusOf(f26(G26M["비급여 통원"]())) === "OK"
    && statusOf(f26(G26M["급여 통원"]())) === "OK");
  check("별도 보장종목 정상 계산", Object.keys(G26I).every((n) => statusOf(fSI(G26I[n]())) === "OK"));
  check("일반 전환 정상 계산", Object.keys(ROUTED).every((n) => statusOf(fSI(ROUTED[n]())) === "OK"));
  check("상급병실료 정상 계산", statusOf(fRC(RC())) === "OK");
  // 진료비 계약(G-16·G-26·G-27)과 승인·횟수 축(G-28·G-29)은 그대로다.
  check("G-16/G-27 진료비 계약", isBlocked(f21(G21["일반 비급여 통원"]({ amounts: [-1] })), 0)
    || statusOf(f21(G21["일반 비급여 통원"]({ amounts: [-1] }))) === "PENDING_UNVERIFIED");
  check("G-28 승인 구간 축 계약",
    isRejected(fSI(ROUTED["일반전환 항암제"]({ priorAnnualTreatmentActCount: 5 }))));
  check("G-29 형제 두 축 계약",
    isRejected(fSI(G26I["중증 MRI"]({ priorAnnualCoveredCount: 0 })))
    && statusOf(fSI(G26I["중증 근골격계"]({ priorAnnualCoveredCount: 3 }))) === "OK");
  check("G-24 통원 가입금액은 통원에서 그대로 소비된다",
    shape(f26(G26M["비급여 통원"]({ outpatientCoverageLimit: 1 }))) !== shape(f26(G26M["비급여 통원"]())));
}

console.log(`\n[G-30 미사용 금액 축의 런타임 거부·타입 봉인] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
