// 5세대 중증 입원 500만원 상한 — "공제금액 누적" 계약 가드.
//
// 별표15 2026.5.6 공포·시행본 특별약관1 제5조⑤(인쇄 p.280)
//   "입원의 경우 상급종합병원·종합병원의 상해·질병 및 3대 비급여 의료비(3대 비급여 중 근골격계
//    이학요법치료·체외충격파치료 및 주사료 관련 비급여 의료비는 제외) 중 **공제금액**이 계약일
//    또는 매년 계약해당일부터 기산하여 연간 500만원을 초과하는 때에는 500만원까지 공제합니다."
//
// 누적 대상은 약관상 공제금액이지 최종 자기부담금이 아니다. 종전 구현은 다회에서 각 건의
// ownPay를 누적했고, 연간 보험가입금액 한도로 잘려 추가 부담한 금액이 섞이면 pool이 과대
// 소진되어 이후 건의 공제가 사라진다(보험금 과다 산출).
//
// 이 파일이 실패하면 문구를 되돌리기 전에 제5조⑤ 원문을 먼저 확인할 것.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { calculate } from "../src/lib/insurance/engine/engine";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { CAP_LABELS } from "../src/lib/insurance/engine/capLabels";
import { Severity, Tier, Visit } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const CAP = GEN2026.nonBenefit.critical.annualDeductibleCap;
const critIn = (amount: number, tier: Tier, prior?: number) =>
  calc2026({ amount, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier, priorAnnualDeductible: prior });

console.log("\n[5세대 500만원 공제 pool] 근거·명칭");
check("규칙 값 500만원", CAP === 5_000_000);
check("상수가 규칙을 추적", CAP === REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.value);
check("규칙 ID가 DEDUCTIBLE 의미", REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP.ruleId === "GEN2026-CRITICAL-ANNUAL-DEDUCTIBLE-CAP");
check("CapCode 라벨이 공제금액 상한임을 표시",
  CAP_LABELS.GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL.includes("공제금액 상한"));

