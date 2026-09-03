// 커밋 E — 5세대 중증 일반 비급여 통원 연 100**회**의 지급 0원 처리.
//
// 별표15 2026.5.6 공포·시행본(admRulSeq 2200000108697, 별표 식별번호 3216359)
//   특별약관1 제3조 (1)상해비급여 제1항(인쇄 p.258)·(2)질병비급여 제1항(p.261)
//     <구분·보상금액> 통원 행 — "매년 계약해당일부터 1년간 통원 100회를 한도로 합니다."
//   같은 조 (1)제6항·제7항(p.259)·(2)제5항·제7항(p.262) — "1회의 통원으로 보아"
//   제5조(보험가입금액 한도 등) 제4항(p.280)
//     — "연간 보장한도(횟수)에서 … 보상한 횟수를 차감한 잔여 횟수"
//
// ⚠ 표는 '통원 100회'로 통원 자체를, 제5조④는 '보상한 횟수'로 보상된 건을 가리키는 것으로
//   읽혀 지급 0원 통원의 처리가 갈린다. 종전 구현은 `amount > 0`이면 소진하는 한쪽 해석을
//   말없이 채택했다. 3대비급여·비중증 통원과 같은 안전성으로 통일한다.
import { readFileSync } from "node:fs";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import {
  Cause, Gen2026ItemClaimInput, Gen2026MultiClaimInput, MultiClaimResult,
} from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const LIMIT = GEN2026.nonBenefit.critical.outpatientAnnualVisits;
const CAP = "GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS";
const DAYS_CAP = "GEN2026_NONCRITICAL_OUTPATIENT_ANNUAL_DAYS";
const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");

const cr = (amounts: number[], visits: number | undefined,
  extra: Record<string, unknown> = {}, cause: Cause = "disease") =>
  calculateMany2026({
    cause, coverage: "non_benefit", visit: "outpatient", tier: "clinic", severity: "critical",
    nonBenefitItem: "general", amounts, priorAnnualOutpatientVisits: visits, ...extra,
  } as unknown as Gen2026MultiClaimInput);
const paid = (r: MultiClaimResult) => r.lines.map((l) => l.insurancePay).join();
const blockedShape = (r: MultiClaimResult, totalAmount: number) =>
  r.status === "PENDING_UNVERIFIED" && r.lines.length === 0
  && r.totalOwnPay === null && r.totalInsurancePay === null
  && r.appliedCaps.length === 0 && r.totalAmount === totalAmount;

// ── 근거·레지스트리 ──────────────────────────────────────────────────
console.log("\n[중증 통원 0원] 근거·레지스트리 추적");
{
  const rules = Object.values(REGULATORY_RULES) as unknown as {
    ruleId: string; value: unknown; status: string; evidenceGrade: string; note?: string;
    verifiedAt?: string; sources: readonly { url: string; locator: string; document: string }[];
  }[];
  const byId = (id: string) => rules.find((r) => r.ruleId === id);
  const hold = byId("GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY");
  check("HOLD 규칙이 등록돼 있다", hold !== undefined);
  check("status HOLD · value null", hold?.status === "HOLD" && hold?.value === null,
    `${hold?.status}/${JSON.stringify(hold?.value)}`);
  check("evidenceGrade REVIEW", hold?.evidenceGrade === "REVIEW");
  check("verifiedAt 기록", hold?.verifiedAt === "2026-09-03", hold?.verifiedAt);
  const src = hold?.sources ?? [];
  check("출처가 판본 직행 주소",
    src.every((x) => x.url === "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108697"));
  check("출처에 별표 식별번호 3216359", src.every((x) => x.locator.includes("3216359")));
  for (const page of ["p.258", "p.261", "p.259", "p.262", "p.280"]) {
    check(`출처가 인쇄 ${page}를 특정`, src.some((x) => x.locator.includes(page)), page);
  }
  check("출처가 '통원 100회'를 인용", src.some((x) => x.locator.includes("통원 100회")));
  check("출처가 제5조④ '보상한 횟수'를 인용", src.some((x) => x.locator.includes("보상한 횟수")));
  check("note가 미확정 범위를 '지급 0원 통원의 소진 여부'로 한정",
    (hold?.note ?? "").includes("지급 보험금이 0원인 통원이 그 100회를 소진하는지"), hold?.note);
  check("note가 한도값·단위는 CONFIRMED라고 밝힌다",
    (hold?.note ?? "").includes("GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS = CONFIRMED"));
  // 한도값·단위 규칙은 그대로 CONFIRMED다.
  const limit = byId("GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS");
  check("한도 100회는 CONFIRMED 유지", limit?.status === "CONFIRMED" && limit?.value === 100);
  check("상수가 레지스트리에서 파생", LIMIT === 100 && LIMIT === limit?.value);
  // ⚠ 세 규칙을 합치지 않는다.
  const ids = ["GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY",
    "GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY", "GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY"];
  check("세 0원 규칙이 각각 별개로 등록돼 있다",
    ids.every((id) => byId(id)?.status === "HOLD" && byId(id)?.value === null));
  check("세 규칙의 출처가 서로 다르다",
    new Set(ids.map((id) => (byId(id)?.sources ?? []).map((x) => x.locator).join("|"))).size === 3);
}

