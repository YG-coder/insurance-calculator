// G-31 — 5세대 **비금액 미사용 축**의 경로별 입력 계약 정렬.
//   G-16~G-29가 활성 축의 값 검증과 단일 읽기를 닫았고, G-30이 미사용 **금액** 축을 닫았다.
//   여기서는 이름에 금액이 들어가지 않는 세 축이 쓰이지 않는 경로에 실려 왔을 때의 계약을 세운다.
//
// 전수 행렬 (기준선 `daa7785`, UI 미경유 엔진 직접 호출 + 접근자 계수).
// | 진입점 | 경로 | 필드 | 종전 런타임 | 종전 접근자 |
// | calc2026 | 급여 입원·통원 | severity | **조용한 폐기** | **0회** |
// | calc2026 | 급여 입원·통원 | nonBenefitItem | **조용한 폐기** | **0회** |
// | calc2026 | 급여 **입원** | nhisCoinsuranceRate | **조용한 폐기** | **0회** |
// | calc2026 | 비급여 5경로 | nhisCoinsuranceRate | **조용한 폐기** | **0회** |
// | calculateMany2026 | 급여 입원·통원 | severity·nonBenefitItem | **조용한 폐기** | **0회** |
// | calculateMany2026 | 급여 **입원** | nhisCoinsuranceRate | **읽고 무시** | 행당 1회 |
// | calculateMany2026 | 급여 **통원** | nhisCoinsuranceRate | 소비하되 **행마다 읽기** | 행당 1회 |
// | calculateMany2026 | 비급여 4경로 | nhisCoinsuranceRate | **조용한 폐기** | **0회** |
// | calculateGen2026Item | 별도 4 + 일반 전환 3 | nhisCoinsuranceRate·nonBenefitItem | **조용한 폐기** | **0회** |
// | calculateRoomCharge2026 | 상급병실료 | nhisCoinsuranceRate | **조용한 폐기** | **0회** |
// | calculateRoomCharge2026 | 상급병실료 | nonBenefitItem | 이미 명시적 거부 | 1회 |
//
// ⚠ 근거. `nhisCoinsuranceRate`는 국민건강보험이 정한 **급여** 항목의 본인부담률이라
//   비급여에는 대응 축이 없고, 급여 입원은 약관이 정률 20%로 고정해 이 값을 읽지 않는다.
//   `severity`(중증/비중증)와 `nonBenefitItem`(치료유형)은 **비급여 특별약관**이 만든 구분이라
//   급여에는 두 구분이 모두 없다.
//
// 목표 계약: `undefined`는 미제공과 동일 / 그 밖은 숫자 `0`도 포함해 명시적 거부 /
//   진입점의 기존 실패 반환 계약 유지(`pending()` 단건 · `blocked()` 다회 — 진료비 합계 보존 ·
//   `rejected()` 항목 — 총액 0) / 선행 preflight·경로 불일치가 결과를 정한 경로에서는 읽지 않음 /
//   판정 지점에서 정확히 한 번 읽음 / 안내는 각 파일의 기존 안전 표시 계약을 따름 /
//   계산식·한도·공제·횟수·HOLD·금액 축 계약은 변경하지 않음.
import { readFileSync } from "node:fs";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { calculateRoomCharge2026 } from "../src/lib/insurance/engine/roomCharge2026";
import {
  Gen2026BenefitInput, Gen2026MultiBenefitInput, Gen2026MultiNonBenefitInput,
  Gen2026NonBenefitInput, Gen2026CriticalMriInput, Gen2026RoomChargeInput,
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
  x.r.route, x.r.status, x.r.amount, x.r.ownPay, x.r.insurancePay,
  x.r.totalAmount, x.r.totalOwnPay, x.r.totalInsurancePay,
  x.r.appliedCaps, x.r.notes, (x.r.lines as unknown[] ?? []).length,
]);
/** 단건의 차단 계약 — 진료비는 보존하고 금액을 만들지 않는다. */
const isPending = (x: Caught, amount: number) => !threw(x)
  && x.r.status === "PENDING_UNVERIFIED" && x.r.amount === amount
  && x.r.ownPay === null && x.r.insurancePay === null;
/** 다회의 차단 계약 — 검증된 진료비 합계를 보존하고 행·후보 보험금을 노출하지 않는다. */
const isBlocked = (x: Caught, total: number) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.totalAmount === total && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0
  && Array.isArray(x.r.appliedCaps) && (x.r.appliedCaps as unknown[]).length === 0;