console.log("\n[5세대 500만원 공제 pool] 경계 — 직전·정확히 도달·초과");
{
  // 잔여 30만원 = 공제 30만원 → 상한이 구속되지 않는다.
  const r = critIn(1_000_000, "hospital", 4_700_000);
  check("잔여와 공제가 같으면 미구속", r.deductibleApplied === 300_000 && r.ownPay === 300_000 && !r.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"), JSON.stringify(r));
}
{
  // 공제 33만원 > 잔여 30만원 → 30만원까지만 공제.
  const r = critIn(1_100_000, "hospital", 4_700_000);
  check("잔여를 넘으면 잔여까지만 공제", r.deductibleApplied === 300_000 && r.ownPay === 300_000 && r.insurancePay === 800_000, JSON.stringify(r));
  check("구속 시 CapCode", r.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
}
{
  const r = critIn(1_000_000, "hospital", CAP);
  check("이미 500만원을 채웠으면 공제 0", r.deductibleApplied === 0 && r.ownPay === 0 && r.insurancePay === 1_000_000, JSON.stringify(r));
}
{
  const over = critIn(1_000_000, "hospital", 6_000_000);
  check("500만원 초과 입력도 잔여 0으로 클램프", over.ownPay === 0 && over.insurancePay === 1_000_000);
}

console.log("\n[5세대 500만원 공제 pool] 적용 범위 — 중증·입원·상급종합/종합만");
{
  const clinic = critIn(10_000_000, "clinic", 4_900_000);
  check("중증 의원급 입원에는 미적용", clinic.deductibleApplied === 3_000_000 && clinic.ownPay === 3_000_000 && clinic.appliedCaps.length === 0, JSON.stringify(clinic));
}
{
  const out = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", tier: "hospital", priorAnnualDeductible: 4_900_000 });
  check("중증 통원에는 미적용", !out.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL") && out.ownPay === 3_000_000, JSON.stringify(out));
}
{
  const nc = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient", tier: "hospital", priorAnnualDeductible: 4_900_000 });
  check("비중증 입원에는 미적용", !nc.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"), JSON.stringify(nc));
}

console.log("\n[5세대 500만원 공제 pool] 0·음수 누적 입력의 정규화 정책 유지");
{
  const zero = critIn(10_000_000, "hospital", 0);
  const neg = critIn(10_000_000, "hospital", -1_000_000);
  const none = critIn(10_000_000, "hospital");
  check("0·음수·미입력이 모두 누적 0과 같다",
    zero.ownPay === 3_000_000 && neg.ownPay === 3_000_000 && none.ownPay === 3_000_000,
    JSON.stringify([zero.ownPay, neg.ownPay, none.ownPay]));
}

console.log("\n[deductibleApplied] ownPay와 다른 값임을 고정 (회귀 가드)");
{
  // 통원 1회당 가입금액이 구속되면 자기부담금이 공제금액보다 커진다.
  const r = calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", perVisitCoverageLimit: 200_000 });
  check("중증 통원 한도 구속: 공제 30만 < 자기부담 80만",
    r.deductibleApplied === 300_000 && r.ownPay === 800_000, JSON.stringify(r));
}
{
  // 비중증 입원 회당 300만원 한도가 구속되는 경우.
  const r = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient" });
  check("비중증 입원 한도 구속: 공제 500만 < 자기부담 700만",
    r.deductibleApplied === 5_000_000 && r.ownPay === 7_000_000, JSON.stringify(r));
}

console.log("\n[다회] pool 누적은 ownPay 합계가 아니라 deductibleApplied 합계");
{
  // line0에서 연간 보험가입금액이 구속돼 ownPay(600만) > 공제금액(300만)이 된다.
  //   종전 구현: pool += 600만 → 즉시 소진 → line1 공제 0
  //   현재 구현: pool += 300만 → line1 잔여 200만까지 공제
  const r = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical",
    visit: "inpatient", tier: "hospital", amounts: [10_000_000, 10_000_000],
    annualCoverageLimit: 4_000_000,
  });
  check("line0 자기부담금과 공제금액이 다르다",
    r.lines[0].ownPay === 6_000_000 && r.lines[0].deductibleApplied === 3_000_000, JSON.stringify(r.lines[0]));
  check("line1 공제가 잔여 200만원으로 확정(종전 구현이면 0)",
    r.lines[1].deductibleApplied === 2_000_000, JSON.stringify(r.lines[1]));
  check("line1에 공제 상한 CapCode",
    r.lines[1].appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
  check("연간 보험금 한도 CapCode도 함께",
    r.appliedCaps.includes("GEN2026_CRITICAL_ANNUAL_COVERAGE"));
  check("합계 불변", r.totalInsurancePay === 4_000_000 && r.totalOwnPay === 16_000_000, JSON.stringify([r.totalInsurancePay, r.totalOwnPay]));
}
{
  // 이월 입력도 공제금액 기준으로 이어진다.
  const r = calculateMany2026({
    cause: "injury", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical",
    visit: "inpatient", tier: "hospital", amounts: [10_000_000, 10_000_000], priorAnnualDeductible: 4_000_000,
  });
  check("이월 400만 → line0 100만, line1 0 공제",
    r.lines[0].deductibleApplied === 1_000_000 && r.lines[1].deductibleApplied === 0, JSON.stringify(r.lines.map((l) => l.deductibleApplied)));
}

console.log("\n[5세대] 레거시 priorAnnualPaid는 존재만으로 차단한다");
{
  // ⚠ "priorAnnualDeductible을 함께 넘겼으면 통과"로 두면 레거시 값이 조용히 무시된다.
  //   사용자는 반영됐다고 오인한다. 존재 자체를 거부한다.
  const nb = { amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", visit: "inpatient", tier: "hospital", severity: "critical" } as const;
  const blocked = (label: string, extra: Record<string, number>) => {
    const r = calculate("2026", { ...nb, ...extra });
    check(`${label} → 차단`, r.status === "PENDING_UNVERIFIED" && r.ownPay === null, JSON.stringify(r));
    check(`${label} → 사유가 대체 필드를 안내`,
      r.notes.some((n) => n.includes("priorAnnualPaid는 2·3세대") && n.includes("priorAnnualDeductible로 넘겨")), JSON.stringify(r.notes));
    check(`${label} → 차단 결과에 deductibleApplied 키 없음`, !Object.hasOwn(r, "deductibleApplied"));
  };
  blocked("① priorAnnualPaid만", { priorAnnualPaid: 4_000_000 });
  blocked("② priorAnnualPaid: 0", { priorAnnualPaid: 0 });
  blocked("③ priorAnnualPaid + priorAnnualDeductible 동시", { priorAnnualPaid: 4_000_000, priorAnnualDeductible: 1_000_000 });
  const ok4 = calculate("2026", { ...nb, priorAnnualDeductible: 4_000_000 });
  check("④ priorAnnualDeductible 단독 → 정상 계산", ok4.status === "OK" && ok4.ownPay === 1_000_000 && ok4.deductibleApplied === 1_000_000, JSON.stringify(ok4));
  // 급여 경로도 같은 계약이다. 제네릭 진입점으로 잘못 넘어오면 계산하지 않는다.
  const ben = calculate("2026", { amount: 10_000_000, coverage: "benefit", visit: "inpatient", priorAnnualPaid: 1_000_000 });
  check("⑤ 5세대 급여에 priorAnnualPaid → 차단", ben.status === "PENDING_UNVERIFIED", JSON.stringify(ben));
}
{
  // 2·3세대의 priorAnnualPaid는 그대로 살아 있어야 한다.
  const g3 = calculate("2017", { amount: 15_000_000, coverage: "benefit", visit: "inpatient", plan: "standard", priorAnnualPaid: 1_500_000 });
  check("2·3세대 priorAnnualPaid는 계속 동작", g3.status === "OK" && g3.appliedCaps.includes("GEN2017_INPATIENT_OWN_PAY_ANNUAL"), JSON.stringify(g3));
}

console.log("\n[deductibleApplied] 키가 존재하는 범위 — 5세대 비급여 정상 결과만");
{
  const has = (r: object) => Object.hasOwn(r, "deductibleApplied");
  // 급여: 500만원 공제 pool과 무관하므로 키 자체가 없어야 한다.
  const benIn = calc2026({ amount: 10_000_000, coverage: "benefit", visit: "inpatient" });
  const benOut = calc2026({ amount: 1_000_000, coverage: "benefit", visit: "outpatient", tier: "hospital", nhisCoinsuranceRate: 0.6 });
  check("5세대 급여 입원 결과에 키 없음", benIn.status === "OK" && !has(benIn), JSON.stringify(benIn));
  check("5세대 급여 통원 결과에 키 없음", benOut.status === "OK" && !has(benOut), JSON.stringify(benOut));
  // PENDING: 값이 확정되지 않았으므로 키가 없어야 한다.
  const pendNhis = calc2026({ amount: 1_000_000, coverage: "benefit", visit: "outpatient" });
  const pendItem = calc2026({ amount: 1_000_000, coverage: "non_benefit", visit: "inpatient", severity: "critical" } as never);
  const pendBlocked = calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "mri", visit: "inpatient", severity: "critical" });
  check("건보율 미입력 PENDING에 키 없음", pendNhis.status === "PENDING_UNVERIFIED" && !has(pendNhis));
  check("치료유형 미지정 PENDING에 키 없음", pendItem.status === "PENDING_UNVERIFIED" && !has(pendItem));
  check("별도 보장종목 차단 결과에 키 없음", pendBlocked.status === "PENDING_UNVERIFIED" && !has(pendBlocked));
  // 2·3·4세대: 이번 커밋 범위 밖이므로 키가 생기면 안 된다.
  for (const [gen, input] of [
    ["2009", { amount: 10_000_000, coverage: "benefit", visit: "inpatient", plan: "standard" }],
    ["2017", { amount: 10_000_000, coverage: "non_benefit", visit: "outpatient", facility: "clinic", plan: "selective" }],
    ["2021", { amount: 10_000_000, coverage: "non_benefit", visit: "inpatient", tier: "hospital" }],
  ] as const) {
    const r = calculate(gen, input);
    check(`${gen}세대 결과에 키 없음`, !has(r), JSON.stringify(r));
  }
  // 5세대 일반 비급여 정상 결과: 키가 있고 정수이며 값이 정확하다.
  const nbIn = calc2026({ amount: 10_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "clinic" });
  const nbOut = calc2026({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient" });
  check("5세대 비급여 입원: 키 존재 + 정확한 공제금액",
    has(nbIn) && nbIn.deductibleApplied === 3_000_000, JSON.stringify(nbIn));
  check("5세대 비급여 통원: 키 존재 + 정확한 공제금액",
    has(nbOut) && nbOut.deductibleApplied === 500_000, JSON.stringify(nbOut));
  // 다회: 보상 제외 행에도 키가 있어야 pool 누적이 0으로 명시된다.
  const many = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [1_000_000], priorAnnualOutpatientVisits: 100 });
  check("다회 보상 제외 행: 키 존재 + 0", has(many.lines[0]) && many.lines[0].deductibleApplied === 0, JSON.stringify(many.lines[0]));
  const manyBen = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [10_000_000] });
  check("다회 급여 행에 키 없음", !has(manyBen.lines[0]), JSON.stringify(manyBen.lines[0]));
}