// ── 경계 ─────────────────────────────────────────────────────────────
console.log("\n[경계] 기존 사용 횟수");
{
  const A = 500_000, PAY = 350_000; // 30% 자기부담, 최소공제 3만원보다 큼
  check("0회 + 정상 1건", cr([A], 0).status === "OK" && paid(cr([A], 0)) === String(PAY));
  check("98회 + 정상 2건 → 둘 다 보상", paid(cr([A, A], 98)) === [PAY, PAY].join());
  check("99회 + 정상 1건 → 100회째 보상", paid(cr([A], 99)) === String(PAY));
  check("99회 + 정상 2건 → 둘째 제외", paid(cr([A, A], 99)) === [PAY, 0].join());
  check("99회 + 2건: 둘째 covered:false", cr([A, A], 99).lines[1].covered === false);
  check("99회 + 2건: 둘째에 CapCode", cr([A, A], 99).lines[1].appliedCaps.includes(CAP));
  check("99회 + 2건: 첫째에는 CapCode 없음", !cr([A, A], 99).lines[0].appliedCaps.includes(CAP));
  check("100회 + 정상 1건 → 제외", paid(cr([A], 100)) === "0" && cr([A], 100).lines[0].covered === false);
  check("101회 + 정상 1건 → 제외", paid(cr([A], 101)) === "0");
  check("미입력은 0회로 본다", paid(cr([A], undefined)) === String(PAY));
  for (const cause of ["injury", "disease"] as const) {
    check(`${cause} 축에도 적용`, paid(cr([A, A], 99, {}, cause)) === [PAY, 0].join());
  }
  // 같은 날 합산은 한 행 = 1회. 두 행이면 2회.
  check("같은 날 합산 한 행은 1회만 소진", paid(cr([1_000_000], 99)) === "700000");
  check("두 행은 2회로 계산", paid(cr([A, A], 99)) === [PAY, 0].join());
  check("결과 키 집합이 보상 행과 제외 행에서 같다",
    Object.keys(cr([A, A], 99).lines[0]).sort().join(",")
    === Object.keys(cr([A, A], 99).lines[1]).sort().join(","));
}

