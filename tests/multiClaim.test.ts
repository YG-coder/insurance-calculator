// 다회 청구 엔진 테스트.
//   근거는 docs/insurance/multi-claim-design.md, 산식 근거는 insurance-gen123-engine-design.md 참조.
//   기대값은 약관 문언에서 옮긴 것이며 구현을 실행해 얻은 값이 아니다.
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { calculate } from "../src/lib/insurance/engine/engine";
import { ClaimLine, MultiClaimResult, Plan } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const GENS: ("2009" | "2017")[] = ["2009", "2017"];
const PLANS: Plan[] = ["standard", "selective"];
const out = (amount: number, facility: ClaimLine["facility"] = "clinic"): ClaimLine =>
  ({ amount, visit: "outpatient", facility });
const inp = (amount: number): ClaimLine => ({ amount, visit: "inpatient" });

// ── 1. 건별 합 = 총계, 그리고 총계 불변식 ────────────────────────────
{
  const r = calculateMany("2017", {
    plan: "standard",
    lines: [out(300_000), out(40_000), out(30_000, "pharmacy"), inp(1_000_000)],
  });
  const sumOwn = r.lines.reduce((s, l) => s + (l.ownPay ?? 0), 0);
  const sumIns = r.lines.reduce((s, l) => s + (l.insurancePay ?? 0), 0);
  const sumAmt = r.lines.reduce((s, l) => s + l.amount, 0);
  check("건별 자기부담 합 = 총 자기부담", sumOwn === r.totalOwnPay, `${sumOwn} vs ${r.totalOwnPay}`);
  check("건별 보험금 합 = 총 보험금", sumIns === r.totalInsurancePay);
  check("건별 진료비 합 = 총 진료비", sumAmt === r.totalAmount);
  check("총 자기부담 + 총 보험금 = 총 진료비", (r.totalOwnPay ?? 0) + (r.totalInsurancePay ?? 0) === r.totalAmount);
  // 표준형: 통원 30만→6만, 4만→1만(정액), 처방 3만→8천, 입원 100만→20만
  check("표준형 4건 합계 기대값", r.totalOwnPay === 60_000 + 10_000 + 8_000 + 200_000, String(r.totalOwnPay));
  check("index가 입력 순서와 일치", r.lines.every((l, i) => l.index === i));
}

// ── 2. 총액은 순서와 무관 (건별 배분만 순서를 탄다) ──────────────────
{
  const lines = [inp(8_000_000), inp(3_000_000), out(300_000), inp(500_000)];
  const base = calculateMany("2017", { plan: "standard", lines });
  const perms: ClaimLine[][] = [
    [lines[3], lines[0], lines[2], lines[1]],
    [lines[2], lines[1], lines[3], lines[0]],
    [...lines].reverse(),
  ];
  let bad = 0;
  for (const p of perms) {
    const r = calculateMany("2017", { plan: "standard", lines: p });
    if (r.totalOwnPay !== base.totalOwnPay || r.totalInsurancePay !== base.totalInsurancePay) bad++;
  }
  check("총액은 행 순서와 무관", bad === 0, `불일치 ${bad}건`);
  // 입원 자기부담 20% 합계는 8000만*0.2... 상한 200만에 걸린다
  check("입원 자기부담 총액이 연간 상한 200만원", base.lines.filter((l) => l.rateApplied === 0.2 && l.minDeductible === 0)
    .reduce((s, l) => s + (l.ownPay ?? 0), 0) === 2_000_000, String(base.totalOwnPay));
}

// ── 3. 1건만 넣으면 단건 엔진과 동일해야 한다 ────────────────────────
{
  let bad = 0, n = 0;
  for (const gen of GENS) for (const plan of PLANS) {
    for (const line of [out(300_000), out(40_000, "tertiary"), out(30_000, "pharmacy"), out(5_000), inp(1_000_000), inp(15_000_000)]) {
      const single = calculate(gen, {
        amount: line.amount, coverage: "benefit", visit: line.visit,
        facility: line.visit === "outpatient" ? line.facility : undefined, plan,
        priorAnnualPaid: line.visit === "inpatient" ? 0 : undefined,
      });
      const many = calculateMany(gen, { plan, lines: [line] });
      n++;
      if (many.totalOwnPay !== single.ownPay || many.totalInsurancePay !== single.insurancePay) bad++;
    }
  }
  check(`1건 입력 = 단건 엔진 결과 (${n}케이스)`, bad === 0, `불일치 ${bad}건`);
}

