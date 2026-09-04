// F-3a — 제5조④(이월 조항)의 적용 범위가 다시 확대되지 않게 고정한다.
//
// 2026-09-04 전문 재직독 (별표15 2026.5.6 공포·시행본, 별표 식별번호 3216359).
//   ⚠ 두 조항은 **같은 문장이 아니다.** 앞부분만 공통이고 참조 항과 단위가 다르다.
//     공통 : "제3조 (1)상해비급여 제3항 또는 제4항, (2)질병비급여 제2항 또는 제3항 및"
//     특약1 제5조④(인쇄 p.280) : "… (3)3대비급여 **제7항**에 따른 계속 중인 입원 또는 통원의
//       보장한도는 … 연간 보장한도(**횟수**) … 보상한 **횟수** … 잔여 횟수"
//     특약2 제5조④(p.309)      : "… (3)비급여 자기공명영상진단 **제6항**에 따른 … 계속 중인
//       입원 또는 통원의 보장한도는 … 연간 보장한도(**일수**) … 보상한 **일수** … 잔여 일수"
//   → 둘 다 **이월 전용**이고, 연간 한도 일반의 소진 기준을 정하는 조항이 **아니다**.
//   → 한쪽 문장을 다른 쪽 전문처럼 인용하지 않는다.
//
// ⚠ 이 커밋은 근거 서술만 고친다. 규칙값·status·evidenceGrade·계산·타입·UI 동작은 그대로다.
//   근거가 약해졌다는 이유로 이중 해석 차단을 제거하거나 HOLD를 CONFIRMED로 바꾸지 않는다.
import { readFileSync } from "node:fs";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { Gen2026MultiClaimInput } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const rules = REGULATORY_RULES as unknown as Record<string, {
  ruleId: string; value: unknown; status: string; evidenceGrade: string; note?: string;
  sources: { locator: string }[];
}>;
const byId = Object.fromEntries(Object.values(rules).map((r) => [r.ruleId, r]));
const ZEROPAY = [
  "GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY",
  "GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY",
  "GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY",
] as const;

// ── HOLD 상태·규칙값 무변경 ───────────────────────────────────────────
console.log("\n[불변] HOLD 상태와 규칙값");
for (const id of ZEROPAY) {
  const r = byId[id];
  check(`${id} 존재`, !!r);
  check(`${id} = HOLD / value null / REVIEW`,
    r?.status === "HOLD" && r?.value === null && r?.evidenceGrade === "REVIEW");
}
check("한도 상수는 CONFIRMED 그대로",
  byId["GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS"]?.status === "CONFIRMED"
  && byId["GEN2026-CRITICAL-OUTPATIENT-ANNUAL-VISITS"]?.value === 100
  && byId["GEN2026-NONCRITICAL-OUTPATIENT-ANNUAL-DAYS"]?.status === "CONFIRMED"
  && byId["GEN2026-NONCRITICAL-OUTPATIENT-ANNUAL-DAYS"]?.value === 100);
check("이월 기준 규칙은 그대로 CONFIRMED",
  byId["GEN2026-SPECIAL-ITEM-CARRYOVER-BASIS"]?.status === "CONFIRMED");

// ── 근거 서술: 이월 확대 금지 ─────────────────────────────────────────
console.log("\n[근거] 이월 조항을 연간 한도 일반으로 확대하지 않는다");
{
  // ⚠ 금지형. 종전 문구가 되살아나면 실패한다.
  const OVERREACH = [
    /제5조④의 '보상한 횟수'는 보상된 건을 가리키는 것으로 읽혀/,
    /제5조④의 '보상한 일수'는 보상된 날을 가리키는 것으로 읽혀/,
    /제5조④는 '보상한 횟수'라 보상된 건을 가리키는 것으로 읽혀/,
    /제5조④는 '보상한 일수'라 보상된 날을 세는 것으로 읽혀/,
  ];
  const FILES = [
    "src/lib/insurance/engine/regulatoryRules.ts",
    "src/lib/insurance/engine/multiClaim2026.ts",
    "src/lib/insurance/engine/specialItem2026.ts",
    "src/lib/insurance/engine/types.ts",
    "src/components/calculators/HealthCalcMulti2026.tsx",
    "docs/insurance/audit-status.md",
    "docs/insurance/multi-claim-design.md",
    "README.md",
  ];
  for (const f of FILES) {
    const t = readFileSync(f, "utf8");
    check(`${f.split("/").pop()}: 이월 확대 문구 없음`,
      OVERREACH.every((re) => !re.test(t)),
      OVERREACH.filter((re) => re.test(t)).map(String).join(" "));
  }
  // 연간 한도의 근거로 제5조④를 드는 사용자 안내가 없어야 한다.
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("연간 한도 안내가 제5조④를 근거로 들지 않는다",
    !/연간 한도는 약관상 통원 100(회|일)입니다\([^)]*제5조/.test(eng)
    && !/기준 1년간 통원 100(회|일)가? 한도입니다\([^)]*제5조/.test(eng));
  check("연간 한도 안내가 표를 근거로 든다",
    /통원 100회입니다\(특별약관1 제3조 \(1\)제1항·\(2\)제1항 <구분·보상금액>\)/.test(eng)
    && /통원 100일입니다\(특별약관2 제3조 \(1\)제1항·\(2\)제1항 <구분·보상금액>\)/.test(eng));
}