// ── 두 해석 ──────────────────────────────────────────────────────────
console.log("\n[해석 A/B] 지급 0원 통원");
{
  const A = 500_000, ZERO = 20_000; // 공제 3만원 미달 → 지급 0원
  check("0회 + [지급0원, 정상] → 한도에 닿지 않아 정상",
    cr([ZERO, A], 0).status === "OK" && paid(cr([ZERO, A], 0)) === [0, 350_000].join());
  const split = cr([ZERO, A], 99);
  check("99회 + [지급0원, 정상] → 두 해석이 갈려 전체 차단",
    blockedShape(split, ZERO + A), split.status);
  check("차단 안내가 근거 없음을 말한다",
    split.notes.some((n) => n.includes("표준약관에 정해져 있지 않습니다")));
  check("차단 안내가 '회' 단위를 쓴다(일과 혼용하지 않는다)",
    split.notes.some((n) => n.includes("연 100회 한도의 횟수"))
    && !split.notes.some((n) => n.includes("100일")));
  check("차단 안내가 보험사 확인을 안내",
    split.notes.some((n) => n.includes("보험사에 확인해 주세요")));
  check("차단 시 후보 금액을 노출하지 않는다",
    !split.notes.some((n) => /\d{1,3}(,\d{3})+원/.test(n)) && split.lines.length === 0);
  check("차단 시 내부 카운터를 노출하지 않는다",
    !split.notes.some((n) => /\d+회째/.test(n)));
  // 진료비 0원 행은 두 해석 모두 미소진 → 갈리지 않는다.
  check("99회 + [진료비 0원, 정상] → 정상",
    cr([0, A], 99).status === "OK" && paid(cr([0, A], 99)) === [0, 350_000].join());
  check("빈 묶음도 정상", cr([], 99).status === "OK");
  // 연간 보험가입금액 소진으로 지급 0원이 되는 통원
  check("연간 한도 소진으로 0원이 된 통원이 경계를 뒤집으면 차단",
    blockedShape(cr([A, A, A], 98, { annualCoverageLimit: 350_000 }), A * 3));
  check("연간 한도 소진이라도 경계에 닿지 않으면 정상",
    cr([A, A, A], 0, { annualCoverageLimit: 350_000 }).status === "OK");
  // 통원 1회당 가입금액이 걸린 상태에서도 같은 판정
  check("통원 가입금액이 걸린 상태에서도 갈리면 차단",
    blockedShape(cr([ZERO, A], 99, { outpatientCoverageLimit: 200_000 }), ZERO + A));
  check("통원 가입금액이 걸려도 경계 밖이면 정상",
    cr([ZERO, A], 0, { outpatientCoverageLimit: 200_000 }).status === "OK");
}

// ── 중증 예외 주사료 일반 전환 ───────────────────────────────────────
console.log("\n[일반 전환] 중증 예외 주사료도 같은 정책");
{
  const A = 500_000, ZERO = 20_000;
  const inj = (amounts: number[], visits: number) => calculateGen2026Item({
    route: "general", coverage: "non_benefit", severity: "critical", item: "injection",
    injectionPurpose: "anticancer", cause: "disease", visit: "outpatient", amounts,
    priorAnnualOutpatientVisits: visits,
  } as unknown as Gen2026ItemClaimInput);
  check("예외 주사 전환: 99회 + 정상 1건 → 보상", inj([A], 99).totalInsurancePay === 350_000);
  check("예외 주사 전환: 100회 + 정상 1건 → 제외", inj([A], 100).totalInsurancePay === 0);
  check("예외 주사 전환: 100회 제외 행에 중증 CapCode",
    inj([A], 100).appliedCaps.includes(CAP));
  const s = inj([ZERO, A], 99);
  check("예외 주사 전환: 99회 + [지급0원, 정상] → 차단",
    s.status === "PENDING_UNVERIFIED" && s.lines.length === 0
    && s.totalOwnPay === null && s.totalInsurancePay === null, s.status);
  check("예외 주사 전환: 차단 안내가 '회' 단위",
    s.notes.some((n) => n.includes("연 100회 한도의 횟수")));
  // 라우터가 카운터를 정확히 전달하는지 — 값을 바꾸면 결과가 바뀌어야 한다.
  check("라우터가 priorAnnualOutpatientVisits를 실제로 전달",
    inj([A], 99).totalInsurancePay !== inj([A], 100).totalInsurancePay);
  const router = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("라우터가 중증에만 '회' 축을 전달",
    /input\.severity === "critical"\s*\n?\s*\? \{ priorAnnualOutpatientVisits: input\.priorAnnualOutpatientVisits \}/.test(router));
}