console.log("\n[불변식] 격자");
{
  const amounts = [0, 1, 29_999, 30_000, 99_999, 100_000, 1_000_000, 9_999_999, 10_000_000, 33_333_333];
  const priors = [undefined, 0, 1_000_000, 4_999_999, 5_000_000, 9_000_000];
  let bad = 0; let firstBad = "";
  for (const severity of ["critical", "non_critical"] as Severity[]) {
    for (const visit of ["inpatient", "outpatient"] as Visit[]) {
      for (const tier of ["clinic", "hospital"] as Tier[]) {
        for (const amount of amounts) {
          for (const prior of priors) {
            const r = calc2026({ amount, coverage: "non_benefit", nonBenefitItem: "general", severity, visit, tier, priorAnnualDeductible: prior });
            const d = r.deductibleApplied ?? -1;
            const okAll = r.status === "OK"
              && (r.ownPay ?? 0) + (r.insurancePay ?? 0) === r.amount
              && Number.isInteger(d) && d >= 0 && d <= r.amount && d <= (r.ownPay ?? 0);
            if (!okAll) { bad++; if (!firstBad) firstBad = `${severity}/${visit}/${tier}/${amount}/${prior} → ${JSON.stringify(r)}`; }
          }
        }
      }
    }
  }
  check(`불변식 ${amounts.length * priors.length * 8}건 통과 (ownPay+insurancePay=amount, 0<=공제<=min(진료비, 자기부담금))`, bad === 0, firstBad);
}