// ── 근거 서술: 이월 한정을 실제로 적었는가 ────────────────────────────
console.log("\n[근거] 이월 한정과 조사 범위를 명시한다");
for (const id of ZEROPAY) {
  const note = byId[id]?.note ?? "";
  check(`${id}: 이월 전용임을 밝힌다`,
    /계속 중인 (입원|치료)/.test(note) && /이월/.test(note), note.slice(0, 80));
  check(`${id}: '직접 읽은 범위'로 한정한다`, note.includes("직접 읽은 범위"));
  check(`${id}: 근거 부존재를 단정하지 않는다`,
    note.includes("단정하지 않는다") && /유권해석|분쟁조정례|지급심사/.test(note));
  check(`${id}: '원문에 근거가 없다'류 단정이 없다`,
    !/어디에도 (판단 )?근거가 없|원문에 판단 문언이 없다/.test(note), note.slice(0, 60));
}
check("3대비급여 note의 낡은 설명이 정정됐다", (() => {
  const n = byId["GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY"]?.note ?? "";
  return !n.includes("아직 이 계열의 규칙으로 등록돼 있지 않다")
    && n.includes("GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY");
})());
check("낡은 설명이 저장소 어디에도 없다",
  !["src/lib/insurance/engine/regulatoryRules.ts", "docs/insurance/audit-status.md",
    "docs/insurance/multi-claim-design.md"]
    .some((f) => readFileSync(f, "utf8").includes("아직 이 계열의 규칙으로 등록돼 있지 않다")));

// ── 특약1·2 인용을 서로 뒤바꾸지 않는다 ──────────────────────────────
console.log("\n[근거] 특약별 인용 구분");
{
  const rules = readFileSync("src/lib/insurance/engine/regulatoryRules.ts", "utf8");
  const critNote = byId["GEN2026-CRITICAL-OUTPATIENT-VISITS-ZEROPAY"]?.note ?? "";
  const ncNote = byId["GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY"]?.note ?? "";
  const spNote = byId["GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY"]?.note ?? "";
  // 특약1을 인용하는 note는 '(3)3대비급여 제7항'과 '횟수'를 쓴다.
  check("중증(특약1) note가 특약1의 참조 항을 쓴다",
    critNote.includes("(3)3대비급여 제7항") && !critNote.includes("자기공명영상진단 제6항"));
  check("3대비급여(특약1) note가 특약2 참조 항을 쓰지 않는다",
    !spNote.includes("자기공명영상진단 제6항"));
  // ⚠ 이번에 잡은 결함 — 특약2 note에 특약1 문장이 들어 있었다.
  check("비중증(특약2) note가 특약2의 참조 항을 쓴다",
    ncNote.includes("(3)비급여 자기공명영상진단 제6항"), ncNote.slice(0, 120));
  // ⚠ 대조를 위해 특약1을 **언급**하는 것은 맞다. 금지할 것은 특약2 인용문 **안에**
  //   특약1의 참조 항이 들어가는 것이다. 특약2 인용 구간만 잘라서 본다.
  {
    const from = ncNote.indexOf("**특약2** 제5조④");
    const to = ncNote.indexOf("⚠ 특약1 제5조④");
    const quote = from >= 0 && to > from ? ncNote.slice(from, to) : "";
    check("특약2 인용 구간을 찾음", quote.length > 0);
    check("특약2 인용 안에 특약1의 '(3)3대비급여 제7항'이 없다",
      quote.length > 0 && !quote.includes("(3)3대비급여 제7항"), quote.slice(0, 140));
    check("특약2 인용 안에 '보상한 횟수'가 없다",
      quote.length > 0 && !quote.includes("보상한 횟수"));
    check("특약1 대조는 참조 항과 단위 차이를 밝힌다",
      ncNote.includes("참조 항이 '(3)3대비급여 제7항'이고 단위도 '횟수'"));
  }
  check("비중증(특약2) note가 '일수' 단위를 쓴다", ncNote.includes("보상한 일수"));
  check("비중증 note가 두 조항이 다른 문장임을 밝힌다",
    ncNote.includes("다른 문장") || ncNote.includes("서로의 전문처럼"));
  // 문서·테스트 머리말에서도 '두 조항 모두' 뒤에 한쪽 참조 항만 붙지 않게 한다.
  for (const f of ["docs/insurance/audit-status.md", "docs/insurance/multi-claim-design.md",
    "tests/gen2026CarryoverScope.test.ts"]) {
    const t = readFileSync(f, "utf8");
    check(`${f.split("/").pop()}: 공통 인용에 한쪽 참조 항을 섞지 않는다`,
      !/두 조항 모두[\s\S]{0,200}\(3\)3대비급여 제7항/.test(t)
      && !/두 조항[은는] 모두[\s\S]{0,200}\(3\)비급여 자기공명영상진단 제6항/.test(t));
  }
  check("출처 설명은 특약1 전용임을 밝힌다",
    /특약1 제3조\(3\)⑦·제5조④ — \*\*계속 중인 치료의 이월 한도\*\* 조항/.test(rules));
}