// ── 적용 범위 ────────────────────────────────────────────────────────
console.log("\n[범위] 두 번째 실행이 없는 경로");
{
  const A = 500_000, ZERO = 20_000;
  const many = (o: Record<string, unknown>) =>
    calculateMany2026({ cause: "disease", amounts: [ZERO, A], ...o } as unknown as Gen2026MultiClaimInput);
  // 급여 통원은 건보 본인부담률이 필수다. 넣지 않으면 이 규칙과 무관한 사유로
  // 차단되어 가드가 무력해진다. 첫 행은 최소공제(의원 1만원) 미만이라 지급액이 0원이 되므로
  // '지급 0원 행이 있는 급여 통원'이라는 이 검사의 조건이 실제로 성립한다.
  const ben = calculateMany2026({ cause: "disease", amounts: [8_000, A],
    coverage: "benefit", visit: "outpatient", tier: "clinic",
    nhisCoinsuranceRate: 0.2 } as unknown as Gen2026MultiClaimInput);
  check("급여 통원은 차단되지 않는다", ben.status === "OK", ben.notes.join(" | "));
  check("급여 통원에 지급 0원 행이 실제로 있다",
    ben.lines.length === 2 && ben.lines[0].insurancePay === 0);
  check("급여 통원에 '회' 안내가 없다",
    !ben.notes.some((n) => n.includes("연 100회 한도의 횟수")));
  check("중증 입원은 차단되지 않는다",
    many({ coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "critical",
      nonBenefitItem: "general" }).status === "OK");
  check("비중증 입원은 차단되지 않는다",
    many({ coverage: "non_benefit", visit: "inpatient", tier: "clinic", severity: "non_critical",
      nonBenefitItem: "general" }).status === "OK");
  // 비중증 통원은 '일' 축의 별개 규칙이 담당한다.
  const nc = many({ coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    severity: "non_critical", nonBenefitItem: "general", priorAnnualOutpatientDays: 99 });
  check("비중증 통원은 '일' 규칙으로 차단(회 안내가 아니다)",
    nc.status === "PENDING_UNVERIFIED"
    && nc.notes.some((n) => n.includes("연 100일 한도의 일수"))
    && !nc.notes.some((n) => n.includes("연 100회 한도의 횟수")), nc.notes.join(" | "));
  check("중증 결과에 비중증 CapCode가 섞이지 않는다", !cr([A, A], 100).appliedCaps.includes(DAYS_CAP));
  // 3대비급여·비중증 MRI·상급병실료는 별도 경로다.
  for (const item of ["musculoskeletal_esw", "injection", "mri", "room_charge"] as const) {
    const r = many({ coverage: "non_benefit", visit: "outpatient", tier: "clinic",
      severity: "critical", nonBenefitItem: item, priorAnnualOutpatientVisits: 99 });
    check(`${item}은 일반 통원 경로에 도달하지 않는다`,
      r.status === "PENDING_UNVERIFIED" && !r.notes.some((n) => n.includes("연 100회 한도의 횟수")));
  }
  // 2·3·4세대는 이 파일의 함수를 쓰지 않는다.
  check("엔진이 5세대 전용 파일 안에만 있다", eng.includes("calculateMany2026"));
}