console.log("\n[가드] 종전 명칭이 실행 코드·문서에 남지 않는다");
{
  // 허용 범위: docs/insurance/audit-status.md의 "종전 명칭 대조표" 표 행(줄이 '|'로 시작)과
  //            "종전 명칭"이라고 명시한 줄. 감사 경위 서술을 문자열 금지로 막지 않기 위한 예외다.
  //            이 가드 파일 자신은 검사 대상 문자열을 데이터로 담고 있으므로 제외한다.
  const BANNED = [
    "GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL",
    "GEN2026_CRITICAL_ANNUAL_OWN_PAY_CAP",
    "GEN2026-CRITICAL-ANNUAL-OWN-PAY-CAP",
    "priorAnnualOwnPay",
  ];
  // 2·3세대의 inpatientAnnualOwnPayCap과 구분하기 위해 앞에 영문자가 없을 때만 잡는다.
  const BANNED_RE = /(?<![A-Za-z])annualOwnPayCap/;
  const SELF = "tests/gen2026DeductiblePool.test.ts";
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|md|mjs)$/.test(name)) out.push(full);
    }
    return out;
  };
  const files = ["src", "tests", "docs"].flatMap((d) => walk(d))
    .concat(["README.md"])
    .filter((f) => f !== SELF);
  const hits: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const isAllowed = file === "docs/insurance/audit-status.md"
        && (line.trimStart().startsWith("|") || line.includes("종전 명칭"));
      if (isAllowed) return;
      if (BANNED.some((b) => line.includes(b)) || BANNED_RE.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  check("종전 식별자 잔존 없음", hits.length === 0, hits.join(", "));
}
// ⚠ 두 화면을 합쳐 검사하면 한쪽만 되돌아가도 통과한다. 파일마다 따로 검사한다.
for (const f of ["src/components/calculators/HealthCalc5th.tsx", "src/components/calculators/HealthCalcMulti2026.tsx"]) {
  // JSX는 문구를 줄바꿈으로 쪼개므로 공백을 정규화한 뒤 비교한다.
  const ui = readFileSync(f, "utf8").replace(/\s+/g, " ");
  const name = f.split("/").pop();
  for (const banned of ["자기부담 상한 500만", "자기부담 상한(500만", "이미 부담한 중증 비급여 입원 자기부담금", "기존 자기부담금"]) {
    check(`${name}: 종전 문구 "${banned}" 없음`, !ui.includes(banned));
  }
  check(`${name}: 누적 대상을 공제금액으로 안내`, ui.includes("이미 누적된") && ui.includes("공제금액"));
  check(`${name}: 한도 초과 부담 제외를 명시`, ui.includes("보험가입금액 한도로 추가 부담한 금액은 포함되지 않"));
}
{
  const multi = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("다회 pool이 deductibleApplied를 누적", /deductiblePaid \+= single\.deductibleApplied/.test(multi));
  check("다회 pool이 ownPay를 누적하지 않음", !/\+= *single\.ownPay/.test(multi));
  const gen = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("공제금액을 settle 결과에서 되받지 않음", !/deductibleApplied: *s\.ownPay/.test(gen) && !/, *s\.ownPay, *notes/.test(gen));
  check("ok()가 공제금액을 선택 인자로 받는다", /deductibleApplied\?: number,/.test(gen));
  check("공제금액이 undefined면 키를 만들지 않는다", /if \(deductibleApplied !== undefined\) r\.deductibleApplied = deductibleApplied;/.test(gen));
  check("레거시 필드 차단이 존재 여부만 본다",
    /priorAnnualPaid \!== undefined\) \{/.test(gen) && !/legacyPrior !== undefined &&/.test(gen));
}

console.log(`\n[5세대 공제 pool] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