/** 항목의 거부 계약 — 총액을 만들지 않는다. */
const isRejected = (x: Caught) => !threw(x) && x.r.route === "rejected"
  && x.r.status === "PENDING_UNVERIFIED" && x.r.totalAmount === 0
  && x.r.totalOwnPay === null && x.r.totalInsurancePay === null
  && (x.r.lines as unknown[]).length === 0;

const AMT = 300_000, BIG = 3_000_000;
const circular: Any = {}; circular.self = circular;
/** 값 격자 — 브라우저가 만들 수 없는 값도 **엔진 직접 호출**로만 넣는다(화면 주입 아님). */
const VALUES: [string, unknown][] = [
  ["0", 0], ["숫자", 0.2], ["문자열", "critical"], ["빈 문자열", ""], ["null", null],
  ["false", false], ["true", true], ["객체", { a: 1 }], ["배열", [1]], ["NaN", NaN],
  ["Infinity", Infinity], ["-1", -1], ["bigint", 10n], ["Symbol", Symbol("s")], ["순환 참조", circular],
];
const f1 = (i: Any) => wrap(() => calc2026(i as unknown as Gen2026BenefitInput));
const fM = (i: Any) => wrap(() => calculateMany2026(i as unknown as Gen2026MultiBenefitInput));
const fI = (i: Any) => wrap(() => calculateGen2026Item(i as unknown as Gen2026CriticalMriInput));
const fR = (i: Any) => wrap(() => calculateRoomCharge2026(i as unknown as Gen2026RoomChargeInput));