// ── 입력축 정책 ──────────────────────────────────────────────────────
console.log("\n[입력축] 두 통원 카운터를 섞지 않는다");
{
  const A = 500_000;
  check("중증에 Days가 실리면 차단(값 0이어도)",
    cr([A], 0, { priorAnnualOutpatientDays: 0 }).status === "PENDING_UNVERIFIED");
  check("비중증에 Visits가 실리면 차단(값 0이어도)",
    calculateMany2026({ cause: "disease", coverage: "non_benefit", visit: "outpatient",
      tier: "clinic", severity: "non_critical", nonBenefitItem: "general", amounts: [A],
      priorAnnualOutpatientVisits: 0, priorAnnualOutpatientDays: 0,
    } as unknown as Gen2026MultiClaimInput).status === "PENDING_UNVERIFIED");
  // ⚠ Visits의 관용 정규화는 이번 커밋에서 바꾸지 않는다(별도 결함으로 보고).
  check("Visits의 관용 정규화는 종전 그대로(음수 → 0)",
    cr([A], -1).status === "OK" && paid(cr([A], -1)) === "350000");
  check("Visits의 관용 정규화는 종전 그대로(소수 내림)",
    cr([A], 99.9).status === "OK" && paid(cr([A], 99.9)) === "350000");
  const src = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("Visits는 여전히 nonNegInt로 정규화된다",
    /let outpatientVisits = nonNegInt\(nb\?\.priorAnnualOutpatientVisits\)/.test(src));
  check("Days는 엄격 검증을 유지한다", /badOutpatientDays\(/.test(src));
}

// ── 구조 가드 ────────────────────────────────────────────────────────
console.log("\n[가드] 이중 해석 구조");
{
  check("두 해석을 독립 실행한다",
    /const countedA = runBundle\(true\);/.test(eng) && /const countedB = runBundle\(false\);/.test(eng));
  check("비교 결과가 차단에 연결",
    /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(eng));
  check("통원이 아닌 경로는 두 번째 실행이 없다",
    /if \(dualAxis === null\) return runBundle\(true\);/.test(eng));
  check("중증·비중증 축이 각각 자기 안내를 쓴다",
    /isCriticalOutpatient \? ZERO_PAY_VISITS_HOLD_NOTES/.test(eng)
    && /isNonCriticalOutpatient \? ZERO_PAY_DAYS_HOLD_NOTES/.test(eng));
  check("두 안내가 서로 다른 상수",
    /const ZERO_PAY_VISITS_HOLD_NOTES = \[/.test(eng)
    && /const ZERO_PAY_DAYS_HOLD_NOTES = \[/.test(eng));
  check("소진 판정이 지급액 확정 뒤에 온다", (() => {
    const at = eng.indexOf("const consumes = amount > 0");
    const clamp = eng.indexOf("single = {\n            ...single, insurancePay: remaining");
    return at > 0 && clamp > 0 && clamp < at;
  })());
  check("중증 카운터가 해석 인자를 읽는다",
    /if \(isCriticalOutpatient && consumes\) outpatientVisits \+= 1;/.test(eng));
  check("비중증 카운터도 같은 인자를 읽는다",
    /if \(isNonCriticalOutpatient && consumes\) outpatientDays \+= 1;/.test(eng));
  check("한쪽 해석을 고정하지 않는다",
    !/countZeroPay \|\| true/.test(eng) && !/\(true \|\| /.test(eng));
  check("누적 상태가 runBundle 안에서 새로 만들어진다", (() => {
    const m = /function runBundle\([^)]*\): MultiClaimResult \{([\s\S]*?)\n  \}/.exec(eng);
    if (m === null) return false;
    return ["let insurancePaid =", "let deductiblePaid =", "let outpatientVisits =",
      "let outpatientDays =", "const results:"].every((d) => m[1].includes(d));
  })());
  check("fingerprint가 요구된 필드를 모두 본다",
    /r\.status[\s\S]{0,120}totalOwnPay[\s\S]{0,120}appliedCaps[\s\S]{0,200}l\.covered[\s\S]{0,200}l\.deductibleApplied/.test(eng));
  // 지문 대상은 **정해진 목록 그대로**여야 한다. 빠지면 갈린 결과가 새어 나가고,
  //   늘어나면 정해진 것보다 더 많은 묶음이 막힌다. 양방향으로 고정한다.
  const fpBody = /function fingerprint\(r: MultiClaimResult\): string \{([\s\S]*?)\n\}/.exec(eng);
  check("fingerprint 본문을 찾음", fpBody !== null);
  {
    const body = fpBody === null ? "" : fpBody[1];
    const fields = (body.match(/\b(?:r|l)\.[A-Za-z]+/g) ?? []).map((x) => x.slice(2));
    const want = ["status", "totalAmount", "totalOwnPay", "totalInsurancePay", "appliedCaps",
      "lines", "index", "covered", "amount", "ownPay", "insurancePay",
      "rateBased", "rateApplied", "minDeductible", "deductibleApplied"];
    const got = [...new Set(fields)].sort().join(",");
    check("fingerprint 대상이 정해진 목록과 정확히 같다",
      got === [...new Set(want)].sort().join(","), got);
  }
  // 두 후보가 같다고 확인된 뒤 돌려주는 것은 **A**다. 이 지점에서 두 후보는 지문 대상
  //   전 항목이 같지만, 어느 쪽을 돌려주는지는 코드가 명시해야 읽는 사람이 확인할 수 있다.
  check("동일 확인 후 A를 돌려준다", /return blocked\(dualAxis\);\n  return countedA;\n/.test(eng));
  check("상수에서 한도를 읽는다",
    /outpatientVisits >= GEN2026\.nonBenefit\.critical\.outpatientAnnualVisits/.test(eng)
    && !/outpatientVisits >= 100/.test(eng));
}

console.log(`\n[중증 통원 0원] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
