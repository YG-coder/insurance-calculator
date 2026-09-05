// G-14B — 5세대 별도 보장종목 진입점의 두 입력 축을 엄격 검증한다.
//   대상: priorAnnualInpatientDeductible(제5조⑤ 500만 원 pool) / priorAnnualCoveredCount(<표1> 연 50회)
//
// 종전 동작(기준선 ecf990d 직접 호출로 실측):
//   두 필드 모두 진입점 검증이 없어 `nonNegInt()`가 문자열·null·객체·배열·불리언·음수·
//   NaN·±Infinity를 **조용히 0**으로 만들고, 소수는 floor하며, 안전 정수 초과를 그대로 썼다.
//   방향이 "이미 4,900,000 썼다"·"이미 50회 썼다" → "한 번도 안 썼다"라 **보험금 과다 산출**이다.
//   또 쓰이지 않는 보장종목·경로에 실려도 값이 0이든 아니든 그대로 통과했다.
//   같은 파일의 priorAnnualTreatmentActCount·통원 카운터·4세대 riderVisits는 이미 전부 막고
//   있었고, 상급병실료만 UNUSED_KEYS로 막고 있어 **한 파일 안에서 계약이 갈려 있었다.**
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 두 필드의 값 검증과 미사용 축 거부, types.ts의 경로별 `?: never` 봉인.
//   - 하지 않는다: undefined의 의미 변경(종전대로 0에서 시작), 명시적 0 거부,
//     한도 초과 유효값 절삭, MRI에 횟수 축 신설, pool의 묶음 단위 소비로의 변경,
//     G-14A pool 범위 HOLD·지급 0원 HOLD 3종·상급병실료 HOLD·규칙값·산식·UI 변경,
//     multiClaim2026.ts의 추가 stray 가드(후속 항목).
//
// ⚠ 거부는 기존 acts와 같은 `rejected()`다. 그래서 `totalAmount`가 0으로 보고된다 —
//   이는 **기존 거부 계약을 따른 결과**이지 이번에 생긴 손실이 아니다. 같은 분기의
//   acts·통원 카운터·route 불일치가 모두 같은 형태를 쓴다. 아래에서 그 계약을 고정한다.
// ⚠ 입력 형식 오류를 규제 HOLD와 섞지 않는다. 거부 note에 HOLD 문구가 섞이면 실패한다.
import { readFileSync } from "node:fs";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import {
  Gen2026CriticalExceptionalInjectionInput, Gen2026CriticalInjectionInput, Gen2026CriticalMriInput,
  Gen2026CriticalMriLine, Gen2026CriticalMskInput, Gen2026ItemClaimInput, Gen2026ItemClaimResult,
  Gen2026NonCriticalMriInput, Gen2026SpecialLine,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const call = (input: unknown) => calculateGen2026Item(input as Gen2026ItemClaimInput);
const isRejected = (r: Gen2026ItemClaimResult) =>
  r.route === "rejected" && r.status === "PENDING_UNVERIFIED"
  && r.totalOwnPay === null && r.totalInsurancePay === null && r.lines.length === 0;
const notes = (r: Gen2026ItemClaimResult) => r.notes.join(" ");
/** 소비 흔적 — 결과가 같다는 이유로 소비를 판단하지 않기 위해 구조를 직접 본다. */
const poolTrace = (r: Gen2026ItemClaimResult) =>
  r.route === "special_item"
    ? r.lines.map((l) => String(l.deductible.poolUsedAfter)).join(",") : "(n/a)";
const actTrace = (r: Gen2026ItemClaimResult) =>
  r.route === "special_item" ? r.lines.map((l) => l.actIndex).join(",") : "(n/a)";

const mriHosp = (amount = 2_000_000) => ({ amount, visit: "inpatient", tier: "hospital" });
const mriClinic = (amount = 2_000_000) => ({ amount, visit: "inpatient", tier: "clinic" });
const mriOut = (amount = 2_000_000) => ({ amount, visit: "outpatient" });
const mriNoTier = (amount = 2_000_000) => ({ amount, visit: "inpatient" });
const out = (amount = 300_000) => ({ amount, visit: "outpatient" });

const cMri = (extra: Record<string, unknown> = {}, lines: unknown[] = [mriHosp()]) =>
  ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri", lines, ...extra });
const nMri = (extra: Record<string, unknown> = {}) =>
  ({ route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri", lines: [out(1_000_000)], ...extra });
const msk = (extra: Record<string, unknown> = {}) =>
  ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "musculoskeletal_esw",
     lines: [out()], priorAnnualTreatmentActCount: 0, approvedThroughVisit: 50, ...extra });
const inj = (extra: Record<string, unknown> = {}) =>
  ({ route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
     injectionPurpose: "general", lines: [out()], ...extra });
const routed = (extra: Record<string, unknown> = {}) =>
  ({ route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
     injectionPurpose: "anticancer", cause: "injury", visit: "inpatient", tier: "hospital",
     amounts: [2_000_000], ...extra });
const room = (extra: Record<string, unknown> = {}) =>
  ({ route: "room_charge", coverage: "non_benefit", cause: "injury", severity: "critical",
     stays: [{ roomChargeTotal: 600_000, inpatientDays: 5 }], ...extra });

/** 두 필드가 함께 거부돼야 하는 무효형. 기준선에서는 전부 조용히 통과했다. */
const INVALID: [string, unknown][] = [
  ["문자열 '100'", "100"], ["빈 문자열", ""], ["null", null], ["객체", { v: 1 }],
  ["배열", [1]], ["true", true], ["false", false],
  ["음수 -1", -1], ["소수 1.5", 1.5], ["NaN", NaN],
  ["Infinity", Infinity], ["-Infinity", -Infinity],
  ["안전 정수+1", Number.MAX_SAFE_INTEGER + 1], ["1e308", 1e308],
];

// ── 1. 허용 경로의 정상 입력 — 계산이 종전과 같아야 한다 ──────────────
console.log("\n[G-14B] 1. 허용 경로 정상 입력 (무회귀)");
{
  // 진료비 2,000,000 · 공제 = Max(3만, 30%) = 600,000 → 보험금 1,400,000.
  const omitted = call(cMri());
  check("pool 생략: OK", omitted.status === "OK" && omitted.totalInsurancePay === 1_400_000);
  check("pool 생략: 소비 흔적은 그 행의 공제액", poolTrace(omitted) === "600000", poolTrace(omitted));
  const undef = call(cMri({ priorAnnualInpatientDeductible: undefined }));
  check("pool undefined: 생략과 동일", undef.status === "OK" && undef.totalInsurancePay === 1_400_000
    && poolTrace(undef) === poolTrace(omitted));
  const zero = call(cMri({ priorAnnualInpatientDeductible: 0 }));
  check("pool 0: 유효값, 생략과 같은 결과", zero.status === "OK" && zero.totalInsurancePay === 1_400_000
    && poolTrace(zero) === poolTrace(omitted));
  check("pool 4,999,999", call(cMri({ priorAnnualInpatientDeductible: 4_999_999 })).totalInsurancePay === 1_999_999);
  check("pool 5,000,000", call(cMri({ priorAnnualInpatientDeductible: 5_000_000 })).totalInsurancePay === 2_000_000);

  const c0 = call(msk());
  check("count 생략: OK", c0.status === "OK" && c0.totalInsurancePay === 210_000 && actTrace(c0) === "1");
  check("count undefined: 생략과 동일",
    call(msk({ priorAnnualCoveredCount: undefined })).totalInsurancePay === 210_000);
  check("count 0: 유효값", call(msk({ priorAnnualCoveredCount: 0 })).totalInsurancePay === 210_000);
  const c49 = call(msk({ priorAnnualCoveredCount: 49 }));
  check("count 49: 50회째로 보상", c49.status === "OK" && c49.totalInsurancePay === 210_000 && actTrace(c49) === "50");
  check("count 50: 한도 소진 → 보상 제외", call(msk({ priorAnnualCoveredCount: 50 })).totalInsurancePay === 0);
  check("주사료 count 0", call(inj({ priorAnnualCoveredCount: 0 })).totalInsurancePay === 210_000);
  check("주사료 count 50", call(inj({ priorAnnualCoveredCount: 50 })).totalInsurancePay === 0);
}

// ── 2. 한도 초과 유효값은 절삭하지 않는다 ────────────────────────────
console.log("\n[G-14B] 2. 한도 초과 유효값 무절삭");
for (const [n, v, expect] of [
  ["5,000,001", 5_000_001, 2_000_000], ["안전 정수 최대", Number.MAX_SAFE_INTEGER, 2_000_000],
] as [string, number, number][]) {
  const r = call(cMri({ priorAnnualInpatientDeductible: v }));
  check(`pool ${n}: OK·무절삭`, r.status === "OK" && r.totalInsurancePay === expect
    && poolTrace(r) === String(v), poolTrace(r));
}
for (const [n, v] of [["51", 51], ["100", 100], ["안전 정수 최대", Number.MAX_SAFE_INTEGER]] as [string, number][]) {
  const r = call(msk({ priorAnnualCoveredCount: v }));
  check(`count ${n}: OK·보상 제외(절삭 아님)`, r.status === "OK" && r.totalInsurancePay === 0);
}

// ── 3. 허용 경로의 무효값 — 명시적 거부 ──────────────────────────────
console.log("\n[G-14B] 3. 허용 경로 무효값 거부");
for (const [n, v] of INVALID) {
  const r = call(cMri({ priorAnnualInpatientDeductible: v }));
  check(`pool ${n} 거부`, isRejected(r) && notes(r).includes("0 이상의 정수여야 합니다"), notes(r).slice(0, 80));
}
for (const [n, v] of INVALID) {
  const r = call(msk({ priorAnnualCoveredCount: v }));
  check(`count ${n} 거부`, isRejected(r) && notes(r).includes("0 이상의 정수여야 합니다"), notes(r).slice(0, 80));
}

// ── 4. 미사용 축 stray — 값이 0이어도 거부 ───────────────────────────
console.log("\n[G-14B] 4. 미사용 축 거부 (0 포함)");
for (const v of [4_900_000, 0]) {
  for (const [n, mk] of [["비중증 MRI", nMri], ["중증 근골격계", msk], ["중증 일반 주사료", inj],
    ["일반 전환 주사료", routed]] as [string, (e: Record<string, unknown>) => unknown][]) {
    const r = call(mk({ priorAnnualInpatientDeductible: v }));
    check(`pool → ${n} (값 ${v}) 거부`,
      isRejected(r) && notes(r).includes("중증 비급여 MRI에만 쓰입니다"), notes(r).slice(0, 90));
  }
  const rr = call(room({ priorAnnualInpatientDeductible: v }));
  check(`pool → 상급병실료 (값 ${v}) 거부(종전 계약 유지)`,
    rr.status === "PENDING_UNVERIFIED" && notes(rr).includes("쓰이지 않는 입력"));
}
for (const v of [50, 0]) {
  for (const [n, mk] of [["중증 MRI", cMri], ["비중증 MRI", nMri],
    ["일반 전환 주사료", routed]] as [string, (e: Record<string, unknown>) => unknown][]) {
    const r = call(mk({ priorAnnualCoveredCount: v }));
    check(`count → ${n} (값 ${v}) 거부`,
      isRejected(r) && notes(r).includes("연간 보상 횟수 한도가 있는 보장종목"), notes(r).slice(0, 90));
  }
  const rr = call(room({ priorAnnualCoveredCount: v }));
  check(`count → 상급병실료 (값 ${v}) 거부(종전 계약 유지)`,
    rr.status === "PENDING_UNVERIFIED" && notes(rr).includes("쓰이지 않는 입력"));
}

// ── 5. 두 필드 교차 전달 ─────────────────────────────────────────────
console.log("\n[G-14B] 5. 두 필드 교차 전달");
{
  const a = call(cMri({ priorAnnualCoveredCount: 10, priorAnnualInpatientDeductible: 1_000_000 }));
  check("중증 MRI에 count를 함께 실으면 거부",
    isRejected(a) && notes(a).includes("연간 보상 횟수 한도가 있는 보장종목"));
  const b = call(msk({ priorAnnualCoveredCount: 10, priorAnnualInpatientDeductible: 1_000_000 }));
  check("근골격계에 pool을 함께 실으면 거부",
    isRejected(b) && notes(b).includes("중증 비급여 MRI에만 쓰입니다"));
  // ⚠ 승인 구간 축과 합치지 않는다 — acts는 근골격계에서 여전히 정상 입력이다.
  const c = call(msk({ priorAnnualCoveredCount: 10, priorAnnualTreatmentActCount: 10 }));
  check("근골격계: count와 acts는 함께 유효(축을 합치지 않음)", c.status === "OK");
}

// ── 6. 혼합 행 경계 ──────────────────────────────────────────────────
console.log("\n[G-14B] 6. 혼합 행 경계");
{
  const both = call(cMri({ priorAnnualInpatientDeductible: 4_900_000 }, [mriHosp(), mriOut(500_000)]));
  check("대상 행 1 + 통원 행: 허용되고 대상 행에서만 소비",
    both.status === "OK" && poolTrace(both) === "5000000,null", poolTrace(both));
  const secondOnly = call(cMri({ priorAnnualInpatientDeductible: 4_900_000 }, [mriOut(500_000), mriHosp()]));
  check("통원 행 + 대상 행(순서 반대): 허용", secondOnly.status === "OK");
  for (const [n, lines] of [
    ["통원만", [mriOut()]],
    ["병·의원급 입원만", [mriClinic()]],
    ["병·의원급 입원 + 통원", [mriClinic(), mriOut(500_000)]],
  ] as [string, unknown[]][]) {
    const r = call(cMri({ priorAnnualInpatientDeductible: 4_900_000 }, lines));
    check(`대상 행 없음(${n}): 거부`,
      isRejected(r) && notes(r).includes("상급종합·종합병원 입원 행에만 적용됩니다"), notes(r).slice(0, 80));
    const z = call(cMri({ priorAnnualInpatientDeductible: 0 }, lines));
    check(`대상 행 없음(${n}) · 값 0: 거부`, isRejected(z));
    const omit = call(cMri({}, lines));
    check(`대상 행 없음(${n}) · 필드 생략: 종전대로 계산`, omit.status === "OK");
  }
  // ⚠ 종별 미선택은 pool 거부가 아니라 **기존 preflight 안내**가 우선해야 한다.
  const noTier = call(cMri({ priorAnnualInpatientDeductible: 4_900_000 }, [mriNoTier()]));
  check("종별 미선택 행: 기존 preflight 안내로 진입", noTier.status === "PENDING_UNVERIFIED"
    && noTier.route === "special_item" && notes(noTier).includes("의료기관 종별을 선택해 주세요"), notes(noTier).slice(0, 90));
  check("종별 미선택 행: pool 거부 문구가 나오지 않음",
    !notes(noTier).includes("상급종합·종합병원 입원 행에만 적용됩니다"));
  check("종별 미선택 행: 진료비 합계를 보존(blocked 계약)", noTier.totalAmount === 2_000_000, String(noTier.totalAmount));
  const noTierMixed = call(cMri({ priorAnnualInpatientDeductible: 4_900_000 }, [mriOut(500_000), mriNoTier()]));
  check("혼합 + 종별 미선택: 역시 preflight 안내",
    notes(noTierMixed).includes("의료기관 종별을 선택해 주세요"));
}

// ── 7. 거부 계약의 형태 — HOLD와 섞지 않는다 ─────────────────────────
console.log("\n[G-14B] 7. 거부 계약의 형태");
{
  const r = call(cMri({ priorAnnualInpatientDeductible: "100" }));
  check("route는 rejected", r.route === "rejected");
  check("status는 PENDING_UNVERIFIED", r.status === "PENDING_UNVERIFIED");
  // ⚠ acts·통원 카운터·route 불일치와 같은 계약이다. totalAmount 0은 그 계약을 따른 결과다.
  check("totalAmount는 0 (기존 rejected() 계약)", r.totalAmount === 0);
  check("금액을 만들지 않음", r.totalOwnPay === null && r.totalInsurancePay === null);
  check("행을 만들지 않음", r.lines.length === 0);
  check("받은 값을 그대로 보여 줌", notes(r).includes('"100"'));
  const acts = call(msk({ priorAnnualTreatmentActCount: "5" }));
  check("acts 거부와 같은 형태", acts.route === r.route && acts.status === r.status && acts.totalAmount === 0);
  for (const hold of ["표준약관에 정해져 있지 않습니다", "가입하신 보험사에 확인해 주세요", "하나의 pool"]) {
    check(`거부 note에 HOLD 문구 없음: ${hold}`, !notes(r).includes(hold));
  }
}

// ── 8. 비교군 무회귀 — 축을 합치지 않았다 ────────────────────────────
console.log("\n[G-14B] 8. 비교군 무회귀");
{
  check("acts 문자열 거부(종전)", isRejected(call(msk({ priorAnnualTreatmentActCount: "5" }))));
  check("acts 미사용 축 거부(종전)", isRejected(call(cMri({ priorAnnualTreatmentActCount: 0 }))));
  check("acts 미입력은 blocked(종전)", call({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "musculoskeletal_esw", lines: [out()] }).status === "PENDING_UNVERIFIED");
  check("통원 카운터는 별도 보장종목에서 거부(종전)",
    isRejected(call(msk({ priorAnnualOutpatientVisits: 0 }))));
  check("통원 카운터 일수 축도 거부(종전)",
    isRejected(call(msk({ priorAnnualOutpatientDays: 0 }))));
}

// ── 9. 소스 계약 — 관용 정규화·절삭을 되살리지 않는다 ────────────────
console.log("\n[G-14B] 9. 소스 계약");
{
  const src = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const body = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  // acts 1 + covered 1 + pool 1 = 3. 하나라도 사라지면 개수가 줄어든다.
  check("두 필드 모두 안전 정수 검사",
    body.includes("priorAnnualCoveredCount)는 0 이상의 정수여야 합니다")
    && body.includes("priorAnnualInpatientDeductible)은 0 이상의 정수여야 합니다")
    && (body.match(/Number\.isSafeInteger/g) ?? []).length === 3,
    String((body.match(/Number\.isSafeInteger/g) ?? []).length));
  check("pool 행 조건은 some (every 아님)",
    /const eligible = lines\.some\(/.test(body)
    && /l\.visit === "inpatient" && \(l\.tier === "hospital" \|\| l\.tier === undefined\)/.test(body)
    && !/const eligible = lines\.every\(/.test(body));
  check("pool 검증에 절삭·변환을 넣지 않음",
    !/Math\.min\([^)]*priorAnnualInpatientDeductible/.test(body)
    && !/Number\(\s*pool\s*\)/.test(body) && !/Math\.floor\(\s*pool\s*\)/.test(body));
  check("count 검증에 절삭·변환을 넣지 않음",
    !/Math\.min\([^)]*priorAnnualCoveredCount/.test(body)
    && !/Number\(\s*covered\s*\)/.test(body) && !/Math\.floor\(\s*covered\s*\)/.test(body));
  // ⚠ route까지 본다. 일반 (1)(2)로 전환되는 조합(항암제 주사료·비중증 근골격계)은
  //    item 이름이 같아도 이 축을 쓰지 않는다.
  check("허용 축 판정이 route와 항목 이름으로 고정",
    /const usesCovered = raw\.route === "special_item" && raw\.severity === "critical"\s*\n\s*&& \(raw\.item === "musculoskeletal_esw" \|\| raw\.item === "injection"\);/.test(body)
    && /const usesPoolItem = raw\.route === "special_item" && raw\.severity === "critical" && raw\.item === "mri";/.test(body));
  check("두 축 검사가 route 분기보다 먼저 온다",
    body.indexOf("const usesCovered") < body.indexOf('if (raw.route === "special_item")')
    && body.indexOf("const usesPoolItem") < body.indexOf('if (raw.route === "special_item")'));
  check("소비 조건(runOnce)은 종전 그대로",
    /if \(spec\.poolEligible && line\.visit === "inpatient" && line\.tier === "hospital"\) \{/.test(body));
  check("MRI에 횟수 축을 만들지 않음", /annualVisits: null,[\s\S]{0,120}poolEligible: true/.test(body));

  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  check("types: 근골격계·주사료·비중증 MRI·일반 전환에 pool 봉인",
    (types.match(/priorAnnualInpatientDeductible\?: never;/g) ?? []).length === 4);
  // 중증 MRI · 비중증 MRI · 일반 전환 + 상급병실료(종전부터 있던 봉인) = 4.
  check("types: 중증 MRI·비중증 MRI·일반 전환에 횟수 봉인",
    (types.match(/priorAnnualCoveredCount\?: never;/g) ?? []).length === 4,
    String((types.match(/priorAnnualCoveredCount\?: never;/g) ?? []).length));
  check("types: 중증 MRI만 pool 축을 연다",
    /priorAnnualInpatientDeductible\?: number;/.test(types)
    && (types.match(/priorAnnualInpatientDeductible\?: number;/g) ?? []).length === 1);
}

// ── 9b. 타입 수준 허용·금지 ──────────────────────────────────────────
//   ⚠ 이 절은 실행 결과가 아니라 **컴파일 결과**를 고정한다. `@ts-expect-error`가 붙은
//     줄에서 오류가 사라지면 `npm run lint`/`tsc`가 실패한다 — 즉 봉인이 풀리면 빌드가 막힌다.
//   ⚠ 타입만으로는 변수·외부 데이터를 못 막는다. 그래서 런타임 검증이 본체이고, 아래
//     마지막 두 사례가 그 사실을 명시한다.
console.log("\n[G-14B] 9b. 타입 수준 허용·금지");
{
  // ⚠ 이 절만 **타입이 붙은** 행 리터럴을 쓴다. 위쪽 헬퍼는 무효형 주입을 위해 느슨한
  //    객체를 돌려주므로, 그대로 쓰면 봉인이 아니라 `lines` 타입에서 먼저 걸린다.
  const tHosp: Gen2026CriticalMriLine = { amount: 2_000_000, visit: "inpatient", tier: "hospital" };
  const tOut: Gen2026SpecialLine = { amount: 300_000, visit: "outpatient" };

  const okMri: Gen2026ItemClaimInput = { route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "mri", lines: [tHosp], priorAnnualInpatientDeductible: 1_000_000 };
  const okMsk: Gen2026ItemClaimInput = { route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "musculoskeletal_esw", lines: [tOut],
    priorAnnualTreatmentActCount: 0, priorAnnualCoveredCount: 3 };
  check("타입 허용: 중증 MRI + pool", calculateGen2026Item(okMri).status === "OK");
  check("타입 허용: 근골격계 + count", calculateGen2026Item(okMsk).status === "OK");

  /**
   * 컴파일 단계 봉인 — **타입 수준 단언**으로 고정한다.
   *   `?: never`인 속성의 타입은 `undefined`이므로 `Sealed`가 `true`가 된다. 봉인을
   *   풀어 `?: number`로 되돌리면 `false`가 되어 이 파일이 **컴파일되지 않는다.**
   *   ⚠ `@ts-expect-error`를 쓰지 않는다 — 유니온 대입 오류가 객체 첫 줄에 보고될지
   *     속성 줄에 보고될지 TS 버전·형태에 따라 달라져, 지시문 위치가 어긋나면
   *     "쓰이지 않은 지시문"으로 엉뚱하게 실패한다.
   */
  type Sealed<T, K extends string> = K extends keyof T
    ? (T[K] extends undefined ? true : false) : true;
  const sealedCriticalMriCount: Sealed<Gen2026CriticalMriInput, "priorAnnualCoveredCount"> = true;
  const sealedMskPool: Sealed<Gen2026CriticalMskInput, "priorAnnualInpatientDeductible"> = true;
  const sealedInjPool: Sealed<Gen2026CriticalInjectionInput, "priorAnnualInpatientDeductible"> = true;
  const sealedNcMriPool: Sealed<Gen2026NonCriticalMriInput, "priorAnnualInpatientDeductible"> = true;
  const sealedNcMriCount: Sealed<Gen2026NonCriticalMriInput, "priorAnnualCoveredCount"> = true;
  const sealedRoutedCount: Sealed<Gen2026CriticalExceptionalInjectionInput, "priorAnnualCoveredCount"> = true;
  const sealedRoutedPool: Sealed<Gen2026CriticalExceptionalInjectionInput, "priorAnnualInpatientDeductible"> = true;
  check("타입 봉인 7종이 컴파일 단계에서 고정",
    [sealedCriticalMriCount, sealedMskPool, sealedInjPool, sealedNcMriPool,
      sealedNcMriCount, sealedRoutedCount, sealedRoutedPool].every(Boolean));
  // 열려 있어야 하는 두 축은 반대로 `false`여야 한다 — 봉인을 과하게 걸면 여기서 걸린다.
  const openMriPool: Sealed<Gen2026CriticalMriInput, "priorAnnualInpatientDeductible"> = false;
  const openMskCount: Sealed<Gen2026CriticalMskInput, "priorAnnualCoveredCount"> = false;
  check("허용 축 두 개는 봉인되지 않음", openMriPool === false && openMskCount === false);

  // 같은 조합을 런타임에서도 거부하는지 함께 고정한다(타입은 리터럴만 막기 때문이다).
  const banned: unknown[] = [
    { route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri",
      lines: [tHosp], priorAnnualCoveredCount: 10 },
    { route: "special_item", coverage: "non_benefit", severity: "critical",
      item: "musculoskeletal_esw", lines: [tOut], priorAnnualTreatmentActCount: 0,
      priorAnnualInpatientDeductible: 1_000_000 },
    { route: "special_item", coverage: "non_benefit", severity: "critical", item: "injection",
      injectionPurpose: "general", lines: [tOut], priorAnnualInpatientDeductible: 1_000_000 },
    { route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri",
      lines: [tOut], priorAnnualInpatientDeductible: 1_000_000 },
    { route: "special_item", coverage: "non_benefit", severity: "non_critical", item: "mri",
      lines: [tOut], priorAnnualCoveredCount: 10 },
    { route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
      injectionPurpose: "anticancer", cause: "injury", visit: "inpatient", tier: "hospital",
      amounts: [2_000_000], priorAnnualCoveredCount: 10 },
    { route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
      injectionPurpose: "anticancer", cause: "injury", visit: "inpatient", tier: "hospital",
      amounts: [2_000_000], priorAnnualInpatientDeductible: 1_000_000 },
    { route: "special_item", coverage: "non_benefit", severity: "critical", item: "mri",
      lines: [tHosp], priorAnnualInpatientDeductible: "1000000" },
  ];
  check(`타입 금지 8종이 모두 런타임에서도 거부 (${banned.length}건)`,
    banned.every((x) => isRejected(call(x))));

  // ⚠ 타입은 **리터럴**만 막는다. 변수·외부 데이터는 통과하므로 런타임 검증이 본체다.
  const viaVar = { route: "special_item", coverage: "non_benefit", severity: "critical",
    item: "mri", lines: [tHosp], priorAnnualCoveredCount: 10 } as unknown as Gen2026ItemClaimInput;
  check("변수 경유는 컴파일을 통과하지만 런타임이 거부", isRejected(calculateGen2026Item(viaVar)));
  const external = JSON.parse(JSON.stringify({ route: "special_item", coverage: "non_benefit",
    severity: "critical", item: "mri", lines: [tHosp],
    priorAnnualInpatientDeductible: "1000000" })) as Gen2026ItemClaimInput;
  check("외부 데이터도 런타임이 거부", isRejected(calculateGen2026Item(external)));
}

// ── 10. 규칙값·HOLD 불변 ─────────────────────────────────────────────
console.log("\n[G-14B] 10. 규칙값·HOLD 불변");
{
  check("500만 원 값 불변", GEN2026.nonBenefit.critical.annualDeductibleCap === 5_000_000
    && REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.value === 5_000_000
    && REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.status === "CONFIRMED");
  check("G-14A pool 범위 HOLD 불변",
    REGULATORY_RULES.GEN2026_CRITICAL_DEDUCTIBLE_POOL_SCOPE.status === "HOLD"
    && REGULATORY_RULES.GEN2026_CRITICAL_DEDUCTIBLE_POOL_SCOPE.value === null
    && REGULATORY_RULES.GEN2026_CRITICAL_DEDUCTIBLE_POOL_SCOPE.verifiedAt === "2026-09-05");
  check("지급 0원 HOLD 3종 불변",
    REGULATORY_RULES.GEN2026_SPECIAL_ITEM_COUNT_ON_ZERO_PAY.status === "HOLD"
    && REGULATORY_RULES.GEN2026_NONCRITICAL_OUTPATIENT_DAYS_ON_ZERO_PAY.status === "HOLD"
    && REGULATORY_RULES.GEN2026_CRITICAL_OUTPATIENT_VISITS_ON_ZERO_PAY.status === "HOLD");
  check("상급병실료 HOLD 불변", REGULATORY_RULES.GEN2026_ROOM_CHARGE_DEDUCTIBLE_POOL.status === "HOLD");
  check("횟수 한도·MRI 금액 한도 불변",
    GEN2026.specialItem.msk.annualVisits === 50 && GEN2026.specialItem.injection.annualVisits === 50
    && GEN2026.specialItem.criticalMri.annualCoverage === 3_000_000);
  // 지급 0원 HOLD가 여전히 동작한다 — 검증 추가로 그 경로가 사라지지 않았다.
  const diverge = call(msk({ priorAnnualCoveredCount: 49,
    lines: [{ amount: 20_000, visit: "outpatient" }, { amount: 100_000, visit: "outpatient" }] }));
  check("지급 0원 HOLD 차단이 살아 있음",
    diverge.status === "PENDING_UNVERIFIED" && notes(diverge).includes("표준약관에 정해져 있지 않습니다"),
    notes(diverge).slice(0, 70));
}

console.log(`\n[G-14B 별도 보장종목 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