// ── 이월 계산은 미구현이다 ───────────────────────────────────────────
console.log("\n[구현 상태] 세 사실을 분리한다");
{
  const audit = readFileSync("docs/insurance/audit-status.md", "utf8");
  // ⚠ 이번에 잡은 결함 — 이월 기준을 '확정됐고 구현했다'로 묶어 적고 있었다.
  check("연간 100일 한도는 구현으로 적는다",
    /통원 100일' 한도는 \*\*확정됐고 보험기간 중 연간 한도로 구현했다/.test(audit));
  check("이월 기준은 근거 기록으로만 적는다",
    /계약 종료 후 계속 중인 통원의 이월 기준\*\*으로 근거만 기록했다/.test(audit));
  check("이월 계산 기능은 미구현으로 적는다",
    audit.includes("이월 계산 기능은 구현하지 않았다"));
  check("이월 기준을 연간 한도와 묶어 '구현했다'로 쓰지 않는다",
    !/제5조④\([^)]*\)의 '연간 보장한도\(일수\)·보상한 일수'는 확정됐고 구현했다/.test(audit));
  // CONFIRMED 규칙 note에도 제5조④가 연간 한도의 근거처럼 남지 않게 한다.
  const dayRule = byId["GEN2026-NONCRITICAL-OUTPATIENT-ANNUAL-DAYS"]?.note ?? "";
  check("연간 100일 CONFIRMED note가 제5조④를 한도 근거로 들지 않는다",
    !/특약2 제5조④도 연간 보장한도\(일수\)·보상한 일수로 규정한다/.test(dayRule));
  check("연간 100일 CONFIRMED note가 표를 근거로 든다",
    dayRule.includes("특약2 (1)①·(2)① 표"));
  check("연간 100일 CONFIRMED note가 이월 미구현을 밝힌다",
    dayRule.includes("이월 계산 자체는 구현하지 않았다"));
  // 실제로 이월을 계산하지 않는다(코드로 확인).
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const item = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("엔진에 180일 이월 계산이 없다",
    !/180일/.test(eng) && !/carryOver|carryover/i.test(eng) && !/carryOver|carryover/i.test(item));
  check("전환 경로는 이월 미반영을 안내한다", item.includes("이 계산에는 반영하지 않았습니다"));
}

// ── 계산 정책 무변경 ─────────────────────────────────────────────────
console.log("\n[불변] 이중 해석 차단 정책");
{
  const crit = (amounts: number[], v: number) => calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    severity: "critical", nonBenefitItem: "general", amounts,
    priorAnnualOutpatientVisits: v } as unknown as Gen2026MultiClaimInput);
  check("중증: 지급 0원 행이 결과를 가르면 여전히 전체 차단",
    crit([20_000, 500_000], 99).status === "PENDING_UNVERIFIED");
  check("중증: 갈리지 않으면 종전대로 계산",
    crit([20_000, 500_000], 0).status === "OK");
  const nc = (amounts: number[], d: number) => calculateMany2026({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", tier: "clinic",
    severity: "non_critical", nonBenefitItem: "general", amounts,
    priorAnnualOutpatientDays: d } as unknown as Gen2026MultiClaimInput);
  check("비중증: 지급 0원 행이 결과를 가르면 여전히 전체 차단",
    nc([40_000, 300_000], 99).status === "PENDING_UNVERIFIED");
  check("비중증: 갈리지 않으면 종전대로 계산", nc([40_000, 300_000], 0).status === "OK");
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("이중 실행과 지문 비교가 그대로 있다",
    /const countedA = runBundle\(true\);\s*\n\s*const countedB = runBundle\(false\);/.test(eng)
    && /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(eng));
}

console.log(`\n[이월 조항 적용 범위] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