// ── 경로 픽스처 ──────────────────────────────────────────────────────
const S: Record<string, (e?: Any) => Any> = {
  "단건 급여 통원": (e = {}) => ({ amount: AMT, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2, ...e }),
  "단건 급여 입원": (e = {}) => ({ amount: AMT, coverage: "benefit", visit: "inpatient", ...e }),
};
const SNB: Record<string, (e?: Any) => Any> = {
  "단건 비급여 중증 통원": (e = {}) => ({ amount: AMT, coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general", ...e }),
  "단건 비급여 비중증 통원": (e = {}) => ({ amount: AMT, coverage: "non_benefit", visit: "outpatient", severity: "non_critical", nonBenefitItem: "general", ...e }),
  "단건 비급여 중증 입원(상급)": (e = {}) => ({ amount: AMT, coverage: "non_benefit", visit: "inpatient", tier: "hospital", severity: "critical", nonBenefitItem: "general", ...e }),
  "단건 비급여 중증 입원(의원)": (e = {}) => ({ amount: AMT, coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "critical", nonBenefitItem: "general", ...e }),
  "단건 비급여 비중증 입원": (e = {}) => ({ amount: AMT, coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "non_critical", nonBenefitItem: "general", ...e }),
};
const M: Record<string, (e?: Any) => Any> = {
  "다회 급여 통원": (e = {}) => ({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.2, amounts: [AMT], ...e }),
  "다회 급여 입원": (e = {}) => ({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [AMT], ...e }),
};
const MNB: Record<string, (e?: Any) => Any> = {
  "다회 비급여 중증 통원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "critical", nonBenefitItem: "general", amounts: [AMT], priorAnnualOutpatientVisits: 0, ...e }),
  "다회 비급여 비중증 통원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "outpatient", severity: "non_critical", nonBenefitItem: "general", amounts: [AMT], priorAnnualOutpatientDays: 0, ...e }),
  "다회 비급여 중증 입원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "hospital", severity: "critical", nonBenefitItem: "general", amounts: [BIG], ...e }),
  "다회 비급여 비중증 입원": (e = {}) => ({ cause: "disease", coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "non_critical", nonBenefitItem: "general", amounts: [AMT], ...e }),
};
const I: Record<string, (e?: Any) => Any> = {
  "중증 근골격계": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw", lines: [{ amount: AMT, visit: "outpatient" }], priorAnnualTreatmentActCount: 0, ...e }),
  "중증 주사료": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection", injectionPurpose: "general", lines: [{ amount: AMT, visit: "outpatient" }], ...e }),
  "중증 MRI": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines: [{ amount: BIG, visit: "inpatient", tier: "hospital" }], ...e }),
  "비중증 MRI": (e = {}) => ({ route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri", lines: [{ amount: AMT, visit: "outpatient" }], ...e }),
  "일반 전환 항암주사": (e = {}) => ({ route: "general", coverage: "non_benefit", cause: "disease", severity: "critical", item: "injection", injectionPurpose: "anticancer", amounts: [AMT], visit: "outpatient", tier: "clinic", priorAnnualOutpatientVisits: 0, ...e }),
  "일반 전환 비중증 근골격": (e = {}) => ({ route: "general", coverage: "non_benefit", cause: "disease", severity: "non_critical", item: "musculoskeletal_esw", amounts: [AMT], visit: "outpatient", tier: "clinic", priorAnnualOutpatientDays: 0, ...e }),
  "일반 전환 비중증 주사료": (e = {}) => ({ route: "general", coverage: "non_benefit", cause: "disease", severity: "non_critical", item: "injection", amounts: [AMT], visit: "outpatient", tier: "clinic", priorAnnualOutpatientDays: 0, ...e }),
};
const ROOM = (e: Any = {}) => ({ route: "room_charge", coverage: "non_benefit", cause: "disease", severity: "critical", stays: [{ roomChargeTotal: 400_000, inpatientDays: 2 }], ...e });

console.log("\n[G-31] 1. 단건 급여 — severity·nonBenefitItem은 쓰이지 않는다");
{
  for (const [name, mk] of Object.entries(S)) {
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(f1(mk())) === "OK", statusOf(f1(mk())));
    for (const key of ["severity", "nonBenefitItem"]) {
      check(`${name} · ${key}: 명시적 undefined는 미제공과 같다`,
        shape(f1(mk({ [key]: undefined }))) === shape(f1(mk())));
      for (const [label, v] of VALUES) {
        const x = f1(mk({ [key]: v }));
        check(`${name} · ${key} + ${label} → pending`, isPending(x, AMT)
          && note0(x).includes(key) && note0(x).includes("비급여 특별약관이 만든 구분"),
          `${statusOf(x)} ${note0(x).slice(0, 34)}`);
      }
    }
    for (const key of ["severity", "nonBenefitItem"]) {
      let reads = 0;
      const o: Any = mk();
      Object.defineProperty(o, key, { get() { reads++; return 0; }, enumerable: true, configurable: true });
      const rk = f1(o);
      check(`${name} · ${key}를 정확히 1회만 읽는다`, reads === 1 && isPending(rk, AMT), `reads=${reads}`);
    }
    // 목록 순서가 안내 우선순위다.
    const both = f1(mk({ severity: 0, nonBenefitItem: 0 }));
    check(`${name}: 두 stray 동시 → 목록 첫 키(severity)만 안내`,
      note0(both).includes("severity") && !note0(both).includes("nonBenefitItem"), note0(both).slice(0, 40));
  }
}

console.log("\n[G-31] 2. 단건 급여 입원 — 건강보험 본인부담률은 쓰이지 않는다");
{
  const mk = S["단건 급여 입원"];
  check("입원: 축을 싣지 않으면 종전대로 계산한다", statusOf(f1(mk())) === "OK");
  check("입원: 명시적 undefined는 미제공과 같다",
    shape(f1(mk({ nhisCoinsuranceRate: undefined }))) === shape(f1(mk())));
  for (const [label, v] of VALUES) {
    const x = f1(mk({ nhisCoinsuranceRate: v }));
    check(`입원 · nhis + ${label} → pending`, isPending(x, AMT)
      && note0(x).startsWith("건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원에서만"),
      `${statusOf(x)} ${note0(x).slice(0, 34)}`);
  }
  // 통원은 소비 경로다 — 건드리지 않는다.
  const okOut = f1(S["단건 급여 통원"]({ nhisCoinsuranceRate: 0.3 }));
  check("통원은 소비 경로라 그대로 계산한다", statusOf(okOut) === "OK" && !threw(okOut) && okOut.r.ownPay === 90_000,
    statusOf(okOut));
  const zeroOut = f1(S["단건 급여 통원"]({ nhisCoinsuranceRate: 0 }));
  check("통원의 숫자 0은 유효값이라 20% 하한이 그대로 적용된다",
    statusOf(zeroOut) === "OK" && !threw(zeroOut) && zeroOut.r.ownPay === 60_000, statusOf(zeroOut));
  // 금액 축 안내가 먼저다(G-30 우선순위 보존).
  check("급여 금액 축 stray가 비금액 stray보다 앞선다",
    note0(f1(mk({ priorAnnualDeductible: 0, severity: 0 }))).includes("priorAnnualDeductible"));
  check("레거시 priorAnnualPaid가 모든 stray보다 앞선다",
    note0(f1(mk({ priorAnnualPaid: 0, severity: 0, nhisCoinsuranceRate: 0 }))).includes("priorAnnualPaid"));
}

console.log("\n[G-31] 3. 단건 비급여 — 건강보험 본인부담률은 쓰이지 않는다");
{
  for (const [name, mk] of Object.entries(SNB)) {
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(f1(mk())) === "OK", statusOf(f1(mk())));
    check(`${name} · 명시적 undefined는 미제공과 같다`,
      shape(f1(mk({ nhisCoinsuranceRate: undefined }))) === shape(f1(mk())));
    for (const [label, v] of VALUES) {
      const x = f1(mk({ nhisCoinsuranceRate: v }));
      check(`${name} · nhis + ${label} → pending`, isPending(x, AMT)
        && note0(x).startsWith("건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원 계산에만"),
        `${statusOf(x)} ${note0(x).slice(0, 34)}`);
    }
  }
  // 선행 preflight 순서 보존.
  const noItem = f1({ amount: AMT, coverage: "non_benefit", visit: "outpatient", severity: "critical", nhisCoinsuranceRate: 0.2 });
  check("치료유형 미지정 안내가 먼저다", note0(noItem).includes("치료유형(nonBenefitItem) 미지정"), note0(noItem).slice(0, 34));
  const noSev = f1({ amount: AMT, coverage: "non_benefit", visit: "outpatient", nonBenefitItem: "general", nhisCoinsuranceRate: 0.2 });
  check("중증 구분 미지정 안내가 먼저다", note0(noSev).includes("중증/비중증(severity) 미지정"), note0(noSev).slice(0, 34));
  for (const [sev, msg] of [["critical", "중증 비급여 입원: 의료기관 종별 미지정"], ["non_critical", "비중증 비급여 입원: 의료기관 종별 미지정"]] as const) {
    const noTier = f1({ amount: AMT, coverage: "non_benefit", visit: "inpatient", severity: sev, nonBenefitItem: "general", nhisCoinsuranceRate: 0.2 });
    check(`종별 미지정(${sev})은 후보로 남아 종별 안내가 먼저다`, note0(noTier).includes(msg), note0(noTier).slice(0, 34));
  }
  // 종별을 고르면 같은 입력에서 이 안내가 나온다 — 후보로 남긴다는 계약의 뒷면.
  const afterTier = f1(SNB["단건 비급여 중증 입원(상급)"]({ nhisCoinsuranceRate: 0.2 }));
  check("종별을 고른 뒤에는 nhis 안내가 나온다", note0(afterTier).startsWith("건강보험 본인부담률"), note0(afterTier).slice(0, 34));
  // ── 접근자: 판정 지점에서 정확히 한 번 읽는다 ──
  for (const [name, mk] of Object.entries(SNB)) {
    let reads = 0;
    const o: Any = mk();
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { reads++; return 0.2; }, enumerable: true, configurable: true });
    const r = f1(o);
    check(`${name}: nhis를 정확히 1회만 읽는다`, reads === 1 && isPending(r, AMT), `reads=${reads}`);
  }
  {
    let reads = 0;
    const o: Any = SNB["단건 비급여 중증 입원(상급)"]();
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { reads++; return undefined; }, enumerable: true, configurable: true });
    const ru = f1(o);
    check("미제공(undefined)도 1회만 읽고 계산이 이어진다", reads === 1 && statusOf(ru) === "OK", `reads=${reads}`);
  }
  {
    // 종별 미지정은 후보라 이 이름을 **읽지 않는다** — 선행 preflight가 결과를 정한다.
    let reads = 0;
    const o: Any = { amount: AMT, coverage: "non_benefit", visit: "inpatient", severity: "critical", nonBenefitItem: "general" };
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { reads++; return 0.2; }, enumerable: true, configurable: true });
    const r = f1(o);
    check("종별 미지정에서는 nhis getter를 읽지 않는다",
      reads === 0 && note0(r).includes("의료기관 종별 미지정"), `reads=${reads}`);
  }
  // 금액 축 stray가 앞선다(G-30 우선순위 보존).
  check("비급여 금액 축 stray가 nhis stray보다 앞선다",
    note0(f1(SNB["단건 비급여 비중증 입원"]({ perVisitCoverageLimit: 0, nhisCoinsuranceRate: 0 }))).includes("perVisitCoverageLimit"));
}