// ── 4. 연간 횟수 한도 ────────────────────────────────────────────────
{
  const r = calculateMany("2017", {
    plan: "standard",
    lines: [out(300_000), out(300_000)],
    priorAnnualOutpatientVisits: 179,
  });
  check("한도 직전 1건은 보상", r.lines[0].covered === true && r.lines[0].ownPay === 60_000);
  check("180회 초과 건은 보상 제외 — 자기부담이 진료비 전액", r.lines[1].covered === false && r.lines[1].ownPay === 300_000 && r.lines[1].insurancePay === 0);
  check("초과 건에 횟수 한도 capCode", r.lines[1].appliedCaps.includes("GEN2017_OUTPATIENT_ANNUAL_VISITS"));
  check("제외 건수 안내", r.notes.some((n) => n.includes("1건이 연간 횟수 한도")));

  const rx = calculateMany("2017", {
    plan: "standard",
    lines: [out(30_000, "pharmacy"), out(300_000)],
    priorAnnualPrescriptions: 180,
    priorAnnualOutpatientVisits: 0,
  });
  check("처방전 한도 초과는 처방 건만 제외", rx.lines[0].covered === false && rx.lines[1].covered === true);
  check("외래와 처방 횟수는 별도 집계", rx.lines[1].ownPay === 60_000);
  check("처방 한도 capCode 분리", rx.lines[0].appliedCaps.includes("GEN2017_PRESCRIPTION_ANNUAL_COUNT"));

  // 입원은 횟수 한도가 없다
  const many = calculateMany("2017", { plan: "standard", lines: Array.from({ length: 5 }, () => inp(100_000)), priorAnnualOutpatientVisits: 180 });
  check("입원은 연간 통원 횟수 한도의 영향을 받지 않음", many.lines.every((l) => l.covered));
}

// ── 5. 회(건)당 가입금액 한도 ────────────────────────────────────────
{
  const withLimit = calculateMany("2017", {
    plan: "selective", lines: [out(1_000_000)], perVisitCoverageLimit: 300_000,
  });
  check("회당 가입금액 30만원이 보험금 상한으로 구속", withLimit.totalInsurancePay === 300_000 && withLimit.totalOwnPay === 700_000);
  check("구속 시 capCode", withLimit.appliedCaps.includes("GEN2017_PER_VISIT_COVERAGE_LIMIT"));

  const noLimit = calculateMany("2017", { plan: "selective", lines: [out(1_000_000)] });
  check("미입력 시 적용하지 않음", noLimit.totalInsurancePay === 990_000 && noLimit.appliedCaps.length === 0);
  check("미입력 시 안내 문구", noLimit.notes.some((n) => n.includes("회(건)당 가입금액은 계약마다 다른 값")));

  // 입원에는 적용하지 않는다 — 회(건)당 한도는 외래·처방조제비 항목의 가입금액이다
  const inpatient = calculateMany("2017", { plan: "standard", lines: [inp(5_000_000)], perVisitCoverageLimit: 300_000 });
  check("입원에는 회(건)당 가입금액을 적용하지 않음", inpatient.totalInsurancePay === 4_000_000 && inpatient.totalOwnPay === 1_000_000);
}