console.log("\n[G-31] 4. 다회 급여 — 세 축의 계약과 단일 읽기");
{
  for (const [name, mk] of Object.entries(M)) {
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(fM(mk())) === "OK", statusOf(fM(mk())));
    for (const key of ["severity", "nonBenefitItem"]) {
      check(`${name} · ${key}: 명시적 undefined는 미제공과 같다`,
        shape(fM(mk({ [key]: undefined }))) === shape(fM(mk())));
      for (const [label, v] of VALUES) {
        const x = fM(mk({ [key]: v }));
        check(`${name} · ${key} + ${label} → blocked`, isBlocked(x, AMT) && note0(x).includes(key),
          `${statusOf(x)} ${note0(x).slice(0, 30)}`);
      }
    }
    check(`${name}: 통원 카운터 stray가 앞선다(종전 우선순위)`,
      note0(fM(mk({ priorAnnualOutpatientDays: 0, severity: 0 })))
        .startsWith("통원 횟수·일수 카운터는 비급여 통원 전용입니다"));
    check(`${name}: 금액 축 stray가 비금액 stray보다 앞선다(G-30 우선순위)`,
      note0(fM(mk({ annualCoverageLimit: 0, severity: 0 }))).includes("annualCoverageLimit"));
  }
  const inpMk = M["다회 급여 입원"];
  for (const [label, v] of VALUES) {
    const x = fM(inpMk({ nhisCoinsuranceRate: v }));
    check(`다회 급여 입원 · nhis + ${label} → blocked`, isBlocked(x, AMT)
      && note0(x).startsWith("건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원에서만"),
      `${statusOf(x)} ${note0(x).slice(0, 30)}`);
  }
  check("다회 급여 통원은 소비 경로라 그대로 계산한다",
    statusOf(fM(M["다회 급여 통원"]({ nhisCoinsuranceRate: 0.3 }))) === "OK");
  // ── 단일 읽기: 행 수와 무관하게 정확히 1회 ──
  for (const n of [1, 2, 3, 5]) {
    let reads = 0;
    const o: Any = { cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: Array(n).fill(AMT) };
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { reads++; return 0.2; }, enumerable: true, configurable: true });
    const r = fM(o);
    check(`다회 급여 통원 ${n}행: nhis를 정확히 1회만 읽는다`, reads === 1 && statusOf(r) === "OK", `reads=${reads}`);
  }
  // 변하는 getter에서도 모든 행이 같은 값을 쓴다.
  {
    const seq = [0.2, 0.9, 0.5]; let i = 0;
    const o: Any = { cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [AMT, AMT, AMT] };
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { return seq[i++ % seq.length]; }, enumerable: true, configurable: true });
    const varied = fM(o);
    const fixed = fM({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [AMT, AMT, AMT], nhisCoinsuranceRate: 0.2 });
    check("변하는 getter도 첫 값으로 전 행이 계산된다(행마다 다른 요율 없음)",
      !threw(varied) && !threw(fixed) && varied.r.totalOwnPay === fixed.r.totalOwnPay,
      threw(varied) ? varied.threw : String(varied.r.totalOwnPay));
  }
  // 던지는 getter는 선행 stray가 결과를 정하면 읽히지 않는다.
  {
    const o: Any = { cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", amounts: [AMT], annualCoverageLimit: 0 };
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { throw new Error("BOOM"); }, enumerable: true, configurable: true });
    const r = fM(o);
    check("선행 금액 축 stray가 확정되면 nhis getter를 읽지 않는다",
      isBlocked(r, AMT) && note0(r).includes("annualCoverageLimit"), statusOf(r));
  }
}

console.log("\n[G-31] 5. 다회 비급여 — 건강보험 본인부담률은 쓰이지 않는다");
{
  for (const [name, mk] of Object.entries(MNB)) {
    const total = name.includes("중증 입원") && !name.includes("비중증") ? BIG : AMT;
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(fM(mk())) === "OK", statusOf(fM(mk())));
    check(`${name} · 명시적 undefined는 미제공과 같다`,
      shape(fM(mk({ nhisCoinsuranceRate: undefined }))) === shape(fM(mk())));
    for (const [label, v] of VALUES) {
      const x = fM(mk({ nhisCoinsuranceRate: v }));
      check(`${name} · nhis + ${label} → blocked`, isBlocked(x, total)
        && note0(x).startsWith("건강보험 본인부담률(nhisCoinsuranceRate)은 급여 통원 계산에만"),
        `${statusOf(x)} ${note0(x).slice(0, 30)}`);
    }
  }
  check("C군(누적 공제금액) 안내가 nhis보다 앞선다",
    note0(fM(MNB["다회 비급여 비중증 입원"]({ priorAnnualDeductible: 0, nhisCoinsuranceRate: 0 })))
      .includes("priorAnnualDeductible"));
  check("D군(통원 가입금액) 안내가 nhis보다 앞선다",
    note0(fM(MNB["다회 비급여 중증 입원"]({ outpatientCoverageLimit: 0, nhisCoinsuranceRate: 0 })))
      .startsWith("통원 가입금액(outpatientCoverageLimit)"));
}