// ── 6. 입원 자기부담 상한의 건 사이 누적 ─────────────────────────────
{
  const r = calculateMany("2017", { plan: "standard", lines: [inp(5_000_000), inp(5_000_000), inp(5_000_000)] });
  // 각 건 20% = 100만. 1건 100만, 2건 100만(누적 200만), 3건 0
  check("입원 1건차 자기부담 100만", r.lines[0].ownPay === 1_000_000);
  check("입원 2건차 자기부담 100만 (누적 200만)", r.lines[1].ownPay === 1_000_000);
  check("입원 3건차는 상한 소진으로 0", r.lines[2].ownPay === 0 && r.lines[2].insurancePay === 5_000_000);
  check("상한 구속 건에 capCode", r.lines[2].appliedCaps.includes("GEN2017_INPATIENT_OWN_PAY_ANNUAL"));

  const withPrior = calculateMany("2017", { plan: "standard", lines: [inp(5_000_000)], priorAnnualPaid: 1_500_000 });
  check("기납부 150만 → 잔여 50만", withPrior.totalOwnPay === 500_000);

  // 통원 자기부담은 입원 상한에 누적되지 않는다 (약관 단서가 입원 표에만 있다)
  const mixed = calculateMany("2017", { plan: "standard", lines: [out(10_000_000), inp(5_000_000)] });
  check("통원 자기부담은 입원 상한을 소진하지 않음", mixed.lines[1].ownPay === 1_000_000, String(mixed.lines[1].ownPay));
}

// ── 7. plan 미지정·빈 입력 ───────────────────────────────────────────
{
  const r = calculateMany("2017", { lines: [out(300_000)] });
  check("plan 미지정 → PENDING_UNVERIFIED", r.status === "PENDING_UNVERIFIED" && r.totalOwnPay === null);
  check("보류여도 총 진료비는 계산", r.totalAmount === 300_000);

  const empty = calculateMany("2017", { plan: "standard", lines: [] });
  check("빈 입력은 0으로 종결", empty.status === "OK" && empty.totalAmount === 0 && empty.totalOwnPay === 0 && empty.totalInsurancePay === 0);
}

// ── 8. 전 매트릭스 불변식 ────────────────────────────────────────────
{
  const bad: Record<string, number> = { "합계 정합": 0, "건별 정수": 0, "총계 정수": 0, "0 <= ownPay <= amount": 0 };
  let n = 0;
  const amounts = [0, 1, 7, 9_999, 50_001, 300_000, 999_999, 5_000_000];
  for (const gen of GENS) for (const plan of PLANS) {
    for (const a of amounts) for (const b of amounts) {
      for (const f of ["clinic", "hospital", "tertiary", "pharmacy"] as const) {
        const r: MultiClaimResult = calculateMany(gen, {
          plan, lines: [out(a, f), inp(b), out(b, f)],
          priorAnnualPaid: 500_000, perVisitCoverageLimit: 300_000,
        });
        n++;
        if ((r.totalOwnPay ?? 0) + (r.totalInsurancePay ?? 0) !== r.totalAmount) bad["합계 정합"]++;
        if (!r.lines.every((l) => Number.isInteger(l.ownPay) && Number.isInteger(l.insurancePay))) bad["건별 정수"]++;
        if (!Number.isInteger(r.totalOwnPay) || !Number.isInteger(r.totalInsurancePay)) bad["총계 정수"]++;
        if (!r.lines.every((l) => (l.ownPay ?? 0) >= 0 && (l.ownPay ?? 0) <= l.amount)) bad["0 <= ownPay <= amount"]++;
      }
    }
  }
  for (const [k, v] of Object.entries(bad)) check(`불변식 ${k} (${n}케이스)`, v === 0, `위반 ${v}건`);
}

// ── 9. 입력 정규화 ───────────────────────────────────────────────────
{
  const r = calculateMany("2017", {
    plan: "standard",
    lines: [out(-500_000), out(Number.NaN), out(10_000.9)],
    priorAnnualOutpatientVisits: -5,
    priorAnnualPaid: -100,
  });
  check("음수·NaN 진료비는 0으로, 소수는 floor", r.lines[0].amount === 0 && r.lines[1].amount === 0 && r.lines[2].amount === 10_000);
  check("음수 누적 입력은 0으로 클램프", r.status === "OK" && r.lines.every((l) => l.covered));
}

console.log(`\n[multiClaim] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