console.log("\n[G-31] 6. 항목 진입점 — 두 축 모두 어느 경로에서도 쓰이지 않는다");
{
  for (const [name, mk] of Object.entries(I)) {
    check(`${name}: 축을 싣지 않으면 종전대로 계산한다`, statusOf(fI(mk())) === "OK", statusOf(fI(mk())));
    for (const key of ["nhisCoinsuranceRate", "nonBenefitItem"]) {
      check(`${name} · ${key}: 명시적 undefined는 미제공과 같다`,
        shape(fI(mk({ [key]: undefined }))) === shape(fI(mk())));
      for (const [label, v] of VALUES) {
        const x = fI(mk({ [key]: v }));
        check(`${name} · ${key} + ${label} → rejected`, isRejected(x) && notesOf(x).includes(key),
          `${statusOf(x)} ${note0(x).slice(0, 30)}`);
      }
    }
    const both = fI(mk({ nhisCoinsuranceRate: 0, nonBenefitItem: 0 }));
    check(`${name}: 두 stray 동시 → 목록 첫 키(nhisCoinsuranceRate)만 안내`,
      note0(both).includes("nhisCoinsuranceRate") && !note0(both).includes("치료유형(nonBenefitItem)"),
      note0(both).slice(0, 40));
  }
  // 경로 불일치가 먼저다(G-28·G-29의 계약).
  const wrongRoute = fI({ ...I["중증 근골격계"](), route: "general", nhisCoinsuranceRate: 0.2 });
  check("경로 불일치 안내가 stray보다 먼저다", note0(wrongRoute).includes("경로에서 계산해야 합니다"), note0(wrongRoute).slice(0, 40));
  // 경로 불일치가 확정되면 getter를 읽지 않는다.
  {
    let reads = 0;
    const o: Any = { ...I["중증 근골격계"](), route: "general" };
    Object.defineProperty(o, "nhisCoinsuranceRate", { get() { reads++; return 0.2; }, enumerable: true, configurable: true });
    const r = fI(o);
    check("경로 불일치가 확정되면 nhis getter를 읽지 않는다", reads === 0 && isRejected(r), `reads=${reads}`);
  }
  // 금액 축 stray가 먼저다(G-30 우선순위 보존).
  check("별도 보장종목 금액 축 stray가 비금액 stray보다 앞선다",
    note0(fI(I["중증 MRI"]({ annualCoverageLimit: 0, nhisCoinsuranceRate: 0 }))).includes("annualCoverageLimit"));
  // 판정 지점에서 정확히 한 번 읽는다.
  for (const key of ["nhisCoinsuranceRate", "nonBenefitItem"]) {
    let reads = 0;
    const o: Any = I["중증 MRI"]();
    Object.defineProperty(o, key, { get() { reads++; return 0; }, enumerable: true, configurable: true });
    const r = fI(o);
    check(`항목 · ${key}를 정확히 1회만 읽는다`, reads === 1 && isRejected(r), `reads=${reads}`);
  }
}

console.log("\n[G-31] 7. 상급병실료 — 목록 맨 끝이라 기존 우선순위가 유지된다");
{
  check("축을 싣지 않으면 종전대로 계산한다", statusOf(fR(ROOM())) === "OK", statusOf(fR(ROOM())));
  check("명시적 undefined는 미제공과 같다", shape(fR(ROOM({ nhisCoinsuranceRate: undefined }))) === shape(fR(ROOM())));
  for (const [label, v] of VALUES) {
    const x = fR(ROOM({ nhisCoinsuranceRate: v }));
    check(`상급병실료 · nhis + ${label} → rejected`, isRejected(x)
      && note0(x).includes("쓰이지 않는 입력(nhisCoinsuranceRate)"), `${statusOf(x)} ${note0(x).slice(0, 30)}`);
  }
  check("기존 nonBenefitItem 안내가 nhis보다 앞선다(목록 순서)",
    note0(fR(ROOM({ nonBenefitItem: "general", nhisCoinsuranceRate: 0.2 }))).includes("(nonBenefitItem)"));
  check("기존 첫 키(visit) 안내가 여전히 맨 앞이다",
    note0(fR(ROOM({ visit: "inpatient", nhisCoinsuranceRate: 0.2 }))).includes("(visit)"));
}

console.log("\n[G-31] 8. 반환 계약 — 세 진입점을 섞지 않는다");
{
  const a = f1(S["단건 급여 입원"]({ severity: 0 }));
  check("단건은 pending — 진료비 보존, 금액 없음, route 키 없음",
    isPending(a, AMT) && !threw(a) && a.r.route === undefined && a.r.generation === "2026", statusOf(a));
  const b = fM(M["다회 급여 입원"]({ severity: 0 }));
  check("다회는 blocked — 검증된 진료비 합계 보존, 행 없음", isBlocked(b, AMT), statusOf(b));
  const c = fI(I["중증 MRI"]({ nhisCoinsuranceRate: 0 }));
  check("항목은 rejected — 총액 0, route가 'rejected'", isRejected(c), statusOf(c));
  const d = fR(ROOM({ nhisCoinsuranceRate: 0 }));
  check("상급병실료도 rejected — 총액 0", isRejected(d), statusOf(d));
  // 다회의 합계 보존은 행 수·금액과 무관하게 유지된다.
  const multi = fM({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [100, 200, 300], severity: 0 });
  check("다회 합계 보존: 여러 행의 합계를 그대로 싣는다", isBlocked(multi, 600), statusOf(multi));
}

console.log("\n[G-31] 9. 안전 표시 — 위험한 값에서도 예외가 아니라 안내로 끝난다");
{
  for (const [label, v] of [["bigint", 10n], ["Symbol", Symbol("s")], ["순환 참조", circular],
    ["toString이 던지는 객체", { toString() { throw new Error("x"); }, toJSON() { throw new Error("y"); } }]] as [string, unknown][]) {
    check(`단건 급여 · severity ${label} → 예외 없이 pending`, isPending(f1(S["단건 급여 입원"]({ severity: v })), AMT));
    check(`다회 급여 · severity ${label} → 예외 없이 blocked`, isBlocked(fM(M["다회 급여 입원"]({ severity: v })), AMT));
    check(`항목 · nhis ${label} → 예외 없이 rejected`, isRejected(fI(I["중증 MRI"]({ nhisCoinsuranceRate: v }))));
    check(`상급병실료 · nhis ${label} → 예외 없이 rejected`, isRejected(fR(ROOM({ nhisCoinsuranceRate: v }))));
  }
  // 던지는 getter는 읽는 순간 예외가 나는 것이 정상이다 — 읽지 않는 경로에서만 조용하다.
  const src = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("generation2026은 받은 값 자체를 문자열로 만들지 않는다(typeof만)",
    !/받은 값: \$\{(?!typeof)/.test(src));
}

console.log("\n[G-31] 10. 구조 — 목록을 합치지 않고, 각 키를 한 번만 읽는다");
{
  const gen = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const mul = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const itm = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const room = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
  check("generation2026: 비금액 목록이 금액 목록과 분리돼 있다",
    /const BENEFIT_UNUSED_NON_MONEY_KEYS = \["severity", "nonBenefitItem"\] as const;/.test(gen)
    && /const BENEFIT_UNUSED_MONEY_KEYS = \["priorAnnualDeductible", "perVisitCoverageLimit"\] as const;/.test(gen));
  check("generation2026: 비금액 루프가 금액 루프 뒤다",
    gen.indexOf("BENEFIT_UNUSED_NON_MONEY_KEYS)") > gen.indexOf("BENEFIT_UNUSED_MONEY_KEYS)"));
  check("multiClaim2026: 비금액 목록이 분리돼 있다",
    /const BENEFIT_UNUSED_NON_MONEY_KEYS = \["severity", "nonBenefitItem"\] as const;/.test(mul));
  check("multiClaim2026: SPECIAL_ITEM_ONLY_KEYS에 severity·nonBenefitItem을 넣지 않는다",
    !/const SPECIAL_ITEM_ONLY_KEYS = \[[\s\S]*?"(severity|nonBenefitItem)"[\s\S]*?\] as const;/.test(mul));
  check("multiClaim2026: nhis를 행 루프에서 다시 읽지 않는다",
    !/nhisCoinsuranceRate: bf\?\.nhisCoinsuranceRate/.test(mul)
    && /nhisCoinsuranceRate: checkedNhis as number \| undefined/.test(mul));
  check("multiClaim2026: nhis를 한 자리에서만 읽는다",
    (mul.match(/readCount\((bf|nb), "nhisCoinsuranceRate"\)/g) ?? []).length === 2);
  check("specialItem2026: 두 경로 공통 목록이 route로 좁혀지지 않는다",
    /const ITEM_UNUSED_NON_MONEY_KEYS = \["nhisCoinsuranceRate", "nonBenefitItem"\] as const;/.test(itm)
    && /\n  for \(const key of ITEM_UNUSED_NON_MONEY_KEYS\) \{/.test(itm));
  check("specialItem2026: 경로 대조 뒤다",
    itm.indexOf("for (const key of ITEM_UNUSED_NON_MONEY_KEYS)") > itm.indexOf("if (expectedRoute !== raw.route) {"));
  check("roomCharge2026: nhisCoinsuranceRate가 UNUSED_KEYS 맨 끝이다",
    /"nhisCoinsuranceRate",\s*\n\] as const;/.test(room));
  for (const [file, body] of [["generation2026", gen], ["multiClaim2026", mul], ["specialItem2026", itm]] as const) {
    check(`${file}: in 연산자가 아니라 !== undefined로 본다`,
      !/"(severity|nonBenefitItem|nhisCoinsuranceRate)" in /.test(body));
  }
}

console.log("\n[G-31] 11. 타입 봉인 — 표현 가능한 경로는 ?: never로 닫는다");
{
  /** 엄격판: **미선언도 실패**로 본다(기존 느슨한 Sealed의 구멍을 되살리지 않는다). */
  type Sealed<T, K extends string> = K extends keyof T ? ([T[K]] extends [undefined] ? true : false) : false;
  // ⚠ 인자를 **쓴다** — 봉인 판정은 컴파일 시점의 타입 인자에서 나오고, 런타임 값은 그
  //   판정을 그대로 돌려주는 리터럴이다. 값을 되돌려 주어야 tsx 실행에서도 이 절이 의미를
  //   갖고, 미사용 인자로 ESLint 경고가 나지도 않는다.
  const sealed = <T, K extends string>(v: Sealed<T, K>): boolean => v as unknown as boolean;
  check("단건 급여: severity가 봉인됐다", sealed<Gen2026BenefitInput, "severity">(true));
  check("단건 급여: nonBenefitItem이 봉인됐다", sealed<Gen2026BenefitInput, "nonBenefitItem">(true));
  check("단건 비급여: nhisCoinsuranceRate가 봉인됐다", sealed<Gen2026NonBenefitInput, "nhisCoinsuranceRate">(true));
  check("다회 급여: severity가 봉인됐다", sealed<Gen2026MultiBenefitInput, "severity">(true));
  check("다회 급여: nonBenefitItem이 봉인됐다", sealed<Gen2026MultiBenefitInput, "nonBenefitItem">(true));
  check("다회 비급여: nhisCoinsuranceRate가 봉인됐다", sealed<Gen2026MultiNonBenefitInput, "nhisCoinsuranceRate">(true));
  check("별도 보장종목: nhisCoinsuranceRate가 봉인됐다", sealed<Gen2026CriticalMriInput, "nhisCoinsuranceRate">(true));
  check("별도 보장종목: nonBenefitItem이 봉인됐다", sealed<Gen2026CriticalMriInput, "nonBenefitItem">(true));
  check("상급병실료: nhisCoinsuranceRate가 봉인됐다", sealed<Gen2026RoomChargeInput, "nhisCoinsuranceRate">(true));
  check("상급병실료: nonBenefitItem이 봉인됐다", sealed<Gen2026RoomChargeInput, "nonBenefitItem">(true));
  // 소비 경로는 봉인되지 않아야 한다 — 과잉 봉인 방지.
  check("단건 급여 통원의 nhisCoinsuranceRate는 봉인하지 않는다", !sealed<Gen2026BenefitInput, "nhisCoinsuranceRate">(false));
  check("단건 비급여의 severity는 봉인하지 않는다", !sealed<Gen2026NonBenefitInput, "severity">(false));
  check("다회 비급여의 severity는 봉인하지 않는다", !sealed<Gen2026MultiNonBenefitInput, "severity">(false));
  // ⚠ 급여 **입원**의 nhisCoinsuranceRate는 타입으로 닫지 못한다(유니온을 visit으로 쪼개면
  //   호출부가 visit을 변수로 넘겨 정상 화면이 as 없이 컴파일되지 않는다). 런타임만 닫았다.
  const src = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  check("타입으로 닫지 못한 이유가 소스에 기록돼 있다",
    src.includes("급여 **통원**은 소비하고 **입원**은"));
}

console.log("\n[G-31] 12. 화면 — 세 축이 미사용 경로에 실리지 않는다");
{
  const ui = [
    readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8"),
    readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8"),
  ];
  for (const [i, name] of [[0, "단건"], [1, "다회"]] as const) {
    check(`${name} 화면: 본인부담률 소비 조건이 급여 통원으로 게이트돼 있다`,
      /const usesNhisRate = coverage === "benefit" && visit === "outpatient";/.test(ui[i]));
    check(`${name} 화면: 미소비 경로에서 undefined로 보낸다`,
      /!usesNhisRate \|\| nhisRate === "" \? undefined :/.test(ui[i]));
    check(`${name} 화면: 급여 분기에 severity·nonBenefitItem을 싣지 않는다`,
      !/coverage: "benefit",[\s\S]{0,400}?(severity|nonBenefitItem):/.test(ui[i]));
  }
}

console.log(`\n[G-31 미사용 비금액 축의 경로별 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
